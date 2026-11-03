import { describe, expect, it } from 'vitest';
import { canFinish, fromJson, goalsMet, seaMask, shift, solve, solved, type Level, type LevelJson, type Obj } from './rules';
import levels from '../../../spikes/plates/levels.json';

// 1-row strip helper: plates/elevations per cell, '-1' = water. All plates slide E/W.
function strip(plate: number[], elev: number[], objs: Obj[] = [], buoys: number[] = [], w = plate.length / 3): Level {
  const plates = Math.max(...plate) + 1;
  return { w, h: plate.length / w, plates, axis: Array(plates).fill(1), maxTravel: 2, buoys,
    start: { plate: Int8Array.from(plate), elev: Int8Array.from(elev), objs } };
}
const W = -1;
// 5x3 island: ocean ring, one row of land a a b in the middle
const row = (mid: number[]) => [W, W, W, W, W, W, ...mid, W, W, W, W, W, W];

describe('shift', () => {
  it('pushing into another plate takes the cell and raises it to max + 1', () => {
    const lv = strip(row([0, 0, 1]), row([0, 0, 1]));
    const t = shift(lv, lv.start, 0, 1)!;
    expect(Array.from(t.plate.slice(5, 10))).toEqual([W, W, 0, 0, W]);
    expect(t.elev[8]).toBe(2);
  });

  it('caps height at 3', () => {
    const lv = strip(row([0, 0, 1]), row([0, 3, 3]));
    expect(shift(lv, lv.start, 0, 1)!.elev[8]).toBe(3);
  });

  it('leaves water behind (a rift) and keeps moved land height', () => {
    const lv = strip(row([0, 1, 1]), row([1, 0, 0]));
    const t = shift(lv, lv.start, 0, 3)!;
    expect(t.plate[6]).toBe(W);
    expect(t.plate[5]).toBe(0);
    expect(t.elev[5]).toBe(1);
  });

  it('respects rails and travel limits', () => {
    const lv = strip(row([0, 0, 1]), row([0, 0, 0]));
    expect(shift(lv, lv.start, 0, 0)).toBeNull(); // E/W plate cannot go north
    const one = shift(lv, lv.start, 0, 3)!; // west 1
    expect(shift(lv, one, 0, 3)).toBeNull(); // west 2 would leave the grid
    const lv2 = { ...lv, maxTravel: 1 };
    expect(shift(lv2, shift(lv2, lv2.start, 1, 1)!, 1, 1)).toBeNull(); // past maxTravel
  });

  it('objects ride their cell; a creature on a taken cell stays there, lifted (crushed village)', () => {
    const lv = strip(row([0, 0, 1]), row([0, 0, 1]), [{ kind: 'goat', cell: 6 }, { kind: 'village', cell: 8 }]);
    const t = shift(lv, lv.start, 0, 1)!;
    expect(t.objs).toEqual([{ kind: 'goat', cell: 7 }, { kind: 'village', cell: 8 }]);
    expect(t.plate[8]).toBe(0); // the village now rides the mover
    expect(t.elev[8]).toBe(2);
  });

  it('blocks a push that would stack two creatures on one cell (design audit S4)', () => {
    const lv = strip(row([0, 1, 1]), row([0, 0, 0]), [{ kind: 'goat', cell: 6 }, { kind: 'goat', cell: 7 }]);
    expect(shift(lv, lv.start, 0, 1)).toBeNull();
  });

  it('a village is crushed, never drowned: it always rides land', () => {
    const lv = strip(row([0, 0, 1]), row([0, 0, 1]), [{ kind: 'village', cell: 8 }]);
    const t = shift(lv, lv.start, 0, 1)!;
    expect(t.plate[t.objs[0].cell]).toBeGreaterThanOrEqual(0);
    expect(goalsMet(lv, t)).toEqual([false]);
  });
});

describe('water and goals', () => {
  it('water joined to the edge is sea, enclosed water is a lake', () => {
    // 5x5: ring of land around one water cell, inside the ocean? No ring: use a 5x5 land block with a hole
    const p = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, W, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    const lv: Level = { w: 5, h: 5, plates: 1, axis: [1], maxTravel: 2, buoys: [12], start: { plate: Int8Array.from(p), elev: new Int8Array(25), objs: [] } };
    expect(seaMask(lv, lv.start)[12]).toBe(0);
    expect(goalsMet(lv, lv.start)).toEqual([false]);
  });

  it('a lighthouse on the map edge sees the ocean', () => {
    const lv = strip([0, 0, 0], [0, 0, 0], [{ kind: 'light', cell: 0 }], [], 3);
    expect(goalsMet(lv, lv.start)).toEqual([true]);
  });

  it('goat wants height 2+, village height 0-1', () => {
    const lv = strip(row([0, 0, 1]), row([2, 1, 0]), [{ kind: 'goat', cell: 6 }, { kind: 'village', cell: 7 }]);
    expect(goalsMet(lv, lv.start)).toEqual([true, true]);
    expect(solved(lv, lv.start)).toBe(true);
  });
});

describe('canFinish (the "no way back" warning)', () => {
  const all = (levels as LevelJson[]).map(fromJson);
  const play = (name: string, moves: string) => {
    const lv = all.find(l => l.name === name)!;
    let s = lv.start;
    for (const m of moves.split(' ')) { s = shift(lv, s, Number(m[1]), 'NESW'.indexOf(m[2]) as 0 | 1 | 2 | 3)!; expect(s).not.toBeNull(); }
    return canFinish(lv, s);
  };
  it('answers fast in breadth-first order (Codex chain 4: depth-first wandered to the 200k cap for 2+ s)', () => {
    let t = performance.now();
    expect(play('Puzzle 8', 'P0E')).toBe(true); // depth-first: cap hit after ~2 s, answer unknown
    expect(performance.now() - t).toBeLessThan(200);
    t = performance.now();
    expect(play('Puzzle 2', 'P0W')).toBe(false); // the slowest exported first move: a dead end proven after ~32k states
    expect(performance.now() - t).toBeLessThan(5000);
  });
  it('proves a real dead end (Mind the Village after the crushing push)', () => {
    expect(play('Mind the Village', 'P0E')).toBe(false);
  });
  it('does not call a far-but-solvable state a dead end (Codex chain 3 regression)', () => {
    expect(play('Far One First', 'P0S P1W P2E P2W P1W P2E P1E P1W')).toBe(true);
  });
});

describe('levels.json (parity with the spike)', () => {
  const all = (levels as LevelJson[]).map(fromJson);
  it('has the tutorial first', () => {
    expect(all[0].name).toBe('First Peak');
    expect(all.length).toBeGreaterThanOrEqual(14);
  });
  for (const lv of all) {
    it(`${lv.name}: solver par equals the exported par`, () => {
      expect(solve(lv, 6)?.min).toBe(lv.par);
    });
  }
});
