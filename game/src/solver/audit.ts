// Level quality bar (docs/concepts.md "Level quality bar" + design audit S8). Ported from spikes/plates/plates.ts.
// Used by the level CLI (Nov 5) and the tests; the game itself never imports it.
import { canFinish, DIR_NAME, goalsMet, railMoves, shift, solve, solved, stateKey, type Dir, type Level, type State } from '../rules/rules.ts';
import { rng } from './generate.ts';

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
  const depth = Math.max(6, Math.min(9, (lv.par ?? 6) + 2));
  const a = audit(lv, depth, tutorial ? 1 : 3);
  if (!a) return { ok: false, why: [`unsolvable within ${depth} moves`], audit: null };
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

/**
 * Every shortest solution from `from` (up to `limit` of them), found by keeping all parents in the breadth-first layers.
 * Fixtures use it to prove an "aha" move is on every shortest path, not merely on the one the solver met first.
 */
export function shortestSolutions(lv: Level, maxDepth: number, limit = 64, from: State = lv.start): string[][] {
  if (solved(lv, from)) return [[]];
  interface N { s: State; parents: [N, string][] }
  const moves = railMoves(lv);
  const root: N = { s: from, parents: [] };
  const seen = new Map<string, number>([[stateKey(from), 0]]);
  let frontier = [root];
  for (let depth = 1; depth <= maxDepth; depth++) {
    const next = new Map<string, N>(), hits = new Map<string, N>();
    for (const f of frontier) for (const [p, d] of moves) {
      const t = shift(lv, f.s, p, d); if (!t) continue;
      const k = stateKey(t), prev = seen.get(k);
      if (prev !== undefined && prev < depth) continue;
      const name = `P${p}${DIR_NAME[d]}`;
      const known = hits.get(k) ?? next.get(k);
      if (known) { known.parents.push([f, name]); continue; }
      const n: N = { s: t, parents: [[f, name]] };
      (solved(lv, t) ? hits : next).set(k, n); seen.set(k, depth);
    }
    if (hits.size) {
      const out: string[][] = [];
      const walk = (n: N, tail: string[]) => {
        if (out.length >= limit) return;
        if (n === root) { out.push(tail); return; }
        for (const [par, m] of n.parents) walk(par, [m, ...tail]);
      };
      for (const h of hits.values()) walk(h, []);
      return out;
    }
    frontier = [...next.values()];
    if (!frontier.length) break;
  }
  return [];
}

export interface FirstMove { move: string; ticks: number; finish: number | null; dead: boolean }

/** One row per legal first move: goals it ticks minus goals it unticks, moves to finish through it, proven dead end. */
export function firstMoves(lv: Level, maxDepth: number): FirstMove[] {
  const met0 = goalsMet(lv, lv.start);
  const out: FirstMove[] = [];
  for (const [p, d] of railMoves(lv)) {
    const t = shift(lv, lv.start, p, d); if (!t) continue;
    const met = goalsMet(lv, t);
    const rest = solve(lv, maxDepth - 1, t);
    out.push({ move: `P${p}${DIR_NAME[d]}`, ticks: met.filter(Boolean).length - met0.filter(Boolean).length, finish: rest ? 1 + rest.min : null,
      dead: !rest && canFinish(lv, t) === false });
  }
  return out;
}

/**
 * Share of random walks that stumble on a solved state: `walks` walks of `factor` x par legal moves (no undo). A puzzle a
 * random player finishes often has no "aha" to find; the ramp in docs/design-plates.md is built on this number.
 */
export function randomSolveRate(lv: Level, walks = 2000, factor = 3, seed = 1): number {
  const r = rng(seed), moves = railMoves(lv), length = factor * (lv.par ?? lv.sol?.length ?? 3);
  let hits = 0;
  for (let w = 0; w < walks; w++) {
    let s = lv.start;
    for (let k = 0; k < length; k++) {
      const legal: State[] = [];
      for (const [p, d] of moves) { const t = shift(lv, s, p, d); if (t) legal.push(t); }
      if (!legal.length) break;
      s = legal[Math.floor(r() * legal.length)];
      if (solved(lv, s)) { hits++; break; }
    }
  }
  return hits / walks;
}

/** Text map of a state for the CLI and for failure messages: plate letter + height, then a creature or buoy mark. */
export function drawLevel(lv: Level, s: State = lv.start): string {
  const mark: Record<string, string> = { goat: 'G', village: 'V', light: 'L', oasis: 'O', penguin: 'P' };
  const rows: string[] = [];
  for (let y = 0; y < lv.h; y++) {
    let row = '';
    for (let x = 0; x < lv.w; x++) {
      const i = x + y * lv.w, p = s.plate[i];
      const o = s.objs.find(ob => ob.cell === i);
      const t = (p < 0 ? '~' : String.fromCharCode(97 + p) + s.elev[i]) + (s.ice?.[i] ? 'i' : '') + (o ? mark[o.kind] : '') + (lv.buoys.includes(i) ? '*' : '');
      row += t.padEnd(5);
    }
    rows.push(row.trimEnd());
  }
  return rows.join('\n');
}

export function audit(lv: Level, maxDepth = 6, minMoves = 3): Audit | null {
  const r = solve(lv, maxDepth);
  if (!r) return null;
  const why: string[] = [];
  // land and plates are judged on the intended solution when the level ships one, else on the solver's first
  const path = lv.sol ?? r.firstSolution;
  const end = applyAll(lv, lv.start, path) ?? applyAll(lv, lv.start, r.firstSolution)!;
  const land = landShare(lv, end);
  const plateKept = minPlateKept(lv, end);
  const perms = r.firstSolution.length <= 7 ? permutations(r.firstSolution) : [];
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
