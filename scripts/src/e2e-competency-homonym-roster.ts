/// <reference lib="dom" />
// The in-page callbacks (page.evaluate / waitForFunction) run in the
// browser, so this Node-side script needs the DOM lib for their types.
//
// Real-browser check that the homonym roster on
// /competency?q=homonymy-proper-names really renders as GROUPS in Zone C
// (the "Entities" card in pages/competency.tsx), not as the old flat
// 45-chip wall.
//
// validate-competency-homonym-roster already pins the data level: the
// API payload carries Greek forms on person terms and at least one
// shared form with >= 2 bearers. But the page's grcGroups block could
// regress independently — a refactor could drop the grouping while the
// payload stays perfect. Two layers of defence here:
//
// 1. API contract: fetch the question payload, rebuild the page's own
//    grouping (group person terms by grc, keep forms with >= 2 bearers)
//    and assert at least one shared group exists — the positive control
//    that makes the DOM checks non-vacuous.
// 2. Rendered DOM: load the question, find the Persons group in the
//    Entities card, and assert:
//      - every expected shared Greek form renders as a group box whose
//        heading is that Greek form plus an "N bearers" count matching
//        the payload,
//      - each group box contains exactly its bearers' chips (as links),
//      - chips inside a group do NOT repeat the Greek form (renderChip
//        hideGrc contract — repeating it would mean the flat style),
//      - ungrouped singleton chips are NOT inside any group box, so the
//        roster is genuinely partitioned, not one flat wall.
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

const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:80";
const QUESTION_ID = "homonymy-proper-names";

// Greek letters (including the polytonic Extended block) a real Greek
// form must contain.
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

interface Term {
  en: string;
  grc?: string;
  type: string;
  firstId?: string;
}

async function main() {
  console.log(
    `Question ${QUESTION_ID}: homonym roster must render as grouped Greek forms`,
  );

  // --- Layer 1: the API payload, grouped exactly like Zone C ---
  const res = await fetch(`${BASE_URL}/api/competency/questions/${QUESTION_ID}`);
  check(`API responds 200`, res.ok, `${res.status}`);
  if (!res.ok) process.exit(1);
  const data = (await res.json()) as { terms: Term[] };

  const personTerms = data.terms.filter((t) => t.type === "person");
  console.log(`Person terms in payload: ${personTerms.length}`);
  check("payload ships person terms (positive control)", personTerms.length > 0);

  const byGrc = new Map<string, Term[]>();
  for (const t of personTerms) {
    if (!t.grc) continue;
    const arr = byGrc.get(t.grc) ?? [];
    arr.push(t);
    byGrc.set(t.grc, arr);
  }
  const shared = [...byGrc.entries()].filter(([, arr]) => arr.length > 1);
  const groupedNames = new Set(shared.flatMap(([, arr]) => arr.map((t) => t.en)));
  const singletons = personTerms.filter((t) => !groupedNames.has(t.en));
  console.log(
    `Expected shared-form groups: ${shared.length}; grouped bearers: ${groupedNames.size}; singletons: ${singletons.length}`,
  );
  check(
    "payload yields >= 1 shared-form group of >= 2 bearers (positive control)",
    shared.length > 0,
  );
  check(
    "every shared form is real Greek",
    shared.every(([grc]) => GREEK_RE.test(grc)),
  );
  if (shared.length === 0) process.exit(1);

  // --- Layer 2: the rendered DOM ---
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({
      viewport: { width: 1280, height: 900 },
    });
    // Fail fast with the failing URL/status instead of an opaque selector
    // timeout when the site itself fails to boot.
    const guard = attachPageGuard(page);
    await page.goto(`${BASE_URL}/competency?q=${QUESTION_ID}`, {
      waitUntil: "networkidle",
    });
    guard.assertPageLoaded();
    await guard.guarded(
      page.waitForFunction(
        () => /entities/i.test(document.body.innerText),
        undefined,
        { timeout: 30000 },
      ),
    );
    await page.waitForTimeout(300);

    const dom = await page.evaluate(
      (args: {
        shared: Array<{ grc: string; bearers: string[] }>;
        singletons: string[];
        cardHeadingSel: string;
      }) => {
        // Locate the Entities card: the container whose <h3> says
        // "Entities" (uppercased via CSS, text stays "Entities").
        // NOTE: no named helper functions in this in-page block;
        // tsx/esbuild wraps them with a __name helper that does not
        // exist inside the browser context.
        const h3 = Array.from(document.querySelectorAll(args.cardHeadingSel)).find(
          (h) => (h.textContent ?? "").trim().toLowerCase() === "entities",
        );
        const card = h3?.parentElement;
        if (!card) return { cardFound: false as const };

        // The Persons type group: the div whose <h4> reads "Persons".
        const h4 = Array.from(card.querySelectorAll("h4")).find(
          (h) => (h.textContent ?? "").trim().toLowerCase() === "persons",
        );
        const personsGroup = h4?.parentElement ?? null;
        if (!personsGroup) return { cardFound: true as const, personsFound: false as const };

        // A group box is a bordered rounded container holding the shared
        // Greek-form heading, an "N bearers" count, and the bearer chips.
        // Identify boxes structurally: direct-descendant divs of the
        // Persons group that contain a "bearers" count marker.
        const boxes = Array.from(personsGroup.querySelectorAll("div")).filter(
          (d) =>
            d.parentElement?.parentElement === personsGroup &&
            /\d+\s+bearers/.test(d.textContent ?? ""),
        );

        const groupInfo = boxes.map((box) => {
          const spans = Array.from(box.querySelectorAll("span"));
          const heading =
            (spans.find((s) => !/bearers/.test(s.textContent ?? ""))
              ?.textContent ?? "").trim();
          const countMatch = (box.textContent ?? "").match(/(\d+)\s+bearers/);
          const chips = Array.from(box.querySelectorAll("a"))
            .map((a) => (a.textContent ?? "").trim())
            // drop the tiny graph-arrow links (↗) that follow some chips
            .filter((t) => t && t !== "\u2197");
          // hideGrc contract: inside a group box, chip rows must NOT
          // repeat the Greek form after the English name. The only
          // Greek text allowed in the box is the single heading.
          const greekSpans = spans.filter((s) =>
            /[\u0370-\u03FF\u1F00-\u1FFF]/.test(s.textContent ?? ""),
          );
          return {
            heading,
            count: countMatch ? Number(countMatch[1]) : null,
            chips,
            greekSpanCount: greekSpans.filter(
              (s) => !spans.some((o) => o !== s && o.contains(s)),
            ).length,
          };
        });

        // Singleton chips: anchors in the Persons group not inside any box.
        const singletonChips = Array.from(personsGroup.querySelectorAll("a"))
          .filter((a) => !boxes.some((b) => b.contains(a)))
          .map((a) => (a.textContent ?? "").trim())
          .filter((t) => t && t !== "\u2197");

        return {
          cardFound: true as const,
          personsFound: true as const,
          groupInfo,
          singletonChips,
        };
      },
      {
        shared: shared.map(([grc, arr]) => ({
          grc,
          bearers: arr.map((t) => t.en),
        })),
        singletons: singletons.map((t) => t.en),
        cardHeadingSel: CARD_HEADING_SELECTOR,
      },
    );

    check("Entities card rendered", dom.cardFound === true);
    if (!dom.cardFound) process.exit(1);
    check("Persons group rendered", dom.personsFound === true);
    if (!dom.personsFound || !dom.groupInfo) {
      console.error(`\n${failures + 1} check(s) failed`);
      process.exit(1);
    }

    check(
      `roster renders ${shared.length} group box(es), not a flat chip wall`,
      dom.groupInfo.length === shared.length,
      `found ${dom.groupInfo.length}`,
    );

    for (const { grc, bearers } of shared.map(([grc, arr]) => ({
      grc,
      bearers: arr.map((t) => t.en),
    }))) {
      const box = dom.groupInfo.find((g) => g.heading === grc);
      check(`group box with Greek heading "${grc}" rendered`, !!box);
      if (!box) continue;
      check(
        `"${grc}" box shows "${bearers.length} bearers"`,
        box.count === bearers.length,
        `shows ${box.count ?? "(none)"}`,
      );
      const chipSet = new Set(box.chips);
      const missing = bearers.filter((b) => !chipSet.has(b));
      check(
        `"${grc}" box contains chips for all bearers: ${bearers.join(", ")}`,
        missing.length === 0 && box.chips.length === bearers.length,
        missing.length
          ? `missing: ${missing.join(", ")}`
          : `chip count ${box.chips.length} != ${bearers.length}`,
      );
      check(
        `"${grc}" box shows the Greek form once (chips don't repeat it)`,
        box.greekSpanCount === 1,
        `found ${box.greekSpanCount} top-level Greek spans`,
      );
    }

    // The singleton chips must sit OUTSIDE every group box, and no
    // grouped bearer may leak into the singleton row (a flat wall would
    // put everyone there).
    const singletonSet = new Set(dom.singletonChips);
    const leaked = [...groupedNames].filter((n) => singletonSet.has(n));
    check(
      "no grouped bearer leaks into the ungrouped chip row",
      leaked.length === 0,
      `leaked: ${leaked.join(", ")}`,
    );
    const expectedSingles = singletons.map((t) => t.en);
    const missingSingles = expectedSingles.filter((n) => !singletonSet.has(n));
    check(
      `all ${expectedSingles.length} singleton bearers render outside the group boxes`,
      missingSingles.length === 0,
      `missing: ${missingSingles.join(", ")}`,
    );

    // --- Layer 3: chip click-through — the chip must open the RIGHT
    // bearer's passage, not merely a passage of someone sharing the
    // name. For each shared-form group, pick one bearer whose term
    // ships a firstId (the API resolves it from the Index tagging;
    // ambiguous labels deliberately ship none), click that chip inside
    // its group box, and assert:
    //   1. the SPA navigates to /section/<firstId> and renders it,
    //   2. the destination section is tagged with an entity whose
    //      label is exactly the clicked bearer's (annotations API) —
    //      the specific-person check a shared Greek form cannot fake.
    console.log("\nClick-through: one bearer chip per shared-form group");
    const targets = shared
      .map(([grc, arr]) => {
        const bearer = arr.find((t) => t.firstId);
        return bearer ? { grc, en: bearer.en, firstId: bearer.firstId! } : null;
      })
      .filter((t): t is NonNullable<typeof t> => t !== null);
    // Tightened 2026-07 (Cratinus split): EVERY shared-form group must
    // ship at least one bearer chip with a firstId section link — a
    // curation regression that strands a whole group on the /graph
    // fallback fails here, not silently.
    check(
      `every shared-form group ships a bearer chip with a firstId section link (${targets.length}/${shared.length})`,
      targets.length === shared.length,
      `groups with a linkable bearer: ${targets.length}/${shared.length}`,
    );
    console.log(
      `Groups with a section-linked bearer: ${targets.length}/${shared.length}`,
    );

    for (const { grc, en, firstId } of targets) {
      // Fresh load of the question page for every click
      await page.goto(`${BASE_URL}/competency?q=${QUESTION_ID}`, {
        waitUntil: "networkidle",
      });
      guard.assertPageLoaded();
      await guard.guarded(
        page.waitForFunction(
          () => /entities/i.test(document.body.innerText),
          undefined,
          { timeout: 30000 },
        ),
      );

      // The group box: the innermost bordered container whose heading
      // span is exactly this Greek form. The chip: the link named
      // exactly the bearer (exact:true skips the tiny ↗ graph links).
      const box = page
        .locator(`div.px-3.py-2:has(> div > span:text-is("${grc}"))`)
        .first();
      const chip = box.getByRole("link", { name: en, exact: true });
      const chipCount = await chip.count();
      check(`"${grc}" box has a clickable chip for ${en}`, chipCount === 1, `found ${chipCount}`);
      if (chipCount !== 1) continue;

      await chip.click();
      let navigated = true;
      try {
        await page.waitForURL(`**/section/${firstId}*`, { timeout: 15000 });
      } catch {
        navigated = false;
      }
      check(
        `clicking ${en} opens /section/${firstId}`,
        navigated,
        `landed on ${page.url()}`,
      );
      if (!navigated) continue;

      // The section page really rendered (its id appears in the body)
      const rendered = await page
        .waitForFunction(
          (sid: string) => document.body.innerText.includes(sid),
          firstId,
          { timeout: 15000 },
        )
        .then(() => true)
        .catch(() => false);
      check(`section page ${firstId} renders`, rendered);

      // The specific-bearer assertion: the destination section must be
      // tagged with an entity labelled exactly like the clicked bearer.
      const annRes = await fetch(
        `${BASE_URL}/api/sections/${encodeURIComponent(firstId)}/annotations`,
      );
      check(`annotations API responds for ${firstId}`, annRes.ok, `${annRes.status}`);
      if (!annRes.ok) continue;
      const ann = (await annRes.json()) as {
        annotations: Array<{ label?: string; kind: string }>;
      };
      check(
        `section ${firstId} is tagged with "${en}" specifically (not just the shared form ${grc})`,
        ann.annotations.some((a) => a.label === en),
        `tagged labels: ${[...new Set(ann.annotations.map((a) => a.label))].join(", ")}`,
      );
    }
  } finally {
    await browser.close();
  }

  if (failures > 0) {
    console.error(`\n${failures} check(s) failed`);
    process.exit(1);
  }
  console.log("\nAll homonym-roster grouping checks passed");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
