/// <reference lib="dom" />
// The in-page callbacks (page.evaluate / waitForFunction) run in the
// browser, so this Node-side script needs the DOM lib for their types.
//
// Real-browser check that a saying's / doxa's / anecdote's "Read in
// context ->" passage link opens a /section/:id page that actually shows
// the item's Greek excerpt in the rendered Greek column. The data-level
// validators (validate-sayings, validate-doxai, validate-anecdotes)
// certify each item's grc excerpt is a verbatim substring of its section
// at the data level, and e2e-claim-greek-excerpt covers the CLAIMS layer
// in the browser — but nothing clicked the passage links of the other
// curated layers. A regression in the card's Link href, wouter base
// handling, the section route, or the passage card's Greek rendering
// (annotation splitting, Logeion wrapping) could leave the data
// validators green while readers land on a page where the cited Greek
// can't be found.
//
// Coverage per layer:
// - Sayings: pinned Thales saying + a dynamically-picked saying from a
//   different book; excerpt asserted in the Greek column.
// - Doxai (doxography page): pinned Thales doxa; excerpt asserted in the
//   Greek column.
// - Anecdotes: every anecdote now carries a curated grc excerpt (334/334
//   as of 2026-08); a pinned Thales anecdote is clicked through and its
//   exact excerpt asserted in the Greek column like the other layers, with
//   a positive-control minimum so coverage can't silently regress.
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
import { CARD_HEADING_SELECTOR } from "./lib/card-headings";

const { chromium } = await import("playwright-core");
const { attachPageGuard } = await import("./lib/e2e-page-guard");
import type { Page } from "playwright-core";
import type { PageGuard } from "./lib/e2e-page-guard";

const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:80";

// Positive-control pins. If these vanish the dataset (or the API mapping)
// changed underneath the check, and the browser scenarios below would be
// running on air.
const MIN_GRC_SAYINGS = 100;
const MIN_GRC_DOXAI = 50;
const MIN_GRC_ANECDOTES = 100;
const SAYING_PIN = {
  id: "thales-most-ancient-god",
  philosopher: "Thales",
  ref: "1.35",
  sectionId: "1.1.35",
  grc: "πρεσβύτατον τῶν ὄντων θεός· ἀγένητον γάρ.",
};
const ANECDOTE_PIN = {
  id: "thales-croesus-alliance",
  philosopher: "Thales",
  ref: "1.25",
  sectionId: "1.1.25",
  grc: "Δοκεῖ δὲ καὶ ἐν τοῖς πολιτικοῖς ἄριστα βεβουλεῦσθαι. Κροίσου γοῦν πέμψαντος πρὸς Μιλησίους ἐπὶ συμμαχίᾳ ἐκώλυσεν· ὅπερ Κύρου κρατήσαντος ἔσωσε τὴν πόλιν.",
};
const DOXA_PIN = {
  id: "thales-water-first-principle",
  philosopher: "Thales",
  ref: "1.27",
  sectionId: "1.1.27",
  grc: "Ἀρχὴν δὲ τῶν πάντων ὕδωρ ὑπεστήσατο,",
};

type Item = {
  id: string;
  philosopher: string;
  book: number;
  ref: string;
  sectionId: string;
  gloss: string;
  en: string;
  grc: string | null;
};

let failures = 0;
function check(label: string, ok: boolean, detail?: string) {
  if (ok) {
    console.log(`  ok: ${label}`);
  } else {
    failures++;
    console.error(`  FAIL: ${label}${detail ? ` (${detail})` : ""}`);
  }
}

const norm = (s: string) => s.replace(/\s+/g, " ").trim();

// Drive one full click-through: open the layer's list page filtered to
// the item's philosopher, locate the item's own card (matched by its
// "D.L. ref" header AND its English translation so a same-ref sibling
// can't shadow it),
// verify the "Read in context ->" href, click it, and assert the section
// page's passage-card Greek column. When `item.grc` is set the excerpt
// must appear in the Greek column; when null (anecdotes today) the Greek
// column must merely be non-empty — the navigation itself is the check.
async function runScenario(
  page: Page,
  guard: PageGuard,
  layer: string,
  listPath: string,
  item: Item,
) {
  const who = `${layer} ${item.philosopher} ${item.ref}`;
  console.log(`\nScenario ${who} -> /section/${item.sectionId}`);

  await page.goto(
    `${BASE_URL}${listPath}?philosopher=${encodeURIComponent(item.philosopher)}`,
    { waitUntil: "networkidle" },
  );
  guard.assertPageLoaded();

  // Wait for the item's card (header "D.L. ref" + English translation) to be rendered.
  // No named helper functions inside evaluate: tsx's esbuild transform
  // wraps them with a __name helper that doesn't exist in the page.
  await guard.guarded(
    page.waitForFunction(
    ([ref, gloss, cardHeadingSel]) =>
      Array.from(document.querySelectorAll(cardHeadingSel)).some((h) => {
        if ((h.textContent ?? "").replace(/\s+/g, " ").trim() !== `D.L. ${ref}`)
          return false;
        let card: HTMLElement | null = h.parentElement;
        while (card && !(card.textContent ?? "").includes(gloss))
          card = card.parentElement;
        return !!card;
      }),
      [item.ref, item.en, CARD_HEADING_SELECTOR] as const,
      { timeout: 30000 },
    ),
  );

  const href = await page.evaluate(
    ([ref, gloss, cardHeadingSel]) => {
      const h3 = Array.from(document.querySelectorAll(cardHeadingSel)).find(
        (h) =>
          (h.textContent ?? "").replace(/\s+/g, " ").trim() ===
            `D.L. ${ref}` &&
          !!(() => {
            let card: HTMLElement | null = h.parentElement;
            while (card && !(card.textContent ?? "").includes(gloss))
              card = card.parentElement;
            return card;
          })(),
      );
      if (!h3) return null;
      // Walk up to the card root that contains the "Read in context"
      // anchor, then read its href.
      let card: HTMLElement | null = h3.parentElement;
      let anchor: HTMLAnchorElement | undefined;
      while (card) {
        anchor = Array.from(card.querySelectorAll("a")).find((a) =>
          (a.textContent ?? "").includes("Read in context"),
        );
        if (anchor && (card.textContent ?? "").includes(gloss)) break;
        card = card.parentElement;
      }
      return anchor ? anchor.getAttribute("href") : "missing-anchor";
    },
    [item.ref, item.en, CARD_HEADING_SELECTOR] as const,
  );
  check(
    `${who}: passage link targets /section/${item.sectionId}`,
    typeof href === "string" && href.endsWith(`/section/${item.sectionId}`),
    `got ${JSON.stringify(href)}`,
  );
  if (typeof href !== "string" || href === "missing-anchor") return;

  // Click the passage link (a real click, so wouter handles it as an SPA
  // navigation) and wait for the section page URL.
  const clicked = await page.evaluate(
    ([ref, gloss, cardHeadingSel]) => {
      const h3 = Array.from(document.querySelectorAll(cardHeadingSel)).find(
        (h) =>
          (h.textContent ?? "").replace(/\s+/g, " ").trim() === `D.L. ${ref}`,
      );
      let card: HTMLElement | null = h3?.parentElement ?? null;
      let anchor: HTMLAnchorElement | undefined;
      while (card) {
        anchor = Array.from(card.querySelectorAll("a")).find((a) =>
          (a.textContent ?? "").includes("Read in context"),
        );
        if (anchor && (card.textContent ?? "").includes(gloss)) break;
        card = card.parentElement;
      }
      if (!anchor) return false;
      anchor.click();
      return true;
    },
    [item.ref, item.en, CARD_HEADING_SELECTOR] as const,
  );
  check(`${who}: passage link clicked`, clicked);
  if (!clicked) return;

  await guard.guarded(
    page.waitForFunction(
      (sid) => window.location.pathname.endsWith(`/section/${sid}`),
      item.sectionId,
      { timeout: 30000 },
    ),
  );
  check(`${who}: browser landed on /section/${item.sectionId}`, true);

  // Wait for the passage card of THIS section to render (its header reads
  // "D.L. <book>.<chapter>.<section>", i.e. the section id).
  const headerLabel = `D.L. ${item.sectionId}`;
  await page.waitForFunction(
    ([label, cardHeadingSel]) =>
      Array.from(document.querySelectorAll(cardHeadingSel)).some(
        (h) => (h.textContent ?? "").replace(/\s+/g, " ").trim() === label,
      ),
    [headerLabel, CARD_HEADING_SELECTOR] as const,
    { timeout: 30000 },
  );

  // Assert against the passage card's Greek column — NOT merely anywhere
  // on the page: other panels can render the same excerpt elsewhere,
  // which would mask a broken Greek column. The Greek column is the first
  // cell of the passage card's two-column grid.
  const greekColumn = await page.evaluate(([label, cardHeadingSel]) => {
    const h3 = Array.from(document.querySelectorAll(cardHeadingSel)).find(
      (h) => (h.textContent ?? "").replace(/\s+/g, " ").trim() === label,
    );
    if (!h3) return null;
    let card: HTMLElement | null = h3 as HTMLElement;
    while (card && !card.querySelector(":scope > div.grid")) {
      card = card.parentElement;
    }
    const cell = card?.querySelector(":scope > div.grid > div");
    return cell ? ((cell as HTMLElement).innerText ?? "") : null;
  }, [headerLabel, CARD_HEADING_SELECTOR] as const);

  check(
    `${who}: passage card Greek column found`,
    typeof greekColumn === "string",
  );
  if (typeof greekColumn !== "string") return;
  if (item.grc) {
    check(
      `${who}: Greek excerpt "${item.grc}" is visible in the rendered Greek text`,
      norm(greekColumn).includes(norm(item.grc)),
      `Greek column starts: ${JSON.stringify(norm(greekColumn).slice(0, 120))}`,
    );
  } else {
    check(
      `${who}: passage card Greek column is non-empty`,
      norm(greekColumn).length > 0,
    );
  }
}

async function main() {
  const fetchList = async (path: string): Promise<Item[]> => {
    const res = await fetch(`${BASE_URL}${path}`);
    if (!res.ok) throw new Error(`${path} responded ${res.status}`);
    return (await res.json()) as Item[];
  };

  const [sayings, doxai, anecdotes] = await Promise.all([
    fetchList("/api/sayings"),
    fetchList("/api/doxai"),
    fetchList("/api/anecdotes"),
  ]);

  const grcSayings = sayings.filter((s) => s.grc && s.sectionId);
  const grcDoxai = doxai.filter((d) => d.grc && d.sectionId);
  const grcAnecdotes = anecdotes.filter((a) => a.grc && a.sectionId);

  console.log(
    `Positive controls: sayings ${grcSayings.length}/${sayings.length} grc, ` +
      `doxai ${grcDoxai.length}/${doxai.length} grc, ` +
      `anecdotes ${grcAnecdotes.length}/${anecdotes.length} grc`,
  );
  check(
    `at least ${MIN_GRC_SAYINGS} sayings carry a Greek excerpt and a sectionId`,
    grcSayings.length >= MIN_GRC_SAYINGS,
    `found ${grcSayings.length}`,
  );
  check(
    `at least ${MIN_GRC_DOXAI} doxai carry a Greek excerpt and a sectionId`,
    grcDoxai.length >= MIN_GRC_DOXAI,
    `found ${grcDoxai.length}`,
  );
  check(
    "anecdotes list is non-empty (its click-through scenario has material)",
    anecdotes.length > 0,
    `found ${anecdotes.length}`,
  );
  check(
    `at least ${MIN_GRC_ANECDOTES} anecdotes carry a Greek excerpt and a sectionId`,
    grcAnecdotes.length >= MIN_GRC_ANECDOTES,
    `found ${grcAnecdotes.length}`,
  );

  const sayingPin = grcSayings.find((s) => s.id === SAYING_PIN.id);
  check(`the saying pin exists: ${SAYING_PIN.id}`, !!sayingPin);
  check(
    `the saying pin resolves ref ${SAYING_PIN.ref} to ${SAYING_PIN.sectionId} with the pinned excerpt`,
    sayingPin?.sectionId === SAYING_PIN.sectionId &&
      sayingPin?.grc === SAYING_PIN.grc,
    `got sectionId=${JSON.stringify(sayingPin?.sectionId)} grc=${JSON.stringify(sayingPin?.grc)}`,
  );

  const doxaPin = grcDoxai.find((d) => d.id === DOXA_PIN.id);
  check(`the doxa pin exists: ${DOXA_PIN.id}`, !!doxaPin);
  check(
    `the doxa pin resolves ref ${DOXA_PIN.ref} to ${DOXA_PIN.sectionId} with the pinned excerpt`,
    doxaPin?.sectionId === DOXA_PIN.sectionId && doxaPin?.grc === DOXA_PIN.grc,
    `got sectionId=${JSON.stringify(doxaPin?.sectionId)} grc=${JSON.stringify(doxaPin?.grc)}`,
  );

  // Dynamic companion saying from a different book, so the check also
  // covers a card outside Book 1 (different Life, different section
  // numbering).
  const otherSaying = grcSayings.find(
    (s) => s.book !== (sayingPin?.book ?? 1),
  );
  check(
    "a companion grc saying exists outside the pin's book",
    !!otherSaying,
  );

  // Pinned anecdote, mirroring the saying/doxa pins: existence, sectionId
  // and exact grc are asserted so a silent data edit fails loudly.
  const anecdotePin = grcAnecdotes.find((a) => a.id === ANECDOTE_PIN.id);
  check(`the anecdote pin exists: ${ANECDOTE_PIN.id}`, !!anecdotePin);
  check(
    `the anecdote pin resolves ref ${ANECDOTE_PIN.ref} to ${ANECDOTE_PIN.sectionId} with the pinned excerpt`,
    anecdotePin?.sectionId === ANECDOTE_PIN.sectionId &&
      anecdotePin?.grc === ANECDOTE_PIN.grc,
    `got sectionId=${JSON.stringify(anecdotePin?.sectionId)} grc=${JSON.stringify(anecdotePin?.grc)}`,
  );

  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({
      viewport: { width: 1280, height: 900 },
    });
    // Fail fast with the failing URL/status instead of an opaque selector
    // timeout when the site itself fails to boot.
    const guard = attachPageGuard(page);
    if (sayingPin)
      await runScenario(page, guard, "saying", "/sayings", sayingPin);
    if (otherSaying)
      await runScenario(page, guard, "saying", "/sayings", otherSaying);
    if (doxaPin) await runScenario(page, guard, "doxa", "/doxography", doxaPin);
    if (anecdotePin)
      await runScenario(page, guard, "anecdote", "/anecdotes", anecdotePin);
  } finally {
    await browser.close();
  }

  if (failures > 0) {
    console.error(
      `\ne2e-saying-greek-excerpt: ${failures} check(s) FAILED`,
    );
    process.exit(1);
  }
  console.log("\ne2e-saying-greek-excerpt: all checks passed");
}

main().catch((err) => {
  console.error("e2e-saying-greek-excerpt crashed:", err);
  process.exit(1);
});
