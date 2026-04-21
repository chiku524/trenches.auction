import { PublicKey } from "@solana/web3.js";
import bs58 from "bs58";
import nacl from "tweetnacl";

export const MINT_CHALLENGE_PREFIX = "trenches.auction:mint:";

export function parseChallengeTimestamp(message: string): number | null {
  if (!message.startsWith(MINT_CHALLENGE_PREFIX)) return null;
  const ts = Number(message.slice(MINT_CHALLENGE_PREFIX.length));
  return Number.isFinite(ts) ? ts : null;
}

export function isChallengeFresh(timestampMs: number, nowMs: number, maxAgeMs: number): boolean {
  const age = nowMs - timestampMs;
  return age >= 0 && age <= maxAgeMs;
}

export async function sha256Hex(text: string): Promise<string> {
  const buf = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function verifyWalletSignMessage(recipient: string, message: string, signatureBase58: string): boolean {
  try {
    const pubkey = new PublicKey(recipient).toBytes();
    const sig = bs58.decode(signatureBase58);
    const msg = new TextEncoder().encode(message);
    return sig.length === 64 && nacl.sign.detached.verify(msg, sig, pubkey);
  } catch {
    return false;
  }
}
