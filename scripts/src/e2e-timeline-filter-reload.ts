/// <reference lib="dom" />
/* Real-browser check: a refreshed /timeline keeps the school filter and
 * the opened philosopher. timeline.tsx syncs ?school= (movement filter)
 * and ?p= (expanded philosopher) to the URL the same way it syncs
 * ?view=list, but e2e-list-view-reload only exercises ?view=. A wiring
 * regression in the school/p sync would silently break shared and
 * reloaded timeline links while the ?view= checks stay green.
 *
 * This script drives headless Chromium against the running dev servers
 * and asserts:
 *
 * 1. Default load: no ?school= / ?p= in the URL, no chip pressed, no
 *    philosopher expanded.
 * 2. Clicking a school chip filters the rows (positive control: the
 *    visible-row count actually changes and stays >0), flips
 *    aria-pressed, and rewrites the URL to ?school=<id> without minting
 *    a history entry (replaceState).
 * 3. Clicking a philosopher row expands it (aria-expanded=true, detail
 *    panel rendered) and writes ?p=<name> to the URL.
 * 4. page.reload() keeps both: the chip is still pressed, the same
 *    philosopher is still expanded with its panel rendered, and the URL
 *    still carries ?school= and ?p=.
 * 5. Back/Forward restores them via the SPA popstate path (no reload —
 *    a window marker must survive): pushState to the plain path clears
 *    the filter and collapses the row, goBack() restores both, and
 *    goForward() clears them again.
 *
 * Requirements: the api-server and laertius web workflows must be
 * running (shared proxy, default http://localhost:80) and the headless
 * Chromium shell installed (same setup as e2e-list-view-reload).
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

const CHIP_SEL = "[data-testid^='timeline-school-']";
const PHIL_SEL = "[data-testid^='timeline-phil-']";

async function main() {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({
      viewport: { width: 1280, height: 900 },
    });
    const guard = attachPageGuard(page);

    const philRows = () => page.locator(PHIL_SEL).count();
    const expandedNames = () =>
      page.$$eval(PHIL_SEL, (els) =>
        els
          .filter((el) => el.getAttribute("aria-expanded") === "true")
          .map(
            (el) =>
              el.getAttribute("data-testid")?.replace(/^timeline-phil-/, "") ??
              "",
          ),
      );

    // 1. Default load: no filter, nothing expanded.
    console.log(`\n=== /timeline (school filter + expanded philosopher) ===`);
    await page.goto(`${BASE_URL}/timeline`, { waitUntil: "networkidle" });
    guard.assertPageLoaded();
    await guard.guarded(page.waitForSelector(CHIP_SEL));
    await guard.guarded(page.waitForSelector(PHIL_SEL));
    check(
      "default load: URL has no school=/p=",
      !page.url().includes("school=") && !/[?&]p=/.test(page.url()),
      page.url(),
    );
    const pressedDefault = await page
      .locator(`${CHIP_SEL}[aria-pressed='true']`)
      .count();
    check("default load: no school chip pressed", pressedDefault === 0);
    check(
      "default load: no philosopher expanded",
      (await expandedNames()).length === 0,
    );
    const rowsAll = await philRows();
    check("positive control: unfiltered rows > 0", rowsAll > 0, `rows=${rowsAll}`);

    // 2. Apply a school filter. Pick the FIRST chip whose id we read from
    // its own data-testid so the check does not hardcode movement ids.
    const chipTestid = await page
      .locator(CHIP_SEL)
      .first()
      .getAttribute("data-testid");
    const schoolId = chipTestid!.replace(/^timeline-school-/, "");
    const chipSel = `[data-testid='${chipTestid}']`;
    const histBefore = await page.evaluate(() => history.length);
    await page.click(chipSel);
    await guard.guarded(page.waitForSelector(`${chipSel}[aria-pressed='true']`));
    check(
      "filter: URL carries ?school=<id>",
      new URL(page.url()).searchParams.get("school") === schoolId,
      page.url(),
    );
    const histAfterChip = await page.evaluate(() => history.length);
    check(
      "filter: no history entry minted (replaceState)",
      histAfterChip === histBefore,
      `history.length ${histBefore} -> ${histAfterChip}`,
    );
    // Positive control: the filter really filters — fewer rows than the
    // full roster, but still more than zero (otherwise later presence
    // checks would be vacuous).
    const rowsFiltered = await philRows();
    check(
      "positive control: filter changes visible rows (0 < filtered < all)",
      rowsFiltered > 0 && rowsFiltered < rowsAll,
      `rows ${rowsAll} -> ${rowsFiltered}`,
    );

    // 3. Expand the first visible philosopher.
    const philTestid = await page
      .locator(PHIL_SEL)
      .first()
      .getAttribute("data-testid");
    const philName = philTestid!.replace(/^timeline-phil-/, "");
    const philSel = `[data-testid='${philTestid}']`;
    await page.click(philSel);
    await guard.guarded(
      page.waitForSelector(`${philSel}[aria-expanded='true']`),
    );
    check(
      "expand: URL carries ?p=<name>",
      new URL(page.url()).searchParams.get("p") === philName,
      page.url(),
    );
    check(
      "expand: exactly this philosopher expanded",
      JSON.stringify(await expandedNames()) === JSON.stringify([philName]),
    );

    // 4. Reload: filter AND expansion must survive.
    await page.reload({ waitUntil: "networkidle" });
    guard.assertPageLoaded();
    await guard.guarded(page.waitForSelector(CHIP_SEL));
    const reloadedUrl = new URL(page.url());
    check(
      "reload: URL keeps ?school=",
      reloadedUrl.searchParams.get("school") === schoolId,
      page.url(),
    );
    check(
      "reload: URL keeps ?p=",
      reloadedUrl.searchParams.get("p") === philName,
      page.url(),
    );
    await guard.guarded(page.waitForSelector(`${chipSel}[aria-pressed='true']`));
    check("reload: school chip still pressed", true);
    await guard.guarded(
      page.waitForSelector(`${philSel}[aria-expanded='true']`),
    );
    check(
      "reload: same philosopher still expanded",
      JSON.stringify(await expandedNames()) === JSON.stringify([philName]),
    );
    const rowsReloaded = await philRows();
    check(
      "reload: filter still applied to rows",
      rowsReloaded === rowsFiltered,
      `rows ${rowsFiltered} -> ${rowsReloaded}`,
    );

    // 5. Back/Forward restores them via the SPA popstate path. wouter
    // patches history.pushState, so pushing the plain path is what an
    // in-app link would do.
    await page.evaluate(() => {
      (window as unknown as { __tlMarker?: boolean }).__tlMarker = true;
    });
    const markerAlive = () =>
      page.evaluate(
        () =>
          (window as unknown as { __tlMarker?: boolean }).__tlMarker === true,
      );
    await page.evaluate(() => {
      window.history.pushState({}, "", "/timeline");
    });
    await guard.guarded(
      page.waitForSelector(`${philSel}[aria-expanded='false']`),
    );
    check(
      "pushState plain path: filter cleared",
      (await page.locator(`${CHIP_SEL}[aria-pressed='true']`).count()) === 0,
    );
    check(
      "pushState plain path: rows back to unfiltered",
      (await philRows()) === rowsAll,
    );
    await page.goBack();
    await guard.guarded(page.waitForSelector(`${chipSel}[aria-pressed='true']`));
    await guard.guarded(
      page.waitForSelector(`${philSel}[aria-expanded='true']`),
    );
    const backUrl = new URL(page.url());
    check(
      "Back: URL carries ?school= and ?p= again",
      backUrl.searchParams.get("school") === schoolId &&
        backUrl.searchParams.get("p") === philName,
      page.url(),
    );
    check("Back: rows filtered again", (await philRows()) === rowsFiltered);
    await page.goForward();
    await guard.guarded(
      page.waitForSelector(`${philSel}[aria-expanded='false']`),
    );
    check(
      "Forward: filter cleared again",
      (await page.locator(`${CHIP_SEL}[aria-pressed='true']`).count()) === 0,
    );
    check(
      "Forward: URL drops school=/p=",
      !page.url().includes("school=") && !/[?&]p=/.test(page.url()),
      page.url(),
    );
    check("no page reload during Back/Forward", await markerAlive());

    await page.close();
  } finally {
    await browser.close();
  }

  if (failures > 0) {
    console.error(`\n${failures} check(s) FAILED`);
    process.exit(1);
  }
  console.log("\nAll timeline filter/expand reload checks passed.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
