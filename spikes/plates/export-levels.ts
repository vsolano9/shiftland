// Picks grey-box levels from the generator and writes levels.json for play.html.
// Run: node spikes/plates/export-levels.ts   (uses rails: AXIS=2 is set here)
process.env.AXIS = '2';
const { generate, audit, solve } = await import('./plates.ts');
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

type Out = { name: string; seed: number; w: number; h: number; plates: number; axis: number[]; maxTravel: number;
  plate: number[]; elev: number[]; objs: { kind: string; cell: number }[]; buoys: number[]; par: number };

const picked: Out[] = [];
const toOut = (name: string, seed: number, par: number) => {
  const lv = generate(seed);
  picked.push({ name, seed, w: lv.w, h: lv.h, plates: lv.plates, axis: lv.axis!, maxTravel: lv.maxTravel!,
    plate: Array.from(lv.start.plate), elev: Array.from(lv.start.elev), objs: lv.start.objs, buoys: lv.buoys, par });
};

// two warm-up levels (par 1-2, a single goat or buoy is fine), then audited levels by rising par
const warm: { seed: number; par: number }[] = [];
const real: { seed: number; par: number }[] = [];
for (let seed = 1; seed <= 1500 && (warm.length < 2 || real.length < 8); seed++) {
  const lv = generate(seed);
  if (warm.length < 2) {
    const r = solve(lv, 3);
    if (r && r.min === warm.length + 1 && lv.start.objs.length + lv.buoys.length <= 2) { warm.push({ seed, par: r.min }); continue; }
  }
  const a = audit(lv);
  if (a?.pass && real.length < 8) real.push({ seed, par: a.min });
}
real.sort((a, b) => a.par - b.par);
warm.forEach((l, i) => toOut(`Warm-up ${i + 1}`, l.seed, l.par));
real.forEach((l, i) => toOut(`Puzzle ${i + 1}`, l.seed, l.par));
const out = fileURLToPath(new URL('./levels.json', import.meta.url));
writeFileSync(out, JSON.stringify(picked));
console.log(picked.map(p => `${p.name}: seed ${p.seed}, par ${p.par}, goals ${p.objs.length + p.buoys.length}`).join('\n'));
