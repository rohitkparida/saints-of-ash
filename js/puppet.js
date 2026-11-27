'use strict';
// ---------- character puppets: parametric skeleton -> cached sprites ----------
const SPR_W = 40, SPR_H = 44, SPR_OX = 20, SPR_OY = 42;
const ANIM = {
  idle: { n: 8, fps: 6 }, walk: { n: 8, fps: 11 }, sneak: { n: 8, fps: 8 }, crouch: { n: 1, fps: 1 },
  jump: { n: 1, fps: 1 }, fall: { n: 2, fps: 8 }, climb: { n: 4, fps: 8 }, inspect: { n: 1, fps: 1 },
  sit: { n: 4, fps: 3 }, talk: { n: 4, fps: 5 }
};
const CHARS = {
  detective: { coat: '#4b4136', coatD: '#332b24', coatL: '#6e5d4e', collar: '#5d4f42', pants: '#1f222b', pantsD: '#15171e', shoe: '#0c0c10', skin: '#b48e74', skinD: '#7d5d4c', hair: '#17141a', shirt: '#8b9cb8', tie: '#2a2629', coatLen: 9.5, hairStyle: 'messy', belt: true },
  vale: { coat: '#24262e', coatD: '#17181e', coatL: '#3b3f4c', collar: '#2e313b', pants: '#24262e', pantsD: '#17181e', shoe: '#07080d', skin: '#cfae96', skinD: '#94735f', hair: '#2a2629', shirt: '#f2eee4', tie: '#8a1020', pocket: '#ff2a2a', coatLen: 2.5, hairStyle: 'slick', upright: true },
  officer: { coat: '#1a2236', coatD: '#121827', coatL: '#2e3a56', collar: '#232d45', pants: '#1a2236', pantsD: '#121827', shoe: '#07080d', skin: '#a8826a', skinD: '#6f5444', hair: '#1c1a1f', shirt: '#2e3a56', tie: '#121827', coatLen: 3, hairStyle: 'cap', badge: '#d9b25a' },
  tom: { coat: '#3b3433', coatD: '#2a2629', coatL: '#52463f', collar: '#6e4a3f', pants: '#2b1f22', pantsD: '#1c1a1f', shoe: '#1c1a1f', skin: '#9c7a64', skinD: '#6a4f40', hair: '#8f8a82', shirt: '#553833', tie: '#3d2a29', coatLen: 7, hairStyle: 'beanie', beanie: '#6e2a2a' },
  ghost: { coat: '#39e6ff', coatD: '#1a8fb3', coatL: '#b7f4ff', collar: '#39e6ff', pants: '#1a8fb3', pantsD: '#0f4a63', shoe: '#0f4a63', skin: '#b7f4ff', skinD: '#39e6ff', hair: '#1a8fb3', shirt: '#b7f4ff', tie: '#1a8fb3', coatLen: 9.5, hairStyle: 'slick' }
};

// pose: angles in radians; 0 = straight down, positive = toward facing direction.
// leg: th (thigh), kn (knee bend, shin abs angle = th - kn). arm: sh (upper), fa (forearm absolute).
function basePose() { return { hip: null, lean: 0.4, bob: 0, thB: 0, knB: 0.05, thF: 0, knF: 0.05, shB: -0.05, faB: 0.15, shF: 0.08, faF: 0.25, sway: 0, tilt: 0, hemUp: 0 }; }
function getPose(ch, state, f) {
  const P = basePose(); const TAU = Math.PI * 2;
  if (state === 'idle' || state === 'talk') {
    const br = [0, 0, -0.35, -0.5, -0.5, -0.35, 0, 0][f % 8];
    P.bob = br; P.sway = Math.sin(f / 8 * TAU) * 0.35; P.thF = 0.08; P.thB = -0.06; P.knF = 0.1;
    if (ch === 'detective' && state === 'idle') {
      if (f >= 4 && f <= 6) { P.shF = 0.95; P.faF = 3.45; P.tilt = -0.1; } else { P.shF = 0.12; P.faF = 0.75; }
    }
    if (state === 'talk') { const g = [0.6, 0.9, 1.15, 0.8][f % 4]; P.shF = 0.35; P.faF = g + 0.4; P.bob = f % 2 ? -0.3 : 0; }
    if (ch === 'vale') { P.lean = 0.1; P.shB = 0.0; P.faB = 0.05; if (state === 'idle') { P.shF = 0.05; P.faF = 0.1; } }
  } else if (state === 'walk') {
    const p = f / 8 * TAU; const s = Math.sin(p), c = Math.cos(p);
    P.thF = s * 0.52; P.thB = -s * 0.52; P.knF = 0.12 + 0.95 * Math.max(0, c); P.knB = 0.12 + 0.95 * Math.max(0, -c);
    P.shF = -s * 0.55; P.shB = s * 0.55; P.faF = P.shF + 0.35; P.faB = P.shB + 0.35;
    P.lean = 1.0; P.sway = 1.4 + Math.abs(c) * 0.9; P.bob = -Math.abs(c) * 0.0;
  } else if (state === 'sneak') {
    const p = f / 8 * TAU; const s = Math.sin(p), c = Math.cos(p);
    P.thF = 0.95 + s * 0.38; P.thB = 0.95 - s * 0.38; P.knF = 1.85 + 0.25 * Math.max(0, c); P.knB = 1.85 + 0.25 * Math.max(0, -c);
    P.shF = 0.7; P.faF = 1.4; P.shB = 0.3; P.faB = 0.9; P.lean = 3.0; P.sway = 0.9; P.hemUp = 2;
  } else if (state === 'crouch') {
    P.thF = 1.25; P.knF = 2.3; P.thB = 0.8; P.knB = 2.25; P.shF = 0.6; P.faF = 1.2; P.shB = 0.4; P.faB = 1.0; P.lean = 2.6; P.hemUp = 2.5;
  } else if (state === 'jump') {
    P.hip = -15; P.thF = 0.85; P.knF = 1.45; P.thB = -0.35; P.knB = 0.75; P.shF = -0.6; P.faF = 0.1; P.shB = 0.9; P.faB = 1.5; P.lean = 1.0; P.sway = 2.2; P.hemUp = 1.5;
  } else if (state === 'fall') {
    P.hip = -15; P.thF = 0.35 + (f ? 0.08 : 0); P.knF = 0.6; P.thB = -0.15; P.knB = 0.35; P.shF = 1.2 + (f ? 0.15 : 0); P.faF = 1.9; P.shB = -0.9; P.faB = -0.5; P.lean = 0.6; P.sway = -0.6; P.hemUp = 3.5;
  } else if (state === 'climb') {
    const a = f % 2 === 0;
    P.hip = -15; P.lean = 1.2;
    P.thF = a ? 0.95 : 0.25; P.knF = a ? 1.9 : 0.6; P.thB = a ? 0.25 : 0.95; P.knB = a ? 0.6 : 1.9;
    P.shF = a ? 2.75 : 2.2; P.faF = a ? 3.1 : 2.75; P.shB = a ? 2.2 : 2.75; P.faB = a ? 2.75 : 3.1;
    P.bob = (f === 1 || f === 3) ? -0.6 : 0; P.sway = 0.2;
  } else if (state === 'inspect') {
    P.hip = -8.5; P.thF = 1.5; P.knF = 1.55; P.thB = -0.25; P.knB = 2.5; P.lean = 3.0; P.shF = 0.95; P.faF = 0.9; P.shB = 0.2; P.faB = 0.7; P.hemUp = 2.5; P.tilt = 0.3;
  } else if (state === 'sit') {
    const br = [0, -0.3, -0.4, -0.2][f % 4];
    P.hip = -4.5 + br * 0.3; P.thF = 1.5; P.knF = 1.35; P.thB = 1.35; P.knB = 1.5; P.lean = -1.4 + br; P.shF = 0.75; P.faF = 1.35; P.shB = 0.55; P.faB = 1.2; P.hemUp = 5.5; P.tilt = 0.25;
  }
  return P;
}
const LT = 7, LS = 7, UA = 5.3, FA = 4.8;
function legReach(th, kn) { return LT * Math.cos(th) + LS * Math.cos(th - kn); }

function skeleton(ch, state, f) {
  const P = getPose(ch, state, f); const D = CHARS[ch] || CHARS.detective;
  let hipY = P.hip;
  if (hipY === null) hipY = -Math.max(legReach(P.thF, P.knF), legReach(P.thB, P.knB)) + 0.2;
  hipY += P.bob;
  const hip = { x: 0, y: hipY };
  const lean = D.upright ? Math.min(P.lean, 0.6) + (P.lean - 0.4) * 0.3 : P.lean;
  const sh = { x: hip.x + lean, y: hip.y - 11 };
  const leg = (th, kn) => { const k = { x: hip.x + Math.sin(th) * LT, y: hip.y + Math.cos(th) * LT }; const a2 = th - kn; const ft = { x: k.x + Math.sin(a2) * LS, y: k.y + Math.cos(a2) * LS }; return { k, ft }; };
  const arm = (s, fa, ox) => { const o = { x: sh.x + ox, y: sh.y + 0.6 }; const e = { x: o.x + Math.sin(s) * UA, y: o.y + Math.cos(s) * UA }; const h = { x: e.x + Math.sin(fa) * FA, y: e.y + Math.cos(fa) * FA }; return { o, e, h }; };
  const head = { x: sh.x + 0.7 + Math.sin(P.tilt) * 1.2, y: sh.y - 3.6 + Math.abs(P.tilt) * 0.5 };
  return { P, D, hip, sh, legF: leg(P.thF, P.knF), legB: leg(P.thB, P.knB), armF: arm(P.shF, P.faF, 0.6), armB: arm(P.shB, P.faB, -0.9), head };
}

function drawPuppet(c, ch, state, f) {
  const K = skeleton(ch, state, f), { P, D, hip, sh, legF, legB, armF, armB, head } = K;
  c.lineCap = 'round'; c.lineJoin = 'round';
  const seg = (a, b, w, col) => { c.strokeStyle = col; c.lineWidth = w; c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.stroke(); };
  const foot = (L, col) => { c.fillStyle = col; c.beginPath(); c.ellipse(L.ft.x + 0.8, L.ft.y - 0.7, 1.55, 0.9, 0, 0, Math.PI * 2); c.fill(); };
  const arm = (A, colU, colF, skin) => { seg(A.o, A.e, 2.1, colU); seg(A.e, A.h, 1.8, colF); c.fillStyle = skin; c.beginPath(); c.arc(A.h.x, A.h.y, 0.95, 0, Math.PI * 2); c.fill(); };
  // back arm + back leg (shadowed)
  arm(armB, D.coatD, D.coatD, D.skinD);
  seg(hip, legB.k, 2.7, D.pantsD); seg(legB.k, legB.ft, 2.3, D.pantsD); foot(legB, D.shoe);
  seg({ x: hip.x + 0.4, y: hip.y }, legF.k, 2.8, D.pants); seg(legF.k, legF.ft, 2.3, D.pants); foot(legF, D.shoe);
  // coat body
  const hemY = hip.y + D.coatLen - P.hemUp; const sway = P.sway;
  const backHem = { x: hip.x - 3.6 - sway * (D.coatLen > 5 ? 1 : 0.3), y: hemY + (D.coatLen > 5 ? -sway * 0.35 : 0) };
  const frontHem = { x: hip.x + 3.1 + Math.max(0, Math.sin(P.thF)) * (D.coatLen > 5 ? 2.2 : 0.8), y: hemY };
  c.fillStyle = D.coat; c.beginPath();
  c.moveTo(sh.x - 2.6, sh.y - 0.3);
  c.quadraticCurveTo(sh.x - 3.2, sh.y + 4, hip.x - 2.9, hip.y);
  c.lineTo(backHem.x, backHem.y);
  c.lineTo((backHem.x + frontHem.x) / 2, hemY + 0.6);
  c.lineTo(frontHem.x, frontHem.y);
  c.lineTo(hip.x + 2.6, hip.y - 1);
  c.quadraticCurveTo(sh.x + 3.4, sh.y + 5, sh.x + 2.6, sh.y - 0.2);
  c.closePath(); c.fill();
  // shading: back half of coat darker, front opening
  c.save(); c.clip();
  c.fillStyle = D.coatD; c.globalAlpha = 0.55; c.fillRect(hip.x - 8, sh.y - 2, 5.2 + (sh.x - hip.x) * 0.5, 30); c.globalAlpha = 1;
  if (D.coatLen > 5) { c.strokeStyle = D.coatD; c.lineWidth = 0.9; c.beginPath(); c.moveTo(sh.x + 1.9, sh.y + 2.5); c.lineTo(hip.x + 2.2, hip.y + 1); c.lineTo(frontHem.x - 0.6, hemY); c.stroke(); }
  if (D.belt) { c.fillStyle = D.coatD; c.fillRect(hip.x - 4, hip.y - 2.6, 8, 1.1); }
  c.restore();
  // shirt / tie at chest opening
  c.fillStyle = D.shirt; c.beginPath(); c.moveTo(sh.x + 1.2, sh.y - 0.4); c.lineTo(sh.x + 2.6, sh.y - 0.2); c.lineTo(sh.x + 2.3, sh.y + 3.2); c.closePath(); c.fill();
  c.strokeStyle = D.tie; c.lineWidth = 0.9; c.beginPath(); c.moveTo(sh.x + 2.0, sh.y); c.lineTo(sh.x + 2.1, sh.y + 3.4); c.stroke();
  if (D.pocket) { c.fillStyle = D.pocket; c.fillRect(sh.x + 0.6, sh.y + 2.2, 1.2, 0.8); }
  if (D.badge) { c.fillStyle = D.badge; c.fillRect(sh.x + 0.6, sh.y + 2.0, 1.0, 1.0); }
  // collar
  c.fillStyle = D.collar; c.beginPath(); c.moveTo(sh.x - 2.4, sh.y + 0.6); c.lineTo(sh.x - 0.6, sh.y - 2.2); c.lineTo(sh.x + 0.6, sh.y + 0.4); c.lineTo(sh.x + 1.2, sh.y + 2.6); c.closePath(); c.fill();
  if (D.coatL) { c.strokeStyle = D.coatL; c.lineWidth = 0.6; c.beginPath(); c.moveTo(sh.x - 2.4, sh.y + 0.6); c.lineTo(sh.x - 0.6, sh.y - 2.2); c.stroke(); }
  // neck + head
  seg({ x: sh.x + 0.4, y: sh.y - 0.4 }, { x: head.x - 0.1, y: head.y + 1.6 }, 1.6, D.skinD);
  c.fillStyle = D.skin; c.beginPath(); c.arc(head.x, head.y, 2.6, 0, Math.PI * 2); c.fill();
  c.fillStyle = D.skinD; c.beginPath(); c.arc(head.x - 0.9, head.y + 0.7, 1.7, 0, Math.PI * 2); c.fill(); // jaw shadow / back of head
  c.fillStyle = D.skin; c.beginPath(); c.arc(head.x + 0.7, head.y + 0.2, 1.9, 0, Math.PI * 2); c.fill();
  c.fillStyle = D.hair;
  if (D.hairStyle === 'messy') {
    c.beginPath(); c.arc(head.x - 0.5, head.y - 0.7, 2.75, Math.PI * 0.72, Math.PI * 2.05); c.closePath(); c.fill();
    c.beginPath(); c.moveTo(head.x - 3.2, head.y - 0.4); c.lineTo(head.x - 2.2, head.y + 1.8); c.lineTo(head.x - 1.2, head.y - 0.6); c.fill();
    c.beginPath(); c.moveTo(head.x + 1.0, head.y - 3.0); c.lineTo(head.x + 3.0, head.y - 1.6); c.lineTo(head.x + 1.5, head.y - 1.6); c.fill();
    c.beginPath(); c.moveTo(head.x - 1.5, head.y - 3.0); c.lineTo(head.x - 0.8, head.y - 4.0); c.lineTo(head.x + 0.2, head.y - 3.0); c.fill();
  } else if (D.hairStyle === 'slick') {
    c.beginPath(); c.arc(head.x - 0.3, head.y - 0.5, 2.7, Math.PI * 0.85, Math.PI * 1.95); c.closePath(); c.fill();
    c.beginPath(); c.moveTo(head.x - 2.9, head.y - 0.6); c.lineTo(head.x - 2.0, head.y + 1.0); c.lineTo(head.x - 1.0, head.y - 0.8); c.fill();
  } else if (D.hairStyle === 'cap') {
    c.beginPath(); c.arc(head.x - 0.2, head.y - 0.8, 2.75, Math.PI, Math.PI * 2); c.closePath(); c.fill();
    c.fillStyle = '#121827'; c.fillRect(head.x - 3.0, head.y - 2.2, 5.8, 1.6); c.fillRect(head.x + 1.5, head.y - 1.2, 2.6, 0.9);
    c.fillStyle = '#d9b25a'; c.fillRect(head.x + 0.3, head.y - 2.0, 0.9, 0.9);
  } else if (D.hairStyle === 'beanie') {
    c.fillStyle = D.beanie; c.beginPath(); c.arc(head.x - 0.2, head.y - 0.6, 2.85, Math.PI * 0.95, Math.PI * 2.02); c.closePath(); c.fill();
    c.fillStyle = D.hair; c.fillRect(head.x + 0.4, head.y + 1.0, 2.0, 1.2); // grey beard
  }
  // eye
  c.fillStyle = '#0c0c10'; c.fillRect(head.x + 1.2, head.y - 0.1, 0.8, 0.7);
  // front arm last (over coat)
  arm(armF, D.coatL, D.coatL, D.skin);
  return K;
}

const _spriteCache = new Map();
function clearSpriteCache() { _spriteCache.clear(); }
function selOut(cv) {
  const c = cv.getContext('2d'), W = cv.width, H = cv.height, im = c.getImageData(0, 0, W, H), d = im.data, src = new Uint8ClampedArray(d);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 4; if (src[i + 3]) continue;
    let n = -1; const nb = [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]];
    for (const [nx, ny] of nb) { if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue; const j = (ny * W + nx) * 4; if (src[j + 3]) { n = j; break; } }
    if (n < 0) continue;
    const q = PAL[nearestPal(src[n] * 0.42, src[n + 1] * 0.42, src[n + 2] * 0.48)];
    d[i] = q[0]; d[i + 1] = q[1]; d[i + 2] = q[2]; d[i + 3] = 255;
  }
  c.putImageData(im, 0, 0);
}
function getSprite(ch, state, frame) {
  const a = ANIM[state] || ANIM.idle; const f = ((frame % a.n) + a.n) % a.n;
  const key = ch + '|' + state + '|' + f; let s = _spriteCache.get(key); if (s) return s;
  const S = G.S, cv = makeCanvas(SPR_W * S, SPR_H * S), c = cv.getContext('2d');
  c.setTransform(S, 0, 0, S, SPR_OX * S, SPR_OY * S);
  drawPuppet(c, ch, state, f);
  { snapCanvas(cv, 0, 100); if (ch !== 'ghost') selOut(cv); }
  s = { cv, ox: SPR_OX, oy: SPR_OY }; _spriteCache.set(key, s); return s;
}
function emberPos(state, frame) {
  if (state !== 'idle') return null; const K = skeleton('detective', 'idle', frame % 8); const h = K.armF.h;
  return { x: h.x + 0.6, y: h.y - 0.4 };
}
const _tmp = makeCanvas(SPR_W * 4, SPR_H * 4), _tctx = _tmp.getContext('2d');
function drawChar(ctx, ch, x, y, face, state, frame, opt = {}) {
  const sp = getSprite(ch, state, frame), w = sp.cv.width, h = sp.cv.height;
  _tctx.setTransform(1, 0, 0, 1, 0, 0); _tctx.globalCompositeOperation = 'source-over'; _tctx.globalAlpha = 1;
  _tctx.clearRect(0, 0, _tmp.width, _tmp.height); _tctx.drawImage(sp.cv, 0, 0);
  _tctx.globalCompositeOperation = 'source-atop';
  if (opt.silhouette) { _tctx.fillStyle = opt.silhouette; _tctx.fillRect(0, 0, w, h); }
  else if (opt.ghost || ch === 'ghost') { _tctx.fillStyle = 'rgba(57,230,255,0.35)'; _tctx.fillRect(0, 0, w, h); }
  else {
    let L = opt.light === undefined ? 1 : clamp(opt.light, 0, 1); L = Math.round(L * 3) / 3;
    if (L < 1) { _tctx.fillStyle = `rgba(6,8,16,${(1 - L) * 0.74})`; _tctx.fillRect(0, 0, w, h); }
    if (opt.lightCol && L > 0) { _tctx.fillStyle = rgba(opt.lightCol, L * 0.2); _tctx.fillRect(0, 0, w, h); }
  }
  { x = Math.round(x); y = Math.round(y); }
  ctx.save(); ctx.imageSmoothingEnabled = false;
  if (opt.alpha !== undefined) ctx.globalAlpha *= opt.alpha;
  if (opt.ghost || ch === 'ghost') ctx.globalCompositeOperation = 'lighter';
  if (face < 0) { ctx.translate(x, 0); ctx.scale(-1, 1); ctx.translate(-x, 0); }
  ctx.drawImage(_tmp, 0, 0, w, h, x - sp.ox, y - sp.oy, SPR_W, SPR_H);
  ctx.restore();
}
