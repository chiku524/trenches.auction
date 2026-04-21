import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import type { Cluster } from "./env.js";

export type CnftConfig = {
  cluster: Cluster;
  rpcUrl: string;
  merkleTree: string;
  maxDepth: number;
  maxBufferSize: number;
  canopyDepth: number;
  /** Bubblegum: when true, anyone can mint to the tree */
  treePublic: boolean;
  createdAt: string;
};

const DEFAULT_NAME = "cnft-config.json";

export function configPath(): string {
  return resolve(process.cwd(), process.env.CNFT_CONFIG ?? DEFAULT_NAME);
}

export function readConfig(): CnftConfig {
  const p = configPath();
  if (!existsSync(p)) {
    throw new Error(`Missing ${p}. Run: npm run create-tree`);
  }
  return JSON.parse(readFileSync(p, "utf8")) as CnftConfig;
}

export function writeConfig(c: CnftConfig): void {
  writeFileSync(configPath(), JSON.stringify(c, null, 2) + "\n", "utf8");
}
