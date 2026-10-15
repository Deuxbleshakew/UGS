-- Squad builder: each account keeps up to five tactics per tournament (slot 0 = starting tactic, 1-4 = squad tactics).
-- The server only accepts writes after the draw has assigned managers to clubs; this table only stores the result.
CREATE TABLE squads (
  id TEXT PRIMARY KEY NOT NULL,
  tournament_id TEXT NOT NULL REFERENCES tournaments(id),
  owner_id TEXT NOT NULL REFERENCES accounts(id),
  slot_no INTEGER NOT NULL CHECK(slot_no BETWEEN 0 AND 4),
  name TEXT NOT NULL CHECK(length(trim(name)) BETWEEN 1 AND 40),
  formation TEXT NOT NULL,
  build_up TEXT NOT NULL CHECK(build_up IN ('Balanced','Counter','Short Passing')),
  line_height INTEGER NOT NULL CHECK(line_height BETWEEN 1 AND 100),
  slots TEXT NOT NULL,
  ea_code TEXT CHECK(ea_code IS NULL OR length(ea_code) = 12),
  version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE UNIQUE INDEX squad_slot ON squads(tournament_id, owner_id, slot_no);
