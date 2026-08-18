/// <reference lib="dom" />
// The in-page callbacks (page.evaluate / waitForFunction) run in the
// browser, so this Node-side script needs the DOM lib for their types.
//
// Real-browser check that the curated Greek nominative (grc) really
// appears on the Index page's three surfaces, and that the
// no-duplication guard holds for homonym bearers whose own grc equals
// the shared homonym form:
//
// 1. Plato's Index card must carry a Greek line with "Πλάτων".
// 2. Clicking Plato's card must open the selected-entity panel with an
//    h2 "Plato" and the Greek nominative "Πλάτων" beside it.
// 3. A Zeno homonym (Zeno of Citium, whose grc equals the shared
//    grcHomonymForm "Ζήνων") must show ONLY the "shares the name" line
//    on its card — never a second standalone Greek line — and its
//    selected panel must show the "Shares the Greek name" box but no
//    duplicate nominative next to the heading.
// 4. The closest-names suggestion cards (reached via a near-miss like
//    "Platon") must carry the Greek form too: the suggested Plato card
//    must include "Πλάτων".
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

const PLATO_LABEL = "Plato";
const PLATO_GRC = "Πλάτων";
// A near-miss spelling that matches nothing exactly, so the Index falls
// through to the closest-names suggestions, which must include Plato.
const PLATO_NEAR_MISS = "Platon";

// A homonym bearer whose own curated nominative equals the shared Greek
// form: the card must show the "shares the name" line and NOT a second
// standalone Greek line with the same text.
const ZENO_LABEL = "Zeno of Citium";
const ZENO_GRC = "Ζήνων";

// Uncertified namesakes: the two Zeuxis bearers share the fully-withheld
// Greek form Ζεῦξις but carry NO owl:differentFrom axiom, so cards must
// show "same name Ζεῦξις (uncertified)" and the panel the softer
// "Bears the same Greek name … as …" wording with the
// "Possibly distinct individuals" footnote.
const ZEUXIS_FILTER = "Zeuxis";
const ZEUXIS_GRC = "Ζεῦξις";

// Certified namesakes recently promoted from the soft wording: the two
// comic poets share Κρατῖνος and DO carry owl:differentFrom axioms, so
// cards must show the certified "shares the name" wording, the panels
// the "Shares the Greek name … with …" box + "Distinct individuals"
// footnote with working cross-links, and pasting the Greek form itself
// must surface both cards.
const CRATINUS_FILTER = "Cratinus";
const CRATINUS_LABELS = ["Cratinus", "Cratinus the Younger"];
const CRATINUS_GRC = "Κρατῖνος";

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

    // Load /entities?q=<needle>, wait for either the result grid or the
    // fallback line, then read every card (button in the grid) as
    // { label, lines } where lines are the card's text rows.
    const readCards = async (needle: string) => {
      await page.goto(`${BASE_URL}/entities?q=${encodeURIComponent(needle)}`, {
        waitUntil: "networkidle",
      });
      guard.assertPageLoaded();
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
          { timeout: 30000 },
        ),
      );
      await page.waitForTimeout(300);
      return page.evaluate((name) => {
        const cards = Array.from(
          document.querySelectorAll<HTMLButtonElement>("button"),
        )
          .filter((b) => b.querySelector("p"))
          .map((b) => {
            const ps = Array.from(b.querySelectorAll("p")).map((p) =>
              (p.textContent ?? "").trim(),
            );
            return { label: ps[0] ?? "", lines: ps };
          });
        return {
          fallbackShown: document.body.innerText.includes(
            `No exact match for \u201C${name}\u201D`,
          ),
          cards,
        };
      }, needle);
    };

    console.log(
      `Scenario 1: ${PLATO_LABEL}'s Index card carries the Greek nominative ${PLATO_GRC}`,
    );
    const platoIndex = await readCards(PLATO_LABEL);
    check("exact filter matches (no fallback line)", !platoIndex.fallbackShown);
    const platoCard = platoIndex.cards.find((c) => c.label === PLATO_LABEL);
    check("Plato card is listed", !!platoCard);
    check(
      `Plato card has a Greek line "${PLATO_GRC}"`,
      !!platoCard && platoCard.lines.includes(PLATO_GRC),
      `lines=${JSON.stringify(platoCard?.lines)}`,
    );
    check(
      "Plato card has no 'shares the name' line (he is no homonym)",
      !!platoCard && !platoCard.lines.some((l) => l.includes("shares the name")),
      `lines=${JSON.stringify(platoCard?.lines)}`,
    );

    console.log(
      "Scenario 2: clicking the card opens the selected panel with the Greek nominative",
    );
    const platoClicked = await page.evaluate((label) => {
      const btn = Array.from(
        document.querySelectorAll<HTMLButtonElement>("button"),
      ).find((b) => (b.querySelector("p")?.textContent ?? "").trim() === label);
      if (!btn) return false;
      btn.click();
      return true;
    }, PLATO_LABEL);
    check("Plato card found and clicked", platoClicked);
    await page.waitForFunction(
      ([label, sel]) =>
        Array.from(document.querySelectorAll(sel)).some(
          (h) => (h.textContent ?? "").trim() === label,
        ),
      [PLATO_LABEL, PAGE_HEADING_SELECTOR] as const,
      { timeout: 15000 },
    );
    await page.waitForTimeout(300);
    const platoPanel = await page.evaluate(([label, sel]) => {
      const h2 = Array.from(document.querySelectorAll(sel)).find(
        (h) => (h.textContent ?? "").trim() === label,
      );
      const header = h2?.parentElement;
      return {
        headerText: header ? (header.textContent ?? "") : null,
        entityParam: new URLSearchParams(window.location.search).get("entity"),
      };
    }, [PLATO_LABEL, PAGE_HEADING_SELECTOR] as const);
    check(
      "panel heading row shows the Greek nominative",
      !!platoPanel.headerText && platoPanel.headerText.includes(PLATO_GRC),
      `header=${JSON.stringify(platoPanel.headerText)}`,
    );
    check(
      "?entity= is set in the URL",
      platoPanel.entityParam !== null,
      `entity=${platoPanel.entityParam}`,
    );

    console.log(
      `Scenario 3: homonym ${ZENO_LABEL} shows only the "shares the name" line (no duplicate Greek line)`,
    );
    const zenoIndex = await readCards(ZENO_LABEL);
    const zenoCard = zenoIndex.cards.find((c) => c.label === ZENO_LABEL);
    check("Zeno of Citium card is listed", !!zenoCard);
    check(
      `Zeno card has the "shares the name ${ZENO_GRC}" line`,
      !!zenoCard &&
        zenoCard.lines.some(
          (l) => l.includes("shares the name") && l.includes(ZENO_GRC),
        ),
      `lines=${JSON.stringify(zenoCard?.lines)}`,
    );
    check(
      "Zeno card has NO standalone Greek line (grc equals the shared form)",
      !!zenoCard &&
        !zenoCard.lines.some(
          (l) => l.includes(ZENO_GRC) && !l.includes("shares the name"),
        ),
      `lines=${JSON.stringify(zenoCard?.lines)}`,
    );
    check(
      "the shared form appears exactly once on the card",
      !!zenoCard &&
        zenoCard.lines.filter((l) => l.includes(ZENO_GRC)).length === 1,
      `lines=${JSON.stringify(zenoCard?.lines)}`,
    );

    // The selected panel for the homonym: the "Shares the Greek name" box
    // must show, but the heading row must NOT repeat the nominative.
    const zenoClicked = await page.evaluate((label) => {
      const btn = Array.from(
        document.querySelectorAll<HTMLButtonElement>("button"),
      ).find((b) => (b.querySelector("p")?.textContent ?? "").trim() === label);
      if (!btn) return false;
      btn.click();
      return true;
    }, ZENO_LABEL);
    check("Zeno of Citium card found and clicked", zenoClicked);
    await page.waitForFunction(
      ([label, sel]) =>
        Array.from(document.querySelectorAll(sel)).some(
          (h) => (h.textContent ?? "").trim() === label,
        ),
      [ZENO_LABEL, PAGE_HEADING_SELECTOR] as const,
      { timeout: 15000 },
    );
    await page.waitForTimeout(300);
    const zenoPanel = await page.evaluate(([label, sel]) => {
      const h2 = Array.from(document.querySelectorAll(sel)).find(
        (h) => (h.textContent ?? "").trim() === label,
      );
      const header = h2?.parentElement;
      return {
        headerText: header ? (header.textContent ?? "") : null,
        bodyText: document.body.innerText,
      };
    }, [ZENO_LABEL, PAGE_HEADING_SELECTOR] as const);
    check(
      "panel heading row does NOT repeat the shared Greek form",
      !!zenoPanel.headerText && !zenoPanel.headerText.includes(ZENO_GRC),
      `header=${JSON.stringify(zenoPanel.headerText)}`,
    );
    check(
      `panel shows the "Shares the Greek name ${ZENO_GRC}" box`,
      zenoPanel.bodyText.includes("Shares the Greek name") &&
        zenoPanel.bodyText.includes(ZENO_GRC),
    );
    check(
      "certified panel shows the owl:differentFrom footnote",
      zenoPanel.bodyText.includes("Distinct individuals") &&
        zenoPanel.bodyText.includes("owl:differentFrom"),
    );
    check(
      "certified panel does NOT show the uncertified wording",
      !zenoPanel.bodyText.includes("Bears the same Greek name") &&
        !zenoPanel.bodyText.includes("Possibly distinct individuals"),
    );

    console.log(
      `Scenario 4: uncertified namesakes (${ZEUXIS_FILTER}) show the softer wording on cards and in the panel`,
    );
    const zeuxisIndex = await readCards(ZEUXIS_FILTER);
    check(
      "Zeuxis filter matches exactly (no fallback line)",
      !zeuxisIndex.fallbackShown,
    );
    const zeuxisCards = zeuxisIndex.cards.filter((c) =>
      c.label.startsWith("Zeuxis"),
    );
    check(
      "both Zeuxis bearers are listed",
      zeuxisCards.length >= 2,
      `labels=${JSON.stringify(zeuxisCards.map((c) => c.label))}`,
    );
    for (const card of zeuxisCards) {
      check(
        `card "${card.label}" shows "same name ${ZEUXIS_GRC} (uncertified)"`,
        card.lines.some(
          (l) =>
            l.includes("same name") &&
            l.includes(ZEUXIS_GRC) &&
            l.includes("(uncertified)"),
        ),
        `lines=${JSON.stringify(card.lines)}`,
      );
      check(
        `card "${card.label}" does NOT use the certified "shares the name" wording`,
        !card.lines.some((l) => l.includes("shares the name")),
        `lines=${JSON.stringify(card.lines)}`,
      );
    }

    const zeuxisLabel = zeuxisCards[0]?.label ?? "Zeuxis";
    const zeuxisClicked = await page.evaluate((label) => {
      const btn = Array.from(
        document.querySelectorAll<HTMLButtonElement>("button"),
      ).find((b) => (b.querySelector("p")?.textContent ?? "").trim() === label);
      if (!btn) return false;
      btn.click();
      return true;
    }, zeuxisLabel);
    check(`Zeuxis card "${zeuxisLabel}" found and clicked`, zeuxisClicked);
    await page.waitForFunction(
      ([label, sel]) =>
        Array.from(document.querySelectorAll(sel)).some(
          (h) => (h.textContent ?? "").trim() === label,
        ),
      [zeuxisLabel, PAGE_HEADING_SELECTOR] as const,
      { timeout: 15000 },
    );
    await page.waitForTimeout(300);
    const zeuxisPanel = await page.evaluate(() => document.body.innerText);
    check(
      `panel shows "Bears the same Greek name ${ZEUXIS_GRC}" (uncertified wording)`,
      zeuxisPanel.includes("Bears the same Greek name") &&
        zeuxisPanel.includes(ZEUXIS_GRC),
    );
    check(
      'panel shows the "Possibly distinct individuals" footnote',
      zeuxisPanel.includes("Possibly distinct individuals"),
    );
    check(
      "uncertified panel does NOT show the certified wording",
      !zeuxisPanel.includes("Shares the Greek name") &&
        !zeuxisPanel.includes("owl:differentFrom"),
    );

    console.log(
      `Scenario 5: certified namesakes (${CRATINUS_FILTER}) show the certified wording, cross-links and Greek-form filtering`,
    );
    const cratinusIndex = await readCards(CRATINUS_FILTER);
    check(
      "Cratinus filter matches exactly (no fallback line)",
      !cratinusIndex.fallbackShown,
    );
    for (const label of CRATINUS_LABELS) {
      const card = cratinusIndex.cards.find((c) => c.label === label);
      check(`card "${label}" is listed`, !!card);
      check(
        `card "${label}" shows the certified "shares the name ${CRATINUS_GRC}" line`,
        !!card &&
          card.lines.some(
            (l) => l.includes("shares the name") && l.includes(CRATINUS_GRC),
          ),
        `lines=${JSON.stringify(card?.lines)}`,
      );
      check(
        `card "${label}" does NOT use the uncertified "same name … (uncertified)" wording`,
        !!card && !card.lines.some((l) => l.includes("(uncertified)")),
        `lines=${JSON.stringify(card?.lines)}`,
      );
    }

    // Panel for the elder Cratinus: certified wording + owl:differentFrom
    // footnote, and a working cross-link to Cratinus the Younger.
    const cratinusClicked = await page.evaluate((label) => {
      const btn = Array.from(
        document.querySelectorAll<HTMLButtonElement>("button"),
      ).find((b) => (b.querySelector("p")?.textContent ?? "").trim() === label);
      if (!btn) return false;
      btn.click();
      return true;
    }, CRATINUS_LABELS[0]);
    check(`card "${CRATINUS_LABELS[0]}" found and clicked`, cratinusClicked);
    await page.waitForFunction(
      ([label, sel]) =>
        Array.from(document.querySelectorAll(sel)).some(
          (h) => (h.textContent ?? "").trim() === label,
        ),
      [CRATINUS_LABELS[0], PAGE_HEADING_SELECTOR] as const,
      { timeout: 15000 },
    );
    await page.waitForTimeout(300);
    const cratinusPanel = await page.evaluate((other) => {
      const body = document.body.innerText;
      const crossLink = Array.from(
        document.querySelectorAll<HTMLButtonElement>("button"),
      ).find((b) => (b.textContent ?? "").trim() === other);
      return { body, hasCrossLink: !!crossLink };
    }, CRATINUS_LABELS[1]);
    check(
      `panel shows "Shares the Greek name ${CRATINUS_GRC}" (certified wording)`,
      cratinusPanel.body.includes("Shares the Greek name") &&
        cratinusPanel.body.includes(CRATINUS_GRC),
    );
    check(
      'panel shows the "Distinct individuals" owl:differentFrom footnote',
      cratinusPanel.body.includes("Distinct individuals") &&
        cratinusPanel.body.includes("owl:differentFrom"),
    );
    check(
      "panel does NOT show the old soft wording",
      !cratinusPanel.body.includes("Bears the same Greek name") &&
        !cratinusPanel.body.includes("Possibly distinct individuals"),
    );
    check(
      `panel has a cross-link button to "${CRATINUS_LABELS[1]}"`,
      cratinusPanel.hasCrossLink,
    );

    // Follow the cross-link: the Younger's panel must open, itself
    // certified and cross-linking back to the elder Cratinus.
    const crossClicked = await page.evaluate((other) => {
      const btn = Array.from(
        document.querySelectorAll<HTMLButtonElement>("button"),
      ).find((b) => (b.textContent ?? "").trim() === other);
      if (!btn) return false;
      btn.click();
      return true;
    }, CRATINUS_LABELS[1]);
    check("cross-link clicked", crossClicked);
    await page.waitForFunction(
      ([label, sel]) =>
        Array.from(document.querySelectorAll(sel)).some(
          (h) => (h.textContent ?? "").trim() === label,
        ),
      [CRATINUS_LABELS[1], PAGE_HEADING_SELECTOR] as const,
      { timeout: 15000 },
    );
    await page.waitForTimeout(300);
    const youngerPanel = await page.evaluate((back) => {
      const body = document.body.innerText;
      const backLink = Array.from(
        document.querySelectorAll<HTMLButtonElement>("button"),
      ).find((b) => (b.textContent ?? "").trim() === back);
      return { body, hasBackLink: !!backLink };
    }, CRATINUS_LABELS[0]);
    check(
      `cross-link opened the "${CRATINUS_LABELS[1]}" panel with certified wording`,
      youngerPanel.body.includes("Shares the Greek name") &&
        youngerPanel.body.includes(CRATINUS_GRC) &&
        youngerPanel.body.includes("owl:differentFrom"),
    );
    check(
      `the Younger's panel cross-links back to "${CRATINUS_LABELS[0]}"`,
      youngerPanel.hasBackLink,
    );

    // Pasting the Greek form itself must surface both bearers.
    const greekFilter = await readCards(CRATINUS_GRC);
    for (const label of CRATINUS_LABELS) {
      check(
        `filtering by ${CRATINUS_GRC} surfaces the "${label}" card`,
        greekFilter.cards.some((c) => c.label === label),
        `labels=${JSON.stringify(greekFilter.cards.map((c) => c.label))}`,
      );
    }

    console.log(
      `Scenario 6: the closest-names suggestion card for ${JSON.stringify(PLATO_NEAR_MISS)} carries the Greek form too`,
    );
    const nearMiss = await readCards(PLATO_NEAR_MISS);
    check(
      "near-miss falls through to the closest-names fallback",
      nearMiss.fallbackShown,
    );
    const platoSuggestion = nearMiss.cards.find((c) =>
      c.label.startsWith(PLATO_LABEL),
    );
    check("Plato is among the suggestions", !!platoSuggestion);
    check(
      `suggested Plato card has the Greek line "${PLATO_GRC}"`,
      !!platoSuggestion && platoSuggestion.lines.includes(PLATO_GRC),
      `lines=${JSON.stringify(platoSuggestion?.lines)}`,
    );
  } finally {
    await browser.close();
  }

  if (failures > 0) {
    console.error(`\n${failures} check(s) failed`);
    process.exit(1);
  }
  console.log("\nAll Index Greek-name checks passed");
}

await main();
