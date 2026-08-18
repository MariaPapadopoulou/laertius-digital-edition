/// <reference lib="dom" />
// Guards the /search "?q= handoff" contract against a stale query
// resurrecting over a newer one:
//
// The homepage header search box hands its query to /search via ?q=
// (submitHeaderSearch in home.tsx). Unlike /ask — which consumes ?q= once
// and strips it — the Search page INTENTIONALLY keeps ?q= in the address so
// result pages are shareable links, and every new in-page search pushes a
// fresh history entry with its own ?q=. This validator pins that contract:
//
// Scenarios:
// 1. Handoff works: submitting query A in the homepage header box lands on
//    /search, A auto-executes (its results render — the positive control
//    proving the probes can see A when present), and ?q=A stays in the
//    address (the shareable-link contract).
// 2. Running a newer search B updates the address to ?q=B and renders B's
//    results, with no trace of stale A (not in the input, not in results).
// 3. Refreshing must restore B — the newer search — never resurrect A: the
//    address must still say ?q=B and B's results (not A's) must render.
// 4. Back must return to the ?q=A history entry and re-execute A (each
//    search owns its own shareable history entry); forward must restore B
//    with no trace of A.
//
// The /api/search endpoint is mocked per-query so the check is fast,
// deterministic, and can tell exactly whose results are on screen.
//
// Requirements: the web workflow must be running (the script talks to the
// shared proxy, default http://localhost:80), and a Chromium headless shell
// must be installed for playwright-core, e.g.:
//   PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright \
//     node scripts/node_modules/playwright-core/cli.js install chromium-headless-shell

// playwright-core resolves its browser registry at module import time from
// PLAYWRIGHT_BROWSERS_PATH; set it BEFORE importing playwright-core.
import "./lib/playwright-browsers-path";

const { chromium } = await import("playwright-core");
import type { Page } from "playwright-core";

const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:80";

const QUERY_A = "handoff marker alpha six twenty five";
const QUERY_B = "newer search beta six twenty five";
const MODE_A = "MODE-MARKER-ALPHA-625";
const MODE_B = "MODE-MARKER-BETA-625";

let failures = 0;
function check(label: string, ok: boolean, detail?: string) {
  if (ok) {
    console.log(`  ok: ${label}`);
  } else {
    failures++;
    console.error(`  FAIL: ${label}${detail ? ` (${detail})` : ""}`);
  }
}

// Mock the search endpoint: reply with zero hits but a distinct "mode"
// marker per query. The Search page renders `Mode: {data.mode}` in the
// results status bar, so the marker tells exactly whose results are on
// screen. Survives reloads and navigations (page.route is page-scoped).
async function mockSearch(page: Page) {
  await page.route("**/api/search", async (route) => {
    let query = "";
    try {
      query =
        (route.request().postDataJSON() as { query?: string }).query ?? "";
    } catch {
      // fall through with empty query
    }
    const mode = query.includes("alpha")
      ? MODE_A
      : query.includes("beta")
        ? MODE_B
        : `MODE-FOR:${query}`;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ hits: [], mode }),
    });
  });
}

async function searchInputValue(page: Page): Promise<string> {
  return page
    .locator('input[aria-label="Search the corpus"]')
    .first()
    .inputValue()
    .catch(() => "<input not found>");
}

// True when any trace of query A is present: ?q=A in the address, A in the
// search input, or A's mocked results marker rendered on the page.
async function traceOfA(page: Page): Promise<string[]> {
  const traces: string[] = [];
  if (new URL(page.url()).searchParams.get("q") === QUERY_A)
    traces.push("?q=A in URL");
  if ((await searchInputValue(page)) === QUERY_A) traces.push("A in input");
  if ((await page.getByText(MODE_A).count().catch(() => 0)) > 0)
    traces.push("A's results rendered");
  return traces;
}

async function waitForMarker(page: Page, marker: string): Promise<boolean> {
  return page
    .getByText(marker)
    .first()
    .waitFor({ state: "visible", timeout: 15000 })
    .then(
      () => true,
      () => false,
    );
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({
      viewport: { width: 1400, height: 900 },
    });
    await mockSearch(page);

    console.log(
      "Scenario 1: homepage header handoff auto-executes A and keeps ?q=A (shareable link)",
    );
    await page.goto(`${BASE_URL}/`, { waitUntil: "networkidle" });
    const headerInput = page.locator(
      'input[aria-label="Search the edition"]',
    );
    check(
      "homepage header search box is present",
      (await headerInput.count().catch(() => 0)) > 0,
    );
    await headerInput.fill(QUERY_A);
    await headerInput.press("Enter");
    await page.waitForURL(/\/search/, { timeout: 15000 });
    check(
      "submitting the header box navigates to /search",
      page.url().includes("/search"),
    );

    // Positive control: A's mocked results marker must render — proving the
    // handoff auto-executed AND that the later "no trace of A" probes can
    // see A when it IS present.
    check(
      "positive control: handed-over query A auto-executes (results render)",
      await waitForMarker(page, MODE_A),
    );
    check(
      "search input carries A after the handoff",
      (await searchInputValue(page)) === QUERY_A,
      `input="${await searchInputValue(page)}"`,
    );
    check(
      "shareable-link contract: ?q=A stays in the address",
      new URL(page.url()).searchParams.get("q") === QUERY_A,
      `url=${page.url()}`,
    );

    console.log(
      "Scenario 2: newer search B updates the address and shows B's results",
    );
    const input = page.locator('input[aria-label="Search the corpus"]');
    await input.fill(QUERY_B);
    await input.press("Enter");
    check("newer search B executes (results render)", await waitForMarker(page, MODE_B));
    check(
      "address updates to ?q=B after the newer search",
      new URL(page.url()).searchParams.get("q") === QUERY_B,
      `url=${page.url()}`,
    );
    let traces = await traceOfA(page);
    check(
      "no trace of stale query A after searching B",
      traces.length === 0,
      traces.join("; "),
    );

    console.log("Scenario 3: refresh — the NEWER search B must restore, not A");
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForSelector("h1", { timeout: 15000 });
    check(
      "after refresh: address still carries ?q=B",
      new URL(page.url()).searchParams.get("q") === QUERY_B,
      `url=${page.url()}`,
    );
    check(
      "after refresh: B's results re-execute from the URL",
      await waitForMarker(page, MODE_B),
    );
    traces = await traceOfA(page);
    check(
      "after refresh: stale query A does not resurrect",
      traces.length === 0,
      traces.join("; "),
    );

    console.log(
      "Scenario 4: back restores A's own entry; forward restores B without A",
    );
    await page.goBack({ waitUntil: "networkidle" }).catch(() => null);
    check(
      "after back: address returns to the ?q=A history entry",
      new URL(page.url()).searchParams.get("q") === QUERY_A,
      `url=${page.url()}`,
    );
    check(
      "after back: A's entry re-executes its own search",
      await waitForMarker(page, MODE_A),
    );

    await page.goForward({ waitUntil: "networkidle" }).catch(() => null);
    check(
      "after forward: address returns to ?q=B",
      new URL(page.url()).searchParams.get("q") === QUERY_B,
      `url=${page.url()}`,
    );
    check(
      "after forward: B's results re-render",
      await waitForMarker(page, MODE_B),
    );
    await page.waitForTimeout(500);
    traces = await traceOfA(page);
    check(
      "after forward: no trace of stale query A",
      traces.length === 0,
      traces.join("; "),
    );

    await page.close();
  } finally {
    await browser.close();
  }

  if (failures > 0) {
    console.error(`\nvalidate-search-q-handoff: ${failures} check(s) failed`);
    process.exit(1);
  }
  console.log("\nvalidate-search-q-handoff: all checks passed");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
