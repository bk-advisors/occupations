# Reversion to the Mean — a data film

Why the children of extraordinary people land closer to average. Eight
chapters, about fourteen minutes narrated, told through Galton's 928 adult
children, a box with pegs in it, and forty famous families in sport, politics
and business.

Live: not yet published. Source story: `new-stories/reversion-to-mean/`.

## Running it

No build step. Serve the folder over HTTP and open it:

```sh
cd apps/reversion-film
python -m http.server 8000     # or any static server
```

`file://` fails CORS on the portrait manifest fetch, so it has to be HTTP.

`window.__film` exposes the engine for debugging: `__film.seek(t)`,
`__film.pause()`, `__film.duration`. `?t=SECONDS` skips the title screen and
seeks there paused and silent, on the **authored** (unstretched) timeline. That
is the query string every screenshot in review was taken with, and the times in
`js/scenes.js` are the times it takes.

## How it is put together

Shares an **engine** with `apps/africa-causes-of-death-film` (time-stamped
idempotent beats over a pool of tweening dots, an independent caption track, a
generative Web Audio score) but deliberately **not a face**. See Identity
below: the first cut inherited that film's whole design and read as a reskin.

| File | What it holds |
|---|---|
| `js/theme.js` | The film's identity: palette, type system, stage texture, mark shapes, motion character, score character. |
| `data/reversion.js` | The researched values, ported verbatim from the story's `js/04-data.js`. Do not retype a number here. |
| `js/data.js` | Statistics helpers, the dot roster, and every figure the film quotes, all derived. |
| `js/layouts.js` | Formation factories: `bell`, `generations`, `figures`, `scatter`, `pegboard`, `slopeRows`, `decayColumns`, `prediction`, plus annotation helpers. |
| `js/scenes.js` | The script. Eight chapters of beats and 79 captions. |
| `js/portraits.js` | Circular Wikipedia portraits with a thick ring, drawn on canvas. |
| `js/dots.js` | The particle pool. Mark shape and motion easing come from the theme. |
| `js/score.js` | Drone plus struck pulse, and the sound effects. |
| `js/main.js` | Player chrome: title screen, ruler transport, tooltip, keyboard, credits. |

## Identity: "Instrument"

The film is about measurement, so the stage is the inside of a Victorian
instrument case. Warm near-black, brass and bone, ledger rules ruled across it,
and every number set in mono the way a caliper or a tally sheet would set it.

Chosen from three directions in review. The other two, a cold drafting
**Blueprint** and a near-black **Nocturne**, were cut and are gone from the
code; if either is ever wanted back, the tokens are in this file's git history.

| | |
|---|---|
| Stage | warm near-black `#14120E`, deep `#0C0B08` |
| Ink | bone `#F2EDE1` |
| Accent | brass `#D9A441` — whatever the narration is pointing at |
| Fall | oxblood `#B4472F` — a child who ended lower |
| Crowd | `#8A8272` |
| Type | Instrument Serif · IBM Plex Sans · IBM Plex Mono |
| Texture | ledger rules, light falling from above |
| Crowd mark | tally dash |
| Motion | straight travel, mechanical settle; gravity on the board |
| Score | low drone plus a sparse plucked pulse |

**Everything above lives in [js/theme.js](js/theme.js) as tokens.** Nothing in
`layouts.js`, `dots.js`, `engine.js` or `score.js` holds a literal colour or
font; they all read through `T` at draw time. That separation is what stopped
this film being a reskin of the Africa one, so keep it: a hex typed into a
layout is the bug.

`css/style.css` mirrors the same tokens as custom properties for the HTML
chrome. Keep the two in step, or a colour that exists in one and not the other
shows up as a seam between the HUD and the stage.

The rest of the identity is structural rather than palette:

- Captions sit **bottom left over a short accent rule**, not centred in the
  lower third. Left-ragged text is faster to re-read when the line changes
  every few seconds, and it leaves the centre of the frame for the chart.
- The scrubber is a **measured ruler** with minor ticks and chapter stations,
  which is the film's own conceit rather than a generic pill.
- **Every number on the stage is monospace.** It is the strongest single
  signal that the film is about measurement, and it keeps figures aligned
  column to column.
- Dots travel in **straight lines**. The Africa film's curved bezier paths read
  as organic, which suited that subject and not this one.
- The Galton board **makes a noise**: pins rattle as balls fall, and each pile
  lands with a low settle. Beats fire these through `api.sfx()`, which is
  silent while seeking so scrubbing past chapter 4 does not detonate 232
  clicks at once.

### One ruler: sigma

Everything in the film sits on one axis, standard deviations above the mean of
a **named reference population**. That is the only honest way a quarterback, a
prime minister and a department store fortune share a scale. Three
constructions produce those z scores (moment, rarity, office rubric) and each
pair states which one in its `basis`. Provenance for every figure is in
`new-stories/reversion-to-mean/reversion/RESEARCH.md`.

### The dot roster

1,988 dots in one pool, each with a stable identity so scenes hand the same
dots to each other:

| Kind | Count | Used for |
|---|---|---|
| `galton` | 928 | Galton's adult children: the chapter 2 scatter, and the first 232 are also the board balls |
| `person` | 80 | The two generations of each of the 40 dynasty pairs |
| `crowd` | 760 | A standard normal population: every bell, and the chapter 6 decay columns |
| `unseen` | 220 | The modelled parent-child pairs of the survivors scene |

`crowd` and `unseen` are deliberately separate. They were one kind at first,
which put the survivors' child z scores (centred near +2) into the population
histogram and made every bell in the film lopsided.

### Numbers are derived, never typed

`js/data.js` exports `N`, and every caption interpolates from it. The film
reproduces the story's fitted results exactly:

| Figure | Value |
|---|---|
| Galton slope, weighted OLS on his own 1886 table | **0.6463**, r 0.4588, n 928 |
| Dynasty slope, all pairs | **0.621**, r 0.552, n 40 |
| Dynasty slope, verified pairs only | 0.672, n 27 |
| Directions | 20 fall, 13 rise, 7 exactly level |
| Retention by domain | politics 85%, business 82%, sport 77% |
| Half-lives | height 0.92, lifespan 0.37, surname 2.41 generations |
| LeBron James | +3.38σ, about 1 in 2,800 men |
| Predicted son | 6′ 1.9″; Bronny James measured 6′ 1.5″ |

If a caption and a chart ever disagree, the caption is reading a stale
constant. Fix `js/data.js`, not the sentence.

## Portraits

24 photographs from Wikipedia and Wikimedia Commons, in `img/`, with
`img/portraits.json` as the manifest: file, source, author, licence, licence
URL and the Commons page for each. 13 are public domain; the rest are CC BY,
CC BY-SA or Copyrighted-free-use. **The end card prints the whole manifest**
grouped by licence, so nothing appears on screen unattributed.

They are drawn on canvas with a circular clip and a thick `#FAF6EE` ring. The
square crop is taken from the upper part of the frame, not the centre, because
a centred crop cuts the top of the head off. Every draw falls back to a plain
labelled mark if the image is missing, so a failed fetch degrades rather than
leaving a hole.

To add or refresh a portrait, add the person to the `CAST` map in
`tools/fetch-portraits.mjs` and re-run it. It skips files already on disk and
always rewrites the manifest.

```sh
node tools/fetch-portraits.mjs
```

Two things that cost time the first go. Wikimedia's `/thumb/` URLs 400 from
here, so the script downloads through `Special:FilePath?width=420` instead. And
Commons echoes file titles with spaces where `pageimages` returns underscores,
so both sides need normalising or every licence lookup silently misses and you
ship 24 images marked "unknown".

## Narration

Not yet recorded. The film runs on captions alone until `audio/line-01.mp3`
through `audio/line-79.mp3` exist, and it is all or nothing: one missing clip
disables the layer and the film falls back to the authored timeline.

`narration/voiceover-script.md` is **generated from the captions**, not written
by hand. Regenerate it after any caption edit, or the voice will say something
the screen does not. The generator also lints every line against the story's
banned-phrase list and the no-em-dash rule.

```sh
node tools/gen-voiceover.mjs      # what a human reads into a microphone
node tools/gen-tts-script.mjs     # the same lines with numerals written out
```

Two ways to fill `audio/`:

- **Recorded.** [narration/recording-guide.md](narration/recording-guide.md).
  Still the better result when there is time to book a session.
- **Cloned.** [narration/voice-clone.md](narration/voice-clone.md). Zero-shot
  F5-TTS on CPU, conditioned on a reference cut from the Africa film's own
  recorded clips, so it is Matthew's voice cloned from Matthew's recordings.
  Used so a caption can change without re-recording, and so the film can be
  watched end to end before anyone commits to a take.

When the clips land, `stretchScript()` warps the whole timeline so each caption
slot fits its clip, and the score ducks under a playing clip.

## Palette

Dark stage `#141126`, the same validated surface as the Africa film. Colour
carries one argument and nothing else: gold `#F4D58D` is whatever the narration
is pointing at, terracotta `#E0685A` is a fall, and everything else is the
crowd in `#B9B3CE`. The three domains deliberately get no hues, following the
story's own decision that spending colours on a category the eye does not need
to decode costs the accent its force.

## Known gaps

- **Not published.** No public repo or deploy target yet.
- **The "written version" links are repo-relative** (`../../new-stories/...`)
  and only resolve when the whole repo is served from its root. They will 404
  from a server rooted at this folder, and must be repointed at a real URL
  before any deploy.
- **Narration is a voice clone, not a recording.** All 79 lines are synthesised
  in Matthew's voice by F5-TTS, cloned zero-shot from the Africa film's own
  recorded clips. See [narration/voice-clone.md](narration/voice-clone.md).
  Every line still needs listening to; start with
  [narration/listen-checklist.md](narration/listen-checklist.md), which is
  ordered by risk rather than by line number.
- **Two portraits missing.** Gary Nicklaus and Mark Thatcher have no Wikipedia
  lead image, so those two people appear as labelled marks only. Neither is
  named in the narration.
- **The survivors scene is modelled, not observed**, and says so on the figure.
  The visible-versus-everything slopes (0.21 against 0.49) come from this
  film's own model and are not the story's numbers (0.37 against 0.72); the
  direction of the argument is the same and is the only thing claimed.
- **The sport distribution moments** (NBA 9.0/4.8, MLB 100/17, NHL 0.24/0.11)
  are calibrated estimates rather than published tables. Inherited from the
  story; see `RESEARCH.md` section 7.
