// Generative ambient score — Web Audio, no assets. A four-voice detuned pad
// through a slow-breathing lowpass and a pair of feedback delays, plus a sub
// root. Each chapter hands over a mood {root, chord, cutoff, level} and the
// pad glides to it over a few seconds.

export class Score {
  constructor() {
    this.started = false;
    this.muted = false;
    this._pending = null;
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

    // shared lowpass with slow LFO breathing
    this.filter = ctx.createBiquadFilter();
    this.filter.type = "lowpass";
    this.filter.frequency.value = 600;
    this.filter.Q.value = 0.6;

    this.lfo = ctx.createOscillator();
    this.lfo.frequency.value = 0.06;
    this.lfoGain = ctx.createGain();
    this.lfoGain.gain.value = 120;
    this.lfo.connect(this.lfoGain);
    this.lfoGain.connect(this.filter.frequency);
    this.lfo.start(t);

    // space: two cross-feeding delays, low in the mix
    const dry = ctx.createGain(); dry.gain.value = 0.7;
    const wetA = ctx.createDelay(2); wetA.delayTime.value = 0.31;
    const wetB = ctx.createDelay(2); wetB.delayTime.value = 0.47;
    const fbA = ctx.createGain(); fbA.gain.value = 0.35;
    const fbB = ctx.createGain(); fbB.gain.value = 0.3;
    const wetMix = ctx.createGain(); wetMix.gain.value = 0.4;
    this.filter.connect(dry); dry.connect(this.duckGain);
    this.filter.connect(wetA); wetA.connect(fbA); fbA.connect(wetB);
    wetB.connect(fbB); fbB.connect(wetA);
    wetA.connect(wetMix); wetB.connect(wetMix); wetMix.connect(this.duckGain);

    // pad voices: [osc sine, osc triangle detuned] per chord slot
    this.voices = [];
    for (let i = 0; i < 4; i++) {
      const g = ctx.createGain();
      g.gain.value = 0;
      g.connect(this.filter);
      const oscs = [];
      for (const [type, det] of [["sine", -4], ["triangle", 4]]) {
        const o = ctx.createOscillator();
        o.type = type;
        o.detune.value = det + (i - 1.5) * 1.5;
        o.frequency.value = 110;
        o.connect(g);
        o.start(t);
        oscs.push(o);
      }
      this.voices.push({ g, oscs });
    }

    // sub root
    this.sub = ctx.createOscillator();
    this.sub.type = "sine";
    this.sub.frequency.value = 55;
    this.subGain = ctx.createGain();
    this.subGain.gain.value = 0.05;
    this.sub.connect(this.subGain);
    this.subGain.connect(this.duckGain);
    this.sub.start(t);

    this.started = true;
    this.master.gain.linearRampToValueAtTime(this.muted ? 0 : 0.32, t + 4);
    if (this._pending) this.setMood(this._pending);
  }

  setMood(mood) {
    if (!mood) return;
    if (!this.started) { this._pending = mood; return; }
    const { root = 110, chord = [0, 7, 12, 16], cutoff = 600, level = 1 } = mood;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const glide = 2.5;
    this.voices.forEach((v, i) => {
      const semi = chord[i % chord.length];
      const f = root * Math.pow(2, semi / 12);
      for (const o of v.oscs) {
        o.frequency.cancelScheduledValues(t);
        o.frequency.setTargetAtTime(f, t, glide / 3);
      }
      const vol = 0.16 * level * (i === 0 ? 1.15 : 1) / Math.sqrt(i + 1);
      v.g.gain.cancelScheduledValues(t);
      v.g.gain.setTargetAtTime(vol, t, glide / 2);
    });
    this.filter.frequency.cancelScheduledValues(t);
    this.filter.frequency.setTargetAtTime(cutoff, t, glide / 2);
    this.sub.frequency.cancelScheduledValues(t);
    this.sub.frequency.setTargetAtTime(root / 2, t, glide / 3);
  }

  _applyDuck(tc = 0.8) {
    if (!this.started) return;
    const target = (this._pauseDuck ? 0.35 : 1) * (this._voiceDuck ? 0.4 : 1);
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

  // Sit the pad under the voiceover while a narration clip is playing.
  voiceDuck(on) {
    this._voiceDuck = !!on;
    this._applyDuck(0.4);
  }

  setMuted(m) {
    this.muted = m;
    if (!this.started) return;
    this.master.gain.setTargetAtTime(m ? 0 : 0.32, this.ctx.currentTime, 0.3);
  }
}
