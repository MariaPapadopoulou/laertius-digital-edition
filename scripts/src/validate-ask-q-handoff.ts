/// <reference lib="dom" />
// Guards the /ask "?q= handoff" contract against resurrection of a stale
// question:
//
// The homepage's "Ask Laertius" box hands a question to /ask via ?q=. The
// Ask page consumes that parameter ONCE (auto-submitting it) and then strips
// it from the address with history.replaceState. If the stripping ever
// regresses, a refresh or back/forward navigation would re-read the stale
// ?q=A and override whatever newer question the reader asked since.
//
// Scenarios:
// 1. Handoff works: submitting question A in the homepage sidebar box lands
//    on /ask, A auto-submits (its answer renders — this is also the positive
//    control proving the probes can see A when it IS present), and the ?q=
//    parameter is stripped from the address.
// 2. After asking a newer question B, a page refresh must NOT resurrect A:
//    no ?q=A in the URL, A not in the input, A's answer not rendered.
// 3. Back to the homepage and forward again must NOT resurrect A either.
//
// The /api/ask endpoint is mocked per-question so the check is fast,
// deterministic, and can tell exactly whose answer is on screen.
//
// Requirements: the API server and web workflows must be running (the
// script talks to the shared proxy, default http://localhost:80), and a
// Chromium headless shell must be installed for playwright-core, e.g.:
//   PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright \
//     node scripts/node_modules/playwright-core/cli.js install chromium-headless-shell

// playwright-core resolves its browser registry at module import time from
// PLAYWRIGHT_BROWSERS_PATH; set it BEFORE importing playwright-core.
import "./lib/playwright-browsers-path";

const { chromium } = await import("playwright-core");
import type { Page } from "playwright-core";

const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:80";

const QUESTION_A = "handoff marker alpha five ninety eight";
const QUESTION_B = "newer question beta five ninety eight";
const ANSWER_A = "ANSWER-MARKER-ALPHA-598";
const ANSWER_B = "ANSWER-MARKER-BETA-598";

let failures = 0;
function check(label: string, ok: boolean, detail?: string) {
  if (ok) {
    console.log(`  ok: ${label}`);
  } else {
    failures++;
    console.error(`  FAIL: ${label}${detail ? ` (${detail})` : ""}`);
  }
}

// Mock the RAG endpoint: answer with a distinct marker per question so the
// probes can tell exactly which question's answer is on screen. Survives
// reloads and navigations (page.route is page-scoped, not document-scoped).
async function mockAsk(page: Page) {
  await page.route("**/api/ask", async (route) => {
    let query = "";
    try {
      query = (route.request().postDataJSON() as { query?: string }).query ?? "";
    } catch {
      // fall through with empty query
    }
    const answer = query.includes("alpha")
      ? ANSWER_A
      : query.includes("beta")
        ? ANSWER_B
        : `ANSWER-FOR:${query}`;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        answer,
        passages: [],
        claimAnswers: [],
        verseAnswers: [],
        sayingAnswers: [],
        graphContext: { matched: [], related: [] },
      }),
    });
  });
}

async function askInputValue(page: Page): Promise<string> {
  return page
    .locator('form input[type="text"]')
    .first()
    .inputValue()
    .catch(() => "<input not found>");
}

// True when any trace of question A is present: ?q=A in the address, A in
// the question input, or A's mocked answer rendered on the page.
async function traceOfA(page: Page): Promise<string[]> {
  const traces: string[] = [];
  const url = page.url();
  if (new URL(url).searchParams.get("q") === QUESTION_A) traces.push("?q=A in URL");
  if ((await askInputValue(page)) === QUESTION_A) traces.push("A in input");
  if ((await page.getByText(ANSWER_A).count().catch(() => 0)) > 0)
    traces.push("A's answer rendered");
  return traces;
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({
      viewport: { width: 1400, height: 900 },
    });
    await mockAsk(page);

    console.log("Scenario 1: homepage handoff auto-submits A and strips ?q");
    await page.goto(`${BASE_URL}/`, { waitUntil: "networkidle" });
    const sidebarInput = page.locator(
      'input[aria-label="Ask Laertius a question"]',
    );
    check(
      "homepage sidebar Ask box is present",
      (await sidebarInput.count().catch(() => 0)) > 0,
    );
    await sidebarInput.fill(QUESTION_A);
    await sidebarInput.press("Enter");
    await page.waitForURL(/\/ask/, { timeout: 15000 });
    check("submitting the sidebar box navigates to /ask", page.url().includes("/ask"));

    // Positive control: A's mocked answer must render — this proves the
    // handoff auto-submitted AND that the later "A never reappears" probes
    // are capable of seeing A when it is actually present.
    const aAnswered = await page
      .getByText(ANSWER_A)
      .first()
      .waitFor({ state: "visible", timeout: 15000 })
      .then(
        () => true,
        () => false,
      );
    check("positive control: handed-over question A auto-submits (answer renders)", aAnswered);
    check(
      "question input carries A after the handoff",
      (await askInputValue(page)) === QUESTION_A,
      `input="${await askInputValue(page)}"`,
    );

    // Give the strip effect a beat, then assert ?q is gone from the address.
    await page.waitForFunction(
      () => !new URLSearchParams(window.location.search).has("q"),
      undefined,
      { timeout: 5000 },
    ).catch(() => undefined);
    check(
      "?q= parameter is stripped from the address after consumption",
      !new URL(page.url()).searchParams.has("q"),
      `url=${page.url()}`,
    );

    console.log("Scenario 2: ask newer question B, then refresh — A must not resurrect");
    const input = page.locator('form input[type="text"]').first();
    await input.fill(QUESTION_B);
    await input.press("Enter");
    const bAnswered = await page
      .getByText(ANSWER_B)
      .first()
      .waitFor({ state: "visible", timeout: 15000 })
      .then(
        () => true,
        () => false,
      );
    check("newer question B submits and answers", bAnswered);

    await page.reload({ waitUntil: "networkidle" });
    await page.waitForSelector("h1", { timeout: 15000 });
    await page.waitForTimeout(1000);
    let traces = await traceOfA(page);
    check(
      "after refresh: stale question A does not resurrect",
      traces.length === 0,
      traces.join("; "),
    );
    check(
      "after refresh: address still carries no ?q=",
      !new URL(page.url()).searchParams.has("q"),
      `url=${page.url()}`,
    );

    console.log("Scenario 3: back to home and forward again — A must not resurrect");
    await page.goBack({ waitUntil: "networkidle" }).catch(() => null);
    await page.waitForTimeout(500);
    // Wherever back landed (home or an earlier /ask entry), A must not be
    // re-submittable from the address bar.
    traces = await traceOfA(page);
    check(
      "after back navigation: no trace of stale question A",
      traces.length === 0,
      `landed on ${page.url()}; ${traces.join("; ")}`,
    );

    await page.goForward({ waitUntil: "networkidle" }).catch(() => null);
    await page.waitForTimeout(1000);
    traces = await traceOfA(page);
    check(
      "after forward navigation back to /ask: no trace of stale question A",
      traces.length === 0,
      `landed on ${page.url()}; ${traces.join("; ")}`,
    );

    await page.close();
  } finally {
    await browser.close();
  }

  if (failures > 0) {
    console.error(`\nvalidate-ask-q-handoff: ${failures} check(s) failed`);
    process.exit(1);
  }
  console.log("\nvalidate-ask-q-handoff: all checks passed");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
