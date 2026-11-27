'use strict';
// ---------- constants & globals ----------
let NW = 384; const NH = 216, NW_MAX = 512;                 // native resolution (pixel mode renders exactly this)
function fitNW() { NW = Math.max(288, Math.min(NW_MAX, Math.round(NH * innerWidth / innerHeight))); } // native width follows the window shape
const G = { mode: 'pixel', S: 1, t: 0 };  // S = render scale (1 pixel mode, 4 painted mode)
function setMode(m) { G.mode = m; G.S = m === 'pixel' ? 1 : 4; }
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = t => t * t * (3 - 2 * t);

function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function hash2(x, y, s) { let h = (x * 374761393 + y * 668265263 + (s | 0) * 982451653) | 0; h = Math.imul(h ^ h >>> 13, 1274126177); return ((h ^ h >>> 16) >>> 0) / 4294967296; }
function hash1(i) { return hash2(i, 17, 3); }
function vnoise(x, y, s) { const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi; const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf); const a = hash2(xi, yi, s), b = hash2(xi + 1, yi, s), c = hash2(xi, yi + 1, s), d = hash2(xi + 1, yi + 1, s); return lerp(lerp(a, b, u), lerp(c, d, u), v); }
function fbm(x, y, s) { return vnoise(x, y, s) * 0.55 + vnoise(x * 2.1, y * 2.1, s + 7) * 0.3 + vnoise(x * 4.3, y * 4.3, s + 13) * 0.15; }
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(v => (v + 0.5) / 16);
const bayer = (x, y) => BAYER[(y & 3) * 4 + (x & 3)];

// ---------- palette ----------
const C = {
  k0: '#07080d', k1: '#0c0f18', b1: '#121827', b2: '#1a2236', b3: '#232d45', b4: '#2e3a56', b5: '#3b4a68', b6: '#4d5f80', b7: '#6a7d9c', b8: '#8b9cb8', b9: '#b7c3d6',
  g1: '#1c1a1f', g2: '#2a2629', g3: '#3b3433', g4: '#52463f', g5: '#6e5d4e', g6: '#8e7b66',
  br1: '#2b1f22', br2: '#3d2a29', br3: '#553833', br4: '#6e4a3f',
  gr1: '#1f2a28', gr2: '#2d3b37', gr3: '#41524c', gr4: '#62736b',
  s1: '#8a5a2b', s2: '#c07a35', s3: '#e8a95a', s4: '#f6d79a',
  pk: '#ff3d8b', pk2: '#b81d5c', rd: '#ff2a2a', rd2: '#8a1020', rd3: '#4a0a14', cy: '#39e6ff', cy2: '#1a8fb3', cy3: '#0f4a63',
  r0: '#140a08', r1: '#2a150f', r2: '#4a2416', r3: '#73391f', r4: '#a35a30', r5: '#c98a55', a1: '#7d7870', a2: '#b3ad9f', a3: '#d8d2c2',
  gd: '#d9b25a', gd2: '#9c7330', wh: '#f2eee4', sk: '#b48e74', sk2: '#7d5d4c'
};
const PAL = Object.values(C).map(h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]);
const RUST = ['#0b0605', '#1c0e0a', '#2a150f', '#4a2416', '#73391f', '#a35a30', '#7d7870', '#b3ad9f', '#d8d2c2'].map(h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]);
const qcache = new Map();
function nearestPal(r, g, b) {
  const k = (r >> 2) << 12 | (g >> 2) << 6 | (b >> 2);
  let v = qcache.get(k); if (v !== undefined) return v;
  let best = 0, bd = 1e12;
  for (let i = 0; i < PAL.length; i++) { const p = PAL[i]; const dr = r - p[0], dg = g - p[1], db = b - p[2]; const d = 2 * dr * dr + 4 * dg * dg + 3 * db * db; if (d < bd) { bd = d; best = i; } }
  qcache.set(k, best); return best;
}
// snap a canvas to the palette (pixel mode). dither = ordered dither amplitude (0-255 scale)
function snapCanvas(cv, dither = 0, alphaCut = 110) {
  const c = cv.getContext('2d'); const im = c.getImageData(0, 0, cv.width, cv.height); const d = im.data, W = cv.width;
  for (let i = 0, p = 0; i < d.length; i += 4, p++) {
    if (d[i + 3] < alphaCut) { d[i + 3] = 0; continue; }
    const x = p % W, y = (p / W) | 0; const o = dither ? (bayer(x, y) - 0.5) * dither : 0;
    const q = PAL[nearestPal(clamp(d[i] + o, 0, 255), clamp(d[i + 1] + o, 0, 255), clamp(d[i + 2] + o, 0, 255))];
    d[i] = q[0]; d[i + 1] = q[1]; d[i + 2] = q[2]; d[i + 3] = 255;
  }
  c.putImageData(im, 0, 0);
}
// The Other Side: drain colour to rust & ash, rot patches. Works on any static layer.
function otherRemap(cv, seed, scale, pixel) {
  const c = cv.getContext('2d'); const im = c.getImageData(0, 0, cv.width, cv.height); const d = im.data, W = cv.width; const n = RUST.length - 1;
  const NWd = Math.ceil(W / scale), NHd = Math.ceil(cv.height / scale), ROT = new Float32Array(NWd * NHd), STR = new Float32Array(NWd * NHd);
  for (let y = 0; y < NHd; y++) for (let x = 0; x < NWd; x++) { ROT[y * NWd + x] = fbm(x / 38, y / 30, seed); STR[y * NWd + x] = vnoise(x / 3, y / 60, seed + 5); }
  for (let i = 0, p = 0; i < d.length; i += 4, p++) {
    if (d[i + 3] < 10) continue;
    const x = p % W, y = (p / W) | 0; const ni = ((y / scale) | 0) * NWd + ((x / scale) | 0);
    let r = d[i], g = d[i + 1], b = d[i + 2];
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    let lum = (0.3 * r + 0.59 * g + 0.11 * b) / 255;
    if (mx - mn > 110 && lum > 0.3) lum *= 0.55;            // neon dies
    const rot = ROT[ni];
    const streak = STR[ni];       // vertical rust drips
    lum = lum * 1.25 + 0.03;
    if (rot > 0.6) lum *= 0.45;                              // peeled / rotten holes
    else if (rot > 0.57) lum = lum * 0.8 + 0.18;             // raw edge of peel
    lum -= Math.max(0, streak - 0.62) * 0.9;
    lum = clamp(lum, 0, 1);
    if (pixel) {
      const idx = clamp(Math.round(lum * n * 1.15 + (bayer(x, y) - 0.5) * 0.9), 0, n); const q = RUST[idx];
      d[i] = q[0]; d[i + 1] = q[1]; d[i + 2] = q[2];
    } else {
      const f = clamp(lum * n * 1.15, 0, n); const i0 = Math.floor(f), i1 = Math.min(n, i0 + 1), t = f - i0; const a = RUST[i0], bb = RUST[i1];
      const grain = (hash2(x, y, seed) - 0.5) * 10;
      d[i] = clamp(lerp(a[0], bb[0], t) + grain, 0, 255); d[i + 1] = clamp(lerp(a[1], bb[1], t) + grain, 0, 255); d[i + 2] = clamp(lerp(a[2], bb[2], t) + grain, 0, 255);
    }
  }
  c.putImageData(im, 0, 0);
}
function makeCanvas(w, h) { const c = document.createElement('canvas'); c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h)); return c; }
function rgba(hex, a) { const h = hex.replace('#', ''); return `rgba(${parseInt(h.slice(0, 2), 16)},${parseInt(h.slice(2, 4), 16)},${parseInt(h.slice(4, 6), 16)},${a})`; }

// ---------- input ----------
const keys = {}, pressed = {};
let anyKeyHook = null;
addEventListener('keydown', e => {
  const k = e.code; if (!keys[k]) pressed[k] = true; keys[k] = true;
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(k)) e.preventDefault();
  Sound.start(); if (anyKeyHook) anyKeyHook(k);
});
addEventListener('keyup', e => { keys[e.code] = false; });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; });
const In = {
  left: () => keys.KeyA || keys.ArrowLeft, right: () => keys.KeyD || keys.ArrowRight,
  up: () => keys.KeyW || keys.ArrowUp, down: () => keys.KeyS || keys.ArrowDown,
  sneak: () => keys.ShiftLeft || keys.ShiftRight || keys.KeyC, eye: () => keys.KeyQ,
  hit: (...codes) => codes.some(c => pressed[c]),
};
function clearPressed() { for (const k in pressed) delete pressed[k]; }

// ---------- procedural audio ----------
const Sound = {
  started: false, muted: false, p: { rain: 0, muffle: 0, drone: 0.2, eye: 0, jazz: 0, buzz: 0, train: 0, heart: 0 },
  start() {
    if (this.started) return; this.started = true;
    let A; try { A = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }
    this.A = A; const out = A.createGain(); out.gain.value = 0.8; out.connect(A.destination); this.out = out;
    const len = A.sampleRate * 3, buf = A.createBuffer(2, len, A.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const d = buf.getChannelData(ch); let b0 = 0, b1 = 0, b2 = 0; for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; b0 = 0.997 * b0 + w * 0.029; b1 = 0.985 * b1 + w * 0.032; b2 = 0.95 * b2 + w * 0.048; d[i] = (b0 + b1 + b2 + w * 0.04) * 0.6; } }
    this.noiseBuf = buf;
    const mk = (type, f, q) => { const n = A.createBiquadFilter(); n.type = type; n.frequency.value = f; if (q) n.Q.value = q; return n; };
    const gain = v => { const g = A.createGain(); g.gain.value = v; return g; };
    // rain bed
    const rs = A.createBufferSource(); rs.buffer = buf; rs.loop = true;
    this.rainLP = mk('lowpass', 7000); const rainHP = mk('highpass', 300); this.rainG = gain(0);
    rs.connect(rainHP); rainHP.connect(this.rainLP); this.rainLP.connect(this.rainG); this.rainG.connect(out); rs.start();
    // drips: random ticks
    // low drone
    this.droneG = gain(0); const dl = mk('lowpass', 260, 2);
    [55, 55.4, 82.6].forEach((f, i) => { const o = A.createOscillator(); o.type = i === 2 ? 'triangle' : 'sawtooth'; o.frequency.value = f; const g = gain(i === 2 ? 0.25 : 0.35); o.connect(g); g.connect(dl); o.start(); });
    const lfo = A.createOscillator(); lfo.frequency.value = 0.07; const lg = gain(120); lfo.connect(lg); lg.connect(dl.frequency); lfo.start();
    dl.connect(this.droneG); this.droneG.connect(out);
    // killer's-eye layer: dissonant shimmer
    this.eyeG = gain(0); const eb = mk('bandpass', 900, 4);
    [311, 329.6, 466].forEach(f => { const o = A.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; const g = gain(0.08); o.connect(g); g.connect(eb); o.start(); });
    const elfo = A.createOscillator(); elfo.frequency.value = 0.3; const elg = gain(500); elfo.connect(elg); elg.connect(eb.frequency); elfo.start();
    const es = A.createBufferSource(); es.buffer = buf; es.loop = true; const ebp = mk('bandpass', 2400, 8); const eng = gain(0.5); es.connect(ebp); ebp.connect(eng); eng.connect(eb); es.start();
    eb.connect(this.eyeG); this.eyeG.connect(out);
    // neon / fluorescent buzz
    this.buzzG = gain(0); const bo = A.createOscillator(); bo.type = 'square'; bo.frequency.value = 120; const bf = mk('bandpass', 240, 6); bo.connect(bf); bf.connect(this.buzzG); this.buzzG.connect(out); bo.start();
    // train rumble
    this.trainG = gain(0); const ts = A.createBufferSource(); ts.buffer = buf; ts.loop = true; const tl = mk('lowpass', 180, 1); ts.connect(tl); tl.connect(this.trainG); this.trainG.connect(out); ts.start();
    // jazz (muffled, through a wall)
    this.jazzG = gain(0); this.jazzLP = mk('lowpass', 650, 0.7); this.jazzLP.connect(this.jazzG); this.jazzG.connect(out);
    this.nextBeat = A.currentTime + 0.1; this.beat = 0; this.nextHeart = 0;
  },
  set(k, v) { this.p[k] = v; },
  update() {
    if (!this.A) return; const A = this.A, t = A.currentTime, m = this.muted ? 0 : 1, p = this.p;
    const tc = 0.25;
    this.rainG.gain.setTargetAtTime(p.rain * 0.55 * m, t, tc);
    this.rainLP.frequency.setTargetAtTime(p.muffle ? 700 : 6500, t, tc);
    this.droneG.gain.setTargetAtTime((0.05 + p.drone * 0.22) * m, t, 0.6);
    this.eyeG.gain.setTargetAtTime(p.eye * 0.22 * m, t, 0.15);
    this.buzzG.gain.setTargetAtTime(p.buzz * 0.03 * m, t, 0.05);
    this.trainG.gain.setTargetAtTime(p.train * 1.2 * m, t, 0.2);
    this.jazzG.gain.setTargetAtTime(p.jazz * 0.5 * m, t, 0.3);
    // walking bass + soft chords, 72 bpm, scheduled ahead
    const spb = 60 / 72;
    const bass = [41, 44, 46, 47, 48, 47, 46, 44, 39, 41, 43, 44, 46, 44, 43, 41];
    while (this.nextBeat < t + 0.3) {
      if (p.jazz > 0.01 && !this.muted) {
        const nt = this.nextBeat, n = bass[this.beat % 16];
        this.tone(440 * Math.pow(2, (n - 69) / 12), nt, 0.5, 'triangle', 0.5, this.jazzLP);
        if (this.beat % 4 === 0) [n + 24, n + 27, n + 31, n + 34].forEach((c, i) => this.tone(440 * Math.pow(2, (c - 69) / 12), nt + i * 0.02, 1.6, 'sine', 0.09, this.jazzLP));
        if (this.beat % 8 === 6) this.tone(440 * Math.pow(2, (n + 36 - 69) / 12), nt + spb * 0.5, 0.7, 'sine', 0.07, this.jazzLP);
      }
      this.nextBeat += spb; this.beat++;
    }
    if (p.heart > 0.05 && t > this.nextHeart && !this.muted) { this.thump(t, p.heart); this.thump(t + 0.22, p.heart * 0.7); this.nextHeart = t + lerp(1.3, 0.62, p.heart); }
  },
  tone(f, t0, dur, type, vol, dest) {
    const A = this.A, o = A.createOscillator(), g = A.createGain(); o.type = type; o.frequency.value = f;
    g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(vol, t0 + 0.02); g.gain.exponentialRampToValueAtTime(0.0005, t0 + dur);
    o.connect(g); g.connect(dest || this.out); o.start(t0); o.stop(t0 + dur + 0.05);
  },
  thump(t0, v) { const A = this.A, o = A.createOscillator(), g = A.createGain(); o.frequency.setValueAtTime(70, t0); o.frequency.exponentialRampToValueAtTime(38, t0 + 0.15); g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(0.5 * v, t0 + 0.01); g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.25); o.connect(g); g.connect(this.out); o.start(t0); o.stop(t0 + 0.3); },
  noise(dur, f, q, vol, type = 'bandpass') {
    if (!this.A || this.muted) return; const A = this.A, t0 = A.currentTime, s = A.createBufferSource(); s.buffer = this.noiseBuf;
    const fl = A.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q; const g = A.createGain();
    g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(0.0005, t0 + dur);
    s.connect(fl); fl.connect(g); g.connect(this.out); s.start(t0, Math.random() * 2); s.stop(t0 + dur + 0.05);
  },
  step(wet) { this.noise(0.09, wet ? 1800 : 900, 1.2, wet ? 0.35 : 0.25); },
  sfx(name) {
    if (!this.A || this.muted) return; const t = this.A.currentTime;
    if (name === 'clue') { this.tone(659, t, 1.6, 'sine', 0.12); this.tone(987, t + 0.09, 1.8, 'sine', 0.08); this.tone(1318, t + 0.18, 2.2, 'sine', 0.05); }
    else if (name === 'deduce') { [523, 659, 784, 1046].forEach((f, i) => this.tone(f, t + i * 0.07, 2.4, 'triangle', 0.07)); }
    else if (name === 'wrong') { this.tone(196, t, 0.5, 'sawtooth', 0.04); this.tone(185, t, 0.5, 'sawtooth', 0.04); }
    else if (name === 'door') { this.noise(0.35, 200, 1, 0.6, 'lowpass'); this.tone(80, t, 0.3, 'sine', 0.3); }
    else if (name === 'page') { this.noise(0.18, 3000, 0.8, 0.25); }
    else if (name === 'pin') { this.tone(1800, t, 0.08, 'square', 0.03); this.noise(0.05, 4000, 2, 0.2); }
    else if (name === 'warp') { const o = this.A.createOscillator(), g = this.A.createGain(); o.type = 'sawtooth'; o.frequency.setValueAtTime(220, t); o.frequency.exponentialRampToValueAtTime(30, t + 2.5); g.gain.setValueAtTime(0.15, t); g.gain.exponentialRampToValueAtTime(0.001, t + 2.6); o.connect(g); g.connect(this.out); o.start(t); o.stop(t + 2.7); this.noise(2.5, 400, 0.5, 0.4, 'lowpass'); }
    else if (name === 'land') { this.noise(0.12, 600, 1, 0.3); }
    else if (name === 'rung') { this.tone(420 + Math.random() * 60, t, 0.12, 'triangle', 0.05); }
  }
};
