// api/teams.js (CommonJS)
// GET /api/teams — list my teams with partner info

const { getDB, verifyToken, getToken, cors, ok, err } = require('./_lib');

module.exports = async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return err(res, 'Method not allowed', 405);

  const user = await verifyToken(getToken(req));
  if (!user) return err(res, 'Unauthorised', 401);

  const db = getDB();

  const result = await db.execute({
    sql: `SELECT t.id as team_id, t.created_at,
                 p.id as partner_profile_id,
                 p.name as partner_name,
                 p.role as partner_role,
                 p.user_id as partner_user_id,
                 (SELECT COUNT(*) FROM messages m WHERE m.team_id = t.id AND m.from_user_id != ? AND m.read = 0) as unread
          FROM teams t
          JOIN profiles p ON p.user_id = CASE
            WHEN t.user1_id = ? THEN t.user2_id
            ELSE t.user1_id
          END
          WHERE t.user1_id = ? OR t.user2_id = ?
          ORDER BY t.created_at DESC`,
    args: [user.sub, user.sub, user.sub, user.sub],
  });

  return ok(res, { teams: result.rows });
};