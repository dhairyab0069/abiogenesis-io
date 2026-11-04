/* Shared light / dark / auto theme (one protocol on every dhairyab0069.github.io site).
   localStorage 'theme' = 'light' | 'dark' | 'auto' (absent = auto). The inline script in <head>
   sets data-theme-mode and data-theme before first paint; this file runs the three-way control,
   syncs other tabs and pages, follows the system in auto, and announces `themechange`. */
(function (root) {
  'use strict';
  var KEY = 'theme', html = document.documentElement;
  var mq = root.matchMedia ? root.matchMedia('(prefers-color-scheme: dark)') : { matches: false };
  var META = { light: '#d7f0ee', dark: '#020b10' };
  var FADE_MS = 520;

  function norm(m) { return m === 'light' || m === 'dark' ? m : 'auto'; }
  function resolve(m) { return m === 'auto' ? (mq.matches ? 'dark' : 'light') : m; }
  function motionOn() { return (function () { var s = root.Abio && root.Abio.state; return s ? !s.calm : !(root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches); })(); }
  function cue(t) { try { root.Abio.sound.play(t === 'light' ? 'themeLight' : 'themeDark'); } catch (e) { /* sound unavailable */ } }

  var mode = norm(html.getAttribute('data-theme-mode'));
  var theme = html.getAttribute('data-theme') || resolve(mode);
  var sws = [].slice.call(document.querySelectorAll('.theme-switch'));
  var sw = sws[0];

  function visible() { for (var i = 0; i < sws.length; i++) if (sws[i].offsetParent !== null || sws[i].getClientRects().length) return sws[i]; return sw; }
  function paint() {
    html.setAttribute('data-theme', theme);
    html.setAttribute('data-theme-mode', mode);
    html.style.colorScheme = theme;
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', META[theme]);
    sws.forEach(function (w) { [].forEach.call(w.querySelectorAll('[data-mode]'), function (b) {
      b.setAttribute('aria-checked', String(b.getAttribute('data-mode') === mode));
      b.tabIndex = b.getAttribute('data-mode') === mode ? 0 : -1;
    }); });
  }
  function announce() {
    try { root.dispatchEvent(new CustomEvent('themechange', { detail: { mode: mode, theme: theme } })); } catch (e) { /* old browser */ }
  }

  /* Runs commit() (which changes the theme) inside a short circle-reveal View Transition from
     `origin`, or a crossfade; instantly when motion is off. */
  function transition(commit, origin) {
    if (!motionOn()) { commit(); return; }
    if (document.startViewTransition) {
      var r = (origin || visible() || html).getBoundingClientRect();
      var x = r.left + r.width / 2, y = r.top + r.height / 2;
      var rad = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y)) + 40;
      var vt = document.startViewTransition(commit);
      vt.ready.then(function () {
        html.animate({ clipPath: ['circle(0px at ' + x + 'px ' + y + 'px)', 'circle(' + rad + 'px at ' + x + 'px ' + y + 'px)'] },
          { duration: FADE_MS, easing: 'cubic-bezier(.3,.1,.2,1)', fill: 'both', pseudoElement: '::view-transition-new(root)' });
      }).catch(function () {});
      return;
    }
    html.classList.add('theme-switching');
    commit();
    setTimeout(function () { html.classList.remove('theme-switching'); }, FADE_MS + 40);
  }

  function apply(nextMode, origin, silent) {
    nextMode = norm(nextMode);
    var nextTheme = resolve(nextMode);
    var changed = nextTheme !== theme;
    mode = nextMode;
    if (!changed) { paint(); announce(); return; }
    transition(function () { theme = nextTheme; paint(); announce(); }, origin);
    if (!silent) cue(nextTheme);
  }

  function choose(next, origin) {
    next = norm(next);
    if (next === mode) return;
    try { localStorage.setItem(KEY, next); } catch (e) { /* storage blocked */ }
    apply(next, origin, false);
  }

  function init() {
    paint();
    sws.forEach(function (w) {
      w.addEventListener('click', function (e) {
        var b = e.target.closest ? e.target.closest('[data-mode]') : null;
        if (b) choose(b.getAttribute('data-mode'), b);
      });
      w.addEventListener('keydown', function (e) {
        var step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
        if (!step) return;
        var all = [].slice.call(w.querySelectorAll('[data-mode]'));
        var n = all[(all.indexOf(document.activeElement) + step + all.length) % all.length];
        n.focus(); choose(n.getAttribute('data-mode'), n); e.preventDefault();
      });
    });
    /* another page or tab on this origin changed the setting */
    root.addEventListener('storage', function (e) {
      if (e.key !== KEY && e.key !== null) return;
      apply(norm(e.key === null ? null : e.newValue), null, true);
    });
    /* system change while in auto */
    var onSys = function () { if (mode === 'auto') apply('auto', visible() && visible().querySelector('[data-mode="auto"]'), false); };
    if (mq.addEventListener) mq.addEventListener('change', onSys); else if (mq.addListener) mq.addListener(onSys);
    announce();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
  root.SiteTheme = { get mode() { return mode; }, get theme() { return theme; }, set: choose };
})(window);
