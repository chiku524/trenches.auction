## Learned User Preferences

- On Windows, install and use Solana CLI from WSL; the official installer does not support Git Bash/MSYS.
- In bash, quote npm script arguments that contain `#` (for example cNFT mint names) so `#` is not treated as starting a comment.

## Learned Workspace Facts

- The `cnft/` package runs Metaplex Bubblegum cNFT flows; it uses `KEYPAIR_PATH` (Solana JSON keypair), `CLUSTER`, `METADATA_BASE_URL` aligned with the Worker `PUBLIC_BASE_URL`, and optional `RPC_URL` for devnet.
- `cnft` scripts run under Windows Node using only the keypair JSON path; Solana CLI may live only in WSL.
- `register-token` needs `WORKER_URL` and `ADMIN_SECRET` matching the Worker `ADMIN_SECRET` secret; admin routes compare `x-admin-secret`; the value cannot be read back from Cloudflare after storage—set or rotate with `wrangler secret put` and mirror locally.
- `create-tree` uses Bubblegum V2; minting must call `mintV2`, not `mintV1`, or Bubblegum returns `UnsupportedSchemaVersion` (6003).
- Devnet transactions require a funded payer; public devnet airdrops are often rate-limited—use faucets or other funding paths.
- npm peer dependency warnings between nested Metaplex packages and `@metaplex-foundation/umi` are common with Bubblegum stacks and are often safe to ignore unless something fails at runtime.
- The `web/` Vite app supports optional `VITE_API_BASE` so local UI dev can call a separate `wrangler dev` origin (for example `http://127.0.0.1:8787`); when the deployed UI and Worker share one host, leave it unset and use relative `/v1/...` URLs.
- The Worker supports server-assisted cNFT minting (`/v1/mint/cnft` with a signed challenge), records mints and tree-related state in D1, and serves a DAS-backed gallery for the configured Merkle tree—alongside the `cnft/` CLI and `register-token`.
- GitHub Actions (`.github/workflows/deploy-cloudflare.yml`) deploys on push to `main` via `npm ci` and `npm run deploy`; set repository secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` (Worker runtime secrets remain in Cloudflare).
- Root `package-lock.json` must match `package.json` for `npm ci` in CI; if installs fail on missing transitive dependencies, regenerate the lockfile with `npm install` and commit the update.
