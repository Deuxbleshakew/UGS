CREATE TABLE matchweek_control (
 tournament_id TEXT PRIMARY KEY NOT NULL REFERENCES tournaments(id),
 current_week INTEGER NOT NULL CHECK(current_week >= 1),
 version INTEGER NOT NULL DEFAULT 1,
 updated_at TEXT NOT NULL
);
-- Freeze the reviewed league calendar once sequential play is enabled.
CREATE TRIGGER matchweek_calendar_insert BEFORE INSERT ON fixtures
WHEN NEW.kind='club' AND NEW.stage='league' AND EXISTS(SELECT 1 FROM matchweek_control WHERE tournament_id=NEW.tournament_id)
BEGIN SELECT RAISE(ABORT,'Matchweek calendar is locked; new league fixtures cannot be added.'); END;
CREATE TRIGGER matchweek_calendar_update BEFORE UPDATE OF matchday,stage,kind,tournament_id ON fixtures
WHEN (OLD.matchday<>NEW.matchday OR OLD.stage<>NEW.stage OR OLD.kind<>NEW.kind OR OLD.tournament_id<>NEW.tournament_id)
AND ((OLD.kind='club' AND OLD.stage='league' AND EXISTS(SELECT 1 FROM matchweek_control WHERE tournament_id=OLD.tournament_id))
OR (NEW.kind='club' AND NEW.stage='league' AND EXISTS(SELECT 1 FROM matchweek_control WHERE tournament_id=NEW.tournament_id)))
BEGIN SELECT RAISE(ABORT,'Matchweek calendar is locked; week assignments cannot be changed.'); END;
CREATE TRIGGER matchweek_calendar_delete BEFORE DELETE ON fixtures
WHEN OLD.kind='club' AND OLD.stage='league' AND EXISTS(SELECT 1 FROM matchweek_control WHERE tournament_id=OLD.tournament_id)
BEGIN SELECT RAISE(ABORT,'Matchweek calendar is locked; league fixtures cannot be deleted.'); END;
CREATE TRIGGER matchweek_future_result BEFORE UPDATE OF status,report ON fixtures
WHEN NEW.kind='club' AND NEW.stage='league' AND EXISTS(SELECT 1 FROM matchweek_control WHERE tournament_id=NEW.tournament_id AND current_week<NEW.matchday)
BEGIN SELECT RAISE(ABORT,'Matchweek is not open for results.'); END;
CREATE TRIGGER matchweek_future_proof BEFORE INSERT ON proofs
WHEN EXISTS(SELECT 1 FROM fixtures f JOIN matchweek_control w ON w.tournament_id=f.tournament_id WHERE f.id=NEW.fixture_id AND f.kind='club' AND f.stage='league' AND f.matchday>w.current_week)
BEGIN SELECT RAISE(ABORT,'Matchweek is not open for proof uploads.'); END;
