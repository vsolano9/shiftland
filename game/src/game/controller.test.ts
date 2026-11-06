import { describe, expect, it } from 'vitest';
import { fromJson, solve, type Dir, type LevelJson } from '../rules/rules';
import { Controller, type GameEvent } from './controller';
import { Progress, tutorialCount, type StorageLike } from './progress';
import levels from '../levels/levels.json';

const all = (levels as LevelJson[]).map(fromJson);
const mem = (): StorageLike => { const m = new Map<string, string>(); return { getItem: k => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v) }; };
const make = (storage = mem()) => {
  const events: GameEvent[] = [];
  const c = new Controller(all, new Progress(all.map(l => l.name!), storage, tutorialCount(all)), undefined, e => events.push(e));
  return { c, events, storage };
};
const DIRS: Record<string, Dir> = { N: 0, E: 1, S: 2, W: 3 };
describe('an update that adds an island', () => {
  it('keeps an unfinished run on the island after it (Ferry Lane, Codex review Nov 6)', () => {
    const storage = mem(), names = all.map(l => l.name!), at = names.indexOf('Harbour Row');
    const levels: Record<string, unknown> = {};
    for (let k = 0; k < at - 1; k++) levels[names[k]] = { solved: true, best: 1, stars: 1 }; // everything before Ferry Lane, as the 25-island build left it
    storage.setItem('shiftland.progress.v1', JSON.stringify({ v: 1, levels }));
    const m = all[at].sol![0], log = [Number(m[1]) << 2 | DIRS[m[2]]];
    storage.setItem('shiftland.run.v1', JSON.stringify({ name: 'Harbour Row', log, hinted: false }));
    const { c } = make(storage);
    expect(c.index).toBe(at);
    expect(c.resumed).toBe(true);
    expect(c.session.moves).toBe(1);
    expect(JSON.parse(storage.getItem('shiftland.run.v1')!).name).toBe('Harbour Row');
  });
});
describe('a run survives a reload', () => {
  const unlockedTo = (storage: StorageLike, i: number) => { const a = make(storage).c; for (let k = 0; k < i; k++) { a.open(k); playSolution(a); } };
  const at = 'Good Neighbours', index = all.findIndex(l => l.name === at);
  it('comes back on the same island with its moves, undo and hint', () => {
    const storage = mem();
    unlockedTo(storage, index);
    const a = make(storage).c;
    a.open(index);
    a.session.hinted = true;
    a.act({ kind: 'move', plate: 0, dir: 3 });
    const b = make(storage).c;
    expect([b.index, b.session.moves, b.session.hinted, b.resumed]).toEqual([index, 1, true, true]);
    expect(b.session.state.plate).toEqual(a.session.state.plate);
    b.act({ kind: 'undo' });
    expect(make(storage).c.session.moves).toBe(0);
  });
  it('is forgotten on Restart, on a solve, and when it no longer plays', () => {
    const storage = mem();
    unlockedTo(storage, index);
    const a = make(storage).c;
    a.open(index);
    a.act({ kind: 'move', plate: 0, dir: 3 });
    a.act({ kind: 'restart' });
    expect(make(storage).c.resumed).toBe(false);
    a.act({ kind: 'undo' }); // Restart taken back: the run is back too
    expect(make(storage).c.session.moves).toBe(1);
    const c = make(storage).c;
    c.progress.saveRun({ name: at, log: [99 * 4], hinted: false });
    const d = make(storage).c;
    expect([d.resumed, d.session.moves]).toEqual([false, 0]);
    d.open(index);
    playSolution(d);
    const e = make(storage).c;
    expect(e.resumed).toBe(false);
  });
});

const playSolution = (c: Controller) => {
  for (const m of solve(c.session.lv, 7)!.firstSolution) c.act({ kind: 'move', plate: Number(m[1]), dir: DIRS[m[2]] });
};

/** Redo the last move of the solution from the current state (after one undo). */
const playSolution2 = (c: Controller) => {
  const m = solve(c.session.lv, 7)!.firstSolution.at(-1)!;
  c.act({ kind: 'move', plate: Number(m[1]), dir: DIRS[m[2]] });
};

describe('Controller', () => {
  it('opens the first level and refuses locked ones', () => {
    const { c, events } = make();
    expect(tutorialCount(all)).toBeGreaterThan(1); // the shipped tutorials unlock in order
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
  it('a skipped puzzle: Enter on the last level returns to it instead of finishing', () => {
    const { c, events } = make();
    const first = tutorialCount(all);
    for (let i = 0; i < all.length; i++) {
      if (i !== first) playSolution(c);
      if (i === first) c.open(first + 1); else c.act({ kind: 'next' }); // skip the first puzzle
    }
    expect(c.index).toBe(first);
    expect(events.some(e => e.kind === 'finished')).toBe(false);
    playSolution(c); c.act({ kind: 'next' });
    expect(events.at(-1)).toEqual({ kind: 'finished' });
  });
  it('replaying a solved level for its star: Enter goes on in order', () => {
    const { c } = make();
    playSolution(c); c.act({ kind: 'next' }); playSolution(c); // levels 0 and 1 solved, on level 1
    c.open(0); playSolution(c); c.act({ kind: 'next' });
    expect(c.index).toBe(2);                                   // the next unsolved, not the solved level 1
  });
  it('after the ending, a replayed level goes on in order instead of finishing again', () => {
    const { c, events } = make();
    for (let i = 0; i < all.length; i++) {
      playSolution(c);
      if (i === all.length - 1) { c.act({ kind: 'undo' }); expect(c.session.solved).toBe(false); playSolution2(c); }
      c.act({ kind: 'next' });
    }
    expect(events.at(-1)).toEqual({ kind: 'finished' }); // undo + re-solve of the final level keeps the ending
    c.open(3); playSolution(c); c.act({ kind: 'next' });
    expect(c.index).toBe(4);
  });
  it('progress survives a reload: a new controller resumes at the first unsolved level', () => {
    const a = make(); playSolution(a.c); a.c.act({ kind: 'next' }); playSolution(a.c);
    const b = make(a.storage);
    expect(b.c.index).toBe(2);
  });
  it('Enter before solving does nothing; blocked moves emit feedback, not moves', () => {
    const { c, events } = make(); events.length = 0;
    c.act({ kind: 'next' });
    c.act({ kind: 'move', plate: 0, dir: 3 }); c.act({ kind: 'move', plate: 0, dir: 3 }); c.act({ kind: 'move', plate: 0, dir: 3 });
    expect(events.map(e => e.kind)).toEqual(['selected', 'moved', 'blocked', 'blocked']); // one stop W, then refused
    expect([c.index, c.session.moves]).toEqual([0, 1]);
  });
  it('drag previews without committing; release commits; Esc cancels (Codex chain 6 Major 2)', () => {
    const { c, events } = make(); events.length = 0;
    c.drag(0, -0.3, 0.4);                                             // under the snap: no preview
    c.drag(0, -0.7, 0);                                               // one stop W previewed
    expect(c.session.moves).toBe(0);
    c.drag(0, -0.8, 0); c.drag(0, -0.9, 0);                          // same stop: no repeated preview event
    expect(events.map(e => e.kind)).toEqual(['selected', 'preview']);
    c.act({ kind: 'cancel' });                                       // Esc: preview dropped, nothing committed, plate kept
    expect([c.session.moves, c.selected, events.at(-1)]).toEqual([0, 0, { kind: 'preview', plate: 0, steps: 0, diff: null }]);
    c.drag(0, -0.9, 0); c.drag(0, -1.2, 0);                          // pointer still down and moving: stays cancelled
    expect(events.filter(e => e.kind === 'preview').length).toBe(2);
    c.release();                                                      // nothing pending: no-op
    expect(c.session.moves).toBe(0);
    c.drag(0, 0.7, 0); c.act({ kind: 'cancel' }); c.release();       // First Peak P0E would solve: cancelled, not saved
    expect([c.session.solved, c.progress.solved(0)]).toEqual([false, false]);
    c.drag(0, -0.7, 0); c.release();
    expect(c.session.moves).toBe(1);
  });
  it('drag: exactly on the snap point asks for nothing (Codex chain 6 Major 1: W/E oscillation)', () => {
    const { c } = make();
    for (const [dx, dy] of [[0.35, 0], [-0.35, 0], [0, 0.35], [0, -0.35]]) { c.drag(0, dx, dy); c.release(); }
    expect(c.session.moves).toBe(0);
  });
  it('one drag is one stop, however long', () => {
    const { c, events } = make(); events.length = 0;
    c.drag(0, -2.4, 0);
    const prev = events.find(e => e.kind === 'preview');
    expect(prev && prev.kind === 'preview' && prev.steps).toBe(1);
    expect(events.filter(e => e.kind === 'blocked').length).toBe(0);
    c.release();
    expect(c.session.moves).toBe(1);
  });
  it('a drag the rail refuses strains: one shake per push, not per frame', () => {
    const { c, events } = make();
    c.act({ kind: 'move', plate: 0, dir: 3 }); events.length = 0;    // only one stop was legal west
    for (let i = 0; i < 10; i++) c.drag(0, -.8 - i * 0.01, 0);      // held against the rail end
    expect(events.filter(e => e.kind === 'blocked').length).toBe(1);
    c.drag(0, -.2, 0); c.drag(0, -.8, 0);                            // eased off, pushed again: one more shake
    expect(events.filter(e => e.kind === 'blocked').length).toBe(2);
    c.release();
    expect(c.session.moves).toBe(1);
  });
  it('undo or restart during a drag drops the preview, so release commits nothing stale', () => {
    const { c } = make();
    c.act({ kind: 'move', plate: 0, dir: 3 });
    c.drag(0, 0.7, 0); c.act({ kind: 'undo' }); c.release();
    expect(c.session.moves).toBe(0);
    c.drag(0, -0.7, 0); c.act({ kind: 'restart' }); c.release();
    expect(c.session.moves).toBe(0);
  });
  it('a key move during a drag drops the stale preview (First Peak: preview E, press W, release)', () => {
    const { c } = make();
    c.drag(0, 0.7, 0);                                                // E would solve
    c.act({ kind: 'move', plate: 0, dir: 3 });                        // W by keyboard
    c.drag(0, 0.8, 0); c.release();                                   // pointer keeps moving, then lets go
    expect([c.session.moves, c.session.solved]).toEqual([1, false]); // only the key move happened
  });
  it('drag preview stops at a solving stop', () => {
    const { c } = make();
    c.drag(0, 1.7, 0); c.release();                                   // First Peak P0E solves at the first stop
    expect([c.session.solved, c.session.moves]).toEqual([true, 1]);
  });
  it('stuck warning: on from the checker, off again on undo, one event per change', () => {
    const c = new Controller(all, new Progress(all.map(l => l.name!), mem()));
    const events: GameEvent[] = [];
    // open Village Green (index 2) by solving the first two
    playSolution(c); c.act({ kind: 'next' }); playSolution(c); c.act({ kind: 'next' });
    expect(c.session.lv.name).toBe('Village Green');
    (c as unknown as { emit: (e: GameEvent) => void }).emit = e => events.push(e);
    c.act({ kind: 'move', plate: 0, dir: 1 });   // the crushing push
    c.stuckAnswer(true); c.stuckAnswer(true);    // a repeat answer is not a change
    c.act({ kind: 'undo' });
    expect(events.filter(e => e.kind === 'stuck')).toEqual([{ kind: 'stuck', stuck: true }, { kind: 'stuck', stuck: false }]);
    c.drag(0, 0.7, 0); c.release(); c.stuckAnswer(true); c.drag(0, -0.7, 0); c.release(); // via drag: on, then off once
    expect(events.filter(e => e.kind === 'stuck').map(e => e.kind === 'stuck' && e.stuck)).toEqual([true, false, true, false]);
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
