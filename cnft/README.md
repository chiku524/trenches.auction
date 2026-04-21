# Compressed NFTs (Bubblegum) for trenches.auction

CLI tools to create a **Merkle tree** and **mint cNFTs** with metadata URIs pointing at your Cloudflare Worker. Each command signs transactions with the keypair in `KEYPAIR_PATH`.

## Prerequisites

- Solana CLI keypair JSON file with SOL for fees (devnet: `solana airdrop 2 <addr>`).
- Node 20+.

## Setup

```bash
cd cnft
cp .env.example .env
# edit .env — at minimum KEYPAIR_PATH and CLUSTER
npm install
```

## 1. Create tree (once per collection)

Creates a Bubblegum **V2** tree and writes `cnft-config.json` in the current directory.

```bash
npm run create-tree
```

Environment knobs (see `.env.example`):

- `MAX_DEPTH` — `2^MAX_DEPTH` is max supply (default **14** → 16,384 leaves).
- `TREE_PUBLIC` — `true` allows open minting by anyone; **`false`** (default) restricts to your keypair.

## 2. Mint a cNFT

The script reads `cnft-config.json`, computes the **next** compressed asset id from the tree’s `numMinted`, and sets:

`METADATA_BASE_URL/v1/metadata/solana/<assetId>`

so the on-chain URI matches your Worker in **one signed transaction**.

```bash
npm run mint -- --name "Abyss Hydra #1" --symbol TRNCH
```

Optional:

- `--owner <pubkey>` — recipient (default: your keypair).
- `--uri <url>` — override metadata URI completely.

## 3. Register in your Worker DB (optional)

After mint, register the asset so `/v1/metadata/solana/<assetId>` returns JSON:

```bash
npm run register-token -- --asset-id <ASSET_ID_FROM_MINT_OUTPUT> --name "Abyss Hydra #1"
```

Requires `WORKER_URL` and `ADMIN_SECRET` in `.env` (same secret as the Worker).

## Files

| File | Purpose |
|------|---------|
| `cnft-config.json` | Merkle tree address + params (created by `create-tree`) |

## Mainnet

Set `CLUSTER=mainnet-beta`, use a funded wallet, and consider a dedicated RPC (`RPC_URL` with Helius/QuickNode).
