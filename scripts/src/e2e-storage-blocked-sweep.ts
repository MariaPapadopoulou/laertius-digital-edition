/// <reference lib="dom" />
/* Real-browser sweep: the key pages survive a browser that BLOCKS
 * sessionStorage or localStorage (some strict privacy modes throw on
 * ANY access). Runs the full per-page assertion set once per blocked
 * storage kind: sessionStorage covers scroll memory / Ask handoff /
 * Search settings; localStorage covers the theme preference
 * ("laertius-theme" in index.html and use-theme) plus the text-layout
 * and Greek-source preference hooks.
 *
 * The Ask handoff is already covered by e2e-ask-handoff-no-storage.ts,
 * but other features touch sessionStorage too — scroll memory
 * (use-scroll-memory.ts saves on every scroll and restores on back),
 * the Search page settings, and restore-on-back flows. Each access is
 * supposed to be wrapped in try/catch; if a refactor ever moves one
 * outside the guard, the page would crash or go dead only for readers
 * whose browsers block storage — invisible to every other check.
 *
 * This script reuses the throwing-sessionStorage init script from
 * e2e-ask-handoff-no-storage.ts and sweeps home, search, ask, graph,
 * timeline and a passage page. For each page it asserts:
 *   - the page renders (heading present, non-trivial body text);
 *   - it stays interactive: scrolling (the scroll-memory save path) and
 *     clicking an in-app link (the snapshot-and-freeze path) work, and
 *     navigating Back (the restore path) re-renders the page;
 *   - no uncaught in-page errors or resource failures were recorded.
 *
 * Positive control: on every page the script first proves the storage
 * block is live (sessionStorage access throws in-page) so the run can't
 * pass vacuously against an unblocked browser.
 *
 * Requirements: api-server + laertius web workflows running behind the
 * shared proxy (http://localhost:80) and the headless Chromium shell
 * installed for playwright-core:
 *   PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright \
 *     node scripts/node_modules/playwright-core/cli.js install chromium-headless-shell
 */

import "./lib/playwright-browsers-path";

const { chromium } = await import("playwright-core");
const { attachPageGuard } = await import("./lib/e2e-page-guard");

const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:80";

// Same throwing-storage init script pattern as e2e-ask-handoff-no-storage.ts.
// Passed as a string: function-form init scripts are silently skipped
// under tsx (in-page `__name is not defined`).
function blockStorageScript(kind: "sessionStorage" | "localStorage"): string {
  return `
  (() => {
    const deny = () => {
      throw new DOMException(
        "${kind} is disabled in this browsing context",
        "SecurityError",
      );
    };
    Object.defineProperty(window, "${kind}", {
      configurable: false,
      get: deny,
    });
  })();
`;
}

// Two sweeps: strict privacy modes may block sessionStorage, localStorage
// (theme preference "laertius-theme" in index.html/use-theme, text-layout
// and Greek-source prefs), or both. Each mode gets its own browser context
// and its own in-page positive control.
const MODES: {
  name: string;
  blocked: ("sessionStorage" | "localStorage")[];
}[] = [
  { name: "sessionStorage blocked", blocked: ["sessionStorage"] },
  { name: "localStorage blocked", blocked: ["localStorage"] },
];

// Key pages named by the task: home, search, ask, graph, timeline, and a
// passage page. /section/1.1.22 is the passage id the other e2e checks use.
const ROUTES = [
  { route: "/", label: "home" },
  { route: "/search", label: "search" },
  { route: "/ask", label: "ask" },
  { route: "/graph", label: "graph" },
  { route: "/timeline", label: "timeline" },
  { route: "/section/1.1.22", label: "passage /section/1.1.22" },
];

let failures = 0;
function check(label: string, ok: boolean, detail?: string) {
  if (ok) {
    console.log(`  ok: ${label}`);
  } else {
    failures++;
    console.error(`  FAIL: ${label}${detail ? ` (${detail})` : ""}`);
  }
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  try {
    for (const mode of MODES) {
      console.log(`\n===== Mode: ${mode.name} =====`);
      const context = await browser.newContext({
        viewport: { width: 1400, height: 900 },
      });
      for (const kind of mode.blocked) {
        await context.addInitScript(blockStorageScript(kind));
      }

      for (const { route, label } of ROUTES) {
        console.log(`\nScenario: ${label} with ${mode.name}`);
        // Fresh page per route so guard failures are attributable per page.
        const page = await context.newPage();
        const guard = attachPageGuard(page);
        try {
          try {
            await page.goto(`${BASE_URL}${route}`, {
              waitUntil: "networkidle",
              timeout: 45000,
            });
          } catch {
            // networkidle can time out on pages with polling; the guard and
            // the assertions below still decide pass/fail.
          }
          guard.assertPageLoaded();

          // ——— Positive control: every blocked storage is actually live ———
          for (const kind of mode.blocked) {
            const storageThrows = await page.evaluate((k: string) => {
              try {
                (window as unknown as Record<string, Storage>)[k].setItem(
                  "probe",
                  "1",
                );
                return false;
              } catch {
                return true;
              }
            }, kind);
            check(
              `${label}: ${kind} throws in-page (positive control)`,
              storageThrows,
            );
            if (!storageThrows) {
              throw new Error(
                `${kind} block not installed; aborting to avoid a vacuous pass`,
              );
            }
          }

          // ——— The page rendered real content ———
          await guard.guarded(
            page.waitForSelector("h1, h2, [role='heading']", {
              timeout: 20000,
            }),
          );
          const bodyTextLen = await page.evaluate(
            () => document.body.innerText.trim().length,
          );
          check(
            `${label}: renders content (heading + body text)`,
            bodyTextLen > 100,
            `bodyTextLen=${bodyTextLen}`,
          );

          // ——— Still interactive: scrolling must not crash ———
          // Scroll events drive the scroll-memory eager-save path, which
          // touches sessionStorage on every event.
          await page.evaluate(() => {
            window.scrollTo(0, 400);
            window.dispatchEvent(new Event("scroll"));
          });
          await page.waitForTimeout(300);
          const aliveAfterScroll = await page.evaluate(() => 1 + 1);
          check(
            `${label}: JS still responsive after scrolling`,
            aliveAfterScroll === 2,
          );

          // ——— Still interactive: an in-app link click navigates ———
          // The scroll-memory click-capture handler saves to sessionStorage
          // on this click; if that throw escaped, navigation would break.
          const beforePath = await page.evaluate(
            () => window.location.pathname,
          );
          const clicked = await page.evaluate(() => {
            const anchors = Array.from(
              document.querySelectorAll<HTMLAnchorElement>("a[href]"),
            );
            const target = anchors.find(
              (a) =>
                a.origin === window.location.origin &&
                a.pathname !== window.location.pathname &&
                a.target !== "_blank" &&
                !a.pathname.match(/\.(ttl|rdf|jsonld|zip|pdf)$/) &&
                a.offsetParent !== null,
            );
            if (!target) return null;
            target.click();
            return target.pathname;
          });
          check(`${label}: found an in-app link to click`, clicked !== null);
          if (clicked !== null) {
            const navigated = await guard
              .guarded(
                page.waitForFunction(
                  (prev: string) => window.location.pathname !== prev,
                  beforePath,
                  { timeout: 15000 },
                ),
              )
              .then(() => true)
              .catch(() => false);
            check(
              `${label}: in-app link click navigates`,
              navigated,
              `to=${clicked}`,
            );

            // ——— Restore-on-back: Back re-renders the original page ———
            // This exercises the scroll-memory restore path (getItem throws).
            await page.goBack();
            const restored = await guard
              .guarded(
                page.waitForFunction(
                  (prev: string) => window.location.pathname === prev,
                  beforePath,
                  { timeout: 15000 },
                ),
              )
              .then(() => true)
              .catch(() => false);
            check(`${label}: Back returns and page re-renders`, restored);
            await guard.guarded(
              page.waitForSelector("h1, h2, [role='heading']", {
                timeout: 15000,
              }),
            );
          }

          // ——— No uncaught in-page errors during any of the above ———
          const errs = guard.failures();
          check(
            `${label}: no uncaught in-page errors / load failures`,
            errs.length === 0,
            errs.join(" | "),
          );
        } catch (err) {
          failures++;
          console.error(`  FAIL: ${label}: ${(err as Error).message}`);
        } finally {
          await page.close();
        }
      }
      await context.close();
    }
  } finally {
    await browser.close();
  }
}

main().then(
  () => {
    if (failures > 0) {
      console.error(`\ne2e-storage-blocked-sweep: ${failures} check(s) failed`);
      process.exit(1);
    }
    console.log("\ne2e-storage-blocked-sweep: all checks passed");
  },
  (err) => {
    console.error(err);
    process.exit(1);
  },
);
