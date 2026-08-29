// Data layer: statistics helpers, the dot roster, and every number the film
// quotes. Nothing in scenes.js types a figure; it all comes from here, which
// comes from data/reversion.js, which came from the story's researched file.
//
// The film's one unit is SIGMA. Every dot that stands for a person carries a z
// score against a named reference population, so a quarterback, a prime
// minister and a department store fortune can share one ruler.

import {
  TRAITS, DYNASTIES, GALTON, HEIGHT, OFFICE_RUBRIC, SOURCES,
  halfLife, cite, citeUrl, byDomain,
} from "../data/reversion.js";

export { TRAITS, DYNASTIES, GALTON, HEIGHT, OFFICE_RUBRIC, SOURCES, halfLife, cite, citeUrl, byDomain };

// ── Maths ────────────────────────────────────────────────────────────────
export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
export const lerp = (a, b, t) => a + (b - a) * t;

export function mean(arr, acc = (d) => d) {
  if (!arr.length) return 0;
  return arr.reduce((s, d) => s + acc(d), 0) / arr.length;
}

export function sd(arr, acc = (d) => d) {
  if (arr.length < 2) return 0;
  const m = mean(arr, acc);
  return Math.sqrt(arr.reduce((s, d) => s + (acc(d) - m) ** 2, 0) / (arr.length - 1));
}

// Abramowitz & Stegun 7.1.26. Good to ~1e-7, which is far past what any label
// in this film prints.
export function erf(x) {
  const s = x < 0 ? -1 : 1;
  x = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * x);
  const y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return s * y;
}

export const Phi = (z) => 0.5 * (1 + erf(z / Math.SQRT2));
export const normPdf = (z) => Math.exp(-0.5 * z * z) / Math.sqrt(2 * Math.PI);

// Weighted ordinary least squares. Returns the slope, intercept and r that the
// film quotes, so a caption can never drift from the line actually drawn.
export function ols(rows, gx, gy, gw = () => 1) {
  let sw = 0, sx = 0, sy = 0, sxx = 0, syy = 0, sxy = 0;
  for (const r of rows) {
    const w = gw(r), x = gx(r), y = gy(r);
    if (!isFinite(x) || !isFinite(y) || !w) continue;
    sw += w; sx += w * x; sy += w * y;
    sxx += w * x * x; syy += w * y * y; sxy += w * x * y;
  }
  if (!sw) return { slope: 0, intercept: 0, r: 0, n: 0, mx: 0, my: 0 };
  const mx = sx / sw, my = sy / sw;
  const vxx = sxx / sw - mx * mx;
  const vyy = syy / sw - my * my;
  const vxy = sxy / sw - mx * my;
  const slope = vxx ? vxy / vxx : 0;
  return {
    slope,
    intercept: my - slope * mx,
    r: vxx && vyy ? vxy / Math.sqrt(vxx * vyy) : 0,
    n: rows.length, mx, my,
  };
}

// Seeded PRNG. Never Math.random: the same seed must give the same picture on
// every load, or the film cannot be screenshotted or reviewed.
function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Box-Muller off a uniform source.
function normalFrom(rand) {
  let u = 0, v = 0;
  while (u === 0) u = rand();
  while (v === 0) v = rand();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

// ── People: the 40 pairs flattened to 80 individuals ─────────────────────
export const PAIRS = DYNASTIES.map((d, ix) => ({
  ix,
  id: d.id,
  domain: d.domain,
  family: d.family,
  metric: d.metric,
  basis: d.basis,
  note: d.note,
  source: d.source,
  pz: d.parent.z,
  cz: d.child.z,
  parent: d.parent,
  child: d.child,
  // A pair is verified only when BOTH generations are published figures.
  verified: d.parent.verified !== false && d.child.verified !== false,
  dir: d.child.z > d.parent.z + 0.001 ? "rise" : d.child.z < d.parent.z - 0.001 ? "fall" : "level",
}));

export const PEOPLE = PAIRS.flatMap((p) => [
  { ...p.parent, pairID: p.id, gen: "parent", domain: p.domain, family: p.family, metric: p.metric, basis: p.basis, pairIx: p.ix },
  { ...p.child, pairID: p.id, gen: "child", domain: p.domain, family: p.family, metric: p.metric, basis: p.basis, pairIx: p.ix },
]);

export const personNamed = (name) => PEOPLE.find((p) => p.name === name) || null;
export const pairNamed = (id) => PAIRS.find((p) => p.id === id) || null;

// The Vanderbilt chain read as five consecutive generations rather than four
// overlapping pairs: 5.32, 5.34, 4.86, 3.97, 1.47.
export const VANDERBILT_CHAIN = (() => {
  const links = PAIRS.filter((p) => p.id.startsWith("vanderbilt-")).sort((a, b) => a.id.localeCompare(b.id));
  const out = [links[0].parent];
  for (const l of links) out.push(l.child);
  return out.map((p, i) => ({ ...p, gen: i }));
})();

// ── Galton's tally, expanded to one row per child ────────────────────────
// Galton's figures are binned, so children are spread inside their bin to show
// density. Seeded, so the cloud is identical on every load.
export const GALTON_CHILDREN = (() => {
  const rand = mulberry32(18860217);
  const out = [];
  for (const [mid, child, count] of GALTON) {
    for (let k = 0; k < count; k++) {
      out.push({
        gi: out.length,
        mid: mid + (rand() - 0.5) * 0.9,   // mid-parent bins are ~1 inch
        child: child + (rand() - 0.5) * 0.9,
        midBin: mid,
        childBin: child,
      });
    }
  }
  return out;
})();

export const GALTON_FIT = ols(GALTON, (d) => d[0], (d) => d[1], (d) => d[2]);
export const GALTON_N = GALTON.reduce((s, r) => s + r[2], 0);
export const GALTON_MID_MEAN = GALTON_FIT.mx;
export const GALTON_CHILD_MEAN = GALTON_FIT.my;

// ── Fitted results across the dynasty pairs ──────────────────────────────
export const DYNASTY_FIT = ols(PAIRS, (p) => p.pz, (p) => p.cz);
export const DYNASTY_FIT_VERIFIED = ols(PAIRS.filter((p) => p.verified), (p) => p.pz, (p) => p.cz);

export const DIRECTION_COUNTS = PAIRS.reduce((a, p) => { a[p.dir]++; return a; }, { fall: 0, rise: 0, level: 0 });

// Retention (mean child z over mean parent z) is stable where a slope fitted
// to 40 hand-picked families is not, so the film compares domains on this and
// never on a per-domain slope. See RESUME.md, "Statistical framing".
export function retention(domain) {
  const rows = domain ? PAIRS.filter((p) => p.domain === domain) : PAIRS;
  return mean(rows, (p) => p.cz) / mean(rows, (p) => p.pz);
}

// ── The survivors model ──────────────────────────────────────────────────
// The children nobody plots. Modelled, not observed: that is the whole point,
// because measurement stops the moment a child stops being interesting. A
// child is drawn from the honest model (child z = r * parent z + noise) and
// counted invisible when they fall below the bar at which anyone still keeps a
// number on them.
export const VISIBILITY_BAR = 1.6;   // z below which a child leaves the record
const SURVIVOR_N = 220;

export const SURVIVORS = (() => {
  const rand = mulberry32(20250714);
  const r = HEIGHT.r;
  const resid = Math.sqrt(1 - r * r);
  const parents = PAIRS.map((p) => p.pz);
  const out = [];
  for (let i = 0; i < SURVIVOR_N; i++) {
    const pz = parents[i % parents.length] + (rand() - 0.5) * 0.5;
    const cz = r * pz + normalFrom(rand) * resid * 1.55;
    out.push({ si: i, pz, cz, visible: cz >= VISIBILITY_BAR });
  }
  return out;
})();

export const SURVIVOR_FIT_ALL = ols(SURVIVORS, (d) => d.pz, (d) => d.cz);
export const SURVIVOR_FIT_VISIBLE = ols(SURVIVORS.filter((d) => d.visible), (d) => d.pz, (d) => d.cz);
export const SURVIVOR_LOST_SHARE = SURVIVORS.filter((d) => !d.visible).length / SURVIVORS.length;

// ── The Galton board ─────────────────────────────────────────────────────
// A ball's bin is the count of rights in a seeded walk down the peg rows, so
// the pile is a real binomial rather than a drawn bell. Each ball carries two
// independent walks: the first drop, and the re-drop where only the durable
// part of its position is kept and the luck is rolled again.
export const BOARD_ROWS = 7;
export const BOARD_BALLS = 232;

export const BALLS = (() => {
  const rand = mulberry32(19770104);
  const out = [];
  for (let i = 0; i < BOARD_BALLS; i++) {
    const walk1 = [], walk2 = [];
    for (let k = 0; k < BOARD_ROWS; k++) {
      walk1.push(rand() < 0.5 ? -1 : 1);
      walk2.push(rand() < 0.5 ? -1 : 1);
    }
    const bin1 = walk1.reduce((s, v) => s + (v > 0 ? 1 : 0), 0);
    const bin2 = walk2.reduce((s, v) => s + (v > 0 ? 1 : 0), 0);
    out.push({ bi: i, walk1, walk2, bin1, bin2 });
  }
  return out;
})();

// The selection the second drop acts on: literally the far right bin, which is
// what the narration claims. Balls that went right at all seven pegs.
export const BOARD_TOP_BIN = BOARD_ROWS;
export const BOARD_SELECTED = BALLS.filter((b) => b.bin1 >= BOARD_TOP_BIN - 1);

// Where a selected ball lands on its second drop. It keeps the durable part of
// its offset from centre and re-rolls the rest, which is the film's whole
// argument stated as arithmetic.
export const REDROP_KEEP = HEIGHT.r;
export function redropBin(ball) {
  const centre = BOARD_ROWS / 2;
  const durable = (ball.bin1 - centre) * REDROP_KEEP;
  const luck = (ball.bin2 - centre) * Math.sqrt(1 - REDROP_KEEP * REDROP_KEEP);
  return clamp(Math.round(centre + durable + luck), 0, BOARD_ROWS);
}

// ── Dot roster ───────────────────────────────────────────────────────────
// Three kinds of dot, all in one pool so formations can hand the same dots
// from scene to scene:
//   galton  928 of Galton's adult children. The scatter, and the board balls.
//   person   80 individuals from the 40 dynasty pairs.
//   crowd   760 modelled people, drawn standard normal. The population every
//           sigma ruler is measured against.
//   unseen  220 modelled parent-child pairs for the survivors scene.
//
// crowd and unseen are deliberately separate kinds. They were one kind at
// first, and mixing them put the survivors' child z scores (which centre near
// +2, not 0) into the population histogram, so every bell in the film came out
// lopsided with a long right tail. A bell drawn from this pool has to be a
// bell the arithmetic produced, or the chapter 4 argument is a drawing.
function buildRoster() {
  const rand = mulberry32(20260728);
  const roster = [];
  const push = (o) => roster.push({ i: roster.length, jx: rand(), jy: rand(), jr: rand(), ...o });

  for (const g of GALTON_CHILDREN) {
    push({
      kind: "galton", gi: g.gi,
      mid: g.mid, child: g.child, midBin: g.midBin, childBin: g.childBin,
      // A Galton child also has a z, so the same dots can be a height cloud in
      // one scene and a population on the sigma ruler in the next.
      z: (g.child - GALTON_CHILD_MEAN) / 2.5,
      // Board identity: the first BOARD_BALLS Galton dots are also the balls.
      ball: g.gi < BOARD_BALLS ? BALLS[g.gi] : null,
    });
  }

  for (const p of PEOPLE) {
    push({
      kind: "person", name: p.name, pairID: p.pairID, pairIx: p.pairIx,
      gen: p.gen, domain: p.domain, family: p.family, role: p.role, years: p.years,
      stat: p.stat, metric: p.metric, basis: p.basis,
      z: p.z, zLow: p.zLow, zHigh: p.zHigh, verified: p.verified !== false,
    });
  }

  for (const s of SURVIVORS) {
    push({ kind: "unseen", si: s.si, pz: s.pz, cz: s.cz, visible: s.visible, z: s.cz });
  }
  // The population itself: unnamed people drawn standard normal, which is what
  // a rarity z score places everyone against.
  for (let k = 0; k < 760; k++) {
    push({ kind: "crowd", ci: k, z: normalFrom(rand) });
  }

  return roster;
}

export const roster = buildRoster();

// ── Numbers the film quotes ──────────────────────────────────────────────
// Every one of these is derived. If a caption wants a figure, it takes it from
// here, so a caption and the chart under it cannot disagree.
const lebronZ = (HEIGHT.lebron - HEIGHT.mean) / HEIGHT.sd;
const bronnyZ = (HEIGHT.bronny - HEIGHT.mean) / HEIGHT.sd;
const predZ = lebronZ * HEIGHT.r;
const predHeight = HEIGHT.mean + predZ * HEIGHT.sd;
const residSd = HEIGHT.sd * Math.sqrt(1 - HEIGHT.r * HEIGHT.r);

export const N = {
  galtonN: GALTON_N,
  galtonSlope: GALTON_FIT.slope,
  galtonR: GALTON_FIT.r,

  heightR: HEIGHT.r,
  lebronZ, bronnyZ, predZ, predHeight,
  predError: Math.abs(predHeight - HEIGHT.bronny),
  gapInches: HEIGHT.lebron - HEIGHT.bronny,
  piRange: 2 * 1.96 * residSd,
  lebronRarity: 1 / (1 - Phi(lebronZ)),
  bronnyPct: Phi(bronnyZ),

  dynastyN: PAIRS.length,
  dynastySlope: DYNASTY_FIT.slope,
  dynastyR: DYNASTY_FIT.r,
  dynastyVerifiedN: PAIRS.filter((p) => p.verified).length,
  dynastyVerifiedSlope: DYNASTY_FIT_VERIFIED.slope,
  dynastyHandback: 1 - DYNASTY_FIT.slope,

  survivorSlopeVisible: SURVIVOR_FIT_VISIBLE.slope,
  survivorSlopeAll: SURVIVOR_FIT_ALL.slope,
  survivorLostShare: SURVIVOR_LOST_SHARE,

  halflifeHeight: halfLife(TRAITS.find((t) => t.id === "height").r),
  halflifeLifespan: halfLife(TRAITS.find((t) => t.id === "lifespan").r),
  halflifeSurname: halfLife(TRAITS.find((t) => t.id === "surname").r),
  halflifeIncome: halfLife(TRAITS.find((t) => t.id === "income").r),
};

// ── Formatting ───────────────────────────────────────────────────────────
export const fmt = (n) => Math.round(n).toLocaleString("en-US");
export const sigma = (z, dp = 1) => `${z >= 0 ? "+" : "−"}${Math.abs(z).toFixed(dp)}σ`;
export const pct = (v, dp = 0) => `${(v * 100).toFixed(dp)}%`;

// Inches to feet and inches, with prime marks. The film uses 6′ 1.5″ form on a
// chart and the prose form in a caption.
export function fmtFt(inches, { prose = false } = {}) {
  const ft = Math.floor(inches / 12);
  const rem = inches - ft * 12;
  const r = Math.abs(rem - Math.round(rem)) < 0.05 ? String(Math.round(rem)) : rem.toFixed(1);
  return prose ? `${ft} foot ${r}` : `${ft}′ ${r}″`;
}

// "1 in 2,900". The film uses this for how rare a height is.
export const oneIn = (n) => `1 in ${fmt(n)}`;

export const gens = (g) => (g < 1 ? `${g.toFixed(1)} of a generation` : `${g.toFixed(1)} generations`);
