/// <reference lib="dom" />
// Real-browser check that a citation chip in a synthesized (generative)
// Ask answer opens the EXACT cited passage in the reader.
//
// The generative Ask answer (artifacts/laertius/src/pages/ask.tsx) renders
// inline [D.L. <section-id>] citations as chips (CitationChip inside
// CitedParagraph, plus a "Cited:" footer row) linking to /section/<id>.
// The backend guardrail is validated at the data level
// (scripts/src/validate-ask-generative.ts), but nothing proved in a
// browser that clicking a chip actually lands the reader on the cited
// section. A regression in the chip's href building, the inline-citation
// regex, wouter base handling, or the /section/:id route could leave the
// backend validator green while every chip opens the wrong page.
//
// No LLM is configured in this environment, so the /api/ask response is
// intercepted in the page: the REAL API response is fetched through
// route.fetch() and mutated (never replaced wholesale), keeping the
// payload schema-true while injecting a deterministic `generated` answer
// that cites a section id taken from the response's own passages.
//
// Scenarios:
//  1. Generative answer: inject `generated` citing the top passage's
//     section id, submit a question via /ask?q=…, assert the generated
//     answer card renders with citation chips (inline + footer), that the
//     fallback notice is ABSENT, click the inline chip, and assert the SPA
//     lands on /section/<id> showing exactly that passage (Book/Chapter/
//     Section line and philosopher cross-checked against GET
//     /api/sections/<id>).
//     Fail-path proof (mutated selector): a mutated data-testid
//     (citation-chip-<id>-MUTATED-CONTROL) must match ZERO elements, so
//     the chip assertions cannot pass vacuously; and the chip's href must
//     name the cited id, proven by rejecting a mutated id.
//  2. Extractive fallback: strip `generated` from the same real response
//     and assert the extractive card renders with the fallback notice
//     (data-testid="extractive-fallback-notice") visible and no generated
//     answer card present.
//
// Requirements: the API server and laertius web workflows must be running
// behind the shared proxy (default http://localhost:80), and a Chromium
// headless shell must be installed for playwright-core, e.g.:
//   PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright \
//     node scripts/node_modules/playwright-core/cli.js install chromium-headless-shell

import "./lib/playwright-browsers-path";

const { chromium } = await import("playwright-core");
const { attachPageGuard } = await import("./lib/e2e-page-guard");
import type { Page } from "playwright-core";

const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:80";
const QUESTION = "How did Socrates die?";

let failures = 0;
function check(label: string, ok: boolean, detail?: string) {
  if (ok) {
    console.log(`  ok: ${label}`);
  } else {
    failures++;
    console.error(`  FAIL: ${label}${detail ? ` (${detail})` : ""}`);
  }
}

interface AskPassage {
  id: string;
  philosopher: string;
  book: number;
  chapter: string;
  section: string;
}

async function main() {
  // ——— Preflight & positive controls, from the live API ———
  const askRes = await fetch(`${BASE_URL}/api/ask`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ query: QUESTION, topK: 5 }),
  });
  if (!askRes.ok) {
    throw new Error(
      `POST /api/ask returned ${askRes.status}; are the api-server and web workflows running?`,
    );
  }
  const askData = (await askRes.json()) as {
    passages: AskPassage[];
    generated?: unknown;
  };
  check(
    "live /api/ask returns at least one passage (positive control)",
    Array.isArray(askData.passages) && askData.passages.length > 0,
  );
  const target = askData.passages[0];
  if (!target) throw new Error("no passages retrieved; cannot pick a citation target");
  const sectionId = target.id;
  check(
    `target section id "${sectionId}" matches the inline-citation id shape`,
    /^[0-9]+(?:\.[0-9a-zA-Z-]+)+$/.test(sectionId),
  );

  // Ground truth for the reader landing: the section as the API serves it.
  const secRes = await fetch(`${BASE_URL}/api/sections/${sectionId}`);
  check(
    `GET /api/sections/${sectionId} resolves (positive control)`,
    secRes.ok,
    `status ${secRes.status}`,
  );
  const section = (await secRes.json()) as AskPassage;

  const browser = await chromium.launch({ headless: true });
  try {
    // ============ Scenario 1: generative answer, chip click-through ============
    console.log("Scenario 1: synthesized answer's citation chip opens the cited passage");
    {
      const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
      const guard = attachPageGuard(page);

      // Mutate the REAL response: inject a deterministic generated answer
      // citing the known section id (schema-true payload, real passages).
      await page.route("**/api/ask", async (route) => {
        const res = await route.fetch();
        const body = (await res.json()) as Record<string, unknown>;
        body["answerMode"] = "generative";
        body["generated"] = {
          text:
            `According to Diogenes Laertius, the account of this death is preserved ` +
            `in the Lives [D.L. ${sectionId}].`,
          citations: [{ sectionId, label: `D.L. ${sectionId}` }],
          model: "e2e-stub-model",
        };
        await route.fulfill({ response: res, json: body });
      });

      await page.goto(`${BASE_URL}/ask?q=${encodeURIComponent(QUESTION)}`, {
        waitUntil: "networkidle",
      });
      guard.assertPageLoaded();
      await guard.guarded(
        page.waitForSelector('[data-testid="generated-answer"]', { timeout: 30000 }),
      );
      check("generated answer card rendered", true);

      // Fallback notice must NOT show alongside a generated answer.
      const noticeCount = await page
        .locator('[data-testid="extractive-fallback-notice"]')
        .count();
      check("extractive fallback notice is absent for a generated answer", noticeCount === 0);

      // Chips: one inline (from CitedParagraph) + one in the "Cited:" footer.
      const chip = page.locator(`[data-testid="citation-chip-${sectionId}"]`);
      const chipCount = await chip.count();
      check(
        `citation chips for ${sectionId} rendered inline AND in the footer`,
        chipCount >= 2,
        `found ${chipCount}`,
      );

      // Fail-path proof: a mutated selector must match nothing, so the
      // assertions above cannot pass vacuously against arbitrary markup.
      const mutatedCount = await page
        .locator(`[data-testid="citation-chip-${sectionId}-MUTATED-CONTROL"]`)
        .count();
      check(
        "negative control: mutated chip selector matches ZERO elements",
        mutatedCount === 0,
        `found ${mutatedCount}`,
      );

      // The chip's href must target exactly the cited section.
      const href = (await chip.first().getAttribute("href")) ?? "";
      check(
        `chip href targets /section/${sectionId} exactly`,
        href.endsWith(`/section/${sectionId}`),
        `href="${href}"`,
      );
      check(
        "negative control: chip href does NOT match a mutated id",
        !href.endsWith(`/section/${sectionId}9`),
      );

      // Click the INLINE chip (first occurrence, inside the prose).
      await chip.first().click();
      await guard.guarded(
        page.waitForFunction(
          (id: string) => {
            const p = window.location.pathname.replace(/\/$/, "");
            return p.endsWith(`/section/${id}`);
          },
          sectionId,
          { timeout: 15000 },
        ),
      );
      check(`SPA navigated to /section/${sectionId}`, true);

      // The reader must show EXACTLY the cited passage: philosopher heading
      // and the Book/Chapter/Section line, cross-checked against the API.
      const expectedLine = `Book ${section.book}, Chapter ${section.chapter}, Section ${section.section}`;
      await guard.guarded(
        page.waitForFunction(
          (args: { philosopher: string; line: string }) => {
            const h1 = document.querySelector("h1")?.textContent ?? "";
            return (
              h1.includes(args.philosopher) &&
              (document.body.textContent ?? "").includes(args.line)
            );
          },
          { philosopher: section.philosopher, line: expectedLine },
          { timeout: 15000 },
        ),
      );
      check(
        `reader shows ${section.philosopher} — "${expectedLine}" (the exact cited passage)`,
        true,
      );
      await page.close();
    }

    // ============ Scenario 2: extractive fallback notice ============
    console.log("Scenario 2: extractive fallback notice when no generated answer is present");
    {
      const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
      const guard = attachPageGuard(page);

      // Mutate the real response: strip any generated answer.
      await page.route("**/api/ask", async (route) => {
        const res = await route.fetch();
        const body = (await res.json()) as Record<string, unknown>;
        delete body["generated"];
        body["answerMode"] = "extractive";
        await route.fulfill({ response: res, json: body });
      });

      await page.goto(`${BASE_URL}/ask?q=${encodeURIComponent(QUESTION)}`, {
        waitUntil: "networkidle",
      });
      guard.assertPageLoaded();
      await guard.guarded(
        page.waitForSelector('[data-testid="extractive-answer"]', { timeout: 30000 }),
      );

      const noticeVisible = await page.evaluate(() => {
        const el = document.querySelector(
          '[data-testid="extractive-fallback-notice"]',
        ) as HTMLElement | null;
        return !!el && el.checkVisibility();
      });
      check("extractive fallback notice is visible", noticeVisible);

      const generatedCount = await page
        .locator('[data-testid="generated-answer"]')
        .count();
      check("no generated answer card in fallback mode", generatedCount === 0);

      // Fail-path proof for this scenario's selector too.
      const mutatedNotice = await page
        .locator('[data-testid="extractive-fallback-notice-MUTATED-CONTROL"]')
        .count();
      check(
        "negative control: mutated notice selector matches ZERO elements",
        mutatedNotice === 0,
      );
      await page.close();
    }
  } finally {
    await browser.close();
  }

  if (failures > 0) {
    console.error(`\ne2e-citation-chip: ${failures} check(s) FAILED`);
    process.exit(1);
  }
  console.log("\ne2e-citation-chip: all checks passed");
}

main().catch((err) => {
  console.error("e2e-citation-chip crashed:", err);
  process.exit(1);
});
