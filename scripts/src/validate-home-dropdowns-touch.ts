/// <reference lib="dom" />
// Companion to validate-home-dropdowns.ts (hover) and
// validate-home-dropdowns-keyboard.ts (focus/Tab): the third input path is
// touch. On touch devices home.tsx gates hover/focus opening behind
// canHover() and relies entirely on the button's click toggle — tap opens,
// a second tap closes, and a tap outside the nav closes (pointerdown
// listener). A regression in that branch would lock touch users out of
// every submenu while the hover and keyboard checks stay green.
//
// This check emulates a touch device (hasTouch, no `hover: hover`) on /:
//   1. taps each dropdown-bearing nav button and asserts the panel mounts
//      with exactly the entries NAV_ITEMS promises (label + href, in order);
//   2. taps the button again and asserts the panel unmounts (toggle close);
//   3. re-opens, taps outside the nav, and asserts the panel unmounts.
//
// Expected entries are parsed out of home.tsx and cross-pinned against
// hard-coded counts, same as the two companion checks.
//
// Requirements: API server + laertius web workflows running (shared proxy,
// default http://localhost:80) and a Chromium headless shell installed for
// playwright-core.
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import "./lib/playwright-browsers-path";

const { chromium, devices } = await import("playwright-core");

const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:80";

const here = path.dirname(fileURLToPath(import.meta.url));
const homeSource = readFileSync(
  path.join(here, "../../artifacts/laertius/src/pages/home.tsx"),
  "utf8",
);

// Pinned per-dropdown entry counts (keep in sync with
// validate-home-dropdowns.ts / validate-home-dropdowns-keyboard.ts). A
// NAV_ITEMS refactor that silently drops entries fails the parse↔pin
// cross-check below.
const EXPECTED_COUNTS: Record<string, number> = {
  "The Text": 3,
  "Textual Genres": 6,
  Explorations: 3,
  "Ask Laertius": 5,
  About: 3,
};

let failures = 0;
function check(label: string, ok: boolean, detail?: string) {
  if (ok) {
    console.log(`  ok: ${label}`);
  } else {
    failures++;
    console.error(`  FAIL: ${label}${detail ? ` (${detail})` : ""}`);
  }
}

// ——— Parse NAV_ITEMS out of home.tsx ———
const navBlockMatch = homeSource.match(
  /const NAV_ITEMS[^=]*=\s*\[([\s\S]*?)\n\];/,
);
if (!navBlockMatch) {
  console.error("FAIL: could not locate the NAV_ITEMS array in home.tsx");
  process.exit(1);
}
type NavItem = { label: string; sub: { label: string; href: string }[] };
const navItems: NavItem[] = [];
const itemRe =
  /label:\s*"([^"]+)"(?:\s*,\s*href:\s*"[^"]*")?\s*,\s*sub:\s*\[([\s\S]*?)\]/g;
for (const m of navBlockMatch[1].matchAll(itemRe)) {
  const sub: { label: string; href: string }[] = [];
  for (const s of m[2].matchAll(/label:\s*"([^"]+)"\s*,\s*href:\s*"([^"]+)"/g)) {
    sub.push({ label: s[1], href: s[2] });
  }
  navItems.push({ label: m[1], sub });
}
const dropdownItems = navItems.filter((i) => i.sub.length > 0);

console.log("Static: NAV_ITEMS parse vs pinned dropdown counts");
check(
  "parsed at least 4 dropdown-bearing nav items from home.tsx",
  dropdownItems.length >= 4,
  `parsed: ${dropdownItems.map((i) => i.label).join(", ")}`,
);
for (const [label, count] of Object.entries(EXPECTED_COUNTS)) {
  const item = dropdownItems.find((i) => i.label === label);
  check(
    `NAV_ITEMS "${label}" has exactly ${count} entries`,
    item !== undefined && item.sub.length === count,
    item ? `found ${item.sub.length}` : "nav item missing",
  );
}
for (const item of dropdownItems) {
  check(
    `dropdown "${item.label}" is covered by a pinned count`,
    item.label in EXPECTED_COUNTS,
    "add it to EXPECTED_COUNTS",
  );
}

// ——— Runtime: tap each nav button on an emulated touch device ———
async function runtime() {
  const browser = await chromium.launch({ headless: true });
  try {
    // Emulate a touch device: touch events on, no hover-capable pointer.
    // A wide viewport keeps the desktop nav layout (the check targets the
    // header nav buttons, not any mobile collapse), matching e.g. a tablet.
    const context = await browser.newContext({
      viewport: { width: 1400, height: 900 },
      hasTouch: true,
      isMobile: true,
      userAgent: devices["iPad Pro 11"].userAgent,
    });
    const page = await context.newPage();
    await page.goto(`${BASE_URL}/`, { waitUntil: "networkidle" });
    await page.waitForSelector("header nav", { timeout: 15000 });

    // Precondition: the emulated device must NOT report hover: hover,
    // otherwise home.tsx takes the hover branch and this check would pass
    // vacuously without ever exercising the touch toggle.
    const hoverCapable = await page.evaluate(() =>
      window.matchMedia("(hover: hover)").matches,
    );
    check(
      "emulated device reports NO (hover: hover) — precondition for the touch path",
      !hoverCapable,
      "touch emulation broken; the click-toggle branch is not being exercised",
    );

    const basePath = await page.evaluate(() => {
      const el = document.querySelector("base");
      return el?.getAttribute("href") ?? "/";
    });
    const prefix = basePath.replace(/\/$/, "");

    for (const item of dropdownItems) {
      console.log(`Runtime: tapping "${item.label}"`);
      const container = page
        .locator("header nav > div")
        .filter({ has: page.locator(":scope > button") })
        .filter({ hasText: item.label })
        .first();
      const trigger = container.locator(":scope > button").first();

      // Clean slate: nothing open before we tap this item.
      await page.waitForTimeout(150);
      const preOpen = await container.locator("div a[href]").count();
      check(
        `"${item.label}" dropdown is closed before the tap`,
        preOpen === 0,
        `found ${preOpen} link(s) already mounted`,
      );

      // 1. Tap opens the panel with all promised entries.
      await trigger.tap();
      const deadline = Date.now() + 5000;
      let entries: { label: string; href: string }[] = [];
      while (entries.length !== item.sub.length && Date.now() < deadline) {
        await page.waitForTimeout(100);
        entries = await container
          .locator("div a[href]")
          .evaluateAll((els) =>
            els.map((a) => ({
              label: (a.textContent ?? "").trim(),
              href: a.getAttribute("href") ?? "",
            })),
          )
          .catch(() => []);
      }
      check(
        `tap opens "${item.label}" with ${item.sub.length} entries`,
        entries.length === item.sub.length,
        `rendered ${entries.length}: ${entries.map((e) => e.label).join(", ") || "(none)"}`,
      );
      for (let i = 0; i < item.sub.length; i++) {
        const want = item.sub[i];
        const gotEntry = entries[i];
        const hrefOk =
          gotEntry !== undefined &&
          (gotEntry.href === want.href ||
            gotEntry.href === `${prefix}${want.href}`);
        check(
          `"${item.label}" entry ${i + 1} is "${want.label}" → ${want.href}`,
          gotEntry !== undefined && gotEntry.label === want.label && hrefOk,
          gotEntry
            ? `rendered "${gotEntry.label}" → ${gotEntry.href}`
            : "missing",
        );
      }

      // aria-expanded must reflect the open state for AT users on touch too.
      const expanded = await trigger.getAttribute("aria-expanded");
      check(
        `"${item.label}" trigger reports aria-expanded="true" while open`,
        expanded === "true",
        `got ${JSON.stringify(expanded)}`,
      );

      // 2. A second tap on the SAME button closes the panel (toggle).
      await trigger.tap();
      let after = -1;
      const deadline2 = Date.now() + 3000;
      while (Date.now() < deadline2) {
        after = await container
          .locator("div a[href]")
          .count()
          .catch(() => -1);
        if (after === 0) break;
        await page.waitForTimeout(100);
      }
      check(`second tap closes "${item.label}"`, after === 0);

      // 3. Re-open, then tap OUTSIDE the nav: the document pointerdown
      // listener must close the panel.
      await trigger.tap();
      const deadline3 = Date.now() + 3000;
      let reopened = -1;
      while (Date.now() < deadline3) {
        reopened = await container
          .locator("div a[href]")
          .count()
          .catch(() => -1);
        if (reopened === item.sub.length) break;
        await page.waitForTimeout(100);
      }
      check(
        `"${item.label}" re-opens for the tap-outside probe`,
        reopened === item.sub.length,
        `rendered ${reopened}`,
      );

      // Tap the main content area, well below the header.
      await page.touchscreen.tap(700, 600);
      let afterOutside = -1;
      const deadline4 = Date.now() + 3000;
      while (Date.now() < deadline4) {
        afterOutside = await container
          .locator("div a[href]")
          .count()
          .catch(() => -1);
        if (afterOutside === 0) break;
        await page.waitForTimeout(100);
      }
      check(`tap outside the nav closes "${item.label}"`, afterOutside === 0);
    }

    await page.close();
    await context.close();
  } finally {
    await browser.close();
  }
}

await runtime();

if (failures > 0) {
  console.error(`\nvalidate-home-dropdowns-touch: ${failures} check(s) failed`);
  process.exit(1);
}
console.log("\nvalidate-home-dropdowns-touch: all checks passed");
