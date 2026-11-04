// Pure pieces of the soundscape: plate-note mapping, the score on paper (in key, voice leading, take shapes), that a
// repeat is never the same bars, and that the note generators are in tune and decay. No WebAudio involved.
import { describe, expect, it } from 'vitest';
import { Composer, parseChord, platesOf, scalePcs } from './compose.ts';
import { SONGS } from './songs.ts';
import { renderNote } from './synth.ts';
import { fallingThird, freq, midi, plateNote, scaleStep, snap, tickPair } from './theory.ts';
import type { Inst } from './songs.ts';

const songs = Object.values(SONGS);

describe('theory', () => {
  it('parses note names', () => {
    expect(midi('C4')).toBe(60);
    expect(midi('A4')).toBe(69);
    expect(midi('F#4')).toBe(66);
    expect(midi('Bb2')).toBe(46);
    expect(freq(69)).toBeCloseTo(440);
  });

  it('gives every plate its own in-scale note, in every biome', () => {
    for (const song of songs) {
      const s = platesOf(song), pcs = scalePcs(song);
      expect(s).toHaveLength(5);
      const seen = new Set<number>();
      for (let p = 0; p < 5; p++) {
        const m = plateNote(s, p);
        expect(pcs.has(m % 12), `${song.id} plate ${p}`).toBe(true);
        seen.add(m);
      }
      expect(seen.size).toBe(5);
      expect(plateNote(s, 0)).toBe(s[0]);
      expect(plateNote(s, 5)).toBe(s[0] + 12);
    }
  });

  it('keeps ticks rising and consonant and the goal-lost pair a falling minor third', () => {
    for (const song of songs) {
      const s = platesOf(song);
      for (let v = 0; v < 5; v++) {
        const [a, b] = tickPair(s, v);
        expect(b - a, `${song.id} tick ${v}`).toBeGreaterThanOrEqual(5);
        expect(b - a).toBeLessThanOrEqual(9);
        expect([6, 10, 11]).not.toContain((b - a) % 12);
      }
      const [hi, lo] = fallingThird(s);
      expect(hi - lo, song.id).toBe(3);
    }
  });

  it('walks octaves with scaleStep and snaps to the nearest scale note', () => {
    expect(scaleStep([60, 62, 64, 67, 69], 5)).toBe(72);
    expect(scaleStep([60, 62, 64, 67, 69], -1)).toBe(57);
    expect(snap([60, 62, 64, 67, 69], 66)).toBe(67);
    expect(snap([60, 62, 64, 67, 69], 85)).toBe(84);
  });
});

describe('the score', () => {
  it.each(songs.map(s => [s.id, s] as const))('%s is well formed and in key', (_id, s) => {
    expect(s.bpm).toBeGreaterThanOrEqual(70);
    expect(s.bpm).toBeLessThanOrEqual(90);
    expect([8, 16]).toContain(s.chords.length);
    expect(s.lead.phrases.length * 4).toBe(s.chords.length);
    const pcs = scalePcs(s);
    s.lead.phrases.forEach((slot, si) => slot.forEach(take => {
      const bars = take.split('|').map(b => b.trim().split(/\s+/));
      expect(bars, `${s.id} slot ${si}`).toHaveLength(4);
      bars.forEach((bar, bi) => {
        expect(bar, `${s.id} slot ${si} bar ${bi}`).toHaveLength(s.steps);
        for (const tok of bar) if (tok !== '.') expect(pcs.has(midi(tok) % 12), `${s.id} ${tok}`).toBe(true);
      });
    }));
    for (const p of [...s.arp.pats, ...s.bassPats]) expect(p.trim().split(/\s+/)).toHaveLength(s.steps);
    for (const p of [s.perc.shaker, s.perc.wood, s.perc.drum]) if (p) expect(p.trim().split(/\s+/)).toHaveLength(s.steps);
    for (const c of s.chords) {
      const { pad } = parseChord(c);
      expect(pad).toHaveLength(4);
      for (const m of pad) expect(pcs.has(m % 12), `${s.id} chord ${c}`).toBe(true);
    }
  });

  // Voice leading: moving between bars, no pad voice leaps more than a fifth, and on average they move under a third.
  it.each(songs.map(s => [s.id, s] as const))('%s pad moves by small steps', (_id, s) => {
    const chords = s.chords.map(parseChord);
    chords.forEach((c, i) => {
      const n = chords[(i + 1) % chords.length];
      const moves = c.pad.map((m, v) => Math.abs(m - n.pad[v]));
      expect(Math.max(...moves), `${s.id} bar ${i + 1}: ${s.chords[i]} -> ${s.chords[(i + 1) % s.chords.length]}`).toBeLessThanOrEqual(7);
      expect(moves.reduce((a, b) => a + b, 0) / 4, `${s.id} bar ${i + 1}`).toBeLessThanOrEqual(3);
      // the voicing never crowds: no minor second between two pad voices, none below the fourth octave at all
      for (let a = 0; a < 4; a++) for (let b = a + 1; b < 4; b++) {
        expect((c.pad[b] - c.pad[a]) % 12, `${s.id} bar ${i + 1} voices ${a},${b}`).not.toBe(1);
      }
    });
  });

  it.each(songs.map(s => [s.id, s] as const))('%s never plays a lead note a semitone from the bass-defined root on a downbeat', (_id, s) => {
    const chords = s.chords.map(parseChord);
    s.lead.phrases.forEach((slot, si) => slot.forEach(take => {
      take.split('|').forEach((bar, bi) => {
        const first = bar.trim().split(/\s+/)[0];
        if (first === '.') return;
        const root = chords[si * 4 + bi].bass;
        expect((midi(first) - root) % 12, `${s.id} slot ${si} bar ${bi} starts ${first}`).not.toBe(1);
      });
    }));
  });
});

describe('Composer', () => {
  const signature = (c: Composer, bars: number): string[] => Array.from({ length: bars }, () => {
    const b = c.next();
    return b.notes.filter(n => n.inst !== 'shaker').map(n => `${n.inst}${n.midi}@${n.at.toFixed(1)}`).join(',');
  });

  it('is deterministic for a seed', () => {
    expect(signature(new Composer(SONGS.meadow, 7), 32)).toEqual(signature(new Composer(SONGS.meadow, 7), 32));
    expect(signature(new Composer(SONGS.meadow, 7), 32)).not.toEqual(signature(new Composer(SONGS.meadow, 8), 32));
  });

  it.each(songs.map(s => [s.id, s] as const))('%s: 30 minutes never repeats a whole pass, and bars differ across passes', (_id, s) => {
    const n = s.chords.length, barDur = (60 / s.bpm) * s.beats, passes = Math.ceil(1800 / (barDur * n));
    const c = new Composer(s, 1234);
    const whole = new Set<string>();
    const byBar: Set<string>[] = Array.from({ length: n }, () => new Set());
    for (let p = 0; p < passes; p++) {
      const sig = signature(c, n);
      whole.add(sig.join('|'));
      sig.forEach((x, i) => byBar[i].add(x));
    }
    expect(whole.size, `${s.id} ${passes} passes`).toBe(passes);
    // every bar of the table has several distinct realisations (at least half the passes differ, up to a small limit)
    for (const set of byBar) expect(set.size).toBeGreaterThanOrEqual(Math.min(5, Math.floor(passes / 2)));
  });

  it.each(songs.map(s => [s.id, s] as const))('%s: every note and ornament of a long run stays in key and in range', (_id, s) => {
    const pcs = scalePcs(s), c = new Composer(s, 99);
    for (let i = 0; i < s.chords.length * 40; i++) {
      const b = c.next();
      expect(b.pad === null || b.pad.midi.length === 4).toBe(true);
      for (const n of b.notes) {
        if (n.inst === 'shaker' || n.inst === 'wood' || n.inst === 'drum') continue;
        expect(pcs.has(((n.midi % 12) + 12) % 12), `${s.id} ${n.inst} ${n.midi} in bar ${b.chord}`).toBe(true);
        expect(n.midi, `${s.id} ${n.inst} too high`).toBeLessThanOrEqual(91);
        expect(n.midi, `${s.id} ${n.inst} too low`).toBeGreaterThanOrEqual(33);
        expect(n.vel).toBeGreaterThan(0);
        expect(n.vel).toBeLessThanOrEqual(1);
        expect(n.at).toBeLessThan(b.dur + 0.02);
      }
    }
  });
});

describe('note generators', () => {
  const sr = 48000;

  /** Strongest frequency near `f` (within a semitone), by direct DFT over a window after the attack. */
  function pitchNear(d: Float32Array, f: number, rate: number): number {
    const from = Math.floor(0.02 * sr), len = Math.min(d.length - from, Math.floor(0.3 * sr));
    let best = 0, bestP = -1;
    for (let cents = -100; cents <= 100; cents += 1) {
      const hz = (f * 2 ** (cents / 1200)) / rate;
      let re = 0, im = 0;
      for (let i = 0; i < len; i += 2) {
        const w = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / len), a = (2 * Math.PI * hz * i) / sr;
        re += d[from + i] * w * Math.cos(a); im += d[from + i] * w * Math.sin(a);
      }
      const p = re * re + im * im;
      if (p > bestP) { bestP = p; best = f * 2 ** (cents / 1200); }
    }
    return best;
  }

  it.each(['marimba', 'kalimba', 'pluck', 'musicbox', 'bell', 'bass'] as Inst[])('%s lands in tune (within 6 cents), bounded, no DC, and rings out', inst => {
    for (const m of inst === 'bass' ? [38, 45] : [60, 69, 81]) {
      const r = renderNote(inst, m, sr);
      const f = pitchNear(r.data, freq(m), r.rate);
      expect(Math.abs(1200 * Math.log2(f / freq(m))), `${inst} ${m}`).toBeLessThanOrEqual(6);
      let peak = 0, sum = 0;
      for (const x of r.data) { peak = Math.max(peak, Math.abs(x)); sum += x; }
      expect(peak).toBeLessThanOrEqual(1.0001);
      expect(Math.abs(sum / r.data.length)).toBeLessThan(0.01);
      const tail = r.data.subarray(r.data.length - Math.floor(0.05 * sr));
      expect(Math.max(...tail.map(Math.abs)), `${inst} ${m} tail`).toBeLessThan(0.05);
    }
  });
});
