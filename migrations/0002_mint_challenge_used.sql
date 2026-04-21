-- One-time mint challenges (prevents replay of the same signed message)
CREATE TABLE mint_challenge_used (
  message_hash TEXT PRIMARY KEY,
  used_at INTEGER NOT NULL DEFAULT (unixepoch())
);
