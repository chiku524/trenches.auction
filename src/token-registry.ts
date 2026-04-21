import type { Dna } from "./nft-metadata";

/** Register a Solana compressed asset so `/v1/metadata/solana/:mint` resolves from D1. */
export async function registerSolanaCnft(
  db: D1Database,
  assetId: string,
  name: string,
  symbol: string,
  immutableDna?: Dna
): Promise<{ id: string }> {
  const id = `solana:${assetId.trim()}`;
  const mint = assetId.trim();
  const dna = JSON.stringify(immutableDna ?? { "Asset Type": "Compressed" });
  const state = JSON.stringify({});

  await db
    .prepare(
      `INSERT INTO tokens (id, chain, mint_or_contract, token_id, name, symbol, immutable_dna)
       VALUES (?, 'solana', ?, '0', ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         name = excluded.name,
         symbol = excluded.symbol,
         immutable_dna = excluded.immutable_dna`
    )
    .bind(id, mint, name, symbol, dna)
    .run();

  await db
    .prepare(
      `INSERT INTO dynamic_state (token_ref, state_json, updated_at)
       VALUES (?, ?, unixepoch())
       ON CONFLICT(token_ref) DO UPDATE SET state_json = excluded.state_json, updated_at = unixepoch()`
    )
    .bind(id, state)
    .run();

  return { id };
}
