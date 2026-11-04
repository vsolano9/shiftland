// Sample generators: every instrument note is computed once into a Float32Array (additive partials, or Karplus-Strong
// for the plucked string) and cached by the player, so a note costs one buffer source instead of three oscillators.
// Pure maths: no WebAudio here, so tests can check pitch and decay directly.
import { freq, rng } from './theory.ts';
import type { Inst } from './songs.ts';

export interface Rendered { data: Float32Array; rate: number; gain: number }

/** ratio, amplitude, decay seconds (time to 1/e). */
type Partial = [number, number, number];
const MAX_PARTIAL_HZ = 9000; // keeps the top end tame and clear of Nyquist

function additive(f: number, sr: number, dur: number, partials: Partial[], attack: number, thump = 0): Float32Array {
  const n = Math.ceil(dur * sr), out = new Float32Array(n);
  for (const [ratio, amp, decay] of partials) {
    const hz = f * ratio;
    if (hz > MAX_PARTIAL_HZ) continue;
    // two-pole recurrence: sine and exponential decay without a Math call per sample
    const w = (2 * Math.PI * hz) / sr, g = Math.exp(-1 / (decay * sr));
    const c = 2 * g * Math.cos(w);
    let y1 = 0, y2 = (-amp * Math.sin(w)) / g;
    for (let i = 0; i < n; i++) {
      out[i] += y1;
      const y = c * y1 - g * g * y2;
      y2 = y1; y1 = y;
    }
  }
  if (thump > 0) { // mallet: a few milliseconds of low-passed noise
    const r = rng(Math.round(f));
    let lp = 0;
    const len = Math.min(n, Math.floor(0.012 * sr));
    for (let i = 0; i < len; i++) {
      lp += 0.18 * (r() * 2 - 1 - lp);
      out[i] += lp * thump * (1 - i / len) ** 2;
    }
  }
  fadeEnds(out, attack, sr);
  return out;
}

function fadeEnds(out: Float32Array, attack: number, sr: number): void {
  const a = Math.floor(attack * sr);
  for (let i = 0; i < a; i++) out[i] *= 0.5 - 0.5 * Math.cos((Math.PI * i) / a);
  const r = Math.min(out.length, Math.floor(0.03 * sr));
  for (let i = 0; i < r; i++) out[out.length - 1 - i] *= i / r;
}

/** Karplus-Strong string with a soft, plucked-off-centre excitation. Plays back at `rate` to land exactly in tune. */
function pluck(f: number, sr: number, dur: number): { data: Float32Array; rate: number } {
  const period = Math.max(2, Math.ceil(sr / f + 0.5)); // the two-point average below shortens the loop by half a sample
  const n = Math.ceil(dur * sr), out = new Float32Array(n), line = new Float32Array(period);
  const r = rng(Math.round(f * 7));
  for (let i = 0; i < period; i++) line[i] = r() * 2 - 1;
  for (let pass = 0; pass < 5; pass++) for (let i = 0; i < period; i++) line[i] = 0.5 * (line[i] + line[(i + 1) % period]);
  const pick = Math.max(1, Math.round(period * 0.22)), comb = line.slice();
  let mean = 0;
  for (let i = 0; i < period; i++) { line[i] = comb[i] - 0.9 * comb[(i + pick) % period]; mean += line[i] / period; }
  for (let i = 0; i < period; i++) line[i] -= mean;
  const loss = 10 ** (-2.4 / (dur * (sr / (period - 0.5)))); // about -48 dB by the end of the note
  let idx = 0;
  for (let i = 0; i < n; i++) {
    const a = line[idx], b = line[(idx + 1) % period];
    out[i] = a;
    line[idx] = loss * 0.5 * (a + b);
    idx = (idx + 1) % period;
  }
  fadeEnds(out, 0.002, sr);
  return { data: out, rate: f / (sr / (period - 0.5)) };
}

const lerp = (a: number, b: number, t: number): number => a + (b - a) * Math.max(0, Math.min(1, t));

/** Peak-normalised note plus its balance gain. Decays shorten up the range, as a real bar or tine does. */
export function renderNote(inst: Inst, m: number, sr: number): Rendered {
  const f = freq(m), up = (m - 48) / 36; // 0 at C3, 1 at C6
  let data: Float32Array, rate = 1, gain = 1;
  switch (inst) {
    case 'marimba': { // tuned bar: fundamental, the fourth harmonic it is cut for, a faint tenth, and a soft mallet
      const d = lerp(0.62, 0.26, up);
      data = additive(f, sr, d * 3.2, [[1, 1, d], [2, 0.05, d * 0.5], [3.95, 0.16, d * 0.26], [9.6, 0.025, 0.03]], 0.0035, 0.09);
      break;
    }
    case 'kalimba': { // steel tine: cantilever partials 1 : 6.27, with buzz at the low harmonics
      const d = lerp(1.0, 0.5, up);
      data = additive(f, sr, d * 3.4, [[1, 1, d], [2, 0.07, d * 0.4], [3, 0.03, d * 0.25], [6.27, 0.1, 0.05]], 0.002, 0.03);
      gain = 0.92;
      break;
    }
    case 'pluck': {
      const p = pluck(f, sr, lerp(2.6, 1.5, up));
      data = p.data; rate = p.rate; gain = 1.3;
      break;
    }
    case 'musicbox': { // comb tooth: pure, glassy, long, with a tiny tick at the pluck
      data = additive(f, sr, 3, [[1, 1, 0.85], [2, 0.08, 0.4], [3.01, 0.035, 0.22], [6.27, 0.07, 0.035]], 0.0015);
      gain = 0.78;
      break;
    }
    case 'bell': { // free bar: 1, 2.76, 5.4, kept very soft above the fundamental
      data = additive(f, sr, 4, [[1, 1, 1.25], [2.76, 0.14, 0.5], [5.4, 0.035, 0.16]], 0.004);
      gain = 0.55;
      break;
    }
    case 'bass': { // warm round bass with enough second and third harmonic to read on laptop speakers
      data = additive(f, sr, 2.6, [[1, 1, 0.8], [2, 0.3, 0.5], [3, 0.09, 0.28]], 0.014);
      gain = 0.42;
      break;
    }
    case 'shaker': data = shaker(sr); gain = 0.6; break;
    case 'wood': data = additive(740, sr, 0.16, [[1, 1, 0.024], [1.62, 0.45, 0.014], [2.8, 0.1, 0.008]], 0.001); gain = 0.55; break;
    case 'drum': data = drum(sr); gain = 0.8; break;
  }
  normalise(data);
  return { data, rate, gain };
}

function normalise(d: Float32Array): void {
  let peak = 0;
  for (let i = 0; i < d.length; i++) peak = Math.max(peak, Math.abs(d[i]));
  if (peak > 0) for (let i = 0; i < d.length; i++) d[i] /= peak;
}

function shaker(sr: number): Float32Array {
  const n = Math.floor(0.11 * sr), out = new Float32Array(n), r = rng(11);
  let hp = 0, lp = 0;
  for (let i = 0; i < n; i++) {
    const x = r() * 2 - 1;
    lp += 0.42 * (x - lp); // tame the very top
    hp += 0.16 * (lp - hp); // and lose the bottom
    const t = i / n;
    out[i] = (lp - hp) * Math.min(1, t * 9) * (1 - t) ** 3;
  }
  return out;
}

/** Soft frame drum: a low sine that sags in pitch, with a puff of filtered noise. */
function drum(sr: number): Float32Array {
  const n = Math.floor(0.5 * sr), out = new Float32Array(n), r = rng(5);
  let phase = 0, lp = 0;
  for (let i = 0; i < n; i++) {
    const t = i / sr, f = 74 + 46 * Math.exp(-t / 0.035);
    phase += (2 * Math.PI * f) / sr;
    lp += 0.1 * (r() * 2 - 1 - lp);
    out[i] = Math.sin(phase) * Math.exp(-t / 0.13) + lp * 0.5 * Math.exp(-t / 0.012);
  }
  fadeEnds(out, 0.003, sr);
  return out;
}

/** Noise for scrapes, surf and rumble: 'white', or 'brown' for low rumble and water. */
export function noise(kind: 'white' | 'brown', seconds: number, sr: number, seed: number): Float32Array {
  const n = Math.floor(seconds * sr), out = new Float32Array(n), r = rng(seed);
  let b = 0;
  for (let i = 0; i < n; i++) {
    const w = r() * 2 - 1;
    if (kind === 'white') out[i] = w * 0.5;
    else { b = (b + 0.02 * w) / 1.02; out[i] = b * 3.5; }
  }
  const x = Math.min(Math.floor(0.25 * sr), n >> 2); // crossfade the seam so the buffer loops without a click
  for (let i = 0; i < x; i++) {
    const t = i / x;
    out[i] = out[i] * Math.sqrt(t) + out[n - x + i] * Math.sqrt(1 - t);
  }
  return out.subarray(0, n - x);
}

/** Room impulse: decaying noise that darkens as it decays, decorrelated per channel, with a short pre-delay. */
export function impulse(seconds: number, sr: number, seed: number): Float32Array {
  const n = Math.floor(seconds * sr), out = new Float32Array(n), r = rng(seed), pre = Math.floor(0.018 * sr);
  let lp = 0;
  for (let i = pre; i < n; i++) {
    const t = (i - pre) / sr, cut = 0.05 + 0.32 * Math.exp(-t / 0.4);
    lp += cut * (r() * 2 - 1 - lp);
    out[i] = lp * Math.exp(-t / (seconds * 0.22)) * Math.min(1, t / 0.006);
  }
  let energy = 0;
  for (let i = 0; i < n; i++) energy += out[i] * out[i];
  const k = 1 / Math.sqrt(energy);
  for (let i = 0; i < n; i++) out[i] *= k;
  return out;
}

/** A wave for the pad: harmonics falling faster than a saw, and warm before the low-pass even starts. */
export function padWaveCoefficients(): { real: Float32Array; imag: Float32Array } {
  const n = 14, real = new Float32Array(n), imag = new Float32Array(n);
  for (let k = 1; k < n; k++) imag[k] = (k % 2 ? 1 : 0.55) / k ** 1.7;
  return { real, imag };
}
