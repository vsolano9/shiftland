// One level's island: columns, creatures, decor, rails and move preview. The view holds no rules: it is told the State
// to show and reconciles its columns by identity (plate + plate-anchored cell), so a move, an undo and a restart all
// animate the same way.
import { Shape, ShapeGeometry, BoxGeometry, Group, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial, PlaneGeometry, Vector3, CylinderGeometry, TorusGeometry, ConeGeometry, Color, DoubleSide, GreaterDepth, type BufferGeometry, type Object3D, type MeshLambertMaterial, type Sprite, type SpriteMaterial } from 'three';
import type { MoveDiff } from '../rules/diff.ts';
import { DX, DY, railMoves, seaMask, shift, stateKey, type Dir, type Level, type State } from '../rules/rules.ts';
import { beamRun } from '../game/reasons.ts';
import { Creature, MAT, HEAD_Y, KIND_SCALE, type CreatureKind } from './creatures.ts';
import * as M from './models.ts';
import type { LandRect, WaterRect } from './ocean.ts';
import { BIOMES, CAM_AZ, CAM_EL, plateBand, plateTint, topY, type BiomeName } from './palette.ts';
import type { Particles } from './particles.ts';
import { makeSprite, sprites } from './sprites.ts';
import { makeColumnMesh, writeAttrs, writeHi, type ColumnAttrs } from './terrain.ts';

const easeOutBack = (t: number) => { const c = 1.45; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };
const easeInOut = (t: number) => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

export const MOVE_TIME = .34;

interface Column {
  plate: number; patX: number; patZ: number; idx: number; dead: boolean;
  x: number; y: number; z: number;
  fx: number; fy: number; fz: number; tx: number; ty: number; tz: number;
  t: number; dur: number; yDelay: number; yDur: number; bouncy: boolean;
  level: number; cell: number; removing: boolean;
  decor: Mesh[]; hi: number; hiT: number; cut?: [number, number, number, number];
}

const mat4 = new Matrix4();
// share of a creature the land hides before its silhouette shows: half hidden was already hard to read in play (playtest 5 P5-5);
// on the win any real cut shows it, since that is the moment the player looks for it (playtest 10)
const XRAY_PLAY = .3, XRAY_WIN = .1;
const MARK_STEP = .19; // cells between two stops on a plate's inlaid slider
const PINNED_BAND = new Color('#59606b');
const hashN = (a: number, b: number, c: number) => { const v = Math.sin(a * 127.1 + b * 311.7 + c * 74.7) * 43758.5453; return v - Math.floor(v); };

function decorFor(biome: BiomeName, r: number) {
  const pick = (t: [number, import('three').BufferGeometry][]) => { let a = 0; for (const [p, g] of t) { a += p; if (r < a) return g; } return null; };
  switch (biome) {
    case 'meadow': return pick([[.26, M.tuft], [.12, M.flower], [.1, M.tree], [.05, M.rock]]);
    case 'coast': return pick([[.26, M.dryTuft], [.09, M.rock], [.09, M.tree], [.06, M.flower]]);
    case 'desert': return pick([[.16, M.dryTuft], [.1, M.cactus], [.1, M.rock]]);
    case 'tundra': return pick([[.14, M.pine], [.1, M.rock], [.1, M.iceShard]]);
    default: return pick([[.2, M.tuft], [.1, M.tree], [.08, M.rock], [.05, M.flower]]);
  }
}

function bloomFor(biome: BiomeName, r: number) {
  const pick = (t: [number, import('three').BufferGeometry][]) => { let a = 0; for (const [p, g] of t) { a += p; if (r < a) return g; } return null; };
  switch (biome) {
    case 'meadow': return pick([[.35, M.flower], [.2, M.tuft], [.15, M.tree]]);
    case 'coast': return pick([[.25, M.flower], [.25, M.dryTuft], [.12, M.tree]]);
    case 'desert': return pick([[.25, M.dryTuft], [.18, M.cactus], [.1, M.flower]]);
    case 'tundra': return pick([[.22, M.pine], [.2, M.iceShard], [.08, M.flower]]);
    default: return pick([[.35, M.flower], [.15, M.tree], [.2, M.tuft]]);
  }
}

export interface IslandHost { fx: Particles; terrain: MeshLambertMaterial; sfx: (s: 'bleat' | 'fish', o?: { pan?: number }) => void }

export class IslandView {
  group = new Group();
  mesh: InstancedMesh;
  biome: BiomeName;
  state: State;
  creatures: Creature[] = [];
  private cols: Column[] = [];
  private free: number[] = [];
  private time = 0;
  private dry = new Map<number, { at: number; lake: boolean }>();
  /** true while anything that changes the coastline is moving */
  busy = false;
  dim = 0;
  private rail = new Group();
  private railParts: { tube: Mesh; caps: Mesh[]; stops: Mesh[]; knob: Mesh; arrows: Mesh[]; big: Group };
  private ghostGroup = new Group();
  private dragPlate: number | null = null;
  private dragVec = new Vector3(); private dragNow = new Vector3();
  private lift: number[] = [];
  private liftT: number[] = [];
  private selected: number | null = null;
  private hover: number | null = null;
  private badgePool: Sprite[] = [];
  railPlate: number | null = null;
  railHint = 0;
  /** With railHint: which way along the rail the hint points (+1 east/south, -1 west/north). */
  railDir = 0;
  private railHintPlate: number | null = null;
  /** Reduced motion: a hint's arrow and plate hold still. */
  calm = false;
  private anchors: Mesh[] = [];
  private marks: { m: Group; knob: Mesh; plate: number; patX: number; patZ: number; grab: boolean; at?: Column }[] = [];
  /**
   * A small slider set into each free plate: a groove, one stud per stop, and a glowing peg at the stop it is on.
   * Without touching anything it says which way the plate runs and how far it has left each way.
   */
  private buildMark(p: number) {
    const m = new Group(), n = this.lv.maxTravel, sp = MARK_STEP;
    const mat = (color: Color | string) => new MeshBasicMaterial({ color, transparent: true, depthWrite: false });
    // behind tall land a slider still shows, fainter: a plate behind a peak can be seen and grabbed (World.pick takes the slider first)
    const part = (g: BufferGeometry, c: Color | string, order: number, to: Object3D) => {
      const o = new Mesh(g, mat(c)); o.renderOrder = order; to.add(o);
      const through = new Mesh(g, new MeshBasicMaterial({ color: c, transparent: true, opacity: .85, depthWrite: false, depthFunc: GreaterDepth })); through.renderOrder = order; o.add(through);
      return o;
    };
    part(new BoxGeometry(2 * n * sp + .1, .004, .075), new Color('#3a2c22'), 6, m);
    for (let k = -n; k <= n; k++) { const st = part(new CylinderGeometry(.052, .052, .006, 14), '#fff7e6', 7, m); st.position.x = k * sp; }
    const knob = part(new CylinderGeometry(.092, .092, .01, 20), plateBand(p), 8, m);
    part(new CylinderGeometry(.05, .05, .012, 16), '#ffffff', 9, knob);
    m.rotation.y = this.lv.axis[p] === 1 ? 0 : -Math.PI / 2; m.visible = false; // -90 deg: local +x is world +z, the way the offset counts
    return { m, knob };
  }
  /** Axis marks show on the island being played, until it is solved. */
  showMarks = false;
  /** Bubbles step aside while a plate is dragged. */
  private leakDots: Sprite[] = [];
  private leak: { flow: boolean; pts: [number, number][]; left: number } | null = null;
  /** Points at water on the board: dots run along a way out to sea, or stand and pulse on a lake (playtest 5 P5-2). Null clears it. */
  showLeak(l: { flow: boolean; pts: [number, number][] } | null, sec = 3.6) {
    this.leak = l && l.pts.length ? { ...l, left: sec } : null;
    // +1 in a flow: a beat at the source, so the line reads as starting at the creature that complained (playtest 6 P6-4)
    const n = !this.leak ? 0 : l!.flow ? Math.ceil((l!.pts.length - 1) * 1.6) + 2 : l!.pts.length;
    // water's own colour, or white dots read as chimney puffs and bubble trails
    while (this.leakDots.length < n) { const d = makeSprite(sprites().dot, .3, 22); (d.material as SpriteMaterial).color.set('#4fe8ff'); this.leakDots.push(d); this.group.add(d); }
    this.leakDots.forEach((d, i) => { d.visible = i < n; });
  }
  private stepLeak(dt: number, t: number) {
    const l = this.leak;
    if (!l) return;
    l.left -= dt;
    if (l.left <= 0) { this.showLeak(null); return; }
    const { w, h } = this.lv, fade = Math.min(1, l.left / .5), X = (a: number) => a - (w - 1) / 2, Z = (b: number) => b - (h - 1) / 2;
    const last = l.pts.length - 1;
    this.leakDots.forEach((d, i) => {
      if (!d.visible) return;
      let x: number, z: number, a = 1, size = .3;
      if (l.flow) {
        const n = this.leakDots.filter(o => o.visible).length;
        if (i === n - 1) { x = X(l.pts[0][0]); z = Z(l.pts[0][1]); size = .42 + Math.sin(t * 5) * .08; }
        else {
          const u = (t * 1.5 / last + i / (n - 1)) % 1, at = u * last, k = Math.min(last - 1, Math.floor(at)), f = at - k;
          x = X(l.pts[k][0] + (l.pts[k + 1][0] - l.pts[k][0]) * f); z = Z(l.pts[k][1] + (l.pts[k + 1][1] - l.pts[k][1]) * f);
          a = Math.min(1, u * 8, (1 - u) * 5); // it comes up beside the creature and fades out past the map's edge
        }
      } else {
        x = X(l.pts[i][0]); z = Z(l.pts[i][1]);
        size = .3 + Math.sin(t * 5) * .06;
      }
      d.position.set(x, .22, z); d.scale.setScalar(size);
      (d.material as SpriteMaterial).opacity = a * fade;
    });
  }

  /** Wish bubbles step to a side of their creature where they cover nobody else, judged in screen space (the camera angle is fixed). */
  private bubbleKey = '';
  private placeBubbles() {
    const key = this.creatures.map(c => `${Math.round(c.root.position.x * 4)},${Math.round(c.root.position.z * 4)},${Math.round(c.root.position.y * 4)},${c.met ? 1 : 0}`).join(';') + `|${this.marks.map(k => `${this.state.off?.[k.plate] ?? 0},${this.plateTop(k.plate)}`).join(';')}`;
    if (key === this.bubbleKey) return;
    this.bubbleKey = key;
    const CA = Math.cos(.72), SA = Math.sin(.72), CE = Math.cos(.82), SE = Math.sin(.82);
    const screen = (x: number, y: number, z: number): [number, number] => [x * CA - z * SA, y * CE - (x * SA + z * CA) * SE];
    type Blob = { u: number; v: number; r: number; owner: Creature | null };
    const blobs: Blob[] = [];
    for (const a of this.anchors) { const [u, v] = screen(a.position.x, a.position.y, a.position.z); blobs.push({ u, v, r: .22, owner: null }); } // handles stay uncovered
    // and so does each plate's slider, end to end (critic T12): it is how a player plans without touching anything
    // (from the rules' state and not the mark's mesh: this also runs before a board's first frame, to frame it)
    for (const k of this.marks) for (const o of [-.42, 0, .42]) {
      const ax = this.lv.axis[k.plate] === 1, [x0, z0] = this.plateAnchor(k.plate), off = this.state.off?.[k.plate] ?? 0;
      const [u, v] = screen(x0 + (ax ? off + o : 0), this.plateTop(k.plate), z0 + (ax ? 0 : off + o));
      blobs.push({ u, v, r: .2, owner: null });
    }
    const blob = (c: Creature, y: number, r: number) => { const p = c.root.position, [u, v] = screen(p.x, p.y + y, p.z); blobs.push({ u, v, r, owner: c }); };
    for (const c of this.creatures) { const h = HEAD_Y[c.kind] * KIND_SCALE[c.kind]; blob(c, h * .28, .3); blob(c, h * .78, .25); }
    const placed: [number, number][] = [];
    const CAND: [number, number][] = [[.3, .12], [-.34, .12], [0, .42], [.58, .1], [-.6, .1], [.34, .46], [-.36, .46], [.75, .3], [-.78, .3], [0, .78]];
    for (const c of this.creatures) {
      if (!c.bubble) continue;
      const S = KIND_SCALE[c.kind], p = c.root.position, y0 = HEAD_Y[c.kind] * S;
      const [hu, hv] = screen(p.x, p.y + y0, p.z);
      let best = CAND[0], bestCost = Infinity;
      CAND.forEach((o, n) => {
        // distance costs: a bubble three cells off read as someone else's (playtest 5 P5-6), so it takes a small overlap before that
        const u = hu + o[0], v = hv + o[1]; let cost = n * .01 + Math.hypot(o[0], o[1]) * .45;
        for (const b of blobs) { if (b.owner === c) continue; const d = Math.hypot(u - b.u, v - b.v) - b.r - .24; if (d < 0) cost -= d * 4; }
        for (const [bu, bv] of placed) { const d = Math.hypot(u - bu, v - bv) - .5; if (d < 0) cost -= d * 6; }
        if (cost < bestCost) { bestCost = cost; best = o; }
      });
      placed.push([hu + best[0], hv + best[1]]);
      // back to world, in the root's scaled space: right on screen is (CA, 0, -SA), up on screen is world up
      c.bubbleHome = [best[0] * CA / S, best[1] / CE / S, -best[0] * SA / S];
    }
  }

  setQuiet(q: boolean) { for (const c of this.creatures) c.quiet = q; }
  /** On the map a lighthouse beam would be a stray fan across the neighbours. */
  setFar(f: boolean) { for (const c of this.creatures) c.far = f; }

  /** Only the ending's last shift moves an island. Everything that reads ox and oz follows. */
  moveTo(x: number, z: number) { this.ox = x; this.oz = z; this.group.position.set(x, 0, z); }

  constructor(readonly lv: Level, readonly index: number, public ox: number, public oz: number, private host: IslandHost) {
    this.biome = ((lv as Level & { biome?: BiomeName }).biome ?? 'meadow') as BiomeName;
    this.group.position.set(ox, 0, oz);
    const cap = lv.w * lv.h * 3;
    this.mesh = makeColumnMesh(cap, host.terrain);
    for (let i = cap - 1; i >= 0; i--) { this.free.push(i); this.mesh.setMatrixAt(i, mat4.makeScale(0, 0, 0)); }
    this.group.add(this.mesh);
    this.state = lv.start;
    for (let p = 0; p < lv.plates; p++) { this.lift[p] = 0; this.liftT[p] = 0; }
    // creatures: objects in goal order, then buoys
    lv.start.objs.forEach((o, i) => this.creatures.push(this.addCreature(o.kind as CreatureKind, i, o.cell)));
    lv.buoys.forEach((c, i) => this.creatures.push(this.addCreature('buoy', lv.start.objs.length + i, c)));
    this.railParts = this.buildRail();
    this.group.add(this.ghostGroup);
    // anchor rocks: a pinned plate carries its reason on its back
    for (const p of lv.pinned ?? []) {
      const m = new Mesh(M.anchorRock, MAT); m.castShadow = true; m.scale.setScalar(1.55); m.userData.plate = p;
      const [x, z] = this.plateAnchor(p); m.position.set(x, 0, z);
      this.anchors.push(m); this.group.add(m);
    }
    // a faint double arrow on every free plate: a plan can be read without touching anything
    for (let p = 0; p < lv.plates; p++) {
      if (lv.pinned?.includes(p)) continue;
      const { m, knob } = this.buildMark(p);
      const [x, z] = this.plateAnchor(p), s = lv.start, cell = (x + (lv.w - 1) / 2) + (z + (lv.h - 1) / 2) * lv.w, [patX, patZ] = this.patOf(s, p, cell);
      this.marks.push({ m, knob, plate: p, patX, patZ, grab: false }); this.group.add(m);
    }
    this.reconcile(lv.start, false);
    this.finishTweens();
    this.applyGoals(this.currentGoals(lv.start), false);
  }

  private addCreature(k: CreatureKind, i: number, cell: number) {
    const c = new Creature(k, i, this.host.fx, i * 3.1 + this.index);
    const [x, z] = this.xz(cell);
    c.root.position.set(x, 0, z); c.root.scale.setScalar(KIND_SCALE[k]);
    c.world = (dx, dy, dz) => [this.ox + c.root.position.x + dx, c.root.position.y + dy, this.oz + c.root.position.z + dz];
    c.sfx = s => this.host.sfx(s);
    c.wet = (wx, wz) => {
      const { w, h } = this.lv, cx = Math.round(wx - this.ox + (w - 1) / 2), cz = Math.round(wz - this.oz + (h - 1) / 2);
      return cx < 0 || cz < 0 || cx >= w || cz >= h || this.state.plate[cx + cz * w] < 0;
    };
    this.group.add(c.root);
    return c;
  }

  xz(cell: number): [number, number] {
    const { w, h } = this.lv;
    return [cell % w - (w - 1) / 2, Math.floor(cell / w) - (h - 1) / 2];
  }
  worldPos(cell: number, y?: number) {
    const [x, z] = this.xz(cell);
    return new Vector3(this.ox + x, y ?? topY(Math.max(0, this.state.elev[cell])), this.oz + z);
  }
  /** Which plate a raycast instance belongs to. */
  plateAt(instance: number): number | null {
    const c = this.cols.find(k => k.idx === instance && !k.dead && !k.removing);
    return c ? c.plate : null;
  }
  plateTop(p: number) { let t = 0; for (let i = 0; i < this.state.plate.length; i++) if (this.state.plate[i] === p) t = Math.max(t, topY(this.state.elev[i])); return t; }

  private patOf(s: State, p: number, cell: number): [number, number] {
    const off = s.off ? s.off[p] : 0, x = cell % this.lv.w, y = Math.floor(cell / this.lv.w);
    return this.lv.axis[p] === 1 ? [x - off, y] : [x, y - off];
  }

  private makeColumn(p: number, patX: number, patZ: number, cell: number, level: number): Column {
    const idx = this.free.pop()!;
    const [x, z] = this.xz(cell);
    const c: Column = { plate: p, patX, patZ, idx, dead: false, x, y: topY(level), z, fx: x, fy: topY(level), fz: z, tx: x, ty: topY(level), tz: z, t: 1, dur: 1, yDelay: 0, yDur: 1, bouncy: false, level, cell, removing: false, decor: [], hi: 0, hiT: 0 };
    const r0 = hashN(p + 7, patX, patZ), g = decorFor(this.biome, r0);
    if (g) {
      const m = new Mesh(g, MAT); m.castShadow = g !== M.tuft && g !== M.flower && g !== M.dryTuft;
      m.rotation.y = hashN(patX, patZ, 3) * 6.28; m.userData.dx = (hashN(patX, 1, patZ) - .5) * .5; m.userData.dz = (hashN(2, patX, patZ) - .5) * .5;
      m.userData.s = 1.3 + hashN(patZ, patX, 9) * .55; m.scale.setScalar(m.userData.s);
      c.decor.push(m); this.group.add(m);
    }
    // a settled island grows: a second layer of plants that only shows once its level is solved
    const r1 = hashN(p + 3, patZ * 1.7, patX * 2.3), bg = !g ? bloomFor(this.biome, r1) : null;
    if (bg) {
      const m = new Mesh(bg, MAT); m.castShadow = bg === M.tree || bg === M.pine || bg === M.cactus;
      m.rotation.y = hashN(patZ, patX, 5) * 6.28; m.userData.dx = (hashN(patX, 4, patZ) - .5) * .5; m.userData.dz = (hashN(6, patZ, patX) - .5) * .5;
      m.userData.s = 1.25 + hashN(patX, patZ, 8) * .6; m.userData.bloom = true; m.userData.k = 0; m.scale.setScalar(0); m.visible = false;
      c.decor.push(m); this.group.add(m);
    }
    return c;
  }
  private bloomed = false;
  /** Show or hide the plants a settled island grows. */
  setBloom(on: boolean) { if (on !== this.bloomed) { this.bloomed = on; this.busy = true; } }

  private currentGoals(s: State) { return this.goalsFn(this.lv, s); }
  goalsFn: (lv: Level, s: State) => boolean[] = () => [];

  /** Show state s. animate=false snaps. Goals are applied by the caller at the moment it wants (applyGoals). */
  reconcile(next: State, animate: boolean, opts: { fromRestart?: boolean } = {}): { rose: number[]; flooded: number[]; arrived: number[] } {
    const lv = this.lv, prev = this.state, n = lv.w * lv.h;
    this.state = next;
    this.showLeak(null);
    const dirSlow = opts.fromRestart ? .5 : MOVE_TIME;
    const keep = new Map<string, Column>();
    for (const c of this.cols) if (!c.dead && !c.removing) keep.set(`${c.plate}:${c.patX}:${c.patZ}`, c);
    const seen = new Set<string>();
    const rose: number[] = [], arrived: number[] = [];
    for (let i = 0; i < n; i++) {
      const p = next.plate[i]; if (p < 0) continue;
      const [px, pz] = this.patOf(next, p, i), key = `${p}:${px}:${pz}`;
      seen.add(key);
      const lvl = next.elev[i];
      let c = keep.get(key);
      const [tx, tz] = this.xz(i), ty = topY(lvl);
      if (!c) {
        c = this.makeColumn(p, px, pz, i, lvl); this.cols.push(c);
        if (animate) { c.y = c.fy = -.4; c.x = c.fx = tx; c.z = c.fz = tz; c.t = 0; c.dur = dirSlow; c.yDelay = .08; c.yDur = dirSlow; c.bouncy = true; c.tx = tx; c.tz = tz; c.ty = ty; }
      } else {
        const moved = c.tx !== tx || c.tz !== tz, risen = c.level !== lvl;
        c.fx = c.x; c.fy = c.y; c.fz = c.z; c.tx = tx; c.tz = tz; c.ty = ty;
        if (animate && (moved || risen)) {
          c.t = 0; c.dur = dirSlow; c.yDelay = risen ? dirSlow * .45 : 0; c.yDur = risen ? .36 : dirSlow; c.bouncy = risen && lvl > c.level;
          if (risen && lvl > c.level) rose.push(i);
          if (moved && prev.plate[i] < 0) arrived.push(i);
        } else if (!animate) { c.x = tx; c.y = ty; c.z = tz; c.t = 1; c.dur = 1; }
      }
      c.level = lvl; c.cell = i;
    }
    for (const c of this.cols) {
      if (c.dead || seen.has(`${c.plate}:${c.patX}:${c.patZ}`) || c.removing) continue;
      c.removing = true;
      if (animate) { c.fx = c.x; c.fy = c.y; c.fz = c.z; c.ty = -.5; c.t = 0; c.dur = dirSlow * 1.1; c.yDelay = dirSlow * .55; c.yDur = dirSlow * .55; c.bouncy = false; }
      else this.kill(c); // a snap frees the column now: nothing will tween it to its end
    }
    this.cols = this.cols.filter(c => !c.dead);
    // dry floors for land that just became water; the flood runs outward from the old water
    const flooded: number[] = [];
    if (animate) {
      const sea = seaMask(lv, next);
      const fronts: number[] = [], dist = new Map<number, number>();
      for (let i = 0; i < n; i++) if (next.plate[i] < 0 && prev.plate[i] >= 0) { flooded.push(i); dist.set(i, 1e9); }
      for (const i of flooded) {
        const x = i % lv.w, y = Math.floor(i / lv.w);
        for (let d = 0; d < 4; d++) {
          const nx = x + DX[d], ny = y + DY[d], outside = nx < 0 || ny < 0 || nx >= lv.w || ny >= lv.h;
          if (outside || (next.plate[nx + ny * lv.w] < 0 && !dist.has(nx + ny * lv.w))) { dist.set(i, 0); fronts.push(i); break; }
        }
      }
      if (!fronts.length && flooded[0] !== undefined) { dist.set(flooded[0], 0); fronts.push(flooded[0]); }
      while (fronts.length) {
        const i = fronts.shift()!, x = i % lv.w, y = Math.floor(i / lv.w), v = dist.get(i)!;
        for (let d = 0; d < 4; d++) {
          const nx = x + DX[d], ny = y + DY[d];
          if (nx < 0 || ny < 0 || nx >= lv.w || ny >= lv.h) continue;
          const j = nx + ny * lv.w;
          if ((dist.get(j) ?? -1) > v + 1) { dist.set(j, v + 1); fronts.push(j); }
        }
      }
      for (const i of flooded) this.dry.set(i, { at: this.time + MOVE_TIME * .9 + Math.min(dist.get(i) ?? 0, 12) * .075, lake: !sea[i] });
    }
    for (let i = 0; i < n; i++) if (next.plate[i] >= 0) this.dry.delete(i);
    this.writeAllAttrs();
    for (const m of this.anchors) m.position.y = this.plateTop(m.userData.plate);
    this.moveCreatures(next, animate, dirSlow);
    this.busy = true;
    this.refreshRail();
    return { rose, flooded, arrived };
  }

  private creatureCell(c: Creature, s: State) { return c.kind === 'buoy' ? this.lv.buoys[c.goalIndex - s.objs.length] : s.objs[c.goalIndex].cell; }
  private crT: { c: Creature; fx: number; fy: number; fz: number; tx: number; ty: number; tz: number; t: number; dur: number; delay: number }[] = [];

  private creatureY(c: Creature, s: State, cell: number) {
    const land = s.plate[cell] >= 0;
    if (c.kind === 'buoy') return land ? topY(s.elev[cell]) : 0.02;
    return land ? topY(s.elev[cell]) : 0.05;
  }
  private moveCreatures(next: State, animate: boolean, dur: number) {
    this.crT = this.crT.filter(t => t.t < t.dur && !this.creatures.includes(t.c));
    for (const c of this.creatures) {
      const cell = this.creatureCell(c, next), [cx, cz] = this.xz(cell), ty = this.creatureY(c, next, cell);
      // a buoy that a plate carried a creature onto shuffles to the corner (it stays on its cell for the rules), so neither stands inside the other
      const shoved = c.kind === 'buoy' && next.objs.some(o => o.cell === cell), tx = cx + (shoved ? .3 : 0), tz = cz - (shoved ? .3 : 0);
      c.root.scale.setScalar(KIND_SCALE[c.kind] * (shoved ? .62 : 1));
      if (animate) this.crT.push({ c, fx: c.root.position.x, fy: c.root.position.y, fz: c.root.position.z, tx, ty, tz, t: 0, dur, delay: 0 });
      else c.root.position.set(tx, ty, tz);
      if (c.kind === 'goat') {
        // it stands looking along the island, never out over the water
        const x = cell % this.lv.w, y = Math.floor(cell / this.lv.w);
        const land = (a: number, b: number) => a >= 0 && b >= 0 && a < this.lv.w && b < this.lv.h && next.plate[a + b * this.lv.w] >= 0;
        c.face(land(x, y + 1) || !land(x + 1, y) ? -.4 : 1.25, !animate);
      }
      if (c.kind === 'light') {
        const { dir, run } = beamRun(this.lv, next, cell);
        if (dir) c.aimBeam(dir[0], dir[1], run);
      }
      const share = this.hiddenShare(next, tx, ty, tz, HEAD_Y[c.kind] * KIND_SCALE[c.kind], c.kind === 'oasis' ? .32 : .2); // two palms stand wide apart
      this.hidden.set(c, share);
      c.setXray(share >= (this.celebrating ? XRAY_WIN : XRAY_PLAY));
    }
  }
  /** How much of a creature standing here the land hides from the fixed camera: sample points walked along the view ray over the columns. */
  private hiddenShare(s: State, x: number, y: number, z: number, h: number, wide = .2) {
    const [ax, az] = this.xz(0);
    const dx = Math.sin(CAM_AZ) * Math.cos(CAM_EL), dy = Math.sin(CAM_EL), dz = Math.cos(CAM_AZ) * Math.cos(CAM_EL);
    let hidden = 0, all = 0;
    for (const f of [.15, .5, .9]) for (const side of [-wide, 0, wide]) {
      all++;
      const sx = x + side * dz, sz = z - side * dx, sy = y + f * h;
      for (let t = .3; t < 9; t += .12) {
        const cx = Math.round(sx + dx * t - ax), cz = Math.round(sz + dz * t - az);
        if (cx < 0 || cz < 0 || cx >= this.lv.w || cz >= this.lv.h) continue;
        const i = cx + cz * this.lv.w;
        if (s.plate[i] >= 0 && sy + dy * t < topY(s.elev[i])) { hidden++; break; }
      }
    }
    return hidden / all;
  }

  applyGoals(g: boolean[], animate: boolean, react = true) { this.creatures.forEach(c => c.setMet(g[c.goalIndex], animate, react)); }

  private writeAllAttrs() {
    const { lv, state: s } = this, { w, h } = lv;
    const plateOf = (x: number, y: number) => (x < 0 || y < 0 || x >= w || y >= h ? -1 : s.plate[x + y * w]);
    const elevOf = (x: number, y: number) => (x < 0 || y < 0 || x >= w || y >= h ? -9 : s.elev[x + y * w]);
    const tint = new Color();
    for (const c of this.cols) {
      if (c.dead) continue;
      const cell = c.cell, x = cell % w, y = Math.floor(cell / w), p = c.plate, band = lv.pinned?.includes(p) ? PINNED_BAND : plateBand(p); plateTint(p, this.biome, tint);
      const same = (dx: number, dy: number) => plateOf(x + dx, y + dy) === p;
      const coast = (ax: number, ay: number, bx: number, by: number) => {
        if (plateOf(x + ax, y + ay) >= 0 || plateOf(x + bx, y + by) >= 0) return 0;
        // a little variety: most coast corners are cut, by an amount fixed to the plate's own cell
        return .62 + .38 * hashN(c.patX + ax * 3, c.patZ + bx * 5, p);
      };
      const taller = (dx: number, dy: number) => { const q = plateOf(x + dx, y + dy); if (q < 0) return 0; return Math.min(1, Math.max(0, elevOf(x + dx, y + dy) - s.elev[cell])); };
      const a: ColumnAttrs = {
        tint: [tint.r, tint.g, tint.b], band: [band.r, band.g, band.b],
        edge: [same(0, -1) ? 0 : 1, same(1, 0) ? 0 : 1, same(0, 1) ? 0 : 1, same(-1, 0) ? 0 : 1],
        corner: [same(0, -1) && same(1, 0) && !same(1, -1) ? 1 : 0, same(0, 1) && same(1, 0) && !same(1, 1) ? 1 : 0, same(0, 1) && same(-1, 0) && !same(-1, 1) ? 1 : 0, same(0, -1) && same(-1, 0) && !same(-1, -1) ? 1 : 0],
        ao: [taller(0, -1), taller(1, 0), taller(0, 1), taller(-1, 0)],
        pat: [c.patX, c.patZ], pattern: p % 4, level: c.level, hi: c.hi, dim: this.dim, ice: s.ice?.[cell] ? 1 : 0, pinned: lv.pinned?.includes(p) ? 1 : 0,
        cut: [coast(0, -1, 1, 0), coast(0, 1, 1, 0), coast(0, 1, -1, 0), coast(0, -1, -1, 0)],
      };
      c.cut = a.cut;
      writeAttrs(this.mesh, c.idx, a);
    }
  }

  setDim(d: number) { this.dim = d; this.writeAllAttrs(); for (const c of this.creatures) c.root.visible = d < .5; for (const m of this.anchors) m.visible = d < .5; for (const k of this.cols) for (const m of k.decor) m.visible = d < .5 && !this.occupied(k); }

  private occupied(c: Column) { return this.creatures.some(k => this.creatureCell(k, this.state) === c.cell); }

  setHover(p: number | null) { this.hover = p; this.refreshHi(); }
  setSelected(p: number | null) { this.selected = p; this.refreshHi(); this.showRail(p ?? (this.railHint ? this.railHintPlate : null)); }
  /** A hint or the first levels' hand points at a plate, and with dir also the way; hover can't take the rail from it (audit Nov 6: the arrow sat on the wrong plate). */
  pointRail(plate: number, dir: number) { this.railHint = 1; this.railHintPlate = plate; this.railDir = dir; this.showRail(plate); }
  private refreshHi() {
    for (let p = 0; p < this.lv.plates; p++) this.liftT[p] = this.selected === p ? .05 : this.hover === p ? .02 : 0;
    for (const c of this.cols) if (!c.dead) c.hiT = this.selected === c.plate ? 1 : this.hover === c.plate ? .55 : 0;
    if (this.railHint && this.selected === null) return;
    if (this.railPlate === null && this.hover !== null) this.showRail(this.hover);
    else if (this.selected === null && this.hover === null && !this.railHint) this.showRail(null);
    else if (this.selected === null && this.hover !== null) this.showRail(this.hover);
  }

  /** Live drag offset of a plate, in cells. Null ends it (the plate then eases to its committed cells). */
  setDrag(p: number | null, x = 0, z = 0) { this.dragPlate = p; this.dragVec.set(x, 0, z); this.busy = true; }

  private buildRail() {
    const tubeM = new MeshBasicMaterial({ color: '#fff7e6', transparent: true, opacity: .95, depthTest: false, depthWrite: false });
    const darkM = new MeshBasicMaterial({ color: '#403830', transparent: true, opacity: .55, depthTest: false, depthWrite: false });
    const tube = new Mesh(new BoxGeometry(1, .02, .03), tubeM); tube.renderOrder = 11;
    const shadow = new Mesh(new BoxGeometry(1, .02, .055), darkM); shadow.renderOrder = 10; tube.userData.shadow = shadow; this.rail.add(shadow);
    this.rail.add(tube);
    const capsG = new BoxGeometry(.05, .02, .16);
    const caps = [new Mesh(capsG, tubeM), new Mesh(capsG, tubeM)]; caps.forEach(c => { c.renderOrder = 12; this.rail.add(c); });
    const stopG = new CylinderGeometry(.075, .075, .02, 16), stops: Mesh[] = [];
    for (let i = 0; i < 2 * this.lv.maxTravel + 1; i++) { const s = new Mesh(stopG, new MeshBasicMaterial({ color: '#d7cdbd', transparent: true, depthTest: false, depthWrite: false })); s.renderOrder = 12; stops.push(s); this.rail.add(s); }
    const knob = new Mesh(new TorusGeometry(.13, .04, 8, 24), new MeshBasicMaterial({ color: '#30e5ff', transparent: true, depthTest: false, depthWrite: false })); knob.rotation.x = Math.PI / 2; knob.renderOrder = 13; this.rail.add(knob);
    const arrowG = new ConeGeometry(.17, .34, 3); const arrows = [0, 1].map(() => { const a = new Mesh(arrowG, new MeshBasicMaterial({ color: '#ffffff', transparent: true, depthTest: false, depthWrite: false })); a.renderOrder = 13; this.rail.add(a); return a; });
    // a hint's arrow: one cell long, flat on the board along the rail, so the way reads at a glance on the diagonal view (playtest 11 P11-2b)
    const big = new Group(), shaft = .16, head = .32, neck = .5, tip = .86;
    const arrowAt = (grow: number) => {
      const g = grow, s = new Shape();
      s.moveTo(-g, -shaft - g); s.lineTo(neck, -shaft - g); s.lineTo(neck - g * .4, -head - g * 2); s.lineTo(tip + g * 2.2, 0); s.lineTo(neck - g * .4, head + g * 2); s.lineTo(neck, shaft + g); s.lineTo(-g, shaft + g); s.closePath();
      const geo = new ShapeGeometry(s); geo.rotateX(-Math.PI / 2); return geo;
    };
    const flat = (grow: number, color: string, order: number) => { const m = new Mesh(arrowAt(grow), new MeshBasicMaterial({ color, side: DoubleSide, transparent: true, depthTest: false, depthWrite: false })); m.renderOrder = order; big.add(m); };
    flat(.045, '#4a3526', 13); flat(0, '#fff6e6', 14);
    big.visible = false; this.rail.add(big);
    this.rail.visible = false;
    this.group.add(this.rail);
    return { tube, caps, stops, knob, arrows, big };
  }

  private plateAnchor(p: number): [number, number] {
    const s = this.lv.start; let sx = 0, sz = 0, n = 0;
    for (let i = 0; i < s.plate.length; i++) if (s.plate[i] === p) { const [x, z] = this.xz(i); sx += x; sz += z; n++; }
    if (!n) return [0, 0];
    sx /= n; sz /= n;
    // nearest cell of the plate, so the rail lies on land; a line clear of creatures keeps them visible behind the rail
    const ax = this.lv.axis[p], taken = [...s.objs.map(o => o.cell), ...this.lv.buoys];
    let best = 1e9, bx = sx, bz = sz;
    for (let i = 0; i < s.plate.length; i++) if (s.plate[i] === p) {
      const [x, z] = this.xz(i);
      let d = (x - sx) ** 2 + (z - sz) ** 2;
      for (const t of taken) { const [tx, tz] = this.xz(t); if (t === i) d += 40; else if (ax === 1 ? tz === z : tx === x) d += 4; }
      if (d < best) { best = d; bx = x; bz = z; }
    }
    return [bx, bz];
  }

  /** Legal stops from the current state: how far the plate can go each way, one move at a time. */
  legalRange(p: number): { neg: number; pos: number } {
    const lv = this.lv, ax = lv.axis[p], back = (ax === 1 ? 3 : 0) as Dir, fore = (ax === 1 ? 1 : 2) as Dir;
    let neg = 0, pos = 0, s: State | null = this.state;
    while ((s = shift(lv, s, p, back))) neg++;
    s = this.state; while ((s = shift(lv, s, p, fore))) pos++;
    return { neg, pos };
  }

  showRail(p: number | null) { this.railPlate = p; this.refreshRail(); }

  private refreshRail() {
    const p = this.railPlate, P = this.railParts;
    this.rail.visible = p !== null && !(this.lv.pinned?.includes(p));
    if (p === null || !this.rail.visible) return;
    const ax = this.lv.axis[p], mt = this.lv.maxTravel, [ax0, az0] = this.railHome(p);
    const off = this.state.off ? this.state.off[p] : 0;
    const y = this.railY(p);
    const place =(o: Mesh, k: number) => { o.position.set(ax === 1 ? ax0 + k : ax0, y, ax === 1 ? az0 : az0 + k); };
    const range = this.legalRange(p);
    // the rail shows what matters: every legal stop, plus one red stop past each end when something (not the rail's end) refuses it
    // Never further than two stops from the plate (a full rail runs off over the sea, through whoever stands in line),
    // and on a hint only the way the hint means
    const dir = this.railHint && p === this.railHintPlate ? this.railDir : 0;
    const big = !!dir && (dir > 0 ? range.pos > 0 : range.neg > 0); // the hint's arrow is the track on this stretch: the track's end poked out past its tip
    const reach = 1; // the next stop each way: anything longer ran through creatures and the other plate's slider (the plate's own slider shows how far it has left)
    const lo = dir > 0 ? off : Math.max(-mt, off - range.neg - 1, off - reach), hi = dir < 0 ? off : Math.min(mt, off + range.pos + 1, off + reach);
    const tubeLen = hi - lo + .3, mid = (lo + hi) / 2;
    place(P.tube, mid); P.tube.scale.set(tubeLen, 1, 1); P.tube.rotation.y = ax === 1 ? 0 : Math.PI / 2;
    const sh = P.tube.userData.shadow as Mesh; sh.position.copy(P.tube.position); sh.position.y -= .01; sh.scale.copy(P.tube.scale); sh.rotation.copy(P.tube.rotation);
    P.tube.visible = sh.visible = !big;
    P.caps.forEach((c, i) => { c.visible = (i ? hi : lo) === (i ? mt : -mt); place(c, (i ? mt + .12 : -mt - .12)); c.rotation.y = ax === 1 ? 0 : Math.PI / 2; });
    P.stops.forEach((st, i) => {
      const k = i - mt; place(st, k);
      st.visible = k >= lo && k <= hi && !(big && k !== off);
      const rel = k - off, legal = rel === 0 || (rel < 0 ? -rel <= range.neg : rel <= range.pos);
      (st.material as MeshBasicMaterial).color.set(legal ? '#fff7e6' : '#d8574a');
      st.scale.setScalar(legal ? 1 : .72);
    });
    place(P.knob, off);
    P.knob.userData.base = P.knob.position.clone();
    P.arrows.forEach((a, i) => {
      const sign = i ? 1 : -1, ok = !dir && (i ? range.pos > 0 : range.neg > 0);
      a.visible = ok;
      // on the stop it points at, tip past the end: beside the ring it read as a funnel, and playtest 5 followed it the wrong way (P5-1)
      place(a, off + sign * .9);
      a.rotation.set(Math.PI / 2, 0, ax === 1 ? -sign * Math.PI / 2 : (sign > 0 ? 0 : Math.PI)); // outward, the way it goes
      a.userData.base = a.position.clone(); a.userData.sign = sign; a.userData.ax = ax;
    });
    P.big.visible = big;
    if (P.big.visible) {
      const step = dir * .16; // starts just past the knob
      P.big.position.set(ax === 1 ? ax0 + off + step : ax0, y, ax === 1 ? az0 : az0 + off + step);
      P.big.rotation.y = ax === 1 ? (dir > 0 ? 0 : Math.PI) : (dir > 0 ? -Math.PI / 2 : Math.PI / 2);
      P.big.userData.base = P.big.position.clone(); P.big.userData.sign = dir; P.big.userData.ax = ax;
    }
  }

  // ---- move preview (design audit S1: only the difference is drawn)
  private ghostBoxG = new BoxGeometry(.92, 1, .92);
  private ghostRise = new MeshBasicMaterial({ color: '#ffb25e', transparent: true, opacity: .46, depthWrite: false });
  private ghostArrive = new MeshBasicMaterial({ color: '#fff4cf', transparent: true, opacity: .34, depthWrite: false });
  private ghostFlood = new MeshBasicMaterial({ map: sprites().hatch, transparent: true, opacity: .86, depthWrite: false, side: DoubleSide });
  private ghostLake = new MeshBasicMaterial({ map: sprites().hatchLake, transparent: true, opacity: .86, depthWrite: false, side: DoubleSide });
  // a hint's hatching is lighter, so the moving plate's own outline still reads through it (concept critic T2)
  private ghostFloodSoft = new MeshBasicMaterial({ map: sprites().hatch, transparent: true, opacity: .42, depthWrite: false, side: DoubleSide });
  private ghostLakeSoft = new MeshBasicMaterial({ map: sprites().hatchLake, transparent: true, opacity: .42, depthWrite: false, side: DoubleSide });
  private planeG = new PlaneGeometry(.96, .96);

  clearPreview() {
    this.ghostGroup.clear();
    for (const s of this.badgePool) s.visible = false;
    for (const c of this.creatures) c.hideWish(false);
  }
  showPreview(diff: MoveDiff | null, tell = true, wholePlate = false) {
    this.clearPreview();
    if (!diff) return;
    const s = this.state;
    // a hint's preview also lays the plate's new footprint over the land it takes: the second press says where the plate ends up (playtest 11 P11-2b)
    if (wholePlate) for (const cell of diff.arrive) {
      if (s.plate[cell] < 0 || diff.rise.some(([c]) => c === cell)) continue;
      const [x, z] = this.xz(cell), m = new Mesh(this.planeG, this.ghostArrive);
      m.rotation.x = -Math.PI / 2; m.position.set(x, topY(s.elev[cell]) + .025, z); m.renderOrder = 7; this.ghostGroup.add(m);
    }
    for (const [cell, h] of diff.rise) {
      const [x, z] = this.xz(cell), a = topY(s.elev[cell]), b = topY(h);
      const m = new Mesh(this.ghostBoxG, this.ghostRise); m.scale.set(1, Math.max(.05, b - a), 1); m.position.set(x, (a + b) / 2, z); m.renderOrder = 7; this.ghostGroup.add(m);
      // on a hint the arrow says which way: the chevrons only say "rises", so they stay small and still (concept critic T1)
      const sp = makeSprite(sprites().chevrons, wholePlate ? .26 : .46, 15); sp.position.set(x, b + (wholePlate ? .2 : .3), z); sp.userData.pulse = !wholePlate; this.ghostGroup.add(sp);
    }
    // the board after the move, so each flooded cell can say whether it joins the sea or closes into a lake
    const after = s.plate.slice(); for (const c of diff.arrive) after[c] = 0; for (const c of diff.flood) after[c] = -1;
    const sea = diff.flood.length ? seaMask(this.lv, { ...s, plate: after }) : null;
    for (const cell of diff.flood) {
      const [x, z] = this.xz(cell);
      const hatch = sea?.[cell] ? (wholePlate ? this.ghostFloodSoft : this.ghostFlood) : (wholePlate ? this.ghostLakeSoft : this.ghostLake);
      // ice about to melt lies on top of the plate carrying it: on the cell's own height the dragged plate covered it, and Thin Ice's whole point never showed (playtest 14)
      const top = wholePlate ? undefined : diff.meltTop.find(([c]) => c === cell); // a hint only leans the plate, so the cell itself is still in view
      const m = new Mesh(this.planeG, hatch); m.rotation.x = -Math.PI / 2; m.position.set(x, topY(top ? Math.max(top[1], s.elev[cell]) : s.elev[cell]) + (top ? .08 : .025), z); m.renderOrder = 7; this.ghostGroup.add(m);
    }
    for (const cell of diff.arrive) {
      if (s.plate[cell] >= 0) continue;
      const [x, z] = this.xz(cell); const b = .42;
      const m = new Mesh(this.ghostBoxG, this.ghostArrive); m.scale.set(1, b, 1); m.position.set(x, b / 2, z); m.renderOrder = 7; this.ghostGroup.add(m);
    }
    // goal flips: a + or - on the creature, so a move's consequence is visible before committing
    if (tell) diff.flips.forEach(([g, met]) => {
      const c = this.creatures.find(k => k.goalIndex === g); if (!c) return;
      const sp = makeSprite(met ? sprites().plus : sprites().minus, .34, 24);
      sp.position.set(c.root.position.x, c.root.position.y + HEAD_Y[c.kind] * KIND_SCALE[c.kind] + .05, c.root.position.z); sp.userData.pulse = true;
      this.ghostGroup.add(sp); c.hideWish(true);
    });
  }

  private finishTweens() {
    for (const c of this.cols) { c.t = c.dur; c.x = c.tx; c.y = c.ty; c.z = c.tz; if (c.removing) this.kill(c); }
    this.cols = this.cols.filter(c => !c.dead);
    this.crT = [];
    this.writeMatrices();
  }
  private kill(c: Column) {
    c.dead = true; this.free.push(c.idx);
    this.mesh.setMatrixAt(c.idx, mat4.makeScale(0, 0, 0)); this.mesh.instanceMatrix.needsUpdate = true;
    for (const m of c.decor) this.group.remove(m);
  }

  update(dt: number, t: number) {
    this.time = t;
    let moving = false;
    for (let p = 0; p < this.lv.plates; p++) {
      const dl = this.liftT[p] - this.lift[p];
      if (Math.abs(dl) > .0005) { this.lift[p] += dl * Math.min(1, dt * 14); moving = true; }
    }
    // drag offset eases toward the pointer so it feels weighty, and back to zero on release
    const wantX = this.dragPlate !== null ? this.dragVec.x : 0, wantZ = this.dragPlate !== null ? this.dragVec.z : 0;
    const k = 1 - Math.exp(-dt * 26);
    this.dragNow.x += (wantX - this.dragNow.x) * k; this.dragNow.z += (wantZ - this.dragNow.z) * k;
    if (Math.abs(this.dragNow.x - wantX) + Math.abs(this.dragNow.z - wantZ) > .001 || this.dragPlate !== null) moving = true;
    for (const c of this.cols) {
      if (c.dead) continue;
      if (c.t < c.dur) {
        c.t = Math.min(c.dur, c.t + dt);
        const u = easeInOut(Math.min(1, c.t / Math.min(c.dur, MOVE_TIME)));
        c.x = c.fx + (c.tx - c.fx) * u; c.z = c.fz + (c.tz - c.fz) * u;
        const v = Math.max(0, Math.min(1, (c.t - c.yDelay) / Math.max(.001, c.yDur)));
        c.y = c.fy + (c.ty - c.fy) * (c.bouncy ? easeOutBack(v) : easeOut(v));
        moving = true;
        if (c.t >= c.dur) { c.x = c.tx; c.z = c.tz; c.y = c.ty; if (c.removing) this.kill(c); }
      } else if (c.yDelay + c.yDur > c.dur && c.y !== c.ty) {
        c.y = c.ty;
      }
      // a hint's plate breathes, so "this one" is plain among neighbours of nearly the same colour (playtest 4 P4)
      const breathing = this.railHint && this.railPlate === c.plate && this.selected !== c.plate;
      const dh = (breathing ? (this.calm ? .45 : .32 + .28 * Math.sin(t * 4.2)) : c.hiT) - c.hi;
      if (Math.abs(dh) > .004) { c.hi += dh * Math.min(1, dt * 12); writeHi(this.mesh, c.idx, c.hi); }
    }
    for (let i = this.cols.length - 1; i >= 0; i--) if (this.cols[i].dead) this.cols.splice(i, 1);
    this.writeMatrices();
    // creatures follow their cells
    for (let i = this.crT.length - 1; i >= 0; i--) {
      const tw = this.crT[i];
      tw.t = Math.min(tw.dur, tw.t + dt);
      const u = easeInOut(tw.t / tw.dur), v = easeOut(Math.min(1, Math.max(0, (tw.t - tw.dur * .4) / (tw.dur * .6))));
      tw.c.root.position.set(tw.fx + (tw.tx - tw.fx) * u, tw.fy + (tw.ty - tw.fy) * v, tw.fz + (tw.tz - tw.fz) * u);
      moving = true;
      if (tw.t >= tw.dur) this.crT.splice(i, 1);
    }
    // creatures riding the dragged plate; decor visibility
    for (const cr of this.creatures) {
      const cell = this.creatureCell(cr, this.state), p = this.state.plate[cell];
      const [bx, bz] = this.xz(cell);
      const riding = cr.kind !== 'buoy' && p >= 0;
      if (!this.crT.some(t => t.c === cr)) {
        const shoved = cr.kind === 'buoy' && this.state.objs.some(o => o.cell === cell); // as in moveCreatures
        cr.root.position.x = bx + (shoved ? .3 : 0) + (riding && p === this.dragPlateNow() ? this.dragNow.x : 0);
        cr.root.position.z = bz - (shoved ? .3 : 0) + (riding && p === this.dragPlateNow() ? this.dragNow.z : 0);
        const baseY = this.creatureY(cr, this.state, cell);
        cr.root.position.y = baseY + (riding ? this.lift[p] : 0);
      }
      cr.update(dt, t);
    }
    this.placeBubbles();
    this.stepLeak(dt, t);
    // ghost pulses
    for (const o of this.ghostGroup.children) if (o.userData.pulse) { const s = o as Sprite, b = .42 + Math.sin(t * 7) * .05; s.scale.setScalar(b); }
    // rail arrows
    if (this.rail.visible) {
      for (const a of this.railParts.arrows) {
        const b = a.userData.base as Vector3 | undefined; if (!b) continue;
        const w = Math.sin(t * 5) * .05 * a.userData.sign;
        a.position.set(b.x + (a.userData.ax === 1 ? w : 0), b.y, b.z + (a.userData.ax === 1 ? 0 : w));
      }
      const big = this.railParts.big, bb = big.userData.base as Vector3 | undefined;
      if (bb && big.visible) { const w = this.calm ? 0 : (Math.sin(t * 3.2) * .5 + .5) * .07 * big.userData.sign; big.position.set(bb.x + (big.userData.ax === 1 ? w : 0), bb.y, bb.z + (big.userData.ax === 1 ? 0 : w)); }
      const knobG = this.railParts.knob; const glow = 1 + Math.sin(t * 4) * .08; knobG.scale.set(glow, glow, 1);
      // the knob rides the dragged plate; the track stays put
      const kb = knobG.userData.base as Vector3 | undefined;
      if (kb) { const on = this.dragPlateNow() === this.railPlate; knobG.position.set(kb.x + (on ? this.dragNow.x : 0), kb.y, kb.z + (on ? this.dragNow.z : 0)); }
    }
    this.busy = moving || [...this.dry.values()].some(d => d.at + .2 > t);
    for (const [cell, d] of this.dry) if (d.at + .2 < t - .2) { if (!d.lake) this.dry.delete(cell); else this.dry.delete(cell); }
  }
  /** A drag just committed plate p: bake the on-screen drag offset into its columns, so the move's tween starts exactly
   *  where the plate is (no snap back). Creatures keep their on-screen position: their tween starts from root.position. */
  absorbDrag(p: number) {
    if (this.dragPlateNow() !== p) return;
    const dx = this.dragNow.x, dz = this.dragNow.z;
    for (const c of this.cols) if (c.plate === p && !c.removing && !c.dead) { c.x += dx; c.z += dz; }
    this.dragNow.set(0, 0, 0); this.dragVec.set(0, 0, 0); this.dragPlate = null; this.lastDragPlate = null;
  }
  /** Where a plate's rail anchor is in world space (for the tutorial hand). */
  railAnchor(p: number) {
    const [x, z] = this.railHome(p), off = this.state.off ? this.state.off[p] : 0, ax = this.lv.axis[p];
    return new Vector3(this.ox + x + (ax === 1 ? off : 0), this.railY(p), this.oz + z + (ax === 1 ? 0 : off));
  }
  /** The plate currently offset by a drag (it keeps easing home after release). */
  private dragPlateNow() { return this.dragPlate ?? this.lastDragPlate; }
  private lastDragPlate: number | null = null;
  noteDragEnd(p: number) { this.lastDragPlate = p; }

  /** The column a plate's slider rides: its own, or the nearest one the plate still has once a neighbour has bitten that one away. */
  private markCol(k: { plate: number; patX: number; patZ: number }, taken: Column[] = []) {
    let best: Column | undefined, bd = Infinity;
    for (const q of this.cols) {
      if (q.plate !== k.plate || q.removing || q.dead) continue;
      let d = (q.patX - k.patX) ** 2 + (q.patZ - k.patZ) ** 2;
      // two sliders side by side grab each other's presses (playtest 4 P1, Mirage): another cell of the plate if it has one
      if (taken.some(t => Math.abs(t.tx - q.tx) < 1.2 && Math.abs(t.tz - q.tz) < 1.2)) d += 1000;
      if (d < bd) { bd = d; best = q; }
    }
    return best;
  }
  private railCol(p: number) {
    const k = this.marks.find(m => m.plate === p);
    return k && (k.at && k.at.plate === p && !k.at.dead && !k.at.removing ? k.at : this.markCol(k));
  }
  /** The height the rail rides at: the slider's own cell, not the plate's highest (playtest 6, a hint rail and its hand floated over the water beside a low cell). */
  private railY(p: number) { const c = this.railCol(p); return (c ? c.ty : this.plateTop(p)) + .07; }
  /** Where a plate's rail is counted from: at the plate's current offset it lies on land the plate still has (playtest 3: a hint rail floated out over the sea). */
  private railHome(p: number): [number, number] {
    const c = this.railCol(p); // the rail replaces the slider, in the same place
    if (!c) return this.plateAnchor(p);
    const off = this.state.off ? this.state.off[p] : 0, ax = this.lv.axis[p] === 1;
    // where it is going, not where it is mid-slide: the rail is refreshed once, at the start of the move
    return [c.tx - (ax ? off : 0), c.tz - (ax ? 0 : off)];
  }

  private writeMatrices() {
    const dp = this.dragPlateNow();
    const v = this.mesh.instanceMatrix;
    for (const c of this.cols) {
      if (c.dead) continue;
      const dragged = c.plate === dp && !c.removing;
      const x = c.x + (dragged ? this.dragNow.x : 0), z = c.z + (dragged ? this.dragNow.z : 0), y = c.y + this.lift[c.plate];
      mat4.makeTranslation(x, y, z);
      this.mesh.setMatrixAt(c.idx, mat4);
      for (const m of c.decor) {
        // nothing grows on the cell that carries a plate's slider while it shows
        const onMark = this.showMarks && this.marks.some(k => k.at === c);
        const showing = !onMark && c.level < 2 && !c.removing && !this.occupied(c) && this.dim < .5 && (!m.userData.bloom || this.bloomed);
        const s = (m.userData.k ?? 1) + ((showing ? 1 : 0) - (m.userData.k ?? 1)) * (m.userData.bloom ? .09 : .25);
        m.userData.k = s; m.visible = s > .02;
        m.position.set(x + m.userData.dx, y, z + m.userData.dz);
        m.scale.setScalar(m.userData.s * s);
      }
    }
    v.needsUpdate = true;
    const taken: Column[] = [];
    for (const k of this.marks) {
      const hinted = this.railPlate !== null && this.railHint; // while a hint points at one plate, the others' sliders stay out of its way
      const c = this.showMarks ? this.markCol(k, taken) : undefined;
      k.at = c; if (c) taken.push(c);
      k.m.visible = !!c && this.railPlate !== k.plate && !hinted;
      // hovering swaps a slider for its rail: it stays a grab target, or the plate under it steals the press that follows
      k.grab = !!c && (!hinted || this.railPlate === k.plate);
      if (c) {
        const d = c.plate === dp; k.m.position.set(c.x + (d ? this.dragNow.x : 0), c.y + this.lift[c.plate] + .014, c.z + (d ? this.dragNow.z : 0));
        k.knob.position.x = (this.state.off?.[k.plate] ?? 0) * MARK_STEP;
      }
    }
  }

  /** Coastline rectangles in world space, for the ocean masks. */
  landRects(out: LandRect[] = []) {
    const dp = this.dragPlateNow();
    for (const c of this.cols) {
      if (c.dead || c.y < .04) continue;
      const dragged = c.plate === dp && !c.removing;
      const x = this.ox + c.x + (dragged ? this.dragNow.x : 0), z = this.oz + c.z + (dragged ? this.dragNow.z : 0);
      out.push({ x0: x - .5, z0: z - .5, x1: x + .5, z1: z + .5, cut: c.cut });
    }
    return out;
  }
  waterRects(out: WaterRect[] = [], settled = false) {
    const { lv, state: s } = this, sea = seaMask(lv, s), t = this.time;
    for (let i = 0; i < lv.w * lv.h; i++) {
      if (s.plate[i] >= 0) continue;
      const [x, z] = this.xz(i), d = this.dry.get(i);
      const dry = d && !settled ? Math.max(0, Math.min(1, (d.at + .16 - t) / .16)) : 0;
      if (!sea[i] || dry > 0) out.push({ x0: this.ox + x - .5, z0: this.oz + z - .5, x1: this.ox + x + .5, z1: this.oz + z + .5, lake: sea[i] ? 0 : 1 - dry, dry });
    }
    return out;
  }
  /** On the win the silhouette shows for a creature only partly behind land too: a rater saw the buoy cut off at the moment it was solved (playtest 10). */
  celebrate(on: boolean) {
    this.celebrating = on;
    for (const c of this.creatures) { c.celebrate(on); c.setXray((this.hidden.get(c) ?? 0) >= (on ? XRAY_WIN : XRAY_PLAY)); }
  }
  private celebrating = false;
  private hidden = new Map<Creature, number>();
  /** Worst-case size of the board in world units, with its centre at (ox, oz). */
  get span() { return Math.max(this.lv.w, this.lv.h); }
  /** The box the camera must keep in view: start land plus how far each plate can slide, clipped to the grid. */
  /** What the level camera must keep on screen, in island space: every land cell, a step of each plate's slide, and whoever stands on it. */
  /** Points the camera must hold: the start board while playing (it must not creep per move), the board as it now stands on the win screen. */
  framePoints(current = false) {
    if (current) return this.statePoints(this.state, 1.25, true);
    const pts = this.statePoints(this.lv.start, .72, false);
    if (this.alsoFrame) pts.push(...this.statePoints(this.alsoFrame, .72, false));
    // a wish is half the puzzle: its bubble must clear the top bar, wherever it had to sit
    this.placeBubbles();
    for (const c of this.creatures) {
      if (!c.bubble) continue;
      const S = KIND_SCALE[c.kind], h = c.bubbleHome, y0 = HEAD_Y[c.kind] * S, p = c.root.position;
      pts.push(new Vector3(p.x + h[0] * S, p.y + y0 + h[1] * S + .34, p.z + h[2] * S));
    }
    return pts;
  }
  /** A second state the framing must hold (the title island's two poses). */
  alsoFrame?: State;
  private reach: Vector3[] | null = null;
  /**
   * While playing the camera never moves: it is set once to hold what the level can become (second playtest P1: a camera stepping
   * back between moves slid the plates out from under the finger and made the island look different each time). These points are the
   * tallest each cell gets within par moves of the start. Holding every reachable state would cost a third of the board's size for
   * boards nobody plays; a plate pushed further than that may run under the HUD or a little off the edge, and it can still be pulled back.
   */
  reachPoints() {
    if (this.reach) return this.reach;
    const { lv } = this, moves = railMoves(lv), tops = new Float32Array(lv.w * lv.h).fill(-1), reachDepth = lv.par ?? 4;
    const seen = new Set([stateKey(lv.start)]), q: State[] = [lv.start], depth = [0];
    for (let k = 0; k < q.length; k++) {
      const s = q[k], objs = new Set(s.objs.map(o => o.cell));
      for (let i = 0; i < tops.length; i++) if (s.plate[i] >= 0) tops[i] = Math.max(tops[i], topY(s.elev[i]) + (objs.has(i) ? .72 : .05));
      if (q.length >= 4000 || depth[k] >= reachDepth) continue;
      for (const [p, d] of moves) { const n = shift(lv, s, p, d); if (n) { const key = stateKey(n); if (!seen.has(key)) { seen.add(key); q.push(n); depth.push(depth[k] + 1); } } }
    }
    const pts: Vector3[] = [];
    tops.forEach((top, i) => {
      if (top < 0) return;
      const [x, z] = this.xz(i);
      for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) pts.push(new Vector3(x + sx * .56, -.05, z + sz * .56), new Vector3(x + sx * .56, top, z + sz * .56));
    });
    return this.reach = pts;
  }
  /** Every free plate's slider as a screen-picking target: a handle that stays reachable behind tall land. */
  markSegments() {
    const out: { plate: number; a: Vector3; b: Vector3; reach: number }[] = [];
    for (const k of this.marks) {
      if (!k.grab) continue;
      const ax = this.lv.axis[k.plate] === 1, half = this.lv.maxTravel * MARK_STEP + .06, p = k.m.position, shown = this.railPlate === k.plate;
      const seg = (from: number, to: number, reach: number, y = p.y) => out.push({ plate: k.plate, reach, a: new Vector3(this.ox + p.x + (ax ? from : 0), y, this.oz + p.z + (ax ? 0 : from)), b: new Vector3(this.ox + p.x + (ax ? to : 0), y, this.oz + p.z + (ax ? 0 : to)) });
      // the plate whose rail is showing is the one the player is looking at: it wins a close call, and the dots
      // out at the rail's ends grab it too, a little more tightly so they don't steal the plate next door
      seg(-half, half, shown ? 26 : 16);
      // a knob itself grabs its own plate: the shown rail's end dot lay on a neighbour's knob and stole it (Two Waters after its first move, Nov 5 full play)
      seg(0, 0, 30);
      if (shown) { const y = this.railY(k.plate); seg(-1.15, 1.15, 12, y); seg(-1, -1, 26, y); seg(1, 1, 26, y); seg(0, 0, 26, y); } // the rail rides above the slider's cell
    }
    return out;
  }
  private statePoints(s: State, head: number, buoys: boolean) {
    const { lv } = this, pts: Vector3[] = [];
    const objs = new Set([...s.objs.map(o => o.cell), ...(buoys ? lv.buoys : [])]);
    for (let i = 0; i < s.plate.length; i++) {
      const p = s.plate[i]; if (p < 0) continue;
      const [x, z] = this.xz(i), slide = lv.pinned?.includes(p) ? 0 : .06, ax = lv.axis[p] === 1;
      const top = topY(s.elev[i]) + (objs.has(i) ? head : .05);
      for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        const px = x + sx * (.5 + (ax ? slide : 0)), pz = z + sz * (.5 + (ax ? 0 : slide));
        pts.push(new Vector3(px, -.05, pz), new Vector3(px, top, pz));
      }
    }
    return pts;
  }
  frameBox() {
    const { lv } = this, s = lv.start;
    let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9, top = 0;
    for (let i = 0; i < s.plate.length; i++) {
      const p = s.plate[i]; if (p < 0) continue;
      const [x, z] = this.xz(i);
      x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z);
      top = Math.max(top, topY(s.elev[i]));
    }
    // half a cell of land edge plus one more: a plate that slides out still reads, at worst touching the frame
    x0 -= .55; x1 += .55; z0 -= .55; z1 += .55;
    return { cx: (x0 + x1) / 2, cz: (z0 + z1) / 2, hx: (x1 - x0) / 2, hz: (z1 - z0) / 2, top: top + .55 };
  }
  biomeLook() { return BIOMES[this.biome]; }
}
