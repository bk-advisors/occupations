// Formation factories. Each returns:
//   place(selection, view) -> (dot, k) => {x, y, color, r, a}   for DotPool
//   draw(ctx, view, t)       overlay axes/labels/annotations (ctx in CSS px)
//   regions                  hover targets while paused, filled in by place()
//
// The film has one ruler and everything hangs off it: sigma, standard
// deviations above the mean of a named reference population. A scene that
// draws an axis draws that axis.
//
// Colour carries one argument and nothing else: the crowd is neutral, the
// thing being pointed at is the accent, a fall is the fall colour. Domains get
// no hues, because spending three colours on a category the eye does not need
// to decode buys nothing and costs the accent its force.
//
// Nothing here holds a literal colour or font. Everything reads through the
// active theme in theme.js at draw time, so the film's identity is a token
// swap rather than a rewrite.

import { portraits } from "./portraits.js";
import { T, fUI, fMono, fNum, fDisplay } from "./theme.js";
import { fmt, sigma as fmtSigma } from "./data.js";

export { T };

export const fade = (t, d = 0.8, delay = 0.3) => Math.max(0, Math.min(1, (t - delay) / d));
export const clamp01 = (x) => Math.max(0, Math.min(1, x));
const easeOut = (t) => 1 - Math.pow(1 - clamp01(t), 3);

// Usable stage between the chapter tag and the caption lower-third.
export function stageArea(view, { captionSpace = 196, top = 66 } = {}) {
  const pad = Math.max(24, view.w * 0.05);
  return { x: pad, y: top, w: view.w - pad * 2, h: view.h - top - captionSpace };
}

function dotRadius(view) {
  return Math.max(1.6, Math.min(2.6, view.w / 620));
}

// ── Text helpers ─────────────────────────────────────────────────────────
function wrapLines(ctx, text, maxW) {
  const words = String(text).split(" ");
  const lines = [];
  let line = "";
  for (const w of words) {
    const test = line ? line + " " + w : w;
    if (ctx.measureText(test).width > maxW && line) { lines.push(line); line = w; }
    else line = test;
  }
  if (line) lines.push(line);
  return lines;
}

// Hex to rgba, so a backing can take the active theme's own deep stage colour
// rather than a colour baked in from whichever film was built first.
export function rgba(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

// A label that must survive running over dots gets a pill rather than a
// scrim: a scrim covers the distribution, which is the thing worth seeing.
export function pill(ctx, x, y, w, h, alpha = 0.8, rad = 5) {
  ctx.fillStyle = rgba(T.stageDeep, alpha);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.arcTo(x + w, y, x + w, y + h, rad);
  ctx.arcTo(x + w, y + h, x, y + h, rad);
  ctx.arcTo(x, y + h, x, y, rad);
  ctx.arcTo(x, y, x + w, y, rad);
  ctx.fill();
}

// ── The sigma ruler ──────────────────────────────────────────────────────
// One scale object, shared by every scene that speaks in sigma, so a marker in
// chapter 3 and a row in chapter 5 sit at the same place for the same number.
export function sigmaScale(area, { z0 = -1.5, z1 = 6, padFrac = 0.06 } = {}) {
  const x0 = area.x + area.w * padFrac;
  const x1 = area.x + area.w * (1 - padFrac);
  const x = (z) => x0 + ((z - z0) / (z1 - z0)) * (x1 - x0);
  return { x, z0, z1, x0, x1, invert: (px) => z0 + ((px - x0) / (x1 - x0)) * (z1 - z0) };
}

export function drawSigmaAxis(ctx, sc, y, { alpha = 1, label = null, step = 1, tickUp = 6 } = {}) {
  if (alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = T.dim;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(sc.x0, y);
  ctx.lineTo(sc.x1, y);
  ctx.stroke();

  ctx.textAlign = "center";
  ctx.font = fNum(11.5, 500);
  const lo = Math.ceil(sc.z0 / step) * step;
  for (let z = lo; z <= sc.z1 + 1e-6; z += step) {
    const px = sc.x(z);
    ctx.strokeStyle = Math.abs(z) < 1e-6 ? T.inkMute : T.dim;
    ctx.beginPath();
    ctx.moveTo(px, y - tickUp);
    ctx.lineTo(px, y);
    ctx.stroke();
    ctx.fillStyle = Math.abs(z) < 1e-6 ? T.inkSoft : T.inkMute;
    ctx.fillText(Math.abs(z) < 1e-6 ? "average" : `${z > 0 ? "+" : "−"}${Math.abs(z)}σ`, px, y + 16);
  }
  if (label) {
    ctx.fillStyle = T.inkMute;
    ctx.font = `500 11.5px ${T.fontUI}`;
    ctx.textAlign = "left";
    ctx.fillText(label.toUpperCase(), sc.x0, y + 36);
  }
  ctx.restore();
}

// ── The crowd, as a bell ─────────────────────────────────────────────────
// Dots binned by z and stacked off a baseline. A real histogram of whatever
// population is on stage, never a drawn curve: if the pile is not bell shaped
// the data says so.
export function bell({
  zOf = (d) => d.z, z0 = -3.2, z1 = 3.2, binW = 0.2,
  color = T.neutral, baselineFrac = 0.78, heightFrac = 0.6, area: areaOpt = null,
  axis = true, axisLabel = null, title = null,
} = {}) {
  const self = {
    regions: [],
    geom: null,
    place(selection, view) {
      const a = areaOpt ? areaOpt(view) : stageArea(view);
      const sc = sigmaScale(a, { z0, z1 });
      const baseY = a.y + a.h * baselineFrac;

      const binOf = (d) => Math.round(Math.max(z0, Math.min(z1, zOf(d))) / binW);
      const counts = new Map();
      for (const d of selection) {
        const b = binOf(d);
        counts.set(b, (counts.get(b) || 0) + 1);
      }
      const maxCount = Math.max(1, ...counts.values());
      const colW = Math.max(2.4, (sc.x1 - sc.x0) * binW / (z1 - z0));
      const sp = Math.min(colW * 0.95, (a.h * heightFrac) / maxCount);
      const rr = Math.max(1.3, Math.min(sp * 0.44, dotRadius(view)));

      self.geom = { a, sc, baseY, sp, colW, maxCount };
      const slot = new Map();
      const targets = new Map();
      for (const d of selection) {
        const b = binOf(d);
        const s = slot.get(b) || 0;
        slot.set(b, s + 1);
        targets.set(d, { x: sc.x(b * binW), y: baseY - s * sp - sp / 2 });
      }
      return (d) => {
        const t = targets.get(d);
        if (!t) return { a: 0, x: 0, y: 0 };
        return { x: t.x, y: t.y, color, r: rr, shape: T.mark.crowd };
      };
    },
    draw(ctx, view, t) {
      if (!self.geom) return;
      const al = fade(t, 0.7, 0.5);
      if (al <= 0) return;
      const { sc, baseY, a } = self.geom;
      if (axis) drawSigmaAxis(ctx, sc, baseY + 10, { alpha: al, label: axisLabel });
      if (title) {
        ctx.save();
        ctx.globalAlpha = al;
        ctx.textAlign = "left";
        ctx.fillStyle = T.inkMute;
        ctx.font = `600 12px ${T.fontUI}`;
        ctx.fillText(title.toUpperCase(), a.x, a.y + 6);
        ctx.restore();
      }
    },
  };
  return self;
}

// ── Named people on the ruler ────────────────────────────────────────────
// A portrait, a ring, a name and the statistic, sitting above the crowd at the
// person's own z. `people` entries: {slug, name, sub, z, color, side}.
// `reveal` staggers them in, so a chain of generations arrives one at a time.
export function figures({
  people, area: areaOpt = null, z0 = -1.5, z1 = 6,
  y = null, r = 30, revealEach = 0.9, revealDelay = 0.4,
  connect = false, labelBelow = true, rulerY = null,
} = {}) {
  return (ctx, view, t) => {
    const a = areaOpt ? areaOpt(view) : stageArea(view);
    const sc = sigmaScale(a, { z0, z1 });
    const cy = y ? y(a, view) : a.y + a.h * 0.34;

    // A person carries their own reveal offset when the scene needs one. A
    // chain of generations adds a link per beat, and the links already on
    // stage pass a negative `at` so they hold rather than fading in again.
    const shown = [];
    people.forEach((p, i) => {
      const at = p.at != null ? p.at : revealDelay + i * revealEach;
      const al = clamp01((t - at) / 0.7);
      if (al > 0.004) shown.push({ p, al, x: sc.x(p.z), i });
    });
    if (!shown.length) return;

    // connectors first: draw order is z order on a canvas
    if (connect && shown.length > 1) {
      ctx.save();
      ctx.strokeStyle = T.dim;
      ctx.lineWidth = 1.4;
      ctx.setLineDash([4, 5]);
      for (let k = 1; k < shown.length; k++) {
        const prev = shown[k - 1], cur = shown[k];
        ctx.globalAlpha = Math.min(prev.al, cur.al) * 0.9;
        ctx.beginPath();
        ctx.moveTo(prev.x, cy + (prev.i % 2 ? r : -r) * 0);
        ctx.lineTo(cur.x, cy);
        ctx.stroke();
      }
      ctx.restore();
      ctx.setLineDash([]);
    }

    for (const s of shown) {
      const { p, al, x } = s;
      const rr = r * (0.86 + 0.14 * easeOut(al));
      const ok = portraits.draw(ctx, p.slug, x, cy, rr, {
        alpha: al, ring: 3.5, ringColor: p.color || T.ink,
      });
      if (!ok) {
        ctx.save();
        ctx.globalAlpha = al;
        ctx.fillStyle = p.color || T.accent;
        ctx.beginPath();
        ctx.arc(x, cy, 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      // Stem down to the ruler. It runs the whole way when the scene gives an
      // axis to land on: a portrait floating above an unconnected bell reads
      // as decoration rather than as a position on the scale.
      ctx.save();
      ctx.globalAlpha = al * (rulerY == null ? 0.7 : 0.3);
      ctx.strokeStyle = p.color || T.inkMute;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(x, cy + rr + 4);
      ctx.lineTo(x, rulerY == null ? cy + rr + (labelBelow ? 14 : 26) : rulerY(view));
      ctx.stroke();
      ctx.restore();

      ctx.save();
      ctx.globalAlpha = al;
      ctx.textAlign = "center";
      const ty = cy + rr + 32;
      ctx.font = `600 13.5px ${T.fontUI}`;
      const nameW = ctx.measureText(p.name).width;
      pill(ctx, x - nameW / 2 - 7, ty - 14, nameW + 14, 19, 0.72);
      ctx.fillStyle = p.color || T.ink;
      ctx.fillText(p.name, x, ty);
      if (p.sub) {
        ctx.fillStyle = T.inkMute;
        ctx.font = `400 11.5px ${T.fontUI}`;
        for (const [li, line] of wrapLines(ctx, p.sub, 150).entries()) {
          ctx.fillText(line, x, ty + 16 + li * 14);
        }
      }
      ctx.fillStyle = p.color || T.accent;
      ctx.font = `600 12px ${T.fontUI}`;
      ctx.fillText(fmtSigma(p.z, 2), x, cy - rr - 10);
      ctx.restore();
    }
  };
}

// ── A chain of generations, one per row ──────────────────────────────────
// The Vanderbilt links sit at 5.32, 5.34, 4.86, 3.97 and 1.47, so on a single
// horizontal line the first three portraits and all their labels land on top
// of each other. A row per generation fixes that structurally and reads
// better anyway: the walk back toward the crowd becomes a staircase.
export function generations({
  people, z0 = -3.4, z1 = 6.1, area: areaOpt = null,
  r = 26, title = null, axis = true, gutter = true, rulerY = null,
} = {}) {
  return (ctx, view, t) => {
    const a = areaOpt ? areaOpt(view) : stageArea(view);
    const labelGut = gutter ? Math.min(120, Math.max(70, view.w * 0.1)) : 0;
    const inner = { x: a.x + labelGut, y: a.y + (title ? 26 : 6), w: a.w - labelGut, h: a.h * 0.82 };
    const sc = sigmaScale(inner, { z0, z1, padFrac: 0.03 });
    const rowH = inner.h / people.length;
    const rowY = (i) => inner.y + i * rowH + rowH / 2;
    const rr = Math.min(r, rowH * 0.36);
    // Drop lines have to land on the ruler that is actually on stage, which
    // belongs to a different formation with its own area. Ending them at this
    // layout's own inner bottom left five lines stopping in mid-air above the
    // axis. The scene passes the real y.
    const footY = rulerY ? rulerY(view) : inner.y + inner.h + 12;

    const shown = people
      .map((p, i) => ({ p, i, al: clamp01((t - (p.at != null ? p.at : 0.3 + i * 0.9)) / 0.7), x: sc.x(p.z) }))
      .filter((s) => s.al > 0.004);
    if (!shown.length) return;

    ctx.save();
    const anyAl = Math.max(...shown.map((s) => s.al));
    if (axis) drawSigmaAxis(ctx, sc, footY, { alpha: anyAl });

    // the staircase: each generation drops to the next and steps sideways
    ctx.setLineDash([4, 5]);
    ctx.lineWidth = 1.3;
    for (const s of shown) {
      if (s.i === 0) continue;
      const prev = shown.find((o) => o.i === s.i - 1);
      if (!prev) continue;
      ctx.globalAlpha = Math.min(prev.al, s.al) * 0.75;
      ctx.strokeStyle = T.dim;
      ctx.beginPath();
      ctx.moveTo(prev.x, rowY(prev.i) + rr + 2);
      ctx.lineTo(prev.x, rowY(s.i) - rr - 12);
      ctx.lineTo(s.x, rowY(s.i) - rr - 2);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    for (const s of shown) {
      const { p, i, al, x } = s;
      const y = rowY(i);
      // faint drop to the ruler, so every portrait is anchored to a number
      ctx.globalAlpha = al * 0.28;
      ctx.strokeStyle = p.color || T.inkMute;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, y + rr + 3);
      ctx.lineTo(x, footY);
      ctx.stroke();

      ctx.globalAlpha = al;
      if (!portraits.draw(ctx, p.slug, x, y, rr, { alpha: al, ring: 3, ringColor: p.color || T.ink })) {
        ctx.fillStyle = p.color || T.accent;
        ctx.beginPath();
        ctx.arc(x, y, 7, 0, Math.PI * 2);
        ctx.fill();
      }

      // name away from the axis centre, so a label never crosses the ruler's
      // busy middle and two adjacent rows cannot butt into each other
      const toLeft = x > inner.x + inner.w * 0.55;
      ctx.textAlign = toLeft ? "right" : "left";
      const tx = x + (toLeft ? -(rr + 12) : rr + 12);
      ctx.fillStyle = p.color || T.ink;
      ctx.font = `600 13.5px ${T.fontUI}`;
      ctx.fillText(p.name, tx, y - 1);
      if (p.sub) {
        ctx.fillStyle = T.inkMute;
        ctx.font = `400 11.5px ${T.fontUI}`;
        ctx.fillText(p.sub, tx, y + 15);
      }
      ctx.textAlign = "center";
      ctx.fillStyle = p.color || T.accent;
      ctx.font = fNum(11.5, 600);
      ctx.fillText(fmtSigma(p.z, 2), x, y + rr + 15);

      if (gutter) {
        ctx.textAlign = "right";
        ctx.fillStyle = T.inkMute;
        ctx.font = `500 11px ${T.fontUI}`;
        ctx.fillText(p.gen || `${i + 1}${["st", "nd", "rd", "th", "th"][i] || "th"} generation`, a.x + labelGut - 16, y + 4);
      }
    }

    if (title) {
      ctx.globalAlpha = anyAl;
      ctx.textAlign = "left";
      ctx.fillStyle = T.inkMute;
      ctx.font = `600 12px ${T.fontUI}`;
      ctx.fillText(title.toUpperCase(), a.x, a.y + 10);
    }
    ctx.restore();
  };
}

// ── Scatter: one dot per observation, with fitted lines ──────────────────
// Used twice: Galton's 928 children (parent height against child height), and
// the survivors scene (parent z against child z). `lines` entries:
// {kind:"identity"|"fit", slope, intercept, color, dash, label, drawFrom}
export function scatter({
  xOf, yOf, x0, x1, y0, y1, xLabel, yLabel, title = null,
  color = T.neutral, r = null, lines = [], area: areaOpt = null,
  colorOf = null, alphaOf = null, xTickStep = 1, yTickStep = 1, tickFmt = (v) => String(v),
} = {}) {
  const self = {
    regions: [],
    geom: null,
    place(selection, view) {
      const a = areaOpt ? areaOpt(view) : stageArea(view);
      const m = { l: 62, r: 24, t: title ? 34 : 14, b: 46 };
      const px0 = a.x + m.l, px1 = a.x + a.w - m.r;
      const py0 = a.y + a.h - m.b, py1 = a.y + m.t;
      const sx = (v) => px0 + ((v - x0) / (x1 - x0)) * (px1 - px0);
      const sy = (v) => py0 + ((v - y0) / (y1 - y0)) * (py1 - py0);
      self.geom = { a, sx, sy, px0, px1, py0, py1 };
      const rr = r ?? dotRadius(view);
      return (d) => {
        const xv = xOf(d), yv = yOf(d);
        if (!isFinite(xv) || !isFinite(yv)) return { a: 0, x: 0, y: 0 };
        // A point outside the frame is dropped rather than drawn loose on the
        // stage. Domains are set from the data in scenes.js, so this catches
        // the stray, not a chunk of the distribution.
        if (xv < x0 || xv > x1 || yv < y0 || yv > y1) return { a: 0, x: 0, y: 0 };
        return {
          x: sx(xv), y: sy(yv), r: rr,
          color: colorOf ? colorOf(d) : color,
          a: alphaOf ? alphaOf(d) : 1,
        };
      };
    },
    draw(ctx, view, t) {
      if (!self.geom) return;
      const al = fade(t, 0.7, 0.4);
      if (al <= 0) return;
      const { a, sx, sy, px0, px1, py0, py1 } = self.geom;
      ctx.save();
      ctx.globalAlpha = al;

      // frame and ticks
      ctx.strokeStyle = T.dim;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(px0, py1); ctx.lineTo(px0, py0); ctx.lineTo(px1, py0);
      ctx.stroke();

      ctx.font = fNum(11, 500);
      ctx.fillStyle = T.inkMute;
      ctx.textAlign = "center";
      for (let v = Math.ceil(x0 / xTickStep) * xTickStep; v <= x1 + 1e-6; v += xTickStep) {
        ctx.beginPath(); ctx.moveTo(sx(v), py0); ctx.lineTo(sx(v), py0 + 5); ctx.stroke();
        ctx.fillText(tickFmt(v), sx(v), py0 + 18);
      }
      ctx.textAlign = "right";
      for (let v = Math.ceil(y0 / yTickStep) * yTickStep; v <= y1 + 1e-6; v += yTickStep) {
        ctx.beginPath(); ctx.moveTo(px0 - 5, sy(v)); ctx.lineTo(px0, sy(v)); ctx.stroke();
        ctx.fillText(tickFmt(v), px0 - 9, sy(v) + 4);
      }

      // axis titles
      ctx.fillStyle = T.inkSoft;
      ctx.font = `500 12px ${T.fontUI}`;
      ctx.textAlign = "center";
      ctx.fillText(xLabel, (px0 + px1) / 2, py0 + 38);
      ctx.save();
      ctx.translate(a.x + 14, (py0 + py1) / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.fillText(yLabel, 0, 0);
      ctx.restore();

      if (title) {
        ctx.textAlign = "left";
        ctx.fillStyle = T.inkMute;
        ctx.font = `600 12px ${T.fontUI}`;
        ctx.fillText(title.toUpperCase(), a.x, a.y + 12);
      }

      // fitted and reference lines, drawn on after a delay so the cloud reads
      // as data before a line is laid over it
      for (const ln of lines) {
        const la = clamp01((t - (ln.delay ?? 1.2)) / 0.9);
        if (la <= 0) continue;
        const f = (v) => ln.slope * v + ln.intercept;
        const gx0 = x0, gx1 = x0 + (x1 - x0) * easeOut(la);
        ctx.globalAlpha = al * Math.min(1, la * 2);
        ctx.strokeStyle = ln.color || T.ink;
        ctx.lineWidth = ln.width || 2;
        ctx.setLineDash(ln.dash || []);
        ctx.beginPath();
        ctx.moveTo(sx(gx0), sy(f(gx0)));
        ctx.lineTo(sx(gx1), sy(f(gx1)));
        ctx.stroke();
        ctx.setLineDash([]);
        if (ln.label && la > 0.85) {
          const lx = sx(x0 + (x1 - x0) * 0.965);
          const ly = sy(f(x0 + (x1 - x0) * 0.965));
          ctx.textAlign = "right";
          ctx.font = `600 12px ${T.fontUI}`;
          const lw = ctx.measureText(ln.label).width;
          pill(ctx, lx - lw - 8, ly + (ln.labelDy || -10) - 13, lw + 12, 18, 0.78);
          ctx.fillStyle = ln.color || T.ink;
          ctx.fillText(ln.label, lx - 2, ly + (ln.labelDy || -10));
        }
      }
      ctx.restore();
    },
  };
  return self;
}

// ── The Galton board ─────────────────────────────────────────────────────
// `stage` is which peg row the balls have reached; "bins" means landed. The
// pile is a real binomial, counted off each ball's seeded walk, so a bell that
// appears is a bell the arithmetic produced.
export function pegboard({
  rows = 7, walkKey = "walk1", binKey = "bin1", stage = "bins",
  binOverride = null, color = T.neutral, area: areaOpt = null,
  topFrac = 0.1, floorFrac = 0.96, showPegs = true, highlightBins = null,
} = {}) {
  const self = {
    regions: [],
    geom: null,
    place(selection, view) {
      const a = areaOpt ? areaOpt(view) : stageArea(view);
      const nBins = rows + 1;
      const boardW = Math.min(a.w * 0.72, 620);
      const cx = a.x + a.w / 2;
      const colW = boardW / nBins;
      const topY = a.y + a.h * topFrac;
      const floorY = a.y + a.h * floorFrac;
      const pegSpan = (floorY - topY) * 0.44;
      const rowH = pegSpan / rows;
      // A ball's offset after k pegs is the running sum of ±1, so bin centres
      // land on the last peg row's positions. Bin b sits at (b - rows/2).
      const binX = (b) => cx + (b - rows / 2) * colW;

      self.geom = { a, cx, colW, topY, floorY, rowH, nBins, binX, boardW, pegSpan };

      // pile geometry: several dots wide, so a bin reads as a pile rather than
      // a one-dot-wide line, and the tallest still clears the pegs
      const bins = new Map();
      for (const d of selection) {
        const b = binOverride ? binOverride(d.ball) : d.ball[binKey];
        bins.set(b, (bins.get(b) || 0) + 1);
      }
      const maxCount = Math.max(1, ...bins.values());
      const availH = floorY - (topY + pegSpan) - 16;
      const wide = Math.max(2, Math.min(7, Math.round(Math.sqrt((maxCount * colW * 0.8) / availH))));
      const spx = (colW * 0.84) / wide;
      const sp = Math.min(spx, availH / Math.ceil(maxCount / wide));
      const rr = Math.max(1.5, Math.min(Math.min(sp, spx) * 0.44, 3.4));

      const slot = new Map();
      const targets = new Map();
      for (const d of selection) {
        const w = d.ball[walkKey];
        if (stage === "bins") {
          const b = binOverride ? binOverride(d.ball) : d.ball[binKey];
          const s = slot.get(b) || 0;
          slot.set(b, s + 1);
          const col = s % wide, row = Math.floor(s / wide);
          targets.set(d, {
            x: binX(b) - (wide * spx) / 2 + col * spx + spx / 2,
            y: floorY - row * sp - sp / 2,
          });
        } else {
          // mid-fall: offset is the running sum of the walk so far, in half
          // columns, which is exactly how a real board splits a ball
          const row = Math.max(0, Math.min(rows, stage));
          let off = 0;
          for (let k = 0; k < row; k++) off += w[k];
          targets.set(d, { x: cx + (off / 2) * colW, y: topY + row * rowH });
        }
      }
      return (d, k) => {
        const t = targets.get(d);
        if (!t) return { a: 0, x: 0, y: 0 };
        const b = binOverride ? binOverride(d.ball) : d.ball[binKey];
        const hot = highlightBins && highlightBins.includes(b);
        return { x: t.x, y: t.y, r: rr, color: hot ? T.accent : color };
      };
    },
    draw(ctx, view, t) {
      if (!self.geom) return;
      const al = fade(t, 0.6, 0.2);
      if (al <= 0) return;
      const { cx, colW, topY, floorY, rowH, binX } = self.geom;
      ctx.save();
      ctx.globalAlpha = al;
      if (showPegs) {
        ctx.fillStyle = T.dim;
        for (let r = 0; r < rows; r++) {
          const n = r + 1;
          for (let i = 0; i < n; i++) {
            const px = cx + (i - (n - 1) / 2) * colW;
            ctx.beginPath();
            ctx.arc(px, topY + (r + 0.5) * rowH, 2.4, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
      // floor, and a short divider between bins so the piles read as bins
      ctx.strokeStyle = T.dim;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(binX(0) - colW / 2, floorY);
      ctx.lineTo(binX(rows) + colW / 2, floorY);
      ctx.stroke();
      ctx.globalAlpha = al * 0.5;
      ctx.beginPath();
      for (let b = 0; b <= rows + 1; b++) {
        const dx = binX(b) - colW / 2;
        ctx.moveTo(dx, floorY);
        ctx.lineTo(dx, floorY - 7);
      }
      ctx.stroke();
      ctx.restore();
    },
  };
  return self;
}

// ── Ranked parent-to-child rows ──────────────────────────────────────────
// One row per family, sorted by the parent's sigma. Open mark is the parent,
// filled mark is the child, and the side the filled mark sits on is which way
// that family went. `pairs` are the PAIRS records; the pool's person dots are
// the marks themselves.
export function slopeRows({
  pairs, z0 = -1.6, z1 = 6.1, area: areaOpt = null,
  title = null, labelEvery = null, highlight = [], showChild = true,
} = {}) {
  const self = {
    regions: [],
    geom: null,
    place(selection, view) {
      const a = areaOpt ? areaOpt(view) : stageArea(view);
      const labelW = Math.min(150, Math.max(86, view.w * 0.13));
      const inner = { x: a.x + labelW, y: a.y + (title ? 26 : 8), w: a.w - labelW - 20, h: a.h - (title ? 58 : 40) };
      const sc = sigmaScale(inner, { z0, z1, padFrac: 0.02 });
      const rowH = inner.h / pairs.length;
      const rowY = (ix) => inner.y + ix * rowH + rowH / 2;
      const rr = Math.max(2.2, Math.min(rowH * 0.34, 4.6));

      const order = new Map(pairs.map((p, ix) => [p.id, ix]));
      self.geom = { a, inner, sc, rowH, rowY, labelW, rr, order };
      self.regions = pairs.map((p, ix) => ({
        x: a.x, y: rowY(ix) - rowH / 2, w: a.w, h: rowH,
        data: { name: p.family, pair: p },
      }));

      return (d) => {
        const ix = order.get(d.pairID);
        if (ix == null) return { a: 0, x: 0, y: 0 };
        if (d.gen === "child" && !showChild) return { a: 0, x: 0, y: 0 };
        const p = pairs[ix];
        const isFall = p.dir === "fall";
        // The parent's dot is painted in the stage colour and the overlay
        // strokes a ring around it, so the mark reads as genuinely open. Both
        // generations stay real dots in the pool, which is what the key claims.
        return {
          x: sc.x(d.z), y: rowY(ix), r: d.gen === "child" ? rr : rr * 0.95,
          color: d.gen === "child" ? (isFall ? T.fall : T.neutral) : T.stage,
        };
      };
    },
    draw(ctx, view, t) {
      if (!self.geom) return;
      const al = fade(t, 0.7, 0.5);
      if (al <= 0) return;
      const { a, inner, sc, rowY, rowH, rr } = self.geom;
      ctx.save();
      ctx.globalAlpha = al;

      // connectors, drawn under the marks the pool paints
      for (const [ix, p] of pairs.entries()) {
        const y = rowY(ix);
        const x1 = sc.x(p.pz), x2 = sc.x(p.cz);
        ctx.strokeStyle = p.dir === "fall" ? "rgba(224,104,90,0.42)" : "rgba(185,179,206,0.3)";
        ctx.lineWidth = Math.max(1, Math.min(rowH * 0.22, 3));
        ctx.beginPath();
        ctx.moveTo(x1, y);
        ctx.lineTo(x2, y);
        ctx.stroke();
        // uncertainty on a placement that is a judgement, drawn as a band so a
        // soft number never reads as a hard one
        if (showChild && p.child.zLow != null && p.child.zHigh != null) {
          ctx.strokeStyle = "rgba(201,195,220,0.35)";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(sc.x(p.child.zLow), y);
          ctx.lineTo(sc.x(p.child.zHigh), y);
          ctx.stroke();
          for (const zz of [p.child.zLow, p.child.zHigh]) {
            ctx.beginPath();
            ctx.moveTo(sc.x(zz), y - 2.6);
            ctx.lineTo(sc.x(zz), y + 2.6);
            ctx.stroke();
          }
        }
      }

      // the open ring that makes a parent mark a parent mark
      ctx.strokeStyle = T.inkMute;
      ctx.lineWidth = 1.3;
      for (const [ix, p] of pairs.entries()) {
        ctx.beginPath();
        ctx.arc(sc.x(p.pz), rowY(ix), rr * 0.95 + 0.7, 0, Math.PI * 2);
        ctx.stroke();
      }

      // family labels: every row if they fit, otherwise the named ones only
      const step = labelEvery || (rowH >= 13 ? 1 : Math.ceil(13 / rowH));
      ctx.textAlign = "right";
      ctx.font = `500 ${Math.max(9.5, Math.min(12, rowH * 0.72))}px ${T.fontUI}`;
      for (const [ix, p] of pairs.entries()) {
        const hot = highlight.includes(p.id);
        if (!hot && ix % step !== 0) continue;
        ctx.fillStyle = hot ? T.accent : T.inkMute;
        ctx.fillText(p.family, inner.x - 10, rowY(ix) + 3.5);
      }

      drawSigmaAxis(ctx, sc, inner.y + inner.h + 12, { alpha: al });
      if (title) {
        ctx.textAlign = "left";
        ctx.fillStyle = T.inkMute;
        ctx.font = `600 12px ${T.fontUI}`;
        ctx.fillText(title.toUpperCase(), a.x, a.y + 10);
      }
      ctx.restore();
    },
  };
  return self;
}

// ── Decay columns ────────────────────────────────────────────────────────
// An advantage of 100 units at generation 0, and what is left of it after
// each generation, at that trait's own correlation. Two rows, so the fast
// trait and the slow one are read against each other rather than in sequence.
export function decayColumns({
  series, gens = 5, unit = 100, area: areaOpt = null, title = null,
} = {}) {
  const self = {
    regions: [],
    geom: null,
    place(selection, view) {
      const a = areaOpt ? areaOpt(view) : stageArea(view);
      const labelW = Math.min(210, Math.max(120, view.w * 0.17));
      const inner = { x: a.x + labelW, y: a.y + (title ? 30 : 10), w: a.w - labelW - 30, h: a.h - (title ? 62 : 42) };
      const nRows = series.length;
      const rowH = inner.h / nRows;
      const colW = inner.w / (gens + 1);

      // dots per (series, generation), from the trait's own correlation
      const need = series.map((s) => {
        const arr = [];
        for (let g = 0; g <= gens; g++) arr.push(Math.round(unit * Math.pow(s.r, g)));
        return arr;
      });
      const maxCol = Math.max(...need.flat());
      const wide = Math.max(4, Math.round(Math.sqrt((maxCol * colW * 0.6) / (rowH * 0.66))));
      const sp = Math.min(colW * 0.62 / wide, (rowH * 0.66) / Math.ceil(maxCol / wide));
      const rr = Math.max(1.2, Math.min(sp * 0.42, 2.6));

      const colX = (g) => inner.x + g * colW + colW * 0.5;
      const baseY = (si) => inner.y + si * rowH + rowH * 0.84;
      self.geom = { a, inner, rowH, colW, colX, baseY, need, wide, sp, gens };

      // walk the pool in a stable order and hand dots out column by column
      const queue = [...selection];
      const targets = new Map();
      let qi = 0;
      for (const [si, s] of series.entries()) {
        for (let g = 0; g <= gens; g++) {
          const n = need[si][g];
          for (let k = 0; k < n && qi < queue.length; k++, qi++) {
            const col = k % wide, row = Math.floor(k / wide);
            targets.set(queue[qi], {
              x: colX(g) - (wide * sp) / 2 + col * sp + sp / 2,
              y: baseY(si) - row * sp - sp / 2,
              color: s.color || T.neutral,
            });
          }
        }
      }
      return (d) => {
        const t = targets.get(d);
        if (!t) return { a: 0, x: 0, y: 0 };
        return { x: t.x, y: t.y, r: rr, color: t.color };
      };
    },
    draw(ctx, view, t) {
      if (!self.geom) return;
      const al = fade(t, 0.7, 0.5);
      if (al <= 0) return;
      const { a, inner, rowH, colX, baseY, need, gens: G } = self.geom;
      ctx.save();
      ctx.globalAlpha = al;

      for (const [si, s] of series.entries()) {
        const by = baseY(si);
        ctx.strokeStyle = T.dim;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(inner.x, by + 3);
        ctx.lineTo(inner.x + inner.w, by + 3);
        ctx.stroke();

        ctx.textAlign = "right";
        ctx.fillStyle = s.color || T.ink;
        ctx.font = `600 13px ${T.fontUI}`;
        ctx.fillText(s.label, inner.x - 14, by - rowH * 0.3);
        ctx.fillStyle = T.inkMute;
        ctx.font = `400 11px ${T.fontUI}`;
        ctx.fillText(s.sub || `r = ${s.r.toFixed(2)}`, inner.x - 14, by - rowH * 0.3 + 15);

        ctx.textAlign = "center";
        for (let g = 0; g <= G; g++) {
          const va = clamp01((t - 0.9 - g * 0.28) / 0.5);
          if (va <= 0) continue;
          ctx.globalAlpha = al * va;
          ctx.fillStyle = g === 0 ? T.ink : s.color || T.inkSoft;
          ctx.font = fNum(12, 600);
          ctx.fillText(String(need[si][g]), colX(g), by + 18);
        }
        ctx.globalAlpha = al;
      }

      ctx.textAlign = "center";
      ctx.fillStyle = T.inkMute;
      ctx.font = fUI(11.5, 500);
      for (let g = 0; g <= G; g++) {
        ctx.fillText(g === 0 ? "the parent" : `${g} gen`, colX(g), inner.y + inner.h + 16);
      }
      if (title) {
        ctx.textAlign = "left";
        ctx.fillStyle = T.inkMute;
        ctx.font = `600 12px ${T.fontUI}`;
        ctx.fillText(title.toUpperCase(), a.x, a.y + 12);
      }
      ctx.restore();
    },
  };
  return self;
}

// ── The prediction, as one multiplication ────────────────────────────────
// The parent, the multiplication, the expected child, the range around that
// expectation, and where the child actually landed. Overlay only: the bell
// underneath is a separate formation.
//
// The expected son and the actual son land 0.12σ apart, which is the point of
// the scene and also a guarantee that two centred labels will collide. So the
// scene is built as fixed horizontal lanes and each element owns one: parent
// on the top lane, expectation and child on the middle lane with their labels
// above and below it, the range on its own lane underneath. Nothing is
// centred on the same y as anything else.
export function prediction({
  parent, child = null, r, z0 = -1.5, z1 = 6, area: areaOpt = null,
  piHalf = null, showPI = true, axisFrac = 0.95,
}) {
  return (ctx, view, t) => {
    const a = areaOpt ? areaOpt(view) : stageArea(view);
    const sc = sigmaScale(a, { z0, z1 });
    const predZ = parent.z * r;

    const yParent = a.y + a.h * 0.13;
    const yMid = a.y + a.h * 0.46;
    const yPI = a.y + a.h * 0.70;
    const yAxis = a.y + a.h * axisFrac;
    const rr = Math.min(34, a.h * 0.075);

    const aP = clamp01((t - 0.3) / 0.7);
    const aArrow = clamp01((t - 1.9) / 1.2);
    const aPred = clamp01((t - 3.1) / 0.8);
    const aPI = showPI ? clamp01((t - 4.4) / 0.9) : 0;
    const aChild = child ? clamp01((t - 5.6) / 0.9) : 0;

    const drop = (x, y, alpha, color) => {
      ctx.globalAlpha = alpha * 0.26;
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x, yAxis);
      ctx.stroke();
    };

    ctx.save();

    // the multiplication, drawn as travel: down a lane and left by the factor
    if (aArrow > 0) {
      const xs = sc.x(parent.z);
      const xe = sc.x(parent.z + (predZ - parent.z) * easeOut(aArrow));
      ctx.globalAlpha = Math.min(1, aArrow * 1.6);
      ctx.strokeStyle = T.accent;
      ctx.lineWidth = 1.6;
      ctx.setLineDash([5, 4]);
      ctx.beginPath();
      ctx.moveTo(xs, yParent + rr + 6);
      ctx.lineTo(xs, (yParent + yMid) / 2);
      ctx.lineTo(xe, (yParent + yMid) / 2);
      ctx.lineTo(xe, yMid - rr - 34);
      ctx.stroke();
      ctx.setLineDash([]);
      if (aArrow > 0.9) {
        const ye = yMid - rr - 34;
        ctx.fillStyle = T.accent;
        ctx.beginPath();
        ctx.moveTo(xe, ye + 6); ctx.lineTo(xe - 4.5, ye - 2); ctx.lineTo(xe + 4.5, ye - 2);
        ctx.closePath();
        ctx.fill();
      }
      ctx.textAlign = "center";
      ctx.font = `600 14px ${T.fontUI}`;
      const lab = `× ${r.toFixed(2)}`;
      const lw = ctx.measureText(lab).width;
      const mx = (xs + xe) / 2, my = (yParent + yMid) / 2;
      // pill() sets fillStyle to the backing colour, so the text colour has to
      // be set after it. Setting it before paints the label dark on dark and
      // it vanishes without erroring.
      pill(ctx, mx - lw / 2 - 8, my - 24, lw + 16, 20, 0.9);
      ctx.fillStyle = T.accent;
      ctx.fillText(lab, mx, my - 10);
    }

    // the 95% range for a single child, on its own lane as an error bar. Most
    // of the adult male range, which is the honest part of this scene.
    if (aPI > 0 && piHalf) {
      const xa = sc.x(predZ - piHalf), xb = sc.x(predZ + piHalf);
      ctx.globalAlpha = aPI;
      ctx.strokeStyle = "rgba(244,213,141,0.55)";
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(xa, yPI); ctx.lineTo(xb, yPI);
      ctx.moveTo(xa, yPI - 6); ctx.lineTo(xa, yPI + 6);
      ctx.moveTo(xb, yPI - 6); ctx.lineTo(xb, yPI + 6);
      ctx.stroke();
      ctx.textAlign = "center";
      ctx.fillStyle = T.inkMute;
      ctx.font = `500 11.5px ${T.fontUI}`;
      ctx.fillText("95% range for any single son", (xa + xb) / 2, yPI + 22);
    }

    // the expectation: a dashed rule through the middle lane, label above
    if (aPred > 0) {
      const x = sc.x(predZ);
      ctx.globalAlpha = aPred;
      ctx.strokeStyle = T.accent;
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(x, yMid - rr - 26);
      ctx.lineTo(x, yPI + 8);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.textAlign = "center";
      ctx.font = `600 13px ${T.fontUI}`;
      const lab = `expected son  ${fmtSigma(predZ, 2)}`;
      const lw = ctx.measureText(lab).width;
      pill(ctx, x - lw / 2 - 8, yMid - rr - 48, lw + 16, 21, 0.88);
      ctx.fillStyle = T.accent;
      ctx.fillText(lab, x, yMid - rr - 33);
    }

    // the parent, top lane
    if (aP > 0) {
      const x = sc.x(parent.z);
      drop(x, yParent + rr, aP, T.ink);
      ctx.globalAlpha = aP;
      if (!portraits.draw(ctx, parent.slug, x, yParent, rr, { alpha: aP, ring: 3.5, ringColor: T.ink })) {
        ctx.fillStyle = T.ink;
        ctx.beginPath();
        ctx.arc(x, yParent, 8, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.textAlign = "center";
      ctx.font = `600 13.5px ${T.fontUI}`;
      const lw = ctx.measureText(parent.label).width;
      pill(ctx, x - lw / 2 - 8, yParent - rr - 32, lw + 16, 21, 0.88);
      ctx.fillStyle = T.ink;
      ctx.fillText(parent.label, x, yParent - rr - 17);
      ctx.font = fNum(11.5, 600);
      const zl = fmtSigma(parent.z, 2);
      const zw = ctx.measureText(zl).width;
      pill(ctx, x - zw / 2 - 6, yParent + rr + 3, zw + 12, 18, 0.85);
      ctx.fillStyle = T.accent;
      ctx.fillText(zl, x, yParent + rr + 16);
    }

    // the child as measured, middle lane, label below so it clears the
    // expectation's label above
    if (aChild > 0 && child) {
      const x = sc.x(child.z);
      drop(x, yMid + rr, aChild, T.fall);
      ctx.globalAlpha = aChild;
      if (!portraits.draw(ctx, child.slug, x, yMid, rr, { alpha: aChild, ring: 3.5, ringColor: T.fall })) {
        ctx.fillStyle = T.fall;
        ctx.beginPath();
        ctx.arc(x, yMid, 8, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.textAlign = "center";
      ctx.font = `600 13.5px ${T.fontUI}`;
      const lw = ctx.measureText(child.label).width;
      pill(ctx, x - lw / 2 - 8, yMid + rr + 8, lw + 16, 21, 0.88);
      ctx.fillStyle = T.fall;
      ctx.fillText(child.label, x, yMid + rr + 23);
      ctx.font = fNum(11.5, 600);
      const zl2 = fmtSigma(child.z, 2);
      const zw2 = ctx.measureText(zl2).width;
      pill(ctx, x - zw2 / 2 - 6, yMid + rr + 27, zw2 + 12, 18, 0.85);
      ctx.fillStyle = T.fall;
      ctx.fillText(zl2, x, yMid + rr + 40);
    }
    ctx.restore();
  };
}

// ── Small annotation helpers ─────────────────────────────────────────────
// A gold note with a leader line, used sparingly: a few per film, each tied to
// the moment the narration says the thing. They fade out rather than stack up.
export function note({ text, x, y, toX = null, toY = null, align = "center", inFrom = 0.5, hold = 7 }) {
  return (ctx, view, t) => {
    const al = clamp01((t - inFrom) / 0.5) * (1 - clamp01((t - inFrom - hold) / 1.2));
    if (al <= 0) return;
    const px = typeof x === "function" ? x(view) : x;
    const py = typeof y === "function" ? y(view) : y;
    ctx.save();
    ctx.globalAlpha = al;
    ctx.font = `600 13px ${T.fontUI}`;
    ctx.textAlign = align;
    const lines = wrapLines(ctx, text, Math.min(300, view.w * 0.34));
    const w = Math.max(...lines.map((l) => ctx.measureText(l).width));
    const ax = align === "right" ? px - w : align === "center" ? px - w / 2 : px;
    pill(ctx, ax - 9, py - 15, w + 18, lines.length * 17 + 8, 0.8);
    ctx.fillStyle = T.accent;
    lines.forEach((l, i) => ctx.fillText(l, px, py + i * 17));
    if (toX != null) {
      const tx = typeof toX === "function" ? toX(view) : toX;
      const ty = typeof toY === "function" ? toY(view) : toY;
      ctx.strokeStyle = T.accent;
      ctx.lineWidth = 1.2;
      ctx.setLineDash([3, 4]);
      ctx.beginPath();
      ctx.moveTo(px, py + lines.length * 17 - 8);
      ctx.lineTo(tx, ty);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.restore();
  };
}

// A single portrait with a name and a line under it, for the moments the film
// stops on one person rather than on a chart.
export function portraitCard({
  slug, name, sub = null, quote = null, xFrac = 0.5, yFrac = 0.4, r = 74,
  inFrom = 0.3, hold = 9,
}) {
  return (ctx, view, t) => {
    const al = clamp01((t - inFrom) / 0.8) * (1 - clamp01((t - inFrom - hold) / 1.3));
    if (al <= 0) return;
    const a = stageArea(view);
    const x = a.x + a.w * xFrac;
    const y = a.y + a.h * yFrac;
    const rr = r * (0.9 + 0.1 * easeOut(clamp01((t - inFrom) / 1.1)));
    ctx.save();
    ctx.globalAlpha = al;
    const ok = portraits.draw(ctx, slug, x, y, rr, { alpha: al, ring: 4, ringColor: T.ink });
    ctx.textAlign = "center";
    const ty = y + (ok ? rr + 34 : 10);
    ctx.fillStyle = T.ink;
    ctx.font = `600 17px ${T.fontUI}`;
    ctx.fillText(name, x, ty);
    if (sub) {
      ctx.fillStyle = T.inkMute;
      ctx.font = `400 12.5px ${T.fontUI}`;
      wrapLines(ctx, sub, Math.min(360, view.w * 0.42)).forEach((l, i) => ctx.fillText(l, x, ty + 22 + i * 16));
    }
    if (quote) {
      ctx.fillStyle = T.accent;
      ctx.font = `500 italic 15px ${T.fontDisplay}`;
      wrapLines(ctx, quote, Math.min(420, view.w * 0.46)).forEach((l, i) => {
        ctx.fillText(l, x, y - rr - 40 + i * 21);
      });
    }
    ctx.restore();
  };
}

// A big number that counts up, for a headline figure.
export function bigNumber({ value, label, from = 0, dur = 2.2, fmtFn = fmt, hold = 6, yFrac = 0.16 }) {
  return (ctx, view, t) => {
    const al = clamp01(t / 0.8) * (1 - clamp01((t - hold) / 1.4));
    if (al <= 0) return;
    const a = stageArea(view);
    const p = easeOut(clamp01(t / dur));
    ctx.save();
    ctx.globalAlpha = al;
    ctx.textAlign = "center";
    ctx.fillStyle = T.accent;
    ctx.font = `700 ${Math.min(66, view.w / 13)}px ${T.fontDisplay}`;
    ctx.fillText(fmtFn(from + (value - from) * p), view.w / 2, a.y + a.h * yFrac);
    ctx.fillStyle = T.inkSoft;
    ctx.font = `500 13px ${T.fontUI}`;
    ctx.fillText(label.toUpperCase(), view.w / 2, a.y + a.h * yFrac + 26);
    ctx.restore();
  };
}

// A legend row. Colour never carries an argument alone in this film, so this
// exists to name the one distinction that is coloured: a fall against a rise.
// Centring this over the stage put it a few pixels from the key tag in the
// top right, which collides outright once the viewport is narrow. It now sits
// right-aligned on the chart title's own row by default: the title owns the
// left of that row and nothing else is in it.
export function legend(items, { yFrac = null, align = "right" } = {}) {
  return (ctx, view, t) => {
    const al = fade(t, 0.6, 0.5);
    if (al <= 0) return;
    const a = stageArea(view);
    ctx.save();
    ctx.globalAlpha = al;
    ctx.font = fUI(12, 500);
    const widths = items.map((it) => ctx.measureText(it.label).width + 26);
    const total = widths.reduce((s, w) => s + w, 0);
    let x = align === "right" ? a.x + a.w - total
          : align === "left" ? a.x
          : a.x + (a.w - total) / 2;
    const y = yFrac == null ? a.y + 10 : a.y + a.h * yFrac;
    for (const [i, it] of items.entries()) {
      ctx.fillStyle = it.color;
      ctx.beginPath();
      ctx.arc(x + 5, y - 4, 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = T.inkSoft;
      ctx.textAlign = "left";
      ctx.fillText(it.label, x + 14, y);
      x += widths[i];
    }
    ctx.restore();
  };
}
