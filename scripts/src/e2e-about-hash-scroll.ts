/// <reference lib="dom" />
// Real-browser check for task: the Legomena SPARQL console links to
// /about#linked-open-data, and the About page carries a hash-scroll effect
// (artifacts/laertius/src/pages/about.tsx) because wouter's client-side
// navigation does not scroll to hashes on its own. This script drives
// headless Chromium against the running dev servers and asserts:
//
// 1. Clicking the console's "runnable example queries on the About page"
//    link is a genuine SPA navigation (a window marker set before the click
//    survives it — no full page load).
// 2. The URL becomes /about with hash #linked-open-data.
// 3. The #linked-open-data section is scrolled into view (its rect top lands
//    near the top of the viewport and window.scrollY is far down the page).
// 4. The position stays put for a second afterwards — the app's
//    scroll-restore logic must not fight the hash scroll.
// 5. Browser Back returns to the console, and a second click repeats the
//    whole behavior (the effect keys on wouter's location, so repeat
//    navigation must scroll again).
//
// Clicks are dispatched via page.evaluate (bubbling MouseEvent) instead of
// Playwright's click(), which auto-scrolls the target into view first and
// would corrupt scroll assertions (see .agents/memory).
//
// Requirements: the laertius web + api-server workflows must be running
// (shared proxy, default http://localhost:80) and a Chromium headless shell
// installed for playwright-core, e.g.:
//   PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright \
//     node scripts/node_modules/playwright-core/cli.js install chromium-headless-shell
//
// Optionally set E2E_SCREENSHOT_DIR to save evidence screenshots.
import { mkdirSync } from "node:fs";

// playwright-core resolves its browser registry at module import time from
// PLAYWRIGHT_BROWSERS_PATH; set it BEFORE importing playwright-core, picking
// whichever candidate actually contains a chromium install.
import "./lib/playwright-browsers-path";

const { chromium } = await import("playwright-core");
const { attachPageGuard } = await import("./lib/e2e-page-guard");

const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:80";
const SHOT_DIR = process.env.E2E_SCREENSHOT_DIR;

let failures = 0;
function check(label: string, ok: boolean, detail?: string) {
  if (ok) {
    console.log(`  ok: ${label}`);
  } else {
    failures++;
    console.error(`  FAIL: ${label}${detail ? ` (${detail})` : ""}`);
  }
}

const LINK_SELECTOR = 'a[href="/about#linked-open-data"]';
const TARGET_ID = "linked-open-data";
// The section is far down the About page; its heading must land near the
// viewport top (scroll-mt-6 gives it a small offset).
const TOP_MIN = -5;
const TOP_MAX = 200;

async function main() {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({
      viewport: { width: 1280, height: 720 },
    });
    const guard = attachPageGuard(page);

    // Snapshot of the target section's placement, taken in-page.
    const measure = () =>
      page.evaluate((id) => {
        const el = document.getElementById(id);
        return {
          found: !!el,
          top: el ? el.getBoundingClientRect().top : NaN,
          scrollY: window.scrollY,
          pathname: window.location.pathname,
          hash: window.location.hash,
          marker: (window as unknown as { __spaMarker?: number }).__spaMarker,
        };
      }, TARGET_ID);

    const clickLink = () =>
      page.evaluate((sel) => {
        const el = document.querySelector(sel);
        if (!el) throw new Error(`no element matches ${sel}`);
        el.dispatchEvent(
          new MouseEvent("click", { bubbles: true, cancelable: true, view: window }),
        );
      }, LINK_SELECTOR);

    const waitForScrolledIntoView = () =>
      page.waitForFunction(
        ([id, min, max]) => {
          const el = document.getElementById(id as string);
          if (!el) return false;
          const top = el.getBoundingClientRect().top;
          return top >= (min as number) && top <= (max as number);
        },
        [TARGET_ID, TOP_MIN, TOP_MAX] as const,
        { timeout: 10000 },
      );

    for (const round of [1, 2] as const) {
      if (round === 1) {
        console.log("Round 1: first SPA navigation from the SPARQL console");
        await page.goto(`${BASE_URL}/legomena/sparql`, {
          waitUntil: "networkidle",
        });
        guard.assertPageLoaded();
        await guard.guarded(page.waitForSelector(LINK_SELECTOR));
      } else {
        console.log("Round 2: browser Back, then repeat navigation");
        await page.goBack({ waitUntil: "networkidle" });
        const backState = await page.evaluate(() => ({
          pathname: window.location.pathname,
          marker: (window as unknown as { __spaMarker?: number }).__spaMarker,
        }));
        check(
          "Back returns to /legomena/sparql",
          backState.pathname === "/legomena/sparql",
          `pathname=${backState.pathname}`,
        );
        await guard.guarded(page.waitForSelector(LINK_SELECTOR));
      }

      // Marker proves the click triggers wouter SPA routing, not a reload.
      await page.evaluate((n) => {
        (window as unknown as { __spaMarker?: number }).__spaMarker = n;
      }, round);
      await clickLink();

      await guard.guarded(
        page.waitForFunction(
          () =>
            window.location.pathname === "/about" &&
            window.location.hash === "#linked-open-data",
          undefined,
          { timeout: 10000 },
        ),
      );
      await guard.guarded(waitForScrolledIntoView());

      const after = await measure();
      check(`round ${round}: #${TARGET_ID} exists`, after.found);
      check(
        `round ${round}: navigation was client-side (marker survives)`,
        after.marker === round,
        `marker=${after.marker}`,
      );
      check(
        `round ${round}: section scrolled into view`,
        after.top >= TOP_MIN && after.top <= TOP_MAX,
        `top=${after.top}`,
      );
      check(
        `round ${round}: page really scrolled down`,
        after.scrollY > 500,
        `scrollY=${after.scrollY}`,
      );

      // Scroll-restore must not fight the hash scroll: hold for a second.
      await page.waitForTimeout(1000);
      const settled = await measure();
      check(
        `round ${round}: position stable after 1s (no scroll-restore fight)`,
        settled.top >= TOP_MIN && settled.top <= TOP_MAX,
        `top=${settled.top} scrollY=${settled.scrollY}`,
      );

      if (SHOT_DIR) {
        mkdirSync(SHOT_DIR, { recursive: true });
        await page.screenshot({
          path: `${SHOT_DIR}/about-hash-scroll-round${round}.png`,
        });
      }
    }
  } finally {
    await browser.close();
  }

  if (failures > 0) {
    console.error(`${failures} check(s) failed`);
    process.exit(1);
  }
  console.log("All about-hash-scroll checks passed");
}

await main();
