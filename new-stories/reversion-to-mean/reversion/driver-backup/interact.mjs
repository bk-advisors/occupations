/* interact.mjs — drive every control and prove the page responds.
   A chart that renders but does not react is a screenshot with extra steps. */
import { launch, wrap, watch, settle, ready, OUT, report } from "./lib.mjs";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

const bag = { errors: [], warnings: [], notes: [], fails: [] };
const browser = await launch();
const dir = join(OUT, "interact");
mkdirSync(dir, { recursive: true });

const page = await browser.newPage();
watch(page, bag);
await page.setViewport({ width: 1280, height: 900, deviceScaleFactor: 1.5 });
await page.goto(wrap("light"), { waitUntil: "networkidle0", timeout: 30000 });
await ready(page);
await settle(page);

/* A cheap structural fingerprint of a scene: enough to tell "it changed" from
   "nothing happened", without being so sensitive that a 1px anti-alias trips it.

   Opacity is part of the fingerprint because a REVEAL is the commonest kind of
   state change in this piece and it moves nothing: the survivors scene brings
   176 dots from 0 to visible without touching a single cx. A geometry-only
   fingerprint called that a dead button, which is a false accusation against a
   control that works. Bucketed to one decimal so a mid-tween frame does not
   read as a difference. */
const fingerprint = (sceneId) =>
  page.evaluate((id) => {
    const n = document.querySelector(`[data-scene="${id}"]`);
    if (!n) return "MISSING";
    const marks = [...n.querySelectorAll("circle,rect,path,line,text")].slice(0, 400);
    return marks.map((m) => {
      const cs = getComputedStyle(m);
      const op = (parseFloat(cs.opacity || "1") *
                  parseFloat(cs.fillOpacity || "1")).toFixed(1);
      return (m.getAttribute("cx") || m.getAttribute("x") || "") + "," +
             (m.getAttribute("cy") || m.getAttribute("y") || "") + "," +
             (m.getAttribute("d") || "").slice(0, 24) + "," +
             (m.textContent || "").slice(0, 12) + "," + op;
    }).join("|");
  }, sceneId);

const scenes = await page.$$eval("[data-scene]", (ns) => ns.map((n) => n.getAttribute("data-scene")));
bag.notes.push("scenes: " + scenes.join(", "));

for (const id of scenes) {
  const sel = `[data-scene="${id}"]`;
  await page.$eval(sel, (n) => n.scrollIntoView({ block: "center", behavior: "instant" }));
  await new Promise((r) => setTimeout(r, 400));

  const buttons = await page.$$(`${sel} button:not([disabled])`);
  const sliders = await page.$$(`${sel} input[type="range"]`);
  const details = await page.$$(`${sel} details`);

  if (!buttons.length && !sliders.length) {
    bag.notes.push(`[${id}] no controls (static scene)`);
  }

  /* ── Buttons ────────────────────────────────────────────────────────────── */
  let changedByAnyButton = false;
  for (let i = 0; i < Math.min(buttons.length, 8); i++) {
    const b = buttons[i];
    const meta = await b.evaluate((n) => ({
      name: (n.textContent || n.getAttribute("aria-label") || "?").trim().slice(0, 28),
      /* A segment that is already selected SHOULD do nothing when clicked.
         Without this the harness reports correct behaviour as a defect, and a
         warning nobody believes is worse than no warning at all. */
      alreadyActive: n.getAttribute("aria-pressed") === "true"
    }));
    const name = meta.name;
    const before = await fingerprint(id);
    try {
      await b.evaluate((n) => n.scrollIntoView({ block: "center", behavior: "instant" }));
      await b.click({ delay: 20 });
    } catch (e) {
      bag.fails.push(`[${id}] button "${name}" is not clickable: ${String(e.message).slice(0, 90)}`);
      continue;
    }
    await new Promise((r) => setTimeout(r, 700));
    const after = await fingerprint(id);
    if (after !== before) changedByAnyButton = true;
    else if (meta.alreadyActive) bag.notes.push(`[${id}] "${name}" was already the active segment (no change is correct)`);
    else bag.warnings.push(`[${id}] button "${name}" changed nothing`);
    /* Capture through the element handle. A hand-rolled clip mixes page and
       viewport coordinate spaces and silently photographs the wrong region. */
    await page.$(sel).then((h) => h && h.screenshot({ path: join(dir, `${id}-btn${i}.png`) })).catch(() => {});
  }
  if (buttons.length && !changedByAnyButton) {
    bag.fails.push(`[${id}] has ${buttons.length} buttons and not one of them changed the scene`);
  }

  /* Exactly one segment active in any segmented control. */
  const segCheck = await page.evaluate((s) => {
    const out = [];
    document.querySelectorAll(`${s} .seg`).forEach((g, i) => {
      const on = g.querySelectorAll('[aria-pressed="true"]').length;
      if (on !== 1) out.push(`seg#${i} has ${on} pressed`);
    });
    return out;
  }, sel);
  segCheck.forEach((m) => bag.fails.push(`[${id}] ${m}`));

  /* ── Sliders ───────────────────────────────────────────────────────────── */
  for (const s of sliders) {
    const info = await s.evaluate((n) => ({ min: +n.min, max: +n.max, val: +n.value, id: n.id || n.name || "range" }));
    const before = await fingerprint(id);
    await s.evaluate((n, v) => {
      n.value = String(v);
      n.dispatchEvent(new Event("input", { bubbles: true }));
      n.dispatchEvent(new Event("change", { bubbles: true }));
    }, info.min + (info.max - info.min) * 0.92);
    await new Promise((r) => setTimeout(r, 800));
    const after = await fingerprint(id);
    if (after === before) bag.fails.push(`[${id}] slider "${info.id}" changed nothing`);

    /* Keyboard must work too, not only the pointer. */
    await s.focus();
    const kBefore = await fingerprint(id);
    await page.keyboard.press("ArrowLeft");
    await page.keyboard.press("ArrowLeft");
    await new Promise((r) => setTimeout(r, 500));
    if ((await fingerprint(id)) === kBefore) bag.fails.push(`[${id}] slider "${info.id}" ignores arrow keys`);

    /* And the extremes must not break the layout. */
    for (const v of [info.min, info.max]) {
      await s.evaluate((n, x) => { n.value = String(x); n.dispatchEvent(new Event("input", { bubbles: true })); }, v);
      await new Promise((r) => setTimeout(r, 400));
    }
    const overflow = await page.evaluate((sc) => {
      const n = document.querySelector(`[data-scene="${sc}"]`);
      const svg = n && n.querySelector("svg");
      if (!svg) return null;
      const b = svg.getBoundingClientRect();
      let worst = 0, who = "";
      n.querySelectorAll("text").forEach((t) => {
        const r = t.getBoundingClientRect();
        if (!r.width) return;
        const o = Math.max(b.left - r.left, r.right - b.right);
        if (o > worst) { worst = o; who = (t.textContent || "").slice(0, 24); }
      });
      return worst > 1.5 ? `"${who}" escapes by ${Math.round(worst)}px at a slider extreme` : null;
    }, id);
    if (overflow) bag.fails.push(`[${id}] ${overflow}`);
  }

  /* ── Tooltip sweep ─────────────────────────────────────────────────────────
     mouse.move takes VIEWPORT coordinates; boundingBox returns PAGE
     coordinates. Mixing them aims the pointer above the visible viewport once
     the page has scrolled, and every tooltip then reports "never appeared".
     Measure the rect in viewport space instead, and sweep three rows, because
     a figure taller than the viewport has no single interesting band. */
  const vpBox = await page.$eval(sel, (n) => {
    const r = n.getBoundingClientRect();
    return { x: r.left, y: r.top, width: r.width, height: r.height, vh: window.innerHeight };
  });
  const box = vpBox;
  if (box && box.height > 60) {
    const seen = new Set();
    const rows = [0.3, 0.5, 0.7];
    for (let k = 0; k <= 12; k++) {
      const x = box.x + box.width * (0.08 + 0.84 * (k / 12));
      /* Clamp into the part of the figure actually on screen. */
      const top = Math.max(box.y, 4), bot = Math.min(box.y + box.height, box.vh - 4);
      const y = top + (bot - top) * rows[k % rows.length];
      if (bot - top < 40) break;
      await page.mouse.move(x, y);
      await new Promise((r) => setTimeout(r, 90));
      const t = await page.evaluate((s) => {
        const tip = document.querySelector(`${s} .tip`);
        if (!tip) return null;
        const st = getComputedStyle(tip);
        if (st.display === "none" || st.visibility === "hidden" || +st.opacity < 0.1) return null;
        const r = tip.getBoundingClientRect();
        const host = document.querySelector(s).getBoundingClientRect();
        return {
          text: (tip.innerText || "").trim().slice(0, 60),
          pe: st.pointerEvents,
          overflows: r.right > host.right + 2 || r.left < host.left - 2 || r.bottom > window.innerHeight
        };
      }, sel);
      if (t) {
        seen.add(t.text);
        if (t.pe !== "none") bag.fails.push(`[${id}] tooltip does not set pointer-events: none (it will flicker)`);
        if (t.overflows) bag.fails.push(`[${id}] tooltip overflows its container`);
      }
    }
    const hasTip = await page.$(`${sel} .tip`);
    if (hasTip && seen.size === 1) bag.warnings.push(`[${id}] tooltip showed the same content everywhere`);
    if (hasTip && seen.size === 0) bag.warnings.push(`[${id}] tooltip element exists but never appeared on a pointer sweep`);
    await page.mouse.move(5, 5);
  }

  /* ── Table fallback ────────────────────────────────────────────────────── */
  if (!details.length) bag.warnings.push(`[${id}] no <details> table fallback`);
  for (const d of details) {
    const rows = await d.evaluate((n) => { n.open = true; return n.querySelectorAll("tbody tr").length; });
    if (rows === 0) bag.fails.push(`[${id}] <details> fallback has an empty table`);
    await d.evaluate((n) => { n.open = false; });
  }
}

/* ── Keyboard: can you reach everything, and can you see where you are? ──── */
const kb = await page.evaluate(() => {
  const focusables = [...document.querySelectorAll(
    "a[href], button:not([disabled]), input:not([disabled]), select, summary, [tabindex]:not([tabindex='-1'])")]
    .filter((n) => n.getBoundingClientRect().width > 0);
  return { count: focusables.length };
});
bag.notes.push(`focusable controls: ${kb.count}`);
if (kb.count < 8) bag.fails.push(`only ${kb.count} focusable controls on the whole page; the piece is meant to be interactive`);

let ringless = 0;
for (let i = 0; i < Math.min(kb.count, 26); i++) {
  await page.keyboard.press("Tab");
  const ok = await page.evaluate(() => {
    const a = document.activeElement;
    if (!a || a === document.body) return true;
    const st = getComputedStyle(a);
    const has = (st.outlineStyle !== "none" && parseFloat(st.outlineWidth) > 0.5) ||
                st.boxShadow !== "none" ||
                getComputedStyle(a, ":focus-visible").outlineStyle !== "none";
    return has;
  });
  if (!ok) ringless++;
}
if (ringless > 2) bag.fails.push(`${ringless} focused controls showed no visible focus ring`);

/* ── Theme flip must redraw, not just recolour the chrome ────────────────── */
const beforeTheme = await fingerprint(scenes[1] || scenes[0]);
await page.evaluate(() => document.documentElement.setAttribute("data-theme", "dark"));
await new Promise((r) => setTimeout(r, 900));
const themeOk = await page.evaluate(() => {
  const bad = [];
  document.querySelectorAll("[data-scene] text").forEach((t) => {
    const f = getComputedStyle(t).fill;
    const m = f.match(/rgba?\(([^)]+)\)/);
    if (!m) return;
    const [r, g, b] = m[1].split(",").map(Number);
    if (r < 60 && g < 60 && b < 60) bad.push((t.textContent || "").slice(0, 24));
  });
  return bad.slice(0, 6);
});
if (themeOk.length) bag.fails.push(`dark theme: ${themeOk.length} chart labels still painted near-black (stale token): ${themeOk.join(", ")}`);
await page.screenshot({ path: join(dir, "_dark-after-flip.png"), fullPage: false });
await page.evaluate(() => document.documentElement.setAttribute("data-theme", "light"));

/* ── Reduced motion must still deliver the finding ───────────────────────── */
const rm = await browser.newPage();
watch(rm, bag);
await rm.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }]);
await rm.setViewport({ width: 1280, height: 900 });
await rm.goto(wrap("light"), { waitUntil: "networkidle0" });
await ready(rm);
await new Promise((r) => setTimeout(r, 1500));
const rmState = await rm.evaluate(() => {
  const out = { blankScenes: [], hiddenReveals: 0 };
  document.querySelectorAll("[data-scene]").forEach((n) => {
    const marks = n.querySelectorAll("circle,rect,path,line,text,canvas").length;
    if (marks < 3) out.blankScenes.push(n.getAttribute("data-scene"));
  });
  document.querySelectorAll(".reveal").forEach((n) => {
    if (parseFloat(getComputedStyle(n).opacity) < 0.5) out.hiddenReveals++;
  });
  return out;
});
rmState.blankScenes.forEach((s) => bag.fails.push(`reduced motion: scene "${s}" renders almost nothing`));
if (rmState.hiddenReveals) bag.fails.push(`reduced motion: ${rmState.hiddenReveals} .reveal blocks stayed invisible`);
await rm.screenshot({ path: join(dir, "_reduced-motion.png"), fullPage: true });
await rm.close();

await browser.close();
bag.notes.push("interaction shots in " + dir);
process.exit(report("INTERACT", bag) ? 1 : 0);
