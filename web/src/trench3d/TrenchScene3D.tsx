import { useLayoutEffect, useMemo } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { Environment, Float, OrbitControls, RandomizedLight, Sparkles } from "@react-three/drei";
import * as THREE from "three";
import {
  getArtVisualTraits,
  getBiomePalette,
  getLuminosityL,
  getSpeciesArchetypeIndex,
} from "@trenches/cnft-shared";
import type { Dna } from "../types";
import { CreatureByArchetype } from "./CreatureByArchetype";
import { sceneFromPalette } from "./paletteScene";

function UnderwaterFog({ color, density }: { color: number; density: number }) {
  const { scene } = useThree();
  useLayoutEffect(() => {
    const prev = scene.fog;
    scene.fog = new THREE.FogExp2(color, density);
    return () => {
      scene.fog = prev;
    };
  }, [scene, color, density]);
  return null;
}

function TrenchSceneContent({ dna, mint }: { dna: Dna; mint: string }) {
  const biome = typeof dna["Biome"] === "string" ? dna["Biome"] : "";
  const palette = useMemo(() => getBiomePalette(biome, mint), [biome, mint]);
  const L = useMemo(() => getLuminosityL(dna), [dna]);
  const traits = useMemo(() => getArtVisualTraits(dna, mint, L), [dna, mint, L]);
  const archetype = useMemo(
    () => getSpeciesArchetypeIndex(dna["Species"] as string | undefined, mint),
    [dna, mint]
  );
  const env = useMemo(() => sceneFromPalette(palette), [palette]);
  const deepHex = new THREE.Color(palette.deep);

  return (
    <>
      <color attach="background" args={[deepHex]} />
      <UnderwaterFog color={env.fogHex} density={env.fogDensity} />
      <Environment preset="city" environmentIntensity={0.4} background={false} />
      <ambientLight intensity={0.32} color="#8ec0d0" />
      <directionalLight position={[2.2, 3.0, 2.0]} intensity={0.75} color="#e8f4ff" />
      <directionalLight
        position={[-2, 1, -0.5]}
        intensity={0.25}
        color={palette.water}
      />
      <RandomizedLight amount={0.45} position={[0, 2, 1.2]} />
      <hemisphereLight
        color={env.hemisphereTop}
        groundColor={env.hemisphereGround}
        intensity={0.28}
      />
      <pointLight position={[-1.2, 0.5, 1.5]} color={palette.skinHi} intensity={0.35} distance={6} />
      <pointLight position={[1.0, 0, -1.2]} color={palette.biolume} intensity={0.2} distance={5} />
      <Sparkles
        count={60}
        scale={8}
        size={1.0}
        speed={0.2}
        opacity={0.32}
        color={env.particleColor}
      />
      <Float speed={1.1} rotationIntensity={0.18} floatIntensity={0.32}>
        <CreatureByArchetype
          mint={mint}
          palette={palette}
          traits={traits}
          archetype={archetype}
        />
      </Float>
      <OrbitControls
        makeDefault
        enablePan={false}
        minDistance={1.2}
        maxDistance={4.2}
        minPolarAngle={0.5}
        maxPolarAngle={2.1}
      />
    </>
  );
}

export function TrenchScene3D({ dna, mint, name }: { dna: Dna; mint: string; name: string }) {
  const biome = typeof dna["Biome"] === "string" ? dna["Biome"] : "";
  const palette = useMemo(() => getBiomePalette(biome, mint), [biome, mint]);
  const env = useMemo(() => sceneFromPalette(palette), [palette]);

  return (
    <div style={{ width: "100%", height: "min(85vh, 720px)", minHeight: 400, position: "relative" }}>
      <Canvas
        camera={{ fov: 45, position: [0, 0.1, 2.8], near: 0.1, far: 60 }}
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: false, powerPreference: "high-performance" }}
      >
        <TrenchSceneContent dna={dna} mint={mint} />
      </Canvas>
      <div
        style={{
          position: "absolute",
          left: 12,
          bottom: 10,
          right: 12,
          color: "rgba(226,232,240,0.88)",
          fontSize: 12,
          pointerEvents: "none",
        }}
      >
        <strong style={{ color: env.labelAccent }}>{name}</strong> — drag to rotate · scroll to zoom · 3D matches preview DNA palette & species
      </div>
    </div>
  );
}
