/* ============================================================================
   SCENE 1 · galton  ·  928 adult children against the height of their parents.

   The sequence is the argument:
     dots rain in left to right, the y = x line draws on, then that line
     flattens into the real fitted line while the slope counts down from 1.00.
     The gap that opens at the tall end is the whole essay in one number.

   Everything is a pure function of t, so scroll can scrub it forwards and
   backwards, and a theme flip or a resize can redraw at the current t without
   replaying anything.
   ========================================================================== */
(function () {
  "use strict";

  var C = RTM, M = RTM.motion;
  var UID = "rtm-galton";

  /* Beat map. One place to retune the choreography. */
  var B = {
    rainFrom: 0.02, rainSpan: 0.26, rainEach: 0.055,
    yxFrom: 0.28, yxTo: 0.42,
    yxLab: 0.36, yxLabTo: 0.46,
    solidFrom: 0.42, solidTo: 0.47,
    flatFrom: 0.47, flatTo: 0.72,
    fitLab: 0.68, fitLabTo: 0.78,
    gapFrom: 0.73, gapTo: 0.87,
    hintFrom: 0.88, hintTo: 0.97
  };

  function tok(n, fb) { var v = C.css(n); return v ? v : fb; }
  function win(t, a, b) { return C.clamp((t - a) / (b - a), 0, 1); }
  function inches(v) { return v.toFixed(1) + "″"; }

  RTM.scene("galton", function (mount) {

    var G = (RTM.data && RTM.data.GALTON) || [];
    var fit = G.length
      ? ((RTM.data && typeof RTM.data.galtonFit === "function")
          ? RTM.data.galtonFit()
          : C.ols(G, function (d) { return d[0]; }, function (d) { return d[1]; }, function (d) { return d[2]; }))
      : { n: 0, slope: 1, intercept: 0, r: 0, mx: 0, my: 0 };
    if (!isFinite(fit.slope)) { fit = { n: 0, slope: 1, intercept: 0, r: 0, mx: 0, my: 0 }; }
    function reg(v) { return fit.intercept + fit.slope * v; }

    /* Derived, never typed. */
    var N = 0, xg = -Infinity, i, j;
    for (i = 0; i < G.length; i++) { N += G[i][2]; if (G[i][0] > xg) xg = G[i][0]; }
    if (!isFinite(xg)) xg = 73;
    var gapVal = xg - reg(xg);

    /* ── DOM ─────────────────────────────────────────────────────────────── */
    var head = C.h("div", { class: "fig-head" }, mount);
    C.h("p", { class: "fig-title", text: "Tall parents had tall children. Just not as tall." }, head);
    C.h("p", {
      class: "fig-sub",
      text: "Every dot is one of the " + C.num(N) + " adult children Francis Galton measured in 1886. " +
            "Across: the height of their two parents, averaged. Up: their own."
    }, head);

    var chart = C.h("div", { class: "chart" }, mount);
    chart.style.position = "relative";
    var svg = C.el("svg", {
      role: "application", tabindex: "0",
      "aria-label": "Adult child height against parent height, " + C.num(N) + " children",
      "aria-describedby": UID + "-alt"
    }, chart);
    svg.style.display = "block";
    svg.style.width = "100%";

    var tip = C.h("div", { class: "tip", "data-show": "false" }, chart);
    tip.hidden = true;
    /* Belt and braces. A tooltip that catches the pointer eats its own leave
       event and flickers, and this one has bitten the project before. */
    tip.style.pointerEvents = "none";
    tip.style.position = "absolute";
    /* .tip carries a translate in the stylesheet so a scene can anchor it on a
       point. This one is placed by its top left corner, already clamped inside
       the chart, so the translate is turned off rather than fought. */
    tip.style.transform = "none";
    var tipName = C.h("div", { class: "tip-name" }, tip);
    var tipStat = C.h("div", { class: "tip-stat" }, tip);
    var tipNote = C.h("div", { class: "tip-note" }, tip);

    /* There is no readout row. The slope is already set 29px tall inside the
       plot, on the line it belongs to; printing it again in a bordered box 40px
       underneath said the same number twice and made the chart look like it had
       an instrument panel bolted on. The live announcement it used to carry is
       in the alt text and in the polite region below. */

    var hint = C.h("p", { class: "hint", text: "Move the pointer over the cloud to read the nearest cell, or focus the chart and use the arrow keys." }, mount);

    var fnote = C.h("p", {
      class: "fig-note",
      text: "Francis Galton, “Regression towards mediocrity in hereditary stature”, 1886. Mid-parent height is the " +
            "average of the two parents, with the mother’s height scaled up by 1.08. n = " + C.num(N) +
            " children in " + C.num(G.length) + " cells."
    }, mount);

    var det = C.h("details", { class: "tbl-wrap" }, mount);
    C.h("summary", { text: "Galton’s tally, all " + C.num(G.length) + " cells" }, det);
    buildTable(det);

    var alt = C.h("p", { class: "sr-only", id: UID + "-alt" }, mount);
    alt.textContent =
      "The finding: children of tall parents were tall, but closer to average than their parents were. " +
      "A straight line fitted through the " + C.num(N) + " children has a slope of " + fit.slope.toFixed(2) +
      ", not 1.00. At " + inches(xg) + ", the tallest parents Galton recorded, that line puts their children " +
      inches(gapVal) + " shorter than they were. The same pull runs the other way at the short end.";
    var say = C.h("p", { class: "sr-only", "aria-live": "polite" }, mount);

    /* ── State ───────────────────────────────────────────────────────────── */
    var W = 0, L = null, x = null, y = null, dom = [62.5, 75];
    var dots = [], bins = [], nodes = {}, yxLen = 0, inkFilter = "", inked = false;
    var t = 0, played = false, usedProgress = false, auto = null;
    var stopResize = null, io = null, sel = -1, cols = [], colOf = {};
    var plot = null, hitR = 40;

    /* ── Table (built once) ──────────────────────────────────────────────── */
    function buildTable(parent) {
      var tbl = C.h("table", {}, parent);
      var thead = C.h("thead", {}, tbl);
      var tr = C.h("tr", {}, thead);
      C.h("th", { text: "Mid-parent height" }, tr);
      C.h("th", { text: "Adult child height" }, tr);
      C.h("th", { text: "Children" }, tr);
      var tb = C.h("tbody", {}, tbl);
      var rows = G.slice().sort(function (a, b) { return a[0] - b[0] || a[1] - b[1]; });
      for (var k = 0; k < rows.length; k++) {
        var r = C.h("tr", {}, tb);
        C.h("td", { text: inches(rows[k][0]) }, r);
        C.h("td", { text: inches(rows[k][1]) }, r);
        C.h("td", { text: String(rows[k][2]) }, r);
      }
    }

    /* ── Layout ──────────────────────────────────────────────────────────────
       viewBox units are CSS pixels 1:1, so a font size here is the font size on
       screen. A narrow chart is a different chart, not a shrunken one. */
    function layoutFor(w) {
      /* Not RTM.bp: this chart lives in the scrolly graphic column, which is
         about 512px on a large screen and the full measure on a small one. The
         question here is only "is there room for labels outside the plot", and
         that turns over at about 470px, not at 560. */
      var b = w < 470 ? "s" : (w < 700 ? "m" : "l");
      if (b === "s") {
        return { H: Math.round(C.clamp(w * 1.15, 390, 480)), top: 26, right: 14, bottom: 46, left: 48,
                 r: 1.7, lab: 11, tick: 10, ax: 11, big: 21, cap: 10, axX: 17, unit: false, margin: false };
      }
      if (b === "m") {
        return { H: Math.round(C.clamp(w * 0.74, 420, 520)), top: 28, right: 112, bottom: 50, left: 52,
                 r: 2.1, lab: 11.5, tick: 10.5, ax: 11.5, big: 25, cap: 10.5, axX: 13, unit: true, margin: true };
      }
      return { H: Math.round(C.clamp(w * 0.58, 470, 570)), top: 30, right: 130, bottom: 54, left: 58,
               r: 2.5, lab: 12.5, tick: 11, ax: 12.5, big: 29, cap: 11, axX: 14, unit: true, margin: true };
    }

    /* ── Build ───────────────────────────────────────────────────────────── */
    function draw(w) {
      W = Math.max(300, Math.round(w || C.widthOf(chart) || 640));
      L = layoutFor(W);
      svg.setAttribute("viewBox", "0 0 " + W + " " + L.H);
      svg.setAttribute("height", L.H);
      svg.style.height = L.H + "px";
      C.clear(svg);
      nodes = {}; dots = []; bins = [];

      var iw = W - L.left - L.right, ih = L.H - L.top - L.bottom;
      x = C.linear(dom[0], dom[1], L.left, L.left + iw);
      y = C.linear(dom[0], dom[1], L.top + ih, L.top);

      /* Hit testing happens in pixels, not in inches. A threshold in data units
         is a different distance across than it is up, and it changes shape with
         every resize. One radius, a little over a cell, in both directions. */
      plot = { x0: L.left, y0: L.top, x1: L.left + iw, y1: L.top + ih };
      hitR = Math.max(34, Math.min(iw, ih) / 9);

      var ink = tok("--ink", "#12171B");
      var ink2 = tok("--ink-2", "#4A5560");
      var ink3 = tok("--ink-3", "#6E7A85");
      var rule = tok("--rule", "#CBD0C9");
      var mean = tok("--mean", "#2E6675");
      var outl = tok("--outlier", "#C8461F");
      var sans = tok("--sans", "system-ui, sans-serif");
      var mono = tok("--mono", "ui-monospace, monospace");

      /* grid */
      var gGrid = C.el("g", {}, svg);
      for (var v = 64; v <= 74; v += 2) {
        C.el("line", { x1: L.left, x2: L.left + iw, y1: y(v), y2: y(v), stroke: rule, "stroke-width": 1 }, gGrid);
        C.el("line", { x1: x(v), x2: x(v), y1: L.top, y2: L.top + ih, stroke: rule, "stroke-width": 1 }, gGrid);
      }

      /* The catcher. transparent catches pointer events, none does not, and a
         scatter this sparse needs the whole plot live or the reader sweeps
         across it and nothing ever answers. */
      nodes.catcher = C.el("rect", {
        x: L.left, y: L.top, width: Math.max(1, iw), height: Math.max(1, ih),
        fill: "transparent"
      }, svg);

      /* dots, one per child, jittered out of the cell it was tallied into */
      var gDots = C.el("g", {}, svg);
      var order = G.slice().sort(function (a, b) { return a[0] - b[0] || a[1] - b[1]; });
      var total = Math.max(N, 1), seen = 0, k = 0;
      cols = []; colOf = {};
      for (i = 0; i < order.length; i++) {
        var row = order[i];
        var bin = { mp: row[0], ch: row[1], n: row[2], nodes: [], bx: x(row[0]), by: y(row[1]) };
        bins.push(bin);
        if (colOf[row[0]] === undefined) { colOf[row[0]] = cols.length; cols.push([]); }
        cols[colOf[row[0]]].push(bins.length - 1);
        for (j = 0; j < row[2]; j++) {
          k++;
          var jx = (C.hashUnit(k * 3) - 0.5) * 0.85;
          var jy = (C.hashUnit(k * 3 + 1) - 0.5) * 0.85;
          /* Clamped to the plot rect. Galton's tally has cells sitting on the
             edge of the domain, and half a bin of jitter walked those children
             out of the frame: measured at 1440, dots landed below the x axis
             baseline in among the tick labels, which reads as data outside its
             own chart. The jitter is cosmetic, so clipping it costs nothing. */
          var cx = C.clamp(x(row[0] + jx), plot.x0 + L.r, plot.x1 - L.r);
          var cy = C.clamp(y(row[1] + jy), plot.y0 + L.r, plot.y1 - L.r);
          var node = C.el("circle", { cx: cx, cy: cy, r: L.r, fill: ink2, opacity: 0 }, gDots);
          var d = { node: node, cy: cy, t0: B.rainFrom + B.rainSpan * (seen / total), pp: -1, bin: bin };
          dots.push(d);
          bin.nodes.push(d);
          seen++;
        }
      }
      nodes.dots = gDots;

      /* the two lines.
         The reference line is revealed by a growing clip rather than by a dash
         offset: a dashed line cannot be revealed with stroke-dashoffset, and
         swapping the dash pattern in at the end pops. The clip also sweeps left
         to right, which matches the direction the dots arrived in. */
      var defs = C.el("defs", {}, svg);
      var clip = C.el("clipPath", { id: UID + "-clip", clipPathUnits: "userSpaceOnUse" }, defs);
      nodes.clipRect = C.el("rect", { x: L.left - 4, y: L.top - 4, width: 0, height: ih + 8 }, clip);
      var gYx = C.el("g", { "clip-path": "url(#" + UID + "-clip)" }, svg);
      nodes.yx = C.el("line", {
        x1: x(dom[0]), y1: y(dom[0]), x2: x(dom[1]), y2: y(dom[1]),
        stroke: ink3, "stroke-width": 1.6, "stroke-dasharray": "6 4"
      }, gYx);
      yxLen = iw + 8;

      nodes.fitLine = C.el("line", {
        x1: x(dom[0]), y1: y(dom[0]), x2: x(dom[1]), y2: y(dom[1]),
        stroke: mean, "stroke-width": 3, "stroke-linecap": "round", opacity: 0
      }, svg);

      /* the gap at the tall end */
      nodes.gapRule = C.el("line", {
        x1: x(xg), x2: x(xg), y1: y(xg), y2: y(xg),
        stroke: outl, "stroke-width": 2.5, "stroke-linecap": "round", opacity: 0
      }, svg);
      nodes.gapCapA = C.el("line", { x1: x(xg) - 4, x2: x(xg) + 4, y1: y(xg), y2: y(xg), stroke: outl, "stroke-width": 2, opacity: 0 }, svg);
      nodes.gapCapB = C.el("line", { x1: x(xg) - 4, x2: x(xg) + 4, y1: y(reg(xg)), y2: y(reg(xg)), stroke: outl, "stroke-width": 2, opacity: 0 }, svg);

      /* hover and keyboard highlight */
      nodes.cell = C.el("rect", {
        x: 0, y: 0, width: 1, height: 1, rx: 2, fill: "none",
        stroke: ink, "stroke-width": 1.5, opacity: 0, "pointer-events": "none"
      }, svg);

      /* ── labels, all of them, last ───────────────────────────────────── */
      var unit = L.unit ? "″" : "";
      var axSuffix = L.unit ? "" : " (inches)";
      for (var v2 = 64; v2 <= 74; v2 += 2) {
        C.txt(svg, { x: x(v2), y: L.top + ih + 20, "text-anchor": "middle", fill: ink3,
                     "font-family": mono, "font-size": L.tick }, v2 + unit);
        C.txt(svg, { x: L.left - 8, y: y(v2) + 4, "text-anchor": "end", fill: ink3,
                     "font-family": mono, "font-size": L.tick }, v2 + unit);
      }
      C.txt(svg, { x: L.left + iw / 2, y: L.H - 8, "text-anchor": "middle", fill: ink2,
                   "font-family": sans, "font-size": L.ax, "font-weight": 600 },
            "Height of the parents" + axSuffix);
      C.txt(svg, { x: L.axX, y: L.top + ih / 2, "text-anchor": "middle", fill: ink2,
                   "font-family": sans, "font-size": L.ax, "font-weight": 600,
                   transform: "rotate(-90 " + L.axX + " " + (L.top + ih / 2) + ")" },
            "Height of the child" + axSuffix);

      /* The counter, parked in the empty corner: short parents, tall children.
         Pinned to a height on the y scale rather than to the top margin, so it
         clears the topmost tick label instead of sitting hard against it. At
         L.top it butted straight into the "74″" tick with about a pixel of
         air. */
      var capY = Math.max(L.top + L.cap + 6, y(73.1));
      nodes.slopeCap = C.txt(svg, { x: L.left + 12, y: capY, "text-anchor": "start", fill: ink3,
                                    "font-family": sans, "font-size": L.cap, "font-weight": 600,
                                    "letter-spacing": "0.06em", opacity: 0 }, "SLOPE", true);
      nodes.slopeNum = C.txt(svg, { x: L.left + 12, y: capY + L.big + 4, "text-anchor": "start",
                                    fill: mean, "font-family": mono, "font-size": L.big, "font-weight": 700,
                                    opacity: 0 }, "1.00", true);

      /* direct labels on both lines */
      nodes.yxLab = [];
      nodes.fitLab = [];
      nodes.gapLab = [];
      var mk = function (bucket, tx, ty, anchor, lines, fill) {
        var out = C.txtBlock(svg, tx, ty, anchor, lines.map(function (s) {
          return { text: s, size: L.lab, weight: 700, fill: fill, dy: L.lab + 6 };
        }), true);
        out.forEach(function (n) { n.setAttribute("opacity", 0); bucket.push(n); });
      };

      if (L.margin) {
        /* Both lines end at the right edge, so both get named there. The fitted
           label sits above its line and the reference label below its own, so
           they open away from each other as the flatten runs. */
        mk(nodes.yxLab, x(dom[1]) + 9, y(dom[1]) + L.lab + 2, "start",
           ["if children", "matched parents"], ink3);
        mk(nodes.fitLab, x(dom[1]) + 9, y(reg(dom[1])) - 6 - L.lab, "start",
           ["what actually", "happened"], mean);
        mk(nodes.gapLab, x(xg) + 8, y(reg(xg)) + L.lab + 6, "start",
           [inches(gapVal) + " shorter", "than their parents"], outl);
      } else {
        /* No margin to label into. Each label goes on the far side of its own
           line from the other, and they are pushed apart in x as well, so the
           two blocks cannot meet however the fit comes out. */
        mk(nodes.yxLab, x(65.0) + 4, y(65.0) + L.lab + 6, "start",
           ["if children matched", "their parents"], ink3);
        mk(nodes.fitLab, x(67.0), y(reg(67.0)) - L.lab - 15, "start",
           ["what actually", "happened"], mean);
        mk(nodes.gapLab, x(xg) - 6, y(reg(xg)) + L.lab + 22, "end",
           [inches(gapVal) + " shorter", "than their parents"], outl);
      }

      /* An inked edge on the one line that carries the finding. Only once the
         scene has settled: a displacement filter on a line that moves every
         frame is a repaint nobody asked for. */
      inkFilter = ""; inked = false;
      if (RTM.tex && typeof RTM.tex.bleedUrl === "function") {
        try { inkFilter = RTM.tex.bleedUrl(); } catch (e) { inkFilter = ""; }
      }

      C.hoist(svg);
      apply(t, true);
      if (sel >= 0) showBin(sel, false);
    }

    /* ── The whole scene as a function of t ──────────────────────────────── */
    function apply(tv, force) {
      t = C.clamp(tv, 0, 1);
      if (!L) return;

      /* 1 · the rain, ordered by the parents' height. A cell the reader is
         holding keeps its highlight even while scroll scrubs the sequence. */
      var held = sel >= 0 && bins[sel] ? bins[sel] : null;
      for (var i2 = 0; i2 < dots.length; i2++) {
        var d = dots[i2];
        if (d.bin === held) continue;
        var p = C.clamp((t - d.t0) / B.rainEach, 0, 1);
        if (!force && Math.abs(p - d.pp) < 0.004) continue;
        d.pp = p;
        var e = M.ease.quartOut(p);
        d.node.setAttribute("opacity", (0.36 * e).toFixed(3));
        d.node.setAttribute("cy", (d.cy - (1 - e) * 15).toFixed(2));
      }

      /* 2 · y = x draws on */
      var yp = M.ease.cubicInOut(win(t, B.yxFrom, B.yxTo));
      nodes.clipRect.setAttribute("width", (yxLen * yp).toFixed(1));
      var yl = win(t, B.yxLab, B.yxLabTo);
      nodes.yxLab.forEach(function (n) { n.setAttribute("opacity", yl.toFixed(3)); });

      /* 3 · the flatten, and the number that makes it land */
      var fp = M.ease.cubicInOut(win(t, B.flatFrom, B.flatTo));
      var s = C.lerp(1, fit.slope, fp);
      var b0 = C.lerp(0, fit.intercept, fp);
      var lo = b0 + s * dom[0], hi = b0 + s * dom[1];
      nodes.fitLine.setAttribute("y1", y(lo));
      nodes.fitLine.setAttribute("y2", y(hi));
      nodes.fitLine.setAttribute("opacity", win(t, B.solidFrom, B.solidTo).toFixed(3));
      nodes.slopeNum.textContent = s.toFixed(2);
      var sc = win(t, B.solidFrom, B.solidTo).toFixed(3);
      nodes.slopeNum.setAttribute("opacity", sc);
      nodes.slopeCap.setAttribute("opacity", sc);

      var settled = t >= B.flatTo + 0.06;
      if (inkFilter && settled !== inked) {
        inked = settled;
        if (settled) nodes.fitLine.setAttribute("filter", inkFilter);
        else nodes.fitLine.removeAttribute("filter");
      }

      var fl = win(t, B.fitLab, B.fitLabTo);
      nodes.fitLab.forEach(function (n) { n.setAttribute("opacity", fl.toFixed(3)); });
      if (L.margin) {
        /* the label rides the line it names, all the way down */
        var dy = y(hi) - 6 - L.lab;
        nodes.fitLab.forEach(function (n, ix) { n.setAttribute("y", dy + ix * (L.lab + 6)); });
      }

      /* 4 · the gap at the tall end, measured */
      var gp = win(t, B.gapFrom, B.gapTo);
      var gOn = gapVal > 0.05 ? gp : 0;
      nodes.gapRule.setAttribute("y1", y(xg));
      nodes.gapRule.setAttribute("y2", C.lerp(y(xg), y(reg(xg)), M.ease.cubicOut(gp)));
      nodes.gapRule.setAttribute("opacity", gOn.toFixed(3));
      nodes.gapCapA.setAttribute("opacity", gOn.toFixed(3));
      nodes.gapCapB.setAttribute("opacity", gOn.toFixed(3));
      nodes.gapLab.forEach(function (n) { n.setAttribute("opacity", (gOn * win(t, B.gapFrom + 0.06, B.gapTo)).toFixed(3)); });

      /* 5 · the invitation to read a cell */
      hint.style.opacity = C.reducedMotion() ? 1 : win(t, B.hintFrom, B.hintTo);
    }

    /* ── Reading a cell ──────────────────────────────────────────────────────
       Nearest point, measured in pixels, anywhere inside the plot. Beyond one
       radius nothing is reported: a reader in the empty top left corner should
       not be told about a cell 200px away. */
    function nearest(ux, uy) {
      if (!plot) return -1;
      if (ux < plot.x0 - 8 || ux > plot.x1 + 8 || uy < plot.y0 - 8 || uy > plot.y1 + 8) return -1;
      var best = -1, bd = hitR * hitR;
      for (var i3 = 0; i3 < bins.length; i3++) {
        var b = bins[i3];
        var ddx = b.bx - ux, ddy = b.by - uy;
        var dd = ddx * ddx + ddy * ddy;
        if (dd < bd) { bd = dd; best = i3; }
      }
      return best;
    }

    /* The stylesheet fades the tooltip in on [data-show="true"] and hides it
       from assistive tech with [hidden]. Both have to move together, or the tip
       is in the layout at zero opacity and nothing ever shows. */
    function showTip(on) {
      tip.hidden = !on;
      tip.setAttribute("data-show", on ? "true" : "false");
    }

    function restore(bin) {
      var base = tok("--ink-2", "#4A5560");
      bin.nodes.forEach(function (d) {
        d.node.setAttribute("fill", base);
        var p = C.clamp((t - d.t0) / B.rainEach, 0, 1);
        d.node.setAttribute("opacity", (0.36 * M.ease.quartOut(p)).toFixed(3));
      });
    }

    function clearBin(announce) {
      if (sel >= 0 && bins[sel]) restore(bins[sel]);
      sel = -1;
      if (nodes.cell) nodes.cell.setAttribute("opacity", 0);
      showTip(false);
      if (announce) say.textContent = "";
    }

    function showBin(ix, announce) {
      if (ix < 0 || !bins[ix]) return;
      if (sel >= 0 && sel !== ix && bins[sel]) restore(bins[sel]);
      sel = ix;
      var b = bins[ix];
      var outl = tok("--outlier", "#C8461F");
      b.nodes.forEach(function (d) {
        d.node.setAttribute("fill", outl);
        d.node.setAttribute("opacity", 0.95);
      });

      var cw = 1.0, chh = 1.0;
      var rx = x(b.mp - cw / 2), ry = y(b.ch + chh / 2);
      nodes.cell.setAttribute("x", rx);
      nodes.cell.setAttribute("y", ry);
      nodes.cell.setAttribute("width", Math.abs(x(b.mp + cw / 2) - rx));
      nodes.cell.setAttribute("height", Math.abs(y(b.ch - chh / 2) - ry));
      nodes.cell.setAttribute("opacity", 0.9);

      var diff = b.ch - b.mp;
      var word = diff < 0 ? "shorter" : "taller";
      tipName.textContent = b.n === 1 ? "1 child" : b.n + " children";
      tipStat.textContent = "parents " + inches(b.mp) + "   child " + inches(b.ch);
      tipNote.textContent = Math.abs(diff) < 0.05
        ? "the same height as the parents"
        : inches(Math.abs(diff)) + " " + word + " than the parents";
      showTip(true);

      /* viewBox units are not screen pixels once the svg is width-constrained */
      var box = svg.getBoundingClientRect();
      var k = (box.width || W) / W;
      var tw = tip.offsetWidth || 150, th = tip.offsetHeight || 54;
      var px = C.clamp(x(b.mp) * k - tw / 2, 4, Math.max(4, (box.width || W) - tw - 4));
      var py = y(b.ch) * k - th - 12;
      if (py < 2) py = y(b.ch) * k + 16;
      tip.style.left = px + "px";
      tip.style.top = py + "px";

      if (announce) {
        say.textContent = tipName.textContent + ". Parents " + inches(b.mp) +
          ", child " + inches(b.ch) + ". " + tipNote.textContent + ".";
      }
    }

    function onMove(ev) {
      var box = svg.getBoundingClientRect();
      if (!box.width) return;
      var k = W / box.width;
      var ux = (ev.clientX - box.left) * k;
      var uy = (ev.clientY - box.top) * k;
      var ix = nearest(ux, uy);
      if (ix < 0) { if (sel >= 0) clearBin(false); return; }
      if (ix !== sel) showBin(ix, false);
    }
    function onLeave() { clearBin(false); }

    function step(dx, dy) {
      if (!bins.length) return;
      if (sel < 0) {
        /* start somewhere worth looking: the fullest cell */
        var bestN = -1, bi = 0;
        for (var i4 = 0; i4 < bins.length; i4++) if (bins[i4].n > bestN) { bestN = bins[i4].n; bi = i4; }
        showBin(bi, true);
        return;
      }
      var b = bins[sel];
      var ci = colOf[b.mp];
      var list = cols[ci];
      var ri = list.indexOf(sel);
      if (dx) {
        ci = C.clamp(ci + dx, 0, cols.length - 1);
        var frac = list.length > 1 ? ri / (list.length - 1) : 0;
        list = cols[ci];
        ri = Math.round(frac * (list.length - 1));
      } else {
        ri = C.clamp(ri + dy, 0, list.length - 1);
      }
      showBin(list[ri], true);
    }

    function onKey(ev) {
      var k = ev.key;
      if (k === "ArrowLeft") { step(-1, 0); ev.preventDefault(); }
      else if (k === "ArrowRight") { step(1, 0); ev.preventDefault(); }
      else if (k === "ArrowUp") { step(0, 1); ev.preventDefault(); }
      else if (k === "ArrowDown") { step(0, -1); ev.preventDefault(); }
      else if (k === "Escape") { clearBin(true); }
    }

    svg.addEventListener("pointermove", onMove);
    svg.addEventListener("pointerleave", onLeave);
    svg.addEventListener("keydown", onKey);
    svg.addEventListener("blur", function () { clearBin(false); });

    /* ── Playback ────────────────────────────────────────────────────────────
       Scroll drives it when there is a scrolly track. When there is not, it
       plays once on the way in. Under reduced motion it is simply already
       finished, with every number and label in place. */
    function playOnce() {
      if (played || usedProgress) return;
      played = true;
      if (C.reducedMotion()) { apply(1, true); return; }
      auto = M.tween({
        from: 0, to: 1, dur: 5600, ease: "linear",
        onUpdate: function (v) { if (!usedProgress) apply(v); }
      });
    }

    stopResize = C.onResize(chart, function (w) { draw(w); });

    if (typeof IntersectionObserver === "function") {
      /* A band across the middle of the viewport, not a share of the element.
         A mount taller than the screen can never reach a 35% threshold. */
      io = new IntersectionObserver(function (es) {
        if (es[0].isIntersecting) playOnce();
      }, { rootMargin: "-12% 0px -18% 0px", threshold: 0 });
      io.observe(mount);
    } else {
      playOnce();
    }
    if (C.reducedMotion()) apply(1, true);

    return {
      draw: function (w) { draw(w); },
      progress: function (v) {
        usedProgress = true;
        if (auto) { auto.cancel(); auto = null; }
        played = true;
        apply(v);
      },
      destroy: function () {
        if (auto) { auto.cancel(); auto = null; }
        if (stopResize) stopResize();
        if (io) io.disconnect();
        svg.removeEventListener("pointermove", onMove);
        svg.removeEventListener("pointerleave", onLeave);
        svg.removeEventListener("keydown", onKey);
        [head, chart, hint, fnote, det, alt, say].forEach(function (n) {
          if (n && n.parentNode) n.parentNode.removeChild(n);
        });
      }
    };
  });
})();
