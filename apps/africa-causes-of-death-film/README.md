# 8.3 Million: Causes of Death in Africa, 2021

An interactive data film. About nine minutes of narrated, choreographed
animation over the WHO Global Health Estimates 2021 for the African Region, in
the tradition of
Neil Halloran's [*The Fallen of World War II*](https://www.neilfilms.com/ww2/):
a linear, narrated presentation you can pause at any point to step into the
charts and explore the numbers yourself.

Every dot on screen is 1,000 deaths. All 8.3 million deaths recorded for the
47-country WHO African Region in 2021 are on stage at once, re-forming from
scene to scene: by cause group, by age band, by individual cause.

**Companion pieces:**

- [The written story](https://bk-advisors.github.io/africa-causes-of-death/), the scrollytelling article this film is adapted from
- [The explorable](https://bk-advisors.github.io/africa-causes-of-death-explore/), the same dataset as a zoomable icicle with no narrative

## How it works

No build step and no framework: static ES modules, canvas 2D, and the Web
Audio API. Serve the folder over HTTP and open it.

- `js/engine.js` is the film engine, a master clock over time-stamped "beats"
  (idempotent state-setters) plus an independent caption track. Seeking replays
  all beats up to the target time with snap, so the scrubber, resize, and
  replay all reconstruct any point in the film through one path.
- `js/dots.js` is the particle pool: ~8,300 dots, each carrying a (cause, age
  band) identity, tweening between formations along curved staggered paths.
  Rendering is sprite-batched.
- `js/layouts.js` holds the formation factories: scattered field, spiral
  cluster, dot towers, horizontal dot bars, and 100%-stacked share columns.
  Each also draws its own direct labels and registers hover regions.
- `js/scenes.js` is the script: nine chapters of beats and captions. All chart
  numbers are computed from the dataset at load time.
- `js/score.js` is a generative ambient score (detuned pad, breathing lowpass,
  feedback delays). Each chapter hands the pad a new chord and mood. No audio
  files. Mute with the note button or `m`.
- `data/` holds auto-generated ES modules from the WHO GHE 2021 xlsx (same
  pipeline as the story app; regenerate there and copy over).

Narration is Matthew's recorded voiceover: one compressed clip per caption
line (`audio/line-NN.mp3`), played at that line's cue. On load the film
stretches its timeline so every caption slot fits its clip, and the ambient
score ducks while a clip plays. If the clips are absent the film falls back
to timed captions on the authored timeline; nothing else changes.

## Data

WHO Global Health Estimates 2021, "Deaths by Cause, Age, Sex, by Country and
by Region, 2000-2021" (released 2024), WHO African Region aggregate
(47 countries; excludes Egypt, Tunisia, Libya, Morocco, Sudan, Somalia and
Djibouti, which WHO assigns to the Eastern Mediterranean Region).
Licence: CC BY-NC-SA 3.0 IGO.

Written and built by [Matthew Kuch](https://github.com/bk-advisors).
