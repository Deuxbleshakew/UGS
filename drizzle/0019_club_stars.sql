-- Star rating (0.5-5, half steps) of each club, set by the organizer. Used to weigh Elo changes by the strength of the club a player used.
-- A club with no row counts as neutral, so Elo is unchanged until stars are entered.
CREATE TABLE club_stars (
  tournament_id TEXT NOT NULL REFERENCES tournaments(id),
  club_id TEXT NOT NULL,
  stars REAL NOT NULL CHECK(stars >= 0.5 AND stars <= 5 AND stars * 2 = CAST(stars * 2 AS INTEGER)),
  updated_by TEXT NOT NULL REFERENCES accounts(id),
  updated_at TEXT NOT NULL,
  PRIMARY KEY(tournament_id, club_id)
);
