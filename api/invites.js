// api/invites.js (CommonJS)
// GET  /api/invites  — get my sent invite profile IDs
// POST /api/invites  — send invite + email notification

const { getDB, verifyToken, getToken, cors, ok, err } = require('./_lib');
const { randomUUID } = require('crypto');

async function sendInviteEmail(toEmail, fromName, toName) {
  if (!process.env.RESEND_API_KEY) return;

  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Squadra <onboarding@resend.dev>',
        to:   [toEmail],
        subject: `${fromName} wants to connect on Squadra`,
        html: `
          <div style="font-family: 'IBM Plex Sans', sans-serif; max-width: 480px; margin: 0 auto; padding: 32px; background: #0f0f11; color: #f4f2ee; border-radius: 8px;">
            <div style="margin-bottom: 24px;">
              <span style="font-family: monospace; font-weight: 700; font-size: 16px; color: #f4f2ee;">
                SQU<span style="color: #d4f53c;">ADRA</span>
              </span>
            </div>
            <h2 style="font-size: 20px; font-weight: 600; margin-bottom: 12px; color: #f4f2ee;">
              You have a new invite
            </h2>
            <p style="color: #7a7870; font-size: 14px; line-height: 1.6; margin-bottom: 24px;">
              Hi ${toName}, <strong style="color: #f4f2ee;">${fromName}</strong> found your profile on Squadra and wants to connect and build together.
            </p>
            <a href="https://squadra-ruby.vercel.app" 
               style="display: inline-block; background: #d4f53c; color: #0a0a0a; font-family: monospace; font-weight: 700; font-size: 12px; letter-spacing: 0.04em; padding: 10px 20px; border-radius: 4px; text-decoration: none;">
              VIEW ON SQUADRA →
            </a>
            <p style="color: #3a3835; font-size: 11px; margin-top: 32px;">
              You're receiving this because you have a profile on Squadra.
            </p>
          </div>
        `,
      }),
    });
  } catch (e) {
    console.error('Email failed:', e.message);
  }
}

module.exports = async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const user = await verifyToken(getToken(req));
  if (!user) return err(res, 'Unauthorised', 401);

  const db = getDB();

  // ── GET my invites ────────────────────────────────────
  if (req.method === 'GET') {
    const result = await db.execute({
      sql:  'SELECT to_profile_id FROM invites WHERE from_user_id = ?',
      args: [user.sub],
    });
    return ok(res, { invites: result.rows.map(r => r.to_profile_id) });
  }

  // ── POST send invite ──────────────────────────────────
  if (req.method === 'POST') {
    const { toProfileId } = req.body || {};
    if (!toProfileId) return err(res, 'toProfileId is required');

    try {
      await db.execute({
        sql:  'INSERT INTO invites (id, from_user_id, to_profile_id) VALUES (?, ?, ?)',
        args: [randomUUID(), user.sub, toProfileId],
      });

      // Get names + email for notification
      const [fromProfile, toProfile] = await Promise.all([
        db.execute({ sql: 'SELECT name FROM profiles WHERE user_id = ?', args: [user.sub] }),
        db.execute({ sql: 'SELECT p.name, u.email FROM profiles p JOIN users u ON u.id = p.user_id WHERE p.id = ?', args: [toProfileId] }),
      ]);

      const fromName = fromProfile.rows[0]?.name || 'A builder';
      const toName   = toProfile.rows[0]?.name   || 'there';
      const toEmail  = toProfile.rows[0]?.email;

      if (toEmail) await sendInviteEmail(toEmail, fromName, toName);

      return ok(res, { message: 'Invite sent' }, 201);
    } catch (e) {
      if (e.message.includes('UNIQUE')) return err(res, 'Already invited');
      return err(res, e.message, 500);
    }
  }

  return err(res, 'Method not allowed', 405);
};