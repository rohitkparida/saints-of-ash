// Saints of Ash - isometric demo rendered as a real three.js 3D scene.
// Loaded after iso.js; reuses its game logic, level data, baked art and overlay passes, and replaces only the
// scene drawing: floor, pool basin, walls, roofs, props and characters become 3D geometry seen through an
// orthographic camera at the demo's exact 2:1 angle. Surfaces are textured by projecting the original baked
// art from that camera, so the default view matches the 2D demo pixel for pixel while depth comes from the z-buffer.
// World units: x, y in tiles (as iso_data.js), z in native pixels (as the 2D code).
import * as THREE from 'https://unpkg.com/three@0.170.0/build/three.module.js';

const glCanvas = document.createElement('canvas');
const renderer = new THREE.WebGLRenderer({ canvas: glCanvas, antialias: false, alpha: false, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.outputColorSpace = THREE.LinearSRGBColorSpace; renderer.sortObjects = true;
const scene = new THREE.Scene();
const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
camera.matrixAutoUpdate = false; camera.matrixWorld.identity(); camera.matrixWorldInverse.identity();

// exact projection: screen x = (x-y)*16 - cx, screen y = (x+y)*8 - z - cy; depth grows toward the viewer along (1,1,16)
const _rot = new THREE.Matrix4(), _t = new THREE.Matrix4();
function setCamera(cx, cy, yaw = 0, px = 0, py = 0) {
  const w = NW, h = NH, m = camera.projectionMatrix;
  m.set(32 / w, -32 / w, 0, -2 * cx / w - 1,
    -16 / h, -16 / h, 2 / h, 1 + 2 * cy / h,
    -1 / 40, -1 / 40, -1 / 640, 1 - 8 / 40,
    0, 0, 0, 1);
  if (yaw) { // orbit: spin the world about the vertical axis through (px, py)
    _rot.makeTranslation(px, py, 0).multiply(_t.makeRotationZ(yaw)).multiply(_t.makeTranslation(-px, -py, 0)); m.multiply(_rot); }
  camera.projectionMatrixInverse.copy(m).invert();
}

// ---------- projected-art material ----------
// Lighting: the 2D demo darkens everything with a navy layer (alpha 0.8) and cuts soft holes around each light.
// Here every surface is lit per pixel by the same lights: distance to the light's vertical "pole" (ground pool + lit walls),
// a facing term so surfaces turned away stay darker, the same darkness colour, and dithered bands in pixel mode.
// World space for lighting: x, y in tiles, z in "tile" units (16 native px per tile of height).
const MAXL = 24;
const LU = { lp: { value: Array.from({ length: MAXL }, () => new THREE.Vector4()) }, lc: { value: Array.from({ length: MAXL }, () => new THREE.Vector4()) },
  ln: { value: 0 }, dark: { value: new THREE.Vector4(3 / 255, 5 / 255, 12 / 255, 0.8) }, vdir: { value: new THREE.Vector3(1, 1, 1).normalize() },
  lit3d: { value: 1 }, pix: { value: 1 }, emis: { value: null }, floorEm: { value: null }, erect: { value: new THREE.Vector4(0, 0, 1, 1) } };
const VS = `uniform vec4 rect; uniform vec4 erect; uniform float local; varying vec2 vUv; varying vec2 vE; varying vec3 vQ;
void main(){ vec4 wp = modelMatrix * vec4(position, 1.0); vec3 q = local > 0.5 ? position : wp.xyz; float sx = (q.x - q.y) * 16.0; float sy = (q.x + q.y) * 8.0 - q.z;
  vUv = (vec2(sx, sy) - rect.xy) / rect.zw;
  vE = (vec2((wp.x - wp.y) * 16.0, (wp.x + wp.y) * 8.0 - wp.z) - erect.xy) / erect.zw;
  vQ = vec3(wp.xy, wp.z / 16.0); gl_Position = projectionMatrix * viewMatrix * wp; }`;
const FS = `uniform sampler2D map; uniform sampler2D mapO; uniform float other, warp, opacity, sil; uniform vec3 tint; varying vec2 vUv; varying vec2 vE; varying vec3 vQ;
uniform vec4 lp[${MAXL}]; uniform vec4 lc[${MAXL}]; uniform int ln; uniform vec4 dark; uniform vec3 vdir; uniform float lit3d, pix, lit, noLam, emisOn;
uniform sampler2D emis; uniform sampler2D floorEm;
float bayer(vec2 p){ int x = int(mod(p.x, 4.0)), y = int(mod(p.y, 4.0)); int i = x + y * 4;
  float m[16] = float[16](0.,8.,2.,10.,12.,4.,14.,6.,3.,11.,1.,9.,15.,7.,13.,5.); return (m[i] + 0.5) / 16.0; }
void main(){ if (vUv.x < 0.0 || vUv.y < 0.0 || vUv.x > 1.0 || vUv.y > 1.0) discard;
  vec4 a = texture2D(map, vUv), b = texture2D(mapO, vUv); vec4 c = other > 0.5 ? b : a;
  if (other < 0.5 && warp > 0.01) { c.rgb = mix(c.rgb, b.rgb, b.a * warp); c.a = max(c.a, b.a * warp); }
  if (c.a < 0.02) discard; if (sil > 0.5) c.rgb = tint;
  if (lit > 0.5 && lit3d > 0.5) {
    vec3 n = normalize(cross(dFdx(vQ), dFdy(vQ))); if (dot(n, vdir) < 0.0) n = -n;
    vec3 E = vec3(0.0);
    for (int i = 0; i < ${MAXL}; i++) { if (i >= ln) break;
      vec3 L = lp[i].xyz; vec3 s = vec3(L.xy, clamp(vQ.z, 0.0, L.z)); float d = length(vQ - s) / lp[i].w;
      float f = d < 1.0 ? sqrt(1.0 - d) : 0.0; if (f <= 0.0) continue;
      vec3 Ld = L - vQ; float ll = length(Ld); float lam = noLam > 0.5 || ll < 0.05 ? 1.0 : 0.45 + 0.55 * max(dot(n, Ld / ll), 0.0);
      E += lc[i].rgb * f * lam; }
    if (pix > 0.5) E = floor(E * 4.0 + bayer(gl_FragCoord.xy)) / 4.0;
    E = clamp(E, 0.0, 1.0); vec3 al = dark.a * (1.0 - E); c.rgb = c.rgb * (1.0 - al) + dark.rgb * al;
  }
  if (emisOn > 0.5 && lit3d > 0.5 && vE.x > 0.0 && vE.y > 0.0 && vE.x < 1.0 && vE.y < 1.0) { vec4 e = emisOn > 1.5 ? texture2D(floorEm, vE) : texture2D(emis, vE); c.rgb += e.rgb * e.a; }
  gl_FragColor = vec4(c.rgb, c.a * opacity); }`;
function tex(cv) { const t = new THREE.CanvasTexture(cv); t.flipY = false; t.magFilter = t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; t.colorSpace = THREE.NoColorSpace; return t; }
function artMat(bake, opt = {}) {
  const map = tex(bake.cv), mapO = bake.cvO ? tex(bake.cvO) : map;
  return new THREE.ShaderMaterial({ vertexShader: VS, fragmentShader: FS, transparent: true, depthWrite: true, side: THREE.DoubleSide,
    uniforms: { map: { value: map }, mapO: { value: mapO }, rect: { value: new THREE.Vector4(bake.bx, bake.by, bake.bw, bake.bh) },
      local: { value: 0 }, other: { value: 0 }, warp: { value: 0 }, opacity: { value: 1 }, sil: { value: opt.sil ? 1 : 0 }, tint: { value: new THREE.Color(opt.tint || '#ffffff') },
      lit: { value: opt.lit === 0 ? 0 : 1 }, noLam: { value: opt.noLam ? 1 : 0 }, emisOn: { value: opt.emis || 0 }, ...LU }, ...opt.mat });
}

// ---------- geometry ----------
class Geo { constructor() { this.p = []; }
  quad(a, b, c, d) { this.p.push(...a, ...b, ...c, ...a, ...c, ...d); return this; }
  // the faces the 2D box() draws: top, +y side, +x side
  box(x0, y0, x1, y1, z0, z1) { this.quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]);
    this.quad([x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]); this.quad([x1, y1, z0], [x1, y0, z0], [x1, y0, z1], [x1, y1, z1]);
    // back faces: hidden in the fixed view (same projected texel as the front), needed once the camera orbits
    this.quad([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]); this.quad([x0, y0, z0], [x0, y1, z0], [x0, y1, z1], [x0, y0, z1]); return this; }
  build() { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3)); return g; } }
// record the boxes a 2D draw function makes, so each prop gets its own real shape
const box2d = window.box; let capture = null;
window.box = function (c, x0, y0, x1, y1, z0, z1, ...rest) { if (capture) capture.push([x0, y0, x1, y1, z0, z1]); return box2d(c, x0, y0, x1, y1, z0, z1, ...rest); };
const dummy = document.createElement('canvas').getContext('2d');
function boxesOf(fn) { capture = []; try { fn(dummy); } finally { } const b = capture; capture = null; return b; }
const E = 0.08; // grow boxes ~1px so outline pixels the 2D art draws just past a face still land on geometry
// art a prop paints with flat faces instead of boxes gets two backing planes along the prop's rear edges
function backPlanes(g, it) { const [x0, y0, x1, y1] = it.fp, b = it.full, zt = Math.max(4, (x0 + y0) * 8 - b.by + 2), e = 0.02;
  g.quad([x0, y0 + e, 0], [x1, y0 + e, 0], [x1, y0 + e, zt], [x0, y0 + e, zt]); g.quad([x0 + e, y0, 0], [x0 + e, y1, 0], [x0 + e, y1, zt], [x0 + e, y0, zt]); }
function meshOf(boxes, bake, order, opt, up = 2, it = null) { const g = new Geo(); if (it) backPlanes(g, it); for (const [x0, y0, x1, y1, z0, z1] of boxes) g.box(Math.min(x0, x1) - E, Math.min(y0, y1) - E, Math.max(x0, x1) + E, Math.max(y0, y1) + E, z0, Math.max(z0, z1) + up); const m = new THREE.Mesh(g.build(), artMat(bake, opt)); m.frustumCulled = false; m.renderOrder = order; scene.add(m); return m; }

let built = null, floorMesh, decal, decalCv, items3 = [], emCv, flCv, emS = 1;
function build(sc) {
  for (const o of [...scene.children]) { scene.remove(o); o.geometry && o.geometry.dispose(); }
  items3 = [];
  // floor: every tile at z=0 except the drained pool, plus the sunken basin
  const pl = L.pool, d = pl.depth, fg = new Geo();
  for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) if (tileAt(x, y) !== 'P') fg.quad([x, y, 0], [x + 1, y, 0], [x + 1, y + 1, 0], [x, y + 1, 0]);
  fg.quad([pl.x0, pl.y0, -d], [pl.x1, pl.y0, -d], [pl.x1, pl.y1, -d], [pl.x0, pl.y1, -d]);
  fg.quad([pl.x0, pl.y0, -d], [pl.x1, pl.y0, -d], [pl.x1, pl.y0, 0], [pl.x0, pl.y0, 0]);   // north basin wall, faces +y
  fg.quad([pl.x0, pl.y0, -d], [pl.x0, pl.y1, -d], [pl.x0, pl.y1, 0], [pl.x0, pl.y0, 0]);   // west basin wall, faces +x
  const floorGeo = fg.build();
  floorMesh = new THREE.Mesh(floorGeo, artMat(sc.floor, { emis: 2 })); floorMesh.frustumCulled = false; floorMesh.renderOrder = -10; scene.add(floorMesh);
  // dynamic floor decals (rain rings, character shadows), drawn each frame on a canvas the size of the floor bake
  decalCv = makeCanvas(sc.floor.cv.width, sc.floor.cv.height);
  decal = new THREE.Mesh(floorGeo, artMat({ cv: decalCv, bx: sc.floor.bx, by: sc.floor.by, bw: sc.floor.bw, bh: sc.floor.bh }, { mat: { depthWrite: false } }));
  decal.frustumCulled = false; decal.renderOrder = -9; scene.add(decal);
  // glowing things (neon, signs, screens) and floor reflections: level-sized canvases projected onto the geometry
  const ES = G.mode === 'pixel' ? 1 : 2; emCv = makeCanvas(sc.floor.bw * ES, sc.floor.bh * ES); flCv = makeCanvas(sc.floor.bw * ES, sc.floor.bh * ES); emS = ES;
  LU.emis.value = tex(emCv); LU.floorEm.value = tex(flCv); if (ES > 1) for (const t of [LU.emis.value, LU.floorEm.value]) t.magFilter = t.minFilter = THREE.LinearFilter;
  LU.erect.value.set(sc.floor.bx, sc.floor.by, sc.floor.bw, sc.floor.bh);
  for (const it of sc.items) {
    const ord = it.key * 10; let boxes, stubBoxes = null;
    if (it.kind === 'wall') { boxes = boxesOf(c => drawWall(c, it.w, WH)); if (it.stub) stubBoxes = boxesOf(c => drawWall(c, it.w, 6)); }
    else if (it.kind === 'roof') { const [x, y] = it.fp; boxes = boxesOf(c => drawRoof(c, x, y, it.room)); }
    else if (it.o && it.o.t === 'bags') { const o = it.o, r = mulberry32(4); boxes = []; // the four sacks the 2D art draws, same random layout
      for (let i = 0; i < 4; i++) { const x = o.x0 + r() * 0.6, y = o.y0 + r() * 0.7, k = (3 + r() * 2) / 22; boxes.push([x - k, y - k, x + k, y + k, 0, 7]); } }
    else if (it.o) boxes = boxesOf(c => PROPDRAW[it.o.t](c, it.o));
    else { // fence segment: corner post plus the chain-link plane
      const [x0, y0, x1, y1] = it.fp, east = (x1 - x0) < 0.2; boxes = [[x0, y0, x0 + 0.06, y0 + 0.06, 0, 30]];
      boxes.push(east ? [x1, y0, x1, y1, 0, 30] : [x0, y1, x1, y1, 0, 30]); }
    if (!boxes.length) { const [x0, y0, x1, y1] = it.fp; boxes = [[x0, y0, x1, y1, 0, (PROPZ[it.t] || 20) - 2]]; }
    const up = it.kind === 'wall' || it.kind === 'roof' ? 0 : 2; // walls/roofs must not poke through each other
    const m = meshOf(boxes, it.full, ord, { emis: 1 }, up, it.o ? it : null), s = stubBoxes ? meshOf(stubBoxes, it.stub, ord - 0.5, { emis: 1 }, 0) : null;
    items3.push({ it, m, s });
  }
  built = sc;
}

// characters: an upright plane at the feet, facing the camera, painted with the puppet sprite each frame
const CW = 48, CH = 56, chars = new Map(); let charS = 0;
function charMesh(id, sil) {
  const k = id + (sil ? ':sil' : '') + G.S; if (chars.has(k)) return chars.get(k);
  const cv = makeCanvas(CW * G.S, CH * G.S), bake = { cv, bx: 0, by: 0, bw: CW, bh: CH };
  const g = new Geo().quad([-0.75, 0.75, -6], [0.75, -0.75, -6], [0.75, -0.75, 50], [-0.75, 0.75, 50]).build();
  const m = new THREE.Mesh(g, artMat(bake, sil ? { sil: true, lit: 0, tint: '#39e6ff', mat: { depthFunc: THREE.GreaterDepth, depthWrite: false } } : { noLam: true }));
  m.frustumCulled = false; m.material.uniforms.local.value = 1; const rec = { cv, m, map: m.material.uniforms.map.value, used: false }; chars.set(k, rec); scene.add(m); return rec;
}
const LIFT = 0.14; // slide characters toward the camera along the view ray (same pixels) so they sit in front of what they stand beside
function placeChar(rec, x, y, order, opacity = 1) {
  const p = P(x, y); rec.m.position.set(x + LIFT, y + LIFT, LIFT * 16); rec.m.renderOrder = order; rec.m.visible = true; rec.used = true; rec.m.rotation.z = -ORB.yaw; // keep facing the camera
  const u = rec.m.material.uniforms; u.rect.value.set(-CW / 2, -50, CW, CH); u.opacity.value = opacity; rec.map.needsUpdate = true;
}

// orbit camera (KeyO / touch CAM): spins around the player; off eases back to the exact isometric view
const ORB = { on: false, yaw: 0, t: 0 }; window.LIT3D = true; addEventListener('keydown', e => { if (e.code === 'KeyL') window.LIT3D = !window.LIT3D; });
window.ORB = ORB;
addEventListener('keydown', e => { if (e.code === 'KeyO') ORB.on = !ORB.on; });
function fx2d(c, halos, walls, floor = c) { // the 2D demo's additive light effects; c/floor = where wall and floor parts go
  const t = G.t, other = game.world === 'other', pix = G.mode === 'pixel';
  c.save(); c.globalCompositeOperation = 'lighter'; if (floor !== c) { floor.save(); floor.globalCompositeOperation = 'lighter'; }
  if (halos) {
  
  for (const l of LIGHTS) { const g = P(l.x, l.y, l.h); const big = l.kind === 'siren' ? 10 : l.kind === 'neon' ? 22 : l.kind === 'lamp' ? 10 : 7;
    glow(c, g[0], g[1], big, l.c, l.s * 0.9); if (l.kind !== 'window' && l.kind !== 'tvwin') { const gg = P(l.x, l.y); c.fillStyle = rgba(l.c, l.s * 0.07); if (pix) pxEllipse(c, gg[0], gg[1], l.r * 0.6, l.r * 0.3); else { c.beginPath(); c.ellipse(gg[0], gg[1], l.r * 0.6, l.r * 0.3, 0, 0, 6.28); c.fill(); } }
    if (l.kind === 'siren') { const a = P(l.x + 0.25, l.y - 0.02 + (l.phase ? 0.1 : -0.1), 19); rect(c, a[0] - 2, a[1], 4, 2, l.c); } }
  } else for (const l of LIGHTS) { const gg = P(l.x, l.y);
    if (l.kind !== 'window' && l.kind !== 'tvwin') { floor.fillStyle = rgba(l.c, l.s * 0.07); if (pix) pxEllipse(floor, gg[0], gg[1], l.r * 0.6, l.r * 0.3); else { floor.beginPath(); floor.ellipse(gg[0], gg[1], l.r * 0.6, l.r * 0.3, 0, 0, 6.28); floor.fill(); } }
    if (l.kind === 'siren') { const a = P(l.x + 0.25, l.y - 0.02 + (l.phase ? 0.1 : -0.1), 19); rect(c, a[0] - 2, a[1], 4, 2, l.c); } }
  if (!other) for (const [x, y, rx, ry] of L.puddles) for (const l of LIGHTS) { const d = Math.hypot(x - l.x, y - l.y); if (d > 7 || l.room) continue; const k = (1 - d / 7) * l.s; const p = P(x, y);
    const tall = l.kind === 'neon' || l.kind === 'lamp' || l.kind === 'siren'; floor.fillStyle = rgba(l.c, k * 0.5);
    const w = rx * 12, hgt = tall ? ry * 10 + 4 : ry * 6; const ox = (isoX(l.x, l.y) - p[0]) * 0.12, oyy = Math.sin(t * 3 + x) * 0.5;
    if (pix) floor.fillRect(Math.round(p[0] + ox - w * 0.25), Math.round(p[1] - ry * 4 + oyy), Math.round(w * 0.5), Math.round(hgt * 0.6)); else { floor.beginPath(); floor.ellipse(p[0] + ox, p[1] + oyy, w * 0.35, hgt * 0.35, 0, 0, 6.28); floor.fill(); } }
  if (walls) {
  if (!other) { const sp = L.props.find(o => o.t === 'sign'); signLetters(c, sp.x, sp.y, true, t);
    for (const nt of L.neonText) { const w = WALLMAP[nt.edge]; const F = faceY(w.x, w.x + 1, w.y + 0.05); const on = flick(nt.seed, t, 0.5); const F2 = (u, z) => F(u * 0.5, z); faceText(c, F2, nt.text, nt.u, 0.03, nt.z, 0.9, on ? COL(nt.col) : rgba(COL(nt.col), 0.2)); if (halos) glow(c, ...P(w.x + 0.9, w.y + 0.05, nt.z - 2), 16, COL(nt.col), on ? 0.5 : 0.05); }
    const ice = L.props.find(o => o.t === 'ice'); faceText(c, faceY(ice.x0, ice.x1, ice.y1), 'ICE', 0.3, 0.035, 19.5, 0.7, flick(4, t, 0.4) ? C.cy : rgba(C.cy, 0.2));
    const tv = 1 - roomFade.r6; if (tv > 0.05) { const dr = L.props.find(o => o.t === 'dresser'); const F = faceX(dr.y0 + 0.2, dr.y1 - 0.2, dr.x1 - 0.08); for (let z = 14; z < 21; z++) fq(c, F, 0.12, 0.88, z, z + 1, rgba(C.cy, tv * (0.15 + 0.35 * hash2(z, Math.floor(t * 14), 3)))); }
    const bo = L.props.find(o => o.t === 'booth'); fq(c, faceX(bo.y0, bo.y1, bo.x1), 0.08, 0.92, 31, 33, rgba(C.b9, flick(7, t, 1.3) ? 0.7 : 0.1)); }
  }
  c.restore(); if (floor !== c) floor.restore(); }
function render3d() {
  const S = G.S, sc = buildScene(), t = G.t, other = game.world === 'other', pix = G.mode === 'pixel';
  if (sc !== built) build(sc);
  let cx = camX, cy = camY; if (pix) { cx = Math.round(cx); cy = Math.round(cy); } else { cx = Math.round(cx * S) / S; cy = Math.round(cy * S) / S; }
  const W = (c) => c.setTransform(S, 0, 0, S, -cx * S, -cy * S);
  if (glCanvas.width !== NW * S) renderer.setSize(NW * S, NH * S, false);
  const dt = Math.min(0.1, Math.max(0, G.t - ORB.t)); ORB.t = G.t;
  if (ORB.on) ORB.yaw += dt * 0.6; else if (ORB.yaw) { const tw = Math.PI * 2, tgt = Math.round(ORB.yaw / tw) * tw, d = tgt - ORB.yaw; ORB.yaw = Math.abs(d) < 0.01 ? 0 : ORB.yaw + d * Math.min(1, dt * 4); if (!ORB.yaw || Math.abs(ORB.yaw - tgt) < 0.01) ORB.yaw = 0; }
  const flat = ORB.yaw === 0;
  setCamera(cx, cy, ORB.yaw, PL.x, PL.y);
  const warp = game.warp;
  const setU = (m, op) => { const u = m.material.uniforms; u.other.value = other ? 1 : 0; u.warp.value = warp; u.opacity.value = op; m.visible = op > 0.02; m.material.depthWrite = op > 0.5; };
  setU(floorMesh, 1);
  for (const r of items3) { let a = 1; if (r.it.kind === 'roof') a = roomFade[r.it.room];
    if (r.it.kind === 'wall' && r.it.cutRoom) { const f = roomFade[r.it.cutRoom]; if (r.s) setU(r.s, f < 0.98 ? 1 : 0); a = f; }
    else if (r.s) setU(r.s, 0); setU(r.m, a); }
  // floor decals
  const dc0 = decalCv.getContext('2d'); dc0.setTransform(1, 0, 0, 1, 0, 0); dc0.clearRect(0, 0, decalCv.width, decalCv.height); dc0.imageSmoothingEnabled = !pix;
  dc0.setTransform(S, 0, 0, S, -sc.floor.bx * S, -sc.floor.by * S);
  if (!other) for (const [x, y, rx, ry] of L.puddles) { const k = (t * 0.9 + hash1(x * 7)) % 1; const p = P(x + Math.sin(k * 20) * rx * 0.4, y); dc0.fillStyle = rgba(C.b7, 0.5 * (1 - k)); if (pix) { dc0.fillRect(Math.round(p[0] - 1 - k * 4), Math.round(p[1]), 1, 1); dc0.fillRect(Math.round(p[0] + 1 + k * 4), Math.round(p[1]), 1, 1); } else { dc0.beginPath(); dc0.ellipse(p[0], p[1], 1 + k * 4, 0.5 + k * 2, 0, 0, 6.28); dc0.strokeStyle = dc0.fillStyle; dc0.lineWidth = 0.4; dc0.stroke(); } }
  const shadow = (x, y) => { const p = P(x, y); dc0.fillStyle = 'rgba(3,4,7,0.45)'; if (pix) pxEllipse(dc0, p[0], p[1], 6, 2); else { dc0.beginPath(); dc0.ellipse(p[0], p[1], 6, 2.4, 0, 0, 6.28); dc0.fill(); } };
  decal.material.uniforms.map.value.needsUpdate = true;
  // characters
  for (const r of chars.values()) { r.used = false; r.m.visible = false; }
  if (charS !== S) { for (const r of chars.values()) { scene.remove(r.m); r.m.geometry.dispose(); } chars.clear(); charS = S; }
  const list = [];
  if (!other) for (const n of NPCS) { const an = ANIM[n.state]; list.push({ id: n.id, ch: n.char, x: n.x, y: n.y, face: n.face, state: n.state, frame: Math.floor(t * an.fps + n.x * 3) % an.n, opt: {} }); }
  list.push({ id: 'player', ch: 'detective', x: PL.x, y: PL.y, face: PL.face, state: PL.state, frame: PL.frame, opt: {} });
  if (game.eye > 0.05 && !other) { const g = ghostPos(L.ghost, ghostT); list.push({ id: 'ghost', ch: 'ghost', x: g.x, y: g.y, face: g.face, state: 'walk', frame: Math.floor(t * 10) % 8, opt: { ghost: true, alpha: game.eye * (0.55 + 0.25 * Math.sin(t * 7)) } }); }
  for (const v of list) {
    if (v.id !== 'ghost') shadow(v.x, v.y);
    const rec = charMesh(v.id), c = rec.cv.getContext('2d'); c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, rec.cv.width, rec.cv.height); c.imageSmoothingEnabled = !pix; c.setTransform(S, 0, 0, S, 0, 0);
    drawChar(c, v.ch, CW / 2, 50, v.face, v.state, v.frame, { light: 1, lightCol: lightCol(v.x, v.y), ...v.opt });
    if (v.id === 'player') { const em = PL.state === 'idle' ? emberPos('idle', PL.frame) : null; if (em) rect(c, CW / 2 + em.x * PL.face, 50 + em.y, 1, 1, C.s4); }
    placeChar(rec, v.x, v.y, v.id === 'player' ? (v.x + v.y) * 10 + 0.1 : 2e5 + (v.x + v.y)); // other characters after the silhouette pass: 2D never shows him through people
    if (v.id === 'player') { // seen through walls: drawn again only where something nearer covers him
      const s = charMesh('player', true), sctx = s.cv.getContext('2d'); sctx.setTransform(1, 0, 0, 1, 0, 0); sctx.clearRect(0, 0, s.cv.width, s.cv.height); sctx.setTransform(S, 0, 0, S, 0, 0);
      drawChar(sctx, 'detective', CW / 2, 50, PL.face, PL.state, PL.frame, { silhouette: '#39e6ff' }); placeChar(s, v.x, v.y, 1e5, 0.35); }
  }
  // lights -> shader uniforms (same lights, radii and strengths as the 2D darkness holes)
  const LIT = window.LIT3D !== false; LU.lit3d.value = LIT ? 1 : 0; LU.pix.value = pix ? 1 : 0;
  if (other) LU.dark.value.set(22 / 255, 8 / 255, 5 / 255, 0.6); else LU.dark.value.set(3 / 255, 5 / 255, 12 / 255, 0.8);
  { const c = Math.cos(-ORB.yaw), s2 = Math.sin(-ORB.yaw); LU.vdir.value.set(c - s2, s2 + c, 1).normalize(); }
  const n = Math.min(MAXL, LIGHTS.length); LU.ln.value = n; const tc = new THREE.Color();
  for (let i = 0; i < n; i++) { const l = LIGHTS[i]; LU.lp.value[i].set(l.x, l.y, l.h / 16, l.r / 22.6); tc.set(l.c); tc.lerp(new THREE.Color(1, 1, 1), 0.5); LU.lc.value[i].set(tc.r * l.s, tc.g * l.s, tc.b * l.s, 1); }
  if (LIT) { const e = emCv.getContext('2d'), f = flCv.getContext('2d'), bx = built.floor.bx, by = built.floor.by;
    for (const k of [e, f]) { k.setTransform(1, 0, 0, 1, 0, 0); k.clearRect(0, 0, emCv.width, emCv.height); k.imageSmoothingEnabled = !pix; k.setTransform(emS, 0, 0, emS, -bx * emS, -by * emS); }
    fx2d(e, false, true, f); LU.emis.value.needsUpdate = true; LU.floorEm.value.needsUpdate = true; }
  renderer.setClearColor(other ? '#0b0605' : '#030407', 1);
  renderer.render(scene, camera);
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.imageSmoothingEnabled = !pix; ctx.drawImage(glCanvas, 0, 0);
  if (LIT) { ctx.save(); ctx.setTransform(S, 0, 0, S, 0, 0); ctx.globalCompositeOperation = 'lighter'; const v = new THREE.Vector3(); // bulb halos where each light now sits on screen
    for (const l of LIGHTS) { v.set(l.x, l.y, l.h).project(camera); const big = l.kind === 'siren' ? 10 : l.kind === 'neon' ? 22 : l.kind === 'lamp' ? 10 : 7;
      glow(ctx, (v.x + 1) / 2 * NW, (1 - v.y) / 2 * NH, big, l.c, l.s * 0.9); }
    for (const nt of (other ? [] : L.neonText)) { const w = WALLMAP[nt.edge]; v.set(w.x + 0.9, w.y + 0.05, nt.z - 2).project(camera); glow(ctx, (v.x + 1) / 2 * NW, (1 - v.y) / 2 * NH, 16, COL(nt.col), flick(nt.seed, t, 0.5) ? 0.5 : 0.05); }
    ctx.restore(); }
  W(ctx);
  // ---------- everything below is the 2D demo's own overlay pass, unchanged ----------
  if (flat) { // world-space 2D lighting and effects only line up with the fixed isometric view
  drawSteam(ctx, steam, other ? C.a1 : null);
  for (const s of smoke) rect(ctx, s.x, s.y, 1, 1, rgba(C.b9, Math.sin(Math.PI * s.life / s.max) * 0.35));
  if (!LIT) {
  const dc = darkCv.getContext('2d'); dc.setTransform(1, 0, 0, 1, 0, 0); dc.globalCompositeOperation = 'source-over'; dc.clearRect(0, 0, darkCv.width, darkCv.height);
  dc.fillStyle = other ? 'rgba(22,8,5,0.6)' : 'rgba(3,5,12,0.8)'; dc.fillRect(0, 0, darkCv.width, darkCv.height);
  dc.globalCompositeOperation = 'destination-out'; W(dc);
  const hole = (x, y, rx, ry, a) => { if (pix) { [[1, 0.3], [0.66, 0.32], [0.36, 0.38]].forEach(([k, al]) => { dc.fillStyle = `rgba(0,0,0,${a * al})`; pxEllipse(dc, x, y, rx * k, ry * k); }); }
    else { dc.save(); dc.translate(x, y); dc.scale(1, ry / rx); const g = dc.createRadialGradient(0, 0, 0, 0, 0, rx); g.addColorStop(0, `rgba(0,0,0,${a})`); g.addColorStop(0.5, `rgba(0,0,0,${a * 0.55})`); g.addColorStop(1, 'rgba(0,0,0,0)'); dc.fillStyle = g; dc.fillRect(-rx, -rx, rx * 2, rx * 2); dc.restore(); } };
  for (const l of LIGHTS) { const g = P(l.x, l.y); hole(g[0], g[1], l.r, l.r * 0.5, l.s); hole(g[0], g[1] - l.h * 0.55, l.r * 0.45, l.r * 0.45, l.s * 0.55); }
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(darkCv, 0, 0); W(ctx);
  } // !LIT: 2D darkness layer; with LIT the shader lights every surface instead
  if (!LIT) fx2d(ctx, true, true);
  if (game.eye > 0.05 && !other) { ctx.save(); ctx.globalAlpha = game.eye * 0.8; onPlane(ctx, 0, c => { c.fillStyle = C.rd; const G2 = L.ghost; for (let i = 1; i < G2.length; i++) { const a = G2[i - 1], b = G2[i], len = Math.hypot(b[0] - a[0], b[1] - a[1]), n = len / 0.42 | 0; for (let k = 0; k < n; k++) { const u = k / n, nx = -(b[1] - a[1]) / len, ny = (b[0] - a[0]) / len, s = k % 2 ? 0.07 : -0.07; c.fillRect(lerp(a[0], b[0], u) + nx * s, lerp(a[1], b[1], u) + ny * s, 0.1, 0.07); } } }); ctx.restore(); drawSigil(ctx, t, game.eye); }
  if (other) drawTableau(ctx, t);
  } // flat
  ctx.setTransform(S, 0, 0, S, 0, 0);
  if (!other) drawWeather(ctx, cx, cy); else drawAsh(ctx, ash, cx * 0.3, t);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  drawFog(ctx, other ? 'ash' : 'fog', cx * 0.6 + t * 5, NH - 90, other ? 0.5 : 0.22);
  if (other) { ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = 'rgba(160,90,70,0.35)'; ctx.fillRect(0, 0, view.width, view.height); ctx.globalCompositeOperation = 'source-over'; }
  if (game.eye > 0.02) {
    ctx.globalCompositeOperation = 'saturation'; ctx.fillStyle = `rgba(128,128,128,${game.eye * 0.85})`; ctx.fillRect(0, 0, view.width, view.height);
    ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = `rgba(150,140,175,${game.eye * 0.6})`; ctx.fillRect(0, 0, view.width, view.height); ctx.globalCompositeOperation = 'source-over';
    W(ctx); ctx.save(); ctx.globalCompositeOperation = 'lighter'; drawSigil(ctx, t, game.eye); const g = ghostPos(L.ghost, ghostT); const gp = P(g.x, g.y); drawChar(ctx, 'ghost', gp[0], gp[1], g.face, 'walk', Math.floor(t * 10) % 8, { ghost: true, alpha: game.eye * 0.6 }); ctx.restore(); ctx.setTransform(1, 0, 0, 1, 0, 0);
    const sc2 = 1 + 0.03 * Math.sin(t * 2); ctx.globalAlpha = game.eye * 0.95; ctx.drawImage(inkFrame(), view.width * (1 - sc2) / 2, view.height * (1 - sc2) / 2, view.width * sc2, view.height * sc2); ctx.globalAlpha = 1;
  }
  ctx.globalAlpha = 0.85 + (1 - game.sanity / 100) * 0.15; ctx.drawImage(vignette(), 0, 0); ctx.globalAlpha = 1;
  const dpr = window.devicePixelRatio || 1; uctx.setTransform(dpr, 0, 0, dpr, 0, 0); uctx.clearRect(0, 0, cssW, cssH);
  if (game.started && !UI.open && !transitioning) { const it = nearestInteract(); if (it) { const k = cssW / NW, p = P(it.x, it.y, it.kind === 'npc' ? 40 : 18); UI.prompt((p[0] - cx) * k, (p[1] - cy) * k, 'E  ' + it.label); } }
  UI.draw(uctx, cssW, cssH, game);
}

const render2d = window.render;
window.render2d = render2d; window.render3d = render3d;
window.render = () => (window.USE2D ? render2d() : render3d());
window.ISO3D = { scene, renderer, camera, glCanvas };
