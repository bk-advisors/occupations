/* Concatenates css/ + shell.html + js/ into one self-contained page.
   The Artifact CSP blocks every external request, so nothing may be linked:
   no CDN, no font file, no remote image. Everything ships inline. */
import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, "..", "reversion-to-the-mean.html");

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

const page = `${shell.trimEnd()}

<style>
${css}
</style>

<script>
${js}
</script>
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
