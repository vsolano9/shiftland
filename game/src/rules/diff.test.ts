import { describe, expect, it } from 'vitest';
import { fromJson, shift, type Dir, type LevelJson } from './rules';
import { previewDiff } from './diff';
import levels from '../../../spikes/plates/levels.json';

// First Peak (6x4): plate 0 = cells 7,8,13,14; plate 1 = cells 9,10,15,16 (heights 1,0,1,0); goat on 9.
const fp = fromJson((levels as LevelJson[]).find(l => l.name === 'First Peak')!);
const after = (p: number, d: Dir) => shift(fp, fp.start, p, d)!;

describe('previewDiff (Codex chain 4: every visible change is in the preview)', () => {
  it('land moving onto water is marked where it arrives (First Peak P0W)', () => {
    const d = previewDiff(fp, fp.start, after(0, 3));
    expect(d.arrive).toEqual([6, 12]);
    expect(d.flood).toEqual([8, 14]);
    expect(d.rise).toEqual([]);
    expect(d.moved).toEqual([]);
  });

  it('a creature riding its plate shows its destination (First Peak P1E: goat 9 -> 10)', () => {
    const d = previewDiff(fp, fp.start, after(1, 1));
    expect(d.moved).toEqual([[0, 9, 10]]);
    expect(d.rise).toEqual([]); // the plate's own height-1 cells slide to 10 and 16: not uplift
    expect(d.arrive).toEqual([11, 17]);
    expect(d.flood).toEqual([9, 15]);
  });

  it('a push marks the risen cells with their new height and the goal that flips (First Peak P0E)', () => {
    const b = after(0, 1);
    const d = previewDiff(fp, fp.start, b);
    expect(d.rise).toEqual([[9, 2], [15, 2]]);
    expect(d.arrive).toEqual([9, 15]);
    expect(d.flips).toEqual([[0, true]]); // the goat gets its peak: First Peak is solved by P0E
  });
});
