// Africa's Causes of Death — explorable treemap.
//
// Hierarchical treemap (CMNN / NCDs / Injuries → groups → causes).
// Rectangle area = number of deaths. Color = cause group (L1).
// Click any rectangle to drill in; click breadcrumb to back out.
// Sidebar "Selected" panel updates on every click with full age-band
// breakdown for the focused node.

const AGE_BANDS = ["<5", "5-14", "15-49", "50-69", "70+"];

const AGE_VAR = {
  "<5":    "--age-under5",
  "5-14":  "--age-5-14",
  "15-49": "--age-15-49",
  "50-69": "--age-50-69",
  "70+":   "--age-70plus",
};

const cssVar = (name, fallback) =>
  getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;

const commaFormat = d3.format(",");

const L1_KEY = {
  "Communicable, maternal, perinatal and nutritional conditions": "cmnn",
  "Noncommunicable diseases": "ncd",
  "Injuries": "injury",
};
const L1_SHORT = {
  "Communicable, maternal, perinatal and nutritional conditions": "Communicable, maternal & nutritional",
  "Noncommunicable diseases": "Non-communicable diseases",
  "Injuries": "Injuries",
};

const state = {
  fullRoot: null,        // d3.hierarchy, full data
  focus: null,           // current focus node
  ageData: null,         // Map<leafID, [{age, value}]>
  totalDeaths: 0,
  width: 0,
  height: 0,
  svg: null,
  g: null,
};

main().catch((err) => {
  console.error(err);
  document.getElementById("loadText").textContent =
    "Failed to load data — check console.";
});

async function main() {
  const [tree, byAge] = await Promise.all([
    d3.json("data/causes.json"),
    d3.csv("data/causes-by-age.csv", (d) => ({ ID: d.ID, age: d.age, value: +d.value })),
  ]);

  state.ageData = d3.group(byAge, (d) => d.ID);

  document.getElementById("loadText")?.remove();

  // Build the hierarchy once. Annotate every node with its L1 ancestor
  // name (for coloring) and a numeric `total` for layout.
  const root = d3.hierarchy(tree)
    .sum((d) => d.size || 0)
    .sort((a, b) => b.value - a.value);

  // Walk and stamp L1 ancestor.
  root.each((n) => {
    let p = n;
    while (p && p.depth > 1) p = p.parent;
    n.l1Name = p && p.depth === 1 ? p.data.name : null;
  });

  state.fullRoot = root;
  state.focus = root;
  state.totalDeaths = root.value;

  initChart();
  populateSearch(root);
  renderFocus(root, /*animate*/ false);
  showRootDetail();

  window.addEventListener("resize", debounce(() => {
    initChart();
    renderFocus(state.focus, false);
  }, 200));
}

function debounce(fn, wait) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), wait); };
}

function initChart() {
  const chartEl = document.getElementById("chart");
  state.width  = Math.max(chartEl.clientWidth, 360);
  state.height = Math.max(chartEl.clientHeight, 540);

  d3.select("#chart").selectAll("svg").remove();
  state.svg = d3.select("#chart").append("svg")
    .attr("viewBox", `0 0 ${state.width} ${state.height}`)
    .attr("width", "100%")
    .attr("height", "100%")
    .style("display", "block");

  state.g = state.svg.append("g");

  // Tooltip — singleton on body.
  if (!document.querySelector(".nodeTooltip")) {
    d3.select("body").append("div").attr("class", "nodeTooltip").style("opacity", 0);
  }
}

function l1Color(name) {
  const k = L1_KEY[name];
  if (k === "cmnn")   return cssVar("--l1-cmnn",   "#C9483A");
  if (k === "ncd")    return cssVar("--l1-ncd",    "#4E3A6B");
  if (k === "injury") return cssVar("--l1-injury", "#E5B25D");
  return "#888";
}

// ── Treemap layout + render ───────────────────────────────────────────────
function renderFocus(focus, animate = true) {
  state.focus = focus;

  // Run d3.treemap on a SHALLOW copy of the focus subtree so that the focus
  // becomes the root and fills the rect. d3.hierarchy().copy() preserves
  // structure cleanly.
  const sub = d3.hierarchy(treeFor(focus))
    .sum((d) => d.size || 0)
    .sort((a, b) => b.value - a.value);

  const treemap = d3.treemap()
    .size([state.width, state.height])
    .paddingOuter(focus === state.fullRoot ? 4 : 8)
    .paddingTop((d) => (d.children && d.depth > 0) ? 18 : 4)
    .paddingInner(2)
    .round(true);
  treemap(sub);

  // We render: every internal node (as a labeled "group" rect) and every leaf
  // (as a clickable rect). Group rects get a top label band; leaves get fill
  // by L1 color (looked up from the matching node in the FULL hierarchy).

  const allNodes = sub.descendants();
  const tooltip = d3.select(".nodeTooltip");

  // ── Internal "group" rects (depth > 0 and has children) ────────────────
  const groupNodes = allNodes.filter((d) => d.depth > 0 && d.children);
  const leafNodes  = allNodes.filter((d) => !d.children && d.data.ID);

  // Bind groups
  let groups = state.g.selectAll("g.group").data(groupNodes, (d) => d.data.ID || d.data.name);
  groups.exit().remove();
  const groupsEnter = groups.enter().append("g").attr("class", "group");
  groupsEnter.append("rect").attr("class", "group-rect");
  groupsEnter.append("text").attr("class", "group-label");
  groups = groupsEnter.merge(groups);

  groups.attr("data-id", (d) => d.data.ID || "")
    .style("cursor", (d) => isInteractive(d) ? "pointer" : "default");

  const rectSel = groups.select("rect.group-rect");
  const labelSel = groups.select("text.group-label");

  const groupTransition = animate
    ? rectSel.transition().duration(600)
    : rectSel;

  groupTransition
    .attr("x",      (d) => d.x0)
    .attr("y",      (d) => d.y0)
    .attr("width",  (d) => Math.max(0, d.x1 - d.x0))
    .attr("height", (d) => Math.max(0, d.y1 - d.y0))
    .attr("fill",   (d) => groupBg(d))
    .attr("stroke", (d) => l1Color(rootL1OfFocus(d)))
    .attr("stroke-width", 1);

  const labelTransition = animate
    ? labelSel.transition().duration(600)
    : labelSel;

  labelTransition
    .attr("x", (d) => d.x0 + 8)
    .attr("y", (d) => d.y0 + 12)
    .text((d) => labelForGroup(d));

  // Group click handler — drill in
  groups
    .on("click", (event, d) => {
      event.stopPropagation();
      if (!isInteractive(d)) return;
      drillTo(matchInFullRoot(d));
    })
    .on("mouseover", (event, d) => showTip(event, d))
    .on("mousemove", moveTip)
    .on("mouseout", hideTip);

  // ── Leaf rects ────────────────────────────────────────────────────────
  let leaves = state.g.selectAll("g.leaf").data(leafNodes, (d) => d.data.ID);
  leaves.exit().remove();
  const leavesEnter = leaves.enter().append("g").attr("class", "leaf");
  leavesEnter.append("rect").attr("class", "leaf-rect");
  leavesEnter.append("text").attr("class", "leaf-name");
  leavesEnter.append("text").attr("class", "leaf-value");
  leaves = leavesEnter.merge(leaves);

  leaves.style("cursor", "pointer");

  const leafRectSel  = leaves.select("rect.leaf-rect");
  const leafNameSel  = leaves.select("text.leaf-name");
  const leafValueSel = leaves.select("text.leaf-value");

  const leafRectT = animate ? leafRectSel.transition().duration(600) : leafRectSel;
  leafRectT
    .attr("x",      (d) => d.x0)
    .attr("y",      (d) => d.y0)
    .attr("width",  (d) => Math.max(0, d.x1 - d.x0))
    .attr("height", (d) => Math.max(0, d.y1 - d.y0))
    .attr("fill",   (d) => l1Color(rootL1OfFocus(d)))
    .attr("opacity", 0.92);

  // Labels — only when the rect is big enough.
  const leafNameT = animate ? leafNameSel.transition().duration(600) : leafNameSel;
  leafNameT
    .attr("x", (d) => d.x0 + 6)
    .attr("y", (d) => d.y0 + 14)
    .text((d) => {
      const w = d.x1 - d.x0;
      const h = d.y1 - d.y0;
      if (w < 60 || h < 22) return "";
      return truncateTo(d.data.name, Math.floor((w - 12) / 6.2));
    });

  const leafValueT = animate ? leafValueSel.transition().duration(600) : leafValueSel;
  leafValueT
    .attr("x", (d) => d.x0 + 6)
    .attr("y", (d) => d.y0 + 28)
    .text((d) => {
      const w = d.x1 - d.x0;
      const h = d.y1 - d.y0;
      if (w < 60 || h < 36) return "";
      return commaFormat(Math.round(d.value));
    });

  leaves
    .on("click", (event, d) => {
      event.stopPropagation();
      const matched = matchInFullRoot(d);
      // For leaves: don't drill (no children), but show detail.
      showDetail(matched);
    })
    .on("mouseover", (event, d) => showTip(event, d))
    .on("mousemove", moveTip)
    .on("mouseout", hideTip);

  // Background click anywhere → zoom out one level if possible.
  state.svg.on("click", () => {
    if (state.focus !== state.fullRoot && state.focus.parent) {
      drillTo(state.focus.parent);
    }
  });

  // Tooltip handlers (used by both groups and leaves)
  function showTip(event, d) {
    const total = commaFormat(Math.round(d.value));
    const share = ((d.value / state.totalDeaths) * 100).toFixed(2);
    tooltip
      .html(`<strong>${escapeHTML(d.data.name)}</strong> — ${total} deaths · ${share}%`)
      .style("opacity", 1);
  }
  function moveTip(event) {
    tooltip
      .style("left", event.pageX + 12 + "px")
      .style("top",  event.pageY + 12 + "px");
  }
  function hideTip() { tooltip.style("opacity", 0); }

  // Refresh breadcrumb
  renderBreadcrumb();
}

// Build a tree-shape data object FROM a hierarchy node, so d3.treemap can
// re-layout it as its own root.
function treeFor(node) {
  const copy = (n) => ({
    name: n.data.name,
    ID:   n.data.ID || null,
    size: n.children ? undefined : (n.data.size || 0),
    children: n.children ? n.children.map(copy) : undefined,
  });
  return copy(node);
}

function rootL1OfFocus(d) {
  // Walk up the SUB tree to find the L1 ancestor whose name maps to a known L1.
  let p = d;
  while (p && !L1_KEY[p.data.name]) p = p.parent;
  return p ? p.data.name : (state.focus.l1Name || d.l1Name);
}

function groupBg(d) {
  // Subtle tint of the L1 color. Use cream + L1 hue at low opacity.
  const ground = cssVar("--ground", "#FAF6EE");
  return ground;
}

function isInteractive(d) {
  // A group is clickable if it has children below it (drill-down possible).
  return d.children && d.children.length > 0;
}

function labelForGroup(d) {
  const totalK = d.value >= 1000 ? (d.value / 1000).toFixed(0) + "k" : String(d.value);
  const name = d.depth === 1 ? L1_SHORT[d.data.name] || d.data.name : d.data.name;
  return `${name}  ·  ${totalK}`;
}

function truncateTo(s, n) {
  if (!s) return "";
  return s.length <= n ? s : s.slice(0, Math.max(1, n - 1)) + "…";
}

// Locate the FULL-tree node corresponding to a SUB-tree node (matching by ID
// if possible, else by name).
function matchInFullRoot(subNode) {
  if (subNode.data.ID) {
    return state.fullRoot.descendants().find((n) => n.data.ID === subNode.data.ID) || subNode;
  }
  return state.fullRoot.descendants().find((n) => n.data.name === subNode.data.name) || subNode;
}

function drillTo(node) {
  if (!node) return;
  renderFocus(node, true);
  showDetail(node);
}

// ── Breadcrumb ────────────────────────────────────────────────────────────
function renderBreadcrumb() {
  let crumb = document.getElementById("breadcrumb");
  if (!crumb) {
    crumb = document.createElement("div");
    crumb.id = "breadcrumb";
    crumb.className = "breadcrumb";
    document.getElementById("chart").before(crumb);
  }
  const trail = state.focus.ancestors().reverse();
  crumb.innerHTML = trail.map((n, i) => {
    const last = i === trail.length - 1;
    const name = i === 0 ? "All causes" : (L1_SHORT[n.data.name] || n.data.name);
    if (last) return `<span class="bc-current">${escapeHTML(name)}</span>`;
    return `<button class="bc-link" data-depth="${n.depth}">${escapeHTML(name)}</button>`;
  }).join('<span class="bc-sep">›</span>');

  crumb.querySelectorAll(".bc-link").forEach((btn) => {
    btn.addEventListener("click", () => {
      const d = +btn.dataset.depth;
      const target = state.focus.ancestors().find((a) => a.depth === d);
      if (target) drillTo(target);
    });
  });
}

// ── Sidebar detail panel ──────────────────────────────────────────────────
function showRootDetail() {
  const panel = document.getElementById("detail");
  if (!panel) return;
  const total = state.totalDeaths;
  const byAge = aggregateByAge(state.fullRoot);

  panel.innerHTML = `
    <h3>Selected</h3>
    <div class="detail-card">
      <div class="detail-name">All causes</div>
      <div class="detail-meta">WHO African Region · 2021</div>
      <div class="detail-total"><strong>${commaFormat(Math.round(total))}</strong> deaths · 100%</div>
      <div class="detail-section-title">By age band</div>
      <div class="detail-bars">${ageBarsHTML(byAge, max(byAge))}</div>
      <p class="detail-hint">Click any rectangle to drill in. Click empty space to zoom out.</p>
    </div>
  `;
}

function showDetail(node) {
  const panel = document.getElementById("detail");
  if (!panel) return;

  const matched = matchInFullRoot(node);
  const isLeaf = !matched.children || matched.children.length === 0;
  const value = matched.value;
  const sharePct = ((value / state.totalDeaths) * 100).toFixed(2);
  const byAge = aggregateByAge(matched);
  const maxV = max(byAge);

  const trail = matched.ancestors().slice(1, -1).reverse()
    .map((d) => L1_SHORT[d.data.name] || d.data.name);

  panel.innerHTML = `
    <h3>Selected</h3>
    <div class="detail-card">
      ${trail.length ? `<div class="detail-trail">${trail.map(escapeHTML).join(" › ")}</div>` : ""}
      <div class="detail-name">${escapeHTML(matched.data.name)}</div>
      <div class="detail-meta">${isLeaf ? "Cause" : "Group"} · ${commaFormat(Math.round(value))} deaths</div>
      <div class="detail-total"><strong>${sharePct}%</strong> of all African deaths in 2021</div>
      <div class="detail-section-title">By age band</div>
      <div class="detail-bars">${ageBarsHTML(byAge, maxV)}</div>
      ${isLeaf ? "" : `<p class="detail-hint">Click the rectangle in the chart to drill further, or click another to compare.</p>`}
    </div>
  `;
}

function aggregateByAge(node) {
  const out = Object.fromEntries(AGE_BANDS.map((a) => [a, 0]));
  const leaves = !node.children ? [node] : node.descendants().filter((d) => !d.children);
  for (const leaf of leaves) {
    const rows = state.ageData.get(leaf.data.ID);
    if (!rows) continue;
    for (const r of rows) out[r.age] = (out[r.age] || 0) + +r.value;
  }
  return out;
}

function max(byAge) {
  return Math.max(...AGE_BANDS.map((a) => byAge[a] || 0));
}

function ageBarsHTML(byAge, maxV) {
  return AGE_BANDS.map((age) => {
    const v = byAge[age] || 0;
    const pct = maxV > 0 ? (v / maxV) * 100 : 0;
    return `
      <div class="age-row">
        <span class="age-row-label">${age}</span>
        <span class="age-row-bar"><span style="width:${pct}%;background:var(${AGE_VAR[age]})"></span></span>
        <span class="age-row-value">${commaFormat(Math.round(v))}</span>
      </div>
    `;
  }).join("");
}

function escapeHTML(s) {
  return String(s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// ── Native search box ────────────────────────────────────────────────────
function populateSearch(root) {
  const select = document.getElementById("searchBox");
  if (!select) return;
  const items = Array.from(new Set(root.descendants()
    .filter((d) => d.data.ID)
    .map((d) => d.data.name))).filter(Boolean).sort();
  for (const name of items) {
    const opt = document.createElement("option");
    opt.value = name;
    opt.textContent = name;
    select.appendChild(opt);
  }
  select.addEventListener("change", (e) => {
    const name = e.target.value;
    if (!name) { drillTo(state.fullRoot); return; }
    const target = state.fullRoot.descendants().find((d) => d.data.name === name);
    if (target) {
      // If leaf, drill to its parent so the leaf is visible inside the focused
      // rectangle. If group, drill to it.
      const focus = target.children ? target : (target.parent || target);
      drillTo(focus);
      showDetail(target);
    }
  });
}
