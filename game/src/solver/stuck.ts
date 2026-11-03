// Client for the stuck-check worker. Every move, undo or restart calls check(); only the answer for the latest call
// is delivered, so a slow search for an old state never shows a stale warning (the grey-box's cancel token, made
// real). The warning shows only on `false` (a proven dead end); `null` (cap hit) shows nothing.
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
  constructor(private worker: WorkerLike, private onStuck: (stuck: boolean) => void) {
    worker.onmessage = e => { if (e.data.id === this.latest) this.onStuck(e.data.canFinish === false); };
  }
  /** Ask about state s; any earlier pending answer is dropped. */
  check(lv: Level, s: State) { this.worker.postMessage({ id: ++this.latest, lv, s }); }
  /** Drop any pending answer (level change). */
  cancel() { this.latest++; }
  dispose() { this.worker.terminate(); }
}

export const createStuckWorker = (): WorkerLike =>
  new Worker(new URL('./stuck.worker.ts', import.meta.url), { type: 'module' }) as unknown as WorkerLike;
