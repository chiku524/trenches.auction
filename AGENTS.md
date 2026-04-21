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
