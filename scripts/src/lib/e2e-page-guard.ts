// Shared page-load failure guard for the browser e2e scripts.
//
// Problem: when the app under test fails to boot — a dev server 500 on a
// JS/CSS module (e.g. a missing @fontsource package broke /src/index.css),
// an uncaught page error, or a blank body — every e2e script used to
// surface it only as an opaque "waitForFunction: Timeout 30000ms exceeded",
// giving zero hint that the site itself never loaded.
//
// Usage:
//   const guard = attachPageGuard(page);
//   await page.goto(...);
//   guard.assertPageLoaded();          // fail fast right after goto
//   await guard.guarded(page.waitForFunction(...));  // wrap long waits
//
// The guard records every >=500 resource response, failed document/script/
// stylesheet request, and uncaught page error. `guarded()` races a promise
// against those failures so a selector timeout is reported as "the site
// failed to load: <url> -> 500" instead of a raw timeout.
import type { Page } from "playwright-core";

export interface PageGuard {
  /** Throws with details if any load failure has been recorded so far. */
  assertPageLoaded(): void;
  /**
   * Awaits `promise`, but if it rejects (e.g. a waitForFunction timeout)
   * while load failures were recorded, throws a message naming the failing
   * URL/status/error instead of the opaque timeout. If a failure is already
   * recorded when called, it also fails fast without waiting.
   */
  guarded<T>(promise: Promise<T>): Promise<T>;
  /** The failure messages recorded so far (empty when the page is healthy). */
  failures(): readonly string[];
}

export function attachPageGuard(page: Page): PageGuard {
  const failures: string[] = [];

  page.on("response", (res) => {
    if (res.status() >= 500) {
      failures.push(`HTTP ${res.status()} on ${res.url()}`);
    }
  });
  page.on("requestfailed", (req) => {
    // Only resource types that break the app when missing; XHR/fetch
    // failures are often legitimately exercised by error-path scenarios.
    const type = req.resourceType();
    // net::ERR_ABORTED means the load was CANCELED, not that it failed:
    // an SPA navigation (or a Vite dev-server re-optimize reload) aborts
    // the previous page's still-pending lazy module loads. A genuinely
    // broken module surfaces as an uncaught page error or a Vite
    // "Failed to load" console error, both recorded below.
    if (req.failure()?.errorText === "net::ERR_ABORTED") return;
    if (type === "document" || type === "script" || type === "stylesheet") {
      failures.push(
        `request failed (${type}) ${req.url()}: ${req.failure()?.errorText ?? "unknown error"}`,
      );
    }
  });
  page.on("pageerror", (err) => {
    failures.push(`uncaught page error: ${err.message}`);
  });
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      // Console errors alone don't always mean a dead page, but a Vite
      // module-load error does; record only load-ish errors.
      const text = msg.text();
      // Ignore 4xx resource errors: error-path scenarios legitimately
      // exercise them (e.g. a malformed SPARQL query returning 400).
      // Real boot failures surface as 5xx (also caught by the response
      // listener) or as module-load errors.
      if (/status of 4\d\d/.test(text)) return;
      if (/Failed to load|Loading chunk|Importing a module script failed/i.test(text)) {
        failures.push(`console error: ${text}`);
      }
    }
  });

  function buildError(cause?: unknown): Error {
    const detail = failures.map((f) => `  - ${f}`).join("\n");
    return new Error(
      `The site failed to load:\n${detail}` +
        (cause instanceof Error ? `\n(original error: ${cause.message})` : ""),
    );
  }

  return {
    assertPageLoaded() {
      if (failures.length > 0) throw buildError();
    },
    async guarded<T>(promise: Promise<T>): Promise<T> {
      if (failures.length > 0) {
        // Fail fast, but don't leave the underlying promise unhandled.
        promise.catch(() => {});
        throw buildError();
      }
      try {
        return await promise;
      } catch (err) {
        if (failures.length > 0) throw buildError(err);
        throw err;
      }
    },
    failures() {
      return failures;
    },
  };
}
