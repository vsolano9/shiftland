// Changeover rules spike: is a blackout set change a puzzle with depth? Throwaway (not game code).
// Run: node spikes/changeover/changeover.ts [count]
//
// Stage: G grooves (columns) x R rows; row 0 is downstage (nearest the audience), row R-1 is the upstage
// cross-track. Wings: one offstage cell at each end of the cross-track (hidden). Fly lines: hook cells; each
// hook has one loft slot above it (hidden).
// One move = one of:
//   slide a flat any distance along its groove (front/back) through empty cells,
//   slide a flat along the cross-track (only in row R-1), possibly into an empty wing,
//   fly a flat out from a hook cell into that hook's empty loft slot, or fly it back in to the empty hook cell.
// Goal: every target flat sits on its target cell, and every other flat is hidden (wing or loft).

const WING_L = -1, WING_R = -2, LOFT = -10; // loft slot for hook k is LOFT - k

export interface Stage { g: number; r: number; hooks: number[]; flats: number; target: Map<number, number> }
type Pos = Int16Array; // position per flat: cell index (x + y*g), WING_L, WING_R or LOFT - k

const hidden = (p: number) => p < 0;

function occupied(pos: Pos, p: number, except = -1) { for (let i = 0; i < pos.length; i++) if (i !== except && pos[i] === p) return true; return false; }

export function moves(st: Stage, pos: Pos): Pos[] {
  const out: Pos[] = [];
  const { g, r } = st;
  const push = (i: number, to: number) => { const n = pos.slice(); n[i] = to; out.push(n); };
  for (let i = 0; i < pos.length; i++) {
    const p = pos[i];
    if (p >= 0) {
      const x = p % g, y = (p / g) | 0;
      for (const dy of [-1, 1]) for (let yy = y + dy; yy >= 0 && yy < r; yy += dy) { const c = x + yy * g; if (occupied(pos, c)) break; push(i, c); }
      if (y === r - 1) for (const dx of [-1, 1]) {
        let xx = x + dx;
        for (; xx >= 0 && xx < g; xx += dx) { const c = xx + y * g; if (occupied(pos, c)) break; push(i, c); }
        if (xx < 0 && !occupied(pos, WING_L)) push(i, WING_L);
        if (xx >= g && !occupied(pos, WING_R)) push(i, WING_R);
      }
      const k = st.hooks.indexOf(p);
      if (k >= 0 && !occupied(pos, LOFT - k)) push(i, LOFT - k);
    } else if (p === WING_L || p === WING_R) {
      // a flat leaving a wing slides any distance along the cross-track, like the way in (symmetric cost)
      const dx = p === WING_L ? 1 : -1;
      for (let xx = p === WING_L ? 0 : g - 1; xx >= 0 && xx < g; xx += dx) { const c = xx + (r - 1) * g; if (occupied(pos, c)) break; push(i, c); }
    } else {
      const k = LOFT - p, c = st.hooks[k];
      if (!occupied(pos, c)) push(i, c);
    }
  }
  return out;
}

export function done(st: Stage, pos: Pos) {
  for (let i = 0; i < pos.length; i++) {
    const t = st.target.get(i);
    if (t !== undefined ? pos[i] !== t : !hidden(pos[i])) return false;
  }
  return true;
}

// Non-target flats are interchangeable for the goal, so the state key sorts their positions (symmetry reduction).
export function solve(st: Stage, start: Pos, maxDepth = 10, stateCap = 300000) {
  if (done(st, start)) return { min: 0, ways: 1 };
  const nT = st.target.size; // target flats are ids 0..nT-1 (see generate)
  const key = (p: Pos) => Array.from(p.subarray(0, nT)).join(',') + '|' + Array.from(p.subarray(nT)).sort((a, b) => a - b).join(',');
  let frontier = [{ p: start, ways: 1 }];
  const seen = new Map([[key(start), 0]]);
  for (let d = 1; d <= maxDepth; d++) {
    const next = new Map<string, { p: Pos; ways: number }>();
    let ways = 0;
    for (const f of frontier) for (const m of moves(st, f.p)) {
      const k = key(m); const prev = seen.get(k);
      if (prev !== undefined && prev < d) continue;
      if (done(st, m)) { ways += f.ways; continue; }
      const ex = next.get(k); if (ex) ex.ways += f.ways; else { next.set(k, { p: m, ways: f.ways }); seen.set(k, d); }
    }
    if (ways) return { min: d, ways };
    if (seen.size > stateCap) return null;
    frontier = [...next.values()];
  }
  return null;
}

function rng(seed: number) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

export function generate(seed: number) {
  const rnd = rng(seed);
  const g = 4 + Math.floor(rnd() * 2), r = 4;
  const nHooks = rnd() < 0.5 ? 1 : 2;
  // flats to hide must fit the hiding places (2 wings + one loft per hook), leaving one spare slot to shuffle with
  const flats = 2 + 1 + Math.floor(rnd() * (2 + nHooks - 1));
  const cells = [...Array(g * r).keys()];
  const take = () => cells.splice(Math.floor(rnd() * cells.length), 1)[0];
  const hooks = Array.from({ length: nHooks }, take); // distinct hook cells
  cells.push(...hooks); // a flat may start on a hook cell (already clipped to it)
  const start = new Int16Array(flats);
  for (let i = 0; i < flats; i++) start[i] = take();
  // target: 2 flats need a cell in the front two rows (the audience sees them); the rest must be hidden
  const front = [...Array(g * 2).keys()];
  const target = new Map<number, number>();
  const want = 2;
  for (let i = 0; i < want; i++) target.set(i, front.splice(Math.floor(rnd() * front.length), 1)[0]);
  return { st: { g, r, hooks, flats, target } as Stage, start };
}

function selfCheck() {
  // Codex review chain 2: wing transfers cost the same both ways. 4 grooves x 2 rows, one flat at cell 5 (x1, cross-track).
  const st: Stage = { g: 4, r: 2, hooks: [], flats: 1, target: new Map() };
  const into = moves(st, Int16Array.from([5])).some(m => m[0] === WING_L);
  const outOf = moves(st, Int16Array.from([WING_L])).some(m => m[0] === 5);
  if (!into || !outOf) throw new Error(`wing move cost asymmetric: into ${into}, out ${outOf}`);
  console.log('self-check ok');
}

function main() {
  selfCheck();
  const count = Number(process.argv[2] ?? 300);
  const hist = new Map<string, number>();
  let grade = 0;
  let example: { seed: number; min: number; ways: number } | null = null;
  for (let seed = 1; seed <= count; seed++) {
    const { st, start } = generate(seed);
    const depth = Number(process.env.DEPTH ?? 9);
    const s = solve(st, start, depth);
    const k = s ? String(s.min) : `none<=${depth} or state cap`;
    hist.set(k, (hist.get(k) ?? 0) + 1);
    if (s && s.min >= 5 && s.ways <= 6) { grade++; if (!example || s.min > example.min) example = { seed, min: s.min, ways: s.ways }; }
  }
  console.log(`changeover: ${count} random stages (4-5 grooves x 4 rows, 3-5 flats with the hidden ones fitting 2 wings + 1-2 lofts, 2 target flats)`);
  console.log('min-move histogram:', Object.fromEntries([...hist.entries()].sort()));
  console.log(`puzzle-grade (min >= 5, <= 6 shortest solutions): ${grade}`);
  if (example) console.log(`hardest puzzle-grade: seed ${example.seed}, min ${example.min}, ${example.ways} shortest solutions`);
}

if (typeof process !== 'undefined' && process.argv?.[1]?.endsWith('changeover.ts')) main();
