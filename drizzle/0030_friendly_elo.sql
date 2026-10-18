-- Friendlies count for Elo (at half weight) from this moment on. Earlier friendlies stay out of the table.
CREATE TABLE friendly_elo_start (
  id INTEGER PRIMARY KEY NOT NULL CHECK(id = 1),
  started_at TEXT NOT NULL
);
INSERT INTO friendly_elo_start(id, started_at) VALUES (1, strftime('%Y-%m-%dT%H:%M:%fZ','now'));
