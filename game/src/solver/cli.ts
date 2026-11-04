// Level CLI (docs/PLAN.md, done-criterion 2). Runs under plain Node 24 (type stripping), no build step:
//   node src/solver/cli.ts export                  write src/levels/levels.json from the campaign
//   node src/solver/cli.ts audit [levels.json]     audit every level and its fixture; exit 1 if any fails
//   node src/solver/cli.ts random [walks]          random-play solve rate per level: walks of 3x par moves
//   node src/solver/cli.ts inspect <name|number>   map, every shortest solution and what each first move costs
//   node src/solver/cli.ts table                   the level table for docs/design-plates.md
//   node src/solver/cli.ts gen <seed> [count] [--desert]   generate and audit candidates (--desert adds an oasis)
// Each level's `role` picks the bar (audit.ts shipCheck): tutorials are exempt from the 3-move, order and tempting-move
// checks but must still solve at par; puzzles (and levels without a role) get the full bar. The default file also
// has every level proven against its fixture (fixtures.ts): intended solution, trap, aha.
import { readFileSync, writeFileSync } from 'node:fs';
import { buildLevels, MAX_DEPTH } from '../levels/build.ts';
import { CAMPAIGN } from '../levels/campaign.ts';
import { fromJson, type Level, type LevelJson } from '../rules/rules.ts';
import { audit, drawLevel, firstMoves, randomSolveRate, shipCheck, shortestSolutions } from './audit.ts';
import { checkFixture } from './fixtures.ts';
import { generate } from './generate.ts';

const SHIPPED_LEVELS = new URL('../levels/levels.json', import.meta.url);
const specOf = (name?: string) => CAMPAIGN.find(s => s.name === name);
const shipped = (file: string | URL = SHIPPED_LEVELS): Level[] => (JSON.parse(readFileSync(file, 'utf8')) as LevelJson[]).map(fromJson);

function check(lv: Level, withFixture: boolean): { ok: boolean; line: string } {
  const { why, audit: a } = shipCheck(lv);
  if (!a) return { ok: false, line: why.join('; ') };
  const problems = [...why];
  const spec = specOf(lv.name);
  let extra = '';
  if (withFixture) {
    if (!spec) problems.push('no campaign entry');
    else {
      const f = checkFixture(spec, lv);
      problems.push(...f.problems);
      extra = `  trap ${spec.fixture?.trap ? `${spec.fixture.trap.move}->${spec.fixture.trap.finish}` : 'none'}  aha ${spec.fixture?.aha.move}  shortest ${f.solutions}  random ${(f.rate * 100).toFixed(1)}%`;
    }
  }
  const line = `min ${a.min}  land ${(a.land * 100).toFixed(0)}%  plate ${(a.plateKept * 100).toFixed(0)}%${extra}`;
  return { ok: problems.length === 0, line: problems.length ? `${line}  FAIL: ${problems.join('; ')}` : line };
}

const argv = process.argv.slice(2);
const flags = new Set(argv.filter(a => a.startsWith('--')));
const [cmd, arg1, arg2] = argv.filter(a => !a.startsWith('--')); // flags may come anywhere (Codex chain 5 Minor 2)
if (cmd === 'export') {
  const levels = buildLevels();
  writeFileSync(SHIPPED_LEVELS, JSON.stringify(levels));
  console.log(`wrote ${levels.length} levels to src/levels/levels.json: ${levels.map(l => `${l.name} (par ${l.par})`).join(', ')}`);
} else if (cmd === 'audit') {
  const levels = shipped(arg1 ?? SHIPPED_LEVELS);
  let failed = 0;
  for (const [i, lv] of levels.entries()) {
    const r = check(lv, arg1 === undefined);
    if (!r.ok) failed++;
    console.log(`${r.ok ? 'ok  ' : 'FAIL'} ${String(i + 1).padStart(2)} ${(lv.name ?? '?').padEnd(18)} ${lv.biome.padEnd(6)} par ${lv.par}  ${r.line}`);
  }
  console.log(`${levels.length - failed}/${levels.length} levels pass`);
  if (failed) process.exitCode = 1;
} else if (cmd === 'random') {
  const walks = Number(arg1 ?? 2000);
  for (const [i, lv] of shipped().entries()) {
    const rate = randomSolveRate(lv, walks);
    console.log(`${String(i + 1).padStart(2)} ${(lv.name ?? '?').padEnd(18)} ${lv.biome.padEnd(6)} par ${lv.par}  ${(rate * 100).toFixed(1).padStart(5)}%  (${walks} walks of ${3 * lv.par!} moves)`);
  }
} else if (cmd === 'inspect') {
  const levels = shipped();
  const lv = levels[Number(arg1) - 1] ?? levels.find(l => l.name === arg1);
  if (!lv) { console.error(`no level "${arg1}"`); process.exit(2); }
  console.log(`${lv.name} (${lv.biome}, ${lv.w}x${lv.h}, par ${lv.par})\n${drawLevel(lv)}`);
  for (const s of shortestSolutions(lv, lv.par!, 16)) console.log(`  shortest: ${s.join(' ')}`);
  for (const m of firstMoves(lv, MAX_DEPTH)) console.log(`  first ${m.move}: ${m.ticks > 0 ? '+' : ''}${m.ticks} goals, ${m.dead ? 'dead end' : m.finish === null ? `beyond ${MAX_DEPTH}` : `finish in ${m.finish}`}`);
  console.log(`  random ${(randomSolveRate(lv) * 100).toFixed(1)}%`);
} else if (cmd === 'table') {
  console.log('| # | Name | Biome | Par | Idea | Trap | Random solve |\n|---|---|---|---|---|---|---|');
  for (const [i, lv] of shipped().entries()) {
    const s = specOf(lv.name)!;
    console.log(`| ${i + 1} | ${lv.name} | ${lv.biome} | ${lv.par} | ${s.teaches} | ${s.fixture?.trap ? `${s.fixture.trap.move}: ${s.fixture.trap.why}` : 'none'} | ${(randomSolveRate(lv) * 100).toFixed(1)}% |`);
  }
} else if (cmd === 'gen') {
  const seed = Number(arg1), count = Number(arg2 ?? 1), oasis = flags.has('--desert');
  const unknown = [...flags].filter(f => f !== '--desert');
  if (!Number.isInteger(seed) || !Number.isInteger(count) || count < 1 || unknown.length) {
    console.error(`usage: gen <seed> [count >= 1] [--desert]${unknown.length ? ` (unknown flag ${unknown.join(', ')})` : ''}`);
    process.exit(2);
  }
  let pass = 0;
  for (let s = seed; s < seed + count; s++) {
    const lv = { ...generate(s, { place: true, oasis }), name: `Candidate seed ${s}`, role: 'puzzle' as const };
    const a = audit(lv);
    if (a?.pass) { pass++; console.log(`seed ${s}: pass  min ${a.min}  tempting ${a.tempting?.move}`); }
  }
  console.log(`${pass}/${count} seeds pass the bar`);
} else {
  console.error('usage: node src/solver/cli.ts export | audit [levels.json] | random [walks] | inspect <name|number> | table | gen <seed> [count]');
  process.exitCode = 2;
}
