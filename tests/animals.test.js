/* Node tests for the Feature 6 rules: node tests/animals.test.js */
'use strict';
const assert = require('assert');
const N = require('../assets/animals.js');

const steps = Array.from({ length: 201 }, (_, i) => i / 200);

// levels stay in range and organs only ever grow, except fins and gills, which fade out on land
steps.forEach((p) => {
  const L = N.levels(p);
  Object.keys(L).forEach((k) => assert.ok(L[k] >= 0 && L[k] <= 1, k + ' at ' + p));
});
['bilateral', 'gut', 'nerve', 'eyes', 'muscle', 'skeleton', 'jaws', 'lungs', 'limbs', 'skin'].forEach((o) => {
  let last = -1;
  steps.forEach((p) => { const v = N.levels(p)[o]; assert.ok(v >= last - 1e-9, o + ' never shrinks'); last = v; });
});
assert.ok(N.levels(0.7).gills > N.levels(1).gills, 'gills fade once the animal lives on land');
assert.ok(N.levels(0.6).fins > N.levels(1).fins, 'fins are mostly gone by the time there are limbs to stand on');

// the start is a colony: radial, no organs but a hint of gut and skin; the end is a land animal
const start = N.levels(0), end = N.levels(1);
assert.strictEqual(start.bilateral, 0);
N.ORGANS.filter((o) => o !== 'gut' && o !== 'skin').forEach((o) => assert.strictEqual(start[o], 0, o));
assert.ok(end.bilateral === 1 && end.limbs > 0.9 && end.lungs > 0.9 && end.skin > 0.9 && end.skeleton > 0.9);

// organs build on the ones they come from: each starts growing no earlier than its parts
const begins = (o) => N.SPAN[o][0];
assert.ok(begins('eyes') >= begins('nerve'), 'eyes need a nerve');
assert.ok(begins('jaws') >= Math.max(begins('gills'), begins('skeleton')), 'jaws need gills and a skeleton');
assert.ok(begins('lungs') >= begins('gut'), 'lungs bud off the gut');
assert.ok(begins('limbs') >= Math.max(begins('fins'), begins('skeleton')), 'limbs grow from bony fins');
assert.ok(begins('gut') <= begins('bilateral') + 0.05);

// the lineage moves through the zones in order, and the shore scene follows
let z = 0, x = -1;
steps.forEach((p) => { const zz = N.zoneAt(p); assert.ok(zz >= z && zz - z <= 1); z = zz; assert.ok(N.xAt(p) >= x); x = N.xAt(p); });
assert.strictEqual(N.zoneAt(0), 0); assert.strictEqual(N.zoneAt(1), 3);
assert.deepStrictEqual(N.ZONES, ['Open sea', 'Shallows', 'Tidal flats', 'Land']);
assert.ok(N.xAt(0) < 0.2 && N.xAt(1) > 0.8);

// posture: swimming in the sea, standing on land
assert.strictEqual(N.posture(0.1), 'swim');
assert.strictEqual(N.posture(1), 'stand');
assert.ok(['prop', 'stand'].includes(N.posture(0.8)));

// the story: ordered chapters, each with all four parts and a note on the model
assert.strictEqual(N.CHAPTERS.length, 9);
N.CHAPTERS.forEach((c, i) => {
  ['title', 'milestone', 'setting', 'problem', 'adaptation', 'result', 'model'].forEach((k) => assert.ok(c[k] && c[k].length > 3, c.title + ' ' + k));
  if (i) assert.ok(c.at > N.CHAPTERS[i - 1].at, 'chapters are in order');
});
assert.strictEqual(N.chapterAt(0), 0);
assert.strictEqual(N.chapterAt(1), 8);
N.CHAPTERS.forEach((c, i) => assert.strictEqual(N.chapterAt(c.at), i, c.title));

// each chapter comes when its milestone's organ is actually there in the picture
const L = (i) => N.levels(N.CHAPTERS[i].at);
assert.ok(L(1).bilateral > 0.9 && L(1).gut > 0.4);
assert.ok(L(2).nerve > 0.5 && L(2).eyes > 0.35);
assert.ok(L(3).skeleton > 0.35);
assert.ok(L(4).jaws > 0.35);
assert.ok(L(5).limbs > 0.3 && L(5).fins > 0.3);
assert.ok(L(6).lungs > 0.35);
assert.ok(N.zoneAt(N.CHAPTERS[7].at) === 2 && L(7).limbs > 0.5);
assert.ok(N.zoneAt(N.CHAPTERS[8].at) === 3 && L(8).limbs > 0.9 && L(8).lungs > 0.9);

// honest text: times are only "roughly", no digits at all, no claims of exactness
N.CHAPTERS.forEach((c) => {
  const all = [c.setting, c.problem, c.adaptation, c.result, c.model].join(' ');
  if (/million|billion/.test(all)) assert.ok(/roughly/.test(all), c.title + ' names a time without saying roughly');
  assert.ok(!/\d/.test(all), c.title + ' has a digit: the story is qualitative');
  assert.ok(!/exactly|precisely/.test(all), c.title);
});

// an organ is drawn only once it has appeared, fades in, then is opaque
assert.strictEqual(N.visible(0), 0);
assert.ok(N.visible(0.08) > 0 && N.visible(0.08) < 1);
assert.strictEqual(N.visible(0.3), 1);

console.log('animals tests passed');
