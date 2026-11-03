import { describe, expect, it } from 'vitest';
import { fromJson, goalsMet, shift, type LevelJson } from '../rules/rules';
import { audit } from './audit';
import { generate } from './generate';
import levels from '../../../spikes/plates/levels.json';

describe('generator', () => {
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
