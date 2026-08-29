/* audit.mjs — the checks eyeballing misses.
   Label collisions, text escaping its frame, labels struck through by a rule,
   contrast, tap targets, focus rings, and a prose scan for banned language.

   Every detector here must be confirmed to fire on a bug we already know about
   before its "pass" is worth anything. See --selftest. */
import { launch, wrap, watch, settle, ready, WIDTHS, report } from "./lib.mjs";

const bag = { errors: [], warnings: [], notes: [], fails: [] };
const browser = await launch();
const selftest = process.argv.includes("--selftest");

const DETECTORS = `
(function () {
  const R = (n) => n.getBoundingClientRect();
  const area = (r) => Math.max(0, r.width) * Math.max(0, r.height);
  const inter = (a, b) => {
    const x = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
    const y = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
    return x * y;
  };
  const label = (n) => (n.textContent || "").trim().slice(0, 34);
  const sceneOf = (n) => n.closest("[data-scene]")?.getAttribute("data-scene") || "page";

  /* ── 1. SVG text collisions ──────────────────────────────────────────────
     Real client rects, not getBBox mixed with getCTM: that comparison silently
     passes at one viewport width and fails at another for no real reason.
     Axis ticks are excluded from each other (same size, same row or column,
     same parent), because evenly spaced ticks are not a collision.          */
  const collisions = [];
  document.querySelectorAll("svg").forEach((svg) => {
    if (svg.id === "rtm-defs") return;
    const texts = [...svg.querySelectorAll("text")].filter((t) => {
      const r = R(t);
      const st = getComputedStyle(t);
      return r.width > 1 && r.height > 1 && st.visibility !== "hidden" &&
             st.display !== "none" && parseFloat(st.opacity || "1") > 0.15 &&
             (t.textContent || "").trim().length;
    });
    for (let i = 0; i < texts.length; i++) {
      for (let j = i + 1; j < texts.length; j++) {
        const A = texts[i], B = texts[j];
        const ra = R(A), rb = R(B);
        const ov = inter(ra, rb);
        if (ov <= 0) continue;
        const frac = ov / Math.min(area(ra), area(rb));
        if (frac < 0.16) continue;
        const sameSize = Math.abs(parseFloat(getComputedStyle(A).fontSize) - parseFloat(getComputedStyle(B).fontSize)) < 0.6;
        const sameParent = A.parentNode === B.parentNode;
        const sameRow = Math.abs(ra.top - rb.top) < 2.5;
        const sameCol = Math.abs(ra.left - rb.left) < 2.5;
        if (sameSize && sameParent && (sameRow || sameCol)) continue;
        collisions.push({
          scene: sceneOf(svg), a: label(A), b: label(B),
          overlap: Math.round(frac * 100)
        });
      }
    }
  });

  /* ── 2. Text escaping its own SVG frame ─────────────────────────────────── */
  const escaped = [];
  document.querySelectorAll("svg").forEach((svg) => {
    if (svg.id === "rtm-defs") return;
    const box = R(svg);
    if (box.width < 4) return;
    svg.querySelectorAll("text").forEach((t) => {
      const r = R(t);
      if (r.width < 1 || !(t.textContent || "").trim()) return;
      const out = Math.max(box.left - r.left, r.right - box.right, box.top - r.top, r.bottom - box.bottom);
      if (out > 1.5) escaped.push({ scene: sceneOf(svg), text: label(t), by: Math.round(out) });
    });
  });

  /* ── 3. Labels struck through by a rule ──────────────────────────────────
     Only when the line FOLLOWS the text in document order: a gridline behind a
     haloed label is correct, a rule painted on top is the bug. Diagonals are
     skipped because their bounding box is not the stroke. Test the inner 55%
     of the em box, or a rule grazing the ascender gap false-positives.       */
  const struck = [];
  document.querySelectorAll("svg").forEach((svg) => {
    if (svg.id === "rtm-defs") return;
    const lines = [...svg.querySelectorAll("line")].filter((l) => {
      const x1 = +l.getAttribute("x1"), x2 = +l.getAttribute("x2");
      const y1 = +l.getAttribute("y1"), y2 = +l.getAttribute("y2");
      const dx = Math.abs(x2 - x1), dy = Math.abs(y2 - y1);
      return dx < 1.5 || dy < 1.5;                       // axis aligned only
    });
    svg.querySelectorAll("text").forEach((t) => {
      if (!(t.textContent || "").trim()) return;
      const r = R(t);
      if (r.width < 2) return;
      const inset = { left: r.left + r.width * 0.06, right: r.right - r.width * 0.06,
                      top: r.top + r.height * 0.225, bottom: r.bottom - r.height * 0.225 };
      lines.forEach((l) => {
        if (!(t.compareDocumentPosition(l) & Node.DOCUMENT_POSITION_FOLLOWING)) return;
        const lr = R(l);
        const hit = Math.max(0, Math.min(inset.right, lr.right) - Math.max(inset.left, lr.left)) *
                    Math.max(0, Math.min(inset.bottom, lr.bottom + 0.5) - Math.max(inset.top, lr.top - 0.5));
        if (hit > 0) struck.push({ scene: sceneOf(svg), text: label(t) });
      });
    });
  });

  /* ── 4. Contrast ─────────────────────────────────────────────────────────
     WCAG relative luminance. Backgrounds are walked up the tree until an
     opaque one is found, which is what the eye actually sees.               */
  const parse = (c) => {
    const m = c.match(/rgba?\\(([^)]+)\\)/);
    if (!m) return null;
    const p = m[1].split(",").map(Number);
    return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
  };
  const lum = (c) => {
    const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
  };
  const ratio = (a, b) => {
    const L1 = lum(a), L2 = lum(b);
    return (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
  };
  const bgOf = (n) => {
    let e = n;
    while (e && e !== document.documentElement) {
      const c = parse(getComputedStyle(e).backgroundColor);
      if (c && c.a > 0.85) return c;
      e = e.parentElement || (e.parentNode && e.parentNode.host) || null;
    }
    return parse(getComputedStyle(document.body).backgroundColor) || { r: 255, g: 255, b: 255, a: 1 };
  };
  const lowContrast = [];
  const sel = "p, li, h1, h2, h3, figcaption, .fig-title, .fig-sub, .fig-note, .readout, .btn, .seg-btn, .ctrl-label, .hint, .badge, text, td, th, summary";
  document.querySelectorAll(sel).forEach((n) => {
    const txt = (n.textContent || "").trim();
    if (!txt) return;
    const r = R(n);
    if (r.width < 2 || r.height < 2) return;
    const st = getComputedStyle(n);
    if (st.visibility === "hidden" || st.display === "none") return;
    const opacity = parseFloat(st.opacity || "1");
    if (opacity < 0.3) return;
    const fg = parse(n.tagName === "text" ? (st.fill || st.color) : st.color);
    if (!fg) return;
    const bg = bgOf(n.tagName === "text" ? (n.closest("[data-scene]") || document.body) : n);
    const cr = ratio(fg, bg);
    const size = parseFloat(st.fontSize);
    const weight = parseInt(st.fontWeight, 10) || 400;
    const large = size >= 24 || (size >= 18.66 && weight >= 700);
    const need = large ? 3 : 4.5;
    if (cr < need - 0.05) {
      lowContrast.push({ scene: sceneOf(n), text: txt.slice(0, 30), ratio: cr.toFixed(2), need, size: Math.round(size) });
    }
  });

  /* ── 5. Controls: tap target and focus ring ─────────────────────────────── */
  const controls = [];
  document.querySelectorAll("button, input, select, summary, [tabindex]:not([tabindex='-1']), a[href]").forEach((n) => {
    const r = R(n);
    if (r.width < 1) return;
    const small = (r.width < 30 || r.height < 24);
    if (small) controls.push({ scene: sceneOf(n), what: label(n) || n.tagName, size: Math.round(r.width) + "x" + Math.round(r.height) });
  });

  /* ── 6. Prose scan: em-dashes and AI tells in RENDERED text ────────────── */
  const body = document.body.innerText || "";
  const emDash = (body.match(/\\u2014/g) || []).length;
  const TELLS = ["delve","tapestry","testament to","in a world where","underscore","a stark reminder",
                 "at its core","the reality is","seamless","navigating the","unlock the","moreover",
                 "furthermore","it is important to note","crucial to note","stands as a","profound"];
  const tells = TELLS.filter((t) => body.toLowerCase().includes(t));

  /* ── 7. Structure ────────────────────────────────────────────────────────── */
  const headings = [...document.querySelectorAll("h1,h2,h3")].map((n) => n.tagName + " " + label(n));
  const h1s = document.querySelectorAll("h1").length;
  const noAlt = [...document.querySelectorAll("svg[role='img']")].filter(
    (s) => !s.getAttribute("aria-label") && !s.querySelector("title")).length;
  const imgRoleInteractive = [...document.querySelectorAll("svg[role='img']")].filter(
    (s) => s.querySelector("[tabindex],button")).length;

  return { collisions, escaped, struck, lowContrast, controls,
           emDash, tells, headings, h1s, noAlt, imgRoleInteractive,
           words: body.trim().split(/\\s+/).length };
})()
`;

for (const theme of ["light", "dark"]) {
  const url = wrap(theme);
  for (const vp of WIDTHS) {
    const page = await browser.newPage();
    watch(page, bag);
    await page.setViewport({ width: vp.w, height: vp.h, deviceScaleFactor: 1 });
    await page.goto(url, { waitUntil: "networkidle0", timeout: 30000 });
    await ready(page);
    await settle(page);
    /* Scroll the whole page once so sticky scrolly stages settle where a
       reader would actually see them, then measure. */
    await page.evaluate(async () => {
      const H = document.documentElement.scrollHeight;
      for (let y = 0; y < H; y += window.innerHeight * 0.8) {
        window.scrollTo(0, y);
        await new Promise((r) => setTimeout(r, 60));
      }
      window.scrollTo(0, 0);
      await new Promise((r) => setTimeout(r, 200));
    });

    const res = await page.evaluate(DETECTORS);
    const tag = `${theme}/${vp.name}`;

    const uniq = (arr, key) => [...new Map(arr.map((x) => [key(x), x])).values()];

    uniq(res.collisions, (c) => c.scene + c.a + c.b).slice(0, 25).forEach((c) =>
      bag.fails.push(`${tag} COLLIDE [${c.scene}] "${c.a}" x "${c.b}" (${c.overlap}%)`));
    uniq(res.escaped, (c) => c.scene + c.text).slice(0, 20).forEach((c) =>
      bag.fails.push(`${tag} ESCAPES FRAME [${c.scene}] "${c.text}" by ${c.by}px`));
    uniq(res.struck, (c) => c.scene + c.text).slice(0, 20).forEach((c) =>
      bag.fails.push(`${tag} STRUCK THROUGH [${c.scene}] "${c.text}"`));
    uniq(res.lowContrast, (c) => c.scene + c.text).slice(0, 25).forEach((c) =>
      bag.fails.push(`${tag} CONTRAST [${c.scene}] "${c.text}" ${c.ratio}:1 needs ${c.need} (${c.size}px)`));
    uniq(res.controls, (c) => c.scene + c.what).slice(0, 15).forEach((c) =>
      bag.warnings.push(`${tag} small target [${c.scene}] ${c.what} ${c.size}`));

    if (theme === "light" && vp.name === "desktop") {
      if (res.emDash) bag.fails.push(`PROSE: ${res.emDash} em-dash(es) in rendered text`);
      if (res.tells.length) bag.fails.push(`PROSE: AI tells present: ${res.tells.join(", ")}`);
      if (res.h1s !== 1) bag.fails.push(`STRUCTURE: ${res.h1s} h1 elements, expected 1`);
      if (res.noAlt) bag.fails.push(`A11Y: ${res.noAlt} svg[role=img] without a text alternative`);
      if (res.imgRoleInteractive) bag.fails.push(`A11Y: ${res.imgRoleInteractive} interactive svg using role="img" (prunes the subtree)`);
      bag.notes.push(`words: ${res.words}`);
      bag.notes.push("headings: " + res.headings.join(" | "));
    }
    await page.close();
  }
}

/* ── Self test ────────────────────────────────────────────────────────────
   Confirm each detector fires on a bug we plant, before trusting a pass. The
   first version of the strike-through check missed its target case by 0.3px
   and reported a clean sweep. */
if (selftest) {
  const page = await browser.newPage();
  await page.setViewport({ width: 900, height: 700 });
  await page.setContent(`<!doctype html><body style="background:#fff;margin:0">
    <div data-scene="planted"><svg width="600" height="300" viewBox="0 0 600 300">
      <text x="100" y="100" font-size="14" fill="#111">Colliding label A</text>
      <text x="112" y="104" font-size="14" fill="#111">Colliding label B</text>
      <text x="560" y="200" font-size="14" fill="#111">This one escapes the right edge badly</text>
      <text x="100" y="250" font-size="14" fill="#111">Struck through label</text>
      <line x1="60" y1="246" x2="400" y2="246" stroke="#000" stroke-width="2"/>
      <text x="100" y="280" font-size="12" fill="#EDEDED">Low contrast text</text>
    </svg></div></body>`);
  const r = await page.evaluate(DETECTORS);
  const checks = [
    ["collision", r.collisions.length > 0],
    ["escape", r.escaped.length > 0],
    ["strike-through", r.struck.length > 0],
    ["contrast", r.lowContrast.length > 0]
  ];
  console.log("\nSELF TEST (each must FIRE on a planted bug)");
  checks.forEach(([n, ok]) => console.log(`  ${ok ? "fires" : "SILENT  <-- detector is broken"}  ${n}`));
  checks.forEach(([n, ok]) => { if (!ok) bag.fails.push(`SELFTEST: ${n} detector did not fire on a planted bug`); });
  await page.close();
}

await browser.close();
process.exit(report("AUDIT", bag) ? 1 : 0);
