/// <reference lib="dom" />
/* Real-browser check for the accessible reading views: the
 * Parallel/Stacked passage-layout toggle (components/passage-card.tsx +
 * hooks/use-text-layout-pref.ts, surfaced in the section.tsx and
 * browse.tsx toolbars) and the List views on graph.tsx (?view=list,
 * URL-synced) and timeline.tsx. Static validators can't prove these
 * work with a keyboard, survive Back/Forward, or persist across pages,
 * so this script drives headless Chromium against the running dev
 * servers and asserts:
 *
 * 1. Section page: the layout toggle is a role=group with two
 *    aria-pressed buttons, Parallel is pressed by default and the
 *    passage body renders two columns at desktop width. Activating
 *    "Stacked" purely via keyboard (focus + Enter) flips aria-pressed,
 *    collapses the passage to ONE column, and writes
 *    localStorage["laertius:text-layout"]="stacked".
 * 2. Persistence: a brand-new page in the same browser context (fresh
 *    load, no interaction) — another philosopher's section AND the
 *    Browse page after picking a philosopher — comes up already
 *    Stacked: toggle pressed and every passage card one column.
 * 3. Graph List view: keyboard-activating the List toggle on /graph
 *    rewrites the URL to ?view=list and renders the list; every table
 *    in it has a caption, th[scope=col] headers and th[scope=row] row
 *    headers. A direct load of /graph?view=list also lands on the
 *    list (shareable link).
 * 4. Back/Forward: from the list, following a "Read the Life" link
 *    (wouter pushState) and pressing Back returns to /graph?view=list
 *    with the list view actually rendered (the useSearch adoption
 *    effect must re-apply view=list on popstate), and Forward returns
 *    to the section page. All without a full reload (window marker
 *    survives).
 * 6. Timeline school filter & expanded philosopher URL sync: clicking a
 *    school chip rewrites the URL to ?school=<id> (replaceState),
 *    expanding a philosopher adds ?p=<name>, a direct load of
 *    /timeline?school=...&view=list restores both the filter and the
 *    list view (shareable link), and Back/Forward restore the
 *    filter + expanded panel from the URL.
 * 5. Timeline List view: keyboard-activating the List toggle flips
 *    aria-pressed, renders the chronology table with a caption,
 *    th[scope=col] headers and th[scope=row] row headers, and rewrites
 *    the URL to ?view=list (replaceState). A direct load of
 *    /timeline?view=list opens straight in List view (shareable link),
 *    toggling back to Timeline drops ?view=, and Back restores the
 *    List view.
 *
 * Requirements: the api-server and web workflows must be running and
 * the headless Chromium shell installed (same setup as
 * e2e-graph-shared-link):
 *   PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright \
 *     node scripts/node_modules/playwright-core/cli.js install chromium-headless-shell
 */

import "./lib/playwright-browsers-path";

const { chromium } = await import("playwright-core");
const { attachPageGuard } = await import("./lib/e2e-page-guard");
import type { Page } from "playwright-core";

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

interface Philosopher {
  name: string;
  firstId: string;
  sectionCount: number;
}

/** Grid column count of the first PassageCard body on the page. */
function passageColumnCounts(page: Page): Promise<number[]> {
  return page.evaluate(() => {
    // The passage body is the direct grid child of the card that holds
    // the lang="grc" column.
    return Array.from(document.querySelectorAll("div[lang='grc']"))
      .map((grc) => grc.parentElement)
      .filter((el): el is HTMLElement => !!el && el.classList.contains("grid"))
      .map(
        (el) =>
          getComputedStyle(el)
            .gridTemplateColumns.split(" ")
            .filter(Boolean).length,
      );
  });
}

function toggleState(page: Page) {
  return page.evaluate(() => {
    const group = document.querySelector(
      "[data-testid='text-layout-toggle']",
    ) as HTMLElement | null;
    if (!group) return null;
    return {
      role: group.getAttribute("role"),
      ariaLabel: group.getAttribute("aria-label"),
      parallelPressed: group
        .querySelector("[data-testid='text-layout-parallel']")
        ?.getAttribute("aria-pressed"),
      stackedPressed: group
        .querySelector("[data-testid='text-layout-stacked']")
        ?.getAttribute("aria-pressed"),
    };
  });
}

/** caption/th audit of every table under the given testid container. */
function auditTables(page: Page, containerTestId: string) {
  return page.evaluate((tid) => {
    const root = document.querySelector(`[data-testid='${tid}']`);
    const tables = root
      ? root.tagName === "TABLE"
        ? [root as HTMLTableElement]
        : Array.from(root.querySelectorAll("table"))
      : [];
    return {
      found: !!root || tables.length > 0,
      tableCount: tables.length,
      allHaveCaption: tables.every(
        (t) => (t.querySelector("caption")?.textContent ?? "").trim().length > 0,
      ),
      allColHeadersScoped: tables.every((t) =>
        Array.from(t.querySelectorAll("thead th")).every(
          (th) => th.getAttribute("scope") === "col",
        ),
      ),
      colHeaderCount: tables.reduce(
        (n, t) => n + t.querySelectorAll("thead th").length,
        0,
      ),
      allRowHeadersScoped: tables.every((t) =>
        Array.from(t.querySelectorAll("tbody th")).every(
          (th) => th.getAttribute("scope") === "row",
        ),
      ),
      rowHeaderCount: tables.reduce(
        (n, t) => n + t.querySelectorAll("tbody th").length,
        0,
      ),
    };
  }, containerTestId);
}

/** Activate a button strictly via keyboard: focus it, then press Enter. */
async function keyboardActivate(page: Page, testid: string) {
  const btn = page.locator(`[data-testid='${testid}']`);
  await btn.focus();
  const focused = await page.evaluate(
    (tid) =>
      document.activeElement?.getAttribute("data-testid") === tid,
    testid,
  );
  check(`${testid} is keyboard-focusable`, focused);
  await page.keyboard.press("Enter");
}

async function main() {
  const philRes = await fetch(`${BASE_URL}/api/philosophers`);
  if (!philRes.ok) throw new Error(`/api/philosophers -> ${philRes.status}`);
  const phils = (await philRes.json()) as Philosopher[];
  const [philA, philB] = phils.filter((p) => p.firstId && p.sectionCount > 0);
  if (!philA || !philB) throw new Error("need two philosophers with sections");
  // "Read the Life" links in the graph list exist per KG node, not per
  // /api/philosophers entry (the Prologue has no node) — pick a node name.
  const graphRes = await fetch(`${BASE_URL}/api/graph`);
  if (!graphRes.ok) throw new Error(`/api/graph -> ${graphRes.status}`);
  const graphNode = ((await graphRes.json()) as { nodes: { name: string }[] })
    .nodes[0];
  if (!graphNode) throw new Error("no graph nodes served");

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
  });
  try {
    // ---- Scenario 1: keyboard Stacked toggle on a section page ----
    console.log(
      `Scenario 1: /section/${philA.firstId} — keyboard toggle to Stacked`,
    );
    const page = await context.newPage();
    const guard = attachPageGuard(page);
    await page.goto(`${BASE_URL}/section/${philA.firstId}`, {
      waitUntil: "networkidle",
    });
    guard.assertPageLoaded();
    await guard.guarded(
      page.waitForSelector("[data-testid='text-layout-toggle']"),
    );
    await guard.guarded(page.waitForSelector("div[lang='grc']"));

    const t0 = await toggleState(page);
    check(
      "toggle is a labelled role=group",
      !!t0 && t0.role === "group" && !!t0.ariaLabel,
      JSON.stringify(t0),
    );
    check(
      "Parallel pressed by default, Stacked not",
      !!t0 && t0.parallelPressed === "true" && t0.stackedPressed === "false",
      JSON.stringify(t0),
    );
    const colsBefore = await passageColumnCounts(page);
    check(
      "parallel mode renders two columns at desktop width",
      colsBefore.length > 0 && colsBefore.every((c) => c === 2),
      JSON.stringify(colsBefore),
    );

    await keyboardActivate(page, "text-layout-stacked");
    const t1 = await toggleState(page);
    check(
      "Enter flips aria-pressed to Stacked",
      !!t1 && t1.stackedPressed === "true" && t1.parallelPressed === "false",
      JSON.stringify(t1),
    );
    const colsAfter = await passageColumnCounts(page);
    check(
      "stacked mode renders ONE column",
      colsAfter.length > 0 && colsAfter.every((c) => c === 1),
      JSON.stringify(colsAfter),
    );
    const stored = await page.evaluate(() =>
      window.localStorage.getItem("laertius:text-layout"),
    );
    check(
      "preference persisted to localStorage",
      stored === "stacked",
      `got ${stored}`,
    );
    await page.close();

    // ---- Scenario 2: persistence across pages (fresh loads) ----
    console.log(
      `Scenario 2: fresh /section/${philB.firstId} and /browse open already Stacked`,
    );
    const page2 = await context.newPage();
    const guard2 = attachPageGuard(page2);
    await page2.goto(`${BASE_URL}/section/${philB.firstId}`, {
      waitUntil: "networkidle",
    });
    guard2.assertPageLoaded();
    await guard2.guarded(page2.waitForSelector("div[lang='grc']"));
    const t2 = await toggleState(page2);
    check(
      "other section page: Stacked pressed without interaction",
      !!t2 && t2.stackedPressed === "true",
      JSON.stringify(t2),
    );
    const cols2 = await passageColumnCounts(page2);
    check(
      "other section page: one column from the stored pref",
      cols2.length > 0 && cols2.every((c) => c === 1),
      JSON.stringify(cols2),
    );
    await page2.close();

    const page3 = await context.newPage();
    const guard3 = attachPageGuard(page3);
    await page3.goto(`${BASE_URL}/browse`, { waitUntil: "networkidle" });
    guard3.assertPageLoaded();
    // Pick a philosopher from the index to reveal the passages toolbar.
    await page3
      .locator("button", { hasText: philA.name })
      .first()
      .click();
    await guard3.guarded(
      page3.waitForSelector("[data-testid='text-layout-toggle']"),
    );
    await guard3.guarded(page3.waitForSelector("div[lang='grc']"));
    const t3 = await toggleState(page3);
    check(
      "browse page toolbar: Stacked pressed from the shared pref",
      !!t3 && t3.stackedPressed === "true",
      JSON.stringify(t3),
    );
    const cols3 = await passageColumnCounts(page3);
    check(
      "browse passage cards: one column",
      cols3.length > 0 && cols3.every((c) => c === 1),
      JSON.stringify(cols3),
    );
    await page3.close();

    // ---- Scenario 3+4: graph List view, URL sync, Back/Forward ----
    console.log("Scenario 3: /graph — keyboard List toggle, URL sync, tables");
    const page4 = await context.newPage();
    const guard4 = attachPageGuard(page4);
    await page4.goto(`${BASE_URL}/graph`, { waitUntil: "networkidle" });
    guard4.assertPageLoaded();
    await guard4.guarded(
      page4.waitForSelector("[data-testid='graph-view-list']"),
    );
    await page4.evaluate(() => {
      (window as unknown as Record<string, unknown>).__e2eNoReload = true;
    });
    await keyboardActivate(page4, "graph-view-list");
    await guard4.guarded(
      page4.waitForSelector("[data-testid='graph-list-view']"),
    );
    check(
      "activating List rewrites the URL to ?view=list",
      new URL(page4.url()).searchParams.get("view") === "list",
      page4.url(),
    );
    check(
      "List button reports aria-pressed=true",
      (await page4
        .locator("[data-testid='graph-view-list']")
        .getAttribute("aria-pressed")) === "true",
    );
    const audit = await auditTables(page4, "graph-list-view");
    check(
      "graph list renders tables",
      audit.found && audit.tableCount > 0,
      JSON.stringify(audit),
    );
    check(
      "every graph list table has a non-empty caption",
      audit.allHaveCaption,
      JSON.stringify(audit),
    );
    check(
      `all ${audit.colHeaderCount} column headers carry scope=col`,
      audit.colHeaderCount > 0 && audit.allColHeadersScoped,
    );
    check(
      `all ${audit.rowHeaderCount} row headers carry scope=row`,
      audit.rowHeaderCount > 0 && audit.allRowHeadersScoped,
    );

    console.log("Scenario 4: ?view=list survives Back/Forward");
    // Follow a wouter Link out of the list (pushState -> history entry).
    await page4
      .locator(`[data-testid='list-node-life-${graphNode.name}']`)
      .click();
    await page4.waitForSelector("div[lang='grc']");
    check(
      "Read the Life navigates to the section page",
      new URL(page4.url()).pathname.startsWith("/section/"),
      page4.url(),
    );
    await page4.goBack();
    await page4.waitForSelector("[data-testid='graph-list-view']");
    check(
      "Back returns to /graph?view=list",
      new URL(page4.url()).pathname === "/graph" &&
        new URL(page4.url()).searchParams.get("view") === "list",
      page4.url(),
    );
    check(
      "Back re-renders the LIST view (adoption effect), not the network",
      (await page4
        .locator("[data-testid='graph-view-list']")
        .getAttribute("aria-pressed")) === "true",
    );
    await page4.goForward();
    await page4.waitForSelector("div[lang='grc']");
    check(
      "Forward restores the section page",
      new URL(page4.url()).pathname.startsWith("/section/"),
      page4.url(),
    );
    const noReload = await page4.evaluate(
      () => (window as unknown as Record<string, unknown>).__e2eNoReload === true,
    );
    check("no full page reload across List/Back/Forward", noReload);
    await page4.close();

    // Direct shared-link load of ?view=list.
    const page5 = await context.newPage();
    const guard5 = attachPageGuard(page5);
    await page5.goto(`${BASE_URL}/graph?view=list`, {
      waitUntil: "networkidle",
    });
    guard5.assertPageLoaded();
    check(
      "direct load of /graph?view=list lands on the list view",
      (await page5.locator("[data-testid='graph-list-view']").count()) === 1,
      page5.url(),
    );
    await page5.close();

    // ---- Scenario 5: timeline List view ----
    console.log("Scenario 5: /timeline — keyboard List toggle, table a11y");
    const page6 = await context.newPage();
    const guard6 = attachPageGuard(page6);
    await page6.goto(`${BASE_URL}/timeline`, { waitUntil: "networkidle" });
    guard6.assertPageLoaded();
    await guard6.guarded(
      page6.waitForSelector("[data-testid='timeline-view-list']"),
    );
    await keyboardActivate(page6, "timeline-view-list");
    await page6.waitForSelector("[data-testid='timeline-list-table']");
    check(
      "timeline List button reports aria-pressed=true",
      (await page6
        .locator("[data-testid='timeline-view-list']")
        .getAttribute("aria-pressed")) === "true",
    );
    check(
      "timeline Timeline button reports aria-pressed=false",
      (await page6
        .locator("[data-testid='timeline-view-timeline']")
        .getAttribute("aria-pressed")) === "false",
    );
    const tAudit = await auditTables(page6, "timeline-list-table");
    check(
      "timeline list table present",
      tAudit.found && tAudit.tableCount === 1,
      JSON.stringify(tAudit),
    );
    check(
      "timeline table has a non-empty caption",
      tAudit.allHaveCaption,
      JSON.stringify(tAudit),
    );
    check(
      `timeline: all ${tAudit.colHeaderCount} column headers scope=col`,
      tAudit.colHeaderCount > 0 && tAudit.allColHeadersScoped,
    );
    check(
      `timeline: all ${tAudit.rowHeaderCount} row headers scope=row`,
      tAudit.rowHeaderCount > 0 && tAudit.allRowHeadersScoped,
    );
    // Toggling to List must be reflected in the URL (replaceState) so the
    // accessible view is shareable, matching the graph page's behavior.
    check(
      "timeline: toggling to List puts ?view=list in the URL",
      new URL(page6.url()).searchParams.get("view") === "list",
      page6.url(),
    );
    // Toggling back to Timeline must drop ?view= again (replaceState).
    await keyboardActivate(page6, "timeline-view-timeline");
    await page6.waitForSelector("[data-testid='timeline-list-table']", {
      state: "detached",
    });
    check(
      "timeline: toggling back to Timeline removes ?view= from the URL",
      new URL(page6.url()).searchParams.get("view") === null,
      page6.url(),
    );
    // A shared /timeline?view=list link must open directly in List view.
    // (Current URL is /timeline, so this goto pushes a new history entry;
    // navigating to the URL the page already has would replace it instead
    // and break the Back/Forward checks below.)
    await page6.goto(`${BASE_URL}/timeline?view=list`, {
      waitUntil: "networkidle",
    });
    guard6.assertPageLoaded();
    await guard6.guarded(
      page6.waitForSelector("[data-testid='timeline-list-table']"),
    );
    check(
      "timeline: direct /timeline?view=list load opens in List view",
      (await page6
        .locator("[data-testid='timeline-view-list']")
        .getAttribute("aria-pressed")) === "true",
    );
    // Back returns to the plain /timeline entry (interactive view),
    // Forward restores the List view from ?view=list.
    await page6.goBack({ waitUntil: "networkidle" });
    await page6.waitForSelector("[data-testid='timeline-list-table']", {
      state: "detached",
    });
    check(
      "timeline: Back returns to the interactive Timeline view",
      (await page6
        .locator("[data-testid='timeline-view-timeline']")
        .getAttribute("aria-pressed")) === "true",
    );
    await page6.goForward({ waitUntil: "networkidle" });
    await page6.waitForSelector("[data-testid='timeline-list-table']");
    check(
      "timeline: Forward restores the List view",
      (await page6
        .locator("[data-testid='timeline-view-list']")
        .getAttribute("aria-pressed")) === "true",
    );
    await page6.close();

    // ---- Scenario 6: timeline school filter & expanded philosopher ----
    console.log(
      "Scenario 6: /timeline — ?school= / ?p= URL sync, shared link, Back/Forward",
    );
    const tlRes = await fetch(`${BASE_URL}/api/timeline`);
    if (!tlRes.ok) throw new Error(`/api/timeline -> ${tlRes.status}`);
    const tlPhils = (await tlRes.json()) as {
      name: string;
      movement: string;
    }[];
    const school = tlPhils[0]?.movement;
    const schoolPhil = tlPhils.find((p) => p.movement === school);
    if (!school || !schoolPhil) throw new Error("no timeline movements served");
    const schoolCount = tlPhils.filter((p) => p.movement === school).length;

    const page7 = await context.newPage();
    const guard7 = attachPageGuard(page7);
    await page7.goto(`${BASE_URL}/timeline`, { waitUntil: "networkidle" });
    guard7.assertPageLoaded();
    await guard7.guarded(
      page7.waitForSelector(`[data-testid='timeline-school-${school}']`),
    );
    await page7.evaluate(() => {
      (window as unknown as Record<string, unknown>).__e2eNoReload = true;
    });

    // Clicking a school chip filters and writes ?school= (replaceState).
    await keyboardActivate(page7, `timeline-school-${school}`);
    await page7.waitForFunction(
      (s) => new URL(window.location.href).searchParams.get("school") === s,
      school,
    );
    check(
      "clicking a school chip writes ?school= to the URL",
      new URL(page7.url()).searchParams.get("school") === school,
      page7.url(),
    );
    check(
      "school chip reports aria-pressed=true",
      (await page7
        .locator(`[data-testid='timeline-school-${school}']`)
        .getAttribute("aria-pressed")) === "true",
    );

    // Expanding a philosopher adds ?p= (replaceState).
    await page7
      .locator(`[data-testid='timeline-phil-${schoolPhil.name}']`)
      .click();
    await page7.waitForFunction(
      (n) => new URL(window.location.href).searchParams.get("p") === n,
      schoolPhil.name,
    );
    check(
      "expanding a philosopher writes ?p= to the URL",
      new URL(page7.url()).searchParams.get("p") === schoolPhil.name,
      page7.url(),
    );

    // Shared link: a direct load with ?school= and ?view=list restores
    // both the filter and the list view. (The current URL carries ?p=
    // and no ?view=, so this goto differs and PUSHES a history entry —
    // a goto to the page's current URL would replace it instead and
    // break the Back/Forward checks below.)
    await page7.goto(
      `${BASE_URL}/timeline?school=${encodeURIComponent(school)}&view=list`,
      { waitUntil: "networkidle" },
    );
    guard7.assertPageLoaded();
    await guard7.guarded(
      page7.waitForSelector("[data-testid='timeline-list-table']"),
    );
    check(
      "shared ?school= link restores the filter (chip pressed)",
      (await page7
        .locator(`[data-testid='timeline-school-${school}']`)
        .getAttribute("aria-pressed")) === "true",
    );
    const rowCount = await page7
      .locator("[data-testid='timeline-list-table'] tbody tr")
      .count();
    check(
      `shared link: list shows only the ${schoolCount} ${school} rows`,
      rowCount === schoolCount,
      `got ${rowCount} rows`,
    );

    // Back restores the previous entry: interactive view, same school
    // filter, and the expanded philosopher from ?p=.
    await page7.goBack({ waitUntil: "networkidle" });
    await page7.waitForSelector("[data-testid='timeline-list-table']", {
      state: "detached",
    });
    check(
      "Back keeps the school filter (chip still pressed)",
      (await page7
        .locator(`[data-testid='timeline-school-${school}']`)
        .getAttribute("aria-pressed")) === "true",
      page7.url(),
    );
    check(
      "Back restores the expanded philosopher from ?p=",
      (await page7
        .locator(`[data-testid='timeline-phil-${schoolPhil.name}']`)
        .getAttribute("aria-expanded")) === "true",
      page7.url(),
    );
    // Forward returns to the filtered list view.
    await page7.goForward({ waitUntil: "networkidle" });
    await page7.waitForSelector("[data-testid='timeline-list-table']");
    check(
      "Forward restores the filtered List view",
      (await page7
        .locator(`[data-testid='timeline-school-${school}']`)
        .getAttribute("aria-pressed")) === "true" &&
        (await page7
          .locator("[data-testid='timeline-view-list']")
          .getAttribute("aria-pressed")) === "true",
      page7.url(),
    );
    // Refresh: a reload of the current URL must keep the filter.
    await page7.reload({ waitUntil: "networkidle" });
    await page7.waitForSelector("[data-testid='timeline-list-table']");
    check(
      "refresh preserves the school filter and List view",
      (await page7
        .locator(`[data-testid='timeline-school-${school}']`)
        .getAttribute("aria-pressed")) === "true",
      page7.url(),
    );
    await page7.close();
  } finally {
    await browser.close();
  }

  if (failures > 0) {
    console.error(`\n${failures} check(s) FAILED`);
    process.exit(1);
  }
  console.log("\nAll accessible-view checks passed.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
