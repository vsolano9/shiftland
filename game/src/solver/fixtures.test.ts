import { describe, expect, it } from 'vitest';
import { fromJson, type Level, type LevelJson } from '../rules/rules';
import { CAMPAIGN } from '../levels/campaign';
import type { Spec } from '../levels/tutorial';
import levels from '../levels/levels.json';
import { checkFixture, claimsOf, shapeProblems } from './fixtures';
import { applyAll } from './audit';

const all = (levels as LevelJson[]).map(fromJson);
const byName = (n: string) => all.find(l => l.name === n)!;
const spec = (n: string) => CAMPAIGN.find(s => s.name === n)!;
const withFix = (s: Spec, patch: Partial<NonNullable<Spec['fixture']>>): Spec => ({ ...s, fixture: { ...s.fixture!, ...patch } });

describe('every shipped level proves its intended solution, trap and aha (npm run levels:audit)', () => {
  it('the shipped list is the campaign, in order', () => {
    expect(all.map(l => l.name)).toEqual(CAMPAIGN.map(s => s.name));
  });
  for (const s of CAMPAIGN) it(s.name, () => expect(checkFixture(s, byName(s.name)).problems).toEqual([]));
});

describe('a fixture that stops being true fails', () => {
  const name = 'Wind-Up', s = spec(name), lv = byName(name);
  const problems = (f: Spec, l: Level = lv) => checkFixture(f, l).problems.join('; ');
  it('no fixture at all', () => expect(problems({ ...s, fixture: undefined })).toMatch(/no fixture/));
  it('an intended solution that is not shortest', () => expect(problems(withFix(s, { intended: 'P2E P2E P2W' }))).toMatch(/does not solve|not a shortest|not the intended/));
  it('a trap whose cost is wrong', () => expect(problems(withFix(s, { trap: { move: 'P2E', finish: 4, why: '' } }))).toMatch(/finishes in 5, fixture says 4/));
  it('a trap that is the solution', () => expect(problems(withFix(s, { trap: { move: 'P2W', finish: 3, why: '' } }))).toMatch(/on a shortest path/));
  it('a level with par above 1 and no trap', () => expect(problems(withFix(s, { trap: null }))).toMatch(/must name its trap/));
  it('an aha off the shortest path', () => expect(problems(withFix(s, { aha: { move: 'P0N', says: '', shows: [] } }))).toMatch(/not on every shortest path/));
  it('an aha that does not do what it claims', () => expect(problems(withFix(s, { aha: { move: 'P2E', says: '', shows: ['melts'] } }))).toMatch(/does not show: melts/));
  it('a dead end is a proof, not "nothing within the search depth"', () => {
    const summit = spec('The Summit');
    expect(problems(withFix(summit, { trap: { move: 'P0N', finish: 'dead', why: '' } }), byName('The Summit'))).toMatch(/fixture says dead/);
  });
});

describe('claims', () => {
  const claims = (name: string, before: string[], m: string) => {
    const lv = byName(name);
    return claimsOf(lv, applyAll(lv, lv.start, before)!, applyAll(lv, lv.start, [...before, m])!, m, before);
  };
  it('lifts', () => expect(claims('First Peak', [], 'P0E')).toContain('lifts'));
  it('floods', () => expect(claims('Open Water', [], 'P0W')).toContain('floods'));
  it('quiet', () => expect(claims('Mind the Village', [], 'P1S')).toContain('quiet'));
  it('ticks2', () => expect(claims('Two Wishes', [], 'P2N')).toContain('ticks2'));
  it('returns', () => expect(claims('Stolen Peak', ['P0E'], 'P0W')).toContain('returns'));
  it('reclaims', () => expect(claims('The Long Pier', [], 'P2N')).toContain('reclaims'));
  it('lake', () => expect(claims('Still Water', [], 'P1E')).toContain('lake'));
  it('seals', () => expect(claims('The Door', [], 'P1N')).toContain('seals'));
  it('melts', () => expect(claims('Thin Ice', [], 'P0E')).toContain('melts'));
  it('hitsrock', () => expect(claims('Anchor Rock', [], 'P2S')).toContain('hitsrock'));
  it('unticks', () => expect(claims('The Summit', ['P2W'], 'P0S')).toContain('unticks'));
  it('opens', () => {
    const lv = byName('Breakwater');
    const sealed = applyAll(lv, lv.start, ['P1E', 'P2E'])!;
    expect(claimsOf(lv, sealed, applyAll(lv, sealed, ['P2W'])!, 'P2W')).toContain('opens');
  });
});

describe('shape checks', () => {
  const summit = byName('The Summit');
  it('a rectangle is not an island', () => {
    const plate = Int8Array.from({ length: 25 }, (_, i) => (i % 5 === 0 || i % 5 === 4 || i < 5 || i >= 20 ? -1 : 0));
    const lv: Level = { w: 5, h: 5, plates: 1, axis: [1], maxTravel: 2, buoys: [], biome: 'meadow', start: { plate, elev: new Int8Array(25), objs: [] } };
    expect(shapeProblems(lv)).toContain('the island is a plain rectangle');
  });
  it('no shipped level breaks a shape rule', () => {
    for (const lv of all) expect(shapeProblems(lv), lv.name).toEqual([]);
  });
  it('flags land on the ocean ring, and a level over 9x9', () => {
    const plate = Int8Array.from(summit.start.plate); plate[0] = 0;
    expect(shapeProblems({ ...summit, start: { ...summit.start, plate } }).join()).toMatch(/ocean ring/);
    expect(shapeProblems({ ...summit, w: 10, h: 10, start: { ...summit.start, plate: new Int8Array(100).fill(-1), elev: new Int8Array(100) } }).join()).toMatch(/over the 9x9/);
  });
});
