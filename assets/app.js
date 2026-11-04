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

  /* ---------- theme: dark water or a sunlit tide pool ---------- */
  /* The page follows the shared light / dark / auto setting (theme.js sets data-theme on <html>
   * and announces `themechange`). Everything that draws to a canvas or builds SVG in JS reads
   * its colours from A.pal and A.L() at draw time, so a change only needs one redraw.
   * Dark glows by adding light ('lighter'); a pale pool cannot, so light uses ordinary blending
   * with darker, more saturated colours. */
  const PALS = {
    dark: {
      light: false, blend: 'lighter', glow: [75, 45, 0.17], bonds: 'rgba(190,240,255,0.2)',
      O: 'rgba(41,221,237,0.8)', H: 'rgba(205,245,255,0.62)', C: 'rgba(132,234,123,0.78)', H4: 'rgba(214,255,210,0.55)',
      stringL: 65, mixL: 72, flash: '#fff', del: '#ff9ad8', letter: '#04141a', tag: 'rgba(4,22,28,0.78)', tagInk: '#d6fbff',
      bolt: ['#29dded', '#bff8ff', '#ffffff'], screen: '#cfefff', screenA: 0.1, stir: '#84ea7b', ringL: 75,
      from1: '#29dded', from2: '#e648c8', rain: 'rgba(190,240,255,0.5)', water: [[188, 80, 50, 0.38], [200, 80, 30, 0.6]],
      panel: 'rgba(255,255,255,0.04)', plankton: 1, inkRGB: '190,240,255', inkGain: 1, inkFloor: 0, titleInk: '214,251,255', node: 'transparent',
    },
    light: {
      light: true, blend: 'source-over', glow: [80, 62, 0.24], bonds: 'rgba(8,90,112,0.3)',
      O: 'rgba(0,126,156,0.88)', H: 'rgba(52,142,166,0.7)', C: 'rgba(22,124,52,0.88)', H4: 'rgba(60,146,86,0.7)',
      stringL: 32, mixL: 34, flash: '#08343f', del: '#b3126f', letter: '#ffffff', tag: 'rgba(4,40,50,0.86)', tagInk: '#e9fcff',
      bolt: ['#00899f', '#1b7f90', '#06303a'], screen: '#00a0c0', screenA: 0.07, stir: '#1c8a3a', ringL: 40,
      from1: '#00798f', from2: '#b0148a', rain: 'rgba(0,104,134,0.5)', water: [[188, 75, 62, 0.4], [200, 78, 40, 0.5]],
      panel: 'rgba(6,56,68,0.05)', plankton: 0.7, inkRGB: '6,56,68', inkGain: 1.3, inkFloor: 0.75, titleInk: '4,40,50', node: 'rgba(6,56,68,0.55)',
    },
  };
  const de = document.documentElement; // (tests stub a minimal document)
  A.theme = de.getAttribute && de.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
  A.pal = PALS[A.theme];
  /* lightness: the dark palette is tuned to glow on near-black; on pale water the same hues go deeper */
  A.L = (l) => (A.theme === 'light' ? Math.round(l * 0.6) : l);
  /* text and hairlines drawn on the canvases, as rgba */
  A.ink = (a) => 'rgba(' + A.pal.inkRGB + ',' + Math.min(1, Math.max(a * A.pal.inkGain, A.pal.inkFloor)).toFixed(2) + ')';
  A.inkStrong = (a) => 'rgba(' + A.pal.titleInk + ',' + Math.min(1, Math.max(a * A.pal.inkGain, A.pal.inkFloor)).toFixed(2) + ')';

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

  /* The shared theme changed (this page, another tab, or the system in auto): swap palettes and redraw. */
  window.addEventListener('themechange', (e) => {
    const t = (e.detail && e.detail.theme) || root.getAttribute('data-theme');
    A.theme = t === 'light' ? 'light' : 'dark';
    A.pal = PALS[A.theme];
    A.bus.emit('theme', A.theme);
    if (A.frozen()) A.loop.redraw();
  });

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
    const lt = A.theme === 'light';
    const key = (lt ? 'L' : 'D') + hue + '/' + sat + '/' + light;
    A.glowSprite.cache = A.glowSprite.cache || {};
    if (A.glowSprite.cache[key]) return A.glowSprite.cache[key];
    const S = 64, c = document.createElement('canvas');
    c.width = c.height = S;
    const g = c.getContext('2d');
    const gr = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
    const body = lt ? Math.round(light * 0.62) : light, core = lt ? Math.min(70, body + 22) : 94, halo = lt ? 0.13 : 0.22;
    gr.addColorStop(0, 'hsla(' + hue + ',' + sat + '%,' + core + '%,1)');
    gr.addColorStop(0.16, 'hsla(' + hue + ',' + sat + '%,' + body + '%,1)');
    gr.addColorStop(0.30, 'hsla(' + hue + ',' + sat + '%,' + body + '%,.92)');
    gr.addColorStop(0.5, 'hsla(' + hue + ',' + sat + '%,' + body + '%,' + halo + ')');
    gr.addColorStop(1, 'hsla(' + hue + ',' + sat + '%,' + body + '%,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, S, S);
    return (A.glowSprite.cache[key] = c);
  };
  A.CORE = 0.30; // fraction of the sprite radius that is solid bead
})();
