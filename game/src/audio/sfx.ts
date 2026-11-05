// SFX recipes (docs/design-plates.md "Sound recipes"). Each builds a short node graph, or plays cached instrument notes
// pinned to the current scale so moves add to the music. A Voice owns its nodes and disconnects them when its last
// source or note ends, so nothing leaks.
import type { Inst } from './songs.ts';
import { fallingThird, freq, plateNote, scaleStep, snap, tickPair } from './theory.ts';
import type { Sfx } from './audio.ts';

export interface SfxOpts { plate?: number; pan?: number; intensity?: number; duration?: number; variant?: number }

export interface SfxHost {
  ctx: BaseAudioContext;
  sfxOut: AudioNode;
  readonly scale: number[];
  readonly chord: number[];
  rand(): number;
  noiseBuffer(kind: 'white' | 'brown'): AudioBuffer;
  note(inst: Inst, m: number, t: number, vel: number, dest: AudioNode, cut?: number, done?: () => void): void;
  padWave(): PeriodicWave;
  duck(seconds: number): void;
  voiceStarted(): void;
  voiceEnded(): void;
}

export class Voice {
  readonly out: GainNode;
  private nodes: AudioNode[] = [];
  private live = 0;
  private ended = false;
  private readonly h: SfxHost;

  constructor(h: SfxHost, pan = 0, dest: AudioNode = h.sfxOut) {
    this.h = h;
    this.out = this.keep(h.ctx.createGain());
    let tail: AudioNode = this.out;
    if (pan !== 0 && h.ctx.createStereoPanner) {
      const p = this.keep(h.ctx.createStereoPanner());
      p.pan.value = Math.max(-1, Math.min(1, pan));
      this.out.connect(p);
      tail = p;
    }
    tail.connect(dest);
    h.voiceStarted();
  }

  private keep<T extends AudioNode>(n: T): T { this.nodes.push(n); return n; }
  private readonly oneDone = (): void => { if (--this.live === 0) this.finish(); };

  private finish(): void {
    if (this.ended) return;
    this.ended = true;
    for (const n of this.nodes) n.disconnect();
    this.h.voiceEnded();
  }

  private source<T extends AudioScheduledSourceNode>(n: T, dest: AudioNode, t1: number): T {
    this.keep(n);
    this.live++;
    n.connect(dest);
    n.onended = this.oneDone;
    n.stop(t1);
    return n;
  }

  /** Closes the voice if it ended up starting nothing. */
  release(): void { if (this.live === 0) this.finish(); }

  gain(dest: AudioNode | AudioParam | null, value = 1): GainNode {
    const g = this.keep(this.h.ctx.createGain());
    g.gain.value = value;
    if (dest) g.connect(dest as AudioNode);
    return g;
  }

  filter(type: BiquadFilterType, f: number, q: number, dest: AudioNode): BiquadFilterNode {
    const n = this.keep(this.h.ctx.createBiquadFilter());
    n.type = type; n.frequency.value = f; n.Q.value = q;
    n.connect(dest);
    return n;
  }

  osc(type: OscillatorType, f: number, t0: number, t1: number, dest: AudioNode): OscillatorNode {
    const o = this.h.ctx.createOscillator();
    o.type = type; o.frequency.value = f;
    o.start(t0);
    return this.source(o, dest, t1);
  }

  noise(kind: 'white' | 'brown', t0: number, t1: number, dest: AudioNode): AudioBufferSourceNode {
    const s = this.h.ctx.createBufferSource(), b = this.h.noiseBuffer(kind);
    s.buffer = b; s.loop = true;
    s.start(t0, this.h.rand() * b.duration * 0.8);
    return this.source(s, dest, t1);
  }

  /** A cached instrument note through this voice; the voice stays open until the note has rung out. */
  note(inst: Inst, m: number, t: number, vel: number, cut?: number): void {
    this.live++;
    this.h.note(inst, m, t, vel, this.out, cut, this.oneDone);
  }

  /** A run of notes, `gap` seconds apart, each `velStep` louder than the last. */
  run(inst: Inst, notes: number[], t: number, gap: number, vel: number, velStep = 0, cut?: number): void {
    notes.forEach((m, i) => this.note(inst, m, t + i * gap, vel + i * velStep, cut));
  }
}

/** Attack then exponential fall to silence. */
function ad(p: AudioParam, t: number, peak: number, attack: number, decay: number): void {
  p.setValueAtTime(0.0001, t);
  p.linearRampToValueAtTime(peak, t + attack);
  p.exponentialRampToValueAtTime(0.0001, t + attack + decay);
}

/** A single enveloped oscillator, the small building block for chimes, thuds and bubbles. */
function blip(v: Voice, type: OscillatorType, f0: number, f1: number, t: number, peak: number, attack: number, decay: number): OscillatorNode {
  const g = v.gain(v.out, 0);
  const o = v.osc(type, f0, t, t + attack + decay + 0.01, g);
  if (f1 !== f0) {
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(f1, t + attack + decay);
  }
  ad(g.gain, t, peak, attack, decay);
  return o;
}

/** A burst of filtered noise; returns the filter so a recipe can sweep it. */
function burst(v: Voice, kind: 'white' | 'brown', type: BiquadFilterType, f: number, q: number, t: number, peak: number, attack: number, decay: number): BiquadFilterNode {
  const g = v.gain(v.out, 0), flt = v.filter(type, f, q, g);
  v.noise(kind, t, t + attack + decay + 0.01, flt);
  ad(g.gain, t, peak, attack, decay);
  flt.frequency.setValueAtTime(f, t);
  return flt;
}

/**
 * A sawtooth through vocal formant band-passes, with fast vibrato and flutter: the goat and the penguin.
 * Breath noise runs through the same formants and the top is darker: a bare saw read as a kazoo in a blind listen (Nov 5).
 */
function formant(v: Voice, f0: number, f1: number, t: number, dur: number, peak: number, forms: [number, number, number][], vibRate: number, vibCents: number): void {
  const end = t + dur + 0.03, env = v.gain(v.out, 0), flutter = v.gain(env, 0.72), lp = v.filter('lowpass', 2300, 0.5, flutter);
  const bus = v.gain(null);
  for (const [fc, q, amp] of forms) bus.connect(v.filter('bandpass', fc, q, v.gain(lp, amp)));
  v.noise('white', t, end, v.gain(bus, 0.22));
  const saw = v.osc('sawtooth', f0, t, end, v.gain(bus, 0.8));
  saw.frequency.setValueAtTime(f0, t);
  saw.frequency.exponentialRampToValueAtTime(f1, t + dur);
  v.osc('sine', vibRate, t, end, v.gain(saw.detune, vibCents));
  v.osc('sine', vibRate, t, end, v.gain(flutter.gain, 0.28));
  env.gain.setValueAtTime(0.0001, t);
  env.gain.linearRampToValueAtTime(peak, t + 0.03);
  env.gain.setValueAtTime(peak, t + dur * 0.55);
  env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
}

/** Level-complete fanfare on the five-note scale: four short bars of marimba, kalimba on top, over a pad swell. */
function fanfare(h: SfxHost, v: Voice, t: number, s: number[]): void {
  const beat = 0.215, end = t + 12 * beat + 2 * beat;
  ['0 . 2 3', '5 . 3 4', '5 6 7 .'].forEach((bar, b) => bar.split(' ').forEach((tok, i) => {
    if (tok === '.') return;
    const m = scaleStep(s, Number(tok)) + 12, at = t + (b * 4 + i) * beat;
    v.note('marimba', m, at, 0.34 + b * 0.03);
    if (b >= 1) v.note('kalimba', m, at, 0.12);
  }));
  for (const step of [5, 7, 8]) { v.note('marimba', scaleStep(s, step) + 12, end, 0.28); v.note('kalimba', scaleStep(s, step), end, 0.13); }
  for (const b of [0, 2, 3]) v.note('bass', s[0] - 24 + (s[0] < 60 ? 12 : 0), t + b * 4 * beat - (b === 3 ? 2 * beat : 0), 0.2);
  const swell = v.gain(v.filter('lowpass', 1100, 0.4, v.out), 0), wave = h.padWave();
  for (const step of [0, 2, 3, 5]) for (const det of [-5, 5]) {
    const o = v.osc('sine', freq(scaleStep(s, step)), t, end + 1.6, swell);
    o.setPeriodicWave(wave);
    o.detune.value = det;
  }
  swell.gain.setValueAtTime(0.0001, t);
  swell.gain.linearRampToValueAtTime(0.05, t + 1.4);
  swell.gain.setValueAtTime(0.05, end);
  swell.gain.exponentialRampToValueAtTime(0.0001, end + 1.55);
  h.duck(end - t + 0.9);
}

/** Plays `s` at time `t`. */
export function playSfx(h: SfxHost, s: Sfx, o: SfxOpts, t: number): void {
  const v = new Voice(h, o.pan ?? 0);
  const scale = h.scale, i = Math.max(0, Math.min(1, o.intensity ?? 0.5));
  const plate = plateNote(scale, o.plate ?? 0);

  switch (s) {
    case 'hover': blip(v, 'sine', freq(plate + 24), freq(plate + 24), t, 0.045, 0.002, 0.03); break;
    case 'select': v.note('marimba', plate + 12, t, 0.6, 0.24); break; // a pure sine two octaves up rang on in the reverb as a sonar ping (blind listen, Nov 5)
    case 'ui': v.note('wood', 60, t, 0.55); blip(v, 'sine', 620, 520, t, 0.08, 0.002, 0.03); break;
    case 'slide': { // stone scrape; a bigger plate (intensity) is lower and longer
      const dur = o.duration ?? 0.18 + 0.14 * i, low = 200 - 70 * i;
      // a 70 ms swell, not a hard onset: with a 30 ms attack a blind listen heard an impact, not a scrape (Nov 5)
      burst(v, 'white', 'bandpass', low, 0.9, t, 2 + 2 * i, 0.07, dur).frequency.exponentialRampToValueAtTime(low * 3, t + dur);
      burst(v, 'white', 'bandpass', 1500, 1.2, t, 0.1, 0.05, dur * 0.7); // grit, for speakers with no low end
      break;
    }
    // a stone clunk: the thump sits higher and the knock louder than before, which a blind listen heard as a distant depth charge (Nov 5)
    case 'stop': blip(v, 'sine', 190, 110, t, 0.34, 0.002, 0.06); burst(v, 'brown', 'lowpass', 1400, 0.6, t, 0.42, 0.002, 0.04); v.note('wood', 57, t, 0.3); break;
    case 'uplift': { // rumble swell plus a rising note per height step
      const dur = o.duration ?? 0.35 + 0.3 * i, steps = 1 + Math.round(i * 2);
      const rumble = v.gain(v.out, 0), lp = v.filter('lowpass', 80 + 60 * i, 0.9, rumble);
      v.noise('brown', t, t + dur + 0.25, lp);
      rumble.gain.setValueAtTime(0.0001, t);
      rumble.gain.linearRampToValueAtTime(0.55 + 0.35 * i, t + dur * 0.7);
      rumble.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.22);
      burst(v, 'brown', 'bandpass', 260, 0.8, t, 0.22 + 0.2 * i, dur * 0.5, dur * 0.6); // the part laptop speakers can play
      const base = (o.plate ?? 0) % scale.length;
      for (let n = 0; n < steps; n++) v.note('marimba', scaleStep(scale, base + n * 2) + 12, t + 0.1 + n * 0.11, 0.2 + 0.05 * n);
      break;
    }
    case 'crack': { // a click plus a ping pinned to the key (recipe: near 1.2 kHz)
      burst(v, 'white', 'highpass', 1400, 0.7, t, 0.5, 0.001, 0.04);
      const ping = freq(snap(scale, 87));
      blip(v, 'sine', ping, ping, t, 0.2, 0.001, 0.05);
      blip(v, 'sine', 170, 70, t, 0.32, 0.002, 0.1);
      break;
    }
    case 'blocked': // a soft falling "uh-uh" on two muted tones over a small low bump. A low thud (and then a wood double knock) read too close to 'stop' in blind listens (Nov 5)
      blip(v, 'triangle', 349, 330, t, 0.2, 0.004, 0.09);
      blip(v, 'triangle', 294, 262, t + 0.13, 0.18, 0.004, 0.13);
      blip(v, 'sine', 120, 90, t, 0.14, 0.002, 0.05);
      break;
    case 'undo':
      v.run('kalimba', [scaleStep(scale, 3) + 12, scaleStep(scale, 1) + 12], t, 0.075, 0.18, 0, 0.5);
      burst(v, 'white', 'bandpass', 900, 0.8, t, 0.035, 0.05, 0.12).frequency.exponentialRampToValueAtTime(350, t + 0.17);
      break;
    case 'restart':
      v.run('kalimba', [5, 3, 2, 0].map(n => scaleStep(scale, n) + 12), t, 0.07, 0.15, -0.01, 0.6);
      burst(v, 'white', 'bandpass', 1200, 0.7, t, 0.05, 0.08, 0.26).frequency.exponentialRampToValueAtTime(300, t + 0.34);
      break;
    case 'tick': { // rising chime, each creature (variant) its own interval, on triangle waves as the recipe has it
      const [a, b] = tickPair(scale, o.variant ?? o.plate ?? 0);
      for (const [m, at] of [[a + 12, t], [b + 12, t + 0.09]] as const) {
        blip(v, 'triangle', freq(m), freq(m), at, 0.34, 0.003, 0.36);
        blip(v, 'sine', freq(m + 12), freq(m + 12), at, 0.05, 0.002, 0.14);
      }
      break;
    }
    case 'untick': { // falling minor third, softer than the tick
      const [a, b] = fallingThird(scale);
      blip(v, 'triangle', freq(a), freq(a), t, 0.2, 0.004, 0.2);
      blip(v, 'triangle', freq(b), freq(b), t + 0.13, 0.2, 0.004, 0.3);
      break;
    }
    case 'bleat': { // three voices by pitch; a random one unless the caller picks
      const pick = o.variant === undefined ? Math.floor(h.rand() * 3) : ((Math.floor(o.variant) % 3) + 3) % 3;
      const f0 = [305, 372, 450][pick], dur = [0.34, 0.3, 0.26][pick];
      formant(v, f0 * 1.04, f0 * 0.92, t, dur, 0.44, [[700, 4, 1], [1200, 5, 0.7], [2500, 6, 0.1]], 10 + pick, 34);
      break;
    }
    case 'crush': { // creak, then a small comic boing: a gag, not a punishment
      const env = v.gain(v.out, 0), pulses = v.gain(env, 0.5), creak = v.filter('bandpass', 280, 11, pulses);
      v.noise('white', t, t + 0.52, creak);
      creak.frequency.setValueAtTime(280, t);
      creak.frequency.exponentialRampToValueAtTime(860, t + 0.26);
      creak.frequency.exponentialRampToValueAtTime(420, t + 0.5);
      env.gain.setValueAtTime(0.0001, t);
      env.gain.linearRampToValueAtTime(0.85, t + 0.06);
      env.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
      v.osc('square', 21, t, t + 0.52, v.gain(pulses.gain, 0.42));
      const at = t + 0.36, boing = blip(v, 'triangle', 165, 370, at, 0.3, 0.008, 0.46);
      v.osc('sine', 13, at, at + 0.47, v.gain(boing.detune, 120));
      break;
    }
    case 'lighthouse': { // a friendly horn on the root, a bell far above it. An octave lower it read as an ominous foghorn (blind listen, Nov 5)
      const root = freq(scale[0]), g = v.gain(v.out, 0), lp = v.filter('lowpass', 900, 0.8, g);
      v.osc('sawtooth', root, t, t + 0.82, lp); v.osc('sine', root, t, t + 0.82, v.gain(g, 0.5));
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.15, t + 0.09);
      g.gain.setValueAtTime(0.15, t + 0.5);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.8);
      v.note('bell', scale[0] + 24, t + 0.12, 0.24, 1.8);
      break;
    }
    case 'splash': // down-swept wash and two droplets
      burst(v, 'white', 'lowpass', 2600, 0.6, t, 0.95, 0.012, 0.42).frequency.exponentialRampToValueAtTime(380, t + 0.42);
      blip(v, 'sine', 640, 1320, t + 0.13, 0.16, 0.002, 0.06); blip(v, 'sine', 800, 1700, t + 0.22, 0.11, 0.002, 0.05);
      break;
    case 'fish': // three bubbles and a note
      for (let n = 0; n < 3; n++) blip(v, 'sine', 420 + n * 130, 1040 + n * 190, t + n * 0.075, 0.17, 0.003, 0.055);
      v.note('kalimba', scaleStep(scale, 3 + (o.variant ?? 0)) + 12, t + 0.2, 0.14);
      break;
    case 'penguin': // two little honks
      formant(v, 470, 390, t, 0.11, 0.48, [[860, 5, 1], [1500, 6, 0.55]], 22, 26);
      formant(v, 500, 400, t + 0.15, 0.14, 0.54, [[860, 5, 1], [1500, 6, 0.55]], 22, 26);
      break;
    case 'oasis': // harp run up the scale over a little water
      v.run('pluck', [0, 1, 2, 3, 4, 5].map(n => scaleStep(scale, n) + 12), t, 0.07, 0.15, 0.015);
      burst(v, 'white', 'bandpass', 1600, 0.7, t, 0.05, 0.14, 0.5);
      break;
    case 'complete': fanfare(h, v, t, scale); break;
    case 'star': { // sparkle arpeggio, a step higher for each further star
      const from = 5 + Math.max(0, o.variant ?? 0);
      v.run('musicbox', [0, 2, 3, 4, 5, 7].map(n => scaleStep(scale, from + n)), t, 0.068, 0.12, 0.01, 1.5);
      v.note('bell', scaleStep(scale, from + 7), t + 0.42, 0.1, 1.8);
      break;
    }
    case 'stuck': // "no way back": a soft low question, on the scale, unresolved
      v.note('marimba', scaleStep(scale, 1), t, 0.17, 0.7);
      v.note('marimba', scaleStep(scale, -2), t + 0.24, 0.19, 0.8);
      v.note('bass', scale[0] - 24 + (scale[0] < 60 ? 12 : 0), t + 0.24, 0.14, 0.8);
      break;
    case 'whoosh': { // air sweeping past
      const dur = o.duration ?? 0.55, g = v.gain(v.out, 0), flt = v.filter('bandpass', 350, 0.8, g);
      v.noise('white', t, t + dur + 0.02, flt);
      flt.frequency.setValueAtTime(350, t);
      flt.frequency.exponentialRampToValueAtTime(1500, t + dur * 0.55);
      flt.frequency.exponentialRampToValueAtTime(420, t + dur);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.55, t + dur * 0.55);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      break;
    }
    case 'meltice': // tiny cracks, then slow drips
      for (let n = 0; n < 3; n++) burst(v, 'white', 'highpass', 2200, 0.7, t + n * 0.05 + h.rand() * 0.02, 0.14, 0.001, 0.018);
      burst(v, 'white', 'bandpass', 1100, 0.9, t + 0.1, 0.05, 0.1, 0.4);
      for (let n = 0; n < 3; n++) blip(v, 'sine', 1500 - n * 240, 800 - n * 110, t + 0.16 + n * 0.16 + h.rand() * 0.03, 0.14, 0.002, 0.07);
      break;
    case 'chord': // a soft strum of whatever chord the music is on
      v.run('pluck', h.chord.map(m => m + 12), t, 0.035, 0.15);
      break;
  }
  v.release();
}

/** Rift water: filtered noise with a slow and a fast LFO for the gurgle, length = flood-fill time. */
export function pourSound(h: SfxHost, dur: number, pan: number, t: number): void {
  const v = new Voice(h, pan), d = Math.max(0.1, dur), end = t + d;
  // more splash band and a higher lowpass: darker, it read as a rumbling thruster in a blind listen (Nov 5)
  const env = v.gain(v.out, 0), lp = v.filter('lowpass', 1050, 2.4, env);
  v.noise('brown', t, end + 0.38, lp);
  v.noise('white', t, end + 0.38, v.filter('bandpass', 1700, 0.8, v.gain(env, 0.16)));
  for (const [rate, depth] of [[5.3, 300], [2.1, 180], [11, 90]] as const) v.osc('sine', rate, t, end + 0.38, v.gain(lp.frequency, depth));
  env.gain.setValueAtTime(0.0001, t);
  env.gain.linearRampToValueAtTime(0.62, t + Math.min(0.1, d * 0.3));
  env.gain.setValueAtTime(0.62, end);
  env.gain.exponentialRampToValueAtTime(0.0001, end + 0.36);
  v.release();
}

/** One distant gull: two or three falling cries, very quiet, into the ocean bus. */
export function gullCry(h: SfxHost, dest: AudioNode, pan: number, t: number): void {
  const v = new Voice(h, pan, dest), n = 2 + Math.floor(h.rand() * 2), base = 1100 + h.rand() * 300;
  const band = v.filter('bandpass', 1500, 1.4, v.out);
  let at = t;
  for (let c = 0; c < n; c++) {
    const g = v.gain(band, 0), o = v.osc('triangle', base, at, at + 0.3, g);
    o.frequency.setValueAtTime(base, at);
    o.frequency.linearRampToValueAtTime(base * 1.18, at + 0.05);
    o.frequency.exponentialRampToValueAtTime(base * 0.74, at + 0.28);
    ad(g.gain, at, 0.2, 0.03, 0.24);
    at += 0.34 + h.rand() * 0.1;
  }
  v.release();
}
