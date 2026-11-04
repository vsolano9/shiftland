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

/** Meadow: four teaching levels, one verb or one creature each, then three puzzles built only from what those four said:
 *  the first real aha is at slot 5 and each of the next two stops a player who is not reading the board for longer.
 *  The rest of the campaign is in levels/campaign.ts. */
export const TUTORIAL: Spec[] = [
  {
    name: 'First Peak', teaches: 'push a plate into another: the seam rises; a goat wants a peak', axis: '--', expectPar: 1,
    blurb: 'Push one plate into another and the seam rises.',
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
    blurb: 'Plates and what stands on them move; a buoy stays put.',
    map: `
      ~  ~  ~  ~  ~  ~  ~
      ~  ~  a0 ~  b0 ~  ~
      ~  a0 a0 a0* b0 b0 ~
      ~  ~  a0 ~  b0 b0 ~
      ~  ~  ~  ~  ~  ~  ~`,
    fixture: { intended: 'P0W', trap: { move: 'P1E', finish: 2, why: 'the gap opens beside the buoy, not under it: a buoy marks one spot on the map, and that spot is still land' },
      aha: { move: 'P0W', says: 'the plate under the buoy backs away and the buoy floats', shows: ['floods'] } },
  },
  {
    name: 'Village Green', teaches: 'the obvious push also lifts a village and crushes it: look first, undo', axis: '-|', expectPar: 2, expectTempting: true,
    blurb: 'A goat wants a peak, but a village on a peak breaks.',
    map: `
      ~  ~  ~  ~  ~  ~  ~
      ~  ~  a0 ~  b0 ~  ~
      ~  a0 a0 b1G b0 b0 ~
      ~  a0 a0 b1V b0 ~  ~
      ~  ~  ~  ~  ~  ~  ~`,
    fixture: { intended: 'P1S P0E', trap: { move: 'P0E', finish: 'dead', why: 'the goat rises, and so does the village beside it: a broken village never recovers' },
      aha: { move: 'P1S', says: 'first slide the goat down to the row the village stood on: the village steps out past the seam', shows: ['quiet'] } },
  },
  {
    name: 'Stolen Peak', teaches: 'land remembers: push in, pull back, and the plate keeps the peak and leaves open water', axis: '-|', expectPar: 2,
    blurb: 'A plate keeps the cells it took, and what stands on them.',
    map: `
      ~  ~  ~  ~  ~  ~  ~
      ~  ~  a0 a0 b1G b0 ~
      ~  a0 a0 a0 b0* ~  ~
      ~  ~  a0 ~  b0 b0 ~
      ~  ~  a0 ~  ~  ~  ~
      ~  ~  ~  ~  ~  ~  ~`,
    fixture: { intended: 'P0E P0W', trap: { move: 'P1S', finish: 3, why: "sliding b only brings its next row under the buoy: the spot is still land, and the bite is still to do" },
      aha: { move: 'P0W', says: 'pull back and the plate carries the goat on its stolen peak, leaving open sea under the buoy', shows: ['returns'] } },
  },
  {
    name: 'Good Neighbours', role: 'puzzle', teaches: 'a plate cannot climb itself: let the neighbour take the cell in front of the goat, then you have something to hit', axis: '-|', expectPar: 3,
    blurb: 'Land rises only where it hits another plate.',
    map: `
      ~  ~  ~  ~  ~  ~  ~
      ~  ~  a0 a0 ~  ~  ~
      ~  a0 a1G a0* ~  ~  ~
      ~  a0 a0 b0 b0 b0 ~
      ~  ~  a0 ~  b0 ~  ~
      ~  ~  ~  ~  ~  ~  ~`,
    fixture: { intended: 'P1N P0E P0W', trap: { move: 'P0W', finish: 5, why: 'backing off floats the buoy at once, but the goat still faces its own plate and has nothing to climb' },
      aha: { move: 'P1N', says: 'the neighbour slides in and takes the cell in front of the goat: now the goat faces someone else', shows: ['quiet'] } },
  },
  {
    name: 'High Pasture', role: 'puzzle', teaches: 'a push takes everything in its row: step the second goat out from under it, then bring it back to climb the edge the push raised', axis: '||-', expectPar: 3,
    blurb: 'A push lifts a cell one above the taller side.',
    map: `
      ~  ~  ~  ~  ~  ~  ~  ~
      ~  a0 a1G a0 a0 a0 ~  ~
      ~  c0G c0 c0 c0 c0 ~  ~
      ~  ~  b0 b0 b0 c0 c0 ~
      ~  ~  ~  b0 b0 c0 ~  ~
      ~  ~  ~  ~  ~  ~  ~  ~`,
    fixture: { intended: 'P2W P0S P2E', trap: { move: 'P0S', finish: 'dead', why: 'the first goat has its peak at once, but the second is swallowed in the same push: it now stands on a, and a plate cannot lift itself' },
      aha: { move: 'P2W', says: 'the second goat steps aside before a comes down, so it stays on its own plate and can come back to climb the raised edge', shows: ['quiet'] } },
  },
  {
    name: "Shepherd's Hill", role: 'puzzle', teaches: 'three lessons in one: clear the village out of the row, bring a flat neighbour in front of the goat, push in and pull back', axis: '--|', expectPar: 4,
    blurb: 'A village is fine on a low hill; only a peak breaks it.',
    map: `
      ~  ~  ~  ~  ~  ~  ~  ~
      ~  ~  ~  a0 c0 c1 ~  ~
      ~  ~  a0 a0 c0 c0 c0 ~
      ~  a1 a0 a0 c0* c0 c0 ~
      ~  a0 a0 a1G b0V b0 ~  ~
      ~  ~  a0 a0 b0 b0 ~  ~
      ~  ~  ~  ~  ~  ~  ~  ~`,
    fixture: { intended: 'P1E P2S P0E P0W', trap: { move: 'P2N', finish: 6, why: 'the buoy floats at once, but the tick is worth nothing: c is needed south, in front of the goat, and coming back covers the buoy again' },
      aha: { move: 'P1E', says: 'b steps aside with the village: c can now come down over open water, staying flat, and stand in front of the goat', shows: ['quiet'] } },
  },
];
