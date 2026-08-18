/// <reference lib="dom" />
// The in-page callbacks (page.evaluate / waitForFunction) run in the
// browser, so this Node-side script needs the DOM lib for their types.
//
// Real-browser check that a claim's citation link opens a section page
// that actually shows the claim's Greek excerpt. validate-claims certifies
// at the data level that every claim's grc excerpt is a verbatim substring
// of the section that sectionIdForRef resolves — but nothing exercised the
// reader-verification loop in the browser: click the "(D.L. x.y)" citation
// in a Life page's claims panel and confirm the excerpt is visible in the
// rendered Greek column of the opened /section/:id page. A regression in
// CitationLink's href building, wouter base handling, the section route,
// or the passage card's Greek rendering (annotation splitting, Logeion
// wrapping) could leave the data validator green while the reader lands on
// a page where the cited Greek can't be found. This script drives headless
// Chromium against the running dev servers:
//
// 1. Positive controls, read live from the API: at least MIN_GRC_CLAIMS
//    claims carry a grc excerpt AND a sectionId, and the pinned
//    ambiguous-ref claim is among them — glaucon-birthplace-athens, whose
//    ref "2.124" is ambiguous (two Book-2 chapters own a section 124) and
//    must resolve to Glaucon's own section 2.14.124 with the excerpt
//    "Γλαύκων Ἀθηναῖος". If these pins vanish, the dataset or the claims
//    API mapping changed underneath the check.
// 2. Ambiguous-ref scenario (Glaucon): open /browse, select Glaucon in the
//    sidebar (his Life page — the claims panel opens by default there),
//    locate the birthplace claim's own line by value + citation label,
//    verify the citation anchor's href targets /section/2.14.124, click
//    it, and assert the SPA lands on the section page whose passage-card
//    Greek column (NOT the claims panel's own "Source text" block)
//    contains the excerpt.
// 3. Non-ambiguous scenario: pick another philosopher's first grc-bearing
//    claim dynamically from the API and run the same click-through, so
//    the check covers the plain resolution path too.
//
// Every failure message names the claim (philosopher + D.L. ref) and the
// target section id.
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

// Positive-control pins: the corpus is known to carry many grc-bearing
// claims, including the ambiguous-ref Glaucon birthplace claim. If these
// ever vanish the dataset (or the API mapping) changed underneath the
// check, and the browser scenarios below would be running on air.
const MIN_GRC_CLAIMS = 20;
const AMBIGUOUS_PHILOSOPHER = "Glaucon";
const AMBIGUOUS_CLAIM_VALUE = "Athens";
const AMBIGUOUS_REF = "2.124"; // what the citation label shows
const AMBIGUOUS_SECTION_ID = "2.14.124"; // where it must land
const AMBIGUOUS_GRC = "Γλαύκων Ἀθηναῖος";

type GrcClaim = {
  philosopher: string;
  ref: string;
  sectionId: string;
  value: string;
  grc: string;
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

// Drive one full click-through: Browse -> select the philosopher ->
// find the claim's line in the (default-open) claims panel -> verify the
// citation href -> click it -> assert the section page's passage-card
// Greek column contains the excerpt.
async function runScenario(page: Page, guard: PageGuard, claim: GrcClaim) {
  const who = `${claim.philosopher} ${claim.ref}`;
  console.log(
    `\nScenario ${who}: "${claim.value}" -> /section/${claim.sectionId}`,
  );

  await page.goto(`${BASE_URL}/browse`, { waitUntil: "networkidle" });
  guard.assertPageLoaded();

  // Select the philosopher in the sidebar index.
  await guard.guarded(
    page.waitForFunction(
      (name) =>
        Array.from(document.querySelectorAll("button span")).some(
          (s) => s.textContent?.trim() === name,
        ),
      claim.philosopher,
      { timeout: 30000 },
    ),
  );
  const selected = await page.evaluate((name) => {
    const span = Array.from(document.querySelectorAll("button span")).find(
      (s) => s.textContent?.trim() === name,
    );
    const btn = span?.closest("button");
    if (!btn) return false;
    (btn as HTMLButtonElement).click();
    return true;
  }, claim.philosopher);
  check(`${who}: philosopher selected on /browse`, selected);
  if (!selected) return;

  // The Life page's claims panel is collapsible but defaultOpen on Browse;
  // wait for the claim's value to be rendered.
  await guard.guarded(
    page.waitForFunction(
      (v) => document.body.innerText.includes(v),
      claim.value,
      { timeout: 30000 },
    ),
  );

  // Locate the claim's own <li> (matched by its value span AND its
  // "(D.L. ref)" citation so a same-valued sibling can't shadow it) and
  // read the citation anchor's href. No named helper functions inside
  // evaluate: tsx's esbuild transform wraps them with a __name helper
  // that doesn't exist in the page.
  const href = await page.evaluate(
    ([value, ref]) => {
      const li = Array.from(document.querySelectorAll("li")).find((el) => {
        const valueSpan = Array.from(
          el.querySelectorAll(":scope > span"),
        ).find(
          (s) => (s.textContent ?? "").replace(/\s+/g, " ").trim() === value,
        );
        return (
          !!valueSpan && (el.textContent ?? "").includes(`(D.L. ${ref})`)
        );
      });
      if (!li) return null;
      const anchor = Array.from(li.querySelectorAll("a")).find(
        (a) =>
          (a.textContent ?? "").replace(/\s+/g, " ").trim() ===
          `(D.L. ${ref})`,
      );
      return anchor ? anchor.getAttribute("href") : "missing-anchor";
    },
    [claim.value, claim.ref] as const,
  );
  check(
    `${who}: citation link targets /section/${claim.sectionId}`,
    typeof href === "string" && href.endsWith(`/section/${claim.sectionId}`),
    `got ${JSON.stringify(href)}`,
  );
  if (typeof href !== "string" || href === "missing-anchor") return;

  // Click the citation link (a real click, so wouter handles it as an
  // SPA navigation) and wait for the section page URL.
  const clicked = await page.evaluate(
    ([value, ref]) => {
      const li = Array.from(document.querySelectorAll("li")).find((el) => {
        const valueSpan = Array.from(
          el.querySelectorAll(":scope > span"),
        ).find(
          (s) => (s.textContent ?? "").replace(/\s+/g, " ").trim() === value,
        );
        return (
          !!valueSpan && (el.textContent ?? "").includes(`(D.L. ${ref})`)
        );
      });
      const anchor = li
        ? Array.from(li.querySelectorAll("a")).find(
            (a) =>
              (a.textContent ?? "").replace(/\s+/g, " ").trim() ===
              `(D.L. ${ref})`,
          )
        : undefined;
      if (!anchor) return false;
      anchor.click();
      return true;
    },
    [claim.value, claim.ref] as const,
  );
  check(`${who}: citation link clicked`, clicked);
  if (!clicked) return;

  await guard.guarded(
    page.waitForFunction(
      (sid) => window.location.pathname.endsWith(`/section/${sid}`),
      claim.sectionId,
      { timeout: 30000 },
    ),
  );
  check(`${who}: browser landed on /section/${claim.sectionId}`, true);

  // Wait for the passage card of THIS section to render (its header reads
  // "D.L. <book>.<chapter>.<section>", i.e. the section id).
  const headerLabel = `D.L. ${claim.sectionId}`;
  await page.waitForFunction(
    ([label, cardHeadingSel]) =>
      Array.from(document.querySelectorAll(cardHeadingSel)).some(
        (h) => (h.textContent ?? "").replace(/\s+/g, " ").trim() === label,
      ),
    [headerLabel, CARD_HEADING_SELECTOR] as const,
    { timeout: 30000 },
  );

  // Assert the excerpt appears in the passage card's Greek column — NOT
  // merely anywhere on the page: the section page's own claims panel can
  // render the same excerpt in its "Source text" block, which would mask
  // a broken Greek column. The Greek column is the first cell of the
  // passage card's two-column grid.
  const greekColumn = await page.evaluate(([label, cardHeadingSel]) => {
    const h3 = Array.from(document.querySelectorAll(cardHeadingSel)).find(
      (h) => (h.textContent ?? "").replace(/\s+/g, " ").trim() === label,
    );
    if (!h3) return null;
    // Walk up to the card root: the ancestor that directly contains the
    // two-column grid, then take the grid's first cell (the Greek column).
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
  check(
    `${who}: Greek excerpt "${claim.grc}" is visible in the rendered Greek text`,
    norm(greekColumn).includes(norm(claim.grc)),
    `Greek column starts: ${JSON.stringify(norm(greekColumn).slice(0, 120))}`,
  );
}

async function main() {
  // Discover every grc-bearing claim from the live API so the check and
  // its positive controls follow the data.
  const philosophers = (await (
    await fetch(`${BASE_URL}/api/philosophers`)
  ).json()) as { name: string }[];

  const grcClaims: GrcClaim[] = [];
  for (const p of philosophers) {
    const res = await fetch(
      `${BASE_URL}/api/claims/${encodeURIComponent(p.name)}`,
    );
    if (!res.ok) continue;
    const body = (await res.json()) as {
      claims: {
        ref: string;
        sectionId?: string;
        value: string;
        grc?: string;
      }[];
    };
    for (const c of body.claims ?? []) {
      if (!c.grc || !c.sectionId) continue;
      grcClaims.push({
        philosopher: p.name,
        ref: c.ref,
        sectionId: c.sectionId,
        value: c.value,
        grc: c.grc,
      });
    }
  }

  console.log(
    `Positive control: the API serves grc-bearing claims (found ${grcClaims.length})`,
  );
  check(
    `at least ${MIN_GRC_CLAIMS} claims carry a Greek excerpt and a sectionId`,
    grcClaims.length >= MIN_GRC_CLAIMS,
    `found ${grcClaims.length}`,
  );

  const ambiguous = grcClaims.find(
    (c) =>
      c.philosopher === AMBIGUOUS_PHILOSOPHER &&
      c.ref === AMBIGUOUS_REF &&
      c.value === AMBIGUOUS_CLAIM_VALUE,
  );
  check(
    `the ambiguous-ref pin exists: ${AMBIGUOUS_PHILOSOPHER} ${AMBIGUOUS_REF} "${AMBIGUOUS_CLAIM_VALUE}"`,
    !!ambiguous,
  );
  check(
    `the ambiguous ref ${AMBIGUOUS_REF} resolves to ${AMBIGUOUS_SECTION_ID}`,
    ambiguous?.sectionId === AMBIGUOUS_SECTION_ID,
    `got ${JSON.stringify(ambiguous?.sectionId)}`,
  );
  check(
    `the ambiguous claim carries the pinned excerpt "${AMBIGUOUS_GRC}"`,
    ambiguous?.grc === AMBIGUOUS_GRC,
    `got ${JSON.stringify(ambiguous?.grc)}`,
  );
  if (grcClaims.length === 0) {
    throw new Error(
      "no grc-bearing claims found in the API — the grc/sectionId fields were dropped from the claims mapping?",
    );
  }

  // Non-ambiguous companion: the first grc claim of a DIFFERENT
  // philosopher, so the check also covers the plain resolution path.
  const other = grcClaims.find((c) => c.philosopher !== AMBIGUOUS_PHILOSOPHER);
  check(
    "a second (non-ambiguous) grc claim exists for the companion scenario",
    !!other,
  );

  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({
      viewport: { width: 1280, height: 900 },
    });
    const guard = attachPageGuard(page);
    if (ambiguous) await runScenario(page, guard, ambiguous);
    if (other) await runScenario(page, guard, other);
  } finally {
    await browser.close();
  }

  if (failures > 0) {
    console.error(`\ne2e-claim-greek-excerpt: ${failures} check(s) FAILED`);
    process.exit(1);
  }
  console.log("\ne2e-claim-greek-excerpt: all checks passed");
}

main().catch((err) => {
  console.error("e2e-claim-greek-excerpt crashed:", err);
  process.exit(1);
});
