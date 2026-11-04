// Builds the shipped level list from the hand-authored campaign (levels/campaign.ts), checking each level's par and
// writing its intended solution as `sol`. Written to src/levels/levels.json by `npm run levels:export`.
import { solve, type LevelJson } from '../rules/rules.ts';
import { CAMPAIGN } from './campaign.ts';
import { parse, type Spec } from './tutorial.ts';

export type LevelOut = LevelJson;

/** Deepest search the exporter and the audit run: the Finale's par goes up to 7 and traps are costed a little past it. */
export const MAX_DEPTH = 9;

export function toJson(spec: Spec): LevelOut {
  const lv = parse(spec);
  const r = solve(lv, MAX_DEPTH);
  if (!r || r.min !== spec.expectPar) throw new Error(`${spec.name}: par ${r?.min}, expected ${spec.expectPar}`);
  const out: LevelOut = { name: spec.name, role: lv.role, biome: lv.biome, w: lv.w, h: lv.h, plates: lv.plates, axis: lv.axis, maxTravel: lv.maxTravel,
    plate: Array.from(lv.start.plate), elev: Array.from(lv.start.elev), objs: lv.start.objs, buoys: lv.buoys, par: r.min,
    sol: spec.fixture ? spec.fixture.intended.split(' ') : r.firstSolution };
  if (lv.start.ice) out.ice = [...lv.start.ice.keys()].filter(i => lv.start.ice![i]);
  if (lv.pinned) out.pinned = lv.pinned;
  if (lv.blurb) out.blurb = lv.blurb;
  return out;
}

export const buildLevels = (): LevelOut[] => CAMPAIGN.map(toJson);
