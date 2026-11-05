// One level being played: the pure core the render and input layers call (docs/PLAN.md Nov 6). No DOM, no three.js.
// - History is a stack of immutable States; undo pops, restart returns to the start, and an Undo straight after a restart
//   brings the whole run back: one mistap beside Undo must not cost a player's progress (phone playtest PH4).
// - preview(p, d) gives the next State and its MoveDiff without committing, for the diff-only preview (design audit S1).
// - Every committed move, undo and restart asks the stuck checker about the new state; the checker drops stale answers.
import { previewDiff, type MoveDiff } from '../rules/diff.ts';
import { goalsMet, shift, solved, type Dir, type Level, type State } from '../rules/rules.ts';

export interface StuckPort { check(lv: Level, s: State): void; cancel(): void }

export type MoveResult = { ok: true; solved: boolean } | { ok: false; reason: 'blocked' | 'already solved' };

export class Session {
  private history: State[];
  stuck = false;

  constructor(readonly lv: Level, private stuckPort?: StuckPort) {
    this.history = [lv.start];
    stuckPort?.cancel();
  }

  get state(): State { return this.history[this.history.length - 1]; }
  get moves(): number { return this.history.length - 1; }
  /** The board before the last move, or undefined at the start. */
  get previous(): State | undefined { return this.history[this.history.length - 2]; }
  get par(): number | undefined { return this.lv.par; }
  get solved(): boolean { return solved(this.lv, this.state); }
  get goals(): boolean[] { return goalsMet(this.lv, this.state); }
  /** The player asked to be shown a whole move this run. Restart clears it. */
  hinted = false;
  /** 1 star for finishing at or under par without being shown a move, 0 otherwise (stars are never required: design-plates.md) */
  get stars(): number { return this.solved && !this.hinted && this.par !== undefined && this.moves <= this.par ? 1 : 0; }

  preview(p: number, d: Dir): { next: State; diff: MoveDiff } | null {
    if (this.solved) return null;
    const next = shift(this.lv, this.state, p, d);
    return next ? { next, diff: previewDiff(this.lv, this.state, next) } : null;
  }

  move(p: number, d: Dir): MoveResult {
    if (this.solved) return { ok: false, reason: 'already solved' };
    const next = shift(this.lv, this.state, p, d);
    if (!next) return { ok: false, reason: 'blocked' };
    this.history.push(next);
    this.log.push(p * 4 + d);
    this.lastRun = null;
    this.afterChange();
    return { ok: true, solved: this.solved };
  }

  undo(): boolean {
    if (this.history.length <= 1) {
      if (!this.lastRun) return false;
      this.history = this.lastRun.history; this.log = this.lastRun.log; this.hinted = this.lastRun.hinted; this.lastRun = null;
      this.afterChange();
      return true;
    }
    this.history.pop();
    this.log.pop();
    this.afterChange();
    return true;
  }

  private lastRun: { history: State[]; log: number[]; hinted: boolean } | null = null;
  get canUndo() { return this.history.length > 1 || this.lastRun !== null; }

  /** The run so far, as plate * 4 + direction per move: what a reload needs to bring it back. */
  log: number[] = [];
  /** Replays a saved run. Anything that no longer plays (the level changed since), or that already finishes it, leaves a fresh start and returns false. */
  resume(log: number[], hinted: boolean): boolean {
    let s = this.lv.start;
    const history = [s];
    for (const m of log) {
      const next = Number.isInteger(m) && m >= 0 ? shift(this.lv, s, m >> 2, (m & 3) as Dir) : null;
      if (!next) return false;
      history.push(s = next);
    }
    if (log.length === 0 || solved(this.lv, s)) return false;
    this.history = history; this.log = [...log]; this.hinted = hinted;
    this.afterChange();
    return true;
  }

  restart() {
    // a solved run is finished, and an empty one has nothing to bring back
    this.lastRun = this.moves > 0 && !this.solved ? { history: this.history, log: this.log, hinted: this.hinted } : null;
    this.history = [this.lv.start];
    this.log = [];
    this.stuck = false;
    this.hinted = false;
    this.stuckPort?.cancel();
  }

  /** Called by the stuck checker's callback; ignored once the level is solved. */
  setStuck(stuck: boolean) { this.stuck = stuck && !this.solved; }

  private afterChange() {
    this.stuck = false;
    if (this.solved) { this.stuckPort?.cancel(); return; }
    this.stuckPort?.check(this.lv, this.state);
  }
}
