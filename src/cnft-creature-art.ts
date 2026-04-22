import { hash32 } from "./collection-traits";
import {
  getArtVisualTraits,
  getBiomePalette,
  getLuminosityL,
  getSpeciesArchetypeIndex,
  type CnftArtPalette,
  type CnftArtVisualTraits,
} from "./cnft-visual-shared";
import type { Dna } from "./nft-metadata";

type Palette = CnftArtPalette;
type VisualTraits = CnftArtVisualTraits;

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function rnd(mint: string, salt: string, mod: number): number {
  return hash32(`${mint}::art::${salt}`) % (mod > 0 ? mod : 1);
}

function num(dna: Dna, key: string, def: number, min: number, max: number): number {
  const v = dna[key];
  if (typeof v === "number" && !Number.isNaN(v)) return Math.max(min, Math.min(max, v));
  return def;
}

/** Dermal mottling — density from Variant Seed + Pressure (camouflage load). */
function dermalMottle(p: Palette, mint: string, t: VisualTraits, salt: string): string {
  const n = 2 + (t.variantSeed % 4) + (t.pressure % 3);
  const o: string[] = [];
  for (let i = 0; i < n; i++) {
    const x = 100 + rnd(mint, `${salt}mx${i}`, 300);
    const y = 90 + rnd(mint, `${salt}my${i}`, 220);
    const rx = 4 + rnd(mint, `${salt}mr${i}`, 18);
    const ro = 0.1 + (t.pressure / 20) * 0.12;
    o.push(
      `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${rx * 0.55}" fill="${p.shadow}" fill-opacity="${ro}" transform="rotate(${rnd(mint, `${salt}mt${i}`, 50) - 25} ${x} ${y})"/>`
    );
  }
  return o.join("");
}

/** Subtle background cues tied to Biome (not random decoration — habitat context). */
function biomeAccents(biome: string, p: Palette, mint: string): string {
  const b = (biome || "").toLowerCase();
  const o: string[] = [];
  if (b.includes("hydro") || b.includes("fan")) {
    for (let i = 0; i < 10; i++) {
      o.push(
        `<circle cx="${30 + rnd(mint, `ha${i}`, 450)}" cy="${100 + rnd(mint, `hb${i}`, 280)}" r="${0.8 + rnd(mint, `hc${i}`, 3) / 2}" fill="#ff9f43" fill-opacity="0.14"/>`
      );
    }
    o.push(
      `<path d="M 40 450 Q 200 200 300 100" fill="none" stroke="#3d2015" stroke-width="0.4" stroke-opacity="0.15"/>`
    );
  } else if (b.includes("kelp") || b.includes("forest")) {
    o.push(
      `<path d="M 20 520 Q 90 200 30 -20" fill="none" stroke="#0d4f3a" stroke-width="5" stroke-linecap="round" stroke-opacity="0.12"/>`
    );
    o.push(
      `<path d="M 492 520 Q 420 200 480 -20" fill="none" stroke="#0a4030" stroke-width="4" stroke-linecap="round" stroke-opacity="0.1"/>`
    );
  } else if (b.includes("seep") || b.includes("cold")) {
    for (let k = 0; k < 7; k++) {
      o.push(
        `<ellipse cx="${rnd(mint, `s${k}`, 500)}" cy="${320 + rnd(mint, `s2${k}`, 60)}" rx="${2 + (k % 3)}" ry="${1.2}" fill="#7dd3fc" fill-opacity="0.05"/>`
      );
    }
  } else if (b.includes("canyon") || b.includes("phantom")) {
    o.push(
      `<path d="M 0 180 L 512 200 L 0 220 Z" fill="#1e1050" fill-opacity="0.04"/>`
    );
  }
  return `<g style="pointer-events:none">${o.join("")}</g>`;
}

/**
 * Anime-3D / toon-shaded benthic eye: crisp rim, L-driven iris glow, multi catchlights
 * (game-char shading; still zoological pupil shapes).
 */
function anime3dEye(x: number, y: number, r: number, mint: string, isRight: number, p: Palette, L: number, eyeScale = 1): string {
  const r0 = r * eyeScale;
  const wob = (rnd(mint, `e${isRight}`, 5) - 2) * 0.3;
  const cx = x + wob;
  const cy = y;
  const verticalSlit = rnd(mint, "pupi", 2) === 0;
  const pupW = verticalSlit ? r0 * 0.14 : r0 * 0.26;
  const pupH = verticalSlit ? r0 * 0.4 : r0 * 0.26;
  const irGlow = 0.45 + (L / 25) * 0.4;
  const topLid = -r0 * 0.92;
  return `<g transform="translate(${cx},${cy})">
<ellipse rx="${r0 * 1.12}" ry="${r0 * 1.02}" fill="#0a0b10" fill-opacity="0.35" transform="translate(1,2)"/>
<ellipse rx="${r0 * 1.08}" ry="${r0 * 0.98}" fill="#0e1522" stroke="#1a1f2e" stroke-width="1.65"/>
<path d="M ${-r0} ${topLid * 0.2} Q 0 ${topLid} ${r0} ${topLid * 0.2}" fill="none" stroke="#02060a" stroke-width="1.1" stroke-linecap="round" opacity="0.45"/>
<ellipse rx="${r0 * 0.86}" ry="${r0 * 0.78}" fill="url(#irisGrad)" fill-opacity="${irGlow}"/>
<ellipse rx="${pupW * 0.3}" ry="${pupH * 0.3}" cx="${-r0 * 0.1}" cy="${-r0 * 0.08}" fill="#ffffff" fill-opacity="0.65"/>
<ellipse rx="${pupW}" ry="${pupH}" fill="#030308"/>
<circle cx="${-r0 * 0.3}" cy="${-r0 * 0.25}" r="${r0 * 0.2}" fill="#ffffff" fill-opacity="0.6"/>
<circle cx="${-r0 * 0.1}" cy="${-r0 * 0.1}" r="${r0 * 0.1}" fill="#ffffff" fill-opacity="0.85"/>
<circle cx="${r0 * 0.15}" cy="${-r0 * 0.2}" r="${r0 * 0.04}" fill="#ffffff" fill-opacity="0.45"/>
<ellipse rx="${r0 * 1.1}" ry="${r0 * 1.0}" fill="none" stroke="url(#rimEye)" stroke-width="0.6" opacity="0.8"/>
</g>`;
}

/** Melanocetidae-inspired: distensible maw, illicium + esca, pectoral with radials, countershading. */
function lanternGulper(p: Palette, mint: string, t: VisualTraits): string {
  const body =
    "M 175 220 C 168 120, 260 90, 335 120 C 385 150, 398 200, 388 255 C 375 300, 310 320, 245 310 C 185 300, 165 280, 168 240 Z";
  const belly =
    "M 200 255 Q 256 300 320 255 Q 300 280 256 295 Q 210 280 200 255";
  const operculumPath = "M 300 195 Q 360 200 365 255";
  return `
<g>
<path d="${body}" fill="#020408" fill-opacity="0.2" transform="translate(2,3)"/>
<path d="${body}" fill="url(#celDerm)" stroke="#141b26" stroke-width="1.35" stroke-linejoin="round"/>
<path d="${body}" fill="none" stroke="url(#animeRimLine)" stroke-width="0.82" stroke-linejoin="round"/>
<ellipse cx="215" cy="150" rx="48" ry="24" fill="url(#keySpec)" fill-opacity="0.2" transform="rotate(-10 215 150)"/>
${dermalMottle(p, mint, t, "lg")}
<path d="${belly}" fill="url(#ventralShade)" fill-opacity="0.55" stroke="none"/>
<path d="M 230 255 Q 256 275 285 255" fill="none" stroke="#0a0c12" stroke-width="5" stroke-linecap="round" opacity="0.5"/>
<path d="M 220 255 Q 256 240 290 255" fill="none" stroke="#0a0c12" stroke-width="2" stroke-linecap="round" opacity="0.35"/>
<path d="M 252 150 L 256 78" stroke="${p.skin}" stroke-width="2.2" stroke-linecap="round"/>
<line x1="256" y1="78" x2="256" y2="58" stroke="#5c4030" stroke-width="1" stroke-linecap="round" opacity="0.6"/>
<g filter="url(#bloom)">
<circle cx="256" cy="52" r="11" fill="${p.biolume}" fill-opacity="0.9"/>
<circle cx="256" cy="52" r="4" fill="#fff8e7"/>
<circle cx="252" cy="50" r="1.2" fill="#ffffff" opacity="0.9"/>
</g>
<path d="M 252 55 Q 256 50 260 55" fill="none" stroke="${p.biolume}" stroke-width="0.4" opacity="0.5"/>
<path d="${operculumPath}" fill="none" stroke="#0f1720" stroke-width="1" opacity="0.5"/>
<g transform="translate(256,225) scale(${t.moodT.finSpread} 1) translate(-256,-225)">
<path d="M 200 200 Q 90 200 50 195 Q 30 200 20 188" fill="url(#pectoralL)" fill-opacity="0.85" stroke="${p.shadow}" stroke-width="0.6"/>
<g stroke="${p.shadow}" stroke-width="0.35" stroke-opacity="0.4">
<line x1="120" y1="200" x2="55" y2="195"/><line x1="125" y1="210" x2="60" y2="210"/><line x1="130" y1="220" x2="65" y2="220"/>
</g>
<path d="M 355 250 L 415 230 L 400 280 Z" fill="url(#pectoralL)" fill-opacity="0.9" stroke="${p.shadow}"/>
</g>
<path d="M 175 200 L 120 200 L 110 255 Q 95 280 100 300" fill="none" stroke="${p.skin}" stroke-width="0.3" opacity="0.25"/>
<path d="M 175 200 C 100 200 50 195 20 200" fill="none" stroke="${p.skinHi}" stroke-width="0.5" stroke-dasharray="0.5 4" opacity="0.3"/>
<circle cx="310" cy="200" r="1.2" fill="${p.shadow}" fill-opacity="0.4"/>
<circle cx="325" cy="210" r="0.8" fill="${p.shadow}" fill-opacity="0.35"/>
<circle cx="290" cy="220" r="0.7" fill="${p.shadow}" fill-opacity="0.3"/>
</g>
${anime3dEye(218, 188, 12, mint, 0, p, t.L, t.eyeScale)}
${anime3dEye(300, 188, 12, mint, 1, p, t.L, t.eyeScale)}`;
}

/** Fusiform midwater fish: keeled side, forked caudal, clear dorsal & anal, lateral line. */
function glassfinDrifter(p: Palette, mint: string, t: VisualTraits): string {
  const fs = t.moodT.finSpread;
  const trunk =
    "M 130 205 C 180 150, 330 150, 385 200 C 400 220, 370 255, 320 255 C 240 255, 160 255, 130 210 Z";
  return `
<g>
<path d="${trunk}" fill="#030508" fill-opacity="0.18" transform="translate(2,2)"/>
<path d="${trunk}" fill="url(#celDerm)" fill-opacity="0.88" stroke="#182230" stroke-width="1" stroke-linejoin="round"/>
<path d="${trunk}" fill="none" stroke="url(#animeRimLine)" stroke-width="0.78"/>
<ellipse cx="200" cy="170" rx="60" ry="30" fill="url(#keySpec)" fill-opacity="0.16" transform="rotate(-6 200 170)"/>
${dermalMottle(p, mint, t, "gf")}
<g transform="translate(400, 200) scale(${fs} 1) translate(-400,-200)">
<path d="M 200 180 Q 256 90 320 180" fill="url(#dorsalFin)" fill-opacity="0.5" stroke="${p.skin}" stroke-width="0.3"/>
<path d="M 210 250 Q 256 300 300 250" fill="url(#dorsalFin)" fill-opacity="0.45" stroke="${p.skin}" stroke-width="0.3"/>
<path d="M 380 200 Q 450 200 480 200 L 500 200 Q 480 180 400 195 Z" fill="url(#caudal)" fill-opacity="0.55" stroke="${p.skin}"/>
</g>
<path d="M 135 200 Q 100 200 80 200" fill="url(#jawG)" fill-opacity="0.35" stroke="none"/>
<path d="M 150 200 L 130 200 L 95 200" fill="none" stroke="${p.skin}" stroke-width="0.4" stroke-dasharray="0.3 3" opacity="0.4"/>
<path d="M 170 200 Q 300 198 360 200" fill="none" stroke="${p.skinHi}" stroke-width="0.4" stroke-dasharray="0.2 5" opacity="0.3"/>
<ellipse cx="180" cy="200" rx="2" ry="1.2" fill="#02060a" fill-opacity="0.15"/>
<ellipse cx="300" cy="201" rx="1.5" ry="0.8" fill="#02060a" fill-opacity="0.1"/>
<ellipse cx="250" cy="200" rx="1.2" ry="0.6" fill="#f0f9ff" fill-opacity="0.06"/>
</g>
${anime3dEye(198, 195, 8, mint, 0, p, t.L, t.eyeScale)}
${anime3dEye(255, 195, 8, mint, 1, p, t.L, t.eyeScale)}`;
}

/** Stomatopod: rostrum, maxillipeds, tergites, raptorial dactyl. */
function mantisShrimp(p: Palette, mint: string, segs: number, t: VisualTraits): string {
  const w = 44;
  const terg: string[] = [];
  for (let s = 0; s < segs; s++) {
    const x = 168 + s * 46 + rnd(mint, `sg${s}`, 5);
    terg.push(
      `<rect x="${x - w * 0.5}" y="200" width="${w * 0.9}" height="50" rx="8" fill="url(#celDerm)" stroke="#1a1008" stroke-width="0.9"/>`
    );
  }
  return `
<g>
<path d="M 150 200 L 140 150 L 175 130 L 200 195 Z" fill="url(#celDerm)" stroke="#1a1008" stroke-width="0.6"/>
${dermalMottle(p, mint, t, "mantis")}
<path d="M 100 200 Q 40 200 2 150 Q 0 100 30 100 Q 50 100 60 150 Q 75 200 100 200" fill="url(#dactylL)" stroke="${p.shadow}"/>
<path d="M 32 100 Q 0 50 -25 0" fill="none" stroke="${p.skin}" stroke-width="1.2" stroke-linecap="round" opacity="0.9"/>
<path d="M 20 100 Q 5 40 -15 20" fill="none" stroke="${p.skin}" stroke-width="0.7" stroke-linecap="round" opacity="0.75"/>
<path d="M 400 200 Q 480 200 512 150 Q 515 100 480 100 Q 455 100 450 150 Q 440 200 400 200" fill="url(#dactylL)" stroke="${p.shadow}"/>
<path d="M 480 100 Q 512 50 520 0" fill="none" stroke="${p.skin}" stroke-width="1.2" stroke-linecap="round" opacity="0.9"/>
<path d="M 490 100 Q 505 50 512 20" fill="none" stroke="${p.skin}" stroke-width="0.7" stroke-linecap="round" opacity="0.75"/>
${terg.join("")}
<g stroke="#1a0f08" stroke-width="0.3" fill="none" opacity="0.45">
<path d="M 168 205 L 350 205"/><path d="M 175 220 L 345 220"/><path d="M 180 232 L 340 232"/>
</g>
<path d="M 320 200 L 380 100 L 370 200 Z" fill="url(#telson)" fill-opacity="0.5" stroke="${p.shadow}"/>
<circle cx="155" cy="195" r="2" fill="${p.biolume}" filter="url(#bloom)"/>
<circle cx="300" cy="200" r="1.5" fill="${p.biolume}" filter="url(#bloom)"/>
</g>
${anime3dEye(100, 162, 8, mint, 0, p, t.L, t.eyeScale)}
${anime3dEye(150, 162, 8, mint, 1, p, t.L, t.eyeScale)}`;
}

function armSuckers(mint: string, p: Palette): string {
  const out: string[] = [];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 - Math.PI / 2;
    for (let j = 1; j <= 4; j++) {
      const t = 0.25 * j;
      const r = 38 + 22 * t + rnd(mint, `suc${i}${j}`, 4);
      const x = 256 + Math.cos(a) * r;
      const y = 200 + Math.sin(a) * (r * 0.7);
      out.push(`<ellipse cx="${x}" cy="${y}" rx="1.4" ry="1.1" fill="#120810" fill-opacity="0.7" stroke="${p.skin}" stroke-width="0.2"/>`);
    }
  }
  return out.join("");
}

function octoidWiggle(i: number, baseX: number, baseY: number, len: number, mint: string, k: number): string {
  const a = (i / 8) * Math.PI * 2 - Math.PI / 2;
  const Lm = len * k;
  const x0 = baseX + Math.cos(a) * 40;
  const y0 = baseY + Math.sin(a) * 30;
  const w1x = x0 + Math.cos(a) * (Lm * 0.4) + (rnd(mint, `t${i}a`, 32) - 16);
  const w1y = y0 + Math.sin(a) * (Lm * 0.4) + (rnd(mint, `t${i}b`, 20) - 10);
  const w2x = x0 + Math.cos(a) * (Lm * 0.8) + (rnd(mint, `t${i}c`, 40) - 20);
  const w2y = y0 + Math.sin(a) * (Lm * 0.8) + 38;
  return `M ${x0} ${y0} Q ${w1x} ${w1y} ${w2x} ${w2y} Q ${w2x + 12} ${w2y + 22} ${w2x} ${w2y + 50}`;
}

/** Cephalopod: funnel, mantle, arms with sub-dermal suckers. */
function inkcloudOctoid(p: Palette, mint: string, t: VisualTraits): string {
  const k = t.moodT.tentacleK;
  const tent: string[] = [];
  for (let i = 0; i < 8; i++) {
    const d = octoidWiggle(i, 256, 202, 58 + (rnd(mint, `L${i}`, 20) / 2), mint, k);
    tent.push(
      `<path d="${d}" fill="none" stroke="${p.shadow}" stroke-width="7.5" stroke-linecap="round" opacity="0.95"/>`
    );
    tent.push(`<path d="${d}" fill="none" stroke="${p.skin}" stroke-width="5" stroke-linecap="round" opacity="0.75"/>`);
    tent.push(
      `<path d="${d}" fill="none" stroke="${p.biolume}" stroke-width="1" stroke-linecap="round" opacity="0.18"/>`
    );
  }
  return `
<g>
<ellipse cx="256" cy="202" rx="80" ry="64" fill="url(#mantleCel)" stroke="#12141a" stroke-width="1.1"/>
${dermalMottle(p, mint, t, "oct")}
<path d="M 200 200 Q 256 150 320 200" fill="none" stroke="#0a0c0f" stroke-width="0.4" opacity="0.3"/>
<path d="M 300 200 L 340 195 L 335 250 Z" fill="url(#funnelG)" fill-opacity="0.6" stroke="#0a0a0a"/>
<ellipse cx="256" cy="200" rx="64" ry="20" fill="#000" fill-opacity="0.2" transform="rotate(-5 256 200)"/>
<ellipse cx="256" cy="200" rx="12" ry="3" fill="#02050a" fill-opacity="0.4"/>
<circle cx="240" cy="100" r="2.5" fill="#040810" fill-opacity="0.4" filter="url(#bloom)"/>
<circle cx="300" cy="90" r="1.5" fill="#040810" fill-opacity="0.35" filter="url(#bloom)"/>
${tent.join("")}
${armSuckers(mint, p)}
</g>
${anime3dEye(228, 186, 12, mint, 0, p, t.L, t.eyeScale)}
${anime3dEye(280, 186, 12, mint, 1, p, t.L, t.eyeScale)}`;
}

/** Eel: myomeres (chevrons), dorsal/ anal ridge, lateral line, heterocercal tail. */
function spineEel(p: Palette, mint: string, nSpine: number, t: VisualTraits): string {
  const girth = 24 + t.pressure * 0.55 + t.moodT.finSpread * 2;
  const path = "M 80 220 C 140 60, 240 100, 256 200 C 280 320, 380 300, 430 200";
  const myom: string[] = [];
  for (let i = 0; i < 9; i++) {
    const t = 0.1 + (i * 0.1);
    const x1 = 80 + t * 350;
    const y1 = 220 - Math.sin(t * 3.1) * 80;
    myom.push(
      `<path d="M ${x1 - 8} ${y1} L ${x1} ${y1 - 4} L ${x1 + 8} ${y1 + 1}" fill="none" stroke="${p.shadow}" stroke-width="0.4" stroke-opacity="0.35"/>`
    );
  }
  const sp: string[] = [];
  for (let i = 0; i < nSpine; i++) {
    const t = 0.12 + (i / Math.max(1, nSpine + 0.1)) * 0.7;
    const x = 80 + t * 350;
    const y = 220 - Math.sin(t * 3) * 75 - (i % 2) * 1.5;
    sp.push(
      `<path d="M ${x} ${y} l -2 -8 l 4 0 z" fill="${p.skinHi}" fill-opacity="0.7" stroke="${p.shadow}"/>`
    );
  }
  return `
<g>
<path d="${path}" fill="none" stroke="#040810" stroke-width="${girth + 10}" stroke-linecap="round" opacity="0.45"/>
<path d="${path}" fill="none" stroke="url(#eelCel)" stroke-width="${girth}" stroke-linecap="round"/>
<path d="${path}" fill="none" stroke="url(#animeRimLine)" stroke-width="1.05" stroke-linecap="round" opacity="0.65"/>
<path d="${path}" fill="none" stroke="${p.skinHi}" stroke-width="7" stroke-linecap="round" opacity="0.35"/>
${dermalMottle(p, mint, t, "eel")}
<path d="M 400 200 Q 450 200 500 200 L 500 150 Q 450 150 410 200" fill="url(#caudal)" fill-opacity="0.4" stroke="${p.shadow}"/>
<path d="M 100 200 Q 200 200 320 200" fill="none" stroke="${p.skinHi}" stroke-width="0.3" stroke-dasharray="0.3 4" opacity="0.3"/>
</g>
${myom.join("")}
${sp.join("")}
<g transform="translate(95, 165)">
${anime3dEye(0, 0, 9, mint, 0, p, t.L, t.eyeScale)}
</g>
<g transform="translate(110, 168)">
${anime3dEye(0, 0, 9, mint, 1, p, t.L, t.eyeScale)}
</g>`;
}

/** Diogenid-style: dextral shell, ambulatory pereopods, eyestalk. */
function coralHermit(p: Palette, mint: string, t: VisualTraits): string {
  return `
<g>
<path d="M 300 200 C 320 100, 200 50, 160 200 C 140 280, 200 300, 280 300 C 300 300 300 200 300 200" fill="url(#shellG)" stroke="#2a1a0e" stroke-width="0.5"/>
${dermalMottle(p, mint, t, "hermit")}
<path d="M 200 200 Q 256 100 300 200" fill="none" stroke="#1a0f0a" stroke-width="0.3" opacity="0.4"/>
<path d="M 220 200 Q 256 80 300 200" fill="none" stroke="#0f0804" stroke-width="0.25" opacity="0.35"/>
<path d="M 300 200 Q 256 200 200 200" fill="none" stroke="#0a0a0a" stroke-width="0.2" opacity="0.3"/>
<ellipse cx="200" cy="200" rx="8" ry="20" fill="#080504" fill-opacity="0.15"/>
<path d="M 240 300 Q 200 350 150 300" fill="url(#pleon)" fill-opacity="0.7" stroke="${p.shadow}"/>
<path d="M 160 300 L 140 360 L 155 365 Z" fill="url(#legsG)" stroke="${p.shadow}"/>
<path d="M 200 300 L 190 360 L 205 365 Z" fill="url(#legsG)" stroke="${p.shadow}"/>
<path d="M 240 300 L 235 360 L 248 365 Z" fill="url(#legsG)" stroke="${p.shadow}"/>
<path d="M 300 300 L 280 360 L 295 365 Z" fill="url(#legsG)" stroke="${p.shadow}"/>
<line x1="230" y1="175" x2="225" y2="150" stroke="${p.shadow}" stroke-width="1.2"/>
<line x1="255" y1="175" x2="260" y2="150" stroke="${p.shadow}" stroke-width="1.2"/>
<circle cx="225" cy="140" r="2" fill="${p.biolume}" filter="url(#bloom)"/>
<circle cx="260" cy="140" r="2" fill="${p.biolume}" filter="url(#bloom)"/>
<circle cx="256" cy="195" r="2.5" fill="#1a0f0a" fill-opacity="0.2"/>
</g>
${anime3dEye(232, 168, 8, mint, 0, p, t.L, t.eyeScale)}
${anime3dEye(268, 168, 8, mint, 1, p, t.L, t.eyeScale)}`;
}

/** Tegula-like: spiral sutures, opercular scar, muscled foot. */
function pressureSnail(p: Palette, mint: string, t: VisualTraits): string {
  return `
<g>
<path d="M 320 200 C 340 100, 200 50, 160 200 C 130 300 280 320 300 200" fill="url(#shellG2)" stroke="#1a1a1c" stroke-width="0.4"/>
${dermalMottle(p, mint, t, "snail")}
<path d="M 200 200 Q 256 100 300 200" fill="none" stroke="#0c0c10" stroke-width="0.2" opacity="0.4"/>
<path d="M 180 200 Q 256 60 300 200" fill="none" stroke="#0c0c10" stroke-width="0.2" opacity="0.3"/>
<path d="M 300 200 Q 200 200 100 200" fill="none" stroke="#0c0c10" stroke-width="0.2" opacity="0.2"/>
<ellipse cx="150" cy="300" rx="110" ry="32" fill="url(#footG)" fill-opacity="0.55" stroke="#0a0a0c"/>
<path d="M 140 300 Q 256 360 360 300" fill="url(#siphon)" fill-opacity="0.3" stroke="none"/>
<path d="M 200 200 L 190 200" fill="none" stroke="${p.skin}" stroke-width="0.2" transform="rotate(-8 200 200)" opacity="0.3"/>
<g stroke="#0a0a0a" stroke-width="0.15" fill="none" opacity="0.25">
<path d="M 120 300 Q 256 320 380 300"/><path d="M 100 300 Q 256 330 400 300"/>
</g>
</g>
<g transform="translate(0, -8)">
${anime3dEye(192, 188, 6, mint, 0, p, t.L, t.eyeScale)}
${anime3dEye(208, 188, 6, mint, 1, p, t.L, t.eyeScale)}
</g>`;
}

/** Batoid: pectoral disc, spiracles, rostrum, pelvic fusion line, stinger. */
function echoRay(p: Palette, mint: string, t: VisualTraits): string {
  return `
<g>
<path d="M 88 200 Q 256 28 430 200 Q 400 120 300 100 Q 256 85 200 100 Q 120 120 88 200 Z" fill="url(#rayDisc)" stroke="#101820" stroke-width="0.8"/>
<ellipse cx="200" cy="120" rx="100" ry="50" fill="url(#keySpec)" fill-opacity="0.1" transform="rotate(-2 200 120)"/>
${dermalMottle(p, mint, t, "ray")}
<path d="M 88 200 Q 200 200 300 200" fill="none" stroke="${p.skinHi}" stroke-width="0.3" stroke-dasharray="0.3 2.5" opacity="0.25"/>
<path d="M 256 100 Q 256 200 256 300" fill="none" stroke="#0a0a0a" stroke-width="0.2" stroke-dasharray="0.1 1.2" opacity="0.2"/>
<ellipse cx="220" cy="150" rx="4" ry="1.2" fill="#0a0a0a" fill-opacity="0.4" transform="rotate(-5 220 150)"/>
<ellipse cx="288" cy="150" rx="4" ry="1.2" fill="#0a0a0a" fill-opacity="0.4" transform="rotate(5 288 150)"/>
<g stroke="#0a0a0a" stroke-width="0.4" fill="none" stroke-opacity="0.2">
<line x1="210" y1="200" x2="210" y2="250"/><line x1="220" y1="200" x2="220" y2="255"/><line x1="250" y1="200" x2="250" y2="262"/><line x1="290" y1="200" x2="290" y2="255"/>
</g>
<path d="M 100 200 Q 100 100 200 100 Q 256 80 300 100 Q 400 100 400 200" fill="url(#dorsalRay)" fill-opacity="0.1"/>
<path d="M 400 200 Q 500 200 500 100 L 480 20 Q 400 0 400 200" fill="url(#rayTail)" fill-opacity="0.35" stroke="${p.shadow}"/>
<path d="M 500 20 L 505 0 L 495 5 Z" fill="#1a0a0a" fill-opacity="0.6"/>
<path d="M 256 90 Q 300 100 256 100 Q 200 100 256 90" fill="url(#noseB)" fill-opacity="0.2"/>
<circle cx="256" cy="200" r="0.5" fill="#000" fill-opacity="0.15"/>
</g>
${anime3dEye(200, 168, 10, mint, 0, p, t.L, t.eyeScale)}
${anime3dEye(300, 168, 10, mint, 1, p, t.L, t.eyeScale)}`;
}

function bodyFor(a: number, p: Palette, mint: string, t: VisualTraits): string {
  const nSpine = 5 + (t.pressure % 4);
  const mantisSegs = 3 + (t.pressure % 3);
  switch (a) {
    case 0:
      return lanternGulper(p, mint, t);
    case 1:
      return glassfinDrifter(p, mint, t);
    case 2:
      return mantisShrimp(p, mint, mantisSegs, t);
    case 3:
      return inkcloudOctoid(p, mint, t);
    case 4:
      return spineEel(p, mint, nSpine, t);
    case 5:
      return coralHermit(p, mint, t);
    case 6:
      return pressureSnail(p, mint, t);
    case 7:
    default:
      return echoRay(p, mint, t);
  }
}

/**
 * Renders a deterministic trench “dex” creature: cel / toon shading (Pokémon-card style),
 * luminosity- and mood-driven pose, variant-seed eye scale, mottling from Variant Seed + Pressure,
 * and biome backdrops.
 */
export function buildCreaturePreviewSvg(dna: Dna, name: string, mint: string): string {
  const species = typeof dna.Species === "string" ? dna.Species : "Trench creature";
  const biome = typeof dna.Biome === "string" ? dna.Biome : "Abyssal Plain";
  const mood = typeof dna.Mood === "string" ? dna.Mood : "";
  const L = getLuminosityL(dna);
  const p = getBiomePalette(biome, mint);
  const a = getSpeciesArchetypeIndex(species, mint);
  const t = getArtVisualTraits(dna, mint, L);
  const body = bodyFor(a, p, mint, t);

  const g2 = 2.2 + L * 0.45;
  const g3 = 0.35 + (L / 22) * 0.35;

  const particulates: string[] = [];
  for (let i = 0; i < 32; i++) {
    const x = rnd(mint, `p${i}`, 500) + 6;
    const y = rnd(mint, `q${i}`, 420) + 10;
    const s = 0.15 + (rnd(mint, `r${i}`, 25) / 30);
    const o = 0.04 + (i % 3) * 0.03;
    particulates.push(`<circle cx="${x}" cy="${y}" r="${s}" fill="#e0f2fe" fill-opacity="${o}"/>`);
  }

  const caust: string[] = [];
  for (let c = 0; c < 4; c++) {
    const x = 40 + c * 120 + rnd(mint, `c${c}`, 40);
    caust.push(
      `<ellipse cx="${x}" cy="${80 + c * 15}" rx="${120 + c * 20}" ry="${18 - c * 2}" fill="#bfe8ff" fill-opacity="0.04" transform="rotate(-8 ${x} 80)"/>`
    );
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
<defs>
<radialGradient id="bg" cx="45%" cy="8%" r="90%">
<stop offset="0" stop-color="#1a2a3a" stop-opacity="0.35"/>
<stop offset="0.15" stop-color="${p.water}"/>
<stop offset="0.5" stop-color="${p.deep}"/>
<stop offset="1" stop-color="#000"/>
</radialGradient>
<linearGradient id="celDerm" x1="10%" y1="0" x2="90%" y2="100%">
<stop offset="0" stop-color="${p.skinHi}"/>
<stop offset="0.3" stop-color="${p.skinHi}"/>
<stop offset="0.36" stop-color="${p.skin}"/>
<stop offset="0.7" stop-color="${p.skin}"/>
<stop offset="0.77" stop-color="${p.shadow}"/>
<stop offset="1" stop-color="#04080f"/>
</linearGradient>
<linearGradient id="skinG" x1="20%" y1="5%" x2="80%" y2="95%">
<stop offset="0" stop-color="${p.skinHi}"/>
<stop offset="0.4" stop-color="${p.skin}"/>
<stop offset="1" stop-color="${p.shadow}"/>
</linearGradient>
<radialGradient id="keySpec" cx="30%" cy="18%" r="55%">
<stop offset="0" stop-color="#ffffff" stop-opacity="0.5"/>
<stop offset="0.25" stop-color="#e0e8f8" stop-opacity="0.15"/>
<stop offset="0.5" stop-color="transparent"/>
<stop offset="1" stop-color="transparent"/>
</radialGradient>
<linearGradient id="animeRimLine" x1="0" y1="0" x2="0" y2="1">
<stop offset="0" stop-color="#c4d0e8" stop-opacity="0.65"/>
<stop offset="0.22" stop-color="transparent"/>
<stop offset="0.78" stop-color="transparent"/>
<stop offset="1" stop-color="#030408" stop-opacity="0.45"/>
</linearGradient>
<radialGradient id="irisGrad" cx="32%" cy="32%" r="70%">
<stop offset="0" stop-color="${p.biolume}"/>
<stop offset="0.5" stop-color="${p.skinHi}"/>
<stop offset="1" stop-color="#0a0c10"/>
</radialGradient>
<linearGradient id="rimEye" x1="0" y1="0" x2="1" y2="1">
<stop offset="0" stop-color="#d8e4ff" stop-opacity="0.35"/>
<stop offset="0.4" stop-color="transparent"/>
<stop offset="1" stop-color="#0a0c12" stop-opacity="0.5"/>
</linearGradient>
<linearGradient id="eelCel" x1="0" y1="0" x2="1" y2="0">
<stop offset="0" stop-color="${p.skinHi}"/>
<stop offset="0.4" stop-color="${p.skin}"/>
<stop offset="1" stop-color="${p.shadow}"/>
</linearGradient>
<radialGradient id="mantleCel" cx="32%" cy="24%" r="78%">
<stop offset="0" stop-color="${p.skinHi}"/>
<stop offset="0.45" stop-color="${p.skin}"/>
<stop offset="0.9" stop-color="#05060a"/>
<stop offset="1" stop-color="#000"/>
</radialGradient>
<radialGradient id="ventralShade" cx="50%" cy="80%" r="60%">
<stop offset="0" stop-color="#e8f0f8" stop-opacity="0.12"/>
<stop offset="0.4" stop-color="#000" stop-opacity="0"/>
<stop offset="1" stop-color="#000" stop-opacity="0.2"/>
</radialGradient>
<linearGradient id="rim" x1="0" y1="0" x2="0" y2="1">
<stop offset="0" stop-color="#a8c0d8" stop-opacity="0.5"/>
<stop offset="0.5" stop-color="transparent"/>
<stop offset="1" stop-color="#000" stop-opacity="0.2"/>
</linearGradient>
<linearGradient id="pectoralL" x1="0" y1="0" x2="1" y2="0">
<stop offset="0" stop-color="${p.shadow}"/>
<stop offset="0.5" stop-color="${p.skin}"/>
<stop offset="1" stop-color="${p.skinHi}"/>
</linearGradient>
<radialGradient id="dorsalFin" cx="50%" cy="0%" r="100%">
<stop offset="0" stop-color="${p.biolume}" stop-opacity="0.25"/>
<stop offset="1" stop-color="${p.shadow}" stop-opacity="0.5"/>
</radialGradient>
<linearGradient id="caudal" x1="0" y1="0" x2="1" y2="0">
<stop offset="0" stop-color="${p.skin}"/>
<stop offset="1" stop-color="${p.shadow}"/>
</linearGradient>
<linearGradient id="jawG" x1="1" y1="0" x2="0" y2="0">
<stop offset="0" stop-color="transparent"/>
<stop offset="0.3" stop-color="#02060a" stop-opacity="0.2"/>
<stop offset="1" stop-color="#02060a" stop-opacity="0.1"/>
</linearGradient>
<linearGradient id="carapace" x1="0" y1="0" x2="0" y2="1">
<stop offset="0" stop-color="${p.skinHi}"/>
<stop offset="0.4" stop-color="${p.skin}"/>
<stop offset="1" stop-color="#1a1008"/>
</linearGradient>
<linearGradient id="dactylL" x1="0" y1="0" x2="1" y2="1">
<stop offset="0" stop-color="#2a1a0c"/>
<stop offset="0.4" stop-color="${p.skin}"/>
<stop offset="1" stop-color="#0a0a0a"/>
</linearGradient>
<linearGradient id="telson" x1="0" y1="0" x2="1" y2="0">
<stop offset="0" stop-color="#1a1a1c"/>
<stop offset="1" stop-color="${p.shadow}"/>
</linearGradient>
<radialGradient id="mantleG" cx="40%" cy="30%" r="80%">
<stop offset="0" stop-color="${p.skinHi}"/>
<stop offset="0.5" stop-color="${p.skin}"/>
<stop offset="1" stop-color="#050508"/>
</radialGradient>
<linearGradient id="funnelG" x1="0" y1="0" x2="1" y2="1">
<stop offset="0" stop-color="#1a0a0a"/>
<stop offset="1" stop-color="#080808"/>
</linearGradient>
<radialGradient id="rayDisc" cx="45%" cy="35%" r="75%">
<stop offset="0" stop-color="${p.skinHi}"/>
<stop offset="0.55" stop-color="${p.skin}"/>
<stop offset="1" stop-color="#050a10"/>
</radialGradient>
<linearGradient id="dorsalRay" x1="0.5" y1="0" x2="0.5" y2="1">
<stop offset="0" stop-color="#fff" stop-opacity="0.15"/>
<stop offset="0.2" stop-color="transparent"/>
<stop offset="1" stop-color="#000" stop-opacity="0.15"/>
</linearGradient>
<linearGradient id="rayTail" x1="0" y1="0" x2="1" y2="0">
<stop offset="0" stop-color="${p.shadow}"/>
<stop offset="1" stop-color="#020610"/>
</linearGradient>
<radialGradient id="noseB" cx="50%" cy="0%" r="100%">
<stop offset="0" stop-color="#000" stop-opacity="0.1"/>
<stop offset="1" stop-color="transparent"/>
</radialGradient>
<linearGradient id="shellG" x1="0" y1="0" x2="1" y2="1">
<stop offset="0" stop-color="#8b6f4a"/>
<stop offset="0.3" stop-color="#5a4030"/>
<stop offset="1" stop-color="#2a1a0c"/>
</linearGradient>
<linearGradient id="pleon" x1="0" y1="0" x2="0" y2="1">
<stop offset="0" stop-color="${p.skin}"/>
<stop offset="1" stop-color="#1a0a0a"/>
</linearGradient>
<linearGradient id="legsG" x1="0" y1="0" x2="0" y2="1">
<stop offset="0" stop-color="${p.skin}"/>
<stop offset="1" stop-color="#0a0a0a"/>
</linearGradient>
<radialGradient id="shellG2" cx="30%" cy="30%" r="70%">
<stop offset="0" stop-color="#6a5a4a"/>
<stop offset="0.4" stop-color="#3a3028"/>
<stop offset="1" stop-color="#1a1a1c"/>
</radialGradient>
<radialGradient id="footG" cx="50%" cy="0%" r="100%">
<stop offset="0" stop-color="${p.skin}"/>
<stop offset="0.4" stop-color="#2a1a1a" stop-opacity="0.3"/>
<stop offset="1" stop-color="#0a0a0a" stop-opacity="0.2"/>
</radialGradient>
<radialGradient id="siphon" cx="50%" cy="0%" r="100%">
<stop offset="0" stop-color="#000" stop-opacity="0.1"/>
<stop offset="1" stop-color="transparent"/>
</radialGradient>
<radialGradient id="sheen" cx="30%" cy="20%" r="60%">
<stop offset="0" stop-color="#ffffff" stop-opacity="0.12"/>
<stop offset="0.5" stop-color="transparent"/>
<stop offset="1" stop-color="#000" stop-opacity="0"/>
</radialGradient>
<radialGradient id="vignette" cx="50%" cy="45%" r="75%">
<stop offset="0" stop-color="transparent"/>
<stop offset="0.75" stop-color="#000" stop-opacity="0.25"/>
<stop offset="1" stop-color="#000" stop-opacity="0.65"/>
</radialGradient>
<linearGradient id="labelFade" x1="0" y1="1" x2="0" y2="0">
<stop offset="0" stop-color="#020617" stop-opacity="0.94"/>
<stop offset="0.4" stop-color="transparent"/>
</linearGradient>
<filter id="glow" x="-5%" y="-5%" width="110%" height="110%">
<feGaussianBlur in="SourceGraphic" stdDeviation="1" result="a"/>
<feMerge><feMergeNode in="a"/><feMergeNode in="SourceGraphic"/></feMerge>
</filter>
<filter id="bloom" x="-50%" y="-50%" width="200%" height="200%">
<feGaussianBlur stdDeviation="${g2}" result="b"/>
<feColorMatrix in="b" type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 ${g3} 0" result="c"/>
<feMerge><feMergeNode in="c"/><feMergeNode in="SourceGraphic"/></feMerge>
</filter>
<filter id="filmGrain" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">
<feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="2" result="n"/>
<feColorMatrix in="n" type="luminanceToAlpha" result="a"/>
<feFlood flood-color="#bcd4e6" flood-opacity="0.12" result="f"/>
<feComposite in="f" in2="a" operator="in" result="c"/>
<feMerge><feMergeNode in="c"/></feMerge>
</filter>
</defs>
<rect width="512" height="512" fill="url(#bg)"/>
<rect width="512" height="512" filter="url(#filmGrain)" style="pointer-events:none" />
${caust.join("")}
${particulates.join("")}
${biomeAccents(biome, p, mint)}
<g transform="translate(0,${t.moodT.dy}) rotate(${t.moodT.rot} 256 220)">
${body}
</g>
<rect width="512" height="512" fill="url(#vignette)" style="pointer-events:none"/>
<rect y="360" width="512" height="152" fill="url(#labelFade)" style="pointer-events:none"/>
<rect x="20" y="400" width="472" height="80" fill="#0a1018" fill-opacity="0.78" stroke="#1c3048" stroke-width="1" rx="10"/>
<text x="256" y="432" text-anchor="middle" fill="#f8fafc" font-family="system-ui,Segoe UI,sans-serif" font-size="17" font-weight="600">${esc(
    name || "Trench creature"
  )}</text>
<text x="256" y="456" text-anchor="middle" fill="#94a3b8" font-family="system-ui,Segoe UI,sans-serif" font-size="12">${esc(
    species
  )}${mood ? " · " + esc(mood) : ""} · ${esc(biome)}</text>
</svg>`;
}
