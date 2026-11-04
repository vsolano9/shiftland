import { describe, expect, it, vi } from 'vitest';
import { fromJson, type LevelJson } from '../rules/rules';
import { audit, effortOf, firstMoves, greedySolveRate, partsOf, randomSolveRate, shipCheck, shortestSolutions } from './audit';
import levels from '../levels/levels.json';

vi.setConfig({ testTimeout: 60_000 }); // High Pasture's dead-trap proof walks 272k states

// The exported set: tutorial levels (each biome's teachers, exempt from par >= 3) and puzzles that must pass the full bar.
const all = (levels as LevelJson[]).map(fromJson);
const puzzles = all.filter(l => l.role === 'puzzle');

describe('quality bar on the exported puzzles', () => {
  it('has 15 puzzles', () => expect(puzzles.length).toBe(15));
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
  const trap: Record<string, string> = { 'Village Green': 'P0E', 'The Long Pier': 'P0W' };
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
  it('is exact over tie-breaks: First Peak falls to it, Village Green only if the first tie-break is lucky', () => {
    expect(greedySolveRate(all[0])).toBe(1);
    expect(greedySolveRate(all.find(l => l.name === 'Village Green')!)).toBeCloseTo(0.25);
  });
  it('the first aha comes inside the first five levels: Good Neighbours needs a move the preview does not reward', () => {
    expect(all.findIndex(l => l.role === 'puzzle')).toBeLessThan(5);
    expect(greedySolveRate(all[4])).toBe(0);
  });
  it('no puzzle falls to it, Cold Feet (one lucky tie-break in eight) excepted', () => {
    for (const l of puzzles) expect(greedySolveRate(l), l.name).toBe(l.name === 'Cold Feet' ? 0.125 : 0);
  });
});

describe('effort: the moves a player tries without reading the board (the ramp)', () => {
  const effort = new Map(all.map(l => [l.name!, effortOf(l).effort]));
  it('is repeatable', () => expect(effortOf(all[4])).toEqual(effortOf(all[4])));
  it('counts the cheaper of two strategies: The Summit falls to chasing ticks far sooner than to brute force', () => {
    const { follow, blind } = effortOf(all.find(l => l.name === 'The Summit')!);
    expect(follow).toBeLessThan(blind / 5);
  });
  it('no puzzle falls within 30 tries (Ice Dam at 22 fell to following ticks in the Nov 4 playtest)', () => {
    for (const l of puzzles) expect(effort.get(l.name!), l.name).toBeGreaterThanOrEqual(30);
  });
  it('the Meadow climbs through its three puzzles, and the first aha comes well before the desert', () => {
    const [a, b, c] = puzzles.slice(0, 3).map(l => effort.get(l.name!)!);
    expect(a).toBeLessThan(b);
    expect(b).toBeLessThan(c);
    expect(all.findIndex(l => effort.get(l.name!)! >= 100)).toBeLessThan(7);
  });
  it('par never falls inside a biome, and no puzzle is more than 3x the hardest before it (the first aha excepted)', () => {
    let hardest = 0, seen = false;
    for (const [i, l] of all.entries()) {
      if (i > 0 && l.biome === all[i - 1].biome) expect(l.par!, l.name).toBeGreaterThanOrEqual(all[i - 1].par!);
      if (l.role === 'puzzle' && seen) expect(effort.get(l.name!)!, l.name).toBeLessThanOrEqual(3 * hardest);
      if (l.role === 'puzzle') seen = true;
      hardest = Math.max(hardest, effort.get(l.name!)!);
    }
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
    const rows = firstMoves(all.find(l => l.name === 'Village Green')!, 9);
    const row = (m: string) => rows.find(r => r.move === m)!;
    expect(row('P0E')).toMatchObject({ dead: true, finish: null, ticks: 0 });
    expect(row('P1S')).toMatchObject({ dead: false, finish: 2 });
  });
});
