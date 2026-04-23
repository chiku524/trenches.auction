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
  /* Game-figure palette: punchy midtones + clear highlight for cel reads. */
  if (b.includes("hydrothermal") || b.includes("fan")) {
    return s("#12060a", "#421a12", "#884030", "#d88855", "#ffd080", "#080204");
  }
  if (b.includes("kelp") || b.includes("forest")) {
    return s("#021810", "#0c6a52", "#18a888", "#58ffd8", "#b8fff0", "#01140c");
  }
  if (b.includes("brine")) {
    return s("#021228", "#1068a0", "#2a98c0", "#b8f0ff", "#70e0ff", "#000a12");
  }
  if (b.includes("seamount")) {
    return s("#081830", "#305888", "#5880b0", "#e0f4ff", "#fff0a0", "#050c18");
  }
  if (b.includes("canyon") || b.includes("phantom")) {
    return s("#0c0818", "#342470", "#7058c0", "#e0d0ff", "#f8e0ff", "#040210");
  }
  if (b.includes("trenches") || b.includes("wall")) {
    return s("#00040a", "#0c1a30", "#456890", "#c0d8f0", "#a0ffff", "#000004");
  }
  if (b.includes("seep") || b.includes("cold")) {
    return s("#081820", "#206878", "#38a8c8", "#c8ffff", "#f0ffff", "#020c10");
  }
  const h = hash32(mint + "::palette");
  const hue = 200 + (h % 20);
  return s(
    `hsl(${hue} 58% 9%)`,
    `hsl(${hue} 50% 18%)`,
    `hsl(${(hue + 6) % 360} 50% 42%)`,
    `hsl(${(hue + 12) % 360} 58% 60%)`,
    `hsl(${(hue + 185) % 360} 88% 66%)`,
    "hsl(222 40% 5%)"
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
  /** 3D motion: swim cadence (unitless multiplier). */
  swimSpeed: number;
  /** Phase offset so identical species don’t move in lockstep. */
  idlePhase: number;
  /** Vertical secondary bob amplitude (world-ish units at creature scale). */
  breathAmp: number;
  /** Fin / appendage flutter strength. */
  finFlap: number;
  /** Subtle roll / bank (radians scale). */
  bankAmp: number;
  moodT: CnftMoodT;
};

export function getArtVisualTraits(dna: Dna, mint: string, L: number): CnftArtVisualTraits {
  const pressure = Math.floor(numDna(dna, "Pressure Class", 5, 1, 10));
  const mood = typeof dna.Mood === "string" ? dna.Mood : "Cruising";
  const vs = typeof dna["Variant Seed"] === "number" ? dna["Variant Seed"] : hash32(mint) % 1_000_000;
  const eyeScale = 0.94 + ((vs % 29) / 29) * 0.16;
  const swimSpeed = 0.86 + ((vs % 19) / 19) * 0.32;
  const idlePhase = ((vs % 628) / 628) * Math.PI * 2;
  const breathAmp = 0.05 + ((vs >> 2) % 12) / 110;
  const finFlap = 0.13 + ((vs >> 5) % 18) / 45;
  const bankAmp = 0.04 + ((vs >> 8) % 10) / 180;
  return {
    pressure,
    L,
    mood,
    variantSeed: vs,
    eyeScale,
    swimSpeed,
    idlePhase,
    breathAmp,
    finFlap,
    bankAmp,
    moodT: getMoodLayout(mood),
  };
}
