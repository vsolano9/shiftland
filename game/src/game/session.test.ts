import { describe, expect, it } from 'vitest';
import { canFinish, fromJson, solve, type Dir, type Level, type LevelJson, type State } from '../rules/rules';
import { Session, type StuckPort } from './session';
import levels from '../levels/levels.json';

const all = (levels as LevelJson[]).map(fromJson);
const byName = (n: string) => all.find(l => l.name === n)!;
const DIRS: Record<string, Dir> = { N: 0, E: 1, S: 2, W: 3 };
const play = (s: Session, seq: string) => seq.split(' ').map(m => s.move(Number(m[1]), DIRS[m[2]]));

// Synchronous stand-in for the worker: answers immediately through the session's setStuck.
class SyncStuck implements StuckPort {
  checks = 0; cancels = 0; session?: Session;
  check(lv: Level, s: State) { this.checks++; this.session!.setStuck(canFinish(lv, s) === false); }
  cancel() { this.cancels++; }
}

describe('Session plays every shipped level', () => {
  for (const lv of all) {
    it(`${lv.name}: the solver's solution finishes at par with the star`, () => {
      const s = new Session(lv);
      const sol = solve(lv, 6)!.firstSolution.join(' ');
      expect(play(s, sol).every(r => r.ok)).toBe(true);
      expect([s.solved, s.moves, s.stars]).toEqual([true, lv.par, 1]);
    });
  }
});

describe('Session', () => {
  it('counts moves, solves at par and gives the star (First Peak P0E)', () => {
    const s = new Session(byName('First Peak'));
    expect(s.moves).toBe(0);
    expect(s.move(0, 1)).toEqual({ ok: true, solved: true });
    expect([s.moves, s.solved, s.stars]).toEqual([1, true, 1]);
    expect(s.move(1, 1)).toEqual({ ok: false, reason: 'already solved' });
  });

  it('solving over par gives no star', () => {
    const s = new Session(byName('Open Water')); // par 1 via P0W; its trap P1E, then P0W, finishes in 2
    play(s, 'P1E P0W');
    expect([s.solved, s.moves, s.stars]).toEqual([true, 2, 0]);
  });

  it('a blocked move changes nothing', () => {
    const s = new Session(byName('First Peak'));
    expect(s.move(0, 0)).toEqual({ ok: false, reason: 'blocked' }); // plate 0 rides E/W only
    expect(s.moves).toBe(0);
  });

  it('undo and restart return to earlier states', () => {
    const lv = byName("Shepherd's Hill");
    const s = new Session(lv);
    expect(play(s, 'P0W P1W').every(r => r.ok)).toBe(true);
    expect(s.moves).toBe(2);
    expect(s.undo()).toBe(true);
    expect(s.moves).toBe(1);
    s.restart();
    expect(s.moves).toBe(0);
    expect(s.state).toBe(lv.start);
    expect(s.undo()).toBe(false);
  });

  it('preview does not commit and returns the diff', () => {
    const s = new Session(byName('First Peak'));
    const p = s.preview(1, 1)!;
    expect(p.diff.moved).toEqual([[0, 17, 18]]);
    expect(s.moves).toBe(0);
    expect(s.preview(0, 0)).toBeNull();
  });

  it('asks the stuck checker after each change, warns on a proven dead end, clears on undo', () => {
    const port = new SyncStuck();
    const s = new Session(byName('Village Green'), port); port.session = s;
    s.move(0, 1); // the crushing push
    expect(s.stuck).toBe(true);
    s.undo();
    expect(s.stuck).toBe(false);
    expect(port.checks).toBe(2);
    s.restart();
    expect(port.cancels).toBeGreaterThanOrEqual(2); // constructor + restart
  });

  it('a solved level never shows the warning and cancels pending checks', () => {
    const port = new SyncStuck();
    const s = new Session(byName('First Peak'), port); port.session = s;
    const before = port.cancels;
    s.move(0, 1);
    expect(port.checks).toBe(0);
    expect(port.cancels).toBe(before + 1);
    s.setStuck(true); // a late answer
    expect(s.stuck).toBe(false);
  });
});
