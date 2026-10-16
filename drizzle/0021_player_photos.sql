-- Photos for community players, uploaded by the tournament organizer/admin.
CREATE TABLE player_photos (
  player_id TEXT PRIMARY KEY NOT NULL REFERENCES community_players(id),
  mime TEXT NOT NULL,
  data BLOB NOT NULL,
  width INTEGER NOT NULL,
  height INTEGER NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL
);
