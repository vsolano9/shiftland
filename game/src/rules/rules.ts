// Shiftland rules: pure and deterministic. The single source for the game, the solver CLI and the tests
// (docs/PLAN.md, Tech). Ported from spikes/plates/plates.ts on 2026-11-03 with the design-audit rules (S4, S6).
//
// - Every cell is plate land (plate id >= 0, height 0..3) or water (plate -1). Outside the grid is ocean.
// - A move slides one whole plate one step along its rail (axis 0 = N/S, 1 = E/W), at most maxTravel from its start.
// - Convergent: a cell held by another plate is taken; its height becomes max(mover, old) + 1, capped at 3.
//   Whatever stands there stays on that cell, lifted, and now rides the mover.
// - Divergent: cells the plate leaves become water.
// - A move that would put two things on one cell is blocked (S4).

export type Dir = 0 | 1 | 2 | 3;
export const DX = [0, 1, 0, -1] as const;
export const DY = [-1, 0, 1, 0] as const;
export const DIR_NAME = ['N', 'E', 'S', 'W'] as const;

export type Kind = 'goat' | 'village' | 'light';
export interface Obj { kind: Kind; cell: number }
export interface State { plate: Int8Array; elev: Int8Array; objs: Obj[]; off?: Int8Array }
export interface Level { w: number; h: number; plates: number; start: State; buoys: number[]; axis: number[]; maxTravel: number; name?: string; par?: number }

export function shift(lv: Level, s: State, p: number, d: Dir): State | null {
  const { w, h } = lv;
  if ((d === 1 || d === 3) !== (lv.axis[p] === 1)) return null;
  const sign = d === 1 || d === 2 ? 1 : -1;
  const o = (s.off ? s.off[p] : 0) + sign;
  if (Math.abs(o) > lv.maxTravel) return null;
  const off = (s.off ?? new Int8Array(lv.plates)).slice();
  off[p] = o;

  const movers: number[] = [];
  for (let i = 0; i < w * h; i++) if (s.plate[i] === p) movers.push(i);
  if (movers.length === 0) return null;
  for (const i of movers) {
    const x = (i % w) + DX[d], y = Math.floor(i / w) + DY[d];
    if (x < 0 || y < 0 || x >= w || y >= h) return null;
  }
  const plate = s.plate.slice();
  const elev = s.elev.slice();
  const moverSet = new Set(movers);
  for (const i of movers) { plate[i] = -1; elev[i] = 0; }
  const remap = new Map<number, number>();
  for (const i of movers) {
    const j = i + DX[d] + DY[d] * w;
    remap.set(i, j);
    const wasOther = !moverSet.has(j) && s.plate[j] >= 0;
    plate[j] = p;
    elev[j] = wasOther ? Math.min(3, Math.max(s.elev[i], s.elev[j]) + 1) : s.elev[i];
  }
  const objs = s.objs.map(ob => (remap.has(ob.cell) ? { ...ob, cell: remap.get(ob.cell)! } : ob));
  if (new Set(objs.map(ob => ob.cell)).size < new Set(s.objs.map(ob => ob.cell)).size) return null;
  return { plate, elev, objs, off };
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
      out.push(land && [0, 1, 2, 3].some(d => isSeaAt(x + DX[d], y + DY[d])));
    }
  }
  for (const b of lv.buoys) out.push(sea[b] === 1);
  return out;
}

export const solved = (lv: Level, s: State) => goalsMet(lv, s).every(Boolean);

export function stateKey(s: State): string {
  let k = '';
  for (let i = 0; i < s.plate.length; i++) k += String.fromCharCode(66 + s.plate[i] * 5 + s.elev[i]);
  return k + '|' + s.objs.map(o => o.cell).join(',') + '|' + (s.off ? Array.from(s.off).join(',') : '');
}

export interface Solve { min: number; solutionsAtMin: number; firstSolution: string[] }

/** Breadth-first search from `from` (default: the level start) up to maxDepth moves. */
export function solve(lv: Level, maxDepth: number, from: State = lv.start): Solve | null {
  if (solved(lv, from)) return { min: 0, solutionsAtMin: 1, firstSolution: [] };
  let frontier: { s: State; path: string[]; ways: number }[] = [{ s: from, path: [], ways: 1 }];
  const seen = new Map<string, number>([[stateKey(from), 0]]);
  for (let depth = 1; depth <= maxDepth; depth++) {
    const next = new Map<string, { s: State; path: string[]; ways: number }>();
    const found: { path: string[]; ways: number }[] = [];
    for (const f of frontier) {
      for (let p = 0; p < lv.plates; p++) for (let d = 0 as Dir; d < 4; d = (d + 1) as Dir) {
        const t = shift(lv, f.s, p, d);
        if (!t) continue;
        const k = stateKey(t);
        const prev = seen.get(k);
        if (prev !== undefined && prev < depth) continue;
        const path = [...f.path, `P${p}${DIR_NAME[d]}`];
        if (solved(lv, t)) { found.push({ path, ways: f.ways }); seen.set(k, depth); continue; }
        const ex = next.get(k);
        if (ex) ex.ways += f.ways; else { next.set(k, { s: t, path, ways: f.ways }); seen.set(k, depth); }
      }
    }
    if (found.length) return { min: depth, solutionsAtMin: found.reduce((a, b) => a + b.ways, 0), firstSolution: found[0].path };
    frontier = [...next.values()];
  }
  return null;
}

/** Level JSON (plain arrays) as written by the level exporter. */
export interface LevelJson { name: string; w: number; h: number; plates: number; axis: number[]; maxTravel: number;
  plate: number[]; elev: number[]; objs: Obj[]; buoys: number[]; par: number }

export function fromJson(r: LevelJson): Level {
  return { name: r.name, par: r.par, w: r.w, h: r.h, plates: r.plates, axis: r.axis, maxTravel: r.maxTravel, buoys: r.buoys,
    start: { plate: Int8Array.from(r.plate), elev: Int8Array.from(r.elev), objs: r.objs.map(o => ({ ...o })) } };
}
