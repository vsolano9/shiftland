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

export function heroLevel(): Level {
  const rows = MAP.trim().split('\n').map(r => r.trim().split(/\s+/));
  const h = rows.length, w = rows[0].length, plate = new Int8Array(w * h).fill(-1), elev = new Int8Array(w * h);
  const objs: Obj[] = [], buoys: number[] = [];
  const KIND: Record<string, Obj['kind']> = { G: 'goat', V: 'village', L: 'light' };
  rows.forEach((row, y) => row.forEach((t, x) => {
    const c = x + y * w;
    if (t[0] === '~') { if (t[1] === '*') buoys.push(c); return; }
    plate[c] = t.charCodeAt(0) - 97; elev[c] = +t[1];
    if (t[2]) objs.push({ kind: KIND[t[2]], cell: c } as Obj);
  }));
  return { name: 'Shiftland', biome: 'meadow', par: 0, w, h, plates: 3, axis: [1, 1, 1], maxTravel: 2, buoys, start: { plate, elev, objs } };
}
