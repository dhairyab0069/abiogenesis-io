/*
 * stages.js - one small animated illustration per roadmap stage, each with a
 * different behaviour and none with a fixed period:
 *   1  chain tiles that mutate and recombine (what the app does today)
 *   2  a pool that dries and refills at irregular intervals, chains concentrate
 *   3  lipids drifting, then self-assembling into a vesicle around molecules
 *   4  live charts fed by the hero soup's history (a preview of the metrics)
 *   5  a population under natural or forced selection (the visitor toggles it)
 * Stages 2 to 5 are illustrations of PLANNED features, not app screenshots.
 * Each factory builds its state, pre-warms it (so reduced-motion gets a
 * meaningful still), and registers a ticker with the shared loop.
 */
(function () {
  'use strict';
  const A = window.Abio, C = A.chem;
  const TAU = 6.283185307;
  const ease = (p) => 1 - Math.pow(1 - p, 3);
  const hsl = (h, s, l, a) => 'hsla(' + h + ',' + s + '%,' + l + '%,' + (a == null ? 1 : a) + ')';
  const FONT = '"Avenir Next", ui-rounded, system-ui, -apple-system, "Segoe UI", sans-serif';

  /* Boilerplate: size, warm up, register. `api` has step(dt), draw(ctx, w, h). */
  function make(cv, api, warm) {
    let g = A.fitCanvas(cv);
    for (let i = 0; i < (warm || 160); i++) api.step(0.05, g.w, g.h);
    return A.loop.add({
      el: cv,
      step(dt) { api.step(dt, g.w, g.h); },
      draw() { g.ctx.clearRect(0, 0, g.w, g.h); api.draw(g.ctx, g.w, g.h); },
      resize() { g = A.fitCanvas(cv); },
    });
  }

  /* ---------- Stage 1: tiles ---------- */
  function stage1(cv) {
    const rows = [[], [], []]; // two parents and a child, each a list of tiles
    let timer = 1, tNow = 0, label = '';
    const tile = (ch, delay) => ({ ch, s: delay ? 0 : 1, d: delay || 0, f: 0, from: 0 });
    const fresh = (row) => { rows[row] = C.randomSeq(Math.random, A.irnd(7, 12)).split('').map((c) => tile(c)); };
    fresh(0); fresh(1);
    function event() {
      const k = Math.random();
      const r = rows[A.irnd(0, 1)], i = A.irnd(0, Math.max(0, r.length - 1));
      if (k < 0.3 && r.length) { r[i].ch = C.randomAA(Math.random); r[i].f = 1; label = 'substitution'; }
      else if (k < 0.45 && r.length < 16) { r.splice(i, 0, tile(C.randomAA(Math.random), 0.001)); r[i].f = 1; label = 'insertion'; }
      else if (k < 0.6 && r.length > 3) { r[i].dead = 1; label = 'deletion'; }
      else if (k < 0.92) {
        const a = rows[0], b = rows[1], p1 = A.irnd(1, a.length - 1), p2 = A.irnd(1, b.length - 1);
        rows[2] = a.slice(0, p1).map((t, n) => Object.assign(tile(t.ch, 0.05 + n * 0.07), { from: 1 }))
          .concat(b.slice(p2).map((t, n) => Object.assign(tile(t.ch, 0.05 + (p1 + n) * 0.07), { from: 2 })));
        label = 'recombination';
      } else { fresh(A.irnd(0, 1)); label = 'new chain'; }
    }
    return make(cv, {
      step(dt) {
        tNow += dt; timer -= dt;
        if (timer <= 0) { event(); timer = A.expo(1.4) + 0.3; }
        rows.forEach((r, ri) => {
          for (let i = r.length - 1; i >= 0; i--) {
            const t = r[i];
            if (t.d > 0) { t.d -= dt; continue; }
            t.s += ((t.dead ? 0 : 1) - t.s) * Math.min(1, dt * 7);
            t.f = Math.max(0, t.f - dt * 1.4);
            if (t.dead && t.s < 0.03) r.splice(i, 1);
          }
        });
      },
      draw(ctx, w, h) {
        const ts = Math.min(26, (w - 24) / 16.5), gap = 3;
        const ys = [h * 0.17, h * 0.42, h * 0.72];
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = '700 ' + Math.round(ts * 0.55) + 'px ' + FONT;
        rows.forEach((r, ri) => {
          const x0 = (w - r.length * (ts + gap)) / 2;
          r.forEach((t, i) => {
            if (t.d > 0) return;
            const x = x0 + i * (ts + gap), s = t.s * ts, hue = A.letterHue[t.ch] || 180;
            ctx.fillStyle = hsl(hue, 80, 55, 0.88);
            ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x + (ts - s) / 2, ys[ri] - s / 2, s, s, s * 0.32) : ctx.rect(x, ys[ri] - s / 2, s, s); ctx.fill();
            if (ri === 2 && t.from) { ctx.strokeStyle = t.from === 1 ? '#29dded' : '#e648c8'; ctx.lineWidth = 2; ctx.stroke(); }
            if (t.f > 0) { ctx.fillStyle = 'rgba(255,255,255,' + t.f * 0.85 + ')'; ctx.fill(); }
            if (s > ts * 0.5) { ctx.fillStyle = '#04141a'; ctx.fillText(t.ch, x + ts / 2, ys[ri] + 1); }
          });
        });
        ctx.textAlign = 'left'; ctx.fillStyle = 'rgba(190,240,255,0.7)'; ctx.font = '600 12px ' + FONT;
        ctx.fillText('parent A', 14, h * 0.17 - ts * 0.9); ctx.fillText('parent B', 14, h * 0.42 - ts * 0.9);
        ctx.fillText('child' + (label ? '  (last event: ' + label + ')' : ''), 14, h * 0.72 - ts * 0.9);
      },
    }, 60);
  }

  /* ---------- Stage 2: a pool that dries and refills ---------- */
  function stage2(cv) {
    const P = [];
    for (let i = 0; i < 30; i++) P.push({ x: A.rnd(0.3, 0.7), y: A.rnd(0.5, 0.9), vx: 0, vy: 0, n: A.irnd(1, 4), hue: A.irnd(120, 330), ph: A.rnd(0, TAU) });
    let level = 0.8, target = 0.8, wait = 3, t = 0, rain = 0, cell = 0, mode = 'full';
    const bowl = (u, H) => H * 0.40 + H * 0.5 * (1 - u * u);
    return make(cv, {
      step(dt, w, h) {
        t += dt; wait -= dt;
        if (wait <= 0) { // irregular: dry for a random spell, refill by rain, or hover
          const k = Math.random();
          if (k < 0.5) { target = A.rnd(0.04, 0.28); wait = A.rnd(4, 9); mode = 'drying'; }
          else if (k < 0.85) { target = A.rnd(0.7, 1); wait = A.rnd(2.5, 7); rain = 1.6; mode = 'rain'; }
          else { target = A.clamp(level + A.gauss() * 0.15, 0.05, 1); wait = A.rnd(1, 3); }
        }
        level += (target - level) * Math.min(1, dt * (target > level ? 1.2 : 0.35)) + A.gauss() * 0.002;
        rain = Math.max(0, rain - dt);
        const conc = 1 - A.clamp(level / 0.45, 0, 1);
        cell += ((conc > 0.55 ? 1 : 0) - cell) * Math.min(1, dt * 0.8);
        const ys = 0.9 - level * 0.5;
        for (const p of P) {
          p.vx = p.vx * 0.9 + A.gauss() * 0.02 * (1 - conc * 0.7); p.vy = p.vy * 0.9 + A.gauss() * 0.02 * (1 - conc * 0.7);
          p.x += p.vx * dt * 6; p.y += p.vy * dt * 6;
          const u = (p.x - 0.5) * 2, span = Math.sqrt(Math.max(0.001, 1 - (ys - 0.4) / 0.5)), bot = bowl(Math.min(0.98, Math.abs(u)), 1) - 0.03;
          if (conc > 0.45) p.x += (0.5 - p.x) * dt * 0.5 * conc; // stranded chains gather at the lowest point
          p.x = A.clamp(p.x, 0.5 - span * 0.5 + 0.02, 0.5 + span * 0.5 - 0.02);
          p.y = A.clamp(p.y, Math.min(ys + 0.03, bot), bot);
        }
      },
      draw(ctx, w, h) {
        const ys = (0.9 - level * 0.5) * h, conc = 1 - A.clamp(level / 0.45, 0, 1);
        // sun, stronger as the pool dries
        const sun = ctx.createRadialGradient(w * 0.85, h * 0.12, 0, w * 0.85, h * 0.12, h * 0.55);
        sun.addColorStop(0, hsl(46, 95, 60, 0.15 + 0.4 * conc)); sun.addColorStop(1, hsl(46, 95, 60, 0));
        ctx.fillStyle = sun; ctx.fillRect(0, 0, w, h);
        ctx.beginPath(); // basin
        for (let i = 0; i <= 40; i++) { const u = i / 20 - 1; ctx.lineTo(w * (0.5 + u * 0.5), bowl(u, h)); }
        ctx.lineWidth = 3; ctx.strokeStyle = hsl(190, 40, 40, 0.5); ctx.stroke();
        ctx.save(); // water, clipped to the basin
        ctx.beginPath(); ctx.moveTo(0, 0); // the cavity: everything above the bowl curve
        for (let i = 0; i <= 40; i++) { const u = i / 20 - 1; ctx.lineTo(w * (0.5 + u * 0.5), bowl(u, h)); }
        ctx.lineTo(w, 0); ctx.closePath(); ctx.clip();
        const wg = ctx.createLinearGradient(0, ys, 0, h);
        wg.addColorStop(0, hsl(188, 80, 50, 0.38)); wg.addColorStop(1, hsl(200, 80, 30, 0.6));
        ctx.fillStyle = wg; ctx.beginPath(); ctx.moveTo(0, h);
        for (let x = 0; x <= w; x += 8) ctx.lineTo(x, ys + Math.sin(x * 0.05 + t * 1.3) * 2 + Math.sin(x * 0.13 - t * 0.9) * 1.2);
        ctx.lineTo(w, h); ctx.closePath(); ctx.fill();
        ctx.restore();
        if (rain > 0) { // raindrops while refilling
          ctx.strokeStyle = 'rgba(190,240,255,0.5)'; ctx.lineWidth = 1.2;
          for (let i = 0; i < 9; i++) { const x = (Math.sin(i * 91.3 + Math.floor(t * 6) * 7.7) * 0.5 + 0.5) * w, y = ((t * 3 + i * 0.37) % 1) * (ys); ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 2, y + 9); ctx.stroke(); }
        }
        ctx.globalCompositeOperation = 'lighter';
        for (const p of P) {
          const x = p.x * w, y = p.y * h, s = 12 + conc * 3;
          for (let b = 0; b < p.n; b++) {
            const bx = x + (b - p.n / 2) * (5 + (1 - conc) * 4), by = y + Math.sin(p.ph + b * 0.9 + t) * 2.5 * (1 - conc * 0.8);
            ctx.drawImage(A.glowSprite(p.hue + b * 14, 85, 60), bx - s / 2, by - s / 2, s, s);
          }
        }
        ctx.globalCompositeOperation = 'source-over';
        if (cell > 0.02) { // a protocell droplet forms where chains concentrate
          const r = (22 + 20 * cell) * Math.min(1, w / 340);
          ctx.beginPath();
          for (let i = 0; i <= 48; i++) { const a = i / 48 * TAU, rr = r * (1 + 0.07 * Math.sin(3 * a + t * 1.7) + 0.05 * Math.sin(5 * a - t * 1.1)); ctx.lineTo(w / 2 + Math.cos(a) * rr, h * 0.85 + Math.sin(a) * rr * 0.7); }
          ctx.closePath(); ctx.fillStyle = hsl(320, 80, 60, 0.12 * cell); ctx.fill();
          ctx.lineWidth = 2; ctx.strokeStyle = hsl(320, 85, 70, 0.7 * cell); ctx.stroke();
        }
        ctx.fillStyle = 'rgba(190,240,255,0.75)'; ctx.font = '600 12px ' + FONT; ctx.textAlign = 'left';
        ctx.fillText(level < 0.2 ? 'dry spell: chains concentrate' : level > 0.7 ? 'wet: chains disperse' : 'in between', 14, 20);
      },
    }, 120);
  }

  /* ---------- Stage 3: lipids self-assemble ---------- */
  function stage3(cv) {
    const N = 30, L = [], M = [];
    for (let i = 0; i < N; i++) L.push({ x: Math.random(), y: Math.random(), vx: 0, vy: 0, a: A.rnd(0, TAU), p: 0, delay: 0, rate: A.rnd(0.2, 0.55) });
    for (let i = 0; i < 7; i++) M.push({ x: A.rnd(0.3, 0.7), y: A.rnd(0.3, 0.7), vx: 0, vy: 0, h: i % 2 ? 168 : 46 });
    let phase = 'drift', left = 3, t = 0, avg = 0;
    return make(cv, {
      step(dt, w, h) {
        t += dt; left -= dt;
        if (left <= 0) {
          if (phase === 'drift') { phase = 'assemble'; left = A.rnd(5, 9); L.forEach((l) => (l.delay = A.rnd(0, 2.5))); }
          else if (phase === 'assemble') { phase = 'hold'; left = A.rnd(4, 10); }
          else if (phase === 'hold') { phase = 'burst'; left = 1.2; L.forEach((l) => { l.vx = A.gauss() * 0.25; l.vy = A.gauss() * 0.25; }); }
          else { phase = 'drift'; left = A.rnd(2, 6); }
        }
        avg = 0;
        for (const l of L) {
          l.vx = l.vx * 0.92 + A.gauss() * 0.012; l.vy = l.vy * 0.92 + A.gauss() * 0.012;
          l.x = (l.x + l.vx * dt * 2 + 1) % 1; l.y = (l.y + l.vy * dt * 2 + 1) % 1;
          if (phase === 'assemble') { l.delay -= dt; if (l.delay <= 0) l.p = Math.min(1, l.p + dt * l.rate); }
          else if (phase === 'burst' || phase === 'drift') l.p = Math.max(0, l.p - dt * (phase === 'burst' ? 1.5 : 0.35));
          avg += l.p / N;
        }
        for (const m of M) {
          m.vx = m.vx * 0.94 + A.gauss() * 0.02; m.vy = m.vy * 0.94 + A.gauss() * 0.02;
          m.x += m.vx * dt * 3; m.y += m.vy * dt * 3;
          if (avg > 0.6) { // captured: bounce inside the vesicle
            const dx = m.x - 0.5, dy = (m.y - 0.5) * (h / w), d = Math.hypot(dx, dy), R = Math.min(w * 0.3, h * 0.38) / w;
            if (d > R * 0.8) { m.x = 0.5 + dx / d * R * 0.78; m.y = 0.5 + dy / d * R * 0.78 * (w / h); m.vx *= -0.7; m.vy *= -0.7; }
          } else { m.x = (m.x + 1) % 1; m.y = (m.y + 1) % 1; }
        }
      },
      draw(ctx, w, h) {
        const cx = w / 2, cy = h / 2, R = Math.min(w * 0.3, h * 0.38);
        if (avg > 0.2) { ctx.fillStyle = hsl(188, 80, 50, 0.1 * avg); ctx.beginPath(); ctx.arc(cx, cy, R * 0.95, 0, TAU); ctx.fill(); }
        ctx.lineCap = 'round';
        L.forEach((l, i) => {
          const th = i / N * TAU + 0.3, wob = 1 + 0.04 * Math.sin(3 * th + t * 1.6) + 0.03 * Math.sin(5 * th - t * 1.1), e = ease(l.p);
          const sx = cx + Math.cos(th) * R * wob, sy = cy + Math.sin(th) * R * wob;
          const x = l.x * w + (sx - l.x * w) * e, y = l.y * h + (sy - l.y * h) * e;
          const ang = l.a + (th - l.a + Math.PI * 2 * Math.round((l.a - th) / (TAU))) * e; // head points outward when assembled
          const dx = Math.cos(ang), dy = Math.sin(ang);
          ctx.strokeStyle = hsl(46, 90, 70, 0.8); ctx.lineWidth = 1.6;
          for (const s of [-0.28, 0.28]) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - Math.cos(ang + s) * 11, y - Math.sin(ang + s) * 11); ctx.stroke(); }
          ctx.fillStyle = hsl(320, 85, 62, 0.95); ctx.beginPath(); ctx.arc(x + dx * 1, y + dy * 1, 4.2, 0, TAU); ctx.fill();
        });
        ctx.globalCompositeOperation = 'lighter';
        for (const m of M) { const s = 18; ctx.drawImage(A.glowSprite(m.h, 85, 60), m.x * w - s / 2, m.y * h - s / 2, s, s); }
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = 'rgba(190,240,255,0.75)'; ctx.font = '600 12px ' + FONT; ctx.textAlign = 'left';
        ctx.fillText(phase === 'drift' ? 'lipids drift apart' : phase === 'assemble' ? 'heads turn outward, tails hide' : phase === 'hold' ? 'a vesicle holds its molecules' : 'the membrane bursts', 14, 20);
      },
    }, 100);
  }

  /* ---------- Stage 4: live charts from the hero soup ---------- */
  function stage4(cv, readout) {
    const defs = [
      { k: 'ent', title: 'diversity (residue entropy, bits)', hue: 180, f: (v) => v.toFixed(2) },
      { k: 'len', title: 'complexity (mean chain length)', hue: 118, f: (v) => v.toFixed(1) },
      { k: 'uniq', title: 'distinct sequences', hue: 320, f: (v) => String(Math.round(v)) },
    ];
    const rng = defs.map(() => null); // smoothed [lo, hi] per chart, snapped on first draw
    let lastTxt = -1e9;
    return make(cv, {
      step() {},
      draw(ctx, w, h) {
        const H = A.soup && A.soup.history;
        if (!H) return;
        const cols = w > 460 ? 2 : 1, rows = Math.ceil(4 / cols), cw = w / cols, ch = h / rows, pad = 10;
        for (let i = 0; i < 4; i++) {
          const x0 = (i % cols) * cw + pad, y0 = Math.floor(i / cols) * ch + pad, pw = cw - pad * 2, ph = ch - pad * 2;
          ctx.fillStyle = 'rgba(255,255,255,0.04)'; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x0 - 4, y0 - 4, pw + 8, ph + 8, 14) : ctx.rect(x0, y0, pw, ph); ctx.fill();
          ctx.font = '600 11px ' + FONT; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
          if (i === 3) { // not buildable yet: honest placeholder
            ctx.fillStyle = 'rgba(190,240,255,0.5)'; ctx.fillText('replicators', x0 + 4, y0 + 12);
            ctx.setLineDash([4, 5]); ctx.strokeStyle = 'rgba(190,240,255,0.35)'; ctx.beginPath(); ctx.moveTo(x0, y0 + ph * 0.65); ctx.lineTo(x0 + pw, y0 + ph * 0.65); ctx.stroke(); ctx.setLineDash([]);
            ctx.fillText('planned: needs Stage 3 chemistry', x0 + 4, y0 + ph - 4);
            continue;
          }
          const d = defs[i], data = H[d.k];
          ctx.fillStyle = 'rgba(214,251,255,0.8)'; ctx.fillText(d.title, x0 + 4, y0 + 12);
          if (data.length < 2) continue;
          let lo = Math.min.apply(null, data), hi = Math.max.apply(null, data);
          if (hi - lo < 0.5) { const m = (hi + lo) / 2; lo = m - 0.25; hi = m + 0.25; }
          if (!rng[i]) rng[i] = [lo, hi];
          rng[i][0] += (lo - rng[i][0]) * 0.1; rng[i][1] += (hi - rng[i][1]) * 0.1;
          const top = y0 + 20, bh = ph - 24;
          const py = (v) => top + bh - A.clamp((v - rng[i][0]) / (rng[i][1] - rng[i][0]), 0, 1) * bh;
          const off = (120 - data.length) / 119 * pw;
          ctx.beginPath(); ctx.moveTo(x0 + off, top + bh);
          data.forEach((v, j) => ctx.lineTo(x0 + off + (j / 119) * pw, py(v)));
          ctx.lineTo(x0 + off + ((data.length - 1) / 119) * pw, top + bh); ctx.closePath();
          const gr = ctx.createLinearGradient(0, top, 0, top + bh); gr.addColorStop(0, hsl(d.hue, 85, 60, 0.35)); gr.addColorStop(1, hsl(d.hue, 85, 60, 0));
          ctx.fillStyle = gr; ctx.fill();
          ctx.beginPath(); data.forEach((v, j) => ctx[j ? 'lineTo' : 'moveTo'](x0 + off + (j / 119) * pw, py(v)));
          ctx.strokeStyle = hsl(d.hue, 90, 68); ctx.lineWidth = 1.8; ctx.lineJoin = 'round'; ctx.stroke();
          const last = data[data.length - 1], lx = x0 + off + ((data.length - 1) / 119) * pw;
          ctx.fillStyle = hsl(d.hue, 90, 75); ctx.beginPath(); ctx.arc(lx, py(last), 3, 0, TAU); ctx.fill();
          ctx.textAlign = 'right'; ctx.fillText(d.f(last), x0 + pw - 2, y0 + 12);
        }
        const now = performance.now();
        if (readout && now - lastTxt > 1000) {
          lastTxt = now;
          const last = (k) => H[k][H[k].length - 1] || 0;
          readout.textContent = 'Right now: residue entropy ' + last('ent').toFixed(2) + ' bits, mean chain length ' + last('len').toFixed(1) + ', ' + Math.round(last('uniq')) + ' distinct sequences among ' + Math.round(last('n')) + ' chains.';
        }
      },
    }, 1);
  }

  /* ---------- Stage 5: natural vs forced selection ---------- */
  function stage5(cv, readout) {
    const N = 220, B = 36;
    let pop = Array.from({ length: N }, () => A.clamp(0.5 + A.gauss() * 0.1, 0, 1));
    let mode = 'natural', opt = 0.5, goal = 0.82, wait = 0.5, gen = 0, dispOpt = 0.5, lastTxt = -1e9;
    const shown = new Float32Array(B);
    const stats = () => { const m = pop.reduce((a, b) => a + b, 0) / N; return { m, sd: Math.sqrt(pop.reduce((a, b) => a + (b - m) * (b - m), 0) / N) }; };
    function generation() {
      gen++;
      if (mode === 'natural') { opt = A.clamp(opt + A.gauss() * 0.035 + (Math.random() < 0.07 ? A.gauss() * 0.25 : 0), 0.05, 0.95); }
      else opt = goal;
      const sig = mode === 'natural' ? 0.3 : 0.07, mu = mode === 'natural' ? 0.03 : 0.012;
      const fit = pop.map((t) => Math.exp(-((t - opt) * (t - opt)) / (2 * sig * sig)) + 1e-4);
      const cum = []; let s = 0; fit.forEach((f) => { s += f; cum.push(s); });
      pop = pop.map(() => {
        let r = Math.random() * s, lo = 0, hi = N - 1;
        while (lo < hi) { const mid = (lo + hi) >> 1; if (cum[mid] < r) lo = mid + 1; else hi = mid; }
        return A.clamp(pop[lo] + A.gauss() * mu, 0, 1);
      });
    }
    const api = {
      step(dt) {
        wait -= dt; if (wait <= 0) { generation(); wait = A.rnd(0.35, 1.1); }
        dispOpt += (opt - dispOpt) * Math.min(1, dt * 3);
        const hist = new Float32Array(B);
        pop.forEach((t) => { hist[Math.min(B - 1, Math.floor(t * B))]++; });
        for (let i = 0; i < B; i++) shown[i] += (hist[i] - shown[i]) * Math.min(1, dt * 5);
      },
      draw(ctx, w, h) {
        const bw = w / B, base = h - 26;
        for (let i = 0; i < B; i++) {
          const bh = Math.min(1, Math.sqrt(shown[i] / 70)) * (base - 20), hue = 188 - (i / B) * 228;
          const gr = ctx.createLinearGradient(0, base - bh, 0, base);
          gr.addColorStop(0, hsl(hue, 85, 62, 0.95)); gr.addColorStop(1, hsl(hue, 85, 40, 0.2));
          ctx.fillStyle = gr; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(i * bw + 1.5, base - bh, bw - 3, Math.max(bh, 0), 4) : ctx.rect(i * bw + 1.5, base - bh, bw - 3, bh); ctx.fill();
        }
        const ox = dispOpt * w;
        ctx.setLineDash([5, 5]); ctx.strokeStyle = mode === 'forced' ? hsl(46, 95, 62, 0.95) : hsl(160, 90, 65, 0.8); ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(ox, 8); ctx.lineTo(ox, base + 4); ctx.stroke(); ctx.setLineDash([]);
        ctx.fillStyle = 'rgba(190,240,255,0.78)'; ctx.font = '600 12px ' + FONT; ctx.textAlign = 'left';
        ctx.fillText(mode === 'natural' ? 'natural: a drifting world, the population follows' : 'forced: your target, hard selection', 12, h - 8);
        const now = performance.now();
        if (readout && now - lastTxt > 800) {
          lastTxt = now; const st = stats();
          readout.textContent = 'Generation ' + gen + ' (' + mode + ' selection): mean trait ' + st.m.toFixed(2) + ', spread ' + st.sd.toFixed(3) + (mode === 'forced' ? ', target ' + goal.toFixed(2) : '') + '.';
        }
      },
    };
    const tk = make(cv, api, 60);
    cv.addEventListener('pointerdown', (e) => { // click sets the forced target (or shocks the natural world)
      const r = cv.getBoundingClientRect(), v = A.clamp((e.clientX - r.left) / r.width, 0.03, 0.97);
      if (mode === 'forced') goal = v; else opt = v;
      if (A.frozen()) A.loop.redraw();
    });
    tk.setMode = (m) => { mode = m; if (m === 'forced') goal = A.clamp(opt + (Math.random() < 0.5 ? -1 : 1) * 0.3, 0.1, 0.9); if (A.frozen()) A.loop.redraw(); };
    return tk;
  }

  A.makeStages = (els) => ({
    s1: stage1(els.s1), s2: stage2(els.s2), s3: stage3(els.s3),
    s4: stage4(els.s4, els.s4text), s5: stage5(els.s5, els.s5text),
  });
})();
