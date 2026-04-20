# trenches.auction — dynamic NFT backend (Cloudflare)

This repository is a **Cloudflare Worker** that serves **JSON metadata**, **R2-hosted previews / GLB keys**, **D1 state** for dynamic traits, and optional **Pinata IPFS** pins for permanent URIs.

## What was provisioned (CLI)

| Resource | Name / ID |
|----------|-----------|
| **Worker** | `trenches-auction` |
| **D1** | `trenches-auction` — `232997c1-2df7-4764-baf0-6091a4229322` |
| **R2 bucket** | `trenches-auction-assets` |
| **Workers dev URL** | Shown after `wrangler deploy` (e.g. `https://trenches-auction.<account>.workers.dev`) |

Migrations were applied remotely (`0001_init.sql`).

## Prerequisites

- Node 20+
- `wrangler login` (already done on this machine)
- Domain **trenches.auction** on Cloudflare DNS (for production URLs)

## Install & deploy

```bash
cd trenches-auction
npm install
npx wrangler deploy
```

## Environment variables

| Variable | Where | Purpose |
|----------|--------|---------|
| `PUBLIC_BASE_URL` | `wrangler.jsonc` → `vars` | Base URL embedded in `image`, `external_url`, and animation links. Set to `https://trenches.auction` once the Worker is routed on that host. Until then, override at deploy time so links work on `*.workers.dev` (see below). |
| `ADMIN_SECRET` | Secret | Protects `/v1/admin/*` routes. |
| `PINATA_JWT` | Secret | Optional; enables `/v1/admin/ipfs/pin-json` (Pinata IPFS). |

Set secrets (non-interactive safe pattern):

```bash
echo "your-long-random-secret" | npx wrangler secret put ADMIN_SECRET
echo "your-pinata-jwt" | npx wrangler secret put PINATA_JWT
```

Copy `.dev.vars.example` → `.dev.vars` for local development.

### Point `PUBLIC_BASE_URL` at your current host

Until **trenches.auction** routes to this Worker, deploy with a public base that matches where the Worker is reachable, for example:

```bash
npx wrangler deploy --var PUBLIC_BASE_URL:https://trenches-auction.<your-subdomain>.workers.dev
```

After DNS + route are configured:

```bash
npx wrangler deploy --var PUBLIC_BASE_URL:https://trenches.auction
```

## Custom domain (trenches.auction)

1. Add the domain to your Cloudflare account and set nameservers if needed.
2. In **Workers & Pages** → **trenches-auction** → **Triggers** → **Custom Domains**, add `trenches.auction` and `www` if desired.
3. Deploy with `PUBLIC_BASE_URL=https://trenches.auction` as above.

Alternatively, add a `routes` entry in `wrangler.jsonc` (requires the zone on Cloudflare):

```jsonc
"routes": [
  { "pattern": "trenches.auction/*", "zone_name": "trenches.auction" }
]
```

## API overview

- `GET /v1/health` — liveness.
- `GET /v1/metadata/solana/:mint` — Metaplex-style JSON (Solana mint address).
- `GET /v1/metadata/base/:contract/:tokenId` — same for Base / EVM (`0x` contract + decimal token id string).
- `GET /v1/asset/:tokenRef/image.png` — PNG from R2 at `images/{tokenRef}/preview.png`.
- `GET /v1/viewer/:tokenRef` — placeholder HTML for a future Three.js viewer.

Admin (header `x-admin-secret: <ADMIN_SECRET>`):

- `POST /v1/admin/tokens` — register or update a token row + initial dynamic state.
- `PATCH /v1/admin/tokens/:id/state` — merge JSON into dynamic state (`description`, `animation_url`, mood, etc.).
- `PUT /v1/admin/assets/:tokenRef/preview.png` — raw PNG body → R2 preview path above.
- `POST /v1/admin/ipfs/pin-json` — Pin JSON with Pinata; body `{ "token_ref": "solana:..." }` uses live metadata if `json` omitted.

### Register a Solana token (example)

Internal id: `solana:<mint>`. `token_id` in the body should match how you canonicalize (code uses `mint` + `token_id` for uniqueness; for Solana the unique key is `solana:${mint}`).

```bash
curl -sS -X POST "$BASE/v1/admin/tokens" \
  -H "Content-Type: application/json" \
  -H "x-admin-secret: $ADMIN_SECRET" \
  -d '{
    "chain": "solana",
    "mint_or_contract": "YOUR_MINT_ADDRESS",
    "token_id": "0",
    "name": "Abyss Hydra #1",
    "symbol": "TRENCH",
    "immutable_dna": {
      "Lineage": "Glass Squid",
      "Faction": "Abyss Order",
      "Origin Biome": "Abyssal Trench"
    },
    "initial_state": { "description": "Creature-only dynamic collection." }
  }'
```

### Upload a preview PNG to R2

```bash
curl -sS -X PUT "$BASE/v1/admin/assets/solana%3AYOUR_MINT_ADDRESS/preview.png" \
  -H "x-admin-secret: $ADMIN_SECRET" \
  --data-binary @preview.png
```

(Use the same `token_ref` returned as `id` from registration, URL-encoded.)

### Pin metadata to IPFS (Pinata)

Requires `PINATA_JWT` from [Pinata](https://app.pinata.cloud/).

```bash
curl -sS -X POST "$BASE/v1/admin/ipfs/pin-json" \
  -H "Content-Type: application/json" \
  -H "x-admin-secret: $ADMIN_SECRET" \
  -d '{"token_ref":"solana:YOUR_MINT_ADDRESS"}'
```

## On-chain metadata URIs

- **Solana (Metaplex)** — set collection/token `uri` to  
  `https://trenches.auction/v1/metadata/solana/<MINT>`  
  (after the domain points at this Worker).

- **Base (ERC-721)** — `tokenURI` should return the same JSON shape; point to  
  `https://trenches.auction/v1/metadata/base/<contract>/<tokenId>`.

## D1 schema

- `tokens` — chain, mint/contract, immutable DNA JSON.
- `dynamic_state` — mutable JSON merged into attributes and description.
- `ipfs_pins` — optional Pinata CID + gateway URL per token.

## R2 layout (suggested)

- `images/{tokenRef}/preview.png` — 2D preview (served by `/v1/asset/...`).
- Add GLB paths in `initial_state` or `immutable_dna` as URL fields pointing at public R2 URLs once you expose them (custom domain for R2 or signed URLs — next iteration).

## IPFS note

NFT.Storage “classic” uploads were deprecated for new uploads; this project uses **Pinata** for JSON pinning. You can mirror the same files to **Storacha**, **Filebase**, or **web3.storage** with separate scripts if you prefer.

## Local development

```bash
cp .dev.vars.example .dev.vars
# edit .dev.vars
npm run dev
```

Apply migrations locally when using local D1:

```bash
npm run db:migrate:local
```

---

**Next steps for your 3D pipeline:** ship a static or SPA viewer (Cloudflare Pages or same Worker) that loads GLB from R2 and reads `/v1/metadata/...` for uniforms; keep using `PATCH /v1/admin/tokens/:id/state` for event-driven trait updates.
