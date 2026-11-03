// Client for the stuck-check worker. Every move, undo or restart calls check(); only the answer for the latest call
// is delivered, so a slow search for an old state never shows a stale warning (the grey-box's cancel token, made
// real). The warning shows only on `false` (a proven dead end); `null` (cap hit) shows nothing.
// canFinish is synchronous inside the worker, so a queued message cannot interrupt it: when a newer check (or a
// cancel) supersedes a search still running, the worker is terminated and a fresh one spawned, so the latest check
// never waits behind obsolete searches (Codex chain 5 Major 1: five queued searches delayed an undo's answer 1.6 s).
import type { Level, State } from '../rules/rules.ts';

export interface StuckRequest { id: number; lv: Level; s: State }
export interface StuckReply { id: number; canFinish: boolean | null }

/** The part of Worker the client uses, so tests can pass an in-process fake. */
export interface WorkerLike {
  postMessage(m: StuckRequest): void;
  onmessage: ((e: MessageEvent<StuckReply>) => void) | null;
  terminate(): void;
}

export class StuckChecker {
  private latest = 0;
  private busy = false;
  private worker: WorkerLike | null = null;
  /** Workers spawned so far (tests and the dev overlay read it). */
  spawned = 0;

  constructor(private make: () => WorkerLike, private onStuck: (stuck: boolean) => void) {}

  /** Ask about state s; a search still running for an earlier state is killed. */
  check(lv: Level, s: State) {
    if (this.busy) this.kill();
    const w = this.worker ?? this.spawn();
    this.busy = true;
    w.postMessage({ id: ++this.latest, lv, s });
  }
  /** Drop any pending answer (level change, solved); a running search is killed. */
  cancel() { this.latest++; if (this.busy) this.kill(); }
  dispose() { this.kill(); }

  private spawn(): WorkerLike {
    const w = this.make();
    this.spawned++;
    w.onmessage = e => {
      if (w !== this.worker) return;
      this.busy = false;
      if (e.data.id === this.latest) this.onStuck(e.data.canFinish === false);
    };
    return (this.worker = w);
  }
  private kill() { this.worker?.terminate(); this.worker = null; this.busy = false; }
}

export const createStuckWorker = (): WorkerLike =>
  new Worker(new URL('./stuck.worker.ts', import.meta.url), { type: 'module' }) as unknown as WorkerLike;
