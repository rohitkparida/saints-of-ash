'use strict';
// ===== mode-aware primitives (ctx in native units, already scaled by G.S) =====
const PIX = () => G.mode === 'pixel';
const rnd = v => PIX() ? Math.round(v) : v;
function rect(c, x, y, w, h, col) { c.fillStyle = col; if (PIX()) c.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); else c.fillRect(x, y, w, h); }
function disc(c, cx, cy, r, col) {
  c.fillStyle = col;
  if (PIX()) { cx = Math.round(cx); cy = Math.round(cy); r = Math.round(r); for (let dy = -r; dy <= r; dy++) { const hw = Math.round(Math.sqrt(Math.max(0, r * r - dy * dy))); c.fillRect(cx - hw, cy + dy, hw * 2 + 1, 1); } }
  else { c.beginPath(); c.arc(cx, cy, r, 0, 6.2832); c.fill(); }
}
function line(c, x1, y1, x2, y2, col, w = 1) {
  if (PIX()) {
    c.fillStyle = col; x1 = Math.round(x1); y1 = Math.round(y1); x2 = Math.round(x2); y2 = Math.round(y2);
    const dx = Math.abs(x2 - x1), dy = -Math.abs(y2 - y1), sx = x1 < x2 ? 1 : -1, sy = y1 < y2 ? 1 : -1; let e = dx + dy, n = 0;
    while (n++ < 2000) { c.fillRect(x1, y1, w, w); if (x1 === x2 && y1 === y2) break; const e2 = 2 * e; if (e2 >= dy) { e += dy; x1 += sx; } if (e2 <= dx) { e += dx; y1 += sy; } }
  } else { c.strokeStyle = col; c.lineWidth = w; c.lineCap = 'round'; c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke(); }
}
function poly(c, pts, col) { c.fillStyle = col; c.beginPath(); c.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]); c.closePath(); c.fill(); }
function vgrad(c, x, y, w, h, stops) { const g = c.createLinearGradient(0, y, 0, y + h); stops.forEach(s => g.addColorStop(s[0], s[1])); c.fillStyle = g; c.fillRect(x, y, w, h); }
// light cone from (x,y) downward. pixel: stepped bands; painted: soft gradient. additive.
function cone(c, x, y, topW, botW, h, col, a) {
  c.save(); c.globalCompositeOperation = 'lighter';
  if (PIX()) {
    const bands = [0.34, 0.22, 0.13];
    for (let b = 0; b < 3; b++) { const k = 1 - b * 0.28; c.fillStyle = rgba(col, a * bands[b]);
      for (let yy = 0; yy < h * (0.55 + 0.45 * (1 - b / 3)); yy++) { const t = yy / h; const w = lerp(topW, botW, t) * k; if (bayer(yy, b) > 1 - t * 0.9 && b === 0) continue; c.fillRect(Math.round(x - w / 2), Math.round(y + yy), Math.round(w), 1); } }
  } else {
    const g = c.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, rgba(col, a * 0.55)); g.addColorStop(0.6, rgba(col, a * 0.18)); g.addColorStop(1, rgba(col, 0));
    c.fillStyle = g; c.beginPath(); c.moveTo(x - topW / 2, y); c.lineTo(x + topW / 2, y); c.lineTo(x + botW / 2, y + h); c.lineTo(x - botW / 2, y + h); c.closePath(); c.fill();
    const g2 = c.createLinearGradient(0, y, 0, y + h); g2.addColorStop(0, rgba(col, a * 0.35)); g2.addColorStop(1, rgba(col, 0));
    c.fillStyle = g2; c.beginPath(); c.moveTo(x - topW / 4, y); c.lineTo(x + topW / 4, y); c.lineTo(x + botW / 4, y + h); c.lineTo(x - botW / 4, y + h); c.closePath(); c.fill();
  }
  c.restore();
}
function glow(c, x, y, r, col, a) {
  c.save(); c.globalCompositeOperation = 'lighter';
  if (PIX()) { [[1, 0.12], [0.62, 0.16], [0.3, 0.3]].forEach(([k, al]) => disc(c, x, y, r * k, rgba(col, a * al))); }
  else { const g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, rgba(col, a * 0.7)); g.addColorStop(0.25, rgba(col, a * 0.3)); g.addColorStop(1, rgba(col, 0)); c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2); }
  c.restore();
}

// ===== textures =====
let _strokeTex = null;
function strokeTex() {
  if (_strokeTex) return _strokeTex; const cv = makeCanvas(256, 256), c = cv.getContext('2d'), r = mulberry32(9);
  for (let i = 0; i < 1400; i++) { const x = r() * 256, y = r() * 256, l = 4 + r() * 14, a = -0.5 + r() * 0.3; c.strokeStyle = r() < 0.5 ? `rgba(0,0,0,${0.05 + r() * 0.08})` : `rgba(255,240,220,${0.03 + r() * 0.05})`; c.lineWidth = 1 + r() * 2.5; c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); c.stroke(); }
  return _strokeTex = cv;
}
function postStatic(cv, opt = {}) {
  if (PIX()) { snapCanvas(cv, opt.dither == null ? 16 : opt.dither); return; }
  const c = cv.getContext('2d');
  if (opt.blur) { const t = makeCanvas(cv.width, cv.height), tc = t.getContext('2d'); tc.filter = `blur(${opt.blur}px)`; tc.drawImage(cv, 0, 0); c.clearRect(0, 0, cv.width, cv.height); c.drawImage(t, 0, 0); }
  c.save(); c.globalCompositeOperation = 'source-atop'; c.fillStyle = c.createPattern(strokeTex(), 'repeat'); c.fillRect(0, 0, cv.width, cv.height); c.restore();
}

// ===== world builders (all native units) =====
function sky(c, w, o = {}) {
  vgrad(c, 0, 0, w, NH, [[0, o.top || C.k1], [0.5, o.mid || C.b2], [0.85, o.low || '#2d2a3a'], [1, o.low || '#2d2a3a']]);
  const r = mulberry32(o.seed || 4);
  for (let y = 0; y < 110; y += 2) for (let x = 0; x < w; x += 3) { const n = fbm(x / 70, y / 14, 5); if (n > 0.52) { c.fillStyle = rgba(n > 0.62 ? C.b5 : C.b3, 0.35 + (n - 0.52) * 2); c.fillRect(x, y, 3, 2); } }
}
function skyline(c, w, o) {
  const r = mulberry32(o.seed || 1); let x = -10;
  while (x < w + 10) {
    const bw = o.minW + r() * (o.maxW - o.minW), top = o.base - (o.minH + r() * (o.maxH - o.minH));
    rect(c, x, top, bw, NH - top, o.col);
    if (r() < 0.3) rect(c, x + bw * 0.2, top - 6, bw * 0.5, 6, o.col);
    if (r() < 0.25) { const tx = x + bw * (0.2 + r() * 0.5); rect(c, tx, top - 10, 7, 7, o.col); rect(c, tx + 1, top - 3, 1, 3, o.col); rect(c, tx + 5, top - 3, 1, 3, o.col); rect(c, tx - 1, top - 11, 9, 1, o.col); }
    if (r() < 0.2) rect(c, x + bw / 2, top - 14, 1, 14, o.col);
    for (let yy = top + 3; yy < o.base + 30; yy += o.wy) for (let xx = x + 2; xx < x + bw - 2; xx += o.wx) { if (r() < o.lit) { c.fillStyle = r() < 0.8 ? rgba(C.s3, 0.5 + r() * 0.4) : rgba(C.b9, 0.5); c.fillRect(Math.round(xx), Math.round(yy), o.ww || 1, o.wh || 1); } }
    x += bw + r() * 3;
  }
}
// brick / plaster facade with windows. returns windows list
function facade(c, b) {
  const r = mulberry32(b.seed || 7); const { x, w, top } = b, bot = b.bottom;
  rect(c, x, top, w, bot - top, b.col);
  if (b.brick) {
    for (let y = top + 2; y < bot; y += 3) { c.fillStyle = rgba(C.k0, 0.35); c.fillRect(x, y, w, 1); const off = ((y / 3) | 0) % 2 ? 3 : 0;
      for (let xx = x + off; xx < x + w; xx += 7) { c.fillStyle = rgba(C.k0, 0.3); c.fillRect(xx, y - 2, 1, 2); const v = r(); if (v < 0.07) { c.fillStyle = rgba(C.br4, 0.5); c.fillRect(xx + 1, y - 2, 6, 2); } else if (v < 0.14) { c.fillStyle = rgba(C.k0, 0.25); c.fillRect(xx + 1, y - 2, 6, 2); } } }
  } else {
    for (let i = 0; i < w * (bot - top) / 40; i++) { const px = x + r() * w, py = top + r() * (bot - top); c.fillStyle = rgba(r() < 0.5 ? C.k0 : C.b8, 0.06 + r() * 0.06); c.fillRect(px, py, 1 + r() * 4, 1 + r() * 2); }
  }
  // grime gradient bottom & top shadow
  vgrad(c, x, top, w, 18, [[0, rgba(C.k0, 0.5)], [1, rgba(C.k0, 0)]]);
  vgrad(c, x, bot - 40, w, 40, [[0, rgba(C.k0, 0)], [1, rgba(C.k0, 0.45)]]);
  // cornice
  if (b.cornice !== false) { rect(c, x - 2, top - 3, w + 4, 3, b.trim || C.b5); rect(c, x - 2, top, w + 4, 1, C.k0); for (let xx = x; xx < x + w; xx += 6) rect(c, xx, top + 1, 2, 2, rgba(C.k0, 0.5)); }
  const wins = [];
  if (b.rows) for (let ri = 0; ri < b.rows; ri++) for (let ci = 0; ci < b.cols; ci++) {
    const wx = x + b.padX + ci * b.dx, wy = top + b.padY + ri * b.dy; if (b.skip && b.skip(ri, ci)) continue;
    const lit = r() < b.lit; const tv = lit && r() < 0.15;
    window_(c, wx, wy, b.ww, b.wh, lit ? (tv ? 'tv' : 'warm') : 'dark', r, b);
    wins.push({ x: wx, y: wy, w: b.ww, h: b.wh, lit, tv, seed: r() });
    // water stain under sill
    if (r() < 0.5) vgrad(c, wx + 1 + r() * (b.ww - 3), wy + b.wh + 1, 2, 6 + r() * 14, [[0, rgba(C.k0, 0.35)], [1, rgba(C.k0, 0)]]);
  }
  return wins;
}
function window_(c, x, y, w, h, kind, r, b) {
  rect(c, x - 1, y - 1, w + 2, h + 2, C.k0);
  if (kind === 'dark') { vgrad(c, x, y, w, h, [[0, C.b2], [1, C.k1]]); rect(c, x, y, 1, h, rgba(C.b6, 0.25)); }
  else if (kind === 'tv') { vgrad(c, x, y, w, h, [[0, '#1d2f4a'], [1, '#0f1626']]); }
  else { vgrad(c, x, y, w, h, [[0, C.s3], [0.6, C.s2], [1, C.s1]]);
    if (r() < 0.6) { rect(c, x, y, Math.ceil(w * 0.3), h, rgba(C.br3, 0.85)); rect(c, x + w - Math.ceil(w * 0.3), y, Math.ceil(w * 0.3), h, rgba(C.br3, 0.85)); }
    if (r() < 0.25) { const sx = x + 2 + r() * (w - 6); rect(c, sx, y + h - 8, 3, 8, rgba(C.k0, 0.75)); disc(c, sx + 1.5, y + h - 9, 1.6, rgba(C.k0, 0.75)); } }
  rect(c, x + Math.floor(w / 2), y, 1, h, rgba(C.k0, 0.7)); rect(c, x, y + Math.floor(h / 2), w, 1, rgba(C.k0, 0.6));
  rect(c, x - 2, y + h + 1, w + 4, 1, C.b6); rect(c, x - 2, y + h + 2, w + 4, 1, C.k0);
}
function ladderArt(c, x, top, bot, col = C.b6) { rect(c, x - 3, top - 2, 1, bot - top + 2, col); rect(c, x + 3, top - 2, 1, bot - top + 2, col); for (let y = top + 1; y < bot; y += 4) rect(c, x - 3, y, 7, 1, col); }
function landingArt(c, x, y, w, col = C.b5) {
  rect(c, x, y, w, 2, col); rect(c, x, y + 2, w, 1, C.k0); for (let xx = x; xx < x + w; xx += 2) rect(c, xx, y + 1, 1, 1, rgba(C.k0, 0.6));
  rect(c, x, y - 9, w, 1, col); for (let xx = x; xx <= x + w; xx += 3) rect(c, xx, y - 9, 1, 9, rgba(col, 0.85)); rect(c, x, y - 5, w, 1, rgba(col, 0.6));
  // brackets
  for (let xx = x + 4; xx < x + w; xx += 24) line(c, xx, y + 2, xx + 8, y + 10, rgba(col, 0.8));
}
function pipe(c, x, y1, y2, col = C.b4) { rect(c, x, y1, 3, y2 - y1, col); rect(c, x, y1, 1, y2 - y1, rgba(C.b7, 0.5)); for (let y = y1 + 10; y < y2; y += 22) rect(c, x - 1, y, 5, 2, C.k0); }
function lampPost(c, x, ground, h, dir = 1) {
  rect(c, x - 1, ground - h, 3, h, C.k1); rect(c, x - 2, ground - 4, 5, 4, C.k1); rect(c, x - 1, ground - h, 1, h, rgba(C.b6, 0.5));
  for (let i = 0; i < 12; i++) rect(c, x + dir * i, ground - h - 3 + Math.round(i * i / 40), 1, 2, C.k1);
  rect(c, x + dir * 10 - 3, ground - h - 1, 7, 3, C.k1); rect(c, x + dir * 10 - 2, ground - h + 2, 5, 1, C.s4);
}
function dumpster(c, x, ground) { rect(c, x, ground - 16, 30, 16, C.gr2); rect(c, x, ground - 16, 30, 2, C.gr3); rect(c, x - 1, ground - 18, 32, 2, C.gr1); for (let i = 3; i < 30; i += 7) rect(c, x + i, ground - 13, 1, 11, rgba(C.k0, 0.4)); rect(c, x + 2, ground - 2, 3, 2, C.k0); rect(c, x + 25, ground - 2, 3, 2, C.k0); vgrad(c, x, ground - 10, 30, 10, [[0, rgba(C.r3, 0)], [1, rgba(C.r3, 0.35)]]); }
function trashBags(c, x, ground, r) { for (let i = 0; i < 4; i++) { const bx = x + i * 6 + r() * 3, s = 3 + r() * 3; disc(c, bx, ground - s, s, i % 2 ? C.k1 : C.b1); rect(c, bx - 1, ground - s * 2 - 1, 2, 2, C.b2); } }
function asphalt(c, w, ground, o = {}) {
  vgrad(c, 0, ground, w, NH - ground, [[0, o.top || C.b3], [0.15, o.mid || C.b2], [1, C.k0]]);
  rect(c, 0, ground, w, 1, o.edge || C.b6);
  const r = mulberry32(o.seed || 3);
  for (let i = 0; i < w * 1.5; i++) { const x = r() * w, y = ground + 2 + r() * (NH - ground - 2); c.fillStyle = rgba(r() < 0.5 ? C.k0 : C.b6, 0.15 + r() * 0.15); c.fillRect(Math.round(x), Math.round(y), 1 + (r() * 3 | 0), 1); }
  for (let i = 0; i < w / 40; i++) { let x = r() * w, y = ground + 4 + r() * 20; for (let k = 0; k < 8; k++) { const nx = x + 2 + r() * 4, ny = y + (r() - 0.5) * 3; line(c, x, y, nx, ny, rgba(C.k0, 0.5)); x = nx; y = ny; } }
}
function puddleBase(c, p, ground) { for (let r = 0; r < 7; r++) { const ww = p.w * (1 - (r / 7) ** 2 * 0.5); rect(c, p.x + (p.w - ww) / 2, ground + 1 + r, ww, 1, rgba(C.k0, 0.55)); } }

// ===== dynamic FX =====
// fog texture per mode (tileable horizontally)
const fogCache = {};
function fogTex(kind) {
  const key = G.mode + kind; if (fogCache[key]) return fogCache[key];
  const W = 512, H = 120, S = G.S, cv = makeCanvas(W * S, H * S), c = cv.getContext('2d');
  const col = kind === 'ash' ? [130, 110, 95] : [120, 138, 168];
  const im = c.createImageData(W, H), d = im.data;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const n = (fbm(x / 60, y / 26, kind === 'ash' ? 21 : 11) + fbm((x + W) / 60, y / 26, kind === 'ash' ? 21 : 11) * 0) ;
    // make tileable by blending with wrapped sample
    const n2 = fbm((x - W) / 60, y / 26, kind === 'ash' ? 21 : 11); const t = x / W; const v = lerp(n, n2, t);
    const fall = Math.sin(Math.PI * y / H); let a = clamp((v - 0.38) * 2.2, 0, 1) * fall;
    if (G.mode === 'pixel') a = a > bayer(x, y) * 0.9 + 0.05 ? (a > 0.55 ? 0.5 : 0.3) : 0;
    const i = (y * W + x) * 4; d[i] = col[0]; d[i + 1] = col[1]; d[i + 2] = col[2]; d[i + 3] = a * 255;
  }
  const small = makeCanvas(W, H); small.getContext('2d').putImageData(im, 0, 0);
  c.imageSmoothingEnabled = G.mode !== 'pixel'; if (G.mode !== 'pixel') c.filter = 'blur(6px)'; c.drawImage(small, 0, 0, W * S, H * S);
  return fogCache[key] = cv;
}
function drawFog(ctx, kind, offX, y, alpha) { // screen space, ctx untransformed (device px)
  const tex = fogTex(kind), S = G.S, tw = tex.width; let ox = -((offX * S) % tw + tw) % tw; if (PIX()) ox = Math.round(ox);
  ctx.globalAlpha = alpha; for (let x = ox; x < NW * S; x += tw) ctx.drawImage(tex, x, y * S); ctx.globalAlpha = 1;
}
function makeRain(n) { const r = mulberry32(5), a = []; for (let i = 0; i < n; i++) a.push({ x: r() * (NW + 60), y: r() * NH, v: 3.2 + r() * 2.5, l: r() < 0.3 ? 2 : 4, far: r() < 0.45 }); return a; }
function drawRain(ctx, drops, cam, ground, dt, splashes) { // ctx world-unscaled? -> we use native screen units with scale S
  const pix = PIX();
  for (const d of drops) {
    d.y += d.v * (d.far ? 0.7 : 1); d.x -= d.v * 0.12;
    const sx = ((d.x - cam * (d.far ? 0.8 : 1.15)) % (NW + 60) + NW + 60) % (NW + 60) - 30;
    const gy = d.far ? ground - 18 : ground + 6;
    if (d.y > gy) { if (!d.far && splashes.length < 60 && Math.random() < 0.6) splashes.push({ x: sx, y: gy - 4 + Math.random() * 8, t: 0 }); d.y = -10 - Math.random() * 40; d.x = Math.random() * (NW + 60) + cam * 1.15; }
    const col = d.far ? 'rgba(139,156,184,0.28)' : 'rgba(183,195,214,0.42)';
    if (pix) { ctx.fillStyle = col; ctx.fillRect(Math.round(sx), Math.round(d.y), 1, d.l); }
    else { ctx.strokeStyle = col; ctx.lineWidth = d.far ? 0.3 : 0.45; ctx.beginPath(); ctx.moveTo(sx, d.y); ctx.lineTo(sx - d.l * 0.5, d.y + d.l * 1.6); ctx.stroke(); }
  }
  for (let i = splashes.length - 1; i >= 0; i--) { const s = splashes[i]; s.t++; if (s.t > 8) { splashes.splice(i, 1); continue; }
    ctx.fillStyle = 'rgba(183,195,214,0.45)'; const k = s.t < 4 ? 1 : 2;
    if (pix) { ctx.fillRect(Math.round(s.x - k), Math.round(s.y - 1), 1, 1); ctx.fillRect(Math.round(s.x + k), Math.round(s.y - 1), 1, 1); if (s.t < 3) ctx.fillRect(Math.round(s.x), Math.round(s.y - 2), 1, 1); }
    else { ctx.beginPath(); ctx.ellipse(s.x, s.y, k * 1.2, 0.5, 0, 0, 6.28); ctx.strokeStyle = 'rgba(183,195,214,0.35)'; ctx.lineWidth = 0.3; ctx.stroke(); } }
}
function makeAsh(n) { const r = mulberry32(8), a = []; for (let i = 0; i < n; i++) a.push({ x: r() * NW, y: r() * NH, v: 0.15 + r() * 0.35, ph: r() * 6, s: r() < 0.3 ? 2 : 1, c: r() < 0.6 ? C.a2 : C.a3 }); return a; }
function drawAsh(ctx, ash, cam, t) { for (const a of ash) { a.y += a.v; if (a.y > NH) { a.y = -4; a.x = Math.random() * NW; } const sx = ((a.x + Math.sin(t * 0.8 + a.ph) * 6 - cam * 0.9) % NW + NW) % NW; ctx.fillStyle = rgba(a.c, 0.5 + 0.4 * Math.sin(t * 3 + a.ph)); ctx.fillRect(rnd(sx), rnd(a.y), a.s, 1); } }
// steam puffs
function stepSteam(list, vents, t) {
  for (const v of vents) { v.acc = (v.acc || 0) + 1; if (v.acc > (v.rate || 5)) { v.acc = 0; list.push({ x: v.x + (Math.random() - 0.5) * 6, y: v.y, vx: (Math.random() - 0.5) * 0.15 + 0.05, vy: -0.25 - Math.random() * 0.25, r: 2, life: 0, max: 140 + Math.random() * 80 }); } }
  for (let i = list.length - 1; i >= 0; i--) { const p = list[i]; p.x += p.vx + Math.sin(t + p.y * 0.1) * 0.05; p.y += p.vy; p.vy *= 0.994; p.r += 0.07; if (++p.life > p.max) list.splice(i, 1); }
}
function drawSteam(c, list, tint) {
  for (const p of list) { const a = Math.sin(Math.PI * p.life / p.max) * 0.22;
    if (PIX()) { disc(c, p.x, p.y, p.r, rgba(tint || C.b8, a > 0.12 ? 0.22 : 0.12)); }
    else { const g = c.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r); g.addColorStop(0, rgba(tint || C.b8, a)); g.addColorStop(1, rgba(tint || C.b8, 0)); c.fillStyle = g; c.fillRect(p.x - p.r, p.y - p.r, p.r * 2, p.r * 2); } }
}
// neon sign: polyline glyph list in native units relative to (x,y)
function neon(c, x, y, glyph0, col, on, sc = 1.6) {
  const glyph = glyph0.map(s => s.map(v => v * sc));
  // backing board + mounting
  rect(c, x - 3, y - 6, 18 * sc + 6, 18 * sc + 8, rgba(C.k0, 0.3)); rect(c, x - 3, y - 6, 18 * sc + 6, 1, rgba(C.b5, 0.6));
  if (!on) { for (const s of glyph) for (let i = 0; i < s.length - 2; i += 2) line(c, x + s[i], y + s[i + 1], x + s[i + 2], y + s[i + 3], rgba(col, 0.25)); return; }
  if (PIX()) { glow(c, x + 8 * sc, y + 6 * sc, 30, col, 0.7); for (const s of glyph) for (let i = 0; i < s.length - 2; i += 2) line(c, x + s[i], y + s[i + 1], x + s[i + 2], y + s[i + 3], col); for (const s of glyph) for (let i = 0; i < s.length - 2; i += 4) rect(c, x + s[i], y + s[i + 1], 1, 1, C.wh); }
  else { glow(c, x + 8 * sc, y + 6 * sc, 34, col, 0.75); c.save(); c.shadowColor = col; c.shadowBlur = 12; c.strokeStyle = col; c.lineWidth = 1.1; c.lineJoin = 'round'; c.lineCap = 'round';
    for (const s of glyph) { c.beginPath(); c.moveTo(x + s[0], y + s[1]); for (let i = 2; i < s.length; i += 2) c.lineTo(x + s[i], y + s[i + 1]); c.stroke(); }
    c.shadowBlur = 0; c.strokeStyle = 'rgba(255,240,245,0.85)'; c.lineWidth = 0.35; for (const s of glyph) { c.beginPath(); c.moveTo(x + s[0], y + s[1]); for (let i = 2; i < s.length; i += 2) c.lineTo(x + s[i], y + s[i + 1]); c.stroke(); } c.restore(); }
}
// flicker driver: returns true/false, irregular buzz
function flick(seed, t, rate = 1) { const k = Math.floor(t * 12 * rate); const h = hash2(k, seed, 1); if (h < 0.04) return false; const h2 = hash2(Math.floor(t * 0.7), seed, 2); if (h2 < 0.12) return hash2(k, seed, 3) > 0.5; return true; }
// vignette
const vigCache = {};
function vignette() { const key = G.mode; if (vigCache[key]) return vigCache[key]; const S = G.S, cv = makeCanvas(NW * S, NH * S), c = cv.getContext('2d');
  const g = c.createRadialGradient(NW * S / 2, NH * S / 2, NH * S * 0.35, NW * S / 2, NH * S / 2, NW * S * 0.62); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(2,3,8,0.75)'); c.fillStyle = g; c.fillRect(0, 0, cv.width, cv.height);
  if (PIX()) { const im = c.getImageData(0, 0, cv.width, cv.height), d = im.data; for (let i = 0, p = 0; i < d.length; i += 4, p++) { const x = p % cv.width, y = (p / cv.width) | 0; const a = d[i + 3] / 255; d[i + 3] = a > bayer(x, y) * 0.8 + 0.1 ? Math.min(255, Math.round(a * 3) / 3 * 255 + 40) : 0; } c.putImageData(im, 0, 0); }
  return vigCache[key] = cv; }
// ink tendrils for killer's eye (screen edge)
const inkCache = {};
function inkFrame() { const key = G.mode; if (inkCache[key]) return inkCache[key]; const S = G.S, cv = makeCanvas(NW * S, NH * S), c = cv.getContext('2d'); c.scale(S, S); const r = mulberry32(31);
  for (let i = 0; i < 90; i++) { const side = r() * 4 | 0; let x = side === 0 ? r() * NW : side === 1 ? NW : side === 2 ? r() * NW : 0, y = side === 0 ? 0 : side === 1 ? r() * NH : side === 2 ? NH : r() * NH; let a = Math.atan2(NH / 2 - y, NW / 2 - x) + (r() - 0.5) * 1.2, w = 3 + r() * 5;
    c.fillStyle = r() < 0.15 ? C.rd3 : C.k0; for (let k = 0; k < 40 && w > 0.3; k++) { disc(c, x, y, w, c.fillStyle); x += Math.cos(a) * w * 0.8; y += Math.sin(a) * w * 0.8; a += (r() - 0.5) * 0.5; w *= 0.93; } }
  return inkCache[key] = cv; }
