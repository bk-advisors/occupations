# SPEC — "Reversion" data story (attempt 2)

Read this whole file before writing a line. Every agent on this build codes against it.

## What we are making

A single self-contained HTML page: a scrollytelling visual essay about **regression to the
mean**, told through the children of famous athletes, politicians and business founders.
The bar is *The Pudding* at its best. Not "a good chart page". A piece someone forwards.

The first attempt lives at `../regression-to-the-mean.html`. Read it. It is competent and
static. Everything here must be better: motion, physics, texture, interaction, breadth of
data, and above all the writing.

## Hard constraints

1. **One file, zero external requests.** The page is published as a Claude Artifact under a
   strict CSP. No CDN, no `<script src>`, no `<link href="http...">`, no `@import url()`,
   no remote font, no remote image. Everything is inline or a `data:` URI. **No D3.** The
   helpers you need are in `js/00-core.js` and `js/01-motion.js`.
2. **Build with `node build.mjs`** from `data-story/reversion/`. It concatenates
   `css/*.css` (sorted) + `shell.html` + `js/*.js` (sorted) into
   `../reversion-to-the-mean.html`. Filename prefixes control order. Never edit the built
   file; edit sources and rebuild.
3. **You own only the files listed in your brief.** Do not create, edit or delete any other
   file. Eight agents are working in this folder at once.
4. **`var` and `function`, ES5-safe style, IIFE modules.** No `import`/`export` in `js/`,
   no top-level `let` leaking, no optional chaining in code that must run on older Safari.
   Arrow functions and template literals are fine.

## House writing rules (these get the piece rejected if broken)

- **No em-dashes.** Not one, anywhere, in prose, labels, captions, tooltips or alt text.
  Use a full stop, a comma, a colon, or parentheses. Rewrite the sentence if you must.
- **No AI tells.** Banned outright: "delve", "tapestry", "landscape" (figurative),
  "navigate" (figurative), "unlock", "testament to", "in a world where", "it's not just X,
  it's Y", "isn't merely", "moreover", "furthermore", "crucial to note", "stands as",
  "underscores", "highlights the importance", "a stark reminder", "profound", "seamless",
  "robust" (unless statistical), "leverage" (as a verb), "journey" (figurative),
  "at its core", "the reality is". No sentence that opens with a participial windup
  ("Having established that...").
- **Register: Morgan Housel.** Short declarative sentences. Plain words over technical ones.
  A concrete story before the principle, never after. Paragraphs of two or three sentences.
  Comfortable with a one-sentence paragraph. Numbers used sparingly and precisely. Humble
  about what is known. Ends sections on a flat, quiet line rather than a flourish.
- **No hype adjectives on our own work.** Never "stunning", "beautiful", "powerful" about a
  chart. Let it be those things.
- Straight apostrophes are fine in code; use typographic ones (’ “ ”) in prose.
- Prime marks for measurements: `6′ 1.5″`, not `6' 1.5"`.

## The unit of the whole piece: sigma

Every person in the data is placed as a **z score above the mean of a named reference
population**. That is the only honest way a quarterback, a prime minister and a department
store fortune share one axis. Where the placement is a judgement rather than a measurement,
the piece says so in the figure itself, not in a footnote.

## The spine (8 scenes, fixed)

| # | scene id | What it does |
|---|----------|--------------|
| 0 | `hero` | Full-bleed canvas particle field. A population curve of dots; a few named outliers pull out to the right; their children's dots fall and drift back toward the centre. Title sits over it. |
| 1 | `galton` | Galton's 928 children. Dots rain in, the `y = x` line draws, then flattens into the fitted line while a counter runs the slope from 1.00 down to the real value. Hover reads a bin. |
| 2 | `engine` | Drag a father's height. Spring-driven marker; the son distribution redraws live. A "sample a son" control drops real sampled sons as falling particles that pile up. |
| 3 | `traits` | The r board. Height, IQ, earnings, wealth, surname status, lifespan. Pick one, watch an advantage decay across generations. Half-life = ln(0.5)/ln(r). |
| 4 | `dynasties` | The centrepiece. Parent z against child z for every pair, across sport, politics and business. Slope chart and scatter, toggleable. Filter by domain. The fitted slope is well under 1. Hover gives the pair's story. |
| 5 | `board` | A real Galton board. Balls fall through pegs under gravity, pile into bins, build a normal curve. Then the twist: keep only the far-right balls, drop their children from there, watch the children re-centre. |
| 6 | `survivors` | The children you never hear about. The visible pairs, then the invisible ones revealed. |
| 7 | `quiz` | The reader predicts a child's z from a parent's, five rounds, scored. Reveals that almost everyone guesses too high. |

## Scene contract

`shell.html` provides an empty mount for each scene:

```html
<div class="stage" data-scene="galton" data-track="scrolly"></div>
```

Your scene module registers itself and builds **everything inside that mount**, including
its own controls, legend, caption and accessible table. The writer agent does not supply
control markup. Never reach outside your mount.

```js
RTM.scene("galton", function (mount) {
  // build DOM once here
  return {
    draw:     function (w) { /* (re)layout at measured px width w */ },
    progress: function (t) { /* optional, 0..1 while the scrolly track is in view */ },
    destroy:  function () { /* required if you start a ticker, spring, or listener */ }
  };
});
```

`draw(w)` is called on mount and on every debounced resize with the **measured container
width in CSS pixels**. Choose the layout, the margins *and* the font sizes from `w`.
A narrow layout is a different chart, not a scaled one. `RTM.bp(w)` returns `"s"|"m"|"l"`
and `RTM.pick(w, {s:…, m:…, l:…})` selects.

`progress(t)` is only called for scenes whose mount carries `data-track="scrolly"`.

## Core API (`RTM`, from `js/00-core.js`)

```
DOM      el(name, attrs, parent)  h(tag, attrs, parent)  clear(n)  q(sel, root)  qa(sel, root)
tokens   css("--ink")  bustTokens()
labels   txt(svg, attrs, content, haloed)  txtBlock(svg, x, y, anchor, lines, haloed)  hoist(svg)  halo(w)
scales   linear(d0,d1,r0,r1)  band(items,r0,r1,pad)  ticks(d0,d1,count)  extent(arr, acc)
maths    clamp lerp mean sd normPdf erf Phi probit ols(rows, gx, gy, gw)
random   rng(seed) -> f(), f.range(lo,hi), f.normal(mu,sd), f.pick(arr);  hashUnit(seed)
format   fmtFt(in,{prose})  sigma(z,dp)  pct(v,dp)  num(v,dp)  oneIn(p)  ordinalSuffix(n)
canvas   fitCanvas(canvas, w, h) -> ctx      (handles devicePixelRatio)
loop     onTick(fn) -> unsubscribe           (one shared rAF for the page)
prefs    reducedMotion()
scenes   scene(id, factory)  boot(id, mount)  live(id)
layout   widthOf(node)  bp(w)  pick(w, opts)  onResize(node, fn) -> unsubscribe
```

## Motion API (`RTM.motion`, from `js/01-motion.js`)

```
ease.{linear,quadOut,cubicIn,cubicOut,cubicInOut,quartOut,expoOut,expoInOut,backOut,elasticOut,softBack}
tween({from,to,dur,delay,ease,onUpdate,onDone}) -> {cancel, finish, done}
spring(initial, {stiffness,damping,precision}) -> {value, set(t,immediate), jump(t), on(fn), stop()}
stagger(items, {from,to,dur,total,delay,ease,order,onUpdate})
countTo(node, from, to, {dur, delay, ease, format})
drawPath(pathNode, {dur, delay, ease, keepDash})
monotonePath(points)   // safe for data, cannot overshoot
smoothPath(points, t)  // decorative connectors only
morphSeries(from, to, build, opts)
```

`tween` and `spring` collapse to their final frame under `prefers-reduced-motion`. Do not
add a second guard; do check `RTM.reducedMotion()` before starting any *looping* animation
(a physics sim, an idle drift) and skip it entirely.

## Data API (`RTM.data`, from `js/04-data.js`)

```
TRAITS      [{id, label, r, group, note, source}]
DYNASTIES   [{id, domain, family, metric, basis, note, source,
              parent:{name, role, years, stat, z, zLow?, zHigh?, verified},
              child: {name, role, years, stat, z, zLow?, zHigh?, verified}}]
GALTON      [[midParentHeight, childHeight, count], ...]   // Galton's own 1886 tally
HEIGHT      {mean: 69.1, sd: 3.0, r: 0.45, lebron: 79.25, bronny: 73.5}
OFFICE_RUBRIC [{z, label}]
SOURCES     [{id, cite, url?}]
halfLife(r)  byDomain("sport"|"politics"|"business")  galtonFit()
```

Code against the shapes, never against the current values. A `z` may be negative. A pair may
have `verified: false` on the child; render those with an explicit uncertainty band and never
let an unverified point drive a headline number.

## Derived numbers in prose

Headline numbers are **derived, never typed**. In prose the writer uses
`<span data-num="key"></span>` and boot fills it. The agreed keys:

```
gap-inches      galton-slope    galton-r       galton-n        height-r
lebron-z        bronny-z        pred-height    pred-z          pred-error
pi-range        lebron-rarity   bronny-pct     income-r
dynasty-slope   dynasty-n       dynasty-shrink
halflife-height halflife-surname halflife-lifespan
```

Any key you need beyond this list: add it to `js/90-boot.js`'s `NUMS` map **and** note it in
your report. An unfilled `data-num` span is a build failure.

## Gotchas that have already bitten this project

- `.append()` returns the child, not the parent.
- SVG has no z-index. Draw order is z order. **All labels paint last**: use `RTM.txt()` for
  every text node and call `RTM.hoist(svg)` at the end of every draw. Halo with the paper
  colour so glyphs carve themselves out of whatever runs behind.
- **Never `Math.random()`.** Use `RTM.rng(seed)`. The same seed must give the same picture on
  every reload, or the piece cannot be screenshotted, reviewed or tested.
- **Canvas: size for `devicePixelRatio`** via `RTM.fitCanvas`. And `moveTo` before every
  `arc`, or arcs join with a line.
- **Canvas hit-testing must undo any CSS downscale.** `d3.pointer`-style coordinates come
  back in rendered pixels; multiply by `W / canvas.getBoundingClientRect().width`.
- **Never animate a path `d` attribute as a string.** Rebuild the path from interpolated data
  each frame (`morphSeries`).
- **Two unnamed transitions on one element cancel each other.** Keep a handle and `.cancel()`
  the old one before starting a new one.
- **Tooltips are HTML over SVG and need `pointer-events: none`**, or the tooltip slides under
  the cursor, eats the leave event and flickers.
- `fill: transparent` catches pointer events. `fill: none` does not. Catcher rects need
  `transparent`.
- **`scaleRadial`-style area encodings need a square root.** A linear radius exaggerates by
  the square of the ratio.
- A shrinking viewBox shrinks the type with it. Pick font sizes from measured width.
- **A ranked panel must be sorted by value**, not alphabetically.
- **Do not spend N hues on a binary state.** One accent plus grey. Colour carries the
  argument (outlier vs mean) and nothing else.
- Bin thresholds are interior boundaries. Including the max makes a zero-width final bin and
  the largest value silently disappears.
- `role="img"` prunes the subtree: use it for static figures only. Genuinely interactive
  charts use `role="application"` (or no role) plus real focusable controls.

## Accessibility, non-negotiable

- Every figure has a real text alternative that states the finding, not the chart type.
- Every interactive control is a real `<button>`, `<input>` or `[tabindex="0"]` with a
  visible `:focus-visible` ring, reachable and operable by keyboard alone.
- Live readouts use `aria-live="polite"`.
- Colour is never the only encoding. Pair it with position, shape or a direct label.
- Every scene with data behind it ships a `<details>` table fallback inside its mount.
- Under `prefers-reduced-motion`, nothing loops, nothing auto-plays, everything still reads.

## Theming

Light and dark both ship. Tokens live in `css/01-tokens.css`. Read colours with `RTM.css()`
at draw time, never hardcode a hex in JS. `js/90-boot.js` calls `RTM.bustTokens()` and
redraws every scene on a theme flip, so your `draw(w)` must be safe to call repeatedly.

## Verification

`node build.mjs` is the gate for structure, but it cannot see layout. A headless Chrome
harness screenshots every scene, measures every `<text>` bounding box for collisions, checks
no text escapes its SVG frame, drives every control, and asserts the page changes. A separate
critic agent reviews the screenshots and will send work back. Assume it will.

---

## Appendix: the fixed class vocabulary

Scene modules style **SVG through attributes** (the D3 idiom) and read colours with
`RTM.css()`. For the HTML chrome around a chart they use **only** the class names below.
The design agent must implement every one of them; scene agents must not invent new ones.

```
.stage              the scene mount itself (supplied by shell.html)
.fig-head           block above a chart
  .fig-title        the finding, as a sentence
  .fig-sub          the how-to-read line
.fig-note           small print under a chart (source, caveat, method)
.chart              wrapper around the svg or canvas
.chart-scroll       horizontal scroll container for a chart that cannot shrink further

.ctrl-row           a row of controls, wraps
.ctrl               label + input pair
.ctrl-label         the label text
.seg                segmented control (container)
  .seg-btn          one segment; [aria-pressed="true"] is the active state
.btn                a plain button
  .btn-primary      the one accented button in a scene
.slider             an <input type="range">
.readout            a live number, tabular figures
.swatch             12px inline colour chip, used inside a legend item
.legend             a row of legend items
  .legend-item      swatch + label
.tip                the tooltip (position: absolute; pointer-events: none)
  .tip-name         bold first line
  .tip-stat         monospace number line
  .tip-note         small grey line
.tbl-wrap           <details> table fallback container
.hint               small italic prompt, e.g. "drag the marker"
.badge              tiny uppercase pill, e.g. "ESTIMATE" or "SCHEMATIC"
.sr-only            visually hidden, still read by screen readers
```

State hooks the design agent must style: `[aria-pressed="true"]`, `:focus-visible`,
`[data-dim="true"]` (a de-emphasised mark or legend item), `[hidden]`.
