// Saved progress (docs/PLAN.md Nov 18-24 "save progress (localStorage, safe fallback)", release check R8; built early).
// - Tutorials (indices below `orderedUntil`) unlock strictly in order: each teaches the rule the next relies on.
//   From the first puzzle on, two unsolved levels are always open (level i opens once i < solved count + 2), so one hard
//   puzzle never ends a jam player's run (design-plates.md "Level progression": a stuck rater stops rating). Stars are
//   optional mastery and never gate anything (design-plates.md "Par and stars").
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

  constructor(private names: string[], private storage: StorageLike | null, private orderedUntil = 0) {
    try {
      const raw = storage?.getItem(KEY);
      const parsed = raw ? JSON.parse(raw) : null;
      // only well-formed records are kept: an array or a malformed record would lose progress on the next save
      // (Codex chain 6 Minor 3: `"levels": []` passed and JSON.stringify then dropped the named entries)
      if (parsed?.v === 1 && parsed.levels && typeof parsed.levels === 'object' && !Array.isArray(parsed.levels)) {
        for (const [name, r] of Object.entries(parsed.levels as Record<string, Partial<LevelRecord>>)) {
          if (r && typeof r === 'object' && r.solved === true && Number.isInteger(r.best) && (r.stars === 0 || r.stars === 1))
            this.data.levels[name] = { solved: true, best: r.best!, stars: r.stars };
        }
      }
    } catch { /* unreadable or corrupt: start fresh */ }
    if (!storage) this.persistent = false;
  }

  record(name: string): LevelRecord | undefined { return this.data.levels[name]; }
  solved(i: number): boolean { return !!this.data.levels[this.names[i]]?.solved; }
  unlocked(i: number): boolean {
    if (i === 0 || this.solved(i - 1)) return true;
    if (i < this.orderedUntil) return false;
    const tutorialsDone = this.orderedUntil === 0 || this.solved(this.orderedUntil - 1);
    const solvedCount = this.names.reduce((n, _, k) => n + (this.solved(k) ? 1 : 0), 0);
    return tutorialsDone && i < solvedCount + 2;
  }
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

/** The leading run of tutorial levels, which unlock strictly in order (Progress `orderedUntil`). */
export const tutorialCount = (levels: { role?: string }[]): number => {
  const i = levels.findIndex(l => l.role !== 'tutorial');
  return i < 0 ? levels.length : i;
};

/** localStorage when the browser allows it, else null (accessing it can itself throw). */
export function browserStorage(): StorageLike | null {
  try { return globalThis.localStorage ?? null; } catch { return null; }
}
