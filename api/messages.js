// api/messages.js (CommonJS)
// GET  /api/messages?withUserId=...&after=...  — fetch thread
// POST /api/messages                           — send message
// PUT  /api/messages?withUserId=...            — mark thread as read

const { getDB, verifyToken, getToken, cors, ok, err } = require('./_lib');
const { randomUUID } = require('crypto');

module.exports = async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const user = await verifyToken(getToken(req));
  if (!user) return err(res, 'Unauthorised', 401);

  const db = getDB();

  // ── GET thread ───────────────────────────────────────
  if (req.method === 'GET') {
    const { withUserId, after } = req.query;
    if (!withUserId) return err(res, 'withUserId is required');

    let sql = `
      SELECT m.*, 
             uf.name as from_name,
             ut.name as to_name
      FROM messages m
      LEFT JOIN profiles uf ON uf.user_id = m.from_user_id
      LEFT JOIN profiles ut ON ut.user_id = m.to_user_id
      WHERE (
        (m.from_user_id = ? AND m.to_user_id = ?) OR
        (m.from_user_id = ? AND m.to_user_id = ?)
      )
    `;
    const args = [user.sub, withUserId, withUserId, user.sub];

    if (after) {
      sql += ' AND m.created_at > ?';
      args.push(after);
    }

    sql += ' ORDER BY m.created_at ASC LIMIT 100';

    const result = await db.execute({ sql, args });
    return ok(res, { messages: result.rows });
  }

  // ── POST send message ────────────────────────────────
  if (req.method === 'POST') {
    const { toUserId, body } = req.body || {};
    if (!toUserId || !body?.trim()) return err(res, 'toUserId and body are required');
    if (body.length > 1000) return err(res, 'Message too long (max 1000 chars)');

    const id = randomUUID();
    await db.execute({
      sql:  'INSERT INTO messages (id, from_user_id, to_user_id, body) VALUES (?, ?, ?, ?)',
      args: [id, user.sub, toUserId, body.trim()],
    });

    const row = await db.execute({ sql: 'SELECT * FROM messages WHERE id = ?', args: [id] });
    return ok(res, { message: row.rows[0] }, 201);
  }

  // ── PUT mark as read ─────────────────────────────────
  if (req.method === 'PUT') {
    const { withUserId } = req.query;
    if (!withUserId) return err(res, 'withUserId is required');

    await db.execute({
      sql:  'UPDATE messages SET read = 1 WHERE to_user_id = ? AND from_user_id = ? AND read = 0',
      args: [user.sub, withUserId],
    });
    return ok(res, { message: 'Marked as read' });
  }

  return err(res, 'Method not allowed', 405);
};