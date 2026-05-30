# Data — Africa Causes of Death 2021

The three files in this folder (`causes.json`, `causes-by-age.csv`, `parent-ids.csv`)
are **placeholders** with plausible-but-not-authoritative numbers, hand-coded so
the viz renders out of the box. Before publishing, replace them with the real
IHME Global Burden of Disease 2021 download.

## Pipeline (to be wired up)

1. **Acquire raw data from the GBD Results Tool**
   - URL: https://vizhub.healthdata.org/gbd-results/
   - Requires a free account (no API; CSV export only).
   - Query filters to apply:
     - Measure: **Deaths**
     - Metric: **Number** (not rate)
     - Year: **2021**
     - Cause: **All level 1–3 causes** (drill down checkbox)
     - Location: **African Region (WHO)** OR custom AU-54 aggregate
     - Age: **<5 years, 5–14 years, 15–49 years, 50–69 years, 70+ years**
     - Sex: **Both**
   - Download the resulting CSV. Place it in `data/raw/` (gitignored — see below).

2. **Build the three runtime files** with `_build_data.py` (skeleton below).
   The script reads the raw GBD CSV and emits:
   - `causes.json` — hierarchical tree (Level 1 → 2 → 3 leaves) with `size` = sum-of-ages
   - `causes-by-age.csv` — flat rows `ID,age,value`, one per (leaf, age band)
   - `parent-ids.csv` — `name,ID` lookup for every non-leaf node (used by the search-box → zoom path)

3. **ID scheme** — `<L1>.<L2>.<L3>`, all numeric, e.g. `1.4.1` for "Malaria"
   under "Malaria & NTDs" under "Communicable, maternal, neonatal & nutritional".
   The viz's zoom filter relies on prefix-matching (`d.ID.startsWith(currentID)`)
   so this scheme is load-bearing — don't switch to GBD's native cause IDs
   (which are not prefix-encoded) without also reworking the zoom logic in
   [../js/main.js](../js/main.js).

## Gitignore

Raw IHME CSVs are large and the GBD licence does not permit hosting them on
GitHub. Add to repo `.gitignore` once the script is wired up:

```
apps/africa-causes-of-death-2021/data/raw/*.csv
```

The build script is committed; the inputs and outputs differ:
- **Committed**: `_build_data.py`, the three generated artefacts (small,
  derivative, fine to commit), this README.
- **Gitignored**: the raw GBD CSV downloads under `raw/`.

## Why the placeholder numbers look reasonable

The hand-coded figures are calibrated against published WHO Global Health
Estimates 2021 totals for the WHO African Region: ~580k malaria deaths, ~880k
neonatal deaths, ~430k IHD deaths, etc. They are not authoritative — close
enough that the visual proportions don't lie to anyone testing the viz, but
the real GBD pull will shift every number.
