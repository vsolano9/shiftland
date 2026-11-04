// Pointer/touch drag along a plate's rail (design-plates.md Controls: drag along the rail, a preview shows the exact
// result while dragging, release commits, Esc cancels; S1: the rail has stops). Pure: the input layer projects the
// pointer onto the grid and passes the drag in cells since the drag STARTED; this returns how many stops it asks for.
// Cumulative, not consumed per stop: an earlier per-stop version oscillated W/E forever at exactly half a cell
// (Codex chain 6 Major 1).
import type { Dir } from '../rules/rules.ts';

/** Fraction of a cell the pointer must pass (strictly) along the rail before the next stop is asked for. */
export const SNAP = 0.35; // a half-cell asked too much: a short confident flick did nothing (playtest 4 P3)

/**
 * axis 0 = the plate slides N/S, 1 = E/W. dx/dy: drag in cells since the drag started, +x east, +y south.
 * Movement across the rail is ignored, so a sloppy diagonal drag still works on touch.
 * Returns the direction and number of stops, or null. One drag is one stop, as the rail shows: a slightly long drag
 * used to spend two moves and turn a par-1 win into "Moves 2 / Par 1" (playtest 5 P5-11).
 */
export function dragStops(axis: number, dx: number, dy: number): { dir: Dir; n: number } | null {
  const along = axis === 1 ? dx : dy;
  if (Math.abs(along) <= SNAP) return null;
  const dir: Dir = axis === 1 ? (along > 0 ? 1 : 3) : (along > 0 ? 2 : 0);
  return { dir, n: 1 };
}
