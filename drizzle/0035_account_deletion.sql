-- Permit an explicit owner account purge to remove that person's friendly history.
-- Other friendly history remains append-only.
CREATE TABLE account_deletion_context (
  invitation_id TEXT PRIMARY KEY NOT NULL
);
DROP TRIGGER friendly_events_no_delete;
CREATE TRIGGER friendly_events_no_delete BEFORE DELETE ON friendly_events
WHEN NOT EXISTS (SELECT 1 FROM account_deletion_context WHERE invitation_id=OLD.invitation_id)
BEGIN SELECT RAISE(ABORT,'Friendly history is append-only.'); END;
