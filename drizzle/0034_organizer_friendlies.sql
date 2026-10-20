-- An organizer proposal needs an answer from each player before it is confirmed.
CREATE TABLE friendly_organizer_proposals (
  invitation_id TEXT PRIMARY KEY NOT NULL REFERENCES friendly_invitations(id),
  created_by TEXT NOT NULL REFERENCES accounts(id),
  first_response INTEGER NOT NULL DEFAULT 0 CHECK(first_response IN (0,1))
);
CREATE INDEX friendly_organizer_created_by ON friendly_organizer_proposals(created_by);
