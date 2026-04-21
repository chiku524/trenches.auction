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

/** Digital Asset Standard JSON-RPC (Helius, Triton, etc.). */
export async function fetchCnftsByTree(
  rpcUrl: string,
  merkleTree: string,
  limit = 500
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

  const items = (json.result?.items ?? []).map(normalizeDasAsset).filter((i) => i.id.length > 0);
  return { items };
}
