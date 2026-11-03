// Hand-made onboarding levels (docs/design-plates.md "The first five minutes"), ported from spikes/plates/tutorial.ts.
// Map tokens (space separated, one row per line): '~' water, '~*' water with a buoy,
// '<plate><elev>[obj]' land, e.g. 'a0', 'b1G', 'a0V', 'c0L', 'a0*' (buoy on land). Objects: G goat, V village,
// L lighthouse, O oasis. Axis string: one char per plate, '-' slides E/W, '|' slides N/S.
import type { Level, Obj } from '../rules/rules.ts';
import { generate } from '../solver/generate.ts';

export interface Spec {
  name: string; teaches: string; axis: string; map: string; expectPar: number; expectTempting?: boolean;
  /** generated instead of drawn: [seed, w, h, plates], rails with seam placement */
  seed?: [number, number, number, number];
}

const KIND: Record<string, Obj['kind']> = { G: 'goat', V: 'village', L: 'light', O: 'oasis' };

export function parse(spec: Spec): Level {
  if (spec.seed) {
    const [seed, w, h, plates] = spec.seed;
    const lv = generate(seed, { w, h, plates, place: true });
    const axis = lv.axis.map(a => (a === 1 ? '-' : '|')).join('');
    if (axis !== spec.axis) throw new Error(`${spec.name}: generator gave axis ${axis}, spec says ${spec.axis}`);
    return { ...lv, name: spec.name, role: 'tutorial' };
  }
  const rows = spec.map.trim().split('\n').map(r => r.trim().split(/\s+/));
  const h = rows.length, w = rows[0].length;
  const plate = new Int8Array(w * h).fill(-1), elev = new Int8Array(w * h);
  const objs: Obj[] = []; const buoys: number[] = [];
  let plates = 0;
  rows.forEach((row, y) => {
    if (row.length !== w) throw new Error(`${spec.name}: row ${y} has ${row.length} cells, expected ${w}`);
    row.forEach((t, x) => {
      const i = x + y * w;
      if (t[0] === '~') { if (t[1] === '*') buoys.push(i); return; }
      const p = t.charCodeAt(0) - 97; plate[i] = p; plates = Math.max(plates, p + 1);
      elev[i] = Number(t[1]);
      const o = t[2];
      if (o === '*') buoys.push(i);
      else if (o) {
        if (!KIND[o]) throw new Error(`${spec.name}: unknown object '${o}' at ${x},${y}`);
        objs.push({ kind: KIND[o], cell: i });
      }
    });
  });
  const axis = [...spec.axis].map(c => (c === '-' ? 1 : 0));
  if (axis.length !== plates) throw new Error(`${spec.name}: axis has ${axis.length} plates, map has ${plates}`);
  return { w, h, plates, axis, maxTravel: 2, buoys, start: { plate, elev, objs }, name: spec.name, role: 'tutorial' };
}

export const TUTORIAL: Spec[] = [
  {
    name: 'First Peak', teaches: 'push a plate into another: the seam rises; a goat wants a peak', axis: '--', expectPar: 1,
    map: `
      ~  ~  ~  ~  ~  ~
      ~  a0 a0 b1G b0 ~
      ~  a0 a0 b1 b0 ~
      ~  ~  ~  ~  ~  ~`,
  },
  {
    name: 'Open Water', teaches: 'pull a plate away: the gap becomes sea; a buoy wants open sea', axis: '--', expectPar: 1,
    map: `
      ~  ~  ~  ~  ~  ~  ~
      ~  a0 a0 a0* b0 b0 ~
      ~  a0 a0 a0 b0 b0 ~
      ~  ~  ~  ~  ~  ~  ~`,
  },
  {
    name: 'Mind the Village', teaches: 'the obvious push also lifts a village and crushes it: look first, undo', axis: '-|', expectPar: 2, expectTempting: true,
    map: `
      ~  ~  ~  ~  ~  ~
      ~  a0 a0 b1G b0 ~
      ~  a0 a0 b1V b0 ~
      ~  ~  ~  ~  ~  ~`,
  },
  // Design audit S2: P2N's front edge lifts the goat, its back edge opens sea under the buoy; the obvious P0E takes 2.
  {
    name: 'Two Wishes', teaches: 'a plate has a front and a back: its front lifts land, its back opens sea, in the same move', axis: '--|', expectPar: 1, expectTempting: true,
    map: `
      ~  ~  ~  ~  ~  ~  ~
      ~  a0 a0 b0 b0 b0 ~
      ~  a0 a0 b1G b0 b0 ~
      ~  c0 c0 c0* c0 c0 ~
      ~  ~  ~  ~  ~  ~  ~`,
  },
  // Design audit S2: one shortest solution P2W P1W; pushing b first opens a gap, so c's push lifts nothing (P1E -> 3).
  {
    name: 'Far One First', teaches: 'two goats, two pushes: the order decides, because a move leaves water behind', axis: '|--', expectPar: 2, expectTempting: true,
    map: `
      ~  ~  ~  ~  ~  ~  ~
      ~  a0 a0 b1G b0 c1G ~
      ~  a0 a0 b0 b0 c0 ~
      ~  a0 a0 b0 b0 c0 ~
      ~  ~  ~  ~  ~  ~  ~`,
  },
  // Generated (seed 56, 6x5, 2 plates): par 3, one shortest solution (P1S P1N P0E), tempting P0E leaves no finish.
  {
    name: 'Dip and Return', teaches: 'moving a plate away and back is not "nothing": the seam changes, and order decides', axis: '-|', expectPar: 3, expectTempting: true,
    map: '', seed: [56, 6, 5, 2],
  },
];
