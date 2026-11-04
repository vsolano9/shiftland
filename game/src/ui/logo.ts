// The SHIFTLAND wordmark, drawn in code: heavy letters on layered strata, split by fault lines whose sides have slid past
// each other. `slip` animates the shift (0 = whole, 1 = settled).
export function drawLogo(cv: HTMLCanvasElement, slip: number) {
  const W = cv.width, H = cv.height, c = cv.getContext('2d')!;
  c.clearRect(0, 0, W, H);
  const fs = W * .172, text = 'SHIFTLAND', baseY = H * .62;
  c.font = `700 ${fs}px Fredoka, system-ui, sans-serif`;
  c.textAlign = 'center'; c.textBaseline = 'alphabetic'; c.lineJoin = 'round';
  // fault x at the top and bottom of the canvas, as a fraction of the width; they run through H, T and N, never the I
  const faults: [number, number][] = [[.15, .19], [.47, .435], [.76, .8]];
  const zigAt = (f: [number, number], k: number, n: number) => {
    const y = (k / n) * H;
    return [W * (f[0] + (f[1] - f[0]) * (k / n)) + (k % 2 ? W * .006 : -W * .006), y] as const;
  };
  const drawAll = (ox: number, oy: number) => {
    const layers: [number, string][] = [[.2, '#6d6660'], [.155, '#a65f2a'], [.11, '#e27a1d'], [.06, '#f6a527']];
    for (const [d, col] of layers) { c.fillStyle = col; c.strokeStyle = col; c.lineWidth = fs * .05; const y = baseY + oy + fs * d; c.strokeText(text, W / 2 + ox, y); c.fillText(text, W / 2 + ox, y); }
    c.lineWidth = fs * .05; c.strokeStyle = '#fff6e4'; c.fillStyle = '#fff6e4';
    c.strokeText(text, W / 2 + ox, baseY + oy); c.fillText(text, W / 2 + ox, baseY + oy);
    const g = c.createLinearGradient(0, baseY + oy - fs * .75, 0, baseY + oy); g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#ffe9c4');
    c.fillStyle = g; c.fillText(text, W / 2 + ox, baseY + oy);
  };
  const N = 8;
  for (let i = 0; i <= faults.length; i++) {
    c.save(); c.beginPath();
    if (i === 0) { c.moveTo(0, 0); c.lineTo(0, H); } else for (let k = 0; k <= N; k++) { const [x, y] = zigAt(faults[i - 1], k, N); if (k === 0) c.moveTo(x, y); else c.lineTo(x, y); }
    if (i === faults.length) { c.lineTo(W, H); c.lineTo(W, 0); } else for (let k = N; k >= 0; k--) { const [x, y] = zigAt(faults[i], k, N); c.lineTo(x, y); }
    c.closePath(); c.clip();
    const sl = slip * fs * .06;
    drawAll((i % 2 ? 1 : -1) * sl * .22, (i % 2 ? -1 : 1) * sl);
    c.restore();
  }
  // the cracks exist only on the letters
  if (slip > .02) {
    c.save(); c.globalCompositeOperation = 'source-atop'; c.globalAlpha = Math.min(1, slip * 1.5);
    c.strokeStyle = 'rgba(112, 56, 18, .95)'; c.lineWidth = W * .0042; c.lineCap = 'round'; c.lineJoin = 'round';
    for (const f of faults) { c.beginPath(); for (let k = 0; k <= N; k++) { const [x, y] = zigAt(f, k, N); if (k === 0) c.moveTo(x, y); else c.lineTo(x, y); } c.stroke(); }
    c.restore();
  }
}
