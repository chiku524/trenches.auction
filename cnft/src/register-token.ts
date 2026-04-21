/**
 * Register a minted cNFT in the trenches.auction Worker (D1) after mint.
 * Requires WORKER_URL and ADMIN_SECRET in env (same values as Cloudflare secrets).
 */
import "dotenv/config";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  if (i === -1 || !process.argv[i + 1]) return undefined;
  return process.argv[i + 1];
}

async function main(): Promise<void> {
  const assetId = arg("--asset-id");
  if (!assetId) {
    throw new Error('Usage: npm run register-token -- --asset-id <compressed asset pubkey> [--name "Trench #1"]');
  }
  const name = arg("--name") ?? "Trench Creature";
  const symbol = arg("--symbol") ?? "TRNCH";

  const base = process.env.WORKER_URL ?? "https://trenches.auction";
  const secret = process.env.ADMIN_SECRET;
  if (!secret) {
    throw new Error("Set ADMIN_SECRET (same as Cloudflare Worker secret)");
  }

  const body = {
    chain: "solana" as const,
    mint_or_contract: assetId,
    token_id: "0",
    name,
    symbol,
    immutable_dna: {
      "Asset Type": "Compressed",
    },
    initial_state: {},
  };

  const res = await fetch(`${base.replace(/\/$/, "")}/v1/admin/tokens`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-admin-secret": secret,
    },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Worker returned ${res.status}: ${text}`);
  }
  // eslint-disable-next-line no-console
  console.log(text);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
