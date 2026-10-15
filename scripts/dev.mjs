#!/usr/bin/env node
// Local dev server with live reload. No dependencies.
// Serves this folder at http://127.0.0.1:PORT, maps /pricing -> pricing.html like production,
// and reloads open tabs when any file in the site folder changes.
// Usage: node scripts/dev.mjs [port]

import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { watch } from "node:fs";
import { join, dirname, extname, normalize, sep } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PORT = Number(process.argv[2]) || 8000;
const TYPES = {
  ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8", ".png": "image/png", ".xml": "application/xml",
  ".txt": "text/plain; charset=utf-8", ".svg": "image/svg+xml", ".ico": "image/x-icon",
  ".woff2": "font/woff2", ".webmanifest": "application/manifest+json",
};
// External file, not an inline script: the pages' Content-Security-Policy forbids inline scripts.
const RELOAD = `<script src="/__reload.js"></script>`;
const clients = new Set();

let timer;
watch(ROOT, (_event, name) => {
  if (!name || name.startsWith(".") || name.endsWith("~")) return;
  clearTimeout(timer);
  timer = setTimeout(() => clients.forEach((res) => res.write("data: reload\n\n")), 80);
});

async function resolveFile(urlPath) {
  const clean = normalize(decodeURIComponent(urlPath)).replace(/^([/\\])+/, "");
  const full = join(ROOT, clean);
  if (full !== ROOT && !full.startsWith(ROOT + sep)) return null;
  for (const p of [full, full + ".html", join(full, "index.html")]) {
    try { if ((await stat(p)).isFile()) return p; } catch {}
  }
  return null;
}

createServer(async (req, res) => {
  const { pathname } = new URL(req.url, "http://localhost");
  if (pathname === "/__reload") {
    res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" });
    res.write("\n");
    clients.add(res);
    req.on("close", () => clients.delete(res));
    return;
  }
  if (pathname === "/__reload.js") {
    res.writeHead(200, { "Content-Type": TYPES[".js"], "Cache-Control": "no-store" });
    res.end('new EventSource("/__reload").onmessage = () => location.reload();');
    return;
  }
  let file;
  try { file = await resolveFile(pathname); } catch { file = null; }
  const status = file ? 200 : 404;
  file ??= join(ROOT, "404.html");
  try {
    let body = await readFile(file);
    const type = TYPES[extname(file)] || "application/octet-stream";
    if (type.startsWith("text/html")) {
      // Dev only: let the page open the live-reload event stream on its own origin.
      body = Buffer.from(body.toString().replace("connect-src https://api.github.com", "connect-src 'self' https://api.github.com").replace("</body>", RELOAD + "</body>"));
    }
    res.writeHead(status, { "Content-Type": type, "Cache-Control": "no-store" });
    res.end(body);
  } catch {
    res.writeHead(500); res.end("server error");
  }
}).listen(PORT, "127.0.0.1", () => console.log(`Live at http://127.0.0.1:${PORT}  (Ctrl+C to stop)`));
