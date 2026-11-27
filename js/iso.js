'use strict';
// Saints of Ash - isometric demo engine. Reuses core.js (palette, input, audio), render.js (primitives),
// puppet.js (characters) and ui.js (dialogue, notebook, cork board). Level content lives in iso_data.js.
const L = LEVEL, HW = 16, HH = 8, WH = L.wallH, MW = L.map[0].length, MH = L.map.length;
const COL = k => k === 'bl' ? '#3f74ff' : (C[k] || k);
const isoX = (x, y) => (x - y) * HW, isoY = (x, y) => (x + y) * HH;
const P = (x, y, z = 0) => [isoX(x, y), isoY(x, y) - z];
const tileAt = (x, y) => (x < 0 || y < 0 || x >= MW || y >= MH) ? ' ' : L.map[y][x];
const roomOf = (x, y) => L.rooms[tileAt(x, y)] || null;
const groupOf = (x, y) => { const t = tileAt(x, y); return L.rooms[t] ? t : null; };
const roomAtW = (x, y) => roomOf(Math.floor(x), Math.floor(y));

// ================= canvases =================
const view = document.getElementById('view'), ui = document.getElementById('ui');
let ctx = view.getContext('2d'); const uctx = ui.getContext('2d');
let cssW = 0, cssH = 0, darkCv = null, occCv = null, silCv = null;
function layout() {
  const S = G.S; view.width = NW * S; view.height = NH * S;
  const k = Math.max(innerWidth / NW, innerHeight / NH); // cover: fill the window edge to edge, crop overflow
  cssW = Math.ceil(NW * k); cssH = Math.ceil(NH * k);
  for (const el of [view, ui]) { el.style.width = cssW + 'px'; el.style.height = cssH + 'px'; el.style.left = ((innerWidth - cssW) / 2 | 0) + 'px'; el.style.top = ((innerHeight - cssH) / 2 | 0) + 'px'; }
  view.style.imageRendering = G.mode === 'pixel' ? 'pixelated' : 'auto';
  const dpr = window.devicePixelRatio || 1; ui.width = cssW * dpr; ui.height = cssH * dpr; if (UI.resize) UI.resize(cssW, cssH, dpr);
  ctx = view.getContext('2d'); darkCv = makeCanvas(NW * S, NH * S); occCv = makeCanvas(NW * S, NH * S); silCv = makeCanvas(NW * S, NH * S);
}
addEventListener('resize', layout);
ui.addEventListener('mousedown', e => { const b = ui.getBoundingClientRect(); if (UI.handleClick) UI.handleClick(e.clientX - b.left, e.clientY - b.top); });
ui.addEventListener('mousemove', e => { const b = ui.getBoundingClientRect(); if (UI.handleMove) UI.handleMove(e.clientX - b.left, e.clientY - b.top); });

// ================= drawing helpers (absolute iso screen coords) =================
function quad(c, pts, col) { c.fillStyle = col; c.beginPath(); c.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]); c.closePath(); c.fill(); }
// box: footprint x0..x1, y0..y1, heights z0..z1. visible faces: top, +y (south-west, "fy"), +x (south-east, "fx")
function box(c, x0, y0, x1, y1, z0, z1, top, fy, fx) {
  if (fy) quad(c, [P(x0, y1, z0), P(x1, y1, z0), P(x1, y1, z1), P(x0, y1, z1)], fy);
  if (fx) quad(c, [P(x1, y1, z0), P(x1, y0, z0), P(x1, y0, z1), P(x1, y1, z1)], fx);
  if (top) quad(c, [P(x0, y0, z1), P(x1, y0, z1), P(x1, y1, z1), P(x0, y1, z1)], top);
}
const faceY = (x0, x1, y) => (u, z) => P(x0 + (x1 - x0) * u, y, z);   // a face on the +y side, u along x
const faceX = (y0, y1, x) => (u, z) => P(x, y0 + (y1 - y0) * u, z);   // a face on the +x side, u along y
function fq(c, F, u0, u1, z0, z1, col) { quad(c, [F(u0, z0), F(u1, z0), F(u1, z1), F(u0, z1)], col); }
function fline(c, F, u0, z0, u1, z1, col) { const a = F(u0, z0), b = F(u1, z1); line(c, a[0], a[1], b[0], b[1], col); }
function fdot(c, F, u, z, w, h, col) { const a = F(u, z); rect(c, a[0], a[1], w, h, col); }
// world-plane drawing (floor decals): transform so (x,y) world maps to iso screen at height z
function onPlane(c, z, fn) { c.save(); c.translate(0, -z); c.transform(HW, HH, -HW, HH, 0, 0); fn(c); c.restore(); }
function ellipseW(c, x, y, rx, ry, col) { c.fillStyle = col; c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, 6.2832); c.fill(); }
function pxEllipse(c, cx, cy, rx, ry) { // crisp filled ellipse in current (screen-aligned) transform
  cx = Math.round(cx); cy = Math.round(cy); const n = Math.max(1, Math.round(ry));
  for (let dy = -n; dy <= n; dy++) { const w = Math.round(rx * Math.sqrt(Math.max(0, 1 - (dy / ry) ** 2))); if (w > 0) c.fillRect(cx - w, cy + dy, w * 2, 1); }
}
// tiny stroke font (4x6 grid)
const FONT = {
  M: [[0, 6, 0, 0, 2, 3, 4, 0, 4, 6]], O: [[0, 0, 4, 0, 4, 6, 0, 6, 0, 0]], T: [[0, 0, 4, 0], [2, 0, 2, 6]], E: [[4, 0, 0, 0, 0, 6, 4, 6], [0, 3, 3, 3]],
  L: [[0, 0, 0, 6, 4, 6]], V: [[0, 0, 2, 6, 4, 0]], A: [[0, 6, 0, 2, 2, 0, 4, 2, 4, 6], [0, 4, 4, 4]], C: [[4, 0, 0, 0, 0, 6, 4, 6]],
  N: [[0, 6, 0, 0, 4, 6, 4, 0]], Y: [[0, 0, 2, 3, 4, 0], [2, 3, 2, 6]], F: [[4, 0, 0, 0, 0, 6], [0, 3, 3, 3]], I: [[2, 0, 2, 6], [1, 0, 3, 0], [1, 6, 3, 6]],
  S: [[4, 0, 0, 0, 0, 3, 4, 3, 4, 6, 0, 6]], D: [[0, 0, 3, 0, 4, 2, 4, 4, 3, 6, 0, 6, 0, 0]], 4: [[3, 6, 3, 0, 0, 4, 4, 4]],
  5: [[4, 0, 0, 0, 0, 3, 4, 3, 4, 6, 0, 6]], 6: [[4, 0, 0, 0, 0, 6, 4, 6, 4, 3, 0, 3]], ' ': [],
};
// text on a face: F(u,z). u0 start, du per glyph unit, z top, dz per glyph unit (down)
function faceText(c, F, str, u0, du, zTop, dz, col, vertical) {
  [...str].forEach((ch, i) => { const g = FONT[ch] || []; for (const s of g) for (let k = 0; k < s.length - 2; k += 2) {
    const ox = vertical ? 0 : i * 5.6, oy = vertical ? i * 8 : 0;
    fline(c, F, u0 + (s[k] + ox) * du, zTop - (s[k + 1] + oy) * dz, u0 + (s[k + 2] + ox) * du, zTop - (s[k + 3] + oy) * dz, col); } });
}

// ================= baking (static sprites, both worlds) =================
function remapOther(cv, ox, oy, S) { // like otherRemap() but in world-continuous coordinates
  const c = cv.getContext('2d'), im = c.getImageData(0, 0, cv.width, cv.height), d = im.data, W = cv.width, n = RUST.length - 1, pix = G.mode === 'pixel';
  for (let i = 0, p = 0; i < d.length; i += 4, p++) {
    if (d[i + 3] < 10) continue;
    const px = p % W, py = (p / W) | 0, x = ox + px / S, y = oy + py / S;
    let lum = (0.3 * d[i] + 0.59 * d[i + 1] + 0.11 * d[i + 2]) / 255; const mx = Math.max(d[i], d[i + 1], d[i + 2]), mn = Math.min(d[i], d[i + 1], d[i + 2]);
    if (mx - mn > 110 && lum > 0.3) lum *= 0.55;
    const rot = fbm(x / 38, y / 30, 3), streak = vnoise(x / 3, y / 60, 8);
    lum = lum * 1.25 + 0.03; if (rot > 0.6) lum *= 0.45; else if (rot > 0.57) lum = lum * 0.8 + 0.18; lum -= Math.max(0, streak - 0.62) * 0.9; lum = clamp(lum, 0, 1);
    if (pix) { const q = RUST[clamp(Math.round(lum * n * 1.15 + (bayer(px, py) - 0.5) * 0.9), 0, n)]; d[i] = q[0]; d[i + 1] = q[1]; d[i + 2] = q[2]; }
    else { const f = clamp(lum * n * 1.15, 0, n), i0 = Math.floor(f), i1 = Math.min(n, i0 + 1), t = f - i0, a = RUST[i0], b = RUST[i1]; d[i] = lerp(a[0], b[0], t); d[i + 1] = lerp(a[1], b[1], t); d[i + 2] = lerp(a[2], b[2], t); }
  }
  c.putImageData(im, 0, 0);
}
function bakeBox(bx, by, bw, bh, draw, dither = 10) {
  const S = G.S; bx = Math.floor(bx / 4) * 4; by = Math.floor(by / 4) * 4; bw = Math.ceil(bw) + 8; bh = Math.ceil(bh) + 8;
  const cv = makeCanvas(bw * S, bh * S), c = cv.getContext('2d'); c.scale(S, S); c.translate(-bx, -by); draw(c);
  postStatic(cv, { dither });
  const o = makeCanvas(cv.width, cv.height); o.getContext('2d').drawImage(cv, 0, 0); remapOther(o, bx, by, S);
  return { cv, cvO: o, bx, by, bw, bh };
}
function fpBounds(x0, y0, x1, y1, z0, z1) {
  const pts = [P(x0, y0, z1), P(x1, y0, z1), P(x0, y1, z1), P(x1, y1, z0), P(x0, y1, z0), P(x1, y0, z0)];
  const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
  return [Math.min(...xs) - 3, Math.min(...ys) - 3, Math.max(...xs) - Math.min(...xs) + 6, Math.max(...ys) - Math.min(...ys) + 6];
}

// ================= walls =================
const WALLS = []; const WALLMAP = {};
(function genWalls() {
  for (let y = 0; y <= MH; y++) for (let x = 0; x <= MW; x++) {
    for (const dir of ['N', 'W']) {
      const ax = dir === 'W' ? x - 1 : x, ay = dir === 'N' ? y - 1 : y;
      const gA = groupOf(ax, ay), gB = groupOf(x, y); if (gA === gB || !(gA || gB)) continue;
      const key = `${dir}:${x},${y}`; const w = { key, dir, x, y, minus: roomOf(ax, ay), plus: roomOf(x, y), plusG: gB, door: L.doors.includes(key), feat: L.features[key] || '' };
      WALLS.push(w); WALLMAP[key] = w;
    }
  }
})();
const wallBlocks = key => { const w = WALLMAP[key]; return w && !w.door; };
const MAT = {
  O: { face: '#553833', alt: '#3d2a29', top: '#6e4a3f' }, 5: { face: '#52463f', alt: '#3b3433', top: '#6e5d4e' },
  6: { face: '#2d3b37', alt: '#1f2a28', top: '#41524c' }, b: { face: '#b3ad9f', alt: '#7d7870', top: '#d8d2c2' },
  ext: { face: '#41524c', alt: '#2d3b37', top: '#62736b' },
};
function drawWall(c, w, h) {
  const m = MAT[w.plusG] || MAT.ext, ext = !w.plusG, T = 0.05;
  const N = w.dir === 'N'; const F = N ? faceY(w.x, w.x + 1, w.y + T) : faceX(w.y, w.y + 1, w.x + T);
  const seg = (u0, u1, z0, z1) => { if (N) box(c, w.x + u0, w.y - T, w.x + u1, w.y + T, z0, z1, m.top, m.face, m.alt); else box(c, w.x - T, w.y + u0, w.x + T, w.y + u1, z0, z1, m.top, m.alt, m.face); };
  const isDoor = w.feat.startsWith('door');
  if (h < WH) { // cutaway stub
    if (isDoor && w.feat !== 'door_locked:4') { seg(0, 0.2, 0, h); seg(0.8, 1, 0, h); } else seg(0, 1, 0, h);
    return;
  }
  seg(0, 1, 0, h);
  const r = mulberry32(w.x * 31 + w.y * 7 + (N ? 1 : 2));
  const shade = N ? 'rgba(0,0,0,0.12)' : 'rgba(0,0,0,0)'; fq(c, F, 0, 1, 0, h, shade);
  // material detail
  if (ext) {
    fq(c, F, 0, 1, 0, 6, '#3d2a29'); fq(c, F, 0, 1, 6, 7, '#553833'); fq(c, F, 0, 1, h - 4, h, '#62736b'); fq(c, F, 0, 1, h - 5, h - 4, '#1f2a28');
    for (let i = 0; i < 3; i++) { const u = r(); fline(c, F, u, h - 5, u + (r() - 0.5) * 0.05, h - 12 - r() * 16, 'rgba(18,24,39,0.6)'); }
    if (r() < 0.5) { const u = 0.1 + r() * 0.8; fline(c, F, u, 12 + r() * 10, u + 0.06, 20 + r() * 12, 'rgba(18,24,39,0.5)'); }
  } else if (w.plusG === 'O') { for (let u = 0.0625; u < 1; u += 0.125) fline(c, F, u, 0, u, h, 'rgba(43,31,34,0.8)'); fq(c, F, 0, 1, 0, 4, '#2b1f22'); }
  else if (w.plusG === '5') { for (let u = 0.05; u < 1; u += 0.1) for (let z = 6; z < h - 2; z += 7) fdot(c, F, u + ((z / 7) % 2) * 0.05, z, 1, 1, '#6e5d4e'); fq(c, F, 0, 1, 0, 3, '#2a2629'); fq(c, F, 0, 1, 26, 27, '#3b3433'); }
  else if (w.plusG === '6') { for (let u = 0.08; u < 1; u += 0.16) for (let z = 7; z < h - 3; z += 8) { fdot(c, F, u, z, 1, 1, '#9c7330'); fdot(c, F, u + 0.08, z + 4, 1, 1, '#41524c'); } fq(c, F, 0, 1, 0, 3, '#1f2a28');
    if (r() < 0.6) { const u = 0.2 + r() * 0.5; fq(c, F, u, u + 0.25, h - 14, h - 2, 'rgba(110,93,78,0.35)'); } }
  else if (w.plusG === 'b') { for (let u = 0; u <= 1; u += 0.125) fline(c, F, u, 0, u, 26, '#7d7870'); for (let z = 0; z <= 26; z += 4) fline(c, F, 0, z, 1, z, '#7d7870'); fq(c, F, 0, 1, 26, h, '#6a7d9c'); }
  // features
  const [feat, label] = w.feat.split(':');
  if (feat === 'door' || feat === 'door_tape' || feat === 'door_in') {
    fq(c, F, 0.2, 0.8, 0, 30, '#07080d'); fq(c, F, 0.2, 0.24, 0, 30, '#6a7d9c'); fq(c, F, 0.76, 0.8, 0, 30, '#6a7d9c'); fq(c, F, 0.2, 0.8, 30, 32, '#6a7d9c');
    if (feat !== 'door_in') { fq(c, F, 0.25, 0.38, 0, 29, '#6e4a3f'); fq(c, F, 0.25, 0.27, 0, 29, '#8e7b66'); } // door leaf, swung in
    if (label) { fq(c, F, 0.4, 0.6, 33, 38, '#9c7330'); if (label.length === 1) faceText(c, F, label, 0.47, 0.016, 37.5, 0.6, '#07080d'); }
    if (feat === 'door_tape') { fline(c, F, 0.18, 26, 0.82, 10, '#e8a95a'); fline(c, F, 0.18, 10, 0.82, 24, '#d9b25a'); fline(c, F, 0.18, 18, 0.82, 17, '#e8a95a'); }
  } else if (feat === 'door_locked') {
    fq(c, F, 0.2, 0.8, 0, 30, '#553833'); fq(c, F, 0.2, 0.24, 0, 30, '#6a7d9c'); fq(c, F, 0.76, 0.8, 0, 30, '#6a7d9c'); fq(c, F, 0.3, 0.7, 18, 26, '#3d2a29'); fq(c, F, 0.3, 0.7, 4, 14, '#3d2a29'); fdot(c, F, 0.68, 15, 1, 1, '#d9b25a');
    fq(c, F, 0.4, 0.6, 33, 38, '#9c7330'); faceText(c, F, label, 0.47, 0.016, 37.5, 0.6, '#07080d');
  } else if (feat.startsWith('win')) {
    const big = feat === 'win_office'; const u0 = big ? 0.06 : 0.18, u1 = big ? 0.94 : 0.82, z0 = big ? 8 : 12, z1 = big ? 32 : 30;
    fq(c, F, u0 - 0.03, u1 + 0.03, z0 - 2, z1 + 2, '#8b9cb8');
    const glass = feat === 'win_office' ? '#e8a95a' : feat === 'win_lit' ? '#c07a35' : feat === 'win_tv' ? '#1a8fb3' : '#0c0f18';
    fq(c, F, u0, u1, z0, z1, glass);
    if (big) { for (let z = z0 + 2; z < z1; z += 3) fq(c, F, u0, u1, z, z + 1, 'rgba(138,90,43,0.8)'); fq(c, F, u0, u1, z1 - 4, z1, '#8a5a2b'); }
    else { fq(c, F, u0, u0 + 0.2, z0, z1, feat === 'win_dark' ? '#2b1f22' : '#8a5a2b'); fq(c, F, u1 - 0.2, u1, z0, z1, feat === 'win_dark' ? '#2b1f22' : '#8a5a2b');
      if (feat === 'win_dark') fline(c, F, u0 + 0.22, z1 - 2, u0 + 0.4, z0 + 6, '#3b4a68'); }
    fq(c, F, u0 - 0.04, u1 + 0.04, z0 - 3, z0 - 2, '#b7c3d6');
  } else if (feat === 'ac') {
    fq(c, F, 0.3, 0.72, 10, 20, '#7d7870'); for (let z = 11; z < 20; z += 2) fq(c, F, 0.33, 0.69, z, z + 1, '#3b3433'); fq(c, F, 0.3, 0.72, 20, 21, '#b3ad9f');
    fline(c, F, 0.5, 10, 0.52, 0, 'rgba(18,24,39,0.7)');
  } else if (feat === 'board') {
    fq(c, F, 0.06, 0.94, 12, 34, '#73391f'); fq(c, F, 0.06, 0.94, 33, 34, '#4a2416'); fq(c, F, 0.06, 0.94, 12, 13, '#4a2416');
    [[0.15, 30], [0.42, 28], [0.7, 31], [0.25, 21], [0.6, 20]].forEach(([u, z]) => { fq(c, F, u, u + 0.13, z - 7, z, '#f2eee4'); fq(c, F, u + 0.02, u + 0.11, z - 5, z - 1, '#3b4a68'); });
    fline(c, F, 0.2, 27, 0.65, 18, '#ff2a2a');
  } else if (feat === 'keys') { fq(c, F, 0.2, 0.8, 22, 30, '#3d2a29'); for (let u = 0.25; u < 0.8; u += 0.09) { fdot(c, F, u, 28, 1, 1, '#d9b25a'); if (r() < 0.7) fdot(c, F, u, 26, 1, 2, '#d9b25a'); } }
  else if (feat === 'mirror') { fq(c, F, 0.3, 0.9, 18, 34, '#7d7870'); fq(c, F, 0.33, 0.87, 19, 33, '#8b9cb8'); fline(c, F, 0.4, 31, 0.6, 21, '#b7c3d6'); }
  else if (feat === 'painting') { fq(c, F, 0.25, 0.95, 22, 34, '#9c7330'); fq(c, F, 0.28, 0.92, 23, 33, '#2e3a56'); fq(c, F, 0.28, 0.92, 23, 27, '#1a8fb3'); fdot(c, F, 0.7, 31, 2, 1, '#f6d79a'); }
  else if (feat === 'painting_r5') { fq(c, F, 0.3, 0.8, 22, 33, '#3b3433'); fq(c, F, 0.33, 0.77, 23, 32, '#41524c'); fline(c, F, 0.33, 25, 0.77, 30, '#62736b'); }
  else if (feat === 'hole') { const a = F(0.5, 24); rect(c, a[0], a[1], 2, 2, '#07080d'); rect(c, a[0] - 1, a[1] + 2, 4, 1, '#3b3433'); }
}

// ================= props =================
const PROPDRAW = {
  car(c, o, body, bodyD, roof, glass, extra) {
    const { x0, y0, x1, y1 } = o; const L = y1 - y0;
    // wheels
    for (const v of [0.18, 0.82]) { const a = P(x1 - 0.02, y0 + L * v, 3); disc(c, a[0], a[1], 3, '#07080d'); rect(c, a[0], a[1], 1, 1, '#7d7870'); }
    box(c, x0, y0, x1, y1, 3, 10, body, bodyD, body);
    box(c, x0 + 0.04, y0 + L * 0.3, x1 - 0.04, y1 - L * 0.2, 10, 17, roof, glass, glass);
    const Fx = faceX(y0 + L * 0.3, y1 - L * 0.2, x1 - 0.04); fq(c, Fx, 0.48, 0.52, 10, 17, roof); fline(c, Fx, 0.1, 16, 0.35, 11, '#4d5f80');
    const Fy = faceY(x0 + 0.04, x1 - 0.04, y1 - L * 0.2); fline(c, Fy, 0.15, 16, 0.6, 11, '#4d5f80');
    const Fr = faceY(x0, x1, y1); fq(c, Fr, 0.05, 0.22, 6, 8, '#8a1020'); fq(c, Fr, 0.78, 0.95, 6, 8, '#8a1020'); fq(c, Fr, 0.38, 0.62, 4, 6, '#b3ad9f');
    const Fs = faceX(y0, y1, x1); fline(c, Fs, 0.05, 9, 0.95, 9, rgba('#b7c3d6', 0.35)); fline(c, Fs, 0.5, 4, 0.5, 9, rgba('#07080d', 0.6));
    if (extra) extra(c, Fs, Fr);
  },
  cruiser(c, o) {
    PROPDRAW.car(c, o, '#121827', '#0c0f18', '#d8d2c2', '#1a2236', (c, Fs) => { fq(c, Fs, 0.3, 0.72, 4, 9, '#d8d2c2'); fq(c, Fs, 0.3, 0.72, 4, 5, '#7d7870'); fdot(c, Fs, 0.46, 7, 3, 1, '#121827'); });
    const yc = (o.y0 + o.y1) / 2; box(c, o.x0 + 0.1, yc - 0.12, o.x1 - 0.1, yc + 0.08, 17, 19, '#2e3a56', '#232d45', '#232d45');
  },
  sedan(c, o) { PROPDRAW.car(c, o, '#4a0a14', '#2b1f22', '#3d2a29', '#0c0f18', (c, Fs) => { fline(c, Fs, 0.05, 6, 0.95, 6, '#8a1020'); }); },
  wagon(c, o) { PROPDRAW.car(c, o, '#6e5d4e', '#3b3433', '#8e7b66', '#121827', (c, Fs) => { fq(c, Fs, 0.06, 0.94, 4, 8, '#73391f'); fq(c, Fs, 0.06, 0.94, 7, 8, '#a35a30'); fdot(c, Fs, 0.7, 5, 2, 1, '#a35a30'); }); },
  lamp(c, o) { const { x, y } = o; box(c, x - 0.05, y - 0.05, x + 0.05, y + 0.05, 0, 54, '#4d5f80', '#232d45', '#2e3a56'); box(c, x - 0.08, y - 0.08, x + 0.08, y + 0.08, 0, 4, '#3b4a68', '#1a2236', '#232d45');
    box(c, x - 0.16, y - 0.16, x + 0.16, y + 0.16, 54, 57, '#3b4a68', '#1a2236', '#232d45'); const a = P(x, y, 53); rect(c, a[0] - 2, a[1], 5, 1, '#f6d79a'); },
  sign(c, o) { const { x, y } = o; box(c, x - 0.07, y - 0.07, x + 0.07, y + 0.07, 0, 112, '#3b4a68', '#1a2236', '#232d45');
    box(c, x + 0.05, y - 0.6, x + 0.17, y + 0.6, 48, 110, '#232d45', '#121827', '#1a2236'); const F = faceX(y - 0.6, y + 0.6, x + 0.17);
    fq(c, F, 0.06, 0.94, 50, 108, '#0c0f18'); signLetters(c, x, y, false);
    box(c, x + 0.05, y - 0.75, x + 0.17, y + 0.75, 32, 45, '#232d45', '#121827', '#1a2236'); fq(c, faceX(y - 0.75, y + 0.75, x + 0.17), 0.04, 0.96, 33.5, 43.5, '#0c0f18'); },
  booth(c, o) { const { x0, y0, x1, y1 } = o; box(c, x0, y0, x1, y1, 0, 36, '#7d7870', null, null);
    const Fy = faceY(x0, x1, y1), Fx = faceX(y0, y1, x1); box(c, x0, y0, x1, y1, 0, 34, null, 'rgba(77,95,128,0.5)', 'rgba(106,125,156,0.45)');
    fq(c, Fy, 0, 0.07, 0, 34, '#7d7870'); fq(c, Fy, 0.93, 1, 0, 34, '#7d7870'); fq(c, Fx, 0, 0.07, 0, 34, '#7d7870'); fq(c, Fx, 0.93, 1, 0, 34, '#7d7870'); fq(c, Fx, 0, 1, 30, 34, '#b7c3d6');
    box(c, x0 + 0.1, y0, x0 + 0.35, y0 + 0.12, 14, 24, '#232d45', '#121827', '#1a2236'); line(c, ...P(x0 + 0.3, y0 + 0.2, 20), ...P(x0 + 0.32, y0 + 0.35, 8), '#07080d'); const h = P(x0 + 0.32, y0 + 0.35, 7); rect(c, h[0] - 1, h[1], 3, 2, '#07080d'); },
  ice(c, o) { const { x0, y0, x1, y1 } = o; box(c, x0, y0, x1, y1, 0, 22, '#b3ad9f', '#7d7870', '#8b9cb8'); const F = faceY(x0, x1, y1); fq(c, F, 0.15, 0.85, 4, 13, '#1a2236'); fq(c, F, 0.15, 0.85, 15, 20, '#0f4a63'); },
  dumpster(c, o) { const { x0, y0, x1, y1 } = o; box(c, x0, y0, x1, y1, 0, 13, '#41524c', '#1f2a28', '#2d3b37'); box(c, x0 - 0.03, y0 - 0.03, x1 + 0.03, y1 + 0.03, 13, 15, '#62736b', '#2d3b37', '#2d3b37');
    const F = faceX(y0, y1, x1); for (let u = 0.15; u < 1; u += 0.17) fline(c, F, u, 2, u, 12, '#1f2a28'); },
  bags(c, o) { const r = mulberry32(4); for (let i = 0; i < 4; i++) { const a = P(o.x0 + r() * 0.6, o.y0 + r() * 0.7, 0); disc(c, a[0], a[1] - 3, 3 + r() * 2, i % 2 ? '#0c0f18' : '#121827'); rect(c, a[0] - 1, a[1] - 6, 2, 1, '#2e3a56'); } },
  counter(c, o) { const { x0, y0, x1, y1 } = o; box(c, x0, y0, x1, y1, 0, 13, '#8e7b66', '#553833', '#6e4a3f'); const F = faceY(x0, x1, y1); for (let u = 0.1; u < 1; u += 0.2) fline(c, F, u, 1, u, 12, '#3d2a29');
    const b = P(x0 + 0.95, y0 + 0.25, 13); quad(c, [P(x0 + 0.75, y0 + 0.15, 13), P(x0 + 1.15, y0 + 0.15, 13), P(x0 + 1.15, y0 + 0.4, 13), P(x0 + 0.75, y0 + 0.4, 13)], '#f2eee4'); line(c, b[0] - 1, b[1] - 1, b[0] + 2, b[1] + 1, '#8a1020');
    const bell = P(x0 + 0.3, y0 + 0.25, 13); disc(c, bell[0], bell[1] - 1, 1.5, '#d9b25a'); },
  bed(c, o) { const { x0, y0, x1, y1, sheet } = o; box(c, x0, y0, x1, y0 + 0.1, 0, 20, '#6e4a3f', '#3d2a29', '#553833');
    box(c, x0, y0 + 0.1, x1, y1, 0, 6, '#3d2a29', '#2b1f22', '#3d2a29');
    const sc = sheet === 'lilies' ? '#d8d2c2' : '#b3ad9f'; box(c, x0 + 0.04, y0 + 0.1, x1 - 0.04, y1 - 0.02, 6, 10, sc, '#7d7870', '#8b9cb8');
    for (const px of [x0 + 0.12, x0 + 0.92]) box(c, px, y0 + 0.14, px + 0.66, y0 + 0.45, 10, 12, '#f2eee4', '#b3ad9f', '#d8d2c2');
    if (sheet === 'tucked') { onPlane(c, 10, c => { c.fillStyle = 'rgba(125,120,112,0.7)'; for (let i = 0; i < 4; i++) c.fillRect(x0 + 0.1, y0 + 0.7 + i * 0.22, x1 - x0 - 0.2, 0.03); }); }
    else { onPlane(c, 10, c => { c.fillStyle = 'rgba(110,93,78,0.45)'; c.beginPath(); c.ellipse((x0 + x1) / 2, (y0 + y1) / 2 + 0.25, 0.32, 0.6, 0, 0, 6.28); c.fill();
      const r = mulberry32(12); for (let i = 0; i < 20; i++) { const a = i / 20 * 6.283, rx = (x0 + x1) / 2 + Math.cos(a) * 0.55, ry = y0 + 0.35 + Math.sin(a) * 0.28; c.fillStyle = r() < 0.2 ? '#41524c' : '#f2eee4'; c.fillRect(rx, ry, 0.09, 0.06); }
      c.fillStyle = '#d9b25a'; for (let i = 0; i < 8; i++) c.fillRect(x0 + 0.3 + r() * 1.1, y0 + 0.9 + r() * 0.6, 0.05, 0.04); }); } },
  chair(c, o) { const { x0, y0, x1, y1 } = o; box(c, x0, y0, x1, y1, 5, 8, '#6e4a3f', '#3d2a29', '#553833'); box(c, x0, y0, x1, y0 + 0.08, 8, 17, '#6e4a3f', '#3d2a29', '#553833');
    for (const [a, b] of [[x1 - 0.04, y1 - 0.04], [x0 + 0.04, y1 - 0.04], [x1 - 0.04, y0 + 0.04]]) box(c, a - 0.03, b - 0.03, a + 0.03, b + 0.03, 0, 5, null, '#2b1f22', '#3d2a29'); },
  nightstand(c, o) { const { x0, y0, x1, y1 } = o; box(c, x0, y0, x1, y1, 0, 10, '#6e4a3f', '#3d2a29', '#553833'); const xc = (x0 + x1) / 2, yc = (y0 + y1) / 2;
    box(c, xc - 0.05, yc - 0.05, xc + 0.05, yc + 0.05, 10, 15, '#d9b25a', '#9c7330', '#9c7330'); box(c, xc - 0.17, yc - 0.17, xc + 0.17, yc + 0.17, 15, 21, '#f6d79a', '#c07a35', '#e8a95a'); },
  dresser(c, o) { const { x0, y0, x1, y1 } = o; box(c, x0, y0, x1, y1, 0, 12, '#553833', '#2b1f22', '#3d2a29'); const F = faceX(y0, y1, x1); for (const z of [4, 8]) fline(c, F, 0.05, z, 0.95, z, '#2b1f22');
    box(c, x0 + 0.03, y0 + 0.2, x1 - 0.08, y1 - 0.2, 12, 23, '#2a2629', '#1c1a1f', '#1c1a1f'); fq(c, faceX(y0 + 0.2, y1 - 0.2, x1 - 0.08), 0.1, 0.9, 13.5, 21.5, '#0f4a63'); },
  tub(c, o) { const { x0, y0, x1, y1 } = o; box(c, x0, y0, x1, y1, 0, 10, '#f2eee4', '#b3ad9f', '#d8d2c2'); quad(c, [P(x0 + 0.08, y0 + 0.08, 10), P(x1 - 0.08, y0 + 0.08, 10), P(x1 - 0.08, y1 - 0.08, 10), P(x0 + 0.08, y1 - 0.08, 10)], '#8b9cb8');
    onPlane(c, 10, c => { c.fillStyle = '#f2eee4'; const r = mulberry32(3); for (let i = 0; i < 6; i++) c.fillRect(x0 + 0.15 + r() * 0.5, y0 + 0.2 + r() * 0.8, 0.08, 0.05); }); },
  sink(c, o) { const { x0, y0, x1, y1 } = o; const xc = (x0 + x1) / 2; box(c, xc - 0.07, y0, xc + 0.07, y0 + 0.14, 0, 11, null, '#b3ad9f', '#d8d2c2'); box(c, x0, y0, x1, y1, 11, 15, '#d8d2c2', '#b3ad9f', '#d8d2c2');
    const a = P(xc, (y0 + y1) / 2 + 0.03, 15); disc(c, a[0], a[1], 2, '#8b9cb8'); rect(c, a[0] - 1, a[1], 1, 1, '#d9b25a'); rect(c, a[0] + 1, a[1] - 1, 1, 1, '#d9b25a'); },
  poolsign(c, o) { const { x, y } = o; box(c, x - 0.03, y - 0.03, x + 0.03, y + 0.03, 0, 22, '#7d7870', '#3b3433', '#52463f'); box(c, x - 0.04, y - 0.45, x + 0.04, y + 0.45, 14, 24, '#b3ad9f', '#7d7870', '#d8d2c2');
    faceText(c, faceX(y - 0.45, y + 0.45, x + 0.04), 'CLOSED', 0.08, 0.026, 22, 1.05, '#8a1020'); },
  lounger(c, o) { const { x0, y0, x1, y1 } = o; box(c, x0, y0, x1, y1, 4, 6, '#b3ad9f', '#7d7870', '#8b9cb8'); for (let v = 0.1; v < 1; v += 0.18) onPlane(c, 6, c => { c.fillStyle = '#41524c'; c.fillRect(x0 + 0.05, y0 + (y1 - y0) * v, x1 - x0 - 0.1, 0.06); });
    box(c, x0, y0, x1, y0 + 0.08, 4, 13, '#b3ad9f', '#7d7870', '#8b9cb8'); for (const [a, b] of [[x1 - 0.04, y1 - 0.04], [x0 + 0.04, y1 - 0.04]]) box(c, a - 0.02, b - 0.02, a + 0.02, b + 0.02, 0, 4, null, '#3b3433', '#52463f'); },
};
function signLetters(c, x, y, lit, t = 0) {
  const F = faceX(y - 0.6, y + 0.6, x + 0.17), F2 = faceX(y - 0.75, y + 0.75, x + 0.17);
  const on = lit ? flick(3, t, 0.6) : false, pink = lit ? (on ? '#ff3d8b' : 'rgba(255,61,139,0.25)') : 'rgba(255,61,139,0.22)';
  faceText(c, F, 'MOTEL', 0.33, 0.085, 104, 1.45, pink, true);
  const vac = lit ? (flick(17, t, 1.6) ? '#ff2a2a' : 'rgba(255,42,42,0.2)') : 'rgba(255,42,42,0.2)';
  faceText(c, F2, 'VACANCY', 0.08, 0.0215, 42, 1.25, vac);
  if (lit) for (let i = 0; i < 14; i++) { const u = 0.08 + (i / 13) * 0.84, onB = ((i + Math.floor(t * 6)) % 3) === 0; fdot(c, F, u, 51, 1, 1, onB ? '#f6d79a' : 'rgba(246,215,154,0.25)'); fdot(c, F, u, 107, 1, 1, onB ? '#f6d79a' : 'rgba(246,215,154,0.25)'); }
}

// ================= scene build =================
const SCENE = { byMode: {} };
const FX = -MH * HW - 16, FY = -24, FW = (MW + MH) * HW + 32, FH = (MW + MH) * HH + 56;
function propFootprint(o) { if (o.x0 !== undefined) return [o.x0, o.y0, o.x1, o.y1]; return [o.x - 0.12, o.y - 0.12, o.x + 0.12, o.y + 0.12]; }
const PROPZ = { lamp: 60, sign: 114, booth: 38, ice: 24, dumpster: 16, counter: 16, bed: 22, chair: 18, nightstand: 22, dresser: 24, tub: 12, sink: 16, poolsign: 26, lounger: 14, cruiser: 20, sedan: 18, wagon: 18, bags: 9 };
const SOLIDS = L.props.filter(o => o.solid).map(o => { const f = propFootprint(o); if (o.t === 'sign') return [o.x - 0.12, o.y - 0.12, o.x + 0.2, o.y + 0.12]; return f; });
const ROOFED = []; for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) if (roomOf(x, y)) ROOFED.push([x, y]);

function buildScene() {
  const key = G.mode; if (SCENE.byMode[key]) return SCENE.byMode[key];
  const items = [];
  // floor
  const floor = bakeBox(FX, FY, FW, FH, drawFloor, 16);
  // walls
  for (const w of WALLS) {
    const N = w.dir === 'N', fp = N ? [w.x, w.y - 0.04, w.x + 1, w.y + 0.04] : [w.x - 0.04, w.y, w.x + 0.04, w.y + 1];
    const b = fpBounds(fp[0], fp[1], fp[2], fp[3], 0, WH + 2);
    const full = bakeBox(b[0], b[1], b[2], b[3], c => drawWall(c, w, WH));
    const cutRoom = w.minus; // a wall hides the room on its minus side, so it is cut away while you are in there
    const stub = cutRoom ? bakeBox(b[0], b[1], b[2], b[3], c => drawWall(c, w, 6)) : null;
    items.push({ kind: 'wall', fp, key: (fp[0] + fp[2]) / 2 + (fp[1] + fp[3]) / 2, full, stub, cutRoom, w });
  }
  // fences
  const fence = (x0, y0, x1, y1, faceFn) => { const b = fpBounds(x0, y0, x1, y1, 0, 30);
    items.push({ kind: 'prop', fp: [x0, y0, x1, y1], key: (x0 + x1) / 2 + (y0 + y1) / 2, full: bakeBox(b[0], b[1], b[2], b[3], c => {
      box(c, x0, y0, x0 + 0.06, y0 + 0.06, 0, 30, '#7d7870', '#3b3433', '#52463f');
      const F = faceFn(); for (let u = 0; u < 1; u += 0.09) { fline(c, F, u, 0, u + 0.2, 28, 'rgba(125,120,112,0.45)'); fline(c, F, u + 0.2, 0, u, 28, 'rgba(125,120,112,0.35)'); }
      fline(c, F, 0, 28, 1, 28, '#7d7870'); fline(c, F, 0, 1, 1, 1, '#52463f'); }) }); };
  for (let x = L.fences.north[0]; x < L.fences.north[1]; x++) fence(x, 0.02, x + 1, 0.08, () => faceY(x, x + 1, 0.08));
  for (let y = L.fences.east[0]; y < L.fences.east[1]; y++) fence(MW - 0.08, y, MW - 0.02, y + 1, () => faceX(y, y + 1, MW - 0.02));
  // props
  for (const o of L.props) { const fp = propFootprint(o); const z = PROPZ[o.t] || 20; let b = fpBounds(fp[0], fp[1], fp[2], fp[3], 0, z);
    if (o.t === 'sign') b = fpBounds(o.x - 0.1, o.y - 0.8, o.x + 0.2, o.y + 0.8, 0, z);
    const sfp = o.t === 'sign' ? [o.x - 0.1, o.y - 0.12, o.x + 0.2, o.y + 0.12] : fp;
    items.push({ kind: 'prop', t: o.t, fp: sfp, key: (sfp[0] + sfp[2]) / 2 + (sfp[1] + sfp[3]) / 2, full: bakeBox(b[0], b[1], b[2], b[3], c => PROPDRAW[o.t](c, o)), o, room: roomAtW((fp[0] + fp[2]) / 2, (fp[1] + fp[3]) / 2) }); }
  // roofs (one per tile so depth sorting stays simple)
  for (const [x, y] of ROOFED) {
    const rm = roomOf(x, y), b = fpBounds(x, y, x + 1, y + 1, WH, WH + 6);
    items.push({ kind: 'roof', fp: [x, y, x + 1, y + 1], key: x + y + 1.99, room: rm, full: bakeBox(b[0], b[1], b[2], b[3], c => drawRoof(c, x, y, rm)) });
  }
  return SCENE.byMode[key] = { floor, items };
}
function drawRoof(c, x, y, rm) {
  const r = mulberry32(x * 13 + y * 97); box(c, x, y, x + 1, y + 1, WH, WH + 1, '#1a2236', null, null);
  onPlane(c, WH + 1, c => { for (let i = 0; i < 26; i++) { c.fillStyle = r() < 0.5 ? '#232d45' : '#121827'; c.fillRect(x + r(), y + r(), 0.06, 0.05); }
    if (r() < 0.35) { c.fillStyle = 'rgba(12,15,24,0.8)'; c.beginPath(); c.ellipse(x + 0.3 + r() * 0.4, y + 0.3 + r() * 0.4, 0.25, 0.15, 0, 0, 6.28); c.fill(); } });
  const diff = (dx, dy) => roomOf(x + dx, y + dy) !== rm;
  const pz = WH + 5, pc = ['#7d7870', '#3b3433', '#52463f'];
  if (diff(0, -1)) box(c, x, y, x + 1, y + 0.08, WH, pz, ...pc);
  if (diff(-1, 0)) box(c, x, y, x + 0.08, y + 1, WH, pz, ...pc);
  if (diff(0, 1)) box(c, x, y + 0.92, x + 1, y + 1, WH, pz, ...pc);
  if (diff(1, 0)) box(c, x + 0.92, y, x + 1, y + 1, WH, pz, ...pc);
  if (r() < 0.18 && !diff(0, 1) && !diff(1, 0)) { box(c, x + 0.25, y + 0.25, x + 0.75, y + 0.65, WH + 1, WH + 8, '#8b9cb8', '#4d5f80', '#6a7d9c'); const F = faceY(x + 0.25, x + 0.75, y + 0.65); for (let u = 0.1; u < 1; u += 0.2) fline(c, F, u, WH + 2, u, WH + 7, '#2e3a56'); }
  else if (r() < 0.2) box(c, x + 0.45, y + 0.45, x + 0.55, y + 0.55, WH + 1, WH + 9, '#6a7d9c', '#2e3a56', '#3b4a68');
}
const TILECOL = { '.': ['#151b29', '#1a2236'], w: ['#3b3433', '#2a2629'], g: ['#1f2a28', '#1c1a1f'], s: ['#2a2629', '#3b3433'], r: ['#0c0f18', '#121827'], p: ['#52463f', '#3b3433'],
  O: ['#6e5d4e', '#3b3433'], 5: ['#3d2a29', '#2b1f22'], 6: ['#4a0a14', '#2b1f22'], b: ['#b3ad9f', '#7d7870'], '#': ['#0c0f18', '#0c0f18'], P: ['#07080d', '#07080d'] };
function drawFloor(c) {
  onPlane(c, 0, c => {
    for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
      const t = tileAt(x, y), [a, b] = TILECOL[t]; const r = mulberry32(x * 71 + y * 13);
      c.fillStyle = a; c.fillRect(x, y, 1.01, 1.01);
      if (t === '.') { for (let i = 0; i < 14; i++) { c.fillStyle = r() < 0.5 ? '#1a2236' : '#121827'; c.fillRect(x + r(), y + r(), 0.05, 0.05); } if (r() < 0.12) { c.fillStyle = 'rgba(7,8,13,0.5)'; c.beginPath(); c.ellipse(x + 0.5, y + 0.5, 0.3, 0.2, r(), 0, 6.28); c.fill(); } }
      else if (t === 'w' || t === 's' || t === 'p') { c.fillStyle = b; c.fillRect(x, y, 1, 0.03); c.fillRect(x, y, 0.03, 1); if (t !== 'w') { c.fillRect(x + 0.5, y, 0.02, 1); } for (let i = 0; i < 8; i++) { c.fillStyle = 'rgba(28,26,31,0.5)'; c.fillRect(x + r(), y + r(), 0.05, 0.04); } }
      else if (t === 'g') { for (let i = 0; i < 12; i++) { c.fillStyle = ['#2d3b37', '#41524c', '#1c1a1f', '#3b3433'][r() * 4 | 0]; c.fillRect(x + r(), y + r(), 0.04, 0.08); } }
      else if (t === 'r') { for (let i = 0; i < 10; i++) { c.fillStyle = '#121827'; c.fillRect(x + r(), y + r(), 0.06, 0.04); } }
      else if (t === 'O') { for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) if ((i + j) % 2) { c.fillStyle = b; c.fillRect(x + i / 4, y + j / 4, 0.25, 0.25); } }
      else if (t === '5' || t === '6') { for (let i = 0; i < 16; i++) { c.fillStyle = t === '6' ? (r() < 0.5 ? '#553833' : '#2b1f22') : '#2b1f22'; c.fillRect(x + r(), y + r(), 0.07, 0.07); } }
      else if (t === 'b') { c.fillStyle = b; for (let i = 0; i <= 4; i++) { c.fillRect(x + i / 4, y, 0.02, 1); c.fillRect(x, y + i / 4, 1, 0.02); } }
    }
    // curbs and markings
    c.fillStyle = '#62736b'; c.fillRect(1, 6.96, 18, 0.05); c.fillStyle = '#07080d'; c.fillRect(1, 7.01, 18, 0.06);
    c.fillStyle = '#8e7b66'; c.fillRect(0, 15.97, MW, 0.04); c.fillStyle = '#07080d'; c.fillRect(0, 17.0, MW, 0.08); c.fillStyle = '#6e5d4e'; c.fillRect(0, 16.93, MW, 0.06);
    c.fillStyle = 'rgba(183,195,214,0.5)'; for (let x = 3; x <= 17; x += 2) c.fillRect(x - 0.03, 7.6, 0.06, 3.4);
    c.fillStyle = '#9c7330'; for (let x = 0.3; x < MW; x += 1.4) c.fillRect(x, 17.97, 0.7, 0.07);
    // manhole, oil, car shadows
    c.fillStyle = '#07080d'; c.beginPath(); c.ellipse(9.5, 17.6, 0.32, 0.32, 0, 0, 6.28); c.fill(); c.fillStyle = '#232d45'; c.beginPath(); c.ellipse(9.5, 17.6, 0.27, 0.27, 0, 0, 6.28); c.fill();
    c.fillStyle = '#121827'; for (let i = -2; i <= 2; i++) c.fillRect(9.3, 17.6 + i * 0.09, 0.4, 0.03);
    for (const o of L.props) if (['cruiser', 'sedan', 'wagon'].includes(o.t)) { c.fillStyle = 'rgba(7,8,13,0.75)'; c.fillRect(o.x0 - 0.1, o.y0 - 0.05, o.x1 - o.x0 + 0.25, o.y1 - o.y0 + 0.2); }
    // puddles
    for (const [x, y, rx, ry] of L.puddles) { c.fillStyle = '#0c0f18'; c.beginPath(); c.ellipse(x, y, rx, ry, 0.3, 0, 6.28); c.fill(); c.fillStyle = 'rgba(46,58,86,0.7)'; c.beginPath(); c.ellipse(x - rx * 0.2, y - ry * 0.25, rx * 0.5, ry * 0.25, 0.3, 0, 6.28); c.fill(); }
    // room details: petal trail in room 6, wax ring in room 5, rug in office
    const r = mulberry32(77); c.fillStyle = '#f2eee4'; for (let i = 0; i < 14; i++) { const k = i / 14; c.fillRect(lerp(14.3, 16.5, k) + (r() - 0.5) * 0.3, lerp(3.2, 2.6, k) + (r() - 0.5) * 0.4 + Math.sin(k * 6) * 0.2, 0.08, 0.05); }
    c.strokeStyle = '#f6d79a'; c.lineWidth = 0.05; c.beginPath(); c.ellipse(12.3, 3.5, 0.22, 0.22, 0, 0, 6.28); c.stroke(); c.fillStyle = '#d8d2c2'; c.fillRect(12.28, 3.3, 0.06, 0.06); c.fillRect(12.45, 3.6, 0.05, 0.05);
    c.fillStyle = '#553833'; c.fillRect(3.1, 4.9, 1.5, 0.8); c.fillStyle = '#8a1020'; c.fillRect(3.2, 5.0, 1.3, 0.6); c.fillStyle = '#553833'; c.fillRect(3.3, 5.1, 1.1, 0.4);
    c.fillStyle = '#73391f'; for (let i = 0; i < 18; i++) c.fillRect(14 + r() * 6, 11 + r() * 5, 0.07, 0.05); // leaves on deck
  });
  // drained pool (sunken): clip to the opening
  const pl = L.pool, d = pl.depth;
  c.save(); c.beginPath(); [P(pl.x0, pl.y0), P(pl.x1, pl.y0), P(pl.x1, pl.y1), P(pl.x0, pl.y1)].forEach((p, i) => i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])); c.closePath(); c.clip();
  onPlane(c, -d, c => { c.fillStyle = '#4d5f80'; c.fillRect(pl.x0, pl.y0, pl.x1 - pl.x0, pl.y1 - pl.y0); c.fillStyle = '#3b4a68';
    for (let x = pl.x0; x <= pl.x1; x += 0.5) c.fillRect(x, pl.y0, 0.025, pl.y1 - pl.y0); for (let y = pl.y0; y <= pl.y1; y += 0.5) c.fillRect(pl.x0, y, pl.x1 - pl.x0, 0.025);
    c.fillStyle = 'rgba(31,42,40,0.7)'; c.beginPath(); c.ellipse(18.2, 14.3, 0.9, 0.5, 0.3, 0, 6.28); c.fill(); c.fillStyle = '#07080d'; c.beginPath(); c.ellipse(17, 13.5, 0.15, 0.15, 0, 0, 6.28); c.fill();
    const r = mulberry32(5); c.fillStyle = '#73391f'; for (let i = 0; i < 22; i++) c.fillRect(pl.x0 + r() * 4, pl.y0 + r() * 3, 0.07, 0.05); c.fillStyle = 'rgba(28,26,31,0.35)'; for (let i = 0; i < 10; i++) { c.beginPath(); c.ellipse(pl.x0 + r() * 4, pl.y0 + r() * 3, 0.4, 0.2, r(), 0, 6.28); c.fill(); } });
  quad(c, [P(pl.x0, pl.y0, 0), P(pl.x1, pl.y0, 0), P(pl.x1, pl.y0, -d), P(pl.x0, pl.y0, -d)], '#6a7d9c');
  quad(c, [P(pl.x0, pl.y0, 0), P(pl.x0, pl.y1, 0), P(pl.x0, pl.y1, -d), P(pl.x0, pl.y0, -d)], '#3b4a68');
  const Fn = faceY(pl.x0, pl.x1, pl.y0), Fw = faceX(pl.y0, pl.y1, pl.x0);
  fq(c, Fn, 0, 1, -4, -2, '#1a8fb3'); fq(c, Fw, 0, 1, -4, -2, '#0f4a63');
  const rr = mulberry32(9); for (let i = 0; i < 14; i++) { const u = rr(); fline(c, Fn, u, -2, u + 0.01, -6 - rr() * 12, 'rgba(46,58,86,0.7)'); }
  for (const u of [0.3, 0.38]) fline(c, Fn, u, 2, u, -d + 2, '#b3ad9f'); for (let z = -2; z > -d; z -= 4) fline(c, Fn, 0.3, z, 0.38, z, '#b3ad9f');
  c.restore();
  onPlane(c, 0, c => { c.strokeStyle = '#b3ad9f'; c.lineWidth = 0.1; c.strokeRect(pl.x0, pl.y0, pl.x1 - pl.x0, pl.y1 - pl.y0); });
  // world-continuous grain and wet sheen (pixel noise)
  const S = G.S, im = c.getImageData(0, 0, c.canvas.width, c.canvas.height), dd = im.data, W = c.canvas.width;
  for (let i = 0, p = 0; i < dd.length; i += 4, p++) { if (!dd[i + 3]) continue; const x = (p % W) / S, y = ((p / W) | 0) / S; const n = fbm(x / 22, y / 11, 41); const k = 0.86 + n * 0.3 + (n > 0.62 ? 0.18 : 0); dd[i] *= k; dd[i + 1] *= k; dd[i + 2] *= k * 1.03; }
  c.putImageData(im, 0, 0);
}

// ================= state =================
const game = {
  clues: [], deductions: [], objective: L.firstObjective, sanity: 100, fade: 1, eye: 0, warp: 0, flags: {}, talk: {}, started: false, world: 'real',
  tryLink(a, b) {
    const k = [a, b].sort().join('+'); const D = L.deductions[k]; if (!D || this.deductions.find(d => d.id === D.id)) return null;
    const d = { id: D.id, a, b, text: D.text }; this.deductions.push(d); Sound.sfx('deduce');
    if (this.deductions.length >= 3 && !this.flags.breakthrough) { this.flags.breakthrough = true; setObjective(L.breakthroughObjective); }
    else setObjective(`Deductions ${this.deductions.length}/3. Keep linking what you've found.`);
    return d;
  },
};
function setObjective(t) { game.objective = t; if (UI.toast) UI.toast(t); }
const PL = { x: 12.6, y: 14.2, face: -1, state: 'idle', animT: 0, frame: 0, inspectT: 0, stepF: -1, moving: false };
const NPCS = L.npcs.map(n => ({ ...n }));
let camX = 0, camY = 0, ghostT = 0, steam = [], smoke = [], rain = [], splashes = [], ash = makeAsh(120), transitioning = false;
const roomFade = { office: 1, r4: 1, r5: 1, r6: 1 };
for (let i = 0; i < 260; i++) rain.push({ x: Math.random() * (NW + 40) - 20, y: Math.random() * NH, v: 4 + Math.random() * 2.5, l: Math.random() < 0.3 ? 3 : 5, far: Math.random() < 0.4, land: 40 + Math.random() * (NH - 40) });

// ================= collision & movement =================
const walkable = (tx, ty) => { const t = tileAt(tx, ty); return t !== ' ' && !L.blocked.includes(t); };
function blockedAt(x, y, r = 0.2) {
  const tx = Math.floor(x), ty = Math.floor(y);
  for (const [cx, cy] of [[x - r, y - r], [x + r, y - r], [x - r, y + r], [x + r, y + r]]) {
    const ux = Math.floor(cx), uy = Math.floor(cy); if (!walkable(ux, uy)) return true;
    if (ux !== tx && (wallBlocks(`W:${Math.max(tx, ux)},${ty}`) || wallBlocks(`W:${Math.max(tx, ux)},${uy}`))) return true;
    if (uy !== ty && (wallBlocks(`N:${tx},${Math.max(ty, uy)}`) || wallBlocks(`N:${ux},${Math.max(ty, uy)}`))) return true;
  }
  for (const s of SOLIDS) if (x + r > s[0] && x - r < s[2] && y + r > s[1] && y - r < s[3]) return true;
  return false;
}
function updatePlayer() {
  const busy = UI.open || transitioning || !game.started;
  let dx = 0, dy = 0; if (!busy) { dx = (In.right() ? 1 : 0) - (In.left() ? 1 : 0); dy = (In.down() ? 1 : 0) - (In.up() ? 1 : 0); }
  const sneak = !busy && In.sneak();
  if (PL.inspectT > 0) { PL.inspectT -= 1 / 60; dx = dy = 0; }
  PL.moving = !!(dx || dy);
  if (PL.moving) {
    const len = Math.hypot(dx, dy), sp = (sneak ? 0.5 : 1.05); const sx = dx / len * sp, sy = dy / len * sp * 0.85;
    const wx = sx / (2 * HW) + sy / (2 * HH), wy = sy / (2 * HH) - sx / (2 * HW);
    if (!blockedAt(PL.x + wx, PL.y)) PL.x += wx; if (!blockedAt(PL.x, PL.y + wy)) PL.y += wy;
    if (dx) PL.face = dx > 0 ? 1 : -1; else PL.face = (wx - wy) >= 0 ? 1 : -1;
  }
  let st = PL.inspectT > 0 ? 'inspect' : PL.moving ? (sneak ? 'sneak' : 'walk') : (sneak ? 'crouch' : 'idle');
  if (st !== PL.state) { PL.state = st; PL.animT = 0; }
  const an = ANIM[st] || { n: 1, fps: 8 }; PL.animT += 1 / 60; PL.frame = Math.floor(PL.animT * an.fps) % an.n;
  if ((st === 'walk' || st === 'sneak') && (PL.frame === 0 || PL.frame === 4) && PL.stepF !== PL.frame) Sound.step(!roomAtW(PL.x, PL.y) && game.world === 'real');
  PL.stepF = PL.frame;
}

// ================= lights =================
function activeLights() {
  const t = G.t, out = [];
  const list = game.world === 'other' ? L.otherLights : L.lights;
  for (const l of list) {
    let s = l.i;
    if (l.flicker && !flick(l.flicker, t, l.kind === 'tube' ? 1.3 : 0.8)) s *= 0.15;
    if (l.kind === 'tv' || l.kind === 'tvwin') s *= 0.6 + 0.4 * hash2(Math.floor(t * 9), 5, 1);
    if (l.kind === 'siren') { const ph = Math.floor(t * 2.6) % 2, strobe = (t * 2.6 % 1) < 0.5 ? 1 : (t * 2.6 % 1) < 0.62 ? 0 : 1; s *= (ph === l.phase ? 1 : 0.05) * strobe; }
    if (l.kind === 'candles') s *= 0.85 + 0.15 * Math.sin(t * 9) * Math.sin(t * 5.3);
    if (l.room) s *= 1 - roomFade[l.room];
    if (s > 0.02) out.push({ ...l, s, c: COL(l.col) });
  }
  return out;
}
let LIGHTS = [];
function lightAt(x, y) { let v = game.world === 'other' ? 0.22 : 0.12; for (const l of LIGHTS) { const d = Math.hypot((x - l.x) * 22, (y - l.y) * 22); if (d < l.r) v += l.s * Math.pow(1 - d / l.r, 1.3); } return clamp(v, 0, 1); }
function lightCol(x, y) { let best = null, bv = 0; for (const l of LIGHTS) { const d = Math.hypot((x - l.x) * 22, (y - l.y) * 22); const v = l.s * (1 - d / l.r); if (v > bv) { bv = v; best = l; } } return best ? best.c : C.b8; }

// ================= interaction =================
function interactables() {
  const out = [], ey = game.eye > 0.5;
  if (game.world === 'other') { out.push({ kind: 'tableau', x: 17, y: 13.5, r: 3.2, label: 'Look at what he made' }); return out; }
  for (const n of NPCS) out.push({ kind: 'npc', x: n.x, y: n.y, r: 1.4, label: n.id === 'vale' ? 'Talk to Vale' : n.id === 'officer' ? 'Talk to Dunn' : 'Talk to Lou', ref: n });
  for (const c of L.clues) { if (game.clues.find(k => k.id === c.id)) continue; if (c.hidden && !ey) continue; out.push({ kind: 'clue', x: c.x, y: c.y, r: c.r || 0.9, label: 'Inspect', ref: c }); }
  for (const s of L.specials) out.push({ kind: s.id, x: s.x, y: s.y, r: s.r, label: s.label, ref: s });
  if (game.flags.breakthrough && ey) out.push({ kind: 'portal', x: 17, y: 13.5, r: 2.4, label: 'Step down into the pool' });
  return out;
}
function nearestInteract() { const pr = roomAtW(PL.x, PL.y); let best = null, bd = 1e9; for (const it of interactables()) { const d = Math.hypot(PL.x - it.x, PL.y - it.y); const ir = it.kind === 'npc' && it.ref.id === 'clerk' ? 1.7 : it.r; if (d < ir && d < bd && roomAtW(it.x, it.y) === pr) { bd = d; best = it; } } return best; }
function interact(it) {
  if (it.kind === 'npc') { const id = it.ref.id; it.ref.face = PL.x > it.ref.x ? 1 : -1; PL.face = -it.ref.face; UI.say(dialogFor(id)); game.talk[id] = (game.talk[id] || 0) + 1;
    if (id === 'officer' && game.talk[id] === 1 && !game.clues.length) setTimeout(() => setObjective('Search room 6. Then room 5, the office, and the lot.'), 400); }
  else if (it.kind === 'clue') {
    const c = it.ref; PL.inspectT = 0.7; Sound.sfx('clue');
    game.clues.push({ id: c.id, title: c.title, note: c.note, snap: snapshot(c.x, c.y), area: L.title });
    UI.say([{ who: '', text: c.note }], () => { const n = game.clues.length; if (n === 1) setObjective('Pin what you find on the cork board in the motel office (far left).'); else if (!game.flags.breakthrough) setObjective(`Clues ${n}/6. Link pairs on the cork board. N opens your notebook.`); });
  }
  else if (it.kind === 'board') { Sound.sfx('page'); UI.openBoard(); }
  else if (it.kind === 'portal') crossOver();
  else if (it.kind === 'tableau') { PL.inspectT = 1; Sound.sfx('warp'); UI.say(L.tableau, () => UI.ending(L.ending.map(s => s === '{stats}' ? `Clues ${game.clues.length}/6   Deductions ${game.deductions.length}/3` : s), () => location.reload())); }
  else if (it.ref && it.ref.lines) { Sound.sfx('page'); UI.say(it.ref.lines); }
}
function dialogFor(id) {
  const n = game.talk[id] || 0, D = L.dialog;
  if (id === 'vale') { const V = D.vale, dd = game.deductions.length; if (game.flags.breakthrough) return V.breakthrough; if (dd > 0) return V.some.map(l => ({ ...l, text: l.text.replace('{n}', dd === 1 ? 'One thread' : dd + ' threads') })); return n === 0 ? V.first : V.again; }
  const arr = D[id]; return arr[Math.min(n, arr.length - 1)];
}
function crossOver() {
  if (transitioning) return; transitioning = true; game.flags.crossed = true; Sound.sfx('warp');
  const t0 = performance.now(); const out = () => { const k = (performance.now() - t0) / 700; game.fade = Math.min(1, k); if (k < 1) return requestAnimationFrame(out);
    game.world = 'other'; PL.x = 14.5; PL.y = 13.5; const t1 = performance.now(); const inn = () => { const k2 = (performance.now() - t1) / 1200; game.fade = Math.max(0, 1 - k2); if (k2 < 1) requestAnimationFrame(inn); else transitioning = false; }; inn();
    setTimeout(() => setObjective('Find what he left for you.'), 900); }; out();
}
function snapshot(wx, wy) {
  const S = G.S, w = 72, h = 56, sx = clamp(Math.round(isoX(wx, wy) - camX - w / 2), 0, NW - w), sy = clamp(Math.round(isoY(wx, wy) - camY - h + 12), 0, NH - h);
  const cv = makeCanvas(w * 4, h * 4), c = cv.getContext('2d'); c.imageSmoothingEnabled = G.mode !== 'pixel'; c.drawImage(view, sx * S, sy * S, w * S, h * S, 0, 0, w * 4, h * 4); return cv;
}

// ================= update =================
function update() {
  G.t += 1 / 60;
  if (game.started && !UI.open && !transitioning && In.hit('KeyE')) { const it = nearestInteract(); if (it) interact(it); }
  if (In.hit('KeyN') && game.started && !UI.open) { Sound.sfx('page'); UI.openNotebook(); }
  if (In.hit('KeyV')) toggleMode();
  if (In.hit('KeyM')) Sound.muted = !Sound.muted;
  updatePlayer();
  const pr = roomAtW(PL.x, PL.y); for (const k in roomFade) roomFade[k] = lerp(roomFade[k], k === pr ? 0 : 1, 0.12);
  LIGHTS = activeLights();
  const wantEye = game.started && !UI.open && In.eye() && game.sanity > 0;
  game.eye = lerp(game.eye, wantEye ? 1 : 0, wantEye ? 0.06 : 0.1);
  if (wantEye) game.sanity = Math.max(0, game.sanity - 9 / 60);
  else if (lightAt(PL.x, PL.y) > 0.35 && game.world === 'real') game.sanity = Math.min(100, game.sanity + 2.5 / 60);
  if (game.world === 'other') game.sanity = Math.max(0, game.sanity - 1.2 / 60);
  if (game.sanity <= 0 && !transitioning && !UI.open) { game.sanity = 45; game.world = 'real'; PL.x = 12.6; PL.y = 14.2; setTimeout(() => UI.toast && UI.toast('You come to on the wet asphalt. Your hands are shaking.'), 600); }
  game.warp = lerp(game.warp, game.world === 'other' ? 0 : clamp((35 - game.sanity) / 35, 0, 1) * 0.55 + game.eye * 0.25, 0.05);
  ghostT = (ghostT + 1 / 60 / 14) % 1;
  for (const n of NPCS) if (n.id !== 'clerk' && !UI.open) { const d = Math.hypot(PL.x - n.x, PL.y - n.y); if (d < 2.2) n.face = PL.x > n.x ? 1 : -1; }
  // particles (in screen space of the world)
  if (game.world === 'real') stepSteam(steam, L.vents.map(([x, y], i) => { const p = P(x, y); return { x: p[0], y: p[1], rate: 4, acc: (steam.vacc = (steam.vacc || 0)) }; }), G.t);
  const em = PL.state === 'idle' ? emberPos(PL.state, PL.frame) : null; const pp = P(PL.x, PL.y);
  if (em && Math.random() < 0.12) smoke.push({ x: pp[0] + em.x * PL.face, y: pp[1] + em.y, vx: 0.05 * PL.face, vy: -0.18, life: 0, max: 90 });
  for (let i = smoke.length - 1; i >= 0; i--) { const s = smoke[i]; s.x += s.vx + Math.sin(G.t * 2 + i) * 0.04; s.y += s.vy; if (++s.life > s.max) smoke.splice(i, 1); }
  // camera
  const tx = pp[0] - NW / 2 + PL.face * 18, ty = pp[1] - NH / 2 - 14;
  camX = lerp(camX, clamp(tx, FX, FX + FW - NW), 0.08); camY = lerp(camY, clamp(ty, FY - 80, FY + FH - NH), 0.08);
  // audio
  const inRoom = !!pr, real = game.world === 'real';
  Sound.set('rain', real ? (inRoom ? 0.55 : 1) : 0); Sound.set('muffle', inRoom ? 1 : 0);
  Sound.set('jazz', real ? clamp(1 - Math.hypot(PL.x - 2.5, PL.y - 3) / 7, 0, 1) * (pr === 'office' ? 1 : 0.5) : 0);
  Sound.set('eye', game.eye); Sound.set('drone', real ? 0.15 + (1 - game.sanity / 100) * 0.7 : 1); Sound.set('heart', clamp((40 - game.sanity) / 40, 0, 1)); Sound.set('train', 0);
  let buzz = 0; for (const l of LIGHTS) if (l.kind === 'neon' || l.kind === 'tube' || l.kind === 'ice') buzz = Math.max(buzz, clamp(1 - Math.hypot(PL.x - l.x, PL.y - l.y) / 3, 0, 1)); Sound.set('buzz', buzz);
  Sound.update(); clearPressed();
}
function toggleMode() { setMode(G.mode === 'pixel' ? 'painted' : 'pixel'); clearSpriteCache(); layout(); buildScene(); if (UI.toast) UI.toast(G.mode === 'pixel' ? 'Visual style: pixel art (384x216)' : 'Visual style: hand-painted'); }

// ================= depth sorting =================
function sortItems(list) {
  const n = list.length, pred = list.map(() => []);
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
    const a = list[i], b = list[j]; if (a.sx1 <= b.sx0 || b.sx1 <= a.sx0 || a.sy1 <= b.sy0 || b.sy1 <= a.sy0) continue;
    const A = a.fp, B = b.fp, e = 1e-4; const ab = A[2] <= B[0] + e || A[3] <= B[1] + e, ba = B[2] <= A[0] + e || B[3] <= A[1] + e;
    let o; if (ab && !ba) o = -1; else if (ba && !ab) o = 1; else o = a.key - b.key;
    if (o < 0) pred[j].push(i); else pred[i].push(j);
  }
  const idx = list.map((_, i) => i).sort((p, q) => list[p].key - list[q].key), mark = new Uint8Array(n), out = [];
  const visit = i => { if (mark[i]) return; mark[i] = 1; for (const k of pred[i]) visit(k); out.push(list[i]); };
  idx.forEach(visit); return out;
}

// ================= render =================
function render() {
  const S = G.S, sc = buildScene(), t = G.t, other = game.world === 'other', pix = G.mode === 'pixel';
  let cx = camX, cy = camY; if (pix) { cx = Math.round(cx); cy = Math.round(cy); } else { cx = Math.round(cx * S) / S; cy = Math.round(cy * S) / S; }
  const W = (c) => c.setTransform(S, 0, 0, S, -cx * S, -cy * S);
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.imageSmoothingEnabled = !pix; ctx.fillStyle = other ? '#0b0605' : '#030407'; ctx.fillRect(0, 0, view.width, view.height);
  W(ctx);
  const warp = game.warp, img = (b, alpha = 1) => { const cv = other ? b.cvO : b.cv; ctx.globalAlpha = alpha; ctx.drawImage(cv, b.bx, b.by, b.bw, b.bh);
    if (!other && warp > 0.01) { ctx.globalAlpha = alpha * warp; ctx.drawImage(b.cvO, b.bx, b.by, b.bw, b.bh); } ctx.globalAlpha = 1; };
  img(sc.floor);
  // floor-level dynamics: rain rings in puddles, shadows
  if (!other) for (const [x, y, rx, ry] of L.puddles) { const k = (t * 0.9 + hash1(x * 7)) % 1; const p = P(x + Math.sin(k * 20) * rx * 0.4, y); ctx.fillStyle = rgba(C.b7, 0.5 * (1 - k)); if (pix) { ctx.fillRect(Math.round(p[0] - 1 - k * 4), Math.round(p[1]), 1, 1); ctx.fillRect(Math.round(p[0] + 1 + k * 4), Math.round(p[1]), 1, 1); } else { ctx.beginPath(); ctx.ellipse(p[0], p[1], 1 + k * 4, 0.5 + k * 2, 0, 0, 6.28); ctx.strokeStyle = ctx.fillStyle; ctx.lineWidth = 0.4; ctx.stroke(); } }
  const shadow = (x, y) => { const p = P(x, y); ctx.fillStyle = 'rgba(3,4,7,0.45)'; if (pix) pxEllipse(ctx, p[0], p[1], 6, 2); else { ctx.beginPath(); ctx.ellipse(p[0], p[1], 6, 2.4, 0, 0, 6.28); ctx.fill(); } };
  // drawables
  const vis = [], vx0 = cx - 40, vy0 = cy - 40, vx1 = cx + NW + 40, vy1 = cy + NH + 40;
  for (const it of sc.items) { const b = it.full; if (b.bx > vx1 || b.bx + b.bw < vx0 || b.by > vy1 || b.by + b.bh < vy0) continue; it.sx0 = b.bx; it.sy0 = b.by; it.sx1 = b.bx + b.bw; it.sy1 = b.by + b.bh; vis.push(it); }
  const chr = (id, ch, x, y, face, state, frame, opt = {}) => { const p = P(x, y); vis.push({ kind: 'char', id, ch, x, y, face, state, frame, opt, fp: [x - 0.12, y - 0.12, x + 0.12, y + 0.12], key: x + y, sx0: p[0] - 20, sx1: p[0] + 20, sy0: p[1] - 42, sy1: p[1] + 2 }); };
  if (!other) for (const n of NPCS) { const an = ANIM[n.state]; chr(n.id, n.char, n.x, n.y, n.face, n.state, Math.floor(t * an.fps + n.x * 3) % an.n); }
  chr('player', 'detective', PL.x, PL.y, PL.face, PL.state, PL.frame);
  if (game.eye > 0.05 && !other) { const g = ghostPos(L.ghost, ghostT); chr('ghost', 'ghost', g.x, g.y, g.face, 'walk', Math.floor(t * 10) % 8, { ghost: true, alpha: game.eye * (0.55 + 0.25 * Math.sin(t * 7)) }); }
  for (const v of vis) if (v.kind === 'char' && v.id !== 'ghost') shadow(v.x, v.y);
  const order = sortItems(vis); let afterPlayer = false; const occ = occCv.getContext('2d'); occ.setTransform(1, 0, 0, 1, 0, 0); occ.clearRect(0, 0, occCv.width, occCv.height); W(occ); let occluded = false;
  const pl = vis.find(v => v.id === 'player');
  for (const it of order) {
    if (it.kind === 'char') { drawChar(ctx, it.ch, P(it.x, it.y)[0], P(it.x, it.y)[1], it.face, it.state, it.frame, { light: 1, lightCol: lightCol(it.x, it.y), ...it.opt });
      if (it.id === 'player') { afterPlayer = true; const em = PL.state === 'idle' ? emberPos('idle', PL.frame) : null; if (em) { const p = P(PL.x, PL.y); rect(ctx, p[0] + em.x * PL.face, p[1] + em.y, 1, 1, C.s4); } } continue; }
    let alpha = 1, b = it.full;
    if (it.kind === 'roof') alpha = roomFade[it.room];
    if (it.kind === 'wall' && it.cutRoom) { const f = roomFade[it.cutRoom]; if (f < 0.98) { img(it.stub); alpha = f; } }
    if (alpha > 0.02) img(b, alpha);
    if (afterPlayer && alpha > 0.5 && !(it.sx1 <= pl.sx0 || pl.sx1 <= it.sx0 || it.sy1 <= pl.sy0 || pl.sy1 <= it.sy0) && it.kind !== 'char') { occ.drawImage(other ? b.cvO : b.cv, b.bx, b.by, b.bw, b.bh); occluded = true; }
  }
  // the detective seen through walls
  if (occluded) { const s = silCv.getContext('2d'); s.setTransform(1, 0, 0, 1, 0, 0); s.clearRect(0, 0, silCv.width, silCv.height); W(s); const p = P(PL.x, PL.y);
    drawChar(s, 'detective', p[0], p[1], PL.face, PL.state, PL.frame, { silhouette: '#39e6ff' }); s.setTransform(1, 0, 0, 1, 0, 0); s.globalCompositeOperation = 'destination-in'; s.drawImage(occCv, 0, 0); s.globalCompositeOperation = 'source-over';
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 0.35; ctx.drawImage(silCv, 0, 0); ctx.globalAlpha = 1; W(ctx); }
  drawSteam(ctx, steam, other ? C.a1 : null);
  for (const s of smoke) rect(ctx, s.x, s.y, 1, 1, rgba(C.b9, Math.sin(Math.PI * s.life / s.max) * 0.35));
  // ---------- lighting ----------
  const dc = darkCv.getContext('2d'); dc.setTransform(1, 0, 0, 1, 0, 0); dc.globalCompositeOperation = 'source-over'; dc.clearRect(0, 0, darkCv.width, darkCv.height);
  dc.fillStyle = other ? 'rgba(22,8,5,0.6)' : 'rgba(3,5,12,0.8)'; dc.fillRect(0, 0, darkCv.width, darkCv.height);
  dc.globalCompositeOperation = 'destination-out'; W(dc);
  const hole = (x, y, rx, ry, a) => { if (pix) { [[1, 0.3], [0.66, 0.32], [0.36, 0.38]].forEach(([k, al]) => { dc.fillStyle = `rgba(0,0,0,${a * al})`; pxEllipse(dc, x, y, rx * k, ry * k); }); }
    else { dc.save(); dc.translate(x, y); dc.scale(1, ry / rx); const g = dc.createRadialGradient(0, 0, 0, 0, 0, rx); g.addColorStop(0, `rgba(0,0,0,${a})`); g.addColorStop(0.5, `rgba(0,0,0,${a * 0.55})`); g.addColorStop(1, 'rgba(0,0,0,0)'); dc.fillStyle = g; dc.fillRect(-rx, -rx, rx * 2, rx * 2); dc.restore(); } };
  for (const l of LIGHTS) { const g = P(l.x, l.y); hole(g[0], g[1], l.r, l.r * 0.5, l.s); hole(g[0], g[1] - l.h * 0.55, l.r * 0.45, l.r * 0.45, l.s * 0.55); }
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(darkCv, 0, 0); W(ctx);
  // ---------- emissive (additive) ----------
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (const l of LIGHTS) { const g = P(l.x, l.y, l.h); const big = l.kind === 'siren' ? 10 : l.kind === 'neon' ? 22 : l.kind === 'lamp' ? 10 : 7;
    glow(ctx, g[0], g[1], big, l.c, l.s * 0.9); if (l.kind !== 'window' && l.kind !== 'tvwin') { const gg = P(l.x, l.y); ctx.fillStyle = rgba(l.c, l.s * 0.07); if (pix) pxEllipse(ctx, gg[0], gg[1], l.r * 0.6, l.r * 0.3); else { ctx.beginPath(); ctx.ellipse(gg[0], gg[1], l.r * 0.6, l.r * 0.3, 0, 0, 6.28); ctx.fill(); } }
    if (l.kind === 'siren') { const a = P(l.x + 0.25, l.y - 0.02 + (l.phase ? 0.1 : -0.1), 19); rect(ctx, a[0] - 2, a[1], 4, 2, l.c); } }
  // puddle reflections
  if (!other) for (const [x, y, rx, ry] of L.puddles) for (const l of LIGHTS) { const d = Math.hypot(x - l.x, y - l.y); if (d > 7 || l.room) continue; const k = (1 - d / 7) * l.s; const p = P(x, y);
    const tall = l.kind === 'neon' || l.kind === 'lamp' || l.kind === 'siren'; ctx.fillStyle = rgba(l.c, k * 0.5);
    const w = rx * 12, hgt = tall ? ry * 10 + 4 : ry * 6; const ox = (isoX(l.x, l.y) - p[0]) * 0.12, oyy = Math.sin(t * 3 + x) * 0.5;
    if (pix) ctx.fillRect(Math.round(p[0] + ox - w * 0.25), Math.round(p[1] - ry * 4 + oyy), Math.round(w * 0.5), Math.round(hgt * 0.6)); else { ctx.beginPath(); ctx.ellipse(p[0] + ox, p[1] + oyy, w * 0.35, hgt * 0.35, 0, 0, 6.28); ctx.fill(); } }
  // lit neon & screens
  if (!other) { const sp = L.props.find(o => o.t === 'sign'); signLetters(ctx, sp.x, sp.y, true, t);
    for (const nt of L.neonText) { const w = WALLMAP[nt.edge]; const F = faceY(w.x, w.x + 1, w.y + 0.05); const on = flick(nt.seed, t, 0.5); const F2 = (u, z) => F(u * 0.5, z); faceText(ctx, F2, nt.text, nt.u, 0.03, nt.z, 0.9, on ? COL(nt.col) : rgba(COL(nt.col), 0.2)); glow(ctx, ...P(w.x + 0.9, w.y + 0.05, nt.z - 2), 16, COL(nt.col), on ? 0.5 : 0.05); }
    const ice = L.props.find(o => o.t === 'ice'); faceText(ctx, faceY(ice.x0, ice.x1, ice.y1), 'ICE', 0.3, 0.035, 19.5, 0.7, flick(4, t, 0.4) ? C.cy : rgba(C.cy, 0.2));
    const tv = 1 - roomFade.r6; if (tv > 0.05) { const dr = L.props.find(o => o.t === 'dresser'); const F = faceX(dr.y0 + 0.2, dr.y1 - 0.2, dr.x1 - 0.08); for (let z = 14; z < 21; z++) fq(ctx, F, 0.12, 0.88, z, z + 1, rgba(C.cy, tv * (0.15 + 0.35 * hash2(z, Math.floor(t * 14), 3)))); }
    const bo = L.props.find(o => o.t === 'booth'); fq(ctx, faceX(bo.y0, bo.y1, bo.x1), 0.08, 0.92, 31, 33, rgba(C.b9, flick(7, t, 1.3) ? 0.7 : 0.1)); }
  ctx.restore();
  // killer's eye: footprints, sigil
  if (game.eye > 0.05 && !other) { ctx.save(); ctx.globalAlpha = game.eye * 0.8; onPlane(ctx, 0, c => { c.fillStyle = C.rd; const G2 = L.ghost; for (let i = 1; i < G2.length; i++) { const a = G2[i - 1], b = G2[i], len = Math.hypot(b[0] - a[0], b[1] - a[1]), n = len / 0.42 | 0; for (let k = 0; k < n; k++) { const u = k / n, nx = -(b[1] - a[1]) / len, ny = (b[0] - a[0]) / len, s = k % 2 ? 0.07 : -0.07; c.fillRect(lerp(a[0], b[0], u) + nx * s, lerp(a[1], b[1], u) + ny * s, 0.1, 0.07); } } }); ctx.restore(); drawSigil(ctx, t, game.eye); }
  if (other) drawTableau(ctx, t);
  // ---------- weather ----------
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
  // UI overlay
  const dpr = window.devicePixelRatio || 1; uctx.setTransform(dpr, 0, 0, dpr, 0, 0); uctx.clearRect(0, 0, cssW, cssH);
  if (game.started && !UI.open && !transitioning) { const it = nearestInteract(); if (it) { const k = cssW / NW, p = P(it.x, it.y, it.kind === 'npc' ? 40 : 18); UI.prompt((p[0] - cx) * k, (p[1] - cy) * k, 'E  ' + it.label); } }
  UI.draw(uctx, cssW, cssH, game);
}
function drawWeather(c, cx, cy) {
  const pix = G.mode === 'pixel';
  for (const d of rain) {
    d.y += d.v * (d.far ? 0.7 : 1); d.x -= d.v * 0.15;
    if (d.y > d.land) { const wx = (d.x + cx) / (2 * HW) + (d.y + cy) / (2 * HH), wy = (d.y + cy) / (2 * HH) - (d.x + cx) / (2 * HW), rm = roomAtW(wx, wy);
      if (!d.far && splashes.length < 90 && (!rm || roomFade[rm] > 0.5) && tileAt(Math.floor(wx), Math.floor(wy)) !== ' ') splashes.push({ x: d.x, y: d.y - (rm ? WH : 0), t: 0 });
      d.y = -10 - Math.random() * 30; d.x = Math.random() * (NW + 40) - 20 + 20; d.land = 30 + Math.random() * (NH - 30); }
    const col = d.far ? 'rgba(139,156,184,0.25)' : 'rgba(183,195,214,0.4)';
    if (pix) { c.fillStyle = col; c.fillRect(Math.round(d.x), Math.round(d.y), 1, d.l); } else { c.strokeStyle = col; c.lineWidth = d.far ? 0.3 : 0.45; c.beginPath(); c.moveTo(d.x, d.y); c.lineTo(d.x - d.l * 0.15, d.y + d.l); c.stroke(); }
  }
  for (let i = splashes.length - 1; i >= 0; i--) { const s = splashes[i]; if (++s.t > 8) { splashes.splice(i, 1); continue; } c.fillStyle = 'rgba(183,195,214,0.45)'; const k = s.t < 4 ? 1 : 2;
    if (pix) { c.fillRect(Math.round(s.x - k), Math.round(s.y - 1), 1, 1); c.fillRect(Math.round(s.x + k), Math.round(s.y - 1), 1, 1); if (s.t < 3) c.fillRect(Math.round(s.x), Math.round(s.y - 2), 1, 1); }
    else { c.beginPath(); c.ellipse(s.x, s.y, k * 1.3, 0.5, 0, 0, 6.28); c.strokeStyle = 'rgba(183,195,214,0.35)'; c.lineWidth = 0.3; c.stroke(); } }
}
function ghostPos(path, u) {
  let tot = 0; const seg = []; for (let i = 1; i < path.length; i++) { const l = Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]); seg.push(l); tot += l; }
  let d = u * tot; for (let i = 0; i < seg.length; i++) { if (d <= seg[i]) { const k = d / seg[i], a = path[i], b = path[i + 1]; return { x: lerp(a[0], b[0], k), y: lerp(a[1], b[1], k), face: isoX(b[0], b[1]) >= isoX(a[0], a[1]) ? 1 : -1 }; } d -= seg[i]; }
  const e = path[path.length - 1]; return { x: e[0], y: e[1], face: 1 };
}
function drawSigil(c, t, e) {
  const a = e * (0.7 + 0.3 * Math.sin(t * 3)), d = L.pool.depth, x = 17, y = 13.5; c.save(); c.globalAlpha = a;
  onPlane(c, -d, c => { c.strokeStyle = C.rd; c.lineWidth = 0.07; c.beginPath(); c.arc(x, y, 1.0, 0, 6.283); c.stroke(); c.beginPath(); c.arc(x, y - 0.45, 0.35, 0, 6.283); c.stroke();
    c.beginPath(); c.moveTo(x - 0.4, y + 0.6); c.lineTo(x - 0.4, y - 0.05); c.moveTo(x - 0.15, y + 0.6); c.lineTo(x - 0.15, y - 0.15); c.moveTo(x + 0.1, y + 0.6); c.lineTo(x + 0.1, y - 0.12); c.moveTo(x + 0.35, y + 0.6); c.lineTo(x + 0.45, y + 0.1); c.moveTo(x - 0.45, y + 0.62); c.lineTo(x + 0.4, y + 0.62); c.stroke();
    for (let i = 0; i < 8; i++) { const an = i / 8 * 6.283; c.beginPath(); c.moveTo(x + Math.cos(an) * 1.15, y + Math.sin(an) * 1.15); c.lineTo(x + Math.cos(an) * 1.35, y + Math.sin(an) * 1.35); c.stroke(); } });
  const g = P(x, y, -d); glow(c, g[0], g[1], 30, C.rd, a * 0.5); c.restore();
}
function drawTableau(c, t) {
  const d = L.pool.depth, x = 17, y = 13.5, pl = L.pool; c.save();
  c.beginPath(); const W0 = P(pl.x0, pl.y1), S0 = P(pl.x1, pl.y1), E0 = P(pl.x1, pl.y0); c.moveTo(W0[0], W0[1]); c.lineTo(S0[0], S0[1]); c.lineTo(E0[0], E0[1]); c.lineTo(E0[0], E0[1] - 300); c.lineTo(W0[0], W0[1] - 300); c.closePath(); c.clip();
  box(c, x - 0.25, y - 0.25, x + 0.25, y + 0.25, -d, -d + 8, '#553833', '#2b1f22', '#3d2a29'); box(c, x - 0.25, y - 0.3, x + 0.25, y - 0.22, -d + 8, -d + 22, '#553833', '#2b1f22', '#3d2a29');
  const b = P(x, y, -d + 8); quad(c, [[b[0] - 4, b[1]], [b[0] + 4, b[1]], [b[0] + 3, b[1] - 13], [b[0] - 3, b[1] - 13]], '#d8d2c2'); disc(c, b[0], b[1] - 16, 3, '#b48e74'); rect(c, b[0] - 2, b[1] - 17, 4, 1, '#d9b25a');
  rect(c, b[0] - 4, b[1] - 3, 8, 2, '#f2eee4'); rect(c, b[0] - 3, b[1] - 5, 2, 2, '#f2eee4'); rect(c, b[0] + 1, b[1] - 4, 2, 2, '#f2eee4');
  c.globalCompositeOperation = 'lighter'; glow(c, b[0], b[1] - 17, 9, C.gd, 0.6 + 0.2 * Math.sin(t * 2));
  for (let i = 0; i < 8; i++) { const an = i / 8 * 6.283, p = P(x + Math.cos(an) * 1.1, y + Math.sin(an) * 1.1, -d); rect(c, p[0], p[1] - 3, 1, 3, '#f2eee4'); const fl = Math.sin(t * 11 + i * 2) > -0.6; rect(c, p[0], p[1] - 4 - (fl ? 1 : 0), 1, 1, '#f6d79a'); glow(c, p[0], p[1] - 4, 5, C.s3, 0.5); }
  c.restore();
}

// ================= main loop =================
let last = performance.now(), acc = 0;
function frame(now) {
  acc += Math.min(0.1, (now - last) / 1000); last = now;
  let steps = 0; while (acc >= 1 / 60 && steps < 4) { update(); acc -= 1 / 60; steps++; }
  try { render(); } catch (e) { console.error(e); }
  requestAnimationFrame(frame);
}
anyKeyHook = k => { if (UI.open && UI.handleKey) { UI.handleKey(k); delete pressed[k]; } };
function boot() {
  const q = new URLSearchParams(location.search); if (q.get('mode') === 'painted') setMode('painted');
  UI.subtitle = 'Case 01 — The Lily Saint  ·  Starlite Motor Court';
  UI.controls = ['W A S D / arrows  walk      SHIFT  sneak      E  inspect, talk, use', 'Q (hold)  see through his eyes      N  notebook', 'V  pixel / painted look      M  sound'];
  layout(); buildScene(); const p = P(PL.x, PL.y); camX = p[0] - NW / 2; camY = p[1] - NH / 2; game.fade = 0;
  if (q.get('x')) { PL.x = +q.get('x'); PL.y = +q.get('y'); }
  const start = () => { game.started = true; game.fade = 1; const t0 = performance.now(); const f = () => { const k = (performance.now() - t0) / 1500; game.fade = Math.max(0, 1 - k); if (k < 1) requestAnimationFrame(f); }; f();
    if (UI.toast) setTimeout(() => UI.toast(L.title + '. ' + L.sub), 300);
    setTimeout(() => UI.say(L.intro, () => setObjective(L.firstObjective)), 1200); };
  if (q.get('skip')) { game.started = true; game.fade = 0; } else UI.title(start);
  requestAnimationFrame(frame);
}
boot();
