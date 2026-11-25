# Saints of Ash - shared API (classic <script> globals, no modules; must run from file://)

Load order in index.html: core.js, render.js, puppet.js, areas.js, ui.js, game.js.

## core.js (done)
NW=384, NH=216 native units. G.mode 'pixel'|'painted', G.S = 1|4 render scale, G.t seconds.
C = palette hex map (C.b3, C.pk, C.cy, ...). snapCanvas(cv,dither), otherRemap, makeCanvas(w,h), rgba(hex,a),
mulberry32, hash2, vnoise, fbm, bayer, clamp, lerp. Sound.sfx(name) names: clue deduce wrong door page pin warp land rung.
In.left/right/up/down/sneak/eye(), In.hit('KeyE'). keys{}, pressed{}.

## puppet.js  (owner: agent A)
Characters drawn with canvas paths at sprite-res, then (pixel mode) alpha-threshold + snapCanvas(cv,0) + 1px dark sel-out outline.
- `CHARS` : { detective, vale, officer, tom, ghost } colour sets. detective = long rain-dark trench coat, no hat, messy dark hair.
  vale = elegant charcoal three-piece suit, white shirt, deep red tie + pocket square, slicked hair, upright posture.
  officer = navy uniform, cap. tom = old man in layered rags, beanie (sits). ghost = all cyan (#39e6ff) flat.
- `getSprite(charId, state, frame)` -> { cv, ox, oy } ; cv is sprite canvas at G.S resolution; (ox,oy) = feet anchor in NATIVE units.
  Sprite box 40x44 native, feet at (20,42). Character ~30 native px tall. Cached per (G.mode,char,state,frame); `clearSpriteCache()`.
- states & frame counts (`ANIM[state] = {n, fps}`): idle 8 (breathing, coat sway, cigarette to mouth on frames 4-6),
  walk 8, sneak 8 (crouched walk), crouch 1, jump 1, fall 2, climb 4 (on vertical ladder, back-ish view, arms alternate),
  inspect 1 (kneel, arm reaching to ground), sit 4 (sitting on ground/crate, breathing), talk 4 (idle with subtle gesture).
  Stepped animation only (8-12 fps). Facing right; game flips for left.
- `emberPos(state, frame)` -> {x,y} native offset from feet of the cigarette ember for detective (or null).
- `drawChar(ctx, charId, x, y, face, state, frame, opt)` ctx is in NATIVE world units (already scaled by G.S).
  opt: { light:0..1, lightCol:'#hex', alpha, silhouette:'#hex' (flat fill e.g. shadow), ghost:true (additive, cyan, flicker) }.
  Applies darkness tint (1-light) via temp canvas source-atop; in pixel mode quantise light to 4 steps. Round x in pixel mode.

## ui.js  (owner: agent B)  - drawn on the HIGH-RES overlay canvas `ui` (CSS-matched, devicePixelRatio). Same in both modes.
Fonts: '"Courier New", monospace' (typewriter) and 'Georgia, serif' italic (handwriting). Diegetic look: battered notebook paper,
cork board w/ red string, Polaroids. No external assets.
Global `UI` object:
- `UI.resize(w,h,dpr)`; `UI.draw(uctx, w, h, game)` called every frame after world render (uctx untransformed, w,h CSS px).
- `UI.open` : null | 'board' | 'notebook' | 'dialog' | 'title' | 'end'. When non-null the game pauses movement.
- `UI.say(lines, onDone)` lines = [{who:'VALE', text:'...'}, ...]; typewriter reveal; E/Space/Enter advances; Esc skips.
- `UI.toast(text)` small handwritten note fading top-left (objectives, "Clue added").
- `UI.prompt(sx, sy, text)` per-frame world prompt at CSS coords (game computes). Small typewriter tag "E  Inspect".
- `UI.openBoard()` cork board: Polaroids for every found clue in game.clues (array of {id,title,note,snap:canvas}), click (mouse on ui canvas) or arrows+Enter
  to pick two; calls `game.tryLink(a,b)` -> returns deduction object {id,text} or null. Draw red string (sagging curve, pins) for
  game.deductions (array {id,a,b,text}). Shows deduction text cards on the side. Esc/E closes.
- `UI.openNotebook()` notebook page: objective (game.objective), clues list w/ notes, deductions. N/Esc closes.
- `UI.title(onStart)` title card "SAINTS OF ASH", subtitle "Case 01 - The Lily Saint", controls list, "press Enter".
- `UI.ending(lines, onRestart)` end card.
- `UI.handleKey(code)` returns true if consumed; `UI.handleClick(x,y)` CSS coords.
- Also draws: sanity ink bar (game.sanity 0..100, fades in when changing, bottom-left), mode badge ("V: pixel/painted"), fade (game.fade 0..1 black).
Controls: A/D move, W/S climb/stairs, Space jump, Shift sneak, E interact, Q killer's eye (hold), N notebook, V visual mode, M mute.

## game object fields used by UI
game.clues[], game.deductions[], game.objective, game.sanity, game.fade, game.tryLink(a,b), G.mode.
