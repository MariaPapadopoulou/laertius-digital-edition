/// <reference lib="dom" />
// Mobile audit gate (task 636): fast subset of the full-site audit sweep
// (e2e-full-audit.mts). Loads every routed page at a phone-width viewport
// (390x844, light theme) and FAILS (exit 1) when a page shows:
//   - console errors or uncaught page errors
//   - failed network requests (HTTP >= 400 or network failures)
//   - horizontal overflow beyond the viewport (> 2px)
// This is the always-on regression gate; the full three-pass sweep with
// screenshots and dark-mode light-block detection remains in
// e2e-full-audit.mts for deep audits.

import "./lib/playwright-browsers-path";
const { chromium } = await import("playwright-core");
const { attachPageGuard } = await import("./lib/e2e-page-guard");

const { SAMPLE_ROUTES, NOT_FOUND_ROUTE } = await import("./lib/audit-routes");

const BASE = process.env.E2E_BASE_URL ?? "http://localhost:80";

// Shared canonical route list (task 818): see scripts/src/lib/audit-routes.
// The deliberate 404 route (NOT_FOUND_ROUTE) legitimately produces one failed
// document request; it is checked separately so real pages stay strict.
const ROUTES = [...SAMPLE_ROUTES];

const OVERFLOW_TOLERANCE_PX = 2;

let failures = 0;
let checked = 0;
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
  deviceScaleFactor: 2,
  colorScheme: "light",
});
await ctx.addInitScript(() => {
  localStorage.setItem("laertius-theme", "light");
});
const page = await ctx.newPage();
// This sweep reuses one page across every route and DELIBERATELY tolerates
// per-page failures (console/page errors, HTTP>=400, network failures) so it
// can report them softly for all routes instead of aborting on the first —
// that is the whole point of the audit, and it even exercises a deliberate
// 404 route. The shared guard accumulates failures globally across routes and
// its assertPageLoaded()/guarded() THROW on the first failure, which would
// abort the sweep and break the soft-reporting contract. So we attach the
// guard only to surface a clear "site failed to load" message at the very
// first navigation (before any route-specific failures could accumulate) and
// intentionally do NOT assert/guard inside the per-route audit loop.
const guard = attachPageGuard(page);

async function audit(route: string, opts: { allowDocument404?: boolean } = {}) {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  const failedRequests: string[] = [];
  const onConsole = (msg: any) => {
    if (msg.type() === "error") consoleErrors.push(msg.text().slice(0, 300));
  };
  const onPageError = (err: any) => pageErrors.push(String(err).slice(0, 300));
  const onResponse = (resp: any) => {
    if (resp.status() < 400) return;
    if (opts.allowDocument404 && resp.status() === 404) return;
    failedRequests.push(`${resp.status()} ${resp.url()}`.slice(0, 200));
  };
  const onReqFailed = (req: any) => {
    const f = req.failure()?.errorText ?? "failed";
    if (f !== "net::ERR_ABORTED") failedRequests.push(`NETFAIL(${f}) ${req.url()}`.slice(0, 200));
  };
  page.on("console", onConsole);
  page.on("pageerror", onPageError);
  page.on("response", onResponse);
  page.on("requestfailed", onReqFailed);

  try {
    await page.goto(`${BASE}${route}`, { waitUntil: "load", timeout: 30000 });
    await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});
  } catch (e) {
    pageErrors.push(`goto failed: ${String(e).slice(0, 200)}`);
  }
  await page.waitForTimeout(800);

  // Same baseline as e2e-full-audit.mts: scrollWidth vs innerWidth. In this
  // headless setup the classic scrollbar makes clientWidth ~12px narrower
  // than innerWidth, and 100vw-wide elements match innerWidth, so comparing
  // against clientWidth would flag every scrollable page. innerWidth matches
  // the layout width real (overlay-scrollbar) phones give the page.
  const hOverflow = (await page.evaluate(
    `Math.max(0, document.documentElement.scrollWidth - window.innerWidth)`,
  )) as number;

  page.off("console", onConsole);
  page.off("pageerror", onPageError);
  page.off("response", onResponse);
  page.off("requestfailed", onReqFailed);

  checked++;
  const problems: string[] = [];
  if (consoleErrors.length) problems.push(`console errors: ${consoleErrors.length}`);
  if (pageErrors.length) problems.push(`page errors: ${pageErrors.length}`);
  if (failedRequests.length) problems.push(`failed requests: ${failedRequests.length}`);
  if (hOverflow > OVERFLOW_TOLERANCE_PX) problems.push(`horizontal overflow: ${hOverflow}px`);

  const ok = problems.length === 0;
  if (!ok) failures++;
  console.log(`${ok ? "  ok" : "FAIL"}: ${route}${ok ? "" : " — " + problems.join(", ")}`);
  for (const line of [...consoleErrors, ...pageErrors, ...failedRequests].slice(0, 6)) {
    console.log(`        ${line}`);
  }
}

for (let i = 0; i < ROUTES.length; i++) {
  await audit(ROUTES[i]);
  // After the very first navigation only, surface a clear "site failed to
  // load" message (500 on a module/CSS, uncaught boot error) instead of a
  // wall of per-route timeouts. Later routes are handled by the audit's own
  // soft reporting (see the guard comment above).
  if (i === 0) guard.assertPageLoaded();
}
await audit(NOT_FOUND_ROUTE, { allowDocument404: true });

await browser.close();

// Positive control: a sweep that audited nothing must not pass vacuously.
if (checked < ROUTES.length + 1) {
  console.error(`\nOnly ${checked}/${ROUTES.length + 1} routes audited`);
  process.exit(1);
}
if (failures > 0) {
  console.error(`\n${failures} page(s) failed the mobile audit`);
  process.exit(1);
}
console.log(`\nAll ${checked} pages pass the mobile audit (390px, light)`);
