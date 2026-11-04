// One level's island: columns, creatures, decor, rails and move preview. The view holds no rules: it is told the State
// to show and reconciles its columns by identity (plate + plate-anchored cell), so a move, an undo and a restart all
// animate the same way.
import { BoxGeometry, Group, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial, PlaneGeometry, Vector3, CylinderGeometry, TorusGeometry, ConeGeometry, Color, DoubleSide, type MeshLambertMaterial, type Sprite } from 'three';
import type { MoveDiff } from '../rules/diff.ts';
import { DX, DY, seaMask, shift, type Dir, type Level, type State } from '../rules/rules.ts';
import { Creature, MAT, HEAD_Y, KIND_SCALE, type CreatureKind } from './creatures.ts';
import * as M from './models.ts';
import type { LandRect, WaterRect } from './ocean.ts';
import { BIOMES, plateBand, plateTint, topY, type BiomeName } from './palette.ts';
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
  private railParts: { tube: Mesh; caps: Mesh[]; stops: Mesh[]; knob: Mesh; arrows: Mesh[] };
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
  private anchors: Mesh[] = [];
  private marks: { m: Group; knob: Mesh; plate: number; patX: number; patZ: number }[] = [];
  /**
   * A small slider set into each free plate: a groove, one stud per stop, and a glowing peg at the stop it is on.
   * Without touching anything it says which way the plate runs and how far it has left each way.
   */
  private buildMark(p: number) {
    const m = new Group(), n = this.lv.maxTravel, sp = MARK_STEP, flat = (o: Mesh, order: number) => { o.renderOrder = order; m.add(o); return o; };
    const mat = (color: Color | string) => new MeshBasicMaterial({ color, transparent: true, depthWrite: false });
    flat(new Mesh(new BoxGeometry(2 * n * sp + .1, .004, .075), mat(new Color('#3a2c22'))), 6);
    for (let k = -n; k <= n; k++) { const st = flat(new Mesh(new CylinderGeometry(.052, .052, .006, 14), mat('#fff7e6')), 7); st.position.x = k * sp; }
    const knob = new Mesh(new CylinderGeometry(.092, .092, .01, 20), mat(plateBand(p))); knob.renderOrder = 8; m.add(knob);
    const core = new Mesh(new CylinderGeometry(.05, .05, .012, 16), mat('#ffffff')); core.renderOrder = 9; knob.add(core);
    m.rotation.y = this.lv.axis[p] === 1 ? 0 : -Math.PI / 2; m.visible = false; // -90 deg: local +x is world +z, the way the offset counts
    return { m, knob };
  }
  /** Axis marks show on the island being played, until it is solved. */
  showMarks = false;
  /** Bubbles step aside while a plate is dragged. */
  /** Wish bubbles step to a side of their creature where they cover nobody else, judged in screen space (the camera angle is fixed). */
  private bubbleKey = '';
  private placeBubbles() {
    const key = this.creatures.map(c => `${Math.round(c.root.position.x * 4)},${Math.round(c.root.position.z * 4)},${Math.round(c.root.position.y * 4)},${c.met ? 1 : 0}`).join(';');
    if (key === this.bubbleKey) return;
    this.bubbleKey = key;
    const CA = Math.cos(.72), SA = Math.sin(.72), CE = Math.cos(.82), SE = Math.sin(.82);
    const screen = (x: number, y: number, z: number): [number, number] => [x * CA - z * SA, y * CE - (x * SA + z * CA) * SE];
    type Blob = { u: number; v: number; r: number; owner: Creature };
    const blobs: Blob[] = [];
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
        const u = hu + o[0], v = hv + o[1]; let cost = n * .02;
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
      this.marks.push({ m, knob, plate: p, patX, patZ }); this.group.add(m);
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
      const cell = this.creatureCell(c, next), [tx, tz] = this.xz(cell), ty = this.creatureY(c, next, cell);
      if (animate) this.crT.push({ c, fx: c.root.position.x, fy: c.root.position.y, fz: c.root.position.z, tx, ty, tz, t: 0, dur, delay: 0 });
      else c.root.position.set(tx, ty, tz);
      if (c.kind === 'goat') {
        // it stands looking along the island, never out over the water
        const x = cell % this.lv.w, y = Math.floor(cell / this.lv.w);
        const land = (a: number, b: number) => a >= 0 && b >= 0 && a < this.lv.w && b < this.lv.h && next.plate[a + b * this.lv.w] >= 0;
        c.face(land(x, y + 1) || !land(x + 1, y) ? -.4 : 1.25, !animate);
      }
    }
  }

  applyGoals(g: boolean[], animate: boolean) { this.creatures.forEach(c => c.setMet(g[c.goalIndex], animate)); }

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
  setSelected(p: number | null) { this.selected = p; this.refreshHi(); this.showRail(p); }
  private refreshHi() {
    for (let p = 0; p < this.lv.plates; p++) this.liftT[p] = this.selected === p ? .05 : this.hover === p ? .02 : 0;
    for (const c of this.cols) if (!c.dead) c.hiT = this.selected === c.plate ? 1 : this.hover === c.plate ? .55 : 0;
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
    const arrowG = new ConeGeometry(.11, .22, 3); const arrows = [0, 1].map(() => { const a = new Mesh(arrowG, new MeshBasicMaterial({ color: '#ffffff', transparent: true, depthTest: false, depthWrite: false })); a.renderOrder = 13; this.rail.add(a); return a; });
    this.rail.visible = false;
    this.group.add(this.rail);
    return { tube, caps, stops, knob, arrows };
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
    const ax = this.lv.axis[p], mt = this.lv.maxTravel, [ax0, az0] = this.plateAnchor(p);
    const off = this.state.off ? this.state.off[p] : 0;
    const y = this.plateTop(p) + .07;
    const place = (o: Mesh, k: number) => { o.position.set(ax === 1 ? ax0 + k : ax0, y, ax === 1 ? az0 : az0 + k); };
    const range = this.legalRange(p);
    // the rail shows what matters: every legal stop, plus one red stop past each end when something (not the rail's end) refuses it
    const lo = Math.max(-mt, off - range.neg - 1), hi = Math.min(mt, off + range.pos + 1);
    const tubeLen = hi - lo + .3, mid = (lo + hi) / 2;
    place(P.tube, mid); P.tube.scale.set(tubeLen, 1, 1); P.tube.rotation.y = ax === 1 ? 0 : Math.PI / 2;
    const sh = P.tube.userData.shadow as Mesh; sh.position.copy(P.tube.position); sh.position.y -= .01; sh.scale.copy(P.tube.scale); sh.rotation.copy(P.tube.rotation);
    P.caps.forEach((c, i) => { c.visible = (i ? hi : lo) === (i ? mt : -mt); place(c, (i ? mt + .12 : -mt - .12)); c.rotation.y = ax === 1 ? 0 : Math.PI / 2; });
    P.stops.forEach((st, i) => {
      const k = i - mt; place(st, k);
      st.visible = k >= lo && k <= hi;
      const rel = k - off, legal = rel === 0 || (rel < 0 ? -rel <= range.neg : rel <= range.pos);
      (st.material as MeshBasicMaterial).color.set(legal ? '#fff7e6' : '#d8574a');
      st.scale.setScalar(legal ? 1 : .72);
    });
    place(P.knob, off);
    P.knob.userData.base = P.knob.position.clone();
    P.arrows.forEach((a, i) => {
      const sign = i ? 1 : -1, ok = i ? range.pos > 0 : range.neg > 0;
      a.visible = ok;
      place(a, off + sign * .34);
      a.rotation.set(Math.PI / 2, 0, ax === 1 ? -sign * Math.PI / 2 : (sign > 0 ? Math.PI : 0));
      a.userData.base = a.position.clone(); a.userData.sign = sign; a.userData.ax = ax;
    });
  }

  // ---- move preview (design audit S1: only the difference is drawn)
  private ghostBoxG = new BoxGeometry(.92, 1, .92);
  private ghostRise = new MeshBasicMaterial({ color: '#ffb25e', transparent: true, opacity: .46, depthWrite: false });
  private ghostArrive = new MeshBasicMaterial({ color: '#fff4cf', transparent: true, opacity: .34, depthWrite: false });
  private ghostFlood = new MeshBasicMaterial({ map: sprites().hatch, transparent: true, opacity: .86, depthWrite: false, side: DoubleSide });
  private planeG = new PlaneGeometry(.96, .96);

  clearPreview() {
    this.ghostGroup.clear();
    for (const s of this.badgePool) s.visible = false;
    for (const c of this.creatures) c.hideWish(false);
  }
  showPreview(diff: MoveDiff | null) {
    this.clearPreview();
    if (!diff) return;
    const s = this.state;
    for (const [cell, h] of diff.rise) {
      const [x, z] = this.xz(cell), a = topY(s.elev[cell]), b = topY(h);
      const m = new Mesh(this.ghostBoxG, this.ghostRise); m.scale.set(1, Math.max(.05, b - a), 1); m.position.set(x, (a + b) / 2, z); m.renderOrder = 7; this.ghostGroup.add(m);
      const sp = makeSprite(sprites().chevrons, .46, 15); sp.position.set(x, b + .3, z); sp.userData.pulse = true; this.ghostGroup.add(sp);
    }
    for (const cell of diff.flood) {
      const [x, z] = this.xz(cell);
      const m = new Mesh(this.planeG, this.ghostFlood); m.rotation.x = -Math.PI / 2; m.position.set(x, topY(s.elev[cell]) + .025, z); m.renderOrder = 7; this.ghostGroup.add(m);
    }
    for (const cell of diff.arrive) {
      if (s.plate[cell] >= 0) continue;
      const [x, z] = this.xz(cell); const b = .42;
      const m = new Mesh(this.ghostBoxG, this.ghostArrive); m.scale.set(1, b, 1); m.position.set(x, b / 2, z); m.renderOrder = 7; this.ghostGroup.add(m);
    }
    // goal flips: a + or - on the creature, so a move's consequence is visible before committing
    diff.flips.forEach(([g, met]) => {
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
      const dh = c.hiT - c.hi;
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
        cr.root.position.x = bx + (riding && p === this.dragPlateNow() ? this.dragNow.x : 0);
        cr.root.position.z = bz + (riding && p === this.dragPlateNow() ? this.dragNow.z : 0);
        const baseY = this.creatureY(cr, this.state, cell);
        cr.root.position.y = baseY + (riding ? this.lift[p] : 0);
      }
      cr.update(dt, t);
    }
    this.placeBubbles();
    // ghost pulses
    for (const o of this.ghostGroup.children) if (o.userData.pulse) { const s = o as Sprite, b = .42 + Math.sin(t * 7) * .05; s.scale.setScalar(b); }
    // rail arrows
    if (this.rail.visible) {
      for (const a of this.railParts.arrows) {
        const b = a.userData.base as Vector3 | undefined; if (!b) continue;
        const w = Math.sin(t * 5) * .05 * a.userData.sign;
        a.position.set(b.x + (a.userData.ax === 1 ? w : 0), b.y, b.z + (a.userData.ax === 1 ? 0 : w));
      }
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
    const [x, z] = this.plateAnchor(p), off = this.state.off ? this.state.off[p] : 0, ax = this.lv.axis[p];
    return new Vector3(this.ox + x + (ax === 1 ? off : 0), this.plateTop(p) + .07, this.oz + z + (ax === 1 ? 0 : off));
  }
  /** The plate currently offset by a drag (it keeps easing home after release). */
  private dragPlateNow() { return this.dragPlate ?? this.lastDragPlate; }
  private lastDragPlate: number | null = null;
  noteDragEnd(p: number) { this.lastDragPlate = p; }

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
        const onMark = this.showMarks && this.marks.some(k => k.plate === c.plate && k.patX === c.patX && k.patZ === c.patZ);
        const showing = !onMark && c.level < 2 && !c.removing && !this.occupied(c) && this.dim < .5 && (!m.userData.bloom || this.bloomed);
        const s = (m.userData.k ?? 1) + ((showing ? 1 : 0) - (m.userData.k ?? 1)) * (m.userData.bloom ? .09 : .25);
        m.userData.k = s; m.visible = s > .02;
        m.position.set(x + m.userData.dx, y, z + m.userData.dz);
        m.scale.setScalar(m.userData.s * s);
      }
    }
    v.needsUpdate = true;
    for (const k of this.marks) {
      const c = this.showMarks && this.railPlate !== k.plate ? this.cols.find(q => q.plate === k.plate && q.patX === k.patX && q.patZ === k.patZ && !q.removing && !q.dead) : undefined;
      k.m.visible = !!c;
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
  celebrate(on: boolean) { for (const c of this.creatures) c.celebrate(on); }
  /** Worst-case size of the board in world units, with its centre at (ox, oz). */
  get span() { return Math.max(this.lv.w, this.lv.h); }
  /** The box the camera must keep in view: start land plus how far each plate can slide, clipped to the grid. */
  /** What the level camera must keep on screen, in island space: every land cell, a step of each plate's slide, and whoever stands on it. */
  /** Points the camera must hold: the start board while playing (it must not creep per move), the board as it now stands on the win screen. */
  framePoints(current = false) {
    const { lv } = this, s = current ? this.state : lv.start, pts: Vector3[] = [], head = current ? 1.25 : .7;
    const objs = new Set([...s.objs.map(o => o.cell), ...(current ? lv.buoys : [])]);
    for (let i = 0; i < s.plate.length; i++) {
      const p = s.plate[i]; if (p < 0) continue;
      const [x, z] = this.xz(i), slide = lv.pinned?.includes(p) ? 0 : .15, ax = lv.axis[p] === 1;
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
