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

/**
 * What a move refused as 'stack' runs into, in words that fit the thing: "Two creatures can't share a cell" read oddly for a
 * palm or a lighthouse (playtest 3 P7). Looks along the plate's rail both ways; `shift` allows one object per cell, so the hit
 * is a stationary object just ahead of one that rides the plate.
 */
export function stackReason(lv: Level, s: State, p: number): string {
  for (const d of (lv.axis[p] === 1 ? [1, 3] : [0, 2]) as Dir[]) {
    const step = DX[d] + DY[d] * lv.w;
    for (const a of s.objs) if (s.plate[a.cell] === p) {
      const hit = s.objs.find(b => b.cell === a.cell + step && s.plate[b.cell] !== p);
      if (hit) return `The ${NAME[hit.kind]} is in the way of the ${NAME[a.kind]}`;
    }
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
  if (fresh >= 0) return fresh < s.objs.length ? `It gives the ${NAME[s.objs[fresh].kind]} what it needs.` : 'It frees the buoy.';
  const step = DX[d] + DY[d] * lv.w;
  for (let i = 0; i < s.plate.length; i++) if (s.plate[i] === p && s.plate[i + step] >= 0 && s.plate[i + step] !== p)
    return 'It bites its neighbour and keeps that land when it slides back.';
  let wet = 0;
  for (let i = 0; i < s.plate.length; i++) wet += (next.plate[i] < 0 ? 1 : 0) - (s.plate[i] < 0 ? 1 : 0);
  return wet > 0 ? 'It opens water you need soon.' : wet < 0 ? 'It closes water that is in the way.' : 'It sets up the next move.';
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
    if (s.plate[b] >= 0) return 'buried under land'; // "land on top of it" read as an instruction (critic T2, Sandbar)
    return sea[b] ? null : 'that water is a lake';
  }
  const { kind, cell } = s.objs[goal], up = s.elev[cell];
  switch (kind) {
    case 'goat': return up >= 2 ? null : up === 1 ? 'one step short' : 'two steps short';
    case 'village': return up <= 1 ? null : 'the land rose too high';
    case 'light':
      if (beside(cell, isSea)) return null;
      if (beside(cell, isLake)) return 'that water is a lake';
      return corner(cell, isSea) ? "corners don't count" : 'no sea beside it';
    case 'oasis':
      if (beside(cell, isLake)) return null;
      if (beside(cell, isSea)) return 'that water reaches the sea';
      return corner(cell, isLake) ? "corners don't count" : 'no water beside it';
    case 'penguin':
      if (!s.ice?.[cell]) return 'its ice melted';
      if (beside(cell, isSea)) return null;
      if (beside(cell, isLake)) return 'that water is a lake';
      return corner(cell, isSea) ? "corners don't count" : 'no sea beside the ice';
  }
}
