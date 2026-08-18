/// <reference lib="dom" />
// The in-page callbacks (page.evaluate / waitForFunction) run in the
// browser, so this Node-side script needs the DOM lib for their types.
//
// Real-browser check that every work carrying an alternative title still
// renders its "also titled <alt title> (D.L. ref)" note — with the ref as
// a working passage link — in the Section page claims panel. The altTitle
// mapping lives in the API (routes/graph.ts) and the note renders in
// claims-panel.tsx, but no validator drives a browser at it: a refactor
// could drop the altTitle block, lose the "(D.L. ref)" link, or stop
// passing altTitleSectionId while every source-level validator stays
// green — exactly how the chain lines went unchecked before
// e2e-claim-chains. This script follows that pattern:
//
// 1. It reads every altTitle-carrying claim live from the API
//    (/api/philosophers + /api/claims/{name}), so the check follows the
//    data. As a positive control it requires at least 30 such claims
//    (the Book 3 Plato catalogue carries 36 today) and that the known
//    "Phaedo, or On the Soul" (3.58, alt title "On the Soul") is among
//    them. If the API ever returns none, the script fails loudly instead
//    of passing vacuously.
// 2. For each section hosting alt-titled works, it opens the Section
//    page, expands the collapsible "From the text" panel, clicks the
//    Works group's "Show all N entries" expander when present (the panel
//    previews only the first 8 works), locates each work's own line
//    (matched by claim value + its "(D.L. ref)" citation), and asserts:
//    - the "also titled <altTitle>" note renders inside that line;
//    - the note carries a "(D.L. <altTitleRef>)" citation;
//    - that citation is an <a> linking to /section/<altTitleSectionId>
//      whenever the API resolves one (all current alt titles do).
//    A failure names the work and its D.L. reference.
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

// Positive-control pins: the Book 3 Plato catalogue is known to carry at
// least this many alt-titled works, including Phaedo's "On the Soul" at
// 3.58. If curation grows more alt titles the script picks them up
// automatically; if these pins ever vanish the dataset (or the API's
// altTitle mapping) changed underneath the check.
const MIN_ALT_TITLED = 30;
const KNOWN_WORK = "Phaedo, or On the Soul";
const KNOWN_ALT = "On the Soul";
const KNOWN_REF = "3.58";

type AltClaim = {
  philosopher: string;
  ref: string;
  sectionId: string;
  value: string;
  altTitle: string;
  altTitleRef: string;
  altTitleSectionId?: string;
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

async function main() {
  // Discover every alt-titled work claim from the live API so the check
  // follows the data instead of hard-coding the current catalogue.
  const philosophers = (await (
    await fetch(`${BASE_URL}/api/philosophers`)
  ).json()) as { name: string }[];

  const altClaims: AltClaim[] = [];
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
        altTitle?: string;
        altTitleRef?: string;
        altTitleSectionId?: string;
      }[];
    };
    for (const c of body.claims ?? []) {
      if (!c.altTitle) continue;
      check(
        `alt-titled work "${c.value}" (${p.name} ${c.ref}) resolves a section id`,
        !!c.sectionId,
      );
      check(
        `alt-titled work "${c.value}" (${p.name} ${c.ref}) carries altTitleRef`,
        !!c.altTitleRef,
      );
      if (!c.sectionId || !c.altTitleRef) continue;
      altClaims.push({
        philosopher: p.name,
        ref: c.ref,
        sectionId: c.sectionId,
        value: c.value,
        altTitle: c.altTitle,
        altTitleRef: c.altTitleRef,
        altTitleSectionId: c.altTitleSectionId,
      });
    }
  }

  console.log(
    `Positive control: the API serves the known alt-titled works (found ${altClaims.length})`,
  );
  check(
    `at least ${MIN_ALT_TITLED} alt-titled works come from the API`,
    altClaims.length >= MIN_ALT_TITLED,
    `found ${altClaims.length}`,
  );
  const known = altClaims.find(
    (c) => c.value === KNOWN_WORK && c.ref === KNOWN_REF,
  );
  check(
    `"${KNOWN_WORK}" (${KNOWN_REF}) carries alt title "${KNOWN_ALT}"`,
    !!known && known.altTitle === KNOWN_ALT,
    JSON.stringify(known),
  );
  if (altClaims.length === 0) {
    throw new Error(
      "no alt-titled works found in the API — the altTitle mapping was dropped from the claims response?",
    );
  }

  // Group by section so each page is opened once (the Book 3 catalogue
  // spreads the alt titles over a handful of sections).
  const bySection = new Map<string, AltClaim[]>();
  for (const c of altClaims) {
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
        `Section /section/${sectionId}: ${claims.length} alt-titled work(s)`,
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
      // The Works group previews only the first 8 entries; expand the
      // "Show all N entries" button when present so every alt-titled work
      // line is actually in the DOM.
      await page.waitForTimeout(200);
      await page.evaluate(() => {
        const btn = Array.from(document.querySelectorAll("button")).find((b) =>
          /^Show all \d+ entries$/.test(b.textContent?.trim() ?? ""),
        );
        if (btn) btn.click();
      });
      // Wait for the first claim's value to be on the page.
      await page.waitForFunction(
        (v) => document.body.innerText.includes(v),
        claims[0].value,
        { timeout: 10000 },
      );
      await page.waitForTimeout(200);

      for (const claim of claims) {
        const who = `"${claim.value}" (${claim.philosopher} ${claim.ref})`;
        // Locate the work's own <li> (matched by its value text AND its
        // "(D.L. ref)" citation so a same-valued sibling can't shadow it),
        // then read the "also titled ..." note inside it. No helper
        // functions inside evaluate: tsx's esbuild transform wraps named
        // locals with a __name helper that doesn't exist in the page.
        const note = await page.evaluate(
          ([value, ref, altRef]) => {
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
            // The note is the innermost span starting "also titled".
            const noteSpan = Array.from(li.querySelectorAll("span")).find(
              (s) =>
                (s.textContent ?? "")
                  .replace(/\s+/g, " ")
                  .trim()
                  .startsWith("also titled") &&
                !(s.parentElement?.textContent ?? "")
                  .replace(/\s+/g, " ")
                  .trim()
                  .startsWith("also titled"),
            );
            if (!noteSpan) return { text: null, linkHref: null };
            // The passage citation inside the note: an <a> whose text is
            // "(D.L. <altRef>)"; fall back to reporting a plain-span
            // citation as linkHref: null.
            const link = Array.from(noteSpan.querySelectorAll("a")).find(
              (a) =>
                (a.textContent ?? "").replace(/\s+/g, " ").trim() ===
                `(D.L. ${altRef})`,
            );
            return {
              text: (noteSpan.textContent ?? "").replace(/\s+/g, " ").trim(),
              linkHref: link ? link.getAttribute("href") : null,
            };
          },
          [claim.value, claim.ref, claim.altTitleRef] as const,
        );

        check(`${who}: work line found on the page`, !!note);
        if (!note) continue;

        const wantText = `also titled ${claim.altTitle} (D.L. ${claim.altTitleRef})`;
        check(
          `${who}: "also titled" note reads "${wantText}"`,
          note.text === wantText,
          `got ${JSON.stringify(note.text)}`,
        );

        if (claim.altTitleSectionId) {
          const wantHref = `/section/${claim.altTitleSectionId}`;
          check(
            `${who}: "(D.L. ${claim.altTitleRef})" is a passage link to ${wantHref}`,
            note.linkHref === wantHref ||
              note.linkHref?.endsWith(wantHref) === true,
            `got ${JSON.stringify(note.linkHref)}`,
          );
        } else {
          check(
            `${who}: unlinkable alt-title ref renders as plain text`,
            note.text === wantText,
          );
        }
      }
    }
  } finally {
    await browser.close();
  }

  if (failures > 0) {
    console.error(`\ne2e-alt-titles: ${failures} check(s) FAILED`);
    process.exit(1);
  }
  console.log("\ne2e-alt-titles: all checks passed");
}

main().catch((err) => {
  console.error("e2e-alt-titles crashed:", err);
  process.exit(1);
});
