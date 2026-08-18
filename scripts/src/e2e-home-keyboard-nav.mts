/// <reference lib="dom" />
// Real-browser check that a KEYBOARD-ONLY reader can use the homepage nav:
// Tab through the header, each dropdown trigger opens its menu on focus
// (aria-expanded=true), and pressing Enter on a menu entry actually
// navigates. Complements:
//   - e2e-home-menus-clickable.mts (mouse path)
//   - validate-home-dropdowns-keyboard.ts (focus->mount, Tab traversal, Esc)
// Neither of those activates an item via Enter, so an onKeyDown/focus
// regression could strand keyboard users while both stay green.
//
// The expected menu structure is DERIVED from pages/home.tsx NAV_ITEMS at
// run time, so a menu rename or addition fails loudly here instead of being
// silently skipped by a hardcoded list.
//
// Requirements: the web workflow must be serving through the shared proxy
// (default http://localhost:80) and a Chromium headless shell must be
// installed for playwright-core.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

// playwright-core resolves its browser registry at module import time from
// PLAYWRIGHT_BROWSERS_PATH; set it BEFORE the dynamic import.
import "./lib/playwright-browsers-path";

const { chromium } = await import("playwright-core");
const { attachPageGuard } = await import("./lib/e2e-page-guard");

const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:80";

// ---------------------------------------------------------------------------
// Derive the expected menus from home.tsx NAV_ITEMS (pure data literal), same
// approach as e2e-home-menus-clickable.mts.
// ---------------------------------------------------------------------------
type NavItem = {
  label: string;
  href?: string;
  sub: { label: string; href: string }[];
};

const here = dirname(fileURLToPath(import.meta.url));
const homeTsx = resolve(here, "../../artifacts/laertius/src/pages/home.tsx");
const source = readFileSync(homeTsx, "utf8");

const match = source.match(/const NAV_ITEMS[^=]*=\s*(\[[\s\S]*?\n\]);/);
if (!match) {
  console.error(
    `FAIL: could not locate the NAV_ITEMS array literal in ${homeTsx}; ` +
      "the nav structure may have moved — update e2e-home-keyboard-nav.mts.",
  );
  process.exit(1);
}
let navItems: NavItem[];
try {
  navItems = new Function(`return (${match[1]});`)() as NavItem[];
} catch (e) {
  console.error(
    `FAIL: NAV_ITEMS in ${homeTsx} is no longer a plain data literal ` +
      `(${(e as Error).message}); update e2e-home-keyboard-nav.mts.`,
  );
  process.exit(1);
}

const dropdownGroups = navItems.filter((i) => i.sub.length > 0);
const directLinks = navItems.filter((i) => i.sub.length === 0 && i.href);

// Positive control: an extraction that silently matched nothing must not
// produce a vacuously green run.
if (dropdownGroups.length < 3) {
  console.error(
    `FAIL: extracted only ${dropdownGroups.length} dropdown group(s) from ` +
      "NAV_ITEMS — extraction looks broken.",
  );
  process.exit(1);
}
console.log(
  `Derived ${dropdownGroups.length} dropdown group(s) + ` +
    `${directLinks.length} direct link(s) from home.tsx`,
);

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
// Fail fast with the failing URL/status instead of an opaque selector timeout
// when the site itself fails to boot (500 on a module/CSS, uncaught error).
const guard = attachPageGuard(page);
let failures = 0;

const MAX_TABS = 60;

/** Press Tab until the focused element's trimmed text equals `label` (and,
 *  optionally, matches `tag`). Returns true if reached. */
async function tabTo(label: string, tag?: string): Promise<boolean> {
  for (let i = 0; i < MAX_TABS; i++) {
    await page.keyboard.press("Tab");
    const active = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      return el
        ? { tag: el.tagName, text: (el.textContent ?? "").trim() }
        : null;
    });
    if (
      active &&
      active.text === label &&
      (!tag || active.tag === tag.toUpperCase())
    ) {
      return true;
    }
  }
  return false;
}

// ---------------------------------------------------------------------------
// 1) Single pass: Tab through the whole nav in order and assert every
//    dropdown trigger opens its menu on focus (aria-expanded=true) and every
//    promised entry is reachable by further Tabs.
// ---------------------------------------------------------------------------
await page.goto(`${BASE_URL}/`, { waitUntil: "domcontentloaded" });
guard.assertPageLoaded();
await guard.guarded(page.waitForSelector("nav button", { timeout: 10000 }));

for (const item of navItems) {
  const isDropdown = item.sub.length > 0;
  const reached = await tabTo(item.label, isDropdown ? "button" : "a");
  if (!reached) {
    failures++;
    console.error(`FAIL: could not Tab to nav trigger "${item.label}"`);
    continue;
  }
  if (!isDropdown) {
    console.log(`ok: tabbed to direct link "${item.label}"`);
    continue;
  }
  const expanded = await page.evaluate(
    () => (document.activeElement as HTMLElement).getAttribute("aria-expanded"),
  );
  if (expanded !== "true") {
    failures++;
    console.error(
      `FAIL: "${item.label}" focused but aria-expanded=${expanded} — ` +
        "dropdown did not open on keyboard focus",
    );
    continue;
  }
  console.log(`ok: "${item.label}" opens on focus (aria-expanded=true)`);
  // Every entry the menu promises must be reachable by Tab while it is open.
  for (const sub of item.sub) {
    await page.keyboard.press("Tab");
    const active = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      return el
        ? {
            tag: el.tagName,
            text: (el.textContent ?? "").trim(),
            href: el.getAttribute("href"),
          }
        : null;
    });
    if (!active || active.tag !== "A" || active.text !== sub.label) {
      failures++;
      console.error(
        `FAIL: expected Tab to reach "${item.label} > ${sub.label}", ` +
          `focus is on <${active?.tag}> "${active?.text}"`,
      );
      break;
    }
    console.log(`ok: reached "${item.label} > ${sub.label}" by Tab`);
  }
}

// ---------------------------------------------------------------------------
// 2) Per group: Tab to the trigger, Tab into the menu, activate the first
//    entry with Enter and assert navigation happened.
// ---------------------------------------------------------------------------
for (const group of dropdownGroups) {
  const target = group.sub[0];
  await page.goto(`${BASE_URL}/`, { waitUntil: "domcontentloaded" });
  guard.assertPageLoaded();
  await guard.guarded(page.waitForSelector("nav button", { timeout: 10000 }));
  try {
    if (!(await tabTo(group.label, "button"))) {
      throw new Error("could not reach trigger by Tab");
    }
    await page.keyboard.press("Tab"); // into first menu entry
    const focusedHref = await page.evaluate(() =>
      (document.activeElement as HTMLElement | null)?.getAttribute("href"),
    );
    if (!focusedHref || !focusedHref.endsWith(target.href)) {
      throw new Error(
        `focus not on first entry (href=${focusedHref}, want ${target.href})`,
      );
    }
    await page.keyboard.press("Enter");
    await page.waitForURL("**" + target.href, { timeout: 5000 });
    console.log(
      `ok: Enter on ${group.label} > ${target.label} -> ${target.href}`,
    );
  } catch (e) {
    failures++;
    console.error(
      `FAIL: keyboard activation of ${group.label} > ${target.label} ` +
        `(expected ${target.href}) — ${(e as Error).message}; now at ${page.url()}`,
    );
  }
}

// Direct top-level links must also activate via Enter.
for (const item of directLinks) {
  await page.goto(`${BASE_URL}/`, { waitUntil: "domcontentloaded" });
  guard.assertPageLoaded();
  await guard.guarded(page.waitForSelector("nav button", { timeout: 10000 }));
  try {
    if (!(await tabTo(item.label, "a"))) {
      throw new Error("could not reach link by Tab");
    }
    await page.keyboard.press("Enter");
    await page.waitForURL("**" + item.href!, { timeout: 5000 });
    console.log(`ok: Enter on ${item.label} -> ${item.href}`);
  } catch (e) {
    failures++;
    console.error(
      `FAIL: keyboard activation of ${item.label} (expected ${item.href}) — ` +
        `${(e as Error).message}; now at ${page.url()}`,
    );
  }
}

await browser.close();
if (failures > 0) {
  console.error(`${failures} keyboard-navigation failure(s) on homepage nav`);
  process.exit(1);
}
console.log("Homepage nav fully operable by keyboard.");
