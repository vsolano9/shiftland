// The last shift: every island of the map slides in and locks into one continent, like plates that were always one land.
// A jigsaw over the islands' real land cells: nothing overlaps, and each island touches what was placed before it.

export interface PackIsland { x: number; z: number; cells: [number, number][] }

const key = (x: number, z: number) => (x + 4096) * 8192 + z + 4096;

/**
 * The straits to fill so the packed islands read as one land: a cell of water with land close by on at least three of
 * its four sides. `clear` cells stay water, because a buoy still wants its sea and an oasis its lake.
 */
export function fillGaps(land: [number, number][], clear: [number, number][], reach = 4, passes = 3): [number, number][] {
  const solid = new Set(land.map(([x, z]) => key(x, z))), keep = new Set(clear.map(([x, z]) => key(x, z)));
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (const [x, z] of land) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
  const out: [number, number][] = [];
  const near = (x: number, z: number, dx: number, dz: number) => { for (let k = 1; k <= reach; k++) if (solid.has(key(x + dx * k, z + dz * k))) return 1; return 0; };
  for (let p = 0; p < passes; p++) {
    const add: [number, number][] = [];
    for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) {
      const k = key(x, z);
      if (solid.has(k) || keep.has(k)) continue;
      if (near(x, z, 1, 0) + near(x, z, -1, 0) + near(x, z, 0, 1) + near(x, z, 0, -1) >= 3) add.push([x, z]);
    }
    for (const [x, z] of add) solid.add(key(x, z));
    out.push(...add);
  }
  return out;
}

/**
 * Where each island goes. Islands keep their rough direction from the middle of the map, so the player still recognises
 * the archipelago, and the ones nearest the middle settle first. `cells` are land cell centres relative to the island.
 */
export function packContinent(islands: PackIsland[], pull = .3, reach = 24): [number, number][] {
  const n = islands.length;
  if (!n) return [];
  const cx = islands.reduce((s, i) => s + i.x, 0) / n, cz = islands.reduce((s, i) => s + i.z, 0) / n;
  const order = islands.map((_, i) => i).sort((a, b) => Math.hypot(islands[a].x - cx, islands[a].z - cz) - Math.hypot(islands[b].x - cx, islands[b].z - cz));
  const taken = new Set<number>();
  const out: [number, number][] = new Array(n);
  for (const i of order) {
    const isl = islands[i];
    // a board may sit on half cells: its offset keeps its cells on the shared integer lattice
    const c0 = isl.cells[0] ?? [0, 0];
    const fx = c0[0] - Math.round(c0[0]), fz = c0[1] - Math.round(c0[1]);
    const wantX = cx + (isl.x - cx) * pull, wantZ = cz + (isl.z - cz) * pull;
    const ax = Math.round(wantX), az = Math.round(wantZ);
    let best: [number, number] | null = null, bestScore = Infinity;
    for (let dx = -reach; dx <= reach; dx++) for (let dz = -reach; dz <= reach; dz++) {
      const tx = ax + dx - fx, tz = az + dz - fz;
      const dist = Math.hypot(tx - wantX, tz - wantZ);
      if (dist >= bestScore + 6) continue;
      let clash = false, touch = 0;
      for (const [cxl, czl] of isl.cells) {
        const gx = Math.round(tx + cxl), gz = Math.round(tz + czl);
        if (taken.has(key(gx, gz))) { clash = true; break; }
        if (taken.has(key(gx + 1, gz))) touch++;
        if (taken.has(key(gx - 1, gz))) touch++;
        if (taken.has(key(gx, gz + 1))) touch++;
        if (taken.has(key(gx, gz - 1))) touch++;
      }
      if (clash || (taken.size && touch < 3)) continue;
      // a long shared coast beats a close fit: that is what makes it a continent and not a crowd
      const score = dist - Math.min(touch, 12) * .5;
      if (score < bestScore) { bestScore = score; best = [tx, tz]; }
    }
    // nothing fits within reach (only for absurdly spread input): stay put rather than overlap
    const [tx, tz] = best ?? [isl.x, isl.z];
    out[i] = [tx, tz];
    if (best) for (const [cxl, czl] of isl.cells) taken.add(key(Math.round(tx + cxl), Math.round(tz + czl)));
  }
  return out;
}
