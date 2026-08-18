/// <reference lib="dom" />
// The in-page callbacks (page.evaluate / waitForFunction) run in the
// browser, so this Node-side script needs the DOM lib for their types.
//
// Real-browser check of the About page's Assertion-model diagram cards
// (assertion-model-diagram.tsx): the linked concept cards (Anecdote, Doxa,
// Letter, Testament, Philosopher) are SVG <g role="link"> zones that navigate
// on click and on Enter; non-linked cards (e.g. Topic) are role="group" and
// must NOT navigate. Hover/focus highlighting dims unrelated cards. A wouter
// or SVG event-wiring change could break any of these while typecheck stays
// green, so this drives headless Chromium against the running dev servers:
//
// 1. Clicking the Anecdote card on /about lands on /anecdotes.
// 2. Enter on a focused Doxa card lands on /doxography.
// 3. Clicking the non-linked Topic card stays on /about.
// 4. Hovering the Assertion card dims an unrelated card (Birth drops to
//    opacity-20) while a related card (Person) stays fully visible.
//
// Clicks are dispatched via page.evaluate (bubbling MouseEvent) so SVG
// hit-testing quirks cannot mask a wiring regression; the Enter check uses a
// real trusted keypress on the focused zone.
//
// Requirements: the API server and web workflows must be running (the script
// talks to the shared proxy, default http://localhost:80), and a Chromium
// headless shell must be installed for playwright-core, e.g.:
//   PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright \
//     node scripts/node_modules/playwright-core/cli.js install chromium-headless-shell

// playwright-core resolves its browser registry at module import time from
// PLAYWRIGHT_BROWSERS_PATH (default: $XDG_CACHE_HOME/ms-playwright, which in
// this environment points inside the workspace and holds no browsers). Set
// the env var BEFORE importing playwright-core.
import "./lib/playwright-browsers-path";

const { chromium } = await import("playwright-core");
const { attachPageGuard } = await import("./lib/e2e-page-guard");

const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:80";

let failures = 0;
function check(label: string, ok: boolean, detail?: string) {
  if (ok) {
    console.log(`  ok: ${label}`);
  } else {
    failures++;
    console.error(`  FAIL: ${label}${detail ? ` (${detail})` : ""}`);
  }
}

// The card zones are <g> elements whose aria-label starts with the card
// title exactly as in the data ("<Anecdote>", "<Assertion>"), optionally
// followed by ", with N rows" and/or ", opens the ... page"; plain cards
// like "<Topic>" have no suffix at all. Row zones use "name : Type" labels,
// so the "<Title>" prefix uniquely selects the card zone.
const cardZone = (title: string) => `svg g[aria-label^="<${title}>"]`;

async function main() {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({
      viewport: { width: 1280, height: 900 },
    });
    const guard = attachPageGuard(page);

    // Dispatch a real bubbling click on the first element matching the
    // selector, independent of SVG pointer hit-testing.
    const dispatchClick = (selector: string) =>
      page.evaluate((sel) => {
        const el = document.querySelector(sel);
        if (!el) throw new Error(`no element matches ${sel}`);
        el.dispatchEvent(
          new MouseEvent("click", {
            bubbles: true,
            cancelable: true,
            view: window,
          }),
        );
      }, selector);

    console.log("Scenario 1: clicking the Anecdote card opens /anecdotes");
    await page.goto(`${BASE_URL}/about`, { waitUntil: "networkidle" });
    guard.assertPageLoaded();
    const anecdoteZone = await guard.guarded(
      page.waitForSelector(cardZone("Anecdote"), {
        timeout: 15000,
      }),
    );
    check(
      "Anecdote card zone is role=link",
      (await anecdoteZone.getAttribute("role")) === "link",
    );
    await dispatchClick(cardZone("Anecdote"));
    await page.waitForFunction(
      () => window.location.pathname === "/anecdotes",
      undefined,
      { timeout: 5000 },
    );
    check("URL is /anecdotes", true);
    const anecdotesRendered = await page
      .waitForSelector("h1, h2", { timeout: 10000 })
      .then(() => true)
      .catch(() => false);
    check("Anecdotes page content rendered", anecdotesRendered);

    console.log("Scenario 2: Enter on a focused Doxa card opens /doxography");
    await page.goto(`${BASE_URL}/about`, { waitUntil: "networkidle" });
    guard.assertPageLoaded();
    await guard.guarded(
      page.waitForSelector(cardZone("Doxa"), { timeout: 15000 }),
    );
    // Focus the zone (tabIndex=0), then send a real trusted keypress so the
    // React onKeyDown handler sees exactly what a keyboard user produces.
    await page.evaluate((sel) => {
      const el = document.querySelector(sel) as SVGElement | null;
      if (!el) throw new Error(`no element matches ${sel}`);
      (el as unknown as HTMLElement).focus();
    }, cardZone("Doxa"));
    const focusedLabel = await page.evaluate(() =>
      document.activeElement?.getAttribute("aria-label"),
    );
    check(
      "Doxa card zone took focus",
      !!focusedLabel && focusedLabel.startsWith("<Doxa>"),
      `activeElement label=${JSON.stringify(focusedLabel)}`,
    );
    await page.keyboard.press("Enter");
    await page.waitForFunction(
      () => window.location.pathname === "/doxography",
      undefined,
      { timeout: 5000 },
    );
    check("URL is /doxography", true);

    console.log("Scenario 3: clicking the non-linked Topic card stays put");
    await page.goto(`${BASE_URL}/about`, { waitUntil: "networkidle" });
    guard.assertPageLoaded();
    const topicZone = await guard.guarded(
      page.waitForSelector(cardZone("Topic"), {
        timeout: 15000,
      }),
    );
    check(
      "Topic card zone is role=group (not a link)",
      (await topicZone.getAttribute("role")) === "group",
    );
    await dispatchClick(cardZone("Topic"));
    await page.waitForTimeout(500);
    const afterTopic = await page.evaluate(() => window.location.pathname);
    check(
      "still on /about after Topic click",
      afterTopic === "/about",
      `pathname=${afterTopic}`,
    );

    console.log("Scenario 4: hovering Assertion dims unrelated cards only");
    // Real mouse move onto the Assertion card's header strip (the top ~28px
    // of the zone rect is the header; lower rows are separate zones).
    // Real mouse events only land inside the viewport, so bring the diagram
    // on screen before measuring the hover target's box.
    await page.locator(cardZone("Assertion")).scrollIntoViewIfNeeded();
    const assertionBox = await page
      .locator(cardZone("Assertion"))
      .boundingBox();
    check("Assertion card zone has a bounding box", !!assertionBox);
    if (assertionBox) {
      await page.mouse.move(
        assertionBox.x + assertionBox.width / 2,
        assertionBox.y + 12,
      );
      // opacity classes flip synchronously; the 150ms transition only
      // animates the computed value, so wait past it before measuring.
      await page.waitForTimeout(400);
      // No helper functions inside evaluate: tsx's esbuild transform wraps
      // named locals with a __name helper that doesn't exist in the page.
      const hoverState = await page.evaluate(() => {
        const result: Record<
          string,
          { className: string; opacity: string } | null
        > = {};
        for (const title of ["Birth", "Person"]) {
          const zone = document.querySelector(
            `svg g[aria-label^="<${title}>"]`,
          );
          const outer = zone?.closest("g.transition-opacity");
          result[title.toLowerCase()] = outer
            ? {
                className: outer.getAttribute("class") ?? "",
                opacity: getComputedStyle(outer).opacity,
              }
            : null;
        }
        return result;
      });
      check(
        "unrelated Birth card is dimmed (opacity-20)",
        !!hoverState.birth &&
          hoverState.birth.className.includes("opacity-20") &&
          Number(hoverState.birth.opacity) < 0.5,
        JSON.stringify(hoverState.birth),
      );
      check(
        "related Person card stays fully visible",
        !!hoverState.person &&
          hoverState.person.className.includes("opacity-100") &&
          Number(hoverState.person.opacity) > 0.9,
        JSON.stringify(hoverState.person),
      );
      // Move away and confirm the dimming clears.
      await page.mouse.move(5, 5);
      await page.waitForTimeout(400);
      const afterLeave = await page.evaluate(() => {
        const zone = document.querySelector('svg g[aria-label^="<Birth>"]');
        const outer = zone?.closest("g.transition-opacity");
        return outer?.getAttribute("class") ?? "";
      });
      check(
        "Birth card undims after the mouse leaves",
        afterLeave.includes("opacity-100"),
        `class=${afterLeave}`,
      );
    }
  } finally {
    await browser.close();
  }

  if (failures > 0) {
    console.error(`\n${failures} check(s) FAILED`);
    process.exit(1);
  }
  console.log("\nAll assertion-diagram e2e checks passed.");
}

await main();
