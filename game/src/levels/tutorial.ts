// Hand-made onboarding levels (docs/design-plates.md "The first five minutes"), ported from spikes/plates/tutorial.ts.
// Map tokens (space separated, one row per line): '~' water, '~*' water with a buoy,
// '<plate><elev>[marks]' land, e.g. 'a0', 'b1G', 'a0V', 'c0L', 'a0*' (buoy on land), 'b1i' (ice), 'b1iP' (penguin on ice).
// Marks: G goat, V village, L lighthouse, O oasis, P penguin, * buoy, i ice. Axis string: one char per plate, '-' slides
// E/W, '|' slides N/S. `pinned` names plates by letter ('b' = plate b is the anchor rock).
import type { Biome, Level, Obj } from '../rules/rules.ts';
import { generate } from '../solver/generate.ts';

/** What the aha move does, checked against the rules by `npm run levels:audit` (solver/fixtures.ts). */
export type Claim =
  | 'lifts'      // raises a creature's cell
  | 'floods'     // turns land to water
  | 'ticks2'     // ticks two or more goals at once
  | 'quiet'      // ticks no goal at all: pure preparation
  | 'unticks'    // gives up a goal that was met
  | 'returns'    // slides back a plate that moved earlier in the solution
  | 'melts'      // melts ice
  | 'lake'       // leaves more lake cells than before
  | 'seals'      // turns sea into lake
  | 'opens'      // turns lake into sea
  | 'reclaims'   // the plate moves onto cells that were ocean
  | 'hitsrock';  // pushes into a pinned plate

/** The level's reason to exist, asserted per level by `npm run levels:audit`. */
export interface Fixture {
  /** the intended shortest solution, e.g. 'P1S P0E' */
  intended: string;
  /** the tempting first move: on no shortest path. null only where the level is too small to hold one */
  trap: { move: string; finish: number | 'dead'; why: string } | null;
  /** the move the level exists for: on every shortest path (`or`: its mirror image, where the level allows both), doing what `shows` says */
  aha: { move: string; or?: string; says: string; shows: Claim[] };
}

export interface Spec {
  name: string; teaches: string; axis: string; map: string; expectPar: number; expectTempting?: boolean;
  /** generated instead of drawn: [seed, w, h, plates], rails with seam placement */
  seed?: [number, number, number, number];
  biome?: Biome; role?: 'tutorial' | 'puzzle'; pinned?: string; maxTravel?: number; blurb?: string;
  fixture?: Fixture;
}

const KIND: Record<string, Obj['kind']> = { G: 'goat', V: 'village', L: 'light', O: 'oasis', P: 'penguin' };

export function parse(spec: Spec): Level {
  if (spec.seed) {
    const [seed, w, h, plates] = spec.seed;
    const lv = generate(seed, { w, h, plates, place: true });
    const axis = lv.axis.map(a => (a === 1 ? '-' : '|')).join('');
    if (axis !== spec.axis) throw new Error(`${spec.name}: generator gave axis ${axis}, spec says ${spec.axis}`);
    return { ...lv, name: spec.name, role: spec.role ?? 'tutorial', biome: spec.biome ?? 'meadow' };
  }
  const rows = spec.map.trim().split('\n').map(r => r.trim().split(/\s+/));
  const h = rows.length, w = rows[0].length;
  const plate = new Int8Array(w * h).fill(-1), elev = new Int8Array(w * h);
  const ice = new Uint8Array(w * h);
  const objs: Obj[] = []; const buoys: number[] = [];
  let plates = 0;
  rows.forEach((row, y) => {
    if (row.length !== w) throw new Error(`${spec.name}: row ${y} has ${row.length} cells, expected ${w}`);
    row.forEach((t, x) => {
      const i = x + y * w;
      if (t[0] === '~') { if (t[1] === '*') buoys.push(i); return; }
      const p = t.charCodeAt(0) - 97; plate[i] = p; plates = Math.max(plates, p + 1);
      elev[i] = Number(t[1]);
      for (const o of t.slice(2)) {
        if (o === '*') buoys.push(i);
        else if (o === 'i') ice[i] = 1;
        else if (KIND[o]) objs.push({ kind: KIND[o], cell: i });
        else throw new Error(`${spec.name}: unknown object '${o}' at ${x},${y}`);
      }
    });
  });
  const axis = [...spec.axis].map(c => (c === '-' ? 1 : 0));
  if (axis.length !== plates) throw new Error(`${spec.name}: axis has ${axis.length} plates, map has ${plates}`);
  const lv: Level = { w, h, plates, axis, maxTravel: spec.maxTravel ?? 2, buoys, start: { plate, elev, objs }, name: spec.name,
    role: spec.role ?? 'tutorial', biome: spec.biome ?? 'meadow' };
  if (ice.some(Boolean)) lv.start.ice = ice;
  if (spec.pinned) lv.pinned = [...spec.pinned].map(c => c.charCodeAt(0) - 97);
  if (spec.blurb) lv.blurb = spec.blurb;
  return lv;
}

/** Meadow: the first six levels, one verb or one creature each. The rest of the campaign is in levels/campaign.ts. */
export const TUTORIAL: Spec[] = [
  {
    name: 'First Peak', teaches: 'push a plate into another: the seam rises; a goat wants a peak', axis: '--', expectPar: 1,
    blurb: 'Push one plate into another. The seam rises.',
    map: `
      ~  ~  ~  ~  ~  ~  ~
      ~  ~  a0 b0 b0 ~  ~
      ~  a0 a0 b1G b0 b0 ~
      ~  ~  a0 b1 b0 ~  ~
      ~  ~  ~  ~  ~  ~  ~`,
    fixture: { intended: 'P0E', trap: null, aha: { move: 'P0E', or: 'P1W', says: 'the plates meet, the raised cell climbs one higher and the goat has its peak', shows: ['lifts'] } },
  },
  {
    name: 'Open Water', teaches: 'pull a plate away: the gap becomes sea; a buoy wants open sea', axis: '--', expectPar: 1,
    blurb: 'Pull plates apart. The gap becomes sea.',
    map: `
      ~  ~  ~  ~  ~  ~  ~
      ~  ~  a0 a0 b0 ~  ~
      ~  a0 a0 a0* b0 b0 ~
      ~  ~  a0 a0 b0 b0 ~
      ~  ~  ~  ~  ~  ~  ~`,
    fixture: { intended: 'P0W', trap: { move: 'P1E', finish: 2, why: 'the gap opens beside the buoy, not under it: the buoy rides the other plate' },
      aha: { move: 'P0W', says: 'the plate under the buoy backs away and the buoy floats', shows: ['floods'] } },
  },
  {
    name: 'Mind the Village', teaches: 'the obvious push also lifts a village and crushes it: look first, undo', axis: '-|', expectPar: 2, expectTempting: true,
    blurb: 'Goats want peaks. A village on a peak breaks.',
    map: `
      ~  ~  ~  ~  ~  ~  ~
      ~  ~  a0 b0 b0 ~  ~
      ~  a0 a0 b1G b0 b0 ~
      ~  a0 a0 b1V b0 ~  ~
      ~  ~  ~  ~  ~  ~  ~`,
    fixture: { intended: 'P1S P0E', trap: { move: 'P0E', finish: 'dead', why: 'the goat rises, and so does the village beside it: a broken village never recovers' },
      aha: { move: 'P1S', says: 'first slide the goat down to the row the village stood on: the village steps out past the seam', shows: ['quiet'] } },
  },
  {
    name: 'Two Wishes', teaches: 'a plate has a front and a back: its front lifts land, its back opens sea, in the same move', axis: '--|', expectPar: 1, expectTempting: true,
    blurb: 'A plate has a front and a back. Both count.',
    map: `
      ~  ~  ~  ~  ~  ~  ~
      ~  a0 a0 a0 b0 b0 ~
      ~  a0 a0 b1G b0 b0 ~
      ~  a0 c0 c0* c0 ~  ~
      ~  ~  ~  ~  ~  ~  ~`,
    fixture: { intended: 'P2N', trap: { move: 'P0E', finish: 2, why: 'the plain push lifts the goat and leaves the buoy on land' },
      aha: { move: 'P2N', says: 'one slide: its front lifts the goat, its back opens sea under the buoy', shows: ['ticks2', 'lifts'] } },
  },
  {
    name: 'Far One First', teaches: 'two goats, two pushes: the order decides, because a move leaves water behind', axis: '|--', expectPar: 2, expectTempting: true,
    blurb: 'Every move leaves water behind it. Order matters.',
    map: `
      ~  ~  ~  ~  ~  ~  ~  ~
      ~  ~  a0 a0 b1G b0 c1G ~
      ~  a0 a0 a0 b0 b0 c0 ~
      ~  ~  a0 a0 b0 b0 c0 ~
      ~  ~  ~  ~  ~  ~  ~  ~`,
    fixture: { intended: 'P2W P1W', trap: { move: 'P1W', finish: 3, why: 'the near goat rises, but b has backed away from c: c now pushes into water and lifts nothing' },
      aha: { move: 'P2W', says: 'the far goat goes first, while its neighbour is still there to push against', shows: ['lifts'] } },
  },
  {
    name: 'Stolen Peak', teaches: 'land remembers: push in, pull back, and the plate keeps the peak and leaves a bay', axis: '-|', expectPar: 2,
    blurb: 'Land remembers. A plate keeps the peak it raised.',
    map: `
      ~  ~  ~  ~  ~  ~  ~
      ~  ~  a0 a0 b1G b0 ~
      ~  a0 a0 a0 b0* b0 ~
      ~  ~  a0 a0 b0 b0 ~
      ~  ~  ~  ~  ~  ~  ~`,
    fixture: { intended: 'P0E P0W', trap: { move: 'P1N', finish: 4, why: "sliding b looks like it clears the buoy, but b's next row slides in under it and the goat sails away from the seam" },
      aha: { move: 'P0W', says: 'pull back and the plate carries the goat on its stolen peak, leaving open sea under the buoy', shows: ['returns'] } },
  },
];
