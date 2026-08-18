/// <reference lib="dom" />
// Dark-mode visual verification of the merged Legomena pages.
// Applies the `.dark` class (the app defines the palette but ships no toggle yet)
// and captures screenshots of Ask, Graph, Reader (with & without cited
// assertions), and the SPARQL console with a query executed.
// Run: cd scripts && npx tsx src/e2e-legomena-dark.mts
import "./lib/playwright-browsers-path";
const { chromium } = await import("playwright-core");
const { attachPageGuard } = await import("./lib/e2e-page-guard");

const base = "http://localhost:80";
const pages: Array<[string, string, number]> = [
  ["ask", "/legomena", 1600],
  ["graph", "/legomena/graph", 1800],
  ["reader", "/legomena/reader/1.prol.14", 1800],
  ["reader2", "/legomena/reader/6.8.99", 1800],
  ["sparql", "/legomena/sparql", 1400],
];

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });

for (const [name, path, height] of pages) {
  const page = await ctx.newPage();
  // Fail fast with the failing URL/status instead of an opaque timeout when
  // the site itself fails to boot (500 on a module/CSS, page error, etc.).
  const guard = attachPageGuard(page);
  await page.goto(base + path, { waitUntil: "networkidle" });
  guard.assertPageLoaded();
  await page.evaluate(() => document.documentElement.classList.add("dark"));
  await page.waitForTimeout(2500);
  if (name === "sparql") {
    const btn = page.locator("button", { hasText: /run/i }).first();
    if (await btn.count()) {
      await btn.evaluate((el) => (el as HTMLElement).click());
      await page.waitForTimeout(3000);
    }
  }
  await page.setViewportSize({ width: 1280, height });
  await page.waitForTimeout(500);
  const outDir = new URL("../../docs/verification/dark-legomena", import.meta.url).pathname;
  await page.screenshot({ path: `${outDir}/dark-${name}.png` });
  await page.close();
  console.log("done", name);
}
await browser.close();
