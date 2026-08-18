/// <reference lib="dom" />
// QA check for task 595: Registers heading has no icon before the text,
// in both light and dark themes. Also confirms the Knowledge Graph card
// keeps its own GitCommit icons.
import "./lib/playwright-browsers-path";

// Make this file a module so its top-level `main` doesn't collide with
// ambient/global declarations in the shared scripts tsc program.
export {};

async function main() {
  const { chromium } = await import("playwright-core");
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  await page.goto("http://127.0.0.1:80/", { waitUntil: "networkidle" });

  let failures = 0;
  for (const theme of ["light", "dark"] as const) {
    if (theme === "dark") {
      await page.evaluate(() => document.documentElement.classList.add("dark"));
    }
    const heading = page.locator("h2", { hasText: "Registers" }).first();
    await heading.scrollIntoViewIfNeeded();
    await page.waitForTimeout(1200); // let Reveal animation finish
    const svgCount = await heading.locator("svg").count();
    const text = (await heading.innerText()).trim();
    console.log(`[${theme}] heading text="${text}" svg-in-heading=${svgCount}`);
    if (svgCount !== 0 || !/registers/i.test(text)) failures++;
    await page.screenshot({
      path: `/tmp/task595-registers-${theme}.png`,
      clip: (await heading.boundingBox().then((b) =>
        b ? { x: Math.max(0, b.x - 40), y: Math.max(0, b.y - 40), width: b.width + 400, height: b.height + 200 } : undefined,
      )) as any,
    });
  }
  // positive control: KG card still has GitCommit icons (svg with lucide-git-commit class)
  const kgIcons = await page.locator("svg.lucide-git-commit-horizontal, svg.lucide-git-commit").count();
  console.log(`GitCommit icons elsewhere on page: ${kgIcons}`);
  if (kgIcons < 1) failures++;

  await browser.close();
  if (failures) {
    console.error("FAIL");
    process.exit(1);
  }
  console.log("PASS");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
