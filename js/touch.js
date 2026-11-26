// Touch controls for phones in landscape: a floating joystick on the left half, action buttons on the right.
// They send the same keyboard events the game already listens to, so every screen (title, dialog, notebook) works.
(() => {
  if (!('ontouchstart' in window || navigator.maxTouchPoints > 0)) return;
  const send = (type, code) => dispatchEvent(new KeyboardEvent(type, { code, bubbles: true }));
  const st = document.createElement('style');
  st.textContent = `html,body{touch-action:none;-webkit-user-select:none;user-select:none;-webkit-touch-callout:none}
#tc{position:fixed;inset:0;z-index:50;pointer-events:none;font:600 13px/1 ui-monospace,Menlo,monospace;color:#b7c3d6}
#tc .pad{position:absolute;left:0;top:0;width:50%;height:100%;pointer-events:auto}
#tc .base{position:absolute;width:112px;height:112px;margin:-56px;border-radius:50%;border:2px solid rgba(183,195,214,.28);background:rgba(10,14,24,.25);display:none}
#tc .knob{position:absolute;left:50%;top:50%;width:46px;height:46px;margin:-23px;border-radius:50%;background:rgba(183,195,214,.35)}
#tc .btns{position:absolute;right:calc(18px + env(safe-area-inset-right));bottom:18px;width:190px;height:170px}
#tc .b{position:absolute;display:flex;align-items:center;justify-content:center;border-radius:50%;pointer-events:auto;
 background:rgba(10,14,24,.45);border:2px solid rgba(183,195,214,.3);letter-spacing:.05em}
#tc .b.on{background:rgba(57,230,255,.3);border-color:rgba(57,230,255,.7)}
#tc .top{position:absolute;top:10px;right:calc(14px + env(safe-area-inset-right));display:flex;gap:10px}
#tc .top .b{position:relative;width:48px;height:48px;font-size:11px}
#tc .hint{position:absolute;left:14px;bottom:10px;opacity:.35;font-size:10px}
#tc .rot{position:fixed;inset:0;display:none;align-items:center;justify-content:center;background:#030407;pointer-events:auto;font-size:15px;text-align:center;padding:20px}
@media (orientation:portrait){#tc .rot{display:flex}}`;
  document.head.appendChild(st);
  const root = document.createElement('div'); root.id = 'tc';
  root.innerHTML = `<div class="pad"><div class="base"><div class="knob"></div></div></div>
<div class="btns">
 <div class="b" data-k="KeyE" style="right:0;bottom:0;width:78px;height:78px;font-size:16px">E</div>
 <div class="b" data-k="KeyQ" data-hold style="right:92px;bottom:0;width:56px;height:56px">EYE</div>
 <div class="b" data-k="ShiftLeft" data-toggle style="right:12px;bottom:92px;width:56px;height:56px">SNEAK</div>
 <div class="b" data-k="KeyN" style="right:92px;bottom:72px;width:48px;height:48px">NOTE</div>
</div><div class="top"><div class="b" data-k="KeyO" id="tcCam" style="display:none">CAM</div><div class="b" id="tcFull">FULL</div></div><div class="rot">Turn your phone sideways to play</div>`;
  document.body.appendChild(root);

  // first touch: go fullscreen and lock landscape where the browser allows it
  let fs = false;
  const goFull = () => { if (fs) return; fs = true; const d = document.documentElement;
    const p = d.requestFullscreen ? d.requestFullscreen({ navigationUI: 'hide' }) : d.webkitRequestFullscreen && d.webkitRequestFullscreen();
    Promise.resolve(p).then(() => screen.orientation && screen.orientation.lock && screen.orientation.lock('landscape')).catch(() => {}); };

  // joystick: appears where the thumb lands, 8 directions mapped to the arrow keys
  const pad = root.querySelector('.pad'), base = root.querySelector('.base'), knob = root.querySelector('.knob');
  const dirs = { ArrowLeft: false, ArrowRight: false, ArrowUp: false, ArrowDown: false };
  const setDir = (k, on) => { if (dirs[k] !== on) { dirs[k] = on; send(on ? 'keydown' : 'keyup', k); } };
  let jid = null, ox = 0, oy = 0;
  const move = (x, y) => { let dx = x - ox, dy = y - oy; const d = Math.hypot(dx, dy), R = 44;
    if (d > R) { dx *= R / d; dy *= R / d; } knob.style.transform = `translate(${dx}px,${dy}px)`;
    const on = d > 12, a = Math.atan2(dy, dx), s = Math.PI / 8; // 8 sectors
    setDir('ArrowRight', on && Math.abs(a) < 3 * s); setDir('ArrowLeft', on && Math.abs(a) > 5 * s);
    setDir('ArrowDown', on && a > s && a < 7 * s); setDir('ArrowUp', on && a < -s && a > -7 * s); };
  const end = () => { jid = null; base.style.display = 'none'; knob.style.transform = ''; for (const k in dirs) setDir(k, false); };
  pad.addEventListener('touchstart', e => { e.preventDefault(); goFull(); if (jid !== null) return; const t = e.changedTouches[0]; jid = t.identifier;
    ox = t.clientX; oy = t.clientY; base.style.left = ox + 'px'; base.style.top = oy + 'px'; base.style.display = 'block'; move(ox, oy); }, { passive: false });
  pad.addEventListener('touchmove', e => { e.preventDefault(); for (const t of e.changedTouches) if (t.identifier === jid) move(t.clientX, t.clientY); }, { passive: false });
  const padEnd = e => { for (const t of e.changedTouches) if (t.identifier === jid) end(); };
  pad.addEventListener('touchend', padEnd); pad.addEventListener('touchcancel', padEnd);

  // buttons: tap = key press; data-hold = held while touched; data-toggle = latch on/off
  // FULL toggles fullscreen; CAM (orbit camera) only exists on the three.js page
  const isFull = () => document.fullscreenElement || document.webkitFullscreenElement;
  const full = root.querySelector('#tcFull');
  full.addEventListener('touchstart', e => { e.preventDefault(); e.stopPropagation(); fs = true;
    if (isFull()) (document.exitFullscreen || document.webkitExitFullscreen).call(document); else { fs = false; goFull(); } }, { passive: false });
  const sync = () => full.classList.toggle('on', !!isFull()); document.addEventListener('fullscreenchange', sync); document.addEventListener('webkitfullscreenchange', sync);
  addEventListener('load', () => { if (window.ISO3D) root.querySelector('#tcCam').style.display = ''; });
  for (const b of root.querySelectorAll('.b[data-k]')) { const k0 = b.dataset.k; let k = k0; const hold = 'hold' in b.dataset, tog = 'toggle' in b.dataset; let on = false;
    b.addEventListener('touchstart', e => { e.preventDefault(); goFull();
      k = k0 === 'KeyE' && typeof UI !== 'undefined' && (UI.open === 'title' || UI.open === 'end') ? 'Enter' : k0; // title/end screens take Enter
      if (tog) { on = !on; b.classList.toggle('on', on); send(on ? 'keydown' : 'keyup', k); return; }
      b.classList.add('on'); send('keydown', k); if (k0 === 'KeyO') { setTimeout(() => b.classList.toggle('on', !!(window.ORB && ORB.on)), 0); } if (!hold) setTimeout(() => send('keyup', k), 60); }, { passive: false });
    const up = e => { e.preventDefault(); if (tog) return; if (k0 !== 'KeyO') b.classList.remove('on'); if (hold) send('keyup', k); };
    b.addEventListener('touchend', up); b.addEventListener('touchcancel', up); }
})();
