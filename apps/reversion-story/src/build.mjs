/* Concatenates css/ + shell.html + js/ into one self-contained page.
   The Artifact CSP blocks every external request, so nothing may be linked:
   no CDN, no font file, no remote image. Everything ships inline. */
import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
// Output is the app folder's index.html: this folder is flattened to the root
// of its public repo on deploy, and GitHub Pages serves index.html.
const out = join(here, "..", "index.html");

const sorted = (dir, ext) =>
  existsSync(join(here, dir))
    ? readdirSync(join(here, dir)).filter((f) => f.endsWith(ext)).sort()
    : [];

const read = (p) => readFileSync(join(here, p), "utf8");

const cssFiles = sorted("css", ".css");
const jsFiles = sorted("js", ".js");

if (!existsSync(join(here, "shell.html"))) {
  console.error("build: shell.html is missing");
  process.exit(1);
}

const css = cssFiles.map((f) => `/* ===== ${f} ===== */\n${read(join("css", f))}`).join("\n\n");
const js = jsFiles.map((f) => `/* ===== ${f} ===== */\n${read(join("js", f))}`).join("\n\n");
const shell = read("shell.html");

/* This page was originally built to be published as a Claude Artifact, where
   the publisher supplies <!doctype>, <html> and <head>. It now ships as a
   standalone GitHub Pages site, so the wrapper has to be written here.
   Without it the page renders in quirks mode with no charset (every ’ “ ” and
   σ in the prose garbles) and no viewport (it does not scale on a phone).
   shell.html still contains no document tags, and the guard below still
   checks that. */
const titleMatch = shell.match(/<title>([\s\S]*?)<\/title>/i);
const title = titleMatch ? titleMatch[1].trim() : "Reversion to the mean";
const body = shell.replace(/<title>[\s\S]*?<\/title>\s*/i, "").trimEnd();

const page = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<meta name="description" content="An extreme number is part durable and part luck. The durable part passes down, the luck starts over, and that is why the children of extraordinary people land closer to average. Galton's 1886 tally, forty famous families, and what each kind of advantage is worth a generation later.">
<meta name="color-scheme" content="light dark">
<style>
${css}
</style>
</head>
<body>
${body}

<script>
${js}
</script>
</body>
</html>
`;

writeFileSync(out, page, "utf8");

/* Guardrails that have actually caught bugs in this project. */
const problems = [];
if (/<script[^>]+src=/i.test(page)) problems.push("external <script src> present (CSP will block it)");
if (/<link[^>]+href=["']https?:/i.test(page)) problems.push("external stylesheet link present");
if (/@import\s+url\(/i.test(css)) problems.push("@import url() in CSS (blocked by CSP)");
if (/<!doctype|<html|<head>|<body>/i.test(shell)) problems.push("shell.html contains document tags (the publisher adds them)");

/* House style: no em-dashes and no double hyphens in prose. Checked against
   the shell only, since CSS custom properties legitimately use --. */
const emDash = shell.match(/—/g);
if (emDash) problems.push(`${emDash.length} em-dash(es) in shell.html`);

const size = Buffer.byteLength(page, "utf8");
console.log(`build: ${cssFiles.length} css + ${jsFiles.length} js -> ${(size / 1024).toFixed(0)} kB`);
console.log(`       ${out}`);
if (problems.length) {
  console.error("build: PROBLEMS\n  - " + problems.join("\n  - "));
  process.exit(1);
}
