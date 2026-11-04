import { describe, expect, it } from 'vitest';
import { inBounds, openWater, steer, toUV, type Reef } from './seaway.ts';

const bounds = { u0: -20, u1: 20, v0: -20, v1: 20, az: .72 };
const reefs: Reef[] = [{ x: 0, z: 0, r: 5 }, { x: 10, z: 10, r: 4 }, { x: -12, z: 6, r: 4 }];

describe('sea life stays on open water', () => {
  it('a sailing boat never touches a reef or leaves the sea in view', () => {
    let x = -8, z = -13, a = .6;
    for (let i = 0; i < 40000; i++) {
      const dt = 1 / 60;
      a = steer(x, z, a, reefs, bounds, dt * 1.3);
      x += Math.sin(a) * .6 * dt; z += Math.cos(a) * .6 * dt;
      for (const r of reefs) expect(Math.hypot(x - r.x, z - r.z)).toBeGreaterThan(r.r - .6);
      const [u, v] = toUV(x, z, bounds.az);
      expect(Math.abs(u)).toBeLessThan(20.6); expect(Math.abs(v)).toBeLessThan(20.6);
    }
  }, 60_000); // deterministic, but 40000 steps of expects outran the default 5 s while a browser suite held the CPU
  it('open water is in view, keeps its clearance, and gives up on a sea with none', () => {
    let s = 7; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 200; i++) {
      const at = openWater(reefs, bounds, rnd, 2)!;
      expect(inBounds(bounds, at[0], at[1])).toBe(true);
      for (const r of reefs) expect(Math.hypot(at[0] - r.x, at[1] - r.z)).toBeGreaterThan(r.r + 2);
    }
    expect(openWater([{ x: 0, z: 0, r: 100 }], bounds, rnd)).toBeNull();
  });
});
