-- Tokens: one row per NFT (Solana mint or Base contract+tokenId)
CREATE TABLE tokens (
  id TEXT PRIMARY KEY,
  chain TEXT NOT NULL CHECK (chain IN ('solana', 'base')),
  mint_or_contract TEXT NOT NULL,
  token_id TEXT NOT NULL,
  name TEXT,
  symbol TEXT,
  immutable_dna TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE UNIQUE INDEX idx_tokens_chain_mint ON tokens (chain, mint_or_contract, token_id);

-- Mutable / computed dynamic state (time, events, loyalty overlays)
CREATE TABLE dynamic_state (
  token_ref TEXT PRIMARY KEY,
  state_json TEXT NOT NULL DEFAULT '{}',
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (token_ref) REFERENCES tokens(id) ON DELETE CASCADE
);

-- Optional: pinned IPFS CIDs (nft.storage / Pinata / web3.storage)
CREATE TABLE ipfs_pins (
  token_ref TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('metadata', 'image', 'animation', 'bundle')),
  cid TEXT NOT NULL,
  gateway_url TEXT,
  pinned_at INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (token_ref, kind),
  FOREIGN KEY (token_ref) REFERENCES tokens(id) ON DELETE CASCADE
);

CREATE INDEX idx_ipfs_cid ON ipfs_pins (cid);
