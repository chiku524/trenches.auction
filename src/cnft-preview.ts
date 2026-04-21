import { hash32 } from "./collection-traits";
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

function escSvg(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** HSL stops from DNA + mint for a consistent “creature card” look without R2. */
function colorsFromDna(dna: Dna, mint: string): { a: string; b: string; accent: string } {
  const seed = String(dna["Variant Seed"] ?? dna["Species"] ?? mint);
  const h = hash32(`${mint}::${seed}`);
  const h2 = hash32(`${mint}::bg`);
  const h3 = hash32(`${mint}::ac`);
  const a = h % 360;
  const b = (a + 28 + (h2 % 40)) % 360;
  const acc = (a + 180 + (h3 % 30)) % 360;
  return {
    a: `hsl(${a} 55% 22%)`,
    b: `hsl(${b} 50% 14%)`,
    accent: `hsl(${acc} 70% 58%)`,
  };
}

function buildFallbackSvg(dna: Dna, name: string, mint: string): string {
  const { a, b, accent } = colorsFromDna(dna, mint);
  const species = typeof dna.Species === "string" ? dna.Species : "Trench creature";
  const biome = typeof dna.Biome === "string" ? dna.Biome : "";
  const h = hash32(mint);
  const cx = 256 + (h % 200) - 100;
  const cy = 200 + ((h >> 8) % 120) - 60;
  const r1 = 90 + (h % 50);
  const r2 = 50 + ((h >> 4) % 40);

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
<defs>
<linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
<stop offset="0" stop-color="${a}"/>
<stop offset="1" stop-color="${b}"/>
</linearGradient>
</defs>
<rect width="512" height="512" fill="url(#g)"/>
<ellipse cx="${cx}" cy="${cy}" rx="${r1}" ry="${r2}" fill="none" stroke="${accent}" stroke-width="3" opacity="0.5"/>
<ellipse cx="${512 - cx}" cy="${cy + 20}" rx="${r2}" ry="${r1 * 0.4}" fill="${accent}" opacity="0.12"/>
<rect x="32" y="400" width="448" height="64" fill="#020617" fill-opacity="0.55" rx="8"/>
<text x="256" y="430" text-anchor="middle" fill="#e2e8f0" font-family="system-ui,Segoe UI,sans-serif" font-size="18" font-weight="600">${escSvg(name || "Trench creature")}</text>
<text x="256" y="452" text-anchor="middle" fill="#94a3b8" font-family="system-ui,Segoe UI,sans-serif" font-size="13">${escSvg(species)}${biome ? " · " + escSvg(biome) : ""}</text>
</svg>`;
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
  const svg = buildFallbackSvg(dna, name, mint);
  return new Response(svg, {
    status: 200,
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
