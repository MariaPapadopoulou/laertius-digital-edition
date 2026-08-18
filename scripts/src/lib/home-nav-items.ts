// Shared extraction of the homepage NAV_ITEMS array literal from
// artifacts/laertius/src/pages/home.tsx. Both real-browser homepage menu
// checks (e2e-home-menus-clickable.mts — desktop click path — and
// e2e-home-tap-nav.ts — touch path) derive their expected menu structure
// from this ONE helper, so a nav move / literal-format change breaks both
// loudly instead of leaving one copy silently mis-extracting.
//
// The literal is pure data (string literals only), so a plain Function
// evaluation is safe and keeps us from importing the whole React app into a
// Node script.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

export type NavItem = {
  label: string;
  href?: string;
  sub: { label: string; href: string }[];
};

export type ExtractedNav = {
  navItems: NavItem[];
  dropdownGroups: NavItem[];
  directLinks: NavItem[];
  totalItems: number;
  homeTsx: string;
};

/**
 * Extract NAV_ITEMS from home.tsx, run the positive controls, and log a
 * one-line summary. On any failure prints a FAIL line (mentioning
 * `callerName` so the operator knows which check to update) and exits 1.
 */
export function extractHomeNavItems(callerName: string): ExtractedNav {
  const here = dirname(fileURLToPath(import.meta.url));
  const homeTsx = resolve(
    here,
    "../../../artifacts/laertius/src/pages/home.tsx",
  );
  const source = readFileSync(homeTsx, "utf8");

  const match = source.match(/const NAV_ITEMS[^=]*=\s*(\[[\s\S]*?\n\]);/);
  if (!match) {
    console.error(
      `FAIL: could not locate the NAV_ITEMS array literal in ${homeTsx}; ` +
        `the nav structure may have moved — update lib/home-nav-items.ts (used by ${callerName}).`,
    );
    process.exit(1);
  }
  let navItems: NavItem[];
  try {
    navItems = new Function(`return (${match[1]});`)() as NavItem[];
  } catch (e) {
    console.error(
      `FAIL: NAV_ITEMS in ${homeTsx} is no longer a plain data literal ` +
        `(${(e as Error).message}); update lib/home-nav-items.ts (used by ${callerName}).`,
    );
    process.exit(1);
  }

  const dropdownGroups = navItems.filter((i) => i.sub.length > 0);
  const directLinks = navItems.filter((i) => i.sub.length === 0 && i.href);
  const totalItems =
    dropdownGroups.reduce((n, g) => n + g.sub.length, 0) + directLinks.length;

  // Positive control: an extraction that silently matched nothing must not
  // produce a vacuously green run.
  if (dropdownGroups.length < 3 || totalItems < 10) {
    console.error(
      `FAIL: extracted only ${dropdownGroups.length} dropdown group(s) / ` +
        `${totalItems} item(s) from NAV_ITEMS — extraction looks broken.`,
    );
    process.exit(1);
  }
  console.log(
    `Derived ${dropdownGroups.length} dropdown group(s) + ` +
      `${directLinks.length} direct link(s), ${totalItems} item(s) total, from home.tsx`,
  );

  return { navItems, dropdownGroups, directLinks, totalItems, homeTsx };
}
