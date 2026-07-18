// Formation factories. Each returns:
//   place(selection, view) -> (dot, k) -> {x, y, color, r}   for DotPool
//   draw(ctx, view, t)       overlay labels/annotations (ctx already in CSS px)
//   regions                  hover targets while paused, filled in by place()
//
// Overlay text follows the dataviz mark rules: direct labels, values at the
// data end, secondary text muted, identity carried by the mark color beside
// text (text itself stays in ink tokens).

import { fmt } from "./data.js";

export const FONT_SANS = '"Inter", system-ui, sans-serif';
export const FONT_SERIF = '"Fraunces", Georgia, serif';

export const INK = "#FAF6EE";
export const INK_SOFT = "#C9C3DC";
export const INK_MUTE = "#8B84A8";
export const GOLD = "#F4D58D";
export const NEUTRAL = "#B9B3CE";

export const L1_COLOR_DARK = {
  "Communicable, maternal, perinatal and nutritional conditions": "#E0685A",
  "Noncommunicable diseases": "#9C86CC",
  "Injuries": "#C08430",
};

const fade = (t, d = 0.8, delay = 0.3) => Math.max(0, Math.min(1, (t - delay) / d));

// Usable stage area between the chapter tag and the caption lower-third.
export function stageArea(view, { captionSpace = 190, top = 64 } = {}) {
  const pad = Math.max(24, view.w * 0.05);
  return { x: pad, y: top, w: view.w - pad * 2, h: view.h - top - captionSpace };
}

// ── Scattered field (the 8.3M cloud) ─────────────────────────────────────
export function field({ color = NEUTRAL, r = null, spread = 1, top = 64 } = {}) {
  return {
    regions: [],
    place(selection, view) {
      const a = stageArea(view, { top });
      const cx = a.x + a.w / 2, cy = a.y + a.h / 2;
      const rx = (a.w / 2) * 0.94 * spread, ry = (a.h / 2) * 0.92 * spread;
      const rr = r ?? dotRadius(view);
      return (d) => {
        const t = Math.sqrt(d.jx), th = d.jy * Math.PI * 2;
        return { x: cx + Math.cos(th) * t * rx, y: cy + Math.sin(th) * t * ry, color, r: rr };
      };
    },
    draw() {},
  };
}

// ── Tight cluster (spiral packing, for small counts) ─────────────────────
export function cluster({ cx, cy, spacing = 9, color = GOLD, r = 3, label = null, sub = null } = {}) {
  const GA = Math.PI * (3 - Math.sqrt(5));
  return {
    regions: [],
    place(selection, view) {
      const px = cx(view), py = cy(view);
      return (d, k) => ({
        x: px + Math.cos(k * GA) * spacing * Math.sqrt(k + 0.4),
        y: py + Math.sin(k * GA) * spacing * Math.sqrt(k + 0.4),
        color, r,
      });
    },
    draw(ctx, view, t) {
      if (!label) return;
      const a = fade(t, 0.8, 0.9);
      if (a <= 0) return;
      ctx.globalAlpha = a;
      ctx.textAlign = "center";
      ctx.fillStyle = INK;
      ctx.font = `600 15px ${FONT_SANS}`;
      ctx.fillText(label, cx(view), cy(view) + 74);
      if (sub) {
        ctx.fillStyle = INK_MUTE;
        ctx.font = `400 12.5px ${FONT_SANS}`;
        ctx.fillText(sub, cx(view), cy(view) + 94);
      }
      ctx.globalAlpha = 1;
    },
  };
}

function dotRadius(view) {
  return Math.max(1.6, Math.min(2.4, view.w / 640));
}

// ── Vertical dot towers (grouped columns, bottom-aligned) ────────────────
// groups: [{key, label, sub?, value, color}] ; keyFn(dot) -> key
export function towers({ groups, keyFn, gapRatio = 0.45, maxDotsWide = null } = {}) {
  const self = {
    regions: [],
    meta: [],
    place(selection, view) {
      const a = stageArea(view);
      const counts = new Map(groups.map((g) => [g.key, 0]));
      for (const d of selection) {
        const k = keyFn(d);
        if (counts.has(k)) counts.set(k, counts.get(k) + 1);
      }
      const n = groups.length;
      const colW = a.w / (n + gapRatio * (n - 1) / 1);
      const towerW = Math.min(colW, a.w / n * 0.72);
      const maxCount = Math.max(...groups.map((g) => counts.get(g.key) || 1));
      // choose dots-wide + spacing so the tallest tower fits the stage
      const budgetH = a.h * 0.86;
      let wide = maxDotsWide || Math.max(8, Math.round(Math.sqrt((maxCount * towerW) / budgetH)));
      let sp = Math.min(towerW / wide, 9);
      let rows = Math.ceil(maxCount / wide);
      if (rows * sp > budgetH) { sp = budgetH / rows; }
      const rr = Math.max(1.4, Math.min(sp * 0.42, 3.2));
      const step = a.w / n;
      const baseY = a.y + a.h * 0.94;

      self.regions = [];
      self.meta = [];
      const slots = new Map();
      const geo = new Map();
      groups.forEach((g, gi) => {
        const cnt = counts.get(g.key) || 0;
        const gw = wide * sp;
        const gx = a.x + step * gi + (step - gw) / 2;
        geo.set(g.key, { gx, gi });
        slots.set(g.key, 0);
        const h = Math.ceil(cnt / wide) * sp;
        self.regions.push({ x: gx - 6, y: baseY - h - 6, w: gw + 12, h: h + 12, data: { name: g.label, value: g.value, sub: g.sub } });
        self.meta.push({ g, x: gx + gw / 2, topY: baseY - h, cnt });
      });

      const targets = new Map();
      for (const d of selection) {
        const k = keyFn(d);
        if (!geo.has(k)) { targets.set(d, null); continue; }
        const s = slots.get(k); slots.set(k, s + 1);
        const { gx } = geo.get(k);
        const col = s % wide, row = Math.floor(s / wide);
        targets.set(d, { x: gx + col * sp + sp / 2, y: baseY - row * sp - sp / 2 });
      }
      const g0 = new Map(groups.map((g) => [g.key, g]));
      return (d) => {
        const t = targets.get(d);
        if (!t) return { a: 0, x: 0, y: 0 };
        const g = g0.get(keyFn(d));
        return { x: t.x, y: t.y, color: g.color || NEUTRAL, r: rr };
      };
    },
    draw(ctx, view, t) {
      const al = fade(t, 0.7, 0.9);
      if (al <= 0) return;
      ctx.globalAlpha = al;
      ctx.textAlign = "center";
      for (const m of self.meta) {
        ctx.font = `500 13px ${FONT_SANS}`;
        const nLines = countLines(ctx, m.g.label, 180);
        ctx.fillStyle = INK_SOFT;
        wrapText(ctx, m.g.label, m.x, m.topY - 12, 180, 15);
        ctx.fillStyle = INK;
        ctx.font = `600 15px ${FONT_SANS}`;
        ctx.fillText(fmt(m.g.value), m.x, m.topY - 12 - nLines * 15 - 6);
        if (m.g.sub) {
          ctx.fillStyle = INK_MUTE;
          ctx.font = `400 11.5px ${FONT_SANS}`;
          const a = stageArea(view);
          ctx.fillText(m.g.sub, m.x, a.y + a.h * 0.94 + 18);
        }
      }
      ctx.globalAlpha = 1;
    },
  };
  return self;
}

function countLines(ctx, text, maxW) {
  const words = String(text).split(" ");
  let lines = 1, line = "";
  for (const w of words) {
    const test = line ? line + " " + w : w;
    if (ctx.measureText(test).width > maxW && line) { lines++; line = w; }
    else line = test;
  }
  return lines;
}

function wrapText(ctx, text, x, y, maxW, lh) {
  const words = String(text).split(" ");
  const lines = [];
  let line = "";
  for (const w of words) {
    const test = line ? line + " " + w : w;
    if (ctx.measureText(test).width > maxW && line) { lines.push(line); line = w; }
    else line = test;
  }
  lines.push(line);
  lines.reverse().forEach((l, i) => ctx.fillText(l, x, y - i * lh));
}

// ── Horizontal dot bars (top-N causes) ───────────────────────────────────
// rows: [{key, label, value, color, note?, highlight?}] ; keyFn(dot) -> key
export function hbars({ rows, keyFn, title = null, rowGapPx = 20, labelW = null } = {}) {
  const self = {
    regions: [],
    place(selection, view) {
      const a = stageArea(view);
      const counts = new Map(rows.map((r) => [r.key, 0]));
      for (const d of selection) {
        const k = keyFn(d);
        if (counts.has(k)) counts.set(k, counts.get(k) + 1);
      }
      const lw = labelW ?? Math.min(210, Math.max(130, view.w * 0.18));
      const availW = a.w - lw - 90;
      const maxCount = Math.max(1, ...rows.map((r) => counts.get(r.key) || 0));
      // bar thickness: rows of dots; pick spacing so longest bar fits
      let sp = 5.2;
      let dotRows = Math.min(6, Math.max(2, Math.ceil((maxCount * sp) / availW)));
      let cols = Math.ceil(maxCount / dotRows);
      if (cols * sp > availW) sp = availW / cols;
      const rr = Math.max(1.3, Math.min(sp * 0.42, 2.4));
      const barH = dotRows * sp;
      const n = rows.length;
      const noteRows = rows.filter((r) => r.note).length;
      const blockH = barH + rowGapPx + (noteRows ? 6 : 0);
      const totalH = n * blockH + (title ? 30 : 0);
      const y0 = a.y + Math.max(10, (a.h - totalH) / 2) + (title ? 30 : 0);
      const x0 = a.x + lw;

      self.geom = { y0, x0, blockH, barH, sp, lw, title, a };
      self.regions = [];
      const rowGeo = new Map();
      rows.forEach((r, ri) => {
        const cnt = counts.get(r.key) || 0;
        const w = Math.ceil(cnt / dotRows) * sp;
        const ry = y0 + ri * blockH;
        rowGeo.set(r.key, { ri, ry, slot: 0 });
        self.regions.push({
          x: a.x, y: ry - 6, w: lw + w + 70, h: barH + 12,
          data: { name: r.label, value: r.value, sub: r.sub, note: r.note },
        });
        r._w = w; r._y = ry; r._cnt = cnt;
      });
      const targets = new Map();
      for (const d of selection) {
        const k = keyFn(d);
        const g = rowGeo.get(k);
        if (!g) { targets.set(d, null); continue; }
        const s = g.slot++;
        const col = Math.floor(s / dotRows), row = s % dotRows;
        targets.set(d, { x: x0 + col * sp + sp / 2, y: g.ry + row * sp + sp / 2 });
      }
      const rmap = new Map(rows.map((r) => [r.key, r]));
      return (d) => {
        const t = targets.get(d);
        if (!t) return { a: 0, x: 0, y: 0 };
        return { x: t.x, y: t.y, color: rmap.get(keyFn(d)).color || NEUTRAL, r: rr };
      };
    },
    draw(ctx, view, t) {
      if (!self.geom) return;
      const { y0, x0, barH, lw, title, a } = self.geom;
      const al = fade(t, 0.7, 0.8);
      if (al <= 0) return;
      ctx.globalAlpha = al;
      if (title) {
        ctx.textAlign = "left";
        ctx.fillStyle = INK_MUTE;
        ctx.font = `600 12px ${FONT_SANS}`;
        ctx.fillText(title.toUpperCase(), a.x, y0 - 26);
      }
      for (const r of rows) {
        const cy = r._y + barH / 2;
        ctx.textAlign = "right";
        ctx.fillStyle = r.highlight ? GOLD : INK_SOFT;
        ctx.font = `${r.highlight ? 600 : 500} 13px ${FONT_SANS}`;
        ctx.fillText(r.label, x0 - 12, cy + 4);
        ctx.textAlign = "left";
        ctx.fillStyle = INK;
        ctx.font = `600 13px ${FONT_SANS}`;
        ctx.fillText(fmt(r.value), x0 + r._w + 10, cy + 4);
        if (r.note) {
          ctx.fillStyle = GOLD;
          ctx.font = `500 12px ${FONT_SANS}`;
          ctx.fillText(r.note, x0 + r._w + 10 + ctx.measureText(fmt(r.value)).width + 18, cy + 4);
        }
      }
      ctx.globalAlpha = 1;
    },
  };
  return self;
}

// ── 100%-stacked share columns by age band (the crossover) ───────────────
// bands: [{age, byL1, total}], l1Order: [names], colors via L1_COLOR_DARK
export function stackedShare({ bands, l1Order, annotate = true } = {}) {
  const self = {
    regions: [],
    place(selection, view) {
      const a = stageArea(view);
      const n = bands.length;
      const step = a.w / n;
      const colW = Math.min(step * 0.55, 110);
      const H = a.h * 0.74;
      const y0 = a.y + (a.h - H) / 2 - 8;

      self.geom = { a, step, colW, H, y0 };
      self.regions = [];
      const geo = new Map();
      bands.forEach((b, bi) => {
        const total = b.total;
        const cnt = selection.reduce((s, d) => s + (d.age === b.age ? 1 : 0), 0);
        // near-square grid per band: constant column width, density varies
        const wide = Math.max(4, Math.round(Math.sqrt((cnt * colW) / H)));
        const rowsNeeded = Math.ceil(cnt / wide);
        const sp = H / Math.max(1, rowsNeeded);
        const spx = colW / wide;
        const gx = a.x + step * bi + (step - wide * spx) / 2;
        geo.set(b.age, { gx, sp, spx, wide, slot: 0, bi });
        const shares = {};
        for (const l1 of l1Order) shares[l1] = (b.byL1[l1] || 0) / total;
        self.regions.push({
          x: gx - 8, y: y0 - 6, w: wide * spx + 16, h: H + 12,
          data: {
            name: `Ages ${b.age}`,
            value: total,
            sub: l1Order.map((l1) => `${Math.round(shares[l1] * 100)}% ${shortL1(l1)}`).join(" · "),
          },
        });
        b._shares = shares; b._gx = gx + (wide * spx) / 2; b._wide = wide; b._spx = spx;
      });
      const targets = new Map();
      // selection arrives in roster order (L1-major), so per-band fills are
      // contiguous L1 segments bottom-up
      for (const d of selection) {
        const g = geo.get(d.age);
        if (!g) { targets.set(d, null); continue; }
        const s = g.slot++;
        const col = s % g.wide, row = Math.floor(s / g.wide);
        targets.set(d, { x: g.gx + col * g.spx + g.spx / 2, y: y0 + H - row * g.sp - g.sp / 2 });
      }
      return (d) => {
        const t = targets.get(d);
        if (!t) return { a: 0, x: 0, y: 0 };
        return { x: t.x, y: t.y, color: L1_COLOR_DARK[d.l1] || NEUTRAL, r: 2 };
      };
    },
    draw(ctx, view, t) {
      if (!self.geom) return;
      const { y0, H } = self.geom;
      const al = fade(t, 0.7, 1.0);
      if (al <= 0) return;
      ctx.globalAlpha = al;
      ctx.textAlign = "center";
      for (const b of bands) {
        ctx.fillStyle = INK;
        ctx.font = `600 14px ${FONT_SANS}`;
        ctx.fillText(b.age === "<5" ? "Under 5" : b.age, b._gx, y0 + H + 26);
        ctx.fillStyle = INK_MUTE;
        ctx.font = `400 11.5px ${FONT_SANS}`;
        ctx.fillText(`${fmt(b.total)} deaths`, b._gx, y0 + H + 44);
        if (annotate) {
          const cm = Math.round((b._shares[l1Order[0]] || 0) * 100);
          const nc = Math.round((b._shares[l1Order[1]] || 0) * 100);
          ctx.font = `600 12px ${FONT_SANS}`;
          ctx.fillStyle = INK;
          ctx.fillText(cm + "%", b._gx, y0 + H - (b._shares[l1Order[0]] || 0) * H / 2 + 4);
          const ncY = y0 + H - ((b._shares[l1Order[0]] || 0) + (b._shares[l1Order[1]] || 0) / 2) * H + 4;
          ctx.fillText(nc + "%", b._gx, ncY);
        }
      }
      ctx.globalAlpha = 1;
    },
  };
  return self;
}

function shortL1(name) {
  if (name.startsWith("Communicable")) return "communicable";
  if (name.startsWith("Noncommunicable")) return "NCDs";
  return "injuries";
}

// ── Legend row for L1 colors (drawn as overlay when needed) ──────────────
export function l1Legend(items) {
  return (ctx, view, t) => {
    const al = fade(t, 0.6, 0.5);
    if (al <= 0) return;
    const a = stageArea(view);
    ctx.globalAlpha = al;
    ctx.font = `500 12px ${FONT_SANS}`;
    let widths = items.map((it) => ctx.measureText(it.label).width + 26);
    const total = widths.reduce((s, w) => s + w, 0);
    let x = a.x + (a.w - total) / 2;
    const y = a.y - 18;
    for (let i = 0; i < items.length; i++) {
      ctx.fillStyle = items[i].color;
      ctx.beginPath();
      ctx.arc(x + 5, y - 4, 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = INK_SOFT;
      ctx.textAlign = "left";
      ctx.fillText(items[i].label, x + 14, y);
      x += widths[i];
    }
    ctx.globalAlpha = 1;
  };
}
