# Causes of Death in Africa, 2021

A scrollytelling data story on causes of death across the WHO African Region in 2021, by age band. Built in Svelte + scrollama, inspired by Nadieh Bremer's [*A Closer Look at Labor*](https://www.visualcinnamon.com/portfolio/a-closer-look-at-labor/) and in the editorial tradition of [The Pudding](https://pudding.cool/).

## Development

```sh
npm install
npm run dev          # http://localhost:5173
npm run build        # production build → dist/
npm run preview      # serve the production build locally
```

## Layout

```
.
├── article.md                  Canonical prose (source of truth for narrative)
├── data/
│   ├── raw/
│   │   └── ghe2021_deaths_whoregion.xlsx     WHO GHE source download (gitignored)
│   └── _build_data.py          Reshape raw → src/data/*.js ES modules
├── src/
│   ├── App.svelte              Article scaffold + scene-to-chartState mapping
│   ├── app.css                 Twilight palette tokens + layout
│   ├── main.js                 Mount point
│   ├── lib/
│   │   ├── Scrolly.svelte             scrollama wrapper
│   │   ├── ChartCirclePack.svelte     Svelte chart component
│   │   └── chartEngine.js             Pure d3 chart engine (mounted by component)
│   └── data/
│       ├── causes.js           Generated tree (hierarchy)
│       ├── causesByAge.js      Generated flat by-age table
│       └── meta.js             Source citation, totals, regional scope
└── index.html
```

## Data pipeline

The runtime data files in `src/data/` are **generated** from the raw WHO Excel by `data/_build_data.py`. They should not be edited by hand.

```sh
cd data
python _build_data.py     # regenerates src/data/{causes,causesByAge,meta}.js
```

The raw download (`raw/ghe2021_deaths_whoregion.xlsx`, 2.6 MB) is gitignored — WHO data is CC BY-NC-SA 3.0 IGO, which permits redistribution, but keeping the raw file out of git keeps the repo lean. To re-fetch:

```sh
curl -L -o data/raw/ghe2021_deaths_whoregion.xlsx \
  "https://cdn.who.int/media/docs/default-source/gho-documents/global-health-estimates/ghe2021_deaths_whoregion_new2.xlsx"
```

### Taxonomy quirks (worth knowing before editing the script)

The WHO taxonomy is uneven in depth. Most narratively-important causes sit at Level 3 (HIV/AIDS, Tuberculosis, COVID-19, Lower respiratory infections, Preterm birth complications). But a handful — most notably **Malaria**, **Measles**, **Schistosomiasis** — sit at Level 4 under generic Level 3 buckets like *Parasitic and vector diseases* or *Childhood-cluster diseases*. The build script detects this and expands L4 to leaves only when an L3 has L4 children; otherwise the L3 is itself a leaf.

The leaf-ID scheme (`1.2.3` or `1.2.3.4`) is load-bearing — the chart's zoom prefix-match relies on it. Don't switch to the WHO's numeric `Code` column without also reworking the chart engine.

## Adding or editing scenes

Scenes are defined inline in [src/App.svelte](src/App.svelte):

1. The `sceneStates` array at the top of `<script>` maps step index → `chartState` (focusId, activeAge, visibleL1).
2. The `<div class="scrolly__step">` elements inside the `Scrolly` component provide the corresponding prose.

To add a step: push a new entry to `sceneStates` and add a matching `<div class="scrolly__step">` in the same position. To change which causes are highlighted in an existing scene, edit the `chartState`. Available `activeAge` values: `<5`, `5-14`, `15-49`, `50-69`, `70+`. Available `visibleL1` values: `"1"` (CMNN), `"2"` (NCDs), `"3"` (Injuries), or `null` (all).

## Deployment

The piece deploys to `bk-advisors.github.io/africa-causes-of-death/` from a separate public repo (`bk-advisors/africa-causes-of-death`), built via `npm run build` and pushed as a flattened subtree. The base path in [vite.config.js](vite.config.js) reflects the public URL.

## Article

Read [article.md](article.md) for the full prose. The scrolly scene prose in `App.svelte` is a tighter edit of the article — keep the two in sync if you rewrite either.
