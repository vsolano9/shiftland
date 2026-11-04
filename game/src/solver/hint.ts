// Client for the hint's worker. Only the latest question gets an answer: a move, an undo or a new level cancels what was
// asked before, and a search still running is killed, as with the stuck checker (stuck.ts).
import type { Level, State } from '../rules/rules.ts';

export interface HintRequest { id: number; lv: Level; s: State }
/** `first` is the next move, in the solver's notation; `sol` is null when no solution exists from here. */
export interface HintReply { id: number; sol: { min: number; first: string } | null }

export interface HintWorkerLike {
  postMessage(m: HintRequest): void;
  onmessage: ((e: MessageEvent<HintReply>) => void) | null;
  terminate(): void;
}

export class HintSearch {
  private latest = 0;
  private busy = false;
  private worker: HintWorkerLike | null = null;

  constructor(private make: () => HintWorkerLike) {}

  ask(lv: Level, s: State, answer: (sol: HintReply['sol']) => void) {
    this.cancel();
    const w = this.worker ?? (this.worker = this.make()), id = ++this.latest;
    this.busy = true;
    w.onmessage = e => {
      if (w !== this.worker || e.data.id !== this.latest || e.data.id !== id) return;
      this.busy = false;
      answer(e.data.sol);
    };
    w.postMessage({ id, lv, s });
  }
  /** Is a question still open? */
  get searching() { return this.busy; }
  cancel() { this.latest++; if (this.busy) { this.worker?.terminate(); this.worker = null; this.busy = false; } }
}

export const createHintWorker = (): HintWorkerLike =>
  new Worker(new URL('./hint.worker.ts', import.meta.url), { type: 'module' }) as unknown as HintWorkerLike;
