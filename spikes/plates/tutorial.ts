// Hand-made onboarding levels for Shiftland, checked by the solver: do the "first five minutes" beats in
// docs/design-plates.md work under the real rules? Throwaway spike. Run: node spikes/plates/tutorial.ts
//
// Map tokens (space separated, one row per line): '~' water, '~*' water with a buoy,
// '<plate><elev>[obj]' land, e.g. 'a0', 'b1G', 'a0V', 'c0L', 'a0*' (buoy on land).
// Objects: G goat, V village, L lighthouse.
import { audit, solve, shift, goalsMet, render, generate, type Level, type Obj, type Dir } from './plates.ts';

interface Spec { name: string; teaches: string; axis: string; map: string; expectPar: number; expectTempting?: boolean; seed?: [number, number, number, number] }

export function parse(spec: Spec): Level {
  if (spec.seed) {
    // generated level (rails, seam placement); the axis string documents what the generator picks
    process.env.AXIS = '2'; process.env.PLACE = '1';
    const lv = generate(...spec.seed); delete process.env.AXIS; delete process.env.PLACE;
    const axis = lv.axis!.map(a => (a === 1 ? '-' : '|')).join('');
    if (axis !== spec.axis) throw new Error(`${spec.name}: generator gave axis ${axis}, spec says ${spec.axis}`);
    return { ...lv, name: spec.name };
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
      if (o === 'G') objs.push({ kind: 'goat', cell: i });
      else if (o === 'V') objs.push({ kind: 'village', cell: i });
      else if (o === 'L') objs.push({ kind: 'light', cell: i });
      else if (o === '*') buoys.push(i);
    });
  });
  // axis string: one char per plate, '-' slides E/W, '|' slides N/S
  const axis = [...spec.axis].map(c => (c === '-' ? 1 : 0));
  if (axis.length !== plates) throw new Error(`${spec.name}: axis has ${axis.length} plates, map has ${plates}`);
  return { w, h, plates, axis, maxTravel: 2, buoys, start: { plate, elev, objs }, name: spec.name };
}

// L1-L5 follow design-plates.md "The first five minutes".
export const TUTORIAL: Spec[] = [
  {
    name: 'First Peak', teaches: 'push a plate into another: the seam rises; a goat wants a peak', axis: '-' + '-', expectPar: 1,
    map: `
      ~  ~  ~  ~  ~  ~
      ~  a0 a0 b1G b0 ~
      ~  a0 a0 b1 b0 ~
      ~  ~  ~  ~  ~  ~`,
  },
  {
    name: 'Open Water', teaches: 'pull a plate away: the gap becomes sea; a buoy wants open sea', axis: '-' + '-', expectPar: 1,
    map: `
      ~  ~  ~  ~  ~  ~  ~
      ~  a0 a0 a0* b0 b0 ~
      ~  a0 a0 a0 b0 b0 ~
      ~  ~  ~  ~  ~  ~  ~`,
  },
  {
    name: 'Mind the Village', teaches: 'the obvious push also lifts a village and crushes it: look first, undo', axis: '-' + '|', expectPar: 2, expectTempting: true,
    map: `
      ~  ~  ~  ~  ~  ~
      ~  a0 a0 b1G b0 ~
      ~  a0 a0 b1V b0 ~
      ~  ~  ~  ~  ~  ~`,
  },
  {
    name: 'Two Wishes', teaches: 'a peak and a sea at once: one plate does both if you pick the right one', axis: '-' + '-' + '|', expectPar: 2,
    map: `
      ~  ~  ~  ~  ~  ~  ~
      ~  a0 a0 b1G b0 b0 ~
      ~  a0 a0 b0 b0* b0 ~
      ~  c0 c0 c0 c0 c0 ~
      ~  ~  ~  ~  ~  ~  ~`,
  },
  // Generated (seed 56, 6x5, 2 plates, seam placement), found by a small-map search: par 3, ONE shortest solution
  // (P1S P1N P0E: dip b, bring it back reshaped, then push a), tempting P0E leaves no finish. The first real "aha".
  // My hand-made L5 ("Order Matters") failed: the solver found a 4-move push-push-pull-pull, so it was dropped.
  {
    name: 'Dip and Return', teaches: 'moving a plate away and back is not "nothing": the seam changes, and order decides', axis: '-|', expectPar: 3, expectTempting: true,
    map: '', seed: [56, 6, 5, 2],
  },
];

function report(spec: Spec) {
  const lv = parse(spec);
  const r = solve(lv, 6);
  const a = audit(lv, 6, 1);
  const met = goalsMet(lv, lv.start);
  // every legal first move and what it does to the goals (what a new player will try)
  const firsts: string[] = [];
  for (let p = 0; p < lv.plates; p++) for (let d = 0 as Dir; d < 4; d = (d + 1) as Dir) {
    const t = shift(lv, lv.start, p, d); if (!t) continue;
    const g = goalsMet(lv, t).map((m, k) => (m === met[k] ? '' : m ? '+' : '-') + k).filter(s => s[0] === '+' || s[0] === '-');
    firsts.push(`P${p}${'NESW'[d]}${g.length ? '[' + g.join(' ') + ']' : ''}`);
  }
  const ok = r && r.min === spec.expectPar && (!spec.expectTempting || a?.temptingWrong);
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${spec.name}: par ${r?.min ?? 'none'} (want ${spec.expectPar}), shortest solutions ${r?.solutionsAtMin}, ` +
    `tempting ${a?.temptingWrong ? a.tempting!.move + ' -> ' + (a.tempting!.finish ?? 'no finish') : 'none'}, order matters ${a?.orderMatters}, solution ${r?.firstSolution.join(' ')}`);
  console.log(`     teaches: ${spec.teaches}\n     first moves: ${firsts.join('  ')}`);
  if (process.env.SHOW) console.log(render(lv, lv.start));
  return !!ok;
}

if (typeof process !== 'undefined' && process.argv?.[1]?.endsWith('tutorial.ts')) {
  const results = TUTORIAL.map(report);
  console.log(`${results.filter(Boolean).length}/${results.length} tutorial levels as designed`);
}
