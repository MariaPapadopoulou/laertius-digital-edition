/// <reference lib="dom" />
// The in-page callbacks (page.evaluate / waitForFunction) run in the
// browser, so this Node-side script needs the DOM lib for their types.
//
// Real-browser check that every chained claim renders its full
// who-told-whom transmission chain in the Section page claims panel.
// validate-claims pins the chain data at the source level, and
// e2e-chain-links pins where the chain's Index LINKS land — but neither
// asserts that the "via ..." line itself still renders with every
// authority, in citation order, with each link's work title. A refactor
// of claims-panel.tsx (dropping the hasChain block, reordering the map,
// losing the "(Work)" segment) or of the claims mapping in
// routes/graph.ts (dropping the chain field from the response) would
// leave the source validators green while readers silently lose the
// citation trail. This script drives headless Chromium against the
// running dev servers:
//
// 1. It reads every chained claim live from the API (/api/philosophers +
//    /api/claims/{name}), so the check follows the data. As a positive
//    control it requires at least 5 chained claims and that two known
//    shapes are among them: the multi-hop 5.41 chain (Favorinus ->
//    Hermippus -> Arcesilaus) and the 9.5 chain whose link carries a work
//    title ("via Ariston (On Heraclitus)"). If the API ever returns no
//    chains at all, the script fails loudly instead of passing vacuously.
// 2. For each chained claim's Section page, it expands the collapsible
//    "From the text" panel, locates that claim's own line (matched by
//    claim value + its "(D.L. ref)" citation), and asserts:
//    - the "according to <accordingTo>" attribution line renders (with
//      ", asserted in <sourceWork>" exactly when the API carries one);
//    - the "via ..." line renders with EVERY chain authority present, in
//      the API's citation order (nearest intermediary first);
//    - each chain link that carries a work renders it as "(Work)"
//      immediately after its authority.
//    A failure names the philosopher and the D.L. reference of the claim
//    whose chain line is missing, out of order, or missing its work title.
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

// Positive-control pins: the corpus is known to carry at least this many
// chained claims, including the multi-hop 5.41 chain and the 9.5 chain
// whose link carries a work title. If curation grows more chains the
// script picks them up automatically; if these pins ever vanish the
// dataset (or the API mapping) changed underneath the check.
const MIN_CHAINED_CLAIMS = 5;
const MULTI_HOP_REF = "5.41";
const MULTI_HOP_CHAIN = ["Hermippus", "Arcesilaus"];
const WORK_REF = "9.5";
const WORK_TITLE_EXPECTED = "On Heraclitus";

type ChainLink = { authority: string; work?: string };
type ChainedClaim = {
  philosopher: string;
  ref: string;
  sectionId: string;
  value: string;
  accordingTo: string;
  sourceWork?: string;
  chain: ChainLink[];
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

// The exact chain line the panel renders for a claim:
// "via A1 (Work1), A2, A3 (Work3)" — authorities in API order, each work
// title parenthesised right after its authority.
function expectedViaText(chain: ChainLink[]): string {
  return (
    "via " +
    chain
      .map((l) => (l.work ? `${l.authority} (${l.work})` : l.authority))
      .join(", ")
  );
}

// The attribution line: "according to X" plus ", asserted in Work" when
// the claim carries a source work.
function expectedAttributionText(claim: ChainedClaim): string {
  return (
    `according to ${claim.accordingTo}` +
    (claim.sourceWork ? `, asserted in ${claim.sourceWork}` : "")
  );
}

async function main() {
  // Discover every chained claim from the live API so the check follows
  // the data instead of hard-coding the current five.
  const philosophers = (await (
    await fetch(`${BASE_URL}/api/philosophers`)
  ).json()) as { name: string }[];

  const chained: ChainedClaim[] = [];
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
        accordingTo?: string;
        sourceWork?: string;
        chain?: ChainLink[];
      }[];
    };
    for (const c of body.claims ?? []) {
      if (!c.chain || c.chain.length === 0) continue;
      check(
        `chained claim at ${c.ref} (${p.name}) resolves a section id`,
        !!c.sectionId,
      );
      check(
        `chained claim at ${c.ref} (${p.name}) carries accordingTo`,
        !!c.accordingTo,
      );
      if (!c.sectionId || !c.accordingTo) continue;
      chained.push({
        philosopher: p.name,
        ref: c.ref,
        sectionId: c.sectionId,
        value: c.value,
        accordingTo: c.accordingTo,
        sourceWork: c.sourceWork,
        chain: c.chain,
      });
    }
  }

  console.log(
    `Positive control: the API serves the known chained claims (found ${chained.length})`,
  );
  check(
    `at least ${MIN_CHAINED_CLAIMS} chained claims come from the API`,
    chained.length >= MIN_CHAINED_CLAIMS,
    `found ${chained.length}`,
  );
  const multiHop = chained.find((c) => c.ref === MULTI_HOP_REF);
  check(
    `the ${MULTI_HOP_REF} multi-hop chain (${MULTI_HOP_CHAIN.join(" -> ")}) is present`,
    !!multiHop &&
      multiHop.chain.map((l) => l.authority).join(",") ===
        MULTI_HOP_CHAIN.join(","),
    JSON.stringify(multiHop?.chain),
  );
  const workClaim = chained.find((c) => c.ref === WORK_REF);
  check(
    `the ${WORK_REF} chain carries the work title "${WORK_TITLE_EXPECTED}"`,
    !!workClaim && workClaim.chain.some((l) => l.work === WORK_TITLE_EXPECTED),
    JSON.stringify(workClaim?.chain),
  );
  if (chained.length === 0) {
    throw new Error(
      "no chained claims found in the API — the chain field was dropped from the claims mapping?",
    );
  }

  // Group by section so each page is opened once even if a section ever
  // hosts more than one chained claim.
  const bySection = new Map<string, ChainedClaim[]>();
  for (const c of chained) {
    const list = bySection.get(c.sectionId) ?? [];
    list.push(c);
    bySection.set(c.sectionId, list);
  }

  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({
      viewport: { width: 1280, height: 720 },
    });
    const guard = attachPageGuard(page);

    for (const [sectionId, claims] of bySection) {
      console.log(
        `Section /section/${sectionId}: ${claims
          .map((c) => `${c.philosopher} ${c.ref}`)
          .join(", ")}`,
      );
      await page.goto(`${BASE_URL}/section/${sectionId}`, {
        waitUntil: "networkidle",
      });
      guard.assertPageLoaded();
      // The collapsible header button's textContent concatenates the card
      // title and the count: "From the textShow N facts".
      await guard.guarded(
        page.waitForFunction(
          () =>
            Array.from(document.querySelectorAll("button")).some((b) =>
              /Show \d+ facts$/.test(b.textContent?.trim() ?? ""),
            ),
          undefined,
          { timeout: 30000 },
        ),
      );
      const expanded = await page.evaluate(() => {
        const btn = Array.from(document.querySelectorAll("button")).find((b) =>
          /Show \d+ facts$/.test(b.textContent?.trim() ?? ""),
        );
        if (!btn) return false;
        btn.click();
        return true;
      });
      check(`claims panel expanded on /section/${sectionId}`, expanded);
      // The claim lines render synchronously with the expanded body; wait
      // for the first claim's value to be on the page.
      await page.waitForFunction(
        (v) => document.body.innerText.includes(v),
        claims[0].value,
        { timeout: 10000 },
      );
      await page.waitForTimeout(200);

      for (const claim of claims) {
        const who = `${claim.philosopher} ${claim.ref}`;
        // Locate the claim's own <li> (matched by its value text AND its
        // "(D.L. ref)" citation so a same-valued sibling can't shadow it),
        // then read the "according to ..." and "via ..." lines inside it.
        // No helper functions inside evaluate: tsx's esbuild transform
        // wraps named locals with a __name helper that doesn't exist in
        // the page.
        const lines = await page.evaluate(
          ([value, ref]) => {
            // Whitespace-normalisation is inlined everywhere: naming it as
            // a local function would get __name-wrapped by tsx's esbuild
            // transform, and __name doesn't exist in the page.
            const li = Array.from(document.querySelectorAll("li")).find(
              (el) => {
                const valueSpan = Array.from(
                  el.querySelectorAll(":scope > span"),
                ).find(
                  (s) =>
                    (s.textContent ?? "").replace(/\s+/g, " ").trim() === value,
                );
                return (
                  !!valueSpan && (el.textContent ?? "").includes(`(D.L. ${ref})`)
                );
              },
            );
            if (!li) return null;
            const spans = Array.from(li.querySelectorAll("span"));
            const attribution = spans.find(
              (s) =>
                (s.textContent ?? "")
                  .replace(/\s+/g, " ")
                  .trim()
                  .startsWith("according to") &&
                !(s.parentElement?.textContent ?? "")
                  .replace(/\s+/g, " ")
                  .trim()
                  .startsWith("according to"),
            );
            const via = spans.find(
              (s) =>
                (s.textContent ?? "")
                  .replace(/\s+/g, " ")
                  .trim()
                  .startsWith("via ") &&
                !(s.parentElement?.textContent ?? "")
                  .replace(/\s+/g, " ")
                  .trim()
                  .startsWith("via "),
            );
            return {
              attribution: attribution
                ? (attribution.textContent ?? "").replace(/\s+/g, " ").trim()
                : null,
              via: via
                ? (via.textContent ?? "").replace(/\s+/g, " ").trim()
                : null,
            };
          },
          [claim.value, claim.ref] as const,
        );

        check(`${who}: claim line found on the page`, !!lines);
        if (!lines) continue;

        const wantAttribution = expectedAttributionText(claim);
        check(
          `${who}: attribution line reads "${wantAttribution}"`,
          lines.attribution === wantAttribution,
          `got ${JSON.stringify(lines.attribution)}`,
        );

        const wantVia = expectedViaText(claim.chain);
        check(
          `${who}: chain line reads "${wantVia}" (authorities in citation order, works parenthesised)`,
          lines.via === wantVia,
          `got ${JSON.stringify(lines.via)}`,
        );
      }
    }
  } finally {
    await browser.close();
  }

  if (failures > 0) {
    console.error(`\ne2e-claim-chains: ${failures} check(s) FAILED`);
    process.exit(1);
  }
  console.log("\ne2e-claim-chains: all checks passed");
}

main().catch((err) => {
  console.error("e2e-claim-chains crashed:", err);
  process.exit(1);
});
