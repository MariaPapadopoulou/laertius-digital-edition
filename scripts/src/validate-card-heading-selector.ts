/**
 * validate-card-heading-selector — stops future heading-level changes from
 * silently breaking browser checks again.
 *
 * Card headings once moved from <h3> to <h2> and eight e2e scripts had to be
 * patched by hand to query "h2, h3". The heading levels now live in ONE
 * place: scripts/src/lib/card-headings.ts (CARD_HEADING_SELECTOR). E2E
 * scripts must import it and pass it into page.evaluate / waitForFunction as
 * an argument instead of hardcoding heading-tag selectors.
 *
 * Checks:
 *  1. No e2e script under scripts/src hardcodes a heading-tag querySelector
 *     that duplicates the card-heading selector: querySelector/querySelectorAll
 *     called with "h3" or any "h2, h3"-style list.
 *  2. No e2e script contains the raw "h2, h3" selector string literal at all
 *     (e.g. in a Playwright locator) — that literal may only exist in
 *     lib/card-headings.ts.
 *  3. No e2e script hardcodes a bare "h2" selector literal either: page-level
 *     title headings are <h2> today, and a future page-title level change
 *     (h2 → h1, per-page differences) would silently break those checks the
 *     same way the h3 → h2 card move did. Scripts must pass
 *     PAGE_HEADING_SELECTOR (same lib module) into page.evaluate /
 *     waitForFunction as an argument instead.
 *  4. The single source of truth still exists and exports both
 *     CARD_HEADING_SELECTOR and PAGE_HEADING_SELECTOR.
 *  5. Positive controls: the detection regexes are run against seeded
 *     offending snippets and must flag every one, so the check cannot pass
 *     vacuously if the patterns drift.
 *
 * Multi-tag lists without h3 (e.g. "h1, h2" landmark waits) and descendant
 * selectors ("aside h2") are still allowed: they either survive a page-title
 * level change or scope to a container, and forbidding them would flood the
 * check with false positives.
 *
 * Run: pnpm --filter @workspace/scripts run validate-card-heading-selector
 */

import { readdirSync, readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const srcDir = here;
const libFile = path.join(srcDir, "lib", "card-headings.ts");

// A string literal whose content is purely a heading-tag list that includes
// h3 — the level the historical card-heading breakage was about. Plain "h2"
// (page headings) and lists without h3 (e.g. "h1, h2" landmarks) are fine.
const LITERAL_RE = /["'`]([^"'`]*)["'`]/g;
const HEADING_LIST_RE = /^\s*h[1-6]\s*(?:,\s*h[1-6]\s*)*$/;

function isForbiddenSelector(content: string): boolean {
  if (!HEADING_LIST_RE.test(content)) return false;
  // Card-heading breakage: any heading list including h3.
  if (/\bh3\b/.test(content)) return true;
  // Page-heading breakage: a bare "h2" literal pinning the page-title level.
  if (/^\s*h2\s*$/.test(content)) return true;
  return false;
}

type Violation = { file: string; line: number; snippet: string };

function scanSource(name: string, text: string): Violation[] {
  const out: Violation[] = [];
  const lines = text.split("\n");
  lines.forEach((lineText, i) => {
    LITERAL_RE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = LITERAL_RE.exec(lineText)) !== null) {
      if (isForbiddenSelector(m[1])) {
        out.push({ file: name, line: i + 1, snippet: m[0].trim() });
        break; // one report per line is enough
      }
    }
  });
  return out;
}

function main(): number {
  let failures = 0;

  // 3. Source of truth exists and exports the constant.
  if (!existsSync(libFile)) {
    console.error(`FAIL: missing single source of truth ${libFile}`);
    return 1;
  }
  const libText = readFileSync(libFile, "utf8");
  if (!/export const CARD_HEADING_SELECTOR\s*=/.test(libText)) {
    console.error(
      "FAIL: lib/card-headings.ts no longer exports CARD_HEADING_SELECTOR",
    );
    failures++;
  }
  if (!/export const PAGE_HEADING_SELECTOR\s*=/.test(libText)) {
    console.error(
      "FAIL: lib/card-headings.ts no longer exports PAGE_HEADING_SELECTOR",
    );
    failures++;
  }

  // 1 & 2. Sweep every e2e script.
  const e2eFiles = readdirSync(srcDir)
    .filter((f) => /^e2e-.*\.(ts|mts)$/.test(f))
    .sort();
  if (e2eFiles.length === 0) {
    console.error("FAIL: found no e2e-*.ts scripts to scan (wrong directory?)");
    failures++;
  }
  const violations: Violation[] = [];
  for (const f of e2eFiles) {
    violations.push(...scanSource(f, readFileSync(path.join(srcDir, f), "utf8")));
  }
  if (violations.length > 0) {
    console.error(
      `FAIL: ${violations.length} hardcoded heading-tag selector(s) in e2e scripts.` +
        ` Import CARD_HEADING_SELECTOR / PAGE_HEADING_SELECTOR from` +
        ` lib/card-headings.ts and pass it into page.evaluate/waitForFunction` +
        ` as an argument instead:`,
    );
    for (const v of violations) {
      console.error(`  ${v.file}:${v.line}  ${v.snippet}`);
    }
    failures += violations.length;
  } else {
    console.log(
      `OK: ${e2eFiles.length} e2e scripts scanned, no hardcoded heading-tag selectors.`,
    );
  }

  // 4. Positive controls — each seeded offender MUST be flagged.
  const controls: string[] = [
    `document.querySelectorAll("h3")`,
    `document.querySelectorAll("h2, h3")`,
    `document.querySelectorAll('h2,h3')`,
    "card.querySelector(`h3`)",
    `document.querySelectorAll("h3, h4")`,
    `page.locator("h2, h3")`,
    `await page.waitForSelector("h2, h3, h4")`,
    `document.querySelectorAll("h2")`, // bare page-heading level pin
    `aside?.querySelector('h2')`,
    "Array.from(document.querySelectorAll(`h2`))",
  ];
  let controlsFlagged = 0;
  for (const c of controls) {
    if (scanSource("control", c).length > 0) controlsFlagged++;
    else {
      console.error(`FAIL: positive control NOT flagged: ${c}`);
      failures++;
    }
  }
  // Negative controls — legitimate patterns must NOT be flagged.
  const negatives: string[] = [
    `document.querySelectorAll(sel)`, // selector passed as argument
    `document.querySelectorAll("h1, h2")`, // no h3, not bare h2 — landmark wait, fine
    `page.waitForSelector("h1, h2, [role='alert']")`, // mixed list, no h3
    `document.querySelectorAll("aside h2")`, // descendant selector, container-scoped
    `document.querySelector("h1")`, // h1 was never part of the breakage
    `import { PAGE_HEADING_SELECTOR } from "./lib/card-headings";`,
    `import { CARD_HEADING_SELECTOR } from "./lib/card-headings";`,
  ];
  for (const n of negatives) {
    if (scanSource("control", n).length > 0) {
      console.error(`FAIL: negative control wrongly flagged: ${n}`);
      failures++;
    }
  }
  console.log(
    `Positive controls flagged: ${controlsFlagged}/${controls.length}; negative controls clean.`,
  );

  return failures;
}

const failures = main();
if (failures > 0) {
  console.error(`validate-card-heading-selector FAILED (${failures} problem(s))`);
  process.exit(1);
}
console.log("validate-card-heading-selector PASSED");
