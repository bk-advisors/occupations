<script>
  // Horizontal bar chart — top-N causes for the active age band.
  // Position+length encoding, directly labeled, colored by L1 group.
  // Annotation lives in the figure caption, not overlaid on the chart.
  // A highlighted bar gets a subtle outline so the eye finds it.
  //
  // Props:
  //   ageBand:    "<5" | "5-14" | "15-49" | "50-69" | "70+" | null
  //   topN:       number of bars (default 10)
  //   title:      chart title
  //   subtitle:   small subtitle line (plain text — < signs are fine)
  //   annotation: { targetID, note }  — narrative note + matching bar to outline

  import { topCauses, colorForL1, l1Shorter } from "./dataHelpers.js";
  import { format } from "d3-format";
  import { scaleLinear } from "d3-scale";

  export let ageBand = null;
  export let topN = 10;
  export let title = "";
  export let subtitle = "";
  export let annotation = null;

  const comma = format(",");

  const VB_W = 600;
  const VB_H = 460;
  const M = { top: 24, right: 90, bottom: 24, left: 200 };
  const innerW = VB_W - M.left - M.right;
  const innerH = VB_H - M.top - M.bottom;

  $: data = topCauses({ age: ageBand, topN });
  $: max  = data.length ? Math.max(...data.map((d) => d.value)) : 1;
  $: x    = scaleLinear().domain([0, max]).range([0, innerW]);
  $: rowH = innerH / Math.max(data.length, 1);
  $: barH = Math.min(26, rowH * 0.72);

  $: highlightedName = (() => {
    if (!annotation) return "";
    const target = data.find((d) => d.ID === annotation.targetID);
    return target ? target.name : "";
  })();

  // Pull the unique L1 groups currently visible — for the inline legend.
  $: l1Set = Array.from(new Set(data.map((d) => d.l1)));

  function trim(s, max = 30) {
    return s.length > max ? s.slice(0, max - 1) + "…" : s;
  }
</script>

<figure class="chart">
  {#if title}
    <figcaption>
      <h3>{title}</h3>
      {#if subtitle}<p class="sub">{subtitle}</p>{/if}
      <div class="legend">
        {#each l1Set as l1}
          <span class="swatch" style="background:{colorForL1(l1)}"></span>{l1Shorter(l1)}&nbsp;&nbsp;
        {/each}
      </div>
    </figcaption>
  {/if}

  <svg viewBox="0 0 {VB_W} {VB_H}" preserveAspectRatio="xMinYMin meet" role="img">
    <g transform="translate({M.left},{M.top})">
      <line x1="0" x2={innerW} y1={innerH + 1} y2={innerH + 1} class="axis-rule" />

      {#each data as d, i (d.ID)}
        {@const y = i * rowH + (rowH - barH) / 2}
        {@const w = x(d.value)}
        {@const isHi = annotation && d.ID === annotation.targetID}
        <g class="row" class:is-hi={isHi} transform="translate(0,{y})">
          <text
            class="cause-label"
            x={-8}
            y={barH / 2}
            text-anchor="end"
            dominant-baseline="middle"
          >{trim(d.name)}</text>
          <rect
            x={0}
            y={0}
            width={w}
            height={barH}
            fill={colorForL1(d.l1)}
            class="bar"
          />
          <text
            class="value"
            x={w + 6}
            y={barH / 2}
            dominant-baseline="middle"
          >{comma(d.value)}</text>
        </g>
      {/each}
    </g>
  </svg>

  {#if annotation && annotation.note}
    <p class="annotation">
      {#if highlightedName}<strong>{highlightedName}.</strong>{/if}
      {annotation.note}
    </p>
  {/if}
</figure>

<style>
  .chart {
    margin: 0;
    padding: 0;
  }

  figcaption {
    margin: 0 0 0.75rem;
  }
  figcaption h3 {
    font-family: var(--font-serif);
    font-weight: 600;
    font-size: clamp(1.15rem, 1.9vw, 1.5rem);
    margin: 0 0 0.15em;
    line-height: 1.2;
    color: var(--ink);
  }
  .sub {
    font-family: var(--font-sans);
    font-size: 0.82rem;
    color: var(--ink-muted);
    margin: 0 0 0.5rem;
  }
  .legend {
    font-family: var(--font-sans);
    font-size: 0.72rem;
    color: var(--ink-muted);
    letter-spacing: 0.03em;
  }
  .swatch {
    display: inline-block;
    width: 0.7em;
    height: 0.7em;
    margin-right: 0.3em;
    vertical-align: middle;
    border-radius: 1px;
  }

  svg {
    width: 100%;
    height: auto;
    font-family: var(--font-sans);
    display: block;
  }

  .row {
    transition: opacity 600ms ease;
  }

  .bar {
    transition: width 700ms cubic-bezier(0.4, 0, 0.2, 1), fill 500ms ease;
  }

  .row.is-hi .bar {
    /* Subtle outline so the eye finds the annotated bar without distorting size. */
    stroke: var(--ink);
    stroke-width: 1;
  }
  .row.is-hi .cause-label,
  .row.is-hi .value {
    font-weight: 600;
    fill: var(--ink);
  }

  .cause-label {
    font-family: var(--font-serif);
    font-size: 13px;
    fill: var(--ink);
  }

  .value {
    font-family: var(--font-sans);
    font-size: 11px;
    fill: var(--ink-muted);
    font-feature-settings: "tnum";
  }

  .axis-rule {
    stroke: var(--rule);
    stroke-width: 0.75;
  }

  .annotation {
    font-family: var(--font-serif);
    font-size: 0.92rem;
    line-height: 1.45;
    color: var(--ink-muted);
    margin: 0.85rem 0 0;
    padding: 0.5rem 0 0 0.85rem;
    border-left: 2px solid var(--ink);
  }
  .annotation strong {
    color: var(--ink);
    font-weight: 600;
  }
</style>
