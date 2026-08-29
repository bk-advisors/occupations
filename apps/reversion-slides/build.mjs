// Build the presentation deck.
//
//   node build.mjs        -> index.html, speaker-notes.md, youtube-description.md
//
// Slides are generated rather than hand-written for the same reason the film's
// captions are: every figure comes from figures.json, which is exported from
// the film's own data module. A number typed into a slide is a number that can
// drift from the piece it is describing.
//
// Regenerate figures.json from apps/reversion-film with the snippet in
// README.md whenever the underlying data changes.

import fs from "node:fs";
import { fileURLToPath } from "node:url";

const HERE = fileURLToPath(new URL(".", import.meta.url)).replace(/[\\/]$/, "");
const F = JSON.parse(fs.readFileSync(`${HERE}/figures.json`, "utf8"));
const TC = JSON.parse(fs.readFileSync(`${HERE}/film-timecodes.json`, "utf8"));

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// ── Chart helpers ────────────────────────────────────────────────────────
// Plain inline SVG, no library. Slides are projected and screenshotted, so
// everything must render identically with no runtime and no fetch.

function galtonScatter(w = 940, h = 560) {
  const m = { l: 68, r: 30, t: 24, b: 62 };
  const x0 = 63, x1 = 74, y0 = 60.5, y1 = 75;
  const sx = (v) => m.l + ((v - x0) / (x1 - x0)) * (w - m.l - m.r);
  const sy = (v) => h - m.b - ((v - y0) / (y1 - y0)) * (h - m.t - m.b);
  const pts = F.galtonPoints
    .map(([a, b]) => `<circle cx="${sx(a).toFixed(1)}" cy="${sy(b).toFixed(1)}" r="2"/>`)
    .join("");
  const fit = (v) => F.galtonFit.slope * v + F.galtonFit.intercept;
  const idc = F.galtonFit.my - F.galtonFit.mx;          // y = x through the joint mean
  const ticks = (from, to, step, fn) => {
    let s = "";
    for (let v = from; v <= to + 1e-6; v += step) s += fn(v);
    return s;
  };
  return `<svg viewBox="0 0 ${w} ${h}" class="chart" role="img"
    aria-label="Galton's ${F.galtonN} adult children: mid-parent height against child height, with the expectation line and the flatter fitted line">
    <g class="grid">
      ${ticks(64, 74, 2, (v) => `<line x1="${sx(v)}" y1="${m.t}" x2="${sx(v)}" y2="${h - m.b}"/>`)}
    </g>
    <g class="axis">
      <line x1="${m.l}" y1="${h - m.b}" x2="${w - m.r}" y2="${h - m.b}"/>
      <line x1="${m.l}" y1="${m.t}" x2="${m.l}" y2="${h - m.b}"/>
      ${ticks(64, 74, 2, (v) => `<text class="tick" x="${sx(v)}" y="${h - m.b + 26}" text-anchor="middle">${v}</text>`)}
      ${ticks(62, 74, 4, (v) => `<text class="tick" x="${m.l - 12}" y="${sy(v) + 5}" text-anchor="end">${v}</text>`)}
      <text class="axis-label" x="${(m.l + w - m.r) / 2}" y="${h - 14}" text-anchor="middle">Average height of the two parents (inches)</text>
      <text class="axis-label" transform="translate(20 ${(m.t + h - m.b) / 2}) rotate(-90)" text-anchor="middle">Height of the adult child</text>
    </g>
    <g class="dots">${pts}</g>
    <line class="line-expect" x1="${sx(x0)}" y1="${sy(x0 + idc)}" x2="${sx(x1)}" y2="${sy(x1 + idc)}"/>
    <line class="line-fit" x1="${sx(x0)}" y1="${sy(fit(x0))}" x2="${sx(x1)}" y2="${sy(fit(x1))}"/>
    <text class="lab-expect" x="${sx(73.6)}" y="${sy(fit(73.6)) - 96}" text-anchor="end">what most people expect</text>
    <text class="lab-fit" x="${sx(73.6)}" y="${sy(fit(73.6)) + 52}" text-anchor="end">what the data draws · slope ${F.galtonSlope.toFixed(2)}</text>
  </svg>`;
}

function slopeRows(w = 940, h = 560) {
  const pairs = [...F.pairs].sort((a, b) => b.pz - a.pz);
  const m = { l: 118, r: 40, t: 18, b: 46 };
  const z0 = -1.6, z1 = 6.1;
  const sx = (z) => m.l + ((z - z0) / (z1 - z0)) * (w - m.l - m.r);
  const rowH = (h - m.t - m.b) / pairs.length;
  const rows = pairs.map((p, i) => {
    const y = m.t + i * rowH + rowH / 2;
    const fall = p.dir === "fall";
    return `<g class="${fall ? "fall" : "rise"}">
      <line class="link" x1="${sx(p.pz).toFixed(1)}" y1="${y.toFixed(1)}" x2="${sx(p.cz).toFixed(1)}" y2="${y.toFixed(1)}"/>
      <circle class="parent" cx="${sx(p.pz).toFixed(1)}" cy="${y.toFixed(1)}" r="3.4"/>
      <circle class="child" cx="${sx(p.cz).toFixed(1)}" cy="${y.toFixed(1)}" r="3.6"/>
    </g>`;
  }).join("");
  let ax = "";
  for (let z = -1; z <= 6; z++) {
    ax += `<line class="gridline" x1="${sx(z)}" y1="${m.t}" x2="${sx(z)}" y2="${h - m.b}"/>
      <text class="tick" x="${sx(z)}" y="${h - m.b + 24}" text-anchor="middle">${z === 0 ? "average" : (z > 0 ? "+" : "−") + Math.abs(z) + "σ"}</text>`;
  }
  return `<svg viewBox="0 0 ${w} ${h}" class="chart rows" role="img"
    aria-label="Forty families ranked by the parent's sigma: open mark the parent, filled mark the child, ${F.directions.fall} falling and ${F.directions.rise} rising">
    ${ax}${rows}
    <text class="rowlab" x="${m.l - 14}" y="${m.t + rowH}" text-anchor="end">furthest out</text>
    <text class="rowlab" x="${m.l - 14}" y="${h - m.b - 4}" text-anchor="end">closest to average</text>
  </svg>`;
}

function decayColumns(w = 940, h = 480) {
  const series = [
    { label: "Height", r: F.traits.find((t) => t.id === "height").r, cls: "fall",
      sub: `halves in ${F.halflife.height.toFixed(1)} generations` },
    { label: "Social standing, by surname", r: F.traits.find((t) => t.id === "surname").r, cls: "gold",
      sub: `halves in ${F.halflife.surname.toFixed(1)} generations` },
  ];
  const gens = 4, m = { l: 260, r: 40, t: 30, b: 54 };
  const colW = (w - m.l - m.r) / (gens + 1);
  const rowH = (h - m.t - m.b) / series.length;
  let out = "";
  series.forEach((s, si) => {
    const base = m.t + si * rowH + rowH - 26;
    out += `<text class="serieslab ${s.cls}" x="${m.l - 22}" y="${base - rowH * 0.45}" text-anchor="end">${esc(s.label)}</text>
      <text class="seriessub" x="${m.l - 22}" y="${base - rowH * 0.45 + 22}" text-anchor="end">${esc(s.sub)}</text>
      <line class="baseline" x1="${m.l}" y1="${base + 6}" x2="${w - m.r}" y2="${base + 6}"/>`;
    for (let g = 0; g <= gens; g++) {
      const v = Math.round(100 * Math.pow(s.r, g));
      const bh = (v / 100) * (rowH - 62);
      const cx = m.l + g * colW + colW / 2;
      out += `<rect class="bar ${s.cls}" x="${cx - colW * 0.3}" y="${base + 6 - bh}" width="${colW * 0.6}" height="${bh}"/>
        <text class="barval ${g === 0 ? "" : s.cls}" x="${cx}" y="${base + 28}" text-anchor="middle">${v}</text>`;
    }
  });
  for (let g = 0; g <= gens; g++) {
    out += `<text class="tick" x="${m.l + g * colW + colW / 2}" y="${h - 16}" text-anchor="middle">${g === 0 ? "the parent" : g + " gen"}</text>`;
  }
  return `<svg viewBox="0 0 ${w} ${h}" class="chart" role="img"
    aria-label="A hundred units of advantage: height keeps ${Math.round(100 * Math.pow(F.traits.find(t=>t.id==='height').r, 1))} after one generation, surname status keeps ${Math.round(100 * Math.pow(F.traits.find(t=>t.id==='surname').r, 1))}">${out}</svg>`;
}

function vanderbiltStair(w = 940, h = 470) {
  const chain = F.vanderbilt;
  // A reserved gutter for the generation labels, and the scale starts after
  // it. Without this, Gloria at 1.47 sits on top of "great great
  // granddaughter" and both become unreadable.
  const GUT = 210;
  const m = { l: 40 + GUT, r: 40, t: 26, b: 52 };
  const z0 = 0.6, z1 = 6.0;
  const sx = (z) => m.l + ((z - z0) / (z1 - z0)) * (w - m.l - m.r);
  const rowH = (h - m.t - m.b) / chain.length;
  const gen = ["the Commodore", "his son", "his grandson", "great grandson", "great great granddaughter"];
  let out = "";
  chain.forEach((p, i) => {
    const y = m.t + i * rowH + rowH / 2;
    const cls = i === 0 ? "gold" : i === chain.length - 1 ? "fall" : "";
    if (i > 0) {
      const py = m.t + (i - 1) * rowH + rowH / 2;
      out += `<path class="stair" d="M ${sx(chain[i - 1].z)} ${py + 12} V ${y - 14} H ${sx(p.z)}"/>`;
    }
    // Name on the side with room: a node near the left edge puts its label to
    // the right, and its sigma readout to the left.
    const left = sx(p.z) < m.l + (w - m.l - m.r) * 0.42;
    const nx = sx(p.z) + (left ? 20 : -20);
    const zx = sx(p.z) + (left ? -20 : 20);
    const anchor = left ? "start" : "end";
    const zAnchor = left ? "end" : "start";
    out += `<circle class="node ${cls}" cx="${sx(p.z)}" cy="${y}" r="7"/>
      <text class="stairname ${cls}" x="${nx}" y="${y - 2}" text-anchor="${anchor}">${esc(p.name)}</text>
      <text class="stairstat" x="${nx}" y="${y + 17}" text-anchor="${anchor}">${esc(p.stat)}</text>
      <text class="stairz ${cls}" x="${zx}" y="${y + 5}" text-anchor="${zAnchor}">+${p.z.toFixed(2)}σ</text>
      <text class="stairgen" x="${m.l - 22}" y="${y + 5}" text-anchor="end">${gen[i]}</text>`;
  });
  let ax = "";
  for (let z = 1; z <= 6; z++) {
    ax += `<line class="gridline" x1="${sx(z)}" y1="${m.t}" x2="${sx(z)}" y2="${h - m.b}"/>
      <text class="tick" x="${sx(z)}" y="${h - m.b + 24}" text-anchor="middle">+${z}σ</text>`;
  }
  return `<svg viewBox="0 0 ${w} ${h}" class="chart stair-chart" role="img"
    aria-label="Five Vanderbilt generations stepping left from 5.32 sigma to 1.47 sigma">${ax}${out}</svg>`;
}

function rulerPredict(w = 940, h = 330) {
  const m = { l: 60, r: 60 };
  const z0 = -3.2, z1 = 4.2;
  const sx = (z) => m.l + ((z - z0) / (z1 - z0)) * (w - m.l - m.r);
  const y = 190;
  let ax = "";
  for (let z = -3; z <= 4; z++) {
    ax += `<line class="tickline" x1="${sx(z)}" y1="${y - 7}" x2="${sx(z)}" y2="${y}"/>
      <text class="tick" x="${sx(z)}" y="${y + 24}" text-anchor="middle">${z === 0 ? "average" : (z > 0 ? "+" : "−") + Math.abs(z) + "σ"}</text>`;
  }
  const piHalf = (F.piRange / 2) / 3.0;
  return `<svg viewBox="0 0 ${w} ${h}" class="chart" role="img"
    aria-label="LeBron James at ${F.lebronZ} sigma, expected son at ${F.predZ}, Bronny James at ${F.bronnyZ}">
    <line class="axisline" x1="${m.l}" y1="${y}" x2="${w - m.r}" y2="${y}"/>${ax}
    <line class="pi" x1="${sx(F.predZ - piHalf)}" y1="${y + 52}" x2="${sx(F.predZ + piHalf)}" y2="${y + 52}"/>
    <line class="pi" x1="${sx(F.predZ - piHalf)}" y1="${y + 45}" x2="${sx(F.predZ - piHalf)}" y2="${y + 59}"/>
    <line class="pi" x1="${sx(F.predZ + piHalf)}" y1="${y + 45}" x2="${sx(F.predZ + piHalf)}" y2="${y + 59}"/>
    <text class="pilab" x="${sx(F.predZ)}" y="${y + 78}" text-anchor="middle">95% range for any single son, about ${Math.round(F.piRange)} inches</text>
    <line class="marker gold" x1="${sx(F.lebronZ)}" y1="${y - 108}" x2="${sx(F.lebronZ)}" y2="${y}"/>
    <text class="mname gold" x="${sx(F.lebronZ)}" y="${y - 118}" text-anchor="middle">LeBron James</text>
    <text class="mstat gold" x="${sx(F.lebronZ)}" y="${y - 96}" text-anchor="middle">+${F.lebronZ}σ</text>
    <line class="marker dashed" x1="${sx(F.predZ)}" y1="${y - 62}" x2="${sx(F.predZ)}" y2="${y}"/>
    <text class="mname" x="${sx(F.predZ)}" y="${y - 72}" text-anchor="middle">expected son  +${F.predZ}σ</text>
    <line class="marker fall" x1="${sx(F.bronnyZ)}" y1="${y - 32}" x2="${sx(F.bronnyZ)}" y2="${y}"/>
    <text class="mname fall" x="${sx(F.bronnyZ)}" y="${y - 42}" text-anchor="middle">Bronny +${F.bronnyZ}σ</text>
  </svg>`;
}

function splitBar(w = 900, h = 150) {
  const d = F.directions, total = d.fall + d.rise + d.level;
  const parts = [
    { n: d.fall, label: "fell", cls: "fall" },
    { n: d.rise, label: "rose", cls: "rise" },
    { n: d.level, label: "level", cls: "level" },
  ];
  let x = 0, out = "";
  for (const p of parts) {
    const bw = (p.n / total) * w;
    out += `<rect class="split ${p.cls}" x="${x}" y="30" width="${bw - 4}" height="52"/>
      <text class="splitn ${p.cls}" x="${x + 14}" y="20">${p.n}</text>
      <text class="splitlab" x="${x + 14}" y="106">${p.label}</text>`;
    x += bw;
  }
  return `<svg viewBox="0 0 ${w} ${h}" class="chart" role="img"
    aria-label="Of ${total} families, ${d.fall} fell, ${d.rise} rose and ${d.level} came out level">${out}</svg>`;
}

// ── The deck ─────────────────────────────────────────────────────────────
const cut = (label, clock) => ({ label, clock });

const SLIDES = [
  {
    kind: "title",
    kicker: "Regression to the mean",
    h: "Reversion<br>to the <em>Mean</em>",
    body: "Why the children of extraordinary people land closer to average.",
    notes: "Open cold. Do not explain what regression to the mean is yet. Say the title, then go straight to a dead man in 1877.",
  },
  {
    kicker: "1877",
    h: "The richest man in America died.",
    body: `Cornelius Vanderbilt left about <b>$105 million</b>, at a time when there were nine and a half million households in the country. Nobody else was close.`,
    portrait: "cornelius-vanderbilt",
    notes: "Let the number sit. $105m in 1877 is not a number anyone has intuition for, so the households figure is doing the work: he is one household in nine and a half million.",
  },
  {
    kicker: "Five generations",
    h: "The family walked back into the crowd.",
    chart: vanderbiltStair(),
    notes: "Trace it left with your hand as you talk. The Commodore, his son who nearly doubled it, then the split eight ways, then the trust spent on horses, then Gloria's estate under one and a half million.",
    cut: cut("the staircase building, one generation at a time", "0:54"),
  },
  {
    kicker: "1973",
    h: "A hundred and twenty relatives. Not one millionaire.",
    body: "Ninety six years after the Commodore died, the family held its first reunion at the university he had paid for. A descendant who wrote the family history counted the room.",
    notes: "This is the hook landing. Pause after 'not one millionaire'.",
  },
  {
    kicker: "The usual explanation",
    h: "Spending. Marble houses, yachts, a family that stopped building and started decorating.",
    body: "There is truth in it, and it makes a good book. But the same shape turns up in families that spent nothing at all. In height. In exam scores. In batting averages. In second albums.",
    notes: "Concede the obvious explanation properly before taking it away. If you rush this, the rest sounds like a trick.",
  },
  {
    kicker: "The 1880s",
    h: "A man set out to prove that greatness breeds greatness.",
    body: "Francis Galton wanted a hereditary aristocracy of talent. He went looking for the proof in the easiest thing to measure.",
    portrait: "francis-galton",
    notes: "Worth saying plainly that Galton's motive was eugenic and that his own data refused him. That refusal is the whole reason this is trustworthy.",
  },
  {
    kicker: `${F.galtonN} adult children`,
    h: "His own numbers refused him.",
    chart: galtonScatter(),
    notes: "Point at the dashed line first: that is the world people carry in their heads, children match parents. Then the solid one. Then the two places they separate, far left and far right.",
    cut: cut("the dots raining in, then both lines drawing", "2:54"),
  },
  {
    kind: "number",
    kicker: "The slope of the fitted line",
    big: F.galtonSlope.toFixed(2),
    h: "A child kept about two thirds of the parents' distance from average, and handed the rest back.",
    notes: "The single most important number in the talk. Say it slowly. Everything after this is a consequence of it.",
    cut: cut("the counter running from 1.00 down", "3:07"),
  },
  {
    kicker: "1886",
    h: "He named the finding after his own disappointment.",
    body: "<i>Regression towards mediocrity in hereditary stature.</i> It is the wrong name. Nothing is being pulled anywhere. Nobody is being punished for being tall.",
    notes: "The name is why people misunderstand this. 'Regression' sounds like a force. It is not a force, it is arithmetic.",
  },
  {
    kind: "equation",
    kicker: "The whole effect",
    h: "One multiplication.",
    equation: `expected child = parent × <b>${F.heightR}</b>`,
    body: "Take how far the parent sits from average, counted in standard deviations. Multiply by one number. An average parent loses nothing, because zero times anything is still zero. That is why nobody notices this in their own family.",
    notes: "Write it in the air if you have to. The zero-times-anything point is what makes it click for most people.",
  },
  {
    kicker: "One case",
    h: "An equation from 1886 missed a living person by four tenths of an inch.",
    chart: rulerPredict(),
    body: `LeBron James stands ${F.lebronZ}σ above the average American man, about one man in ${F.lebronRarity.toLocaleString("en-US")}. Multiply by ${F.heightR} and the expected son is 6′ 1.9″. Bronny James measured 6′ 1.5″ barefoot at the draft combine, on the same instrument that measured his father twenty one years earlier.`,
    notes: "The instrument detail matters: same combine, same measurement, twenty one years apart. That is what makes it a fair test rather than a coincidence.",
    cut: cut("the multiplication travelling down the ruler", "5:01"),
  },
  {
    kicker: "The honest part",
    h: "It predicts a crowd, not a person.",
    body: `The 95% range for any single son covers about ${Math.round(F.piRange)} inches, which is most of the adult male range. Bronny landing that close to the centre is partly luck. What the model gets right is the centre itself: the whole crowd of possible sons was shifted down, and the size of the shift was fixed before he was born.`,
    notes: "Do not skip this. Saying the limits out loud is what stops the whole talk sounding like astrology.",
  },
  {
    kicker: "Galton's other invention",
    h: "A box with pegs in it.",
    body: "Drop a ball at the top, let it bounce left or right at every peg, and it lands in a bin along the bottom. Drop a few hundred and the bins fill into a bell curve. Nobody designs that curve. It falls out of the bouncing.",
    notes: "Roll the film here rather than describing it. The board moving does more in eight seconds than a slide can.",
    cut: cut("232 balls falling, the bell forming", "6:06"),
  },
  {
    kicker: "The interesting version",
    h: "Keep only the far right balls. Drop them again.",
    body: "They come back toward the middle, and they come back hard. Nothing pushes them. The run of luck that put them out there simply is not repeated.",
    notes: "This is the mechanism, and it is the moment the talk either lands or does not. Nothing pushes them back.",
    cut: cut("the far right selected, then re-dropped", "6:17"),
  },
  {
    kicker: "Why it happens at all",
    h: "An extreme number is a durable part plus a lucky part. Only one of them has children.",
    body: "A person is that box with one change: some pegs are nailed down. Genes, nutrition, the family, the era. Those are set the same way for the child. The rest reset, and luck has no memory.",
    notes: "Land this flat. It is the thesis of the whole piece and it does not need a flourish.",
  },
  {
    kicker: `${F.dynastyN} famous families`,
    h: "A quarterback, a prime minister and a department store fortune do not share a unit. So we gave them one.",
    chart: slopeRows(),
    body: "Everybody here is placed by how far above their own crowd they sit, against a named reference population.",
    notes: "Open mark is the parent, filled mark is the child. Sorted by how far out the parent stood. Say that the sample is famous families and therefore biased; you pay that debt two slides later.",
    cut: cut("forty rows assembling", "7:57"),
  },
  {
    kind: "number",
    kicker: "The line through all forty",
    big: F.dynastySlope.toFixed(2),
    h: `A generation hands back about ${F.dynastyHandback} per cent of whatever the parent was above the mean.`,
    sub: splitBar(),
    notes: `Then immediately: ${F.directions.fall} fell, ${F.directions.rise} rose, ${F.directions.level} came out exactly level. It is a tilt, not a law. Stephen Curry rose and did not break anything: regression runs toward the mean, not downward, and Dell Curry had a long way above him to go.`,
    cut: cut("the slope counter", "8:12"),
  },
  {
    kicker: "Not all advantages are equal",
    h: "The more transferable the advantage, the slower it fades.",
    chart: decayColumns(),
    body: `A jump shot cannot be handed over. A surname can. So can a donor list, a school place, a trust, and a set of phone numbers that get returned.`,
    notes: `Height halves in ${F.halflife.height.toFixed(1)} generations, surname status in ${F.halflife.surname.toFixed(1)}. That gap is why we can name every sporting dynasty but political families run for centuries.`,
    cut: cut("the columns decaying", "9:43"),
  },
  {
    kicker: "The hole in every chart of famous families",
    h: `Almost half the children never become measurable at all.`,
    body: `The son of an NBA player who was very good in high school and then quietly stopped being remarkable is not a low dot on the chart. He is not on the chart. So the visible pairs understate the effect, always, in the same direction.`,
    notes: "This is the intellectual honesty slide. The chart anyone can draw is a survivor's chart, including ours.",
    cut: cut("the invisible children appearing", "11:30"),
  },
  {
    kicker: "Why we get it wrong",
    h: "Kahneman's flight instructors had years of evidence.",
    body: "Every cadet praised for a beautiful landing flew worse next time. Every cadet screamed at after a bad one improved. They were describing regression to the mean and calling it a management technique. The shouting was being rewarded by arithmetic.",
    portrait: "daniel-kahneman",
    notes: "The best story in the talk. Those instructors were not fools; they were doing what everybody does. We are built to find the cause of a change, and a change with no cause in it is nearly impossible to hold in your head.",
  },
  {
    kicker: "The close",
    h: "Less extreme is not the same as ordinary.",
    body: `Regression never said the child would be unremarkable. It said the child would be less extreme than the parent, on average, by an amount you can work out in advance. Bronny James is taller than about ${F.bronnyPct} per cent of American men and plays in the best basketball league in the world. Whatever that is, it is not a fall.`,
    notes: "End on the last line and stop. Do not add a summary. 'What the arithmetic knew about him, it knew before he was born. It never knew very much.'",
  },
  {
    kind: "end",
    kicker: "Sources and method",
    h: "Everything here is checkable.",
    body: `Galton's own 1886 tally of ${F.galtonN} adult children. Published parent-child correlations for height, earnings, wealth, schooling, IQ, lifespan and surname status. ${F.dynastyN} families placed as z scores against named reference populations, with an uncertainty band on every placement that is a judgement rather than a measurement.`,
    notes: "Point people at the film and the written version. Say plainly that the forty families are a biased convenience sample and that the survivor slide is why.",
  },
];

// ── Render ───────────────────────────────────────────────────────────────
const slideHTML = (s, i) => {
  const n = String(i + 1).padStart(2, "0");
  const parts = [];
  if (s.kicker) parts.push(`<p class="kicker">${s.kicker}</p>`);
  if (s.h) parts.push(`<h2>${s.h}</h2>`);
  if (s.kind === "number") parts.push(`<p class="bignum">${s.big}</p>`);
  if (s.kind === "equation") parts.push(`<p class="equation">${s.equation}</p>`);
  if (s.chart) parts.push(`<div class="chartwrap">${s.chart}</div>`);
  if (s.sub) parts.push(`<div class="chartwrap sub">${s.sub}</div>`);
  if (s.body) parts.push(`<p class="body">${s.body}</p>`);
  const portrait = s.portrait
    ? `<div class="portrait"><img src="img/${s.portrait}.jpg" alt=""></div>` : "";
  const cutTag = s.cut
    ? `<p class="cuttag"><span>Roll film</span> ${s.cut.clock} · ${esc(s.cut.label)}</p>` : "";
  return `<section class="slide ${s.kind || "text"}${s.portrait ? " has-portrait" : ""}" id="s${i + 1}">
  <div class="inner">${parts.join("\n    ")}</div>
  ${portrait}
  ${cutTag}
  <p class="pagenum">${n}</p>
</section>`;
};

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Reversion to the Mean — presentation deck</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:wght@400;500;600&display=swap" rel="stylesheet">
<link rel="stylesheet" href="css/slides.css">
</head>
<body>
<main id="deck">
${SLIDES.map(slideHTML).join("\n")}
</main>

<div id="hud">
  <span id="counter">1 / ${SLIDES.length}</span>
  <span class="hint">← → move · F fullscreen · G grid · N notes</span>
</div>

<aside id="notes" hidden></aside>

<script>
  window.__notes = ${JSON.stringify(SLIDES.map((s) => s.notes || ""))};
  window.__cuts = ${JSON.stringify(SLIDES.map((s) => s.cut || null))};
</script>
<script src="js/deck.js"></script>
</body>
</html>
`;

fs.writeFileSync(`${HERE}/index.html`, html, "utf8");

// ── Speaker notes ────────────────────────────────────────────────────────
let notes = `# Speaker notes

${SLIDES.length} slides, about 12 to 15 minutes at a calm pace. The deck is
\`index.html\`; press N in the deck to see these on screen while presenting.

Film cut points refer to **apps/reversion-film** playing with narration, total
running time ${TC.duration}. Timecodes are from the narrated build, not the
authored one, so they will be wrong if the narration is ever re-synthesised at a
different speed.

`;
SLIDES.forEach((s, i) => {
  notes += `\n## ${String(i + 1).padStart(2, "0")} · ${(s.h || s.kicker || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()}\n\n`;
  if (s.cut) notes += `**Roll film ${s.cut.clock}** — ${s.cut.label}\n\n`;
  notes += `${s.notes || ""}\n`;
});
fs.writeFileSync(`${HERE}/speaker-notes.md`, notes, "utf8");

console.log(`index.html: ${SLIDES.length} slides`);
console.log(`film cuts: ${SLIDES.filter((s) => s.cut).length}`);
console.log(`speaker-notes.md written`);
