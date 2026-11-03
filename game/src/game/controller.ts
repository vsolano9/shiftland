// Game controller (docs/PLAN.md Nov 6): owns the level list, saved progress, the current Session and the selected
// plate, and turns input actions (keys.ts, drag.ts) into state changes plus events for the render/audio layers.
// Pure: no DOM, no three.js. The render layer reads `session`, `selected` and `progress` and reacts to the events.
import type { Level } from '../rules/rules.ts';
import { consumeStep, dragStep } from './drag.ts';
import type { KeyAction } from './keys.ts';
import type { Progress } from './progress.ts';
import { Session, type StuckPort } from './session.ts';

export type GameEvent =
  | { kind: 'level'; index: number }                       // a level was opened (restart counts too)
  | { kind: 'selected'; plate: number | null }
  | { kind: 'moved'; plate: number }
  | { kind: 'blocked'; plate: number }                     // rail end or a rule refused the move (shake the plate)
  | { kind: 'wrong-axis'; plate: number }
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
    this.open(progress.next());
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
  open(i: number): boolean {
    if (i < 0 || i >= this.levels.length || !this.progress.unlocked(i)) return false;
    this.index = i;
    this.session = new Session(this.levels[i], this.stuck);
    this.selected = null;
    this.emit({ kind: 'level', index: i });
    return true;
  }

  act(a: KeyAction) {
    const was = this.session.stuck;
    switch (a.kind) {
      case 'select': this.selected = a.plate; this.emit({ kind: 'selected', plate: a.plate }); break;
      case 'cancel': this.selected = null; this.emit({ kind: 'selected', plate: null }); break;
      case 'wrong-axis': this.select(a.plate); this.emit({ kind: 'wrong-axis', plate: a.plate }); break;
      case 'move': this.select(a.plate); this.move(a.plate, a.dir); break;
      case 'undo': if (this.session.undo()) { this.emit({ kind: 'undone' }); this.unstuck(was); } break;
      case 'restart': this.session.restart(); this.selected = null; this.emit({ kind: 'level', index: this.index }); this.unstuck(was); break;
      case 'next':
        if (!this.session.solved) break;
        if (this.index + 1 < this.levels.length) this.open(this.index + 1); else this.emit({ kind: 'finished' });
        break;
    }
  }

  /**
   * Pointer drag on plate p, in cells since the last committed stop (drag.ts). Commits one stop per SNAP crossed until
   * the rail refuses or the level is solved, and returns the leftover drag for the input layer to keep. A refused stop
   * keeps its drag (clamped to just under a cell), so the plate strains at the rail end instead of racing ahead.
   */
  drag(p: number, dx: number, dy: number): [number, number] {
    this.select(p);
    for (let d = dragStep(this.levels[this.index].axis[p], dx, dy); d !== null && !this.session.solved;
         d = dragStep(this.levels[this.index].axis[p], dx, dy)) {
      // pointermove fires every frame: a held strain emits `blocked` once, not a shake per frame
      if (!this.move(p, d, this.straining !== d)) {
        this.straining = d;
        return [Math.max(-0.99, Math.min(0.99, dx)), Math.max(-0.99, Math.min(0.99, dy))];
      }
      this.straining = null;
      [dx, dy] = consumeStep(d, dx, dy);
    }
    if (dragStep(this.levels[this.index].axis[p], dx, dy) === null) this.straining = null;
    return [dx, dy];
  }
  /** Pointer released or cancelled. */
  dragEnd() { this.straining = null; }
  private straining: number | null = null;

  /** Commit one stop (keyboard arrow or a drag step); false when refused. */
  move(p: number, d: 0 | 1 | 2 | 3, feedback = true): boolean {
    const was = this.session.stuck;
    const r = this.session.move(p, d);
    if (!r.ok) { if (r.reason === 'blocked' && feedback) this.emit({ kind: 'blocked', plate: p }); return false; }
    this.emit({ kind: 'moved', plate: p });
    this.unstuck(was);
    if (r.solved) {
      const s = this.session;
      this.progress.complete(this.index, s.moves, s.stars);
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
