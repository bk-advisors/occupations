# Critique round 1 — VERDICT: REJECT

From a harsh critic that read every scene at three widths in both themes. Findings are
specific and mostly correct. Fix your section, then re-run the harness.

**Already fixed by the integrator, do not redo:**
- Height r shipped as 0.45 in two scenes and 0.47 in two others. `HEIGHT.r` is now derived from
  `TRAITS.height.r`, one value everywhere (0.47).
- The dynasties fig-title said "these 40 famous families" while the line is fitted to 27. Now
  reads "the 27 families with a measured number on both generations".
- `_full.png` was invalid: Chrome's fullPage capture tiles past 8,190 CSS px, so 178 of 231
  sampled rows repeated the top of the page. `shoot.mjs` now writes `_flow-NN.png` slices.
- Screenshots were NOT stale, contrary to the critique. They were 15 minutes old.

---

## THE THREE WORST THINGS

### 1. The hero's numbers are a category error
`js/10-scene-hero.js`. The hero plots Bill Gates at +5.8σ (wealth), John Adams at +5.0σ (an
editorial office rubric) and LeBron James at +3.7σ (NBA points per game) on one σ axis, then
places each child at exactly `0.45 × parent`, captioned as "the parent to child correlation
**for height**". A height correlation applied to a wealth z and a rank-rubric z. In a piece
whose method section makes a virtue of naming the reference population for every mark, the
front door does the one thing the method forbids.

### 2. The declared centrepiece fails in both views
`js/14-scene-dynasties.js`. Scatter: 70% of the canvas empty because every point is in the +3σ
to +6σ corner; five simultaneous mark languages of which the legend explains four; three domain
hues plus a red fit line plus a grey dashed y = x, against the piece's own one-accent rule; a
callout inside the plot repeating the fig-title almost verbatim 250px below it; four
right-margin labels whose leaders cross. Slope view: forty crossing lines in three hues, no
summary line, no median, no colour separating falls from rises. Reads as noise, not a tilt.
Neither view makes the finding visible before the caption.

### 3. The survivors headline argues the opposite of its own section
`js/16-scene-survivors.js`. Fig-title: "Put the missing ones back and the fitted slope goes from
0.37 to 0.72." A reader takes away that accounting for invisible children makes inheritance look
**stronger**. Six lines later the prose says the visible pairs **understate** the effect. The
figure wins, because it is 900px tall.

---

## GLOBAL CHROME (owner: agent D1)

- **The designed theme toggle never ships.** `installTheme()` in `js/90-boot.js` builds
  `<button class="btn">Dark mode</button>`. The 36px circular `.theme-toggle` in
  `css/03-layout.css` is dead code. Result: a wide default pill in a fixed
  `#rtm-topbar{top:10px;right:10px}` with no media query and no reserved gutter, so it
  **collides with content at every width below desktop**: covers the SPORT segment in phone
  dynasties, occludes the `r = 1.0` header in phone traits, hides "the father" in phone engine,
  clips the fig-title in phone board, clips the fig-sub in tablet dynasties.
- **The label is wrong in dark mode.** Still reads "DARK MODE" while dark is active.
- **The reading-progress bar is 3px of `currentColor`**, i.e. pure ink, the heaviest rule on the
  page, and it strikes through whatever is at the top of the viewport: cuts the tablet dynasties
  headline in half, strikes through the phone traits panel title. Make it 2px in `--accent` with
  a faint track. Note: the strike-through detector only tests SVG `<line>`, so it cannot see it.
- **Figure prose is more prominent than the essay.** Body paragraphs run ~400px; every figure's
  "how to read" and method block runs ~815px at the same type size. Set figure prose at 0.9×
  body and constrain to the body measure.
- **`.readout` appears in six scenes and reads as a disabled form field.** It is now the page's
  visual signature and it looks like a terminal. In engine, traits and survivors every number in
  the box is already directly labelled on the chart. Make the live region `.sr-only` and print
  the value as plain accented text.
- **`.slider` reads as a stock range input**; in engine it is only 165px for a precision drag.
- **Three unrelated left edges on desktop**: hero title 48px, essay column 480px, figures 228px.
  Pick two.
- The byline is six lines of monospace, five at phone, and reads as a terminal banner. Set it in
  the sans at small size. Cut the words "A visual essay." (the piece announcing its genre).

## `hero` (owner: agent A)

- The category error above. The fix that removes it entirely: **plot the real children from
  `RTM.data.DYNASTIES` instead of modelling them from a height r.** Real z, real pair, no
  cross-domain arithmetic. Choose three pairs that are real and that show the pattern, and put an
  `ESTIMATE` badge on any judged placement (Gates, Adams) on the mark itself.
- **The crowd is not a bell.** Measured: half-width accelerates concavely below the mean and runs
  straight-sided above it, hard-cut flat at +2.5σ with a spike to a point at −3.5σ. A
  top-truncated kite. The phone and tablet heroes render the same data horizontally and come out
  as clean symmetric bells, so the fault is the vertical path builder, not the data.
- **Nobody in the crowd reaches +3σ** yet the +3σ rule is annotated "One in 740 gets this far."
- **The three connectors are the loudest thing on the page and carry no information.** Nested
  rounded-rectangle routes running 150px right and back, 2px full accent, crossing each other.
  On tablet they become three concentric boxes and read as a circuit diagram. The point is a
  *fall*: draw a short descending curve, or fan them so no two share a corridor.
- **The three children are unreadable as a set:** +2.6σ, +2.3σ, +1.7σ stack within 50px with 4px
  arrowheads. You cannot tell which child belongs to which parent without tracing wire.
- A vertical seam at x≈430 CSS splits the hero into two background panels, aligned with nothing,
  much more visible in dark.
- Dead space: the whole left column below the byline, and x 430-560 above the +3σ rule. The +3σ
  and AVERAGE rules dangle 120px past the crowd into nothing while carrying their annotation on
  the left. End them at the crowd.
- **At ~1280px the hero breaks into three columns and the annotation column detaches**: the +3σ
  rule runs x 20 to 295, is interrupted by 500px of headline, resumes at x 815, pointing at
  nothing.
- On phone the order is chart, SCHEMATIC caption, eyebrow, headline, so the caption butts against
  the eyebrow and reads as a standfirst.

## `dynasties` (owner: agent B)

- **Delete the scatter and the domain hues.** Replace with one sorted panel: one row per family,
  sorted by parent σ descending, open dot for parent, filled dot for child, connecting rule, one
  accent for falls and grey for rises, one thick rule at the mean drop. That shows "the steepest
  falls start highest", a claim no current chart supports, holds 40 rows at 390px, and lets
  Walton / Adams / Kennedy / Gates be labelled in place instead of via crossing leaders.
- **Delete the retention panel** (Politics 85% / Business 82% / Sport 77%). Its own note says
  "the gaps are small and the sample is 40 families, so take the order and leave the sizes". A
  panel that disclaims its own numbers is decoration, and it wastes 85% of its width on empty
  axis. Keep the numbers in the prose and the table.
- The orange callout inside the plot repeats the fig-title almost verbatim. Cut it or shorten it
  hard.
- Move the methods sentence beginning "A slope inside one domain is unstable" into the fig-note.
  It is an appendix set at body size in the middle of the argument.

## `board` (owner: agent C)

- **The peg field is 2.2× the height of the pile.** 12 rows of large pale circles take ~510px;
  the pile that is the whole payoff gets ~230px. In act 2 the annotation carrying the finding is
  squeezed into 60px while 500px of static pegs sit above it. Cut to 4 or 5 visible rows, shrink
  the peg radius below the ball radius, give the space to the pile and the annotation.
- **The "one sigma = 1.7 bins" leader lines read as a bird.** Two short diagonals with a gap,
  120px from their text, pointing at an undrawn release point. Remove them; move the annotation
  to the fig-note. It is chart explanation, not the finding.
- **The prose oversells the selection and the simulation contradicts it.** "Keep only the balls
  that landed in the far right bin, the freak results" while act 2 keeps **148 of 220** balls at
  a mean of +1.49σ, which is two thirds of the population. Either select the actual far-right bin
  or rewrite to "keep every ball that finished right of the middle".
- **The act-2 headline number is an input, not a result.** The sub says children start at 45% of
  the way out; the annotation reports "54% of the edge is gone". Say where it is shown that 45%
  is the assumption.
- The pale-pink selection band and the two dashed verticals in act 2 are unlabelled.
- Act 2 keeps the grey act-1 balls behind the red children at the same size, so the red pile is
  hard to read. The dashed outline already carries act 1.
- Bin dividers run full height above empty bins, making a picket fence in empty space.
- The fitted curve is drawn on top of the stacked balls and disappears where the data is.
- **Internal vocabulary in reader-facing text**: "the act 1 pile", "the act 2 peg field". Also
  "act" appears in `shell.html` ("The survivors act puts a size on how much", "the next act
  is about..."). The reader has never been told the piece has acts.
- Dark: pegs drop to near-black and nearly vanish. The REPLAY button flips to bright orange and
  becomes the loudest thing in the scene, brighter than the data.

## `survivors` (owner: agent C)

- The headline inversion above. **Lead with "49% of the children never clear the bar"**, which is
  already computed and sitting in a readout, or state the change in the predicted child rather
  than in the slope. Keep the slope pair in the method note.
- **The diagonal hatch is louder than the marks it contains.** The modelled children are tiny
  hollow rings inside dense crosshatch. Drop to a flat 6% tint. In dark it reads as a screen door.
- The modelled children form visible vertical stripes, 12 per real pair at identical x. Jitter
  the parent x.
- **Three counts across two adjacent scenes with no bridge**: 40 families, 27 verified pairs,
  30 real pairs. Add one sentence.
- **Five slopes now live in the piece** (0.65 Galton, 0.67 dynasties, 0.37 visible, 0.72
  everyone, 0.47 height r) with nothing telling the reader which is which. A small "the numbers
  in this piece" strip in the method section would fix it.
- The "visible pairs: 0.37" label sits on top of the fit line it names.

## `traits` (owner: agent D1)

- **The right panel only ever shows one trait, so it does not earn half the layout.** A still
  frame shows Height and nothing else, and the headline's claim ("gone in a generation ... still
  there in six") is never drawn. **Draw all eight decay curves in grey with the selected one
  accented.** One change, whole finding visible.
- The printed `r = 0.75` values sit on top of the lollipop tracks. Stop the track before the
  number column.
- "+0.5σ, hard to pick out of a crowd" ends flush to the stage edge.
- Dark: the unfilled portion of each track is nearly invisible, so the 0-to-1 reference is lost
  in one theme only.

## `engine` (owner: agent D2)

- **Four stacked control rows** (legend, label+slider+segment, two buttons, readout), ~110px of
  chrome. Collapse to two.
- **The legend duplicates two direct labels and advertises a series that is not on screen.**
  Delete it; show one chip once sons exist.
- The segmented control has two wildly different segment widths. Shorten the second to
  "LeBron James".
- **The "5.6″ back toward the middle" label knocks a white hole in the blue curve** and abuts
  the 6′3″ tick. Move it above the two markers.
- **After DROP 200 SONS the sample is a dust cloud, not a distribution.** Dots float over the
  whole plot rect with no baseline, densest in the top right around 6′6″ to 6′9″, which reads as
  "most sons are taller than the peak", the opposite of the finding. Several strike through
  labels. Land them in a stacked beeswarm on the axis so the sample visibly rebuilds the curve.
- **"The gap between them is 5.75."** is the only number in the piece without a unit.
- Default state pins the father at the extreme right of the axis. Start him at the mean, so the
  reader first sees the case where nothing happens, which is the essay's own argument.

## `quiz` (owner: agent D2)

- **The default state is 300px of empty ruled rows with one dot.** It looks unfinished.
- **The guess default of +0.0σ makes round 1 argue against the piece.** The reader "guesses" 0.0,
  Jordi Cruyff lands at +0.2σ, and the readout announces "Average miss 0.2σ, model 2.2σ", so the
  model loses by 11×. Default the slider to the parent's value, which is the naive guess the
  section is about, and reorder so round 1 supports the claim.
- The guess marker is a black nail glyph, a different visual language from the round dots.
- **Three bordered readout boxes side by side** look like three disabled inputs.
- The `ESTIMATE` badge floats alone at the end of the readout row with no clear referent.
- **The reader's five errors are never plotted.** The whole finding is the *direction* of the
  errors and it is hidden inside a `<details>`. Draw a five-tick strip: each round's error
  against zero. That is the scene's reason to exist.
- Typo in the fig-note: "ranked by career standing**..** Source:".
- The axis label is "population average" at the top on desktop and "average" at the bottom on
  phone. Same annotation, two texts, two positions.

## `galton` (owner: agent D1) — this scene mostly works

- The slope is printed twice, 40px apart: a large `0.65` in the plot and again in a bordered
  readout below. Delete the readout.
- The in-chart `0.65` sits hard against the 74″ tick label.
- **Data escapes the plot frame.** Jittered dots fall below the x axis baseline among the tick
  labels. Clamp the jitter to the plot rect.
- The five "how to read" sentences under the chart have no paragraph gaps and run at a wider
  measure than the essay.

## WRITING (owner: agent E)

Clean on em-dashes and on the banned list, and much of it is genuinely good. Worst three:

1. "A slope inside one domain is unstable: there is almost no spread left in the parent to fit
   against, and the answer moves with a pair or two. So the domains are compared on what the
   children kept, mean child sigma over mean parent sigma." A methods appendix at body size in
   the middle of the argument, announcing what it is about to do before doing it.
2. "The survivors act puts a size on how much." "Act" is build vocabulary. Same in "the next act
   is about the families where the lines stay flat", "the act 1 pile", "the act 2 peg field".
3. "Neither can a growth spurt that arrived at the right age, or whatever it was that made one
   novel land." Garden path: "novel land" parses as a noun phrase first.

Also cut "Here is the entire model, and there is nothing hidden in it." and "Ask a blunt question
about any advantage." Both announce the next sentence. "The rookie who cools off... The fund that
tops the table... The ward with the worst infection month..." is the one place the piece performs;
keep two of the three.

---

## WHAT IS GOOD, DO NOT BREAK

- The prose. Real Housel register. "Ninety-six years later the family held its first reunion, at
  the university the Commodore had paid for. Among a hundred and twenty relatives there was not a
  millionaire." And the closing: "What the arithmetic knew about him, it knew before he was born.
  It never knew very much."
- Every section headline is a claim with a consequence.
- The intellectual honesty: the SCHEMATIC / ESTIMATE / SIMULATED badges, "which placements are
  judgements", "the surname number is argued about", "every number here is a floor".
- **Board act 2** is the best chart in the piece.
- The galton scatter: direct labels on both lines, the honest note about the 1.08 scaling.
- Genuinely responsive charts, not shrunk ones. The phone hero is better than the desktop one.
- All spot-checked arithmetic is right.

## THE ONE CHANGE THAT WOULD MOST RAISE THE CEILING

Give the piece **one protagonist, one ruler, one recurring mark.** LeBron and Bronny already
appear in the hero, the engine, the dynasties chart and the closing paragraph. The piece has a
spine and does not know it, which is why the same man carries three different z values. Pick one
reference population and one trait for that pair, draw one horizontal σ ruler with the same
width, ticks and marks, and place it in every scene as a persistent strip: the whole graphic in
the hero, under the scatter in galton, the axis you drag in engine, the bin the parent came from
in board, one highlighted row in dynasties, the pair that stayed visible in survivors, round five
in quiz.

Right now the piece is eight good ideas standing next to each other. That makes it one piece.
