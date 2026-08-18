/// <reference lib="dom" />
// Focus-on-navigation check (task 777): after a client-side route change
// triggered by clicking an in-app nav link, keyboard focus must move to the
// <main id="main-content"> landmark instead of staying on the clicked link,
// and the move must not fight the scroll-reset logic (page still starts at
// the top for a fresh route). Also proves the negative: before the click,
// focus IS on the link, so a vacuous "focus was already on main" pass is
// impossible.

import "./lib/playwright-browsers-path";
const { chromium } = await import("playwright-core");
const { attachPageGuard } = await import("./lib/e2e-page-guard");

const BASE = process.env.E2E_BASE_URL ?? "http://localhost:80";

// Each case: start on `from`, click the in-app link matching `selector`
// (scoped to header or footer chrome), expect the SPA route `to`.
// - header→/ask covers the always-visible desktop header link.
// - footer links cover ordinary grouped nav entries without needing hover.
// - the home page renders OUTSIDE the shared Layout (own header/main), so a
//   home→page and page→home hop each exercise the Layout mount/unmount path.
const CASES: { from: string; to: string; scope: string; linkText: string }[] = [
  // "Ask Laertius" in the header is now a dropdown (hidden until hover), so
  // exercise the always-visible footer link instead.
  { from: "/about", to: "/ask", scope: "footer", linkText: "Ask Laertius" },
  { from: "/ask", to: "/browse", scope: "footer", linkText: "Browse" },
  // The shared footer groups /graph under the "Explorations" heading; the
  // link itself is labelled "Graph".
  { from: "/", to: "/graph", scope: "footer", linkText: "Graph" },
  // Page → home via the header wordmark (Layout unmounts, Home mounts).
  { from: "/graph", to: "/", scope: "header", linkText: "Digital Scholarly Edition" },
  { from: "/browse", to: "/verses", scope: "footer", linkText: "Verses" },
];

let failures = 0;
let checked = 0;

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
const guard = attachPageGuard(page);

for (const c of CASES) {
  checked++;
  const label = `${c.from} --(${c.scope} "${c.linkText}")--> ${c.to}`;
  const problems: string[] = [];
  try {
    const failuresBefore = guard.failures().length;
    const resp = await page.goto(`${BASE}${c.from}`, { waitUntil: "load", timeout: 30000 });
    const newFailures = guard.failures().slice(failuresBefore);
    if ((resp && !resp.ok()) || newFailures.length > 0) {
      failures++;
      console.log(`FAIL: ${label}`);
      if (resp && !resp.ok()) {
        console.log(`        site failed to load: HTTP ${resp.status()} — is the laertius dev server running?`);
      }
      for (const f of newFailures) console.log(`        site failed to load: ${f}`);
      continue;
    }
    await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});

    // The target is a client-side <a> in the page chrome. Scope to header or
    // footer so we don't accidentally click an in-content link.
    const link = page.locator(`${c.scope} a`, { hasText: new RegExp(`^\\s*${c.linkText}\\s*$`, "i") }).first();
    if ((await link.count()) === 0) {
      problems.push(`no ${c.scope} link with text "${c.linkText}" found`);
    } else {
      // Focus the link first (keyboard users navigate links focused), then
      // positive control: focus really is on the link before activation.
      await link.focus();
      const onLinkBefore = await link.evaluate((el) => el === document.activeElement);
      if (!onLinkBefore) problems.push("positive control failed: could not focus the nav link before clicking");

      await link.click();
      // The route change is synchronous in wouter; give React one frame plus
      // the focus effect a moment to run.
      await page.waitForTimeout(300);

      const state = (await page.evaluate(`(() => {
        const active = document.activeElement;
        const main = document.getElementById("main-content");
        return {
          path: location.pathname,
          focusOnMain: !!main && active === main,
          activeDesc: active ? active.tagName + "#" + (active.id || "") + " '" + (active.textContent || "").trim().slice(0, 40) + "'" : "none",
          scrollY: window.scrollY,
        };
      })()`)) as { path: string; focusOnMain: boolean; activeDesc: string; scrollY: number };

      if (!state.path.endsWith(c.to)) {
        problems.push(`click did not navigate to ${c.to} (at ${state.path}) — was it a full page load or a dead link?`);
      }
      if (!state.focusOnMain) {
        problems.push(`focus did not move to #main-content after navigation (focus: ${state.activeDesc})`);
      }
      // No scroll-jump conflict: a fresh forward navigation must still start
      // at the top of the page (the focus move uses preventScroll and must
      // not drag the viewport somewhere else).
      if (state.scrollY > 4) {
        problems.push(`page is scrolled to y=${state.scrollY} after navigation instead of the top`);
      }
    }
  } catch (e) {
    problems.push(`page failed to load or check crashed: ${String(e).slice(0, 200)}`);
  }
  const ok = problems.length === 0;
  if (!ok) failures++;
  console.log(`${ok ? "  ok" : "FAIL"}: ${label}`);
  for (const p of problems) console.log(`        ${p}`);
}

await ctx.close();
await browser.close();

if (checked < CASES.length) {
  console.error(`\nOnly ${checked}/${CASES.length} navigation cases checked`);
  process.exit(1);
}
if (failures > 0) {
  console.error(`\n${failures} navigation case(s) failed the focus-on-navigation audit`);
  process.exit(1);
}
console.log(`\nAll ${checked} in-app navigations move focus to #main-content`);
