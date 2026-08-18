/// <reference lib="dom" />
// Real-browser check that every homepage nav menu opens on click and every
// dropdown item navigates. A past regression made the group button's onClick
// toggle the dropdown closed (hover had already opened it), so every item
// silently became unreachable by mouse — this catches that class of bug.
//
// The expected menu structure is DERIVED from pages/home.tsx NAV_ITEMS at
// run time, so a menu rename or addition fails loudly here instead of being
// silently skipped by a hardcoded list.
//
// Requirements: the web workflow must be serving through the shared proxy
// (default http://localhost:80) and a Chromium headless shell must be
// installed for playwright-core.

// playwright-core resolves its browser registry at module import time from
// PLAYWRIGHT_BROWSERS_PATH; set it BEFORE the dynamic import (see
// e2e-nav-reset.ts for the rationale).
import "./lib/playwright-browsers-path";

const { chromium } = await import("playwright-core");
const { attachPageGuard } = await import("./lib/e2e-page-guard");
const { extractHomeNavItems } = await import("./lib/home-nav-items");

const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:80";

// Derive the expected menus from home.tsx NAV_ITEMS via the shared helper
// (extraction regex, evaluation, and positive controls live in ONE place for
// this check and e2e-home-tap-nav.ts).
const { dropdownGroups, directLinks, totalItems } = extractHomeNavItems(
  "e2e-home-menus-clickable.mts",
);

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
// Fail fast with the failing URL/status instead of an opaque selector
// timeout when the site itself fails to boot (500 on a module/CSS,
// uncaught page error, etc.).
const guard = attachPageGuard(page);
let failures = 0;

for (const group of dropdownGroups) {
  for (const item of group.sub) {
    await page.goto(`${BASE_URL}/`, { waitUntil: "domcontentloaded" });
    guard.assertPageLoaded();
    try {
      const trigger = page
        .locator("nav button", { hasText: group.label })
        .first();
      // A real mouse click (which also hovers first, as a reader's mouse
      // does) must leave the dropdown OPEN — the original regression was a
      // toggle handler closing the hover-opened menu.
      await trigger.click({ timeout: 5000 });
      const link = page
        .locator(`nav a[href="${item.href}"]`, { hasText: item.label })
        .first();
      await guard.guarded(link.waitFor({ state: "visible", timeout: 3000 }));
      await link.click();
      await page.waitForURL("**" + item.href, { timeout: 5000 });
      console.log(`ok: ${group.label} > ${item.label} -> ${item.href}`);
    } catch {
      failures++;
      console.error(
        `FAIL: ${group.label} > ${item.label} (expected ${item.href}) now at ${page.url()}`,
      );
    }
  }
}

// Top-level direct links (e.g. "Ask") render as plain <a>, not dropdowns.
for (const item of directLinks) {
  await page.goto(`${BASE_URL}/`, { waitUntil: "domcontentloaded" });
  guard.assertPageLoaded();
  try {
    await page
      .locator(`nav a[href="${item.href}"]`, { hasText: item.label })
      .first()
      .click({ timeout: 5000 });
    await page.waitForURL("**" + item.href!, { timeout: 5000 });
    console.log(`ok: ${item.label} -> ${item.href}`);
  } catch {
    failures++;
    console.error(
      `FAIL: ${item.label} (expected ${item.href}) now at ${page.url()}`,
    );
  }
}

await browser.close();
if (failures > 0) {
  console.error(`${failures} homepage menu item(s) not clickable`);
  process.exit(1);
}
console.log(`All ${totalItems} homepage menu items clickable.`);
