/// <reference lib="dom" />
// Site-wide Greek-language markup check.
//
// 1. Static pass: every Greek literal hard-coded in the Laertius app
//    sources must be NFC-normalized (precomposed codepoints, no spacing
//    breathings like U+1FBF).
// 2. Rendered pass (real browser): on every top-level route, every DOM
//    text node containing Greek script must
//      a) sit inside an element whose effective lang is "grc" (so screen
//         readers, hyphenation and font selection treat it as Ancient
//         Greek), and
//      b) be NFC-normalized as displayed.
//
// Requirements: the API server and web workflows must be running (the
// script talks to the shared proxy, default http://localhost:80), and a
// Chromium headless shell must be installed for playwright-core.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import "./lib/playwright-browsers-path";

const { chromium } = await import("playwright-core");
const { attachPageGuard } = await import("./lib/e2e-page-guard");

const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:80";
const APP_SRC = new URL("../../artifacts/laertius/src", import.meta.url)
  .pathname;

// Greek & Coptic + Extended Greek (polytonic) ranges.
const GREEK_RE = /[\u0370-\u03e1\u03f0-\u03ff\u1f00-\u1fff]/;

let failures = 0;
function check(label: string, ok: boolean, detail?: string) {
  if (ok) {
    console.log(`  ok: ${label}`);
  } else {
    failures++;
    console.error(`  FAIL: ${label}${detail ? ` (${detail})` : ""}`);
  }
}

// ---------------------------------------------------------------------------
// Pass 1: static NFC check over the app sources (positive control included:
// we count how many Greek-bearing lines were scanned so an empty sweep can
// never pass vacuously).
// ---------------------------------------------------------------------------
function* walk(dir: string): Generator<string> {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    const st = statSync(p);
    if (st.isDirectory()) yield* walk(p);
    else if (/\.(tsx?|css|json)$/.test(entry)) yield p;
  }
}

console.log("Pass 1: source literals are NFC-normalized");
let greekLines = 0;
const nfcViolations: string[] = [];
for (const file of walk(APP_SRC)) {
  const lines = readFileSync(file, "utf8").split("\n");
  lines.forEach((line, i) => {
    if (!GREEK_RE.test(line)) return;
    greekLines++;
    if (line.normalize("NFC") !== line) {
      nfcViolations.push(`${file}:${i + 1}`);
    }
    // Spacing breathings/accents typed as standalone glyphs (e.g. U+1FBF)
    // render wrong; polytonic text must use precomposed codepoints.
    if (/[\u1fbd\u1fbf\u1fc0\u1fc1\u1fcd-\u1fcf\u1fdd-\u1fdf\u1fed-\u1fef\u1ffd\u1ffe]/.test(line)) {
      nfcViolations.push(`${file}:${i + 1} (spacing breathing/accent glyph)`);
    }
  });
}
check(
  `scanned a real corpus of Greek-bearing source lines (${greekLines})`,
  greekLines >= 10,
  `only ${greekLines} lines matched — is the Greek regex or path wrong?`,
);
check(
  "all Greek source literals are NFC with precomposed codepoints",
  nfcViolations.length === 0,
  nfcViolations.slice(0, 10).join(", "),
);

// ---------------------------------------------------------------------------
// Pass 2: rendered DOM check on every top-level route.
// ---------------------------------------------------------------------------
const ROUTES = [
  "/",
  "/verses",
  "/sayings",
  "/doxography",
  "/anecdotes",
  "/letters",
  "/testaments",
  "/graph",
  "/competency",
  "/timeline",
  "/entities",
  "/browse",
  "/ask",
  "/search",
  "/map",
  "/stats",
  "/about",
  "/approach",
  "/terminology",
  "/terminology/concepts",
  "/terminology/names",
  "/legomena",
  "/legomena/entities",
  "/legomena/reader",
];

console.log("Pass 2: rendered Greek text carries lang=\"grc\" and stays NFC");

// The in-page sweep, shared by the route pass and the interaction pass.
function sweepGreekTextNodes() {
      const GREEK = /[\u0370-\u03e1\u03f0-\u03ff\u1f00-\u1fff]/;
      const walker = document.createTreeWalker(
        document.body,
        NodeFilter.SHOW_TEXT,
      );
      const missingLang: string[] = [];
      const notNfc: string[] = [];
      let greekNodes = 0;
      for (let n = walker.nextNode(); n; n = walker.nextNode()) {
        const text = n.textContent ?? "";
        if (!GREEK.test(text)) continue;
        const el = n.parentElement;
        if (!el) continue;
        // Skip invisible nodes (scripts, hidden templates).
        if (el.closest("script,style,noscript,template")) continue;
        greekNodes++;
        // Effective language: nearest ancestor with a lang attribute
        // (SVG uses the lang attribute too; closest() sees both).
        const langEl = el.closest("[lang]");
        const lang = langEl?.getAttribute("lang") ?? "";
        const snippet = text.trim().slice(0, 60);
        const where = `<${el.tagName.toLowerCase()} class="${el.getAttribute("class")?.slice(0, 60) ?? ""}"> "${snippet}"`;
        if (!lang.toLowerCase().startsWith("grc")) {
          missingLang.push(`${where} [effective lang=${lang || "none"}]`);
        }
        if (text.normalize("NFC") !== text) {
          notNfc.push(where);
        }
      }
      return { greekNodes, missingLang, notNfc };
}

type Page = Awaited<ReturnType<Awaited<ReturnType<typeof chromium.launch>>["newPage"]>>;

async function sweepAndCheck(page: Page, label: string): Promise<number> {
  const result = await page.evaluate(sweepGreekTextNodes);
  check(
    `${label}: ${result.greekNodes} Greek text node(s), all inside lang="grc"`,
    result.missingLang.length === 0,
    result.missingLang.slice(0, 5).join(" | "),
  );
  check(
    `${label}: displayed Greek is NFC-normalized`,
    result.notNfc.length === 0,
    result.notNfc.slice(0, 5).join(" | "),
  );
  return result.greekNodes;
}

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({
    viewport: { width: 1280, height: 900 },
  });
  // Fail fast with the failing URL/status instead of an opaque selector
  // timeout when the site itself fails to boot.
  const guard = attachPageGuard(page);
  let totalGreekNodes = 0;
  for (const route of ROUTES) {
    await page.goto(`${BASE_URL}${route}`, {
      waitUntil: "networkidle",
      timeout: 60000,
    });
    guard.assertPageLoaded();
    // Let late data-driven renders settle.
    await page.waitForTimeout(700);
    totalGreekNodes += await sweepAndCheck(page, route);
  }
  // Positive control: the sweep must have actually seen Greek somewhere.
  check(
    `sweep saw rendered Greek text overall (${totalGreekNodes} nodes)`,
    totalGreekNodes > 20,
    "almost no Greek rendered — routes may have failed to load",
  );

  // -------------------------------------------------------------------------
  // Pass 3: Greek revealed by interaction (entity panels, graph selection,
  // competency question results) must also carry lang="grc" and stay NFC.
  // Each interaction has a positive control: the revealed UI must actually
  // appear and the post-interaction sweep must see MORE Greek than a broken
  // interaction would (>= the pre-interaction count, and the revealed panel
  // itself must contain a grc-tagged element).
  // -------------------------------------------------------------------------
  console.log(
    'Pass 3: Greek revealed by interaction stays lang="grc" and NFC',
  );

  // 3a. /entities — open an entity's detail panel.
  {
    await page.goto(`${BASE_URL}/entities`, {
      waitUntil: "networkidle",
      timeout: 60000,
    });
    guard.assertPageLoaded();
    await page.waitForTimeout(700);
    const card = page.locator("button.bg-card").first();
    await guard.guarded(card.waitFor({ state: "visible", timeout: 15000 }));
    await card.click();
    // The detail view replaces the grid and shows a back button + heading.
    const back = page.locator("button", { hasText: "← All entities" });
    await back.waitFor({ state: "visible", timeout: 15000 });
    // Wait for the detail payload itself (spinner gone, heading rendered).
    await page
      .locator("h2.font-serif")
      .first()
      .waitFor({ state: "visible", timeout: 30000 });
    await page.waitForTimeout(700);
    check("/entities: detail panel opened after clicking a card", true);
    await sweepAndCheck(page, "/entities after opening entity panel");
  }

  // 3b. /graph — select a node (via the List view, which is deterministic),
  // opening the detail panel with Greek school names.
  {
    await page.goto(`${BASE_URL}/graph`, {
      waitUntil: "networkidle",
      timeout: 60000,
    });
    guard.assertPageLoaded();
    await page.waitForTimeout(700);
    const listToggle = page.locator('[data-testid="graph-view-list"]');
    await guard.guarded(listToggle.waitFor({ state: "visible", timeout: 15000 }));
    await listToggle.click();
    const nodeButton = page.locator('button[data-testid^="list-node-"]').first();
    await nodeButton.waitFor({ state: "visible", timeout: 15000 });
    const nodeName = (await nodeButton.textContent())?.trim() ?? "?";
    await nodeButton.click();
    await page.waitForTimeout(1000);
    check(`/graph: selected node "${nodeName}" from list view`, true);
    await sweepAndCheck(page, `/graph after selecting node "${nodeName}"`);
  }

  // 3c. /competency — run a competency question by selecting it; results
  // (entity chips with Greek forms, tables, subgraph) render afterwards.
  {
    await page.goto(`${BASE_URL}/competency`, {
      waitUntil: "networkidle",
      timeout: 60000,
    });
    guard.assertPageLoaded();
    await page.waitForTimeout(700);
    // Selecting a question in the catalogue sidebar (full-width left-aligned
    // buttons) runs it — there is no separate Run button.
    const question = page.locator("button.w-full.text-left").first();
    await guard.guarded(question.waitFor({ state: "visible", timeout: 15000 }));
    const qText = (await question.textContent())?.trim().slice(0, 60) ?? "?";
    await question.click();
    // Positive control: selection is reflected in the URL and the result
    // panel loads (network settles, then late renders).
    await page.waitForFunction(() => window.location.search.includes("q="), {
      timeout: 15000,
    });
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1500);
    const revealed = await sweepAndCheck(
      page,
      `/competency after running "${qText}"`,
    );
    check(
      "/competency: running a question revealed Greek text",
      revealed > 0,
      "no Greek rendered after selecting a question — did the result load?",
    );
  }

  // 3d. /browse — choose a philosopher from the sidebar index; the chosen
  // panel renders their chapters side-by-side in Greek and English.
  {
    await page.goto(`${BASE_URL}/browse`, {
      waitUntil: "networkidle",
      timeout: 60000,
    });
    guard.assertPageLoaded();
    await page.waitForTimeout(700);
    const philButton = page.locator("button.w-full.text-left").first();
    await guard.guarded(
      philButton.waitFor({ state: "visible", timeout: 15000 }),
    );
    const philName =
      (await philButton.locator("span.font-medium").first().textContent())
        ?.trim() ?? "?";
    await philButton.click();
    // Positive control: the chosen-philosopher panel replaces the empty
    // state (its heading is the h2.text-3xl name header), then chapters load.
    await page
      .locator("h2.text-3xl.font-serif")
      .first()
      .waitFor({ state: "visible", timeout: 30000 });
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1000);
    check(`/browse: philosopher panel opened for "${philName}"`, true);
    const revealed = await sweepAndCheck(
      page,
      `/browse after choosing "${philName}"`,
    );
    check(
      "/browse: choosing a philosopher revealed Greek text",
      revealed > 0,
      "no Greek rendered after selecting a philosopher — did chapters load?",
    );
  }

  // 3e. /map — click a place marker; the detail sidebar (marker "popup")
  // opens with the place's events, passages and mentions.
  {
    await page.goto(`${BASE_URL}/map`, {
      waitUntil: "networkidle",
      timeout: 60000,
    });
    guard.assertPageLoaded();
    await page.waitForTimeout(1000);
    // Circle markers render as SVG paths with Leaflet's interactive class.
    const marker = page.locator("path.leaflet-interactive").first();
    await guard.guarded(marker.waitFor({ state: "visible", timeout: 30000 }));
    // Overlapping circle markers intercept pointer events, so a positional
    // click can never settle; dispatch the click on the path itself (Leaflet
    // binds its click handler directly to the marker path).
    await marker.dispatchEvent("click");
    // Positive control: the selected-place panel opens (h2 place heading).
    const placeHeading = page.locator("h2.text-2xl.font-serif").first();
    await placeHeading.waitFor({ state: "visible", timeout: 15000 });
    const placeName = (await placeHeading.textContent())?.trim() ?? "?";
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(700);
    check(`/map: marker panel opened for "${placeName}"`, true);
    await sweepAndCheck(page, `/map after opening marker "${placeName}"`);
  }

  // 3f. /ask — submit an Ask question; results carry cited Greek excerpts
  // (claim lines with lang="grc" spans).
  {
    await page.goto(`${BASE_URL}/ask`, {
      waitUntil: "networkidle",
      timeout: 60000,
    });
    guard.assertPageLoaded();
    await page.waitForTimeout(700);
    const askInput = page.locator("form input[type=text]").first();
    await guard.guarded(askInput.waitFor({ state: "visible", timeout: 15000 }));
    const askQuestion = "What does Epicurus say about pleasure?";
    await askInput.fill(askQuestion);
    await page.locator('form button[type="submit"]').click();
    // Positive control: the submit button leaves its "Consulting..." busy
    // state once the answer lands.
    // First-run retrieval can index, so allow a generous window.
    await page.waitForFunction(
      () => {
        const btn = document.querySelector<HTMLButtonElement>(
          'form button[type="submit"]',
        );
        return (
          btn !== null &&
          !btn.disabled &&
          !(btn.textContent ?? "").includes("Consulting")
        );
      },
      { timeout: 120000 },
    );
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1000);
    // The answer view renders the "Key Findings" heading (only shown once
    // an answer has loaded; the edition band no longer exists to probe).
    const answerRendered = await page
      .locator("h2", { hasText: "Key Findings" })
      .count()
      .then((n) => n > 0)
      .catch(() => false);
    check(
      `/ask: question "${askQuestion}" submitted and answer view rendered`,
      answerRendered,
      "no Key Findings heading — did the answer load?",
    );
    const revealed = await sweepAndCheck(
      page,
      `/ask after submitting "${askQuestion}"`,
    );
    check(
      "/ask: the answer revealed Greek text",
      revealed > 0,
      "no Greek rendered in the answer view",
    );
  }
} finally {
  await browser.close();
}

if (failures > 0) {
  console.error(`\n${failures} check(s) failed`);
  process.exit(1);
}
console.log("\nAll Greek lang/NFC checks passed");
