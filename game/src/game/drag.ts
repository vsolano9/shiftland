// Pointer/touch drag along a plate's rail → moves (docs/PLAN.md Nov 6, design-plates.md Controls S1: the rail has
// stops and a drag moves one stop at a time). Pure: the input layer projects the pointer onto the grid and passes the
// drag in cells since the last committed stop; this returns the move to commit, if any.
import type { Dir } from '../rules/rules.ts';

/** Fraction of a cell the pointer must travel along the rail before the plate snaps to the next stop. */
export const SNAP = 0.5;

/**
 * axis 0 = the plate slides N/S, 1 = E/W. dx/dy: drag in cells (screen-to-grid projected), +x east, +y south.
 * Movement across the rail is ignored, so a sloppy diagonal drag still works on touch. Returns the direction of one
 * stop to move, or null while under the snap threshold.
 */
export function dragStep(axis: number, dx: number, dy: number): Dir | null {
  const along = axis === 1 ? dx : dy;
  if (Math.abs(along) < SNAP) return null;
  if (axis === 1) return along > 0 ? 1 : 3;
  return along > 0 ? 2 : 0;
}

/** The part of the drag left over after committing one stop toward d (so a long drag continues stop by stop). */
export function consumeStep(d: Dir, dx: number, dy: number): [number, number] {
  return d === 1 ? [dx - 1, dy] : d === 3 ? [dx + 1, dy] : d === 2 ? [dx, dy - 1] : [dx, dy + 1];
}
