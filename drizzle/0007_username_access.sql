-- Keep existing tables, IDs, foreign keys and historical rows in place.
-- Empty legacy email strings represent no email; they must never link identities.
DROP INDEX account_email;
CREATE UNIQUE INDEX account_email ON accounts(email) WHERE email <> '';
DROP INDEX member_email;
CREATE UNIQUE INDEX member_email ON members(tournament_id,email) WHERE email <> '';

CREATE TABLE account_usernames (
  username TEXT PRIMARY KEY NOT NULL,
  account_id TEXT REFERENCES accounts(id),
  player_id TEXT REFERENCES community_players(id),
  created_at TEXT NOT NULL,
  CHECK(length(username) BETWEEN 3 AND 24 AND username = lower(username)
    AND username NOT GLOB '*[^a-z0-9_]*')
);
CREATE UNIQUE INDEX username_account ON account_usernames(account_id);
CREATE UNIQUE INDEX username_player ON account_usernames(player_id);

ALTER TABLE members ADD COLUMN username TEXT REFERENCES account_usernames(username);
CREATE UNIQUE INDEX member_username ON members(tournament_id,username) WHERE username IS NOT NULL;
ALTER TABLE invitations ADD COLUMN username TEXT REFERENCES account_usernames(username);
CREATE UNIQUE INDEX invitation_username ON invitations(username) WHERE username IS NOT NULL;

CREATE TABLE account_access_audit (
  id TEXT PRIMARY KEY NOT NULL,
  actor_id TEXT NOT NULL REFERENCES accounts(id),
  target_account_id TEXT REFERENCES accounts(id),
  username TEXT NOT NULL,
  action TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX account_access_actor ON account_access_audit(actor_id,created_at);
