/*
 * sound.js - small synthesized sound effects, on by default (the Sound control mutes them).
 *
 * Everything is made on the fly with the Web Audio API (oscillators and
 * filtered noise), so there are no audio files and no requests. The sounds
 * follow the soup through the shared event bus: each kind of event in the
 * lab notebook has its own voice, the controls and the stage pictures have
 * theirs, and METHINKS emerging gets a chime. Browsers only allow audio after
 * a gesture, so the context is created and resumed at the first pointer, key or
 * touch (the intro plays silent until then). Nothing plays while the tab is hidden.
 * The soup only makes events while Motion is on, so it is silent when still.
 */
(function () {
  'use strict';
  const A = (window.Abio = window.Abio || {});
  const $ = (id) => document.getElementById(id);
  const MAX_VOICES = 24;
  const PENTA = [0, 2, 4, 7, 9]; // major pentatonic: any pick sounds pleasant

  let ctx = null, master = null, noiseBuf = null;
  let on = true, voices = 0, soupSeen = true;
  const lastAt = {};

  const hz = (note) => 261.63 * Math.pow(2, note / 12); // note 0 = middle C
  const pick = (base, octaves) => base + PENTA[Math.floor(Math.random() * PENTA.length)] + 12 * Math.floor(Math.random() * octaves);

  function ensure() {
    if (ctx) return true;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    try {
      ctx = new AC();
      const comp = ctx.createDynamicsCompressor();
      master = ctx.createGain();
      master.gain.value = 0.3;
      master.connect(comp); comp.connect(ctx.destination);
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    } catch (_) { ctx = null; return false; }
    return true;
  }

  /* may a sound play right now? */
  const ready = () => on && ctx && ctx.state === 'running' && !document.hidden;
  const quiet = (kind, gap) => { // per-kind rate limit
    const now = performance.now();
    if (now - (lastAt[kind] || 0) < gap) return true;
    lastAt[kind] = now; return false;
  };

  /* one note: o = { f, to, type, gain, dur, at, attack, vip } (vip notes ignore the voice cap) */
  function tone(o) {
    if (voices >= MAX_VOICES && !o.vip) return;
    const t0 = ctx.currentTime + (o.at || 0), dur = o.dur || 0.2, atk = o.attack || 0.008;
    const osc = ctx.createOscillator(), g = ctx.createGain();
    osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(o.f, t0);
    if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(o.gain || 0.1, t0 + atk);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g); g.connect(master);
    voices++;
    osc.onended = () => { voices--; };
    osc.start(t0); osc.stop(t0 + dur + 0.05);
  }

  /* a burst of filtered noise: o = { type, f, q, gain, dur, at } */
  function hiss(o) {
    if (voices >= MAX_VOICES) return;
    const t0 = ctx.currentTime + (o.at || 0), dur = o.dur || 0.1;
    const src = ctx.createBufferSource(), fl = ctx.createBiquadFilter(), g = ctx.createGain();
    src.buffer = noiseBuf;
    fl.type = o.type || 'bandpass'; fl.frequency.value = o.f || 3000; fl.Q.value = o.q || 1;
    g.gain.setValueAtTime(o.gain || 0.1, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(fl); fl.connect(g); g.connect(master);
    voices++;
    src.onended = () => { voices--; };
    src.start(t0, Math.random() * 0.5); src.stop(t0 + dur + 0.05);
  }

  /* ---------- the voices ---------- */
  const fx = {
    gen() { // a bubble rising
      const f = hz(pick(0, 2));
      tone({ f, to: f * 1.9, dur: 0.12, gain: 0.09 });
    },
    mut() { // two quick blips
      const n = pick(7, 2);
      tone({ f: hz(n), type: 'triangle', dur: 0.09, gain: 0.07 });
      tone({ f: hz(n + 5), type: 'triangle', dur: 0.1, gain: 0.06, at: 0.07 });
    },
    rec() { // two chains meet: a low and a high note glide to a sixth
      const n = pick(0, 1);
      tone({ f: hz(n - 5), to: hz(n), dur: 0.38, gain: 0.1 });
      tone({ f: hz(n + 12), to: hz(n + 9), dur: 0.38, gain: 0.08 });
      tone({ f: hz(n + 9), dur: 0.5, gain: 0.05, at: 0.3 });
    },
    deg() { // fading away
      hiss({ type: 'lowpass', f: 700, gain: 0.07, dur: 0.28 });
      tone({ f: 330, to: 120, dur: 0.3, gain: 0.05 });
    },
    spark() { // lightning: a thump and a few crackles
      tone({ f: 90, to: 38, dur: 0.45, gain: 0.2 });
      hiss({ type: 'highpass', f: 2500, gain: 0.18, dur: 0.07 });
      for (let i = 1; i < 6; i++) hiss({ type: 'bandpass', f: 1500 + Math.random() * 4000, q: 3, gain: 0.07 + Math.random() * 0.08, dur: 0.03 + Math.random() * 0.04, at: i * 0.05 + Math.random() * 0.06 });
    },
    plant() { // placed by hand: three rising notes
      [0, 4, 7].forEach((n, i) => tone({ f: hz(n + 12), type: 'triangle', dur: 0.3, gain: 0.09, at: i * 0.09 }));
    },
    target() { // METHINKS emerged: a bright bell
      [0, 4, 7, 12, 16].forEach((n, i) => {
        tone({ f: hz(n + 12), dur: 1.6, gain: 0.09, at: i * 0.11, attack: 0.01, vip: true });
        tone({ f: hz(n + 12) * 2.76, dur: 0.6, gain: 0.025, at: i * 0.11, vip: true });
      });
    },
    tick(v) { tone({ f: 260 + v * 700, type: 'triangle', dur: 0.05, gain: 0.05, attack: 0.003 }); },
    pick(id) { tone({ f: hz(PENTA[id % 5] + 12 * (1 + (id % 2))), dur: 0.16, gain: 0.07 }); },
    ping() { tone({ f: 880, dur: 0.5, gain: 0.07 }); tone({ f: 1320, dur: 0.3, gain: 0.03 }); },
    stage(n) { tone({ f: hz(PENTA[n % 5] + 12), type: 'triangle', dur: 0.8, gain: 0.06, attack: 0.03 }); tone({ f: hz(PENTA[n % 5] + 24), dur: 0.8, gain: 0.025, attack: 0.03 }); },
    themeLight() { tone({ f: hz(12), dur: 0.5, gain: 0.05, attack: 0.02 }); tone({ f: hz(19), dur: 0.6, gain: 0.04, at: 0.07, attack: 0.02 }); tone({ f: hz(24), dur: 0.7, gain: 0.025, at: 0.14, attack: 0.02 }); }, // sunlight on water
    themeDark() { tone({ f: hz(7), to: hz(0), dur: 0.5, gain: 0.06, attack: 0.03 }); hiss({ type: 'lowpass', f: 500, gain: 0.04, dur: 0.3 }); },       // sinking below the surface
    on() { tone({ f: hz(0), dur: 0.18, gain: 0.07 }); tone({ f: hz(7), dur: 0.26, gain: 0.07, at: 0.1 }); },
    off() { tone({ f: hz(7), dur: 0.18, gain: 0.07 }); tone({ f: hz(0), dur: 0.26, gain: 0.07, at: 0.1 }); },
  };

  function play(name, arg) {
    if (!ready()) return;
    try { fx[name](arg); } catch (_) { /* audio must never break the page */ }
  }

  /* ---------- wiring ---------- */
  const gaps = { gen: 130, mut: 170, rec: 320, deg: 220 };
  function wireSoup() {
    A.bus.on('log', (e) => {
      if (e.kind === 'target') return play('target'); // heard wherever the visitor is
      if (!soupSeen || !fx[e.kind]) return;
      if (gaps[e.kind] && quiet(e.kind, gaps[e.kind])) return;
      play(e.kind);
    });
    if (window.IntersectionObserver && $('soup')) {
      new IntersectionObserver((en) => { soupSeen = en[en.length - 1].isIntersecting; }, { threshold: 0.05 }).observe($('soup'));
    }
  }

  function wireControls() {
    const T = $('temp'), P = $('ph');
    [T, P].forEach((el) => el.addEventListener('input', () => {
      if (quiet('tick', 70)) return;
      play('tick', (+el.value - +el.min) / (+el.max - +el.min));
    }));
    $('lin-strip').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) play('pick', +b.dataset.id); });
    $('lin-svg').addEventListener('click', (e) => { const g = e.target.closest('.node'); if (g) play('pick', +g.dataset.id); });
    // each stage picture chimes its own note as it comes into view
    if (window.IntersectionObserver) {
      const io = new IntersectionObserver((en) => en.forEach((x) => {
        if (x.isIntersecting && !quiet('stage', 900)) play('stage', +x.target.id.slice(1));
      }), { threshold: 0.6 });
      ['s1', 's2', 's3', 's4', 's5'].forEach((id) => io.observe($(id)));
    }
  }

  /* Audio unlocks at the first pointer, key or touch (no autoplay): create and resume the context then. */
  function wireUnlock() {
    const wake = () => { if (ensure() && ctx.state === 'suspended') ctx.resume().catch(() => {}); };
    ['pointerdown', 'keydown', 'touchstart'].forEach((n) => window.addEventListener(n, wake, { once: true, capture: true }));
    document.addEventListener('visibilitychange', () => { if (!document.hidden) wake(); });
    A.sound.wake = wake;
  }

  function boot() { wireUnlock(); wireSoup(); wireControls(); }
  /* controls.js drives setEnabled (the Sound button and Quiet everything) */
  A.sound = { play, setEnabled(b) { on = !!b; if (on && ctx && ctx.state === 'suspended') ctx.resume().catch(() => {}); } };
  boot();
})();
