// Builds the shipped level list: the tutorial levels (solver-checked against their designed par), then generated
// puzzles that pass the quality bar, by rising par. Ported from spikes/plates/export-levels.ts; same output.
// Written to src/levels/levels.json by `npm run levels:export`.
import { solve, type LevelJson } from '../rules/rules.ts';
import { audit } from '../solver/audit.ts';
import { generate } from '../solver/generate.ts';
import { parse, TUTORIAL } from './tutorial.ts';

export type LevelOut = LevelJson & { seed: number };

export function buildLevels(puzzleCount = 8, maxSeed = 1500): LevelOut[] {
  const out: LevelOut[] = [];
  for (const spec of TUTORIAL) {
    const lv = parse(spec); const r = solve(lv, 6);
    if (!r || r.min !== spec.expectPar) throw new Error(`${spec.name}: par ${r?.min}, expected ${spec.expectPar}`);
    out.push({ name: spec.name, role: 'tutorial', seed: spec.seed?.[0] ?? 0, w: lv.w, h: lv.h, plates: lv.plates, axis: lv.axis,
      maxTravel: lv.maxTravel, plate: Array.from(lv.start.plate), elev: Array.from(lv.start.elev), objs: lv.start.objs, buoys: lv.buoys, par: r.min });
  }
  const real: { seed: number; par: number }[] = [];
  for (let seed = 1; seed <= maxSeed && real.length < puzzleCount; seed++) {
    const a = audit(generate(seed, { place: true }));
    if (a?.pass) real.push({ seed, par: a.min });
  }
  real.sort((a, b) => a.par - b.par);
  real.forEach(({ seed, par }, i) => {
    const lv = generate(seed, { place: true });
    out.push({ name: `Puzzle ${i + 1}`, role: 'puzzle', seed, w: lv.w, h: lv.h, plates: lv.plates, axis: lv.axis, maxTravel: lv.maxTravel,
      plate: Array.from(lv.start.plate), elev: Array.from(lv.start.elev), objs: lv.start.objs, buoys: lv.buoys, par });
  });
  return out;
}
