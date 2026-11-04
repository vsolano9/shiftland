// Shiftland rules: pure and deterministic. The single source for the game, the solver CLI and the tests
// (docs/PLAN.md, Tech). Ported from spikes/plates/plates.ts on 2026-11-03 with the design-audit rules (S4, S6).
//
// - Every cell is plate land (plate id >= 0, height 0..3) or water (plate -1). Outside the grid is ocean.
// - A move slides one whole plate one step along its rail (axis 0 = N/S, 1 = E/W), at most maxTravel from its start.
//   A pinned plate (anchor rock) never moves, but other plates can push into it.
// - Convergent: a cell held by another plate is taken; its height becomes max(mover, old) + 1, capped at 3.
//   Whatever stands there stays on that cell, lifted, and now rides the mover.
// - Divergent: cells the plate leaves become water.
// - Ice is terrain: it rides its cell like height does. Ice lifted to height >= 2 melts and the cell turns to water.
// - A move that would put two things on one cell, or melt ice under a creature, is blocked (S4, S6).

export type Dir = 0 | 1 | 2 | 3;
export const DX = [0, 1, 0, -1] as const;
export const DY = [-1, 0, 1, 0] as const;
export const DIR_NAME = ['N', 'E', 'S', 'W'] as const;

/** goat wants height >= 2; village wants land at height <= 1; light wants sea beside it (the grid edge counts);
 *  oasis (Desert) wants a LAKE beside it: in-grid water not joined to the ocean, the opposite of a buoy;
 *  penguin (Tundra) wants to stand on an ice cell that touches sea (the grid edge counts, as for a light) */
export type Kind = 'goat' | 'village' | 'light' | 'oasis' | 'penguin';
export type Biome = 'meadow' | 'coast' | 'desert' | 'tundra' | 'finale';
export interface Obj { kind: Kind; cell: number }
export interface State { plate: Int8Array; elev: Int8Array; objs: Obj[]; off?: Int8Array;
  /** per-cell ice mask (1 = ice); absent on levels with no ice */
  ice?: Uint8Array }
export interface Level { w: number; h: number; plates: number; start: State; buoys: number[]; axis: number[]; maxTravel: number; name?: string; par?: number;
  biome: Biome;
  /** plate ids that can't move but can be pushed into (anchor rock) */
  pinned?: number[];
  /** a shortest solution in `P0E` notation, written by the level exporter */
  sol?: string[];
  /** one short sentence shown under the level name */
  blurb?: string;
  /** tutorial levels teach one idea and are exempt from the 3-move, order and tempting-move bar (solver/audit.ts shipCheck) */
  role?: 'tutorial' | 'puzzle' }

export function shift(lv: Level, s: State, p: number, d: Dir): State | null {
  const { w, h } = lv, n = w * h;
  if ((d === 1 || d === 3) !== (lv.axis[p] === 1)) return null;
  if (lv.pinned && lv.pinned.includes(p)) return null;
  const sign = d === 1 || d === 2 ? 1 : -1;
  const o = (s.off ? s.off[p] : 0) + sign;
  if (Math.abs(o) > lv.maxTravel) return null;

  const sp = s.plate, se = s.elev, si = s.ice;
  const dx = DX[d], dy = DY[d], step = dx + dy * w;
  let movers = 0;
  for (let i = 0; i < n; i++) if (sp[i] === p) {
    movers++;
    const x = (i % w) + dx, y = Math.floor(i / w) + dy;
    if (x < 0 || y < 0 || x >= w || y >= h) return null;
  }
  if (movers === 0) return null;

  const off = s.off ? s.off.slice() : new Int8Array(lv.plates);
  off[p] = o;
  const plate = sp.slice(), elev = se.slice(), ice = si ? si.slice() : undefined;
  for (let i = 0; i < n; i++) if (sp[i] === p) { plate[i] = -1; elev[i] = 0; if (ice) ice[i] = 0; }
  for (let i = 0; i < n; i++) if (sp[i] === p) {
    const j = i + step, other = sp[j];
    const wasOther = other >= 0 && other !== p;
    plate[j] = p;
    elev[j] = wasOther ? Math.min(3, Math.max(se[i], se[j]) + 1) : se[i];
    if (ice) ice[j] = si![i] | (wasOther ? si![j] : 0);
  }
  const objs = s.objs.map(ob => (sp[ob.cell] === p ? { ...ob, cell: ob.cell + step } : ob));
  for (let a = 1; a < objs.length; a++) for (let b = 0; b < a; b++) if (objs[a].cell === objs[b].cell) return null; // every Obj here is a creature
  if (ice) for (let i = 0; i < n; i++) if (ice[i] && elev[i] >= 2) {
    for (const ob of objs) if (ob.cell === i) return null; // S6: never melt the ground under a creature
    plate[i] = -1; elev[i] = 0; ice[i] = 0;
  }
  const out: State = { plate, elev, objs, off };
  if (ice) out.ice = ice;
  return out;
}

/** Water joined to the grid edge (the ocean) is sea; the rest is lake. Used by goals, solver and renderer alike. */
export function seaMask(lv: Level, s: State): Uint8Array {
  const { w, h } = lv;
  const sea = new Uint8Array(w * h);
  const q: number[] = [];
  for (let i = 0; i < w * h; i++) {
    const x = i % w, y = Math.floor(i / w);
    if (s.plate[i] < 0 && (x === 0 || y === 0 || x === w - 1 || y === h - 1)) { sea[i] = 1; q.push(i); }
  }
  while (q.length) {
    const i = q.pop()!;
    const x = i % w, y = Math.floor(i / w);
    for (let d = 0; d < 4; d++) {
      const nx = x + DX[d], ny = y + DY[d];
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const j = nx + ny * w;
      if (!sea[j] && s.plate[j] < 0) { sea[j] = 1; q.push(j); }
    }
  }
  return sea;
}

/** One entry per object (in order), then one per buoy. */
export function goalsMet(lv: Level, s: State): boolean[] {
  const { w, h } = lv;
  const sea = seaMask(lv, s);
  const isSeaAt = (x: number, y: number) => (x < 0 || y < 0 || x >= w || y >= h ? true : sea[x + y * w] === 1);
  const out: boolean[] = [];
  for (const ob of s.objs) {
    const land = s.plate[ob.cell] >= 0;
    if (ob.kind === 'goat') out.push(land && s.elev[ob.cell] >= 2);
    else if (ob.kind === 'village') out.push(land && s.elev[ob.cell] <= 1);
    else {
      const x = ob.cell % w, y = Math.floor(ob.cell / w);
      const near = (f: (x: number, y: number) => boolean) => [0, 1, 2, 3].some(d => f(x + DX[d], y + DY[d]));
      if (ob.kind === 'light') out.push(land && near(isSeaAt));
      else if (ob.kind === 'penguin') out.push(land && !!s.ice && s.ice[ob.cell] === 1 && near(isSeaAt));
      else out.push(land && near((nx, ny) => nx >= 0 && ny >= 0 && nx < w && ny < h && s.plate[nx + ny * w] < 0 && sea[nx + ny * w] === 0));
    }
  }
  for (const b of lv.buoys) out.push(sea[b] === 1);
  return out;
}

/** All goals met. Checks the goals that need no flood fill first: the solvers call this on every state. */
export function solved(lv: Level, s: State): boolean {
  for (const b of lv.buoys) if (s.plate[b] >= 0) return false;
  for (const ob of s.objs) {
    const c = ob.cell;
    if (s.plate[c] < 0) return false;
    if (ob.kind === 'goat') { if (s.elev[c] < 2) return false; }
    else if (ob.kind === 'village') { if (s.elev[c] > 1) return false; }
    else if (ob.kind === 'penguin' && !(s.ice && s.ice[c])) return false;
  }
  return goalsMet(lv, s).every(Boolean);
}

let keyBuf = new Uint16Array(256);

/** Compact search key: one char per cell (plate, ice, height), then creature cells and rail offsets. */
export function stateKey(s: State): string {
  const n = s.plate.length, need = n + s.objs.length + (s.off ? s.off.length : 0) + 1;
  if (need > keyBuf.length) keyBuf = new Uint16Array(need * 2);
  const buf = keyBuf, plate = s.plate, elev = s.elev, ice = s.ice;
  let k = 0;
  for (let i = 0; i < n; i++) buf[k++] = 48 + ((plate[i] + 1) << 3 | (ice && ice[i] ? 4 : 0) | elev[i]);
  buf[k++] = 47; // separates a state that has rail offsets from one that doesn't
  for (const o of s.objs) buf[k++] = 48 + o.cell;
  if (s.off) for (let i = 0; i < s.off.length; i++) buf[k++] = 48 + s.off[i] + 8;
  return String.fromCharCode.apply(null, buf.subarray(0, k) as unknown as number[]);
}

/** The moves a plate could ever make, in solver order (plate, then N E S W), without the pinned plates. */
export function railMoves(lv: Level): [number, Dir][] {
  const out: [number, Dir][] = [];
  for (let p = 0; p < lv.plates; p++) {
    if (lv.pinned && lv.pinned.includes(p)) continue;
    if (lv.axis[p] === 1) out.push([p, 1], [p, 3]); else out.push([p, 0], [p, 2]);
  }
  return out;
}

/**
 * Can any solved state still be reached from s? Searches every reachable state (no depth limit): `false` proves a
 * dead end, `null` means the cap was hit and nothing is proven. The "no way back" warning shows only on `false`.
 * Breadth-first: a depth-first order wandered to the cap (2+ s, answer unknown) on states that finish in 2 moves
 * (Codex chain 4); BFS finds those in a few hundred states.
 */
export function canFinish(lv: Level, s: State, cap = 200000): boolean | null {
  if (solved(lv, s)) return true;
  if (villageLost(s)) return false;
  const moves = railMoves(lv);
  const seen = new Set([stateKey(s)]); let q = [s];
  while (q.length) {
    const next: State[] = [];
    for (const c of q) for (const [p, d] of moves) {
      const t = shift(lv, c, p, d); if (!t) continue;
      const k = stateKey(t); if (seen.has(k)) continue;
      if (villageLost(t)) continue;
      if (solved(lv, t)) return true;
      seen.add(k); if (seen.size > cap) return null;
      next.push(t);
    }
    q = next;
  }
  return false;
}

/** A village on a peak is lost for good: a cell's height only ever rises, so the searches drop such states at once. */
function villageLost(s: State): boolean {
  for (const o of s.objs) if (o.kind === 'village' && s.elev[o.cell] > 1) return true;
  return false;
}

export interface Solve { min: number; solutionsAtMin: number; firstSolution: string[] }

/** One search state. `s` is dropped once the node is expanded, so memory stays near the frontier size. */
interface SearchNode { s: State | null; parent: SearchNode | null; move: string; ways: number }

function pathOf(n: SearchNode): string[] {
  const path: string[] = [];
  for (let c: SearchNode | null = n; c && c.parent; c = c.parent) path.push(c.move);
  return path.reverse();
}

/** Breadth-first search from `from` (default: the level start) up to maxDepth moves. */
export function solve(lv: Level, maxDepth: number, from: State = lv.start): Solve | null {
  if (solved(lv, from)) return { min: 0, solutionsAtMin: 1, firstSolution: [] };
  if (villageLost(from)) return null;
  const moves = railMoves(lv).map(([p, d]) => ({ p, d, name: `P${p}${DIR_NAME[d]}` }));
  let frontier: SearchNode[] = [{ s: from, parent: null, move: '', ways: 1 }];
  const seen = new Map<string, number>([[stateKey(from), 0]]);
  for (let depth = 1; depth <= maxDepth; depth++) {
    const next = new Map<string, SearchNode>();
    let firstFound: SearchNode | null = null, found = 0;
    for (const f of frontier) {
      const fs = f.s!;
      for (const m of moves) {
        const t = shift(lv, fs, m.p, m.d);
        if (!t || villageLost(t)) continue;
        const k = stateKey(t);
        const prev = seen.get(k);
        if (prev !== undefined && prev < depth) continue;
        const ex = next.get(k);
        if (ex) { ex.ways += f.ways; continue; }
        if (solved(lv, t)) {
          if (!firstFound) firstFound = { s: null, parent: f, move: m.name, ways: f.ways };
          found += f.ways; seen.set(k, depth);
          continue;
        }
        next.set(k, { s: t, parent: f, move: m.name, ways: f.ways }); seen.set(k, depth);
      }
      f.s = null;
    }
    if (firstFound) return { min: depth, solutionsAtMin: found, firstSolution: pathOf(firstFound) };
    frontier = [...next.values()];
    if (!frontier.length) return null;
  }
  return null;
}

/** Level JSON (plain arrays) as written by the level exporter. */
export interface LevelJson { name: string; role?: 'tutorial' | 'puzzle'; biome: Biome; w: number; h: number; plates: number; axis: number[]; maxTravel: number;
  plate: number[]; elev: number[]; objs: Obj[]; buoys: number[]; par: number;
  /** ice cells at the start */
  ice?: number[];
  pinned?: number[];
  /** a shortest solution, `P0E` notation */
  sol: string[];
  blurb?: string }

export function fromJson(r: LevelJson): Level {
  const start: State = { plate: Int8Array.from(r.plate), elev: Int8Array.from(r.elev), objs: r.objs.map(o => ({ ...o })) };
  if (r.ice?.length) { start.ice = new Uint8Array(r.w * r.h); for (const c of r.ice) start.ice[c] = 1; }
  const lv: Level = { name: r.name, role: r.role, biome: r.biome, par: r.par, w: r.w, h: r.h, plates: r.plates, axis: r.axis, maxTravel: r.maxTravel, buoys: r.buoys, sol: r.sol, start };
  if (r.pinned?.length) lv.pinned = r.pinned;
  if (r.blurb) lv.blurb = r.blurb;
  return lv;
}
