import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import {
  createSignerFromKeypair,
  keypairIdentity,
  none,
  publicKey,
  some,
  transactionBuilder,
  type AddressLookupTableInput,
  type Context,
  type TransactionBuilder,
  type TransactionBuilderSendAndConfirmOptions,
  type TransactionSignature,
} from "@metaplex-foundation/umi";
import { fromWeb3JsKeypair, fromWeb3JsInstruction, fromWeb3JsPublicKey } from "@metaplex-foundation/umi-web3js-adapters";
import { AddressLookupTableAccount, ComputeBudgetProgram, Keypair } from "@solana/web3.js";
import { mplBubblegum, mintV2, TokenStandard, fetchTreeConfigFromSeeds, findLeafAssetIdPda, parseLeafFromMintV2Transaction } from "@metaplex-foundation/mpl-bubblegum";
import bs58 from "bs58";

/** Longer confirmation window + skip preflight helps Cloudflare Workers + slow devnet RPC avoid blockhash expiry. */
const WORKER_RPC_CONNECTION = {
  commitment: "confirmed" as const,
  confirmTransactionInitialTimeout: 300_000,
};

export const workerSendAndConfirmTransactionOptions: TransactionBuilderSendAndConfirmOptions = {
  send: { skipPreflight: true, maxRetries: 8 },
  confirm: { commitment: "confirmed" },
};

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function isLikelyBlockhashOrConfirmTimeout(msg: string): boolean {
  const m = msg.toLowerCase();
  return (
    m.includes("block height exceeded") ||
    m.includes("block height") ||
    (m.includes("expired") && m.includes("signature")) ||
    m.includes("transactionexpired") ||
    m.includes("timed out waiting")
  );
}

/**
 * `Connection.confirmTransaction` can throw "block height exceeded" while the tx is still
 * landing on slow devnet RPCs. Poll signature status after that error.
 */
export async function sendAndConfirmWithStatusFallback(
  umi: Pick<Context, "rpc" | "transactions" | "payer">,
  builder: TransactionBuilder,
  opts: TransactionBuilderSendAndConfirmOptions
): Promise<{ signature: TransactionSignature }> {
  let b = builder;
  if (!builder.options.blockhash) {
    b = await builder.setLatestBlockhash(umi);
  }
  const signature = await b.send(umi, opts.send ?? {});
  try {
    await b.confirm(umi, signature, opts.confirm ?? {});
    return { signature };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (!isLikelyBlockhashOrConfirmTimeout(msg)) {
      throw e;
    }
    // Cap polls to stay under Cloudflare's ~100 subrequests per invocation (tx already used several).
    const maxPolls = 55;
    const intervalMs = 5000;
    for (let i = 0; i < maxPolls; i++) {
      await sleep(intervalMs);
      const statuses = await umi.rpc.getSignatureStatuses([signature], {
        searchTransactionHistory: true,
      });
      const st = statuses[0];
      if (st?.error) {
        throw new Error(`Transaction failed on-chain: ${JSON.stringify(st.error)}`);
      }
      if (st?.commitment === "processed" || st?.commitment === "confirmed" || st?.commitment === "finalized") {
        return { signature };
      }
    }
    throw e;
  }
}

export function loadMintAuthorityKeypair(raw: string): Keypair {
  const arr = JSON.parse(raw) as number[];
  if (!Array.isArray(arr) || arr.length < 64) {
    throw new Error("CNFT_MINT_KEYPAIR must be a JSON array of 64 byte values");
  }
  return Keypair.fromSecretKey(Uint8Array.from(arr));
}

export function createWorkerUmi(rpcUrl: string, feePayer: Keypair) {
  const umi = createUmi(rpcUrl, WORKER_RPC_CONNECTION).use(mplBubblegum());
  const kp = fromWeb3JsKeypair(feePayer);
  const signer = createSignerFromKeypair(umi, kp);
  umi.use(keypairIdentity(signer));
  return umi;
}

export type ServerMintCnftResult = {
  assetId: string;
  signatureBase58: string;
  uri: string;
  leafOwner: string;
};

const CU_BASE = 200_000;
const CU_PER_CNFT = 400_000;
const CU_CAP = 1_400_000;
const U64_MAX = BigInt("0xffffffffffffffff");

/**
 * Fetch and decode a Solana address lookup table for use with version-0 transactions (smaller messages
 * when accounts are referenced via ALT). Extend the table with Bubblegum, Merkle tree, tree config,
 * recipient, mint authority, and program IDs used by your mints.
 */
export async function resolveAddressLookupTableForMinting(input: {
  rpcUrl: string;
  mintAuthorityKeypairJson: string;
  addressLookupTableBase58: string;
}): Promise<AddressLookupTableInput> {
  const payer = loadMintAuthorityKeypair(input.mintAuthorityKeypairJson);
  const umi = createWorkerUmi(input.rpcUrl, payer);
  return loadAddressLookupTableInput(umi, input.addressLookupTableBase58);
}

export async function loadAddressLookupTableInput(umi: Context, addressLookupTableBase58: string): Promise<AddressLookupTableInput> {
  const trimmed = addressLookupTableBase58.trim();
  if (!trimmed) {
    throw new Error("address lookup table address is empty");
  }
  const key = publicKey(trimmed);
  const acc = await umi.rpc.getAccount(key);
  if (!acc.exists) {
    throw new Error("Address lookup table account not found on RPC");
  }
  const state = AddressLookupTableAccount.deserialize(acc.data);
  if (state.deactivationSlot !== U64_MAX) {
    throw new Error("Address lookup table is deactivated; use an active table or create a new one");
  }
  if (state.addresses.length === 0) {
    throw new Error("Address lookup table has no addresses; extend it before batch minting");
  }
  return {
    publicKey: key,
    addresses: state.addresses.map((a) => fromWeb3JsPublicKey(a)),
  };
}

function setComputeUnitLimitInstruction(units: number) {
  const web3Ix = ComputeBudgetProgram.setComputeUnitLimit({ units: Math.max(0, Math.floor(units)) });
  return { instruction: fromWeb3JsInstruction(web3Ix), signers: [], bytesCreatedOnChain: 0 };
}

function buildMintV2Chunk(umi: Context, input: {
  merkleTree: ReturnType<typeof publicKey>;
  leafOwner: ReturnType<typeof publicKey>;
  publicBaseUrl: string;
  royaltyBps: number;
  startLeaf: bigint;
  items: { name: string; symbol: string }[];
  addressLookupTable: AddressLookupTableInput | null;
}): TransactionBuilder {
  const n = input.items.length;
  const cu = Math.min(CU_CAP, CU_BASE + n * CU_PER_CNFT);
  let b = transactionBuilder([setComputeUnitLimitInstruction(cu)]);

  const base = input.publicBaseUrl.replace(/\/$/, "");
  for (let i = 0; i < n; i++) {
    const leafIndex = input.startLeaf + BigInt(i);
    const assetPda = findLeafAssetIdPda(umi, { merkleTree: input.merkleTree, leafIndex });
    const assetIdStr = assetPda[0].toString();
    const uri = `${base}/v1/metadata/solana/${assetIdStr}`;

    b = b.add(
      mintV2(umi, {
        merkleTree: input.merkleTree,
        leafOwner: input.leafOwner,
        leafDelegate: input.leafOwner,
        treeCreatorOrDelegate: umi.identity,
        metadata: {
          name: input.items[i].name,
          symbol: input.items[i].symbol,
          uri,
          sellerFeeBasisPoints: input.royaltyBps,
          primarySaleHappened: false,
          isMutable: true,
          tokenStandard: some(TokenStandard.NonFungible),
          collection: none(),
          creators: [
            { address: umi.identity.publicKey, verified: true, share: 100 },
          ],
        },
      })
    );
  }

  if (input.addressLookupTable) {
    b = b.useV0().setAddressLookupTables([input.addressLookupTable]);
  }
  if (!b.fitsInOneTransaction(umi)) {
    throw new Error(
      "cNFT batch chunk does not fit in one transaction: lower CNFT_MINTS_PER_TX, shorten names, or add CNFT_ADDRESS_LOOKUP_TABLE with a well-stocked ALT"
    );
  }
  return b;
}

/**
 * Mints 1+ cNFTs in a **single** transaction (fetches current tree leaf first). Call repeatedly from the
 * batch route, slicing by `CNFT_MINTS_PER_TX`, so D1 can be updated per chunk and partial success matches on-chain.
 */
export async function serverMintCompressedNftChunk(input: {
  rpcUrl: string;
  mintAuthorityKeypairJson: string;
  merkleTree: string;
  recipient: string;
  publicBaseUrl: string;
  royaltyBps: number;
  items: { name: string; symbol: string }[];
  /** If set, transaction uses a V0 message with this lookup table (fetch once per batch, not per chunk). */
  addressLookupTable?: AddressLookupTableInput | null;
}): Promise<ServerMintCnftResult[]> {
  if (input.items.length === 0) {
    return [];
  }

  const payer = loadMintAuthorityKeypair(input.mintAuthorityKeypairJson);
  const umi = createWorkerUmi(input.rpcUrl, payer);
  const merkleTree = publicKey(input.merkleTree);
  const leafOwner = publicKey(input.recipient);
  const base = input.publicBaseUrl.replace(/\/$/, "");

  const treeConfig = await fetchTreeConfigFromSeeds(umi, { merkleTree });
  const startLeaf: bigint = treeConfig.numMinted;

  const builder = buildMintV2Chunk(umi, {
    merkleTree,
    leafOwner,
    publicBaseUrl: input.publicBaseUrl,
    royaltyBps: input.royaltyBps,
    startLeaf,
    items: input.items,
    addressLookupTable: input.addressLookupTable ?? null,
  });
  const sig = await sendAndConfirmWithStatusFallback(umi, builder, workerSendAndConfirmTransactionOptions);
  const sigBytes = sig.signature;
  const signatureBase58 =
    typeof sigBytes === "string"
      ? sigBytes
      : bs58.encode(sigBytes instanceof Uint8Array ? sigBytes : new Uint8Array(sigBytes as ArrayLike<number>));

  const out: ServerMintCnftResult[] = [];
  for (let j = 0; j < input.items.length; j++) {
    const leafIndex = startLeaf + BigInt(j);
    const assetPda = findLeafAssetIdPda(umi, { merkleTree, leafIndex });
    const assetIdStr = assetPda[0].toString();
    out.push({
      assetId: assetIdStr,
      signatureBase58,
      uri: `${base}/v1/metadata/solana/${assetIdStr}`,
      leafOwner: leafOwner.toString(),
    });
  }
  return out;
}

export async function serverMintCompressedNft(input: {
  rpcUrl: string;
  mintAuthorityKeypairJson: string;
  merkleTree: string;
  recipient: string;
  publicBaseUrl: string;
  royaltyBps: number;
  name: string;
  symbol: string;
}): Promise<ServerMintCnftResult> {
  const payer = loadMintAuthorityKeypair(input.mintAuthorityKeypairJson);
  const umi = createWorkerUmi(input.rpcUrl, payer);
  const merkleTree = publicKey(input.merkleTree);
  const leafOwner = publicKey(input.recipient);

  const treeConfig = await fetchTreeConfigFromSeeds(umi, { merkleTree });
  const assetPda = findLeafAssetIdPda(umi, {
    merkleTree,
    leafIndex: treeConfig.numMinted,
  });
  const assetIdStr = assetPda[0].toString();

  const base = input.publicBaseUrl.replace(/\/$/, "");
  const uri = `${base}/v1/metadata/solana/${assetIdStr}`;

  const tx = await mintV2(umi, {
    merkleTree,
    leafOwner,
    leafDelegate: leafOwner,
    treeCreatorOrDelegate: umi.identity,
    metadata: {
      name: input.name,
      symbol: input.symbol,
      uri,
      sellerFeeBasisPoints: input.royaltyBps,
      primarySaleHappened: false,
      isMutable: true,
      tokenStandard: some(TokenStandard.NonFungible),
      collection: none(),
      creators: [
        {
          address: umi.identity.publicKey,
          verified: true,
          share: 100,
        },
      ],
    },
  });

  const sig = await sendAndConfirmWithStatusFallback(umi, tx, workerSendAndConfirmTransactionOptions);
  const sigBytes = sig.signature;
  const signatureBase58 =
    typeof sigBytes === "string"
      ? sigBytes
      : bs58.encode(sigBytes instanceof Uint8Array ? sigBytes : new Uint8Array(sigBytes as ArrayLike<number>));

  let verifiedId = assetIdStr;
  try {
    const leaf = await parseLeafFromMintV2Transaction(umi, sig.signature);
    verifiedId = leaf.id.toString();
  } catch {
    // Precomputed PDA matches when MPL Core collection parser cannot run.
  }

  return {
    assetId: verifiedId,
    signatureBase58,
    uri: `${base}/v1/metadata/solana/${verifiedId}`,
    leafOwner: leafOwner.toString(),
  };
}
