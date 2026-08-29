# Voiceover recording guide: Reversion to the Mean

How to record and deliver the narration. The script itself, 79 numbered lines
with filenames, is in [voiceover-script.md](voiceover-script.md).

**Do not edit the script by hand.** It is generated from the film's captions by
`node tools/gen-voiceover.mjs`. If a line reads badly, change the caption in
`js/scenes.js` and regenerate, so the voice and the screen stay in step.

The design rule that makes everything easy: **one audio clip per line**. The
film plays each clip at its caption cue and stretches its own timing to fit
your read. You never have to match a stopwatch, and a mistake means
re-recording one short line, not a whole take.

---

## 1. The room

The room matters more than the microphone.

- Pick the quietest room available, with soft surfaces: curtains, carpet, a
  bed, cushions. Bare walls and tile create echo.
- Switch off or unplug anything that hums: fans, AC, fridge if audible. Phone
  on silent, and the recording phone in airplane mode.
- Record at a quiet time of day. Traffic and generator noise carry.
- Quick test: clap once. If you hear a ring, add soft material or pick another
  room.

## 2. The equipment

- A phone voice-memo app is fine, and it is what the 48 lines of the Africa
  film were recorded on. Stay consistent: same phone, same app, same room for
  every line including re-records. Consistency is what makes edits invisible.
- Mouth 6 to 8 inches from the mic, speaking slightly **past** it rather than
  straight into it, which keeps plosives off the diaphragm.
- Record 2 seconds of room silence at the top of the session. Noise reduction
  needs a sample of the room with nobody in it.

## 3. The read

This film is quieter than the Africa one. It is an essay about arithmetic, and
the argument does the work, so the read should stay level and unhurried.

- Plain and even, closer to reading a good essay aloud than to a trailer.
- Where a line ends a section, let it land flat. Do not lift into the next
  thought. Several lines are written to sit down at the end on purpose
  ("Something very ordinary is going on", "It never knew very much").
- Numbers get said precisely and then left alone. No emphasis lean on
  "**0.62**"; the chart is already pointing at it.
- Names to watch: Galton (GAWL-tun), Nicklaus (NICK-luss), Cruyff (KROYF),
  Bhutto (BOO-toe), Kahneman (KAH-nuh-mun), Estée Lauder (ESS-tay).
- "Sigma" is written out in the script wherever the caption shows σ, so read it
  as written.

## 4. Delivering the files

- One file per line, named `line-01`, `line-02`, ... `line-79`.
- Drop them into `apps/reversion-film/audio/`. Either `.mp3` or `.wav` works;
  the film probes mp3 first and falls back to wav per clip.
- **All 79 or nothing.** A single missing file disables narration entirely and
  the film runs silent on captions. This is deliberate: a half-narrated film is
  worse than an unnarrated one.
- Do not trim the heads and tails tight. Leave the pauses in; the cutting
  pipeline pads and aligns.

## 5. If a line changes later

Re-record only that line, in the same room, on the same device, and drop the
new file over the old one. Then re-run `node tools/gen-voiceover.mjs` so the
script on disk matches what was actually said.
