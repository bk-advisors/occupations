// Data layer: flattens the WHO GHE tree and mints the dot roster.
// One dot = 1,000 deaths. Every dot carries a (leaf cause, age band) identity
// so any scene can re-form the same dots along either dimension.

import { causes } from "../data/causes.js";
import { causesByAge } from "../data/causesByAge.js";
import { meta } from "../data/meta.js";

export { meta };

export const DEATHS_PER_DOT = 1000;
export const AGE_BANDS = ["<5", "5-14", "15-49", "50-69", "70+"];

export const L1_CMNN = "Communicable, maternal, perinatal and nutritional conditions";
export const L1_NCD = "Noncommunicable diseases";
export const L1_INJ = "Injuries";
export const L1_ORDER = [L1_CMNN, L1_NCD, L1_INJ];

export const L1_SHORT = {
  [L1_CMNN]: "Communicable, maternal & nutritional",
  [L1_NCD]: "Non-communicable diseases",
  [L1_INJ]: "Injuries",
};

// ── Flatten tree to leaves tagged with L1/L2 ancestry ────────────────────
function walkLeaves(node, l1, l2) {
  const out = [];
  if (!node.children) {
    if (node.ID) out.push({ ID: node.ID, name: node.name, size: node.size, l1, l2 });
    return out;
  }
  const depth = node.ID ? node.ID.split(".").length : 0;
  const nextL1 = depth === 1 ? node.name : l1;
  const nextL2 = depth === 2 ? node.name : l2;
  for (const c of node.children) out.push(...walkLeaves(c, nextL1, nextL2));
  return out;
}

export const allLeaves = walkLeaves(causes, null, null);
const leafByID = new Map(allLeaves.map((l) => [l.ID, l]));
const leafByName = new Map(allLeaves.map((l) => [l.name, l]));

export function leafNamed(name) {
  return leafByName.get(name) || null;
}

// ── Per-leaf per-age values ──────────────────────────────────────────────
const ageByID = new Map();
for (const r of causesByAge) {
  if (!ageByID.has(r.ID)) ageByID.set(r.ID, {});
  ageByID.get(r.ID)[r.age] = +r.value;
}

export function deaths(id, age = null) {
  if (!age) return leafByID.get(id)?.size || 0;
  return ageByID.get(id)?.[age] || 0;
}

// ── Aggregates ───────────────────────────────────────────────────────────
export const totalDeaths = meta.totalDeaths;
export const totalByAge = meta.totalByAge;

export const l1Totals = {};
for (const leaf of allLeaves) l1Totals[leaf.l1] = (l1Totals[leaf.l1] || 0) + leaf.size;

export function topCauses({ age = null, topN = 10, l1Filter = null } = {}) {
  const rows = allLeaves
    .filter((l) => !l1Filter || l.l1 === l1Filter)
    .map((l) => ({ ID: l.ID, name: l.name, l1: l.l1, l2: l.l2, value: deaths(l.ID, age) }))
    .filter((r) => r.value > 0)
    .sort((a, b) => b.value - a.value);
  return rows.slice(0, topN);
}

// [{age, byL1: {l1Name: n}, total}]
export function l1ByAge() {
  return AGE_BANDS.map((age) => {
    const byL1 = {};
    for (const leaf of allLeaves) {
      byL1[leaf.l1] = (byL1[leaf.l1] || 0) + deaths(leaf.ID, age);
    }
    return { age, byL1, total: Object.values(byL1).reduce((a, b) => a + b, 0) };
  });
}

// ── Dot roster ───────────────────────────────────────────────────────────
// Systematic rounding over (leaf × age) cells: walk cells in a stable order
// (L1 order → leaf ID → age band), carry the fractional remainder, so the
// grand total lands within one dot of totalDeaths / 1000.
function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function buildRoster() {
  const sorted = [...allLeaves].sort((a, b) => {
    const la = L1_ORDER.indexOf(a.l1) - L1_ORDER.indexOf(b.l1);
    if (la !== 0) return la;
    return a.ID.localeCompare(b.ID, undefined, { numeric: true });
  });
  const rand = mulberry32(20210831);
  const roster = [];
  let cum = 0, minted = 0;
  for (const leaf of sorted) {
    for (const age of AGE_BANDS) {
      const v = deaths(leaf.ID, age);
      if (!v) continue;
      cum += v / DEATHS_PER_DOT;
      const want = Math.floor(cum);
      while (minted < want) {
        roster.push({
          i: minted,
          leafID: leaf.ID,
          name: leaf.name,
          l1: leaf.l1,
          l2: leaf.l2,
          age,
          // stable per-dot jitter seeds for organic field layouts
          jx: rand(), jy: rand(), jr: rand(),
        });
        minted++;
      }
    }
  }
  return roster;
}

export const roster = buildRoster();

// Convenience: dot counts per leaf(+age) as actually minted, so bar lengths
// always match the dots on stage rather than an independently rounded value.
export function dotsWhere(pred) {
  return roster.filter(pred);
}

export const commaFormat = (n) => Math.round(n).toLocaleString("en-US");

// Compact display for captions/labels: 450,000 → "450,000", 1.8M stays exact.
export function fmt(n) { return commaFormat(n); }
