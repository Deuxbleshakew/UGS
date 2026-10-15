-- Disabling an account is reversible and never deletes history: results, Elo, fixtures,
-- tournament memberships and the audit trail all stay exactly as they are.
CREATE TABLE account_status (
  account_id TEXT PRIMARY KEY NOT NULL REFERENCES accounts(id),
  disabled_at TEXT NOT NULL,
  reason TEXT NOT NULL CHECK(length(trim(reason)) BETWEEN 3 AND 300),
  disabled_by TEXT NOT NULL REFERENCES accounts(id),
  CHECK(account_id <> disabled_by)
);
-- The owner account can never be disabled, whatever the application code does.
CREATE TRIGGER account_status_not_owner BEFORE INSERT ON account_status
WHEN (SELECT owner FROM accounts WHERE id = NEW.account_id) = 1
BEGIN SELECT RAISE(ABORT,'The owner account cannot be disabled.'); END;
