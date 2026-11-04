import { describe, expect, it, vi } from 'vitest';
import { canFinish, fromJson, goalsMet, seaMask, shift, solve, type Level, type LevelJson } from '../rules/rules';
import { goalReason } from '../game/reasons';
import { CAMPAIGN } from '../levels/campaign';
import type { Spec } from '../levels/tutorial';
import levels from '../levels/levels.json';
import { checkFixture, claimsOf, lakesBeforeTheyAreTaught, shapeProblems, solveWithoutRetreat } from './fixtures';
import { applyAll, greedySolveRate, shortestSolutions } from './audit';

vi.setConfig({ testTimeout: 60_000 }); // High Pasture's dead-trap proof walks 272k states

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
  const name = 'Salt Point', s = spec(name), lv = byName(name);
  const problems = (f: Spec, l: Level = lv) => checkFixture(f, l).problems.join('; ');
  it('no fixture at all', () => expect(problems({ ...s, fixture: undefined })).toMatch(/no fixture/));
  it('an intended solution that is not shortest', () => expect(problems(withFix(s, { intended: 'P2E P2E P2W' }))).toMatch(/does not solve|not a shortest|not the intended/));
  it('a trap whose cost is wrong', () => expect(problems(withFix(s, { trap: { move: 'P2E', finish: 5, why: '' } }))).toMatch(/finishes in 4, fixture says 5/));
  it('a trap that is the solution', () => expect(problems(withFix(s, { trap: { move: 'P2W', finish: 3, why: '' } }))).toMatch(/on a shortest path/));
  it('a level with par above 1 and no trap', () => expect(problems(withFix(s, { trap: null }))).toMatch(/must name its trap/));
  it('an aha off the shortest path', () => expect(problems(withFix(s, { aha: { move: 'P0N', says: '', shows: [] } }))).toMatch(/not on every shortest path/));
  it('an aha that does not do what it claims', () => expect(problems(withFix(s, { aha: { move: 'P2E', says: '', shows: ['melts'] } }))).toMatch(/does not show: melts/));
  it('a dead end is a proof, not "nothing within the search depth"', () => {
    const summit = spec('The Summit');
    expect(problems(withFix(summit, { trap: { move: 'P0E', finish: 'dead', why: '' } }), byName('The Summit'))).toMatch(/fixture says dead/);
  });
  it('a part that changes nothing is a decoy', () => {
    const open = byName('Open Water');
    const spare = [...open.start.plate.keys()].find(i => open.start.plate[i] === 0 && i !== open.buoys[0])!;
    const decoyed = { ...open, start: { ...open.start, objs: [...open.start.objs, { kind: 'village' as const, cell: spare }] } };
    expect(problems(spec('Open Water'), decoyed)).toMatch(/decoy: without the village/);
  });
  it('a puzzle that falls to greedy play fails, a teacher may', () => {
    const still = byName('Still Water');
    expect(checkFixture(spec('Still Water'), still).greedy).toBe(1);
    expect(problems(spec('Still Water'), still)).not.toMatch(/greedy/);
    expect(problems(spec('Still Water'), { ...still, role: 'puzzle' })).toMatch(/greedy play solves it 100%/);
  });
});

describe('the moments the finale is built on', () => {
  const play = (name: string, moves: string[]) => { const lv = byName(name); return { lv, s: applyAll(lv, lv.start, moves)! }; };
  const met = (name: string, moves: string[]) => { const { lv, s } = play(name, moves); return goalsMet(lv, s).filter(Boolean).length; };
  const summitLine = ['P0W', 'P0W', 'P1N', 'P1S', 'P0E', 'P0E', 'P0E'];
  const goals = (moves: string[]) => { const { lv, s } = play('The Summit', moves); return lv.start.objs.map(o => o.kind as string).concat('buoy').filter((_, k) => !goalsMet(lv, s)[k]); };
  it('The Summit: the easy slide ticks four on the first move, and leaves the goat and the buoy', () => {
    expect(met('The Summit', [])).toBe(1);
    expect(goals(['P0E'])).toEqual(['goat', 'buoy']);
  });
  it('The Summit: fetching the goat and coming straight home is five of six, with the tail on the buoy and out of reach', () => {
    const near = ['P0W', 'P0W', 'P0E', 'P0E', 'P0E'];
    expect(goals(near)).toEqual(['buoy']);
    const { lv, s } = play('The Summit', near);
    expect(solve(lv, 9, s)?.min).toBe(8); // all the way out again, for the bite
  });
  it('The Summit: a cannot come home while b holds its tail, because the village would land on the penguin', () => {
    const { lv, s } = play('The Summit', ['P0W', 'P0W', 'P1N']);
    expect(shift(lv, s, 0, 1)).toBeNull();
  });
  it('The Summit: five of six, two given back on the way home, and the last slide ticks three at once', () => {
    expect(summitLine.map((_, k) => met('The Summit', summitLine.slice(0, k + 1)))).toEqual([3, 4, 5, 5, 4, 3, 6]);
    expect(goals(summitLine.slice(0, 4))).toEqual(['oasis']);
    expect(goals(summitLine.slice(0, 6)).sort()).toEqual(['light', 'oasis', 'penguin']);
  });
  it('Give and Take: the pond is opened, filled, then opened again', () => {
    const oasis = (moves: string[]) => { const { lv, s } = play('Give and Take', moves); return goalsMet(lv, s)[lv.start.objs.findIndex(o => o.kind === 'oasis')]; };
    expect([oasis([]), oasis(['P0W']), oasis(['P0W', 'P1W']), oasis(['P0W', 'P1W', 'P0E', 'P0W'])]).toEqual([false, true, false, true]);
  });
  it('Oxbow: the pond and the sea do not touch, not even at a corner: the corner fact is stated and first needed one level later', () => {
    const { lv, s } = play('Oxbow', ['P0W', 'P2N', 'P1W']);
    const sea = seaMask(lv, s);
    const water = (x: number, y: number) => s.plate[x + y * lv.w] < 0 && sea[x + y * lv.w];
    const ponds = [...s.plate.keys()].filter(i => s.plate[i] < 0 && !sea[i]);
    expect(ponds.length).toBeGreaterThan(0);
    for (const i of ponds) {
      const x = i % lv.w, y = Math.floor(i / lv.w);
      for (const [dx, dy] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) expect(water(x + dx, y + dy), `${x},${y} and its corner ${dx},${dy}`).toBe(false);
    }
  });
  it('Two Waters: the pond and the open sea end up touching only at a corner', () => {
    const { lv, s } = play('Two Waters', ['P1E', 'P2E', 'P0N']);
    const sea = seaMask(lv, s), buoy = lv.buoys[0];
    const ponds = [...s.plate.keys()].filter(i => s.plate[i] < 0 && !sea[i]);
    expect(ponds).toHaveLength(1);
    expect(ponds[0] - buoy).toBe(1 - lv.w); // one east, one north: for a camera at +x,+z the two lie side by side on the screen
  });
});

describe('bite and retreat (playtest 3 P1: the technique nothing taught)', () => {
  const cut = byName('The Cut'), rock = byName('Anchor Rock');
  it('The Cut: the one line at par clears the door, bites and retreats, and greedy play cannot find it', () => {
    expect(shortestSolutions(cut, 3, 16).map(s => s.join(' '))).toEqual(['P0E P2E P2W']);
    expect(greedySolveRate(cut)).toBe(0);
  });
  it('The Cut: the bite ticks nothing, the retreat ticks both goals and leaves water on the land it bit', () => {
    const bite = applyAll(cut, cut.start, ['P0E', 'P2E'])!;
    expect(goalsMet(cut, bite).filter(Boolean)).toHaveLength(1); // only the village, which was already fine
    const has = claimsOf(cut, bite, applyAll(cut, bite, ['P2W'])!, 'P2W', ['P0E', 'P2E']);
    expect(has).toContain('carries');
    expect(has).toContain('ticks2');
  });
  it('The Cut: the same bite first thing breaks the village, and nothing brings it back', () => {
    const early = applyAll(cut, cut.start, ['P2E'])!;
    expect(goalsMet(cut, early)[1]).toBe(false);
    expect(canFinish(cut, early)).toBe(false);
  });
  it('The Cut: after the door opens the lamp says the corner does not count', () => {
    expect(goalReason(cut, applyAll(cut, cut.start, ['P0E'])!, 0)).toBe("corners don't count");
  });
  it('Twin Palms: the second move gives back a tick and the third takes three', () => {
    const lv = byName('Twin Palms');
    const counts = ['P1E', 'P1E P0S', 'P1E P0S P0N'].map(l => goalsMet(lv, applyAll(lv, lv.start, l.split(' '))!).filter(Boolean).length);
    expect(counts).toEqual([2, 1, 3]);
  });
  it('Wishing Well: the same slide twice flips which of the two is unhappy', () => {
    const lv = byName('Wishing Well');
    const one = applyAll(lv, lv.start, ['P0E'])!, two = applyAll(lv, lv.start, ['P0E', 'P0E'])!;
    expect(goalsMet(lv, one)).toEqual([false, true, true]); // lamp, oasis, buoy
    expect(goalReason(lv, one, 0)).toBe('that water is a lake');
    expect(goalsMet(lv, two)).toEqual([true, false, true]);
    expect(goalReason(lv, two, 1)).toBe('that water reaches the sea');
  });
  it('some islands cannot be solved at any length without a retreat: an exhaustive search finds no line', () => {
    for (const n of ['Good Neighbours', 'Low Tide', 'Mirage']) expect(solveWithoutRetreat(byName(n)), n).toBeNull();
  });
  it('Mirage proves the same claim on its aha', () => {
    expect(spec('Mirage').fixture!.aha.shows).toContain('carries');
  });
  it('Anchor Rock: the plain bite breaks the village until c has taken it off a', () => {
    const c = applyAll(rock, rock.start, ['P2S'])!;
    const bitten = applyAll(rock, c, ['P0E'])!;
    expect(goalsMet(rock, bitten)[0]).toBe(true);
    expect(goalsMet(rock, applyAll(rock, rock.start, ['P0E'])!)[0]).toBe(false);
    expect(claimsOf(rock, bitten, applyAll(rock, bitten, ['P0W'])!, 'P0W', ['P2S', 'P0E'])).toContain('carries');
  });
  it('a claim of carrying fails on a retreat that only gives back open water', () => {
    const open = byName('Open Water'), out = applyAll(open, open.start, ['P1E'])!;
    expect(claimsOf(open, out, applyAll(open, out, ['P1W'])!, 'P1W', ['P1E'])).not.toContain('carries');
  });
});

describe('ponds before the desert (Nov 4 playtest P8: a pond appeared in level 5, before lakes are taught)', () => {
  it('no meadow or coast level shows one on its intended line or any preview from it', () => {
    for (const lv of all.filter(l => l.biome === 'meadow' || l.biome === 'coast')) expect(lakesBeforeTheyAreTaught(lv, lv.sol!), lv.name).toEqual([]);
  });
  it('names the move that would show one', () => {
    const still = byName('Still Water');
    expect(lakesBeforeTheyAreTaught({ ...still, biome: 'coast' }, still.sol!).join()).toMatch(/at the start P1E shows a pond/);
  });
  it('the desert and after are free to show them', () => {
    const still = byName('Still Water');
    expect(lakesBeforeTheyAreTaught(still, still.sol!)).toEqual([]);
  });
});

describe('claims', () => {
  const claims = (name: string, before: string[], m: string) => {
    const lv = byName(name);
    return claimsOf(lv, applyAll(lv, lv.start, before)!, applyAll(lv, lv.start, [...before, m])!, m, before);
  };
  it('lifts', () => expect(claims('First Peak', [], 'P0E')).toContain('lifts'));
  it('floods', () => expect(claims('Open Water', [], 'P0W')).toContain('floods'));
  it('quiet', () => expect(claims('Village Green', [], 'P1S')).toContain('quiet'));
  it('ticks2', () => expect(claims('The Long Pier', [], 'P1E')).toContain('ticks2'));
  it('returns', () => expect(claims('Stolen Peak', ['P0E'], 'P0W')).toContain('returns'));
  it('reclaims', () => expect(claims('The Long Pier', [], 'P1E')).toContain('reclaims'));
  it('lake', () => expect(claims('Still Water', [], 'P1E')).toContain('lake'));
  it('seals', () => expect(claims('Mirage', ['P1W', 'P2W', 'P0E'], 'P0W')).toContain('seals'));
  it('melts, on the second push and not the first', () => {
    expect(claims('Thin Ice', [], 'P0E')).not.toContain('melts');
    expect(claims('Thin Ice', ['P0E'], 'P0E')).toContain('melts');
  });
  it('hitsrock', () => expect(claims('Anchor Rock', ['P2S'], 'P0E')).toContain('hitsrock'));
  it('unticks', () => expect(claims('The Summit', ['P0W', 'P0W', 'P1N', 'P1S'], 'P0E')).toContain('unticks'));
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
  it('flags a plate in two pieces: it slides as one, so it would read as two plates', () => {
    const lv = byName('First Peak'), plate = Int8Array.from(lv.start.plate);
    plate[2 * lv.w + 2] = -1; // the cell that joins plate a's three arms
    expect(shapeProblems({ ...lv, start: { ...lv.start, plate } }).join()).toMatch(/plate 0 is in two pieces/);
  });
  it('flags a goat on ice: it could never reach a peak', () => {
    const lv = byName('Thin Ice'), ice = Uint8Array.from(lv.start.ice!);
    ice[lv.start.objs[0].cell] = 1;
    const goat = { ...lv, start: { ...lv.start, ice, objs: [{ kind: 'goat' as const, cell: lv.start.objs[0].cell }] } };
    expect(shapeProblems(goat).join()).toMatch(/goat on ice/);
  });
  it('flags land on the ocean ring, and a level over 9x9', () => {
    const plate = Int8Array.from(summit.start.plate); plate[0] = 0;
    expect(shapeProblems({ ...summit, start: { ...summit.start, plate } }).join()).toMatch(/ocean ring/);
    expect(shapeProblems({ ...summit, w: 10, h: 10, start: { ...summit.start, plate: new Int8Array(100).fill(-1), elev: new Int8Array(100) } }).join()).toMatch(/over the 9x9/);
  });
});
