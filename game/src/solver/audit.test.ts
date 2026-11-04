import { describe, expect, it } from 'vitest';
import { fromJson, type LevelJson } from '../rules/rules';
import { audit, firstMoves, randomSolveRate, shipCheck, shortestSolutions } from './audit';
import levels from '../levels/levels.json';

// The exported set: tutorial levels (each biome's teachers, exempt from par >= 3) and puzzles that must pass the full bar.
const all = (levels as LevelJson[]).map(fromJson);
const puzzles = all.filter(l => l.role === 'puzzle');

describe('quality bar on the exported puzzles', () => {
  it('has 8 puzzles', () => expect(puzzles.length).toBe(8));
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
  it('every level carries a role: the six Meadow levels teach, and every puzzle has at least 3 moves', () => {
    expect(all.slice(0, 6).map(l => l.role)).toEqual(Array(6).fill('tutorial'));
    expect(all.every(l => l.role === 'tutorial' || l.role === 'puzzle')).toBe(true);
    for (const l of puzzles) expect(l.par).toBeGreaterThanOrEqual(3);
  });
});

describe('tutorial levels keep their designed traps', () => {
  const trap: Record<string, string> = { 'Mind the Village': 'P0E', 'Two Wishes': 'P0E', 'Far One First': 'P1E', 'The Long Pier': 'P0W' };
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
