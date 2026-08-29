import { launch, wrap, settle, ready } from "./lib.mjs";
const b = await launch(); const p = await b.newPage();
await p.setViewport({ width: 1440, height: 900 });
await p.goto(wrap("light"), { waitUntil: "networkidle0" });
await ready(p); await settle(p);
const r = await p.evaluate(() => [...document.querySelectorAll("[data-scene]")].map(n => ({
  id: n.getAttribute("data-scene"), w: Math.round(n.getBoundingClientRect().width) })));
console.log("stage widths at 1440:", r.map(x=>`${x.id} ${x.w}`).join("  "));
await b.close();
