/* ============================================================================
   RTM MOTION  ·  tweens, springs, staggers, interpolators.
   Every animation here is interruptible and reduced-motion aware. A tween that
   cannot be interrupted will eventually fight a scroll event and lose.
   ========================================================================== */
RTM.motion = (function () {
  "use strict";

  var core = RTM;

  /* ── Easings ───────────────────────────────────────────────────────────────
     cubicOut for entrances, cubicInOut for state changes, expoOut for anything
     that should feel like it is settling rather than arriving.               */
  var ease = {
    linear: function (t) { return t; },
    quadOut: function (t) { return t * (2 - t); },
    cubicIn: function (t) { return t * t * t; },
    cubicOut: function (t) { return (--t) * t * t + 1; },
    cubicInOut: function (t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; },
    quartOut: function (t) { return 1 - Math.pow(1 - t, 4); },
    expoOut: function (t) { return t === 1 ? 1 : 1 - Math.pow(2, -10 * t); },
    expoInOut: function (t) {
      return t === 0 ? 0 : t === 1 ? 1 : t < 0.5
        ? Math.pow(2, 20 * t - 10) / 2
        : (2 - Math.pow(2, -20 * t + 10)) / 2;
    },
    backOut: function (t) { var c = 1.70158; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); },
    elasticOut: function (t) {
      var c = (2 * Math.PI) / 3;
      return t === 0 ? 0 : t === 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c) + 1;
    },
    /* Settles without the cartoon overshoot of backOut. Good for markers. */
    softBack: function (t) { var c = 0.72; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); }
  };

  /* ── Tween ─────────────────────────────────────────────────────────────────
     tween({ from, to, dur, delay, ease, onUpdate, onDone })
     from/to are numbers, arrays of numbers, or flat objects of numbers.
     Returns a handle with .cancel() and .finish().                            */
  function interpolate(a, b) {
    if (typeof a === "number") return function (t) { return a + (b - a) * t; };
    if (Array.isArray(a)) {
      return function (t) {
        var o = new Array(a.length);
        for (var i = 0; i < a.length; i++) o[i] = a[i] + (b[i] - a[i]) * t;
        return o;
      };
    }
    var keys = Object.keys(b);
    return function (t) {
      var o = {};
      for (var i = 0; i < keys.length; i++) {
        var k = keys[i];
        o[k] = typeof b[k] === "number" ? (a[k] || 0) + (b[k] - (a[k] || 0)) * t : b[k];
      }
      return o;
    };
  }

  function tween(opts) {
    var dur = opts.dur === undefined ? 600 : opts.dur;
    var delay = opts.delay || 0;
    var fn = typeof opts.ease === "function" ? opts.ease : (ease[opts.ease] || ease.cubicOut);
    var interp = interpolate(opts.from, opts.to);
    var elapsed = -delay, done = false, stop = null;

    if (core.reducedMotion() && !opts.force) {
      /* Land on the final frame immediately. The information still arrives;
         only the choreography is dropped. */
      if (opts.onUpdate) opts.onUpdate(opts.to, 1);
      if (opts.onDone) opts.onDone();
      return { cancel: function () {}, finish: function () {}, done: true };
    }

    stop = core.onTick(function (dt) {
      elapsed += dt * 1000;
      if (elapsed < 0) return;
      var t = dur <= 0 ? 1 : core.clamp(elapsed / dur, 0, 1);
      var e = fn(t);
      if (opts.onUpdate) opts.onUpdate(interp(e), t, e);
      if (t >= 1) { done = true; stop(); if (opts.onDone) opts.onDone(); }
    });

    return {
      get done() { return done; },
      cancel: function () { if (!done) { done = true; stop(); } },
      finish: function () {
        if (done) return;
        done = true; stop();
        if (opts.onUpdate) opts.onUpdate(opts.to, 1, 1);
        if (opts.onDone) opts.onDone();
      }
    };
  }

  /* ── Spring ────────────────────────────────────────────────────────────────
     Critically damped by default. A spring is the right primitive for anything
     the reader is dragging: it has no fixed duration, so a new target mid
     flight is not a cancelled animation, it is just a new target.            */
  function spring(initial, opts) {
    opts = opts || {};
    var stiffness = opts.stiffness === undefined ? 170 : opts.stiffness;
    var damping = opts.damping === undefined ? 26 : opts.damping;
    var precision = opts.precision === undefined ? 0.0015 : opts.precision;

    var vec = Array.isArray(initial);
    var value = vec ? initial.slice() : initial;
    var target = vec ? initial.slice() : initial;
    var vel = vec ? initial.map(function () { return 0; }) : 0;
    var stop = null, listeners = [];

    function settled() {
      if (vec) {
        for (var i = 0; i < value.length; i++) {
          if (Math.abs(value[i] - target[i]) > precision || Math.abs(vel[i]) > precision) return false;
        }
        return true;
      }
      return Math.abs(value - target) <= precision && Math.abs(vel) <= precision;
    }

    function emit() {
      for (var i = 0; i < listeners.length; i++) listeners[i](value);
    }

    function step(dt) {
      /* Fixed sub steps keep the spring stable when a frame is dropped. */
      var steps = Math.min(Math.ceil(dt / (1 / 120)), 8);
      var sdt = dt / steps;
      for (var s = 0; s < steps; s++) {
        if (vec) {
          for (var i = 0; i < value.length; i++) {
            var a = -stiffness * (value[i] - target[i]) - damping * vel[i];
            vel[i] += a * sdt; value[i] += vel[i] * sdt;
          }
        } else {
          var acc = -stiffness * (value - target) - damping * vel;
          vel += acc * sdt; value += vel * sdt;
        }
      }
      if (settled()) {
        value = vec ? target.slice() : target;
        vel = vec ? target.map(function () { return 0; }) : 0;
        emit();
        if (stop) { stop(); stop = null; }
      } else emit();
    }

    return {
      get value() { return value; },
      get target() { return target; },
      set: function (t, immediate) {
        target = vec ? t.slice() : t;
        if (immediate || core.reducedMotion()) {
          value = vec ? t.slice() : t;
          vel = vec ? t.map(function () { return 0; }) : 0;
          emit();
          if (stop) { stop(); stop = null; }
          return;
        }
        if (!stop) stop = core.onTick(step);
      },
      jump: function (t) { this.set(t, true); },
      on: function (fn) { listeners.push(fn); return this; },
      stop: function () { if (stop) { stop(); stop = null; } }
    };
  }

  /* ── Stagger ───────────────────────────────────────────────────────────────
     Runs one tween per item with an offset. `order` maps an item to a 0..1
     position so a stagger can travel left to right, or outward from a centre,
     rather than just in array order.                                          */
  function stagger(items, opts) {
    var total = opts.total === undefined ? 700 : opts.total;
    var each = opts.dur === undefined ? 520 : opts.dur;
    var handles = [];
    var n = Math.max(items.length - 1, 1);
    for (var i = 0; i < items.length; i++) {
      var pos = opts.order ? opts.order(items[i], i) : i / n;
      handles.push(tween({
        from: opts.from, to: opts.to, dur: each, ease: opts.ease,
        delay: (opts.delay || 0) + pos * total,
        onUpdate: (function (item, idx) {
          return function (v, t) { opts.onUpdate(item, v, t, idx); };
        })(items[i], i)
      }));
    }
    return {
      cancel: function () { handles.forEach(function (x) { x.cancel(); }); },
      finish: function () { handles.forEach(function (x) { x.finish(); }); }
    };
  }

  /* ── Path interpolation ────────────────────────────────────────────────────
     Never lerp a path `d` string directly: the default string interpolator
     lerps elliptical arc flags, which are only ever 0 or 1. Rebuild the path
     from interpolated DATA each frame instead. This helper does that for the
     common case of a polyline defined by an array of values.                  */
  function morphSeries(from, to, build, opts) {
    return tween({
      from: from, to: to,
      dur: opts && opts.dur, ease: (opts && opts.ease) || "cubicInOut",
      delay: opts && opts.delay,
      onUpdate: function (vals, t) { build(vals, t); },
      onDone: opts && opts.onDone
    });
  }

  /* ── Catmull-Rom to cubic Bezier ───────────────────────────────────────────
     For decorative connectors only. Never for data: Catmull-Rom overshoots
     between points, which is a lie for counts and rates.                      */
  function smoothPath(pts, tension) {
    if (pts.length < 2) return "";
    tension = tension === undefined ? 0.5 : tension;
    var d = "M " + pts[0][0].toFixed(2) + " " + pts[0][1].toFixed(2);
    for (var i = 0; i < pts.length - 1; i++) {
      var p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
      var c1x = p1[0] + ((p2[0] - p0[0]) / 6) * tension;
      var c1y = p1[1] + ((p2[1] - p0[1]) / 6) * tension;
      var c2x = p2[0] - ((p3[0] - p1[0]) / 6) * tension;
      var c2y = p2[1] - ((p3[1] - p1[1]) / 6) * tension;
      d += " C " + c1x.toFixed(2) + " " + c1y.toFixed(2) + " " +
                   c2x.toFixed(2) + " " + c2y.toFixed(2) + " " +
                   p2[0].toFixed(2) + " " + p2[1].toFixed(2);
    }
    return d;
  }

  /* Monotone cubic. Safe for data: it cannot overshoot the points it joins. */
  function monotonePath(pts) {
    var n = pts.length;
    if (n < 2) return "";
    if (n === 2) return "M " + pts[0][0] + " " + pts[0][1] + " L " + pts[1][0] + " " + pts[1][1];
    var dx = [], dy = [], m = [];
    for (var i = 0; i < n - 1; i++) { dx.push(pts[i + 1][0] - pts[i][0]); dy.push(pts[i + 1][1] - pts[i][1]); }
    var slopes = dy.map(function (v, i) { return v / dx[i]; });
    m[0] = slopes[0];
    for (var j = 1; j < n - 1; j++) {
      if (slopes[j - 1] * slopes[j] <= 0) m[j] = 0;
      else {
        var w1 = 2 * dx[j] + dx[j - 1], w2 = dx[j] + 2 * dx[j - 1];
        m[j] = (w1 + w2) / (w1 / slopes[j - 1] + w2 / slopes[j]);
      }
    }
    m[n - 1] = slopes[n - 2];
    var d = "M " + pts[0][0].toFixed(2) + " " + pts[0][1].toFixed(2);
    for (var k = 0; k < n - 1; k++) {
      d += " C " + (pts[k][0] + dx[k] / 3).toFixed(2) + " " + (pts[k][1] + m[k] * dx[k] / 3).toFixed(2) +
           " " + (pts[k + 1][0] - dx[k] / 3).toFixed(2) + " " + (pts[k + 1][1] - m[k + 1] * dx[k] / 3).toFixed(2) +
           " " + pts[k + 1][0].toFixed(2) + " " + pts[k + 1][1].toFixed(2);
    }
    return d;
  }

  /* ── Counting numbers ──────────────────────────────────────────────────────
     A number that counts up reads as a measurement being taken. Tabular
     figures in CSS stop it from juddering as digits change width.            */
  function countTo(node, from, to, opts) {
    opts = opts || {};
    var fmt = opts.format || function (v) { return Math.round(v).toLocaleString("en-US"); };
    return tween({
      from: from, to: to,
      dur: opts.dur === undefined ? 900 : opts.dur,
      delay: opts.delay, ease: opts.ease || "expoOut",
      onUpdate: function (v) { node.textContent = fmt(v); },
      onDone: opts.onDone
    });
  }

  /* ── Draw-on for a stroked path ────────────────────────────────────────────
     Uses the real measured length so the dash never lags the geometry.       */
  function drawPath(pathNode, opts) {
    opts = opts || {};
    var len = pathNode.getTotalLength();
    pathNode.style.strokeDasharray = len + " " + len;
    pathNode.style.strokeDashoffset = String(len);
    return tween({
      from: len, to: 0,
      dur: opts.dur === undefined ? 900 : opts.dur,
      delay: opts.delay, ease: opts.ease || "cubicInOut",
      onUpdate: function (v) { pathNode.style.strokeDashoffset = String(v); },
      onDone: function () {
        pathNode.style.strokeDasharray = opts.keepDash || "";
        pathNode.style.strokeDashoffset = "";
        if (opts.onDone) opts.onDone();
      }
    });
  }

  return {
    ease: ease, tween: tween, spring: spring, stagger: stagger,
    interpolate: interpolate, morphSeries: morphSeries,
    smoothPath: smoothPath, monotonePath: monotonePath,
    countTo: countTo, drawPath: drawPath
  };
})();
