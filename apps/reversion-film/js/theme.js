// The film's visual and sonic identity, in one place.
//
// The first cut inherited the Africa film's design wholesale: the same
// midnight-purple stage, the same Fraunces/Inter pairing, the same centred
// lower-third caption, the same radial vignette, the same four-voice pad. It
// read as a reskin of that film. Everything that made it look and sound like
// that film now lives here as tokens, and no other module holds a literal
// colour or font. Two pieces can share an engine without sharing a face.
//
// The direction is "Instrument": a film about measurement, so the stage is the
// inside of a Victorian instrument case. Warm near-black, brass and bone,
// ledger rules ruled across it, and every number set in mono the way a caliper
// or a tally sheet would set it. Chosen from three directions in review; the
// other two (a cold drafting Blueprint and a near-black Nocturne) were cut.
//
// The stage is dark on purpose. Portraits are drawn with a thick bone-white
// ring, which is the thing that reads on a dark surface and disappears on a
// light one.
//
// An identity is not only colour. This object also carries the type system,
// the stage texture, what shape a dot is, how a formation moves, and what the
// score is made of.

export const T = {
  name: "Instrument",

  // ── Surface and ink ────────────────────────────────────────────────────
  stage: "#14120E",       // the case: warm near-black, never neutral grey
  stageDeep: "#0C0B08",   // label backings and the falloff at the frame edge
  raise: "#211D15",       // panels sitting over the stage
  ink: "#F2EDE1",         // bone
  inkSoft: "#BDB49F",
  inkMute: "#7E7663",

  // Colour carries one argument and nothing else. Brass is whatever the
  // narration is pointing at right now; oxblood is a child who ended lower
  // than their parent; everything else is the crowd. The three domains
  // (sport, politics, business) deliberately get no hues of their own.
  accent: "#D9A441",      // brass
  fall: "#B4472F",        // oxblood
  neutral: "#8A8272",     // the crowd
  dim: "#3A352A",         // rules, pins, chart frames

  // ── Type ───────────────────────────────────────────────────────────────
  fontDisplay: '"Instrument Serif", Georgia, serif',
  fontUI: '"IBM Plex Sans", system-ui, sans-serif',
  fontMono: '"IBM Plex Mono", ui-monospace, monospace',
  // Numbers, axis ticks and readouts all take the mono face. This is the
  // single strongest signal that the film is about measurement, and it keeps
  // figures aligned column to column and row to row.
  numbersMono: true,

  // ── Stage treatment ────────────────────────────────────────────────────
  // Ledger rules under everything, faint enough to read as paper rather than
  // as a chart the film did not draw. Light falls from above like a lamp over
  // a workbench, instead of the Africa film's radial vignette.
  texture: { kind: "rules", spacing: 34, alpha: 0.055 },
  vignette: { kind: "top", strength: 0.5 },

  // ── Marks ──────────────────────────────────────────────────────────────
  // The crowd is a tally dash, so a histogram column reads as a ruled tally
  // sheet rather than a bead chain, and is still countable. Anything with a
  // name attached stays a disc.
  mark: { crowd: "tick", subject: "dot", tickRatio: 3.1 },

  // ── Motion ─────────────────────────────────────────────────────────────
  // Straight travel with a mechanical settle, like a needle finding its
  // reading. The Africa film moved every dot along a curved bezier, which
  // reads as organic and suited that subject rather than this one. Anything
  // falling through the Galton board overrides this with gravity.
  motion: { path: "straight", ease: "settle" },

  // ── Sound ──────────────────────────────────────────────────────────────
  // A low drone with a sparse plucked pulse over it: a workshop with a clock
  // in it, rather than a sustained pad.
  score: {
    timbre: "triangle",
    droneLevel: 0.1,
    pulseEvery: 2.4,
    sfx: {
      peg: { f: 2100, decay: 0.05, level: 0.1 },     // a ball striking a pin
      settle: { f: 150, decay: 0.4, level: 0.16 },   // a pile coming to rest
      swell: { f: 320, decay: 2.4, level: 0.07 },    // a chapter turning
    },
  },
};

// Font shorthands, so a caller asks for a role rather than assembling a string.
export const fMono = (size, weight = 500) => `${weight} ${size}px ${T.fontMono}`;
export const fUI = (size, weight = 500) => `${weight} ${size}px ${T.fontUI}`;
export const fDisplay = (size, weight = 400) => `${weight} ${size}px ${T.fontDisplay}`;
export const fNum = (size, weight = 500) => (T.numbersMono ? fMono(size, weight) : fUI(size, weight));
