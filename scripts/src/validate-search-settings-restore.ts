/// <reference lib="dom" />
// Guards the /search "?mode= / ?k=" settings contract: the Search page
// encodes not just ?q= but also the method (?mode=) and result count (?k=)
// into the address (handleSearch in search.tsx), so a shared link or a
// refresh reproduces the SAME results the sender saw. The sibling
// validate-search-q-handoff pins only the ?q= contract; this validator pins
// the settings:
//
// Scenarios:
// 1. Positive control: a default search (hybrid, 10) executes, the request
//    body carries mode=hybrid/topK=10, and the address stays CLEAN of
//    ?mode=/?k= (defaults are elided, keeping links tidy).
// 2. Submitting with a non-default method (dense) and count (20) lands
//    ?mode=dense&k=20 in the address, and the POST body carries them.
// 3. Reloading that address restores the same settings in the controls
//    (Method/Results selects) AND re-executes the request with the same
//    mode/topK in the POST body — never falling back to hybrid/10.
// 4. Opening the shared link fresh (direct goto, no history) does the same.
// 5. An invalid ?mode=/?k= in the URL falls back safely to hybrid/10.
// 6. Browser Back/Forward restores the settings too (onPopState in
//    search.tsx): search 1 with defaults, search 2 with dense/20, Back
//    restores hybrid/10 in the controls, URL, and active results, Forward
//    restores dense/20. Note: react-query caches results with
//    staleTime: Infinity, so Back/Forward may serve the restored settings'
//    results from cache instead of re-POSTing; the scenario asserts the
//    rendered results echo the restored settings (data that provably came
//    from a recorded POST with that body) and that ANY request fired after
//    Back/Forward carries the restored settings, never a mismatched body.
//
// The /api/search endpoint is mocked; every POST body is recorded so the
// executed request's mode/topK can be asserted directly.
//
// Requirements: the web workflow must be running (default
// http://localhost:80) and a Chromium headless shell installed for
// playwright-core.

import "./lib/playwright-browsers-path";

const { chromium } = await import("playwright-core");
import type { Page } from "playwright-core";

const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:80";
const QUERY = "settings restore marker six seventy six";

let failures = 0;
function check(label: string, ok: boolean, detail?: string) {
  if (ok) {
    console.log(`  ok: ${label}`);
  } else {
    failures++;
    console.error(`  FAIL: ${label}${detail ? ` (${detail})` : ""}`);
  }
}

type SearchBody = { query?: string; mode?: string; topK?: number };
const requests: SearchBody[] = [];

// Mock /api/search and record every POST body. The response echoes the
// requested mode+topK in the "mode" field the page renders (`Mode: ...`),
// so a distinct marker also appears on screen per settings combination.
async function mockSearch(page: Page) {
  await page.route("**/api/search", async (route) => {
    let body: SearchBody = {};
    try {
      body = route.request().postDataJSON() as SearchBody;
    } catch {
      // keep empty body
    }
    requests.push(body);
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        hits: [],
        mode: `ECHO-${body.mode}-K${body.topK}`,
      }),
    });
  });
}

async function waitForEcho(page: Page, mode: string, k: number) {
  return page
    .getByText(`ECHO-${mode}-K${k}`)
    .first()
    .waitFor({ state: "visible", timeout: 15000 })
    .then(
      () => true,
      () => false,
    );
}

function lastRequest(): SearchBody | undefined {
  return requests[requests.length - 1];
}

async function triggerText(page: Page, id: string): Promise<string> {
  return page
    .locator(`#${id}`)
    .innerText()
    .catch(() => "<trigger not found>");
}

// Pick an option in a Radix Select by visible label.
async function pickOption(
  page: Page,
  triggerId: string,
  optionText: string | RegExp,
) {
  await page.locator(`#${triggerId}`).click();
  await page
    .getByRole("option", { name: optionText })
    .first()
    .click({ timeout: 10000 });
}

async function submitQuery(page: Page) {
  const input = page.locator('input[aria-label="Search the corpus"]');
  await input.fill(QUERY);
  await input.press("Enter");
}

function urlParams(page: Page) {
  return new URL(page.url()).searchParams;
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({
      viewport: { width: 1400, height: 900 },
    });
    await mockSearch(page);

    console.log(
      "Scenario 1: positive control — default search keeps the address clean and sends hybrid/10",
    );
    await page.goto(`${BASE_URL}/search`, { waitUntil: "networkidle" });
    await submitQuery(page);
    check(
      "default search executes (echo renders)",
      await waitForEcho(page, "hybrid", 10),
    );
    let body = lastRequest();
    check(
      "default POST body carries mode=hybrid, topK=10",
      body?.mode === "hybrid" && body?.topK === 10,
      JSON.stringify(body),
    );
    check(
      "defaults are elided from the address (no ?mode=/?k=)",
      !urlParams(page).has("mode") && !urlParams(page).has("k"),
      page.url(),
    );

    console.log(
      "Scenario 2: non-default settings land in the address and the request",
    );
    await pickOption(page, "mode", /Dense/i);
    await pickOption(page, "topK", "20");
    await submitQuery(page);
    check(
      "dense/20 search executes (echo renders)",
      await waitForEcho(page, "dense", 20),
    );
    body = lastRequest();
    check(
      "POST body carries mode=dense, topK=20",
      body?.mode === "dense" && body?.topK === 20,
      JSON.stringify(body),
    );
    check(
      "address carries ?mode=dense",
      urlParams(page).get("mode") === "dense",
      page.url(),
    );
    check(
      "address carries ?k=20",
      urlParams(page).get("k") === "20",
      page.url(),
    );
    const sharedUrl = page.url();

    console.log(
      "Scenario 3: refresh restores the same settings in controls and request",
    );
    requests.length = 0;
    await page.reload({ waitUntil: "networkidle" });
    check(
      "after refresh: dense/20 re-executes from the URL (echo renders)",
      await waitForEcho(page, "dense", 20),
    );
    body = lastRequest();
    check(
      "after refresh: POST body still mode=dense, topK=20 (no fallback to defaults)",
      body?.mode === "dense" && body?.topK === 20,
      JSON.stringify(body),
    );
    check(
      "after refresh: Method control shows Dense",
      /dense/i.test(await triggerText(page, "mode")),
      await triggerText(page, "mode"),
    );
    check(
      "after refresh: Results control shows 20",
      (await triggerText(page, "topK")).trim() === "20",
      await triggerText(page, "topK"),
    );
    check(
      "after refresh: address still carries ?mode=dense&k=20",
      urlParams(page).get("mode") === "dense" &&
        urlParams(page).get("k") === "20",
      page.url(),
    );

    console.log(
      "Scenario 4: opening the shared link fresh restores settings too",
    );
    requests.length = 0;
    const fresh = await browser.newPage({
      viewport: { width: 1400, height: 900 },
    });
    await mockSearch(fresh);
    await fresh.goto(sharedUrl, { waitUntil: "networkidle" });
    check(
      "shared link: dense/20 executes (echo renders)",
      await waitForEcho(fresh, "dense", 20),
    );
    body = lastRequest();
    check(
      "shared link: POST body carries mode=dense, topK=20",
      body?.mode === "dense" && body?.topK === 20,
      JSON.stringify(body),
    );
    check(
      "shared link: Method control shows Dense",
      /dense/i.test(await triggerText(fresh, "mode")),
      await triggerText(fresh, "mode"),
    );
    check(
      "shared link: Results control shows 20",
      (await triggerText(fresh, "topK")).trim() === "20",
      await triggerText(fresh, "topK"),
    );
    await fresh.close();

    console.log(
      "Scenario 5: invalid ?mode=/?k= fall back safely to hybrid/10",
    );
    requests.length = 0;
    const bad = await browser.newPage({
      viewport: { width: 1400, height: 900 },
    });
    await mockSearch(bad);
    await bad.goto(
      `${BASE_URL}/search?q=${encodeURIComponent(QUERY)}&mode=bogus&k=999`,
      { waitUntil: "networkidle" },
    );
    check(
      "invalid params: search still executes with hybrid/10",
      await waitForEcho(bad, "hybrid", 10),
    );
    body = lastRequest();
    check(
      "invalid params: POST body falls back to mode=hybrid, topK=10",
      body?.mode === "hybrid" && body?.topK === 10,
      JSON.stringify(body),
    );
    await bad.close();

    console.log(
      "Scenario 6: Back/Forward restores the Search method and result-count settings",
    );
    requests.length = 0;
    const nav = await browser.newPage({
      viewport: { width: 1400, height: 900 },
    });
    await mockSearch(nav);
    await nav.goto(`${BASE_URL}/search`, { waitUntil: "networkidle" });

    // Search 1: defaults (hybrid/10).
    await submitQuery(nav);
    check(
      "back/forward setup: default search executes (echo renders)",
      await waitForEcho(nav, "hybrid", 10),
    );
    body = lastRequest();
    check(
      "back/forward setup: search 1 POST body carries mode=hybrid, topK=10",
      body?.mode === "hybrid" && body?.topK === 10,
      JSON.stringify(body),
    );

    // Search 2: dense/20 — pushes a second history entry with ?mode=&k=.
    await pickOption(nav, "mode", /Dense/i);
    await pickOption(nav, "topK", "20");
    await submitQuery(nav);
    check(
      "back/forward setup: dense/20 search executes (echo renders)",
      await waitForEcho(nav, "dense", 20),
    );
    body = lastRequest();
    check(
      "back/forward setup: search 2 POST body carries mode=dense, topK=20",
      body?.mode === "dense" && body?.topK === 20,
      JSON.stringify(body),
    );

    // Back → search 1's settings (hybrid/10) must come back everywhere.
    let requestsBefore = requests.length;
    await nav.goBack();
    check(
      "after Back: hybrid/10 results are active again (echo renders)",
      await waitForEcho(nav, "hybrid", 10),
    );
    check(
      "after Back: Method control shows Hybrid",
      /hybrid/i.test(await triggerText(nav, "mode")),
      await triggerText(nav, "mode"),
    );
    check(
      "after Back: Results control shows 10",
      (await triggerText(nav, "topK")).trim() === "10",
      await triggerText(nav, "topK"),
    );
    check(
      "after Back: address is clean of ?mode=/?k= (defaults elided)",
      !urlParams(nav).has("mode") && !urlParams(nav).has("k"),
      nav.url(),
    );
    let newBodies = requests.slice(requestsBefore);
    check(
      "after Back: every executed POST carries mode=hybrid, topK=10 (none mismatched)",
      newBodies.every((b) => b.mode === "hybrid" && b.topK === 10),
      JSON.stringify(newBodies),
    );

    // Forward → search 2's settings (dense/20) must come back everywhere.
    requestsBefore = requests.length;
    await nav.goForward();
    check(
      "after Forward: dense/20 results are active again (echo renders)",
      await waitForEcho(nav, "dense", 20),
    );
    check(
      "after Forward: Method control shows Dense",
      /dense/i.test(await triggerText(nav, "mode")),
      await triggerText(nav, "mode"),
    );
    check(
      "after Forward: Results control shows 20",
      (await triggerText(nav, "topK")).trim() === "20",
      await triggerText(nav, "topK"),
    );
    check(
      "after Forward: address carries ?mode=dense&k=20",
      urlParams(nav).get("mode") === "dense" &&
        urlParams(nav).get("k") === "20",
      nav.url(),
    );
    newBodies = requests.slice(requestsBefore);
    check(
      "after Forward: every executed POST carries mode=dense, topK=20 (none mismatched)",
      newBodies.every((b) => b.mode === "dense" && b.topK === 20),
      JSON.stringify(newBodies),
    );
    await nav.close();

    await page.close();
  } finally {
    await browser.close();
  }

  if (failures > 0) {
    console.error(
      `\nvalidate-search-settings-restore: ${failures} check(s) failed`,
    );
    process.exit(1);
  }
  console.log("\nvalidate-search-settings-restore: all checks passed");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
