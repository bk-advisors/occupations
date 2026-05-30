<script>
  // Total deaths per age band — 5 horizontal bars. Used in the early "where
  // do the deaths actually fall?" scene to set up the under-5 dominance.

  import { l1ByAge, AGE_BANDS } from "./dataHelpers.js";
  import { format } from "d3-format";
  import { scaleLinear } from "d3-scale";

  export let highlight = null;  // optional age band to emphasize
  export let title = "";
  export let subtitle = "";

  const comma = format(",");

  const VB_W = 600;
  const VB_H = 320;
  const M = { top: 50, right: 110, bottom: 30, left: 80 };
  const innerW = VB_W - M.left - M.right;
  const innerH = VB_H - M.top - M.bottom;

  $: data = l1ByAge();    // [{age, byL1, total}]
  $: max  = Math.max(...data.map((d) => d.total));
  $: x    = scaleLinear().domain([0, max]).range([0, innerW]);
  $: rowH = innerH / AGE_BANDS.length;
  $: barH = Math.min(34, rowH * 0.65);

  function isDim(age) {
    if (!highlight) return false;
    return age !== highlight;
  }

  // Total-share label (e.g. "32%") next to bar.
  $: total = data.reduce((s, d) => s + d.total, 0);
</script>

<figure class="chart">
  {#if title}
    <figcaption>
      <h3>{@html title}</h3>
      {#if subtitle}<p class="sub">{subtitle}</p>{/if}
    </figcaption>
  {/if}

  <svg viewBox="0 0 {VB_W} {VB_H}" preserveAspectRatio="xMinYMin meet" role="img">
    <g transform="translate({M.left},{M.top})">
      {#each data as d, i (d.age)}
        {@const y = i * rowH + (rowH - barH) / 2}
        {@const w = x(d.total)}
        {@const pct = ((d.total / total) * 100).toFixed(0)}
        {@const dim = isDim(d.age)}
        <g class="row" class:dim transform="translate(0,{y})">
          <text class="age-label" x={-8} y={barH / 2} text-anchor="end" dominant-baseline="middle">
            {d.age}
          </text>
          <rect x={0} y={0} width={w} height={barH} fill="var(--ink)" class="bar" />
          <text class="value" x={w + 6} y={barH / 2 - 5} dominant-baseline="middle">
            {comma(d.total)}
          </text>
          <text class="pct" x={w + 6} y={barH / 2 + 8} dominant-baseline="middle">
            {pct}% of all deaths
          </text>
        </g>
      {/each}
    </g>
  </svg>
</figure>

<style>
  .chart { margin: 0; }

  figcaption { margin: 0 0 0.5rem; padding-left: 8px; }
  figcaption h3 {
    font-family: var(--font-serif);
    font-weight: 600;
    font-size: clamp(1.1rem, 1.8vw, 1.4rem);
    margin: 0 0 0.15em;
    line-height: 1.2;
  }
  .sub { font-family: var(--font-sans); font-size: 0.82rem; color: var(--ink-muted); margin: 0; }

  svg { width: 100%; height: auto; display: block; }

  .row { transition: opacity 600ms ease; }
  .row.dim { opacity: 0.22; }

  .bar { transition: width 700ms cubic-bezier(0.4,0,0.2,1); fill: var(--ink); }

  .age-label {
    font-family: var(--font-sans);
    font-size: 14px;
    font-weight: 500;
    fill: var(--ink);
  }
  .value {
    font-family: var(--font-sans);
    font-size: 12px;
    font-weight: 600;
    fill: var(--ink);
    font-feature-settings: "tnum";
  }
  .pct {
    font-family: var(--font-sans);
    font-size: 10px;
    fill: var(--ink-muted);
  }
</style>
