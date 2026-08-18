/// <reference lib="dom" />
// Guards the POSITIVE restore path of the Ask page's last-question memory
// (the companion validate-ask-q-handoff.ts only guards the negative,
// stale-resurrection side):
//
// The Ask page deliberately restores the reader's LAST question (from
// sessionStorage, key ask:last-question) when they return via history
// navigation with a scrollMemory history state — so leaving to read a
// cited passage and coming Back doesn't lose the answer. If that path
// silently broke, Back would land on a blank Ask page without failing
// any existing check.
//
// Scenarios:
// 1. Negative control (pre): a fresh direct visit to /ask starts blank —
//    empty question input and no answer on screen.
// 2. Positive path: ask a question on /ask, its mocked answer renders with
//    a cited "(D.L. …)" passage link; clicking through to that section
//    stamps the scrollMemory history state; navigating Back restores BOTH
//    the same question in the input and its answer on screen.
// 3. Negative control (post): with the last question still sitting in
//    sessionStorage, a fresh direct navigation to /ask (no scrollMemory
//    history state) must start blank again — proving the restore is gated
//    on the history marker, not on sessionStorage alone.
//
// The /api/ask endpoint is mocked with a distinctive answer marker and a
// claim carrying a sectionId, so the check is fast, deterministic, and the
// cited-passage link is guaranteed to exist.
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

const QUESTION = "restore marker question six twenty six";
const ANSWER_MARKER = "ANSWER-MARKER-RESTORE-626";
// A real early section of the Lives so the click-through lands on a page
// that actually renders (the Back test itself works regardless).
const SECTION_ID = "1.1";

let failures = 0;
function check(label: string, ok: boolean, detail?: string) {
  if (ok) {
    console.log(`  ok: ${label}`);
  } else {
    failures++;
    console.error(`  FAIL: ${label}${detail ? ` (${detail})` : ""}`);
  }
}

// Mock the RAG endpoint with a marker answer and MANY claim groups each
// carrying a sectionId, so (a) the "(D.L. …)" cited-passage links are
// guaranteed to render and (b) the answer is long enough that the scroll
// restore path (deep in the answer → click a citation → Back) is testable.
// page.route is page-scoped, so the mock survives reloads and navigations.
async function mockAsk(page: Page) {
  const claimAnswers = Array.from({ length: 40 }, (_, i) => ({
    philosopher: `Thales`,
    topic: `topic-${i + 1}`,
    claims: [
      {
        id: `restore-check-claim-${i + 1}`,
        property: "birthPlace",
        value: `Miletus ${i + 1}`,
        valueType: "place",
        ref: "1.22",
        sectionId: SECTION_ID,
        certainty: "asserted",
      },
    ],
  }));
  await page.route("**/api/ask", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        answer: ANSWER_MARKER,
        passages: [],
        claimAnswers,
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

async function answerVisible(page: Page): Promise<boolean> {
  return (await page.getByText(ANSWER_MARKER).count().catch(() => 0)) > 0;
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({
      viewport: { width: 1400, height: 900 },
    });
    await mockAsk(page);

    console.log("Scenario 1: fresh direct visit to /ask starts blank");
    await page.goto(`${BASE_URL}/ask`, { waitUntil: "networkidle" });
    await page.waitForSelector("h1", { timeout: 15000 });
    check(
      "fresh visit: question input is empty",
      (await askInputValue(page)) === "",
      `input="${await askInputValue(page)}"`,
    );
    check(
      "fresh visit: no answer on screen",
      !(await answerVisible(page)),
    );

    console.log("Scenario 2: ask, click a cited passage, come Back — question AND answer restore");
    const input = page.locator('form input[type="text"]').first();
    await input.fill(QUESTION);
    await input.press("Enter");
    const answered = await page
      .getByText(ANSWER_MARKER)
      .first()
      .waitFor({ state: "visible", timeout: 15000 })
      .then(
        () => true,
        () => false,
      );
    check("positive control: question submits and its answer renders", answered);

    const sectionLink = page.locator(`a[href*="/section/${SECTION_ID}"]`).first();
    check(
      "answer carries a cited passage link",
      (await sectionLink.count().catch(() => 0)) > 0,
    );

    // Scroll deep into the long answer and let the scroll-memory hook see
    // the scroll event before clicking through.
    await page.evaluate(() => {
      window.scrollTo(
        0,
        document.documentElement.scrollHeight - window.innerHeight,
      );
    });
    await page.waitForTimeout(400);

    // Playwright's normal click auto-scrolls the target into view first,
    // which would corrupt the scroll snapshot. Instead, find a citation
    // link already inside the viewport, snapshot scrollY at that instant,
    // and dispatch a synthetic click — all in one in-page evaluation.
    const savedScrollY = await page.evaluate((sectionId) => {
      const anchors = Array.from(
        document.querySelectorAll<HTMLAnchorElement>(
          `a[href*="/section/${sectionId}"]`,
        ),
      );
      const inView = anchors.find((a) => {
        const r = a.getBoundingClientRect();
        return r.top >= 0 && r.bottom <= window.innerHeight;
      });
      if (!inView) return -1;
      const y = window.scrollY;
      inView.dispatchEvent(
        new MouseEvent("click", {
          bubbles: true,
          cancelable: true,
          button: 0,
          view: window,
        }),
      );
      return y;
    }, SECTION_ID);
    check(
      "long answer: page is scrolled meaningfully deep before the click",
      savedScrollY > 500,
      `scrollY at click time = ${savedScrollY}`,
    );
    await page.waitForURL(new RegExp(`/section/${SECTION_ID.replace(".", "\\.")}`), {
      timeout: 15000,
    });
    check(
      "clicking the citation navigates to the section page",
      page.url().includes(`/section/${SECTION_ID}`),
      `url=${page.url()}`,
    );
    await page.waitForTimeout(500);

    await page.goBack().catch(() => null);
    await page.waitForURL(/\/ask/, { timeout: 15000 }).catch(() => undefined);
    check("Back returns to /ask", /\/ask(\?|$)/.test(page.url()), `url=${page.url()}`);
    // The restore reads history.state.scrollMemory synchronously at mount;
    // give React a beat to render the restored question and answer.
    const restoredAnswer = await page
      .getByText(ANSWER_MARKER)
      .first()
      .waitFor({ state: "visible", timeout: 15000 })
      .then(
        () => true,
        () => false,
      );
    check(
      "after Back: the same question is restored in the input",
      (await askInputValue(page)) === QUESTION,
      `input="${await askInputValue(page)}"`,
    );
    check("after Back: the question's answer is restored on screen", restoredAnswer);
    // The scroll restore enforces the saved position over a guard window of
    // animation frames once the answer is ready; poll until it settles.
    let restoredScrollY = -1;
    for (let i = 0; i < 60; i++) {
      restoredScrollY = await page.evaluate(() => window.scrollY);
      if (Math.abs(restoredScrollY - savedScrollY) <= 24) break;
      await page.waitForTimeout(200);
    }
    check(
      "after Back: scroll position returns near the saved spot",
      savedScrollY > 0 && Math.abs(restoredScrollY - savedScrollY) <= 24,
      `saved=${savedScrollY} restored=${restoredScrollY}`,
    );
    check(
      "after Back: address carries no ?q=",
      !new URL(page.url()).searchParams.has("q"),
      `url=${page.url()}`,
    );

    console.log("Scenario 2b: a page refresh keeps the stamped state — question, answer, and scroll all come back");
    // A plain reload preserves the scrollMemory history state stamped by the
    // citation click, so a reader who refreshes mid-answer must land back at
    // the same spot too. This path is independent of Back and could regress
    // on its own.
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForSelector("h1", { timeout: 15000 });
    check("reload stays on /ask", /\/ask(\?|$)/.test(page.url()), `url=${page.url()}`);
    const reloadedAnswer = await page
      .getByText(ANSWER_MARKER)
      .first()
      .waitFor({ state: "visible", timeout: 15000 })
      .then(
        () => true,
        () => false,
      );
    check(
      "after reload: the same question is restored in the input",
      (await askInputValue(page)) === QUESTION,
      `input="${await askInputValue(page)}"`,
    );
    check("after reload: the question's answer is restored on screen", reloadedAnswer);
    let reloadedScrollY = -1;
    for (let i = 0; i < 60; i++) {
      reloadedScrollY = await page.evaluate(() => window.scrollY);
      if (Math.abs(reloadedScrollY - savedScrollY) <= 24) break;
      await page.waitForTimeout(200);
    }
    check(
      "after reload: scroll position settles near the saved spot",
      savedScrollY > 0 && Math.abs(reloadedScrollY - savedScrollY) <= 24,
      `saved=${savedScrollY} restored=${reloadedScrollY}`,
    );

    console.log("Scenario 3: fresh direct navigation to /ask starts blank despite sessionStorage");
    // sessionStorage still holds the last question in this tab; a direct
    // navigation (no scrollMemory history state) must NOT restore it.
    // Leave /ask first: navigating to the SAME URL is a reload, which
    // preserves the stamped scrollMemory history state (and legitimately
    // restores) — the control needs a genuinely fresh history entry.
    await page.goto(`${BASE_URL}/`, { waitUntil: "networkidle" });
    await page.goto(`${BASE_URL}/ask`, { waitUntil: "networkidle" });
    await page.waitForSelector("h1", { timeout: 15000 });
    await page.waitForTimeout(1000);
    const storedLast = await page
      .evaluate(() => sessionStorage.getItem("ask:last-question"))
      .catch(() => null);
    check(
      "sessionStorage still holds the last question (control precondition)",
      storedLast === QUESTION,
      `stored="${storedLast}"`,
    );
    check(
      "negative control: direct visit does NOT restore the question",
      (await askInputValue(page)) === "",
      `input="${await askInputValue(page)}"`,
    );
    check(
      "negative control: direct visit shows no answer",
      !(await answerVisible(page)),
    );

    await page.close();
  } finally {
    await browser.close();
  }

  if (failures > 0) {
    console.error(`\nvalidate-ask-restore: ${failures} check(s) failed`);
    process.exit(1);
  }
  console.log("\nvalidate-ask-restore: all checks passed");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
