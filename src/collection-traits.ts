import type { Dna } from "./nft-metadata";

export const BIOMES = [
  "Abyssal Plain",
  "Hydrothermal Fan",
  "Kelptangle Forest",
  "Brine Pool Edge",
  "Seamount Slope",
  "Trench Wall",
  "Cold Seep Oasis",
  "Phantom Canyon",
] as const;

export const SPECIES = [
  "Lantern Gulper",
  "Glassfin Drifter",
  "Rust Mantis Shrimp",
  "Inkcloud Octoid",
  "Spineback Eel",
  "Coral Hermit",
  "Pressure Snail",
  "Echo Ray",
] as const;

const MOODS = [
  "Substrate cruise",
  "Benthic forage",
  "Escape jet",
  "Camouflage (cryptic)",
  "Lie-in-wait (ambush)",
  "Passive drift",
  "Diel vertical migration",
  "Rheotaxis (station-holding)",
] as const;

/** Deterministic FNV-1a-ish 32-bit hash for reproducible collection rolls. */
export function hash32(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Immutable DNA for Metaplex attributes. Live / time traits are added in `computeLiveMetadataTraits`. */
export function dnaForAssetId(assetId: string): Dna {
  const h = hash32(assetId);
  const h2 = hash32(`${assetId}:traits`);
  return {
    "Asset Type": "Compressed",
    Biome: BIOMES[h % BIOMES.length],
    Species: SPECIES[(h >>> 8) % SPECIES.length],
    "Pressure Class": 1 + ((h >>> 16) % 10),
    Luminosity: Math.round(((h >>> 24) % 100) / 10) / 10,
    Mood: MOODS[h2 % MOODS.length],
    "Variant Seed": (h ^ h2) % 1_000_000,
  };
}
