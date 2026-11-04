import { describe, expect, it } from 'vitest';
import { canFinish, fromJson, goalsMet, railMoves, refusal, seaMask, shift, solve, solved, stateKey, type Level, type LevelJson, type Obj } from './rules';
import { previewDiff } from './diff';
import levels from '../levels/levels.json';

// 1-row strip helper: plates/elevations per cell, '-1' = water. All plates slide E/W.
function strip(plate: number[], elev: number[], objs: Obj[] = [], buoys: number[] = [], w = plate.length / 3): Level {
  const plates = Math.max(...plate) + 1;
  return { w, h: plate.length / w, plates, axis: Array(plates).fill(1), maxTravel: 2, buoys, biome: 'meadow',
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
    const lv: Level = { w: 5, h: 5, plates: 1, axis: [1], maxTravel: 2, buoys: [12], biome: 'meadow', start: { plate: Int8Array.from(p), elev: new Int8Array(25), objs: [] } };
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

describe('oasis (Desert): wants a lake beside it, the opposite of a buoy', () => {
  // 5x5: land ring around one enclosed water cell (12) = a lake; the outer ring is ocean.
  const lakePlate = [W, W, W, W, W, W, 0, 0, 0, W, W, 0, W, 0, W, W, 0, 0, 0, W, W, W, W, W, W];
  const lv = (plate: number[], objs: Obj[]) => strip(plate, plate.map(() => 0), objs, [], 5);
  it('is happy beside a lake, not beside the sea or diagonal to the lake', () => {
    const l = lv(lakePlate, [{ kind: 'oasis', cell: 7 }, { kind: 'oasis', cell: 6 }]);
    expect(seaMask(l, l.start)[12]).toBe(0);
    expect(goalsMet(l, l.start)).toEqual([true, false]);
  });
  it('is unhappy once the lake joins the ocean', () => {
    const open = lakePlate.slice(); open[13] = W; // 12 now touches 13, which touches the ocean at 14
    const l = lv(open, [{ kind: 'oasis', cell: 7 }]);
    expect(goalsMet(l, l.start)).toEqual([false]);
  });
  it('a lighthouse on the same cell wants the sea instead', () => {
    const l = lv(lakePlate, [{ kind: 'light', cell: 7 }, { kind: 'light', cell: 16 }]);
    expect(goalsMet(l, l.start)).toEqual([true, true]); // both touch the outer ocean ring
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
    expect(play('The Summit', 'P0N')).toBe(true); // the longest level, a first move on its solution: a far finish, still found
    expect(performance.now() - t).toBeLessThan(5000);
    t = performance.now();
    expect(play('Mirage', 'P2W')).toBe(false); // the bite comes too soon: a dead end proven by search, not by a lost village
    expect(performance.now() - t).toBeLessThan(5000);
  });
  it('proves a real dead end (Mind the Village after the crushing push)', () => {
    expect(play('Mind the Village', 'P0E')).toBe(false);
  });
  it('a lost village is proven without searching, even where the search would hit its cap', () => {
    const t = performance.now();
    expect(play('Breakwater', 'P1W')).toBe(false); // without the shortcut: 200k states, answer unknown
    expect(performance.now() - t).toBeLessThan(200);
  });
  it('does not call a far-but-solvable state a dead end (Codex chain 3 regression)', () => {
    expect(play('Far One First', 'P0S P1W P2E P2W P1W P2E P1E P1W')).toBe(true);
  });
});

describe('solver speed', () => {
  it('searches the largest shipped level to depth 9 within a few seconds', () => {
    const summit = (levels as LevelJson[]).map(fromJson).find(l => l.name === 'The Summit')!;
    const t = shift(summit, summit.start, 0, 2)!; // P0S: the wrong way, 8 moves to finish through it
    const at = performance.now();
    expect(solve(summit, 9, t)?.min).toBe(7);
    expect(performance.now() - at).toBeLessThan(5000);
  });
});

describe('refusal: the reason shift says no, for the UI', () => {
  const all = (levels as LevelJson[]).map(fromJson);
  const named = (n: string) => all.find(l => l.name === n)!;
  const DIRS = [0, 1, 2, 3] as const;
  /** Every state the player can reach in one move, plus the start: enough to meet each kind of refusal. */
  const reach = (lv: Level) => [lv.start, ...railMoves(lv).map(([p, d]) => shift(lv, lv.start, p, d)).filter((t): t is NonNullable<typeof t> => !!t)];

  it('agrees with shift on every plate and direction, from the start and every first move of every level', () => {
    let refused = 0, legal = 0;
    for (const lv of all) for (const s of reach(lv)) for (let p = 0; p < lv.plates; p++) for (const d of DIRS) {
      const r = refusal(lv, s, p, d);
      expect(r === null, `${lv.name} P${p}${'NESW'[d]}`).toBe(shift(lv, s, p, d) !== null);
      if (r) refused++; else legal++;
    }
    expect(refused).toBeGreaterThan(0);
    expect(legal).toBeGreaterThan(0);
  });
  it('rail: the travel limit', () => {
    const lv = named('First Peak');
    const two = shift(lv, shift(lv, lv.start, 0, 1)!, 0, 1)!; // two steps east: the most the plate may travel
    expect(refusal(lv, two, 0, 1)).toBe('rail');
    expect(refusal(lv, two, 0, 3)).toBeNull();
    const edge = shift(lv, lv.start, 0, 3)!; // one step west leaves no room on the grid: that is not the rail
    expect(refusal(lv, edge, 0, 3)).toBe('other');
  });
  it('melt: Step Aside refuses both pushes until the floe has somewhere to go', () => {
    const lv = named('Step Aside');
    expect(refusal(lv, lv.start, 0, 1)).toBe('melt'); // P0E would melt the floe under the penguin
    expect(refusal(lv, lv.start, 1, 2)).toBe('melt'); // P1S would too, against c
    const cleared = shift(lv, lv.start, 2, 3)!; // P2W: c gets out of the way
    expect(refusal(lv, cleared, 1, 2)).toBeNull();
    const stepped = shift(lv, cleared, 1, 2)!;
    expect(refusal(lv, stepped, 0, 1)).toBeNull();
  });
  it('stack: two creatures forced onto one cell', () => {
    const lv: Level = {
      w: 5, h: 3, plates: 2, axis: [1, 1], maxTravel: 2, buoys: [], biome: 'meadow',
      start: { plate: Int8Array.from([-1, -1, -1, -1, -1, 0, 0, 1, 1, -1, -1, -1, -1, -1, -1]), elev: new Int8Array(15), objs: [{ kind: 'goat', cell: 6 }, { kind: 'goat', cell: 8 }] },
    };
    const onto = shift(lv, lv.start, 0, 1)!; // the goat on a now stands on the cell a took from b
    expect(refusal(lv, onto, 0, 1)).toBe('stack');
  });
  it('pinned: the anchor rock', () => {
    const lv = named('Anchor Rock');
    expect(refusal(lv, lv.start, 1, 0)).toBe('pinned');
    expect(refusal(lv, lv.start, 1, 2)).toBe('pinned');
  });
  it('other: the wrong axis', () => {
    const lv = named('First Peak');
    expect(refusal(lv, lv.start, 0, 0)).toBe('other'); // plate a rides E/W only
  });
  it('the shipped campaign can hit every reason a player will see', () => {
    const seen = new Set<string>();
    for (const lv of all) {
      const once = reach(lv);
      for (const s of [...once, ...once.flatMap(t => railMoves(lv).map(([p, d]) => shift(lv, t, p, d)).filter((u): u is NonNullable<typeof u> => !!u))])
        for (const [p, d] of railMoves(lv)) { const r = refusal(lv, s, p, d); if (r) seen.add(r); }
    }
    expect([...seen].sort()).toEqual(expect.arrayContaining(['melt', 'rail', 'stack']));
  });
});

describe('pinned plates (Tundra: the anchor rock)', () => {
  const lv = strip(row([0, 0, 1]), row([0, 0, 0]));
  const pinned = { ...lv, pinned: [1] };
  it('shift refuses to move a pinned plate, in any direction', () => {
    for (const d of [1, 3] as const) expect(shift(pinned, pinned.start, 1, d)).toBeNull();
    expect(shift(lv, lv.start, 1, 1)).not.toBeNull(); // the same plate, not pinned
  });
  it('another plate can still push into it and take its cells', () => {
    const t = shift(pinned, pinned.start, 0, 1)!;
    expect(t.plate[8]).toBe(0);
    expect(t.elev[8]).toBe(1);
  });
  it('the solver never offers a pinned plate a move', () => {
    expect(railMoves(pinned)).toEqual([[0, 1], [0, 3]]);
  });
});

describe('ice (Tundra): rides its plate like terrain, melts at height 2', () => {
  const withIce = (lv: Level, cells: number[]): Level => {
    const ice = new Uint8Array(lv.start.plate.length);
    for (const c of cells) ice[c] = 1;
    return { ...lv, start: { ...lv.start, ice } };
  };
  it('rides its plate', () => {
    const lv = withIce(strip(row([0, 1, 1]), row([0, 0, 0])), [6]);
    const t = shift(lv, lv.start, 0, 3)!; // west: cell 6 moves to 5
    expect(t.ice![5]).toBe(1);
    expect(t.ice![6]).toBe(0);
    expect(lv.start.ice![6]).toBe(1); // the start state is untouched
  });
  it('a taken ice cell below height 2 stays ice under the new plate', () => {
    const lv = withIce(strip(row([0, 0, 1]), row([0, 0, 0])), [8]);
    const t = shift(lv, lv.start, 0, 1)!;
    expect([t.plate[8], t.elev[8], t.ice![8]]).toEqual([0, 1, 1]);
  });
  it('lifted to height 2 it melts: the cell becomes water', () => {
    const lv = withIce(strip(row([0, 0, 1]), row([0, 0, 1])), [8]);
    const t = shift(lv, lv.start, 0, 1)!;
    expect([t.plate[8], t.elev[8], t.ice![8]]).toEqual([W, 0, 0]);
  });
  it('a move that would melt ice under a creature is refused (design audit S6)', () => {
    const lv = withIce(strip(row([0, 0, 1]), row([0, 0, 1]), [{ kind: 'penguin', cell: 8 }]), [8]);
    expect(shift(lv, lv.start, 0, 1)).toBeNull();
  });
  it('stateKey tells ice from plain land', () => {
    const plain = strip(row([0, 0, 1]), row([0, 0, 0])), iced = withIce(plain, [6]);
    expect(stateKey(iced.start)).not.toBe(stateKey(plain.start));
  });
  it('previewDiff lists melted cells in melt and in flood', () => {
    const lv = withIce(strip(row([0, 0, 1]), row([0, 0, 1])), [8]);
    const d = previewDiff(lv, lv.start, shift(lv, lv.start, 0, 1)!);
    expect(d.melt).toEqual([8]);
    expect(d.flood).toContain(8);
  });
  it('a plain push melts nothing', () => {
    const lv = strip(row([0, 0, 1]), row([0, 0, 0]));
    expect(previewDiff(lv, lv.start, shift(lv, lv.start, 0, 1)!).melt).toEqual([]);
  });
});

describe('penguin (Tundra): stands on ice that touches the sea', () => {
  const lv = (ice: number[], plate = lakeRing, cell = 7): Level => {
    const l = strip(plate, plate.map(() => 0), [{ kind: 'penguin', cell }], [], 5);
    const mask = new Uint8Array(plate.length); for (const c of ice) mask[c] = 1;
    return { ...l, start: { ...l.start, ice: mask } };
  };
  // 5x5: land ring around one enclosed water cell (12); the outer ring is ocean. Cell 7 touches both the lake and the ocean.
  const lakeRing = [W, W, W, W, W, W, 0, 0, 0, W, W, 0, W, 0, W, W, 0, 0, 0, W, W, W, W, W, W];
  it('is happy on ice beside the sea', () => {
    const l = lv([7]);
    expect(goalsMet(l, l.start)).toEqual([true]);
    expect(solved(l, l.start)).toBe(true);
  });
  it('is unhappy on bare land beside the same sea', () => {
    const l = lv([]);
    expect(goalsMet(l, l.start)).toEqual([false]);
    expect(solved(l, l.start)).toBe(false);
  });
  it('a lake is not the sea: on ice with only lake beside it, unhappy', () => {
    // 7x7: thick land with a one-cell lake at the centre; the penguin's cell touches only land and the lake
    const n = 7, plate = Array.from({ length: n * n }, (_, i) => { const x = i % n, y = Math.floor(i / n); return x === 0 || y === 0 || x === n - 1 || y === n - 1 ? W : 0; });
    plate[24] = W;
    const l0 = strip(plate, plate.map(() => 0), [{ kind: 'penguin', cell: 17 }], [], n);
    const mask = new Uint8Array(plate.length); mask[17] = 1;
    const l = { ...l0, start: { ...l0.start, ice: mask } };
    expect(seaMask(l, l.start)[24]).toBe(0);
    expect(goalsMet(l, l.start)).toEqual([false]);
  });
  it('goal order stays objs, then buoys', () => {
    const l = { ...lv([7]), buoys: [12] }; // the buoy sits on the lake: not the sea
    expect(goalsMet(l, l.start)).toEqual([true, false]);
  });
});

describe('levels.json (the shipped campaign)', () => {
  const all = (levels as LevelJson[]).map(fromJson);
  it('starts with the first tutorial and has 18-20 levels', () => {
    expect(all[0].name).toBe('First Peak');
    expect(all.length).toBeGreaterThanOrEqual(18);
    expect(all.length).toBeLessThanOrEqual(20);
  });
  for (const lv of all) {
    it(`${lv.name}: solver par equals the exported par`, () => {
      expect(solve(lv, 9)?.min).toBe(lv.par);
    });
    it(`${lv.name}: the exported solution solves it at par`, () => {
      let s = lv.start;
      for (const m of lv.sol!) s = shift(lv, s, Number(m[1]), 'NESW'.indexOf(m[2]) as 0 | 1 | 2 | 3)!;
      expect(lv.sol!.length).toBe(lv.par);
      expect(solved(lv, s)).toBe(true);
    });
  }
});
