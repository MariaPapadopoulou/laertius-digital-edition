/**
 * e2e-table-sort — registered validation gate: sortable list-view tables on
 * /timeline, /graph, /map (shared component
 * artifacts/laertius/src/components/sortable-table.tsx). Asserts aria-sort
 * transitions (none -> ascending -> descending), keyboard Enter operability,
 * and that the row order actually changes.
 * Run: pnpm --filter @workspace/scripts run e2e-table-sort
 */
import "./lib/playwright-browsers-path";
const { chromium } = await import("playwright-core");
import { attachPageGuard } from "./lib/e2e-page-guard";

const browser = await chromium.launch({ channel: "chromium-headless-shell" });
const page = await browser.newPage();
// Fail fast with the failing URL/status instead of an opaque selector
// timeout when the site itself fails to boot (500 on a module/CSS, etc.).
const guard = attachPageGuard(page);
let fail = 0;
const check = (c: boolean, m: string) => { if (!c) { fail++; console.error("FAIL: " + m); } else console.log("ok: " + m); };

// Timeline
await page.goto("http://localhost:80/timeline", { waitUntil: "networkidle" });
guard.assertPageLoaded();
await page.getByTestId("timeline-view-list").click();
await guard.guarded(page.waitForSelector('[data-testid="timeline-list-table"]'));
const bornTh = page.locator('[data-testid="sort-timeline-born"]');
check(await page.locator('th[aria-sort]').count() >= 6, "timeline headers expose aria-sort");
await bornTh.click();
check(await bornTh.locator("xpath=ancestor::th").getAttribute("aria-sort") === "ascending", "timeline Born aria-sort=ascending after click");
check(((await bornTh.locator(".sr-only").textContent()) ?? "").includes("sorted ascending"), "timeline Born sr-only text announces sorted ascending");
const firstBornAsc = await page.locator('[data-testid="timeline-list-table"] tbody tr').first().innerText();
await bornTh.click();
check(await bornTh.locator("xpath=ancestor::th").getAttribute("aria-sort") === "descending", "timeline Born aria-sort=descending after second click");
const firstBornDesc = await page.locator('[data-testid="timeline-list-table"] tbody tr').first().innerText();
check(firstBornAsc !== firstBornDesc, "timeline order changes between asc and desc");

// Keyboard: focus + Enter on School header
await page.locator('[data-testid="sort-timeline-school"]').focus();
await page.keyboard.press("Enter");
check(await page.locator('[data-testid="sort-timeline-school"]').locator("xpath=ancestor::th").getAttribute("aria-sort") === "ascending", "timeline School sorts via keyboard Enter");

// Graph list view
await page.goto("http://localhost:80/graph", { waitUntil: "networkidle" });
guard.assertPageLoaded();
await page.getByTestId("graph-view-list").click();
await guard.guarded(page.waitForSelector('[data-testid="graph-list-view"]'));
const relTh = page.locator('[data-testid^="sort-phil-relations-"]').first();
await relTh.click();
check(await relTh.locator("xpath=ancestor::th").getAttribute("aria-sort") === "ascending", "graph Relations sorts ascending");
await relTh.click();
const firstTable = page.locator('[data-testid="graph-list-view"] table').first();
const nums = await firstTable.locator("tbody tr td:nth-child(4)").allInnerTexts();
const parsed = nums.map((n) => parseInt(n, 10)).filter((n) => !isNaN(n));
const sortedDesc = [...parsed].sort((a, b) => b - a);
check(JSON.stringify(parsed) === JSON.stringify(sortedDesc), "graph relations column actually descending: " + parsed.slice(0,5).join(","));

// Map list view
await page.goto("http://localhost:80/map?view=list", { waitUntil: "networkidle" });
guard.assertPageLoaded();
// The primary gate has a deliberate .catch() fallback (click the list toggle),
// so it must not be guarded; guard only the fallback's readiness wait.
await page.waitForSelector('[data-testid="map-list-view"]', { timeout: 15000 }).catch(async () => {
  await page.getByTestId("map-view-list").click();
  await guard.guarded(page.waitForSelector('[data-testid="map-list-view"]'));
});
const menTh = page.locator('[data-testid="sort-place-mentions"]');
await menTh.click();
await menTh.click();
const mtexts = await page.locator('[data-testid="map-list-view"] table tbody tr td:nth-child(4)').allInnerTexts();
const mvals = mtexts.map((t) => (t.trim() === "-" ? -1 : parseInt(t, 10)));
const mfirst = mvals.slice(0, 10);
check(JSON.stringify(mfirst) === JSON.stringify([...mfirst].sort((a, b) => b - a)), "map mentions descending: " + mfirst.join(","));

await browser.close();
if (fail > 0) { console.error(`${fail} failure(s)`); process.exit(1); }
console.log("e2e-table-sort-check: OK");
