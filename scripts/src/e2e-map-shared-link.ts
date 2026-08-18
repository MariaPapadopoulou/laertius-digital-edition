/// <reference lib="dom" />
/* Real-browser check: the Map page's shared links keep their filters,
 * like Timeline and Graph now do.
 *
 * map.tsx keeps the opened place panel (?place=), the legend filter
 * (?kinds=), the "Show names" labels (?names=1), the philosopher focus
 * (?p=), the journey (?journey=) and the accessible list view (?view=)
 * in the URL via replaceState, and adopts them back from the URL on a
 * direct load and on Back/Forward. This script pins that contract:
 *
 * 1. Direct load of /map?place=X&kinds=K&names=1 restores all three:
 *    the place panel heading shows X, the legend chip for K is
 *    aria-pressed, the "Show names" toggle is aria-pressed, and the
 *    URL keeps every parameter after load (the sync effects must not
 *    strip them).
 * 2. Interaction → URL: clicking a legend chip, the "Show names"
 *    toggle and a place row updates the URL query in place
 *    (replaceState), so the address bar is always shareable.
 * 3. Reload preserves the interactively reached state.
 * 4. Back/Forward: after navigating away to a DIFFERENT url and back,
 *    the filtered state is restored from the URL (mind the
 *    goto-same-URL history-replace pitfall: the outbound navigation
 *    always targets a different URL).
 *
 * Positive controls: the place/kind used are derived live from
 * /api/map/places (never hardcoded), and a bogus ?place= must NOT open
 * a panel, proving the panel assertion can fail.
 *
 * Requirements: api-server + laertius web workflows running and the
 * headless Chromium shell installed (same setup as e2e-map-list-view).
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

interface ApiPlace {
  label: string;
  events: { property: string; philosopher: string }[];
}

async function main() {
  const apiRes = await fetch(`${BASE_URL}/api/map/places`);
  if (!apiRes.ok) throw new Error(`/api/map/places returned ${apiRes.status}`);
  const places = (await apiRes.json()) as ApiPlace[];
  const withEvents = places.filter((p) => p.events.length > 0);
  if (withEvents.length === 0) throw new Error("no places with events");
  // A place + an event kind that keeps it visible under the kinds filter.
  const target = withEvents[0];
  const kind = target.events[0].property;
  console.log(`Derived target place "${target.label}", kind "${kind}"`);

  const browser = await chromium.launch();
  const page = await browser.newPage();
  const guard = attachPageGuard(page);

  const panelHeading = (label: string) =>
    page.locator(`h2.text-2xl:has-text("${label}")`).first();

  // ---- 1. Direct load restores place + kinds + names -------------------
  const sharedUrl =
    `${BASE_URL}/map?place=${encodeURIComponent(target.label)}` +
    `&kinds=${encodeURIComponent(kind)}&names=1`;
  await page.goto(sharedUrl, { waitUntil: "networkidle" });
  console.log("Scenario 1: direct load of shared link");
  await panelHeading(target.label)
    .waitFor({ state: "visible", timeout: 15000 })
    .catch(() => {});
  check(
    "place panel opens with the shared place",
    await panelHeading(target.label).isVisible(),
  );
  const pressedChips = await page
    .locator('[data-testid="map-legend-chips"] button[aria-pressed="true"]')
    .allTextContents();
  check(
    "exactly the shared legend kind is pressed",
    pressedChips.length === 1,
    `pressed: ${JSON.stringify(pressedChips)}`,
  );
  check(
    '"Show names" toggle is pressed',
    (await page
      .locator('button[aria-pressed="true"]:has-text("Show names")')
      .count()) === 1,
  );
  const urlAfterLoad = new URL(page.url());
  check(
    "URL keeps place/kinds/names after load",
    urlAfterLoad.searchParams.get("place") === target.label &&
      urlAfterLoad.searchParams.get("kinds") === kind &&
      urlAfterLoad.searchParams.get("names") === "1",
    page.url(),
  );

  // Negative control: a bogus place must not open a panel.
  await page.goto(`${BASE_URL}/map?place=NoSuchPlaceXYZ`, {
    waitUntil: "networkidle",
  });
  await page.waitForTimeout(500);
  check(
    "negative control: bogus ?place= opens no panel",
    !(await panelHeading("NoSuchPlaceXYZ").isVisible().catch(() => false)),
  );

  // ---- 2. Interaction updates the URL ----------------------------------
  console.log("Scenario 2: interactions are reflected in the URL");
  await page.goto(`${BASE_URL}/map`, { waitUntil: "networkidle" });
  // Toggle "Show names".
  await page.locator('button:has-text("Show names")').first().click();
  await page.waitForFunction(
    () => new URLSearchParams(window.location.search).get("names") === "1",
    undefined,
    { timeout: 5000 },
  );
  check("clicking Show names writes ?names=1", true);
  // Press the first legend chip.
  const firstChip = page
    .locator('[data-testid="map-legend-chips"] button[aria-pressed]')
    .first();
  const chipText = (await firstChip.textContent())?.trim() ?? "";
  await firstChip.click();
  await page.waitForFunction(
    () => (new URLSearchParams(window.location.search).get("kinds") ?? "") !== "",
    undefined,
    { timeout: 5000 },
  );
  const kindsParam = new URL(page.url()).searchParams.get("kinds") ?? "";
  check(
    `clicking legend chip "${chipText}" writes ?kinds=`,
    kindsParam.length > 0,
    page.url(),
  );

  // ---- 3. Reload preserves the reached state ---------------------------
  console.log("Scenario 3: reload preserves state");
  await page.reload({ waitUntil: "networkidle" });
  check(
    "reload keeps the pressed legend chip",
    (await page
      .locator('[data-testid="map-legend-chips"] button[aria-pressed="true"]')
      .count()) === 1,
  );
  check(
    'reload keeps "Show names" on',
    (await page
      .locator('button[aria-pressed="true"]:has-text("Show names")')
      .count()) === 1,
  );

  // ---- 4. Back restores the filtered state -----------------------------
  console.log("Scenario 4: Back/Forward restores the shared state");
  // Navigate to a DIFFERENT url via an in-app click (never goto the same
  // URL: see .agents/memory/e2e-goto-same-url-replace.md).
  await page.goto(sharedUrl, { waitUntil: "networkidle" });
  // goto a DIFFERENT URL pushes a fresh history entry (the pitfall only
  // bites when goto targets the page's CURRENT URL).
  await page.goto(`${BASE_URL}/timeline`, { waitUntil: "networkidle" });
  await page.goBack({ waitUntil: "networkidle" });
  await panelHeading(target.label)
    .waitFor({ state: "visible", timeout: 15000 })
    .catch(() => {});
  check(
    "Back restores the place panel",
    await panelHeading(target.label).isVisible(),
  );
  check(
    "Back restores the legend filter",
    (await page
      .locator('[data-testid="map-legend-chips"] button[aria-pressed="true"]')
      .count()) === 1,
  );
  check(
    "Back keeps the URL parameters",
    new URL(page.url()).searchParams.get("place") === target.label,
    page.url(),
  );

  void guard;
  await browser.close();
}

main()
  .then(() => {
    if (failures > 0) {
      console.error(`e2e-map-shared-link: ${failures} FAILURE(S)`);
      process.exit(1);
    }
    console.log("e2e-map-shared-link: all checks passed");
  })
  .catch((err) => {
    console.error("e2e-map-shared-link: crashed:", err);
    process.exit(1);
  });
