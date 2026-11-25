import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { DB_PATH } from './config.js';

if (DB_PATH !== ':memory:') fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

export const db = new DatabaseSync(DB_PATH);

const NOW = `(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`;

db.exec(`
PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;

CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  email         TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  name          TEXT NOT NULL,
  age           INTEGER,
  gender        TEXT,
  city          TEXT,
  area          TEXT,
  budget_min    INTEGER,
  budget_max    INTEGER,
  move_in       TEXT,
  housing       TEXT,
  gender_pref   TEXT NOT NULL DEFAULT 'any',
  occupation    TEXT,
  bio           TEXT NOT NULL DEFAULT '',
  interests     TEXT NOT NULL DEFAULT '[]',
  answers       TEXT NOT NULL DEFAULT '{}',
  onboarded     INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL DEFAULT ${NOW}
);

CREATE TABLE IF NOT EXISTS swipes (
  from_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  to_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action     TEXT NOT NULL CHECK (action IN ('like', 'pass')),
  created_at TEXT NOT NULL DEFAULT ${NOW},
  PRIMARY KEY (from_id, to_id)
);

CREATE TABLE IF NOT EXISTS matches (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_a     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_b     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT ${NOW},
  UNIQUE (user_a, user_b),
  CHECK (user_a < user_b)
);

CREATE TABLE IF NOT EXISTS messages (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  match_id   INTEGER NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  sender_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body       TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT ${NOW}
);
CREATE INDEX IF NOT EXISTS idx_messages_match ON messages(match_id, id);

-- One living agreement per match. Any edit bumps version and clears both agreements,
-- so the two people always agree to the exact same text.
CREATE TABLE IF NOT EXISTS agreements (
  match_id   INTEGER PRIMARY KEY REFERENCES matches(id) ON DELETE CASCADE,
  clauses    TEXT NOT NULL,
  version    INTEGER NOT NULL DEFAULT 1,
  agreed_a   TEXT,
  agreed_b   TEXT,
  updated_by INTEGER,
  updated_at TEXT NOT NULL DEFAULT ${NOW}
);

CREATE TABLE IF NOT EXISTS blocks (
  blocker_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  blocked_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT ${NOW},
  PRIMARY KEY (blocker_id, blocked_id)
);

CREATE TABLE IF NOT EXISTS photos (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  filename   TEXT NOT NULL UNIQUE,
  position   INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT ${NOW}
);
CREATE INDEX IF NOT EXISTS idx_photos_user ON photos(user_id, position);

-- Pending email verification (one at a time per user). Only an HMAC of the code is stored.
CREATE TABLE IF NOT EXISTS email_verifications (
  user_id    INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  email      TEXT NOT NULL,
  code_hash  TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  sent_at    INTEGER NOT NULL,
  attempts   INTEGER NOT NULL DEFAULT 0
);
`);

/** Add columns to existing databases (CREATE TABLE IF NOT EXISTS won't change an old table). */
function addColumn(table, column, definition) {
  const exists = db.prepare(`PRAGMA table_info(${table})`).all().some((c) => c.name === column);
  if (!exists) db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}
addColumn('users', 'verified_email', 'TEXT');
addColumn('users', 'verified_type', 'TEXT');
addColumn('users', 'verified_org', 'TEXT');
addColumn('users', 'verified_at', 'TEXT');
addColumn('users', 'show_gender', 'INTEGER NOT NULL DEFAULT 1');
db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_users_verified_email ON users(verified_email) WHERE verified_email IS NOT NULL');

/** Run fn inside a transaction; rolls back on error. */
export function transaction(fn) {
  db.exec('BEGIN');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}
