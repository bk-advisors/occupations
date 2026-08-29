// Fetch a portrait for each named character from Wikipedia, plus the licence
// and author for every one, and write img/portraits.json as the credits
// manifest the end card reads. Re-runnable; skips files already on disk.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const OUT_DIR = fileURLToPath(new URL("../img/", import.meta.url));
const UA = "ReversionFilm/1.0 (https://github.com/bk-advisors; kuch.matthew@gmail.com)";

// slug -> Wikipedia article title. The slug is what scenes.js asks for.
const CAST = {
  "cornelius-vanderbilt": "Cornelius Vanderbilt",
  "william-henry-vanderbilt": "William Henry Vanderbilt",
  "cornelius-vanderbilt-ii": "Cornelius Vanderbilt II",
  "reginald-vanderbilt": "Reginald Claypoole Vanderbilt",
  "gloria-vanderbilt": "Gloria Vanderbilt",
  "francis-galton": "Francis Galton",
  "lebron-james": "LeBron James",
  "bronny-james": "Bronny James",
  "dell-curry": "Dell Curry",
  "stephen-curry": "Stephen Curry",
  "rick-barry": "Rick Barry",
  "brent-barry": "Brent Barry",
  "jack-nicklaus": "Jack Nicklaus",
  "gary-nicklaus": "Gary Nicklaus",
  "winston-churchill": "Winston Churchill",
  "randolph-churchill": "Randolph Churchill",
  "margaret-thatcher": "Margaret Thatcher",
  "mark-thatcher": "Mark Thatcher",
  "andrew-carnegie": "Andrew Carnegie",
  "bill-gates": "Bill Gates",
  "warren-buffett": "Warren Buffett",
  "john-adams": "John Adams",
  "john-quincy-adams": "John Quincy Adams",
  "daniel-kahneman": "Daniel Kahneman",
  "bobby-bonds": "Bobby Bonds",
  "barry-bonds": "Barry Bonds",
};

const get = async (url, asBuffer = false) => {
  const res = await fetch(url, { headers: { "User-Agent": UA, "Api-User-Agent": UA } });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return asBuffer ? Buffer.from(await res.arrayBuffer()) : res.json();
};

const strip = (html) => String(html || "")
  .replace(/<[^>]*>/g, " ")
  .replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&nbsp;/g, " ")
  .replace(/\s+/g, " ")
  .trim();

// Resolve each article's lead image in batches of 20.
async function leadImages(titles) {
  const out = {};
  for (let i = 0; i < titles.length; i += 20) {
    const batch = titles.slice(i, i + 20);
    const url = "https://en.wikipedia.org/w/api.php?action=query&format=json&redirects=1"
      + "&prop=pageimages&piprop=original|name"
      + "&titles=" + batch.map(encodeURIComponent).join("%7C");
    const j = await get(url);
    const norm = {};
    for (const r of [...(j.query?.normalized || []), ...(j.query?.redirects || [])]) norm[r.to] = r.from;
    for (const p of Object.values(j.query?.pages || {})) {
      const asked = norm[p.title] || p.title;
      out[asked] = p.original ? { file: p.pageimage, src: p.original.source } : null;
      if (norm[p.title]) out[p.title] = out[asked];
    }
  }
  return out;
}

// Licence + author for each File:, so the credits list is real.
// Commons echoes titles with spaces where pageimages gives underscores, so
// both sides are normalised or every lookup silently misses.
const fkey = (f) => String(f || "").replace(/_/g, " ");

async function fileMeta(files) {
  const out = {};
  for (let i = 0; i < files.length; i += 20) {
    const batch = files.slice(i, i + 20);
    const url = "https://commons.wikimedia.org/w/api.php?action=query&format=json"
      + "&prop=imageinfo&iiprop=extmetadata|url"
      + "&titles=" + batch.map((f) => encodeURIComponent("File:" + f)).join("%7C");
    const j = await get(url);
    for (const p of Object.values(j.query?.pages || {})) {
      const ii = p.imageinfo?.[0];
      if (!ii) continue;
      const m = ii.extmetadata || {};
      out[fkey(p.title.replace(/^File:/, ""))] = {
        licence: strip(m.LicenseShortName?.value) || "unknown",
        licenceUrl: m.LicenseUrl?.value || "",
        author: strip(m.Artist?.value) || strip(m.Credit?.value) || "unknown",
        page: ii.descriptionurl || "",
      };
    }
  }
  return out;
}

const slugs = Object.keys(CAST);
const titles = slugs.map((s) => CAST[s]);

console.log(`resolving ${titles.length} lead images...`);
const leads = await leadImages(titles);

const found = slugs.filter((s) => leads[CAST[s]]);
const missing = slugs.filter((s) => !leads[CAST[s]]);
console.log(`  found ${found.length}, missing ${missing.length}${missing.length ? ": " + missing.join(", ") : ""}`);

console.log("fetching licence metadata...");
const metas = await fileMeta(found.map((s) => leads[CAST[s]].file).filter(Boolean));

fs.mkdirSync(OUT_DIR, { recursive: true });
const manifest = [];

for (const slug of found) {
  const lead = leads[CAST[slug]];
  const dest = path.join(OUT_DIR, `${slug}.jpg`);
  if (!fs.existsSync(dest)) {
    const url = `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(lead.file)}?width=420`;
    try {
      const buf = await get(url, true);
      fs.writeFileSync(dest, buf);
      console.log(`  ${slug}.jpg  ${Math.round(buf.length / 1024)} KB`);
    } catch (e) {
      console.log(`  FAILED ${slug}: ${e.message}`);
      continue;
    }
  }
  const m = metas[fkey(lead.file)] || {};
  manifest.push({
    slug, name: CAST[slug], file: `img/${slug}.jpg`,
    source: lead.file, licence: m.licence || "unknown", licenceUrl: m.licenceUrl || "",
    author: m.author || "unknown", page: m.page || "",
  });
}

fs.writeFileSync(path.join(OUT_DIR, "portraits.json"), JSON.stringify(manifest, null, 2) + "\n", "utf8");
console.log(`\nwrote portraits.json with ${manifest.length} entries`);
console.log("\nLICENCES:");
const byLic = {};
for (const e of manifest) (byLic[e.licence] ||= []).push(e.slug);
for (const [lic, list] of Object.entries(byLic)) console.log(`  ${lic}: ${list.length}  (${list.join(", ")})`);
