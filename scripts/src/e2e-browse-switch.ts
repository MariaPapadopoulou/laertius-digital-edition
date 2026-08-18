/// <reference lib="dom" />
// The in-page callbacks (page.evaluate / waitForFunction) run in the
// browser, so this Node-side script needs the DOM lib for their types.
//
// Real-browser check that switching philosophers on /browse never shows
// stale claims OR stale passages from the previous selection. The
// sections/passages list below the claims panel is a separate React
// Query (useListSections with a per-philosopher queryKey in browse.tsx),
// so both must be asserted: a claims-only check could pass while the
// previous philosopher's Greek passages linger. The claims panel is keyed by
// philosopher name (key={selectedPhil.name} in browse.tsx), so switching
// selections should remount it fresh; if that key or the React Query
// cache wiring regresses, a reader could briefly (or permanently) see
// the previous philosopher's facts under the new name. e2e-asserted-in
// only ever selects one philosopher, so this switch flow had no live
// coverage.
//
// 1. On /browse, click Thales in the sidebar and wait for a distinctive
//    Thales-only claim ("Son of Examyas and Cleobulina...") in the open
//    claims panel.
// 2. Click Solon in the sidebar, wait for a distinctive Solon-only claim
//    ("Son of Execestides"), and assert the Thales claim is gone — both
//    immediately once Solon's claims render and after a settle delay
//    (catching a stale panel that lingers or reappears).
// 3. Sanity-check the header names Solon, so the claims shown belong to
//    the philosopher named above them.
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

// Distinctive claim fragments that appear only in one philosopher's
// claims panel (verified against /api/claims/<name>): Thales' parentage
// names Examyas, Solon's names Execestides.
// Distinctive passage fragments from each philosopher's sections list
// (verified against /api/sections?philosopher=<name>: each Greek fragment
// appears only in that philosopher's sections): Thales 1.1.22 names his
// clan the Thelidae, Solon 1.2.45 his seisachtheia reform. The sections
// list is a separate React Query from the claims panel (useListSections
// with a per-philosopher queryKey in browse.tsx), so a claims-only check
// could pass while stale passages linger below fresh claims.
const FIRST = {
  name: "Thales",
  claim: "Son of Examyas and Cleobulina",
  passage: "ἐκ τῶν Θηλιδῶν",
} as const;
const SECOND = {
  name: "Solon",
  claim: "Son of Execestides",
  passage: "τὴν σεισάχθειαν",
} as const;

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
    // timeout when the site itself fails to boot (500 on a module/CSS,
    // uncaught page error, etc.).
    const guard = attachPageGuard(page);

    // Selects a philosopher via the sidebar button (span text match, same
    // pattern as e2e-asserted-in). No helper functions inside evaluate:
    // tsx's esbuild transform wraps named locals with a __name helper
    // that doesn't exist in the page — so the click is inlined per call.
    async function selectPhilosopher(name: string): Promise<boolean> {
      await guard.guarded(
        page.waitForFunction(
          (n) =>
            Array.from(document.querySelectorAll("button")).some(
              (b) => b.querySelector("span")?.textContent?.trim() === n,
            ),
          name,
          { timeout: 30000 },
        ),
      );
      return page.evaluate((n) => {
        const btn = Array.from(document.querySelectorAll("button")).find(
          (b) => b.querySelector("span")?.textContent?.trim() === n,
        );
        if (!btn) return false;
        btn.click();
        return true;
      }, name);
    }

    console.log(
      `Scenario 1: /browse -> ${FIRST.name} shows his distinctive claim`,
    );
    await page.goto(`${BASE_URL}/browse`, { waitUntil: "networkidle" });
    guard.assertPageLoaded();
    check(
      `${FIRST.name} selected in the sidebar`,
      await selectPhilosopher(FIRST.name),
    );
    // The claims panel is collapsible but open by default on /browse.
    await guard.guarded(
      page.waitForFunction(
        (frag) => document.body.innerText.includes(frag),
        FIRST.claim,
        { timeout: 30000 },
      ),
    );
    check(`"${FIRST.claim}" rendered for ${FIRST.name}`, true);
    // The sections/passages list is a separate query — wait for a
    // distinctive Thales passage fragment too.
    await guard.guarded(
      page.waitForFunction(
        (frag) => document.body.innerText.includes(frag),
        FIRST.passage,
        { timeout: 30000 },
      ),
    );
    check(`passage "${FIRST.passage}" rendered for ${FIRST.name}`, true);

    console.log(
      `Scenario 2: switching to ${SECOND.name} drops ${FIRST.name}'s claims`,
    );
    check(
      `${SECOND.name} selected in the sidebar`,
      await selectPhilosopher(SECOND.name),
    );
    // Wait for the second philosopher's claims to render...
    await guard.guarded(
      page.waitForFunction(
        (frag) => document.body.innerText.includes(frag),
        SECOND.claim,
        { timeout: 30000 },
      ),
    );
    check(`"${SECOND.claim}" rendered for ${SECOND.name}`, true);
    // ...and the second philosopher's passages (separate sections query).
    await guard.guarded(
      page.waitForFunction(
        (frag) => document.body.innerText.includes(frag),
        SECOND.passage,
        { timeout: 30000 },
      ),
    );
    check(`passage "${SECOND.passage}" rendered for ${SECOND.name}`, true);
    // ...and assert the first philosopher's distinctive claim AND passage
    // are gone the moment the new content is up (a keyed remount + fresh
    // queries must not show the previous philosopher's facts or Greek
    // passages under the new name).
    const staleNow = await page.evaluate(
      ([claimFrag, passageFrag]) => ({
        claim: document.body.innerText.includes(claimFrag),
        passage: document.body.innerText.includes(passageFrag),
      }),
      [FIRST.claim, FIRST.passage] as const,
    );
    check(
      `"${FIRST.claim}" gone once ${SECOND.name}'s claims render`,
      !staleNow.claim,
    );
    check(
      `passage "${FIRST.passage}" gone once ${SECOND.name}'s passages render`,
      !staleNow.passage,
    );

    // Let queries/transitions settle, then re-assert: the panel must not
    // flip back to (or additionally render) the stale claims afterwards.
    await page.waitForTimeout(1500);
    const after = await page.evaluate(
      ([staleFrag, freshFrag, stalePassage, freshPassage, sel]) => ({
        stale: document.body.innerText.includes(staleFrag),
        fresh: document.body.innerText.includes(freshFrag),
        stalePassage: document.body.innerText.includes(stalePassage),
        freshPassage: document.body.innerText.includes(freshPassage),
        heading: Array.from(document.querySelectorAll(sel)).map((h) =>
          (h.textContent ?? "").trim(),
        ),
      }),
      [
        FIRST.claim,
        SECOND.claim,
        FIRST.passage,
        SECOND.passage,
        PAGE_HEADING_SELECTOR,
      ] as const,
    );
    check(
      `"${FIRST.claim}" still absent after settling`,
      !after.stale,
    );
    check(
      `"${SECOND.claim}" still present after settling`,
      after.fresh,
    );
    check(
      `passage "${FIRST.passage}" still absent after settling`,
      !after.stalePassage,
    );
    check(
      `passage "${SECOND.passage}" still present after settling`,
      after.freshPassage,
    );
    check(
      `content header names ${SECOND.name}`,
      after.heading.includes(SECOND.name),
      `h2s=${JSON.stringify(after.heading)}`,
    );
  } finally {
    await browser.close();
  }

  if (failures > 0) {
    console.error(`\ne2e-browse-switch: ${failures} check(s) FAILED`);
    process.exit(1);
  }
  console.log("\ne2e-browse-switch: all checks passed");
}

main().catch((err) => {
  console.error("e2e-browse-switch crashed:", err);
  process.exit(1);
});
