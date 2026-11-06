import { describe, expect, it } from 'vitest';
import { KEY, Progress, type StorageLike } from './progress';

class Mem implements StorageLike {
  m = new Map<string, string>();
  getItem(k: string) { return this.m.get(k) ?? null; }
  setItem(k: string, v: string) { this.m.set(k, v); }
}
class Broken implements StorageLike {
  getItem(): string | null { throw new Error('SecurityError'); }
  setItem() { throw new Error('QuotaExceededError'); }
}
const names = ['First Peak', 'Open Water', 'Mind the Village'];

describe('Progress', () => {
  it('tutorials unlock strictly in order and Play opens the first unsolved level', () => {
    const p = new Progress(names, new Mem(), 3);
    expect([0, 1, 2].map(i => p.unlocked(i))).toEqual([true, false, false]);
    p.complete(0, 1, 1);
    expect([0, 1, 2].map(i => p.unlocked(i))).toEqual([true, true, false]);
    expect(p.next()).toBe(1);
  });
  it('after the tutorials, two unsolved levels are always open (one hard puzzle can be skipped)', () => {
    const six = ['T1', 'T2', 'P1', 'P2', 'P3', 'P4'];
    const p = new Progress(six, new Mem(), 2);
    const open = () => six.map((_, i) => p.unlocked(i));
    expect(open()).toEqual([true, false, false, false, false, false]);
    p.complete(0, 1, 0);
    expect(open()).toEqual([true, true, false, false, false, false]);  // tutorials stay strict
    p.complete(1, 1, 0);
    expect(open()).toEqual([true, true, true, true, false, false]);    // P1 and P2 both open
    p.complete(3, 2, 0);                                               // stuck on P1, solved P2
    expect(open()).toEqual([true, true, true, true, true, false]);     // P3 opens; still two unsolved open
    expect(p.next()).toBe(2);                                          // Play returns to the skipped puzzle
  });
  it('a teaching island further along cannot be skipped, a puzzle can', () => {
    const six = ['T1', 'P1', 'T2', 'P2', 'P3', 'P4'];
    const p = new Progress(six, new Mem(), 1, [0, 2]);
    p.complete(0, 1, 0);
    expect(p.unlocked(2)).toBe(true);   // P1 skipped: T2 is one of the two open
    expect(p.unlocked(3)).toBe(false);  // T2 still unsolved
    p.complete(2, 1, 0);                // T2 done, P1 still skipped
    expect(p.unlocked(3)).toBe(true);
    expect(p.unlocked(1)).toBe(true);
  });
  it('tutorialCount: the leading run of tutorial levels', async () => {
    const { tutorialCount } = await import('./progress');
    expect(tutorialCount([{ role: 'tutorial' }, { role: 'tutorial' }, { role: 'puzzle' }, { role: 'tutorial' }])).toBe(2);
    expect(tutorialCount([{ role: 'puzzle' }])).toBe(0);
    expect(tutorialCount([{ role: 'tutorial' }])).toBe(1);
  });
  it('survives a reload and keeps the best result', () => {
    const s = new Mem();
    const a = new Progress(names, s);
    a.complete(0, 3, 0); a.complete(0, 1, 1); a.complete(0, 2, 0);
    const b = new Progress(names, s);
    expect(b.record('First Peak')).toEqual({ solved: true, best: 1, stars: 1 });
    expect(b.totalStars()).toBe(1);
  });
  it('is keyed by name, so inserting a level keeps old records', () => {
    const s = new Mem();
    new Progress(names, s).complete(1, 2, 1);
    const p = new Progress(['New Intro', ...names], s, 4);
    expect(p.solved(2)).toBe(true);
    expect(p.unlocked(1)).toBe(false);
    expect(p.unlocked(3)).toBe(true);
  });
  it('an island you solved stays open when an update adds an unsolved teacher before it', () => {
    const s = new Mem();
    const old = new Progress(['a', 'c', 'd'], s);
    old.complete(0, 1, 1); old.complete(1, 1, 1); old.complete(2, 1, 1);
    const p = new Progress(['a', 'b', 'c', 'd'], s, 0, [1]);
    expect(p.unlocked(1)).toBe(true); // the new island
    expect(p.unlocked(2)).toBe(true); // solved before the update
    expect(p.unlocked(3)).toBe(true);
    expect(p.next()).toBe(1); // Play goes to the new one
  });
  it('blocked storage: the game still starts and plays in memory', () => {
    const p = new Progress(names, new Broken());
    expect(p.unlocked(0)).toBe(true);
    p.complete(0, 1, 1);
    expect(p.unlocked(1)).toBe(true);
    expect(p.persistent).toBe(false);
    const none = new Progress(names, null);
    expect([none.persistent, none.next()]).toEqual([false, 0]);
  });
  it('corrupt or foreign data starts fresh', () => {
    for (const bad of ['{', '"x"', '{"v":2,"levels":{}}', 'null', '{"v":1,"levels":[]}',
      '{"v":1,"levels":{"First Peak":null}}', '{"v":1,"levels":{"First Peak":{"solved":"yes","best":1,"stars":1}}}',
      '{"v":1,"levels":{"First Peak":{"solved":true,"best":"1","stars":1}}}']) {
      const s = new Mem(); s.setItem(KEY, bad);
      const p = new Progress(names, s);
      expect(p.next()).toBe(0);
      p.complete(0, 1, 1);                                           // and a save after it survives a reload
      expect(new Progress(names, s).solved(0)).toBe(true);
    }
  });
  it('all solved: Play opens the last level', () => {
    const p = new Progress(names, new Mem());
    names.forEach((_, i) => p.complete(i, 1, 0));
    expect(p.next()).toBe(2);
  });
});
