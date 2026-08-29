/* ============================================================================
   RTM CORE  ·  the contract every scene module codes against.
   No dependencies. No em-dashes in any user-visible string, ever.
   ========================================================================== */
var RTM = (function () {
  "use strict";

  /* ── DOM / SVG ─────────────────────────────────────────────────────────── */
  var SVGNS = "http://www.w3.org/2000/svg";
  var XHTML = "http://www.w3.org/1999/xhtml";

  function el(name, attrs, parent) {
    var n = document.createElementNS(SVGNS, name);
    if (attrs) for (var k in attrs) {
      var v = attrs[k];
      if (v !== null && v !== undefined && v !== false) n.setAttribute(k, v);
    }
    if (parent) parent.appendChild(n);
    return n;
  }
  function h(name, attrs, parent) {
    var n = document.createElement(name);
    if (attrs) for (var k in attrs) {
      if (k === "class") n.className = attrs[k];
      else if (k === "text") n.textContent = attrs[k];
      else if (k === "html") n.innerHTML = attrs[k];
      else if (k.slice(0, 2) === "on") n.addEventListener(k.slice(2), attrs[k]);
      else if (attrs[k] !== null && attrs[k] !== undefined && attrs[k] !== false) n.setAttribute(k, attrs[k]);
    }
    if (parent) parent.appendChild(n);
    return n;
  }
  function clear(n) { while (n && n.firstChild) n.removeChild(n.firstChild); return n; }
  function q(sel, root) { return (root || document).querySelector(sel); }
  function qa(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  /* Read a design token. Re-read on every draw so theme flips are free. */
  var _tokenCache = {}, _tokenGen = 0;
  function css(name) {
    var key = _tokenGen + "|" + name;
    if (key in _tokenCache) return _tokenCache[key];
    var v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    _tokenCache[key] = v;
    return v;
  }
  function bustTokens() { _tokenGen++; _tokenCache = {}; }

  /* ── Label layer ───────────────────────────────────────────────────────────
     Every label goes into one <g class="labels"> that is re-appended last on
     each draw, so a rule drawn later can never paint across a label. The halo
     carves each glyph out of whatever runs behind it.                        */
  function halo(width) {
    return { "paint-order": "stroke", stroke: css("--paper"),
             "stroke-width": width || 3.5, "stroke-linejoin": "round" };
  }
  function txt(svg, attrs, content, haloed) {
    var a = {};
    if (haloed) { var hh = halo(typeof haloed === "number" ? haloed : 3.5); for (var k in hh) a[k] = hh[k]; }
    for (var j in attrs) a[j] = attrs[j];
    var t = el("text", a);
    if (content !== null && content !== undefined) t.textContent = content;
    var g = svg.querySelector(":scope > g.labels");
    if (!g) { g = el("g", { class: "labels" }); svg.appendChild(g); }
    g.appendChild(t);
    return t;
  }
  /* Multi-line label. lines = [{text, dy, size, weight, fill, family}] */
  function txtBlock(svg, x, y, anchor, lines, haloed) {
    var out = [];
    var cy = y;
    for (var i = 0; i < lines.length; i++) {
      var L = lines[i];
      out.push(txt(svg, {
        x: x, y: cy, "text-anchor": anchor || "middle",
        fill: L.fill || css("--ink"),
        "font-family": L.family || css("--sans"),
        "font-size": L.size || 12,
        "font-weight": L.weight || 400,
        "letter-spacing": L.tracking || null
      }, L.text, haloed === undefined ? true : haloed));
      cy += (L.dy !== undefined ? L.dy : (L.size || 12) + 4);
    }
    return out;
  }
  function hoist(svg) {
    var g = svg.querySelector(":scope > g.labels");
    if (g) svg.appendChild(g);
  }

  /* ── Scales ────────────────────────────────────────────────────────────── */
  function linear(d0, d1, r0, r1) {
    var f = function (v) { return r0 + ((v - d0) / (d1 - d0)) * (r1 - r0); };
    f.invert = function (p) { return d0 + ((p - r0) / (r1 - r0)) * (d1 - d0); };
    f.domain = [d0, d1]; f.range = [r0, r1];
    f.clamped = function (v) { return f(Math.max(Math.min(v, Math.max(d0, d1)), Math.min(d0, d1))); };
    return f;
  }
  function band(items, r0, r1, padInner) {
    padInner = padInner === undefined ? 0.2 : padInner;
    var n = items.length;
    var step = (r1 - r0) / Math.max(n, 1);
    var bw = step * (1 - padInner);
    var idx = {};
    items.forEach(function (d, i) { idx[d] = i; });
    var f = function (v) { return r0 + idx[v] * step + (step - bw) / 2; };
    f.bandwidth = bw; f.step = step; f.center = function (v) { return f(v) + bw / 2; };
    return f;
  }
  function ticks(d0, d1, count) {
    var span = d1 - d0, step = Math.pow(10, Math.floor(Math.log(span / count) / Math.LN10));
    var err = (span / count) / step;
    if (err >= 7.5) step *= 10; else if (err >= 3.5) step *= 5; else if (err >= 1.5) step *= 2;
    var out = [], v = Math.ceil(d0 / step) * step;
    for (; v <= d1 + 1e-9; v += step) out.push(Math.round(v / step) * step);
    return out;
  }
  function extent(arr, acc) {
    var lo = Infinity, hi = -Infinity;
    for (var i = 0; i < arr.length; i++) {
      var v = acc ? acc(arr[i], i) : arr[i];
      if (v < lo) lo = v; if (v > hi) hi = v;
    }
    return [lo, hi];
  }

  /* ── Maths / statistics ────────────────────────────────────────────────── */
  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function mean(a) { var s = 0; for (var i = 0; i < a.length; i++) s += a[i]; return s / a.length; }
  function sd(a) {
    var m = mean(a), s = 0;
    for (var i = 0; i < a.length; i++) s += (a[i] - m) * (a[i] - m);
    return Math.sqrt(s / (a.length - 1));
  }
  function normPdf(v, mu, s) {
    var z = (v - mu) / s;
    return Math.exp(-0.5 * z * z) / (s * Math.sqrt(2 * Math.PI));
  }
  /* Abramowitz & Stegun 7.1.26. Plenty for a percentile. */
  function erf(x) {
    var s = x < 0 ? -1 : 1; x = Math.abs(x);
    var t = 1 / (1 + 0.3275911 * x);
    var y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t
      - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
    return s * y;
  }
  function Phi(z) { return 0.5 * (1 + erf(z / Math.SQRT2)); }
  /* Acklam's inverse normal CDF, refined once by Halley. */
  function probit(p) {
    if (p <= 0) return -Infinity; if (p >= 1) return Infinity;
    var a = [-3.969683028665376e+01, 2.209460984245205e+02, -2.759285104469687e+02,
             1.383577518672690e+02, -3.066479806614716e+01, 2.506628277459239e+00];
    var b = [-5.447609879822406e+01, 1.615858368580409e+02, -1.556989798598866e+02,
             6.680131188771972e+01, -1.328068155288572e+01];
    var c = [-7.784894002430293e-03, -3.223964580411365e-01, -2.400758277161838e+00,
             -2.549732539343734e+00, 4.374664141464968e+00, 2.938163982698783e+00];
    var d = [7.784695709041462e-03, 3.224671290700398e-01, 2.445134137142996e+00,
             3.754408661907416e+00];
    var pl = 0.02425, x;
    if (p < pl) {
      var qq = Math.sqrt(-2 * Math.log(p));
      x = (((((c[0]*qq+c[1])*qq+c[2])*qq+c[3])*qq+c[4])*qq+c[5]) /
          ((((d[0]*qq+d[1])*qq+d[2])*qq+d[3])*qq+1);
    } else if (p <= 1 - pl) {
      var qm = p - 0.5, r = qm * qm;
      x = (((((a[0]*r+a[1])*r+a[2])*r+a[3])*r+a[4])*r+a[5])*qm /
          (((((b[0]*r+b[1])*r+b[2])*r+b[3])*r+b[4])*r+1);
    } else {
      var qh = Math.sqrt(-2 * Math.log(1 - p));
      x = -(((((c[0]*qh+c[1])*qh+c[2])*qh+c[3])*qh+c[4])*qh+c[5]) /
          ((((d[0]*qh+d[1])*qh+d[2])*qh+d[3])*qh+1);
    }
    var e = Phi(x) - p, u = e * Math.sqrt(2 * Math.PI) * Math.exp(x * x / 2);
    return x - u / (1 + x * u / 2);
  }
  /* Ordinary least squares on weighted (x, y, w) triples. */
  function ols(rows, gx, gy, gw) {
    var n = 0, sx = 0, sy = 0, sxy = 0, sxx = 0, syy = 0;
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i], x = gx(r), y = gy(r), w = gw ? gw(r) : 1;
      n += w; sx += x * w; sy += y * w; sxy += x * y * w; sxx += x * x * w; syy += y * y * w;
    }
    var mx = sx / n, my = sy / n;
    var cov = sxy - n * mx * my, vx = sxx - n * mx * mx, vy = syy - n * my * my;
    var slope = cov / vx;
    return { n: n, mx: mx, my: my, slope: slope, intercept: my - slope * mx,
             r: cov / Math.sqrt(vx * vy) };
  }

  /* ── Deterministic randomness ──────────────────────────────────────────────
     Never Math.random(). These dots are evidence, not decoration: the same
     seed must produce the same picture on every reload and every screenshot. */
  function hashUnit(seed) {
    var t = (seed + 0x6d2b79f5) | 0;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  function rng(seed) {
    var s = (seed | 0) || 1;
    var f = function () { s = (s + 0x6d2b79f5) | 0; return hashUnit(s); };
    f.range = function (lo, hi) { return lo + f() * (hi - lo); };
    f.normal = function (mu, sig) { return (mu || 0) + (sig === undefined ? 1 : sig) * probit(clamp(f(), 1e-6, 1 - 1e-6)); };
    f.pick = function (a) { return a[Math.floor(f() * a.length)]; };
    return f;
  }

  /* ── Formatting ────────────────────────────────────────────────────────────
     PRIME (″) and FEET (′) marks, not straight quotes. No em-dashes anywhere. */
  function fmtFt(inches, opts) {
    var ft = Math.floor(inches / 12);
    var r = Math.round((inches - ft * 12) * 10) / 10;
    if (r >= 12) { ft += 1; r = 0; }
    if (opts && opts.prose) return ft + " ft " + r.toFixed(1) + " in";
    return ft + "′ " + r.toFixed(1) + "″";
  }
  function sigma(z, dp) { return (z >= 0 ? "+" : "−") + Math.abs(z).toFixed(dp === undefined ? 2 : dp) + "σ"; }
  function pct(v, dp) { return (v * 100).toFixed(dp === undefined ? 0 : dp) + "%"; }
  function num(v, dp) {
    return Number(v).toLocaleString("en-US", { minimumFractionDigits: dp || 0, maximumFractionDigits: dp || 0 });
  }
  function ordinalSuffix(n) {
    var s = ["th", "st", "nd", "rd"], v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  }
  /* "one in 3,400" from a right-tail probability. */
  function oneIn(p) {
    var n = 1 / p;
    var mag = Math.pow(10, Math.max(0, Math.floor(Math.log(n) / Math.LN10) - 1));
    return "one in " + num(Math.round(n / mag) * mag);
  }

  /* ── Canvas ────────────────────────────────────────────────────────────────
     Backing store in device pixels, CSS box in CSS pixels, then scale once.
     Miss this and everything is soft on the screens most people actually use. */
  function fitCanvas(canvas, w, h) {
    var dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.width = w + "px";
    canvas.style.height = h + "px";
    var ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return ctx;
  }

  /* ── Shared rAF ticker ─────────────────────────────────────────────────────
     One loop for the whole page. Scenes subscribe and unsubscribe; nothing
     runs when nothing is subscribed, so a parked tab costs nothing.          */
  var _ticks = [], _raf = null, _last = 0;
  function _loop(now) {
    var dt = Math.min((now - _last) / 1000, 1 / 20);
    _last = now;
    for (var i = _ticks.length - 1; i >= 0; i--) {
      try { _ticks[i](dt, now); } catch (e) { console.error("[tick]", e); }
    }
    _raf = _ticks.length ? requestAnimationFrame(_loop) : null;
  }
  function onTick(fn) {
    _ticks.push(fn);
    if (!_raf) { _last = performance.now(); _raf = requestAnimationFrame(_loop); }
    return function () {
      var i = _ticks.indexOf(fn);
      if (i >= 0) _ticks.splice(i, 1);
      if (!_ticks.length && _raf) { cancelAnimationFrame(_raf); _raf = null; }
    };
  }

  /* ── Preferences ───────────────────────────────────────────────────────── */
  var _reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
  function reducedMotion() { return _reduced.matches || document.documentElement.hasAttribute("data-still"); }

  /* ── Scene registry ────────────────────────────────────────────────────────
     Every scene module calls RTM.scene(id, factory). The factory receives the
     mount element and returns:
        { draw(w, h), progress(t), destroy(), pause(), resume() }
     Only draw() is required. progress(t) is called with 0..1 while the scene's
     scrolly track is in view. Everything else is optional.                    */
  var _scenes = {}, _live = {};
  function scene(id, factory) { _scenes[id] = factory; }
  function boot(id, mountEl) {
    if (!_scenes[id]) { console.warn("[rtm] no scene", id); return null; }
    if (_live[id] && _live[id].destroy) _live[id].destroy();
    var inst = _scenes[id](mountEl) || {};
    inst._mount = mountEl;
    _live[id] = inst;
    return inst;
  }
  function live(id) { return _live[id]; }
  function allLive() { return _live; }

  /* ── Responsive helper ─────────────────────────────────────────────────────
     A shrinking viewBox shrinks the type with it. Layout is chosen from the
     MEASURED container width, not the window, and a narrow layout is a
     different chart rather than a scaled one.                                */
  function widthOf(node) {
    var r = node.getBoundingClientRect();
    return r.width || node.clientWidth || 640;
  }
  function bp(w) { return w < 560 ? "s" : w < 900 ? "m" : "l"; }
  function pick(w, opts) { return opts[bp(w)] !== undefined ? opts[bp(w)] : opts.l; }

  /* Debounced, deduped resize. Fires with the new measured width. */
  function onResize(node, fn) {
    var last = -1, t = null;
    function run() {
      var w = Math.round(widthOf(node));
      if (w === last || w < 2) return;
      last = w;
      fn(w);
    }
    var ro = new ResizeObserver(function () {
      clearTimeout(t);
      t = setTimeout(run, 90);
    });
    ro.observe(node);
    run();
    return function () { ro.disconnect(); clearTimeout(t); };
  }

  return {
    SVGNS: SVGNS, XHTML: XHTML,
    el: el, h: h, clear: clear, q: q, qa: qa,
    css: css, bustTokens: bustTokens,
    halo: halo, txt: txt, txtBlock: txtBlock, hoist: hoist,
    linear: linear, band: band, ticks: ticks, extent: extent,
    clamp: clamp, lerp: lerp, mean: mean, sd: sd,
    normPdf: normPdf, erf: erf, Phi: Phi, probit: probit, ols: ols,
    hashUnit: hashUnit, rng: rng,
    fmtFt: fmtFt, sigma: sigma, pct: pct, num: num, oneIn: oneIn, ordinalSuffix: ordinalSuffix,
    fitCanvas: fitCanvas, onTick: onTick, reducedMotion: reducedMotion,
    scene: scene, boot: boot, live: live, allLive: allLive,
    widthOf: widthOf, bp: bp, pick: pick, onResize: onResize
  };
})();
