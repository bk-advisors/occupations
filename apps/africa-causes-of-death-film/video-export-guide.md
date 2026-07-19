# Exporting the film as a video (for YouTube)

The film is a linear ~9:32 piece that plays straight through, so a clean
capture of one playback *is* the video. Three options, in order of
effort. Option 1 is the recommended first pass; 2 and 3 are build notes
for a future session if 1 isn't good enough.

Whichever option you use, the interactivity is gone in a video — no
pausing to hover the charts, no chapter scrubbing. Always put the live
URL in the YouTube description so the video funnels viewers to the
interactive piece:

> Explore the interactive version (pause and hover any chart):
> https://bk-advisors.github.io/africa-causes-of-death-film/

---

## Option 1 — Screen-record a playback (no code, ~30 minutes)

### With OBS Studio (best quality control)

1. **Install OBS Studio** (free, obsproject.com).
2. **Set the canvas**: Settings → Video → Base and Output resolution
   both `1920x1080`, FPS `30` (60 if the machine keeps up; the dot
   animations look smoother at 60).
3. **Set the output**: Settings → Output → Recording:
   - Format: `mp4` (or `mkv` and remux afterwards — mkv survives a
     crash mid-recording, mp4 does not)
   - Encoder: hardware (NVENC/AMF/QSV) if offered, else x264
   - Bitrate: 12,000–16,000 Kbps for 1080p30 (YouTube re-encodes
     everything anyway; don't starve it)
4. **Sources**: add a *Display Capture* (or *Window Capture* of
   Chrome). Add/confirm **Desktop Audio** in the mixer — this captures
   the narration and the ambient score together. Mute the Mic source.
5. **Prepare the browser**:
   - Open https://bk-advisors.github.io/africa-causes-of-death-film/
     in Chrome and hard-refresh (`Ctrl+Shift+R`) so no stale assets.
   - `F11` for fullscreen.
   - Kill distractions: notifications off (Win+A → Focus assist /
     Do not disturb), close other tabs (no audio bleed), plug in the
     laptop (no battery-saver frame drops).
6. **Record**: start OBS recording, click **Begin**, then take your
   hands off the mouse. The player controls auto-fade after ~3 seconds
   of idle, so the recording shows a clean stage. Let it run through
   the end card, hold a beat or two on it, stop recording.
7. **Trim** the head (your click) and tail in any editor — even
   YouTube's own trim tool after upload works.

Retakes: if something glitches mid-run, just restart the playback and
re-record; it's a 10-minute run. (The `?t=SECONDS` URL parameter is for
silent paused screenshots, not for recording — it disables narration.)

### With Windows Game Bar (zero setup, lower ceiling)

`Win+Alt+R` starts/stops a recording of the active window with system
audio; output lands in `Videos/Captures`. Fine for a draft; OBS gives
better bitrate control for the final upload.

### YouTube upload notes

- Upload the mp4/webm as-is; let YouTube process the HD version fully
  before publishing (the SD-only preview looks terrible on dark
  footage).
- Dark, dotted footage is compression-hostile: if the dots look muddy
  after YouTube's re-encode, upload at 1440p (record at 1440p or
  upscale the 1080p master) — YouTube gives >1080p uploads the better
  VP9 codec.
- Add YouTube chapters by putting timestamps in the description. Get
  the chapter times from the live film: open DevTools console and run
  `__film.chapters.map(c => Math.round(c.t))` — those are seconds into
  the stretched timeline. Format as `0:00 The outbreak`, etc.
- Title/thumbnail: keep the film's own register — direct, not poetic
  ("8.3 Million: Causes of Death in Africa, 2021").

---

## Option 2 — Built-in export mode (a session of work, cleaner output)

Add an export harness to the film itself that records the tab's pixels
and audio in perfect sync using the browser's own APIs:

- `navigator.mediaDevices.getDisplayMedia({ video: true, audio: true,
  preferCurrentTab: true })` → user picks "This tab" with "Share tab
  audio" → gives a MediaStream of the whole tab (DOM captions AND
  canvas — this is why tab capture is right and
  `canvas.captureStream()` is not: the captions, chapter tag, and key
  tag are HTML overlays, not canvas pixels).
- Feed the stream to a `MediaRecorder`
  (`video/webm;codecs=vp9,opus`, ~12 Mbps video bitrate), start it,
  `engine.seek(0); engine.play()`, stop on the engine's end event, and
  trigger a download of the webm blob.
- YouTube accepts webm directly — no transcode step needed. (If an mp4
  is ever required, PyAV on this machine can transcode; there is no
  ffmpeg CLI installed.)
- Implementation sketch: a `?export` URL parameter that shows a single
  "Record" button; on click it requests tab capture, hides the player
  controls entirely (add a `body.exporting` class), runs the film, and
  saves `film.webm`. Keep the browser window at exactly 1920×1080
  (DevTools → device toolbar, or a `--window-size` launch).
- Gotchas to expect: Chrome shows a "sharing this tab" bar (crops into
  the capture on some versions — test; the `preferCurrentTab` +
  `selfBrowserSurface: 'include'` options and hiding the bar via
  kiosk/app mode are the workarounds); recording is realtime (9½
  minutes per take); keep the tab focused and the machine plugged in
  so Chrome doesn't throttle the tab.

## Option 3 — Fully offline render (most work, only if 1–2 disappoint)

Deterministic frame-by-frame render + offline audio mix, muxed with
PyAV:

- Video: the engine is deterministic — `seek(t)` reconstructs any
  frame. Drive headless Chrome via CDP (see the headless-screenshot
  recipe in the repo CLAUDE.md — launch Chrome manually with
  `--remote-debugging-port`, connect puppeteer-core, `setCacheEnabled(false)`),
  step `t` in 1/30s increments, screenshot each frame. ~17,000 frames
  for 9:32. But note `?t=` mode uses the *unstretched* timeline and
  disables narration — an offline render needs a variant that applies
  the stretched timeline without loading audio (compute the warp from
  the clip durations, which `stretchScript()` already does).
- Audio: narration = concatenate the 48 `audio/line-NN.mp3` clips at
  their stretched caption start times (the engine computes these at
  load; dump them from `__film.captions`). Score = the hard part; it's
  generative Web Audio. Either render it via `OfflineAudioContext`
  (needs a refactor of `score.js` to run against an arbitrary
  context) or simply record the score alone from a muted-narration
  playback — or ship the video with narration only.
- Mux frames + audio with PyAV (`libx264` + `aac`).

Verdict: highest quality ceiling, most engineering, least practical
gain over a good OBS capture. Only worth it if YouTube's re-encode of
a recorded capture visibly smears the dot fields at 1440p too.
