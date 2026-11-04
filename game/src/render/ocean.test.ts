import { describe, expect, it } from 'vitest';
import { MASK_RANGE, Mask } from './ocean';

const at = (m: Mask, x: number, z: number) => {
  const X = Math.floor((x - m.x0) * m.w / m.size[0]), Z = Math.floor((z - m.z0) * m.h / m.size[1]);
  return (m.tex.image.data as Uint8Array)[(X + Z * m.w) * 4] / 255 * MASK_RANGE;
};
const rect = (x0: number, z0: number, x1: number, z1: number) => ({ x0, z0, x1, z1 });

describe('Mask distance', () => {
  it('measures world units even when its pixels are not square', () => {
    const m = new Mask(100, 25, 0, 0, [10, 10]);
    m.write([rect(0, 0, 2, 10)], []);
    expect(at(m, 3, 5)).toBeCloseTo(1, 0);
    const n = new Mask(100, 25, 0, 0, [10, 10]);
    n.write([rect(0, 0, 10, 2)], []);
    expect(at(n, 5, 3)).toBeGreaterThan(.7);
    expect(at(n, 5, 3)).toBeLessThan(1.3);
  });
  it('knows the shore of land just past its edge', () => {
    const m = new Mask(64, 64, 0, 0, [10, 10]);
    m.write([rect(-1, 4, 0 - .1, 6)], []);
    expect(at(m, .5, 5)).toBeCloseTo(.6, 0); // the land stands .6 away, outside the mask
    expect(at(m, 3, 5)).toBeCloseTo(3.1, 0);
  });
  it('without land nearby reads as open sea', () => {
    const m = new Mask(32, 32, 0, 0, [10, 10]);
    m.write([], []);
    expect(at(m, 5, 5)).toBeCloseTo(MASK_RANGE, 3);
  });
});
