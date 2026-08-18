/// <reference lib="dom" />
// The in-page callbacks (page.evaluate / waitForFunction) run in the
// browser, so this Node-side script needs the DOM lib for their types.
//
// Real-browser check of the SPARQL playground embedded in the Competency
// page (pages/competency.tsx + components/sparql-playground.tsx): every
// question with a generated SPARQL query shows a collapsible "SPARQL query"
// block whose panel contains the query text, a copy button, and an embedded
// SparqlPlayground posting to /api/lod/sparql. The existing
// e2e-sparql-playground script only covers the About page playground, so a
// regression in the competency wiring (block not expanding, wrong prefilled
// query, playground broken, error state lost) would ship unnoticed. This
// script makes the check repeatable:
//
// 1. Open /competency?q=stoa-members and click the "SPARQL query" toggle:
//    the panel must open with the CodeMirror playground editor prefilled with
//    the question's own query (lo: prefix + school membership pattern).
// 2. Click "Run query": a results table must render with rows > 0 and the
//    "N rows" counter matching the rendered row count.
// 3. Switch to /competency?q=homonymy-proper-names, expand the block and
//    run the prefilled query: the table must show at least 96 rows (the
//    fixed homonymy query; fewer means the fix regressed).
// 4. Replace the editor content with a malformed query and run it: the
//    inline error box must show the endpoint's "SPARQL query failed"
//    message and the previous results table must be cleared.
// 5. Expand and run on one question, then click a different question in the
//    left-hand list (in-page switch): the block must collapse (the
//    sparqlOpen reset effect on activeId), and re-expanding must show the
//    new question's query in both the pre and the playground editor with
//    no leftover results table from the previous run.
// 6. The competency page also renders its own server-side "Query Results"
//    table below the SPARQL block. Load stoa-members, record its page-level
//    row count and headers (?name), then click homonymy-proper-names in the
//    left-hand list (in-page switch): the page-level table must swap to the
//    new question's data (headers form/name1/name2, >= 96 rows, different
//    from the stoa count), so a stale React Query render can never
//    misattribute rows to the wrong question.
// 7. The same in-page switch must also swap the subgraph node roster
//    (Zone A) and the Source Passages card (Zone D), and the per-node
//    passage drill-down must serve the new question's data: load
//    stoa-members (7 nodes, no Zeno of Elea, passage 7.5.168), open
//    Sphaerus's passage panel, then click homonymy-proper-names in the
//    left-hand list. The roster must grow to the homonymy question's node
//    count with Zeno of Elea present, the stale Sphaerus panel must close,
//    the Source Passages card must show 9.5.25 and drop 7.5.168, and
//    clicking Zeno of Elea must open a panel whose passage links all come
//    from his own tagged sections (fetched live from the annotations API),
//    not leftovers from the previous question or node.
// 8. The same in-page switch must also swap the bilingual terms panel
//    (Zone C, the "Entities" card): before the switch the card shows a
//    term distinctive to stoa-members and not the homonymy question's;
//    after the switch it shows a homonymy-distinctive term and drops the
//    stoa-only one. The distinctive terms are picked live from each
//    question's /api/competency/questions/:id terms array so curation
//    drift cannot silently break the pin.
// 9. A terms-panel chip must really open its cited passage: pick a
//    philosopher term with a firstId live from the question payload,
//    assert the chip href is /section/:firstId and the arrow link href is
//    the encoded /graph?p=, click the chip and land on the rendered
//    section page (Book/Chapter/Section crumb), then follow the arrow
//    link and assert /graph selects the philosopher (?p= in the URL,
//    side panel heading, highlight ring on the node).
// 10. The fallback branch: a term WITHOUT a firstId renders its chip as a
//    /graph?p= link instead of /section/:id (Zone C in competency.tsx).
//    Scan the whole catalogue live for such terms. If any exist whose name
//    is a real graph node, click one and assert the graph selects it. For
//    the rest (names the graph does not know, the designed degradation per
//    validate-competency-graph-links), click one chip and assert the
//    encoded href plus the Graph page's unknown-name notice quoting the
//    name with the Index ?q= escape hatch, so a mis-encoded fallback or a
//    silently blank page can never ship. Whether any philosopher/sage term
//    lacks a firstId is asserted explicitly either way (positive control:
//    currently none do, so the person-chip fallback is pinned dead code).
// 11. The visual focus ring on the clicked subgraph node: SubgraphViz
//    marks the focused node with an extra halo circle, so after clicking
//    a node exactly that node's dot must carry the ring, an in-page
//    question switch must leave no leftover ring, and a fresh click on
//    the new question's node must ring exactly that dot. Without this a
//    regression could open the correct panel while ringing the wrong dot
//    or leaving a stale ring, and no browser check would catch it.
// 12. Edited SPARQL resets cleanly on an in-page question switch: edit the
//    first question's query (the "Reset to example" button must appear),
//    click another question in the left-hand list, re-expand the block:
//    the editor must show the NEW question's own query — not the edit —
//    and the reset button must be absent. Editing the second question's
//    query and clicking "Reset to example" must restore that question's
//    preset. This pins the initialQuery reset effect so a future refactor
//    of the About-page persistence cannot leave a stale edited query
//    attached to the wrong question.
//
// Requirements: the API server and web workflows must be running (the
// script talks to the shared proxy, default http://localhost:80), and a
// Chromium headless shell must be installed for playwright-core, e.g.:
//   PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright \
//     node scripts/node_modules/playwright-core/cli.js install chromium-headless-shell

// playwright-core resolves its browser registry at module import time from
// PLAYWRIGHT_BROWSERS_PATH (default: $XDG_CACHE_HOME/ms-playwright, which in
// this environment points inside the workspace and holds no browsers). Set
// the env var BEFORE importing playwright-core, picking whichever candidate
// actually contains a chromium install.
import "./lib/playwright-browsers-path";
import { PAGE_HEADING_SELECTOR } from "./lib/card-headings";

const { chromium } = await import("playwright-core");
const { attachPageGuard } = await import("./lib/e2e-page-guard");
import type { Page } from "playwright-core";
import type { PageGuard } from "./lib/e2e-page-guard";

const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:80";

let failures = 0;
function check(label: string, ok: boolean, detail?: string) {
  if (ok) {
    console.log(`  ok: ${label}`);
  } else {
    failures++;
    console.error(`  FAIL: ${label}${detail ? ` (${detail})` : ""}`);
  }
}

/** Read the current content of the first CodeMirror SPARQL editor on the page. */
async function getEditorContent(page: Page): Promise<string> {
  return page.evaluate(() => {
    const el = document.querySelector('[data-testid="sparql-query-editor"]');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (el as any)?.__cmView?.state?.doc?.toString() ?? "";
  });
}

/** Replace the content of the first CodeMirror SPARQL editor on the page. */
async function setEditorContent(page: Page, text: string): Promise<void> {
  await page.evaluate((t: string) => {
    const el = document.querySelector('[data-testid="sparql-query-editor"]');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const view = (el as any)?.__cmView;
    if (view) {
      view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: t } });
    }
  }, text);
}

// Open a competency question, expand its SPARQL block, and return the
// prefilled editor content and locators for scoping.
async function openSparqlBlock(
  page: Page,
  guard: PageGuard,
  questionId: string,
) {
  await page.goto(`${BASE_URL}/competency?q=${questionId}`, {
    waitUntil: "networkidle",
  });
  guard.assertPageLoaded();
  const toggle = page.locator('button:has-text("SPARQL query")').first();
  await guard.guarded(toggle.waitFor({ timeout: 15000 }));
  await toggle.click();
  const editor = page.locator('[data-testid="sparql-query-editor"]').first();
  await editor.waitFor({ timeout: 5000 });
  // Wait for the CodeMirror view to mount and load the initial content.
  await page.waitForFunction(
    () => {
      const el = document.querySelector('[data-testid="sparql-query-editor"]');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return !!(el as any)?.__cmView?.state?.doc;
    },
    undefined,
    { timeout: 5000 },
  );
  const playground = page.locator('[data-testid="sparql-playground"]').first();
  const prefilled = await getEditorContent(page);
  return { editor, playground, prefilled };
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({
      viewport: { width: 1280, height: 900 },
    });
    // Fail fast with the failing URL/status instead of an opaque selector
    // timeout when the site itself fails to boot.
    const guard = attachPageGuard(page);

    console.log("Scenario 1: stoa-members SPARQL block expands with the query prefilled");
    const stoa = await openSparqlBlock(page, guard, "stoa-members");
    check(
      "editor is prefilled with the question's own query",
      stoa.prefilled.includes("PREFIX lo:") &&
        stoa.prefilled.toLowerCase().includes("select"),
      `value starts: ${JSON.stringify(stoa.prefilled.slice(0, 60))}`,
    );
    const queryPre = page.locator("pre code").first();
    const preText = (await queryPre.textContent()) ?? "";
    check(
      "panel's displayed query matches the playground's prefilled query",
      preText.trim() === stoa.prefilled.trim(),
      `pre starts: ${JSON.stringify(preText.slice(0, 60))}`,
    );

    console.log("Scenario 2: running the stoa-members query renders a table");
    const runButton = stoa.playground.locator('button:has-text("Run query")').first();
    await runButton.click();
    await stoa.playground.locator("table").first().waitFor({ timeout: 30000 });
    const stoaRows = await stoa.playground.locator("table tbody tr").count();
    check("results table has rows > 0", stoaRows > 0, `rows=${stoaRows}`);
    const stoaCounter = await stoa.playground
      .locator('span:has-text("rows")')
      .first()
      .textContent()
      .catch(() => null);
    check(
      "row counter is visible and matches the rendered rows",
      stoaCounter !== null &&
        stoaCounter.includes(stoaRows.toLocaleString("en-US")),
      `counter=${JSON.stringify(stoaCounter)} rows=${stoaRows}`,
    );

    console.log("Scenario 3: homonymy-proper-names returns the fixed row count (>= 96)");
    const hom = await openSparqlBlock(page, guard, "homonymy-proper-names");
    check(
      "homonymy editor is prefilled with a different query",
      hom.prefilled.includes("PREFIX lo:") &&
        hom.prefilled.trim() !== stoa.prefilled.trim(),
      `value starts: ${JSON.stringify(hom.prefilled.slice(0, 60))}`,
    );
    await hom.playground.locator('button:has-text("Run query")').first().click();
    await hom.playground.locator("table").first().waitFor({ timeout: 30000 });
    const homRows = await hom.playground.locator("table tbody tr").count();
    check(
      "homonymy query returns at least 96 rows",
      homRows >= 96,
      `rows=${homRows}`,
    );
    const homCounter = await hom.playground
      .locator('span:has-text("rows")')
      .first()
      .textContent()
      .catch(() => null);
    check(
      "homonymy row counter matches the rendered rows",
      homCounter !== null &&
        homCounter.includes(homRows.toLocaleString("en-US")),
      `counter=${JSON.stringify(homCounter)} rows=${homRows}`,
    );

    console.log("Scenario 4: a malformed query shows the inline error and clears results");
    await setEditorContent(page, "SELECT ?x WHERE { this is not sparql");
    await hom.playground.locator('button:has-text("Run query")').first().click();
    const errorBox = hom.playground.locator('p:has-text("SPARQL query failed")');
    await errorBox.first().waitFor({ timeout: 15000 });
    const errorText = (await errorBox.first().textContent()) ?? "";
    check(
      'inline error box shows "SPARQL query failed"',
      errorText.includes("SPARQL query failed"),
      `text=${JSON.stringify(errorText.slice(0, 80))}`,
    );
    const tableGone = (await hom.playground.locator("table").count()) === 0;
    check("previous results table is cleared on error", tableGone);

    console.log(
      "Scenario 5: switching questions collapses the block and refreshes the query",
    );
    // Expand and run on stoa-members, then click a different question in the
    // left-hand list (in-page switch, no full navigation): the block must
    // collapse; re-expanding must show the NEW question's query in both the
    // pre and the playground editor, with no leftover results table.
    const before = await openSparqlBlock(page, guard, "stoa-members");
    await before.playground
      .locator('button:has-text("Run query")')
      .first()
      .click();
    await before.playground.locator("table").first().waitFor({ timeout: 30000 });
    const homQuestionButton = page
      .locator('button:has-text("denote different individuals")')
      .first();
    await homQuestionButton.click();
    // Wait until the right panel shows the new question's header.
    await page
      .locator('h2:has-text("denote different individuals")')
      .first()
      .waitFor({ timeout: 15000 });
    check(
      "SPARQL block is collapsed after switching questions",
      (await page.locator('[data-testid="sparql-query-editor"]').count()) === 0,
    );
    const toggle = page.locator('button:has-text("SPARQL query")').first();
    await toggle.waitFor({ timeout: 15000 });
    await toggle.click();
    const freshEditor = page.locator('[data-testid="sparql-query-editor"]').first();
    await freshEditor.waitFor({ timeout: 5000 });
    await page.waitForFunction(
      () => {
        const el = document.querySelector('[data-testid="sparql-query-editor"]');
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return !!(el as any)?.__cmView?.state?.doc;
      },
      undefined,
      { timeout: 5000 },
    );
    const freshPlayground = page.locator('[data-testid="sparql-playground"]').first();
    const freshValue = await getEditorContent(page);
    check(
      "re-expanded playground is prefilled with the new question's query",
      freshValue.trim() === hom.prefilled.trim() &&
        freshValue.trim() !== stoa.prefilled.trim(),
      `value starts: ${JSON.stringify(freshValue.slice(0, 60))}`,
    );
    const freshPre = (await page.locator("pre code").first().textContent()) ?? "";
    check(
      "re-expanded pre shows the new question's query",
      freshPre.trim() === hom.prefilled.trim(),
      `pre starts: ${JSON.stringify(freshPre.slice(0, 60))}`,
    );
    check(
      "no leftover results table from the previous question's run",
      (await freshPlayground.locator("table").count()) === 0,
    );

    console.log(
      "Scenario 6: in-page switch swaps the page-level Query Results table",
    );
    // The competency page renders its own server-side results table (the
    // "Query Results" card) below the SPARQL block. Load stoa-members,
    // record its row count and headers, then click homonymy-proper-names in
    // the left-hand list without a full navigation: the page-level table
    // must swap to the new question's rows and headers.
    await page.goto(`${BASE_URL}/competency?q=stoa-members`, {
      waitUntil: "networkidle",
    });
    guard.assertPageLoaded();
    const resultsCard = page.locator(
      'div:has(> div > h3:has-text("Query Results"))',
    );
    await guard.guarded(
      resultsCard.locator("table tbody tr").first().waitFor({ timeout: 30000 }),
    );
    const stoaPageRows = await resultsCard.locator("table tbody tr").count();
    const stoaHeaders = await resultsCard
      .locator("table thead th")
      .allTextContents();
    check(
      "stoa-members page-level table has rows and a name header",
      stoaPageRows > 0 &&
        stoaHeaders.length === 1 &&
        stoaHeaders[0].trim().toLowerCase() === "name",
      `rows=${stoaPageRows} headers=${JSON.stringify(stoaHeaders)}`,
    );
    const stoaPageCounter =
      (await resultsCard
        .locator('span:has-text("row")')
        .first()
        .textContent()
        .catch(() => null)) ?? "";
    check(
      "stoa-members page-level row counter matches the rendered rows",
      stoaPageCounter.includes(String(stoaPageRows)),
      `counter=${JSON.stringify(stoaPageCounter)} rows=${stoaPageRows}`,
    );
    // In-page switch to a question with a different shape and row count.
    await page
      .locator('button:has-text("denote different individuals")')
      .first()
      .click();
    await page
      .locator('h2:has-text("denote different individuals")')
      .first()
      .waitFor({ timeout: 15000 });
    // Wait until the table's header row actually reflects the new question
    // (a stale React Query render would keep the old ?name header).
    await page
      .waitForFunction(
        () => {
          const ths = Array.from(
            document.querySelectorAll("table thead th"),
          ).map((th) => (th.textContent ?? "").trim().toLowerCase());
          return ths.includes("form");
        },
        undefined,
        { timeout: 30000 },
      )
      .catch(() => {});
    const homHeaders = (
      await resultsCard.locator("table thead th").allTextContents()
    ).map((h) => h.trim().toLowerCase());
    check(
      "page-level table headers swap to the homonymy question's variables",
      homHeaders.length === 3 &&
        homHeaders[0] === "form" &&
        homHeaders[1] === "name1" &&
        homHeaders[2] === "name2",
      `headers=${JSON.stringify(homHeaders)}`,
    );
    const homPageRows = await resultsCard.locator("table tbody tr").count();
    check(
      "page-level row count swaps to the homonymy question's rows (>= 96, differs from stoa)",
      homPageRows >= 96 && homPageRows !== stoaPageRows,
      `rows=${homPageRows} stoaRows=${stoaPageRows}`,
    );
    const homPageCounter =
      (await resultsCard
        .locator('span:has-text("row")')
        .first()
        .textContent()
        .catch(() => null)) ?? "";
    check(
      "page-level row counter matches the homonymy rows",
      homPageCounter.includes(homPageRows.toLocaleString("en-US")),
      `counter=${JSON.stringify(homPageCounter)} rows=${homPageRows}`,
    );
    console.log(
      "Scenario 7: in-page switch swaps the subgraph roster and passages",
    );
    // Fetch the two questions' expected subgraphs and Zone D passages from
    // the API so the assertions track the catalogue instead of hardcoding
    // counts that drift with curation.
    const [stoaData, homData] = await Promise.all(
      ["stoa-members", "homonymy-proper-names"].map(async (id) => {
        const res = await fetch(`${BASE_URL}/api/competency/questions/${id}`);
        if (!res.ok) throw new Error(`competency/questions/${id}: ${res.status}`);
        return (await res.json()) as {
          nodes: { name: string }[];
          passages: { id: string }[];
          terms: { en: string; type: string; firstId?: string }[];
        };
      }),
    );
    const stoaNames = stoaData.nodes.map((n) => n.name);
    const homNames = homData.nodes.map((n) => n.name);
    // A homonymy-only node proves the roster really swapped; a stoa-only
    // node anchors the pre-switch panel. Fail loudly if curation ever
    // removes the distinction instead of silently passing.
    const homOnly = homNames.find((n) => !stoaNames.includes(n));
    const stoaOnly = stoaNames.find((n) => !homNames.includes(n));
    if (!homOnly || !stoaOnly) {
      throw new Error(
        "the two questions no longer have distinctive nodes; pick another pair",
      );
    }
    const stoaOnlyPassage = stoaData.passages
      .map((p) => p.id)
      .find((id) => !homData.passages.some((p) => p.id === id));
    const homOnlyPassage = homData.passages
      .map((p) => p.id)
      .find((id) => !stoaData.passages.some((p) => p.id === id));
    if (!stoaOnlyPassage || !homOnlyPassage) {
      throw new Error(
        "the two questions no longer have distinctive Zone D passages",
      );
    }

    await page.goto(`${BASE_URL}/competency?q=stoa-members`, {
      waitUntil: "networkidle",
    });
    guard.assertPageLoaded();
    const nodeButtons = page.locator('[aria-label^="Show source passages for"]');
    await guard.guarded(nodeButtons.first().waitFor({ timeout: 30000 }));
    const stoaNodeCount = await nodeButtons.count();
    check(
      `stoa-members subgraph renders all ${stoaNames.length} nodes`,
      stoaNodeCount === stoaNames.length,
      `rendered=${stoaNodeCount} expected=${stoaNames.length}`,
    );
    check(
      `homonymy-only node "${homOnly}" is absent before the switch`,
      (await page
        .locator(`[aria-label="Show source passages for ${homOnly}"]`)
        .count()) === 0,
    );
    const passagesCard = page.locator(
      'div:has(> h3:has-text("Source Passages"))',
    );
    check(
      `Source Passages card shows the stoa-only passage ${stoaOnlyPassage}`,
      (await passagesCard
        .locator(`a:has-text("${stoaOnlyPassage}")`)
        .count()) > 0,
    );
    check(
      `Source Passages card does not show the homonymy passage ${homOnlyPassage}`,
      (await passagesCard
        .locator(`a:has-text("${homOnlyPassage}")`)
        .count()) === 0,
    );
    // Open the stoa-only node's passage panel so the switch has a stale
    // panel to clear.
    await page
      .locator(`[aria-label="Show source passages for ${stoaOnly}"]`)
      .first()
      .click();
    await page
      .locator(`h3:has-text("Passages naming ${stoaOnly}")`)
      .first()
      .waitFor({ timeout: 15000 });

    // In-page switch to homonymy-proper-names via the left-hand list.
    await page
      .locator('button:has-text("denote different individuals")')
      .first()
      .click();
    await page
      .locator('h2:has-text("denote different individuals")')
      .first()
      .waitFor({ timeout: 15000 });
    // Wait until the roster settles on the new question's node count (a
    // stale React Query render would keep the stoa nodes).
    await page
      .waitForFunction(
        (expected) =>
          document.querySelectorAll(
            '[aria-label^="Show source passages for"]',
          ).length === expected,
        homNames.length,
        { timeout: 30000 },
      )
      .catch(() => {});
    const homNodeCount = await nodeButtons.count();
    check(
      `roster swaps to the homonymy question's ${homNames.length} nodes`,
      homNodeCount === homNames.length && homNodeCount !== stoaNodeCount,
      `rendered=${homNodeCount} expected=${homNames.length} stoa=${stoaNodeCount}`,
    );
    check(
      `homonymy-only node "${homOnly}" is present after the switch`,
      (await page
        .locator(`[aria-label="Show source passages for ${homOnly}"]`)
        .count()) === 1,
    );
    check(
      `stale "Passages naming ${stoaOnly}" panel closed on switch`,
      (await page
        .locator(`h3:has-text("Passages naming ${stoaOnly}")`)
        .count()) === 0,
    );
    check(
      `Source Passages card swaps to the homonymy passage ${homOnlyPassage}`,
      (await passagesCard
        .locator(`a:has-text("${homOnlyPassage}")`)
        .count()) > 0,
    );
    check(
      `Source Passages card drops the stoa passage ${stoaOnlyPassage}`,
      (await passagesCard
        .locator(`a:has-text("${stoaOnlyPassage}")`)
        .count()) === 0,
    );

    // Open the homonymy-only node's passage panel and check every rendered
    // passage link belongs to that entity's own tagged sections.
    const entitiesRes = await fetch(`${BASE_URL}/api/annotations/entities`);
    if (!entitiesRes.ok)
      throw new Error(`annotations/entities: ${entitiesRes.status}`);
    const entities = (await entitiesRes.json()) as {
      entityUri: string;
      label: string;
      kind: string;
    }[];
    const homEntity =
      entities.find((e) => e.label === homOnly && e.kind === "philosopher") ??
      entities.find((e) => e.label === homOnly);
    if (!homEntity)
      throw new Error(`no tagged entity found for "${homOnly}"`);
    const sectionsRes = await fetch(
      `${BASE_URL}/api/annotations/sections?entity=${encodeURIComponent(homEntity.entityUri)}`,
    );
    if (!sectionsRes.ok)
      throw new Error(`annotations/sections: ${sectionsRes.status}`);
    const expectedSections = new Set(
      ((await sectionsRes.json()) as { sections: { id: string }[] }).sections.map(
        (s) => s.id,
      ),
    );

    await page
      .locator(`[aria-label="Show source passages for ${homOnly}"]`)
      .first()
      .click();
    const homPanelHeading = page.locator(
      `h3:has-text("Passages naming ${homOnly}")`,
    );
    await homPanelHeading.first().waitFor({ timeout: 15000 });
    const homPanel = homPanelHeading
      .first()
      .locator("xpath=ancestor::div[contains(@class, 'bg-card')][1]");
    await homPanel
      .locator('a[href^="/section/"]')
      .first()
      .waitFor({ timeout: 15000 });
    const panelLinks = await homPanel
      .locator('a[href^="/section/"]')
      .evaluateAll((as) =>
        as.map((a) => (a.getAttribute("href") ?? "").replace("/section/", "")),
      );
    check(
      `${homOnly}'s panel lists at least one passage`,
      panelLinks.length > 0,
      `links=${panelLinks.length}`,
    );
    const strayLinks = panelLinks.filter((id) => !expectedSections.has(id));
    check(
      `every panel passage belongs to ${homOnly}'s own tagged sections (no leftovers)`,
      strayLinks.length === 0 && expectedSections.size > 0,
      `stray=${JSON.stringify(strayLinks.slice(0, 5))} expected=${expectedSections.size}`,
    );
    check(
      `panel passage count matches ${homOnly}'s section count`,
      panelLinks.length === expectedSections.size,
      `panel=${panelLinks.length} api=${expectedSections.size}`,
    );

    console.log(
      "Scenario 8: in-page switch swaps the bilingual terms panel (Zone C)",
    );
    // Zone C renders the question's bilingual terms grouped by entity type
    // in the "Entities" card. A stale React Query render there would show
    // the previous question's Greek/English vocabulary under the new
    // question's header. Pick a term distinctive to each question live from
    // the API payloads (already fetched above) so curation drift cannot
    // silently break the pin.
    const stoaTermSet = new Set(stoaData.terms.map((t) => t.en));
    const homTermSet = new Set(homData.terms.map((t) => t.en));
    const stoaOnlyTerm = stoaData.terms
      .map((t) => t.en)
      .find((en) => !homTermSet.has(en));
    const homOnlyTerm = homData.terms
      .map((t) => t.en)
      .find((en) => !stoaTermSet.has(en));
    if (!stoaOnlyTerm || !homOnlyTerm) {
      throw new Error(
        "the two questions no longer have distinctive Zone C terms; pick another pair",
      );
    }

    await page.goto(`${BASE_URL}/competency?q=stoa-members`, {
      waitUntil: "networkidle",
    });
    guard.assertPageLoaded();
    const entitiesCard = page.locator(
      'div:has(> h3:has-text("Entities"))',
    );
    await guard.guarded(
      entitiesCard
        .getByText(stoaOnlyTerm, { exact: true })
        .first()
        .waitFor({ timeout: 30000 }),
    );
    check(
      `terms panel shows the stoa-only term "${stoaOnlyTerm}" before the switch`,
      (await entitiesCard.getByText(stoaOnlyTerm, { exact: true }).count()) > 0,
    );
    check(
      `terms panel does not show the homonymy term "${homOnlyTerm}" before the switch`,
      (await entitiesCard.getByText(homOnlyTerm, { exact: true }).count()) === 0,
    );

    // In-page switch via the left-hand list (no full navigation).
    await page
      .locator('button:has-text("denote different individuals")')
      .first()
      .click();
    await page
      .locator('h2:has-text("denote different individuals")')
      .first()
      .waitFor({ timeout: 15000 });
    // Wait until Zone C settles on the new question's vocabulary (a stale
    // render would keep the stoa terms under the new header).
    await entitiesCard
      .getByText(homOnlyTerm, { exact: true })
      .first()
      .waitFor({ timeout: 30000 });
    check(
      `terms panel shows the homonymy-distinctive term "${homOnlyTerm}" after the switch`,
      (await entitiesCard.getByText(homOnlyTerm, { exact: true }).count()) > 0,
    );
    check(
      `terms panel drops the stoa-only term "${stoaOnlyTerm}" after the switch`,
      (await entitiesCard.getByText(stoaOnlyTerm, { exact: true }).count()) === 0,
    );

    console.log(
      "Scenario 9: a terms-panel chip opens its cited passage and the arrow opens the graph",
    );
    // Zone C renders each philosopher term as a link to /section/:firstId
    // (its first cited passage) plus a small arrow link to /graph?p=. A
    // broken firstId wiring or a mis-encoded ?p= would ship unnoticed
    // without a real click-through. Pick the chip live from the question's
    // own terms payload, preferring a philosopher whose name is also a
    // graph node so the arrow-link selection can be verified end to end.
    const graphRes = await fetch(`${BASE_URL}/api/graph`);
    if (!graphRes.ok) throw new Error(`api/graph: ${graphRes.status}`);
    const graphPayload = (await graphRes.json()) as {
      nodes: { name: string }[];
      associates?: { name: string }[];
    };
    const graphNodes = new Set(graphPayload.nodes.map((n) => n.name));
    // The Graph page also selects satellite associates via ?p= (the
    // associates layer), so for the fallback-branch routing in Scenario 10
    // a name known to either layer counts as graph-known: it opens the
    // side panel, never the unknown-name notice.
    const graphKnownNames = new Set([
      ...graphNodes,
      ...(graphPayload.associates ?? []).map((a) => a.name),
    ]);
    const chipTerm =
      stoaData.terms.find(
        (t) => t.type !== "school" && t.firstId && graphNodes.has(t.en),
      ) ?? stoaData.terms.find((t) => t.type !== "school" && t.firstId);
    if (!chipTerm || !chipTerm.firstId) {
      throw new Error(
        "stoa-members no longer has a philosopher term with a firstId; pick another question",
      );
    }

    await page.goto(`${BASE_URL}/competency?q=stoa-members`, {
      waitUntil: "networkidle",
    });
    guard.assertPageLoaded();
    const chipCard = page.locator('div:has(> h3:has-text("Entities"))');
    const chipLink = chipCard
      .locator(`a:text-is("${chipTerm.en}")`)
      .first();
    await guard.guarded(chipLink.waitFor({ timeout: 30000 }));
    const chipHref = await chipLink.getAttribute("href");
    check(
      `chip "${chipTerm.en}" links to /section/${chipTerm.firstId} (the term's firstId)`,
      chipHref === `/section/${chipTerm.firstId}`,
      `href=${chipHref}`,
    );
    const arrowLink = chipLink
      .locator('xpath=following-sibling::a[@title="View in graph"]')
      .first();
    const arrowHref = await arrowLink.getAttribute("href").catch(() => null);
    check(
      `arrow link next to "${chipTerm.en}" carries the encoded ?p=`,
      arrowHref === `/graph?p=${encodeURIComponent(chipTerm.en)}`,
      `href=${arrowHref}`,
    );

    await chipLink.click();
    await page.waitForFunction(
      (id) => window.location.pathname === `/section/${id}`,
      chipTerm.firstId,
      { timeout: 15000 },
    );
    // The section page renders "Book X, Chapter Y, Section Z" under the h1
    // once the section has actually loaded (not just the route matching).
    const [book, chapter, sect] = chipTerm.firstId.split(".");
    const sectionCrumb = page.locator(
      `text=Book ${book}, Chapter ${chapter}, Section ${sect}`,
    );
    const sectionRendered = await sectionCrumb
      .first()
      .waitFor({ timeout: 15000 })
      .then(() => true)
      .catch(() => false);
    check(
      `chip click lands on the rendered /section/${chipTerm.firstId} page`,
      sectionRendered,
      `url=${page.url()}`,
    );

    // Back to the question, then follow the arrow link into the graph.
    await page.goto(`${BASE_URL}/competency?q=stoa-members`, {
      waitUntil: "networkidle",
    });
    guard.assertPageLoaded();
    await guard.guarded(chipLink.waitFor({ timeout: 30000 }));
    await arrowLink.click();
    await page.waitForFunction(
      () => window.location.pathname === "/graph",
      undefined,
      { timeout: 15000 },
    );
    // The side panel renders the selected philosopher's name as an <h2>
    // once the graph data has loaded, and the selected node's circle gets
    // the highlight ring (stroke-width > 2) in the SVG.
    const graphPanelShown = await page
      .waitForFunction(
        ([name, sel]) =>
          Array.from(document.querySelectorAll(sel)).some(
            (h) => (h.textContent ?? "").trim() === name,
          ),
        [chipTerm.en, PAGE_HEADING_SELECTOR] as const,
        { timeout: 20000 },
      )
      .then(() => true)
      .catch(() => false);
    check(
      `graph side panel heading names ${chipTerm.en}`,
      graphPanelShown,
      `url=${page.url()}`,
    );
    const graphState = await page.evaluate((name) => {
      const params = new URLSearchParams(window.location.search);
      const gs = Array.from(document.querySelectorAll("svg g"));
      let ringed = false;
      for (const g of gs) {
        const text = g.querySelector("text");
        if (!text || (text.textContent ?? "").trim() !== name) continue;
        const circle = g.querySelector("circle");
        if (
          circle &&
          parseFloat(circle.getAttribute("stroke-width") ?? "0") > 2
        ) {
          ringed = true;
          break;
        }
      }
      return { p: params.get("p"), ringed };
    }, chipTerm.en);
    check(
      `?p=${chipTerm.en} in the /graph URL after the arrow click`,
      graphState.p === chipTerm.en,
      `p=${graphState.p}`,
    );
    check(
      "selected node ring is highlighted in the graph SVG",
      graphState.ringed,
    );

    console.log(
      "Scenario 10: a chip without a cited passage still opens the graph correctly",
    );
    // Zone C's other branch: terms without a firstId link the chip itself to
    // /graph?p= (no section to cite). Scenario 9 only covers the firstId
    // path, so a mis-encoded fallback href, or a fallback landing on a
    // silently blank graph, would ship unnoticed. Scan the whole catalogue
    // live so curation drift cannot un-cover the branch.
    const catRes = await fetch(`${BASE_URL}/api/competency/questions`);
    if (!catRes.ok) throw new Error(`competency/questions: ${catRes.status}`);
    const catalogue = (
      (await catRes.json()) as { questions: { id: string }[] }
    ).questions;
    check(
      `catalogue scan covers ${catalogue.length} questions (positive control)`,
      catalogue.length > 0,
    );
    type ScannedTerm = { qid: string; en: string; type: string };
    const noFirstId: ScannedTerm[] = [];
    const uriLabelled: ScannedTerm[] = [];
    let termsScanned = 0;
    for (const q of catalogue) {
      const r = await fetch(`${BASE_URL}/api/competency/questions/${q.id}`);
      if (!r.ok) throw new Error(`competency/questions/${q.id}: ${r.status}`);
      const j = (await r.json()) as {
        terms?: { en: string; type: string; firstId?: string }[];
      };
      for (const t of j.terms ?? []) {
        // Every en label (school terms included) renders as visible text in
        // Zone C; a raw web address as a label means the terms builder
        // leaked a resource URI instead of its display name
        if (/^https?:\/\//i.test(t.en)) {
          uriLabelled.push({ qid: q.id, en: t.en, type: t.type });
        }
        if (t.type === "school") continue; // schools render as plain spans, no link
        termsScanned++;
        if (!t.firstId) noFirstId.push({ qid: q.id, en: t.en, type: t.type });
      }
    }
    check(
      `catalogue scan covered ${termsScanned} linkable terms (positive control)`,
      termsScanned > 0,
    );
    check(
      "no term in any question's payload carries a URI-shaped en label" +
        (uriLabelled.length
          ? ` (found: ${uriLabelled
              .map((t) => `${t.qid}/${t.type}: ${t.en}`)
              .join(", ")})`
          : ""),
      uriLabelled.length === 0,
    );
    // Pin whether any person-type term (philosopher/sage) ever ships
    // without a firstId. Today none do, so the person-chip fallback is
    // dead code; if one appears, this check surfaces it as a curation
    // question rather than letting a dead-node graph link ship silently.
    const personNoFirstId = noFirstId.filter(
      (t) => t.type === "philosopher" || t.type === "sage",
    );
    check(
      "no philosopher/sage term lacks a firstId (fallback branch pinned dead for person chips)" +
        (personNoFirstId.length
          ? ` (found: ${personNoFirstId
              .map((t) => `${t.qid}/${t.en}`)
              .join(", ")})`
          : ""),
      personNoFirstId.length === 0,
    );

    if (noFirstId.length === 0) {
      check(
        "catalogue has no terms without a firstId; the fallback branch is fully dead code (explicit positive control)",
        true,
      );
    } else {
      // Prefer a fallback term whose name IS a graph node (the happy path:
      // the chip must select the node), else exercise the designed
      // degradation: the unknown-name notice with the Index escape hatch.
      // Pick a name that is locator-safe (no quotes) and short.
      const safe = (t: ScannedTerm) =>
        !t.en.includes('"') && !t.en.includes("'") && t.en.length < 60;
      // A name known to either graph layer (KG node or satellite
      // associate) legitimately opens the side panel, never the
      // unknown-name notice; graphKnownNames already unions both.
      const associateNames = new Set(
        (graphPayload.associates ?? []).map((a) => a.name),
      );
      const nodeBacked = noFirstId.find(
        (t) => graphKnownNames.has(t.en) && safe(t),
      );
      const fallbackTerm =
        nodeBacked ?? noFirstId.find(safe) ?? noFirstId[0]!;
      const associateBacked =
        !!nodeBacked && associateNames.has(nodeBacked.en) && !graphNodes.has(nodeBacked.en);
      console.log(
        `  scanned: ${noFirstId.length} terms without a firstId; testing "${fallbackTerm.en}" (${fallbackTerm.type}) from ${fallbackTerm.qid}` +
          (nodeBacked
            ? " [graph-node-backed]"
            : associateBacked
              ? " [associate-backed]"
              : " [not a graph node]"),
      );

      await page.goto(`${BASE_URL}/competency?q=${fallbackTerm.qid}`, {
        waitUntil: "networkidle",
      });
      guard.assertPageLoaded();
      const fbCard = page.locator('div:has(> h3:has-text("Entities"))');
      const fbChip = fbCard.locator(`a:text-is("${fallbackTerm.en}")`).first();
      await guard.guarded(fbChip.waitFor({ timeout: 30000 }));
      const fbHref = await fbChip.getAttribute("href");
      check(
        `no-firstId chip "${fallbackTerm.en}" links straight to the encoded /graph?p=`,
        fbHref === `/graph?p=${encodeURIComponent(fallbackTerm.en)}`,
        `href=${fbHref}`,
      );
      // No arrow link should accompany a no-firstId chip (the chip itself
      // is the graph link; a duplicate arrow means the branch regressed).
      const fbArrowCount = await fbChip
        .locator('xpath=following-sibling::a[@title="View in graph"]')
        .count();
      check(
        "no separate arrow link renders next to a no-firstId chip",
        fbArrowCount === 0,
        `arrows=${fbArrowCount}`,
      );

      await fbChip.click();
      await page.waitForFunction(
        () => window.location.pathname === "/graph",
        undefined,
        { timeout: 15000 },
      );
      const fbP = await page.evaluate(
        () => new URLSearchParams(window.location.search).get("p"),
      );
      check(
        `?p=${fallbackTerm.en} survives the round trip in the /graph URL`,
        fbP === fallbackTerm.en,
        `p=${fbP}`,
      );

      if (nodeBacked || associateBacked) {
        // Happy path: the graph must actually select the node (a KG node
        // or a satellite associate; both open a side panel headed by the
        // name, per e2e-graph-associates).
        const fbPanelShown = await page
          .waitForFunction(
            ([name, sel]) =>
              Array.from(document.querySelectorAll(sel)).some(
                (h) => (h.textContent ?? "").trim() === name,
              ),
            [fallbackTerm.en, PAGE_HEADING_SELECTOR] as const,
            { timeout: 20000 },
          )
          .then(() => true)
          .catch(() => false);
        check(
          `graph side panel selects the node-backed fallback term ${fallbackTerm.en}`,
          fbPanelShown,
          `url=${page.url()}`,
        );
      } else {
        // Designed degradation (validate-competency-graph-links pins the
        // choice): the graph must show the unknown-name notice quoting the
        // name, with the Index escape hatch carrying ?q=, never a silently
        // empty or blank page.
        const notice = page.locator(
          'text="No one in the graph is named"',
        );
        const noticeShown = await page
          .waitForFunction(
            (name) =>
              Array.from(document.querySelectorAll("*")).some(
                (el) =>
                  (el.textContent ?? "").includes(
                    "No one in the graph is named",
                  ) && (el.textContent ?? "").includes(name),
              ),
            fallbackTerm.en,
            { timeout: 20000 },
          )
          .then(() => true)
          .catch(() => false);
        check(
          `graph shows the unknown-name notice quoting "${fallbackTerm.en}" (no blank page)`,
          noticeShown,
          `url=${page.url()} noticeCount=${await notice.count()}`,
        );
        const indexHref = await page
          .locator('a:has-text("Look them up in the Index")')
          .first()
          .getAttribute("href")
          .catch(() => null);
        check(
          "unknown-name notice carries the Index escape hatch with the encoded ?q=",
          indexHref === `/entities?q=${encodeURIComponent(fallbackTerm.en)}`,
          `href=${indexHref}`,
        );
      }
    }

    console.log(
      "Scenario 11: a node click rings exactly that dot, and a question switch clears the ring",
    );
    // SubgraphViz marks the focused node with an extra halo circle
    // (fill="none", strokeWidth 2) inside the node's <g>, so a focused
    // node renders 2 circles and every other node renders 1. Scenario 7
    // proves the panel opens and swaps, but never checks this visual
    // focus ring: a regression could open the right panel while ringing
    // the wrong dot, or leave a stale ring after an in-page question
    // switch. Reuse the live stoaOnly/homOnly distinctive nodes.
    const ringedNodeNames = () =>
      page.evaluate(() => {
        const out: string[] = [];
        for (const g of Array.from(
          document.querySelectorAll(
            'g[aria-label^="Show source passages for"]',
          ),
        )) {
          const circles = Array.from(g.querySelectorAll("circle"));
          const halo = circles.find(
            (c) =>
              c.getAttribute("fill") === "none" &&
              parseFloat(c.getAttribute("stroke-width") ?? "0") >= 2,
          );
          if (halo) {
            const label = g.getAttribute("aria-label") ?? "";
            out.push(label.replace("Show source passages for ", ""));
          }
        }
        return out;
      });

    await page.goto(`${BASE_URL}/competency?q=stoa-members`, {
      waitUntil: "networkidle",
    });
    guard.assertPageLoaded();
    await guard.guarded(
      page
        .locator('[aria-label^="Show source passages for"]')
        .first()
        .waitFor({ timeout: 30000 }),
    );
    check(
      "no node carries the focus ring before any click",
      (await ringedNodeNames()).length === 0,
      `ringed=${JSON.stringify(await ringedNodeNames())}`,
    );
    await page
      .locator(`[aria-label="Show source passages for ${stoaOnly}"]`)
      .first()
      .click();
    await page
      .locator(`h3:has-text("Passages naming ${stoaOnly}")`)
      .first()
      .waitFor({ timeout: 15000 });
    const stoaRinged = await ringedNodeNames();
    check(
      `clicking ${stoaOnly} rings exactly that node's dot`,
      stoaRinged.length === 1 && stoaRinged[0] === stoaOnly,
      `ringed=${JSON.stringify(stoaRinged)}`,
    );

    // In-page switch via the left-hand list: the roster swaps and no node
    // may keep a leftover ring until a new click.
    await page
      .locator('button:has-text("denote different individuals")')
      .first()
      .click();
    await page
      .locator('h2:has-text("denote different individuals")')
      .first()
      .waitFor({ timeout: 15000 });
    await page
      .waitForFunction(
        (expected) =>
          document.querySelectorAll(
            '[aria-label^="Show source passages for"]',
          ).length === expected,
        homNames.length,
        { timeout: 30000 },
      )
      .catch(() => {});
    const afterSwitchRinged = await ringedNodeNames();
    check(
      "no node carries a leftover focus ring after the in-page switch",
      afterSwitchRinged.length === 0,
      `ringed=${JSON.stringify(afterSwitchRinged)}`,
    );

    // A fresh click on the new question's distinctive node must ring
    // exactly that dot.
    await page
      .locator(`[aria-label="Show source passages for ${homOnly}"]`)
      .first()
      .click();
    await page
      .locator(`h3:has-text("Passages naming ${homOnly}")`)
      .first()
      .waitFor({ timeout: 15000 });
    const homRinged = await ringedNodeNames();
    check(
      `clicking ${homOnly} after the switch rings exactly that node's dot`,
      homRinged.length === 1 && homRinged[0] === homOnly,
      `ringed=${JSON.stringify(homRinged)}`,
    );
    console.log(
      "Scenario 12: an edited query resets cleanly when switching questions",
    );
    // The playground keeps a user's edits (About page persistence) and shows
    // a "Reset to example" button once query !== example. On the competency
    // page each question embeds its own playground; switching questions
    // in-page must swap in the NEW question's query (the initialQuery reset
    // effect) and hide the reset button — a stale edited query attached to
    // the wrong question must never ship.
    const editA = await openSparqlBlock(page, guard, "stoa-members");
    const editedQuery = "SELECT ?edited WHERE { ?edited ?p ?o } LIMIT 1";
    await setEditorContent(page, editedQuery);
    const resetBtn = page.locator('[data-testid="sparql-reset-to-example"]');
    await resetBtn.first().waitFor({ timeout: 5000 });
    check(
      '"Reset to example" appears after editing the first question\'s query',
      (await resetBtn.count()) === 1,
    );
    // In-page switch via the left-hand list (no full navigation).
    await page
      .locator('button:has-text("denote different individuals")')
      .first()
      .click();
    await page
      .locator('h2:has-text("denote different individuals")')
      .first()
      .waitFor({ timeout: 15000 });
    // Re-expand the (collapsed) SPARQL block on the new question.
    const toggle12 = page.locator('button:has-text("SPARQL query")').first();
    await toggle12.waitFor({ timeout: 15000 });
    await toggle12.click();
    await page.waitForFunction(
      () => {
        const el = document.querySelector('[data-testid="sparql-query-editor"]');
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return !!(el as any)?.__cmView?.state?.doc;
      },
      undefined,
      { timeout: 5000 },
    );
    const afterSwitchValue = await getEditorContent(page);
    check(
      "editor shows the new question's own query after the switch, not the edit",
      afterSwitchValue.trim() === hom.prefilled.trim() &&
        afterSwitchValue.trim() !== editedQuery &&
        afterSwitchValue.trim() !== editA.prefilled.trim(),
      `value starts: ${JSON.stringify(afterSwitchValue.slice(0, 60))}`,
    );
    check(
      '"Reset to example" is absent right after the switch',
      (await resetBtn.count()) === 0,
    );
    // Edit the second question's query, then click "Reset to example":
    // that question's own preset must come back.
    const editedQuery2 = "ASK { ?s ?p ?o }";
    await setEditorContent(page, editedQuery2);
    await resetBtn.first().waitFor({ timeout: 5000 });
    check(
      '"Reset to example" appears after editing the second question\'s query',
      (await resetBtn.count()) === 1,
    );
    await resetBtn.first().click();
    await page.waitForFunction(
      () =>
        document.querySelectorAll(
          '[data-testid="sparql-reset-to-example"]',
        ).length === 0,
      undefined,
      { timeout: 5000 },
    );
    const afterReset = await getEditorContent(page);
    check(
      'clicking "Reset to example" restores the second question\'s preset',
      afterReset.trim() === hom.prefilled.trim(),
      `value starts: ${JSON.stringify(afterReset.slice(0, 60))}`,
    );
    check(
      '"Reset to example" disappears after the reset',
      (await resetBtn.count()) === 0,
    );
  } finally {
    await browser.close();
  }

  if (failures > 0) {
    console.error(`\n${failures} check(s) failed`);
    process.exit(1);
  }
  console.log("\nAll competency SPARQL playground checks passed");
}

await main();
