import { describe, expect, it } from 'vitest';
import type { Level, State } from '../rules/rules.ts';
import { HintSearch, type HintReply, type HintRequest, type HintWorkerLike } from './hint.ts';

class Fake implements HintWorkerLike {
  sent: HintRequest[] = []; dead = false;
  onmessage: ((e: MessageEvent<HintReply>) => void) | null = null;
  postMessage(m: HintRequest) { this.sent.push(m); }
  terminate() { this.dead = true; }
  reply(id: number, sol: HintReply['sol']) { this.onmessage?.({ data: { id, sol } } as MessageEvent<HintReply>); }
}
const lv = {} as Level, s = {} as State;

describe('hint search', () => {
  it('delivers the answer, and reuses an idle worker', () => {
    const made: Fake[] = [], h = new HintSearch(() => { const f = new Fake(); made.push(f); return f; }), got: unknown[] = [];
    h.ask(lv, s, a => got.push(a));
    expect(h.searching).toBe(true);
    made[0].reply(made[0].sent[0].id, { min: 2, first: 'P0E' });
    expect(got).toEqual([{ min: 2, first: 'P0E' }]);
    expect(h.searching).toBe(false);
    h.ask(lv, s, a => got.push(a));
    expect(made.length).toBe(1);
  });
  it('a newer question kills a running search, and the old answer never arrives', () => {
    const made: Fake[] = [], h = new HintSearch(() => { const f = new Fake(); made.push(f); return f; }), got: string[] = [];
    h.ask(lv, s, () => got.push('old'));
    const old = made[0], oldId = old.sent[0].id;
    h.ask(lv, s, () => got.push('new'));
    expect(old.dead).toBe(true);
    expect(made.length).toBe(2);
    old.reply(oldId, null);
    expect(got).toEqual([]);
    made[1].reply(made[1].sent[0].id, null);
    expect(got).toEqual(['new']);
  });
  it('cancel drops the answer', () => {
    const made: Fake[] = [], h = new HintSearch(() => { const f = new Fake(); made.push(f); return f; }), got: string[] = [];
    h.ask(lv, s, () => got.push('x'));
    h.cancel();
    expect(made[0].dead).toBe(true);
    expect(h.searching).toBe(false);
    made[0].reply(made[0].sent[0].id, null);
    expect(got).toEqual([]);
  });
});
