-- Optional profile picture. The (re-encoded) image is stored in the database so it is
-- backed up with everything else and removed with the account. One picture per account.
CREATE TABLE account_avatars (
  account_id TEXT PRIMARY KEY NOT NULL REFERENCES accounts(id),
  mime TEXT NOT NULL CHECK(mime IN ('image/jpeg','image/png','image/webp')),
  data BLOB NOT NULL CHECK(length(data) BETWEEN 64 AND 524288),
  width INTEGER NOT NULL CHECK(width BETWEEN 16 AND 1024),
  height INTEGER NOT NULL CHECK(height BETWEEN 16 AND 1024),
  version INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL
);
