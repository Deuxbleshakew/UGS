-- Organizer switch to open the squad builder before the draw. The default (no row) keeps it locked until managers are drawn.
CREATE TABLE squad_access (
  tournament_id TEXT PRIMARY KEY NOT NULL REFERENCES tournaments(id),
  open INTEGER NOT NULL CHECK(open IN (0,1)),
  updated_by TEXT NOT NULL REFERENCES accounts(id),
  updated_at TEXT NOT NULL
);
