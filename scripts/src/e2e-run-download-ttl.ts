/// <reference lib="dom" />
// Real-browser check that the one-click "Run & download .ttl" button in the
// SPARQL playground (components/sparql-playground.tsx) still produces a real
// Turtle download. The button chains three fragile pieces: the client-side
// CONSTRUCT/DESCRIBE detection (isGraphQuery) that decides whether the button
// renders at all, the endpoint's content negotiation (Accept: text/turtle
// must actually come back as turtle), and the blob-download plumbing. A
// regression in any of them leaves scholars with a missing or silently
// broken button while every source-level pin stays green.
//
// The About page's inline example runners were removed (the runnable
// examples moved to the SPARQL console), so the playground's always-on
// surface is the Competency page. This validator:
//
// 1. Opens /competency?q=stoa-members, expands the "SPARQL query" block and
//    asserts the button is ABSENT while the editor holds the question's
//    SELECT query (a SELECT growing a .ttl button means isGraphQuery
//    misclassifies non-graph queries).
// 2. Replaces the editor content with the Pythagoras CONSTRUCT query (the
//    same example shipped in the SPARQL console's LOD group) and asserts
//    EXACTLY ONE sparql-run-download-ttl button appears.
// 3. Clicks it and captures the browser download: the suggested filename
//    must end in .ttl, the content must be non-empty compacted Turtle
//    (prefix declarations + prefixed terms) and must mention Pythagoras.
// 4. Asserts no error banner appeared in the playground after the run.
//
// Requirements: the API server and web workflows must be running (the
// script talks to the shared proxy, default http://localhost:80), and a
// Chromium headless shell must be installed for playwright-core, e.g.:
//   PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright \
//     node scripts/node_modules/playwright-core/cli.js install chromium-headless-shell
import { readFileSync } from "node:fs";

// playwright-core resolves its browser registry at module import time from
// PLAYWRIGHT_BROWSERS_PATH; set it BEFORE importing playwright-core.
import "./lib/playwright-browsers-path";

const { chromium } = await import("playwright-core");
const { attachPageGuard } = await import("./lib/e2e-page-guard");

const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:80";
const BUTTON = '[data-testid="sparql-run-download-ttl"]';

// The Pythagoras CONSTRUCT example from the SPARQL console's LOD group
// (artifacts/laertius/src/pages/sparql-examples.ts). Kept inline so this
// Node-side script does not import Vite-flavoured frontend modules; the
// content pin below (mentions Pythagoras, real triples) fails loudly if the
// two ever drift apart in a way that matters.
const CONSTRUCT_QUERY = `PREFIX lo: <https://humanisticadigitalia.eu/Laertius/ontology#>
PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX dcterms: <http://purl.org/dc/terms/>
CONSTRUCT {
  ?claim rdf:subject ?philosopher ;
         rdf:object ?statement ;
         lo:accordingTo ?authority ;
         dcterms:bibliographicCitation ?cite .
  ?philosopher rdfs:label ?philosopherLabel .
  ?authority rdfs:label ?authorityLabel .
} WHERE {
  ?claim rdf:subject ?philosopher ;
         rdf:object ?statement ;
         dcterms:bibliographicCitation ?cite .
  ?philosopher rdfs:label ?philosopherLabel .
  FILTER(LANG(?philosopherLabel) = "en")
  FILTER(STR(?philosopherLabel) = "Pythagoras")
  OPTIONAL {
    ?claim lo:accordingTo ?authority .
    ?authority rdfs:label ?authorityLabel .
    FILTER(LANG(?authorityLabel) = "en")
  }
}`;

let failures = 0;
function check(label: string, ok: boolean, detail?: string) {
  if (ok) {
    console.log(`  ok: ${label}`);
  } else {
    failures++;
    console.error(`  FAIL: ${label}${detail ? ` (${detail})` : ""}`);
  }
}

// The endpoint compacts graph downloads into prefixed Turtle
// (artifacts/api-server/src/lib/turtle-compact.ts): an @prefix prologue plus
// prefixed terms like rdfs:label in the triple body. A download that is only
// raw <IRI> lines (N-Triples) means the compaction silently regressed, so
// this sniff REQUIRES both:
//   1. at least one @prefix declaration, and
//   2. at least one compact prefixed term (prefix:local) on a non-prologue
//      triple line,
// while still rejecting HTML/JSON error bodies.
function isCompactTurtle(ttl: string): boolean {
  const hasPrefixDecl = /^\s*@prefix\s+[A-Za-z_][\w-]*:\s*<[^>]+>\s*\./m.test(
    ttl,
  );
  // Prefixed term on a triple (non-@prefix) line: word chars + colon + local
  // name, not inside an <IRI> (IRIs contain "://" but scheme colons are
  // followed by "//" or appear within <...>, which triple-line scan avoids
  // by stripping quoted literals and <IRI> tokens first).
  const hasPrefixedTerm = ttl.split("\n").some((line) => {
    const t = line.trim();
    if (!t || /^@prefix/i.test(t)) return false;
    const stripped = t
      .replace(/"(?:[^"\\]|\\.)*"/g, '""')
      .replace(/<[^>]*>/g, "<>");
    return /(?:^|\s)[A-Za-z_][\w-]*:[A-Za-z_][\w-]*(?=\s|$|[;,.])/.test(
      stripped,
    );
  });
  const looksLikeTurtle =
    /\s\.\s*(\r?\n|$)/.test(ttl) &&
    !/^\s*[<{[]?\s*(!DOCTYPE|html|\{)/i.test(ttl.trim().slice(0, 15));
  return hasPrefixDecl && hasPrefixedTerm && looksLikeTurtle;
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({
      viewport: { width: 1280, height: 900 },
      acceptDownloads: true,
    });
    // Fail fast with the failing URL/status instead of an opaque selector
    // timeout when the site itself fails to boot.
    const guard = attachPageGuard(page);

    console.log("Competency playground: Run & download .ttl must yield real Turtle");
    await page.goto(`${BASE_URL}/competency?q=stoa-members`, {
      waitUntil: "networkidle",
    });
    guard.assertPageLoaded();

    // Open the question's SPARQL block and wait for the editor to mount.
    const toggle = page.locator('button:has-text("SPARQL query")').first();
    await guard.guarded(toggle.waitFor({ timeout: 30000 }));
    await toggle.click();
    await guard.guarded(
      page.waitForFunction(
        () => {
          const el = document.querySelector(
            '[data-testid="sparql-query-editor"]',
          );
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          return !!(el as any)?.__cmView?.state?.doc;
        },
        undefined,
        { timeout: 15000 },
      ),
    );

    // 1. SELECT preset: the button must NOT render.
    const selectCount = await page.locator(BUTTON).count();
    check(
      "no .ttl button while the editor holds the question's SELECT query",
      selectCount === 0,
      `saw ${selectCount} — a non-graph query got misclassified as a graph query`,
    );

    // 2. Replace the editor content with the CONSTRUCT example.
    await page.evaluate((t: string) => {
      const el = document.querySelector('[data-testid="sparql-query-editor"]');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const view = (el as any)?.__cmView;
      if (view) {
        view.dispatch({
          changes: { from: 0, to: view.state.doc.length, insert: t },
        });
      }
    }, CONSTRUCT_QUERY);
    await page.waitForSelector(BUTTON, { timeout: 10000 });
    const buttonCount = await page.locator(BUTTON).count();
    check(
      `exactly one Run & download .ttl button for a CONSTRUCT query, saw ${buttonCount}`,
      buttonCount === 1,
      buttonCount === 0
        ? "isGraphQuery no longer flags the CONSTRUCT query"
        : "more than one playground rendered a .ttl button",
    );
    if (buttonCount !== 1) return;

    const button = page.locator(BUTTON);
    check(
      "button is enabled and labelled",
      (await button.isEnabled()) &&
        /run\s*&\s*download\s*\.ttl/i.test((await button.textContent()) ?? ""),
      `text="${await button.textContent()}"`,
    );

    // Click and capture the blob download.
    const downloadPromise = page.waitForEvent("download", { timeout: 30000 });
    await button.click();
    let ttl = "";
    let suggested = "";
    try {
      const download = await downloadPromise;
      suggested = download.suggestedFilename();
      const path = await download.path();
      if (path) ttl = readFileSync(path, "utf-8");
    } catch (err) {
      check(
        "clicking the button triggers a download",
        false,
        err instanceof Error ? err.message : String(err),
      );
    }

    if (ttl || suggested) {
      check(
        `suggested filename ends in .ttl ("${suggested}")`,
        suggested.endsWith(".ttl"),
      );
      check(
        `downloaded content is non-empty (${ttl.length} chars)`,
        ttl.trim().length > 0,
      );
      // The endpoint compacts CONSTRUCT/DESCRIBE Turtle via turtle-compact.ts,
      // so the download must be PREFIXED Turtle: @prefix declarations plus at
      // least one compact prefixed term in a triple line. Raw full-IRI
      // (N-Triples-flavoured) output is a regression and must FAIL here —
      // and never HTML or JSON.
      check(
        "content is compacted Turtle (@prefix prologue + prefixed terms, not raw <IRI>-only lines)",
        isCompactTurtle(ttl),
        ttl.slice(0, 200),
      );
      check(
        "content mentions Pythagoras (subject of the CONSTRUCT query)",
        /Pythagoras|Πυθαγόρ/.test(ttl),
        ttl.slice(0, 200),
      );
      // The example CONSTRUCT emits rdfs:label triples; a graph with real
      // triples must contain more than just prologue lines.
      const tripleLines = ttl
        .split("\n")
        .filter((l) => l.trim() && !/^@?prefix/i.test(l.trim()));
      check(
        `download carries actual triples (${tripleLines.length} non-prefix lines)`,
        tripleLines.length > 0,
      );
    }

    // The component surfaces failures as an inline error banner rather than
    // throwing; make sure none appeared after the run settled.
    await page.waitForTimeout(500);
    const errorText = await page.evaluate(() => {
      const playground = document.querySelector(
        '[data-testid="sparql-playground"]',
      );
      const banner = playground?.querySelector(
        "p.text-red-700, p[class*='text-red']",
      );
      return banner?.textContent?.trim() ?? null;
    });
    check(
      "no error banner shown in the playground after the run",
      errorText === null,
      errorText ?? undefined,
    );

    // Negative controls: the compact-Turtle sniff must be able to fire on
    // garbage AND on prefix-free N-Triples (the regression this validator
    // exists to catch — the endpoint reverting to full-IRI output).
    check(
      "negative control: an HTML error page would not pass the Turtle sniff",
      !isCompactTurtle("<!DOCTYPE html><html><body>error</body></html>"),
    );
    const nTriples = [
      '<http://example.org/s> <http://www.w3.org/2000/01/rdf-schema#label> "Pythagoras" .',
      "<http://example.org/s> <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <http://example.org/T> .",
    ].join("\n");
    check(
      "negative control: prefix-free N-Triples output would FAIL the compact-Turtle check",
      !isCompactTurtle(nTriples),
    );
    // Positive control: a minimal compacted document must pass, proving the
    // sniff isn't rejecting everything.
    check(
      "positive control: minimal compacted Turtle passes the sniff",
      isCompactTurtle(
        '@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .\n\n<http://example.org/s> rdfs:label "Pythagoras" .\n',
      ),
    );
  } finally {
    await browser.close();
  }
}

// The failure evaluation lives OUTSIDE main(): early `return`s inside main
// (e.g. when the button count is wrong) must still hit this exit-code check,
// otherwise a missing button would exit 0 and defeat the validator.
main()
  .then(() => {
    if (failures > 0) {
      console.error(`\n${failures} check(s) failed`);
      process.exit(1);
    }
    console.log("\nAll Run & download .ttl checks passed");
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
