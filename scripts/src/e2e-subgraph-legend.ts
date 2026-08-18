/// <reference lib="dom" />
// The in-page callbacks (page.evaluate / waitForFunction) run in the
// browser, so this Node-side script needs the DOM lib for their types.
//
// Real-browser check of the subgraph legend on /competency. Per an
// explicit editorial decision (2026-08-09) the legend shows the ENGLISH
// school label only; the API payload keeps carrying the curated Greek
// forms for machine consumers. validate-subgraph-legend pins the source;
// this closes the rendered-DOM gap:
//
// For each checked question (stoa-members and school-doctrines):
// 1. API contract: fetch /api/competency/questions/:id and assert the
//    movements payload is non-empty and that every movement except the
//    "Unaffiliated" bucket carries a grc with real Greek-script letters.
// 2. Rendered DOM: load /competency?q=<id>, wait for the subgraph SVG and
//    its legend strip, and for every school movement assert its legend
//    row renders the English label visibly and contains NO lang="grc"
//    span (the Greek form must not leak back into the legend).
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

// Question ids to verify. stoa-members is the task's named example (a
// single Stoa legend row); school-doctrines fans out over several schools,
// so a regression that only hits multi-row legends cannot hide either.
const QUESTION_IDS = ["stoa-members", "school-doctrines"] as const;

// Greek letters (including the polytonic Extended block) that a real grc
// form must contain; rejects empty strings, whitespace, and Latin text.
const GREEK_RE = /[\u0370-\u03FF\u1F00-\u1FFF]/;

let failures = 0;
function check(label: string, ok: boolean, detail?: string) {
  if (ok) {
    console.log(`  ok: ${label}`);
  } else {
    failures++;
    console.error(`  FAIL: ${label}${detail ? ` (${detail})` : ""}`);
  }
}

interface Movement {
  id: string;
  label: string;
  grc?: string;
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({
      viewport: { width: 1280, height: 900 },
    });
    // Fail fast with the failing URL/status instead of an opaque selector
    // timeout when the site itself fails to boot.
    const guard = attachPageGuard(page);

    let greekRowsSeen = 0;

    for (const qid of QUESTION_IDS) {
      console.log(`Question ${qid}: legend must visibly show Greek school names`);

      // --- Layer 1: the API payload the legend consumes ---
      const res = await fetch(`${BASE_URL}/api/competency/questions/${qid}`);
      check(`${qid}: API responds 200`, res.ok, `${res.status}`);
      if (!res.ok) continue;
      const data = (await res.json()) as { movements?: Movement[] };
      const movements = data.movements ?? [];
      check(
        `${qid}: movements payload is non-empty (${movements.length})`,
        movements.length > 0,
      );

      const greekMovements = movements.filter(
        (m) => m.label !== "Unaffiliated",
      );
      const missing = greekMovements.filter(
        (m) => !m.grc || !GREEK_RE.test(m.grc),
      );
      check(
        `${qid}: every school movement carries a real Greek grc`,
        greekMovements.length > 0 && missing.length === 0,
        missing.length
          ? `missing grc for: ${missing.map((m) => m.label).join(", ")}`
          : `no school movements shipped`,
      );

      // --- Layer 2: the rendered legend strip ---
      await page.goto(`${BASE_URL}/competency?q=${qid}`, {
        waitUntil: "networkidle",
      });
      guard.assertPageLoaded();
      // Wait for the subgraph SVG (aria-label "Knowledge subgraph") — the
      // legend strip renders right below it in the same card.
      await guard.guarded(
        page.waitForSelector('svg[aria-label="Knowledge subgraph"]', {
          timeout: 30000,
        }),
      );
      await page.waitForTimeout(300);

      const rendered = await page.evaluate((expected: Movement[]) => {
        // NOTE: no named helper functions in this in-page block; tsx/esbuild
        // wraps them with a __name helper missing in the browser context.
        const svg = document.querySelector(
          'svg[aria-label="Knowledge subgraph"]',
        );
        const card = svg?.parentElement;
        // The legend strip is the card child after the svg, holding one
        // flex row <span> per movement.
        const legend = card
          ? Array.from(card.children).find(
              (el) => el !== svg && /teacher/i.test(el.textContent ?? ""),
            ) ?? (svg?.nextElementSibling as Element | null)
          : null;
        if (!legend) return { legendFound: false as const, results: [] };

        const results = expected.map((m) => {
          // The movement's legend row: the direct-child span whose text
          // starts with the English label.
          const row = Array.from(legend.children).find(
            (el) =>
              el.tagName === "SPAN" &&
              (el.textContent ?? "").trim().startsWith(m.label),
          );
          if (!row)
            return {
              label: m.label,
              rowFound: false,
              labelVisible: false,
              grcShown: null as string | null,
              grcVisible: false,
              why: "legend row not found",
            };
          const rowRect = row.getBoundingClientRect();
          const rowStyle = getComputedStyle(row);
          const labelVisible =
            rowStyle.display !== "none" &&
            rowStyle.visibility !== "hidden" &&
            parseFloat(rowStyle.opacity) > 0.05 &&
            rowRect.width > 1 &&
            rowRect.height > 1 &&
            rowRect.bottom > 0 &&
            rowRect.right > 0 &&
            rowRect.top < window.innerHeight * 4 &&
            rowRect.left < window.innerWidth;

          const grcEl = row.querySelector('[lang="grc"]');
          return {
            label: m.label,
            rowFound: true,
            labelVisible,
            grcPresent: grcEl !== null,
            grcShown: grcEl ? (grcEl.textContent ?? "").trim() : null,
            why: `rowRect=${Math.round(rowRect.width)}x${Math.round(rowRect.height)}`,
          };
        });
        return { legendFound: true as const, results };
      }, greekMovements);

      check(`${qid}: legend strip rendered`, rendered.legendFound);
      if (!rendered.legendFound) continue;

      for (const r of rendered.results) {
        check(
          `${qid}: legend row shows English label "${r.label}" (visible)`,
          r.rowFound && r.labelVisible,
          r.why,
        );
        check(
          `${qid}: "${r.label}" row carries NO lang="grc" span`,
          r.rowFound && !r.grcPresent,
          `rendered "${r.grcShown ?? "(none)"}"`,
        );
        if (r.rowFound && r.labelVisible) greekRowsSeen++;
      }
    }

    // Positive control: the run must have actually verified legend rows
    // somewhere, otherwise every per-row check went vacuous.
    check(
      `saw ${greekRowsSeen} visible legend row(s) across questions (must be > 0)`,
      greekRowsSeen > 0,
    );
    // Negative control: the Greek-form test itself must be able to fire.
    check(
      "negative control: a Latin-only string is not a real Greek form",
      !GREEK_RE.test("Stoa"),
    );
  } finally {
    await browser.close();
  }

  if (failures > 0) {
    console.error(`\n${failures} check(s) failed`);
    process.exit(1);
  }
  console.log("\nAll subgraph-legend visibility checks passed");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
