import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
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

function LanternGulper({ p, t, fs }: { p: CnftArtPalette; t: CnftArtVisualTraits; fs: number }) {
  const lure = useRef<THREE.Group>(null);
  const fins = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  useFrame((state) => {
    const cl = state.clock.elapsedTime * t.swimSpeed + t.idlePhase;
    if (lure.current) {
      lure.current.position.y = 0.62 + Math.sin(cl * 2.0) * 0.04;
      lure.current.rotation.z = Math.sin(cl * 1.65) * 0.1;
    }
    if (fins.current) {
      fins.current.rotation.x = Math.sin(cl * 1.35) * t.finFlap * 0.25;
    }
    if (body.current) {
      body.current.rotation.x = Math.sin(cl * 0.9) * 0.04;
    }
  });
  return (
    <group>
      <group ref={body}>
        <mesh position={[0, 0, 0.08]}>
          <capsuleGeometry args={[0.36, 1, 5, 16]} />
          <meshPhysicalMaterial {...animeSkinPhysicalProps(p, t.L, { emissiveBoost: 1.05, iridescent: true })} />
        </mesh>
        <mesh position={[0, 0.48, 0.4]}>
          <cylinderGeometry args={[0.02, 0.04, 0.2, 6]} />
          <meshPhysicalMaterial {...animeSkinPhysicalProps(p, t.L, { roughness: 0.35 })} />
        </mesh>
        <group ref={lure} position={[0, 0.62, 0.5]}>
          <mesh>
            <sphereGeometry args={[0.12, 16, 12]} />
            <meshPhysicalMaterial
              {...animeSkinPhysicalProps(p, t.L, { emissiveBoost: 1.4, roughness: 0.3 })}
            />
          </mesh>
        </group>
        <group ref={fins} scale={[fs, 1, 1]}>
          <mesh position={[-0.4, -0.05, 0.1]} rotation={[0.2, 0, 0.45]}>
            <boxGeometry args={[0.1, 0.06, 0.38]} />
            <meshPhysicalMaterial {...animeSkinPhysicalProps(p, t.L, { metalness: 0.2 })} />
          </mesh>
          <mesh position={[0.4, -0.05, 0.1]} rotation={[0.2, 0, -0.45]}>
            <boxGeometry args={[0.1, 0.06, 0.38]} />
            <meshPhysicalMaterial {...animeSkinPhysicalProps(p, t.L, { metalness: 0.2 })} />
          </mesh>
        </group>
        <AnimeEyes p={p} L={t.L} x={-0.15} y={0.12} z={0.4} r={0.08} sep={0.2} eyeScale={t.eyeScale} />
      </group>
    </group>
  );
}

function GlassfinDrifter({ p, t, fs }: { p: CnftArtPalette; t: CnftArtVisualTraits; fs: number }) {
  const tail = useRef<THREE.Group>(null);
  const dorsal = useRef<THREE.Group>(null);
  useFrame((state) => {
    const cl = state.clock.elapsedTime * t.swimSpeed + t.idlePhase;
    if (tail.current) {
      tail.current.rotation.y = Math.sin(cl * 1.9) * 0.35 * t.finFlap;
    }
    if (dorsal.current) {
      dorsal.current.rotation.x = -0.2 + Math.sin(cl * 1.5) * 0.12 * t.finFlap;
    }
  });
  return (
    <group>
      <mesh scale={[1.55, 0.5, 0.72]}>
        <sphereGeometry args={[0.52, 28, 20]} />
        <meshPhysicalMaterial {...animeGlassProps(p, t.L)} />
      </mesh>
      <group ref={dorsal} scale={[fs, 1, 1]}>
        <mesh position={[0, 0.2, 0.05]} rotation={[-0.2, 0, 0]}>
          <boxGeometry args={[0.4, 0.02, 0.55]} />
          <meshPhysicalMaterial
            color={p.skinHi}
            transparent
            opacity={0.75}
            metalness={0.35}
            roughness={0.28}
            clearcoat={0.45}
            sheen={0.5}
            sheenColor={new THREE.Color(p.skinHi)}
            envMapIntensity={0.85}
          />
        </mesh>
        <mesh position={[0, -0.2, 0.05]} rotation={[0.2, 0, 0]}>
          <boxGeometry args={[0.35, 0.02, 0.45]} />
          <meshPhysicalMaterial
            color={p.skinHi}
            transparent
            opacity={0.7}
            metalness={0.32}
            roughness={0.3}
            clearcoat={0.4}
            sheen={0.45}
            sheenColor={new THREE.Color(p.skinHi)}
            envMapIntensity={0.8}
          />
        </mesh>
        <group ref={tail} position={[-0.5, 0, 0]} rotation={[0, -0.5, 0]}>
          <mesh>
            <boxGeometry args={[0.02, 0.3, 0.45]} />
            <meshPhysicalMaterial
              color={p.skin}
              transparent
              opacity={0.7}
              metalness={0.25}
              roughness={0.35}
              sheen={0.55}
              sheenColor={new THREE.Color(p.skinHi)}
            />
          </mesh>
        </group>
      </group>
      <AnimeEyes p={p} L={t.L} x={-0.28} y={0.04} z={0.3} r={0.05} sep={0.16} eyeScale={t.eyeScale} />
    </group>
  );
}

function MantisShrimp({ p, t, segs, mint }: { p: CnftArtPalette; t: CnftArtVisualTraits; segs: number; mint: string }) {
  const w = 0.14;
  const clawL = useRef<THREE.Group>(null);
  const clawR = useRef<THREE.Group>(null);
  useFrame((state) => {
    const cl = state.clock.elapsedTime * t.swimSpeed + t.idlePhase;
    const f = t.finFlap;
    if (clawL.current) clawL.current.rotation.z = 0.2 + Math.sin(cl * 2.2) * 0.35 * f;
    if (clawR.current) clawR.current.rotation.z = -0.2 + Math.sin(cl * 2.2 + 0.6) * 0.35 * f;
  });
  return (
    <group>
      <mesh position={[-0.2, 0, 0.1]} rotation={[0.1, 0, 0.3]}>
        <boxGeometry args={[0.2, 0.15, 0.35]} />
        <meshPhysicalMaterial {...animeSkinPhysicalProps(p, t.L, { metalness: 0.2, iridescent: true })} />
      </mesh>
      {Array.from({ length: segs }, (_, s) => (
        <mesh
          // eslint-disable-next-line react/no-array-index-key
          key={s}
          position={[(s - (segs - 1) / 2) * w * 1.02, 0, 0.05 + (hash32(mint + `s${s}`) % 3) * 0.01]}
        >
          <boxGeometry args={[w * 0.9, 0.18, 0.2]} />
          <meshPhysicalMaterial
            {...animeSkinPhysicalProps(p, t.L, { emissiveBoost: 0.95, roughness: 0.44, iridescent: true })}
          />
        </mesh>
      ))}
      <group ref={clawL} position={[-0.55, 0.1, 0.15]} rotation={[0.5, 0, 0.2]}>
        <mesh>
          <boxGeometry args={[0.12, 0.05, 0.4]} />
          <meshPhysicalMaterial
            color={p.shadow}
            metalness={0.35}
            roughness={0.4}
            clearcoat={0.25}
            emissive={new THREE.Color(p.biolume)}
            emissiveIntensity={0.08 + (t.L / 30)}
          />
        </mesh>
      </group>
      <group ref={clawR} position={[0.5, 0.1, 0.2]} rotation={[0.5, 0, -0.2]}>
        <mesh>
          <boxGeometry args={[0.12, 0.05, 0.4]} />
          <meshPhysicalMaterial
            color={p.shadow}
            metalness={0.35}
            roughness={0.4}
            clearcoat={0.25}
            emissive={new THREE.Color(p.biolume)}
            emissiveIntensity={0.08 + (t.L / 30)}
          />
        </mesh>
      </group>
      <AnimeEyes p={p} L={t.L} x={-0.48} y={0.1} z={0.2} r={0.05} sep={0.1} eyeScale={t.eyeScale} />
    </group>
  );
}

function Octoid({ p, t, mint }: { p: CnftArtPalette; t: CnftArtVisualTraits; mint: string }) {
  const k = t.moodT.tentacleK;
  const armRefs = useRef<(THREE.Group | null)[]>([]);
  useFrame((state) => {
    const cl = state.clock.elapsedTime * t.swimSpeed + t.idlePhase;
    const arr = armRefs.current;
    for (let i = 0; i < arr.length; i++) {
      const g = arr[i];
      if (!g) continue;
      const a = (i / 8) * Math.PI * 2;
      g.rotation.x = Math.sin(cl * 1.2 + a) * 0.2 * t.finFlap;
      g.rotation.y = Math.cos(cl * 0.85 + a * 1.1) * 0.12;
    }
  });
  const geoms = useMemo(() => {
    const ge: TubeGeometry[] = [];
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const h = hash32(mint + `oct${i}`) / 2 ** 32;
      const len = 0.34 * k;
      const pts = [
        new Vector3(0, 0, 0),
        new Vector3(Math.cos(a) * 0.18, 0, Math.sin(a) * 0.15),
        new Vector3(
          Math.cos(a) * (0.2 + len),
          -0.15 - h * 0.12,
          Math.sin(a) * (0.2 + len) + (h * 0.1 - 0.05)
        ),
        new Vector3(
          Math.cos(a) * (0.28 + len * 1.2),
          -0.4 - h * 0.08,
          Math.sin(a) * (0.32 + len)
        ),
      ];
      const curve = new CatmullRomCurve3(pts);
      ge.push(new TubeGeometry(curve, 20, 0.04 * k, 6, false));
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
      <mesh scale={[1, 0.8, 0.95]}>
        <sphereGeometry args={[0.38, 32, 24]} />
        <meshPhysicalMaterial {...animeSkinPhysicalProps(p, t.L, { emissiveBoost: 1, roughness: 0.48, iridescent: true })} />
      </mesh>
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
              roughness={0.48}
              sheen={0.55}
              sheenColor={new THREE.Color(p.shadow)}
              clearcoat={0.3}
              envMapIntensity={0.7}
            />
          </mesh>
        </group>
      ))}
      <mesh position={[0.15, 0, 0.18]} rotation={[0, 0, -0.2]}>
        <cylinderGeometry args={[0, 0.04, 0.18, 6]} />
        <meshPhysicalMaterial {...animeSkinPhysicalProps(p, t.L, { emissiveBoost: 0.9 })} />
      </mesh>
      <AnimeEyes p={p} L={t.L} x={-0.08} y={0.1} z={0.3} r={0.08} sep={0.12} eyeScale={t.eyeScale} />
    </group>
  );
}

function SpineEel({ p, t, nSpine, mint }: { p: CnftArtPalette; t: CnftArtVisualTraits; nSpine: number; mint: string }) {
  const { curve, girth, tubeGeo } = useMemo(() => {
    const g = 0.07 + t.pressure * 0.0065 + t.moodT.finSpread * 0.01;
    const pts: Vector3[] = [];
    for (let i = 0; i < 6; i++) {
      const u = i / 5;
      const j = hash32(mint + `e${i}`);
      const jx = (j % 100) / 500;
      pts.push(
        new Vector3(
          -0.6 + u * 1.15,
          Math.sin(u * 2.2) * 0.12 + jx,
          Math.sin(u * 3.0 + t.variantSeed * 0.00001) * 0.1
        )
      );
    }
    const curve = new CatmullRomCurve3(pts);
    return { curve, girth: g, tubeGeo: new TubeGeometry(curve, 64, g, 8, false) };
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
      o.push({ t: 0.12 + (i / (nSpine + 0.1)) * 0.68, y: (i % 2) * 0.008 });
    }
    return o;
  }, [nSpine]);

  const wiggle = useRef<THREE.Group>(null);
  useFrame((state) => {
    const cl = state.clock.elapsedTime * t.swimSpeed + t.idlePhase;
    if (wiggle.current) {
      wiggle.current.rotation.z = Math.sin(cl * 1.55) * 0.11 * t.finFlap;
      wiggle.current.rotation.y = Math.sin(cl * 0.55) * 0.08;
    }
  });

  const head = curve.getPointAt(0.02);
  return (
    <group ref={wiggle}>
      <mesh geometry={tubeGeo}>
        <meshPhysicalMaterial {...animeSkinPhysicalProps(p, t.L, { emissiveBoost: 1, roughness: 0.46, iridescent: true })} />
      </mesh>
      {spines.map((s) => {
        const pt = curve.getPointAt(s.t);
        return (
          <mesh key={`${s.t}`} position={[pt.x, pt.y + girth * 1.12 + s.y, pt.z]}>
            <sphereGeometry args={[0.022, 6, 5]} />
            <meshPhysicalMaterial
              color={p.skinHi}
              emissive={new THREE.Color(p.biolume)}
              emissiveIntensity={0.08 + t.L * 0.02}
              metalness={0.2}
              roughness={0.4}
            />
          </mesh>
        );
      })}
      <AnimeEyes p={p} L={t.L} x={head.x - 0.04} y={head.y + 0.02} z={head.z + 0.05} r={0.055} sep={0.1} eyeScale={t.eyeScale} />
    </group>
  );
}

/** Dextral turbinate shell: lathe profile (radius, height), revolved. */
function hermitShellGeometry() {
  const profile = [
    new Vector2(0.02, 0.0),
    new Vector2(0.1, 0.06),
    new Vector2(0.2, 0.16),
    new Vector2(0.32, 0.32),
    new Vector2(0.36, 0.48),
    new Vector2(0.24, 0.58),
    new Vector2(0.1, 0.54),
    new Vector2(0.04, 0.44),
  ];
  return new LatheGeometry(profile, 40);
}

function CoralHermit({ p, t }: { p: CnftArtPalette; t: CnftArtVisualTraits }) {
  const shell = useRef<THREE.Group>(null);
  const legs = useRef<THREE.Group>(null);
  const clawL = useRef<THREE.Group>(null);
  const clawR = useRef<THREE.Group>(null);
  const shellGeo = useMemo(() => hermitShellGeometry(), []);
  const lipGeo = useMemo(() => new TorusGeometry(0.2, 0.018, 8, 28, Math.PI * 1.25), []);
  useEffect(
    () => () => {
      shellGeo.dispose();
      lipGeo.dispose();
    },
    [shellGeo, lipGeo]
  );
  const shellColor = new THREE.Color(p.shadow).lerp(new THREE.Color("#6b4a2a"), 0.45);
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
        scale={[0.85, 0.85, 0.88]}
      >
        <mesh geometry={shellGeo} castShadow>
          <meshPhysicalMaterial
            color={shellColor}
            roughness={0.62}
            metalness={0.06}
            clearcoat={0.22}
            clearcoatRoughness={0.45}
            emissive={new THREE.Color(p.shadow)}
            emissiveIntensity={0.04}
            envMapIntensity={0.6}
          />
        </mesh>
        <mesh geometry={lipGeo} rotation={[Math.PI / 2, 0, 0.6]} position={[-0.02, 0.48, 0.08]}>
          <meshPhysicalMaterial
            color={shellColor}
            roughness={0.55}
            metalness={0.05}
            emissive={new THREE.Color(0x1a1008)}
            emissiveIntensity={0.02}
          />
        </mesh>
      </group>
      <mesh position={[-0.1, -0.02, 0.14]} rotation={[0.1, 0.35, 0]} castShadow>
        <capsuleGeometry args={[0.1, 0.14, 5, 10]} />
        <meshPhysicalMaterial
          {...animeSkinPhysicalProps(p, t.L, { emissiveBoost: 0.9, roughness: 0.45, iridescent: true })}
        />
      </mesh>
      <mesh position={[-0.05, -0.1, 0.08]} rotation={[0.25, 0, 0.1]}>
        <capsuleGeometry args={[0.07, 0.1, 4, 8]} />
        <meshPhysicalMaterial
          color={p.skin}
          emissive={new THREE.Color(p.biolume)}
          emissiveIntensity={0.03 + t.L * 0.02}
          roughness={0.5}
          metalness={0.1}
        />
      </mesh>
      <group ref={clawL} position={[-0.32, 0, 0.18]} rotation={[0.2, 0, 0.5]}>
        <mesh>
          <boxGeometry args={[0.14, 0.05, 0.16]} />
          <meshPhysicalMaterial
            color={p.shadow}
            emissive={new THREE.Color(p.biolume)}
            emissiveIntensity={0.06 + t.L * 0.03}
            metalness={0.28}
            roughness={0.42}
            clearcoat={0.2}
          />
        </mesh>
        <mesh position={[-0.1, 0, 0.04]} rotation={[0, 0, 0.4]}>
          <boxGeometry args={[0.1, 0.035, 0.12]} />
          <meshPhysicalMaterial color={p.shadow} metalness={0.25} roughness={0.45} />
        </mesh>
      </group>
      <group ref={clawR} position={[-0.18, -0.06, 0.1]} rotation={[0.15, 0, -0.3]}>
        <mesh>
          <boxGeometry args={[0.09, 0.04, 0.11]} />
          <meshPhysicalMaterial
            color={p.shadow}
            emissive={new THREE.Color(p.biolume)}
            emissiveIntensity={0.05 + t.L * 0.025}
            metalness={0.25}
            roughness={0.45}
          />
        </mesh>
      </group>
      <group ref={legs} position={[-0.06, -0.14, 0.1]}>
        {(
          [
            [0, 0, 0.2, 0.15],
            [-0.1, 0, 0.1, 0.35],
            [0.1, 0, 0.1, -0.25],
            [0, 0, -0.1, 0.05],
          ] as const
        ).map(([x, y, z, ry], i) => (
          <mesh
            // eslint-disable-next-line react/no-array-index-key
            key={i}
            position={[x, y, z] as [number, number, number]}
            rotation={[0.65, ry, 0.15 * (i - 1.5)]}
          >
            <cylinderGeometry args={[0.03, 0.022, 0.2, 6]} />
            <meshPhysicalMaterial color={p.shadow} metalness={0.12} roughness={0.58} />
          </mesh>
        ))}
      </group>
      <mesh position={[-0.1, 0.03, 0.16]}>
        <cylinderGeometry args={[0.012, 0.01, 0.14, 5]} />
        <meshStandardMaterial color={p.shadow} />
      </mesh>
      <mesh position={[-0.04, 0.03, 0.16]}>
        <cylinderGeometry args={[0.012, 0.01, 0.14, 5]} />
        <meshStandardMaterial color={p.shadow} />
      </mesh>
      <AnimeEyes p={p} L={t.L} x={-0.08} y={0.12} z={0.26} r={0.042} sep={0.09} eyeScale={t.eyeScale} />
    </group>
  );
}

/** Low spire, wide body whorl — reads as coiled gastropod, not a ball. */
function snailShellGeometry() {
  const profile = [
    new Vector2(0.02, 0.0),
    new Vector2(0.08, 0.05),
    new Vector2(0.2, 0.16),
    new Vector2(0.32, 0.34),
    new Vector2(0.28, 0.52),
    new Vector2(0.12, 0.58),
    new Vector2(0.04, 0.5),
  ];
  return new LatheGeometry(profile, 36);
}

function PressureSnail({ p, t }: { p: CnftArtPalette; t: CnftArtVisualTraits }) {
  const foot = useRef<THREE.Group>(null);
  const shell = useRef<THREE.Group>(null);
  const shellGeo = useMemo(() => snailShellGeometry(), []);
  const siphonGeo = useMemo(() => new THREE.CylinderGeometry(0.04, 0.06, 0.12, 8), []);
  useEffect(
    () => () => {
      shellGeo.dispose();
      siphonGeo.dispose();
    },
    [shellGeo, siphonGeo]
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
  const shellTint = new THREE.Color(p.shadow).lerp(new THREE.Color("#4a4038"), 0.35);
  return (
    <group>
      <group ref={shell} position={[0.06, 0.02, -0.04]} rotation={[-0.08, -0.35, 0.12]} scale={[0.92, 0.92, 0.92]}>
        <mesh geometry={shellGeo} castShadow>
          <meshPhysicalMaterial
            color={shellTint}
            roughness={0.55}
            metalness={0.08}
            clearcoat={0.28}
            clearcoatRoughness={0.35}
            emissive={new THREE.Color(p.shadow)}
            emissiveIntensity={0.03}
            envMapIntensity={0.72}
          />
        </mesh>
        <mesh position={[-0.02, 0.36, 0.2]} rotation={[0.5, 0, 0]}>
          <torusGeometry args={[0.08, 0.012, 6, 16, Math.PI * 1.1]} />
          <meshPhysicalMaterial
            color={shellTint}
            roughness={0.5}
            metalness={0.05}
            emissive={new THREE.Color(0x000000)}
            emissiveIntensity={0.02}
          />
        </mesh>
      </group>
      <group ref={foot} position={[0, -0.2, 0.02]}>
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[0.36, 48]} />
          <meshPhysicalMaterial
            {...animeSkinPhysicalProps(p, t.L, { emissiveBoost: 0.95, roughness: 0.48, iridescent: true })}
            side={THREE.DoubleSide}
          />
        </mesh>
        <mesh position={[0.12, 0.02, 0.18]} rotation={[-Math.PI / 2, 0.2, 0]} scale={[1, 1, 0.55]}>
          <circleGeometry args={[0.22, 32]} />
          <meshPhysicalMaterial
            color={p.skin}
            emissive={new THREE.Color(p.biolume)}
            emissiveIntensity={0.04 + t.L * 0.02}
            roughness={0.52}
            metalness={0.1}
            side={THREE.DoubleSide}
            opacity={0.92}
            transparent
          />
        </mesh>
      </group>
      <mesh position={[-0.14, -0.06, 0.24]} rotation={[0.2, 0.4, 0]}>
        <capsuleGeometry args={[0.06, 0.1, 4, 8]} />
        <meshPhysicalMaterial {...animeSkinPhysicalProps(p, t.L, { emissiveBoost: 0.85, roughness: 0.44 })} />
      </mesh>
      <mesh position={[-0.08, -0.05, 0.32]} rotation={[0.1, 0, 0]} geometry={siphonGeo}>
        <meshPhysicalMaterial
          color={p.shadow}
          roughness={0.5}
          emissive={new THREE.Color(p.biolume)}
          emissiveIntensity={0.04}
        />
      </mesh>
      <mesh position={[-0.1, 0.01, 0.22]}>
        <cylinderGeometry args={[0.012, 0.01, 0.12, 5]} />
        <meshPhysicalMaterial color={p.shadow} roughness={0.45} />
      </mesh>
      <mesh position={[-0.06, 0.01, 0.22]}>
        <cylinderGeometry args={[0.012, 0.01, 0.12, 5]} />
        <meshPhysicalMaterial color={p.shadow} roughness={0.45} />
      </mesh>
      <AnimeEyes p={p} L={t.L} x={-0.1} y={0.1} z={0.3} r={0.03} sep={0.05} eyeScale={t.eyeScale} />
    </group>
  );
}

function EchoRay({ p, t, fs }: { p: CnftArtPalette; t: CnftArtVisualTraits; fs: number }) {
  const disc = useRef<THREE.Group>(null);
  useFrame((state) => {
    const cl = state.clock.elapsedTime * t.swimSpeed + t.idlePhase;
    if (disc.current) {
      const w = 1 + Math.sin(cl * 1.1) * 0.03 * t.finFlap;
      disc.current.scale.set(w, fs * w, 0.2 + Math.sin(cl * 0.9) * 0.02);
    }
  });
  return (
    <group>
      <group ref={disc} rotation={[0.05, 0, 0]} scale={[1, fs, 0.2]}>
        <mesh>
          <cylinderGeometry args={[0.75, 0.72, 0.1, 48]} />
          <meshPhysicalMaterial {...animeSkinPhysicalProps(p, t.L, { emissiveBoost: 1.1, metalness: 0.1, iridescent: true })} />
        </mesh>
      </group>
      <mesh position={[-0.7, 0, 0]} rotation={[0, 0, 0.2]}>
        <boxGeometry args={[0.2, 0.08, 0.2]} />
        <meshPhysicalMaterial
          color={p.shadow}
          emissive={p.biolume}
          emissiveIntensity={0.05 + t.L * 0.02}
          metalness={0.15}
          roughness={0.55}
        />
      </mesh>
      <mesh position={[-0.9, 0, 0.05]}>
        <coneGeometry args={[0.04, 0.15, 4]} />
        <meshStandardMaterial color={p.shadow} />
      </mesh>
      <AnimeEyes p={p} L={t.L} x={0.1} y={0.12} z={0.25} r={0.07} sep={0.2} eyeScale={t.eyeScale} />
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
