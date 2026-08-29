// Generative score and sound effects. Web Audio, no assets.
//
// The Africa film's score is a four-voice detuned pad breathing through a slow
// filter: warm, continuous, mournful. Reusing it here was most of why this
// film sounded like that one. This score is built the other way round. A low
// drone holds the room, and everything on top of it is struck: a sparse
// plucked pulse whose rate the theme sets, not a sustained chord. It should
// sound like a workshop with a clock in it, which is what a film about
// measurement wants.
//
// It also has sound effects, which that film had none of. The Galton board is
// a physical object, so balls hitting pins make a sound and a pile coming to
// rest makes a sound. Beats fire them through api.sfx(), which stays silent
// while seeking so scrubbing past chapter 4 does not detonate 232 clicks.

import { T } from "./theme.js";

export class Score {
  constructor() {
    this.started = false;
    this.muted = false;
    this._pending = null;
    this._n = 0;            // deterministic jitter counter, never Math.random
  }

  start() {
    if (this.started) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = (this.ctx = new AC());
    const t = ctx.currentTime;

    this.master = ctx.createGain();
    this.master.gain.value = 0;
    this.master.connect(ctx.destination);

    this.duckGain = ctx.createGain();
    this.duckGain.gain.value = 1;
    this.duckGain.connect(this.master);

    // A short slap rather than the Africa film's pair of long cross-feeding
    // delays: this room is small and wooden, not a cathedral.
    const dly = ctx.createDelay(1);
    dly.delayTime.value = 0.13;
    const fb = ctx.createGain();
    fb.gain.value = 0.24;
    const wet = ctx.createGain();
    wet.gain.value = 0.22;
    dly.connect(fb); fb.connect(dly);
    dly.connect(wet); wet.connect(this.duckGain);
    this.slap = dly;

    // tone shaping for the sustained layer
    this.filter = ctx.createBiquadFilter();
    this.filter.type = "lowpass";
    this.filter.frequency.value = 500;
    this.filter.Q.value = 0.7;
    this.filter.connect(this.duckGain);
    this.filter.connect(dly);

    // the drone: root an octave down, and the root, low and steady
    this.drone = [];
    for (const [mult, det] of [[0.5, -3], [1, 4]]) {
      const g = ctx.createGain();
      g.gain.value = 0;
      g.connect(this.filter);
      const o = ctx.createOscillator();
      o.type = T.score.timbre || "sine";
      o.detune.value = det;
      o.frequency.value = 98 * mult;
      o.connect(g);
      o.start(t);
      this.drone.push({ o, g, mult });
    }

    this.mood = { root: 98, chord: [0, 7, 12, 16], cutoff: 500, level: 0.9 };
    this.started = true;
    this.master.gain.linearRampToValueAtTime(this.muted ? 0 : 0.3, t + 3.5);
    if (this._pending) this.setMood(this._pending);

    // Lookahead scheduler for the struck layer. Firing notes at call time from
    // a plain interval drifts audibly; scheduling ahead against the audio
    // clock does not.
    this._next = t + 1.5;
    this._timer = setInterval(() => this._schedule(), 200);
  }

  _schedule() {
    if (!this.started || this.muted) return;
    const horizon = this.ctx.currentTime + 0.5;
    const every = T.score.pulseEvery || 3;
    while (this._next < horizon) {
      const step = this._step = ((this._step || 0) + 1) % 8;
      const chord = this.mood.chord || [0, 7, 12, 16];
      const semi = chord[step % chord.length];
      const f = this.mood.root * Math.pow(2, semi / 12) * (step % 2 ? 2 : 1);
      // one strike in four is dropped, so the pulse does not read as a
      // metronome and the drone gets room to show through
      if (step % 4 !== 3) this._pluck(f, this._next, step === 0 ? 0.95 : 0.5);
      this._next += every * (step % 2 ? 0.5 : 1);
    }
  }

  // One struck note: fast attack, exponential decay, no sustain.
  _pluck(freq, at, level = 1) {
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = T.score.kind === "sub" ? "sine" : "triangle";
    o.frequency.value = freq;
    const peak = 0.07 * level * (this.mood.level ?? 1);
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), at + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, at + 1.9);
    o.connect(g);
    g.connect(this.filter);
    o.start(at);
    o.stop(at + 2.1);
  }

  setMood(mood) {
    if (!mood) return;
    if (!this.started) { this._pending = mood; return; }
    this.mood = { ...this.mood, ...mood };
    const { root = 98, cutoff = 500, level = 1 } = this.mood;
    const t = this.ctx.currentTime;
    const glide = 3;
    for (const d of this.drone) {
      d.o.frequency.cancelScheduledValues(t);
      d.o.frequency.setTargetAtTime(root * d.mult, t, glide / 3);
      d.g.gain.cancelScheduledValues(t);
      d.g.gain.setTargetAtTime((T.score.droneLevel ?? 0.12) * level, t, glide / 2);
    }
    this.filter.frequency.cancelScheduledValues(t);
    this.filter.frequency.setTargetAtTime(cutoff, t, glide / 2);
    this.sfx("swell");   // a soft rise marks the chapter turn
  }

  // ── Sound effects ────────────────────────────────────────────────────────
  // peg    a ball striking a pin: very short, bright, detuned per hit
  // settle a pile coming to rest: low and short, felt more than heard
  // swell  a chapter turning: a slow rise under the first caption
  sfx(name, { level = 1 } = {}) {
    if (!this.started || this.muted) return;
    const spec = T.score.sfx?.[name];
    if (!spec) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const n = this._n++;

    const o = ctx.createOscillator();
    const g = ctx.createGain();

    if (name === "swell") {
      o.type = "sine";
      o.frequency.setValueAtTime(spec.f * 0.6, t);
      o.frequency.exponentialRampToValueAtTime(spec.f, t + spec.decay);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(spec.level * level, t + spec.decay * 0.4);
      g.gain.exponentialRampToValueAtTime(0.0001, t + spec.decay);
      o.connect(g); g.connect(this.duckGain);
      o.start(t); o.stop(t + spec.decay + 0.1);
      return;
    }

    o.type = name === "peg" ? "square" : "sine";
    // Deterministic per-hit detune. 232 identical clicks phase-lock into one
    // tone, and Math.random would make the film sound different every run.
    const jitter = 1 + (((n * 37) % 23) - 11) / 220;
    o.frequency.setValueAtTime(spec.f * jitter, t);
    if (name === "settle") o.frequency.exponentialRampToValueAtTime(spec.f * 0.55, t + spec.decay);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, spec.level * level), t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + spec.decay);
    o.connect(g);
    g.connect(this.duckGain);
    if (name === "peg") g.connect(this.slap);
    o.start(t);
    o.stop(t + spec.decay + 0.05);
  }

  // A row of pins struck at once is a rattle, not one click, so a burst
  // spreads a handful of hits over a short window.
  sfxBurst(name, count = 10, spread = 0.3) {
    if (!this.started || this.muted) return;
    const n = Math.max(1, Math.min(count, 14));
    for (let i = 0; i < n; i++) {
      setTimeout(() => this.sfx(name, { level: 0.45 + 0.55 * (1 - i / n) }), (spread * 1000 * i) / n);
    }
  }

  _applyDuck(tc = 0.8) {
    if (!this.started) return;
    const target = (this._pauseDuck ? 0.4 : 1) * (this._voiceDuck ? 0.4 : 1);
    this.duckGain.gain.setTargetAtTime(target, this.ctx.currentTime, tc);
  }

  duck() {
    this._pauseDuck = true;
    this._applyDuck(1.2);
  }

  resume() {
    if (!this.started) return;
    this.ctx.resume?.();
    this._pauseDuck = false;
    this._applyDuck(0.8);
  }

  // Sit the score under the voiceover while a narration clip is playing.
  voiceDuck(on) {
    this._voiceDuck = !!on;
    this._applyDuck(0.4);
  }

  setMuted(m) {
    this.muted = m;
    if (!this.started) return;
    this.master.gain.setTargetAtTime(m ? 0 : 0.3, this.ctx.currentTime, 0.3);
  }
}
