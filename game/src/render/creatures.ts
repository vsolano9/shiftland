// A goal creature on the board: its model, pose, wish bubble and reactions (concepts/shiftland-creatures.png).
// The island view owns where it stands; this class owns how it feels about it.
import { AdditiveBlending, BoxGeometry, BufferGeometry, Color, ConeGeometry, DoubleSide, Float32BufferAttribute, Group, Matrix4, Mesh, MeshBasicMaterial, MeshLambertMaterial, SphereGeometry, type Sprite } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import * as M from './models.ts';
import type { Particles } from './particles.ts';
import { makeSprite, sprites, type WishIcon } from './sprites.ts';

export const MAT = new MeshLambertMaterial({ vertexColors: true, flatShading: true });
const mesh = (g: import('three').BufferGeometry, shadow = true) => { const m = new Mesh(g, MAT); m.castShadow = shadow; m.receiveShadow = false; return m; };

export type CreatureKind = 'goat' | 'village' | 'light' | 'oasis' | 'penguin' | 'buoy';
const WISH: Partial<Record<CreatureKind, WishIcon>> = { goat: 'peak', light: 'sea', buoy: 'sea', oasis: 'lake', penguin: 'ice' };
export const HEAD_Y: Record<CreatureKind, number> = { goat: 0.72, village: 0.72, light: 1.16, buoy: 0.68, oasis: 0.78, penguin: 0.62 };
/** Characters stand larger than their cell, as on the concept sheets: they must read at a glance at island zoom. */
export const KIND_SCALE: Record<CreatureKind, number> = { goat: 1.9, village: 1.55, light: 1.45, buoy: 1.55, oasis: 1.4, penguin: 1.6 };

const ease = (t: number) => t * t * (3 - 2 * t);
const back = (t: number) => { const c = 1.9; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };

export class Creature {
  root = new Group();       // positioned by the island view
  body = new Group();       // pose animation
  bubble?: Sprite; badge: Sprite;
  met = false;
  metK = 0;                 // eased 0..1
  celebrating = 0;
  pop = 0;                  // 0..1 reaction pulse
  badgeLife = 0;
  private phase = Math.random() * 10;
  private next = 2 + Math.random() * 5;
  // kind parts
  private head?: Mesh; private brows?: Mesh; private legs?: Mesh;
  private houses: { g: Group; cracks: Mesh; dx: number; dz: number; rot: number }[] = [];
  private lampMat?: MeshBasicMaterial; private beam?: Mesh;
  private fish: { m: Mesh; t: number; a: number }[] = [];
  private palms: { ok: Mesh; wilt: Mesh; g: Group }[] = [];
  private pens: { g: Group; x: number; z: number; a: number }[] = [];
  private people: Mesh[] = [];
  sfx?: (s: 'bleat' | 'fish') => void;
  world: (x: number, y: number, z: number) => [number, number, number] = (x, y, z) => [x, y, z];

  constructor(readonly kind: CreatureKind, readonly goalIndex: number, private fx: Particles, seed: number) {
    this.root.add(this.body);
    this.body.rotation.y = 0.3;
    this.badge = makeSprite(sprites().check, 0.34, 22);
    this.badge.visible = false; this.badge.position.y = HEAD_Y[kind] - .02;
    this.root.add(this.badge);
    const wish = WISH[kind];
    if (wish) {
      this.bubble = makeSprite(sprites().bubbles[wish], 0.62 / KIND_SCALE[kind], 21); // constant world size: root is scaled
      this.bubble.position.set(.28, HEAD_Y[kind] + .1, 0);
      this.root.add(this.bubble);
    }
    this.phase += seed;
    this.build();
  }

  private build() {
    const b = this.body;
    if (this.kind === 'goat') {
      this.legs = mesh(M.goatBody); b.add(this.legs);
      const h = new Group(); this.head = mesh(M.goatHead); this.brows = mesh(M.goatBrows, false);
      h.add(this.head, this.brows); h.position.set(0, .4, .17); b.add(h);
      b.rotation.y = 0.45;
      this.head.userData.pivot = h;
    } else if (this.kind === 'village') {
      for (const [dx, dz, rot] of [[-.2, -.18, .15], [.2, -.1, -.2], [-.04, .2, .05]] as const) {
        const g = new Group(); const m = mesh(M.house); const cr = mesh(M.houseCracks, false); cr.visible = false;
        g.add(m, cr); g.position.set(dx, 0, dz); g.rotation.y = rot;
        this.houses.push({ g, cracks: cr, dx, dz, rot }); b.add(g);
      }
      b.rotation.y = 0;
      for (let i = 0; i < 3; i++) { const p = mesh(i === 0 ? peopleA : i === 1 ? peopleB : peopleC, false); p.visible = false; p.position.set(-.26 + i * .26, .0, .38 - i * .04); b.add(p); this.people.push(p); }
    } else if (this.kind === 'light') {
      b.add(mesh(M.lighthouse));
      const lampMesh = new Mesh(M.lamp, this.lampMat = new MeshBasicMaterial({ vertexColors: true, color: 0x555555 })); b.add(lampMesh);
      const cone = new ConeGeometry(.55, 2.3, 16, 1, true); cone.translate(0, -1.15, 0); cone.rotateZ(Math.PI / 2 + 0.08);
      this.beam = new Mesh(cone, new MeshBasicMaterial({ color: '#ffe89a', transparent: true, opacity: 0, side: DoubleSide, depthWrite: false, blending: AdditiveBlending }));
      this.beam.position.y = .645; this.beam.renderOrder = 6; b.add(this.beam);
    } else if (this.kind === 'buoy') {
      b.add(mesh(M.buoy));
      for (let i = 0; i < 2; i++) { const f = mesh(M.fish, false); f.visible = false; this.root.add(f); this.fish.push({ m: f, t: 9, a: Math.random() * 6 }); }
    } else if (this.kind === 'oasis') {
      for (const [dx, dz, s, r] of [[-.2, -.12, 1.05, .4], [.18, .08, .92, 2.8]] as const) {
        const g = new Group(); g.position.set(dx, 0, dz); g.scale.setScalar(s); g.rotation.y = r;
        const ok = mesh(M.palm), wilt = mesh(M.palmWilt); g.add(ok, wilt); b.add(g); this.palms.push({ ok, wilt, g });
      }
    } else {
      for (const [x, z, a] of [[-.17, -.1, .4], [.17, -.06, -.3], [0, .17, .1]] as const) {
        const g = new Group(); g.add(mesh(M.penguin)); g.position.set(x, 0, z); g.rotation.y = a; b.add(g);
        this.pens.push({ g, x, z, a });
      }
    }
  }

  /** Called when the goal turns true or false. animate=false sets it silently (level open, map islands). */
  setMet(m: boolean, animate = true) {
    if (m === this.met && animate) return;
    const was = this.met;
    this.met = m;
    if (!animate) { this.metK = m ? 1 : 0; this.pose(0, 0); return; }
    this.pop = 1;
    if (m && !was) {
      this.showBadge(true);
      const [x, y, z] = this.world(0, HEAD_Y[this.kind] - .25, 0);
      this.fx.sparkle(x, y, z, 10);
    } else if (!m && was) {
      this.showBadge(false);
      if (this.kind === 'village') { const [x, y, z] = this.world(0, .15, 0); this.fx.dust(x, y, z, 10, '#d9c6a8'); this.fx.rubble(x, y, z, 7, '#c95b45'); }
    }
  }
  showBadge(ok: boolean) {
    this.badge.material.map = ok ? sprites().check : sprites().cross;
    this.badge.material.needsUpdate = true;
    this.badge.visible = true; this.badgeLife = 1.25;
  }
  hideWish(hidden: boolean) { if (this.bubble) this.bubble.userData.hidden = hidden; }

  celebrate(on: boolean) { this.celebrating = on ? 1 : 0; this.people.forEach(p => { p.visible = on; }); }

  update(dt: number, t: number) {
    const target = this.met ? 1 : 0;
    this.metK += Math.sign(target - this.metK) * Math.min(Math.abs(target - this.metK), dt / .35);
    this.pop = Math.max(0, this.pop - dt / .55);
    this.pose(dt, t);
    // wish bubble: shown while unhappy, bobbing gently, gone when happy
    if (this.bubble) {
      const s = (.54 / KIND_SCALE[this.kind]) * back(Math.max(0, 1 - this.metK * 1.8)) * (this.bubble.userData.hidden ? 0 : 1);
      this.bubble.scale.setScalar(Math.max(s, 0.0001));
      this.bubble.visible = s > .01;
      this.bubble.position.y = HEAD_Y[this.kind] + .12 + Math.sin(t * 1.7 + this.phase) * .02;
    }
    if (this.badge.visible) {
      this.badgeLife -= dt;
      const a = 1.25 - this.badgeLife;
      this.badge.scale.setScalar((.42 / KIND_SCALE[this.kind]) * back(Math.min(1, a / .22)) * (this.badgeLife < .2 ? this.badgeLife / .2 : 1) + .0001);
      this.badge.position.y = HEAD_Y[this.kind] - .02 + a * .06;
      if (this.badgeLife <= 0) this.badge.visible = false;
    }
  }

  private pose(dt: number, t: number) {
    const k = ease(this.metK), c = this.celebrating, ph = t + this.phase, hop = c ? Math.abs(Math.sin(ph * 5.2)) : 0;
    const pulse = Math.sin(this.pop * Math.PI);
    this.body.position.y = 0; this.body.rotation.z = 0;
    this.next -= dt;
    switch (this.kind) {
      case 'goat': {
        const pivot = this.head!.userData.pivot as Group;
        // unhappy: folded down with a drooped head, looking up with a sigh; happy: proud, tail up, a little hop
        const squat = (1 - k) * .34;
        this.legs!.scale.y = 1 - squat; this.legs!.position.y = 0;
        pivot.position.y = .4 - squat * .42 + Math.sin(ph * 1.8) * .006;
        pivot.rotation.x = k > .5 ? Math.sin(ph * .8) * .1 - .05 : -.42 + Math.sin(ph * .8) * .05;
        pivot.rotation.z = (1 - k) * Math.sin(ph * .6) * .1;
        this.brows!.visible = k < .5;
        this.body.position.y = hop * .2 + pulse * .22;
        this.body.scale.setScalar(1 + pulse * .08);
        if (this.next < 0) {
          this.next = 5 + Math.random() * 6;
          if (this.metK > .5) { this.pop = Math.max(this.pop, .9); } else { const [x, y, z] = this.world(.05, .36, .25); this.fx.sigh(x, y, z); }
        }
        break;
      }
      case 'village': {
        const crushed = 1 - k;
        this.houses.forEach((h, i) => {
          const sq = crushed * (.5 + i * .18);
          h.g.rotation.z = (i % 2 ? -1 : 1) * sq * .75 + pulse * .12 * (i % 2 ? 1 : -1);
          h.g.rotation.x = (i - 1) * crushed * .3;
          h.g.position.y = Math.abs(Math.sin(sq * 2)) * .04;
          h.g.scale.y = 1 - crushed * .1;
          h.cracks.visible = crushed > .5;
          h.g.position.x = h.dx * (1 - crushed * .12);
        });
        this.people.forEach((p, i) => { p.position.y = Math.abs(Math.sin(ph * 6 + i * 1.7)) * .13; });
        if (this.metK > .5 && this.next < 0) {
          this.next = .55 + Math.random() * .5;
          const h = this.houses[Math.floor(Math.random() * 3)];
          const [x, y, z] = this.world(h.dx + .05, .31, h.dz - .04);
          this.fx.smoke(x, y, z);
        }
        if (this.metK < .5 && this.next < 0) { this.next = 1.2 + Math.random(); const [x, y, z] = this.world(0, .25, 0); this.fx.dust(x, y, z, 2, '#b9a99a'); }
        break;
      }
      case 'light': {
        this.lampMat!.color.setRGB(.33 + k * .9, .33 + k * .85, .34 + k * .6);
        (this.beam!.material as MeshBasicMaterial).opacity = k * (.11 + .025 * Math.sin(ph * 2.3));
        this.beam!.rotation.y = ph * .55;
        this.body.rotation.z = (1 - k) * Math.sin(ph * 1.4) * .025 + pulse * .04;
        this.body.position.y = hop * .08;
        break;
      }
      case 'buoy': {
        // floating at sea it bobs; stranded on land it lies on its side
        const stranded = 1 - k;
        this.body.rotation.z = stranded * 1.32 + k * Math.sin(ph * 1.5) * .09;
        this.body.rotation.x = k * Math.sin(ph * 1.1) * .07;
        this.body.position.y = stranded * .07 + k * (Math.sin(ph * 1.5) * .025) + hop * .1;
        for (const f of this.fish) {
          f.t += dt;
          if (this.metK > .9 && f.t > 1 + (this.next < 0 ? 0 : 99)) { f.t = 0; f.a = Math.random() * 6.28; this.next = 1.4 + Math.random() * 3; this.sfx?.('fish'); const [x, , z] = this.world(Math.cos(f.a) * .42, 0, Math.sin(f.a) * .42); this.fx.splash(x, z, 5); }
          const u = f.t / .85;
          f.m.visible = u < 1;
          if (u < 1) {
            const r = .42 + u * .24;
            f.m.position.set(Math.cos(f.a) * r, Math.sin(u * Math.PI) * .42 - .01, Math.sin(f.a) * r);
            f.m.rotation.set(-(u - .5) * 2.6, -f.a + Math.PI / 2, 0, 'YXZ');
          }
        }
        break;
      }
      case 'oasis': {
        for (const p of this.palms) {
          p.ok.visible = k > .5; p.wilt.visible = k <= .5;
          p.g.rotation.z = Math.sin(ph * 1.3) * (.03 + k * .025);
          p.g.position.y = hop * .06 + pulse * .08;
        }
        break;
      }
      case 'penguin': {
        this.pens.forEach((p, i) => {
          const huddle = 1 - k, wa = ph * 3.4 + i * 2;
          p.g.position.x = p.x * (1 - huddle * .35);
          p.g.position.z = p.z * (1 - huddle * .35);
          p.g.rotation.z = Math.sin(wa) * (.05 + k * .16);
          p.g.rotation.y = p.a + (k ? Math.sin(ph * .7 + i) * k * .9 : 0);
          p.g.position.y = Math.abs(Math.sin(wa)) * k * .04 + hop * .17;
        });
        break;
      }
    }
  }
}

// tiny cheering villagers (level complete)
function person(shirt: string) {
  return mergeBox(shirt);
}
function paint(g: BufferGeometry, c: string, x = 0, y = 0, z = 0, rz = 0) {
  const o = (g.index ? g.toNonIndexed() : g).applyMatrix4(new Matrix4().makeRotationZ(rz).setPosition(x, y, z));
  o.computeVertexNormals(); o.deleteAttribute('uv');
  const col = new Color(c), n = o.getAttribute('position').count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { a[i * 3] = col.r; a[i * 3 + 1] = col.g; a[i * 3 + 2] = col.b; }
  o.setAttribute('color', new Float32BufferAttribute(a, 3));
  return o;
}
function mergeBox(shirt: string) {
  return mergeGeometries([
    paint(new BoxGeometry(.05, .07, .035), shirt, 0, .075),
    paint(new BoxGeometry(.044, .04, .032), '#4a4e6a', 0, .02),
    paint(new SphereGeometry(.028, 6, 5), '#f4c9a0', 0, .135),
    paint(new BoxGeometry(.016, .06, .016), '#f4c9a0', -.04, .135, 0, .5),
    paint(new BoxGeometry(.016, .06, .016), '#f4c9a0', .04, .135, 0, -.5),
  ])!;
}
const peopleA = person('#4c7fd0'), peopleB = person('#e0793a'), peopleC = person('#c04f8c');
