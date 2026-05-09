// api/setup-admin.js — one-time admin setup
// GET /api/setup-admin?secret=squadra-init-2026&email=YOUR_EMAIL

const { getDB, cors, ok, err } = require('./_lib');

module.exports = async function handler(req, res) {
  cors(res);
  if (req.query.secret !== 'squadra-init-2026') return err(res, 'Forbidden', 403);

  const email = req.query.email;
  if (!email) return err(res, 'email required');

  const db = getDB();

  try {
    // Add columns if missing
    try { await db.execute('ALTER TABLE users ADD COLUMN is_admin INTEGER DEFAULT 0'); } catch(e) {}
    try { await db.execute('ALTER TABLE users ADD COLUMN is_banned INTEGER DEFAULT 0'); } catch(e) {}

    // Set admin
    const result = await db.execute({
      sql: 'UPDATE users SET is_admin = 1 WHERE email = ?',
      args: [email.toLowerCase()],
    });

    // Verify
    const check = await db.execute({
      sql: 'SELECT id, email, is_admin FROM users WHERE email = ?',
      args: [email.toLowerCase()],
    });

    if (!check.rows.length) return err(res, 'User not found with that email');

    return ok(res, {
      message: 'Admin granted!',
      user: check.rows[0],
      rowsAffected: result.rowsAffected,
    });
  } catch(e) {
    return err(res, e.message, 500);
  }
};