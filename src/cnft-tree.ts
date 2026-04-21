import { generateSigner, some } from "@metaplex-foundation/umi";
import { createTreeV2 } from "@metaplex-foundation/mpl-bubblegum";
import bs58 from "bs58";
import { createWorkerUmi, loadMintAuthorityKeypair, workerSendAndConfirmTransactionOptions } from "./cnft-server-mint";

export type CreateTreeV2ServerResult = {
  merkleTree: string;
  signatureBase58: string;
  maxDepth: number;
  maxBufferSize: number;
  canopyDepth: number;
  treePublic: boolean;
};

export async function serverCreateTreeV2(input: {
  rpcUrl: string;
  mintAuthorityKeypairJson: string;
  maxDepth: number;
  maxBufferSize: number;
  canopyDepth: number;
  treePublic: boolean;
}): Promise<CreateTreeV2ServerResult> {
  if (input.canopyDepth > input.maxDepth) {
    throw new Error("canopyDepth must be <= maxDepth");
  }
  const payer = loadMintAuthorityKeypair(input.mintAuthorityKeypairJson);
  const umi = createWorkerUmi(input.rpcUrl, payer);
  const merkleTree = generateSigner(umi);

  const tx = await createTreeV2(umi, {
    merkleTree,
    maxDepth: input.maxDepth,
    maxBufferSize: input.maxBufferSize,
    canopyDepth: input.canopyDepth,
    public: some(input.treePublic),
  });

  const sig = await tx.sendAndConfirm(umi, workerSendAndConfirmTransactionOptions);
  const sigBytes = sig.signature;
  const signatureBase58 =
    typeof sigBytes === "string"
      ? sigBytes
      : bs58.encode(sigBytes instanceof Uint8Array ? sigBytes : new Uint8Array(sigBytes as ArrayLike<number>));

  return {
    merkleTree: merkleTree.publicKey.toString(),
    signatureBase58,
    maxDepth: input.maxDepth,
    maxBufferSize: input.maxBufferSize,
    canopyDepth: input.canopyDepth,
    treePublic: input.treePublic,
  };
}
