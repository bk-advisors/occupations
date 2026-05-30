<script>
  // 100% stacked horizontal bar — one row per age band, segments showing
  // the L1 share (CMNN / NCD / Injuries) within that age band.
  //
  // This is the "double burden" chart: the crossover from CMNN-dominant
  // (in the young) to NCD-dominant (in the old) is visceral in this view.

  import { l1ByAge, AGE_BANDS, colorForL1, l1Shorter } from "./dataHelpers.js";
  import { format } from "d3-format";
  import { scaleLinear } from "d3-scale";

  export let title = "";
  export let subtitle = "";

  const pct = format(".0%");

  const VB_W = 600;
  const VB_H = 320;
  const M = { top: 60, right: 30, bottom: 30, left: 70 };
  const innerW = VB_W - M.left - M.right;
  const innerH = VB_H - M.top - M.bottom;

  const L1_ORDER = [
    "Communicable, maternal, perinatal and nutritional conditions",
    "Noncommunicable diseases",
    "Injuries",
  ];

  $: data = l1ByAge();
  $: x = scaleLinear().domain([0, 1]).range([0, innerW]);
  $: rowH = innerH / AGE_BANDS.length;
  $: barH = Math.min(34, rowH * 0.65);
</script>

<figure class="chart">
  {#if title}
    <figcaption>
      <h3>{@html title}</h3>
      {#if subtitle}<p class="sub">{subtitle}</p>{/if}
    </figcaption>
  {/if}

  <svg viewBox="0 0 {VB_W} {VB_H}" preserveAspectRatio="xMinYMin meet" role="img">
    <!-- Legend at the top -->
    <g transform="translate({M.left},{M.top - 36})" class="legend">
      {#each L1_ORDER as l1, i}
        <g transform="translate({i * 145},0)">
          <rect x={0} y={0} width={10} height={10} fill={colorForL1(l1)} />
          <text x={14} y={9}>{l1Shorter(l1)}</text>
        </g>
      {/each}
    </g>

    <g transform="translate({M.left},{M.top})">
      <!-- Axis: percent ticks -->
      {#each [0, 0.25, 0.5, 0.75, 1] as t}
        <line x1={x(t)} x2={x(t)} y1={0} y2={innerH + 2} class="grid" />
        <text x={x(t)} y={innerH + 16} class="tick" text-anchor="middle">{pct(t)}</text>
      {/each}

      {#each data as d, i (d.age)}
        {@const y = i * rowH + (rowH - barH) / 2}
        <g transform="translate(0,{y})">
          <text class="age-label" x={-8} y={barH / 2} text-anchor="end" dominant-baseline="middle">
            {d.age}
          </text>

          {#each L1_ORDER as l1, j}
            {@const prevSum = L1_ORDER.slice(0, j).reduce((s, k) => s + (d.byL1[k] || 0) / d.total, 0)}
            {@const share = (d.byL1[l1] || 0) / d.total}
            {@const w = x(share)}
            <rect
              x={x(prevSum)}
              y={0}
              width={w}
              height={barH}
              fill={colorForL1(l1)}
              class="seg"
            />
            {#if share > 0.06}
              <text
                class="seg-label"
                x={x(prevSum) + w / 2}
                y={barH / 2}
                text-anchor="middle"
                dominant-baseline="middle"
                fill={l1 === "Injuries" ? "var(--ink)" : "white"}
              >{pct(share)}</text>
            {/if}
          {/each}
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

  .legend text {
    font-family: var(--font-sans);
    font-size: 11px;
    fill: var(--ink-muted);
  }

  .seg { transition: width 700ms cubic-bezier(0.4,0,0.2,1), x 700ms cubic-bezier(0.4,0,0.2,1); }
  .seg-label {
    font-family: var(--font-sans);
    font-size: 11px;
    font-weight: 600;
    font-feature-settings: "tnum";
    pointer-events: none;
  }

  .age-label {
    font-family: var(--font-sans);
    font-size: 13px;
    font-weight: 500;
    fill: var(--ink);
  }

  .grid {
    stroke: var(--rule);
    stroke-width: 0.5;
  }
  .tick {
    font-family: var(--font-sans);
    font-size: 10px;
    fill: var(--ink-muted);
  }
</style>
