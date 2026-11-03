// Game controller (docs/PLAN.md Nov 6): owns the level list, saved progress, the current Session and the selected
// plate, and turns input actions (keys.ts, drag.ts) into state changes plus events for the render/audio layers.
// Pure: no DOM, no three.js. The render layer reads `session`, `selected` and `progress` and reacts to the events.
import type { Level } from '../rules/rules.ts';
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
  | { kind: 'finished' };                                  // Enter on the last level

export class Controller {
  session!: Session;
  index = 0;
  selected: number | null = null;

  constructor(readonly levels: Level[], readonly progress: Progress, private stuck?: StuckPort,
              private emit: (e: GameEvent) => void = () => {}) {
    this.open(progress.next());
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
    switch (a.kind) {
      case 'select': this.selected = a.plate; this.emit({ kind: 'selected', plate: a.plate }); break;
      case 'cancel': this.selected = null; this.emit({ kind: 'selected', plate: null }); break;
      case 'wrong-axis': this.select(a.plate); this.emit({ kind: 'wrong-axis', plate: a.plate }); break;
      case 'move': this.select(a.plate); this.move(a.plate, a.dir); break;
      case 'undo': if (this.session.undo()) this.emit({ kind: 'undone' }); break;
      case 'restart': this.session.restart(); this.selected = null; this.emit({ kind: 'level', index: this.index }); break;
      case 'next':
        if (!this.session.solved) break;
        if (this.index + 1 < this.levels.length) this.open(this.index + 1); else this.emit({ kind: 'finished' });
        break;
    }
  }

  /** Commit one stop (keyboard arrow or a drag step). */
  move(p: number, d: 0 | 1 | 2 | 3) {
    const r = this.session.move(p, d);
    if (!r.ok) { if (r.reason === 'blocked') this.emit({ kind: 'blocked', plate: p }); return; }
    this.emit({ kind: 'moved', plate: p });
    if (r.solved) {
      const s = this.session;
      this.progress.complete(this.index, s.moves, s.stars);
      this.selected = null;
      this.emit({ kind: 'solved', moves: s.moves, par: s.par, stars: s.stars });
    }
  }

  private select(p: number) {
    if (this.selected !== p) { this.selected = p; this.emit({ kind: 'selected', plate: p }); }
  }
}
