# Causes of Death in Africa — a data story

A scrollytelling piece on what 8.3 million deaths across the WHO African Region
in 2021 looked like, broken down by cause and by age band. The argument: we
organise health attention around outbreaks, while the steady, predictable
causes do most of the killing.

**Live:** https://bk-advisors.github.io/africa-causes-of-death/

Prefer to poke at the numbers yourself? There is an
[explorable version](https://bk-advisors.github.io/africa-causes-of-death-explore/)
with the same data and no narrative. Prefer to watch and listen? There is a
[nine-minute narrated film](https://bk-advisors.github.io/africa-causes-of-death-film/)
where every dot is 1,000 people.

## What it is

A Svelte 4 + Vite 5 article driven by Pudding's
[scrollama](https://github.com/russellgoldenberg/scrollama). The charts are
plain position-and-length encodings: horizontal bar charts of the top causes in
each age band, a 100%-stacked "double burden" chart, and a small cost-versus-
deaths table. Direct labels, no circle packing.

## Data

WHO Global Health Estimates 2021, "Deaths by Cause, Age, Sex, by Country and by
Region, 2000–2021" (released 2024). Figures cover the 47-country WHO African
Region (excludes Egypt, Tunisia, Libya, Morocco, Sudan, Somalia and Djibouti,
which WHO assigns to the Eastern Mediterranean Region).

- Source: https://www.who.int/data/gho/data/themes/mortality-and-global-health-estimates/ghe-leading-causes-of-death
- Licence: WHO data, CC BY-NC-SA 3.0 IGO.

## Source & build

This repository holds the built site. The source lives in the
[occupations](https://github.com/bk-advisors/occupations) working repo under
`apps/africa-causes-of-death-story/`:

```sh
npm install
npm run dev      # http://localhost:5173 with HMR
npm run build    # → dist/ (what this repo serves)
```

## Credit

Written and built by [Matthew Kuch](https://bk-advisors.github.io/) / BK-Advisors.
