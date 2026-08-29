/* Containers a heading promises but nothing fills. The data-num check only
   covers spans; #sources shipped empty under a visible "Sources" heading and
   nothing noticed. Generalised: any element that exists to hold generated
   content and holds none. */
import { launch, wrap, settle, ready } from "./lib.mjs";
const b = await launch(); const p = await b.newPage();
await p.setViewport({ width: 1280, height: 900 });
await p.goto(wrap("light"), { waitUntil: "networkidle0" });
await ready(p); await settle(p);
const r = await p.evaluate(() => {
  document.querySelectorAll("details").forEach(d => (d.open = true));
  const bad = [];
  document.querySelectorAll("div[id], section[id], ul, ol, tbody").forEach(n => {
    if (n.closest("[data-scene]") && n.tagName !== "TBODY") return;
    const txt = (n.textContent || "").trim();
    if (txt.length === 0 && n.children.length === 0) {
      const h = n.previousElementSibling;
      bad.push(`${n.tagName.toLowerCase()}${n.id ? "#" + n.id : ""} is empty` +
               (h && /^H[1-6]$/.test(h.tagName) ? ` (under heading "${h.textContent.trim().slice(0,30)}")` : ""));
    }
  });
  const src = document.getElementById("sources");
  return { bad, sourceItems: src ? src.querySelectorAll("li").length : -1 };
});
console.log("source list items:", r.sourceItems);
console.log("empty containers :", r.bad.length ? r.bad.join(" | ") : "none");
process.exit(r.bad.length || r.sourceItems === 0 ? 1 : 0);
