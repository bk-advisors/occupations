<script>
  // "What's actually cheap to prevent" — small-multiples table.
  //
  // Each row is an intervention. Layout per row (top-down to avoid label
  // collisions):
  //   1. Name + cost on a single header line (cost right-aligned)
  //   2. Sparkbar of annual deaths the targeted cause kills today
  //   3. Sub-line with the cause it targets

  import { format } from "d3-format";
  import { scaleLinear } from "d3-scale";

  const comma = format(",");

  const interventions = [
    { name: "Insecticide-treated bednets", target: "Malaria (mostly under-5)",   cost: "$3 per net",          deaths: 450000 },
    { name: "Oral rehydration salts",       target: "Diarrhoeal disease (mostly under-5)", cost: "30¢ per packet", deaths: 281000 },
    { name: "Childhood vaccine course (EPI)", target: "Pneumonia, measles, etc.", cost: "$40 per child",       deaths: 427000 },
    { name: "Skilled birth attendance",     target: "Neonatal & maternal",        cost: "$50 per delivery",    deaths: 752000 },
    { name: "Antiretroviral therapy",       target: "HIV/AIDS",                   cost: "~$75 per patient-year", deaths: 245000 },
    { name: "Hypertension management",      target: "Stroke, IHD",                cost: "~$200 per patient-year", deaths: 940000 },
    { name: "Cervical cancer screening + Rx", target: "Cervix uteri cancer",       cost: "~$500 per case caught", deaths: 77000 },
  ];

  export let title = "";
  export let subtitle = "";

  // SVG canvas — laid out vertically, one row per intervention.
  const VB_W = 600;
  const ROW_H = 56;
  const M = { top: 30, right: 20, bottom: 16, left: 20 };
  const VB_H = M.top + interventions.length * ROW_H + M.bottom;
  const innerW = VB_W - M.left - M.right;

  $: maxDeaths = Math.max(...interventions.map((d) => d.deaths));
  $: xDeaths = scaleLinear().domain([0, maxDeaths]).range([0, innerW]);
</script>

<figure class="chart">
  {#if title}
    <figcaption>
      <h3>{title}</h3>
      {#if subtitle}<p class="sub">{subtitle}</p>{/if}
    </figcaption>
  {/if}

  <svg viewBox="0 0 {VB_W} {VB_H}" preserveAspectRatio="xMinYMin meet" role="img">
    <g transform="translate({M.left},{M.top})">
      {#each interventions as d, i}
        {@const y = i * ROW_H}
        <g transform="translate(0,{y})">
          <!-- Top row: name (left), cost (right). Same baseline, different anchors. -->
          <text class="iv-name" x={0} y={0} dominant-baseline="hanging">{d.name}</text>
          <text class="iv-cost" x={innerW} y={0} text-anchor="end" dominant-baseline="hanging">{d.cost}</text>

          <!-- Middle: sparkbar of deaths the cause kills. -->
          <rect x={0} y={20} width={xDeaths(d.deaths)} height={14} class="deaths-bar" />
          <text class="deaths-val" x={xDeaths(d.deaths) + 6} y={27} dominant-baseline="middle">{comma(d.deaths)}</text>

          <!-- Bottom: target subtitle. -->
          <text class="iv-target" x={0} y={42} dominant-baseline="hanging">Targets: {d.target}</text>
        </g>
      {/each}
    </g>
  </svg>

  <p class="note">
    Death counts are 2021 totals from the relevant cause(s) — not a claim
    that the intervention prevents all of them. Unit-cost ranges from DCP3,
    WHO-CHOICE, and recent literature; treat as orders of magnitude.
  </p>
</figure>

<style>
  .chart { margin: 0; }

  figcaption { margin: 0 0 0.5rem; padding-left: 0; }
  figcaption h3 {
    font-family: var(--font-serif);
    font-weight: 600;
    font-size: clamp(1.15rem, 1.9vw, 1.5rem);
    margin: 0 0 0.15em;
    line-height: 1.2;
  }
  .sub { font-family: var(--font-sans); font-size: 0.82rem; color: var(--ink-muted); margin: 0; }

  svg { width: 100%; height: auto; display: block; }

  .iv-name {
    font-family: var(--font-serif);
    font-size: 13px;
    font-weight: 600;
    fill: var(--ink);
  }
  .iv-cost {
    font-family: var(--font-sans);
    font-size: 12px;
    font-weight: 600;
    fill: var(--age-15-49);
    font-feature-settings: "tnum";
  }
  .iv-target {
    font-family: var(--font-sans);
    font-size: 10.5px;
    fill: var(--ink-muted);
    font-style: italic;
  }

  .deaths-bar { fill: var(--age-15-49); opacity: 0.82; }
  .deaths-val {
    font-family: var(--font-sans);
    font-size: 11px;
    font-weight: 500;
    fill: var(--ink-muted);
    font-feature-settings: "tnum";
  }

  .note {
    font-family: var(--font-sans);
    font-size: 0.78rem;
    color: var(--ink-muted);
    line-height: 1.5;
    margin: 0.75rem 0 0;
    padding: 0.5rem 0 0 0.85rem;
    border-left: 2px solid var(--rule);
  }
</style>
