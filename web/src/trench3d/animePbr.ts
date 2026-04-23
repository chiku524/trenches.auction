import * as THREE from "three";
import type { CnftArtPalette } from "@trenches/cnft-shared";
import type { MeshPhysicalMaterialParameters } from "three";

/** Game-style skin: clearcoat + sheen with physical response; optional thin-film shimmer (fish / wet). */
export function animeSkinPhysicalProps(
  p: CnftArtPalette,
  L: number,
  opts?: { emissiveBoost?: number; roughness?: number; metalness?: number; iridescent?: boolean }
): MeshPhysicalMaterialParameters {
  const emB = opts?.emissiveBoost ?? 1;
  const rough = opts?.roughness ?? 0.38;
  const metal = opts?.metalness ?? 0.12;
  const base: MeshPhysicalMaterialParameters = {
    color: new THREE.Color(p.skin),
    emissive: new THREE.Color(p.biolume),
    emissiveIntensity: (0.04 + (L / 22) * 0.38) * emB,
    metalness: metal,
    roughness: rough,
    clearcoat: 0.42,
    clearcoatRoughness: 0.24,
    sheen: 0.68,
    sheenRoughness: 0.36,
    sheenColor: new THREE.Color(p.skinHi),
    envMapIntensity: 0.98,
  };
  if (opts?.iridescent) {
    base.iridescence = 0.14 + (L / 35) * 0.2;
    base.iridescenceIOR = 1.22;
    base.iridescenceThicknessRange = [80, 420];
  }
  return base;
}

export function animeGlassProps(p: CnftArtPalette, L: number): MeshPhysicalMaterialParameters {
  return {
    color: new THREE.Color(p.skin),
    emissive: new THREE.Color(p.biolume),
    emissiveIntensity: 0.06 + (L / 22) * 0.2,
    metalness: 0.46,
    roughness: 0.16,
    transmission: 0.18,
    thickness: 0.55,
    attenuationColor: new THREE.Color(p.shadow),
    attenuationDistance: 0.85,
    clearcoat: 0.58,
    clearcoatRoughness: 0.16,
    sheen: 0.38,
    sheenColor: new THREE.Color(p.skinHi),
    transparent: true,
    opacity: 0.93,
    envMapIntensity: 1.15,
  };
}
