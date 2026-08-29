/* ============================================================================
   SCENE 2 · engine  ·  the mechanism, made touchable.

   One father on a number line. Underneath him, live, the whole distribution of
   sons he could have. Drag him and the son curve slides less far than he does,
   because the son curve is centred on mean + r x (father - mean) and r is well
   under 1.

   The father starts at the MEAN, not at the tallest man in the data. The case
   where nothing happens is the essay's own argument: an average parent has no
   luck to hand back, which is why nobody notices this effect in their own
   family. The reader has to drag him out before anything falls.

   The honest part, and the reason this scene exists rather than a static
   diagram: the model predicts the CENTRE of that curve tightly and the
   INDIVIDUAL son barely at all. So the 95% interval for the sons is drawn full
   width, directly under the 95% interval for every adult man, at the same
   scale. They are nearly the same length. Knowing the father moves the middle
   of the range a long way and narrows the range almost not at all.

   Interaction:
     · drag the marker on the chart (pointer capture, spring damped)
     · an <input type="range"> that is a real control, not a fallback
     · two presets, computed from the data
     · "drop 200 sons", seeded, which rains real samples straight down into a
       stacked beeswarm on the axis, so the sample rebuilds the curve it came
       from instead of drifting across the plot as a dust cloud

   Both input paths funnel through setFather(). There is exactly one state.
   ========================================================================== */
RTM.scene("engine", function (mount) {
  "use strict";

  var M = RTM.motion;
  var D = RTM.data || {};
  var el = RTM.el, h = RTM.h, txt = RTM.txt;

  /* Token read with a fallback, so a renamed token degrades to a colour rather
     than to an empty string (which SVG treats as "black"). */
  function tok(name, fb) { var v = RTM.css(name); return v || fb; }

  /* ── The model. Every constant comes from the data module. ─────────────── */
  var HT = D.HEIGHT || {};
  var MU = typeof HT.mean === "number" ? HT.mean : 69.1;
  var SD = typeof HT.sd === "number" && HT.sd > 0 ? HT.sd : 3.0;
  var R = typeof HT.r === "number" ? HT.r : 0.47;
  var RESID = SD * Math.sqrt(Math.max(1 - R * R, 1e-6));
  var Z95 = 1.959964;
  var NDROP = 200;
  var DROP_DUR = 0.30;     /* seconds a single son spends falling */

  function predictSon(f) { return MU + R * (f - MU); }
  function zOf(v) { return (v - MU) / SD; }

  /* Axis ticks land on whole inches, so RTM.fmtFt's tenth is just noise. */
  function tickFmt(v) {
    var ft = Math.floor(v / 12), inch = Math.round(v - ft * 12);
    if (inch >= 12) { ft += 1; inch = 0; }
    return inch ? ft + "′ " + inch + "″" : ft + "′";
  }

  /* The tallest father the piece can point at, found rather than typed. */
  function tallestFather() {
    var best = null;
    if (typeof HT.tallestFather === "number") return { h: HT.tallestFather, who: "the tallest one" };
    var g = D.GALTON || [];
    for (var i = 0; i < g.length; i++) {
      if (!best || g[i][0] > best.h) best = { h: g[i][0], who: "Galton’s tallest parents" };
    }
    if (typeof HT.lebron === "number" && (!best || HT.lebron > best.h)) {
      best = { h: HT.lebron, who: "LeBron James" };
    }
    if (!best) best = { h: MU + 3 * SD, who: "a father three sigma out" };
    return best;
  }
  var TALL = tallestFather();

  var DOM0 = Math.floor((MU - 3.5 * SD) * 2) / 2;
  var DOM1 = Math.ceil(Math.max(MU + 3.5 * SD, TALL.h + 1.4) * 2) / 2;

  /* ── State ─────────────────────────────────────────────────────────────── */
  var state = { h: MU, w: 0 };
  var vals = [];           /* sampled sons, in DATA space, so a redraw or a
                              theme flip re-bins and re-places them correctly */
  var parts = [];          /* their pixel-space pile, rebuilt by layoutParts() */
  var stopTick = null;     /* particle ticker unsubscribe                    */
  var L = null, N = {};    /* layout + node refs, rebuilt by draw()          */
  var dragging = false, ptrId = null;

  /* ── DOM ───────────────────────────────────────────────────────────────── */
  var head = h("div", { class: "fig-head" }, mount);
  h("p", { class: "fig-title", text:
    "Move the father. The middle of his sons’ range moves less than he does." }, head);
  h("p", { class: "fig-sub", text:
    "Grey is every adult man. The teal curve is the sons this one father could " +
    "have. He starts at the average, where nothing happens." }, head);

  var chart = h("div", { class: "chart" }, mount);
  var svg = el("svg", { xmlns: RTM.SVGNS, "aria-hidden": "true", width: "100%" }, chart);
  svg.style.display = "block";
  svg.style.touchAction = "none";

  h("p", { class: "hint", text:
    "Drag the marker across the chart, or use the slider." }, mount);

  /* Two control rows, not four. The legend that used to sit here duplicated
     two labels already printed on the curves and advertised a third series
     that was not on screen until you clicked. One chip, once sons exist. */
  var row1 = h("div", { class: "ctrl-row" }, mount);
  var ctrl = h("label", { class: "ctrl" }, row1);
  h("span", { class: "ctrl-label", text: "Father’s height" }, ctrl);
  var slider = h("input", {
    class: "slider", type: "range",
    min: String(DOM0), max: String(DOM1), step: "0.1",
    value: String(state.h),
    "aria-label": "Father’s height in inches"
  }, ctrl);

  var seg = h("div", { class: "seg", role: "group", "aria-label": "Jump to a father" }, row1);
  var btnMean = h("button", { class: "seg-btn", type: "button", "aria-pressed": "true",
    text: "The average man" }, seg);
  var btnTall = h("button", { class: "seg-btn", type: "button", "aria-pressed": "false",
    text: TALL.who }, seg);

  var row2 = h("div", { class: "ctrl-row" }, mount);
  var btnDrop = h("button", { class: "btn btn-primary", type: "button",
    text: "Drop 200 sons" }, row2);
  var btnClear = h("button", { class: "btn", type: "button", text: "Clear the sons" }, row2);
  var chip = h("div", { class: "legend", hidden: "hidden" }, row2);
  var chipItem = h("span", { class: "legend-item" }, chip);
  var chipSw = h("span", { class: "swatch" }, chipItem);
  h("span", { text: "200 sampled sons" }, chipItem);

  /* Every number in this scene is already printed on the chart, next to the
     mark it belongs to. The live region carries it for a screen reader and
     stops competing with the drawing. */
  var readout = h("p", { class: "sr-only", "aria-live": "polite", "aria-atomic": "true" }, mount);

  var note = h("p", { class: "fig-note" }, mount);
  note.innerHTML =
    "Model: son’s height is drawn from a normal curve centred on " +
    "<strong>mean + r × (father − mean)</strong>, with r = " + R.toFixed(2) +
    " and a spread of " + RESID.toFixed(2) + "″ around that centre. Reference population: " +
    "US adult men, mean " + RTM.fmtFt(MU) + ", standard deviation " + SD.toFixed(1) + "″. " +
    "Knowing the father narrows the range of the son by " +
    RTM.pct(1 - RESID / SD) + ". It moves the middle of that range a long way. " +
    "The 200 sons are drawn from that curve with a fixed seed, so the same click always " +
    "gives the same pile, and each one drops straight down into the column it belongs to.";

  var det = h("details", { class: "tbl-wrap" }, mount);
  h("summary", { text: "The numbers behind this chart" }, det);
  var table = h("table", null, det);

  var srDesc = h("p", { class: "sr-only" }, mount);

  /* ── Table fallback: the model at one sigma steps. ─────────────────────── */
  (function buildTable() {
    var html = "<caption>Expected son, and the range of sons, for fathers across the height " +
      "distribution</caption><thead><tr><th scope=\"col\">Father</th>" +
      "<th scope=\"col\">Father, in sigma</th><th scope=\"col\">Expected son</th>" +
      "<th scope=\"col\">Expected son, in sigma</th>" +
      "<th scope=\"col\">95% of his sons</th></tr></thead><tbody>";
    for (var z = -3; z <= 3.001; z += 1) {
      var f = MU + z * SD, p = predictSon(f);
      html += "<tr><td>" + RTM.fmtFt(f) + "</td><td>" + RTM.sigma(z, 1) + "</td><td>" +
        RTM.fmtFt(p) + "</td><td>" + RTM.sigma(zOf(p), 2) + "</td><td>" +
        RTM.fmtFt(p - Z95 * RESID) + " to " + RTM.fmtFt(p + Z95 * RESID) + "</td></tr>";
    }
    table.innerHTML = html + "</tbody>";
  })();

  /* ── Optional texture, if that module shipped. Never depended on. ──────── */
  function attachTexture(node) {
    var T = RTM.tex;
    if (!T) return;
    try {
      if (typeof T.defs === "function") T.defs(node);
      else if (typeof T.attach === "function") T.attach(node);
      else if (typeof T.grain === "function") T.grain(node);
    } catch (e) { /* texture is decoration. It never breaks the chart. */ }
  }

  /* ── Spring on the father's position ────────────────────────────────────
     A spring, not a tween, because the reader is dragging: a new target mid
     flight is not a cancelled animation, it is just a new target.          */
  var fatherSpring = M.spring(state.h, { stiffness: 240, damping: 30, precision: 0.001 });
  fatherSpring.on(function (v) { paint(v); });

  /* ── Layout ──────────────────────────────────────────────────────────────
     Four y bands above the plot, fixed in advance, so the father's labels and
     the fall annotation can never land on each other or on the curve:

       yDadLab   "the father"
       yDadNum   his height and sigma
       yFallLab  how far his sons' middle sits back from him
       yFallRule the arrow itself, which is also the top of his stem
       top       the plot                                                   */
  function layout(w) {
    var s = RTM.bp(w);
    return {
      w: w,
      H: s === "s" ? 486 : s === "m" ? 452 : 458,
      yDadLab: s === "s" ? 18 : 20,
      yDadNum: s === "s" ? 37 : 40,
      yFallLab: s === "s" ? 62 : 66,
      yFallRule: s === "s" ? 72 : 76,
      top: s === "s" ? 88 : s === "m" ? 88 : 92,
      pad: RTM.pick(w, { s: 16, m: 24, l: 30 }),
      bottom: RTM.pick(w, { s: 132, m: 112, l: 112 }),
      fLab: RTM.pick(w, { s: 12, m: 13, l: 13.5 }),
      fNum: RTM.pick(w, { s: 12.5, m: 14, l: 15 }),
      fSmall: RTM.pick(w, { s: 10.5, m: 11, l: 11.5 }),
      fTick: RTM.pick(w, { s: 10.5, m: 11, l: 11.5 }),
      tickStep: RTM.pick(w, { s: 6, m: 3, l: 3 }),
      colW: RTM.pick(w, { s: 9, m: 11, l: 12 }),
      flat: RTM.pick(w, {
        s: "nothing to hand back",
        m: "an average father, so nothing to hand back",
        l: "an average father, so nothing to hand back"
      }),
      wrapPI: s === "s"
    };
  }

  var fx = null, base = 0, ih = 0, yOf = null;
  function setScales() {
    ih = L.H - L.top - L.bottom;
    base = L.top + ih;
    fx = RTM.linear(DOM0, DOM1, L.pad, L.w - L.pad);
    var peakRef = 1 / (RESID * Math.sqrt(2 * Math.PI));
    yOf = function (dens) { return base - (dens / peakRef) * ih * 0.80; };
  }

  function areaPath(mu, sd) {
    var stepN = 180, dx = (DOM1 - DOM0) / stepN;
    var d = "M " + fx(DOM0).toFixed(2) + " " + base.toFixed(2);
    for (var i = 0; i <= stepN; i++) {
      var v = DOM0 + i * dx;
      d += " L " + fx(v).toFixed(2) + " " + yOf(RTM.normPdf(v, mu, sd)).toFixed(2);
    }
    return d + " L " + fx(DOM1).toFixed(2) + " " + base.toFixed(2) + " Z";
  }

  function clampX(px, inset) {
    return RTM.clamp(px, L.pad + (inset || 0), L.w - L.pad - (inset || 0));
  }

  /* Place a label at px and keep its whole box inside the frame. The width is
     estimated from the glyph count rather than measured, because measuring
     forces a layout on every frame of a drag. Mono runs about 0.6em a glyph,
     the sans labels here about 0.55em. */
  function placeLabel(node, px, py, content, size, isMono) {
    node.textContent = content;
    var hw = (content.length * size * (isMono ? 0.62 : 0.56)) / 2;
    var lo = L.pad + 1, hi = L.w - L.pad - 1, anchor = "middle", x = px;
    if (px - hw < lo) { anchor = "start"; x = Math.max(px, lo); }
    else if (px + hw > hi) { anchor = "end"; x = Math.min(px, hi); }
    if (anchor === "start" && x + 2 * hw > hi) x = Math.max(lo, hi - 2 * hw);
    if (anchor === "end" && x - 2 * hw < lo) x = Math.min(hi, lo + 2 * hw);
    node.setAttribute("x", x.toFixed(2));
    node.setAttribute("y", py.toFixed(2));
    node.setAttribute("text-anchor", anchor);
  }

  /* ── Draw: rebuild the whole scene at width w, then paint the live parts ─ */
  function draw(w) {
    state.w = Math.max(Math.round(w), 240);
    L = layout(state.w);
    setScales();

    RTM.clear(svg);
    svg.setAttribute("viewBox", "0 0 " + L.w + " " + L.H);
    svg.style.height = L.H + "px";
    attachTexture(svg);

    var cPop = tok("--ink-3", "#5D646C");
    var cSon = tok("--mean", "#1E5F6E");
    var cSonSoft = tok("--mean-soft", "#AECBD2");
    var cOut = tok("--outlier", "#A83612");
    var cRule = tok("--rule", "#CFC8B8");
    var cInk = tok("--ink", "#14171B");
    var mono = tok("--mono", "monospace");
    var sans = tok("--sans", "sans-serif");

    chipSw.style.background = cSon;

    var gStatic = el("g", { "aria-hidden": "true" }, svg);

    /* population curve, fixed for the whole scene */
    el("path", { d: areaPath(MU, SD), fill: cPop, "fill-opacity": 0.13,
      stroke: cPop, "stroke-width": 1, "stroke-opacity": 0.55 }, gStatic);

    /* the sons this father could have, redrawn on every frame of the drag */
    N.sonArea = el("path", { fill: cSonSoft, "fill-opacity": 0.62,
      stroke: cSon, "stroke-width": 2, "stroke-linejoin": "round" }, gStatic);

    /* sampled sons stack on the axis, under every mark and every label */
    N.gParts = el("g", { "aria-hidden": "true" }, svg);

    var gMarks = el("g", { "aria-hidden": "true" }, svg);

    /* the mean, the thing everything falls toward */
    el("line", { x1: fx(MU), x2: fx(MU), y1: base, y2: yOf(RTM.normPdf(MU, MU, SD)) - 4,
      stroke: cPop, "stroke-width": 1, "stroke-dasharray": "2 4" }, gMarks);

    /* axis */
    el("line", { x1: L.pad, x2: L.w - L.pad, y1: base, y2: base,
      stroke: cRule, "stroke-width": 1.5 }, gMarks);
    var t0 = Math.ceil(DOM0 / L.tickStep) * L.tickStep;
    for (var v = t0; v <= DOM1 + 1e-9; v += L.tickStep) {
      el("line", { x1: fx(v), x2: fx(v), y1: base, y2: base + 5,
        stroke: cRule, "stroke-width": 1 }, gMarks);
      txt(svg, { x: fx(v), y: base + 19, "text-anchor": "middle", fill: cPop,
        "font-family": mono, "font-size": L.fTick }, tickFmt(v));
    }

    /* The fall, annotated in its own band above both markers. It used to run
       just above the axis, where it knocked a hole in the son curve and abutted
       a tick label. */
    N.fallLine = el("line", { stroke: cInk, "stroke-width": 1.5 }, gMarks);
    N.fallHead = el("path", { fill: cInk }, gMarks);
    N.fallDrop = el("line", { stroke: cInk, "stroke-width": 1,
      "stroke-dasharray": "2 3", opacity: 0.5 }, gMarks);
    N.fallLab = txt(svg, { "text-anchor": "middle", fill: cInk, "font-family": mono,
      "font-size": L.fSmall, "font-weight": 700 }, "", true);

    /* father: stem through the plot, dot on the axis, labels at the top. The
       stem comes in two segments so it can leave a gap for the son's own labels
       on the one occasion they share an x, which is when the father is average.
       A rule painted through a label is a rule painted through a label even
       when the halo hides most of it. */
    N.dadLine = el("line", { stroke: cOut, "stroke-width": 2.5 }, gMarks);
    N.dadLine2 = el("line", { stroke: cOut, "stroke-width": 2.5 }, gMarks);
    N.dadDot = el("circle", { r: 6.5, fill: cOut, stroke: tok("--paper", "#F4F1EA"),
      "stroke-width": 1.5 }, gMarks);
    N.dadGrip = el("g", null, gMarks);
    el("circle", { r: 13, fill: cOut, "fill-opacity": 0.12 }, N.dadGrip);
    N.dadLab = txt(svg, { fill: cOut, "font-family": sans, "font-size": L.fLab,
      "font-weight": 700 }, "the father", true);
    N.dadNum = txt(svg, { fill: cOut, "font-family": mono, "font-size": L.fNum,
      "font-weight": 700 }, "", true);

    /* expected son: dot on the axis, label above the son curve's own peak */
    N.sonLine = el("line", { stroke: cSon, "stroke-width": 2.5,
      "stroke-dasharray": "5 4" }, gMarks);
    N.sonDot = el("circle", { r: 6, fill: cSon, stroke: tok("--paper", "#F4F1EA"),
      "stroke-width": 1.5 }, gMarks);
    N.sonLab = txt(svg, { fill: cSon, "font-family": sans, "font-size": L.fLab,
      "font-weight": 700 }, "middle of his sons", true);
    N.sonNum = txt(svg, { fill: cSon, "font-family": mono, "font-size": L.fNum,
      "font-weight": 700 }, "", true);

    /* population label, parked on whichever shoulder the son is not on */
    N.popLab = txt(svg, { fill: cPop, "font-family": sans, "font-size": L.fSmall },
      "every adult man", true);

    /* the two 95% intervals, same scale, one under the other. This is the
       honesty of the scene: they are nearly the same length. */
    var piY = base + (L.wrapPI ? 60 : 52);
    var popY = base + (L.wrapPI ? 104 : 90);
    N.piY = piY; N.popY = popY;

    N.piBar = el("line", { stroke: cSon, "stroke-width": 3, "stroke-linecap": "butt" }, gMarks);
    N.piCapL = el("line", { stroke: cSon, "stroke-width": 2 }, gMarks);
    N.piCapR = el("line", { stroke: cSon, "stroke-width": 2 }, gMarks);
    N.piLab1 = txt(svg, { "text-anchor": "middle", fill: cSon, "font-family": mono,
      "font-size": L.fSmall, "font-weight": 700 }, "", true);
    N.piLab2 = txt(svg, { "text-anchor": "middle", fill: cSon, "font-family": mono,
      "font-size": L.fSmall }, "", true);

    var pLo = MU - Z95 * SD, pHi = MU + Z95 * SD;
    el("line", { x1: fx(pLo), x2: fx(pHi), y1: popY, y2: popY,
      stroke: cPop, "stroke-width": 3 }, gMarks);
    el("line", { x1: fx(pLo), x2: fx(pLo), y1: popY - 5, y2: popY + 5,
      stroke: cPop, "stroke-width": 2 }, gMarks);
    el("line", { x1: fx(pHi), x2: fx(pHi), y1: popY - 5, y2: popY + 5,
      stroke: cPop, "stroke-width": 2 }, gMarks);
    txt(svg, { x: RTM.clamp(fx(MU), L.pad + 60, L.w - L.pad - 60), y: popY - 8,
      "text-anchor": "middle", fill: cPop, "font-family": mono, "font-size": L.fSmall },
      "95% of all men, " + (2 * Z95 * SD).toFixed(1) + "″ wide", true);

    /* drag surface. transparent catches pointer events; none does not. */
    N.catcher = el("rect", { x: 0, y: 0, width: L.w, height: base + 14,
      fill: "transparent", cursor: "ew-resize" }, svg);

    layoutParts();
    paint(fatherSpring.value);
    renderParts();
    RTM.hoist(svg);
    var lab = svg.querySelector("g.labels");
    if (lab) lab.setAttribute("aria-hidden", "true");
  }

  /* ── Paint: everything that moves with the father ──────────────────────── */
  function paint(f) {
    if (!L || !N.sonArea) return;
    var pred = predictSon(f);
    var xf = fx(f), xp = fx(pred);

    N.sonArea.setAttribute("d", areaPath(pred, RESID));

    /* father. His stem stops at the fall rule, so the two read as one mark, and
       it breaks around the son's labels when the two markers share an x. */
    var peak0 = yOf(RTM.normPdf(pred, pred, RESID));
    var shared = Math.abs(xf - xp) < 74;
    N.dadLine.setAttribute("x1", xf); N.dadLine.setAttribute("x2", xf);
    N.dadLine.setAttribute("y1", base);
    N.dadLine.setAttribute("y2", shared ? peak0 + 3 : L.yFallRule);
    N.dadLine2.setAttribute("x1", xf); N.dadLine2.setAttribute("x2", xf);
    N.dadLine2.setAttribute("y1", peak0 - 32);
    N.dadLine2.setAttribute("y2", L.yFallRule);
    N.dadLine2.setAttribute("opacity", shared ? 1 : 0);
    N.dadDot.setAttribute("cx", xf); N.dadDot.setAttribute("cy", base);
    N.dadGrip.setAttribute("transform", "translate(" + xf.toFixed(2) + "," + base + ")");
    placeLabel(N.dadLab, xf, L.yDadLab, "the father", L.fLab, false);
    placeLabel(N.dadNum, xf, L.yDadNum,
      RTM.fmtFt(f) + "  " + RTM.sigma(zOf(f), 1), L.fNum, true);

    /* expected son, labelled at the top of his own curve */
    var peakY = peak0;
    N.sonLine.setAttribute("x1", xp); N.sonLine.setAttribute("x2", xp);
    N.sonLine.setAttribute("y1", base); N.sonLine.setAttribute("y2", peakY);
    N.sonDot.setAttribute("cx", xp); N.sonDot.setAttribute("cy", base);
    placeLabel(N.sonLab, xp, peakY - 26, "middle of his sons", L.fLab, false);
    placeLabel(N.sonNum, xp, peakY - 8,
      RTM.fmtFt(pred) + "  " + RTM.sigma(zOf(pred), 1), L.fNum, true);

    /* population label sits on the shoulder the son is not standing on */
    var side = pred >= MU ? MU - 1.55 * SD : MU + 1.55 * SD;
    var xPop = fx(side);
    N.popLab.setAttribute("x", clampX(xPop, 4));
    N.popLab.setAttribute("y", yOf(RTM.normPdf(side, MU, SD)) - 8);
    N.popLab.setAttribute("text-anchor", pred >= MU ? "end" : "start");

    /* The fall, measured. Below about a third of an inch there is nothing to
       draw an arrow between, and that is the case worth saying out loud. */
    var drop = Math.abs(f - pred);
    var show = drop > 0.35;
    var ay = L.yFallRule, dir = pred < f ? 1 : -1;
    N.fallLine.setAttribute("x1", xf); N.fallLine.setAttribute("x2", xp);
    N.fallLine.setAttribute("y1", ay); N.fallLine.setAttribute("y2", ay);
    N.fallLine.setAttribute("opacity", show ? 1 : 0);
    N.fallHead.setAttribute("d", "M " + xp.toFixed(2) + " " + ay + " l " + (7 * dir) +
      " -4.5 l 0 9 z");
    N.fallHead.setAttribute("opacity", show ? 1 : 0);
    /* a short dashed leader from the arrowhead down to the son's own label */
    N.fallDrop.setAttribute("x1", xp); N.fallDrop.setAttribute("x2", xp);
    N.fallDrop.setAttribute("y1", ay + 5);
    N.fallDrop.setAttribute("y2", Math.max(ay + 6, peakY - 40));
    N.fallDrop.setAttribute("opacity", show ? 0.5 : 0);
    placeLabel(N.fallLab, show ? (xf + xp) / 2 : xf, L.yFallLab,
      show ? drop.toFixed(1) + "″ back toward the middle" : L.flat,
      L.fSmall, true);

    /* the 95% interval for this father's sons */
    var lo = pred - Z95 * RESID, hi = pred + Z95 * RESID;
    var xl = fx(lo), xh = fx(hi);
    N.piBar.setAttribute("x1", xl); N.piBar.setAttribute("x2", xh);
    N.piBar.setAttribute("y1", N.piY); N.piBar.setAttribute("y2", N.piY);
    N.piCapL.setAttribute("x1", xl); N.piCapL.setAttribute("x2", xl);
    N.piCapL.setAttribute("y1", N.piY - 5); N.piCapL.setAttribute("y2", N.piY + 5);
    N.piCapR.setAttribute("x1", xh); N.piCapR.setAttribute("x2", xh);
    N.piCapR.setAttribute("y1", N.piY - 5); N.piCapR.setAttribute("y2", N.piY + 5);

    var xMid = (xl + xh) / 2;
    var line1 = "95% of his sons, " + (hi - lo).toFixed(1) + "″ wide";
    var line2 = RTM.fmtFt(lo) + " to " + RTM.fmtFt(hi);
    if (L.wrapPI) {
      placeLabel(N.piLab1, xMid, N.piY - 24, line1, L.fSmall, true);
      placeLabel(N.piLab2, xMid, N.piY - 9, line2, L.fSmall, true);
    } else {
      placeLabel(N.piLab1, xMid, N.piY - 9, line1 + ", " + line2, L.fSmall, true);
      placeLabel(N.piLab2, xMid, N.piY + 20, "", L.fSmall, true);
    }
  }

  /* ── The readout, the slider and the presets, all from one state ───────── */
  function syncControls() {
    var f = state.h, pred = predictSon(f);
    if (Math.abs(parseFloat(slider.value) - f) > 0.01) slider.value = String(f);
    slider.setAttribute("aria-valuetext", RTM.fmtFt(f, { prose: true }) + ", " + RTM.sigma(zOf(f), 1));
    btnMean.setAttribute("aria-pressed", Math.abs(f - MU) < 0.2 ? "true" : "false");
    btnTall.setAttribute("aria-pressed", Math.abs(f - TALL.h) < 0.2 ? "true" : "false");

    var drop = Math.abs(f - pred);
    readout.textContent = "Father " + RTM.fmtFt(f) + " (" + RTM.sigma(zOf(f), 1) +
      ").  Expected son " + RTM.fmtFt(pred) + " (" + RTM.sigma(zOf(pred), 1) + ").  " +
      "A fall of " + drop.toFixed(1) + " inches.";

    var lo = pred - Z95 * RESID, hi = pred + Z95 * RESID;
    srDesc.textContent =
      "A father of " + RTM.fmtFt(f, { prose: true }) + " is " + RTM.sigma(zOf(f), 1) +
      " above the average man. The middle of his sons’ range is " +
      RTM.fmtFt(pred, { prose: true }) + ", which is " + RTM.sigma(zOf(pred), 1) +
      ", a fall of " + drop.toFixed(1) + " inches. But 95% of his sons land somewhere " +
      "between " + RTM.fmtFt(lo, { prose: true }) + " and " + RTM.fmtFt(hi, { prose: true }) +
      ", a range " + (hi - lo).toFixed(1) + " inches wide. The same range for all adult men " +
      "is " + (2 * Z95 * SD).toFixed(1) + " inches wide. Knowing the father moves the middle " +
      "of the range a long way and narrows the range very little.";
  }

  /* ── The one way the father ever moves ─────────────────────────────────── */
  function setFather(v, immediate) {
    /* Two decimals, not quarters. A quarter inch grid put the tallest preset on
       exactly the same value as a slider set to 92% of its range, so a real
       change looked like a dead control. The son sample is still seeded from
       the quarter inch, so nearby drags give the same pile. */
    var nv = RTM.clamp(Math.round(v * 100) / 100, DOM0, DOM1);
    var moved = Math.abs(nv - state.h) > 0.001;
    state.h = nv;
    if (moved && vals.length) clearParts();
    fatherSpring.set(nv, !!immediate);
    if (immediate) paint(nv);
    syncControls();
  }

  /* ── Sampled sons ────────────────────────────────────────────────────────
     Stored as values. The pile is a layout, recomputed from the values every
     time the width or the theme changes, so a resize mid flight re-places
     every dot in the right column instead of stranding it. */
  function clearParts() {
    if (stopTick) { stopTick(); stopTick = null; }
    vals = [];
    parts = [];
    if (N.gParts) RTM.clear(N.gParts);
    btnClear.disabled = true;
    chip.hidden = true;
    if (L) paint(fatherSpring.value);
  }

  function binAt(colW) {
    var counts = {}, bins = [], slots = [], maxCount = 1;
    for (var i = 0; i < vals.length; i++) {
      var b = Math.floor((fx(vals[i]) - L.pad) / colW);
      var c = counts[b] || 0;
      bins.push(b); slots.push(c);
      counts[b] = c + 1;
      if (c + 1 > maxCount) maxCount = c + 1;
    }
    return { bins: bins, slots: slots, maxCount: maxCount };
  }

  /* Column width and dot radius are solved together. The tallest column should
     reach a little under the curve it was drawn from, and the dots have to fit
     side by side inside their own column. Widening a column raises its count,
     so it takes two or three passes to settle. All of it is derived from the
     sample, none of it guessed, and the same sample always gives the same pile. */
  function layoutParts() {
    if (!vals.length || !L) { parts = []; return; }
    var target = ih * 0.58;
    var colW = L.colW, b = null, r = 3, pass;
    for (pass = 0; pass < 4; pass++) {
      b = binAt(colW);
      r = RTM.clamp(target / (2 * b.maxCount), 1.3, 8);
      if (2 * r + 0.8 <= colW + 0.25) break;
      colW = 2 * r + 0.8;
    }
    b = binAt(colW);
    r = RTM.clamp(Math.min(target / (2 * b.maxCount), colW / 2 - 0.4), 1.2, 8);

    var prev = parts;
    parts = [];
    var span = Math.max(b.maxCount - 1, 1);
    for (var i = 0; i < vals.length; i++) {
      parts.push({
        v: vals[i], bin: b.bins[i], slot: b.slots[i], r: r, colW: colW,
        /* the bottom of a column lands first, so the pile builds upward */
        delay: 0.24 * (b.slots[i] / span) + 0.07 * RTM.hashUnit(b.bins[i] * 7 + 13),
        t: prev[i] ? prev[i].t : 0,
        node: null
      });
    }
  }

  function dropSons() {
    if (!L || !N.gParts) return;
    clearParts();
    var pred = predictSon(state.h);
    /* Seeded from the father's position: the same click always gives the same
       pile, and two different fathers do not get the identical sons. */
    var rand = RTM.rng(20260727 ^ Math.round(state.h * 4));
    for (var i = 0; i < NDROP; i++) {
      vals.push(RTM.clamp(rand.normal(pred, RESID), DOM0, DOM1));
    }
    layoutParts();
    btnClear.disabled = false;
    chip.hidden = false;
    renderParts();
    runFall();
  }

  function partX(p) { return L.pad + (p.bin + 0.5) * p.colW; }
  function partY(p) { return base - (p.slot + 0.5) * 2 * p.r - 0.5; }
  function releaseY() { return L.top + 2; }

  function renderParts() {
    if (!N.gParts) return;
    RTM.clear(N.gParts);
    if (!parts.length) return;
    var cSon = tok("--mean", "#1E5F6E");
    var cPaper = tok("--paper", "#F4F1EA");
    for (var i = 0; i < parts.length; i++) {
      var p = parts[i];
      p.node = el("circle", { r: p.r, fill: cSon, "fill-opacity": 0.88,
        stroke: cPaper, "stroke-width": p.r > 2.4 ? 0.7 : 0 }, N.gParts);
      placePart(p);
    }
  }

  /* Straight down, into the column the son belongs to. The old version glided
     each dot across the plot from the father's marker, which meant every frame
     before the last one was a diagonal smear of dots with no baseline, densest
     wherever the father happened to be standing. */
  function placePart(p) {
    if (!p.node) return;
    var ty = partY(p), sy = releaseY();
    var te = RTM.clamp((p.t - p.delay) / DROP_DUR, 0, 1);
    var fall = te * te;                        /* constant acceleration */
    p.node.setAttribute("cx", partX(p).toFixed(2));
    p.node.setAttribute("cy", (sy + (ty - sy) * fall).toFixed(2));
    p.node.setAttribute("opacity", p.t >= p.delay ? 1 : 0);
  }

  function runFall() {
    if (RTM.reducedMotion()) {
      for (var i = 0; i < parts.length; i++) { parts[i].t = 2; placePart(parts[i]); }
      return;
    }
    if (stopTick) { stopTick(); stopTick = null; }
    var done = false;
    stopTick = RTM.onTick(function (dt) {
      if (done) return;
      var live = false;
      for (var i = 0; i < parts.length; i++) {
        var p = parts[i];
        if (p.t < p.delay + DROP_DUR) { p.t += dt; live = true; }
        placePart(p);
      }
      if (!live) {
        done = true;
        if (stopTick) { stopTick(); stopTick = null; }
      }
    });
  }

  /* ── Pointer drag on the chart ─────────────────────────────────────────── */
  function xToHeight(clientX) {
    var r = svg.getBoundingClientRect();
    if (!r.width) return state.h;
    var px = (clientX - r.left) * (L.w / r.width);   /* undo any CSS downscale */
    return fx.invert(px);
  }
  function onDown(e) {
    if (!L) return;
    dragging = true; ptrId = e.pointerId;
    try { svg.setPointerCapture(e.pointerId); } catch (err) { /* older Safari */ }
    setFather(xToHeight(e.clientX));
    e.preventDefault();
  }
  function onMove(e) {
    if (!dragging || e.pointerId !== ptrId) return;
    setFather(xToHeight(e.clientX));
    e.preventDefault();
  }
  function onUp(e) {
    if (!dragging) return;
    dragging = false;
    try { svg.releasePointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    ptrId = null;
  }
  svg.addEventListener("pointerdown", onDown);
  svg.addEventListener("pointermove", onMove);
  svg.addEventListener("pointerup", onUp);
  svg.addEventListener("pointercancel", onUp);

  function onSlider() { setFather(parseFloat(slider.value)); }
  slider.addEventListener("input", onSlider);

  function toMean() { setFather(MU); }
  function toTall() { setFather(TALL.h); }
  btnMean.addEventListener("click", toMean);
  btnTall.addEventListener("click", toTall);
  btnDrop.addEventListener("click", dropSons);
  btnClear.addEventListener("click", clearParts);

  btnClear.disabled = true;

  syncControls();

  return {
    draw: draw,
    destroy: function () {
      svg.removeEventListener("pointerdown", onDown);
      svg.removeEventListener("pointermove", onMove);
      svg.removeEventListener("pointerup", onUp);
      svg.removeEventListener("pointercancel", onUp);
      slider.removeEventListener("input", onSlider);
      btnMean.removeEventListener("click", toMean);
      btnTall.removeEventListener("click", toTall);
      btnDrop.removeEventListener("click", dropSons);
      btnClear.removeEventListener("click", clearParts);
      clearParts();
      fatherSpring.stop();
      RTM.clear(mount);
    }
  };
});
