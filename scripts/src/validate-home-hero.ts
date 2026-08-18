/// <reference lib="dom" />
// The in-page callbacks (page.evaluate / waitForFunction) run in the
// browser, so this Node-side script needs the DOM lib for their types.
//
// Guards the Ask page (/ask) against silent breakage of its
// "immediately usable" contract:
//
// 1. The "Ask Laertius" heading and the question input must be visible
//    in the initial viewport WITHOUT scrolling, with at least three
//    clickable sample-query buttons.
// 2. Every section must end at opacity 1 after scrolling through the
//    page (the edition statistics band was removed 2026-08-09, so no
//    whileInView reveals remain and no hidden-before-scroll positive
//    control is possible).
// 3. Under prefers-reduced-motion, the heading and input must be
//    visible and every section must still end fully visible.
//
// Requirements: the API server and web workflows must be running (the
// script talks to the shared proxy, default http://localhost:80), and a
// Chromium headless shell must be installed for playwright-core, e.g.:
//   PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright \
//     node scripts/node_modules/playwright-core/cli.js install chromium-headless-shell

// playwright-core resolves its browser registry at module import time from
// PLAYWRIGHT_BROWSERS_PATH (default: $XDG_CACHE_HOME/ms-playwright, which in
// this environment points inside the workspace and holds no browsers). Set
// the env var BEFORE importing playwright-core.
import "./lib/playwright-browsers-path";

const { chromium } = await import("playwright-core");
import type { Page } from "playwright-core";

const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:80";
// The idle Ask page now carries a single top-level <section> (the ask
// intro band); the edition statistics band and the Method pillars were
// removed/relocated. Guard against the probe going vacuous if the markup
// is restructured.
const MIN_SECTIONS = 1;

let failures = 0;
function check(label: string, ok: boolean, detail?: string) {
  if (ok) {
    console.log(`  ok: ${label}`);
  } else {
    failures++;
    console.error(`  FAIL: ${label}${detail ? ` (${detail})` : ""}`);
  }
}

// For each top-level <section>, report the minimum opacity across the
// section itself and every descendant that carries an INLINE style
// opacity — that is where framer-motion animates the Reveal wrappers.
// Class-based decorative translucency is deliberately ignored.
function sectionMinOpacities(page: Page): Promise<number[]> {
  return page.evaluate(() =>
    Array.from(document.querySelectorAll("main section, section")).map(
      (section) => {
        let min = parseFloat(getComputedStyle(section).opacity);
        for (const el of Array.from(section.querySelectorAll("*"))) {
          const inline = (el as HTMLElement).style?.opacity;
          if (inline !== undefined && inline !== "") {
            min = Math.min(min, parseFloat(inline));
          }
        }
        return min;
      },
    ),
  );
}

// Trigger every whileInView reveal by stepping through the full page
// height, then settle at the bottom and give animations time to finish.
async function scrollThrough(page: Page) {
  const steps = await page.evaluate(() =>
    Math.ceil(document.body.scrollHeight / window.innerHeight),
  );
  for (let i = 1; i <= steps; i++) {
    await page.evaluate((k) => window.scrollTo(0, k * window.innerHeight), i);
    await page.waitForTimeout(250);
  }
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(1200);
}

async function checkAboveTheFold(page: Page) {
  const heading = page.locator("h1", { hasText: "Ask Laertius" }).first();
  check(
    '"Ask Laertius" heading is visible',
    await heading.isVisible().catch(() => false),
  );
  const input = page.locator('input[type="text"]').first();
  const box = await input.boundingBox().catch(() => null);
  const viewport = page.viewportSize();
  check(
    "question input is visible inside the initial viewport (no scroll)",
    !!box &&
      !!viewport &&
      box.y >= 0 &&
      box.y + box.height <= viewport.height &&
      (await page.evaluate(() => window.scrollY)) === 0,
    box ? `input y=${box.y.toFixed(0)}` : "input not found",
  );
  const samples = await page
    .locator("button", { hasText: /"/ })
    .count()
    .catch(() => 0);
  check(
    "at least 3 sample-query buttons are present",
    samples >= 3,
    `found ${samples}`,
  );
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  try {
    console.log("Scenario 1: ask box usable above the fold");
    const page = await browser.newPage({
      viewport: { width: 1400, height: 900 },
    });
    await page.goto(`${BASE_URL}/ask`, { waitUntil: "networkidle" });
    await page.waitForSelector("h1", { timeout: 15000 });
    await checkAboveTheFold(page);

    const before = await sectionMinOpacities(page);
    check(
      `ask page has at least ${MIN_SECTIONS} sections`,
      before.length >= MIN_SECTIONS,
      `found ${before.length}`,
    );

    console.log("Scenario 2: all section reveals reach opacity 1 after scroll");
    await scrollThrough(page);
    const after = await sectionMinOpacities(page);
    const stuck = after
      .map((o, i) => ({ o, i }))
      .filter(({ o }) => o < 0.99);
    check(
      "every section (and its reveal wrappers) ends at opacity 1",
      stuck.length === 0,
      `stuck sections (index:opacity): ${stuck
        .map(({ i, o }) => `${i}:${o.toFixed(2)}`)
        .join(", ")}`,
    );
    await page.close();

    console.log("Scenario 3: reduced motion still shows everything");
    const ctx = await browser.newContext({
      reducedMotion: "reduce",
      viewport: { width: 1400, height: 900 },
    });
    const rm = await ctx.newPage();
    await rm.goto(`${BASE_URL}/ask`, { waitUntil: "networkidle" });
    await rm.waitForSelector("h1", { timeout: 15000 });
    await rm.waitForTimeout(1200);
    await checkAboveTheFold(rm);

    await scrollThrough(rm);
    const rmAfter = await sectionMinOpacities(rm);
    check(
      `reduced motion: ask page has at least ${MIN_SECTIONS} sections`,
      rmAfter.length >= MIN_SECTIONS,
      `found ${rmAfter.length}`,
    );
    const rmStuck = rmAfter
      .map((o, i) => ({ o, i }))
      .filter(({ o }) => o < 0.99);
    check(
      "reduced motion: every section ends fully visible",
      rmStuck.length === 0,
      `stuck sections (index:opacity): ${rmStuck
        .map(({ i, o }) => `${i}:${o.toFixed(2)}`)
        .join(", ")}`,
    );
    await ctx.close();

    // ——— The dedicated landing page at "/" (School of Athens hero) ———
    console.log("Scenario 4: home landing page hero and calls to action");
    const homeGenres: Array<{ label: string; href: string }> = [
      { label: "Verses", href: "/verses" },
      { label: "Sayings", href: "/sayings" },
      { label: "Doxai", href: "/doxography" },
      { label: "Anecdotes", href: "/anecdotes" },
      { label: "Letters", href: "/letters" },
      { label: "Testaments", href: "/testaments" },
    ];
    const home = await browser.newPage({
      viewport: { width: 1400, height: 900 },
    });
    await home.goto(`${BASE_URL}/`, { waitUntil: "networkidle" });
    await home.waitForSelector("h1", { timeout: 15000 });
    // The page opens with a typographic cover whose h1 is the Greek incipit;
    // the pictorial hero below carries the English edition title. Accept the
    // title in any top-level heading rather than pinning it to the first h1.
    const homeHeadings = await home
      .locator("h1, h2")
      .allTextContents()
      .catch(() => [] as string[]);
    check(
      "home hero heading carries the edition title",
      homeHeadings.some((t) =>
        /Lives and Opinions of Eminent Philosophers/i.test(t),
      ),
      `headings="${homeHeadings.map((t) => t.trim().slice(0, 40)).join(" | ")}"`,
    );
    const homeGrc =
      (await home
        .locator('[lang="grc"]')
        .first()
        .textContent()
        .catch(() => null)) ?? "";
    check(
      'home Greek title (lang="grc") renders with the Βίοι incipit',
      homeGrc.includes("Βίοι"),
      `grc="${homeGrc.trim().slice(0, 60)}"`,
    );
    const readHref = await home
      .locator('a:has-text("Read the Text")')
      .first()
      .getAttribute("href")
      .catch(() => null);
    check(
      'home "Read the Text" call to action links to /browse',
      typeof readHref === "string" && readHref.endsWith("/browse"),
      `href=${String(readHref)}`,
    );
    const aboutCount = await home
      .locator('a[href$="/about"]')
      .count()
      .catch(() => 0);
    check("home page has an About link", aboutCount > 0);

    console.log("Scenario 5: home hero background image asset resolves");
    const heroBg = await home.evaluate(() => {
      for (const s of Array.from(document.querySelectorAll("section"))) {
        const bg = getComputedStyle(s).backgroundImage;
        const m = /url\("?([^")]+)"?\)/.exec(bg);
        if (m) return m[1];
      }
      return null;
    });
    check("a home hero section declares a background image", heroBg !== null);
    if (heroBg) {
      const res = await home.request.get(new URL(heroBg, `${BASE_URL}/`).href);
      check(
        "the home hero background image URL resolves (HTTP 200)",
        res.status() === 200,
        `${heroBg} → ${res.status()}`,
      );
    }

    console.log("Scenario 6: home genre tiles link out and counts populate");
    for (const g of homeGenres) {
      const present =
        (await home
          .locator(`a[href$="${g.href}"]`)
          .count()
          .catch(() => 0)) > 0;
      check(`home genre link to ${g.href} (${g.label}) is present`, present);
    }
    // (2026-08: the sidebar "Textual Genres" count-badge block was removed
    // from the homepage at the user's request; the live-count check went
    // with it. Genre links remain reachable via the dropdown menus above.)
    await home.close();
  } finally {
    await browser.close();
  }

  if (failures > 0) {
    console.error(`\nvalidate-home-hero: ${failures} check(s) failed`);
    process.exit(1);
  }
  console.log("\nvalidate-home-hero: all checks passed");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
