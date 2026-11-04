// Runs the hint's search off the main thread: from a dead end it has to exhaust the level, up to 300k states and over 4 s,
// and a frozen screen is the last thing a stuck player needs (Codex chain 2 Major 1). Messages: HintRequest in, HintReply out.
import { solve } from '../rules/rules.ts';
import type { HintReply, HintRequest } from './hint.ts';

self.onmessage = (e: MessageEvent<HintRequest>) => {
  const { id, lv, s } = e.data, sol = solve(lv, 16, s);
  const reply: HintReply = { id, sol: sol ? { min: sol.min, first: sol.firstSolution[0] } : null };
  (self as unknown as Worker).postMessage(reply);
};
