// One level being played: the pure core the render and input layers call (docs/PLAN.md Nov 6). No DOM, no three.js.
// - History is a stack of immutable States; undo pops, restart returns to the start (undo after restart is not needed:
//   restart is one keypress away from any state and the grey-box never wanted it).
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
  get par(): number | undefined { return this.lv.par; }
  get solved(): boolean { return solved(this.lv, this.state); }
  get goals(): boolean[] { return goalsMet(this.lv, this.state); }
  /** 1 star for finishing at or under par, 0 otherwise (stars are never required: design-plates.md) */
  get stars(): number { return this.solved && this.par !== undefined && this.moves <= this.par ? 1 : 0; }

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
    this.afterChange();
    return { ok: true, solved: this.solved };
  }

  undo(): boolean {
    if (this.history.length <= 1) return false;
    this.history.pop();
    this.afterChange();
    return true;
  }

  restart() {
    this.history = [this.lv.start];
    this.stuck = false;
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
