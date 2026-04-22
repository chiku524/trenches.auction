export type Dna = Record<string, string | number | boolean>;
export type DynamicState = Record<string, unknown>;

/** Keys in `dynamic_state` that set JSON top-level fields, not attribute rows. */
const METADATA_ONLY_STATE_KEYS = new Set([
  "description",
  "animation_url",
  "name",
  "image",
  "external_url",
]);

/** Per-request environment / clock layer (recomputed on every metadata fetch). */
export type LiveMetadataTraits = Record<string, string | number>;

export function buildMetaplexStyleJson(input: {
  name: string;
  description: string;
  imageUrl: string;
  animationUrl?: string;
  externalUrl?: string;
  immutable: Dna;
  /** Stored in D1; reserved keys are omitted from attributes (see source). */
  dynamic: DynamicState;
  /** Not stored: tide, photic band, sim depth, etc. */
  live: LiveMetadataTraits;
}): Record<string, unknown> {
  const attributes: { trait_type: string; value: string | number }[] = [];

  for (const [k, v] of Object.entries(input.immutable)) {
    attributes.push({ trait_type: k, value: typeof v === "string" || typeof v === "number" ? v : String(v) });
  }
  for (const [k, v] of Object.entries(input.dynamic)) {
    if (METADATA_ONLY_STATE_KEYS.has(k)) continue;
    if (v === undefined || v === null) continue;
    attributes.push({
      trait_type: k,
      value: typeof v === "string" || typeof v === "number" ? v : JSON.stringify(v),
    });
  }

  for (const [k, v] of Object.entries(input.live)) {
    attributes.push({ trait_type: k, value: v });
  }

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
        { uri: input.imageUrl, type: "image/*" },
        ...(input.animationUrl ? [{ uri: input.animationUrl, type: "text/html" }] : []),
      ],
    },
  };
}
