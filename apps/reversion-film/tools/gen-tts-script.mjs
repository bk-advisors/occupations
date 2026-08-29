// Generate the speakable version of the narration for a text-to-speech voice.
//
// Every TTS frontend mangles figures in its own way, and this script is unusually
// dense with them: correlations (0.65), years (1886), heights (6 foot 1.9),
// rarities (1 in 2,800) and sigma readings. So numerals are written out as
// words here rather than trusted to the model's own normaliser, which is the
// rule agreed after the Africa film's narration ("8.3 million", "$50",
// "HIV/AIDS" all had to be spelled out).
//
//   node tools/gen-tts-script.mjs
//     -> narration/tts-lines.json   the input the synthesiser reads
//     -> narration/tts-script.md    the same thing for a human to check
//
// Regenerate after any caption edit, alongside gen-voiceover.mjs.

import fs from "node:fs";
import { fileURLToPath } from "node:url";

const APP = fileURLToPath(new URL("..", import.meta.url)).replace(/[\\/]$/, "");
const { buildScript } = await import(new URL("../js/scenes.js", import.meta.url).href);

const ONES = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine",
  "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen",
  "eighteen", "nineteen"];
const TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];

function under100(n) {
  if (n < 20) return ONES[n];
  const t = Math.floor(n / 10), r = n % 10;
  return r ? `${TENS[t]} ${ONES[r]}` : TENS[t];
}

function under1000(n) {
  if (n < 100) return under100(n);
  const h = Math.floor(n / 100), r = n % 100;
  return r ? `${ONES[h]} hundred and ${under100(r)}` : `${ONES[h]} hundred`;
}

// British reading, which is how the rest of the script is written.
function numToWords(n) {
  if (n === 0) return "zero";
  const parts = [];
  const scales = [[1e9, "billion"], [1e6, "million"], [1e3, "thousand"]];
  let rest = n;
  for (const [size, name] of scales) {
    if (rest >= size) {
      parts.push(`${under1000(Math.floor(rest / size))} ${name}`);
      rest %= size;
    }
  }
  if (rest) parts.push(parts.length && rest < 100 ? `and ${under100(rest)}` : under1000(rest));
  return parts.join(" ");
}

// 1886 -> "eighteen eighty six", 2019 -> "twenty nineteen"
function yearToWords(y) {
  const hi = Math.floor(y / 100), lo = y % 100;
  if (lo === 0) return `${under100(hi)} hundred`;
  if (lo < 10) return `${under100(hi)} oh ${ONES[lo]}`;
  return `${under100(hi)} ${under100(lo)}`;
}

// 1880s -> "eighteen eighties"
function decadeToWords(y) {
  const hi = Math.floor(y / 100), lo = y % 100;
  const plural = { 20: "twenties", 30: "thirties", 40: "forties", 50: "fifties",
    60: "sixties", 70: "seventies", 80: "eighties", 90: "nineties" }[lo];
  return plural ? `${under100(hi)} ${plural}` : `${yearToWords(y)}s`;
}

// 0.65 -> "zero point six five". Digits after the point are read one at a
// time, which is how a person reads a correlation aloud.
function decimalToWords(whole, frac) {
  const digits = frac.split("").map((d) => ONES[+d]).join(" ");
  return `${numToWords(+whole)} point ${digits}`;
}

// Initialisms get spelled phonetically. A synthesiser reading "NBA" as a word
// rather than three letters is the same class of error as reading "0.65" as
// "point sixty five", and this is the only one left in the script.
const ACRONYMS = { NBA: "en bee ay" };

// Order matters: decades and years before decimals, decimals before plain
// integers, or "6 foot 1.9" becomes "six foot one point nine" only by luck.
export function speakable(text) {
  return Object.entries(ACRONYMS)
    .reduce((s, [k, v]) => s.replace(new RegExp(`\\b${k}\\b`, "g"), v), text)
    .replace(/\b(1[89]\d0|20[0-9]0)s\b/g, (_, y) => decadeToWords(+y))
    .replace(/\b(1[6-9]\d{2}|20[0-2]\d)\b/g, (_, y) => yearToWords(+y))
    .replace(/\b(\d+)\.(\d+)\b/g, (_, w, f) => decimalToWords(w, f))
    .replace(/\b(\d{1,3}(?:,\d{3})+)\b/g, (_, n) => numToWords(+n.replace(/,/g, "")))
    .replace(/\b(\d+)\b/g, (_, n) => numToWords(+n))
    .replace(/\bper cent\b/g, "percent")
    .replace(/\s+/g, " ")
    .trim();
}

// Same stripping as gen-voiceover.mjs, then the number expansion.
const spoken = (html) => html
  .replace(/<[^>]+>/g, "")
  .replace(/&middot;/g, "·")
  .replace(/’/g, "'")
  .replace(/“|”/g, '"')
  .replace(/′/g, " foot ")
  .replace(/″/g, "")
  .replace(/σ/g, " sigma")
  .replace(/\s+/g, " ")
  .trim();

const { captions, chapters } = buildScript();
const caps = [...captions].sort((a, b) => a.t - b.t);
const chapterAt = (t) => {
  let c = chapters[0];
  for (const ch of chapters) if (ch.t <= t + 1e-6) c = ch;
  return c;
};

const lines = caps.map((c, i) => {
  const raw = spoken(c.text);
  return {
    n: i + 1,
    file: `line-${String(i + 1).padStart(2, "0")}`,
    chapter: chapters.indexOf(chapterAt(c.t)) + 1,
    seconds: Math.round(c.dur * 10) / 10,
    text: speakable(raw),
    original: raw,
  };
});

fs.writeFileSync(`${APP}/narration/tts-lines.json`, JSON.stringify(lines, null, 2) + "\n", "utf8");

let md = `# TTS input script: Reversion to the Mean

Generated by \`node tools/gen-tts-script.mjs\`. Do not hand-edit.

Every numeral is written out as words, because a synthesiser's own number
handling is the single biggest source of wrong readings and this script is full
of correlations, years, heights and rarities. Lines where the expansion changed
the text are marked; read those first when checking output.

${lines.length} lines.
`;
let changed = 0;
let lastCh = null;
for (const l of lines) {
  if (l.chapter !== lastCh) {
    md += `\n\n## Chapter ${l.chapter}: ${chapters[l.chapter - 1].title.replace(/’/g, "'")}\n`;
    lastCh = l.chapter;
  }
  const diff = l.text !== l.original;
  if (diff) changed++;
  md += `\n**${String(l.n).padStart(2, "0")}**${diff ? " *(numbers expanded)*" : ""}\n> ${l.text}\n`;
  if (diff) md += `\n<sub>caption reads: ${l.original}</sub>\n`;
}
fs.writeFileSync(`${APP}/narration/tts-script.md`, md, "utf8");

console.log(`wrote tts-lines.json and tts-script.md: ${lines.length} lines, ${changed} with numbers expanded`);
for (const l of lines.filter((x) => x.text !== x.original).slice(0, 8)) {
  console.log(`  ${l.file}: ${l.original.slice(0, 62)}`);
  console.log(`        -> ${l.text.slice(0, 62)}`);
}
