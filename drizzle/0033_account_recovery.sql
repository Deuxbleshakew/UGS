CREATE TABLE password_reset_tokens (
  token_hash TEXT PRIMARY KEY NOT NULL,
  account_id TEXT NOT NULL REFERENCES accounts(id),
  expires_at INTEGER NOT NULL,
  created_at TEXT NOT NULL
);
CREATE UNIQUE INDEX password_reset_account ON password_reset_tokens(account_id);
