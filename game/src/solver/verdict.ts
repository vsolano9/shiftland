// What the stuck worker answers. Several boards reach millions of states, so the full search often stops at its cap with no
// answer. A bounded search can then only say nothing lies within reach: worth a warning (without one the board stayed quiet
// where the hint said Undo, playtest 3 P2), but not a claim of proof, because a longer way may exist (Codex review).
import { canFinish, solve, type Level, type State } from '../rules/rules.ts';

export interface StuckVerdict { canFinish: boolean | null; far: boolean }

export function stuckVerdict(lv: Level, s: State, cap?: number, depth = 16): StuckVerdict {
  const full = canFinish(lv, s, cap);
  return { canFinish: full, far: full === null && !solve(lv, depth, s) };
}
