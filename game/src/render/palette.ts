// Colours and heights shared by the render layer (docs/design-plates.md "Look and sound", concepts/shiftland-*.png).
// Plate identity: a bold band + a large low-contrast surface pattern, the same in every biome; tints never use water hues.
import { Color } from 'three';

export type BiomeName = 'meadow' | 'coast' | 'desert' | 'tundra' | 'finale';

/** World height of a cell's top surface for a rules height. */
export const topY = (h: number) => 0.42 + h * 0.5;

export interface PlateLook { band: string; hue: string; pattern: number; name: string }
export const PLATES: PlateLook[] = [
  { name: 'coral', band: '#ee5a4f', hue: '#f0866f', pattern: 0 },   // diagonal stripes
  { name: 'gold', band: '#f5b52c', hue: '#f4c64d', pattern: 1 },    // round dots
  { name: 'violet', band: '#9a5be0', hue: '#b488e6', pattern: 2 },  // zigzag chevrons
  { name: 'rust', band: '#c8622a', hue: '#d98a52', pattern: 3 },    // checks
];

/** The hour on an island: the journey runs from morning over the meadow to sunset at the summit. */
export interface DayLight { sun: string; sunI: number; sky: string; under: string; hemi: number; from: [number, number, number] }
export const MORNING: DayLight = { sun: '#fff3dc', sunI: 2.35, sky: '#fdfbf2', under: '#7fa3a8', hemi: 1.5, from: [-7, 16, 8] };
export const DAYLIGHT: Record<BiomeName, DayLight> = {
  meadow: MORNING,
  coast: { sun: '#fff8ea', sunI: 2.45, sky: '#f6fbff', under: '#86b4bc', hemi: 1.5, from: [-6, 17, 7] },
  desert: { sun: '#ffdcaa', sunI: 2.6, sky: '#ffefd4', under: '#b08e76', hemi: 1.35, from: [-9, 14, 8] },
  tundra: { sun: '#e8f0ff', sunI: 2.1, sky: '#e4f0ff', under: '#7f9dc4', hemi: 1.6, from: [-8, 13, 9] },
  finale: { sun: '#ffb98a', sunI: 2.5, sky: '#f7d9d6', under: '#6c6ea8', hemi: 1.25, from: [-11, 11, 8] },
};

export interface BiomeLook { ground: string; mix: number; rock: string; sand: string; sea: [string, string]; accent: string; label: string }
export const BIOMES: Record<BiomeName, BiomeLook> = {
  meadow: { ground: '#7ccb46', mix: 0.1, rock: '#8d8a84', sand: '#c9a56b', sea: ['#1298ad', '#22cfc9'], accent: '#6cbf3c', label: 'Meadow' },
  coast: { ground: '#ecd59a', mix: 0.2, rock: '#9b9184', sand: '#e9d29a', sea: ['#0f93bd', '#35dbd9'], accent: '#2fa9d6', label: 'Coast' },
  desert: { ground: '#efb066', mix: 0.3, rock: '#b08660', sand: '#f0cd8a', sea: ['#118da3', '#35cfb8'], accent: '#e8953a', label: 'Desert' },
  tundra: { ground: '#eef3f8', mix: 0.13, rock: '#7e8794', sand: '#cfd9e2', sea: ['#17749c', '#3cb4d0'], accent: '#7fc4ec', label: 'Tundra' },
  finale: { ground: '#86c85a', mix: 0.14, rock: '#7f7a78', sand: '#d4b57a', sea: ['#27528f', '#3fa9c4'], accent: '#a06be0', label: 'Finale' },
};

export const color = (hex: string) => new Color(hex).convertSRGBToLinear();
export const srgb = (hex: string) => new Color(hex);

export function plateTint(p: number, b: BiomeName, out = new Color()): Color {
  const l = PLATES[p % PLATES.length], g = BIOMES[b];
  // round the colour wheel, not across it: green and coral averaged in RGB is mud; through yellow it is a fresh lime
  return out.copy(new Color(g.ground)).lerpHSL(new Color(l.hue), g.mix);
}
export const plateBand = (p: number) => new Color(PLATES[p % PLATES.length].band);
