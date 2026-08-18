/// <reference lib="dom" />
/* Real-browser check: the homepage's two query boxes hand their query
 * off to the right page with the value intact.
 *
 * home.tsx submits via navigate() (submitHeaderSearch / submitAsk), so
 * the static validate-home-links pins only the literal route prefixes.
 * A regression in the handlers — dropped encodeURIComponent, swapped
 * targets, a broken trim — would ship silently. This script types a
 * query containing characters that REQUIRE URL-encoding into each box,
 * submits, and asserts:
 *
 * 1. Header search → SPA-navigates to /search?q=<encoded>; the URL
 *    keeps ?q= and the Search page adopts the query (input populated,
 *    search submitted).
 * 2. Sidebar "Ask Laertius" → SPA-navigates to /ask?q=<encoded>. The
 *    Ask page consumes ?q= immediately (replaceState strips it), so
 *    history.pushState is instrumented before submit to capture the
 *    minted URL; afterwards the Ask page must show the question in its
 *    own input (i.e. it picked the handoff up) with ?q consumed.
 * 3. Empty submits land on the bare /search and /ask routes with no
 *    dangling ?q=.
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

// The query deliberately contains '&', '?' and 'µ'-class characters plus
// polytonic Greek: if encodeURIComponent is ever dropped, '&' truncates
// the value and '?' corrupts the path, so the assertions below fail.
const QUERY = "Ζήνων & the Stoics? (100%)";

let failures = 0;
function check(label: string, ok: boolean, detail?: string) {
  if (ok) {
    console.log(`  ok: ${label}`);
  } else {
    failures++;
    console.error(`  FAIL: ${label}${detail ? ` (${detail})` : ""}`);
  }
}

type NavRecord = { method: string; url: string };

async function main() {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({
      viewport: { width: 1400, height: 900 },
    });
    // Fail fast with the failing URL/status instead of an opaque selector
    // timeout when the site itself fails to boot.
    const guard = attachPageGuard(page);

    const openHome = async () => {
      await page.goto(`${BASE_URL}/`, { waitUntil: "networkidle" });
      guard.assertPageLoaded();
      await guard.guarded(page.waitForSelector("h1", { timeout: 15000 }));
      // Record every SPA navigation the app mints so the /ask?q= URL is
      // observable even though the Ask page strips ?q immediately.
      await page.evaluate(() => {
        const w = window as unknown as { __navLog: NavRecord[] };
        w.__navLog = [];
        for (const method of ["pushState", "replaceState"] as const) {
          const orig = history[method].bind(history);
          history[method] = (data: unknown, title: string, url?: string | URL | null) => {
            w.__navLog.push({ method, url: String(url ?? "") });
            return orig(data, title, url as string);
          };
        }
      });
    };
    const navLog = () =>
      page.evaluate(() => (window as unknown as { __navLog: NavRecord[] }).__navLog);
    const basePrefix = async () => {
      const base = await page.evaluate(
        () => document.querySelector("base")?.getAttribute("href") ?? "/",
      );
      return base.replace(/\/$/, "");
    };
    const strippedPath = async (prefix: string) => {
      const p = await page.evaluate(() => window.location.pathname);
      return prefix && p.startsWith(prefix) ? p.slice(prefix.length) || "/" : p;
    };

    // ——— Scenario 1: header search box ———
    console.log("Scenario 1: header search box → /search?q=…");
    await openHome();
    const prefix = await basePrefix();
    await page.fill("input[aria-label='Search the edition']", QUERY);
    await page.press("input[aria-label='Search the edition']", "Enter");
    await guard.guarded(
      page.waitForSelector("input[aria-label='Search the corpus']", {
        timeout: 15000,
      }),
    );
    check(
      "URL path is /search",
      (await strippedPath(prefix)) === "/search",
      await page.evaluate(() => window.location.pathname),
    );
    const searchQ = await page.evaluate(
      () => new URLSearchParams(window.location.search).get("q"),
    );
    check("?q= carries the exact query", searchQ === QUERY, `q=${searchQ}`);
    // The minted URL itself must be properly encoded (raw '&'/'?' would
    // have split the param before the URL API ever decoded it).
    const searchNav = (await navLog()).find((n) => n.url.includes("/search?"));
    check(
      "navigate() minted an encoded /search?q= URL",
      !!searchNav && searchNav.url.includes(`q=${encodeURIComponent(QUERY)}`),
      searchNav?.url ?? "no /search? navigation recorded",
    );
    const searchInputVal = await page.inputValue(
      "input[aria-label='Search the corpus']",
    );
    check(
      "Search page adopts the query into its input",
      searchInputVal === QUERY,
      `input=${searchInputVal}`,
    );

    // ——— Scenario 2: sidebar Ask box ———
    console.log("Scenario 2: sidebar Ask box → /ask?q=…");
    await openHome();
    await page.fill("input[aria-label='Ask Laertius a question']", QUERY);
    await page.click("form button[type='submit']:has-text('Ask')");
    // Ask page consumes ?q via replaceState; wait until we are on /ask.
    await guard.guarded(
      page.waitForFunction(
        (pfx: string) => {
          const p = window.location.pathname;
          const s = pfx && p.startsWith(pfx) ? p.slice(pfx.length) || "/" : p;
          return s === "/ask";
        },
        prefix,
        { timeout: 15000 },
      ),
    );
    const askNavs = await navLog();
    const askPush = askNavs.find(
      (n) => n.method === "pushState" && n.url.includes("/ask"),
    );
    check(
      "navigate() minted an encoded /ask?q= URL",
      !!askPush && askPush.url.includes(`q=${encodeURIComponent(QUERY)}`),
      askPush?.url ?? "no /ask pushState recorded",
    );
    // The Ask page must have adopted the handoff: its own input shows the
    // question (query state is seeded from ?q) …
    const askInputVal = await page
      .waitForFunction(() => {
        const el = Array.from(
          document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(
            "input, textarea",
          ),
        ).find((i) => (i.value ?? "").length > 0);
        return el ? el.value : null;
      }, undefined, { timeout: 15000 })
      .then((h) => h.jsonValue() as Promise<string>)
      .catch(() => null);
    check(
      "Ask page adopts the question into its input",
      askInputVal === QUERY,
      `input=${askInputVal}`,
    );
    // … and consumed ?q from the URL (stale-query guard).
    const askSearch = await page.evaluate(() => window.location.search);
    check("Ask page consumed ?q from the URL", !askSearch.includes("q="), askSearch);

    // ——— Scenario 3: empty submits land on the bare routes ———
    console.log("Scenario 3: empty submits → bare /search and /ask");
    await openHome();
    await page.press("input[aria-label='Search the edition']", "Enter");
    await page.waitForSelector("input[aria-label='Search the corpus']", {
      timeout: 15000,
    });
    check(
      "empty header submit lands on /search with no ?q=",
      (await strippedPath(prefix)) === "/search" &&
        !(await page.evaluate(() => window.location.search)).includes("q="),
      await page.evaluate(() => window.location.href),
    );
    await openHome();
    await page.click("form button[type='submit']:has-text('Ask')");
    await page.waitForFunction(
      (pfx: string) => {
        const p = window.location.pathname;
        const s = pfx && p.startsWith(pfx) ? p.slice(pfx.length) || "/" : p;
        return s === "/ask";
      },
      prefix,
      { timeout: 15000 },
    );
    check(
      "empty Ask submit lands on /ask with no ?q=",
      !(await page.evaluate(() => window.location.search)).includes("q="),
      await page.evaluate(() => window.location.href),
    );

    await page.close();
  } finally {
    await browser.close();
  }

  if (failures > 0) {
    console.error(`\ne2e-home-search-handoff: ${failures} check(s) failed`);
    process.exit(1);
  }
  console.log("\ne2e-home-search-handoff: all checks passed");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
