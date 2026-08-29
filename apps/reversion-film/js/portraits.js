// Portraits: circular Wikipedia photographs with a thick ring, drawn onto the
// canvas beside the mark for the person they belong to.
//
// Every image, its author and its licence come from img/portraits.json, which
// the fetch script generates from the Wikipedia and Wikimedia Commons APIs.
// The end card prints that manifest as a credits list, so nothing appears on
// screen that is not attributed. A missing or slow image never blocks a beat:
// draw() returns false and the caller falls back to a plain labelled mark.

const RING = "#FAF6EE";

class Portraits {
  constructor() {
    this.entries = [];
    this.images = new Map();   // slug -> HTMLImageElement (complete or loading)
    this.ready = false;
  }

  async load(base = "") {
    try {
      const res = await fetch(`${base}img/portraits.json`);
      if (!res.ok) throw new Error(res.status);
      this.entries = await res.json();
    } catch {
      this.entries = [];
      return false;
    }
    await Promise.all(this.entries.map((e) => new Promise((resolve) => {
      const img = new Image();
      img.decoding = "async";
      img.addEventListener("load", () => resolve(), { once: true });
      img.addEventListener("error", () => { this.images.delete(e.slug); resolve(); }, { once: true });
      img.src = `${base}${e.file}`;
      this.images.set(e.slug, img);
    })));
    this.ready = true;
    return true;
  }

  has(slug) {
    const img = this.images.get(slug);
    return !!(img && img.complete && img.naturalWidth);
  }

  entry(slug) { return this.entries.find((e) => e.slug === slug) || null; }

  // Circular portrait centred at (x, y). Returns false if the image is not
  // usable, so callers can fall back rather than draw a hole.
  //
  // The square crop is taken from the upper part of the frame, not the centre:
  // in a portrait photograph the face sits high, and a centred square crop
  // reliably cuts the top of the head off.
  draw(ctx, slug, x, y, r, { alpha = 1, ring = 3, ringColor = RING, dim = 0 } = {}) {
    const img = this.images.get(slug);
    if (!img || !img.complete || !img.naturalWidth || alpha <= 0.004) return false;

    const iw = img.naturalWidth, ih = img.naturalHeight;
    const side = Math.min(iw, ih);
    const sx = (iw - side) / 2;
    const sy = Math.min(ih - side, (ih - side) * 0.18);

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(img, sx, sy, side, side, x - r, y - r, r * 2, r * 2);
    if (dim > 0) {
      ctx.fillStyle = `rgba(20,17,38,${dim})`;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
    ctx.restore();

    if (ring > 0) {
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = ringColor;
      ctx.lineWidth = ring;
      ctx.beginPath();
      ctx.arc(x, y, r + ring / 2, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    return true;
  }

  // Credits, grouped so the end card prints one line per licence rather than
  // twenty-four near-identical ones.
  creditLines() {
    const byLic = new Map();
    for (const e of this.entries) {
      if (!byLic.has(e.licence)) byLic.set(e.licence, []);
      byLic.get(e.licence).push(e);
    }
    const order = [...byLic.keys()].sort((a, b) => byLic.get(b).length - byLic.get(a).length);
    return order.map((lic) => ({
      licence: lic,
      people: byLic.get(lic).map((e) => e.name),
      authors: [...new Set(byLic.get(lic).map((e) => e.author).filter((a) => a && a !== "not stated" && a !== "unknown"))],
    }));
  }
}

export const portraits = new Portraits();
