# Africa's Causes of Death, 2021 — explorable

An interactive look at every cause of death the WHO tracks in the African
Region in 2021, drillable by cause group and broken down by age band.

**Live:** https://bk-advisors.github.io/africa-causes-of-death-explore/

This is the explorable companion to the narrative data story,
[Causes of Death in Africa](https://bk-advisors.github.io/africa-causes-of-death/).
Same numbers, no narrative. There is also a
[nine-minute narrated film](https://bk-advisors.github.io/africa-causes-of-death-film/)
of the same data, where every dot is 1,000 people.

## What it is

A horizontal **zoomable icicle** built with vanilla D3 v7. Each row is a level
of the WHO/GBD cause hierarchy (All causes → the three top-level groups →
sub-groups → individual causes), and each block's width is its share of the
8.3 million deaths recorded that year. Colour marks the top-level cause group.

- Click a block to zoom into it; click the top row, the background, or a
  breadcrumb to zoom back out.
- Hover any block to see its age-band breakdown in the sidebar.
- Search to jump straight to a named cause.

## Data

WHO Global Health Estimates 2021, "Deaths by Cause, Age, Sex, by Country and by
Region, 2000–2021" (released 2024). The figures cover the 47-country WHO African
Region, which excludes Egypt, Tunisia, Libya, Morocco, Sudan, Somalia and
Djibouti (WHO assigns those to the Eastern Mediterranean Region). Counts are
point estimates rounded to the nearest thousand.

- Source: https://www.who.int/data/gho/data/themes/mortality-and-global-health-estimates/ghe-leading-causes-of-death
- Licence: WHO data, CC BY-NC-SA 3.0 IGO.

## Run locally

No build step. Serve over HTTP (the data fetches fail under `file://`):

```sh
python -m http.server 8000
# then open http://localhost:8000/
```

The three runtime files in `data/` (`causes.json`, `causes-by-age.csv`,
`parent-ids.csv`) are generated from the WHO source xlsx by `data/_build_data.py`.

## Credit

Built by [Matthew Kuch](https://bk-advisors.github.io/) / BK-Advisors. Chart
scaffolding descends from Nadieh Bremer's 2015 "A Closer Look at Labor".
