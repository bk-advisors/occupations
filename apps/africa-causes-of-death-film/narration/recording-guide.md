# Voiceover recording guide: 8.3 Million

How to record, clean, and deliver the narration for the data film. The script
itself (48 numbered lines with filenames) is in [voiceover-script.md](voiceover-script.md).

The design rule that makes everything easy: **one audio clip per line**. The
film plays each clip at its caption cue and stretches its own timing to fit
your read. You never have to match a stopwatch, and a mistake means
re-recording one short line, not a whole take.

---

## 1. The room

The room matters more than the microphone.

- Pick the quietest room available, with soft surfaces: curtains, carpet, a
  bed, cushions. Bare walls and tile create echo.
- Switch off or unplug anything that hums: fans, AC, fridge if audible.
  Phone on silent (the recording phone in airplane mode).
- Record at a quiet time of day. Traffic and generator noise carry.
- Quick test: clap once. If you hear a ring or echo, add soft material or
  pick another room.

## 2. The equipment

- **Phone voice-memo app** is fine, and it is what the current 48 lines were
  recorded on. Stay consistent: same phone, same app, same room for every
  line, including any re-records. Consistency is what makes edits invisible.
- If you upgrade later, a USB microphone such as the Samson Q2U (about $70)
  into Audacity is the standard step up. Do not mix microphones within one
  narration; re-record everything if you switch.

## 3. Microphone technique

- Mouth 15 to 20 cm (6 to 8 inches) from the phone or mic.
- Speak slightly past it, not directly into it. This avoids popped "p" and
  "b" sounds.
- Keep the same distance and angle for every line.
- Calm, even documentary pace. Slightly slower than conversation. Do not
  rush to match the durations printed in the script; they are only a
  reference, and the film adapts to you.

## 4. The recording session

1. Open [voiceover-script.md](voiceover-script.md).
2. First, record 2 to 3 seconds of room silence. Keep this file; it is the
   noise profile for cleanup.
3. Read the lines in order, one clip per line, pausing a moment before and
   after each line so trimming is easy.
4. If you fluff a line, stop, breathe, and record that line again as a fresh
   take. Do not try to fix it mid-recording.
5. Mispronounced a word and only noticed later? Re-record just that line,
   same room, same phone, roughly the same time of day. It will slot in
   invisibly.

## 5. Cleanup in Audacity (free, Windows)

Import all clips, then for the whole session:

1. **Noise reduction.** Select your room-silence recording, Effect > Noise
   Reduction > Get Noise Profile. Then select everything and apply Noise
   Reduction with the default settings.
2. **High-pass filter.** Effect > Filter Curve EQ (or High-Pass Filter),
   cut below 80 to 100 Hz. Removes rumble and handling noise.
3. **Normalize.** Effect > Normalize, peak amplitude -1.0 dB, applied to all
   clips together so every line ends up at the same loudness.
4. **Trim.** Cut the silence off the head and tail of each line, leaving a
   natural breath of about a quarter second.

Target levels if you record inside Audacity directly: speak so the meter
peaks between -18 and -12 dB, never touching 0.

## 6. Export and delivery

- One file per line, named exactly as in the script: `line-01.wav`,
  `line-02.wav`, ... `line-48.wav`.
- WAV is preferred (the film can compress later); 44.1 kHz, mono is fine.
- In Audacity, drop a label at each line and use File > Export > Export
  Multiple to write all files in one go.
- Put the files in: `apps/africa-causes-of-death-film/audio/`
- Then hand over to Claude, who wires the playback: each clip fires at its
  caption cue, the film timeline stretches to the actual clip lengths, and
  the ambient score ducks under the voice.

## 7. Alternative for future edits: voice clone (Voicebox)

For rewrites down the road, a voice clone regenerates a changed line for
free. The free, local, open-source option is Voicebox
(<https://voicebox.sh/>, Windows app, nothing uploaded to the cloud).

- Train the voice on 1 to 3 minutes of your cleanest recorded lines.
- If you go this route, generate **all 48 lines** synthetically, not a mix.
  A cloned line spliced between real ones is audible; an all-synthetic read
  is coherent.
- Listen to every generated line. TTS stumbles on figures, currencies and
  acronyms ("8.3 million", "$50", "HIV/AIDS"). Writing them out as words in
  the input text usually fixes it ("eight point three million").
- Test two or three lines first; local generation speed depends on your
  machine.
- Export with the same `line-NN.wav` names into the same `audio/` folder.
  The film wiring is identical either way.

## 8. Checklist

- [ ] Quiet, soft-surfaced room; hum sources off
- [ ] 2 to 3 seconds of room silence recorded
- [ ] All 48 lines recorded, one clip per line, consistent distance and pace
- [ ] Flawed lines re-recorded in the same conditions
- [ ] Noise reduction, high-pass, normalize to -1 dB, trim
- [ ] Exported as `line-01.wav` ... `line-48.wav`
- [ ] Files in `apps/africa-causes-of-death-film/audio/`
- [ ] Tell Claude to wire the audio
