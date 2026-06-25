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
├── public/
│   └── README.md              Public-facing README, copied to dist/ root on build
├── src/
│   ├── App.svelte              Article scaffold + scenes[] (step → {chart, props})
│   ├── app.css                 Twilight palette tokens + layout
│   ├── main.js                 Mount point
│   ├── lib/
│   │   ├── Scrolly.svelte             scrollama wrapper
│   │   ├── BarChart.svelte            Horizontal top-N bars (the workhorse)
│   │   ├── AgeBandBars.svelte         Total deaths per age band
│   │   ├── StackedShareChart.svelte   100%-stacked "double burden" chart
│   │   ├── CostVsDeaths.svelte        Cost-vs-deaths table-as-chart
│   │   ├── dataHelpers.js             Flatten tree, topCauses(), colorForL1()
│   │   └── ChartCirclePack.svelte / chartEngine.js   DEAD CODE (first attempt, unimported)
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

The leaf-ID scheme (`1.2.3` or `1.2.3.4`) is load-bearing: `dataHelpers.js` tags each leaf with its L1 ancestor (for colour) by walking these IDs, and `targetID` annotations in `App.svelte` scenes point at specific leaves by ID. Don't switch to the WHO's numeric `Code` column without reworking those.

## Adding or editing scenes

Scenes are defined inline in [src/App.svelte](src/App.svelte):

1. The `scenes` array at the top of `<script>` maps step index → `{ chart, props }`. The `chart` string (`age-bars`, `bar`, `stacked`, `cost`) picks which component mounts; `props` are passed straight through.
2. The `<div class="scrolly__step">` elements inside the `Scrolly` component provide the corresponding prose, in the same order.

To add a step: push a new `{ chart, props }` entry to `scenes` and add a matching `<div class="scrolly__step">` in the same position. A `bar` scene takes `{ ageBand, topN, annotation }`; `annotation` is `{ targetID, note }` pointing at a specific cause. Age-band values: `<5`, `5-14`, `15-49`, `50-69`, `70+`.

## Deployment

The piece deploys to `bk-advisors.github.io/africa-causes-of-death/` from a separate public repo (`bk-advisors/africa-causes-of-death`), built via `npm run build` and pushed as a flattened subtree. The base path in [vite.config.js](vite.config.js) reflects the public URL.

## Article

Read [article.md](article.md) for the full prose. The scrolly scene prose in `App.svelte` is a tighter edit of the article — keep the two in sync if you rewrite either.
