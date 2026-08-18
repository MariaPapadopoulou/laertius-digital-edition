/// <reference lib="dom" />
// Dark-mode readability sweep: loads every major page with the stored
// theme preference set to dark, screenshots it, and flags (a) large
// elements whose computed background stayed light (hardcoded light
// colors) and (b) pages where the <html> element never got the .dark
// class. Screenshots land in docs/verification/dark-mode-sweep/.
import { mkdirSync } from "node:fs";

import "./lib/playwright-browsers-path";
const { chromium } = await import("playwright-core");
const { attachPageGuard } = await import("./lib/e2e-page-guard");

const BASE = process.env.E2E_BASE_URL ?? "http://localhost:80";
const OUT = new URL("../../docs/verification/dark-mode-sweep", import.meta.url)
  .pathname;
mkdirSync(OUT, { recursive: true });

const ROUTES = [
  "/", "/search", "/browse", "/verses", "/sayings", "/doxography",
  "/anecdotes", "/letters", "/testaments", "/graph", "/competency",
  "/map", "/timeline", "/entities", "/stats", "/about",
  "/terminology", "/terminology/concepts", "/terminology/objects",
  "/terminology/names",
  "/legomena", "/legomena/graph", "/legomena/entities",
  "/legomena/reader", "/legomena/sparql",
];

let failures = 0;
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({
  viewport: { width: 1280, height: 900 },
  colorScheme: "dark",
});
await ctx.addInitScript(() => {
  localStorage.setItem("laertius-theme", "dark");
});
const page = await ctx.newPage();
// Fail fast with the failing URL/status instead of an opaque timeout when the
// site itself fails to boot (500 on a module/CSS, uncaught page error, etc.).
const guard = attachPageGuard(page);

for (const route of ROUTES) {
  const slug = route === "/" ? "home" : route.slice(1).replace(/\//g, "-");
  try {
    await page.goto(`${BASE}${route}`, { waitUntil: "networkidle", timeout: 45000 });
  } catch {
    // networkidle can time out on pages with polling; continue with what loaded
  }
  // Surface a real boot failure (500/module error) loudly instead of letting
  // the lenient networkidle catch above mask it as a merely-idle-timeout page.
  guard.assertPageLoaded();
  await page.waitForTimeout(1200);
  const report = (await page.evaluate(`(() => {
    const isDark = document.documentElement.classList.contains("dark");
    // Leaflet map tiles are raster images and legitimately light; skip them.
    const skip = (el) =>
      el.closest(".leaflet-container") !== null ||
      el.tagName === "IMG" || el.tagName === "VIDEO" || el.tagName === "IFRAME";
    const offenders = [];
    for (const el of Array.from(document.querySelectorAll("body *"))) {
      if (skip(el)) continue;
      const r = el.getBoundingClientRect();
      const area = r.width * r.height;
      if (area < 12000) continue;
      const bg = getComputedStyle(el).backgroundColor;
      const m = bg.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
      if (!m) continue;
      const [, R, G, B, A] = m;
      if (A !== undefined && parseFloat(A) < 0.5) continue;
      const lum = (0.2126 * +R + 0.7152 * +G + 0.0722 * +B) / 255;
      if (lum > 0.78) {
        offenders.push({
          tag: el.tagName.toLowerCase(),
          cls: (el.className && typeof el.className === "string" ? el.className : "").slice(0, 80),
          bg,
          area: Math.round(area),
        });
      }
    }
    return { isDark, offenders: offenders.slice(0, 6) };
  })()`)) as { isDark: boolean; offenders: { tag: string; cls: string; bg: string; area: number }[] };
  await page.screenshot({ path: `${OUT}/${slug}.png`, fullPage: false });
  const ok = report.isDark && report.offenders.length === 0;
  if (!ok) failures++;
  console.log(
    `${ok ? "  ok" : "FAIL"}: ${route} dark=${report.isDark} lightBlocks=${report.offenders.length}`,
  );
  for (const o of report.offenders) {
    console.log(`        <${o.tag} class="${o.cls}"> bg=${o.bg} area=${o.area}`);
  }
}

await browser.close();
if (failures > 0) {
  console.error(`\n${failures} page(s) failed the dark sweep`);
  process.exit(1);
}
console.log("\nAll pages pass the dark-mode sweep");
