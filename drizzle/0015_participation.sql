-- First-sign-in choice: does this person want to take part in the tournament?
-- No row = never asked (existing accounts keep working exactly as before).
-- wants=0  -> a viewer. wants=1 + status 'pending' -> asked to switch to taking part; still a viewer until the owner approves.
CREATE TABLE account_participation (
  account_id TEXT PRIMARY KEY NOT NULL REFERENCES accounts(id),
  wants INTEGER NOT NULL CHECK(wants IN (0,1)),
  status TEXT NOT NULL CHECK(status IN ('active','pending')),
  answered_at TEXT NOT NULL,
  decided_by TEXT REFERENCES accounts(id),
  decided_at TEXT,
  CHECK(status = 'active' OR wants = 1)
);
-- The owner is always a participant and never gets a row.
CREATE TRIGGER participation_not_owner BEFORE INSERT ON account_participation
WHEN (SELECT owner FROM accounts WHERE id = NEW.account_id) = 1
BEGIN SELECT RAISE(ABORT,'The owner account always takes part.'); END;
