import { describe, expect, it } from 'vitest';
import { buildLevels, toJson } from './build';
import { CAMPAIGN } from './campaign';
import { parse, TUTORIAL } from './tutorial';
import shipped from './levels.json';

describe('level build', () => {
  const built = buildLevels();
  it('src/levels/levels.json is current (rerun `npm run levels:export` after changing levels)', () => {
    expect(shipped).toEqual(built);
  });
  it('rejects a map with an unknown object letter', () => {
    expect(() => parse({ ...TUTORIAL[0], map: '~ ~\n~ a0X' })).toThrow(/unknown object/);
  });
  it('writes every new field the renderer and the worker read', () => {
    const summit = built.find(l => l.name === 'The Summit')!;
    expect(summit.biome).toBe('finale');
    expect(summit.pinned).toEqual([3]);
    expect(summit.ice!.length).toBeGreaterThan(0);
    expect(summit.sol.length).toBe(summit.par);
    expect(summit.blurb).toBeTruthy();
    const peak = built.find(l => l.name === 'First Peak')!;
    expect(peak.ice).toBeUndefined();
    expect(peak.pinned).toBeUndefined();
  });
  it('a par that disagrees with the map is a build error', () => {
    expect(() => toJson({ ...CAMPAIGN[0], expectPar: 2 })).toThrow(/expected 2/);
  });
});

describe('the campaign', () => {
  const biomes = CAMPAIGN.map(s => s.biome ?? 'meadow');
  it('runs Meadow 6, Coast 3-4, Desert 3-4, Tundra 3-4, Finale 2, in that order', () => {
    const count = (b: string) => biomes.filter(x => x === b).length;
    expect(count('meadow')).toBe(6);
    for (const b of ['coast', 'desert', 'tundra']) { expect(count(b)).toBeGreaterThanOrEqual(3); expect(count(b)).toBeLessThanOrEqual(4); }
    expect(count('finale')).toBe(2);
    const order = biomes.filter((b, i) => b !== biomes[i - 1]);
    expect(order).toEqual(['meadow', 'coast', 'desert', 'tundra', 'finale']);
  });
  it('names are unique, 1-3 words, none is a "Puzzle N"', () => {
    const names = CAMPAIGN.map(s => s.name);
    expect(new Set(names).size).toBe(names.length);
    for (const n of names) { expect(n.split(' ').length).toBeLessThanOrEqual(3); expect(n).not.toMatch(/puzzle|level|\d/i); }
  });
  it('blurbs are one short sentence or two, within about 60 characters', () => {
    for (const s of CAMPAIGN) expect(s.blurb?.length ?? 0, s.name).toBeLessThanOrEqual(60);
  });
  it("each biome's first level teaches its twist in at most 3 moves, and the Finale runs 5-7", () => {
    for (const [i, s] of CAMPAIGN.entries()) if (i > 0 && biomes[i] !== biomes[i - 1] && biomes[i] !== 'finale') expect(s.expectPar, s.name).toBeLessThanOrEqual(3);
    for (const s of CAMPAIGN.filter(x => x.biome === 'finale')) { expect(s.expectPar).toBeGreaterThanOrEqual(5); expect(s.expectPar).toBeLessThanOrEqual(7); }
  });
});
