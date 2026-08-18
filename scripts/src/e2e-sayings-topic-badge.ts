/// <reference lib="dom" />
// The in-page callbacks (page.evaluate / waitForFunction) run in the
// browser, so this Node-side script needs the DOM lib for their types.
//
// Real-browser check that a topic badge click on the Sayings page also
// clears STALE search and philosopher filters. A saying card's topic
// badge links to /sayings?topic=X with no other params; the page's
// in-place reconcile effect must therefore drop an active keyword
// search (?q=) and philosopher filter (?philosopher=) too — otherwise
// the URL-sync effect re-writes the stale params and they silently
// intersect with the new topic, showing a misleading or empty list.
// Modeled on the "clears a stale search term and book filter" scenario
// in e2e-doxography-links.ts.
//
// Scenario:
// 1. Load /sayings, type a search term into the debounced box with real
//    keystrokes, and pick a philosopher from the dropdown; the URL gains
//    ?q= and ?philosopher= and the list narrows.
// 2. Click the first rendered card's topic badge (bubbling MouseEvent so
//    wouter handles the same-page navigation in place).
// 3. The URL must carry ONLY ?topic=X (no ?q=, no ?philosopher=), the
//    search box must empty, the philosopher trigger must reset to "All
//    philosophers", every rendered card's topic badge must show the
//    clicked topic, and the count line must equal the API's own count
//    for that topic alone (proving no stale intersection survived).
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
import { CARD_HEADING_SELECTOR } from "./lib/card-headings";

const { chromium } = await import("playwright-core");
const { attachPageGuard } = await import("./lib/e2e-page-guard");

const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:80";

// The stale filters to seed. Diogenes of Sinope is the corpus's largest
// contributor of sayings and "man" matches several of his English
// glosses, so the q+philosopher slice is reliably non-empty and shows
// topic badges to click.
const PHILOSOPHER = "Diogenes of Sinope";
const SEARCH_TERM = "man";

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
  // Positive control: the API itself must have sayings for the seeded
  // philosopher+term slice, or the scenario is vacuous.
  const allSayings = (await (
    await fetch(`${BASE_URL}/api/sayings`)
  ).json()) as Array<{ topic: string; philosopher: string }>;
  check(
    "API positive control: the sayings corpus is non-empty",
    allSayings.length > 0,
    `count=${allSayings.length}`,
  );
  const topicCounts = new Map<string, number>();
  for (const s of allSayings) {
    topicCounts.set(s.topic, (topicCounts.get(s.topic) ?? 0) + 1);
  }

  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({
      viewport: { width: 1280, height: 720 },
    });
    // Fail fast with the failing URL/status instead of an opaque selector
    // timeout when the site itself fails to boot.
    const guard = attachPageGuard(page);

    console.log(
      "Scenario: a topic badge click clears a stale search term and philosopher filter",
    );
    await page.goto(`${BASE_URL}/sayings`, { waitUntil: "networkidle" });
    guard.assertPageLoaded();
    await guard.guarded(
      page.waitForFunction(
        (cardHeadingSel) =>
          /\d+ sayings/.test(document.body.innerText) &&
          Array.from(document.querySelectorAll(cardHeadingSel)).some((h) =>
            (h.textContent ?? "").startsWith("D.L. "),
          ),
        CARD_HEADING_SELECTOR,
        { timeout: 30000 },
      ),
    );
    await page.waitForTimeout(300);
    const fullCount = await page.evaluate(
      () => Number(/(\d+) sayings/.exec(document.body.innerText)?.[1] ?? 0),
    );
    check(
      `unfiltered list settles (${allSayings.length} sayings)`,
      fullCount === allSayings.length,
      `rendered count line=${fullCount}`,
    );

    // Helper: pick an option from one of the Radix Select dropdowns by
    // real clicks (the trigger opens a portal listbox of role=option).
    const pickOption = async (triggerId: string, optionName: string) => {
      await page.click(`#${triggerId}`);
      const option = page.getByRole("option", { name: optionName });
      await option.waitFor({ state: "visible", timeout: 5000 });
      await option.click();
      await page
        .getByRole("listbox")
        .waitFor({ state: "hidden", timeout: 5000 })
        .catch(() => {});
    };

    // Seed the stale filters with real interactions: type the search
    // term keystroke by keystroke (the box is debounced) and pick the
    // philosopher from the dropdown.
    const searchBox = page.locator(
      'input[placeholder^="Search the sayings"]',
    );
    await searchBox.click();
    await searchBox.pressSequentially(SEARCH_TERM, { delay: 40 });
    await pickOption("phil", PHILOSOPHER);
    const staleSeeded = await page
      .waitForFunction(
        ([q, p, full]) => {
          const sp = new URLSearchParams(window.location.search);
          const m = /(\d+) sayings/.exec(document.body.innerText);
          return (
            sp.get("q") === q &&
            sp.get("philosopher") === p &&
            !!m &&
            Number(m[1]) > 0 &&
            Number(m[1]) < Number(full)
          );
        },
        [SEARCH_TERM, PHILOSOPHER, String(fullCount)] as const,
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

    // Read the filtered cards' topic badges (anchors to /sayings?topic=)
    // and remember the slice size so we can prove the click widened the
    // list past the q+philosopher intersection.
    const readBadges = () =>
      page.evaluate(() => {
        const anchors = Array.from(document.querySelectorAll("a")).filter(
          (a) => (a.getAttribute("href") ?? "").startsWith("/sayings?topic="),
        );
        return anchors.map((a) => ({
          href: a.getAttribute("href") ?? "",
          topic: (a.textContent ?? "").trim(),
        }));
      });
    const staleBadges = await readBadges();
    const clickedTopic = staleBadges[0]?.topic;
    check(
      "a topic badge exists on the q+philosopher-filtered cards",
      !!clickedTopic,
      `badges=${staleBadges.map((b) => b.topic).join(",")}`,
    );
    if (!clickedTopic) return;
    const sliceCount = staleBadges.filter(
      (b) => b.topic === clickedTopic,
    ).length;
    const topicTotal = topicCounts.get(clickedTopic) ?? 0;
    check(
      `API positive control: topic "${clickedTopic}" has more sayings (${topicTotal}) than the stale slice (${sliceCount})`,
      topicTotal > sliceCount,
    );

    // Click the badge via a bubbling MouseEvent (wouter handles the
    // same-page navigation in place).
    const clicked = await page.evaluate((t) => {
      const a = Array.from(document.querySelectorAll("a")).find(
        (el) =>
          (el.getAttribute("href") ?? "").startsWith("/sayings?topic=") &&
          (el.textContent ?? "").trim() === t,
      );
      if (!a) return false;
      a.dispatchEvent(
        new MouseEvent("click", { bubbles: true, cancelable: true }),
      );
      return true;
    }, clickedTopic);
    check(`topic badge ("${clickedTopic}") clicked`, clicked);

    // The URL must gain ?topic= and LOSE both ?q= and ?philosopher=.
    const urlOk = await page
      .waitForFunction(
        (t) => {
          const sp = new URLSearchParams(window.location.search);
          return (
            window.location.pathname === "/sayings" &&
            sp.get("topic") === t &&
            !sp.has("q") &&
            !sp.has("philosopher")
          );
        },
        clickedTopic,
        { timeout: 10000 },
      )
      .then(
        () => true,
        () => false,
      );
    const afterSearch = await page.evaluate(() => window.location.search);
    check(
      `URL carries only ?topic=${clickedTopic} (no ?q=, no ?philosopher=)`,
      urlOk,
      `search=${afterSearch}`,
    );

    // The controls must visibly reset: empty search box, philosopher
    // trigger back on "All philosophers", topic trigger on the topic.
    const controlsReset = await page
      .waitForFunction(
        (t) =>
          (
            document.querySelector<HTMLInputElement>(
              'input[placeholder^="Search the sayings"]',
            )?.value ?? "x"
          ).trim() === "" &&
          (document.getElementById("phil")?.textContent ?? "").trim() ===
            "All philosophers" &&
          (document.getElementById("topic")?.textContent ?? "")
            .trim()
            .toLowerCase() === t.toLowerCase(),
        clickedTopic,
        { timeout: 10000 },
      )
      .then(
        () => true,
        () => false,
      );
    const controlsNow = await page.evaluate(() => ({
      q: document.querySelector<HTMLInputElement>(
        'input[placeholder^="Search the sayings"]',
      )?.value,
      phil: (document.getElementById("phil")?.textContent ?? "").trim(),
      topic: (document.getElementById("topic")?.textContent ?? "").trim(),
    }));
    check(
      "search box empties, philosopher resets to 'All philosophers', topic trigger shows the topic",
      controlsReset,
      `q=${JSON.stringify(controlsNow.q)} phil=${controlsNow.phil} topic=${controlsNow.topic}`,
    );

    // The list must settle on ALL sayings of the clicked topic: the
    // count line matches the API's per-topic total (STRICTLY WIDER than
    // the q+philosopher slice) and every rendered badge shows the topic.
    const widened = await page
      .waitForFunction(
        ([t, total]) => {
          const m = /(\d+) sayings/.exec(document.body.innerText);
          const badges = Array.from(document.querySelectorAll("a")).filter(
            (a) => (a.getAttribute("href") ?? "").startsWith("/sayings?topic="),
          );
          return (
            !!m &&
            Number(m[1]) === Number(total) &&
            badges.length === Number(total) &&
            badges.every((a) => (a.textContent ?? "").trim() === String(t))
          );
        },
        [clickedTopic, String(topicTotal)] as const,
        { timeout: 15000 },
      )
      .then(
        () => true,
        () => false,
      );
    const afterBadges = await readBadges();
    check(
      `list shows ALL ${topicTotal} "${clickedTopic}" sayings (wider than the stale slice of ${sliceCount})`,
      widened,
      `count=${afterBadges.length} topics=${Array.from(new Set(afterBadges.map((b) => b.topic))).join(",")}`,
    );
    check(
      "another philosopher's card appears (filter really dropped)",
      await page.evaluate(
        (p) =>
          Array.from(document.querySelectorAll("span")).some((s) => {
            const t = (s.textContent ?? "").trim();
            return t.length > 0 && t !== p;
          }),
        PHILOSOPHER,
      ),
    );
    check(
      "no 'No sayings match' dead end after the badge click",
      await page.evaluate(
        () => !document.body.innerText.includes("No sayings match"),
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
console.log("\nAll sayings topic-badge checks passed");
