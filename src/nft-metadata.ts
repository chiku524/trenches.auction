import type { computeClockTraits } from "./time-traits";

export type Dna = Record<string, string | number | boolean>;
export type DynamicState = Record<string, unknown>;

type ClockTraits = ReturnType<typeof computeClockTraits>;

export function buildMetaplexStyleJson(input: {
  name: string;
  description: string;
  imageUrl: string;
  animationUrl?: string;
  externalUrl?: string;
  immutable: Dna;
  dynamic: DynamicState;
  clock: ClockTraits;
}): Record<string, unknown> {
  const attributes: { trait_type: string; value: string | number }[] = [];

  for (const [k, v] of Object.entries(input.immutable)) {
    attributes.push({ trait_type: k, value: typeof v === "string" || typeof v === "number" ? v : String(v) });
  }
  for (const [k, v] of Object.entries(input.dynamic)) {
    if (v === undefined || v === null) continue;
    attributes.push({
      trait_type: k,
      value: typeof v === "string" || typeof v === "number" ? v : JSON.stringify(v),
    });
  }

  attributes.push(
    { trait_type: "Lunar Phase", value: input.clock.lunar_phase },
    { trait_type: "Time of Day", value: input.clock.time_of_day },
    { trait_type: "Clock (UTC)", value: input.clock.clock_iso }
  );

  return {
    name: input.name,
    description: input.description,
    image: input.imageUrl,
    animation_url: input.animationUrl ?? null,
    external_url: input.externalUrl ?? null,
    attributes,
    properties: {
      category: "image",
      files: [
        { uri: input.imageUrl, type: "image/png" },
        ...(input.animationUrl ? [{ uri: input.animationUrl, type: "text/html" }] : []),
      ],
    },
  };
}
