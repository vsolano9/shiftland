// The title screen's island (concepts/shiftland-title-select.png): never played, arranged by hand to show the game at
// its happiest. A goat proud on a snowy peak, a lighthouse lit by the sea, a village, a buoy with fish, the three patterns.
import type { Level } from '../rules/rules.ts';
import { parse } from '../levels/tutorial.ts';

// One token per cell: '~' sea, '~*' sea with a buoy, otherwise <plate letter><height>[G goat, V village, L lighthouse].
// +x runs down-right on screen and +z down-left, so the top-left of this map is the back of the island.
const MAP = `
  ~   ~   b0  b1  b2  c0  ~
  ~   b0  b0  b2  b3G c0  c0
  a0  a0  b0  b0  b1  c0  c0
  a0  a0V b0  b0  c0  c0  c0
  a0  a0  a0  b0  c0  c0  ~
  ~   a0  a0  a0  b0  c0L ~*
  ~   ~   a0  a0  ~   ~   ~
`;

export const heroLevel = (): Level => parse({ name: 'Shiftland', teaches: '', axis: '---', map: MAP, expectPar: 0 });
