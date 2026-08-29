/* ============================================================================
   SCENE 3 · traits  ·  the r board, and what r costs you.

   The finding that lifts this piece above the usual explainer: the arithmetic
   of reversion is the same for every trait, and the outcomes are not remotely
   the same. Lifespan is gone in about a generation. Status attached to a
   surname is still there five or six generations later. One number, r, decides
   which.

   Two panels, linked:
     1. the board. Every trait as a row, sorted by r, r drawn as position on a
        common 0 to 1 scale, and under the name the number that actually
        separates these traits: how many generations a +3 sigma head start
        lasts before it drops under +0.5 sigma. That runs 1 to 7 across the
        board, and it is the same crossing the cascade marks, so the two
        panels say the same thing. Half-life is the obvious secondary number
        and it is the wrong one: six of these eight traits sit between 0.4 and
        0.9 generations, so the rows read as identical when they are not.
        Half-life is still on the row for a screen reader and in the table.
        Each row is a real radio, reachable and operable from the keyboard.
     2. the cascade. A +3 sigma head start, eight generations of z = r^n x 3,
        for EVERY trait at once in grey, with the selected one accented and
        animated on selection with a stagger down the generations. One curve
        plus a fading ghost of the last one was not enough: a still frame of
        this scene showed a single line and the fig-title's claim was nowhere
        on the page.

   The chart is left to make the point. There is no exclamation mark on it.
   ========================================================================== */
RTM.scene("traits", function (mount) {

  /* This table is assembled as an HTML string, so anything interpolated into
     it has to be escaped. Citations are ours, but escaping is cheaper than
     remembering that it is. */
  function esc(v) {
    return String(v == null ? "" : v)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  "use strict";

  var M = RTM.motion;
  var D = RTM.data || {};
  var el = RTM.el, h = RTM.h, txt = RTM.txt;

  function tok(name, fb) { var v = RTM.css(name); return v || fb; }

  var GENS = 8;          /* generations drawn, 0 through 8 */
  var Z0 = 3;            /* the head start we hand generation zero, in sigma  */
  var ZGONE = 0.5;       /* below this, an advantage is hard to pick out      */
  var ZMAX = 3.25;       /* y domain, with headroom for the gen 0 label       */

  /* ── The traits, sorted by value. Never alphabetically. ────────────────── */
  var TRAITS = (D.TRAITS || []).slice().filter(function (t) {
    return t && typeof t.r === "number" && isFinite(t.r);
  }).sort(function (a, b) { return b.r - a.r; });

  function halfLife(r) {
    if (!(r > 0)) return 0;
    if (r >= 1) return Infinity;
    return typeof D.halfLife === "function" ? D.halfLife(r) : Math.log(0.5) / Math.log(r);
  }
  function fmtHalfLife(r) {
    var v = halfLife(r);
    if (!isFinite(v)) return "it never halves";
    if (v < 0.1) return "under a tenth of a generation";
    return "half-life " + v.toFixed(1) + " generations";
  }
  /* The number the board is scanned on. Plain words, no formula: the
     generation at which a +3σ head start has fallen under +0.5σ. It is
     ln(0.5/3)/ln(r) rounded up, which is exactly what goneAt() returns and
     exactly what the cascade panel marks. */
  function fmtGone(r) {
    var g = goneAt(r);
    if (g === null) return "still there after " + GENS + " generations";
    if (g <= 0) return "gone before the first child";
    return "gone in " + g + (g === 1 ? " generation" : " generations");
  }
  function series(r) {
    var out = [];
    for (var n = 0; n <= GENS; n++) out.push(Z0 * Math.pow(r, n));
    return out;
  }
  /* First generation whose advantage sits under the "hard to pick out" line. */
  function goneAt(r) {
    for (var n = 0; n <= GENS; n++) if (Z0 * Math.pow(r, n) < ZGONE) return n;
    return null;
  }
  /* An r that is a judgement rather than a measurement has to say so. The data
     module may flag it outright; if it does not, the wording of the source
     usually does. */
  function isEstimate(t) {
    if (t.estimate === true || t.isEstimate === true) return true;
    if (t.verified === false) return true;
    var s = ((t.source || "") + " " + (t.note || "") + " " + (t.basis || "")).toLowerCase();
    return /estimat|approx|roughly|judgement|judgment|editorial|schematic|~|\bto 0\.|range of/.test(s);
  }

  /* ── State ─────────────────────────────────────────────────────────────── */
  var sel = 0;
  for (var si = 0; si < TRAITS.length; si++) if (TRAITS[si].id === "height") sel = si;
  var prevSel = -1;
  var curZ = TRAITS.length ? series(TRAITS[sel].r) : [];
  var handles = [];         /* every live tween, cancelled before a new one   */
  var goneOn = true;        /* is the "advantage is gone" marker on screen    */
  var revealed = false, sawProgress = false;
  var kbNav = false;        /* focus ring only for keyboard focus             */
  var L = null, N = { rows: [], gens: [] };

  function killTweens() {
    for (var i = 0; i < handles.length; i++) { if (handles[i]) handles[i].cancel(); }
    handles = [];
  }

  /* ── DOM ───────────────────────────────────────────────────────────────── */
  var head = h("div", { class: "fig-head" }, mount);
  h("p", { class: "fig-title", text:
    "Some advantages are gone in a generation. Others are still there in six." }, head);
  h("p", { class: "fig-sub", text:
    "r is the parent to child correlation. Under each name is how long a +3σ " +
    "head start lasts: the generation where it drops under +0.5σ, which is " +
    "close to ordinary. Every trait's fall is drawn on the right. Pick a row " +
    "to bring one forward." }, head);

  var chart = h("div", { class: "chart" }, mount);
  var svg = el("svg", { xmlns: RTM.SVGNS, width: "100%",
    role: "group", "aria-label": "How fast each trait reverts" }, chart);
  svg.style.display = "block";

  h("p", { class: "hint", text:
    "Pick a row. Arrow keys move down the board." }, mount);

  var readout = h("p", { class: "readout", "aria-live": "polite", "aria-atomic": "true" }, mount);
  var note = h("p", { class: "fig-note" }, mount);

  var det = h("details", { class: "tbl-wrap" }, mount);
  h("summary", { text: "Every trait on the board, with sources" }, det);
  var table = h("table", null, det);

  var srDesc = h("p", { class: "sr-only" }, mount);

  (function buildTable() {
    var html = "<caption>Parent to child correlation for each trait, and what it " +
      "does to a +3 sigma head start</caption><thead><tr>" +
      "<th scope=\"col\">Trait</th><th scope=\"col\">r</th>" +
      "<th scope=\"col\">Generations until it is under 0.5σ</th>" +
      "<th scope=\"col\">Advantage after 8 generations</th>" +
      "<th scope=\"col\">Half-life, generations</th>" +
      "<th scope=\"col\">Basis</th><th scope=\"col\">Source</th></tr></thead><tbody>";
    for (var i = 0; i < TRAITS.length; i++) {
      var t = TRAITS[i], g = goneAt(t.r), hl = halfLife(t.r);
      html += "<tr><th scope=\"row\">" + t.label + (isEstimate(t) ? " (estimate)" : "") +
        "</th><td>" + t.r.toFixed(2) + "</td>" +
        "<td>" + (g === null ? "still above it" : g) + "</td>" +
        "<td>" + RTM.sigma(Z0 * Math.pow(t.r, GENS), 2) + "</td>" +
        "<td>" + (isFinite(hl) ? hl.toFixed(1) : "never") + "</td>" +
        "<td>" + (t.note || "") + "</td><td>" + esc(RTM.data.cite(t.source)) + "</td></tr>";
    }
    table.innerHTML = html + "</tbody>";
  })();

  /* Optional texture module. Decoration, so it is never depended on. */
  function attachTexture(node) {
    var T = RTM.tex;
    if (!T) return;
    try {
      if (typeof T.defs === "function") T.defs(node);
      else if (typeof T.attach === "function") T.attach(node);
      else if (typeof T.grain === "function") T.grain(node);
    } catch (e) { /* never breaks the chart */ }
  }

  /* ── Layout ────────────────────────────────────────────────────────────── */
  function layout(w) {
    var s = RTM.bp(w);
    var pad = RTM.pick(w, { s: 14, m: 18, l: 20 });
    var n = Math.max(TRAITS.length, 1);
    var o = {
      w: w, s: s, pad: pad, n: n,
      rowH: RTM.pick(w, { s: 56, m: 52, l: 52 }),
      fRow: RTM.pick(w, { s: 12.5, m: 13, l: 13.5 }),
      fNum: RTM.pick(w, { s: 12, m: 12.5, l: 13 }),
      fSub: RTM.pick(w, { s: 11, m: 11.5, l: 12 }),
      fSmall: RTM.pick(w, { s: 10, m: 10.5, l: 11 }),
      fCap: RTM.pick(w, { s: 11.5, m: 12, l: 12.5 }),
      plotH: RTM.pick(w, { s: 240, m: 265, l: 290 }),
      dotR: RTM.pick(w, { s: 3.6, m: 4, l: 4.5 })
    };
    o.boardCapY = 15;
    o.axisY = 32;
    o.rowsTop = 44;
    o.boardBottom = o.rowsTop + n * o.rowH;

    /* A reserved column on the right for the printed r. The track used to run
       the full width of the row and the number was set right-aligned over the
       end of it, so "r = 0.75" read as a label attached to the track's tip
       rather than to the row. Every track now stops short of the number
       column, which also gives the 0 to 1 scale a hard right end.            */
    var numMax = 0;
    for (var qi = 0; qi < TRAITS.length; qi++) {
      var qt = "r = " + TRAITS[qi].r.toFixed(2) + (isEstimate(TRAITS[qi]) ? " est." : "");
      numMax = Math.max(numMax, wOf(qt, o.fNum, true));
    }
    o.numW = Math.ceil(numMax) + 14;

    if (s === "s") {
      o.bx0 = pad; o.bx1 = w - pad;
      o.cx0 = pad; o.cx1 = w - pad;
      o.cascCapY = o.boardBottom + 36;
      o.cascTop = o.boardBottom + 54;
    } else {
      var gut = RTM.pick(w, { m: 26, l: 34 });
      var boardW = Math.round((w - 2 * pad - gut) * 0.46);
      o.bx0 = pad; o.bx1 = pad + boardW;
      o.cx0 = o.bx1 + gut; o.cx1 = w - pad;
      o.cascCapY = 15;
      o.cascTop = 44;
    }
    /* Side by side, the cascade grows to the height of the board rather than
       floating at the top of a half empty column. */
    if (s !== "s") {
      o.plotH = Math.max(o.plotH, Math.min(o.boardBottom - o.cascTop - 52, 460));
    }
    o.tx1 = Math.max(o.bx0 + 46, o.bx1 - o.numW);
    o.cascBottom = o.cascTop + o.plotH;
    o.H = Math.max(o.boardBottom, o.cascBottom + 52) + 10;
    return o;
  }

  /* Scales, rebuilt with the layout. */
  var rx = null, gx = null, gy = null;
  function setScales() {
    rx = RTM.linear(0, 1, L.bx0, L.tx1);
    gx = RTM.linear(0, GENS, L.cx0 + 8, L.cx1 - 8);
    gy = RTM.linear(0, ZMAX, L.cascBottom, L.cascTop);
  }

  /* Estimated text width. Measuring forces a layout on every animation frame,
     and this only has to be close enough to keep a label inside its frame. */
  function wOf(str, size, isMono) { return str.length * size * (isMono ? 0.62 : 0.56); }
  function fitText(str, size, avail, isMono) {
    var per = size * (isMono ? 0.62 : 0.56);
    var maxN = Math.floor(avail / per);
    if (str.length <= maxN || maxN < 4) return str;
    return str.slice(0, maxN - 1).replace(/[ ,]+$/, "") + "…";
  }
  function placeLabel(node, px, py, content, size, isMono, lo, hi) {
    node.textContent = content;
    var hw = wOf(content, size, isMono) / 2;
    var anchor = "middle", x = px;
    if (px - hw < lo) { anchor = "start"; x = Math.max(px, lo); }
    else if (px + hw > hi) { anchor = "end"; x = Math.min(px, hi); }
    node.setAttribute("x", x.toFixed(2));
    node.setAttribute("y", py.toFixed(2));
    node.setAttribute("text-anchor", anchor);
  }

  /* ── Draw ──────────────────────────────────────────────────────────────── */
  function draw(w) {
    L = layout(Math.max(Math.round(w), 240));
    setScales();

    RTM.clear(svg);
    svg.setAttribute("viewBox", "0 0 " + L.w + " " + L.H);
    svg.style.height = L.H + "px";
    attachTexture(svg);

    var cAcc = tok("--mean", "#1E5F6E");
    var cAccSoft = tok("--mean-soft", "#AECBD2");
    var cWash = tok("--mean-wash", "#DCE9EC");
    var cGrey = tok("--ink-3", "#5D646C");
    var cInk = tok("--ink", "#14171B");
    var cInk2 = tok("--ink-2", "#474E55");
    var cRule = tok("--rule", "#CFC8B8");
    var cFocus = tok("--focus", "#14171B");
    var mono = tok("--mono", "monospace");
    var sans = tok("--sans", "sans-serif");

    N = { rows: [], gens: [] };

    /* ── Panel 1: the board ─────────────────────────────────────────────── */
    var gBoard = el("g", { "aria-hidden": "true" }, svg);
    txt(svg, { x: L.bx0, y: L.boardCapY, "text-anchor": "start", fill: cInk2,
      "font-family": sans, "font-size": L.fCap, "font-weight": 700 },
      fitText("How much carries over, and how long it lasts", L.fCap, L.bx1 - L.bx0, false));

    /* the 0 to 1 scale, ticked once and then running quietly down the rows.
       In --rule-soft these vanished entirely in dark, where that token is 1.14
       against the paper. A tinted ink at low opacity reads the same in both. */
    var tickVals = [0, 0.25, 0.5, 0.75, 1];
    for (var ti = 0; ti < tickVals.length; ti++) {
      var tv = tickVals[ti], tvx = rx(tv);
      if (tv > 0 && tv < 1) {
        el("line", { x1: tvx, x2: tvx, y1: L.rowsTop - 6, y2: L.boardBottom - 10,
          stroke: cGrey, "stroke-opacity": 0.2, "stroke-width": 1 }, gBoard);
      }
      if (tv === 0 || tv === 0.5 || tv === 1) {
        txt(svg, { x: tvx, y: L.axisY, "text-anchor": ti === 0 ? "start" :
          (tv === 1 ? "end" : "middle"), fill: cGrey, "font-family": mono,
          "font-size": L.fSmall }, "r = " + tv.toFixed(1));
      }
    }

    var rowsG = el("g", { role: "radiogroup", "aria-label": "Traits, sorted by correlation" }, svg);

    for (var i = 0; i < TRAITS.length; i++) {
      var t = TRAITS[i];
      var y0 = L.rowsTop + i * L.rowH;
      var row = { t: t, i: i, y0: y0 };

      /* One row is a group of three lines. The gap inside a row has to be
         smaller than the gap between rows, or the half-life reads as the
         caption of the row underneath it. */
      var boxY = y0 - 2, boxH = L.rowH - 5, barY = y0 + 40;
      row.bg = el("rect", { x: L.bx0 - 8, y: boxY, width: (L.bx1 - L.bx0) + 16,
        height: boxH, rx: 4, fill: cWash, opacity: 0 }, gBoard);

      /* The unfilled part of the track is the 0 to 1 reference, so it has to be
         legible in both themes. --rule-soft made it disappear in dark. */
      row.track = el("line", { x1: L.bx0, x2: L.tx1, y1: barY, y2: barY,
        stroke: cGrey, "stroke-opacity": 0.32, "stroke-width": 4,
        "stroke-linecap": "round" }, gBoard);
      row.bar = el("line", { x1: L.bx0, x2: rx(t.r), y1: barY, y2: barY,
        stroke: cGrey, "stroke-width": 6, "stroke-linecap": "round" }, gBoard);
      row.dot = el("circle", { cx: rx(t.r), cy: barY, r: 5, fill: cGrey,
        stroke: tok("--paper", "#F4F1EA"), "stroke-width": 1.2 }, gBoard);

      var numTxt = "r = " + t.r.toFixed(2) + (isEstimate(t) ? " est." : "");
      var labelAvail = (L.tx1 - L.bx0) - 6;
      row.lab = txt(svg, { x: L.bx0, y: y0 + 13, "text-anchor": "start", fill: cInk,
        "font-family": sans, "font-size": L.fRow, "font-weight": 620 },
        fitText(t.label, L.fRow, labelAvail, false));
      row.num = txt(svg, { x: L.bx1, y: y0 + 13, "text-anchor": "end", fill: cInk2,
        "font-family": mono, "font-size": L.fNum, "font-weight": 700 }, numTxt);
      row.sub = txt(svg, { x: L.bx0, y: y0 + 30, "text-anchor": "start", fill: cInk2,
        "font-family": mono, "font-size": L.fSub }, fmtGone(t.r));

      /* the control itself: transparent catches pointer events, none does not */
      row.g = el("g", { role: "radio", tabindex: "-1",
        "aria-checked": "false", "aria-label": rowLabel(t) }, rowsG);
      row.ring = el("rect", { x: L.bx0 - 9, y: boxY - 1, width: (L.bx1 - L.bx0) + 18,
        height: boxH + 2, rx: 5, fill: "none", stroke: cFocus, "stroke-width": 2,
        opacity: 0 }, row.g);
      row.hit = el("rect", { x: L.bx0 - 9, y: boxY - 1, width: (L.bx1 - L.bx0) + 18,
        height: boxH + 2, fill: "transparent", cursor: "pointer" }, row.g);

      bindRow(row);
      N.rows.push(row);
    }

    /* ── Panel 2: the cascade ───────────────────────────────────────────── */
    var gCasc = el("g", { "aria-hidden": "true" }, svg);
    N.cascCap = txt(svg, { x: L.cx0, y: L.cascCapY, "text-anchor": "start", fill: cInk2,
      "font-family": sans, "font-size": L.fCap, "font-weight": 700 }, "");

    /* baseline and the "hard to pick out" line */
    el("line", { x1: L.cx0, x2: L.cx1, y1: gy(0), y2: gy(0),
      stroke: cRule, "stroke-width": 1.5 }, gCasc);
    el("line", { x1: L.cx0, x2: L.cx1, y1: gy(ZGONE), y2: gy(ZGONE),
      stroke: cGrey, "stroke-width": 1, "stroke-dasharray": "4 4" }, gCasc);
    /* Anchored at the left end of the line it names. Right-anchored at cx1 it
       finished flush against the stage edge at every narrow width. */
    txt(svg, { x: L.cx0, y: gy(ZGONE) - 7, "text-anchor": "start", fill: cGrey,
      "font-family": mono, "font-size": L.fSmall },
      "+0.5σ, hard to pick out of a crowd", true);

    /* generation ticks */
    for (var gi = 0; gi <= GENS; gi++) {
      el("line", { x1: gx(gi), x2: gx(gi), y1: gy(0), y2: gy(0) + 4,
        stroke: cRule, "stroke-width": 1 }, gCasc);
      txt(svg, { x: gx(gi), y: gy(0) + 18, "text-anchor": "middle", fill: cGrey,
        "font-family": mono, "font-size": L.fSmall }, String(gi));
    }
    txt(svg, { x: (L.cx0 + L.cx1) / 2, y: gy(0) + 38, "text-anchor": "middle", fill: cGrey,
      "font-family": sans, "font-size": L.fSmall },
      "generations after the person who had the advantage");

    /* Every trait's decay, drawn at once, in grey.

       The panel used to show one curve, the selected one, plus a fading ghost of
       whichever curve you had been looking at a moment before. So a still frame
       of this scene showed a single line marked "height" and nothing else, and
       the fig-title's claim ("gone in a generation, still there in six") was
       never on the page: it lived in the reader's memory of the last click, if
       they had clicked at all. Eight lines answer it in one frame. The ghost is
       gone with them, because the previous curve is now simply still there. */
    N.area = el("path", { fill: cAccSoft, "fill-opacity": 0.42, stroke: "none" }, gCasc);
    N.all = [];
    for (var ai = 0; ai < TRAITS.length; ai++) {
      N.all.push(el("path", {
        d: M.monotonePath(cascPoints(series(TRAITS[ai].r))),
        fill: "none", stroke: cGrey, "stroke-opacity": 0.5, "stroke-width": 1.4,
        "stroke-linejoin": "round", "stroke-linecap": "round"
      }, gCasc));
    }
    /* One of the eight is named on the chart: the slowest, which is the half of
       the claim a reader cannot get from the shape alone. The rest are named on
       the board beside it, one row each. */
    if (TRAITS.length > 1) {
      /* Generation 4, not 3: at 3 the label's first glyph landed on the
         selected curve's own marker at tablet width. */
      var slowZ = Z0 * Math.pow(TRAITS[0].r, 4);
      if (slowZ > ZGONE + 0.3) {
        placeLabel(txt(svg, { fill: cGrey, "font-family": sans, "font-size": L.fSmall,
          "font-weight": 600 }, "", true), gx(4), gy(slowZ) - 9,
          TRAITS[0].label.toLowerCase() + ", the slowest", L.fSmall, false,
          L.cx0 + 2, L.cx1 - 2);
      }
    }

    /* the selected decay, over the top of them */
    N.line = el("path", { fill: "none", stroke: cAcc, "stroke-width": 2.8,
      "stroke-linejoin": "round", "stroke-linecap": "round" }, gCasc);
    N.gens = [];
    for (var di = 0; di <= GENS; di++) {
      N.gens.push({
        dot: el("circle", { r: L.dotR, fill: cAcc, stroke: tok("--paper", "#F4F1EA"),
          "stroke-width": 1.2 }, gCasc),
        lab: txt(svg, { "text-anchor": "middle", fill: cAcc, "font-family": mono,
          "font-size": L.fSmall, "font-weight": 700 }, "", true)
      });
    }

    /* the generation where it stops being visible */
    N.goneLine = el("line", { stroke: cInk, "stroke-width": 1.5,
      "stroke-dasharray": "2 3", opacity: 0 }, gCasc);
    N.goneLab = txt(svg, { "text-anchor": "middle", fill: cInk, "font-family": sans,
      "font-size": L.fSmall, "font-weight": 700, opacity: 0 }, "", true);

    paintBoard();
    renderCascade();
    paintGone();
    syncText();      /* the readout's wording depends on the width */
    RTM.hoist(svg);
    var lab = svg.querySelector("g.labels");
    if (lab) lab.setAttribute("aria-hidden", "true");

    if (revealed || RTM.reducedMotion()) return;
    if (!sawProgress) playIntro();     /* no scrolly track wired up: just play */
  }

  function rowLabel(t) {
    return t.label + ", r " + t.r.toFixed(2) + ", a plus 3 sigma head start is " +
      fmtGone(t.r) + ", " + fmtHalfLife(t.r) +
      (isEstimate(t) ? ", estimated" : "");
  }

  /* ── Board painting ────────────────────────────────────────────────────── */
  function paintBoard() {
    if (!L || !N.rows.length) return;
    var cAcc = tok("--mean", "#1E5F6E");
    var cGrey = tok("--ink-3", "#5D646C");
    var cInk = tok("--ink", "#14171B");
    var cInk2 = tok("--ink-2", "#474E55");
    for (var i = 0; i < N.rows.length; i++) {
      var r = N.rows[i], on = i === sel;
      r.bg.setAttribute("opacity", on ? 1 : 0);
      r.bar.setAttribute("stroke", on ? cAcc : cGrey);
      r.bar.setAttribute("stroke-opacity", on ? 1 : 0.7);
      r.bar.setAttribute("stroke-width", on ? 7.5 : 6);
      r.dot.setAttribute("fill", on ? cAcc : cGrey);
      r.dot.setAttribute("fill-opacity", on ? 1 : 0.7);
      r.dot.setAttribute("r", on ? 6 : 5);
      r.lab.setAttribute("fill", on ? cAcc : cInk);
      r.num.setAttribute("fill", on ? cAcc : cInk2);
      r.sub.setAttribute("fill", on ? cAcc : cInk2);
      r.sub.setAttribute("font-weight", on ? 700 : 500);
      r.g.setAttribute("aria-checked", on ? "true" : "false");
      r.g.setAttribute("tabindex", on ? "0" : "-1");
    }
  }

  function setBarFrac(i, f) {
    var r = N.rows[i];
    if (!r) return;
    var x = rx(r.t.r * f);
    r.bar.setAttribute("x2", x.toFixed(2));
    r.dot.setAttribute("cx", x.toFixed(2));
  }

  /* ── Cascade painting ──────────────────────────────────────────────────── */
  function cascPoints(zs) {
    var pts = [];
    for (var i = 0; i < zs.length; i++) pts.push([gx(i), gy(RTM.clamp(zs[i], 0, ZMAX))]);
    return pts;
  }
  function polyline(pts) {
    var d = "";
    for (var i = 0; i < pts.length; i++) {
      d += (i ? " L " : "M ") + pts[i][0].toFixed(2) + " " + pts[i][1].toFixed(2);
    }
    return d;
  }

  function renderCascade() {
    if (!L || !N.line || !TRAITS.length) return;
    var pts = cascPoints(curZ);
    var d = M.monotonePath(pts);
    N.line.setAttribute("d", d);
    N.area.setAttribute("d", d + " L " + gx(GENS).toFixed(2) + " " + gy(0).toFixed(2) +
      " L " + gx(0).toFixed(2) + " " + gy(0).toFixed(2) + " Z");
    for (var i = 0; i < N.gens.length; i++) {
      N.gens[i].dot.setAttribute("cx", pts[i][0].toFixed(2));
      N.gens[i].dot.setAttribute("cy", pts[i][1].toFixed(2));
    }
    /* Shorten by dropping a clause, not by cutting a word in half. The trait
       name is already on the selected row and in the readout. */
    var t = TRAITS[sel], avail = L.cx1 - L.cx0;
    var cap = "All " + TRAITS.length + " traits from a +3σ head start. In colour: " +
      t.label.toLowerCase();
    if (wOf(cap, L.fCap, false) > avail) cap = "All " + TRAITS.length + " traits from a +3σ head start";
    if (wOf(cap, L.fCap, false) > avail) cap = "All " + TRAITS.length + " traits, eight generations on";
    N.cascCap.textContent = fitText(cap, L.fCap, avail, false);
  }

  /* Only generation 0 carries a value label. The crossing generation's value
     rides in the marker's own caption: two labels a few pixels apart inside
     the same band is a collision waiting for a narrow viewport. */
  function paintValueLabels() {
    if (!L || !N.gens.length) return;
    for (var i = 0; i < N.gens.length; i++) {
      if (i !== 0) { N.gens[i].lab.textContent = ""; continue; }
      placeLabel(N.gens[i].lab, gx(0), gy(RTM.clamp(curZ[0], 0, ZMAX)) - 11,
        RTM.sigma(curZ[0], 1), L.fSmall, true, L.cx0 + 2, L.cx1 - 2);
    }
  }

  function paintGone() {
    if (!L || !N.goneLine) return;
    var t = TRAITS[sel], g = goneAt(t.r);
    if (g === null) {
      N.goneLine.setAttribute("opacity", 0);
      N.goneLab.setAttribute("opacity", 0);
      N.goneLab.textContent = "";
      paintValueLabels();
      return;
    }
    var x = gx(g);
    N.goneLine.setAttribute("x1", x); N.goneLine.setAttribute("x2", x);
    N.goneLine.setAttribute("y1", gy(0)); N.goneLine.setAttribute("y2", gy(ZGONE));
    N.goneLine.setAttribute("opacity", goneOn ? 1 : 0);
    placeLabel(N.goneLab, x, gy(ZGONE) + 16,
      "crosses at generation " + g, L.fSmall, false, L.cx0 + 2, L.cx1 - 2);
    N.goneLab.setAttribute("opacity", goneOn ? 1 : 0);
    paintValueLabels();
  }

  /* ── Selection ─────────────────────────────────────────────────────────── */
  function select(i, opts) {
    if (!TRAITS.length) return;
    i = RTM.clamp(i, 0, TRAITS.length - 1);
    if (i === sel && !(opts && opts.force)) return;
    prevSel = sel;
    sel = i;
    killTweens();

    var fromZ = curZ.slice();
    var toZ = series(TRAITS[sel].r);
    if (!fromZ.length) fromZ = toZ.slice();

    paintBoard();
    syncText();

    /* No ghost of the previous trait any more: all eight curves are on the
       chart the whole time, so the one you just left is still where it was. */

    /* the decay, staggered down the generations */
    goneOn = false;
    N.goneLine.setAttribute("opacity", 0);
    N.goneLab.setAttribute("opacity", 0);
    var eo = M.ease.cubicOut;
    handles.push(M.tween({
      from: 0, to: 1, dur: 1000, ease: "linear",
      onUpdate: function (p) {
        for (var k = 0; k < toZ.length; k++) {
          var te = eo(RTM.clamp((p - k * 0.055) / 0.5, 0, 1));
          curZ[k] = fromZ[k] + (toZ[k] - fromZ[k]) * te;
        }
        renderCascade();
        paintValueLabels();
      },
      onDone: function () {
        curZ = toZ.slice();
        goneOn = true;
        renderCascade();
        paintGone();
        handles.push(M.tween({
          from: 0, to: 1, dur: 400, ease: "cubicOut",
          onUpdate: function (v) {
            if (goneAt(TRAITS[sel].r) === null) return;
            N.goneLine.setAttribute("opacity", v.toFixed(3));
            N.goneLab.setAttribute("opacity", v.toFixed(3));
          }
        }));
      }
    }));
  }

  function syncText() {
    if (!TRAITS.length) return;
    var t = TRAITS[sel], g = goneAt(t.r), hl = halfLife(t.r);
    var est = isEstimate(t);

    /* The readout is a single nowrap line, so on a phone anything long is cut
       off at the edge rather than wrapped. Narrow gets the short sentence. */
    var line;
    if (L && L.s === "s") {
      line = t.label + ". r = " + t.r.toFixed(2) + ". " +
        (g === null ? "Still there at " + GENS + "." : "Gone by generation " + g + ".");
    } else {
      line = t.label + ".  r = " + t.r.toFixed(2) + ".  " +
        (g === null
          ? "A +3σ head start is still above +0.5σ after " + GENS + " generations."
          : "A +3σ head start is under +0.5σ by generation " + g + ".") +
        "  " + (isFinite(hl) ? "Half-life " + hl.toFixed(1) + " generations." : "It never halves.");
    }
    /* Only touch the live region when the wording actually changes, or a
       resize or a theme flip announces itself to a screen reader. */
    if (readout.textContent !== line) readout.textContent = line;

    note.innerHTML = (est ? "<span class=\"badge\">Estimate</span> " : "") +
      (t.note ? t.note + " " : "") +
      (t.source ? "Source: " + RTM.data.cite(t.source) + "." : "") +
      (est ? " This r is a reasonable reading of the evidence rather than one measured number." : "");

    var top = TRAITS[0], bot = TRAITS[TRAITS.length - 1];
    srDesc.textContent = "Board of " + TRAITS.length + " traits sorted by parent to child " +
      "correlation, from " + top.label + " at r " + top.r.toFixed(2) + ", where a plus 3 sigma " +
      "head start is " + fmtGone(top.r) + ", down to " + bot.label + " at r " +
      bot.r.toFixed(2) + ", where it is " + fmtGone(bot.r) +
      ". Currently showing " + t.label + ": a plus 3 sigma head start falls to " +
      RTM.sigma(Z0 * Math.pow(t.r, GENS), 2) + " after " + GENS + " generations.";
  }

  /* ── Row events ────────────────────────────────────────────────────────── */
  function bindRow(row) {
    /* Listeners live on the group, not on the hit rect: a click on any child
       bubbles up to the group, and a synthetic click dispatched at the control
       itself still lands. */
    row.g.addEventListener("pointerdown", function () { kbNav = false; });
    row.g.addEventListener("click", function () {
      select(row.i);
      row.g.focus();
    });
    row.g.addEventListener("pointerenter", function () {
      if (row.i !== sel) row.bg.setAttribute("opacity", 0.45);
    });
    row.g.addEventListener("pointerleave", function () {
      if (row.i !== sel) row.bg.setAttribute("opacity", 0);
    });
    row.g.addEventListener("focus", function () {
      if (kbNav) row.ring.setAttribute("opacity", 1);
    });
    row.g.addEventListener("blur", function () { row.ring.setAttribute("opacity", 0); });
    row.g.addEventListener("keydown", function (e) {
      var k = e.key, next = null;
      if (k === "ArrowDown" || k === "ArrowRight") next = row.i + 1;
      else if (k === "ArrowUp" || k === "ArrowLeft") next = row.i - 1;
      else if (k === "Home") next = 0;
      else if (k === "End") next = TRAITS.length - 1;
      else if (k === " " || k === "Enter") { select(row.i, { force: true }); e.preventDefault(); return; }
      else return;
      e.preventDefault();
      kbNav = true;
      next = RTM.clamp(next, 0, TRAITS.length - 1);
      select(next);
      if (N.rows[next]) N.rows[next].g.focus();
    });
  }
  function onKeyFlag(e) {
    if (!e || typeof e.key !== "string") return;
    if (e.key === "Tab" || e.key.indexOf("Arrow") === 0) kbNav = true;
  }
  document.addEventListener("keydown", onKeyFlag, true);

  /* ── Intro: the bars grow, then the first cascade runs ─────────────────── */
  function playIntro() {
    if (revealed || RTM.reducedMotion() || !N.rows.length) return;
    revealed = true;
    killTweens();
    var i;
    for (i = 0; i < N.rows.length; i++) setBarFrac(i, 0);
    handles.push(M.stagger(N.rows, {
      from: 0, to: 1, dur: 520, total: 420, ease: "cubicOut",
      onUpdate: function (row, v) { setBarFrac(row.i, v); }
    }));
    var toZ = series(TRAITS[sel].r);
    var start = [];
    for (i = 0; i <= GENS; i++) start.push(Z0);
    curZ = start.slice();
    renderCascade();
    goneOn = false;
    N.goneLine.setAttribute("opacity", 0);
    N.goneLab.setAttribute("opacity", 0);
    var eo = M.ease.cubicOut;
    handles.push(M.tween({
      from: 0, to: 1, dur: 1100, delay: 260, ease: "linear",
      onUpdate: function (p) {
        for (var k = 0; k <= GENS; k++) {
          var te = eo(RTM.clamp((p - k * 0.06) / 0.5, 0, 1));
          curZ[k] = start[k] + (toZ[k] - start[k]) * te;
        }
        renderCascade();
        paintValueLabels();
      },
      onDone: function () {
        curZ = toZ.slice();
        goneOn = true;
        renderCascade();
        paintGone();
      }
    }));
  }

  if (TRAITS.length) syncText();

  return {
    draw: draw,
    /* The scrolly track drives the first reveal, and nothing else. Auto
       changing the selection while somebody is reading is a good way to lose
       them. */
    progress: function (t) {
      if (!sawProgress) { sawProgress = true; if (t > 0.4) revealed = true; }
      if (!revealed && t > 0.1) playIntro();
    },
    destroy: function () {
      killTweens();
      document.removeEventListener("keydown", onKeyFlag, true);
      RTM.clear(mount);
    }
  };
});
