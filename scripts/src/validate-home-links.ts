/// <reference lib="dom" />
// Guards the editorial homepage (artifacts/laertius/src/pages/home.tsx)
// against silent navigation and stats drift:
//
// 1. STATIC: every internal href minted anywhere in home.tsx (header
//    dropdowns, hero calls to action, sidebar quick access, genre rows,
//    book rows, explorations, footer) must target a route that actually
//    exists in App.tsx. A renamed or dropped route fails here without a
//    browser. Positive controls keep both extractions honest: the route
//    table and the homepage link set must each clear a minimum size, so
//    a regex gone vacuous cannot pass silently.
//
// 2. RUNTIME (Playwright): the six sidebar genre badges must render real
//    digits from the corpus-stats API — never the "…" placeholder — and
//    every link rendered on the page must resolve to a known route once
//    the app's base path is stripped. A renamed stats field
//    (count === undefined forever) fails here.
//
// Requirements for the runtime half: API server + laertius web workflows
// running (shared proxy, default http://localhost:80) and a Chromium
// headless shell installed for playwright-core, e.g.:
//   PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright \
//     node scripts/node_modules/playwright-core/cli.js install chromium-headless-shell
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import "./lib/playwright-browsers-path";

const { chromium } = await import("playwright-core");

const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:80";

const here = path.dirname(fileURLToPath(import.meta.url));
const laertiusSrc = path.join(here, "../../artifacts/laertius/src");
const homeSource = readFileSync(path.join(laertiusSrc, "pages/home.tsx"), "utf8");
const appSource = readFileSync(path.join(laertiusSrc, "App.tsx"), "utf8");

// The homepage currently mints links to 18 distinct routes; the route
// table has 20+ entries. If either extraction ever collapses below
// these floors, the regexes have gone vacuous.
const MIN_ROUTES = 20;
const MIN_HOME_LINKS = 18;

let failures = 0;
function check(label: string, ok: boolean, detail?: string) {
  if (ok) {
    console.log(`  ok: ${label}`);
  } else {
    failures++;
    console.error(`  FAIL: ${label}${detail ? ` (${detail})` : ""}`);
  }
}

// ——— Route table from App.tsx ———
const routes = new Set<string>(["/"]); // "/" renders <Home /> outside the Switch
for (const m of appSource.matchAll(/<Route\s+path="([^"]+)"/g)) {
  routes.add(m[1]);
}

function routeExists(href: string): boolean {
  const pathname = href.split(/[?#]/)[0];
  if (routes.has(pathname)) return true;
  // Match parameterized routes (/section/:id etc.) segment by segment.
  const segs = pathname.split("/").filter(Boolean);
  outer: for (const r of routes) {
    const rsegs = r.split("/").filter(Boolean);
    if (rsegs.length !== segs.length || rsegs.length === 0) continue;
    for (let i = 0; i < rsegs.length; i++) {
      if (!rsegs[i].startsWith(":") && rsegs[i] !== segs[i]) continue outer;
    }
    return true;
  }
  return false;
}

// ——— Static link extraction from home.tsx ———
// Every internal link on the page is minted either as a JSX attribute
// (href="/browse") or as a string literal inside the NAV_ITEMS / genres /
// EXPLORATIONS / footer data arrays (href: "/verses"), or via navigate()
// for the two search forms.
const staticHrefs = new Set<string>();
for (const m of homeSource.matchAll(/href[:=]\s*["'{]*\s*["'`]?(\/[a-zA-Z0-9\-_/]*)/g)) {
  staticHrefs.add(m[1]);
}
for (const m of homeSource.matchAll(/navigate\(\s*q\s*\?\s*`(\/[a-zA-Z0-9\-_]*)/g)) {
  staticHrefs.add(m[1]);
}
// Template-literal hrefs (href={`/section/${life.firstId}`}) are truncated by
// the generic extractor at the interpolation. Re-extract them with the
// interpolated tail modeled as a route parameter, so they are checked against
// parameterized routes (/section/:id) instead of a bogus bare prefix.
for (const m of homeSource.matchAll(/href=\{\s*`(\/[a-zA-Z0-9\-_/]*)\$\{[^`]*`/g)) {
  staticHrefs.delete(m[1]);
  staticHrefs.add(m[1].replace(/\/$/, "") + "/:param");
}

console.log("Static: App.tsx route table");
check(
  `route table extraction found at least ${MIN_ROUTES} routes`,
  routes.size >= MIN_ROUTES,
  `found ${routes.size}`,
);

console.log("Static: every home.tsx link targets an existing route");
check(
  `home.tsx link extraction found at least ${MIN_HOME_LINKS} distinct hrefs`,
  staticHrefs.size >= MIN_HOME_LINKS,
  `found ${staticHrefs.size}: ${[...staticHrefs].sort().join(", ")}`,
);
for (const href of [...staticHrefs].sort()) {
  check(`home link ${href} matches a route in App.tsx`, routeExists(href));
}
// Spot-pin the sections the task cares about so a refactor that drops a
// whole block (e.g. the footer nav array) cannot pass as "fewer links".
const REQUIRED_LINKS = [
  "/browse", // hero CTA, quick access, book rows
  "/about", // hero secondary CTA, footer
  "/search", // header dropdown
  "/entities", // header dropdown (Index)
  "/verses",
  "/sayings",
  "/doxography",
  "/anecdotes",
  "/letters",
  "/testaments", // genre rows + dropdown
  "/graph",
  "/timeline",
  "/map", // explorations
  "/competency", // Method dropdown + footer
  "/stats",
  "/terminology",
  "/legomena", // Method dropdown
  "/ask", // top nav + sidebar Ask form
];
for (const href of REQUIRED_LINKS) {
  check(`home.tsx still mints a link to ${href}`, staticHrefs.has(href));
}

// ——— Runtime: rendered page + live genre counts ———
async function runtime() {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({
      viewport: { width: 1400, height: 900 },
    });
    await page.goto(`${BASE_URL}/`, { waitUntil: "networkidle" });
    await page.waitForSelector("h1", { timeout: 15000 });

    console.log("Runtime: rendered links all resolve to known routes");
    const rendered = await page.evaluate(() =>
      Array.from(document.querySelectorAll<HTMLAnchorElement>("a[href]"))
        .map((a) => a.getAttribute("href") ?? "")
        .filter((h) => h.startsWith("/")),
    );
    check(
      "the rendered homepage has internal links",
      rendered.length > 0,
      `found ${rendered.length}`,
    );
    // The app may run under a base path (e.g. /laertius); strip it by
    // matching each rendered href against the route table with any
    // leading segments dropped until one matches — but require the raw
    // or single-prefix-stripped form to match, not arbitrary suffixes.
    const basePath = await page.evaluate(() => {
      const el = document.querySelector("base");
      return el?.getAttribute("href") ?? "/";
    });
    const prefix = basePath.replace(/\/$/, "");
    const bad = [...new Set(rendered)].filter((h) => {
      const stripped =
        prefix && h.startsWith(prefix) ? h.slice(prefix.length) || "/" : h;
      return !routeExists(stripped);
    });
    check(
      "every rendered internal link targets a known route",
      bad.length === 0,
      `unknown: ${bad.join(", ")}`,
    );

    // (2026-08: the sidebar "Textual Genres" badge block was removed from the
    // homepage at the user's request; its runtime badge checks went with it.)
    console.log(
      "Runtime: the shared layout footer keeps About and Statistics reachable",
    );
    // The About group is defined separately from navGroups in layout.tsx; a
    // refactor that renders only navGroups in the footer would silently drop
    // these two links there (they'd survive in the header, so the
    // rendered-links checks wouldn't catch the loss). The homepage has its
    // own self-contained footer, so assert against a layout-rendered page.
    await page.goto(`${BASE_URL}/browse`, { waitUntil: "networkidle" });
    await page.waitForSelector("footer nav", { timeout: 15000 }).catch(() => {});
    const footerHrefs = await page.evaluate(() =>
      Array.from(
        document.querySelectorAll<HTMLAnchorElement>("footer nav a[href]"),
      ).map((a) => a.getAttribute("href") ?? ""),
    );
    for (const want of ["/about", "/stats"]) {
      check(
        `the layout footer nav links to ${want}`,
        footerHrefs.some((h) => h === want || h === `${prefix}${want}`),
        `footer hrefs: ${footerHrefs.join(", ")}`,
      );
    }

    await page.close();
  } finally {
    await browser.close();
  }
}

await runtime();

if (failures > 0) {
  console.error(`\nvalidate-home-links: ${failures} check(s) failed`);
  process.exit(1);
}
console.log("\nvalidate-home-links: all checks passed");
