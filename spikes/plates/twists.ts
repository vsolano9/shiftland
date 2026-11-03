// Do the planned biome twists make puzzles? Throwaway spike on top of plates.ts (rules unchanged there).
// Run: node spikes/plates/twists.ts [count]
//
// Twists (docs/design-plates.md, "Biomes and twists"):
//   pinned  (Tundra): an anchored plate can never move, but other plates can still push into it (uplift as usual).
//   ice     (Tundra): an 'ice' marker rides its cell; when that cell is lifted to height >= 2 the ice melts and the
//                     cell becomes water. Penguins want to stand on ice that touches sea.
//   oasis   (Desert): an oasis wants an orthogonally adjacent LAKE (water not joined to the ocean), the opposite of a buoy.
import { shift, goalsMet, seaMask, generate, type Level, type State, type Dir } from './plates.ts';

type Kind = 'goat' | 'village' | 'light' | 'ice' | 'penguin' | 'oasis';
interface TObj { kind: Kind; cell: number }
interface TLevel extends Level { pinned: number[] }

const DX = [0, 1, 0, -1], DY = [-1, 0, 1, 0];

function step(lv: TLevel, s: State, p: number, d: Dir): State | null {
  if (lv.pinned.includes(p)) return null;
  const t = shift(lv, s, p, d);
  if (!t) return null;
  // ice melts where it was lifted to height >= 2: the cell turns to water and the ice marker is gone.
  // Design audit S6: a creature is never melted away with it (that deleted its goal, so a level could be won by melting);
  // a move that would melt ice under a creature is blocked, like a push that stacks creatures.
  const objs = t.objs as unknown as TObj[];
  const melt = new Set(objs.filter(o => o.kind === 'ice' && t.elev[o.cell] >= 2).map(o => o.cell));
  if (!melt.size) return t;
  if (objs.some(o => o.kind !== 'ice' && melt.has(o.cell))) return null;
  const plate = t.plate.slice(), elev = t.elev.slice();
  for (const c of melt) { plate[c] = -1; elev[c] = 0; }
  return { ...t, plate, elev, objs: objs.filter(o => !melt.has(o.cell)) as unknown as State['objs'] };
}

function goals(lv: TLevel, s: State): boolean[] {
  const base = goalsMet(lv, { ...s, objs: s.objs.filter(o => ['goat', 'village', 'light'].includes(o.kind)) });
  const sea = seaMask(lv, s);
  const objs = s.objs as unknown as TObj[];
  const around = (c: number, f: (j: number) => boolean) => [0, 1, 2, 3].some(d => {
    const x = (c % lv.w) + DX[d], y = Math.floor(c / lv.w) + DY[d];
    if (x < 0 || y < 0 || x >= lv.w || y >= lv.h) return false;
    return f(x + y * lv.w);
  });
  const extra: boolean[] = [];
  for (const o of objs) {
    if (o.kind === 'penguin') extra.push(s.plate[o.cell] >= 0 && objs.some(i => i.kind === 'ice' && i.cell === o.cell) && around(o.cell, j => sea[j] === 1 || (s.plate[j] < 0 && sea[j] === 1)));
    if (o.kind === 'oasis') extra.push(s.plate[o.cell] >= 0 && around(o.cell, j => s.plate[j] < 0 && sea[j] === 0));
  }
  // goal count is fixed for the whole level: step() never removes a creature (design audit S6)
  const want = lv.start.objs.length - (lv.start.objs as unknown as TObj[]).filter(o => o.kind === 'ice').length + lv.buoys.length;
  if (base.length + extra.length !== want) throw new Error('a goal disappeared');
  return [...base, ...extra];
}
const done = (lv: TLevel, s: State) => goals(lv, s).every(Boolean);
const key = (s: State) => Array.from(s.plate).join(',') + Array.from(s.elev).join('') + '|' + s.objs.map(o => o.kind[0] + o.cell).join(',') + '|' + (s.off ? Array.from(s.off).join(',') : '');

function solve(lv: TLevel, maxDepth: number) {
  if (done(lv, lv.start)) return { min: 0, ways: 1 };
  let frontier = [{ s: lv.start, ways: 1 }];
  const seen = new Map([[key(lv.start), 0]]);
  for (let depth = 1; depth <= maxDepth; depth++) {
    const next = new Map<string, { s: State; ways: number }>(); let ways = 0;
    for (const f of frontier) for (let p = 0; p < lv.plates; p++) for (let d = 0 as Dir; d < 4; d = (d + 1) as Dir) {
      const t = step(lv, f.s, p, d); if (!t) continue;
      const k = key(t); const prev = seen.get(k); if (prev !== undefined && prev < depth) continue;
      if (done(lv, t)) { ways += f.ways; seen.set(k, depth); continue; }
      const ex = next.get(k); if (ex) ex.ways += f.ways; else { next.set(k, { s: t, ways: f.ways }); seen.set(k, depth); }
    }
    if (ways) return { min: depth, ways };
    frontier = [...next.values()];
  }
  return null;
}

function rng(seed: number) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// Variant levels: take a rails generator level and add one twist with a second RNG stream.
function variant(seed: number, twist: 'pinned' | 'tundra' | 'desert'): TLevel {
  const base = generate(seed) as TLevel; base.pinned = [];
  const r = rng(seed * 7919 + 13);
  const land = [...Array(base.w * base.h).keys()].filter(i => base.start.plate[i] >= 0 && !base.start.objs.some(o => o.cell === i));
  const pick = () => land.splice(Math.floor(r() * land.length), 1)[0];
  const objs = [...base.start.objs] as unknown as TObj[];
  if (twist === 'pinned' || twist === 'tundra') base.pinned = [Math.floor(r() * base.plates)];
  if (twist === 'tundra') {
    for (let k = 0; k < 3 && land.length; k++) objs.push({ kind: 'ice', cell: pick() });
    const ice = objs.filter(o => o.kind === 'ice'); if (ice.length) objs.push({ kind: 'penguin', cell: ice[0].cell });
  }
  if (twist === 'desert' && land.length) { objs.push({ kind: 'oasis', cell: pick() }); }
  base.start = { ...base.start, objs: objs as unknown as State['objs'] };
  return base;
}

function survey(twist: 'none' | 'pinned' | 'tundra' | 'desert', count: number) {
  const hist = new Map<string, number>(); let grade = 0;
  for (let seed = 1; seed <= count; seed++) {
    const lv = twist === 'none' ? Object.assign(generate(seed), { pinned: [] }) as TLevel : variant(seed, twist);
    const s = solve(lv, 6);
    const k = s ? String(s.min) : 'none';
    hist.set(k, (hist.get(k) ?? 0) + 1);
    if (s && s.min >= 3 && s.ways <= 4) grade++;
  }
  console.log(`${twist.padEnd(7)} min moves ${JSON.stringify(Object.fromEntries([...hist.entries()].sort()))}  tight (min >= 3, <= 4 shortest solutions): ${grade}`);
}

function selfCheck() {
  // ice melts when lifted to 2: 1x? strip a | b with ice on b's seam cell at height 1
  const lv: TLevel = { w: 5, h: 3, plates: 2, buoys: [], pinned: [], axis: [1, 1], maxTravel: 2, start: {
    plate: Int8Array.from([-1, -1, -1, -1, -1, -1, 0, 1, 1, -1, -1, -1, -1, -1, -1]),
    elev: Int8Array.from([0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0]),
    objs: [{ kind: 'ice', cell: 7 }] as unknown as State['objs'] } };
  const t = step(lv, lv.start, 0, 1)!;
  if (t.plate[7] !== -1 || t.objs.length !== 0) throw new Error('lifted ice should melt into water');
  if (step({ ...lv, pinned: [0] }, lv.start, 0, 1) !== null) throw new Error('pinned plate must not move');
  if (!step({ ...lv, pinned: [1] }, lv.start, 0, 1)) throw new Error('a pinned plate can still be pushed into');
  // S6: a penguin on that ice blocks the melt-push instead of vanishing with it
  const pg = { ...lv, start: { ...lv.start, objs: [{ kind: 'ice', cell: 7 }, { kind: 'penguin', cell: 7 }] as unknown as State['objs'] } };
  if (step(pg, pg.start, 0, 1) !== null) throw new Error('melting ice under a creature must be blocked');
  if (!step(pg, pg.start, 1, 1)) throw new Error('penguin and its ice still ride their plate together');
  // Codex chain 3: a creature may be pushed onto ice that stays below height 2 (ice is terrain, not a creature)
  const flat = { ...lv, start: { ...lv.start, elev: new Int8Array(15), objs: [{ kind: 'goat', cell: 6 }, { kind: 'ice', cell: 7 }] as unknown as State['objs'] } };
  const onIce = step(flat, flat.start, 0, 1);
  if (!onIce || onIce.elev[7] !== 1 || !onIce.objs.some(o => o.kind === 'goat' && o.cell === 7)) throw new Error('a goat pushed onto low ice must be legal');
  console.log('self-check ok');
}

if (typeof process !== 'undefined' && process.argv?.[1]?.endsWith('twists.ts')) {
  process.env.AXIS = '2'; process.env.PLACE = '1';
  selfCheck();
  const n = Number(process.argv[2] ?? 150);
  console.log(`${n} rails levels (seam placement) per twist, depth 6`);
  for (const t of ['none', 'pinned', 'tundra', 'desert'] as const) survey(t, n);
}
