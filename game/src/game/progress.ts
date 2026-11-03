// Saved progress (docs/PLAN.md Nov 18-24 "save progress (localStorage, safe fallback)", release check R8; built early).
// - Levels unlock in order: level i+1 opens once level i is solved. Stars are optional mastery and never gate anything
//   (design-plates.md "Par and stars").
// - Keyed by level name, so reordering or inserting levels keeps a player's record for the levels they solved.
// - Storage can be missing or throw (private window, blocked site data, sandboxed iframe): every read and write is
//   wrapped, and the game runs on in memory for the session.

export interface StorageLike { getItem(k: string): string | null; setItem(k: string, v: string): void }

export interface LevelRecord { solved: boolean; best: number; stars: number }
interface Saved { v: 1; levels: Record<string, LevelRecord> }

export const KEY = 'shiftland.progress.v1';

export class Progress {
  private data: Saved = { v: 1, levels: {} };
  /** false once a write failed (shown nowhere yet; the settings screen may say "progress won't be saved"). */
  persistent = true;

  constructor(private names: string[], private storage: StorageLike | null) {
    try {
      const raw = storage?.getItem(KEY);
      const parsed = raw ? JSON.parse(raw) : null;
      if (parsed?.v === 1 && parsed.levels && typeof parsed.levels === 'object') this.data = parsed;
    } catch { /* unreadable or corrupt: start fresh */ }
    if (!storage) this.persistent = false;
  }

  record(name: string): LevelRecord | undefined { return this.data.levels[name]; }
  solved(i: number): boolean { return !!this.data.levels[this.names[i]]?.solved; }
  unlocked(i: number): boolean { return i === 0 || this.solved(i - 1); }
  /** The level to open on Play: the first unsolved one, or the last when all are solved. */
  next(): number { const i = this.names.findIndex((_, k) => !this.solved(k)); return i < 0 ? this.names.length - 1 : i; }
  totalStars(): number { return this.names.reduce((n, name) => n + (this.data.levels[name]?.stars ?? 0), 0); }

  /** Record a finished level; keeps the best move count and star. */
  complete(i: number, moves: number, stars: number) {
    const name = this.names[i];
    const old = this.data.levels[name];
    this.data.levels[name] = { solved: true, best: old ? Math.min(old.best, moves) : moves, stars: Math.max(old?.stars ?? 0, stars) };
    this.save();
  }

  reset() { this.data = { v: 1, levels: {} }; this.save(); }

  private save() {
    if (!this.storage) return;
    try { this.storage.setItem(KEY, JSON.stringify(this.data)); } catch { this.persistent = false; }
  }
}

/** localStorage when the browser allows it, else null (accessing it can itself throw). */
export function browserStorage(): StorageLike | null {
  try { return globalThis.localStorage ?? null; } catch { return null; }
}
