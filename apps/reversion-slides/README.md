# Reversion to the Mean — presentation deck

Slides for a YouTube talk on regression to the mean, presented live to camera,
cutting to clips from [the data film](../reversion-film/) where something moves.

22 slides, about 12 to 15 minutes at a calm pace.

## Running it

```sh
cd apps/reversion-slides
python -m http.server 8000     # or any static server
```

Open `index.html`. It is static HTML, so it also opens from disk, though the
portraits need HTTP if a browser is strict about local file reads.

| Key | |
|---|---|
| `←` `→` `space`, or click | move |
| `F` | fullscreen, and hides the corner HUD |
| `G` | grid overview; click a slide to jump |
| `N` | speaker notes, including the film cue for that slide |
| `C` | hide the "roll film" tags, for a live talk where they would confuse |
| `1`–`9` | jump to a slide |
| `?s=7` | open straight on a slide |
| `?export=1` | hide all chrome, for clean capture |

## What is in here

| | |
|---|---|
| `index.html` | The deck. **Generated** — do not hand-edit. |
| `build.mjs` | Generates the deck, the speaker notes, and every chart. |
| `figures.json` | Every number the slides quote, exported from the film's data module. |
| `film-timecodes.json` | Chapter and caption cues from the **narrated** film. |
| `speaker-notes.md` | What to say per slide, with the film cut points. Also visible in-deck with `N`. |
| `youtube-description.md` | Title options, description, chapters, pinned comment, tags, thumbnail guidance. |
| `slides-png/` | All 22 slides at 1920×1080, for any editor that wants images. |
| `thumbnail/` | Four 1280×720 options, each with a `-guide` twin showing the face slot. |

## Editing

Slides are generated so their figures cannot drift from the piece they
describe. Edit the `SLIDES` array in `build.mjs`, then:

```sh
node build.mjs
```

To refresh the underlying numbers after a data change, re-export `figures.json`
from the film (the snippet is in this repo's history; it reads
`apps/reversion-film/js/data.js` and writes every derived value), then rebuild.

To re-export the PNGs, serve the folder and screenshot `?s=N&export=1` at
1920×1080 for N in 1..22.

## Film cut points

10 slides carry a **Roll film** tag with a timecode. Those are cues into
`apps/reversion-film` **playing with narration**, total running time 14:13.

They come from the narrated build, not the authored one. **If the narration is
ever re-recorded or re-synthesised at a different speed, every timecode here is
wrong** — regenerate `film-timecodes.json` and rebuild.

The moments worth rolling rather than describing are the ones that move: the
Vanderbilt staircase building a generation at a time (0:54), the Galton dots
raining in (2:54), the board falling and filling into a bell (6:06), and the
far-right balls being re-dropped (6:17).

## Design

The film's "Instrument" identity, carried onto 16:9: warm near-black instrument
case, brass and bone, ledger rules, Instrument Serif for prose and IBM Plex Mono
for every number. That match is deliberate and load-bearing — the video cuts
between this deck and film clips, and a palette shift at each cut would read as
an error.

Sizes are in container query units, so a slide scales exactly with its
container whether that is a projector, a browser window, or a 1920×1080 capture.

## Known gaps

- **Chapter timestamps in the description are placeholders.** They cannot be
  filled until the video is cut.
- **The thumbnails have an empty face slot.** They are composed to still read
  without one, but they are designed to have you in them.
- Two slides quote figures that depend on the film's survivor model rather than
  observed data (the "almost half" figure). That is stated on the slide and in
  the speaker notes, and should be said out loud.
