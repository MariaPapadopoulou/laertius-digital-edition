/// <reference lib="dom" />
// Full-site audit sweep (task 604): loads every routed page in light and
// dark themes plus a mobile-width light pass, capturing screenshots,
// console errors, page errors, failed network requests, horizontal
// overflow, and (dark only) large light-background blocks.
// Output: docs/verification/full-audit/{screenshots,audit.json}
import { mkdirSync, writeFileSync } from "node:fs";

import "./lib/playwright-browsers-path";
const { chromium } = await import("playwright-core");
const { attachPageGuard } = await import("./lib/e2e-page-guard");

const { SAMPLE_ROUTES, NOT_FOUND_ROUTE } = await import("./lib/audit-routes");

const BASE = process.env.E2E_BASE_URL ?? "http://localhost:80";
const OUT = new URL("../../docs/verification/full-audit", import.meta.url)
  .pathname;
mkdirSync(`${OUT}/shots`, { recursive: true });

// Shared canonical route list (task 818) plus the deliberate 404 probe:
// see scripts/src/lib/audit-routes.
const ROUTES = [...SAMPLE_ROUTES, NOT_FOUND_ROUTE];

type PageResult = {
  route: string;
  theme: string;
  viewport: string;
  consoleErrors: string[];
  pageErrors: string[];
  failedRequests: string[];
  hOverflow: number; // px of horizontal overflow beyond viewport
  darkApplied?: boolean;
  lightBlocks?: { tag: string; cls: string; bg: string; area: number }[];
  shot: string;
};

const results: PageResult[] = [];
const browser = await chromium.launch({ headless: true });

async function sweep(theme: "light" | "dark", viewport: { width: number; height: number }, vpName: string) {
  const ctx = await browser.newContext({
    viewport,
    colorScheme: theme,
  });
  await ctx.addInitScript(`localStorage.setItem("laertius-theme", "${theme}");`);
  const page = await ctx.newPage();
  // Fail fast with the failing URL/status instead of an opaque timeout when
  // the site itself fails to boot (500 on a module/CSS, uncaught error, etc.).
  const guard = attachPageGuard(page);

  for (const route of ROUTES) {
    const slug =
      (route === "/" ? "home" : route.slice(1).replace(/[^a-zA-Z0-9.-]+/g, "-")).slice(0, 60);
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];
    const failedRequests: string[] = [];
    const onConsole = (msg: any) => {
      if (msg.type() === "error") consoleErrors.push(msg.text().slice(0, 300));
    };
    const onPageError = (err: any) => pageErrors.push(String(err).slice(0, 300));
    const onResponse = (resp: any) => {
      if (resp.status() >= 400) failedRequests.push(`${resp.status()} ${resp.url()}`.slice(0, 200));
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
      guard.assertPageLoaded();
      await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});
    } catch { /* polling pages never go idle */ }
    await page.waitForTimeout(1000);

    const probe = (await page.evaluate(`(() => {
      const isDark = document.documentElement.classList.contains("dark");
      const hOverflow = Math.max(0, document.documentElement.scrollWidth - window.innerWidth);
      const skip = (el) =>
        el.closest(".leaflet-container") !== null ||
        el.tagName === "IMG" || el.tagName === "VIDEO" || el.tagName === "IFRAME" ||
        el.tagName === "CANVAS";
      const offenders = [];
      if (isDark) {
        for (const el of Array.from(document.querySelectorAll("body *"))) {
          if (skip(el)) continue;
          const r = el.getBoundingClientRect();
          const area = r.width * r.height;
          if (area < 12000) continue;
          const bg = getComputedStyle(el).backgroundColor;
          const m = bg.match(/rgba?\\((\\d+),\\s*(\\d+),\\s*(\\d+)(?:,\\s*([\\d.]+))?\\)/);
          if (!m) continue;
          const [, R, G, B, A] = m;
          if (A !== undefined && parseFloat(A) < 0.5) continue;
          const lum = (0.2126 * +R + 0.7152 * +G + 0.0722 * +B) / 255;
          if (lum > 0.78) {
            offenders.push({
              tag: el.tagName.toLowerCase(),
              cls: (el.className && typeof el.className === "string" ? el.className : "").slice(0, 80),
              bg, area: Math.round(area),
            });
          }
        }
      }
      return { isDark, hOverflow, offenders: offenders.slice(0, 5) };
    })()`)) as { isDark: boolean; hOverflow: number; offenders: any[] };

    const shot = `${vpName}-${theme}-${slug}.png`;
    await page.screenshot({ path: `${OUT}/shots/${shot}`, fullPage: true }).catch(async () => {
      await page.screenshot({ path: `${OUT}/shots/${shot}` });
    });

    page.off("console", onConsole);
    page.off("pageerror", onPageError);
    page.off("response", onResponse);
    page.off("requestfailed", onReqFailed);

    const res: PageResult = {
      route, theme, viewport: vpName,
      consoleErrors, pageErrors, failedRequests,
      hOverflow: probe.hOverflow,
      darkApplied: theme === "dark" ? probe.isDark : undefined,
      lightBlocks: theme === "dark" ? probe.offenders : undefined,
      shot,
    };
    results.push(res);
    const bad =
      consoleErrors.length + pageErrors.length + failedRequests.length > 0 ||
      probe.hOverflow > 2 ||
      (theme === "dark" && (!probe.isDark || probe.offenders.length > 0));
    console.log(
      `${bad ? "FLAG" : "  ok"} [${vpName}/${theme}] ${route} con=${consoleErrors.length} err=${pageErrors.length} net=${failedRequests.length} hov=${probe.hOverflow}${theme === "dark" ? ` dark=${probe.isDark} light=${probe.offenders.length}` : ""}`,
    );
  }
  await ctx.close();
}

const which = process.env.SWEEP ?? "all";
if (which === "light" || which === "all") await sweep("light", { width: 1280, height: 900 }, "desktop");
if (which === "dark" || which === "all") await sweep("dark", { width: 1280, height: 900 }, "desktop");
if (which === "mobile" || which === "all") await sweep("light", { width: 390, height: 844 }, "mobile");

writeFileSync(`${OUT}/audit-${which}.json`, JSON.stringify(results, null, 2));
await browser.close();
console.log(`\nWrote ${results.length} page results to ${OUT}/audit-${which}.json`);
