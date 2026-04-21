export type CnftTreeRow = {
  id: number;
  merkle_tree: string;
  max_depth: number;
  max_buffer_size: number;
  canopy_depth: number;
  tree_public: number;
  cluster: string;
  created_at: number;
};

export async function getPersistedCnftTree(db: D1Database): Promise<CnftTreeRow | null> {
  const row = await db
    .prepare(`SELECT id, merkle_tree, max_depth, max_buffer_size, canopy_depth, tree_public, cluster, created_at
              FROM cnft_tree WHERE id = 1`)
    .first<CnftTreeRow>();
  return row ?? null;
}

/** Prefer D1 row; fall back to wrangler var CNFT_MERKLE_TREE. */
export async function resolveMerkleTreeAddress(db: D1Database, envMerkleTree: string): Promise<string | null> {
  const row = await getPersistedCnftTree(db);
  const fromDb = row?.merkle_tree?.trim();
  if (fromDb) return fromDb;
  const fromEnv = envMerkleTree?.trim();
  return fromEnv || null;
}
