import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

export function dataDirectory() {
  const configured = process.env.MATCHROOM_DATA_DIR;
  if (process.env.NODE_ENV === 'production' && (!configured || !path.isAbsolute(configured))) {
    throw new Error('Set MATCHROOM_DATA_DIR to an absolute persistent-disk directory before starting production.');
  }
  return path.resolve(configured || '.data');
}

const key = Symbol.for('matchroom.sqlite');
export function database() {
  if (globalThis[key]) return globalThis[key];
  const dir = dataDirectory();
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(path.join(dir, 'matchroom.sqlite'), { timeout: 5000 });
  db.exec('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;');
  try {
    // The lock covers discovery and application, so simultaneous starts cannot
    // apply one migration twice. Never edit a migration that has been applied.
    db.exec('BEGIN IMMEDIATE');
    db.exec('CREATE TABLE IF NOT EXISTS app_migrations(name TEXT PRIMARY KEY, checksum TEXT NOT NULL, applied_at TEXT NOT NULL)');
    const folder = path.resolve('drizzle');
    for (const file of readdirSync(folder).filter(f => /^\d+_.*\.sql$/.test(f)).sort()) {
      const sql = readFileSync(path.join(folder, file), 'utf8');
      const checksum = createHash('sha256').update(sql).digest('hex');
      const prior = db.prepare('SELECT checksum FROM app_migrations WHERE name=?').get(file);
      if (prior) {
        if (prior.checksum !== checksum) throw new Error(`Applied migration changed: ${file}`);
        continue;
      }
      db.exec(sql);
      db.prepare('INSERT INTO app_migrations VALUES(?,?,?)').run(file, checksum, new Date().toISOString());
    }
    db.exec('COMMIT');
  } catch (error) {
    if (db.isTransaction) db.exec('ROLLBACK');
    db.close();
    throw error;
  }
  globalThis[key] = db;
  return db;
}
