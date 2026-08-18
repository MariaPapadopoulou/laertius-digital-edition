/// <reference lib="dom" />
/* Real-browser check: the homepage → Ask handoff survives a browser
 * that BLOCKS sessionStorage (some privacy modes throw on any access).
 *
 * ask.tsx stores the handed-off ?q= question in sessionStorage inside a
 * try/catch before submitting it. If a refactor ever moves the setItem
 * outside the guard — or bails out of the adoption path when storage
 * throws — the homepage Ask handoff would break silently, but only for
 * readers whose browsers block storage. This script installs an init
 * script that makes every sessionStorage access throw, performs the
 * homepage Ask handoff, and asserts the Ask page still adopts and
 * submits the question.
 *
 * Positive control: the script first proves the storage block is live
 * (sessionStorage access throws in-page) so the run can't pass
 * vacuously against an unblocked browser.
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

// Encoding-hostile query, matching e2e-home-search-handoff: raw '&'/'?'
// would corrupt the handoff URL if encodeURIComponent were dropped.
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

async function main() {
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({
      viewport: { width: 1400, height: 900 },
    });
    // Make EVERY sessionStorage access throw, the way strict privacy
    // modes do. Passed as a string: function-form init scripts are
    // silently skipped under tsx (in-page `__name is not defined`).
    await context.addInitScript(`
      (() => {
        const deny = () => {
          throw new DOMException(
            "sessionStorage is disabled in this browsing context",
            "SecurityError",
          );
        };
        Object.defineProperty(window, "sessionStorage", {
          configurable: false,
          get: deny,
        });
      })();
    `);
    const page = await context.newPage();
    const guard = attachPageGuard(page);

    await page.goto(`${BASE_URL}/`, { waitUntil: "networkidle" });
    guard.assertPageLoaded();
    await guard.guarded(page.waitForSelector("h1", { timeout: 15000 }));

    // ——— Positive control: the block is actually live ———
    const storageThrows = await page.evaluate(() => {
      try {
        // Both plain access and setItem must throw.
        window.sessionStorage.setItem("probe", "1");
        return false;
      } catch {
        return true;
      }
    });
    check("sessionStorage access throws in-page (positive control)", storageThrows);
    if (!storageThrows) {
      throw new Error("storage block not installed; aborting to avoid a vacuous pass");
    }

    const basePrefix = (
      await page.evaluate(
        () => document.querySelector("base")?.getAttribute("href") ?? "/",
      )
    ).replace(/\/$/, "");

    // ——— Homepage Ask handoff with storage blocked ———
    console.log("Scenario: sidebar Ask box → /ask?q=… with sessionStorage blocked");
    await page.fill("input[aria-label='Ask Laertius a question']", QUERY);
    await page.click("form button[type='submit']:has-text('Ask')");
    await guard.guarded(
      page.waitForFunction(
        (pfx: string) => {
          const p = window.location.pathname;
          const s = pfx && p.startsWith(pfx) ? p.slice(pfx.length) || "/" : p;
          return s === "/ask";
        },
        basePrefix,
        { timeout: 15000 },
      ),
    );

    // The Ask page must have adopted the question into its input …
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

    // … and actually SUBMITTED it: the answer area shows either the
    // loading state or a rendered answer (the edition band no longer
    // exists, so body text is the only evidence).
    const submittedEvidence = await page
      .waitForFunction(
        () => {
          const text = document.body.innerText;
          if (text.includes("Searching the Lives")) return "loading";
          if (text.includes("Key Findings")) return "answer";
          if (text.includes("Failed to retrieve passages")) return "error";
          return null;
        },
        undefined,
        { timeout: 20000 },
      )
      .then((h) => h.jsonValue() as Promise<string>)
      .catch(() => null);
    check(
      "Ask page submitted the question (ask in flight or answered)",
      submittedEvidence === "loading" || submittedEvidence === "answer",
      `evidence=${submittedEvidence}`,
    );

    // The stale-query guard must still consume ?q from the URL.
    const askSearch = await page.evaluate(() => window.location.search);
    check("Ask page consumed ?q from the URL", !askSearch.includes("q="), askSearch);

    // And the page must not have crashed on the throwing storage: the
    // Consult form is still present.
    const formAlive = await page.evaluate(
      () => !!document.querySelector("form button[type='submit']"),
    );
    check("Ask page UI intact (no crash from blocked storage)", formAlive);

    await page.close();
    await context.close();
  } finally {
    await browser.close();
  }

  if (failures > 0) {
    console.error(`\ne2e-ask-handoff-no-storage: ${failures} check(s) failed`);
    process.exit(1);
  }
  console.log("\ne2e-ask-handoff-no-storage: all checks passed");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
