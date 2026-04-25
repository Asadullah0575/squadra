// api/debug.js (CommonJS)
const { getDB, cors, ok, err } = require('./_lib');

module.exports = async function handler(req, res) {
  cors(res);
  if (req.query.secret !== 'squadra-init-2026') return err(res, 'Forbidden', 403);

  const db = getDB();
  try {
    const tables = await db.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name");
    const results = {};
    for (const row of tables.rows) {
      try {
        const count = await db.execute(`SELECT COUNT(*) as n FROM ${row.name}`);
        results[row.name] = count.rows[0]?.n ?? 0;
      } catch(e) {
        results[row.name] = `error: ${e.message}`;
      }
    }
    return ok(res, { tables: results, url: process.env.TURSO_DATABASE_URL?.replace('https://', 'libsql://') });
  } catch(e) {
    return err(res, e.message, 500);
  }
};