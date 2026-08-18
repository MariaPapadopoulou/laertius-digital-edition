/// <reference lib="dom" />
// The in-page callbacks (page.evaluate / waitForFunction) run in the
// browser, so this Node-side script needs the DOM lib for their types.
//
// Real-browser check of the claims panel's who-told-whom chain links: the
// source-level validate-claims pins which transmission-chain authorities
// and works carry Index URIs, but the reader-facing flow (the "via ..."
// line in the claims panel) could still regress while those pins stay
// green: a wouter or claims-panel change could render dead anchors, drop
// the links, or break the /entities navigation. This script drives
// headless Chromium against the running dev servers:
//
// 1. On /section/5.41 (Theophrastus), expanding the "From the text" panel
//    must show a "via" chain line where Hermippus is a link into the
//    Index (href /entities?entity=...hermippus) and Arcesilaus, the
//    deliberately unlinked authority, renders as plain text with no
//    anchor anywhere on the page.
// 2. Clicking the Hermippus link must land on /entities with the matching
//    entry open: ?entity= identifying Hermippus, the detail heading
//    naming him, and the occurrence summary rendered.
// 3. On /section/9.5 (Heraclitus), the chain line "Ariston (On
//    Heraclitus)" must render Ariston as plain text (no authority anchor)
//    while the work On Heraclitus is a link into the Index.
// 4. Clicking the On Heraclitus link must land on /entities with the
//    work's entry open.
// 5. On the same /section/5.41 claim, the "according to Favorinus"
//    attribution line must render the authority as a link into the Index
//    (Favorinus is pinned resolvable in accordingToPins) with no
//    ", asserted in" work segment.
// 6. On /section/5.9 (Aristotle's birth date), the attribution line
//    "according to Apollodorus, asserted in Chronology" must render
//    Apollodorus as plain text while Chronology is a link into the Index.
// 7. Clicking the Chronology link must land on /entities with the work's
//    entry open.
// 8. On /section/1.1.38 (Thales), the "according to Sosicrates" line must
//    render the authority as a link into the Index (routes/graph.ts
//    resolves sourceUri(accordingTo) for pinned authorities), while the
//    "according to Herodotus" line on the same panel renders its
//    authority as plain text with no anchor inside the line.
// 9. Clicking the Sosicrates link must land on /entities with the
//    matching entry open and populated (heading + occurrence summary),
//    catching a link that silently opens the wrong or empty Index entry.
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

// The pinned chain claim at 5.41 (Theophrastus): Favorinus tells it on the
// authority of Hermippus, who cites Arcesilaus. routes/graph.ts links
// Hermippus (a sources-index authority) and leaves Arcesilaus unlinked
// (tagged as philosopher, not source). validate-claims pins both.
const LINKED_SECTION = "5.2.41";
const LINKED_AUTHORITY = "Hermippus";
const UNLINKED_AUTHORITY = "Arcesilaus";

// The pinned chain claim at 9.5 (Heraclitus): Sotion reports Ariston's
// account in his On Heraclitus. Ariston is homonym-suppressed (unlinked);
// the work On Heraclitus resolves in the Index and is linked.
const WORK_SECTION = "9.1.5";

// Attribution ("according to ...") scenarios. On 5.2.41 the Favorinus
// claim has accordingTo with no source work; on 5.1.9 Aristotle's birth
// date is "according to Apollodorus, asserted in Chronology", where the
// authority is always plain text by design and the work carries an Index
// link (routes/graph.ts sets sourceWorkUri via workUri()).
const ATTRIBUTION_AUTHORITY = "Favorinus";
const ATTR_WORK_SECTION = "5.1.9";
const ATTR_WORK_AUTHORITY = "Apollodorus";
const ATTR_LINKED_WORK = "Chronology";
// The accordingTo authority-link scenario on 1.1.38 (Thales): the death-age
// claim is "according to Sosicrates", who resolves in the sources Index
// (accordingToPins pins him linked), while the descent claim's Herodotus is
// deliberately unpinned and must stay plain text.
const ATTR_LINK_SECTION = "1.1.38";
const ATTR_LINKED_AUTHORITY = "Sosicrates";
const ATTR_UNLINKED_AUTHORITY = "Herodotus";
const WORK_UNLINKED_AUTHORITY = "Ariston";
const LINKED_WORK = "On Heraclitus";

const AUTHORITY_TITLE = "Open this authority in the Index";
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

    // Open a section page and expand its collapsible "From the text"
    // claims panel (the "Show N facts" toggle), then wait until a chain
    // line ("via ...") containing the given name has rendered.
    const openClaimsPanel = async (sectionId: string, chainName: string) => {
      await page.goto(`${BASE_URL}/section/${sectionId}`, {
        waitUntil: "networkidle",
      });
      guard.assertPageLoaded();
      // The panel toggle renders once the claims request resolves.
      // The toggle button's textContent concatenates its two spans:
      // "From the text" + "Show N facts".
      await guard.guarded(
        page.waitForFunction(
          () =>
            Array.from(document.querySelectorAll("button")).some((b) =>
              /Show \d+ facts$/.test(b.textContent?.trim() ?? ""),
            ),
          undefined,
          { timeout: 30000 },
        ),
      );
      const expanded = await page.evaluate(() => {
        const btn = Array.from(document.querySelectorAll("button")).find(
          (b) => /Show \d+ facts$/.test(b.textContent?.trim() ?? ""),
        );
        if (!btn) return false;
        btn.click();
        return true;
      });
      check(`claims panel expanded on /section/${sectionId}`, expanded);
      // The chain line renders synchronously with the expanded body.
      await guard.guarded(
        page.waitForFunction(
          (name) => document.body.innerText.includes(name),
          chainName,
          { timeout: 10000 },
        ),
      );
      await page.waitForTimeout(300);
    };

    // Snapshot the chain anchors: which names are authority links, which
    // are work links, and whether a given name appears as any anchor at
    // all. Identified by the anchors' title attributes, which the claims
    // panel sets only on chain/work Index links.
    const chainAnchors = (aTitle: string, wTitle: string) =>
      page.evaluate(
        ([authorityTitle, workTitle]) => {
          // No helper functions inside evaluate: tsx's esbuild transform
          // wraps named locals with a __name helper that doesn't exist in
          // the page.
          const anchors = Array.from(document.querySelectorAll("a"));
          return {
            authorityLinks: anchors
              .filter((a) => a.getAttribute("title") === authorityTitle)
              .map((a) => ({
                text: (a.textContent ?? "").trim(),
                href: a.getAttribute("href") ?? "",
              })),
            workLinks: anchors
              .filter((a) => a.getAttribute("title") === workTitle)
              .map((a) => ({
                text: (a.textContent ?? "").trim(),
                href: a.getAttribute("href") ?? "",
              })),
            allAnchorTexts: anchors.map((a) => (a.textContent ?? "").trim()),
          };
        },
        [aTitle, wTitle] as const,
      );

    // Click an anchor by its exact title+text via a bubbling MouseEvent
    // (wouter handles the client-side navigation; this avoids Playwright's
    // scroll-into-view coordinate games).
    const clickChainLink = (title: string, text: string) =>
      page.evaluate(
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
        [title, text] as const,
      );

    // Assert the Index page opened the entry for `name`: /entities path,
    // ?entity= identifying it, a detail heading naming it, and the
    // occurrence summary rendered.
    const checkIndexEntry = async (name: string) => {
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
            Array.from(document.querySelectorAll(sel)).some((h) =>
              (h.textContent ?? "").toLowerCase().includes(n.toLowerCase()),
            ),
          [name, PAGE_HEADING_SELECTOR] as const,
          { timeout: 15000 },
        )
        .then(
          () => true,
          () => false,
        );
      check(`index detail heading names ${name}`, headingShown);
      // The occurrence summary loads asynchronously after the heading.
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
      const state = await page.evaluate(() => {
        const params = new URLSearchParams(window.location.search);
        return { entity: params.get("entity") };
      });
      const slug = name.toLowerCase().replace(/\s+/g, "-");
      check(
        `?entity= in the /entities URL identifies ${name}`,
        !!state.entity &&
          decodeURIComponent(state.entity).toLowerCase().includes(slug),
        `entity=${state.entity}`,
      );
      check("entity detail shows the occurrence summary", hasOccurrences);
    };

    console.log(
      `Scenario 1: /section/${LINKED_SECTION} chain links ${LINKED_AUTHORITY}, leaves ${UNLINKED_AUTHORITY} plain`,
    );
    await openClaimsPanel(LINKED_SECTION, LINKED_AUTHORITY);
    const s1 = await chainAnchors(AUTHORITY_TITLE, WORK_TITLE);
    const hermippusLink = s1.authorityLinks.find(
      (l) => l.text === LINKED_AUTHORITY,
    );
    check(
      `${LINKED_AUTHORITY} is an authority link in the chain`,
      !!hermippusLink,
      `authorityLinks=${JSON.stringify(s1.authorityLinks)}`,
    );
    check(
      `${LINKED_AUTHORITY} link points into the Index`,
      !!hermippusLink &&
        hermippusLink.href.startsWith("/entities?entity=") &&
        decodeURIComponent(hermippusLink.href)
          .toLowerCase()
          .includes(LINKED_AUTHORITY.toLowerCase()),
      `href=${hermippusLink?.href}`,
    );
    check(
      `${UNLINKED_AUTHORITY} appears in the chain text`,
      await page.evaluate(
        (n) => document.body.innerText.includes(n),
        UNLINKED_AUTHORITY,
      ),
    );
    check(
      `${UNLINKED_AUTHORITY} is not an anchor anywhere on the page`,
      !s1.allAnchorTexts.includes(UNLINKED_AUTHORITY),
    );

    console.log(
      `Scenario 2: clicking ${LINKED_AUTHORITY} opens its Index entry`,
    );
    check(
      `${LINKED_AUTHORITY} link found and clicked`,
      await clickChainLink(AUTHORITY_TITLE, LINKED_AUTHORITY),
    );
    await checkIndexEntry(LINKED_AUTHORITY);

    console.log(
      `Scenario 3: /section/${WORK_SECTION} chain leaves ${WORK_UNLINKED_AUTHORITY} plain, links ${LINKED_WORK}`,
    );
    await openClaimsPanel(WORK_SECTION, WORK_UNLINKED_AUTHORITY);
    const s3 = await chainAnchors(AUTHORITY_TITLE, WORK_TITLE);
    check(
      `${WORK_UNLINKED_AUTHORITY} is not an authority link`,
      !s3.authorityLinks.some((l) => l.text === WORK_UNLINKED_AUTHORITY),
      `authorityLinks=${JSON.stringify(s3.authorityLinks)}`,
    );
    check(
      `${WORK_UNLINKED_AUTHORITY} is not an anchor anywhere on the page`,
      !s3.allAnchorTexts.includes(WORK_UNLINKED_AUTHORITY),
    );
    const workLink = s3.workLinks.find((l) => l.text === LINKED_WORK);
    check(
      `${LINKED_WORK} is a work link in the chain`,
      !!workLink,
      `workLinks=${JSON.stringify(s3.workLinks)}`,
    );
    check(
      `${LINKED_WORK} link points into the Index`,
      !!workLink &&
        workLink.href.startsWith("/entities?entity=") &&
        decodeURIComponent(workLink.href)
          .toLowerCase()
          .includes("on-heraclitus"),
      `href=${workLink?.href}`,
    );

    console.log(`Scenario 4: clicking ${LINKED_WORK} opens its Index entry`);
    check(
      `${LINKED_WORK} link found and clicked`,
      await clickChainLink(WORK_TITLE, LINKED_WORK),
    );
    await checkIndexEntry(LINKED_WORK);

    // Snapshot the "according to ..." attribution line that names the
    // given authority: its full text, whether any anchor sits inside the
    // line, and any work links (identified by the work title attribute)
    // inside it.
    const attributionLine = (authority: string) =>
      page.evaluate(
        ([name, workTitle, authorityTitle]) => {
          const line = Array.from(document.querySelectorAll("span")).find(
            (s) => {
              const t = (s.textContent ?? "").trim();
              return (
                t.startsWith("according to") &&
                t.includes(name) &&
                // Take the whole line span, not a nested child.
                !(s.parentElement?.textContent ?? "")
                  .trim()
                  .startsWith("according to")
              );
            },
          );
          if (!line) return null;
          const anchors = Array.from(line.querySelectorAll("a"));
          return {
            text: (line.textContent ?? "").trim(),
            anchorTexts: anchors.map((a) => (a.textContent ?? "").trim()),
            workLinks: anchors
              .filter((a) => a.getAttribute("title") === workTitle)
              .map((a) => ({
                text: (a.textContent ?? "").trim(),
                href: a.getAttribute("href") ?? "",
              })),
            authorityLinks: anchors
              .filter((a) => a.getAttribute("title") === authorityTitle)
              .map((a) => ({
                text: (a.textContent ?? "").trim(),
                href: a.getAttribute("href") ?? "",
              })),
          };
        },
        [authority, WORK_TITLE, AUTHORITY_TITLE] as const,
      );

    console.log(
      `Scenario 5: /section/${LINKED_SECTION} attribution links ${ATTRIBUTION_AUTHORITY} with no work segment`,
    );
    await openClaimsPanel(LINKED_SECTION, ATTRIBUTION_AUTHORITY);
    const s5 = await attributionLine(ATTRIBUTION_AUTHORITY);
    check(
      `"according to ${ATTRIBUTION_AUTHORITY}" line rendered`,
      !!s5,
      "no attribution line found",
    );
    const s5AuthorityLink = s5?.authorityLinks.find(
      (l) => l.text === ATTRIBUTION_AUTHORITY,
    );
    check(
      `${ATTRIBUTION_AUTHORITY} is an authority link in the attribution line`,
      !!s5AuthorityLink,
      `authorityLinks=${JSON.stringify(s5?.authorityLinks)}`,
    );
    check(
      `${ATTRIBUTION_AUTHORITY} link points into the Index`,
      !!s5AuthorityLink &&
        s5AuthorityLink.href.startsWith("/entities?entity=") &&
        decodeURIComponent(s5AuthorityLink.href)
          .toLowerCase()
          .includes(ATTRIBUTION_AUTHORITY.toLowerCase()),
      `href=${s5AuthorityLink?.href}`,
    );
    check(
      `${ATTRIBUTION_AUTHORITY} attribution carries no "asserted in" work segment`,
      !!s5 && !s5.text.includes("asserted in"),
      `text=${JSON.stringify(s5?.text)}`,
    );

    console.log(
      `Scenario 6: /section/${ATTR_WORK_SECTION} attribution leaves ${ATTR_WORK_AUTHORITY} plain, links ${ATTR_LINKED_WORK}`,
    );
    await openClaimsPanel(ATTR_WORK_SECTION, ATTR_WORK_AUTHORITY);
    const s6 = await attributionLine(ATTR_WORK_AUTHORITY);
    check(
      `"according to ${ATTR_WORK_AUTHORITY}, asserted in ${ATTR_LINKED_WORK}" line rendered`,
      !!s6 &&
        s6.text.includes(`according to ${ATTR_WORK_AUTHORITY}`) &&
        s6.text.includes(`asserted in ${ATTR_LINKED_WORK}`),
      `text=${JSON.stringify(s6?.text)}`,
    );
    check(
      `${ATTR_WORK_AUTHORITY} is not an anchor inside the attribution line`,
      !!s6 && !s6.anchorTexts.includes(ATTR_WORK_AUTHORITY),
      `anchors=${JSON.stringify(s6?.anchorTexts)}`,
    );
    const attrWorkLink = s6?.workLinks.find((l) => l.text === ATTR_LINKED_WORK);
    check(
      `${ATTR_LINKED_WORK} is a work link in the attribution line`,
      !!attrWorkLink,
      `workLinks=${JSON.stringify(s6?.workLinks)}`,
    );
    check(
      `${ATTR_LINKED_WORK} link points into the Index`,
      !!attrWorkLink &&
        attrWorkLink.href.startsWith("/entities?entity=") &&
        decodeURIComponent(attrWorkLink.href)
          .toLowerCase()
          .includes(ATTR_LINKED_WORK.toLowerCase()),
      `href=${attrWorkLink?.href}`,
    );

    console.log(
      `Scenario 7: clicking ${ATTR_LINKED_WORK} opens its Index entry`,
    );
    check(
      `${ATTR_LINKED_WORK} link found and clicked`,
      await clickChainLink(WORK_TITLE, ATTR_LINKED_WORK),
    );
    await checkIndexEntry(ATTR_LINKED_WORK);

    console.log(
      `Scenario 8: /section/${ATTR_LINK_SECTION} attribution links ${ATTR_LINKED_AUTHORITY}, leaves ${ATTR_UNLINKED_AUTHORITY} plain`,
    );
    await openClaimsPanel(ATTR_LINK_SECTION, ATTR_LINKED_AUTHORITY);
    const s8 = await attributionLine(ATTR_LINKED_AUTHORITY);
    check(
      `"according to ${ATTR_LINKED_AUTHORITY}" line rendered`,
      !!s8,
      "no attribution line found",
    );
    const attrAuthorityLink = s8?.authorityLinks.find(
      (l) => l.text === ATTR_LINKED_AUTHORITY,
    );
    check(
      `${ATTR_LINKED_AUTHORITY} is an authority link in the attribution line`,
      !!attrAuthorityLink,
      `authorityLinks=${JSON.stringify(s8?.authorityLinks)}`,
    );
    check(
      `${ATTR_LINKED_AUTHORITY} link points into the Index`,
      !!attrAuthorityLink &&
        attrAuthorityLink.href.startsWith("/entities?entity=") &&
        decodeURIComponent(attrAuthorityLink.href)
          .toLowerCase()
          .includes(ATTR_LINKED_AUTHORITY.toLowerCase()),
      `href=${attrAuthorityLink?.href}`,
    );
    const s8Plain = await attributionLine(ATTR_UNLINKED_AUTHORITY);
    check(
      `"according to ${ATTR_UNLINKED_AUTHORITY}" line rendered on the same panel`,
      !!s8Plain,
      "no attribution line found",
    );
    check(
      `${ATTR_UNLINKED_AUTHORITY} attribution line has no anchor inside it`,
      !!s8Plain && s8Plain.anchorTexts.length === 0,
      `anchors=${JSON.stringify(s8Plain?.anchorTexts)}`,
    );

    console.log(
      `Scenario 9: clicking ${ATTR_LINKED_AUTHORITY} opens its populated Index entry`,
    );
    check(
      `${ATTR_LINKED_AUTHORITY} link found and clicked`,
      await clickChainLink(AUTHORITY_TITLE, ATTR_LINKED_AUTHORITY),
    );
    await checkIndexEntry(ATTR_LINKED_AUTHORITY);
  } finally {
    await browser.close();
  }

  if (failures > 0) {
    console.error(`\ne2e-chain-links: ${failures} check(s) FAILED`);
    process.exit(1);
  }
  console.log("\ne2e-chain-links: all checks passed");
}

main().catch((err) => {
  console.error("e2e-chain-links crashed:", err);
  process.exit(1);
});
