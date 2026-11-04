/*
 * ui.js - wires the page together: controls, lab notebook, reveals, the
 * cinematic intro, platform detection for the download cards, and boot.
 *
 * Boot order matters: the notebook listens to the bus BEFORE the soup is
 * created (the soup pre-warms and logs events while doing so), and
 * A.setCalm() at the end starts the shared loop (or draws one still
 * frame when motion is reduced).
 */
(function () {
  'use strict';
  const A = window.Abio;
  const $ = (id) => document.getElementById(id);
  const root = document.documentElement;
  const clock = (t) => Math.floor(t / 60) + ':' + String(Math.floor(t % 60)).padStart(2, '0');

  /* Split the title into letters that each breathe on their own random schedule. */
  function letterize() {
    const h = $('h-title');
    const text = h.textContent;
    h.setAttribute('aria-label', text);
    h.textContent = '';
    text.split('').forEach((ch, i, all) => {
      const s = document.createElement('span');
      s.style.setProperty('--lh', String(Math.round(188 - (i / (all.length - 1)) * 228))); // cyan, green, gold, magenta
      s.className = 'l'; s.textContent = ch; s.setAttribute('aria-hidden', 'true');
      s.style.setProperty('--fd', A.rnd(5, 11).toFixed(1) + 's');
      s.style.setProperty('--fo', (-A.rnd(0, 10)).toFixed(1) + 's');
      s.style.setProperty('--fy', A.rnd(2, 6).toFixed(1) + 'px');
      h.appendChild(s);
    });
  }

  /* Each blob wobbles at its own pace, starting at a random point of its cycle. */
  function blobs() {
    document.querySelectorAll('.blob, .orb, .fig').forEach((b) => {
      b.style.setProperty('--wd', A.rnd(11, 26).toFixed(1) + 's');
      b.style.setProperty('--wo', (-A.rnd(0, 26)).toFixed(1) + 's');
    });
    document.querySelectorAll('.orb').forEach((o) => {
      o.style.setProperty('--ox', A.rnd(0, 100).toFixed(0) + '%');
      o.style.setProperty('--oy', A.rnd(0, 100).toFixed(0) + '%');
      o.style.setProperty('--dx', A.rnd(-12, 12).toFixed(1) + 'vw');
      o.style.setProperty('--dy', A.rnd(-12, 12).toFixed(1) + 'vh');
    });
  }

  /* Scroll reveals: a random-origin blob wipe, with a random stagger. */
  function reveals() {
    const els = document.querySelectorAll('.reveal');
    els.forEach((el) => {
      el.style.setProperty('--cx', A.rnd(10, 90).toFixed(0) + '%');
      el.style.setProperty('--cy', A.rnd(10, 90).toFixed(0) + '%');
      el.style.setProperty('--rd', A.rnd(0, 0.35).toFixed(2) + 's');
    });
    if (!(window.IntersectionObserver)) { els.forEach((e) => e.classList.add('in')); return; }
    const io = new IntersectionObserver((entries) => entries.forEach((en) => {
      if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); setTimeout(() => en.target.classList.add('done'), 2400); }
    }), { threshold: 0.08, rootMargin: '0px 0px -6% 0px' });
    els.forEach((e) => io.observe(e));
    document.querySelectorAll('.card').forEach((c) => c.addEventListener('pointermove', (e) => {
      const r = c.getBoundingClientRect();
      c.style.setProperty('--mx', (e.clientX - r.left) + 'px'); c.style.setProperty('--my', (e.clientY - r.top) + 'px');
    }));
  }

  /* The lab notebook: readable lines, newest first. Rare events always show;
   * routine ones are rate-limited so the notebook stays readable. */
  function notebook() {
    const log = $('log'), major = { rec: 1, spark: 1, target: 1, plant: 1 };
    let lastMinor = 0;
    function add(kind, t, msg) {
      const li = document.createElement('li');
      li.className = 'k-' + kind;
      const tm = document.createElement('time');
      tm.textContent = clock(t);
      li.appendChild(tm); li.appendChild(document.createTextNode(' ' + msg));
      log.insertBefore(li, log.firstChild);
      while (log.children.length > 40) log.removeChild(log.lastChild);
    }
    A.bus.on('log', (e) => {
      if (!major[e.kind]) {
        const now = performance.now();
        if (now - lastMinor < 650) return;
        lastMinor = now;
      }
      add(e.kind, e.t, e.msg);
    });
    A.bus.on('target', (c) => {
      $('announce').textContent = 'The sequence METHINKS emerged in chain ' + c.id + '.';
      root.classList.add('bloom'); setTimeout(() => root.classList.remove('bloom'), 5000);
    });
    add('note', 0, 'Notebook opened. Everything below is what the soup does by itself, in plain words.');
  }

  function controls(view, stages) {
    const T = $('temp'), P = $('ph');
    const sync = () => {
      A.state.temp = +T.value; A.state.ph = +P.value;
      $('temp-out').textContent = T.value + ' K'; $('ph-out').textContent = (+P.value).toFixed(1);
      A.bus.emit('env'); if (A.frozen()) A.loop.redraw();
    };
    T.addEventListener('input', sync); P.addEventListener('input', sync);
    $('btn-spark').addEventListener('click', () => view.spark());
    $('btn-drop').addEventListener('click', () => view.drop());
    $('btn-plant').addEventListener('click', () => view.plant());

    A.bus.on('motion', (s) => { if (s.calm) { const i = $('intro'); if (i) i.remove(); } });

    // the notebook starts closed on phones, where space is tight
    if (window.matchMedia('(max-width: 760px)').matches) $('notebook').removeAttribute('open');
  }

  /* Highlight the visitor's platform. A user agent cannot tell Apple Silicon
   * from Intel, so on a Mac both .dmg cards are highlighted. */
  function platform() {
    const ua = navigator.userAgent;
    let plat = null, msg = '';
    if (/Android|iPhone|iPad|iPod/i.test(ua)) { plat = 'mobile'; msg = 'Abiogenesis is a desktop app for macOS, Windows and Linux. Open this page on a computer to download it.'; }
    else if (/Mac/i.test(ua)) { plat = 'mac'; msg = 'Looks like macOS. Apple Silicon or Intel? Both disk images are highlighted.'; }
    else if (/Win/i.test(ua)) { plat = 'win'; msg = 'Looks like Windows. The setup program is highlighted.'; }
    else if (/Linux|X11|CrOS/i.test(ua)) { plat = 'bin'; msg = 'Looks like Linux. The plain binary is highlighted.'; }
    if (!plat) return;
    $('detected').textContent = msg;
    document.querySelectorAll('.dlcard').forEach((c) => {
      if (c.dataset.plat !== plat) return;
      c.classList.add('mine'); const b = c.querySelector('.badge'); if (b) b.hidden = false;
    });
    const open = { mac: 'd-mac', win: 'd-win', bin: 'd-lin' }[plat];
    if (open) $(open).setAttribute('open', '');
  }

  function alphabet() {
    const el = $('alphabet');
    el.textContent = '';
    el.setAttribute('role', 'img');
    A.chem.AMINO.split('').forEach((c) => {
      const s = document.createElement('span');
      s.className = 'bead'; s.textContent = c; s.style.setProperty('--h', A.letterHue[c]);
      el.appendChild(s);
    });
  }

  /* Fade from black through a drifting focus into the soup. Any key or tap skips it. */
  function intro() {
    const ov = $('intro');
    if (!ov) return;
    if (A.state.calm || !ov.animate) { ov.remove(); return; }
    const anims = [];
    const go = (el, frames, opt) => { const a = el.animate(frames, Object.assign({ fill: 'both' }, opt)); anims.push(a); return a; };
    go(ov, [{ opacity: 1 }, { opacity: 1, offset: 0.14 }, { opacity: 0 }], { duration: 4600, easing: 'ease-in-out' });
    go($('soup'), [{ filter: 'blur(30px)' }, { filter: 'blur(12px)', offset: 0.28 }, { filter: 'blur(20px)', offset: 0.46 }, { filter: 'blur(5px)', offset: 0.74 }, { filter: 'blur(0px)' }], { duration: 6000, easing: 'ease-out' });
    document.querySelectorAll('.title .l').forEach((l) => go(l, [{ opacity: 0, filter: 'blur(14px)' }, { opacity: 1, filter: 'blur(0px)' }], { duration: 2000, delay: A.rnd(2400, 4800), easing: 'ease-out' }));
    document.querySelectorAll('.hero-copy > :not(.title):not(.sr-only), .tray, .bar, .dock').forEach((el) =>
      go(el, [{ opacity: 0 }, { opacity: 1 }], { duration: 1800, delay: A.rnd(3800, 6200), easing: 'ease-out' }));
    const skip = () => { anims.forEach((a) => { try { a.finish(); } catch (_) { /* already done */ } }); cleanup(); };
    const cleanup = () => ['pointerdown', 'keydown'].forEach((n) => window.removeEventListener(n, skip));
    ['pointerdown', 'keydown'].forEach((n) => window.addEventListener(n, skip, { once: true }));
    anims[0].finished.then(() => { ov.remove(); }).catch(() => {});
    // release held animation styles once everything has finished
    Promise.all(anims.map((a) => a.finished)).then(() => anims.forEach((a) => { try { a.commitStyles && a.cancel(); } catch (_) { /* ignore */ } })).catch(() => {});
  }

  function boot() {
    letterize(); blobs(); reveals(); alphabet(); notebook();
    const hud = {};
    document.querySelectorAll('[data-hud]').forEach((e) => (hud[e.dataset.hud] = e));
    const view = A.makeSoupView($('soup'), hud);
    const stages = A.makeStages({ s1: $('s1'), s2: $('s2'), s3: $('s3'), s4: $('s4'), s4text: $('s4-text'), s5: $('s5') });
    A.makeStage6({ cv: $('s6'), list: $('s6-chapters'), story: $('s6-story') });
    A.makeLineage({ strip: $('lin-strip'), svg: $('lin-svg'), detail: $('lin-detail'), live: $('lin-live'), follow: $('lin-follow'), stats: $('lin-stats') });
    controls(view, stages);
    A.initFx();
    platform();
    A.setCalm(A.state.calm); // applies the attributes and starts the loop (or draws one still frame)
    intro();
  }
  boot();
})();
