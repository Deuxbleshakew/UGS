CREATE TABLE account_profiles (
  account_id TEXT PRIMARY KEY NOT NULL REFERENCES accounts(id),
  data TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL
);
