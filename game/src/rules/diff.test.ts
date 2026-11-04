import { describe, expect, it } from 'vitest';
import { fromJson, shift, type Dir, type LevelJson } from './rules';
import { previewDiff } from './diff';
import levels from '../levels/levels.json';

// First Peak (7x5): plate 0 = cells 9,15,16,23; plate 1 = cells 10,11,17,18,19,24,25 (heights 0,0,1,0,0,1,0); goat on 17.
const named = (n: string) => fromJson((levels as LevelJson[]).find(l => l.name === n)!);
const fp = named('First Peak');
const after = (p: number, d: Dir) => shift(fp, fp.start, p, d)!;

describe('previewDiff (Codex chain 4: every visible change is in the preview)', () => {
  it('land moving onto water is marked where it arrives (First Peak P0W)', () => {
    const d = previewDiff(fp, fp.start, after(0, 3));
    expect(d.arrive).toEqual([8, 14, 22]);
    expect(d.flood).toEqual([9, 16, 23]);
    expect(d.rise).toEqual([]);
    expect(d.moved).toEqual([]);
    expect(d.melt).toEqual([]);
  });

  it('a creature riding its plate shows its destination (First Peak P1E: goat 17 -> 18)', () => {
    const d = previewDiff(fp, fp.start, after(1, 1));
    expect(d.moved).toEqual([[0, 17, 18]]);
    expect(d.rise).toEqual([]); // the plate's own height-1 cells slide to 18 and 25: not uplift...
    expect(d.carry).toEqual([[18, 1], [25, 1]]); // ...but carried terrain, so the preview still shows the new height
    expect(d.arrive).toEqual([12, 20, 26]);
    expect(d.flood).toEqual([10, 17, 24]);
  });

  it('a peak carried along its own plate shows its new cells (Codex chain 4 round 2: Stolen Peak, P0E then P0W)', () => {
    const peak = named('Stolen Peak');
    const s = shift(peak, peak.start, 0, 1)!;
    const t = shift(peak, s, 0, 3)!;
    const d = previewDiff(peak, s, t);
    expect(d.rise).toEqual([]);
    expect(d.carry.filter(([, h]) => h >= 2)).toHaveLength(1); // the goat's stolen peak
    for (const [i, h] of d.carry) expect(t.elev[i]).toBe(h);
  });

  it('a push marks the risen cells with their new height and the goal that flips (First Peak P0E)', () => {
    const b = after(0, 1);
    const d = previewDiff(fp, fp.start, b);
    expect(d.rise).toEqual([[10, 1], [17, 2], [24, 2]]);
    expect(d.arrive).toEqual([10, 17, 24]);
    expect(d.flips).toEqual([[0, true]]); // the goat gets its peak: First Peak is solved by P0E
  });

  it('ice lifted to a peak melts where it stood (Thin Ice P0E: the whole ice wall, and those cells flood)', () => {
    const ice = named('Thin Ice');
    const d = previewDiff(ice, ice.start, shift(ice, ice.start, 0, 1)!);
    expect(d.melt).toEqual([12, 20, 28]);
    for (const c of d.melt) expect(d.flood).toContain(c);
    expect(d.rise).toEqual([]); // nothing visibly rises: the cells that would have are gone
    expect(d.flips).toEqual([[0, true]]); // the penguin sees the sea
  });
});
