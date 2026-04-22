import * as THREE from "three";
import { hash32 } from "../hash32";

export type TrenchColors = {
  water: string;
  deep: string;
  skin: string;
  emissive: string;
  specular: string;
  fog: number;
};

const DEF: TrenchColors = {
  water: "#0a1628",
  deep: "#010409",
  skin: "#2a4a5a",
  emissive: "#1ee0d5",
  specular: "#6ee7b7",
  fog: 0x020610,
};

export function biomeToColors(biome: string | undefined, mint: string): TrenchColors {
  const b = (biome || "").toLowerCase();
  if (b.includes("hydrothermal") || b.includes("fan")) {
    return { ...DEF, water: "#1a0a0a", skin: "#4a2a1a", emissive: "#ff9f43", specular: "#fbbf24", fog: 0x0c0406 };
  }
  if (b.includes("kelp") || b.includes("forest")) {
    return { ...DEF, water: "#041a18", skin: "#0f6b52", emissive: "#4ade80", specular: "#34d399", fog: 0x03120f };
  }
  if (b.includes("brine")) {
    return { ...DEF, water: "#051428", skin: "#1a4f6a", emissive: "#38bdf8", specular: "#7dd3fc", fog: 0x040a14 };
  }
  if (b.includes("canyon") || b.includes("phantom")) {
    return { ...DEF, water: "#0a0620", skin: "#3d2a6a", emissive: "#a78bfa", specular: "#c4b5fd", fog: 0x080618 };
  }
  if (b.includes("seep") || b.includes("cold")) {
    return { ...DEF, water: "#0a1a20", skin: "#1f5f72", emissive: "#5ee7f0", specular: "#a5f3fc", fog: 0x040f18 };
  }
  const h = hash32(mint + "::3d");
  const t = (h % 360) / 360;
  return {
    ...DEF,
    water: new THREE.Color().setHSL(0.52 + t * 0.15, 0.42, 0.1).getStyle(),
    skin: new THREE.Color().setHSL(0.48 + t * 0.12, 0.4, 0.28).getStyle(),
    emissive: new THREE.Color().setHSL(0.45 + t * 0.2, 0.75, 0.48).getStyle(),
    specular: new THREE.Color().setHSL(0.5 + t * 0.1, 0.4, 0.55).getStyle(),
    fog: 0x020610,
  };
}
