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

/**
 * The preview-greedy player: at every step it previews each legal move, takes one that leaves the most goals met (ties at
 * random) and never undoes. Returns the exact chance it finishes within par, over every tie-break. 0 proves the level
 * can't be solved by following the preview: it needs a move that looks no better than another or looks worse.
 */
export function greedySolveRate(lv: Level, moves = lv.par ?? lv.sol?.length ?? 3): number {
  const rails = railMoves(lv), memo = new Map<string, number>();
  const count = (s: State) => goalsMet(lv, s).filter(Boolean).length;
  const chance = (s: State, left: number): number => {
    if (solved(lv, s)) return 1;
    if (left === 0) return 0;
    const key = `${left}:${stateKey(s)}`, known = memo.get(key);
    if (known !== undefined) return known;
    let best = -1, tied: State[] = [];
    for (const [p, d] of rails) {
      const t = shift(lv, s, p, d); if (!t) continue;
      const n = count(t);
      if (n > best) { best = n; tied = [t]; } else if (n === best) tied.push(t);
    }
    const out = tied.length ? tied.reduce((a, t) => a + chance(t, left - 1), 0) / tied.length : 0;
    memo.set(key, out);
    return out;
  };
  return chance(lv.start, moves);
}

const shuffled = <T,>(a: readonly T[], r: () => number): T[] => a.map(x => ({ x, k: r() })).sort((p, q) => p.k - q.k).map(p => p.x);
const crushed = (s: State) => s.objs.some(o => o.kind === 'village' && s.elev[o.cell] > 1);

/** Tries (one move looked at, undo free) for a player who always goes on from the position with the most ticks, the latest
 *  on a tie, and gives a broken village up at once because the game says "no way back". Never repeats a position. */
function followTries(lv: Level, seed: number, cap: number): number {
  const r = rng(seed), rails = railMoves(lv), seen = new Set([stateKey(lv.start)]);
  const open = [{ s: lv.start, ticks: 0, at: 0 }];
  let tries = 0, count = 0;
  while (open.length) {
    let best = 0;
    for (let i = 1; i < open.length; i++) if (open[i].ticks > open[best].ticks || (open[i].ticks === open[best].ticks && open[i].at > open[best].at)) best = i;
    const cur = open.splice(best, 1)[0];
    for (const [p, d] of shuffled(rails, r)) {
      const t = shift(lv, cur.s, p, d); if (!t) continue;
      tries++;
      if (solved(lv, t)) return tries;
      if (tries >= cap) return cap;
      const k = stateKey(t);
      if (seen.has(k) || crushed(t)) continue;
      seen.add(k);
      open.push({ s: t, ticks: goalsMet(lv, t).filter(Boolean).length, at: ++count });
    }
  }
  return cap;
}

/** Tries for a player who ignores the ticks and works through the board move by move, shortest lines first. */
function blindTries(lv: Level, seed: number): number {
  const r = rng(seed), rails = railMoves(lv), seen = new Set([stateKey(lv.start)]);
  let frontier = [lv.start], tries = 0;
  while (frontier.length) {
    const next: State[] = [];
    for (const c of frontier) for (const [p, d] of shuffled(rails, r)) {
      const t = shift(lv, c, p, d); if (!t) continue;
      tries++;
      if (solved(lv, t)) return tries;
      const k = stateKey(t);
      if (!seen.has(k)) { seen.add(k); next.push(t); }
    }
    frontier = next;
  }
  return tries;
}

export interface Effort { follow: number; blind: number; effort: number }

/**
 * How much a level resists a player who is not reading the board: the moves tried by the cheaper of two strategies, chasing
 * ticks or brute force, averaged over seeded tie-breaks. Undo is free, so this is what a look at every move costs. A puzzle
 * whose effort is low falls without thought whatever its par: the Nov 4 tester breezed through Ice Dam (par 3, effort 22)
 * and stuck on Two Waters (par 3, effort 122, against a highest 108 before it). This is the ramp, read from `npm run levels:audit`.
 */
export function effortOf(lv: Level, runs = 24, cap = 4000): Effort {
  let follow = 0, blind = 0;
  for (let i = 1; i <= runs; i++) { follow += followTries(lv, i * 7 + 1, cap); blind += blindTries(lv, i * 13 + 1); }
  follow = Math.round(follow / runs); blind = Math.round(blind / runs);
  return { follow, blind, effort: Math.min(follow, blind) };
}

/** One thing a level asks for or puts in the way: a goal, a connected stretch of ice, or the pin on a rock. */
export interface Part { what: string; kind: 'goal' | 'ice' | 'pin'; par: number | null; ways: number;
  /** needed: unsolvable within par without it; shortens: par drops without it; widens: more shortest solutions without it; decoy: nothing changes */
  effect: 'needed' | 'shortens' | 'widens' | 'decoy' }

/** Ice cells joined by an edge on one plate; a penguin's own floe is its goal, so it is not a part here. */
function iceStretches(lv: Level): number[][] {
  const { w, h } = lv, { ice, plate, objs } = lv.start;
  if (!ice) return [];
  const seen = new Set(objs.filter(o => o.kind === 'penguin').map(o => o.cell));
  const out: number[][] = [];
  for (let i = 0; i < w * h; i++) {
    if (!ice[i] || seen.has(i)) continue;
    const group: number[] = [], todo = [i];
    seen.add(i);
    while (todo.length) {
      const c = todo.pop()!;
      group.push(c);
      for (const j of [c % w > 0 ? c - 1 : -1, c % w < w - 1 ? c + 1 : -1, c - w, c + w])
        if (j >= 0 && j < w * h && ice[j] && plate[j] === plate[c] && !seen.has(j)) { seen.add(j); todo.push(j); }
    }
    out.push(group);
  }
  return out;
}

/**
 * The decoy test: take each part away and solve again. A part whose removal leaves the same par and the same shortest
 * solutions constrains nothing: a passenger goal ticked in passing, spare ice, a "rock" that would never have moved anyway.
 */
export function partsOf(lv: Level): Part[] {
  const base = solve(lv, 9);
  if (!base) return [];
  const out: Part[] = [];
  const test = (what: string, kind: Part['kind'], v: Level) => {
    const r = solve(v, base.min);
    const effect: Part['effect'] = !r ? 'needed' : r.min < base.min ? 'shortens' : r.solutionsAtMin > base.solutionsAtMin ? 'widens' : 'decoy';
    out.push({ what, kind, par: r ? r.min : null, ways: r ? r.solutionsAtMin : 0, effect });
  };
  const at = (c: number) => `${c % lv.w},${Math.floor(c / lv.w)}`;
  lv.start.objs.forEach((o, k) => test(`${o.kind} at ${at(o.cell)}`, 'goal', { ...lv, start: { ...lv.start, objs: lv.start.objs.filter((_, q) => q !== k) } }));
  lv.buoys.forEach((b, k) => test(`buoy at ${at(b)}`, 'goal', { ...lv, buoys: lv.buoys.filter((_, q) => q !== k) }));
  for (const group of iceStretches(lv)) {
    const ice = lv.start.ice!.slice();
    for (const c of group) ice[c] = 0;
    test(`ice at ${group.map(at).join(' ')}`, 'ice', { ...lv, start: { ...lv.start, ice } });
  }
  if (lv.pinned?.length) test('the pin on the rock', 'pin', { ...lv, pinned: undefined });
  return out;
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
