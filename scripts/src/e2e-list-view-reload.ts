/// <reference lib="dom" />
/* Real-browser check: the Map and Timeline pages reopen in List view
 * after a refresh. validate-view-param-sync statically pins the
 * ?view=list URL sync in map.tsx / timeline.tsx (init from the URL,
 * adoption on search changes, replaceState write-back), but nothing
 * proved the end-to-end behavior in a browser: a wiring regression
 * (e.g. the toggle no longer feeding the synced state) could pass the
 * static regexes while readers lose their List view on every reload.
 *
 * For each of /map and /timeline this script drives headless Chromium
 * against the running dev servers and asserts:
 *
 * 1. Default load shows the default view (no list element, no
 *    ?view=list in the URL) and the List toggle is not pressed.
 * 2. Clicking the List toggle shows the list (map-list-view /
 *    timeline-list-table), with real rows (>0 — positive control per
 *    audit-positive-controls), flips aria-pressed, and rewrites the
 *    URL to ?view=list without minting a history entry (replaceState).
 * 3. page.reload() keeps the list view: the list element is still
 *    rendered, the List toggle is still pressed, and ?view=list is
 *    still in the URL.
 * 4. Back/Forward restores the view via the SPA popstate path (no
 *    reload — a window marker must survive): pushState to the plain
 *    path swaps back to the default view, goBack() re-renders the
 *    list, goForward() returns to the default view again.
 *
 * Requirements: the api-server and laertius web workflows must be
 * running (shared proxy, default http://localhost:80) and the headless
 * Chromium shell installed (same setup as e2e-graph-shared-link):
 *   PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright \
 *     node scripts/node_modules/playwright-core/cli.js install chromium-headless-shell
 */
import "./lib/playwright-browsers-path";

const { chromium } = await import("playwright-core");
const { attachPageGuard } = await import("./lib/e2e-page-guard");

const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:80";

let failures = 0;
function check(label: string, ok: boolean, detail?: string) {
  if (ok) {
    console.log(`  ok: ${label}`);
  } else {
    failures++;
    console.error(`  FAIL: ${label}${detail ? ` (${detail})` : ""}`);
  }
}

interface PageSpec {
  path: string;
  /** data-testid of the List toggle button. */
  listToggle: string;
  /** data-testid of the default-view toggle button. */
  defaultToggle: string;
  /** data-testid of the element only rendered in List view. */
  listElement: string;
  /** Selector for the list's data rows (positive control: must be >0). */
  rowSelector: string;
}

const PAGES: PageSpec[] = [
  {
    path: "/map",
    listToggle: "map-view-list",
    defaultToggle: "map-view-map",
    listElement: "map-list-view",
    rowSelector: "[data-testid='map-list-view'] tbody tr",
  },
  {
    path: "/timeline",
    listToggle: "timeline-view-list",
    defaultToggle: "timeline-view-timeline",
    listElement: "timeline-list-table",
    rowSelector: "[data-testid='timeline-list-table'] tbody tr",
  },
];

async function main() {
  const browser = await chromium.launch({ headless: true });
  try {
    for (const spec of PAGES) {
      console.log(`\n=== ${spec.path} ===`);
      const page = await browser.newPage({
        viewport: { width: 1280, height: 900 },
      });
      const guard = attachPageGuard(page);
      const listSel = `[data-testid='${spec.listElement}']`;
      const pressed = (testid: string) =>
        page.getAttribute(`[data-testid='${testid}']`, "aria-pressed");
      const listVisible = () =>
        page.evaluate(
          (sel) => document.querySelector(sel) !== null,
          listSel,
        );

      // 1. Default load: default view, no ?view=list.
      await page.goto(`${BASE_URL}${spec.path}`, {
        waitUntil: "networkidle",
      });
      guard.assertPageLoaded();
      await guard.guarded(
        page.waitForSelector(`[data-testid='${spec.listToggle}']`),
      );
      check(
        "default load: list view not rendered",
        !(await listVisible()),
      );
      check(
        "default load: URL has no view=list",
        !page.url().includes("view=list"),
        page.url(),
      );
      check(
        "default load: List toggle not pressed",
        (await pressed(spec.listToggle)) === "false",
      );

      // 2. Toggle to List. In-page clicks use replaceState, so the
      // history length must not grow.
      const histBefore = await page.evaluate(() => history.length);
      await page.click(`[data-testid='${spec.listToggle}']`);
      await guard.guarded(page.waitForSelector(listSel));
      check(
        "toggle: List toggle pressed",
        (await pressed(spec.listToggle)) === "true",
      );
      check(
        "toggle: URL carries ?view=list",
        page.url().includes("view=list"),
        page.url(),
      );
      const histAfter = await page.evaluate(() => history.length);
      check(
        "toggle: no history entry minted (replaceState)",
        histAfter === histBefore,
        `history.length ${histBefore} -> ${histAfter}`,
      );
      // Positive control: the list actually has data rows, so the
      // presence checks above are not vacuously matching an empty shell.
      const rows = await page.locator(spec.rowSelector).count();
      check(`positive control: list has data rows (>0)`, rows > 0, `rows=${rows}`);

      // 3. Reload: the List view must survive.
      await page.reload({ waitUntil: "networkidle" });
      guard.assertPageLoaded();
      await guard.guarded(page.waitForSelector(listSel));
      check(
        "reload: URL keeps ?view=list",
        page.url().includes("view=list"),
        page.url(),
      );
      check(
        "reload: List toggle still pressed",
        (await pressed(spec.listToggle)) === "true",
      );
      check(
        "reload: default-view toggle not pressed",
        (await pressed(spec.defaultToggle)) === "false",
      );
      const rowsAfter = await page.locator(spec.rowSelector).count();
      check(
        "reload: list rows still rendered",
        rowsAfter === rows,
        `rows ${rows} -> ${rowsAfter}`,
      );

      // 4. Back/Forward restores the view without a reload. wouter
      // patches history.pushState to emit its location event, so
      // pushing the plain path is what an in-app link would do.
      await page.evaluate(() => {
        (window as unknown as { __viewMarker?: boolean }).__viewMarker = true;
      });
      const markerAlive = () =>
        page.evaluate(
          () =>
            (window as unknown as { __viewMarker?: boolean }).__viewMarker ===
            true,
        );
      await page.evaluate((path) => {
        window.history.pushState({}, "", path);
      }, spec.path);
      await guard.guarded(
        page.waitForSelector(listSel, { state: "detached" }),
      );
      check(
        "pushState plain path: adopts the default view",
        (await pressed(spec.defaultToggle)) === "true",
      );
      await page.goBack();
      await guard.guarded(page.waitForSelector(listSel));
      check(
        "Back: List view restored",
        (await pressed(spec.listToggle)) === "true",
      );
      check(
        "Back: URL carries ?view=list again",
        page.url().includes("view=list"),
        page.url(),
      );
      await page.goForward();
      await guard.guarded(
        page.waitForSelector(listSel, { state: "detached" }),
      );
      check(
        "Forward: default view restored",
        (await pressed(spec.defaultToggle)) === "true",
      );
      check(
        "Forward: URL drops view=list",
        !page.url().includes("view=list"),
        page.url(),
      );
      check("no page reload during Back/Forward", await markerAlive());

      await page.close();
    }
  } finally {
    await browser.close();
  }

  if (failures > 0) {
    console.error(`\n${failures} check(s) FAILED`);
    process.exit(1);
  }
  console.log("\nAll list-view reload/back-forward checks passed.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
