/// <reference lib="dom" />
// The in-page callbacks (page.evaluate / waitForFunction) run in the
// browser, so this Node-side script needs the DOM lib for their types.
//
// Real-browser check that pasting a WITHHELD Greek name into the Index
// filter still guides the reader instead of dead-ending on an empty
// list. The grc-withheld validator (validate-grc-withheld.ts) pins the
// (label, kind, form) pairs whose Greek nominative is deliberately
// withheld from the Index grc field by the collision guard in
// annotate.ts buildIndex; this script checks the READER side of that
// bargain: when a form is withheld from some bearers, the certified
// bearers of the same form must still surface (via their own grc or
// grcHomonymForm), so the paste is never an empty result. Forms with NO
// surfacing bearer at all (e.g. Ζεῦξις) instead grant grc to every
// bearer, so the paste lists ALL of them.
//
// 1. "Διονύσιος": withheld from Dionysius the Elder, the Younger and
//    the Stoic; the certified bearer Dionysius the Renegade
//    (philosopher) carries the grc, so the exact filter must list him
//    and the fallback must NOT kick in.
// 2. "Ἡρακλείδης": withheld from Heraclides of Tarsus and Heraclides
//    the Sceptic; Heraclides Ponticus (philosopher) carries the grc,
//    so the exact filter must list him.
// 3. "Ζήνων": withheld from Zeno of Tarsus (source); the certified
//    bearers (Zeno of Citium, Zeno of Elea, Zeno of Sidon) carry the
//    shared form, so the exact filter must list at least two Zenos.
// 4. Control: the unique form "Φαβωρῖνος" (no collision, grc passes
//    the guard) must exact-match Favorinus.
//
// Every scenario also asserts the result list is non-empty: the point
// of the check is that a withheld form never strands the reader.
//
// Requirements: the API server and web workflows must be running (the
// script talks to the shared proxy, default http://localhost:80), and a
// Chromium headless shell must be installed for playwright-core, e.g.:
//   PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright \
//     node scripts/node_modules/playwright-core/cli.js install chromium-headless-shell

// playwright-core resolves its browser registry at module import time
// from PLAYWRIGHT_BROWSERS_PATH; set it BEFORE importing playwright-core.
import "./lib/playwright-browsers-path";

const { chromium } = await import("playwright-core");
const { attachPageGuard } = await import("./lib/e2e-page-guard");

const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:80";

// Each scenario: a pasted Greek form, whether it is a withheld form
// (some bearer's grc is deliberately withheld) or the unique-form
// control, and the certified bearer labels that must appear.
type Scenario = {
  title: string;
  form: string;
  mustList: string[];
  minMatches: number;
};

const SCENARIOS: Scenario[] = [
  {
    title:
      'withheld form "Διονύσιος" (Elder/Younger/Stoic withheld) still surfaces the certified bearer',
    form: "Διονύσιος",
    mustList: ["Dionysius the Renegade"],
    minMatches: 1,
  },
  {
    title:
      'withheld form "Ἡρακλείδης" (of Tarsus / the Sceptic withheld) still surfaces the certified bearer',
    form: "Ἡρακλείδης",
    mustList: ["Heraclides Ponticus"],
    minMatches: 1,
  },
  {
    title:
      'withheld form "Ζήνων" (Zeno of Tarsus withheld) still lists the certified Zenos',
    form: "Ζήνων",
    mustList: ["Zeno of Citium"],
    minMatches: 2,
  },
  {
    title:
      'fully-withheld form "Ζεῦξις" (no philosopher or certified bearer) lists ALL bearers',
    form: "Ζεῦξις",
    mustList: ["Zeuxis", "Zeuxis Goniopus"],
    minMatches: 2,
  },
  {
    title: 'control: unique form "Φαβωρῖνος" exact-matches Favorinus',
    form: "Φαβωρῖνος",
    mustList: ["Favorinus"],
    minMatches: 1,
  },
];

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
    const page = await browser.newPage({
      viewport: { width: 1280, height: 720 },
    });
    // Fail fast with the failing URL/status instead of an opaque selector
    // timeout when the site itself fails to boot.
    const guard = attachPageGuard(page);

    // Load /entities?q=<form> and read what the reader sees: the card
    // labels in the grid (or the fallback suggestions) and whether the
    // "No exact match" fallback line appeared. Same reading pattern as
    // e2e-graph-unknown-name.ts, so a styling refactor that renames
    // classes cannot blind the check.
    const readIndexFor = async (needle: string) => {
      await page.goto(`${BASE_URL}/entities?q=${encodeURIComponent(needle)}`, {
        waitUntil: "networkidle",
      });
      guard.assertPageLoaded();
      // Wait for the entity list to arrive: either the result-count
      // line renders with cards, or the fallback line appears.
      await guard.guarded(
        page.waitForFunction(
          (name) => {
            const t = document.body.innerText;
            return (
              t.includes(`No exact match for \u201C${name}\u201D`) ||
              /\d+ tagged names? & terms/.test(t)
            );
          },
          needle,
          { timeout: 15000 },
        ),
      );
      await page.waitForTimeout(300);
      return page.evaluate((name) => {
        const labels = Array.from(
          document.querySelectorAll<HTMLButtonElement>("button"),
        )
          .map((b) => (b.querySelector("p")?.textContent ?? "").trim())
          .filter(Boolean);
        const input = Array.from(
          document.querySelectorAll<HTMLInputElement>('input[type="text"]'),
        ).find((i) => (i.placeholder ?? "").startsWith("Filter by name"));
        return {
          fallbackShown: document.body.innerText.includes(
            `No exact match for \u201C${name}\u201D`,
          ),
          labels,
          inputValue: input?.value ?? null,
        };
      }, needle);
    };

    for (const s of SCENARIOS) {
      console.log(`Scenario: ${s.title}`);
      const seen = await readIndexFor(s.form);
      check(
        "filter box is seeded with the pasted form",
        seen.inputValue === s.form,
        `value=${seen.inputValue}`,
      );
      check(
        "exact filter matches (no fallback line)",
        !seen.fallbackShown,
      );
      check(
        "result list is not empty (reader is not stranded)",
        seen.labels.length > 0,
      );
      check(
        `at least ${s.minMatches} bearer card(s) listed`,
        seen.labels.length >= s.minMatches,
        `labels=${JSON.stringify(seen.labels.slice(0, 12))}`,
      );
      for (const want of s.mustList) {
        check(
          `"${want}" is listed`,
          seen.labels.includes(want),
          `labels=${JSON.stringify(seen.labels.slice(0, 12))}`,
        );
      }
    }
  } finally {
    await browser.close();
  }

  if (failures > 0) {
    console.error(`\n${failures} check(s) failed`);
    process.exit(1);
  }
  console.log("\nAll withheld Greek name Index checks passed");
}

await main();
