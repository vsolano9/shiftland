// The ocean: one big plane with a stylized shader. Coast distance, lakes and dry rift floors come from two masks:
// a static low-res mask of the whole archipelago, and a high-res mask of the active island rewritten while it animates.
// Channels: R = distance to land (0 = on land, 1 = MASK_RANGE or farther), G = lake, B = dry floor (a rift not flooded yet).
import { ClampToEdgeWrapping, Color, DataTexture, LinearFilter, Mesh, PlaneGeometry, RGBAFormat, ShaderMaterial, UnsignedByteType, Vector4 } from 'three';

export const MASK_RANGE = 4; // world units encoded by R
const CHAMFER = .2;        // same as terrain.ts vertex shader C

function makeTexture(w: number, h: number): DataTexture {
  const t = new DataTexture(new Uint8Array(w * h * 4).fill(255), w, h, RGBAFormat, UnsignedByteType);
  t.minFilter = LinearFilter; t.magFilter = LinearFilter; t.wrapS = t.wrapT = ClampToEdgeWrapping; t.needsUpdate = true;
  return t;
}

export interface LandRect { x0: number; z0: number; x1: number; z1: number; cut?: [number, number, number, number] }
/** Is a point in the sliver a corner chamfer removed? a and b run from 0 to 1 toward that corner. */
function inCut(a: number, b: number, cut: number) {
  if (!cut) return false;
  const C = CHAMFER * cut, k = C / (1 - C), o = 1 - b;
  return o < a * k && a > (1 - C) + (o - C) * k;
}
export interface WaterRect extends LandRect { lake?: number; dry?: number }

/** Rasterizes land rectangles into a distance mask (two-pass chamfer) and writes water state on top. */
export class Mask {
  tex: DataTexture;
  private dist: Float32Array;
  private blur: Float32Array | null;
  constructor(readonly w: number, readonly h: number, public x0: number, public z0: number, public size: [number, number], smooth = false) {
    this.tex = makeTexture(w, h);
    this.dist = new Float32Array(w * h);
    this.blur = smooth ? new Float32Array(w * h) : null;
  }
  get bounds() { return new Vector4(this.x0, this.z0, this.size[0], this.size[1]); }
  moveTo(x0: number, z0: number) { this.x0 = x0; this.z0 = z0; }
  write(land: LandRect[], water: WaterRect[]) {
    const { w, h, dist } = this;
    const sx = w / this.size[0], sz = h / this.size[1], INF = 1e6;
    dist.fill(INF);
    for (const r of land) {
      // a pixel is land when its centre is; rounding outward would swell the shore by a pixel all round
      const ax = Math.max(0, Math.ceil((r.x0 - this.x0) * sx - .5)), bx = Math.min(w, Math.ceil((r.x1 - this.x0) * sx - .5));
      const az = Math.max(0, Math.ceil((r.z0 - this.z0) * sz - .5)), bz = Math.min(h, Math.ceil((r.z1 - this.z0) * sz - .5));
      const cut = r.cut;
      for (let y = az; y < bz; y++) for (let x = ax; x < bx; x++) {
        if (cut && (cut[0] || cut[1] || cut[2] || cut[3])) {
          // leave out the slice that terrain.ts's coast chamfer removes, so foam follows the chiselled shore
          const u = (this.x0 + (x + .5) / sx - r.x0) / (r.x1 - r.x0), v = (this.z0 + (y + .5) / sz - r.z0) / (r.z1 - r.z0);
          if (inCut(u, 1 - v, cut[0]) || inCut(u, v, cut[1]) || inCut(1 - u, v, cut[2]) || inCut(1 - u, 1 - v, cut[3])) continue;
        }
        dist[x + y * w] = 0;
      }
    }
    // land just past the mask's edge still has a shore: without this a neighbour's shallows end in a straight line at the border
    const X1 = this.x0 + this.size[0], Z1 = this.z0 + this.size[1];
    const past = land.filter(r => r.x0 < this.x0 || r.z0 < this.z0 || r.x1 > X1 || r.z1 > Z1);
    if (past.length) for (let y = 0; y < h; y++) {
      const step = y === 0 || y === h - 1 ? 1 : w - 1, wz = this.z0 + (y + .5) / sz;
      for (let x = 0; x < w; x += step) {
        const wx = this.x0 + (x + .5) / sx; let d = dist[x + y * w];
        for (const r of past) d = Math.min(d, Math.hypot(Math.max(r.x0 - wx, 0, wx - r.x1), Math.max(r.z0 - wz, 0, wz - r.z1)));
        dist[x + y * w] = d;
      }
    }
    // chamfer distance in world units: the map's pixels aren't always square (its size changes with the layout, its resolution has a cap),
    // and counting pixels there made its shallows wider than the active mask's, with a line where they met
    const A = 1 / sx, C = 1 / sz, B = Math.hypot(A, C);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = x + y * w; let d = dist[i];
      if (x > 0) d = Math.min(d, dist[i - 1] + A);
      if (y > 0) { d = Math.min(d, dist[i - w] + C); if (x > 0) d = Math.min(d, dist[i - w - 1] + B); if (x < w - 1) d = Math.min(d, dist[i - w + 1] + B); }
      dist[i] = d;
    }
    for (let y = h - 1; y >= 0; y--) for (let x = w - 1; x >= 0; x--) {
      const i = x + y * w; let d = dist[i];
      if (x < w - 1) d = Math.min(d, dist[i + 1] + A);
      if (y < h - 1) { d = Math.min(d, dist[i + w] + C); if (x < w - 1) d = Math.min(d, dist[i + w + 1] + B); if (x > 0) d = Math.min(d, dist[i + w - 1] + B); }
      dist[i] = d;
    }
    // rounded contours for the active island: the chamfer metric alone draws angular "map contour" foam lines
    if (this.blur) for (let pass = 0; pass < 2; pass++) {
      const b = this.blur, R = 3;
      for (let y = 0; y < h; y++) { let s = 0; for (let x = -R; x <= R; x++) s += dist[Math.max(0, x) + y * w]; for (let x = 0; x < w; x++) { b[x + y * w] = s; s += dist[Math.min(w - 1, x + R + 1) + y * w] - dist[Math.max(0, x - R) + y * w]; } }
      for (let x = 0; x < w; x++) { let s = 0; for (let y = -R; y <= R; y++) s += b[x + Math.max(0, y) * w]; for (let y = 0; y < h; y++) { const i = x + y * w; dist[i] = dist[i] === 0 ? 0 : s / 49; s += b[x + Math.min(h - 1, y + R + 1) * w] - b[x + Math.max(0, y - R) * w]; } }
    }
    const data = this.tex.image.data as Uint8Array, toByte = 255 / MASK_RANGE;
    for (let i = 0; i < w * h; i++) {
      data[i * 4] = Math.min(255, dist[i] * toByte); data[i * 4 + 1] = 0; data[i * 4 + 2] = 0; data[i * 4 + 3] = 255;
    }
    for (const r of water) {
      if (!r.lake && !r.dry) continue;
      const ax = Math.max(0, Math.floor((r.x0 - this.x0) * sx)), bx = Math.min(w, Math.ceil((r.x1 - this.x0) * sx));
      const az = Math.max(0, Math.floor((r.z0 - this.z0) * sz)), bz = Math.min(h, Math.ceil((r.z1 - this.z0) * sz));
      for (let y = az; y < bz; y++) for (let x = ax; x < bx; x++) {
        const i = (x + y * w) * 4;
        data[i + 1] = Math.max(data[i + 1], (r.lake ?? 0) * 255);
        data[i + 2] = Math.max(data[i + 2], (r.dry ?? 0) * 255);
      }
    }
    this.tex.needsUpdate = true;
  }
}

const VERT = /* glsl */`
  varying vec3 vW;
  void main(){ vec4 w = modelMatrix*vec4(position,1.); vW = w.xyz; gl_Position = projectionMatrix*viewMatrix*w; }
`;
const FRAG = /* glsl */`
  precision highp float;
  varying vec3 vW;
  uniform float uTime; uniform sampler2D uStatic; uniform vec4 uStaticB; uniform sampler2D uActive; uniform vec4 uActiveB;
  uniform vec3 uDeep; uniform vec3 uShallow; uniform vec3 uLake; uniform vec3 uFloor; uniform float uRange; uniform float uMotion; uniform float uAlone;
  float h21(vec2 p){ p = fract(p*vec2(123.34,456.21)); p += dot(p,p+45.32); return fract(p.x*p.y); }
  float vn(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
    return mix(mix(h21(i),h21(i+vec2(1,0)),f.x),mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x),f.y); }
  float fbm(vec2 p){ return .55*vn(p)+.3*vn(p*2.1+7.)+.15*vn(p*4.3+13.); }
  // Small white crescents scattered over the open water, like the concept sheets' waves.
  float wavelets(vec2 p, float t){
    // screen-aligned rows (the camera's azimuth is fixed), so waves read as little horizontal smiles, not streaks of rain
    vec2 s = vec2(p.x*.7518 - p.y*.6594, p.x*.6594 + p.y*.7518);
    vec2 q = s*vec2(.95,1.9); q.x += floor(q.y)*.5 + t*.02;
    vec2 id = floor(q), f = fract(q)-.5;
    float r = h21(id);
    float life = sin(t*(.3+.6*r)+r*40.); life = smoothstep(.05,.7,life);
    vec2 o = vec2(h21(id+3.)-.5, h21(id+7.)-.5)*.42; vec2 g = (f-o)*vec2(1.,1.5);
    float bend = g.y - 2.6*g.x*g.x + .02;
    float w = max(fwidth(bend), .012);
    float line = smoothstep(.026+w,.026,abs(bend))*smoothstep(.2,.07,abs(g.x));
    return line*life*step(.58,r);
  }
  void main(){
    float t = uTime;
    vec2 p = vW.xz;
    vec2 us = (p-uStaticB.xy)/uStaticB.zw;
    vec4 m = (us.x>0. && us.y>0. && us.x<1. && us.y<1.) ? texture2D(uStatic, us) : vec4(1.,0.,0.,1.);
    m = mix(m, vec4(1.,0.,0.,1.), uAlone); // settled on one board there is only its own shore: the others' shallows go with them
    vec2 ua = (p-uActiveB.xy)/uActiveB.zw;
    // the two masks are drawn at different sharpness: the fine one fades in over its border, or a neighbour's shallows show a straight seam
    if (ua.x>0. && ua.y>0. && ua.x<1. && ua.y<1.) m = mix(m, texture2D(uActive, ua), smoothstep(0.,.1,min(min(ua.x,ua.y),min(1.-ua.x,1.-ua.y))));
    // a just-opened rift has a shore, not a ruled line: its edge is read off a wandering point
    // and four reads around it give the sand a slope down into the sea, where one read cut it out like paper
    if (ua.x>.02 && ua.y>.02 && ua.x<.98 && ua.y<.98) {
      vec2 w0 = ua+(vec2(vn(p*2.3),vn(p*2.3+9.))-.5)*.5/uActiveB.zw, r = .24/uActiveB.zw;
      m.b = .25*(texture2D(uActive, w0+r).b + texture2D(uActive, w0-r).b + texture2D(uActive, w0+vec2(r.x,-r.y)).b + texture2D(uActive, w0+vec2(-r.x,r.y)).b);
    }
    float dist = m.r*uRange;
    float wob = (fbm(p*1.4+vec2(t*.05,-t*.04))-.5);
    float d = dist + wob*.1;
    float n1 = fbm(p*.33+vec2(t*.016,t*.011));
    float n2 = fbm(p*.8-vec2(t*.03,t*.018));
    float calm = 1.-.8*smoothstep(.04,.1,fwidth(p.x)); // mottling that adds depth up close reads as dirt from the map
    vec3 col = mix(uDeep, uDeep*1.1+vec3(0.,.018,.018), smoothstep(.34,.66,n1)*calm);
    col = mix(col, uShallow, smoothstep(1.7,.12,d)*.95);
    col += .035*smoothstep(.45,.75,n2)*uShallow*calm;
    // one or two ripple bands hugging the shore
    float ripple = sin(d*9. - t*1.15 + n2*3.);
    float rs = smoothstep(.72,.98,ripple)*smoothstep(1.05,.3,d);
    col = mix(col, col+vec3(.25,.34,.34), rs*.2);
    // white shore foam, breathing in and out
    float breathe = .025+.02*sin(t*.9+n1*11.);
    float foam = smoothstep(breathe+.05, breathe, d + (fbm(p*5.+t*.14)-.5)*.1);
    // broken surf, not a sticker outline: fine gaps in it and water between the patches (critic T6)
    foam *= mix(.08, 1., smoothstep(.44,.58,fbm(p*2.4+vec2(t*.05,-t*.03))))*mix(.3, .72, smoothstep(.38,.62,fbm(p*9.-t*.1)));
    // a broken lace of foam just off the shore
    float ring = smoothstep(.055,.0,abs(d-(.33+.06*sin(t*.7+p.x*.35)))) * smoothstep(.42,.6,fbm(p*3.6-t*.08));
    // from the map the near waves would alias away, so a coarser set takes over and the sea stays alive and clean
    float px = fwidth(p.x), farView = smoothstep(.025,.06,px);
    float wl = wavelets(p, t)*smoothstep(.55,1.3,dist)*(1.-farView) + wavelets(p*.24+vec2(31.,17.), t)*smoothstep(1.2,3.,dist)*farView*.85;
    col += vec3(.62)*wl;
    // lake: still, green-teal water, its own colour
    // a sandy rim and a green unlike any sea, so a lake can't be taken for the shallows
    // clear jade, luminous in the shallows: what an oasis longs for, where a dark green read as a swamp (playtest 15; concepts/lake-oasis-v1.png)
    if (m.g>.001) { // only where there is a lake: this noise ran for every pixel of sea
      vec3 lake = mix(uLake + vec3(.03,.2,.1), uLake*.74, smoothstep(.14,.36,d))*(.98+.05*n2); // luminous at the rim, deeper in the middle
      // water, not a green floor: a few small rings opening and fading, as on a still pond. Long lines read as a current (concept critic T1, T3, Nov 6)
      vec2 rp = p*1.7; vec2 ri = floor(rp); float rs = h21(ri+3.);
      float rr = length(fract(rp)-.5-(vec2(h21(ri+7.),h21(ri+4.))-.5)*.5), rph = fract(t*.13+rs*7.);
      float ring = step(.5,rs)*(1.-smoothstep(.0,.03,abs(rr-.04-rph*.34)))*(1.-rph);
      lake += vec3(.3,.42,.36)*ring*smoothstep(.15,.28,d) + vec3(.02,.06,.04)*smoothstep(.45,.7,n2);
      // a few small dark pads: pale round ones were the same mark as the plates' dots and the peaks' corner dots
      vec2 lp = p*2.2; vec2 li = floor(lp); float lr = h21(li+5.);
      lake = mix(lake, vec3(.1,.46,.25), step(.84,lr)*(1.-smoothstep(.12,.145,length(fract(lp)-.5-(vec2(h21(li+9.),h21(li+2.))-.5)*.4))));
      lake = mix(lake, vec3(.8,.66,.4), smoothstep(.2,.13,d));
      col = mix(col, lake, m.g);
    }
    // rift floor before the sea reaches it
    // wet and dark, half sea already: bright sand laid on the water looks like a sheet of cardboard
    // the sea doesn't fade in over it, it runs in: the edge wanders, and a line of foam rides it
    float wet = 0., front = 0.;
    if (m.b>.001) {
      float n3 = fbm(p*3.1+vec2(t*.2,0.)), n4 = fbm(p*7.3-vec2(0.,t*.3));
      float e = m.b+(n3-.5)*.55+(n4-.5)*.2;
      wet = smoothstep(.14,.66,e);
      // the foam rides just ahead of the sand, and breaks up: a hairline all round read as a paper cut-out
      front = smoothstep(.08,.2,e)*smoothstep(.44,.24,e)*smoothstep(.32,.56,fbm(p*6.-vec2(t*.4,t*.25)));
      float sandRipple = .5+.5*sin((p.x*.7518-p.y*.6594)*13.+n3*6.);
      // a sandbar just under the water, not a panel laid on it: from pale and rippled in the middle to dark and wet toward the sea
      float dryness = smoothstep(.34,.86,e);
      vec3 sand = uFloor*(.82+.62*n4+.3*sandRipple*dryness)*mix(.66,1.,dryness);
      vec3 flr = mix(mix(uShallow,sand,.62), sand, dryness)*mix(.72,1.,smoothstep(0.,.3,dist));
      col = mix(col, flr, wet);
    }
    // under land nobody sees water, except where a hidden neighbour stands: there it must be plain sea, not a raft of foam
    float fm = max(max(foam, ring*.5)*(1.-wet), front*.9)*smoothstep(0.,.04,dist);
    col = mix(col, vec3(.96,.99,1.), fm*(1.-m.g)); // a still lake has no surf: this foam read as chalk on it (critic T1, Nov 6)
    gl_FragColor = vec4(col,1.);
    #include <colorspace_fragment>
  }
`;

export class Ocean {
  mesh: Mesh;
  uniforms: Record<string, { value: unknown }>;
  constructor(public staticMask: Mask, public activeMask: Mask, time: { value: number }) {
    this.uniforms = {
      uTime: time, uAlone: { value: 0 }, uStatic: { value: staticMask.tex }, uStaticB: { value: staticMask.bounds },
      uActive: { value: activeMask.tex }, uActiveB: { value: activeMask.bounds },
      uDeep: { value: new Color('#0e7fae') }, uShallow: { value: new Color('#1fcdcf') },
      uLake: { value: new Color('#07a85c') }, uFloor: { value: new Color('#b58a57') }, uRange: { value: MASK_RANGE }, uMotion: { value: 1 },
    };
    const g = new PlaneGeometry(6000, 6000); g.rotateX(-Math.PI / 2);
    this.mesh = new Mesh(g, new ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms: this.uniforms }));
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = -1;
  }
  syncBounds() { (this.uniforms.uActiveB.value as Vector4).copy(this.activeMask.bounds); (this.uniforms.uStaticB.value as Vector4).copy(this.staticMask.bounds); }
  setSea(deep: string, shallow: string, k = 1) {
    (this.uniforms.uDeep.value as Color).lerp(new Color(deep), k);
    (this.uniforms.uShallow.value as Color).lerp(new Color(shallow), k);
  }
}
