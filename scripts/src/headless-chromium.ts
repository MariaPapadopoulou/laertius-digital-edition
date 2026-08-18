/**
 * Locate the playwright-core browser install directory used by the browser
 * e2e scripts (e2e-csp-violations etc.).
 *
 * playwright-core resolves its browser registry AT MODULE IMPORT TIME from
 * PLAYWRIGHT_BROWSERS_PATH, so callers must set that env var BEFORE
 * importing playwright-core (via a dynamic `await import`).
 *
 * Install once with:
 *   PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright \
 *     node scripts/node_modules/playwright-core/cli.js install chromium-headless-shell
 */
import { existsSync, readdirSync } from "node:fs";
import path from "node:path";

/** Candidate ms-playwright cache directories, in probe order. */
export function playwrightBrowsersPathCandidates(): string[] {
  return [
    ...(process.env.XDG_CACHE_HOME
      ? [`${process.env.XDG_CACHE_HOME}/ms-playwright`]
      : []),
    `${process.env.HOME}/.cache/ms-playwright`,
    path.resolve(import.meta.dirname, "../../.cache/ms-playwright"),
  ];
}

/**
 * The first candidate directory that actually contains a chromium* install,
 * or undefined when no headless Chromium is available anywhere.
 * Honors an explicit PLAYWRIGHT_BROWSERS_PATH (still verified for a
 * chromium* dir so a stale env var is not mistaken for a real install).
 */
export function findHeadlessChromiumDir(): string | undefined {
  const candidates = [
    ...(process.env.PLAYWRIGHT_BROWSERS_PATH
      ? [process.env.PLAYWRIGHT_BROWSERS_PATH]
      : []),
    ...playwrightBrowsersPathCandidates(),
  ];
  return candidates.find(
    (p) =>
      existsSync(p) && readdirSync(p).some((d) => d.startsWith("chromium")),
  );
}
