/// <reference lib="dom" />
// The in-page callbacks (page.evaluate / waitForFunction) run in the
// browser, so this Node-side script needs the DOM lib for their types.
//
// Real-browser check of the /competency ?focus= guard: the source-level
// validate-competency-focus pins the resolveCompetencyFocus predicate and
// the page wiring, but a wouter or React Query behavior change could break
// the live flow while those pins stay green. This script drives headless
// Chromium against the running dev servers:
//
// 1. Loading /competency?q=stoa-members&focus=Nobody must show the
//    dismissible "not in this question's subgraph" notice and must NOT
//    open a "Passages naming" panel.
// 2. Clicking Dismiss must remove focus= from the URL (q= survives) and
//    hide the notice.
// 3. Loading a valid focus (Cleanthes on stoa-members) must open the
//    "Passages naming Cleanthes" panel and show no notice.
// 4. Clicking a subgraph node (fresh load, no focus) must open its
//    "Passages naming" panel and set focus= in the URL.
// 5. Clicking the same node again must close the panel and drop focus=.
// 6. Re-opening via node click and then clicking the panel's close (X)
//    button must also close the panel and drop focus=.
// 7. The panel's outbound links must be sound: "View in graph" carries
//    ?p={name}, "Open in Index" carries ?entity=, and clicking a passage
//    link must land on /section/{id} with that section actually rendered.
// 8. Clicking "View in graph" must land on /graph with the focused
//    philosopher actually selected: ?p= in the URL, the side panel
//    heading naming them, and their node ring highlighted in the SVG.
// 9. Clicking "Open in Index" must land on /entities with the matching
//    entity entry open: ?entity= in the URL, the detail heading naming
//    the philosopher, and the occurrence summary rendered.
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
import {
  CARD_HEADING_SELECTOR,
  PAGE_HEADING_SELECTOR,
} from "./lib/card-headings";

const { chromium } = await import("playwright-core");
const { attachPageGuard } = await import("./lib/e2e-page-guard");

const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:80";

const QUESTION_ID = "stoa-members";
const BAD_FOCUS = "Nobody";
const GOOD_FOCUS = "Cleanthes";

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
    // timeout when the site itself fails to boot.
    const guard = attachPageGuard(page);

    // The notice and the panel are identified by their visible text, not
    // markup classes, so a styling refactor cannot silently blind the check.
    const noticeText = "is not in this question's subgraph";
    const panelHeading = "Passages naming";

    // Snapshot the page's relevant state in one evaluate call. No helper
    // functions inside evaluate: tsx's esbuild transform wraps named locals
    // with a __name helper that doesn't exist in the page.
    const snapshot = () =>
      page.evaluate(
        ([notice, heading, cardHeadingSel]) => {
          const bodyText = document.body.innerText;
          const headings = Array.from(document.querySelectorAll(cardHeadingSel)).map(
            (h) => h.textContent ?? "",
          );
          const params = new URLSearchParams(window.location.search);
          return {
            noticeVisible: bodyText.includes(notice),
            panelHeadings: headings.filter((t) => t.includes(heading)),
            q: params.get("q"),
            focus: params.get("focus"),
            pathname: window.location.pathname,
          };
        },
        [noticeText, panelHeading, CARD_HEADING_SELECTOR] as const,
      );

    console.log(
      `Scenario 1: invalid focus (${BAD_FOCUS}) shows the notice, no panel`,
    );
    await page.goto(
      `${BASE_URL}/competency?q=${QUESTION_ID}&focus=${BAD_FOCUS}`,
      { waitUntil: "networkidle" },
    );
    guard.assertPageLoaded();
    // Wait until the question result has rendered (the subgraph SVG) so the
    // predicate has real node names to check against, not the loading state.
    await guard.guarded(
      page.waitForSelector('svg[aria-label="Knowledge subgraph"]', {
        timeout: 30000,
      }),
    );
    // The notice renders synchronously with the result; give React a paint.
    await page.waitForTimeout(300);

    const bad = await snapshot();
    check("notice is visible", bad.noticeVisible);
    check(
      `notice names the bad focus value`,
      await page.evaluate(
        (name) => document.body.innerText.includes(`"${name}"`),
        BAD_FOCUS,
      ),
    );
    check(
      "no 'Passages naming' panel is open",
      bad.panelHeadings.length === 0,
      `headings=${JSON.stringify(bad.panelHeadings)}`,
    );
    check("q= is preserved", bad.q === QUESTION_ID, `q=${bad.q}`);
    check("focus= still in URL before dismiss", bad.focus === BAD_FOCUS);

    console.log("Scenario 2: dismissing the notice cleans the URL");
    // The Dismiss button is the notice's only button with that label.
    const dismissed = await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll("button")).find(
        (b) => b.textContent?.trim() === "Dismiss",
      );
      if (!btn) return false;
      btn.click();
      return true;
    });
    check("Dismiss button found and clicked", dismissed);
    await page.waitForFunction(
      () => new URLSearchParams(window.location.search).get("focus") === null,
      undefined,
      { timeout: 5000 },
    );
    await page.waitForTimeout(300);

    const afterDismiss = await snapshot();
    check("focus= removed from the URL", afterDismiss.focus === null);
    check(
      "q= survives the dismiss",
      afterDismiss.q === QUESTION_ID,
      `q=${afterDismiss.q}`,
    );
    check("notice is gone", !afterDismiss.noticeVisible);
    check(
      "still no panel after dismiss",
      afterDismiss.panelHeadings.length === 0,
    );
    check("still on /competency", afterDismiss.pathname === "/competency");

    console.log(
      `Scenario 3: valid focus (${GOOD_FOCUS}) opens the panel, no notice`,
    );
    await page.goto(
      `${BASE_URL}/competency?q=${QUESTION_ID}&focus=${GOOD_FOCUS}`,
      { waitUntil: "networkidle" },
    );
    guard.assertPageLoaded();
    await guard.guarded(
      page.waitForSelector('svg[aria-label="Knowledge subgraph"]', {
        timeout: 30000,
      }),
    );
    // The panel heading appears as soon as the focus resolves; the passage
    // list inside loads asynchronously afterwards.
    await page.waitForFunction(
      ([name, cardHeadingSel]) =>
        Array.from(document.querySelectorAll(cardHeadingSel)).some((h) =>
          (h.textContent ?? "").includes(`Passages naming ${name}`),
        ),
      [GOOD_FOCUS, CARD_HEADING_SELECTOR] as const,
      { timeout: 10000 },
    );
    await page.waitForTimeout(300);

    const good = await snapshot();
    check(
      `panel 'Passages naming ${GOOD_FOCUS}' is open`,
      good.panelHeadings.some((t) => t.includes(GOOD_FOCUS)),
      `headings=${JSON.stringify(good.panelHeadings)}`,
    );
    check("no notice for a valid focus", !good.noticeVisible);
    check("q= is preserved", good.q === QUESTION_ID, `q=${good.q}`);
    check("focus= is preserved", good.focus === GOOD_FOCUS);
    // The focused node also gets a highlight ring in the subgraph SVG.
    check(
      "focused node label is bolded in the subgraph",
      await page.evaluate(
        (name) =>
          Array.from(
            document.querySelectorAll(
              'svg[aria-label="Knowledge subgraph"] text',
            ),
          ).some(
            (t) =>
              t.textContent === name &&
              (t.getAttribute("font-weight") ?? "") === "600",
          ),
        GOOD_FOCUS,
      ),
    );

    // Each subgraph node is a <g role="button"> with an aria-label of
    // "Show source passages for {name}"; clicking it toggles focus. React's
    // onClick listens for the bubbling click event, so dispatching a
    // MouseEvent with bubbles:true on the <g> is equivalent to a user click
    // (and avoids Playwright's scroll-into-view coordinate games on SVG).
    const clickNode = (name: string) =>
      page.evaluate((n) => {
        const g = document.querySelector(
          `svg[aria-label="Knowledge subgraph"] [aria-label="Show source passages for ${n}"]`,
        );
        if (!g) return false;
        g.dispatchEvent(
          new MouseEvent("click", { bubbles: true, cancelable: true }),
        );
        return true;
      }, name);

    console.log(
      `Scenario 4: clicking the ${GOOD_FOCUS} node opens the panel and sets focus=`,
    );
    await page.goto(`${BASE_URL}/competency?q=${QUESTION_ID}`, {
      waitUntil: "networkidle",
    });
    guard.assertPageLoaded();
    await guard.guarded(
      page.waitForSelector('svg[aria-label="Knowledge subgraph"]', {
        timeout: 30000,
      }),
    );
    const preClick = await snapshot();
    check("no panel before the click", preClick.panelHeadings.length === 0);
    check("no focus= before the click", preClick.focus === null);

    check(`node ${GOOD_FOCUS} found and clicked`, await clickNode(GOOD_FOCUS));
    await page.waitForFunction(
      ([name, cardHeadingSel]) =>
        Array.from(document.querySelectorAll(cardHeadingSel)).some((h) =>
          (h.textContent ?? "").includes(`Passages naming ${name}`),
        ),
      [GOOD_FOCUS, CARD_HEADING_SELECTOR] as const,
      { timeout: 10000 },
    );
    await page.waitForTimeout(300);

    const afterClick = await snapshot();
    check(
      `panel 'Passages naming ${GOOD_FOCUS}' opened by the click`,
      afterClick.panelHeadings.some((t) => t.includes(GOOD_FOCUS)),
      `headings=${JSON.stringify(afterClick.panelHeadings)}`,
    );
    check(
      "focus= set in the URL by the click",
      afterClick.focus === GOOD_FOCUS,
      `focus=${afterClick.focus}`,
    );
    check("q= preserved after the click", afterClick.q === QUESTION_ID);

    console.log(
      "Scenario 5: clicking the same node again closes the panel and drops focus=",
    );
    check(
      `node ${GOOD_FOCUS} clicked a second time`,
      await clickNode(GOOD_FOCUS),
    );
    await page.waitForFunction(
      () => new URLSearchParams(window.location.search).get("focus") === null,
      undefined,
      { timeout: 5000 },
    );
    await page.waitForTimeout(300);

    const afterToggle = await snapshot();
    check("panel closed by the second click", afterToggle.panelHeadings.length === 0);
    check("focus= removed by the second click", afterToggle.focus === null);
    check("q= survives the toggle", afterToggle.q === QUESTION_ID);

    console.log(
      "Scenario 6: the panel's close (X) button also closes and drops focus=",
    );
    check(`node ${GOOD_FOCUS} clicked to re-open`, await clickNode(GOOD_FOCUS));
    await page.waitForFunction(
      ([name, cardHeadingSel]) =>
        Array.from(document.querySelectorAll(cardHeadingSel)).some((h) =>
          (h.textContent ?? "").includes(`Passages naming ${name}`),
        ),
      [GOOD_FOCUS, CARD_HEADING_SELECTOR] as const,
      { timeout: 10000 },
    );
    const closeClicked = await page.evaluate(() => {
      const btn = document.querySelector<HTMLButtonElement>(
        'button[aria-label="Close passage panel"]',
      );
      if (!btn) return false;
      btn.click();
      return true;
    });
    check("close button found and clicked", closeClicked);
    await page.waitForFunction(
      () => new URLSearchParams(window.location.search).get("focus") === null,
      undefined,
      { timeout: 5000 },
    );
    await page.waitForTimeout(300);

    const afterClose = await snapshot();
    check("panel closed by the X button", afterClose.panelHeadings.length === 0);
    check("focus= removed by the X button", afterClose.focus === null);
    check("q= survives the close", afterClose.q === QUESTION_ID);
    check("still on /competency", afterClose.pathname === "/competency");

    console.log(
      "Scenario 7: panel outbound links are sound and a passage click lands on the section",
    );
    await page.goto(
      `${BASE_URL}/competency?q=${QUESTION_ID}&focus=${GOOD_FOCUS}`,
      { waitUntil: "networkidle" },
    );
    guard.assertPageLoaded();
    await guard.guarded(
      page.waitForSelector('svg[aria-label="Knowledge subgraph"]', {
        timeout: 30000,
      }),
    );
    await page.waitForFunction(
      ([name, cardHeadingSel]) =>
        Array.from(document.querySelectorAll(cardHeadingSel)).some((h) =>
          (h.textContent ?? "").includes(`Passages naming ${name}`),
        ),
      [GOOD_FOCUS, CARD_HEADING_SELECTOR] as const,
      { timeout: 10000 },
    );
    // The passage list loads asynchronously after the heading; wait for at
    // least one /section/ link inside the panel.
    await page.waitForFunction(
      () =>
        Array.from(document.querySelectorAll("a")).some((a) =>
          (a.getAttribute("href") ?? "").startsWith("/section/"),
        ),
      undefined,
      { timeout: 15000 },
    );
    await page.waitForTimeout(300);

    // Scope everything to the panel itself: walk up from the "Passages
    // naming" heading to the nearest ancestor that contains the "View in
    // graph" link, so other /section/ links elsewhere on the page can
    // never be picked up by mistake.
    const links = await page.evaluate(([focusName, cardHeadingSel]) => {
      const h3 = Array.from(document.querySelectorAll(cardHeadingSel)).find((h) =>
        (h.textContent ?? "").includes(`Passages naming ${focusName}`),
      );
      if (!h3) return null;
      let panel: HTMLElement | null = h3.parentElement;
      while (panel) {
        const as = Array.from(panel.querySelectorAll("a"));
        const hasGraph = as.some((a) =>
          (a.textContent ?? "").includes("View in graph"),
        );
        const hasSection = as.some((a) =>
          (a.getAttribute("href") ?? "").startsWith("/section/"),
        );
        if (hasGraph && hasSection) break;
        panel = panel.parentElement;
      }
      if (!panel) return null;
      const anchors = Array.from(panel.querySelectorAll("a"));
      const graph =
        anchors.find((a) =>
          (a.textContent ?? "").includes("View in graph"),
        ) ?? null;
      const index =
        anchors.find((a) =>
          (a.textContent ?? "").includes("Open in Index"),
        ) ?? null;
      const passage = anchors.find((a) =>
        (a.getAttribute("href") ?? "").startsWith("/section/"),
      );
      const passageHref = passage?.getAttribute("href") ?? null;
      return {
        graphHref: graph?.getAttribute("href") ?? null,
        indexHref: index?.getAttribute("href") ?? null,
        passageHref,
        passageId: passageHref
          ? decodeURIComponent(passageHref.slice("/section/".length))
          : null,
      };
    }, [GOOD_FOCUS, CARD_HEADING_SELECTOR] as const);
    check("panel container located for link checks", links !== null);
    if (!links) throw new Error("panel container not found in Scenario 7");
    check(
      `"View in graph" carries ?p=${GOOD_FOCUS}`,
      links.graphHref === `/graph?p=${encodeURIComponent(GOOD_FOCUS)}`,
      `href=${links.graphHref}`,
    );
    // The ?entity= value must not just exist, it must identify the focused
    // philosopher: entity URIs end in a slug of the label, so the decoded
    // URI must contain the lowercased focus name.
    const indexEntity = links.indexHref?.startsWith("/entities?entity=")
      ? decodeURIComponent(
          new URLSearchParams(links.indexHref.split("?")[1] ?? "").get(
            "entity",
          ) ?? "",
        )
      : "";
    check(
      `"Open in Index" carries an ?entity= identifying ${GOOD_FOCUS}`,
      indexEntity.toLowerCase().includes(GOOD_FOCUS.toLowerCase()),
      `href=${links.indexHref}`,
    );
    check(
      "a passage link into /section/ is present",
      !!links.passageHref && !!links.passageId,
      `href=${links.passageHref}`,
    );
    check(
      "passage id looks like book.chapter.section",
      !!links.passageId && /^\d+\.[^.]+\.\d+$/.test(links.passageId),
      `id=${links.passageId}`,
    );

    if (links.passageHref && links.passageId) {
      // Click the passage link via the bubbling MouseEvent (wouter handles
      // the client-side navigation) and assert the section page renders.
      const passageClicked = await page.evaluate((href) => {
        const a = Array.from(document.querySelectorAll("a")).find(
          (el) => el.getAttribute("href") === href,
        );
        if (!a) return false;
        a.dispatchEvent(
          new MouseEvent("click", { bubbles: true, cancelable: true }),
        );
        return true;
      }, links.passageHref);
      check("passage link found and clicked", passageClicked);
      await page.waitForFunction(
        (id) => window.location.pathname === `/section/${id}`,
        links.passageId,
        { timeout: 10000 },
      );
      const sectionPath = await page.evaluate(() => window.location.pathname);
      check(
        `URL is /section/${links.passageId}`,
        sectionPath === `/section/${links.passageId}`,
        `pathname=${sectionPath}`,
      );
      // The section page must actually render the requested section id in
      // its content, not just change the URL.
      const sectionRendered = await page
        .waitForFunction(
          (id) => document.body.innerText.includes(id),
          links.passageId,
          { timeout: 15000 },
        )
        .then(
          () => true,
          () => false,
        );
      check(
        `section page renders section id ${links.passageId}`,
        sectionRendered,
      );
      check(
        "section page shows no not-found error",
        await page.evaluate(
          () => !document.body.innerText.toLowerCase().includes("not found"),
        ),
      );
    }

    // Reload the competency panel fresh for each outbound-link scenario so
    // one navigation can't taint the next.
    const openPanel = async () => {
      await page.goto(
        `${BASE_URL}/competency?q=${QUESTION_ID}&focus=${GOOD_FOCUS}`,
        { waitUntil: "networkidle" },
      );
      guard.assertPageLoaded();
      await guard.guarded(
        page.waitForSelector('svg[aria-label="Knowledge subgraph"]', {
          timeout: 30000,
        }),
      );
      await page.waitForFunction(
        ([name, cardHeadingSel]) =>
          Array.from(document.querySelectorAll(cardHeadingSel)).some((h) =>
            (h.textContent ?? "").includes(`Passages naming ${name}`),
          ),
        [GOOD_FOCUS, CARD_HEADING_SELECTOR] as const,
        { timeout: 10000 },
      );
      await page.waitForTimeout(300);
    };

    // Click a panel link by its visible text via a bubbling MouseEvent
    // (wouter handles the client-side navigation).
    const clickPanelLink = (text: string) =>
      page.evaluate((t) => {
        const a = Array.from(document.querySelectorAll("a")).find((el) =>
          (el.textContent ?? "").includes(t),
        );
        if (!a) return false;
        a.dispatchEvent(
          new MouseEvent("click", { bubbles: true, cancelable: true }),
        );
        return true;
      }, text);

    console.log(
      `Scenario 8: "View in graph" opens /graph with ${GOOD_FOCUS} selected`,
    );
    await openPanel();
    check(
      '"View in graph" link found and clicked',
      await clickPanelLink("View in graph"),
    );
    await page.waitForFunction(
      () => window.location.pathname === "/graph",
      undefined,
      { timeout: 10000 },
    );
    // The side panel renders the selected philosopher's name as an <h2>
    // once the graph data has loaded.
    const graphPanelShown = await page
      .waitForFunction(
        ([name, sel]) =>
          Array.from(document.querySelectorAll(sel)).some(
            (h) => (h.textContent ?? "").trim() === name,
          ),
        [GOOD_FOCUS, PAGE_HEADING_SELECTOR] as const,
        { timeout: 15000 },
      )
      .then(
        () => true,
        () => false,
      );
    check(
      `graph side panel heading names ${GOOD_FOCUS}`,
      graphPanelShown,
    );
    const graphState = await page.evaluate((name) => {
      const params = new URLSearchParams(window.location.search);
      // The selected node's circle gets the currentColor ring at
      // strokeWidth 2.5; find the circle inside the <g> whose sibling
      // <text> label matches the name.
      const groups = Array.from(
        document.querySelectorAll("svg g"),
      ) as SVGGElement[];
      let ringed = false;
      for (const g of groups) {
        const label = g.querySelector("text");
        const circle = g.querySelector("circle");
        if (
          label?.textContent === name &&
          circle &&
          parseFloat(circle.getAttribute("stroke-width") ?? "0") > 2
        ) {
          ringed = true;
          break;
        }
      }
      return { p: params.get("p"), ringed, bodyText: document.body.innerText };
    }, GOOD_FOCUS);
    check(
      `?p=${GOOD_FOCUS} in the /graph URL`,
      graphState.p === GOOD_FOCUS,
      `p=${graphState.p}`,
    );
    check(
      "selected node ring is highlighted in the graph SVG",
      graphState.ringed,
    );
    check(
      "graph side panel lists cited relations or details",
      graphState.bodyText.includes("Book "),
    );

    console.log(
      `Scenario 9: "Open in Index" opens /entities with the ${GOOD_FOCUS} entry`,
    );
    await openPanel();
    check(
      '"Open in Index" link found and clicked',
      await clickPanelLink("Open in Index"),
    );
    await page.waitForFunction(
      () => window.location.pathname === "/entities",
      undefined,
      { timeout: 10000 },
    );
    // The entity detail heading is an <h2> with the entity label; the
    // occurrence summary renders alongside once the detail has loaded.
    const indexDetailShown = await page
      .waitForFunction(
        ([name, sel]) =>
          Array.from(document.querySelectorAll(sel)).some((h) =>
            (h.textContent ?? "").toLowerCase().includes(name.toLowerCase()),
          ),
        [GOOD_FOCUS, PAGE_HEADING_SELECTOR] as const,
        { timeout: 15000 },
      )
      .then(
        () => true,
        () => false,
      );
    check(
      `index detail heading names ${GOOD_FOCUS}`,
      indexDetailShown,
    );
    const indexState = await page.evaluate(() => {
      const params = new URLSearchParams(window.location.search);
      return {
        entity: params.get("entity"),
        hasOccurrences: /\d+ occurrences? in \d+ sections?/.test(
          document.body.innerText,
        ),
      };
    });
    check(
      `?entity= in the /entities URL identifies ${GOOD_FOCUS}`,
      !!indexState.entity &&
        decodeURIComponent(indexState.entity)
          .toLowerCase()
          .includes(GOOD_FOCUS.toLowerCase()),
      `entity=${indexState.entity}`,
    );
    check(
      "entity detail shows the occurrence summary",
      indexState.hasOccurrences,
    );
  } finally {
    await browser.close();
  }

  if (failures > 0) {
    console.error(`\ne2e-competency-focus: ${failures} check(s) FAILED`);
    process.exit(1);
  }
  console.log("\ne2e-competency-focus: all checks passed");
}

main().catch((err) => {
  console.error("e2e-competency-focus crashed:", err);
  process.exit(1);
});
