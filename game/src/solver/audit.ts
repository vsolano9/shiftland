// Level quality bar (docs/concepts.md "Level quality bar" + design audit S8). Ported from spikes/plates/plates.ts.
// Used by the level CLI (Nov 5) and the tests; the game itself never imports it.
import { DIR_NAME, goalsMet, shift, solve, solved, type Dir, type Level, type State } from '../rules/rules.ts';

export interface Audit {
  pass: boolean; min: number; temptingWrong: boolean; orderMatters: boolean; land: number; plateKept: number; why: string[];
  tempting?: { move: string; finish: number | null };
}

/**
 * The bar a shipped level must meet (`npm run levels:audit`). Puzzles get the full audit plus "par is the true minimum".
 * Tutorial levels teach one idea in 1-3 moves, so "order matters" and "has a tempting move" don't apply to them; they
 * must still solve at par and keep land, plates and no-goal-starts-met. Their designed traps are pinned in audit.test.ts.
 * The level's `role` decides; a level without one (an old file) is a puzzle and gets the full bar.
 */
export function shipCheck(lv: Level): { ok: boolean; why: string[]; audit: Audit | null } {
  const tutorial = lv.role === 'tutorial';
  const a = audit(lv, 6, tutorial ? 1 : 3);
  if (!a) return { ok: false, why: ['unsolvable within 6 moves'], audit: null };
  const why = tutorial ? a.why.filter(w => w !== 'order does not matter' && w !== 'no tempting wrong move') : [...a.why];
  if (lv.par !== undefined && a.min !== lv.par) why.push(`par ${lv.par} but min ${a.min}`);
  if (a.tempting && a.tempting.finish !== null && a.tempting.finish <= a.min) why.push('tempting move is not a trap');
  return { ok: why.length === 0, why, audit: a };
}

const parseMove =(m: string): [number, Dir] => [Number(m[1]), 'NESW'.indexOf(m[2]) as Dir];

export function applyAll(lv: Level, s: State, moves: string[]): State | null {
  for (const m of moves) { const [p, d] = parseMove(m); const t = shift(lv, s, p, d); if (!t) return null; s = t; }
  return s;
}

function permutations<T>(a: T[]): T[][] {
  if (a.length <= 1) return [a];
  const out: T[][] = [];
  a.forEach((x, i) => permutations([...a.slice(0, i), ...a.slice(i + 1)]).forEach(p => out.push([x, ...p])));
  return out;
}

/** Land at the end as a share of the starting land (does the island dissolve?). */
export function landShare(lv: Level, s: State): number {
  const count = (st: State) => st.plate.reduce((a, p) => a + (p >= 0 ? 1 : 0), 0);
  return count(s) / count(lv.start);
}

/** Smallest share of its starting cells any plate still owns (one plate eating another reads as conquest). */
export function minPlateKept(lv: Level, s: State): number {
  let worst = 1;
  for (let p = 0; p < lv.plates; p++) {
    const a = lv.start.plate.reduce((n, q) => n + (q === p ? 1 : 0), 0), b = s.plate.reduce((n, q) => n + (q === p ? 1 : 0), 0);
    if (a) worst = Math.min(worst, b / a);
  }
  return worst;
}

export function audit(lv: Level, maxDepth = 6, minMoves = 3): Audit | null {
  const r = solve(lv, maxDepth);
  if (!r) return null;
  const why: string[] = [];
  const end = applyAll(lv, lv.start, r.firstSolution)!;
  const land = landShare(lv, end);
  const plateKept = minPlateKept(lv, end);
  const perms = r.firstSolution.length <= 6 ? permutations(r.firstSolution) : [];
  const orderMatters = perms.some(p => { const s = applyAll(lv, lv.start, p); return !s || !solved(lv, s); });
  // Tempting wrong first move: ticks some unmet goal but is off every shortest path (finishing costs more than par).
  const met0 = goalsMet(lv, lv.start);
  let tempting: Audit['tempting'];
  outer: for (let p = 0; p < lv.plates; p++) for (let d = 0 as Dir; d < 4; d = (d + 1) as Dir) {
    const t = shift(lv, lv.start, p, d);
    if (!t || !goalsMet(lv, t).some((m, k) => m && !met0[k])) continue;
    const rest = solve(lv, maxDepth, t);
    if (!rest || rest.min > r.min - 1) { tempting = { move: `P${p}${DIR_NAME[d]}`, finish: rest ? 1 + rest.min : null }; break outer; }
  }
  const temptingWrong = tempting !== undefined;
  if (r.min < minMoves) why.push(`min ${r.min} < ${minMoves}`);
  if (!orderMatters) why.push('order does not matter');
  if (!temptingWrong) why.push('no tempting wrong move');
  if (land < 0.6) why.push(`land kept ${(land * 100).toFixed(0)}%`);
  if (plateKept < 0.5) why.push(`a plate keeps ${(plateKept * 100).toFixed(0)}%`);
  // S8: goats, lighthouses and buoys must start unhappy (villages are "don't break it" goals and start happy).
  const wishes = [...lv.start.objs.map(o => o.kind !== 'village'), ...lv.buoys.map(() => true)];
  if (wishes.some((w, k) => w && met0[k])) why.push('a goal starts met');
  return { pass: why.length === 0, min: r.min, temptingWrong, orderMatters, land, plateKept, why, tempting };
}
