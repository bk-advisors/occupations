/* shoot.mjs — screenshot every scene at every width in both themes, and assert
   the structural things a build check cannot see: empty SVGs, zero-height
   figures, unfilled derived-number spans, scenes that never mounted. */
import { launch, wrap, watch, settle, ready, WIDTHS, OUT, report } from "./lib.mjs";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

const themes = process.argv.includes("--light-only") ? ["light"] : ["light", "dark"];
const bag = { errors: [], warnings: [], notes: [], fails: [] };
const browser = await launch();
mkdirSync(OUT, { recursive: true });

for (const theme of themes) {
  const url = wrap(theme);
  for (const vp of WIDTHS) {
    const page = await browser.newPage();
    watch(page, bag);
    await page.setViewport({ width: vp.w, height: vp.h, deviceScaleFactor: 2 });
    await page.goto(url, { waitUntil: "networkidle0", timeout: 30000 });
    const wasReady = await ready(page);
    if (!wasReady) bag.fails.push(`${theme}/${vp.name}: RTM_READY never became true`);
    await settle(page);

    const dir = join(OUT, `${theme}-${vp.name}`);
    mkdirSync(dir, { recursive: true });

    /* Page flow, in viewport-sized slices.

       NOT fullPage. Chrome's fullPage capture silently TILES past 8,190 CSS px:
       measured on this page, 178 of 231 sampled pixel rows were byte-identical
       to the row 8,190 CSS px below them, so the single "_full.png" repeated
       the top of the page over and over and contained none of the last five
       scenes. Rhythm and pacing below the fold had never been reviewed by
       anyone, machine or human, and the file looked plausible the whole time.

       Slices are numbered so they read in order, and overlap slightly so a
       section heading cannot fall exactly on a seam. */
    const pageH = await page.evaluate(() => document.documentElement.scrollHeight);
    const step = Math.round(vp.h * 0.88);
    const slices = Math.min(Math.ceil(pageH / step), 40);
    for (let s = 0; s < slices; s++) {
      const y = Math.min(s * step, Math.max(0, pageH - vp.h));
      await page.evaluate((yy) => window.scrollTo(0, yy), y);
      await new Promise((r) => setTimeout(r, 220));
      await page.screenshot({
        path: join(dir, `_flow-${String(s + 1).padStart(2, "0")}.png`)
      });
    }
    await page.evaluate(() => window.scrollTo(0, 0));
    await new Promise((r) => setTimeout(r, 200));
    bag.notes.push(`${theme}/${vp.name}: page ${pageH}px captured in ${slices} slices`);

    /* Hide fixed overlays for the per-scene captures. The reading-progress bar
       and the theme toggle are `position: fixed`, so they land wherever the
       viewport happens to be and get baked into every element screenshot. Two
       separate reviewers reported the progress bar as a rule struck through a
       chart, which it is not. They are captured in the _flow slices instead,
       where they belong. */
    await page.addStyleTag({
      content: "#rtm-topbar, #rtm-reading-progress, progress, .theme-toggle, .rtm-progress { visibility: hidden !important; }"
    });

    const stages = await page.$$("[data-scene]");
    for (const st of stages) {
      const id = await st.evaluate((n) => n.getAttribute("data-scene"));
      const box = await st.boundingBox();
      if (!box || box.height < 40) {
        bag.fails.push(`${theme}/${vp.name}: scene "${id}" has no height (${box ? Math.round(box.height) : "null"}px)`);
        continue;
      }
      /* Scroll it into view first, or a sticky scrolly stage photographs from
         wherever the page happens to be parked. */
      await st.evaluate((n) => n.scrollIntoView({ block: "center", behavior: "instant" }));
      await new Promise((r) => setTimeout(r, 320));

      /* Capture through the element handle, NOT page.screenshot({clip}).
         boundingBox() reports viewport-relative coordinates once the page has
         scrolled, while a clip is read in page coordinates, so hand-rolling the
         rectangle silently photographs the top of the document for every scene.
         That is not hypothetical: it produced eight identical pictures of the
         hero and sent a reviewer a folder of garbage. */
      const shot = await st.screenshot({ path: join(dir, `${id}.png`) }).then(() => true).catch(() => false);
      if (!shot) bag.warnings.push(`${theme}/${vp.name}: could not capture scene "${id}"`);
    }

    const audit = await page.evaluate(() => {
      const out = { emptySvg: [], zeroSvg: [], blankNums: [], missingScenes: [], overflowX: false, canvases: [], sceneIds: [] };
      document.querySelectorAll("[data-scene]").forEach((n) => {
        const id = n.getAttribute("data-scene");
        out.sceneIds.push(id);
        if (n.children.length === 0) out.missingScenes.push(id);
      });
      document.querySelectorAll("svg").forEach((s, i) => {
        if (s.id === "rtm-defs") return;
        const r = s.getBoundingClientRect();
        const marks = s.querySelectorAll("path,circle,rect,line,text,polygon,polyline,ellipse,image,use").length;
        const tag = s.closest("[data-scene]")?.getAttribute("data-scene") || `svg#${i}`;
        if (marks === 0) out.emptySvg.push(tag);
        if (r.height < 4) out.zeroSvg.push(`${tag} (${Math.round(r.height)}px)`);
      });
      document.querySelectorAll("canvas").forEach((c) => {
        const tag = c.closest("[data-scene]")?.getAttribute("data-scene") || "canvas";
        out.canvases.push(`${tag}: ${c.width}x${c.height} backing / ${Math.round(c.getBoundingClientRect().width)}px css`);
      });
      document.querySelectorAll("[data-num]").forEach((n) => {
        const t = (n.textContent || "").trim();
        if (!t || t === "?" || t === "NaN" || /NaN|undefined|Infinity/.test(t)) {
          out.blankNums.push(`${n.getAttribute("data-num")} = "${t}"`);
        }
      });
      out.overflowX = document.documentElement.scrollWidth > window.innerWidth + 2;
      out.scrollWidth = document.documentElement.scrollWidth;
      out.innerWidth = window.innerWidth;
      return out;
    });

    const tag = `${theme}/${vp.name}`;
    audit.missingScenes.forEach((s) => bag.fails.push(`${tag}: scene "${s}" mounted nothing`));
    audit.emptySvg.forEach((s) => bag.fails.push(`${tag}: empty svg in "${s}"`));
    audit.zeroSvg.forEach((s) => bag.fails.push(`${tag}: zero-height svg ${s}`));
    [...new Set(audit.blankNums)].forEach((s) => bag.fails.push(`${tag}: unfilled prose number ${s}`));
    if (audit.overflowX) bag.fails.push(`${tag}: page scrolls horizontally (${audit.scrollWidth} > ${audit.innerWidth})`);
    if (theme === "light" && vp.name === "desktop") {
      bag.notes.push(`scenes found: ${audit.sceneIds.join(", ")}`);
      audit.canvases.forEach((c) => bag.notes.push("canvas " + c));
    }
    await page.close();
  }
}

await browser.close();
bag.notes.push("shots in " + OUT);
process.exit(report("SHOOT", bag) ? 1 : 0);
