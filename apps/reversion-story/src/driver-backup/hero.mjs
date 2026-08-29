import { launch, wrap, settle, ready, OUT } from "./lib.mjs";
import { join } from "node:path";
const b = await launch(); const p = await b.newPage();
await p.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1.5 });
await p.goto(wrap("light"), { waitUntil: "networkidle0" });
await ready(p); await settle(p);
await p.screenshot({ path: join(OUT, "hero-now.png"), clip: { x:0, y:0, width:1440, height:900 } });
const m = await p.evaluate(() => {
  const h = document.querySelector(".hero"), inner = document.querySelector(".hero > .col");
  const st = document.querySelector('[data-scene="hero"]');
  const names = [...st.querySelectorAll("text")].map(t => ({
    t: (t.textContent||"").trim().slice(0,22),
    x: Math.round(t.getBoundingClientRect().left),
    y: Math.round(t.getBoundingClientRect().top) }));
  return { heroH: Math.round(h.getBoundingClientRect().height),
           innerTop: Math.round(inner.getBoundingClientRect().top),
           innerH: Math.round(inner.getBoundingClientRect().height),
           labels: names.slice(0,10) };
});
console.log(JSON.stringify(m, null, 1));
await b.close();
