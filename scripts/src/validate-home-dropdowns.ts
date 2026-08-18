/// <reference lib="dom" />
// Companion to validate-home-links.ts: that validator proves every href
// minted in home.tsx targets a real route, but the header dropdown panels
// only MOUNT on hover — a runtime bug in the open/close state handling,
// event wiring, or stacking could leave a dropdown permanently closed (or
// empty) while the static check stays green.
//
// This check drives a real browser: it hovers each top-nav item on / and
// asserts the dropdown opens with exactly the entries the NAV_ITEMS source
// data promises (label + href, in order). The expected entries are parsed
// out of home.tsx itself, then cross-pinned against hard-coded counts so a
// vacuous parse cannot pass silently:
//   The Text: 3 · Textual Genres: 6 · Explorations: 3 · Ask Laertius: 5 · About: 3
// (If NAV_ITEMS legitimately changes, update EXPECTED_COUNTS below.)
//
// Requirements: API server + laertius web workflows running (shared proxy,
// default http://localhost:80) and a Chromium headless shell installed for
// playwright-core — same setup as validate-home-links.ts.
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import "./lib/playwright-browsers-path";

const { chromium } = await import("playwright-core");

const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:80";

const here = path.dirname(fileURLToPath(import.meta.url));
const homeSource = readFileSync(
  path.join(here, "../../artifacts/laertius/src/pages/home.tsx"),
  "utf8",
);

// Pinned per-dropdown entry counts. A NAV_ITEMS refactor that silently
// drops entries fails the parse↔pin cross-check below.
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
// Top-level items are `{ label: "...", ... sub: [ ... ] }` objects; split on
// the top-level `label:` occurrences and collect their sub entries.
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

// ——— Runtime: hover each nav item, assert the dropdown mounts ———
async function runtime() {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({
      viewport: { width: 1400, height: 900 },
    });
    await page.goto(`${BASE_URL}/`, { waitUntil: "networkidle" });
    await page.waitForSelector("header nav", { timeout: 15000 });

    const basePath = await page.evaluate(() => {
      const el = document.querySelector("base");
      return el?.getAttribute("href") ?? "/";
    });
    const prefix = basePath.replace(/\/$/, "");

    for (const item of dropdownItems) {
      console.log(`Runtime: hovering "${item.label}"`);
      const trigger = page
        .locator("header nav > div")
        .filter({ has: page.locator(`:scope > a, :scope > button`) })
        .filter({ hasText: item.label })
        .first();

      // No dropdown should be mounted before we hover this item.
      await page.mouse.move(10, 400); // park away from the nav
      await page.waitForTimeout(150);
      const preOpen = await trigger
        .locator("div a[href]")
        .count()
        .catch(() => -1);
      check(
        `"${item.label}" dropdown is closed before hover`,
        preOpen === 0,
        `found ${preOpen} link(s) already mounted`,
      );

      await trigger.locator(":scope > a, :scope > button").first().hover();

      // evaluateAll doesn't wait; poll until counts match or time out.
      const deadline = Date.now() + 5000;
      let entries: { label: string; href: string }[] = [];
      while (entries.length !== item.sub.length && Date.now() < deadline) {
        await page.waitForTimeout(150);
        entries = await trigger
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
        `"${item.label}" dropdown opens with ${item.sub.length} entries`,
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
          gotEntry ? `rendered "${gotEntry.label}" → ${gotEntry.href}` : "missing",
        );
      }

      // The first entry must actually be hoverable/clickable (not covered
      // by another element) — guards z-index/stacking regressions.
      if (item.sub.length > 0) {
        const clickable = await trigger
          .locator("div a[href]")
          .first()
          .evaluate((a) => {
            const r = a.getBoundingClientRect();
            const el = document.elementFromPoint(
              r.left + r.width / 2,
              r.top + r.height / 2,
            );
            return el === a || a.contains(el) || (el?.contains(a) ?? false);
          })
          .catch(() => false);
        check(
          `"${item.label}" first entry is on top of the stacking order`,
          clickable === true,
        );
      }

      // Leaving the nav item closes the dropdown again.
      await page.mouse.move(10, 400);
      const deadline2 = Date.now() + 3000;
      let after = -1;
      while (Date.now() < deadline2) {
        after = await trigger
          .locator("div a[href]")
          .count()
          .catch(() => -1);
        if (after === 0) break;
        await page.waitForTimeout(100);
      }
      check(`"${item.label}" dropdown closes on mouse leave`, after === 0);
    }

    await page.close();
  } finally {
    await browser.close();
  }
}

await runtime();

if (failures > 0) {
  console.error(`\nvalidate-home-dropdowns: ${failures} check(s) failed`);
  process.exit(1);
}
console.log("\nvalidate-home-dropdowns: all checks passed");
