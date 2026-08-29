// Generate narration/voiceover-script.md from the film's own captions, so the
// script and the on-screen text cannot drift. Re-run after any caption edit.
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const APP = fileURLToPath(new URL("..", import.meta.url)).replace(/[\\/]$/, "");
const { buildScript } = await import(new URL("../js/scenes.js", import.meta.url).href);

const { captions, chapters, duration } = buildScript();
const caps = [...captions].sort((a, b) => a.t - b.t);

// Spoken form: strip the caption markup, and turn the typographic marks that
// look right on screen into something a reader will not stumble over.
const spoken = (html) => html
  .replace(/<[^>]+>/g, "")
  .replace(/&middot;/g, "·")
  .replace(/\u2019/g, "'")
  .replace(/\u201c|\u201d/g, '"')
  .replace(/\u2032/g, " foot ")
  .replace(/\u2033/g, "")
  .replace(/σ/g, " sigma")
  .replace(/\s+/g, " ")
  .trim();

const chapterAt = (t) => {
  let c = chapters[0];
  for (const ch of chapters) if (ch.t <= t + 1e-6) c = ch;
  return c;
};

const words = caps.reduce((s, c) => s + spoken(c.text).split(/\s+/).length, 0);
const mins = Math.floor(duration / 60), secs = Math.round(duration % 60);

let out = `# Voiceover recording script: Reversion to the Mean

One numbered line per audio clip. Save each take as \`line-NN.wav\`
(e.g. \`line-01.wav\`) into \`apps/reversion-film/audio/\`.

**Generated from the film's own captions.** Do not hand-edit this file: change
the caption in \`js/scenes.js\` and regenerate, or the voice will say something
the screen does not. Every figure in the text below is computed from the data,
so if a number here looks wrong the fix is in \`js/data.js\`.

- ${caps.length} lines, about ${words} words.
- Authored film length ${mins}:${String(secs).padStart(2, "0")}. The film stretches its own
  timeline to fit your read, so the durations below are pace references only,
  not targets.
- All ${caps.length} clips must be present or the film falls back to captions only and
  runs silent. It is all or nothing.

Recording notes:
- Quiet room, soft furnishings, phone on silent, fridge and AC off if audible.
- Mouth 6 to 8 inches from the mic, speaking slightly past it, not into it.
- Record 2 seconds of room silence at the start of the session, for noise
  reduction, and re-record any line you fluff as a fresh take of just that line.
- Read at a calm, even documentary pace. This is a quiet piece: the register is
  plain and unhurried, closer to reading a good essay aloud than to a trailer.
- Where a line ends a section, let it land flat rather than lifting.
`;

let lastChapter = null;
caps.forEach((c, i) => {
  const ch = chapterAt(c.t);
  if (ch !== lastChapter) {
    const n = chapters.indexOf(ch) + 1;
    out += `\n\n## Chapter ${n}: ${ch.title.replace(/\u2019/g, "'")}\n`;
    lastChapter = ch;
  }
  const nn = String(i + 1).padStart(2, "0");
  out += `\n**${nn}** (\`line-${nn}.wav\`, ~${Math.round(c.dur)}s)\n> ${spoken(c.text)}\n`;
});

fs.writeFileSync(`${APP}/narration/voiceover-script.md`, out.trimEnd() + "\n", "utf8");
console.log(`wrote voiceover-script.md: ${caps.length} lines, ${words} words, ${mins}:${String(secs).padStart(2, "0")}`);

// Flag anything the house rules ban, so a bad line never reaches a recording.
const BANNED = [/—/, /\bdelve\b/i, /\btapestry\b/i, /\bunlock\b/i, /\btestament to\b/i,
  /\bin a world where\b/i, /\bmoreover\b/i, /\bfurthermore\b/i, /\bprofound\b/i,
  /\bseamless\b/i, /\bleverage\b/i, /\bat its core\b/i, /\bthe reality is\b/i,
  /\bstark reminder\b/i, /\bunderscores\b/i, /it's not just .*,? it's /i];
let flags = 0;
caps.forEach((c, i) => {
  const s = spoken(c.text);
  for (const re of BANNED) {
    if (re.test(s)) { console.log(`  !! line ${i + 1} matches ${re}: ${s.slice(0, 80)}`); flags++; }
  }
});
console.log(flags ? `${flags} house-rule flags` : "no house-rule violations");
