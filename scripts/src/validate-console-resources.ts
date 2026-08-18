/// <reference lib="dom" />
// Real-browser guard against pages quietly failing to load resources.
//
// During real-browser verification of the SPARQL console and the About page,
// the browser console showed repeated 502/404 resource-load errors (root
// cause at the time: the api-server / legomena-api / laertius web workflows
// were not running). The pages still rendered, so the failures were silent.
// This validator loads the affected pages in headless Chromium and fails if
// ANY network request comes back with status >= 400 or fails outright
// (aborted, connection refused, DNS, etc.). It also surfaces console error
// messages so a "Failed to load resource" line can never pass unnoticed.
//
// Requirements: the API server, legomena api, and laertius web workflows
// must be running (the script talks to the shared proxy, default
// http://localhost:80), and a Chromium headless shell must be installed for
// playwright-core, e.g.:
//   PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright \
//     node scripts/node_modules/playwright-core/cli.js install chromium-headless-shell

// playwright-core resolves its browser registry at module import time from
// PLAYWRIGHT_BROWSERS_PATH; set it BEFORE importing playwright-core.
import "./lib/playwright-browsers-path";

const { chromium } = await import("playwright-core");

const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:80";

// The pages where the silent 502/404s were observed, plus the site root as
// a canary that the whole stack (proxy + web + api workflows) is up.
const PAGES = ["/", "/about", "/legomena/sparql"];

// Positive control (see audit-positive-controls memory): the check is only
// meaningful if the pages actually issue a healthy number of requests. A
// page that made zero requests would be vacuously "clean".
const MIN_REQUESTS_PER_PAGE = 5;

async function main() {
  // Fail fast with a clear message if the servers are not running, instead
  // of reporting every sub-resource as failed.
  try {
    const probe = await fetch(`${BASE_URL}/`, { method: "GET" });
    if (probe.status >= 400) {
      console.error(
        `FAIL: ${BASE_URL}/ answered ${probe.status} — start the ` +
          `"artifacts/laertius: web", "artifacts/api-server: API Server" ` +
          `and "artifacts/legomena: api" workflows before running this check.`,
      );
      process.exit(1);
    }
  } catch (err) {
    console.error(
      `FAIL: cannot reach ${BASE_URL} (${String(err)}) — are the dev ` +
        `server workflows running?`,
    );
    process.exit(1);
  }

  const browser = await chromium.launch({ headless: true });
  let failures = 0;
  try {
    const page = await browser.newPage({
      viewport: { width: 1280, height: 720 },
    });

    for (const path of PAGES) {
      const bad: string[] = [];
      const consoleErrors: string[] = [];
      let requestCount = 0;

      const onResponse = (r: import("playwright-core").Response) => {
        requestCount++;
        if (r.status() >= 400) bad.push(`${r.status()} ${r.url()}`);
      };
      const onRequestFailed = (r: import("playwright-core").Request) => {
        requestCount++;
        // net::ERR_ABORTED for cancelled navigations/prefetches is noise in
        // dev (vite HMR probing); everything else is a real failure.
        const errText = r.failure()?.errorText ?? "unknown";
        if (errText !== "net::ERR_ABORTED") {
          bad.push(`FAILED(${errText}) ${r.url()}`);
        }
      };
      const onConsole = (msg: import("playwright-core").ConsoleMessage) => {
        if (msg.type() === "error") consoleErrors.push(msg.text());
      };
      page.on("response", onResponse);
      page.on("requestfailed", onRequestFailed);
      page.on("console", onConsole);

      await page.goto(`${BASE_URL}${path}`, { waitUntil: "networkidle" });
      // Give deferred fetches (status pills, lazy panels) time to fire.
      await page.waitForTimeout(2000);
      await page.waitForLoadState("networkidle");

      page.off("response", onResponse);
      page.off("requestfailed", onRequestFailed);
      page.off("console", onConsole);

      if (requestCount < MIN_REQUESTS_PER_PAGE) {
        failures++;
        console.error(
          `FAIL: ${path} issued only ${requestCount} requests ` +
            `(< ${MIN_REQUESTS_PER_PAGE}); the check would be vacuous.`,
        );
      } else if (bad.length === 0 && consoleErrors.length === 0) {
        console.log(
          `ok: ${path} — ${requestCount} requests, all succeeded, ` +
            `console clean`,
        );
      } else {
        failures++;
        console.error(`FAIL: ${path} had silent resource failures:`);
        for (const b of bad) console.error(`  ${b}`);
        for (const c of consoleErrors) console.error(`  console error: ${c}`);
      }
    }
  } finally {
    await browser.close();
  }

  if (failures > 0) {
    console.error(`validate-console-resources: ${failures} page(s) FAILED`);
    process.exit(1);
  }
  console.log("validate-console-resources: all pages clean");
}

await main();
