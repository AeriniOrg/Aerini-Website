#!/usr/bin/env node
// Deploy-time step: resolve the newest published release of the Aerini app and bake direct installer links
// into the built site, so a download starts immediately and never depends on a visitor's browser calling GitHub.
//
//   node scripts/fetch-release.mjs <built-site-dir>
//
// Writes <dir>/release.json (read by script.js) and points the three platform cards in <dir>/index.html at the
// installers and stamps the version into the hero tag, the JSON-LD softwareVersion and llms.txt. The highest version wins (not the newest-created release). Drafts and pre-releases are skipped. Any failure only logs a warning and exits 0: the site
// still works, because script.js falls back to asking the GitHub API and the cards fall back to the releases page.

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const REPO = "Panchak2d/Aerini";
const API = process.env.RELEASES_API_URL || `https://api.github.com/repos/${REPO}/releases?per_page=10`;
const PREFIX = `https://github.com/${REPO}/releases/download/`;
const TAG_RE = /^v?\d+\.\d+\.\d+(?:[-.][0-9A-Za-z.]+)?$/;
const PATTERN = { windows: /-setup\.exe$/i, macos: /\.dmg$/i, linux: /\.AppImage$/i };
const dir = process.argv[2] || "_site";
const warn = (m) => console.log(`::warning::fetch-release: ${m}`);

function parseTag(tag) {
  const m = /^v?(\d+)\.(\d+)\.(\d+)(?:[-.]([0-9A-Za-z.]+))?$/.exec(tag);
  return m ? { n: [+m[1], +m[2], +m[3]], pre: m[4] ? m[4].split(".") : null } : null;
}

// Semver order: 0.4.4 beats 0.4.4-rc.1. The API lists by creation date, which is not version order.
function compareTags(a, b) {
  const x = parseTag(a), y = parseTag(b);
  if (!x || !y) return 0;
  for (let i = 0; i < 3; i++) if (x.n[i] !== y.n[i]) return x.n[i] < y.n[i] ? -1 : 1;
  if (!x.pre || !y.pre) return x.pre === y.pre ? 0 : x.pre ? -1 : 1;
  for (let i = 0; i < Math.max(x.pre.length, y.pre.length); i++) {
    const p = x.pre[i], q = y.pre[i];
    if (p === undefined) return -1;
    if (q === undefined) return 1;
    const pn = /^\d+$/.test(p), qn = /^\d+$/.test(q);
    if (pn && qn) { if (+p !== +q) return +p < +q ? -1 : 1; }
    else if (pn !== qn) return pn ? -1 : 1;
    else if (p !== q) return p < q ? -1 : 1;
  }
  return 0;
}

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
    if (r.draft || r.prerelease || typeof r.tag_name !== "string" || !TAG_RE.test(r.tag_name) || parseTag(r.tag_name).pre) continue;
    const assets = (r.assets || [])
      .map((a) => ({ name: a.name, url: a.browser_download_url }))
      .filter((a) => typeof a.name === "string" && /^[\w.+\-]+$/.test(a.name) && typeof a.url === "string" && a.url.startsWith(PREFIX));
    if (Object.keys(PATTERN).some((os) => pick(assets, os)) && (!release || compareTags(r.tag_name, release.tag) > 0)) release = { tag: r.tag_name, assets };
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
  const version = release.tag.replace(/^v/, "");
  const stamp = (text, re, label) => {
    if (!re.test(text)) { warn(`${label} not found; left as written in the source`); return text; }
    return text.replace(re, `$1${version}$2`);
  };
  html = stamp(html, /(<span class="hero-new-tag">New in )[^<]*(<\/span>)/, "hero tag");
  html = stamp(html, /("softwareVersion":\s*")[^"]*(")/, "JSON-LD softwareVersion");
  writeFileSync(file, html);

  const llms = join(dir, "llms.txt");
  if (existsSync(llms)) writeFileSync(llms, stamp(readFileSync(llms, "utf8"), /(Current release: )\d+\.\d+\.\d+()/, "llms.txt release"));
  console.log(`fetch-release: ${release.tag}, ${release.assets.length} assets`);
}

main().catch((e) => warn(String(e && e.message || e)));
