ALTER TABLE community_players ADD COLUMN in_tournament INTEGER NOT NULL DEFAULT 1 CHECK(in_tournament IN (0,1));
