import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { createSignerFromKeypair, keypairIdentity, none, publicKey, some } from "@metaplex-foundation/umi";
import { fromWeb3JsKeypair } from "@metaplex-foundation/umi-web3js-adapters";
import { mplBubblegum, mintV2, TokenStandard, fetchTreeConfigFromSeeds, findLeafAssetIdPda, parseLeafFromMintV2Transaction } from "@metaplex-foundation/mpl-bubblegum";
import { Keypair } from "@solana/web3.js";
import bs58 from "bs58";

export function loadMintAuthorityKeypair(raw: string): Keypair {
  const arr = JSON.parse(raw) as number[];
  if (!Array.isArray(arr) || arr.length < 64) {
    throw new Error("CNFT_MINT_KEYPAIR must be a JSON array of 64 byte values");
  }
  return Keypair.fromSecretKey(Uint8Array.from(arr));
}

export function createWorkerUmi(rpcUrl: string, feePayer: Keypair) {
  const umi = createUmi(rpcUrl).use(mplBubblegum());
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

  const sig = await tx.sendAndConfirm(umi);
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
