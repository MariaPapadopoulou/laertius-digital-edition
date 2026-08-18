/// <reference lib="dom" />
// The in-page callbacks (page.evaluate / waitForFunction) run in the
// browser, so this Node-side script needs the DOM lib for their types.
//
// Real-browser check of the Verses page filter dropdowns: the source-level
// validate-verses pins listVerses outcomes, but nothing there proves the
// page's UI wiring — that picking a poet, a type, or a book in the Radix
// Select dropdowns updates the URL, calls /api/verses with the right query
// params, and renders the filtered rows. A frontend regression (wrong param
// name, stale query key, a Select that stops firing onValueChange) would
// pass the source-level pins while readers see the wrong verses.
//
// Scenarios (pinned against the curated verse-authors layer; update the
// PIN_* constants if the curation changes):
//
// Scenarios 1-4 cover narrowing and cold deep links; scenarios 5-8 cover the
// reverse path — resetting each dropdown back to its "All" default must drop
// the param from the URL, call /api/verses WITHOUT that param, and re-render
// the full unfiltered result set (a regression in the "delete param when
// value === default" branch of the URL-sync effect would strand readers on a
// filtered view whose dropdowns claim "All"). Scenarios 9-10 cover the two
// remaining filter surfaces: the Philosopher dropdown (select + reset to
// "All philosophers") and the debounced keyword box (type → ?q= narrows,
// clear → ?q= drops and the full list returns).
// 1. Selecting poet "Plato" must set ?author=Plato, fire
//    /api/verses?author=Plato, and render exactly the 11 pinned Plato
//    verses (asserted by the D.L. section headings, in order).
// 2. With Plato still selected, picking Type "Epigrams" must add
//    &genre=epigram and narrow to the 9 pinned epigram rows.
// 3. On a fresh load, selecting poet "Empedocles" then "Book 9" must send
//    author=Empedocles&book=9 and render the 2 pinned rows, and the visible
//    count line must agree ("2 verses").
// 4. Reloading the scenario-3 URL cold (deep link) must restore both
//    dropdown labels and the same rows, so the URL-seeding path is covered
//    too, not just in-place changes.
//
// Requirements: the API server and web workflows must be running (the script
// talks to the shared proxy, default http://localhost:80), and a Chromium
// headless shell must be installed for playwright-core, e.g.:
//   PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright \
//     node scripts/node_modules/playwright-core/cli.js install chromium-headless-shell

// playwright-core resolves its browser registry at module import time from
// PLAYWRIGHT_BROWSERS_PATH (default: $XDG_CACHE_HOME/ms-playwright, which in
// this environment points inside the workspace and holds no browsers). Set
// the env var BEFORE importing playwright-core, picking whichever candidate
// actually contains a chromium install.
import "./lib/playwright-browsers-path";
import { CARD_HEADING_SELECTOR } from "./lib/card-headings";

const { chromium } = await import("playwright-core");
const { attachPageGuard } = await import("./lib/e2e-page-guard");
import type { Page } from "playwright-core";

const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:80";

// Pinned expectations, mirrored from the curated verse-authors layer via
// GET /api/verses (each verse id is `<sectionId>#<n>`; cards render the
// section id as their "D.L. x.y.z" heading, so we assert the heading
// sequence derived from the pinned ids).
const PIN_PLATO_IDS = [
  "3.1.29#0",
  "3.1.29#1",
  "3.1.30#0",
  "3.1.31#0",
  "3.1.31#1",
  "3.1.32#0",
  "3.1.32#1",
  "3.1.32#2",
  "3.1.33#0",
  "3.1.33#1",
  "3.1.33#2",
];
const PIN_PLATO_EPIGRAM_IDS = [
  "3.1.30#0",
  "3.1.31#0",
  "3.1.31#1",
  "3.1.32#0",
  "3.1.32#1",
  "3.1.32#2",
  "3.1.33#0",
  "3.1.33#1",
  "3.1.33#2",
];
const PIN_EMPEDOCLES_BOOK9_IDS = ["9.11.73#1", "9.11.73#2"];

const headingsFor = (ids: string[]) =>
  ids.map((id) => `D.L. ${id.split("#")[0]}`);

let failures = 0;
function check(label: string, ok: boolean, detail?: string) {
  if (ok) {
    console.log(`  ok: ${label}`);
  } else {
    failures++;
    console.error(`  FAIL: ${label}${detail ? ` (${detail})` : ""}`);
  }
}

// Open a Radix Select by its trigger id and click the option whose label
// starts with the given text (poet options carry a " (count)" suffix).
async function pickOption(page: Page, triggerId: string, optionText: string) {
  await page.click(`button#${triggerId}`);
  const option = page
    .locator('[role="option"]')
    .filter({ hasText: optionText })
    .first();
  await option.waitFor({ state: "visible", timeout: 5000 });
  await option.click();
  // Radix closes the listbox on selection; wait so a follow-up open works.
  await page
    .locator('[role="listbox"]')
    .waitFor({ state: "detached", timeout: 5000 })
    .catch(() => {});
}

// The rendered card headings ("D.L. x.y.z"), in document order.
const cardHeadings = (page: Page) =>
  page.evaluate(
    (cardHeadingSel) =>
      Array.from(document.querySelectorAll(cardHeadingSel))
        .map((h) => h.textContent?.trim() ?? "")
        .filter((t) => t.startsWith("D.L. ")),
    CARD_HEADING_SELECTOR,
  );

async function waitForHeadings(page: Page, expected: string[]) {
  await page
    .waitForFunction(
      ([want, cardHeadingSel]) => {
        const got = Array.from(document.querySelectorAll(cardHeadingSel))
          .map((h) => h.textContent?.trim() ?? "")
          .filter((t) => t.startsWith("D.L. "));
        return (
          got.length === want.length && got.every((t, i) => t === want[i])
        );
      },
      [expected, CARD_HEADING_SELECTOR] as const,
      { timeout: 10000 },
    )
    .catch(() => {});
}

// Wait until the rendered card count settles at the expected number.
async function waitForRowCount(page: Page, expected: number) {
  await page
    .waitForFunction(
      ([want, cardHeadingSel]) =>
        Array.from(document.querySelectorAll(cardHeadingSel)).filter((h) =>
          (h.textContent?.trim() ?? "").startsWith("D.L. "),
        ).length === want,
      [expected, CARD_HEADING_SELECTOR] as const,
      { timeout: 10000 },
    )
    .catch(() => {});
}

async function main() {
  // The unfiltered total, straight from the API — the reset scenarios must
  // widen the list back to exactly this many rows.
  const totalRes = await fetch(`${BASE_URL}/api/verses`);
  if (!totalRes.ok) {
    console.error(
      `e2e-verses-filters: GET ${BASE_URL}/api/verses returned ${totalRes.status} — is the API server workflow running?`,
    );
    process.exit(1);
  }
  const unfilteredTotal = ((await totalRes.json()) as unknown[]).length;
  if (!Number.isInteger(unfilteredTotal) || unfilteredTotal <= 0) {
    console.error(
      `e2e-verses-filters: could not read the unfiltered total from ${BASE_URL}/api/verses`,
    );
    process.exit(1);
  }

  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({
      viewport: { width: 1280, height: 900 },
    });
    // Fail fast with the failing URL/status instead of an opaque selector
    // timeout when the site itself fails to boot.
    const guard = attachPageGuard(page);

    // Record every /api/verses request the page fires so we can assert the
    // exact query params the dropdowns produce.
    const apiCalls: string[] = [];
    page.on("request", (req) => {
      const url = req.url();
      if (url.includes("/api/verses")) apiCalls.push(url);
    });
    const lastCallParams = () => {
      const last = apiCalls[apiCalls.length - 1];
      return last ? new URL(last).searchParams : new URLSearchParams();
    };

    console.log("Scenario 1: picking poet Plato filters rows + URL + API");
    await page.goto(`${BASE_URL}/verses`, { waitUntil: "networkidle" });
    guard.assertPageLoaded();
    // The poet dropdown is populated from the unfiltered list; wait for it.
    await guard.guarded(page.waitForSelector("button#author"));

    apiCalls.length = 0;
    await pickOption(page, "author", "Plato (");
    await page.waitForFunction(
      () =>
        new URLSearchParams(window.location.search).get("author") === "Plato",
      undefined,
      { timeout: 5000 },
    );
    check("URL gains ?author=Plato", true);
    await waitForHeadings(page, headingsFor(PIN_PLATO_IDS));
    await page.waitForLoadState("networkidle");

    const platoCall = apiCalls.find((u) =>
      new URL(u).searchParams.get("author") === "Plato",
    );
    check(
      "/api/verses is called with author=Plato",
      !!platoCall,
      `calls=${JSON.stringify(apiCalls)}`,
    );
    if (platoCall) {
      const params = new URL(platoCall).searchParams;
      check(
        "author=Plato call carries no stray filter params",
        !params.has("genre") && !params.has("book") && !params.has("q"),
        `params=${params.toString()}`,
      );
    }
    const platoHeadings = await cardHeadings(page);
    check(
      `renders the ${PIN_PLATO_IDS.length} pinned Plato rows in order`,
      JSON.stringify(platoHeadings) ===
        JSON.stringify(headingsFor(PIN_PLATO_IDS)),
      `got=${JSON.stringify(platoHeadings)}`,
    );

    console.log("Scenario 2: adding Type=Epigrams narrows to the pinned 9");
    apiCalls.length = 0;
    await pickOption(page, "genre", "Epigrams");
    await page.waitForFunction(
      () =>
        new URLSearchParams(window.location.search).get("genre") ===
          "epigram" &&
        new URLSearchParams(window.location.search).get("author") === "Plato",
      undefined,
      { timeout: 5000 },
    );
    check("URL keeps author=Plato and gains genre=epigram", true);
    await waitForHeadings(page, headingsFor(PIN_PLATO_EPIGRAM_IDS));
    await page.waitForLoadState("networkidle");

    const epigramParams = lastCallParams();
    check(
      "/api/verses is called with author=Plato&genre=epigram",
      epigramParams.get("author") === "Plato" &&
        epigramParams.get("genre") === "epigram",
      `params=${epigramParams.toString()}`,
    );
    const epigramHeadings = await cardHeadings(page);
    check(
      `renders the ${PIN_PLATO_EPIGRAM_IDS.length} pinned Plato epigrams`,
      JSON.stringify(epigramHeadings) ===
        JSON.stringify(headingsFor(PIN_PLATO_EPIGRAM_IDS)),
      `got=${JSON.stringify(epigramHeadings)}`,
    );
    // Every surviving card must actually show its Epigram badge.
    const epigramBadges = await page.evaluate(
      () =>
        Array.from(document.querySelectorAll("span")).filter(
          (s) => s.textContent?.trim() === "Epigram",
        ).length,
    );
    check(
      "each filtered card shows the Epigram badge",
      epigramBadges === PIN_PLATO_EPIGRAM_IDS.length,
      `badges=${epigramBadges}`,
    );

    console.log(
      "Scenario 3: poet Empedocles + Book 9 sends both params, renders pinned 2",
    );
    await page.goto(`${BASE_URL}/verses`, { waitUntil: "networkidle" });
    guard.assertPageLoaded();
    await guard.guarded(page.waitForSelector("button#author"));
    await pickOption(page, "author", "Empedocles (");
    await page.waitForFunction(
      () =>
        new URLSearchParams(window.location.search).get("author") ===
        "Empedocles",
      undefined,
      { timeout: 5000 },
    );
    apiCalls.length = 0;
    await pickOption(page, "book", "Book 9");
    await page.waitForFunction(
      () => new URLSearchParams(window.location.search).get("book") === "9",
      undefined,
      { timeout: 5000 },
    );
    check("URL gains book=9 alongside author=Empedocles", true);
    await waitForHeadings(page, headingsFor(PIN_EMPEDOCLES_BOOK9_IDS));
    await page.waitForLoadState("networkidle");

    const bookParams = lastCallParams();
    check(
      "/api/verses is called with author=Empedocles&book=9",
      bookParams.get("author") === "Empedocles" &&
        bookParams.get("book") === "9",
      `params=${bookParams.toString()}`,
    );
    const bookHeadings = await cardHeadings(page);
    check(
      "renders the 2 pinned Empedocles Book-9 rows",
      JSON.stringify(bookHeadings) ===
        JSON.stringify(headingsFor(PIN_EMPEDOCLES_BOOK9_IDS)),
      `got=${JSON.stringify(bookHeadings)}`,
    );
    const countLine = await page.evaluate(
      () =>
        Array.from(document.querySelectorAll("span")).find((s) =>
          /^\d+ verses$/.test(s.textContent?.trim() ?? ""),
        )?.textContent?.trim() ?? null,
    );
    check(
      'the visible count line reads "2 verses"',
      countLine === "2 verses",
      `count=${JSON.stringify(countLine)}`,
    );

    console.log(
      "Scenario 4: deep-linking the same URL cold restores dropdowns + rows",
    );
    await page.goto(`${BASE_URL}/verses?author=Empedocles&book=9`, {
      waitUntil: "networkidle",
    });
    guard.assertPageLoaded();
    await guard.guarded(page.waitForSelector("button#author"));
    await waitForHeadings(page, headingsFor(PIN_EMPEDOCLES_BOOK9_IDS));
    const deepState = await page.evaluate(() => ({
      author:
        document.querySelector("button#author")?.textContent?.trim() ?? null,
      book: document.querySelector("button#book")?.textContent?.trim() ?? null,
    }));
    check(
      "poet dropdown shows Empedocles after a cold load",
      // The trigger renders the selected item's label, which carries the
      // "(count)" suffix from the option list.
      (deepState.author ?? "").startsWith("Empedocles ("),
      `label=${JSON.stringify(deepState.author)}`,
    );
    check(
      "book dropdown shows Book 9 after a cold load",
      deepState.book === "Book 9",
      `label=${JSON.stringify(deepState.book)}`,
    );
    const deepHeadings = await cardHeadings(page);
    check(
      "deep link renders the same 2 pinned rows",
      JSON.stringify(deepHeadings) ===
        JSON.stringify(headingsFor(PIN_EMPEDOCLES_BOOK9_IDS)),
      `got=${JSON.stringify(deepHeadings)}`,
    );

    // Shared assertions for the reset scenarios: after resetting `param`
    // back to its default, the URL must lose the param, the widened list
    // must come from a no-filter /api/verses response (the page fetches the
    // unfiltered list at load for the facet dropdowns, so react-query serves
    // the reset from that cache rather than refetching — the call may
    // predate the reset, but no call AFTER the reset may still carry the
    // param), and the row count must return to the unfiltered total.
    // `sinceIndex` marks apiCalls.length at the moment of the reset click.
    const assertWidened = async (
      label: string,
      param: string,
      sinceIndex: number,
    ) => {
      await page
        .waitForFunction(
          (p) => !new URLSearchParams(window.location.search).has(p),
          param,
          { timeout: 5000 },
        )
        .catch(() => {});
      const urlParams = await page.evaluate(() => window.location.search);
      check(
        `${label}: ?${param}= is dropped from the URL`,
        !new URLSearchParams(urlParams).has(param),
        `search=${urlParams}`,
      );
      await waitForRowCount(page, unfilteredTotal);
      await page.waitForLoadState("networkidle");
      const noFilterCall = apiCalls.find((u) => {
        const p = new URL(u).searchParams;
        return (
          !p.has("author") && !p.has("genre") && !p.has("book") && !p.has("q")
        );
      });
      check(
        `${label}: the widened list is backed by a no-filter /api/verses call`,
        !!noFilterCall,
        `calls=${JSON.stringify(apiCalls)}`,
      );
      const stalePostReset = apiCalls
        .slice(sinceIndex)
        .filter((u) => new URL(u).searchParams.has(param));
      check(
        `${label}: no /api/verses call after the reset still carries ${param}`,
        stalePostReset.length === 0,
        `stale=${JSON.stringify(stalePostReset)}`,
      );
      const rows = await cardHeadings(page);
      check(
        `${label}: row count returns to the unfiltered total (${unfilteredTotal})`,
        rows.length === unfilteredTotal,
        `got=${rows.length}`,
      );
    };

    console.log(
      "Scenario 5: resetting poet back to 'All poets' widens the list again",
    );
    apiCalls.length = 0;
    await page.goto(`${BASE_URL}/verses`, { waitUntil: "networkidle" });
    guard.assertPageLoaded();
    await guard.guarded(page.waitForSelector("button#author"));
    await pickOption(page, "author", "Plato (");
    await waitForHeadings(page, headingsFor(PIN_PLATO_IDS));
    let sinceIndex = apiCalls.length;
    await pickOption(page, "author", "All poets");
    await assertWidened("poet reset", "author", sinceIndex);

    console.log("Scenario 6: resetting Book back to 'All' widens the list");
    apiCalls.length = 0;
    await page.goto(`${BASE_URL}/verses`, { waitUntil: "networkidle" });
    guard.assertPageLoaded();
    await guard.guarded(page.waitForSelector("button#author"));
    await pickOption(page, "book", "Book 9");
    await page.waitForFunction(
      () => new URLSearchParams(window.location.search).get("book") === "9",
      undefined,
      { timeout: 5000 },
    );
    await page.waitForLoadState("networkidle");
    sinceIndex = apiCalls.length;
    // The book listbox's reset option is the bare "All" entry (every other
    // option starts with "Book "), so match it exactly.
    await page.click("button#book");
    const allBookOption = page
      .locator('[role="option"]')
      .filter({ hasText: /^All$/ })
      .first();
    await allBookOption.waitFor({ state: "visible", timeout: 5000 });
    await allBookOption.click();
    await page
      .locator('[role="listbox"]')
      .waitFor({ state: "detached", timeout: 5000 })
      .catch(() => {});
    await assertWidened("book reset", "book", sinceIndex);

    console.log(
      "Scenario 7: resetting Type back to 'All verses' widens the list",
    );
    apiCalls.length = 0;
    await page.goto(`${BASE_URL}/verses`, { waitUntil: "networkidle" });
    guard.assertPageLoaded();
    await guard.guarded(page.waitForSelector("button#author"));
    await pickOption(page, "genre", "Epigrams");
    await page.waitForFunction(
      () =>
        new URLSearchParams(window.location.search).get("genre") === "epigram",
      undefined,
      { timeout: 5000 },
    );
    await page.waitForLoadState("networkidle");
    sinceIndex = apiCalls.length;
    await pickOption(page, "genre", "All verses");
    await assertWidened("type reset", "genre", sinceIndex);

    console.log(
      "Scenario 8: clicking an active poet chip un-selects it and widens",
    );
    apiCalls.length = 0;
    await page.goto(`${BASE_URL}/verses`, { waitUntil: "networkidle" });
    guard.assertPageLoaded();
    await guard.guarded(page.waitForSelector("button#author"));
    // The chips live in the "Index of poets" card; click Plato's chip to
    // activate the filter...
    const platoChip = page
      .locator("button", { hasText: /^Plato\s*\d+$/ })
      .first();
    await platoChip.click();
    await page.waitForFunction(
      () =>
        new URLSearchParams(window.location.search).get("author") === "Plato",
      undefined,
      { timeout: 5000 },
    );
    check("clicking the Plato chip sets ?author=Plato", true);
    await waitForHeadings(page, headingsFor(PIN_PLATO_IDS));
    await page.waitForLoadState("networkidle");
    // ...then click the now-active chip again to toggle it off.
    sinceIndex = apiCalls.length;
    await platoChip.click();
    await assertWidened("chip toggle-off", "author", sinceIndex);
    // The chip must also drop its active styling (bg-primary).
    const chipClass = await platoChip.getAttribute("class");
    check(
      "the Plato chip loses its active styling after toggle-off",
      !(chipClass ?? "").includes("bg-primary"),
      `class=${chipClass}`,
    );

    console.log(
      "Scenario 9: the Philosopher dropdown narrows, then 'All philosophers' widens",
    );
    // Pin the philosopher and their row count from the API itself so the
    // scenario fails loudly if the curation changes rather than passing
    // vacuously against drifted expectations.
    const PIN_PHILOSOPHER = "Zeno of Citium";
    const philRes = await fetch(
      `${BASE_URL}/api/verses?philosopher=${encodeURIComponent(PIN_PHILOSOPHER)}`,
    );
    const philExpected = philRes.ok
      ? ((await philRes.json()) as unknown[]).length
      : 0;
    check(
      `the API returns a non-empty, narrower-than-total list for philosopher=${PIN_PHILOSOPHER}`,
      philExpected > 0 && philExpected < unfilteredTotal,
      `expected=${philExpected}, total=${unfilteredTotal}`,
    );

    apiCalls.length = 0;
    await page.goto(`${BASE_URL}/verses`, { waitUntil: "networkidle" });
    guard.assertPageLoaded();
    await guard.guarded(page.waitForSelector("button#author"));
    await pickOption(page, "phil", PIN_PHILOSOPHER);
    await page.waitForFunction(
      (want) =>
        new URLSearchParams(window.location.search).get("philosopher") ===
        want,
      PIN_PHILOSOPHER,
      { timeout: 5000 },
    );
    check(`URL gains ?philosopher=${PIN_PHILOSOPHER}`, true);
    await waitForRowCount(page, philExpected);
    await page.waitForLoadState("networkidle");
    const philCall = apiCalls.find(
      (u) => new URL(u).searchParams.get("philosopher") === PIN_PHILOSOPHER,
    );
    check(
      `/api/verses is called with philosopher=${PIN_PHILOSOPHER}`,
      !!philCall,
      `calls=${JSON.stringify(apiCalls)}`,
    );
    const philRows = await cardHeadings(page);
    check(
      `renders the ${philExpected} ${PIN_PHILOSOPHER} rows`,
      philRows.length === philExpected,
      `got=${philRows.length}`,
    );
    // Reset back to "All philosophers" and require the list to widen.
    sinceIndex = apiCalls.length;
    await pickOption(page, "phil", "All philosophers");
    await assertWidened("philosopher reset", "philosopher", sinceIndex);
    // The trigger label must read "All philosophers" again.
    const philLabel = await page.evaluate(
      () => document.querySelector("button#phil")?.textContent?.trim() ?? null,
    );
    check(
      'the Philosopher dropdown shows "All philosophers" after the reset',
      philLabel === "All philosophers",
      `label=${JSON.stringify(philLabel)}`,
    );

    console.log(
      "Scenario 10: typing in the search box narrows (?q=), clearing it widens",
    );
    // Pin the query and its narrowed count from the API, same guard as
    // scenario 9: the term must match something, but not everything.
    const PIN_QUERY = "moon";
    const qRes = await fetch(
      `${BASE_URL}/api/verses?q=${encodeURIComponent(PIN_QUERY)}`,
    );
    const qExpected = qRes.ok ? ((await qRes.json()) as unknown[]).length : 0;
    check(
      `the API returns a non-empty, narrower-than-total list for q=${PIN_QUERY}`,
      qExpected > 0 && qExpected < unfilteredTotal,
      `expected=${qExpected}, total=${unfilteredTotal}`,
    );

    apiCalls.length = 0;
    await page.goto(`${BASE_URL}/verses`, { waitUntil: "networkidle" });
    guard.assertPageLoaded();
    await guard.guarded(page.waitForSelector("button#author"));
    const searchBox = page.locator('input[aria-label="Search the verses"]');
    await searchBox.fill(PIN_QUERY);
    // The box is debounced at 250ms; the URL param appearing proves the
    // debounce fired, so wait on that rather than a fixed sleep.
    await page.waitForFunction(
      (want) => new URLSearchParams(window.location.search).get("q") === want,
      PIN_QUERY,
      { timeout: 5000 },
    );
    check(`typing "${PIN_QUERY}" sets ?q=${PIN_QUERY} after the debounce`, true);
    await waitForRowCount(page, qExpected);
    await page.waitForLoadState("networkidle");
    const qCall = apiCalls.find(
      (u) => new URL(u).searchParams.get("q") === PIN_QUERY,
    );
    check(
      `/api/verses is called with q=${PIN_QUERY}`,
      !!qCall,
      `calls=${JSON.stringify(apiCalls)}`,
    );
    const qRows = await cardHeadings(page);
    check(
      `renders the ${qExpected} narrowed rows for q=${PIN_QUERY}`,
      qRows.length === qExpected,
      `got=${qRows.length}`,
    );
    // Clear the box; after the debounce the ?q= must drop and the full
    // unfiltered list must come back.
    sinceIndex = apiCalls.length;
    await searchBox.fill("");
    await assertWidened("search clear", "q", sinceIndex);
    const boxValue = await searchBox.inputValue();
    check(
      "the search box is empty after clearing",
      boxValue === "",
      `value=${JSON.stringify(boxValue)}`,
    );

    console.log(
      "Scenario 11: search term + Philosopher dropdown stack, and removing one keeps the other",
    );
    // A regression where one filter clobbers the other's URL param or query
    // key would show over-wide results while both controls claim to be
    // active. Pin a pair whose intersection is a strict narrowing of BOTH
    // single-filter lists, with the counts read from the API at runtime so
    // curation drift fails loudly instead of passing vacuously.
    const PIN_COMBO_PHIL = "Plato";
    const PIN_COMBO_QUERY = "hither";
    const comboFetch = async (params: string) => {
      const res = await fetch(`${BASE_URL}/api/verses${params}`);
      return res.ok ? ((await res.json()) as unknown[]).length : -1;
    };
    const comboPhilOnly = await comboFetch(
      `?philosopher=${encodeURIComponent(PIN_COMBO_PHIL)}`,
    );
    const comboQOnly = await comboFetch(
      `?q=${encodeURIComponent(PIN_COMBO_QUERY)}`,
    );
    const comboBoth = await comboFetch(
      `?q=${encodeURIComponent(PIN_COMBO_QUERY)}&philosopher=${encodeURIComponent(PIN_COMBO_PHIL)}`,
    );
    check(
      `the API intersection for q=${PIN_COMBO_QUERY} + philosopher=${PIN_COMBO_PHIL} is non-empty and strictly narrower than each single filter and the total`,
      comboBoth > 0 &&
        comboBoth < comboQOnly &&
        comboBoth < comboPhilOnly &&
        comboQOnly < unfilteredTotal &&
        comboPhilOnly < unfilteredTotal,
      `both=${comboBoth}, qOnly=${comboQOnly}, philOnly=${comboPhilOnly}, total=${unfilteredTotal}`,
    );

    apiCalls.length = 0;
    await page.goto(`${BASE_URL}/verses`, { waitUntil: "networkidle" });
    guard.assertPageLoaded();
    await guard.guarded(page.waitForSelector("button#author"));
    await searchBox.fill(PIN_COMBO_QUERY);
    await page.waitForFunction(
      (want) => new URLSearchParams(window.location.search).get("q") === want,
      PIN_COMBO_QUERY,
      { timeout: 5000 },
    );
    await pickOption(page, "phil", PIN_COMBO_PHIL);
    await page.waitForFunction(
      ([q, phil]) => {
        const p = new URLSearchParams(window.location.search);
        return p.get("q") === q && p.get("philosopher") === phil;
      },
      [PIN_COMBO_QUERY, PIN_COMBO_PHIL] as [string, string],
      { timeout: 5000 },
    );
    check(
      `URL carries BOTH ?q=${PIN_COMBO_QUERY} and ?philosopher=${PIN_COMBO_PHIL}`,
      true,
    );
    await waitForRowCount(page, comboBoth);
    await page.waitForLoadState("networkidle");
    const comboCall = apiCalls.find((u) => {
      const p = new URL(u).searchParams;
      return (
        p.get("q") === PIN_COMBO_QUERY &&
        p.get("philosopher") === PIN_COMBO_PHIL
      );
    });
    check(
      "/api/verses is called with BOTH q and philosopher in one request",
      !!comboCall,
      `calls=${JSON.stringify(apiCalls)}`,
    );
    const comboRows = await cardHeadings(page);
    check(
      `renders exactly the ${comboBoth} intersected rows`,
      comboRows.length === comboBoth,
      `got=${comboRows.length}`,
    );

    // Removing just the philosopher must keep the search narrowing intact.
    sinceIndex = apiCalls.length;
    await pickOption(page, "phil", "All philosophers");
    await page.waitForFunction(
      (q) => {
        const p = new URLSearchParams(window.location.search);
        return !p.has("philosopher") && p.get("q") === q;
      },
      PIN_COMBO_QUERY,
      { timeout: 5000 },
    );
    check(
      "dropping the philosopher keeps ?q= in the URL and removes ?philosopher=",
      true,
    );
    await waitForRowCount(page, comboQOnly);
    await page.waitForLoadState("networkidle");
    // The page fetched the q-only list when the search term was typed
    // (before the philosopher was stacked), so react-query may serve the
    // reset from that cache rather than refetching — the q-only call may
    // predate the reset, but no call AFTER the reset may still carry
    // philosopher (asserted below).
    const qKeptCall = apiCalls.find((u) => {
      const p = new URL(u).searchParams;
      return p.get("q") === PIN_COMBO_QUERY && !p.has("philosopher");
    });
    check(
      "the q-kept list is backed by a q-only /api/verses call",
      !!qKeptCall,
      `calls=${JSON.stringify(apiCalls.slice(sinceIndex))}`,
    );
    const stalePhilCalls = apiCalls
      .slice(sinceIndex)
      .filter((u) => new URL(u).searchParams.has("philosopher"));
    check(
      "no post-reset /api/verses call still carries philosopher",
      stalePhilCalls.length === 0,
      `stale=${JSON.stringify(stalePhilCalls)}`,
    );
    const qKeptRows = await cardHeadings(page);
    check(
      `rows widen only to the ${comboQOnly} q-filtered rows, not the full list`,
      qKeptRows.length === comboQOnly,
      `got=${qKeptRows.length}`,
    );

    // Re-stack both filters, then clear only the search box: the
    // philosopher narrowing must survive.
    await pickOption(page, "phil", PIN_COMBO_PHIL);
    await page.waitForFunction(
      (phil) =>
        new URLSearchParams(window.location.search).get("philosopher") ===
        phil,
      PIN_COMBO_PHIL,
      { timeout: 5000 },
    );
    await waitForRowCount(page, comboBoth);
    await page.waitForLoadState("networkidle");
    sinceIndex = apiCalls.length;
    await searchBox.fill("");
    await page.waitForFunction(
      (phil) => {
        const p = new URLSearchParams(window.location.search);
        return !p.has("q") && p.get("philosopher") === phil;
      },
      PIN_COMBO_PHIL,
      { timeout: 5000 },
    );
    check(
      "clearing the search keeps ?philosopher= in the URL and removes ?q=",
      true,
    );
    await waitForRowCount(page, comboPhilOnly);
    await page.waitForLoadState("networkidle");
    const philKeptCall = apiCalls
      .slice(sinceIndex)
      .find((u) => {
        const p = new URL(u).searchParams;
        return p.get("philosopher") === PIN_COMBO_PHIL && !p.has("q");
      });
    check(
      "after clearing the search, /api/verses is called with philosopher but WITHOUT q",
      !!philKeptCall,
      `calls=${JSON.stringify(apiCalls.slice(sinceIndex))}`,
    );
    const staleQCalls = apiCalls
      .slice(sinceIndex)
      .filter((u) => new URL(u).searchParams.has("q"));
    check(
      "no post-clear /api/verses call still carries q",
      staleQCalls.length === 0,
      `stale=${JSON.stringify(staleQCalls)}`,
    );
    const philKeptRows = await cardHeadings(page);
    check(
      `rows widen only to the ${comboPhilOnly} philosopher-filtered rows, not the full list`,
      philKeptRows.length === comboPhilOnly,
      `got=${philKeptRows.length}`,
    );
    const comboEndLabels = await page.evaluate(() => ({
      phil: document.querySelector("button#phil")?.textContent?.trim() ?? null,
      box:
        (
          document.querySelector(
            'input[aria-label="Search the verses"]',
          ) as HTMLInputElement | null
        )?.value ?? null,
    }));
    check(
      "the Philosopher dropdown still shows the pinned philosopher and the box is empty",
      (comboEndLabels.phil ?? "").startsWith(PIN_COMBO_PHIL) &&
        comboEndLabels.box === "",
      `state=${JSON.stringify(comboEndLabels)}`,
    );
  } finally {
    await browser.close();
  }

  if (failures > 0) {
    console.error(`\ne2e-verses-filters: ${failures} check(s) FAILED`);
    process.exit(1);
  }
  console.log("\ne2e-verses-filters: all checks passed");
}

await main();
