#!/usr/bin/env node
// Static-site checks for aerini.org. Run: node scripts/check-site.mjs [--live]
//
// Fatal (exit 1):
//   - unfilled build placeholder in an href/src (e.g. __POLAR_CHECKOUT_LINK__)
//   - internal link or asset that does not exist; in-page anchor with no matching id; duplicate ids
//   - inline style attribute, inline event handler, or inline executable script (the CSP forbids them)
//   - missing or weakened Content-Security-Policy meta tag
//   - external script/stylesheet from a host that is not allow-listed, or an external script without integrity
//   - indexable page missing title, description, canonical, og:image, or with other than one <h1>
//   - invalid JSON-LD; index FAQ markup out of sync with its FAQPage JSON-LD
//   - sitemap lists a missing/noindex page, or omits an indexable page
//   - target="_blank" link without rel="noopener"
//   - .well-known/security.txt missing, malformed, or expired
//
// Warn-only: external link returns non-2xx/3xx (--live); security.txt expires within 30 days.

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const LIVE = process.argv.includes("--live");
const SITE = "https://aerini.org";
const SITE_HOST = "aerini.org";
const SCRIPT_HOSTS = ["https://cdn.jsdelivr.net/npm/@polar-sh/checkout@"];
const PLACEHOLDER_RE = /__[A-Z0-9_]+__/g;
const LINK_RE = /(?:href|src)\s*=\s*"([^"]+)"/g;
const ID_RE = /\sid\s*=\s*"([^"]+)"/g;

let failures = 0, warnings = 0;
const fail = (m) => { console.error(`FAIL  ${m}`); failures++; };
const warn = (m) => { console.warn(`WARN  ${m}`); warnings++; };
const read = (f) => readFileSync(join(ROOT, f), "utf8");
const files = readdirSync(ROOT).filter((f) => f.endsWith(".html"));

function routeToFile(route) {
  const clean = route.replace(/^\//, "").split("#")[0].split("?")[0];
  if (clean === "") return "index.html";
  // "license-terms-v1.0" has a dot but is a page, so only real asset extensions count as files.
  if (/\.(html|css|js|png|ico|svg|xml|txt|webmanifest|woff2)$/.test(clean)) return clean;
  return clean + ".html";
}
const textOf = (s) => s.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/&mdash;/g, "—").replace(/&rarr;/g, "→").replace(/\s+/g, " ").trim();
const meta = (html, re) => (html.match(re) || [])[1];

const idsByFile = new Map();
const noindex = new Set();
for (const f of files) {
  const html = read(f);
  const ids = [...html.matchAll(ID_RE)].map((m) => m[1]);
  const seen = new Set();
  for (const id of ids) { if (seen.has(id)) fail(`${f}: duplicate id "${id}"`); seen.add(id); }
  idsByFile.set(f, seen);
  if (/<meta name="robots" content="[^"]*noindex/i.test(html)) noindex.add(f);
}

const externalToCheck = new Map();
for (const f of files) {
  const html = read(f);
  const head = html.slice(0, html.indexOf("</head>"));

  for (const p of new Set(html.match(PLACEHOLDER_RE) || [])) fail(`${f}: unfilled placeholder ${p}`);
  if (/\sstyle\s*=\s*"/i.test(html)) fail(`${f}: inline style attribute (CSP forbids it; use a class)`);
  if (/\son[a-z]+\s*=\s*"/i.test(html.replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/g, ""))) fail(`${f}: inline event handler`);
  if (/<style[\s>]/i.test(html)) fail(`${f}: <style> element (CSP forbids it)`);
  const speculationRules = [];
  for (const m of html.matchAll(/<script\b([^>]*)>/gi)) {
    const attrs = m[1];
    if (/type="application\/ld\+json"/.test(attrs)) continue;
    if (/type="speculationrules"/.test(attrs)) {
      speculationRules.push(html.slice(m.index + m[0].length, html.indexOf("</script>", m.index)));
      continue;
    }
    const src = meta(attrs, /\ssrc="([^"]+)"/) ?? (attrs.startsWith(" src=") ? meta(attrs, /^\s*src="([^"]+)"/) : undefined);
    if (!src) { fail(`${f}: inline executable <script>`); continue; }
    if (/^https?:\/\//.test(src)) {
      if (!SCRIPT_HOSTS.some((h) => src.startsWith(h))) fail(`${f}: script from non-allow-listed host ${src}`);
      if (!/integrity="sha384-/.test(attrs)) fail(`${f}: external script without integrity hash`);
      if (!/@\d+\.\d+\.\d+\//.test(src)) fail(`${f}: external script not pinned to an exact version`);
    }
  }
  for (const m of html.matchAll(/<link\b[^>]*>/gi)) {
    const href = meta(m[0], /href="([^"]+)"/);
    if (/rel="stylesheet"/.test(m[0]) && /^https?:\/\//.test(href || "")) fail(`${f}: external stylesheet ${href}`);
  }

  const csp = meta(head, /http-equiv="Content-Security-Policy" content="([^"]+)"/);
  if (!csp) fail(`${f}: missing Content-Security-Policy meta`);
  else {
    if (/unsafe-eval|unsafe-inline/.test(csp)) fail(`${f}: CSP contains unsafe-eval/unsafe-inline`);
    if (!/default-src 'none'/.test(csp) || !/object-src 'none'/.test(csp) || !/base-uri 'none'/.test(csp)) fail(`${f}: CSP lost default-src/object-src/base-uri 'none'`);
    if (!/connect-src 'self'/.test(csp)) fail(`${f}: CSP connect-src must include 'self' (script.js reads release.json)`);
    if (f !== "pricing.html" && /frame-src|cdn\.jsdelivr\.net/.test(csp)) fail(`${f}: CSP allows frames/CDN scripts but only pricing.html needs them`);
    for (const rules of speculationRules) {
      try { JSON.parse(rules); } catch (e) { fail(`${f}: invalid speculation rules JSON (${e.message})`); }
      const hash = createHash("sha256").update(rules).digest("base64");
      if (!csp.includes(`'sha256-${hash}'`)) fail(`${f}: speculation rules hash 'sha256-${hash}' missing from CSP script-src`);
    }
  }
  if (!csp && speculationRules.length) fail(`${f}: speculation rules need a CSP script-src hash but the page has no CSP`);

  for (const m of html.matchAll(/<script type="application\/ld\+json">\s*([\s\S]*?)\s*<\/script>/g)) {
    try { JSON.parse(m[1]); } catch (e) { fail(`${f}: invalid JSON-LD (${e.message})`); }
  }

  if (f !== "404.html" && !noindex.has(f)) {
    const title = meta(head, /<title>([^<]+)<\/title>/);
    const desc = meta(head, /<meta name="description" content="([^"]*)"/);
    const canon = meta(head, /<link rel="canonical" href="([^"]+)"/);
    if (!title) fail(`${f}: missing <title>`);
    else if (title.length > 70) warn(`${f}: title is ${title.length} chars (aim for <= 60-70)`);
    if (!desc) fail(`${f}: missing meta description`);
    else if (desc.length < 50 || desc.length > 170) warn(`${f}: description is ${desc.length} chars (aim for 50-160)`);
    const want = f === "index.html" ? `${SITE}/` : `${SITE}/${f.replace(/\.html$/, "")}`;
    if (canon !== want) fail(`${f}: canonical "${canon}" should be "${want}"`);
    if (!/property="og:image"/.test(head)) fail(`${f}: missing og:image`);
    const h1s = (html.match(/<h1[\s>]/g) || []).length;
    if (h1s !== 1) fail(`${f}: expected exactly one <h1>, found ${h1s}`);
  }

  for (const m of html.matchAll(/<a\b[^>]*target="_blank"[^>]*>/g)) {
    if (!/rel="[^"]*noopener/.test(m[0])) fail(`${f}: target="_blank" without rel="noopener": ${m[0].slice(0, 80)}`);
  }

  for (const m of html.matchAll(LINK_RE)) {
    const link = m[1];
    if (/^(mailto:|tel:|data:)/.test(link)) continue;
    if (link.startsWith("javascript:")) { fail(`${f}: javascript: URL`); continue; }
    if (link.startsWith("#")) {
      if (link.length > 1 && !idsByFile.get(f).has(link.slice(1))) fail(`${f}: #${link.slice(1)} has no matching id on this page`);
      continue;
    }
    let route = null;
    // Pages sit at the site root, so relative URLs also work from the github.io project preview.
    // The 404 page is served from any path, so it must use absolute URLs.
    if (!/^(https?:|\/)/.test(link)) {
      if (f === "404.html") { fail(`404.html: relative URL "${link}" (must be absolute; the page is served from any path)`); continue; }
      route = "/" + link.replace(/^\.\//, "");
    } else if (link.startsWith("/")) route = link;
    else if (link.startsWith(`${SITE}/`) || link === SITE) route = link.slice(SITE.length) || "/";
    if (route !== null) {
      const [routePath, anchor] = route.split("#");
      const target = routeToFile(routePath || "/");
      if (!existsSync(join(ROOT, target))) { fail(`${f}: "${link}" -> ${target} does not exist`); continue; }
      if (anchor && target.endsWith(".html") && !idsByFile.get(target)?.has(anchor)) fail(`${f}: "${link}" -> #${anchor} has no matching id in ${target}`);
    } else if (/^https?:\/\//.test(link)) {
      if (!externalToCheck.has(link)) externalToCheck.set(link, []);
      externalToCheck.get(link).push(f);
    }
  }
}

// fetch-release.mjs rewrites these exact card anchors at deploy time; fail early if the markup drifts.
{
  const html = read("index.html");
  for (const os of ["windows", "macos", "linux"]) {
    if (!new RegExp(`data-platform="${os}"[\\s\\S]*?<a href="[^"]*"[^>]*>Download \u2192</a>`).test(html)) fail(`index.html: ${os} download card no longer matches the pattern scripts/fetch-release.mjs rewrites`);
  }
}

// FAQ markup and FAQPage JSON-LD on the homepage must say the same thing.
{
  const html = read("index.html");
  const ld = [...html.matchAll(/<script type="application\/ld\+json">\s*([\s\S]*?)\s*<\/script>/g)].map((m) => JSON.parse(m[1]));
  const faqNode = ld.flatMap((o) => o["@graph"] ?? [o]).find((o) => o["@type"] === "FAQPage");
  if (!faqNode) fail("index.html: no FAQPage JSON-LD");
  else {
    const qs = [...html.matchAll(/<button type="button" class="faq-q">([\s\S]*?)<svg/g)].map((m) => textOf(m[1]));
    const as = [...html.matchAll(/<div class="faq-a-inner">([\s\S]*?)<\/div><\/div>/g)].map((m) => textOf(m[1]));
    const ldq = faqNode.mainEntity.map((q) => q.name), lda = faqNode.mainEntity.map((q) => textOf(q.acceptedAnswer.text));
    if (JSON.stringify(qs) !== JSON.stringify(ldq)) fail("index.html: FAQ questions differ from FAQPage JSON-LD");
    if (JSON.stringify(as) !== JSON.stringify(lda)) fail("index.html: FAQ answers differ from FAQPage JSON-LD");
  }
}

// Sitemap parity.
{
  const sm = read("sitemap.xml");
  const locs = [...sm.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  const listed = new Set();
  for (const loc of locs) {
    if (!loc.startsWith(SITE)) { fail(`sitemap.xml: ${loc} is not on ${SITE}`); continue; }
    const f = routeToFile(loc.slice(SITE.length) || "/");
    if (!existsSync(join(ROOT, f))) fail(`sitemap.xml: ${loc} -> ${f} does not exist`);
    if (noindex.has(f) || f === "404.html") fail(`sitemap.xml: lists non-indexable page ${loc}`);
    listed.add(f);
  }
  for (const f of files) if (f !== "404.html" && !noindex.has(f) && !listed.has(f)) fail(`sitemap.xml: missing indexable page ${f}`);
}

// security.txt (RFC 9116): Contact and Expires are required; Expires must be in the future.
{
  const p = ".well-known/security.txt";
  if (!existsSync(join(ROOT, p))) fail(`${p} is missing`);
  else {
    const t = read(p);
    if (!/^Contact:\s*\S+/m.test(t)) fail(`${p}: no Contact field`);
    const exp = t.match(/^Expires:\s*(\S+)/m);
    if (!exp) fail(`${p}: no Expires field`);
    else {
      const ms = Date.parse(exp[1]) - Date.now();
      if (Number.isNaN(ms)) fail(`${p}: unparseable Expires`);
      else if (ms < 0) fail(`${p}: expired on ${exp[1]}`);
      else if (ms < 30 * 864e5) warn(`${p}: expires within 30 days (${exp[1]}); renew it`);
    }
  }
}

if (LIVE) {
  for (const [url, sources] of externalToCheck) {
    try {
      const res = await fetch(url, { redirect: "follow" });
      if (!res.ok) warn(`${url} -> ${res.status} (from: ${[...new Set(sources)].join(", ")})`);
    } catch (e) { warn(`${url} -> no response (from: ${[...new Set(sources)].join(", ")})`); }
  }
}

console.log(`\n${failures} failure(s), ${warnings} warning(s) across ${files.length} file(s).`);
if (!LIVE) console.log("Run with --live to also check external links over the network.");
if (failures > 0) process.exit(1);
