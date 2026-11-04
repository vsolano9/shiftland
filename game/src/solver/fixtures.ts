// Per-level design fixtures (docs/design-plates.md "Level set"): every shipped level states its intended solution, its
// trap and its aha move in levels/tutorial.ts or levels/campaign.ts, and `npm run levels:audit` proves each claim against the
// rules. A level whose idea stops being true (a rules change, a map edit) fails here instead of shipping as solver noise.
import { previewDiff } from '../rules/diff.ts';
import { canFinish, goalsMet, seaMask, solve, solved, type Level, type State } from '../rules/rules.ts';
import type { Claim, Spec } from '../levels/tutorial.ts';
import { applyAll, landShare, minPlateKept, randomSolveRate, shortestSolutions } from './audit.ts';

/** Deepest search the audit runs; the Finale's par is 5-7 and a trap's cost is measured a little past it. */
export const AUDIT_DEPTH = 9;
/** Below this a plate reads as eaten (the grey-box's "conquest" finding); tiny plates still count by cells kept. */
const MIN_PLATE_KEPT = 0.5;
const MIN_LAND_KEPT = 0.6;

const opposite: Record<string, string> = { N: 'S', S: 'N', E: 'W', W: 'E' };

/** Every claim that is true of the move `m` from s to t (earlier: the moves before it in the same solution). */
export function claimsOf(lv: Level, s: State, t: State, m: string, earlier: string[] = []): Set<Claim> {
  const out = new Set<Claim>();
  const g0 = goalsMet(lv, s), g1 = goalsMet(lv, t);
  const up = g1.filter((b, k) => b && !g0[k]).length, down = g1.filter((b, k) => !b && g0[k]).length;
  if (up >= 2) out.add('ticks2');
  if (up === 0 && down === 0) out.add('quiet');
  if (down > 0) out.add('unticks');
  if (earlier.some(q => q[1] === m[1] && q[2] === opposite[m[2]])) out.add('returns');
  t.objs.forEach((o, k) => { if (t.elev[o.cell] > s.elev[s.objs[k].cell]) out.add('lifts'); });
  const d = previewDiff(lv, s, t);
  if (d.flood.length) out.add('floods');
  if (d.melt.length) out.add('melts');
  const sea0 = seaMask(lv, s), sea1 = seaMask(lv, t);
  const lakeCount = (st: State, sea: Uint8Array) => { let n = 0; for (let i = 0; i < st.plate.length; i++) if (st.plate[i] < 0 && !sea[i]) n++; return n; };
  if (lakeCount(t, sea1) > lakeCount(s, sea0)) out.add('lake');
  const p = Number(m[1]);
  for (let i = 0; i < t.plate.length; i++) {
    if (s.plate[i] < 0 && t.plate[i] < 0 && sea0[i] && !sea1[i]) out.add('seals');
    if (s.plate[i] < 0 && t.plate[i] < 0 && !sea0[i] && sea1[i]) out.add('opens');
    if (s.plate[i] < 0 && sea0[i] && t.plate[i] === p) out.add('reclaims');
    if (s.plate[i] >= 0 && s.plate[i] !== p && lv.pinned?.includes(s.plate[i]) && t.plate[i] === p) out.add('hitsrock');
  }
  return out;
}

/** Shape checks a level must pass whatever its role. */
export function shapeProblems(lv: Level): string[] {
  const why: string[] = [];
  const { w, h } = lv, s = lv.start;
  if (w > 9 || h > 9) why.push(`${w}x${h} is over the 9x9 limit`);
  for (let i = 0; i < w * h; i++) {
    const x = i % w, y = Math.floor(i / w);
    if ((x === 0 || y === 0 || x === w - 1 || y === h - 1) && s.plate[i] >= 0) why.push(`land on the ocean ring at ${x},${y}`);
    if (s.ice?.[i] && s.plate[i] < 0) why.push(`ice on water at ${x},${y}`);
    if (s.ice?.[i] && s.elev[i] >= 2) why.push(`ice at height ${s.elev[i]} at ${x},${y} would melt on any move`);
  }
  for (const o of s.objs) if (o.kind === 'goat' && s.ice?.[o.cell]) why.push(`goat on ice at cell ${o.cell} can never reach a peak`);
  // an island, not a rectangle: the land's bounding box must have gaps on its rim
  let x0 = w, x1 = 0, y0 = h, y1 = 0, land = 0;
  for (let i = 0; i < w * h; i++) if (s.plate[i] >= 0) { const x = i % w, y = Math.floor(i / w); x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); land++; }
  if (land === (x1 - x0 + 1) * (y1 - y0 + 1)) why.push('the island is a plain rectangle');
  // every plate that can move has a legal first step, and has room on its rail
  for (let p = 0; p < lv.plates; p++) {
    const cells = [...s.plate].filter(q => q === p).length;
    if (!cells) { why.push(`plate ${p} has no cells`); continue; }
    if (lv.pinned?.includes(p)) continue;
    const dirs = lv.axis[p] === 1 ? [1, 3] : [0, 2];
    const free = dirs.some(dir => {
      const step = lv.axis[p] === 1 ? (dir === 1 ? 1 : -1) : (dir === 2 ? w : -w);
      return [...Array(w * h).keys()].every(i => s.plate[i] !== p || (i + step >= 0 && i + step < w * h && (lv.axis[p] !== 1 || Math.floor((i + step) / w) === Math.floor(i / w))));
    });
    if (!free) why.push(`plate ${p} has no room to move`);
  }
  return why;
}

export interface FixtureReport { problems: string[]; rate: number; plateKept: number; land: number; solutions: number }

/** Proves a level against its fixture. `lv` is the level as shipped (levels.json), `spec` is what its author claims. */
export function checkFixture(spec: Spec, lv: Level): FixtureReport {
  const why: string[] = [];
  const fx = spec.fixture;
  const par = lv.par ?? -1;
  const rate = randomSolveRate(lv);
  if (!fx) return { problems: ['no fixture'], rate, plateKept: 0, land: 0, solutions: 0 };

  const intended = fx.intended.split(' ');
  if (intended.length !== par) why.push(`intended solution has ${intended.length} moves, par is ${par}`);
  if (lv.sol && lv.sol.join(' ') !== fx.intended) why.push(`exported sol "${lv.sol.join(' ')}" is not the intended "${fx.intended}"`);
  const end = applyAll(lv, lv.start, intended);
  if (!end) why.push('intended solution has an illegal move');
  else if (!solved(lv, end)) why.push('intended solution does not solve the level');
  const plateKept = end ? minPlateKept(lv, end) : 0, land = end ? landShare(lv, end) : 0;
  if (end && plateKept < MIN_PLATE_KEPT) why.push(`a plate keeps ${(plateKept * 100).toFixed(0)}% in the intended solution`);
  if (end && land < MIN_LAND_KEPT) why.push(`land kept ${(land * 100).toFixed(0)}% in the intended solution`);

  const shortest = shortestSolutions(lv, par, 256);
  if (!shortest.some(s => s.join(' ') === fx.intended)) why.push('intended solution is not a shortest solution');

  // The aha: on every shortest path, and it does what the fixture says.
  if (!shortest.every(s => s.includes(fx.aha.move) || (fx.aha.or && s.includes(fx.aha.or)))) why.push(`aha ${fx.aha.move} is not on every shortest path`);
  const at = intended.indexOf(fx.aha.move);
  if (at < 0) why.push(`aha ${fx.aha.move} is not in the intended solution`);
  else {
    const before = applyAll(lv, lv.start, intended.slice(0, at)), after = applyAll(lv, lv.start, intended.slice(0, at + 1));
    if (before && after) {
      const has = claimsOf(lv, before, after, fx.aha.move, intended.slice(0, at));
      const miss = fx.aha.shows.filter((c: Claim) => !has.has(c));
      if (miss.length) why.push(`aha ${fx.aha.move} does not show: ${miss.join(', ')} (it shows ${[...has].join(', ')})`);
    }
  }

  // The trap: a legal first move off every shortest path that costs what the fixture says. Whether it looks like progress
  // is a design judgement, stated in its `why`; for puzzles shipCheck also requires a first move that ticks a goal and costs more.
  if (fx.trap) {
    const t = applyAll(lv, lv.start, [fx.trap.move]);
    if (!t) why.push(`trap ${fx.trap.move} is not a legal first move`);
    else {
      if (shortest.some(s => s[0] === fx.trap!.move)) why.push(`trap ${fx.trap.move} is on a shortest path`);
      const rest = solve(lv, AUDIT_DEPTH, t);
      // 'dead' is a proof (the "no way back" search), never "nothing within the search depth"
      const finish = rest ? 1 + rest.min : canFinish(lv, t) === false ? 'dead' : `beyond ${AUDIT_DEPTH}`;
      if (finish !== fx.trap.finish) why.push(`trap ${fx.trap.move} finishes in ${finish}, fixture says ${fx.trap.finish}`);
    }
  } else if (par > 1) why.push('a level with par above 1 must name its trap');

  for (const p of shapeProblems(lv)) why.push(p);
  return { problems: why, rate, plateKept, land, solutions: shortest.length };
}
