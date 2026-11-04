/*
 * fx.js - the scenery: depth layers, drifting plankton, the membranes that
 * stretch between sections, and the tendril that grows down the stage journey.
 * All of it is decoration: the Effects control (A.state.fx) switches it off, Motion stops it moving.
 *
 * Scroll is the only input that is handled outside the shared loop: parallax
 * and the tendril follow the page directly (and are switched off in calm
 * mode), while the autonomous motion (plankton, membranes) uses tickers.
 *
 * The membrane at the top of each section is an SVG path through 9 points
 * whose heights follow an Ornstein-Uhlenbeck random walk, so it never repeats.
 * Scroll velocity adds a bulge: the membrane visibly stretches while you move.
 */
(function () {
  'use strict';
  const A = window.Abio;
  const TAU = 6.283185307;
  const scroll = { y: window.scrollY, v: 0, last: window.scrollY, stretch: 0 };
  A.scroll = scroll;

  /* smooth path through points using quadratic curves between midpoints */
  function smooth(pts) {
    let d = 'M' + pts[0][0].toFixed(1) + ' ' + pts[0][1].toFixed(1);
    for (let i = 1; i < pts.length - 1; i++) {
      const mx = (pts[i][0] + pts[i + 1][0]) / 2, my = (pts[i][1] + pts[i + 1][1]) / 2;
      d += 'Q' + pts[i][0].toFixed(1) + ' ' + pts[i][1].toFixed(1) + ' ' + mx.toFixed(1) + ' ' + my.toFixed(1);
    }
    const l = pts[pts.length - 1];
    return d + 'L' + l[0].toFixed(1) + ' ' + l[1].toFixed(1);
  }

  function membranes() {
    document.querySelectorAll('svg.membrane').forEach((svg) => {
      const fill = svg.querySelector('path'), edge = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      edge.setAttribute('class', 'edge'); svg.appendChild(edge);
      const N = 9, o = Array.from({ length: N }, () => A.gauss() * 0.6), bias = A.rnd(-0.4, 0.4);
      const draw = () => {
        const pts = [];
        for (let i = 0; i < N; i++) {
          const bell = Math.sin((i / (N - 1)) * Math.PI);
          pts.push([(i / (N - 1)) * 1200, 66 + o[i] * 16 + bias * (i - N / 2) * 4 - scroll.stretch * bell * 1.1]);
        }
        const c = smooth(pts);
        fill.setAttribute('d', c + 'L1200 121L0 121Z');
        edge.setAttribute('d', c);
      };
      A.loop.add({
        el: svg,
        step(dt) { for (let i = 0; i < N; i++) o[i] += -o[i] * 0.6 * dt + A.gauss() * 0.55 * Math.sqrt(dt); },
        draw,
      });
    });
  }

  function plankton() {
    const cv = document.getElementById('plankton');
    if (!cv) return;
    let g = A.fitCanvas(cv);
    const hues = [188, 118, 320, 46];
    const S = Array.from({ length: 46 }, () => ({ x: Math.random(), y: Math.random(), z: [0.25, 0.55, 1][A.irnd(0, 2)], vx: 0, vy: 0, h: hues[A.irnd(0, 3)], r: A.rnd(5, 16) }));
    A.loop.add({
      step(dt) {
        if (!A.state.fx) return;
        for (const s of S) {
          s.vx = s.vx * 0.97 + A.gauss() * 0.0009; s.vy = s.vy * 0.97 + A.gauss() * 0.0009 - 0.0004 * s.z;
          s.x = (s.x + s.vx * dt * 60 * s.z + 1) % 1; s.y = (s.y + s.vy * dt * 60 * s.z + 1) % 1;
        }
      },
      draw() {
        const ctx = g.ctx;
        ctx.clearRect(0, 0, g.w, g.h);
        if (!A.state.fx) return;   // Effects off: no plankton
        ctx.globalCompositeOperation = A.pal.blend;
        for (const s of S) {
          const y = (((s.y * g.h - scroll.y * s.z * 0.35) % g.h) + g.h) % g.h, size = s.r * (0.6 + s.z);
          ctx.globalAlpha = (0.16 + 0.18 * s.z) * A.pal.plankton;
          ctx.drawImage(A.glowSprite(s.h, 80, 55), s.x * g.w - size, y - size, size * 2, size * 2);
        }
        ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
      },
      resize() { g = A.fitCanvas(cv); },
    });
  }

  /* The tendril: a living line through the stage knots; it grows as you scroll. */
  function journey() {
    const j = document.getElementById('journey');
    if (!j) return { update() {} };
    const svg = j.querySelector('svg.tendril'), p0 = svg.querySelector('.t0'), p1 = svg.querySelector('.t1');
    const stages = Array.from(j.querySelectorAll('.stage'));
    function build() {
      const W = j.clientWidth, H = j.clientHeight, wide = W > 820, cx = wide ? W / 2 : 20, amp = wide ? 70 : 8;
      svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
      const pts = [[cx, 0]];
      stages.forEach((s, i) => {
        const y = s.offsetTop + 26;
        if (i > 0) { const py = pts[pts.length - 1][1]; pts.push([cx + A.rnd(-amp, amp), (py + y) / 2]); }
        pts.push([cx, y]);
      });
      pts.push([cx, H]);
      const d = smooth(pts);
      p0.setAttribute('d', d); p1.setAttribute('d', d);
    }
    build();
    A.bus.on('relayout', build);
    return {
      update() {
        const r = j.getBoundingClientRect(), vh = window.innerHeight;
        const p = A.state.calm ? 1 : A.clamp((vh * 0.62 - r.top) / r.height, 0, 1);
        p1.style.strokeDashoffset = String(1 - p);
        stages.forEach((s) => s.classList.toggle('lit', A.state.calm || s.getBoundingClientRect().top < vh * 0.66));
      },
    };
  }

  A.initFx = function () {
    membranes(); plankton();
    const jr = journey();
    const layers = document.querySelectorAll('.depth .layer'), copy = document.querySelector('.hero-copy');
    let pending = false, lastT = performance.now();
    function frame() {
      pending = false;
      const now = performance.now(), dt = Math.max(0.008, (now - lastT) / 1000); lastT = now;
      const y = window.scrollY;
      scroll.v += ((y - scroll.last) / dt - scroll.v) * 0.3; scroll.last = y; scroll.y = y;
      const fancy = !A.state.calm && A.state.fx;   // parallax and the stretching membranes are Motion and Effects
      scroll.stretch = fancy ? A.clamp(Math.abs(scroll.v) * 0.025, 0, 38) : 0;
      if (fancy) {
        layers[0] && (layers[0].style.transform = 'translate3d(0,' + (-y * 0.06).toFixed(1) + 'px,0)');
        layers[1] && (layers[1].style.transform = 'translate3d(0,' + (-y * 0.15).toFixed(1) + 'px,0)');
        if (copy) { copy.style.transform = 'translate3d(0,' + (y * 0.2).toFixed(1) + 'px,0)'; copy.style.opacity = String(A.clamp(1 - y / (window.innerHeight * 0.7), 0, 1)); }
      }
      jr.update();
      if (fancy && Math.abs(scroll.v) > 20) request(); // keep easing the stretch back to rest
      else scroll.stretch = 0;
      if (A.frozen()) A.loop.redraw();
    }
    function request() { if (!pending) { pending = true; A.nextFrame(frame); } }
    window.addEventListener('scroll', request, { passive: true });
    window.addEventListener('resize', () => { A.bus.emit('relayout'); request(); });
    A.bus.on('motion', () => { if (A.state.calm || !A.state.fx) { layers.forEach((l) => (l.style.transform = '')); if (copy) { copy.style.transform = ''; copy.style.opacity = ''; } } request(); });
    request();
  };
})();
