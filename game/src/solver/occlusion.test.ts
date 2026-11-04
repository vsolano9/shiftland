import { describe, expect, it } from 'vitest';
import levels from '../levels/levels.json' with { type: 'json' };
import { CAMPAIGN } from '../levels/campaign.ts';
import { parse } from '../levels/tutorial.ts';
import { fromJson, type LevelJson } from '../rules/rules.ts';
import { applyAll } from './audit.ts';
import { cameraOf, hiddenOn, LANDSCAPE, LANDSCAPE_SOLVED, MOSTLY, PHONE, plateSightOf, sightOf, SOLVED_SCREENS } from './occlusion.ts';

const all = (levels as LevelJson[]).map(fromJson);

describe('what the fixed camera can see', () => {
  it('nothing on any board a shipped level leads the player past is mostly hidden, unless its spec says why', () => {
    for (const spec of CAMPAIGN) {
      if (spec.hiddenOk) continue;
      const lv = all.find(l => l.name === spec.name)!, line = spec.fixture!.intended.split(' ');
      const boards = [lv.start, ...line.map((_, k) => applyAll(lv, lv.start, line.slice(0, k + 1))!)];
      if (spec.fixture!.trap) boards.push(applyAll(lv, lv.start, [spec.fixture!.trap.move])!);
      expect([spec.name, ...boards.flatMap((s, k) => hiddenOn(lv, s, `board ${k}`))]).toEqual([spec.name]);
      expect([spec.name, ...hiddenOn(lv, boards[line.length], 'solved', SOLVED_SCREENS)]).toEqual([spec.name]);
    }
  });

  it('the upright phone stands further back than the wide screen, so it is checked as its own camera', () => {
    const lv = all.find(l => l.name === 'The Summit')!;
    const far = (screen: typeof LANDSCAPE) => { const c = cameraOf(lv, screen); return Math.hypot(c.x, c.y, c.z); };
    expect(far(PHONE)).toBeGreaterThan(far(LANDSCAPE) * 1.2);
  });

  it('the solved panel shifts the board and that turns the lens: Salt Point with land beside its buoy fails only there', () => {
    // From the middle of the screen this buoy measured a third hidden; a capture beside the solved panel showed a sliver of it.
    const spec = CAMPAIGN.find(s => s.name === 'Salt Point')!;
    expect(spec.map).toContain('a0 a0 ~  c0*');
    const lv = parse({ ...spec, map: spec.map.replace('a0 a0 ~  c0*', 'a0 a0 a0 c0*') });
    const end = applyAll(lv, lv.start, spec.fixture!.intended.split(' '))!;
    const buoy = (screen: typeof LANDSCAPE) => sightOf(lv, end, screen).find(v => v.who === 'buoy')!.share;
    expect(buoy(LANDSCAPE)).toBeLessThan(MOSTLY);
    expect(buoy(LANDSCAPE_SOLVED)).toBeGreaterThanOrEqual(MOSTLY);
  });

  it('catches a plate hiding behind a ridge, and says which', () => {
    const base = all.find(l => l.name === 'First Peak')!;
    const w = 7, h = 7, plate = new Int8Array(w * h).fill(-1), elev = new Int8Array(w * h);
    plate[3 + 3 * w] = 1; // one flat cell of plate b, with a tall plate a to the south and east of it
    for (const c of [4 + 3 * w, 3 + 4 * w, 4 + 4 * w]) { plate[c] = 0; elev[c] = 3; }
    const lv = { ...base, w, h, plates: 2, buoys: [], axis: [1, 1], pinned: undefined, start: { plate, elev, objs: [], ice: undefined } };
    expect(plateSightOf(lv as never, lv.start as never).find(v => v.plate === 1)!.share).toBeGreaterThanOrEqual(MOSTLY);
    expect(hiddenOn(lv as never, lv.start as never, 'start').join()).toMatch(/plate b is \d+% hidden/);
    expect(plateSightOf(lv as never, lv.start as never).find(v => v.plate === 0)!.share).toBeLessThan(MOSTLY);
  });

  it('every hiddenOk carries a written reason', () => {
    for (const spec of CAMPAIGN) if (spec.hiddenOk !== undefined) expect(spec.hiddenOk.length).toBeGreaterThan(20);
  });

  it('catches a buoy right behind a tall cliff, and lets the same buoy go when the cliff is on its far side', () => {
    const base = all.find(l => l.name === 'First Peak')!;
    const w = 7, h = 7, plate = new Int8Array(w * h).fill(-1), elev = new Int8Array(w * h);
    const buoy = 3 + 3 * w;
    // the camera looks from the south-east: cells to the south and east of the buoy stand between it and the lens
    const near = [4 + 3 * w, 3 + 4 * w, 4 + 4 * w];
    for (const c of near) { plate[c] = 0; elev[c] = 3; }
    const lv = { ...base, w, h, plates: 1, buoys: [buoy], axis: [1], pinned: undefined, start: { plate, elev, objs: [], ice: undefined } };
    const hidden = sightOf(lv as never, lv.start as never).find(v => v.who === 'buoy')!;
    expect(hidden.land).toBeGreaterThanOrEqual(MOSTLY);
    expect(hiddenOn(lv as never, lv.start as never, 'start').join()).toMatch(/buoy at 3,3/);

    const plate2 = new Int8Array(w * h).fill(-1), elev2 = new Int8Array(w * h);
    for (const c of [2 + 3 * w, 3 + 2 * w, 2 + 2 * w]) { plate2[c] = 0; elev2[c] = 3; }
    const lv2 = { ...lv, start: { plate: plate2, elev: elev2, objs: [], ice: undefined } };
    expect(hiddenOn(lv2 as never, lv2.start as never, 'start')).toEqual([]);
  });

  it('counts other creatures as cover, not only land', () => {
    const base = all.find(l => l.name === 'First Peak')!;
    const w = 7, h = 7, plate = new Int8Array(w * h).fill(-1), elev = new Int8Array(w * h);
    const buoy = 3 + 3 * w, house = 4 + 4 * w;
    plate[house] = 0;
    const lv = { ...base, w, h, plates: 1, buoys: [buoy], axis: [1], pinned: undefined, start: { plate, elev, objs: [{ kind: 'village', cell: house }], ice: undefined } };
    const v = sightOf(lv as never, lv.start as never).find(s => s.who === 'buoy')!;
    expect(v.creature).toBeGreaterThan(0);
  });
});
