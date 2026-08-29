// Dot pool: ~2,000 particles tweening between formations. Each dot gets a
// target (x, y, colour, radius, alpha, shape) plus a staggered delay.
// Rendering is sprite-batched per (shape, colour, radius).
//
// Two things here are deliberately not the Africa film's. That pool moved
// every dot along a curved bezier with a perpendicular offset, which reads as
// soft and organic and was right for a film about people dying. This one is
// about measurement, so travel is straight with a mechanical settle, and
// anything falling through the Galton board asks for gravity by name.
//
// A dot is also not always a circle. The theme's mark spec names the crowd's
// shape (a tally dash) separately from a named subject's (a disc), so the
// vocabulary is set in one place rather than scene by scene.

import { T } from "./theme.js";

const TAU = Math.PI * 2;

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const EASES = {
  // arrives fast then settles, like a needle finding its reading
  settle: (t) => {
    const c = 1.70158 * 0.6;
    const u = t - 1;
    return 1 + (c + 1) * u * u * u + c * u * u;
  },
  // accelerates downward, which is what a falling ball actually does. Beats in
  // the Galton board chapter ask for this by name.
  gravity: (t) => t * t,
};

export class DotPool {
  constructor(roster) {
    this.reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
    this.dots = roster.map((d) => ({
      d,               // roster identity
      x: 0, y: 0, r: 2.2, a: 0,
      shape: "dot",
      c: hexToRgb(T.neutral),
      tw: null,        // active tween
    }));
  }

  // place: (selection, view) => (dot, k) => {x, y, color?, r?, a?, shape?}
  // Unselected dots fade out where they stand.
  setFormation({
    select = () => true, place, view, duration = 1.6, stagger = 0.8,
    snap = false, now = 0, keepOthers = false, ease = null,
  }) {
    if (this.reducedMotion) { duration = 0.25; stagger = 0.1; }
    const selection = [];
    for (const p of this.dots) if (select(p.d)) selection.push(p);
    const pos = place(selection.map((p) => p.d), view);
    const easeKey = ease || T.motion.ease;
    selection.forEach((p, k) => {
      const t = pos(p.d, k) || {};
      this._tween(p, {
        x: t.x ?? p.x, y: t.y ?? p.y,
        r: t.r ?? p.r,
        a: t.a ?? 1,
        shape: t.shape ?? "dot",
        c: t.color ? hexToRgb(t.color) : p.c,
      }, now + (stagger * k) / Math.max(1, selection.length) + p.d.jr * 0.15, duration, snap, easeKey);
    });
    if (keepOthers) return;
    for (const p of this.dots) {
      if (!select(p.d) && p.a > 0.001) {
        this._tween(p, { x: p.x, y: p.y + 6, r: p.r, a: 0, shape: p.shape, c: p.c },
          now + p.d.jr * 0.3, duration * 0.6, snap, easeKey);
      }
    }
  }

  _tween(p, to, t0, dur, snap, easeKey) {
    if (snap) {
      p.x = to.x; p.y = to.y; p.r = to.r; p.a = to.a; p.c = to.c; p.shape = to.shape;
      p.tw = null;
      return;
    }
    const dx = to.x - p.x, dy = to.y - p.y;
    const dist = Math.hypot(dx, dy);
    // The theme decides whether travel bows. "straight" gives a zero-offset
    // control point, so the quadratic collapses to a line.
    const bow = T.motion.path === "curved" ? dist * 0.18 * (p.d.jr - 0.5) * 2 : 0;
    p.tw = {
      x0: p.x, y0: p.y, x1: to.x, y1: to.y,
      cx: p.x + dx / 2 - (dy / (dist || 1)) * bow,
      cy: p.y + dy / 2 + (dx / (dist || 1)) * bow,
      r0: p.r, r1: to.r,
      a0: p.a, a1: to.a,
      c0: p.c, c1: to.c,
      shape: to.shape,
      ease: EASES[easeKey] || EASES.settle,
      t0, dur,
    };
  }

  update(now) {
    for (const p of this.dots) {
      const tw = p.tw;
      if (!tw) continue;
      const t = (now - tw.t0) / tw.dur;
      if (t >= 1) {
        p.x = tw.x1; p.y = tw.y1; p.r = tw.r1; p.a = tw.a1; p.c = tw.c1; p.shape = tw.shape;
        p.tw = null;
        continue;
      }
      if (t <= 0) continue;
      const e = tw.ease(t);
      const u = 1 - e;
      p.x = u * u * tw.x0 + 2 * u * e * tw.cx + e * e * tw.x1;
      p.y = u * u * tw.y0 + 2 * u * e * tw.cy + e * e * tw.y1;
      // Radius, alpha and shape ramp linearly. An overshooting ease on a
      // radius makes every dot visibly pulse on arrival, which reads as a
      // rendering glitch rather than as motion.
      p.r = tw.r0 + (tw.r1 - tw.r0) * t;
      p.a = tw.a0 + (tw.a1 - tw.a0) * t;
      p.shape = t > 0.5 ? tw.shape : p.shape;
      p.c = [
        tw.c0[0] + (tw.c1[0] - tw.c0[0]) * t,
        tw.c0[1] + (tw.c1[1] - tw.c0[1]) * t,
        tw.c0[2] + (tw.c1[2] - tw.c0[2]) * t,
      ];
    }
  }

  snapAll() {
    for (const p of this.dots) {
      const tw = p.tw;
      if (!tw) continue;
      p.x = tw.x1; p.y = tw.y1; p.r = tw.r1; p.a = tw.a1; p.c = tw.c1; p.shape = tw.shape;
      p.tw = null;
    }
  }

  hideAll() {
    for (const p of this.dots) { p.a = 0; p.tw = null; }
  }

  // ── Rendering ──────────────────────────────────────────────────────────
  _sprite(key, shape, r, cr, cg, cb, dpr) {
    if (!this._cache) this._cache = new Map();
    let s = this._cache.get(key);
    if (s) return s;
    const pad = 2;
    const w = shape === "tick" ? (r * (T.mark.tickRatio || 2.4) + pad) * 2 : (r + pad) * 2;
    const h = (r + pad) * 2;
    const c = document.createElement("canvas");
    c.width = Math.max(2, Math.ceil(w * dpr));
    c.height = Math.max(2, Math.ceil(h * dpr));
    const g = c.getContext("2d");
    const col = `rgb(${cr},${cg},${cb})`;
    if (shape === "tick") {
      // A horizontal tally dash. Stacked in a histogram column it reads as a
      // ruled tally rather than a bead chain, and it is still countable.
      g.fillStyle = col;
      const tw = r * (T.mark.tickRatio || 2.4) * 2 * dpr;
      const th = Math.max(1.15 * dpr, r * 1.5 * dpr);
      g.fillRect((c.width - tw) / 2, (c.height - th) / 2, tw, th);
    } else {
      g.fillStyle = col;
      g.beginPath();
      g.arc(c.width / 2, c.height / 2, r * dpr, 0, TAU);
      g.fill();
    }
    s = { c, hw: c.width / 2, hh: c.height / 2 };
    this._cache.set(key, s);
    if (this._cache.size > 500) this._cache.clear(); // safety valve
    return s;
  }

  draw(ctx, dpr) {
    for (const p of this.dots) {
      if (p.a <= 0.004) continue;
      // quantize colour/radius so the sprite cache stays small
      const cr = Math.round(p.c[0] / 8) * 8;
      const cg = Math.round(p.c[1] / 8) * 8;
      const cb = Math.round(p.c[2] / 8) * 8;
      const r = Math.round(p.r * 4) / 4;
      const shape = p.shape || "dot";
      const s = this._sprite(`${shape},${cr},${cg},${cb},${r}`, shape, r, cr, cg, cb, dpr);
      ctx.globalAlpha = p.a;
      ctx.drawImage(s.c, p.x * dpr - s.hw, p.y * dpr - s.hh);
    }
    ctx.globalAlpha = 1;
  }
}
