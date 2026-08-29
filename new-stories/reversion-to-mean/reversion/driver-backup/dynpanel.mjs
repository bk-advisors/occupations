/* dynpanel.mjs — behaviour of the rebuilt dynasties panel, measured rather than
   assumed. Every assertion below is one the screenshots cannot make. */
import { launch, wrap, ready, settle } from "./lib.mjs";

const SEL = '[data-scene="dynasties"]';
const fails = [];
const b = await launch();

for (const vp of [[1440, 900], [820, 1180], [390, 844]]) {
  const p = await b.newPage();
  const errs = [];
  p.on("pageerror", (e) => errs.push(String(e.message).slice(0, 200)));
  await p.setViewport({ width: vp[0], height: vp[1] });
  await p.goto(wrap("light"), { waitUntil: "networkidle0" });
  await ready(p);
  await settle(p);
  const tag = `${vp[0]}px`;

  /* ── 1. the reveal actually moves something ───────────────────────────── */
  const spread = (t) =>
    p.evaluate(async (s, tt) => {
      const inst = RTM.live("dynasties");
      inst.progress(tt);
      await new Promise((r) => requestAnimationFrame(r));
      const n = document.querySelector(s);
      const rules = [...n.querySelectorAll("svg > g:nth-of-type(4) > g > line:not([stroke-dasharray])")];
      let sum = 0, shown = 0;
      rules.forEach((l) => {
        const d = Math.abs(+l.getAttribute("x2") - +l.getAttribute("x1"));
        sum += d;
        if (+l.getAttribute("opacity") > 0.5 && d > 1) shown++;
      });
      return { rules: rules.length, sum: Math.round(sum), shown };
    }, SEL, t);

  const at0 = await spread(0);
  const at05 = await spread(0.5);
  const at1 = await spread(1);
  if (at0.rules !== 40) fails.push(`${tag}: expected 40 connecting rules, found ${at0.rules}`);
  if (at0.sum > 2) fails.push(`${tag}: at progress(0) the rules already span ${at0.sum}px`);
  if (!(at05.sum > at0.sum && at1.sum > at05.sum))
    fails.push(`${tag}: reveal is not monotone (${at0.sum} -> ${at05.sum} -> ${at1.sum})`);
  if (at1.shown < 25) fails.push(`${tag}: only ${at1.shown} rules visible at the end`);

  /* ── 2. one accent, one grey, nothing else ────────────────────────────── */
  const hues = await p.evaluate((s) => {
    const n = document.querySelector(s);
    const seen = {};
    n.querySelectorAll("svg circle, svg line, svg path").forEach((m) => {
      const c = getComputedStyle(m);
      [c.stroke, c.fill].forEach((v) => {
        if (!v || v === "none") return;
        seen[v] = (seen[v] || 0) + 1;
      });
    });
    return seen;
  }, SEL);
  const hueList = Object.keys(hues);
  if (hueList.length > 6) fails.push(`${tag}: ${hueList.length} distinct mark colours: ${hueList.join(" ")}`);
  console.log(`  ${tag} mark colours: ` + hueList.map((k) => `${k} x${hues[k]}`).join("  "));

  /* ── 3. row bands: the hit test finds the row under the pointer ────────── */
  const probe = await p.evaluate(async (s) => {
    const n = document.querySelector(s);
    n.scrollIntoView({ block: "start", behavior: "instant" });
    await new Promise((r) => setTimeout(r, 120));
    const svg = n.querySelector("svg");
    const r = svg.getBoundingClientRect();
    return { left: r.left, top: r.top, width: r.width, height: r.height };
  }, SEL);

  /* The panel is taller than the viewport, and mouse.move takes VIEWPORT
     coordinates while getBoundingClientRect gives the visible slice. Sweep only
     the band that is actually on screen, or every hover aims below the window
     and reports a tooltip that never appeared. */
  const vTop = Math.max(probe.top, 4);
  const vBot = Math.min(probe.top + probe.height, vp[1] - 4);
  const texts = new Set();
  for (const frac of [0.18, 0.3, 0.42, 0.55, 0.68, 0.8]) {
    await p.mouse.move(probe.left + probe.width * 0.62, vTop + (vBot - vTop) * frac);
    await new Promise((r) => setTimeout(r, 80));
    const t = await p.evaluate((s) => {
      const tip = document.querySelector(`${s} .tip`);
      if (!tip || tip.hasAttribute("hidden")) return null;
      return { txt: (tip.innerText || "").split("\n")[0], show: tip.getAttribute("data-show"),
               op: getComputedStyle(tip).opacity };
    }, SEL);
    if (!t) { fails.push(`${tag}: no tooltip at ${Math.round(frac * 100)}% down the panel`); continue; }
    if (t.show !== "true" || +t.op < 0.9) fails.push(`${tag}: tooltip present but not painted (${t.show}/${t.op})`);
    texts.add(t.txt);
  }
  if (texts.size < 4) fails.push(`${tag}: tooltip showed only ${texts.size} distinct families over 6 rows`);
  await p.mouse.move(2, 2);

  /* ── 4. filter dims and moves the mean rule, never a scale ────────────── */
  const before = await p.evaluate((s) => {
    const n = document.querySelector(s);
    const ticks = [...n.querySelectorAll("svg text")].filter((t) => /^[+−]?\d+σ$/.test(t.textContent.trim()));
    return {
      ticks: ticks.map((t) => t.getAttribute("x") + ":" + t.textContent.trim()).join("|"),
      sumLine: (() => {
        const l = n.querySelector("svg > g:nth-of-type(3) line");
        return l ? l.getAttribute("x1") + "," + l.getAttribute("x2") : "";
      })()
    };
  }, SEL);

  const btns = await p.$$(`${SEL} .seg-btn`);
  const names = [];
  for (const btn of btns) names.push((await btn.evaluate((n) => n.textContent.trim())));
  const polIdx = names.findIndex((x) => /POLITICS|Politics/i.test(x));
  if (polIdx < 0) fails.push(`${tag}: no Politics segment (${names.join(", ")})`);
  else {
    await btns[polIdx].click();
    await new Promise((r) => setTimeout(r, 700));
    const after = await p.evaluate((s) => {
      const n = document.querySelector(s);
      const ticks = [...n.querySelectorAll("svg text")].filter((t) => /^[+−]?\d+σ$/.test(t.textContent.trim()));
      let dim = 0, full = 0;
      n.querySelectorAll("svg > g:nth-of-type(4) > g").forEach((g) => {
        const c = g.querySelector("circle");
        const o = c ? +c.getAttribute("opacity") : 1;
        if (o < 0.3) dim++; else full++;
      });
      const lab = [...n.querySelectorAll("svg text")].map((t) => t.textContent.trim())
        .find((t) => /, mean$/.test(t) || /^Politics/.test(t)) || "";
      return {
        ticks: ticks.map((t) => t.getAttribute("x") + ":" + t.textContent.trim()).join("|"),
        dim, full, lab,
        sumLine: (() => {
          const l = n.querySelector("svg > g:nth-of-type(3) line");
          return l ? l.getAttribute("x1") + "," + l.getAttribute("x2") : "";
        })(),
        pressed: [...n.querySelectorAll('.seg-btn[aria-pressed="true"]')].length
      };
    }, SEL);
    if (after.ticks !== before.ticks) fails.push(`${tag}: the axis MOVED when a domain was picked`);
    if (after.dim < 20) fails.push(`${tag}: filter dimmed only ${after.dim} rows`);
    if (after.full < 8 || after.full > 16) fails.push(`${tag}: filter left ${after.full} rows lit, expected about 12`);
    if (after.sumLine === before.sumLine) fails.push(`${tag}: the mean rule did not move on filter`);
    if (after.pressed !== 1) fails.push(`${tag}: ${after.pressed} segments pressed`);
    if (!/Politics/.test(after.lab)) fails.push(`${tag}: summary row still reads "${after.lab}"`);

    /* The filter must SURVIVE a redraw. A theme flip and a resize both call
       draw() again, and a rebuild that forgets the active filter leaves every
       row lit while the segment still reads POLITICS. Measured, because a click
       test that never redraws cannot see it. */
    const survives = await p.evaluate(async (s) => {
      const n = document.querySelector(s);
      const out = {};
      const count = () => {
        let dim = 0;
        n.querySelectorAll("svg > g:nth-of-type(4) > g").forEach((g) => {
          const c = g.querySelector("circle");
          if (c && +c.getAttribute("opacity") < 0.3) dim++;
        });
        return dim;
      };
      document.documentElement.setAttribute("data-theme", "dark");
      await new Promise((r) => setTimeout(r, 700));
      out.afterTheme = count();
      document.documentElement.setAttribute("data-theme", "light");
      await new Promise((r) => setTimeout(r, 700));
      RTM.live("dynasties").draw(Math.round(n.getBoundingClientRect().width));
      await new Promise((r) => setTimeout(r, 200));
      out.afterDraw = count();
      out.pressed = [...n.querySelectorAll('.seg-btn[aria-pressed="true"]')]
        .map((x) => x.textContent.trim()).join(",");
      return out;
    }, SEL);
    if (survives.afterTheme < 20)
      fails.push(`${tag}: a theme flip dropped the filter (${survives.afterTheme} rows dim, segment says ${survives.pressed})`);
    if (survives.afterDraw < 20)
      fails.push(`${tag}: a redraw dropped the filter (${survives.afterDraw} rows dim, segment says ${survives.pressed})`);

    /* back to all */
    await btns[0].click();
    await new Promise((r) => setTimeout(r, 600));
  }

  /* ── 5. keyboard: one tab stop, arrows walk the rows ──────────────────── */
  const kb = await p.evaluate(async (s) => {
    const chart = document.querySelector(`${s} .chart`);
    chart.focus();
    const live = document.querySelector(`${s} [aria-live]`);
    const seen = [];
    for (let i = 0; i < 4; i++) {
      chart.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
      await new Promise((r) => setTimeout(r, 60));
      seen.push((live.textContent || "").slice(0, 30));
    }
    const tip = document.querySelector(`${s} .tip`);
    return {
      focused: document.activeElement === chart,
      unique: new Set(seen).size,
      first: seen[0],
      tipShown: tip && tip.getAttribute("data-show") === "true",
      pe: tip ? getComputedStyle(tip).pointerEvents : "?"
    };
  }, SEL);
  if (!kb.focused) fails.push(`${tag}: .chart did not take focus`);
  if (kb.unique < 4) fails.push(`${tag}: arrow keys announced only ${kb.unique} of 4 rows`);
  if (!kb.tipShown) fails.push(`${tag}: keyboard did not open the tooltip`);
  if (kb.pe !== "none") fails.push(`${tag}: .tip pointer-events is ${kb.pe}`);

  /* ── 6. the estimate ranges are drawn, and only on judged placements ──── */
  const bands = await p.evaluate((s) => {
    const n = document.querySelector(s);
    const rows = [...n.querySelectorAll("svg > g:nth-of-type(4) > g")];
    let withBand = 0;
    rows.forEach((g) => { if (g.querySelector("line[stroke-dasharray]")) withBand++; });
    return { rows: rows.length, withBand };
  }, SEL);
  if (bands.withBand !== 13) fails.push(`${tag}: ${bands.withBand} rows carry an uncertainty range, expected 13`);

  if (errs.length) fails.push(`${tag}: page errors ${errs.join(" / ")}`);
  console.log(`${tag}  rules ${at0.rules}  reveal ${at0.sum}->${at05.sum}->${at1.sum}  ` +
              `tooltip rows ${texts.size}  colours ${hueList.length}  bands ${bands.withBand}  ` +
              `kb ${kb.unique}/4`);
  await p.close();
}

await b.close();
console.log("\n" + (fails.length ? "FAILURES\n  " + fails.join("\n  ") : "dynpanel: no failures"));
process.exit(fails.length ? 1 : 0);
