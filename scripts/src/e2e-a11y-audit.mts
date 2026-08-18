/// <reference lib="dom" />
// Accessibility audit gate (task 649): axe-core sweep over every routed page
// in BOTH themes (light + dark) at a desktop viewport, plus a phone-width
// (390px) pass over routes with distinct mobile chrome (task 713).
// FAILS (exit 1) on any violation of:
//   - WCAG 2.0/2.1 A + AA rules (includes color-contrast >= 4.5:1, image-alt)
//   - heading-order (no skipped heading levels)
//   - page-has-heading-one, plus a custom exactly-one-<h1> check
//   - target-size (WCAG 2.2 tap-target size) on the mobile viewport pass
//     (task 843), with its own non-vacuous positive control
// Positive controls: every route must actually be audited and axe must have
// evaluated a non-zero number of nodes, or the run fails as vacuous.
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

import "./lib/playwright-browsers-path";
const { chromium } = await import("playwright-core");
const { attachPageGuard } = await import("./lib/e2e-page-guard");

const require = createRequire(import.meta.url);
const AXE_SOURCE = readFileSync(require.resolve("axe-core/axe.min.js"), "utf8");

const { SAMPLE_ROUTES } = await import("./lib/audit-routes");

const BASE = process.env.E2E_BASE_URL ?? "http://localhost:80";

// Shared canonical route list (task 818): see scripts/src/lib/audit-routes.
const ROUTES = [...SAMPLE_ROUTES];

// Every route is re-audited at a phone-width viewport (task 780): mobile-only
// contrast or heading regressions on ANY page would otherwise ship unseen.
// (Originally only the five routes with distinct mobile chrome, task 713.)
const MOBILE_ROUTES = ROUTES;

// The full sweep is 4 × |ROUTES| page audits, which can exceed a single
// shell/CI step's time budget. E2E_A11Y_THEMES / E2E_A11Y_VIEWPORTS
// (comma-separated) gate the run to a subset so it can be split into
// sequential chunks; the positive-control expected count scales with the
// selected subset, and an unknown name fails loudly instead of shrinking
// the sweep to nothing.
const ALL_THEMES = ["light", "dark"] as const;
const ALL_VIEWPORTS = [
  { label: "desktop", width: 1280, height: 900, routes: ROUTES },
  { label: "mobile", width: 390, height: 844, routes: MOBILE_ROUTES },
] as const;
function filterByEnv<T>(all: readonly T[], envName: string, nameOf: (t: T) => string): T[] {
  const raw = process.env[envName]?.trim();
  if (!raw) return [...all];
  const wanted = raw.split(",").map((s) => s.trim()).filter(Boolean);
  const unknown = wanted.filter((w) => !all.some((t) => nameOf(t) === w));
  if (unknown.length > 0 || wanted.length === 0) {
    console.error(`Invalid ${envName}="${raw}" (valid: ${all.map(nameOf).join(", ")})`);
    process.exit(1);
  }
  return all.filter((t) => wanted.includes(nameOf(t)));
}
const THEMES = filterByEnv(ALL_THEMES, "E2E_A11Y_THEMES", (t) => t);
const VIEWPORTS = filterByEnv(ALL_VIEWPORTS, "E2E_A11Y_VIEWPORTS", (v) => v.label);

let failures = 0;
let checked = 0;
let totalNodesEvaluated = 0;
// Positive control for the mobile-only target-size rule (task 843): axe must
// have actually evaluated a non-zero number of nodes for it, or the tap-target
// check was vacuous.
let targetSizeNodesEvaluated = 0;

for (const viewport of VIEWPORTS)
for (const theme of THEMES) {
  // A fresh browser per theme/viewport combination: one long-lived browser
  // accumulates renderer memory across ~50 axe-audited pages and can die
  // mid-sweep under load ("Target page, context or browser has been
  // closed"), losing the whole run instead of one combination.
  const ROUTES = viewport.routes;
  const label = `${theme}/${viewport.label}`;
  const makeCtx = async () => {
    const b = await chromium.launch({ headless: true });
    const c = await b.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      colorScheme: theme,
    });
    await c.addInitScript((t: string) => {
      localStorage.setItem("laertius-theme", t);
    }, theme);
    return { browser: b, ctx: c };
  };
  let { browser, ctx } = await makeCtx();
  for (const route of ROUTES) {
    // A fresh page per route: a single page navigating the whole sweep
    // accumulates renderer memory across heavy axe runs and eventually
    // crashes the renderer mid-combination.
    // Under heavy machine load (parallel workflow storms) a navigation can
    // time out or the renderer can crash mid-audit; either used to abort
    // the whole sweep. One retry with a fresh page separates real page
    // problems from load hiccups; the second failure counts as a FAIL.
    let attempt = 0;
    let routeDone = false;
    while (!routeDone && attempt < 2) {
      attempt++;
      // newPage itself can fail when the previous route killed the whole
      // browser process — it must sit INSIDE the try so the relaunch
      // logic sees it.
      let page: Awaited<ReturnType<typeof ctx.newPage>> | null = null;
      try {
        page = await ctx.newPage();
        // Fail fast with the failing URL/status instead of an opaque timeout when
        // the site itself fails to boot (500 on a module/CSS, uncaught error, etc.).
        const guard = attachPageGuard(page);
        await runRoute(page, guard, route);
        routeDone = true;
      } catch (e) {
        if (attempt >= 2) {
          failures++;
          checked++;
          console.log(`FAIL: [${label}] ${route} — audit failed after retry: ${String(e).slice(0, 200)}`);
        } else {
          console.log(`  retry: [${label}] ${route} — ${String(e).slice(0, 120)}`);
          // The whole browser process can be the casualty (OOM under
          // load) — a retry inside the dead browser would fail on
          // newPage. Relaunch a fresh browser+context for the retry.
          await ctx.close().catch(() => {});
          await browser.close().catch(() => {});
          ({ browser, ctx } = await makeCtx());
        }
      } finally {
        await page?.close().catch(() => {});
      }
    }
  }

  async function runRoute(
    page: Awaited<ReturnType<typeof ctx.newPage>>,
    guard: ReturnType<typeof attachPageGuard>,
    route: string,
  ) {
    await page.goto(`${BASE}${route}`, { waitUntil: "load", timeout: 30000 });
    guard.assertPageLoaded();
    await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});
    // Theme class is set by app code; enforce it in case a page rendered
    // before the init script's stored value was applied.
    await page.evaluate((t: string) => {
      document.documentElement.classList.toggle("dark", t === "dark");
    }, theme);
    await page.waitForTimeout(600);

    await page.evaluate(AXE_SOURCE);
    // Mobile pass additionally runs axe's "target-size" rule (WCAG 2.2 /
    // best-practice, task 843): buttons/links too small to tap on a phone
    // would otherwise ship unseen. Enabling it by name alongside the tag-based
    // runOnly makes axe include it even though it carries none of those tags.
    const isMobile = viewport.label === "mobile";
    const result = (await page.evaluate(`
      axe.run(document, {
        runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] },
        rules: {
          "heading-order": { enabled: true },
          "page-has-heading-one": { enabled: true },
          "target-size": { enabled: ${isMobile} },
        },
      }).then(r => {
        const tsNodes = ["passes", "violations", "incomplete"]
          .flatMap(k => r[k])
          .filter(g => g.id === "target-size")
          .reduce((a, g) => a + g.nodes.length, 0);
        return {
          violations: r.violations.map(v => ({
            id: v.id,
            impact: v.impact,
            help: v.help,
            nodes: v.nodes.slice(0, 5).map(n => n.target.join(" ").slice(0, 160)),
            count: v.nodes.length,
          })),
          passesNodes: r.passes.reduce((a, p) => a + p.nodes.length, 0),
          targetSizeNodes: tsNodes,
        };
      })
    `)) as {
      violations: { id: string; impact: string; help: string; nodes: string[]; count: number }[];
      passesNodes: number;
      targetSizeNodes: number;
    };
    totalNodesEvaluated += result.passesNodes;
    targetSizeNodesEvaluated += result.targetSizeNodes;

    const h1Count = (await page.evaluate(
      `document.querySelectorAll("h1").length`,
    )) as number;

    checked++;
    const problems: string[] = [];
    for (const v of result.violations) {
      problems.push(`${v.id} (${v.impact}, ${v.count} node${v.count === 1 ? "" : "s"}): ${v.help}`);
      for (const n of v.nodes) problems.push(`    ${n}`);
    }
    if (h1Count !== 1) problems.push(`expected exactly one <h1>, found ${h1Count}`);

    const ok = problems.length === 0;
    if (!ok) failures++;
    console.log(`${ok ? "  ok" : "FAIL"}: [${label}] ${route}`);
    for (const line of problems) console.log(`        ${line}`);
  }
  await ctx.close();
  await browser.close();
}

const expected =
  VIEWPORTS.reduce((a, v) => a + v.routes.length, 0) * THEMES.length;
if (checked < expected) {
  console.error(`\nOnly ${checked}/${expected} route×theme×viewport combinations audited`);
  process.exit(1);
}
if (totalNodesEvaluated === 0) {
  console.error(`\nPositive control failed: axe evaluated zero nodes — audit was vacuous`);
  process.exit(1);
}
if (VIEWPORTS.some((v) => v.label === "mobile") && targetSizeNodesEvaluated === 0) {
  console.error(`\nPositive control failed: axe evaluated zero nodes for the target-size rule — tap-target check was vacuous`);
  process.exit(1);
}
if (failures > 0) {
  console.error(`\n${failures} page(s) failed the accessibility audit`);
  process.exit(1);
}
console.log(`\nAll ${checked} route×theme×viewport pages pass the axe accessibility audit (${totalNodesEvaluated} passing node checks)`);
