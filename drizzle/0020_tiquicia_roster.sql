-- RB Tiquicia (the community Pro Clubs team) roster. Organizer-managed, readable by every signed-in member.
CREATE TABLE tiquicia_players (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL CHECK(length(trim(name)) BETWEEN 1 AND 60),
  position TEXT NOT NULL CHECK(position IN ('GK','CB','LB','RB','CDM','CM','CAM','LM','RM','LW','RW','ST')),
  gamertag TEXT NOT NULL DEFAULT '' CHECK(length(gamertag) <= 40),
  shirt_number INTEGER CHECK(shirt_number IS NULL OR shirt_number BETWEEN 1 AND 99),
  created_by TEXT NOT NULL REFERENCES accounts(id),
  created_at TEXT NOT NULL
);
CREATE UNIQUE INDEX tiquicia_player_name ON tiquicia_players(lower(name));
CREATE UNIQUE INDEX tiquicia_player_number ON tiquicia_players(shirt_number) WHERE shirt_number IS NOT NULL;
