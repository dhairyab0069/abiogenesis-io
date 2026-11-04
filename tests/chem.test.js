/* Node tests for the DOM-free rules: node tests/chem.test.js */
'use strict';
const assert = require('assert');
const C = require('../assets/chem.js');

function mulberry32(a) { return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const rng = mulberry32(42);

// alphabet
assert.strictEqual(C.AMINO, 'ARNDCQEGHILKMFPSTWYV');
assert.strictEqual(new Set(C.AMINO).size, 20);
assert.strictEqual(C.TARGET, 'METHINKS');

// substitution changes exactly one residue
for (let i = 0; i < 500; i++) {
  const s = C.randomSeq(rng, 1 + (i % 20)), r = C.substitute(s, rng);
  assert.strictEqual(r.seq.length, s.length);
  assert.strictEqual(r.seq[r.mut.index], r.mut.to);
  assert.strictEqual(s[r.mut.index], r.mut.from);
  assert.strictEqual(r.seq.slice(0, r.mut.index) + s[r.mut.index] + r.seq.slice(r.mut.index + 1), s);
}
// insertion and deletion are inverses of each other's bookkeeping and respect 1..50
for (let i = 0; i < 500; i++) {
  const s = C.randomSeq(rng, 1 + (i % 30));
  const a = C.insert(s, rng);
  assert.strictEqual(a.seq.length, s.length + 1);
  assert.strictEqual(a.seq.slice(0, a.mut.index) + a.seq.slice(a.mut.index + 1), s);
  const d = C.remove(s, rng);
  if (s.length === 1) assert.strictEqual(d, null);
  else { assert.strictEqual(d.seq.length, s.length - 1); assert.strictEqual(d.seq.slice(0, d.mut.index) + d.mut.residue + d.seq.slice(d.mut.index), s); }
}
assert.strictEqual(C.insert('A'.repeat(50), rng), null, 'never grows past 50');
assert.strictEqual(C.substitute('', rng), null);

// crossover: head of a + tail of b, cut points in range, length clamped
for (let i = 0; i < 500; i++) {
  const a = C.randomSeq(rng, 1 + (i % 40)), b = C.randomSeq(rng, 1 + ((i * 7) % 50)), r = C.crossover(a, b, rng);
  const [p1, p2] = r.cut;
  assert(p1 >= 0 && p1 < a.length && p2 >= 0 && p2 < b.length);
  assert.strictEqual(r.seq, (a.slice(0, p1) + b.slice(p2)).slice(0, 50));
  assert(r.seq.length >= 1 && r.seq.length <= 50);
}
assert.strictEqual(C.crossover('', 'AAA', rng), null);

// degrade keeps a non-empty head
for (let i = 0; i < 200; i++) {
  const s = C.randomSeq(rng, 2 + (i % 20)), r = C.degrade(s, rng);
  assert(r.seq.length >= 1 && r.seq + r.shed === s);
}
assert.strictEqual(C.degrade('A', rng), null);

// METHINKS detection and progress meter
assert(C.containsTarget('AAMETHINKSAA'));
assert(!C.containsTarget('METHINK'));
assert.strictEqual(C.longestMatch('METHINKS'), 8);
assert.strictEqual(C.longestMatch('AAMETHAA'), 4);
assert.strictEqual(C.longestMatch('WWW'), 0);
assert.strictEqual(C.longestMatch('KSXME'), 2);

// entropy: one letter = 0 bits, all 20 equally = log2(20)
assert.strictEqual(C.residueEntropy(['AAAA']), 0);
assert(Math.abs(C.residueEntropy([C.AMINO]) - Math.log2(20)) < 1e-9);
assert.strictEqual(C.residueEntropy([]), 0);

// event log: depth and ancestors
const L = new C.EventLog();
const a = L.newId(), b = L.newId(), c = L.newId(), d = L.newId();
L.record({ id: a, type: 'gen', seq: 'AB' });
L.record({ id: b, type: 'gen', seq: 'CD' });
L.record({ id: c, type: 'rec', parents: [a, b], seq: 'AD', cut: [1, 1] });
L.record({ id: d, type: 'mut', parents: [c], seq: 'AE', mut: { type: 'sub', index: 1, from: 'D', to: 'E' } });
assert.strictEqual(L.get(d).depth, 2);
const anc = L.ancestors(d);
assert.deepStrictEqual(anc.nodes.map((n) => n.id).sort(), [a, b, c, d].sort());
assert.strictEqual(L.ancestors(d, 1).nodes.length, 2);
assert(L.ancestors(d, 1).truncated);
const small = new C.EventLog(3);
for (let i = 1; i <= 5; i++) small.record({ id: small.newId(), type: 'gen', seq: 'A' });
assert.strictEqual(small.map.size, 3, 'log is capped');

console.log('chem: all assertions passed');

// ---- smoke test of the whole soup, with the browser stubbed out ----
global.window = global;
global.document = { documentElement: { classList: { toggle() {}, add() {} } }, addEventListener() {}, hidden: false };
window.addEventListener = () => {};
window.Abio = { chem: C }; // chem.js was loaded as a Node module above
require('../assets/app.js');
require('../assets/soup.js');
const A = window.Abio;
const lines = [];
A.bus.on('log', (e) => lines.push(e));
const soup = new A.Soup(1200, 700);
for (let i = 0; i < 20 * 600; i++) soup.step(0.05); // 10 simulated minutes
const ids = new Set();
soup.chains.forEach((ch) => {
  assert(ch.seq.length >= 1 && ch.seq.length <= 50, 'chain length bounds');
  assert(/^[ARNDCQEGHILKMFPSTWYV]+$/.test(ch.seq), 'alphabet');
  assert(!ids.has(ch.id), 'unique ids'); ids.add(ch.id);
  assert(Number.isFinite(ch.x) && Number.isFinite(ch.y) && ch.x >= 0 && ch.x <= 1200 && ch.y >= 0 && ch.y <= 700, 'in bounds');
  const e = soup.log.get(ch.id); assert(e && e.seq === ch.seq, 'log matches chain');
});
assert(soup.chains.length <= 64, 'population cap');
assert(soup.mols.length === 56 && soup.mols.every((m) => Number.isFinite(m.x)), 'small molecules intact');
assert(soup.counts.mut > 0 && soup.counts.rec > 0 && soup.counts.gen > 0, 'events happen: ' + JSON.stringify(soup.counts));
assert(lines.some((l) => l.kind === 'spark'), 'lightning happens');
assert(soup.history.ent.length === 120, 'history window');
soup.plant(600, 300);
assert(soup.chains.some((ch) => ch.seq === 'METHINKS' && ch.planted));
assert.strictEqual(soup.counts.sight, 0, 'planting is not emergence');
console.log('soup: ' + JSON.stringify(soup.counts) + ', alive ' + soup.chains.length + ', max depth ' + soup.depth + ', log ' + soup.log.map.size);

// Shared light / dark / auto theme: the key, an early inline script before the stylesheet, and the radiogroup exist.
{
  const html = require('fs').readFileSync(require('path').join(__dirname, '..', 'index.html'), 'utf8');
  const early = html.indexOf("localStorage.getItem('theme')");
  assert.ok(early > 0 && early < html.indexOf('rel="stylesheet"'), 'early theme script must precede the stylesheet');
  assert.ok(html.includes('role="radiogroup" aria-label="Color theme"'));
  assert.strictEqual((html.match(/data-theme-mode="(light|dark|auto)"/g) || []).length, 3);
}

// Hygiene: the four symbol controls exist and default on, new versioned keys, quiet restores, no external requests.
{
  const fs = require('fs'), path = require('path');
  const root = path.join(__dirname, '..'), html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  for (const id of ['sound', 'motion', 'fx', 'quiet']) {
    assert.ok(new RegExp('id="dw-' + id + '"[^>]*aria-pressed="' + (id === 'quiet' ? 'false' : 'true') + '"').test(html), 'control ' + id);
  }
  const ctl = require('../assets/controls.js');
  assert.deepStrictEqual(ctl.resolveDefaults({}, false), { sound: true, motion: true, fx: true });
  assert.strictEqual(ctl.resolveDefaults({ motion: 'off' }, false).motion, false);
  assert.strictEqual(ctl.resolveDefaults({}, true).motion, false, 'reduced motion starts motion off');
  const q = ctl.quietStep({ sound: true, motion: true, fx: false }, null, false);
  assert.deepStrictEqual(q.next, { sound: false, motion: false, fx: false });
  assert.deepStrictEqual(ctl.quietStep(q.next, q.prev, false).next, { sound: true, motion: true, fx: false }, 'quiet restores exactly');
  assert.ok(/keyPrefix = 'abio2'/.test(fs.readFileSync(path.join(root, 'assets', 'controls.js'), 'utf8')));
  const files = ['index.html'].concat(fs.readdirSync(path.join(root, 'assets')).filter((f) => /\.(js|css)$/.test(f)).map((f) => 'assets/' + f));
  files.forEach((f) => {
    const t = fs.readFileSync(path.join(root, f), 'utf8').replace(/<link rel="canonical"[^>]*>|<meta (property|name)="(og|twitter):[^>]*>/g, '');
    assert.ok(!/<(script|img|iframe)[^>]*src=["']https?:\/\/|<link[^>]*href=["']https?:\/\/|url\(["']?https?:|fetch\(["']https?:/.test(t), 'external request in ' + f);
  });
}
console.log('controls ok');
