// api/init.js (CommonJS)

const { getDB, cors, ok, err } = require('./_lib');

module.exports = async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.query.secret !== 'squadra-init-2026') {
    return err(res, 'Forbidden', 403);
  }

  const db = getDB();

  try {
    await db.executeMultiple(`
      CREATE TABLE IF NOT EXISTS users (
        id         TEXT PRIMARY KEY,
        email      TEXT UNIQUE NOT NULL,
        password   TEXT NOT NULL,
        created_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS profiles (
        id          TEXT PRIMARY KEY,
        user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name        TEXT NOT NULL,
        role        TEXT NOT NULL,
        track       TEXT NOT NULL,
        timezone    TEXT NOT NULL,
        bio         TEXT NOT NULL,
        country     TEXT DEFAULT '??',
        skills      TEXT DEFAULT '[]',
        looking_for TEXT DEFAULT '[]',
        is_active   INTEGER DEFAULT 1,
        created_at  TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS invites (
        id            TEXT PRIMARY KEY,
        from_user_id  TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        to_profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
        created_at    TEXT DEFAULT (datetime('now')),
        UNIQUE(from_user_id, to_profile_id)
      );

      CREATE TABLE IF NOT EXISTS messages (
        id           TEXT PRIMARY KEY,
        from_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        to_user_id   TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        body         TEXT NOT NULL,
        read         INTEGER DEFAULT 0,
        created_at   TEXT DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_profiles_track    ON profiles(track);
      CREATE INDEX IF NOT EXISTS idx_profiles_timezone ON profiles(timezone);
      CREATE INDEX IF NOT EXISTS idx_profiles_created  ON profiles(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_messages_thread   ON messages(from_user_id, to_user_id);
      CREATE INDEX IF NOT EXISTS idx_messages_created  ON messages(created_at ASC);
    `);

    ok(res, { message: 'Tables created successfully' });
  } catch (e) {
    err(res, e.message, 500);
  }
};