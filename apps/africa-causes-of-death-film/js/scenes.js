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
  "Self-harm": "Suicide (self-harm)",
};
const short = (n) => SHORT[n] || n;
const clamp01 = (x) => Math.max(0, Math.min(1, x));

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

  cap(0.8, 5.2, "Two months ago, Uganda declared another Ebola outbreak.");
  beat(1.2, (api) => {
    api.form({ select: (d) => d.i < 15, place: ebolaCluster(false).place, duration: 2.6, stagger: 2.0 });
  });
  cap(6.6, 5.8, "One confirmed case was enough to set everything in motion: a press conference, an emergency command centre, and headlines around the world.");
  cap(12.6, 4.6, "It has happened before, and it will happen again.");
  beat(17.4, (api) => {
    const ebola = ebolaCluster(true);
    api.form({ select: (d) => d.i < 15, place: ebola.place, duration: 0.5 });
    api.overlay(ebola);
  });
  cap(17.8, 7.2, "Here is a number that might surprise you. Since 1976, Ebola has killed about <strong>15,000 people</strong>. That accounts for every outbreak, in every country, over almost fifty years.");
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
  cap(25.6, 7.2, "Now let's look at malaria. In <strong>one bad week</strong>, malaria kills about the same number of people in Africa, and most of them are children.");
  cap(33.2, 4.2, "That contrast got me thinking.");
  cap(38.2, 7.4, "Emergencies like Ebola grab our attention, rightly so. However, the causes that quietly do most of the killing almost never make the news and are not as visible.");

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
  cap(46.5, 7, "In 2021, <strong>8.3 million people</strong> died in the WHO African Region. That is every death, from every cause, at every age.");
  cap(54.5, 5.8, "Every dot on this screen stands for 1,000 people. You are looking at all 8.3 million of them at once.");
  beat(61, (api) => {
    const t = L.towers({ groups: L1_GROUPS(), keyFn: (d) => d.l1 });
    api.form({ select: () => true, place: t.place, duration: 2.4, stagger: 2.2 });
    api.overlay(t);
  });
  cap(61.5, 4.5, "Health experts sort all these deaths into three big groups.");
  cap(66.5, 7.9, "The first group is infections, plus deaths linked to pregnancy, childbirth and poor nutrition. Doctors call these <strong>communicable, maternal, perinatal and nutritional conditions</strong>. These are the diseases of poverty, and they took 4.6 million lives. That is more than half of the total.");
  cap(74.5, 6.4, "The second group is <strong>non-communicable diseases</strong>, the ones you cannot catch from another person: heart disease, cancer, diabetes, stroke. They took 2.9 million lives.");
  cap(81, 5.5, "The third group is <strong>injuries</strong>: road crashes, drowning, violence. They took 770,000 lives.");
  beat(87.2, (api) => {
    const t = L.towers({ groups: L1_GROUPS(), keyFn: (d) => d.l1 });
    api.form({
      select: () => true,
      place: withColor(t.place, (d) => (d.leafID === covidLeaf?.ID ? L.GOLD : null)),
      duration: 1.2, stagger: 0.3,
    });
    api.overlay(t);
  });
  cap(87.5, 7.4, "One cause does not fit neatly anywhere. The gold dots you see now are <strong>COVID-19</strong>. It killed 493,000 people here in 2021, its worst year on the continent.");
  // Annotation: a gold label + leader arrow finding the COVID dot band live,
  // so it tracks the tower layout at any viewport size.
  beat(87.8, (api) => {
    const covID = covidLeaf?.ID;
    api.overlayFn((ctx, view, ts) => {
      const al = clamp01((ts - 0.6) / 0.5) * (1 - clamp01((ts - 7.6) / 1.2));
      if (al <= 0 || !covID) return;
      let n = 0, sx = 0, minX = Infinity, minY = Infinity, maxY = -Infinity;
      for (const p of api.pool.dots) {
        if (p.d.leafID !== covID || p.a < 0.5) continue;
        n++; sx += p.x;
        if (p.x < minX) minX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.y > maxY) maxY = p.y;
      }
      if (!n) return;
      const cy = (minY + maxY) / 2;
      ctx.globalAlpha = al;
      ctx.font = `600 13px ${L.FONT_SANS}`;
      ctx.fillStyle = L.GOLD;
      ctx.strokeStyle = L.GOLD;
      ctx.lineWidth = 1.2;
      const tw = ctx.measureText("COVID-19").width;
      if (minX - tw - 44 > 8) {
        // label left of the tower, leader arrow into the gold band
        const ax1 = minX - 8, ax0 = minX - 34;
        ctx.textAlign = "right";
        ctx.fillText("COVID-19", ax0 - 8, cy + 4);
        ctx.beginPath();
        ctx.moveTo(ax0, cy); ctx.lineTo(ax1, cy);
        ctx.moveTo(ax1 - 5, cy - 3.5); ctx.lineTo(ax1, cy); ctx.lineTo(ax1 - 5, cy + 3.5);
        ctx.stroke();
      } else {
        // narrow screens: label above the band (over tower dots, so give it
        // a dark backing pill), short arrow down
        const cx = sx / n;
        ctx.fillStyle = "rgba(20,17,38,0.78)";
        ctx.fillRect(cx - tw / 2 - 6, minY - 40, tw + 12, 20);
        ctx.fillStyle = L.GOLD;
        ctx.textAlign = "center";
        ctx.fillText("COVID-19", cx, minY - 26);
        ctx.beginPath();
        ctx.moveTo(cx, minY - 20); ctx.lineTo(cx, minY - 6);
        ctx.moveTo(cx - 3.5, minY - 11); ctx.lineTo(cx, minY - 6); ctx.lineTo(cx + 3.5, minY - 11);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    });
  });
  cap(95.5, 6.5, "But these three groups hide the question that matters most. <strong>How old were the people who died?</strong>");
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
  cap(103, 4.5, "So let's sort the same 8.3 million dots by age instead.");
  beat(108.5, (api) => {
    const t = L.towers({ groups: ageGroups(true), keyFn: (d) => d.age });
    api.form({ select: () => true, place: t.place, duration: 1.0, stagger: 0.2 });
    api.overlay(t);
  });
  cap(108.8, 6.7, "<strong>2.7 million of them were children under five.</strong> That is one out of every three deaths.");

  // == Chapter 3: The first five years (1:56) =============================
  chapter(116, "The first five years", { root: 73.42, chord: [0, 3, 10, 14], cutoff: 430, level: 0.9 });

  beat(116, (api) => {
    const { chart, select } = hbarsFor("<5", 5, { title: "Leading causes of death, under 5. Africa, 2021" });
    api.form({ select, place: chart.place, duration: 2.2, stagger: 1.6 });
    api.overlay(chart);
  });
  cap(116.5, 4.5, "For children under five, this chart is hard to look at.");
  cap(121.5, 8, "<strong>Malaria</strong> killed 450,000 children. It is the single biggest killer of African children, and we have known how to prevent it for almost a hundred years.");
  cap(130.5, 5.8, "<strong>Lung infections</strong>, mostly pneumonia, killed 427,000. Vaccines could have prevented most of these deaths.");
  cap(137, 9, "<strong>Preterm birth</strong> took 381,000 babies. <strong>Diarrhoeal disease</strong>, which a thirty-cent packet of salts can treat, took 281,000. <strong>Birth asphyxia</strong>, when a baby cannot breathe during delivery, took 280,000.");
  cap(146.5, 7.5, "Just five causes killed more than <strong>1.8 million children</strong> in a single year. And the cheapest, best-proven interventions in public health are aimed at exactly this list.");
  beat(120, (api) => { api.dom((ui) => ui.hint(true)); });
  beat(132, (api) => { api.dom((ui) => ui.hint(false)); });

  // == Chapter 4: The quiet years (2:38) ==================================
  chapter(158, "The quiet years", { root: 98, chord: [0, 7, 14, 17], cutoff: 780, level: 0.8 });

  beat(158.5, (api) => {
    const { chart, select } = hbarsFor("5-14", 7, { title: "Leading causes of death, ages 5-14. Africa, 2021" });
    api.form({ select, place: chart.place, duration: 2.0, stagger: 1.4 });
    api.overlay(chart);
    api.overlayFn(L.l1Legend(LEGEND));
  });
  cap(159, 6.5, "Here is some good news. If a child makes it past five, the next ten years are the safest stretch of a human life.");
  cap(166.5, 5.5, "Deaths drop to about 463,000. That is less than a fifth of the under-five number.");
  cap(173, 7, "The causes change too. Infections are still on the list, but everyday accidents start climbing: <strong>road injuries</strong> and <strong>drowning</strong>.");
  cap(181, 6.6, "Look at the second bar. After lung infections, the biggest single threat to a school-age child is a <strong>road accident</strong>. No doctor and no vaccine can fix that.");

  // == Chapter 5: The productive years (3:08) =============================
  chapter(188, "The productive years", { root: 82.41, chord: [0, 3, 7, 14], cutoff: 560, level: 1 });

  beat(188.5, (api) => {
    const { chart, select } = hbarsFor("15-49", 7, { title: "Leading causes of death, ages 15-49. Africa, 2021" });
    api.form({ select, place: chart.place, duration: 2.0, stagger: 1.4 });
    api.overlay(chart);
    api.overlayFn(L.l1Legend(LEGEND));
  });
  cap(189, 5.5, "From 15 to 49, the years of working and raising families, the picture changes completely.");
  cap(195.5, 7.5, "<strong>HIV/AIDS</strong> is still the number one killer of working-age Africans. It took 245,000 lives in this age group, thirty years after good treatment became available.");
  cap(204, 7, "<strong>Tuberculosis</strong> killed 146,000. <strong>Road injuries</strong>, 105,000. <strong>COVID-19</strong>, 98,000 in this age group in 2021 alone.");
  cap(212, 5, "Violence took 92,000 more. Suicide, 49,000.");
  cap(218, 10, "Still in this age group, about <strong>151,000 women</strong> died from complications of pregnancy and childbirth. The world has agreed on a target for making these deaths rare. Today, four African countries meet it. Forty-three do not.");

  // == Chapter 6: The NCD wave (3:52) =====================================
  chapter(232, "The NCD wave", { root: 65.41, chord: [0, 7, 16, 19], cutoff: 520, level: 0.9 });

  beat(232.5, (api) => {
    const { chart, select } = hbarsFor("50-69", 6, { title: "Leading causes of death, ages 50-69. Africa, 2021" });
    api.form({ select, place: chart.place, duration: 2.0, stagger: 1.4 });
    api.overlay(chart);
    api.overlayFn(L.l1Legend(LEGEND));
  });
  cap(233, 6, "Past fifty, the picture shifts again. A different kind of death starts filling the chart.");
  cap(240, 7.5, "Look at the top of the chart. <strong>COVID-19</strong> was the single biggest killer at this age in 2021. Right behind it come <strong>ischaemic heart disease</strong> and <strong>haemorrhagic stroke</strong>, the diseases rich countries spent fifty years learning to manage. And tuberculosis and HIV still have not let go.");
  beat(247.5, (api) => {
    const { chart, select } = hbarsFor("70+", 6, { title: "Leading causes of death, 70 and older. Africa, 2021" });
    api.form({ select, place: chart.place, duration: 1.8, stagger: 1.2 });
    api.overlay(chart);
    api.overlayFn(L.l1Legend(LEGEND));
  });
  cap(248, 6.5, "By 70 and older, heart disease and the two kinds of stroke together cause more than one in four deaths.");
  cap(255.5, 6, "And COVID-19 is still near the top here: over 200,000 deaths among Africans over 70 in 2021.");
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
  cap(263, 9.4, "One detail is worth a pause. Most strokes in Africa are <strong>haemorrhagic</strong>, the bleeding kind. That is what years of untreated high blood pressure does to blood vessels. In rich countries it is mostly the opposite: the clotting kind, <strong>ischaemic stroke</strong>, is more common.");

  // == Chapter 7: The double burden (4:33) ================================
  chapter(273, "The double burden", { root: 73.42, chord: [0, 5, 10, 14], cutoff: 620, level: 1 });

  const shareBands = D.l1ByAge();
  const shareChart = L.stackedShare({ bands: shareBands, l1Order: D.L1_ORDER });
  beat(273.5, (api) => {
    api.form({ select: () => true, place: shareChart.place, duration: 2.6, stagger: 2.4 });
    api.overlay(shareChart);
    api.overlayFn(L.l1Legend(LEGEND));
  });
  cap(274, 5.5, "Now put all five age groups side by side, each stretched to 100 percent.");
  cap(280.5, 7, "The red share, the diseases of poverty, shrinks as people get older. The purple share, the diseases of ageing, grows. <strong>They trade places in the working years.</strong>");
  // Annotation: mark the crossover between the 15-49 and 50-69 columns.
  beat(280.8, (api) => {
    api.overlayFn((ctx, view, ts) => {
      const al = clamp01((ts - 0.5) / 0.5) * (1 - clamp01((ts - 7.6) / 1.2));
      if (al <= 0 || !shareChart.geom) return;
      const b3 = shareBands.find((b) => b.age === "15-49");
      const b4 = shareBands.find((b) => b.age === "50-69");
      if (!b3 || b3._gx == null || !b4 || b4._gx == null) return;
      const { y0, H } = shareChart.geom;
      const mx = (b3._gx + b4._gx) / 2;
      ctx.globalAlpha = al;
      ctx.textAlign = "center";
      ctx.fillStyle = L.GOLD;
      ctx.font = `600 12.5px ${L.FONT_SANS}`;
      ctx.fillText("they trade places here", mx, y0 - 16);
      ctx.strokeStyle = L.GOLD;
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 5]);
      ctx.beginPath();
      ctx.moveTo(mx, y0 - 8);
      ctx.lineTo(mx, y0 + H * 0.55);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
    });
  });
  cap(288, 10, "Africa is the only continent carrying both burdens at once. Children are still dying of the old diseases of poverty, and at the same time older adults are dying of the diseases of rich countries.");
  cap(299.5, 8, "Most health systems were built to handle one of these burdens. African health systems are being asked to handle both at once, with far less money per person.");

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
  cap(309.5, 7, "Let's come back to the children one last time. The interventions that would prevent most of these deaths are shockingly cheap.");
  cap(317.5, 9, "A bednet costs <strong>three dollars</strong>. A full course of childhood vaccines, about <strong>forty dollars</strong>. A packet of oral rehydration salts, <strong>thirty cents</strong>. A trained birth attendant, about <strong>fifty dollars</strong>.");
  cap(327.5, 7.5, "Preventing heart disease or cancer later in life costs far, far more. But these cheap wins for children are still not happening at full scale, right here where they are needed most.");
  cap(336, 6, "The missing piece is getting these tools to every family, and finding the money to pay for it.");

  // == Chapter 9: The next outbreak (5:43) ================================
  chapter(343, "The next outbreak", { root: 110, chord: [0, 7, 12, 19], cutoff: 680, level: 0.8 });

  beat(343.5, (api) => {
    api.form({ select: () => true, place: L.field({ color: L.NEUTRAL }).place, duration: 2.6, stagger: 2.0 });
  });
  cap(344, 6, "The next outbreak will come. The press conferences and emergency teams will spring into action, and they should.");
  beat(351, (api) => {
    api.form({ select: () => true, place: L.field({ color: L.NEUTRAL }).place, duration: 0.8, stagger: 0.1 });
    api.formMore({
      select: (d) => d.i < 15,
      place: L.cluster({ cx: (v) => v.w * 0.5, cy: (v) => v.h * 0.4, color: L.GOLD, r: 3.4 }).place,
      duration: 1.6, stagger: 0.8,
    });
  });
  cap(351.5, 6, "It will look like this again. A small cluster of gold dots, with the whole world watching.");
  // Annotation: a dashed circle picks the gold cluster out of the field.
  // Stays on for the closing lines; this is the film's final image.
  beat(351.8, (api) => {
    api.overlayFn((ctx, view, ts) => {
      const al = clamp01((ts - 0.8) / 0.8);
      if (al <= 0) return;
      ctx.globalAlpha = al * 0.9;
      ctx.strokeStyle = L.GOLD;
      ctx.lineWidth = 1.2;
      ctx.setLineDash([4, 6]);
      ctx.beginPath();
      ctx.arc(view.w * 0.5, view.h * 0.4, 52, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
    });
  });
  cap(358.5, 5.5, "The causes that take far more lives, year after year, will not be as visible in the news.");
  cap(365, 4.5, "They are in the charts you have just watched.");

  return { beats, captions, chapters, duration: 371 };
}
