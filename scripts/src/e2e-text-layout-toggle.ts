/// <reference lib="dom" />
/* Real-browser check for the Parallel/Stacked text-layout toggle
 * (WCAG 1.4.10 reflow). Pins:
 *
 * 1. The toggle (data-testid="text-layout-toggle") is present on all
 *    four passage pages: /browse (after selecting a philosopher),
 *    /section/:id, /search?q=..., and /verses.
 * 2. Default is Parallel: passage/verse body grids render two columns
 *    at desktop width (md:grid-cols-2).
 * 3. Clicking "Stacked" collapses every passage/verse body grid on the
 *    page to ONE column, live, and writes "stacked" to
 *    localStorage["laertius:text-layout"].
 * 4. The choice survives SPA navigation (browse -> section) and full
 *    reloads (search and verses are fresh page.goto loads): each later
 *    page must come up already stacked with the toggle's aria-pressed
 *    reflecting it.
 * 5. Switching back to Parallel on /verses restores two-column grids
 *    and rewrites localStorage, and survives a reload of /verses.
 * 6. The other passage-bearing listing pages (/sayings, /letters,
 *    /doxography, /anecdotes, /testaments) render their Greek/English
 *    text vertically stacked at every width, so they satisfy reflow
 *    (WCAG 1.4.10) without carrying the toggle. With "stacked" stored,
 *    each page must render Greek text (positive control) and no Greek
 *    block may sit inside a two-pane multi-column grid — the shape of
 *    the PassageCard/VerseCard parallel markup. If such a layout is
 *    ever introduced there, it must honor the stored preference or
 *    this check fails. Before probing, every closed reveal on the page
 *    (native <details> and aria-expanded="false" expander buttons) is
 *    opened, so Greek surfaced only after user interaction — a future
 *    "show original" expander or parallel panel — is held to the same
 *    contract instead of hiding from the first-paint scan. A synthetic
 *    hidden-Greek expander injected on the first listing page proves
 *    the opener actually reveals hidden Greek and that a revealed
 *    two-pane Greek grid is flagged (positive control, not vacuous).
 *
 * Passage/verse body grids are identified structurally: display:grid
 * elements carrying the divide-border class with exactly two direct
 * children (the Greek and English panes) — the shared markup of
 * PassageCard and VerseCard. Each page must expose at least one such
 * grid, so the check can never pass vacuously.
 *
 * Requirements: the api-server and laertius web workflows must be
 * running and the headless Chromium shell installed:
 *   PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright \
 *     node scripts/node_modules/playwright-core/cli.js install chromium-headless-shell
 */

import "./lib/playwright-browsers-path";

const { chromium } = await import("playwright-core");
const { attachPageGuard } = await import("./lib/e2e-page-guard");

const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:80";
const STORAGE_KEY = "laertius:text-layout";
const TOGGLE = '[data-testid="text-layout-toggle"]';

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
  // A philosopher whose chapter has sections, for /browse and /section.
  const philRes = await fetch(`${BASE_URL}/api/philosophers`);
  if (!philRes.ok) throw new Error(`/api/philosophers -> ${philRes.status}`);
  const phils = (await philRes.json()) as {
    name: string;
    sectionCount: number;
    firstId: string;
  }[];
  const phil = phils.find((p) => p.name !== "Prologue" && p.sectionCount > 0);
  if (!phil) throw new Error("no philosopher with sections found");
  console.log(`Using philosopher ${phil.name} (first section ${phil.firstId})`);

  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({
      viewport: { width: 1280, height: 900 }, // >= md so parallel = 2 columns
    });
    // Fail fast with the failing URL/status instead of an opaque selector
    // timeout when the site itself fails to boot.
    const guard = attachPageGuard(page);

    // In-page probes -------------------------------------------------
    const storedLayout = () =>
      page.evaluate((k) => window.localStorage.getItem(k), STORAGE_KEY);
    // Column-track counts of every passage/verse body grid on the page.
    const gridColumnCounts = () =>
      page.evaluate(() => {
        return Array.from(
          document.querySelectorAll('div[class*="divide-border"]'),
        )
          .filter(
            (el) =>
              getComputedStyle(el).display === "grid" &&
              el.children.length === 2,
          )
          .map(
            (el) =>
              getComputedStyle(el)
                .gridTemplateColumns.split(" ")
                .filter(Boolean).length,
          );
      });
    const togglePressed = () =>
      page.evaluate((sel) => {
        const t = document.querySelector(sel);
        if (!t) return null;
        return {
          parallel: t
            .querySelector('[data-testid="text-layout-parallel"]')
            ?.getAttribute("aria-pressed"),
          stacked: t
            .querySelector('[data-testid="text-layout-stacked"]')
            ?.getAttribute("aria-pressed"),
        };
      }, TOGGLE);

    const assertPage = async (
      label: string,
      expect: "parallel" | "stacked",
    ) => {
      await guard.guarded(page.waitForSelector(TOGGLE, { timeout: 20000 }));
      check(`${label}: toggle present`, true);
      const pressed = await togglePressed();
      check(
        `${label}: toggle marks ${expect} active (aria-pressed)`,
        expect === "stacked"
          ? pressed?.stacked === "true" && pressed?.parallel === "false"
          : pressed?.parallel === "true" && pressed?.stacked === "false",
        JSON.stringify(pressed),
      );
      const cols = await gridColumnCounts();
      check(
        `${label}: has at least one passage/verse grid`,
        cols.length > 0,
        "no body grids found — positive control failed",
      );
      const want = expect === "stacked" ? 1 : 2;
      check(
        `${label}: all ${cols.length} grids have ${want} column(s)`,
        cols.length > 0 && cols.every((c) => c === want),
        `columns=${JSON.stringify(cols)}`,
      );
    };

    // ---- Step 1: /browse, fresh profile -> default Parallel ----
    console.log("Step 1: /browse defaults to Parallel");
    await page.goto(`${BASE_URL}/browse`, { waitUntil: "networkidle" });
    guard.assertPageLoaded();
    check("fresh profile has no stored layout", (await storedLayout()) === null);
    await page.click(`button:has-text("${phil.name}")`);
    await assertPage("browse (default)", "parallel");

    // ---- Step 2: click Stacked -> grids collapse + persisted ----
    console.log("Step 2: choosing Stacked collapses grids and persists");
    await page.click('[data-testid="text-layout-stacked"]');
    await guard.guarded(
      page.waitForFunction(
        () =>
        Array.from(document.querySelectorAll('div[class*="divide-border"]'))
          .filter(
            (el) =>
              getComputedStyle(el).display === "grid" &&
              el.children.length === 2,
          )
          .every(
            (el) =>
              getComputedStyle(el)
                .gridTemplateColumns.split(" ")
                .filter(Boolean).length === 1,
          ),
        undefined,
        { timeout: 5000 },
      ),
    );
    await assertPage("browse (stacked)", "stacked");
    check(
      `localStorage["${STORAGE_KEY}"] = "stacked"`,
      (await storedLayout()) === "stacked",
      `stored=${await storedLayout()}`,
    );

    // ---- Step 3: SPA-navigate to a section page, still stacked ----
    console.log("Step 3: /section keeps Stacked across SPA navigation");
    const sectionHref = await page.evaluate(() => {
      const a = document.querySelector('a[href^="/section/"]');
      return a?.getAttribute("href") ?? null;
    });
    check("browse offers a /section/ link", sectionHref !== null);
    if (sectionHref) {
      await page.click(`a[href="${sectionHref}"]`);
      await assertPage(`section ${sectionHref}`, "stacked");
    }

    // ---- Step 4: full reload onto /search, still stacked ----
    console.log("Step 4: /search comes up Stacked after a full reload");
    await page.goto(
      `${BASE_URL}/search?q=${encodeURIComponent(phil.name)}&mode=sparse&k=5`,
      { waitUntil: "networkidle" },
    );
    guard.assertPageLoaded();
    await assertPage("search", "stacked");

    // ---- Step 5: full reload onto /verses, still stacked ----
    console.log("Step 5: /verses comes up Stacked after a full reload");
    await page.goto(`${BASE_URL}/verses`, { waitUntil: "networkidle" });
    guard.assertPageLoaded();
    await assertPage("verses", "stacked");

    // ---- Step 6: other passage-bearing listing pages under Stacked ----
    // These pages stack Greek above English at every width today, so
    // they honor reflow without the toggle. Guard that decision: while
    // "stacked" is stored, no Greek block may render inside a two-pane
    // multi-column grid.
    console.log(
      "Step 6: listing pages keep Greek text single-column under Stacked",
    );
    const LISTING_PAGES = [
      "/sayings",
      "/letters",
      "/doxography",
      "/anecdotes",
      "/testaments",
    ];
    // Count of Greek elements actually laid out (visible) right now.
    const visibleGrcCount = () =>
      page.evaluate(
        () =>
          Array.from(document.querySelectorAll('[lang="grc"]')).filter(
            (el) => {
              // checkVisibility sees through closed-<details> content
              // (content-visibility) where getClientRects does not.
              const cv = (
                el as Element & { checkVisibility?: () => boolean }
              ).checkVisibility;
              if (typeof cv === "function") return cv.call(el);
              const r = el.getBoundingClientRect();
              return r.width > 0 && r.height > 0;
            },
          ).length,
      );
    // Open every closed reveal so interaction-hidden Greek is surfaced
    // before the grid scan. Covers native <details> and expander
    // buttons that advertise state via aria-expanded="false" (the
    // accessible pattern any future "show original" toggle must use).
    // Note: components that only open on real pointer events (e.g.
    // Radix pointerdown-driven popovers) may not respond to a
    // synthetic click; those carry no Greek on these pages today.
    const openHiddenReveals = () =>
      page.evaluate(() => {
        let opened = 0;
        for (const d of Array.from(
          document.querySelectorAll("details:not([open])"),
        )) {
          (d as HTMLDetailsElement).open = true;
          opened++;
        }
        for (const b of Array.from(
          document.querySelectorAll(
            'button[aria-expanded="false"], [role="button"][aria-expanded="false"]',
          ),
        )) {
          (b as HTMLElement).click();
          opened++;
        }
        return opened;
      });
    // Nearest-grid violation scan shared by the real pages and the
    // positive control below.
    const scanGrcGrids = () =>
      page.evaluate(() => {
        const grc = Array.from(document.querySelectorAll('[lang="grc"]'));
        const violations: string[] = [];
        for (const el of grc) {
          // Nearest grid ancestor decides: a two-child grid with more
          // than one column track is parallel-passage markup that must
          // have honored the stored Stacked preference.
          let node = el.parentElement;
          while (node) {
            const cs = getComputedStyle(node);
            if (cs.display === "grid") {
              const cols = cs.gridTemplateColumns
                .split(" ")
                .filter(Boolean).length;
              if (cols > 1 && node.children.length === 2) {
                violations.push(String(node.className).slice(0, 100));
              }
              break;
            }
            node = node.parentElement;
          }
        }
        return { grcCount: grc.length, violations };
      });
    for (const path of LISTING_PAGES) {
      await page.goto(`${BASE_URL}${path}`, { waitUntil: "networkidle" });
      guard.assertPageLoaded();
      await guard.guarded(
        page.waitForSelector('[lang="grc"]', { timeout: 20000 }),
      );

      if (path === LISTING_PAGES[0]) {
        // ---- Positive control (once): a synthetic hidden-Greek
        // expander wrapping a two-pane grid must (a) be opened by
        // openHiddenReveals — visible Greek count rises — and (b) be
        // flagged by the grid scan. Proves the interaction probe can
        // never pass vacuously against a future reveal UI.
        await page.evaluate(() => {
          const details = document.createElement("details");
          details.id = "e2e-hidden-grc-control";
          const summary = document.createElement("summary");
          summary.textContent = "show original (e2e control)";
          const grid = document.createElement("div");
          grid.style.display = "grid";
          grid.style.gridTemplateColumns = "1fr 1fr";
          const grcP = document.createElement("p");
          grcP.setAttribute("lang", "grc");
          grcP.textContent = "γνῶθι σεαυτόν";
          const enP = document.createElement("p");
          enP.textContent = "know thyself";
          grid.append(grcP, enP);
          details.append(summary, grid);
          (document.querySelector("main") ?? document.body).appendChild(
            details,
          );
        });
        const beforeCtl = await visibleGrcCount();
        const openedCtl = await openHiddenReveals();
        const afterCtl = await visibleGrcCount();
        check(
          "positive control: opener reveals hidden Greek",
          openedCtl > 0 && afterCtl > beforeCtl,
          `opened=${openedCtl}, visible grc ${beforeCtl} -> ${afterCtl}`,
        );
        const ctlProbe = await scanGrcGrids();
        check(
          "positive control: revealed two-pane Greek grid is flagged",
          ctlProbe.violations.length > 0,
        );
        await page.evaluate(() =>
          document.getElementById("e2e-hidden-grc-control")?.remove(),
        );
      }

      const beforeReveal = await visibleGrcCount();
      const opened = await openHiddenReveals();
      const afterReveal = await visibleGrcCount();
      console.log(
        `  ${path}: opened ${opened} reveal(s); visible Greek ${beforeReveal} -> ${afterReveal}`,
      );
      const probe = await scanGrcGrids();
      check(
        `${path}: renders Greek text (positive control)`,
        probe.grcCount > 0,
      );
      check(
        `${path}: no Greek block in a two-pane multi-column grid while Stacked`,
        probe.violations.length === 0,
        JSON.stringify(probe.violations),
      );
      check(
        `${path}: stored layout still "stacked"`,
        (await storedLayout()) === "stacked",
      );
    }

    // ---- Step 7: back to Parallel, persists across reload ----
    console.log("Step 7: switching back to Parallel persists across reload");
    await page.goto(`${BASE_URL}/verses`, { waitUntil: "networkidle" });
    guard.assertPageLoaded();
    await assertPage("verses (still stacked before switch)", "stacked");
    await page.click('[data-testid="text-layout-parallel"]');
    await assertPage("verses (parallel again)", "parallel");
    check(
      `localStorage["${STORAGE_KEY}"] = "parallel"`,
      (await storedLayout()) === "parallel",
      `stored=${await storedLayout()}`,
    );
    await page.reload({ waitUntil: "networkidle" });
    guard.assertPageLoaded();
    await assertPage("verses (after reload)", "parallel");

    await page.close();
  } finally {
    await browser.close();
  }

  if (failures > 0) {
    console.error(`\n${failures} check(s) FAILED`);
    process.exit(1);
  }
  console.log("\nAll Parallel/Stacked toggle checks passed.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
