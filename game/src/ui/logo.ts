// The SHIFTLAND wordmark, drawn in code as in concepts/shiftland-title-select.png: chunky block letters standing on layered
// strata, and one fault running through the whole word, whose upper side has slid along it. Letters are outlines, not a font,
// so the mark looks the same everywhere. `slip` animates the shift (0 = whole, 1 = settled).
type Pt = [number, number];
interface Glyph { w: number; out: Pt[]; hole?: Pt[]; }

// Outlines on a 100-tall grid, y down.
const GLYPHS: Record<string, Glyph> = {
  S: { w: 76, out: [[12, 0], [72, 0], [72, 25], [31, 25], [31, 36], [60, 36], [76, 52], [76, 86], [62, 100], [3, 100], [3, 75], [45, 75], [45, 63], [16, 63], [0, 47], [0, 12]] },
  H: { w: 74, out: [[0, 0], [28, 0], [28, 36], [46, 36], [46, 0], [74, 0], [74, 100], [46, 100], [46, 62], [28, 62], [28, 100], [0, 100]] },
  I: { w: 28, out: [[0, 0], [28, 0], [28, 100], [0, 100]] },
  F: { w: 62, out: [[0, 0], [62, 0], [62, 25], [28, 25], [28, 38], [55, 38], [55, 63], [28, 63], [28, 100], [0, 100]] },
  T: { w: 68, out: [[0, 0], [68, 0], [68, 25], [48, 25], [48, 100], [20, 100], [20, 25], [0, 25]] },
  L: { w: 58, out: [[0, 0], [28, 0], [28, 75], [58, 75], [58, 100], [0, 100]] },
  A: { w: 88, out: [[29, 0], [59, 0], [88, 100], [59, 100], [55, 84], [33, 84], [29, 100], [0, 100]], hole: [[44, 30], [50, 62], [38, 62]] },
  N: { w: 78, out: [[0, 0], [26, 0], [52, 46], [52, 0], [78, 0], [78, 100], [52, 100], [26, 54], [26, 100], [0, 100]] },
  D: { w: 76, out: [[0, 0], [50, 0], [76, 24], [76, 76], [50, 100], [0, 100]], hole: [[28, 26], [41, 26], [48, 33], [48, 67], [41, 74], [28, 74]] },
};
const WORD = 'SHIFTLAND', GAP = 6;
// A letter sits a touch off the line, so the word looks stacked by hand.
const TILT = [-.012, .008, -.006, .01, -.008, .006, -.01, .008, -.006];
const DROP = [2, -1, 1, -1, 2, 0, -2, 1, -1];

export function drawLogo(cv: HTMLCanvasElement, slip: number) {
  const W = cv.width, H = cv.height, c = cv.getContext('2d')!;
  c.clearRect(0, 0, W, H);
  const span = [...WORD].reduce((a, l) => a + GLYPHS[l].w, 0) + GAP * (WORD.length - 1);
  const u = W * .93 / span, x0 = (W - span * u) / 2, top = H * .19, depth = 22 * u;

  const path = (ox: number, oy: number) => {
    c.beginPath();
    let x = x0 + ox;
    [...WORD].forEach((l, i) => {
      const g = GLYPHS[l], cx = g.w / 2, cy = 50, co = Math.cos(TILT[i]), si = Math.sin(TILT[i]);
      const ring = (pts: Pt[]) => pts.forEach(([a, b], k) => {
        const px = x + (cx + (a - cx) * co - (b - cy) * si) * u, py = top + oy + (cy + (a - cx) * si + (b - cy) * co + DROP[i]) * u;
        if (k) c.lineTo(px, py); else c.moveTo(px, py);
      });
      ring(g.out); c.closePath();
      if (g.hole) { ring(g.hole); c.closePath(); }
      x += (g.w + GAP) * u;
    });
  };
  const soft = 3.2 * u;
  // Strata from the bottom up: rock, clay, two bands of ochre (the land's cross-section in the game).
  const STRATA: [number, string][] = [[1, '#6f6459'], [.8, '#8f5a31'], [.62, '#c9661c'], [.4, '#ea861f'], [.2, '#f7ab2c']];
  const sides = (ox: number, oy: number) => {
    c.lineJoin = 'round'; c.lineWidth = soft;
    for (const [d, col] of STRATA) {
      c.fillStyle = col; c.strokeStyle = col;
      // one solid slab per band, so no letter shows stacked copies at its corners
      for (let k = d; k >= d - .2; k -= .05) { path(ox, oy + depth * k); c.fill('evenodd'); c.stroke(); }
    }
  };
  const face = (ox: number, oy: number) => {
    c.lineJoin = 'round'; c.lineWidth = soft;
    const g = c.createLinearGradient(0, top + oy, 0, top + oy + 100 * u);
    g.addColorStop(0, '#ffffff'); g.addColorStop(.55, '#fff6e2'); g.addColorStop(1, '#ffe2b4');
    path(ox, oy); c.strokeStyle = '#fff3dc'; c.stroke(); c.fillStyle = g; c.fill('evenodd');
  };

  // The fault: one line across the word, climbing to the right, with a jag in each stretch.
  const N = 14, fault: Pt[] = [];
  for (let k = 0; k <= N; k++) {
    const t = k / N, base = top + (84 - 62 * t) * u, jag = (k % 2 ? 1 : -1) * 2.6 * u * (k % 3 === 0 ? .4 : 1);
    fault.push([W * t, base + jag]);
  }
  const clip = (above: boolean, dy: number) => {
    c.beginPath(); c.moveTo(0, above ? 0 : H); c.lineTo(fault[0][0], fault[0][1] + dy);
    for (const [x, y] of fault) c.lineTo(x, y + dy);
    c.lineTo(W, fault[N][1] + dy); c.lineTo(W, above ? 0 : H); c.closePath(); c.clip();
  };
  const s = Math.max(0, Math.min(1, slip)), slideX = 3 * u * s, liftY = -2 * u * s, lip = 5.5 * u * s;

  // Lower side stays put.
  c.save(); clip(false, 0); sides(-slideX * .35, 0); face(-slideX * .35, 0); c.restore();
  // Upper side has slid along the fault and shows its own strata where it overhangs.
  c.save(); clip(true, lip); sides(slideX, liftY); c.restore();
  c.save(); clip(true, 0); face(slideX, liftY); c.restore();
  // A dark seam where the two sides part, on the letters only.
  if (s > .02) {
    c.save(); c.globalCompositeOperation = 'source-atop'; c.globalAlpha = Math.min(1, s * 1.5);
    c.strokeStyle = 'rgba(82, 42, 16, .9)'; c.lineWidth = 1.5 * u; c.lineJoin = 'round'; c.lineCap = 'round';
    c.beginPath(); fault.forEach(([x, y], k) => { if (k) c.lineTo(x, y + lip); else c.moveTo(x, y + lip); }); c.stroke();
    c.restore();
  }
}
