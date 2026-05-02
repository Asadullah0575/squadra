// api/groups.js (CommonJS)
// GET    /api/groups              — my groups
// POST   /api/groups              — create group
// GET    /api/groups?id=&msgs=1   — get group messages
// POST   /api/groups?id=&msg=1    — send group message
// POST   /api/groups?id=&add=1    — add member to group
// DELETE /api/groups?id=          — leave/delete group

const { getDB, verifyToken, getToken, cors, ok, err } = require('./_lib');
const { randomUUID } = require('crypto');

module.exports = async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const user = await verifyToken(getToken(req));
  if (!user) return err(res, 'Unauthorised', 401);

  const db = getDB();
  const { id, msgs, msg, add } = req.query;

  // ── GET my groups ────────────────────────────────────
  if (req.method === 'GET' && !id) {
    try {
      const result = await db.execute({
        sql: `SELECT g.id, g.name, g.created_by, g.created_at,
                     (SELECT COUNT(*) FROM group_members gm WHERE gm.group_id = g.id) as member_count,
                     (SELECT body FROM group_messages gm2 WHERE gm2.group_id = g.id ORDER BY gm2.created_at DESC LIMIT 1) as last_message,
                     (SELECT p.name FROM profiles p WHERE p.user_id = g.created_by) as creator_name
              FROM groups g
              JOIN group_members m ON m.group_id = g.id
              WHERE m.user_id = ?
              ORDER BY g.created_at DESC`,
        args: [user.sub],
      });
      return ok(res, { groups: result.rows });
    } catch(e) { return err(res, e.message, 500); }
  }

  // ── GET group messages ───────────────────────────────
  if (req.method === 'GET' && id && msgs) {
    const { after } = req.query;
    // verify membership
    const member = await db.execute({
      sql: 'SELECT id FROM group_members WHERE group_id = ? AND user_id = ?',
      args: [id, user.sub],
    });
    if (!member.rows.length) return err(res, 'Not a group member', 403);

    let sql = `SELECT gm.*, p.name as from_name, p.avatar_url as from_avatar
               FROM group_messages gm
               LEFT JOIN profiles p ON p.user_id = gm.from_user_id
               WHERE gm.group_id = ?`;
    const args = [id];
    if (after) { sql += ' AND gm.created_at > ?'; args.push(after); }
    sql += ' ORDER BY gm.created_at ASC LIMIT 100';

    const result = await db.execute({ sql, args });

    // also get members list
    const members = await db.execute({
      sql: `SELECT u.id, p.name, p.avatar_url, p.role
            FROM group_members gm
            JOIN users u ON u.id = gm.user_id
            LEFT JOIN profiles p ON p.user_id = gm.user_id
            WHERE gm.group_id = ?`,
      args: [id],
    });

    return ok(res, { messages: result.rows, members: members.rows });
  }

  // ── POST create group ────────────────────────────────
  if (req.method === 'POST' && !id) {
    const { name, memberUserIds } = req.body || {};
    if (!name?.trim()) return err(res, 'Group name required');

    // verify user has at least one team (must be a team member to create groups)
    const teamCheck = await db.execute({
      sql: 'SELECT id FROM teams WHERE user1_id = ? OR user2_id = ? LIMIT 1',
      args: [user.sub, user.sub],
    });
    if (!teamCheck.rows.length) return err(res, 'You must form a team before creating groups');

    const groupId = randomUUID();
    const now = new Date().toISOString().replace('T',' ').replace('Z','');

    await db.execute({
      sql: 'INSERT INTO groups (id, name, created_by, created_at) VALUES (?, ?, ?, ?)',
      args: [groupId, name.trim(), user.sub, now],
    });

    // add creator as first member
    await db.execute({
      sql: 'INSERT INTO group_members (id, group_id, user_id) VALUES (?, ?, ?)',
      args: [randomUUID(), groupId, user.sub],
    });

    // add other members (must be from existing teams)
    if (Array.isArray(memberUserIds)) {
      for (const uid of memberUserIds) {
        // verify they share a team with creator
        const shared = await db.execute({
          sql: `SELECT id FROM teams WHERE
                (user1_id = ? AND user2_id = ?) OR
                (user1_id = ? AND user2_id = ?)`,
          args: [user.sub, uid, uid, user.sub],
        });
        if (shared.rows.length) {
          try {
            await db.execute({
              sql: 'INSERT INTO group_members (id, group_id, user_id) VALUES (?, ?, ?)',
              args: [randomUUID(), groupId, uid],
            });
          } catch(e) {} // ignore duplicate
        }
      }
    }

    const group = await db.execute({ sql: 'SELECT * FROM groups WHERE id = ?', args: [groupId] });
    return ok(res, { group: group.rows[0] }, 201);
  }

  // ── POST send group message ──────────────────────────
  if (req.method === 'POST' && id && msg) {
    const { body } = req.body || {};
    if (!body?.trim()) return err(res, 'Message body required');
    if (body.length > 2000) return err(res, 'Message too long');

    const member = await db.execute({
      sql: 'SELECT id FROM group_members WHERE group_id = ? AND user_id = ?',
      args: [id, user.sub],
    });
    if (!member.rows.length) return err(res, 'Not a group member', 403);

    const msgId = randomUUID();
    const now = new Date().toISOString().replace('T',' ').replace('Z','');
    await db.execute({
      sql: 'INSERT INTO group_messages (id, group_id, from_user_id, body, created_at) VALUES (?, ?, ?, ?, ?)',
      args: [msgId, id, user.sub, body.trim(), now],
    });

    const row = await db.execute({
      sql: `SELECT gm.*, p.name as from_name, p.avatar_url as from_avatar
            FROM group_messages gm
            LEFT JOIN profiles p ON p.user_id = gm.from_user_id
            WHERE gm.id = ?`,
      args: [msgId],
    });
    return ok(res, { message: row.rows[0] }, 201);
  }

  // ── POST add member ──────────────────────────────────
  if (req.method === 'POST' && id && add) {
    const { userIdToAdd } = req.body || {};
    if (!userIdToAdd) return err(res, 'userIdToAdd required');

    // verify requester is in the group
    const inGroup = await db.execute({
      sql: 'SELECT id FROM group_members WHERE group_id = ? AND user_id = ?',
      args: [id, user.sub],
    });
    if (!inGroup.rows.length) return err(res, 'Not a group member', 403);

    // verify they share a team
    const shared = await db.execute({
      sql: `SELECT id FROM teams WHERE
            (user1_id = ? AND user2_id = ?) OR
            (user1_id = ? AND user2_id = ?)`,
      args: [user.sub, userIdToAdd, userIdToAdd, user.sub],
    });
    if (!shared.rows.length) return err(res, 'Can only add team members');

    try {
      await db.execute({
        sql: 'INSERT INTO group_members (id, group_id, user_id) VALUES (?, ?, ?)',
        args: [randomUUID(), id, userIdToAdd],
      });
      return ok(res, { message: 'Member added' });
    } catch(e) {
      if (e.message.includes('UNIQUE')) return err(res, 'Already a member');
      return err(res, e.message, 500);
    }
  }

  // ── DELETE leave group ───────────────────────────────
  if (req.method === 'DELETE' && id) {
    await db.execute({
      sql: 'DELETE FROM group_members WHERE group_id = ? AND user_id = ?',
      args: [id, user.sub],
    });
    // if creator and no members left, delete group
    const remaining = await db.execute({
      sql: 'SELECT COUNT(*) as n FROM group_members WHERE group_id = ?',
      args: [id],
    });
    if (remaining.rows[0]?.n === 0) {
      await db.execute({ sql: 'DELETE FROM groups WHERE id = ?', args: [id] });
    }
    return ok(res, { message: 'Left group' });
  }

  return err(res, 'Method not allowed', 405);
};