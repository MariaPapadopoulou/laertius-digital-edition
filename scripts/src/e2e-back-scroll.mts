/// <reference lib="dom" />
// Back-restores-scroll check (task 836): route changes now scroll to the top
// and focus #main-content (artifacts/laertius/src/App.tsx), but back/forward
// (popstate) navigations are deliberately excluded so use-scroll-memory can
// restore the reader's saved position on long list pages. This proves that
// exclusion holds in a real browser:
//
//   1. open /verses, scroll deep into the list (positive control: the hook
//      really persisted the position into sessionStorage),
//   2. click a section link INSIDE the list (fresh forward nav must still
//      land at the top — the scroll-to-top half of the feature),
//   3. press Back and assert the saved position is restored (not 0) while
//      focus still moves into #main-content.
//
// A future refactor that drops the popstate flag would make step 3 land at
// y=0 and fail here.
//
// Per .agents/memory/e2e-scroll-click-artifact.md: never use a normal
// Playwright click for step 2 — Playwright scrolls the target into view
// first, corrupting the position under test. The click is dispatched from
// inside the page on a link that is already within the viewport, and the
// assertion compares against the position captured AT CLICK TIME.

import "./lib/playwright-browsers-path";
const { chromium } = await import("playwright-core");
const { attachPageGuard } = await import("./lib/e2e-page-guard");

const BASE = process.env.E2E_BASE_URL ?? "http://localhost:80";
const LIST_PATH = "/verses";
// Matches useScrollMemory key in artifacts/laertius/src/pages/verses.tsx
// with all filters at their defaults.
const STORAGE_KEY = "verses-scroll:|all|all|all|all";
// Deep enough that a "restored" position can't be confused with the top.
const MIN_RESTORE_Y = 300;

let failures = 0;
const problems: string[] = [];
function fail(msg: string) {
  failures++;
  problems.push(msg);
  console.log(`FAIL: ${msg}`);
}
function ok(msg: string) {
  console.log(`  ok: ${msg}`);
}

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
const guard = attachPageGuard(page);

try {
  // ---- 1. Load the long list page and wait for the list to render.
  const resp = await page.goto(`${BASE}${LIST_PATH}`, { waitUntil: "load", timeout: 30000 });
  if (resp && !resp.ok()) {
    fail(`site failed to load: HTTP ${resp.status()} — is the laertius dev server running?`);
  }
  guard.assertPageLoaded();
  await guard.guarded(
    page.waitForFunction(
      `document.querySelectorAll('a[href*="/section/"]').length >= 5`,
      undefined,
      { timeout: 30000 },
    ),
  );

  // ---- 2. Scroll deep into the list and let the hook persist the position.
  // The site sets a global `scroll-behavior: smooth`; a plain scrollTo(0, y)
  // ANIMATES, so a click dispatched "after" it would land mid-animation.
  // Scroll with behavior "instant" and verify the position settled.
  const scrolled = (await page.evaluate(`(() => {
    const target = Math.min(
      Math.floor((document.documentElement.scrollHeight - window.innerHeight) * 0.5),
      3000,
    );
    window.scrollTo({ top: target, left: 0, behavior: "instant" });
    return { target, max: document.documentElement.scrollHeight - window.innerHeight };
  })()`)) as { target: number; max: number };
  if (scrolled.max < MIN_RESTORE_Y * 2) {
    fail(`page is too short to test scroll memory (max scroll ${scrolled.max}px) — did the verses list render?`);
  }
  // Give the passive scroll listener a moment to fire and persist.
  await page.waitForTimeout(400);

  const preClick = (await page.evaluate(`(() => ({
    y: window.scrollY,
    saved: sessionStorage.getItem(${JSON.stringify(STORAGE_KEY)}),
  }))()`)) as { y: number; saved: string | null };

  // Positive control: the hook must have saved the position under the key
  // we expect. If the key format changes, this check must be updated —
  // otherwise the Back assertion below could pass or fail for the wrong
  // reason.
  if (preClick.y < MIN_RESTORE_Y) {
    fail(`could not scroll the list deep enough (at y=${preClick.y})`);
  } else if (preClick.saved === null) {
    fail(`positive control failed: nothing saved in sessionStorage["${STORAGE_KEY}"] after scrolling — key format changed?`);
  } else if (Math.abs(parseFloat(preClick.saved) - preClick.y) > 4) {
    fail(`positive control failed: saved position ${preClick.saved} != current scroll ${preClick.y}`);
  } else {
    ok(`scrolled to y=${preClick.y}, hook saved ${preClick.saved}`);
  }

  // ---- 3. Click a section link that is ALREADY inside the viewport, from
  // inside the page (no Playwright auto-scroll). Capture scrollY at click
  // time — that is the value Back must restore.
  const click = (await page.evaluate(`(() => {
    const links = Array.from(document.querySelectorAll('a[href*="/section/"]'));
    const inView = links.find((a) => {
      const r = a.getBoundingClientRect();
      return r.top >= 0 && r.bottom <= window.innerHeight && r.width > 0;
    });
    if (!inView) return { clicked: false, y: window.scrollY };
    const y = window.scrollY;
    inView.click();
    return { clicked: true, y, href: inView.getAttribute("href") };
  })()`)) as { clicked: boolean; y: number; href?: string };
  if (!click.clicked) {
    fail("no section link inside the viewport to click — list layout changed?");
  }
  const savedY = click.y;

  await guard.guarded(
    page.waitForFunction(`location.pathname.includes("/section/")`, undefined, { timeout: 15000 }),
  );
  // The scroll-to-top runs in a React effect; give it a frame.
  await page.waitForTimeout(300);
  const sectionY = (await page.evaluate("window.scrollY")) as number;
  if (sectionY > 4) {
    fail(`fresh forward navigation to the section did not start at the top (y=${sectionY})`);
  } else {
    ok(`forward navigation to ${click.href} landed at the top (y=${sectionY})`);
  }

  // ---- 4. Back. The saved position must be restored (NOT the top), and
  // focus must still move into the page content.
  await page.goBack({ waitUntil: "load", timeout: 15000 });
  await guard.guarded(
    page.waitForFunction(`location.pathname.endsWith(${JSON.stringify(LIST_PATH)})`, undefined, {
      timeout: 15000,
    }),
  );
  // The restore loop re-pins over animation frames while the list regrows;
  // poll until the position settles near the saved value or time runs out.
  const deadline = Date.now() + 10000;
  let backY = -1;
  while (Date.now() < deadline) {
    backY = (await page.evaluate("window.scrollY")) as number;
    if (Math.abs(backY - savedY) <= 4) break;
    await page.waitForTimeout(200);
  }
  if (Math.abs(backY - savedY) > 4) {
    fail(
      backY <= 4
        ? `Back landed at the top (y=${backY}) instead of the saved position ${savedY} — the scroll-to-top no longer excludes popstate?`
        : `Back restored y=${backY}, expected the saved position ${savedY}`,
    );
  } else {
    ok(`Back restored the reader's position (y=${backY}, saved ${savedY})`);
  }

  const focusState = (await page.evaluate(`(() => {
    const active = document.activeElement;
    const main = document.getElementById("main-content");
    return {
      focusOnMain: !!main && active === main,
      activeDesc: active ? active.tagName + "#" + (active.id || "") : "none",
    };
  })()`)) as { focusOnMain: boolean; activeDesc: string };
  if (!focusState.focusOnMain) {
    fail(`focus did not move to #main-content after Back (focus: ${focusState.activeDesc})`);
  } else {
    ok("focus moved to #main-content after Back");
  }
} catch (e) {
  fail(`check crashed: ${String(e).slice(0, 300)}`);
} finally {
  await ctx.close();
  await browser.close();
}

if (failures > 0) {
  console.error(`\n${failures} problem(s): Back does not reliably return readers to the spot they left`);
  process.exit(1);
}
console.log("\nBack restores the saved scroll position while focus moves to #main-content");
