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
assets/stages.js     the five stage illustrations
assets/lineage.js    the interactive lineage tree
assets/fx.js         depth layers, plankton, membranes between sections, stage tendril
assets/sound.js      synthesized sound effects (Web Audio, no files), off until "Sound" is pressed
assets/ui.js         controls, lab notebook, reveals, intro, platform detection, boot
assets/style.css     styles
tests/chem.test.js   Node tests: node tests/chem.test.js
```

## Sound

The "Sound" button (bottom right, off by default, remembered in `localStorage`) turns on small
sounds made live with the Web Audio API: a voice for each kind of event in the soup (bubble, blip,
merge, fade, lightning crackle, chime when METHINKS emerges), the sliders, Pause, Natural/Forced,
the lineage tree, and each stage picture as it scrolls into view. Nothing plays while life is
paused, motion is reduced, or the tab is hidden.

## Motion and accessibility

"Pause life" freezes everything, "Reduce motion" (and the OS `prefers-reduced-motion` setting)
turns the page into calm single frames with no loops or wobble. The animation loop also stops when
the tab is hidden, and each canvas only draws while on screen.

## Deploy

GitHub Pages from the repository root. All URLs are relative.
