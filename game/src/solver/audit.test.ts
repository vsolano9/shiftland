import { describe, expect, it } from 'vitest';
import { fromJson, type LevelJson } from '../rules/rules';
import { audit, shipCheck } from './audit';
import levels from '../../../spikes/plates/levels.json';

// The exported set: tutorial levels first (exempt from par >= 3), then generated puzzles that must pass the full bar.
const all = (levels as LevelJson[]).map(fromJson);
const puzzles = all.filter(l => l.role === 'puzzle');

describe('quality bar on the exported puzzles', () => {
  it('has 8 puzzles', () => expect(puzzles.length).toBe(8));
  for (const lv of puzzles) {
    it(`${lv.name} passes (par ${lv.par})`, () => {
      const a = audit(lv)!;
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
  it('every level carries a role: 6 tutorials, then 8 puzzles', () => {
    expect(all.map(l => l.role)).toEqual([...Array(6).fill('tutorial'), ...Array(8).fill('puzzle')]);
  });
});

describe('tutorial levels keep their designed traps', () => {
  const trap: Record<string, string> = { 'Mind the Village': 'P0E', 'Two Wishes': 'P0E', 'Far One First': 'P1E', 'Dip and Return': 'P0E' };
  for (const [name, move] of Object.entries(trap)) {
    it(`${name}: tempting ${move}`, () => {
      const a = audit(all.find(l => l.name === name)!, 6, 1)!;
      expect(a.tempting?.move).toBe(move);
    });
  }
});
