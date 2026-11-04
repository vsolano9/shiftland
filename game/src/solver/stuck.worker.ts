// Runs the "no way back" search off the main thread (design audit S3; docs/PLAN.md Nov 6). The worst exported first
// move takes ~0.5 s to prove a dead end, which must never block input. Messages: StuckRequest in, StuckReply out.
import { canFinish, solve } from '../rules/rules.ts';
import type { StuckReply, StuckRequest } from './stuck.ts';

self.onmessage = (e: MessageEvent<StuckRequest>) => {
  const { id, lv, s } = e.data;
  // Past its cap the full search has no answer. The hint's bounded search can still say nothing lies within 16 moves, and a
  // board that far from done is a dead end to a player: without this the warning stayed quiet where the hint said Undo (playtest 3 P2).
  const full = canFinish(lv, s);
  const reply: StuckReply = { id, canFinish: full === null && !solve(lv, 16, s) ? false : full };
  (self as unknown as Worker).postMessage(reply);
};
