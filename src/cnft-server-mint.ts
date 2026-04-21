import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import {
  createSignerFromKeypair,
  keypairIdentity,
  none,
  publicKey,
  some,
  type Context,
  type TransactionBuilder,
  type TransactionBuilderSendAndConfirmOptions,
  type TransactionSignature,
} from "@metaplex-foundation/umi";
import { fromWeb3JsKeypair } from "@metaplex-foundation/umi-web3js-adapters";
import { mplBubblegum, mintV2, TokenStandard, fetchTreeConfigFromSeeds, findLeafAssetIdPda, parseLeafFromMintV2Transaction } from "@metaplex-foundation/mpl-bubblegum";
import { Keypair } from "@solana/web3.js";
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
