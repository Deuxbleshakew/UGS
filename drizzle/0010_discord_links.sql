-- Optional Discord connection. A link only records which stable Discord user ID
-- belongs to an already-authorized UGS account; it never creates or authorizes
-- accounts and carries no roles. No Discord tokens are stored.
CREATE TABLE discord_links (
  account_id TEXT PRIMARY KEY NOT NULL REFERENCES accounts(id),
  discord_user_id TEXT NOT NULL,
  discord_name TEXT NOT NULL,
  linked_at TEXT NOT NULL,
  CHECK(length(discord_user_id) BETWEEN 15 AND 22 AND discord_user_id NOT GLOB '*[^0-9]*')
);
-- One Discord identity can never be shared by two UGS accounts.
CREATE UNIQUE INDEX discord_link_user ON discord_links(discord_user_id);

-- One-time OAuth states. Only a hash of the state is stored, bound to a hash of a
-- browser cookie; link states are also bound to the signed-in account.
CREATE TABLE discord_oauth_states (
  state_hash TEXT PRIMARY KEY NOT NULL,
  purpose TEXT NOT NULL CHECK(purpose IN ('link','login')),
  account_id TEXT REFERENCES accounts(id),
  browser_hash TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  CHECK((purpose = 'link') = (account_id IS NOT NULL))
);
CREATE INDEX discord_state_expiry ON discord_oauth_states(expires_at);

CREATE TABLE discord_link_audit (
  id TEXT PRIMARY KEY NOT NULL,
  account_id TEXT NOT NULL REFERENCES accounts(id),
  discord_user_id TEXT NOT NULL,
  action TEXT NOT NULL CHECK(action IN ('linked','unlinked','signed_in')),
  created_at TEXT NOT NULL
);
CREATE INDEX discord_audit_account ON discord_link_audit(account_id,created_at);
