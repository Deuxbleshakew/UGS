-- Only an explicit owner deletion may clear append-only scheduling history.
CREATE TABLE tournament_deletion_context (
  tournament_id TEXT PRIMARY KEY NOT NULL
);
DROP TRIGGER schedule_events_no_delete;
CREATE TRIGGER schedule_events_no_delete BEFORE DELETE ON schedule_events
WHEN NOT EXISTS (SELECT 1 FROM tournament_deletion_context WHERE tournament_id=OLD.tournament_id)
BEGIN SELECT RAISE(ABORT,'Scheduling history is append-only.'); END;
CREATE TABLE tournament_deletion_audit (
  id TEXT PRIMARY KEY NOT NULL,
  owner_id TEXT NOT NULL REFERENCES accounts(id),
  tournament_id TEXT NOT NULL,
  tournament_name TEXT NOT NULL,
  deleted_at TEXT NOT NULL,
  fixture_count INTEGER NOT NULL,
  player_playoff_count INTEGER NOT NULL,
  team_playoff_count INTEGER NOT NULL
);
