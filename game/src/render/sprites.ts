// Canvas-drawn sprite textures: status badges, thought bubbles, preview marks. All code, no image files.
import { CanvasTexture, SRGBColorSpace, Sprite, SpriteMaterial, type Texture } from 'three';

function canvas(w: number, h: number, draw: (c: CanvasRenderingContext2D) => void): HTMLCanvasElement {
  const el = document.createElement('canvas'); el.width = w; el.height = h;
  draw(el.getContext('2d')!);
  return el;
}
const tex = (el: HTMLCanvasElement) => { const t = new CanvasTexture(el); t.colorSpace = SRGBColorSpace; t.anisotropy = 4; return t; };

function roundBadge(c: CanvasRenderingContext2D, fill: string) {
  c.fillStyle = '#fff'; c.beginPath(); c.arc(64, 64, 58, 0, 7); c.fill();
  c.fillStyle = fill; c.beginPath(); c.arc(64, 64, 49, 0, 7); c.fill();
}
const drawCheck = (c: CanvasRenderingContext2D) => { roundBadge(c, '#39b54a'); c.strokeStyle = '#fff'; c.lineWidth = 16; c.lineCap = 'round'; c.lineJoin = 'round'; c.beginPath(); c.moveTo(38, 66); c.lineTo(56, 84); c.lineTo(90, 46); c.stroke(); };
const drawCross = (c: CanvasRenderingContext2D) => { roundBadge(c, '#e8483e'); c.strokeStyle = '#fff'; c.lineWidth = 16; c.lineCap = 'round'; c.beginPath(); c.moveTo(44, 44); c.lineTo(84, 84); c.moveTo(84, 44); c.lineTo(44, 84); c.stroke(); };
const drawPlus = (c: CanvasRenderingContext2D) => { roundBadge(c, '#39b54a'); c.strokeStyle = '#fff'; c.lineWidth = 16; c.lineCap = 'round'; c.beginPath(); c.moveTo(64, 38); c.lineTo(64, 90); c.moveTo(38, 64); c.lineTo(90, 64); c.stroke(); };
const drawMinus = (c: CanvasRenderingContext2D) => { roundBadge(c, '#e8483e'); c.strokeStyle = '#fff'; c.lineWidth = 16; c.lineCap = 'round'; c.beginPath(); c.moveTo(38, 64); c.lineTo(90, 64); c.stroke(); };

export type WishIcon = 'peak' | 'sea' | 'lake' | 'ice';
function bubble(draw: (c: CanvasRenderingContext2D) => void) {
  return canvas(192, 192, c => {
    c.fillStyle = '#fffdf7'; c.strokeStyle = 'rgba(70,50,30,.18)'; c.lineWidth = 3;
    const blob = (x: number, y: number, r: number) => { c.beginPath(); c.arc(x, y, r, 0, 7); c.fill(); };
    c.shadowColor = 'rgba(30,40,60,.3)'; c.shadowBlur = 8; c.shadowOffsetY = 3;
    blob(96, 78, 58); blob(52, 86, 36); blob(140, 86, 36); blob(70, 48, 34); blob(122, 48, 34);
    blob(62, 142, 12); blob(44, 166, 8);
    c.shadowColor = 'transparent';
    draw(c);
  });
}
const wishDraw: Record<WishIcon, (c: CanvasRenderingContext2D) => void> = {
  peak: c => {
    c.fillStyle = '#6f6a78'; c.beginPath(); c.moveTo(46, 112); c.lineTo(96, 34); c.lineTo(146, 112); c.closePath(); c.fill();
    c.fillStyle = '#fff'; c.beginPath(); c.moveTo(80, 59); c.lineTo(96, 34); c.lineTo(112, 59); c.lineTo(103, 53); c.lineTo(96, 62); c.lineTo(88, 53); c.closePath(); c.fill();
  },
  sea: c => { c.strokeStyle = '#1aa7e0'; c.lineWidth = 9; c.lineCap = 'round'; for (const y of [58, 80, 102]) { c.beginPath(); c.moveTo(52, y); c.bezierCurveTo(70, y - 16, 78, y + 14, 96, y); c.bezierCurveTo(112, y - 14, 124, y + 14, 140, y); c.stroke(); } },
  lake: c => { c.fillStyle = '#c99a52'; c.beginPath(); c.ellipse(96, 84, 56, 38, 0, 0, 7); c.fill(); c.fillStyle = '#3fd6a8'; c.beginPath(); c.ellipse(96, 84, 38, 23, 0, 0, 7); c.fill(); c.strokeStyle = '#fff'; c.lineWidth = 4; c.lineCap = 'round'; c.beginPath(); c.moveTo(80, 80); c.quadraticCurveTo(92, 72, 104, 80); c.stroke(); },
  ice: c => { c.fillStyle = '#bde9fb'; c.beginPath(); c.moveTo(54, 106); c.lineTo(74, 56); c.lineTo(122, 50); c.lineTo(142, 106); c.closePath(); c.fill(); c.strokeStyle = '#fff'; c.lineWidth = 4; c.beginPath(); c.moveTo(76, 96); c.lineTo(92, 72); c.lineTo(112, 90); c.stroke(); c.strokeStyle = '#1aa7e0'; c.lineWidth = 7; c.lineCap = 'round'; c.beginPath(); c.moveTo(42, 122); c.quadraticCurveTo(70, 108, 96, 122); c.quadraticCurveTo(122, 134, 150, 120); c.stroke(); },
};
const chevrons = canvas(128, 128, c => {
  c.shadowColor = 'rgba(100,30,0,.45)'; c.shadowBlur = 6;
  c.strokeStyle = '#fff'; c.lineWidth = 26; c.lineJoin = 'round'; c.lineCap = 'round';
  const ch = (y: number, s: string) => { c.strokeStyle = s; c.beginPath(); c.moveTo(26, y + 26); c.lineTo(64, y); c.lineTo(102, y + 26); c.stroke(); };
  ch(26, '#fff'); ch(62, '#fff');
  c.lineWidth = 13; ch(26, '#ff7a2f'); ch(62, '#ff9b3d');
});
const hatch = canvas(128, 128, c => {
  c.fillStyle = 'rgba(30,190,240,.55)'; c.fillRect(0, 0, 128, 128);
  c.strokeStyle = 'rgba(255,255,255,.9)'; c.lineWidth = 9;
  for (let i = -128; i < 256; i += 36) { c.beginPath(); c.moveTo(i, 128); c.lineTo(i + 128, 0); c.stroke(); }
  c.lineWidth = 8; c.strokeStyle = 'rgba(255,255,255,.95)'; c.strokeRect(4, 4, 120, 120);
});
// land that would become a lake, not sea: the same hatch in the lake's green, since the two water kinds please different creatures
const hatchLake = canvas(128, 128, c => {
  c.fillStyle = 'rgba(40,190,120,.62)'; c.fillRect(0, 0, 128, 128);
  c.strokeStyle = 'rgba(255,255,255,.9)'; c.lineWidth = 9;
  for (let i = -128; i < 256; i += 36) { c.beginPath(); c.moveTo(i, 0); c.lineTo(i + 128, 128); c.stroke(); }
  c.lineWidth = 8; c.strokeStyle = 'rgba(255,255,255,.95)'; c.strokeRect(4, 4, 120, 120);
});

let cache: ReturnType<typeof build> | undefined;
function build() {
  const bubbles = {} as Record<WishIcon, Texture>;
  (Object.keys(wishDraw) as WishIcon[]).forEach(k => { bubbles[k] = tex(bubble(wishDraw[k])); });
  return {
    check: tex(canvas(128, 128, drawCheck)), cross: tex(canvas(128, 128, drawCross)),
    plus: tex(canvas(128, 128, drawPlus)), minus: tex(canvas(128, 128, drawMinus)),
    chevrons: tex(chevrons), hatch: tex(hatch), hatchLake: tex(hatchLake), bubbles,
  };
}
export const sprites = () => (cache ??= build());

export function makeSprite(t: Texture, size: number, renderOrder = 20): Sprite {
  const s = new Sprite(new SpriteMaterial({ map: t, transparent: true, depthTest: false, depthWrite: false }));
  s.scale.setScalar(size); s.renderOrder = renderOrder;
  return s;
}
