// Dot pool: 8,300-odd particles, each 1,000 deaths, tweening between
// formations. Formations are applied by scene beats; each dot gets a target
// (x, y, color, radius, alpha) plus a staggered delay, and eases along a
// gently curved path. Rendering is sprite-batched per (color, radius).

const TAU = Math.PI * 2;

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export class DotPool {
  constructor(roster, { neutral = "#B9B3CE" } = {}) {
    this.neutral = neutral;
    this.reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
    this.dots = roster.map((d) => ({
      d,               // roster identity (leafID, name, l1, l2, age, jx, jy, jr)
      x: 0, y: 0, r: 2.2, a: 0,
      c: hexToRgb(neutral),
      tw: null,        // active tween
    }));
  }

  // place: (selection, view) => (dot, k) => {x, y, color?, r?, a?}
  // Unselected dots fade out where they stand.
  setFormation({ select = () => true, place, view, duration = 1.6, stagger = 0.8, snap = false, now = 0, keepOthers = false }) {
    if (this.reducedMotion) { duration = 0.25; stagger = 0.1; }
    const selection = [];
    for (const p of this.dots) if (select(p.d)) selection.push(p);
    const pos = place(selection.map((p) => p.d), view);
    selection.forEach((p, k) => {
      const t = pos(p.d, k) || {};
      this._tween(p, {
        x: t.x ?? p.x, y: t.y ?? p.y,
        r: t.r ?? p.r,
        a: t.a ?? 1,
        c: t.color ? hexToRgb(t.color) : p.c,
      }, now + (stagger * k) / Math.max(1, selection.length) + p.d.jr * 0.15, duration, snap);
    });
    if (keepOthers) return;
    for (const p of this.dots) {
      if (!select(p.d) && p.a > 0.001) {
        this._tween(p, { x: p.x, y: p.y + 6, r: p.r, a: 0, c: p.c }, now + p.d.jr * 0.3, duration * 0.6, snap);
      }
    }
  }

  _tween(p, to, t0, dur, snap) {
    if (snap) {
      p.x = to.x; p.y = to.y; p.r = to.r; p.a = to.a; p.c = to.c;
      p.tw = null;
      return;
    }
    const dx = to.x - p.x, dy = to.y - p.y;
    const dist = Math.hypot(dx, dy);
    // curved path: control point offset perpendicular to travel
    const amp = dist * 0.18 * (p.d.jr - 0.5) * 2;
    p.tw = {
      x0: p.x, y0: p.y, x1: to.x, y1: to.y,
      cx: p.x + dx / 2 - (dy / (dist || 1)) * amp,
      cy: p.y + dy / 2 + (dx / (dist || 1)) * amp,
      r0: p.r, r1: to.r,
      a0: p.a, a1: to.a,
      c0: p.c, c1: to.c,
      t0, dur,
    };
  }

  update(now) {
    for (const p of this.dots) {
      const tw = p.tw;
      if (!tw) continue;
      let t = (now - tw.t0) / tw.dur;
      if (t >= 1) {
        p.x = tw.x1; p.y = tw.y1; p.r = tw.r1; p.a = tw.a1; p.c = tw.c1;
        p.tw = null;
        continue;
      }
      if (t <= 0) continue;
      const e = easeInOutCubic(t);
      const u = 1 - e;
      // quadratic bezier through the offset control point
      p.x = u * u * tw.x0 + 2 * u * e * tw.cx + e * e * tw.x1;
      p.y = u * u * tw.y0 + 2 * u * e * tw.cy + e * e * tw.y1;
      p.r = tw.r0 + (tw.r1 - tw.r0) * e;
      p.a = tw.a0 + (tw.a1 - tw.a0) * e;
      p.c = [
        tw.c0[0] + (tw.c1[0] - tw.c0[0]) * e,
        tw.c0[1] + (tw.c1[1] - tw.c0[1]) * e,
        tw.c0[2] + (tw.c1[2] - tw.c0[2]) * e,
      ];
    }
  }

  snapAll() {
    for (const p of this.dots) {
      const tw = p.tw;
      if (!tw) continue;
      p.x = tw.x1; p.y = tw.y1; p.r = tw.r1; p.a = tw.a1; p.c = tw.c1;
      p.tw = null;
    }
  }

  hideAll() {
    for (const p of this.dots) { p.a = 0; p.tw = null; }
  }

  // ── Rendering ──────────────────────────────────────────────────────────
  _sprite(key, r, cr, cg, cb, dpr) {
    if (!this._cache) this._cache = new Map();
    let s = this._cache.get(key);
    if (s) return s;
    const pad = 2;
    const size = Math.ceil((r + pad) * 2 * dpr);
    const c = document.createElement("canvas");
    c.width = c.height = size;
    const g = c.getContext("2d");
    g.fillStyle = `rgb(${cr},${cg},${cb})`;
    g.beginPath();
    g.arc(size / 2, size / 2, r * dpr, 0, TAU);
    g.fill();
    s = { c, size, half: size / 2 };
    this._cache.set(key, s);
    if (this._cache.size > 400) this._cache.clear(); // safety valve
    return s;
  }

  draw(ctx, dpr) {
    for (const p of this.dots) {
      if (p.a <= 0.004) continue;
      // quantize color/radius so the sprite cache stays small
      const cr = Math.round(p.c[0] / 8) * 8;
      const cg = Math.round(p.c[1] / 8) * 8;
      const cb = Math.round(p.c[2] / 8) * 8;
      const r = Math.round(p.r * 4) / 4;
      const s = this._sprite(`${cr},${cg},${cb},${r}`, r, cr, cg, cb, dpr);
      ctx.globalAlpha = p.a;
      ctx.drawImage(s.c, p.x * dpr - s.half, p.y * dpr - s.half);
    }
    ctx.globalAlpha = 1;
  }
}
