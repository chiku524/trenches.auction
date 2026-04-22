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

/**
 * Trench “dex” line — Pokémon-style portmanteau names, one per 3D/SVG archetype (order is stable).
 * Legacy on-chain values are mapped in `LEGACY_SPECIES_INDEX` so previews do not change for older mints.
 */
export const SPECIES = [
  "Gulplume",
  "Driftglass",
  "Rustrant",
  "Inktopus",
  "Spineel",
  "Shellurker",
  "Abyssnail",
  "Echoray",
] as const;

/** Earlier mints may list these; index must match `SPECIES` archetype order. */
export const LEGACY_SPECIES_INDEX: Readonly<Record<string, number>> = {
  "Lantern Gulper": 0,
  "Glassfin Drifter": 1,
  "Rust Mantis Shrimp": 2,
  "Inkcloud Octoid": 3,
  "Spineback Eel": 4,
  "Coral Hermit": 5,
  "Pressure Snail": 6,
  "Echo Ray": 7,
};

/**
 * Stance / mood. Each entry embeds a keyword consumed by `getMoodLayout` (cruise, forage, jet, etc.).
 */
const MOODS = [
  "Abyss cruise (substrate prowl)",
  "Trench forage (benthic comb)",
  "Jet-burst escape (sprint away)",
  "Cryptic cloak (mimic shroud)",
  "Ambush snap (lie-in-wait pounce)",
  "Drift float (passive meander)",
  "Diel climb (vertical migration)",
  "Rheo-station (vent anchor)",
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
