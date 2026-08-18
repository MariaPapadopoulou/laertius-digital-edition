/// <reference lib="dom" />
// The in-page callbacks (page.evaluate / waitForFunction) run in the
// browser, so this Node-side script needs the DOM lib for their types.
//
// Real-browser check of the same-page nav reset (use-reset-on-same-page-nav):
// the source-level validate-nav-reset pins the predicate and wiring, but a
// change to wouter's link handling or the nav markup (e.g. a wrapper element
// swallowing clicks) could break the behavior while those pins stay green.
// This script drives headless Chromium against the running dev servers:
//
// 1. On /anecdotes with a keyword filter set and the page scrolled down,
//    clicking the active "Anecdotes" nav link must reset the page: search
//    box cleared, q= dropped from the URL, scrolled back to top.
// 2. Clicking a query-string same-page link (a card's "with X" badge,
//    /anecdotes?involves=X) must NOT reset: the keyword filter survives and
//    the involves filter is applied in place. Scenario 5 repeats this at a
//    390x844 phone viewport so a mobile-only card layout change can't break
//    the in-place filter flow while the desktop check stays green.
// 3. Scenarios 6 and 7 repeat the non-reset check on a second collection
//    page: a verse card's "by <poet>" badge (/verses?author=X) must keep
//    the keyword filter and apply the poet filter in place, at both the
//    desktop and the phone viewport.
// 4. Scenarios 8 and 9 repeat the non-reset check on a third collection
//    page: a doxa card's domain badge (/doxography?domain=X) must keep
//    the keyword filter and apply the domain filter in place, at both the
//    desktop and the phone viewport.
// 5. Scenarios 10 and 11 repeat the non-reset check on a fourth collection
//    page: a saying card's topic badge (/sayings?topic=X) must keep the
//    keyword filter and apply the topic filter in place, at both the
//    desktop and the phone viewport.
//
// Clicks are dispatched via page.evaluate (bubbling MouseEvent) instead of
// Playwright's click(), which auto-scrolls the target into view first and
// would corrupt the scroll-position assertion.
//
// Requirements: the API server and web workflows must be running (the script
// talks to the shared proxy, default http://localhost:80), and a Chromium
// headless shell must be installed for playwright-core, e.g.:
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
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({
      viewport: { width: 1280, height: 720 },
    });
    // Fail fast with the failing URL/status instead of an opaque selector
    // timeout when the site itself fails to boot.
    const guard = attachPageGuard(page);

    const searchBox = 'input[placeholder^="Search the anecdotes"]';
    const navLink = 'nav a[href="/anecdotes"]';

    // Dispatch a real bubbling click on the first element matching the
    // selector WITHOUT Playwright's scroll-into-view side effect.
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

    console.log("Scenario 1: active nav link click resets the page");
    await page.goto(`${BASE_URL}/anecdotes`, { waitUntil: "networkidle" });
    guard.assertPageLoaded();
    await guard.guarded(page.waitForSelector(searchBox));
    await page.fill(searchBox, "dog");
    // Wait for the debounced filter to reach the URL.
    await page.waitForFunction(
      () => new URLSearchParams(window.location.search).get("q") === "dog",
      undefined,
      { timeout: 5000 },
    );
    await page.waitForLoadState("networkidle");
    // Make sure the page is tall enough to scroll before scrolling down,
    // so the "back to top" assertion is meaningful.
    await page.waitForFunction(
      () => document.body.scrollHeight > window.innerHeight + 200,
      undefined,
      { timeout: 10000 },
    );
    await page.evaluate(() => window.scrollTo(0, 600));
    await page.waitForFunction(() => window.scrollY > 0, undefined, {
      timeout: 5000,
    });

    await dispatchClick(navLink);
    // The reset is synchronous state, but give React a paint — and the
    // scroll-to-top may animate for a few frames, so wait for it to settle.
    await page.waitForTimeout(300);
    await page
      .waitForFunction(() => window.scrollY === 0, undefined, { timeout: 3000 })
      .catch(() => {});

    const afterReset = await page.evaluate((sel) => {
      const input = document.querySelector(sel) as HTMLInputElement | null;
      return {
        inputValue: input?.value ?? null,
        search: window.location.search,
        pathname: window.location.pathname,
        scrollY: window.scrollY,
      };
    }, searchBox);
    check(
      "search box is cleared",
      afterReset.inputValue === "",
      `value=${JSON.stringify(afterReset.inputValue)}`,
    );
    check(
      "q= is dropped from the URL",
      !afterReset.search.includes("q="),
      `search=${afterReset.search}`,
    );
    check("still on /anecdotes", afterReset.pathname === "/anecdotes");
    check(
      "page is scrolled back to top",
      afterReset.scrollY === 0,
      `scrollY=${afterReset.scrollY}`,
    );

    console.log(
      "Scenario 2: query-string same-page link (with-X badge) applies in place",
    );
    await page.goto(`${BASE_URL}/anecdotes`, { waitUntil: "networkidle" });
    guard.assertPageLoaded();
    await guard.guarded(page.waitForSelector(searchBox));
    // Pick a keyword guaranteed to keep at least one card with a badge on
    // the page: find the first badge, then filter by a word from its card.
    const badge = await page.waitForSelector(
      'a[href^="/anecdotes?involves="]',
      { timeout: 10000 },
    );
    const badgeHref = await badge.getAttribute("href");
    const involvesName = new URLSearchParams(
      (badgeHref ?? "").split("?")[1] ?? "",
    ).get("involves");
    check("found a with-X badge link", !!involvesName, `href=${badgeHref}`);

    await page.fill(searchBox, "the");
    await page.waitForFunction(
      () => new URLSearchParams(window.location.search).get("q") === "the",
      undefined,
      { timeout: 5000 },
    );
    await page.waitForLoadState("networkidle");

    // The badge may have been filtered out of the current result list;
    // dispatch the click on any badge still present, else re-add one is
    // impossible, so require one to exist (broad keyword "the" keeps most).
    const badgeSelector = 'a[href^="/anecdotes?involves="]';
    // The filtered list re-renders asynchronously; wait for a badge to be
    // back in the DOM rather than checking instantly.
    const badgeStillThere = await page
      .waitForSelector(badgeSelector, { timeout: 10000 })
      .catch(() => null);
    check("a with-X badge survives the keyword filter", !!badgeStillThere);
    const clickedHref = await page.evaluate((sel) => {
      const el = document.querySelector(sel) as HTMLAnchorElement | null;
      if (!el) throw new Error(`no element matches ${sel}`);
      el.dispatchEvent(
        new MouseEvent("click", {
          bubbles: true,
          cancelable: true,
          view: window,
        }),
      );
      return el.getAttribute("href");
    }, badgeSelector);
    const clickedInvolves = new URLSearchParams(
      (clickedHref ?? "").split("?")[1] ?? "",
    ).get("involves");
    await page.waitForFunction(
      (name) =>
        new URLSearchParams(window.location.search).get("involves") === name,
      clickedInvolves,
      { timeout: 5000 },
    );
    await page.waitForTimeout(300);

    const afterBadge = await page.evaluate((sel) => {
      const input = document.querySelector(sel) as HTMLInputElement | null;
      const params = new URLSearchParams(window.location.search);
      return {
        inputValue: input?.value ?? null,
        q: params.get("q"),
        involves: params.get("involves"),
        pathname: window.location.pathname,
      };
    }, searchBox);
    // The badge URL carries ONLY ?involves=, and the anecdotes page
    // intentionally treats missing params as "no filter" (see the
    // in-place-update effect in anecdotes.tsx), so q is dropped — but the
    // navigation happens IN PLACE (no full nav reset, involves applied).
    check(
      "keyword filter is dropped (badge URL carries only involves)",
      afterBadge.inputValue === "" && afterBadge.q === null,
      `value=${JSON.stringify(afterBadge.inputValue)} q=${afterBadge.q}`,
    );
    check(
      "involves filter applied in place",
      afterBadge.involves === clickedInvolves,
      `involves=${afterBadge.involves}`,
    );
    check("still on /anecdotes", afterBadge.pathname === "/anecdotes");

    console.log("Scenario 3: home page logo click resets the Ask page");
    // Home's embedded Ask box (placeholder updated when the hero copy changed).
    const askBox = 'input[placeholder^="e.g. What did Diogenes"]';
    // The logo is the header link to "/" OUTSIDE the nav; the "Ask" nav
    // link shares the href, so exclude nav descendants explicitly.
    const logoLink = 'header a[href="/"]:not(nav a)';
    await page.goto(`${BASE_URL}/`, { waitUntil: "networkidle" });
    guard.assertPageLoaded();
    await guard.guarded(page.waitForSelector(askBox));
    await page.fill(askBox, "What does Epicurus say about friendship?");
    // Submit the question so the page grows tall enough to scroll and the
    // reset has real state (submitted answer + typed query) to clear.
    await page.click('form button[type="submit"]');
    await page.waitForFunction(
      () => document.body.scrollHeight > window.innerHeight + 200,
      undefined,
      { timeout: 60000 },
    );
    await page.waitForLoadState("networkidle");
    await page.evaluate(() => window.scrollTo(0, 600));
    await page.waitForFunction(() => window.scrollY > 0, undefined, {
      timeout: 5000,
    });

    const logoExists = await page.$(logoLink);
    check("header logo link found outside the nav", !!logoExists);
    await dispatchClick(logoLink);
    await page.waitForTimeout(300);
    await page
      .waitForFunction(() => window.scrollY === 0, undefined, { timeout: 3000 })
      .catch(() => {});

    const afterLogo = await page.evaluate((sel) => {
      const input = document.querySelector(sel) as HTMLInputElement | null;
      return {
        inputValue: input?.value ?? null,
        pathname: window.location.pathname,
        scrollY: window.scrollY,
      };
    }, askBox);
    check(
      "question input is cleared",
      afterLogo.inputValue === "",
      `value=${JSON.stringify(afterLogo.inputValue)}`,
    );
    check("still on /", afterLogo.pathname === "/");
    check(
      "page is scrolled back to top",
      afterLogo.scrollY === 0,
      `scrollY=${afterLogo.scrollY}`,
    );

    console.log(
      "Scenario 4: mobile nav strip's active link click resets the page",
    );
    // The phone layout hides the desktop header nav (hidden md:flex) and
    // shows a separate md:hidden link strip below the header. Its links
    // are NOT inside a <nav>, so the desktop selector cannot match them.
    const mobilePage = await browser.newPage({
      viewport: { width: 390, height: 844 },
    });
    const guardMobile = attachPageGuard(mobilePage);
    // Pick the guard belonging to a given page handle (the shared scenario
    // loops below drive either `page` or `mobilePage` through the same code).
    const guardFor = (p: Page): PageGuard =>
      p === mobilePage ? guardMobile : guard;
    try {
      // The mobile nav is now a hamburger menu: open it first, then the
      // group links render inside nav#mobile-nav-menu (within div.md:hidden).
      const mobileNavLink = 'nav#mobile-nav-menu a[href="/anecdotes"]';
      await mobilePage.goto(`${BASE_URL}/anecdotes`, {
        waitUntil: "networkidle",
      });
      guardMobile.assertPageLoaded();
      await guardMobile.guarded(mobilePage.waitForSelector(searchBox));
      await mobilePage.click('[data-testid="mobile-menu-toggle"]');
      await guardMobile.guarded(mobilePage.waitForSelector(mobileNavLink));

      // No helper functions inside evaluate: tsx's esbuild transform wraps
      // named locals with a __name helper that doesn't exist in the page.
      const navVisibility = await mobilePage.evaluate((sel) => {
        const mobileEl = document.querySelector(sel) as HTMLElement | null;
        const desktopEl = document.querySelector(
          "header nav",
        ) as HTMLElement | null;
        return {
          mobileLinkVisible: !!mobileEl && mobileEl.offsetParent !== null,
          desktopNavVisible: !!desktopEl && desktopEl.offsetParent !== null,
        };
      }, mobileNavLink);
      check(
        "mobile nav link is visible at 390px",
        navVisibility.mobileLinkVisible,
      );
      check(
        "desktop header nav is hidden at 390px",
        !navVisibility.desktopNavVisible,
      );

      await mobilePage.fill(searchBox, "dog");
      await mobilePage.waitForFunction(
        () => new URLSearchParams(window.location.search).get("q") === "dog",
        undefined,
        { timeout: 5000 },
      );
      await mobilePage.waitForLoadState("networkidle");
      await mobilePage.waitForFunction(
        () => document.body.scrollHeight > window.innerHeight + 200,
        undefined,
        { timeout: 10000 },
      );
      await mobilePage.evaluate(() => window.scrollTo(0, 600));
      await mobilePage.waitForFunction(() => window.scrollY > 0, undefined, {
        timeout: 5000,
      });

      await mobilePage.evaluate((sel) => {
        const el = document.querySelector(sel);
        if (!el) throw new Error(`no element matches ${sel}`);
        el.dispatchEvent(
          new MouseEvent("click", {
            bubbles: true,
            cancelable: true,
            view: window,
          }),
        );
      }, mobileNavLink);
      await mobilePage.waitForTimeout(300);
      await mobilePage
        .waitForFunction(() => window.scrollY === 0, undefined, { timeout: 3000 })
        .catch(() => {});

      const afterMobileReset = await mobilePage.evaluate((sel) => {
        const input = document.querySelector(sel) as HTMLInputElement | null;
        return {
          inputValue: input?.value ?? null,
          search: window.location.search,
          pathname: window.location.pathname,
          scrollY: window.scrollY,
        };
      }, searchBox);
      check(
        "mobile: search box is cleared",
        afterMobileReset.inputValue === "",
        `value=${JSON.stringify(afterMobileReset.inputValue)}`,
      );
      check(
        "mobile: q= is dropped from the URL",
        !afterMobileReset.search.includes("q="),
        `search=${afterMobileReset.search}`,
      );
      check(
        "mobile: still on /anecdotes",
        afterMobileReset.pathname === "/anecdotes",
      );
      check(
        "mobile: page is scrolled back to top",
        afterMobileReset.scrollY === 0,
        `scrollY=${afterMobileReset.scrollY}`,
      );
      console.log(
        "Scenario 5: mobile with-X badge click does NOT reset filters",
      );
      await mobilePage.goto(`${BASE_URL}/anecdotes`, {
        waitUntil: "networkidle",
      });
      guardMobile.assertPageLoaded();
      await guardMobile.guarded(mobilePage.waitForSelector(searchBox));
      const mobileBadgeSelector = 'a[href^="/anecdotes?involves="]';
      const mobileBadge = await mobilePage
        .waitForSelector(mobileBadgeSelector, { timeout: 10000 })
        .catch(() => null);
      check("mobile: found a with-X badge link", !!mobileBadge);

      await mobilePage.fill(searchBox, "the");
      await mobilePage.waitForFunction(
        () => new URLSearchParams(window.location.search).get("q") === "the",
        undefined,
        { timeout: 5000 },
      );
      await mobilePage.waitForLoadState("networkidle");

      const mobileBadgeStillThere = await mobilePage
        .waitForSelector(mobileBadgeSelector, { timeout: 10000 })
        .catch(() => null);
      check(
        "mobile: a with-X badge survives the keyword filter",
        !!mobileBadgeStillThere,
      );
      const mobileClickedHref = await mobilePage.evaluate((sel) => {
        const el = document.querySelector(sel) as HTMLAnchorElement | null;
        if (!el) throw new Error(`no element matches ${sel}`);
        el.dispatchEvent(
          new MouseEvent("click", {
            bubbles: true,
            cancelable: true,
            view: window,
          }),
        );
        return el.getAttribute("href");
      }, mobileBadgeSelector);
      const mobileClickedInvolves = new URLSearchParams(
        (mobileClickedHref ?? "").split("?")[1] ?? "",
      ).get("involves");
      await mobilePage.waitForFunction(
        (name) =>
          new URLSearchParams(window.location.search).get("involves") === name,
        mobileClickedInvolves,
        { timeout: 5000 },
      );
      await mobilePage.waitForTimeout(300);

      const afterMobileBadge = await mobilePage.evaluate((sel) => {
        const input = document.querySelector(sel) as HTMLInputElement | null;
        const params = new URLSearchParams(window.location.search);
        return {
          inputValue: input?.value ?? null,
          q: params.get("q"),
          involves: params.get("involves"),
          pathname: window.location.pathname,
        };
      }, searchBox);
      // Same as scenario 2: badge URLs carry only ?involves=, so the
      // keyword filter is intentionally dropped while the involves filter
      // applies in place.
      check(
        "mobile: keyword filter is dropped (badge URL carries only involves)",
        afterMobileBadge.inputValue === "" && afterMobileBadge.q === null,
        `value=${JSON.stringify(afterMobileBadge.inputValue)} q=${afterMobileBadge.q}`,
      );
      check(
        "mobile: involves filter applied in place",
        afterMobileBadge.involves === mobileClickedInvolves,
        `involves=${afterMobileBadge.involves}`,
      );
      check(
        "mobile: still on /anecdotes",
        afterMobileBadge.pathname === "/anecdotes",
      );

      // Scenarios 6 and 7 extend the non-reset coverage to a second
      // collection page: on /verses, a card's "by <poet>" badge is a
      // query-string same-page link (/verses?author=X) and must apply the
      // poet filter in place while the keyword filter survives. Run at
      // both the desktop and the 390x844 phone viewport, mirroring
      // Scenarios 2 and 5, so a verses-only layout or link change can't
      // wipe a reader's filters while the anecdotes checks stay green.
      const verseSearchBox = 'input[placeholder^="Search the verses"]';
      const verseBadgeSelector = 'a[href^="/verses?author="]';

      for (const [label, p] of [
        ["Scenario 6: desktop", page],
        ["Scenario 7: mobile", mobilePage],
      ] as const) {
        console.log(
          `${label}: verses "by <poet>" badge click does NOT reset filters`,
        );
        await p.goto(`${BASE_URL}/verses`, { waitUntil: "networkidle" });
        guardFor(p).assertPageLoaded();
        await guardFor(p).guarded(p.waitForSelector(verseSearchBox));
        const verseBadge = await p
          .waitForSelector(verseBadgeSelector, { timeout: 10000 })
          .catch(() => null);
        check(`${label}: found a by-poet badge link`, !!verseBadge);

        await p.fill(verseSearchBox, "the");
        await p.waitForFunction(
          () => new URLSearchParams(window.location.search).get("q") === "the",
          undefined,
          { timeout: 5000 },
        );
        await p.waitForLoadState("networkidle");

        const verseBadgeStillThere = await p
          .waitForSelector(verseBadgeSelector, { timeout: 10000 })
          .catch(() => null);
        check(
          `${label}: a by-poet badge survives the keyword filter`,
          !!verseBadgeStillThere,
        );
        const verseClickedHref = await p.evaluate((sel) => {
          const el = document.querySelector(sel) as HTMLAnchorElement | null;
          if (!el) throw new Error(`no element matches ${sel}`);
          el.dispatchEvent(
            new MouseEvent("click", {
              bubbles: true,
              cancelable: true,
              view: window,
            }),
          );
          return el.getAttribute("href");
        }, verseBadgeSelector);
        const verseClickedAuthor = new URLSearchParams(
          (verseClickedHref ?? "").split("?")[1] ?? "",
        ).get("author");
        await p.waitForFunction(
          (name) =>
            new URLSearchParams(window.location.search).get("author") === name,
          verseClickedAuthor,
          { timeout: 5000 },
        );
        // The URL-sync effect re-adds q= after the badge navigation
        // replaces the search string; wait for it rather than sampling
        // immediately after the author param lands.
        await p.waitForFunction(
          () => new URLSearchParams(window.location.search).get("q") === "the",
          undefined,
          { timeout: 5000 },
        );
        await p.waitForTimeout(300);

        const afterVerseBadge = await p.evaluate((sel) => {
          const input = document.querySelector(sel) as HTMLInputElement | null;
          const params = new URLSearchParams(window.location.search);
          return {
            inputValue: input?.value ?? null,
            q: params.get("q"),
            author: params.get("author"),
            pathname: window.location.pathname,
          };
        }, verseSearchBox);
        check(
          `${label}: keyword filter survives (search box keeps its text)`,
          afterVerseBadge.inputValue === "the",
          `value=${JSON.stringify(afterVerseBadge.inputValue)}`,
        );
        check(
          `${label}: q= stays in the URL`,
          afterVerseBadge.q === "the",
          `q=${afterVerseBadge.q}`,
        );
        check(
          `${label}: poet filter applied in place`,
          afterVerseBadge.author === verseClickedAuthor,
          `author=${afterVerseBadge.author}`,
        );
        check(
          `${label}: still on /verses`,
          afterVerseBadge.pathname === "/verses",
        );
      }

      // Scenarios 8 and 9 extend the non-reset coverage to a third
      // collection page: on /doxography, a card's domain badge is a
      // query-string same-page link (/doxography?domain=X) and must apply
      // the domain filter in place while the keyword filter survives. Run
      // at both the desktop and the 390x844 phone viewport, mirroring
      // Scenarios 6 and 7, so a doxai-only layout or link change can't
      // wipe a reader's filters while the other checks stay green.
      const doxaSearchBox = 'input[placeholder^="Search the doctrines"]';
      const doxaBadgeSelector = 'a[href^="/doxography?domain="]';

      for (const [label, p] of [
        ["Scenario 8: desktop", page],
        ["Scenario 9: mobile", mobilePage],
      ] as const) {
        console.log(
          `${label}: doxai domain badge click does NOT reset filters`,
        );
        await p.goto(`${BASE_URL}/doxography`, { waitUntil: "networkidle" });
        guardFor(p).assertPageLoaded();
        await guardFor(p).guarded(p.waitForSelector(doxaSearchBox));
        const doxaBadge = await p
          .waitForSelector(doxaBadgeSelector, { timeout: 10000 })
          .catch(() => null);
        check(`${label}: found a domain badge link`, !!doxaBadge);

        await p.fill(doxaSearchBox, "the");
        await p.waitForFunction(
          () => new URLSearchParams(window.location.search).get("q") === "the",
          undefined,
          { timeout: 5000 },
        );
        await p.waitForLoadState("networkidle");

        const doxaBadgeStillThere = await p
          .waitForSelector(doxaBadgeSelector, { timeout: 10000 })
          .catch(() => null);
        check(
          `${label}: a domain badge survives the keyword filter`,
          !!doxaBadgeStillThere,
        );
        const doxaClickedHref = await p.evaluate((sel) => {
          const el = document.querySelector(sel) as HTMLAnchorElement | null;
          if (!el) throw new Error(`no element matches ${sel}`);
          el.dispatchEvent(
            new MouseEvent("click", {
              bubbles: true,
              cancelable: true,
              view: window,
            }),
          );
          return el.getAttribute("href");
        }, doxaBadgeSelector);
        const doxaClickedDomain = new URLSearchParams(
          (doxaClickedHref ?? "").split("?")[1] ?? "",
        ).get("domain");
        await p.waitForFunction(
          (name) =>
            new URLSearchParams(window.location.search).get("domain") === name,
          doxaClickedDomain,
          { timeout: 5000 },
        );
        await p.waitForTimeout(300);

        const afterDoxaBadge = await p.evaluate((sel) => {
          const input = document.querySelector(sel) as HTMLInputElement | null;
          const params = new URLSearchParams(window.location.search);
          return {
            inputValue: input?.value ?? null,
            q: params.get("q"),
            domain: params.get("domain"),
            pathname: window.location.pathname,
          };
        }, doxaSearchBox);
        // The domain badge URL carries ONLY ?domain=, and the doxography
        // page intentionally drops the other filters (see the in-place
        // update effect in doxography.tsx), so q is dropped while the
        // domain filter applies in place.
        check(
          `${label}: keyword filter is dropped (badge URL carries only domain)`,
          afterDoxaBadge.inputValue === "" && afterDoxaBadge.q === null,
          `value=${JSON.stringify(afterDoxaBadge.inputValue)} q=${afterDoxaBadge.q}`,
        );
        check(
          `${label}: domain filter applied in place`,
          afterDoxaBadge.domain === doxaClickedDomain,
          `domain=${afterDoxaBadge.domain}`,
        );
        check(
          `${label}: still on /doxography`,
          afterDoxaBadge.pathname === "/doxography",
        );
      }

      // Scenarios 10 and 11 extend the non-reset coverage to a fourth
      // collection page: on /sayings, a card's topic badge is a
      // query-string same-page link (/sayings?topic=X) and must apply the
      // topic filter in place while the keyword filter survives. Run at
      // both the desktop and the 390x844 phone viewport, mirroring
      // Scenarios 8 and 9, so a sayings-only layout or link change can't
      // wipe a reader's filters while the other checks stay green.
      const sayingSearchBox = 'input[placeholder^="Search the sayings"]';
      const sayingBadgeSelector = 'a[href^="/sayings?topic="]';

      for (const [label, p] of [
        ["Scenario 10: desktop", page],
        ["Scenario 11: mobile", mobilePage],
      ] as const) {
        console.log(
          `${label}: sayings topic badge click does NOT reset filters`,
        );
        await p.goto(`${BASE_URL}/sayings`, { waitUntil: "networkidle" });
        guardFor(p).assertPageLoaded();
        await guardFor(p).guarded(p.waitForSelector(sayingSearchBox));
        const sayingBadge = await p
          .waitForSelector(sayingBadgeSelector, { timeout: 10000 })
          .catch(() => null);
        check(`${label}: found a topic badge link`, !!sayingBadge);

        await p.fill(sayingSearchBox, "the");
        await p.waitForFunction(
          () => new URLSearchParams(window.location.search).get("q") === "the",
          undefined,
          { timeout: 5000 },
        );
        await p.waitForLoadState("networkidle");

        const sayingBadgeStillThere = await p
          .waitForSelector(sayingBadgeSelector, { timeout: 10000 })
          .catch(() => null);
        check(
          `${label}: a topic badge survives the keyword filter`,
          !!sayingBadgeStillThere,
        );
        const sayingClickedHref = await p.evaluate((sel) => {
          const el = document.querySelector(sel) as HTMLAnchorElement | null;
          if (!el) throw new Error(`no element matches ${sel}`);
          el.dispatchEvent(
            new MouseEvent("click", {
              bubbles: true,
              cancelable: true,
              view: window,
            }),
          );
          return el.getAttribute("href");
        }, sayingBadgeSelector);
        const sayingClickedTopic = new URLSearchParams(
          (sayingClickedHref ?? "").split("?")[1] ?? "",
        ).get("topic");
        await p.waitForFunction(
          (name) =>
            new URLSearchParams(window.location.search).get("topic") === name,
          sayingClickedTopic,
          { timeout: 5000 },
        );
        await p.waitForTimeout(300);

        const afterSayingBadge = await p.evaluate((sel) => {
          const input = document.querySelector(sel) as HTMLInputElement | null;
          const params = new URLSearchParams(window.location.search);
          return {
            inputValue: input?.value ?? null,
            q: params.get("q"),
            topic: params.get("topic"),
            pathname: window.location.pathname,
          };
        }, sayingSearchBox);
        // The topic badge URL carries ONLY ?topic=, and the sayings page
        // intentionally drops the other filters (see the in-place update
        // effect in sayings.tsx), so q is dropped while the topic filter
        // applies in place.
        check(
          `${label}: keyword filter is dropped (badge URL carries only topic)`,
          afterSayingBadge.inputValue === "" && afterSayingBadge.q === null,
          `value=${JSON.stringify(afterSayingBadge.inputValue)} q=${afterSayingBadge.q}`,
        );
        check(
          `${label}: topic filter applied in place`,
          afterSayingBadge.topic === sayingClickedTopic,
          `topic=${afterSayingBadge.topic}`,
        );
        check(
          `${label}: still on /sayings`,
          afterSayingBadge.pathname === "/sayings",
        );
      }

      // Scenarios 12 and 13 extend the non-reset coverage to a fifth
      // collection page: on /letters, a card's authenticity badge is a
      // query-string same-page link (/letters?verdict=X) whose value the
      // page absorbs into its authenticity filter in place while the
      // keyword filter survives. Run at both the desktop and the 390x844
      // phone viewport, mirroring Scenarios 10 and 11, so a letters-only
      // layout or link change can't wipe a reader's filters while the
      // other checks stay green.
      const epistleSearchBox = 'input[placeholder^="Search the letters"]';
      const epistleBadgeSelector = 'a[href^="/letters?verdict="]';

      for (const [label, p] of [
        ["Scenario 12: desktop", page],
        ["Scenario 13: mobile", mobilePage],
      ] as const) {
        console.log(
          `${label}: letters verdict badge click does NOT reset filters`,
        );
        await p.goto(`${BASE_URL}/letters`, { waitUntil: "networkidle" });
        guardFor(p).assertPageLoaded();
        await guardFor(p).guarded(p.waitForSelector(epistleSearchBox));
        const epistleBadge = await p
          .waitForSelector(epistleBadgeSelector, { timeout: 10000 })
          .catch(() => null);
        check(`${label}: found a verdict badge link`, !!epistleBadge);

        await p.fill(epistleSearchBox, "the");
        await p.waitForFunction(
          () => new URLSearchParams(window.location.search).get("q") === "the",
          undefined,
          { timeout: 5000 },
        );
        await p.waitForLoadState("networkidle");

        const epistleBadgeStillThere = await p
          .waitForSelector(epistleBadgeSelector, { timeout: 10000 })
          .catch(() => null);
        check(
          `${label}: a verdict badge survives the keyword filter`,
          !!epistleBadgeStillThere,
        );
        const epistleClickedHref = await p.evaluate((sel) => {
          const el = document.querySelector(sel) as HTMLAnchorElement | null;
          if (!el) throw new Error(`no element matches ${sel}`);
          el.dispatchEvent(
            new MouseEvent("click", {
              bubbles: true,
              cancelable: true,
              view: window,
            }),
          );
          return el.getAttribute("href");
        }, epistleBadgeSelector);
        const epistleClickedVerdict = new URLSearchParams(
          (epistleClickedHref ?? "").split("?")[1] ?? "",
        ).get("verdict");
        // The page absorbs the transient ?verdict= into its authenticity
        // state, so the settled URL carries authenticity=X (not verdict=X).
        await p.waitForFunction(
          (name) =>
            new URLSearchParams(window.location.search).get("authenticity") ===
            name,
          epistleClickedVerdict,
          { timeout: 5000 },
        );
        await p.waitForTimeout(300);

        const afterEpistleBadge = await p.evaluate((sel) => {
          const input = document.querySelector(sel) as HTMLInputElement | null;
          const params = new URLSearchParams(window.location.search);
          return {
            inputValue: input?.value ?? null,
            q: params.get("q"),
            authenticity: params.get("authenticity"),
            verdict: params.get("verdict"),
            pathname: window.location.pathname,
          };
        }, epistleSearchBox);
        // The verdict badge URL carries ONLY ?verdict=, and the letters
        // page intentionally drops the other filters (see the in-place
        // update effect in epistles.tsx), so q is dropped while the
        // authenticity filter applies in place.
        check(
          `${label}: keyword filter is dropped (badge URL carries only verdict)`,
          afterEpistleBadge.inputValue === "" && afterEpistleBadge.q === null,
          `value=${JSON.stringify(afterEpistleBadge.inputValue)} q=${afterEpistleBadge.q}`,
        );
        check(
          `${label}: authenticity filter applied in place`,
          afterEpistleBadge.authenticity === epistleClickedVerdict,
          `authenticity=${afterEpistleBadge.authenticity}`,
        );
        check(
          `${label}: transient verdict param is dropped from the URL`,
          afterEpistleBadge.verdict === null,
          `verdict=${afterEpistleBadge.verdict}`,
        );
        check(
          `${label}: still on /letters`,
          afterEpistleBadge.pathname === "/letters",
        );
      }

      // Scenarios 14 and 15 cover the letters sender badge: a card's
      // sender badge is a query-string same-page link (/letters?from=X)
      // whose transient ?from= value the page absorbs into its sender
      // filter in place (settling as sender=X in the URL) while the
      // keyword filter survives. Run at both the desktop and the 390x844
      // phone viewport, mirroring Scenarios 12 and 13. The addressee and
      // topic badges follow the exact same pickup path, so covering the
      // sender badge pins the shared mechanism.
      const senderBadgeSelector = 'a[href^="/letters?from="]';

      for (const [label, p] of [
        ["Scenario 14: desktop", page],
        ["Scenario 15: mobile", mobilePage],
      ] as const) {
        console.log(
          `${label}: letters sender badge click does NOT reset filters`,
        );
        await p.goto(`${BASE_URL}/letters`, { waitUntil: "networkidle" });
        guardFor(p).assertPageLoaded();
        await guardFor(p).guarded(p.waitForSelector(epistleSearchBox));
        const senderBadge = await p
          .waitForSelector(senderBadgeSelector, { timeout: 10000 })
          .catch(() => null);
        check(`${label}: found a sender badge link`, !!senderBadge);

        await p.fill(epistleSearchBox, "the");
        await p.waitForFunction(
          () => new URLSearchParams(window.location.search).get("q") === "the",
          undefined,
          { timeout: 5000 },
        );
        await p.waitForLoadState("networkidle");

        const senderBadgeStillThere = await p
          .waitForSelector(senderBadgeSelector, { timeout: 10000 })
          .catch(() => null);
        check(
          `${label}: a sender badge survives the keyword filter`,
          !!senderBadgeStillThere,
        );
        const senderClickedHref = await p.evaluate((sel) => {
          const el = document.querySelector(sel) as HTMLAnchorElement | null;
          if (!el) throw new Error(`no element matches ${sel}`);
          el.dispatchEvent(
            new MouseEvent("click", {
              bubbles: true,
              cancelable: true,
              view: window,
            }),
          );
          return el.getAttribute("href");
        }, senderBadgeSelector);
        const senderClickedFrom = new URLSearchParams(
          (senderClickedHref ?? "").split("?")[1] ?? "",
        ).get("from");
        // The page absorbs the transient ?from= into its sender state, so
        // the settled URL carries sender=X (not from=X).
        await p.waitForFunction(
          (name) =>
            new URLSearchParams(window.location.search).get("sender") === name,
          senderClickedFrom,
          { timeout: 5000 },
        );
        await p.waitForTimeout(300);

        const afterSenderBadge = await p.evaluate((sel) => {
          const input = document.querySelector(sel) as HTMLInputElement | null;
          const params = new URLSearchParams(window.location.search);
          return {
            inputValue: input?.value ?? null,
            q: params.get("q"),
            sender: params.get("sender"),
            from: params.get("from"),
            pathname: window.location.pathname,
          };
        }, epistleSearchBox);
        // The sender badge URL carries ONLY ?from=, and the letters page
        // intentionally drops the other filters (see the in-place update
        // effect in epistles.tsx), so q is dropped while the sender filter
        // applies in place.
        check(
          `${label}: keyword filter is dropped (badge URL carries only from)`,
          afterSenderBadge.inputValue === "" && afterSenderBadge.q === null,
          `value=${JSON.stringify(afterSenderBadge.inputValue)} q=${afterSenderBadge.q}`,
        );
        check(
          `${label}: sender filter applied in place`,
          afterSenderBadge.sender === senderClickedFrom,
          `sender=${afterSenderBadge.sender}`,
        );
        check(
          `${label}: transient from param is dropped from the URL`,
          afterSenderBadge.from === null,
          `from=${afterSenderBadge.from}`,
        );
        check(
          `${label}: still on /letters`,
          afterSenderBadge.pathname === "/letters",
        );
      }

      // Scenarios 16 and 17 cover the letters addressee and topic badges
      // directly: they share the sender badge's in-place pickup effect in
      // epistles.tsx, but a markup change scoped to just those two badges
      // (a wrapper span swallowing clicks, a changed href) would slip past
      // the sender scenarios. Unlike ?verdict=/?from=, the ?to= and
      // ?topic= params ARE the persistent params, so the settled URL keeps
      // them as-is. Desktop viewport only; the mobile path is already
      // pinned by the sender scenario.
      for (const [label, badgeSel, param] of [
        ["Scenario 16", 'a[href^="/letters?to="]', "to"],
        ["Scenario 17", 'a[href^="/letters?topic="]', "topic"],
      ] as const) {
        console.log(
          `${label}: letters ${param === "to" ? "addressee" : "topic"} badge click does NOT reset filters`,
        );
        await page.goto(`${BASE_URL}/letters`, { waitUntil: "networkidle" });
        guard.assertPageLoaded();
        await guard.guarded(page.waitForSelector(epistleSearchBox));
        const foundBadge = await page
          .waitForSelector(badgeSel, { timeout: 10000 })
          .catch(() => null);
        check(`${label}: found a ${param} badge link`, !!foundBadge);

        await page.fill(epistleSearchBox, "the");
        await page.waitForFunction(
          () => new URLSearchParams(window.location.search).get("q") === "the",
          undefined,
          { timeout: 5000 },
        );
        await page.waitForLoadState("networkidle");

        const badgeStill = await page
          .waitForSelector(badgeSel, { timeout: 10000 })
          .catch(() => null);
        check(
          `${label}: a ${param} badge survives the keyword filter`,
          !!badgeStill,
        );
        const clickedBadgeHref = await page.evaluate((sel) => {
          const el = document.querySelector(sel) as HTMLAnchorElement | null;
          if (!el) throw new Error(`no element matches ${sel}`);
          el.dispatchEvent(
            new MouseEvent("click", {
              bubbles: true,
              cancelable: true,
              view: window,
            }),
          );
          return el.getAttribute("href");
        }, badgeSel);
        const clickedValue = new URLSearchParams(
          (clickedBadgeHref ?? "").split("?")[1] ?? "",
        ).get(param);
        await page.waitForFunction(
          ([p, name]) =>
            new URLSearchParams(window.location.search).get(p) === name,
          [param, clickedValue] as const,
          { timeout: 5000 },
        );
        await page.waitForTimeout(300);

        const afterBadgeClick = await page.evaluate(
          ([sel, p]) => {
            const input = document.querySelector(
              sel,
            ) as HTMLInputElement | null;
            const params = new URLSearchParams(window.location.search);
            return {
              inputValue: input?.value ?? null,
              q: params.get("q"),
              value: params.get(p),
              pathname: window.location.pathname,
            };
          },
          [epistleSearchBox, param] as const,
        );
        // These badge URLs carry ONLY their own param, and the letters
        // page intentionally drops the other filters (see the in-place
        // update effect in epistles.tsx), so q is dropped while the badge
        // filter applies in place.
        check(
          `${label}: keyword filter is dropped (badge URL carries only ${param})`,
          afterBadgeClick.inputValue === "" && afterBadgeClick.q === null,
          `value=${JSON.stringify(afterBadgeClick.inputValue)} q=${afterBadgeClick.q}`,
        );
        check(
          `${label}: ${param} filter applied in place`,
          afterBadgeClick.value === clickedValue,
          `${param}=${afterBadgeClick.value}`,
        );
        check(
          `${label}: still on /letters`,
          afterBadgeClick.pathname === "/letters",
        );
      }

      // Scenario 18: a card's "Read in context" link is a cross-page
      // navigation to /section/:id. The badge scenarios above only cover
      // same-page query-string links; a markup change scoped to this link
      // (a wrapper swallowing clicks, a malformed section id in the href)
      // would ship silently. The same link exists on every collection card
      // (letter, saying, anecdote, verse, doxa), each rendered by its own
      // component, so a breakage scoped to one card type would slip past a
      // check on the others. Click one on each page and assert the browser
      // lands on the section page with the bilingual text rendered.
      const readInContextPages: Array<{ path: string; card: string }> = [
        { path: "/letters", card: "letter" },
        { path: "/sayings", card: "saying" },
        { path: "/anecdotes", card: "anecdote" },
        { path: "/verses", card: "verse" },
        { path: "/doxography", card: "doxa" },
        // The Testaments page renders its own card markup (TestamentCard),
        // so a breakage scoped to its "Read in context" link would slip
        // past the checks on the other collection pages.
        { path: "/testaments", card: "testament" },
      ];
      for (const { path: listPath, card } of readInContextPages) {
        console.log(
          `Scenario 18 (${card}): '${card}' card 'Read in context' link navigates to the section page`,
        );
        await page.goto(`${BASE_URL}${listPath}`, {
          waitUntil: "networkidle",
        });
        guard.assertPageLoaded();
        const sectionLinkSel = 'main a[href^="/section/"]';
        // Tolerant wait (a page may legitimately lack the link), so it is
        // not wrapped in guard.guarded(); assertPageLoaded above already
        // fails fast if the site never booted.
        const sectionLink = await page
          .waitForSelector(sectionLinkSel, { timeout: 10000 })
          .catch(() => null);
        check(`${card}: found a 'Read in context' section link`, !!sectionLink);
        if (!sectionLink) continue;
        const sectionHref = await page.evaluate((sel) => {
          const el = document.querySelector(sel) as HTMLAnchorElement | null;
          if (!el) throw new Error(`no element matches ${sel}`);
          const linkText = el.textContent ?? "";
          el.dispatchEvent(
            new MouseEvent("click", {
              bubbles: true,
              cancelable: true,
              view: window,
            }),
          );
          return { href: el.getAttribute("href"), linkText };
        }, sectionLinkSel);
        check(
          `${card}: link is labeled 'Read in context'`,
          sectionHref.linkText.includes("Read in context"),
          `text=${JSON.stringify(sectionHref.linkText)}`,
        );
        const expectedSectionId = (sectionHref.href ?? "").replace(
          "/section/",
          "",
        );
        check(
          `${card}: href carries a well-formed section id (book.chapter.section)`,
          /^\d+\.(\d+|prol)\.\d+$/.test(expectedSectionId),
          `href=${sectionHref.href}`,
        );
        await guard.guarded(
          page.waitForFunction(
            (path) => window.location.pathname === path,
            sectionHref.href,
            { timeout: 5000 },
          ),
        );
        // The section page loads its data async; wait for the bilingual
        // passage grid (Greek column + English column) to render text.
        await page.waitForSelector("div.grid.grid-cols-1", { timeout: 15000 });
        await page.waitForFunction(
          () => {
            const grid = document.querySelector("div.grid.grid-cols-1");
            const cols = grid ? Array.from(grid.children) : [];
            return (
              cols.length === 2 &&
              (cols[0]?.textContent ?? "").trim().length > 20 &&
              (cols[1]?.textContent ?? "").trim().length > 20
            );
          },
          undefined,
          { timeout: 15000 },
        ).catch(() => {
          console.warn(
            `  warn: ${card}: bilingual passage text did not settle within 15s; the render checks below will report the details`,
          );
        });
        const sectionRender = await page.evaluate(() => {
          const grid = document.querySelector("div.grid.grid-cols-1");
          const cols = grid ? Array.from(grid.children) : [];
          const heading = document.querySelector("h1");
          return {
            pathname: window.location.pathname,
            colCount: cols.length,
            grcLen: (cols[0]?.textContent ?? "").trim().length,
            enLen: (cols[1]?.textContent ?? "").trim().length,
            headingText: heading?.textContent ?? "",
          };
        });
        check(
          `${card}: browser landed on /section/<id>`,
          sectionRender.pathname === sectionHref.href,
          `pathname=${sectionRender.pathname}`,
        );
        check(
          `${card}: passage grid has both language columns`,
          sectionRender.colCount === 2,
          `columns=${sectionRender.colCount}`,
        );
        check(
          `${card}: Greek text renders`,
          sectionRender.grcLen > 20,
          `length=${sectionRender.grcLen}`,
        );
        check(
          `${card}: English text renders`,
          sectionRender.enLen > 20,
          `length=${sectionRender.enLen}`,
        );
        check(
          `${card}: philosopher heading renders`,
          sectionRender.headingText.trim().length > 0,
          `heading=${JSON.stringify(sectionRender.headingText)}`,
        );
      }
    } finally {
      await mobilePage.close();
    }
  } finally {
    await browser.close();
  }

  if (failures > 0) {
    console.error(`\ne2e-nav-reset: ${failures} check(s) failed`);
    process.exit(1);
  }
  console.log("\ne2e-nav-reset: all checks passed");
}

main().catch((err) => {
  console.error("e2e-nav-reset: error:", err);
  process.exit(1);
});
