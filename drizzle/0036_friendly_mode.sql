-- Existing friendlies remain club games. Ultimate Team games are explicitly labeled and do not use club-star weighting.
ALTER TABLE friendly_invitations ADD COLUMN mode TEXT NOT NULL DEFAULT 'clubs' CHECK(mode IN ('clubs','ultimate'));
