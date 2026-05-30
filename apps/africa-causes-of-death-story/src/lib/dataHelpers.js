// Small helpers for slicing the WHO GHE tree the way the story scenes need it.

import { causes } from "../data/causes.js";
import { causesByAge } from "../data/causesByAge.js";

// ── Flatten the tree to a list of leaves, each tagged with its L1 group. ──
function _walkLeaves(node, l1, l2) {
  const out = [];
  if (!node.children) {
    if (node.ID) out.push({ ID: node.ID, name: node.name, size: node.size, l1, l2 });
    return out;
  }
  const nextL1 = node.ID && node.ID.split(".").length === 1 ? node.name : l1;
  const nextL2 = node.ID && node.ID.split(".").length === 2 ? node.name : l2;
  for (const c of node.children) out.push(..._walkLeaves(c, nextL1, nextL2));
  return out;
}

export const allLeaves = _walkLeaves(causes, null, null);

// L1 ID → friendly short label + sort order.
export const L1_META = {
  "Communicable, maternal, perinatal and nutritional conditions": {
    short: "Communicable, maternal &amp; nutritional",
    shorter: "CMNN",
    order: 0,
  },
  "Noncommunicable diseases": { short: "Non-communicable", shorter: "NCDs", order: 1 },
  "Injuries": { short: "Injuries", shorter: "Injuries", order: 2 },
};

export function l1Short(name) { return L1_META[name]?.short || name; }
export function l1Shorter(name) { return L1_META[name]?.shorter || name; }

// ── Per-leaf age values, keyed by ID. ────────────────────────────────────
const ageByID = new Map();
for (const r of causesByAge) {
  if (!ageByID.has(r.ID)) ageByID.set(r.ID, {});
  ageByID.get(r.ID)[r.age] = +r.value;
}

export function deathsForLeaf(id, age) {
  if (!age) {
    const leaf = allLeaves.find((l) => l.ID === id);
    return leaf ? leaf.size : 0;
  }
  return ageByID.get(id)?.[age] || 0;
}

// ── Top-N causes for a given age band (or all-ages). ──────────────────────
export function topCauses({ age = null, topN = 10, l1Filter = null } = {}) {
  const rows = allLeaves
    .filter((l) => !l1Filter || l.l1 === l1Filter)
    .map((l) => ({
      ID: l.ID,
      name: l.name,
      l1: l.l1,
      l2: l.l2,
      value: deathsForLeaf(l.ID, age),
    }))
    .filter((r) => r.value > 0);
  rows.sort((a, b) => b.value - a.value);
  return rows.slice(0, topN);
}

// ── Totals by L1 across age bands (for the stacked-share chart). ──────────
export const AGE_BANDS = ["<5", "5-14", "15-49", "50-69", "70+"];

export function l1ByAge() {
  // Returns array: [{age, byL1: {CMNN: n, NCD: n, INJ: n}, total: n}]
  return AGE_BANDS.map((age) => {
    const byL1 = {};
    for (const leaf of allLeaves) {
      const v = deathsForLeaf(leaf.ID, age);
      const key = leaf.l1;
      byL1[key] = (byL1[key] || 0) + v;
    }
    const total = Object.values(byL1).reduce((a, b) => a + b, 0);
    return { age, byL1, total };
  });
}

// ── Color scale for L1 groups (Tufte-friendly: 3 distinct hues). ─────────
export function colorForL1(l1) {
  // Read from CSS so the palette stays in app.css.
  const v = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  if (l1 === "Communicable, maternal, perinatal and nutritional conditions") return v("--l1-cmnn") || "#C9483A";
  if (l1 === "Noncommunicable diseases") return v("--l1-ncd") || "#4E3A6B";
  if (l1 === "Injuries") return v("--l1-injury") || "#E5B25D";
  return "#888";
}
