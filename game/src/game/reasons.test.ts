import { describe, expect, it } from 'vitest';
import { goalsMet, type Level, type State, type Kind } from '../rules/rules.ts';
import { beamDir, goalReason, hasSplitPlate } from './reasons.ts';

/** A 5x5 grid from rows: '#' land, '.' water; one creature at (x, y). */
function board(rows: string[], kind: Kind, x: number, y: number, up = 1, buoys: number[] = [], ice = true) {
  const w = rows[0].length, h = rows.length, plate = new Int8Array(w * h), elev = new Int8Array(w * h);
  rows.join('').split('').forEach((c, i) => { plate[i] = c === '#' ? 0 : -1; elev[i] = c === '#' ? 1 : 0; });
  const cell = x + y * w; elev[cell] = up;
  const start: State = { plate, elev, objs: [{ kind, cell }], ice: ice ? new Uint8Array(w * h).fill(1) : new Uint8Array(w * h) };
  const lv = { w, h, plates: 1, start, buoys, axis: [1], maxTravel: 2 } as unknown as Level;
  return { lv, s: start };
}
// the middle block with a pond and a dry side; (2,2) has the pond at its west
const POND = ['.....', '.###.', '.#.#.', '.###.', '.....'];
const SOLID = ['.....', '.###.', '.###.', '.###.', '.....'];

describe('beamDir', () => {
  it('shines at the sea, never into a lake it has closer', () => {
    // pond to the south of (2,1), open sea to the north
    const a = board(POND, 'light', 2, 1);
    expect(beamDir(a.lv, a.s, 2 + 1 * 5)).toEqual([0, -1]);
  });
  it('has nowhere to shine when only a lake touches it', () => {
    const a = board(['#####', '#####', '##.##', '#####', '#####'], 'light', 2, 1);
    expect(beamDir(a.lv, a.s, 2 + 1 * 5)).toBeNull(); // land to the north, and the pond to the south doesn't count
    const b = board(['###', '#.#', '###'], 'light', 1, 0);
    expect(beamDir(b.lv, b.s, 1)).toEqual([0, -1]); // a cell on the map's edge looks straight off it
  });
});

describe('hasSplitPlate', () => {
  it('sees a plate in two pieces, and not a whole one or diagonal land as whole', () => {
    expect(hasSplitPlate(board(SOLID, 'goat', 2, 2).lv, board(SOLID, 'goat', 2, 2).s)).toBe(false);
    const split = board(['.....', '##.##', '.....', '.....', '.....'], 'goat', 0, 1);
    expect(hasSplitPlate(split.lv, split.s)).toBe(true);
    const corner = board(['.....', '.#...', '..#..', '.....', '.....'], 'goat', 1, 1);
    expect(hasSplitPlate(corner.lv, corner.s)).toBe(true);
  });
});

describe('goalReason', () => {
  it('goats count their missing steps', () => {
    const a = board(SOLID, 'goat', 2, 2, 0), b = board(SOLID, 'goat', 2, 2, 1), c = board(SOLID, 'goat', 2, 2, 2);
    expect(goalReason(a.lv, a.s, 0)).toBe('two steps short');
    expect(goalReason(b.lv, b.s, 0)).toBe('one step short');
    expect(goalReason(c.lv, c.s, 0)).toBeNull();
  });
  it('a village only minds rock', () => {
    const a = board(SOLID, 'village', 2, 2, 2), b = board(SOLID, 'village', 2, 2, 1);
    expect(goalReason(a.lv, a.s, 0)).toBe('the land rose too high');
    expect(goalReason(b.lv, b.s, 0)).toBeNull();
  });
  it('lake and sea are told apart', () => {
    const light = board(POND, 'light', 2, 1), oasisSea = board(SOLID, 'oasis', 1, 2), oasisLake = board(POND, 'oasis', 1, 2);
    // (2,1) has the sea to no side here only if its north is land: it touches the pond below and the sea above, so it is fine
    expect(goalReason(light.lv, light.s, 0)).toBeNull();
    expect(goalReason(oasisSea.lv, oasisSea.s, 0)).toBe('that water reaches the sea');
    expect(goalReason(oasisLake.lv, oasisLake.s, 0)).toBeNull();
    const walled = ['#####', '#####', '##.##', '#####', '#####'], inner = board(walled, 'light', 2, 1);
    expect(goalReason(inner.lv, inner.s, 0)).toBe('that water is a lake');
  });
  it('corners do not count', () => {
    const rows = ['#####', '#####', '##.##', '#####', '#####'], o = board(rows, 'oasis', 1, 1), far = board(['#####', '#####', '#####', '#####', '####.'], 'light', 1, 1);
    expect(goalReason(o.lv, o.s, 0)).toBe("corners don't count");
    expect(goalReason(far.lv, far.s, 0)).toBe('no sea beside it');
  });
  it('penguins: melted ice first', () => {
    const a = board(SOLID, 'penguin', 2, 2, 1, [], false), b = board(SOLID, 'penguin', 2, 2);
    expect(goalReason(a.lv, a.s, 0)).toBe('its ice melted');
    expect(goalReason(b.lv, b.s, 0)).toBe('no sea beside the ice');
  });
  it('buoys follow the objects in goal order', () => {
    const on = board(SOLID, 'goat', 1, 1, 2, [12]), pond = board(['#####', '#####', '##.##', '#####', '#####'], 'goat', 1, 1, 2, [12]), sea = board(POND, 'goat', 1, 1, 2, [0]);
    expect(goalReason(on.lv, on.s, 1)).toBe('land on top of it');
    expect(goalReason(pond.lv, pond.s, 1)).toBe('that water is a lake');
    expect(goalReason(sea.lv, sea.s, 1)).toBeNull();
  });
  it('agrees with goalsMet: a reason exactly when the goal is unmet', () => {
    for (const k of ['goat', 'village', 'light', 'oasis', 'penguin'] as Kind[]) for (const rows of [POND, SOLID]) for (let y = 1; y < 4; y++) for (let x = 1; x < 4; x++) {
      if (rows[y][x] !== '#') continue;
      for (const up of [0, 1, 2]) {
        const { lv, s } = board(rows, k, x, y, up);
        expect(goalReason(lv, s, 0) === null, `${k} ${x},${y} up ${up} ${rows.join('/')}`).toBe(goalsMet(lv, s)[0]);
      }
    }
  });
});
