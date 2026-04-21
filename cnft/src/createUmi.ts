import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { createSignerFromKeypair, keypairIdentity, type Umi } from "@metaplex-foundation/umi";
import { fromWeb3JsKeypair } from "@metaplex-foundation/umi-web3js-adapters";
import { mplBubblegum } from "@metaplex-foundation/mpl-bubblegum";
import type { Keypair as Web3Keypair } from "@solana/web3.js";
import { getRpcUrl } from "./env.js";

export function createTrenchesUmi(feePayer: Web3Keypair): Umi {
  const umi = createUmi(getRpcUrl()).use(mplBubblegum());
  const kp = fromWeb3JsKeypair(feePayer);
  const signer = createSignerFromKeypair(umi, kp);
  umi.use(keypairIdentity(signer));
  return umi;
}
