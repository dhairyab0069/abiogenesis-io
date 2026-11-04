/*
 * app.js - the small runtime every other script plugs into.
 *
 * Design: ONE requestAnimationFrame loop drives everything (hero soup, the
 * five stage illustrations, membranes, background plankton). Each piece
 * registers a "ticker" { el, step(dt), draw(), stepAlways, resize() }:
 *   - draw() only runs while the ticker's element is on screen (IntersectionObserver);
 *   - step() runs for visible tickers, and always for `stepAlways` ones (the
 *     soup's cheap logic keeps running offscreen so charts and the lineage
 *     tree stay alive, only its drawing stops);
 *   - the loop stops entirely when the tab is hidden, the visitor pauses life,
 *     or motion is reduced, and then draws a single calm frame on demand.
 *
 * Randomness helpers, the amino acid palette, the shared state and a tiny
 * event bus also live here. Scripts are classic (not ES modules) so the page
 * works from file:// too; they share the window.Abio namespace.
 */
(function () {
  'use strict';
  const A = (window.Abio = window.Abio || {});

  /* ---------- randomness ---------- */
  A.rand = Math.random;
  A.rnd = (a, b) => a + Math.random() * (b - a);
  A.irnd = (a, b) => Math.floor(A.rnd(a, b + 1));
  A.expo = (mean) => -Math.log(1 - Math.random()) * mean; // exponential waiting time
  A.gauss = () => { // Box-Muller
    let u = 0;
    while (u === 0) u = Math.random();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(6.283185307 * Math.random());
  };
  A.clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

  /* ---------- palette: colour = chemistry class of the residue ---------- */
  const group = { hydrophobic: 'AVILMFWPGC', polar: 'STNQY', basic: 'KRH', acidic: 'DE' };
  const span = { hydrophobic: [192, 112], polar: [52, 38], basic: [326, 300], acidic: [16, 4] };
  A.letterHue = {};
  A.letterColor = {};
  Object.keys(group).forEach((g) => {
    const letters = group[g];
    letters.split('').forEach((c, i) => {
      const f = letters.length > 1 ? i / (letters.length - 1) : 0;
      const h = Math.round(span[g][0] + (span[g][1] - span[g][0]) * f);
      A.letterHue[c] = h;
      A.letterColor[c] = 'hsl(' + h + ' 85% 62%)';
    });
  });
  A.hueOfSeq = (seq) => { // circular-ish mean hue is overkill: use the middle residue
    return A.letterHue[seq[Math.floor(seq.length / 2)]] || 180;
  };

  /* ---------- state and bus ---------- */
  const mq = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  A.state = { paused: false, calm: !!(mq && mq.matches), temp: 300, ph: 7 };
  const handlers = {};
  A.bus = {
    on(name, fn) { (handlers[name] = handlers[name] || []).push(fn); },
    emit(name, data) { (handlers[name] || []).forEach((fn) => fn(data)); },
  };
  const root = document.documentElement;
  A.frozen = () => A.state.paused || A.state.calm;
  function applyMotion() {
    root.classList.toggle('paused', A.state.paused);
    root.classList.toggle('calm', A.state.calm);
    A.bus.emit('motion', A.state);
    if (A.frozen()) A.loop.redraw(); else A.loop.start();
  }
  A.setPaused = (b) => { A.state.paused = !!b; applyMotion(); };
  A.setCalm = (b) => { A.state.calm = !!b; applyMotion(); };
  if (mq && mq.addEventListener) mq.addEventListener('change', (e) => A.setCalm(e.matches));

  /* ---------- the one loop ---------- */
  const tickers = [];
  let raf = 0;
  let last = 0;
  let clock = 0;
  const io = window.IntersectionObserver
    ? new IntersectionObserver((entries) => {
        entries.forEach((en) => {
          const t = en.target.__ticker;
          if (!t) return;
          const was = t.visible;
          t.visible = en.isIntersecting;
          if (t.visible && !was && A.frozen() && t.draw) t.draw();
        });
      }, { rootMargin: '80px' })
    : null;

  function frame(now) {
    raf = 0;
    if (A.frozen() || document.hidden) return;
    let dt = (now - last) / 1000; // rAF timestamps can precede performance.now(): never go negative
    if (!(dt > 0)) dt = 0.016;
    dt = Math.min(dt, 0.05);
    last = now;
    clock += dt;
    for (let i = 0; i < tickers.length; i++) {
      const t = tickers[i];
      if (t.visible || t.stepAlways) { if (t.step) t.step(dt, clock); }
      if (t.visible && t.draw) t.draw();
    }
    raf = requestAnimationFrame(frame);
  }

  A.loop = {
    add(t) {
      t.visible = !(t.el && io);
      if (t.el && io) { t.el.__ticker = t; io.observe(t.el); }
      tickers.push(t);
      return t;
    },
    start() { if (!raf && !A.frozen() && !document.hidden) { last = performance.now(); raf = requestAnimationFrame(frame); } },
    redraw() { // one still frame for every visible ticker (paused / calm mode)
      tickers.forEach((t) => { if (t.visible && t.draw) t.draw(); });
    },
    resize() { tickers.forEach((t) => t.resize && t.resize()); if (A.frozen()) A.loop.redraw(); },
  };
  document.addEventListener('visibilitychange', () => { if (document.hidden) { cancelAnimationFrame(raf); raf = 0; } else A.loop.start(); });
  let rt = 0;
  window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(A.loop.resize, 120); });

  /* Canvas helper: size to its CSS box at a capped pixel ratio (<= 1.5). */
  A.fitCanvas = (cv) => {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const r = cv.getBoundingClientRect();
    const w = Math.max(1, Math.round(r.width)), h = Math.max(1, Math.round(r.height));
    cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
    const ctx = cv.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx, w, h, dpr };
  };

  /* Glow sprite per colour, pre-rendered once so beads cost one drawImage. */
  A.glowSprite = (hue, sat, light) => {
    const key = hue + '/' + sat + '/' + light;
    A.glowSprite.cache = A.glowSprite.cache || {};
    if (A.glowSprite.cache[key]) return A.glowSprite.cache[key];
    const S = 64, c = document.createElement('canvas');
    c.width = c.height = S;
    const g = c.getContext('2d');
    const gr = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
    gr.addColorStop(0, 'hsla(' + hue + ',' + sat + '%,94%,1)');
    gr.addColorStop(0.16, 'hsla(' + hue + ',' + sat + '%,' + light + '%,1)');
    gr.addColorStop(0.30, 'hsla(' + hue + ',' + sat + '%,' + light + '%,.92)');
    gr.addColorStop(0.5, 'hsla(' + hue + ',' + sat + '%,' + light + '%,.22)');
    gr.addColorStop(1, 'hsla(' + hue + ',' + sat + '%,' + light + '%,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, S, S);
    return (A.glowSprite.cache[key] = c);
  };
  A.CORE = 0.30; // fraction of the sprite radius that is solid bead
})();
