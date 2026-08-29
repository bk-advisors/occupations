// Deck navigation. No dependencies, no build: the slides are static HTML and
// this only decides which one is visible.
//
//   arrows / space / click   move
//   F                        fullscreen
//   G                        grid overview, click a slide to jump
//   N                        speaker notes (also shows the film cut point)
//   C                        hide the "roll film" tags, for a live talk
//   ?s=7                     open straight on a slide, used by the exporter
//   ?export=1                hide all chrome, for clean PNG capture

const slides = [...document.querySelectorAll(".slide")];
const counter = document.getElementById("counter");
const notesEl = document.getElementById("notes");
const NOTES = window.__notes || [];
const CUTS = window.__cuts || [];

if (new URLSearchParams(location.search).has("export")) document.body.classList.add("exporting");

let i = Math.max(0, Math.min(slides.length - 1,
  (parseInt(new URLSearchParams(location.search).get("s"), 10) || 1) - 1));

function render() {
  slides.forEach((s, k) => s.classList.toggle("current", k === i));
  counter.textContent = `${i + 1} / ${slides.length}`;
  const cut = CUTS[i];
  notesEl.innerHTML =
    (cut ? `<span class="cue">Roll film ${cut.clock} · ${cut.label}</span><br>` : "") +
    (NOTES[i] || "<em>No note for this slide.</em>");
  if (!document.body.classList.contains("grid")) {
    slides[i].scrollIntoView({ block: "nearest" });
  }
  history.replaceState(null, "", `?s=${i + 1}`);
}

function go(n) {
  i = Math.max(0, Math.min(slides.length - 1, n));
  render();
}

document.addEventListener("keydown", (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  switch (e.key) {
    case "ArrowRight": case "ArrowDown": case " ": case "PageDown":
      e.preventDefault(); go(i + 1); break;
    case "ArrowLeft": case "ArrowUp": case "PageUp":
      e.preventDefault(); go(i - 1); break;
    case "Home": go(0); break;
    case "End": go(slides.length - 1); break;
    case "f": case "F":
      if (document.fullscreenElement) document.exitFullscreen();
      else document.documentElement.requestFullscreen?.();
      document.body.classList.toggle("presenting");
      break;
    case "g": case "G": document.body.classList.toggle("grid"); render(); break;
    case "n": case "N": notesEl.hidden = !notesEl.hidden; break;
    case "c": case "C": document.body.classList.toggle("hide-cuts"); break;
    default:
      if (/^[0-9]$/.test(e.key)) go(parseInt(e.key, 10) - 1);
  }
});

// Click to advance, except in grid view where a click picks a slide.
document.addEventListener("click", (e) => {
  if (e.target.closest("#notes") || e.target.closest("#hud")) return;
  if (document.body.classList.contains("grid")) {
    const s = e.target.closest(".slide");
    if (s) {
      document.body.classList.remove("grid");
      go(slides.indexOf(s));
    }
    return;
  }
  go(i + 1);
});

render();
