/// <reference lib="dom" />
// Skip-link keyboard check (task 712): on several routes, pressing Tab once
// must focus the "Skip to main content" link, the link must be VISIBLE while
// focused (not screen-reader-only), and activating it with Enter must move
// focus to the <main id="main-content"> landmark. Checked in both themes so a
// theme-specific style regression can't hide the focused link.

import "./lib/playwright-browsers-path";
const { chromium } = await import("playwright-core");
const { attachPageGuard } = await import("./lib/e2e-page-guard");

const BASE = process.env.E2E_BASE_URL ?? "http://localhost:80";
const ROUTES = ["/", "/browse", "/graph", "/about", "/legomena"];
const THEMES = ["light", "dark"] as const;

let failures = 0;
let checked = 0;

const browser = await chromium.launch({ headless: true });

for (const theme of THEMES) {
  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    colorScheme: theme,
  });
  // String form: function-form init scripts silently fail under tsx.
  await ctx.addInitScript(`localStorage.setItem("laertius-theme", ${JSON.stringify(theme)});`);
  const page = await ctx.newPage();
  // Shared page-load guard: report boot failures (500 on a module/CSS,
  // uncaught page error) with the failing URL/status instead of an opaque
  // failure. The page is reused across routes, so compare failure counts
  // per route rather than calling assertPageLoaded() (which would blame
  // later routes for an earlier route's recorded failure).
  const guard = attachPageGuard(page);

  for (const route of ROUTES) {
    checked++;
    const label = `[${theme}] ${route}`;
    const problems: string[] = [];
    try {
      const failuresBefore = guard.failures().length;
      const resp = await page.goto(`${BASE}${route}`, { waitUntil: "load", timeout: 30000 });
      const newFailures = guard.failures().slice(failuresBefore);
      if ((resp && !resp.ok()) || newFailures.length > 0) {
        failures++;
        console.log(`FAIL: ${label}`);
        if (resp && !resp.ok()) {
          console.log(`        site failed to load: HTTP ${resp.status()} — is the laertius dev server running?`);
        }
        for (const f of newFailures) console.log(`        site failed to load: ${f}`);
        continue;
      }
      await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});
      await page.evaluate(
        `document.documentElement.classList.toggle("dark", ${JSON.stringify(theme === "dark")})`,
      );
      // Positive control: the skip link and the main landmark must exist at all.
      const present = (await page.evaluate(
        `!!document.querySelector('a[href="#main-content"]') && !!document.getElementById("main-content")`,
      )) as boolean;
      if (!present) {
        problems.push("skip link or #main-content landmark missing from the DOM");
      } else {
        // Before tabbing, the link must be visually hidden (sr-only).
        const hiddenBefore = (await page.evaluate(`(() => {
          const a = document.querySelector('a[href="#main-content"]');
          const r = a.getBoundingClientRect();
          return r.width <= 1 && r.height <= 1;
        })()`)) as boolean;
        if (!hiddenBefore) problems.push("skip link is visible before it receives focus");

        // One Tab from the top of the page must land on the skip link…
        await page.evaluate(`document.activeElement && document.activeElement.blur()`);
        await page.keyboard.press("Tab");
        const afterTab = (await page.evaluate(`(() => {
          const el = document.activeElement;
          if (!el) return { isSkip: false };
          const r = el.getBoundingClientRect();
          const cs = getComputedStyle(el);
          return {
            isSkip: el.matches('a[href="#main-content"]'),
            text: (el.textContent || "").trim(),
            visible:
              r.width > 20 && r.height > 10 &&
              cs.visibility !== "hidden" && cs.display !== "none" &&
              parseFloat(cs.opacity) > 0.9 &&
              r.top >= 0 && r.left >= 0 &&
              r.bottom <= innerHeight && r.right <= innerWidth,
          };
        })()`)) as { isSkip: boolean; text?: string; visible?: boolean };
        if (!afterTab.isSkip) {
          problems.push(`first Tab did not focus the skip link (focused: ${afterTab.text || "nothing"})`);
        } else {
          if (!afterTab.visible) problems.push("skip link is focused but not visibly rendered in the viewport");
          if (!/skip to main content/i.test(afterTab.text ?? "")) {
            problems.push(`unexpected skip link text: "${afterTab.text}"`);
          }
          // …and Enter must hand focus to the main landmark.
          await page.keyboard.press("Enter");
          await page.waitForTimeout(200);
          const focusOnMain = (await page.evaluate(
            `document.activeElement === document.getElementById("main-content")`,
          )) as boolean;
          if (!focusOnMain) {
            const now = (await page.evaluate(
              `document.activeElement ? document.activeElement.tagName + "#" + (document.activeElement.id || "") : "none"`,
            )) as string;
            problems.push(`Enter on the skip link did not move focus to #main-content (focus: ${now})`);
          }
        }
      }
    } catch (e) {
      problems.push(`page failed to load or check crashed: ${String(e).slice(0, 200)}`);
    }
    const ok = problems.length === 0;
    if (!ok) failures++;
    console.log(`${ok ? "  ok" : "FAIL"}: ${label}`);
    for (const p of problems) console.log(`        ${p}`);
  }
  await ctx.close();
}

await browser.close();

const expected = ROUTES.length * THEMES.length;
if (checked < expected) {
  console.error(`\nOnly ${checked}/${expected} route×theme combinations checked`);
  process.exit(1);
}
if (failures > 0) {
  console.error(`\n${failures} route×theme check(s) failed the skip-link audit`);
  process.exit(1);
}
console.log(`\nAll ${checked} route×theme pages pass the skip-link keyboard check`);
