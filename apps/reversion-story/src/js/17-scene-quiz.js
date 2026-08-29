/* ============================================================================
   SCENE 7 · quiz  ·  the reader predicts, then gets scored.

   Five real parents, one at a time. The reader places the child on the same
   sigma axis by dragging a marker or by moving a slider. Both paths write the
   same state. Nothing about the child exists in the DOM until the guess is
   locked in: the answer lives in a closure until the reveal, so a curious
   reader with an inspector, or a screen reader running ahead, cannot find it.

   TWO EDITORIAL DECISIONS, BOTH STATED ON THE FIGURE:

   1. The marker starts on the PARENT'S own number, not at zero. That is the
      guess this section is about, the assumption that the child holds the
      parent's place. Starting at zero handed the reader an accidentally good
      answer in any round whose child came out near average, and the scene then
      argued against the piece it belongs to.

   2. The five rounds are ordered with the fully measured pairs first and, inside
      each group, the most extreme parent first. Neither key looks at how a
      child turned out or at anyone's miss, so the order cannot flatter the
      model. It decides which case the reader meets first, nothing else: the
      reader plays all five and the score is the same whatever the order.

   The payoff copy is computed from the reader's own five answers. If they
   leaned high it says so. If they leaned low it says that instead. If they
   never moved the marker it says that, because then the score belongs to the
   naive guess rather than to them.
   ========================================================================== */
(function () {
  "use strict";
  if (typeof RTM === "undefined" || !RTM.scene) return;

  var M = RTM.motion || null;
  var SEED = 8675309;          /* fixed: every reader gets the same five pairs */
  var MAX_ROUNDS = 5;
  var ERR_MAX = 4;             /* half width of the error strip, in sigma      */

  var SELECTION_NOTE =
    "Both people sit on one scale: standard deviations above the mean of a named population. " +
    "The parents were picked for being outliers, never for how their children turned out. " +
    "Picking on the child would have shown you only the ones who held on.";

  var METHOD_NOTE =
    "The marker starts on the parent’s own number, because that is the guess this section is " +
    "about. Move it wherever you like. The rounds run measured pairs first and, inside that, " +
    "the most extreme parent first, so the order never depends on how a child turned out.";

  var LANES = [
    { key: "parent", one: "The parent", many: "The parents" },
    { key: "guess",  one: "Your guess", many: "Your guesses" },
    { key: "child",  one: "The child",  many: "The children" },
    { key: "model",  one: "The model",  many: "The model" }
  ];

  /* ── tokens ──────────────────────────────────────────────────────────────
     Read at draw time so a theme flip is free. Several plausible token names
     are tried because the design agent owns css/01-tokens.css, not this file. */
  function tok(names, fallback) {
    for (var i = 0; i < names.length; i++) {
      var v = "";
      try { v = RTM.css(names[i]); } catch (e) { v = ""; }
      if (v) return v;
    }
    return fallback;
  }
  /* The two argument colours come straight from the design tokens: the parent
     is drawn in the outlier colour, the child in the mean colour, because that
     is the whole sentence this scene is making. The reader's own marker is a
     softer ink, the model is grey. In the error strip one accent carries the
     finding (you guessed too high) and grey carries everything else. */
  function palette() {
    return {
      ink:     tok(["--ink"], "#14171B"),
      guess:   tok(["--ink-2", "--ink"], "#474E55"),
      paper:   tok(["--paper"], "#F4F1EA"),
      outlier: tok(["--outlier", "--accent"], "#A83612"),
      mean:    tok(["--mean"], "#1E5F6E"),
      muted:   tok(["--ink-3", "--ink-2", "--muted"], "#5D646C"),
      rule:    tok(["--rule", "--grid"], "#CFC8B8"),
      grid:    tok(["--rule-soft", "--rule", "--grid"], "#E2DCCF"),
      sans:    tok(["--sans", "--font-sans"], "ui-sans-serif, system-ui, sans-serif"),
      mono:    tok(["--mono", "--font-mono"], "ui-monospace, SFMono-Regular, Menlo, monospace")
    };
  }

  /* ── formatting ────────────────────────────────────────────────────────── */
  function mag(z) { return Math.abs(z).toFixed(1) + "σ"; }
  function sig(z, dp) { return RTM.sigma(z, dp === undefined ? 1 : dp); }
  function tickLabel(v) {
    if (Math.abs(v) < 1e-9) return "0";
    var dp = Math.abs(v - Math.round(v)) > 1e-9 ? 1 : 0;
    return (v > 0 ? "+" : "−") + Math.abs(v).toFixed(dp) + "σ";
  }
  /* A basis sentence already ends in a full stop. Printing "... standing.. Source"
     is the kind of typo that survives six reviews. */
  function trimDot(s) { return String(s || "").replace(/[\s.]+$/, ""); }
  function avg(arr, acc) {
    if (!arr.length) return 0;
    var s = 0;
    for (var i = 0; i < arr.length; i++) s += acc(arr[i]);
    return s / arr.length;
  }
  /* A political placement comes from the office rubric, which is a ranking
     rather than a measurement. Every other judged placement in this piece
     carries a badge on its own mark, so this one does too. */
  function isRubric(d) { return /rubric/i.test(d && d.basis || ""); }

  /* ── the model the reader is playing against ─────────────────────────────
     Slope of child z on parent z, fitted across the verified pairs only. An
     editorial placement never drives this number. Falls back to the height
     correlation if there are too few verified pairs to fit anything. */
  function modelSlope() {
    var D = RTM.data || {};
    var rows = (D.DYNASTIES || []).filter(function (d) {
      return d && d.parent && d.child &&
        isFinite(d.parent.z) && isFinite(d.child.z) &&
        d.parent.verified !== false && d.child.verified !== false;
    });
    if (rows.length >= 3 && RTM.ols) {
      var f = RTM.ols(rows,
        function (d) { return d.parent.z; },
        function (d) { return d.child.z; });
      if (isFinite(f.slope) && f.slope > 0 && f.slope < 1.5) return f.slope;
    }
    var H = D.HEIGHT || {};
    return isFinite(H.r) ? H.r : 0.47;
  }

  /* ── which five pairs, chosen once, seeded ───────────────────────────────
     The selection rule matters more than it looks.

     Pairs are chosen on the PARENT and never on the child. Picking only the
     children whose achievement is a published figure sounds like the careful
     option, and it is the wrong one: a child has a published figure precisely
     when they had a career worth measuring, so "verified child" is a proxy
     for "did not revert". Filtering on it would build the survivorship bias
     this piece is about straight into the quiz, and the reader would come out
     with the opposite lesson.

     So: the parent must be a verified outlier, because that is the question
     the piece asks. The child is then whatever the child was. Editorial
     placements are capped at 2 of 5, close to their share of the eligible
     pool, so one unlucky seed cannot fill the quiz with judgement calls, and
     every one of them is drawn with its range and flagged on screen.

     Seeded round robin across domains, so the five are not all politicians. */
  var MAX_ESTIMATES = 2;
  var Z_FLOORS = [2, 1, -Infinity];

  function shuffled(arr, rnd) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(rnd() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }
  function roundRobin(list, rnd) {
    var groups = {}, keys = [];
    list.forEach(function (d) {
      var k = d.domain || "other";
      if (!groups[k]) { groups[k] = []; keys.push(k); }
      groups[k].push(d);
    });
    keys = shuffled(keys, rnd);
    keys.forEach(function (k) { groups[k] = shuffled(groups[k], rnd); });
    var out = [], more = true;
    while (more) {
      more = false;
      for (var i = 0; i < keys.length; i++) {
        var g = groups[keys[i]];
        if (g.length) { out.push(g.shift()); more = true; }
      }
    }
    return out;
  }
  function pickRounds() {
    var D = RTM.data || {};
    var usable = (D.DYNASTIES || []).filter(function (d) {
      return d && d.parent && d.child && isFinite(d.parent.z) && isFinite(d.child.z) &&
        d.parent.verified !== false;
    });
    var rnd = RTM.rng(SEED);
    var pool = [];
    for (var f = 0; f < Z_FLOORS.length; f++) {
      pool = usable.filter(function (d) { return d.parent.z >= Z_FLOORS[f]; });
      if (pool.length >= MAX_ROUNDS) break;
    }
    if (!pool.length) pool = usable;

    var order = roundRobin(pool, rnd);
    var out = [], estimates = 0, i;
    for (i = 0; i < order.length && out.length < MAX_ROUNDS; i++) {
      if (order[i].child.verified === false) {
        if (estimates >= MAX_ESTIMATES) continue;
        estimates++;
      }
      out.push(order[i]);
    }
    /* If the cap starved the list, relax it rather than run a short quiz. */
    for (i = 0; i < order.length && out.length < MAX_ROUNDS; i++) {
      if (out.indexOf(order[i]) < 0) out.push(order[i]);
    }
    /* Play order. Measured pairs before editorial estimates, then the most
       extreme parent first. Neither key touches the child's actual number, so
       the order cannot be tuned to make the model look good, and the total
       score does not depend on it at all. */
    out.sort(function (a, b) {
      var ea = a.child.verified === false ? 1 : 0;
      var eb = b.child.verified === false ? 1 : 0;
      if (ea !== eb) return ea - eb;
      return b.parent.z - a.parent.z;
    });
    return out;
  }

  /* ========================================================================= */
  RTM.scene("quiz", function (mount) {
    var pairs = pickRounds();
    var slope = modelSlope();
    var n = pairs.length;

    /* One fixed axis for the whole quiz. If the scale moved between rounds,
       the same marker position would mean a different number each time. */
    var dom = (function () {
      var lo = 0, hi = 1;
      pairs.forEach(function (d) {
        var vals = [d.parent.z, d.child.z, slope * d.parent.z];
        if (isFinite(d.child.zLow)) vals.push(d.child.zLow);
        if (isFinite(d.child.zHigh)) vals.push(d.child.zHigh);
        vals.forEach(function (v) { if (v < lo) lo = v; if (v > hi) hi = v; });
      });
      lo = Math.min(-1, Math.floor((lo - 0.5) * 2) / 2);
      hi = Math.max(6, Math.ceil((hi + 0.5) * 2) / 2);
      return [lo, hi];
    })();

    /* The naive guess, per round: the child holds the parent's place. */
    function startFor(i) {
      if (!pairs[i]) return 0;
      return Math.round(RTM.clamp(pairs[i].parent.z, dom[0], dom[1]) * 10) / 10;
    }

    var st = {
      i: 0,
      phase: n ? "guess" : "empty",   /* guess | revealed | done | empty */
      guess: startFor(0),
      touched: false,
      reveal: 0,
      results: [],
      w: 640,
      xScale: null
    };

    var anim = null, dragging = false, destroyed = false;

    /* ── DOM, built once ─────────────────────────────────────────────────── */
    RTM.clear(mount);

    var head = RTM.h("div", { class: "fig-head" }, mount);
    var elTitle = RTM.h("p", { class: "fig-title" }, head);
    var elSub = RTM.h("p", { class: "fig-sub" }, head);

    var chart = RTM.h("div", { class: "chart" }, mount);
    var svg = RTM.el("svg", {
      width: "100%", "aria-hidden": "true", focusable: "false"
    }, chart);

    var elHint = RTM.h("p", { class: "hint" }, mount);

    var row1 = RTM.h("div", { class: "ctrl-row" }, mount);
    var ctrl = RTM.h("div", { class: "ctrl" }, row1);
    var sliderId = "quiz-guess-slider";
    RTM.h("label", { class: "ctrl-label", for: sliderId, text: "Where did the child land?" }, ctrl);
    var slider = RTM.h("input", {
      class: "slider", id: sliderId, type: "range",
      min: String(dom[0]), max: String(dom[1]), step: "0.1", value: String(st.guess)
    }, ctrl);
    var btnMain = RTM.h("button", { class: "btn btn-primary", type: "button" }, row1);
    var btnAgain = RTM.h("button", { class: "btn", type: "button", text: "Start over" }, row1);

    /* One readout, not three. Three bordered boxes in a row read as three
       disabled inputs, and every number in them is also on the chart. */
    var row2 = RTM.h("div", { class: "ctrl-row" }, mount);
    var outLine = RTM.h("span", { class: "readout" }, row2);

    var note = RTM.h("p", { class: "fig-note" }, mount);
    var status = RTM.h("p", { class: "sr-only", role: "status", "aria-live": "polite" }, mount);
    var table = RTM.h("details", { class: "tbl-wrap" }, mount);

    /* ── guess plumbing ──────────────────────────────────────────────────── */
    function valueText(z) {
      if (Math.abs(z) < 0.05) return "level with the population average";
      return Math.abs(z).toFixed(1) + " sigma " + (z > 0 ? "above" : "below") + " the population average";
    }
    function setGuessSilent(v) {
      st.guess = Math.round(RTM.clamp(v, dom[0], dom[1]) * 10) / 10;
      slider.value = String(st.guess);
      slider.setAttribute("aria-valuetext", valueText(st.guess));
    }
    function setGuess(v, fromSlider) {
      if (st.phase !== "guess") return;
      var prev = st.guess;
      setGuessSilent(v);
      if (fromSlider) slider.value = String(st.guess);
      if (st.guess !== prev) { st.touched = true; render(); } else paintChrome();
    }
    slider.addEventListener("input", function () { setGuess(parseFloat(slider.value), true); });

    /* Pointer drag. The move and up listeners live on the window, not on the
       catcher rect: render() rebuilds the SVG on every frame, so a listener
       bound to the rect would be torn out from under the drag after one step. */
    function pointerToZ(e) {
      var r = svg.getBoundingClientRect();
      if (!r.width || !st.xScale) return null;
      /* Undo any CSS downscale: pointer coordinates arrive in rendered pixels,
         the drawing lives in viewBox units. */
      var ux = (e.clientX - r.left) * (st.w / r.width);
      return st.xScale.invert(ux);
    }
    function onDown(e) {
      if (st.phase !== "guess") return;
      dragging = true;
      var z = pointerToZ(e);
      if (z !== null) setGuess(z);
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      window.addEventListener("pointercancel", onUp);
      if (e.cancelable) e.preventDefault();
    }
    function onMove(e) {
      if (!dragging) return;
      var z = pointerToZ(e);
      if (z !== null) setGuess(z);
      if (e.cancelable) e.preventDefault();
    }
    function onUp() {
      dragging = false;
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    }

    /* ── round flow ──────────────────────────────────────────────────────── */
    function lockIn() {
      var d = pairs[st.i];
      var pred = slope * d.parent.z;
      st.results.push({
        pair: d,
        guess: st.guess,
        actual: d.child.z,
        model: pred,
        err: Math.abs(st.guess - d.child.z),
        modelErr: Math.abs(pred - d.child.z),
        bias: st.guess - d.child.z,
        moved: st.touched
      });
      st.phase = "revealed";
      st.reveal = 0;
      if (anim) { anim.cancel(); anim = null; }
      if (M && M.tween) {
        /* tween lands on its final frame immediately under reduced motion,
           so the reveal is instant there without a second guard. */
        anim = M.tween({
          from: 0, to: 1, dur: 780, ease: "cubicOut",
          onUpdate: function (v) { st.reveal = v; render(); },
          onDone: function () { anim = null; }
        });
      } else {
        st.reveal = 1;
      }
      render();
      buildTable();
      announceResult();
    }
    function nextRound() {
      if (st.i + 1 < n) {
        st.i++;
        st.phase = "guess";
        st.reveal = 0;
        st.touched = false;
        setGuessSilent(startFor(st.i));
        render();
        status.textContent = "Round " + (st.i + 1) + " of " + n + ". " + promptLine(pairs[st.i]);
      } else {
        st.phase = "done";
        st.reveal = 1;
        buildTable();
        render();
        status.textContent = payoffTitle() + " " + payoffDetail();
      }
    }
    function restart() {
      if (anim) { anim.cancel(); anim = null; }
      st.i = 0;
      st.phase = n ? "guess" : "empty";
      st.reveal = 0;
      st.touched = false;
      st.results = [];
      setGuessSilent(startFor(0));
      table.open = false;
      buildTable();
      render();
      if (n) status.textContent = "Quiz restarted. Round 1 of " + n + ". " + promptLine(pairs[0]);
      try { slider.focus(); } catch (e) { /* fine */ }
    }

    btnMain.addEventListener("click", function () {
      if (st.phase === "guess") lockIn();
      else if (st.phase === "revealed") nextRound();
      else if (st.phase === "done") restart();
    });
    btnAgain.addEventListener("click", restart);

    /* ── copy, all of it computed ────────────────────────────────────────── */
    function lowerFirst(s) { return s.charAt(0).toLowerCase() + s.slice(1); }
    function promptLine(d) {
      return d.parent.name + " sits at " + sig(d.parent.z) + " on " +
        (d.metric ? lowerFirst(d.metric) : "this measure") +
        ". The marker starts on his own number. Move it, then lock it in.";
    }
    function totals() {
      var t = { err: 0, modelErr: 0, bias: 0, high: 0, low: 0, still: 0, n: st.results.length };
      st.results.forEach(function (r) {
        t.err += r.err; t.modelErr += r.modelErr; t.bias += r.bias;
        if (r.bias > 0.05) t.high++; else if (r.bias < -0.05) t.low++;
        if (!r.moved) t.still++;
      });
      if (t.n) { t.err /= t.n; t.modelErr /= t.n; t.bias /= t.n; }
      return t;
    }
    function payoffTitle() {
      var t = totals();
      if (t.bias > 0.15) return "You put the children " + mag(t.bias) + " too high, on average.";
      if (t.bias < -0.15) return "You put the children " + mag(t.bias) + " too low, on average.";
      return "Your guesses came out close to centred.";
    }
    function payoffDetail() {
      var t = totals();
      var lean = t.high > t.low
        ? "You guessed above the child in " + t.high + " of " + t.n + " rounds."
        : t.low > t.high
          ? "You guessed below the child in " + t.low + " of " + t.n + " rounds."
          : "You split evenly, " + t.high + " high and " + t.low + " low.";
      var who = t.err < t.modelErr - 0.02
        ? "You beat the model, which missed by " + mag(t.modelErr) + " a round."
        : t.err > t.modelErr + 0.02
          ? "The model missed by " + mag(t.modelErr) + " a round. You missed by " + mag(t.err) + "."
          : "You and the model missed by about the same amount, " + mag(t.err) + " a round.";
      var still = t.still === t.n && t.n
        ? " You left the marker on the parent every round, so that score belongs to the guess, not to you."
        : "";
      return lean + " " + who + still;
    }
    function announceResult() {
      var r = st.results[st.results.length - 1];
      status.textContent = r.pair.child.name + " landed at " + sig(r.actual) +
        ". You said " + sig(r.guess) + ". The model said " + sig(r.model) +
        ". You missed by " + mag(r.err) + ", and you were " +
        (r.bias > 0 ? "too high." : r.bias < 0 ? "too low." : "exactly right.");
    }

    /* ── the table ───────────────────────────────────────────────────────────
       Rebuilt after every round, never empty and never ahead of the reader.

       A fallback that only exists once the quiz is over is a dead end: anyone
       who opens it early, and every screen reader walking the page in order,
       finds an empty box. So the table ships with one row per round from the
       first paint. A round that has not been played carries the parent, which
       is the question, and says in the cell that the rest is not filled in yet.
       Nothing about the child, not the name and not the number, is written into
       the DOM until that round's guess is locked in. */
    var COLS = ["Round", "Family", "Parent", "Parent z", "Child", "Child z",
                "Your guess", "Model", "Your miss"];

    function buildTable() {
      RTM.clear(table);
      /* No pairs means no table. An empty one would be a promise the scene
         cannot keep. */
      if (!n) {
        if (table.parentNode) table.parentNode.removeChild(table);
        return;
      }
      if (!table.parentNode) mount.appendChild(table);
      var played = st.results.length;
      RTM.h("summary", {
        text: played >= n
          ? "The " + n + " pairs used, and how you did"
          : "Your rounds so far, " + played + " of " + n
      }, table);
      var t = RTM.h("table", {}, table);
      var cap = RTM.h("caption", {
        text: "One row per round. A round you have played shows your guess, the model’s prediction and " +
              "where the child actually landed. A round you have not played yet shows only the parent, " +
              "because the answer is not written down anywhere until you have committed to a guess. " +
              "Your miss is signed: a plus means you put the child above where the child landed. " +
              "All figures are z scores above the mean of each pair’s named reference population."
      }, t);
      cap.className = "sr-only";
      var thead = RTM.h("thead", {}, t);
      var hr = RTM.h("tr", {}, thead);
      COLS.forEach(function (lab) { RTM.h("th", { scope: "col", text: lab }, hr); });

      var tb = RTM.h("tbody", {}, t);
      pairs.forEach(function (d, i) {
        var r = st.results[i];
        var tr = RTM.h("tr", {}, tb);
        RTM.h("th", { scope: "row", text: String(i + 1) }, tr);
        RTM.h("td", { text: d.family || d.id || "" }, tr);
        RTM.h("td", { text: d.parent.name + (isRubric(d) ? " (rubric)" : "") }, tr);
        RTM.h("td", { text: sig(d.parent.z, 2) }, tr);
        if (r) {
          RTM.h("td", { text: r.pair.child.name + (r.pair.child.verified === false ? " (estimate)" : "") }, tr);
          RTM.h("td", { text: sig(r.actual, 2) }, tr);
          RTM.h("td", { text: sig(r.guess, 2) }, tr);
          RTM.h("td", { text: sig(r.model, 2) }, tr);
          RTM.h("td", { text: sig(r.bias, 2) }, tr);
        } else {
          RTM.h("td", { colspan: String(COLS.length - 4), text: "Not played yet" }, tr);
        }
      });
    }

    /* ── chrome ──────────────────────────────────────────────────────────── */
    function paintChrome() {
      if (st.phase === "empty") {
        elTitle.textContent = "This quiz needs at least one parent and child pair.";
        elSub.textContent = "No pairs were available to play.";
        elHint.textContent = "";
        outLine.textContent = "";
        btnMain.hidden = true;
        btnAgain.hidden = true;
        slider.disabled = true;
        return;
      }
      var d = pairs[st.i];
      var t = totals();

      if (st.phase === "done") {
        elTitle.textContent = payoffTitle();
        elSub.textContent = payoffDetail();
        elHint.textContent = "";
        btnMain.textContent = "Play again";
        btnMain.hidden = false;
        slider.disabled = true;
        outLine.textContent = "All " + n + " rounds played. Your average miss " + mag(t.err) +
          ", the model’s " + mag(t.modelErr) + ".";
        note.textContent = "The model is one line: child z equals " + slope.toFixed(2) +
          " times parent z, fitted on the verified pairs only. It knows nothing about any " +
          "individual family. " + SELECTION_NOTE;
        return;
      }

      slider.disabled = st.phase !== "guess";
      btnMain.hidden = false;
      elTitle.textContent = st.phase === "guess"
        ? "You have seen the parent. Place the child."
        : d.child.name + " landed at " + sig(d.child.z) + ".";
      elSub.textContent = st.phase === "guess"
        ? promptLine(d)
        : (d.note || (d.parent.name + " to " + d.child.name + ", measured on " +
            lowerFirst(d.metric || "the same scale") + "."));
      elHint.textContent = st.phase === "guess"
        ? "Drag the marker on the ‘Your guess’ row, or use the slider. Arrow keys move it a tenth of a sigma."
        : "";
      btnMain.textContent = st.phase === "guess"
        ? "Lock in your guess"
        : (st.i + 1 < n ? "Next parent" : "See how you did");

      outLine.textContent = "Round " + (st.i + 1) + " of " + n +
        (t.n ? ". Your average miss " + mag(t.err) + ", the model’s " + mag(t.modelErr) + "." : ".");

      note.textContent = st.phase === "revealed"
        ? (d.child.verified === false
            ? d.child.name + " has no comparable published figure, so that placement is an editorial estimate and is drawn with its range. "
            : "") +
          (isRubric(d) ? "The parent’s placement comes from the office rubric, which is a ranking rather than a measurement. " : "") +
          "Reference population: " + trimDot(d.basis || "stated in the source") +
          ". Source: " + (d.source ? RTM.data.cite(d.source) : "see the source list") + "."
        : SELECTION_NOTE + " " + METHOD_NOTE;
    }

    /* ── the chart ───────────────────────────────────────────────────────── */
    function render() {
      if (destroyed) return;
      paintChrome();
      if (st.phase === "empty") { RTM.clear(svg); return; }

      var w = st.w, C = palette();
      var small = RTM.bp(w) === "s";
      var done = st.phase === "done";
      var revealed = st.phase === "revealed" || done;
      var fs = RTM.pick(w, { s: 11, m: 12, l: 13 });
      var fsLane = RTM.pick(w, { s: 10, m: 11, l: 12 });
      var fsVal = RTM.pick(w, { s: 12, m: 13, l: 14 });
      var fsMicro = RTM.pick(w, { s: 9.5, m: 10, l: 10.5 });
      var pad = RTM.pick(w, { s: 8, m: 14, l: 18 });
      var gutter = small ? 0 : RTM.pick(w, { m: 84, l: 100 });
      var m = {
        top: 14,
        right: pad + 14,
        left: pad + gutter + 14
      };
      var laneH = RTM.pick(w, { s: 60, m: 42, l: 44 });
      var rDot = RTM.pick(w, { s: 6, m: 6.5, l: 7 });

      /* Vertical plan, fixed in advance so nothing has to dodge at draw time.
         Four lanes, then the shared axis, then a rule, then the error strip
         with its own scale. */
      var ay = m.top + laneH * LANES.length + 12;      /* axis rule           */
      var axLabY = ay + 32;                            /* what the axis means */
      var divY = ay + 46;                              /* panel divider       */
      var capY = ay + 62;                              /* strip caption       */
      var stripTop = ay + 72;
      var rowH = RTM.pick(w, { s: 16, m: 14, l: 15 });
      var stripBot = stripTop + rowH * MAX_ROUNDS;
      var sAxY = stripBot + 8;
      var H = sAxY + 15 + 14;

      var x = RTM.linear(dom[0], dom[1], m.left, w - m.right);
      st.xScale = x;
      /* The error strip is its own panel with its own zero, fixed at plus or
         minus four sigma so it never rescales between rounds. */
      var xs = RTM.linear(-ERR_MAX, ERR_MAX, m.left, w - m.right);
      var zeroX = xs(0);

      RTM.clear(svg);
      svg.setAttribute("viewBox", "0 0 " + w + " " + H);
      svg.setAttribute("width", "100%");
      svg.style.height = H + "px";
      svg.style.display = "block";

      function laneTop(i) { return m.top + i * laneH; }
      function laneMid(i) { return laneTop(i) + (small ? laneH * 0.72 : laneH * 0.5); }
      /* On a phone the lane label sits at the top of its own lane, which leaves
         room above every mark and almost none below it, so the two lower value
         labels flip to the top. Below, the model's number and the name of the
         zero line were landing on each other. */
      function valY(i) {
        return small ? laneMid(i) - rDot - 8 : laneMid(i) + rDot + fsVal + 1;
      }

      /* zero reference and lane rules, behind everything. The zero rule runs all
         the way down to the axis so the label at its foot reads as a name for
         the line rather than as a fifth lane. */
      RTM.el("line", {
        x1: x(0), x2: x(0), y1: m.top, y2: ay,
        stroke: C.rule, "stroke-width": 1.5
      }, svg);
      LANES.forEach(function (L, i) {
        RTM.el("line", {
          x1: m.left, x2: w - m.right, y1: laneMid(i), y2: laneMid(i),
          stroke: C.grid, "stroke-width": 1
        }, svg);
      });

      /* ── shapes. Position carries the number, shape carries the identity,
         colour only ever separates the reader's own mark from the evidence. */
      function drawParent(px, py, r, op) {
        RTM.el("circle", { cx: px, cy: py, r: r, fill: C.outlier, opacity: op }, svg);
      }
      /* The reader's mark is a dot like every other mark in the scene, not a
         black nail. While the guess is live it carries a soft grip ring, the
         same affordance the engine scene uses for its draggable father. */
      function drawGuess(px, py, r, op, strong) {
        if (strong) {
          RTM.el("circle", { cx: px, cy: py, r: r * 2, fill: C.guess, "fill-opacity": 0.13 }, svg);
        }
        RTM.el("circle", {
          cx: px, cy: py, r: r, fill: C.guess, stroke: C.paper,
          "stroke-width": 1.5, opacity: op
        }, svg);
      }
      function drawChild(px, py, r, op) {
        RTM.el("circle", {
          cx: px, cy: py, r: r + 1.5, fill: C.paper, stroke: C.mean,
          "stroke-width": 2, opacity: op
        }, svg);
        RTM.el("circle", { cx: px, cy: py, r: Math.max(1, r - 2), fill: C.mean, opacity: op }, svg);
      }
      function drawModel(px, py, r, op) {
        RTM.el("rect", {
          x: px - r, y: py - r, width: r * 2, height: r * 2,
          fill: "none", stroke: C.muted, "stroke-width": 2, opacity: op,
          transform: "rotate(45 " + px + " " + py + ")"
        }, svg);
      }
      function pull(x1, y1, x2, y2, col, op) {
        RTM.el("line", {
          x1: x1, y1: y1, x2: x2, y2: y2, stroke: col,
          "stroke-width": 1, "stroke-dasharray": "2 4", opacity: op
        }, svg);
      }

      /* value labels are clamped so no glyph can escape the frame */
      function label(px, py, text, fill, weight, size) {
        var sz = size || fsVal;
        var lo2 = m.left + 2, hi2 = w - m.right - 2;
        var anchor = px > hi2 - 46 ? "end" : px < lo2 + 46 ? "start" : "middle";
        RTM.txt(svg, {
          x: RTM.clamp(px, lo2, hi2), y: py, "text-anchor": anchor, fill: fill,
          "font-family": C.mono, "font-size": sz, "font-weight": weight || 600
        }, text, true);
      }
      /* A judged placement wears its badge on its own mark, the way every other
         judged placement in this piece does. */
      function badge(px, py, text, col) {
        var wBox = text.length * fsMicro * 0.72 + 10;
        var side = px + 14 + wBox < w - m.right ? 1 : -1;
        var bx = side > 0 ? px + 12 : px - 12 - wBox;
        RTM.el("rect", {
          x: bx, y: py - fsMicro * 0.85, width: wBox, height: fsMicro * 1.7,
          rx: 2, fill: col, "fill-opacity": 0.12
        }, svg);
        RTM.txt(svg, {
          x: bx + wBox / 2, y: py + fsMicro * 0.36, "text-anchor": "middle", fill: col,
          "font-family": C.sans, "font-size": fsMicro, "font-weight": 700,
          "letter-spacing": "0.08em"
        }, text, true);
      }

      if (done) {
        /* ── the summary: every round at once, then the four averages ────── */
        var faint = 0.32;
        st.results.forEach(function (r) {
          pull(x(r.pair.parent.z), laneMid(0), x(r.actual), laneMid(2), C.mean, 0.2);
          drawParent(x(r.pair.parent.z), laneMid(0), rDot - 2, faint);
          drawGuess(x(r.guess), laneMid(1), rDot - 2, faint, false);
          drawChild(x(r.actual), laneMid(2), rDot - 2.5, faint);
          drawModel(x(r.model), laneMid(3), rDot - 2, faint);
        });
        var mp = avg(st.results, function (r) { return r.pair.parent.z; });
        var mg = avg(st.results, function (r) { return r.guess; });
        var mc = avg(st.results, function (r) { return r.actual; });
        var mm = avg(st.results, function (r) { return r.model; });
        drawParent(x(mp), laneMid(0), rDot, 1);
        drawGuess(x(mg), laneMid(1), rDot, 1, false);
        drawChild(x(mc), laneMid(2), rDot, 1);
        drawModel(x(mm), laneMid(3), rDot, 1);
        /* the finding, drawn: the gap between the average guess and the
           average child, in the gap between the two lanes it spans. */
        if (Math.abs(x(mg) - x(mc)) > 8) {
          var ruleY = laneMid(1) + laneH * 0.42;
          RTM.el("line", {
            x1: x(mg), x2: x(mc), y1: ruleY, y2: ruleY,
            stroke: C.ink, "stroke-width": 1.5
          }, svg);
          RTM.el("line", {
            x1: x(mc), x2: x(mc), y1: ruleY, y2: laneMid(2) - rDot - 2,
            stroke: C.ink, "stroke-width": 1, "stroke-dasharray": "2 3", opacity: 0.55
          }, svg);
          label((x(mg) + x(mc)) / 2, ruleY - 5,
            (mg > mc ? "you leaned high by " : "you leaned low by ") + mag(mg - mc), C.ink, 500);
        }
        label(x(mp), laneMid(0) - rDot - 8, "average " + sig(mp), C.outlier);
        label(x(mg), laneMid(1) - rDot - 8, "average " + sig(mg), C.guess);
        /* the lower two go below their markers: the rule above them is busy */
        label(x(mc), valY(2), "average " + sig(mc), C.mean);
        label(x(mm), valY(3), "average " + sig(mm), C.muted);
      } else {
        /* ── one round ───────────────────────────────────────────────────── */
        var d = pairs[st.i];
        var pz = d.parent.z;
        var cz = revealed ? RTM.lerp(pz, d.child.z, st.reveal) : null;
        var mz = revealed ? RTM.lerp(pz, slope * pz, st.reveal) : null;
        var res = revealed ? st.results[st.results.length - 1] : null;
        var gz = res ? res.guess : st.guess;
        var gpx = x(gz), gy = laneMid(1);

        /* Rounds already played stay on the board, faintly, so the panel fills
           up as the reader works and the run of errors is visible before the
           summary. Only rounds that have been locked in are drawn. */
        st.results.forEach(function (r, k) {
          if (revealed && k === st.results.length - 1) return;
          drawParent(x(r.pair.parent.z), laneMid(0), rDot - 2.5, 0.28);
          drawGuess(x(r.guess), laneMid(1), rDot - 2.5, 0.28, false);
          drawChild(x(r.actual), laneMid(2), rDot - 3, 0.28);
          drawModel(x(r.model), laneMid(3), rDot - 2.5, 0.28);
        });

        if (!revealed) {
          /* Two lanes that fill in later. Saying so beats leaving them blank,
             and no part of the answer is written into the page. */
          RTM.txt(svg, {
            x: x(0) + 8, y: laneMid(2) + 4, "text-anchor": "start", fill: C.muted,
            "font-family": C.sans, "font-size": fsLane
          }, "hidden until you lock in", true);
          RTM.txt(svg, {
            x: x(0) + 8, y: laneMid(3) + 4, "text-anchor": "start", fill: C.muted,
            "font-family": C.sans, "font-size": fsLane
          }, "so is the model’s answer", true);
        }

        if (revealed) {
          pull(x(pz), laneMid(0), x(cz), laneMid(2), C.mean, 0.5);
          pull(x(pz), laneMid(0), x(mz), laneMid(3), C.muted, 0.45);
          if (Math.abs(gpx - x(cz)) > 6) {
            /* the miss, drawn between the two lanes it spans. The number for it
               lives in the error strip below, once, instead of twice here. */
            var missY = laneMid(1) + (small ? 12 : laneH * 0.42);
            RTM.el("line", {
              x1: gpx, x2: x(cz), y1: missY, y2: missY,
              stroke: C.guess, "stroke-width": 1.5, opacity: 0.8
            }, svg);
            RTM.el("line", {
              x1: gpx, x2: gpx, y1: gy + rDot + 2, y2: missY,
              stroke: C.guess, "stroke-width": 1, "stroke-dasharray": "2 3", opacity: 0.5
            }, svg);
            RTM.el("line", {
              x1: x(cz), x2: x(cz), y1: missY, y2: laneMid(2) - rDot - 2,
              stroke: C.guess, "stroke-width": 1, "stroke-dasharray": "2 3", opacity: 0.5
            }, svg);
          }
          /* an editorial placement gets its range drawn, never a bare dot */
          if (d.child.verified === false && isFinite(d.child.zLow) && isFinite(d.child.zHigh)) {
            var lo3 = x(d.child.zLow), hi3 = x(d.child.zHigh), yb = laneMid(2);
            RTM.el("line", { x1: lo3, x2: hi3, y1: yb, y2: yb, stroke: C.mean, "stroke-width": 6, opacity: 0.22 }, svg);
            RTM.el("line", { x1: lo3, x2: lo3, y1: yb - 8, y2: yb + 8, stroke: C.mean, "stroke-width": 1, opacity: 0.6 }, svg);
            RTM.el("line", { x1: hi3, x2: hi3, y1: yb - 8, y2: yb + 8, stroke: C.mean, "stroke-width": 1, opacity: 0.6 }, svg);
          }
        }

        /* the drag catcher. transparent catches pointer events, none does not */
        var catcher = RTM.el("rect", {
          x: m.left - 12, y: laneTop(1),
          width: Math.max(1, (w - m.right) - m.left + 24), height: laneH,
          fill: "transparent"
        }, svg);
        catcher.style.touchAction = "none";
        catcher.style.cursor = st.phase === "guess" ? "ew-resize" : "default";
        catcher.addEventListener("pointerdown", onDown);

        drawParent(x(pz), laneMid(0), rDot, 1);
        drawGuess(gpx, gy, rDot, 1, st.phase === "guess");
        if (revealed) {
          drawChild(x(cz), laneMid(2), rDot, 1);
          drawModel(x(mz), laneMid(3), rDot, 1);
        }

        label(x(pz), laneMid(0) - rDot - 8, sig(pz), C.outlier);
        label(gpx, gy - rDot - 8, sig(gz), C.guess);
        if (isRubric(d)) badge(x(pz), laneMid(0), "RUBRIC", C.outlier);
        if (revealed) {
          label(x(cz), valY(2), sig(d.child.z), C.mean);
          label(x(mz), valY(3), sig(slope * pz), C.muted);
          /* clear of its own uncertainty band, not printed across it */
          if (d.child.verified === false) {
            badge(x(isFinite(d.child.zHigh) ? Math.max(d.child.zHigh, cz) : cz),
              laneMid(2), "ESTIMATE", C.mean);
          }
        }
      }

      /* ── the shared axis ─────────────────────────────────────────────────── */
      RTM.el("line", { x1: m.left, x2: w - m.right, y1: ay, y2: ay, stroke: C.rule, "stroke-width": 1 }, svg);
      RTM.ticks(dom[0], dom[1], RTM.pick(w, { s: 4, m: 6, l: 8 })).forEach(function (v) {
        if (v < dom[0] - 1e-9 || v > dom[1] + 1e-9) return;
        RTM.el("line", { x1: x(v), x2: x(v), y1: ay, y2: ay + 4, stroke: C.rule, "stroke-width": 1 }, svg);
        RTM.txt(svg, {
          x: RTM.clamp(x(v), m.left + 2, w - m.right - 2), y: ay + 16,
          "text-anchor": "middle", fill: C.muted,
          "font-family": C.sans, "font-size": fs - 1
        }, tickLabel(v), true);
      });
      RTM.txt(svg, {
        x: m.left, y: axLabY, "text-anchor": "start", fill: C.muted,
        "font-family": C.sans, "font-size": fs - 1
      }, "sigma above the mean of each pair’s own population", true);

      /* One annotation, one wording, one position at every width. It used to be
         two texts in two places depending on how wide the page was. */
      RTM.txt(svg, {
        x: x(0) + 5, y: ay - 8, "text-anchor": "start", fill: C.muted,
        "font-family": C.sans, "font-size": fs - 1
      }, "population average", true);

      /* lane labels */
      LANES.forEach(function (L, i) {
        var text = done ? L.many : L.one;
        if (small) {
          RTM.txt(svg, {
            x: m.left, y: laneTop(i) + 13, "text-anchor": "start", fill: C.muted,
            "font-family": C.sans, "font-size": fsLane, "letter-spacing": "0.07em"
          }, text.toUpperCase(), true);
        } else {
          RTM.txt(svg, {
            x: m.left - 18, y: laneMid(i) + 4, "text-anchor": "end", fill: C.muted,
            "font-family": C.sans, "font-size": fsLane
          }, text, true);
        }
      });

      /* ── the error strip ─────────────────────────────────────────────────────
         The whole point of this scene is the DIRECTION of the reader's errors,
         and it used to be a sentence hidden inside a <details>. Five rows, one
         per round, each bar running from a fixed zero. Over-guesses point right
         in the accent colour, under-guesses point left in grey, so a run of
         guessing too high is one shape you cannot miss. */
      RTM.el("line", {
        x1: m.left, x2: w - m.right, y1: divY, y2: divY,
        stroke: C.rule, "stroke-width": 1
      }, svg);
      RTM.txt(svg, {
        x: m.left, y: capY, "text-anchor": "start", fill: C.muted,
        "font-family": C.sans, "font-size": fsLane
      }, "Your miss, round by round", true);

      /* row guides and the zero line */
      var k;
      for (k = 0; k < MAX_ROUNDS; k++) {
        var ry = stripTop + rowH * (k + 0.5);
        RTM.el("line", {
          x1: m.left, x2: w - m.right, y1: ry, y2: ry,
          stroke: C.grid, "stroke-width": 1, "stroke-dasharray": "1 3"
        }, svg);
      }
      RTM.el("line", {
        x1: zeroX, x2: zeroX, y1: stripTop, y2: stripBot,
        stroke: C.rule, "stroke-width": 1.5
      }, svg);

      for (k = 0; k < MAX_ROUNDS; k++) {
        var yk = stripTop + rowH * (k + 0.5);
        var rk = st.results[k];
        if (!rk) {
          /* nothing about an unplayed round, not even its shape */
          RTM.txt(svg, {
            x: zeroX + 7, y: yk + fsMicro * 0.36, "text-anchor": "start", fill: C.muted,
            "font-family": C.mono, "font-size": fsMicro
          }, String(k + 1), true);
          continue;
        }
        var e = rk.bias;                        /* signed: plus is too high */
        var clipped = Math.abs(e) > ERR_MAX;
        var ex = xs(RTM.clamp(e, -ERR_MAX, ERR_MAX));
        var col = e > 0.05 ? C.outlier : C.muted;
        if (Math.abs(ex - zeroX) > 1) {
          RTM.el("line", {
            x1: zeroX, x2: ex, y1: yk, y2: yk, stroke: col,
            "stroke-width": 5, "stroke-linecap": "butt", opacity: 0.9
          }, svg);
        }
        RTM.el("circle", { cx: ex, cy: yk, r: 3.4, fill: col }, svg);
        if (clipped) {
          var dir2 = e > 0 ? 1 : -1;
          RTM.el("path", {
            d: "M " + (ex + dir2 * 5) + " " + (yk - 4) + " L " + (ex + dir2 * 10) + " " + yk +
               " L " + (ex + dir2 * 5) + " " + (yk + 4),
            fill: "none", stroke: col, "stroke-width": 1.5
          }, svg);
        }
        var side2 = e > 0.05 ? 1 : e < -0.05 ? -1 : 1;
        RTM.txt(svg, {
          x: ex + side2 * (clipped ? 14 : 8), y: yk + fsMicro * 0.36,
          "text-anchor": side2 > 0 ? "start" : "end", fill: C.muted,
          "font-family": C.mono, "font-size": fsMicro
        }, String(k + 1), true);
      }

      /* the strip's own scale, so a bar length is a number */
      RTM.el("line", {
        x1: m.left, x2: w - m.right, y1: sAxY, y2: sAxY,
        stroke: C.rule, "stroke-width": 1
      }, svg);
      [
        { v: -ERR_MAX, t: ERR_MAX + "σ too low", a: "start", wide: false },
        { v: -ERR_MAX / 2, t: ERR_MAX / 2 + "σ", a: "middle", wide: true },
        { v: 0, t: "spot on", a: "middle", wide: false },
        { v: ERR_MAX / 2, t: ERR_MAX / 2 + "σ", a: "middle", wide: true },
        { v: ERR_MAX, t: ERR_MAX + "σ too high", a: "end", wide: false }
      ].forEach(function (t) {
        RTM.el("line", {
          x1: xs(t.v), x2: xs(t.v), y1: sAxY, y2: sAxY + 4,
          stroke: C.rule, "stroke-width": 1
        }, svg);
        /* the two inner labels are dropped on a phone, where the end labels
           would otherwise run into them */
        if (t.wide && small) return;
        RTM.txt(svg, {
          x: xs(t.v), y: sAxY + 15, "text-anchor": t.a, fill: C.muted,
          "font-family": C.sans, "font-size": fsMicro
        }, t.t, true);
      });

      RTM.hoist(svg);
    }

    /* ── scene contract ──────────────────────────────────────────────────── */
    function draw(w) {
      st.w = Math.max(260, Math.round(w || RTM.widthOf(mount) || 640));
      render();
    }
    function destroy() {
      destroyed = true;
      onUp();
      if (anim) { anim.cancel(); anim = null; }
    }

    buildTable();
    if (n) {
      setGuessSilent(startFor(0));
      status.textContent = "Round 1 of " + n + ". " + promptLine(pairs[0]);
    }

    return { draw: draw, destroy: destroy };
  });
})();
