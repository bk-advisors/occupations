/* Does any sticky scene paint over the prose beneath it? */
import { launch, wrap, settle, ready } from "./lib.mjs";
const b = await launch();
for (const vp of [[1440,900],[820,1180],[390,844]]) {
  const p = await b.newPage();
  await p.setViewport({ width: vp[0], height: vp[1] });
  await p.goto(wrap("light"), { waitUntil: "networkidle0" });
  await ready(p); await settle(p);
  const r = await p.evaluate(() => document.querySelectorAll(".scrolly > .stage").length
    ? [...document.querySelectorAll(".scrolly > .stage")].map(n => {
        const cap = n.getBoundingClientRect().height;
        return { id: n.getAttribute("data-scene"),
                 box: Math.round(cap), content: n.scrollHeight,
                 spill: Math.max(0, n.scrollHeight - Math.round(cap)),
                 scrolls: getComputedStyle(n).overflowY };
      }) : []);
  console.log(`${vp[0]}x${vp[1]}`);
  r.forEach(x => console.log(`  ${x.id.padEnd(11)} box ${String(x.box).padStart(4)}  content ${String(x.content).padStart(4)}  spill ${String(x.spill).padStart(4)}  overflow-y:${x.scrolls}`));
  await p.close();
}
await b.close();
