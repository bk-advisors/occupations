// The film script: eight chapters, about seven and a half minutes on the
// authored timeline before narration stretches it.
//
// Beats are idempotent state-setters keyed to film time; captions are an
// independent track. Every number a caption speaks is interpolated from
// js/data.js, so a caption and the chart under it cannot disagree. If you
// change a figure, change the data, never the sentence.
//
// House rules carried over from the story's SPEC: no em-dashes anywhere, no
// AI tells, Morgan Housel register. Short declarative sentences, a concrete
// story before the principle, sections that end flat rather than on a
// flourish.

import * as D from "./data.js";
import * as L from "./layouts.js";

const { N } = D;
const pair = (id) => D.pairNamed(id);
const one = (name) => D.personNamed(name);

// A crowd on the sigma ruler: everyone, placed by how rare they are. Under the
// rarity construction the population is standard normal on this axis by
// definition, which is what makes the heap in the middle honest rather than
// decorative.
const CROWD = (d) => d.kind === "crowd";
const UNSEEN = (d) => d.kind === "unseen";
const GALTON_DOTS = (d) => d.kind === "galton";
const BALLS = (d) => d.kind === "galton" && d.ball;
const PERSON = (d) => d.kind === "person";

export function buildScript() {
  const beats = [];
  const captions = [];
  const chapters = [];
  const beat = (t, apply, pause = null) => beats.push({ t, apply, pause });
  const cap = (t, dur, text) => captions.push({ t, dur, text });
  const chapter = (t, title, mood) => chapters.push({ t, title, mood });

  // ══ Chapter 1: The Commodore (0:00) ═════════════════════════════════════
  chapter(0, "The Commodore", { root: 98, chord: [0, 3, 7, 10], cutoff: 380, level: 0.8 });

  // The crowd sits low and shallow: chapter 1 spends its vertical space on the
  // five generations above it, and the bell is the ground they walk back into.
  const crowdBell = () => L.bell({
    zOf: (d) => d.z, z0: -3.4, z1: 6.1, binW: 0.22,
    color: L.T.neutral, baselineFrac: 0.9, heightFrac: 0.2,
    axisLabel: "every US household, placed by how rare its wealth is",
  });

  // The five Vanderbilt generations, a row each. Three of them sit within
  // half a sigma of each other (5.32, 5.34, 4.86), so one horizontal line
  // would stack three portraits and six labels on the same pixels.
  const CHAIN = D.VANDERBILT_CHAIN.map((p, i) => ({
    slug: ["cornelius-vanderbilt", "william-henry-vanderbilt", "cornelius-vanderbilt-ii",
           "reginald-vanderbilt", "gloria-vanderbilt"][i],
    name: p.name, sub: p.stat, z: p.z,
    gen: ["the Commodore", "his son", "his grandson", "great grandson", "great great granddaughter"][i],
    color: i === 0 ? L.T.accent : i === 4 ? L.T.fall : L.T.ink,
  }));

  const chainTo = (k, freshAt = 0.3) => L.generations({
    people: CHAIN.slice(0, k + 1).map((p, i) => ({ ...p, at: i < k ? -99 : freshAt })),
    z0: -3.4, z1: 6.1, r: 26, axis: false,
    area: (v) => {
      const a = L.stageArea(v);
      return { x: a.x, y: a.y, w: a.w, h: a.h * 0.86 };
    },
    // The ruler on stage belongs to the bell, which uses the full stage area
    // and a 0.9 baseline. Without this the five drop lines stop in mid-air
    // above the axis they are supposed to be pointing at.
    rulerY: (v) => { const a = L.stageArea(v); return a.y + a.h * 0.9 + 10; },
  });

  beat(0.8, (api) => {
    const b = crowdBell();
    api.form({ select: CROWD, place: b.place, duration: 3.4, stagger: 3.6 });
    api.overlay(b);
    api.dom((ui) => ui.keyTag("Each dot is one household. The scale is standard deviations from average."));
  });
  cap(1.0, 5.4, "In 1877, Cornelius Vanderbilt died the richest man in America.");

  beat(6.4, (api) => {
    const b = crowdBell();
    api.form({ select: CROWD, place: b.place, duration: 0.6, stagger: 0.2 });
    api.overlay(b);
    api.overlayFn(chainTo(0));
  });
  cap(6.8, 8.2, "He was worth about <strong>105 million dollars</strong>, at a time when there were nine and a half million households in the country. Out here, on the right, on his own.");

  beat(15.6, (api) => {
    const b = crowdBell();
    api.form({ select: CROWD, place: b.place, duration: 0.5, stagger: 0.1 });
    api.overlay(b);
    api.overlayFn(chainTo(1));
  });
  cap(16, 7.4, "He left almost all of it to one son, deliberately, to keep it whole. That son nearly doubled it in eight years.");

  beat(24, (api) => {
    const b = crowdBell();
    api.form({ select: CROWD, place: b.place, duration: 0.5, stagger: 0.1 });
    api.overlay(b);
    api.overlayFn(chainTo(2));
  });
  cap(24.4, 6.6, "Then the fortune was split eight ways. The eldest got the biggest share and still ended with about a third of what his father held.");

  beat(31.6, (api) => {
    const b = crowdBell();
    api.form({ select: CROWD, place: b.place, duration: 0.5, stagger: 0.1 });
    api.overlay(b);
    api.overlayFn(chainTo(3));
  });
  cap(32, 6.2, "The generation after that received five million in trust, and spent most of it on horses.");

  beat(38.8, (api) => {
    const b = crowdBell();
    api.form({ select: CROWD, place: b.place, duration: 0.5, stagger: 0.1 });
    api.overlay(b);
    api.overlayFn(chainTo(4));
  });
  cap(39.2, 8.6, "And in 2019, Gloria Vanderbilt died with an estate reported at under <strong>one and a half million dollars</strong>. Her son has said he expected nothing and received almost none.");

  cap(48.4, 8.8, "Ninety six years after the Commodore died, the family held its first reunion. A descendant counted the room. Among a hundred and twenty relatives, there was not a millionaire.");
  cap(58, 6.4, "The usual explanation is spending. Marble houses, yachts, a family that stopped building things and started decorating them.");
  cap(65, 4.4, "There is truth in that, and it makes a good book.");
  cap(70, 8.2, "But the same shape turns up in families that spent nothing at all. It turns up in height, in exam scores, in batting averages, in second albums.");
  cap(79, 4.2, "Something very ordinary is going on.");

  // ══ Chapter 2: Galton's disappointment (1:24) ═══════════════════════════
  chapter(84, "Galton’s disappointment", { root: 73.42, chord: [0, 7, 12, 16], cutoff: 620, level: 0.9 });

  beat(84.2, (api) => {
    api.form({ select: () => false, place: crowdBell().place, duration: 0.8 });
    api.overlayFn(L.portraitCard({
      slug: "francis-galton", name: "Francis Galton",
      sub: "Set out to prove that greatness breeds greatness, and published the opposite in 1886.",
      yFrac: 0.36, r: 76, inFrom: 0.4, hold: 12,
    }));
    api.dom((ui) => ui.keyTag(false));
  });
  cap(84.6, 6.2, "In the 1880s a man named <strong>Francis Galton</strong> set out to prove that greatness breeds greatness.");
  cap(91.4, 7, "He wanted a hereditary aristocracy of talent, and he went looking for the proof in the easiest thing to measure.");

  const galtonScatter = (lines) => L.scatter({
    xOf: (d) => d.mid, yOf: (d) => d.child,
    x0: 63, x1: 74, y0: 60.5, y1: 75,
    xLabel: "Average height of the two parents (inches)",
    yLabel: "Height of the adult child (inches)",
    title: `Galton’s tally, ${D.fmt(N.galtonN)} adult children`,
    color: L.T.neutral, r: 1.9, lines,
  });

  const IDENTITY = {
    slope: 1, intercept: N.galtonN * 0 + (D.GALTON_CHILD_MEAN - D.GALTON_MID_MEAN),
    color: L.T.inkMute, dash: [5, 5], width: 1.6, delay: 0.6,
    label: "what most people expect", labelDy: -12,
  };
  const FIT = {
    slope: N.galtonSlope, intercept: D.GALTON_FIT.intercept,
    color: L.T.accent, width: 2.4, delay: 0.6,
    label: `what the data draws · slope ${N.galtonSlope.toFixed(2)}`, labelDy: 20,
  };

  beat(98.8, (api) => {
    const s = galtonScatter([]);
    api.form({ select: GALTON_DOTS, place: s.place, duration: 2.6, stagger: 3.2 });
    api.overlay(s);
  });
  cap(99, 7.6, `He collected the heights of <strong>${D.fmt(N.galtonN)} grown children</strong>, along with the heights of their parents, and plotted one against the other.`);
  cap(107.4, 7.2, "Each dot is one adult child. Along the bottom, the average of their two parents. Up the side, how the child turned out.");

  beat(115.4, (api) => {
    const s = galtonScatter([IDENTITY]);
    api.form({ select: GALTON_DOTS, place: s.place, duration: 0.6, stagger: 0.2 });
    api.overlay(s);
  });
  cap(115.8, 7.4, "The dashed line is the world most people carry around in their head. Children match their parents. Every family holds its place.");

  beat(124, (api) => {
    const s = galtonScatter([IDENTITY, FIT]);
    api.form({ select: GALTON_DOTS, place: s.place, duration: 0.6, stagger: 0.2 });
    api.overlay(s);
  });
  cap(124.4, 8.4, "The line the data actually draws is flatter. On the right, among the tall families, it sits below the expectation. On the left it sits above.");

  beat(133.6, (api) => {
    const s = galtonScatter([IDENTITY, FIT]);
    api.form({ select: GALTON_DOTS, place: s.place, duration: 0.5, stagger: 0.1 });
    api.overlay(s);
    api.overlayFn(L.bigNumber({
      value: N.galtonSlope, from: 1, label: "slope of the fitted line",
      dur: 2.6, hold: 7.4, yFrac: 0.06, fmtFn: (v) => v.toFixed(2),
    }));
  });
  cap(134, 8, `Its slope is <strong>${N.galtonSlope.toFixed(2)}</strong>. A child kept about two thirds of the parents’ distance from average, and handed the rest back.`);
  cap(142.8, 6.6, "Tall parents did have tall children. Just not as tall. Short parents had short children, and not as short.");
  cap(150, 5.2, "Every family had drifted back toward the middle while he was not looking.");

  // No beat here on purpose. An annotation carrying the 1886 title would say
  // exactly what the caption below it is already saying, and the scatter
  // already has two labelled lines on it. The scatter overlay from the beat
  // above persists, so the frame holds while the caption does the work.
  cap(156.2, 7.2, "He published it in 1886 under a title that still has an edge on it. <strong>Regression towards mediocrity in hereditary stature</strong>.");
  cap(164, 6.8, "He had gone looking for the dashed line and found the solid one, so he named the finding after his own disappointment.");
  cap(171.4, 6.2, "It is the wrong name. Nothing is being pulled anywhere. Nobody is being punished for being tall.");

  // ══ Chapter 3: One multiplication (2:58) ════════════════════════════════
  chapter(178, "One multiplication", { root: 87.31, chord: [0, 7, 14, 17], cutoff: 700, level: 1 });

  const heightBell = () => L.bell({
    zOf: (d) => d.z, z0: -3.4, z1: 4.6, binW: 0.2,
    color: L.T.neutral, baselineFrac: 0.95, heightFrac: 0.17,
    axisLabel: "adult men in the United States, by height",
  });

  beat(178.2, (api) => {
    const b = heightBell();
    api.form({ select: CROWD, place: b.place, duration: 2.4, stagger: 2.4 });
    api.overlay(b);
  });
  cap(178.6, 4, "The whole effect is one multiplication.");
  cap(183.2, 8.2, "Take how far the parent sits from average, counted in standard deviations. Multiply by one number. That is where you expect the child to land.");
  cap(192, 9, `For height, that number is <strong>${N.heightR.toFixed(2)}</strong>. An average parent loses nothing, because zero multiplied by anything is still zero. Which is why nobody notices this in their own family.`);

  beat(201.6, (api) => {
    const b = heightBell();
    api.form({ select: CROWD, place: b.place, duration: 0.6, stagger: 0.2 });
    api.overlay(b);
    api.overlayFn(L.prediction({
      parent: { slug: "lebron-james", label: `LeBron James  ${D.fmtFt(D.HEIGHT.lebron)}`, z: N.lebronZ },
      child: { slug: "bronny-james", label: `Bronny James  ${D.fmtFt(D.HEIGHT.bronny)}`, z: N.bronnyZ },
      r: N.heightR, z0: -3.4, z1: 4.6, axisFrac: 0.95,
      piHalf: (N.piRange / 2) / D.HEIGHT.sd,
    }));
  });
  // Rounded to the nearest hundred. The underlying rarity is 1 in 2,792, but
  // it rests on a normal approximation at 3.4σ and on a listed height, so
  // saying "2,792" out loud would claim a precision the number does not have.
  const lebronRarityRounded = Math.round(N.lebronRarity / 100) * 100;
  cap(202, 7.6, `<strong>LeBron James</strong> stands ${N.lebronZ.toFixed(1)} standard deviations above the average American man. About one man in ${D.fmt(lebronRarityRounded)} is that tall.`);
  cap(210.4, 5.8, `Multiply by ${N.heightR.toFixed(2)} and the expected son comes out at <strong>${D.fmtFt(N.predHeight, { prose: true })}</strong>.`);
  cap(217, 8.4, `Bronny James measured ${D.fmtFt(D.HEIGHT.bronny, { prose: true })} barefoot at the draft combine, on the same instrument that measured his father twenty one years earlier.`);
  cap(226.2, 6.4, `An equation written in 1886, with no knowledge of genetics, missed him by <strong>four tenths of an inch</strong>.`);
  cap(233.4, 8.8, `Now the honest part. The model does not predict a person. The range for any single son covers about ${Math.round(N.piRange)} inches, which is most of the adult male range.`);
  cap(243, 8.4, "What it gets right is the centre. The whole crowd of possible sons was shifted down, and the size of the shift was fixed before he was born.");

  // ══ Chapter 4: The box with pegs in it (4:12) ═══════════════════════════
  chapter(252, "The box with pegs in it", { root: 65.41, chord: [0, 3, 10, 14], cutoff: 460, level: 0.85 });

  const board = (opts) => L.pegboard({ rows: D.BOARD_ROWS, color: L.T.neutral, ...opts });
  const SELECTED = new Set(D.BOARD_SELECTED.map((b) => b.bi));
  const isBall = (d) => d.kind === "galton" && d.ball;
  const isSelected = (d) => isBall(d) && SELECTED.has(d.ball.bi);

  beat(252.2, (api) => {
    const b = board({ stage: 0 });
    api.form({ select: BALLS, place: b.place, duration: 1.6, stagger: 1.2 });
    api.overlay(b);
    api.dom((ui) => ui.keyTag(`Each dot is one ball. ${D.BOARD_BALLS} of them, ${D.BOARD_ROWS} rows of pegs.`));
  });
  cap(252.6, 4.4, "Galton also built a wooden box with pegs in it.");
  cap(257.6, 7, "Drop a ball at the top, let it bounce left or right at every peg, and it lands in one of the bins along the bottom.");

  // the fall, one beat per peg row
  for (let r = 1; r <= D.BOARD_ROWS; r++) {
    beat(264.4 + (r - 1) * 0.44, (api) => {
      const b = board({ stage: r });
      api.form({ select: BALLS, place: b.place, duration: 0.42, stagger: 0, ease: "gravity" });
      api.overlay(b);
      api.sfxBurst("peg", 9, 0.3);
    });
  }
  beat(264.4 + D.BOARD_ROWS * 0.44, (api) => {
    const b = board({ stage: "bins" });
    api.form({ select: BALLS, place: b.place, duration: 1.1, stagger: 0.5, ease: "gravity" });
    api.overlay(b);
    api.sfxBurst("peg", 12, 0.5);
    api.sfx("settle");
  });
  cap(265, 7.6, "Drop a few hundred and the bins fill into a bell curve. Nobody designs that curve. It falls out of the bouncing.");

  beat(273.6, (api) => {
    const b = board({ stage: "bins", highlightBins: [D.BOARD_ROWS, D.BOARD_ROWS - 1] });
    api.form({ select: BALLS, place: b.place, duration: 0.8, stagger: 0.3 });
    api.overlay(b);
    api.overlayFn(L.note({
      text: `${D.BOARD_SELECTED.length} balls out of ${D.BOARD_BALLS}. The freak results.`,
      x: (v) => v.w * 0.78, y: (v) => v.h * 0.3, align: "center", inFrom: 1.4, hold: 7,
      toX: (v) => v.w * 0.66, toY: (v) => v.h * 0.69,
    }));
  });
  cap(274, 8, "Now the interesting version. Keep only the balls that landed at the far right. The freak results, the ones that went right nearly every time.");

  beat(282.6, (api) => {
    const b = board({ stage: "bins", highlightBins: [D.BOARD_ROWS, D.BOARD_ROWS - 1] });
    api.form({ select: isSelected, place: b.place, duration: 1.0, stagger: 0.4 });
    api.overlay(b);
  });
  beat(285.4, (api) => {
    const b = board({ stage: 0, walkKey: "walk2", highlightBins: null });
    api.form({
      select: isSelected,
      place: (sel, view) => { const p = b.place(sel, view); return (d, k) => ({ ...p(d, k), color: L.T.accent }); },
      duration: 1.3, stagger: 0.5,
    });
    api.overlay(b);
  });
  cap(283, 4.6, "Drop each of them again from where it sits.");

  for (let r = 1; r <= D.BOARD_ROWS; r++) {
    beat(288 + (r - 1) * 0.44, (api) => {
      const b = board({ stage: r, walkKey: "walk2" });
      api.form({
        select: isSelected,
        place: (sel, view) => { const p = b.place(sel, view); return (d, k) => ({ ...p(d, k), color: L.T.accent }); },
        duration: 0.42, stagger: 0, ease: "gravity",
      });
      api.overlay(b);
      api.sfxBurst("peg", 5, 0.26);
    });
  }
  beat(288 + D.BOARD_ROWS * 0.44, (api) => {
    const b = board({ stage: "bins", walkKey: "walk2", binOverride: D.redropBin });
    api.form({
      select: isSelected,
      place: (sel, view) => { const p = b.place(sel, view); return (d, k) => ({ ...p(d, k), color: L.T.accent }); },
      duration: 1.2, stagger: 0.5, ease: "gravity",
    });
    api.overlay(b);
    api.sfx("settle");
    api.overlayFn(L.note({
      text: "Nothing pushed them back. The run of luck simply did not repeat.",
      x: (v) => v.w * 0.5, y: (v) => v.h * 0.56, align: "center", inFrom: 1.8, hold: 9,
    }));
  });
  cap(288.4, 5, "They come back toward the middle, and they come back hard.");
  cap(294, 9.4, "A person is that box with one change. Some of the pegs are nailed down. Genes, nutrition, the family, the era. Those are set the same way for the child.");
  cap(304, 5.4, "The rest reset. Luck has no memory, so on average it comes back as zero.");
  cap(310, 10.6, "Which is why the effect scales with how extreme the parent was. An average man’s height contains almost no luck to hand back. A one in three thousand man’s height is mostly luck, and nearly all of it goes back in the box.");

  // ══ Chapter 5: Forty families (5:21) ════════════════════════════════════
  chapter(321.5, "Forty families", { root: 82.41, chord: [0, 5, 10, 14], cutoff: 580, level: 1 });

  const ranked = [...D.PAIRS].sort((a, b) => b.pz - a.pz);
  const rows = (opts = {}) => L.slopeRows({
    pairs: ranked, title: `${D.PAIRS.length} families, ranked by how far out the parent stood`, ...opts,
  });

  beat(321.8, (api) => {
    const r = rows({ showChild: false });
    api.form({ select: PERSON, place: r.place, duration: 2.4, stagger: 2.2 });
    api.overlay(r);
    api.dom((ui) => ui.keyTag("Each mark is one person. Open mark the parent, filled mark the child."));
  });
  cap(322.2, 6.4, "So we went looking for families where both generations left a number behind. Sport, politics and money.");
  cap(329.4, 7.4, "A quarterback, a prime minister and a department store fortune do not share a unit. So we gave them one.");
  cap(337.4, 7.6, "Everybody here is placed by how far above their own crowd they sit, against a named reference population. Where that placement is a judgement rather than a measurement, the bar around it says so.");

  beat(345.6, (api) => {
    const r = rows();
    api.form({ select: PERSON, place: r.place, duration: 2.0, stagger: 1.8 });
    api.overlay(r);
    api.overlayFn(L.legend([
      { label: "the child ended lower", color: L.T.fall },
      { label: "the child ended level or higher", color: L.T.neutral },
    ]));
  }, "Every row is one family. Hover any of them to read the pair.");
  cap(346, 6.4, "Forty families. Every row is one family, with the parent who stood furthest out at the top.");
  cap(353.2, 5.6, `<strong>${D.DIRECTION_COUNTS.fall} fell. ${D.DIRECTION_COUNTS.rise} rose. ${D.DIRECTION_COUNTS.level} came out exactly level.</strong>`);

  beat(359.4, (api) => {
    const r = rows();
    api.form({ select: PERSON, place: r.place, duration: 0.6, stagger: 0.2 });
    api.overlay(r);
    api.overlayFn(L.bigNumber({
      value: N.dynastySlope, from: 1, label: "slope through all forty families",
      dur: 2.4, hold: 7, yFrac: 0.02, fmtFn: (v) => v.toFixed(2),
    }));
  });
  cap(359.8, 8.4, `The line fitted through them has a slope of <strong>${N.dynastySlope.toFixed(2)}</strong>. A generation hands back about ${Math.round(N.dynastyHandback * 100)} per cent of whatever the parent was above the mean.`);

  beat(369, (api) => {
    const r = rows({ highlight: ["curry", "james"] });
    api.form({ select: PERSON, place: r.place, duration: 0.6, stagger: 0.2 });
    api.overlay(r);
    // Top left is the one region of this panel that is reliably empty: the
    // rows are sorted by parent sigma, so everything in the top third sits far
    // out on the right. A card anywhere else lands on the data.
    api.overlayFn(L.portraitCard({
      slug: "stephen-curry", name: "Stephen Curry",
      sub: `${pair("curry").child.stat}. His father Dell averaged ${pair("curry").parent.stat} across sixteen seasons.`,
      xFrac: 0.3, yFrac: 0.1, r: 44, inFrom: 0.6, hold: 12,
    }));
  });
  cap(369.4, 9, "Which brings up the family everyone reaches for. Dell Curry played sixteen seasons and was one of the better shooters of his time. His son holds the three point records.");
  cap(379, 5.4, "Stephen Curry did not break the rule. He shows the half of it that people forget.");
  cap(385, 8, "Regression runs toward the mean, not downward. Dell Curry sat close enough to the middle that most of the league’s ceiling was still above him.");
  cap(393.6, 7.6, "LeBron James has nothing above him. That is not a claim about his son. It is a claim about anyone’s son, given that father.");

  // ══ Chapter 6: What can be handed over (6:42) ═══════════════════════════
  chapter(401.6, "What can be handed over", { root: 73.42, chord: [0, 7, 12, 19], cutoff: 640, level: 0.95 });

  const heightTrait = D.TRAITS.find((t) => t.id === "height");
  const surnameTrait = D.TRAITS.find((t) => t.id === "surname");
  const decay = () => L.decayColumns({
    series: [
      { label: "Height", r: heightTrait.r, color: L.T.fall, sub: `halves in ${N.halflifeHeight.toFixed(1)} generations` },
      { label: "Social standing, by surname", r: surnameTrait.r, color: L.T.accent, sub: `halves in ${N.halflifeSurname.toFixed(1)} generations` },
    ],
    gens: 4, unit: 100,
    title: "100 units of advantage, and what is left of it",
  });

  // One instance per beat, not two. A layout stashes its geometry on itself
  // during place(), so handing api.overlay a second, never-placed instance
  // leaves geom null and draw() returns early: the columns render and every
  // label, baseline and count silently disappears.
  beat(401.8, (api) => {
    const dc = decay();
    api.form({ select: CROWD, place: dc.place, duration: 2.4, stagger: 2.0 });
    api.overlay(dc);
    api.dom((ui) => ui.keyTag("Each dot is one unit of the parent’s advantage."));
  });
  cap(402.2, 5.6, "Can the advantage actually be handed over? That turns out to be the whole question.");
  cap(408.6, 9.2, "A jump shot cannot. Neither can a growth spurt that arrived at the right age, or whatever it was that made one book sell. Those get rolled again in the child.");
  cap(418.6, 7.2, "A surname can. So can a donor list, a school place, a trust, and a set of phone numbers that get returned.");
  cap(426.6, 5.4, "Start each family with a hundred units of advantage and watch what is left.");
  cap(432.8, 7, `Height halves in under a generation. By the great grandchildren there is almost nothing left to inherit.`);
  cap(440.6, 9, `Social standing, tracked through rare surnames across three hundred years, takes <strong>${N.halflifeSurname.toFixed(1)} generations</strong> to halve. Same arithmetic, a much slower clock.`);

  beat(450.2, (api) => {
    const dc = decay();
    api.form({ select: CROWD, place: dc.place, duration: 0.6, stagger: 0.2 });
    api.overlay(dc);
    api.overlayFn(L.portraitCard({
      slug: "john-quincy-adams", name: "John Quincy Adams",
      sub: "Sixth President. His father was the second.",
      xFrac: 0.86, yFrac: 0.12, r: 44, inFrom: 0.5, hold: 13,
    }));
  });
  cap(450.6, 9.8, "That is the difference between the Adamses and the Vanderbilts. John Quincy Adams inherited the part that transfers. A name people already trusted, and a father who knew everyone worth knowing.");
  cap(461.2, 8.2, "The Vanderbilt heirs inherited money, which also transfers. But they inherited it in slices, and slices divide again in the generation after that.");
  cap(470.2, 7, "It is also why we can name every sporting dynasty. The thing that made the parent famous was mostly the part that resets.");

  // ══ Chapter 7: The children nobody plots (7:57) ═════════════════════════
  chapter(477.8, "The children nobody plots", { root: 61.74, chord: [0, 3, 7, 10], cutoff: 400, level: 0.8 });

  // Domain from the data, with a margin, rather than by eye. The scatter drops
  // anything outside its frame, and a hand-typed y0 quietly cropped the
  // bottom of the modelled cloud, which is the half of the picture the whole
  // chapter is about.
  const SZ = D.SURVIVORS;
  const zPad = 0.4;
  const sx0 = Math.min(...SZ.map((d) => d.pz)) - zPad, sx1 = Math.max(...SZ.map((d) => d.pz)) + zPad;
  const sy0 = Math.min(...SZ.map((d) => d.cz)) - zPad, sy1 = Math.max(...SZ.map((d) => d.cz)) + zPad;

  const survivorScatter = ({ showHidden, lines }) => L.scatter({
    xOf: (d) => d.pz, yOf: (d) => d.cz,
    x0: sx0, x1: sx1, y0: sy0, y1: sy1,
    xLabel: "How far out the parent stood (σ)",
    yLabel: "How far out the child stood (σ)",
    title: "Famous parents and their children, measured and modelled",
    r: 2.2,
    colorOf: (d) => (d.visible ? L.T.neutral : L.T.dim),
    alphaOf: (d) => (d.visible ? 1 : showHidden ? 0.55 : 0),
    tickFmt: (v) => (v === 0 ? "0" : `${v > 0 ? "+" : "−"}${Math.abs(v)}`),
    lines,
  });

  const VIS_LINE = {
    slope: N.survivorSlopeVisible, intercept: D.SURVIVOR_FIT_VISIBLE.intercept,
    color: L.T.neutral, width: 2.2, delay: 0.6,
    label: `through the children you can see · ${N.survivorSlopeVisible.toFixed(2)}`, labelDy: -12,
  };
  const ALL_LINE = {
    slope: N.survivorSlopeAll, intercept: D.SURVIVOR_FIT_ALL.intercept,
    color: L.T.accent, width: 2.4, delay: 0.6,
    label: `through every child · ${N.survivorSlopeAll.toFixed(2)}`, labelDy: 22,
  };

  beat(478, (api) => {
    const s = survivorScatter({ showHidden: false, lines: [] });
    api.form({ select: UNSEEN, place: s.place, duration: 2.2, stagger: 2.0 });
    api.overlay(s);
    api.dom((ui) => ui.keyTag("Each dot is one parent and child. The faint ones are modelled, not observed."));
  });
  cap(478.4, 4.8, "There is a hole in every chart of famous families, including this one.");
  cap(484, 4.8, "To be on it you have to be measurable, and so does your child.");
  cap(489.4, 9.2, "The son of an NBA player who was very good in high school and then quietly stopped being remarkable is not a low dot on the chart. He is not on the chart.");
  cap(499.2, 6.2, "These are the pairs anyone can plot. Both generations famous enough to leave a number behind.");

  beat(505.8, (api) => {
    const s = survivorScatter({ showHidden: true, lines: [] });
    api.form({ select: UNSEEN, place: s.place, duration: 1.8, stagger: 1.4 });
    api.overlay(s);
  });
  cap(506.2, 7.2, "Now the ones nobody plots. Each faint mark is a child who never became measurable, so the data never saw them.");

  beat(514, (api) => {
    const s = survivorScatter({ showHidden: true, lines: [VIS_LINE, ALL_LINE] });
    api.form({ select: UNSEEN, place: s.place, duration: 0.6, stagger: 0.2 });
    api.overlay(s);
  }, "The gap between these two lines is how much a chart of famous pairs flatters the famous.");
  cap(514.4, 8.2, `<strong>Almost half of them.</strong> The line through everything sits well below the line through the survivors.`);
  cap(523.2, 7.4, "So the visible pairs understate the effect, always, in the same direction. The chart anyone can draw is a survivor’s chart.");

  // ══ Chapter 8: The flight instructors (8:51) ════════════════════════════
  chapter(531, "The flight instructors", { root: 98, chord: [0, 5, 12, 17], cutoff: 700, level: 0.9 });

  beat(531.2, (api) => {
    api.form({ select: () => false, place: heightBell().place, duration: 0.8 });
    api.overlayFn(L.portraitCard({
      slug: "daniel-kahneman", name: "Daniel Kahneman",
      sub: "Taught flight instructors that praise works better than punishment. They had years of evidence against him.",
      yFrac: 0.34, r: 74, inFrom: 0.4, hold: 15,
    }));
    api.dom((ui) => ui.keyTag(false));
  });
  cap(531.6, 3.8, "One more story, and then we are done.");
  cap(535.8, 8.6, "<strong>Daniel Kahneman</strong> once tried to teach a group of flight instructors that praise works better than punishment. They pushed back, and they had evidence.");
  cap(545, 9.2, "Every cadet praised for a beautiful landing flew worse the next time. Every cadet screamed at after a bad one improved. They had watched it happen for years.");
  cap(555, 5.2, "They were describing regression to the mean and calling it a management technique.");

  beat(560.6, (api) => {
    const b = board({ stage: "bins", highlightBins: [D.BOARD_ROWS, D.BOARD_ROWS - 1] });
    api.form({ select: BALLS, place: b.place, duration: 2.2, stagger: 1.8 });
    api.overlay(b);
  });
  cap(561, 9.2, "Nothing the instructor said mattered. An exceptional landing is partly luck, and the next one sits closer to the cadet’s real ability whatever anyone shouted in between.");
  cap(571, 4.2, "The shouting was being rewarded by arithmetic.");
  cap(576, 10.6, "Those instructors were not fools. They were doing the thing everybody does. We are built to find the cause of a change, and a change with no cause in it is close to impossible to hold in your head.");

  beat(587.2, (api) => {
    const b = heightBell();
    api.form({ select: CROWD, place: b.place, duration: 2.4, stagger: 2.2 });
    api.overlay(b);
    api.overlayFn(L.figures({
      people: [
        { slug: "lebron-james", name: "LeBron James", sub: D.fmtFt(D.HEIGHT.lebron), z: N.lebronZ, color: L.T.ink, at: 0.4 },
        { slug: "bronny-james", name: "Bronny James", sub: D.fmtFt(D.HEIGHT.bronny), z: N.bronnyZ, color: L.T.accent, at: 1.6 },
      ],
      z0: -3.4, z1: 4.6, r: 40, y: (a) => a.y + a.h * 0.26,
      rulerY: (v) => { const a = L.stageArea(v); return a.y + a.h * 0.95 + 10; },
    }));
  });
  cap(587.6, 8.6, `So when a famous man’s son measures <strong>${N.gapInches.toFixed(2).replace(/0$/, "")} inches shorter</strong>, the explanation reaches for effort, or nerve, or the weight of the father’s name.`);
  cap(597, 5.2, "The arithmetic has no villain in it. That is the main reason it loses.");
  cap(603, 10, "Regression to the mean never said the child would be unremarkable. It said the child would be less extreme than the parent, on average, by an amount you can work out in advance.");
  cap(613.6, 9, `Bronny James is taller than about <strong>${Math.round(N.bronnyPct * 100)} per cent</strong> of American men, and plays in the best basketball league in the world. Whatever that is, it is not a fall.`);
  cap(623.2, 6.6, "What the arithmetic knew about him, it knew before he was born. It never knew very much.");

  return { beats, captions, chapters, duration: 631 };
}
