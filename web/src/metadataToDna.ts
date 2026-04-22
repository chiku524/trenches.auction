import type { Dna } from "./types";

type Attr = { trait_type?: string; value?: string | number };

/** Metaplex-style attributes array → simple DNA map (server + on-chain off-chain). */
export function attributesToDna(raw: { attributes?: Attr[] } | null): Dna {
  const out: Dna = {};
  const list = raw?.attributes;
  if (!Array.isArray(list)) return out;
  for (const a of list) {
    if (!a?.trait_type) continue;
    const v = a.value;
    if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") {
      out[a.trait_type] = v;
    }
  }
  return out;
}
