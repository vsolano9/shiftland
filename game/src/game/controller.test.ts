import { describe, expect, it } from 'vitest';
import { fromJson, solve, type Dir, type LevelJson } from '../rules/rules';
import { Controller, type GameEvent } from './controller';
import { Progress, type StorageLike } from './progress';
import levels from '../levels/levels.json';

const all = (levels as LevelJson[]).map(fromJson);
const mem = (): StorageLike => { const m = new Map<string, string>(); return { getItem: k => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v) }; };
const make = (storage = mem()) => {
  const events: GameEvent[] = [];
  const c = new Controller(all, new Progress(all.map(l => l.name!), storage), undefined, e => events.push(e));
  return { c, events, storage };
};
const DIRS: Record<string, Dir> = { N: 0, E: 1, S: 2, W: 3 };
const playSolution = (c: Controller) => {
  for (const m of solve(c.session.lv, 6)!.firstSolution) c.act({ kind: 'move', plate: Number(m[1]), dir: DIRS[m[2]] });
};

describe('Controller', () => {
  it('opens the first level and refuses locked ones', () => {
    const { c, events } = make();
    expect([c.index, events[0]]).toEqual([0, { kind: 'level', index: 0 }]);
    expect(c.open(1)).toBe(false);
  });
  it('a full run: every level solved in order at par, Enter advances, the last Enter finishes', () => {
    const { c, events } = make();
    for (let i = 0; i < all.length; i++) {
      expect(c.index).toBe(i);
      playSolution(c);
      expect(c.session.solved).toBe(true);
      c.act({ kind: 'next' });
    }
    expect(events.filter(e => e.kind === 'solved').every(e => e.kind === 'solved' && e.stars === 1)).toBe(true);
    expect(events.at(-1)).toEqual({ kind: 'finished' });
    expect(c.progress.totalStars()).toBe(all.length);
  });
  it('progress survives a reload: a new controller resumes at the first unsolved level', () => {
    const a = make(); playSolution(a.c); a.c.act({ kind: 'next' }); playSolution(a.c);
    const b = make(a.storage);
    expect(b.c.index).toBe(2);
  });
  it('Enter before solving does nothing; blocked and wrong-axis moves emit feedback, not moves', () => {
    const { c, events } = make(); events.length = 0;
    c.act({ kind: 'next' });
    c.act({ kind: 'wrong-axis', plate: 0 });
    c.act({ kind: 'move', plate: 0, dir: 3 }); c.act({ kind: 'move', plate: 0, dir: 3 }); c.act({ kind: 'move', plate: 0, dir: 3 });
    expect(events.map(e => e.kind)).toEqual(['selected', 'wrong-axis', 'moved', 'blocked', 'blocked']); // one stop W, then refused
    expect([c.index, c.session.moves]).toEqual([0, 1]);
  });
  it('drag: commits stops as the pointer crosses them, strains at a refused stop, stops at solve', () => {
    const { c, events } = make(); events.length = 0;
    expect(c.drag(0, -0.3, 0.4)).toEqual([-0.3, 0.4]);              // under the snap: nothing yet
    const left = c.drag(0, -2.4, 0);                                  // one stop W, then refused (see above)
    expect(c.session.moves).toBe(1);
    expect(left[0]).toBeCloseTo(-0.99);
    expect(events.map(e => e.kind)).toEqual(['selected', 'moved', 'blocked']);
    for (let i = 0; i < 10; i++) c.drag(0, -0.99 - i * 0.01, 0);    // held against the rail end: no shake per frame
    expect(events.filter(e => e.kind === 'blocked').length).toBe(1);
    c.drag(0, -0.2, 0); c.drag(0, -0.8, 0);                          // eased off, pushed again: one more shake
    expect(events.filter(e => e.kind === 'blocked').length).toBe(2);
    c.dragEnd(); c.drag(0, -0.8, 0);                                 // a new drag strains anew
    expect(events.filter(e => e.kind === 'blocked').length).toBe(3);
    c.act({ kind: 'restart' });
    c.drag(0, 1.7, 0);                                                // First Peak P0E solves; the rest of the drag is ignored
    expect([c.session.solved, c.session.moves]).toEqual([true, 1]);
  });
  it('undo and restart', () => {
    const { c, events } = make();
    c.act({ kind: 'move', plate: 0, dir: 3 });
    events.length = 0;
    c.act({ kind: 'undo' }); c.act({ kind: 'undo' });
    expect(events).toEqual([{ kind: 'undone' }]);
    c.act({ kind: 'move', plate: 0, dir: 3 }); c.act({ kind: 'restart' });
    expect([c.session.moves, c.selected]).toEqual([0, null]);
  });
});
