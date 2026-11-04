// Why a creature is unhappy, in the board's own words. A chip that flips with no reason teaches nothing
// (second playtest P2: lake against sea and corners against sides stumped a player for 12 minutes).
import { DX, DY, seaMask, type Level, type State } from '../rules/rules.ts';

const CORNERS = [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const;

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
