import { describe, expect, it } from 'vitest';
import { goalsMet, type Level, type State, type Kind } from '../rules/rules.ts';
import { beamDir, beamRun, goalReason, hasSplitPlate, leakOf, meltReason, moveWhy, stackReason } from './reasons.ts';
import { refusal } from '../rules/rules.ts';

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

describe('beamRun', () => {
  it('says how much water lies that way, and the map edge counts as far', () => {
    const channel = board(['#####', '#####', '#####', '....#', '#####'], 'light', 1, 2);
    expect(beamRun(channel.lv, channel.s, 1 + 2 * 5)).toEqual({ dir: [0, 1], run: 1 }); // one row of sea, then land
    const open = board(SOLID, 'light', 2, 1);
    expect(beamRun(open.lv, open.s, 2 + 1 * 5).run).toBeGreaterThanOrEqual(3); // the top row, then off the map
  });
});

describe('moveWhy and stackReason', () => {
  /** Two plates side by side on a 6x3 grid: 0 on the left, 1 on the right, both sliding east and west. */
  function pair(objs: { kind: Kind; cell: number }[], gap = false) {
    const w = 6, h = 3, plate = new Int8Array(w * h).fill(-1), elev = new Int8Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 1; x < 5; x++) { if (gap && x === 2) continue; plate[x + y * w] = x < 3 ? 0 : 1; elev[x + y * w] = 1; }
    const start: State = { plate, elev, objs, off: new Int8Array(2) };
    return { lv: { w, h, plates: 2, start, buoys: [], axis: [1, 1], maxTravel: 2 } as unknown as Level, s: start };
  }
  it('names a goal it meets first', () => {
    const { lv, s } = pair([{ kind: 'goat', cell: 3 + 6 }]);
    expect(moveWhy(lv, s, 0, 1)).toBe('It lifts the goat onto a peak.'); // plate 0 bites under the goat's plate edge
  });
  it('explains a bite that meets nothing yet', () => {
    const { lv, s } = pair([{ kind: 'village', cell: 1 + 6 }, { kind: 'goat', cell: 4 + 6 }]);
    expect(moveWhy(lv, s, 0, 1)).toBe("It bites its neighbour: that land is this plate's now.");
  });
  it('names what a refused move runs into', () => {
    const { lv, s } = pair([{ kind: 'goat', cell: 2 + 6 }, { kind: 'oasis', cell: 3 + 6 }]);
    expect(stackReason(lv, s, 0, 1)).toBe('The oasis is in the way of the goat');
    const twins = pair([{ kind: 'goat', cell: 2 + 6 }, { kind: 'goat', cell: 3 + 6 }]);
    expect(stackReason(twins.lv, twins.s, 0, 1)).toBe('One goat is in the way of the other');
    const free = pair([{ kind: 'goat', cell: 1 }]);
    expect(stackReason(free.lv, free.s, 0, 1)).toBe('Something already stands there');
  });
  it('names who stands on the ice a move would melt', () => {
    const { lv, s } = pair([{ kind: 'penguin', cell: 3 + 6 }]);
    const ice = new Uint8Array(s.plate.length);
    ice[3 + 6] = 1;
    const icy: State = { ...s, ice };
    expect(refusal(lv, icy, 0, 1)).toBe('melt');
    expect(meltReason(lv, icy, 0, 1)).toBe('That would melt the ice under the penguin');
  });
  it('names the blocker the way the plate was pushed, not the other way', () => {
    const { lv, s } = pair([{ kind: 'goat', cell: 2 + 6 }, { kind: 'oasis', cell: 3 + 6 }, { kind: 'penguin', cell: 1 + 12 }, { kind: 'village', cell: 0 + 12 }]);
    expect(stackReason(lv, s, 0, 1)).toBe('The oasis is in the way of the goat');
    expect(stackReason(lv, s, 0, 3)).toBe('The village is in the way of the penguin');
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

describe('leakOf', () => {
  it('walks the way out for an oasis on water that reaches the sea', () => {
    const { lv, s } = board(['#####', '#.###', '#.###', '#...#', '###.#'], 'oasis', 2, 1);
    const l = leakOf(lv, s, 0)!;
    expect(l.flow).toBe(true);
    expect(l.pts[0]).toEqual([1, 1]); // starts beside the oasis
    expect(l.pts[l.pts.length - 1]).toEqual([3, 5]); // and runs off the map
    for (let i = 1; i < l.pts.length; i++) expect(Math.abs(l.pts[i][0] - l.pts[i - 1][0]) + Math.abs(l.pts[i][1] - l.pts[i - 1][1])).toBe(1);
  });
  it('marks the whole lake for a lighthouse or a buoy that wants the sea', () => {
    const light = board(['#####', '#####', '#..##', '#####', '#####'], 'light', 1, 1);
    expect(leakOf(light.lv, light.s, 0)).toEqual({ flow: false, pts: [[1, 2], [2, 2]] });
    const buoy = board(['#####', '#####', '#..##', '#####', '#####'], 'goat', 0, 0, 2, [11]);
    expect(leakOf(buoy.lv, buoy.s, 1)!.pts).toHaveLength(2);
  });
  it('says nothing when the complaint is not about a body of water, or the goal is met', () => {
    const goat = board(POND, 'goat', 1, 1, 1), oasis = board(POND, 'oasis', 1, 2);
    expect(leakOf(goat.lv, goat.s, 0)).toBeNull();
    expect(leakOf(oasis.lv, oasis.s, 0)).toBeNull();
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
    expect(goalReason(on.lv, on.s, 1)).toBe('stuck on land');
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
