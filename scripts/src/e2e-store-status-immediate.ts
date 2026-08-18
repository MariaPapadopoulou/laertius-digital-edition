/// <reference lib="dom" />
// Task: confirm the Legomena store status pill flips to "Unavailable"
// IMMEDIATELY when a reader's query fails, instead of waiting for the slow
// 60s background health poll.
//
// Mechanism under test: the app-level QueryCache/MutationCache onError
// handlers in artifacts/laertius/src/App.tsx invalidate the Legomena health
// query whenever any other Legomena API request fails, so the pill
// (LegomenaStoreStatus in artifacts/laertius/src/components/layout.tsx)
// re-checks health right away.
//
// Scenario: load the SPARQL console while the API is healthy (pill hidden),
// kill the API, run a query from the page, and require the pill to show
// "Unavailable" within a few seconds — far below the 60s poll window.
//
// NOTE: background processes are killed when the launching shell call returns
// in this environment; run this in the foreground of a single shell call and
// restart the `artifacts/legomena: api` workflow afterwards.
//
// Run: cd scripts && npx tsx src/e2e-store-status-immediate.ts

import "./lib/playwright-browsers-path";

import { execSync, spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs";

const BASE = "http://localhost:80";
const PAGE = `${BASE}/legomena/sparql`;
const HEALTH_PATH = "/legomena/api/healthz";
const API_PORT = "8090";
const WORKSPACE = new URL("../..", import.meta.url).pathname.replace(/\/$/, "");
const LOG = "/tmp/e2e-legomena-api-immediate.log";

// The pill must flip well under the 60s slow-poll window. Allow slack for
// the failed request itself plus the health re-check, which goes through
// react-query's default retries (3 attempts with backoff, ~7s) before the
// query is marked errored and the pill flips.
const FLIP_BUDGET_MS = 20_000;

function sh(cmd: string): string {
  try {
    return execSync(cmd, { encoding: "utf8" });
  } catch {
    return "";
  }
}

function killApi(): void {
  sh("pkill -f '@workspace/legomena-api' || true");
  sh(`fuser -k ${API_PORT}/tcp 2>/dev/null || true`);
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

async function healthUp(): Promise<boolean> {
  try {
    const res = await fetch(`${BASE}${HEALTH_PATH}`, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) return false;
    const body = (await res.json()) as { storeReady?: boolean };
    return body.storeReady === true;
  } catch {
    return false;
  }
}

async function healthDown(): Promise<boolean> {
  return !(await healthUp());
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

  // 1. Make sure the API is up and the store is ready.
  if (!(await healthUp())) {
    console.log("API not healthy; starting it...");
    killApi();
    startApi();
    await waitFor("store ready", 240_000, 2_000, healthUp);
  }
  console.log("API healthy.");

  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  const guard = attachPageGuard(page);

  let healthRequests = 0;
  page.on("request", (req) => {
    if (req.url().includes("/api/healthz")) healthRequests += 1;
  });

  try {
    // 2. Load the SPARQL console while healthy; the pill renders nothing.
    await page.goto(PAGE, { waitUntil: "domcontentloaded" });
    // The API is healthy at this point, so fail fast with the failing
    // URL/status if the site itself never booted.
    guard.assertPageLoaded();
    const pillCompact = page.getByTestId("legomena-store-status-compact").first();
    await guard.guarded(
      page.getByRole("button", { name: /Run Query/i }).waitFor({ timeout: 30_000 }),
    );
    // NOTE: from here on the API is deliberately killed mid-session, so the
    // custom waitFor polling below uses no guard — the failed query and the
    // resulting healthz failures are the intended behavior under test (the
    // guard records >=500 responses globally and would misreport them).
    // Let the initial health check settle so the pill state is "Ready".
    await waitFor("pill hidden (store healthy)", 30_000, 500, async () =>
      (await pillCompact.count()) === 0,
    );
    pass("pill hidden while the store is healthy");

    // 3. Kill the API mid-session. Do NOT wait for any poll.
    console.log("Killing legomena API mid-session...");
    killApi();
    await waitFor("health endpoint down", 30_000, 500, healthDown);

    // 4. Run a query from the page; its failure must trigger an immediate
    //    health re-check and flip the pill without waiting for the 60s poll.
    const healthBefore = healthRequests;
    await page.getByRole("button", { name: /Run Query/i }).click();
    const flipMs = await waitFor(
      "pill flips to Unavailable right after the failed query",
      FLIP_BUDGET_MS,
      250,
      async () => /Unavailable/i.test((await pillCompact.textContent().catch(() => "")) ?? ""),
    );
    if (flipMs <= FLIP_BUDGET_MS) {
      pass(`pill flipped to 'Unavailable' ${flipMs}ms after the failed query (budget ${FLIP_BUDGET_MS}ms)`);
    }
    if (healthRequests > healthBefore) {
      pass(`failed query triggered an immediate health re-check (+${healthRequests - healthBefore} healthz request(s))`);
    } else {
      fail("no healthz request was triggered by the failed query");
    }

    await page.screenshot({
      path: `${WORKSPACE}/docs/verification/store-status-immediate/pill-unavailable-after-failed-query.png`,
    });

    // 5. Recovery still works: restart the API; fast polling while
    //    unreachable must hide the pill again without a reload.
    console.log("Restarting legomena API...");
    startApi();
    await waitFor("pill hidden again (store healthy)", 240_000, 1_000, async () =>
      (await pillCompact.count()) === 0,
    );
    pass("pill recovered (hidden) after the API came back");
  } finally {
    await browser.close();
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
