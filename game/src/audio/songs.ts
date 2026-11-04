// The score: one hand-written song per biome. Chord tables are "bass | pad voicing", one per bar, voiced for small
// movement between bars (songs.test.ts measures it). Lead phrases are one token per step, '.' holds, '|' splits bars;
// each four-bar slot has two takes and compose.ts picks one per cycle. Arp digits index the bar's pad voicing.
import type { Biome } from './audio.ts';

export type Inst = 'marimba' | 'kalimba' | 'pluck' | 'musicbox' | 'bell' | 'bass' | 'shaker' | 'wood' | 'drum';

/** One pass through the chord table: how likely each part is to sound (per phrase for lead, per note for the rest). */
export interface Layer { lead: number; arp: number; bass: number; perc: number; fill: number; double: number }

export interface Song {
  id: Biome;
  bpm: number;
  /** quarter-note beats per bar (coast counts dotted quarters) and token steps per bar */
  beats: number;
  steps: number;
  /** late offbeat steps, as a fraction of a step */
  swing: number;
  /** every note the lead and ornaments may use, as pitch-class names */
  scale: string;
  /** the five notes that SFX and plates play, low to high */
  plates: string;
  chords: string[];
  lead: { inst: Inst; gain: number; phrases: string[][] };
  double: Inst;
  arp: { inst: Inst; oct: number; gain: number; pats: string[] };
  bassPats: string[];
  perc: { shaker?: string; wood?: string; drum?: string; gain: number };
  /** chance per bar of a soft bell tone over the downbeat */
  bell: number;
  pad: { gain: number; cutoff: [number, number] };
  send: { reverb: number; delay: number; delayBeats: number };
  layers: Layer[];
  /** after the last layer, the cycle goes back here (finale builds once, then stays full) */
  loopFrom: number;
}

const L = (lead: number, arp: number, bass: number, perc: number, fill = 0.15, double = 0): Layer =>
  ({ lead, arp, bass, perc, fill, double });

export const SONGS: Record<Biome, Song> = {
  // Welcoming: G major, I-V-vi-IV in slow kalimba, nothing yet asks anything of you.
  title: {
    id: 'title', bpm: 76, beats: 4, steps: 8, swing: 0.04, scale: 'G A B C D E F#', plates: 'G3 A3 B3 D4 E4',
    chords: ['G2 | G3 B3 D4 A4', 'F#2 | F#3 A3 D4 A4', 'E2 | G3 B3 D4 G4', 'C2 | G3 C4 E4 G4',
      'B1 | G3 B3 D4 G4', 'C2 | G3 C4 E4 G4', 'A1 | G3 C4 E4 A4', 'D2 | A3 C4 D4 G4'],
    lead: { inst: 'kalimba', gain: 0.62, phrases: [
      ['D5 . B4 . G4 . A4 B4 | A4 . . D5 . . B4 A4 | G4 . B4 . E5 . D5 B4 | G4 . . E4 G4 . A4 .',
        'G4 . A4 B4 . D5 . . | D5 . . . A4 . . . | B4 . G4 . E4 . G4 . | E4 . G4 . C5 . . .'],
      ['B4 . D5 . G5 . E5 D5 | E5 . . D5 E5 . G5 . | E5 . D5 . C5 . A4 . | G4 . A4 . . . . .',
        'D5 . . B4 D5 . E5 . | G5 . E5 . C5 . . . | C5 . . A4 C5 . E5 . | D5 . . C5 A4 . G4 .'],
    ] },
    double: 'musicbox',
    arp: { inst: 'marimba', oct: 0, gain: 0.34, pats: ['0 . 2 . 3 . 2 .', '1 . 2 3 . 2 . .', '0 . . 3 . 2 . 1', '0 . 1 . 2 . . .'] },
    bassPats: ['R . . . . . 5 .', 'R . . . 5 . . .', 'R . . . . . . .'],
    perc: { gain: 0 }, bell: 0.06, pad: { gain: 0.42, cutoff: [650, 1050] },
    send: { reverb: 0.3, delay: 0.16, delayBeats: 0.75 },
    layers: [L(1, 0.9, 1, 0), L(0.85, 1, 1, 0, 0.25), L(0.45, 1, 0.9, 0, 0.1), L(1, 0.7, 1, 0, 0.3, 0.3)], loopFrom: 0,
  },

  // Bright: C major pentatonic melody on marimba over open add9 chords, offbeat shaker, a wood knock on three.
  meadow: {
    id: 'meadow', bpm: 84, beats: 4, steps: 8, swing: 0.08, scale: 'C D E F G A B', plates: 'C4 D4 E4 G4 A4',
    chords: ['C2 | E3 G3 D4 G4', 'A1 | E3 G3 C4 G4', 'F2 | E3 A3 C4 G4', 'G2 | D3 G3 B3 G4',
      'C2 | E3 G3 D4 G4', 'E2 | E3 G3 D4 G4', 'F2 | E3 A3 C4 G4', 'G2 | D3 G3 B3 G4',
      'F2 | E3 A3 C4 G4', 'E2 | E3 G3 C4 G4', 'D2 | F3 A3 C4 E4', 'G2 | F3 C4 D4 G4',
      'C2 | E3 C4 D4 G4', 'A1 | E3 A3 C4 G4', 'F2 | E3 A3 C4 G4', 'G2 | D3 G3 B3 G4'],
    lead: { inst: 'marimba', gain: 0.68, phrases: [
      ['E5 . G5 . A5 G5 E5 . | C5 . . E5 D5 C5 A4 . | C5 . D5 E5 . G5 . A5 | G5 . . . D5 . E5 D5',
        'C5 . E5 . G5 . A5 . | G5 . E5 . C5 . . . | A4 C5 . D5 . C5 . A4 | G4 . A4 . D5 . . .'],
      ['C5 . E5 G5 . E5 D5 C5 | D5 . E5 . G5 . E5 . | A5 . G5 E5 . C5 D5 E5 | D5 . . . . . G4 .',
        'G5 . . E5 G5 . A5 . | G5 . E5 D5 . E5 . . | C5 . A4 . C5 D5 E5 . | D5 . . C5 D5 . . .'],
      ['A4 C5 . D5 E5 . D5 C5 | D5 E5 . G5 . E5 . . | D5 . A4 . C5 D5 . E5 | D5 . . C5 D5 . G4 .',
        'C5 . . A4 C5 . E5 . | G5 . E5 . C5 . . . | A4 . D5 . E5 . D5 . | C5 . D5 . G5 . . .'],
      ['G5 . A5 G5 . E5 . . | A5 . G5 E5 . D5 C5 . | C5 D5 . E5 . C5 A4 . | G4 . . A4 . . D5 .',
        'E5 G5 . A5 . G5 . E5 | C5 . E5 . A4 . C5 . | D5 . C5 A4 . G4 A4 C5 | D5 . E5 . D5 . . .'],
    ] },
    double: 'kalimba',
    arp: { inst: 'marimba', oct: 0, gain: 0.36, pats: ['0 . 2 1 . 2 3 .', '1 . 3 . 2 . 3 1', '0 2 . 3 . 2 1 .', '0 . . 2 . 3 . 2'] },
    bassPats: ['R . . . 5 . . .', 'R . . . . . 5 .', 'R . . R . . 5 .'],
    perc: { shaker: '. x . x . x . x', wood: '. . . . x . . .', gain: 0.3 }, bell: 0,
    pad: { gain: 0.36, cutoff: [750, 1300] }, send: { reverb: 0.22, delay: 0.14, delayBeats: 0.75 },
    layers: [L(1, 0.9, 1, 0.4), L(1, 0.8, 1, 0.85, 0.2), L(0.4, 1, 0.9, 0.5, 0.3), L(1, 0.65, 1, 1, 0.25, 0.3), L(0.15, 1, 0.8, 0.2, 0.1)],
    loopFrom: 0,
  },

  // Airy: F lydian barcarolle in 6/8; the F / G-over-F sway is the lydian lift, harp rolling under a kalimba line.
  coast: {
    id: 'coast', bpm: 70, beats: 2, steps: 6, swing: 0, scale: 'F G A B C D E', plates: 'G3 A3 C4 D4 E4',
    chords: ['F2 | A3 C4 E4 G4', 'F2 | G3 B3 D4 G4', 'F2 | A3 C4 E4 G4', 'F2 | G3 B3 D4 G4',
      'A1 | G3 C4 E4 G4', 'E2 | G3 B3 D4 G4', 'D2 | A3 C4 E4 A4', 'G2 | G3 C4 D4 G4',
      'F2 | A3 C4 E4 G4', 'F2 | G3 B3 D4 G4', 'A1 | G3 C4 E4 A4', 'E2 | G3 B3 E4 G4',
      'D2 | A3 C4 E4 A4', 'C2 | G3 C4 E4 G4', 'F2 | G3 B3 D4 G4', 'F2 | A3 C4 E4 G4'],
    lead: { inst: 'kalimba', gain: 0.58, phrases: [
      ['A4 . C5 E5 . . | D5 . B4 G4 . . | A4 . C5 G5 . E5 | D5 . . B4 . .',
        'E5 . . G5 . . | B4 . D5 G5 . . | A5 . G5 E5 . C5 | D5 . . G4 . .'],
      ['C5 . E5 A5 . G5 | G5 . E5 D5 . B4 | A4 . C5 E5 . D5 | C5 . . D5 . .',
        'E5 . . G5 . E5 | D5 . . B4 . G4 | A4 . . C5 . E5 | G5 . . D5 . C5'],
      ['E5 . G5 A5 . . | G5 . . D5 . B4 | C5 . E5 G5 . A5 | G5 . . E5 . D5',
        'C5 . . E5 . G5 | B5 . . G5 . . | A5 . . E5 . C5 | B4 . . E5 . G5'],
      ['E5 . . C5 . A4 | G4 . . C5 . D5 | B4 . . D5 . G5 | E5 . . . . .',
        'A4 . C5 D5 . E5 | G5 . E5 C5 . . | D5 . B4 G4 . . | A4 . . C5 . .'],
    ] },
    double: 'musicbox',
    arp: { inst: 'pluck', oct: 0, gain: 0.32, pats: ['0 1 2 3 2 1', '0 2 3 1 3 2', '1 . 2 3 . 2', '0 . 3 . 2 .'] },
    bassPats: ['R . . . . .', 'R . . 5 . .'],
    perc: { shaker: '. . . x . .', gain: 0.14 }, bell: 0.05,
    pad: { gain: 0.46, cutoff: [800, 1500] }, send: { reverb: 0.36, delay: 0.2, delayBeats: 0.5 },
    layers: [L(0.7, 0.9, 1, 0.2), L(1, 0.85, 1, 0.5, 0.2), L(0.5, 1, 0.9, 0.3, 0.25), L(1, 0.6, 1, 0.5, 0.2, 0.3), L(0, 1, 0.8, 0.2, 0.1)],
    loopFrom: 0,
  },

  // Warm: D phrygian dominant over the Andalusian fall Gm-F-Eb-D; oud-like pluck, shuffled frame drum, no sharp edges.
  desert: {
    id: 'desert', bpm: 78, beats: 4, steps: 8, swing: 0.14, scale: 'D Eb F F# G A Bb C', plates: 'D4 G4 A4 Bb4 C5', // a subset that sits on all of Gm, F, Eb and D
    chords: ['D2 | A3 D4 F#4 A4', 'Eb2 | Bb3 Eb4 G4 Bb4', 'D2 | A3 D4 F#4 A4', 'D2 | A3 C4 F#4 A4',
      'G2 | Bb3 D4 G4 Bb4', 'F2 | A3 C4 F4 A4', 'Eb2 | Bb3 Eb4 G4 Bb4', 'D2 | A3 D4 F#4 A4',
      'G2 | Bb3 D4 F4 Bb4', 'C2 | Bb3 Eb4 G4 Bb4', 'F2 | A3 C4 Eb4 A4', 'Bb1 | Bb3 D4 F4 Bb4',
      'Eb2 | Bb3 Eb4 G4 Bb4', 'C2 | Bb3 Eb4 G4 C5', 'Eb2 | Bb3 Eb4 G4 Bb4', 'D2 | A3 D4 F#4 A4'],
    lead: { inst: 'pluck', gain: 0.88, phrases: [
      ['A4 . . Bb4 A4 . F#4 . | G4 . . Bb4 . G4 Eb4 . | D4 . F#4 . A4 . D5 . | C5 . Bb4 A4 . . . .',
        'D5 . C5 . Bb4 A4 . . | Bb4 . G4 . Eb5 . D5 . | A4 . F#4 A4 . D5 . . | F#4 . A4 . C5 . . .'],
      ['Bb4 . A4 G4 . . D5 . | C5 . A4 . F4 . A4 . | Bb4 . G4 . Eb4 . G4 . | F#4 . . . A4 . . .',
        'D5 . . Bb4 G4 . Bb4 . | A4 . C5 . F5 . C5 . | G4 . Bb4 . Eb5 . Bb4 . | A4 . F#4 . D4 . . .'],
      ['D5 . Bb4 . G4 . Bb4 D5 | Eb5 . D5 C5 . G4 . . | F5 . Eb5 C5 . A4 . . | D5 . Bb4 . F4 . Bb4 .',
        'G4 . . Bb4 D5 . F5 . | Eb5 . . C5 . Bb4 G4 . | A4 . C5 . Eb5 . C5 . | Bb4 . . . D5 . . .'],
      ['G4 . Bb4 . Eb5 . D5 . | C5 . Bb4 G4 . Eb4 . . | G4 . Bb4 . . Bb4 G4 . | A4 . F#4 . D4 . . .',
        'Eb5 . D5 Bb4 . G4 . . | G4 . C5 . Eb5 . C5 . | Bb4 . G4 . Bb4 . G4 . | D5 . A4 . F#4 . . .'],
    ] },
    double: 'kalimba',
    arp: { inst: 'kalimba', oct: 0, gain: 0.3, pats: ['0 . 1 2 . 3 . 2', '0 . . 2 3 . 1 .', '2 . 3 . 1 . 2 .', '0 . . . 2 . 3 .'] },
    bassPats: ['R . . R 5 . . .', 'R . . . 5 . R .', 'R . . . . . 5 .'],
    perc: { shaker: '. . x . . . x .', wood: '. . . x . . . x', drum: 'x . . . . x . .', gain: 0.34 }, bell: 0,
    pad: { gain: 0.36, cutoff: [650, 1100] }, send: { reverb: 0.26, delay: 0.16, delayBeats: 0.75 },
    layers: [L(0.8, 0.8, 1, 0.5), L(1, 0.7, 1, 0.85, 0.2), L(0.5, 1, 0.9, 0.7, 0.25), L(1, 0.6, 1, 1, 0.2, 0.25), L(0.1, 1, 0.8, 0.35, 0.1)],
    loopFrom: 0,
  },

  // Sparse: A major waltz on a music box, soft bell tones in a lot of reverb; bars with almost nothing are the point.
  tundra: {
    id: 'tundra', bpm: 72, beats: 3, steps: 6, swing: 0, scale: 'A B C# D E F# G#', plates: 'A3 B3 C#4 E4 F#4',
    chords: ['A2 | G#3 C#4 E4 B4', 'F#2 | A3 C#4 E4 A4', 'D2 | A3 C#4 F#4 A4', 'E2 | A3 C#4 E4 B4',
      'C#3 | A3 C#4 E4 A4', 'D2 | A3 C#4 F#4 A4', 'B1 | A3 D4 F#4 A4', 'E2 | A3 D4 E4 B4',
      'F#2 | A3 C#4 E4 B4', 'C#3 | G#3 B3 E4 B4', 'D2 | A3 D4 F#4 A4', 'E2 | G#3 B3 E4 G#4',
      'B1 | A3 D4 F#4 A4', 'E2 | A3 D4 E4 A4', 'A2 | A3 C#4 E4 B4', 'A2 | A3 C#4 E4 A4'],
    lead: { inst: 'musicbox', gain: 0.44, phrases: [
      ['E5 . A5 . B5 . | C#6 . . . A5 . | F#5 . A5 . E6 . | . . C#6 . B5 .',
        'C#6 . . . B5 . | A5 . . . E5 . | F#5 . . A5 . . | B5 . . . . .'],
      ['A5 . C#6 . E6 . | F#5 . . A5 . C#6 | B5 . . A5 . F#5 | E5 . . . . .',
        'E5 . C#6 . . . | A5 . F#5 . . . | F#5 . A5 . B5 . | A5 . . . . .'],
      ['C#6 . . A5 . E5 | G#5 . . B5 . . | A5 . F#5 . E5 . | B5 . . . G#5 .',
        'A5 . . . C#6 . | B5 . . . G#5 . | F#5 . . . A5 . | G#5 . . . E5 .'],
      ['D6 . . B5 . F#5 | E5 . . A5 . B5 | C#6 . . . B5 . | A5 . . . . .',
        'F#5 . A5 . . . | B5 . . . E5 . | A5 . C#6 . E6 . | . . . . . .'],
    ] },
    double: 'bell',
    arp: { inst: 'marimba', oct: 0, gain: 0.26, pats: ['0 . 2 . 3 .', '1 . . 2 . .', '0 . . . 2 .', '. . 1 . 3 .'] },
    bassPats: ['R . . . . .', 'R . . . 5 .'],
    perc: { gain: 0 }, bell: 0.28, pad: { gain: 0.44, cutoff: [500, 850] },
    send: { reverb: 0.5, delay: 0.2, delayBeats: 1.5 },
    layers: [L(0.75, 0.6, 0.9, 0), L(1, 0.45, 0.9, 0, 0.1), L(0.35, 0.7, 0.8, 0, 0.1), L(0.9, 0.35, 0.9, 0, 0.1, 0.25), L(0, 0.7, 0.7, 0)],
    loopFrom: 0,
  },

  // Fuller: Bb major, starts as marimba and bass, then a layer per pass until kalimba doubles the line over full kit.
  finale: {
    id: 'finale', bpm: 88, beats: 4, steps: 8, swing: 0.05, scale: 'Bb C D Eb F G A', plates: 'Bb3 C4 D4 F4 G4',
    chords: ['Bb1 | F3 Bb3 D4 F4', 'A1 | F3 A3 C4 F4', 'G2 | F3 Bb3 D4 F4', 'Eb2 | G3 Bb3 D4 F4',
      'D2 | F3 Bb3 D4 F4', 'Eb2 | G3 Bb3 Eb4 G4', 'C2 | G3 Bb3 Eb4 F4', 'F2 | F3 A3 C4 F4',
      'G2 | F3 Bb3 D4 G4', 'D2 | F3 A3 D4 F4', 'Eb2 | G3 Bb3 D4 F4', 'Bb1 | F3 Bb3 D4 F4',
      'C2 | G3 Bb3 Eb4 G4', 'Eb2 | G3 Bb3 Eb4 G4', 'F2 | F3 Bb3 C4 G4', 'F2 | F3 A3 C4 F4'],
    lead: { inst: 'marimba', gain: 0.7, phrases: [
      ['D5 . F5 . Bb5 . G5 F5 | C5 . F5 . A5 . F5 . | G5 . F5 D5 . Bb4 . C5 | D5 . Eb5 . G5 . F5 .',
        'Bb4 . D5 F5 . G5 . F5 | F5 . C5 . A4 . C5 . | D5 . F5 . G5 . Bb5 . | G5 . . F5 D5 . Bb4 .'],
      ['F5 . D5 . Bb4 . D5 F5 | G5 . Eb5 . G5 . Bb5 . | G5 . F5 Eb5 . C5 . Eb5 | F5 . . . C5 . . .',
        'D5 F5 . G5 . F5 D5 . | Eb5 . G5 . Bb5 . G5 . | C5 . Eb5 . F5 . G5 . | A5 . . G5 F5 . C5 .'],
      ['Bb5 . G5 . D5 . G5 Bb5 | A5 . F5 . D5 . F5 . | G5 . Bb5 . G5 F5 . Eb5 | D5 . F5 . Bb5 . . .',
        'G5 . . F5 G5 . Bb5 . | F5 . . D5 F5 . A5 . | Bb5 . G5 . Eb5 . G5 . | F5 . D5 . Bb4 . D5 .'],
      ['G5 . Eb5 . C5 . Eb5 G5 | Bb5 . G5 . Eb5 . G5 . | F5 . G5 . C5 . F5 . | A5 . . . C6 . . .',
        'Eb5 . F5 G5 . Bb5 . G5 | G5 . F5 Eb5 . Bb4 . Eb5 | C5 . F5 . G5 . F5 . | F5 . . A5 C6 . A5 .'],
    ] },
    double: 'kalimba',
    arp: { inst: 'marimba', oct: 0, gain: 0.36, pats: ['0 . 2 1 . 2 3 .', '0 2 1 3 . 2 1 .', '1 . 3 . 2 . 3 1', '0 . 1 2 . 3 2 .'] },
    bassPats: ['R . R . 5 . R .', 'R . . R . . 5 .', 'R . . . 5 . R .'],
    perc: { shaker: 'x . x . x . x .', wood: '. . x . . . x .', drum: 'x . . . x . . .', gain: 0.36 }, bell: 0.08,
    pad: { gain: 0.4, cutoff: [700, 1500] }, send: { reverb: 0.24, delay: 0.14, delayBeats: 0.75 },
    layers: [L(0.5, 0.8, 1, 0, 0.1), L(1, 0.85, 1, 0.35, 0.2), L(1, 0.9, 1, 0.7, 0.25, 0.3), L(1, 1, 1, 0.9, 0.3, 0.7), L(1, 1, 1, 1, 0.35, 1), L(0.8, 1, 1, 0.8, 0.3, 0.8)],
    loopFrom: 3,
  },

  // Joyous: D major at the top tempo, leaping marimba line doubled on kalimba, everything on, nothing tense.
  ending: {
    id: 'ending', bpm: 90, beats: 4, steps: 8, swing: 0.06, scale: 'D E F# G A B C#', plates: 'D4 E4 F#4 A4 B4',
    chords: ['D2 | F#3 A3 E4 A4', 'G2 | G3 B3 D4 A4', 'B1 | F#3 B3 D4 A4', 'A1 | E3 A3 C#4 A4',
      'G2 | G3 B3 D4 G4', 'F#2 | F#3 A3 D4 A4', 'E2 | G3 B3 D4 G4', 'A2 | G3 D4 E4 A4',
      'D2 | F#3 D4 E4 A4', 'F#2 | F#3 C#4 E4 A4', 'G2 | G3 B3 E4 A4', 'A2 | F#3 A3 D4 A4',
      'B1 | F#3 B3 D4 A4', 'G2 | G3 B3 D4 G4', 'E2 | G3 B3 E4 G4', 'A2 | G3 C#4 E4 A4'],
    lead: { inst: 'marimba', gain: 0.72, phrases: [
      ['F#5 . A5 . D6 . B5 A5 | G5 . B5 . A5 . E5 . | F#5 . D5 . B4 . D5 F#5 | E5 . A5 . C#6 . A5 .',
        'D5 E5 F#5 . A5 . F#5 . | B5 . A5 . G5 . E5 . | D5 . F#5 A5 . B5 . A5 | A5 . E5 . C#5 . E5 .'],
      ['B5 . G5 . D5 . G5 B5 | A5 . F#5 . D5 . F#5 . | G5 . E5 . B4 . E5 G5 | A5 . . B5 A5 . E5 .',
        'G5 A5 B5 . D6 . B5 . | A5 . F#5 . A5 . D6 . | B5 . G5 E5 . G5 . B5 | A5 . . . E5 . . .'],
      ['A5 . F#5 . D5 . F#5 A5 | A5 . E5 . C#5 . E5 . | D5 . G5 . B5 . A5 G5 | F#5 . A5 . D6 . . .',
        'D6 . A5 . F#5 . A5 . | C#6 . A5 . E5 . A5 . | B5 . G5 . D5 . G5 . | A5 . F#5 . D5 . F#5 .'],
      ['B5 . A5 F#5 . D5 . F#5 | G5 . B5 . D6 . B5 . | G5 . E5 . G5 . B5 . | A5 . C#6 . E6 . C#6 .',
        'D5 F#5 . A5 . B5 . A5 | B5 . G5 . D5 . G5 . | E5 . G5 . B5 . G5 . | A5 . . E5 A5 . C#6 .'],
    ] },
    double: 'kalimba',
    arp: { inst: 'marimba', oct: 0, gain: 0.38, pats: ['0 . 2 1 . 2 3 .', '0 2 1 3 . 2 1 2', '1 . 3 . 2 . 3 1', '0 . 1 2 . 3 2 .'] },
    bassPats: ['R . R . 5 . R 5', 'R . . R 5 . R .', 'R . 5 . R . 5 .'],
    perc: { shaker: 'x x x x x x x x', wood: '. . x . . . x .', drum: 'x . . x . . x .', gain: 0.32 }, bell: 0.12,
    pad: { gain: 0.38, cutoff: [850, 1600] }, send: { reverb: 0.24, delay: 0.13, delayBeats: 0.75 },
    layers: [L(1, 0.85, 1, 0.6, 0.25, 0.25), L(1, 0.9, 1, 0.85, 0.3, 0.5), L(1, 1, 1, 1, 0.35, 0.8), L(0.8, 1, 1, 0.7, 0.3, 0.4)], loopFrom: 0,
  },
};
