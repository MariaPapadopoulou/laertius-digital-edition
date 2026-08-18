/// <reference lib="dom" />
// Companion to validate-home-dropdowns.ts: that check proves each homepage
// header dropdown opens on mouse hover with the right entries. But home.tsx
// also wires onFocus on the nav buttons so keyboard users can open the menus
// by tabbing — this check covers that path. A regression there would silently
// lock keyboard users out of the dropdowns while the hover check stays green.
//
// For each dropdown-bearing nav item on /:
//   1. move keyboard focus to its trigger button and assert the panel mounts
//      with the entry count NAV_ITEMS promises;
//   2. press Tab and assert focus lands on the FIRST entry inside the panel
//      (so the entries are actually reachable by keyboard, not just mounted);
//   3. press Tab again and assert the second entry receives focus (list is
//      traversable, not a focus trap of one);
//   4. press Escape and assert the panel unmounts.
//
// Expected entries are parsed out of home.tsx and cross-pinned against
// hard-coded counts, same as validate-home-dropdowns.ts.
//
// Requirements: API server + laertius web workflows running (shared proxy,
// default http://localhost:80) and a Chromium headless shell installed for
// playwright-core.
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

// Pinned per-dropdown entry counts (keep in sync with
// validate-home-dropdowns.ts). A NAV_ITEMS refactor that silently drops
// entries fails the parse↔pin cross-check below.
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

// The keyboard path in home.tsx only opens the menu when the device is
// hover-capable (canHover()); assert headless Chromium reports hover: hover
// so a false pass/fail from an emulation change is caught loudly.

// ——— Runtime: focus each nav button, Tab into the panel ———
async function runtime() {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({
      viewport: { width: 1400, height: 900 },
    });
    await page.goto(`${BASE_URL}/`, { waitUntil: "networkidle" });
    await page.waitForSelector("header nav", { timeout: 15000 });

    const hoverCapable = await page.evaluate(() =>
      window.matchMedia("(hover: hover)").matches,
    );
    check(
      "browser reports (hover: hover) — precondition for the onFocus path",
      hoverCapable,
      "home.tsx gates focus-open on canHover(); emulation changed?",
    );

    const activeInfo = () =>
      page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null;
        return {
          tag: el?.tagName ?? "",
          text: (el?.textContent ?? "").trim(),
          href: el?.getAttribute("href") ?? "",
        };
      });

    for (const item of dropdownItems) {
      console.log(`Runtime: keyboard-focusing "${item.label}"`);
      const container = page
        .locator("header nav > div")
        .filter({ has: page.locator(":scope > button") })
        .filter({ hasText: item.label })
        .first();
      const trigger = container.locator(":scope > button").first();

      // Ensure a clean slate: nothing focused in the nav, panel closed.
      await page.keyboard.press("Escape");
      await page.evaluate(() => (document.activeElement as HTMLElement)?.blur());
      await page.waitForTimeout(150);
      const preOpen = await container.locator("div a[href]").count();
      check(
        `"${item.label}" dropdown is closed before focus`,
        preOpen === 0,
        `found ${preOpen} link(s) already mounted`,
      );

      // Move keyboard focus onto the trigger. locator.focus() dispatches a
      // real focus event, which is exactly the handler under test; the Tab
      // presses below then prove keyboard traversal INTO the panel.
      await trigger.focus();

      // Panel should mount with all promised entries.
      const deadline = Date.now() + 5000;
      let entryCount = -1;
      while (entryCount !== item.sub.length && Date.now() < deadline) {
        await page.waitForTimeout(100);
        entryCount = await container
          .locator("div a[href]")
          .count()
          .catch(() => -1);
      }
      check(
        `"${item.label}" dropdown opens on focus with ${item.sub.length} entries`,
        entryCount === item.sub.length,
        `rendered ${entryCount}`,
      );

      // aria-expanded must reflect the open state for AT users.
      const expanded = await trigger.getAttribute("aria-expanded");
      check(
        `"${item.label}" trigger reports aria-expanded="true" while open`,
        expanded === "true",
        `got ${JSON.stringify(expanded)}`,
      );

      // Tab must land on the FIRST entry inside the panel…
      await page.keyboard.press("Tab");
      let active = await activeInfo();
      const first = item.sub[0];
      check(
        `Tab from "${item.label}" reaches entry "${first.label}"`,
        active.tag === "A" &&
          active.text === first.label &&
          active.href.endsWith(first.href),
        `focus on <${active.tag.toLowerCase()}> "${active.text}" → ${active.href}`,
      );
      // …and the panel must stay open when focus moves off the trigger.
      const stillOpen = await container.locator("div a[href]").count();
      check(
        `"${item.label}" dropdown stays open while tabbing inside`,
        stillOpen === item.sub.length,
        `now ${stillOpen} entries mounted`,
      );

      // A second Tab reaches the second entry (list is traversable).
      if (item.sub.length > 1) {
        await page.keyboard.press("Tab");
        active = await activeInfo();
        const second = item.sub[1];
        check(
          `second Tab reaches entry "${second.label}"`,
          active.tag === "A" &&
            active.text === second.label &&
            active.href.endsWith(second.href),
          `focus on <${active.tag.toLowerCase()}> "${active.text}" → ${active.href}`,
        );
      }

      // Escape closes the panel again.
      await page.keyboard.press("Escape");
      const deadline2 = Date.now() + 3000;
      let after = -1;
      while (Date.now() < deadline2) {
        after = await container
          .locator("div a[href]")
          .count()
          .catch(() => -1);
        if (after === 0) break;
        await page.waitForTimeout(100);
      }
      check(`"${item.label}" dropdown closes on Escape`, after === 0);
    }

    await page.close();
  } finally {
    await browser.close();
  }
}

await runtime();

if (failures > 0) {
  console.error(
    `\nvalidate-home-dropdowns-keyboard: ${failures} check(s) failed`,
  );
  process.exit(1);
}
console.log("\nvalidate-home-dropdowns-keyboard: all checks passed");
