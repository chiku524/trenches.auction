/**
 * One-time: creates a Bubblegum V2 merkle tree. Signs with KEYPAIR_PATH.
 * Choose maxDepth so 2^maxDepth >= your max supply (e.g. 14 → 16,384 leaves).
 */
import { generateSigner, some } from "@metaplex-foundation/umi";
import { createTreeV2 } from "@metaplex-foundation/mpl-bubblegum";
import { createTrenchesUmi } from "./createUmi.js";
import { getCluster, getRpcUrl, loadFeePayerKeypair } from "./env.js";
import { writeConfig, type CnftConfig } from "./config-file.js";

function intEnv(name: string, fallback: number): number {
  const v = process.env[name];
  if (v === undefined || v === "") return fallback;
  const n = Number.parseInt(v, 10);
  if (Number.isNaN(n)) throw new Error(`${name} must be a number`);
  return n;
}

function boolEnv(name: string, fallback: boolean): boolean {
  const v = process.env[name];
  if (v === undefined || v === "") return fallback;
  if (v === "true" || v === "1") return true;
  if (v === "false" || v === "0") return false;
  throw new Error(`${name} must be true or false`);
}

async function main(): Promise<void> {
  const payer = loadFeePayerKeypair();
  const umi = createTrenchesUmi(payer);

  const maxDepth = intEnv("MAX_DEPTH", 14);
  const maxBufferSize = intEnv("MAX_BUFFER_SIZE", 64);
  const canopyDepth = intEnv("CANOPY_DEPTH", 8);
  const treePublic = boolEnv("TREE_PUBLIC", false);

  if (canopyDepth > maxDepth) {
    throw new Error("CANOPY_DEPTH must be <= MAX_DEPTH");
  }

  const merkleTree = generateSigner(umi);

  const tx = await createTreeV2(umi, {
    merkleTree,
    maxDepth,
    maxBufferSize,
    canopyDepth,
    public: some(treePublic),
  });

  const sig = await tx.sendAndConfirm(umi);

  const cfg: CnftConfig = {
    cluster: getCluster(),
    rpcUrl: getRpcUrl(),
    merkleTree: merkleTree.publicKey.toString(),
    maxDepth,
    maxBufferSize,
    canopyDepth,
    treePublic,
    createdAt: new Date().toISOString(),
  };
  writeConfig(cfg);

  // eslint-disable-next-line no-console
  console.log("Merkle tree created.");
  // eslint-disable-next-line no-console
  console.log("Signature:", sig.signature);
  // eslint-disable-next-line no-console
  console.log("Merkle tree:", cfg.merkleTree);
  // eslint-disable-next-line no-console
  console.log("Wrote", process.env.CNFT_CONFIG ?? "cnft-config.json");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
