/// <reference lib="dom" />
// Touch-path sibling of e2e-home-menus-clickable: the homepage nav has a
// separate code path on touch devices (no hover — the group button's click
// toggles the dropdown; an outside tap / Escape closes it). A touch-only
// regression (toggle branch breaking, or the outside-tap close handler
// swallowing the item tap) would pass the desktop hover check unnoticed.
//
// This drives a touch-emulating context (hasTouch, isMobile, no hover) at a
// 390x844 phone viewport and asserts:
//  1. Every dropdown opens on tap and EVERY submenu item navigates on tap.
//  2. A second tap on the group button closes its dropdown.
//  3. Tapping outside the nav closes an open dropdown.
//  4. Top-level direct links navigate on tap.
//  5. Desktop (1400x900, hover): hovering opens the submenu, moving the mouse
//     away closes it (unchanged behavior).
//
// The expected menu structure is DERIVED from pages/home.tsx NAV_ITEMS at run
// time, so a menu rename or addition fails loudly here instead of being
// silently skipped by a hardcoded list.
//
// Requirements: API server + laertius web workflows running on the shared
// proxy (http://localhost:80) and headless Chromium for playwright-core.

import "./lib/playwright-browsers-path";

const { chromium } = await import("playwright-core");
const { attachPageGuard } = await import("./lib/e2e-page-guard");
const { extractHomeNavItems } = await import("./lib/home-nav-items");

const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:80";

// Derive the expected menus from home.tsx NAV_ITEMS via the shared helper
// (extraction regex, evaluation, and positive controls live in ONE place for
// this check and e2e-home-menus-clickable.mts).
const { dropdownGroups, directLinks, totalItems } = extractHomeNavItems(
  "e2e-home-tap-nav.ts",
);

let failures = 0;
function check(label: string, ok: boolean, detail?: string) {
  if (ok) console.log(`  ok: ${label}`);
  else {
    failures++;
    console.error(`  FAIL: ${label}${detail ? ` (${detail})` : ""}`);
  }
}

const browser = await chromium.launch({ headless: true });
try {
  // ——— Mobile: touch, no hover ———
  console.log("Mobile (390x844, touch, no hover):");
  const mobile = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
  });
  const mp = await mobile.newPage();
  // Fail fast with the failing URL/status instead of an opaque selector
  // timeout when the site itself fails to boot.
  const guard = attachPageGuard(mp);

  // Every submenu item must open on tap and navigate on tap.
  for (const group of dropdownGroups) {
    for (const item of group.sub) {
      await mp.goto(`${BASE_URL}/`, { waitUntil: "domcontentloaded" });
      guard.assertPageLoaded();
      try {
        const btn = mp
          .locator("header nav button", { hasText: group.label })
          .first();
        await guard.guarded(btn.tap({ timeout: 5000 }));
        const link = mp
          .locator(`header nav a[href="${item.href}"]`, {
            hasText: item.label,
          })
          .first();
        await link.waitFor({ state: "visible", timeout: 3000 });
        await link.tap();
        await mp.waitForURL("**" + item.href, { timeout: 5000 });
        check(`tap ${group.label} > ${item.label} -> ${item.href}`, true);
      } catch {
        check(
          `tap ${group.label} > ${item.label} -> ${item.href}`,
          false,
          `now at ${mp.url()}`,
        );
      }
    }
  }

  // Toggle + outside-tap behavior (one representative pass per group toggle).
  await mp.goto(`${BASE_URL}/`, { waitUntil: "domcontentloaded" });
  guard.assertPageLoaded();
  for (const group of dropdownGroups) {
    const btn = mp
      .locator("header nav button", { hasText: group.label })
      .first();
    await btn.tap();
    const panel = mp.locator("header nav div.absolute:visible").first();
    const opened = await panel.isVisible().catch(() => false);
    const linkCount = opened ? await panel.locator("a").count() : 0;
    check(
      `tap "${group.label}" opens submenu with links`,
      opened && linkCount === group.sub.length,
      `links=${linkCount}, expected ${group.sub.length}`,
    );
    await btn.tap();
    const closed = !(await mp
      .locator("header nav div.absolute")
      .first()
      .isVisible()
      .catch(() => false));
    check(`second tap on "${group.label}" closes submenu`, closed);
  }

  // Outside tap closes.
  const firstGroup = dropdownGroups[0];
  await mp
    .locator("header nav button", { hasText: firstGroup.label })
    .first()
    .tap();
  check(
    `reopened '${firstGroup.label}' before outside-tap test`,
    await mp.locator("header nav div.absolute").first().isVisible(),
  );
  await mp.locator("h1").first().tap();
  await mp.waitForTimeout(200);
  check(
    "tap outside the nav closes the submenu",
    !(await mp
      .locator("header nav div.absolute")
      .first()
      .isVisible()
      .catch(() => false)),
  );

  // Top-level direct links (e.g. "Ask") navigate on tap.
  for (const item of directLinks) {
    await mp.goto(`${BASE_URL}/`, { waitUntil: "domcontentloaded" });
    try {
      await mp
        .locator(`header nav a[href="${item.href}"]`, { hasText: item.label })
        .first()
        .tap({ timeout: 5000 });
      await mp.waitForURL("**" + item.href!, { timeout: 5000 });
      check(`tap ${item.label} -> ${item.href}`, true);
    } catch {
      check(`tap ${item.label} -> ${item.href}`, false, `now at ${mp.url()}`);
    }
  }
  await mobile.close();

  // ——— Desktop: hover unchanged ———
  console.log("Desktop (1400x900, hover):");
  const desktop = await browser.newContext({
    viewport: { width: 1400, height: 900 },
  });
  const dp = await desktop.newPage();
  const guardDesktop = attachPageGuard(dp);
  await dp.goto(`${BASE_URL}/`, { waitUntil: "domcontentloaded" });
  guardDesktop.assertPageLoaded();
  for (const group of dropdownGroups) {
    const wrap = dp
      .locator("header nav > div", {
        has: dp.locator("button", { hasText: group.label }),
      })
      .first();
    await wrap.hover();
    const opened = await dp
      .locator("header nav div.absolute")
      .first()
      .isVisible()
      .catch(() => false);
    check(`hover "${group.label}" opens submenu`, opened);
    await dp.mouse.move(700, 600);
    await dp.waitForTimeout(150);
    check(
      `mouse-away closes "${group.label}" submenu`,
      !(await dp
        .locator("header nav div.absolute")
        .first()
        .isVisible()
        .catch(() => false)),
    );
  }
  await desktop.close();
} finally {
  await browser.close();
}

if (failures > 0) {
  console.error(`\n${failures} failure(s)`);
  process.exit(1);
}
console.log(
  `\nAll home tap-nav checks passed (${totalItems} item(s) tap-navigated).`,
);
export {};
