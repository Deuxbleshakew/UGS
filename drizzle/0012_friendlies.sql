-- Friendly invitations between two eligible participants. Friendlies are not fixtures:
-- no Elo, standings, qualification, awards, proof or results. Chat is a later milestone.
CREATE TABLE friendly_invitations (
  id TEXT PRIMARY KEY NOT NULL,
  inviter_id TEXT NOT NULL REFERENCES accounts(id),
  invitee_id TEXT NOT NULL REFERENCES accounts(id),
  pair_key TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('pending','accepted','declined','cancelled','expired')),
  proposed_at TEXT NOT NULL CHECK(length(proposed_at)=24),
  proposed_local TEXT NOT NULL,
  proposer_timezone TEXT NOT NULL,
  proposed_by TEXT NOT NULL REFERENCES accounts(id),
  turn_id TEXT REFERENCES accounts(id),
  message TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  CHECK(inviter_id <> invitee_id),
  CHECK(proposed_by IN (inviter_id, invitee_id)),
  CHECK(turn_id IS NULL OR turn_id IN (inviter_id, invitee_id)),
  CHECK((status = 'pending') = (turn_id IS NOT NULL)),
  CHECK(turn_id IS NULL OR turn_id <> proposed_by)
);
-- No duplicate pending request between the same two people, in either direction.
CREATE UNIQUE INDEX friendly_one_pending ON friendly_invitations(pair_key) WHERE status = 'pending';
CREATE INDEX friendly_inviter ON friendly_invitations(inviter_id, status);
CREATE INDEX friendly_invitee ON friendly_invitations(invitee_id, status);
-- A pending invitation can never carry a time in the past.
CREATE TRIGGER friendly_no_past_insert BEFORE INSERT ON friendly_invitations
WHEN NEW.status = 'pending' AND NEW.proposed_at <= strftime('%Y-%m-%dT%H:%M:%fZ','now')
BEGIN SELECT RAISE(ABORT,'A friendly in the past cannot be proposed.'); END;
CREATE TRIGGER friendly_no_past_update BEFORE UPDATE OF proposed_at ON friendly_invitations
WHEN NEW.status = 'pending' AND NEW.proposed_at <= strftime('%Y-%m-%dT%H:%M:%fZ','now')
BEGIN SELECT RAISE(ABORT,'A friendly in the past cannot be proposed.'); END;

-- Append-only history, visible to the two participants only.
CREATE TABLE friendly_events (
  id TEXT PRIMARY KEY NOT NULL,
  invitation_id TEXT NOT NULL REFERENCES friendly_invitations(id),
  actor_id TEXT,
  actor_name TEXT NOT NULL,
  at TEXT NOT NULL,
  action TEXT NOT NULL,
  reason TEXT,
  proposed_at TEXT
);
CREATE INDEX friendly_event_invitation ON friendly_events(invitation_id, at);
CREATE TRIGGER friendly_events_no_update BEFORE UPDATE ON friendly_events BEGIN SELECT RAISE(ABORT,'Friendly history is append-only.'); END;
CREATE TRIGGER friendly_events_no_delete BEFORE DELETE ON friendly_events BEGIN SELECT RAISE(ABORT,'Friendly history is append-only.'); END;
