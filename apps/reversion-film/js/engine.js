// Film engine: a master clock over a list of "beats" (time-stamped,
// idempotent state-setters), a caption track, and chapter markers.
// Seeking replays all beats up to the target time with snap=true, so any
// point in the film is reconstructable — the scrubber, resize, and replay
// all go through the same path.

import { T } from "./theme.js";
import { rgba } from "./layouts.js";

export class Engine {
  constructor({ canvas, pool, ui, score }) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.pool = pool;
    this.ui = ui;
    this.score = score;
    this.t = 0;                 // film time (s), frozen while paused
    this.playing = false;
    this.started = false;
    this.applied = 0;           // index of next unapplied beat
    this.overlays = [];
    this.chapterIx = -1;
    this.captionIx = -2;
    this._last = performance.now();
    this._anow = 0;             // animation clock (s), always running
    this.resize();
    requestAnimationFrame(() => this._tick());
  }

  load({ beats, captions, chapters, duration }) {
    this.beats = [...beats].sort((a, b) => a.t - b.t);
    this.captions = [...captions].sort((a, b) => a.t - b.t);
    this.chapters = chapters;
    this.duration = duration;
  }

  // API handed to each beat's apply(api, opts)
  _api(beatT, snap) {
    const self = this;
    return {
      view: self.view,
      snap,
      pool: self.pool,
      form(opts) {
        self.overlays = [];
        self.pool.setFormation({ ...opts, view: self.view, snap, now: self._anow });
      },
      formMore(opts) {
        self.pool.setFormation({ ...opts, view: self.view, snap, now: self._anow, keepOthers: true });
      },
      overlay(layout) {
        self.overlays.push({ draw: (ctx, view, ts) => layout.draw(ctx, view, ts), regions: layout.regions || [], t0: beatT });
      },
      overlayFn(fn) {
        self.overlays.push({ draw: fn, regions: [], t0: beatT });
      },
      dom(fn) { fn(self.ui, snap); },
      // Sound effects are a play-time event, not part of the reconstructable
      // state, so they stay silent while seeking. Otherwise dragging the
      // scrubber past chapter 4 fires 232 peg hits at once.
      sfx(name, opts) { if (!snap) self.score?.sfx(name, opts); },
      sfxBurst(name, count, spread) { if (!snap) self.score?.sfxBurst(name, count, spread); },
    };
  }

  begin() {
    this.started = true;
    this.seek(0);
    this.play();
  }

  play() {
    if (this.t >= this.duration) return;
    this.playing = true;
    this.ui.playState(true);
    this.ui.hideExplore();
    this.score?.resume();
  }

  pause({ explore = null } = {}) {
    this.playing = false;
    this.ui.playState(false);
    if (explore) this.ui.showExplore(explore);
    this.score?.duck();
  }

  toggle() { this.playing ? this.pause() : this.play(); }

  seek(t2) {
    t2 = Math.max(0, Math.min(this.duration, t2));
    this.t = t2;
    this.pool.hideAll();
    this.overlays = [];
    this.ui.reset();
    this.applied = 0;
    while (this.applied < this.beats.length && this.beats[this.applied].t <= t2) {
      const b = this.beats[this.applied];
      b.apply(this._api(b.t, true), { snap: true });
      this.applied++;
    }
    this.pool.snapAll();
    this.captionIx = -2;
    this.chapterIx = -1;
    this._syncChapter();
    this._syncCaption();
    this.ui.onTime(this.t, this.duration);
    if (this.t >= this.duration) this._end();
  }

  resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    this.view = { w, h, dpr };
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this._vigKey = null;
    if (this.started && this.beats) {
      const wasPlaying = this.playing;
      this.seek(this.t);
      this.playing = wasPlaying;
    }
  }

  _syncChapter() {
    let ix = -1;
    for (let i = 0; i < this.chapters.length; i++) {
      if (this.chapters[i].t <= this.t + 0.001) ix = i;
    }
    if (ix !== this.chapterIx) {
      this.chapterIx = ix;
      if (ix >= 0) {
        this.ui.chapter(ix, this.chapters[ix]);
        this.score?.setMood(this.chapters[ix].mood);
      }
    }
  }

  _syncCaption() {
    let ix = -1;
    for (let i = 0; i < this.captions.length; i++) {
      if (this.captions[i].t <= this.t) ix = i;
    }
    const c = ix >= 0 ? this.captions[ix] : null;
    const visible = c && this.t < c.t + c.dur;
    const key = visible ? ix : -1;
    if (key !== this.captionIx) {
      this.captionIx = key;
      this.ui.caption(visible ? c : null);
    }
  }

  _end() {
    this.playing = false;
    this.ui.playState(false);
    this.ui.onEnd();
    this.score?.duck();
  }

  _tick() {
    const now = performance.now();
    const dt = Math.min(0.1, (now - this._last) / 1000);
    this._last = now;
    this._anow += dt;

    if (this.playing) {
      this.t += dt;
      // fire beats crossed this frame
      while (this.applied < this.beats.length && this.beats[this.applied].t <= this.t) {
        const b = this.beats[this.applied];
        b.apply(this._api(b.t, false), { snap: false });
        this.applied++;
        if (b.pause) {
          this.t = b.t;
          this.pause({ explore: b.pause });
          break;
        }
      }
      this._syncChapter();
      this._syncCaption();
      this.ui.onTime(this.t, this.duration);
      if (this.t >= this.duration) this._end();
    }

    this._render();
    requestAnimationFrame(() => this._tick());
  }

  // The stage surface: fill, texture, marks, overlays, vignette. Every colour
  // and every choice here comes from the theme, so the film's surface is not
  // the Africa film's midnight purple with a radial vignette unless a theme
  // asks for exactly that.
  _render() {
    const { ctx, view } = this;
    const dpr = view.dpr;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = T.stage;
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this._drawTexture(ctx, view);

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.pool.update(this._anow);
    this.pool.draw(ctx, dpr);

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    for (const ov of this.overlays) {
      ov.draw(ctx, view, this.t - ov.t0);
    }
    this._drawVignette(ctx, view);
  }

  // Ledger rules or an engineering grid, under everything. Faint enough to
  // read as paper rather than as a chart the film did not draw.
  _drawTexture(ctx, view) {
    const tx = T.texture;
    if (!tx || tx.kind === "none") return;
    ctx.save();
    ctx.strokeStyle = rgba(T.ink, tx.alpha);
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let y = tx.spacing; y < view.h; y += tx.spacing) {
      ctx.moveTo(0, Math.round(y) + 0.5);
      ctx.lineTo(view.w, Math.round(y) + 0.5);
    }
    if (tx.kind === "grid") {
      for (let x = tx.spacing; x < view.w; x += tx.spacing) {
        ctx.moveTo(Math.round(x) + 0.5, 0);
        ctx.lineTo(Math.round(x) + 0.5, view.h);
      }
    }
    ctx.stroke();
    ctx.restore();
  }

  _drawVignette(ctx, view) {
    const v = T.vignette;
    if (!v || v.kind === "none" || !v.strength) return;
    const key = `${v.kind}:${v.strength}:${T.stageDeep}:${view.w}x${view.h}`;
    if (this._vigKey !== key) {
      if (v.kind === "top") {
        // light falls from above, like a lamp over a workbench
        const g = ctx.createLinearGradient(0, 0, 0, view.h);
        g.addColorStop(0, rgba(T.stageDeep, 0));
        g.addColorStop(0.55, rgba(T.stageDeep, 0));
        g.addColorStop(1, rgba(T.stageDeep, v.strength));
        this._vignette = g;
      } else {
        const g = ctx.createRadialGradient(
          view.w / 2, view.h / 2, Math.min(view.w, view.h) * 0.45,
          view.w / 2, view.h / 2, Math.max(view.w, view.h) * 0.78
        );
        g.addColorStop(0, rgba(T.stageDeep, 0));
        g.addColorStop(1, rgba(T.stageDeep, v.strength));
        this._vignette = g;
      }
      this._vigKey = key;
    }
    ctx.fillStyle = this._vignette;
    ctx.fillRect(0, 0, view.w, view.h);
  }

  // Hover regions of the topmost overlay that has any (used while paused)
  regionsAt(x, y) {
    for (let i = this.overlays.length - 1; i >= 0; i--) {
      for (const r of this.overlays[i].regions) {
        if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return r;
      }
    }
    return null;
  }

  hasRegions() {
    return this.overlays.some((o) => o.regions.length > 0);
  }
}
