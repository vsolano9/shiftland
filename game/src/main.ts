// Entry point. Scaffold only (2026-11-03): loads the levels through the rules module; the three.js render,
// input and UI follow the Week 1 plan in docs/PLAN.md (Nov 5-6).
import { fromJson, shift, solved, type LevelJson } from './rules/rules';
import { createStuckWorker, StuckChecker } from './solver/stuck';
import raw from './levels/levels.json';

const levels = (raw as LevelJson[]).map(fromJson);
const app = document.getElementById('app')!;
app.textContent = `Shiftland: ${levels.length} levels loaded (${levels.filter(l => !solved(l, l.start)).length} unsolved at start)`;

// Scaffold self-check of the stuck worker in the real bundle (e2e/smoke.spec.ts): five rapid checks of the slowest
// exported search (Puzzle 2 after P0W) are superseded by Mind the Village after P0E, a proven dead end; the last
// answer must not wait behind the obsolete searches. Replaced by the real level screen on Nov 5-6.
const byName = (n: string) => levels.find(l => l.name === n)!;
const village = byName('Mind the Village'), slow = byName('Puzzle 2');
const status = document.createElement('p'); status.id = 'worker'; app.after(status);
const t0 = performance.now();
const checker = new StuckChecker(createStuckWorker, stuck => {
  status.textContent = `stuck worker: ${stuck ? 'dead end found' : 'no dead end'}`;
  status.dataset.ms = String(Math.round(performance.now() - t0));
  status.dataset.workers = String(checker.spawned);
  checker.dispose();
});
for (let i = 0; i < 5; i++) checker.check(slow, shift(slow, slow.start, 0, 3)!);
checker.check(village, shift(village, village.start, 0, 1)!);
