<script>
  // Thin Svelte wrapper around Pudding's scrollama. Each <div class="scrolly__step">
  // child fires `enter` events; the parent binds `value` to the active step index.
  import { onMount, onDestroy } from "svelte";
  import scrollama from "scrollama";

  export let value = 0;            // bound: the active step index
  export let root = null;          // optional bind:this for the wrapping element
  export let offset = 0.5;         // 0..1 — where in the viewport a step triggers

  let stepsEl;
  let scroller;

  onMount(() => {
    scroller = scrollama();
    scroller
      .setup({
        step: stepsEl.querySelectorAll(".scrolly__step"),
        offset,
        progress: false,
      })
      .onStepEnter(({ index, direction }) => {
        value = index;
      });

    const resize = () => scroller.resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  });

  onDestroy(() => scroller?.destroy());
</script>

<div class="scrolly" bind:this={root}>
  <div class="scrolly__chart">
    <slot name="chart" />
  </div>

  <div class="scrolly__steps" bind:this={stepsEl}>
    <slot name="steps" />
  </div>
</div>
