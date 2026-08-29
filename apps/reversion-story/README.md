# Reversion to the Mean — the written story

A scrollytelling visual essay on regression to the mean, told through Galton's
1886 tally and forty famous families in sport, politics and business. Eight
interactive scenes in one self-contained HTML file: no build step at read time,
no CDN, no external request of any kind.

This is the article that accompanies [the data film](../reversion-film/).

Not yet published. See Deploying below.

## Reading it

`index.html` is self-contained, so opening it from disk works. To serve it:

```sh
cd apps/reversion-story
python -m http.server 8000     # or any static server
```

## Editing it

**Never edit `index.html`.** It is generated. Edit the sources in `src/` and
rebuild:

```sh
cd apps/reversion-story/src
node build.mjs                 # -> ../index.html
```

`build.mjs` concatenates `src/css/*.css` (sorted) + `src/shell.html` +
`src/js/*.js` (sorted) into one page. Filename prefixes control order. It also
runs guardrails that have each caught a real bug: no external `<script src>`,
no external stylesheet, no `@import url()`, no document tags inside
`shell.html`, and no em-dashes in the prose.

| In `src/` | What it is |
|---|---|
| `SPEC.md` | The contract the whole piece was built against, including the Housel writing rules and the banned-vocabulary list. Read this first. |
| `RESEARCH.md` | Where every number came from and how it became a z score. Section 7 is the list of things that could not be pinned down. |
| `RESUME.md` | Build state, what round 2 changed, and the harness bugs that must not be reintroduced. |
| `CRITIQUE-1.md` | The first critic pass. |
| `shell.html` | The prose and the empty scene mounts. |
| `js/00-core.js`, `js/01-motion.js` | The helper layer the scenes code against. No D3. |
| `js/04-data.js` | The researched values. The film's `data/reversion.js` is a port of this file. |
| `js/10-` … `js/17-` | One module per scene. |
| `driver-backup/` | Copies of the headless-Chrome harness scripts (`shoot`, `audit`, `interact`, `edge`, `spill`, `progress`, `cite`, `empties`, `bell`). |

## The document wrapper

The page was originally written to be published as a Claude Artifact, where the
publisher supplies `<!doctype>`, `<html>` and `<head>`. `shell.html` therefore
still contains none of those, and the build guard enforces it.

Shipping to GitHub Pages instead, `build.mjs` now writes the wrapper itself:
doctype, `lang`, charset, viewport, title and description. Without it the page
renders in quirks mode with no declared charset, which garbles every
typographic quote and every σ in the prose, and with no viewport, which stops
it scaling on a phone.

## Keeping it in step with the film

The two pieces share their data and must not drift.

- `src/js/04-data.js` is the source of truth. `apps/reversion-film/data/reversion.js`
  is a mechanical port of it: same values, ES module wrapper instead of an IIFE.
  Change this file, then regenerate the film's copy.
- Both quote the same fitted results, and both derive them rather than typing
  them: Galton slope 0.6463 across 928 children, dynasty slope 0.621 across 40
  pairs, half-lives 0.92 / 0.37 / 2.41 generations.
- The film's title screen and end card link here; this page should link back
  once both have public URLs.

## Deploying

Same subtree-split pattern as the rest of the repo. The whole folder flattens
to the root of its public repo, so `src/` ships alongside `index.html`. That is
intentional: the sources are small and the piece is better for showing them.

```sh
git subtree split --prefix=apps/reversion-story -b reversion-story-deploy
git push https://github.com/bk-advisors/PUBLIC_REPO.git reversion-story-deploy:main --force
git branch -D reversion-story-deploy
```

## Known gaps

- **Not published.** No public repo yet, and the cross-links to the film are
  repo-relative until both have URLs.
- **Critic round 2 was never run.** The brief is in
  `src/driver-backup/CRITIC-BRIEF.md`. Default verdict is REJECT; iterate until
  it stops finding things.
- **The sport distribution moments** (NBA 9.0/4.8, MLB 100/17, NHL 0.24/0.11)
  are calibrated estimates rather than published tables. See `RESEARCH.md`
  section 7.
- A first attempt at this piece exists elsewhere and still ships a Galton table
  that sums to 979 children rather than the correct 928. This one is corrected.
