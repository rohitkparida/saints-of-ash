'use strict';
// ================= setup =================
const view = document.getElementById('view'), ui = document.getElementById('ui');
let ctx = view.getContext('2d'); const uctx = ui.getContext('2d');
let cssW = 0, cssH = 0;
function layout() {
  const f = fitNW(), S = G.S; view.width = NW * S; view.height = NH * S;
  cssW = f.w; cssH = f.h; const top = (innerHeight - cssH) / 2 | 0; // whole-number scale: every native pixel is k x k screen pixels
  for (const el of [view, ui]) { el.style.width = cssW + 'px'; el.style.height = cssH + 'px'; el.style.left = ((innerWidth - cssW) / 2 | 0) + 'px'; el.style.top = top + 'px'; }
  view.style.imageRendering = 'pixelated'; placeBleed(view, top, cssH);
  const dpr = window.devicePixelRatio || 1; ui.width = cssW * dpr; ui.height = cssH * dpr; if (UI.resize) UI.resize(cssW, cssH, dpr);
  ctx = view.getContext('2d');
}
addEventListener('resize', layout);
ui.addEventListener('mousedown', e => { const b = ui.getBoundingClientRect(); if (UI.handleClick) UI.handleClick(e.clientX - b.left, e.clientY - b.top); });
ui.addEventListener('mousemove', e => { const b = ui.getBoundingClientRect(); if (UI.handleMove) UI.handleMove(e.clientX - b.left, e.clientY - b.top); });

// ================= state =================
const game = {
  clues: [], deductions: [], objective: 'Search the alley behind the Blue Hour.', sanity: 100, fade: 1, eye: 0, warp: 0,
  flags: {}, talk: {}, started: false,
  tryLink(a, b) {
    const k = [a, b].sort().join('+'); const D = DEDUCTIONS[k]; if (!D || this.deductions.find(d => d.id === D.id)) return null;
    const d = { id: D.id, a, b, text: D.text }; this.deductions.push(d); Sound.sfx('deduce');
    if (this.deductions.length >= 3 && !this.flags.breakthrough) { this.flags.breakthrough = true; setObjective('Go back to the sigil in the alley. Hold Q, and press E.'); }
    else setObjective(`Deductions ${this.deductions.length}/3. Keep linking what you've found.`);
    return d;
  },
};
const DEDUCTIONS = {
  'file+petals': { id: 'saints', text: 'He arranges them like saints. Lilies for purity, gold for the halo. This is not rage. It is devotion.' },
  'landing+sigil': { id: 'watcher', text: 'He marks the ground, then watches from above. The alley is his chapel. The fire escape is his pew.' },
  'phone+shadow': { id: 'called', text: 'He called me to the scene himself. He wants to be seen. He has been watching me the whole time.' },
};
function setObjective(t) { game.objective = t; if (UI.toast) UI.toast(t); }

const P = { x: 60, y: 184, vx: 0, vy: 0, onGround: true, face: 1, climb: null, cs: 0, state: 'idle', animT: 0, frame: 0, drop: 0, inspectT: 0, stepF: -1 };
let area = null, caches = {}, cam = 0, steam = [], rain = makeRain(240), splashes = [], ash = makeAsh(120), smoke = [];
let ghostT = 0, train = { t: 12, phase: 'wait', x: 0 }, shake = 0, transitioning = false;

// ================= area & caches =================
function buildArea(id) {
  const key = id; if (caches[key]) return caches[key];
  const A = AREAS[id](); const S = G.S;
  A.layers.forEach((L, li) => {
    const lw = Math.ceil(NW_MAX + Math.max(0, A.w - NW_MAX) * L.par); const cv = makeCanvas(lw * S, NH * S), c = cv.getContext('2d'); c.scale(S, S);
    L.draw(c, { w: lw, world: A.world });
    if (A.world === 'other') { otherRemap(cv, 3 + li, S, true); }
    else postStatic(cv, { blur: L.blur ? L.blur * S * 0.5 : 0 });
    L.cv = cv; L.lw = lw;
    if (A.world !== 'other') { const o = makeCanvas(cv.width, cv.height); o.getContext('2d').drawImage(cv, 0, 0); otherRemap(o, 3 + li, S, true); L.cvO = o; }
  });
  caches[key] = A; return A;
}
function enterArea(id, spawnX) {
  area = buildArea(id); P.x = spawnX; P.y = area.ground; P.vx = P.vy = 0; P.climb = null; P.onGround = true; steam = [];
  cam = clamp(P.x - NW / 2, 0, area.w - NW); game.areaId = id;
  if (UI.toast) UI.toast(area.title + '. ' + area.sub);
}
function goTo(id, spawnX, sfx = 'door') {
  if (transitioning) return; transitioning = true; Sound.sfx(sfx);
  const t0 = performance.now(); const fadeOut = () => { const k = (performance.now() - t0) / 450; game.fade = Math.min(1, k); if (k < 1) requestAnimationFrame(fadeOut); else { enterArea(id, spawnX); const t1 = performance.now(); const fadeIn = () => { const k2 = (performance.now() - t1) / 700; game.fade = Math.max(0, 1 - k2); if (k2 < 1) requestAnimationFrame(fadeIn); else transitioning = false; }; fadeIn(); } }; fadeOut();
}

// ================= physics =================
function surfaces() { return area.platforms; }
function updatePlayer() {
  const busy = UI.open || transitioning || !game.started;
  const L = !busy && In.left(), R = !busy && In.right(), U = !busy && In.up(), D = !busy && In.down(), sneak = !busy && In.sneak();
  const jump = !busy && In.hit('Space');
  const prevY = P.y;
  if (P.inspectT > 0) { P.inspectT -= 1 / 60; P.vx *= 0.7; }
  if (P.climb) {
    const l = P.climb, vert = l.x1 === l.x2; let dir = 0;
    if (vert) dir = (U ? 1 : 0) - (D ? 1 : 0);
    else { const rightIsUp = l.x2 > l.x1; dir = (U || (rightIsUp ? R : L) ? 1 : 0) - (D || (rightIsUp ? L : R) ? 1 : 0); }
    const len = Math.hypot(l.x2 - l.x1, l.y2 - l.y1); P.cs = clamp(P.cs + dir * (vert ? 0.85 : 0.95) / len, 0, 1);
    P.x = lerp(l.x1, l.x2, P.cs); P.y = lerp(l.y1, l.y2, P.cs);
    if (!vert && dir) P.face = (dir > 0) === (l.x2 > l.x1) ? 1 : -1;
    P.moving = dir !== 0;
    if ((P.cs >= 1 && dir > 0) || (P.cs <= 0 && dir < 0)) { P.climb = null; P.onGround = true; }
    else if (jump && vert) { P.climb = null; P.vy = -2.5; P.vx = (R ? 1 : L ? -1 : 0) * 1.2; }
  } else {
    const sp = sneak ? 0.55 : 1.15; const target = (R ? 1 : 0) - (L ? 1 : 0);
    P.vx = lerp(P.vx, target * sp, P.onGround ? 0.25 : 0.08); if (target) P.face = target;
    // ladder / stairs entry
    if (U || D) for (const l of area.ladders) {
      const vert = l.x1 === l.x2;
      if (vert) { const top = Math.min(l.y1, l.y2), bot = Math.max(l.y1, l.y2); if (Math.abs(P.x - l.x1) < 6 && ((U && P.y > top + 1 && P.y <= bot + 1) || (D && Math.abs(P.y - top) < 2))) { P.climb = l; P.cs = clamp((P.y - l.y1) / (l.y2 - l.y1), 0, 1); if (D && Math.abs(P.y - top) < 2) P.cs = (top === l.y2) ? 0.98 : 0.02; P.vx = P.vy = 0; break; } }
      else { if (U && Math.abs(P.x - l.x1) < 8 && Math.abs(P.y - l.y1) < 3) { P.climb = l; P.cs = 0; break; } if (D && Math.abs(P.x - l.x2) < 8 && Math.abs(P.y - l.y2) < 3) { P.climb = l; P.cs = 1; break; } }
    }
    if (!P.climb) {
      if (jump && P.onGround) { if (D && P.y < area.ground) { P.drop = 14; P.onGround = false; } else { P.vy = -4.4; P.onGround = false; } }
      P.vy = Math.min(5, P.vy + 0.24); P.x += P.vx; P.y += P.vy; if (P.drop > 0) P.drop--;
      P.x = clamp(P.x, 6, area.w - 6);
      const was = P.onGround; P.onGround = false;
      if (P.y >= area.ground) { P.y = area.ground; P.vy = 0; P.onGround = true; }
      else if (P.vy >= 0 && !P.drop) for (const s of surfaces()) if (P.x >= s.x && P.x <= s.x + s.w && prevY <= s.y + 0.5 && P.y >= s.y) { P.y = s.y; P.vy = 0; P.onGround = true; }
      if (!was && P.onGround && P.vy === 0 && prevY < P.y - 0.5) {}
      if (!was && P.onGround) Sound.sfx('land');
      P.moving = Math.abs(P.vx) > 0.12;
    }
  }
  // state
  let st;
  if (P.climb) st = P.climb.x1 === P.climb.x2 ? 'climb' : (P.moving ? 'walk' : 'idle');
  else if (P.inspectT > 0) st = 'inspect';
  else if (!P.onGround) st = P.vy < 0 ? 'jump' : 'fall';
  else if (P.moving) st = sneak ? 'sneak' : 'walk';
  else st = sneak ? 'crouch' : 'idle';
  if (st !== P.state) { P.state = st; P.animT = 0; }
  const an = ANIM[st] || { n: 1, fps: 8 };
  if (st === 'climb' && !P.moving) {} else P.animT += 1 / 60;
  P.frame = Math.floor(P.animT * an.fps) % an.n;
  if ((st === 'walk' || st === 'sneak') && (P.frame === 0 || P.frame === 4) && P.stepF !== P.frame) Sound.step(area.rain);
  if (st === 'climb' && P.moving && P.frame % 2 === 0 && P.stepF !== P.frame) Sound.sfx('rung');
  P.stepF = P.frame;
}

// ================= light / helpers =================
function lightAt(x, y) {
  let l = area.ambient; for (const L of area.lights) { if (L.flicker && !flick(L.flicker, G.t, L.kind === 'tube' ? 1.3 : 0.8)) continue; const d = Math.hypot(x - L.x, (y - L.y) * 0.8); if (d < L.r) l += L.i * Math.pow(1 - d / L.r, 1.3); }
  if (area.world === 'other') l *= 0.8; return clamp(l, 0, 1);
}
function nearLightCol(x, y) { let best = null, bd = 1e9; for (const L of area.lights) { const d = Math.hypot(x - L.x, y - L.y); if (d < bd) { bd = d; best = L; } } return best ? (area.world === 'other' ? C.rd : best.col) : C.b8; }
function ghostPos(path, u) {
  let tot = 0; const seg = []; for (let i = 1; i < path.length; i++) { const l = Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]); seg.push(l); tot += l; }
  let d = u * tot; for (let i = 0; i < seg.length; i++) { if (d <= seg[i]) { const k = d / seg[i], a = path[i], b = path[i + 1]; return { x: lerp(a[0], b[0], k), y: lerp(a[1], b[1], k), vert: Math.abs(a[0] - b[0]) < 1, face: b[0] >= a[0] ? 1 : -1 }; } d -= seg[i]; }
  const e = path[path.length - 1]; return { x: e[0], y: e[1], vert: false, face: 1 };
}
function snapshot(cx, cy) { // copy a region of the current frame around world point for the Polaroid
  const S = G.S, w = 72, h = 56, sx = clamp(Math.round(cx - cam - w / 2), 0, NW - w), sy = clamp(Math.round(cy - h + 14), 0, NH - h);
  const cv = makeCanvas(w * 4, h * 4), c = cv.getContext('2d'); c.imageSmoothingEnabled = false; c.drawImage(view, sx * S, sy * S, w * S, h * S, 0, 0, w * 4, h * 4); return cv;
}

// ================= interaction =================
function interactables() {
  const out = [], ey = game.eye > 0.5;
  for (const n of area.npcs) out.push({ kind: 'npc', x: n.x, y: area.ground, r: 16, label: n.id === 'vale' ? 'Talk to Vale' : n.id === 'tom' ? 'Talk to Tom' : 'Talk', ref: n });
  for (const c of area.clues) { if (game.clues.find(k => k.id === c.id)) continue; if (c.hidden && !ey) continue; out.push({ kind: 'clue', x: c.x, y: c.y, r: 14, label: 'Inspect', ref: c }); }
  for (const s of area.special || []) out.push({ kind: s.id, x: s.x, y: s.y, r: s.r, label: s.label });
  for (const e of area.exits) out.push({ kind: 'exit', x: e.x + e.w / 2, y: area.ground, r: e.w / 2 + 6, label: e.label, ref: e });
  if (area.id === 'alley' && game.flags.breakthrough && ey) out.push({ kind: 'portal', x: 566, y: area.ground, r: 16, label: 'Step through' });
  if (area.id === 'other') out.push({ kind: 'tableau', x: 566, y: area.ground, r: 22, label: 'Look at what he made' });
  return out;
}
function nearestInteract() { let best = null, bd = 1e9; for (const it of interactables()) { const d = Math.abs(P.x - it.x); if (d < it.r && Math.abs(P.y - it.y) < 14 && d < bd) { bd = d; best = it; } } return best; }
function interact(it) {
  if (it.kind === 'npc') { const id = it.ref.id; const lines = dialogFor(id); P.face = it.x > P.x ? 1 : -1; it.ref.face = -P.face; UI.say(lines); game.talk[id] = (game.talk[id] || 0) + 1; }
  else if (it.kind === 'clue') {
    const c = it.ref; P.inspectT = 0.7; Sound.sfx('clue');
    game.clues.push({ id: c.id, title: c.title, note: c.note, snap: snapshot(c.x, c.y), area: area.title });
    UI.say([{ who: '', text: c.note }], () => { const n = game.clues.length; if (n === 1) setObjective('Take what you find to the cork board at Precinct 9 (west, past the parked car).'); else if (!game.flags.breakthrough) setObjective(`Clues ${n}/6. Link pairs on the cork board. N opens your notebook.`); });
  }
  else if (it.kind === 'board') { Sound.sfx('page'); UI.openBoard(); }
  else if (it.kind === 'exit') goTo(it.ref.to, it.ref.spawn);
  else if (it.kind === 'portal') { game.flags.crossed = true; goTo('other', 520, 'warp'); setTimeout(() => setObjective('Find what he left for you.'), 1300); }
  else if (it.kind === 'tableau') { P.inspectT = 1; Sound.sfx('warp'); UI.say([
      { who: '', text: 'A woman, seated like an altarpiece. Gold leaf on her eyelids. Lilies in her lap. Every candle burning the same height.' },
      { who: '', text: 'It is beautiful. That is the worst part. I understand exactly why he chose each thing.' },
      { who: 'VALE', text: 'You see it now, don\'t you? Most people only ever look. You... composed it with him, just now. In your head.' },
      { who: '', text: 'Vale isn\'t here. Vale was never here. So why can I smell his cologne?' },
    ], () => UI.ending([
      'CASE 01 - THE LILY SAINT', 'Unresolved.', '',
      `Clues ${game.clues.length}/6   Deductions ${game.deductions.length}/3`, '',
      'Thank you for playing this slice.',
    ], () => location.reload())); }
}
function dialogFor(id) {
  const n = game.talk[id] || 0, dd = game.deductions.length;
  if (id === 'tom') return n === 0 ? [
    { who: 'TOM', text: 'Rain don\'t wash this alley, detective. It just moves it around.' },
    { who: 'TOM', text: 'Man in a good coat stood up on that fire escape a whole hour. Lit a candle. Like it was church.' },
    { who: 'TOM', text: 'Didn\'t look at me once. People like that don\'t see people like me. Only you do. That\'s your problem.' },
  ] : [{ who: 'TOM', text: 'He hummed when he came down. Hymn. Old one. My mother used to sing it at funerals.' }];
  if (id === 'officer') return [{ who: 'OFFICER DUNN', text: 'Captain went home. Vale\'s been here since midnight. Says he likes the coffee.' }, { who: 'OFFICER DUNN', text: 'Nobody likes the coffee.' }];
  if (id === 'vale') {
    if (game.flags.breakthrough) return [{ who: 'VALE', text: 'There. You feel it, don\'t you? The shape of him.' }, { who: 'VALE', text: 'Go back to the alley. Look the way he looks. It will cost you. But you were never going to stop.' }];
    if (dd > 0) return [{ who: 'VALE', text: `${dd === 1 ? 'One thread' : dd + ' threads'}. Lovely. You work the way a painter does: background first.` }, { who: 'VALE', text: 'Don\'t let them take you off this. They want a monster. You and I know he\'s a man who believes in something.' }];
    if (n === 0) return [
      { who: 'VALE', text: 'Detective. You look like you haven\'t slept since the first one.' },
      { who: 'VALE', text: 'Julian Vale. The Captain asked me to consult. Ritual pathology, if you need a word for it.' },
      { who: 'VALE', text: 'He isn\'t killing them, you know. Not in his mind. He\'s finishing them.' },
      { who: 'YOU', text: 'You sound like you admire him.' },
      { who: 'VALE', text: 'I admire attention. He pays more of it to the dead than anyone ever paid them alive. Bring me what you find. I\'ll help you read it.' },
    ];
    return [{ who: 'VALE', text: 'The board, Detective. Put two things side by side and let them argue. The truth is usually the one that wins quietly.' }];
  }
  return [{ who: '', text: '...' }];
}

// ================= update =================
function update() {
  G.t += 1 / 60;
  if (game.started && !UI.open && !transitioning && In.hit('KeyE')) { const it = nearestInteract(); if (it) interact(it); }
  if (In.hit('KeyN') && game.started && !UI.open) { Sound.sfx('page'); UI.openNotebook(); }
  if (In.hit('KeyM')) Sound.muted = !Sound.muted;
  updatePlayer();
  // killer's eye & sanity
  const wantEye = game.started && !UI.open && In.eye() && game.sanity > 0;
  game.eye = lerp(game.eye, wantEye ? 1 : 0, wantEye ? 0.06 : 0.1);
  if (wantEye) game.sanity = Math.max(0, game.sanity - 9 / 60);
  else if (lightAt(P.x, P.y - 14) > 0.35 && area.world !== 'other') game.sanity = Math.min(100, game.sanity + 2.5 / 60);
  if (area.world === 'other') game.sanity = Math.max(0, game.sanity - 1.2 / 60);
  if (game.sanity <= 0 && !transitioning && !UI.open) { game.sanity = 45; goTo(area.id === 'other' ? 'alley' : area.id, area.id === 'other' ? 566 : (area.exits[0].spawn), 'warp'); setTimeout(() => UI.toast && UI.toast('You come to on the wet floor. Your hands are shaking.'), 900); }
  const bleed = area.world === 'other' ? 0 : clamp((35 - game.sanity) / 35, 0, 1) * 0.55 + game.eye * 0.25;
  game.warp = lerp(game.warp, bleed, 0.05);
  ghostT = (ghostT + 1 / 60 / 10) % 1;
  // particles
  stepSteam(steam, area.vents, G.t);
  const em = P.state === 'idle' && typeof emberPos === 'function' ? emberPos(P.state, P.frame) : null;
  if (em && Math.random() < 0.12) smoke.push({ x: P.x + em.x * P.face, y: P.y + em.y, vx: 0.05 * P.face, vy: -0.18, r: 0.6, life: 0, max: 90 });
  for (let i = smoke.length - 1; i >= 0; i--) { const s = smoke[i]; s.x += s.vx + Math.sin(G.t * 2 + i) * 0.04; s.y += s.vy; s.r += 0.025; if (++s.life > s.max) smoke.splice(i, 1); }
  // train (subway)
  if (area.id === 'subway') { train.t -= 1 / 60; if (train.phase === 'wait' && train.t < 0) { train.phase = 'come'; train.t = 3.5; } else if (train.phase === 'come' && train.t < 0) { train.phase = 'pass'; train.x = area.w + 40; train.t = 99; } else if (train.phase === 'pass') { train.x -= 9; shake = 1.2; if (train.x < -560) { train.phase = 'wait'; train.t = 22 + Math.random() * 14; } } }
  // camera
  const tx = clamp(P.x - NW / 2 + P.face * 26, 0, area.w - NW); cam = lerp(cam, tx, 0.08); if (shake > 0) shake *= 0.92;
  // audio params
  const nearBar = area.id === 'alley' ? clamp(1 - Math.abs(P.x - 308) / 260, 0, 1) : 0;
  Sound.set('rain', area.rain ? 1 : area.id === 'precinct' ? 0.5 : 0.15); Sound.set('muffle', area.interior ? 1 : 0);
  Sound.set('jazz', nearBar * (area.world === 'other' ? 0 : 1)); Sound.set('eye', game.eye); Sound.set('drone', area.world === 'other' ? 1 : 0.15 + (1 - game.sanity / 100) * 0.7);
  Sound.set('heart', clamp((40 - game.sanity) / 40, 0, 1)); Sound.set('train', area.id === 'subway' ? (train.phase === 'come' ? (1 - train.t / 3.5) * 0.4 : train.phase === 'pass' ? 0.9 : 0.03) : 0);
  let buzz = 0; for (const L of area.lights) if ((L.kind === 'neon' || L.kind === 'tube') && Math.abs(L.x - P.x) < 60) buzz = Math.max(buzz, 1 - Math.abs(L.x - P.x) / 60); Sound.set('buzz', buzz);
  Sound.update();
  clearPressed();
}

// ================= render =================
function render() {
  const S = G.S, A = area; ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, view.width, view.height);
  let cx = cam + (shake > 0.05 ? (Math.random() - 0.5) * shake : 0); cx = Math.round(cx);
  const t = G.t, warp = game.warp;
  const drawLayer = L => { const off = cx * L.par * S; ctx.drawImage(L.cv, off, 0, NW * S, NH * S, 0, 0, NW * S, NH * S); if (warp > 0.01 && L.cvO) { ctx.globalAlpha = warp; ctx.drawImage(L.cvO, off, 0, NW * S, NH * S, 0, 0, NW * S, NH * S); ctx.globalAlpha = 1; } };
  const back = A.layers.filter(L => !L.z), front = A.layers.filter(L => L.z === 'front'), fg = A.layers.filter(L => L.z === 'fg');
  for (const L of back) { drawLayer(L); if (L.fogAfter) drawFog(ctx, A.fogKind, cx * 0.4 + t * 4, 96, A.fogA * (0.7 + warp * 0.4)); }
  // world space
  ctx.setTransform(S, 0, 0, S, -cx * S, 0);
  A.dynamicBack(ctx, t, game);
  if (A.id === 'subway') { drawWallShadow(ctx); drawTrain(ctx, t); }
  ctx.setTransform(1, 0, 0, 1, 0, 0); for (const L of front) drawLayer(L); ctx.setTransform(S, 0, 0, S, -cx * S, 0);
  // clue glints
  for (const c of A.clues) { if (game.clues.find(k => k.id === c.id)) continue; if (c.hidden) continue; const ph = (t * 0.6 + hash1(c.x)) % 1; if (ph < 0.12) { const a = Math.sin(ph / 0.12 * Math.PI); rect(ctx, c.x, c.y - 3, 1, 1, rgba(C.wh, a)); rect(ctx, c.x - 1, c.y - 3, 3, 1, rgba(C.wh, a * 0.4)); rect(ctx, c.x, c.y - 4, 1, 3, rgba(C.wh, a * 0.4)); } }
  if (A.id === 'alley' && game.eye > 0.05) drawSigil(ctx, t, game.eye);
  // killer's eye: footprints + ghost
  if (A.ghost && game.eye > 0.05) {
    ctx.globalAlpha = game.eye * 0.7; for (let i = 1; i < A.ghost.length; i++) { const a = A.ghost[i - 1], b = A.ghost[i]; if (Math.abs(a[1] - b[1]) > 1) continue; const n = Math.abs(b[0] - a[0]) / 9 | 0; for (let k = 0; k < n; k++) { const x = lerp(a[0], b[0], k / n); rect(ctx, x + (k % 2) * 2, a[1] - 1, 2, 1, C.rd); } } ctx.globalAlpha = 1;
    const gp = ghostPos(A.ghost, ghostT); const gs = gp.vert ? 'climb' : 'walk'; const an = ANIM[gs];
    drawChar(ctx, 'ghost', gp.x, gp.y, gp.face, gs, Math.floor(t * an.fps) % an.n, { ghost: true, alpha: game.eye * (0.55 + 0.25 * Math.sin(t * 7)) });
  }
  // npcs
  for (const n of A.npcs) { const an = ANIM[n.state]; drawChar(ctx, n.char, n.x, A.ground, n.face, n.state, Math.floor(t * an.fps + n.x) % an.n, { light: lightAt(n.x, A.ground - 14), lightCol: nearLightCol(n.x, A.ground) }); }
  // steam & smoke
  drawSteam(ctx, steam, A.world === 'other' ? C.a1 : null);
  for (const s of smoke) { const a = Math.sin(Math.PI * s.life / s.max) * 0.35; rect(ctx, s.x, s.y, 1, 1, rgba(C.b9, a)); }
  // player
  drawChar(ctx, 'detective', P.x, P.y, P.face, P.state, P.frame, { light: Math.max(0.42, lightAt(P.x, P.y - 14)), lightCol: nearLightCol(P.x, P.y) });
  if (P.state === 'idle' && typeof emberPos === 'function') { const em = emberPos('idle', P.frame); if (em) { const ex = P.x + em.x * P.face, ey = P.y + em.y; rect(ctx, ex, ey, 1, 1, C.s4); glow(ctx, ex, ey, 4, C.s3, 0.4 + 0.3 * Math.sin(t * 5)); } }
  // reflections in puddles (screen space copy)
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  for (const p of A.puddles) { const sx = p.x - cx; if (sx > NW || sx + p.w < 0) continue; ctx.globalAlpha = 0.5;
    for (let r = 0; r < 7; r++) { const ww = p.w * (1 - (r / 7) ** 2 * 0.5), x0 = sx + (p.w - ww) / 2; const srcY = A.ground - 1 - r * 2; const rip = Math.round(Math.sin(t * 2.5 + r * 1.7 + p.x) * 0.7);
      if (x0 + rip < 0) continue; ctx.drawImage(view, Math.max(0, (x0 + rip)) * S, srcY * S, ww * S, S, x0 * S, (A.ground + 1 + r) * S, ww * S, S); }
    ctx.globalAlpha = 1; }
  // rain / ash / fg
  ctx.setTransform(S, 0, 0, S, 0, 0);
  if (A.rain) drawRain(ctx, rain, cx, A.ground, 1, splashes);
  if (A.ash || warp > 0.3) drawAsh(ctx, ash, cx, t);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  for (const L of fg) drawLayer(L);
  drawFog(ctx, A.fogKind, cx * 1.2 + t * 9, NH - 70, A.fogNear * (1 + warp));
  if (A.world === 'other') { ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = 'rgba(160,90,70,0.35)'; ctx.fillRect(0, 0, view.width, view.height); ctx.globalCompositeOperation = 'source-over'; }
  // killer's eye grade
  if (game.eye > 0.02) {
    ctx.globalCompositeOperation = 'saturation'; ctx.fillStyle = `rgba(128,128,128,${game.eye * 0.85})`; ctx.fillRect(0, 0, view.width, view.height);
    ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = `rgba(150,140,175,${game.eye * 0.6})`; ctx.fillRect(0, 0, view.width, view.height);
    ctx.globalCompositeOperation = 'source-over';
    const sc = 1 + 0.03 * Math.sin(t * 2); const ink = inkFrame(); ctx.globalAlpha = game.eye * 0.95; ctx.drawImage(ink, view.width * (1 - sc) / 2, view.height * (1 - sc) / 2, view.width * sc, view.height * sc); ctx.globalAlpha = 1;
  }
  ctx.globalAlpha = 0.85 + (1 - game.sanity / 100) * 0.15; ctx.drawImage(vignette(), 0, 0); ctx.globalAlpha = 1;
  // UI overlay
  const dpr = window.devicePixelRatio || 1; uctx.setTransform(dpr, 0, 0, dpr, 0, 0); uctx.clearRect(0, 0, cssW, cssH);
  if (game.started && !UI.open && !transitioning) { const it = nearestInteract(); if (it) { const k = cssW / NW; UI.prompt((it.x - cx) * k, (it.y - 40) * k, 'E  ' + it.label); } }
  UI.draw(uctx, cssW, cssH, game);
}
function drawSigil(c, t, e) {
  const x = 566, y = 146, a = e * (0.7 + 0.3 * Math.sin(t * 3));
  glow(c, x, y, 26, C.rd, a * 0.6);
  c.save(); c.globalAlpha = a; c.strokeStyle = C.rd; c.lineWidth = 1;
  c.beginPath(); c.ellipse(x, y - 12, 10, 3, 0, 0, 6.283); c.stroke();
  c.beginPath(); c.moveTo(x - 7, y + 12); c.lineTo(x - 7, y - 2); c.lineTo(x - 4, y - 6); c.lineTo(x - 4, y + 2); c.moveTo(x - 4, y - 6); c.lineTo(x - 1, y - 8); c.lineTo(x - 1, y + 2); c.moveTo(x - 1, y - 8); c.lineTo(x + 2, y - 7); c.lineTo(x + 2, y + 2); c.moveTo(x + 2, y - 7); c.lineTo(x + 5, y - 4); c.lineTo(x + 5, y + 4); c.lineTo(x + 8, y - 1); c.moveTo(x - 7, y + 12); c.lineTo(x + 5, y + 12); c.stroke();
  c.beginPath(); c.arc(x - 1, y + 3, 2, 0, 6.283); c.stroke();
  for (let i = 0; i < 8; i++) { const an = i / 8 * 6.283; c.beginPath(); c.moveTo(x + Math.cos(an) * 18, y + Math.sin(an) * 18); c.lineTo(x + Math.cos(an) * 22, y + Math.sin(an) * 22); c.stroke(); }
  c.restore();
}
function drawWallShadow(c) {
  const [z0, z1] = area.shadowZone; const inZone = P.x > z0 && P.x < z1 && P.y === area.ground;
  const lx = 560; const sx = P.x + (P.x - lx) * 0.35, sy = 158;
  if (inZone || (P.x > z0 - 40 && P.x < z1 + 40)) {
    if (inZone) { if (!area._frozen) area._frozen = { x: sx, t: G.t }; const f = area._frozen; const reach = Math.min(1, (G.t - f.t) / 2);
      drawChar(c, 'detective', f.x + reach * 4, sy, 1, reach > 0.5 ? 'inspect' : 'idle', 0, { silhouette: 'rgba(6,8,14,0.32)' }); }
    else { area._frozen = null; drawChar(c, 'detective', sx, sy, P.face, P.state, P.frame, { silhouette: 'rgba(6,8,14,0.26)' }); }
  }
}
function drawTrain(c, t) {
  if (train.phase === 'come') { const k = 1 - train.t / 3.5; glow(c, 880, 140, 20 + k * 60, C.s4, 0.3 + k * 0.7); rect(c, 878, 138, 4, 3, C.wh); }
  if (train.phase === 'pass') { for (let i = 0; i < 4; i++) { const x = train.x + i * 140; rect(c, x, 106, 134, 66, C.b5); rect(c, x, 106, 134, 3, C.b7); rect(c, x, 168, 134, 4, C.k1);
      for (let w = 0; w < 6; w++) { rect(c, x + 8 + w * 21, 118, 14, 18, C.s4); rect(c, x + 8 + w * 21, 118, 14, 18, rgba(C.s3, 0.5)); }
      glow(c, x + 67, 126, 70, C.s3, 0.35); }
    rect(c, train.x - 6, 116, 6, 56, C.b6); glow(c, train.x - 4, 150, 40, C.s4, 0.8); }
}

// ================= main loop =================
let last = performance.now(), acc = 0;
function frame(now) {
  acc += Math.min(0.1, (now - last) / 1000); last = now;
  let steps = 0; while (acc >= 1 / 60 && steps < 4) { update(); acc -= 1 / 60; steps++; }
  try { render(); drawBleed(view); } catch (e) { console.error(e); }
  requestAnimationFrame(frame);
}
anyKeyHook = k => { if (UI.open && UI.handleKey) { UI.handleKey(k); delete pressed[k]; } };
function boot() {
  const q = new URLSearchParams(location.search);
  layout(); enterArea(q.get('area') || 'alley', +(q.get('x') || 60)); game.fade = 0;
  const start = () => { game.started = true; game.fade = 1; const t0 = performance.now(); const f = () => { const k = (performance.now() - t0) / 1500; game.fade = Math.max(0, 1 - k); if (k < 1) requestAnimationFrame(f); }; f();
    setTimeout(() => UI.say([
      { who: '', text: 'Third body this month. Same lilies. Same gold leaf over the eyes.' },
      { who: '', text: 'It was called in at 2:58. Anonymous. A voice that sounded... pleased.' },
      { who: '', text: 'I can see it the way he did, if I let myself. Hold Q. It costs. It always costs.' },
    ], () => setObjective('Search the alley behind the Blue Hour.')), 900); };
  if (q.get('skip')) { game.started = true; game.fade = 0; } else UI.title(start);
  requestAnimationFrame(frame);
}
boot();
