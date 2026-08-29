/* ============================================================================
   SCENE 6  ·  SURVIVORS  ·  the selection effect that makes every other chart
   of this kind wrong.

   A chart of famous parents and their famous children can only contain pairs
   where BOTH cleared the bar. The children who reverted all the way out of the
   profession are not low points on the chart. They are not on the chart at all.

   Three beats, driven by progress(t) and reachable by keyboard:
     1  the visible pairs, and a line fitted through them
     2  the children nobody hears about, simulated under a stated model and
        drawn so they cannot be mistaken for data: tinted zone, outline only,
        SIMULATED badge
     3  the line swings to the slope through everything on the chart

   Nothing here is observed except the solid marks. That is stated in the
   figure, not in a footnote.

   WHY THE HEADLINE IS NOT THE SLOPE PAIR. The fitted slope goes UP when the
   missing children are added, from 0.37 to 0.72, because cutting the children
   off at a bar flattens the line you can see. A reader takes a steeper line to
   mean stronger inheritance, which is the opposite of what this section argues.
   So the headline carries the two numbers that point the right way: the share
   of children who never clear the bar, and the drop in the EXPECTED CHILD once
   they are counted. The slope pair lives in the method note, with the sentence
   that explains why it moves.
   ========================================================================== */
(function () {
  "use strict";

  var MO = RTM.motion;
  var UID = 0;

  function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
  function tok(names, fallback) {
    for (var i = 0; i < names.length; i++) {
      var v = RTM.css(names[i]);
      if (v) return v;
    }
    return fallback;
  }
  function fmt2(v) { return (isFinite(v) ? v : 0).toFixed(2); }
  function sigTick(v) { return Math.abs(v) < 1e-9 ? "0σ" : RTM.sigma(v, 0); }

  function clipLine(a, b, x0, x1, ylo, yhi) {
    var lo = x0, hi = x1;
    if (Math.abs(b) > 1e-9) {
      var xa = (ylo - a) / b, xb = (yhi - a) / b;
      var l = Math.min(xa, xb), hg = Math.max(xa, xb);
      if (l > lo) lo = l;
      if (hg < hi) hi = hg;
    } else if (a < ylo || a > yhi) return null;
    if (hi <= lo) return null;
    return [lo, hi];
  }

  RTM.scene("survivors", function (mount) {

    var uid = "srv" + (++UID);

    /* ── the observed pairs ───────────────────────────────────────────────── */
    var src = (RTM.data && RTM.data.DYNASTIES) ? RTM.data.DYNASTIES : [];
    var all = [];
    for (var s0 = 0; s0 < src.length; s0++) {
      var p0 = src[s0];
      if (!p0 || !p0.parent || !p0.child) continue;
      if (!isFinite(p0.parent.z) || !isFinite(p0.child.z)) continue;
      all.push(p0);
    }

    RTM.clear(mount);
    if (all.length < 3) {
      RTM.h("p", { class: "fig-note", text: "Not enough pairs loaded to show the selection effect." }, mount);
      return { draw: function () {} };
    }

    /* The bar. This one is an assumption, and it is printed in the figure:
       +2σ is roughly the point at which a person is nameable in their field.
       If our own set is too far below it for the scene to work, it drops to
       the 40th percentile of the children we hold, which is stated too. */
    var childZ = all.map(function (p) { return p.child.z; }).sort(function (a, b) { return a - b; });
    var tau = 2.0, tauDerived = false;
    (function () {
      var keep = 0;
      for (var i = 0; i < all.length; i++) if (all[i].child.z >= tau) keep++;
      if (keep < Math.max(4, Math.round(all.length * 0.45))) {
        tau = childZ[Math.floor(all.length * 0.4)];
        tauDerived = true;
      }
    })();

    var visible = all.filter(function (p) { return p.child.z >= tau; })
      .sort(function (a, b) { return b.parent.z - a.parent.z; });
    var below = all.filter(function (p) { return p.child.z < tau; });

    /* ── the model, stated ────────────────────────────────────────────────── */
    var rTrue = 0.45;
    if (RTM.data && RTM.data.TRAITS) {
      for (var ti = 0; ti < RTM.data.TRAITS.length; ti++) {
        if (RTM.data.TRAITS[ti].id === "height" && isFinite(RTM.data.TRAITS[ti].r)) {
          rTrue = RTM.data.TRAITS[ti].r;
        }
      }
    }
    var sigmaE = Math.sqrt(Math.max(0, 1 - rTrue * rTrue));

    /* Seeded once, at build time. Resizing must never change a number. */
    var M = Math.max(4, Math.min(12, Math.round(360 / visible.length)));
    var rnd = RTM.rng(19640118);
    var sim = [];          /* only the children who fall below the bar */
    var weights = [];      /* how many modelled children each real pair stands for */
    var simTotal = 0, simBelow = 0;
    /* The parent z is the same for all M modelled children of one pair, so drawn
       at their true x they stack into a column and the chart reads as a picket
       fence of stripes rather than as a cloud. The DRAWN x carries a seeded
       jitter wide enough to break the column (about a fifth of a sigma each
       way); the FITTED x never does, so no number moves. */
    var JIT = 0.42;
    for (var vi = 0; vi < visible.length; vi++) {
      var pz = visible[vi].parent.z, above = 0;
      for (var k = 0; k < M; k++) {
        var cz = rTrue * pz + sigmaE * rnd.normal(0, 1);
        simTotal++;
        if (cz < tau) {
          simBelow++;
          sim.push({ x: pz, y: cz, jx: pz + (rnd() - 0.5) * JIT, of: vi, key: rnd() });
        } else above++;
      }
      weights.push(above);
    }
    sim.sort(function (a, b) { return a.key - b.key; });
    var lostShare = simTotal ? simBelow / simTotal : 0;

    /* Fit 1: the line every chart like this draws, through the visible pairs. */
    var obsFit = RTM.ols(visible, function (d) { return d.parent.z; }, function (d) { return d.child.z; });

    /* Fit 2: the line through everything on the chart. Each real pair carries
       the weight of the modelled children it stands in for, so the mixture is
       not tilted by the fact that only the lost ones are drawn. */
    var mixRows = [];
    var anyW = 0;
    for (var mi = 0; mi < visible.length; mi++) {
      anyW += weights[mi];
      mixRows.push({ x: visible[mi].parent.z, y: visible[mi].child.z, w: weights[mi] });
    }
    if (!anyW) for (var mj = 0; mj < mixRows.length; mj++) mixRows[mj].w = 1;
    for (var sj = 0; sj < sim.length; sj++) mixRows.push({ x: sim[sj].x, y: sim[sj].y, w: 1 });
    var fullFit = RTM.ols(mixRows,
      function (d) { return d.x; }, function (d) { return d.y; }, function (d) { return d.w; });

    var steeper = Math.abs(fullFit.slope) > Math.abs(obsFit.slope);
    var midX = obsFit.mx;
    var predObs = obsFit.intercept + obsFit.slope * midX;
    var predFull = fullFit.intercept + fullFit.slope * midX;
    /* The direction is read off the numbers, never asserted. If a data edit ever
       flipped it, the sentence would flip with it instead of going quietly
       wrong. */
    var predVerb = predFull < predObs - 0.005 ? "drops from " :
                   predFull > predObs + 0.005 ? "rises from " : "stays at ";

    /* The three counts a reader meets across two adjacent figures: every pair we
       hold, the ones with a measured number on both generations (which is what
       the dynasties slope is fitted to), and the ones whose child clears the bar
       (which is what a chart like this one can contain). All three are counted
       here, so the bridging sentence can never drift from the data. */
    var nAll = all.length;
    var nSolid = 0;
    for (var vq = 0; vq < all.length; vq++) {
      if (all[vq].parent.verified !== false && all[vq].child.verified !== false) nSolid++;
    }
    var dynFit = null;
    (function () {
      var rows = [];
      for (var i = 0; i < all.length; i++) {
        if (all[i].parent.verified !== false && all[i].child.verified !== false) rows.push(all[i]);
      }
      if (rows.length >= 3) {
        dynFit = RTM.ols(rows, function (d) { return d.parent.z; }, function (d) { return d.child.z; });
      }
    })();
    var galtonSlope = null;
    try {
      if (RTM.data && typeof RTM.data.galtonFit === "function") galtonSlope = RTM.data.galtonFit().slope;
    } catch (e) { galtonSlope = null; }

    /* ── domain: each axis cropped to its own data ────────────────────────────
       One shared square domain wasted half the plot. Every parent here is well
       above average and every visible child clears the bar, so the whole lower
       left of a 0-anchored square held nothing, and the interesting cluster was
       squeezed into a corner.

       Each axis is cropped to what is actually drawn on it, with a small pad.
       The y axis keeps every modelled child below the bar, because they are the
       scene. The x axis is the one that can safely be cropped, and it is: it
       starts at the lowest parent on the chart, not at zero.

       The two axes then carry DIFFERENT ranges but the SAME pixels per sigma:
       the plot rectangle is sized as (span x sigma) by (span y sigma) times one
       shared k. That is what keeps the y = x diagonal at an honest 45 degrees. */
    var xlo = Infinity, xhi = -Infinity, ylo = Infinity, yhi = -Infinity;
    (function () {
      function tx(v) { if (isFinite(v)) { if (v < xlo) xlo = v; if (v > xhi) xhi = v; } }
      function ty(v) { if (isFinite(v)) { if (v < ylo) ylo = v; if (v > yhi) yhi = v; } }
      for (var i = 0; i < visible.length; i++) { tx(visible[i].parent.z); ty(visible[i].child.z); }
      for (var j = 0; j < sim.length; j++) { tx(sim[j].jx); ty(sim[j].y); }
      ty(tau);
      var padX = Math.max(0.25, (xhi - xlo) * 0.05);
      var padY = Math.max(0.25, (yhi - ylo) * 0.05);
      xlo -= padX; xhi += padX; ylo -= padY; yhi += padY;
    })();
    /* the stretch of the diagonal both axes can show */
    var dLo = Math.max(xlo, ylo), dHi = Math.min(xhi, yhi);

    /* ── chrome ───────────────────────────────────────────────────────────── */
    var head = RTM.h("div", { class: "fig-head" }, mount);
    var titleEl = RTM.h("p", { class: "fig-title" }, head);
    var subEl = RTM.h("p", { class: "fig-sub" }, head);

    titleEl.textContent =
      RTM.pct(lostShare) + " of the children never clear the bar, so no chart like this one can " +
      "hold them. Put them back and the expected child of a parent at " + RTM.sigma(midX, 1) +
      " " + predVerb + RTM.sigma(predObs, 1) + " to " + RTM.sigma(predFull, 1) + ".";
    subEl.textContent =
      "Solid marks are the " + visible.length + " real pairs. The faint hollow marks are modelled, " +
      "not observed: children who never clear the bar, and so never appear on a chart like this " +
      "one. The model that puts them there is printed under the chart.";

    var ctrlRow = RTM.h("div", { class: "ctrl-row" }, mount);
    var stepCtrl = RTM.h("div", { class: "ctrl" }, ctrlRow);
    RTM.h("span", { class: "ctrl-label", text: "Reveal", id: uid + "-lab" }, stepCtrl);
    var seg = RTM.h("div", { class: "seg", role: "group", "aria-labelledby": uid + "-lab" }, stepCtrl);

    /* One real tab stop plus arrow keys. Chrome will not focus an SVG <g>. */
    var chart = RTM.h("div", {
      class: "chart", tabindex: "0", role: "application",
      "aria-label": "Parent z against child z for the pairs a chart like this can contain, plus " +
        "the modelled children it cannot. Use the arrow keys to move between the real pairs."
    }, mount);
    chart.style.position = "relative";
    var svg = RTM.el("svg", { xmlns: RTM.SVGNS, "aria-hidden": "true" }, chart);
    svg.style.display = "block";
    svg.style.width = "100%";

    var tip = RTM.h("div", { class: "tip", hidden: "hidden", "data-show": "false" }, chart);
    tip.style.pointerEvents = "none";
    tip.style.position = "absolute";
    /* .tip carries translate(-50%, -100%) translateY(-10px) in the stylesheet,
       which assumes the caller positions by the pointer. This scene positions
       by the top-left corner, so the transform has to be neutralised or the
       tip renders half a width left and a full height above its target. */
    tip.style.transform = "none";

    var liveRegion = RTM.h("p", { class: "sr-only", "aria-live": "polite" }, mount);
    var legend = RTM.h("div", { class: "legend" }, mount);
    var hint = RTM.h("p", { class: "hint" }, mount);
    hint.textContent = "The reveal plays once when the figure arrives. Step through it again with the " +
      "buttons above, or point anywhere in the plot to read the nearest real pair.";

    /* Two live numbers, not three. The share who never clear the bar is now the
       first clause of the title, so a box repeating it was the page saying the
       same thing twice in two type styles. */
    var outRow = RTM.h("div", { class: "ctrl-row", "aria-live": "polite" }, mount);
    var outObs, outFull;
    (function () {
      var a = RTM.h("div", { class: "ctrl" }, outRow);
      RTM.h("span", { class: "ctrl-label", text: "Slope, visible pairs" }, a);
      outObs = RTM.h("span", { class: "readout" }, a);
      var b = RTM.h("div", { class: "ctrl" }, outRow);
      RTM.h("span", { class: "ctrl-label", text: "Slope, everyone" }, b);
      outFull = RTM.h("span", { class: "readout" }, b);
    })();

    var noteModel = RTM.h("p", { class: "fig-note" }, mount);
    var noteMethod = RTM.h("p", { class: "fig-note" }, mount);
    var noteWhich = RTM.h("p", { class: "fig-note" }, mount);
    var alt = RTM.h("p", { class: "sr-only" }, mount);
    var details = RTM.h("details", { class: "tbl-wrap" }, mount);
    RTM.h("summary", { text: "The pairs, the bar, and the model behind the hollow marks" }, details);

    outObs.textContent = fmt2(obsFit.slope);
    outFull.textContent = fmt2(fullFit.slope);

    (function () {
      var b = RTM.h("span", { class: "badge", text: "SIMULATED" }, noteModel);
      b.style.marginRight = "0.4em";
      noteModel.appendChild(document.createTextNode(
        "The assumption, in full. A child z is drawn as r times the parent z plus normal noise, " +
        "with r = " + rTrue.toFixed(2) + " (the parent to child correlation for height) and a " +
        "residual spread of " + sigmaE.toFixed(2) + "σ. " + M + " children are drawn per real pair. " +
        "A child only reaches a chart like this if they clear " + RTM.sigma(tau, 1) + ", " +
        (tauDerived
          ? "the 40th percentile of the children we hold, because our own set sits low enough that a " +
            "fixed bar would empty the chart. "
          : "about " + RTM.oneIn(1 - RTM.Phi(tau)) + " of the reference group, which is roughly the " +
            "point at which a person is nameable in their field. ") +
        "Under those assumptions " + RTM.pct(lostShare) + " of the children never clear it. " +
        "That share is a consequence of the two numbers above, not a measurement of anybody, and " +
        "none of the hollow marks is a real person."
      ));
    })();

    noteMethod.textContent =
      "Method, and why the slope is not the headline. Ordinary least squares through the " +
      visible.length + " real pairs gives a slope of " + fmt2(obsFit.slope) + ". Fitted through every " +
      "mark on the chart, with each real pair weighted by the number of modelled children who did " +
      "clear the bar and are therefore already represented by it, it is " + fmt2(fullFit.slope) + ". " +
      "The " + (steeper ? "steeper" : "second") + " line is not stronger inheritance. Cutting the " +
      "children off at a bar flattens the line you can see and lifts the children you can see at the " +
      "same time, so the number that carries the argument is the drop in the expected child, not the " +
      "slope. " +
      (below.length
        ? below.length + " pair" + (below.length === 1 ? "" : "s") + " from our own set sit below the bar and " +
          "are held out here. We went looking for them. Charts like this usually do not."
        : "Every pair we hold sits above the bar, which is the problem in miniature.");

    /* Where the counts come from. Three different numbers of families appear
       across this figure and the one before it, and a reader who cannot tell
       them apart reads the piece as sloppy. */
    noteWhich.textContent =
      "The counts, reconciled. We hold " + nAll + " famous families. " + nSolid +
      " of them have a published number on both generations, and those are the ones the slope in " +
      "the previous figure is fitted to. This figure keeps the " + visible.length +
      " whose child clears the visibility bar, because those are the only ones a chart like this " +
      "one could ever contain. " +
      "The slopes in this piece, and what each one is: " +
      (galtonSlope !== null ? fmt2(galtonSlope) + " is Galton's own children, mid-parent height " +
        "against adult child. " : "") +
      (dynFit ? fmt2(dynFit.slope) + " is the " + nSolid + " famous pairs with a number on both " +
        "generations. " : "") +
      fmt2(obsFit.slope) + " is the " + visible.length + " pairs on this chart, " +
      fmt2(fullFit.slope) + " is the same chart with the modelled children added, and " +
      rTrue.toFixed(2) + " is not a slope at all: it is the parent to child correlation for height, " +
      "which is the one number the model above uses.";

    alt.textContent =
      "Under the stated model, " + RTM.pct(lostShare) + " of the children of these famous parents " +
      "never clear the bar that would put them in a data set, so they appear on no chart of this kind " +
      "at all. Counting them " + (predFull < predObs ? "lowers" : "moves") + " the expected child of a " +
      "parent at " + RTM.sigma(midX, 1) + " from " + RTM.sigma(predObs, 1) + " to " +
      RTM.sigma(predFull, 1) + ". The fitted slope moves the other way, from " + fmt2(obsFit.slope) +
      " through the visible pairs to " + fmt2(fullFit.slope) + " through everything, because cutting " +
      "the children off at a bar flattens the visible line rather than steepening it.";

    (function buildTable() {
      var t = RTM.h("table", {}, details);
      var htr = RTM.h("tr", {}, RTM.h("thead", {}, t));
      var cols = ["Family", "Parent", "Parent z", "Child", "Child z", "On a chart like this"];
      for (var c = 0; c < cols.length; c++) RTM.h("th", { scope: "col", text: cols[c] }, htr);
      var tb = RTM.h("tbody", {}, t);
      var rowsAll = visible.concat(below);
      for (var i = 0; i < rowsAll.length; i++) {
        var q = rowsAll[i], tr = RTM.h("tr", {}, tb);
        RTM.h("th", { scope: "row", text: q.family || "" }, tr);
        RTM.h("td", { text: q.parent.name || "" }, tr);
        RTM.h("td", { text: RTM.sigma(q.parent.z) }, tr);
        RTM.h("td", { text: q.child.name || "" }, tr);
        RTM.h("td", { text: RTM.sigma(q.child.z) }, tr);
        RTM.h("td", { text: q.child.z >= tau ? "yes" : "no, below the bar" }, tr);
      }
      var f = RTM.h("tfoot", {}, t);
      var ftr = RTM.h("tr", {}, f);
      RTM.h("th", { scope: "row", colspan: 2, text: "Modelled children (not real people)" }, ftr);
      RTM.h("td", { colspan: 4, text:
        simTotal + " drawn, " + simBelow + " below " + RTM.sigma(tau, 1) + " (" + RTM.pct(lostShare) +
        "), r = " + rTrue.toFixed(2) + ", residual " + sigmaE.toFixed(2) + "σ, seed 19640118" }, ftr);
    })();

    /* ── controls ─────────────────────────────────────────────────────────── */
    var STEPS = [
      { t: 0.18, label: "What you see" },
      { t: 0.62, label: "What you do not" },
      { t: 1.00, label: "The real slope" }
    ];
    var segBtns = [];
    var T = 0.18, lastT = 0, anchor = null, stepTween = null;

    for (var bi = 0; bi < STEPS.length; bi++) {
      (function (i) {
        var b = RTM.h("button", {
          class: "seg-btn", type: "button",
          "aria-pressed": i === 0 ? "true" : "false", text: STEPS[i].label
        }, seg);
        b.addEventListener("click", function () {
          anchor = lastT;
          goTo(STEPS[i].t);
        });
        segBtns.push(b);
      })(bi);
    }
    function markStep() {
      var best = 0;
      for (var i = 0; i < STEPS.length; i++) if (T >= STEPS[i].t - 0.16) best = i;
      for (i = 0; i < STEPS.length; i++) segBtns[i].setAttribute("aria-pressed", i === best ? "true" : "false");
    }
    function goTo(v) {
      if (stepTween) { stepTween.cancel(); stepTween = null; }
      stepTween = MO.tween({
        from: T, to: v, dur: 900, ease: "cubicInOut",
        onUpdate: function (val) { T = val; render(); },
        onDone: function () { T = v; stepTween = null; render(); }
      });
    }

    /* ── legend ───────────────────────────────────────────────────────────── */
    function buildLegend() {
      RTM.clear(legend);
      var accent = tok(["--outlier", "--ink"], "#b24a2e");
      var grey = tok(["--ink-3", "--ink-2"], "#8a8a8a");

      var a = RTM.h("span", { class: "legend-item" }, legend);
      var sa = RTM.el("svg", { viewBox: "-8 -8 16 16", width: 12, height: 12, "aria-hidden": "true" },
        RTM.h("span", { class: "swatch" }, a));
      RTM.el("circle", { r: 5, fill: accent }, sa);
      RTM.h("span", { text: "Real pair, both of them made it" }, a);

      var b = RTM.h("span", { class: "legend-item" }, legend);
      var sb = RTM.el("svg", { viewBox: "-8 -8 16 16", width: 12, height: 12, "aria-hidden": "true" },
        RTM.h("span", { class: "swatch" }, b));
      RTM.el("circle", { r: 5, fill: "none", stroke: grey, "stroke-width": 1.6, "stroke-dasharray": "2 1.6" }, sb);
      RTM.h("span", { class: "badge", text: "SIMULATED" }, b);
      RTM.h("span", { text: "modelled child who never cleared the bar" }, b);
    }

    /* ── geometry ─────────────────────────────────────────────────────────── */
    var G = null;
    function geom(w) {
      var g = { w: w };
      g.fs = RTM.pick(w, { s: 10, m: 11.5, l: 12.5 });
      g.mL = RTM.pick(w, { s: 38, m: 46, l: 52 });
      g.mR = RTM.pick(w, { s: 16, m: 26, l: 34 });
      g.mT = RTM.pick(w, { s: 26, m: 30, l: 34 });
      g.mB = RTM.pick(w, { s: 46, m: 52, l: 56 });

      /* One k, in pixels per sigma, shared by both axes. The plot is then as
         wide as the parent range and as tall as the child range, which is the
         only way a cropped scatter can keep the diagonal at 45 degrees. */
      var spanX = Math.max(0.5, xhi - xlo);
      var spanY = Math.max(0.5, yhi - ylo);
      var availW = Math.max(140, w - g.mL - g.mR);
      var capW = RTM.pick(w, { s: 360, m: 480, l: 620 });
      var capH = RTM.pick(w, { s: 420, m: 540, l: 620 });
      var k = Math.min(Math.min(availW, capW) / spanX, capH / spanY);
      g.pw = k * spanX;
      g.ph = k * spanY;
      g.x0 = g.mL + Math.max(0, (availW - g.pw) / 2);
      g.h = g.mT + g.ph + g.mB;
      g.x = RTM.linear(xlo, xhi, g.x0, g.x0 + g.pw);
      g.y = RTM.linear(ylo, yhi, g.mT + g.ph, g.mT);
      g.px0 = g.x0; g.px1 = g.x0 + g.pw;
      g.py0 = g.mT; g.py1 = g.mT + g.ph;
      g.rReal = RTM.pick(w, { s: 3.4, m: 4.2, l: 4.6 });
      /* Bigger than before. With the crosshatch gone there is nothing competing
         with these rings, so they can carry themselves. */
      g.rSim = Math.max(2.3, g.rReal * 0.68);
      /* Hit radius for the nearest point search, in pixels. Generous enough
         that a sweep across a sparse scatter always answers something near, and
         small enough that the empty bottom right corner stays quiet. */
      g.hitR = Math.max(32, Math.min(g.pw, g.ph) / 7);
      return g;
    }

    /* ── build ────────────────────────────────────────────────────────────── */
    var realNodes = [], simNodes = [], labReal = [];
    var bandRect = null, barLine = null, barLab = null, barLab2 = null;
    var liveLine = null, ghostLine = null, liveLab = null, ghostLab = null;
    var simGroup = null, simLab = null, simBadge = null;
    var hoverIdx = -1;

    function draw(w) {
      G = geom(Math.max(240, Math.round(w)));
      buildLegend();
      RTM.clear(svg);
      realNodes = []; simNodes = []; labReal = [];

      var ink = tok(["--ink"], "#111");
      var ink2 = tok(["--ink-2", "--ink"], "#444");
      var grey = tok(["--ink-3", "--ink-2"], "#8a8a8a");
      var rule = tok(["--rule", "--ink-3"], "#ddd");
      var accent = tok(["--outlier", "--ink"], "#b24a2e");
      var sans = tok(["--sans"], "sans-serif");

      /* The modelled zone used to be a 45 degree crosshatch. It was louder than
         the marks it contained: the whole point of the zone is the tiny hollow
         rings inside it, and a dense diagonal pattern camouflaged them. In dark
         it read as a screen door. It is now a flat 6% tint of the ink, which
         still separates the zone from the rest of the plot and leaves the rings
         as the loudest thing inside it. The marking that says "modelled" is
         carried four ways over: this tint, the outline-only rings, the
         "modelled, not observed" label, and the SIMULATED badge. */
      var gFrame = RTM.el("g", {}, svg);
      var gZone = RTM.el("g", {}, svg);
      var gLines = RTM.el("g", {}, svg);
      simGroup = RTM.el("g", { "aria-hidden": "true" }, svg);
      var gReal = RTM.el("g", { role: "group", "aria-label": "The real pairs." }, svg);

      var px0 = G.px0, px1 = G.px1, py0 = G.py0, py1 = G.py1;
      var i;

      RTM.el("rect", {
        x: px0, y: py0, width: px1 - px0, height: py1 - py0,
        fill: "none", stroke: rule, "stroke-width": 1
      }, gFrame);
      /* Separate tick arrays: the axes no longer share a domain. */
      var nT = RTM.bp(G.w) === "s" ? 4 : 6;
      var tvx = RTM.ticks(xlo, xhi, nT), tvy = RTM.ticks(ylo, yhi, nT);
      for (i = 0; i < tvx.length; i++) {
        var xx = G.x(tvx[i]);
        RTM.el("line", { x1: xx, x2: xx, y1: py0, y2: py1, stroke: rule, "stroke-width": 1 }, gFrame);
        RTM.txt(svg, { x: xx, y: py1 + G.fs + 6, "text-anchor": "middle", fill: grey,
          "font-family": sans, "font-size": G.fs - 1 }, sigTick(tvx[i]), true);
      }
      for (i = 0; i < tvy.length; i++) {
        var yy = G.y(tvy[i]);
        RTM.el("line", { x1: px0, x2: px1, y1: yy, y2: yy, stroke: rule, "stroke-width": 1 }, gFrame);
        RTM.txt(svg, { x: px0 - 7, y: yy + G.fs * 0.34, "text-anchor": "end", fill: grey,
          "font-family": sans, "font-size": G.fs - 1 }, sigTick(tvy[i]), true);
      }
      /* y = x, over the stretch both cropped axes can show. Equal pixels per
         sigma on the two axes is what keeps it at 45 degrees. */
      if (dHi > dLo) {
        RTM.el("line", {
          x1: G.x(dLo).toFixed(2), y1: G.y(dLo).toFixed(2),
          x2: G.x(dHi).toFixed(2), y2: G.y(dHi).toFixed(2), stroke: grey,
          "stroke-width": 1.4, "stroke-dasharray": "6 4", opacity: 0.7
        }, gFrame);
      }

      /* The catcher. One transparent rect over the whole plot, so a pointer
         anywhere inside gets an answer. transparent catches events, none does
         not. It sits under every mark, and the reading is done by nearest
         point in pixels, so what is under the cursor never matters. */
      RTM.el("rect", {
        x: px0, y: py0, width: Math.max(1, px1 - px0), height: Math.max(1, py1 - py0),
        fill: "transparent"
      }, gFrame);
      RTM.txt(svg, { x: (px0 + px1) / 2, y: py1 + G.fs * 2 + 14, "text-anchor": "middle",
        fill: ink2, "font-family": sans, "font-size": G.fs },
        RTM.bp(G.w) === "s" ? "Parent (σ)" : "Parent, σ above their reference mean", true);
      RTM.txt(svg, { x: px0 - 7, y: py0 - 11, "text-anchor": "start", fill: ink2,
        "font-family": sans, "font-size": G.fs }, RTM.bp(G.w) === "s" ? "Child (σ)" : "Child, σ", true);

      /* the modelled zone */
      bandRect = RTM.el("rect", {
        x: px0, y: G.y(tau), width: px1 - px0, height: Math.max(0, py1 - G.y(tau)),
        fill: ink, opacity: 0
      }, gZone);
      barLine = RTM.el("line", {
        x1: px0, x2: px1, y1: G.y(tau), y2: G.y(tau),
        stroke: ink2, "stroke-width": 1.6, "stroke-dasharray": "5 3", opacity: 0
      }, gZone);
      /* Both of the bar's labels sit BELOW the bar, inside the zone they
         describe. Above it is where the flatter fit line ends up at a narrow
         width, and two unrelated labels 16px apart sharing a left edge read as
         one block. Now the bar itself runs between them. */
      barLab = RTM.txt(svg, {
        x: px0 + 6, y: G.y(tau) + G.fs + 5, "text-anchor": "start", fill: ink2,
        "font-family": sans, "font-size": G.fs - 0.5, "font-weight": 650, opacity: 0
      }, "the visibility bar, " + RTM.sigma(tau, 1), true);
      barLab2 = RTM.txt(svg, {
        x: px0 + 6, y: G.y(tau) + G.fs * 2 + 9, "text-anchor": "start", fill: grey,
        "font-family": sans, "font-size": G.fs - 1.5, "font-style": "italic", opacity: 0
      }, RTM.bp(G.w) === "s" ? "nobody below this line is on a chart"
         : "nobody below this line is on a chart like this", true);

      /* fitted lines */
      /* Solid, not dashed. Dashed in this figure means a reference line you are
         asked to compare against: y = x, and the visibility bar. This is a
         FITTED line, and drawing it dashed in the same ink as the bar put two
         unrelated dashed dark lines in one plot with their labels 35px apart.
         Fits are solid here, and colour separates the two of them. */
      ghostLine = RTM.el("line", {
        stroke: ink2, "stroke-width": 1.8, "stroke-linecap": "round", opacity: 0
      }, gLines);
      liveLine = RTM.el("line", {
        stroke: accent, "stroke-width": 2.8, "stroke-linecap": "round", opacity: 0
      }, gLines);
      ghostLab = RTM.txt(svg, { "text-anchor": "end", fill: ink2, "font-family": sans,
        "font-size": G.fs - 0.5, "font-weight": 650, opacity: 0 }, "", true);
      liveLab = RTM.txt(svg, { "text-anchor": "end", fill: accent, "font-family": sans,
        "font-size": G.fs, "font-weight": 700, opacity: 0 }, "", true);

      /* modelled children: outline only, dashed, flat tinted zone behind them */
      for (i = 0; i < sim.length; i++) {
        var c = RTM.el("circle", {
          cx: G.x(sim[i].jx).toFixed(2), cy: G.y(sim[i].y).toFixed(2), r: G.rSim,
          fill: "none", stroke: grey, "stroke-width": 1.1, "stroke-dasharray": "2 1.5", opacity: 0
        }, simGroup);
        simNodes.push({ n: c, o: -1 });
      }
      simLab = RTM.txt(svg, {
        x: px1 - 6, y: py1 - 8, "text-anchor": "end", fill: grey,
        "font-family": sans, "font-size": G.fs - 1, "font-style": "italic", opacity: 0
      }, "modelled, not observed", true);
      simBadge = RTM.txt(svg, {
        x: px1 - 6, y: py1 - 8 - (G.fs + 4), "text-anchor": "end", fill: grey,
        "font-family": sans, "font-size": G.fs - 2, "font-weight": 700,
        "letter-spacing": "0.08em", opacity: 0
      }, "SIMULATED", true);

      /* the real pairs */
      for (i = 0; i < visible.length; i++) {
        var q = visible[i];
        var g = RTM.el("g", { opacity: 0, "data-pair": q.id || q.family || i }, gReal);
        g.style.cursor = "pointer";
        RTM.el("circle", {
          cx: G.x(q.parent.z).toFixed(2), cy: G.y(q.child.z).toFixed(2), r: G.rReal,
          fill: accent, stroke: tok(["--paper"], "#fff"), "stroke-width": 0.9
        }, g);
        var ring = RTM.el("circle", {
          cx: G.x(q.parent.z).toFixed(2), cy: G.y(q.child.z).toFixed(2), r: G.rReal * 2.4,
          fill: "none", stroke: ink, "stroke-width": 1.5, "stroke-dasharray": "3 2", opacity: 0
        }, g);
        /* No per mark catcher any more. A ring of transparent circles only
           answers when the pointer lands on one of them, which on a scatter
           this sparse means a reader sweeps across and nothing ever changes.
           The pixel positions are cached here and searched in the catcher. */
        realNodes.push({ g: g, ring: ring, o: -1, cx: G.x(q.parent.z), cy: G.y(q.child.z) });
      }

      svg.setAttribute("viewBox", "0 0 " + G.w + " " + Math.round(G.h));
      svg.setAttribute("height", Math.round(G.h));
      svg.style.height = Math.round(G.h) + "px";
      render();
    }

    /* ── interaction ────────────────────────────────────────────────────────
       Nearest point, measured in PIXELS, over one catcher rect. A hit test in
       sigma would be a different distance across than up the moment the axes
       stopped sharing a domain, and it would change shape on every resize.
       Marks that have not faded in yet are not reported: the reader cannot see
       them, so answering for them would be a lie. */
    function nearest(ux, uy) {
      if (!G || !realNodes.length) return -1;
      if (ux < G.px0 - 8 || ux > G.px1 + 8 || uy < G.py0 - 8 || uy > G.py1 + 8) return -1;
      var best = -1, bd = G.hitR * G.hitR;
      for (var i = 0; i < realNodes.length; i++) {
        var N = realNodes[i];
        if (N.o >= 0 && N.o < 0.06) continue;
        var dx = N.cx - ux, dy = N.cy - uy;
        var dd = dx * dx + dy * dy;
        if (dd < bd) { bd = dd; best = i; }
      }
      return best;
    }
    function toUser(ev) {
      var box = svg.getBoundingClientRect();
      if (!box.width || !G) return null;
      var k = G.w / box.width;      /* undo any CSS downscale of the viewBox */
      return { x: (ev.clientX - box.left) * k, y: (ev.clientY - box.top) * k };
    }
    function onMove(ev) {
      var p = toUser(ev);
      if (!p) return;
      var ix = nearest(p.x, p.y);
      if (ix < 0) { if (hoverIdx >= 0) hideTip(); return; }
      if (ix !== hoverIdx) { focusIdx = ix; showTip(ix); }
    }
    function onLeave() { hideTip(); }
    svg.addEventListener("pointermove", onMove);
    svg.addEventListener("pointerleave", onLeave);

    var focusIdx = 0;
    function onKey(ev) {
      var k = ev.key, n = realNodes.length;
      if (!n) return;
      if (k === "Escape") { hideTip(); return; }
      var next = null;
      if (k === "ArrowRight" || k === "ArrowDown") next = Math.min(n - 1, focusIdx + 1);
      else if (k === "ArrowLeft" || k === "ArrowUp") next = Math.max(0, focusIdx - 1);
      else if (k === "Home") next = 0;
      else if (k === "End") next = n - 1;
      if (next === null) return;
      ev.preventDefault();
      focusIdx = next;
      showTip(next);
    }
    chart.addEventListener("keydown", onKey);
    chart.addEventListener("blur", function () { hideTip(); });

    function showTip(i) {
      var q = visible[i];
      hoverIdx = i;
      RTM.clear(tip);
      RTM.h("div", { class: "tip-name", text: (q.family || "") + " · both cleared the bar" }, tip);
      RTM.h("div", { class: "tip-stat", text: (q.parent.name || "") + "   " + RTM.sigma(q.parent.z) }, tip);
      RTM.h("div", { class: "tip-stat", text: (q.child.name || "") + "   " + RTM.sigma(q.child.z) }, tip);
      RTM.h("div", { class: "tip-note", text:
        "The model says a parent at " + RTM.sigma(q.parent.z, 1) + " has a " +
        RTM.pct(1 - RTM.Phi((tau - rTrue * q.parent.z) / sigmaE)) +
        " chance of a child who clears the bar." }, tip);
      if (q.note) RTM.h("div", { class: "tip-note", text: q.note }, tip);
      tip.removeAttribute("hidden");
      tip.setAttribute("data-show", "true");
      liveRegion.textContent = (q.family || "") + ". " + (q.parent.name || "") + " " +
        RTM.sigma(q.parent.z) + ", " + (q.child.name || "") + " " + RTM.sigma(q.child.z) +
        ". Both cleared the bar at " + RTM.sigma(tau, 1) + ".";
      for (var j = 0; j < realNodes.length; j++) realNodes[j].ring.setAttribute("opacity", j === i ? 0.9 : 0);
      placeTip(i);
    }
    function hideTip() {
      hoverIdx = -1;
      tip.setAttribute("hidden", "hidden");
      tip.setAttribute("data-show", "false");
      for (var j = 0; j < realNodes.length; j++) realNodes[j].ring.setAttribute("opacity", 0);
    }
    function placeTip(i) {
      var N = realNodes[i];
      if (!N || tip.hasAttribute("hidden")) return;
      var wr = chart.getBoundingClientRect();
      var sr = svg.getBoundingClientRect();
      var k = G.w ? sr.width / G.w : 1;
      var tw = tip.offsetWidth || 220, th = tip.offsetHeight || 90;
      var x = (sr.left - wr.left) + N.cx * k + 14;
      var y = (sr.top - wr.top) + N.cy * k - th / 2;
      if (x + tw > wr.width - 4) x = (sr.left - wr.left) + N.cx * k - tw - 14;
      if (x < 4) x = 4;
      if (y < 4) y = 4;
      if (y + th > wr.height - 4) y = Math.max(4, wr.height - th - 4);

      /* The plot is now taller than a laptop viewport, so staying inside the
         chart is no longer enough: a mark below the fold would put its tooltip
         off the bottom of the screen. Clamp to whatever slice of the chart the
         reader can actually see, in chart local pixels. */
      var vh2 = window.innerHeight || document.documentElement.clientHeight || 800;
      var seeTop = Math.max(4, 4 - wr.top);
      var seeBot = Math.min(wr.height - 4, vh2 - wr.top - 4);
      if (seeBot - seeTop > th) {
        if (y + th > seeBot) y = seeBot - th;
        if (y < seeTop) y = seeTop;
      }
      tip.style.left = Math.round(x) + "px";
      tip.style.top = Math.round(y) + "px";
    }

    /* ── the reveal ───────────────────────────────────────────────────────── */
    function setOpacity(rec, v) {
      if (Math.abs(v - rec.o) < 0.008) return;
      rec.o = v;
      (rec.g || rec.n).setAttribute("opacity", v.toFixed(3));
    }
    function staggered(p, i, n, spread) {
      var pos = n > 1 ? i / (n - 1) : 0;
      return clamp01((p * (1 + spread) - pos * spread) / 0.14);
    }

    /* A right anchored label sitting a fixed distance below the END of a rising
       line gets struck through by that same line: the text runs leftward, and
       the line falls away leftward at its own slope, so it crosses the glyphs
       about half a label width in. The offset therefore has to clear the line
       over the WHOLE span the text occupies, which means measuring the line at
       the far end of the text and not at the anchor.
         side = +1 puts the label below the line, -1 above it. */
    function fitSegment(node, lab, a, b, opacity, text, side, at) {
      var seg2 = clipLine(a, b, xlo, xhi, ylo, yhi);
      if (!seg2 || opacity <= 0.001) {
        node.setAttribute("opacity", 0);
        lab.setAttribute("opacity", 0);
        return;
      }
      var xA = seg2[0], xB = seg2[1];
      node.setAttribute("x1", G.x(xA).toFixed(2));
      node.setAttribute("y1", G.y(a + b * xA).toFixed(2));
      node.setAttribute("x2", G.x(xB).toFixed(2));
      node.setAttribute("y2", G.y(a + b * xB).toFixed(2));
      node.setAttribute("opacity", opacity.toFixed(3));

      /* Two lines that cross cannot both be labelled at the same end: the labels
         end up 40px apart in the middle of the plot and the reader cannot tell
         which belongs to which. One is labelled at the right end and one at the
         left, at opposite corners. */
      var tw = Math.min(text.length * G.fs * 0.56, G.pw - 10);
      var anchorPx, farPx;
      if (at === "start") {
        anchorPx = G.x(xA) + 6;
        farPx = Math.min(G.px1 - 2, anchorPx + tw);
      } else {
        anchorPx = G.x(xB) - 6;
        farPx = Math.max(G.px0 + 2, anchorPx - tw);
      }
      var yA = G.y(a + b * G.x.invert(anchorPx));
      var yF = G.y(a + b * G.x.invert(farPx));
      var gap = G.fs * 0.85 + 3;
      var baseY = side < 0
        ? Math.min(yA, yF) - gap * 0.55
        : Math.max(yA, yF) + gap;
      /* never let a label leave the plot rectangle */
      if (baseY < G.py0 + G.fs) baseY = G.py0 + G.fs;
      if (baseY > G.py1 - 3) baseY = G.py1 - 3;

      lab.setAttribute("text-anchor", at === "start" ? "start" : "end");
      lab.setAttribute("x", anchorPx.toFixed(2));
      lab.setAttribute("y", baseY.toFixed(2));
      lab.setAttribute("opacity", opacity.toFixed(3));
      lab.textContent = text;
    }

    function render() {
      if (!G || !realNodes.length) return;
      var pa = clamp01(T / 0.16);
      var pbar = clamp01((T - 0.26) / 0.08);
      var pb = clamp01((T - 0.32) / 0.30);
      var pcRaw = clamp01((T - 0.66) / 0.30);
      var pc = MO.ease.cubicInOut(pcRaw);

      var i;
      for (i = 0; i < realNodes.length; i++) setOpacity(realNodes[i], staggered(pa, i, realNodes.length, 0.8));
      for (i = 0; i < simNodes.length; i++) setOpacity(simNodes[i], 0.85 * staggered(pb, i, simNodes.length, 0.9));

      bandRect.setAttribute("opacity", (pbar * 0.06).toFixed(3));
      barLine.setAttribute("opacity", pbar.toFixed(3));
      barLab.setAttribute("opacity", pbar.toFixed(3));
      barLab2.setAttribute("opacity", (pbar * 0.95).toFixed(3));
      simLab.setAttribute("opacity", clamp01(pb * 1.6).toFixed(3));
      simBadge.setAttribute("opacity", clamp01(pb * 1.6).toFixed(3));

      /* The line swings by interpolating slope and intercept, never the path. */
      var a = RTM.lerp(obsFit.intercept, fullFit.intercept, pc);
      var b = RTM.lerp(obsFit.slope, fullFit.slope, pc);
      var lineIn = clamp01((T - 0.06) / 0.07);
      /* The moving line labels itself above its own right hand end. The frozen
         visible-pairs line labels itself below its LEFT hand end, at the other
         corner of the plot, so the two labels can never be read as a pair. */
      fitSegment(liveLine, liveLab, a, b, lineIn,
        (pc > 0.02 ? "everyone: " : "visible pairs: ") + fmt2(b), -1, "end");
      fitSegment(ghostLine, ghostLab, obsFit.intercept, obsFit.slope, clamp01((pcRaw - 0.05) / 0.2),
        "visible pairs only: " + fmt2(obsFit.slope), 1, "start");

      outObs.textContent = fmt2(obsFit.slope);
      outFull.textContent = pcRaw > 0.02 ? fmt2(b) : "not yet";

      markStep();
      RTM.hoist(svg);
      if (hoverIdx >= 0) placeTip(hoverIdx);
    }

    function progress(t) {
      lastT = t;
      if (anchor !== null) {
        if (Math.abs(t - anchor) < 0.07) return;
        anchor = null;
      }
      if (stepTween) { stepTween.cancel(); stepTween = null; }
      T = clamp01(t);
      render();
    }

    return {
      draw: function (w) { draw(w); },
      progress: progress,
      destroy: function () {
        if (stepTween) stepTween.cancel();
        stepTween = null;
        chart.removeEventListener("keydown", onKey);
        svg.removeEventListener("pointermove", onMove);
        svg.removeEventListener("pointerleave", onLeave);
        RTM.clear(mount);
      }
    };
  });
})();
