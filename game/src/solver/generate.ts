// Level generator: Voronoi plates on an island inside an ocean ring, random creatures and an optional buoy.
// Ported from spikes/plates/plates.ts with the same RNG call order, so a seed gives the same level as the spike
// (spike env AXIS=<maxTravel> and PLACE=1 become the options below).
import { DX, DY, type Level, type Obj } from '../rules/rules.ts';

export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0; let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface GenOptions { w?: number; h?: number; plates?: number; maxTravel?: number; /** creatures and buoys on seam cells */ place?: boolean }

export function generate(seed: number, o: GenOptions = {}): Level {
  const { w = 7, h = 7, plates = 3, maxTravel = 2, place = false } = o;
  const r = rng(seed);
  const n = w * h;
  const plate = new Int8Array(n), elev = new Int8Array(n);
  const sites = Array.from({ length: plates }, () => [1 + Math.floor(r() * (w - 2)), 1 + Math.floor(r() * (h - 2))]);
  for (let i = 0; i < n; i++) {
    const x = i % w, y = Math.floor(i / w);
    if (x === 0 || y === 0 || x === w - 1 || y === h - 1) { plate[i] = -1; continue; }
    let best = 0, bd = 1e9;
    sites.forEach(([sx, sy], k) => { const dd = (sx - x) ** 2 + (sy - y) ** 2; if (dd < bd) { bd = dd; best = k; } });
    plate[i] = best; elev[i] = r() < 0.15 ? 1 : 0;
  }
  const land = [...Array(n).keys()].filter(i => plate[i] >= 0);
  const pick = (arr: number[]) => arr.splice(Math.floor(r() * arr.length), 1)[0];
  const seam = (i: number) => {
    const x = i % w, y = Math.floor(i / w);
    return [0, 1, 2, 3].some(d => { const j = x + DX[d] + (y + DY[d]) * w; return plate[j] >= 0 && plate[j] !== plate[i]; });
  };
  const seamLand = land.filter(seam);
  const pickSeam = () => {
    if (place && seamLand.length) { const c = pick(seamLand); land.splice(land.indexOf(c), 1); return c; }
    const c = pick(land); const k = seamLand.indexOf(c); if (k >= 0) seamLand.splice(k, 1); return c;
  };
  const objs: Obj[] = [];
  const goats = 1 + Math.floor(r() * 2), villages = Math.floor(r() * 3), lights = Math.floor(r() * 2);
  for (let i = 0; i < goats; i++) objs.push({ kind: 'goat', cell: pickSeam() });
  for (let i = 0; i < villages; i++) objs.push({ kind: 'village', cell: pickSeam() });
  for (let i = 0; i < lights; i++) { const c = pick(land); const k = seamLand.indexOf(c); if (k >= 0) seamLand.splice(k, 1); objs.push({ kind: 'light', cell: c }); }
  const interior = land.filter(i => { const x = i % w, y = Math.floor(i / w); return x > 1 && y > 1 && x < w - 2 && y < h - 2 && (!place || seam(i)); });
  const buoys = r() < 0.5 && interior.length ? [pick(interior)] : [];
  const axis = Array.from({ length: plates }, () => (r() < 0.5 ? 0 : 1));
  return { w, h, plates, axis, maxTravel, buoys, start: { plate, elev, objs } };
}
