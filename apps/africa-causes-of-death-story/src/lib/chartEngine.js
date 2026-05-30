// Circle-pack-with-inner-age-bars chart engine.
//
// Adapted from Nadieh Bremer's "A Closer Look at Labor" (2015), modernized
// to D3 v7 modular imports. Exposed as a single createChart() factory so a
// Svelte component can mount it once and drive it imperatively via .update().

import { hierarchy, pack } from "d3-hierarchy";
import { scaleLinear, scaleOrdinal } from "d3-scale";
import { format } from "d3-format";
import { select } from "d3-selection";
import { group, rollup, max as d3max } from "d3-array";
import "d3-transition";

const AGE_BANDS = ["<5", "5-14", "15-49", "50-69", "70+"];

// Colors come from CSS custom properties so the palette stays in app.css.
function readCssVar(name, fallback) {
  if (typeof window === "undefined") return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name);
  return v.trim() || fallback;
}

const commaFormat = format(",");

export function createChart(container, dataTree, byAgeRows, opts = {}) {
  const width = opts.width || container.clientWidth;
  const height = opts.height || container.clientHeight;
  const diameter = Math.min(width, height) * 0.92;

  // ── Build d3 hierarchy + run pack layout ───────────────────────────────
  const root = pack()
    .padding(2)
    .size([diameter, diameter])(
      hierarchy(dataTree)
        .sum((d) => d.size || 0)
        .sort((a, b) => (a.data.code || 0) - (b.data.code || 0)),
    );

  // Per-leaf age lookup
  const ageByID = group(byAgeRows, (d) => d.ID);
  const maxByID = rollup(byAgeRows, (v) => d3max(v, (d) => +d.value), (d) => d.ID);

  // ── Color scales ──────────────────────────────────────────────────────
  const ageColor = scaleOrdinal()
    .domain(AGE_BANDS)
    .range([
      readCssVar("--age-under5", "#F4D58D"),
      readCssVar("--age-5-14", "#E5B25D"),
      readCssVar("--age-15-49", "#C9483A"),
      readCssVar("--age-50-69", "#4E3A6B"),
      readCssVar("--age-70plus", "#1F1B3A"),
    ]);

  const depthFill = scaleOrdinal()
    .domain([0, 1, 2, 3])
    .range([
      readCssVar("--depth-0", "#E8DFCB"),
      readCssVar("--depth-1", "#C9BDA1"),
      readCssVar("--depth-2", "#948672"),
      readCssVar("--depth-3", "#5E574A"),
    ]);

  // ── Build SVG scaffold ─────────────────────────────────────────────────
  select(container).selectAll("*").remove();
  const svg = select(container)
    .append("svg")
    .attr("class", "chart-svg")
    .attr("viewBox", `0 0 ${width} ${height}`)
    .attr("width", "100%")
    .attr("height", "100%")
    .style("display", "block");

  const g = svg.append("g").attr("transform", `translate(${width / 2},${height / 2})`);

  // Wrapper per node — translated to its packed (x, y).
  const wrappers = g
    .selectAll("g.node-wrap")
    .data(root.descendants())
    .enter()
    .append("g")
    .attr("class", "node-wrap")
    .attr("transform", (d) => `translate(${d.x - diameter / 2},${d.y - diameter / 2})`)
    .attr("data-id", (d) => d.data.ID || "root");

  // Circles
  wrappers
    .append("circle")
    .attr("class", (d) =>
      !d.parent ? "node--root" : d.children ? "node--branch" : "node--leaf",
    )
    .attr("r", (d) => d.r)
    .style("fill", (d) => (d.children ? depthFill(d.depth) : null));

  // Branch arc labels (top of each parent circle).
  wrappers
    .filter((d) => d.children && d.parent && d.depth <= 2)
    .append("text")
    .attr("class", "arc-label")
    .attr("y", (d) => -d.r - 6)
    .style("font-size", (d) => `${Math.max(9, Math.min(14, d.r / 6))}px`)
    .text((d) => shortenLabel(d.data.name, d.r));

  // ── Inner content for leaves: small bars + label ──────────────────────
  const leafG = wrappers
    .filter((d) => !d.children && d.data.ID)
    .append("g")
    .attr("class", "leaf-inner");

  leafG.each(function (current) {
    const rows = ageByID.get(current.data.ID) || [];
    if (rows.length === 0 || current.r < 14) return;

    const sel = select(this);
    const max = maxByID.get(current.data.ID) || 1;
    const barScale = scaleLinear().domain([0, max]).range([0, current.r * 0.85]);

    const elementsPerBar = AGE_BANDS.length;
    const innerHeight = current.r * 1.3;
    const eachBarH = innerHeight / elementsPerBar;
    const xOffset = -current.r * 0.35;
    const yStart = -current.r * 0.45;

    // Cause label at top
    sel
      .append("text")
      .attr("class", "leaf-label leaf-name")
      .attr("y", -current.r * 0.7)
      .style("font-size", `${Math.max(8, current.r / 8)}px`)
      .text(shortenLabel(current.data.name, current.r * 1.6));

    // Bars + age labels + value labels (one row per age band)
    const ordered = AGE_BANDS.map((age) => rows.find((r) => r.age === age))
      .filter(Boolean);

    const barG = sel
      .selectAll("g.bar")
      .data(ordered)
      .enter()
      .append("g")
      .attr("class", "bar")
      .attr("data-age", (d) => d.age)
      .attr("transform", (d, i) => `translate(${xOffset},${yStart + i * eachBarH})`);

    barG
      .append("rect")
      .attr("class", "bar-rect")
      .attr("height", Math.max(2, eachBarH * 0.7))
      .attr("width", (d) => barScale(+d.value))
      .style("fill", (d) => ageColor(d.age))
      .style("opacity", 0.9);

    barG
      .append("text")
      .attr("class", "bar-text")
      .attr("x", -2)
      .attr("y", eachBarH * 0.55)
      .attr("text-anchor", "end")
      .style("font-size", `${Math.max(6, current.r / 16)}px`)
      .text((d) => d.age);

    barG
      .append("text")
      .attr("class", "bar-value")
      .attr("y", eachBarH * 0.55)
      .attr("text-anchor", "start")
      .style("font-size", `${Math.max(6, current.r / 18)}px`)
      .each(function (d) {
        const w = barScale(+d.value);
        const label = +d.value > 999 ? commaFormat(+d.value) : "";
        select(this)
          .attr("x", w + 3)
          .text(label);
      });
  });

  // ── State for view transitions ─────────────────────────────────────────
  let focus = root;
  let activeAge = null; // when set, dim bars not matching this age band
  let visibleL1 = null; // when set, only show this L1 subtree

  function applyState(stateMaybe) {
    const targetId = stateMaybe?.focusId ?? null;
    activeAge = stateMaybe?.activeAge ?? null;
    visibleL1 = stateMaybe?.visibleL1 ?? null;

    // Resolve focus.
    let target = root;
    if (targetId && targetId !== "root") {
      target = root.descendants().find((d) => d.data.ID === targetId) || root;
    }
    focus = target;

    // Translate + scale the entire `g` so focus.r maps to ~diameter/2.
    const k = (diameter * 0.95) / (focus.r * 2);
    const tx = width / 2 - (focus.x - diameter / 2) * k - diameter / 2 * k;
    const ty = height / 2 - (focus.y - diameter / 2) * k - diameter / 2 * k;

    g.transition()
      .duration(1100)
      .attr(
        "transform",
        `translate(${width / 2},${height / 2}) scale(${k}) translate(${-(focus.x - diameter / 2)},${-(focus.y - diameter / 2)})`,
      );

    // Counter-scale stroke widths and label sizes for legibility at zoom.
    g.selectAll(".node--branch, .node--leaf, .node--root")
      .transition()
      .duration(1100)
      .style("stroke-width", `${0.6 / k}px`);

    // Dim non-focus subtrees + filter by visibleL1.
    wrappers
      .transition()
      .duration(900)
      .style("opacity", (d) => {
        if (visibleL1 && !idStartsWith(d.data.ID || "", visibleL1)) return 0.08;
        if (focus === root) return 1;
        // Show the focus, its ancestors, and its descendants — others fade.
        if (d === focus) return 1;
        if (focus.ancestors().includes(d)) return 0.4;
        if (focus.descendants().includes(d)) return 1;
        return 0.08;
      });

    // Age-band dimming on inner bars.
    wrappers.selectAll("g.bar")
      .classed("bar-dim", (d) => activeAge !== null && d.age !== activeAge);
  }

  function idStartsWith(id, prefix) {
    if (!prefix) return true;
    return id === prefix || id.startsWith(prefix + ".");
  }

  // Helper for label truncation
  function shortenLabel(text, maxPx) {
    if (!text) return "";
    const maxChars = Math.max(6, Math.floor(maxPx / 5));
    if (text.length <= maxChars) return text;
    return text.slice(0, maxChars - 1) + "…";
  }

  // Initial render — show root.
  applyState({ focusId: "root" });

  return {
    update: applyState,
    destroy() {
      select(container).selectAll("*").remove();
    },
  };
}

export { AGE_BANDS };
