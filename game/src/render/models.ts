// Low-poly creature and prop models, built from primitives with vertex colours (shipped art is code: docs/PLAN.md).
// Reference: concepts/shiftland-creatures.png, shiftland-biomes.png. All sizes in cell units (a cell is 1 x 1).
import { BufferGeometry, Color, ConeGeometry, CylinderGeometry, DodecahedronGeometry, BoxGeometry, Float32BufferAttribute, IcosahedronGeometry, LatheGeometry, Matrix4, Quaternion, SphereGeometry, TorusGeometry, Vector2, Vector3, Euler, ExtrudeGeometry, Shape } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

type P = { g: BufferGeometry; c: string; p?: [number, number, number]; r?: [number, number, number]; s?: [number, number, number] };

function bake({ g, c, p = [0, 0, 0], r = [0, 0, 0], s = [1, 1, 1] }: P): BufferGeometry {
  const m = new Matrix4().compose(new Vector3(...p), new Quaternion().setFromEuler(new Euler(...r)), new Vector3(...s));
  const out = (g.index ? g.toNonIndexed() : g.clone()).applyMatrix4(m);
  out.computeVertexNormals();
  const col = new Color(c), n = out.getAttribute('position').count, arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { arr[i * 3] = col.r; arr[i * 3 + 1] = col.g; arr[i * 3 + 2] = col.b; }
  out.setAttribute('color', new Float32BufferAttribute(arr, 3));
  out.deleteAttribute('uv');
  return out;
}
const merge = (ps: P[]) => mergeGeometries(ps.map(bake))!;

const box = (w: number, h: number, d: number) => new BoxGeometry(w, h, d);
const cyl = (t: number, b: number, h: number, n = 8) => new CylinderGeometry(t, b, h, n);
const cone = (r: number, h: number, n = 6) => new ConeGeometry(r, h, n);
const ico = (r: number, d = 0) => new IcosahedronGeometry(r, d);
const dod = (r: number) => new DodecahedronGeometry(r);
const sph = (r: number, a = 8, b = 6) => new SphereGeometry(r, a, b);
const tor = (r: number, t: number) => new TorusGeometry(r, t, 5, 10);

// GOAT: faces +z. The stand pose holds legs and body, the head is separate so it can nod.
const CREAM = '#f6ead8', SHADE = '#e2cdb0', HOOF = '#5a3d2b', HORN = '#8f5e35', DARK = '#2a2320';
export const GOAT_HIP = 0.2, GOAT_HEAD: [number, number, number] = [0, 0.49, 0.215];
// Slim and long-legged, as on the sheet: a goat is its silhouette, a back line, a raised neck and a horn arc.
export const goatBody = merge([
  { g: box(0.15, 0.145, 0.34), c: CREAM, p: [0, 0.275, -0.01] },
  { g: box(0.145, 0.15, 0.1), c: CREAM, p: [0, 0.285, 0.145] },                            // chest
  { g: box(0.155, 0.125, 0.1), c: SHADE, p: [0, 0.285, -0.15] },                           // rump
  { g: box(0.115, 0.03, 0.24), c: SHADE, p: [0, 0.195, 0] },                               // belly
  { g: box(0.085, 0.21, 0.09), c: CREAM, p: [0, 0.39, 0.175], r: [0.42, 0, 0] },           // neck
  { g: box(0.032, 0.085, 0.032), c: SHADE, p: [0, 0.37, -0.205], r: [-0.65, 0, 0] },       // tail, up and back
]);
const goatLeg = (x: number, z: number, c: string): P[] => [
  { g: box(0.042, 0.19, 0.046), c, p: [x, 0.1 - GOAT_HIP, z] },
  { g: box(0.05, 0.04, 0.056), c: HOOF, p: [x, 0.02 - GOAT_HIP, z] },
];
/** Origin at the hip, so the legs fold when the goat flops. */
export const goatLegs = merge([...goatLeg(-0.052, 0.13, CREAM), ...goatLeg(0.052, 0.13, CREAM), ...goatLeg(-0.052, -0.135, SHADE), ...goatLeg(0.052, -0.135, SHADE)]);
// Three thin segments per horn: up, back, then the tip sweeps down: the arc that makes it a goat at 40 px.
const horn = (sx: number): P[] => [
  { g: cyl(0.017, 0.023, 0.08, 5), c: HORN, p: [sx * 0.03, 0.085, -0.03], r: [-0.35, 0, -sx * 0.12] },
  { g: cyl(0.013, 0.017, 0.075, 5), c: HORN, p: [sx * 0.038, 0.142, -0.073], r: [-0.95, 0, -sx * 0.12] },
  { g: cone(0.013, 0.07, 5), c: HORN, p: [sx * 0.046, 0.167, -0.138], r: [-1.72, 0, 0] },
];
export const goatHead = merge([
  { g: box(0.095, 0.1, 0.115), c: CREAM, p: [0, 0, 0] },
  { g: box(0.072, 0.066, 0.09), c: '#fff7ea', p: [0, -0.03, 0.09] },                       // muzzle
  { g: box(0.042, 0.018, 0.008), c: '#c98a7a', p: [0, -0.012, 0.136] },                    // nose
  { g: box(0.026, 0.052, 0.022), c: '#fff7ea', p: [0, -0.082, 0.1] },                      // beard
  { g: box(0.014, 0.03, 0.026), c: DARK, p: [-0.047, 0.012, 0.045] }, { g: box(0.014, 0.03, 0.026), c: DARK, p: [0.047, 0.012, 0.045] },
  { g: box(0.08, 0.024, 0.036), c: SHADE, p: [-0.08, 0.018, -0.03], r: [0, 0, 0.32] }, { g: box(0.08, 0.024, 0.036), c: SHADE, p: [0.08, 0.018, -0.03], r: [0, 0, -0.32] },
  ...horn(-1), ...horn(1),
]);
export const goatBrows = merge([
  { g: box(0.018, 0.01, 0.034), c: DARK, p: [-0.05, 0.04, 0.05], r: [0.45, 0, 0] },         // outer ends low: sad, not cross
  { g: box(0.018, 0.01, 0.034), c: DARK, p: [0.05, 0.04, 0.05], r: [0.45, 0, 0] },
]);

// VILLAGE: one house; a village is three, placed and tilted by the creature view.
const gable = (() => {
  const s = new Shape(); s.moveTo(-0.13, 0); s.lineTo(0.13, 0); s.lineTo(0, 0.13); s.closePath();
  const g = new ExtrudeGeometry(s, { depth: 0.24, bevelEnabled: false }); g.translate(0, 0, -0.12); return g;
})();
export const house = merge([
  { g: box(0.2, 0.15, 0.2), c: '#fbe8cd', p: [0, 0.075, 0] },
  { g: gable, c: '#d9483a', p: [0, 0.15, 0] },
  { g: box(0.052, 0.09, 0.012), c: '#7a4a2a', p: [0, 0.045, 0.102] },
  { g: box(0.04, 0.04, 0.012), c: '#ffd76b', p: [0.06, 0.09, 0.102] }, { g: box(0.04, 0.04, 0.012), c: '#ffd76b', p: [-0.06, 0.09, 0.102] },
  { g: box(0.012, 0.04, 0.05), c: '#ffd76b', p: [0.102, 0.09, 0] },
  { g: box(0.035, 0.1, 0.035), c: '#7c6a5f', p: [0.05, 0.255, -0.04] },
]);
export const houseCracks = merge([
  { g: box(0.012, 0.09, 0.006), c: '#3a2a22', p: [-0.03, 0.09, 0.103], r: [0, 0, 0.4] },
  { g: box(0.009, 0.05, 0.006), c: '#3a2a22', p: [0.03, 0.05, 0.103], r: [0, 0, -0.5] },
  { g: box(0.1, 0.012, 0.012), c: '#3a2a22', p: [0.02, 0.2, 0.09], r: [0, 0, 0.5] },
]);

// LIGHTHOUSE: tower plus separate lamp (glows when happy).
const stripeT = (y: number, r0: number, r1: number, h: number, c: string): P => ({ g: cyl(r1, r0, h, 10), c, p: [0, y + h / 2, 0] });
export const lighthouse = merge([
  { g: cyl(0.2, 0.22, 0.05, 10), c: '#8c8a88', p: [0, 0.025, 0] },
  stripeT(0.05, 0.17, 0.15, 0.13, '#f6f0e6'), stripeT(0.18, 0.15, 0.135, 0.13, '#dd4239'),
  stripeT(0.31, 0.135, 0.12, 0.13, '#f6f0e6'), stripeT(0.44, 0.12, 0.105, 0.12, '#dd4239'),
  { g: cyl(0.145, 0.13, 0.03, 10), c: '#3b3b44', p: [0, 0.575, 0] },
  { g: cyl(0.1, 0.1, 0.022, 10), c: '#3b3b44', p: [0, 0.71, 0] },
  { g: cone(0.125, 0.11, 10), c: '#d43d35', p: [0, 0.775, 0] },
  { g: sph(0.022), c: '#ffcf5c', p: [0, 0.84, 0] },
  { g: box(0.06, 0.085, 0.03), c: '#6e4227', p: [0, 0.092, 0.15] },
]);
export const lamp = merge([{ g: cyl(0.075, 0.075, 0.125, 10), c: '#ffe894', p: [0, 0.645, 0] }]);

// BUOY: faces any way; origin at its waterline.
// A bell turned on a lathe: skirt, white belt, red shoulder; round and solid, like the sheet's.
const bell = (pts: [number, number][]) => new LatheGeometry(pts.map(([r, y]) => new Vector2(r, y)), 20);
export const buoy = merge([
  { g: bell([[0, -0.01], [0.17, -0.01], [0.215, 0.025], [0.222, 0.06], [0.212, 0.095]]), c: '#e04238' },
  { g: bell([[0.212, 0.095], [0.196, 0.135], [0.17, 0.18]]), c: '#f8f3ea' },
  { g: bell([[0.17, 0.18], [0.14, 0.23], [0.1, 0.275], [0.056, 0.31], [0.022, 0.325], [0, 0.327]]), c: '#e04238' },
  { g: tor(0.046, 0.015), c: '#d03a33', p: [0, 0.378, 0] },
]);
export const fish = merge([
  { g: sph(0.05, 6, 4), c: '#5b7fa5', s: [1, 0.75, 1.9] },
  { g: cone(0.045, 0.07, 4), c: '#39597e', p: [0, 0, -0.11], r: [-Math.PI / 2, 0, 0] },
  { g: box(0.012, 0.012, 0.012), c: '#111', p: [0.04, 0.012, 0.05] }, { g: box(0.012, 0.012, 0.012), c: '#111', p: [-0.04, 0.012, 0.05] },
]);

// PALM OASIS
const seg = (x: number, y: number, tilt: number, top: number, bottom: number, len: number, c: string): P => ({ g: cyl(top, bottom, len, 6), c, p: [x, y, 0], r: [0, 0, -tilt] });
// Two segments per frond, so each one arcs out and droops like a palm leaf and not a propeller blade.
const fronds = (ox: number, oy: number, up: number, cA: string, cB: string) => {
  const out: P[] = [];
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2 + 0.3, c = i % 2 ? cA : cB;
    const t1 = up, t2 = up + 0.72, ca = Math.cos(a), sa = Math.sin(a);
    const d1 = [Math.cos(t1) * ca, -Math.sin(t1), Math.cos(t1) * sa], d2 = [Math.cos(t2) * ca, -Math.sin(t2), Math.cos(t2) * sa];
    out.push({ g: box(0.15, 0.018, 0.09), c, p: [ox + d1[0] * 0.075, oy + d1[1] * 0.075, d1[2] * 0.075], r: [0, -a, -t1] });
    out.push({ g: box(0.14, 0.014, 0.06), c, p: [ox + d1[0] * 0.15 + d2[0] * 0.06, oy + d1[1] * 0.15 + d2[1] * 0.06, d1[2] * 0.15 + d2[2] * 0.06], r: [0, -a, -t2] });
  }
  return out;
};
export const palm = merge([
  seg(0.004, 0.07, 0.08, 0.036, 0.052, 0.14, '#8c5f39'), seg(0.022, 0.2, 0.2, 0.03, 0.037, 0.14, '#7d5431'), seg(0.058, 0.325, 0.36, 0.026, 0.031, 0.13, '#8c5f39'),
  ...fronds(0.085, 0.395, -0.28, '#4ea344', '#3d8c3a'),
]);
// Unhappy: the trunk bows over until its crown lies on the sand (concepts/shiftland-creatures.png).
export const palmWilt = merge([
  seg(0.02, 0.06, 0.35, 0.036, 0.052, 0.13, '#8c5f39'), seg(0.096, 0.16, 0.95, 0.03, 0.037, 0.13, '#7d5431'), seg(0.214, 0.198, 1.6, 0.027, 0.031, 0.13, '#8c5f39'), seg(0.318, 0.168, 2.2, 0.022, 0.028, 0.1, '#7d5431'),
  ...fronds(0.355, 0.135, 0.55, '#7f9a3f', '#94a64a'),
]);

// PENGUIN
export const penguin = merge([
  { g: sph(0.075, 8, 6), c: '#22262e', p: [0, 0.105, 0], s: [1, 1.3, 0.92] },
  { g: sph(0.056, 8, 6), c: '#f5f6f7', p: [0, 0.09, 0.03], s: [0.9, 1.25, 0.82] },
  { g: sph(0.052, 8, 6), c: '#22262e', p: [0, 0.205, 0.004] },
  { g: cone(0.018, 0.05, 5), c: '#f09a2a', p: [0, 0.2, 0.065], r: [Math.PI / 2, 0, 0] },
  { g: box(0.012, 0.016, 0.006), c: '#fff', p: [-0.022, 0.22, 0.05] }, { g: box(0.012, 0.016, 0.006), c: '#fff', p: [0.022, 0.22, 0.05] },
  { g: box(0.02, 0.09, 0.05), c: '#1a1d24', p: [-0.078, 0.11, 0], r: [0, 0, -0.25] }, { g: box(0.02, 0.09, 0.05), c: '#1a1d24', p: [0.078, 0.11, 0], r: [0, 0, 0.25] },
  { g: box(0.04, 0.012, 0.055), c: '#f09a2a', p: [-0.03, 0.006, 0.02] }, { g: box(0.04, 0.012, 0.055), c: '#f09a2a', p: [0.03, 0.006, 0.02] },
]);

// DECOR
export const tree = merge([
  { g: cyl(0.025, 0.035, 0.12, 6), c: '#7a5233', p: [0, 0.06, 0] },
  { g: ico(0.1), c: '#3f9a3e', p: [0, 0.17, 0] },
  { g: ico(0.075), c: '#57b34a', p: [0.035, 0.235, 0.02] },
]);
export const pine = merge([
  { g: cyl(0.018, 0.024, 0.07, 5), c: '#6d4b34', p: [0, 0.035, 0] },
  { g: cone(0.09, 0.14, 6), c: '#3b6f5c', p: [0, 0.13, 0] }, { g: cone(0.07, 0.12, 6), c: '#4f8a70', p: [0, 0.21, 0] },
  { g: cone(0.04, 0.06, 6), c: '#f3f7fa', p: [0, 0.285, 0] },
]);
export const tuft = merge([
  { g: cone(0.018, 0.08, 4), c: '#3fa23e', p: [-0.02, 0.04, 0], r: [0, 0, 0.25] }, { g: cone(0.02, 0.1, 4), c: '#4cb14a', p: [0.005, 0.05, 0] },
  { g: cone(0.018, 0.075, 4), c: '#2f8d39', p: [0.03, 0.037, 0.005], r: [0, 0, -0.3] },
]);
export const dryTuft = merge([
  { g: cone(0.016, 0.08, 4), c: '#b6a34e', p: [-0.02, 0.04, 0], r: [0, 0, 0.3] }, { g: cone(0.018, 0.1, 4), c: '#c4b25a', p: [0.005, 0.05, 0] },
  { g: cone(0.016, 0.075, 4), c: '#a4923f', p: [0.03, 0.037, 0.005], r: [0, 0, -0.34] },
]);
export const rock = merge([{ g: dod(0.06), c: '#8f8c88', p: [0, 0.03, 0], s: [1.2, 0.72, 1] }, { g: dod(0.035), c: '#a5a29d', p: [0.055, 0.02, 0.02], s: [1, 0.7, 1] }]);
export const cactus = merge([
  { g: cyl(0.03, 0.034, 0.2, 7), c: '#3f9149', p: [0, 0.1, 0] }, { g: sph(0.03, 7, 4), c: '#3f9149', p: [0, 0.2, 0] },
  { g: cyl(0.018, 0.018, 0.06, 6), c: '#47a052', p: [0.05, 0.11, 0], r: [0, 0, Math.PI / 2] }, { g: cyl(0.018, 0.018, 0.06, 6), c: '#47a052', p: [0.078, 0.14, 0] },
  { g: cyl(0.016, 0.016, 0.05, 6), c: '#47a052', p: [-0.048, 0.08, 0], r: [0, 0, Math.PI / 2] }, { g: cyl(0.016, 0.016, 0.05, 6), c: '#47a052', p: [-0.07, 0.105, 0] },
]);
export const flower = merge([
  { g: cyl(0.004, 0.004, 0.05, 4), c: '#3e8e3a', p: [0, 0.025, 0] }, { g: ico(0.018), c: '#ffe066', p: [0, 0.055, 0] },
  { g: cyl(0.004, 0.004, 0.04, 4), c: '#3e8e3a', p: [0.035, 0.02, 0.02] }, { g: ico(0.015), c: '#ff8fa8', p: [0.035, 0.044, 0.02] },
]);
export const anchorRock = merge([
  { g: dod(0.27), c: '#55585f', p: [0, 0.2, 0], s: [1, 1.15, 1] }, { g: dod(0.15), c: '#6a6d74', p: [0.17, 0.09, 0.08] },
  { g: dod(0.11), c: '#494b52', p: [-0.2, 0.06, 0.05] },
  { g: tor(0.07, 0.022), c: '#d6d8dc', p: [0, 0.3, 0.215], r: [0, 0.25, 0.8] }, { g: tor(0.07, 0.022), c: '#c0c3c9', p: [0.075, 0.2, 0.235], r: [0, 0.25, -0.5] },
]);
export const iceShard = merge([
  { g: dod(0.05), c: '#d6f3ff', p: [0, 0.03, 0], s: [1, 1.7, 1] }, { g: dod(0.03), c: '#f1fcff', p: [0.05, 0.02, 0.02], s: [1, 1.5, 1] },
]);
export const flag = merge([
  { g: cyl(0.012, 0.012, 0.4, 5), c: '#6b4a32', p: [0, 0.2, 0] },
  { g: box(0.18, 0.1, 0.012), c: '#e04238', p: [0.09, 0.34, 0] },
]);
export const cloud = merge([
  { g: ico(1, 1), c: '#ffffff', p: [0, 0, 0], s: [1.4, 0.75, 1] }, { g: ico(0.8, 1), c: '#f6fbff', p: [1.15, -0.1, 0.1], s: [1.2, 0.7, 1] },
  { g: ico(0.75, 1), c: '#fafdff', p: [-1.15, -0.12, -0.1], s: [1.2, 0.68, 1] },
  { g: ico(0.7, 1), c: '#ffffff', p: [0.35, 0.05, 0.9], s: [1.15, 0.7, 1] }, { g: ico(0.62, 1), c: '#f2f8fd', p: [-0.55, -0.05, -0.85], s: [1.2, 0.66, 1] },
  { g: ico(0.5, 1), c: '#f6fbff', p: [1.95, -0.2, -0.45], s: [1.1, 0.6, 1] },
]);
/** A flat double-headed arrow along x, lying on a plate: which way the plate slides. */
export const axisMark = (() => {
  const s = new Shape(), L = .3, H = .13, W = .035, N = .15;
  s.moveTo(-L, 0); s.lineTo(-L + N, H); s.lineTo(-L + N, W); s.lineTo(L - N, W); s.lineTo(L - N, H); s.lineTo(L, 0);
  s.lineTo(L - N, -H); s.lineTo(L - N, -W); s.lineTo(-L + N, -W); s.lineTo(-L + N, -H); s.closePath();
  return new ExtrudeGeometry(s, { depth: .004, bevelEnabled: false }).rotateX(-Math.PI / 2);
})();
export const gull = merge([
  { g: box(0.34, 0.012, 0.075), c: '#ffffff', p: [-0.16, 0.02, 0], r: [0, 0, 0.32] }, { g: box(0.34, 0.012, 0.075), c: '#ffffff', p: [0.16, 0.02, 0], r: [0, 0, -0.32] },
  { g: box(0.05, 0.05, 0.2), c: '#f2f4f6', p: [0, 0, 0] },
]);
