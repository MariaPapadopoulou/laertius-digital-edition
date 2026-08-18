/* Real-browser check: the comparative-timeline entry list (whose entry
 * badge colors this script used to verify) was REMOVED from the shipped
 * edition by an explicit editorial decision (2026-08-09); the code is
 * preserved in attic/comparative-timeline.tsx. This check asserts the
 * entry list does not leak back onto /timeline: the page renders its own
 * content and no comparative-timeline section exists in the DOM. Needs
 * the api-server and web workflows running plus the headless Chromium
 * shell installed. */
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

  // Positive control: the page really rendered, so absence cannot pass
  // vacuously on a blank page.
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

  await browser.close();
  console.log("All entry-color absence checks passed.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
