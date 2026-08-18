/// <reference lib="dom" />
// The in-page callbacks (page.evaluate / waitForFunction) run in the
// browser, so this Node-side script needs the DOM lib for their types.
//
// Real-browser check that the Letters page's card badges also clear
// STALE filters when clicked. Letters is the trickiest badge set: the
// transient badge params (?verdict=, ?from=) map onto differently-named
// persistent params (?authenticity=, ?sender=), while ?to= and ?topic=
// reuse the persistent names. The page's reconcile effect must absorb
// the transient param into the matching control AND drop every other
// active filter — otherwise the URL-sync effect re-writes the stale
// params and they silently intersect with the clicked badge value.
// Modeled on e2e-sayings-topic-badge.ts.
//
// Scenarios (each starts from a fresh /letters load):
// 1. Seed a stale search term (?q=) and sender filter (?sender=) with
//    real interactions, click a card's topic badge (/letters?topic=X),
//    and assert the URL carries ONLY ?topic=X, the controls reset, and
//    the list widens to the topic's full set.
// 2. Same stale q+sender seed, click a verdict badge
//    (/letters?verdict=X): the transient param must be absorbed as
//    ?authenticity=X (no ?verdict= left), the other filters drop, the
//    matching authenticity chip activates, and the list widens to the
//    verdict's full set.
// 3. Seed a stale q + topic filter, click a sender badge
//    (/letters?from=X): absorbed as ?sender=X (no ?from= left), other
//    filters drop, the From dropdown shows the sender, list = the
//    sender's full set.
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
import type { Page } from "playwright-core";
import type { PageGuard } from "./lib/e2e-page-guard";

const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:80";

// The stale filters to seed. Solon is a multi-letter sender and "city"
// matches a strict subset of his letters, so the q+sender slice is
// reliably non-empty, narrower than the full list, and shows all four
// badge kinds to click.
const SENDER = "Solon";
const SEARCH_TERM = "city";

let failures = 0;
function check(label: string, ok: boolean, detail?: string) {
  if (ok) {
    console.log(`  ok: ${label}`);
  } else {
    failures++;
    console.error(`  FAIL: ${label}${detail ? ` (${detail})` : ""}`);
  }
}

type Epistle = {
  sender: string;
  to: string;
  topic: string;
  authenticity: string;
};

// Helper: pick an option from one of the Radix Select dropdowns by real
// clicks (the trigger opens a portal listbox of role=option).
async function pickOption(page: Page, triggerId: string, optionName: string) {
  await page.click(`#${triggerId}`);
  const option = page.getByRole("option", { name: optionName, exact: true });
  await option.waitFor({ state: "visible", timeout: 5000 });
  await option.click();
  await page
    .getByRole("listbox")
    .waitFor({ state: "hidden", timeout: 5000 })
    .catch(() => {});
}

// Helper: load /letters fresh and wait for the unfiltered list.
async function loadLetters(page: Page, guard: PageGuard, fullCount: number) {
  await page.goto(`${BASE_URL}/letters`, { waitUntil: "networkidle" });
  guard.assertPageLoaded();
  await guard.guarded(
    page.waitForFunction(
      (full) => {
        const m = /(\d+) letters/.exec(document.body.innerText);
        return !!m && Number(m[1]) === Number(full);
      },
      fullCount,
      { timeout: 30000 },
    ),
  );
  await page.waitForTimeout(300);
}

// Helper: type the search term with real keystrokes (the box is
// debounced) and wait for the URL + count line to reflect the filters.
async function seedStale(
  page: Page,
  fullCount: number,
  opts: { sender?: string; topic?: string },
) {
  const searchBox = page.locator('input[placeholder^="Search the letters"]');
  await searchBox.click();
  await searchBox.pressSequentially(SEARCH_TERM, { delay: 40 });
  if (opts.sender) await pickOption(page, "sender", opts.sender);
  if (opts.topic) await pickOption(page, "topic", opts.topic);
  const seeded = await page
    .waitForFunction(
      ([q, sender, topic, full]) => {
        const sp = new URLSearchParams(window.location.search);
        const m = /(\d+) letters/.exec(document.body.innerText);
        return (
          sp.get("q") === q &&
          (!sender || sp.get("sender") === sender) &&
          (!topic || sp.get("topic") === topic) &&
          !!m &&
          Number(m[1]) > 0 &&
          Number(m[1]) < Number(full)
        );
      },
      [
        SEARCH_TERM,
        opts.sender ?? "",
        opts.topic ?? "",
        String(fullCount),
      ] as const,
      { timeout: 15000 },
    )
    .then(
      () => true,
      () => false,
    );
  const search = await page.evaluate(() => window.location.search);
  check(
    `stale filters active: ?q=${SEARCH_TERM}${opts.sender ? `&sender=${opts.sender}` : ""}${opts.topic ? `&topic=${opts.topic}` : ""} narrows the list`,
    seeded,
    `search=${search}`,
  );
  await page.waitForTimeout(300);
  return page.evaluate(
    () => Number(/(\d+) letters/.exec(document.body.innerText)?.[1] ?? 0),
  );
}

// Helper: read the badge anchors of a given kind on the rendered cards,
// returning the decoded param value of each.
function readBadges(page: Page, param: string) {
  return page.evaluate((p) => {
    const prefix = `/letters?${p}=`;
    return Array.from(document.querySelectorAll("a"))
      .filter((a) => (a.getAttribute("href") ?? "").startsWith(prefix))
      .map((a) => {
        const href = a.getAttribute("href") ?? "";
        return new URLSearchParams(href.slice(href.indexOf("?"))).get(p) ?? "";
      });
  }, param);
}

// Helper: click the first badge anchor of a kind whose param value
// matches, via a bubbling MouseEvent (wouter handles the same-page
// navigation in place).
function clickBadge(page: Page, param: string, value: string) {
  return page.evaluate(
    ([p, v]) => {
      const prefix = `/letters?${p}=`;
      const a = Array.from(document.querySelectorAll("a")).find((el) => {
        const href = el.getAttribute("href") ?? "";
        return (
          href.startsWith(prefix) &&
          new URLSearchParams(href.slice(href.indexOf("?"))).get(p) === v
        );
      });
      if (!a) return false;
      a.dispatchEvent(
        new MouseEvent("click", { bubbles: true, cancelable: true }),
      );
      return true;
    },
    [param, value] as const,
  );
}

// Helper: assert the URL settles on EXACTLY the given persistent params
// (and nothing else — no ?q=, no transient ?verdict=/?from= leftovers).
async function expectUrlOnly(page: Page, expected: Record<string, string>) {
  const ok = await page
    .waitForFunction(
      (exp) => {
        const sp = new URLSearchParams(window.location.search);
        const keys = Array.from(sp.keys());
        return (
          window.location.pathname === "/letters" &&
          keys.length === Object.keys(exp).length &&
          Object.entries(exp).every(([k, v]) => sp.get(k) === v)
        );
      },
      expected,
      { timeout: 10000 },
    )
    .then(
      () => true,
      () => false,
    );
  const search = await page.evaluate(() => window.location.search);
  check(
    `URL carries only ${Object.entries(expected)
      .map(([k, v]) => `?${k}=${v}`)
      .join("&")} (all other params dropped)`,
    ok,
    `search=${search}`,
  );
}

// Helper: wait for the count line to equal the expected total.
async function expectCount(
  page: Page,
  label: string,
  total: number,
  staleSlice: number,
) {
  const ok = await page
    .waitForFunction(
      (t) => {
        const m = /(\d+) letters/.exec(document.body.innerText);
        return !!m && Number(m[1]) === Number(t);
      },
      total,
      { timeout: 15000 },
    )
    .then(
      () => true,
      () => false,
    );
  const now = await page.evaluate(
    () => /(\d+) letters/.exec(document.body.innerText)?.[1] ?? "?",
  );
  check(
    `${label}: list shows ALL ${total} letters (wider than the stale slice of ${staleSlice})`,
    ok && total > staleSlice,
    `count=${now}`,
  );
  check(
    "no 'No letters match' dead end after the badge click",
    await page.evaluate(
      () => !document.body.innerText.includes("No letters match"),
    ),
  );
}

const searchBoxValue = (page: Page) =>
  page.evaluate(
    () =>
      document.querySelector<HTMLInputElement>(
        'input[placeholder^="Search the letters"]',
      )?.value ?? "MISSING",
  );

async function main() {
  // Positive control: the API itself must have letters for the seeded
  // slices, or the scenarios are vacuous.
  const all = (await (
    await fetch(`${BASE_URL}/api/epistles`)
  ).json()) as Epistle[];
  check(
    "API positive control: the epistles corpus is non-empty",
    all.length > 0,
    `count=${all.length}`,
  );
  const countBy = (f: (e: Epistle) => string) => {
    const m = new Map<string, number>();
    for (const e of all) m.set(f(e), (m.get(f(e)) ?? 0) + 1);
    return m;
  };
  const topicCounts = countBy((e) => e.topic);
  const verdictCounts = countBy((e) => e.authenticity);
  const senderCounts = countBy((e) => e.sender);

  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({
      viewport: { width: 1280, height: 720 },
    });
    // Fail fast with the failing URL/status instead of an opaque selector
    // timeout when the site itself fails to boot.
    const guard = attachPageGuard(page);

    // ── Scenario 1: topic badge clears stale q + sender ──
    console.log(
      "Scenario 1: a topic badge click clears a stale search term and sender filter",
    );
    await loadLetters(page, guard, all.length);
    const slice1 = await seedStale(page, all.length, { sender: SENDER });
    const topicBadges = await readBadges(page, "topic");
    const topic = topicBadges[0];
    check(
      "a topic badge exists on the q+sender-filtered cards",
      !!topic,
      `badges=${topicBadges.join(",")}`,
    );
    if (topic) {
      const topicTotal = topicCounts.get(topic) ?? 0;
      check(
        `API positive control: topic "${topic}" has more letters (${topicTotal}) than the stale slice (${slice1})`,
        topicTotal > slice1,
      );
      check(`topic badge ("${topic}") clicked`, await clickBadge(page, "topic", topic));
      await expectUrlOnly(page, { topic });
      // Controls must visibly reset: empty search box, From back on
      // "All senders", Topic trigger on the clicked topic.
      const controlsOk = await page
        .waitForFunction(
          (t) =>
            (
              document.querySelector<HTMLInputElement>(
                'input[placeholder^="Search the letters"]',
              )?.value ?? "x"
            ).trim() === "" &&
            (document.getElementById("sender")?.textContent ?? "").trim() ===
              "All senders" &&
            (document.getElementById("topic")?.textContent ?? "")
              .trim()
              .toLowerCase() === t.toLowerCase(),
          topic,
          { timeout: 10000 },
        )
        .then(
          () => true,
          () => false,
        );
      check(
        "search box empties, From resets to 'All senders', Topic trigger shows the topic",
        controlsOk,
        `q=${JSON.stringify(await searchBoxValue(page))} sender=${(await page.evaluate(() => document.getElementById("sender")?.textContent))?.trim()} topic=${(await page.evaluate(() => document.getElementById("topic")?.textContent))?.trim()}`,
      );
      await expectCount(page, `topic "${topic}"`, topicTotal, slice1);
      check(
        "every rendered card's topic badge shows the clicked topic",
        (await readBadges(page, "topic")).every((t) => t === topic),
      );
      check(
        "another sender's card appears (sender filter really dropped)",
        (await readBadges(page, "from")).some((s) => s !== SENDER),
      );
    }

    // ── Scenario 2: verdict badge (transient ?verdict= → ?authenticity=) ──
    console.log(
      "Scenario 2: a verdict badge click absorbs ?verdict= as ?authenticity= and clears stale q + sender",
    );
    await loadLetters(page, guard, all.length);
    const slice2 = await seedStale(page, all.length, { sender: SENDER });
    const verdictBadges = await readBadges(page, "verdict");
    const verdict = verdictBadges[0];
    check(
      "a verdict badge exists on the q+sender-filtered cards",
      !!verdict,
      `badges=${verdictBadges.join(",")}`,
    );
    if (verdict) {
      const verdictTotal = verdictCounts.get(verdict) ?? 0;
      check(
        `API positive control: verdict "${verdict}" has more letters (${verdictTotal}) than the stale slice (${slice2})`,
        verdictTotal > slice2,
      );
      check(
        `verdict badge ("${verdict}") clicked`,
        await clickBadge(page, "verdict", verdict),
      );
      // The transient ?verdict= must be absorbed: the settled URL names
      // the persistent ?authenticity= param and nothing else.
      await expectUrlOnly(page, { authenticity: verdict });
      const chipOk = await page
        .waitForFunction(
          (v) => {
            const chips = Array.from(
              document.querySelectorAll<HTMLButtonElement>(
                '[aria-label="Filter by authenticity"] button',
              ),
            );
            return chips.some(
              (b) =>
                (b.textContent ?? "").trim().toLowerCase() === v &&
                b.dataset.active === "true",
            );
          },
          verdict,
          { timeout: 10000 },
        )
        .then(
          () => true,
          () => false,
        );
      check(`the "${verdict}" authenticity chip is active`, chipOk);
      check(
        "search box empties and From resets to 'All senders'",
        (await searchBoxValue(page)).trim() === "" &&
          (await page.evaluate(() =>
            (document.getElementById("sender")?.textContent ?? "").trim(),
          )) === "All senders",
      );
      await expectCount(page, `verdict "${verdict}"`, verdictTotal, slice2);
      check(
        "another sender's card appears (sender filter really dropped)",
        (await readBadges(page, "from")).some((s) => s !== SENDER),
      );
    }

    // ── Scenario 3: sender badge (transient ?from= → ?sender=) ──
    console.log(
      "Scenario 3: a sender badge click absorbs ?from= as ?sender= and clears stale q + topic",
    );
    await loadLetters(page, guard, all.length);
    // Seed q + a topic picked from the dropdown. "politics" is the
    // corpus's largest topic and intersects the search term through
    // Solon's civic letters, so the q+topic slice is reliably non-empty.
    const slice3 = await seedStale(page, all.length, { topic: "politics" });
    const fromBadges = await readBadges(page, "from");
    // Pick a sender whose corpus-wide letter count exceeds their cards in
    // the slice, so the widening is provable.
    const inSlice = new Map<string, number>();
    for (const s of fromBadges) inSlice.set(s, (inSlice.get(s) ?? 0) + 1);
    const fromSender = fromBadges.find(
      (s) => (senderCounts.get(s) ?? 0) > (inSlice.get(s) ?? 0),
    );
    check(
      "a sender badge with a wider corpus-wide set exists on the filtered cards",
      !!fromSender,
      `badges=${fromBadges.join(",")}`,
    );
    if (fromSender) {
      const senderTotal = senderCounts.get(fromSender) ?? 0;
      check(
        `sender badge ("${fromSender}") clicked`,
        await clickBadge(page, "from", fromSender),
      );
      // The transient ?from= must be absorbed as the persistent ?sender=.
      await expectUrlOnly(page, { sender: fromSender });
      const fromControlsOk = await page
        .waitForFunction(
          (s) =>
            (
              document.querySelector<HTMLInputElement>(
                'input[placeholder^="Search the letters"]',
              )?.value ?? "x"
            ).trim() === "" &&
            (document.getElementById("sender")?.textContent ?? "").trim() ===
              s &&
            (document.getElementById("topic")?.textContent ?? "").trim() ===
              "All topics",
          fromSender,
          { timeout: 10000 },
        )
        .then(
          () => true,
          () => false,
        );
      check(
        `search box empties, From shows "${fromSender}", Topic resets to 'All topics'`,
        fromControlsOk,
        `q=${JSON.stringify(await searchBoxValue(page))} sender=${(await page.evaluate(() => document.getElementById("sender")?.textContent))?.trim()} topic=${(await page.evaluate(() => document.getElementById("topic")?.textContent))?.trim()}`,
      );
      await expectCount(
        page,
        `sender "${fromSender}"`,
        senderTotal,
        inSlice.get(fromSender) ?? 0,
      );
      check(
        "every rendered card's sender badge shows the clicked sender",
        (await readBadges(page, "from")).every((s) => s === fromSender),
      );
    }
  } finally {
    await browser.close();
  }
}

await main();
if (failures > 0) {
  console.error(`\n${failures} check(s) failed`);
  process.exit(1);
}
console.log("\nAll letters badge checks passed");
