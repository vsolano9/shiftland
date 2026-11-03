import { describe, expect, it } from 'vitest';
import { fromJson, goalsMet, shift, type LevelJson } from '../rules/rules';
import { audit } from './audit';
import { generate } from './generate';
import levels from '../levels/levels.json';

describe('generator', () => {
  it('oasis option adds exactly one oasis on free land and leaves the rest of the seed unchanged', () => {
    for (const seed of [3, 25, 56, 140]) {
      const plain = generate(seed, { place: true }), desert = generate(seed, { place: true, oasis: true });
      const extra = desert.start.objs.slice(plain.start.objs.length);
      expect(desert.start.objs.slice(0, plain.start.objs.length)).toEqual(plain.start.objs);
      expect(extra.map(o => o.kind)).toEqual(['oasis']);
      expect(desert.start.plate[extra[0].cell]).toBeGreaterThanOrEqual(0);
      expect([...plain.start.objs.map(o => o.cell), ...plain.buoys]).not.toContain(extra[0].cell);
      expect(Array.from(desert.start.plate)).toEqual(Array.from(plain.start.plate));
    }
  });

  it('is deterministic per seed', () => {
    expect(generate(7, { place: true })).toEqual(generate(7, { place: true }));
  });

  it('matches the spike: the exported generated levels regenerate cell for cell', () => {
    // Dip and Return is seed 56, 6x5, 2 plates, seam placement (spikes/plates/tutorial.ts)
    const dip = (levels as LevelJson[]).find(l => l.name === 'Dip and Return')!;
    const g = generate(56, { w: 6, h: 5, plates: 2, place: true });
    expect(Array.from(g.start.plate)).toEqual(dip.plate);
    expect(Array.from(g.start.elev)).toEqual(dip.elev);
    expect(g.start.objs).toEqual(dip.objs);
    expect(g.buoys).toEqual(dip.buoys);
    expect(g.axis).toEqual(dip.axis);
    expect(fromJson(dip).par).toBe(3);
  });

  it('seed 25 (no seam placement): a move that ticks one goal while unticking another still counts as tempting', () => {
    // Codex review chain 2 regression; P1N turns [F,T,T,F] into [F,T,F,T] and leaves no finish within 6.
    const lv = generate(25);
    const t = shift(lv, lv.start, 1, 0)!;
    expect(goalsMet(lv, lv.start)).toEqual([false, true, true, false]);
    expect(goalsMet(lv, t)).toEqual([false, true, false, true]);
    expect(audit(lv)!.tempting?.move).toBe('P1N');
  });
});
