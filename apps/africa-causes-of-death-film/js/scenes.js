// The film script: nine chapters, ~6 minutes plus explore pauses.
// Beats are idempotent state-setters keyed to film time; captions are an
// independent track. All numbers come from the dataset at build time.

import * as D from "./data.js";
import * as L from "./layouts.js";

const { L1_CMNN, L1_NCD, L1_INJ } = D;
const C = L.L1_COLOR_DARK;

// Friendlier display names for chart rows
const SHORT = {
  "Lower respiratory infections": "Lung infections (pneumonia)",
  "Preterm birth complications": "Preterm birth",
  "Birth asphyxia and birth trauma": "Birth asphyxia & trauma",
  "Diarrhoeal diseases": "Diarrhoeal disease",
  "Collective violence and legal intervention": "Collective violence",
  "Chronic obstructive pulmonary disease": "COPD",
  "Alzheimer disease and other dementias": "Dementias",
  "Trachea, bronchus, lung cancers": "Lung cancers",
  "Protein-energy malnutrition": "Malnutrition",
  "Neonatal sepsis and infections": "Neonatal sepsis",
};
const short = (n) => SHORT[n] || n;

function rowsFromTop(list, band) {
  const bandTotal = band ? D.totalByAge[band] : D.totalDeaths;
  return list.map((r) => ({
    key: r.ID,
    label: short(r.name),
    value: r.value,
    color: C[r.l1],
    sub: `${(100 * r.value / bandTotal).toFixed(1)}% of deaths in this age band`,
  }));
}

function hbarsFor(age, topN, opts = {}) {
  const top = D.topCauses({ age, topN });
  const keys = new Set(top.map((r) => r.ID));
  const chart = L.hbars({ rows: rowsFromTop(top, age), keyFn: (d) => d.leafID, ...opts });
  return { chart, select: (d) => d.age === age && keys.has(d.leafID) };
}

const withColor = (placeFactory, colorFn) => (sel, view) => {
  const pos = placeFactory(sel, view);
  return (d, k) => {
    const t = pos(d, k);
    if (t && !("a" in t && t.a === 0)) {
      const c = colorFn(d);
      if (c) t.color = c;
    }
    return t;
  };
};

const LEGEND = [
  { label: "Communicable, maternal & nutritional", color: C[L1_CMNN] },
  { label: "Non-communicable", color: C[L1_NCD] },
  { label: "Injuries", color: C[L1_INJ] },
];

const L1_GROUPS = () => [
  { key: L1_CMNN, label: "Communicable, maternal, perinatal & nutritional", value: D.l1Totals[L1_CMNN], color: C[L1_CMNN] },
  { key: L1_NCD, label: "Non-communicable diseases", value: D.l1Totals[L1_NCD], color: C[L1_NCD] },
  { key: L1_INJ, label: "Injuries", value: D.l1Totals[L1_INJ], color: C[L1_INJ] },
];

export function buildScript() {
  const beats = [];
  const captions = [];
  const chapters = [];
  const beat = (t, apply, pause = null) => beats.push({ t, apply, pause });
  const cap = (t, dur, text) => captions.push({ t, dur, text });
  const chapter = (t, title, mood) => chapters.push({ t, title, mood });

  const covidLeaf = D.leafNamed("COVID-19");
  const haemLeaf = D.leafNamed("Haemorrhagic stroke");
  const ischLeaf = D.leafNamed("Ischaemic stroke");

  const ebolaCluster = (withLabel) => L.cluster({
    cx: (v) => v.w * 0.38, cy: (v) => v.h * 0.42,
    color: L.GOLD, r: 3.2,
    label: withLabel ? "Ebola, every outbreak since 1976, everywhere" : null,
    sub: withLabel ? "about 15,000 deaths in half a century" : null,
  });

  // == Chapter 1: The outbreak (0:00) =====================================
  chapter(0, "The outbreak", { root: 110, chord: [0, 3, 7, 10], cutoff: 420, level: 0.8 });

  cap(0.8, 5.2, "Two months ago, another Ebola outbreak was declared in Uganda.");
  beat(1.2, (api) => {
    api.form({ select: (d) => d.i < 15, place: ebolaCluster(false).place, duration: 2.6, stagger: 2.0 });
  });
  cap(6.6, 5.4, "A confirmed case. A press conference. An emergency command centre. Global headlines.");
  cap(12.6, 4.6, "It has happened before, and it will happen again.");
  beat(17.4, (api) => {
    const ebola = ebolaCluster(true);
    api.form({ select: (d) => d.i < 15, place: ebola.place, duration: 0.5 });
    api.overlay(ebola);
  });
  cap(17.8, 6.4, "Since 1976, Ebola has killed about <strong>15,000 people</strong>: every outbreak, every affected country, combined.");
  beat(25.2, (api) => {
    const ebola = ebolaCluster(true);
    const week = L.cluster({
      cx: (v) => v.w * 0.66, cy: (v) => v.h * 0.42, color: C[L1_CMNN], r: 3.2,
      label: "Malaria in Africa, one bad week",
      sub: "about 12,000 deaths, most of them children",
    });
    api.form({ select: (d) => d.i < 15, place: ebola.place, duration: 0.4 });
    api.overlay(ebola);
    api.overlay(week);
    api.formMore({ select: (d) => d.i >= 20 && d.i < 32, place: week.place, duration: 2.0, stagger: 1.2 });
  });
  cap(25.6, 6.6, "That half-century total fits inside a <strong>single bad week of malaria</strong> on this continent.");
  cap(33.2, 4.2, "That contrast got me thinking.");
  cap(38.2, 6.6, "We organise our attention around emergencies. The causes that do most of the killing are almost never in the news.");

  // == Chapter 2: 8.3 million (0:46) ======================================
  chapter(46, "8.3 million", { root: 87.31, chord: [0, 7, 12, 16], cutoff: 700, level: 1 });

  beat(46, (api) => {
    api.form({ select: () => true, place: L.field({ color: L.NEUTRAL, top: 170 }).place, duration: 3.2, stagger: 4.2 });
    api.dom((ui) => ui.keyTag(true));
    api.overlayFn((ctx, view, ts) => {
      const p = Math.max(0, Math.min(1, (ts - 0.4) / 5.2));
      const e = 1 - Math.pow(1 - p, 3);
      const n = Math.round(e * D.totalDeaths);
      const a = L.stageArea(view);
      ctx.globalAlpha = Math.min(1, ts / 1.2) * (ts > 16 ? Math.max(0, 1 - (ts - 16) / 1.5) : 1);
      if (ctx.globalAlpha <= 0) { ctx.globalAlpha = 1; return; }
      ctx.textAlign = "center";
      ctx.fillStyle = L.GOLD;
      ctx.font = `700 ${Math.min(64, view.w / 14)}px ${L.FONT_SERIF}`;
      ctx.fillText(D.fmt(n), view.w / 2, a.y + 58);
      ctx.fillStyle = L.INK_SOFT;
      ctx.font = `500 13px ${L.FONT_SANS}`;
      ctx.fillText("DEATHS IN THE WHO AFRICAN REGION, 2021", view.w / 2, a.y + 84);
      ctx.globalAlpha = 1;
    });
  });
  cap(46.5, 7, "In 2021, <strong>8.3 million people</strong> died in the WHO African Region, of everything, at every age.");
  cap(54.5, 5, "Each dot on this screen is 1,000 of them. This is all of them at once.");
  beat(61, (api) => {
    const t = L.towers({ groups: L1_GROUPS(), keyFn: (d) => d.l1 });
    api.form({ select: () => true, place: t.place, duration: 2.4, stagger: 2.2 });
    api.overlay(t);
  });
  cap(61.5, 4.5, "Global health sorts these deaths into three big groups.");
  cap(66.5, 7.5, "<strong>Communicable, maternal, perinatal and nutritional conditions</strong>, the diseases of poverty: 4.6 million deaths. More than half of everything.");
  cap(74.5, 6, "<strong>Non-communicable diseases</strong>, meaning heart disease, cancer, diabetes, stroke: 2.9 million.");
  cap(81, 5.5, "<strong>Injuries</strong>, from road crashes to drowning to violence: 770,000.");
  beat(87.2, (api) => {
    const t = L.towers({ groups: L1_GROUPS(), keyFn: (d) => d.l1 });
    api.form({
      select: () => true,
      place: withColor(t.place, (d) => (d.leafID === covidLeaf?.ID ? L.GOLD : null)),
      duration: 1.2, stagger: 0.3,
    });
    api.overlay(t);
  });
  cap(87.5, 7, "And one cause that fits nowhere neatly. The gold dots are <strong>COVID-19</strong>: 493,000 deaths here in 2021, its worst year on the continent.");
  cap(95.5, 6.5, "But this three-way split hides the thing that matters most: <strong>when in a life each death lands</strong>.");
  const ageGroups = (goldUnder5) => D.AGE_BANDS.map((age) => ({
    key: age,
    label: age === "<5" ? "Under 5" : age,
    value: D.totalByAge[age],
    color: goldUnder5 && age === "<5" ? L.GOLD : L.NEUTRAL,
  }));
  beat(102.5, (api) => {
    const t = L.towers({ groups: ageGroups(false), keyFn: (d) => d.age });
    api.form({ select: () => true, place: t.place, duration: 2.2, stagger: 1.8 });
    api.overlay(t);
  });
  cap(103, 4.5, "Sort the same 8.3 million dots by age instead.");
  beat(108.5, (api) => {
    const t = L.towers({ groups: ageGroups(true), keyFn: (d) => d.age });
    api.form({ select: () => true, place: t.place, duration: 1.0, stagger: 0.2 });
    api.overlay(t);
  });
  cap(108.8, 6.7, "<strong>2.7 million of them, one in every three, are children under five.</strong>");

  // == Chapter 3: The first five years (1:56) =============================
  chapter(116, "The first five years", { root: 73.42, chord: [0, 3, 10, 14], cutoff: 430, level: 0.9 });

  beat(116, (api) => {
    const { chart, select } = hbarsFor("<5", 5, { title: "Leading causes of death, under 5. Africa, 2021" });
    api.form({ select, place: chart.place, duration: 2.2, stagger: 1.6 });
    api.overlay(chart);
  });
  cap(116.5, 4.5, "Under five, the chart is a horror show.");
  cap(121.5, 8, "<strong>Malaria</strong>: 450,000 children. The single largest killer of African children, from a disease we have known how to prevent for the better part of a century.");
  cap(130.5, 5.5, "<strong>Lung infections</strong>, mostly pneumonia: 427,000. Most of them vaccine-preventable.");
  cap(137, 8.5, "<strong>Preterm birth</strong>: 381,000 babies. <strong>Diarrhoeal disease</strong>, treatable with a thirty-cent packet of salts: 281,000. <strong>Birth asphyxia</strong>: 280,000.");
  cap(146.5, 7.5, "Five causes, over <strong>1.8 million child deaths</strong> in a single year. The cheapest, most proven interventions in public health line up against exactly this list.");
  beat(120, (api) => { api.dom((ui) => ui.hint(true)); });
  beat(132, (api) => { api.dom((ui) => ui.hint(false)); });

  // == Chapter 4: The quiet years (2:38) ==================================
  chapter(158, "The quiet years", { root: 98, chord: [0, 7, 14, 17], cutoff: 780, level: 0.8 });

  beat(158.5, (api) => {
    const { chart, select } = hbarsFor("5-14", 6, { title: "Leading causes of death, ages 5-14. Africa, 2021" });
    api.form({ select, place: chart.place, duration: 2.0, stagger: 1.4 });
    api.overlay(chart);
    api.overlayFn(L.l1Legend(LEGEND));
  });
  cap(159, 6.5, "If a child makes it past five, the next decade is statistically the safest stretch of a human life.");
  cap(166.5, 5.5, "Deaths fall to about 463,000, less than a fifth of the under-five toll.");
  cap(173, 7, "And the mix changes. After the lingering infections come the accidental hazards of childhood: <strong>road injuries</strong> and <strong>drowning</strong>, water, fire, traffic.");
  cap(181, 6, "After malaria, the biggest single threat to a school-age African child is something no doctor and no vaccine can fix.");

  // == Chapter 5: The productive years (3:08) =============================
  chapter(188, "The productive years", { root: 82.41, chord: [0, 3, 7, 14], cutoff: 560, level: 1 });

  beat(188.5, (api) => {
    const { chart, select } = hbarsFor("15-49", 7, { title: "Leading causes of death, ages 15-49. Africa, 2021" });
    api.form({ select, place: chart.place, duration: 2.0, stagger: 1.4 });
    api.overlay(chart);
    api.overlayFn(L.l1Legend(LEGEND));
  });
  cap(189, 5.5, "From 15 to 49, the years of working, parenting and providing, the picture changes entirely.");
  cap(195.5, 7.5, "<strong>HIV/AIDS</strong> is still the single largest killer of working-age Africans: 245,000 deaths in this band, three decades into the treatment era.");
  cap(204, 7, "<strong>Tuberculosis</strong>: 146,000. <strong>Road injuries</strong>: 105,000. <strong>COVID-19</strong>: 98,000 in this age band in 2021 alone.");
  cap(212, 5, "Interpersonal violence took 92,000 more. Self-harm, 49,000.");
  cap(218, 10, "And about <strong>151,000 women</strong> died of causes tied to pregnancy and childbirth. These are deaths the world has formally agreed should not happen. Four African countries currently meet the SDG maternal-mortality bar. Forty-three do not.");

  // == Chapter 6: The NCD wave (3:52) =====================================
  chapter(232, "The NCD wave", { root: 65.41, chord: [0, 7, 16, 19], cutoff: 520, level: 0.9 });

  beat(232.5, (api) => {
    const { chart, select } = hbarsFor("50-69", 6, { title: "Leading causes of death, ages 50-69. Africa, 2021" });
    api.form({ select, place: chart.place, duration: 2.0, stagger: 1.4 });
    api.overlay(chart);
    api.overlayFn(L.l1Legend(LEGEND));
  });
  cap(233, 6, "Past fifty, the infections recede, and the chart fills with a different kind of death.");
  cap(240, 6.5, "Ischaemic heart disease. Stroke. Hypertensive heart disease. Diabetes. The diseases the West spent fifty years learning to manage.");
  beat(247.5, (api) => {
    const { chart, select } = hbarsFor("70+", 6, { title: "Leading causes of death, 70 and older. Africa, 2021" });
    api.form({ select, place: chart.place, duration: 1.8, stagger: 1.2 });
    api.overlay(chart);
    api.overlayFn(L.l1Legend(LEGEND));
  });
  cap(248, 6.5, "By 70 and older, heart disease and the two strokes together account for roughly a third of all deaths.");
  cap(255.5, 6, "And COVID-19 holds a top-five place right through the oldest band: over 200,000 deaths among Africans over 70 in 2021.");
  beat(262.5, (api) => {
    const t = L.towers({
      groups: [
        { key: haemLeaf.ID, label: "Haemorrhagic stroke (bleeding)", value: haemLeaf.size, color: C[L1_NCD] },
        { key: ischLeaf.ID, label: "Ischaemic stroke (clotting)", value: ischLeaf.size, color: "#6E5E96" },
      ],
      keyFn: (d) => d.leafID,
    });
    api.form({ select: (d) => d.leafID === haemLeaf.ID || d.leafID === ischLeaf.ID, place: t.place, duration: 1.8, stagger: 1.0 });
    api.overlay(t);
  });
  cap(263, 9, "One detail worth pausing on. African stroke is predominantly <strong>haemorrhagic</strong>, the bleeding kind, the signature of years of untreated high blood pressure. Almost the inverse of the Western pattern.");

  // == Chapter 7: The double burden (4:33) ================================
  chapter(273, "The double burden", { root: 73.42, chord: [0, 5, 10, 14], cutoff: 620, level: 1 });

  beat(273.5, (api) => {
    const s = L.stackedShare({ bands: D.l1ByAge(), l1Order: D.L1_ORDER });
    api.form({ select: () => true, place: s.place, duration: 2.6, stagger: 2.4 });
    api.overlay(s);
    api.overlayFn(L.l1Legend(LEGEND));
  });
  cap(274, 5.5, "Now line all five ages up together, each scaled to 100%.");
  cap(280.5, 6.5, "The terracotta share, the diseases of poverty, falls with age. The violet share, the diseases of ageing, rises. They cross in the working years.");
  cap(288, 10.5, "Africa is the only continent living both halves at once. <strong>We are dying twice.</strong> Once young, of things our great-grandparents died of. Once older, of things the rich world's grandparents died of.");
  cap(299.5, 8, "Most health systems were built for one wave or the other. Africa's are being asked to handle both at the same time, on a fraction of the per-capita budget.");

  // == Chapter 8: The cheap deaths (5:08) =================================
  chapter(308.5, "The cheap deaths", { root: 87.31, chord: [0, 4, 7, 14], cutoff: 760, level: 0.9 });

  beat(309, (api) => {
    const malaria = D.leafNamed("Malaria");
    const lri = D.leafNamed("Lower respiratory infections");
    const diarr = D.leafNamed("Diarrhoeal diseases");
    const preterm = D.leafNamed("Preterm birth complications");
    const asph = D.leafNamed("Birth asphyxia and birth trauma");
    const birthIDs = new Set([preterm.ID, asph.ID]);
    const rowKey = (d) => (birthIDs.has(d.leafID) ? "birth" : d.leafID);
    const v = (leaf) => D.deaths(leaf.ID, "<5");
    const rows = [
      { key: malaria.ID, label: "Malaria", value: v(malaria), color: C[L1_CMNN], note: "a $3 bednet" },
      { key: lri.ID, label: "Lung infections", value: v(lri), color: C[L1_CMNN], note: "$40 of childhood vaccines" },
      { key: "birth", label: "Preterm birth, asphyxia & trauma", value: v(preterm) + v(asph), color: C[L1_CMNN], note: "a $50 skilled delivery" },
      { key: diarr.ID, label: "Diarrhoeal disease", value: v(diarr), color: C[L1_CMNN], note: "a 30-cent packet of salts" },
    ];
    rows.sort((a, b) => b.value - a.value);
    const keys = new Set([malaria.ID, lri.ID, diarr.ID, preterm.ID, asph.ID]);
    const chart = L.hbars({
      rows, keyFn: rowKey,
      title: "Under-5 deaths, and what prevention costs per child",
    });
    api.form({ select: (d) => d.age === "<5" && keys.has(d.leafID), place: chart.place, duration: 2.2, stagger: 1.6 });
    api.overlay(chart);
  });
  cap(309.5, 7, "Come back to the children one last time. The interventions that would prevent most of these deaths are, by any standard, almost embarrassingly cheap.");
  cap(317.5, 9, "A bednet: <strong>$3</strong>. A full course of childhood vaccines: <strong>$40</strong>. A packet of oral rehydration salts: <strong>30 cents</strong>. A skilled birth attendant: about <strong>$50</strong>.");
  cap(327.5, 7.5, "The NCD deaths further up the age range cost orders of magnitude more to prevent. But the cheapest health gains on Earth are still going unrealised, at scale, here.");
  cap(336, 6, "The bottleneck is delivery, and underneath that, financing.");

  // == Chapter 9: The next outbreak (5:43) ================================
  chapter(343, "The next outbreak", { root: 110, chord: [0, 7, 12, 19], cutoff: 680, level: 0.8 });

  beat(343.5, (api) => {
    api.form({ select: () => true, place: L.field({ color: L.NEUTRAL }).place, duration: 2.6, stagger: 2.0 });
  });
  cap(344, 6, "The next outbreak will come. The press conferences and emergency operations centres will assemble, as they should.");
  beat(351, (api) => {
    api.form({ select: () => true, place: L.field({ color: L.NEUTRAL }).place, duration: 0.8, stagger: 0.1 });
    api.formMore({
      select: (d) => d.i < 15,
      place: L.cluster({ cx: (v) => v.w * 0.5, cy: (v) => v.h * 0.4, color: L.GOLD, r: 3.4 }).place,
      duration: 1.6, stagger: 0.8,
    });
  });
  cap(351.5, 6, "It will look like this again: a small cluster of gold dots, and the whole world watching.");
  cap(358.5, 5.5, "The causes that take far more lives, year after year, will not be in the news.");
  cap(365, 4.5, "They are on the charts you have just watched.");

  return { beats, captions, chapters, duration: 371 };
}
