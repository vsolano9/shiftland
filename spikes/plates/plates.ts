// Plates rules spike: is "shift a tectonic plate" a puzzle with depth?
// Throwaway design spike (not game code). Run: node spikes/plates/plates.ts [seed-count]
//
// Rules (square grid, W x H, outside the grid is ocean):
// - Every cell is either a plate cell (plate id >= 0, elevation 0..3) or open water (plate -1).
// - A move shifts one whole plate one step N/E/S/W. Illegal if any of its cells would leave the grid.
// - Convergent: a destination cell held by another plate is overridden by the mover; its new
//   elevation is max(mover, old) + 1 (capped at 3). Objects standing there are lifted with it.
// - Water: a destination that was water just takes the mover's cell (closing a sea).
// - Divergent: cells the plate vacated become open water (a rift).
// - Objects ride the cell they stand on (they move with their plate).
// Goals (all must hold at once):
//   goat     -> its cell elevation >= 2 (on a mountain)
//   village  -> its cell elevation <= 1 and not water (not crushed, not drowned)
//   light    -> lighthouse cell is land and orthogonally next to sea (water connected to the edge)
//   buoy     -> a fixed map cell that must be sea (fish want open sea there)

export type Dir = 0 | 1 | 2 | 3;
const DX = [0, 1, 0, -1];
const DY = [-1, 0, 1, 0];
const DIR_NAME = ['N', 'E', 'S', 'W'];

export interface Obj { kind: 'goat' | 'village' | 'light'; cell: number }
export interface State { plate: Int8Array; elev: Int8Array; objs: Obj[]; off?: Int8Array }
// axis[p]: 0 = slides N/S only, 1 = slides E/W only (shown as rails in the game). maxTravel: |offset| cap.
export interface Level { w: number; h: number; plates: number; start: State; buoys: number[]; name?: string; axis?: number[]; maxTravel?: number }

export function shift(lv: Level, s: State, p: number, d: Dir): State | null {
  const { w, h } = lv;
  let off = s.off;
  if (lv.axis) {
    if ((d === 1 || d === 3) !== (lv.axis[p] === 1)) return null;
    const sign = d === 1 || d === 2 ? 1 : -1;
    const o = (s.off ? s.off[p] : 0) + sign;
    if (Math.abs(o) > (lv.maxTravel ?? 2)) return null;
    off = (s.off ?? new Int8Array(lv.plates)).slice();
    off[p] = o;
  }
  const plate = s.plate.slice();
  const elev = s.elev.slice();
  const movers: number[] = [];
  for (let i = 0; i < w * h; i++) if (s.plate[i] === p) movers.push(i);
  if (movers.length === 0) return null;
  for (const i of movers) {
    const x = (i % w) + DX[d], y = Math.floor(i / w) + DY[d];
    if (x < 0 || y < 0 || x >= w || y >= h) return null;
  }
  const moverSet = new Set(movers);
  // vacate first
  for (const i of movers) { plate[i] = -1; elev[i] = 0; }
  const remap = new Map<number, number>();
  for (const i of movers) {
    const j = i + DX[d] + DY[d] * w;
    remap.set(i, j);
    const wasOther = !moverSet.has(j) && s.plate[j] >= 0;
    plate[j] = p;
    elev[j] = wasOther ? Math.min(3, Math.max(s.elev[i], s.elev[j]) + 1) : s.elev[i];
  }
  const objs = s.objs.map(o => remap.has(o.cell) ? { ...o, cell: remap.get(o.cell)! } : o);
  // Design audit S4: a push may never stack two things on one cell; it is blocked (the plate shakes).
  // Compared with the cells used before the move, so markers that share a cell by design (a twist's penguin on ice) still move.
  if (new Set(objs.map(o => o.cell)).size < new Set(s.objs.map(o => o.cell)).size) return null;
  return { plate, elev, objs, off };
}

// Shared by the solver, goals and the renderer (one flood-fill implementation).
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

export function goalsMet(lv: Level, s: State): boolean[] {
  const { w, h } = lv;
  const sea = seaMask(lv, s);
  // outside the grid is ocean, so a lighthouse on the map edge is always on the coast
  const isSeaAt = (x: number, y: number) => (x < 0 || y < 0 || x >= w || y >= h) ? true : sea[x + y * w] === 1;
  const out: boolean[] = [];
  for (const o of s.objs) {
    const land = s.plate[o.cell] >= 0;
    if (o.kind === 'goat') out.push(land && s.elev[o.cell] >= 2);
    else if (o.kind === 'village') out.push(land && s.elev[o.cell] <= 1);
    else {
      const x = o.cell % w, y = Math.floor(o.cell / w);
      out.push(land && [0, 1, 2, 3].some(d => isSeaAt(x + DX[d], y + DY[d])));
    }
  }
  for (const b of lv.buoys) out.push(sea[b] === 1);
  return out;
}

export const solved = (lv: Level, s: State) => goalsMet(lv, s).every(Boolean);

function key(s: State): string {
  let k = '';
  for (let i = 0; i < s.plate.length; i++) k += String.fromCharCode(66 + s.plate[i] * 5 + s.elev[i]);
  return k + '|' + s.objs.map(o => o.cell).join(',') + '|' + (s.off ? Array.from(s.off).join(',') : '');
}

export interface Solve { min: number; solutionsAtMin: number; firstSolution: string[]; statesSeen: number; deadEnds: number }

// BFS up to maxDepth. Counts distinct move sequences that solve at the minimum depth.
export function solve(lv: Level, maxDepth: number): Solve | null {
  if (solved(lv, lv.start)) return { min: 0, solutionsAtMin: 1, firstSolution: [], statesSeen: 1, deadEnds: 0 };
  let frontier: { s: State; path: string[]; ways: number }[] = [{ s: lv.start, path: [], ways: 1 }];
  const seen = new Map<string, number>([[key(lv.start), 0]]);
  let deadEnds = 0;
  for (let depth = 1; depth <= maxDepth; depth++) {
    const next = new Map<string, { s: State; path: string[]; ways: number }>();
    let found: { path: string[]; ways: number }[] = [];
    for (const f of frontier) {
      let children = 0;
      for (let p = 0; p < lv.plates; p++) for (let d = 0 as Dir; d < 4; d = (d + 1) as Dir) {
        const t = shift(lv, f.s, p, d);
        if (!t) continue;
        children++;
        const k = key(t);
        const prev = seen.get(k);
        if (prev !== undefined && prev < depth) continue;
        const path = [...f.path, `P${p}${DIR_NAME[d]}`];
        if (solved(lv, t)) { found.push({ path, ways: f.ways }); seen.set(k, depth); continue; }
        const ex = next.get(k);
        if (ex) ex.ways += f.ways; else { next.set(k, { s: t, path, ways: f.ways }); seen.set(k, depth); }
      }
      if (children === 0) deadEnds++;
    }
    if (found.length) return { min: depth, solutionsAtMin: found.reduce((a, b) => a + b.ways, 0), firstSolution: found[0].path, statesSeen: seen.size, deadEnds };
    frontier = [...next.values()];
    if (frontier.length > 400000) return null;
  }
  return null;
}

// ---------- level generator (Voronoi plates, random objects) ----------
function rng(seed: number) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

export function generate(seed: number, w = 7, h = 7, plates = 3): Level {
  const r = rng(seed);
  const n = w * h;
  const plate = new Int8Array(n), elev = new Int8Array(n);
  const sites = Array.from({ length: plates }, () => [1 + Math.floor(r() * (w - 2)), 1 + Math.floor(r() * (h - 2))]);
  for (let i = 0; i < n; i++) {
    const x = i % w, y = Math.floor(i / w);
    // ring of water around a smaller island
    if (x === 0 || y === 0 || x === w - 1 || y === h - 1) { plate[i] = -1; continue; }
    let best = 0, bd = 1e9;
    sites.forEach(([sx, sy], k) => { const dd = (sx - x) ** 2 + (sy - y) ** 2; if (dd < bd) { bd = dd; best = k; } });
    plate[i] = best; elev[i] = r() < 0.15 ? 1 : 0;
  }
  const land = [...Array(n).keys()].filter(i => plate[i] >= 0);
  const water = [...Array(n).keys()].filter(i => plate[i] < 0);
  const pick = (arr: number[]) => arr.splice(Math.floor(r() * arr.length), 1)[0];
  // PLACE=1 (experiment): goats, villages and buoys go on seam cells (next to another plate), where moves act first.
  // Default off, so the seeds in levels.json keep generating the same levels.
  const place = typeof process !== 'undefined' && !!process.env.PLACE;
  const seam = (i: number) => { const x = i % w, y = Math.floor(i / w);
    return [0, 1, 2, 3].some(d => { const j = x + DX[d] + (y + DY[d]) * w; return plate[j] >= 0 && plate[j] !== plate[i]; }); };
  const seamLand = land.filter(seam);
  const pickSeam = () => { if (place && seamLand.length) { const c = pick(seamLand); land.splice(land.indexOf(c), 1); return c; } const c = pick(land); const k = seamLand.indexOf(c); if (k >= 0) seamLand.splice(k, 1); return c; };
  const objs: Obj[] = [];
  const goats = 1 + Math.floor(r() * 2), villages = Math.floor(r() * 3), lights = Math.floor(r() * 2);
  for (let i = 0; i < goats; i++) objs.push({ kind: 'goat', cell: pickSeam() });
  for (let i = 0; i < villages; i++) objs.push({ kind: 'village', cell: pickSeam() });
  for (let i = 0; i < lights; i++) { const c = pick(land); const k = seamLand.indexOf(c); if (k >= 0) seamLand.splice(k, 1); objs.push({ kind: 'light', cell: c }); }
  // buoy: an interior cell that must become sea
  const interior = land.filter(i => { const x = i % w, y = Math.floor(i / w); return x > 1 && y > 1 && x < w - 2 && y < h - 2 && (!place || seam(i)); });
  const buoys = r() < 0.5 && interior.length ? [pick(interior)] : [];
  void water;
  const lv: Level = { w, h, plates, start: { plate, elev, objs }, buoys };
  const axisEnv = typeof process !== 'undefined' ? process.env.AXIS : undefined;
  if (axisEnv) { lv.axis = Array.from({ length: plates }, () => (r() < 0.5 ? 0 : 1)); lv.maxTravel = Number(axisEnv); }
  return lv;
}

// land kept after solving, as a share of the starting land (does the island dissolve?)
export function landShare(lv: Level, s: State): number {
  const count = (st: State) => st.plate.reduce((a, p) => a + (p >= 0 ? 1 : 0), 0);
  return count(s) / count(lv.start);
}

export function render(lv: Level, s: State): string {
  const sea = seaMask(lv, s);
  const rows: string[] = [];
  for (let y = 0; y < lv.h; y++) {
    let row = '';
    for (let x = 0; x < lv.w; x++) {
      const i = x + y * lv.w;
      const o = s.objs.find(o => o.cell === i);
      const b = lv.buoys.includes(i);
      if (s.plate[i] < 0) row += b ? ' ~~*' : sea[i] ? ' ~~ ' : ' .. ';
      else row += ' ' + 'abcdefgh'[s.plate[i]] + String(s.elev[i]) + (o ? o.kind[0].toUpperCase() : b ? '*' : ' ');
    }
    rows.push(row);
  }
  return rows.join('\n');
}

// ---------- quality bar (concepts.md "Level quality bar") ----------
const parseMove = (m: string): [number, Dir] => [Number(m[1]), 'NESW'.indexOf(m[2]) as Dir];
const applyAll = (lv: Level, s: State, ms: string[]): State | null => {
  for (const m of ms) { const [p, d] = parseMove(m); const t = shift(lv, s, p, d); if (!t) return null; s = t; }
  return s;
};
function permutations<T>(a: T[]): T[][] {
  if (a.length <= 1) return [a];
  const out: T[][] = [];
  a.forEach((x, i) => permutations([...a.slice(0, i), ...a.slice(i + 1)]).forEach(p => out.push([x, ...p])));
  return out;
}
// smallest share of any plate's starting cells that it still owns at the end (grey-box lesson: one plate "eating" another reads as conquest)
export function minPlateKept(lv: Level, s: State): number {
  let worst = 1;
  for (let p = 0; p < lv.plates; p++) {
    const a = lv.start.plate.reduce((n, q) => n + (q === p ? 1 : 0), 0), b = s.plate.reduce((n, q) => n + (q === p ? 1 : 0), 0);
    if (a) worst = Math.min(worst, b / a);
  }
  return worst;
}

export interface Audit { pass: boolean; min: number; temptingWrong: boolean; orderMatters: boolean; land: number; plateKept: number; why: string[]; tempting?: { move: string; finish: number | null } }
export function audit(lv: Level, maxDepth = 6, minMoves = 3): Audit | null {
  const r = solve(lv, maxDepth);
  if (!r) return null;
  const why: string[] = [];
  const end = applyAll(lv, lv.start, r.firstSolution)!;
  const land = landShare(lv, end);
  const plateKept = minPlateKept(lv, end);
  // order matters: some reordering of the shortest solution is illegal or does not solve
  const perms = r.firstSolution.length <= 6 ? permutations(r.firstSolution) : [];
  const orderMatters = perms.some(p => { const s = applyAll(lv, lv.start, p); return !s || !solved(lv, s); });
  // tempting wrong first move: makes some unmet goal true (a visible tick), but is off every shortest path, so
  // finishing after it costs more than par (or is impossible within maxDepth). With par stars, that is the trap.
  const met0 = goalsMet(lv, lv.start);
  let temptingWrong = false;
  let tempting: Audit['tempting'];
  for (let p = 0; p < lv.plates && !temptingWrong; p++) for (let d = 0 as Dir; d < 4; d = (d + 1) as Dir) {
    const t = shift(lv, lv.start, p, d);
    if (!t || !goalsMet(lv, t).some((m, k) => m && !met0[k])) continue;
    const rest = solve({ ...lv, start: t }, maxDepth);
    if (!rest || rest.min > r.min - 1) { temptingWrong = true; tempting = { move: `P${p}${DIR_NAME[d]}`, finish: rest ? 1 + rest.min : null }; break; }
  }
  if (r.min < minMoves) why.push(`min ${r.min} < ${minMoves}`);
  if (!orderMatters) why.push('order does not matter');
  if (!temptingWrong) why.push('no tempting wrong move');
  if (land < 0.6) why.push(`land kept ${(land * 100).toFixed(0)}%`);
  if (plateKept < 0.5) why.push(`a plate keeps ${(plateKept * 100).toFixed(0)}%`);
  // Design audit S8: a goal the player never has to work for is noise. Goats, lighthouses and buoys must start unhappy
  // (villages are "don't break it" goals and start happy by design).
  const start = goalsMet(lv, lv.start);
  const wishes = [...lv.start.objs.map(o => o.kind !== 'village'), ...lv.buoys.map(() => true)];
  if (wishes.some((w, k) => w && start[k])) why.push('a goal starts met');
  return { pass: why.length === 0, min: r.min, temptingWrong, orderMatters, land, plateKept, why, tempting };
}

// ---------- main: rule self-checks + depth survey ----------
function selfCheck() {
  // 1x4 strip: plate 0 | plate 1, shift plate 0 east => collision uplift at the old plate-1 cell, rift behind.
  const lv: Level = { w: 5, h: 3, plates: 2, buoys: [], start: {
    plate: Int8Array.from([-1, -1, -1, -1, -1, -1, 0, 1, 1, -1, -1, -1, -1, -1, -1]),
    elev: new Int8Array(15), objs: [{ kind: 'goat', cell: 7 }] } };
  const t = shift(lv, lv.start, 0, 1)!;
  if (t.plate[6] !== -1 || t.plate[7] !== 0 || t.elev[7] !== 1) throw new Error('uplift/rift rule broken');
  if (t.objs[0].cell !== 7) throw new Error('object on the overridden cell should stay (lifted)');
  const t2 = shift(lv, t, 0, 1)!;
  if (t2.elev[8] !== 2 || t2.plate[8] !== 0) throw new Error('second push should stack uplift');
  const e1 = shift(lv, lv.start, 1, 1)!; // into the border water: legal
  if (shift(lv, e1, 1, 1) !== null) throw new Error('moving off the grid must be illegal');
  // lighthouse on the edge of an all-land 3x3 map is on the coast (outside the grid is ocean)
  const edge: Level = { w: 3, h: 3, plates: 1, buoys: [], start: {
    plate: new Int8Array(9), elev: new Int8Array(9), objs: [{ kind: 'light', cell: 1 }] } };
  if (!goalsMet(edge, edge.start)[0]) throw new Error('edge lighthouse should see the ocean');
  // two creatures may never share a cell (design audit S4): goat on b's seam, goat on a's edge, a pushes east -> blocked
  const two: Level = { w: 5, h: 3, plates: 2, buoys: [], start: {
    plate: Int8Array.from([-1, -1, -1, -1, -1, -1, 0, 1, 1, -1, -1, -1, -1, -1, -1]),
    elev: new Int8Array(15), objs: [{ kind: 'goat', cell: 6 }, { kind: 'goat', cell: 7 }] } };
  if (shift(two, two.start, 0, 1) !== null) throw new Error('a push that stacks two creatures must be blocked');
  // "Tempting wrong move" means off every shortest path (finishing costs more than par), not "no solution at all":
  // see the seed-12 regression in auditMain.
  console.log('self-check ok');
}

function auditMain(count: number) {
  // Regression (Codex review 2026-11-03): a tempting move may still allow a finish, only above par.
  // Invariant checked on every passing level below: 1 + (moves to finish after it) > par, or no finish at all.
  // Regression (Codex review chain 2): a move that ticks one goal while unticking another is still tempting.
  // Seed 25 (rails): P1N turns [F,T,T,F] into [F,T,F,T] and leaves no finish within 6.
  // (The first fixture, seed 191, lost its P0N trap when design audit S4 blocked creature stacking.)
  // The fixture is seed 25 of the default rails generator, so it only applies with PLACE unset.
  if (process.env.AXIS === '2' && !process.env.PLACE) {
    const a25 = audit(generate(25));
    if (!a25?.temptingWrong || a25.tempting?.move !== 'P1N') throw new Error('seed 25: a goal flipping false->true must count as tempting');
  }
  const fails = new Map<string, number>();
  const passed: { seed: number; a: Audit }[] = [];
  let solvable = 0;
  for (let seed = 1; seed <= count; seed++) {
    const lv = generate(seed);
    const a = audit(lv);
    if (!a) continue;
    solvable++;
    if (a.pass) {
      const t = a.tempting!;
      if (t.finish !== null && t.finish <= a.min) throw new Error(`seed ${seed}: tempting ${t.move} finishes at par`);
      passed.push({ seed, a });
    }
    for (const w of a.why) { const k = w.replace(/\d+%|\d+ < \d+/, 'n'); fails.set(k, (fails.get(k) ?? 0) + 1); }
  }
  console.log(`audit: ${count} generated, ${solvable} solvable <= 6, ${passed.length} pass the quality bar`);
  console.log('failure reasons:', Object.fromEntries(fails));
  const byMin = new Map<number, number>();
  passed.forEach(p => byMin.set(p.a.min, (byMin.get(p.a.min) ?? 0) + 1));
  console.log('passing levels by min moves:', Object.fromEntries([...byMin.entries()].sort()));
  for (const p of passed.slice(0, 2)) {
    const lv = generate(p.seed);
    const t = p.a.tempting!;
    console.log(`\nseed ${p.seed}: min ${p.a.min}, land kept ${(p.a.land * 100).toFixed(0)}%, tempting ${t.move} -> ${t.finish === null ? 'no finish <= 6' : `finish in ${t.finish} (par ${p.a.min})`}`);
    console.log(render(lv, lv.start));
  }
}

function main() {
  selfCheck();
  if (process.env.AUDIT) { auditMain(Number(process.argv[2] ?? 300)); return; }
  const count = Number(process.argv[2] ?? 300);
  const hist = new Map<string, number>();
  const good: { seed: number; r: Solve }[] = [];
  let unsolvable = 0, trivial = 0;
  const landKept: number[] = [];
  for (let seed = 1; seed <= count; seed++) {
    const lv = generate(seed);
    const r = solve(lv, 6);
    if (!r) { unsolvable++; hist.set('none<=6', (hist.get('none<=6') ?? 0) + 1); continue; }
    hist.set(String(r.min), (hist.get(String(r.min)) ?? 0) + 1);
    if (r.min <= 1) trivial++;
    if (r.min >= 4 && r.solutionsAtMin <= 4) good.push({ seed, r });
    let s = lv.start;
    for (const m of r.firstSolution) s = shift(lv, s, Number(m[1]), 'NESW'.indexOf(m[2]) as Dir)!;
    landKept.push(landShare(lv, s));
  }
  landKept.sort((a, b) => a - b);
  console.log(`land kept after solution: median ${(landKept[landKept.length >> 1] * 100).toFixed(0)}%, worst ${(landKept[0] * 100).toFixed(0)}%`);
  console.log(`levels: ${count}  unsolvable<=6: ${unsolvable}  trivial(<=1 move): ${trivial}`);
  console.log('min-move histogram:', Object.fromEntries([...hist.entries()].sort()));
  console.log(`"puzzle-grade" (min>=4 and <=4 shortest solutions): ${good.length}`);
  for (const g of good.slice(0, 3)) {
    const lv = generate(g.seed);
    console.log(`\nseed ${g.seed}: min ${g.r.min}, shortest solutions ${g.r.solutionsAtMin}, states ${g.r.statesSeen}`);
    console.log(render(lv, lv.start));
    let s = lv.start;
    for (const m of g.r.firstSolution) { s = shift(lv, s, Number(m[1]), 'NESW'.indexOf(m[2]) as Dir)!; }
    console.log('solution:', g.r.firstSolution.join(' '));
    console.log(render(lv, s));
  }
}

if (typeof process !== 'undefined' && process.argv?.[1]?.endsWith('plates.ts')) main();
