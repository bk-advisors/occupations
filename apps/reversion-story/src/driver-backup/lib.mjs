/* Shared rig: wraps the fragment the way the Artifact publisher does, launches
   the installed Chrome, and exposes helpers the three checkers share. */
import puppeteer from "puppeteer-core";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";

export const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
export const SRC = "c:/Users/Personal/OneDrive - Beginnings Fund/Desktop/Matts Lab/5 Coding/Dataviz/D3.js in action 3rd Edition/data-story/reversion-to-the-mean.html";
export const OUT = "C:/Users/Personal/AppData/Local/Temp/claude/c--Users-Personal-OneDrive---Beginnings-Fund-Desktop-Matts-Lab-5-Coding-Dataviz-D3-js-in-action-3rd-Edition/6c2c3e59-1044-4a8a-99b5-acb33fcf36c6/scratchpad/shots";

/* The publisher wraps the fragment in a doctype + minimal reset. Reproduce that
   faithfully, or we test a page nobody will ever see. */
export function wrap(themeAttr) {
  const frag = readFileSync(SRC, "utf8");
  const html = `<!doctype html>
<html lang="en"${themeAttr ? ` data-theme="${themeAttr}"` : ""}>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>*,*::before,*::after{box-sizing:border-box}body{margin:0}img,svg,video,canvas{display:block;max-width:100%}</style>
</head>
<body>
${frag}
</body>
</html>`;
  mkdirSync(OUT, { recursive: true });
  const p = join(OUT, `page${themeAttr ? "-" + themeAttr : ""}.html`);
  writeFileSync(p, html, "utf8");
  return "file:///" + p.replace(/\\/g, "/");
}

export async function launch() {
  if (!existsSync(SRC)) {
    console.error("MISSING BUILD: " + SRC);
    process.exit(2);
  }
  return puppeteer.launch({
    executablePath: CHROME,
    headless: "new",
    args: ["--allow-file-access-from-files", "--font-render-hinting=none", "--force-color-profile=srgb"]
  });
}

/* Collect everything the page complains about. A silent console is part of the
   deliverable; a warning nobody reads becomes a bug nobody finds. */
export function watch(page, bag) {
  page.on("pageerror", (e) => bag.errors.push(String(e.message || e).slice(0, 400)));
  page.on("console", (m) => {
    const t = m.type();
    if (t === "error") bag.errors.push("console: " + m.text().slice(0, 400));
    else if (t === "warning") bag.warnings.push(m.text().slice(0, 300));
  });
  page.on("requestfailed", (r) => bag.errors.push("request failed: " + r.url().slice(0, 200)));
  /* The CSP forbids every external request. Catch any that even get attempted. */
  page.on("request", (r) => {
    const u = r.url();
    if (!/^(file:|data:|blob:|about:)/.test(u)) bag.errors.push("EXTERNAL REQUEST: " + u.slice(0, 200));
  });
}

export async function settle(page, ms = 900) {
  await page.evaluate(() => {
    /* A full-page screenshot never scrolls, so IntersectionObserver reveals
       never fire and every figure photographs blank. Force them all on. */
    if (typeof window.RTM_REVEAL_ALL === "function") window.RTM_REVEAL_ALL();
    else document.querySelectorAll(".reveal").forEach((n) => n.classList.add("in"));
  });
  await new Promise((r) => setTimeout(r, ms));
}

export async function ready(page, ms = 6000) {
  try {
    await page.waitForFunction("window.RTM_READY === true", { timeout: ms });
    return true;
  } catch { return false; }
}

export const WIDTHS = [
  { name: "phone", w: 390, h: 844 },
  { name: "tablet", w: 820, h: 1180 },
  { name: "desktop", w: 1440, h: 900 }
];

export function report(title, bag) {
  const line = (s) => console.log(s);
  line("\n" + "=".repeat(64));
  line(title);
  line("=".repeat(64));
  if (bag.errors.length) {
    line(`\nERRORS (${bag.errors.length})`);
    [...new Set(bag.errors)].slice(0, 40).forEach((e) => line("  ! " + e));
  } else line("\nERRORS: none");
  if (bag.warnings.length) {
    line(`\nWARNINGS (${bag.warnings.length})`);
    [...new Set(bag.warnings)].slice(0, 20).forEach((e) => line("  ~ " + e));
  }
  if (bag.notes?.length) {
    line(`\nNOTES`);
    bag.notes.forEach((e) => line("  . " + e));
  }
  if (bag.fails?.length) {
    line(`\nFAILURES (${bag.fails.length})`);
    bag.fails.forEach((e) => line("  X " + e));
  }
  line("");
  return bag.errors.length + (bag.fails?.length || 0);
}
