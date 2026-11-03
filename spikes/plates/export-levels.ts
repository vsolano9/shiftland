// Picks grey-box levels from the generator and writes levels.json for play.html.
// Run: node spikes/plates/export-levels.ts   (rails and seam placement: AXIS=2 and PLACE=1 are set here)
process.env.AXIS = '2';
process.env.PLACE = '1'; // seam placement doubles the pass rate once the plate cap is on (concepts.md)
const { generate, audit, solve } = await import('./plates.ts');
const { TUTORIAL, parse } = await import('./tutorial.ts');
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

type Out = { name: string; role: 'tutorial' | 'puzzle'; seed: number; w: number; h: number; plates: number; axis: number[]; maxTravel: number;
  plate: number[]; elev: number[]; objs: { kind: string; cell: number }[]; buoys: number[]; par: number };

const picked: Out[] = [];
const toOut = (name: string, seed: number, par: number) => {
  const lv = generate(seed);
  picked.push({ name, role: 'puzzle', seed, w: lv.w, h: lv.h, plates: lv.plates, axis: lv.axis!, maxTravel: lv.maxTravel!,
    plate: Array.from(lv.start.plate), elev: Array.from(lv.start.elev), objs: lv.start.objs, buoys: lv.buoys, par });
};

// the five solver-checked onboarding levels from tutorial.ts, then audited generated levels by rising par
for (const spec of TUTORIAL) {
  const lv = parse(spec); const r = solve(lv, 6);
  if (!r || r.min !== spec.expectPar) throw new Error(`${spec.name}: par ${r?.min}, expected ${spec.expectPar}`);
  picked.push({ name: spec.name, role: 'tutorial', seed: spec.seed?.[0] ?? 0, w: lv.w, h: lv.h, plates: lv.plates, axis: lv.axis!, maxTravel: lv.maxTravel!,
    plate: Array.from(lv.start.plate), elev: Array.from(lv.start.elev), objs: lv.start.objs, buoys: lv.buoys, par: r.min });
}
const real: { seed: number; par: number }[] = [];
for (let seed = 1; seed <= 1500 && real.length < 8; seed++) {
  const a = audit(generate(seed));
  if (a?.pass) real.push({ seed, par: a.min });
}
real.sort((a, b) => a.par - b.par);
real.forEach((l, i) => toOut(`Puzzle ${i + 1}`, l.seed, l.par));
const out = fileURLToPath(new URL('./levels.json', import.meta.url));
writeFileSync(out, JSON.stringify(picked));
console.log(picked.map(p => `${p.name}: seed ${p.seed}, par ${p.par}, goals ${p.objs.length + p.buoys.length}`).join('\n'));
