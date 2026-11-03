// Entry point. Scaffold only (2026-11-03): loads the levels through the rules module; the three.js render,
// input and UI follow the Week 1 plan in docs/PLAN.md (Nov 5-6).
import { fromJson, solved, type LevelJson } from './rules/rules';
import raw from '../../spikes/plates/levels.json';

const levels = (raw as LevelJson[]).map(fromJson);
const app = document.getElementById('app')!;
app.textContent = `Shiftland: ${levels.length} levels loaded (${levels.filter(l => !solved(l, l.start)).length} unsolved at start)`;
