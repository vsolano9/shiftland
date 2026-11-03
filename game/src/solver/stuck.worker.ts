// Runs the "no way back" search off the main thread (design audit S3; docs/PLAN.md Nov 6). The worst exported first
// move takes ~0.5 s to prove a dead end, which must never block input. Messages: StuckRequest in, StuckReply out.
import { canFinish } from '../rules/rules.ts';
import type { StuckReply, StuckRequest } from './stuck.ts';

self.onmessage = (e: MessageEvent<StuckRequest>) => {
  const { id, lv, s } = e.data;
  const reply: StuckReply = { id, canFinish: canFinish(lv, s) };
  (self as unknown as Worker).postMessage(reply);
};
