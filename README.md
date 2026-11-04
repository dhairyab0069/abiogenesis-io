# abiogenesis-io

The project page for [Abiogenesis](https://github.com/dhairyab0069/abiogenesis), a small Rust
simulation of how life could arise from non-living matter. Live at
<https://dhairyab0069.github.io/abiogenesis-io/>.

It is a static site: HTML, CSS and vanilla JavaScript, no build step, no libraries, no external
requests, no trackers, no web fonts. The hero is a live canvas "primordial soup" that follows the
same rules as the app (20 amino acids, chains of 1 to 50, mutation by substitution, insertion and
deletion, recombination by crossover, temperature-dependent Brownian motion, a watch for
`METHINKS`). Each roadmap stage has its own small animation, and a lineage tree is drawn from the
live simulation's event log.

## Run locally

```bash
python3 -m http.server 8000
# then open http://localhost:8000/
```

Any static server works, and the page also opens from `file://`.

## Layout

```
index.html           the page
assets/chem.js       DOM-free rules (mutation, crossover, METHINKS watch, event log)
assets/app.js        shared runtime: one animation loop, state, colours, helpers
assets/soup.js       the soup simulation
assets/soupview.js   canvas drawing and pointer interaction for the soup
assets/stages.js     the six stage illustrations
assets/lineage.js    the interactive lineage tree
assets/fx.js         depth layers, plankton, membranes between sections, stage tendril
assets/sound.js      synthesized sound effects (Web Audio, no files), on by default
assets/controls.js   the Sound, Motion, Effects and Quiet buttons (defaults on, versioned keys)
assets/ui.js         controls, lab notebook, reveals, intro, platform detection, boot
assets/theme.js      light / dark / auto switch, shared across the owner's sites
assets/style.css     styles
tests/chem.test.js   Node tests: node tests/chem.test.js
```

## Light, dark and auto

The page follows one setting shared across all of dhairyab0069.github.io: `localStorage.theme` is `light`, `dark` or `auto`
(absent means auto, which follows the system). The three-way switch in the bottom-right dock changes it, and a change made on
any other page or tab applies here live. Dark is the original deep-water look. Light is a pale sunlit tide pool: aqua and foam,
the soup's beads and molecules drawn darker with ordinary blending (the dark mode adds light instead), and the stage pictures,
charts and lineage tree recoloured to match. An inline script in `<head>` sets the theme before first paint; the change plays a
short circle reveal and a soft sound cue (when sound is on), and is instant when motion is reduced. Code: `assets/theme.js`
(switch and sync), `A.pal` and `A.L()` in `assets/app.js` (canvas colours), tokens at the top of `assets/style.css`.

## Sound, motion and effects

Four symbol buttons sit in the bottom-right dock beside the Light/Dark/Auto selector: **Sound** (speaker), **Motion**
(waves, pause bars when off), **Effects** (sparkle, slashed when off) and **Quiet everything** (circle with a bar), which
turns all three off and, pressed again, restores exactly what was on. They are real buttons with `aria-pressed`, a spoken
state ("Sound on") and a 44px target.

* **Defaults are on.** Motion starts off only when the system asks for reduced motion. Choices are kept in
  `localStorage` under the new keys `abio2-sound`, `abio2-motion` and `abio2-fx`.
* **Sound** is made live with the Web Audio API (no files): a voice for each kind of event in the soup, the sliders,
  Natural/Forced, the lineage tree, and each stage picture as it scrolls into view. Browsers allow audio only after a
  gesture, so it unlocks at the first click, key or touch; the intro plays silent until then.
* **Motion** replaces the old "Pause life" and "Reduce motion" buttons (they did the same thing: hold still). Off stops the
  one animation loop, draws a still frame of every canvas and cuts all CSS animation (`html[data-motion="off"]`).
* **Effects** are the decorative extras: the colour wash behind the soup, pointer halo and tap ripples, lightning flash,
  plankton, depth orbs, parallax, the membranes between sections and the pointer light on cards.

## Stages

Stages 1 to 5 are built and shown as "Built"; Stage 6 is still planned. The download section points at the latest release. The design is documented in `DESIGN.md`.

## Deploy

GitHub Pages from the repository root. All URLs are relative.
