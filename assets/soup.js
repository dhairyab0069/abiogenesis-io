/*
 * soup.js - the live primordial soup (simulation only; drawing is soupview.js).
 *
 * It follows the rules of the Rust app, using the operations in chem.js:
 *   - H2O and CH4 molecules and amino acid chains drift with temperature
 *     dependent Brownian motion (a Langevin step: damped velocity plus noise);
 *   - chains appear at random, mutate (substitution / insertion / deletion),
 *     recombine by crossover when two meet, degrade and fade;
 *   - every chain has an id and every event goes into an EventLog, which the
 *     lineage tree reads;
 *   - we watch for METHINKS.
 *
 * Nothing is metronomic: waiting times are exponential, and a slowly wandering
 * "mood" multiplies all rates so the soup has busy and quiet stretches. Rarely
 * a lightning strike condenses a flurry of new chains.
 *
 * Differences from the app, on purpose: chains move continuously instead of
 * in steps, and degradation is real (the app has the function but does not
 * use it yet). Population is capped (56 chains, 64 right after lightning).
 */
(function () {
  'use strict';
  const A = window.Abio, C = A.chem;
  const MAX_CHAINS = 56, BURST_MAX = 64, N_WATER = 34, N_METH = 22, SPACING = 9.5;
  const PLANT_WORD = C.TARGET;

  class Soup {
    constructor(w, h) {
      this.w = w; this.h = h; this.time = 0;
      this.log = new C.EventLog();
      this.chains = []; this.mols = [];
      this.fx = { rings: [], ghosts: [], blooms: [], bolts: [], flash: 0 };
      this.counts = { mut: 0, rec: 0, frag: 0, gen: 0, sight: 0 };
      this.mood = 1; this.spawnIn = 0.5; this.sparkIn = A.rnd(16, 40); this.queue = [];
      this.history = { ent: [], len: [], uniq: [], n: [] };
      this.sampleIn = 1; this.depth = 0; this.best = 0;
      this.ptr = { x: 0, y: 0, on: false, down: false, held: 0, dx: 0, dy: 0 };
      for (let i = 0; i < N_WATER + N_METH; i++) {
        this.mols.push({ k: i < N_WATER ? 'w' : 'm', x: A.rnd(0, w), y: A.rnd(0, h), vx: 0, vy: 0,
          a: A.rnd(0, 6.28), s: 0, z: A.rnd(0.7, 1.25) });
      }
      for (let i = 0; i < 20; i++) this.spawn(A.rnd(40, w - 40), A.rnd(40, h - 40), A.irnd(2, 6), true);
    }

    say(kind, msg) { A.bus.emit('log', { t: this.time, kind, msg }); }

    resize(w, h) {
      const fx = w / this.w, fy = h / this.h;
      this.chains.forEach((c) => { c.x *= fx; c.y *= fy; });
      this.mols.forEach((m) => { m.x *= fx; m.y *= fy; });
      this.w = w; this.h = h;
    }

    /* ---- chain construction ---- */
    makeChain(id, seq, x, y) {
      const c = { id, seq, x, y, vx: A.gauss() * 10, vy: A.gauss() * 10, ang: A.rnd(0, 6.28), spin: A.gauss() * 0.3,
        z: A.rnd(0.85, 1.2), age: 0, born: 0, dying: 0, cool: A.rnd(0.5, 2.5), flash: [], lt: 0, mix: null,
        planted: false, sighted: false, ph: A.rnd(0, 6.28), bias: A.rnd(-0.16, 0.16), th0: A.rnd(0, 6.28) };
      this.layout(c);
      return c;
    }
    /* Beads follow a wiggling path; stored as local coordinates around the centroid. */
    layout(c) {
      const n = c.seq.length, p = new Float32Array(2 * n);
      let x = 0, y = 0, th = c.th0, mx = 0, my = 0;
      for (let i = 0; i < n; i++) {
        p[2 * i] = x; p[2 * i + 1] = y; mx += x; my += y;
        th += c.bias + 0.42 * Math.sin(i * 0.5 + c.ph);
        x += Math.cos(th) * SPACING; y += Math.sin(th) * SPACING;
      }
      mx /= n; my /= n;
      let rad = 0;
      for (let i = 0; i < n; i++) {
        p[2 * i] -= mx; p[2 * i + 1] -= my;
        rad = Math.max(rad, Math.hypot(p[2 * i], p[2 * i + 1]));
      }
      c.pts = p; c.rad = rad + 6;
    }
    beadWorld(c, i) {
      const cs = Math.cos(c.ang), sn = Math.sin(c.ang), x = c.pts[2 * i] * c.z, y = c.pts[2 * i + 1] * c.z;
      return [c.x + x * cs - y * sn, c.y + x * sn + y * cs];
    }

    /* ---- events ---- */
    spawn(x, y, len, silent, userMade) {
      const seq = C.randomSeq(Math.random, len), id = this.log.newId();
      this.log.record({ id, type: 'gen', seq, t: this.time });
      const c = this.makeChain(id, seq, x, y);
      if (silent) c.born = 1;
      if (userMade) c.lt = 3.5;
      this.chains.push(c);
      this.counts.gen++;
      if (!silent) {
        this.fx.rings.push({ x, y, t: 0, ha: A.hueOfSeq(seq), hb: A.hueOfSeq(seq), big: false });
        this.say('gen', (userMade ? 'You dropped a chain: ' : 'A fresh chain condensed: ') + seq + ' (chain #' + id + ', ' + len + ' residue' + (len > 1 ? 's' : '') + ').');
      }
      this.check(c);
      return c;
    }

    mutate(c) {
      const res = C.mutate(c.seq, Math.random);
      if (!res) return;
      const m = res.mut, parent = c.id, id = this.log.newId();
      let ghost = null;
      if (m.type === 'del') ghost = this.beadWorld(c, m.index);
      this.log.record({ id, type: 'mut', parents: [parent], seq: res.seq, mut: m, t: this.time });
      c.id = id; c.seq = res.seq; this.layout(c);
      c.flash.push({ i: Math.min(m.index, res.seq.length - 1), t: 0, kind: m.type });
      if (ghost) this.fx.ghosts.push({ x: ghost[0], y: ghost[1], vx: A.gauss() * 25, vy: A.gauss() * 25 - 10, t: 0, hue: A.letterHue[m.residue] || 180 });
      this.counts.mut++;
      const what = m.type === 'sub' ? m.from + ' at position ' + (m.index + 1) + ' became ' + m.to
        : m.type === 'ins' ? m.residue + ' slipped in at position ' + (m.index + 1)
        : m.residue + ' at position ' + (m.index + 1) + ' dropped out';
      this.say('mut', 'Mutation: ' + what + ' (#' + parent + ' to #' + id + ', now ' + res.seq + ').');
      this.check(c);
    }

    recombine(a, b) {
      const res = C.crossover(a.seq, b.seq, Math.random);
      a.cool = b.cool = 5;
      if (!res) return;
      const id = this.log.newId(), mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      this.log.record({ id, type: 'rec', parents: [a.id, b.id], seq: res.seq, cut: res.cut, t: this.time });
      const child = this.makeChain(id, res.seq, mx, my);
      const burst = A.rnd(70, 120), dir = A.rnd(0, 6.28);
      child.vx = Math.cos(dir) * burst; child.vy = Math.sin(dir) * burst;
      const ha = A.hueOfSeq(a.seq.slice(0, res.cut[0]) || a.seq), hb = A.hueOfSeq(b.seq.slice(res.cut[1]) || b.seq);
      child.mix = { t: 1, cut: res.cut[0], ha, hb };
      child.planted = a.planted || b.planted;
      child.cool = 3;
      this.chains.push(child);
      a.vx -= Math.cos(dir) * 30; a.vy -= Math.sin(dir) * 30; b.vx += Math.cos(dir) * 30; b.vy += Math.sin(dir) * 30;
      this.fx.rings.push({ x: mx, y: my, t: 0, ha, hb, big: true });
      this.counts.rec++;
      this.say('rec', 'Recombination: #' + a.id + ' and #' + b.id + ' met and swapped pieces (cuts at ' + (res.cut[0] + 1) + ' and ' + (res.cut[1] + 1) + '). Child #' + id + ': ' + res.seq + '.');
      this.check(child);
    }

    degrade(c) {
      const res = c.seq.length >= 6 && Math.random() < 0.6 ? C.degrade(c.seq, Math.random) : null;
      if (!res) { c.dying = 0.001; this.say('deg', 'Chain #' + c.id + ' (' + c.seq + ') degraded and faded away.'); return; }
      for (let i = res.seq.length; i < c.seq.length; i++) {
        const w = this.beadWorld(c, i);
        this.fx.ghosts.push({ x: w[0], y: w[1], vx: A.gauss() * 22, vy: A.gauss() * 22, t: 0, hue: A.letterHue[c.seq[i]] || 180 });
      }
      const id = this.log.newId();
      this.log.record({ id, type: 'frag', parents: [c.id], seq: res.seq, t: this.time });
      this.say('deg', 'Chain #' + c.id + ' snapped; the tail ' + res.shed + ' drifted off and the head ' + res.seq + ' lives on as #' + id + '.');
      c.id = id; c.seq = res.seq; this.layout(c); this.counts.frag++;
    }

    /* METHINKS watch. Planted chains (and their offspring) are never counted as emergence. */
    check(c) {
      if (c.sighted || !C.containsTarget(c.seq)) return;
      c.sighted = true;
      if (c.planted) return;
      this.counts.sight++;
      const w = this.beadWorld(c, 0);
      this.fx.blooms.push({ x: w[0], y: w[1], t: 0 });
      this.say('target', 'METHINKS appeared in chain #' + c.id + ': ' + c.seq + '. (Methinks it is like a weasel: the line Dawkins used as a target.)');
      A.bus.emit('target', c);
    }
    plant(x, y) {
      const id = this.log.newId();
      this.log.record({ id, type: 'gen', seq: PLANT_WORD, t: this.time });
      const c = this.makeChain(id, PLANT_WORD, x, y);
      c.planted = true; c.sighted = true; c.lt = 6; c.born = 0.2;
      this.chains.push(c);
      this.fx.blooms.push({ x, y, t: 0, small: true });
      this.say('plant', 'You planted ' + PLANT_WORD + ' by hand (chain #' + id + '). It did not emerge by chance: chance would take about 1 in 25.6 billion tries.');
    }

    /* A lightning strike: a jagged bolt, a flash, then a flurry of new chains. */
    strike(x) {
      x = x == null ? A.rnd(this.w * 0.15, this.w * 0.85) : x;
      const y = A.rnd(this.h * 0.3, this.h * 0.75), pts = [[x + A.gauss() * 40, -10], [x, y]];
      for (let lv = 0; lv < 5; lv++) {
        const next = [];
        for (let i = 0; i < pts.length - 1; i++) {
          const a = pts[i], b = pts[i + 1], len = Math.hypot(b[0] - a[0], b[1] - a[1]);
          next.push(a, [(a[0] + b[0]) / 2 + A.gauss() * len * 0.18, (a[1] + b[1]) / 2 + A.gauss() * len * 0.1]);
        }
        next.push(pts[pts.length - 1]);
        pts.length = 0; next.forEach((p) => pts.push(p));
      }
      this.fx.bolts.push({ pts, t: 0 });
      this.fx.flash = 1;
      const n = A.irnd(5, 9);
      for (let i = 0; i < n; i++) this.queue.push({ at: this.time + A.rnd(0.15, 1.5), x: x + A.gauss() * 90, y: y + A.gauss() * 70, len: A.irnd(3, 8) });
      this.say('spark', 'Lightning struck near ' + Math.round((x / this.w) * 100) + '% across. ' + n + ' new chains are condensing.');
    }

    userSpawn(x, y) {
      if (this.chains.length >= BURST_MAX) {
        const old = this.chains.filter((c) => !c.dying).sort((p, q) => q.age - p.age)[0];
        if (old) old.dying = 0.001;
      }
      this.spawn(x, y, A.irnd(3, 6), false, true);
    }

    /* ---- physics ---- */
    langevin(p, dt, sigma, gamma) {
      const a = Math.exp(-gamma * dt), b = Math.sqrt(1 - a * a) * sigma;
      p.vx = p.vx * a + b * A.gauss(); p.vy = p.vy * a + b * A.gauss();
    }
    pointerPull(p, dt, reach) {
      const q = this.ptr;
      if (!q.on) return;
      const dx = q.x - p.x, dy = q.y - p.y, d = Math.hypot(dx, dy) || 1, R = q.down && q.held > 0.25 ? 300 : reach;
      if (d > R) return;
      const f = (1 - d / R), ux = dx / d, uy = dy / d;
      if (q.down && q.held > 0.25) { // hold: a current swirling around the cursor and following the drag
        p.vx += (-uy * 150 + q.dx * 0.5) * f * dt * 4; p.vy += (ux * 150 + q.dy * 0.5) * f * dt * 4;
      } else { // hover: gentle attraction with a little orbit so nothing collapses onto the cursor
        p.vx += (ux * 90 - uy * 40) * f * f * dt * 3; p.vy += (uy * 90 + ux * 40) * f * f * dt * 3;
      }
    }

    step(dt) {
      if (!(dt > 0)) return; // guards against NaN or negative frame times
      dt = Math.min(dt, 0.05);
      this.time += dt;
      const T = A.state.temp, tf = Math.pow(T / 300, 1.6), ph = A.state.ph;
      const phF = 1 + 0.35 * Math.pow(Math.abs(ph - 7), 1.2); // acid or base eats chains faster
      this.mood = A.clamp(this.mood + (1 - this.mood) * 0.04 * dt + 0.22 * Math.sqrt(dt) * A.gauss(), 0.4, 2.2);
      const mood = this.mood, q = this.ptr;
      if (q.down) q.held += dt; else q.held = 0;
      const live = this.chains.length;

      this.spawnIn -= dt;
      if (this.spawnIn <= 0) {
        if (live < MAX_CHAINS) this.spawn(A.rnd(50, this.w - 50), A.rnd(50, this.h - 50), A.irnd(2, 6));
        this.spawnIn = A.expo(1.7 / (tf * mood));
      }
      this.sparkIn -= dt;
      if (this.sparkIn <= 0) { this.strike(); this.sparkIn = 14 + A.expo(30); }
      while (this.queue.length && this.queue[0].at <= this.time) {
        const s = this.queue.shift();
        if (this.chains.length < BURST_MAX) this.spawn(A.clamp(s.x, 30, this.w - 30), A.clamp(s.y, 30, this.h - 30), s.len);
      }

      for (let i = 0; i < this.mols.length; i++) {
        const m = this.mols[i];
        this.langevin(m, dt, 34 * tf * m.z, 1.2);
        this.pointerPull(m, dt, 170);
        m.x += m.vx * dt; m.y += m.vy * dt; m.a += m.s * dt; m.s += (A.gauss() * 0.9 - m.s * 0.4) * dt;
        if (m.x < 8) { m.x = 8; m.vx = Math.abs(m.vx); } else if (m.x > this.w - 8) { m.x = this.w - 8; m.vx = -Math.abs(m.vx); }
        if (m.y < 8) { m.y = 8; m.vy = Math.abs(m.vy); } else if (m.y > this.h - 8) { m.y = this.h - 8; m.vy = -Math.abs(m.vy); }
      }

      const hz = dt * 0.05 * tf * mood, hd = dt * 0.036 * phF;
      for (let i = this.chains.length - 1; i >= 0; i--) {
        const c = this.chains[i], n = c.seq.length;
        c.age += dt; c.cool -= dt; if (c.lt > 0) c.lt -= dt;
        if (c.born < 1) c.born = Math.min(1, c.born + dt / 1.1);
        if (c.dying > 0) { c.dying += dt / 1.5; if (c.dying >= 1) { this.chains.splice(i, 1); continue; } }
        this.langevin(c, dt, (17 / Math.sqrt(1 + n * 0.15)) * tf * c.z, 1.5);
        this.pointerPull(c, dt, 190);
        c.x += c.vx * dt; c.y += c.vy * dt; c.ang += c.spin * dt; c.spin += (A.gauss() * 0.5 - c.spin * 0.5) * dt;
        const mg = Math.min(c.rad * 0.5, 60);
        if (c.x < mg) { c.x = mg; c.vx = Math.abs(c.vx); } else if (c.x > this.w - mg) { c.x = this.w - mg; c.vx = -Math.abs(c.vx); }
        if (c.y < mg) { c.y = mg; c.vy = Math.abs(c.vy); } else if (c.y > this.h - mg) { c.y = this.h - mg; c.vy = -Math.abs(c.vy); }
        for (let k = c.flash.length - 1; k >= 0; k--) { c.flash[k].t += dt; if (c.flash[k].t > 1.1) c.flash.splice(k, 1); }
        if (c.mix) { c.mix.t -= dt / 2.4; if (c.mix.t <= 0) c.mix = null; }
        if (c.dying) continue;
        if (Math.random() < hz) this.mutate(c);
        if (Math.random() < hd * (1 + n * 0.05)) this.degrade(c);
      }

      /* Two chains meeting may recombine (pairs are cheap: at most ~64 chains). */
      const cs = this.chains;
      for (let i = 0; i < cs.length; i++) {
        const a = cs[i];
        if (a.dying || a.born < 0.6 || a.cool > 0) continue;
        for (let j = i + 1; j < cs.length; j++) {
          const b = cs[j];
          if (b.dying || b.born < 0.6 || b.cool > 0) continue;
          const r = (a.rad + b.rad) * 0.55 + 12, dx = a.x - b.x, dy = a.y - b.y;
          if (dx * dx + dy * dy > r * r) continue;
          if (cs.length < MAX_CHAINS && Math.random() < A.clamp(0.4 * mood, 0.1, 0.8)) { if (Math.random() < 0.5) this.recombine(a, b); else this.recombine(b, a); }
          else { a.cool = b.cool = 0.8; const d = Math.hypot(dx, dy) || 1; a.vx += dx / d * 25; a.vy += dy / d * 25; b.vx -= dx / d * 25; b.vy -= dy / d * 25; }
          break;
        }
      }

      const f = this.fx;
      f.rings = f.rings.filter((r) => (r.t += dt) < 1.6);
      f.ghosts = f.ghosts.filter((g) => { g.t += dt; g.x += g.vx * dt; g.y += g.vy * dt; return g.t < 1.4; });
      f.blooms = f.blooms.filter((b) => (b.t += dt) < 6);
      f.bolts = f.bolts.filter((b) => (b.t += dt) < 0.7);
      f.flash = Math.max(0, f.flash - dt * 2.2);

      this.sampleIn -= dt;
      if (this.sampleIn <= 0) { this.sampleIn += 1; this.sample(); }
    }

    /* Once a second: record the numbers the Stage 4 charts draw and the HUD shows. */
    sample() {
      const alive = this.chains.filter((c) => !c.dying), seqs = alive.map((c) => c.seq), h = this.history;
      let tot = 0, depth = 0, best = 0;
      const uniq = new Set(seqs);
      alive.forEach((c) => {
        tot += c.seq.length;
        const e = this.log.get(c.id); if (e && e.depth > depth) depth = e.depth;
        best = Math.max(best, C.longestMatch(c.seq));
      });
      this.depth = depth; this.best = best;
      const push = (k, v) => { h[k].push(v); if (h[k].length > 120) h[k].shift(); };
      push('ent', C.residueEntropy(seqs)); push('len', alive.length ? tot / alive.length : 0);
      push('uniq', uniq.size); push('n', alive.length);
    }
  }

  A.Soup = Soup;
})();
