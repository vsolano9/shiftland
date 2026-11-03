// Level CLI (docs/PLAN.md, done-criterion 2). Runs under plain Node 24 (type stripping), no build step:
//   node src/solver/cli.ts audit [levels.json]     audit every level; exit 1 if any fails
//   node src/solver/cli.ts gen <seed> [count]      generate and audit candidates from a seed
// Tutorial levels (names not starting with "Puzzle") are exempt from the 3-move minimum but must still solve at par.
// The level JSON schema gains an explicit role field on Nov 4; until then the name decides, as in audit.test.ts.
import { readFileSync } from 'node:fs';
import { fromJson, type Level, type LevelJson } from '../rules/rules.ts';
import { audit, shipCheck } from './audit.ts';
import { generate } from './generate.ts';

const DEFAULT_LEVELS = new URL('../../../spikes/plates/levels.json', import.meta.url);

function check(lv: Level): { ok: boolean; line: string } {
  const { why, audit: a } = shipCheck(lv);
  if (!a) return { ok: false, line: why.join('; ') };
  const t = a.tempting ? `${a.tempting.move}->${a.tempting.finish ?? 'dead end'}` : 'none';
  const line = `min ${a.min}  land ${(a.land * 100).toFixed(0)}%  plate ${(a.plateKept * 100).toFixed(0)}%  tempting ${t}`;
  return { ok: why.length === 0, line: why.length ? `${line}  FAIL: ${why.join('; ')}` : line };
}

const [cmd, arg1, arg2] = process.argv.slice(2);
if (cmd === 'audit') {
  const file = arg1 ?? DEFAULT_LEVELS;
  const levels = (JSON.parse(readFileSync(file, 'utf8')) as LevelJson[]).map(fromJson);
  let failed = 0;
  for (const [i, lv] of levels.entries()) {
    const r = check(lv);
    if (!r.ok) failed++;
    console.log(`${r.ok ? 'ok  ' : 'FAIL'} ${String(i + 1).padStart(2)} ${(lv.name ?? '?').padEnd(18)} par ${lv.par}  ${r.line}`);
  }
  console.log(`${levels.length - failed}/${levels.length} levels pass`);
  if (failed) process.exitCode = 1;
} else if (cmd === 'gen') {
  const seed = Number(arg1), count = Number(arg2 ?? 1);
  if (!Number.isInteger(seed)) { console.error('usage: gen <seed> [count]'); process.exit(2); }
  let pass = 0;
  for (let s = seed; s < seed + count; s++) {
    const lv = { ...generate(s, { place: true }), name: `Puzzle seed ${s}` };
    const a = audit(lv);
    if (a?.pass) { pass++; console.log(`seed ${s}: pass  min ${a.min}  tempting ${a.tempting?.move}`); }
  }
  console.log(`${pass}/${count} seeds pass the bar`);
} else {
  console.error('usage: node src/solver/cli.ts audit [levels.json] | gen <seed> [count]');
  process.exitCode = 2;
}
