/// <reference lib="dom" />
// The in-page callbacks (page.evaluate / waitForFunction) run in the
// browser, so this Node-side script needs the DOM lib for their types.
//
// Real-browser check of the /competency zero-results path. No curated
// question currently returns zero rows, so this script forces the state
// by intercepting the page's own API calls (playwright route interception)
// and mutating the live responses for one question (stoa-members):
// rowCount -> 0 in the catalogue, rows -> [] in the question result. The
// shapes stay exactly what the server serves, only the counts change, so
// the test exercises the real rendering branches:
//
// 1. The sidebar badge for the zeroed question must render "0" with the
//    dashed empty style (border-dashed class) and the "0 result rows"
//    tooltip, while an untouched rich question keeps its non-dashed badge.
// 2. Clicking the zeroed question must render the Query Results panel with
//    a "0 rows" counter, NO table rows, and the honest empty-state message
//    "This query returned no results." (not a blank or broken table).
//
// Requirements: the API server and web workflows must be running (the
// script talks to the shared proxy, default http://localhost:80), and a
// Chromium headless shell must be installed for playwright-core, e.g.:
//   PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright \
//     node scripts/node_modules/playwright-core/cli.js install chromium-headless-shell

// playwright-core resolves its browser registry at module import time from
// PLAYWRIGHT_BROWSERS_PATH (default: $XDG_CACHE_HOME/ms-playwright, which in
// this environment points inside the workspace and holds no browsers). Set
// the env var BEFORE importing playwright-core, picking whichever candidate
// actually contains a chromium install.
import "./lib/playwright-browsers-path";

const { chromium } = await import("playwright-core");
const { attachPageGuard } = await import("./lib/e2e-page-guard");

const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:80";

// The question we zero out, and a rich control question whose badge must
// stay non-dashed on the same render.
const ZEROED_ID = "stoa-members";
const CONTROL_ID = "homonymy-proper-names";

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

async function main() {
  // Map id -> question text via the catalogue endpoint, same as the page.
  const catRes = await fetch(`${BASE_URL}/api/competency/questions`);
  if (!catRes.ok) {
    throw new Error(
      `GET /api/competency/questions failed: ${catRes.status} ${catRes.statusText}`,
    );
  }
  const catalogue = (await catRes.json()) as {
    questions: CatalogueQuestion[];
  };
  const zeroed = catalogue.questions.find((q) => q.id === ZEROED_ID);
  const control = catalogue.questions.find((q) => q.id === CONTROL_ID);
  if (!zeroed || !control) {
    throw new Error(
      `catalogue is missing ${!zeroed ? ZEROED_ID : CONTROL_ID}; cannot run`,
    );
  }
  // Sanity: the zeroed question must really be rich live, otherwise the
  // stub proves nothing about the transition to zero.
  check(
    `${ZEROED_ID}: live rowCount is non-zero before stubbing`,
    zeroed.rowCount > 0,
    `rowCount=${zeroed.rowCount}`,
  );

  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({
      viewport: { width: 1280, height: 900 },
    });
    // Fail fast with the failing URL/status instead of an opaque selector
    // timeout when the site itself fails to boot. The routes below only
    // mutate the response DATA (rowCount/rows), never inject a 5xx, so the
    // guard stays valid throughout this scenario.
    const guard = attachPageGuard(page);

    // Intercept the page's own API calls and zero out ONLY the target
    // question, keeping every other field exactly as the server sent it.
    await page.route("**/api/competency/questions", async (route) => {
      const res = await route.fetch();
      const body = (await res.json()) as { questions: CatalogueQuestion[] };
      for (const q of body.questions) {
        if (q.id === ZEROED_ID) q.rowCount = 0;
      }
      await route.fulfill({ response: res, json: body });
    });
    await page.route(
      `**/api/competency/questions/${ZEROED_ID}`,
      async (route) => {
        const res = await route.fetch();
        const body = (await res.json()) as { rows?: unknown[] };
        body.rows = [];
        await route.fulfill({ response: res, json: body });
      },
    );

    console.log("Sidebar: zeroed badge must render the dashed empty style");
    await page.goto(`${BASE_URL}/competency`, { waitUntil: "networkidle" });
    guard.assertPageLoaded();
    await guard.guarded(
      page.waitForFunction(
        () =>
          Array.from(document.querySelectorAll("button span[title]")).some(
            (s) => (s.getAttribute("title") ?? "").includes("result row"),
          ),
        undefined,
        { timeout: 30000 },
      ),
    );

    const readBadge = (questionText: string) =>
      page.evaluate((qt) => {
        const btn = Array.from(document.querySelectorAll("button")).find(
          (b) => (b.textContent ?? "").trim().startsWith(qt),
        );
        if (!btn) return null;
        const span = btn.querySelector("span[title]");
        if (!span || !(span.getAttribute("title") ?? "").includes("result row"))
          return null;
        return {
          text: (span.textContent ?? "").trim(),
          title: span.getAttribute("title") ?? "",
          dashed: span.classList.contains("border-dashed"),
        };
      }, questionText);

    const zeroBadge = await readBadge(zeroed.question);
    check("zeroed question: sidebar badge found", zeroBadge !== null);
    if (zeroBadge) {
      check(
        `zeroed question: badge shows "0"`,
        zeroBadge.text === "0",
        `text "${zeroBadge.text}"`,
      );
      check(
        "zeroed question: badge tooltip says 0 result rows",
        zeroBadge.title === "0 result rows",
        `title "${zeroBadge.title}"`,
      );
      check(
        "zeroed question: badge carries the dashed empty style",
        zeroBadge.dashed,
        "border-dashed class missing",
      );
    }

    const controlBadge = await readBadge(control.question);
    check("control question: sidebar badge found", controlBadge !== null);
    if (controlBadge) {
      check(
        "control question: badge is non-zero and NOT dashed",
        Number(controlBadge.text) > 0 && !controlBadge.dashed,
        `text "${controlBadge.text}" dashed=${controlBadge.dashed}`,
      );
    }

    console.log(
      "Results panel: zero rows must show the honest empty-state message",
    );
    const clicked = await page.evaluate((qt) => {
      const btn = Array.from(document.querySelectorAll("button")).find(
        (b) => (b.textContent ?? "").trim().startsWith(qt),
      );
      if (!btn) return false;
      btn.click();
      return true;
    }, zeroed.question);
    check("zeroed question: button clicked", clicked);

    // Wait for the Query Results panel heading (CSS-uppercased) to render.
    await guard.guarded(
      page.waitForFunction(
        () => /query results/i.test(document.body.innerText),
        undefined,
        { timeout: 30000 },
      ),
    );
    // Give the panel a moment; there must be nothing async left to add rows.
    await page.waitForTimeout(500);

    const panel = await page.evaluate(() => {
      const bodyText = document.body.innerText;
      const counter = bodyText.match(/(\d+)\s+rows?\b/);
      return {
        tbodyRows: document.querySelectorAll("tbody tr").length,
        counter: counter ? Number(counter[1]) : null,
        emptyMessage: bodyText.includes("This query returned no results."),
      };
    });
    check(
      `zeroed question: "N rows" counter reads 0`,
      panel.counter === 0,
      `counter=${panel.counter}`,
    );
    check(
      "zeroed question: no table rows rendered",
      panel.tbodyRows === 0,
      `tbody rows=${panel.tbodyRows}`,
    );
    check(
      `zeroed question: empty-state message "This query returned no results." shown`,
      panel.emptyMessage,
    );

    const urlQ = await page.evaluate(
      () => new URLSearchParams(window.location.search).get("q"),
    );
    check(`URL carries q=${ZEROED_ID}`, urlQ === ZEROED_ID, `q=${urlQ}`);
  } finally {
    await browser.close();
  }

  if (failures > 0) {
    console.error(`\n${failures} check(s) failed`);
    process.exit(1);
  }
  console.log("\nAll competency empty-state checks passed");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
