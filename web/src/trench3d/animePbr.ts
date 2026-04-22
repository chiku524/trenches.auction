import * as THREE from "three";
import type { CnftArtPalette } from "@trenches/cnft-shared";
import type { MeshPhysicalMaterialParameters } from "three";

/** Game-style skin: clearcoat + sheen (toon-adjacent) with physical response. */
export function animeSkinPhysicalProps(
  p: CnftArtPalette,
  L: number,
  opts?: { emissiveBoost?: number; roughness?: number; metalness?: number }
): MeshPhysicalMaterialParameters {
  const emB = opts?.emissiveBoost ?? 1;
  const rough = opts?.roughness ?? 0.4;
  const metal = opts?.metalness ?? 0.12;
  return {
    color: new THREE.Color(p.skin),
    emissive: new THREE.Color(p.biolume),
    emissiveIntensity: (0.04 + (L / 22) * 0.38) * emB,
    metalness: metal,
    roughness: rough,
    clearcoat: 0.4,
    clearcoatRoughness: 0.26,
    sheen: 0.7,
    sheenRoughness: 0.38,
    sheenColor: new THREE.Color(p.skinHi),
    envMapIntensity: 0.95,
  };
}

export function animeGlassProps(p: CnftArtPalette, L: number): MeshPhysicalMaterialParameters {
  return {
    color: new THREE.Color(p.skin),
    emissive: new THREE.Color(p.biolume),
    emissiveIntensity: 0.06 + (L / 22) * 0.2,
    metalness: 0.48,
    roughness: 0.18,
    transmission: 0.12,
    thickness: 0.4,
    clearcoat: 0.55,
    clearcoatRoughness: 0.18,
    sheen: 0.35,
    sheenColor: new THREE.Color(p.skinHi),
    transparent: true,
    opacity: 0.94,
    envMapIntensity: 1.1,
  };
}
