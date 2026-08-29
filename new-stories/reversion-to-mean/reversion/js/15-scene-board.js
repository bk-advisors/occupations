/* ============================================================================
   SCENE · board  ·  a real Galton board, run as physics rather than drawn.

   Galton built the quincunx to show exactly this, which is why it belongs in
   this piece. The first drop sends balls through a peg field and lets a bell
   curve build itself out of nothing but gravity and luck. The second keeps only
   the balls that finished in the far right bin, releases their children, and
   measures how much of the parents' edge survives.

   Canvas draws the balls (600 of them would kill an SVG). SVG draws every label,
   axis and annotation on top, because canvas cannot be made accessible and text
   in canvas cannot be measured for collisions.

   Every number in the annotations is measured off the simulation. Nothing here
   is typed in by hand.

   ROWS: 7, NOT 12. Twelve rows of pegs took 510px of a 740px figure and left the
   pile, which is the whole payoff, with 170px. Seven rows halves the peg field
   and hands the height to the pile and to the annotation. Four or five rows
   would be better still for proportion, and they were measured: at five rows the
   pile came out 1.27 bins per sigma against a binomial ideal of 1.12 WITH A HOLE
   IN THE MIDDLE BIN, because a five row triangle is too short for the continuous
   deflection to average out. Seven rows keeps a real bell.

   PEG RADIUS STAYS ABOVE BALL RADIUS. Making the pegs smaller than the balls was
   measured too, and it breaks the machine: at rp = 0.115 of the spacing against
   rb = 0.13, only 122 of 220 balls ever reached a bin, because a ball straddles
   two small pegs and wedges. The peg field's weight is cut by having 28 pegs
   instead of 78, not by shrinking them below the thing they are meant to deflect.

   ITERATIONS: 4, NOT 2. Eight bins hold a deeper pile than thirteen do, and two
   solver iterations cannot hold seventeen layers: positional correction leaves
   penetration at the bottom, the wake rule reads it as a fresh collision every
   step, and 88 balls shiver in the bottom of two bins forever without ever being
   counted. Four iterations settle the same pile in 2,600 steps.
   ========================================================================== */
RTM.scene("board", function (mount) {
  "use strict";

  var D = RTM, M = RTM.motion;
  var TAU = Math.PI * 2;

  /* ── colour, with fallbacks so this still draws before the token sheet
        lands or if a token is renamed ─────────────────────────────────────── */
  function C(name, fb) {
    var v = "";
    try { v = D.css(name); } catch (e) { v = ""; }
    return v || fb;
  }
  function ink()    { return C("--ink", "#1d1b19"); }
  function paper()  { return C("--paper", "#faf7f2"); }
  function muted()  { return C("--muted", "#7d7873"); }
  function rule()   { return C("--rule", C("--grid", "#d9d3c9")); }
  function accent() { return C("--accent", "#b4462f"); }
  function sans()   { return C("--sans", "system-ui, sans-serif"); }
  function mono()   { return C("--mono", "ui-monospace, monospace"); }

  /* Optional texture module, written by another agent. Never assume it. */
  function texture(ctx, w, h) {
    var T = RTM.tex;
    if (!T) return;
    try {
      if (typeof T.grain === "function") T.grain(ctx, w, h);
      else if (typeof T.paper === "function") T.paper(ctx, w, h);
      else if (typeof T.noise === "function") T.noise(ctx, w, h);
    } catch (e) { /* texture is decoration; never let it break the chart */ }
  }

  var HERIT = 0.45;
  try {
    if (RTM.data && RTM.data.HEIGHT && typeof RTM.data.HEIGHT.r === "number") {
      HERIT = RTM.data.HEIGHT.r;
    }
  } catch (e) { /* keep the default */ }

  /* ── DOM ─────────────────────────────────────────────────────────────────── */
  var head    = D.h("div", { class: "fig-head" }, mount);
  var elTitle = D.h("p", { class: "fig-title" }, head);
  var elSub   = D.h("p", { class: "fig-sub" }, head);

  var ctrls = D.h("div", { class: "ctrl-row" }, mount);
  var seg   = D.h("div", { class: "seg", role: "group", "aria-label": "Choose which drop to watch" }, ctrls);
  var segA  = D.h("button", { class: "seg-btn", type: "button", "aria-pressed": "true",
                              text: "1. The machine" }, seg);
  var segB  = D.h("button", { class: "seg-btn", type: "button", "aria-pressed": "false",
                              text: "2. Their children" }, seg);
  /* A plain button, not .btn-primary. In dark mode the accented fill turned this
     into the loudest thing in the scene, brighter than the balls it starts. */
  var btnPlay  = D.h("button", { class: "btn", type: "button", text: "Play" }, ctrls);
  var btnReset = D.h("button", { class: "btn", type: "button", text: "Reset" }, ctrls);
  var readout  = D.h("span", { class: "readout", "aria-live": "polite", text: "" }, ctrls);

  var chart = D.h("div", { class: "chart" }, mount);
  chart.style.position = "relative";
  var canvas = D.h("canvas", { "aria-hidden": "true" }, chart);
  canvas.style.display = "block";
  var svg = D.el("svg", { "aria-hidden": "true", overflow: "visible" }, chart);
  svg.style.position = "absolute";
  svg.style.left = "0";
  svg.style.top = "0";
  svg.style.pointerEvents = "none";

  var alt  = D.h("p", { class: "sr-only" }, mount);
  var note = D.h("p", { class: "fig-note" }, mount);
  var tbl  = D.h("details", { class: "tbl-wrap" }, mount);
  D.h("summary", { text: "Final bin counts, both drops" }, tbl);
  var tblBody = D.h("div", {}, tbl);

  /* ── state ───────────────────────────────────────────────────────────────── */
  var L = null, ctx = null;
  var act = 1, phase = "run";
  var A1 = null, A2 = null;
  var stopTick = null, wantPlay = false, visible = true;
  var frame = 0, lastReadout = -1, holdSteps = 0, readoutAt = 0;
  var hasSettled = false;   /* the run has been taken to its end at least once */
  var io = null, stopResize = null;

  /* Height of the tallest column, in balls. Sizing the bin field is not a
     cosmetic question: if the pile grows past the top of the bins, a late ball
     arches across the mouth, the bin below it never fills, and the run finishes
     with balls it cannot count.

     The textbook figure for the middle bin of an n row board is
     sqrt(2 / (pi n)) of everything, and it is WRONG HERE BY A THIRD: this board
     spreads about 1.7 bins per sigma against the binomial 1.3, because a
     bouncing ball can be knocked further than half a spacing. A flatter bell has
     a shorter peak. The measured share is 0.217 to 0.227 of the run across three
     widths, so 0.24 is the conservative figure and it is used instead of the
     theory it disagrees with. */
  function peakColumn(rows, n) {
    return n * 0.24;
  }
  /* The children are a different problem. They are released off to one side, so
     they pile into two or three bins rather than eight, and their tallest column
     takes a third of them where the first drop's takes a fifth. Measured across
     three widths: 0.33, 0.31, 0.28. The bin field has to hold whichever pile is
     taller, or the second view is the one that overflows. */
  function peakKidColumn(n) {
    return n * 0.34;
  }

  /* ── layout, chosen from the measured width ──────────────────────────────── */
  function layout(w) {
    /* One row count at every width. The bell, the sigma in bins and the
       selection rule are then the same picture everywhere, and only the scale
       changes. See the header for why it is seven. */
    var rows  = 7;
    var bins  = rows + 1;
    var padX  = D.pick(w, { s: 8, m: 14, l: 18 });
    var boardW = Math.min(w - padX * 2, D.pick(w, { s: 334, m: 520, l: 592 }));
    var sx = boardW / bins;
    var cx = w / 2;
    var x0 = cx - boardW / 2, x1 = cx + boardW / 2;
    /* These ratios are not decoration. The peg radius, the ball radius and the
       row spacing together decide whether a ball actually moves half a spacing
       per row, which is the whole mechanism. A ball has to fall through the
       gap between two pegs and meet the peg half a spacing along on the row
       below. Pull the pegs in or push the rows apart and it stops being a
       bell. Ball radius is the one number with room in it: smaller balls stack
       more per layer, so the pile is shorter and reads as a heap rather than
       as a column.                                                          */
    var sy = sx * 0.58;
    var rp = sx * 0.19, rb = sx * 0.115;
    var N = D.pick(w, { s: 170, m: 210, l: 240 });
    /* The band above the board carries the annotation that holds the finding.
       It used to be whatever was left over after the pegs, about 60px, which is
       why the one sentence a reader needs was the smallest thing on screen. */
    /* Sized for the tallest thing that has to fit in it, which is the second
       view's annotation: two lines at desktop, three at phone because the same
       sentences need breaking to fit 353px. A band chosen to look right and then
       filled with text is a band that clips text. */
    var headH = D.pick(w, { s: 104, m: 82, l: 86 });
    var dropY = headH + rb * 0.6;
    var pegTop = dropY + sy * 0.9 + rp;
    var pegBot = pegTop + (rows - 1) * sy;
    var binTop = pegBot + sy * 0.6;
    /* Derived, not picked: how tall the middle column will actually stand.
       Balls nest, so a layer costs a little less than a full diameter, and the
       1.95 is measured off the finished piles rather than assumed (they settle
       looser than the 1.76 this used to use, which is exactly how the pile came
       to stand proud of its own bin at one width). The 1.10 is the clearance at
       the mouth: about three ball diameters, which is what stops a late ball
       arching across the top of a full bin. */
    var kidsCap = D.pick(w, { s: 110, m: 140, l: 160 });
    var perLayer = Math.max(2, (sx * 0.93) / (rb * 2));
    var tallest = Math.max(peakColumn(rows, N), peakKidColumn(kidsCap));
    var binH = Math.max(
      D.pick(w, { s: 130, m: 200, l: 250 }),
      Math.ceil(1.10 * ((tallest / perLayer) * (rb * 1.95) + rb * 2))
    );
    var floorY = binTop + binH;
    /* The sigma axis gets a band of its own, clear of the bin floor. Balls
       rest with their underside on the floor line, so anything drawn within a
       ball's radius of it is drawn under the pile. */
    var fs = D.pick(w, { s: 10, m: 11, l: 12 });
    var axisGap = Math.max(12, rb * 1.4);
    var axisY = floorY + axisGap;
    var axisH = axisGap + 7 + fs + 8;

    return {
      w: w, h: Math.round(floorY + axisH + 6),
      rows: rows, bins: bins, sx: sx, sy: sy, cx: cx, x0: x0, x1: x1,
      rb: rb, rp: rp, headH: headH, dropY: dropY,
      pegTop: pegTop, pegBot: pegBot, binTop: binTop, floorY: floorY,
      axisY: axisY, axisH: axisH,
      /* Anything asleep below this line is in a bin. Anything above it is
         still on a peg, and is not a result. */
      binLine: pegBot + sy * 0.5,
      N: N,
      kidsCap: kidsCap,
      spawnEvery: 5,
      fs: fs,
      fsBig: D.pick(w, { s: 12, m: 13, l: 14 })
    };
  }

  function binIndex(x) {
    var k = Math.floor((x - L.x0) / L.sx);
    return k < 0 ? 0 : k > L.bins - 1 ? L.bins - 1 : k;
  }
  function binCentre(k) { return L.x0 + (k + 0.5) * L.sx; }

  /* ── worlds ──────────────────────────────────────────────────────────────── */
  function baseOpts(seed, onStep) {
    return {
      gravity: L.sx * 22,
      damping: 1.5,
      restitution: 0.2,
      friction: 0.3,
      /* Four, not two. See the header: eight bins make a seventeen layer pile,
         and two iterations leave enough penetration at the bottom of it that
         the wake rule keeps a third of the balls shivering forever. */
      iterations: 4,
      sleepSpeed: L.sx * 0.16,
      sleepFrames: 24,
      wakeSpeed: L.sx * 0.30,
      contactDamp: 0.5,
      pegNudge: L.sx * 0.30,
      nudgeCone: 0.6,
      /* Nothing rests until it is past the last row of pegs. A ball that dozes
         off while queued above the first peg takes the whole queue with it and
         the run reports itself finished with balls hanging in mid air. The
         line sits just under the bottom peg row rather than at the top of the
         bins, so a pile that stands a little proud of its bin is still allowed
         to settle instead of shivering forever and never being counted. */
      sleepMinY: L.binLine,
      bounds: { x0: L.x0, y0: -4000, x1: L.x1, y1: L.floorY },
      seed: seed,
      onStep: onStep
    };
  }

  /* A ball can come to rest in the peg field: balanced where two pegs meet, or
     leaning on a neighbour that never moved. On a real board you tap the
     frame. Here the tap is a seeded sideways flick, applied only to a ball
     that is still above the bins and has genuinely stopped moving. Without it
     the run ends with a handful of balls that were dropped but never counted,
     and the two numbers on screen stop agreeing.

     It now runs THROUGHOUT the drop rather than only after the last ball is
     released. One wedged ball early on backs the whole queue up behind it, and
     at seven rows the field is short enough that the queue reaches the release
     point: measured, that cost 53 of 240 balls at one width and nothing at
     another, which is a picture that changes with the viewport for no reason a
     reader could ever see.

     The threshold is a fifth of what it was. A flick given to a ball that is
     merely slow is a flick that biases the walk; only a ball under 0.15 of a
     spacing per second is actually stuck. */
  function tapStuck(A) {
    var ps = A.world.particles, r = A.world.rand;
    for (var i = 0; i < ps.length; i++) {
      var p = ps[i];
      if (p.sleeping || p.y > L.binLine) continue;
      if (Math.abs(p.vx) + Math.abs(p.vy) < L.sx * 0.15) {
        p.vx += (r() - 0.5) * 2 * L.sx * 1.4;
        p.vy += L.sx * 0.8;
      }
    }
  }

  function addBins(w) {
    for (var k = 1; k < L.bins; k++) {
      var x = L.x0 + k * L.sx;
      w.addSegment(x, L.binTop, x, L.floorY, L.sx * 0.035);
    }
  }

  /* Act 1: the classic triangular quincunx. One peg at the top, one more on
     every row down, so the ball makes exactly `rows` left or right decisions. */
  function buildWorld1() {
    var w = RTM.physics.world(baseOpts(20260727, function (i) {
      /* Tap first, then release. The order fixes the sequence of draws from the
         world's rng, which is what makes the run reproducible. */
      if (i % 60 === 0) tapStuck(A1);
      if (A1.spawned < L.N && i >= A1.next) {
        spawnBall(A1, L.cx, { act: 1 });
        A1.next = i + L.spawnEvery;
      }
    }));
    for (var i = 0; i < L.rows; i++) {
      for (var j = 0; j <= i; j++) {
        w.addPeg(L.cx + (j - i / 2) * L.sx, L.pegTop + i * L.sy, L.rp);
      }
    }
    addBins(w);
    return w;
  }

  /* Act 2: the same field, but full width, so a child released off to the right
     still gets the same number of bounces as one released in the middle. A
     triangle would quietly give the outliers fewer chances to come back. */
  function buildWorld2() {
    var w = RTM.physics.world(baseOpts(90210, function (i) {
      if (i % 60 === 0) tapStuck(A2);
      if (A2.spawned < A2.queue.length && i >= A2.next) {
        var rx = A2.queue[A2.spawned];
        spawnBall(A2, rx, { act: 2 });
        A2.next = i + L.spawnEvery;
      }
    }));
    for (var i = 0; i < L.rows; i++) {
      var off = (i % 2) ? L.sx / 2 : 0;
      for (var x = L.x0 + off; x <= L.x1 + 0.5; x += L.sx) {
        w.addPeg(x, L.pegTop + i * L.sy, L.rp);
      }
    }
    addBins(w);
    return w;
  }

  function spawnBall(A, releaseX, data) {
    var r = A.world.rand;
    /* A tenth of a spacing, not a third. At seven rows the release scatter is no
       longer small next to the walk itself, and a wide release smears the shape
       the pegs are supposed to produce. */
    var x = releaseX + r.range(-0.10, 0.10) * L.sx;
    if (x < L.x0 + L.rb * 1.5) x = L.x0 + L.rb * 1.5;
    if (x > L.x1 - L.rb * 1.5) x = L.x1 - L.rb * 1.5;
    data.release = releaseX;
    A.world.addParticle({
      x: x, y: L.dropY, r: L.rb,
      vx: r.range(-0.06, 0.06) * L.sx, vy: L.sx * 2, data: data
    });
    A.spawned++;
  }

  function newAct(kind) {
    var A = { world: null, spawned: 0, next: 0, done: false, queue: [],
              counts: null, mu: 0, sd: 1, stats: null, graceAt: undefined };
    if (kind === 1) { A1 = A; A.world = buildWorld1(); }
    else { A2 = A; A.world = buildWorld2(); }
    return A;
  }

  /* ── measurement ───────────────────────────────────────────────────────────
     Only balls that are asleep in a bin are evidence. A ball still rattling
     through the pegs has no final position yet, and a ball hung up on a peg is
     an artefact rather than a result.                                        */
  function landed(A) {
    var out = [], ps = A.world.particles;
    for (var i = 0; i < ps.length; i++) {
      if (ps[i].sleeping && ps[i].y > L.binLine) out.push(ps[i]);
    }
    return out;
  }

  /* The solver skips a sleeping particle when it walks the walls and the
     floor, but not when it resolves ball against ball. So a ball that fell
     asleep before the one above it landed gets pushed straight through the
     floor line by positional correction, and ends up sitting on the axis
     labels. Putting the sleepers back inside the box every step is cheap, and
     it is the difference between a pile and a spill. */
  function keepInside(A) {
    if (!A || !A.world) return;
    var ps = A.world.particles;
    for (var i = 0; i < ps.length; i++) {
      var p = ps[i];
      if (!p.sleeping) continue;
      var maxY = L.floorY - p.r;
      if (p.y > maxY) p.y = maxY;
      if (p.x < L.x0 + p.r) p.x = L.x0 + p.r;
      else if (p.x > L.x1 - p.r) p.x = L.x1 - p.r;
    }
  }

  /* Resting contacts, tidied, once, when the act is over.
     A soft constraint solver always leaves overlap at the bottom of a loaded
     stack. In motion nobody sees it. In a still picture the pile reads as a
     scatter of half merged discs rather than as stacked balls, which is the
     one thing this scene has to look like.
     This is a relaxation, not a re-simulation: a ball is never moved out of
     the bin it landed in, so every count, every mean and every sigma is still
     the number the physics produced.                                        */
  function relaxPile(A) {
    if (!A || !A.world) return;
    var ps = A.world.particles, i, j, k, pass;
    var lists = [], wall = L.sx * 0.035;
    for (k = 0; k < L.bins; k++) lists.push([]);
    for (i = 0; i < ps.length; i++) {
      if (ps[i].sleeping && ps[i].y > L.binLine) lists[binIndex(ps[i].x)].push(ps[i]);
    }
    /* Two phases. The first has a little gravity in it, so the heap compacts
       downward and closes its holes instead of puffing up. The second is pure
       separation, which is what actually removes the overlap: pushing apart a
       stack fourteen balls deep propagates one contact per pass, so this needs
       far more passes than it looks like it should. */
    for (pass = 0; pass < 1400; pass++) {
      var grav = pass < 400 ? 0.05 : 0;
      for (k = 0; k < L.bins; k++) {
        var list = lists[k];
        if (!list.length) continue;
        var lo = L.x0 + k * L.sx + wall, hi = lo + L.sx - wall * 2;
        var a, b, q;
        if (grav) for (i = 0; i < list.length; i++) list[i].y += list[i].r * grav;
        for (i = 0; i < list.length; i++) {
          for (j = i + 1; j < list.length; j++) {
            a = list[i]; b = list[j];
            var dx = b.x - a.x, dy = b.y - a.y, R = a.r + b.r;
            var d2 = dx * dx + dy * dy;
            if (d2 >= R * R) continue;
            var d = Math.sqrt(d2);
            if (d < 1e-6) { dx = (a.id % 2 ? 1 : -1); dy = -1; d = Math.sqrt(2); }
            var push = (R - d) * 0.5, nx = dx / d, ny = dy / d;
            /* Two balls side by side inside a bin cannot both move sideways:
               the bin wall pushes them straight back and the overlap never
               clears. On a real board the crowded one rides up over its
               neighbour, so a near horizontal contact is resolved partly
               upward. Without this the middle bins settle into a permanent
               squash and the pile reads as a smear.                        */
            if (ny < 0.42 && ny > -0.42) {
              ny = dy >= 0 ? 0.42 : -0.42;
              nx = (nx >= 0 ? 1 : -1) * 0.9075;
            }
            a.x -= nx * push; a.y -= ny * push;
            b.x += nx * push; b.y += ny * push;
          }
        }
        for (i = 0; i < list.length; i++) {
          q = list[i];
          if (q.x < lo + q.r) q.x = lo + q.r;
          if (q.x > hi - q.r) q.x = hi - q.r;
          if (q.y > L.floorY - q.r) q.y = L.floorY - q.r;
          q.vx = 0; q.vy = 0;
        }
      }
    }
  }

  function settledStats(A) {
    if (!A) return null;
    var ps = landed(A), xs = [];
    for (var i = 0; i < ps.length; i++) xs.push(ps[i].x);
    if (xs.length < 2) return null;
    var mu = D.mean(xs), sd = D.sd(xs);
    return { n: xs.length, mu: mu, sd: sd > 0 ? sd : L.sx };
  }

  function binCounts(A) {
    var out = [], i, ps = landed(A);
    for (i = 0; i < L.bins; i++) out.push(0);
    for (i = 0; i < ps.length; i++) out[binIndex(ps[i].x)]++;
    return out;
  }

  /* A single ball can end up wedged where nothing will ever shift it. Waiting
     for a strictly empty awake list would then hang the whole scene, so the
     run is called finished once all but a couple of per cent have landed. */
  function isDone(A, target) {
    if (!A || A.spawned < target) return false;
    if (A.world.settled()) return true;
    if (A.world.steps > 9000) return true;
    var slack = Math.max(1, Math.round(target * 0.03));
    if (A.world.awakeCount() > slack) return false;
    /* Down to the last few. Hold the run open a little longer so the taps can
       bring them home, because every ball that does not reach a bin is a ball
       the readout counts and the caption cannot. */
    if (A.graceAt === undefined) A.graceAt = A.world.steps;
    return A.world.steps - A.graceAt > 300;
  }

  /* The reference sigma for the whole scene is the spread of the act 1 pile.
     Not a theoretical number: the one the reader watched build.               */
  function zOf(x) { return A1 && A1.stats ? (x - A1.stats.mu) / A1.stats.sd : 0; }
  function xOfZ(z) { return A1 && A1.stats ? A1.stats.mu + z * A1.stats.sd : L.cx; }

  function finaliseA1() {
    A1.done = true;
    keepInside(A1);
    relaxPile(A1);
    A1.pileH = null;
    A1.stats = settledStats(A1);
    A1.counts = binCounts(A1);

    /* THE SELECTION. This used to be everything past one sigma, which is a sixth
       of the population, and the prose alongside it promised the far right bin.
       A reader who is told "the freak results" and shown a sixth of everything
       has been sold something.

       It is now the far right bin, literally: bins are taken from the right hand
       wall inward, and the walk stops as soon as the selection has enough balls
       to average. At every width measured that is the last bin on its own (8 to
       14 balls out of 220 to 300), and if a run ever came out thin it takes the
       next bin in and the copy says "the two right hand bins" instead, because
       every sentence in this scene is generated from the count rather than
       typed. */
    var ps = landed(A1), i, k;
    var need = Math.max(6, Math.round(ps.length * 0.02));
    var take = 0, got = 0;
    for (k = L.bins - 1; k >= 0 && take < 3; k--) {
      take++;
      got += A1.counts[k];
      if (got >= need) break;
    }
    var firstBin = L.bins - take;
    var chosen = [];
    for (i = 0; i < ps.length; i++) if (binIndex(ps[i].x) >= firstBin) chosen.push(ps[i]);
    A1.parents = chosen;
    A1.binsTaken = take;
    A1.cutX = L.x0 + firstBin * L.sx;
    A1.cut = zOf(A1.cutX);        /* the sigma the selection starts at */
    var zs = [];
    for (i = 0; i < chosen.length; i++) { chosen[i].data.parent = true; zs.push(zOf(chosen[i].x)); }
    A1.parentZ = zs.length ? D.mean(zs) : 0;
    A1.share = ps.length ? chosen.length / ps.length : 0;
    /* The spread the reader watched build, against the coin flip ideal for this
       many rows. A bouncing ball can be deflected by more than half a spacing
       where a coin flip cannot, so the real board runs a little wider. Printed
       in the note rather than asserted. */
    A1.sdBins = A1.stats ? A1.stats.sd / L.sx : 0;
    A1.idealBins = 0.5 * Math.sqrt(L.rows);
    writeCopy();
    writeTable();
  }

  /* The name of the selection, in plain words, from the count of bins taken. */
  function selectionPhrase() {
    if (!A1 || !A1.binsTaken) return "the far right bin";
    if (A1.binsTaken === 1) return "the far right bin";
    if (A1.binsTaken === 2) return "the two right hand bins";
    return "the " + A1.binsTaken + " right hand bins";
  }

  function prepareA2() {
    if (!A1) newAct(1);
    settleHeadless(A1, 1);        /* a no-op if the first drop already finished */
    newAct(2);
    var parents = A1.parents || [];
    var per = Math.max(1, Math.round(L.kidsCap / Math.max(parents.length, 1)));
    var queue = [];
    for (var i = 0; i < parents.length; i++) {
      for (var k = 0; k < per && queue.length < L.kidsCap; k++) {
        /* The child inherits a share of the parent's distance from the middle.
           Everything the pegs added is luck, and luck is not passed on. */
        queue.push(xOfZ(HERIT * zOf(parents[i].x)));
      }
    }
    A2.queue = queue;
    A2.parentCount = parents.length;
  }

  function finaliseA2() {
    A2.done = true;
    keepInside(A2);
    relaxPile(A2);
    A2.stats = settledStats(A2);
    A2.counts = binCounts(A2);
    var zs = [], ps = landed(A2), i;
    for (i = 0; i < ps.length; i++) zs.push(zOf(ps[i].x));
    A2.childN = zs.length;
    A2.childZ = zs.length ? D.mean(zs) : 0;
    A2.shrink = A1.parentZ > 0 ? 1 - A2.childZ / A1.parentZ : 0;
    /* TWO MEASURED COUNTS, and they matter because the mean does not.
       Every child is released at r times its parent's sigma and the bounces
       average to zero, so the drop from the parents' mean to the children's mean
       is the assumption coming back out of the machine. It is not a result and
       the figure no longer sells it as one.
       What the board actually decides is where each individual child ends up:
       how many make it back out to where their parents were, and how many land
       inside the ordinary crowd. Neither number is in the assumption. */
    A2.backToParents = 0;
    A2.insideCrowd = 0;
    for (i = 0; i < zs.length; i++) {
      if (zs[i] >= A1.cut) A2.backToParents++;
      if (zs[i] < 1) A2.insideCrowd++;
    }
    writeCopy();
    writeTable();
  }

  /* Run a world with no animation at all. Used under prefers-reduced-motion and
     whenever the reader jumps straight to act 2.                              */
  function settleHeadless(A, kind) {
    /* Idempotent, deliberately. Stepping a world that has already finished moves
       every ball a little further and re-relaxes the pile, so calling this twice
       used to give two different sets of numbers for one run: the screenshot
       harness settles the scene, then the interaction harness settles it again,
       and the caption changed between them. A finished run is finished. */
    if (!A || A.done) return;
    var target = kind === 1 ? L.N : A.queue.length;
    var guard = 0;
    while (guard++ < 9000) {
      A.world.stepFixed();
      keepInside(A);
      if (isDone(A, target)) break;
    }
    if (kind === 1) finaliseA1(); else finaliseA2();
  }

  /* ── copy, all numbers measured ────────────────────────────────────────────
     Nothing below types a number. If a run ever comes out flat the sentence
     has to still be true, so the phrasing is chosen from the measurement.   */
  /* One event, one number. The subtitle and the readout both count balls
     dropped, measured off the simulation, so they can never disagree. The
     count of balls that made it into a bin is a different quantity and it is
     named as one, in the note under the chart, where the sigma it feeds is
     explained.                                                              */
  function droppedCount() { return A1 ? A1.spawned : 0; }

  function countedPhrase() {
    if (!A1 || !A1.stats) return "";
    var n = A1.stats.n, missed = A1.spawned - n;
    if (missed <= 0) return "Every one of the " + D.num(n) + " balls finished inside a bin, and the spread is measured off all of them. ";
    return "The spread is measured off the " + D.num(n) + " balls that finished inside a bin (" +
      missed + (missed === 1 ? " ball is" : " balls are") + " still hung up on a peg). ";
  }

  function writeCopy() {
    if (act === 1) {
      if (A1 && A1.done && A1.stats) {
        elTitle.textContent = "Nobody aimed these balls. The bell curve built itself.";
        elSub.textContent = D.num(droppedCount()) + " balls, " + L.rows +
          " rows of pegs, one release point. Every ball fell the same way and they still spread out like this.";
      } else {
        elTitle.textContent = "Drop enough balls through a peg field and a bell curve builds itself.";
        elSub.textContent = "Each peg sends a ball left or right. Nothing else happens. Watch the pile find the shape.";
      }
    } else {
      if (A2 && A2.done) {
        /* The headline is a count the board decided, not the number we fed it.
           The drop between the two means is the assumption made visible, and the
           sub says so in those words. */
        elTitle.textContent = "Their children came back toward the middle. " + (A2.backToParents === 0
          ? "Not one of the " + A2.childN + " made it back into " + selectionPhrase() + "."
          : "Only " + A2.backToParents + " of the " + A2.childN +
            " made it back into " + selectionPhrase() + ".");
        elSub.textContent = "Assumed: each child is released " + D.pct(HERIT, 0) +
          " of the way out, the share of a height advantage a parent passes on. Measured: " +
          A1.parents.length + " parents averaged " + D.sigma(A1.parentZ, 2) + ", their " +
          A2.childN + " children averaged " + D.sigma(A2.childZ, 2) + ", and " + A2.insideCrowd +
          " of them finished back inside the ordinary crowd, under one sigma.";
      } else {
        elTitle.textContent = "Keep the balls in " + selectionPhrase() + ". Now drop their children.";
        elSub.textContent = "Each child is released " + D.pct(HERIT, 0) +
          " of the way out from the middle, the share of a height advantage a parent passes on. " +
          "That share is the assumption. Everything after the release is bounces, and the bounces " +
          "start from zero.";
      }
    }
    note.textContent =
      "How to read the sigma. One sigma here is the measured spread of the first pile, not a " +
      "theoretical value: " +
      (A1 && A1.done && A1.sdBins
        ? "it came out " + A1.sdBins.toFixed(2) + " bins wide against " + A1.idealBins.toFixed(2) +
          " for a perfect coin flip walk down " + L.rows + " rows, because a bouncing ball can be " +
          "knocked further than half a spacing where a coin flip cannot. "
        : "it is read off the pile once the run finishes. ") +
      countedPhrase() +
      (A1 && A1.done
        ? "The " + A1.parents.length + " balls in " + selectionPhrase() + ", everything past " +
          D.sigma(A1.cut, 1) + ", are " + D.pct(A1.share, 0) + " of the run, and they are the ones " +
          "whose children are dropped in the second view. "
        : "") +
      "The second peg field runs the full width of the box so a child released to the right still " +
      "gets " + L.rows + " bounces. Physics simulation, fixed timestep, seeded so every run is " +
      "identical.";
    writeAlt();
  }

  function writeAlt() {
    var s = "";
    if (A1 && A1.done) {
      s += D.num(droppedCount()) + " balls fell through " + L.rows +
        " rows of pegs from a single release point and piled into a bell curve. " +
        D.num(A1.stats.n) + " of them finished inside a bin, which is what the spread is measured from. " +
        "The " + A1.parents.length + " balls in " + selectionPhrase() + ", everything past " +
        D.sigma(A1.cut, 1) + " and " + D.pct(A1.share, 0) + " of the run, are the outliers. ";
    } else {
      s += "A physics simulation of a Galton board. Balls fall from one point through " + L.rows +
        " rows of pegs and pile into " + L.bins + " bins, building a bell curve. ";
    }
    if (A2 && A2.done) {
      s += "Their " + A2.childN + " children were released " + D.pct(HERIT, 0) +
        " of the way out from the middle, which is the one assumption in this figure, and fell " +
        "through a fresh peg field. The parents averaged " + D.sigma(A1.parentZ, 2) +
        " and the children averaged " + D.sigma(A2.childZ, 2) + ", which is the assumption coming " +
        "back out. What the board decided is the rest: " +
        (A2.backToParents === 0 ? "not one of the children" : "only " + A2.backToParents + " of them") +
        " made it back into " + selectionPhrase() + ", and " + A2.insideCrowd +
        " finished back inside the ordinary crowd, under one sigma.";
    }
    alt.textContent = s;
  }

  function writeTable() {
    D.clear(tblBody);
    var rowsHtml = "";
    for (var k = 0; k < L.bins; k++) {
      var z = A1 && A1.stats ? zOf(binCentre(k)) : 0;
      rowsHtml += "<tr><td>" + (k + 1) + "</td><td>" +
        (A1 && A1.stats ? D.sigma(z, 2) : "n/a") + "</td><td>" +
        (A1 && A1.counts ? A1.counts[k] : 0) + "</td><td>" +
        (A2 && A2.counts ? A2.counts[k] : 0) + "</td></tr>";
    }
    tblBody.innerHTML =
      "<table><thead><tr><th>Bin</th><th>Centre</th><th>First drop, balls</th>" +
      "<th>Second drop, children</th></tr></thead>" +
      "<tbody>" + rowsHtml + "</tbody></table>";
  }

  /* The count changes about twenty times a second while balls are falling.
     Writing that straight into an aria-live region would fire twenty
     announcements a second, so the text is rewritten at most twice a second
     and always once at the end.                                             */
  function updateReadout(force) {
    var A = act === 1 ? A1 : A2;
    if (!A) return;
    var total = act === 1 ? L.N : A.queue.length;
    var now = A.spawned;
    if (!force) {
      if (now === lastReadout) return;
      var t = Date.now();
      if (t - readoutAt < 450 && now < total) return;
      readoutAt = t;
    }
    lastReadout = now;
    readout.textContent = (act === 1 ? "Balls dropped " : "Children dropped ") +
      now + " of " + total;
  }

  /* ── canvas ──────────────────────────────────────────────────────────────── */
  function drawCanvas() {
    if (!ctx) return;
    ctx.clearRect(0, 0, L.w, L.h);
    texture(ctx, L.w, L.h);

    var iCol = ink(), mCol = muted(), aCol = accent(), rCol = rule();
    var i, p, ps;
    var world = act === 1 ? A1.world : A2.world;

    /* Bin dividers, only as tall as the balls beside them.
       Full height dividers above empty bins drew a picket fence across the empty
       half of the box, which is the loudest thing in a frame whose subject is a
       heap of balls. Each divider now rises to whichever of its two neighbours
       is taller, plus a stub so an empty bin still reads as a bin. */
    var hsSrc = (act === 2 && phase === "highlight") ? A1 : (act === 1 ? A1 : A2);
    var hsL = pileHeights(hsSrc), stub = Math.max(10, L.rb * 1.6);
    function divTop(k) {                 /* k is the divider index, 0..bins */
      var a = k > 0 ? hsL[k - 1] : 0;
      var b = k < L.bins ? hsL[k] : 0;
      var top = L.floorY - Math.max(a, b) - stub;
      return top < L.binTop ? L.binTop : top;
    }
    ctx.strokeStyle = rCol;
    ctx.lineWidth = Math.max(1, L.sx * 0.035);
    ctx.beginPath();
    for (i = 0; i <= L.bins; i++) {
      var dx = L.x0 + i * L.sx;
      ctx.moveTo(dx, divTop(i)); ctx.lineTo(dx, L.floorY);
    }
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(L.x0, L.floorY + 0.5); ctx.lineTo(L.x1, L.floorY + 0.5);
    ctx.strokeStyle = mCol; ctx.lineWidth = 1.25; ctx.stroke();

    /* Pegs. During the freeze at the top of the second view the first pile is
       still on screen, so the first board has to be the one under it.
       Drawn in the muted ink at low alpha rather than in the rule colour: in
       dark mode the rule token sits a few per cent off the paper and the whole
       peg field disappeared, which is the one part of this figure that has to be
       visible before anything happens. */
    /* Rings, not discs. The peg has to be physically wider than the ball or the
       ball straddles two of them and wedges, which was measured, so the weight
       cannot come off the radius. It comes off the fill instead: a hairline ring
       at the true contact radius plus a small dot at the centre. The lattice is
       still legible, the true size is still visible, and the balls are now the
       darkest thing in the frame, which is the right way round. */
    var pegSrc = (act === 2 && phase === "highlight") ? A1.world : world;
    var g;
    ctx.globalAlpha = 0.38;
    ctx.strokeStyle = mCol;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (i = 0; i < pegSrc.pegs.length; i++) {
      g = pegSrc.pegs[i];
      ctx.moveTo(g.x + g.r, g.y);
      ctx.arc(g.x, g.y, g.r, 0, TAU);
    }
    ctx.stroke();
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = mCol;
    ctx.beginPath();
    for (i = 0; i < pegSrc.pegs.length; i++) {
      g = pegSrc.pegs[i];
      ctx.moveTo(g.x + g.r * 0.3, g.y);
      ctx.arc(g.x, g.y, g.r * 0.3, 0, TAU);
    }
    ctx.fill();
    ctx.globalAlpha = 1;

    /* The release point. This used to be two short diagonals with a gap in the
       middle, 120px below their own caption, and it read as a bird. It is now
       one small solid disc at the point the balls actually leave from, with a
       hairline dropping to the first peg row, and the SVG layer labels it. */
    ctx.strokeStyle = mCol;
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.7;
    ctx.beginPath();
    if (act === 1) {
      ctx.moveTo(L.cx, L.dropY); ctx.lineTo(L.cx, L.pegTop - L.rp);
    } else if (A2 && A2.queue.length && !A2.done) {
      /* Only while the children are still falling. Once the run is over the
         annotation band uses that height, and a rule drawn across it would run
         straight through the sentence carrying the finding. */
      var lo = A2.queue[0], hi = A2.queue[0];
      for (i = 1; i < A2.queue.length; i++) {
        if (A2.queue[i] < lo) lo = A2.queue[i];
        if (A2.queue[i] > hi) hi = A2.queue[i];
      }
      ctx.moveTo(lo - L.rb * 0.8, L.dropY); ctx.lineTo(hi + L.rb * 0.8, L.dropY);
    }
    ctx.stroke();
    ctx.globalAlpha = 1;
    if (act === 1) {
      ctx.fillStyle = mCol;
      ctx.beginPath();
      ctx.moveTo(L.cx + L.rb * 0.5, L.dropY);
      ctx.arc(L.cx, L.dropY, L.rb * 0.5, 0, TAU);
      ctx.fill();
    }

    /* balls, batched by fill so 150 discs cost two paths, not 150 */
    var plain = [], hot = [];
    if (act === 2 && phase === "highlight") {
      ps = A1.world.particles;
      for (i = 0; i < ps.length; i++) (ps[i].data.parent ? hot : plain).push(ps[i]);
    } else {
      ps = world.particles;
      for (i = 0; i < ps.length; i++) (act === 2 ? hot : plain).push(ps[i]);
    }

    /* One path per fill, so 220 discs cost two paths rather than 220. The
       paper coloured hairline is what makes a packed bin read as stacked
       balls instead of as one grey shape. */
    function discs(list, fill, alpha) {
      if (!list.length) return;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = fill;
      ctx.beginPath();
      for (var n = 0; n < list.length; n++) {
        p = list[n];
        ctx.moveTo(p.x + p.r, p.y);
        ctx.arc(p.x, p.y, p.r, 0, TAU);
      }
      ctx.fill();
      ctx.strokeStyle = paper();
      ctx.lineWidth = Math.max(0.8, L.rb * 0.16);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    discs(plain, mCol, act === 2 && phase === "highlight" ? 0.28 : 0.9);
    discs(hot, aCol, 1);

    /* one specular dot each, so the pile reads as stacked spheres */
    var all = plain.concat(hot);
    ctx.globalAlpha = 0.30;
    ctx.fillStyle = paper();
    ctx.beginPath();
    for (i = 0; i < all.length; i++) {
      p = all[i];
      var hr = p.r * 0.34;
      ctx.moveTo(p.x - p.r * 0.28 + hr, p.y - p.r * 0.30);
      ctx.arc(p.x - p.r * 0.28, p.y - p.r * 0.30, hr, 0, TAU);
    }
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  /* ── SVG overlay ─────────────────────────────────────────────────────────── */
  function pileHeights(A) {
    var out = [], i;
    for (i = 0; i < L.bins; i++) out.push(0);
    var ps = A.world.particles;
    for (i = 0; i < ps.length; i++) {
      if (!ps[i].sleeping) continue;
      var k = binIndex(ps[i].x);
      var hgt = L.floorY - (ps[i].y - ps[i].r);
      if (hgt > out[k]) out[k] = hgt;
    }
    return out;
  }

  /* Fit the normal curve to the pile by least squares through the origin, so
     the curve is scaled by the balls rather than by a number we picked. */
  function fitCurve(A, stats) {
    var hs = pileHeights(A), i, num = 0, den = 0, exp = [];
    var n = landed(A).length;
    for (i = 0; i < L.bins; i++) {
      var lo = L.x0 + i * L.sx, hi = lo + L.sx;
      var e = n * (D.Phi((hi - stats.mu) / stats.sd) - D.Phi((lo - stats.mu) / stats.sd));
      exp.push(e);
      num += e * hs[i]; den += e * e;
    }
    if (den <= 0) return null;
    return { k: num / den, n: n, exp: exp, heights: hs };
  }

  /* A multi line label that cannot leave the canvas.
     The two mean rules sit wherever the physics put them, and at 353px the
     right hand one is 20px from the wall, so a label anchored off it ran off the
     stage and got clipped mid word. This estimates the block's width from the
     longest line, flips the anchor when the chosen side has no room, and then
     clamps the whole block inside the canvas with a 6px inset. Estimating text
     width from character count is crude, but it is crude in the safe direction:
     0.58em per character over-measures the sans at these sizes. */
  function fitBlock(x, y, lines, anchor) {
    var i, wMax = 0;
    for (i = 0; i < lines.length; i++) {
      var wi = String(lines[i].text).length * (lines[i].size || L.fs) * 0.58;
      if (wi > wMax) wMax = wi;
    }
    var pad = 6, lo = pad, hi = L.w - pad;
    if (anchor === "start" && x + wMax > hi) anchor = "end";
    else if (anchor === "end" && x - wMax < lo) anchor = "start";
    if (anchor === "start") { if (x + wMax > hi) x = Math.max(lo, hi - wMax); if (x < lo) x = lo; }
    else if (anchor === "end") { if (x - wMax < lo) x = Math.min(hi, lo + wMax); if (x > hi) x = hi; }
    else {
      if (x - wMax / 2 < lo) x = lo + wMax / 2;
      if (x + wMax / 2 > hi) x = hi - wMax / 2;
    }
    return D.txtBlock(svg, x, y, anchor, lines, true);
  }

  /* The sigma axis lives in a band of its own, a ball's radius clear of the
     bin floor. It is the one line of text that says what the board measures,
     and the pile is not allowed to touch it. */
  function axisSigma(g) {
    if (!A1 || !A1.stats) return;
    var y = L.axisY;
    for (var z = -4; z <= 4; z++) {
      var x = xOfZ(z);
      if (x < L.x0 + 2 || x > L.x1 - 2) continue;
      D.el("line", { x1: x, y1: y - 5, x2: x, y2: y + 5, stroke: muted(), "stroke-width": 1 }, g);
      D.txt(svg, {
        x: x, y: y + 5 + L.fs + 2, "text-anchor": "middle",
        fill: muted(), "font-family": sans(), "font-size": L.fs
      }, z === 0 ? "mean" : D.sigma(z, 0), true);
    }
    D.el("line", { x1: L.x0, y1: y, x2: L.x1, y2: y, stroke: muted(), "stroke-width": 1 }, g);
  }

  function drawOverlay() {
    D.clear(svg);
    svg.setAttribute("width", L.w);
    svg.setAttribute("height", L.h);
    svg.setAttribute("viewBox", "0 0 " + L.w + " " + L.h);
    var g = D.el("g", {}, svg);

    var A = act === 1 ? A1 : A2;
    var stats = (A && A.stats) ? A.stats : settledStats(A);

    axisSigma(g);

    if (act === 1) {
      if (stats && stats.n >= 15) {
        var fit = fitCurve(A1, stats);
        if (fit) {
          var pts = [], step = L.sx / 6;
          for (var x = L.x0; x <= L.x1 + 0.01; x += step) {
            var e = fit.n * L.sx * D.normPdf(x, stats.mu, stats.sd);
            pts.push([x, L.floorY - Math.max(0, fit.k * e)]);
          }
          /* The curve is drawn OVER the pile, because under it there is nothing
             to see: the balls fill everything below the line. So it carries its
             own paper coloured halo, the same trick every label in this piece
             uses, and it stays legible exactly where the data is. */
          var dCurve = M.monotonePath(pts);
          D.el("path", {
            d: dCurve, fill: "none", stroke: paper(),
            "stroke-width": 5, "stroke-linecap": "round", opacity: 0.85
          }, g);
          D.el("path", {
            d: dCurve, fill: "none", stroke: ink(),
            "stroke-width": 1.8, "stroke-linecap": "round", opacity: 0.9
          }, g);
          /* The caption goes in the top right of the bin field, which is the
             one corner a bell curve always leaves empty. Chasing the curve's
             own peak puts it up among the pegs at some widths and under the
             pile at others. */
          D.txtBlock(svg, L.x1 - 4, L.binTop + L.fs + 6, "end", [
            { text: "the normal curve,", size: L.fs, fill: ink() },
            { text: "fitted to the pile", size: L.fs, fill: muted() }
          ], true);
        }
      }
      /* The release point, named. The sigma per bin used to live up here and it
         is now in the note under the chart, where chart explanation belongs. */
      D.txt(svg, {
        x: L.cx + L.rb * 1.4, y: L.dropY + L.fs * 0.36, "text-anchor": "start",
        fill: muted(), "font-family": sans(), "font-size": L.fs
      }, "one release point", true);
    } else {
      drawAct2Overlay(g);
    }

    D.hoist(svg);
  }

  function drawAct2Overlay(g) {
    if (!A1 || !A1.stats) return;
    var i;

    /* The bins the parents came out of, tinted and NAMED. Unlabelled, a pale
       pink band and a dashed vertical are just decoration the reader has to
       guess at. */
    var cutX = A1.cutX !== undefined ? A1.cutX : xOfZ(A1.cut);
    D.el("rect", {
      x: cutX, y: L.binTop, width: Math.max(0, L.x1 - cutX), height: L.floorY - L.binTop,
      fill: accent(), opacity: 0.08
    }, g);
    D.el("line", {
      x1: cutX, y1: L.binTop, x2: cutX, y2: L.floorY,
      stroke: accent(), "stroke-width": 1, "stroke-dasharray": "3 3", opacity: 0.55
    }, g);
    /* Two lines, right aligned into the band itself, so the label cannot be read
       as belonging to the bins on the other side of the rule. */
    var narrow = D.bp(L.w) === "s";
    fitBlock(L.x1 - 4, L.binTop + L.fs + 6, [
      { text: A1.parents.length + " balls came from here", size: L.fs, fill: accent(), weight: 600 },
      { text: "past " + D.sigma(A1.cut, 1) + ", " + D.pct(A1.share, 0) + " of the run", size: L.fs, fill: muted() }
    ], "end");

    /* the first pile as a step outline, so the two generations can be compared */
    if (A1.counts) {
      var hs = A1.pileH || (A1.pileH = pileHeights(A1));
      var d = "";
      for (i = 0; i < L.bins; i++) {
        var lo = L.x0 + i * L.sx, hi = lo + L.sx, y = L.floorY - hs[i];
        d += (i === 0 ? "M " + lo.toFixed(1) + " " + L.floorY.toFixed(1) + " L " : "L ") +
             lo.toFixed(1) + " " + y.toFixed(1) + " L " + hi.toFixed(1) + " " + y.toFixed(1) + " ";
      }
      d += "L " + L.x1.toFixed(1) + " " + L.floorY.toFixed(1);
      D.el("path", {
        d: d, fill: "none", stroke: muted(), "stroke-width": 1.2,
        "stroke-dasharray": "4 3", opacity: 0.8
      }, g);
      /* Inside the bin field, not above it: at seven rows the strip above the
         bins is the bottom peg row, and this label was drawn straight across it.
         And it says what the outline IS. "Where the parents landed" was wrong:
         only a dozen of those balls are parents, the outline is the whole first
         drop, and the tinted band is the part of it that had children. */
      D.txt(svg, {
        x: L.x0 + 3, y: L.binTop + L.fs + 6, "text-anchor": "start",
        fill: muted(), "font-family": sans(), "font-size": L.fs
      }, narrow ? "dashed: all " + D.num(A1.stats.n) + " first balls"
                : "dashed outline: the first drop, all " + D.num(A1.stats.n) + " balls", true);
    }

    if (!A2 || !A2.done) {
      D.txt(svg, {
        x: L.cx, y: L.headH * 0.5, "text-anchor": "middle",
        fill: muted(), "font-family": sans(), "font-size": L.fs
      }, phase === "highlight"
          ? (A1.parents.length + " balls finished in " + selectionPhrase())
          : "each child is released " + D.pct(HERIT, 0) + " of the way out", true);
      return;
    }

    /* ── the annotation band ──────────────────────────────────────────────────
       Three things have to be unmistakable here, and the old version ran them
       together into one number that looked measured and was not:

         the release point is the ASSUMPTION (r times the parent's sigma)
         the two means are MEASURED, and their gap is the assumption reappearing
         the count in the headline is what the board actually decided

       So the release rule is labelled as an assumption, the mean rules are
       labelled as measured, and the gap between them says which it is.        */
    var px = xOfZ(A1.parentZ), cxx = xOfZ(A2.childZ);
    var topY = L.headH * 0.72;
    function meanRule(x, col, lines, anchor) {
      D.el("line", {
        x1: x, y1: topY, x2: x, y2: L.floorY,
        stroke: col, "stroke-width": 1.5, "stroke-dasharray": "5 4"
      }, g);
      fitBlock(x + (anchor === "end" ? -5 : 5), topY - L.fsBig - 2, lines, anchor);
    }
    meanRule(px, accent(), [
      { text: narrow ? "parents" : "parents, measured", size: L.fs, fill: muted() },
      { text: D.sigma(A1.parentZ, 2), size: L.fsBig, weight: 600, fill: accent(), family: mono() }
    ], "start");
    meanRule(cxx, ink(), [
      { text: narrow ? "children" : "their children, measured", size: L.fs, fill: muted() },
      { text: D.sigma(A2.childZ, 2), size: L.fsBig, weight: 600, fill: ink(), family: mono() }
    ], "end");

    var ay = topY + 13;
    D.el("path", {
      d: "M " + px.toFixed(1) + " " + ay + " L " + cxx.toFixed(1) + " " + ay +
         " M " + cxx.toFixed(1) + " " + ay + " l 6 -4 M " + cxx.toFixed(1) + " " + ay + " l 6 4",
      fill: "none", stroke: ink(), "stroke-width": 1.4, "stroke-linecap": "round"
    }, g);
    /* The gap is the assumption, said out loud. The count underneath it is the
       part the board decided, and it is the one in the headline. Both are broken
       into short enough lines that a 353px stage can hold them. */
    var gapLines = narrow
      ? [{ text: "the gap is the assumption:", size: L.fs, fill: muted() },
         { text: D.pct(HERIT, 0) + " of the distance carries", size: L.fs, fill: muted() },
         { text: (A2.backToParents === 0 ? "no child" : A2.backToParents + " of " + A2.childN) +
                 " got back past " + D.sigma(A1.cut, 1), size: L.fs, weight: 600, fill: ink() }]
      : [{ text: "this gap is the assumption: " + D.pct(HERIT, 0) + " of the distance carries",
           size: L.fs, fill: muted() },
         { text: (A2.backToParents === 0 ? "no child" : A2.backToParents + " of " + A2.childN) +
                 " got back past " + D.sigma(A1.cut, 1) + ", which the board decided",
           size: L.fs, weight: 600, fill: ink() }];
    fitBlock((px + cxx) / 2, ay + L.fs + 5, gapLines, "middle");
  }

  /* ── loop ────────────────────────────────────────────────────────────────── */
  function paint() {
    drawCanvas();
    frame++;
    if (frame % 4 === 0) drawOverlay();
    updateReadout(false);
  }

  function tick(dt) {
    var A = act === 1 ? A1 : A2;
    if (!A) return;

    if (act === 2 && phase === "highlight") {
      holdSteps += dt;
      drawCanvas();
      if (frame++ % 4 === 0) drawOverlay();
      if (holdSteps > 1.3) { phase = "run"; drawOverlay(); }
      return;
    }

    A.world.step(Math.min(dt, 1 / 20));
    keepInside(A);
    paint();

    var target = act === 1 ? L.N : A.queue.length;
    if (!A.done && isDone(A, target)) {
      if (act === 1) finaliseA1(); else finaliseA2();
      drawOverlay();
      updateReadout(true);
      pause();
    }
  }

  function play() {
    if (D.reducedMotion()) return;
    wantPlay = true;
    if (stopTick || !visible) return;
    var A = act === 1 ? A1 : A2;
    if (A && A.done) return;
    stopTick = D.onTick(tick);
    syncButtons();
  }
  function pause() {
    if (stopTick) { stopTick(); stopTick = null; }
    syncButtons();
  }
  function syncButtons() {
    var A = act === 1 ? A1 : A2;
    var running = !!stopTick;
    btnPlay.textContent = running ? "Pause" : (A && A.done ? "Replay" : "Play");
    btnPlay.setAttribute("aria-pressed", running ? "true" : "false");
    segA.setAttribute("aria-pressed", act === 1 ? "true" : "false");
    segB.setAttribute("aria-pressed", act === 2 ? "true" : "false");
  }

  function setAct(n) {
    if (n === act) return;
    pause();
    act = n;
    frame = 0; lastReadout = -1; holdSteps = 0;
    if (n === 2) {
      if (!A1 || !A1.done) settleHeadless(A1, 1);
      if (!A2) prepareA2();
      phase = D.reducedMotion() ? "run" : "highlight";
      if (D.reducedMotion() && !A2.done) settleHeadless(A2, 2);
    } else {
      phase = "run";
    }
    writeCopy();
    updateReadout(true);
    drawCanvas(); drawOverlay(); syncButtons();
    if (!D.reducedMotion() && wantPlay && visible) play();
  }

  function resetAll() {
    pause();
    A1 = null; A2 = null;
    act = 1; phase = "run"; frame = 0; lastReadout = -1; holdSteps = 0;
    newAct(1);
    if (D.reducedMotion()) {
      settleHeadless(A1, 1);
      prepareA2();
      settleHeadless(A2, 2);
    }
    writeCopy(); writeTable(); updateReadout(true);
    drawCanvas(); drawOverlay(); syncButtons();
  }

  /* ── controls ────────────────────────────────────────────────────────────── */
  segA.addEventListener("click", function () { setAct(1); });
  segB.addEventListener("click", function () { setAct(2); });
  btnReset.addEventListener("click", function () { wantPlay = false; resetAll(); });
  btnPlay.addEventListener("click", function () {
    var A = act === 1 ? A1 : A2;
    if (D.reducedMotion()) {
      /* Nothing animates, so this button still has to do something useful. */
      if (A && !A.done) { settleHeadless(A, act); drawCanvas(); drawOverlay(); updateReadout(true); }
      return;
    }
    if (stopTick) { wantPlay = false; pause(); return; }
    if (A && A.done) {
      if (act === 1) resetAll();
      else { A2 = null; prepareA2(); phase = "run"; frame = 0; lastReadout = -1; }
    }
    wantPlay = true; play();
  });

  /* ── scene contract ──────────────────────────────────────────────────────── */
  function draw(w) {
    var same = L && Math.abs(L.w - w) < 1;
    L = layout(w);
    ctx = D.fitCanvas(canvas, L.w, L.h);
    chart.style.minHeight = L.h + "px";

    if (!same || !A1) {
      pause();
      A1 = null; A2 = null; phase = "run"; frame = 0; lastReadout = -1;
      newAct(1);
      /* A width change rebuilds the world from scratch, which would otherwise
         hand a reader who has already watched the pile form an empty board the
         moment they rotate their phone. If the run was finished before, finish
         it again at the new size rather than starting over. */
      if (D.reducedMotion() || hasSettled) {
        settleHeadless(A1, 1);
        prepareA2();
        settleHeadless(A2, 2);
      } else {
        act = 1;
      }
      writeTable();
    }
    writeCopy();
    updateReadout(true);
    drawCanvas();
    drawOverlay();
    syncButtons();
    if (!same && !D.reducedMotion() && wantPlay && visible) play();
  }

  if (typeof IntersectionObserver === "function") {
    io = new IntersectionObserver(function (entries) {
      for (var i = 0; i < entries.length; i++) {
        visible = entries[i].isIntersecting;
      }
      if (!visible) pause();
      else if (wantPlay) play();
    }, { threshold: 0.15 });
    io.observe(mount);
  }

  return {
    draw: draw,
    /* Jump both acts to their finished state without animating. Used by a
       screenshot harness, where rAF is starved and the sim would otherwise
       never advance, and by anything that needs the result rather than the
       performance. Safe to call more than once. */
    settle: function () {
      pause();
      hasSettled = true;
      /* Never leave a still frame parked in the freeze at the top of the second
         view: that frame shows the FIRST pile, so a screenshot of "their
         children" came back with the parents in it, at the same size, and the
         children nowhere. */
      phase = "run";
      if (!A1) newAct(1);
      settleHeadless(A1, 1);
      prepareA2();
      settleHeadless(A2, 2);
      writeTable();
      writeCopy();
      updateReadout(true);
      drawCanvas();
      drawOverlay();
      syncButtons();
    },
    /* A read-only report on the run, for the verification harness. The physics
       claims in this scene (every ball in a bin, no overlapping pairs, no
       penetration, a spread that matches the binomial) are the kind that a
       screenshot cannot check and a build cannot see, so they are exposed as
       numbers instead of trusted. */
    measure: function () {
      var A = act === 1 ? A1 : A2, out = { act: act };
      if (!L || !A || !A.world) return out;
      var ps = A.world.particles, i, j, worst = 0, pairs = 0, outside = 0;
      for (i = 0; i < ps.length; i++) {
        if (ps[i].y - ps[i].r < L.binTop - L.sy || ps[i].y + ps[i].r > L.floorY + 0.6) outside++;
        for (j = i + 1; j < ps.length; j++) {
          var dx = ps[j].x - ps[i].x, dy = ps[j].y - ps[i].y, R = ps[i].r + ps[j].r;
          var d = Math.sqrt(dx * dx + dy * dy);
          if (d < R - 0.5) { pairs++; if ((R - d) / R > worst) worst = (R - d) / R; }
        }
      }
      out.rows = L.rows; out.bins = L.bins; out.N = L.N;
      out.dropped = A.spawned;
      out.landed = landed(A).length;
      out.overlapPairs = pairs;
      out.worstPenetration = +worst.toFixed(3);
      out.outsideBox = outside;
      out.pegField = Math.round((L.rows - 1) * L.sy);
      out.aboveBins = Math.round(L.binTop);
      out.binH = Math.round(L.floorY - L.binTop);
      out.pileTop = Math.round(Math.max.apply(null, pileHeights(A)));
      out.h = L.h;
      out.boardW = Math.round(L.x1 - L.x0);
      out.rb = +L.rb.toFixed(1); out.rp = +L.rp.toFixed(1);
      if (A1 && A1.stats) {
        out.sdBins = +(A1.stats.sd / L.sx).toFixed(3);
        out.idealBins = +(0.5 * Math.sqrt(L.rows)).toFixed(3);
        out.counts1 = A1.counts;
        out.parents = A1.parents ? A1.parents.length : 0;
        out.binsTaken = A1.binsTaken;
        out.cutZ = +A1.cut.toFixed(2);
        out.share = +A1.share.toFixed(3);
      }
      if (A2 && A2.done) {
        out.counts2 = A2.counts;
        out.childN = A2.childN;
        out.childZ = +A2.childZ.toFixed(2);
        out.parentZ = +A1.parentZ.toFixed(2);
        out.backToParents = A2.backToParents;
        out.insideCrowd = A2.insideCrowd;
      }
      return out;
    },
    progress: function (t) {
      var wanted = t < 0.52 ? 1 : 2;
      if (wanted !== act) setAct(wanted);
      if (!D.reducedMotion() && visible && !stopTick) {
        var A = act === 1 ? A1 : A2;
        if (A && !A.done) { wantPlay = true; play(); }
      }
    },
    destroy: function () {
      pause();
      if (io) { io.disconnect(); io = null; }
      if (stopResize) { stopResize(); stopResize = null; }
    }
  };
});
