/// <reference lib="dom" />
// The in-page callbacks (page.evaluate / waitForFunction) run in the
// browser, so this Node-side script needs the DOM lib for their types.
//
// Real-browser check of the "asserted in" work link from a philosopher's
// claims panel: the source-level validate-claims now guarantees every
// claim sourceWorkUri resolves to an entity in the annotated entities
// index, but the reader-facing click flow could still regress while that
// pin stays green — the claims panel builds the link as
// /entities?entity=<encoded uri>, and the Index page's URL-param handling
// (decoding, panel opening, occurrence summary) sits in a different
// component. e2e-chain-links covers the same line on a /section page;
// this script pins the other entry point, the Browse page's philosopher
// claims panel. It drives headless Chromium against the running dev
// servers:
//
// 1. On /browse, clicking Thales in the sidebar must render his claims
//    panel (open by default) with the attribution line "according to
//    Apollodorus, asserted in Chronology", where Chronology is a link
//    whose href is /entities?entity=<encoded work URI> and the encoded
//    URI round-trips through decodeURIComponent to a chronology slug.
// 2. Clicking the Chronology link must land on /entities with the work's
//    entry open: ?entity= identifying it, the detail heading naming
//    Chronology, its "Work" kind chip, and the occurrence summary
//    ("N occurrences in M sections") rendered.
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

const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:80";

// Thales' birth-date claim (D.L. 1.37) is "according to Apollodorus,
// asserted in Chronology"; routes/graph.ts sets sourceWorkUri via
// workUri("Chronology"), which validate-claims pins to a real Index entry.
const PHILOSOPHER = "Thales";
const AUTHORITY = "Apollodorus";
const WORK = "Chronology";
// The claims panel sets this title only on work Index links.
const WORK_TITLE = "Open this work in the Index";

let failures = 0;
function check(label: string, ok: boolean, detail?: string) {
  if (ok) {
    console.log(`  ok: ${label}`);
  } else {
    failures++;
    console.error(`  FAIL: ${label}${detail ? ` (${detail})` : ""}`);
  }
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({
      viewport: { width: 1280, height: 720 },
    });
    // Fail fast with the failing URL/status instead of an opaque selector
    // timeout when the site itself fails to boot (500 on a module/CSS,
    // uncaught page error, etc.).
    const guard = attachPageGuard(page);

    console.log(
      `Scenario 1: /browse -> ${PHILOSOPHER} renders "asserted in ${WORK}" as an Index link`,
    );
    await page.goto(`${BASE_URL}/browse`, { waitUntil: "networkidle" });
    guard.assertPageLoaded();
    // The sidebar buttons render once the philosopher list has loaded.
    await guard.guarded(
      page.waitForFunction(
        (name) =>
          Array.from(document.querySelectorAll("button")).some(
            (b) => b.querySelector("span")?.textContent?.trim() === name,
          ),
        PHILOSOPHER,
        { timeout: 30000 },
      ),
    );
    const philClicked = await page.evaluate((name) => {
      const btn = Array.from(document.querySelectorAll("button")).find(
        (b) => b.querySelector("span")?.textContent?.trim() === name,
      );
      if (!btn) return false;
      btn.click();
      return true;
    }, PHILOSOPHER);
    check(`${PHILOSOPHER} selected in the sidebar`, philClicked);

    // The claims panel is collapsible but open by default on /browse; the
    // attribution line renders once the claims request resolves.
    await guard.guarded(
      page.waitForFunction(
        ([authority, work]) =>
          document.body.innerText.includes(`according to ${authority}`) &&
          document.body.innerText.includes(`asserted in ${work}`),
        [AUTHORITY, WORK] as const,
        { timeout: 30000 },
      ),
    );
    await page.waitForTimeout(300);

    // Snapshot the attribution line: the authority must stay plain text
    // while the work is an anchor into the Index. No helper functions
    // inside evaluate: tsx's esbuild transform wraps named locals with a
    // __name helper that doesn't exist in the page.
    const line = await page.evaluate(
      ([authority, workTitle]) => {
        const span = Array.from(document.querySelectorAll("span")).find(
          (s) => {
            const t = (s.textContent ?? "").trim();
            return (
              t.startsWith("according to") &&
              t.includes(authority) &&
              t.includes("asserted in") &&
              // Take the whole line span, not a nested child.
              !(s.parentElement?.textContent ?? "")
                .trim()
                .startsWith("according to")
            );
          },
        );
        if (!span) return null;
        const anchors = Array.from(span.querySelectorAll("a"));
        return {
          text: (span.textContent ?? "").trim(),
          anchorTexts: anchors.map((a) => (a.textContent ?? "").trim()),
          workLinks: anchors
            .filter((a) => a.getAttribute("title") === workTitle)
            .map((a) => ({
              text: (a.textContent ?? "").trim(),
              href: a.getAttribute("href") ?? "",
            })),
        };
      },
      [AUTHORITY, WORK_TITLE] as const,
    );
    check(
      `"according to ${AUTHORITY}, asserted in ${WORK}" line rendered`,
      !!line &&
        line.text.includes(`according to ${AUTHORITY}`) &&
        line.text.includes(`asserted in ${WORK}`),
      `text=${JSON.stringify(line?.text)}`,
    );
    check(
      `${AUTHORITY} is not an anchor inside the attribution line`,
      !!line && !line.anchorTexts.includes(AUTHORITY),
      `anchors=${JSON.stringify(line?.anchorTexts)}`,
    );
    const workLink = line?.workLinks.find((l) => l.text === WORK) ?? null;
    check(
      `${WORK} is a work link in the attribution line`,
      !!workLink,
      `workLinks=${JSON.stringify(line?.workLinks)}`,
    );
    // The href must be /entities?entity=<encoded uri>, and the encoded
    // value must round-trip through decodeURIComponent to a URI that
    // identifies the work (the workUri slug lowercases the title).
    const encodedEntity = workLink?.href.startsWith("/entities?entity=")
      ? (new URLSearchParams(workLink.href.split("?")[1] ?? "").get(
          "entity",
        ) ?? "")
      : "";
    check(
      `${WORK} href is /entities?entity= with a URI identifying the work`,
      !!encodedEntity &&
        decodeURIComponent(encodedEntity)
          .toLowerCase()
          .includes(WORK.toLowerCase()),
      `href=${workLink?.href}`,
    );

    console.log(`Scenario 2: clicking ${WORK} opens its Index entry`);
    // Click via a bubbling MouseEvent (wouter handles the client-side
    // navigation; this avoids Playwright's scroll-into-view coordinate
    // games).
    const clicked = await page.evaluate(
      ([t, txt]) => {
        const a = Array.from(document.querySelectorAll("a")).find(
          (el) =>
            el.getAttribute("title") === t &&
            (el.textContent ?? "").trim() === txt,
        );
        if (!a) return false;
        a.dispatchEvent(
          new MouseEvent("click", { bubbles: true, cancelable: true }),
        );
        return true;
      },
      [WORK_TITLE, WORK] as const,
    );
    check(`${WORK} link found and clicked`, clicked);

    await guard.guarded(
      page.waitForFunction(
        () => window.location.pathname === "/entities",
        undefined,
        { timeout: 10000 },
      ),
    );
    const headingShown = await page
      .waitForFunction(
        ([n, sel]) =>
          Array.from(document.querySelectorAll(sel)).some(
            (h) => (h.textContent ?? "").trim().toLowerCase() ===
              n.toLowerCase(),
          ),
        [WORK, PAGE_HEADING_SELECTOR] as const,
        { timeout: 15000 },
      )
      .then(
        () => true,
        () => false,
      );
    check(`index detail heading names ${WORK}`, headingShown);
    // The occurrence summary renders alongside once the detail has loaded.
    const hasOccurrences = await page
      .waitForFunction(
        () =>
          /\d+ occurrences? in \d+ sections?/.test(document.body.innerText),
        undefined,
        { timeout: 15000 },
      )
      .then(
        () => true,
        () => false,
      );
    check("entity detail shows the occurrence summary", hasOccurrences);
    const state = await page.evaluate(() => {
      const params = new URLSearchParams(window.location.search);
      return {
        entity: params.get("entity"),
        isWorkKind: Array.from(document.querySelectorAll("span")).some(
          (s) => (s.textContent ?? "").trim() === "Work",
        ),
      };
    });
    check(
      `?entity= in the /entities URL identifies ${WORK}`,
      !!state.entity &&
        decodeURIComponent(state.entity)
          .toLowerCase()
          .includes(WORK.toLowerCase()),
      `entity=${state.entity}`,
    );
    check('entry is tagged with the "Work" kind chip', state.isWorkKind);
  } finally {
    await browser.close();
  }

  if (failures > 0) {
    console.error(`\ne2e-asserted-in: ${failures} check(s) FAILED`);
    process.exit(1);
  }
  console.log("\ne2e-asserted-in: all checks passed");
}

main().catch((err) => {
  console.error("e2e-asserted-in crashed:", err);
  process.exit(1);
});
