/// <reference lib="dom" />
// The in-page callbacks (page.evaluate / waitForFunction) run in the
// browser, so this Node-side script needs the DOM lib for their types.
//
// Real-browser check of the Graph page's unknown-name notice: when
// /graph?p= names nobody (neither a KG node nor a school associate), the
// page shows a friendly notice instead of an empty side panel. The
// source-level validate-competency-graph-links pins the wiring, but only
// a live browser run can confirm the click flow. This script drives
// headless Chromium against the running dev servers:
//
// 1. Loading /graph?p=<bogus name> must show the notice quoting the name
//    ("No one in the graph is named ..."), with the "Look them up in the
//    Index" link, and no philosopher side panel.
// 2. Clicking the notice's dismiss (X) button must drop ?p= from the URL,
//    hide the notice, and bring back the empty-state "Select a
//    philosopher in the graph" panel.
// 3. Re-loading with the bogus name and clicking the Index link must land
//    on /entities with the filter box seeded with the name (from ?q=).
// 4. A near-miss spelling of a real philosopher ("Zenon" for Zeno) must
//    also show the notice, and following the Index link must not be a
//    dead end: the seeded /entities filter finds no exact match, so the
//    page's near-miss fallback must offer "closest names" suggestions
//    that include at least one real Zeno entry.
// 5. Greek script into the Index filter: entity labels are English, so a
//    pasted Greek form only works via the curated Greek homonym forms
//    (grcHomonymForm). The nominative "Ζήνων" must be an exact match
//    (the filter grid lists the Zeno bearers, no fallback needed), and
//    the genitive "Ζήνωνος", as copied from the running text, must fall
//    through to the closest-names suggestions and still name a real Zeno.
// 6. A NON-homonym Greek name: most philosophers share their Greek form
//    with nobody, so they carry no grcHomonymForm; the entity summaries
//    now expose the curated nominative itself (grc). The nominative
//    "Σωκράτης" must be an exact filter match listing Socrates, and the
//    genitive "Σωκράτους" must reach the closest-names fallback and
//    still surface Socrates.
// 7. A Greek PLACE name: place entries now carry the curated nominative
//    too (annotate.ts extends grc beyond philosophers to places, mention
//    persons and sources with an unambiguous curated form). The
//    nominative "Ἀθῆναι" must be an exact filter match listing Athens,
//    and the genitive "Ἀθηνῶν" must reach the closest-names fallback
//    and still surface Athens.
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
import { PAGE_HEADING_SELECTOR } from "./lib/card-headings";

const { chromium } = await import("playwright-core");
const { attachPageGuard } = await import("./lib/e2e-page-guard");

const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:80";

// A name that exists nowhere: neither a KG node nor a school associate.
const BOGUS = "Nobodyus of Nowhere";

// A realistic reader near-miss: "Zenon" (the Greek form's transliteration)
// for Zeno. It names no KG node or associate, so the notice must appear,
// and the Index fallback must still surface the real Zenos.
const NEAR_MISS = "Zenon";

// Greek-script input: the nominative shared by the Zenos (an exact match
// via the curated grcHomonymForm) and the genitive a reader would copy
// straight out of the running Greek text (a near-miss the closest-names
// fallback must resolve against the Greek forms).
const GREEK_NOMINATIVE = "Ζήνων";
const GREEK_GENITIVE = "Ζήνωνος";

// A non-homonym Greek name: Socrates shares his Greek form with nobody,
// so this only works through the summaries' own curated nominative (grc),
// not the shared homonym form.
const GREEK_NONHOM_NOMINATIVE = "Σωκράτης";
const GREEK_NONHOM_GENITIVE = "Σωκράτους";

// A Greek place name: labels are English ("Athens"), so a pasted Ἀθῆναι
// only matches through the place entry's own curated nominative (grc),
// which the summaries now expose for places too.
const GREEK_PLACE_NOMINATIVE = "Ἀθῆναι";
const GREEK_PLACE_GENITIVE = "Ἀθηνῶν";
const GREEK_PLACE_LABEL = "Athens";

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
    const guard = attachPageGuard(page);

    // The notice and the empty state are identified by their visible text,
    // not markup classes, so a styling refactor cannot blind the check.
    const noticeText = "No one in the graph is named";
    const emptyStateText = "Select a philosopher in the graph";
    const indexLinkText = "Look them up in the Index";

    const snapshot = () =>
      page.evaluate(
        ([notice, empty, linkText, headingSel]) => {
          const bodyText = document.body.innerText;
          const params = new URLSearchParams(window.location.search);
          const link =
            Array.from(document.querySelectorAll("a")).find((a) =>
              (a.textContent ?? "").includes(linkText),
            ) ?? null;
          return {
            noticeVisible: bodyText.includes(notice),
            emptyStateVisible: bodyText.includes(empty),
            indexLinkHref: link?.getAttribute("href") ?? null,
            p: params.get("p"),
            pathname: window.location.pathname,
            h2s: Array.from(document.querySelectorAll(headingSel)).map(
              (h) => (h.textContent ?? "").trim(),
            ),
          };
        },
        [
          noticeText,
          emptyStateText,
          indexLinkText,
          PAGE_HEADING_SELECTOR,
        ] as const,
      );

    console.log(
      `Scenario 1: /graph?p=${JSON.stringify(BOGUS)} shows the unknown-name notice`,
    );
    await page.goto(`${BASE_URL}/graph?p=${encodeURIComponent(BOGUS)}`, {
      waitUntil: "networkidle",
    });
    guard.assertPageLoaded();
    // Wait for the graph data to arrive: the notice branch only renders
    // once the page has a graph to check the name against.
    await guard.guarded(
      page.waitForFunction(
        (notice) => document.body.innerText.includes(notice),
        noticeText,
        { timeout: 30000 },
      ),
    );
    await page.waitForTimeout(300);

    const bad = await snapshot();
    check("notice is visible", bad.noticeVisible);
    check(
      "notice quotes the bogus name",
      await page.evaluate(
        (name) => document.body.innerText.includes(`\u201C${name}\u201D`),
        BOGUS,
      ),
    );
    check("?p= still in the URL before dismiss", bad.p === BOGUS, `p=${bad.p}`);
    check(
      "no philosopher side panel is open (no h2 naming the bogus value)",
      !bad.h2s.includes(BOGUS),
      `h2s=${JSON.stringify(bad.h2s)}`,
    );
    check("empty-state panel is not shown yet", !bad.emptyStateVisible);
    check(
      `"${indexLinkText}" link carries ?q=<name>`,
      bad.indexLinkHref === `/entities?q=${encodeURIComponent(BOGUS)}`,
      `href=${bad.indexLinkHref}`,
    );

    console.log(
      "Scenario 2: dismissing the notice drops ?p= and restores the empty state",
    );
    const dismissed = await page.evaluate(() => {
      const btn = document.querySelector<HTMLButtonElement>(
        'button[aria-label="Dismiss"]',
      );
      if (!btn) return false;
      btn.click();
      return true;
    });
    check("dismiss (X) button found and clicked", dismissed);
    await page.waitForFunction(
      () => new URLSearchParams(window.location.search).get("p") === null,
      undefined,
      { timeout: 5000 },
    );
    await page.waitForTimeout(300);

    const afterDismiss = await snapshot();
    check("?p= removed from the URL", afterDismiss.p === null);
    check("notice is gone", !afterDismiss.noticeVisible);
    check(
      "empty-state panel is back",
      afterDismiss.emptyStateVisible,
    );
    check("still on /graph", afterDismiss.pathname === "/graph");

    console.log(
      "Scenario 3: the Index link lands on /entities with the filter seeded",
    );
    await page.goto(`${BASE_URL}/graph?p=${encodeURIComponent(BOGUS)}`, {
      waitUntil: "networkidle",
    });
    guard.assertPageLoaded();
    await guard.guarded(
      page.waitForFunction(
        (notice) => document.body.innerText.includes(notice),
        noticeText,
        { timeout: 30000 },
      ),
    );
    // Click the Index link via a bubbling MouseEvent (wouter handles the
    // client-side navigation).
    const linkClicked = await page.evaluate((linkText) => {
      const a = Array.from(document.querySelectorAll("a")).find((el) =>
        (el.textContent ?? "").includes(linkText),
      );
      if (!a) return false;
      a.dispatchEvent(
        new MouseEvent("click", { bubbles: true, cancelable: true }),
      );
      return true;
    }, indexLinkText);
    check("Index link found and clicked", linkClicked);
    await page.waitForFunction(
      () => window.location.pathname === "/entities",
      undefined,
      { timeout: 10000 },
    );
    // The filter input is the text box with the "Filter by name" placeholder;
    // it must be seeded with the bogus name from ?q=.
    const seeded = await page
      .waitForFunction(
        (name) => {
          const input = Array.from(
            document.querySelectorAll<HTMLInputElement>('input[type="text"]'),
          ).find((i) => (i.placeholder ?? "").startsWith("Filter by name"));
          return !!input && input.value === name;
        },
        BOGUS,
        { timeout: 10000 },
      )
      .then(
        () => true,
        () => false,
      );
    check("filter box is seeded with the bogus name", seeded);
    const entitiesState = await page.evaluate(() => {
      const params = new URLSearchParams(window.location.search);
      const input = Array.from(
        document.querySelectorAll<HTMLInputElement>('input[type="text"]'),
      ).find((i) => (i.placeholder ?? "").startsWith("Filter by name"));
      return {
        q: params.get("q"),
        inputValue: input?.value ?? null,
        pathname: window.location.pathname,
      };
    });
    check("landed on /entities", entitiesState.pathname === "/entities");
    check(
      "?q= carries the name in the URL",
      entitiesState.q === BOGUS,
      `q=${entitiesState.q}`,
    );
    check(
      "filter input value matches the name",
      entitiesState.inputValue === BOGUS,
      `value=${entitiesState.inputValue}`,
    );

    console.log(
      `Scenario 4: near-miss ${JSON.stringify(NEAR_MISS)} gets the notice and a useful Index lead`,
    );
    await page.goto(`${BASE_URL}/graph?p=${encodeURIComponent(NEAR_MISS)}`, {
      waitUntil: "networkidle",
    });
    guard.assertPageLoaded();
    await guard.guarded(
      page.waitForFunction(
        (notice) => document.body.innerText.includes(notice),
        noticeText,
        { timeout: 30000 },
      ),
    );
    check(
      "notice quotes the near-miss name",
      await page.evaluate(
        (name) => document.body.innerText.includes(`\u201C${name}\u201D`),
        NEAR_MISS,
      ),
    );
    const nearMissLinkClicked = await page.evaluate((linkText) => {
      const a = Array.from(document.querySelectorAll("a")).find((el) =>
        (el.textContent ?? "").includes(linkText),
      );
      if (!a) return false;
      a.dispatchEvent(
        new MouseEvent("click", { bubbles: true, cancelable: true }),
      );
      return true;
    }, indexLinkText);
    check("Index link found and clicked", nearMissLinkClicked);
    await page.waitForFunction(
      () => window.location.pathname === "/entities",
      undefined,
      { timeout: 10000 },
    );
    // The exact substring filter has no match for "Zenon", so the page's
    // near-miss fallback must kick in: the "No exact match" line plus at
    // least one real Zeno among the suggested closest names.
    const fallbackShown = await page
      .waitForFunction(
        (name) =>
          document.body.innerText.includes(`No exact match for \u201C${name}\u201D`),
        NEAR_MISS,
        { timeout: 10000 },
      )
      .then(
        () => true,
        () => false,
      );
    check('"No exact match" fallback line is shown', fallbackShown);
    const nearMissState = await page.evaluate(() => {
      const input = Array.from(
        document.querySelectorAll<HTMLInputElement>('input[type="text"]'),
      ).find((i) => (i.placeholder ?? "").startsWith("Filter by name"));
      const buttons = Array.from(
        document.querySelectorAll<HTMLButtonElement>("button"),
      )
        .map((b) => (b.querySelector("p")?.textContent ?? "").trim())
        .filter(Boolean);
      return { inputValue: input?.value ?? null, suggestionLabels: buttons };
    });
    check(
      "filter box is seeded with the near-miss name",
      nearMissState.inputValue === NEAR_MISS,
      `value=${nearMissState.inputValue}`,
    );
    check(
      "suggestions include at least one real Zeno entry",
      nearMissState.suggestionLabels.some((l) => l.startsWith("Zeno")),
      `labels=${JSON.stringify(nearMissState.suggestionLabels.slice(0, 12))}`,
    );

    console.log(
      `Scenario 5: Greek script ${JSON.stringify(GREEK_NOMINATIVE)} / ${JSON.stringify(GREEK_GENITIVE)} still find their bearers in the Index`,
    );
    // Helper: load /entities?q=<needle> and read what the reader sees:
    // the exact-filter card labels, whether the "No exact match" fallback
    // line appeared, and (if so) the suggested closest names.
    const readIndexFor = async (needle: string) => {
      await page.goto(
        `${BASE_URL}/entities?q=${encodeURIComponent(needle)}`,
        { waitUntil: "networkidle" },
      );
      guard.assertPageLoaded();
      // Wait for the entity list to arrive: either the result-count line
      // renders with cards, or the fallback line appears.
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
        return {
          fallbackShown: document.body.innerText.includes(
            `No exact match for \u201C${name}\u201D`,
          ),
          labels,
        };
      }, needle);
    };

    // 5a. Nominative "Ζήνων": an exact match via the curated Greek
    // homonym form, so the plain filter grid must list the Zeno bearers
    // and the fallback must NOT kick in.
    const nom = await readIndexFor(GREEK_NOMINATIVE);
    check(
      "nominative: exact filter matches (no fallback line)",
      !nom.fallbackShown,
    );
    check(
      "nominative: filter grid lists at least two Zeno bearers",
      nom.labels.filter((l) => l.startsWith("Zeno")).length >= 2,
      `labels=${JSON.stringify(nom.labels.slice(0, 12))}`,
    );
    check(
      "nominative: Zeno of Citium is among them",
      nom.labels.includes("Zeno of Citium"),
      `labels=${JSON.stringify(nom.labels.slice(0, 12))}`,
    );

    // 5b. Genitive "Ζήνωνος" (the form a reader actually copies from the
    // running text): no exact substring match, so the closest-names
    // fallback must compare against the Greek forms and still surface
    // the real Zenos.
    const gen = await readIndexFor(GREEK_GENITIVE);
    check(
      "genitive: falls through to the closest-names fallback",
      gen.fallbackShown,
    );
    check(
      "genitive: suggestions include at least one real Zeno entry",
      gen.labels.some((l) => l.startsWith("Zeno")),
      `labels=${JSON.stringify(gen.labels.slice(0, 12))}`,
    );

    console.log(
      `Scenario 6: non-homonym Greek name ${JSON.stringify(GREEK_NONHOM_NOMINATIVE)} / ${JSON.stringify(GREEK_NONHOM_GENITIVE)} find Socrates via the curated nominative`,
    );
    // 6a. Nominative "Σωκράτης": no shared homonym form exists for
    // Socrates, so this exact match can only come from the summaries'
    // own curated Greek nominative (grc).
    const nonHomNom = await readIndexFor(GREEK_NONHOM_NOMINATIVE);
    check(
      "non-homonym nominative: exact filter matches (no fallback line)",
      !nonHomNom.fallbackShown,
    );
    check(
      "non-homonym nominative: Socrates is listed",
      nonHomNom.labels.includes("Socrates"),
      `labels=${JSON.stringify(nonHomNom.labels.slice(0, 12))}`,
    );

    // 6b. Genitive "Σωκράτους" (a close inflection a reader copies from
    // the running text): no exact substring match, so the closest-names
    // fallback must compare against the curated nominative and still
    // surface Socrates.
    const nonHomGen = await readIndexFor(GREEK_NONHOM_GENITIVE);
    check(
      "non-homonym genitive: falls through to the closest-names fallback",
      nonHomGen.fallbackShown,
    );
    check(
      "non-homonym genitive: suggestions include Socrates",
      nonHomGen.labels.includes("Socrates"),
      `labels=${JSON.stringify(nonHomGen.labels.slice(0, 12))}`,
    );

    console.log(
      `Scenario 7: Greek place name ${JSON.stringify(GREEK_PLACE_NOMINATIVE)} / ${JSON.stringify(GREEK_PLACE_GENITIVE)} find ${GREEK_PLACE_LABEL} via the curated nominative`,
    );
    // 7a. Nominative "Ἀθῆναι": the place label is English ("Athens"),
    // so this exact match can only come from the place entry's own
    // curated Greek nominative (grc), newly exposed for places.
    const placeNom = await readIndexFor(GREEK_PLACE_NOMINATIVE);
    check(
      "place nominative: exact filter matches (no fallback line)",
      !placeNom.fallbackShown,
    );
    check(
      `place nominative: ${GREEK_PLACE_LABEL} is listed`,
      placeNom.labels.includes(GREEK_PLACE_LABEL),
      `labels=${JSON.stringify(placeNom.labels.slice(0, 12))}`,
    );

    // 7b. Genitive "Ἀθηνῶν" (the inflection a reader copies from the
    // running text): no exact substring match, so the closest-names
    // fallback must compare against the curated nominative and still
    // surface Athens.
    const placeGen = await readIndexFor(GREEK_PLACE_GENITIVE);
    check(
      "place genitive: falls through to the closest-names fallback",
      placeGen.fallbackShown,
    );
    check(
      `place genitive: suggestions include ${GREEK_PLACE_LABEL}`,
      placeGen.labels.includes(GREEK_PLACE_LABEL),
      `labels=${JSON.stringify(placeGen.labels.slice(0, 12))}`,
    );
  } finally {
    await browser.close();
  }

  if (failures > 0) {
    console.error(`\n${failures} check(s) failed`);
    process.exit(1);
  }
  console.log("\nAll graph unknown-name notice checks passed");
}

await main();
