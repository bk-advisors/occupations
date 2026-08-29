# Cloning the narration voice

The film's 79 lines are a lot to record, so this pipeline synthesises them in
Matthew's own voice, cloned zero-shot from his recorded narration for the
Africa film. No training and no fine-tuning: a short reference recording plus
its exact transcript conditions the model at inference time.

**This clones Matthew's voice from Matthew's own recordings, for his own
project.** It is not for producing speech attributed to anyone else.

The recorded voice is still the better option when there is time to record;
see [recording-guide.md](recording-guide.md). This exists so a caption can be
rewritten without booking a session, and so the film can be watched end to end
with narration before anyone commits to a take.

---

## What runs where

Everything lives on `D:` because `C:` has under 4 GB free on this machine.

| | |
|---|---|
| Python | 3.14.3, at `C:\Users\HP\AppData\Local\Python\pythoncore-3.14-64\python.exe` (not on PATH) |
| Virtualenv | `D:\voiceclone\venv` |
| Model cache | `D:\voiceclone\hf` (`HF_HOME`, set by the script) |
| Engine | F5-TTS 1.1.x, flow-matching zero-shot cloning, on torch 2.13 CPU |
| Device | CPU only. There is no CUDA GPU here, so synthesis is slow and meant to be left running. |

F5-TTS was chosen because it is the only current zero-shot cloner whose
dependency tree resolves on Python 3.14. Chatterbox hard-pins `torch==2.6.0`,
which has no cp314 wheels, and Coqui XTTS is unmaintained and pins a numpy old
enough that it will not build.

## Measured cost and pacing

From the audition of lines 1, 18 and 26 on this machine, at `nfe=24` with an
8.9s reference:

| | |
|---|---|
| Speed | **31.1x realtime** (32.2, 29.8, 31.6 per line) |
| Whole film | about **7 hours** for 79 lines, unattended |
| Generated length | about **1.4x the authored caption duration** |

That last row is the one with consequences. The film stretches its timeline to
fit each clip, so a 1.4x read turns a 10:31 authored film into roughly 14 to 15
minutes. The Africa film behaved the same way (6:11 authored, about 9 minutes
narrated), so this is the pipeline rather than a fault, but **the title
screen's "About ten minutes" has to be updated** once the real duration is
known.

Three things make the read longer than the captions: `speed=0.95` slows it
deliberately, the number expansions are physically longer ("eighteen seventy
seven" is four words where "1877" was one), and the model adds its own pauses.
Passing `--speed 1.1` tightens it at some cost to the unhurried register the
piece wants.

## The four steps

```sh
# 1. reference: ~15s of clean speech + its exact transcript, cut from the
#    Africa film's own clips, choosing lines with no figures or acronyms
python make-reference.py 14        # -> D:\voiceclone\reference\

# 2. speakable text: numerals written out as words
node tools/gen-tts-script.mjs      # -> narration/tts-lines.json + tts-script.md

# 3. synthesise: audition a few lines first, then the rest.
#    --skip-existing resumes a part-finished run, which matters when the whole
#    job takes seven hours and anything can interrupt it.
D:\voiceclone\venv\Scripts\python.exe tools/clone_narration.py --only 1,18,26
D:\voiceclone\venv\Scripts\python.exe tools/clone_narration.py --skip-existing

# 4. trim, level-match, encode to the film's audio/ folder
python tools/build_narration.py D:\voiceclone\wav
```

Then reload the film. `narration.js` probes `audio/line-01.mp3` upward, and if
all 79 are present it stretches the whole timeline so each caption slot fits
its clip.

## Gotchas that cost time here

- **Keep the reference under 12 seconds.** F5-TTS silently clips a longer
  reference ("Audio is over 12s, clipping short") but still conditions on the
  *full* transcript you passed. The audio and the text then disagree, which
  degrades every line generated from it. The first reference here was 13.3s and
  had to be rebuilt at 8.9s. `make-reference.py` takes a target length as its
  argument; 8.6 produces a safe 8.9s.
- **Hugging Face's xet transfer stalls on this connection.** The vocoder
  downloaded fine, then the 1.35 GB F5-TTS weights sat at zero bytes in a
  `.incomplete` file while the process idled. Set `HF_HUB_DISABLE_XET=1` to
  fall back to plain HTTP and it downloads normally.
- **`python` on PATH is the Microsoft Store stub**, which prints "Python was
  not found" and exits. The real interpreter is the full path above.
- **Quote the script path when launching.** The repo path contains spaces, and
  an unquoted `Start-Process -ArgumentList` splits it at "Parking".
- **`pydub` warns that ffmpeg is missing.** Harmless: F5-TTS writes wav
  directly and `build_narration.py` encodes mp3 through PyAV, so no ffmpeg
  binary is needed anywhere in this pipeline.

## Why the text is rewritten before synthesis

Every synthesiser mangles figures in its own way, and this script is unusually
dense with them: correlations (`0.65`), years (`1886`), heights (`6 foot 1.9`),
rarities (`1 in 2,800`), sigma readings. `gen-tts-script.mjs` writes all of
them out as words, so the model reads prose instead of guessing at notation.
18 of the 79 lines change. `narration/tts-script.md` marks which, and shows
both versions, so those can be checked first.

This is the same rule the Africa film's narration needed, where "8.3 million",
"$50" and "HIV/AIDS" all had to be spelled out.

## Why the reference is built, not picked by hand

`make-reference.py` scores every recorded clip on how clean its text is,
penalising digits, currency symbols and acronyms, then concatenates the
highest-scoring lines in script order until it has about 15 seconds. A
reference carrying "8.3 million" teaches the model how Matthew says a number
under pressure and nothing useful about his voice.

## Levels

The clone is normalised to **-28.8 dBFS RMS**, which is what the Africa film's
recorded clips actually measure, not a broadcast target. Normalising to a
louder standard would put the synthetic voice about 6 dB above the real one,
which is the first thing anyone would notice watching the two films back to
back.

## Rules that still apply

- **All or nothing.** One missing clip disables the narration layer entirely
  and the film runs silent on captions. `build_narration.py` refuses to write a
  partial set. A synthetic line spliced between recorded ones is audible.
- **Listen to every line before shipping.** Synthesised speech fails in ways
  silence checks cannot catch: a wrong stress, a swallowed clause, a number
  read as digits. `build_narration.py` flags any line whose length is far off
  its authored slot, which is usually where the model tripped.
- **Regenerate the text after any caption edit**, or the voice says something
  the screen does not.
- **Every line is seeded** (`--seed` base plus the line number), so a re-run
  reproduces the same audio and redoing one changed caption does not reshuffle
  the reading of the other seventy eight. Same rule the visuals follow: never
  `Math.random`, same seed same result.
