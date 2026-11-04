// The whole game world: one continuous ocean with an island per level. The camera flies between islands: the level
// select is simply the camera pulled back over the real archipelago, and each island shows its real level.
import { AmbientLight, BoxGeometry, BufferAttribute, CatmullRomCurve3, Color, CylinderGeometry, DirectionalLight, Group, HemisphereLight, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial, MeshLambertMaterial, type Object3D, PCFShadowMap, PerspectiveCamera, Plane, Raycaster, Scene, Vector2, Vector3, WebGLRenderer, WebGLRenderTarget } from 'three';
import { goalsMet, type Level, type State } from '../rules/rules.ts';
import { fillGaps, packContinent } from './continent.ts';
import { heroLevel, heroPushed } from './hero.ts';
import { IslandView, MOVE_TIME } from './island.ts';
import * as M from './models.ts';
import { Mask, MASK_RANGE, Ocean, type LandRect } from './ocean.ts';
import { BIOMES, DAYLIGHT, type DayLight, MORNING, topY } from './palette.ts';
import { SeaLife } from './sealife.ts';
import { toUV } from './seaway.ts';
import { Particles } from './particles.ts';
import { makeTerrainMaterial } from './terrain.ts';
import { MAT, Creature, type CreatureKind } from './creatures.ts';

const AZ = 0.72, EL = 0.82; // camera azimuth and elevation, radians
const CAM_DIR = new Vector3(Math.sin(AZ) * Math.cos(EL), Math.sin(EL), Math.cos(AZ) * Math.cos(EL));

const smooth = (a: number, b: number, k: number, dt: number) => a + (b - a) * (1 - Math.exp(-k * dt));
const ease = (t: number) => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
/** Three's own pass visits every object each frame, and about nine in ten here are hidden detail. Anything that reads a hidden object's place asks through its parents, which still works. */
function updateVisibleMatrices(o: Object3D) {
  if (o.matrixAutoUpdate) o.updateMatrix();
  if (o.parent) o.matrixWorld.multiplyMatrices(o.parent.matrixWorld, o.matrix); else o.matrixWorld.copy(o.matrix);
  o.matrixWorldNeedsUpdate = false;
  const kids = o.children;
  for (let i = 0; i < kids.length; i++) if (kids[i].visible) updateVisibleMatrices(kids[i]);
}

export interface WorldSfx { (s: 'bleat' | 'fish', o?: { pan?: number }): void }
export type PadKind = 'level' | 'solved' | 'title';
interface Pad { top: number; bottom: number; left: number; right: number }

export class World {
  renderer: WebGLRenderer; scene = new Scene(); camera: PerspectiveCamera;
  time = { value: 0 };
  fx: Particles; ocean: Ocean; staticMask: Mask; activeMask: Mask;
  views: IslandView[] = [];
  active: IslandView | null = null;
  sun: DirectionalLight;
  reducedMotion = false;
  private lastNow = performance.now();
  private ray = new Raycaster();
  private focus = new Vector3(); private dist = 40;
  private fly: { from: Vector3; to: Vector3; d0: number; d1: number; t: number; dur: number; arc: number; done?: () => void } | null = null;
  private shake = 0;
  private drift = 0;
  private map = true;
  private seaLife!: SeaLife;
  private clouds: { o: Mesh; v: number }[] = [];
  private gulls: { g: Group; a: number; r: number; c: Vector3; s: number; flap: number }[] = [];
  private frameHook: ((dt: number, t: number) => void) | null = null;
  private timers: { at: number; fn: () => void }[] = [];
  private aabb = { x0: 0, x1: 0, z0: 0, z1: 0 };
  hudPad: Pad = { top: 0.12, bottom: 0.2, left: 0, right: 0 };
  /** How tall the goal chips stand right now; the app knows, the framing asks. */
  goalsHeight = () => 0;
  private padKind: PadKind = 'level';
  private path: Mesh | InstancedMesh | null = null;
  pins: { el: HTMLElement; pos: Vector3; hide?: () => boolean }[] = [];

  /** The title loop's sounds; silent until the audio is unlocked by a first touch. */
  heroSfx?: (s: 'slide' | 'uplift', o: { plate?: number; intensity?: number }) => void;
  constructor(canvas: HTMLCanvasElement, levels: Level[], sfx: WorldSfx, positions: [number, number][]) {
    this.scene.matrixWorldAutoUpdate = false; // updateVisibleMatrices does it, once a frame
    const renderer = this.renderer = new WebGLRenderer({ canvas, antialias: true, stencil: true, powerPreference: 'high-performance', preserveDrawingBuffer: false });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = PCFShadowMap;
    this.camera = new PerspectiveCamera(20, 1, 2, 3000);

    const terrain = makeTerrainMaterial(this.time);
    this.fx = new Particles(this.scene);
    const host = { fx: this.fx, terrain, sfx };
    levels.forEach((lv, i) => {
      const [x, z] = positions[i];
      const v = new IslandView(lv, i, x, z, host);
      v.goalsFn = goalsMet;
      v.applyGoals(goalsMet(lv, lv.start), false);
      this.views.push(v); this.scene.add(v.group);
    });
    // world bounds for the static mask
    let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
    for (const [x, z] of positions) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
    // the title's island sits out at sea off the map's far corner: only the title ever sees it
    this.hero = new IslandView(heroLevel(), -1, x1 + 34, z0 - 34, host);
    this.hero.goalsFn = goalsMet;
    this.heroUp = heroPushed(this.hero.lv);
    this.hero.alsoFrame = this.heroUp;
    this.hero.reconcile(this.heroUp, false);
    this.hero.applyGoals(goalsMet(this.hero.lv, this.heroUp), false);
    this.hero.group.visible = false;
    this.scene.add(this.hero.group);
    const pad = 12; x0 -= pad; x1 += pad; z0 -= pad; z1 += pad;
    this.aabb = { x0, x1, z0, z1 };
    const sw = x1 - x0, sh = z1 - z0, ppu = 5;
    this.staticMask = new Mask(Math.min(1024, Math.ceil(sw * ppu)), Math.min(1024, Math.ceil(sh * ppu)), x0, z0, [sw, sh]);
    this.activeMask = new Mask(256, 256, -1000, -1000, [20, 20], true);
    this.ocean = new Ocean(this.staticMask, this.activeMask, this.time);
    this.scene.add(this.ocean.mesh);

    this.scene.add(this.hemi);
    this.scene.add(new AmbientLight('#ffffff', .35));
    const sun = this.sun = new DirectionalLight('#fff3dc', 2.35);
    sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.bias = -0.0012; sun.shadow.normalBias = 0.035; sun.shadow.radius = 1.4;
    this.scene.add(sun, sun.target);
    this.setShadowSpan(13);

    this.scene.background = new Color('#0e7fae');
    // clouds drifting high up; they read only from the map and add parallax when flying
    const cloudMat = new MeshLambertMaterial({ vertexColors: true, flatShading: true, transparent: true, opacity: .92 });
    for (let i = 0; i < 6; i++) {
      const o = new Mesh(M.cloud, cloudMat);
      o.position.set(x0 + Math.random() * sw, 10 + Math.random() * 6, z0 + Math.random() * sh);
      o.scale.setScalar(1.5 + Math.random() * 1.2); o.rotation.y = -.72 + (Math.random() - .5) * .6;
      this.scene.add(o); this.clouds.push({ o, v: .25 + Math.random() * .3 });
    }
    for (let i = 0; i < 6; i++) {
      const g = new Group(); g.scale.setScalar(.8);
      g.add(new Mesh(M.gullBody, MAT), new Mesh(M.gullWingR, MAT), new Mesh(M.gullWingL, MAT));
      this.scene.add(g); this.gulls.push({ g, a: Math.random() * 6.28, r: 3 + Math.random() * 5, c: new Vector3(x0 + Math.random() * sw, 3 + Math.random() * 2.5, z0 + Math.random() * sh), s: .25 + Math.random() * .2, flap: 0 });
    }
    this.buildPath(positions);
    const reefs = this.views.map(v => { const b = v.frameBox(); return { x: v.ox + b.cx, z: v.oz + b.cz, r: Math.hypot(b.hx, b.hz) + 2 }; });
    const uv = positions.map(([x, z]) => toUV(x, z, .72)), us = uv.map(p => p[0]), vs = uv.map(p => p[1]);
    this.seaLife = new SeaLife(this.scene, reefs, { u0: Math.min(...us) - 3, u1: Math.max(...us) + 3, v0: Math.min(...vs) - 3, v1: Math.max(...vs) + 3, az: .72 }, this.fx, (x, y, z) => this.fx.smoke(x, y, z));
    this.resize();
    addEventListener('resize', () => this.resize());
    this.writeStatic();
    renderer.setAnimationLoop(() => this.frame());
  }

  onFrame(fn: (dt: number, t: number) => void) { this.frameHook = fn; }
  after(sec: number, fn: () => void) { this.timers.push({ at: this.time.value + sec, fn }); }
  shakeCam(k: number) { if (!this.reducedMotion) this.shake = Math.max(this.shake, k); }

  /** The dotted sea route that links the islands on the map, one curve through them in level order. */
  private buildPath(positions: [number, number][]) {
    if (positions.length < 2) return;
    const curve = new CatmullRomCurve3(positions.map(([x, z]) => new Vector3(x, .05, z)), false, 'catmullrom', .5);
    const dots: Vector3[] = [], n = Math.ceil(curve.getLength() / .95);
    for (const p of curve.getSpacedPoints(n)) if (this.views.every(v => Math.hypot(p.x - v.ox, p.z - v.oz) > v.span * .62 + .4)) dots.push(p);
    const mesh = new InstancedMesh(new CylinderGeometry(.23, .23, .02, 12), new MeshBasicMaterial({ color: '#fff7e6' }), dots.length);
    dots.forEach((p, i) => mesh.setMatrixAt(i, new Matrix4().makeTranslation(p.x, p.y, p.z)));
    mesh.instanceMatrix.needsUpdate = true; mesh.frustumCulled = false; mesh.visible = false;
    this.scene.add(mesh); this.path = mesh;
  }

  private setShadowSpan(s: number) {
    const c = this.sun.shadow.camera;
    c.left = -s; c.right = s; c.top = s; c.bottom = -s; c.near = 1; c.far = 120; c.updateProjectionMatrix();
  }

  resize() {
    const w = innerWidth, h = innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
    this.hudPad = this.pads(this.padKind);
    if (this.active && !this.map && !this.fly) { this.dist = this.fitDistance(this.active); this.focus.copy(this.focusOf(this.active)); }
    else if (this.map && !this.fly) this.dist = this.mapDistance();
  }

  // ---- camera framing
  private fitDistance(v: IslandView) {
    return this.fit(v).dist;
  }
  private focusOf(v: IslandView) {
    return this.fit(v).focus;
  }
  /** The closest camera that keeps the island's real land (not its bounding box) between the HUD bars: the board is the game, it fills the screen. */
  private fit(v: IslandView) {
    const right = new Vector3().crossVectors(new Vector3(0, 1, 0), CAM_DIR).normalize(), up = new Vector3().crossVectors(CAM_DIR, right).normalize();
    const tanV = Math.tan((this.camera.fov * Math.PI / 180) / 2), tanH = tanV * this.camera.aspect;
    const P = this.hudPad, M = .015, xHi = 1 - 2 * (P.right + M), xLo = -1 + 2 * (P.left + M), yHi = 1 - 2 * (P.top + M), yLo = -1 + 2 * (P.bottom + M);
    const pts = v.framePoints(this.padKind === 'solved');
    // The board as it starts stays clear of the HUD; while playing, what it can become only has to stay on the screen.
    const soft = this.padKind === 'level' ? v.reachPoints() : [];
    const X = { hi: xHi, lo: xLo, sHi: 1 - 2 * M, sLo: -1 + 2 * M }, Y = { hi: yHi, lo: yLo, sHi: 1 - 2 * M, sLo: -1 + 2 * M };
    const focus = new Vector3(); let dist = 20;
    const box = (list: Vector3[]) => {
      let xa = 1e9, xb = -1e9, ya = 1e9, yb = -1e9;
      for (const q of list) {
        const d = q.clone().sub(focus), depth = dist - d.dot(CAM_DIR);
        const nx = d.dot(right) / (depth * tanH), ny = d.dot(up) / (depth * tanV);
        xa = Math.min(xa, nx); xb = Math.max(xb, nx); ya = Math.min(ya, ny); yb = Math.max(yb, ny);
      }
      return { xa, xb, ya, yb };
    };
    // how much bigger the view must get so both sets fit their limits at once
    const need = (a: number, b: number, sa: number, sb: number, L: typeof X) => soft.length
      ? Math.max((b - a) / (L.hi - L.lo), (sb - sa) / (L.sHi - L.sLo), (sb - a) / (L.sHi - L.lo), (b - sa) / (L.hi - L.sLo))
      : (b - a) / (L.hi - L.lo);
    // and the shift that sits them in the middle of what is allowed
    const mid = (a: number, b: number, sa: number, sb: number, L: typeof X) => soft.length
      ? (Math.max(L.lo - a, L.sLo - sa) + Math.min(L.hi - b, L.sHi - sb)) / 2
      : (L.lo - a + L.hi - b) / 2;
    // near points project larger than far ones, so a symmetric guess leaves the board low with room above it.
    // A few rounds of projecting and correcting settle it, as in mapFrame.
    for (let k = 0; k < 10; k++) {
      const h = box(pts), s = soft.length ? box(soft) : h;
      const scale = Math.max(need(h.xa, h.xb, s.xa, s.xb, X), need(h.ya, h.yb, s.ya, s.yb, Y));
      dist = Math.max(7, dist * scale);
      const sx = mid(h.xa / scale, h.xb / scale, s.xa / scale, s.xb / scale, X), sy = mid(h.ya / scale, h.yb / scale, s.ya / scale, s.yb / scale, Y);
      focus.addScaledVector(right, -sx * tanH * dist).addScaledVector(up, -sy * tanV * dist);
      focus.addScaledVector(CAM_DIR, -focus.y / CAM_DIR.y); // on the ground plane along the view direction
    }
    return { dist, focus: focus.add(new Vector3(v.ox, 0, v.oz)) };
  }
  /** The screen fractions the UI takes in each framing. Short landscape screens move the UI to the sides. */
  private pads(kind: PadKind): Pad {
    const w = innerWidth, h = innerHeight, short = h <= 560 && w > h, big = w >= 1600 && h >= 900; // big: the larger HUD in style.css
    if (kind === 'title') {
      if (short || w / h >= 1.3) return { top: .05, bottom: .05, left: .48, right: .02 };
      return { top: (Math.max(.03 * h, 72) + Math.min(780, .92 * w) / 3 + 24) / h, bottom: (.055 * h + 128) / h, left: 0, right: 0 };
    }
    if (kind === 'solved') {
      if (short) return { top: .04, bottom: .04, left: .02, right: .46 };
      // a wide screen has the panel at the side, so the finished island keeps its size: this is the picture the level was for
      if (w / h >= 1.3) return { top: .04, bottom: .06, left: .03, right: ((big ? 450 : Math.min(360, .92 * w)) + .05 * w + 24) / w };
      return { top: .03, bottom: Math.min(.46, 290 / h), left: 0, right: 0 };
    }
    if (short) return { top: .05, bottom: .08, left: .2, right: .02 };
    return { top: (big ? 76 : 60) / h, bottom: Math.max(84, this.goalsHeight() + 22) / h, left: 0, right: 0 };
  }
  /** Centre of the islands as the camera sees them (screen-aligned box), a little low so the title bar stays clear. */
  private mapCenter() { return this.mapFrame().focus; }
  private mapDistance() { return this.mapFrame().dist; }
  /** The camera that fits every island into the screen, between the title bar and whatever fills the bottom. */
  private mapFrame() {
    const right = new Vector3().crossVectors(new Vector3(0, 1, 0), CAM_DIR).normalize(); const up = new Vector3().crossVectors(CAM_DIR, right).normalize();
    // every island's corners, its height and its pin must land inside the free part of the screen
    const pts: Vector3[] = [];
    for (const v of this.views) {
      const b = v.frameBox();
      for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) for (const y of [0, b.top]) pts.push(new Vector3(v.ox + b.cx + sx * b.hx, y, v.oz + b.cz + sz * b.hz));
      const a = this.mapAnchors(v); pts.push(a.pin, a.label);
    }
    const tanV = Math.tan((this.camera.fov * Math.PI / 180) / 2), tanH = tanV * this.camera.aspect;
    // screen limits in NDC: room for the title bar on top, a pin's half size all round, and whatever fills the bottom
    // (the ending's panel: a short landscape screen has no bottom to give, so the panel stands at the right)
    const short = innerHeight <= 560 && innerWidth > innerHeight, side = short && this.mapBottom > 0 ? .46 : 0;
    const yHi = 1 - 2 * ((side ? 12 : 66) + 26) / innerHeight, yLo = -1 + 2 * ((side ? 0 : this.mapBottom) + 28 / innerHeight), xHi = 1 - 2 * 30 / innerWidth - 2 * side, xLo = -1 + 2 * 30 / innerWidth;
    const focus = new Vector3(); for (const v of this.views) focus.add(new Vector3(v.ox, 0, v.oz)); focus.divideScalar(this.views.length);
    let dist = 60;
    // perspective makes the fit depend on itself; a few rounds of projecting and correcting settle it
    for (let k = 0; k < 8; k++) {
      let xa = 1e9, xb = -1e9, ya = 1e9, yb = -1e9;
      for (const q of pts) {
        const d = q.clone().sub(focus), depth = dist - d.dot(CAM_DIR);
        const nx = d.dot(right) / (depth * tanH), ny = d.dot(up) / (depth * tanV);
        xa = Math.min(xa, nx); xb = Math.max(xb, nx); ya = Math.min(ya, ny); yb = Math.max(yb, ny);
      }
      dist *= Math.max((xb - xa) / (xHi - xLo), (yb - ya) / (yHi - yLo));
      focus.addScaledVector(right, ((xa + xb) - (xHi + xLo)) / 2 * tanH * dist).addScaledVector(up, ((ya + yb) - (yHi + yLo)) / 2 * tanV * dist);
      focus.addScaledVector(CAM_DIR, -focus.y / CAM_DIR.y); // keep it on the ground plane along the view direction
    }
    return { focus, dist: Math.max(20, dist) };
  }
  /** Fraction of the screen height the map must leave free at the bottom (the ending panel). */
  private mapBottom = 0;
  /** Reframe the active island into the free part of the screen (fractions of the height reserved at top and bottom). */
  frameActive(kind: PadKind, dur: number) {
    const v = this.active; if (!v) return;
    this.padKind = kind; this.hudPad = this.pads(kind);
    this.flyTo(this.focusOf(v), this.fitDistance(v), dur);
  }
  flyTo(target: Vector3, dist: number, dur: number, done?: () => void) {
    if (dur <= 0 || this.reducedMotion) { this.focus.copy(target); this.dist = dist; this.fly = null; done?.(); return; }
    const hop = this.focus.distanceTo(target);
    this.fly = { from: this.focus.clone(), to: target.clone(), d0: this.dist, d1: dist, t: 0, dur, arc: Math.min(hop * 1.1, 26), done };
  }
  focusIsland(i: number, dur = 1.3, done?: () => void) {
    const v = this.views[i];
    this.map = false;
    this.padKind = 'level'; this.hudPad = this.pads('level');
    this.setActive(v);
    this.setShadowSpan(13);
    this.flyTo(this.focusOf(v), this.fitDistance(v), dur, done);
  }
  showMap(dur = 1.1, bottom = 0, done?: () => void) {
    this.map = true; this.peekAt = null;
    this.mapBottom = bottom;
    this.seaTarget = ['#0f8fb4', '#26cfcb']; this.dayTarget = MORNING;
    this.setShadowSpan(70);
    this.flyTo(this.mapCenter(), this.mapDistance(), dur, done);
  }
  hero: IslandView;
  private heroUp!: State;
  private heroOut = false;
  private heroT = 0;
  /** The title's loop: rest on the pushed island, slide the plate back, push it in again. The first thing a player sees is the whole game. */
  private heroBeat(dt: number) {
    const v = this.hero, lv = v.lv;
    if (this.active !== v || this.fly || this.reducedMotion) return;
    this.heroT += dt;
    if (!this.heroOut && this.heroT > 5) {
      this.heroOut = true; this.heroT = 0;
      v.reconcile(lv.start, true, { fromRestart: true });
      this.after(MOVE_TIME + .05, () => { if (this.heroOut) v.applyGoals(goalsMet(lv, lv.start), true, false); });
    } else if (this.heroOut && this.heroT > 2.4) {
      this.heroOut = false; this.heroT = 0;
      const r = v.reconcile(this.heroUp, true);
      this.heroSfx?.('slide', { plate: 2 });
      this.after(MOVE_TIME * .45, () => {
        if (this.active !== v) return;
        this.shakeCam(.5);
        this.heroSfx?.('uplift', { intensity: .5 });
        for (const cell of r.rose) { const p = v.worldPos(cell); this.fx.dust(p.x, p.y - .1, p.z, 7); this.fx.rubble(p.x, p.y, p.z, 2); }
      });
      this.after(MOVE_TIME + .05, () => { if (!this.heroOut) v.applyGoals(goalsMet(lv, this.heroUp), true); });
    }
  }
  /** The title framing: the hero island large in the frame, offset to leave room for the logo. */
  focusTitle(dur = 0) {
    const v = this.hero;
    v.group.visible = true;
    this.heroT = 0;
    if (this.heroOut) { this.heroOut = false; v.reconcile(this.heroUp, false); v.applyGoals(goalsMet(v.lv, this.heroUp), false); }
    this.map = false;
    this.setActive(v);
    this.padKind = 'title'; this.hudPad = this.pads('title');
    this.setShadowSpan(13);
    this.flyTo(this.focusOf(v), this.fitDistance(v), dur);
  }
  /** Where a map pin (front of the island) and a biome label (behind it) sit. */
  mapAnchors(v: IslandView): { pin: Vector3; label: Vector3 } {
    const b = v.frameBox(), r = Math.max(b.hx, b.hz) * .78, fx = Math.sin(AZ), fz = Math.cos(AZ);
    return { pin: new Vector3(v.ox + b.cx + fx * r, 0, v.oz + b.cz + fz * r), label: new Vector3(v.ox + b.cx - fx * (r + 1.2), 1, v.oz + b.cz - fz * (r + 1.2)) };
  }
  /** A stop on the ending's tour: one island large in the frame, while the rest of the map stays alive. */
  peek(i: number, dur: number, done?: () => void) {
    const v = this.views[i];
    this.map = true; this.peekAt = new Vector3(v.ox, 0, v.oz);
    this.seaTarget = BIOMES[v.biome].sea; this.dayTarget = DAYLIGHT[v.biome]; // the ending's tour replays the journey's hours
    this.padKind = 'level'; this.hudPad = this.pads('level');
    this.setShadowSpan(13);
    this.flyTo(this.focusOf(v), this.fitDistance(v) * 1.15, dur, done);
  }
  private peekAt: Vector3 | null = null;

  // ---- the last shift: the ending slides every island into one continent, and back
  private homes: [number, number][] | null = null;
  private drive: { from: [number, number][]; to: [number, number][]; t: number; delay: number[]; each: number; landed: boolean[]; onLand?: (i: number) => void; done?: () => void } | null = null;
  get merged() { return !!this.homes; }
  get shifting() { return !!this.drive || this.rising; }
  private driveTo(to: [number, number][], delay: number[], each: number, onLand?: (i: number) => void, done?: () => void) {
    const from = this.views.map(v => [v.ox, v.oz] as [number, number]);
    // the frozen high-res mask of the last island played would hide the islands sailing through it
    this.activeMask.moveTo(-1000, -1000); this.ocean.syncBounds();
    if (this.reducedMotion) { this.views.forEach((v, i) => { v.moveTo(to[i][0], to[i][1]); onLand?.(i); }); this.writeStatic(); done?.(); return; }
    this.drive = { from, to, t: 0, delay, each, landed: to.map(() => false), onLand, done };
  }
  /** The camera for a given placing of the islands, without moving them. */
  private mapFrameFor(to: [number, number][], bottom: number) {
    const was = this.views.map(v => [v.ox, v.oz] as const), oldBottom = this.mapBottom;
    this.views.forEach((v, i) => v.moveTo(to[i][0], to[i][1]));
    this.mapBottom = bottom;
    const f = this.mapFrame();
    this.views.forEach((v, i) => v.moveTo(was[i][0], was[i][1]));
    this.mapBottom = oldBottom;
    return f;
  }
  /** The water on an island that must stay water in the continent, relative to the island: its buoys' cells and its lakes. */
  private wetCells(v: IslandView): [number, number][] {
    const wet: [number, number][] = v.lv.buoys.map(c => v.xz(c));
    for (const r of v.waterRects([], true)) if (r.lake) wet.push([(r.x0 + r.x1) / 2 - v.ox, (r.z0 + r.z1) / 2 - v.oz]);
    return wet;
  }
  /** Slide every island home into one land; farthest first, so the middle is still open water as they come in. */
  lastShift(onLand: (i: number) => void, done: () => void) {
    if (this.homes || this.drive) return;
    this.setActive(null);
    const homes = this.homes = this.views.map(v => [v.ox, v.oz] as [number, number]);
    const to = packContinent(this.views.map((v, i) => ({ x: homes[i][0], z: homes[i][1], cells: v.landRects().map(r => [(r.x0 + r.x1) / 2 - v.ox, (r.z0 + r.z1) / 2 - v.oz] as [number, number]), keep: this.wetCells(v) })));
    const far = this.views.map((_, i) => Math.hypot(homes[i][0] - to[i][0], homes[i][1] - to[i][1])), most = Math.max(1, ...far);
    const delay = far.map(d => (1 - d / most) * 2.6);
    const f = this.mapFrameFor(to, .3);
    this.map = true; this.peekAt = null; this.mapBottom = .3;
    this.setShadowSpan(70);
    this.flyTo(f.focus, f.dist, 5.2);
    if (this.fly) this.fly.arc = 0;
    this.rising = true;
    this.driveTo(to, delay, 3, onLand, () => {
      this.buildFill();
      this.fillGoal = 1;
      if (this.reducedMotion) { this.fillK = 1; this.placeFill(); this.rising = false; done(); return; }
      this.after(1.3, () => { this.rising = false; done(); });
    });
  }
  // the land that rises in the straits once the islands have locked together
  private rising = false;
  private fill: Group | null = null;
  private fillRects: LandRect[] = [];
  private fillShown = false;
  private fillK = 0; private fillGoal = 0;
  private buildFill() {
    if (this.fill) { this.scene.remove(this.fill); this.fill.traverse(o => { if (o instanceof InstancedMesh) o.dispose(); }); this.fill = null; }
    const land: { x: number; z: number; g: string }[] = [], clear: [number, number][] = [];
    for (const v of this.views) {
      for (const r of v.landRects()) land.push({ x: Math.round((r.x0 + r.x1) / 2), z: Math.round((r.z0 + r.z1) / 2), g: BIOMES[v.biome].ground });
      const keep = (x: number, z: number) => { for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) clear.push([Math.round(v.ox + x) + a, Math.round(v.oz + z) + b]); };
      for (const r of v.waterRects([], true)) if (r.lake) keep((r.x0 + r.x1) / 2 - v.ox, (r.z0 + r.z1) / 2 - v.oz);
      for (const c of v.lv.buoys) { const [x, z] = v.xz(c); keep(x, z); }
      for (const o of v.state.objs) if (o.kind === 'light' || o.kind === 'penguin') { const [x, z] = v.xz(o.cell); keep(x, z); }
    }
    const gaps = fillGaps(land.map(l => [l.x, l.z]), clear);
    this.fillRects = gaps.map(([x, z]) => ({ x0: x - .5, z0: z - .5, x1: x + .5, z1: z + .5 }));
    const g = this.fill = new Group();
    if (gaps.length) {
      // a grassy top on an earth side; each cell takes the ground of the nearest island, so the biomes melt into each other
      const box = new BoxGeometry(1, 1.4, 1), n = box.getAttribute('normal'), col = new Float32Array(n.count * 3), top = new Color('#ffffff'), side = new Color('#9a7448');
      for (let i = 0; i < n.count; i++) (n.getY(i) > .5 ? top : side).toArray(col, i * 3);
      box.setAttribute('color', new BufferAttribute(col, 3));
      const ground = new InstancedMesh(box, new MeshLambertMaterial({ vertexColors: true }), gaps.length);
      ground.castShadow = ground.receiveShadow = true; ground.frustumCulled = false;
      const m = new Matrix4(), c = new Color(), decor: Matrix4[] = [];
      gaps.forEach(([x, z], i) => {
        let best = land[0], bd = Infinity;
        for (const l of land) { const d = Math.abs(l.x - x) + Math.abs(l.z - z); if (d < bd) { bd = d; best = l; } }
        const h = ((x * 73856093) ^ (z * 19349663)) >>> 0;
        ground.setMatrixAt(i, m.makeTranslation(x, topY(0) - .7, z));
        ground.setColorAt(i, c.set(best.g).multiplyScalar(.94 + (h % 10) * .012));
        if (h % 7 === 0) decor.push(new Matrix4().makeScale(1.5, 1.5, 1.5).setPosition(x + (h % 5 - 2) * .1, topY(0), z + (h % 3 - 1) * .15));
      });
      g.add(ground);
      if (decor.length) {
        const trees = new InstancedMesh(M.tree, MAT, decor.length);
        decor.forEach((d, i) => trees.setMatrixAt(i, d));
        trees.castShadow = true; trees.frustumCulled = false;
        g.add(trees);
      }
    }
    this.scene.add(g);
    this.fillK = 0; this.placeFill();
  }
  private placeFill() {
    if (!this.fill) return;
    const e = this.fillK * this.fillK * (3 - 2 * this.fillK);
    this.fill.position.y = (e - 1) * 1.1;
    this.fill.visible = this.fillK > .001;
    // the coast moves out when the new land breaks the surface
    const shown = this.fillK > .4;
    if (shown !== this.fillShown) { this.fillShown = shown; this.writeStatic(); }
  }
  /** Back to the archipelago the map and the levels know. */
  undoLastShift(done: () => void) {
    if (this.drive) return;
    const homes = this.homes; if (!homes) { done(); return; }
    this.homes = null;
    this.fillGoal = 0;
    if (this.reducedMotion) { this.fillK = 0; this.placeFill(); }
    const d = this.views.map((_, i) => .5 + i / this.views.length * .5);
    this.driveTo(homes, d, 1.6, undefined, done);
  }
  private driveFrame(raw: number) {
    const d = this.drive; if (!d) return;
    d.t += Math.min(raw, .1);
    let open = false;
    this.views.forEach((v, i) => {
      const u = Math.min(1, Math.max(0, (d.t - d.delay[i]) / d.each));
      if (u < 1) open = true;
      const e = u * u * u * (u * (6 * u - 15) + 10);
      v.moveTo(d.from[i][0] + (d.to[i][0] - d.from[i][0]) * e, d.from[i][1] + (d.to[i][1] - d.from[i][1]) * e);
      if (u >= 1 && !d.landed[i]) { d.landed[i] = true; d.onLand?.(i); }
    });
    this.writeStatic();
    if (!open) { this.drive = null; d.done?.(); }
  }
  zoomBump(k: number, dur: number) { this.pull = k; this.pullDur = dur; this.pullT = 0; }
  private pull = 0; private pullDur = 1; private pullT = 0;

  setActive(v: IslandView | null) {
    if (v === this.active) return;
    if (this.active) { this.active.clearPreview(); this.active.setSelected(null); this.active.setHover(null); this.active.celebrate(false); this.active.showMarks = false; this.active.update(0, this.time.value); }
    this.active = v;
    if (v) {
      const span = v.span + 7;
      const am = this.activeMask; am.size = [span, span]; am.moveTo(v.ox - span / 2, v.oz - span / 2);
      this.ocean.syncBounds();
      const ax = v.ox - span / 2 - MASK_RANGE, az = v.oz - span / 2 - MASK_RANGE, bx = v.ox + span / 2 + MASK_RANGE, bz = v.oz + span / 2 + MASK_RANGE;
      this.neighbourLand = this.views.filter(o => o !== v).flatMap(o => o.landRects()).filter(r => r.x1 > ax && r.x0 < bx && r.z1 > az && r.z0 < bz);
      this.writeActive(v);
      const look = BIOMES[v.biome];
      this.seaTarget = look.sea;
      this.dayTarget = DAYLIGHT[v.biome];
    }
    this.writeStatic();
  }
  seaTarget: [string, string] | null = null;
  // the hour eases along with the sea as the camera travels between islands
  private hemi = new HemisphereLight(MORNING.sky, MORNING.under, MORNING.hemi);
  private dayTarget: DayLight = MORNING;
  private sunFrom = new Vector3(...MORNING.from);
  private easeDay(dt: number) {
    const k = 1 - Math.exp(-dt * 1.4), d = this.dayTarget;
    this.sun.color.lerp(new Color(d.sun), k); this.sun.intensity += (d.sunI - this.sun.intensity) * k;
    this.hemi.color.lerp(new Color(d.sky), k); this.hemi.groundColor.lerp(new Color(d.under), k); this.hemi.intensity += (d.hemi - this.hemi.intensity) * k;
    this.sunFrom.lerp(new Vector3(...d.from), k);
  }

  /** A neighbour reaching into the active mask must be in it too, or its shore stops dead at the mask's straight edge. */
  private neighbourLand: LandRect[] = [];
  private writeActive(v: IslandView) { this.activeMask.write(this.neighbourLand.length ? v.landRects([...this.neighbourLand]) : v.landRects(), v.waterRects()); }
  writeStatic() {
    // the static mask is written once and stays: a flood still under way must not freeze here as dry ground
    const land = this.views.flatMap(v => v.landRects()); if (this.fillShown) land.push(...this.fillRects);
    const water =this.views.flatMap(v => v.waterRects([], true));
    this.staticMask.write(land, water);
    this.ocean.syncBounds();
  }

  // ---- picking
  private ndc = new Vector2();
  pick(px: number, py: number): number | null {
    const v = this.active; if (!v) return null;
    // a slider draws over everything, so what it covers can't be what the player means
    let near = 16, slid: number | null = null;
    for (const m of v.markSegments()) {
      const [ax, ay] = this.project(m.a), [bx, by] = this.project(m.b), dx = bx - ax, dy = by - ay;
      const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1)));
      const d = Math.hypot(px - ax - t * dx, py - ay - t * dy);
      if (d < near) { near = d; slid = m.plate; }
    }
    if (slid !== null) return slid;
    this.ndc.set(px / innerWidth * 2 - 1, -(py / innerHeight) * 2 + 1);
    this.ray.setFromCamera(this.ndc, this.camera);
    const hit = this.ray.intersectObject(v.mesh as InstancedMesh, false)[0];
    if (!hit || hit.instanceId === undefined) return null;
    return v.plateAt(hit.instanceId);
  }
  pickIsland(px: number, py: number): number | null {
    this.ndc.set(px / innerWidth * 2 - 1, -(py / innerHeight) * 2 + 1);
    this.ray.setFromCamera(this.ndc, this.camera);
    const p = this.ray.ray.intersectPlane(new Plane(new Vector3(0, 1, 0), -.4), new Vector3());
    if (!p) return null;
    let best = -1, bd = 1e9;
    this.views.forEach((v, i) => { const d = Math.hypot(v.ox - p.x, v.oz - p.z); if (d < bd) { bd = d; best = i; } });
    return best >= 0 && bd < this.views[best].span * .85 ? best : null;
  }
  /** Pointer position on the horizontal plane at height y, in world coordinates. */
  groundPoint(px: number, py: number, y: number): Vector3 | null {
    this.ndc.set(px / innerWidth * 2 - 1, -(py / innerHeight) * 2 + 1);
    this.ray.setFromCamera(this.ndc, this.camera);
    return this.ray.ray.intersectPlane(new Plane(new Vector3(0, 1, 0), -y), new Vector3());
  }
  project(p: Vector3): [number, number, boolean] {
    const v = p.clone().project(this.camera);
    return [(v.x + 1) / 2 * innerWidth, (1 - v.y) / 2 * innerHeight, v.z < 1];
  }

  // ---- thumbnails: render a creature to a data URL for the HUD chips
  thumbs(): Record<CreatureKind, Record<'ok' | 'sad', string>> {
    const size = 112, rt = new WebGLRenderTarget(size, size);
    const scene = new Scene(); scene.add(new HemisphereLight('#ffffff', '#b09a84', 2.3));
    const d = new DirectionalLight('#ffffff', 2); d.position.set(2, 4, 3); scene.add(d);
    const out = {} as Record<CreatureKind, Record<'ok' | 'sad', string>>;
    const cam = new PerspectiveCamera(22, 1, .1, 20);
    const pixels = new Uint8Array(size * size * 4);
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = size; const c2 = canvas.getContext('2d')!;
    const old = this.renderer.getClearAlpha(), oldCol = new Color(); this.renderer.getClearColor(oldCol);
    this.renderer.setClearColor(0x000000, 0);
    const fxStub = { sparkle() {}, dust() {}, rubble() {}, sigh() {}, smoke() {}, splash() {} } as unknown as Particles;
    for (const kind of ['goat', 'village', 'light', 'buoy', 'oasis', 'penguin'] as CreatureKind[]) {
      out[kind] = {} as Record<'ok' | 'sad', string>;
      for (const mood of ['ok', 'sad'] as const) {
        const cr = new Creature(kind, 0, fxStub, 0);
        // a chip says who; the tick or cross says how they feel. A flopped goat at 28 px is only a white blob, so every portrait stands.
        cr.setMet(true, false); cr.far = true; cr.update(0, 0);
        if (kind === 'goat') cr.body.rotation.y = 1.05; // a goat reads from the side, by its horns and back
        if (cr.bubble) cr.bubble.visible = false;
        cr.badge.visible = false;
        scene.add(cr.root);
        const [cy, dist] = ({ goat: [.34, 1.7], village: [.17, 2], light: [.44, 2.25], buoy: [.2, 1.25], oasis: [.24, 2], penguin: [.12, 1.65] } as Record<CreatureKind, [number, number]>)[kind];
        cam.position.set(1.1 * dist * .5, cy + dist * .42, dist * .86); cam.lookAt(0, cy, 0);
        this.renderer.setRenderTarget(rt); this.renderer.clear(); this.renderer.render(scene, cam);
        this.renderer.readRenderTargetPixels(rt, 0, 0, size, size, pixels);
        const img = c2.createImageData(size, size);
        for (let y = 0; y < size; y++) img.data.set(pixels.subarray((size - 1 - y) * size * 4, (size - y) * size * 4), y * size * 4);
        // the target holds linear colour; brighten to display space
        for (let i = 0; i < img.data.length; i += 4) for (let k = 0; k < 3; k++) { const v = img.data[i + k] / 255; img.data[i + k] = 255 * (v <= .0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - .055); }
        c2.putImageData(img, 0, 0);
        out[kind][mood] = canvas.toDataURL();
        scene.remove(cr.root);
      }
    }
    this.renderer.setRenderTarget(null); this.renderer.setClearColor(oldCol, old); rt.dispose();
    return out;
  }

  private frame() {
    const now = performance.now(), raw = (now - this.lastNow) / 1000, dt = Math.min(raw, .05);
    this.lastNow = now;
    this.adaptQuality(raw);
    const t = (this.time.value += dt);
    for (let i = this.timers.length - 1; i >= 0; i--) if (this.timers[i].at <= t) { const f = this.timers[i].fn; this.timers.splice(i, 1); f(); }
    this.frameHook?.(dt, t);
    this.driveFrame(raw);
    if (this.fillK !== this.fillGoal) { this.fillK = this.fillGoal > this.fillK ? Math.min(1, this.fillK + raw / 1.2) : Math.max(0, this.fillK - raw / .5); this.placeFill(); }
    for (const v of this.views) { v.setFar(this.map); if (v === this.active || v.busy || this.map) v.update(dt, t); }
    this.heroBeat(dt);
    if (this.hero.group.visible) { this.hero.update(dt, t); if (this.active !== this.hero && !this.fly) this.hero.group.visible = false; }
    if (this.active && (this.active.busy || this.fly)) this.writeActive(this.active);
    this.fx.update(dt);
    if (this.seaTarget) this.ocean.setSea(this.seaTarget[0], this.seaTarget[1], 1 - Math.exp(-dt * 1.4));
    this.easeDay(dt);
    this.seaLife.update(dt, t, this.map && this.camera.position.y > 26); // over the map only: beside a board a boat is as big as a lighthouse (a phone's level camera is high up too)
    // clouds pass by on a flight, then clear: nothing may hide an island on the map
    const cm = this.clouds[0].o.material as MeshLambertMaterial;
    cm.opacity += ((this.fly && !this.homes ? .92 : 0) - cm.opacity) * Math.min(1, raw * 5); // nor the last shift: it is the picture the game ends on
    for (const c of this.clouds) { c.o.position.x += c.v * dt; if (c.o.position.x > this.aabb.x1 + 8) c.o.position.x = this.aabb.x0 - 8; c.o.visible = cm.opacity > .01; }
    for (const g of this.gulls) {
      g.a += g.s * dt; g.g.position.set(g.c.x + Math.cos(g.a) * g.r, g.c.y + Math.sin(g.a * 2.3) * .3, g.c.z + Math.sin(g.a) * g.r);
      g.g.rotation.y = -g.a;
      // a few beats, then a long glide
      const beat = Math.sin(t * 1.1 + g.a * 5) > .35 ? Math.sin(t * 9 + g.a) * .42 : .1;
      g.flap += (beat - g.flap) * Math.min(1, raw * 8);
      g.g.children[1].rotation.z = g.flap; g.g.children[2].rotation.z = -g.flap;
    }
    // camera
    let focus = this.focus, dist = this.dist;
    if (this.fly) {
      // flights run on real time, so a slow machine lands on schedule instead of in slow motion
      const f = this.fly; f.t += Math.min(raw, .25);
      const u = Math.min(1, f.t / f.dur), e = ease(u);
      this.focus.lerpVectors(f.from, f.to, e);
      this.dist = f.d0 + (f.d1 - f.d0) * e + Math.sin(e * Math.PI) * f.arc;
      focus = this.focus; dist = this.dist;
      if (u >= 1) { this.fly = null; f.done?.(); }
    }
    if (this.pull) { this.pullT += dt; const u = Math.min(1, this.pullT / this.pullDur); dist = dist * (1 + this.pull * Math.sin(u * Math.PI * .5)); }
    this.drift = this.reducedMotion ? 0 : Math.sin(t * .23) * .05;
    const az = AZ + this.drift * .35, el = EL;
    const cd = new Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el));
    this.camera.position.copy(focus).addScaledVector(cd, dist);
    if (this.shake > .001) {
      const s = this.shake; this.camera.position.x += Math.sin(t * 71) * s * .06; this.camera.position.y += Math.sin(t * 93) * s * .05; this.camera.position.z += Math.cos(t * 67) * s * .06;
      this.shake = smooth(this.shake, 0, 7, dt);
    }
    this.camera.lookAt(focus);
    // sun follows the view so shadows stay crisp
    const sc = this.map ? (this.peekAt ?? this.mapCenter()) : (this.active ? new Vector3(this.active.ox, 0, this.active.oz) : focus);
    this.sun.target.position.copy(sc); this.sun.position.copy(sc).add(this.sunFrom);
    for (const p of this.pins) {
      if (p.hide?.()) { p.el.style.display = 'none'; continue; }
      const [x, y] = this.project(p.pos);
      p.el.style.display = ''; p.el.style.transform = `translate(-50%,-50%) translate(${x.toFixed(1)}px,${y.toFixed(1)}px)`;
    }
    if (this.path) this.path.visible = this.map && !this.homes && !this.drive && !this.peekAt; // at the ending tour's close range the dots are big ovals
    updateVisibleMatrices(this.scene);
    this.renderer.render(this.scene, this.camera);
    this.frames++;
  }
  frames = 0;
  /** 0 full, 1 pixel ratio capped at 1, 2 no shadows, 3 below native resolution. Only ever steps down. */
  quality = 0;
  private slow = { t: 0, n: 0 };
  private adaptQuality(raw: number) {
    if (document.hidden || raw > 1) return; // a background tab or a stall says nothing about the machine
    const s = this.slow; s.t += raw; s.n++;
    if (s.t < 2) return;
    const fps = s.n / s.t; s.t = 0; s.n = 0;
    if (fps >= 28 || this.quality >= 3) return;
    this.quality++;
    if (this.quality === 1) this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1));
    if (this.quality === 2) { this.renderer.shadowMap.enabled = false; this.sun.castShadow = false; this.scene.traverse(o => { const m = (o as Mesh).material as MeshLambertMaterial | undefined; if (m) m.needsUpdate = true; }); }
    if (this.quality === 3) this.renderer.setPixelRatio(.7);
    this.resize();
  }
  /** Land a camera flight at once (the player tapped to skip it). */
  finishFly() {
    const f = this.fly; if (!f) return;
    this.focus.copy(f.to); this.dist = f.d1; this.fly = null; f.done?.();
  }
  get flying() { return !!this.fly; }
  get cameraFocus() { return this.focus; }
}
export { MeshBasicMaterial };
