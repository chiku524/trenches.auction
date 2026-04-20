import { Hono } from "hono";
import { cors } from "hono/cors";
import { computeClockTraits } from "./time-traits";
import { buildMetaplexStyleJson, type Dna, type DynamicState } from "./nft-metadata";

type Secrets = {
  ADMIN_SECRET?: string;
  PINATA_JWT?: string;
};

const app = new Hono<{ Bindings: Env & Secrets }>();

app.use("/*", cors({ origin: "*" }));

app.get("/", (c) =>
  c.json({
    service: "trenches.auction",
    health: "/v1/health",
    metadata_solana: "/v1/metadata/solana/:mint",
    metadata_base: "/v1/metadata/base/:contract/:tokenId",
  })
);

app.get("/v1/health", (c) =>
  c.json({
    ok: true,
    time: new Date().toISOString(),
  })
);

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
  const clock = computeClockTraits();
  const base = c.env.PUBLIC_BASE_URL.replace(/\/$/, "");
  const imageUrl = `${base}/v1/asset/${encodeURIComponent(id)}/image.png`;
  const animationUrl =
    typeof dynamic.animation_url === "string" ? String(dynamic.animation_url) : `${base}/v1/viewer/${encodeURIComponent(id)}`;

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
    externalUrl: `${base}/v1/viewer/${encodeURIComponent(id)}`,
    immutable,
    dynamic,
    clock,
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

app.get("/v1/viewer/:tokenRef", async (c) => {
  const tokenRef = decodeURIComponent(c.req.param("tokenRef"));
  const base = c.env.PUBLIC_BASE_URL.replace(/\/$/, "");
  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>Trenches — viewer</title>
  <style>
    body { font-family: system-ui, sans-serif; margin: 2rem; background: #020617; color: #e2e8f0; }
    a { color: #38bdf8; }
    code { background: #0f172a; padding: 0.2rem 0.4rem; border-radius: 4px; }
  </style>
</head>
<body>
  <h1>Trench creature</h1>
  <p>Token ref: <code>${escapeHtml(tokenRef)}</code></p>
  <p>Ship your Three.js or Babylon viewer here; load GLB from R2 and fetch JSON from <code>/v1/metadata/...</code> after mint registration.</p>
</body>
</html>`;
  return c.text(html, 200, { "Content-Type": "text/html; charset=utf-8" });
});

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
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
