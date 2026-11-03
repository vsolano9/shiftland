import { describe, expect, it } from 'vitest';
import { canFinish, fromJson, shift, type LevelJson } from '../rules/rules';
import { StuckChecker, type StuckReply, type StuckRequest, type WorkerLike } from './stuck';
import levels from '../levels/levels.json';

// In-process fake: holds requests until flush(), then answers them in a chosen order (a real worker can finish an
// old, slow search after a newer, fast one).
class FakeWorker implements WorkerLike {
  onmessage: ((e: MessageEvent<StuckReply>) => void) | null = null;
  queue: StuckRequest[] = [];
  postMessage(m: StuckRequest) { this.queue.push(m); }
  terminate() {}
  answer(order: number[]) {
    for (const k of order) { const { id, lv, s } = this.queue[k]; this.onmessage!({ data: { id, canFinish: canFinish(lv, s) } } as MessageEvent<StuckReply>); }
  }
}

const village = fromJson((levels as LevelJson[]).find(l => l.name === 'Mind the Village')!);
const deadEnd = shift(village, village.start, 0, 1)!; // P0E crushes the village: proven dead end

describe('StuckChecker', () => {
  it('reports a proven dead end', () => {
    const w = new FakeWorker(); const seen: boolean[] = [];
    const c = new StuckChecker(w, s => seen.push(s));
    c.check(village, deadEnd); w.answer([0]);
    expect(seen).toEqual([true]);
  });
  it('drops a stale answer that arrives after a newer request (move, then undo)', () => {
    const w = new FakeWorker(); const seen: boolean[] = [];
    const c = new StuckChecker(w, s => seen.push(s));
    c.check(village, deadEnd);        // after the crushing push
    c.check(village, village.start);  // undo
    w.answer([1, 0]);                 // the undo's answer comes first, the old dead-end answer last
    expect(seen).toEqual([false]);    // no stale warning
  });
  it('cancel() drops a pending answer (level change)', () => {
    const w = new FakeWorker(); const seen: boolean[] = [];
    const c = new StuckChecker(w, s => seen.push(s));
    c.check(village, deadEnd); c.cancel(); w.answer([0]);
    expect(seen).toEqual([]);
  });
});
