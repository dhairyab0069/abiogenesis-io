/*
 * soupview.js - draws the soup on the hero canvas and turns pointer input
 * into forces.
 *
 * Per-frame work is kept cheap: small molecules are drawn in four batched
 * paths, every bead is one drawImage of a pre-rendered glow sprite (additive
 * blending gives the bioluminescent look without shadowBlur), and letters are
 * only drawn for beads under the "lens" around the pointer, on the hovered
 * chain, or on chains that were just dropped or planted.
 *
 * Pointer: hover pulls nearby molecules in (with a slight orbit), a quick tap
 * or click drops a new chain, press-and-hold stirs a current around the cursor.
 */
(function () {
  'use strict';
  const A = window.Abio;
  const LENS = 95;
  const ease = (p) => 1 - Math.pow(1 - p, 3);
  const FONT = '700 11px "Avenir Next", ui-rounded, system-ui, -apple-system, "Segoe UI", sans-serif';

  /* pH shifts the glow tint: acid runs warm (gold), neutral cyan, basic cool violet. */
  A.tintHue = (ph) => (ph < 7 ? 185 - (7 - ph) * 23 : 185 + (ph - 7) * 13);

  A.makeSoupView = function (cv, hud) {
    let g = A.fitCanvas(cv);
    const soup = new A.Soup(g.w, g.h);
    A.soup = soup;
    for (let i = 0; i < 400; i++) soup.step(0.05); // pre-warm so the first frame has a history
    const ptr = soup.ptr;
    const sprites = {};
    Object.keys(A.letterHue).forEach((c) => { sprites[c] = A.glowSprite(A.letterHue[c], 85, 60); });
    let hover = null, par = { x: 0, y: 0 }, lastHud = 0, ptrPrev = null;

    function local(e) {
      const r = cv.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top, t: performance.now() };
    }
    cv.addEventListener('pointermove', (e) => {
      const p = local(e);
      if (ptrPrev) {
        const dt = Math.max(0.008, (p.t - ptrPrev.t) / 1000);
        ptr.dx = A.clamp((p.x - ptrPrev.x) / dt, -500, 500) * 0.4 + ptr.dx * 0.6;
        ptr.dy = A.clamp((p.y - ptrPrev.y) / dt, -500, 500) * 0.4 + ptr.dy * 0.6;
      }
      ptrPrev = p; ptr.x = p.x; ptr.y = p.y; ptr.on = true;
      if (A.frozen()) A.loop.redraw();
    });
    cv.addEventListener('pointerleave', () => { ptr.on = false; ptr.down = false; ptrPrev = null; hover = null; if (A.frozen()) A.loop.redraw(); });
    cv.addEventListener('pointercancel', () => { ptr.down = false; ptr.on = false; ptrPrev = null; });
    let downAt = null;
    cv.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      const p = local(e);
      ptr.x = p.x; ptr.y = p.y; ptr.on = true; ptr.down = true; ptr.held = 0; downAt = p;
      try { cv.setPointerCapture(e.pointerId); } catch (_) { /* not critical */ }
    });
    cv.addEventListener('pointerup', (e) => {
      const p = local(e);
      const quick = downAt && p.t - downAt.t < 260 && Math.hypot(p.x - downAt.x, p.y - downAt.y) < 12;
      ptr.down = false;
      if (e.pointerType !== 'mouse') ptr.on = false;
      if (quick) { soup.userSpawn(p.x, p.y); if (A.frozen()) A.loop.redraw(); }
      downAt = null;
    });

    /* ---------- drawing ---------- */
    function glow(ctx, t) {
      const hue = A.tintHue(A.state.ph), R = Math.max(g.w, g.h) * 0.55;
      for (let i = 0; i < 3; i++) {
        const x = g.w * (0.5 + 0.38 * Math.sin(t * 0.045 + i * 2.1)), y = g.h * (0.5 + 0.32 * Math.cos(t * 0.037 + i * 1.7));
        const gr = ctx.createRadialGradient(x, y, 0, x, y, R);
        gr.addColorStop(0, 'hsla(' + (hue + i * 38) + ',75%,45%,0.17)');
        gr.addColorStop(1, 'hsla(' + (hue + i * 38) + ',75%,45%,0)');
        ctx.fillStyle = gr;
        ctx.fillRect(x - R, y - R, 2 * R, 2 * R);
      }
    }

    function molecules(ctx) {
      const ox = par.x, oy = par.y;
      const O = new Path2D(), Hh = new Path2D(), Cc = new Path2D(), H4 = new Path2D(), bonds = new Path2D();
      for (let i = 0; i < soup.mols.length; i++) {
        const m = soup.mols[i], x = m.x + ox * (m.z - 0.95), y = m.y + oy * (m.z - 0.95), z = m.z;
        if (m.k === 'w') {
          O.moveTo(x + 3.4 * z, y); O.arc(x, y, 3.4 * z, 0, 6.283);
          for (const s of [-1, 1]) {
            const hx = x + Math.cos(m.a + s * 0.92) * 6 * z, hy = y + Math.sin(m.a + s * 0.92) * 6 * z;
            bonds.moveTo(x, y); bonds.lineTo(hx, hy);
            Hh.moveTo(hx + 2 * z, hy); Hh.arc(hx, hy, 2 * z, 0, 6.283);
          }
        } else {
          Cc.moveTo(x + 3.8 * z, y); Cc.arc(x, y, 3.8 * z, 0, 6.283);
          for (let k = 0; k < 4; k++) {
            const a = m.a + k * 1.5708, hx = x + Math.cos(a) * 6.5 * z, hy = y + Math.sin(a) * 6.5 * z;
            bonds.moveTo(x, y); bonds.lineTo(hx, hy);
            H4.moveTo(hx + 1.8 * z, hy); H4.arc(hx, hy, 1.8 * z, 0, 6.283);
          }
        }
      }
      ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(190,240,255,0.2)'; ctx.stroke(bonds);
      ctx.fillStyle = 'rgba(41,221,237,0.8)'; ctx.fill(O);
      ctx.fillStyle = 'rgba(205,245,255,0.62)'; ctx.fill(Hh);
      ctx.fillStyle = 'rgba(132,234,123,0.78)'; ctx.fill(Cc);
      ctx.fillStyle = 'rgba(214,255,210,0.55)'; ctx.fill(H4);
    }

    /* Pass A (additive): strings and glowing beads; computes world positions. */
    function chainsGlow(ctx) {
      let best = 1e9; hover = null;
      for (let k = 0; k < soup.chains.length; k++) {
        const c = soup.chains[k], n = c.seq.length;
        if (!c.wp || c.wp.length !== n * 2) { c.wp = new Float32Array(n * 2); c.wr = new Float32Array(n); }
        const alpha = (c.born < 1 ? ease(c.born) : 1) * (c.dying > 0 ? 1 - c.dying : 1);
        const sc = c.z * (c.born < 1 ? 0.6 + 0.4 * ease(c.born) : 1);
        const cs = Math.cos(c.ang), sn = Math.sin(c.ang);
        for (let i = 0; i < n; i++) {
          const lx = c.pts[2 * i] * sc, ly = c.pts[2 * i + 1] * sc;
          const x = c.x + lx * cs - ly * sn, y = c.y + lx * sn + ly * cs;
          c.wp[2 * i] = x; c.wp[2 * i + 1] = y;
          let r = 3.6 * sc;
          if (ptr.on) {
            const d = Math.hypot(x - ptr.x, y - ptr.y);
            if (d < LENS) r *= 1 + 0.9 * (1 - d / LENS);
            if (d < best && d < 24) { best = d; hover = c; }
          }
          for (let f = 0; f < c.flash.length; f++) {
            if (c.flash[f].i === i && c.flash[f].kind === 'ins') r *= Math.min(1, c.flash[f].t / 0.35);
          }
          c.wr[i] = r;
        }
        c.alpha = alpha;
        // string
        ctx.globalAlpha = alpha * 0.45;
        ctx.strokeStyle = 'hsl(' + A.hueOfSeq(c.seq) + ' 70% 65%)'; ctx.lineWidth = 1.3;
        ctx.beginPath(); ctx.moveTo(c.wp[0], c.wp[1]);
        for (let i = 1; i < n; i++) ctx.lineTo(c.wp[2 * i], c.wp[2 * i + 1]);
        ctx.stroke();
        ctx.globalAlpha = alpha;
        for (let i = 0; i < n; i++) {
          const s = c.wr[i] / 0.3 * 2;
          ctx.drawImage(sprites[c.seq[i]], c.wp[2 * i] - s / 2, c.wp[2 * i + 1] - s / 2, s, s);
        }
      }
      ctx.globalAlpha = 1;
    }

    /* Pass B (normal blending): flashes, parent-colour rings, letters, labels. */
    function chainsDetail(ctx) {
      ctx.font = FONT; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      for (let k = 0; k < soup.chains.length; k++) {
        const c = soup.chains[k], n = c.seq.length, a = c.alpha;
        if (a <= 0.02) continue;
        for (let i = 0; i < n; i++) {
          const x = c.wp[2 * i], y = c.wp[2 * i + 1], r = c.wr[i];
          if (c.mix) {
            ctx.globalAlpha = a * c.mix.t; ctx.lineWidth = 1.6;
            ctx.strokeStyle = 'hsl(' + (i < c.mix.cut ? c.mix.ha : c.mix.hb) + ' 95% 72%)';
            ctx.beginPath(); ctx.arc(x, y, r * (1.7 + (1 - c.mix.t) * 0.9), 0, 6.283); ctx.stroke();
          }
          for (let f = 0; f < c.flash.length; f++) {
            const fl = c.flash[f];
            if (fl.i !== i) continue;
            const p = fl.t / 1.1;
            ctx.globalAlpha = (1 - p) * 0.95; ctx.fillStyle = '#fff';
            if (fl.kind === 'sub') { ctx.beginPath(); ctx.arc(x, y, r * 1.05, 0, 6.283); ctx.fill(); }
            ctx.strokeStyle = fl.kind === 'del' ? '#ff9ad8' : '#fff'; ctx.lineWidth = 1.5;
            ctx.beginPath(); ctx.arc(x, y, r * (1.3 + 2.4 * ease(p)), 0, 6.283); ctx.stroke();
          }
          const lens = ptr.on ? 1 - Math.hypot(x - ptr.x, y - ptr.y) / LENS : 0;
          if (c === hover || c.lt > 0 || lens > 0.3) {
            ctx.globalAlpha = a * (c === hover || c.lt > 0 ? 1 : (lens - 0.3) / 0.7);
            ctx.fillStyle = '#04141a';
            ctx.font = '700 ' + Math.max(7, Math.round(r * 1.55)) + 'px "Avenir Next", ui-rounded, system-ui, sans-serif';
            ctx.fillText(c.seq[i], x, y + 0.5);
          }
        }
      }
      ctx.globalAlpha = 1;
      if (hover) { // tiny tag for the chain under the pointer
        const c = hover, e = soup.log.get(c.id), top = Math.min.apply(null, Array.from(c.wp).filter((_, i) => i % 2));
        const txt = '#' + c.id + '  gen ' + (e ? e.depth : '?') + '  ' + (c.seq.length > 26 ? c.seq.slice(0, 25) + '…' : c.seq);
        ctx.font = FONT;
        const tw = ctx.measureText(txt).width + 16, tx = A.clamp(c.x, tw / 2 + 4, g.w - tw / 2 - 4), ty = Math.max(16, top - 16);
        ctx.fillStyle = 'rgba(4,22,28,0.78)';
        ctx.beginPath(); ctx.roundRect ? ctx.roundRect(tx - tw / 2, ty - 10, tw, 20, 10) : ctx.rect(tx - tw / 2, ty - 10, tw, 20); ctx.fill();
        ctx.fillStyle = '#d6fbff'; ctx.fillText(txt, tx, ty + 0.5);
      }
    }

    function effects(ctx, t) {
      const f = soup.fx, spr = A.glowSprite;
      for (const r of f.rings) {
        const p = r.t / 1.6, rad = (r.big ? 78 : 38) * ease(p);
        ctx.globalAlpha = (1 - p) * 0.55;
        let s = rad * 2.6; ctx.drawImage(spr(r.ha, 85, 60), r.x - s / 2 - rad * 0.2, r.y - s / 2, s, s);
        ctx.drawImage(spr(r.hb, 85, 60), r.x - s / 2 + rad * 0.2, r.y - s / 2, s, s); // two colours mixing
        ctx.globalAlpha = (1 - p) * 0.7; ctx.lineWidth = 1.5; ctx.strokeStyle = 'hsl(' + r.ha + ' 90% 75%)';
        ctx.beginPath(); ctx.arc(r.x, r.y, rad, 0, 6.283); ctx.stroke();
      }
      for (const gh of f.ghosts) {
        const s = 22 * (1 - gh.t / 1.4 * 0.4); ctx.globalAlpha = 0.8 * (1 - gh.t / 1.4);
        ctx.drawImage(spr(gh.hue, 85, 60), gh.x - s / 2, gh.y - s / 2, s, s);
      }
      for (const b of f.blooms) { // a quiet bloom of light for METHINKS
        const p = b.t / 6, s = (b.small ? 160 : 90) + (b.small ? 200 : 700) * ease(p);
        ctx.globalAlpha = 0.55 * (1 - p) * (1 - p);
        ctx.drawImage(spr(46, 95, 62), b.x - s / 2, b.y - s / 2, s, s);
        ctx.drawImage(spr(180, 85, 60), b.x - s / 3, b.y - s / 3, s / 1.5, s / 1.5);
      }
      for (const b of f.bolts) {
        const p = b.t / 0.7, fl = Math.random() < 0.25 ? 0.4 : 1;
        ctx.lineJoin = 'round';
        [[9, 0.10, '#29dded'], [3.5, 0.4, '#bff8ff'], [1.3, 1, '#ffffff']].forEach((s) => {
          ctx.globalAlpha = s[1] * (1 - p) * fl; ctx.lineWidth = s[0]; ctx.strokeStyle = s[2];
          ctx.beginPath(); ctx.moveTo(b.pts[0][0], b.pts[0][1]);
          for (let i = 1; i < b.pts.length; i++) ctx.lineTo(b.pts[i][0], b.pts[i][1]);
          ctx.stroke();
        });
      }
      if (f.flash > 0) { ctx.globalAlpha = f.flash * 0.1; ctx.fillStyle = '#cfefff'; ctx.fillRect(0, 0, g.w, g.h); }
      ctx.globalAlpha = 1;
      if (ptr.on) { // cursor halo; swirling arcs while a current is being stirred
        const s = 150 + 10 * Math.sin(t * 3); ctx.globalAlpha = 0.28;
        ctx.drawImage(spr(190, 85, 60), ptr.x - s / 2, ptr.y - s / 2, s, s);
        if (ptr.down && ptr.held > 0.25) {
          ctx.globalAlpha = 0.5; ctx.strokeStyle = '#84ea7b'; ctx.lineWidth = 1.5;
          for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(ptr.x, ptr.y, 40 + i * 28, t * 2 + i * 2, t * 2 + i * 2 + 2); ctx.stroke(); }
        }
        ctx.globalAlpha = 1;
      }
    }

    function updateHud(force) {
      const now = performance.now();
      if (!force && now - lastHud < 250) return;
      lastHud = now;
      const v = {
        chains: soup.chains.filter((c) => !c.dying).length, gen: soup.depth, mut: soup.counts.mut, rec: soup.counts.rec,
        temp: Math.round(A.state.temp) + ' K', ph: A.state.ph.toFixed(1), best: soup.best + '/8', sight: soup.counts.sight,
      };
      for (const k in v) if (hud[k] && hud[k].textContent !== String(v[k])) hud[k].textContent = v[k];
    }

    const tk = A.loop.add({
      el: cv, stepAlways: true,
      step(dt) {
        soup.step(dt);
        ptr.dx *= 0.92; ptr.dy *= 0.92;
        const tx = ptr.on ? ptr.x - g.w / 2 : 0, ty = ptr.on ? ptr.y - g.h / 2 : 0;
        par.x += (tx * 0.08 - par.x) * 0.05; par.y += (ty * 0.08 - par.y) * 0.05;
      },
      draw() {
        const ctx = g.ctx, t = soup.time;
        ctx.globalCompositeOperation = 'source-over';
        ctx.clearRect(0, 0, g.w, g.h);
        glow(ctx, t);
        molecules(ctx);
        ctx.globalCompositeOperation = 'lighter';
        chainsGlow(ctx);
        effects(ctx, t);
        ctx.globalCompositeOperation = 'source-over';
        chainsDetail(ctx);
        updateHud(A.frozen());
      },
      resize() { g = A.fitCanvas(cv); soup.resize(g.w, g.h); },
    });

    A.bus.on('env', () => document.documentElement.style.setProperty('--tint', String(Math.round(A.tintHue(A.state.ph)))));
    A.bus.emit('env');
    return {
      soup, tk,
      spark() { soup.strike(); if (A.frozen()) A.loop.redraw(); },
      plant() { soup.plant(g.w * A.rnd(0.35, 0.65), g.h * A.rnd(0.35, 0.6)); if (A.frozen()) A.loop.redraw(); },
      drop() { soup.userSpawn(g.w * A.rnd(0.2, 0.8), g.h * A.rnd(0.3, 0.7)); if (A.frozen()) A.loop.redraw(); },
    };
  };
})();
