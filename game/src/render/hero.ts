// The title screen's island (concepts/shiftland-title-select.png): never played. It shows the whole game in one motion:
// plate c pushes in, the seam rises under a sulking goat, and the buoy it had beached floats free. That pushed state is the
// picture the title rests on, and every few seconds the plate slides back and does it again.
import type { Level, State } from '../rules/rules.ts';
import { shift } from '../rules/rules.ts';
import { parse } from '../levels/tutorial.ts';

// One token per cell: '~' sea, '~*' sea with a buoy, otherwise <plate letter><height>[G goat, V village, L lighthouse, * buoy].
// +x runs down-right on screen and +z down-left, so the top-left of this map is the back of the island.
const MAP = `
  ~   ~   b0  b0  b0  c0  ~   ~
  ~   b0  b0  b0  b1G c0  c0  ~
  a0  a0  b0  b0  b0  c0  c0  ~
  a0  a0V b0  b0  c0  c0  c0  ~
  a0  a0  a0  b0  c0  c0  ~   ~
  ~   a0  a0  a0  b0  c0L c0* ~
  ~   ~   a0  ~   ~   ~   ~   ~
`;

export const heroLevel = (): Level => parse({ name: 'Shiftland', teaches: '', axis: '---', map: MAP, expectPar: 0, maxTravel: 1 });
/** The state the title rests on: plate c pushed west by one. */
export const heroPushed = (lv: Level): State => shift(lv, lv.start, 2, 3)!;
