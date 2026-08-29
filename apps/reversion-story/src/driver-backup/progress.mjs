/* Does every scrolly scene actually sweep 0 -> 1 on a normal read-through?
   Unsticking the stages shortened every track, so progress could now skip
   states or never reach the end. */
import { launch, wrap, ready } from "./lib.mjs";
const b = await launch(); const p = await b.newPage();
await p.setViewport({ width: 1440, height: 900 });
await p.goto(wrap("light"), { waitUntil: "networkidle0" });
await ready(p);
await p.evaluate(() => {
  window.__seen = {};
  document.querySelectorAll('[data-track="scrolly"]').forEach(n => {
    const id = n.dataset.scene, inst = RTM.live(id);
    if (!inst || typeof inst.progress !== "function") return;
    window.__seen[id] = [];
    const orig = inst.progress.bind(inst);
    inst.progress = t => { window.__seen[id].push(t); return orig(t); };
  });
});
await p.evaluate(async () => {
  /* The sheet sets html { scroll-behavior: smooth }, which makes every
     window.scrollTo below an ANIMATION REQUEST, not a scroll. Measured: with it
     on, scrollY stayed at 0 for all 165 steps of this loop and the page then
     glided the whole 19738px during the 400ms tail, so every scene entered and
     left inside a third of a second and nothing could possibly narrate. A
     reader's wheel is not affected by scroll-behavior, so turning it off here
     is what makes this loop simulate a read-through at all. */
  document.documentElement.style.scrollBehavior = "auto";
  const H = document.documentElement.scrollHeight;
  for (let y = 0; y <= H; y += 120) { window.scrollTo(0, y); await new Promise(r => setTimeout(r, 26)); }
  await new Promise(r => setTimeout(r, 400));
});
const r = await p.evaluate(() => Object.fromEntries(Object.entries(window.__seen).map(([k, v]) => {
  const lo = Math.min(...v), hi = Math.max(...v);
  let maxGap = 0; for (let i = 1; i < v.length; i++) maxGap = Math.max(maxGap, Math.abs(v[i] - v[i-1]));
  return [k, { calls: v.length, min: +lo.toFixed(3), max: +hi.toFixed(3), maxJump: +maxGap.toFixed(3) }];
})));
for (const [k, v] of Object.entries(r)) {
  const ok = v.min < 0.08 && v.max > 0.92 && v.maxJump < 0.25;
  console.log(`${ok ? "ok  " : "FAIL"} ${k.padEnd(11)} calls ${String(v.calls).padStart(4)}  range ${v.min} -> ${v.max}  largest jump ${v.maxJump}`);
}
await b.close();
