import { buildCreaturePreviewSvg } from "./cnft-creature-art";
import type { Dna } from "./nft-metadata";

function parseJsonObject(raw: string | null, fallback: Record<string, unknown>): Record<string, unknown> {
  if (!raw) return fallback;
  try {
    const v = JSON.parse(raw) as unknown;
    return typeof v === "object" && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : fallback;
  } catch {
    return fallback;
  }
}

function parseImmutableDna(raw: string): Dna {
  const o = parseJsonObject(raw, {});
  const out: Dna = {};
  for (const [k, v] of Object.entries(o)) {
    if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") out[k] = v;
  }
  return out;
}

type Env = { ASSETS: R2Bucket; DB: D1Database };

/**
 * Serves R2 `preview.png` when present; otherwise a deterministic SVG from immutable DNA
 * (same traits as on-chain metadata). Use this URL in gallery and Metaplex `image`.
 */
export async function responseForCnftPreview(env: Env, mintRaw: string): Promise<Response> {
  const mint = decodeURIComponent(mintRaw).trim();
  if (!mint) {
    return new Response(JSON.stringify({ error: "missing mint" }), { status: 400, headers: { "Content-Type": "application/json" } });
  }

  const row = await env.DB.prepare(
    `SELECT id, name, symbol, immutable_dna FROM tokens WHERE chain = 'solana' AND mint_or_contract = ?`
  )
    .bind(mint)
    .first<{ id: string; name: string | null; symbol: string | null; immutable_dna: string }>();

  if (!row) {
    return new Response(JSON.stringify({ error: "token not registered" }), { status: 404, headers: { "Content-Type": "application/json" } });
  }

  const tokenRef = row.id;
  const key = `images/${encodeURIComponent(tokenRef)}/preview.png`;
  const r2 = await env.ASSETS.get(key);
  if (r2) {
    const headers = new Headers();
    r2.writeHttpMetadata(headers);
    headers.set("Content-Type", headers.get("Content-Type") ?? "image/png");
    headers.set("Cache-Control", "public, max-age=300");
    return new Response(r2.body, { headers });
  }

  const dna = parseImmutableDna(row.immutable_dna);
  const name = row.name || row.symbol || "Trench creature";
  const svg = buildCreaturePreviewSvg(dna, name, mint);
  return new Response(svg, {
    status: 200,
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
