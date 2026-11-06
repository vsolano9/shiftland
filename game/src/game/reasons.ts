// Why a creature is unhappy, in the board's own words. A chip that flips with no reason teaches nothing
// (second playtest P2: lake against sea and corners against sides stumped a player for 12 minutes).
import { DX, DY, goalsMet, seaMask, shift, type Dir, type Kind, type Level, type State } from '../rules/rules.ts';

const CORNERS = [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const;

/**
 * Where a lighthouse on `cell` shines: over its widest stretch of open sea, never over land or into a lake, since the
 * lamp is what tells a player that sea is what it wants. Null when no side has sea. The map's edge counts as open water.
 */
export function beamDir(lv: Level, s: State, cell: number): [number, number] | null { return beamRun(lv, s, cell).dir; }

/** The same, with how much water lies that way (1 to 4), so a beam down a narrow channel stops short of the land across it. */
export function beamRun(lv: Level, s: State, cell: number) {
  const { w, h } = lv, sea = seaMask(lv, s), x = cell % w, y = Math.floor(cell / w);
  let best = 0, dir: [number, number] | null = null;
  for (const [dx, dy] of [[1, 0], [0, 1], [-1, 0], [0, -1]] as const) {
    let n = 0;
    for (let k = 1; k <= 4; k++) {
      const a = x + dx * k, b = y + dy * k;
      if (a < 0 || b < 0 || a >= w || b >= h) { n += 5 - k; break; }
      if (!sea[a + b * w]) break;
      n++;
    }
    if (n > best) { best = n; dir = [dx, dy]; }
  }
  return { dir, run: best };
}

const NAME: Record<Kind, string> = { goat: 'goat', village: 'village', light: 'lighthouse', oasis: 'oasis', penguin: 'penguin' };

// says what the move does and not that it helps: "it gives the oasis what it needs" taught nothing (playtest 4)
const MEETS: Record<Kind, string> = { goat: 'It lifts the goat onto a peak.', village: 'It settles the village on low ground.', light: 'It brings the sea to the lighthouse.', oasis: 'It gives the oasis a lake beside it.', penguin: "It brings the sea to the penguins' ice." };

/** Who a move refused as 'melt' would drop in the water. */
export function meltReason(lv: Level, s: State, p: number, d: Dir): string {
  const next = shift(lv, { ...s, ice: undefined }, p, d), step = DX[d] + DY[d] * lv.w;
  // ice a cell holds after the move: what slid onto it, plus its own unless its plate slid away
  const icy = (j: number) => (s.plate[j - step] === p && s.ice?.[j - step]) || (s.plate[j] !== p && s.ice?.[j]);
  const hit = next?.objs.find(o => next.elev[o.cell] >= 2 && icy(o.cell));
  return `That would melt the ice under the ${hit ? NAME[hit.kind] : 'creatures'}`;
}

/**
 * What a move refused as 'stack' runs into, in words that fit the thing: "Two creatures can't share a cell" read oddly for a
 * palm or a lighthouse (playtest 3 P7). Looks the way the plate was pushed; `shift` allows one object per cell, so the hit
 * is a stationary object just ahead of one that rides the plate.
 */
export function stackReason(lv: Level, s: State, p: number, d: Dir): string {
  const step = DX[d] + DY[d] * lv.w;
  for (const a of s.objs) if (s.plate[a.cell] === p) {
    const hit = s.objs.find(b => b.cell === a.cell + step && s.plate[b.cell] !== p);
    if (hit) return hit.kind === a.kind ? `One ${NAME[a.kind]} is in the way of the other` : `The ${NAME[hit.kind]} is in the way of the ${NAME[a.kind]}`;
  }
  return 'Something already stands there';
}

/**
 * Why the hinted move is worth making, so the last hint teaches instead of only steering (playtest 3 P1). The order is what
 * a player would say first: a goal it meets, then a bite (the one trick the board doesn't show), then what it opens up.
 */
export function moveWhy(lv: Level, s: State, p: number, d: Dir): string {
  const next = shift(lv, s, p, d);
  if (!next) return '';
  const was = goalsMet(lv, s), now = goalsMet(lv, next), fresh = now.findIndex((m, i) => m && !was[i]);
  if (fresh >= 0) return fresh < s.objs.length ? MEETS[s.objs[fresh].kind] : 'It frees the buoy.';
  const step = DX[d] + DY[d] * lv.w;
  for (let i = 0; i < s.plate.length; i++) if (s.plate[i] === p && s.plate[i + step] >= 0 && s.plate[i + step] !== p)
    return "It bites its neighbour: that land is this plate's now."; // "...when it slides back" sent a player back at the wrong moment (playtest 5 P5-8)
  let wet = 0;
  for (let i = 0; i < s.plate.length; i++) wet += (next.plate[i] < 0 ? 1 : 0) - (s.plate[i] < 0 ? 1 : 0);
  return wet > 0 ? 'It opens water you need soon.' : wet < 0 ? 'It closes water that is in the way.' : 'No one is happier yet: this slide sets up the next move.'; // "Nothing shows yet" read like a bug (playtest 17)
}

/** True when some plate's cells no longer touch edge to edge (a plate that slid across a gap, or lost its middle). */
export function hasSplitPlate(lv: Level, s: State): boolean {
  const { w, h } = lv, { plate } = s;
  for (let p = 0; p < lv.plates; p++) {
    const cells = [...plate.keys()].filter(i => plate[i] === p);
    if (cells.length < 2) continue;
    const seen = new Set([cells[0]]), q = [cells[0]];
    while (q.length) {
      const i = q.pop()!, x = i % w, y = Math.floor(i / w);
      for (const j of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, y > 0 ? i - w : -1, y < h - 1 ? i + w : -1])
        if (j >= 0 && plate[j] === p && !seen.has(j)) { seen.add(j); q.push(j); }
    }
    if (seen.size < cells.length) return true;
  }
  return false;
}

/**
 * The water a goal's complaint is about, for the board to point at: "that water reaches the sea" said neither which water
 * nor where (playtest 5 P5-2). `flow`: the way out, from beside the creature to one step off the map, in grid cells.
 * Otherwise the lake's own cells. Null when the complaint isn't about a body of water.
 */
export function leakOf(lv: Level, s: State, goal: number): { flow: boolean; pts: [number, number][] } | null {
  const why = goalReason(lv, s, goal);
  if (why !== 'that water reaches the sea' && why !== 'that water is a lake') return null;
  const { w, h } = lv, sea = seaMask(lv, s), buoy = goal >= s.objs.length, cell = buoy ? lv.buoys[goal - s.objs.length] : s.objs[goal].cell;
  const around = (i: number) => [0, 1, 2, 3].map(d => [i % w + DX[d], Math.floor(i / w) + DY[d]]).filter(([x, y]) => x >= 0 && y >= 0 && x < w && y < h).map(([x, y]) => x + y * w);
  const flow = why === 'that water reaches the sea', ok = (i: number) => s.plate[i] < 0 && !!sea[i] === flow;
  const from = buoy ? [cell] : around(cell).filter(ok), back = new Map<number, number>(from.map(i => [i, -1]));
  const edge = (i: number) => i % w === 0 || i % w === w - 1 || i < w || i >= w * (h - 1);
  for (const q = [...from]; q.length;) {
    const i = q.shift()!;
    if (flow && edge(i)) {
      const pts: [number, number][] = [];
      for (let k = i; k >= 0; k = back.get(k)!) pts.unshift([k % w, Math.floor(k / w)]);
      const [x, y] = pts[pts.length - 1];
      pts.push(x === 0 ? [-1, y] : x === w - 1 ? [w, y] : y === 0 ? [x, -1] : [x, h]);
      return { flow, pts };
    }
    for (const j of around(i)) if (ok(j) && !back.has(j)) { back.set(j, i); q.push(j); }
  }
  return flow || !back.size ? null : { flow, pts: [...back.keys()].map(i => [i % w, Math.floor(i / w)]) };
}

/** What is wrong with one goal (index as in goalsMet: objects, then buoys), or null when it is met. */
export function goalReason(lv: Level, s: State, goal: number): string | null {
  const { w, h } = lv, sea = seaMask(lv, s);
  const off = (x: number, y: number) => x < 0 || y < 0 || x >= w || y >= h;
  const isSea = (x: number, y: number) => off(x, y) || sea[x + y * w] === 1;
  const isLake = (x: number, y: number) => !off(x, y) && s.plate[x + y * w] < 0 && !sea[x + y * w];
  const beside = (cell: number, f: (x: number, y: number) => boolean) => [0, 1, 2, 3].some(d => f(cell % w + DX[d], Math.floor(cell / w) + DY[d]));
  const corner = (cell: number, f: (x: number, y: number) => boolean) => CORNERS.some(([a, b]) => f(cell % w + a, Math.floor(cell / w) + b));
  if (goal >= s.objs.length) {
    const b = lv.buoys[goal - s.objs.length];
    if (s.plate[b] >= 0) return 'stuck on land'; // "land on top of it" read as an instruction (critic T2); "buried under land" did not match the buoy drawn standing on the land (critic T4, Nov 5)
    return sea[b] ? null : 'that water is a lake';
  }
  const { kind, cell } = s.objs[goal], up = s.elev[cell];
  switch (kind) {
    case 'goat': return up >= 2 ? null : up === 1 ? 'one step short' : 'two steps short';
    case 'village': return up <= 1 ? null : 'the land rose too high';
    case 'light':
      if (beside(cell, isSea)) return null;
      if (beside(cell, isLake)) return 'that water is a lake';
      return corner(cell, isSea) ? 'sea only at a corner' : 'no sea beside it'; // "corners don't count" said nothing to a player who hadn't noticed the corner (playtest 14)
    case 'oasis':
      if (beside(cell, isLake)) return null;
      if (beside(cell, isSea)) return 'that water reaches the sea';
      return corner(cell, isLake) ? 'lake only at a corner' : 'no water beside it';
    case 'penguin':
      if (!s.ice?.[cell]) return 'its ice melted';
      if (beside(cell, isSea)) return null;
      if (beside(cell, isLake)) return 'that water is a lake';
      return corner(cell, isSea) ? 'sea only at a corner' : 'no sea beside the ice';
  }
}
