'use strict';
// Area = static parallax layers (built once per mode/world) + gameplay geometry + dynamic draw hooks.
const GLYPH = {
  cocktail: [[0, 0, 16, 0, 8, 9, 0, 0], [8, 9, 8, 17], [3, 17, 13, 17], [11, 3, 15, -3], [13, -2, 17, -2]],
  sax: [[2, -4, 4, 0, 4, 12, 7, 16, 11, 15, 12, 11], [4, 3, 6, 3], [4, 7, 6, 7]],
  subway: [[6, 0, 10, 0, 13, 3, 14, 7, 13, 11, 10, 14, 6, 14, 3, 11, 2, 7, 3, 3, 6, 0], [9, 3, 6, 8, 11, 8], [9, 3, 9, 11]],
  arrow: [[0, 4, 14, 4], [10, 0, 14, 4, 10, 8]],
  cross: [[5, 0, 5, 16], [1, 5, 9, 5]],
};

function areaAlley(world) {
  const other = world === 'other', ground = 184;
  const A = {
    id: other ? 'other' : 'alley', world, w: 960, ground, rain: !other, ash: other, interior: false,
    title: other ? 'The Other Side' : 'Ashgrove Alley', sub: other ? 'behind the Blue Hour, but wrong' : 'behind the Blue Hour jazz club, 3:12 a.m.',
    ambient: other ? 0.16 : 0.1, fogA: other ? 0.85 : 0.45, fogNear: other ? 0.6 : 0.3, fogKind: other ? 'ash' : 'fog',
    platforms: [{ x: 98, y: 150, w: 106 }, { x: 98, y: 116, w: 106 }, { x: 98, y: 82, w: 106 }, { x: 344, y: 167, w: 32 }],
    ladders: [{ x1: 106, y1: 184, x2: 106, y2: 150 }, { x1: 194, y1: 150, x2: 194, y2: 116 }, { x1: 108, y1: 116, x2: 108, y2: 82 }],
    puddles: [{ x: 248, w: 34 }, { x: 476, w: 46 }, { x: 636, w: 30 }, { x: 756, w: 40 }],
    vents: [{ x: 404, y: 176, rate: 4 }],
    lights: [
      { x: 240, y: 116, r: 95, i: 0.95, col: C.s3, kind: 'lamp', cone: [6, 70, 68] },
      { x: 308, y: 168, r: 40, i: 0.55, col: C.s3, kind: 'door' },
      { x: 328, y: 132, r: 44, i: 0.5, col: C.pk, kind: 'neon', glyph: 'cocktail', seed: 3 },
      { x: 620, y: 112, r: 85, i: 0.8, col: C.s3, kind: 'lamp', cone: [6, 64, 72], flicker: 11 },
      { x: 868, y: 138, r: 50, i: 0.55, col: C.cy, kind: 'neon', glyph: 'subway', seed: 8 },
    ],
    exits: [{ x: 0, w: 22, to: 'precinct', spawn: 46, label: 'Kessler St.  Precinct 9' }, { x: 848, w: 34, to: 'subway', spawn: 40, label: 'Down to Line 4' }],
    clues: [
      { id: 'petals', x: 322, y: 184, title: 'Lily petals', note: 'White lily petals in the puddle by the Blue Hour door. Fresh. Nobody buys lilies in this part of town.' },
      { id: 'landing', x: 150, y: 82, title: 'Wax & gold thread', note: 'Top of the fire escape: a candle stub, and gold thread snagged on the rail. He watched from up here.' },
      { id: 'sigil', x: 566, y: 184, hidden: true, title: 'Chalk sigil', note: 'A sigil on the brick, only visible when I let myself see like him. A halo over an open hand.' },
    ],
    npcs: other ? [] : [{ id: 'tom', char: 'tom', x: 424, state: 'sit', face: -1, talk: 'tom' }],
    ghost: [[150, 82], [110, 82], [108, 116], [192, 116], [194, 150], [108, 150], [106, 184], [300, 184], [566, 184]],
    layers: [
      { par: 0.04, blur: 3, draw: (c, o) => { sky(c, o.w, { seed: 4, low: other ? '#3a2018' : '#2b2a3c' }); } },
      { par: 0.2, blur: 1.2, draw: (c, o) => { skyline(c, o.w, { seed: 12, col: '#151c2d', base: 165, minW: 18, maxW: 46, minH: 40, maxH: 120, lit: 0.05, wx: 4, wy: 6 });
          for (let x = 40; x < o.w; x += 46) { rect(c, x, 128, 46, 3, '#121827'); for (let k = 0; k < 46; k += 2) rect(c, x + k, 131 + Math.round(Math.sin(k / 46 * Math.PI) * 9), 2, 2, '#121827'); } } },
      { par: 0.5, blur: 0.6, fogAfter: true, draw: (c, o) => { skyline(c, o.w, { seed: 33, col: '#1a2133', base: 186, minW: 30, maxW: 70, minH: 40, maxH: 100, lit: 0.12, wx: 6, wy: 8, ww: 2, wh: 2 });
          const r = mulberry32(2); for (let i = 0; i < 5; i++) { const x = 60 + i * 130 + r() * 40, y = 96 + r() * 30; for (let k = 0; k < 40; k++) rect(c, x + k, y + Math.round(Math.sin(k / 40 * Math.PI) * 4), 1, 1, '#0c0f18'); for (let k = 4; k < 36; k += 6) rect(c, x + k, y + 1 + Math.round(Math.sin(k / 40 * Math.PI) * 4), 3, 4 + (r() * 3 | 0), r() < 0.5 ? '#2a3045' : '#3b3433'); } } },
      { par: 1, main: true, draw: (c, o) => alleyMain(c, A, o) },
      { par: 1.3, z: 'fg', draw: (c, o) => { const r = mulberry32(6);
          for (let x = 0; x < o.w; x += 150 + r() * 120) { const h = 20 + r() * 26; rect(c, x, NH - h, 3, h, C.k0); rect(c, x + 46, NH - h, 3, h, C.k0); for (let k = 0; k < 46; k += 3) for (let y = NH - h; y < NH; y += 3) rect(c, x + k + ((y / 3) % 2), y, 1, 1, rgba(C.k0, 0.9)); rect(c, x, NH - h, 49, 2, C.k0); }
          for (let x = 80; x < o.w; x += 260) { rect(c, x, NH - 8, 60, 8, C.k0); rect(c, x + 6, NH - 14, 8, 6, C.k0); } } },
    ],
    dynamicBack: (c, t, g) => alleyDynamic(c, t, A, g),
  };
  return A;
}
function alleyMain(c, A, o) {
  const g = A.ground, r = mulberry32(17), other = A.world === 'other';
  // building C (right, subway) & B (middle) & A (left, jazz)
  A.wins = [];
  A.wins.push(...facade(c, { x: 690, w: 270, top: 34, bottom: g, col: C.br2, brick: true, rows: 4, cols: 5, padX: 18, dx: 50, padY: 16, dy: 30, ww: 12, wh: 16, lit: 0.35, seed: 3, skip: (ri, ci) => ri === 3 && ci >= 3 }));
  A.wins.push(...facade(c, { x: 436, w: 256, top: 70, bottom: g, col: C.br1, brick: true, rows: 3, cols: 4, padX: 22, dx: 62, padY: 14, dy: 30, ww: 14, wh: 16, lit: 0.25, seed: 9, skip: (ri, ci) => ri === 2 && (ci === 1 || ci === 2) }));
  A.wins.push(...facade(c, { x: 24, w: 412, top: 20, bottom: g, col: C.br3, brick: true, rows: 4, cols: 8, padX: 12, dx: 50, padY: 14, dy: 32, ww: 12, wh: 16, lit: 0.3, seed: 5, skip: (ri, ci) => ri === 3 && ci >= 5 }));
  // ghost advert (faded paint) on building B
  c.fillStyle = rgba(C.a2, 0.08); c.fillRect(470, 96, 150, 22); c.fillStyle = rgba(C.a2, 0.06); for (let i = 0; i < 9; i++) c.fillRect(478 + i * 15, 100, 10, 14);
  // jazz bar back door + awning + steps
  rect(c, 296, 156, 24, 28, C.k0); rect(c, 298, 158, 20, 26, '#3a1416'); rect(c, 307, 158, 1, 26, C.k0); rect(c, 315, 170, 2, 2, C.gd2);
  rect(c, 300, 158, 6, 1, C.s3); rect(c, 296, 184, 24, 1, C.s2);
  poly(c, [286, 148, 332, 148, 336, 156, 282, 156], C.rd3); for (let x = 284; x < 334; x += 6) rect(c, x, 155, 3, 2, C.rd2);
  rect(c, 294, 182, 28, 2, C.b5);
  // crates and cans by door
  rect(c, 264, 170, 14, 14, C.g4); rect(c, 264, 170, 14, 1, C.g5); line(c, 264, 170, 278, 184, rgba(C.k0, 0.5)); rect(c, 268, 162, 10, 8, C.g3);
  rect(c, 326, 174, 7, 10, C.b4); rect(c, 326, 174, 7, 1, C.b6);
  // fire escape
  [150, 116, 82].forEach(y => landingArt(c, 98, y, 106));
  ladderArt(c, 106, 150, g); ladderArt(c, 194, 116, 150); ladderArt(c, 108, 82, 116);
  rect(c, 98, 82, 1, 70, C.b5); rect(c, 203, 82, 1, 70, C.b5);
  // candle stub on top landing
  rect(c, 148, 78, 2, 4, C.wh); rect(c, 147, 81, 4, 1, C.a2);
  // pipes, AC units
  pipe(c, 214, 24, g); pipe(c, 430, 60, g); pipe(c, 700, 40, g);
  [[60, 52], [262, 86], [520, 104], [800, 72]].forEach(([x, y]) => { rect(c, x, y, 14, 9, C.b4); rect(c, x, y, 14, 1, C.b6); for (let k = 2; k < 13; k += 2) rect(c, x + k, y + 2, 1, 5, C.k1); rect(c, x + 3, y + 9, 1, 30, rgba(C.k0, 0.3)); });
  // lamp posts
  lampPost(c, 230, g, 70, 1); lampPost(c, 610, g, 72, 1);
  // dumpster, bags, vent, crate for Tom
  dumpster(c, 344, g); trashBags(c, 378, g, r);
  rect(c, 396, 178, 16, 6, C.k1); for (let x = 397; x < 411; x += 2) rect(c, x, 179, 1, 4, C.b4);
  rect(c, 416, 174, 16, 10, C.g4); rect(c, 416, 174, 16, 1, C.g6);
  // sigil wall patch (building B) - the sigil itself is only drawn in the killer's eye
  rect(c, 548, 128, 40, 40, rgba(C.k0, 0.12));
  // graffiti tags (abstract)
  for (let i = 0; i < 4; i++) { const x = 460 + i * 60 + r() * 20, y = 150 + r() * 14; for (let k = 0; k < 14; k++) rect(c, x + k, y + Math.round(Math.sin(k * 0.9 + i) * 2), 1, 1, rgba([C.cy2, C.pk2, C.b7][i % 3], 0.35)); }
  // subway entrance
  rect(c, 846, 150, 40, 34, C.k0); for (let i = 0; i < 6; i++) rect(c, 848 + i * 1, 158 + i * 4, 36 - i * 2, 1, rgba(C.b6, 0.5 - i * 0.07));
  rect(c, 842, 150, 2, 34, C.gr3); rect(c, 886, 150, 2, 34, C.gr3); rect(c, 842, 150, 46, 2, C.gr3); for (let x = 844; x < 886; x += 4) rect(c, x, 152, 1, 6, C.gr2);
  rect(c, 866, 124, 2, 26, C.gr2);
  // parked car at left street mouth
  rect(c, 0, 168, 40, 12, C.b4); rect(c, 4, 160, 26, 9, C.b4); rect(c, 7, 162, 9, 6, C.k1); rect(c, 18, 162, 10, 6, C.k1); disc(c, 8, 181, 3, C.k0); disc(c, 32, 181, 3, C.k0); rect(c, 38, 171, 2, 2, C.rd2);
  // ground
  asphalt(c, o.w, g, { seed: 3 });
  rect(c, 0, g, o.w, 1, C.b6);
  A.puddles.forEach(p => puddleBase(c, p, g));
  // manhole + painted curb
  rect(c, 700, g + 8, 18, 2, C.k1); rect(c, 702, g + 7, 14, 1, C.b5);
  // other side: twisted extra growth on the fire escape & walls
  if (other) { for (let i = 0; i < 40; i++) { let x = 30 + r() * 900, y = 20 + r() * 150; for (let k = 0; k < 24; k++) { rect(c, x, y, 1, 1, C.k0); x += (r() - 0.5) * 2; y += 1; } }
    for (let i = 0; i < 12; i++) { const x = 100 + i * 70; line(c, x, g, x + 8, g - 40 - r() * 60, rgba(C.k0, 0.8), 2); } }
}
function alleyDynamic(c, t, A, g) {
  const other = A.world === 'other', gr = A.ground;
  // TV windows
  for (const w of A.wins || []) if (w.tv) { const f = 0.25 + 0.25 * Math.sin(t * 9 + w.seed * 10) + (hash2(Math.floor(t * 8), w.seed * 100 | 0, 1) > 0.7 ? 0.3 : 0); rect(c, w.x, w.y, w.w, w.h, rgba(other ? C.rd2 : '#6b8cc9', f * 0.6)); }
  for (const L of A.lights) {
    let on = L.flicker ? flick(L.flicker, t, 0.8) : true; let i = L.i;
    if (other) { i *= 0.55; }
    if (L.kind === 'lamp') { if (!on) i *= 0.15; const col = other ? C.rd : L.col; glow(c, L.x, L.y, 14, col, i); cone(c, L.x, L.y + 2, L.cone[0], L.cone[1], L.cone[2], col, i * 0.9);
      // dust motes in the cone
      for (let k = 0; k < 9; k++) { const ph = hash1(k + L.x) * 6.28, yy = ((t * 6 + k * 9) % L.cone[2]), xx = Math.sin(t * 0.7 + ph) * L.cone[1] * 0.3 * (yy / L.cone[2]); rect(c, L.x + xx, L.y + 4 + yy, 1, 1, rgba(C.s4, 0.35 * i)); } }
    else if (L.kind === 'door') { const f = 0.85 + 0.15 * Math.sin(t * 2.1) * Math.sin(t * 5.3); glow(c, L.x, L.y, 34, other ? C.rd2 : L.col, i * f); poly(c, [298, 184, 318, 184, 330, 194, 286, 194], rgba(other ? C.rd2 : C.s3, 0.12 * f)); }
    else if (L.kind === 'neon') { const ons = other ? flick(L.seed + 50, t, 2) && hash2(Math.floor(t * 3), L.seed, 4) < 0.3 : flick(L.seed, t); neon(c, L.x - 8, L.y - 6, GLYPH[L.glyph], other ? C.rd2 : L.col, ons); L.on = ons; }
  }
  if (other && A.id === 'other') drawTableau(c, t, 566, gr);
}
// staged crime scene still life (rich reds & golds)
function drawTableau(c, t, x, g) {
  glow(c, x, g - 30, 70, C.gd, 0.35 + 0.05 * Math.sin(t * 3));
  // dais steps
  rect(c, x - 40, g - 6, 80, 6, C.rd3); rect(c, x - 32, g - 11, 64, 5, C.rd2); rect(c, x - 40, g - 6, 80, 1, C.gd2); rect(c, x - 32, g - 11, 64, 1, C.gd);
  // drapes
  poly(c, [x - 46, g - 90, x - 30, g - 90, x - 34, g - 11, x - 52, g - 6], C.rd2); poly(c, [x + 30, g - 90, x + 46, g - 90, x + 52, g - 6, x + 34, g - 11], C.rd2);
  for (let k = 0; k < 4; k++) { line(c, x - 44 + k * 4, g - 88, x - 48 + k * 4, g - 10, rgba(C.rd3, 0.8)); line(c, x + 34 + k * 4, g - 88, x + 38 + k * 4, g - 10, rgba(C.rd3, 0.8)); }
  rect(c, x - 48, g - 92, 96, 3, C.gd2);
  // throne back with halo
  rect(c, x - 12, g - 50, 24, 39, C.rd3); rect(c, x - 12, g - 50, 24, 1, C.gd);
  c.save(); c.strokeStyle = C.gd; c.lineWidth = PIX() ? 1 : 0.8; c.beginPath(); c.arc(x, g - 46, 13, Math.PI, 0); c.stroke(); c.restore();
  for (let a = 0; a < 9; a++) { const an = Math.PI + a * Math.PI / 8; line(c, x + Math.cos(an) * 13, g - 46 + Math.sin(an) * 13, x + Math.cos(an) * 17, g - 46 + Math.sin(an) * 17, C.gd); }
  // antlers
  const ant = (s) => { line(c, x + s * 3, g - 44, x + s * 10, g - 58, C.a3); line(c, x + s * 7, g - 52, x + s * 13, g - 52, C.a3); line(c, x + s * 9, g - 56, x + s * 9, g - 63, C.a3); line(c, x + s * 10, g - 58, x + s * 15, g - 64, C.a3); };
  ant(-1); ant(1);
  // veiled seated figure
  poly(c, [x - 6, g - 44, x + 6, g - 44, x + 10, g - 26, x + 14, g - 12, x - 14, g - 12, x - 10, g - 26], C.a3);
  disc(c, x, g - 44, 4, C.wh); poly(c, [x - 5, g - 44, x + 5, g - 44, x + 8, g - 30, x - 8, g - 30], rgba(C.wh, 0.85));
  for (let k = -9; k <= 9; k += 3) line(c, x + k * 0.6, g - 40, x + k, g - 13, rgba(C.a2, 0.7));
  // folded hands
  rect(c, x - 2, g - 30, 4, 3, C.sk); rect(c, x - 1, g - 31, 2, 1, C.sk2);
  // gold cloth over lap
  poly(c, [x - 13, g - 22, x + 13, g - 22, x + 16, g - 12, x - 16, g - 12], C.gd2); for (let k = -12; k < 13; k += 4) rect(c, x + k, g - 20, 2, 1, C.gd);
  // lilies, pomegranates, candles
  [[-26, 0], [24, 0], [-20, 1], [19, 1]].forEach(([dx, l]) => { line(c, x + dx, g - 11, x + dx + 1, g - 24 - l * 4, C.gr3); disc(c, x + dx + 1, g - 25 - l * 4, 2, C.wh); rect(c, x + dx, g - 26 - l * 4, 1, 1, C.gd); });
  [[-8, -6], [9, -6], [-30, -2]].forEach(([dx, dy]) => { disc(c, x + dx, g + dy - 2, 2, C.rd2); rect(c, x + dx, g + dy - 5, 1, 1, C.gd2); });
  [-36, -28, 28, 36, -16, 16].forEach((dx, i) => { const h = 6 + (i % 3) * 3, cy = g - 11 - h; rect(c, x + dx, cy, 2, h, C.wh); const f = 0.7 + 0.3 * Math.sin(t * 11 + i * 2) * Math.sin(t * 7 + i);
    rect(c, x + dx, cy - 2, 2, 2, C.s4); glow(c, x + dx + 1, cy - 2, 7, C.s3, 0.5 * f); });
}

function areaPrecinct() {
  const ground = 184, up = 112;
  const A = {
    id: 'precinct', world: 'normal', w: 640, ground, rain: false, interior: true, title: 'Precinct 9', sub: 'night shift, Homicide floor',
    ambient: 0.32, fogA: 0.12, fogNear: 0.06, fogKind: 'fog',
    platforms: [{ x: 134, y: up, w: 480 }],
    ladders: [{ x1: 62, y1: ground, x2: 132, y2: up, stairs: true }],
    puddles: [], vents: [{ x: 528, y: 150, rate: 12 }],
    windows: [{ x: 150, y: 124, w: 22, h: 20 }, { x: 430, y: 124, w: 22, h: 20 }, { x: 300, y: 56, w: 22, h: 20 }, { x: 574, y: 56, w: 22, h: 20 }],
    lights: [
      { x: 210, y: 118, r: 80, i: 0.75, col: '#cfe3e6', kind: 'tube' }, { x: 360, y: 118, r: 80, i: 0.75, col: '#cfe3e6', kind: 'tube', flicker: 21 }, { x: 500, y: 118, r: 80, i: 0.7, col: '#cfe3e6', kind: 'tube' },
      { x: 230, y: 46, r: 70, i: 0.55, col: '#cfe3e6', kind: 'tube' }, { x: 470, y: 46, r: 70, i: 0.4, col: '#cfe3e6', kind: 'tube', flicker: 5 },
      { x: 246, y: 164, r: 30, i: 0.6, col: C.s3, kind: 'desk' }, { x: 484, y: 160, r: 30, i: 0.5, col: C.cy, kind: 'vend' },
      { x: 470, y: 66, r: 40, i: 0.6, col: C.s3, kind: 'bulb' },
    ],
    exits: [{ x: 14, w: 24, to: 'alley', spawn: 34, label: 'Out to the street' }],
    clues: [{ id: 'file', x: 232, y: up, title: "Coroner's note", note: 'Victim three: hands folded "as if in prayer, by someone who had studied paintings." Eyes closed with gold leaf.' }],
    special: [{ id: 'board', x: 356, y: ground, label: 'Cork board', r: 18 }],
    npcs: [{ id: 'vale', char: 'vale', x: 520, state: 'idle', face: -1, talk: 'vale' }, { id: 'officer', char: 'officer', x: 196, state: 'idle', face: 1, talk: 'officer' }],
    ghost: null,
    layers: [
      { par: 0.04, blur: 3, draw: (c, o) => sky(c, o.w, { seed: 9 }) },
      { par: 0.25, blur: 1, draw: (c, o) => skyline(c, o.w, { seed: 44, col: '#151c2d', base: 190, minW: 20, maxW: 50, minH: 60, maxH: 150, lit: 0.06, wx: 4, wy: 6 }) },
      { par: 1, main: true, draw: (c, o) => precinctMain(c, A, o) },
    ],
    dynamicBack: (c, t) => interiorDynamic(c, t, A),
  };
  return A;
}
function precinctMain(c, A, o) {
  const g = A.ground, up = 112, r = mulberry32(23);
  // building shell
  rect(c, 8, 18, 624, g - 18, C.br2); rect(c, 4, 14, 632, 5, C.b5); rect(c, 4, 19, 632, 1, C.k0);
  for (let x = 40; x < 620; x += 90) { rect(c, x, 6, 18, 8, C.b4); rect(c, x, 6, 18, 1, C.b6); }
  // interior rooms
  const wallLow = C.gr2, wallUp = C.gr3;
  vgrad(c, 20, 40, 600, up - 40, [[0, C.gr2], [1, C.gr3]]); vgrad(c, 20, up + 6, 600, g - up - 6, [[0, C.gr2], [0.55, C.gr3], [0.56, C.gr1], [1, C.gr2]]);
  rect(c, 20, 150, 600, 1, C.gr4);
  for (let i = 0; i < 40; i++) { const x = 20 + r() * 600, y = 40 + r() * 140; vgrad(c, x, y, 2 + r() * 6, 6 + r() * 20, [[0, rgba(C.k0, 0.18)], [1, rgba(C.k0, 0)]]); }
  // floors / slab / ceiling
  rect(c, 20, up, 600, 6, C.b3); rect(c, 20, up, 600, 1, C.b6); rect(c, 20, up + 6, 600, 1, C.k0); rect(c, 20, 38, 600, 3, C.b3);
  rect(c, 62, up, 72, 6, C.gr2); // stairwell opening
  // stairs (diagonal)
  for (let i = 0; i <= 18; i++) { const x = 62 + i * 4, y = g - i * 4; rect(c, x, y - 1, 5, 1, C.b6); rect(c, x, y, 5, 4, C.b3); }
  line(c, 60, g - 10, 132, up - 10, C.b6); line(c, 60, g - 5, 132, up - 5, rgba(C.b6, 0.6));
  // windows (night outside, rain drawn dynamically)
  A.windows.forEach(w => { rect(c, w.x - 2, w.y - 2, w.w + 4, w.h + 4, C.k0); vgrad(c, w.x, w.y, w.w, w.h, [[0, C.b2], [1, '#252338']]); for (let k = 0; k < 8; k++) rect(c, w.x + r() * w.w, w.y + w.h * 0.5 + r() * w.h * 0.5, 1, 1, C.s3); rect(c, w.x + w.w / 2, w.y, 1, w.h, C.k0); rect(c, w.x - 3, w.y + w.h + 2, w.w + 6, 1, C.gr4); for (let k = 0; k < w.h; k += 3) rect(c, w.x, w.y + k, w.w, 1, rgba(C.k0, 0.35)); });
  // ground floor: desks
  const desk = (x, lamp) => { rect(c, x, 166, 36, 3, C.g5); rect(c, x, 169, 36, 15, C.g4); rect(c, x + 2, 171, 12, 5, C.g3); rect(c, x + 2, 177, 12, 5, C.g3); rect(c, x + 7, 173, 2, 1, C.gd2); rect(c, x + 7, 179, 2, 1, C.gd2);
    rect(c, x + 18, 158, 12, 8, C.b4); rect(c, x + 19, 159, 10, 6, '#1b2a2c'); rect(c, x + 23, 166, 2, 1, C.b4); for (let k = 0; k < 3; k++) rect(c, x + 2 + k, 162 - k * 2, 9, 2, k % 2 ? C.wh : C.a2);
    if (lamp) { line(c, x + 32, 166, x + 30, 158, C.k1); rect(c, x + 27, 156, 6, 3, C.k1); }
    rect(c, x + 10, 172, 10, 2, C.k1); rect(c, x + 14, 174, 2, 10, C.k1); rect(c, x + 9, 162, 4, 10, C.k1); };
  desk(160, false); desk(220, true);
  // cork board
  rect(c, 330, 126, 52, 32, C.g2); rect(c, 332, 128, 48, 28, C.s1);
  for (let i = 0; i < 140; i++) rect(c, 332 + r() * 47, 128 + r() * 27, 1, 1, rgba(r() < 0.5 ? C.g4 : C.s2, 0.6));
  [[336, 131], [350, 133], [366, 130], [340, 144], [357, 145], [370, 142]].forEach(([x, y]) => { rect(c, x, y, 8, 9, C.wh); rect(c, x + 1, y + 1, 6, 5, C.b4); rect(c, x + 3, y, 2, 1, C.rd); });
  line(c, 340, 133, 354, 135, C.rd); line(c, 354, 135, 361, 147, C.rd); line(c, 344, 146, 370, 132, C.rd);
  // filing cabinets, vending, coffee, cooler
  for (let k = 0; k < 2; k++) { rect(c, 396 + k * 14, 150, 13, 34, C.b5); for (let y = 152; y < 182; y += 8) { rect(c, 397 + k * 14, y, 11, 7, C.b4); rect(c, 401 + k * 14, y + 3, 4, 1, C.b7); } }
  rect(c, 470, 140, 26, 44, C.b3); rect(c, 472, 142, 16, 30, '#163c46'); for (let y = 145; y < 170; y += 6) for (let x = 474; x < 486; x += 4) rect(c, x, y, 3, 4, [C.rd2, C.gd2, C.cy2][(x + y) % 3]); rect(c, 490, 150, 4, 8, C.k1);
  rect(c, 504, 160, 14, 24, C.k1); rect(c, 506, 162, 10, 8, C.b4); rect(c, 509, 172, 4, 4, C.wh); rect(c, 522, 156, 8, 28, C.b6); rect(c, 523, 150, 6, 7, rgba(C.cy, 0.5));
  // posters
  rect(c, 286, 128, 12, 16, C.a2); rect(c, 288, 131, 8, 6, C.b4); rect(c, 560, 128, 14, 18, C.a2); rect(c, 562, 130, 10, 8, C.rd3);
  // exit door
  rect(c, 20, 146, 18, 38, C.k0); rect(c, 22, 148, 14, 36, C.g3); rect(c, 33, 166, 2, 2, C.gd2); rect(c, 24, 150, 10, 8, rgba(C.b7, 0.4)); glow(c, 29, 142, 6, C.rd, 0.5); rect(c, 26, 140, 6, 2, C.rd);
  // upper floor: evidence lockers
  for (let k = 0; k < 4; k++) { rect(c, 190 + k * 18, 70, 17, 42, C.b4); rect(c, 190 + k * 18, 70, 17, 1, C.b6); for (let y = 74; y < 110; y += 5) rect(c, 193 + k * 18, y, 11, 1, rgba(C.k0, 0.5)); rect(c, 203 + k * 18, 90, 2, 3, C.gd2); }
  rect(c, 226, 104, 14, 8, C.g5); rect(c, 226, 104, 14, 1, C.g6); // file box
  // interrogation room behind wire glass
  rect(c, 390, 46, 170, 66, C.k1); rect(c, 392, 48, 166, 64, '#151d1d');
  for (let x = 392; x < 558; x += 4) rect(c, x, 48, 1, 64, rgba(C.b6, 0.25)); for (let y = 48; y < 112; y += 4) rect(c, 392, y, 166, 1, rgba(C.b6, 0.25));
  rect(c, 448, 92, 44, 3, C.b5); rect(c, 452, 95, 2, 17, C.b4); rect(c, 486, 95, 2, 17, C.b4); rect(c, 438, 88, 8, 2, C.b4); rect(c, 438, 90, 2, 22, C.b4); rect(c, 494, 88, 8, 2, C.b4); rect(c, 500, 90, 2, 22, C.b4);
  rect(c, 386, 46, 4, 66, C.b4); rect(c, 560, 46, 4, 66, C.b4);
  // upper desk + chair
  rect(c, 290, 98, 30, 3, C.g5); rect(c, 292, 101, 26, 11, C.g4);
  // railing on upper floor edge near stairwell
  rect(c, 134, 102, 1, 10, C.b6); rect(c, 134, 102, 40, 1, C.b6);
  // floor ground
  rect(c, 8, g, 624, NH - g, C.b2); rect(c, 8, g, 624, 1, C.b6); for (let x = 20; x < 620; x += 16) rect(c, x, g + 1, 1, 4, rgba(C.k0, 0.4));
  vgrad(c, 0, g + 4, o.w, NH - g, [[0, rgba(C.k0, 0)], [1, C.k0]]);
}
function interiorDynamic(c, t, A) {
  // rain on windows
  for (const w of A.windows || []) { c.save(); c.beginPath(); c.rect(w.x, w.y, w.w, w.h); c.clip();
    for (let i = 0; i < 10; i++) { const x = w.x + hash1(i * 3 + w.x) * w.w, y = w.y + ((t * 90 * (0.7 + hash1(i)) + hash1(i + 9) * 50) % (w.h + 8)) - 4; rect(c, x, y, 1, 3, rgba(C.b8, 0.4)); }
    for (let i = 0; i < 4; i++) { const x = w.x + hash1(i * 7 + 2) * w.w, y = w.y + ((t * 8 + hash1(i) * 30) % (w.h + 4)); rect(c, x, y, 1, 2, rgba(C.b9, 0.5)); } c.restore(); }
  for (const L of A.lights) {
    const on = L.flicker ? flick(L.flicker, t, 1.3) : true; const i = on ? L.i : L.i * 0.12;
    if (L.kind === 'tube') { rect(c, L.x - 12, L.y - 2, 24, 2, C.k1); rect(c, L.x - 11, L.y, 22, 1, on ? C.wh : C.b5); glow(c, L.x, L.y, 18, L.col, i * 0.7); cone(c, L.x, L.y + 1, 22, 70, A.id === 'subway' ? 140 : 64, L.col, i * 0.45); }
    else if (L.kind === 'desk') { glow(c, L.x, L.y, 22, L.col, i); cone(c, L.x, L.y - 4, 3, 16, 8, L.col, i); }
    else if (L.kind === 'vend') { glow(c, L.x, L.y, 26, L.col, i * (0.8 + 0.2 * Math.sin(t * 1.3))); }
    else if (L.kind === 'bulb') { const sw = Math.sin(t * 0.9) * 2; line(c, L.x, 48, L.x + sw, L.y - 2, C.k1); disc(c, L.x + sw, L.y, 1.5, C.s4); glow(c, L.x + sw, L.y, 30, L.col, i * 0.8); cone(c, L.x + sw, L.y + 1, 4, 50, 44, L.col, i * 0.6); }
    else if (L.kind === 'exitsign') { glow(c, L.x, L.y, 14, L.col, i); rect(c, L.x - 5, L.y - 2, 10, 4, L.col); }
    else if (L.kind === 'red') { const b = 0.5 + 0.5 * Math.sin(t * 2 + L.x); glow(c, L.x, L.y, 10, C.rd, 0.5 * b); rect(c, L.x, L.y, 1, 1, C.rd); }
  }
}

function areaSubway() {
  const ground = 190;
  const A = {
    id: 'subway', world: 'normal', w: 900, ground, rain: false, interior: true, title: 'Line 4, Marrow Street', sub: 'last train was an hour ago',
    ambient: 0.18, fogA: 0.3, fogNear: 0.15, fogKind: 'fog',
    platforms: [{ x: 420, y: 122, w: 200 }],
    ladders: [{ x1: 430, y1: ground, x2: 430, y2: 122 }],
    puddles: [{ x: 250, w: 30 }, { x: 700, w: 40 }], vents: [{ x: 386, y: 188, rate: 6 }, { x: 772, y: 188, rate: 8 }],
    lights: [
      { x: 100, y: 44, r: 90, i: 0.65, col: '#d8ecea', kind: 'tube' }, { x: 250, y: 44, r: 90, i: 0.6, col: '#d8ecea', kind: 'tube' }, { x: 400, y: 44, r: 90, i: 0.6, col: '#d8ecea', kind: 'tube', flicker: 13 },
      { x: 560, y: 44, r: 90, i: 0.35, col: '#d8ecea', kind: 'tube', flicker: 37 }, { x: 740, y: 44, r: 90, i: 0.55, col: '#d8ecea', kind: 'tube' },
      { x: 40, y: 120, r: 20, i: 0.7, col: C.gr4, kind: 'exitsign' }, { x: 860, y: 120, r: 6, i: 0.6, col: C.rd, kind: 'red' }, { x: 880, y: 140, r: 6, i: 0.6, col: C.rd, kind: 'red' },
    ],
    exits: [{ x: 0, w: 26, to: 'alley', spawn: 864, label: 'Up to the street' }],
    clues: [
      { id: 'phone', x: 340, y: ground, title: 'Payphone, off the hook', note: 'Receiver swinging. Last outgoing call: the Homicide desk, 2:58 a.m. The call I took. He called me from here.' },
      { id: 'shadow', x: 590, y: ground, title: 'My shadow', note: 'Under the dead tube my shadow stopped following me. It kept reaching for something on the wall. I did not move.' },
    ],
    npcs: [],
    ghost: [[30, 190], [340, 190], [430, 190], [430, 122], [600, 122], [600, 190], [860, 190]],
    shadowZone: [548, 640],
    layers: [
      { par: 1, main: true, draw: (c, o) => subwayBack(c, A, o) },
      { par: 1, z: 'front', draw: (c, o) => subwayFront(c, A, o) },
    ],
    dynamicBack: (c, t, g) => { interiorDynamic(c, t, A); },
  };
  return A;
}
function subwayBack(c, A, o) {
  const g = A.ground, r = mulberry32(51);
  rect(c, 0, 0, o.w, NH, C.k0);
  // ceiling & pipes
  rect(c, 0, 0, o.w, 40, C.k1); for (let x = 0; x < o.w; x += 30) rect(c, x, 34, 3, 6, C.b2); rect(c, 0, 26, o.w, 3, C.b3); rect(c, 0, 26, o.w, 1, C.b5); rect(c, 0, 32, o.w, 2, C.g3);
  // tile wall
  vgrad(c, 0, 40, o.w, 120, [[0, '#7d8a8a'], [0.6, '#5d6a6c'], [1, '#3e4a4e']]);
  for (let y = 40; y < 160; y += 5) rect(c, 0, y, o.w, 1, rgba(C.k0, 0.25)); for (let y = 40; y < 160; y += 5) for (let x = (y / 5 % 2) * 4; x < o.w; x += 8) rect(c, x, y, 1, 5, rgba(C.k0, 0.2));
  rect(c, 0, 100, o.w, 6, C.gr2); rect(c, 0, 100, o.w, 1, C.gr4); // tile band
  for (let i = 0; i < 70; i++) { const x = r() * o.w, y = 40 + r() * 30, h = 10 + r() * 60; vgrad(c, x, y, 2 + r() * 8, h, [[0, rgba(C.r3, 0.25)], [1, rgba(C.r3, 0)]]); }
  for (let i = 0; i < 30; i++) { const x = r() * o.w, y = 50 + r() * 100; rect(c, x, y, 3 + r() * 10, 2 + r() * 5, rgba(C.k1, 0.6)); } // missing tiles
  // posters (blank, peeling)
  [160, 520, 690].forEach(x => { rect(c, x, 64, 30, 22, C.a1); rect(c, x + 2, 66, 26, 12, C.b5); rect(c, x + 26, 80, 4, 6, C.a2); });
  // the shadow-zone wall is a little cleaner (so the shadow reads)
  rect(c, 548, 108, 92, 52, rgba('#8e9b9a', 0.35));
  // track bed
  rect(c, 0, 160, o.w, 30, C.k1); rect(c, 0, 160, o.w, 2, C.b3);
  for (let x = 0; x < o.w; x += 9) rect(c, x, 178, 6, 3, C.g2);
  rect(c, 0, 172, o.w, 2, C.b6); rect(c, 0, 184, o.w, 2, C.b6); rect(c, 0, 172, o.w, 1, C.b8);
  // tunnel mouth at right
  rect(c, 800, 30, 100, 160, C.k0); for (let k = 0; k < 4; k++) { c.save(); c.strokeStyle = rgba(C.b4, 0.7 - k * 0.15); c.lineWidth = 2; c.beginPath(); c.arc(850 + k * 6, 110, 60 - k * 12, Math.PI, 0); c.stroke(); c.restore(); }
  // entrance stairs at left
  rect(c, 0, 40, 60, 150, C.b1); for (let i = 0; i < 14; i++) { rect(c, 2 + i * 4, 70 + i * 8, 58 - i * 4, 2, rgba(C.b6, 0.6)); } vgrad(c, 0, 40, 60, 60, [[0, rgba(C.s2, 0.35)], [1, rgba(C.s2, 0)]]);
}
function subwayFront(c, A, o) {
  const g = A.ground, r = mulberry32(53);
  // pillars
  [130, 310, 490, 670].forEach(x => { rect(c, x, 28, 12, g - 28, C.b4); rect(c, x, 28, 2, g - 28, C.b6); rect(c, x + 10, 28, 2, g - 28, C.k1); for (let y = 40; y < g; y += 20) rect(c, x, y, 12, 1, rgba(C.k0, 0.5)); rect(c, x - 2, 28, 16, 4, C.b5); vgrad(c, x, g - 40, 12, 40, [[0, rgba(C.r3, 0)], [1, rgba(C.r3, 0.3)]]); });
  // bench
  rect(c, 190, 176, 40, 3, C.g5); rect(c, 190, 179, 40, 1, C.k0); rect(c, 194, 180, 2, 10, C.k1); rect(c, 224, 180, 2, 10, C.k1); rect(c, 190, 168, 40, 2, C.g4); rect(c, 192, 170, 2, 6, C.k1); rect(c, 226, 170, 2, 6, C.k1);
  // payphone on pillar 310
  rect(c, 330, 148, 16, 26, C.b5); rect(c, 332, 150, 12, 10, C.b3); for (let k = 0; k < 9; k++) rect(c, 333 + (k % 3) * 4, 162 + ((k / 3) | 0) * 3, 2, 2, C.b7); rect(c, 328, 146, 20, 2, C.b6);
  // trash can
  rect(c, 270, 176, 10, 14, C.b4); rect(c, 269, 175, 12, 2, C.b6); for (let k = 271; k < 280; k += 3) rect(c, k, 178, 1, 11, rgba(C.k0, 0.5));
  // catwalk + ladder
  landingArt(c, 420, 122, 200, C.b6); ladderArt(c, 430, 122, g, C.b7);
  // platform floor
  rect(c, 0, g, o.w, NH - g, C.b3); rect(c, 0, g, o.w, 2, C.gd2); for (let x = 0; x < o.w; x += 4) rect(c, x, g, 2, 2, C.gd);
  for (let x = 0; x < o.w; x += 24) rect(c, x, g + 3, 1, NH - g, rgba(C.k0, 0.3)); for (let i = 0; i < o.w; i++) if (r() < 0.3) rect(c, r() * o.w, g + 4 + r() * 20, 1, 1, rgba(C.k0, 0.4));
  vgrad(c, 0, g + 6, o.w, NH - g, [[0, rgba(C.k0, 0)], [1, C.k0]]);
  A.puddles.forEach(p => puddleBase(c, p, g));
}

const AREAS = {
  alley: () => areaAlley('normal'), other: () => areaAlley('other'), precinct: areaPrecinct, subway: areaSubway,
};
