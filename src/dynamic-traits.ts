import { hash32 } from "./collection-traits";
import type { Dna, DynamicState } from "./nft-metadata";
import { computeClockTraits } from "./time-traits";

const FORAGING = ["Benthic scraper", "Pelagic drift", "Scavenger circuit", "Ambush idle"] as const;
const SOCIAL = ["Solo", "Pair-bonded", "Loose school", "Nomad"] as const;
const SEASON = [
  "Verdant upwelling",
  "Storm surge season",
  "Still water window",
  "Deep mixing arc",
] as const;
const PHOTIC = [
  "Sunlit column",
  "Twilight fringe",
  "Midnight zone",
  "Aphotic trench",
] as const;
const SOLUNAR = ["Peak window", "Rising edge", "Quiet interval", "Surge overlap"] as const;
const PULSE = ["Whisper", "Steady", "Thrum", "Surge"] as const;

function dayOfYearUtc(d: Date): number {
  const start = Date.UTC(d.getUTCFullYear(), 0, 0);
  return Math.floor((d.getTime() - start) / 86400000);
}

/**
 * Default stored dynamic state for a newly registered token (D1 `dynamic_state`).
 * These are meant to change over time via PATCH /v1/admin/tokens/:id/state.
 */
export function defaultStoredDynamicState(assetId: string, dna: Dna): DynamicState {
  const h = hash32(`${assetId}:dynamic`);
  const h2 = hash32(`${assetId}:social`);
  const pressure = typeof dna["Pressure Class"] === "number" ? dna["Pressure Class"] : (h % 10) + 1;
  return {
    Vitality: 52 + (h % 48),
    "Foraging posture": FORAGING[h % FORAGING.length],
    "Social signal": SOCIAL[h2 % SOCIAL.length],
    "Quirk score": (h ^ h2) % 100,
    "Pressure echo": Math.min(11, Math.max(1, Math.round(pressure + (h % 3) - 1))),
  };
}

/**
 * Request-time traits (not stored in D1): clock, environment, and mint-tinted variation.
 * Merged into Metaplex `attributes` after immutable + stored dynamic rows.
 */
export function computeLiveMetadataTraits(
  now: Date,
  input: { assetId: string; immutable: Dna }
): Record<string, string | number> {
  const clock = computeClockTraits(now);
  const h = hash32(`${input.assetId}:live:${now.toISOString().slice(0, 13)}`);
  const hDay = hash32(`${input.assetId}:day:${dayOfYearUtc(now)}`);
  const minute = now.getUTCMinutes() + now.getUTCHours() * 60;

  const photicIdx =
    now.getUTCHours() >= 10 && now.getUTCHours() < 15
      ? 0
      : now.getUTCHours() >= 15 && now.getUTCHours() < 19
        ? 1
        : now.getUTCHours() >= 19 && now.getUTCHours() < 23
          ? 2
          : 3;

  const tidePull = Math.round(
    (() => {
      const knownNew = Date.UTC(2000, 0, 6, 18, 14, 0);
      const synodic = 29.53058867 * 24 * 3600 * 1000;
      const age = ((now.getTime() - knownNew) % synodic + synodic) % synodic;
      return (age / synodic) * 100;
    })()
  );

  const season = SEASON[Math.floor(now.getUTCMonth() / 3) % SEASON.length]!;
  const solunar = SOLUNAR[(h + minute) % SOLUNAR.length]!;
  const benthicPulse = PULSE[(hDay + now.getUTCMinutes()) % PULSE.length]!;

  const species = typeof input.immutable.Species === "string" ? input.immutable.Species : "Unknown";
  const biome = typeof input.immutable.Biome === "string" ? input.immutable.Biome : "Unknown";

  const depthSimM =
    1200 + (hDay % 7000) + (typeof input.immutable["Pressure Class"] === "number" ? input.immutable["Pressure Class"] * 80 : 0);

  return {
    "Lunar Phase": clock.lunar_phase,
    "Time of Day": clock.time_of_day,
    "Clock (UTC)": clock.clock_iso,
    "Photic layer": PHOTIC[photicIdx]!,
    "Tidal pull": tidePull,
    "Season arc": season,
    "Solunar window": solunar,
    "Benthic pulse": benthicPulse,
    "Sim depth (m)": Math.min(11_000, Math.round(depthSimM)),
    "Biome readout": biome,
    "Species ping": species,
  };
}
