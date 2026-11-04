# Design: abiogenesis-io

## Purpose
The project page for Abiogenesis, a small Rust simulation of how life could arise from non-living matter. The page is not a brochure with a picture: it is a live primordial soup you can touch (water and methane molecules, amino acid chains that mutate, recombine and degrade), with the app's six stages explained in small illustrations, a lineage tree drawn from the live soup's own event log, and a download section that points at the latest release. It should feel like looking into a tide pool: alive, a little strange, never busy.

## Theme choice and why
A living, bioluminescent "primordial soup" theme: deep water, glowing beads, translucent membranes between sections, organic blob shapes, and colour taken from the app icon. Colour carries meaning: each amino acid is coloured by its chemistry class (hydrophobic green to blue, polar gold, basic magenta, acidic red). Dark is the original deep-water look; light is a pale sunlit tide pool, designed separately (the soup is drawn darker with ordinary blending, since a pale pool cannot glow by adding light).

## Tokens
| Token | Dark | Light |
|---|---|---|
| `--bg` | #020b10 | #d7f0ee |
| `--ink` | #d9fbff | #06303a |
| `--cyan` / `--c-text` | #29dded | #005f70 (as text) |
| `--green` / `--g-text` | #84ea7b | #1a6a2b (as text) |
| `--magenta` | #e648c8 | #b0148a (drawn) |
| `--gold` / `--y-text` | #fbc934 | #7a4e00 (as text) |
| `--focus` | #fbc934 | #1648b8 |
Type is a system rounded stack (Avenir Next, ui-rounded, SF Pro Rounded, system-ui). No web fonts. Radii are large and irregular (blobs); surfaces are translucent glass (`--glass`) with a hairline `--line`. Canvas colours come from one palette object (`A.pal`) per theme, read at draw time.

## Theme modes (light, dark, auto)
One setting for every page on dhairyab0069.github.io: `localStorage` key `theme` = light, dark or auto (absent means auto). An inline script in `<head>` sets `data-theme-mode` and `data-theme` before paint. `assets/theme.js` runs the three-way selector (sun, moon, half circle), follows the `storage` event and the system, and dispatches `themechange`, which swaps the canvas palette and redraws. A change is a circle-reveal View Transition (a crossfade where unsupported) with a soft cue (rising for light, sinking for dark); instant when Motion is off. Dark is the default in CSS, and a `prefers-color-scheme: light` rule covers a no-JS visitor.

## Motion spec
* One `requestAnimationFrame` loop in `assets/app.js` drives everything: the hero soup, the stage illustrations, the membranes, the plankton. Each piece registers a ticker; drawing happens only while its element is on screen; the soup's cheap logic keeps stepping off screen so charts and the lineage tree stay alive. The loop stops when the tab is hidden or Motion is off.
* The intro fades from black through a drifting focus into the soup over about 4.6 s; any key or tap skips it.
* Scroll reveals are a blob wipe from a random origin with a random stagger (1.1 to 1.7 s). Cards wobble at their own pace (11 to 26 s); the title letters breathe on random schedules. A tendril line grows down the stage journey with the scroll; membranes between sections are Ornstein-Uhlenbeck random walks that bulge with scroll speed; two depth layers move with parallax.
* Only transform, opacity and clip-path are animated by CSS; the canvases do the rest.
Gates: the Motion control sets `A.state.calm` (the one JS gate, `A.frozen()`) and `html[data-motion="off"]`: the loop stops, one still frame of every canvas is drawn on demand, reveals show at once, the intro is removed and CSS animation and transitions are cut by one rule. `prefers-reduced-motion` does the same and keeps Motion off. Effects (`A.state.fx`, `html[data-fx="off"]`) removes the decorative extras only: the colour wash behind the soup, the pointer halo and the stirring arcs, tap ripples, blooms and lightning flash, the plankton and depth orbs, parallax, the membranes between sections and the pointer light on cards. The soup itself, its mutation rings, readouts and notebook stay.

## Sound spec
Synthesized only, Web Audio, no files and no requests: oscillators and filtered noise through a compressor, master gain 0.3, at most 24 voices, per-kind rate limits. One voice per kind of event in the soup (a rising bubble for a new chain, two blips for a mutation, a gliding sixth for a recombination, a fade for a degrading chain, a thump and crackles for lightning, a bell when METHINKS emerges), tick for the sliders, natural and forced selection, picks in the lineage tree, a note per stage picture as it scrolls into view, and cues for theme change and the controls. The pentatonic scale keeps any random pick pleasant.
Sound is on by default; the context is created and resumed at the first pointerdown, keydown or touchstart (never autoplay), so the intro plays silent until then. The Sound control mutes and unmutes the engine. Nothing plays while the tab is hidden, and the soup is silent when Motion is off because it makes no events.

## Interaction inventory
* The soup: move to pull molecules in, tap to drop a chain (with a ripple when Effects are on), press and hold to stir a current, hover a chain to read its letters.
* The instruments: temperature and pH sliders; Spark (lightning), Drop a chain, Plant METHINKS; a lab notebook in plain words.
* Six stage illustrations (below). Stage 6 has a Natural/Forced selection toggle, and clicking the picture sets the target or shocks the world.
* The lineage tree: pick a chain, follow it as it mutates, click a node to re-root.
* Downloads: platform detected from the user agent (both Mac cards on a Mac, since Apple Silicon and Intel cannot be told apart), first-launch notes, links to the latest release.
* Dock (bottom right): Sound, Motion, Effects, Quiet everything, then the Light/Dark/Auto selector.

## The stages as released
1. Basic simulation: the soup above (done, in 0.3.0).
2. Environment: wet and dry pools, day and night, protocells that keep chains in (done, in 0.3.0).
3. Chemistry and emergence: lipids, nucleotides, RNA-like strands that copy themselves, catalysts, fitness (done, in 0.3.0).
4. Visualization and metrics: proteins read off RNA strands by the genetic code, the Genes and Proteins screen (an animated scene of strands forming, copying and being translated), live charts and a protein lineage (built and merged; ships in the next release).
5. Cells to complex life: cells formed from lipid bilayers that grow and divide, eukaryotes (engulfing, mitochondria, nucleus) and colonies with roles (built and merged; ships in the next release).
6. Scenario lab: planned. Its picture is a toy population, labelled as such.
The Stage 4 and 5 pictures say they are an illustration of how it works in the app. The download section always points at the latest release (0.3.0 today).

## Accessibility notes
* The four controls are real buttons with `aria-pressed` and an `aria-label` that states the state ("Sound on"), a title tooltip, a 44px target and a visible focus ring. State is shown by fill and by the glyph (slash, pause bars), not colour alone. A polite live region announces changes.
* The soup is a canvas, so a screen-reader-only paragraph explains what it does, and the readout, notebook and lineage detail carry the same information as text. A `<noscript>` block carries the key facts.
* Reduced motion is honoured in CSS and JS. Light mode text is at least 4.5:1; dark text colours are tuned on near-black.
* Pointer input has keyboard equivalents for the controls (sliders, buttons, the lineage strip); the hover reading of a chain is a pointer-only extra.

## Decisions and trade-offs
* Pause life is folded into Motion. It froze the loop and animation, which is exactly what Motion off does (it stops the loop, draws still frames and also removes reveals and the intro). Two controls that both mean "hold still" would only blur the symbol group, and the pause-bars glyph on Motion says it. Cost: a visitor cannot freeze the soup while keeping the page's reveals; they rarely need to.
* Effects and Motion are separate levels: Motion off is stillness, Effects off is a plainer soup that still moves. Pointer forces (pull, stir) stay in the soup either way because they change the simulation; only their drawing is an effect.
* Storage keys are new (`abio2-sound`, `abio2-motion`, `abio2-fx`) so an older saved "off" cannot carry over. An early inline script sets the motion and effects attributes before first paint.
* One animation loop is kept (also what makes pausing everything cheap); scroll-driven work uses `A.nextFrame` in the same file.
* Illustrations are labelled as illustrations: stage pictures are small models of how each stage works, not screenshots, and the app's replicator chart is shown as empty here because this simple soup has no strands.
* The check script's token heuristic wants a dark `prefers-color-scheme` fallback; this page defaults to dark in `:root` and uses a light media rule instead, which behaves the same.

## How to extend
* New stage: add a card in `index.html`, an illustration in `assets/stages.js` (register it with `make`), and its note to the stage sounds. Update the stage chips and this file.
* New sound: add a voice in `assets/sound.js` and call `A.sound.play('name')`; it is silent when Sound is off.
* New decorative effect: guard it with `A.state.fx` (JS) or `html[data-fx="off"]` (CSS). New motion must be driven by the loop or CSS and stop under `A.state.calm`.
* New colours: add them to both palettes (`PALS` in `assets/app.js`) and both token blocks in `assets/style.css`.
* After a change run `node tests/chem.test.js`, the skill's `check_site.js`, and look at screenshots in light and dark at 1200px and 390px.
