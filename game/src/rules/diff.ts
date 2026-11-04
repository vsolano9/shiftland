// What one move changes, for the move preview and the animations (docs/PLAN.md, Tech: State -> diff(prev, next)).
// The preview draws only this (design audit S1), so every visible change must be in it: Codex chain 4 found an earlier
// version that skipped land moving onto water and creatures moving to a new cell.
import { goalsMet, type Level, type State } from './rules.ts';

export interface MoveDiff {
  /** uplift: cells the moving plate takes from another plate, with their new height. A plate's own higher cells
   *  sliding along are not uplift (they arrive with the plate) */
  rise: [number, number][];
  /** carried terrain: cells that stay on the same plate but change height because the plate slid (a peak carried
   *  along, Codex chain 4 round 2): [cell, new height]; heights can go up or down */
  carry: [number, number][];
  /** land cells that become water */
  flood: number[];
  /** cells that become land of another plate, or land where there was water (where the moving plate arrives) */
  arrive: number[];
  /** creatures that change cell: [object index, from, to] */
  moved: [number, number, number][];
  /** goals that flip: [goal index (objects then buoys), now met] */
  flips: [number, boolean][];
  /** cells where ice melts: lifted to height 2+, so the cell turns to water (these are in `flood` too) */
  melt: number[];
}

export function previewDiff(lv: Level, a: State, b: State): MoveDiff {
  const d: MoveDiff = { rise: [], carry: [], flood: [], arrive: [], moved: [], flips: [], melt: [] };
  for (let i = 0; i < lv.w * lv.h; i++) {
    const wasLand = a.plate[i] >= 0, isLand = b.plate[i] >= 0;
    if (wasLand && !isLand) d.flood.push(i);
    if (isLand && b.plate[i] !== a.plate[i]) d.arrive.push(i);
    if (wasLand && isLand && b.plate[i] !== a.plate[i] && b.elev[i] > a.elev[i]) d.rise.push([i, b.elev[i]]);
    if (wasLand && isLand && b.plate[i] === a.plate[i] && b.elev[i] !== a.elev[i]) d.carry.push([i, b.elev[i]]);
  }
  // A melted cell is one the mover should occupy after the step but which ended up as water: nothing else turns a
  // plate's arrival cell to water. Ice below height 2 melts only where a plate takes a cell, so these are all in flood.
  if (a.ice && b.off) for (let p = 0; p < lv.plates; p++) {
    const moved = b.off[p] - (a.off ? a.off[p] : 0);
    if (moved === 0) continue;
    const step = lv.axis[p] === 1 ? moved : moved * lv.w;
    for (let i = 0; i < lv.w * lv.h; i++) if (a.plate[i] === p && b.plate[i + step] < 0) d.melt.push(i + step);
    d.melt.sort((x, y) => x - y);
  }
  b.objs.forEach((o, k) => { if (o.cell !== a.objs[k].cell) d.moved.push([k, a.objs[k].cell, o.cell]); });
  const g0 = goalsMet(lv, a), g1 = goalsMet(lv, b);
  g1.forEach((m, k) => { if (m !== g0[k]) d.flips.push([k, m]); });
  return d;
}
