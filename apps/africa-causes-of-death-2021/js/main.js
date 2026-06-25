// Africa's Causes of Death — explorable zoomable icicle.
//
// Horizontal icicle (partition) layout: every row is a level of the WHO/GBD
// taxonomy (All causes → CMNN/NCDs/Injuries → groups → causes); a block's
// width is its share of deaths. Color = top-level cause group (L1), with a
// slight lightening per depth so nesting stays legible.
//
// Click any block to zoom into it (it becomes the full-width top row and its
// descendants re-expand below). Click the top row — or anywhere in the
// background — to zoom back out one level. Hover updates the sidebar "Selected"
// panel with the age-band breakdown; a tooltip shows deaths + share.

const AGE_BANDS = ["<5", "5-14", "15-49", "50-69", "70+"];

const AGE_VAR = {
  "<5":    "--age-under5",
  "5-14":  "--age-5-14",
  "15-49": "--age-15-49",
  "50-69": "--age-50-69",
  "70+":   "--age-70plus",
};

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

const MAX_VISIBLE_DEPTH = 3; // rows shown below the focused row

const cssVar = (name, fallback) =>
  getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;

const commaFormat = d3.format(",");

const state = {
  root: null,        // d3.hierarchy, full data (layout coords cached on it)
  focus: null,       // currently focused node
  ageData: null,     // Map<leafID, [{age, value}]>
  totalDeaths: 0,
  width: 0,
  height: 0,
  rowH: 76,
  svg: null,
  g: null,
};

main().catch((err) => {
  console.error(err);
  const el = document.getElementById("loadText");
  if (el) el.textContent = "Failed to load data — check console.";
});

async function main() {
  const [tree, byAge] = await Promise.all([
    d3.json("data/causes.json"),
    d3.csv("data/causes-by-age.csv", (d) => ({ ID: d.ID, age: d.age, value: +d.value })),
  ]);

  state.ageData = d3.group(byAge, (d) => d.ID);

  const root = d3.hierarchy(tree)
    .sum((d) => d.size || 0)
    .sort((a, b) => b.value - a.value);

  // Stamp each node with its L1 ancestor name (used for coloring).
  root.each((n) => {
    let p = n;
    while (p && p.depth > 1) p = p.parent;
    n.l1Name = p && p.depth === 1 ? p.data.name : null;
  });

  state.root = root;
  state.focus = root;
  state.totalDeaths = root.value;

  document.getElementById("loadText")?.remove();
  ensureScaffold();
  populateSearch(root);
  layoutAndDraw(false);
  showDetail(root, /*pinned*/ true);

  window.addEventListener("resize", debounce(() => layoutAndDraw(false), 180));
}

function debounce(fn, wait) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), wait); };
}

// ── One-time DOM scaffold: breadcrumb + svg + tooltip ─────────────────────
function ensureScaffold() {
  const chartEl = document.getElementById("chart");

  if (!document.getElementById("breadcrumb")) {
    const crumb = document.createElement("div");
    crumb.id = "breadcrumb";
    crumb.className = "breadcrumb";
    chartEl.before(crumb);
  }
  if (!document.querySelector(".nodeTooltip")) {
    d3.select("body").append("div").attr("class", "nodeTooltip").style("opacity", 0);
  }
}

// ── Layout: run the partition once at the current size, cache coords ──────
function layoutAndDraw(animate) {
  const chartEl = document.getElementById("chart");
  state.width  = Math.max(chartEl.clientWidth, 360);
  // Fit MAX_VISIBLE_DEPTH+1 rows comfortably; clamp the row height.
  const avail  = Math.max(chartEl.clientHeight, 480);
  state.rowH   = Math.max(58, Math.min(96, avail / (MAX_VISIBLE_DEPTH + 1)));
  state.height = state.rowH * (MAX_VISIBLE_DEPTH + 1);

  d3.partition().size([state.width, state.height]).padding(0)(
    state.root.sum((d) => d.size || 0).sort((a, b) => b.value - a.value)
  );
  // Cache the "original" full-canvas coords; per-focus we rescale x off these.
  state.root.each((d) => { d.x0o = d.x0; d.x1o = d.x1; });

  d3.select("#chart").selectAll("svg").remove();
  state.svg = d3.select("#chart").append("svg")
    .attr("viewBox", `0 0 ${state.width} ${state.height}`)
    .attr("width", "100%")
    .attr("height", state.height)
    .style("display", "block");
  state.g = state.svg.append("g");

  draw(animate);
}

function l1Color(name) {
  const k = L1_KEY[name];
  if (k === "cmnn")   return cssVar("--l1-cmnn",   "#C9483A");
  if (k === "ncd")    return cssVar("--l1-ncd",    "#4E3A6B");
  if (k === "injury") return cssVar("--l1-injury", "#E5B25D");
  return "#8A8378";
}

// Block fill: L1 hue, lightened a touch per level of depth so a child reads
// as distinct from its parent. The focused row (and true root) is neutral.
function blockFill(d) {
  if (d.depth === 0) return cssVar("--ground-deep", "#F1EADC");
  const base = l1Color(d.depth === 1 ? d.data.name : d.l1Name);
  const c = d3.color(base);
  if (!c) return base;
  return c.copy({ opacity: Math.max(0.5, 1 - (d.depth - 1) * 0.16) }).toString();
}

// ── Draw the focused subtree as icicle rows ───────────────────────────────
function draw(animate = true) {
  const focus = state.focus;
  const x = d3.scaleLinear().domain([focus.x0o, focus.x1o]).range([0, state.width]);
  const nodes = focus.descendants().filter((d) => d.depth <= focus.depth + MAX_VISIBLE_DEPTH);

  const yOf = (d) => (d.depth - focus.depth) * state.rowH;
  const wOf = (d) => Math.max(0, x(d.x1o) - x(d.x0o));

  const tooltip = d3.select(".nodeTooltip");
  const t = state.g.transition().duration(animate ? 600 : 0);

  const cells = state.g.selectAll("g.cell").data(nodes, (d) => d.data.ID || d.data.name);
  cells.exit().remove();

  const enter = cells.enter().append("g").attr("class", "cell");
  enter.append("rect").attr("class", "cell-rect").attr("rx", 2);
  enter.append("clipPath")
    .attr("id", (d) => "iclip-" + (d.data.ID || slug(d.data.name)))
    .append("rect");
  enter.append("text").attr("class", "cell-name").attr("x", 8).attr("y", 20);
  enter.append("text").attr("class", "cell-val").attr("x", 8).attr("y", 36);

  const all = enter.merge(cells);

  all.style("cursor", "pointer")
    .on("click", (event, d) => {
      event.stopPropagation();
      // Clicking the focused row zooms out; clicking a child zooms in.
      const target = (d === focus && d.parent) ? d.parent : d;
      zoomTo(target);
    })
    .on("mouseenter", (event, d) => { showDetail(d, false); showTip(event, d); })
    .on("mousemove", (event) => moveTip(event))
    .on("mouseleave", () => { showDetail(state.focus, true); hideTip(); });

  all.transition(t).attr("transform", (d) => `translate(${x(d.x0o)},${yOf(d)})`);

  all.select("rect.cell-rect").transition(t)
    .attr("width", wOf)
    .attr("height", state.rowH - 3)
    .attr("fill", blockFill)
    .attr("stroke", cssVar("--ground", "#FAF6EE"));

  all.select("clipPath rect")
    .attr("width", (d) => Math.max(0, wOf(d) - 6))
    .attr("height", state.rowH - 3);

  all.select("text.cell-name")
    .attr("clip-path", (d) => `url(#iclip-${d.data.ID || slug(d.data.name)})`)
    .attr("fill", (d) => d.depth === 0 ? cssVar("--ink", "#1F1B3A") : "#fff")
    .text((d) => {
      if (wOf(d) < 44) return "";
      return d.depth === 0 ? "All causes" : (L1_SHORT[d.data.name] || d.data.name);
    });

  all.select("text.cell-val")
    .attr("clip-path", (d) => `url(#iclip-${d.data.ID || slug(d.data.name)})`)
    .attr("fill", (d) => d.depth === 0 ? cssVar("--ink-muted", "#5C566F") : "rgba(255,255,255,0.9)")
    .text((d) => {
      if (wOf(d) < 44) return "";
      const pct = ((d.value / state.totalDeaths) * 100);
      const pctStr = pct >= 1 ? pct.toFixed(0) : pct.toFixed(1);
      return `${commaFormat(Math.round(d.value))}  ·  ${pctStr}%`;
    });

  // Background click → zoom out one level.
  state.svg.on("click", () => {
    if (state.focus.parent) zoomTo(state.focus.parent);
  });

  function showTip(event, d) {
    const total = commaFormat(Math.round(d.value));
    const share = ((d.value / state.totalDeaths) * 100).toFixed(2);
    const name = d.depth === 0 ? "All causes" : d.data.name;
    tooltip.html(`<strong>${escapeHTML(name)}</strong> — ${total} deaths · ${share}%`)
      .style("opacity", 1);
  }
  function moveTip(event) {
    tooltip.style("left", event.pageX + 12 + "px").style("top", event.pageY + 12 + "px");
  }
  function hideTip() { tooltip.style("opacity", 0); }

  renderBreadcrumb();
}

function zoomTo(node) {
  if (!node) return;
  state.focus = node;
  draw(true);
  showDetail(node, true);
}

// ── Breadcrumb ────────────────────────────────────────────────────────────
function renderBreadcrumb() {
  const crumb = document.getElementById("breadcrumb");
  if (!crumb) return;
  const trail = state.focus.ancestors().reverse();
  crumb.innerHTML = trail.map((n, i) => {
    const last = i === trail.length - 1;
    const name = i === 0 ? "All causes" : (L1_SHORT[n.data.name] || n.data.name);
    if (last) return `<span class="bc-current">${escapeHTML(name)}</span>`;
    return `<button class="bc-link" data-depth="${n.depth}">${escapeHTML(name)}</button>`;
  }).join('<span class="bc-sep">›</span>');

  crumb.querySelectorAll(".bc-link").forEach((btn) => {
    btn.addEventListener("click", () => {
      const target = state.focus.ancestors().find((a) => a.depth === +btn.dataset.depth);
      if (target) zoomTo(target);
    });
  });
}

// ── Sidebar detail panel ──────────────────────────────────────────────────
function showDetail(node, pinned) {
  const panel = document.getElementById("detail");
  if (!panel) return;

  const isRoot = node === state.root;
  const isLeaf = !node.children;
  const value = node.value;
  const sharePct = ((value / state.totalDeaths) * 100).toFixed(value / state.totalDeaths < 0.1 ? 2 : 1);
  const byAge = aggregateByAge(node);
  const maxV = max(byAge);

  const trail = node.ancestors().slice(1, -1).reverse()
    .map((d) => L1_SHORT[d.data.name] || d.data.name);

  const heading = pinned ? "Selected" : (isLeaf ? "Hovered cause" : "Hovered group");

  panel.innerHTML = `
    <h3>${heading}</h3>
    <div class="detail-card">
      ${trail.length ? `<div class="detail-trail">${trail.map(escapeHTML).join(" › ")}</div>` : ""}
      <div class="detail-name">${isRoot ? "All causes" : escapeHTML(node.data.name)}</div>
      <div class="detail-meta">${isRoot ? "WHO African Region · 2021" : (isLeaf ? "Cause" : "Group")} · ${commaFormat(Math.round(value))} deaths</div>
      <div class="detail-total"><strong>${isRoot ? "100%" : sharePct + "%"}</strong> ${isRoot ? "· 8.3M deaths" : "of all African deaths in 2021"}</div>
      <div class="detail-section-title">By age band</div>
      <div class="detail-bars">${ageBarsHTML(byAge, maxV)}</div>
      <p class="detail-hint">${isLeaf && !isRoot ? "Hover other blocks to compare, or zoom out via the breadcrumb." : "Click any block to zoom in. Click the top row to zoom out."}</p>
    </div>
  `;
}

function aggregateByAge(node) {
  const out = Object.fromEntries(AGE_BANDS.map((a) => [a, 0]));
  const leaves = !node.children ? [node] : node.leaves();
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

// ── Native search box ─────────────────────────────────────────────────────
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
    if (!name) { zoomTo(state.root); return; }
    const target = state.root.descendants().find((d) => d.data.name === name);
    if (!target) return;
    // Zoom so the target is visible: if it has children, focus it; otherwise
    // focus its parent so the leaf shows as a row inside the focused subtree.
    const focus = target.children ? target : (target.parent || target);
    zoomTo(focus);
    showDetail(target, true);
  });
}

function slug(s) {
  return String(s).replace(/[^a-z0-9]+/gi, "-");
}

function escapeHTML(s) {
  return String(s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
