import "dotenv/config";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { Keypair } from "@solana/web3.js";

export type Cluster = "devnet" | "mainnet-beta";

export function getRpcUrl(): string {
  const url = process.env.RPC_URL;
  if (url) return url;
  const cluster = getCluster();
  return cluster === "mainnet-beta"
    ? "https://api.mainnet-beta.solana.com"
    : "https://api.devnet.solana.com";
}

export function getCluster(): Cluster {
  const c = process.env.CLUSTER ?? "devnet";
  if (c !== "devnet" && c !== "mainnet-beta") {
    throw new Error(`CLUSTER must be devnet or mainnet-beta, got: ${c}`);
  }
  return c;
}

export function loadFeePayerKeypair(): Keypair {
  const path = process.env.KEYPAIR_PATH;
  if (!path) {
    throw new Error("Set KEYPAIR_PATH to your Solana JSON keypair file (e.g. ~/.config/solana/id.json)");
  }
  const abs = resolve(path);
  if (!existsSync(abs)) {
    throw new Error(`KEYPAIR_PATH not found: ${abs}`);
  }
  const raw = JSON.parse(readFileSync(abs, "utf8")) as number[];
  return Keypair.fromSecretKey(Uint8Array.from(raw));
}

export function getMetadataBaseUrl(): string {
  const u = process.env.METADATA_BASE_URL ?? "https://trenches.auction";
  return u.replace(/\/$/, "");
}
