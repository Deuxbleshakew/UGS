-- Match scheduling and rescheduling. fixtures.scheduled stays the single ACCEPTED
-- kickoff (UTC ISO string); everything here is proposals, history and owner policy.
-- Booking duration and season dates are owner configuration. NULL means "not decided"
-- and no default is invented.
CREATE TABLE schedule_settings (
  tournament_id TEXT PRIMARY KEY NOT NULL REFERENCES tournaments(id),
  booking_minutes INTEGER CHECK(booking_minutes IS NULL OR booking_minutes BETWEEN 1 AND 1440),
  season_start TEXT CHECK(season_start IS NULL OR length(season_start)=24),
  season_end TEXT CHECK(season_end IS NULL OR length(season_end)=24),
  version INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL,
  CHECK(season_start IS NULL OR season_end IS NULL OR season_end > season_start)
);

-- Owner-controlled match window/deadline. Distinct from the accepted kickoff.
-- scope week: one row per league matchweek. scope fixture: an override for one fixture.
CREATE TABLE schedule_windows (
  id TEXT PRIMARY KEY NOT NULL,
  tournament_id TEXT NOT NULL REFERENCES tournaments(id),
  matchday INTEGER,
  fixture_id TEXT REFERENCES fixtures(id),
  opens_at TEXT CHECK(opens_at IS NULL OR length(opens_at)=24),
  deadline_at TEXT CHECK(deadline_at IS NULL OR length(deadline_at)=24),
  version INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL,
  CHECK((fixture_id IS NULL) = (matchday IS NOT NULL)),
  CHECK(opens_at IS NULL OR deadline_at IS NULL OR deadline_at > opens_at)
);
CREATE UNIQUE INDEX schedule_window_week ON schedule_windows(tournament_id, matchday) WHERE fixture_id IS NULL;
CREATE UNIQUE INDEX schedule_window_fixture ON schedule_windows(fixture_id) WHERE fixture_id IS NOT NULL;

CREATE TABLE schedule_proposals (
  id TEXT PRIMARY KEY NOT NULL,
  tournament_id TEXT NOT NULL REFERENCES tournaments(id),
  fixture_id TEXT NOT NULL REFERENCES fixtures(id),
  kind TEXT NOT NULL CHECK(kind IN ('initial','reschedule','counter')),
  proposed_at TEXT NOT NULL CHECK(length(proposed_at)=24),
  proposed_local TEXT NOT NULL,
  proposer_timezone TEXT NOT NULL,
  base_kickoff TEXT,
  proposer_account_id TEXT NOT NULL REFERENCES accounts(id),
  proposer_name TEXT NOT NULL,
  proposer_side TEXT NOT NULL CHECK(proposer_side IN ('home','away')),
  responder_side TEXT NOT NULL CHECK(responder_side IN ('home','away') AND responder_side <> proposer_side),
  parent_id TEXT REFERENCES schedule_proposals(id),
  message TEXT,
  status TEXT NOT NULL CHECK(status IN ('awaiting_opponent','awaiting_owner','accepted','declined','countered','withdrawn','rejected','superseded','expired')),
  beyond_deadline INTEGER NOT NULL DEFAULT 0 CHECK(beyond_deadline IN (0,1)),
  decided_by TEXT REFERENCES accounts(id),
  decided_reason TEXT,
  created_at TEXT NOT NULL,
  decided_at TEXT,
  version INTEGER NOT NULL DEFAULT 1
);
-- One active proposal per fixture, enforced by the database as well as the server.
CREATE UNIQUE INDEX schedule_one_active ON schedule_proposals(fixture_id) WHERE status IN ('awaiting_opponent','awaiting_owner');
CREATE INDEX schedule_proposal_fixture ON schedule_proposals(fixture_id, created_at);
CREATE INDEX schedule_proposal_tournament ON schedule_proposals(tournament_id, status);
-- Past times can never be proposed.
CREATE TRIGGER schedule_no_past_proposal BEFORE INSERT ON schedule_proposals
WHEN NEW.proposed_at <= strftime('%Y-%m-%dT%H:%M:%fZ','now')
BEGIN SELECT RAISE(ABORT,'A kickoff in the past cannot be proposed.'); END;
-- A beyond-deadline proposal cannot become accepted without a recorded owner reason.
CREATE TRIGGER schedule_owner_reason BEFORE UPDATE OF status ON schedule_proposals
WHEN NEW.status='accepted' AND NEW.beyond_deadline=1 AND (NEW.decided_reason IS NULL OR length(trim(NEW.decided_reason))<3 OR NEW.decided_by IS NULL)
BEGIN SELECT RAISE(ABORT,'Beyond-deadline kickoffs need a reasoned owner approval.'); END;

-- Append-only scheduling history.
CREATE TABLE schedule_events (
  id TEXT PRIMARY KEY NOT NULL,
  tournament_id TEXT NOT NULL REFERENCES tournaments(id),
  fixture_id TEXT NOT NULL REFERENCES fixtures(id),
  proposal_id TEXT REFERENCES schedule_proposals(id),
  actor_id TEXT,
  actor_name TEXT NOT NULL,
  at TEXT NOT NULL,
  action TEXT NOT NULL,
  reason TEXT,
  kickoff_before TEXT,
  kickoff_after TEXT,
  proposed_at TEXT
);
CREATE INDEX schedule_event_fixture ON schedule_events(fixture_id, at);
CREATE TRIGGER schedule_events_no_update BEFORE UPDATE ON schedule_events BEGIN SELECT RAISE(ABORT,'Scheduling history is append-only.'); END;
CREATE TRIGGER schedule_events_no_delete BEFORE DELETE ON schedule_events BEGIN SELECT RAISE(ABORT,'Scheduling history is append-only.'); END;
