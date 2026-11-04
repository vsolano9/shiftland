// Pure music theory for the Shiftland soundscape: note names, the biome's five-note "plate scale", seeded randomness.
// No WebAudio here, so all of it is unit-tested (theory.test.ts).

const PC: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** 'F#4' -> 66, 'Bb2' -> 46 (C4 = 60). */
export function midi(name: string): number {
  const m = /^([A-G])(#|b)?(-?\d)$/.exec(name);
  if (!m) throw new Error(`bad note ${name}`);
  return 12 * (Number(m[3]) + 1) + PC[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
}

export const freq = (m: number): number => 440 * 2 ** ((m - 69) / 12);

/** mulberry32: a small seeded generator, so offline renders and tests repeat exactly. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Plate order on the five-note scale: root, third-ish, fifth-ish, sixth-ish, second. Any pair is consonant. */
const PLATE_ORDER = [0, 2, 3, 4, 1];

/** Plate 0 is the root, later plates walk PLATE_ORDER; plates past five sit an octave up. */
export function plateNote(scale: readonly number[], plate: number): number {
  const p = Math.max(0, Math.floor(plate));
  return scale[PLATE_ORDER[p % PLATE_ORDER.length] % scale.length] + 12 * Math.floor(p / PLATE_ORDER.length);
}

/** Note `steps` up the scale from index 0, wrapping octaves, so scale steps stay in key at any height. */
export function scaleStep(scale: readonly number[], steps: number): number {
  const n = scale.length;
  const oct = Math.floor(steps / n);
  return scale[steps - oct * n] + 12 * oct;
}

/** Scale index of the note in the scale closest to `m`, in any octave (for pinning a ping to the key). */
export function snap(scale: readonly number[], m: number): number {
  let best = scale[0], d = Infinity;
  for (const s of scale) for (let o = -5; o <= 5; o++) {
    const c = s + 12 * o, dd = Math.abs(c - m);
    if (dd < d) { d = dd; best = c; }
  }
  return best;
}

/** Goal-tick pair: a rising chime whose top is three scale steps above the base (a fourth, fifth or sixth). */
export function tickPair(scale: readonly number[], variant: number): [number, number] {
  const v = Math.max(0, Math.floor(variant)) % scale.length;
  return [scaleStep(scale, v), scaleStep(scale, v + 3)];
}

/** Goal-lost pair: a falling minor third inside the scale (every biome's five notes hold one). */
export function fallingThird(scale: readonly number[]): [number, number] {
  for (let up = scale.length * 2 - 1; up > 0; up--) for (let down = up - 1; down >= 0; down--) {
    if (scaleStep(scale, up) - scaleStep(scale, down) === 3) return [scaleStep(scale, up), scaleStep(scale, down)];
  }
  return [scale[2], scale[2] - 3];
}
