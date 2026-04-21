/**
 * Mint one compressed NFT in a single transaction with the correct metadata URI:
 * METADATA_BASE_URL/v1/metadata/solana/<assetId>
 *
 * Asset id is derived from the Merkle tree + next leaf index (numMinted) before minting.
 */
import { publicKey, none, some } from "@metaplex-foundation/umi";
import {
  mintV1,
  TokenStandard,
  TokenProgramVersion,
  fetchTreeConfigFromSeeds,
  findLeafAssetIdPda,
  parseLeafFromMintV1Transaction,
  parseLeafFromMintV2Transaction,
} from "@metaplex-foundation/mpl-bubblegum";
import { createTrenchesUmi } from "./createUmi.js";
import { getMetadataBaseUrl, loadFeePayerKeypair } from "./env.js";
import { readConfig } from "./config-file.js";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  if (i === -1 || !process.argv[i + 1]) return undefined;
  return process.argv[i + 1];
}

async function main(): Promise<void> {
  const name = arg("--name");
  if (!name) {
    throw new Error(
      'Usage: npm run mint -- --name "Trench #1" [--symbol TRNCH] [--uri https://...] [--owner <solana address>]'
    );
  }
  const symbol = arg("--symbol") ?? "TRNCH";
  const uriOverride = arg("--uri");
  const ownerStr = arg("--owner");

  const payer = loadFeePayerKeypair();
  const umi = createTrenchesUmi(payer);
  const cfg = readConfig();

  const merkleTree = publicKey(cfg.merkleTree);
  const leafOwner = ownerStr ? publicKey(ownerStr) : umi.identity.publicKey;

  const treeConfig = await fetchTreeConfigFromSeeds(umi, { merkleTree });
  const nextLeafIndex = treeConfig.numMinted;

  const assetPda = findLeafAssetIdPda(umi, {
    merkleTree,
    leafIndex: nextLeafIndex,
  });
  const assetIdStr = assetPda[0].toString();

  const uri =
    uriOverride ?? `${getMetadataBaseUrl()}/v1/metadata/solana/${assetIdStr}`;

  const tx = await mintV1(umi, {
    merkleTree,
    leafOwner,
    metadata: {
      name,
      symbol,
      uri,
      sellerFeeBasisPoints: Number.parseInt(process.env.ROYALTY_BPS ?? "500", 10),
      primarySaleHappened: false,
      isMutable: true,
      editionNonce: none(),
      tokenStandard: some(TokenStandard.NonFungible),
      collection: none(),
      uses: none(),
      tokenProgramVersion: TokenProgramVersion.Original,
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

  let verifiedId = assetIdStr;
  try {
    const leaf = await parseLeafFromMintV1Transaction(umi, sig.signature);
    verifiedId = leaf.id.toString();
  } catch {
    try {
      const leaf = await parseLeafFromMintV2Transaction(umi, sig.signature);
      verifiedId = leaf.id.toString();
    } catch {
      // rely on precomputed asset id
    }
  }
  if (verifiedId !== assetIdStr) {
    // eslint-disable-next-line no-console
    console.warn("Precomputed asset id != parsed leaf id; prefer parsed.", { assetIdStr, verifiedId });
  }

  // eslint-disable-next-line no-console
  console.log("Minted cNFT.");
  // eslint-disable-next-line no-console
  console.log("Signature:", sig.signature);
  // eslint-disable-next-line no-console
  console.log("Asset id (compressed):", verifiedId);
  // eslint-disable-next-line no-console
  console.log("Metadata URI:", uri);
  // eslint-disable-next-line no-console
  console.log("Leaf owner:", leafOwner.toString());
  // eslint-disable-next-line no-console
  console.log(
    "\nRegister in API: POST /v1/admin/tokens with chain=solana, mint_or_contract=" +
      verifiedId +
      ', token_id="0", immutable_dna: { ... }'
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
