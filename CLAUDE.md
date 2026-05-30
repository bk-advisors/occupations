# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Working repo for D3 visualisations built off Nadieh Bremer's 2015 "A Closer Look at Labor" piece (circle-pack hierarchy with inline age-band bar charts inside each leaf). Same scaffolding pattern as `bk-advisors/urbanization`: the original lives untouched as a reference under `apps/labor-2014/`, and new pieces are built fresh under `apps/<slug>/`.

No build system; static HTML/JS. Serve with `python -m http.server 8000` from the repo root, then visit `http://localhost:8000/` — the root `index.html` meta-refreshes into the currently-active viz.

## Deployment

**This repo (`bk-advisors/occupations`) is the working/dev space, not the public site.** Each viz under `apps/` is published from its own public repo so the URL is `bk-advisors.github.io/<slug>/`. Current deploy targets:

| Source folder | Public repo | Public URL |
|---|---|---|
| `apps/africa-causes-of-death-story/` | `bk-advisors/africa-causes-of-death` | https://bk-advisors.github.io/africa-causes-of-death/ |

The mock-up at `apps/africa-causes-of-death-2021/` is **not deployed** — it's an offline reference for the visual grammar.

Each public repo contains the contents of its source folder flattened to root (no `apps/` prefix). To redeploy after changes (substitute SLUG and PUBLIC_REPO):

```sh
git subtree split --prefix=apps/SLUG -b SLUG-deploy
git push https://github.com/bk-advisors/PUBLIC_REPO.git SLUG-deploy:main --force
git branch -D SLUG-deploy
```

The `--force` is needed because the subtree split creates a flat single-commit history on each run that won't be a fast-forward of the previous deploy.

**Folder vs. URL slug** — the source folder keeps a year suffix (`...-2021`) to anchor the data vintage, while the public repo drops it (`africa-causes-of-death`). Folder renames are cosmetic-only because the subtree split strips the `apps/` prefix.

## Repo layout

```
/                                       Landing page (meta-refresh to the active viz)
apps/labor-2014/                        ARCHIVE — Nadieh Bremer's 2015 original, D3 v3, do not edit
apps/africa-causes-of-death-2021/       MOCK-UP — D3 v7 vanilla, runs from placeholder data; reference only
apps/africa-causes-of-death-story/      PUBLISHED PIECE — Svelte 4 + Vite + scrollama, real WHO GHE 2021 data
```

The data year (2014, 2021) anchors the older slugs, mirroring urbanization's `east-asia-2010` archive convention. The `-story` suffix on the published piece marks it as the scrolly-narrative version (vs. the explorable mock-up).

## `apps/labor-2014/` — archive (D3 v3)

Bremer's original piece, 146 M employed persons across ~550 US occupations, BLS 2014 data. Hierarchical circle pack with inline bar charts showing age distribution inside each leaf. Loaded from the CDN as D3 v3; `js/d3.v5.min.js` exists in the folder but is **not** loaded by `index.html`.

- Three data sources loaded async inside `drawAll()` at [apps/labor-2014/js/script.js:286-310](apps/labor-2014/js/script.js#L286-L310) and [:316](apps/labor-2014/js/script.js#L316): `occupation.json` (tree), `occupations by age.csv` (per-leaf bars), `ID of parent levels.csv` (name→ID lookup for zoom-by-search).
- IDs encode the hierarchy (`1.1.2.17` is a leaf under `1.1.2` under `1.1` under `1`); zoom-visibility filters all use `d.ID.lastIndexOf(currentID, 0) === 0` prefix matching ([:515](apps/labor-2014/js/script.js#L515), [:526](apps/labor-2014/js/script.js#L526), [:538](apps/labor-2014/js/script.js#L538), [:549](apps/labor-2014/js/script.js#L549)).
- The `runCreateBars()` retry loop at [:231-247](apps/labor-2014/js/script.js#L231-L247) is a sync hack between the two async loads (CSV may not have resolved when the JSON callback fires); not idempotent re-rendering.
- `rotationText` ([:12](apps/labor-2014/js/script.js#L12)) is a 29-entry hand-tuned array of per-arc label rotations indexed by parent-node order. Tied to the original's specific tree shape — not portable to other hierarchies.
- Value-label flip (inside-right white vs. outside-left dark when the label is wider than the bar) is duplicated at [:157](apps/labor-2014/js/script.js#L157) and [:557](apps/labor-2014/js/script.js#L557).

**Do not refactor the archive.** v3 idioms and the CDN-D3-v3 reference are intentional.

## `apps/africa-causes-of-death-2021/` — mock-up (D3 v7 vanilla)

Africa-wide causes of death in 2021, broken down by 5 age bands (<5, 5-14, 15-49, 50-69, 70+). Three top-level GBD categories (Communicable/maternal/neonatal/nutritional, NCDs, Injuries), drilling down two more levels to individual causes.

**Reference / mock-up only — not for publication.** Runs from hand-coded placeholder data (numbers calibrated against published WHO GHE totals but not authoritative). The published piece is the Svelte scrolly at `apps/africa-causes-of-death-story/` — see below.

Same visual grammar as the archive (circle-pack + inner age bars + arc-text parent labels + zoomable + searchable), but modernized:

- **D3 v7** from CDN.
- **ES modules** — `index.html` loads `js/main.js` with `<script type="module">`; small helpers in `js/helpers.js`.
- **Data**: three flat files in `data/` (hierarchical JSON + per-leaf age CSV + parent-ID lookup), same shape as the archive.
- **Zoom cancellation via AbortController** — `helpers.js` exports `makeCancellation()`; each `zoomTo(node)` registers a fresh signal and aborts the previous, replacing v3's `setTimeout`/`clearTimeout` approach.
- **No hand-tuned `rotationText[]`** — the archive's per-arc rotation only worked for its specific 29-arc tree; we render arc labels at the natural top of each circle. If you adopt a tree with overlapping arc labels, retune locally rather than copying the archive's array.

### Data pipeline (placeholder → real GBD)

The three runtime files (`causes.json`, `causes-by-age.csv`, `parent-ids.csv`) are currently **placeholders** hand-coded against published WHO Global Health Estimates 2021 totals (~580k malaria, ~880k neonatal, ~430k IHD, etc.) so the viz renders out of the box. Real numbers come from the IHME GBD Results Tool — see [apps/africa-causes-of-death-2021/data/README.md](apps/africa-causes-of-death-2021/data/README.md) for the acquisition+reshape pipeline. The `_build_data.py` stub there expects a Results Tool flat CSV under `data/raw/` (gitignored, see root `.gitignore`).

### Mutating-state convention in main.js

The bar/title geometry uses `__width__`, `__barHeight__`, `__fontSize__`, etc. fields written onto the bound data objects. This mirrors Bremer's `d.width`, `d.barHeight` pattern — non-idiomatic v7 (which would prefer separate state objects) but lets `zoomTo()` rescale every element by reading per-datum cached geometry rather than recomputing layout. If you refactor, keep the read sites in `changeReset` aligned with the write sites in the initial bar-drawing block.

## `apps/africa-causes-of-death-story/` — published Svelte piece

The actual scrollytelling article. Svelte 4 + Vite 5 + Pudding's [`scrollama`](https://github.com/russellgoldenberg/scrollama) library. The chart vocabulary is **horizontal bar charts**, a 100%-stacked bar, and a small annotated table — Tufte/Few/Cairo-style position+length encodings, directly labeled, with annotations as part of the chart. **No circle pack** — that was the first attempt and got abandoned after Matthew flagged it as unreadable at small radii. The mock-up at `apps/africa-causes-of-death-2021/` is the surviving home of the circle pack.

### Layout

- **[article.md](apps/africa-causes-of-death-story/article.md)** — the canonical prose, opening on a recent Ebola declaration in Uganda/DRC and the contrast between outbreak-attention and steady-state mortality. The scene-by-scene prose inside `App.svelte` is a tighter edit; keep them in sync if either is rewritten.
- **[src/App.svelte](apps/africa-causes-of-death-story/src/App.svelte)** — article scaffold + a `scenes[]` array mapping each scrolly step to `{chart, props}`. The `chart` discriminator picks which Svelte chart component to mount; `props` are passed through. Each `<div class="scrolly__step">` carries the matching prose.
- **[src/lib/Scrolly.svelte](apps/africa-causes-of-death-story/src/lib/Scrolly.svelte)** — minimal scrollama wrapper. Binds the active step index to the parent.
- **[src/lib/BarChart.svelte](apps/africa-causes-of-death-story/src/lib/BarChart.svelte)** — workhorse. Horizontal bars, top-N causes for a given age band, sorted by length, colored by L1 group (CMNN/NCD/Injury), with directly-labeled values and optional `{targetID, text}` annotation pointing to a specific bar.
- **[src/lib/AgeBandBars.svelte](apps/africa-causes-of-death-story/src/lib/AgeBandBars.svelte)** — five bars, total deaths per age band. Used in the opening + closing scenes.
- **[src/lib/StackedShareChart.svelte](apps/africa-causes-of-death-story/src/lib/StackedShareChart.svelte)** — 100%-stacked horizontal bar across the five age bands. The "double burden" scene — the crossover from CMNN-dominant to NCD-dominant is the punchline.
- **[src/lib/CostVsDeaths.svelte](apps/africa-causes-of-death-story/src/lib/CostVsDeaths.svelte)** — small annotated table-as-chart for the "cheap deaths" scene. Sparkbars for deaths, dollar labels for unit cost.
- **[src/lib/dataHelpers.js](apps/africa-causes-of-death-story/src/lib/dataHelpers.js)** — flattens the tree to leaves tagged by L1 ancestor, exports `topCauses({age, topN, l1Filter})`, `l1ByAge()`, `colorForL1()`.
- **[src/data/](apps/africa-causes-of-death-story/src/data/)** — auto-generated ES modules (`causes.js`, `causesByAge.js`, `meta.js`). Do not edit by hand.
- **DEAD CODE**: `ChartCirclePack.svelte` and `chartEngine.js` remain in `src/lib/` from the first attempt but are no longer imported. Vite tree-shakes them out of the bundle. Safe to delete if you want a tidy repo; left in for now in case the circle-pack is wanted again somewhere.

### Data pipeline (WHO GHE 2021)

Real data source: **WHO Global Health Estimates 2021** ([direct xlsx](https://cdn.who.int/media/docs/default-source/gho-documents/global-health-estimates/ghe2021_deaths_whoregion_new2.xlsx)). The 47-country WHO African Region aggregate (excludes Egypt, Tunisia, Libya, Morocco, Sudan, Somalia, Djibouti which WHO assigns to the Eastern Mediterranean Region — flagged in the article colophon).

Build:
```sh
cd apps/africa-causes-of-death-story/data
python _build_data.py   # → src/data/{causes,causesByAge,meta}.js
```

The raw xlsx is gitignored; the script is committed. Run it again after re-fetching to regenerate the ES modules.

**Taxonomy gotcha — Level 4 expansion**: most narratively-key causes (HIV, TB, COVID-19, LRI, Preterm) sit at Level 3 in WHO's taxonomy. But **Malaria, Measles, Schistosomiasis** sit at Level 4 under generic L3 buckets like *Parasitic and vector diseases*. The script auto-detects this and expands L4 → leaves when the parent L3 has L4 children, otherwise treats the L3 itself as a leaf. Don't drop the L4 expansion or malaria disappears from the chart.

### Twilight palette

All design tokens live in [src/app.css](apps/africa-causes-of-death-story/src/app.css) as CSS custom properties. Two parallel ramps:

**Age-band ramp** (dawn → midnight) — used by the explore tool's inner bars and as the palette source for accent colors:

| Var | Hex | Band |
|---|---|---|
| `--age-under5` | `#F4D58D` | <5 (warm gold) |
| `--age-5-14` | `#E5B25D` | 5-14 (ochre) |
| `--age-15-49` | `#C9483A` | 15-49 (terracotta) |
| `--age-50-69` | `#4E3A6B` | 50-69 (indigo) |
| `--age-70plus` | `#1F1B3A` | 70+ (midnight) |

**L1 cause-group ramp** — used by the story bar charts to color bars by cause group:

| Var | Hex | L1 group |
|---|---|---|
| `--l1-cmnn` | `#C9483A` | Communicable, maternal, perinatal & nutritional (terracotta) |
| `--l1-ncd` | `#4E3A6B` | Non-communicable diseases (indigo) |
| `--l1-injury` | `#E5B25D` | Injuries (ochre) |

Ground `#FAF6EE` cream, ink `#1F1B3A`. The bar-chart components read L1 colors via `getComputedStyle` (in `dataHelpers.colorForL1`), so re-skinning is one CSS-variable edit away.

### Build & deploy

```sh
cd apps/africa-causes-of-death-story
npm install
npm run dev          # http://localhost:5173 with HMR
npm run build        # dist/
npm run preview      # serve dist/ locally
```

Public-URL base path is set in [vite.config.js](apps/africa-causes-of-death-story/vite.config.js) — `/africa-causes-of-death/` in build mode, `/` in dev. Update if the public slug changes.

Deploy via the standard subtree-split pattern documented above. The Svelte build produces `dist/`; split that, not the source folder. (For Svelte specifically: build first, then `git add dist/ -f` to a deploy branch before subtree-splitting, since `dist/` is gitignored. Or use a workflow like `npm run build && cp -r dist/* /tmp/deploy/` and push from there.)

## Conventions

- `commaFormat = d3.format(',')` for all numeric display.
- Age-band ramp inline at [apps/africa-causes-of-death-2021/js/main.js:23-26](apps/africa-causes-of-death-2021/js/main.js#L23-L26). 5 bands (vs. archive's 7) — if you change the band scheme, update both the ramp and `AGE_BANDS` together.
- Depth-coloured grey ramp for parent circles preserved from the archive.

## Gotchas

- File-served via `file://` fails CORS on the data fetches — always serve over HTTP.
- D3 v3 is still loaded by the archive's `index.html`; do not "upgrade" it.
- The new build's zoom prefix-match in `changeReset` ([apps/africa-causes-of-death-2021/js/main.js](apps/africa-causes-of-death-2021/js/main.js)) uses `.startsWith(currentID)` instead of v3's `lastIndexOf(.., 0) === 0`. Behavior is equivalent; just easier to read.

## Local dev environment quirks

- **`gh` CLI is NOT installed on this machine.** Use `git` directly (HTTPS push works via cached Windows Credential Manager auth), or ask Matthew to run any `gh` command in a shell where it's available.
- **VS Code Live Server runs on `127.0.0.1:5500`** and holds open file handles on whatever directory it's serving, blocking `git mv` / renames on Windows. Before any op needing exclusive directory access, remind Matthew to close (or pause) Live Server first.
