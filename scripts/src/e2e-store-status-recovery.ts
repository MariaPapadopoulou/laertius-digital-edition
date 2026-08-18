/// <reference lib="dom" />
// Task: confirm the Legomena store status pill recovers in a real browser
// after an API restart, without a page reload.
//
// The pill (LegomenaStoreStatus in artifacts/laertius/src/components/layout.tsx)
// polls /legomena/api/healthz every 20s while the store is unreachable or not
// yet ready, and keeps a slow 60s background poll once storeReady, so an
// outage that starts AFTER "Ready" is still noticed. Observed transitions:
// load page while API is DOWN -> "Unavailable" (+ active 20s polling) ->
// restart API -> "Ready" without reload -> kill API again -> "Unavailable"
// within one slow-poll window (~90s; this also proves the slow poll fires) ->
// restart -> "Ready" again, all without a page reload.
//
// NOTE: background processes are killed when the launching shell call returns
// in this environment, so this script is sized to finish within ~5 minutes and
// must be run in the foreground of a single shell invocation.
//
// Run: cd scripts && npx tsx src/e2e-store-status-recovery.ts
// Restores the legomena API on port 8090 itself, but re-run the
// `artifacts/legomena: api` workflow afterwards to restore supervised state.

import "./lib/playwright-browsers-path";

import { execSync, spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs";

const BASE = "http://localhost:80";
const PAGE = `${BASE}/legomena`;
const HEALTH_PATH = "/legomena/api/healthz";
const API_PORT = "8090";
const WORKSPACE = new URL("../..", import.meta.url).pathname.replace(/\/$/, "");
const LOG = "/tmp/e2e-legomena-api.log";

function sh(cmd: string): string {
  try {
    return execSync(cmd, { encoding: "utf8" });
  } catch {
    return "";
  }
}

function killApi(): void {
  // Kill the workflow-managed pnpm tree and anything else on the API port.
  sh("pkill -f '@workspace/legomena-api' || true");
  sh(`fuser -k ${API_PORT}/tcp 2>/dev/null || true`);
}

async function waitFor(
  desc: string,
  timeoutMs: number,
  intervalMs: number,
  probe: () => Promise<boolean>,
): Promise<void> {
  const start = Date.now();
  for (;;) {
    if (await probe()) return;
    if (Date.now() - start > timeoutMs) {
      throw new Error(`Timed out after ${timeoutMs}ms waiting for: ${desc}`);
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
}

async function healthDown(): Promise<boolean> {
  try {
    const res = await fetch(`${BASE}${HEALTH_PATH}`, { signal: AbortSignal.timeout(3000) });
    return !res.ok;
  } catch {
    return true;
  }
}

let apiChild: ChildProcess | null = null;
function startApi(): void {
  const out = fs.openSync(LOG, "a");
  apiChild = spawn("pnpm", ["--filter", "@workspace/legomena-api", "run", "dev"], {
    cwd: WORKSPACE,
    env: { ...process.env, PORT: API_PORT },
    detached: true,
    stdio: ["ignore", out, out],
  });
  apiChild.unref();
}

for (const sig of ["SIGTERM", "SIGINT", "SIGHUP"] as const) {
  process.on(sig, () => {
    console.error(`Received ${sig} — something is signaling the e2e script itself.`);
    process.exit(1);
  });
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

  // 1. Take the API down and confirm health is unreachable through the proxy.
  console.log("Stopping legomena API...");
  killApi();
  await waitFor("health endpoint down", 30_000, 1_000, healthDown);
  console.log("API is down.");

  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  // NOTE: this whole scenario deliberately loads the page while the API is
  // DOWN (and repeatedly kills/restarts it), so the store health requests
  // fail by design and the proxy may answer >=500 during the outage windows.
  // The guard records those global failures, so we intentionally do NOT call
  // guard.assertPageLoaded()/guard.guarded() anywhere here — the plain
  // custom waitFor polling below is what asserts the pill's transitions.
  attachPageGuard(page);

  let healthRequests = 0;
  page.on("request", (req) => {
    if (req.url().includes("/api/healthz")) {
      healthRequests += 1;
      console.log(`  healthz request #${healthRequests}`);
    }
  });

  try {
    // 2. Load the page while the API is down; the pill must show Unavailable.
    await page.goto(PAGE, { waitUntil: "domcontentloaded" });
    // Reload marker: must survive until the end (no full page reload).
    await page.evaluate(() => {
      (window as unknown as { __noReloadMarker?: number }).__noReloadMarker = 42;
    });
    const pill = page.getByTestId("legomena-store-status");
    await pill.waitFor({ state: "visible", timeout: 30_000 });
    await waitFor("pill shows Unavailable", 40_000, 500, async () =>
      /Unavailable/i.test((await pill.textContent()) ?? ""),
    );
    pass("pill shows 'Unavailable' while the API is down");

    // 3. Confirm polling is active while unreachable: expect at least one
    //    additional healthz request within ~25s (20s interval + slack).
    const before = healthRequests;
    await waitFor("a poll request while unreachable", 30_000, 500, async () =>
      healthRequests > before,
    );
    pass(`polling active while unreachable (${healthRequests} healthz requests so far)`);

    // 4. Restart the API; the healthy store hides the pill, no reload.
    console.log("Restarting legomena API...");
    startApi();
    // The pill renders nothing while the store is healthy, so recovery is
    // observed as the pill disappearing.
    await waitFor("pill disappears (store healthy)", 240_000, 1_000, async () =>
      (await pill.count()) === 0 || !(await pill.isVisible()),
    );
    pass("pill disappeared (store healthy) after API restart");

    const marker = await page.evaluate(
      () => (window as unknown as { __noReloadMarker?: number }).__noReloadMarker,
    );
    if (marker === 42) {
      pass("no page reload occurred (window marker survived)");
    } else {
      fail(`page reloaded during recovery (marker=${String(marker)})`);
    }

    await page.screenshot({
      path: `${WORKSPACE}/docs/verification/store-status-recovery/pill-ready.png`,
    });

    // 5. Outage AFTER Ready: kill the API and the pill must reappear as
    //    Unavailable within one slow-poll window (60s + slack). The flip can
    //    only happen if the slow background poll fires while Ready, so this
    //    also proves polling did not stop at Ready.
    const atReady = healthRequests;
    console.log(`Killing legomena API while pill shows Ready (healthz count: ${atReady})...`);
    if (apiChild?.pid) {
      try {
        process.kill(-apiChild.pid, "SIGTERM");
      } catch {
        /* already gone */
      }
      apiChild = null;
    }
    console.log("  sent SIGTERM to API process group");
    killApi();
    console.log("  killApi() done, waiting for health endpoint to go down...");
    await waitFor("health endpoint down again", 30_000, 1_000, healthDown);
    console.log("  health endpoint is down; waiting for the pill to notice...");
    await waitFor("pill shows Unavailable after mid-session outage", 90_000, 1_000, async () =>
      /Unavailable/i.test((await pill.textContent()) ?? ""),
    );
    pass(
      `pill flipped Ready -> 'Unavailable' after a mid-session outage (slow poll fired; healthz count now ${healthRequests})`,
    );

    await page.screenshot({
      path: `${WORKSPACE}/docs/verification/store-status-recovery/pill-unavailable-after-ready.png`,
    });

    // 7. Recovery again: restart the API; fast (20s) polling while unreachable
    //    must flip the pill back to Ready.
    console.log("Restarting legomena API again...");
    startApi();
    // A healthy store renders no pill at all, so recovery is observed as the
    // pill disappearing again (same convention as step 4).
    await waitFor("pill hidden again (store healthy)", 200_000, 1_000, async () =>
      (await pill.count()) === 0 || !(await pill.isVisible()),
    );
    pass("pill recovered (hidden, store healthy) after the mid-session outage ended");

    const markerEnd = await page.evaluate(
      () => (window as unknown as { __noReloadMarker?: number }).__noReloadMarker,
    );
    if (markerEnd === 42) {
      pass("no page reload occurred across the whole outage cycle");
    } else {
      fail(`page reloaded during outage cycle (marker=${String(markerEnd)})`);
    }
  } finally {
    await browser.close();
    // Clean up our detached API child; the supervised workflow should be
    // restarted afterwards to restore normal state.
    if (apiChild?.pid) {
      try {
        process.kill(-apiChild.pid, "SIGTERM");
      } catch {
        /* already gone */
      }
    }
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
