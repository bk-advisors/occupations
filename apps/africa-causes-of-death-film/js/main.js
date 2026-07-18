// Bootstrap: builds the dot pool from the roster, loads the film script,
// and wires the player chrome (title screen, scrubber, explore panel,
// tooltip, keyboard).

import { roster, fmt } from "./data.js";
import { DotPool } from "./dots.js";
import { Engine } from "./engine.js";
import { Score } from "./score.js";
import { buildScript } from "./scenes.js";
import { Narration, stretchScript } from "./narration.js";

const $ = (id) => document.getElementById(id);

const canvas = $("stage");
const pool = new DotPool(roster);
const score = new Score();
const narration = new Narration();

const captionEl = $("caption");
const chapterEl = $("chapterTag");

const ui = {
  caption(c) {
    narration.onCaption(c ? c._ix : null, c ? engine.t - c.t : 0, engine.playing);
    if (!c) {
      captionEl.classList.remove("visible");
      return;
    }
    captionEl.classList.toggle("center", !!c.center);
    captionEl.innerHTML = c.text;
    captionEl.classList.add("visible");
  },
  chapter(ix, ch) {
    chapterEl.textContent = `Chapter ${ix + 1} · ${ch.title}`;
    chapterEl.classList.add("visible");
  },
  keyTag(show) {
    $("keyTag").hidden = !show;
    requestAnimationFrame(() => $("keyTag").classList.toggle("visible", show));
  },
  hint(show) {
    $("hintTag").hidden = !show;
    requestAnimationFrame(() => $("hintTag").classList.toggle("visible", show));
  },
  playState(playing) {
    narration.onPlayState(playing);
    $("playBtn").innerHTML = playing ? "&#10074;&#10074;" : "&#9654;&#xFE0E;";
  },
  onTime(t, dur) {
    $("scrubFill").style.width = `${(100 * t) / dur}%`;
    $("timeNow").textContent = clock(t);
    for (const el of document.querySelectorAll(".chap-tick")) {
      el.classList.toggle("done", +el.dataset.t <= t);
    }
  },
  onEnd() {
    const card = $("endCard");
    card.hidden = false;
    requestAnimationFrame(() => card.classList.add("visible"));
  },
  showExplore(text) {
    $("explorePrompt").textContent = text;
    const p = $("explorePanel");
    p.hidden = false;
    requestAnimationFrame(() => p.classList.add("visible"));
  },
  hideExplore() {
    const p = $("explorePanel");
    p.classList.remove("visible");
    p.hidden = true;
    hideTooltip();
  },
  reset() {
    this.hideExplore();
    const card = $("endCard");
    card.classList.remove("visible");
    card.hidden = true;
    this.keyTag(false);
    this.hint(false);
    chapterEl.classList.remove("visible");
    captionEl.classList.remove("visible");
  },
};

const engine = new Engine({ canvas, pool, ui, score });

const script = buildScript();
const narrationDurations = await narration.load(script.captions.length);
if (narrationDurations) {
  stretchScript(script, narrationDurations);
  narration.onVoiceActive = (on) => score.voiceDuck(on);
}
engine.load(script);
window.__film = engine; // dev/debug handles
window.__narration = narration;

function clock(t) {
  t = Math.max(0, Math.round(t));
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`;
}
$("timeTotal").textContent = clock(engine.duration);

// chapter ticks on the scrubber
const chapWrap = $("scrubChapters");
for (let i = 0; i < engine.chapters.length; i++) {
  const ch = engine.chapters[i];
  const tick = document.createElement("div");
  tick.className = "chap-tick";
  tick.style.left = `${(100 * ch.t) / engine.duration}%`;
  tick.dataset.t = ch.t;
  tick.innerHTML = `<span class="chap-label">${i + 1}. ${ch.title}</span>`;
  tick.addEventListener("click", (e) => {
    e.stopPropagation();
    engine.seek(ch.t);
    engine.play();
  });
  chapWrap.appendChild(tick);
}

// ── Transport ────────────────────────────────────────────────────────────
$("beginBtn").addEventListener("click", () => {
  $("titleScreen").classList.add("leaving");
  $("controls").hidden = false;
  score.start();
  engine.begin();
  setTimeout(() => ($("titleScreen").hidden = true), 1300);
});

$("replayBtn").addEventListener("click", () => {
  engine.seek(0);
  engine.play();
});

$("playBtn").addEventListener("click", () => {
  if (engine.t >= engine.duration) { engine.seek(0); engine.play(); }
  else engine.toggle();
});

$("continueBtn").addEventListener("click", () => engine.play());

$("muteBtn").addEventListener("click", () => {
  score.setMuted(!score.muted);
  narration.setMuted(score.muted);
  $("muteBtn").classList.toggle("muted", score.muted);
});

// scrubber seek (click + drag)
const scrubber = $("scrubber");
function seekFromEvent(e) {
  const r = scrubber.getBoundingClientRect();
  const frac = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
  engine.seek(frac * engine.duration);
}
let scrubbing = false, wasPlaying = false;
scrubber.addEventListener("pointerdown", (e) => {
  scrubbing = true;
  wasPlaying = engine.playing;
  engine.pause();
  scrubber.setPointerCapture(e.pointerId);
  seekFromEvent(e);
});
scrubber.addEventListener("pointermove", (e) => { if (scrubbing) seekFromEvent(e); });
scrubber.addEventListener("pointerup", (e) => {
  scrubbing = false;
  scrubber.releasePointerCapture(e.pointerId);
  if (wasPlaying && engine.t < engine.duration) engine.play();
});

// keyboard
window.addEventListener("keydown", (e) => {
  if (!engine.started || e.target.tagName === "INPUT") return;
  if (e.code === "Space") { e.preventDefault(); $("playBtn").click(); }
  else if (e.code === "ArrowRight") engine.seek(engine.t + 5);
  else if (e.code === "ArrowLeft") engine.seek(engine.t - 5);
  else if (e.key === "m") $("muteBtn").click();
});

// ── Explore tooltip (active while paused) ────────────────────────────────
const tooltip = $("tooltip");
function hideTooltip() { tooltip.hidden = true; }

canvas.addEventListener("pointermove", (e) => {
  if (engine.playing || !engine.started || !engine.hasRegions()) { hideTooltip(); return; }
  const r = engine.regionsAt(e.clientX, e.clientY);
  if (!r) { hideTooltip(); canvas.style.cursor = "default"; return; }
  canvas.style.cursor = "crosshair";
  const d = r.data;
  tooltip.innerHTML =
    `<div class="tt-name">${d.name}</div>` +
    `<div><span class="tt-val">${fmt(d.value)}</span> deaths</div>` +
    (d.sub ? `<div class="tt-sub">${d.sub}</div>` : "") +
    (d.note ? `<div class="tt-sub">Prevention: ${d.note}</div>` : "");
  tooltip.hidden = false;
  const tw = tooltip.offsetWidth, th = tooltip.offsetHeight;
  let x = e.clientX + 16, y = e.clientY - th / 2;
  if (x + tw > innerWidth - 12) x = e.clientX - tw - 16;
  y = Math.max(10, Math.min(innerHeight - th - 10, y));
  tooltip.style.left = x + "px";
  tooltip.style.top = y + "px";
});
canvas.addEventListener("pointerleave", hideTooltip);

// idle-fade the control bar while playing
let idleTimer = null;
function pokeControls() {
  $("controls").classList.remove("idle");
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    if (engine.playing) $("controls").classList.add("idle");
  }, 2800);
}
window.addEventListener("pointermove", pokeControls);
pokeControls();

window.addEventListener("resize", () => engine.resize());
