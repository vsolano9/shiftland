// Life on the open sea between the islands: boats that steer round the land, and now and then a whale.
// None of it touches a puzzle: it stays on open water and shows from a distance, on the map and on flights.
import { Group, Mesh, type Scene } from 'three';
import { MAT } from './creatures.ts';
import * as M from './models.ts';
import type { Particles } from './particles.ts';
import { openWater, steer, type Bounds, type Reef } from './seaway.ts';

const WHALE_TIME = 7;

export class SeaLife {
  private boats: { g: Group; a: number; v: number; bob: number }[] = [];
  private whale = new Group();
  private back = new Mesh(M.whaleBack, MAT);
  private tail = new Mesh(M.whaleTail, MAT);
  private whaleT = -1;
  private nextWhale = 4;
  private splashed = 0;

  /** The islands have moved: boats go back to open water. */
  relayout(reefs: Reef[], bounds: Bounds) {
    this.reefs = reefs; this.bounds = bounds; this.whale.visible = false; this.whaleT = -1;
    for (const b of this.boats) { const at = openWater(reefs, bounds, this.rnd); if (at) b.g.position.set(at[0], 0, at[1]); else b.g.visible = false; }
  }

  constructor(scene: Scene, private reefs: Reef[], private bounds: Bounds, private fx: Particles, private spout: (x: number, y: number, z: number) => void, private rnd: () => number = Math.random) {
    for (let i = 0; i < 4; i++) {
      const at = openWater(reefs, bounds, rnd); if (!at) break;
      const g = new Group(); const hull = new Mesh(M.boat, MAT); hull.castShadow = true; g.add(hull);
      g.scale.setScalar(1.5); g.position.set(at[0], 0, at[1]);
      scene.add(g); this.boats.push({ g, a: rnd() * 6.28, v: .45 + rnd() * .25, bob: rnd() * 6 });
    }
    this.whale.add(this.back, this.tail); this.whale.visible = false; this.whale.scale.setScalar(1.6);
    this.back.castShadow = this.tail.castShadow = true;
    scene.add(this.whale);
  }

  /** `calm` is 1 where the sea is in view (the map, a flight), 0 on a board: no whale surfaces behind a puzzle. */
  update(dt: number, t: number, calm: boolean) {
    for (const b of this.boats) {
      b.g.visible = calm; // a toy from afar, but as big as a lighthouse beside a board
      b.a = steer(b.g.position.x, b.g.position.z, b.a, this.reefs, this.bounds, dt * 1.3);
      b.g.position.x += Math.sin(b.a) * b.v * dt; b.g.position.z += Math.cos(b.a) * b.v * dt;
      b.g.rotation.set(Math.sin(t * .9 + b.bob) * .05, b.a, Math.sin(t * 1.3 + b.bob) * .07);
      b.g.position.y = Math.sin(t * 1.1 + b.bob) * .03;
    }
    if (this.whaleT < 0) {
      this.nextWhale -= dt;
      if (this.nextWhale > 0 || !calm) return;
      const at = openWater(this.reefs, this.bounds, this.rnd, 2.5); this.nextWhale = 9 + this.rnd() * 9;
      if (!at) return;
      this.whale.position.set(at[0], 0, at[1]); this.whale.rotation.y = this.rnd() * 6.28;
      this.whaleT = 0; this.whale.visible = true; this.splashed = 0;
    }
    this.whaleT += dt;
    const u = this.whaleT / WHALE_TIME, w = this.whale.position;
    // back rolls up and forward, blows, sinks; then the tail lifts, waves and slides under
    const up = Math.sin(Math.PI * Math.min(1, u / .6));
    this.back.position.set(0, -.45 + up * .68, u * 1.5);
    this.back.rotation.x = .28 - u * .75; this.back.visible = u < .62;
    const tu = (u - .55) / .45, tailUp = tu > 0 ? Math.sin(Math.PI * Math.min(1, tu)) : 0;
    this.tail.visible = tu > 0; this.tail.position.set(0, -.75 + tailUp * .8, 1.1); this.tail.rotation.x = -.5 + tu * .5;
    const c = Math.cos(this.whale.rotation.y), s = Math.sin(this.whale.rotation.y);
    if (this.splashed === 0 && u > .08) { this.splashed = 1; this.fx.splash(w.x, w.z, 10); }
    if (this.splashed === 1 && u > .24) { this.splashed = 2; this.spout(w.x + s * u * 2.4 + s * .9, .8, w.z + c * u * 2.4 + c * .9); }
    if (this.splashed === 2 && tu > .82) { this.splashed = 3; this.fx.splash(w.x + s * 1.76, w.z + c * 1.76, 12); }
    if (u >= 1) { this.whaleT = -1; this.whale.visible = false; }
  }
}
