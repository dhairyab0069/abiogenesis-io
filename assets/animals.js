/*
 * animals.js - the DOM-free rules behind the Feature 6 illustration: a scripted,
 * simplified lineage from a colony to a land animal, and the real-history chapters
 * that follow it.
 *
 * This is an illustration of how the app's animals screen works, not the app's
 * simulation: here one lineage walks a fixed path, so the picture always shows the
 * same story. Every organ is a single number from 0 to 1 that fades in over a
 * stretch of the lineage's progress `p` (0 to 1), the creature moves from the open
 * sea through the shallows and the tidal flats onto land, and the chapters are
 * written text: a story, qualitative, with times only as "roughly".
 *
 * Loaded as a classic script. In the browser it publishes window.Abio.animals;
 * under Node it is module.exports (see tests/animals.test.js).
 */
(function (root) {
  'use strict';

  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const smooth = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
  /* 0 before `a`, 1 after `b`, smooth in between */
  const up = (p, a, b) => smooth((p - a) / (b - a));

  const ORGANS = ['gut', 'nerve', 'eyes', 'muscle', 'fins', 'skeleton', 'gills', 'jaws', 'lungs', 'limbs', 'skin'];

  /* Where each organ grows over the lineage's progress. */
  const SPAN = {
    bilateral: [0.07, 0.14], gut: [0.05, 0.22], nerve: [0.14, 0.34], eyes: [0.2, 0.38], muscle: [0.16, 0.4], gills: [0.1, 0.3],
    skeleton: [0.26, 0.5], fins: [0.2, 0.42], jaws: [0.38, 0.54], limbs: [0.5, 0.74], lungs: [0.52, 0.68], skin: [0.7, 0.9],
  };

  /* Zones along the shore and where the lineage is in each, as progress knots. */
  const ZONES = ['Open sea', 'Shallows', 'Tidal flats', 'Land'];
  const ZONE_P = [0, 0.5, 0.7, 0.86, 1];

  /* The body at progress p. Fins and gills fade again once the animal lives out of the water. */
  function levels(p) {
    p = clamp(p, 0, 1);
    const out = { bilateral: up(p, ...SPAN.bilateral) };
    ORGANS.forEach((o) => { out[o] = up(p, ...SPAN[o]); });
    out.gut = Math.max(0.1, out.gut);
    out.skin = Math.max(0.08, out.skin);
    out.gills *= 1 - 0.85 * up(p, 0.8, 0.95);
    out.fins *= 1 - 0.75 * up(p, 0.62, 0.86);
    return out;
  }

  function zoneAt(p) {
    p = clamp(p, 0, 1);
    for (let i = 0; i < 4; i++) if (p < ZONE_P[i + 1]) return i;
    return 3;
  }

  /* Where along the shore (0 to 1 of the width) the lineage is at p: through the zones in turn. */
  const X_KNOTS = [0.12, 0.4, 0.61, 0.77, 0.9];
  function xAt(p) {
    p = clamp(p, 0, 1);
    const z = zoneAt(p), f = (p - ZONE_P[z]) / (ZONE_P[z + 1] - ZONE_P[z]);
    return X_KNOTS[z] + (X_KNOTS[z + 1] - X_KNOTS[z]) * f;
  }

  /* How the animal is shown: swimming, propped on its fins or limbs, or standing. */
  function posture(p) {
    const L = levels(p), z = zoneAt(p);
    if (z === 0) return 'swim';
    if (z === 1) return L.limbs > 0.35 && L.skeleton > 0.4 ? 'prop' : 'swim';
    return L.limbs >= 0.5 ? 'stand' : L.limbs >= 0.25 ? 'prop' : 'stranded';
  }

  /* The chapters. `at` is the progress at which the matching milestone is reached. */
  const CHAPTERS = [
    { at: 0, title: 'Colonies in the sea', milestone: 'a colony of cells',
      setting: 'Warm shallow seas, with colonies of cells drifting and feeding.',
      problem: 'A colony is small and slow, and every cell has to soak up its own food and oxygen.',
      adaptation: 'Cells in a colony specialised: some fed the others, some protected, some reproduced.',
      result: 'A group of cells began to act like one body. Animals are thought to descend from colonies like these.',
      model: 'The lineage starts from just such a colony.' },
    { at: 0.16, title: 'A front, a back and a gut', milestone: 'symmetry and a gut',
      setting: 'The seas of roughly half a billion years ago, when many body plans appeared in a geologically short time.',
      problem: 'A round body has no front, so it can only wait for food to drift by.',
      adaptation: 'Bilateral symmetry: a head end, a tail end and a gut that runs through, mouth to vent.',
      result: 'Animals could crawl and swim in a direction, and eat while they digested.',
      model: 'A radial body can only grow a blind gut here; going bilateral lifts the limit. Radial animals such as jellyfish still thrive in the real sea.' },
    { at: 0.34, title: 'Eyes and a nerve cord', milestone: 'eyes and a nerve cord',
      setting: 'Seas full of newly mobile hunters and hunted.',
      problem: 'Moving toward food and away from danger is no use without knowing where they are.',
      adaptation: 'Light-sensitive patches deepened into eyes, and nerves gathered into a cord with a swelling at the head, a first brain.',
      result: 'Faster decisions: a shadow means turn away, a meal means turn toward it.',
      model: 'Eyes only grow as far as the nerve allows. Real eyes and brains have many more parts and a far longer history.' },
    { at: 0.42, title: 'A stiffening rod', milestone: 'a backbone',
      setting: 'Active swimmers in open water.',
      problem: 'A soft body can only swim so fast: muscle needs something firm to pull against.',
      adaptation: 'A flexible rod along the back (a notochord), later wrapped in cartilage and then bone.',
      result: 'Stronger, longer swimmers, and a frame that could one day carry weight.',
      model: 'One dial for the whole skeleton: the rod and the bone are two stretches of the same dial.' },
    { at: 0.5, title: 'Jaws', milestone: 'jaws',
      setting: 'Early fish without jaws, sucking and filtering their food. Jawed fish came roughly after them.',
      problem: 'A mouth that cannot bite limits what can be eaten.',
      adaptation: 'Parts of the supports that held up the gills became hinged jaws.',
      result: 'Fish could bite, grab and crush: new foods, and a new sort of predator.',
      model: 'Jaws only grow where gills and a skeleton already exist, a loose echo of jaws growing from gill supports.' },
    { at: 0.6, title: 'Fins that can push', milestone: 'limb-like fins',
      setting: 'Shallow, plant-choked waters, among them lobe-finned fish and Tiktaalik-like transitional forms, roughly three hundred and seventy million years ago.',
      problem: 'In shallow water, thin fins are poor at pushing along the bottom or past plants.',
      adaptation: 'Fins with bones inside: a strong base and joints that could bend like an elbow.',
      result: 'Fish could prop themselves up and walk a little on the bottom. The first limbs were still used in water.',
      model: 'Limbs only grow out of fins that have a skeleton. In real history limbs with digits seem to have appeared in animals that still lived in water.' },
    { at: 0.66, title: 'Breathing air', milestone: 'lungs',
      setting: 'Warm, still shallows where water holds little oxygen, and the air above holds much more.',
      problem: 'Gills starve in stale water.',
      adaptation: 'Many bony fish had lung-like organs that gulp air at the surface. Which came first is debated, and a swim bladder is a close relative.',
      result: 'A fish that can breathe air can live where water is poor in oxygen, and survive being briefly out of it.',
      model: 'Lungs bud off the gut and only help where air is within reach, which is why low-oxygen worlds change when they appear.' },
    { at: 0.78, title: 'Leaving the water', milestone: 'leaving the water',
      setting: 'Tidal flats and muddy margins, wet at high tide and drying at low tide.',
      problem: 'Stranded animals dry out, feel their full weight, and cannot swim.',
      adaptation: 'Limbs to shove along the mud, lungs to keep breathing, and skin that loses less water.',
      result: 'Short trips out of the water for food, or to escape predators, which then became longer trips.',
      model: 'The tides dry and weigh animals down. The model does not show why leaving was worth it beyond food and fewer predators; real reasons are still discussed.' },
    { at: 0.92, title: 'The first land animals', milestone: 'first land animals',
      setting: 'Open ground at the water\'s edge, with food and few large predators. The first tetrapods (four-limbed animals) came roughly three hundred and sixty million years ago.',
      problem: 'No water to hold the body up, a constant risk of drying out, and air to breathe.',
      adaptation: 'Strong limbs and a backbone to carry the body, lungs for air and a sealed, waterproof skin.',
      result: 'A new world opened to life. Their descendants include amphibians, reptiles, birds and mammals.',
      model: 'There are no eggs, no growing up and no plants here, which are all large parts of the real story.' },
  ];

  /* The chapter current at progress p: the last whose milestone has been reached. */
  function chapterAt(p) {
    let k = 0;
    CHAPTERS.forEach((c, i) => { if (p >= c.at) k = i; });
    return k;
  }

  /* Organs that are drawn at all, by name, at progress p (a level above this shows up). */
  const APPEAR = 0.04;
  const visible = (level) => (level < APPEAR ? 0 : smooth((level - APPEAR) / 0.16));

  const api = { ORGANS, SPAN, ZONES, ZONE_P, X_KNOTS, levels, zoneAt, xAt, posture, CHAPTERS, chapterAt, visible, up, clamp, APPEAR };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else { root.Abio = root.Abio || {}; root.Abio.animals = api; }
})(typeof window !== 'undefined' ? window : globalThis);
