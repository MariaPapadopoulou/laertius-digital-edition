/// <reference lib="dom" />
/* Real-browser check: every homepage Lives dot links to the RIGHT
 * philosopher.
 *
 * Each dot's link relies on index alignment between the hardcoded
 * LIVES_DOTS layout in home.tsx (dots rendered j = 0..count-1 inside a
 * flex-col-reverse column, i.e. bottom-up visually) and the API's
 * philosophers roster (per book, Book I prologue excluded).
 * validate-lives-dots pins counts and highlights statically, but NOT
 * this interaction mapping: a re-sorted roster, an off-by-one in
 * livesByBook, or a swapped index would ship dots that open the wrong
 * Life while every static check stays green.
 *
 * This script:
 * 1. Recomputes the expected roster from the api-server corpus (the
 *    same truth validate-lives-dots uses): per book, in corpus order,
 *    excluding the Book I prologue.
 * 2. Loads the homepage and waits for the dot links to hydrate.
 * 3. Asserts exactly <corpus total> (82) dot links exist under the
 *    selector a[data-testid^=lives-dot-].
 * 4. For each link, in DOM order (book by book, j ascending), verifies:
 *    - data-testid is lives-dot-<book>-<chapter> for the expected Life,
 *    - the href targets /section/<firstId> of that same Life,
 *    - the tooltip's name line is the Life's philosopher name.
 * 5. Positive control: the comparator is re-run against a deliberately
 *    rotated roster and MUST report mismatches, proving it is not
 *    vacuously green.
 *
 * Requirements: api-server + laertius web workflows running behind the
 * shared proxy (http://localhost:80) and the headless Chromium shell
 * installed for playwright-core:
 *   PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright \
 *     node scripts/node_modules/playwright-core/cli.js install chromium-headless-shell
 */
import path from "node:path";

const workspaceRoot = path.resolve(import.meta.dirname, "../..");
// Pin the corpus data dir BEFORE importing api-server modules, or paths
// resolve against the scripts cwd.
process.env["LAERTIUS_DATA_DIR"] = path.resolve(
  workspaceRoot,
  "artifacts/api-server/data",
);

import "./lib/playwright-browsers-path";

const { chromium } = await import("playwright-core");
const { attachPageGuard } = await import("./lib/e2e-page-guard");
const { philosophers } = await import(
  "../../artifacts/api-server/src/lib/corpus"
);

const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:80";

interface ExpectedLife {
  book: number;
  chapter: string;
  name: string;
  firstId: string;
}

// Expected roster in the exact order home.tsx renders the links:
// books 1..10 left-to-right, and within each book the corpus roster
// order (livesByBook preserves it), prologue excluded.
const expected: ExpectedLife[] = [];
for (let b = 1; b <= 10; b++) {
  const lives = philosophers.filter(
    (p) => p.book === b && p.chapter !== "prol",
  );
  if (lives.length === 0) {
    throw new Error(`corpus: book ${b} has zero Lives — corpus data broken?`);
  }
  for (const p of lives) {
    expected.push({
      book: b,
      chapter: p.chapter,
      name: p.name,
      firstId: p.firstId,
    });
  }
}

interface DomDot {
  testid: string;
  href: string;
  tooltipName: string;
}

function compare(dots: DomDot[], roster: ExpectedLife[]): string[] {
  const errors: string[] = [];
  if (dots.length !== roster.length) {
    errors.push(
      `found ${dots.length} dot links; corpus roster has ${roster.length} Lives`,
    );
  }
  const n = Math.min(dots.length, roster.length);
  for (let i = 0; i < n; i++) {
    const d = dots[i]!;
    const e = roster[i]!;
    const wantTestid = `lives-dot-${e.book}-${e.chapter}`;
    if (d.testid !== wantTestid) {
      errors.push(
        `dot #${i}: data-testid "${d.testid}" != expected "${wantTestid}" (${e.name})`,
      );
    }
    // href may carry a base prefix; pin the route suffix exactly.
    const wantHref = `/section/${e.firstId}`;
    if (!d.href.endsWith(wantHref)) {
      errors.push(
        `dot #${i} (${d.testid}): href "${d.href}" does not end with "${wantHref}" — this dot opens the WRONG Life (expected ${e.name})`,
      );
    }
    if (d.tooltipName !== e.name) {
      errors.push(
        `dot #${i} (${d.testid}): tooltip names "${d.tooltipName}" but the corpus Life here is "${e.name}"`,
      );
    }
  }
  return errors;
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({
      viewport: { width: 1500, height: 1000 },
    });
    const guard = attachPageGuard(page);
    await page.goto(`${BASE_URL}/`, { waitUntil: "networkidle" });
    guard.assertPageLoaded();

    // The dots hydrate once the philosophers query resolves; wait until
    // the link count settles at the corpus total (or time out loudly).
    await guard.guarded(
      page.waitForFunction(
        (total: number) =>
          document.querySelectorAll("a[data-testid^='lives-dot-']").length ===
          total,
        expected.length,
        { timeout: 30000 },
      ),
    );

    const dots: DomDot[] = await page.$$eval(
      "a[data-testid^='lives-dot-']",
      (links) =>
        links.map((a) => {
          const tooltip = a.querySelector("[role='tooltip']");
          return {
            testid: a.getAttribute("data-testid") ?? "",
            href: a.getAttribute("href") ?? "",
            // First line of the tooltip is the philosopher's name.
            tooltipName:
              tooltip?.querySelector("span")?.textContent?.trim() ?? "",
          };
        }),
    );

    // Positive control: a rotated roster MUST be flagged.
    const rotated = [...expected.slice(1), expected[0]!];
    const controlErrors = compare(dots, rotated);
    if (controlErrors.length === 0) {
      console.error(
        "POSITIVE CONTROL FAILED: a deliberately rotated roster was not detected — the comparator is vacuous.",
      );
      process.exit(1);
    }
    console.log(
      `positive control OK (${controlErrors.length} mismatch(es) flagged on rotated roster)`,
    );

    console.log(
      `found ${dots.length} dot links; corpus roster has ${expected.length} Lives`,
    );
    const errors = compare(dots, expected);
    if (errors.length > 0) {
      console.error("Lives dots point at the wrong philosophers:");
      for (const e of errors.slice(0, 30)) console.error(`  - ${e}`);
      if (errors.length > 30) {
        console.error(`  … and ${errors.length - 30} more`);
      }
      process.exit(1);
    }
    console.log(
      `\ne2e-lives-dots-links: all ${dots.length} dots link to the right Life (testid, /section/<firstId> target, tooltip name).`,
    );
    await page.close();
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
