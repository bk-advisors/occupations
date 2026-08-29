// Minimal static server for screenshotting the film. No caching headers, so
// Chrome cannot serve a stale ES module between runs.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";

// path.resolve so the traversal guard compares like with like: on Windows a
// forward-slash ROOT never prefixes a path.join result, and every request 403s.
const ROOT = path.resolve(process.argv[2]);
const PORT = +(process.argv[3] || 8011);
const TYPES = {
  ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript",
  ".css": "text/css", ".json": "application/json", ".jpg": "image/jpeg",
  ".png": "image/png", ".mp3": "audio/mpeg", ".svg": "image/svg+xml",
};

http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split("?")[0]);
  if (p === "/") p = "/index.html";
  const file = path.join(ROOT, p);
  if (!file.startsWith(ROOT)) { res.writeHead(403).end(); return; }
  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404).end("not found"); return; }
    res.writeHead(200, {
      "Content-Type": TYPES[path.extname(file).toLowerCase()] || "application/octet-stream",
      "Cache-Control": "no-store, no-cache, must-revalidate",
    });
    res.end(buf);
  });
}).listen(PORT, () => console.log(`serving ${ROOT} on http://localhost:${PORT}`));
