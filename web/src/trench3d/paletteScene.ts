import * as THREE from "three";
import type { CnftArtPalette } from "@trenches/cnft-shared";

/**
 * Per-mint variety for fog, particles, and rim light without breaking palette DNA sync.
 * `varietySeed` should be stable per mint (e.g. `hash32(mint)`).
 */
export type BiomeSceneEnv = {
  background: THREE.Color;
  fogHex: number;
  fogDensity: number;
  particleColor: string;
  labelAccent: string;
  hemisphereTop: string;
  hemisphereGround: string;
  causticWarmth: number;
  sparkles: number;
  sparkleSpeed: number;
  envIntensity: number;
  ambient: number;
  rimX: number;
};

export function sceneFromPalette(p: CnftArtPalette, varietySeed = 0): BiomeSceneEnv {
  const deep = new THREE.Color(p.deep);
  const v = varietySeed % 1_000;
  return {
    background: deep,
    /** Exp fog — slightly different density per asset for depth variety. */
    fogHex: new THREE.Color(p.deep).lerp(new THREE.Color(p.water), 0.22).getHex() as number,
    fogDensity: 0.034 + (v % 9) * 0.006,
    particleColor: p.biolume,
    labelAccent: p.skinHi,
    hemisphereTop: p.water,
    hemisphereGround: p.shadow,
    causticWarmth: 0.38 + (v % 6) * 0.04,
    sparkles: 48 + (v % 45),
    sparkleSpeed: 0.1 + (v % 6) * 0.05,
    envIntensity: 0.32 + (v % 5) * 0.04,
    ambient: 0.28 + (v % 4) * 0.03,
    rimX: 0.65 + ((v >> 3) % 5) * 0.22,
  };
}
