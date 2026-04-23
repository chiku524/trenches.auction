export type GalleryItem = {
  id: string;
  name: string | null;
  symbol: string | null;
  uri: string | null;
  image: string | null;
  owner: string | null;
};

type DasAsset = {
  id?: string;
  content?: {
    metadata?: { name?: string; symbol?: string; image?: string; uri?: string };
    links?: { image?: string };
  };
  ownership?: { owner?: string };
  compression?: {
    leaf_id?: number;
    seq?: number;
  };
  /** Some indexers (e.g. Helius) set this; useful when compression keys are missing. */
  created_at?: number | string;
};

function normalizeDasAsset(a: DasAsset): GalleryItem {
  const md = a.content?.metadata ?? {};
  const image = md.image ?? a.content?.links?.image ?? null;
  return {
    id: a.id ?? "",
    name: typeof md.name === "string" ? md.name : null,
    symbol: typeof md.symbol === "string" ? md.symbol : null,
    uri: typeof md.uri === "string" ? md.uri : null,
    image: typeof image === "string" ? image : null,
    owner: typeof a.ownership?.owner === "string" ? a.ownership.owner : null,
  };
}

/** Sort key for cNFTs: higher ≈ newer mint in tree (seq / leaf_id), else indexer timestamp. */
function dasSortKey(a: DasAsset): number {
  const c = a.compression;
  if (c && typeof c === "object") {
    if (typeof c.seq === "number" && Number.isFinite(c.seq)) return c.seq;
    if (typeof c.leaf_id === "number" && Number.isFinite(c.leaf_id)) return c.leaf_id;
  }
  const ca = a.created_at;
  if (typeof ca === "number" && Number.isFinite(ca)) return ca;
  if (typeof ca === "string" && ca.trim()) {
    const t = Date.parse(ca);
    if (Number.isFinite(t)) return t;
    const n = Number.parseFloat(ca);
    if (Number.isFinite(n)) return n;
  }
  return 0;
}

function sortGalleryItems(items: GalleryItem[], keys: number[], order: "newest" | "oldest"): GalleryItem[] {
  const dir = order === "newest" ? -1 : 1;
  const idx = items.map((it, i) => ({ it, k: keys[i] ?? 0, id: it.id }));
  idx.sort((a, b) => {
    if (a.k !== b.k) return (a.k - b.k) * dir;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
  return idx.map((x) => x.it);
}

/** Digital Asset Standard JSON-RPC (Helius, Triton, etc.). */
export async function fetchCnftsByTree(
  rpcUrl: string,
  merkleTree: string,
  limit = 500,
  order: "newest" | "oldest" = "newest"
): Promise<{ items: GalleryItem[]; error?: string }> {
  const body = {
    jsonrpc: "2.0",
    id: "trenches-gallery",
    method: "getAssetsByGroup",
    params: {
      groupKey: "tree",
      groupValue: merkleTree,
      page: 1,
      limit,
    },
  };

  const res = await fetch(rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    return { items: [], error: `rpc_http_${res.status}` };
  }

  const json = (await res.json()) as {
    result?: { items?: DasAsset[]; total?: number; cursor?: string };
    error?: { message?: string; code?: number };
  };

  if (json.error) {
    return { items: [], error: json.error.message ?? "das_error" };
  }

  const raw = json.result?.items ?? [];
  const paired: { it: GalleryItem; k: number }[] = [];
  for (let i = 0; i < raw.length; i++) {
    const asset = raw[i] as DasAsset;
    const it = normalizeDasAsset(asset);
    if (it.id.length > 0) paired.push({ it, k: dasSortKey(asset) });
  }
  return {
    items: sortGalleryItems(
      paired.map((p) => p.it),
      paired.map((p) => p.k),
      order
    ),
  };
}

/** List Solana cNFTs registered in D1 (always populated when our mints succeed). Use when DAS is unavailable. */
export async function fetchGalleryFromD1(
  db: D1Database,
  publicBaseUrl: string,
  limit: number,
  order: "newest" | "oldest" = "newest"
): Promise<GalleryItem[]> {
  const base = publicBaseUrl.replace(/\/$/, "");
  const cap = Math.min(1000, Math.max(1, limit));
  const orderSql = order === "newest" ? "DESC" : "ASC";
  const { results } = await db
    .prepare(
      `SELECT mint_or_contract, name, symbol FROM tokens
       WHERE chain = 'solana' ORDER BY created_at ${orderSql} LIMIT ?`
    )
    .bind(cap)
    .all<{ mint_or_contract: string; name: string | null; symbol: string | null }>();

  const list = results ?? [];
  return list.map((r) => {
    const assetId = r.mint_or_contract;
    return {
      id: assetId,
      name: r.name,
      symbol: r.symbol,
      uri: `${base}/v1/metadata/solana/${encodeURIComponent(assetId)}`,
      image: `${base}/v1/cnft/preview/${encodeURIComponent(assetId)}`,
      owner: null,
    };
  });
}
