/* Text flush against or past its STAGE edge, and fixed overlays that bleed
   into element screenshots. The existing audit compares text to its own SVG,
   which passes when the SVG itself runs to the stage edge. */
import { launch, wrap, settle, ready } from "./lib.mjs";
const b = await launch(); const p = await b.newPage();
await p.setViewport({ width: 1440, height: 900 });
await p.goto(wrap("light"), { waitUntil: "networkidle0" });
await ready(p); await settle(p);
const r = await p.evaluate(() => {
  const out = { tight: [], fixed: [] };
  document.querySelectorAll("[data-scene]").forEach(st => {
    const s = st.getBoundingClientRect();
    st.querySelectorAll("text, .readout, .fig-note, .legend-item").forEach(t => {
      const q = t.getBoundingClientRect();
      if (!q.width) return;
      const gapR = s.right - q.right, gapL = q.left - s.left;
      if (gapR < 4 || gapL < 0)
        out.tight.push({ scene: st.dataset.scene, text: (t.textContent||"").trim().slice(0,26),
                         gapL: Math.round(gapL), gapR: Math.round(gapR) });
    });
  });
  document.querySelectorAll("body *").forEach(n => {
    const st = getComputedStyle(n);
    if (st.position === "fixed" && n.getBoundingClientRect().width > 100)
      out.fixed.push(`${n.tagName}.${(n.className||"").toString().slice(0,24)} h=${Math.round(n.getBoundingClientRect().height)}`);
  });
  return out;
});
console.log("TEXT FLUSH TO / PAST STAGE EDGE:");
[...new Map(r.tight.map(x=>[x.scene+x.text,x])).values()].slice(0,18)
  .forEach(x => console.log(`  [${x.scene}] "${x.text}"  left ${x.gapL}px  right ${x.gapR}px`));
console.log("\nFIXED OVERLAYS (these bleed into element screenshots):");
[...new Set(r.fixed)].forEach(x => console.log("  " + x));
await b.close();
