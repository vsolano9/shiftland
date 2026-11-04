// One instanced particle pool for dust, splashes, confetti, chimney smoke and sparks.
import { BufferGeometry, Color, DynamicDrawUsage, IcosahedronGeometry, InstancedBufferAttribute, InstancedMesh, Matrix4, MeshBasicMaterial, MeshLambertMaterial, PlaneGeometry, Quaternion, Vector3, Euler, Scene, DoubleSide } from 'three';

interface P { alive: boolean; x: number; y: number; z: number; vx: number; vy: number; vz: number; g: number; drag: number; size: number; grow: number; life: number; max: number; rx: number; ry: number; rz: number; spin: number; floor: number }

class Pool {
  mesh: InstancedMesh; ps: P[] = []; next = 0;
  constructor(scene: Scene, geo: BufferGeometry, mat: MeshBasicMaterial | MeshLambertMaterial, readonly cap: number) {
    this.mesh = new InstancedMesh(geo, mat, cap);
    this.mesh.instanceMatrix.setUsage(DynamicDrawUsage);
    this.mesh.instanceColor = new InstancedBufferAttribute(new Float32Array(cap * 3), 3);
    this.mesh.frustumCulled = false; this.mesh.renderOrder = 8;
    scene.add(this.mesh);
    for (let i = 0; i < cap; i++) this.ps.push({ alive: false, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, g: 0, drag: 0, size: 0, grow: 0, life: 0, max: 1, rx: 0, ry: 0, rz: 0, spin: 0, floor: -9 });
    this.mesh.count = cap;
    const zero = new Matrix4().makeScale(0, 0, 0);
    for (let i = 0; i < cap; i++) this.mesh.setMatrixAt(i, zero);
  }
  add(o: Partial<P> & { color: Color | string }) {
    const i = this.next; this.next = (i + 1) % this.cap;
    const p = this.ps[i];
    Object.assign(p, { alive: true, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, g: 0, drag: 0, size: .1, grow: 0, life: 0, max: 1, rx: Math.random() * 6, ry: Math.random() * 6, rz: Math.random() * 6, spin: 0, floor: -9 }, o);
    this.mesh.setColorAt(i, typeof o.color === 'string' ? new Color(o.color) : o.color);
    this.mesh.instanceColor!.needsUpdate = true;
  }
  private m = new Matrix4(); private q = new Quaternion(); private e = new Euler(); private v = new Vector3(); private s = new Vector3();
  update(dt: number) {
    let dirty = false;
    this.ps.forEach((p, i) => {
      if (!p.alive) return;
      dirty = true;
      p.life += dt;
      if (p.life >= p.max) { p.alive = false; this.mesh.setMatrixAt(i, this.m.makeScale(0, 0, 0)); return; }
      p.vy -= p.g * dt;
      const k = Math.exp(-p.drag * dt); p.vx *= k; p.vy *= k; p.vz *= k;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      if (p.y < p.floor) { p.y = p.floor; p.vy = 0; p.vx *= .5; p.vz *= .5; }
      p.rx += p.spin * dt; p.rz += p.spin * .7 * dt;
      const t = p.life / p.max;
      const sc = (p.size + p.grow * t) * (t < .12 ? t / .12 : t > .7 ? (1 - t) / .3 : 1);
      this.m.compose(this.v.set(p.x, p.y, p.z), this.q.setFromEuler(this.e.set(p.rx, p.ry, p.rz)), this.s.setScalar(Math.max(sc, 0.0001)));
      this.mesh.setMatrixAt(i, this.m);
    });
    if (dirty) this.mesh.instanceMatrix.needsUpdate = true;
  }
}

const CONFETTI = ['#ffd23f', '#ff6b6b', '#6be3a0', '#6bb8ff', '#d48bff', '#ff9f43', '#fff'];

export class Particles {
  puffs: Pool; bits: Pool; drops: Pool;
  reduced = false;
  constructor(scene: Scene) {
    this.puffs = new Pool(scene, new IcosahedronGeometry(1, 1), new MeshLambertMaterial({ color: 0xffffff, flatShading: true }), 220);
    this.bits = new Pool(scene, new PlaneGeometry(1, 0.6), new MeshBasicMaterial({ side: DoubleSide }), 260);
    this.drops = new Pool(scene, new IcosahedronGeometry(1, 0), new MeshBasicMaterial({}), 240);
  }
  update(dt: number) { this.puffs.update(dt); this.bits.update(dt); this.drops.update(dt); }

  dust(x: number, y: number, z: number, n = 8, col = '#e9ddc6') {
    for (let i = 0; i < (this.reduced ? n / 3 : n); i++) {
      const a = Math.random() * 6.28, r = .35 + Math.random() * .9;
      this.puffs.add({ color: col, x: x + Math.cos(a) * .3, y: y + .03, z: z + Math.sin(a) * .3, vx: Math.cos(a) * r, vy: .4 + Math.random() * .8, vz: Math.sin(a) * r, g: .9, drag: 2.6, size: .07 + Math.random() * .08, grow: .12, max: .55 + Math.random() * .4 });
    }
  }
  rubble(x: number, y: number, z: number, n = 5, col = '#a98d6d') {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * 6.28, r = .6 + Math.random();
      this.drops.add({ color: col, x, y, z, vx: Math.cos(a) * r, vy: 1.4 + Math.random() * 1.2, vz: Math.sin(a) * r, g: 7, size: .025 + Math.random() * .025, max: .7, spin: 8, floor: 0 });
    }
  }
  splash(x: number, z: number, n = 8, y = .02) {
    for (let i = 0; i < (this.reduced ? n / 3 : n); i++) {
      const a = Math.random() * 6.28, r = .3 + Math.random() * .9;
      this.drops.add({ color: i % 3 ? '#e4fbff' : '#8feaf3', x: x + Math.cos(a) * .25, y, z: z + Math.sin(a) * .25, vx: Math.cos(a) * r, vy: 1 + Math.random() * 1.5, vz: Math.sin(a) * r, g: 6.5, size: .02 + Math.random() * .03, max: .65 });
    }
  }
  smoke(x: number, y: number, z: number) {
    this.puffs.add({ color: '#f4f4f4', x, y, z, vx: .05 + Math.random() * .06, vy: .32, vz: -.04, g: 0, drag: .15, size: .018, grow: .06, max: 1.5 + Math.random() * .4 });
  }
  sigh(x: number, y: number, z: number) {
    for (let i = 0; i < 2; i++) this.puffs.add({ color: '#ffffff', x: x + i * .03, y, z: z + .08, vx: i ? .1 : -.06, vy: .1, vz: .22, drag: 2, size: .02, grow: .03, max: .6 });
  }
  sparkle(x: number, y: number, z: number, n = 8, col = '#ffe680') {
    for (let i = 0; i < (this.reduced ? n / 2 : n); i++) {
      const a = Math.random() * 6.28, b = Math.random() * 1.5, r = .7 + Math.random() * .9;
      this.drops.add({ color: col, x, y, z, vx: Math.cos(a) * Math.cos(b) * r, vy: Math.sin(b) * r + .4, vz: Math.sin(a) * Math.cos(b) * r, g: 1.6, drag: 2.2, size: .018 + Math.random() * .02, max: .6 + Math.random() * .4 });
    }
  }
  confetti(x: number, y: number, z: number, n = 90, spread = 3.4) {
    for (let i = 0; i < (this.reduced ? n / 4 : n); i++) {
      const a = Math.random() * 6.28, r = Math.random() * spread;
      this.bits.add({ color: CONFETTI[i % CONFETTI.length], x: x + Math.cos(a) * r, y: y + 2.2 + Math.random() * 1.8, z: z + Math.sin(a) * r, vx: (Math.random() - .5) * .6, vy: .3 + Math.random() * 1.2, vz: (Math.random() - .5) * .6, g: .9, drag: 1.35, size: .07 + Math.random() * .04, max: 2.1 + Math.random() * 1.1, spin: 4 + Math.random() * 7, floor: .01 });
    }
  }
  firework(x: number, y: number, z: number, col: string, n = 34) {
    for (let i = 0; i < (this.reduced ? n / 3 : n); i++) {
      const u = Math.random() * 2 - 1, a = Math.random() * 6.28, s = Math.sqrt(1 - u * u), r = 2.8 + Math.random() * 2;
      this.drops.add({ color: i % 4 ? col : '#fff', x, y, z, vx: Math.cos(a) * s * r, vy: u * r, vz: Math.sin(a) * s * r, g: 1.7, drag: 1.5, size: .05 + Math.random() * .05, max: 1 + Math.random() * .6 });
    }
  }
}
