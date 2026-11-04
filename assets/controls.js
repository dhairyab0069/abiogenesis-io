/*
 * controls.js - the four global symbol controls: Sound, Motion, Effects and Quiet everything.
 *
 * DEFAULTS ARE ON. Motion starts off only when the system asks for reduced motion (and then stays off).
 *   Sound   mutes or unmutes the synthesized engine (audio itself unlocks at the first pointer, key or touch).
 *   Motion  is the single JS gate for every loop, the soup, the stage pictures and the intro
 *           (A.state.calm); CSS follows html[data-motion="off"]. Off draws one still frame.
 *   Effects are the decorative extras (A.state.fx, html[data-fx="off"]): soup glow, pointer halo and
 *           tap ripples, lightning flash, plankton and depth orbs, parallax, the membranes between
 *           sections and the light that follows the pointer on cards. The soup's own feedback stays.
 *   Quiet   turns all three off and, pressed again, restores exactly the previous state.
 * State is kept under fresh versioned keys (abio2-sound / -motion / -fx) so an old saved "off" cannot carry over.
 * resolveDefaults and quietStep are pure and exported for the tests.
 */
(function (root) {
  'use strict';

  /* stored: { sound, motion, fx } as 'on' | 'off' | null. Returns booleans. */
  function resolveDefaults(stored, reduced) {
    stored = stored || {};
    return { sound: stored.sound !== 'off', motion: reduced ? false : stored.motion !== 'off', fx: stored.fx !== 'off' };
  }
  /* Quiet everything: if anything is on, remember the state and turn all off; if all are off, restore it. */
  function quietStep(cur, prev, reduced) {
    const allOff = !cur.sound && !cur.motion && !cur.fx;
    if (!allOff) return { next: { sound: false, motion: false, fx: false }, prev: { sound: cur.sound, motion: cur.motion, fx: cur.fx } };
    const p = prev && (prev.sound || prev.motion || prev.fx) ? prev : { sound: true, motion: true, fx: true };
    return { next: { sound: p.sound, motion: reduced ? false : p.motion, fx: p.fx }, prev: null };
  }
  const pure = { resolveDefaults, quietStep };
  if (typeof module !== 'undefined' && module.exports) { module.exports = pure; return; }

  const A = root.Abio;
  const keyPrefix = 'abio2';
  const mq = root.matchMedia ? root.matchMedia('(prefers-reduced-motion: reduce)') : null;
  const reduced = () => !!(mq && mq.matches);
  const load = (n) => { try { return localStorage.getItem(keyPrefix + '-' + n); } catch (e) { return null; } };
  const save = (n, v) => { try { localStorage.setItem(keyPrefix + '-' + n, v ? 'on' : 'off'); } catch (e) { /* storage blocked: fine */ } };
  const $ = (id) => document.getElementById(id);
  const els = { sound: $('dw-sound'), motion: $('dw-motion'), fx: $('dw-fx'), quiet: $('dw-quiet') };
  const say = (m) => { const l = $('dw-live'); if (l) l.textContent = m; };
  let state = resolveDefaults({ sound: load('sound'), motion: load('motion'), fx: load('fx') }, reduced()), prev = null;

  function paintBtn(b, on, name, extra) {
    if (!b) return;
    b.setAttribute('aria-pressed', String(on));
    b.setAttribute('aria-label', name + (on ? ' on' : ' off'));
    b.title = name + (on ? ' on. Press to turn off.' : ' off. Press to turn on.') + (extra || '');
  }
  function paint() {
    paintBtn(els.sound, state.sound, 'Sound');
    paintBtn(els.motion, state.motion, 'Motion', reduced() ? ' Your system asks for reduced motion, so motion stays off.' : '');
    paintBtn(els.fx, state.fx, 'Effects');
    if (els.quiet) els.quiet.setAttribute('aria-pressed', String(!state.sound && !state.motion && !state.fx));
  }
  function apply(next, persist) {
    state = { sound: next.sound, motion: next.motion, fx: next.fx };
    A.sound.setEnabled(state.sound);
    A.state.fx = state.fx; A.setCalm(!state.motion);   // one call applies the attributes, redraws or restarts the loop
    if (persist) { save('sound', state.sound); save('motion', state.motion); save('fx', state.fx); }
    paint();
  }
  function flip(k, label) {
    if (k === 'motion' && reduced()) { say('Your system asks for reduced motion, so motion stays off.'); return; }
    const next = { sound: state.sound, motion: state.motion, fx: state.fx };
    next[k] = !next[k]; apply(next, true);
    A.sound.play(next[k] ? 'on' : 'off');
    say(label + (next[k] ? ' on.' : ' off.'));
  }
  if (els.sound) els.sound.addEventListener('click', () => flip('sound', 'Sound'));
  if (els.motion) els.motion.addEventListener('click', () => flip('motion', 'Motion'));
  if (els.fx) els.fx.addEventListener('click', () => flip('fx', 'Effects'));
  if (els.quiet) els.quiet.addEventListener('click', () => {
    const r = quietStep(state, prev, reduced()); prev = r.prev; apply(r.next, true);
    A.sound.play(r.next.sound ? 'on' : 'off');
    say(r.next.sound || r.next.motion || r.next.fx ? 'Sound, motion and effects are back.' : 'Everything is quiet: sound, motion and effects are off.');
  });
  /* the system starts asking for reduced motion while the page is open: motion goes off */
  if (mq && mq.addEventListener) mq.addEventListener('change', (e) => { if (e.matches) { apply({ sound: state.sound, motion: false, fx: state.fx }, false); } });

  apply(state, false);
  A.controls = { state: () => state };
})(typeof window !== 'undefined' ? window : globalThis);
