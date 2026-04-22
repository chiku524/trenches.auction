import { useLayoutEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Float, OrbitControls, RandomizedLight, Sparkles } from "@react-three/drei";
import * as THREE from "three";
import { hash32 } from "../hash32";
import type { Dna } from "../types";
import { biomeToColors } from "./biomeToColors";

const SPECIES = [
  "Lantern Gulper",
  "Glassfin Drifter",
  "Rust Mantis Shrimp",
  "Inkcloud Octoid",
  "Spineback Eel",
  "Coral Hermit",
  "Pressure Snail",
  "Echo Ray",
] as const;

function speciesIndex(dna: Dna, mint: string): number {
  const s = dna["Species"];
  if (typeof s === "string") {
    const i = (SPECIES as readonly string[]).indexOf(s);
    if (i >= 0) return i;
  }
  return hash32(mint) % SPECIES.length;
}

function num(dna: Dna, key: string, def: number, min: number, max: number): number {
  const v = dna[key];
  if (typeof v === "number" && !Number.isNaN(v)) return Math.max(min, Math.min(max, v));
  return def;
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

function TrenchCreature({ dna, mint }: { dna: Dna; mint: string }) {
  const g = useRef<THREE.Group>(null);
  const sp = speciesIndex(dna, mint);
  const pressure = num(dna, "Pressure Class", 5, 1, 10);
  const lum = num(dna, "Luminosity", 0.5, 0, 1);
  const h = hash32(mint);
  const colors = useMemo(() => biomeToColors(typeof dna["Biome"] === "string" ? dna["Biome"] : undefined, mint), [dna, mint]);
  const scale = 0.7 + (pressure / 12) * 0.5;
  const wobble = 0.35 + (h % 100) / 200;

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (!g.current) return;
    g.current.position.y = Math.sin(t * wobble) * 0.12;
    g.current.rotation.y = Math.sin(t * 0.25) * 0.2 + (h % 7) * 0.01;
    g.current.rotation.x = Math.sin(t * 0.15) * 0.06;
  });

  const emissiveStr = (intensity: number) =>
    new THREE.Color(colors.emissive).multiplyScalar(0.15 + lum * intensity).getHex();

  return (
    <Float speed={1.2} rotationIntensity={0.2} floatIntensity={0.35}>
      <group ref={g} scale={scale}>
        {sp === 0 && (
          <group>
            <mesh position={[0, 0, 0.2]}>
              <capsuleGeometry args={[0.38, 1.1, 6, 16]} />
              <meshStandardMaterial
                color={colors.skin}
                metalness={0.22}
                roughness={0.48}
                emissive={colors.emissive}
                emissiveIntensity={0.08 + lum * 0.2}
                envMapIntensity={0.4}
              />
            </mesh>
            <mesh position={[0, 0.6, 0.55]}>
              <sphereGeometry args={[0.2, 16, 12]} />
              <meshStandardMaterial
                color={colors.emissive}
                emissive={emissiveStr(1.2)}
                emissiveIntensity={0.4 + lum * 0.5}
                metalness={0.1}
                roughness={0.35}
              />
            </mesh>
            <mesh position={[0.35, -0.1, 0.2]} rotation={[0, 0, 0.5]}>
              <boxGeometry args={[0.1, 0.35, 0.5]} />
              <meshStandardMaterial color={colors.skin} metalness={0.2} roughness={0.5} />
            </mesh>
            <mesh position={[-0.35, -0.1, 0.2]} rotation={[0, 0, -0.5]}>
              <boxGeometry args={[0.1, 0.35, 0.5]} />
              <meshStandardMaterial color={colors.skin} metalness={0.2} roughness={0.5} />
            </mesh>
          </group>
        )}
        {sp === 1 && (
          <group>
            <mesh scale={[1.6, 0.5, 0.7]}>
              <sphereGeometry args={[0.55, 32, 24]} />
              <meshStandardMaterial
                color={colors.skin}
                metalness={0.45}
                roughness={0.25}
                emissive={colors.emissive}
                emissiveIntensity={0.06 + lum * 0.12}
                transparent
                opacity={0.95}
              />
            </mesh>
            <mesh position={[-0.3, 0, 0.2]}>
              <cylinderGeometry args={[0.02, 0.12, 0.4, 8]} />
              <meshStandardMaterial emissive={emissiveStr(0.9)} emissiveIntensity={0.3} color={colors.specular} />
            </mesh>
            <mesh position={[0.3, 0, 0.2]}>
              <cylinderGeometry args={[0.02, 0.12, 0.4, 8]} />
              <meshStandardMaterial emissive={emissiveStr(0.9)} emissiveIntensity={0.3} color={colors.specular} />
            </mesh>
          </group>
        )}
        {sp === 2 && (
          <group>
            <mesh>
              <capsuleGeometry args={[0.2, 1.0, 6, 12]} />
              <meshStandardMaterial
                color={colors.skin}
                metalness={0.35}
                roughness={0.4}
                emissive={emissiveStr(0.5)}
                emissiveIntensity={0.1}
              />
            </mesh>
            <mesh position={[0.25, 0.2, 0.15]} rotation={[0.4, 0, 0.5]}>
              <boxGeometry args={[0.2, 0.08, 0.4]} />
              <meshStandardMaterial color="#8b4513" metalness={0.5} roughness={0.35} />
            </mesh>
            <mesh position={[-0.25, 0.2, 0.15]} rotation={[0.4, 0, -0.5]}>
              <boxGeometry args={[0.2, 0.08, 0.4]} />
              <meshStandardMaterial color="#8b4513" metalness={0.5} roughness={0.35} />
            </mesh>
          </group>
        )}
        {sp > 2 && (
          <group>
            <mesh>
              <dodecahedronGeometry args={[0.55, 1]} />
              <meshStandardMaterial
                color={colors.skin}
                flatShading
                metalness={0.18}
                roughness={0.52}
                emissive={colors.emissive}
                emissiveIntensity={0.05 + lum * 0.15}
              />
            </mesh>
            {Array.from({ length: 4 + (h % 3) }).map((_, i) => (
              <mesh
                // eslint-disable-next-line react/no-array-index-key
                key={i}
                position={[Math.sin((i / 3) * Math.PI * 2) * 0.4, 0, Math.cos((i / 3) * Math.PI * 2) * 0.35]}
              >
                <cylinderGeometry args={[0.04, 0.08, 0.5 + (i % 3) * 0.1, 6]} />
                <meshStandardMaterial
                  color={colors.skin}
                  emissive={emissiveStr(0.4)}
                  emissiveIntensity={0.1}
                />
              </mesh>
            ))}
            <mesh position={[0, 0.1, 0.45]}>
              <sphereGeometry args={[0.1, 12, 12]} />
              <meshStandardMaterial
                emissive={0xffffff}
                emissiveIntensity={0.2 + lum * 0.3}
                color="#111"
                metalness={0.1}
                roughness={0.2}
              />
            </mesh>
            <mesh position={[0, 0.1, 0.46]}>
              <sphereGeometry args={[0.04, 8, 8]} />
              <meshStandardMaterial color="#111" emissive={0x111111} emissiveIntensity={0.1} />
            </mesh>
          </group>
        )}
        <pointLight position={[0, 0.4, 0.5]} color={colors.emissive} intensity={0.5 + pressure * 0.1} distance={3} />
      </group>
    </Float>
  );
}

function Particles({ color, count }: { color: string; count: number }) {
  return (
    <Sparkles
      count={count}
      scale={8}
      size={1.2}
      speed={0.2}
      opacity={0.35}
      color={color}
    />
  );
}

export function TrenchScene3D({ dna, mint, name }: { dna: Dna; mint: string; name: string }) {
  const colors = useMemo(() => biomeToColors(typeof dna["Biome"] === "string" ? dna["Biome"] : undefined, mint), [dna, mint]);
  return (
    <div style={{ width: "100%", height: "min(85vh, 720px)", minHeight: 400, position: "relative" }}>
      <Canvas
        camera={{ fov: 45, position: [0, 0.1, 2.8], near: 0.1, far: 60 }}
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: false, powerPreference: "high-performance" }}
      >
        <color attach="background" args={[colors.deep]} />
        <UnderwaterFog color={colors.fog} density={0.05} />
        <ambientLight intensity={0.25} color="#7ab8c4" />
        <directionalLight
          position={[2, 3, 2]}
          intensity={0.6}
          color="#cfefff"
        />
        <RandomizedLight amount={0.4} position={[0, 2, 1.2]} />
        <hemisphereLight color="#0a1a2e" groundColor={colors.water} intensity={0.2} />
        <Particles color={colors.emissive} count={50} />
        <TrenchCreature dna={dna} mint={mint} />
        <OrbitControls
          makeDefault
          enablePan={false}
          minDistance={1.2}
          maxDistance={4.2}
          minPolarAngle={0.5}
          maxPolarAngle={2.1}
        />
      </Canvas>
      <div
        style={{
          position: "absolute",
          left: 12,
          bottom: 10,
          right: 12,
          color: "rgba(226,232,240,0.85)",
          fontSize: 12,
          pointerEvents: "none",
        }}
      >
        <strong style={{ color: colors.specular }}>{name}</strong> — drag to rotate · scroll to zoom · procedural 3D from DNA
      </div>
    </div>
  );
}
