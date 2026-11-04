// Finding a way over open water, for the boats and the whale (sealife.ts). No rendering here, so it can be tested.
export interface Reef { x: number; z: number; r: number }
/** The sea in view: a box in screen-aligned coordinates (the map's camera looks along a fixed azimuth). */
export interface Bounds { u0: number; u1: number; v0: number; v1: number; az: number }

export const toUV = (x: number, z: number, az: number): [number, number] => [x * Math.cos(az) - z * Math.sin(az), x * Math.sin(az) + z * Math.cos(az)];
const toXZ = (u: number, v: number, az: number): [number, number] => [u * Math.cos(az) + v * Math.sin(az), -u * Math.sin(az) + v * Math.cos(az)];
export const inBounds = (b: Bounds, x: number, z: number) => { const [u, v] = toUV(x, z, b.az); return u >= b.u0 && u <= b.u1 && v >= b.v0 && v <= b.v1; };

/** A heading that keeps clear of every reef and of the edge of the sea: look ahead, and turn while the way is blocked. */
export function steer(x: number, z: number, heading: number, reefs: Reef[], b: Bounds, turn: number, look = 3.2): number {
  const px = x + Math.sin(heading) * look, pz = z + Math.cos(heading) * look;
  const blocked = !inBounds(b, px, pz) || reefs.some(r => Math.hypot(px - r.x, pz - r.z) < r.r);
  return blocked ? heading + turn : heading;
}

/** A point of open water, or null when the sea is too crowded to find one. */
export function openWater(reefs: Reef[], b: Bounds, rnd: () => number, clearance = 1.5): [number, number] | null {
  for (let i = 0; i < 40; i++) {
    const [x, z] = toXZ(b.u0 + rnd() * (b.u1 - b.u0), b.v0 + rnd() * (b.v1 - b.v0), b.az);
    if (reefs.every(r => Math.hypot(x - r.x, z - r.z) > r.r + clearance)) return [x, z];
  }
  return null;
}
