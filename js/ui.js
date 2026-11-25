'use strict';
// Diegetic overlay UI: notebook, cork board, Polaroids, typewriter dialog. Drawn in CSS px on the high-res `ui` canvas.
const TYPE = '"Courier New", Courier, monospace';
const HAND = 'Georgia, "Times New Roman", serif';

const UI = {
  open: null, w: 960, h: 540, dpr: 1, time: 0,
  dlg: null, toasts: [], prompts: [],
  board: { cursor: 0, first: -1, msg: '', msgT: 0, shake: 0, rects: [], last: null },
  titleCb: null, endLines: null, endCb: null, endT: 0, titleT: 0,
  sanLast: 100, sanShow: 0, onClose: null,
  _cork: null, _paper: null, _wood: null,

  resize(w, h, dpr) { this.w = w; this.h = h; this.dpr = dpr || 1; },
  close() { const cb = this.onClose; this.open = null; this.onClose = null; if (cb) cb(); },

  // ---------- public API ----------
  say(lines, onDone) {
    this.dlg = { lines: lines.slice(), i: 0, shown: 0, onDone: onDone || null, seed: Math.random() * 1000 | 0 };
    this.open = 'dialog';
  },
  toast(text) { this.toasts.push({ text, t: 0, seed: Math.random() * 999 | 0 }); if (this.toasts.length > 3) this.toasts.shift(); },
  prompt(sx, sy, text) { this.prompts.push({ sx, sy, text }); },
  openBoard() { this.open = 'board'; const b = this.board; b.first = -1; b.msg = ''; b.msgT = 0; b.cursor = 0; Sound.sfx('page'); },
  openNotebook() { this.open = 'notebook'; Sound.sfx('page'); },
  title(onStart) { this.open = 'title'; this.titleCb = onStart; this.titleT = 0; },
  ending(lines, onRestart) { this.open = 'end'; this.endLines = lines; this.endCb = onRestart; this.endT = 0; },

  handleKey(code) {
    const o = this.open; if (!o) return false;
    if (o === 'title') { if (code === 'Enter' || code === 'Space') { this.open = null; const cb = this.titleCb; this.titleCb = null; if (cb) cb(); } return true; }
    if (o === 'end') { if ((code === 'Enter' || code === 'Space') && this.endT > 2) { this.open = null; const cb = this.endCb; if (cb) cb(); } return true; }
    if (o === 'dialog') {
      const d = this.dlg; if (!d) { this.open = null; return true; }
      if (code === 'Escape') { this._endDialog(); return true; }
      if (code === 'KeyE' || code === 'Space' || code === 'Enter') {
        const L = d.lines[d.i]; if (d.shown < L.text.length) d.shown = L.text.length;
        else { d.i++; d.shown = 0; if (d.i >= d.lines.length) this._endDialog(); else Sound.sfx('page'); }
      }
      return true;
    }
    if (o === 'notebook') { if (code === 'KeyN' || code === 'Escape' || code === 'KeyE') { Sound.sfx('page'); this.close(); } return true; }
    if (o === 'board') {
      const n = this._game ? this._game.clues.length : 0;
      if (code === 'Escape' || code === 'KeyE') { Sound.sfx('page'); this.close(); return true; }
      if (n) {
        const cols = n > 4 ? 3 : 2;
        if (code === 'ArrowRight' || code === 'KeyD') this.board.cursor = (this.board.cursor + 1) % n;
        if (code === 'ArrowLeft' || code === 'KeyA') this.board.cursor = (this.board.cursor - 1 + n) % n;
        if (code === 'ArrowDown' || code === 'KeyS') this.board.cursor = Math.min(n - 1, this.board.cursor + cols);
        if (code === 'ArrowUp' || code === 'KeyW') this.board.cursor = Math.max(0, this.board.cursor - cols);
        if (code === 'Enter' || code === 'Space') this._pick(this.board.cursor);
      }
      return true;
    }
    return false;
  },
  handleClick(x, y) {
    if (this.open === 'title') return this.handleKey('Enter');
    if (this.open === 'dialog') return this.handleKey('KeyE');
    if (this.open !== 'board') return false;
    const r = this.board.rects; for (let i = r.length - 1; i >= 0; i--) { const q = r[i]; if (x >= q.x && x <= q.x + q.w && y >= q.y && y <= q.y + q.h) { this.board.cursor = i; this._pick(i); return true; } }
    return true;
  },
  _endDialog() { const d = this.dlg; this.dlg = null; this.open = null; if (d && d.onDone) d.onDone(); },
  _pick(i) {
    const g = this._game, b = this.board; if (!g) return;
    if (b.first < 0) { b.first = i; Sound.sfx('pin'); return; }
    if (b.first === i) { b.first = -1; return; }
    const a = g.clues[b.first], c = g.clues[i]; b.first = -1;
    const res = g.tryLink(a.id, c.id);
    if (res) { b.msg = res.text; b.msgT = 0; b.good = true; Sound.sfx('deduce'); }
    else { b.msg = 'Those two don’t talk to each other. Not yet.'; b.msgT = 0; b.good = false; b.shake = 1; Sound.sfx('wrong'); }
  },

  // ---------- main draw ----------
  draw(u, w, h, game) {
    this._game = game; this.w = w; this.h = h;
    const now = performance.now(); const dt = this._last ? clamp((now - this._last) / 1000, 0, 0.1) : 1 / 60; this._last = now; this.time += dt; this._dt = dt;
    u.setTransform(this.dpr, 0, 0, this.dpr, 0, 0); u.clearRect(0, 0, w, h);
    const k = Math.min(w / 960, h / 540);
    u.imageSmoothingEnabled = true;
    // world prompts
    if (!this.open) for (const p of this.prompts) this._promptTag(u, p, k);
    this.prompts.length = 0;
    // sanity bar
    const calm = !this.open || this.open === 'dialog';
    if (game && calm) this._sanity(u, w, h, k, game.sanity);
    // toasts
    if (calm) this._toasts(u, k, dt); else this.toasts.forEach(t => t.t = Math.min(t.t, 0.5));
    // mode badge
    if (this.open !== 'title') { u.font = `${Math.round(10 * k + 2)}px ${TYPE}`; u.textAlign = 'right'; u.fillStyle = 'rgba(183,195,214,0.32)'; u.fillText(`V · ${G.mode === 'pixel' ? 'PIXEL' : 'PAINTED'}   M · SOUND   N · NOTEBOOK`, w - 14 * k, h - 12 * k); u.textAlign = 'left'; }
    if (this.open === 'board') this._board(u, w, h, k, game, dt);
    else if (this.open === 'notebook') this._notebook(u, w, h, k, game);
    else if (this.open === 'dialog') this._dialog(u, w, h, k, dt);
    // fade
    if (game && game.fade > 0) { u.fillStyle = `rgba(0,0,0,${clamp(game.fade, 0, 1)})`; u.fillRect(0, 0, w, h); }
    if (this.open === 'title') this._title(u, w, h, k, dt);
    if (this.open === 'end') this._ending(u, w, h, k, dt);
  },

  // ---------- textures ----------
  cork() {
    if (this._cork) return this._cork;
    const c = makeCanvas(384, 384), x = c.getContext('2d'); const r = mulberry32(77);
    x.fillStyle = '#7a5a3a'; x.fillRect(0, 0, 384, 384);
    for (let i = 0; i < 9000; i++) { const v = r(); x.fillStyle = v < 0.45 ? `rgba(40,24,12,${0.25 + r() * 0.35})` : v < 0.85 ? `rgba(160,120,78,${0.2 + r() * 0.3})` : `rgba(210,170,120,${0.25})`; const s = 0.6 + r() * 2.2; x.beginPath(); x.ellipse(r() * 384, r() * 384, s, s * (0.5 + r()), r() * 3, 0, 6.3); x.fill(); }
    for (let i = 0; i < 60; i++) { x.fillStyle = `rgba(30,18,10,${0.08 + r() * 0.1})`; x.beginPath(); x.arc(r() * 384, r() * 384, 10 + r() * 40, 0, 6.3); x.fill(); }
    // old pin holes
    for (let i = 0; i < 70; i++) { x.fillStyle = 'rgba(15,8,4,0.7)'; x.fillRect(r() * 384, r() * 384, 1.4, 1.4); }
    return (this._cork = c);
  },
  paper() {
    if (this._paper) return this._paper;
    const c = makeCanvas(512, 512), x = c.getContext('2d'); const r = mulberry32(31);
    x.fillStyle = '#e4dccb'; x.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 5000; i++) { x.fillStyle = `rgba(${r() < 0.5 ? '90,70,50' : '255,250,235'},${r() * 0.06})`; x.fillRect(r() * 512, r() * 512, 1 + r() * 3, 1 + r() * 3); }
    for (let i = 0; i < 14; i++) { const g = x.createRadialGradient(r() * 512, r() * 512, 0, r() * 512, r() * 512, 60 + r() * 120); g.addColorStop(0, 'rgba(120,90,50,0.07)'); g.addColorStop(1, 'rgba(120,90,50,0)'); x.fillStyle = g; x.fillRect(0, 0, 512, 512); }
    return (this._paper = c);
  },
  _paperRect(u, x, y, w, h, opt = {}) {
    u.save(); u.beginPath();
    const rr = mulberry32(opt.seed || 5); const torn = opt.torn;
    u.moveTo(x, y);
    if (torn) { for (let i = 0; i <= 40; i++) u.lineTo(x + w * i / 40, y + (rr() - 0.5) * 5); } else u.lineTo(x + w, y);
    u.lineTo(x + w, y + h);
    if (torn) { for (let i = 40; i >= 0; i--) u.lineTo(x + w * i / 40, y + h + (rr() - 0.5) * 5); } else u.lineTo(x, y + h);
    u.closePath();
    u.shadowColor = 'rgba(0,0,0,0.55)'; u.shadowBlur = opt.shadow ?? 18; u.shadowOffsetY = 6;
    u.fillStyle = opt.color || '#e4dccb'; u.fill(); u.shadowColor = 'transparent';
    u.clip(); u.globalAlpha = opt.texAlpha ?? 1; u.drawImage(this.paper(), x, y, Math.max(w, 512), Math.max(h, 512)); u.globalAlpha = 1;
    if (opt.tint) { u.fillStyle = opt.tint; u.fillRect(x, y, w, h); }
    // edge darkening
    const g = u.createLinearGradient(x, y, x, y + h); g.addColorStop(0, 'rgba(80,55,30,0.15)'); g.addColorStop(0.15, 'rgba(0,0,0,0)'); g.addColorStop(0.9, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(80,55,30,0.2)');
    u.fillStyle = g; u.fillRect(x, y, w, h);
    u.restore();
  },
  _tape(u, x, y, w, h, rot) {
    u.save(); u.translate(x, y); u.rotate(rot); u.fillStyle = 'rgba(232,224,196,0.62)'; u.fillRect(-w / 2, -h / 2, w, h);
    u.fillStyle = 'rgba(255,255,255,0.18)'; u.fillRect(-w / 2, -h / 2, w, h * 0.3);
    u.strokeStyle = 'rgba(120,100,70,0.25)'; u.lineWidth = 0.6; u.strokeRect(-w / 2, -h / 2, w, h); u.restore();
  },
  _pin(u, x, y, k, col = '#b81d2c') {
    u.save(); u.fillStyle = 'rgba(0,0,0,0.45)'; u.beginPath(); u.ellipse(x + 3 * k, y + 4 * k, 5 * k, 3 * k, 0, 0, 6.3); u.fill();
    const g = u.createRadialGradient(x - 1.5 * k, y - 1.5 * k, 0.5, x, y, 5 * k); g.addColorStop(0, '#ff8f8f'); g.addColorStop(0.35, col); g.addColorStop(1, '#3a060c');
    u.fillStyle = g; u.beginPath(); u.arc(x, y, 4.6 * k, 0, 6.3); u.fill(); u.restore();
  },
  _wrap(u, text, maxW) {
    const words = String(text).split(' '); const lines = []; let cur = '';
    for (const wd of words) { const t = cur ? cur + ' ' + wd : wd; if (u.measureText(t).width > maxW && cur) { lines.push(cur); cur = wd; } else cur = t; }
    if (cur) lines.push(cur); return lines;
  },

  // ---------- world prompt ----------
  _promptTag(u, p, k) {
    const fs = Math.round(11 * k + 3); u.font = `bold ${fs}px ${TYPE}`;
    const parts = p.text.split(/\s{2,}/); const key = parts.length > 1 ? parts[0] : 'E'; const label = parts.length > 1 ? parts.slice(1).join(' ') : p.text;
    const lw = u.measureText(label).width, pad = 6 * k, kw = fs + 4 * k;
    const W = kw + lw + pad * 3, H = fs + pad * 1.6; const bob = Math.sin(this.time * 2.4) * 1.5 * k;
    const x = Math.round(p.sx - W / 2), y = Math.round(p.sy - H - 8 * k + bob);
    u.save(); u.globalAlpha = 0.92;
    u.fillStyle = 'rgba(10,12,20,0.78)'; u.fillRect(x, y, W, H);
    u.strokeStyle = 'rgba(232,169,90,0.5)'; u.lineWidth = 1; u.strokeRect(x + 0.5, y + 0.5, W - 1, H - 1);
    u.fillStyle = '#e4dccb'; u.fillRect(x + pad, y + pad * 0.6, kw, H - pad * 1.2);
    u.fillStyle = '#1a1416'; u.textBaseline = 'middle'; u.textAlign = 'center'; u.fillText(key, x + pad + kw / 2, y + H / 2 + 1);
    u.textAlign = 'left'; u.fillStyle = '#e4dccb'; u.fillText(label, x + pad * 2 + kw, y + H / 2 + 1);
    u.beginPath(); u.moveTo(p.sx - 4 * k, y + H); u.lineTo(p.sx, y + H + 5 * k); u.lineTo(p.sx + 4 * k, y + H); u.fillStyle = 'rgba(10,12,20,0.78)'; u.fill();
    u.restore(); u.textBaseline = 'alphabetic';
  },

  // ---------- sanity ----------
  _sanity(u, w, h, k, s) {
    if (s == null) return;
    if (Math.abs(s - this.sanLast) > 0.05) this.sanShow = 2.5; this.sanLast = s;
    this.sanShow = Math.max(0, this.sanShow - (this._dt || 1 / 60));
    const a = clamp(Math.max(this.sanShow / 1.2, s < 40 ? 0.85 : 0), 0, 1); if (a <= 0.01) return;
    const x = 22 * k, y = h - 30 * k, W = 190 * k, H = 7 * k;
    u.save(); u.globalAlpha = a;
    u.font = `italic ${Math.round(13 * k + 2)}px ${HAND}`; u.fillStyle = 'rgba(228,220,203,0.75)'; u.fillText(s < 25 ? 'it is getting in' : 'nerve', x, y - 8 * k);
    // ink stroke (uneven), length = sanity
    u.strokeStyle = 'rgba(228,220,203,0.18)'; u.lineWidth = H; u.lineCap = 'round'; u.beginPath(); u.moveTo(x, y); u.lineTo(x + W, y); u.stroke();
    const L = W * clamp(s / 100, 0, 1); const red = s < 35;
    u.strokeStyle = red ? '#b81d2c' : '#e4dccb'; u.beginPath(); u.moveTo(x, y);
    for (let i = 1; i <= 24; i++) { const t = i / 24; u.lineTo(x + L * t, y + Math.sin(i * 1.7 + this.time * (red ? 9 : 1.5)) * (red ? 1.5 : 0.7) * k); }
    u.lineWidth = H * 0.8; u.stroke();
    // drips when low
    if (red) for (let i = 0; i < 4; i++) { const dx = x + L * (0.15 + i * 0.22); const len = (4 + ((this.time * 6 + i * 3) % 10)) * k; u.lineWidth = 1.6 * k; u.beginPath(); u.moveTo(dx, y); u.lineTo(dx, y + len); u.stroke(); }
    u.restore();
  },

  // ---------- toasts ----------
  _toasts(u, k, dt) {
    let y = 20 * k;
    for (const t of this.toasts) {
      t.t += dt; const life = 4.5; const a = t.t < 0.4 ? t.t / 0.4 : t.t > life - 0.8 ? Math.max(0, (life - t.t) / 0.8) : 1;
      if (a <= 0) continue;
      u.save(); u.globalAlpha = a; u.font = `italic ${Math.round(15 * k + 2)}px ${HAND}`;
      const lines = this._wrap(u, t.text, 260 * k); const W = 290 * k, H = (lines.length * 19 + 22) * k;
      const x = 20 * k + (1 - Math.min(1, t.t / 0.4)) * -20 * k;
      u.translate(x, y); u.rotate(-0.02 + (t.seed % 7) * 0.004);
      this._paperRect(u, 0, 0, W, H, { seed: t.seed, shadow: 12, color: '#e9d98f', tint: 'rgba(240,215,110,0.35)', texAlpha: 0.7 });
      this._tape(u, W / 2, 0, 60 * k, 14 * k, 0.05);
      u.fillStyle = '#2a1e1a'; lines.forEach((l, i) => u.fillText(l, 14 * k, (26 + i * 19) * k));
      u.restore(); y += H + 12 * k;
    }
    this.toasts = this.toasts.filter(t => t.t < 4.5);
  },

  // ---------- polaroid ----------
  _polaroid(u, x, y, w, rot, clue, k, sel, hot) {
    const ph = w * 0.82, H = w * 1.14, inset = w * 0.07;
    u.save(); u.translate(x + w / 2, y + H / 2); u.rotate(rot); u.translate(-w / 2, -H / 2);
    if (sel) { u.shadowColor = 'rgba(255,60,60,0.9)'; u.shadowBlur = 26 * k; }
    else { u.shadowColor = 'rgba(0,0,0,0.6)'; u.shadowBlur = 14 * k; u.shadowOffsetY = 5 * k; }
    u.fillStyle = '#ece6d8'; u.fillRect(0, 0, w, H); u.shadowColor = 'transparent';
    u.drawImage(this.paper(), 0, 0, w, H, 0, 0, w, H);
    // photo
    const px = inset, py = inset, pw = w - inset * 2;
    u.fillStyle = '#0a0b10'; u.fillRect(px, py, pw, ph);
    if (clue.snap) {
      u.imageSmoothingEnabled = G.mode !== 'pixel';
      const s = clue.snap; const ar = pw / ph, sar = s.width / s.height; let sw = s.width, sh = s.height, sx = 0, sy = 0;
      if (sar > ar) { sw = sh * ar; sx = (s.width - sw) / 2; } else { sh = sw / ar; sy = (s.height - sh) / 2; }
      u.drawImage(s, sx, sy, sw, sh, px, py, pw, ph); u.imageSmoothingEnabled = true;
    } else {
      const g = u.createLinearGradient(px, py, px, py + ph); g.addColorStop(0, '#1a2236'); g.addColorStop(1, '#07080d'); u.fillStyle = g; u.fillRect(px, py, pw, ph);
      const rr = mulberry32(String(clue.id).length * 31 + 7); u.fillStyle = 'rgba(232,169,90,0.5)';
      u.beginPath(); u.arc(px + pw * (0.3 + rr() * 0.4), py + ph * 0.45, pw * 0.12, 0, 6.3); u.fill();
      u.fillStyle = 'rgba(139,156,184,0.25)'; for (let i = 0; i < 5; i++) u.fillRect(px + rr() * pw, py + ph * 0.6, pw * 0.08, ph * 0.4);
    }
    // photo finish: vignette + faded chemical edge
    const vg = u.createRadialGradient(px + pw / 2, py + ph / 2, pw * 0.2, px + pw / 2, py + ph / 2, pw * 0.75);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(10,5,0,0.55)'); u.fillStyle = vg; u.fillRect(px, py, pw, ph);
    u.fillStyle = 'rgba(255,240,210,0.06)'; u.fillRect(px, py, pw, ph);
    if (hot) { u.strokeStyle = 'rgba(255,61,139,0.9)'; u.lineWidth = 2; u.strokeRect(px - 3, py - 3, pw + 6, ph + 6); }
    // caption
    u.fillStyle = '#2a1e1a'; u.font = `italic ${Math.round(w * 0.098)}px ${HAND}`; u.textAlign = 'center';
    const cap = this._wrap(u, clue.title || clue.id, w * 0.9);
    cap.slice(0, 2).forEach((l, i) => u.fillText(l, w / 2, py + ph + w * 0.12 + i * w * 0.1));
    u.textAlign = 'left';
    u.restore();
  },

  // ---------- cork board ----------
  _board(u, w, h, k, g, dt) {
    const b = this.board; b.msgT += dt; b.shake = Math.max(0, b.shake - dt * 2.5);
    u.fillStyle = 'rgba(3,4,8,0.78)'; u.fillRect(0, 0, w, h);
    const sx = b.shake ? Math.sin(this.time * 70) * 6 * b.shake * k : 0;
    const BW = Math.min(w * 0.9, h * 1.55), BH = Math.min(h * 0.84, BW * 0.62);
    const bx = (w - BW) / 2 + sx, by = (h - BH) / 2 - 6 * k;
    // frame
    const fw = 16 * k;
    u.save(); u.shadowColor = 'rgba(0,0,0,0.8)'; u.shadowBlur = 40 * k; u.shadowOffsetY = 12 * k;
    const wg = u.createLinearGradient(bx, by, bx + BW, by + BH); wg.addColorStop(0, '#4a2e1a'); wg.addColorStop(0.5, '#6b4426'); wg.addColorStop(1, '#3a2213');
    u.fillStyle = wg; u.fillRect(bx - fw, by - fw, BW + fw * 2, BH + fw * 2); u.restore();
    // wood grain
    u.save(); u.beginPath(); u.rect(bx - fw, by - fw, BW + fw * 2, BH + fw * 2); u.rect(bx, by, BW, BH); u.clip('evenodd');
    const rr = mulberry32(9); u.strokeStyle = 'rgba(20,10,4,0.35)'; u.lineWidth = 1;
    for (let i = 0; i < 70; i++) { const yy = by - fw + rr() * (BH + fw * 2); u.beginPath(); u.moveTo(bx - fw, yy); u.bezierCurveTo(bx + BW * 0.3, yy + (rr() - 0.5) * 6, bx + BW * 0.7, yy + (rr() - 0.5) * 6, bx + BW + fw, yy + (rr() - 0.5) * 4); u.stroke(); }
    u.fillStyle = 'rgba(255,220,170,0.08)'; u.fillRect(bx - fw, by - fw, BW + fw * 2, 3 * k); u.restore();
    // cork
    u.save(); u.beginPath(); u.rect(bx, by, BW, BH); u.clip();
    u.fillStyle = u.createPattern(this.cork(), 'repeat'); u.translate(bx, by); u.fillRect(0, 0, BW, BH); u.translate(-bx, -by);
    // lamp falloff
    const lg = u.createRadialGradient(bx + BW * 0.45, by + BH * 0.25, BW * 0.05, bx + BW * 0.5, by + BH * 0.5, BW * 0.75);
    lg.addColorStop(0, 'rgba(255,200,120,0.12)'); lg.addColorStop(1, 'rgba(0,0,0,0.6)'); u.fillStyle = lg; u.fillRect(bx, by, BW, BH);
    u.restore();
    // header note
    u.font = `bold ${Math.round(14 * k + 2)}px ${TYPE}`; const hw = u.measureText('CASE 01 — THE LILY SAINT').width + 26 * k;
    u.save(); u.translate(bx + 22 * k, by + 16 * k); u.rotate(-0.025);
    this._paperRect(u, 0, 0, hw, 48 * k, { seed: 3, shadow: 8 });
    u.fillStyle = '#1a1416'; u.fillText('CASE 01 — THE LILY SAINT', 13 * k, 22 * k);
    u.font = `italic ${Math.round(12 * k + 2)}px ${HAND}`; u.fillStyle = '#6b1a1a'; u.fillText('connect what belongs together', 13 * k, 39 * k);
    u.restore(); this._pin(u, bx + 22 * k + hw / 2, by + 18 * k, k);

    // layout polaroids (left ~68% of board)
    const clues = g.clues || []; const n = clues.length; b.rects = [];
    const areaX = bx + 26 * k, areaY = by + 78 * k, areaW = BW * 0.66, areaH = BH - 100 * k;
    const cols = n > 4 ? 3 : Math.max(1, Math.min(2, n)), rows = Math.max(1, Math.ceil(n / cols));
    const cellW = areaW / cols, cellH = areaH / rows;
    const pw = Math.min(cellW * 0.66, cellH * 0.8 / 1.14);
    const pos = [];
    clues.forEach((c, i) => {
      const r = mulberry32(i * 13 + String(c.id).length * 7 + 1);
      const cx = areaX + (i % cols) * cellW + (cellW - pw) / 2 + (r() - 0.5) * cellW * 0.18;
      const cy = areaY + Math.floor(i / cols) * cellH + (cellH - pw * 1.14) / 2 + (r() - 0.5) * cellH * 0.12;
      const rot = (r() - 0.5) * 0.14;
      pos.push({ x: cx, y: cy, rot, pinX: cx + pw / 2, pinY: cy + pw * 0.06 });
      b.rects.push({ x: cx, y: cy, w: pw, h: pw * 1.14 });
    });
    if (!n) { u.fillStyle = 'rgba(228,220,203,0.8)'; u.font = `italic ${Math.round(18 * k)}px ${HAND}`; u.fillText('Nothing pinned yet. Go look.', areaX + 20 * k, areaY + 80 * k); }
    const hotIds = new Set(); (g.deductions || []).forEach(d => { hotIds.add(d.a); hotIds.add(d.b); });
    clues.forEach((c, i) => this._polaroid(u, pos[i].x, pos[i].y, pw, pos[i].rot, c, k, b.first === i, i === b.cursor && b.first !== i));
    // red string for each deduction
    const idx = id => clues.findIndex(c => c.id === id);
    (g.deductions || []).forEach((d, di) => {
      const ia = idx(d.a), ib = idx(d.b); if (ia < 0 || ib < 0) return;
      const A = pos[ia], B = pos[ib]; const mx = (A.pinX + B.pinX) / 2, my = (A.pinY + B.pinY) / 2 + 40 * k + Math.abs(A.pinX - B.pinX) * 0.12;
      const sway = Math.sin(this.time * 0.8 + di) * 2 * k;
      u.save(); u.lineCap = 'round';
      u.strokeStyle = 'rgba(0,0,0,0.35)'; u.lineWidth = 3 * k; u.beginPath(); u.moveTo(A.pinX + 3 * k, A.pinY + 5 * k); u.quadraticCurveTo(mx + 3 * k + sway, my + 8 * k, B.pinX + 3 * k, B.pinY + 5 * k); u.stroke();
      u.strokeStyle = '#b3141f'; u.lineWidth = 2 * k; u.beginPath(); u.moveTo(A.pinX, A.pinY); u.quadraticCurveTo(mx + sway, my, B.pinX, B.pinY); u.stroke();
      u.strokeStyle = 'rgba(255,120,120,0.35)'; u.lineWidth = 0.7 * k; u.stroke();
      u.restore();
    });
    clues.forEach((c, i) => this._pin(u, pos[i].pinX, pos[i].pinY, k, hotIds.has(c.id) ? '#b81d2c' : '#2f5d8a'));
    // in-progress string from the first pick to the cursor
    if (b.first >= 0 && pos[b.first]) {
      const A = pos[b.first], B = pos[b.cursor] || A; u.save(); u.setLineDash([5 * k, 5 * k]); u.strokeStyle = 'rgba(255,61,61,0.8)'; u.lineWidth = 1.6 * k;
      u.beginPath(); u.moveTo(A.pinX, A.pinY); u.quadraticCurveTo((A.pinX + B.pinX) / 2, (A.pinY + B.pinY) / 2 + 30 * k, B.pinX, B.pinY); u.stroke(); u.restore();
    }
    // deduction index cards (right column)
    const cx0 = bx + BW * 0.7, cw = BW * 0.27; let cy0 = by + 24 * k;
    u.font = `italic ${Math.round(13 * k + 2)}px ${HAND}`;
    (g.deductions || []).forEach((d, i) => {
      const lines = this._wrap(u, d.text, cw - 26 * k); const ch = (lines.length * 17 + 22) * k;
      u.save(); u.translate(cx0, cy0); u.rotate((i % 2 ? 0.02 : -0.018));
      this._paperRect(u, 0, 0, cw, ch, { seed: 40 + i, shadow: 10, color: '#f0ebe0' });
      u.strokeStyle = 'rgba(200,60,60,0.5)'; u.lineWidth = 1; u.beginPath(); u.moveTo(0, 12 * k); u.lineTo(cw, 12 * k); u.stroke();
      u.strokeStyle = 'rgba(80,110,160,0.25)'; for (let L = 1; L <= lines.length; L++) { u.beginPath(); u.moveTo(0, (12 + L * 17) * k); u.lineTo(cw, (12 + L * 17) * k); u.stroke(); }
      u.fillStyle = '#231a24'; u.font = `italic ${Math.round(13 * k + 2)}px ${HAND}`; lines.forEach((l, j) => u.fillText(l, 12 * k, (26 + j * 17) * k));
      u.restore(); this._pin(u, cx0 + cw / 2, cy0 + 4 * k, k * 0.8, '#d9b25a');
      cy0 += ch + 14 * k;
    });
    if (!(g.deductions || []).length) { u.fillStyle = 'rgba(228,220,203,0.55)'; u.font = `italic ${Math.round(14 * k + 2)}px ${HAND}`; this._wrap(u, 'No connections yet. Pick two photographs.', cw).forEach((l, j) => u.fillText(l, cx0, cy0 + 20 * k + j * 18 * k)); }
    // message strip
    if (b.msg && b.msgT < 6) {
      const a = b.msgT < 0.3 ? b.msgT / 0.3 : b.msgT > 5 ? 6 - b.msgT : 1;
      u.save(); u.globalAlpha = a; u.font = `${Math.round(14 * k + 2)}px ${TYPE}`;
      const shown = b.msg.slice(0, Math.floor(b.msgT * 45)); const lines = this._wrap(u, b.msg, BW * 0.62); const W = BW * 0.66, H = (lines.length * 19 + 20) * k;
      const mx = bx + (BW - W) / 2, my = by + BH - H - 6 * k;
      this._paperRect(u, mx, my, W, H, { seed: 77, torn: true, shadow: 14 });
      u.fillStyle = b.good ? '#1a1416' : '#7a1a1a'; let rem = shown.length;
      lines.forEach((l, j) => { const part = l.slice(0, Math.max(0, rem)); rem -= l.length + 1; u.fillText(part, mx + 16 * k, my + (24 + j * 19) * k); });
      u.restore();
    }
    // help
    u.font = `${Math.round(11 * k + 2)}px ${TYPE}`; u.fillStyle = 'rgba(228,220,203,0.6)'; u.textAlign = 'center';
    u.fillText('CLICK or ARROWS + ENTER: pick two photographs      E / ESC: step back', w / 2, by + BH + fw + 22 * k); u.textAlign = 'left';
  },

  // ---------- notebook ----------
  _notebook(u, w, h, k, g) {
    u.fillStyle = 'rgba(3,4,8,0.72)'; u.fillRect(0, 0, w, h);
    const PW = Math.min(w * 0.8, h * 1.3), PH = Math.min(h * 0.86, PW * 0.68); const px = (w - PW) / 2, py = (h - PH) / 2;
    // leather cover
    u.save(); u.shadowColor = 'rgba(0,0,0,0.8)'; u.shadowBlur = 36 * k; u.shadowOffsetY = 10 * k;
    u.fillStyle = '#2a1712'; this._rr(u, px - 14 * k, py - 12 * k, PW + 28 * k, PH + 24 * k, 10 * k); u.fill(); u.restore();
    u.fillStyle = 'rgba(255,255,255,0.03)'; this._rr(u, px - 14 * k, py - 12 * k, PW + 28 * k, PH + 24 * k, 10 * k); u.fill();
    // two pages
    const half = PW / 2;
    [0, 1].forEach(p => {
      const x = px + p * half;
      u.save(); u.beginPath(); u.rect(x, py, half, PH); u.clip();
      u.fillStyle = '#e4dccb'; u.fillRect(x, py, half, PH); u.drawImage(this.paper(), x, py, half, PH);
      // ruling
      u.strokeStyle = 'rgba(70,100,150,0.22)'; u.lineWidth = 1; for (let yy = py + 58 * k; yy < py + PH - 10 * k; yy += 21 * k) { u.beginPath(); u.moveTo(x, yy); u.lineTo(x + half, yy); u.stroke(); }
      u.strokeStyle = 'rgba(190,50,50,0.4)'; u.beginPath(); u.moveTo(x + 44 * k, py); u.lineTo(x + 44 * k, py + PH); u.stroke();
      // gutter shadow
      const gg = u.createLinearGradient(px + half - 30 * k, 0, px + half + 30 * k, 0); gg.addColorStop(0, 'rgba(0,0,0,0)'); gg.addColorStop(0.5, 'rgba(40,25,10,0.35)'); gg.addColorStop(1, 'rgba(0,0,0,0)'); u.fillStyle = gg; u.fillRect(x, py, half, PH);
      u.restore();
    });
    // coffee ring
    u.save(); u.strokeStyle = 'rgba(110,70,30,0.22)'; u.lineWidth = 5 * k; u.beginPath(); u.arc(px + PW * 0.86, py + PH * 0.8, 38 * k, 0.3, 5.6); u.stroke(); u.lineWidth = 1.5 * k; u.beginPath(); u.arc(px + PW * 0.86, py + PH * 0.8, 33 * k, 0, 6.3); u.stroke(); u.restore();
    const ink = '#1d2340', hand = s => `italic ${Math.round(s * k + 2)}px ${HAND}`;
    // left page: objective + clues
    let x = px + 56 * k, y = py + 42 * k;
    u.fillStyle = '#6b1a1a'; u.font = `bold ${Math.round(13 * k + 2)}px ${TYPE}`; u.fillText('CASE 01 — THE LILY SAINT', x, y);
    y += 37 * k; u.fillStyle = ink; u.font = hand(15); u.fillText('Now:', x, y);
    u.font = hand(15); this._wrap(u, g.objective || '—', half - 90 * k).forEach(l => { u.fillText(l, x + 44 * k, y); y += 21 * k; });
    y += 10 * k; u.fillStyle = '#6b1a1a'; u.font = `bold ${Math.round(12 * k + 2)}px ${TYPE}`; u.fillText(`EVIDENCE (${(g.clues || []).length})`, x, y); y += 21 * k;
    (g.clues || []).forEach(c => {
      if (y > py + PH - 24 * k) return;
      u.fillStyle = ink; u.font = hand(14); u.fillText('• ' + (c.title || c.id), x, y); y += 21 * k;
      if (c.note) { u.fillStyle = 'rgba(29,35,64,0.72)'; u.font = hand(12); this._wrap(u, c.note, half - 100 * k).slice(0, 2).forEach(l => { if (y < py + PH - 20 * k) { u.fillText(l, x + 14 * k, y); y += 21 * k; } }); }
    });
    if (!(g.clues || []).length) { u.fillStyle = 'rgba(29,35,64,0.5)'; u.font = hand(14); u.fillText('nothing yet.', x, y); }
    // right page: deductions
    x = px + half + 56 * k; y = py + 42 * k;
    u.fillStyle = '#6b1a1a'; u.font = `bold ${Math.round(12 * k + 2)}px ${TYPE}`; u.fillText('WHAT I KNOW', x, y); y += 37 * k;
    (g.deductions || []).forEach((d, i) => {
      u.fillStyle = ink; u.font = hand(14);
      this._wrap(u, `${i + 1}. ${d.text}`, half - 90 * k).forEach(l => { if (y < py + PH - 20 * k) { u.fillText(l, x, y); y += 21 * k; } }); y += 8 * k;
    });
    if (!(g.deductions || []).length) { u.fillStyle = 'rgba(29,35,64,0.5)'; u.font = hand(14); this._wrap(u, 'Nothing I’d say out loud. Take it to the board at the precinct.', half - 90 * k).forEach(l => { u.fillText(l, x, y); y += 21 * k; }); }
    // a doodle: crude lily + sigil in the margin
    u.save(); u.strokeStyle = 'rgba(29,35,64,0.45)'; u.lineWidth = 1.2 * k; const dx = px + PW - 70 * k, dy = py + PH * 0.45;
    u.beginPath(); u.arc(dx, dy, 18 * k, 0, 6.3); u.moveTo(dx - 18 * k, dy); u.lineTo(dx + 18 * k, dy); u.moveTo(dx, dy - 18 * k); u.lineTo(dx + 10 * k, dy + 14 * k); u.lineTo(dx - 10 * k, dy + 14 * k); u.closePath(); u.stroke(); u.restore();
    this._tape(u, px + PW * 0.25, py - 2 * k, 80 * k, 18 * k, -0.06);
    u.font = `${Math.round(11 * k + 2)}px ${TYPE}`; u.fillStyle = 'rgba(228,220,203,0.6)'; u.textAlign = 'center'; u.fillText('N / ESC: close', w / 2, py + PH + 32 * k); u.textAlign = 'left';
  },
  _rr(u, x, y, w, h, r) { u.beginPath(); u.moveTo(x + r, y); u.arcTo(x + w, y, x + w, y + h, r); u.arcTo(x + w, y + h, x, y + h, r); u.arcTo(x, y + h, x, y, r); u.arcTo(x, y, x + w, y, r); u.closePath(); },

  // ---------- dialog ----------
  _dialog(u, w, h, k, dt) {
    const d = this.dlg; if (!d) return; const L = d.lines[d.i]; if (!L) return;
    d.shown = Math.min(L.text.length, d.shown + dt * 48);
    const W = Math.min(w * 0.72, 760 * k), H = 112 * k, x = (w - W) / 2, y = h - H - 28 * k;
    u.save(); u.translate(x, y); u.rotate(-0.006);
    this._paperRect(u, 0, 0, W, H, { seed: d.seed + d.i, torn: true, shadow: 22 });
    this._tape(u, 34 * k, 2 * k, 60 * k, 16 * k, -0.25); this._tape(u, W - 34 * k, 2 * k, 60 * k, 16 * k, 0.22);
    const who = L.who || ''; const isVale = /VALE/i.test(who); const isMe = /^(ME|YOU|HOLLOWAY|CASS)/i.test(who);
    if (who) { u.font = `bold ${Math.round(13 * k + 2)}px ${TYPE}`; u.fillStyle = isVale ? '#7a1426' : isMe ? '#1d2340' : '#3b3433'; u.fillText(who.toUpperCase(), 24 * k, 28 * k); u.fillRect(24 * k, 33 * k, u.measureText(who.toUpperCase()).width, 1.5 * k); }
    const inner = !who; // narration / thoughts in italic hand
    u.font = inner ? `italic ${Math.round(17 * k + 2)}px ${HAND}` : `${Math.round(15 * k + 2)}px ${TYPE}`;
    u.fillStyle = '#1a1416';
    const lines = this._wrap(u, L.text, W - 48 * k); let rem = Math.floor(d.shown);
    lines.slice(0, 3).forEach((l, j) => { const part = l.slice(0, Math.max(0, rem)); rem -= l.length + 1; u.fillText(part, 24 * k, (who ? 56 : 40) * k + j * 22 * k); });
    if (d.shown >= L.text.length && Math.floor(this.time * 2) % 2 === 0) { u.font = `bold ${Math.round(12 * k + 2)}px ${TYPE}`; u.fillStyle = '#6b1a1a'; u.textAlign = 'right'; u.fillText(d.i < d.lines.length - 1 ? 'E ▸' : 'E ■', W - 22 * k, H - 14 * k); u.textAlign = 'left'; }
    u.restore();
  },

  // ---------- title ----------
  _title(u, w, h, k, dt) {
    this.titleT += dt; const t = this.titleT;
    const bg = u.createLinearGradient(0, 0, 0, h); bg.addColorStop(0, '#05060a'); bg.addColorStop(0.7, '#0c1220'); bg.addColorStop(1, '#150a10'); u.fillStyle = bg; u.fillRect(0, 0, w, h);
    // distant sodium glow + neon smear
    let g = u.createRadialGradient(w * 0.72, h * 0.9, 0, w * 0.72, h * 0.9, w * 0.5); g.addColorStop(0, 'rgba(232,169,90,0.18)'); g.addColorStop(1, 'rgba(0,0,0,0)'); u.fillStyle = g; u.fillRect(0, 0, w, h);
    const flick = (Math.sin(t * 13) > 0.92 || Math.sin(t * 3.1 + 1) > 0.985) ? 0.35 : 1;
    g = u.createRadialGradient(w * 0.2, h * 0.75, 0, w * 0.2, h * 0.75, w * 0.35); g.addColorStop(0, `rgba(255,61,139,${0.16 * flick})`); g.addColorStop(1, 'rgba(0,0,0,0)'); u.fillStyle = g; u.fillRect(0, 0, w, h);
    // rain streaks
    u.save(); u.strokeStyle = 'rgba(183,195,214,0.22)'; u.lineWidth = 1;
    for (let i = 0; i < 160; i++) { const r1 = hash1(i), r2 = hash1(i + 999); const sp = 520 + r2 * 400; const len = 14 + r2 * 22; const x = (r1 * (w + 200) - t * 60) % (w + 200); const xx = x < 0 ? x + w + 200 : x; const y = ((r2 * h * 3 + t * sp) % (h + 60)) - 30; u.globalAlpha = 0.3 + r2 * 0.7; u.beginPath(); u.moveTo(xx, y); u.lineTo(xx - len * 0.12, y + len); u.stroke(); }
    u.restore();
    // title
    const a = clamp(t / 2, 0, 1); u.save(); u.globalAlpha = a; u.textAlign = 'center';
    u.font = `${Math.round(70 * k)}px ${HAND}`; u.fillStyle = '#e4dccb';
    const tt = 'S A I N T S   O F   A S H'; u.shadowColor = 'rgba(255,61,139,0.45)'; u.shadowBlur = 24 * k; u.fillText(tt, w / 2, h * 0.36); u.shadowBlur = 0;
    u.fillStyle = '#b3141f'; u.fillRect(w / 2 - 170 * k, h * 0.36 + 18 * k, 340 * k * clamp((t - 0.8) / 1.2, 0, 1), 2 * k);
    u.font = `italic ${Math.round(20 * k)}px ${HAND}`; u.fillStyle = 'rgba(228,220,203,0.8)'; u.fillText('Case 01 — The Lily Saint', w / 2, h * 0.36 + 52 * k);
    u.globalAlpha = clamp((t - 1.5) / 1.5, 0, 1);
    u.font = `${Math.round(12 * k + 2)}px ${TYPE}`; u.fillStyle = 'rgba(183,195,214,0.75)';
    const ctl = ['A / D  move      SPACE  jump      W / S  climb, stairs      SHIFT  sneak', 'E  inspect, talk, use      Q (hold)  see through his eyes      N  notebook', 'V  pixel / painted look      M  sound'];
    ctl.forEach((l, i) => u.fillText(l, w / 2, h * 0.62 + i * 22 * k));
    if (t > 2.5 && Math.floor(t * 1.6) % 2 === 0) { u.font = `bold ${Math.round(15 * k + 2)}px ${TYPE}`; u.fillStyle = '#e8a95a'; u.fillText('PRESS ENTER', w / 2, h * 0.84); }
    u.font = `italic ${Math.round(12 * k + 2)}px ${HAND}`; u.fillStyle = 'rgba(228,220,203,0.35)'; u.fillText('headphones recommended', w / 2, h * 0.92);
    u.restore();
    const vg = u.createRadialGradient(w / 2, h / 2, h * 0.3, w / 2, h / 2, h * 0.95); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.7)'); u.fillStyle = vg; u.fillRect(0, 0, w, h);
  },

  // ---------- ending ----------
  _ending(u, w, h, k, dt) {
    this.endT += dt; const t = this.endT; u.fillStyle = `rgba(4,2,2,${clamp(t / 1.5, 0, 0.94)})`; u.fillRect(0, 0, w, h);
    const g = u.createRadialGradient(w / 2, h * 0.5, 0, w / 2, h * 0.5, w * 0.5); g.addColorStop(0, `rgba(138,16,32,${0.18 * clamp(t / 3, 0, 1)})`); g.addColorStop(1, 'rgba(0,0,0,0)'); u.fillStyle = g; u.fillRect(0, 0, w, h);
    u.save(); u.textAlign = 'center';
    const lines = this.endLines || []; let y = h * 0.3;
    lines.forEach((L, i) => {
      const s = typeof L === 'string' ? { text: L } : L; const a = clamp((t - 1 - i * 1.4) / 1.2, 0, 1); if (a <= 0) return;
      u.globalAlpha = a; u.font = s.big ? `${Math.round(40 * k)}px ${HAND}` : s.who ? `${Math.round(15 * k + 2)}px ${TYPE}` : `italic ${Math.round(19 * k + 2)}px ${HAND}`;
      u.fillStyle = s.big ? '#e4dccb' : s.who ? '#c0485a' : 'rgba(228,220,203,0.85)';
      const txt = s.who ? `${s.who}: “${s.text}”` : s.text; this._wrap(u, txt, w * 0.7).forEach(l => { u.fillText(l, w / 2, y); y += (s.big ? 50 : 28) * k; }); y += 10 * k;
    });
    if (t > 2 + lines.length * 1.4 && Math.floor(t * 1.6) % 2 === 0) { u.globalAlpha = 1; u.font = `bold ${Math.round(13 * k + 2)}px ${TYPE}`; u.fillStyle = '#e8a95a'; u.fillText('PRESS ENTER TO BEGIN AGAIN', w / 2, h * 0.88); }
    u.restore();
  }
};
