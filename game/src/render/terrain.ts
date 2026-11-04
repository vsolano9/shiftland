// Terrain: one instanced beveled column per land cell. Everything visible on a column (plate band, surface pattern,
// rock and snow by height, strata on the cliffs, contact shadows) is computed in the fragment shader from per-instance
// attributes, so all art here is code and one island is one draw call.
import { BufferGeometry, DoubleSide, Float32BufferAttribute, InstancedBufferAttribute, InstancedMesh, MeshLambertMaterial, Sphere, Vector3 } from 'three';

const BEVEL = 0.035;
export const COLUMN_DEPTH = 4;

function columnGeometry(): BufferGeometry {
  // top face, four bevels, four sides (each its own quad so normals stay crisp)
  const a = 0.5, b = a - BEVEL, pos: number[] = [], nor: number[] = [], idx: number[] = [];
  const quad = (p: number[][], n: number[][]) => {
    const s = pos.length / 3;
    p.forEach(v => pos.push(...v)); n.forEach(v => nor.push(...v));
    idx.push(s, s + 1, s + 2, s, s + 2, s + 3);
  };
  const y = 0, yb = -BEVEL, d = -COLUMN_DEPTH, k = Math.SQRT1_2;
  const up = [0, 1, 0];
  quad([[-b, y, -b], [-b, y, b], [b, y, b], [b, y, -b]], [up, up, up, up]);
  for (const [nx, nz] of [[0, 1], [1, 0], [0, -1], [-1, 0]]) {
    // tangent chosen so winding is counter-clockwise seen from outside
    const tx = nz, tz = -nx;
    const P = (o: number, t: number, yy: number) => [nx * o + tx * t, yy, nz * o + tz * t];
    const nb = [nx * k, k, nz * k], ns = [nx, 0, nz];
    quad([P(b, b, y), P(a, a, yb), P(a, -a, yb), P(b, -b, y)].reverse(), [nb, nb, nb, nb]);
    quad([P(a, a, yb), P(a, a, d), P(a, -a, d), P(a, -a, yb)].reverse(), [ns, ns, ns, ns]);
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new Float32BufferAttribute(nor, 3));
  g.setIndex(idx);
  return g;
}

export const COLUMN_GEOMETRY = columnGeometry();

/** Per-column attribute values, written by the island view. */
export interface ColumnAttrs {
  tint: [number, number, number]; band: [number, number, number];
  edge: [number, number, number, number];   // N E S W: this side is a plate boundary
  corner: [number, number, number, number]; // NE SE SW NW: concave corner of the band
  ao: [number, number, number, number];     // N E S W: taller neighbour, 0..1
  pat: [number, number]; pattern: number; level: number;
  hi: number; dim: number; ice: number; pinned: number;
  cut: [number, number, number, number];    // NE SE SW NW: this corner is on the coast, chamfer it
}

const ATTRS: [string, number][] = [['aTint', 3], ['aBand', 3], ['aEdge', 4], ['aCorner', 4], ['aAO', 4], ['aMisc', 4], ['aFx', 4], ['aCut', 4]];

export function makeColumnMesh(capacity: number, material: MeshLambertMaterial): InstancedMesh {
  const g = COLUMN_GEOMETRY.clone();
  for (const [name, n] of ATTRS) g.setAttribute(name, new InstancedBufferAttribute(new Float32Array(capacity * n), n));
  const m = new InstancedMesh(g, material, capacity);
  m.castShadow = true; m.receiveShadow = true;
  m.boundingSphere = new Sphere(new Vector3(), 14);
  return m;
}

export function writeAttrs(m: InstancedMesh, i: number, a: ColumnAttrs) {
  const g = m.geometry;
  const set = (name: string, ...v: number[]) => { const at = g.getAttribute(name) as InstancedBufferAttribute; for (let k = 0; k < v.length; k++) (at.array as Float32Array)[i * at.itemSize + k] = v[k]; at.needsUpdate = true; };
  set('aTint', ...a.tint); set('aBand', ...a.band); set('aEdge', ...a.edge); set('aCorner', ...a.corner); set('aAO', ...a.ao);
  set('aMisc', a.pat[0], a.pat[1], a.pattern, a.level);
  set('aFx', a.hi, a.dim, a.ice, a.pinned);
  set('aCut', ...a.cut);
}
export function writeHi(m: InstancedMesh, i: number, hi: number) {
  const at = m.geometry.getAttribute('aFx') as InstancedBufferAttribute;
  (at.array as Float32Array)[i * 4] = hi; at.needsUpdate = true;
}

const VERT_HEAD = /* glsl */`
  attribute vec3 aTint; attribute vec3 aBand; attribute vec4 aEdge; attribute vec4 aCorner; attribute vec4 aAO; attribute vec4 aMisc; attribute vec4 aFx; attribute vec4 aCut;
  varying vec3 vTint; varying vec3 vBandC; varying vec4 vEdge; varying vec4 vCorner; varying vec4 vAO; varying vec4 vMisc; varying vec4 vFx;
  varying vec3 vLocal; varying vec3 vN; varying float vWorldY;
`;
const VERT_BODY = /* glsl */`
  vTint = aTint; vBandC = aBand; vEdge = aEdge; vCorner = aCorner; vAO = aAO; vMisc = aMisc; vFx = aFx;
  vLocal = position; vN = normal;
  vWorldY = (modelMatrix * instanceMatrix * vec4(position, 1.0)).y;
  // coast corners lean in (a bilinear warp of the cell: the band and the neighbours' shared edges stay intact),
  // so the coastline reads as a chiselled island rather than a grid of squares
  {
    vec2 w = position.xz + .5; const float C = .2;
    float ne = aCut.x*w.x*(1.-w.y), se = aCut.y*w.x*w.y, sw = aCut.z*(1.-w.x)*w.y, nw = aCut.w*(1.-w.x)*(1.-w.y);
    transformed.x += C*(-ne - se + sw + nw);
    transformed.z += C*( ne - se - sw + nw);
  }
`;
const FRAG_HEAD = /* glsl */`
  varying vec3 vTint; varying vec3 vBandC; varying vec4 vEdge; varying vec4 vCorner; varying vec4 vAO; varying vec4 vMisc; varying vec4 vFx;
  varying vec3 vLocal; varying vec3 vN; varying float vWorldY;
  uniform float uTime; uniform vec3 uRock; uniform vec3 uStrata0; uniform vec3 uStrata1; uniform vec3 uStrata2;
  float h21(vec2 p){ p = fract(p*vec2(123.34,456.21)); p += dot(p,p+45.32); return fract(p.x*p.y); }
  float vnoise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
    return mix(mix(h21(i),h21(i+vec2(1,0)),f.x),mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x),f.y); }
  float fbm(vec2 p){ return .55*vnoise(p)+.3*vnoise(p*2.1+7.)+.15*vnoise(p*4.3+13.); }
  float aa(float e, float x){ float w = fwidth(x)+1e-4; return smoothstep(e-w, e+w, x); }
  float patternMask(vec2 p, float kind){
    if (kind < .5) { float s = fract((p.x + p.y) * 1.25); return aa(.5, s) ; }                        // diagonal stripes
    if (kind < 1.5) { vec2 q = p*1.25; q.x += .5*floor(q.y); vec2 g = fract(q)-.5; return 1. - aa(.25, length(g)); } // round dots
    if (kind < 2.5) { float z = abs(fract(p.x*1.1)-.5); float s = fract(p.y*1.1 + z); return aa(.5, s); } // chevrons
    vec2 c = floor(p*1.5); return mod(c.x+c.y, 2.);                                                   // checks
  }
`;
const FRAG_BODY = /* glsl */`
  {
    vec2 uvC = vLocal.xz + .5;         // 0..1 across the cell, x east, y south
    vec2 pw = vMisc.xy + vLocal.xz;    // plate-anchored: the pattern rides the plate
    float level = vMisc.w;
    vec3 col;
    if (vN.y > .5) {
      // TOP
      float n = fbm(pw*2.3);
      vec3 top = vTint * (.93 + .14*n);
      top *= 1. + .05*min(level,1.);                                       // raised ground is a touch lighter
      float pm = patternMask(pw, vMisc.z);
      top = mix(top, top*.78, pm);
      // an anchored plate has gone to stone, but keeps a hint of its colour
      if (vFx.w > .5) { float g0 = dot(top, vec3(.3,.59,.11)); top = mix(top, vec3(g0)*vec3(.82,.84,.88), .72); }
      // peaks: bare rock from height 2 (goat happy, village crushed), snow at 3; never mistaken for ground
      float rocky = smoothstep(1.5,1.9,level);
      float cracks = smoothstep(.47,.5,abs(fbm(pw*3.1+3.)-.5)+.45);
      vec3 rock = uRock*(.86+.28*fbm(pw*5.)); rock = mix(rock, rock*.72, cracks*.5);
      rock = mix(rock, mix(rock, vTint, .35), pm*.35);
      top = mix(top, rock, rocky);
      float snow = smoothstep(2.5,2.9,level);
      top = mix(top, vec3(.97,.98,1.)*(.93+.08*n), snow*smoothstep(.2,.42,fbm(pw*2.7+9.)+.18));
      // ice terrain: pale glass with hairline cracks
      if (vFx.z > .5) {
        float ic = smoothstep(.015,.0,abs(fbm(pw*4.)-.5));
        top = mix(vec3(.72,.92,1.)*(.9+.2*n), vec3(.95,1.,1.), ic*.8);
      }
      // subtle grid so cells can be counted
      vec2 gd = abs(uvC-.5);
      float gl = smoothstep(.47,.5,max(gd.x,gd.y));
      top *= 1. - gl*.1;
      // contact shadow beside a taller neighbour
      float ao = 0.;
      ao = max(ao, vAO.x*smoothstep(.34,.0,uvC.y));
      ao = max(ao, vAO.y*smoothstep(.66,1.,uvC.x));
      ao = max(ao, vAO.z*smoothstep(.66,1.,uvC.y));
      ao = max(ao, vAO.w*smoothstep(.34,.0,uvC.x));
      top *= 1. - ao*.42;
      // plate band along boundaries
      const float B = .15;
      float d = 1.;
      if (vEdge.x > .5) d = min(d, uvC.y);
      if (vEdge.y > .5) d = min(d, 1.-uvC.x);
      if (vEdge.z > .5) d = min(d, 1.-uvC.y);
      if (vEdge.w > .5) d = min(d, uvC.x);
      if (vCorner.x > .5) d = min(d, max(1.-uvC.x, uvC.y));
      if (vCorner.y > .5) d = min(d, max(1.-uvC.x, 1.-uvC.y));
      if (vCorner.z > .5) d = min(d, max(uvC.x, 1.-uvC.y));
      if (vCorner.w > .5) d = min(d, max(uvC.x, uvC.y));
      float band = 1. - aa(B, d);
      top = mix(top, vBandC*(1.+.06*n), band);
      float inner = (1.-aa(B+.03, d))*aa(B, d);
      top = mix(top, top*.72, inner*.65);
      col = top;
      // selection glow
      col += vFx.x * (vBandC*.16 + vec3(.05));
      float rim = (1.-aa(B*.5, d))*vFx.x;
      col += rim*vec3(.45);
    } else {
      // CLIFF: strata measured down from this column's top, so an uplift shows the layer cake rising
      vec2 sideCoord = abs(vN.x) > .5 ? vec2(pw.y, vLocal.y) : vec2(pw.x, vLocal.y);
      float wob = .05*sin(sideCoord.x*6.1)+.035*sin(sideCoord.x*13.7+1.3)+.02*sin(sideCoord.x*29.);
      float dep = -vLocal.y + wob;
      vec3 s = uStrata0;
      s = mix(s, uStrata1, aa(.34, dep));
      s = mix(s, uStrata0*.92, aa(.56, dep));
      s = mix(s, uStrata1*.9, aa(.78, dep));
      s = mix(s, uStrata2, aa(1.02, dep));
      s = mix(s, uStrata2*.82, aa(1.5, dep));
      s *= .9+.2*fbm(vec2(sideCoord.x*3., dep*7.));
      s *= 1.-.16*smoothstep(.45,.5,abs(fract(sideCoord.x*1.5+fbm(vec2(sideCoord.x,dep))*.4)-.5)+.1);
      // lip of the plate's colour at the very top
      float lipEdge = .085 + wob*.35;
      vec3 lip = mix(vBandC, vTint, .15);
      s = mix(lip, s, aa(lipEdge, dep));
      // wet foot just above the water, deep shade below
      s *= mix(.6, 1., smoothstep(.0,.16,vWorldY));
      col = s;
      col += vFx.x*vBandC*.08;
    }
    // a locked island reads as asleep: desaturated and paler
    float g = dot(col, vec3(.3,.59,.11));
    col = mix(col, vec3(g)*vec3(.88,.92,.98)*.95+.06, vFx.y);
    diffuseColor.rgb = col;
  }
`;

export interface TerrainUniforms { uTime: { value: number } }

export function makeTerrainMaterial(time: { value: number }): MeshLambertMaterial {
  const m = new MeshLambertMaterial({ color: 0xffffff, side: DoubleSide, shadowSide: 2 });
  m.onBeforeCompile = shader => {
    shader.uniforms.uTime = time;
    shader.uniforms.uRock = { value: new Vector3(0.28, 0.27, 0.26) };
    shader.uniforms.uStrata0 = { value: new Vector3(0.62, 0.3, 0.1) };
    shader.uniforms.uStrata1 = { value: new Vector3(0.82, 0.5, 0.22) };
    shader.uniforms.uStrata2 = { value: new Vector3(0.23, 0.2, 0.2) };
    shader.vertexShader = VERT_HEAD + shader.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>\n${VERT_BODY}`);
    shader.fragmentShader = FRAG_HEAD + shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>\n${FRAG_BODY}`);
  };
  m.customProgramCacheKey = () => 'shiftland-terrain-1';
  return m;
}
