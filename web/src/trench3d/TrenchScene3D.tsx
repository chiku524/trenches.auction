import { useLayoutEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { ContactShadows, Environment, Float, OrbitControls, RandomizedLight, Sparkles } from "@react-three/drei";
import * as THREE from "three";
import {
  getArtVisualTraits,
  getBiomePalette,
  getLuminosityL,
  getSpeciesArchetypeIndex,
  hash32,
} from "@trenches/cnft-shared";
import type { Dna } from "../types";
import { CreatureByArchetype } from "./CreatureByArchetype";
import { sceneFromPalette } from "./paletteScene";

function CausticShimmer({ color, phase, warmth }: { color: string; phase: number; warmth: number }) {
  const ref = useRef<THREE.PointLight | null>(null);
  useFrame((state) => {
    const t = state.clock.elapsedTime * (0.62 + warmth * 0.08) + phase;
    const L = ref.current;
    if (!L) return;
    L.intensity = 0.1 + Math.sin(t * 1.05) * 0.16;
    L.position.set(Math.sin(t * 0.82) * 1.5, 1.15 + Math.sin(t * 0.38) * 0.18, 0.75 + Math.cos(t * 0.5) * 0.4);
  });
  return <pointLight ref={ref} distance={10} decay={2} color={color} />;
}

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
  const varietySeed = useMemo(() => hash32(`${mint}::scene`), [mint]);
  const env = useMemo(() => sceneFromPalette(palette, varietySeed), [palette, varietySeed]);
  const deepHex = new THREE.Color(palette.deep);
  const causticPhase = useMemo(() => (hash32(`${mint}::caustic`) % 1000) / 100, [mint]);

  return (
    <>
      <color attach="background" args={[deepHex]} />
      <UnderwaterFog color={env.fogHex} density={env.fogDensity} />
      <Environment preset="city" environmentIntensity={env.envIntensity} background={false} />
      <ambientLight intensity={env.ambient} color="#9ad0e0" />
      <directionalLight position={[2.2 * env.rimX, 3.0, 2.0]} intensity={0.78} color="#e8f4ff" />
      <directionalLight
        position={[-2, 0.6, -0.4]}
        intensity={0.22}
        color={palette.water}
      />
      <RandomizedLight amount={0.5} position={[0, 2, 1.2]} />
      <hemisphereLight
        color={env.hemisphereTop}
        groundColor={env.hemisphereGround}
        intensity={0.3}
      />
      <CausticShimmer color={palette.skinHi} phase={causticPhase} warmth={env.causticWarmth} />
      <pointLight position={[-1.2, 0.5, 1.5]} color={palette.skinHi} intensity={0.38} distance={7} />
      <pointLight position={[1.0, 0, -1.2]} color={palette.biolume} intensity={0.24} distance={5.5} />
      <Sparkles
        count={env.sparkles}
        scale={8.5}
        size={1.15}
        speed={env.sparkleSpeed}
        opacity={0.36}
        color={env.particleColor}
      />
      <Float speed={0.85} rotationIntensity={0.07} floatIntensity={0.2}>
        <CreatureByArchetype
          mint={mint}
          palette={palette}
          traits={traits}
          archetype={archetype}
        />
      </Float>
      <ContactShadows
        position={[0, -0.92, 0]}
        scale={12}
        opacity={0.48}
        blur={2.4}
        far={3.8}
        color={palette.deep}
        resolution={512}
        frames={Infinity}
      />
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
  const env = useMemo(() => sceneFromPalette(palette, hash32(`${mint}::scene`)), [palette, mint]);

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
        <strong style={{ color: env.labelAccent }}>{name}</strong> — drag to rotate · scroll to zoom · animated swim & lighting (DNA: palette, species, traits)
      </div>
    </div>
  );
}
