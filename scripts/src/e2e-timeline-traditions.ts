/* Real-browser check: the "Global Timeline of Philosophical Biodoxography"
 * comparative-timeline section was REMOVED from the shipped edition by an
 * explicit editorial decision (2026-08-09); the component code is preserved
 * in attic/comparative-timeline.tsx. This check asserts the section does
 * not leak back onto /timeline: the page loads, the main timeline content
 * renders, and no [data-testid='comparative-timeline'] section (nor any
 * tradition-filter chip) exists in the DOM. Needs the api-server and web
 * workflows running plus the headless Chromium shell installed. */
import "./lib/playwright-browsers-path";
const { chromium } = await import("playwright-core");
import { attachPageGuard } from "./lib/e2e-page-guard";

const BASE = process.env.E2E_BASE_URL ?? "http://localhost:80";

async function main() {
  const browser = await chromium.launch({ channel: "chromium-headless-shell" });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const guard = attachPageGuard(page);
  await page.goto(`${BASE}/timeline`, { waitUntil: "networkidle" });
  guard.assertPageLoaded();

  // Positive control: the page really rendered its own timeline content,
  // so the absence checks below cannot pass vacuously on a blank page.
  const h1 = await page.locator("h1").first().innerText();
  if (!h1.trim()) throw new Error("timeline page rendered no h1");
  console.log(`Timeline page rendered (h1: "${h1.trim()}"): OK`);

  const sectionCount = await page
    .locator("[data-testid='comparative-timeline']")
    .count();
  if (sectionCount !== 0)
    throw new Error(
      `comparative-timeline section leaked back (${sectionCount} found)`,
    );
  console.log("No comparative-timeline section in the DOM: OK");

  const chipCount = await page
    .locator("[data-testid^='tradition-filter-']")
    .count();
  if (chipCount !== 0)
    throw new Error(`tradition filter chips leaked back (${chipCount} found)`);
  console.log("No tradition-filter chips in the DOM: OK");

  await browser.close();
  console.log("All comparative-timeline absence checks passed.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
