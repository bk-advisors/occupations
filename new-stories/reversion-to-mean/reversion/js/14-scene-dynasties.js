/* ============================================================================
   SCENE 4  ·  DYNASTIES  ·  the centrepiece.

   ONE panel. One row per family, ranked by how far out the parent stood.
   Open dot the parent, solid dot the child, a rule between them, and one
   thick rule at the top carrying the mean of the whole set.

   Colour carries exactly one thing: direction. Accent when the child came
   back toward average, grey when the child went level or further out. There
   are no domain hues. Domain lives in the filter, the tooltip and the table,
   because spending three more hues on a category that is not the argument is
   how a chart stops being about anything.

   Why a ranked panel rather than a scatter. The claim this section makes is
   that the effect scales with how extreme the parent was, and the previous
   scatter could not show it: every point sat in one corner, and the fall was
   a distance from a diagonal rather than a length you could read. Here the
   fall IS the length of the rule, the rank IS the row, so "the longest falls
   are at the top" is the first thing the eye gets. Forty rows fit inside a
   390px column, and every family a reader looks for is labelled in place, so
   no leader line has to cross another one.

   Filtering never moves a scale. The sigma domain is taken from the whole
   unfiltered set once, bands included, so a position means the same number in
   every state of the chart.
   ========================================================================== */
(function () {
  "use strict";

  var MO = RTM.motion;
  var lerp = RTM.lerp;

  var DOMAIN_ORDER = ["politics", "business", "sport"];
  var DOMAIN_LABEL = { sport: "Sport", politics: "Politics", business: "Business" };

  /* Tokens first, then a last resort. Read at draw time, never cached across a
     theme flip. */
  function tok(names, fallback) {
    for (var i = 0; i < names.length; i++) {
      var v = RTM.css(names[i]);
      if (v) return v;
    }
    return fallback;
  }

  /* Typographic minus, matching RTM.sigma, so a negative number here does not
     read as a hyphen beside sigma values that use the real character. */
  function fmt2(v) {
    if (!isFinite(v)) return "0.00";
    return (v < 0 ? "−" : "") + Math.abs(v).toFixed(2);
  }
  function abs2(v) { return isFinite(v) ? Math.abs(v).toFixed(2) : "0.00"; }
  /* "+0sigma" reads badly on an axis. The mean gets a plain zero. */
  function sigTick(v) { return Math.abs(v) < 1e-9 ? "0σ" : RTM.sigma(v, 0); }

  RTM.scene("dynasties", function (mount) {

    /* ── data ─────────────────────────────────────────────────────────────── */
    var src = (RTM.data && RTM.data.DYNASTIES) ? RTM.data.DYNASTIES : [];
    var pairs = [];
    for (var si = 0; si < src.length; si++) {
      var p0 = src[si];
      if (!p0 || !p0.parent || !p0.child) continue;
      if (!isFinite(p0.parent.z) || !isFinite(p0.child.z)) continue;
      pairs.push(p0);
    }

    RTM.clear(mount);
    if (!pairs.length) {
      RTM.h("p", { class: "fig-note", text: "No dynasty pairs loaded." }, mount);
      return { draw: function () {} };
    }

    function verified(q) { return q.parent.verified !== false && q.child.verified !== false; }
    function hasBand(person) { return person && isFinite(person.zLow) && isFinite(person.zHigh); }
    function gx(q) { return q.parent.z; }
    function gy(q) { return q.child.z; }
    function fall(q) { return q.parent.z - q.child.z; }
    function domLabel(d) {
      return DOMAIN_LABEL[d] || (d ? d.charAt(0).toUpperCase() + d.slice(1) : "Other");
    }

    /* Ranked by the parent, never alphabetically. Ties in the parent break on
       the child, so the six political pairs that never moved sit together and
       the three that fell off the top rung sit under them, which is the shape
       of the office ladder rather than an accident of file order.

       `pairs` is a fresh array, so this sorts a copy: RTM.data.DYNASTIES keeps
       the order every other scene reads it in. */
    pairs.sort(function (a, b) {
      return (b.parent.z - a.parent.z) || (b.child.z - a.child.z) ||
             String(a.family || "").localeCompare(String(b.family || ""));
    });

    /* Row labels. A family name is the label a reader recognises, but four
       Vanderbilts and two Waltons cannot all be "the Vanderbilts", and a label
       that repeats is not a label. Duplicated families take the parent's own
       name instead, initialised on a narrow screen where 24 characters would
       eat a third of the width. */
    function initialise(full, family) {
      var famLast = String(family || "").split(" ").pop();
      var t = String(full || "").split(" ");
      var k = t.lastIndexOf(famLast);
      if (k <= 0) return full;
      var out = [], i;
      for (i = 0; i < k; i++) if (t[i]) out.push(t[i].charAt(0) + ".");
      out.push(t[k]);
      for (i = k + 1; i < t.length; i++) out.push(t[i]);
      return out.join(" ");
    }
    (function () {
      var seen = {}, i, fam;
      for (i = 0; i < pairs.length; i++) {
        fam = pairs[i].family || pairs[i].parent.name || "";
        seen[fam] = (seen[fam] || 0) + 1;
      }
      for (i = 0; i < pairs.length; i++) {
        fam = pairs[i].family || pairs[i].parent.name || "";
        if (seen[fam] > 1) {
          pairs[i]._labFull = pairs[i].parent.name || fam;
          pairs[i]._labShort = initialise(pairs[i].parent.name || fam, fam);
        } else {
          pairs[i]._labFull = fam;
          pairs[i]._labShort = fam;
        }
      }
    })();

    var domains = [];
    (function () {
      var i, j;
      for (i = 0; i < DOMAIN_ORDER.length; i++) {
        for (j = 0; j < pairs.length; j++) {
          if (pairs[j].domain === DOMAIN_ORDER[i]) { domains.push(DOMAIN_ORDER[i]); break; }
        }
      }
      for (i = 0; i < pairs.length; i++) {
        if (domains.indexOf(pairs[i].domain) < 0) domains.push(pairs[i].domain);
      }
    })();
    function inDomain(d) {
      return pairs.filter(function (q) { return q.domain === d; });
    }

    /* ── the numbers, all derived ──────────────────────────────────────────── */
    var vpairs = pairs.filter(verified);
    var epairs = pairs.filter(function (q) { return !verified(q); });
    var nEstimate = epairs.length;

    function fitOf(list) {
      if (list.length < 3) return { few: true, n: list.length, slope: NaN, intercept: NaN, r: NaN, sdx: 0 };
      var f = RTM.ols(list, gx, gy);
      f.few = false; f.n = list.length;
      /* A slope measured across almost no spread in the parent is a slope in
         name only. Carry the spread so the method note can say so. */
      f.sdx = RTM.sd(list.map(gx));
      return f;
    }
    function statsOf(list) {
      if (!list.length) return { n: 0, mp: NaN, mc: NaN, fall: NaN, kept: NaN, ok: false };
      var mp = RTM.mean(list.map(gx)), mc = RTM.mean(list.map(gy));
      return {
        n: list.length, mp: mp, mc: mc, fall: mp - mc,
        /* A ratio against a mean sitting on zero is arithmetic, not a finding. */
        kept: (isFinite(mp) && Math.abs(mp) > 0.4) ? mc / mp : NaN,
        ok: true
      };
    }
    function meanFall(list) {
      if (!list.length) return NaN;
      return RTM.mean(list.map(fall));
    }

    var fitAll = fitOf(vpairs);                 /* verified pairs only */
    var fitWithEstimates = fitOf(pairs);
    var statAll = statsOf(pairs);
    var statBy = {};
    for (var dq = 0; dq < domains.length; dq++) statBy[domains[dq]] = statsOf(inDomain(domains[dq]));
    var fitBy = {};
    for (var dr = 0; dr < domains.length; dr++) fitBy[domains[dr]] = fitOf(inDomain(domains[dr]).filter(verified));

    /* Domains ranked by what the children kept, so the control itself carries
       the ordering. Ranked by value, never by the order they appear in. */
    var rankedDom = domains.filter(function (d) { return isFinite(statBy[d].kept); })
      .sort(function (a, b) { return statBy[b].kept - statBy[a].kept; });
    var domOrder = rankedDom.concat(domains.filter(function (d) { return rankedDom.indexOf(d) < 0; }));

    /* The panel's own claim: rank by the parent and the pull shows at both
       ends. Measured on the verified pairs only, so no judged placement is
       inside a headline number. */
    var half = Math.floor(vpairs.length / 2);
    var topHalf = vpairs.slice(0, half);
    var botHalf = vpairs.slice(vpairs.length - half);
    var topFall = meanFall(topHalf);
    var botFall = meanFall(botHalf);
    var fallVer = meanFall(vpairs);
    var fallEst = meanFall(epairs);

    var nDown = 0, nLevel = 0;
    for (var ci = 0; ci < pairs.length; ci++) {
      if (fall(pairs[ci]) > 1e-9) nDown++; else nLevel++;
    }

    function movePhrase(d, terse) {
      if (d >= 0) return "came back " + abs2(d) + "σ" + (terse ? "" : " toward average");
      return "went " + abs2(d) + "σ further out";
    }
    function pctOf(v) { return isFinite(v) ? RTM.pct(v, 0) : "n/a"; }
    /* What a subset is actually made of, largest group first. The headline
       compares the top half of the ranking against the bottom half, and those
       two halves are not the same kind of family, so the figure has to say what
       is in them rather than let the reader assume it is like for like. */
    function mix(list) {
      var c = {}, i, keys, out = [];
      for (i = 0; i < list.length; i++) c[list[i].domain] = (c[list[i].domain] || 0) + 1;
      keys = Object.keys(c).sort(function (a, b) { return c[b] - c[a]; });
      for (i = 0; i < keys.length; i++) out.push(c[keys[i]] + " " + domLabel(keys[i]).toLowerCase());
      return out.join(" and ");
    }
    function changeText(d) {
      if (Math.abs(d) < 1e-9) return "no change";
      return (d > 0 ? "fell " : "rose ") + abs2(d) + "σ";
    }

    /* Sigma domain from EVERY pair, uncertainty bands included. Taken once, so
       a filter can never move it and a position always means one number. */
    var zlo = 0, zhi = 0;
    (function () {
      var lo = Infinity, hi = -Infinity;
      function take(v) { if (isFinite(v)) { if (v < lo) lo = v; if (v > hi) hi = v; } }
      for (var i = 0; i < pairs.length; i++) {
        var q = pairs[i];
        take(q.parent.z); take(q.child.z);
        take(q.parent.zLow); take(q.parent.zHigh);
        take(q.child.zLow); take(q.child.zHigh);
      }
      var pad = Math.max(0.18, (hi - lo) * 0.03);
      zlo = lo - pad; zhi = hi + pad;
    })();

    /* ── chrome ───────────────────────────────────────────────────────────── */
    var head = RTM.h("div", { class: "fig-head" }, mount);
    var titleEl = RTM.h("p", { class: "fig-title" }, head);
    var subEl = RTM.h("p", { class: "fig-sub" }, head);

    titleEl.textContent = (half >= 3 && isFinite(topFall) && isFinite(botFall))
      ? "Of the " + fitAll.n + " pairs measured on both generations, the children of the " + half +
        " most extreme parents " + movePhrase(topFall, true) + ". The children of the " + half +
        " least extreme " + movePhrase(botFall) + "."
      : "Every famous parent and child in the set, ranked by how far out the parent stood.";
    subEl.textContent =
      "One row per family, ranked by the parent. The open dot is the parent, the solid dot is the " +
      "child, and the rule between them is the change. Everyone is placed in standard deviations " +
      "from the mean of a named reference group.";

    var ctrlRow = RTM.h("div", { class: "ctrl-row" }, mount);
    var domCtrl = RTM.h("div", { class: "ctrl" }, ctrlRow);
    RTM.h("span", { class: "ctrl-label", text: "Domain", id: "dyn-dom-lab" }, domCtrl);
    var domSeg = RTM.h("div", { class: "seg", role: "group", "aria-labelledby": "dyn-dom-lab" }, domCtrl);

    /* Chrome will not move focus to an SVG <g> even with tabindex, so the
       keyboard path is one real tab stop on the chart plus arrow keys, with a
       live region doing the announcing. Verified, not assumed. */
    var chart = RTM.h("div", {
      class: "chart", tabindex: "0", role: "application",
      "aria-label": "Parent and child standard scores for " + pairs.length +
        " famous families, ranked by the parent. Use the up and down arrow keys to move between families."
    }, mount);
    chart.style.position = "relative";
    var svg = RTM.el("svg", { xmlns: RTM.SVGNS, "aria-hidden": "true" }, chart);
    svg.style.display = "block";
    svg.style.width = "100%";
    svg.style.touchAction = "pan-y";

    var tip = RTM.h("div", { class: "tip", hidden: "hidden" }, chart);
    tip.style.pointerEvents = "none";
    tip.style.position = "absolute";
    /* The stylesheet anchors a tip above and centred on its mark and keeps it
       at opacity 0 until [data-show] is set. This one is placed in wrapper
       pixels beside the row, so the offset transform goes and the flag has to
       be set explicitly. Without it the tip is in the DOM and invisible. */
    tip.style.transform = "none";

    var liveRegion = RTM.h("p", { class: "sr-only", "aria-live": "polite" }, mount);

    var legend = RTM.h("div", { class: "legend" }, mount);
    var hint = RTM.h("p", { class: "hint" }, mount);
    hint.textContent =
      "Hover a row for the family, or tab to the chart and walk it with the arrow keys.";

    var noteFind = RTM.h("p", { class: "fig-note" }, mount);
    var noteWarn = RTM.h("p", { class: "fig-note" }, mount);
    var noteHandoff = RTM.h("p", { class: "fig-note" }, mount);
    var alt = RTM.h("p", { class: "sr-only" }, mount);

    var details = RTM.h("details", { class: "tbl-wrap" }, mount);
    RTM.h("summary", { text: "All " + pairs.length + " pairs, method and sources" }, details);
    /* The long method lives here with the table it describes. Four dense
       paragraphs under a chart is a wall, and a reader bounces off a wall. */
    var note2 = RTM.h("p", { class: "fig-note" }, details);

    /* ── notes ────────────────────────────────────────────────────────────── */
    var keptBits = [];
    for (var kb = 0; kb < rankedDom.length; kb++) {
      keptBits.push(domLabel(rankedDom[kb]).toLowerCase() + " " + pctOf(statBy[rankedDom[kb]].kept));
    }
    noteFind.textContent =
      (half >= 3
        ? "The two halves in the headline are not the same kind of family. The top " + half + " are " +
          mix(topHalf) + "; the bottom " + half + " are " + mix(botHalf) + ". Part of the gap between " +
          "them is a difference between domains, not extremity on its own. "
        : "") +
      "The thick rule is the mean of all " + pairs.length + " pairs: " + RTM.sigma(statAll.mp, 2) +
      " down to " + RTM.sigma(statAll.mc, 2) + ", so the children kept " + pctOf(statAll.kept) +
      " of the parent's distance from average. " +
      (rankedDom.length >= 2
        ? "By domain the children kept " + keptBits.join(", ") + ". A slope fitted inside one domain " +
          "is unstable, because there is almost no spread left in the parent to fit against and the " +
          "answer moves with a pair or two, so the domains are compared on this ratio instead. The " +
          "gaps are small and the sample is " + pairs.length + " families, so take the order and leave " +
          "the sizes."
        : "");

    noteWarn.textContent =
      "These " + pairs.length + " families are here because they are famous. That is a convenience " +
      "sample, and it selects twice: on a parent far from the mean, and on a child who left a number " +
      "behind. A line fitted to the " + fitAll.n + " measured pairs has a slope of " +
      fmt2(fitAll.slope) + ". It describes this group. It is not an estimate of anything." +
      (nEstimate
        ? " " + nEstimate + " of the placements are editorial judgements, badged ESTIMATE and drawn " +
          "with their range, and they sit outside every fitted number. Those " + nEstimate + " also " +
          "fall harder than the measured pairs do, " + abs2(fallEst) + "σ against " + abs2(fallVer) +
          "σ, which is most of why the mean rule across all " + pairs.length + " falls as far as it does."
        : "");

    noteHandoff.textContent =
      "The next section is about the children nobody ever counted. It is the reason every number " +
      "here is a floor.";

    note2.textContent =
      "Method, in full. Every person is a z score against the reference population named on their " +
      "row of this table, and inside a pair the parent and the child always share one population and " +
      "one construction. The fitted line is ordinary least squares of child z on parent z, verified " +
      "pairs only (" + fitAll.n + " of " + pairs.length + ", correlation " + fmt2(fitAll.r) + ")" +
      (nEstimate && !fitWithEstimates.few
        ? "; with the " + nEstimate + " judged placements in it the slope is " + fmt2(fitWithEstimates.slope)
        : "") +
      ". Retention is the mean child z divided by the mean parent z inside a domain, on every pair in " +
      "it, because a mean is not destabilised by one soft placement the way a slope is. The two halves " +
      "in the headline are the " + half + " verified pairs above the median parent and the " + half +
      " below it, so the median pair itself sits in neither. " +
      (function () {
        var out = [], i;
        var rk = domains.filter(function (d) { return !fitBy[d].few; })
          .sort(function (a, b) { return fitBy[b].slope - fitBy[a].slope; });
        for (i = 0; i < rk.length; i++) {
          out.push(domLabel(rk[i]).toLowerCase() + " " + fmt2(fitBy[rk[i]].slope) +
            " (n = " + fitBy[rk[i]].n + ", parent spread " + fmt2(fitBy[rk[i]].sdx) + "σ)");
        }
        return out.length
          ? "Fitted per domain anyway the slopes are " + out.join(", ") + ". None of them is reversion: " +
            "sport is conditioned on the child reaching a league at all, and the office ladder stops at " +
            "head of government, so nearly every political parent sits on the top rung and there is no " +
            "spread left to fit against. "
          : "";
      })() +
      "The sigma axis is taken from every pair once, uncertainty bands included, so picking a domain " +
      "dims rows and never moves a scale. The population evidence in this piece is Galton's " +
      (function () {
        var g = (RTM.data && RTM.data.GALTON) || [], s = 0;
        for (var i = 0; i < g.length; i++) s += (g[i][2] || 0);
        return s ? RTM.num(s, 0) : "928";
      })() + " children and the published correlations in the trait table, both earlier.";

    alt.textContent =
      "Ranked by how far out the parent stood, the falls are longest at the top. Among the " +
      fitAll.n + " pairs measured on both generations the children of the " + half +
      " most extreme parents " + movePhrase(topFall) + ", while the children of the " + half +
      " least extreme " + movePhrase(botFall) + ". Across all " + pairs.length +
      " pairs the mean runs from " + RTM.sigma(statAll.mp, 2) + " to " + RTM.sigma(statAll.mc, 2) +
      ", so the children kept " + pctOf(statAll.kept) + ". " + nDown + " of the " + pairs.length +
      " children ended closer to average than their parent and " + nLevel +
      " finished level or further out. These families were chosen for being famous, so the fitted " +
      "line describes them and is not an estimate of regression to the mean. Every figure is in the " +
      "table below this chart.";

    (function buildTable() {
      var t = RTM.h("table", {}, details);
      var thead = RTM.h("thead", {}, t);
      var htr = RTM.h("tr", {}, thead);
      var cols = ["Family", "Domain", "Parent", "Parent σ", "Child", "Child σ",
                  "Change", "Measure", "Reference population", "Placement", "Source"];
      for (var c = 0; c < cols.length; c++) RTM.h("th", { scope: "col", text: cols[c] }, htr);
      var tb = RTM.h("tbody", {}, t);
      for (var i = 0; i < pairs.length; i++) {
        var q = pairs[i], tr = RTM.h("tr", {}, tb);
        RTM.h("th", { scope: "row", text: q.family || "" }, tr);
        RTM.h("td", { text: domLabel(q.domain) }, tr);
        RTM.h("td", { text: q.parent.name || "" }, tr);
        RTM.h("td", {
          text: RTM.sigma(q.parent.z) + (hasBand(q.parent)
            ? " (" + RTM.sigma(q.parent.zLow) + " to " + RTM.sigma(q.parent.zHigh) + ")" : "")
        }, tr);
        RTM.h("td", { text: q.child.name || "" }, tr);
        RTM.h("td", {
          text: RTM.sigma(q.child.z) + (hasBand(q.child)
            ? " (" + RTM.sigma(q.child.zLow) + " to " + RTM.sigma(q.child.zHigh) + ")" : "")
        }, tr);
        RTM.h("td", { text: changeText(fall(q)) }, tr);
        RTM.h("td", { text: q.metric || "" }, tr);
        RTM.h("td", { text: q.basis || "" }, tr);
        RTM.h("td", { text: verified(q) ? "measured" : "estimate" }, tr);
        RTM.h("td", { text: RTM.data.cite(q.source) }, tr);
      }
    })();

    /* ── controls ─────────────────────────────────────────────────────────── */
    var activeDomain = "all";
    var hoverIdx = -1;
    var focusIdx = 0;
    var focused = false;
    var pinned = false;
    var revealT = RTM.reducedMotion() ? 1 : 0;
    var alphaTween = null;

    var domBtns = [];
    (function () {
      function mk(key, label) {
        /* No data-k chip here. That attribute paints a domain hue on the
           segment, and this scene spends its only colour on direction. */
        var b = RTM.h("button", {
          class: "seg-btn", type: "button",
          "aria-pressed": key === "all" ? "true" : "false", text: label
        }, domSeg);
        b.addEventListener("click", function () { setDomain(key); });
        domBtns.push({ key: key, node: b });
      }
      mk("all", "All " + pairs.length);
      for (var i = 0; i < domOrder.length; i++) {
        mk(domOrder[i], domLabel(domOrder[i]) + " " + statBy[domOrder[i]].n);
      }
    })();

    /* ── legend ───────────────────────────────────────────────────────────── */
    function glyph(parent, kind, colour) {
      var sw = RTM.h("span", { class: "swatch" }, parent);
      sw.style.width = "28px";
      sw.style.height = "12px";
      sw.style.background = "transparent";
      sw.style.boxShadow = "none";
      sw.style.borderRadius = "0";
      var s = RTM.el("svg", { viewBox: "0 0 28 12", width: 28, height: 12, "aria-hidden": "true" }, sw);
      var paper = tok(["--paper"], "#fff");
      if (kind === "band") {
        RTM.el("line", {
          x1: 3, x2: 25, y1: 6, y2: 6, stroke: colour, "stroke-width": 1.2,
          "stroke-dasharray": "2 2"
        }, s);
        RTM.el("path", {
          d: "M3,3L3,9M25,3L25,9", fill: "none", stroke: colour, "stroke-width": 1.2
        }, s);
      } else {
        RTM.el("line", { x1: 5, x2: 23, y1: 6, y2: 6, stroke: colour, "stroke-width": 1.8 }, s);
        RTM.el("circle", { cx: 23, cy: 6, r: 3.4, fill: paper, stroke: colour, "stroke-width": 1.5 }, s);
        RTM.el("circle", { cx: 5, cy: 6, r: 3, fill: colour }, s);
      }
      return sw;
    }
    function buildLegend() {
      RTM.clear(legend);
      var accent = tok(["--outlier"], "#A83612");
      var grey = tok(["--ink-3", "--ink-2"], "#5D646C");

      var a = RTM.h("span", { class: "legend-item" }, legend);
      glyph(a, "dumbbell", accent);
      RTM.h("span", { text: "Child closer to average: " + nDown + " of " + pairs.length }, a);

      var b = RTM.h("span", { class: "legend-item" }, legend);
      glyph(b, "dumbbell", grey);
      RTM.h("span", { text: "Child level or further out: " + nLevel }, b);

      if (nEstimate) {
        var c = RTM.h("span", { class: "legend-item" }, legend);
        glyph(c, "band", grey);
        RTM.h("span", { class: "badge", "data-k": "estimate", text: "ESTIMATE" }, c);
        RTM.h("span", { text: "range drawn: " + nEstimate + " of " + pairs.length }, c);
      }
    }

    /* ── geometry ─────────────────────────────────────────────────────────── */
    var G = null;
    var W = 640;

    function geom(w) {
      var g = { w: w, bp: RTM.bp(w) };
      g.narrow = g.bp === "s";
      g.fs = RTM.pick(w, { s: 10, m: 11.5, l: 12.5 });
      g.rowFont = RTM.pick(w, { s: 9, m: 10, l: 11 });
      g.padL = RTM.pick(w, { s: 6, m: 10, l: 12 });
      g.padR = RTM.pick(w, { s: 10, m: 14, l: 16 });
      /* Row pitch has to clear the label's real line box, halo included, or
         forty names in one column collide with their own neighbours. */
      g.rowH = RTM.pick(w, { s: 14.5, m: 16, l: 17 });
      g.markR = RTM.pick(w, { s: 2.9, m: 3.3, l: 3.6 });
      g.stroke = RTM.pick(w, { s: 1.5, m: 1.7, l: 1.8 });
      g.sumStroke = RTM.pick(w, { s: 4, m: 4.6, l: 5.2 });

      /* The label gutter is MEASURED, not estimated from character counts. A
         count times an average em width is wrong by a third on a name full of
         capitals, and the failure mode is silent: every label gets an ellipsis
         it did not need, or one long name runs into the plot. */
      var sans = tok(["--sans"], "sans-serif");
      var probe = RTM.el("text", {
        x: -9999, y: -9999, "font-family": sans, "font-size": g.rowFont, visibility: "hidden"
      }, svg);
      var widest = 0, i, s, wq;
      for (i = 0; i < pairs.length; i++) {
        s = g.narrow ? pairs[i]._labShort : pairs[i]._labFull;
        probe.textContent = s;
        wq = 0;
        try { wq = probe.getBBox().width; } catch (e) { wq = s.length * g.rowFont * 0.58; }
        if (wq > widest) widest = wq;
      }
      if (probe.parentNode) probe.parentNode.removeChild(probe);
      g.labW = Math.min(Math.round(w * 0.34), Math.ceil(widest) + 5);
      g.labR = g.padL + g.labW;
      g.x0 = g.labR + RTM.pick(w, { s: 10, m: 14, l: 16 });
      g.x1 = w - g.padR;
      if (g.x1 - g.x0 < 90) { g.x0 = g.padL + Math.round(w * 0.28); g.x1 = w - g.padR; }
      g.x = RTM.linear(zlo, zhi, g.x0, g.x1);

      g.headA = RTM.pick(w, { s: 13, m: 15, l: 16 });
      g.headB = g.headA + RTM.pick(w, { s: 17, m: 19, l: 21 });
      g.gridTop = g.headB + 8;
      g.sumY = g.gridTop + g.rowH * 0.85;
      g.sepY = g.sumY + g.rowH * 0.66;
      g.rowsTop = g.sepY + 9;
      g.rowY = function (i2) { return g.rowsTop + i2 * g.rowH + g.rowH / 2; };
      g.plotBottom = g.rowY(pairs.length - 1) + g.rowH / 2;
      g.H = Math.round(g.plotBottom + g.fs + 24);
      g.ticks = RTM.ticks(zlo, zhi, RTM.pick(w, { s: 5, m: 6, l: 8 }));
      return g;
    }

    /* ── build ────────────────────────────────────────────────────────────── */
    var rows = [];
    var sum = null;
    var hiBand = null, catcher = null, labelsG = null;

    function draw(w) {
      W = Math.max(240, Math.round(w));
      /* An in flight dim tween is writing into rows that are about to be thrown
         away. Cancel it here and let the rebuild take its values from the
         filter directly. */
      if (alphaTween) { alphaTween.cancel(); alphaTween = null; }
      G = geom(W);
      buildLegend();
      RTM.clear(svg);
      rows = []; sum = null;

      var ink = tok(["--ink"], "#14171B");
      var ink2 = tok(["--ink-2", "--ink"], "#474E55");
      var ink3 = tok(["--ink-3", "--ink-2"], "#5D646C");
      var rule = tok(["--rule", "--ink-3"], "#CFC8B8");
      var ruleSoft = tok(["--rule-soft", "--rule"], "#E2DCCF");
      var paper = tok(["--paper"], "#F4F1EA");
      var paper2 = tok(["--paper-2", "--paper"], "#EAE5DA");
      var accent = tok(["--outlier"], "#A83612");
      var sans = tok(["--sans"], "sans-serif");
      var mono = tok(["--mono"], "monospace");

      svg.setAttribute("viewBox", "0 0 " + G.w + " " + G.H);
      svg.setAttribute("height", G.H);
      svg.style.height = G.H + "px";

      /* Draw order is z order. Highlight band, then furniture, then marks, and
         every label goes through RTM.txt so the whole label layer is hoisted
         last and no rule can be painted across a glyph. */
      var gHi = RTM.el("g", {}, svg);
      var gFurn = RTM.el("g", {}, svg);
      var gSum = RTM.el("g", {}, svg);
      var gRows = RTM.el("g", {}, svg);

      hiBand = RTM.el("rect", {
        x: G.padL, y: 0, width: Math.max(10, G.x1 - G.padL), height: G.rowH - 1,
        fill: paper2, rx: 2, opacity: 0
      }, gHi);

      /* --- furniture ------------------------------------------------------- */
      var ti, tx;
      for (ti = 0; ti < G.ticks.length; ti++) {
        tx = G.x(G.ticks[ti]);
        if (tx < G.x0 - 0.5 || tx > G.x1 + 0.5) continue;
        RTM.el("line", {
          x1: tx, x2: tx, y1: G.gridTop, y2: G.plotBottom + 6,
          stroke: ruleSoft, "stroke-width": 1
        }, gFurn);
        RTM.txt(svg, {
          x: tx, y: G.headB, "text-anchor": "middle", fill: ink3,
          "font-family": mono, "font-size": Math.max(8.5, G.fs - 1.5)
        }, sigTick(G.ticks[ti]), true);
        RTM.txt(svg, {
          x: tx, y: G.plotBottom + G.fs + 12, "text-anchor": "middle", fill: ink3,
          "font-family": mono, "font-size": Math.max(8.5, G.fs - 1.5)
        }, sigTick(G.ticks[ti]), true);
      }
      /* The mean of the reference population. Everything left of it is below
         average, which is where a handful of these children ended up. */
      var zx = G.x(0);
      if (zx > G.x0 - 0.5 && zx < G.x1 + 0.5) {
        RTM.el("line", {
          x1: zx, x2: zx, y1: G.gridTop, y2: G.plotBottom + 6,
          stroke: ink3, "stroke-width": 1.3, "stroke-dasharray": "4 3"
        }, gFurn);
      }
      /* Separator under the summary row, so the mean reads as a total rather
         than as the first family. */
      RTM.el("line", {
        x1: G.padL, x2: G.x1, y1: G.sepY, y2: G.sepY, stroke: rule, "stroke-width": 1
      }, gFurn);

      RTM.txt(svg, {
        x: G.padL, y: G.headA, "text-anchor": "start", fill: ink2,
        "font-family": sans, "font-size": Math.max(9, G.fs - 1.5), "font-weight": 620
      }, G.narrow ? "Ranked by parent" : "Family, ranked by the parent", true);
      /* The unit caption is dropped on a phone. The how-to-read line above the
         chart already names it, and the top right corner of a narrow stage is
         where the page's own fixed chrome lands. */
      if (!G.narrow) {
        RTM.txt(svg, {
          x: G.x1, y: G.headA, "text-anchor": "end", fill: ink3,
          "font-family": sans, "font-size": Math.max(8.5, G.fs - 2)
        }, "σ from the mean of their own reference group", true);
      }

      /* --- the mean, one thick rule --------------------------------------- */
      (function () {
        var st = currentStat();
        var down = st.fall >= 0;
        var col = down ? accent : ink3;
        var line = RTM.el("line", {
          stroke: col, "stroke-width": G.sumStroke, "stroke-linecap": "round", opacity: 0.92
        }, gSum);
        var pm = RTM.el("circle", {
          r: G.markR * 1.55, fill: paper, stroke: col, "stroke-width": 1.8
        }, gSum);
        var cm = RTM.el("circle", { r: G.markR * 1.3, fill: col }, gSum);
        var lab = RTM.txt(svg, {
          x: G.labR, y: G.sumY + G.fs * 0.35, "text-anchor": "end", fill: ink,
          "font-family": sans, "font-size": G.fs, "font-weight": 700
        }, "", true);
        var val = RTM.txt(svg, {
          "text-anchor": "start", fill: down ? accent : ink2,
          "font-family": mono, "font-size": Math.max(9, G.fs - 1), "font-weight": 620
        }, "", true);
        sum = { line: line, pm: pm, cm: cm, lab: lab, val: val };
      })();

      /* --- one row per family --------------------------------------------- */
      for (var i = 0; i < pairs.length; i++) {
        var q = pairs[i], y = G.rowY(i);
        var d = fall(q);
        var col2 = d > 1e-9 ? accent : ink3;
        var g = RTM.el("g", { "data-pair": q.id || q.family || i }, gRows);

        var bands = [];
        if (hasBand(q.parent)) bands.push(mkBand(g, q.parent, col2, y, false));
        if (hasBand(q.child)) bands.push(mkBand(g, q.child, col2, y, true));

        var conn = RTM.el("line", {
          y1: y, y2: y, stroke: col2, "stroke-width": G.stroke, "stroke-linecap": "round"
        }, g);
        var pm2 = RTM.el("circle", {
          cx: G.x(q.parent.z), cy: y, r: G.markR * 1.18,
          fill: paper, stroke: col2, "stroke-width": 1.5
        }, g);
        var cm2 = RTM.el("circle", { cy: y, fill: col2 }, g);

        /* Halo 2, not the 3.5 default. At this pitch a 3.5px halo inflates the
           line box past the row height and every name overlaps its neighbour. */
        var lab2 = RTM.txt(svg, {
          x: G.labR, y: y + G.rowFont * 0.35, "text-anchor": "end", fill: ink2,
          "font-family": sans, "font-size": G.rowFont
        }, G.narrow ? q._labShort : q._labFull, 2);
        /* Belt and braces: if the gutter estimate was optimistic, clip to it. */
        var room = G.labW - 2, guard = 0;
        while (guard++ < 40) {
          var wnow = 0;
          try { wnow = lab2.getBBox().width; } catch (e) { break; }
          if (wnow <= room || lab2.textContent.length < 5) break;
          lab2.textContent = lab2.textContent.slice(0, -2) + "…";
        }

        /* The dim level is re-derived from the live filter, not reset to 1. A
           resize or a theme flip calls draw() again, and a rebuild that forgot
           the filter left every row lit while the segment still read POLITICS.
           The screenshot found this; the click test could not, because it never
           redrew in between. */
        rows.push({
          g: g, conn: conn, pm: pm2, cm: cm2, lab: lab2, bands: bands,
          y: y, px: G.x(q.parent.z), cx: G.x(q.child.z), down: d > 1e-9,
          a: (activeDomain === "all" || q.domain === activeDomain) ? 1 : 0.1
        });
      }

      /* One catcher over the rows, above the marks and below the labels. Row
         bands make this a clean hit test with no scale inversion: the row is
         the floor of the offset over the row pitch. */
      catcher = RTM.el("rect", {
        x: G.padL, y: G.rowsTop, width: Math.max(10, G.x1 - G.padL),
        height: Math.max(10, G.plotBottom - G.rowsTop),
        fill: "transparent", "pointer-events": "all"
      }, svg);
      catcher.style.cursor = "pointer";
      wireCatcher();

      /* Labels paint last, so without this they would sit over the catcher and
         swallow the pointer. */
      labelsG = svg.querySelector("g.labels");
      if (labelsG) labelsG.style.pointerEvents = "none";

      focusIdx = Math.max(0, Math.min(focusIdx, pairs.length - 1));
      place();
    }

    /* The uncertainty range sits just BELOW the centreline, not on it. Drawn on
       the line, its end caps land on top of the connecting rule and read as two
       unexplained tick marks; dropped 3.6px they read as what they are, a range
       under the dot they belong to. */
    function mkBand(g, person, col, y, isChild) {
      var a = G.x(person.zLow), b = G.x(person.zHigh);
      var by = y + G.rowH * 0.22;
      var cap = Math.max(1.8, G.rowH * 0.14);
      var span = RTM.el("line", {
        x1: a, x2: b, y1: by, y2: by, stroke: col, "stroke-width": 1.1,
        "stroke-dasharray": "2 2", opacity: 0.6
      }, g);
      var caps = RTM.el("path", {
        d: "M" + a.toFixed(1) + "," + (by - cap).toFixed(1) + "L" + a.toFixed(1) + "," + (by + cap).toFixed(1) +
           "M" + b.toFixed(1) + "," + (by - cap).toFixed(1) + "L" + b.toFixed(1) + "," + (by + cap).toFixed(1),
        fill: "none", stroke: col, "stroke-width": 1.1, opacity: 0.6
      }, g);
      return { span: span, caps: caps, child: isChild };
    }

    function currentStat() {
      if (activeDomain === "all") return statAll;
      return statBy[activeDomain] || statAll;
    }

    /* ── placement ────────────────────────────────────────────────────────────
       The reveal is the finding in motion: forty open dots first, then each
       child slides out of its parent and drags a rule behind it. Staggered
       down the panel, so the long falls at the top read before the short ones
       at the bottom. Under reduced motion revealT starts at 1 and nothing
       moves at all.                                                          */
    function rowT(i) {
      if (revealT >= 1) return 1;
      var SPREAD = 0.5;
      var start = (i / Math.max(1, pairs.length - 1)) * SPREAD;
      return RTM.clamp((revealT - start) / (1 - SPREAD), 0, 1);
    }

    function place() {
      if (!G || !rows.length) return;
      var i, j;
      for (i = 0; i < rows.length; i++) {
        var R = rows[i], t = rowT(i);
        var cx = lerp(R.px, R.cx, t);
        var lit = (hoverIdx === i || (focused && focusIdx === i));
        /* A dimmed row that the reader is pointing at comes back to full, or
           the tooltip describes something they cannot see. */
        var op = lit ? 1 : R.a;
        var far = Math.abs(cx - R.px);

        R.conn.setAttribute("x1", R.px.toFixed(2));
        R.conn.setAttribute("x2", cx.toFixed(2));
        R.conn.setAttribute("stroke-width", (lit ? G.stroke + 1.4 : G.stroke).toFixed(2));
        R.conn.setAttribute("opacity", (far > 0.6 ? op : 0).toFixed(3));
        R.pm.setAttribute("opacity", op.toFixed(3));
        R.pm.setAttribute("r", (G.markR * (lit ? 1.5 : 1.18)).toFixed(2));
        /* A pair that did not move draws as a dot inside a ring, which is what
           "nothing happened" should look like next to a long rule. */
        R.cm.setAttribute("cx", cx.toFixed(2));
        R.cm.setAttribute("r", (G.markR * (far < G.markR * 1.7 ? 0.62 : 1) * (lit ? 1.35 : 1)).toFixed(2));
        R.cm.setAttribute("opacity", (op * t).toFixed(3));
        R.lab.setAttribute("opacity", op.toFixed(3));
        R.lab.setAttribute("fill", lit ? tok(["--ink"], "#14171B") : tok(["--ink-2", "--ink"], "#474E55"));
        R.lab.setAttribute("font-weight", lit ? 700 : 400);
        R.lab.style.display = op < 0.015 ? "none" : "";
        for (j = 0; j < R.bands.length; j++) {
          var bo = op * (R.bands[j].child ? t : 1) * 0.6;
          R.bands[j].span.setAttribute("opacity", bo.toFixed(3));
          R.bands[j].caps.setAttribute("opacity", bo.toFixed(3));
        }
      }
      placeSummary();
      RTM.hoist(svg);
      if (hoverIdx >= 0) positionTip(hoverIdx);
    }

    function placeSummary() {
      if (!sum) return;
      var st = currentStat();
      if (!st.ok || !isFinite(st.mp) || !isFinite(st.mc)) {
        sum.line.setAttribute("opacity", 0);
        sum.pm.setAttribute("opacity", 0);
        sum.cm.setAttribute("opacity", 0);
        sum.lab.textContent = ""; sum.val.textContent = "";
        return;
      }
      var t = rowT(pairs.length - 1);
      var px = G.x(st.mp), cxFull = G.x(st.mc);
      var cx = lerp(px, cxFull, t);
      var down = st.fall >= 0;
      var accent = tok(["--outlier"], "#A83612");
      var ink2 = tok(["--ink-2", "--ink"], "#474E55");
      var ink3 = tok(["--ink-3", "--ink-2"], "#5D646C");
      var col = down ? accent : ink3;

      sum.line.setAttribute("x1", px.toFixed(2));
      sum.line.setAttribute("x2", cx.toFixed(2));
      sum.line.setAttribute("y1", G.sumY.toFixed(2));
      sum.line.setAttribute("y2", G.sumY.toFixed(2));
      sum.line.setAttribute("stroke", col);
      sum.line.setAttribute("opacity", Math.abs(cx - px) > 0.6 ? 0.92 : 0);
      sum.pm.setAttribute("cx", px.toFixed(2));
      sum.pm.setAttribute("cy", G.sumY.toFixed(2));
      sum.pm.setAttribute("stroke", col);
      sum.cm.setAttribute("cx", cx.toFixed(2));
      sum.cm.setAttribute("cy", G.sumY.toFixed(2));
      sum.cm.setAttribute("fill", col);
      sum.cm.setAttribute("r", (G.markR * 1.3).toFixed(2));
      sum.cm.setAttribute("opacity", t.toFixed(3));

      var setName = activeDomain === "all"
        ? "All " + pairs.length
        : domLabel(activeDomain) + " " + st.n;
      sum.lab.textContent = G.narrow ? setName : setName + ", mean";
      sum.val.setAttribute("fill", down ? accent : ink2);
      sum.val.textContent = "mean " + (down ? "fall " : "rise ") + abs2(st.fall) + "σ" +
        (G.narrow ? "" : ", " + pctOf(st.kept) + " kept");

      /* Park it clear of the marks, and flip to the near side rather than
         hanging off the right edge of the frame. */
      var rightMost = Math.max(px, cxFull), leftMost = Math.min(px, cxFull);
      var wpx = measure(sum.val);
      var vx = rightMost + G.markR * 2 + 8;
      var anchor = "start";
      if (vx + wpx > G.x1) {
        vx = leftMost - G.markR * 2 - 8;
        anchor = "end";
        if (vx - wpx < G.x0) { vx = G.x1; anchor = "end"; }
      }
      sum.val.setAttribute("x", vx.toFixed(2));
      sum.val.setAttribute("y", (G.sumY + G.fs * 0.35).toFixed(2));
      sum.val.setAttribute("text-anchor", anchor);
    }

    /* Measure the real box, cached against the node's own text so a 60fps
       tween costs one getBBox per change rather than one per frame. */
    function measure(n) {
      if (n.__mw === undefined || n.__mt !== n.textContent) {
        var w = 0;
        try { w = n.getBBox().width; } catch (e) { w = 0; }
        n.__mw = w || (n.textContent || "").length * G.fs * 0.56;
        n.__mt = n.textContent;
      }
      return n.__mw;
    }

    /* ── interaction ──────────────────────────────────────────────────────── */
    function wireCatcher() {
      catcher.addEventListener("pointermove", function (ev) {
        if (pinned) return;
        var i = rowAt(ev);
        if (i < 0) { if (hoverIdx >= 0) hide(); return; }
        if (i !== hoverIdx) show(i); else positionTip(i);
      });
      catcher.addEventListener("pointerleave", function () { if (!pinned) hide(); });
      catcher.addEventListener("click", function (ev) {
        var i = rowAt(ev);
        if (i < 0) { pinned = false; hide(); return; }
        pinned = (hoverIdx === i) ? !pinned : true;
        focusIdx = i;
        show(i);
      });
    }

    /* A pointer position arrives in rendered pixels while the drawing is in
       viewBox units. Undo the CSS downscale or every hit is wrong on a narrow
       screen, which is the same trap as canvas hit testing. Row bands have no
       invert, so the row is the floor of the offset over the pitch. */
    function rowAt(ev) {
      var r = svg.getBoundingClientRect();
      if (!r.width || !rows.length) return -1;
      var k = G.w / r.width;
      var uy = (ev.clientY - r.top) * k;
      var i = Math.floor((uy - G.rowsTop) / G.rowH);
      if (i < 0 || i >= pairs.length) return -1;
      /* A dimmed row is still a row and its numbers are still true, so it stays
         hoverable. Only the arrow keys respect the filter. */
      return i;
    }

    function visibleIdx() {
      var out = [];
      for (var i = 0; i < pairs.length; i++) {
        if (activeDomain === "all" || pairs[i].domain === activeDomain) out.push(i);
      }
      return out.length ? out : [0];
    }

    function onKey(ev) {
      var k = ev.key;
      if (k === "Escape") { pinned = false; hide(); return; }
      var list = visibleIdx();
      var at = list.indexOf(focusIdx);
      var next = null;
      if (k === "ArrowDown" || k === "ArrowRight") next = list[Math.min(list.length - 1, (at < 0 ? -1 : at) + 1)];
      else if (k === "ArrowUp" || k === "ArrowLeft") next = list[Math.max(0, (at < 0 ? 1 : at) - 1)];
      else if (k === "Home") next = list[0];
      else if (k === "End") next = list[list.length - 1];
      else if (k === "Enter" || k === " ") { pinned = !pinned; show(focusIdx); ev.preventDefault(); return; }
      if (next === null || next === undefined) return;
      ev.preventDefault();
      focusIdx = next;
      show(next);
    }
    function onFocus() { focused = true; show(visibleIdx().indexOf(focusIdx) >= 0 ? focusIdx : visibleIdx()[0]); }
    function onBlur() { focused = false; if (!pinned) hide(); }
    chart.addEventListener("keydown", onKey);
    chart.addEventListener("focus", onFocus);
    chart.addEventListener("blur", onBlur);

    function announce(q) {
      liveRegion.textContent = (q._labFull || "") + ", " + domLabel(q.domain) + ". " +
        (q.parent.name || "") + " " + RTM.sigma(q.parent.z) + ", " +
        (q.child.name || "") + " " + RTM.sigma(q.child.z) + ", " + changeText(fall(q)) +
        (verified(q) ? "." : ", an estimate.") + " " + (q.note || "");
    }

    /* ── tooltip ──────────────────────────────────────────────────────────── */
    function personLines(box, person, role) {
      RTM.h("div", { class: "tip-name", text: (person.name || "") + " (" + role + ")" }, box);
      var bits = [RTM.sigma(person.z)];
      if (hasBand(person)) bits.push("range " + RTM.sigma(person.zLow) + " to " + RTM.sigma(person.zHigh));
      RTM.h("div", { class: "tip-stat", text: bits.join("   ") }, box);
      var sub = [];
      if (person.role) sub.push(person.role);
      if (person.years) sub.push(person.years);
      if (person.stat) sub.push(person.stat);
      if (sub.length) RTM.h("div", { class: "tip-note", text: sub.join(". ") }, box);
    }

    function show(i) {
      if (!rows[i]) return;
      hoverIdx = i;
      focusIdx = i;
      var q = pairs[i];
      RTM.clear(tip);
      var headLine = RTM.h("div", { class: "tip-name" }, tip);
      headLine.textContent = (q.family || q._labFull) + " · " + domLabel(q.domain);
      if (!verified(q)) RTM.h("span", { class: "badge", "data-k": "estimate", text: "ESTIMATE" }, headLine);
      personLines(tip, q.parent, "parent");
      personLines(tip, q.child, "child");
      RTM.h("div", { class: "tip-stat", text: changeText(fall(q)) }, tip);
      if (q.note) RTM.h("div", { class: "tip-note", text: q.note }, tip);
      if (q.basis) RTM.h("div", { class: "tip-note", text: "Measured against: " + q.basis }, tip);
      tip.removeAttribute("hidden");
      tip.setAttribute("data-show", "true");

      if (hiBand) {
        hiBand.setAttribute("y", (rows[i].y - G.rowH / 2 + 0.5).toFixed(2));
        hiBand.setAttribute("opacity", 0.85);
      }
      announce(q);
      place();
    }
    function hide() {
      hoverIdx = -1;
      tip.setAttribute("hidden", "hidden");
      tip.removeAttribute("data-show");
      if (hiBand) hiBand.setAttribute("opacity", 0);
      place();
    }
    function positionTip(i) {
      var R = rows[i];
      if (!R || tip.hasAttribute("hidden")) return;
      var wr = chart.getBoundingClientRect();
      var sr = svg.getBoundingClientRect();
      if (!sr.width) return;
      var k = sr.width / G.w;
      var mx = sr.left - wr.left + Math.max(R.px, R.cx) * k;
      var my = sr.top - wr.top + R.y * k;
      var tw = tip.offsetWidth || 220, th = tip.offsetHeight || 120;
      var x = mx + 16;
      var y = my - th / 2;
      if (x + tw > wr.width - 4) x = mx - tw - 16;
      if (x < 4) x = 4;
      if (y < 4) y = 4;
      if (y + th > wr.height - 4) y = Math.max(4, wr.height - th - 4);
      tip.style.left = Math.round(x) + "px";
      tip.style.top = Math.round(y) + "px";
    }

    /* ── state changes ────────────────────────────────────────────────────── */
    function setDomain(key) {
      activeDomain = key;
      for (var i = 0; i < domBtns.length; i++) {
        domBtns[i].node.setAttribute("aria-pressed", domBtns[i].key === key ? "true" : "false");
      }
      pinned = false; hide();
      var st = currentStat();
      liveRegion.textContent = (key === "all"
        ? "Showing all " + pairs.length + " pairs. "
        : domLabel(key) + ", " + st.n + " pairs. ") +
        "Mean " + RTM.sigma(st.mp, 2) + " to " + RTM.sigma(st.mc, 2) + ", so the children kept " +
        pctOf(st.kept) + ".";

      /* Dimmed rather than removed, so the scale stays put and the comparison
         stays on screen. Opacity is set on every element rather than on the
         group, because a group's opacity is invisible to anything measuring a
         child's computed style. */
      if (alphaTween) { alphaTween.cancel(); alphaTween = null; }
      var from = [], to = [];
      for (i = 0; i < pairs.length; i++) {
        from.push(rows[i] ? rows[i].a : 1);
        to.push(key === "all" || pairs[i].domain === key ? 1 : 0.1);
      }
      alphaTween = MO.tween({
        from: from, to: to, dur: 420, ease: "cubicOut",
        onUpdate: function (vals) {
          for (var j = 0; j < rows.length; j++) rows[j].a = vals[j];
          place();
        },
        onDone: function () { alphaTween = null; place(); }
      });

      var list = visibleIdx();
      if (list.indexOf(focusIdx) < 0) focusIdx = list[0];
    }

    /* ── scrolly ──────────────────────────────────────────────────────────── */
    function progress(t) {
      revealT = RTM.clamp(t, 0, 1);
      place();
    }

    return {
      draw: function (w) { draw(w); },
      progress: progress,
      /* Belt and braces for the screenshot harness, which freezes the page
         before it can scroll: jump straight to the finished panel. */
      settle: function () { revealT = 1; place(); },
      destroy: function () {
        if (alphaTween) alphaTween.cancel();
        alphaTween = null;
        chart.removeEventListener("keydown", onKey);
        chart.removeEventListener("focus", onFocus);
        chart.removeEventListener("blur", onBlur);
        RTM.clear(mount);
      }
    };
  });
})();
