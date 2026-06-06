// api/notifications.js (CommonJS)
// GET  /api/notifications        — get my notifications
// PUT  /api/notifications?id=    — mark one as read
// PUT  /api/notifications?all=1  — mark all as read

const { getDB, verifyToken, getToken, cors, ok, err } = require('./_lib');

module.exports = async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const user = await verifyToken(getToken(req));
  if (!user) return err(res, 'Unauthorised', 401);

  const db = getDB();

  // ── GET notifications ────────────────────────────────
  if (req.method === 'GET') {
    try {
      const result = await db.execute({
        sql: `SELECT * FROM notifications
              WHERE user_id = ?
              ORDER BY created_at DESC
              LIMIT 30`,
        args: [user.sub],
      });
      const unread = result.rows.filter(n => !n.read).length;
      return ok(res, { notifications: result.rows, unread });
    } catch(e) {
      return ok(res, { notifications: [], unread: 0 });
    }
  }

  // ── PUT mark read ────────────────────────────────────
  if (req.method === 'PUT') {
    if (req.query.all) {
      await db.execute({
        sql: 'UPDATE notifications SET read = 1 WHERE user_id = ?',
        args: [user.sub],
      });
    } else if (req.query.id) {
      await db.execute({
        sql: 'UPDATE notifications SET read = 1 WHERE id = ? AND user_id = ?',
        args: [req.query.id, user.sub],
      });
    }
    return ok(res, { message: 'Marked as read' });
  }

  return err(res, 'Method not allowed', 405);
};