#!/usr/bin/env node
// Static-site sanity check for aerini.org.
//
// Fatal (exit 1):
//   - an href/src still contains an unfilled build placeholder, e.g. __POLAR_CHECKOUT_LINK__
//   - an internal link (path on this site) points to a page that doesn't exist
//   - an in-page anchor (#section) has no matching id on that page
//
// Warn-only (does not fail the build):
//   - an external link returns a non-2xx/3xx status
//   - external checks are best-effort: some hosts block automated requests (403/999)
//     with no real availability problem, so a WARN here is a prompt to check by hand,
//     not proof the link is broken.
//
// Usage: node scripts/check-site.mjs [--live]
//   --live   also send real HTTP requests to external links (slower, needs network)

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const LIVE = process.argv.includes("--live");
const SITE_HOST = "aerini.org";

const PLACEHOLDER_RE = /__[A-Z0-9_]+__/g;
const LINK_RE = /(?:href|src)\s*=\s*"([^"]+)"/g;
const ID_RE = /\sid\s*=\s*"([^"]+)"/g;

function htmlFiles() {
  return readdirSync(ROOT).filter((f) => f.endsWith(".html"));
}

function pathForRoute(route) {
  // "/" -> index.html, "/pricing" -> pricing.html, "/pricing.html" -> as-is
  if (route === "/" || route === "") return "index.html";
  let clean = route.replace(/^\//, "").split("#")[0].split("?")[0];
  if (clean === "") return "index.html";
  if (!clean.endsWith(".html")) clean += ".html";
  return clean;
}

async function checkExternal(url) {
  try {
    const res = await fetch(url, { method: "GET", redirect: "follow" });
    return { ok: res.ok, status: res.status };
  } catch (err) {
    return { ok: false, status: null, error: String(err) };
  }
}

async function main() {
  const files = htmlFiles();
  const idsByFile = new Map();
  for (const file of files) {
    const html = readFileSync(join(ROOT, file), "utf8");
    const ids = new Set([...html.matchAll(ID_RE)].map((m) => m[1]));
    idsByFile.set(file, ids);
  }

  let failures = 0;
  let warnings = 0;
  const externalToCheck = new Map(); // url -> [ "file: raw link" ]

  for (const file of files) {
    const html = readFileSync(join(ROOT, file), "utf8");

    const placeholders = html.match(PLACEHOLDER_RE);
    if (placeholders) {
      for (const p of new Set(placeholders)) {
        console.error(`FAIL  ${file}: unfilled placeholder ${p}`);
        failures++;
      }
    }

    for (const m of html.matchAll(LINK_RE)) {
      const link = m[1];
      if (
        link.startsWith("mailto:") ||
        link.startsWith("tel:") ||
        link.startsWith("javascript:") ||
        link.startsWith("data:") ||
        link.startsWith("#")
      ) {
        if (link.startsWith("#") && link.length > 1) {
          const anchor = link.slice(1);
          if (!idsByFile.get(file)?.has(anchor)) {
            console.error(`FAIL  ${file}: #${anchor} has no matching id on this page`);
            failures++;
          }
        }
        continue;
      }

      let isInternal = false;
      let route = null;
      if (link.startsWith("/")) {
        isInternal = true;
        route = link;
      } else if (link.includes(`://${SITE_HOST}`)) {
        isInternal = true;
        route = "/" + link.split(SITE_HOST)[1].replace(/^\//, "");
      }

      if (isInternal) {
        const [routePath, anchor] = route.split("#");
        const target = pathForRoute(routePath || "/");
        if (!existsSync(join(ROOT, target))) {
          console.error(`FAIL  ${file}: internal link "${link}" -> ${target} does not exist`);
          failures++;
          continue;
        }
        if (anchor) {
          const targetHtml = readFileSync(join(ROOT, target), "utf8");
          const targetIds = idsByFile.get(target) ?? new Set([...targetHtml.matchAll(ID_RE)].map((mm) => mm[1]));
          if (!targetIds.has(anchor)) {
            console.error(`FAIL  ${file}: internal link "${link}" -> #${anchor} has no matching id in ${target}`);
            failures++;
          }
        }
      } else if (/^https?:\/\//.test(link)) {
        if (!externalToCheck.has(link)) externalToCheck.set(link, []);
        externalToCheck.get(link).push(file);
      }
    }
  }

  if (LIVE) {
    for (const [url, sources] of externalToCheck) {
      const result = await checkExternal(url);
      if (!result.ok) {
        console.warn(`WARN  ${url} -> ${result.status ?? "no response"} (referenced from: ${sources.join(", ")})`);
        warnings++;
      }
    }
  }

  console.log(`\n${failures} failure(s), ${warnings} warning(s) across ${files.length} file(s).`);
  if (!LIVE) console.log("Run with --live to also check external links over the network.");
  if (failures > 0) process.exit(1);
}

main();
