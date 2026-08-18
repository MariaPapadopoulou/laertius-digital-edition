/// <reference lib="dom" />
// Real-browser check of the /competency failed-fetch path. No curated
// question fails live, so this script forces the failure by intercepting
// the page's own result fetch (playwright route interception) for one
// question and (a) fulfilling it with a 500, then (b) aborting it at the
// network level. In both cases the page must show the honest error notice
// ("This question could not be answered. The server returned an error.")
// instead of leaving readers on a permanent loading skeleton, and a
// control question fetched WITHOUT interception must still render its
// results normally on the same page instance.
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
const { attachPageGuard } = await import("./lib/e2e-page-guard");
import type { Page } from "playwright-core";

const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:80";

// The question whose result fetch we break, and a control question that
// must still load normally without interception.
const BROKEN_ID = "stoa-members";
const CONTROL_ID = "homonymy-proper-names";

const ERROR_TEXT =
  "This question could not be answered. The server returned an error.";

const CATALOGUE_ERROR_TEXT =
  "The question catalogue could not be loaded. The server returned an error.";

let failures = 0;
function check(label: string, ok: boolean, detail?: string) {
  if (ok) {
    console.log(`  ok: ${label}`);
  } else {
    failures++;
    console.error(`  FAIL: ${label}${detail ? ` (${detail})` : ""}`);
  }
}

interface CatalogueQuestion {
  id: string;
  question: string;
  rowCount: number;
}

async function selectQuestion(page: Page, questionText: string) {
  return page.evaluate((qt) => {
    const btn = Array.from(document.querySelectorAll("button")).find(
      (b) => (b.textContent ?? "").trim().startsWith(qt),
    );
    if (!btn) return false;
    btn.click();
    return true;
  }, questionText);
}

async function readPanelState(page: Page) {
  return page.evaluate((errText) => {
    const main = document.querySelector("main") ?? document.body;
    return {
      errorShown: (main.textContent ?? "").includes(errText),
      skeletons: main.querySelectorAll(".animate-pulse").length,
      resultsHeading: /query results/i.test(main.textContent ?? ""),
    };
  }, ERROR_TEXT);
}

async function expectErrorState(page: Page, label: string) {
  // react-query retries failed fetches (default 3x with backoff), so the
  // skeleton legitimately shows for a few seconds first. The check is that
  // it SETTLES on the error notice, not that the error is instant.
  let settled = false;
  try {
    await page.waitForFunction(
      (errText) => (document.body.innerText ?? "").includes(errText),
      ERROR_TEXT,
      { timeout: 45000 },
    );
    settled = true;
  } catch {
    settled = false;
  }
  const state = await readPanelState(page);
  check(`${label}: error notice shown instead of results`, settled && state.errorShown);
  check(
    `${label}: loading skeleton is gone once the error settles`,
    state.skeletons === 0,
    `animate-pulse elements=${state.skeletons}`,
  );
  check(
    `${label}: no results panel rendered for the failed fetch`,
    !state.resultsHeading,
  );
}

async function main() {
  const catRes = await fetch(`${BASE_URL}/api/competency/questions`);
  if (!catRes.ok) {
    throw new Error(
      `GET /api/competency/questions failed: ${catRes.status} ${catRes.statusText}`,
    );
  }
  const catalogue = (await catRes.json()) as { questions: CatalogueQuestion[] };
  const broken = catalogue.questions.find((q) => q.id === BROKEN_ID);
  const control = catalogue.questions.find((q) => q.id === CONTROL_ID);
  if (!broken || !control) {
    throw new Error(
      `catalogue is missing ${!broken ? BROKEN_ID : CONTROL_ID}; cannot run`,
    );
  }
  // Sanity: the broken question answers fine live, so any error the page
  // shows is genuinely produced by our interception.
  const liveRes = await fetch(
    `${BASE_URL}/api/competency/questions/${BROKEN_ID}`,
  );
  check(
    `${BROKEN_ID}: live result fetch is healthy before stubbing`,
    liveRes.ok,
    `status=${liveRes.status}`,
  );

  const browser = await chromium.launch({ headless: true });
  try {
    // --- Case 1: server returns 500 -------------------------------------
    console.log("Case 1: result fetch returns HTTP 500");
    const page = await browser.newPage({
      viewport: { width: 1280, height: 900 },
    });
    // The 500 injection below only fires on the broken question's own
    // result fetch (triggered by the click), so the initial /competency
    // document/asset load is still healthy: assert it loaded here, but do
    // NOT guard the waits after the failure is injected — the guard records
    // every >=500 globally and this scenario deliberately provokes one.
    const guard = attachPageGuard(page);
    await page.route(
      `**/api/competency/questions/${BROKEN_ID}`,
      async (route) => {
        await route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({ error: "forced failure for e2e" }),
        });
      },
    );
    await page.goto(`${BASE_URL}/competency`, { waitUntil: "networkidle" });
    guard.assertPageLoaded();
    check("broken question: button clicked", await selectQuestion(page, broken.question));
    // Plain waits from here on: the intentional 500 has been injected.
    await expectErrorState(page, "HTTP 500");

    // The rest of the page must stay honest: switching to the untouched
    // control question on the SAME page must recover and render results.
    console.log("Recovery: control question still renders results");
    check(
      "control question: button clicked",
      await selectQuestion(page, control.question),
    );
    await page.waitForFunction(
      () => /query results/i.test(document.body.innerText),
      undefined,
      { timeout: 30000 },
    );
    const controlState = await readPanelState(page);
    check("control question: results panel rendered", controlState.resultsHeading);
    check("control question: no error notice", !controlState.errorShown);
    await page.close();

    // --- Case 2: network-level abort ------------------------------------
    console.log("Case 2: result fetch aborts at the network level");
    const page2 = await browser.newPage({
      viewport: { width: 1280, height: 900 },
    });
    // This scenario deep-links straight to the broken question and aborts
    // its result fetch during load, so we deliberately do NOT assert/guard
    // here: the abort IS the behaviour under test.
    const guard2 = attachPageGuard(page2);
    void guard2;
    await page2.route(
      `**/api/competency/questions/${BROKEN_ID}`,
      async (route) => {
        await route.abort("connectionfailed");
      },
    );
    await page2.goto(
      // Deep link straight to the broken question: the reload path must
      // also settle on the error, not a stuck skeleton.
      `${BASE_URL}/competency?q=${encodeURIComponent(BROKEN_ID)}`,
      { waitUntil: "domcontentloaded" },
    );
    await expectErrorState(page2, "network abort");
    await page2.close();

    // --- Case 3 & 4: the CATALOGUE fetch itself fails --------------------
    // The sidebar must show an honest notice instead of a silently empty
    // list that reads like "no questions exist". The route pattern ends at
    // /questions so per-question result fetches stay untouched.
    for (const [label, breakRoute] of [
      [
        "catalogue HTTP 500",
        async (route: import("playwright-core").Route) => {
          await route.fulfill({
            status: 500,
            contentType: "application/json",
            body: JSON.stringify({ error: "forced failure for e2e" }),
          });
        },
      ],
      [
        "catalogue network abort",
        async (route: import("playwright-core").Route) => {
          await route.abort("connectionfailed");
        },
      ],
    ] as const) {
      console.log(`Case: ${label}`);
      const p = await browser.newPage({
        viewport: { width: 1280, height: 900 },
      });
      await p.route("**/api/competency/questions", breakRoute);
      await p.goto(`${BASE_URL}/competency`, { waitUntil: "domcontentloaded" });
      // react-query retries first, so wait for the notice to settle.
      let settled = false;
      try {
        await p.waitForFunction(
          (t) => (document.body.innerText ?? "").includes(t),
          CATALOGUE_ERROR_TEXT,
          { timeout: 45000 },
        );
        settled = true;
      } catch {
        settled = false;
      }
      const state = await p.evaluate(
        ({ controlQuestion }) => {
          const main = document.querySelector("main") ?? document.body;
          const buttons = Array.from(main.querySelectorAll("button"));
          return {
            skeletons: main.querySelectorAll(".animate-pulse").length,
            anyQuestionButton: buttons.some((b) =>
              (b.textContent ?? "").trim().startsWith(controlQuestion),
            ),
            noMatchText: (main.textContent ?? "").includes(
              "No questions match.",
            ),
          };
        },
        { controlQuestion: control.question },
      );
      check(`${label}: catalogue error notice shown`, settled);
      check(
        `${label}: loading skeleton gone once the error settles`,
        state.skeletons === 0,
        `animate-pulse elements=${state.skeletons}`,
      );
      check(
        `${label}: no question buttons rendered from a failed catalogue`,
        !state.anyQuestionButton,
      );
      check(
        `${label}: no misleading "No questions match." text`,
        !state.noMatchText,
      );
      await p.close();
    }
  } finally {
    await browser.close();
  }

  if (failures > 0) {
    console.error(`\n${failures} check(s) failed`);
    process.exit(1);
  }
  console.log("\nAll competency fetch-error checks passed");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
