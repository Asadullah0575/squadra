// api/init.js — creates tables in Turso (call once via GET /api/init)

import { getDB, cors, ok, err } from './_lib.js';

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  // simple one-time password — change this after running
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

      CREATE INDEX IF NOT EXISTS idx_profiles_track    ON profiles(track);
      CREATE INDEX IF NOT EXISTS idx_profiles_timezone ON profiles(timezone);
      CREATE INDEX IF NOT EXISTS idx_profiles_created  ON profiles(created_at DESC);
    `);

    ok(res, { message: 'Tables created successfully' });
  } catch (e) {
    err(res, e.message, 500);
  }
}