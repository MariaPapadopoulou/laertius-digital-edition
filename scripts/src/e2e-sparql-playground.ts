/// <reference lib="dom" />
// The in-page callbacks (page.evaluate / waitForFunction) run in the
// browser, so this Node-side script needs the DOM lib for their types.
//
// Real-browser check of the SPARQL query playground component
// (components/sparql-playground.tsx). The About page's inline example
// runners were removed (the runnable examples now live in the SPARQL
// console with a store selector), so the playground's one remaining
// always-on surface is the Competency page: each question's "SPARQL query"
// block opens a CodeMirror editor + Run button and renders results inline.
// This script makes the component check repeatable so a change to the
// competency page, the playground component, or the /api/lod/sparql
// endpoint cannot silently break it:
//
// 1. Open /competency?q=stoa-members and click the "SPARQL query" toggle:
//    the playground opens with the question's query prefilled in the editor.
// 2. Assert that the CodeMirror editor renders tokenized (highlighted) spans.
// 3. Click "Run query": a results table must render with ?-prefixed headers
//    and at least one row, plus the "N rows" counter and CSV/JSON buttons.
// 4. Assert that the prefix autocomplete inserts a full PREFIX declaration:
//    type "lo" into the editor and accept the first completion; the editor
//    must contain "PREFIX lo:".
// 5. Replace the editor content with a malformed query and run it: the
//    inline error box must appear with the endpoint's "SPARQL query failed"
//    message, and no results table must remain.
// 6. An ASK query renders the "Result: true" line (and a never-matching ASK
//    renders "Result: false"), with no results table.
// 7. CONSTRUCT and DESCRIBE queries render a non-empty Turtle <pre> block,
//    pinning the endpoint's text/turtle content-type negotiation.
// 7b. Ctrl+Enter in the focused editor runs the query (Mod-Enter keymap)
//    without clicking the Run button, and does not insert a newline.
// 8. Platform-specific shortcut hint: Linux default shows "Ctrl+Enter to
//    run"; a spoofed macOS platform shows "⌘+Enter to run".
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

const { chromium } = await import("playwright-core");
const { attachPageGuard } = await import("./lib/e2e-page-guard");
import type { Page } from "playwright-core";

const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:80";
const QUESTION_URL = `${BASE_URL}/competency?q=stoa-members`;

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

/** Wait until the CodeMirror editor is mounted with a loaded doc. */
async function waitForEditor(page: Page): Promise<void> {
  await page.waitForFunction(
    () => {
      const el = document.querySelector('[data-testid="sparql-query-editor"]');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return !!(el as any)?.__cmView?.state?.doc;
    },
    undefined,
    { timeout: 10000 },
  );
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({
      viewport: { width: 1280, height: 720 },
    });
    // Fail fast with the failing URL/status instead of an opaque selector
    // timeout when the site itself fails to boot.
    const guard = attachPageGuard(page);

    console.log("Scenario 1: opening the competency question's playground");
    await page.goto(QUESTION_URL, { waitUntil: "networkidle" });
    guard.assertPageLoaded();

    const toggle = page.locator('button:has-text("SPARQL query")').first();
    await guard.guarded(toggle.waitFor({ timeout: 15000 }));
    await toggle.click();

    const editor = page.locator('[data-testid="sparql-query-editor"]').first();
    await editor.waitFor({ timeout: 5000 });
    await waitForEditor(page);

    const prefilled = await getEditorContent(page);
    check(
      "playground opens with the question's SPARQL query prefilled",
      /SELECT/i.test(prefilled) && /PREFIX/i.test(prefilled),
      `value starts: ${JSON.stringify(prefilled.slice(0, 60))}`,
    );

    console.log("Scenario 2: CodeMirror editor renders tokenized (highlighted) spans");
    // The SPARQL StreamLanguage tokenises the query into semantic tokens.
    // CodeMirror 6 wraps each token in a <span> inside .cm-line; it uses
    // auto-generated CSS class names (the ͼ* series), not semantic names
    // like tok-keyword.  Any span inside .cm-line confirms the highlighter
    // is active.  Wait up to 3 s for the first tokenised span to appear
    // (highlighting runs synchronously on mount but the render flush is async).
    const tokenSpansAppeared = await page.waitForFunction(
      () => document.querySelectorAll(".cm-line span").length > 0,
      undefined,
      { timeout: 3000 },
    ).then(() => true).catch(() => false);
    const tokenSpans = tokenSpansAppeared
      ? await editor.locator(".cm-line span").count()
      : 0;
    check(
      "CodeMirror editor renders tokenised syntax-highlighted spans",
      tokenSpans > 0,
      `tokenised spans=${tokenSpans}`,
    );

    console.log("Scenario 3: running the question's query renders a table");
    const playground = page.locator('[data-testid="sparql-playground"]').first();
    const runButton = playground.locator('button:has-text("Run query")').first();
    await runButton.click();
    const table = playground.locator("table");
    await table.first().waitFor({ timeout: 30000 });

    const headers = await playground
      .locator("table thead th")
      .allTextContents();
    check(
      "results table headers are ?-prefixed variables",
      headers.length > 0 && headers.every((h) => h.startsWith("?")),
      `headers=${JSON.stringify(headers)}`,
    );

    const rowCount = await playground.locator("table tbody tr").count();
    check("results table has rows > 0", rowCount > 0, `rows=${rowCount}`);

    const counterText = await playground
      .locator('span:has-text("rows")')
      .first()
      .textContent()
      .catch(() => null);
    check(
      "row counter matches the rendered rows",
      counterText !== null &&
        counterText.includes(rowCount.toLocaleString("en-US")),
      `counter=${JSON.stringify(counterText)} rows=${rowCount}`,
    );

    // Download buttons for SELECT results
    const csvButton = playground.locator('button:has-text("Download CSV")');
    const jsonButton = playground.locator('button:has-text("Download JSON")');
    check(
      "Download CSV button appears after a SELECT result",
      (await csvButton.count()) > 0,
    );
    check(
      "Download JSON button appears after a SELECT result",
      (await jsonButton.count()) > 0,
    );

    console.log("Scenario 4: prefix autocomplete inserts a PREFIX lo: declaration");
    // Replace the editor content with just "lo" to trigger autocomplete,
    // then accept the first completion. The result must contain "PREFIX lo:".
    await setEditorContent(page, "lo");
    // Click inside the editor to give it focus and trigger autocomplete.
    await editor.locator(".cm-content").first().click();
    // Move cursor to end so autocompletion fires on the word "lo"
    await page.keyboard.press("End");
    // Trigger explicit autocomplete (Ctrl+Space)
    await page.keyboard.press("Control+ ");
    const autocompleteTooltip = page.locator(".cm-tooltip-autocomplete");
    const tooltipAppeared = await autocompleteTooltip
      .first()
      .waitFor({ timeout: 5000 })
      .then(() => true)
      .catch(() => false);
    check(
      "prefix autocomplete tooltip appears when typing a known prefix name",
      tooltipAppeared,
      "no .cm-tooltip-autocomplete appeared",
    );
    if (tooltipAppeared) {
      // CodeMirror 6 enforces an interactionDelay (default 75 ms) between
      // the completion opening and acceptCompletion; pressing Enter before
      // that elapses returns false and lets defaultKeymap insert a newline.
      // Wait 150 ms to safely clear the guard before accepting.
      await page.waitForTimeout(150);
      // Accept the first completion (Enter)
      await page.keyboard.press("Enter");
      await page.waitForTimeout(300);
      const afterComplete = await getEditorContent(page);
      check(
        "accepting the prefix completion inserts a PREFIX lo: declaration",
        afterComplete.includes("PREFIX lo:"),
        `content after completion: ${JSON.stringify(afterComplete.slice(0, 80))}`,
      );
    }

    console.log("Scenario 5: a malformed query shows the inline error");
    await setEditorContent(page, "SELECT ?x WHERE { this is not sparql");
    await runButton.click();
    const errorBox = playground.locator('p:has-text("SPARQL query failed")');
    await errorBox.first().waitFor({ timeout: 15000 });
    const errorText = (await errorBox.first().textContent()) ?? "";
    check(
      'inline error box shows "SPARQL query failed"',
      errorText.includes("SPARQL query failed"),
      `text=${JSON.stringify(errorText.slice(0, 80))}`,
    );
    const tableGone = (await playground.locator("table").count()) === 0;
    check("previous results table is cleared on error", tableGone);

    console.log("Scenario 6: an ASK query renders the Result: true/false line");
    // A trivially-true ASK (any triple exists) must render "Result: true".
    await setEditorContent(page, "ASK { ?s ?p ?o }");
    await runButton.click();
    const askLine = playground.locator('p:has-text("Result:")');
    await askLine.first().waitFor({ timeout: 30000 });
    const askTrueText = (await askLine.first().textContent()) ?? "";
    check(
      'ASK { ?s ?p ?o } renders "Result: true"',
      /Result:\s*true/.test(askTrueText),
      `text=${JSON.stringify(askTrueText.slice(0, 80))}`,
    );
    check(
      "no results table renders for an ASK query",
      (await playground.locator("table").count()) === 0,
    );

    // A never-matching ASK must render "Result: false" (proves the boolean
    // value is actually threaded through, not hardcoded).
    await setEditorContent(
      page,
      "ASK { <urn:e2e:nonexistent-subject> <urn:e2e:nonexistent-predicate> <urn:e2e:nonexistent-object> }",
    );
    await runButton.click();
    const askFalseAppeared = await page
      .waitForFunction(
        () => {
          const ps = document.querySelectorAll(
            '[data-testid="sparql-playground"] p',
          );
          return Array.from(ps).some((p) =>
            /Result:\s*false/.test(p.textContent ?? ""),
          );
        },
        undefined,
        { timeout: 30000 },
      )
      .then(() => true)
      .catch(() => false);
    check(
      'a never-matching ASK renders "Result: false"',
      askFalseAppeared,
      'no "Result: false" line appeared',
    );

    console.log("Scenario 7: a CONSTRUCT query renders a non-empty Turtle block");
    await setEditorContent(
      page,
      "CONSTRUCT { ?s ?p ?o } WHERE { ?s ?p ?o } LIMIT 5",
    );
    await runButton.click();
    const turtlePre = playground.locator("pre");
    await turtlePre.first().waitFor({ timeout: 30000 });
    const turtleText = (await turtlePre.first().textContent()) ?? "";
    check(
      "CONSTRUCT renders a non-empty Turtle <pre> block",
      turtleText.trim().length > 0 && turtleText.includes("<"),
      `pre length=${turtleText.trim().length}`,
    );
    check(
      "ASK result line is cleared once the Turtle result renders",
      (await playground.locator('p:has-text("Result:")').count()) === 0,
    );

    // DESCRIBE goes down the same turtle branch server-side; run one to pin
    // the endpoint's content-type negotiation for both forms.
    await setEditorContent(
      page,
      "DESCRIBE ?s WHERE { ?s ?p ?o } LIMIT 1",
    );
    await runButton.click();
    // run() clears the previous result before fetching, so the old pre
    // unmounts first; tolerate missing that window on a fast response.
    await turtlePre
      .first()
      .waitFor({ state: "detached", timeout: 2000 })
      .catch(() => {});
    const describeOk = await page
      .waitForFunction(
        () => {
          const pre = document.querySelector(
            '[data-testid="sparql-playground"] pre',
          );
          return !!pre && (pre.textContent ?? "").trim().length > 0;
        },
        undefined,
        { timeout: 30000 },
      )
      .then(() => true)
      .catch(() => false);
    check("DESCRIBE renders a non-empty Turtle <pre> block", describeOk);

    console.log(
      "Scenario 7b: Ctrl+Enter runs the query from the keyboard (Mod-Enter keymap)",
    );
    // The playground advertises "Ctrl+Enter to run" next to the Run button,
    // wired through a Mod-Enter binding in the CodeMirror keymap. Pin it by
    // focusing the editor and pressing Control+Enter WITHOUT clicking the
    // Run button: the results table must render. A keymap-ordering
    // regression (e.g. defaultKeymap's Enter swallowing the chord) would
    // instead insert a newline and never run the query.
    await setEditorContent(
      page,
      "SELECT ?s WHERE { ?s ?p ?o } LIMIT 3",
    );
    // Clear the previous (DESCRIBE) Turtle result so a stale <pre> cannot
    // mask a keymap failure: wait for the run triggered by the shortcut to
    // produce a table.
    await editor.locator(".cm-content").first().click();
    await page.keyboard.press("End");
    const docBefore = await getEditorContent(page);
    await page.keyboard.press("Control+Enter");
    const shortcutTable = await playground
      .locator("table")
      .first()
      .waitFor({ timeout: 30000 })
      .then(() => true)
      .catch(() => false);
    check(
      "Control+Enter in the focused editor renders the results table (no Run click)",
      shortcutTable,
      "no results table appeared after pressing Control+Enter",
    );
    const shortcutRows = shortcutTable
      ? await playground.locator("table tbody tr").count()
      : 0;
    check(
      "the shortcut-run query returns rows > 0",
      shortcutRows > 0,
      `rows=${shortcutRows}`,
    );
    // The chord must be handled by the Mod-Enter binding, not fall through
    // to defaultKeymap's Enter (which would insert a newline into the doc).
    const docAfter = await getEditorContent(page);
    check(
      "Control+Enter does not insert a newline into the query",
      docAfter === docBefore,
      `doc changed: ${JSON.stringify(docAfter.slice(0, 80))}`,
    );

    console.log(
      "Scenario 8: platform-specific shortcut hint (Linux default vs spoofed macOS)",
    );
    // The hint next to the Run button reads the platform via
    // isMacPlatform() (navigator.userAgentData.platform ?? navigator.platform).
    // Headless Chromium on Linux only ever exercises the Ctrl branch, so a
    // regression in the Mac branch would ship unnoticed. Pin BOTH branches:
    // first assert the default (Linux) run shows "Ctrl+Enter to run", then
    // spoof a macOS platform in a fresh page and assert "⌘+Enter to run".
    const hintLocator = playground.locator('span:has-text("Enter to run")');
    const linuxHint = (await hintLocator.first().textContent()) ?? "";
    check(
      'default (Linux) run shows the "Ctrl+Enter to run" hint',
      linuxHint === "Ctrl+Enter to run",
      `hint=${JSON.stringify(linuxHint)}`,
    );
    check(
      "default (Linux) run does not show the ⌘ hint",
      !linuxHint.includes("\u2318"),
      `hint=${JSON.stringify(linuxHint)}`,
    );

    // Spoof macOS: override BOTH sources isMacPlatform() consults, before
    // any app script runs, in a fresh page.
    const macPage = await browser.newPage({
      viewport: { width: 1280, height: 720 },
    });
    const guard2 = attachPageGuard(macPage);
    try {
      // NOTE: the init script is passed as a STRING, not a function. tsx's
      // esbuild transform injects a `__name` helper into serialized function
      // bodies, which throws a ReferenceError in-page and silently skips the
      // whole override (the spoof then fails with the Linux hint).
      await macPage.addInitScript(`
        Object.defineProperty(Navigator.prototype, "platform", {
          get: () => "MacIntel",
          configurable: true,
        });
        Object.defineProperty(Navigator.prototype, "userAgentData", {
          get: () => ({ platform: "macOS" }),
          configurable: true,
        });
      `);
      await macPage.goto(QUESTION_URL, { waitUntil: "networkidle" });
      guard2.assertPageLoaded();
      const macToggle = macPage
        .locator('button:has-text("SPARQL query")')
        .first();
      await guard2.guarded(macToggle.waitFor({ timeout: 15000 }));
      await macToggle.click();
      const macHintEl = macPage
        .locator('[data-testid="sparql-playground"]')
        .first()
        .locator('span:has-text("Enter to run")');
      await macHintEl.first().waitFor({ timeout: 5000 });
      const macHint = (await macHintEl.first().textContent()) ?? "";
      check(
        'spoofed macOS platform shows the "\u2318+Enter to run" hint',
        macHint === "\u2318+Enter to run",
        `hint=${JSON.stringify(macHint)}`,
      );
      check(
        "spoofed macOS hint does not mention Ctrl",
        !macHint.includes("Ctrl"),
        `hint=${JSON.stringify(macHint)}`,
      );
    } finally {
      await macPage.close();
    }
  } finally {
    await browser.close();
  }

  if (failures > 0) {
    console.error(`\n${failures} check(s) failed`);
    process.exit(1);
  }
  console.log("\nAll SPARQL playground checks passed");
}

await main();
