// Voiceover narration layer. One audio clip per caption line, played at the
// caption's cue. If the clips are present, the film timeline is stretched so
// every caption slot fits its clip; if they are absent, the film runs on
// captions alone and nothing here activates.

export class Narration {
  constructor(base = "audio/") {
    this.base = base;
    this.clips = null;     // Audio elements, index = caption order
    this.durations = null;
    this.muted = false;
    this.current = -1;
    this.onVoiceActive = () => {}; // hooked to score ducking
  }

  // Probe line-01..line-NN (mp3, falling back to wav per clip).
  // All-or-nothing: any missing file disables narration.
  async load(count) {
    const probe = (i, ext) => new Promise((resolve) => {
      const el = new Audio();
      el.preload = "auto";
      el.src = `${this.base}line-${String(i + 1).padStart(2, "0")}.${ext}`;
      el.addEventListener("loadedmetadata", () => resolve({ el, dur: el.duration }), { once: true });
      el.addEventListener("error", () => resolve(null), { once: true });
    });
    const results = await Promise.all(
      Array.from({ length: count }, (_, i) => probe(i, "mp3").then((r) => r || probe(i, "wav")))
    );
    if (results.some((r) => !r)) return null;
    this.clips = results.map((r) => r.el);
    this.durations = results.map((r) => r.dur);
    for (const el of this.clips) {
      el.addEventListener("ended", () => this.onVoiceActive(false));
      el.addEventListener("play", () => this.onVoiceActive(true));
      el.addEventListener("pause", () => this.onVoiceActive(false));
    }
    return this.durations;
  }

  get enabled() { return !!this.clips; }

  _stop() {
    if (this.current >= 0 && this.clips) {
      const el = this.clips[this.current];
      el.pause();
      el.currentTime = 0;
    }
    this.current = -1;
  }

  // Called whenever the engine's active caption changes (including on seek,
  // which always re-emits the caption).
  onCaption(ix, offset, playing) {
    if (!this.enabled) return;
    if (ix == null || ix < 0) { this._stop(); return; }
    if (ix !== this.current) this._stop();
    this.current = ix;
    const el = this.clips[ix];
    const off = Math.max(0, Math.min(offset || 0, el.duration - 0.05));
    if (Math.abs(el.currentTime - off) > 0.35) el.currentTime = off;
    el.muted = this.muted;
    if (playing && el.paused) el.play().catch(() => {});
    if (!playing && !el.paused) el.pause();
  }

  onPlayState(playing) {
    if (!this.enabled || this.current < 0) return;
    const el = this.clips[this.current];
    if (playing && el.paused && el.currentTime < el.duration - 0.05) el.play().catch(() => {});
    if (!playing && !el.paused) el.pause();
  }

  setMuted(m) {
    this.muted = m;
    if (this.clips) for (const el of this.clips) el.muted = m;
  }
}

// Stretch the authored timeline so each caption slot fits its recorded clip.
// Piecewise-linear warp anchored at caption starts; beats, chapters, and the
// film duration are mapped through the same warp.
export function stretchScript(script, durations, { tail = 0.35 } = {}) {
  const caps = [...script.captions].sort((a, b) => a.t - b.t);
  caps.forEach((c, i) => { c._ix = i; });

  const anchors = [[0, 0]];
  let shift = 0;
  for (let i = 0; i < caps.length; i++) {
    const c = caps[i];
    anchors.push([c.t, c.t + shift]);
    const need = Math.max(c.dur, (durations[i] || 0) + tail);
    c._newT = anchors[anchors.length - 1][1];
    c._newDur = need;
    shift += need - c.dur;
  }
  anchors.push([script.duration, script.duration + shift]);

  const warp = (t) => {
    for (let i = anchors.length - 1; i >= 0; i--) {
      if (t >= anchors[i][0]) {
        if (i === anchors.length - 1) return anchors[i][1] + (t - anchors[i][0]);
        const [a0, b0] = anchors[i], [a1, b1] = anchors[i + 1];
        if (a1 === a0) return b0;
        return b0 + ((t - a0) * (b1 - b0)) / (a1 - a0);
      }
    }
    return t;
  };

  for (const b of script.beats) b.t = warp(b.t);
  for (const ch of script.chapters) ch.t = warp(ch.t);
  for (const c of caps) { c.t = c._newT; c.dur = c._newDur; }
  script.duration = warp(script.duration);
  return script;
}
