/* ============================================================================
   SCENE 0 · hero  ·  the whole argument, stated in a single still frame.

   WHAT WAS WRONG, AND WHAT REPLACED IT
   ------------------------------------
   The previous hero put Bill Gates at +5.8σ (a wealth rank), John Adams at
   +5.0σ (an office rubric) and LeBron James at +3.7σ (points per game) on one
   axis, then INVENTED each child at r × parent, where r was the parent to
   child correlation FOR HEIGHT, and said so in the caption. A height
   correlation applied to a fortune and to a rank on a ladder. In a piece whose
   method makes a virtue of naming the reference population for every mark, the
   front door did the one thing the method forbids.

   There is no model in this scene now. Both ends of every pair are published
   numbers read from RTM.data.DYNASTIES, each pair carries the ruler it was
   measured with, and this file never reads a correlation at all. Nothing is
   multiplied by anything.

   WHO THE HERO NAMES
   ------------------
   Three pairs, every one of the six people a published number, sorted by how
   far out the parent sits:

     churchill  +5.0 → +2.6   highest office reached. The top of the ladder,
                              and a long fall that still leaves the son far
                              outside the crowd. Closer to the middle is not
                              the same as at the middle.
     barry      +3.0 → +0.1   career points per game. A fall that lands on the
                              average of the same population, measured the
                              same way, by the same rule.
     curry      +0.6 → +3.3   career points per game again, running the other
                              way. Regression is toward the mean, not
                              downward, and a parent sitting near the mean has
                              nothing to hand back.

   Two rulers between them rather than three, so two of the three lanes are
   directly comparable. No judged placements, so no ESTIMATE badge is needed:
   every number on the picture is a measurement.

   THE COMPOSITION
   ---------------
   One drawing at every width, because the horizontal one measured as a clean
   bell and the vertical one measured as a top truncated kite. Sigma runs
   across. The crowd is a one sided bell of dots standing on the axis. The
   three pairs hang below the axis, one lane each, so a child is always
   directly under the part of the crowd it landed in, and a parent is always
   on the same line as its own child. The arrow between them steps down when
   the child came back toward the middle and steps up when it did not, so the
   geometry says which happened before any label is read.

   The scene measures the title block inside `.hero` and draws in the largest
   rectangle the type does not occupy. On a short screen, where the only clear
   rectangle is a shallow strip over the title, the whole drawing turns over:
   axis, lanes and note in the strip, crowd hanging below it behind the
   headline. Mixed mode: the crowd is canvas, because
   a few thousand SVG nodes behind a headline is a jank machine; everything
   that carries a label is SVG, so it stays crisp and follows a theme flip.

   Nothing about the argument moves. Motion is one spark that runs each
   connector in turn, so the first frame, every frame, and the
   prefers-reduced-motion still are the same composition.

   Seeded, because the same load must give the same picture every time.
   ========================================================================== */
(function () {
  "use strict";

  var C = RTM;

  var SEED = 20260728;

  /* The editorial choice above, as ids into DYNASTIES. Ids, not values: if the
     research changes a number the picture follows it. */
  var PICKS = ["churchill", "barry", "curry"];

  var ZMIN = -3.5;      /* left end of the crowd                             */
  var ZPAD = 0.5;       /* axis headroom past the furthest mark              */

  var STAGGER = 1.05;   /* seconds between one spark and the next            */
  var TRAVEL = 1.90;    /* seconds for a spark to run its connector          */
  var REST = 3.60;      /* seconds of stillness before the sweep repeats      */

  var RM = 5.5;         /* radius of a parent or child mark                  */

  function tok(name, fb) { var v = C.css(name); return v ? v : fb; }
  function f1(v) { return (Math.round(v * 10) / 10).toString(); }
  function half(v) { return Math.round(v * 2) / 2; }

  RTM.scene("hero", function (mount) {

    /* ── DOM ─────────────────────────────────────────────────────────────── */
    var wrap = C.h("div", { class: "chart" }, mount);
    wrap.style.position = "relative";

    var canvas = C.h("canvas", { "aria-hidden": "true" }, wrap);
    canvas.style.display = "block";

    /* The annotation layer, laid exactly over the canvas. Decoration to a
       screen reader: the prose alternative below says the same thing in
       sentences, and this is the same information as pictures. */
    var svg = C.el("svg", { "aria-hidden": "true", focusable: "false" }, wrap);
    svg.style.position = "absolute";
    svg.style.left = "0";
    svg.style.top = "0";
    svg.style.display = "block";
    svg.style.pointerEvents = "none";

    /* The note is pinned directly under the axis, tight to the thing it
       describes. On a phone the headline sits below this drawing, and a caption
       floating halfway between the two reads as a standfirst. */
    var note = C.h("p", { class: "fig-note" }, wrap);
    note.style.position = "absolute";
    note.style.margin = "0";
    note.style.padding = "0";
    note.style.border = "0";
    note.style.maxWidth = "none";
    note.style.pointerEvents = "none";
    var badge = C.h("span", { class: "badge", text: "Simulated crowd" }, note);
    var noteText = document.createTextNode(" ");
    note.appendChild(noteText);

    var alt = C.h("p", { class: "sr-only" }, mount);

    /* A detached context, only ever used to measure text. Measuring on the live
       one would mean the draw path and the layout path fight over ctx.font. */
    var gauge = document.createElement("canvas").getContext("2d");

    /* ── State ───────────────────────────────────────────────────────────── */
    var ctx = null, field = null, W = 0, H = 0;
    var band = null, T = null, level = 2;
    var za = null, amp = 0, baseY = 0, axisL = 0, axisR = 0, axisLen = 0;
    var dirY = 1;         /* +1 crowd above the axis, lanes below. -1 flips it
                             when the only clear strip is a shallow one over the
                             title: see the short viewport note in chooseBand. */
    var zMax = 5.5, colW = 0, lanesTop = 0, laneStep = 0;
    var dots = [], drift = [], lanes = [], nDots = 0, nTail = 0, nTarget = 0;
    var lastNoteH = 0;
    var clock = 0, cycle = 10;
    var fs = {}, font = {};
    var stopTick = null, stopResize = null, io = null, onScreen = true;

    /* ── Small helpers ───────────────────────────────────────────────────── */
    function hw(z) { return amp * Math.exp(-0.5 * z * z); }
    function measW(text, f) { gauge.font = f; return gauge.measureText(text).width; }

    function wrapLines(text, maxW, f, maxLines) {
      var words = String(text).split(" "), out = [], line = "";
      for (var i = 0; i < words.length; i++) {
        var next = line ? line + " " + words[i] : words[i];
        if (line && measW(next, f) > maxW) { out.push(line); line = words[i]; }
        else line = next;
      }
      if (line) out.push(line);
      if (maxLines && out.length > maxLines) out = out.slice(0, maxLines);
      return out;
    }

    function nWord(n) {
      return n === 1 ? "one" : n === 2 ? "two" : n === 3 ? "three" : String(n);
    }
    function cap1(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
    function listOf(a) {
      if (!a.length) return "";
      if (a.length === 1) return a[0];
      return a.slice(0, -1).join(", ") + " and " + a[a.length - 1];
    }

    /* ── The pairs ───────────────────────────────────────────────────────────
       By id, then filtered on the same rule that chose them, so a change in the
       research can only remove a pair, never smuggle in an unverified one. If
       the data ever loses one, the gap is refilled by that rule rather than by
       a hardcoded substitute. */
    function pickPairs() {
      var D = (RTM.data && RTM.data.DYNASTIES) || [];
      var i, byId = {};
      function usable(d) {
        return !!d && !!d.parent && !!d.child &&
          typeof d.parent.z === "number" && isFinite(d.parent.z) &&
          typeof d.child.z === "number" && isFinite(d.child.z) &&
          d.parent.verified === true && d.child.verified === true;
      }
      for (i = 0; i < D.length; i++) if (D[i] && D[i].id) byId[D[i].id] = D[i];

      var out = [], taken = {};
      for (i = 0; i < PICKS.length; i++) {
        var d = byId[PICKS[i]];
        if (usable(d) && !taken[d.id]) { taken[d.id] = 1; out.push(d); }
      }
      if (out.length < 3) {
        var pool = D.filter(function (x) { return usable(x) && !taken[x.id]; });
        pool.sort(function (a, b) {
          return Math.abs(b.parent.z - b.child.z) - Math.abs(a.parent.z - a.child.z);
        });
        for (i = 0; i < pool.length && out.length < 3; i++) { taken[pool[i].id] = 1; out.push(pool[i]); }
        /* Never leave the hero arguing that reversion only ever runs downward. */
        var hasRise = out.some(function (x) { return Math.abs(x.child.z) > Math.abs(x.parent.z); });
        if (!hasRise) {
          var rises = D.filter(function (x) {
            return usable(x) && Math.abs(x.child.z) > Math.abs(x.parent.z);
          }).sort(function (a, b) {
            return (Math.abs(b.child.z) - Math.abs(b.parent.z)) - (Math.abs(a.child.z) - Math.abs(a.parent.z));
          });
          if (rises.length && out.length) out[out.length - 1] = rises[0];
        }
      }
      out.sort(function (a, b) { return Math.abs(b.parent.z) - Math.abs(a.parent.z); });

      return out.map(function (d) {
        var toward = Math.abs(d.child.z) < Math.abs(d.parent.z);
        return {
          id: d.id,
          family: d.family || (d.parent.name || "").split(" ").pop(),
          ruler: String(d.metric || "").toLowerCase(),
          basis: d.basis || "",
          pz: d.parent.z, cz: d.child.z,
          pFull: d.parent.name || "", cFull: d.child.name || "",
          pStat: d.parent.stat || "", cStat: d.child.stat || "",
          toward: toward,
          move: Math.abs(d.child.z - d.parent.z)
        };
      });
    }

    /* "Winston Churchill" beside a row labelled CHURCHILL is a word of wasted
       width. Strip the family name the row already carries. */
    function given(full, family) {
      var f = String(full || ""), fam = String(family || "");
      if (fam && f.length > fam.length && f.slice(-fam.length) === fam) {
        var g = f.slice(0, f.length - fam.length).replace(/[\s,]+$/, "");
        if (g) return g;
      }
      return f;
    }

    /* ── Where the type is ───────────────────────────────────────────────────
       Read only, and never assumed. If the shell changes, or this scene is
       mounted somewhere with no title beside it, the band falls back to the
       whole box and the composition still holds. */
    function typeRect() {
      var host = mount.parentNode;
      if (!host || !host.children) return null;
      var found = null, i, n;
      for (i = 0; i < host.children.length; i++) {
        n = host.children[i];
        if (n === mount || !n.classList) continue;
        if (n.classList.contains("col-full")) continue;
        if (n.classList.contains("col") || n.classList.contains("hero-inner")) { found = n; break; }
      }
      if (!found) return null;
      var a = mount.getBoundingClientRect(), b = found.getBoundingClientRect();
      if (!b.width || !b.height) return null;
      return { l: b.left - a.left, t: b.top - a.top, r: b.right - a.left, b: b.bottom - a.top };
    }

    /* Largest rectangle the type does not sit in. The drawing is horizontal at
       every width now, so the score is the area a horizontal drawing can
       actually use: past about three quarters of its width in height, a bell
       and three lanes are just air. */
    function chooseBand() {
      var m = C.clamp(W * 0.03, 16, 40);
      var g = C.clamp(W * 0.024, 20, 36);
      /* The gap under a drawing that sits above the headline is wider than the
         page gutter, or the note reads as the standfirst. */
      var gUnder = Math.max(g, 38);
      var cands = [];
      if (T) {
        cands.push({ k: "right", x: T.r + g, y: m, w: (W - m) - (T.r + g), h: H - 2 * m });
        cands.push({ k: "left", x: m, y: m, w: (T.l - g) - m, h: H - 2 * m });
        cands.push({ k: "above", x: m, y: m, w: W - 2 * m, h: (T.t - gUnder) - m, above: true });
      } else {
        cands.push({ k: "all", x: m, y: m, w: W - 2 * m, h: H - 2 * m });
      }
      var best = null;
      cands.forEach(function (c) {
        if (c.w < 300 || c.h < 200) return;
        /* A wide shallow strip is not a usable band. At 1080 x 900 the gap over
           the title measured 1016 x 226, which buys a bell 72px tall and 590px
           across: a smear, not a distribution. Below about a third of its own
           width, the strip is refused and the drawing turns over instead. */
        if (c.above && c.h < c.w * 0.30) return;
        c.score = c.w * Math.min(c.h, c.w * 0.75);
        if (!best || c.score > best.score) best = c;
      });
      if (best) return best;

      /* ── the short viewport ────────────────────────────────────────────────
         Around 900 to 1088 px wide the title is a centred 544 px column, so
         both side margins are too narrow to draw in; and on a short screen
         (1024 x 768, say) the title is tall enough to leave only ~180 px of
         clear strip above it. Nothing normal fits.

         So the drawing turns over: the sigma axis, its ticks, the three lanes
         and the note all live in that clear strip, and the crowd hangs BELOW
         the axis, behind the headline, which is where the hero's paper coloured
         text halo was designed to put it in the first place. Same drawing, same
         data, read the other way up. */
      if (T && T.t > 120) {
        /* Every pixel of the strip is a pixel of argument, and the air above it
           is doing nothing, so the top margin is the one that gives way. */
        var yTop = Math.round(m * 0.55);
        return { k: "flip", flip: true, x: m, y: yTop,
                 w: Math.max(W - 2 * m, 240),
                 h: Math.max(T.t - yTop - 26, 80),
                 deep: Math.max(H - T.t - 10, 90) };
      }
      return { k: "all", x: m, y: m, w: Math.max(W - 2 * m, 240), h: Math.max(H - 2 * m, 170) };
    }

    /* ── Layout ──────────────────────────────────────────────────────────────
       A pure function of (W, H) and the measured type block. Called on mount,
       on every debounced resize, and after a theme flip. */
    function layout() {
      T = typeRect();
      band = chooseBand();

      var sans = tok("--sans", "system-ui, sans-serif");
      var mono = tok("--mono", "ui-monospace, monospace");

      /* Three densities, not one drawing scaled three ways. The flipped case is
         always the sparsest: three lanes in a shallow strip is worth more than
         two lanes with everybody's given name on them. */
      dirY = band.flip ? -1 : 1;
      level = band.flip ? 0 : band.w >= 660 ? 2 : band.w >= 430 ? 1 : 0;

      fs.name = half(C.clamp(band.w * 0.0195, 11.5, 14.5));
      fs.fam = fs.name;
      fs.sig = half(C.clamp(band.w * 0.017, 10, 12.5));
      fs.tick = half(C.clamp(band.w * 0.015, 9.5, 11.5));
      fs.micro = half(C.clamp(band.w * 0.0145, 9.5, 11));

      font.name = "620 " + fs.name + "px " + sans;
      font.fam = "620 " + fs.fam + "px " + sans;
      font.sig = fs.sig + "px " + mono;
      font.tick = fs.tick + "px " + mono;
      font.micro = fs.micro + "px " + mono;
      font.italic = "italic " + fs.micro + "px " + sans;

      var all = pickPairs();
      var maxN = Math.min(3, all.length);
      var noteGap = 13;

      note.style.left = band.x + "px";
      note.style.width = Math.round(band.w) + "px";
      note.style.bottom = "auto";
      note.style.top = "0px";
      /* Before anything is measured: a note left hidden by the previous draw
         measures 0 and would silently cost this one a lane. */
      note.style.display = "";

      /* ── how much of the drawing fits, and at what density ───────────────
         Lanes first, detail second. A third pair is the difference between a
         picture that shows reversion running both ways and one that argues only
         for falls, so it outranks anybody's given name: at 800 x 900 the width
         asked for the full density, three lanes of it did not fit, and the old
         single pass answered by dropping to ONE pair rather than by dropping to
         a sparser row. Now the search runs pairs outermost. */
      function laneStepFor(lv) {
        return lv === 2 ? Math.round(fs.sig + fs.micro + 46)
             : lv === 1 ? Math.round(fs.sig + 44) : Math.round(fs.sig + 16);
      }
      function crownFor(lv) { return lv >= 1 ? fs.micro + 11 : 7; }
      function ticksFor(lv) { return 8 + fs.tick + (lv >= 1 ? fs.micro + 7 : 4); }

      /* Horizontal metrics: the left column names the row, the right gutter
         holds the outward label on whichever mark sits furthest out. */
      function metricsFor(lv, list) {
        var famW = 0, padR = 14;
        list.forEach(function (o) { famW = Math.max(famW, measW(o.family, font.fam)); });
        var cw = lv === 2
          ? Math.round(Math.max(famW + 10, C.clamp(band.w * 0.135, 92, 138)))
          : Math.round(famW + 12);
        list.forEach(function (o) {
          var outerZ = Math.max(o.pz, o.cz);
          var lab = lv >= 1 ? given(o.pz >= o.cz ? o.pFull : o.cFull, o.family) : C.sigma(outerZ, 1);
          padR = Math.max(padR, measW(lab, lv >= 1 ? font.name : font.sig) + 16,
                          measW(C.sigma(outerZ, 1), font.sig) / 2 + 10);
        });
        var aL = Math.round(band.x + cw + 14);
        var aR = Math.round(band.x + band.w - padR);
        var zTop = 3.6;
        list.forEach(function (o) { zTop = Math.max(zTop, o.pz, o.cz); });
        return { colW: cw, axisL: aL, axisR: aR, axisLen: Math.max(160, aR - aL), zMax: zTop + ZPAD };
      }

      /* One candidate, fully costed. The note's height is part of the budget and
         its copy quotes both the number of pairs and the size of the crowd,
         which the budget decides, so it settles in a few cheap passes. */
      /* Which pairs survive when not all three fit. Never all falls: the second
         slot goes to the pair that went the other way, because a hero that only
         ever shows children coming back down argues something the piece spends a
         section denying. */
      function subset(k) {
        if (k >= all.length) return all.slice();
        if (k <= 1) return [all[0]];
        var out = [all[0]];
        var rise = null, i;
        for (i = 0; i < all.length; i++) if (!all[i].toward) { rise = all[i]; break; }
        if (rise && rise !== all[0]) out.push(rise);
        for (i = 1; i < all.length && out.length < k; i++) {
          if (out.indexOf(all[i]) < 0) out.push(all[i]);
        }
        out = out.slice(0, k);
        out.sort(function (a, b) { return Math.abs(b.pz) - Math.abs(a.pz); });
        return out;
      }

      function plan(lv, k) {
        var list = subset(k);
        var m = metricsFor(lv, list);
        var step = laneStepFor(lv), crown = crownFor(lv), ticks = ticksFor(lv);
        var res = null;
        /* Three note treatments, tried in order: the full one, a terse one, and
           none at all. On a 375 x 667 screen the strip over the title is 93px,
           which is one lane plus an axis: the full note is four lines of small
           print, and clamping it to the top of the band printed it straight
           through the row labels. Small print is what gives way there, not the
           argument. With no note the crowd still carries its own "simulated"
           label on the drawing, and the text alternative carries all of it. */
        [0, 1, 2].forEach(function (mode) {
          if (res && res.ok) return;
          var hide = mode === 2;
          var nh = hide ? 0 : (lastNoteH || (lv >= 2 ? 62 : lv === 1 ? 56 : 44));
          var gap = hide ? 0 : noteGap;
          var chromeM = function (h) { return crown + ticks + k * step + gap + h; };
          var a = 0, tgt = 0, copy = "", pass;
          for (pass = 0; pass < (hide ? 1 : 4); pass++) {
            a = band.flip
              ? Math.round(Math.min(band.deep, m.axisLen * 0.34))
              : Math.round(Math.min(band.h - chromeM(nh) - 4, m.axisLen * 0.44));
            tgt = crowdSize(Math.max(a, 40), m);
            copy = noteCopy(list, tgt, lv, mode >= 1);
            noteText.nodeValue = copy;
            badge.textContent = "Simulated crowd";
            if (hide) break;
            var got = note.offsetHeight || nh;
            if (Math.abs(got - nh) < 1) { nh = got; break; }
            nh = got;
          }
          res = {
            lv: lv, k: k, list: list, m: m, step: step, crown: crown, ticks: ticks,
            hide: hide, gap: gap,
            noteH: nh, amp: a, target: tgt, copy: copy,
            /* The floor on the bell is an aspect ratio, not a pixel count: what
               matters is that it still reads as a distribution next to its own
               width. A 202px axis is happy with 52px of height; a 625px one is
               not. */
            ok: (band.flip ? chromeM(nh) <= band.h
                           : a >= C.clamp(m.axisLen * 0.22, 52, 76))
          };
        });
        return res;
      }

      var wanted = band.flip ? 0 : band.w >= 660 ? 2 : band.w >= 430 ? 1 : 0;
      var chosen = null, k, lv;
      for (k = maxN; k >= 1 && !chosen; k--) {
        for (lv = wanted; lv >= 0; lv--) {
          var cand = plan(lv, k);
          if (cand.ok) { chosen = cand; break; }
        }
      }
      /* Nothing fits cleanly: draw the sparsest single pair rather than nothing */
      if (!chosen) chosen = plan(0, Math.max(1, Math.min(maxN, 1)));

      level = chosen.lv;
      lanes = chosen.list;
      laneStep = chosen.step;
      colW = chosen.m.colW;
      axisL = chosen.m.axisL;
      axisR = chosen.m.axisR;
      axisLen = chosen.m.axisLen;
      zMax = chosen.m.zMax;
      za = C.linear(ZMIN, zMax, axisL, axisR);
      amp = Math.max(60, chosen.amp);
      nTarget = chosen.target;
      var n = lanes.length;
      var crownH = chosen.crown, ticksH = chosen.ticks, noteH = chosen.noteH;
      var noteHide = !!chosen.hide;
      noteGap = chosen.gap;
      noteText.nodeValue = chosen.copy;
      badge.textContent = "Simulated crowd";
      lastNoteH = noteH;

      if (band.flip) {
        baseY = Math.round(band.y + band.h);
        lanesTop = baseY - ticksH - n * laneStep;
        var noteTop = lanesTop - crownH - noteGap - noteH;
        note.style.top = Math.round(Math.max(band.y, noteTop)) + "px";
        if (noteHide || noteTop < band.y - 2) note.style.display = "none";
      } else {
        var total = crownH + amp + ticksH + n * laneStep + noteGap + noteH;
        var lo = band.y, hi = band.y + Math.max(0, band.h - total);
        /* One horizontal datum across the hero: a side band starts where the
           type starts. Otherwise the air goes above rather than below, so the
           drawing stays clear of the headline underneath it. */
        var top = hi <= lo ? lo
          : (T && !band.above) ? C.clamp(T.t, lo, hi)
          : lo + Math.round((hi - lo) * (band.above ? 0.10 : 0.40));
        baseY = Math.round(top + crownH + amp);
        lanesTop = baseY + ticksH;
        note.style.top = Math.round(lanesTop + n * laneStep + noteGap) + "px";
        if (noteHide) note.style.display = "none";
      }

      buildCrowd(nTarget);
      /* The note prints the size of the crowd, so it prints what was actually
         drawn, not what was asked for. */
      if (nDots !== nTarget) noteText.nodeValue = noteCopy(lanes, nDots, level);
      bakeField();
      buildOverlay(sans, mono);
      writeAlt();

      cycle = lanes.length * STAGGER + TRAVEL + REST;
    }

    /* ── copy ────────────────────────────────────────────────────────────────
       Every sentence here is about what the reader is looking at, and the
       number in it is derived. */
    function rulerSentence(list) {
      var groups = [], i, j, g;
      for (i = 0; i < list.length; i++) {
        g = null;
        for (j = 0; j < groups.length; j++) if (groups[j].m === list[i].ruler) g = groups[j];
        if (!g) { g = { m: list[i].ruler, fams: [] }; groups.push(g); }
        if (g.fams.indexOf(list[i].family) < 0) g.fams.push(list[i].family);
      }
      return groups.map(function (x) { return listOf(x.fams) + " on " + x.m; }).join("; ") + ".";
    }

    function noteCopy(list, count, lv, terse) {
      var n = list.length;
      var level = lv === undefined ? 2 : lv;
      var pairWord = nWord(n) + " real " + (n === 1 ? "pair" : "pairs");
      if (terse) {
        return n === 1
          ? " One real pair, a fall like most of them: filled parent, hollow child."
          : " " + cap1(pairWord) + ": filled parent, hollow child.";
      }
      /* The badge already says the crowd is simulated, and the crowd carries its
         own size wherever that label is drawn, so neither is said twice. */
      var head = (level >= 1 || dirY < 0)
        ? " Each dot is one person."
        : " " + C.num(count) + " people, one dot each.";
      if (n === 1) {
        /* One lane can show one direction, so it says which one it is. */
        return head + " Then one real pair, which came back toward the middle the way most " +
               "do: filled parent, hollow child. " + rulerSentence(list);
      }
      if (level >= 2) {
        return head + " The " + nWord(n) + " pairs are real: the filled dot is the parent, " +
               "the hollow one the child, and each is measured against its own population, " +
               "named beside it. Nothing here is modelled.";
      }
      if (level === 1) {
        return head + " The " + nWord(n) + " pairs are real, filled dot the parent and hollow " +
               "the child: " + rulerSentence(list) + " Nothing here is modelled.";
      }
      /* Naming the ruler is the piece's own rule and the reason this scene was
         rebuilt, so it is the last thing to go: only under about 330px, where it
         would be a fourth line of small print and a fourth line costs a pair,
         does it fall back to the text alternative alone. */
      return head + " Then " + pairWord + ": filled parent, hollow child." +
             (band.w >= 330 ? " " + rulerSentence(list) : "");
    }

    /* ── The crowd ───────────────────────────────────────────────────────────
       Rejection sampling under the bell gives z a normal distribution; a
       uniform offset up the half width available at that z then fills the
       shape evenly, so the dots per vertical strip are proportional to the
       density, which is what makes the silhouette honest as well as familiar.

       One sided, standing on the axis. The mirrored version of this drawing
       measured as a top truncated kite: two Gaussian flanks reflected about a
       line have almost no curvature left in them at this aspect, and the eye
       reads the result as a diamond. */
    function crowdSize(a, m) {
      var len = m ? m.axisLen : axisLen, top = m ? m.zMax : zMax;
      var areaPx = a * 2.5066 * (len / (top - ZMIN));
      /* Rounded, because the note prints the figure and "1,500 people" has to
         be exactly what is drawn. */
      return Math.round(C.clamp(areaPx / 14, 700, 2600) / 100) * 100;
    }

    function buildCrowd(target) {
      var rnd = C.rng(SEED);
      dots = [];
      nTail = 0;
      var guard = 0;
      while (dots.length < target && guard < target * 16) {
        guard++;
        var z = rnd.range(ZMIN, -ZMIN);
        if (rnd() > Math.exp(-0.5 * z * z)) continue;
        if (z > 3) nTail++;
        dots.push({
          z: z,
          f: rnd(),
          a: 0.30 + 0.24 * rnd(),
          ph: rnd() * Math.PI * 2,
          sp: rnd.range(0.09, 0.20)
        });
      }
      nDots = dots.length;

      /* A small live subset keeps the field breathing without costing a few
         thousand arc() calls a frame. Everything else is baked once. */
      drift = [];
      var every = Math.max(9, Math.round(nDots / 140));
      for (var i = 0; i < dots.length; i += every) { dots[i].live = 1; drift.push(dots[i]); }
    }

    function dotR() { return band.w < 430 ? 1.35 : 1.55; }

    function bakeField() {
      field = document.createElement("canvas");
      var fx = C.fitCanvas(field, W, H);
      var r = dotR();
      fx.fillStyle = tok("--ink-2", "#474E55");
      for (var i = 0; i < dots.length; i++) {
        var d = dots[i];
        if (d.live) continue;
        var x = za(d.z), y = baseY - dirY * d.f * hw(d.z);
        fx.globalAlpha = d.a;
        fx.beginPath();
        fx.moveTo(x + r, y);
        fx.arc(x, y, r, 0, Math.PI * 2);
        fx.fill();
      }
      fx.globalAlpha = 1;
    }

    /* ── The annotation layer ────────────────────────────────────────────────
       Rules and marks go in first, every label goes through RTM.txt, and
       hoist() puts the label group last, so a rule can never be painted across
       a name. */
    function buildOverlay(sans, mono) {
      C.clear(svg);
      svg.setAttribute("viewBox", "0 0 " + W + " " + H);
      svg.setAttribute("width", W);
      svg.setAttribute("height", H);
      svg.style.width = W + "px";
      svg.style.height = H + "px";

      var ink2 = tok("--ink-2", "#474E55");
      var ink3 = tok("--ink-3", "#5D646C");
      var outC = tok("--outlier", "#A83612");
      var meanC = tok("--mean", "#1E5F6E");
      var ruleC = tok("--rule", "#CFC8B8");
      var paper = tok("--paper", "#F4F1EA");

      var gRule = C.el("g", {}, svg);
      var gLink = C.el("g", {}, svg);
      var gMark = C.el("g", {}, svg);

      var x0 = za(0), x3 = za(3);
      var lastLaneY = lanesTop + Math.max(lanes.length, 1) * laneStep - laneStep * 0.42;

      /* ── lane geometry, measured before anything is drawn, because the
            guide rules have to stop short of the labels ─────────────────── */
      lanes.forEach(function (o, i) {
        var yc = lanesTop + i * laneStep + laneStep * 0.42;
        var dir = o.toward ? 1 : -1;      /* the child steps down when it came
                                             back toward the middle           */
        o.yc = yc;
        o.px = za(o.pz); o.py = yc - 4.5 * dir;
        o.cx = za(o.cz); o.cy = yc + 4.5 * dir;

        o.pLab = level >= 1 ? given(o.pFull, o.family) : "";
        o.cLab = level >= 1 ? given(o.cFull, o.family) : "";
        o.pSig = C.sigma(o.pz, 1);
        o.cSig = C.sigma(o.cz, 1);

        /* Every label sits on the far side of its own mark, away from the
           arrow, so nothing prints along the connector. */
        var pOut = o.px >= o.cx ? 1 : -1;
        o.pOut = pOut; o.cOut = -pOut;
        o.leftEdge = Math.min(o.px, o.cx);
        var leftLab = level >= 1
          ? (pOut < 0 ? o.pLab : o.cLab)
          : (pOut < 0 ? o.pSig : o.cSig);
        var leftW = measW(leftLab, level >= 1 ? font.name : font.sig);
        o.guideEnd = o.leftEdge - RM - 6 - (leftLab ? leftW + 8 : 0);
      });

      /* ── the crowd's silhouette, traced once ───────────────────────────── */
      var d = "", z, first = true;
      for (z = ZMIN; z <= -ZMIN + 0.001; z += 0.05) {
        d += (first ? "M " : " L ") + f1(za(z)) + " " + f1(baseY - dirY * hw(z));
        first = false;
      }
      C.el("path", {
        d: d, fill: "none", stroke: ink3, "stroke-width": 1, opacity: 0.34,
        "data-role": "bell"
      }, gRule);

      /* ── the axis ──────────────────────────────────────────────────────── */
      C.el("line", {
        x1: axisL, y1: baseY, x2: axisR, y2: baseY,
        stroke: ruleC, "stroke-width": 1, "data-role": "axis"
      }, gRule);

      var tickLo = Math.ceil(ZMIN), tickHi = Math.floor(zMax);
      var tickStep = level >= 1 ? 1 : 3;
      var tickY = baseY + dirY * 5;
      var tickTextY = dirY > 0 ? tickY + fs.tick + 2 : tickY - 4;
      for (z = 0; z >= tickLo; z -= tickStep) drawTick(z);
      for (z = tickStep; z <= tickHi; z += tickStep) drawTick(z);
      if (level < 1 && tickHi >= 4 && (tickHi % tickStep) !== 0) drawTick(tickHi);

      function drawTick(zv) {
        var x = za(zv);
        C.el("line", {
          x1: f1(x), y1: baseY, x2: f1(x), y2: f1(tickY),
          stroke: ruleC, "stroke-width": 1, "data-z": zv
        }, gRule);
        /* zero is already named AVERAGE, at the far end of its own rule */
        if (zv === 0) return;
        C.txt(svg, {
          x: f1(x), y: f1(tickTextY), "text-anchor": "middle", fill: ink3,
          "font-family": mono, "font-size": fs.tick
        }, (zv > 0 ? "+" : "−") + Math.abs(zv), true);
      }

      if (level >= 1) {
        C.txt(svg, {
          x: axisL, y: f1(tickTextY + dirY * (fs.micro + 6)), "text-anchor": "start", fill: ink3,
          "font-family": mono, "font-size": fs.micro, "letter-spacing": "0.06em"
        }, "standard deviations from average", true);
      }

      /* ── the average: one vertical rule, used by every mark on the page ──
         It runs from the far end of the crowd to the far end of the lanes, so
         every child's distance from the middle is a distance to this rule and
         nothing dangles past the data. */
      var bellFar = baseY - dirY * (amp + 4);
      var laneFar = dirY > 0 ? lastLaneY + laneStep * 0.30 : lanesTop - 4;
      var laneNear = dirY > 0 ? lanesTop : lanesTop + Math.max(lanes.length, 1) * laneStep;
      var meanTop = Math.min(bellFar, laneFar), meanBot = Math.max(bellFar, laneFar);
      /* Two segments, with the gap over the tick labels. One rule running the
         whole way struck through the words "standard deviations from average". */
      [[bellFar, baseY], [laneNear, laneFar]].forEach(function (seg) {
        C.el("line", {
          x1: f1(x0), y1: f1(Math.min(seg[0], seg[1])), x2: f1(x0), y2: f1(Math.max(seg[0], seg[1])),
          stroke: meanC, "stroke-width": 1.3, "stroke-dasharray": "3 5", opacity: 0.92
        }, gRule);
      });
      C.txt(svg, {
        x: f1(x0), y: f1(meanTop - 6), "text-anchor": "middle", fill: meanC,
        "font-family": mono, "font-size": Math.max(10.5, fs.micro),
        "letter-spacing": "0.12em"
      }, "AVERAGE", true);

      /* ── one calibration mark, so the scale means something ───────────────
         It ends at the crowd rather than running off into the margin, and the
         rarity it claims is countable: the dots past it are drawn, and the
         note prints how many people the crowd stands for. */
      /* nTail is the guard, not decoration: the old hero annotated this line
         "one in 740 gets this far" over a crowd where nobody did. The claim is
         only made when the drawing can be checked against it. */
      if (zMax > 3.3 && level >= 1 && dirY > 0 && nTail > 0) {
        var r3top = baseY - Math.round(amp * 0.62);
        C.el("line", {
          x1: f1(x3), y1: baseY, x2: f1(x3), y2: r3top,
          stroke: ink3, "stroke-width": 1, "stroke-dasharray": "3 5", opacity: 0.75
        }, gRule);
        C.txt(svg, {
          x: f1(x3 + 7), y: r3top + fs.micro * 0.4, "text-anchor": "start", fill: ink3,
          "font-family": mono, "font-size": fs.micro, "letter-spacing": "0.1em"
        }, "+3σ", true);
        if (level >= 2) {
          C.txt(svg, {
            x: f1(x3 + 7), y: r3top + fs.micro * 1.5 + 6, "text-anchor": "start", fill: ink3,
            "font-family": sans, "font-size": fs.micro
          }, C.oneIn(1 - C.Phi(3)) + " people", true);
        }
      }

      /* ── what the crowd is, said on the crowd ────────────────────────────
         Flipped, the crowd is the thing behind the headline, so it carries the
         label whatever the density level. */
      if (level >= 1 || dirY < 0) {
        var cLabX = za(ZMIN + 0.06);
        /* Flipped, this label sits beside the title rather than under the crowd,
           so the room it has is real and the copy is chosen to fit it. */
        var room = (dirY < 0 && T ? T.l - 12 : band.x + band.w) - cLabX;
        var forms = [
          C.num(nDots) + " simulated people, one dot each",
          C.num(nDots) + " simulated people",
          C.num(nDots) + " simulated"
        ];
        var pickLab = forms[forms.length - 1];
        for (var fi = 0; fi < forms.length; fi++) {
          if (measW(forms[fi], font.italic) <= room) { pickLab = forms[fi]; break; }
        }
        C.txt(svg, {
          x: f1(cLabX), y: f1(baseY - dirY * amp * 0.80), "text-anchor": "start",
          fill: ink3, "font-family": sans, "font-size": fs.micro, "font-style": "italic"
        }, pickLab, true);
      }

      /* ── the lanes ─────────────────────────────────────────────────────── */
      lanes.forEach(function (o) {
        /* the row's own hairline, from its name to its marks */
        if (o.guideEnd > band.x + colW + 10) {
          C.el("line", {
            x1: f1(band.x + colW + 4), y1: f1(o.yc), x2: f1(o.guideEnd), y2: f1(o.yc),
            stroke: ruleC, "stroke-width": 1, "stroke-dasharray": "1 4", opacity: 0.8
          }, gRule);
        }

        var sgn = o.cx >= o.px ? 1 : -1;
        var sx = o.px + sgn * (RM + 3);
        var ex = o.cx - sgn * (RM + 8);
        var n = {};
        n.path = C.el("path", {
          d: "M " + f1(sx) + " " + f1(o.py) +
             " C " + f1(sx + (ex - sx) * 0.45) + " " + f1(o.py) +
             " " + f1(sx + (ex - sx) * 0.62) + " " + f1(o.cy) +
             " " + f1(ex) + " " + f1(o.cy),
          fill: "none", stroke: outC, "stroke-width": 1.6,
          "stroke-linecap": "round", opacity: 0.8
        }, gLink);

        var tip = o.cx - sgn * (RM + 1.5);
        C.el("polygon", {
          points: f1(tip) + "," + f1(o.cy) + " " +
                  f1(tip - sgn * 7) + "," + f1(o.cy - 3.6) + " " +
                  f1(tip - sgn * 7) + "," + f1(o.cy + 3.6),
          fill: outC, opacity: 0.9
        }, gLink);

        /* Marks carry a paper ring so they read against the crowd above and
           against the row rule they sit on. */
        C.el("circle", {
          cx: f1(o.px), cy: f1(o.py), r: RM, fill: outC,
          stroke: paper, "stroke-width": 1.8
        }, gMark);
        C.el("circle", {
          cx: f1(o.cx), cy: f1(o.cy), r: RM, fill: paper,
          stroke: outC, "stroke-width": 2.2
        }, gMark);
        n.spark = C.el("circle", {
          cx: f1(o.px), cy: f1(o.py), r: 3.2, fill: outC, opacity: 0
        }, gMark);
        o.n = n;
      });

      /* ── labels ─────────────────────────────────────────────────────────── */
      lanes.forEach(function (o, i) {
        /* the row's name, and the ruler it was measured with */
        C.txt(svg, {
          x: band.x, y: f1(o.yc + fs.fam * 0.36), "text-anchor": "start", fill: ink2,
          "font-family": sans, "font-size": fs.fam, "font-weight": 620
        }, o.family, true);
        if (level >= 2) {
          C.txtBlock(svg, band.x, o.yc + fs.fam * 0.36 + fs.micro + 6, "start",
            wrapLines(o.ruler, colW - 8, font.micro, 2).map(function (t) {
              return { text: t, size: fs.micro, fill: ink3, family: mono, dy: fs.micro + 3 };
            }), true);
        }

        /* names outward from each mark, on the mark's own line */
        if (level >= 1) {
          outward(o.pLab, o.px, o.py, o.pOut, font.name, fs.name, 620, outC, sans);
          outward(o.cLab, o.cx, o.cy, o.cOut, font.name, fs.name, 620, outC, sans);
        } else {
          outward(o.pSig, o.px, o.py, o.pOut, font.sig, fs.sig, 400, outC, mono);
          outward(o.cSig, o.cx, o.cy, o.cOut, font.sig, fs.sig, 400, ink3, mono);
        }

        /* one sigma row per lane, under the lower mark */
        if (level >= 1) {
          var sy = o.yc + 4.5 + 9 + fs.sig;
          sigLabel(o.pSig, o.px, sy, o.pOut, outC);
          sigLabel(o.cSig, o.cx, sy, o.cOut, ink3);
        }

        /* and, once there is room for it, how far the child moved */
        if (level >= 2) {
          C.txt(svg, {
            x: f1((o.px + o.cx) / 2), y: f1(o.yc - 4.5 - 9), "text-anchor": "middle", fill: ink3,
            "font-family": mono, "font-size": fs.micro
          }, C.num(o.move, 1) + "σ " + (o.toward ? "back" : "further out"), true);
        }
      });

      function outward(text, x, y, out, f, size, weight, fill, family) {
        if (!text) return;
        var w = measW(text, f);
        var anchor = out > 0 ? "start" : "end";
        var tx = x + out * (RM + 6);
        /* a label that would run off its own end of the drawing flips inward */
        if (out < 0 && tx - w < band.x + colW + 6) { anchor = "start"; tx = x + RM + 6; }
        if (out > 0 && tx + w > band.x + band.w) { anchor = "end"; tx = x - RM - 6; }
        C.txt(svg, {
          x: f1(tx), y: f1(y + size * 0.36), "text-anchor": anchor, fill: fill,
          "font-family": family, "font-size": size, "font-weight": weight
        }, text, true);
      }

      /* Centred under its mark, unless that would straddle the average rule or
         the +3σ rule, in which case it steps aside. A haloed glyph over a
         dashed rule is legible, and still looks like a mistake.

         It steps INWARD, under the connector, because the outward side already
         carries the name: stepping outward printed "+0.1σ" into the bottom of
         "Brent" at two widths in both themes. */
      function sigLabel(text, x, y, out, fill) {
        var w = measW(text, font.sig);
        var anchor = "middle", tx = x;
        [x0, x3].forEach(function (rx) {
          if (Math.abs(rx - tx) < w / 2 + 3) { anchor = out > 0 ? "end" : "start"; tx = x - out * 7; }
        });
        C.txt(svg, {
          x: f1(tx), y: f1(y), "text-anchor": anchor, fill: fill,
          "font-family": mono, "font-size": fs.sig
        }, text, true);
      }

      C.hoist(svg);
    }

    function writeAlt() {
      var bits = lanes.map(function (o) {
        return o.pFull + ", " + C.sigma(o.pz, 1) + " on " + o.ruler + " (" + o.pStat + "), " +
               "and " + o.cFull + ", " + C.sigma(o.cz, 1) + " (" + o.cStat + ")";
      });
      var falls = lanes.filter(function (o) { return o.toward; }).length;
      var rises = lanes.length - falls;
      var pops = [];
      lanes.forEach(function (o) { if (o.basis && pops.indexOf(o.basis) < 0) pops.push(o.basis); });
      function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
      alt.textContent =
        "The opening picture. A bell of " + C.num(nDots) + " dots stands for a simulated " +
        "population, laid out on a scale of standard deviations from its own average. " +
        (dirY > 0 ? "Below the scale, " : "Above the scale, ") + nWord(lanes.length) +
        " real parent and child " + (lanes.length === 1 ? "pair" : "pairs") +
        ", each measured against its own population: " + bits.join("; ") + ". " +
        (falls ? cap(nWord(falls)) + " of the " + nWord(lanes.length) + " " +
                 (falls === 1 ? "children" : "children") + " landed closer to the average than " +
                 "the parent did. " : "") +
        (rises === 1 ? "The other started close to the average, where there is nothing to hand " +
                       "back, and went further out than the parent. "
                     : rises > 1 ? cap(nWord(rises)) + " went further out than the parent. " : "") +
        "Every one of these numbers is a measurement. Nothing on the picture is modelled. " +
        "The reference populations are: " + pops.join(" ");
    }

    /* ── Frame ───────────────────────────────────────────────────────────────
       Only the crowd's live subset and the sparks move. Everything that states
       the argument is already on the page and stays there. */
    function frame() {
      if (!ctx) return;
      ctx.clearRect(0, 0, W, H);
      if (field) ctx.drawImage(field, 0, 0, W, H);

      var r = dotR();
      ctx.fillStyle = tok("--ink-2", "#474E55");
      for (var i = 0; i < drift.length; i++) {
        var d = drift[i];
        var x = za(d.z), y = baseY - dirY * d.f * hw(d.z);
        var dx = Math.sin(clock * d.sp + d.ph) * 1.05;
        var dy = Math.cos(clock * d.sp * 0.78 + d.ph) * 0.85;
        ctx.globalAlpha = d.a;
        ctx.beginPath();
        ctx.moveTo(x + dx + r, y + dy);
        ctx.arc(x + dx, y + dy, r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      var t = clock % cycle;
      for (var k = 0; k < lanes.length; k++) {
        var o = lanes[k], n = o.n;
        if (!n || !n.spark) continue;
        var u = (t - k * STAGGER) / TRAVEL;
        if (u <= 0 || u >= 1 || !n.len) { n.spark.setAttribute("opacity", 0); continue; }
        var pt = null;
        try { pt = n.path.getPointAtLength(n.len * u); } catch (e) { pt = null; }
        if (!pt) { n.spark.setAttribute("opacity", 0); continue; }
        n.spark.setAttribute("cx", pt.x.toFixed(1));
        n.spark.setAttribute("cy", pt.y.toFixed(1));
        n.spark.setAttribute("opacity", (Math.sin(Math.PI * u) * 0.95).toFixed(3));
      }
    }

    /* ── Ticker ──────────────────────────────────────────────────────────── */
    function running() { return onScreen && !C.reducedMotion(); }
    function sync() {
      if (running() && !stopTick) {
        stopTick = C.onTick(function (dt) { clock += dt; frame(); });
      } else if (!running() && stopTick) {
        stopTick(); stopTick = null;
      }
    }

    /* ── Sizing ──────────────────────────────────────────────────────────────
       The mount may be a full bleed band with its own height, or an empty div
       that takes its height from us. Collapse the canvas for one measurement
       to tell the two apart. */
    function measure() {
      var prevC = canvas.style.height, prevS = svg.style.height;
      canvas.style.height = "0px";
      svg.style.height = "0px";
      var box = mount.getBoundingClientRect();
      canvas.style.height = prevC;
      svg.style.height = prevS;
      var w = Math.max(280, Math.round(box.width || 800));
      var avail = Math.round(box.height);
      if (avail > 300) return [w, avail];
      var derived = Math.round(C.clamp(w * 0.56, 320, 620));
      var vh = Math.round((window.innerHeight || 720) * 0.78);
      return [w, Math.round(C.clamp(Math.min(derived, vh), 300, 900))];
    }

    function draw() {
      var wh = measure();
      W = wh[0]; H = wh[1];
      ctx = C.fitCanvas(canvas, W, H);
      layout();
      /* the connector lengths need the paths to be in the document */
      lanes.forEach(function (o) {
        if (!o.n || !o.n.path) return;
        try { o.n.len = o.n.path.getTotalLength(); } catch (e) { o.n.len = 0; }
      });
      clock = 0;
      frame();
      sync();
    }

    /* ── Wiring ──────────────────────────────────────────────────────────── */
    stopResize = C.onResize(mount, function () { draw(); });

    if (typeof IntersectionObserver === "function") {
      io = new IntersectionObserver(function (es) {
        onScreen = es[0].isIntersecting;
        sync();
      }, { rootMargin: "80px" });
      io.observe(mount);
    }

    return {
      draw: function () { draw(); },
      destroy: function () {
        if (stopTick) { stopTick(); stopTick = null; }
        if (stopResize) stopResize();
        if (io) io.disconnect();
        /* Remove only what this scene built. The shell owns other children of
           this mount, the title among them. */
        [wrap, alt].forEach(function (n) {
          if (n && n.parentNode) n.parentNode.removeChild(n);
        });
      }
    };
  });
})();
