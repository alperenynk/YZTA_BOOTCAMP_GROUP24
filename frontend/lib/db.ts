import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

const DB_PATH =
  process.env.DATABASE_PATH || path.join(process.cwd(), "data", "lokal.db");

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (db) return db;

  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE,
      auth_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS queries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      raw_text TEXT NOT NULL,
      parsed_location TEXT,
      parsed_mood TEXT,
      parsed_companion TEXT,
      parsed_time TEXT,
      parsed_budget TEXT,
      target_date TEXT,
      parsed_json TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS suggestions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      query_id INTEGER NOT NULL REFERENCES queries(id),
      layer TEXT NOT NULL CHECK (layer IN ('ticketed','free','venue','experience')),
      title TEXT NOT NULL,
      meta TEXT,
      reason_text TEXT,
      source_url TEXT,
      steps_json TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS feedback (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      suggestion_id INTEGER NOT NULL REFERENCES suggestions(id),
      user_id INTEGER NOT NULL REFERENCES users(id),
      went INTEGER NOT NULL DEFAULT 1,
      liked INTEGER,
      note TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS profile_summaries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      summary_text TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Topluluk akışı: paylaşılan anılar (metin + görsel + gidilen etkinlik)
    CREATE TABLE IF NOT EXISTS posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      suggestion_id INTEGER REFERENCES suggestions(id),
      content TEXT,
      image_path TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS post_likes (
      post_id INTEGER NOT NULL REFERENCES posts(id),
      user_id INTEGER NOT NULL REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (post_id, user_id)
    );

    -- Faz 2: grup özelliği için şimdiden yer açıldı
    CREATE TABLE IF NOT EXISTS groups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      created_by INTEGER NOT NULL REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS group_members (
      group_id INTEGER NOT NULL REFERENCES groups(id),
      user_id INTEGER NOT NULL REFERENCES users(id),
      PRIMARY KEY (group_id, user_id)
    );
  `);

  // Hafif migration'lar: eski veritabanlarına yeni kolonları ekle
  const queryCols = db
    .prepare("PRAGMA table_info(queries)")
    .all() as { name: string }[];
  if (!queryCols.some((c) => c.name === "target_date")) {
    db.exec("ALTER TABLE queries ADD COLUMN target_date TEXT");
  }
  const userCols = db
    .prepare("PRAGMA table_info(users)")
    .all() as { name: string }[];
  if (!userCols.some((c) => c.name === "auth_id")) {
    db.exec("ALTER TABLE users ADD COLUMN auth_id TEXT");
  }
  const postCols = db
    .prepare("PRAGMA table_info(posts)")
    .all() as { name: string }[];
  if (!postCols.some((c) => c.name === "image_path")) {
    db.exec("ALTER TABLE posts ADD COLUMN image_path TEXT");
  }
  // Profil alanları: fotoğraf, doğum tarihi, semt
  for (const col of ["avatar_path", "birth_date", "home_district"]) {
    if (!userCols.some((c) => c.name === col)) {
      db.exec(`ALTER TABLE users ADD COLUMN ${col} TEXT`);
    }
  }
  db.exec(
    "CREATE UNIQUE INDEX IF NOT EXISTS idx_users_auth_id ON users(auth_id) WHERE auth_id IS NOT NULL"
  );

  return db;
}
