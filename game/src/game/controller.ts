// Game controller (docs/PLAN.md Nov 6): owns the level list, saved progress, the current Session and the selected
// plate, and turns input actions (keys.ts, drag.ts) into state changes plus events for the render/audio layers.
// Pure: no DOM, no three.js. The render layer reads `session`, `selected` and `progress` and reacts to the events.
import type { Level } from '../rules/rules.ts';
import { previewDiff, type MoveDiff } from '../rules/diff.ts';
import { refusal, shift, solved, type Dir, type Refusal, type State } from '../rules/rules.ts';
import { dragStops } from './drag.ts';
import type { KeyAction } from './keys.ts';
import type { Progress, SavedRun } from './progress.ts';
import { Session, type StuckPort } from './session.ts';

export type GameEvent =
  | { kind: 'level'; index: number }                       // a level was opened (restart counts too)
  | { kind: 'selected'; plate: number | null }
  | { kind: 'moved'; plate: number; dir: Dir; at: State }
  | { kind: 'blocked'; plate: number; why: Refusal | null; dir: Dir; at: State } // rail end or a rule refused the move from `at` (shake the plate, say why)
  /** Drag preview of `steps` stops (diff from the current state); steps 0 / diff null clears it. */
  | { kind: 'preview'; plate: number; steps: number; diff: MoveDiff | null }
  | { kind: 'undone' }
  | { kind: 'solved'; moves: number; par?: number; stars: number }
  | { kind: 'stuck'; stuck: boolean }                      // "no way back from here" on/off (undo glows)
  | { kind: 'finished' };                                  // Enter on the last level

export class Controller {
  session!: Session;
  index = 0;
  selected: number | null = null;

  constructor(readonly levels: Level[], readonly progress: Progress, private stuck?: StuckPort,
              private emit: (e: GameEvent) => void = () => {}) {
    // back where the player left off, if that island still plays the same way; otherwise the first unsolved one
    const run = progress.savedRun(), at = run ? levels.findIndex(l => l.name === run.name) : -1;
    if (run && at >= 0 && !progress.solved(at) && this.open(at, run)) {
      if (this.resumed) return;
      progress.forgetLeftOff(); // a run that no longer plays keeps nothing open: stay only if the island is open anyway
      if (progress.unlocked(at)) return;
    }
    this.open(progress.next());
  }
  /** Set when the session came back from a saved run, until the screen has said so. */
  resumed = false;
  /** Call after anything that changes the run outside `move` (a hint taken). */
  saveRun() {
    const s = this.session;
    this.progress.saveRun(s.moves > 0 && !s.solved ? { name: s.lv.name!, log: s.log, hinted: s.hinted } : null);
  }

  /**
   * The stuck checker's callback (wire it as `new StuckChecker(createStuckWorker, s => controller.stuckAnswer(s))`).
   * Every move, undo and restart clears the warning first, so the event fires only when the shown state changes.
   */
  stuckAnswer(stuck: boolean) {
    const was = this.session.stuck;
    this.session.setStuck(stuck);
    if (this.session.stuck !== was) this.emit({ kind: 'stuck', stuck: this.session.stuck });
  }

  /** Open level i if it is unlocked; returns false for a locked level. */
  open(i: number, run?: SavedRun): boolean {
    if (i < 0 || i >= this.levels.length || !this.progress.unlocked(i)) return false;
    this.cancelDrag();
    this.index = i;
    this.completedNow = false;
    this.session = new Session(this.levels[i], this.stuck);
    this.resumed = run ? this.session.resume(run.log, run.hinted) : false;
    this.saveRun();
    this.selected = null;
    this.emit({ kind: 'level', index: i });
    return true;
  }

  act(a: KeyAction) {
    const was = this.session.stuck;
    switch (a.kind) {
      case 'select': this.selected = a.plate; this.emit({ kind: 'selected', plate: a.plate }); break;
      case 'cancel': // Esc: first drops a drag in progress, then the selection
        if (!this.cancelDrag()) { this.selected = null; this.emit({ kind: 'selected', plate: null }); }
        break;
      // a key move during a drag drops the drag's preview: it was computed for the old board (Codex chain 6 round 2)
      case 'move': this.cancelDrag(); this.select(a.plate); this.move(a.plate, a.dir); break;
      case 'undo': this.cancelDrag(); if (this.session.undo()) { this.saveRun(); this.emit({ kind: 'undone' }); this.unstuck(was); } break;
      case 'restart': this.cancelDrag(); this.session.restart(); this.saveRun(); this.selected = null; this.emit({ kind: 'level', index: this.index }); this.unstuck(was); break;
      case 'next':
        if (!this.session.solved) break;
      {
        // the next unsolved level after this one, else a skipped one before it (progress.ts window); with everything
        // solved (a replay for stars) simply the next level; finished after the last
        const unsolved = (i: number) => !this.progress.solved(i);
        const ahead = this.levels.findIndex((_, i) => i > this.index && unsolved(i));
        const behind = this.levels.findIndex((_, i) => unsolved(i));
        const to = this.completedNow ? -1
          : ahead >= 0 ? ahead : behind >= 0 ? behind : this.index + 1 < this.levels.length ? this.index + 1 : -1;
        if (to >= 0) this.open(to); else this.emit({ kind: 'finished' });
        break;
      }
    }
  }

  /**
   * Pointer drag on plate p, in cells since the drag started (drag.ts). Nothing is committed while dragging (design
   * Controls: preview while dragging, release commits, Esc cancels; Codex chain 6 Major 2): the drag asks for n stops,
   * the controller walks as many as the rail allows and emits a `preview` of the resulting state. Asking past the last
   * legal stop strains the plate: one `blocked` per push, not one per pointermove frame.
   */
  drag(p: number, dx: number, dy: number) {
    // a cancelled drag stays dead until the pointer is released (the pointer is still down and keeps moving)
    if (this.session.solved || this.dragCancelled) return;
    this.dragging = true;
    this.select(p);
    const ask = dragStops(this.levels[this.index].axis[p], dx, dy);
    const steps: Dir[] = [];
    let s = this.session.state, strained = false;
    for (let k = 0; ask && k < ask.n; k++) {
      const next = shift(this.levels[this.index], s, p, ask.dir);
      if (!next) { strained = true; break; }
      steps.push(ask.dir); s = next;
      if (solved(this.levels[this.index], s)) break; // the level ends at this stop; the rest of the drag is moot
    }
    if (strained && !this.straining) this.emit({ kind: 'blocked', plate: p, why: refusal(this.levels[this.index], s, p, ask!.dir), dir: ask!.dir, at: s });
    this.straining = strained;
    const key = steps.length ? `${p}:${steps[0]}:${steps.length}` : '';
    if (key === this.pending?.key || (!key && !this.pending)) return;
    this.pending = key ? { key, plate: p, steps } : null;
    this.emit({ kind: 'preview', plate: p, steps: steps.length,
      diff: key ? previewDiff(this.levels[this.index], this.session.state, s) : null });
  }
  /** Pointer released: commit the previewed stops (one move each). */
  release() {
    const pend = this.pending;
    this.pending = null; this.straining = false; this.dragging = false; this.dragCancelled = false;
    if (!pend) return;
    this.emit({ kind: 'preview', plate: pend.plate, steps: 0, diff: null });
    for (const d of pend.steps) if (!this.move(pend.plate, d)) break;
  }
  /**
   * Esc, pointercancel, undo, restart or a level change during a drag: drop the preview, commit nothing, and ignore the
   * rest of this drag until release. Returns true if a drag was in progress.
   */
  cancelDrag(): boolean {
    const pend = this.pending, was = this.dragging;
    this.pending = null; this.straining = false; this.dragging = false;
    if (was) this.dragCancelled = true;
    if (pend) this.emit({ kind: 'preview', plate: pend.plate, steps: 0, diff: null });
    return was;
  }
  private pending: { key: string; plate: number; steps: Dir[] } | null = null;
  private dragging = false;
  private dragCancelled = false;
  private straining = false;
  private completedNow = false;

  /** Commit one stop (keyboard arrow or a drag step); false when refused. */
  move(p: number, d: Dir): boolean {
    const was = this.session.stuck;
    const at = this.session.state, why = refusal(this.levels[this.index], at, p, d);
    const r = this.session.move(p, d);
    if (!r.ok) { if (r.reason === 'blocked') this.emit({ kind: 'blocked', plate: p, why, dir: d, at }); return false; }
    this.saveRun();
    this.emit({ kind: 'moved', plate: p, dir: d, at });
    this.unstuck(was);
    if (r.solved) {
      const s = this.session;
      const allSolved = () => this.levels.every((_, i) => this.progress.solved(i));
      const before = allSolved();
      this.progress.complete(this.index, s.moves, s.stars);
      // this solve finished the game: Enter shows the ending (kept through undo and re-solve on the same level)
      this.completedNow ||= !before && allSolved();
      this.selected = null;
      this.emit({ kind: 'solved', moves: s.moves, par: s.par, stars: s.stars });
    }
    return true;
  }

  /** A move, undo or restart clears the warning until the checker answers again: tell the render layer. */
  private unstuck(was: boolean) { if (was && !this.session.stuck) this.emit({ kind: 'stuck', stuck: false }); }

  private select(p: number) {
    if (this.selected !== p) { this.selected = p; this.emit({ kind: 'selected', plate: p }); }
  }
}
