import { describe, expect, it } from 'vitest';
import { canFinish, fromJson, shift, type LevelJson } from '../rules/rules';
import { StuckChecker, type StuckReply, type StuckRequest, type WorkerLike } from './stuck';
import { stuckVerdict } from './verdict';
import levels from '../levels/levels.json';

// In-process fake with the real worker's shape: one synchronous search at a time, answered in order on run().
// terminate() kills it, so a terminated fake never answers.
class FakeWorker implements WorkerLike {
  onmessage: ((e: MessageEvent<StuckReply>) => void) | null = null;
  queue: StuckRequest[] = [];
  dead = false;
  postMessage(m: StuckRequest) { this.queue.push(m); }
  terminate() { this.dead = true; }
  run() {
    if (this.dead) return;
    for (const { id, lv, s } of this.queue.splice(0)) this.onmessage!({ data: { id, canFinish: canFinish(lv, s) } } as MessageEvent<StuckReply>);
  }
}
const pool = () => { const made: FakeWorker[] = []; return { made, make: () => { const w = new FakeWorker(); made.push(w); return w; } }; };

const village = fromJson((levels as LevelJson[]).find(l => l.name === 'Village Green')!);
const deadEnd = shift(village, village.start, 0, 1)!; // P0E crushes the village: proven dead end

describe('stuckVerdict', () => {
  const long = fromJson((levels as LevelJson[]).find(l => l.name === 'The Summit')!);
  it('never calls an unproven board a dead end', () => {
    // solvable (par 7), but past both a one-state cap and a one-move search: the kind of board Codex's review asked about
    expect(stuckVerdict(long, long.start, 1, 1)).toEqual({ canFinish: null, far: true });
    expect(stuckVerdict(long, long.start, 1, 9)).toEqual({ canFinish: null, far: false });
  });
  it('still proves a real dead end', () => {
    expect(stuckVerdict(village, deadEnd)).toEqual({ canFinish: false, far: false });
  });
});

describe('StuckChecker', () => {
  it('says so when the warning comes from the bounded search', () => {
    const w = new FakeWorker(); const seen: [boolean, boolean][] = [];
    const c = new StuckChecker(() => w, (s, far) => seen.push([s, far]));
    c.check(village, deadEnd);
    w.onmessage!({ data: { id: w.queue[0].id, canFinish: null, far: true } } as MessageEvent<StuckReply>);
    expect(seen).toEqual([[true, true]]);
  });
  it('reports a proven dead end and reuses an idle worker', () => {
    const p = pool(); const seen: boolean[] = [];
    const c = new StuckChecker(p.make, s => seen.push(s));
    c.check(village, deadEnd); p.made[0].run();
    c.check(village, village.start); p.made[0].run();
    expect(seen).toEqual([true, false]);
    expect(c.spawned).toBe(1);
  });
  it('a newer check kills the running search, so the latest answer never waits behind obsolete ones', () => {
    const p = pool(); const seen: boolean[] = [];
    const c = new StuckChecker(p.make, s => seen.push(s));
    for (let i = 0; i < 5; i++) c.check(village, deadEnd); // five rapid moves, none answered yet
    c.check(village, village.start);                         // undo
    expect(p.made.slice(0, 5).every(w => w.dead)).toBe(true);
    expect(p.made[5].queue.length).toBe(1);                  // the live worker holds only the latest search
    p.made.forEach(w => w.run());
    expect(seen).toEqual([false]);                           // no stale warning
  });
  it('cancel() kills a running search (level change, solved)', () => {
    const p = pool(); const seen: boolean[] = [];
    const c = new StuckChecker(p.make, s => seen.push(s));
    c.check(village, deadEnd); c.cancel(); p.made[0].run();
    expect(seen).toEqual([]);
    c.check(village, deadEnd); p.made[1].run();
    expect(seen).toEqual([true]);
  });
  it('a late reply from a killed worker is ignored even if it slips through', () => {
    const p = pool(); const seen: boolean[] = [];
    const c = new StuckChecker(p.make, s => seen.push(s));
    c.check(village, deadEnd); c.check(village, village.start);
    p.made[0].dead = false; p.made[0].run();                 // simulate a message already in flight
    expect(seen).toEqual([]);
    p.made[1].run();
    expect(seen).toEqual([false]);
  });
});
