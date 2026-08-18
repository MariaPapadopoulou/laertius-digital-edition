/// <reference lib="dom" />
// One-off visual verification for the digiTatti home restyle (task work).
import "./lib/playwright-browsers-path";

async function main() {
  const { chromium } = await import("playwright-core");
  const { attachPageGuard } = await import("./lib/e2e-page-guard");
  const browser = await chromium.launch();
  const base = "http://127.0.0.1:80";
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  // Fail fast with the failing URL/status instead of an opaque timeout when
  // the site itself fails to boot (500 on a module/CSS, page error, etc.).
  const guard = attachPageGuard(page);
  await page.goto(base + "/", { waitUntil: "networkidle" });
  guard.assertPageLoaded();
  await page.waitForTimeout(2500);
  await page.screenshot({ path: "/tmp/home-hero.png" });

  // scroll cue works
  await page.click('[data-testid="hero-scroll-cue"]');
  await page.waitForTimeout(1500);
  const y1 = await page.evaluate(() => window.scrollY);
  console.log("after scroll cue, scrollY =", y1);
  await page.screenshot({ path: "/tmp/home-edition.png" });

  // reveal sections further down
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight * 0.55));
  await page.waitForTimeout(1200);
  await page.screenshot({ path: "/tmp/home-codex.png" });
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(1200);
  await page.screenshot({ path: "/tmp/home-bottom.png" });

  // dark mode hero
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.evaluate(() => document.documentElement.classList.add("dark"));
  await page.waitForTimeout(600);
  await page.screenshot({ path: "/tmp/home-hero-dark.png" });
  await page.evaluate(() => window.scrollTo(0, 900));
  await page.waitForTimeout(1000);
  await page.screenshot({ path: "/tmp/home-edition-dark.png" });

  // reduced motion: content must still appear
  const ctx = await browser.newContext({ reducedMotion: "reduce", viewport: { width: 1400, height: 900 } });
  const p2 = await ctx.newPage();
  const guard2 = attachPageGuard(p2);
  await p2.goto(base + "/", { waitUntil: "networkidle" });
  guard2.assertPageLoaded();
  await p2.waitForTimeout(1200);
  const heroVisible = await p2.locator("h1[lang=grc]").isVisible();
  console.log("reduced-motion hero visible:", heroVisible);
  await p2.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await p2.waitForTimeout(800);
  const opacities = await p2.evaluate(() =>
    Array.from(document.querySelectorAll("section")).map(
      (s) => getComputedStyle(s).opacity,
    ),
  );
  console.log("reduced-motion section opacities:", opacities.join(","));
  await p2.screenshot({ path: "/tmp/home-reduced.png" });

  // another page for coherence
  await page.evaluate(() => document.documentElement.classList.remove("dark"));
  await page.goto(base + "/about", { waitUntil: "networkidle" });
  guard.assertPageLoaded();
  await page.waitForTimeout(800);
  await page.screenshot({ path: "/tmp/about.png" });

  await browser.close();
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
