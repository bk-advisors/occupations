/* ============================================================================
   BOOT  ·  the page controller. Runs last, owns nothing inside a scene.

   Everything here is defensive on purpose. Eight people wrote this page and a
   reader should never lose seven scenes because one of them threw. Every
   mount, every draw, every progress call and every derived number is wrapped,
   and a failure is logged with the name of the thing that failed.
   ========================================================================== */
(function () {
  "use strict";

  if (typeof RTM === "undefined" || !RTM.boot) {
    console.error("[boot] RTM core is missing. Nothing can mount.");
    return;
  }

  var MOUNTS = [];          /* {id, node, inst, off, track, visible, broken} */
  var frozen = false;       /* set by RTM_REVEAL_ALL: stop touching progress  */
  var lastTheme = null;
  var redrawQueued = false;

  /* ── small helpers ─────────────────────────────────────────────────────── */
  function vh() { return window.innerHeight || document.documentElement.clientHeight || 800; }

  /* Run once, on the next frame, or in 32ms, whichever comes first. Plain
     requestAnimationFrame is not enough on its own: a headless Chrome with no
     compositor delivers the first frame and then starves the rest, so a page
     gated purely on rAF never signals ready and never redraws. Racing a timer
     costs nothing and makes the page work in a screenshot harness. */
  function soon(fn) {
    var fired = false;
    function go() { if (fired) return; fired = true; fn(); }
    requestAnimationFrame(go);
    setTimeout(go, 32);
  }
  function warn(where, e) { console.error("[boot] " + where, e); }
  function tidy(v, dp) { return String(Number(Number(v).toFixed(dp))); }

  /* =========================================================================
     1 · TEXTURES
     ====================================================================== */
  function installTextures() {
    if (!RTM.tex) return;
    var fn = RTM.tex.install || RTM.tex.init || RTM.tex.mount || RTM.tex.build;
    if (typeof fn !== "function") return;
    try { fn.call(RTM.tex); } catch (e) { warn("texture install failed", e); }
  }
  function refreshTextures() {
    if (!RTM.tex || typeof RTM.tex.refresh !== "function") return;
    try { RTM.tex.refresh(); } catch (e) { warn("texture refresh failed", e); }
  }

  /* =========================================================================
     2 · MOUNT EVERY SCENE
     One failure is one failure. The loop always finishes.
     ====================================================================== */
  function failNote(node, id) {
    if (node.querySelector(".fig-note[data-boot-failed]")) return;
    var p = document.createElement("p");
    p.className = "fig-note";
    p.setAttribute("data-boot-failed", id);
    p.textContent = "This figure did not load.";
    node.appendChild(p);
  }

  function safeDraw(rec, w) {
    if (!rec.inst || typeof rec.inst.draw !== "function") return;
    try {
      rec.inst.draw(w);
      rec.drawn = true;
    } catch (e) {
      rec.errors = (rec.errors || 0) + 1;
      if (rec.errors <= 3) warn('scene "' + rec.id + '" threw in draw(' + w + ')', e);
      if (rec.errors === 3) console.error('[boot] scene "' + rec.id + '" keeps throwing, further draw errors are suppressed');
      failNote(rec.node, rec.id);
    }
  }

  function mountAll() {
    RTM.qa("[data-scene]").forEach(function (node) {
      var id = node.getAttribute("data-scene");
      var inst = null;
      try {
        inst = RTM.boot(id, node);
      } catch (e) {
        warn('scene "' + id + '" threw while mounting', e);
        failNote(node, id);
        return;
      }
      if (!inst) {
        console.error('[boot] scene "' + id + '" has no registered module. Is its js file in the build?');
        failNote(node, id);
        return;
      }
      var rec = {
        id: id, node: node, inst: inst,
        track: node.getAttribute("data-track") === "scrolly",
        visible: false, lastT: -1, drawn: false
      };
      MOUNTS.push(rec);

      /* 3 · RESIZE. One observer per mount. RTM.onResize is already debounced
         and deduped by width, and it fires once immediately, which is the
         first draw. */
      try {
        rec.off = RTM.onResize(node, function (w) { safeDraw(rec, w); });
      } catch (e) {
        warn('resize observer failed for "' + id + '"', e);
        safeDraw(rec, RTM.widthOf(node));
      }
      if (!rec.drawn) safeDraw(rec, RTM.widthOf(node));
    });
  }

  function redrawAll() {
    MOUNTS.forEach(function (rec) { safeDraw(rec, Math.round(RTM.widthOf(rec.node))); });
  }
  function queueRedraw() {
    if (redrawQueued) return;
    redrawQueued = true;
    soon(function () { redrawQueued = false; redrawAll(); });
  }

  /* =========================================================================
     4 · SCROLLY
     Every scene with data-track="scrolly" is a narrated sequence: it wants to
     see t run smoothly from 0 to 1 once, in order.

     It used to get that by scrubbing t off the scroll position (trackT below).
     That only works while the graphic is PINNED and the step column supplies
     the runway. The sticky two-column layout was retired, so the figures now
     flow and scroll past in a few hundred pixels, and the measurements were
     brutal: dynasties never saw any state below t = 0.715, survivors never
     reached its final beat at all, and traits jumped over half its
     choreography in a single 120px scroll step. No amount of tuning fixes
     that, because the runway is gone.

     So: the track is now a TRIGGER, not a scrubber. The first time a scene is
     properly on screen it plays its own sweep, once, on the shared ticker.
     Scroll position no longer decides what frame you are looking at.

     trackT is kept only because it documents the old contract. Nothing calls
     it for narration and nothing should: it is the bug, not the driver.
     ====================================================================== */
  var SWEEP_MS = 2600;      /* one comfortable read of a narrated figure      */
  var HURRY_MS = 260;       /* finish, smoothly, if the reader has moved on   */

  function trackT(node) {
    var r = node.getBoundingClientRect();
    var v = vh();
    var t;
    if (r.height > v * 1.05) t = (-r.top) / (r.height - v);
    else t = (v - r.top) / (v + r.height);
    return RTM.clamp(t, 0, 1);
  }

  function pushProgress(rec, t) {
    if (!rec.inst || typeof rec.inst.progress !== "function") return;
    if (Math.abs(t - rec.lastT) < 0.001) return;
    rec.lastT = t;
    try {
      rec.inst.progress(t);
    } catch (e) {
      rec.perrors = (rec.perrors || 0) + 1;
      if (rec.perrors <= 3) warn('scene "' + rec.id + '" threw in progress(' + t.toFixed(3) + ')', e);
    }
  }

  function onScreen(node) {
    var r = node.getBoundingClientRect();
    return r.bottom > 0 && r.top < vh();
  }

  /* Enough of the figure is in front of the reader to be worth playing. A tall
     figure can never fill the viewport, so the test is against whichever is
     smaller: a third of the screen, or half the figure. */
  function wellSeen(node) {
    var r = node.getBoundingClientRect();
    var v = vh();
    var shown = Math.min(r.bottom, v) - Math.max(r.top, 0);
    if (shown <= 0) return false;
    return shown >= Math.min(v * 0.34, Math.max(1, r.height) * 0.5);
  }

  /* One sweep per scene per page load. Re-entering never restarts it: a reader
     who scrolls up and back down gets the finished figure, not a replay. */
  function startSweep(rec) {
    if (frozen || rec.swept || !rec.track) return;
    if (!rec.inst || typeof rec.inst.progress !== "function") { rec.swept = true; return; }
    if (!wellSeen(rec.node)) return;
    rec.swept = true;

    /* Reduced motion keeps exactly the old behaviour: the end state, once. */
    if (reducedTracks || !RTM.motion || !RTM.motion.tween) { pushProgress(rec, 1); return; }

    pushProgress(rec, 0);
    rec.sweepV = 0;
    rec.sweep = RTM.motion.tween({
      from: 0, to: 1, dur: SWEEP_MS, ease: "cubicInOut",
      onUpdate: function (v) {
        rec.sweepV = v;
        if (frozen) return;
        pushProgress(rec, v);
        /* Checked here rather than only on scroll, because the last scroll
           event of a read-through can land before the figure has left, and
           then nothing would ever ask again. Deferred by a tick: cancelling
           the tween from inside its own callback splices the ticker list
           while the ticker is walking it. */
        if (!rec.hurried && !onScreen(rec.node)) setTimeout(function () { hurrySweep(rec); }, 0);
      },
      onDone: function () { rec.sweep = null; if (!frozen) pushProgress(rec, 1); }
    });
  }

  /* The reader scrolled past mid sentence. Run the rest quickly rather than
     leaving the figure stranded half told, and do it by re-tweening from where
     it is, so the values stay continuous and nothing jumps. */
  function hurrySweep(rec) {
    if (frozen || !rec.sweep || rec.hurried) return;
    rec.hurried = true;
    rec.sweep.cancel();
    var from = rec.sweepV || 0;
    rec.sweep = RTM.motion.tween({
      from: from, to: 1, dur: HURRY_MS, ease: "quadOut",
      onUpdate: function (v) { rec.sweepV = v; if (!frozen) pushProgress(rec, v); },
      onDone: function () { rec.sweep = null; if (!frozen) pushProgress(rec, 1); }
    });
  }

  function cancelSweeps() {
    MOUNTS.forEach(function (rec) {
      if (rec.sweep) { try { rec.sweep.cancel(); } catch (e) { /* already gone */ } rec.sweep = null; }
    });
  }

  var scrollQueued = false;
  var reducedTracks = false;
  function onScroll() {
    if (scrollQueued) return;
    scrollQueued = true;
    soon(function () {
      scrollQueued = false;
      updateReadingBar();
      if (frozen) return;
      for (var i = 0; i < MOUNTS.length; i++) {
        var rec = MOUNTS[i];
        if (!rec.track) continue;
        /* The observer answers "is this track live" for free when it says yes.
           When it says no we spend one getBoundingClientRect confirming it,
           because an IntersectionObserver needs a rendering lifecycle to
           deliver an update and a headless Chrome with no compositor may
           deliver the first one and then nothing. A track that scrolled into
           view would go on reading "not visible" forever, and the scrolly
           would silently never run in the screenshot harness. Dead tracks
           still cost one rect read and no scene work, which is the point. */
        if (rec.swept) {
          /* Playing, and the reader has already moved on. Land it. */
          if (rec.sweep && !onScreen(rec.node)) hurrySweep(rec);
          continue;
        }
        if (!rec.visible && !onScreen(rec.node)) continue;
        startSweep(rec);
      }
    });
  }

  function watchTracks() {
    var tracks = MOUNTS.filter(function (r) { return r.track; });
    if (!tracks.length) return;
    reducedTracks = RTM.reducedMotion();
    if (!("IntersectionObserver" in window)) { onScroll(); return; }

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        var rec = null;
        for (var i = 0; i < tracks.length; i++) if (tracks[i].node === en.target) rec = tracks[i];
        if (!rec) return;
        rec.visible = en.isIntersecting;
        if (frozen) return;
        if (!en.isIntersecting) {
          if (rec.sweep) hurrySweep(rec);
          return;
        }
        startSweep(rec);
        if (rec.swept && !rec.sweep) io.unobserve(en.target);
      });
    }, { rootMargin: "0px", threshold: [0, 0.01, 0.2, 0.5, 1] });
    tracks.forEach(function (r) { io.observe(r.node); });
  }

  /* =========================================================================
     5 · THEME
     The toggle only writes data-theme on <html>. A MutationObserver does the
     work, so a theme set by the Artifact viewer, by the host page or by the
     button all take exactly the same path.
     ====================================================================== */
  var mqDark = window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;

  function effectiveTheme() {
    var set = document.documentElement.getAttribute("data-theme");
    if (set === "dark" || set === "light") return set;
    return mqDark && mqDark.matches ? "dark" : "light";
  }

  /* The name and the tooltip are set from the live theme, together, every time.
     They used to be set independently of the visible text, so the button read
     "DARK MODE" while dark mode was already on and aria-pressed said "true".

     aria-pressed carries the state, so the name stays constant ("Dark theme")
     and a screen reader says "Dark theme, toggle button, pressed". The title is
     the sighted reader's version and names the action instead. */
  function labelTheme(next) {
    if (!themeBtn) return;
    themeBtn.setAttribute("aria-pressed", next === "dark" ? "true" : "false");
    themeBtn.setAttribute("aria-label", "Dark theme");
    themeBtn.setAttribute("title", next === "dark" ? "Switch to the light theme" : "Switch to the dark theme");
  }

  function onThemeMaybeChanged() {
    var next = effectiveTheme();
    if (next === lastTheme) return;
    lastTheme = next;
    labelTheme(next);
    try { RTM.bustTokens(); } catch (e) { warn("bustTokens failed", e); }
    refreshTextures();
    queueRedraw();
  }

  /* A sun and a moon, drawn rather than typed, so there is no emoji font
     dependency and both follow currentColor into either theme. The stylesheet
     shows exactly one of them, keyed off aria-pressed. */
  function themeIcon() {
    var NS = "http://www.w3.org/2000/svg";
    var svg = document.createElementNS(NS, "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("focusable", "false");
    svg.setAttribute("fill", "none");
    svg.setAttribute("stroke", "currentColor");
    svg.setAttribute("stroke-width", "1.7");
    svg.setAttribute("stroke-linecap", "round");
    svg.setAttribute("stroke-linejoin", "round");

    var sun = document.createElementNS(NS, "g");
    sun.setAttribute("class", "ico-sun");
    var core = document.createElementNS(NS, "circle");
    core.setAttribute("cx", "12"); core.setAttribute("cy", "12"); core.setAttribute("r", "4.1");
    sun.appendChild(core);
    var rays = [[12, 2.2, 12, 4.4], [12, 19.6, 12, 21.8], [2.2, 12, 4.4, 12], [19.6, 12, 21.8, 12],
                [5.2, 5.2, 6.8, 6.8], [17.2, 17.2, 18.8, 18.8], [18.8, 5.2, 17.2, 6.8], [6.8, 17.2, 5.2, 18.8]];
    for (var i = 0; i < rays.length; i++) {
      var ln = document.createElementNS(NS, "line");
      ln.setAttribute("x1", rays[i][0]); ln.setAttribute("y1", rays[i][1]);
      ln.setAttribute("x2", rays[i][2]); ln.setAttribute("y2", rays[i][3]);
      sun.appendChild(ln);
    }
    svg.appendChild(sun);

    var moon = document.createElementNS(NS, "path");
    moon.setAttribute("class", "ico-moon");
    moon.setAttribute("d", "M20.4 14.6A8.7 8.7 0 0 1 9.4 3.6a8.7 8.7 0 1 0 11 11Z");
    svg.appendChild(moon);
    return svg;
  }

  var themeBtn = null;
  function installTheme() {
    lastTheme = effectiveTheme();

    themeBtn = RTM.q("[data-theme-toggle]") || document.getElementById("theme-toggle");
    if (!themeBtn) {
      themeBtn = document.createElement("button");
      themeBtn.type = "button";
      themeBtn.className = "theme-toggle";
      themeBtn.id = "rtm-theme-toggle";
      themeBtn.appendChild(themeIcon());
      /* Placed just after the skip link rather than appended to the end of
         <body>: a control parked at the top of the page must not be the last
         thing in the tab order, and it must not be the first either, because
         the skip link has to stay the first tab stop on the page. */
      var after = RTM.q(".skip-link") || bar;
      if (after && after.parentNode) after.parentNode.insertBefore(themeBtn, after.nextSibling);
      else document.body.appendChild(themeBtn);
    }
    labelTheme(lastTheme);
    themeBtn.addEventListener("click", function () {
      var next = effectiveTheme() === "dark" ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", next);
      try { window.localStorage.setItem("rtm-theme", next); } catch (e) { /* sandboxed, fine */ }
      onThemeMaybeChanged();
    });

    /* A theme the reader picked last time, unless the host has already spoken. */
    if (!document.documentElement.getAttribute("data-theme")) {
      var saved = null;
      try { saved = window.localStorage.getItem("rtm-theme"); } catch (e) { saved = null; }
      if (saved === "dark" || saved === "light") document.documentElement.setAttribute("data-theme", saved);
    }

    if (mqDark) {
      if (mqDark.addEventListener) mqDark.addEventListener("change", onThemeMaybeChanged);
      else if (mqDark.addListener) mqDark.addListener(onThemeMaybeChanged);
    }
    if (window.MutationObserver) {
      new MutationObserver(onThemeMaybeChanged).observe(document.documentElement, {
        attributes: true, attributeFilter: ["data-theme", "class", "data-color-scheme"]
      });
    }
    onThemeMaybeChanged();
  }

  /* =========================================================================
     6 · DERIVED NUMBERS
     Nothing in the prose is typed. Every one of these is computed from
     RTM.data at load. A key that throws is logged and left out, and the span
     then shows a visible "?" so the harness sees it.
     ====================================================================== */
  function buildNums() {
    var N = {};
    var D = RTM.data || {};
    var H = D.HEIGHT || {};
    var DY = D.DYNASTIES || [];
    var G = D.GALTON || [];

    function put(key, fn) {
      try {
        var v = fn();
        if (v === null || v === undefined) return;
        if (typeof v === "number" && !isFinite(v)) return;
        var s = String(v);
        if (!s || s === "NaN") return;
        N[key] = s;
      } catch (e) { warn('NUMS "' + key + '" could not be computed', e); }
    }
    function trait(id) {
      var T = D.TRAITS || [];
      for (var i = 0; i < T.length; i++) if (T[i].id === id) return T[i];
      return null;
    }
    function traitR(id, fallback) {
      var t = trait(id);
      return t && isFinite(t.r) ? t.r : fallback;
    }
    function halfLife(r) {
      return typeof D.halfLife === "function" ? D.halfLife(r) : Math.log(0.5) / Math.log(r);
    }

    /* Galton's own tally */
    var fit = null;
    try { fit = typeof D.galtonFit === "function" ? D.galtonFit() : null; } catch (e) { fit = null; }
    put("galton-slope", function () { return fit.slope.toFixed(2); });
    put("galton-r", function () { return fit.r.toFixed(2); });
    put("galton-n", function () {
      var s = 0;
      for (var i = 0; i < G.length; i++) s += (G[i][2] || 0);
      return RTM.num(s, 0);
    });

    /* Height, the one measurement everyone can picture */
    var lz = (H.lebron - H.mean) / H.sd;
    var bz = (H.bronny - H.mean) / H.sd;
    var predH = H.mean + H.r * (H.lebron - H.mean);
    var resSd = H.sd * Math.sqrt(1 - H.r * H.r);

    put("gap-inches", function () { return tidy(H.lebron - H.bronny, 2); });
    put("height-r", function () { return tidy(H.r, 2); });
    put("lebron-height", function () { return RTM.fmtFt(H.lebron); });
    put("bronny-height", function () { return RTM.fmtFt(H.bronny); });
    put("lebron-z", function () { return RTM.sigma(lz, 1); });
    put("bronny-z", function () { return RTM.sigma(bz, 1); });
    put("pred-height", function () { return RTM.fmtFt(predH); });
    /* Paired with pred-height in one sentence, so it must format identically. */
    put("bronny-height", function () { return RTM.fmtFt(H.bronny); });
    put("pred-z", function () { return RTM.sigma(H.r * lz, 1); });
    put("pred-error", function () {
      var e = Math.abs(predH - H.bronny);
      return (e < 0.95 ? e.toFixed(2) : e.toFixed(1)) + " inches";
    });
    put("pi-range", function () {
      return RTM.fmtFt(predH - 1.96 * resSd) + " to " + RTM.fmtFt(predH + 1.96 * resSd);
    });
    put("lebron-rarity", function () { return RTM.oneIn(1 - RTM.Phi(lz)); });
    put("bronny-pct", function () { return RTM.ordinalSuffix(Math.round(RTM.Phi(bz) * 100)); });
    put("income-r", function () { return tidy(traitR("income", 0.34), 2); });

    /* The dynasty board. The headline slope is fitted on verified pairs only:
       an editorial placement is allowed on the chart, never in a headline. */
    var pairs = DY.filter(function (d) {
      return d && d.parent && d.child && isFinite(d.parent.z) && isFinite(d.child.z);
    });
    var solid = pairs.filter(function (d) {
      return d.parent.verified !== false && d.child.verified !== false;
    });
    var dfit = solid.length >= 3 && RTM.ols
      ? RTM.ols(solid, function (d) { return d.parent.z; }, function (d) { return d.child.z; })
      : null;

    put("dynasty-slope", function () { return dfit.slope.toFixed(2); });
    put("dynasty-n", function () { return RTM.num(solid.length, 0); });
    put("dynasty-all", function () { return RTM.num(pairs.length, 0); });
    put("dynasty-shrink", function () { return RTM.pct(1 - dfit.slope, 0); });
    put("dynasty-keep", function () { return RTM.pct(dfit.slope, 0); });

    /* Retention: the mean child z as a share of the mean parent z, over every
       pair we hold. It answers "how much of the parent's distance from average
       is still there in the child", which is what the prose actually claims,
       and it is far steadier than the fitted slope. The slope is pulled around
       by a handful of political parents pinned to the top rung of the office
       rubric; a ratio of two means is not. Per domain it comes out politics
       0.85, business 0.82, sport 0.77, all from this same formula. */
    function retention(rows) {
      if (!rows.length) return null;
      var sp = 0, sc = 0;
      for (var i = 0; i < rows.length; i++) { sp += rows[i].parent.z; sc += rows[i].child.z; }
      if (Math.abs(sp) < 1e-9) return null;
      return RTM.pct(sc / sp, 0);
    }
    function inDomain(name) {
      return pairs.filter(function (d) { return d.domain === name; });
    }
    put("dynasty-kept", function () { return retention(pairs); });
    put("dynasty-kept-sport", function () { return retention(inDomain("sport")); });
    put("dynasty-kept-politics", function () { return retention(inDomain("politics")); });
    put("dynasty-kept-business", function () { return retention(inDomain("business")); });

    /* Half-lives: generations for an advantage to halve, ln(0.5)/ln(r) */
    put("halflife-height", function () { return halfLife(traitR("height", H.r)).toFixed(1); });
    put("halflife-surname", function () { return halfLife(traitR("surname", 0.75)).toFixed(1); });
    put("halflife-lifespan", function () { return halfLife(traitR("lifespan", 0.15)).toFixed(1); });

    /* Handy extras. An unused key costs nothing; a missing one is a failure. */
    put("trait-count", function () { return RTM.num((D.TRAITS || []).length, 0); });
    put("iq-r", function () { return tidy(traitR("iq", 0.45), 2); });
    put("wealth-r", function () { return tidy(traitR("wealth", 0.37), 2); });
    put("surname-r", function () { return tidy(traitR("surname", 0.75), 2); });
    put("lifespan-r", function () { return tidy(traitR("lifespan", 0.15), 2); });
    put("halflife-income", function () { return halfLife(traitR("income", 0.34)).toFixed(1); });

    return N;
  }

  function fillNums() {
    var N;
    try { N = buildNums(); } catch (e) { warn("NUMS map failed to build", e); N = {}; }
    window.RTM_NUMS = N;
    var missing = {};
    RTM.qa("[data-num]").forEach(function (span) {
      var k = span.getAttribute("data-num");
      if (Object.prototype.hasOwnProperty.call(N, k)) {
        span.textContent = N[k];
        span.removeAttribute("data-num-missing");
      } else {
        span.textContent = "?";
        span.setAttribute("data-num-missing", "true");
        missing[k] = true;
      }
    });
    var keys = Object.keys(missing);
    if (keys.length) {
      console.error('[boot] data-num keys with no value: "' + keys.join('", "') +
        '". Add them to the NUMS map in js/90-boot.js. Every one of them is showing a "?" on the page.');
    }
    return N;
  }

  /* =========================================================================
     6b · THE SOURCE LIST
     shell.html leaves <div id="sources"></div> for this. It shipped empty,
     under a visible "Sources" heading, which is worse than having no heading
     at all: a piece that argues from published figures and then lists none of
     them reads as though it has something to hide.

     Ordered so the reader can scan it: the traits and datasets the argument
     leans on first, then the per-family references.
     ====================================================================== */
  function fillSources() {
    var host = document.getElementById("sources");
    if (!host) return 0;
    var list = (RTM.data && RTM.data.SOURCES) || [];
    if (!list.length) {
      console.error("[boot] #sources exists but RTM.data.SOURCES is empty.");
      return 0;
    }

    /* Anything a trait or the Galton tally cites is load bearing for the
       argument. Everything else is a per-family reference. */
    var primary = {};
    ((RTM.data.TRAITS) || []).forEach(function (t) { if (t.source) primary[t.source] = true; });
    primary.galton1886 = true;

    var ranked = list.slice().sort(function (a, b) {
      var pa = primary[a.id] ? 0 : 1, pb = primary[b.id] ? 0 : 1;
      if (pa !== pb) return pa - pb;
      return String(a.cite || "").localeCompare(String(b.cite || ""));
    });

    while (host.firstChild) host.removeChild(host.firstChild);
    var ul = document.createElement("ul");
    ul.className = "source-list";

    ranked.forEach(function (s) {
      var li = document.createElement("li");
      li.textContent = s.cite || s.id;
      if (s.url) {
        li.appendChild(document.createTextNode(" "));
        var a = document.createElement("a");
        a.href = s.url;
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        /* The bare host, not the full URL. A wall of query strings is not a
           citation and it wraps badly at every width. */
        var host2 = s.url;
        try { host2 = new URL(s.url).hostname.replace(/^www\./, ""); } catch (e) {}
        a.textContent = host2;
        li.appendChild(a);
      }
      ul.appendChild(li);
    });

    host.appendChild(ul);
    return ranked.length;
  }

  /* =========================================================================
     7 · REVEALS
     ====================================================================== */
  var revealIO = null;
  function installReveals() {
    var els = RTM.qa(".reveal");
    if (!els.length) return;
    if (RTM.reducedMotion() || !("IntersectionObserver" in window)) {
      els.forEach(function (n) { n.classList.add("in"); });
      return;
    }
    revealIO = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        en.target.classList.add("in");
        revealIO.unobserve(en.target);
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
    els.forEach(function (n) { revealIO.observe(n); });
  }

  /* A full page screenshot never scrolls, so nothing would ever reveal and
     every scrolly scene would photograph at t = 0. The harness calls this
     first. It is required, not a convenience. */
  window.RTM_REVEAL_ALL = function () {
    frozen = true;
    /* Kill every running sweep first. frozen already gags their onUpdate, but a
       live ticker that outlives the reveal is a leak and a race. */
    cancelSweeps();
    RTM.qa(".reveal").forEach(function (n) { n.classList.add("in"); });
    if (revealIO) { revealIO.disconnect(); revealIO = null; }
    MOUNTS.forEach(function (rec) {
      rec.swept = true;
      /* A scene driven by a running simulation cannot finish here: a headless
         Chrome with no compositor starves rAF, so the sim never advances and
         the scene photographs empty. Any scene that can jump to its finished
         state exposes settle(); call it before asking for progress. */
      if (rec.inst && typeof rec.inst.settle === "function") {
        try { rec.inst.settle(); } catch (e) { warn('scene "' + rec.id + '" threw in settle()', e); }
      }
      if (rec.track) { rec.lastT = -1; pushProgress(rec, 1); }
    });
    return MOUNTS.length;
  };

  /* =========================================================================
     8 · SKIP LINK AND READING PROGRESS
     ====================================================================== */
  var bar = null;
  function updateReadingBar() {
    if (!bar) return;
    var doc = document.documentElement;
    var span = (doc.scrollHeight || 0) - vh();
    var y = window.pageYOffset || doc.scrollTop || 0;
    bar.value = span > 0 ? RTM.clamp(y / span, 0, 1) * 1000 : 0;
  }

  function installChrome() {
    /* Boot owns three bits of page chrome. They are styled from a block
       inserted BEFORE the design stylesheet so the design agent always wins
       a tie. Only ids this file owns are targeted. */
    if (!document.getElementById("rtm-boot-style")) {
      var s = document.createElement("style");
      s.id = "rtm-boot-style";
      /* 2px of accent on a faint track, not 3px of currentColor. currentColor
         at the top of <body> is the ink, which made this the heaviest rule on
         the page and it struck through whatever was under it. The real values
         live in css/03-layout.css; these are the fallback if that sheet is ever
         served without this one. */
      s.textContent =
        "#rtm-reading-progress{position:fixed;top:0;left:0;width:100%;height:2px;z-index:62;" +
        "border:0;background:var(--rule-soft,transparent);appearance:none;-webkit-appearance:none}" +
        "#rtm-reading-progress::-webkit-progress-bar{background:var(--rule-soft,transparent)}" +
        "#rtm-reading-progress::-webkit-progress-value{background:var(--accent,var(--outlier,currentColor))}" +
        "#rtm-reading-progress::-moz-progress-bar{background:var(--accent,var(--outlier,currentColor))}" +
        ".skip-link{position:absolute;left:-9999px;top:0;z-index:80}" +
        ".skip-link:focus,.skip-link:focus-visible{left:8px;top:8px;padding:8px 12px}";
      document.head.insertBefore(s, document.head.firstChild);
    }

    /* reading progress, inserted first so the skip link ends up ahead of it */
    bar = RTM.q("[data-reading-progress]") || document.getElementById("rtm-reading-progress");
    if (!bar) {
      bar = document.createElement("progress");
      bar.id = "rtm-reading-progress";
      bar.max = 1000;
      bar.value = 0;
      document.body.insertBefore(bar, document.body.firstChild);
    }
    bar.setAttribute("aria-label", "Reading progress");
    updateReadingBar();

    /* skip link: the first thing in the document and the first tab stop */
    var target = RTM.q("main") || document.getElementById("main") || RTM.q("[data-scene]");
    if (target) {
      if (!target.id) target.id = "rtm-main";
      if (!target.hasAttribute("tabindex")) target.setAttribute("tabindex", "-1");
      if (!RTM.q(".skip-link")) {
        var a = document.createElement("a");
        a.className = "skip-link";
        a.href = "#" + target.id;
        a.textContent = "Skip to the story";
        document.body.insertBefore(a, document.body.firstChild);
      }
    }
  }

  /* =========================================================================
     9 · GO
     ====================================================================== */
  function start() {
    installChrome();
    /* Theme first: a scene that draws before the theme is settled reads the
       wrong tokens and has to be redrawn a frame later for nothing. */
    installTheme();
    installTextures();
    mountAll();
    fillNums();
    try { fillSources(); } catch (e) { warn("source list failed to build", e); }
    installReveals();
    watchTracks();

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", function () {
      onScroll();
      queueRedraw();
    }, { passive: true });
    window.addEventListener("orientationchange", function () { queueRedraw(); });
    /* Teardown. A sweep still on the shared ticker when the page goes away is a
       leak, and on a bfcache restore it would resume mid sentence. */
    window.addEventListener("pagehide", cancelSweeps);
    onScroll();

    window.RTM_BOOT = {
      mounts: MOUNTS,
      redraw: redrawAll,
      nums: function () { return window.RTM_NUMS; },
      revealAll: window.RTM_REVEAL_ALL
    };

    /* Two beats: one for the first draw to land, one for layout to settle. */
    soon(function () {
      soon(function () {
        var ok = MOUNTS.filter(function (r) { return r.drawn; }).length;
        console.log("[boot] " + ok + " of " + MOUNTS.length + " scenes drew on first paint");
        window.RTM_READY = true;
        try {
          var ev = new CustomEvent("rtm:ready", { detail: { scenes: MOUNTS.length, drawn: ok } });
          document.dispatchEvent(ev);
          window.dispatchEvent(ev);
        } catch (e) { warn("could not dispatch rtm:ready", e); }
      });
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
