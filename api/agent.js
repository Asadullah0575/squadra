// api/agent.js (CommonJS)
// POST /api/agent?action=match&profileId=  — triggered on new profile post
// POST /api/agent?action=cron              — hourly cron job (called by Vercel cron)
// GET  /api/agent?action=matches&profileId= — get matches for a profile

const { getDB, cors, ok, err } = require('./_lib');
const { randomUUID } = require('crypto');

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';

async function callClaude(prompt) {
  const res = await fetch(ANTHROPIC_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return data.content[0].text;
}

async function sendEmail(to, subject, html) {
  if (!process.env.RESEND_API_KEY) return;
  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Squadra Agent <onboarding@resend.dev>',
        to: [to],
        subject,
        html,
      }),
    });
  } catch(e) { console.error('Email error:', e.message); }
}

function matchEmail(toName, fromName, fromRole, reasoning, profileId, appUrl) {
  return `
    <div style="font-family:'IBM Plex Sans',sans-serif;max-width:520px;margin:0 auto;padding:32px;background:#0f0f11;color:#f4f2ee;border-radius:8px">
      <div style="font-family:monospace;font-weight:700;font-size:16px;margin-bottom:8px">SQU<span style="color:#d4f53c">ADRA</span></div>
      <div style="font-family:monospace;font-size:10px;color:#d4f53c;letter-spacing:0.1em;text-transform:uppercase;margin-bottom:24px">AI MATCHING AGENT</div>
      <h2 style="font-size:20px;font-weight:600;margin-bottom:8px">We found a great match for you 🤖</h2>
      <p style="color:#7a7870;font-size:14px;line-height:1.6;margin-bottom:16px">
        Hi <strong style="color:#f4f2ee">${toName}</strong>, our AI agent analysed your profile and found a strong match:
      </p>
      <div style="background:#1e1e22;border:1px solid rgba(212,245,60,0.15);border-radius:8px;padding:16px;margin-bottom:20px">
        <div style="font-weight:600;font-size:15px;color:#f4f2ee;margin-bottom:4px">${fromName}</div>
        <div style="font-size:12px;color:#7a7870;margin-bottom:12px">${fromRole}</div>
        <div style="font-size:13px;color:#f0ede6;line-height:1.65;font-style:italic">"${reasoning}"</div>
      </div>
      <a href="${appUrl}/profile.html?id=${profileId}"
         style="display:inline-block;background:#d4f53c;color:#0a0a0a;font-family:monospace;font-weight:700;font-size:12px;letter-spacing:0.04em;padding:10px 20px;border-radius:4px;text-decoration:none">
        VIEW PROFILE & INVITE →
      </a>
      <p style="color:#3a3835;font-size:11px;margin-top:28px">Powered by Squadra AI Agent · You can manage notifications in your settings.</p>
    </div>`;
}

async function findAndNotifyMatches(db, targetProfile, allProfiles, appUrl) {
  if (!targetProfile || allProfiles.length < 2) return 0;

  // filter out self and already-matched
  const existingMatches = await db.execute({
    sql: 'SELECT matched_id FROM agent_matches WHERE profile_id = ?',
    args: [targetProfile.id],
  });
  const alreadyMatched = new Set(existingMatches.rows.map(r => r.matched_id));

  const candidates = allProfiles.filter(p =>
    p.id !== targetProfile.id && !alreadyMatched.has(p.id)
  );
  if (!candidates.length) return 0;

  // Build prompt for Claude
  const targetSkills = safeJSON(targetProfile.skills, []);
  const targetLooking = safeJSON(targetProfile.looking_for, []);

  const candidateSummaries = candidates.slice(0, 20).map(p => ({
    id: p.id,
    name: p.name,
    role: p.role,
    track: p.track,
    timezone: p.timezone,
    skills: safeJSON(p.skills, []).join(', '),
    looking_for: safeJSON(p.looking_for, []).join(', '),
    bio: (p.bio || '').slice(0, 150),
  }));

  const prompt = `You are a team-matching agent for Squadra, a platform where builders find co-founders and teammates.

TARGET BUILDER:
Name: ${targetProfile.name}
Role: ${targetProfile.role}
Track: ${targetProfile.track}
Timezone: ${targetProfile.timezone}
Skills: ${targetSkills.join(', ')}
Looking for: ${targetLooking.join(', ')}
Bio: ${(targetProfile.bio || '').slice(0, 200)}

CANDIDATES (${candidateSummaries.length} builders):
${JSON.stringify(candidateSummaries, null, 2)}

Task: Select the TOP 3 best matches for the target builder. For each match, provide:
1. Their profile ID
2. A match score (0-100)
3. A 1-2 sentence explanation of WHY they are a great match (be specific about complementary skills, shared track, timezone alignment, etc.)

Respond ONLY with valid JSON, no other text:
{
  "matches": [
    {"profileId": "...", "score": 85, "reasoning": "..."},
    {"profileId": "...", "score": 78, "reasoning": "..."},
    {"profileId": "...", "score": 71, "reasoning": "..."}
  ]
}`;

  let matches;
  try {
    const response = await callClaude(prompt);
    const clean = response.replace(/```json|```/g, '').trim();
    matches = JSON.parse(clean).matches;
  } catch(e) {
    console.error('Claude error:', e.message);
    return 0;
  }

  if (!matches?.length) return 0;

  let notified = 0;

  for (const match of matches) {
    const matchedProfile = candidates.find(p => p.id === match.profileId);
    if (!matchedProfile) continue;

    const matchId = randomUUID();
    const now = new Date().toISOString().replace('T', ' ').replace('Z', '');

    // Save match
    try {
      await db.execute({
        sql: `INSERT INTO agent_matches (id, profile_id, matched_id, score, reasoning, notified, created_at)
              VALUES (?, ?, ?, ?, ?, 0, ?)`,
        args: [matchId, targetProfile.id, matchedProfile.id, match.score || 0, match.reasoning || '', now],
      });
    } catch(e) {
      if (e.message.includes('UNIQUE')) continue;
      continue;
    }

    // Create in-app notification for target user
    try {
      await db.execute({
        sql: `INSERT INTO notifications (id, user_id, type, title, body, link, created_at)
              VALUES (?, ?, 'match', ?, ?, ?, ?)`,
        args: [
          randomUUID(),
          targetProfile.user_id,
          '🤖 AI Match Found',
          `${matchedProfile.name} is a great match for you — ${match.reasoning.slice(0, 100)}`,
          `/profile.html?id=${matchedProfile.id}`,
          now,
        ],
      });
    } catch(e) {}

    // Create in-app notification for matched user too
    try {
      await db.execute({
        sql: `INSERT INTO notifications (id, user_id, type, title, body, link, created_at)
              VALUES (?, ?, 'match', ?, ?, ?, ?)`,
        args: [
          randomUUID(),
          matchedProfile.user_id,
          '🤖 AI Match Found',
          `${targetProfile.name} is a great match for you — ${match.reasoning.slice(0, 100)}`,
          `/profile.html?id=${targetProfile.id}`,
          now,
        ],
      });
    } catch(e) {}

    // Send emails
    try {
      const [targetUser, matchedUser] = await Promise.all([
        db.execute({ sql: 'SELECT email FROM users WHERE id = ?', args: [targetProfile.user_id] }),
        db.execute({ sql: 'SELECT email FROM users WHERE id = ?', args: [matchedProfile.user_id] }),
      ]);

      if (targetUser.rows[0]?.email) {
        await sendEmail(
          targetUser.rows[0].email,
          `🤖 AI Agent found a match: ${matchedProfile.name}`,
          matchEmail(targetProfile.name, matchedProfile.name, matchedProfile.role, match.reasoning, matchedProfile.id, appUrl)
        );
      }
      if (matchedUser.rows[0]?.email) {
        await sendEmail(
          matchedUser.rows[0].email,
          `🤖 AI Agent found a match: ${targetProfile.name}`,
          matchEmail(matchedProfile.name, targetProfile.name, targetProfile.role, match.reasoning, targetProfile.id, appUrl)
        );
      }
    } catch(e) { console.error('Email error:', e.message); }

    notified++;
  }

  // Mark as notified
  await db.execute({
    sql: 'UPDATE agent_matches SET notified = 1 WHERE profile_id = ?',
    args: [targetProfile.id],
  });

  return notified;
}

module.exports = async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const db = getDB();
  const appUrl = process.env.APP_URL || 'https://squadra-ruby.vercel.app';
  const { action, profileId } = req.query;

  // ── MATCH on new profile ─────────────────────────────
  if (req.method === 'POST' && action === 'match') {
    if (!profileId) return err(res, 'profileId required');

    const profileRow = await db.execute({
      sql: 'SELECT * FROM profiles WHERE id = ?',
      args: [profileId],
    });
    if (!profileRow.rows.length) return err(res, 'Profile not found', 404);

    const allProfiles = (await db.execute('SELECT * FROM profiles ORDER BY created_at DESC')).rows;
    const notified = await findAndNotifyMatches(db, profileRow.rows[0], allProfiles, appUrl);

    return ok(res, { message: `Agent ran. Notified ${notified} matches.`, notified });
  }

  // ── CRON — run for all unmatched profiles ────────────
  if (req.method === 'POST' && action === 'cron') {
    // verify cron secret
    if (req.headers['authorization'] !== `Bearer ${process.env.CRON_SECRET}`) {
      return err(res, 'Forbidden', 403);
    }
    const allProfiles = (await db.execute('SELECT * FROM profiles ORDER BY created_at DESC')).rows;
    let total = 0;
    // run agent for profiles that have fewer than 3 matches
    for (const profile of allProfiles.slice(0, 10)) {
      const matchCount = await db.execute({
        sql: 'SELECT COUNT(*) as n FROM agent_matches WHERE profile_id = ?',
        args: [profile.id],
      });
      if ((matchCount.rows[0]?.n || 0) < 3) {
        total += await findAndNotifyMatches(db, profile, allProfiles, appUrl);
      }
    }
    return ok(res, { message: `Cron complete. Total notifications: ${total}`, total });
  }

  // ── GET matches for a profile ────────────────────────
  if (req.method === 'GET' && action === 'matches') {
    if (!profileId) return err(res, 'profileId required');
    const result = await db.execute({
      sql: `SELECT am.*, p.name, p.role, p.avatar_url, p.track, p.id as pid
            FROM agent_matches am
            JOIN profiles p ON p.id = am.matched_id
            WHERE am.profile_id = ?
            ORDER BY am.score DESC`,
      args: [profileId],
    });
    return ok(res, { matches: result.rows });
  }

  return err(res, 'Method not allowed', 405);
};

function safeJSON(s, fb) { try { return JSON.parse(s); } catch { return fb; } }