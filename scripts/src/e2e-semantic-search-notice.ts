/// <reference lib="dom" />
// Task: confirm the Ask and Search pages show a subtle "semantic search
// degraded" notice while /api/healthz reports denseIndexReady: false, and
// that the notice clears on its own (via polling) once it flips true.
//
// The health endpoint is stubbed with page.route so both states can be
// exercised deterministically regardless of the real embedder state.
//
// Run: cd scripts && npx tsx src/e2e-semantic-search-notice.ts

import "./lib/playwright-browsers-path";

// Make this file a module so its top-level declarations (main, waitFor, …)
// don't collide with other non-module scripts in the same tsc program.
export {};

const BASE = "http://localhost:80";
const WORKSPACE = new URL("../..", import.meta.url).pathname.replace(/\/$/, "");
const NOTICE = "semantic-search-notice";

async function waitFor(
  desc: string,
  timeoutMs: number,
  intervalMs: number,
  probe: () => Promise<boolean>,
): Promise<number> {
  const start = Date.now();
  for (;;) {
    if (await probe()) return Date.now() - start;
    if (Date.now() - start > timeoutMs) {
      throw new Error(`Timed out after ${timeoutMs}ms waiting for: ${desc}`);
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
}

async function main(): Promise<void> {
  const failures: string[] = [];
  const pass = (msg: string) => console.log(`PASS: ${msg}`);
  const fail = (msg: string) => {
    console.error(`FAIL: ${msg}`);
    failures.push(msg);
  };

  const { chromium } = await import("playwright-core");
  const { attachPageGuard } = await import("./lib/e2e-page-guard");
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });

  // Stub only the main api-server health endpoint (not /legomena/api/healthz).
  let denseReady = false;
  await ctx.route(/\/api\/healthz$/, async (route) => {
    if (route.request().url().includes("/legomena/")) return route.fallback();
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ status: "ok", denseIndexReady: denseReady }),
    });
  });

  const page = await ctx.newPage();
  const guard = attachPageGuard(page);
  try {
    for (const [path, name] of [
      ["/ask", "ask"],
      ["/search", "search"],
    ] as const) {
      denseReady = false;
      await page.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded" });
      // The health endpoint is stubbed to a 200 with denseIndexReady:false
      // (a degraded-mode body, NOT a >=500 failure), so the page still boots
      // healthily here — assert it loaded before exercising the notice.
      guard.assertPageLoaded();
      // The notice-visibility/clearing waits below deliberately exercise the
      // degraded-search state, so they use the plain custom waitFor polling
      // (no guard) rather than gating on a boot failure.
      const notice = page.getByTestId(NOTICE);
      await waitFor(`${name}: notice visible while degraded`, 15_000, 250, async () =>
        (await notice.count()) === 1,
      );
      const text = (await notice.textContent()) ?? "";
      if (/keyword-only/i.test(text)) pass(`${name}: degraded notice shown ("${text.trim().slice(0, 60)}...")`);
      else fail(`${name}: notice text unexpected: ${text}`);
      await page.screenshot({
        path: `${WORKSPACE}/docs/verification/semantic-search-notice/${name}-degraded.png`,
      });

      // Flip the stub to ready; the 20s degraded poll must clear the notice
      // without a reload.
      denseReady = true;
      const clearedMs = await waitFor(
        `${name}: notice clears after denseIndexReady flips true`,
        45_000,
        500,
        async () => (await notice.count()) === 0,
      );
      pass(`${name}: notice cleared on its own ${clearedMs}ms after readiness (poll ≤20s + fetch)`);
      await page.screenshot({
        path: `${WORKSPACE}/docs/verification/semantic-search-notice/${name}-ready.png`,
      });
    }
  } finally {
    await browser.close();
  }

  if (failures.length) {
    console.error(`\n${failures.length} check(s) failed.`);
    process.exit(1);
  }
  console.log("\nAll checks passed.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
