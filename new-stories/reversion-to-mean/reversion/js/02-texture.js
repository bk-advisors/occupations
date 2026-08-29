/* ============================================================================
   RTM.tex  ·  TEXTURE
   ----------------------------------------------------------------------------
   One hidden <svg id="rtm-defs"> holding every reusable filter, pattern and
   gradient on the page, plus one fixed full page grain overlay. Scenes never
   build their own defs: they reference these by id.

       RTM.tex.install()                idempotent, safe to call any time
       RTM.tex.url("grain")             -> "url(#rtm-grain)"
       RTM.tex.hatch(angle, density, color) -> a pattern id, created on demand
       RTM.tex.hatchUrl(...)            -> the same wrapped in url(#...)
       RTM.tex.halftone(dot, gap, color)-> a dot pattern id
       RTM.tex.bleed(strength)          -> an ink bleed filter id
       RTM.tex.refresh()                rebuild after a theme flip

   COLOURS
   No hex appears in this file. Everything is read from a token with RTM.css().
   Pass token names ("--outlier") rather than resolved colours to hatch() and
   halftone(): a spec built from a token name re-resolves itself on refresh(),
   so it follows a theme flip. A literal colour will not.

   COST
   SVG filters rasterise the whole filter region on every repaint of the
   filtered node. Rules of thumb used here, and worth keeping:
     - grain      cheap. The turbulence runs once over a 320px tile and the
                  tile is repeated by a <pattern>. Never filter the viewport
                  directly: that is a full screen turbulence on every resize.
     - bleed      safe on static rules, axes, annotation leaders, hand drawn
                  frames. Never on a node whose geometry changes every frame.
     - shadow     safe on a handful of raised chips. Not on 900 scatter dots.
     - hatch,
       halftone,
       grid,
       vignette   plain paint. No filter at all, so they are free and may go
                  on anything, including animating marks.
   ========================================================================== */

RTM.tex = (function () {
  "use strict";

  var NS = RTM.SVGNS;
  var PREFIX = "rtm-";

  var carrier = null;   /* <svg id="rtm-defs">   */
  var defs = null;      /* <defs> inside it      */
  var grainLayer = null;
  var specs = [];       /* everything we built, so refresh() can rebuild it  */
  var index = {};       /* cache key -> id                                   */
  var seq = 0;

  /* Resolve "--token" through RTM.css, pass anything else straight through. */
  function tone(c, fallbackToken) {
    if (!c) c = fallbackToken;
    if (typeof c === "string" && c.slice(0, 2) === "--") {
      return RTM.css(c) || RTM.css("--ink-3");
    }
    return c;
  }
  function numTok(token, fallback) {
    var v = parseFloat(RTM.css(token));
    return isFinite(v) ? v : fallback;
  }

  function url(id) {
    install();
    if (!id) return "none";
    if (id.slice(0, PREFIX.length) !== PREFIX) id = PREFIX + id;
    return "url(#" + id + ")";
  }

  /* ── Builders ────────────────────────────────────────────────────────────
     Each builder is a pure function of its args plus the current tokens, so
     refresh() can throw the old node away and run the builder again.       */

  var BUILD = {};

  /* Paper grain.
     fractalNoise flattened to neutral grey with a fixed alpha, then amplified
     around the 0.5 midpoint by the colour matrix. The overlay blends with
     soft-light, and a neutral grey under soft-light lightens and darkens by
     the same amount, so the grain adds no tint in either theme. That only
     holds in sRGB: without color-interpolation-filters the midpoint shifts in
     linearRGB and the whole page goes muddy. */
  BUILD.grain = function (id, a) {
    var f = RTM.el("filter", {
      id: id, x: "0%", y: "0%", width: "100%", height: "100%",
      "color-interpolation-filters": "sRGB"
    }, defs);
    RTM.el("feTurbulence", {
      type: "fractalNoise", baseFrequency: a.freq, numOctaves: 4,
      seed: 7, stitchTiles: "stitch", result: "n"
    }, f);
    RTM.el("feColorMatrix", {
      type: "matrix",
      values: [
        "0.55 0.55 0.55 0 -0.32",
        "0.55 0.55 0.55 0 -0.32",
        "0.55 0.55 0.55 0 -0.32",
        "0 0 0 0 1"
      ].join(" ")
    }, f);
    return f;
  };

  /* The grain, packed into a repeatable tile so the turbulence only ever runs
     over TILE x TILE pixels no matter how tall the page gets. */
  BUILD.grainTile = function (id, a) {
    var p = RTM.el("pattern", {
      id: id, patternUnits: "userSpaceOnUse",
      width: a.tile, height: a.tile
    }, defs);
    RTM.el("rect", {
      width: a.tile, height: a.tile,
      fill: "currentColor", filter: "url(#" + PREFIX + "grain)"
    }, p);
    return p;
  };

  /* Ink bleed. A low frequency warp field displacing the source, at a scale
     of about one user unit. On a straight rule it reads as a pen that was
     not quite steady. Above scale 3 it reads as a mistake. */
  BUILD.bleed = function (id, a) {
    var f = RTM.el("filter", {
      id: id, x: "-14%", y: "-14%", width: "128%", height: "128%",
      "color-interpolation-filters": "sRGB",
      primitiveUnits: "userSpaceOnUse"
    }, defs);
    RTM.el("feTurbulence", {
      type: "fractalNoise", baseFrequency: a.freq, numOctaves: 2,
      seed: a.seed, result: "warp"
    }, f);
    RTM.el("feDisplacementMap", {
      in: "SourceGraphic", in2: "warp", scale: a.scale,
      xChannelSelector: "R", yChannelSelector: "G"
    }, f);
    return f;
  };

  /* Hatching. The redundant encoding that keeps a filled region readable in
     greyscale and for a colour blind reader. Angle in degrees, density is the
     spacing between lines in user units. Two regions should differ by angle
     first and density second, never by colour alone. */
  BUILD.hatch = function (id, a) {
    var d = a.density;
    var p = RTM.el("pattern", {
      id: id, patternUnits: "userSpaceOnUse",
      width: d, height: d,
      patternTransform: "rotate(" + a.angle + ")"
    }, defs);
    RTM.el("line", {
      x1: 0, y1: 0, x2: 0, y2: d,
      stroke: tone(a.color, "--ink-3"),
      "stroke-width": a.weight,
      "stroke-opacity": a.opacity,
      "stroke-linecap": "square"
    }, p);
    return p;
  };

  /* Cross hatch, for the one region that has to be darker than every other. */
  BUILD.cross = function (id, a) {
    var d = a.density;
    var p = RTM.el("pattern", {
      id: id, patternUnits: "userSpaceOnUse",
      width: d, height: d,
      patternTransform: "rotate(" + a.angle + ")"
    }, defs);
    var attrs = {
      stroke: tone(a.color, "--ink-3"),
      "stroke-width": a.weight,
      "stroke-opacity": a.opacity
    };
    RTM.el("line", { x1: 0, y1: 0, x2: 0, y2: d, stroke: attrs.stroke,
      "stroke-width": attrs["stroke-width"], "stroke-opacity": attrs["stroke-opacity"] }, p);
    RTM.el("line", { x1: 0, y1: 0, x2: d, y2: 0, stroke: attrs.stroke,
      "stroke-width": attrs["stroke-width"], "stroke-opacity": attrs["stroke-opacity"] }, p);
    return p;
  };

  /* Halftone. A staggered dot lattice for a density region: the size of the
     dot reads as weight without spending a second hue on it. Dots are placed
     at the four corners and the centre so the tile joins seamlessly. */
  BUILD.halftone = function (id, a) {
    var g = a.gap, r = a.dot;
    var p = RTM.el("pattern", {
      id: id, patternUnits: "userSpaceOnUse", width: g, height: g
    }, defs);
    var fill = tone(a.color, "--ink-3");
    var pts = [[0, 0], [g, 0], [0, g], [g, g], [g / 2, g / 2]];
    for (var i = 0; i < pts.length; i++) {
      RTM.el("circle", {
        cx: pts[i][0], cy: pts[i][1], r: r,
        fill: fill, "fill-opacity": a.opacity
      }, p);
    }
    return p;
  };

  /* Graph paper. A fine pattern nested inside a coarse one, both drawn in the
     rule tokens so they sit just above the paper and never compete with the
     data. Use as a rect fill behind a plot area. */
  BUILD.gridFine = function (id, a) {
    var p = RTM.el("pattern", {
      id: id, patternUnits: "userSpaceOnUse", width: a.minor, height: a.minor
    }, defs);
    RTM.el("path", {
      d: "M " + a.minor + " 0 L 0 0 0 " + a.minor,
      fill: "none",
      stroke: RTM.css("--rule-soft"),
      "stroke-width": 1
    }, p);
    return p;
  };
  BUILD.grid = function (id, a) {
    var p = RTM.el("pattern", {
      id: id, patternUnits: "userSpaceOnUse", width: a.major, height: a.major
    }, defs);
    RTM.el("rect", {
      width: a.major, height: a.major,
      fill: "url(#" + PREFIX + "grid-fine)"
    }, p);
    RTM.el("path", {
      d: "M " + a.major + " 0 L 0 0 0 " + a.major,
      fill: "none",
      stroke: RTM.css("--rule"),
      "stroke-width": 1
    }, p);
    return p;
  };

  /* Radial vignette. Paints in --vignette-col, which is dark in both themes,
     so it always darkens. Fill a rect with it over a chart background, or use
     it as the fixed page overlay via the .rtm-vignette class. */
  BUILD.vignette = function (id, a) {
    var g = RTM.el("radialGradient", {
      id: id, cx: "50%", cy: "48%", r: "72%"
    }, defs);
    var col = RTM.css("--vignette-col") || RTM.css("--ink");
    RTM.el("stop", { offset: "0%", "stop-color": col, "stop-opacity": 0 }, g);
    RTM.el("stop", { offset: "58%", "stop-color": col, "stop-opacity": 0 }, g);
    RTM.el("stop", { offset: "82%", "stop-color": col, "stop-opacity": a.mid }, g);
    RTM.el("stop", { offset: "100%", "stop-color": col, "stop-opacity": 1 }, g);
    return g;
  };

  /* Soft drop shadow, for a raised chip, a focused mark, the edge of the
     sticky graphic. A handful of nodes at a time, never a whole scatter. */
  BUILD.shadow = function (id, a) {
    var f = RTM.el("filter", {
      id: id, x: "-30%", y: "-30%", width: "160%", height: "160%",
      "color-interpolation-filters": "sRGB"
    }, defs);
    RTM.el("feDropShadow", {
      dx: 0, dy: a.dy, stdDeviation: a.blur,
      "flood-color": RTM.css("--ink"), "flood-opacity": a.op
    }, f);
    return f;
  };

  /* Letterpress. One paper coloured shadow a hair below the glyph, so type or
     a chip looks stamped into the page rather than floating over it. Cheap,
     but it is still a filter: reserve it for headline marks. */
  BUILD.press = function (id) {
    var f = RTM.el("filter", {
      id: id, x: "-12%", y: "-12%", width: "124%", height: "124%",
      "color-interpolation-filters": "sRGB"
    }, defs);
    RTM.el("feDropShadow", {
      dx: 0, dy: 0.9, stdDeviation: 0.35,
      "flood-color": RTM.css("--paper"), "flood-opacity": 0.9
    }, f);
    return f;
  };

  /* ── Registration ───────────────────────────────────────────────────────
     A spec is {id, kind, args}. Building the page means running them all in
     order; refreshing means clearing <defs> and running them all again with
     the tokens that are current at that moment.                            */
  function add(id, kind, args) {
    var s = { id: PREFIX + id, kind: kind, args: args || {} };
    specs.push(s);
    if (defs) BUILD[kind](s.id, s.args);
    return s.id;
  }

  function base() {
    add("grain", "grain", { freq: 0.72 });
    add("grain-tile", "grainTile", { tile: 320 });

    add("bleed", "bleed", { freq: 0.045, scale: numTok("--bleed", 1.1), seed: 11 });
    add("bleed-soft", "bleed", { freq: 0.03, scale: 0.6, seed: 4 });
    add("bleed-strong", "bleed", { freq: 0.06, scale: 2.2, seed: 23 });

    add("grid-fine", "gridFine", { minor: 8 });
    add("grid", "grid", { major: 40 });

    add("vignette", "vignette", { mid: 0.42 });

    add("shadow", "shadow", { dy: 1.4, blur: 1.8, op: 0.22 });
    add("shadow-lg", "shadow", { dy: 4, blur: 7, op: 0.20 });
    add("press", "press", {});

    /* Named hatches, one per role. Built from token names so a theme flip
       re-resolves them. Angles are 40 degrees apart, which is the smallest
       separation that still reads at a glance in a small legend swatch. */
    var op = numTok("--tex-op", 0.34);
    reg("hatch-outlier",  "hatch", { angle: 45,  density: 5, weight: 1.6, color: "--outlier",  opacity: op });
    reg("hatch-mean",     "hatch", { angle: -45, density: 5, weight: 1.6, color: "--mean",     opacity: op });
    reg("hatch-muted",    "hatch", { angle: 90,  density: 6, weight: 1.2, color: "--ink-3",    opacity: op });
    reg("hatch-sport",    "hatch", { angle: 0,   density: 5, weight: 1.6, color: "--sport",    opacity: op });
    reg("hatch-politics", "hatch", { angle: 60,  density: 5, weight: 1.6, color: "--politics", opacity: op });
    reg("hatch-business", "hatch", { angle: 120, density: 5, weight: 1.6, color: "--business", opacity: op });
    reg("hatch-dense",    "hatch", { angle: 45,  density: 3, weight: 1.2, color: "--ink-3",    opacity: op });
    reg("cross-outlier",  "cross", { angle: 45,  density: 6, weight: 1.1, color: "--outlier",  opacity: op });

    reg("halftone",       "halftone", { dot: 1.1, gap: 7, color: "--ink-3",   opacity: op });
    reg("halftone-out",   "halftone", { dot: 1.4, gap: 6, color: "--outlier", opacity: op });
    reg("halftone-mean",  "halftone", { dot: 1.4, gap: 6, color: "--mean",    opacity: op });
  }

  /* Register under a stable id AND under its argument signature, so a later
     hatch(45, 5, "--outlier") hands back the prebuilt one instead of a
     duplicate. */
  function reg(id, kind, args) {
    var full = add(id, kind, args);
    index[key(kind, args)] = full;
    return full;
  }
  function key(kind, a) {
    return kind + "|" + (a.angle || 0) + "|" + (a.density || a.gap || 0) + "|" +
           (a.dot || 0) + "|" + (a.weight || 0) + "|" + (a.color || "") + "|" +
           (a.scale || 0);
  }

  /* ── Public creators ───────────────────────────────────────────────────── */

  /* Returns a pattern id. Wrap it yourself with RTM.tex.url(id), or call
     hatchUrl() and skip a step. angle in degrees, density in user units. */
  function hatch(angle, density, color) {
    install();
    var args = {
      angle: angle === undefined ? 45 : angle,
      density: density || 5,
      weight: (density || 5) < 4 ? 1.1 : 1.6,
      color: color || "--ink-3",
      opacity: numTok("--tex-op", 0.34)
    };
    var k = key("hatch", args);
    if (index[k]) return index[k];
    return reg("hatch-" + (++seq), "hatch", args);
  }
  function hatchUrl(angle, density, color) { return url(hatch(angle, density, color)); }

  function halftone(dot, gap, color) {
    install();
    var args = {
      dot: dot || 1.2, gap: gap || 7,
      color: color || "--ink-3",
      opacity: numTok("--tex-op", 0.34)
    };
    var k = key("halftone", args);
    if (index[k]) return index[k];
    return reg("halftone-" + (++seq), "halftone", args);
  }
  function halftoneUrl(dot, gap, color) { return url(halftone(dot, gap, color)); }

  /* Ink bleed at an arbitrary strength, in user units of displacement. */
  function bleed(strength) {
    install();
    var s = Math.round((strength === undefined ? numTok("--bleed", 1.1) : strength) * 10) / 10;
    var args = { freq: 0.045, scale: s, seed: 11 };
    var k = key("bleed", args);
    if (index[k]) return index[k];
    return reg("bleed-" + (++seq), "bleed", args);
  }
  function bleedUrl(strength) { return url(bleed(strength)); }

  /* ── Install / refresh ─────────────────────────────────────────────────── */

  function build() {
    RTM.clear(defs);
    for (var i = 0; i < specs.length; i++) {
      BUILD[specs[i].kind](specs[i].id, specs[i].args);
    }
  }

  var installed = false;
  function install() {
    if (installed && carrier && carrier.parentNode) return;
    if (!document.body) return;              /* boot calls again on DOM ready */

    var existing = document.getElementById("rtm-defs");
    if (existing && existing.parentNode) existing.parentNode.removeChild(existing);

    carrier = RTM.el("svg", {
      id: "rtm-defs", width: 0, height: 0,
      "aria-hidden": "true", focusable: "false"
    });
    defs = RTM.el("defs", null, carrier);
    document.body.appendChild(carrier);

    if (!specs.length) base(); else { /* re-entry after a teardown */ }
    build();

    installGrain();
    installed = true;
  }

  /* The full page grain. A div so it can carry mix-blend-mode from CSS, and
     an svg inside it filled with the repeating grain tile. Nothing here is
     interactive and nothing is announced. */
  function installGrain() {
    var old = document.querySelector(".rtm-grain");
    if (old && old.parentNode) old.parentNode.removeChild(old);

    grainLayer = RTM.h("div", { class: "rtm-grain", "aria-hidden": "true" });
    var svg = RTM.el("svg", {
      width: "100%", height: "100%", preserveAspectRatio: "none",
      "aria-hidden": "true", focusable: "false"
    }, grainLayer);
    svg.style.width = "100%";
    svg.style.height = "100%";
    RTM.el("rect", {
      width: "100%", height: "100%",
      fill: "url(#" + PREFIX + "grain-tile)"
    }, svg);
    document.body.appendChild(grainLayer);
  }

  /* Called by boot after RTM.bustTokens() on a theme flip. Ids are preserved,
     so anything already referencing url(#rtm-hatch-outlier) keeps working and
     simply repaints in the new palette. */
  function refresh() {
    if (!defs) { install(); return; }
    build();
    /* Rebuilt defs keep their ids, but re-creating the overlay guarantees the
       grain repaints in the new theme rather than holding a stale raster. */
    installGrain();
  }

  /* Boot may run before <body> exists in some embeds. */
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () { install(); });
  }

  return {
    install: install,
    refresh: refresh,
    url: url,
    hatch: hatch,
    hatchUrl: hatchUrl,
    halftone: halftone,
    halftoneUrl: halftoneUrl,
    bleed: bleed,
    bleedUrl: bleedUrl,
    /* Every prebuilt id, for anything that wants to enumerate them. */
    names: function () {
      var out = [];
      for (var i = 0; i < specs.length; i++) out.push(specs[i].id);
      return out;
    }
  };
})();
