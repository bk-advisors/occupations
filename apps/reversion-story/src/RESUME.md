# RESUME — where this build stands

Attempt 2 of the regression-to-the-mean story. Attempt 1 is untouched at
`../regression-to-the-mean.html`. Read `SPEC.md` first; it is the contract everything was built
against, including the Morgan Housel writing rules and the banned-vocabulary list.

## State: round 2 complete, harness fully green

Critic round 1 came back REJECT; its findings are in `CRITIQUE-1.md`. Five agents were dispatched
against it and **all five landed**. Every harness script now reports **zero failures, zero errors
and zero warnings**: `shoot`, `audit` (with `--selftest`), `interact`, `edge`, `spill`,
`progress`, `cite`, `empties`, plus the new `bell`.

**Critic round 2 was never run.** That is the obvious next step if you want another pass. The
brief is at `driver-backup/CRITIC-BRIEF.md` and now points at the `_flow-NN.png` slices.

### What round 2 changed, so you do not undo it

- **hero: the category error is gone.** It applied the HEIGHT correlation to Bill Gates's wealth
  z and John Adams's office-rubric z. It now plots three real pairs at their own measured child z
  and reads no correlation at all: Churchill +5.0 to +2.6 (highest office reached), Rick to Brent
  Barry +3.0 to +0.1 and Dell to Stephen Curry +0.6 to +3.3 (career points per game). The only
  arithmetic left is a subtraction inside one population. Curry is deliberately a rise from a
  parent inside the crowd, which is the piece's own "toward the mean, not downward" point.
- **The crowd is a measured Gaussian**, not a kite: sd 1.001, skew 0.022, excess kurtosis −0.091,
  half-widths within 0.04 of `exp(−z²/2)` at every width in both themes. `bell.mjs` asserts it
  and `bell.mjs --selftest` confirms it FAILS on a synthetic kite.
- **dynasties** is ONE ranked panel, no view toggle, no domain hues. 40 rows by parent sigma, open
  dot parent, filled dot child, accent for falls and grey for rises. Retention panel deleted.
- **The data does not support "most lines fall".** Measured: **20 fall, 13 rise, 7 exactly level**
  (0.50 / 0.33 / 0.17). The headline is the half-split gradient instead, and it discloses that the
  top 13 are mostly politics and business while the bottom 13 are mostly sport, so part of that
  gradient is domain rather than extremity.
- **survivors headline pointed the wrong way** and now leads with "49% of the children never clear
  the bar". The slope pair moved to a method note explaining why it moves the other way, and a
  "which number is which" strip names all five slopes in the piece.
- **board**: 12 peg rows to **7**, not the 4 or 5 the brief asked for. At five rows the pile
  measured 1.27 bins/sigma against a binomial ideal of 1.12 with a hole in the middle bin. The
  selection is now literally the far right bin (11 of 220 balls, past +1.7 sigma), because the
  prose already claimed that and the code did not.
- **theme toggle is `position: absolute`, not fixed.** A fixed control only protects the first
  screen; everything scrolled past still travels under it. `main` reserves `--chrome-h`.
- **traits** draws all eight decay curves so a still frame carries the headline's claim.
- **engine**: father starts at the mean, sons land in a stacked beeswarm not a dust cloud.
- **quiz**: guess defaults to the parent's own value, rounds ordered measured-first then most
  extreme, payoff is a five-tick signed error strip. Round 3 is deliberately a rise where the
  naive guess beats the model, and if the reader never moved the marker it says so.
- **12 prose fixes**, including two dynasties step captions that were factually false.
- Height r single-valued at **0.47**, derived from `TRAITS.height.r`.
- The **Sources** section was shipping empty under a visible heading. Now 23 formatted citations.

### Still open, deliberately

- **Critic round 2.** Not run.
- **The ceiling-raiser:** one protagonist, one ruler, one recurring mark (LeBron and Bronny on a
  single sigma strip in all eight scenes). It is why the same man carries different z values under
  different rulers. Needs a dedicated pass with no other agents running, because it touches every
  scene file.
- **Publishing.** The built file is ~576 kB, too large to read in one pass, so publish from a
  fresh session.
- **Attempt 1 still ships the wrong Galton table** (979 children, not 928).
- `RESEARCH.md` flags the three sport distribution moments as calibrated estimates rather than
  published tables.

## State

Built artifact: `../reversion-to-the-mean.html`, one self-contained file, no external requests.
Rebuild with `node build.mjs` from this folder. **Never edit the built file.**

Eight scenes: `hero`, `galton`, `engine`, `board`, `dynasties`, `traits`, `survivors`, `quiz`.

**Every harness script is at zero failures.** The first real critic pass has been dispatched and
its findings are not yet in this file.

## The harness

Lives in the session scratchpad; a copy of every durable script is in `driver-backup/` here.
It uses `puppeteer-core` against `C:/Program Files/Google/Chrome/Application/chrome.exe`.

```
node shoot.mjs      every scene, 3 widths, 2 themes: empty svgs, unfilled numbers, overflow
node audit.mjs      label collisions, text escaping its svg, struck-through labels, contrast
node audit.mjs --selftest    confirms each detector still fires on a planted bug
node interact.mjs   every control, tooltips, keyboard, theme flip, reduced motion
node edge.mjs       text flush to or past a STAGE edge, and fixed overlays
node spill.mjs      figure content height against its container
node progress.mjs   does every scrolly scene actually sweep 0 to 1
node cite.mjs       no raw citation slug reaches the page
node hero.mjs       captures shots/hero-now.png at 1440x900
```

### Harness bugs found and fixed. Do not reintroduce these.

The verification layer needed verifying more than once. Each of these made the harness report
green on a broken page, or red on a working one.

- **`page.screenshot({clip})` mixes coordinate spaces.** `boundingBox()` is page-relative;
  a clip is read against the page but the values were being taken after scrolling. Result: all
  eight "scene" screenshots were pictures of the hero, and a whole critic round was wasted on
  them. Capture through the element handle instead.
- **`mouse.move` takes VIEWPORT coordinates**, `boundingBox()` returns page coordinates. Once
  the page scrolled, every tooltip sweep aimed above the visible window and every tooltip
  reported "never appeared".
- **The scene fingerprint was blind to opacity.** A reveal moves nothing, so the survivors
  button that brings 176 dots from invisible to visible was reported as a dead control.
- **An already-active segment reported as a dead button.** Check `aria-pressed` first.
- **`html { scroll-behavior: smooth }`** in `css/02-base.css` turns a `window.scrollTo` loop
  into one animation request, so a scroll-simulating detector measures nothing at all. Any new
  detector that scrolls must set `scrollBehavior = "auto"` first. This one produced a
  confident, entirely false report that the narration was broken.

## Fixed, so it is not undone

- **Galton's tally was wrong.** Our array summed to 979 against the 928 in his 1886 Table I;
  30 of 102 cells were inflated. Corrected and cross-checked by two independent agents against
  HistData and the galton.org scan. The validation that matters: weighted OLS slope now falls
  out at **0.6463**, Galton's two-thirds, without being fitted to. r = 0.4588, and the
  mid-parent marginals reproduce the published column totals.
  **Attempt 1 still ships the bad table.**
- **Undefined design tokens.** Five scenes used `--muted`, `--accent`, `--grid`, `--gold`,
  `--dom-*`, `--font-*`, which the sheet never defined, so they fell back to hardcoded hex.
  That caused every contrast failure and stopped those labels repainting in dark mode. Aliased
  through `var()` in `css/05-integration.css`. Do not "tidy" that file.
- **`.tip` needs `data-show="true"`**, not just `hidden` removed, or it can never paint. Three
  scenes had this. Any new tooltip needs it, plus `transform: none` if it positions by its
  top-left corner.
- **Sticky scrolly retired.** Figures are 1100 to 1850px tall and an 86svh pane sliced them
  mid-sentence. They now flow full width, unpinned. Charts went 512px to 928px.
- **Narration is a trigger, not a scrubber.** An unpinned figure has no runway to scrub
  against, so `90-boot.js` runs one timed sweep on entry. `trackT()` is kept only as
  documentation of the old contract; nothing should call it again.
- **The hero grid.** `.hero` expects `.hero-inner` in row 2 but the writer's markup uses
  `.col`, so the text auto-placed into the `1fr` row and stretched the full hero. That is why
  the headline painted over the crowd. Fixed in the integration layer.
- **Legibility over artwork is a halo, not a scrim.** A scrim worked and that was the problem:
  it covered the canvas and the distribution disappeared. `text-shadow` in the paper colour,
  the same trick `RTM.txt()` uses for SVG labels.
- **Raw citation slugs reached readers** ("Source: silventoinen2003") in three scenes.
  `RTM.data.cite(id)` resolves through `SOURCES`. `cite.mjs` guards it.
- **Board physics.** The solver skipped sleeping particles when containing them to the floor
  but not when resolving ball against ball, so sleepers were pushed through the floor onto the
  axis labels. Overlapping pairs went 291 to 0, worst penetration 22% to 0%.

## Statistical framing, settled deliberately

A line fitted to 40 hand-picked famous families is not a measurement. Per-domain slopes come
out sport 0.50 and politics 0.07, the latter because nearly every political parent sits on the
top rung of the office rubric, leaving 0.72σ of spread, so the slope is noise rather than a
finding. The **dynasties** figure therefore says on its face that it is a biased convenience
sample and hands off to **survivors**, which quantifies the bias (observed slope 0.37, slope
through everything 0.72). The domains are compared on **retention**, mean child z over mean
parent z, which is stable where a slope is not: politics 85%, business 82%, sport 77%.

The "transferable advantages revert slower" thesis is carried by **traits**, on published
correlations, not by the dynasty chart. Do not let a later edit reassert an ordering the
dynasty numbers do not support.

## Not done

- **The critic loop.** One pass dispatched, findings not yet applied. Brief in
  `driver-backup/CRITIC-BRIEF.md`. Default verdict is REJECT; iterate until it stops finding
  things.
- Publishing. The file is large, so publish from a fresh session or read it in pieces.
- **Fixing the Galton table in attempt 1.**
- `RESEARCH.md` flags that the three sport distribution moments (NBA 9.0/4.8, MLB 100/17,
  NHL 0.24/0.11) are calibrated estimates rather than published tables. A Stathead pass would
  settle them.
