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
  it('unlocks in order and opens the first unsolved level', () => {
    const p = new Progress(names, new Mem());
    expect([0, 1, 2].map(i => p.unlocked(i))).toEqual([true, false, false]);
    p.complete(0, 1, 1);
    expect([0, 1, 2].map(i => p.unlocked(i))).toEqual([true, true, false]);
    expect(p.next()).toBe(1);
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
    const p = new Progress(['New Intro', ...names], s);
    expect(p.solved(2)).toBe(true);
    expect(p.unlocked(1)).toBe(false);
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
    for (const bad of ['{', '"x"', '{"v":2,"levels":{}}', 'null']) {
      const s = new Mem(); s.setItem(KEY, bad);
      expect(new Progress(names, s).next()).toBe(0);
    }
  });
  it('all solved: Play opens the last level', () => {
    const p = new Progress(names, new Mem());
    names.forEach((_, i) => p.complete(i, 1, 0));
    expect(p.next()).toBe(2);
  });
});
