/** UTC-based traits for dynamic metadata (no I/O). */

export type LunarPhase =
  | "New Moon Tide"
  | "Crescent Pull"
  | "Full Moon Surge"
  | "Eclipse Tide";

export type TimeOfDay =
  | "Dawn"
  | "Noon"
  | "Golden Dusk"
  | "Moonlit Night"
  | "Midnight Trench Glow";

function lunarPhaseFromDate(d: Date): LunarPhase {
  const knownNew = Date.UTC(2000, 0, 6, 18, 14, 0);
  const synodic = 29.53058867 * 24 * 3600 * 1000;
  const age = ((d.getTime() - knownNew) % synodic + synodic) % synodic;
  const p = age / synodic;
  if (p < 0.05 || p > 0.95) return "New Moon Tide";
  if (p < 0.22) return "Crescent Pull";
  if (p < 0.48) return "Crescent Pull";
  if (p < 0.52) return "Full Moon Surge";
  if (p < 0.78) return "Full Moon Surge";
  return "Eclipse Tide";
}

function timeOfDayFromDate(d: Date): TimeOfDay {
  const h = d.getUTCHours() + d.getUTCMinutes() / 60;
  if (h >= 5 && h < 8) return "Dawn";
  if (h >= 8 && h < 16) return "Noon";
  if (h >= 16 && h < 19) return "Golden Dusk";
  if (h >= 19 && h < 22) return "Moonlit Night";
  return "Midnight Trench Glow";
}

export function computeClockTraits(now = new Date()): {
  lunar_phase: LunarPhase;
  time_of_day: TimeOfDay;
  clock_iso: string;
} {
  return {
    lunar_phase: lunarPhaseFromDate(now),
    time_of_day: timeOfDayFromDate(now),
    clock_iso: now.toISOString(),
  };
}
