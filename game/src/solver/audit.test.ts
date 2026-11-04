import { describe, expect, it } from 'vitest';
import { fromJson, type LevelJson } from '../rules/rules';
import { audit, firstMoves, greedySolveRate, partsOf, randomSolveRate, shipCheck, shortestSolutions } from './audit';
import levels from '../levels/levels.json';

// The exported set: tutorial levels (each biome's teachers, exempt from par >= 3) and puzzles that must pass the full bar.
const all = (levels as LevelJson[]).map(fromJson);
const puzzles = all.filter(l => l.role === 'puzzle');

describe('quality bar on the exported puzzles', () => {
  it('has 10 puzzles', () => expect(puzzles.length).toBe(10));
  for (const lv of puzzles) {
    it(`${lv.name} passes (par ${lv.par})`, () => {
      const a = audit(lv, lv.par! + 2)!;
      expect(a.why).toEqual([]);
      expect(a.min).toBe(lv.par);
      // a tempting move costs at least one move more than par, or leaves no finish
      if (a.tempting!.finish !== null) expect(a.tempting!.finish).toBeGreaterThan(lv.par!);
    });
  }
});

describe('ship check (npm run levels:audit)', () => {
  it('every exported level passes', () => {
    expect(all.map(lv => [lv.name, shipCheck(lv).why])).toEqual(all.map(lv => [lv.name, []]));
  });
  it('a wrong par fails', () => {
    expect(shipCheck({ ...puzzles[0], par: puzzles[0].par! + 1 }).why).toContain(`par ${puzzles[0].par! + 1} but min ${puzzles[0].par}`);
  });
  it('the role decides the bar: a 1-move tutorial passes, the same level as a puzzle (or with no role) fails', () => {
    const first = all[0];
    expect(first.role).toBe('tutorial');
    expect(shipCheck(first).ok).toBe(true);
    expect(shipCheck({ ...first, role: 'puzzle' }).ok).toBe(false);
    expect(shipCheck({ ...first, role: undefined }).ok).toBe(false);
  });
  it('every level carries a role: four Meadow levels teach, then the first puzzle, and every puzzle has at least 3 moves', () => {
    expect(all.slice(0, 4).map(l => l.role)).toEqual(Array(4).fill('tutorial'));
    expect(all[4].role).toBe('puzzle');
    expect(all.every(l => l.role === 'tutorial' || l.role === 'puzzle')).toBe(true);
    for (const l of puzzles) expect(l.par).toBeGreaterThanOrEqual(3);
  });
});

describe('tutorial levels keep their designed traps', () => {
  const trap: Record<string, string> = { 'Mind the Village': 'P0E', 'Far One First': 'P1E', 'The Long Pier': 'P0W' };
  for (const [name, move] of Object.entries(trap)) {
    it(`${name}: tempting ${move}`, () => {
      const a = audit(all.find(l => l.name === name)!, 6, 1)!;
      expect(a.tempting?.move).toBe(move);
    });
  }
});

describe('random play (the ramp in docs/design-plates.md)', () => {
  it('is repeatable for a seed and gets harder from the first level to the last', () => {
    const first = all[0], last = all[all.length - 1];
    expect(randomSolveRate(first, 200)).toBe(randomSolveRate(first, 200));
    expect(randomSolveRate(first)).toBeGreaterThan(0.5);
    expect(randomSolveRate(last)).toBeLessThan(0.05);
  });
  it('no puzzle is one a random walk finishes often', () => {
    for (const l of puzzles) expect(randomSolveRate(l), l.name).toBeLessThan(0.15);
  });
});

describe('greedy play: always take the move the preview shows ticking most goals', () => {
  it('is exact over tie-breaks: First Peak falls to it, Mind the Village only if the first tie-break is lucky', () => {
    expect(greedySolveRate(all[0])).toBe(1);
    expect(greedySolveRate(all.find(l => l.name === 'Mind the Village')!)).toBeCloseTo(0.25);
  });
  it('the first aha comes inside the first five levels: Good Neighbours needs a move the preview does not reward', () => {
    expect(all.findIndex(l => l.role === 'puzzle')).toBeLessThan(5);
    expect(greedySolveRate(all[4])).toBe(0);
  });
  it('no puzzle falls to it, Step Aside (one lucky tie-break in eight) excepted', () => {
    for (const l of puzzles) expect(greedySolveRate(l), l.name).toBe(l.name === 'Step Aside' ? 0.125 : 0);
  });
});

describe('parts: every goal, stretch of ice and pin changes the answer', () => {
  const part = (name: string, what: RegExp) => partsOf(all.find(l => l.name === name)!).find(p => what.test(p.what))!;
  it('a goal the level is unsolvable or shorter without', () => {
    expect(part('Good Neighbours', /goat/)).toMatchObject({ kind: 'goal', effect: 'shortens', par: 1 });
  });
  it('ice the level cannot be solved without', () => expect(part('Thin Ice', /ice/)).toMatchObject({ kind: 'ice', effect: 'needed', par: null }));
  it('a pin the level gets shorter without', () => expect(part('The Summit', /pin/)).toMatchObject({ kind: 'pin', effect: 'shortens' }));
  it('a village far from every seam is a decoy', () => {
    const lv = all.find(l => l.name === 'Open Water')!;
    const spare = [...lv.start.plate.keys()].find(i => lv.start.plate[i] === 0 && i !== lv.buoys[0])!;
    const decoyed = { ...lv, start: { ...lv.start, objs: [...lv.start.objs, { kind: 'village' as const, cell: spare }] } };
    expect(partsOf(decoyed).find(p => /village/.test(p.what))).toMatchObject({ kind: 'goal', effect: 'decoy' });
  });
});

describe('shortest solutions and first moves', () => {
  it('lists every shortest solution (First Peak has its two mirror moves)', () => {
    expect(shortestSolutions(all[0], 1).map(s => s.join(' ')).sort()).toEqual(['P0E', 'P1W']);
  });
  it('marks the proven dead ends and costs the rest', () => {
    const rows = firstMoves(all.find(l => l.name === 'Mind the Village')!, 9);
    const row = (m: string) => rows.find(r => r.move === m)!;
    expect(row('P0E')).toMatchObject({ dead: true, finish: null, ticks: 0 });
    expect(row('P1S')).toMatchObject({ dead: false, finish: 2 });
  });
});
