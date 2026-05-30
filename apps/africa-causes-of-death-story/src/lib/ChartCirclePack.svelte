<script>
  import { onMount, onDestroy } from "svelte";
  import { createChart } from "./chartEngine.js";
  import { causes } from "../data/causes.js";
  import { causesByAge } from "../data/causesByAge.js";

  // Scene-driven state. Each scene supplies a `chartState` object that the
  // engine knows how to interpret.
  export let chartState = { focusId: "root", activeAge: null, visibleL1: null };

  let container;
  let chart;

  onMount(() => {
    chart = createChart(container, causes, causesByAge);
    chart.update(chartState);
  });

  $: if (chart && chartState) chart.update(chartState);

  onDestroy(() => chart?.destroy());
</script>

<div class="chart-container" bind:this={container}></div>

<style>
  .chart-container {
    width: 100%;
    height: 100%;
    min-height: 480px;
  }
</style>
