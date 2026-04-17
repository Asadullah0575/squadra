// api/auth.js (CommonJS)

const { getDB, signToken, hashPassword, comparePassword, cors, ok, err } = require('./_lib');
const { randomUUID } = require('crypto');

module.exports = async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return err(res, 'Method not allowed', 405);

  const { action } = req.query;
  const { email, password } = req.body || {};

  if (!email || !password) return err(res, 'Email and password are required');

  const db = getDB();

  if (action === 'signup') {
    const existing = await db.execute({
      sql:  'SELECT id FROM users WHERE email = ?',
      args: [email.toLowerCase()],
    });
    if (existing.rows.length) return err(res, 'Email already in use');

    const id   = randomUUID();
    const hash = await hashPassword(password);

    await db.execute({
      sql:  'INSERT INTO users (id, email, password) VALUES (?, ?, ?)',
      args: [id, email.toLowerCase(), hash],
    });

    const token = await signToken({ sub: id, email: email.toLowerCase() });
    return ok(res, { token, user: { id, email: email.toLowerCase() } }, 201);
  }

  if (action === 'signin') {
    const result = await db.execute({
      sql:  'SELECT id, email, password FROM users WHERE email = ?',
      args: [email.toLowerCase()],
    });
    if (!result.rows.length) return err(res, 'Invalid email or password', 401);

    const user  = result.rows[0];
    const match = await comparePassword(password, user.password);
    if (!match) return err(res, 'Invalid email or password', 401);

    const token = await signToken({ sub: user.id, email: user.email });
    return ok(res, { token, user: { id: user.id, email: user.email } });
  }

  return err(res, 'Unknown action');
};