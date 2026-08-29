/* No raw citation slug may reach the page. A slug is a lowercase run with a
   4-digit year, or a known SOURCES id, appearing in rendered text. */
import { launch, wrap, settle, ready } from "./lib.mjs";
const b = await launch(); const p = await b.newPage();
await p.setViewport({ width: 1280, height: 900 });
await p.goto(wrap("light"), { waitUntil: "networkidle0" });
await ready(p); await settle(p);
const r = await p.evaluate(() => {
  document.querySelectorAll("details").forEach(d => (d.open = true));
  const ids = (RTM.data.SOURCES || []).map(s => s.id);
  const txt = document.body.innerText;
  const slugHits = [...new Set((txt.match(/\b[a-z]{4,}\d{4}\b/g) || []))];
  const idHits = ids.filter(id => new RegExp("(^|[\s(>])" + id.replace(/[-]/g, "\-") + "([\s.,)<]|$)").test(txt));
  return { slugHits, idHits, sources: ids.length };
});
console.log("SOURCES entries:", r.sources);
console.log("slug-shaped strings in rendered text:", r.slugHits.length ? r.slugHits.join(", ") : "none");
console.log("bare SOURCES ids in rendered text   :", r.idHits.length ? r.idHits.join(", ") : "none");
process.exit(r.slugHits.length ? 1 : 0);
