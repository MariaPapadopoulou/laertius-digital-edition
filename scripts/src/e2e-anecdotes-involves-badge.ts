/// <reference lib="dom" />
// The in-page callbacks (page.evaluate / waitForFunction) run in the
// browser, so this Node-side script needs the DOM lib for their types.
//
// Real-browser check that a "with X" badge click on the Anecdotes page
// also clears STALE search and philosopher filters. An anecdote card's
// participant badge links to /anecdotes?involves=X with no other
// params; the page's in-place reconcile effect must therefore drop an
// active keyword search (?q=) and philosopher filter (?philosopher=)
// too — otherwise the URL-sync effect re-writes the stale params and
// they silently intersect with the new participant, showing a
// misleading or empty list. Modeled on e2e-sayings-topic-badge.ts.
//
// Scenario:
// 1. Load /anecdotes, type a search term with real keystrokes (the box
//    is debounced) and pick a philosopher from the dropdown; the URL
//    gains ?q= and ?philosopher= and the list narrows.
// 2. Click a card's "with X" badge (bubbling MouseEvent so wouter
//    handles the same-page navigation in place).
// 3. The URL must carry ONLY ?involves=X, the search box must empty,
//    the philosopher trigger must reset to "All philosophers", and the
//    count line must equal the API's own count for that participant
//    alone (proving no stale intersection survived).
//
// Requirements: the API server and web workflows must be running (the
// script talks to the shared proxy, default http://localhost:80), and a
// Chromium headless shell must be installed for playwright-core, e.g.:
//   PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright \
//     node scripts/node_modules/playwright-core/cli.js install chromium-headless-shell

// playwright-core resolves its browser registry at module import time from
// PLAYWRIGHT_BROWSERS_PATH (default: $XDG_CACHE_HOME/ms-playwright, which in
// this environment points inside the workspace and holds no browsers). Set
// the env var BEFORE importing playwright-core, picking whichever candidate
// actually contains a chromium install.
import "./lib/playwright-browsers-path";

const { chromium } = await import("playwright-core");
const { attachPageGuard } = await import("./lib/e2e-page-guard");

const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:80";

// The stale filters to seed. Diogenes of Sinope has anecdotes involving
// Alexander, and "Alexander" as a search term narrows his set to a
// strict subset — while Alexander's corpus-wide participant set spans
// several philosophers, so the badge click provably widens the list.
const PHILOSOPHER = "Diogenes of Sinope";
const SEARCH_TERM = "Alexander";

let failures = 0;
function check(label: string, ok: boolean, detail?: string) {
  if (ok) {
    console.log(`  ok: ${label}`);
  } else {
    failures++;
    console.error(`  FAIL: ${label}${detail ? ` (${detail})` : ""}`);
  }
}

async function main() {
  // Positive control: the API itself must have anecdotes for the seeded
  // philosopher+term slice, or the scenario is vacuous.
  const all = (await (await fetch(`${BASE_URL}/api/anecdotes`)).json()) as Array<{
    involves?: string;
    philosopher: string;
  }>;
  check(
    "API positive control: the anecdotes corpus is non-empty",
    all.length > 0,
    `count=${all.length}`,
  );
  const involvesCounts = new Map<string, number>();
  for (const a of all) {
    if (a.involves)
      involvesCounts.set(a.involves, (involvesCounts.get(a.involves) ?? 0) + 1);
  }

  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({
      viewport: { width: 1280, height: 720 },
    });
    const guard = attachPageGuard(page);

    console.log(
      "Scenario: a 'with X' badge click clears a stale search term and philosopher filter",
    );
    await page.goto(`${BASE_URL}/anecdotes`, { waitUntil: "networkidle" });
    guard.assertPageLoaded();
    await guard.guarded(
      page.waitForFunction(
        (full) => {
          const m = /(\d+) anecdotes/.exec(document.body.innerText);
          return !!m && Number(m[1]) === Number(full);
        },
        all.length,
        { timeout: 30000 },
      ),
    );
    await page.waitForTimeout(300);

    // Helper: pick an option from one of the Radix Select dropdowns by
    // real clicks (the trigger opens a portal listbox of role=option).
    const pickOption = async (triggerId: string, optionName: string) => {
      await page.click(`#${triggerId}`);
      const option = page.getByRole("option", {
        name: optionName,
        exact: true,
      });
      await option.waitFor({ state: "visible", timeout: 5000 });
      await option.click();
      await page
        .getByRole("listbox")
        .waitFor({ state: "hidden", timeout: 5000 })
        .catch(() => {});
    };

    // Seed the stale filters with real interactions.
    const searchBox = page.locator(
      'input[placeholder^="Search the anecdotes"]',
    );
    await searchBox.click();
    await searchBox.pressSequentially(SEARCH_TERM, { delay: 40 });
    await pickOption("phil", PHILOSOPHER);
    const staleSeeded = await page
      .waitForFunction(
        ([q, p, full]) => {
          const sp = new URLSearchParams(window.location.search);
          const m = /(\d+) anecdotes/.exec(document.body.innerText);
          return (
            sp.get("q") === q &&
            sp.get("philosopher") === p &&
            !!m &&
            Number(m[1]) > 0 &&
            Number(m[1]) < Number(full)
          );
        },
        [SEARCH_TERM, PHILOSOPHER, String(all.length)] as const,
        { timeout: 15000 },
      )
      .then(
        () => true,
        () => false,
      );
    const staleSearch = await page.evaluate(() => window.location.search);
    check(
      `stale filters active: ?q=${SEARCH_TERM}&philosopher=${PHILOSOPHER} narrows the list`,
      staleSeeded,
      `search=${staleSearch}`,
    );
    await page.waitForTimeout(300);
    const sliceCount = await page.evaluate(
      () => Number(/(\d+) anecdotes/.exec(document.body.innerText)?.[1] ?? 0),
    );

    // Read the filtered cards' "with X" badges (anchors to
    // /anecdotes?involves=) and pick one whose corpus-wide participant
    // set is wider than the stale slice.
    const readBadges = () =>
      page.evaluate(() => {
        return Array.from(document.querySelectorAll("a"))
          .filter((a) =>
            (a.getAttribute("href") ?? "").startsWith("/anecdotes?involves="),
          )
          .map((a) => {
            const href = a.getAttribute("href") ?? "";
            return (
              new URLSearchParams(href.slice(href.indexOf("?"))).get(
                "involves",
              ) ?? ""
            );
          });
      });
    const staleBadges = await readBadges();
    const involves = staleBadges.find(
      (v) => (involvesCounts.get(v) ?? 0) > sliceCount,
    );
    check(
      "a 'with X' badge with a wider corpus-wide set exists on the filtered cards",
      !!involves,
      `badges=${staleBadges.join(",")} slice=${sliceCount}`,
    );
    if (!involves) return;
    const involvesTotal = involvesCounts.get(involves) ?? 0;

    // Click the badge via a bubbling MouseEvent (wouter handles the
    // same-page navigation in place).
    const clicked = await page.evaluate((v) => {
      const a = Array.from(document.querySelectorAll("a")).find((el) => {
        const href = el.getAttribute("href") ?? "";
        return (
          href.startsWith("/anecdotes?involves=") &&
          new URLSearchParams(href.slice(href.indexOf("?"))).get("involves") ===
            v
        );
      });
      if (!a) return false;
      a.dispatchEvent(
        new MouseEvent("click", { bubbles: true, cancelable: true }),
      );
      return true;
    }, involves);
    check(`'with ${involves}' badge clicked`, clicked);

    // The URL must settle on ONLY ?involves= (no ?q=, no ?philosopher=).
    const urlOk = await page
      .waitForFunction(
        (v) => {
          const sp = new URLSearchParams(window.location.search);
          return (
            window.location.pathname === "/anecdotes" &&
            sp.get("involves") === v &&
            Array.from(sp.keys()).length === 1
          );
        },
        involves,
        { timeout: 10000 },
      )
      .then(
        () => true,
        () => false,
      );
    const afterSearch = await page.evaluate(() => window.location.search);
    check(
      `URL carries only ?involves=${involves} (no ?q=, no ?philosopher=)`,
      urlOk,
      `search=${afterSearch}`,
    );

    // The controls must visibly reset.
    const controlsReset = await page
      .waitForFunction(
        () =>
          (
            document.querySelector<HTMLInputElement>(
              'input[placeholder^="Search the anecdotes"]',
            )?.value ?? "x"
          ).trim() === "" &&
          (document.getElementById("phil")?.textContent ?? "").trim() ===
            "All philosophers",
        undefined,
        { timeout: 10000 },
      )
      .then(
        () => true,
        () => false,
      );
    const controlsNow = await page.evaluate(() => ({
      q: document.querySelector<HTMLInputElement>(
        'input[placeholder^="Search the anecdotes"]',
      )?.value,
      phil: (document.getElementById("phil")?.textContent ?? "").trim(),
    }));
    check(
      "search box empties and philosopher resets to 'All philosophers'",
      controlsReset,
      `q=${JSON.stringify(controlsNow.q)} phil=${controlsNow.phil}`,
    );

    // The list must settle on ALL anecdotes involving the participant:
    // the count line matches the API's own total (STRICTLY WIDER than
    // the q+philosopher slice) and every badge shows the participant.
    const widened = await page
      .waitForFunction(
        ([v, total]) => {
          const m = /(\d+) anecdotes/.exec(document.body.innerText);
          const badges = Array.from(document.querySelectorAll("a")).filter(
            (a) =>
              (a.getAttribute("href") ?? "").startsWith(
                "/anecdotes?involves=",
              ),
          );
          return (
            !!m &&
            Number(m[1]) === Number(total) &&
            badges.length === Number(total) &&
            badges.every((a) => {
              const href = a.getAttribute("href") ?? "";
              return (
                new URLSearchParams(href.slice(href.indexOf("?"))).get(
                  "involves",
                ) === String(v)
              );
            })
          );
        },
        [involves, String(involvesTotal)] as const,
        { timeout: 15000 },
      )
      .then(
        () => true,
        () => false,
      );
    const afterBadges = await readBadges();
    check(
      `list shows ALL ${involvesTotal} anecdotes involving "${involves}" (wider than the stale slice of ${sliceCount})`,
      widened && involvesTotal > sliceCount,
      `count=${afterBadges.length} involves=${Array.from(new Set(afterBadges)).join(",")}`,
    );
    check(
      "no 'No anecdotes match' dead end after the badge click",
      await page.evaluate(
        () => !document.body.innerText.includes("No anecdotes match"),
      ),
    );
  } finally {
    await browser.close();
  }
}

await main();
if (failures > 0) {
  console.error(`\n${failures} check(s) failed`);
  process.exit(1);
}
console.log("\nAll anecdotes involves-badge checks passed");
