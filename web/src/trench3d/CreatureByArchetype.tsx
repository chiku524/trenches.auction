import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { RoundedBox } from "@react-three/drei";
import * as THREE from "three";
import { CatmullRomCurve3, LatheGeometry, TorusGeometry, TubeGeometry, Vector2, Vector3 } from "three";
import type { CnftArtPalette, CnftArtVisualTraits } from "@trenches/cnft-shared";
import { hash32 } from "@trenches/cnft-shared";
import { animeGlassProps, animeSkinPhysicalProps } from "./animePbr";

type Props = {
  palette: CnftArtPalette;
  traits: CnftArtVisualTraits;
  archetype: number;
  mint: string;
};

function eyePairProps(p: CnftArtPalette, L: number) {
  return {
    color: new THREE.Color(p.shadow),
    emissive: new THREE.Color(p.biolume),
    emissiveIntensity: 0.1 + (L / 25) * 0.45,
    metalness: 0.25,
    roughness: 0.42,
    clearcoat: 0.5,
    clearcoatRoughness: 0.22,
    sheen: 0.4,
    sheenColor: new THREE.Color(p.skinHi),
  };
}

function AnimeEyes({ p, L, x, y, z, r, sep, eyeScale = 1 }: { p: CnftArtPalette; L: number; x: number; y: number; z: number; r: number; sep: number; eyeScale?: number }) {
  const a = eyePairProps(p, L);
  const rs = r * eyeScale;
  return (
    <group position={[x, y, z]}>
      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * sep * 0.5, 0, 0.04]}>
          <sphereGeometry args={[rs, 18, 14]} />
          <meshPhysicalMaterial {...a} />
        </mesh>
      ))}
    </group>
  );
}

/** Angler: lathe-symmetric deep trunk + distensible maw, illicium, broad pectorals. */
function LanternGulper({ p, t, fs }: { p: CnftArtPalette; t: CnftArtVisualTraits; fs: number }) {
  const lure = useRef<THREE.Group>(null);
  const fins = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  const trunkGeo = useMemo(() => {
    const u = [
      new Vector2(0.04, 0),
      new Vector2(0.12, 0.12),
      new Vector2(0.26, 0.32),
      new Vector2(0.34, 0.52),
      new Vector2(0.3, 0.68),
      new Vector2(0.16, 0.82),
      new Vector2(0.05, 0.78),
    ];
    return new LatheGeometry(u, 38);
  }, []);
  useEffect(() => () => trunkGeo.dispose(), [trunkGeo]);
  useFrame((state) => {
    const cl = state.clock.elapsedTime * t.swimSpeed + t.idlePhase;
    if (lure.current) {
      lure.current.position.y = 0.38 + Math.sin(cl * 2) * 0.035;
      lure.current.rotation.z = Math.sin(cl * 1.6) * 0.1;
    }
    if (fins.current) fins.current.rotation.x = Math.sin(cl * 1.3) * t.finFlap * 0.28;
    if (body.current) body.current.rotation.x = Math.sin(cl * 0.88) * 0.04;
  });
  return (
    <group>
      <group ref={body}>
        <mesh geometry={trunkGeo} rotation={[Math.PI / 2, 0, 0]}>
          <meshPhysicalMaterial {...animeSkinPhysicalProps(p, t.L, { emissiveBoost: 1.02, iridescent: true })} />
        </mesh>
        <mesh position={[0, 0.08, 0.75]} scale={[0.5, 0.38, 0.32]}>
          <sphereGeometry args={[0.2, 16, 14]} />
          <meshPhysicalMaterial
            color={p.shadow}
            emissive={new THREE.Color(0x020408)}
            emissiveIntensity={0.2}
            roughness={0.7}
            metalness={0.05}
          />
        </mesh>
        <mesh position={[0, 0.04, 0.7]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.11, 0.018, 8, 22, Math.PI * 1.1]} />
          <meshPhysicalMaterial
            color={p.shadow}
            roughness={0.55}
            emissive={new THREE.Color(0x000000)}
            emissiveIntensity={0.01}
          />
        </mesh>
        <group ref={lure} position={[0, 0.1, 0.9]}>
          <mesh rotation={[0.3, 0, 0]}>
            <cylinderGeometry args={[0.01, 0.026, 0.45, 6]} />
            <meshPhysicalMaterial {...animeSkinPhysicalProps(p, t.L, { roughness: 0.34 })} />
          </mesh>
          <mesh position={[0, 0.24, 0.06]}>
            <sphereGeometry args={[0.1, 14, 12]} />
            <meshPhysicalMaterial {...animeSkinPhysicalProps(p, t.L, { emissiveBoost: 1.5, roughness: 0.28 })} />
          </mesh>
        </group>
        <group ref={fins} position={[0, -0.02, 0.35]} scale={[fs, 1, 1]}>
          <mesh position={[-0.3, 0, 0.1]} rotation={[0.1, 0, 0.45]}>
            <RoundedBox args={[0.2, 0.016, 0.4]} radius={0.02} smoothness={3}>
              <meshPhysicalMaterial {...animeSkinPhysicalProps(p, t.L, { metalness: 0.18, roughness: 0.38 })} />
            </RoundedBox>
          </mesh>
          <mesh position={[0.3, 0, 0.1]} rotation={[0.1, 0, -0.45]}>
            <RoundedBox args={[0.2, 0.016, 0.4]} radius={0.02} smoothness={3}>
              <meshPhysicalMaterial {...animeSkinPhysicalProps(p, t.L, { metalness: 0.18, roughness: 0.38 })} />
            </RoundedBox>
          </mesh>
        </group>
        <AnimeEyes p={p} L={t.L} x={-0.1} y={0.1} z={0.45} r={0.07} sep={0.16} eyeScale={t.eyeScale} />
      </group>
    </group>
  );
}

/** Fusiform midwater teleost: spindled lathe + forked homocercal caudal. */
function GlassfinDrifter({ p, t, fs }: { p: CnftArtPalette; t: CnftArtVisualTraits; fs: number }) {
  const tail = useRef<THREE.Group>(null);
  const dorsal = useRef<THREE.Group>(null);
  const bodyGeo = useMemo(() => {
    const u = [
      new Vector2(0.01, 0),
      new Vector2(0.12, 0.1),
      new Vector2(0.2, 0.28),
      new Vector2(0.12, 0.46),
      new Vector2(0.04, 0.52),
    ];
    return new LatheGeometry(u, 32);
  }, []);
  useEffect(() => () => bodyGeo.dispose(), [bodyGeo]);
  useFrame((state) => {
    const cl = state.clock.elapsedTime * t.swimSpeed + t.idlePhase;
    if (tail.current) tail.current.rotation.y = Math.sin(cl * 1.9) * 0.38 * t.finFlap;
    if (dorsal.current) dorsal.current.rotation.x = -0.12 + Math.sin(cl * 1.45) * 0.14 * t.finFlap;
  });
  return (
    <group>
      <group rotation={[0, Math.PI / 2, 0]}>
        <mesh geometry={bodyGeo} rotation={[Math.PI / 2, 0, 0]}>
          <meshPhysicalMaterial {...animeGlassProps(p, t.L)} />
        </mesh>
      </group>
      <group ref={dorsal} position={[0, 0.1, 0.25]} scale={[fs, 1, 1]}>
        <mesh position={[0, 0.1, 0]} rotation={[-0.2, 0, 0]}>
          <RoundedBox args={[0.08, 0.02, 0.48]} radius={0.01} smoothness={2}>
            <meshPhysicalMaterial
              color={p.skinHi}
              transparent
              opacity={0.78}
              metalness={0.35}
              roughness={0.26}
              clearcoat={0.5}
              sheen={0.52}
              sheenColor={new THREE.Color(p.skinHi)}
              envMapIntensity={0.88}
            />
          </RoundedBox>
        </mesh>
        <mesh position={[0, -0.1, 0.02]} rotation={[0.2, 0, 0]}>
          <RoundedBox args={[0.07, 0.02, 0.38]} radius={0.01} smoothness={2}>
            <meshPhysicalMaterial
              color={p.skinHi}
              transparent
              opacity={0.72}
              metalness={0.3}
              roughness={0.3}
              clearcoat={0.42}
              sheen={0.48}
              sheenColor={new THREE.Color(p.skinHi)}
              envMapIntensity={0.82}
            />
          </RoundedBox>
        </mesh>
        <group ref={tail} position={[-0.38, 0, -0.12]}>
          <mesh position={[0, 0, -0.02]} rotation={[0, 0, 0.35]}>
            <coneGeometry args={[0.1, 0.28, 3]} />
            <meshPhysicalMaterial
              color={p.skin}
              transparent
              opacity={0.8}
              metalness={0.2}
              roughness={0.34}
              sheen={0.55}
              sheenColor={new THREE.Color(p.skinHi)}
            />
          </mesh>
          <mesh position={[0, 0, -0.02]} rotation={[0, 0, -0.35]}>
            <coneGeometry args={[0.1, 0.28, 3]} />
            <meshPhysicalMaterial
              color={p.skin}
              transparent
              opacity={0.8}
              metalness={0.2}
              roughness={0.34}
              sheen={0.55}
              sheenColor={new THREE.Color(p.skinHi)}
            />
          </mesh>
        </group>
        <mesh position={[0.2, 0, 0.1]}>
          <sphereGeometry args={[0.1, 12, 10]} />
          <meshPhysicalMaterial
            color={p.skin}
            emissive={new THREE.Color(p.biolume)}
            emissiveIntensity={0.02}
            roughness={0.45}
            metalness={0.15}
          />
        </mesh>
      </group>
      <AnimeEyes p={p} L={t.L} x={-0.02} y={0.05} z={0.32} r={0.05} sep={0.12} eyeScale={t.eyeScale} />
    </group>
  );
}

/** Stomatopod: armored carapace, segmented pleon, smashing vs spearing raptorials, rostrum, tail fan. */
function MantisShrimp({ p, t, segs, mint }: { p: CnftArtPalette; t: CnftArtVisualTraits; segs: number; mint: string }) {
  const w = 0.11;
  const clawL = useRef<THREE.Group>(null);
  const clawR = useRef<THREE.Group>(null);
  const rostrum = useRef<THREE.Group>(null);
  useFrame((state) => {
    const cl = state.clock.elapsedTime * t.swimSpeed + t.idlePhase;
    const f = t.finFlap;
    if (clawL.current) clawL.current.rotation.z = 0.45 + Math.sin(cl * 2.1) * 0.38 * f;
    if (clawR.current) clawR.current.rotation.z = -0.35 + Math.sin(cl * 2.1 + 0.7) * 0.22 * f;
    if (rostrum.current) rostrum.current.rotation.y = Math.sin(cl * 0.8) * 0.05;
  });
  return (
    <group>
      <group ref={rostrum} position={[-0.42, 0.04, 0.12]}>
        <mesh rotation={[0.1, 0, 0.15]}>
          <coneGeometry args={[0.05, 0.24, 6]} />
          <meshPhysicalMaterial {...animeSkinPhysicalProps(p, t.L, { metalness: 0.25, iridescent: true })} />
        </mesh>
      </group>
      <mesh position={[-0.15, 0, 0.1]} rotation={[0, 0, 0.08]}>
        <RoundedBox args={[0.36, 0.12, 0.22]} radius={0.03} smoothness={3}>
          <meshPhysicalMaterial {...animeSkinPhysicalProps(p, t.L, { metalness: 0.22, iridescent: true })} />
        </RoundedBox>
      </mesh>
      {Array.from({ length: segs }, (_, s) => {
        const x = (s - (segs - 1) / 2) * w * 1.05;
        const j = (hash32(mint + `seg${s}`) % 5) / 500;
        return (
          <mesh
            // eslint-disable-next-line react/no-array-index-key
            key={s}
            position={[x, -0.02 + j, 0.02]}
            rotation={[0, 0, 0.02 * s]}
          >
            <RoundedBox args={[w * 0.95, 0.14, 0.16]} radius={0.02} smoothness={2}>
              <meshPhysicalMaterial
                {...animeSkinPhysicalProps(p, t.L, { emissiveBoost: 0.9, roughness: 0.4, iridescent: true })}
              />
            </RoundedBox>
          </mesh>
        );
      })}
      <group ref={clawL} position={[-0.52, 0.04, 0.18]} rotation={[0.4, 0, 0.25]}>
        <mesh>
          <cylinderGeometry args={[0.04, 0.03, 0.2, 6]} />
          <meshPhysicalMaterial
            color={p.shadow}
            metalness={0.38}
            roughness={0.38}
            emissive={new THREE.Color(p.biolume)}
            emissiveIntensity={0.09 + t.L / 28}
            clearcoat={0.28}
          />
        </mesh>
        <mesh position={[-0.12, 0, 0.06]} rotation={[0, 0, 0.5]}>
          <RoundedBox args={[0.1, 0.05, 0.14]} radius={0.015} smoothness={2}>
            <meshPhysicalMaterial
              color={p.shadow}
              metalness={0.4}
              emissive={new THREE.Color(p.biolume)}
              emissiveIntensity={0.08 + t.L / 32}
            />
          </RoundedBox>
        </mesh>
        <mesh position={[-0.2, 0, 0.1]} rotation={[0.15, 0, 0.6]}>
          <boxGeometry args={[0.12, 0.04, 0.1]} />
          <meshPhysicalMaterial
            color={p.shadow}
            metalness={0.42}
            roughness={0.35}
            emissive={new THREE.Color(p.biolume)}
            emissiveIntensity={0.1}
          />
        </mesh>
      </group>
      <group ref={clawR} position={[0.46, 0, 0.15]} rotation={[0.45, 0, -0.2]}>
        <mesh>
          <cylinderGeometry args={[0.032, 0.026, 0.16, 6]} />
          <meshPhysicalMaterial
            color={p.shadow}
            metalness={0.32}
            emissive={new THREE.Color(p.biolume)}
            emissiveIntensity={0.07 + t.L / 30}
          />
        </mesh>
        <mesh position={[0.1, 0, 0.04]} rotation={[0, 0, -0.35]}>
          <boxGeometry args={[0.1, 0.035, 0.1]} />
          <meshPhysicalMaterial
            color={p.shadow}
            metalness={0.34}
            roughness={0.4}
            emissive={new THREE.Color(p.biolume)}
            emissiveIntensity={0.07}
          />
        </mesh>
      </group>
      <group position={[((segs - 1) / 2) * w * 1.05 + 0.12, 0, 0.04]}>
        <mesh>
          <coneGeometry args={[0.09, 0.16, 4]} />
          <meshPhysicalMaterial
            color={p.shadow}
            emissive={new THREE.Color(p.biolume)}
            emissiveIntensity={0.05 + t.L * 0.01}
            roughness={0.5}
            metalness={0.15}
            transparent
            opacity={0.85}
          />
        </mesh>
      </group>
      <AnimeEyes p={p} L={t.L} x={-0.35} y={0.1} z={0.2} r={0.05} sep={0.1} eyeScale={t.eyeScale} />
    </group>
  );
}

/** Cephalopod: ovoid mantle, hyponome siphon, eight muscular arms with dextral curves. */
function Octoid({ p, t, mint }: { p: CnftArtPalette; t: CnftArtVisualTraits; mint: string }) {
  const k = t.moodT.tentacleK;
  const armRefs = useRef<(THREE.Group | null)[]>([]);
  const mantle = useRef<THREE.Group>(null);
  useFrame((state) => {
    const cl = state.clock.elapsedTime * t.swimSpeed + t.idlePhase;
    for (let i = 0; i < armRefs.current.length; i++) {
      const g = armRefs.current[i];
      if (!g) continue;
      const a = (i / 8) * Math.PI * 2;
      g.rotation.x = Math.sin(cl * 1.15 + a) * 0.18 * t.finFlap;
      g.rotation.y = Math.cos(cl * 0.9 + a * 1.1) * 0.1;
    }
    if (mantle.current) mantle.current.rotation.x = 0.08 + Math.sin(cl * 0.5) * 0.03;
  });
  const geoms = useMemo(() => {
    const ge: TubeGeometry[] = [];
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const h = hash32(mint + `oct${i}`) / 2 ** 32;
      const L = 0.38 * k;
      const c = Math.cos(a);
      const s = Math.sin(a);
      const r0 = 0.15;
      const r1 = 0.22 + L;
      const r2 = 0.32 + L * 1.1;
      const pts = [
        new Vector3(0, 0, 0),
        new Vector3(c * r0, 0.04, s * r0),
        new Vector3(c * r1, -0.12 - h * 0.1, s * r1 + (h * 0.12 - 0.02)),
        new Vector3(c * (r1 + 0.08), -0.22 - h * 0.08, s * (r1 + 0.1)),
        new Vector3(c * r2, -0.45 - h * 0.12, s * r2),
      ];
      const curve = new CatmullRomCurve3(pts);
      const rad = 0.035 * k;
      ge.push(new TubeGeometry(curve, 28, Math.max(0.02, rad), 7, false));
    }
    return ge;
  }, [k, mint]);

  useEffect(
    () => () => {
      for (const g of geoms) g.dispose();
    },
    [geoms]
  );

  return (
    <group>
      <group ref={mantle} position={[0, 0, 0]}>
        <mesh scale={[0.95, 0.72, 0.9]}>
          <sphereGeometry args={[0.33, 28, 22]} />
          <meshPhysicalMaterial
            {...animeSkinPhysicalProps(p, t.L, { emissiveBoost: 0.95, roughness: 0.45, iridescent: true })}
          />
        </mesh>
        <mesh position={[0.08, -0.1, 0.14]} rotation={[0, 0, -0.2]}>
          <cylinderGeometry args={[0, 0.05, 0.2, 8]} />
          <meshPhysicalMaterial {...animeSkinPhysicalProps(p, t.L, { emissiveBoost: 0.88, roughness: 0.4 })} />
        </mesh>
      </group>
      {geoms.map((geometry, i) => (
        <group
          key={i}
          ref={(el) => {
            armRefs.current[i] = el;
          }}
        >
          <mesh geometry={geometry}>
            <meshPhysicalMaterial
              color={p.skin}
              emissive={new THREE.Color(p.biolume)}
              emissiveIntensity={0.03 + t.L / 40}
              metalness={0.15}
              roughness={0.46}
              sheen={0.55}
              sheenColor={new THREE.Color(p.shadow)}
              clearcoat={0.32}
              envMapIntensity={0.72}
            />
          </mesh>
        </group>
      ))}
      <AnimeEyes p={p} L={t.L} x={-0.06} y={0.08} z={0.32} r={0.08} sep={0.1} eyeScale={t.eyeScale} />
    </group>
  );
}

/** Anguilliform: high-count spine curve, sub-cylindrical myomeres, dorsal spines, broader head. */
function SpineEel({ p, t, nSpine, mint }: { p: CnftArtPalette; t: CnftArtVisualTraits; nSpine: number; mint: string }) {
  const { curve, girth, tubeGeo } = useMemo(() => {
    const g = 0.045 + t.pressure * 0.0045 + t.moodT.finSpread * 0.008;
    const n = 12;
    const pts: Vector3[] = [];
    for (let i = 0; i < n; i++) {
      const u = i / (n - 1);
      const j = hash32(mint + `e${i}`);
      const jx = ((j % 80) - 40) / 800;
      const w = u * 4.1;
      pts.push(
        new Vector3(
          -0.62 + u * 1.28,
          Math.sin(w * 1.8) * 0.14 + jx,
          Math.sin(w * 2.4 + t.variantSeed * 0.00001) * 0.11
        )
      );
    }
    const c = new CatmullRomCurve3(pts);
    return { curve: c, girth: g, tubeGeo: new TubeGeometry(c, 80, g, 8, false) };
  }, [mint, t.pressure, t.moodT.finSpread, t.variantSeed]);

  useEffect(
    () => () => {
      tubeGeo.dispose();
    },
    [tubeGeo]
  );

  const spines = useMemo(() => {
    const o: { t: number; y: number }[] = [];
    for (let i = 0; i < nSpine; i++) {
      o.push({ t: 0.1 + (i / (nSpine + 0.1)) * 0.72, y: (i % 2) * 0.006 });
    }
    return o;
  }, [nSpine]);

  const finSamples = useMemo(
    () => [0.22, 0.35, 0.48, 0.6, 0.72].map((t) => ({ t, ph: t * 7 })),
    []
  );

  const wiggle = useRef<THREE.Group>(null);
  useFrame((state) => {
    const cl = state.clock.elapsedTime * t.swimSpeed + t.idlePhase;
    if (wiggle.current) {
      wiggle.current.rotation.z = Math.sin(cl * 1.5) * 0.1 * t.finFlap;
      wiggle.current.rotation.y = Math.sin(cl * 0.52) * 0.09;
    }
  });

  const head = curve.getPointAt(0.03);
  return (
    <group ref={wiggle}>
      <mesh geometry={tubeGeo}>
        <meshPhysicalMaterial {...animeSkinPhysicalProps(p, t.L, { emissiveBoost: 0.95, roughness: 0.44, iridescent: true })} />
      </mesh>
      {spines.map((s) => {
        const pt = curve.getPointAt(s.t);
        return (
          <mesh key={`${s.t}`} position={[pt.x, pt.y + girth * 1.05 + s.y, pt.z]}>
            <sphereGeometry args={[0.018, 5, 4]} />
            <meshPhysicalMaterial
              color={p.skinHi}
              emissive={new THREE.Color(p.biolume)}
              emissiveIntensity={0.07 + t.L * 0.02}
              metalness={0.18}
              roughness={0.42}
            />
          </mesh>
        );
      })}
      {finSamples.map((f) => {
        const pt = curve.getPointAt(f.t);
        const ta = curve.getTangentAt(f.t);
        const up = new Vector3(0, 1, 0);
        const side = new Vector3().crossVectors(ta, up).normalize();
        if (side.length() < 0.01) side.set(1, 0, 0);
        return (
          <mesh
            key={f.t}
            position={[pt.x + side.x * 0.02, pt.y + girth * 0.5, pt.z + side.z * 0.02]}
            rotation={[
              Math.atan2(ta.y, Math.hypot(ta.x, ta.z)) + 0.2 * Math.sin(f.ph),
              Math.atan2(ta.x, ta.z),
              0.15 * Math.sin(f.ph),
            ]}
          >
            <boxGeometry args={[0.12, 0.02, 0.04]} />
            <meshPhysicalMaterial
              color={p.skin}
              emissive={new THREE.Color(p.biolume)}
              emissiveIntensity={0.04}
              roughness={0.45}
              metalness={0.12}
              transparent
              opacity={0.85}
            />
          </mesh>
        );
      })}
      <mesh position={[head.x - 0.02, head.y, head.z + 0.06]}>
        <sphereGeometry args={[0.05, 8, 8]} />
        <meshPhysicalMaterial
          color={p.skin}
          emissive={new THREE.Color(p.biolume)}
          emissiveIntensity={0.05}
          roughness={0.42}
        />
      </mesh>
      <AnimeEyes
        p={p}
        L={t.L}
        x={head.x - 0.02}
        y={head.y + 0.03}
        z={head.z + 0.09}
        r={0.05}
        sep={0.09}
        eyeScale={t.eyeScale}
      />
    </group>
  );
}

/** Dextral: tall micro-spire, two clear whorls, flared lip — all Vector2 (r, y). */
function hermitShellGeometry() {
  const u = [
    new Vector2(0.01, 0.0),
    new Vector2(0.08, 0.06),
    new Vector2(0.2, 0.18),
    new Vector2(0.32, 0.34),
    new Vector2(0.4, 0.5),
    new Vector2(0.3, 0.62),
    new Vector2(0.12, 0.66),
    new Vector2(0.04, 0.52),
  ];
  return new LatheGeometry(u, 48);
}

/** Hermit: borrowed turban with coral polyps, RoundedBox carapace, asymmetric chelae, splayed walking legs. */
function CoralHermit({ p, t }: { p: CnftArtPalette; t: CnftArtVisualTraits }) {
  const shell = useRef<THREE.Group>(null);
  const legs = useRef<THREE.Group>(null);
  const clawL = useRef<THREE.Group>(null);
  const clawR = useRef<THREE.Group>(null);
  const shellGeo = useMemo(() => hermitShellGeometry(), []);
  const lipGeo = useMemo(() => new TorusGeometry(0.2, 0.022, 10, 36, Math.PI * 1.32), []);
  const coralC = new THREE.Color("#c26b52").lerp(p.skin, 0.25);
  useEffect(
    () => () => {
      shellGeo.dispose();
      lipGeo.dispose();
    },
    [shellGeo, lipGeo]
  );
  const shellColor = new THREE.Color(p.shadow).lerp(new THREE.Color("#5c3d24"), 0.5);
  useFrame((state) => {
    const cl = state.clock.elapsedTime * t.swimSpeed + t.idlePhase;
    if (shell.current) {
      shell.current.rotation.z = Math.sin(cl * 0.45) * 0.05;
      shell.current.rotation.x = 0.12 + Math.sin(cl * 0.28) * 0.04;
    }
    if (legs.current) legs.current.rotation.x = Math.sin(cl * 1.2) * 0.06 * t.finFlap;
    const f = t.finFlap;
    if (clawL.current) clawL.current.rotation.z = 0.35 + Math.sin(cl * 1.7) * 0.2 * f;
    if (clawR.current) clawR.current.rotation.z = -0.25 + Math.sin(cl * 1.7 + 0.5) * 0.12 * f;
  });
  return (
    <group>
      <group
        ref={shell}
        position={[0.22, 0.1, 0.02]}
        rotation={[0.12, 0.55, 0.08]}
        scale={[0.86, 0.86, 0.9]}
      >
        <mesh geometry={shellGeo} castShadow>
          <meshPhysicalMaterial
            color={shellColor}
            roughness={0.6}
            metalness={0.07}
            clearcoat={0.24}
            clearcoatRoughness={0.42}
            emissive={new THREE.Color(p.shadow)}
            emissiveIntensity={0.045}
            envMapIntensity={0.64}
          />
        </mesh>
        <mesh geometry={lipGeo} rotation={[Math.PI / 2, 0, 0.58]} position={[-0.02, 0.5, 0.09]}>
          <meshPhysicalMaterial
            color={shellColor}
            roughness={0.52}
            metalness={0.05}
            emissive={new THREE.Color(0x1a0f08)}
            emissiveIntensity={0.03}
          />
        </mesh>
        {(
          [
            [0, 0.4, 0.14] as [number, number, number],
            [-0.14, 0.2, 0.2] as [number, number, number],
            [0.12, 0.12, 0.22] as [number, number, number],
          ] as const
        ).map(([x, y, z], i) => (
          <mesh key={i} position={[x, y, z]} rotation={[0.2 + i * 0.15, 0.5 - i * 0.1, 0.1]}>
            <capsuleGeometry args={[0.018, 0.09, 4, 6]} />
            <meshPhysicalMaterial
              color={coralC}
              emissive={new THREE.Color(p.biolume)}
              emissiveIntensity={0.08 + t.L * 0.03}
              roughness={0.48}
              metalness={0.08}
            />
          </mesh>
        ))}
      </group>
      <group position={[-0.1, 0, 0.1]} castShadow>
        <mesh position={[0, 0, 0.02]} rotation={[0.1, 0.32, 0]}>
          <RoundedBox args={[0.24, 0.11, 0.2]} radius={0.04} smoothness={3}>
            <meshPhysicalMaterial
              {...animeSkinPhysicalProps(p, t.L, { emissiveBoost: 0.95, metalness: 0.1, roughness: 0.4, iridescent: true })}
            />
          </RoundedBox>
        </mesh>
        <mesh position={[0, -0.05, -0.05]} rotation={[0.28, 0, 0.12]}>
          <RoundedBox args={[0.12, 0.09, 0.14]} radius={0.03} smoothness={2}>
            <meshPhysicalMaterial
              color={p.skin}
              emissive={new THREE.Color(p.biolume)}
              emissiveIntensity={0.035 + t.L * 0.02}
              roughness={0.48}
              metalness={0.1}
            />
          </RoundedBox>
        </mesh>
        <mesh position={[0.1, 0, 0.1]} rotation={[0, 0.2, 0.08]}>
          <RoundedBox args={[0.1, 0.06, 0.1]} radius={0.02} smoothness={2}>
            <meshPhysicalMaterial {...animeSkinPhysicalProps(p, t.L, { emissiveBoost: 0.88, roughness: 0.44 })} />
          </RoundedBox>
        </mesh>
      </group>
      <group ref={clawL} position={[-0.36, 0.02, 0.2]} rotation={[0.12, 0, 0.55]}>
        <mesh>
          <RoundedBox args={[0.12, 0.045, 0.16]} radius={0.018} smoothness={2}>
            <meshPhysicalMaterial
              color={p.shadow}
              emissive={new THREE.Color(p.biolume)}
              emissiveIntensity={0.07 + t.L * 0.03}
              metalness={0.28}
              roughness={0.4}
              clearcoat={0.22}
            />
          </RoundedBox>
        </mesh>
        <mesh position={[-0.11, 0, 0.04]} rotation={[0.05, 0, 0.42]}>
          <RoundedBox args={[0.1, 0.028, 0.11]} radius={0.014} smoothness={2}>
            <meshPhysicalMaterial color={p.shadow} metalness={0.26} roughness={0.42} />
          </RoundedBox>
        </mesh>
        <mesh position={[-0.2, 0, 0.02]} rotation={[0, 0, 0.25]}>
          <coneGeometry args={[0.04, 0.12, 5]} />
          <meshPhysicalMaterial
            color={p.shadow}
            emissive={new THREE.Color(p.biolume)}
            emissiveIntensity={0.05}
            metalness={0.2}
            roughness={0.48}
          />
        </mesh>
      </group>
      <group ref={clawR} position={[-0.2, -0.08, 0.1]} rotation={[0.12, 0, -0.32]}>
        <mesh>
          <RoundedBox args={[0.08, 0.036, 0.1]} radius={0.014} smoothness={2}>
            <meshPhysicalMaterial
              color={p.shadow}
              emissive={new THREE.Color(p.biolume)}
              emissiveIntensity={0.05 + t.L * 0.025}
              metalness={0.25}
              roughness={0.44}
            />
          </RoundedBox>
        </mesh>
        <mesh position={[-0.08, 0, 0.02]} rotation={[0, 0, -0.2]}>
          <RoundedBox args={[0.06, 0.02, 0.08]} radius={0.01} smoothness={2}>
            <meshPhysicalMaterial color={p.shadow} metalness={0.22} roughness={0.48} />
          </RoundedBox>
        </mesh>
      </group>
      <group ref={legs} position={[-0.08, -0.15, 0.08]}>
        {(
          [
            [0, 0, 0.18, 0.12, 0.65, 0.1],
            [-0.1, 0, 0.1, 0.38, 0.62, -0.05],
            [0.1, 0, 0.1, -0.3, 0.64, 0.02],
            [0, 0, -0.1, 0, 0.7, 0.18],
            [-0.05, 0, 0, 0.2, 0.58, 0.12],
          ] as const
        ).map(([x, y, z, ry, rotX, rotZ], i) => (
          <mesh
            // eslint-disable-next-line react/no-array-index-key
            key={i}
            position={[x, y, z] as [number, number, number]}
            rotation={[rotX, ry, rotZ]}
          >
            <RoundedBox args={[0.04, 0.02, 0.2]} radius={0.01} smoothness={2}>
              <meshPhysicalMaterial color={p.shadow} metalness={0.14} roughness={0.55} />
            </RoundedBox>
          </mesh>
        ))}
      </group>
      {(
        [
          [0, 0, 0.04] as [number, number, number],
          [0.04, 0, -0.02] as [number, number, number],
        ] as const
      ).map((off, i) => (
        <group key={i} position={[-0.08 + off[0], 0.05 + off[1], 0.2 + off[2]]}>
          <mesh rotation={[0.5, 0, i === 0 ? 0.12 : -0.12]}>
            <cylinderGeometry args={[0.008, 0.012, 0.12, 5]} />
            <meshStandardMaterial color={p.shadow} roughness={0.5} />
          </mesh>
        </group>
      ))}
      <AnimeEyes p={p} L={t.L} x={-0.1} y={0.1} z={0.24} r={0.04} sep={0.09} eyeScale={t.eyeScale} />
    </group>
  );
}

/** Turban/abalone-like: short spire, wide shouldered body whorl, inrolled lip. */
function snailShellGeometry() {
  const u = [
    new Vector2(0.02, 0.0),
    new Vector2(0.1, 0.08),
    new Vector2(0.24, 0.22),
    new Vector2(0.36, 0.4),
    new Vector2(0.3, 0.56),
    new Vector2(0.1, 0.62),
    new Vector2(0.04, 0.52),
  ];
  return new LatheGeometry(u, 48);
}

/** Abyssal snail: low shell, muscular foot (RoundedBox + rim), mantle collar, siphon stack, small oral skirt. */
function PressureSnail({ p, t }: { p: CnftArtPalette; t: CnftArtVisualTraits }) {
  const foot = useRef<THREE.Group>(null);
  const shell = useRef<THREE.Group>(null);
  const shellGeo = useMemo(() => snailShellGeometry(), []);
  const siphonGeo = useMemo(() => new THREE.CylinderGeometry(0.045, 0.062, 0.14, 10), []);
  const rimGeo = useMemo(
    () => new TorusGeometry(0.3, 0.028, 8, 40, Math.PI * 1.8),
    []
  );
  useEffect(
    () => () => {
      shellGeo.dispose();
      siphonGeo.dispose();
      rimGeo.dispose();
    },
    [shellGeo, siphonGeo, rimGeo]
  );
  useFrame((state) => {
    const cl = state.clock.elapsedTime * t.swimSpeed + t.idlePhase;
    if (foot.current) {
      const s = 1 + Math.sin(cl * 0.85) * 0.032 * t.breathAmp * 12;
      foot.current.scale.set(s, 1, s * 1.02);
    }
    if (shell.current) {
      shell.current.rotation.z = Math.sin(cl * 0.35) * 0.04;
    }
  });
  const shellTint = new THREE.Color(p.shadow).lerp(new THREE.Color("#3a3630"), 0.4);
  return (
    <group>
      <group ref={shell} position={[0.05, 0.03, -0.04]} rotation={[-0.1, -0.38, 0.1]} scale={[0.94, 0.94, 0.96]}>
        <mesh geometry={shellGeo} castShadow>
          <meshPhysicalMaterial
            color={shellTint}
            roughness={0.52}
            metalness={0.09}
            clearcoat={0.32}
            clearcoatRoughness={0.32}
            emissive={new THREE.Color(p.shadow)}
            emissiveIntensity={0.04}
            envMapIntensity={0.75}
          />
        </mesh>
        <mesh position={[-0.02, 0.4, 0.18]} rotation={[0.55, 0, 0]}>
          <torusGeometry args={[0.1, 0.014, 8, 24, Math.PI * 1.2]} />
          <meshPhysicalMaterial
            color={shellTint}
            roughness={0.48}
            metalness={0.06}
            emissive={new THREE.Color(0x000000)}
            emissiveIntensity={0.025}
          />
        </mesh>
      </group>
      <group ref={foot} position={[0, -0.2, 0.02]}>
        <mesh position={[0, 0, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[0.32, 44]} />
          <meshPhysicalMaterial
            {...animeSkinPhysicalProps(p, t.L, { emissiveBoost: 0.95, roughness: 0.45, iridescent: true })}
            side={THREE.DoubleSide}
          />
        </mesh>
        <mesh position={[0, 0, -0.02]} rotation={[-0.1, 0, 0]}>
          <RoundedBox args={[0.5, 0.06, 0.5]} radius={0.12} smoothness={3}>
            <meshPhysicalMaterial
              {...animeSkinPhysicalProps(p, t.L, { emissiveBoost: 0.92, roughness: 0.5, iridescent: true })}
            />
          </RoundedBox>
        </mesh>
        <mesh position={[0, 0, 0.02]} rotation={[-Math.PI / 2, 0, 0]} geometry={rimGeo}>
          <meshPhysicalMaterial
            color={p.shadow}
            emissive={new THREE.Color(p.biolume)}
            emissiveIntensity={0.04 + t.L * 0.02}
            roughness={0.55}
            metalness={0.08}
            side={THREE.DoubleSide}
            opacity={0.88}
            transparent
          />
        </mesh>
        <mesh position={[0.1, 0.04, 0.2]} rotation={[-0.4, 0.25, 0]}>
          <RoundedBox args={[0.2, 0.05, 0.2]} radius={0.04} smoothness={2}>
            <meshPhysicalMaterial
              color={p.skin}
              emissive={new THREE.Color(p.biolume)}
              emissiveIntensity={0.05 + t.L * 0.025}
              roughness={0.5}
              metalness={0.1}
              side={THREE.DoubleSide}
              opacity={0.9}
              transparent
            />
          </RoundedBox>
        </mesh>
      </group>
      <group position={[-0.12, 0, 0.2]}>
        <mesh rotation={[0.18, 0.42, 0.08]}>
          <RoundedBox args={[0.14, 0.1, 0.16]} radius={0.04} smoothness={3}>
            <meshPhysicalMaterial {...animeSkinPhysicalProps(p, t.L, { emissiveBoost: 0.88, roughness: 0.4 })} />
          </RoundedBox>
        </mesh>
        <mesh position={[0.02, 0, 0.12]} rotation={[0.25, 0, 0]}>
          <RoundedBox args={[0.2, 0.04, 0.1]} radius={0.02} smoothness={2}>
            <meshPhysicalMaterial
              color={p.shadow}
              emissive={new THREE.Color(p.biolume)}
              emissiveIntensity={0.05}
              roughness={0.48}
              metalness={0.12}
              side={THREE.DoubleSide}
              opacity={0.85}
              transparent
            />
          </RoundedBox>
        </mesh>
      </group>
      <mesh position={[-0.06, 0, 0.32]} rotation={[0.12, 0, 0]} geometry={siphonGeo}>
        <meshPhysicalMaterial
          color={p.shadow}
          roughness={0.48}
          emissive={new THREE.Color(p.biolume)}
          emissiveIntensity={0.05}
        />
      </mesh>
      <mesh position={[-0.06, 0, 0.4]}>
        <sphereGeometry args={[0.04, 10, 8]} />
        <meshPhysicalMaterial
          color={p.shadow}
          emissive={new THREE.Color(p.biolume)}
          emissiveIntensity={0.06}
          roughness={0.45}
        />
      </mesh>
      {(
        [
          [-0.1, 0, 0.2] as [number, number, number],
          [-0.06, 0, 0.2] as [number, number, number],
        ] as const
      ).map(([x, y, z], i) => (
        <group key={i} position={[x, y, z]}>
          <mesh rotation={[0.35, 0, i === 0 ? 0.15 : -0.15]}>
            <cylinderGeometry args={[0.01, 0.012, 0.1, 5]} />
            <meshPhysicalMaterial color={p.shadow} roughness={0.45} />
          </mesh>
        </group>
      ))}
      <AnimeEyes p={p} L={t.L} x={-0.1} y={0.12} z={0.28} r={0.032} sep={0.055} eyeScale={t.eyeScale} />
    </group>
  );
}

/** Batoid: dorsoventrally compressed pectoral disc, cranial rostrum, whip tail with sting, spiracle dimples. */
function EchoRay({ p, t, fs }: { p: CnftArtPalette; t: CnftArtVisualTraits; fs: number }) {
  const disc = useRef<THREE.Group>(null);
  useFrame((state) => {
    const cl = state.clock.elapsedTime * t.swimSpeed + t.idlePhase;
    if (disc.current) {
      const w = 1 + Math.sin(cl * 1.05) * 0.028 * t.finFlap;
      disc.current.scale.set(w * 1.02, fs * w, 0.14 + Math.sin(cl * 0.85) * 0.018);
    }
  });
  return (
    <group>
      <group ref={disc} rotation={[0.08, 0, 0]}>
        <mesh scale={[1.05, 1, 0.18]}>
          <sphereGeometry args={[0.52, 40, 28]} />
          <meshPhysicalMaterial {...animeSkinPhysicalProps(p, t.L, { emissiveBoost: 1.05, metalness: 0.12, iridescent: true })} />
        </mesh>
        <mesh position={[0.08, 0.12, 0.28]}>
          <sphereGeometry args={[0.028, 8, 8]} />
          <meshPhysicalMaterial
            color={p.shadow}
            emissive={new THREE.Color(0x000000)}
            emissiveIntensity={0.02}
            roughness={0.6}
          />
        </mesh>
        <mesh position={[-0.08, 0.12, 0.28]}>
          <sphereGeometry args={[0.028, 8, 8]} />
          <meshPhysicalMaterial
            color={p.shadow}
            emissive={new THREE.Color(0x000000)}
            emissiveIntensity={0.02}
            roughness={0.6}
          />
        </mesh>
        <mesh position={[0, 0.06, 0.38]} rotation={[-0.4, 0, 0]}>
          <coneGeometry args={[0.07, 0.2, 6]} />
          <meshPhysicalMaterial
            color={p.skin}
            emissive={new THREE.Color(p.biolume)}
            emissiveIntensity={0.04}
            roughness={0.45}
            metalness={0.1}
          />
        </mesh>
      </group>
      <mesh position={[-0.55, 0, 0.02]} rotation={[0, 0, -0.08]}>
        <cylinderGeometry args={[0.045, 0.03, 0.75, 10]} />
        <meshPhysicalMaterial
          color={p.shadow}
          emissive={new THREE.Color(p.biolume)}
          emissiveIntensity={0.05 + t.L * 0.02}
          metalness={0.18}
          roughness={0.52}
        />
      </mesh>
      <mesh position={[-0.96, 0, 0.04]}>
        <coneGeometry args={[0.035, 0.14, 5]} />
        <meshPhysicalMaterial
          color={p.shadow}
          metalness={0.25}
          roughness={0.45}
          emissive={new THREE.Color(p.biolume)}
          emissiveIntensity={0.06}
        />
      </mesh>
      <AnimeEyes p={p} L={t.L} x={0.06} y={0.1} z={0.22} r={0.065} sep={0.16} eyeScale={t.eyeScale} />
    </group>
  );
}

export function CreatureByArchetype({ palette: p, traits: t, archetype, mint }: Props) {
  const g = useRef<THREE.Group>(null);
  const biolumeLamp = useRef<THREE.PointLight>(null);
  const h = hash32(mint);
  const wobble = 0.22 + (h % 100) / 280;
  const mantisSegs = 3 + (t.pressure % 3);
  const nSpine = 5 + (t.pressure % 4);
  const fs = t.moodT.finSpread;
  const baseScale = 0.52 + t.pressure * 0.04;

  useFrame((state) => {
    const cl = state.clock.elapsedTime * t.swimSpeed + t.idlePhase;
    if (!g.current) return;
    const dy = t.moodT.dy * 0.003;
    g.current.position.y = dy + Math.sin(cl * wobble) * (0.09 + t.breathAmp * 2.2);
    g.current.position.x = Math.sin(cl * 0.19) * 0.03 * t.bankAmp * 8;
    g.current.rotation.y = Math.sin(cl * 0.24) * 0.16 + t.moodT.rot * 0.004 + Math.sin(cl * 0.11) * 0.04;
    g.current.rotation.x = Math.sin(cl * 0.14) * 0.055;
    g.current.rotation.z = Math.sin(cl * 0.17) * t.bankAmp + Math.sin(cl * 0.08) * 0.02;
    const lamp = biolumeLamp.current;
    if (lamp) {
      lamp.intensity = 0.32 + t.L * 0.07 + Math.sin(cl * 1.85) * 0.08;
    }
  });

  const vis = (() => {
    switch (archetype) {
      case 0:
        return <LanternGulper p={p} t={t} fs={fs} />;
      case 1:
        return <GlassfinDrifter p={p} t={t} fs={fs} />;
      case 2:
        return <MantisShrimp p={p} t={t} segs={mantisSegs} mint={mint} />;
      case 3:
        return <Octoid p={p} t={t} mint={mint} />;
      case 4:
        return <SpineEel p={p} t={t} nSpine={nSpine} mint={mint} />;
      case 5:
        return <CoralHermit p={p} t={t} />;
      case 6:
        return <PressureSnail p={p} t={t} />;
      case 7:
      default:
        return <EchoRay p={p} t={t} fs={fs} />;
    }
  })();

  return (
    <group ref={g} scale={baseScale * t.moodT.sc}>
      {vis}
      <pointLight
        ref={biolumeLamp}
        position={[0, 0, 0.4]}
        color={new THREE.Color(p.biolume)}
        intensity={0.35 + t.L * 0.07}
        distance={2.5}
        decay={2}
      />
    </group>
  );
}
