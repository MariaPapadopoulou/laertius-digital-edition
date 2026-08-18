/// <reference lib="dom" />
// The in-page callbacks (page.evaluate / waitForFunction) run in the
// browser, so this Node-side script needs the DOM lib for their types.
//
// Real-browser check of the claims panel's Works list expander
// (claims-panel.tsx): the "Works" group truncates a philosopher's
// writings/wrote claims to WORKS_PREVIEW (8) entries behind a
// "Show all N entries" button, and "Show fewer" collapses back.
// A refactor of claims-panel.tsx or a change to the claims API shape
// could break the truncation, the counted label, or the expander while
// the source-level validators stay green. This script drives headless
// Chromium against the running dev servers:
//
// The same three scenarios run on TWO philosophers picked live from the
// API: the one with the MOST writings/wrote claims, and the boundary
// case — the one with the FEWEST works claims still above the preview
// size (e.g. 9), where an off-by-one in the slice or the button
// threshold would surface first.
//
// 1. On the first section of a many-works philosopher (picked live from
//    the API as described above, must be
//    > 8), opening the collapsible "From the text" panel must show
//    exactly 8 entries under the Works heading, with a button reading
//    "Show all N entries" where N equals the API's count of
//    writings/wrote claims for that philosopher.
// 2. Clicking the button must reveal all N entries and flip the label
//    to "Show fewer".
// 3. Clicking "Show fewer" must collapse back to 8 entries and restore
//    the counted "Show all N entries" label.
//
// The philosopher, section id, and expected count are read live from
// the API (/api/philosophers and /api/claims/{name}) so the check
// follows the data; only the preview size (8) is pinned, matching
// WORKS_PREVIEW in claims-panel.tsx.
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

// Must match WORKS_PREVIEW in claims-panel.tsx: at most this many works
// entries render before the "Show all N entries" expander appears.
const WORKS_PREVIEW = 8;

let failures = 0;
function check(label: string, ok: boolean, detail?: string) {
  if (ok) {
    console.log(`  ok: ${label}`);
  } else {
    failures++;
    console.error(`  FAIL: ${label}${detail ? ` (${detail})` : ""}`);
  }
}

type WorksState = {
  headingFound: boolean;
  entryCount: number;
  buttonLabel: string | null;
};

async function main() {
  // Pick the subject from the live API so the check follows the data:
  // the philosopher with the most writings/wrote claims.
  const philosophers = (await (
    await fetch(`${BASE_URL}/api/philosophers`)
  ).json()) as { name: string; firstId: string }[];

  type Subject = { name: string; firstId: string; works: number };
  let maxSubject: Subject | null = null;
  // The boundary case: the philosopher with the FEWEST works claims still
  // above the preview size. An off-by-one in the slice or the button
  // threshold could pass on the max case but fail here.
  let minSubject: Subject | null = null;
  for (const p of philosophers) {
    const res = await fetch(
      `${BASE_URL}/api/claims/${encodeURIComponent(p.name)}`,
    );
    if (!res.ok) continue;
    const body = (await res.json()) as { claims: { property: string }[] };
    const n = body.claims.filter(
      (c) => c.property === "writings" || c.property === "wrote",
    ).length;
    if (!maxSubject || n > maxSubject.works) {
      maxSubject = { name: p.name, firstId: p.firstId, works: n };
    }
    if (n > WORKS_PREVIEW && (!minSubject || n < minSubject.works)) {
      minSubject = { name: p.name, firstId: p.firstId, works: n };
    }
  }
  if (!maxSubject) throw new Error("no philosophers returned by the API");
  check(
    `${maxSubject.name} is a many-works philosopher (works count ${maxSubject.works} > ${WORKS_PREVIEW})`,
    maxSubject.works > WORKS_PREVIEW,
  );
  if (maxSubject.works <= WORKS_PREVIEW) {
    throw new Error("no philosopher with more works than the preview size");
  }
  if (!minSubject) {
    throw new Error(
      "no boundary philosopher with works count just above the preview size",
    );
  }
  check(
    `${minSubject.name} is the boundary philosopher (fewest works count still > ${WORKS_PREVIEW}: ${minSubject.works})`,
    minSubject.works > WORKS_PREVIEW,
  );
  console.log(
    `  max case: ${maxSubject.name} (${maxSubject.works} works claims, section ${maxSubject.firstId})`,
  );
  console.log(
    `  boundary case: ${minSubject.name} (${minSubject.works} works claims, section ${minSubject.firstId})`,
  );
  const subjects: { label: string; subject: Subject }[] = [
    { label: "max", subject: maxSubject },
    ...(minSubject.name === maxSubject.name
      ? []
      : [{ label: "boundary", subject: minSubject }]),
  ];

  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({
      viewport: { width: 1280, height: 720 },
    });
    // Fail fast with the failing URL/status instead of an opaque selector
    // timeout when the site itself fails to boot (500 on a module/CSS,
    // uncaught page error, etc.).
    const guard = attachPageGuard(page);

    // Snapshot the Works group inside the claims panel: the entry count
    // under the "Works" heading and the expander button's label.
    // No helper functions inside evaluate: tsx's esbuild transform wraps
    // named locals with a __name helper that doesn't exist in the page.
    const readWorksState = () =>
      page.evaluate((): WorksState => {
        const heading = Array.from(document.querySelectorAll("h4")).find(
          (h) => h.textContent === "Works",
        );
        if (!heading) {
          return { headingFound: false, entryCount: 0, buttonLabel: null };
        }
        const groupDiv = heading.parentElement;
        const list = groupDiv?.querySelector("ul") ?? null;
        const button = groupDiv?.querySelector("button") ?? null;
        return {
          headingFound: true,
          entryCount: list ? list.querySelectorAll(":scope > li").length : 0,
          buttonLabel: button?.textContent ?? null,
        };
      });

    const clickExpander = async () => {
      await page.evaluate(() => {
        const heading = Array.from(document.querySelectorAll("h4")).find(
          (h) => h.textContent === "Works",
        );
        const btn = heading?.parentElement?.querySelector("button");
        if (!btn) throw new Error("Works expander button not found");
        btn.click();
      });
      await page.waitForTimeout(200);
    };

    for (const { label, subject } of subjects) {
    console.log(
      `\n[${label} case] Scenario 1: ${subject.name} section (${subject.firstId}) truncates Works to ${WORKS_PREVIEW} entries`,
    );
    await page.goto(`${BASE_URL}/section/${subject.firstId}`, {
      waitUntil: "networkidle",
    });
    guard.assertPageLoaded();
    // The collapsible header button's textContent concatenates the card
    // title and the count: "From the textShow N facts".
    await guard.guarded(
      page.waitForFunction(
        () =>
          Array.from(document.querySelectorAll("button")).some((b) =>
            /Show \d+ facts/.test(b.textContent ?? ""),
          ),
        undefined,
        { timeout: 15000 },
      ),
    );
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll("button")).find((b) =>
        /Show \d+ facts/.test(b.textContent ?? ""),
      );
      if (!btn) throw new Error("claims panel header button not found");
      btn.click();
    });
    // Wait for the Works heading to be in the DOM.
    await guard.guarded(
      page.waitForFunction(
        () =>
          Array.from(document.querySelectorAll("h4")).some(
            (h) => h.textContent === "Works",
          ),
        undefined,
        { timeout: 15000 },
      ),
    );

    let state = await readWorksState();
    check("Works heading is present", state.headingFound);
    check(
      `only ${WORKS_PREVIEW} entries show by default`,
      state.entryCount === WORKS_PREVIEW,
      `entries=${state.entryCount}`,
    );
    check(
      `expander reads "Show all ${subject.works} entries" (N matches the API count)`,
      state.buttonLabel === `Show all ${subject.works} entries`,
      `label=${JSON.stringify(state.buttonLabel)}`,
    );

    console.log(
      `[${label} case] Scenario 2: clicking the expander reveals every entry`,
    );
    await clickExpander();
    state = await readWorksState();
    check(
      `all ${subject.works} entries are rendered`,
      state.entryCount === subject.works,
      `entries=${state.entryCount}`,
    );
    check(
      'label flips to "Show fewer"',
      state.buttonLabel === "Show fewer",
      `label=${JSON.stringify(state.buttonLabel)}`,
    );

    console.log(
      `[${label} case] Scenario 3: "Show fewer" collapses back to the preview`,
    );
    await clickExpander();
    state = await readWorksState();
    check(
      `entries collapse back to ${WORKS_PREVIEW}`,
      state.entryCount === WORKS_PREVIEW,
      `entries=${state.entryCount}`,
    );
    check(
      "counted Show all label is restored",
      state.buttonLabel === `Show all ${subject.works} entries`,
      `label=${JSON.stringify(state.buttonLabel)}`,
    );
    }
  } finally {
    await browser.close();
  }

  if (failures > 0) {
    console.error(`\ne2e-works-expander: ${failures} check(s) FAILED`);
    process.exit(1);
  }
  console.log("\ne2e-works-expander: all checks passed");
}

await main();
