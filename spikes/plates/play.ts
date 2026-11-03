// Plates grey-box: a top-down, throwaway playable test of the rules (not the game's look).
// Build: npx -y esbuild@0.25.0 spikes/plates/play.ts --bundle --format=iife --outfile=spikes/plates/play.js
// (iife so play.html opens straight from disk; module scripts are blocked on file://)
import { shift, goalsMet, solved, solve, type Level, type State, type Dir } from './plates.ts';
import raw from './levels.json';

type Raw = { name: string; w: number; h: number; plates: number; axis: number[]; maxTravel: number;
  plate: number[]; elev: number[]; objs: { kind: 'goat' | 'village' | 'light'; cell: number }[]; buoys: number[]; par: number };
const LEVELS = (raw as Raw[]).map(r => ({
  name: r.name, par: r.par,
  lv: { w: r.w, h: r.h, plates: r.plates, axis: r.axis, maxTravel: r.maxTravel, buoys: r.buoys,
    start: { plate: Int8Array.from(r.plate), elev: Int8Array.from(r.elev), objs: r.objs } } as Level,
}));

const PLATE_COL = ['#d9a441', '#86a96a', '#a58ad1', '#d1708a'];
const ICON: Record<string, string> = { goat: '🐐', village: '🏘️', light: '🗼' };
const GOAL_TEXT: Record<string, string> = { goat: 'Goat on a mountain (height 2+)', village: 'Village dry and not crushed', light: 'Lighthouse on the coast' };
const CELL = 64;

const cv = document.getElementById('board') as HTMLCanvasElement;
const ctx = cv.getContext('2d')!;
const ui = {
  title: document.getElementById('title')!, moves: document.getElementById('moves')!, goals: document.getElementById('goals')!,
  msg: document.getElementById('msg')!, select: document.getElementById('levels') as HTMLSelectElement,
};

let li = 0;
let history: State[] = [];
let sel = 0;
let preview: State | null = null;

const cur = () => history[history.length - 1];
const L = () => LEVELS[li].lv;

function load(i: number) {
  li = i; history = [L().start]; sel = 0; preview = null;
  ui.select.value = String(i);
  draw();
}

function tryMove(d: Dir, commit: boolean): State | null {
  const t = shift(L(), cur(), sel, d);
  if (commit && t) { history.push(t); preview = null; }
  return t;
}

function seaMask(lv: Level, s: State) {
  const sea = new Set<number>();
  const q: number[] = [];
  for (let i = 0; i < lv.w * lv.h; i++) {
    const x = i % lv.w, y = (i / lv.w) | 0;
    if (s.plate[i] < 0 && (x === 0 || y === 0 || x === lv.w - 1 || y === lv.h - 1)) { sea.add(i); q.push(i); }
  }
  while (q.length) {
    const i = q.pop()!; const x = i % lv.w, y = (i / lv.w) | 0;
    for (const [dx, dy] of [[0, 1], [1, 0], [0, -1], [-1, 0]]) {
      const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= lv.w || ny >= lv.h) continue;
      const j = nx + ny * lv.w; if (!sea.has(j) && s.plate[j] < 0) { sea.add(j); q.push(j); }
    }
  }
  return sea;
}

function drawState(s: State, ghost: boolean) {
  const lv = L();
  const sea = seaMask(lv, s);
  for (let i = 0; i < lv.w * lv.h; i++) {
    const x = (i % lv.w) * CELL, y = ((i / lv.w) | 0) * CELL;
    ctx.globalAlpha = ghost ? 0.55 : 1;
    if (s.plate[i] < 0) {
      ctx.fillStyle = sea.has(i) ? '#2bb3c0' : '#2f7d6a';
      ctx.fillRect(x, y, CELL, CELL);
    } else {
      ctx.fillStyle = PLATE_COL[s.plate[i]];
      ctx.fillRect(x, y, CELL, CELL);
      // height: darker stacked bars + number
      for (let h = 0; h < s.elev[i]; h++) { ctx.fillStyle = 'rgba(60,40,20,0.28)'; ctx.fillRect(x + 6 + h * 6, y + 6 + h * 6, CELL - 12 - h * 12, CELL - 12 - h * 12); }
      if (s.elev[i] >= 3) { ctx.fillStyle = '#fff'; ctx.fillRect(x + 24, y + 24, 16, 16); }
    }
    ctx.globalAlpha = 1;
  }
  // plate outlines (edges between different plate ids)
  ctx.lineWidth = 3;
  for (let i = 0; i < lv.w * lv.h; i++) {
    if (s.plate[i] < 0) continue;
    const cx = i % lv.w, cy = (i / lv.w) | 0;
    const edges: [number, number, number, number, number][] = [[0, -1, 0, 0, 1], [1, 0, 1, 0, 0], [0, 1, 0, 1, 1], [-1, 0, 0, 0, 0]];
    for (const [dx, dy, ox, oy, horiz] of edges) {
      const nx = cx + dx, ny = cy + dy;
      const other = nx < 0 || ny < 0 || nx >= lv.w || ny >= lv.h ? -2 : s.plate[nx + ny * lv.w];
      if (other === s.plate[i]) continue;
      ctx.strokeStyle = s.plate[i] === sel ? '#ffffff' : 'rgba(30,20,10,0.8)';
      ctx.beginPath();
      const x0 = (cx + ox) * CELL, y0 = (cy + oy) * CELL;
      ctx.moveTo(x0, y0); ctx.lineTo(horiz ? x0 + CELL : x0, horiz ? y0 : y0 + CELL); ctx.stroke();
    }
  }
  // objects and buoys
  ctx.font = '30px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const met = goalsMet(lv, s);
  s.objs.forEach((o, k) => {
    const x = (o.cell % lv.w) * CELL + CELL / 2, y = ((o.cell / lv.w) | 0) * CELL + CELL / 2;
    ctx.fillText(ICON[o.kind], x, y);
    ctx.fillStyle = met[k] ? '#2ecc40' : '#e74c3c'; ctx.beginPath(); ctx.arc(x + 22, y - 22, 6, 0, 7); ctx.fill();
  });
  lv.buoys.forEach((b, k) => {
    const x = (b % lv.w) * CELL + CELL / 2, y = ((b / lv.w) | 0) * CELL + CELL / 2;
    ctx.fillText('🛟', x, y);
    ctx.fillStyle = met[s.objs.length + k] ? '#2ecc40' : '#e74c3c'; ctx.beginPath(); ctx.arc(x + 22, y - 22, 6, 0, 7); ctx.fill();
  });
}

function drawRail() {
  const lv = L(); const s = cur();
  const cells: number[] = []; for (let i = 0; i < lv.w * lv.h; i++) if (s.plate[i] === sel) cells.push(i);
  if (!cells.length) return;
  const cx = cells.reduce((a, i) => a + (i % lv.w), 0) / cells.length, cy = cells.reduce((a, i) => a + ((i / lv.w) | 0), 0) / cells.length;
  const horiz = lv.axis![sel] === 1; const off = s.off ? s.off[sel] : 0; const mt = lv.maxTravel ?? 2;
  ctx.strokeStyle = '#fff'; ctx.fillStyle = '#fff'; ctx.lineWidth = 4;
  const px = (cx + 0.5) * CELL, py = (cy + 0.5) * CELL;
  const a = (k: number) => horiz ? [px + (k - off) * CELL, py] : [px, py + (k - off) * CELL];
  ctx.beginPath(); const [x0, y0] = a(-mt), [x1, y1] = a(mt); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
  for (let k = -mt; k <= mt; k++) { const [x, y] = a(k); ctx.beginPath(); ctx.arc(x, y, k === off ? 9 : 5, 0, 7); ctx.fill(); }
}

function draw() {
  const lv = L();
  cv.width = lv.w * CELL; cv.height = lv.h * CELL;
  drawState(cur(), false);
  if (preview) drawState(preview, true);
  drawRail();
  const moves = history.length - 1;
  ui.title.textContent = LEVELS[li].name;
  ui.moves.textContent = `Moves ${moves} · Par ${LEVELS[li].par}`;
  const met = goalsMet(lv, cur());
  const labels = [...cur().objs.map(o => `${ICON[o.kind]} ${GOAL_TEXT[o.kind]}`), ...lv.buoys.map(() => '🛟 Buoy in the open sea')];
  ui.goals.innerHTML = labels.map((t, k) => `<li class="${met[k] ? 'ok' : ''}">${met[k] ? '✔' : '○'} ${t}</li>`).join('');
  if (solved(lv, cur())) ui.msg.textContent = moves <= LEVELS[li].par ? `Solved at par! ★  (Enter: next level)` : `Solved in ${moves} (par ${LEVELS[li].par}). Enter: next, R: retry for par`;
  else ui.msg.textContent = 'Click a plate (or Tab), arrow keys slide it along its rail. Hold Shift + arrow to preview. Z undo, R restart.';
  (window as unknown as { __plates: unknown }).__plates = { level: li, moves, solved: solved(lv, cur()), sel, preview: preview !== null };
}

const KEY_DIR: Record<string, Dir> = { ArrowUp: 0, ArrowRight: 1, ArrowDown: 2, ArrowLeft: 3 };
addEventListener('keydown', e => {
  if (e.key in KEY_DIR) {
    e.preventDefault();
    if (e.shiftKey) { preview = tryMove(KEY_DIR[e.key], false); draw(); return; }
    if (!tryMove(KEY_DIR[e.key], true)) { ui.msg.textContent = 'That plate cannot move that way (rail end or map edge).'; return; }
    draw();
  } else if (e.key === 'Tab') { e.preventDefault(); sel = (sel + 1) % L().plates; preview = null; draw(); }
  else if (e.key === 'z' || e.key === 'Z') { if (history.length > 1) history.pop(); preview = null; draw(); }
  else if (e.key === 'r' || e.key === 'R') { load(li); }
  else if (e.key === 'Enter' && solved(L(), cur()) && li + 1 < LEVELS.length) load(li + 1);
  else if (e.key === 'h' || e.key === 'H') { const r = solve({ ...L(), start: cur() }, 6); ui.msg.textContent = r ? `Hint: ${r.firstSolution[0]} (P = plate number by colour order)` : 'No solution from here within 6 moves: undo.'; }
});
addEventListener('keyup', e => { if (e.key === 'Shift') { preview = null; draw(); } });
cv.addEventListener('click', e => {
  const r = cv.getBoundingClientRect();
  const x = Math.floor((e.clientX - r.left) / (r.width / L().w)), y = Math.floor((e.clientY - r.top) / (r.height / L().h));
  const p = cur().plate[x + y * L().w]; if (p >= 0) { sel = p; preview = null; draw(); }
});
LEVELS.forEach((l, i) => { const o = document.createElement('option'); o.value = String(i); o.textContent = `${i + 1}. ${l.name} (par ${l.par})`; ui.select.appendChild(o); });
ui.select.addEventListener('change', () => load(Number(ui.select.value)));
load(0);
