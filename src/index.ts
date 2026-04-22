import { Hono } from "hono";
import { cors } from "hono/cors";
import type { AddressLookupTableInput } from "@metaplex-foundation/umi";
import { computeLiveMetadataTraits } from "./dynamic-traits";
import { buildMetaplexStyleJson, type Dna, type DynamicState } from "./nft-metadata";
import {
  loadMintAuthorityKeypair,
  resolveAddressLookupTableForMinting,
  serverMintCompressedNft,
  serverMintCompressedNftChunk,
} from "./cnft-server-mint";
import { registerSolanaCnft } from "./token-registry";
import {
  MINT_CHALLENGE_PREFIX,
  isChallengeFresh,
  parseChallengeTimestamp,
  sha256Hex,
  verifyWalletSignMessage,
} from "./mint-auth";
import { fetchCnftsByTree, fetchGalleryFromD1 } from "./gallery-das";
import { serverCreateTreeV2 } from "./cnft-tree";
import { getPersistedCnftTree, resolveMerkleTreeAddress } from "./cnft-runtime";
import { dnaForAssetId } from "./collection-traits";
import { responseForCnftPreview } from "./cnft-preview";

const CHALLENGE_MAX_AGE_MS = 5 * 60 * 1000;
const DEFAULT_MINT_BATCH_MAX = 20;

type Secrets = {
  ADMIN_SECRET?: string;
  PINATA_JWT?: string;
  CNFT_MINT_KEYPAIR?: string;
  CNFT_RPC_URL?: string;
};

const app = new Hono<{ Bindings: Env & Secrets }>();

app.use("/*", cors({ origin: "*" }));

app.get("/", (c) =>
  c.json({
    service: "trenches.auction",
    health: "/v1/health",
    metadata_solana: "/v1/metadata/solana/:mint",
    metadata_base: "/v1/metadata/base/:contract/:tokenId",
    cnft_preview: "/v1/cnft/preview/:mint (R2 if uploaded, else SVG from DNA)",
    gallery: "/v1/gallery/cnft",
    mint_challenge: "GET /v1/mint/cnft/challenge",
    mint_submit: "POST /v1/mint/cnft",
    cnft_status: "GET /v1/cnft/status",
    admin_cnft_tree: "POST /v1/admin/cnft/tree",
    admin_cnft_mint_batch: "POST /v1/admin/cnft/mint-batch",
    ui: "/ (static gallery + mint after build:web)",
  })
);

app.get("/v1/health", (c) =>
  c.json({
    ok: true,
    time: new Date().toISOString(),
  })
);

app.get("/v1/mint/cnft/challenge", (c) => {
  const message = `${MINT_CHALLENGE_PREFIX}${Date.now()}`;
  return c.json({
    message,
    expiresInSeconds: Math.floor(CHALLENGE_MAX_AGE_MS / 1000),
  });
});

app.get("/v1/cnft/status", async (c) => {
  const row = await getPersistedCnftTree(c.env.DB);
  const envTree = c.env.CNFT_MERKLE_TREE?.trim() ?? "";
  const tree = (await resolveMerkleTreeAddress(c.env.DB, envTree)) ?? null;
  const rpc = Boolean(c.env.CNFT_RPC_URL);
  const mintKeypairSecret = c.env.CNFT_MINT_KEYPAIR;
  const mintKeypair = Boolean(mintKeypairSecret);
  let mintAuthorityAddress: string | null = null;
  if (mintKeypairSecret) {
    try {
      mintAuthorityAddress = loadMintAuthorityKeypair(mintKeypairSecret).publicKey.toBase58();
    } catch {
      mintAuthorityAddress = null;
    }
  }
  const maxDepth = row?.max_depth ?? null;
  const approxCapacity = maxDepth !== null ? 2 ** maxDepth : null;
  return c.json({
    mintReady: Boolean(tree && rpc && mintKeypair),
    /** Base58 pubkey of CNFT_MINT_KEYPAIR — fund this on devnet for tree + mint fees. */
    mintAuthorityAddress,
    merkleTree: tree,
    maxDepth,
    approxCapacity,
    treePublic: row ? row.tree_public === 1 : null,
    secrets: { rpcConfigured: rpc, mintKeypairConfigured: mintKeypair },
    persistedTree: Boolean(row),
    hint: !tree
      ? "Create a tree via POST /v1/admin/cnft/tree (or set CNFT_MERKLE_TREE)."
      : !rpc || !mintKeypair
        ? "Set Cloudflare secrets CNFT_RPC_URL and CNFT_MINT_KEYPAIR. Prefer a provider RPC URL (not only api.*.solana.com)—public endpoints often return 403 from Workers."
        : null,
  });
});

app.post("/v1/mint/cnft", async (c) => {
  const keypair = c.env.CNFT_MINT_KEYPAIR;
  const rpc = c.env.CNFT_RPC_URL;
  const tree = await resolveMerkleTreeAddress(c.env.DB, c.env.CNFT_MERKLE_TREE ?? "");
  if (!keypair || !rpc || !tree) {
    return c.json(
      {
        error:
          "cNFT mint not configured: set secrets CNFT_MINT_KEYPAIR and CNFT_RPC_URL, then create a Merkle tree (POST /v1/admin/cnft/tree) or set var CNFT_MERKLE_TREE",
      },
      503
    );
  }

  let body: {
    recipient?: string;
    message?: string;
    signature?: string;
    name?: string;
    symbol?: string;
  };
  try {
    body = (await c.req.json()) as typeof body;
  } catch {
    return c.json({ error: "invalid JSON" }, 400);
  }

  const recipient = body.recipient?.trim();
  const message = body.message?.trim();
  const signature = body.signature?.trim();
  if (!recipient || !message || !signature) {
    return c.json({ error: "recipient, message, and signature are required" }, 400);
  }

  const ts = parseChallengeTimestamp(message);
  if (ts === null) {
    return c.json({ error: "invalid challenge message" }, 400);
  }
  if (!isChallengeFresh(ts, Date.now(), CHALLENGE_MAX_AGE_MS)) {
    return c.json({ error: "challenge expired" }, 400);
  }

  const hash = await sha256Hex(message);
  const used = await c.env.DB.prepare(`SELECT message_hash FROM mint_challenge_used WHERE message_hash = ?`)
    .bind(hash)
    .first<{ message_hash: string }>();
  if (used) {
    return c.json({ error: "challenge already used" }, 409);
  }

  if (!verifyWalletSignMessage(recipient, message, signature)) {
    return c.json({ error: "invalid signature" }, 401);
  }

  const royaltyBps = Number.parseInt(c.env.CNFT_ROYALTY_BPS ?? "500", 10);
  const name = body.name?.trim() || `Trenches #${ts}`;
  const symbol = body.symbol?.trim() || "TRNCH";

  let minted: Awaited<ReturnType<typeof serverMintCompressedNft>>;
  try {
    minted = await serverMintCompressedNft({
      rpcUrl: rpc,
      mintAuthorityKeypairJson: keypair,
      merkleTree: tree,
      recipient,
      publicBaseUrl: c.env.PUBLIC_BASE_URL,
      royaltyBps: Number.isFinite(royaltyBps) ? royaltyBps : 500,
      name,
      symbol,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return c.json({ error: "mint_failed", detail: formatRpcErrorDetail(msg) }, 502);
  }

  await c.env.DB.prepare(`INSERT INTO mint_challenge_used (message_hash) VALUES (?)`).bind(hash).run();

  try {
    await registerSolanaCnft(c.env.DB, minted.assetId, name, symbol, dnaForAssetId(minted.assetId));
  } catch (regErr) {
    return c.json(
      {
        ok: true,
        warning: "minted_on_chain_but_db_registration_failed",
        minted,
        registerError: regErr instanceof Error ? regErr.message : String(regErr),
      },
      201
    );
  }

  return c.json({ ok: true, ...minted }, 201);
});

app.get("/v1/gallery/cnft", async (c) => {
  const rpc = c.env.CNFT_RPC_URL;
  const tree = await resolveMerkleTreeAddress(c.env.DB, c.env.CNFT_MERKLE_TREE ?? "");
  if (!rpc || !tree) {
    return c.json({
      items: [],
      configured: false,
      hint: "Set CNFT_RPC_URL secret and create a tree (admin) or CNFT_MERKLE_TREE var",
    });
  }
  const limRaw = c.req.query("limit");
  const lim = Math.min(1000, Math.max(1, Number.parseInt(limRaw ?? "200", 10) || 200));
  const { items: dasItems, error: dasError } = await fetchCnftsByTree(rpc, tree, lim);
  let items = dasItems;
  let dataSource: "das" | "d1" = "das";
  if (items.length === 0) {
    const d1 = await fetchGalleryFromD1(c.env.DB, c.env.PUBLIC_BASE_URL, lim);
    if (d1.length > 0) {
      items = d1;
      dataSource = "d1";
    }
  }
  let hint: string | null = null;
  if (dataSource === "d1" && items.length > 0) {
    hint = dasError
      ? `DAS could not list assets (${dasError}). Showing NFTs registered in this app (D1) instead. Set CNFT_RPC_URL to a DAS-enabled devnet URL (e.g. Helius) to use on-chain index queries.`
      : "DAS returned no group assets; showing mints from this app’s database (D1). Use a DAS endpoint as CNFT_RPC_URL for DAS (getAssetsByGroup) results.";
  }
  return c.json(
    {
      items,
      configured: true,
      tree,
      dataSource,
      error: dataSource === "d1" ? null : (dasError ?? null),
      hint,
    },
    200,
    { "Cache-Control": "public, max-age=30" }
  );
});

function canonicalTokenId(chain: "solana" | "base", mintOrContract: string, tokenId: string): string {
  const m = mintOrContract.trim();
  const t = tokenId.trim();
  if (chain === "solana") return `solana:${m}`;
  return `base:${m.toLowerCase()}:${t}`;
}

function parseJsonObject(raw: string | null, fallback: Record<string, unknown>): Record<string, unknown> {
  if (!raw) return fallback;
  try {
    const v = JSON.parse(raw) as unknown;
    return typeof v === "object" && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : fallback;
  } catch {
    return fallback;
  }
}

function parseDna(raw: string): Dna {
  const o = parseJsonObject(raw, {});
  const out: Dna = {};
  for (const [k, v] of Object.entries(o)) {
    if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") out[k] = v;
  }
  return out;
}

async function buildMetadataForToken(
  c: { env: Env & Secrets },
  id: string
): Promise<Record<string, unknown> | null> {
  const row = await c.env.DB.prepare(
    `SELECT id, chain, mint_or_contract, token_id, name, symbol, immutable_dna FROM tokens WHERE id = ?`
  )
    .bind(id)
    .first<{
      id: string;
      chain: string;
      mint_or_contract: string;
      token_id: string;
      name: string | null;
      symbol: string | null;
      immutable_dna: string;
    }>();

  if (!row) return null;

  const st = await c.env.DB.prepare(`SELECT state_json FROM dynamic_state WHERE token_ref = ?`)
    .bind(id)
    .first<{ state_json: string | null }>();

  const dynamic = parseJsonObject(st?.state_json ?? null, {}) as DynamicState;
  const immutable = parseDna(row.immutable_dna);
  const live = computeLiveMetadataTraits(new Date(), { assetId: row.mint_or_contract, immutable });
  const base = c.env.PUBLIC_BASE_URL.replace(/\/$/, "");
  // R2 upload wins inside this route; else deterministic SVG from DNA.
  const imageUrl = `${base}/v1/cnft/preview/${encodeURIComponent(row.mint_or_contract)}`;
  const animationUrl =
    typeof dynamic.animation_url === "string"
      ? String(dynamic.animation_url)
      : `${base}/viewer?ref=${encodeURIComponent(id)}`;

  const name = row.name ?? "Trench Creature";
  const description =
    typeof dynamic.description === "string"
      ? String(dynamic.description)
      : "A living ocean creature from the trenches. Metadata and media update over time.";

  return buildMetaplexStyleJson({
    name,
    description,
    imageUrl,
    animationUrl,
    externalUrl: `${base}/viewer?ref=${encodeURIComponent(id)}`,
    immutable,
    dynamic,
    live,
  });
}

app.get("/v1/metadata/solana/:mint", async (c) => {
  const mint = decodeURIComponent(c.req.param("mint"));
  const id = canonicalTokenId("solana", mint, "0");
  const body = await buildMetadataForToken(c, id);
  if (!body) {
    return c.json({ error: "token not registered", id }, 404);
  }
  return c.json(body, 200, {
    "Cache-Control": "public, max-age=60, s-maxage=60",
  });
});

app.get("/v1/cnft/preview/:mint", (c) => responseForCnftPreview(c.env, c.req.param("mint")));

app.get("/v1/metadata/base/:contract/:tokenId", async (c) => {
  const contract = decodeURIComponent(c.req.param("contract"));
  const tokenId = decodeURIComponent(c.req.param("tokenId"));
  const id = canonicalTokenId("base", contract, tokenId);
  const body = await buildMetadataForToken(c, id);
  if (!body) {
    return c.json({ error: "token not registered", id }, 404);
  }
  return c.json(body, 200, {
    "Cache-Control": "public, max-age=60, s-maxage=60",
  });
});

app.get("/v1/asset/:tokenRef/image.png", async (c) => {
  const tokenRef = decodeURIComponent(c.req.param("tokenRef"));
  const key = `images/${encodeURIComponent(tokenRef)}/preview.png`;
  const obj = await c.env.ASSETS.get(key);
  if (!obj) {
    return c.json({ error: "preview not uploaded", key }, 404);
  }
  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  headers.set("Cache-Control", "public, max-age=300");
  return new Response(obj.body, { headers });
});

app.get("/v1/viewer/:tokenRef", (c) => {
  const tokenRef = decodeURIComponent(c.req.param("tokenRef"));
  const base = c.env.PUBLIC_BASE_URL.replace(/\/$/, "");
  const loc = `${base}/viewer?ref=${encodeURIComponent(tokenRef)}`;
  return c.redirect(loc, 302);
});

/** Public Solana RPC and some free tiers block Cloudflare Workers egress IPs (HTTP 403). */
function formatRpcErrorDetail(raw: string, maxLen = 2000): string {
  const msg = raw.slice(0, maxLen);
  const low = msg.toLowerCase();
  const looksBlocked =
    low.includes("403") ||
    low.includes("forbidden") ||
    low.includes("blocked") ||
    low.includes("ip or provider");
  const looksBlockhashExpiry =
    low.includes("block height exceeded") ||
    low.includes("expired") && low.includes("signature");
  if (!looksBlocked && !looksBlockhashExpiry) return msg;
  if (looksBlockhashExpiry) {
    const hint =
      " Often caused by slow RPC or preflight delay before the tx lands; retry once, use a faster paid devnet endpoint, or redeploy after Worker RPC timeout/send options were tuned.";
    return msg.includes("retry") ? msg : msg + hint;
  }
  const hint =
    " Workers run from datacenter IPs: use CNFT_RPC_URL from a provider that allows server access (Helius, QuickNode, Alchemy, Triton, etc.) with your API key, on the same cluster (devnet vs mainnet) as your tree.";
  return msg.includes("Helius") || msg.includes("QuickNode") ? msg : msg + hint;
}

function requireAdmin(c: { env: Env & Secrets; req: { header: (name: string) => string | undefined } }): Response | null {
  const secret = c.env.ADMIN_SECRET;
  if (!secret) {
    return new Response(JSON.stringify({ error: "ADMIN_SECRET not configured" }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });
  }
  const h = c.req.header("x-admin-secret");
  if (h !== secret) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }
  return null;
}

app.post("/v1/admin/cnft/tree", async (c) => {
  const denied = requireAdmin(c);
  if (denied) return denied;

  const keypair = c.env.CNFT_MINT_KEYPAIR;
  const rpc = c.env.CNFT_RPC_URL;
  if (!keypair || !rpc) {
    return c.json({ error: "Set CNFT_MINT_KEYPAIR and CNFT_RPC_URL secrets first" }, 503);
  }

  const existing = await getPersistedCnftTree(c.env.DB);
  if (existing) {
    return c.json(
      {
        error: "cnft_tree already stored",
        merkleTree: existing.merkle_tree,
        hint: "Use the existing tree or remove the cnft_tree row in D1 only if you know the impact.",
      },
      409
    );
  }

  let body: {
    maxDepth?: number;
    maxBufferSize?: number;
    canopyDepth?: number;
    treePublic?: boolean;
    cluster?: string;
  };
  try {
    body = (await c.req.json()) as typeof body;
  } catch {
    body = {};
  }

  const maxDepth = body.maxDepth ?? 14;
  const maxBufferSize = body.maxBufferSize ?? 64;
  const canopyDepth = body.canopyDepth ?? 8;
  const treePublic = Boolean(body.treePublic);
  const cluster =
    typeof body.cluster === "string" && body.cluster.trim() ? body.cluster.trim() : "devnet";

  if (canopyDepth > maxDepth) {
    return c.json({ error: "canopyDepth must be <= maxDepth" }, 400);
  }

  let created;
  try {
    created = await serverCreateTreeV2({
      rpcUrl: rpc,
      mintAuthorityKeypairJson: keypair,
      maxDepth,
      maxBufferSize,
      canopyDepth,
      treePublic,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return c.json({ error: "create_tree_failed", detail: formatRpcErrorDetail(msg) }, 502);
  }

  await c.env.DB.prepare(
    `INSERT INTO cnft_tree (id, merkle_tree, max_depth, max_buffer_size, canopy_depth, tree_public, cluster)
     VALUES (1, ?, ?, ?, ?, ?, ?)`
  )
    .bind(created.merkleTree, maxDepth, maxBufferSize, canopyDepth, treePublic ? 1 : 0, cluster)
    .run();

  return c.json({ ok: true, tree: created }, 201);
});

app.post("/v1/admin/cnft/mint-batch", async (c) => {
  const denied = requireAdmin(c);
  if (denied) return denied;

  const keypair = c.env.CNFT_MINT_KEYPAIR;
  const rpc = c.env.CNFT_RPC_URL;
  const tree = await resolveMerkleTreeAddress(c.env.DB, c.env.CNFT_MERKLE_TREE ?? "");
  if (!keypair || !rpc || !tree) {
    return c.json({ error: "Missing CNFT_MINT_KEYPAIR, CNFT_RPC_URL, or Merkle tree" }, 503);
  }

  let body: {
    recipient?: string;
    count?: number;
    namePrefix?: string;
    symbol?: string;
    startNumber?: number;
  };
  try {
    body = (await c.req.json()) as typeof body;
  } catch {
    return c.json({ error: "invalid JSON" }, 400);
  }

  const recipient = body.recipient?.trim();
  if (!recipient) {
    return c.json({ error: "recipient required" }, 400);
  }

  const capParsed = Number.parseInt(c.env.CNFT_MINT_BATCH_MAX ?? "", 10);
  const batchMax = Math.min(100, Math.max(1, Number.isFinite(capParsed) ? capParsed : DEFAULT_MINT_BATCH_MAX));
  const count = Math.min(batchMax, Math.max(1, Number(body.count) || 1));
  const namePrefix = body.namePrefix?.trim() || "Trenches";
  const symbol = body.symbol?.trim() || "TRNCH";
  const startNumber = Math.max(1, Number(body.startNumber) || 1);

  const royaltyBps = Number.parseInt(c.env.CNFT_ROYALTY_BPS ?? "500", 10);
  const perTxParsed = Number.parseInt(c.env.CNFT_MINTS_PER_TX ?? "3", 10);
  const mintsPerTx = Math.min(20, Math.max(1, Number.isFinite(perTxParsed) && perTxParsed > 0 ? perTxParsed : 3));

  const toMint: { name: string; symbol: string }[] = [];
  for (let i = 0; i < count; i++) {
    const num = startNumber + i;
    toMint.push({ name: `${namePrefix} #${num}`, symbol });
  }

  const altStr = c.env.CNFT_ADDRESS_LOOKUP_TABLE?.trim() ?? "";
  let addressLookup: AddressLookupTableInput | null = null;
  if (altStr) {
    try {
      addressLookup = await resolveAddressLookupTableForMinting({
        rpcUrl: rpc,
        mintAuthorityKeypairJson: keypair,
        addressLookupTableBase58: altStr,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return c.json({ error: "invalid_address_lookup_table", detail: formatRpcErrorDetail(msg, 800) }, 400);
    }
  }

  const results: Record<string, unknown>[] = [];
  for (let o = 0; o < toMint.length; o += mintsPerTx) {
    const chunk = toMint.slice(o, o + mintsPerTx);
    try {
      const batch = await serverMintCompressedNftChunk({
        rpcUrl: rpc,
        mintAuthorityKeypairJson: keypair,
        merkleTree: tree,
        recipient,
        publicBaseUrl: c.env.PUBLIC_BASE_URL,
        royaltyBps: Number.isFinite(royaltyBps) ? royaltyBps : 500,
        items: chunk,
        addressLookupTable: addressLookup,
      });
      for (let j = 0; j < batch.length; j++) {
        const minted = batch[j]!;
        const { name, symbol: sym } = chunk[j]!;
        await registerSolanaCnft(c.env.DB, minted.assetId, name, sym, dnaForAssetId(minted.assetId));
        results.push({ ok: true, name, ...minted });
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      results.push({ ok: false, name: chunk[0]!.name, error: formatRpcErrorDetail(msg, 800) });
      break;
    }
  }

  const okCount = results.filter((r) => r.ok === true).length;
  return c.json(
    {
      ok: true,
      attempted: toMint.length,
      minted: okCount,
      mintsPerTransaction: mintsPerTx,
      addressLookupTable: altStr || null,
      v0WithAddressLookup: Boolean(addressLookup),
      results,
    },
    200
  );
});

app.post("/v1/admin/tokens", async (c) => {
  const denied = requireAdmin(c);
  if (denied) return denied;

  let body: {
    chain: "solana" | "base";
    mint_or_contract: string;
    token_id: string;
    name?: string;
    symbol?: string;
    immutable_dna?: Dna;
    initial_state?: DynamicState;
  };
  try {
    body = (await c.req.json()) as typeof body;
  } catch {
    return c.json({ error: "invalid JSON" }, 400);
  }

  if (body.chain !== "solana" && body.chain !== "base") {
    return c.json({ error: "chain must be solana or base" }, 400);
  }
  const id = canonicalTokenId(body.chain, body.mint_or_contract, body.token_id);
  const dna = JSON.stringify(body.immutable_dna ?? {});
  const state = JSON.stringify(body.initial_state ?? {});

  await c.env.DB.prepare(
    `INSERT INTO tokens (id, chain, mint_or_contract, token_id, name, symbol, immutable_dna)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       name = excluded.name,
       symbol = excluded.symbol,
       immutable_dna = excluded.immutable_dna`
  )
    .bind(
      id,
      body.chain,
      body.mint_or_contract.trim(),
      body.token_id.trim(),
      body.name ?? null,
      body.symbol ?? null,
      dna
    )
    .run();

  await c.env.DB.prepare(
    `INSERT INTO dynamic_state (token_ref, state_json, updated_at)
     VALUES (?, ?, unixepoch())
     ON CONFLICT(token_ref) DO UPDATE SET state_json = excluded.state_json, updated_at = unixepoch()`
  )
    .bind(id, state)
    .run();

  return c.json({ ok: true, id }, 201);
});

app.patch("/v1/admin/tokens/:id/state", async (c) => {
  const denied = requireAdmin(c);
  if (denied) return denied;

  const id = decodeURIComponent(c.req.param("id"));
  let patch: DynamicState;
  try {
    patch = (await c.req.json()) as DynamicState;
  } catch {
    return c.json({ error: "invalid JSON" }, 400);
  }

  const row = await c.env.DB.prepare(`SELECT state_json FROM dynamic_state WHERE token_ref = ?`)
    .bind(id)
    .first<{ state_json: string | null }>();

  const prev = parseJsonObject(row?.state_json ?? null, {});
  const next = { ...prev, ...patch };

  await c.env.DB.prepare(
    `INSERT INTO dynamic_state (token_ref, state_json, updated_at) VALUES (?, ?, unixepoch())
     ON CONFLICT(token_ref) DO UPDATE SET state_json = excluded.state_json, updated_at = unixepoch()`
  )
    .bind(id, JSON.stringify(next))
    .run();

  return c.json({ ok: true, id, state: next });
});

app.put("/v1/admin/assets/:tokenRef/preview.png", async (c) => {
  const denied = requireAdmin(c);
  if (denied) return denied;

  const tokenRef = decodeURIComponent(c.req.param("tokenRef"));
  const exists = await c.env.DB.prepare(`SELECT id FROM tokens WHERE id = ?`).bind(tokenRef).first<{ id: string }>();
  if (!exists) {
    return c.json({ error: "unknown token ref" }, 404);
  }

  const buf = await c.req.arrayBuffer();
  if (!buf.byteLength) {
    return c.json({ error: "empty body" }, 400);
  }

  const key = `images/${encodeURIComponent(tokenRef)}/preview.png`;
  await c.env.ASSETS.put(key, buf, {
    httpMetadata: { contentType: "image/png", cacheControl: "public, max-age=3600" },
  });

  return c.json({ ok: true, key });
});

/**
 * Pin JSON to IPFS via Pinata (set PINATA_JWT secret).
 * Body: { "token_ref": "solana:...", "json": { ... } } — if json omitted, builds from live metadata.
 */
app.post("/v1/admin/ipfs/pin-json", async (c) => {
  const denied = requireAdmin(c);
  if (denied) return denied;

  const jwt = c.env.PINATA_JWT;
  if (!jwt) {
    return c.json({ error: "PINATA_JWT not set (Pinata API JWT from https://app.pinata.cloud )" }, 501);
  }

  type Body = { token_ref: string; json?: Record<string, unknown> };
  let body: Body;
  try {
    body = (await c.req.json()) as Body;
  } catch {
    return c.json({ error: "invalid JSON" }, 400);
  }

  const tokenRef = body.token_ref;
  let json: Record<string, unknown>;
  if (body.json) {
    json = body.json;
  } else {
    const built = await buildMetadataForToken(c, tokenRef);
    if (!built) {
      return c.json({ error: "unknown token_ref" }, 404);
    }
    json = built;
  }

  const res = await fetch("https://api.pinata.cloud/pinning/pinJSONToIPFS", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${jwt}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      pinataContent: json,
      pinataMetadata: { name: `trenches-${tokenRef.replace(/[^a-zA-Z0-9._-]/g, "_")}.json` },
      pinataOptions: { cidVersion: 1 },
    }),
  });

  if (!res.ok) {
    const t = await res.text();
    return c.json({ error: "pinata pin failed", status: res.status, detail: t.slice(0, 2000) }, 502);
  }

  const data = (await res.json()) as { IpfsHash?: string };
  const cid = data.IpfsHash;
  if (!cid) {
    return c.json({ error: "unexpected pinata response", data }, 502);
  }

  const gateway = `https://gateway.pinata.cloud/ipfs/${cid}`;

  await c.env.DB.prepare(
    `INSERT INTO ipfs_pins (token_ref, kind, cid, gateway_url, pinned_at)
     VALUES (?, 'metadata', ?, ?, unixepoch())
     ON CONFLICT(token_ref, kind) DO UPDATE SET cid = excluded.cid, gateway_url = excluded.gateway_url, pinned_at = unixepoch()`
  )
    .bind(tokenRef, cid, gateway)
    .run();

  return c.json({ ok: true, cid, gateway_url: gateway });
});

export default app;
