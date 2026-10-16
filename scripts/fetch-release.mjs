#!/usr/bin/env node
// Deploy-time step: resolve the newest published release of the Aerini app and bake direct installer links
// into the built site, so a download starts immediately and never depends on a visitor's browser calling GitHub.
//
//   node scripts/fetch-release.mjs <built-site-dir>
//
// Writes <dir>/release.json (read by script.js) and points the three platform cards in <dir>/index.html at the
// installers. Pre-releases are included; drafts are not. Any failure only logs a warning and exits 0: the site
// still works, because script.js falls back to asking the GitHub API and the cards fall back to the releases page.

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const REPO = "Panchak2d/Aerini";
const API = process.env.RELEASES_API_URL || `https://api.github.com/repos/${REPO}/releases?per_page=10`;
const PREFIX = `https://github.com/${REPO}/releases/download/`;
const TAG_RE = /^v?\d+\.\d+\.\d+(?:[-.][0-9A-Za-z.]+)?$/;
const PATTERN = { windows: /-setup\.exe$/i, macos: /\.dmg$/i, linux: /\.AppImage$/i };
const dir = process.argv[2] || "_site";
const warn = (m) => console.log(`::warning::fetch-release: ${m}`);

function pick(assets, os) {
  const matches = assets.filter((a) => PATTERN[os].test(a.name));
  const wantArm = os === "macos";
  return matches.find((a) => /arm64|aarch64/i.test(a.name) === wantArm) || matches[0] || null;
}

async function main() {
  const headers = { Accept: "application/vnd.github+json", "User-Agent": "aerini-website-deploy" };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  const res = await fetch(API, { headers });
  if (!res.ok) return warn(`release lookup returned HTTP ${res.status}; keeping the releases-page fallback`);

  let release = null;
  for (const r of await res.json()) {
    if (r.draft || typeof r.tag_name !== "string" || !TAG_RE.test(r.tag_name)) continue;
    const assets = (r.assets || [])
      .map((a) => ({ name: a.name, url: a.browser_download_url }))
      .filter((a) => typeof a.name === "string" && /^[\w.+\-]+$/.test(a.name) && typeof a.url === "string" && a.url.startsWith(PREFIX));
    if (Object.keys(PATTERN).some((os) => pick(assets, os))) { release = { tag: r.tag_name, assets }; break; }
  }
  if (!release) return warn("no published release with installer assets found; keeping the releases-page fallback");

  writeFileSync(join(dir, "release.json"), JSON.stringify(release));

  const file = join(dir, "index.html");
  let html = readFileSync(file, "utf8");
  for (const os of Object.keys(PATTERN)) {
    const asset = pick(release.assets, os);
    if (!asset) { warn(`${release.tag} has no ${os} installer`); continue; }
    const card = new RegExp(`(data-platform="${os}"[\\s\\S]*?)<a href="[^"]*"[^>]*>Download \u2192</a>`);
    if (!card.test(html)) { warn(`${os} card markup not found in index.html; link not rewritten`); continue; }
    html = html.replace(card, `$1<a href="${asset.url}">Download ${release.tag} \u2192</a>`);
  }
  writeFileSync(file, html);
  console.log(`fetch-release: ${release.tag}, ${release.assets.length} assets`);
}

main().catch((e) => warn(String(e && e.message || e)));
