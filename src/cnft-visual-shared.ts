import { hash32, LEGACY_SPECIES_INDEX, SPECIES } from "./collection-traits";

export { hash32 } from "./collection-traits";
import type { Dna } from "./nft-metadata";

export type { Dna } from "./nft-metadata";

const SPECIES_LIST: readonly string[] = SPECIES;

/**
 * Color stops shared by SVG preview and WebGL viewer so both stay visually aligned
 * (biome + mint-driven fallback).
 */
export type CnftArtPalette = {
  deep: string;
  water: string;
  skin: string;
  skinHi: string;
  biolume: string;
  shadow: string;
};

export function getBiomePalette(biome: string, mint: string): CnftArtPalette {
  const b = (biome || "").toLowerCase();
  const s = (a: string, c: string, w: string, h: string, l: string, sh: string): CnftArtPalette => ({
    deep: a,
    water: c,
    skin: w,
    skinHi: h,
    biolume: l,
    shadow: sh,
  });
  /* Pokémon-card read: slightly higher chroma on skin + accent for clear silhouettes. */
  if (b.includes("hydrothermal") || b.includes("fan")) {
    return s("#150810", "#3d1510", "#7a3828", "#c06a45", "#ffc266", "#0a0406");
  }
  if (b.includes("kelp") || b.includes("forest")) {
    return s("#031c18", "#0a5c4a", "#148a72", "#4af0c8", "#9ffff0", "#021210");
  }
  if (b.includes("brine")) {
    return s("#031428", "#0d5278", "#2288a8", "#a6e0ff", "#5ad4ff", "#010a12");
  }
  if (b.includes("seamount")) {
    return s("#0a1528", "#264572", "#4a6a92", "#d0e8ff", "#ffe08a", "#070f1a");
  }
  if (b.includes("canyon") || b.includes("phantom")) {
    return s("#0e0a1c", "#2a2060", "#5c48a0", "#d0b8ff", "#f0d0ff", "#06030f");
  }
  if (b.includes("trenches") || b.includes("wall")) {
    return s("#01040c", "#0b1628", "#3a5570", "#a8c0d8", "#8ef8ff", "#000208");
  }
  if (b.includes("seep") || b.includes("cold")) {
    return s("#0a1a24", "#1a5568", "#2a8aa5", "#b0f8ff", "#e0ffff", "#030d14");
  }
  const h = hash32(mint + "::palette");
  const hue = 200 + (h % 20);
  return s(
    `hsl(${hue} 56% 8%)`,
    `hsl(${hue} 48% 16%)`,
    `hsl(${(hue + 6) % 360} 46% 38%)`,
    `hsl(${(hue + 12) % 360} 52% 56%)`,
    `hsl(${(hue + 185) % 360} 82% 62%)`,
    "hsl(222 36% 6%)"
  );
}

function numDna(dna: Dna, key: string, def: number, min: number, max: number): number {
  const v = dna[key];
  if (typeof v === "number" && !Number.isNaN(v)) return Math.max(min, Math.min(max, v));
  return def;
}

/** Same 0..7 index as `bodyFor` in `cnft-creature-art` (per species, else hash). */
export function getSpeciesArchetypeIndex(species: string | undefined, mint: string): number {
  const s = species ?? "";
  const i = SPECIES_LIST.indexOf(s);
  if (i >= 0) return i;
  const legacy = LEGACY_SPECIES_INDEX[s];
  if (legacy !== undefined) return legacy;
  return hash32(mint) % 8;
}

/** Luminosity scalar as used by SVG (≈0–10). */
export function getLuminosityL(dna: Dna): number {
  const lr = dna["Luminosity"];
  if (typeof lr === "number" && !Number.isNaN(lr)) {
    return lr > 1.01 ? Math.min(10, lr) : lr * 10;
  }
  return 5;
}

export type CnftMoodT = {
  dy: number;
  rot: number;
  sc: number;
  tentacleK: number;
  finSpread: number;
};

export function getMoodLayout(mood: string): CnftMoodT {
  const m = (mood || "").toLowerCase();
  if (m.includes("ambush") || m.includes("lie-in")) return { dy: 10, rot: 0, sc: 0.96, tentacleK: 0.88, finSpread: 0.92 };
  if (m.includes("drift") || m.includes("passive")) return { dy: 0, rot: -5, sc: 1, tentacleK: 1.18, finSpread: 1.12 };
  if (m.includes("jet") || m.includes("escape")) return { dy: -6, rot: 3, sc: 1.03, tentacleK: 1.25, finSpread: 1.08 };
  if (m.includes("cryptic") || m.includes("camou")) return { dy: 4, rot: 0, sc: 0.99, tentacleK: 0.88, finSpread: 0.9 };
  if (m.includes("forag") || m.includes("benthic f")) return { dy: 6, rot: 4, sc: 1, tentacleK: 1, finSpread: 1.04 };
  if (m.includes("cruis") || m.includes("substrate")) return { dy: 0, rot: 0, sc: 1, tentacleK: 1, finSpread: 1 };
  if (m.includes("diel") || m.includes("vertical d")) return { dy: 0, rot: 6, sc: 1, tentacleK: 1.06, finSpread: 1.02 };
  if (m.includes("rheo") || m.includes("station") || m.includes("keeping")) {
    return { dy: 0, rot: 0, sc: 0.99, tentacleK: 0.92, finSpread: 0.95 };
  }
  if (m.includes("plankton")) return { dy: -2, rot: -3, sc: 1.01, tentacleK: 1.1, finSpread: 1.06 };
  return { dy: 0, rot: 0, sc: 1, tentacleK: 1, finSpread: 1 };
}

export type CnftArtVisualTraits = {
  pressure: number;
  L: number;
  mood: string;
  variantSeed: number;
  /** Slight per-mint eye size (monster “face” read; SVG + 3D). */
  eyeScale: number;
  moodT: CnftMoodT;
};

export function getArtVisualTraits(dna: Dna, mint: string, L: number): CnftArtVisualTraits {
  const pressure = Math.floor(numDna(dna, "Pressure Class", 5, 1, 10));
  const mood = typeof dna.Mood === "string" ? dna.Mood : "Cruising";
  const vs = typeof dna["Variant Seed"] === "number" ? dna["Variant Seed"] : hash32(mint) % 1_000_000;
  const eyeScale = 0.94 + ((vs % 29) / 29) * 0.16;
  return { pressure, L, mood, variantSeed: vs, eyeScale, moodT: getMoodLayout(mood) };
}
