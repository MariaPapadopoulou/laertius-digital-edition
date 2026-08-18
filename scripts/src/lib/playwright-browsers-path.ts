// Side-effect module: sets PLAYWRIGHT_BROWSERS_PATH so playwright-core can
// find the headless Chromium install, no matter which cache directory it
// lives in.
//
// playwright-core resolves its browser registry AT MODULE IMPORT TIME from
// PLAYWRIGHT_BROWSERS_PATH, so e2e scripts must import THIS module before
// dynamically importing playwright-core:
//
//   import "./lib/playwright-browsers-path";
//   const { chromium } = await import("playwright-core");
//
// (A static `import` of playwright-core in the same file would defeat the
// ordering guarantee — always use the dynamic form shown above.)
//
// Every browser e2e/validate script shares this ONE bootstrap; if the cache
// location ever changes, fix the candidate list in headless-chromium.ts and
// every check is fixed at once.
import {
  findHeadlessChromiumDir,
  playwrightBrowsersPathCandidates,
} from "../headless-chromium";

if (!process.env.PLAYWRIGHT_BROWSERS_PATH) {
  process.env.PLAYWRIGHT_BROWSERS_PATH =
    findHeadlessChromiumDir() ?? playwrightBrowsersPathCandidates()[0];
}
