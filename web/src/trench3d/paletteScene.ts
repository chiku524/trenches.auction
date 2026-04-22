import * as THREE from "three";
import type { CnftArtPalette } from "@trenches/cnft-shared";

export function sceneFromPalette(p: CnftArtPalette) {
  const deep = new THREE.Color(p.deep);
  const water = new THREE.Color(p.water);
  return {
    background: deep,
    /** Exp fog tint — blend deep + a hint of water for underwater depth. */
    fogHex: new THREE.Color(p.deep).lerp(new THREE.Color(p.water), 0.2).getHex() as number,
    fogDensity: 0.048,
    particleColor: p.biolume,
    labelAccent: p.skinHi,
    hemisphereTop: p.water,
    hemisphereGround: p.shadow,
  };
}
