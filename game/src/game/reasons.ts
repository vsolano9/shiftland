// Why a creature is unhappy, in the board's own words. A chip that flips with no reason teaches nothing
// (second playtest P2: lake against sea and corners against sides stumped a player for 12 minutes).
import { DX, DY, seaMask, type Level, type State } from '../rules/rules.ts';

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
    if (s.plate[b] >= 0) return 'land on top of it';
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
