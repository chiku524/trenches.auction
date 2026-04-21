-- Active Bubblegum Merkle tree (single row). Created via POST /v1/admin/cnft/tree or legacy wrangler var.
CREATE TABLE cnft_tree (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  merkle_tree TEXT NOT NULL,
  max_depth INTEGER NOT NULL,
  max_buffer_size INTEGER NOT NULL,
  canopy_depth INTEGER NOT NULL,
  tree_public INTEGER NOT NULL DEFAULT 0,
  cluster TEXT NOT NULL DEFAULT 'devnet',
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
