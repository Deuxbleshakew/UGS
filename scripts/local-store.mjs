import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
import { chmodSync, mkdirSync, readFileSync, readdirSync } from 'node:fs';
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
    // Snapshot existing data before the username transition. VACUUM INTO includes
    // committed WAL data; copying the live SQLite file alone would not be safe.
    const ledger = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='app_migrations'").get();
    if (ledger && db.prepare('SELECT name FROM app_migrations WHERE name=?').get('0021_player_photos.sql')
      && !db.prepare('SELECT name FROM app_migrations WHERE name=?').get('0022_confirmed_clubs.sql')) {
      const backups = path.join(dir, 'backups');
      mkdirSync(backups, {recursive:true, mode:0o700});
      const snapshot = path.join(backups, `before-confirmed-clubs-${Date.now()}.sqlite`);
      db.prepare('VACUUM INTO ?').run(snapshot);
      chmodSync(snapshot, 0o600);
      console.log('Created pre-confirmed-clubs migration database backup.');
    }
    if (ledger && db.prepare('SELECT name FROM app_migrations WHERE name=?').get('0019_club_stars.sql')
      && !db.prepare('SELECT name FROM app_migrations WHERE name=?').get('0021_player_photos.sql')) {
      const backups = path.join(dir, 'backups');
      mkdirSync(backups, {recursive:true, mode:0o700});
      const snapshot = path.join(backups, `before-tiquicia-player-photos-${Date.now()}.sqlite`);
      db.prepare('VACUUM INTO ?').run(snapshot);
      chmodSync(snapshot, 0o600);
      console.log('Created pre-tiquicia/player-photos migration database backup.');
    }
    if (ledger && db.prepare('SELECT name FROM app_migrations WHERE name=?').get('0017_squads.sql')
      && !db.prepare('SELECT name FROM app_migrations WHERE name=?').get('0019_club_stars.sql')) {
      const backups = path.join(dir, 'backups');
      mkdirSync(backups, {recursive:true, mode:0o700});
      const snapshot = path.join(backups, `before-squad-access-club-stars-${Date.now()}.sqlite`);
      db.prepare('VACUUM INTO ?').run(snapshot);
      chmodSync(snapshot, 0o600);
      console.log('Created pre-squad-access/club-stars migration database backup.');
    }
    if (ledger && db.prepare('SELECT name FROM app_migrations WHERE name=?').get('0014_user_management.sql')
      && !db.prepare('SELECT name FROM app_migrations WHERE name=?').get('0017_squads.sql')) {
      const backups = path.join(dir, 'backups');
      mkdirSync(backups, {recursive:true, mode:0o700});
      const snapshot = path.join(backups, `before-participation-playoffs-squads-${Date.now()}.sqlite`);
      db.prepare('VACUUM INTO ?').run(snapshot);
      chmodSync(snapshot, 0o600);
      console.log('Created pre-participation/playoffs/squads migration database backup.');
    }
    if (ledger && db.prepare('SELECT name FROM app_migrations WHERE name=?').get('0011_match_scheduling.sql')
      && !db.prepare('SELECT name FROM app_migrations WHERE name=?').get('0014_user_management.sql')) {
      const backups = path.join(dir, 'backups');
      mkdirSync(backups, {recursive:true, mode:0o700});
      const snapshot = path.join(backups, `before-friendlies-avatars-user-management-${Date.now()}.sqlite`);
      db.prepare('VACUUM INTO ?').run(snapshot);
      chmodSync(snapshot, 0o600);
      console.log('Created pre-friendlies/avatars/user-management migration database backup.');
    }
    if (ledger && db.prepare('SELECT name FROM app_migrations WHERE name=?').get('0007_username_access.sql')
      && !db.prepare('SELECT name FROM app_migrations WHERE name=?').get('0011_match_scheduling.sql')) {
      const backups = path.join(dir, 'backups');
      mkdirSync(backups, {recursive:true, mode:0o700});
      const snapshot = path.join(backups, `before-profiles-discord-scheduling-${Date.now()}.sqlite`);
      db.prepare('VACUUM INTO ?').run(snapshot);
      chmodSync(snapshot, 0o600);
      console.log('Created pre-profiles/Discord/scheduling migration database backup.');
    }
    if (ledger && !db.prepare('SELECT name FROM app_migrations WHERE name=?').get('0007_username_access.sql')
      && db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='accounts'").get()) {
      const backups = path.join(dir, 'backups');
      mkdirSync(backups, {recursive:true, mode:0o700});
      const snapshot = path.join(backups, `before-username-access-${Date.now()}.sqlite`);
      db.prepare('VACUUM INTO ?').run(snapshot);
      chmodSync(snapshot, 0o600);
      console.log('Created pre-username migration database backup.');
    }
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
    for (const table of ['club_roster_corrections', 'saved_playoff_corrections']) {
      const outcomes = db.prepare('SELECT outcome, count(*) AS count FROM ' + table + ' GROUP BY outcome').all();
      console.log(table + ': ' + JSON.stringify(outcomes));
    }
  } catch (error) {
    if (db.isTransaction) db.exec('ROLLBACK');
    db.close();
    throw error;
  }
  globalThis[key] = db;
  return db;
}
