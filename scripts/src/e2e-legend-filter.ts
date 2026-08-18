/* Real-browser check: the legend movement chips on /graph toggle a
 * filter that dims non-matching nodes and edges. Covers single toggle,
 * multi-select, re-click to clear, "show all", satellite associates,
 * and composition with node selection. Needs the api-server and web
 * workflows running plus the headless Chromium shell installed (same
 * setup as e2e-nav-reset). */
import "./lib/playwright-browsers-path";
const { chromium } = await import("playwright-core");
import { attachPageGuard } from "./lib/e2e-page-guard";

const BASE = process.env.E2E_BASE_URL ?? "http://localhost:80";

async function main() {
  const browser = await chromium.launch({ channel: "chromium-headless-shell" });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  // Fail fast with the failing URL/status instead of an opaque selector
  // timeout when the site itself fails to boot.
  const guard = attachPageGuard(page);
  await page.goto(`${BASE}/graph`, { waitUntil: "networkidle" });
  guard.assertPageLoaded();
  await guard.guarded(page.waitForSelector("svg[role='img'] g.cursor-pointer"));

  const opacityOf = async (name: string) =>
    page
      .locator(`svg[role='img'] g.cursor-pointer:has(text:text-is("${name}"))`)
      .first()
      .getAttribute("opacity");

  // Baseline: everyone fully visible.
  if ((await opacityOf("Plato")) !== "1") throw new Error("baseline Plato not 1");
  if ((await opacityOf("Epicurus")) !== "1") throw new Error("baseline Epicurus not 1");

  // Legend chips render "<label> <greek-name>" (e.g. "Stoa Στοά"), so match
  // them via the stable title attribute instead of the accessible name.
  const chip = (label: string) => page.locator(`button[title="Toggle ${label}"]`);

  // Click the Epicurean (Garden) chip.
  await chip("Epicurean (Garden)").click();
  if ((await opacityOf("Plato")) === "1") throw new Error("Plato should dim under Garden filter");
  if ((await opacityOf("Epicurus")) !== "1") throw new Error("Epicurus must stay visible");
  if ((await opacityOf("Metrodorus")) !== "1")
    throw new Error("satellite Metrodorus must stay visible");
  console.log("Garden filter dims non-Garden nodes, keeps satellites: OK");

  // Stoa satellites (Persaeus + Hippobotus pupils) dim while only the
  // Garden filter is on...
  if ((await opacityOf("Persaeus")) === "1")
    throw new Error("Stoa satellite Persaeus should dim under Garden filter");

  // Add a second movement: multi-select.
  await chip("Stoa").click();
  if ((await opacityOf("Zeno of Citium")) !== "1") throw new Error("Stoa should join the filter");
  if ((await opacityOf("Plato")) === "1") throw new Error("Plato still outside filter");
  // ...and come back once Stoa joins the filter.
  if ((await opacityOf("Persaeus")) !== "1")
    throw new Error("Stoa satellite Persaeus must stay visible under Stoa filter");
  if ((await opacityOf("Philonides of Thebes")) !== "1")
    throw new Error("Stoa satellite Philonides of Thebes must stay visible under Stoa filter");
  console.log("Multi-select (Garden + Stoa), Stoa satellites toggle: OK");

  // "show all" clears the filter.
  await page.getByRole("button", { name: "show all" }).click();
  if ((await opacityOf("Plato")) !== "1") throw new Error("show all should restore Plato");
  console.log("show all clears the filter: OK");

  // Toggling a chip off by re-click also works.
  await chip("Cynic").click();
  if ((await opacityOf("Plato")) === "1") throw new Error("Cynic filter should dim Plato");
  await chip("Cynic").click();
  if ((await opacityOf("Plato")) !== "1") throw new Error("re-click should clear the filter");
  console.log("Chip re-click toggles off: OK");

  // Filter + selection compose: select Epicurus while Garden filter is on.
  await chip("Epicurean (Garden)").click();
  await page
    .locator(`svg[role='img'] g.cursor-pointer:has(text:text-is("Epicurus"))`)
    .first()
    .click();
  if ((await opacityOf("Epicurus")) !== "1") throw new Error("selected Epicurus visible");
  console.log("Filter composes with node selection: OK");

  await browser.close();
  console.log("All legend-filter checks passed.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
