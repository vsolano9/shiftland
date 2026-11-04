// What the fixed camera cannot see (playtest 4: a buoy behind a cliff, a village over a buoy, a lamp behind a peak, two goats
// in one blob). The player cannot rotate, so a creature hidden on the start or the solved board is a level problem, and
// `npm run levels:audit` fails on it unless the spec writes down why it is fine. The geometry follows `hiddenShare` in
// render/island.ts, with the lens's real perspective (a 20-degree lens about 18 units away: a creature near the edge of the
// board is seen from a noticeably different angle, which is what put Mirage's buoy behind its cliff) and the other creatures
// as occluders. The game never imports this file.
import type { Kind, Level, State } from '../rules/rules.ts';

const CAM_AZ = 0.72, CAM_EL = 0.82;
const topY = (h: number) => 0.42 + h * 0.5;
/** Unit vector towards the camera. */
const DIR = { x: Math.sin(CAM_AZ) * Math.cos(CAM_EL), y: Math.sin(CAM_EL), z: Math.cos(CAM_AZ) * Math.cos(CAM_EL) };
/** The vertical half-angle of the game's lens (world.ts: PerspectiveCamera(20, ...)). */
const TAN_V = Math.tan((10 * Math.PI) / 180);
/** The screens the game is played on: the share of each the board may fill (the HUD bars take the rest) and where its middle
 *  sits (-1 to 1, as in world.ts pads). The upright phone stands further back because its width is what limits it, so it looks
 *  along a straighter line. The solved panel pushes the board to one side, which turns the lens on it by up to six degrees: Salt
 *  Point's buoy measured 33% hidden from the middle of the screen and showed as a sliver on the finished picture. */
export interface Screen { name: string; aspect: number; fillV: number; fillH: number; midX: number; midY: number }
export const LANDSCAPE: Screen = { name: 'landscape', aspect: 16 / 9, fillV: 0.72, fillH: 0.74, midX: 0, midY: -0.03 };
export const PHONE: Screen = { name: 'phone', aspect: 1170 / 2532, fillV: 0.72, fillH: 0.97, midX: 0, midY: -0.05 };
export const LANDSCAPE_SOLVED: Screen = { name: 'landscape solved', aspect: 16 / 9, fillV: 0.87, fillH: 0.59, midX: -0.32, midY: 0.02 };
export const PHONE_SOLVED: Screen = { name: 'phone solved', aspect: 1170 / 2532, fillV: 0.6, fillH: 0.97, midX: 0, midY: 0.31 };
export const PLAY_SCREENS = [LANDSCAPE, PHONE], SOLVED_SCREENS = [LANDSCAPE_SOLVED, PHONE_SOLVED];

type Who = Kind | 'buoy';
/** Height of the model: HEAD_Y * KIND_SCALE in render/creatures.ts. */
const TALL: Record<Who, number> = { goat: 0.775, village: 1.008, light: 1.566, buoy: 0.884, oasis: 1.131, penguin: 0.93 };
/** Half the model's width as drawn. */
const WIDE: Record<Who, number> = { goat: 0.32, village: 0.42, light: 0.24, buoy: 0.3, oasis: 0.36, penguin: 0.28 };

/** At or above this share of its sample points a creature counts as mostly hidden. */
export const MOSTLY = 0.5;

interface Body { who: Who; cell: number; x: number; z: number; y: number }

function bodies(lv: Level, s: State): Body[] {
  const at = (who: Who, cell: number): Body => ({ who, cell, x: cell % lv.w, z: Math.floor(cell / lv.w),
    y: s.plate[cell] >= 0 ? topY(s.elev[cell]) : who === 'buoy' ? 0.02 : 0.05 });
  return [...s.objs.map(o => at(o.kind, o.cell)), ...lv.buoys.map(b => at('buoy', b))];
}

/** Where the camera stands for this board on this screen: as close as the board allows, with its middle where the screen wants it. */
export function cameraOf(lv: Level, screen: Screen = LANDSCAPE, s: State = lv.start): { x: number; y: number; z: number } {
  const right = { x: Math.cos(CAM_AZ), z: -Math.sin(CAM_AZ) }, sinE = Math.sin(CAM_EL), cosE = Math.cos(CAM_EL);
  const toward = { x: Math.sin(CAM_AZ), z: Math.cos(CAM_AZ) };
  let xa = 1e9, xb = -1e9, ya = 1e9, yb = -1e9, gx = 0, gz = 0, n = 0;
  for (let i = 0; i < lv.w * lv.h; i++) {
    if (s.plate[i] < 0) continue;
    const x = i % lv.w, z = Math.floor(i / lv.w), top = topY(s.elev[i]);
    gx += x; gz += z; n++;
    for (const [dx, dz] of [[-0.5, -0.5], [0.5, -0.5], [-0.5, 0.5], [0.5, 0.5]]) {
      const px = x + dx, pz = z + dz, across = px * right.x + pz * right.z, along = px * toward.x + pz * toward.z;
      xa = Math.min(xa, across); xb = Math.max(xb, across);
      ya = Math.min(ya, -along * sinE); yb = Math.max(yb, -along * sinE + top * cosE);
    }
  }
  const dist = Math.max(14, (yb - ya) / (2 * TAN_V * screen.fillV), (xb - xa) / (2 * TAN_V * screen.aspect * screen.fillH));
  // A board left of the screen's middle is a lens standing to the right of it; a board above the middle, a lens standing lower.
  const sideways = -screen.midX * TAN_V * screen.aspect * dist, lower = screen.midY * TAN_V * dist;
  const up = { x: -toward.x * sinE, y: cosE, z: -toward.z * sinE };
  return {
    x: gx / n + DIR.x * dist + right.x * sideways - up.x * lower,
    y: DIR.y * dist - up.y * lower,
    z: gz / n + DIR.z * dist + right.z * sideways - up.z * lower,
  };
}

export interface Sight { who: Who; cell: number; land: number; creature: number; share: number }

/** How much of each creature the land and the other creatures hide from the camera: sample points walked along the view ray. */
export function sightOf(lv: Level, s: State, screen: Screen = LANDSCAPE): Sight[] {
  const all = bodies(lv, s), cam = cameraOf(lv, screen, SOLVED_SCREENS.includes(screen) ? s : lv.start);
  return all.map(c => {
    const others = all.filter(o => o !== c && o.cell !== c.cell); // a buoy under a creature is drawn shoved to the corner: not this check
    let land = 0, creature = 0, total = 0, any = 0;
    for (const f of [0.15, 0.5, 0.9]) for (const side of [-1, -0.5, 0, 0.5, 1]) {
      total++;
      const off = side * WIDE[c.who];
      const sx = c.x + off * Math.cos(CAM_AZ), sz = c.z - off * Math.sin(CAM_AZ), sy = c.y + f * TALL[c.who];
      const len = Math.hypot(cam.x - sx, cam.y - sy, cam.z - sz), vx = (cam.x - sx) / len, vy = (cam.y - sy) / len, vz = (cam.z - sz) / len;
      let byLand = false, byBody = false;
      for (let t = 0.2; t < 9; t += 0.05) {
        const rx = sx + vx * t, rz = sz + vz * t, ry = sy + vy * t;
        const cx = Math.round(rx), cz = Math.round(rz);
        if (!byLand && cx >= 0 && cz >= 0 && cx < lv.w && cz < lv.h) {
          const i = cx + cz * lv.w;
          if (s.plate[i] >= 0 && ry < topY(s.elev[i])) byLand = true;
        }
        if (!byBody) for (const o of others) {
          if (ry < o.y || ry > o.y + TALL[o.who]) continue;
          const ox = rx - o.x, oz = rz - o.z;
          if (ox * ox + oz * oz < WIDE[o.who] * WIDE[o.who]) { byBody = true; break; }
        }
        if (byLand && byBody) break;
      }
      if (byLand) land++;
      if (byBody) creature++;
      if (byLand || byBody) any++;
    }
    return { who: c.who, cell: c.cell, land: land / total, creature: creature / total, share: any / total };
  });
}

export interface PlateSight { plate: number; cells: number; share: number }

/** How much of each plate's top the land in front of it hides: a phone playtest lost most of a plate behind a ridge, and a
 *  plate the player cannot see is a plate they cannot think about or grab. */
export function plateSightOf(lv: Level, s: State, screen: Screen = LANDSCAPE): PlateSight[] {
  const cam = cameraOf(lv, screen, SOLVED_SCREENS.includes(screen) ? s : lv.start), out: PlateSight[] = [];
  for (let p = 0; p < lv.plates; p++) {
    let total = 0, hidden = 0, cells = 0;
    for (let i = 0; i < s.plate.length; i++) {
      if (s.plate[i] !== p) continue;
      cells++;
      const x = i % lv.w, z = Math.floor(i / lv.w), y = topY(s.elev[i]);
      for (const [dx, dz] of [[0, 0], [-0.3, -0.3], [0.3, -0.3], [-0.3, 0.3], [0.3, 0.3]]) {
        total++;
        const sx = x + dx, sz = z + dz, len = Math.hypot(cam.x - sx, cam.y - y, cam.z - sz);
        const vx = (cam.x - sx) / len, vy = (cam.y - y) / len, vz = (cam.z - sz) / len;
        for (let t = 0.05; t < 9; t += 0.05) {
          const cx = Math.round(sx + vx * t), cz = Math.round(sz + vz * t);
          if (cx < 0 || cz < 0 || cx >= lv.w || cz >= lv.h) continue;
          const j = cx + cz * lv.w;
          if (s.plate[j] >= 0 && y + vy * t < topY(s.elev[j])) { hidden++; break; }
        }
      }
    }
    if (cells) out.push({ plate: p, cells, share: hidden / total });
  }
  return out;
}

/** One sentence per creature or plate that one of these screens mostly cannot see on this board. */
export function hiddenOn(lv: Level, s: State, label: string, screens: Screen[] = PLAY_SCREENS): string[] {
  const out = new Map<string, string>();
  for (const screen of screens) {
    for (const v of sightOf(lv, s, screen)) if (v.share >= MOSTLY) out.set(`${v.who}${v.cell}`,
      `${label}: the ${v.who} at ${v.cell % lv.w},${Math.floor(v.cell / lv.w)} is ${Math.round(v.share * 100)}% hidden on the ${screen.name} screen (land ${Math.round(v.land * 100)}%, creatures ${Math.round(v.creature * 100)}%)`);
    for (const v of plateSightOf(lv, s, screen)) if (v.share >= MOSTLY) out.set(`p${v.plate}`,
      `${label}: plate ${String.fromCharCode(97 + v.plate)} is ${Math.round(v.share * 100)}% hidden behind raised land on the ${screen.name} screen`);
  }
  return [...out.values()];
}
