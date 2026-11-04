/*
 * stage6.js - Feature 6: animals from sea to land, an in-page illustration (not a
 * screenshot of the app) with the real-history story beside it.
 *
 * A scripted lineage (assets/animals.js) swims out of the open sea through the
 * shallows and the tidal flats onto land. The leading animal and three of its
 * ancestors are drawn as actual simple creatures: organs fade in as the lineage's
 * progress `p` advances, fins stiffen into limbs, the shore scene changes under
 * them, and the chapter buttons and text beside the picture step along as each
 * milestone is reached. Motion off draws one still frame; the chapter buttons
 * still work then (they move p and redraw). Sound cues go through A.sound, so the
 * Sound control and the Quiet button decide whether they play.
 */
(function () {
  'use strict';
  const A = window.Abio, N = A.animals;
  const TAU = Math.PI * 2;
  const lerp = (a, b, t) => a + (b - a) * t;
  const hsl = (h, s, l, a) => 'hsla(' + h + ',' + s + '%,' + A.L(l) + '%,' + (a == null ? 1 : a) + ')';
  const FONT = '"Avenir Next", ui-rounded, system-ui, -apple-system, "Segoe UI", sans-serif';
  const DURATION = 64; // seconds for one lineage, sea to land
  const HOLD_AFTER_PICK = 9;
  const HOLD_AT_END = 5;

  /* ground height (fraction of the canvas) at x (fraction of the width) */
  const SURFACE = 0.4, LAND = 0.36;
  function ground(x) {
    const k = N.X_KNOTS;
    if (x <= 0.34) return 0.92 - 0.05 * (x / 0.34);
    if (x <= 0.55) return lerp(0.87, 0.52, (x - 0.34) / 0.21);
    if (x <= 0.74) return lerp(0.52, LAND, (x - 0.55) / 0.19);
    return LAND;
  }
  const ZONE_X = [0, 0.34, 0.55, 0.74, 1];

  function init(els) {
    const cv = els.cv;
    let g = A.fitCanvas(cv), p = 0, hold = 3, clock = 0, shown = -1, touched = false;
    const buttons = [];

    /* ---- chapter list and text (real buttons) ---- */
    N.CHAPTERS.forEach((c, i) => {
      const li = document.createElement('li'), b = document.createElement('button');
      b.type = 'button'; b.textContent = (i + 1) + '. ' + c.title;
      b.addEventListener('click', () => { touched = true; p = c.at + (i ? 0.004 : 0); hold = HOLD_AFTER_PICK; show(true); if (A.frozen()) A.loop.redraw(); if (A.sound) A.sound.play('pick', i); });
      li.appendChild(b); els.list.appendChild(li); buttons.push(b);
    });
    function part(name, text) {
      const d = document.createElement('div'); d.className = 's6-part';
      const h = document.createElement('b'); h.textContent = name; const t = document.createElement('p'); t.textContent = text;
      d.appendChild(h); d.appendChild(t); return d;
    }
    function show(force) {
      const k = N.chapterAt(p);
      if (k === shown && !force) return;
      const first = shown < 0;
      shown = k;
      const c = N.CHAPTERS[k];
      buttons.forEach((b, i) => { b.classList.toggle('on', i === k); b.classList.toggle('past', i < k); if (i === k) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current'); });
      els.story.textContent = '';
      const h = document.createElement('h4'); h.textContent = 'Chapter ' + (k + 1) + ' of ' + N.CHAPTERS.length + ': ' + c.title; els.story.appendChild(h);
      els.story.appendChild(part('Setting', c.setting)); els.story.appendChild(part('Problem', c.problem));
      els.story.appendChild(part('Adaptation', c.adaptation)); els.story.appendChild(part('Result', c.result));
      const m = document.createElement('div'); m.className = 's6-part sim';
      const mb = document.createElement('b'); mb.textContent = 'In the simulation'; const mp = document.createElement('p'); mp.textContent = c.model;
      m.appendChild(mb); m.appendChild(mp); els.story.appendChild(m);
      if (!first && !force && A.sound && !A.frozen()) A.sound.play('stage', k);
    }

    /* ---- drawing ---- */
    function body(ctx, o) { // a bilateral animal, local length 1, head at +x
      const { L, t, post, len } = o;
      const sw = (s) => 0.012 * (1 - s) * Math.sin(t * (post === 'swim' ? 4 : 1.2) + (1 - s) * 3.2) + (post === 'swim' ? 0.05 * L.muscle * (1 - s) * Math.sin(t * 4 + (1 - s) * 3.2) : 0);
      const half = (s) => (0.115 + 0.045 * L.muscle) * Math.pow(s, 0.55) * Math.pow(1 - s, 0.75) / 0.41;
      const P = (s, v) => [s - 0.5, half(s) * v + sw(s)];
      const path = (pts) => { ctx.beginPath(); pts.forEach((q, i) => (i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]))); };
      const skin = L.skin, px = 1 / len;
      const bh = lerp(190, 42, skin * 0.8);
      const vis = N.visible;
      // tail and back fins
      const fv = vis(L.fins);
      if (fv > 0) {
        const f = 0.35 + 0.65 * L.fins, b0 = P(0.02, 0);
        ctx.fillStyle = hsl(176, 40, 44, 0.65 * fv); ctx.strokeStyle = hsl(176, 45, 60, fv); ctx.lineWidth = px;
        path([b0, [b0[0] - 0.12 * f, b0[1] - 0.1 * f], [b0[0] - 0.07 * f, b0[1]], [b0[0] - 0.12 * f, b0[1] + 0.1 * f]]); ctx.closePath(); ctx.fill(); ctx.stroke();
        path([P(0.62, -1), P(0.42, -1 - 0.9 * f), P(0.3, -1)]); ctx.closePath(); ctx.fill(); ctx.stroke();
      }
      // body
      const n = 20, back = [], belly = [];
      for (let k = 0; k <= n; k++) { back.push(P(k / n, -1)); belly.push(P(k / n, 1)); }
      path(back.concat(belly.reverse())); ctx.closePath();
      ctx.fillStyle = hsl(bh, 45, 46, 0.92); ctx.fill();
      ctx.strokeStyle = hsl(bh, 50, 24, 0.95); ctx.lineWidth = (1 + 2.2 * skin) * px; ctx.stroke();
      if (skin > 0.3) { ctx.lineWidth = px; ctx.strokeStyle = hsl(bh, 50, 24, skin); for (let k = 2; k < n - 1; k += 2) { const q = back[k]; ctx.beginPath(); ctx.moveTo(q[0], q[1]); ctx.lineTo(q[0], q[1] + 0.03); ctx.stroke(); } }
      // muscle blocks
      const mv = vis(L.muscle);
      if (mv > 0) { ctx.strokeStyle = hsl(358, 62, 54, 0.55 * mv); ctx.lineWidth = 1.6 * px; const cnt = Math.round(3 + 6 * L.muscle); for (let k = 0; k < cnt; k++) { const s = 0.2 + 0.55 * k / cnt; path([P(s + 0.03, 0), P(s, -0.6), P(s, 0.6)]); ctx.stroke(); } }
      // backbone: a rod, then vertebrae and a skull
      const sv = vis(L.skeleton);
      if (sv > 0) {
        const bone = L.skeleton >= 0.6;
        ctx.strokeStyle = hsl(50, 30, 90, sv * (bone ? 1 : 0.75)); ctx.lineWidth = (bone ? 2.6 : 1.8) * px;
        const line = []; for (let k = 0; k <= 10; k++) line.push(P(0.88 - 0.8 * k / 10, -0.28)); path(line); ctx.stroke();
        if (bone) { ctx.lineWidth = 1.5 * px; line.slice(1).forEach((q) => { ctx.beginPath(); ctx.moveTo(q[0], q[1] - 0.022); ctx.lineTo(q[0], q[1] + 0.022); ctx.stroke(); }); ctx.fillStyle = hsl(50, 30, 90, 0.9 * sv); ctx.beginPath(); ctx.arc(0.4, -0.2, 0.05, 0, TAU); ctx.fill(); }
      }
      // lung
      const lv = vis(L.lungs);
      if (lv > 0) { const c = P(0.55, -0.15); ctx.fillStyle = hsl(345, 80, 74, 0.85 * lv); ctx.beginPath(); ctx.ellipse(c[0], c[1], 0.05 + 0.07 * L.lungs, 0.02 + 0.045 * L.lungs, 0, 0, TAU); ctx.fill(); }
      // gut
      const gv = vis(L.gut);
      if (gv > 0) { const reach = 0.35 + 0.55 * L.gut, line = []; for (let k = 0; k <= 8; k++) { const q = P(0.95 - reach * k / 8, 0.25); line.push([q[0], q[1] + 0.012 * Math.sin(k * 1.7)]); } ctx.strokeStyle = hsl(38, 85, 58, gv); ctx.lineWidth = 3 * px; path(line); ctx.stroke(); ctx.fillStyle = 'rgba(0,0,0,.8)'; ctx.beginPath(); ctx.arc(line[0][0], line[0][1], 0.012, 0, TAU); ctx.fill(); }
      // gills
      const wv = vis(L.gills);
      if (wv > 0) { ctx.strokeStyle = hsl(356, 85, 66, wv); ctx.lineWidth = 1.8 * px; const cnt = 2 + Math.round(3 * L.gills); for (let k = 0; k < cnt; k++) { const s = 0.72 - 0.035 * k; path([P(s, -0.2), P(s - 0.01, 0.35)]); ctx.stroke(); } }
      // nerve cord and brain
      const nv = vis(L.nerve);
      if (nv > 0) { const reach = 0.25 + 0.65 * L.nerve, line = []; for (let k = 0; k <= 8; k++) line.push(P(0.9 - reach * k / 8, -0.55)); ctx.strokeStyle = hsl(52, 95, 62, nv); ctx.lineWidth = 1.5 * px; path(line); ctx.stroke(); if (L.nerve >= 0.35) { const c = P(0.86, -0.35); ctx.fillStyle = hsl(52, 95, 62, nv); ctx.beginPath(); ctx.arc(c[0], c[1], 0.018 + 0.04 * L.nerve, 0, TAU); ctx.fill(); } }
      // eye
      const ev = vis(L.eyes);
      if (ev > 0) { const c = P(0.84, -0.3), r = Math.max(0.014 + 0.035 * L.eyes, 1.5 * px); if (L.eyes >= 0.3) { ctx.fillStyle = 'rgba(255,255,255,' + ev + ')'; ctx.beginPath(); ctx.arc(c[0], c[1], r, 0, TAU); ctx.fill(); ctx.fillStyle = 'rgba(0,0,0,' + ev + ')'; ctx.beginPath(); ctx.arc(c[0] + r * 0.25, c[1], r * 0.55, 0, TAU); ctx.fill(); } else { ctx.fillStyle = hsl(56, 80, 80, 0.8 * ev); ctx.beginPath(); ctx.arc(c[0], c[1], r, 0, TAU); ctx.fill(); } }
      // jaws or a plain mouth
      const hinge = P(0.82, 0.12), mouth = P(1, 0.1);
      if (L.jaws >= 0.2) {
        const bite = 0.5 + 0.5 * Math.sin(t * 2.2 + o.ph), open = bite * (0.04 + 0.08 * L.jaws), reach = 0.04 + 0.05 * L.jaws, tip = [mouth[0] + reach, mouth[1]];
        ctx.fillStyle = hsl(60, 25, 86, 0.95); ctx.strokeStyle = hsl(bh, 50, 24, 0.9); ctx.lineWidth = px;
        path([hinge, [mouth[0], mouth[1] - 0.01], [tip[0], tip[1] - open * 0.6]]); ctx.closePath(); ctx.fill(); ctx.stroke();
        path([hinge, [mouth[0], mouth[1] + 0.01], [tip[0], tip[1] + open]]); ctx.closePath(); ctx.fill(); ctx.stroke();
      } else { ctx.strokeStyle = hsl(bh, 50, 24, 0.8); ctx.lineWidth = 1.2 * px; path([hinge, mouth]); ctx.stroke(); }
      // paired fins that become limbs
      const fl = Math.max(L.fins, L.limbs);
      if (fl > 0.04) {
        const blend = N.up(L.limbs, 0.08, 0.7), strength = Math.min(1, fl), length = (0.1 + 0.17 * strength) * (1 + 0.55 * blend), web = 1 - blend;
        const walking = post !== 'swim', sw2 = Math.sin(t * (walking ? 1.8 : 4) + o.ph);
        const a = P(0.68, 0.95);
        let tip, elbow;
        if (walking) { const up2 = length * 0.5; elbow = [a[0] - 0.15 * up2 + sw2 * 0.5 * up2, a[1] + 0.85 * up2]; tip = [elbow[0] + sw2 * 0.3 * up2 + 0.2 * up2, elbow[1] + up2 * 0.95]; if (blend < 0.25) elbow = [(a[0] + tip[0]) / 2, (a[1] + tip[1]) / 2]; }
        else { tip = [a[0] - length * (0.8 + 0.15 * sw2), a[1] + length * (0.55 - 0.2 * sw2)]; elbow = [(a[0] + tip[0]) / 2, (a[1] + tip[1]) / 2 + (blend < 0.25 ? 0 : 0.25 * length)]; }
        const lv2 = vis(fl);
        ctx.strokeStyle = hsl(186, 38, 44, lv2); ctx.fillStyle = hsl(186, 38, 44, 0.5 * web * lv2); ctx.lineCap = 'round';
        if (web > 0.05) { path([a, tip, [a[0] - length * 0.9, a[1] + length * 0.15]]); ctx.closePath(); ctx.fill(); }
        ctx.lineWidth = (2 + 4 * blend) * px * 0.6; path([a, elbow, tip]); ctx.stroke();
        if (blend > 0.85) { ctx.lineWidth = 1.3 * px; for (let k = -1; k <= 1; k++) { ctx.beginPath(); ctx.moveTo(tip[0], tip[1]); ctx.lineTo(tip[0] + Math.cos(Math.PI / 2 + k * 0.5) * 0.025, tip[1] + Math.sin(Math.PI / 2 + k * 0.5) * 0.025); ctx.stroke(); } }
        ctx.lineCap = 'butt';
      }
      return half(0.4);
    }

    function radial(ctx, o) { // a round, radially symmetric animal, local radius about 0.3
      const { L, t, len } = o, px = 1 / len, r = 0.27 * (1 + 0.05 * Math.sin(t * 1.6 + o.ph));
      ctx.strokeStyle = hsl(268, 38, 62, 0.85); ctx.fillStyle = hsl(268, 38, 62, 0.85); ctx.lineWidth = 2.2 * px;
      for (let k = 0; k < 6; k++) {
        const a = k / 6 * TAU; ctx.beginPath();
        for (let i = 0; i <= 6; i++) { const f = i / 6, an = a + 0.14 * f * Math.sin(t * 2 + k + f * 4); const q = r + 0.17 * f; ctx.lineTo(Math.cos(an) * q, Math.sin(an) * q); }
        ctx.stroke();
      }
      ctx.fillStyle = hsl(268, 38, 62, 0.92); ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();
      ctx.strokeStyle = hsl(268, 40, 28, 0.9); ctx.lineWidth = (1 + 2 * L.skin) * px; ctx.stroke();
      const pouch = r * (0.35 + 0.8 * Math.min(0.3, L.gut));
      ctx.fillStyle = hsl(38, 85, 58, 0.85); ctx.beginPath(); ctx.arc(0, 0, pouch, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,.75)'; ctx.beginPath(); ctx.arc(0, 0, pouch * 0.35, 0, TAU); ctx.fill();
      const nv = N.visible(L.nerve); if (nv > 0) { ctx.strokeStyle = hsl(52, 95, 62, nv); ctx.lineWidth = px; ctx.beginPath(); ctx.arc(0, 0, r * 0.78, 0, TAU); ctx.stroke(); }
    }

    function creature(ctx, w, h, pp, size, alpha, label) {
      const L = N.levels(pp), post = N.posture(pp), xf = N.xAt(pp), len = size;
      const x = xf * w, gy = ground(xf) * h, surf = SURFACE * h;
      const ph = pp * 40, t = clock, swim = post === 'swim';
      const bil = L.bilateral;
      let y, face = 1;
      const wander = Math.sin(t * 0.4 + ph) * w * 0.012;
      if (swim) y = lerp(surf + 0.12 * h, Math.max(surf + 0.14 * h, gy - 0.08 * h), 0.35 + 0.35 * Math.sin(t * 0.5 + ph) * 0.5 + 0.15) + Math.sin(t * 1.3 + ph) * 3;
      else if (post === 'stand') y = gy - (0.2 + 0.055 * (L.skeleton)) * len - len * 0.13;
      else y = gy - len * 0.13;
      ctx.save(); ctx.translate(x + wander, y); ctx.scale(len * face, len);
      const o = { L, t, post, len, ph };
      if (bil < 0.5) { ctx.globalAlpha = alpha * (1 - bil * 2); radial(ctx, o); }
      if (bil > 0.05) { ctx.globalAlpha = alpha * Math.min(1, (bil - 0.05) / 0.5); body(ctx, o); }
      ctx.restore();
      if (label) { ctx.globalAlpha = alpha; ctx.fillStyle = A.ink(0.8); ctx.font = '600 11px ' + FONT; ctx.textAlign = 'center'; ctx.fillText(label, x + wander, Math.min(h - 8, y + len * 0.5 + 14)); ctx.globalAlpha = 1; }
      return { x, y };
    }

    function scene(ctx, w, h) {
      const light = A.theme === 'light', surf = SURFACE * h;
      const sky = ctx.createLinearGradient(0, 0, 0, surf);
      sky.addColorStop(0, light ? '#bfe3f2' : '#162a4c'); sky.addColorStop(1, light ? '#e4f6f2' : '#4a6f94');
      ctx.fillStyle = sky; ctx.fillRect(0, 0, w, surf + 1);
      ctx.fillStyle = light ? 'rgba(255,214,120,.9)' : 'rgba(255,232,160,.85)'; ctx.beginPath(); ctx.arc(w * 0.9, h * 0.12, h * 0.05, 0, TAU); ctx.fill();
      const wat = ctx.createLinearGradient(0, surf, 0, h);
      wat.addColorStop(0, light ? '#74c3d0' : '#2c7896'); wat.addColorStop(1, light ? '#2c7f9b' : '#0a2442');
      ctx.fillStyle = wat; ctx.fillRect(0, surf, w, h - surf);
      // tide: the surface rises and falls a little, the flats flood and drain
      const tide = Math.sin(clock * 0.45) * 0.02 * h;
      ctx.strokeStyle = 'rgba(255,255,255,.45)'; ctx.lineWidth = 1.5; ctx.beginPath();
      for (let i = 0; i <= 60; i++) { const x = i / 60 * w, y = surf + tide + Math.sin(i * 0.65 + clock * 1.6) * 2; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
      ctx.stroke();
      // the ground
      for (let i = 0; i < 80; i++) {
        const x0 = i / 80, x1 = (i + 1) / 80, z = x0 < ZONE_X[1] ? 0 : x0 < ZONE_X[2] ? 1 : x0 < ZONE_X[3] ? 2 : 3;
        const col = [light ? '#c9b684' : '#a8966a', light ? '#c9b684' : '#a8966a', light ? '#9f8b66' : '#70603f', light ? '#8a7656' : '#5c4e38'][z];
        ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(x0 * w, ground(x0) * h); ctx.lineTo(x1 * w + 1, ground(x1) * h); ctx.lineTo(x1 * w + 1, h); ctx.lineTo(x0 * w, h); ctx.closePath(); ctx.fill();
        if (z === 3) { ctx.fillStyle = light ? '#5a8d46' : '#567846'; ctx.fillRect(x0 * w, ground(x0) * h - 2, w / 80 + 1, 3); }
      }
      // labels
      ctx.font = '600 11px ' + FONT; ctx.textAlign = 'center'; ctx.fillStyle = A.ink(0.7);
      N.ZONES.forEach((name, i) => { ctx.fillText(name, (ZONE_X[i] + ZONE_X[i + 1]) / 2 * w, h - 7); if (i) { ctx.fillStyle = A.ink(0.18); ctx.fillRect(ZONE_X[i] * w, 0, 1, h); ctx.fillStyle = A.ink(0.7); } });
    }

    const api = {
      el: cv,
      step(dt) {
        clock += dt;
        if (hold > 0) { hold -= dt; if (p >= 1 && hold <= 0) { p = 0; hold = 2; } }
        else p = Math.min(1, p + dt / DURATION);
        if (p >= 1 && hold <= 0) hold = HOLD_AT_END;
        show(false);
      },
      draw() {
        const ctx = g.ctx, w = g.w, h = g.h;
        ctx.clearRect(0, 0, w, h);
        scene(ctx, w, h);
        const size = Math.min(w * 0.19, 120);
        // the lineage: ancestors behind, the leading animal in front
        [0.46, 0.3, 0.14].forEach((lag, i) => { if (p - lag > 0.01) creature(ctx, w, h, p - lag, size * (0.72 + 0.06 * i), 0.8, null); });
        creature(ctx, w, h, p, size, 1, null);
        const k = N.chapterAt(p);
        ctx.globalAlpha = 1; ctx.fillStyle = A.ink(0.85); ctx.font = '600 12px ' + FONT; ctx.textAlign = 'left';
        ctx.fillText(N.ZONES[N.zoneAt(p)] + ' - ' + N.CHAPTERS[k].milestone, 12, 20);
        ctx.fillStyle = A.ink(0.3); ctx.fillRect(12, 28, w - 24, 3); ctx.fillStyle = hsl(46, 95, 64, 0.95); ctx.fillRect(12, 28, (w - 24) * p, 3);
        N.CHAPTERS.forEach((c) => { ctx.fillStyle = p >= c.at ? hsl(46, 95, 64, 0.95) : A.ink(0.45); ctx.beginPath(); ctx.arc(12 + (w - 24) * c.at, 29.5, 3, 0, TAU); ctx.fill(); });
      },
      resize() { g = A.fitCanvas(cv); },
    };
    show(true);
    A.loop.add(api);
    // Motion off holds one still frame: start it partway through the story so it shows organs, not only a colony
    A.bus.on('motion', () => { if (A.frozen() && !touched && p < 0.01) { p = 0.62; show(true); } });
    return { setP(v) { p = N.clamp(v, 0, 1); show(false); } };
  }

  A.makeStage6 = init;
})();
