import { describe, expect, it } from 'vitest';
import { fillGaps, packContinent, type PackIsland } from './continent';

const square = (x: number, z: number, n: number, half = 0): PackIsland => {
  const cells: [number, number][] = [];
  for (let a = 0; a < n; a++) for (let b = 0; b < n; b++) cells.push([a + half, b + half]);
  return { x, z, cells };
};
const world = (isls: PackIsland[], to: [number, number][]) => isls.flatMap((isl, i) => isl.cells.map(([x, z]) => [to[i][0] + x, to[i][1] + z] as const));

describe('fillGaps', () => {
  const ring: [number, number][] = [];
  for (let x = 0; x < 5; x++) for (let z = 0; z < 5; z++) if (x === 0 || z === 0 || x === 4 || z === 4) ring.push([x, z]);
  it('fills enclosed water, and never a cell that must stay clear', () => {
    const f = fillGaps(ring, [[2, 2]]).map(c => c.join());
    expect(f).toContain('1,1');
    expect(f).not.toContain('2,2');
    expect(f.every(c => !ring.map(r => r.join()).includes(c))).toBe(true);
  });
  it('leaves open sea alone', () => {
    expect(fillGaps([[0, 0], [9, 9]], [])).toEqual([]);
  });
});

describe('packContinent', () => {
  const isls = [square(-40, -30, 4), square(40, -30, 5, .5), square(-40, 30, 3), square(40, 30, 4, .5), square(0, 0, 6), square(0, 50, 3)];
  const to = packContinent(isls);
  it('no two islands share a cell', () => {
    const cells = world(isls, to).map(([x, z]) => `${Math.round(x)},${Math.round(z)}`);
    expect(new Set(cells).size).toBe(cells.length);
  });
  it('keeps cells on the integer lattice, half-cell boards included', () => {
    for (const [x, z] of world(isls, to)) { expect(Math.abs(x - Math.round(x))).toBeLessThan(1e-9); expect(Math.abs(z - Math.round(z))).toBeLessThan(1e-9); }
  });
  it('makes one connected land', () => {
    const cells = new Set(world(isls, to).map(([x, z]) => `${Math.round(x)},${Math.round(z)}`));
    const seen = new Set<string>(), first = [...cells][0], stack = [first];
    while (stack.length) {
      const c = stack.pop()!; if (seen.has(c) || !cells.has(c)) continue; seen.add(c);
      const [x, z] = c.split(',').map(Number);
      stack.push(`${x + 1},${z}`, `${x - 1},${z}`, `${x},${z + 1}`, `${x},${z - 1}`);
    }
    expect(seen.size).toBe(cells.size);
  });
  it('is deterministic and handles nothing', () => {
    expect(packContinent(isls)).toEqual(to);
    expect(packContinent([])).toEqual([]);
  });
});
