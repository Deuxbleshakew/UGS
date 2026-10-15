-- Community team vote + simulated home-and-away playoff. No players take part and nothing here touches Elo,
-- fixtures or standings. The vote order is stored exactly as the owner enters it (it is the final, agreed ranking).
CREATE TABLE team_playoffs (
  id TEXT PRIMARY KEY NOT NULL,
  tournament_id TEXT NOT NULL REFERENCES tournaments(id),
  name TEXT NOT NULL CHECK(length(trim(name)) BETWEEN 1 AND 100),
  direct_count INTEGER NOT NULL CHECK(direct_count BETWEEN 0 AND 62),
  seed TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('ready','simulated','cancelled')),
  version INTEGER NOT NULL DEFAULT 1,
  created_by TEXT NOT NULL REFERENCES accounts(id),
  created_at TEXT NOT NULL,
  simulated_at TEXT,
  cancelled_at TEXT,
  cancelled_by TEXT REFERENCES accounts(id),
  cancel_reason TEXT,
  CHECK(status <> 'cancelled' OR (cancelled_at IS NOT NULL AND length(trim(coalesce(cancel_reason,''))) >= 3)),
  CHECK(status <> 'simulated' OR simulated_at IS NOT NULL)
);
-- At most one live (ready or simulated) team playoff per tournament.
CREATE UNIQUE INDEX team_playoff_live ON team_playoffs(tournament_id) WHERE status IN ('ready','simulated');

CREATE TABLE team_playoff_entries (
  playoff_id TEXT NOT NULL REFERENCES team_playoffs(id),
  rank INTEGER NOT NULL CHECK(rank >= 1),
  team TEXT NOT NULL CHECK(length(trim(team)) BETWEEN 1 AND 80),
  votes INTEGER NOT NULL CHECK(votes >= 0),
  strength REAL NOT NULL CHECK(strength > 0),
  PRIMARY KEY(playoff_id, rank)
);
CREATE UNIQUE INDEX team_playoff_entry_team ON team_playoff_entries(playoff_id, lower(team));

-- high_rank is the better-voted team (plays the second leg at home); low_rank hosts the first leg.
CREATE TABLE team_playoff_ties (
  id TEXT PRIMARY KEY NOT NULL,
  playoff_id TEXT NOT NULL REFERENCES team_playoffs(id),
  position INTEGER NOT NULL CHECK(position >= 1),
  high_rank INTEGER NOT NULL,
  low_rank INTEGER NOT NULL,
  l1_low INTEGER, l1_high INTEGER, l2_low INTEGER, l2_high INTEGER,
  pens_low INTEGER, pens_high INTEGER,
  winner_rank INTEGER,
  CHECK(high_rank < low_rank),
  CHECK(winner_rank IS NULL OR winner_rank IN (high_rank, low_rank))
);
CREATE UNIQUE INDEX team_playoff_tie_position ON team_playoff_ties(playoff_id, position);
-- Once simulated, results are never edited in place; cancel the playoff and make a new one instead.
CREATE TRIGGER team_playoff_ties_locked BEFORE UPDATE ON team_playoff_ties
WHEN OLD.winner_rank IS NOT NULL
BEGIN SELECT RAISE(ABORT,'A simulated tie cannot be changed. Cancel the playoff and create a new one.'); END;
