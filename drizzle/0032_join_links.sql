-- One shareable join link per tournament. The organizer can switch it off, replace it, and limit its life and uses.
CREATE TABLE join_links (
  id TEXT PRIMARY KEY NOT NULL,
  tournament_id TEXT NOT NULL,
  token TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1 CHECK(enabled IN (0,1)),
  expires_at INTEGER,
  max_uses INTEGER CHECK(max_uses IS NULL OR max_uses > 0),
  uses INTEGER NOT NULL DEFAULT 0,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE UNIQUE INDEX join_link_token ON join_links(token);
CREATE UNIQUE INDEX join_link_tournament ON join_links(tournament_id);
