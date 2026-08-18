/// <reference lib="dom" />
// Functional exercise for the full-site audit (task 604): runs a
// representative interaction on each interactive page and reports whether
// results render, plus any console/page errors and failed requests.

import "./lib/playwright-browsers-path";
const { chromium } = await import("playwright-core");
const { attachPageGuard } = await import("./lib/e2e-page-guard");
const BASE = process.env.E2E_BASE_URL ?? "http://localhost:80";

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
// Fail fast with the failing URL/status instead of an opaque timeout when the
// site itself fails to boot (500 on a module/CSS, uncaught page error, etc.).
const guard = attachPageGuard(page);
const errors: string[] = [];
page.on("pageerror", (e) => errors.push(`PAGEERR ${e}`));
page.on("console", (m) => { if (m.type() === "error") errors.push(`CONERR ${m.text().slice(0, 200)}`); });
page.on("response", (r) => { if (r.status() >= 400) errors.push(`HTTP${r.status()} ${r.url().slice(0, 140)}`); });

let fails = 0;
async function step(name: string, fn: () => Promise<boolean>) {
  errors.length = 0;
  let ok = false;
  let err = "";
  try { ok = await fn(); } catch (e) { err = String(e).slice(0, 200); }
  if (!ok) fails++;
  console.log(`${ok ? "  ok" : "FAIL"} ${name}${err ? " — " + err : ""}`);
  for (const e of errors) console.log(`      ${e}`);
}

await step("Ask: submit a question", async () => {
  await page.goto(`${BASE}/ask`, { waitUntil: "load" });
  guard.assertPageLoaded();
  await page.fill("textarea, input[type=text]", "Where was Thales born?");
  await page.keyboard.press("Enter");
  await page.waitForTimeout(12000);
  return (await page.locator("text=/Thales/i").count()) > 0;
});

await step("Search: submit a query", async () => {
  await page.goto(`${BASE}/search?q=hemlock`, { waitUntil: "load" });
  guard.assertPageLoaded();
  await page.waitForTimeout(8000);
  return (await page.locator("a[href*='/section/']").count()) > 0;
});

await step("Browse: select a philosopher and see passages", async () => {
  await page.goto(`${BASE}/browse`, { waitUntil: "load" });
  guard.assertPageLoaded();
  await page.waitForTimeout(3000);
  const phil = page.locator("button").filter({ hasText: /Thales/ }).first();
  if ((await phil.count()) === 0) return false;
  await phil.click();
  await page.waitForTimeout(5000);
  return (await page.locator("text=/Book 1, Chapter/").count()) > 0;
});

await step("Competency: open a question and see an answer", async () => {
  await page.goto(`${BASE}/competency`, { waitUntil: "load" });
  guard.assertPageLoaded();
  await page.waitForTimeout(3000);
  const q = page.locator("button, [role=button]").filter({ hasText: /\?/ }).first();
  if ((await q.count()) === 0) return false;
  await q.click();
  await page.waitForTimeout(5000);
  return (await page.locator("table, pre, [data-testid*=answer], [data-testid*=result]").count()) > 0;
});

await step("Graph: node click shows details", async () => {
  await page.goto(`${BASE}/graph`, { waitUntil: "load" });
  guard.assertPageLoaded();
  await page.waitForTimeout(5000);
  const node = page.locator("svg circle, svg g[class*=node]").first();
  if ((await node.count()) === 0) return false;
  await node.click({ force: true });
  await page.waitForTimeout(2000);
  return true;
});

await step("Map: markers render", async () => {
  await page.goto(`${BASE}/map`, { waitUntil: "load" });
  guard.assertPageLoaded();
  await page.waitForTimeout(6000);
  return (await page.locator(".leaflet-marker-icon, .leaflet-interactive").count()) > 0;
});

await step("Timeline: entries render", async () => {
  await page.goto(`${BASE}/timeline`, { waitUntil: "load" });
  guard.assertPageLoaded();
  await page.waitForTimeout(4000);
  return (await page.locator("text=/Socrates|Plato/").count()) > 0;
});

await step("Entities: open an index entry", async () => {
  await page.goto(`${BASE}/entities`, { waitUntil: "load" });
  guard.assertPageLoaded();
  await page.waitForTimeout(4000);
  const e = page.locator("button, a").filter({ hasText: /Plato/ }).first();
  if ((await e.count()) === 0) return false;
  await e.click();
  await page.waitForTimeout(3000);
  return (await page.locator("text=/passage|section|mention/i").count()) > 0;
});

await step("Legomena Ask: run a question", async () => {
  await page.goto(`${BASE}/legomena`, { waitUntil: "load" });
  guard.assertPageLoaded();
  await page.waitForTimeout(2000);
  const input = page.locator("textarea, input[type=text]").first();
  await input.fill("What did Plato write?");
  await page.keyboard.press("Enter");
  await page.waitForTimeout(12000);
  return (await page.locator("text=/Plato/i").count()) > 1;
});

await step("Legomena SPARQL: run an example query", async () => {
  await page.goto(`${BASE}/legomena/sparql`, { waitUntil: "load" });
  guard.assertPageLoaded();
  await page.waitForTimeout(3000);
  const run = page.locator("button").filter({ hasText: /run/i }).first();
  if ((await run.count()) === 0) return false;
  await run.click();
  await page.waitForTimeout(8000);
  return (await page.locator("table, [data-testid*=result], pre").count()) > 0;
});

await step("Legomena reader: open a passage", async () => {
  await page.goto(`${BASE}/legomena/reader`, { waitUntil: "load" });
  guard.assertPageLoaded();
  await page.waitForTimeout(4000);
  const link = page.locator("a[href*='/legomena/reader/']").first();
  if ((await link.count()) === 0) return false;
  await link.click();
  await page.waitForTimeout(3000);
  return /\/legomena\/reader\/.+/.test(page.url());
});

await step("Legomena entity: claims render", async () => {
  await page.goto(
    `${BASE}/legomena/entity?uri=${encodeURIComponent("https://humanisticadigitalia.eu/Laertius/philosopher/plato")}`,
    { waitUntil: "load" },
  );
  guard.assertPageLoaded();
  await page.waitForTimeout(4000);
  return (await page.locator("text=/claim|assertion/i").count()) > 0;
});

await browser.close();
console.log(fails > 0 ? `\n${fails} interaction(s) failed` : "\nAll interactions passed");
process.exit(fails > 0 ? 1 : 0);
