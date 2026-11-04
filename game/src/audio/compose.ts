// Turns a Song into notes, one bar at a time, with no WebAudio. A pass through the chord table is a "cycle": each cycle
// takes a layer of the arrangement (what sounds and how densely), picks a take per phrase, and adds small ornaments
// (grace notes, passing notes, dropped notes, fills, octave doubles), so a repeat is the same song, never the same bars.
import { midi, rng, scaleStep } from './theory.ts';
import type { Inst, Layer, Song } from './songs.ts';

export interface Note { inst: Inst; midi: number; at: number; vel: number; pan: number }
export interface Bar {
  /** seconds per bar */
  dur: number;
  notes: Note[];
  /** a new pad chord at this bar's start, held for `dur` seconds (identical following bars are tied), or null */
  pad: { midi: number[]; dur: number } | null;
  /** chord table index, for the live "chord" SFX and for tests */
  chord: number;
}

const tokens = (s: string): string[] => s.trim().split(/\s+/);
const PHRASE_BARS = 4;

/** Parse 'C2 | E3 G3 D4 G4' into the bass midi and the pad voicing. */
export function parseChord(c: string): { bass: number; pad: number[] } {
  const [b, p] = c.split('|');
  return { bass: midi(b.trim()), pad: tokens(p).map(midi) };
}

/** The bass's fifth when the chord really holds it; an inverted chord (F/A, D/F#) keeps its bass note instead. */
export function fifthOf(c: { bass: number; pad: number[] }): number {
  const fifth = c.bass + (c.bass >= 43 ? -5 : 7);
  return c.pad.some(m => (m - fifth) % 12 === 0) ? fifth : c.bass;
}

/** Pitch classes the song may use. */
export function scalePcs(song: Song): Set<number> {
  return new Set(tokens(song.scale).map(n => midi(`${n}4`) % 12));
}

export const platesOf = (song: Song): number[] => tokens(song.plates).map(midi);

export class Composer {
  cycle = 0;
  private bar = 0;
  private layer: Layer;
  private readonly r: () => number;
  private readonly chords: { bass: number; pad: number[] }[];
  private readonly pcs: number[];
  /** the take sounding in each lead slot, and the take last used per slot so a slot alternates more often than not */
  private take: string[] = [];
  private lastTake = new Map<number, number>();
  private leadOn = true;
  private arpPat: string[] = [];
  private bassPat: string[] = [];
  private tiedUntil = -1;

  private readonly song: Song;

  constructor(song: Song, seed: number) {
    this.song = song;
    this.r = rng(seed);
    this.chords = song.chords.map(parseChord);
    this.pcs = [...scalePcs(song)].sort((a, b) => a - b);
    this.layer = song.layers[0];
  }

  private pick<T>(a: readonly T[]): T { return a[Math.floor(this.r() * a.length) % a.length]; }
  private chance(p: number): boolean { return this.r() < p; }

  /** Nearest note of the song's scale `step` scale degrees away from `m`, used for grace and passing notes. */
  private neighbour(m: number, step: number): number {
    let n = m;
    for (let left = Math.abs(step); left > 0; left--) {
      do n += Math.sign(step); while (!this.pcs.includes(((n % 12) + 12) % 12));
    }
    return n;
  }

  next(): Bar {
    const s = this.song, b = this.bar;
    if (b === 0) {
      const n = s.layers.length;
      const i = this.cycle < n ? this.cycle : s.loopFrom + (this.cycle - n) % (n - s.loopFrom);
      this.layer = s.layers[i];
    }
    const barDur = (60 / s.bpm) * s.beats, stepDur = barDur / s.steps, notes: Note[] = [];
    const at = (step: number): number => (step % 2 === 1 ? step + s.swing : step) * stepDur;
    const chord = this.chords[b], next = this.chords[(b + 1) % this.chords.length];
    const nudge = (): number => (this.r() - 0.5) * 0.01; // +-5 ms of hand
    const add = (inst: Inst, m: number, t: number, vel: number, pan: number): void => {
      notes.push({ inst, midi: m, at: Math.max(0, t + nudge()), vel: vel * (0.88 + 0.24 * this.r()), pan });
    };

    // Lead: a phrase slot picks a take at its first bar, and sits out entirely some cycles.
    const slot = Math.floor(b / PHRASE_BARS), phrases = s.lead.phrases[slot % s.lead.phrases.length];
    if (b % PHRASE_BARS === 0) {
      const last = this.lastTake.get(slot) ?? -1;
      let t = Math.floor(this.r() * phrases.length) % phrases.length;
      if (t === last && this.chance(0.7)) t = (t + 1) % phrases.length;
      this.lastTake.set(slot, t);
      this.take = phrases[t].split('|').map(p => p.trim());
      this.leadOn = this.chance(this.layer.lead);
    }
    const line = tokens(this.take[b % PHRASE_BARS] ?? '');
    if (this.leadOn) {
      line.forEach((tok, step) => {
        if (tok === '.') {
          // a passing note in a rest between two notes a scale third apart
          const prev = line[step - 1], following = line[step + 1];
          if (prev && following && prev !== '.' && following !== '.' && this.chance(0.14)) {
            const a = midi(prev), c = midi(following);
            const mid = this.neighbour(a, Math.sign(c - a));
            if (Math.abs(c - a) >= 3 && Math.abs(c - a) <= 4 && mid !== c) add(s.lead.inst, mid, at(step), s.lead.gain * 0.5, -0.1);
          }
          return;
        }
        const m = midi(tok);
        if (step > 0 && this.chance(0.05)) return; // a dropped note lets the line breathe
        const accent = step % (s.steps / s.beats) === 0 ? 1 : 0.86;
        const pan = Math.max(-0.5, Math.min(0.5, (m - 74) / 28));
        if (step > 0 && line[step - 1] === '.' && this.chance(0.07)) add(s.lead.inst, this.neighbour(m, 1), at(step) - 0.06, s.lead.gain * 0.3, pan);
        add(s.lead.inst, m, at(step), s.lead.gain * accent, pan);
        if (this.chance(this.layer.double)) add(s.double, m + 12 > 88 || s.double === 'bell' ? m : m + 12, at(step), s.lead.gain * 0.3, -pan);
      });
    }

    // Answer: when the lead is resting at a phrase end, a short climb on the plate notes fills the hole.
    const leadTail = this.leadOn && line.slice(-3).some(tok => tok !== '.');
    if (b % PHRASE_BARS === PHRASE_BARS - 1 && !leadTail && this.chance(this.layer.fill)) {
      const scale = platesOf(s), from = Math.floor(this.r() * 3), up = this.chance(0.6) ? 1 : -1;
      const lift = scale[0] < 60 ? 10 : 5; // an octave or two above the plate notes, depending on where they sit
      for (let i = 0; i < 3; i++) add(s.double, scaleStep(scale, from + lift + i * up), at(s.steps - 3 + i), 0.24 + i * 0.03, 0.3);
    }

    // Arp: chord tones with a pattern that changes every two bars; layer.arp thins it note by note.
    if (b % 2 === 0) this.arpPat = tokens(this.pick(s.arp.pats));
    this.arpPat.forEach((tok, step) => {
      if (tok === '.' || !this.chance(this.layer.arp)) return;
      const m = chord.pad[Number(tok)] + s.arp.oct;
      add(s.arp.inst, m, at(step), s.arp.gain * (step === 0 ? 1.1 : 0.9), (Number(tok) - 1.5) * 0.28);
    });

    // Bass: root and fifth, sometimes walking into the next bar on its fifth.
    if (b % 4 === 0) this.bassPat = tokens(this.pick(s.bassPats));
    this.bassPat.forEach((tok, step) => {
      if (tok === '.' || (step > 0 && !this.chance(this.layer.bass))) return;
      add('bass', tok === 'R' ? chord.bass : fifthOf(chord), at(step), step === 0 ? 0.8 : 0.62, 0);
    });
    if (this.chance(0.1 * this.layer.bass)) add('bass', fifthOf(next), at(s.steps - 1), 0.44, 0);

    // Percussion: pattern hits plus rare ghost shakes, always quiet.
    const hits: [Inst, string | undefined, number, number][] = [['shaker', s.perc.shaker, 0.6, 0.25], ['wood', s.perc.wood, 0.7, -0.3], ['drum', s.perc.drum, 1, 0]];
    for (const [inst, pat, g, pan] of hits) {
      if (!pat) continue;
      tokens(pat).forEach((tok, step) => {
        if (tok === 'x' && this.chance(this.layer.perc)) add(inst, 60, at(step), s.perc.gain * g, pan);
        else if (tok === '.' && inst === 'shaker' && this.chance(this.layer.perc * 0.08)) add(inst, 60, at(step), s.perc.gain * g * 0.5, pan);
      });
    }

    // A soft bell over the downbeat, an octave above a pad tone.
    if (this.chance(s.bell)) add('bell', this.pick(chord.pad.slice(1)) + 12, 0.02, 0.26, this.r() - 0.5);

    // Pad: tied over identical voicings.
    let pad: Bar['pad'] = null;
    if (b > this.tiedUntil || b === 0) {
      let n = 1;
      while (b + n < this.chords.length && s.chords[b + n].split('|')[1] === s.chords[b].split('|')[1] && this.chords[b + n].bass === chord.bass) n++;
      this.tiedUntil = b + n - 1;
      pad = { midi: chord.pad, dur: n * barDur };
    }

    notes.sort((x, y) => x.at - y.at);
    this.bar = b + 1;
    if (this.bar >= this.chords.length) { this.bar = 0; this.cycle++; this.tiedUntil = -1; }
    return { dur: barDur, notes, pad, chord: b };
  }
}
