// api/invites.js (CommonJS)

const { getDB, verifyToken, getToken, cors, ok, err } = require('./_lib');
const { randomUUID } = require('crypto');

module.exports = async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const user = await verifyToken(getToken(req));
  if (!user) return err(res, 'Unauthorised', 401);

  const db = getDB();

  if (req.method === 'GET') {
    const result = await db.execute({
      sql: 'SELECT to_profile_id FROM invites WHERE from_user_id = ?', args: [user.sub],
    });
    return ok(res, { invites: result.rows.map(r => r.to_profile_id) });
  }

  if (req.method === 'POST') {
    const { toProfileId } = req.body || {};
    if (!toProfileId) return err(res, 'toProfileId is required');

    try {
      await db.execute({
        sql: 'INSERT INTO invites (id, from_user_id, to_profile_id) VALUES (?, ?, ?)',
        args: [randomUUID(), user.sub, toProfileId],
      });
      return ok(res, { message: 'Invite sent' }, 201);
    } catch (e) {
      if (e.message.includes('UNIQUE')) return err(res, 'Already invited');
      return err(res, e.message, 500);
    }
  }

  return err(res, 'Method not allowed', 405);
};