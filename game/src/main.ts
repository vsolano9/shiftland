// Entry point. Scaffold only (2026-11-03): loads the levels through the rules module; the three.js render,
// input and UI follow the Week 1 plan in docs/PLAN.md (Nov 5-6).
import { fromJson, shift, solved, type LevelJson } from './rules/rules';
import { createStuckWorker, StuckChecker } from './solver/stuck';
import raw from './levels/levels.json';

const levels = (raw as LevelJson[]).map(fromJson);
const app = document.getElementById('app')!;
app.textContent = `Shiftland: ${levels.length} levels loaded (${levels.filter(l => !solved(l, l.start)).length} unsolved at start)`;

// Scaffold self-check of the stuck worker in the real bundle (e2e/smoke.spec.ts): Mind the Village after P0E is a
// proven dead end. Replaced by the real level screen on Nov 5-6.
const village = levels.find(l => l.name === 'Mind the Village')!;
const status = document.createElement('p'); status.id = 'worker'; app.after(status);
const checker = new StuckChecker(createStuckWorker(), stuck => { status.textContent = `stuck worker: ${stuck ? 'dead end found' : 'no dead end'}`; checker.dispose(); });
checker.check(village, shift(village, village.start, 0, 1)!);
