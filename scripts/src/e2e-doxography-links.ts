/// <reference lib="dom" />
// The in-page callbacks (page.evaluate / waitForFunction) run in the
// browser, so this Node-side script needs the DOM lib for their types.
//
// Real-browser check of the Doxography page's passage links on the
// clash-prone Hicks refs. The source-level doxai validator pins
// doxaSectionIdFor's owner-aware resolution (ambiguousDoxaPins in
// validate-doxai.ts), but no live check confirmed the /doxography page's
// "Read in context" links actually land readers on the right rendered
// section. Refs 7.160 and 7.166 are ambiguous: Hicks numbering restarts
// per chapter in Book 7, so 7.160 exists in both Zeno's chapter (7.1.160)
// and Ariston of Chios' own chapter (7.2.160), and 7.166 in both Herillus'
// (7.3.166) and Dionysius the Renegade's own (7.4.166). A first-match
// fallback would send readers to the wrong philosopher's Life.
//
// Scenarios (each starts from a fresh /doxography load, no filters):
// 1. The Ariston of Chios card on D.L. 7.160 exists, its "Read in
//    context" link points at /section/7.2.160 (not Zeno's 7.1.160), and
//    clicking it renders the 7.2.160 section page.
// 2. The Dionysius the Renegade card on D.L. 7.166 exists, its link
//    points at /section/7.4.166 (not Herillus' 7.3.166), and clicking it
//    renders the 7.4.166 section page.
// 3. The filter dropdowns cannot hide the dissenters: selecting
//    "Ariston of Chios" from the philosopher dropdown shows exactly his
//    doxai (count derived from the API at runtime, and the URL gains
//    ?philosopher=... so the view is shareable), then after resetting to
//    all philosophers, selecting the
//    "pleasure" domain shows Dionysius the Renegade's D.L. 7.166 entry
//    (and the URL gains ?domain=pleasure).
// 4. A shared filter link reopens the same view: /doxography with both
//    ?philosopher= and ?domain= opened cold must seed both dropdown
//    triggers and filter the list to the intersection.
// 5. A bogus ?philosopher= in a shared link falls back gracefully: full
//    list, trigger back on "All philosophers", dead param dropped.
// 6. Domain badges refilter in place: with the page already mounted, a
//    reload sentinel is planted on window, a card's domain badge is
//    clicked, and the list must refilter to that domain (URL gains
//    ?domain=, every rendered card's badge shows that domain, sentinel
//    intact so no full reload happened); after resetting to all domains
//    via the dropdown (still no reload), clicking a second badge for a
//    different domain must switch the filter again, still in place.
// 7. A shared ?q=&book= link reopens the same view: /doxography?q=virtue
//    &book=7 opened cold must prefill the search box, show "Book 7" on
//    the book trigger, and filter the list to the intersection.
// 8. A non-numeric ?book= (e.g. "vii") hits the numeric guard and resets
//    gracefully: full list, book trigger on "All", dead param dropped.
// 9. A domain badge click from a philosopher-filtered view keeps both
//    filters honest: with ?philosopher= already set, clicking a domain
//    badge on one of that philosopher's cards (the badge links to
//    /doxography?domain=X with no philosopher param) must DROP the
//    philosopher filter — URL loses ?philosopher= and gains ?domain=,
//    the philosopher trigger resets to "All philosophers", the list
//    shows ALL doxai of that domain (other philosophers included), and
//    there is no "No doxai match" dead end from a stale intersection.
// 10. Typing a keyword into the debounced search box writes ?q= (list
//    refiltered), picking a book from the dropdown writes ?book= (only
//    that book's refs), and clearing both restores bare /doxography.
// 11. A domain badge click clears a stale ?q= and ?book= too: with
//    q=virtue and Book 7 active, clicking a domain badge must drop both
//    (URL carries only ?domain=, search box empties, book trigger back
//    on "All") and widen the list to all doxai of that domain.
// 8. The same, when the badge's domain is ALREADY the selected domain:
//    with ?philosopher= and ?domain= both set, clicking a badge for that
//    same domain must still drop the philosopher filter (the reconcile
//    cannot be gated on the domain changing) and widen the list to all
//    doxai of the domain.
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
import { CARD_HEADING_SELECTOR } from "./lib/card-headings";

const { chromium } = await import("playwright-core");
const { attachPageGuard } = await import("./lib/e2e-page-guard");

const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:80";

// ---------------------------------------------------------------------------
// Expected counts, derived at RUNTIME from the API so a curator adding or
// rewording a doxa never breaks this script with a misleading stale pin.
// The page issues the exact same filtered GET /api/doxai requests (see
// doxography.tsx -> useListDoxai(params)), so "page count === API count for
// the same filter" is precisely the contract worth checking: the checks stay
// exact-count strict, but the numbers move with the corpus automatically.
// Sanity guards below fail loudly if the API ever returns something vacuous
// (empty list, non-narrowing filters), so this can't degrade silently.
// ---------------------------------------------------------------------------
type ApiDoxa = {
  ref: string;
  philosopher: string;
  domain: string;
  book: number;
};

async function fetchDoxai(params?: string): Promise<ApiDoxa[]> {
  const url = `${BASE_URL}/api/doxai${params ? `?${params}` : ""}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`GET ${url} failed with HTTP ${res.status}`);
  }
  const data: unknown = await res.json();
  if (!Array.isArray(data)) {
    throw new Error(`GET ${url} did not return an array`);
  }
  return data as ApiDoxa[];
}

// Filters the scenarios exercise. Values are filled in by loadExpected().
const EXPECTED = {
  /** Unfiltered corpus size (the "N doxai" full-list count line). */
  all: 0,
  /** q=virtue keyword search. */
  virtue: 0,
  /** q=virtue&book=7 intersection. */
  virtueBook7: 0,
  /** philosopher=Ariston of Chios. */
  ariston: 0,
  /** philosopher=Ariston of Chios&domain=ethics. */
  aristonEthics: 0,
  /** All doxai in the ethics domain (same-domain badge widen target). */
  ethics: 0,
  /** Ariston's doxai on the clash-prone D.L. 7.160 ref. */
  ariston7160: 0,
  /** Ariston's ETHICS doxai on D.L. 7.160 (the telos one only). */
  aristonEthics7160: 0,
};

async function loadExpected() {
  const [all, virtue, virtueBook7, ariston, aristonEthics, ethics] =
    await Promise.all([
      fetchDoxai(),
      fetchDoxai("q=virtue"),
      fetchDoxai("q=virtue&book=7"),
      fetchDoxai(`philosopher=${encodeURIComponent("Ariston of Chios")}`),
      fetchDoxai(
        `philosopher=${encodeURIComponent("Ariston of Chios")}&domain=ethics`,
      ),
      fetchDoxai("domain=ethics"),
    ]);
  EXPECTED.all = all.length;
  EXPECTED.virtue = virtue.length;
  EXPECTED.virtueBook7 = virtueBook7.length;
  EXPECTED.ariston = ariston.length;
  EXPECTED.aristonEthics = aristonEthics.length;
  EXPECTED.ethics = ethics.length;
  EXPECTED.ariston7160 = ariston.filter((d) => d.ref === "7.160").length;
  EXPECTED.aristonEthics7160 = aristonEthics.filter(
    (d) => d.ref === "7.160",
  ).length;

  // Sanity guards: the scenarios below reason about STRICT narrowing and
  // widening, so the derived counts must be non-vacuous and properly
  // ordered. If curation ever changes these invariants (e.g. Ariston loses
  // his logic doxa), fail here with a clear message instead of deep inside
  // a browser assertion.
  const sane = (label: string, ok: boolean, detail: string) => {
    if (!ok) {
      throw new Error(
        `expected-count sanity check failed: ${label} (${detail}). ` +
          "The corpus changed shape; review the scenario assumptions in " +
          "scripts/src/e2e-doxography-links.ts.",
      );
    }
  };
  sane("corpus is non-empty", EXPECTED.all > 0, `all=${EXPECTED.all}`);
  sane(
    "q=virtue narrows the list but matches something",
    EXPECTED.virtue > 0 && EXPECTED.virtue < EXPECTED.all,
    `virtue=${EXPECTED.virtue} all=${EXPECTED.all}`,
  );
  sane(
    "book=7 strictly narrows q=virtue (proves the book param participates)",
    EXPECTED.virtueBook7 > 0 && EXPECTED.virtueBook7 < EXPECTED.virtue,
    `virtueBook7=${EXPECTED.virtueBook7} virtue=${EXPECTED.virtue}`,
  );
  sane(
    "Ariston of Chios has doxai",
    EXPECTED.ariston > 0,
    `ariston=${EXPECTED.ariston}`,
  );
  sane(
    "domain=ethics strictly narrows Ariston (he keeps a non-ethics doxa)",
    EXPECTED.aristonEthics > 0 && EXPECTED.aristonEthics < EXPECTED.ariston,
    `aristonEthics=${EXPECTED.aristonEthics} ariston=${EXPECTED.ariston}`,
  );
  sane(
    "ethics has doxai beyond Ariston's (badge clicks must widen)",
    EXPECTED.ethics > EXPECTED.aristonEthics,
    `ethics=${EXPECTED.ethics} aristonEthics=${EXPECTED.aristonEthics}`,
  );
  sane(
    "Ariston has clashing doxai on D.L. 7.160, exactly one of them ethics",
    EXPECTED.ariston7160 >= 2 && EXPECTED.aristonEthics7160 === 1,
    `ariston7160=${EXPECTED.ariston7160} aristonEthics7160=${EXPECTED.aristonEthics7160}`,
  );

  console.log(
    "Expected counts derived from the API:",
    JSON.stringify(EXPECTED),
  );
}

// Wait until the page's "N doxai" count line shows exactly `n`.
const countLineSettles = (page: import("playwright-core").Page, n: number) =>
  page
    .waitForFunction(
      (want) => new RegExp(`(^|\\n)${want} doxai`).test(document.body.innerText),
      n,
      { timeout: 30000 },
    )
    .then(
      () => true,
      () => false,
    );

// The clash-prone entries and where their passage links must land. The
// wrong ids are the other chapters sharing the same bare Hicks ref; the
// script asserts we never end up there.
const CASES = [
  {
    philosopher: "Ariston of Chios",
    ref: "7.160",
    rightSection: "7.2.160",
    wrongSections: ["7.1.160"],
  },
  {
    philosopher: "Dionysius the Renegade",
    ref: "7.166",
    rightSection: "7.4.166",
    wrongSections: ["7.3.166"],
  },
] as const;

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
  await loadExpected();
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({
      viewport: { width: 1280, height: 720 },
    });
    const guard = attachPageGuard(page);

    for (const c of CASES) {
      console.log(
        `Scenario: ${c.philosopher} on D.L. ${c.ref} links to ${c.rightSection}`,
      );

      // Fresh, unfiltered load each time so one navigation can't taint the
      // next, and so we exercise the full list a reader actually sees.
      await page.goto(`${BASE_URL}/doxography`, { waitUntil: "networkidle" });
      guard.assertPageLoaded();
      // Wait until the doxa cards have rendered (the count line flips from
      // "Loading doxai..." to "N doxai" and cards appear).
      await guard.guarded(
        page.waitForFunction(
          (cardHeadingSel) =>
            /\d+ doxai/.test(document.body.innerText) &&
            Array.from(document.querySelectorAll(cardHeadingSel)).some((h) =>
              (h.textContent ?? "").startsWith("D.L. "),
            ),
          CARD_HEADING_SELECTOR,
          { timeout: 30000 },
        ),
      );
      await page.waitForTimeout(300);

      // Find the card whose header is "D.L. {ref}" AND whose philosopher
      // badge names our tenet holder; several cards can share the bare ref
      // (that is the whole point of this check). The card root is the h3's
      // enclosing rounded-border container; rather than depend on styling
      // classes, walk up from the h3 until the subtree contains both the
      // philosopher name and a /section/ link.
      const link = await page.evaluate(
        ([ref, name, cardHeadingSel]) => {
          const heads = Array.from(
            document.querySelectorAll(cardHeadingSel),
          ).filter((h) => (h.textContent ?? "").trim() === `D.L. ${ref}`);
          for (const h of heads) {
            let el: HTMLElement | null = h.parentElement;
            while (el && el !== document.body) {
              const hasName = Array.from(el.querySelectorAll("span")).some(
                (s) => (s.textContent ?? "").trim() === name,
              );
              const anchor = Array.from(el.querySelectorAll("a")).find((a) =>
                (a.getAttribute("href") ?? "").startsWith("/section/"),
              );
              if (hasName && anchor) {
                return {
                  href: anchor.getAttribute("href"),
                  text: (anchor.textContent ?? "").trim(),
                };
              }
              // Stop climbing once we leave the card: if this ancestor
              // already contains more than one D.L. heading we have gone
              // past the card boundary into the list.
              if (el.querySelectorAll(cardHeadingSel).length > 1) break;
              el = el.parentElement;
            }
          }
          return null;
        },
        [c.ref, c.philosopher, CARD_HEADING_SELECTOR] as const,
      );

      check(
        `card for ${c.philosopher} on D.L. ${c.ref} has a passage link`,
        !!link,
      );
      if (!link) continue;

      check(
        `link is the "Read in context" passage link`,
        link.text.startsWith("Read in context"),
        `text=${link.text}`,
      );
      check(
        `link points at /section/${c.rightSection}`,
        link.href === `/section/${c.rightSection}`,
        `href=${link.href}`,
      );
      for (const wrong of c.wrongSections) {
        check(
          `link does NOT point at the clashing /section/${wrong}`,
          link.href !== `/section/${wrong}`,
          `href=${link.href}`,
        );
      }

      // Click the link via a bubbling MouseEvent (wouter handles the
      // client-side navigation; this avoids Playwright's scroll-into-view
      // coordinate games) and assert the section page actually renders.
      const clicked = await page.evaluate((href) => {
        const a = Array.from(document.querySelectorAll("a")).find(
          (el) => el.getAttribute("href") === href,
        );
        if (!a) return false;
        a.dispatchEvent(
          new MouseEvent("click", { bubbles: true, cancelable: true }),
        );
        return true;
      }, link.href);
      check("passage link found and clicked", clicked);

      const navigated = await page
        .waitForFunction(
          (id) => window.location.pathname === `/section/${id}`,
          c.rightSection,
          { timeout: 10000 },
        )
        .then(
          () => true,
          () => false,
        );
      const pathname = await page.evaluate(() => window.location.pathname);
      check(
        `URL is /section/${c.rightSection}`,
        navigated,
        `pathname=${pathname}`,
      );

      // The section page must actually render the requested section id in
      // its content, not just change the URL.
      const rendered = await page
        .waitForFunction(
          (id) => document.body.innerText.includes(id),
          c.rightSection,
          { timeout: 15000 },
        )
        .then(
          () => true,
          () => false,
        );
      check(`section page renders section id ${c.rightSection}`, rendered);
      check(
        `section page names ${c.philosopher.split(" ")[0]}`,
        await page.evaluate(
          (name) => document.body.innerText.includes(name),
          c.philosopher.split(" ")[0],
        ),
      );
      check(
        "section page shows no not-found error",
        await page.evaluate(
          () => !document.body.innerText.toLowerCase().includes("not found"),
        ),
      );
    }

    // Scenario 3: the filters cannot hide the dissenters. Readers usually
    // arrive via the dropdowns, so a filter regression (philosopher
    // grouping, unknown-value fallback effects) could make the heterodox
    // Stoics unfindable while the unfiltered checks above stay green.
    console.log(
      "Scenario: philosopher and domain filters keep the dissenters findable",
    );
    await page.goto(`${BASE_URL}/doxography`, { waitUntil: "networkidle" });
    guard.assertPageLoaded();
    await guard.guarded(
      page.waitForFunction(
        (cardHeadingSel) =>
          /\d+ doxai/.test(document.body.innerText) &&
          Array.from(document.querySelectorAll(cardHeadingSel)).some((h) =>
            (h.textContent ?? "").startsWith("D.L. "),
          ),
        CARD_HEADING_SELECTOR,
        { timeout: 30000 },
      ),
    );
    await page.waitForTimeout(300);

    // Helper: pick an option from one of the Radix Select dropdowns by
    // real clicks (the trigger opens a portal listbox of role=option).
    const pickOption = async (triggerId: string, optionName: string) => {
      await page.click(`#${triggerId}`);
      const option = page.getByRole("option", { name: optionName });
      await option.waitFor({ state: "visible", timeout: 5000 });
      await option.click();
      // Wait for the listbox to close so the next interaction is clean.
      await page
        .getByRole("listbox")
        .waitFor({ state: "hidden", timeout: 5000 })
        .catch(() => {});
    };

    // Count the rendered doxa cards and collect their D.L. refs plus the
    // philosopher badges, so we can assert exactly what the filter shows.
    const readCards = () =>
      page.evaluate((cardHeadingSel) => {
        const heads = Array.from(
          document.querySelectorAll(cardHeadingSel),
        ).filter((h) => (h.textContent ?? "").trim().startsWith("D.L. "));
        return {
          count: heads.length,
          refs: heads.map((h) => (h.textContent ?? "").trim()),
          text: document.body.innerText,
        };
      }, CARD_HEADING_SELECTOR);

    // --- Philosopher filter: Ariston of Chios must show exactly his doxai
    // (count fetched from the API in loadExpected()).
    await pickOption("phil", "Ariston of Chios");
    const aristonSettled = await countLineSettles(page, EXPECTED.ariston);
    check(
      `count line settles at '${EXPECTED.ariston} doxai' (API count) for Ariston of Chios`,
      aristonSettled,
    );
    await page.waitForTimeout(300);
    const ariston = await readCards();
    check(
      `exactly ${EXPECTED.ariston} doxa cards render for Ariston of Chios (API count)`,
      ariston.count === EXPECTED.ariston,
      `count=${ariston.count} refs=${ariston.refs.join(",")}`,
    );
    for (const ref of ["D.L. 7.160", "D.L. 7.161"]) {
      check(
        `Ariston's filtered list includes a ${ref} card`,
        ariston.refs.includes(ref),
        `refs=${ariston.refs.join(",")}`,
      );
    }
    check(
      `all ${EXPECTED.ariston7160} of Ariston's D.L. 7.160 doxai render`,
      ariston.refs.filter((r) => r === "D.L. 7.160").length ===
        EXPECTED.ariston7160,
      `refs=${ariston.refs.join(",")}`,
    );
    check(
      "no other philosopher's card leaks into the filtered list",
      !ariston.text.includes("Herillus") &&
        !ariston.text.includes("Zeno of Citium"),
    );
    const aristonSearch = await page.evaluate(() => window.location.search);
    check(
      "URL carries ?philosopher=Ariston of Chios (shareable)",
      new URLSearchParams(aristonSearch).get("philosopher") ===
        "Ariston of Chios",
      `search=${aristonSearch}`,
    );

    // --- Reset, then domain filter: "pleasure" must surface Dionysius.
    await pickOption("phil", "All philosophers");
    const resetOk = await page
      .waitForFunction(
        () => !new URLSearchParams(window.location.search).has("philosopher"),
        undefined,
        { timeout: 10000 },
      )
      .then(
        () => true,
        () => false,
      );
    check("resetting the philosopher filter drops ?philosopher=", resetOk);

    await pickOption("domain", "pleasure");
    const domainSettled = await page
      .waitForFunction(
        () =>
          new URLSearchParams(window.location.search).get("domain") ===
          "pleasure",
        undefined,
        { timeout: 10000 },
      )
      .then(
        () => true,
        () => false,
      );
    check("URL carries ?domain=pleasure (shareable)", domainSettled);
    // Wait for the filtered list to include Dionysius' card.
    const dionysiusShown = await page
      .waitForFunction(
        (cardHeadingSel) =>
          // textContent, not innerText: the philosopher name is rendered in a
          // CSS-uppercased span (the mixed-case gloss line was removed).
          Array.from(document.querySelectorAll("span")).some(
            (s) => (s.textContent ?? "").trim() === "Dionysius the Renegade",
          ) &&
          Array.from(document.querySelectorAll(cardHeadingSel)).some(
            (h) => (h.textContent ?? "").trim() === "D.L. 7.166",
          ),
        CARD_HEADING_SELECTOR,
        { timeout: 15000 },
      )
      .then(
        () => true,
        () => false,
      );
    check(
      "pleasure domain shows Dionysius the Renegade's D.L. 7.166 entry",
      dionysiusShown,
    );
    await page.waitForTimeout(300);
    const pleasure = await readCards();
    check(
      "pleasure domain renders at least one card and no ethics-only stray",
      pleasure.count >= 1 && !pleasure.text.includes("No doxai match"),
      `count=${pleasure.count}`,
    );

    // Scenario 4: the reverse direction of the shareable-URL contract.
    // Scenario 3 checks picking a filter writes the URL; this one checks a
    // shared link REOPENS the same view: /doxography?philosopher=...&domain=...
    // opened cold must seed both dropdown triggers and filter the list.
    // Ariston of Chios has doxai in ethics and beyond (the sanity guard in
    // loadExpected() pins the strict narrowing), so philosopher+ethics must
    // show exactly the API's intersection count.
    console.log(
      "Scenario: a shared filter link reopens with the same filtered view",
    );
    await page.goto(
      `${BASE_URL}/doxography?philosopher=${encodeURIComponent(
        "Ariston of Chios",
      )}&domain=ethics`,
      { waitUntil: "networkidle" },
    );
    guard.assertPageLoaded();
    const sharedSettled = await countLineSettles(page, EXPECTED.aristonEthics);
    check(
      `count line settles at '${EXPECTED.aristonEthics} doxai' (API count) for the shared Ariston+ethics link`,
      sharedSettled,
    );
    await page.waitForTimeout(300);

    // The dropdown triggers must display the values from the URL, proving
    // the state was seeded (not just the list coincidentally short).
    const triggers = await page.evaluate(() => ({
      phil: (document.getElementById("phil")?.textContent ?? "").trim(),
      domain: (document.getElementById("domain")?.textContent ?? "").trim(),
    }));
    check(
      "philosopher trigger shows 'Ariston of Chios'",
      triggers.phil === "Ariston of Chios",
      `trigger=${triggers.phil}`,
    );
    check(
      "domain trigger shows 'ethics'",
      triggers.domain === "ethics",
      `trigger=${triggers.domain}`,
    );

    const shared = await readCards();
    check(
      `exactly ${EXPECTED.aristonEthics} doxa cards render (Ariston's ethics doxai only, API count)`,
      shared.count === EXPECTED.aristonEthics,
      `count=${shared.count} refs=${shared.refs.join(",")}`,
    );
    check(
      "the shared view includes both D.L. 7.160 and D.L. 7.161",
      shared.refs.includes("D.L. 7.160") && shared.refs.includes("D.L. 7.161"),
      `refs=${shared.refs.join(",")}`,
    );
    check(
      "Ariston's non-ethics doxa is filtered out by the domain param",
      shared.refs.filter((r) => r === "D.L. 7.160").length ===
        EXPECTED.aristonEthics7160,
      `refs=${shared.refs.join(",")}`,
    );
    check(
      "no other philosopher leaks into the shared view",
      !shared.text.includes("Zeno of Citium") &&
        !shared.text.includes("Herillus"),
    );
    // The params must survive in the URL, still shareable onward.
    const sharedSearch = await page.evaluate(() => window.location.search);
    {
      const sp = new URLSearchParams(sharedSearch);
      check(
        "URL keeps ?philosopher= and ?domain= after seeding",
        sp.get("philosopher") === "Ariston of Chios" &&
          sp.get("domain") === "ethics",
        `search=${sharedSearch}`,
      );
    }

    // Scenario 5: a bogus ?philosopher= (renaming or encoding drift in a
    // shared link) must fall back gracefully: full list, trigger back on
    // "All philosophers", and the dead param dropped from the URL.
    console.log(
      "Scenario: a bogus ?philosopher= falls back to the full list",
    );
    await page.goto(
      `${BASE_URL}/doxography?philosopher=${encodeURIComponent(
        "Aristo of Kios",
      )}`,
      { waitUntil: "networkidle" },
    );
    guard.assertPageLoaded();
    const bogusDropped = await page
      .waitForFunction(
        () => !new URLSearchParams(window.location.search).has("philosopher"),
        undefined,
        { timeout: 30000 },
      )
      .then(
        () => true,
        () => false,
      );
    check("unknown philosopher param is dropped from the URL", bogusDropped);
    const bogusSettled = await countLineSettles(page, EXPECTED.all);
    check(
      `count line settles at the full '${EXPECTED.all} doxai' (API count) after the fallback`,
      bogusSettled,
    );
    await page.waitForTimeout(300);
    const bogusTrigger = await page.evaluate(() =>
      (document.getElementById("phil")?.textContent ?? "").trim(),
    );
    check(
      "philosopher trigger resets to 'All philosophers'",
      bogusTrigger === "All philosophers",
      `trigger=${bogusTrigger}`,
    );
    check(
      "no 'No doxai match' empty state after the fallback",
      await page.evaluate(
        () => !document.body.innerText.includes("No doxai match"),
      ),
    );

    // Scenario 6: a domain badge click refilters IN PLACE. Doxa cards carry
    // domain badges linking to /doxography?domain=X; when the page is
    // already mounted, a dedicated effect in doxography.tsx picks the new
    // domain up from the search string. A regression there would leave the
    // list unchanged after a badge click while direct URL loads stay green.
    console.log(
      "Scenario: domain badge clicks refilter the mounted page in place",
    );
    await page.goto(`${BASE_URL}/doxography`, { waitUntil: "networkidle" });
    guard.assertPageLoaded();
    await guard.guarded(
      page.waitForFunction(
        (cardHeadingSel) =>
          /\d+ doxai/.test(document.body.innerText) &&
          Array.from(document.querySelectorAll(cardHeadingSel)).some((h) =>
            (h.textContent ?? "").startsWith("D.L. "),
          ),
        CARD_HEADING_SELECTOR,
        { timeout: 30000 },
      ),
    );
    await page.waitForTimeout(300);

    // Plant a sentinel on window: a full page reload would wipe it, so its
    // survival proves every transition below was client-side.
    await page.evaluate(() => {
      (window as unknown as Record<string, unknown>).__doxaBadgeSentinel =
        "alive";
    });
    const sentinelAlive = () =>
      page.evaluate(
        () =>
          (window as unknown as Record<string, unknown>)
            .__doxaBadgeSentinel === "alive",
      );

    // Read the rendered cards' domain badges (anchors to /doxography?domain=).
    const readBadges = () =>
      page.evaluate(() => {
        const anchors = Array.from(document.querySelectorAll("a")).filter(
          (a) =>
            (a.getAttribute("href") ?? "").startsWith("/doxography?domain="),
        );
        return anchors.map((a) => ({
          href: a.getAttribute("href") ?? "",
          domain: (a.textContent ?? "").trim(),
        }));
      });

    const unfilteredBadges = await readBadges();
    const distinctDomains = Array.from(
      new Set(unfilteredBadges.map((b) => b.domain)),
    );
    check(
      "unfiltered list carries badges for at least two distinct domains",
      distinctDomains.length >= 2,
      `domains=${distinctDomains.join(",")}`,
    );

    // Click a badge via a bubbling MouseEvent (wouter navigation), then
    // assert the URL and the in-place refilter.
    const clickBadge = (domain: string) =>
      page.evaluate((d) => {
        const a = Array.from(document.querySelectorAll("a")).find(
          (el) =>
            (el.getAttribute("href") ?? "").startsWith(
              "/doxography?domain=",
            ) && (el.textContent ?? "").trim() === d,
        );
        if (!a) return false;
        a.dispatchEvent(
          new MouseEvent("click", { bubbles: true, cancelable: true }),
        );
        return true;
      }, domain);

    const assertFiltered = async (domain: string, label: string) => {
      const urlOk = await page
        .waitForFunction(
          (d) =>
            window.location.pathname === "/doxography" &&
            new URLSearchParams(window.location.search).get("domain") === d,
          domain,
          { timeout: 10000 },
        )
        .then(
          () => true,
          () => false,
        );
      const search = await page.evaluate(() => window.location.search);
      check(
        `${label}: URL carries ?domain=${domain}`,
        urlOk,
        `search=${search}`,
      );
      // The list must settle so that every rendered card's badge shows the
      // clicked domain (i.e. the effect actually refiltered the list).
      const refiltered = await page
        .waitForFunction(
          (d) => {
            const badges = Array.from(document.querySelectorAll("a")).filter(
              (a) =>
                (a.getAttribute("href") ?? "").startsWith(
                  "/doxography?domain=",
                ),
            );
            return (
              badges.length > 0 &&
              badges.every((a) => (a.textContent ?? "").trim() === d)
            );
          },
          domain,
          { timeout: 15000 },
        )
        .then(
          () => true,
          () => false,
        );
      const nowBadges = await readBadges();
      check(
        `${label}: list refiltered in place, every card badge is "${domain}"`,
        refiltered,
        `badges=${Array.from(new Set(nowBadges.map((b) => b.domain))).join(",")} count=${nowBadges.length}`,
      );
      check(
        `${label}: no full reload happened (sentinel intact)`,
        await sentinelAlive(),
      );
    };

    const firstDomain = distinctDomains[0];
    check(
      `first badge ("${firstDomain}") found and clicked`,
      await clickBadge(firstDomain),
    );
    await assertFiltered(firstDomain, "first badge click");

    // Reset to all domains via the dropdown (client-side, page still
    // mounted), so a second, different badge becomes clickable.
    await pickOption("domain", "All domains");
    const resetToAll = await page
      .waitForFunction(
        () => !new URLSearchParams(window.location.search).has("domain"),
        undefined,
        { timeout: 10000 },
      )
      .then(
        () => true,
        () => false,
      );
    check("resetting the domain dropdown drops ?domain=", resetToAll);
    await page.waitForTimeout(300);

    const secondDomain = distinctDomains.find((d) => d !== firstDomain);
    check(
      "a second, different domain badge exists after the reset",
      !!secondDomain,
      `domains=${distinctDomains.join(",")}`,
    );
    if (secondDomain) {
      check(
        `second badge ("${secondDomain}") found and clicked`,
        await clickBadge(secondDomain),
      );
      await assertFiltered(secondDomain, "second badge click");
    }

    // Scenario 7: the remaining two URL params, ?q= (keyword) and ?book=,
    // must also reopen a shared view. Scenario 4 covers philosopher+domain;
    // this covers a cold load of /doxography?q=virtue&book=7: the search
    // box must be prefilled, the book trigger must show "Book 7", and the
    // list must be the intersection (strictly fewer than q=virtue alone —
    // the sanity guard pins this — so the book param demonstrably
    // participates in the filter).
    console.log(
      "Scenario: a shared ?q=&book= link reopens the same filtered view",
    );
    await page.goto(`${BASE_URL}/doxography?q=virtue&book=7`, {
      waitUntil: "networkidle",
    });
    guard.assertPageLoaded();
    const qBookSettled = await countLineSettles(page, EXPECTED.virtueBook7);
    check(
      `count line settles at '${EXPECTED.virtueBook7} doxai' (API count) for the shared q=virtue&book=7 link`,
      qBookSettled,
    );
    await page.waitForTimeout(300);

    // The controls must display the values from the URL, proving the state
    // was seeded rather than the list being coincidentally short.
    const qBookControls = await page.evaluate(() => ({
      q: (
        document.querySelector(
          'input[placeholder^="Search the doctrines"]',
        ) as HTMLInputElement | null
      )?.value,
      book: (document.getElementById("book")?.textContent ?? "").trim(),
    }));
    check(
      "search box is prefilled with 'virtue'",
      qBookControls.q === "virtue",
      `value=${qBookControls.q}`,
    );
    check(
      "book trigger shows 'Book 7'",
      qBookControls.book === "Book 7",
      `trigger=${qBookControls.book}`,
    );

    const qBook = await readCards();
    check(
      `exactly ${EXPECTED.virtueBook7} doxa cards render for virtue in Book 7 (API count)`,
      qBook.count === EXPECTED.virtueBook7,
      `count=${qBook.count} refs=${qBook.refs.join(",")}`,
    );
    check(
      "the filtered list includes Ariston's D.L. 7.161 (virtue) card",
      qBook.refs.includes("D.L. 7.161"),
      `refs=${qBook.refs.join(",")}`,
    );
    check(
      "no card from another book leaks in (every ref starts with 'D.L. 7.')",
      qBook.refs.every((r) => r.startsWith("D.L. 7.")),
      `refs=${qBook.refs.join(",")}`,
    );
    // The params must survive in the URL, still shareable onward.
    {
      const qBookSearch = await page.evaluate(() => window.location.search);
      const sp = new URLSearchParams(qBookSearch);
      check(
        "URL keeps ?q= and ?book= after seeding",
        sp.get("q") === "virtue" && sp.get("book") === "7",
        `search=${qBookSearch}`,
      );
    }

    // Scenario 8: a non-numeric ?book= (typo or mangled shared link) must
    // hit the /^\d+$/ guard and reset gracefully to "All": full list, book
    // trigger on "All", dead param dropped from the URL.
    console.log(
      "Scenario: a non-numeric ?book= falls back to 'All' books",
    );
    await page.goto(`${BASE_URL}/doxography?book=vii`, {
      waitUntil: "networkidle",
    });
    guard.assertPageLoaded();
    const badBookDropped = await page
      .waitForFunction(
        () => !new URLSearchParams(window.location.search).has("book"),
        undefined,
        { timeout: 30000 },
      )
      .then(
        () => true,
        () => false,
      );
    check("non-numeric book param is dropped from the URL", badBookDropped);
    const badBookSettled = await countLineSettles(page, EXPECTED.all);
    check(
      `count line settles at the full '${EXPECTED.all} doxai' (API count) after the book fallback`,
      badBookSettled,
    );
    await page.waitForTimeout(300);
    const badBookTrigger = await page.evaluate(() =>
      (document.getElementById("book")?.textContent ?? "").trim(),
    );
    check(
      "book trigger resets to 'All'",
      badBookTrigger === "All",
      `trigger=${badBookTrigger}`,
    );
    check(
      "no 'No doxai match' empty state after the book fallback",
      await page.evaluate(
        () => !document.body.innerText.includes("No doxai match"),
      ),
    );

    // Scenario 9: a domain badge click FROM a philosopher-filtered view.
    // The badge links to /doxography?domain=X with no philosopher param,
    // so the click must drop the philosopher filter; a regression could
    // leave a stale ?philosopher= silently intersecting with the new
    // domain and show an empty or misleading list.
    console.log(
      "Scenario: a domain badge click from a philosopher-filtered view drops the philosopher filter",
    );
    await page.goto(`${BASE_URL}/doxography`, { waitUntil: "networkidle" });
    guard.assertPageLoaded();
    await guard.guarded(
      page.waitForFunction(
        (cardHeadingSel) =>
          /\d+ doxai/.test(document.body.innerText) &&
          Array.from(document.querySelectorAll(cardHeadingSel)).some((h) =>
            (h.textContent ?? "").startsWith("D.L. "),
          ),
        CARD_HEADING_SELECTOR,
        { timeout: 30000 },
      ),
    );
    await page.waitForTimeout(300);

    // Filter to Ariston of Chios via the dropdown, exactly like a reader
    // browsing one philosopher's tenets.
    await pickOption("phil", "Ariston of Chios");
    const badgeAristonSettled = await page
      .waitForFunction(
        (want) =>
          new RegExp(`(^|\\n)${want} doxai`).test(document.body.innerText) &&
          new URLSearchParams(window.location.search).get("philosopher") ===
            "Ariston of Chios",
        EXPECTED.ariston,
        { timeout: 15000 },
      )
      .then(
        () => true,
        () => false,
      );
    check(
      `philosopher filter active: ${EXPECTED.ariston} doxai (API count) and ?philosopher=Ariston of Chios`,
      badgeAristonSettled,
    );
    await page.waitForTimeout(300);

    // Remember how many cards the philosopher-filtered view showed for the
    // domain we are about to click, so we can prove the click widened the
    // list to ALL doxai of that domain rather than intersecting.
    const filteredBadges = await readBadges();
    const clickedDomain = filteredBadges[0]?.domain;
    check(
      "a domain badge exists on the philosopher-filtered cards",
      !!clickedDomain,
      `badges=${filteredBadges.map((b) => b.domain).join(",")}`,
    );
    if (clickedDomain) {
      const aristonDomainCount = filteredBadges.filter(
        (b) => b.domain === clickedDomain,
      ).length;

      check(
        `domain badge ("${clickedDomain}") clicked from the filtered view`,
        await clickBadge(clickedDomain),
      );

      // The URL must gain ?domain= and LOSE ?philosopher=.
      const badgeUrlOk = await page
        .waitForFunction(
          (d) => {
            const sp = new URLSearchParams(window.location.search);
            return (
              window.location.pathname === "/doxography" &&
              sp.get("domain") === d &&
              !sp.has("philosopher")
            );
          },
          clickedDomain,
          { timeout: 10000 },
        )
        .then(
          () => true,
          () => false,
        );
      const badgeSearch = await page.evaluate(() => window.location.search);
      check(
        `URL carries ?domain=${clickedDomain} and drops ?philosopher=`,
        badgeUrlOk,
        `search=${badgeSearch}`,
      );

      // The philosopher trigger must visibly reset, proving the state (not
      // just the URL) let go of the old filter.
      const trigReset = await page
        .waitForFunction(
          () =>
            (document.getElementById("phil")?.textContent ?? "").trim() ===
            "All philosophers",
          undefined,
          { timeout: 10000 },
        )
        .then(
          () => true,
          () => false,
        );
      const trigNow = await page.evaluate(() =>
        (document.getElementById("phil")?.textContent ?? "").trim(),
      );
      check(
        "philosopher trigger resets to 'All philosophers'",
        trigReset,
        `trigger=${trigNow}`,
      );

      // The list must settle on ALL doxai of the clicked domain: every
      // badge shows that domain, and the list is STRICTLY WIDER than the
      // philosopher-filtered slice (other philosophers' doxai included).
      const widened = await page
        .waitForFunction(
          ([d, n]) => {
            const badges = Array.from(document.querySelectorAll("a")).filter(
              (a) =>
                (a.getAttribute("href") ?? "").startsWith(
                  "/doxography?domain=",
                ),
            );
            return (
              badges.length > Number(n) &&
              badges.every(
                (a) => (a.textContent ?? "").trim() === String(d),
              )
            );
          },
          [clickedDomain, String(aristonDomainCount)] as const,
          { timeout: 15000 },
        )
        .then(
          () => true,
          () => false,
        );
      const afterBadges = await readBadges();
      check(
        `list shows ALL "${clickedDomain}" doxai (wider than Ariston's ${aristonDomainCount})`,
        widened,
        `count=${afterBadges.length} domains=${Array.from(new Set(afterBadges.map((b) => b.domain))).join(",")}`,
      );
      check(
        "another philosopher's card appears (filter really dropped)",
        await page.evaluate(
          () =>
            !!Array.from(document.querySelectorAll("span")).find((s) => {
              const t = (s.textContent ?? "").trim();
              return t.length > 0 && t !== "Ariston of Chios";
            }) &&
            // textContent, not innerText: philosopher names live in
            // CSS-uppercased spans since the gloss line was removed.
            Array.from(document.querySelectorAll("span")).some(
              (s) => (s.textContent ?? "").trim() === "Zeno of Citium",
            ),
        ),
      );
      check(
        "no 'No doxai match' dead end after the badge click",
        await page.evaluate(
          () => !document.body.innerText.includes("No doxai match"),
        ),
      );
    }

    // Scenario 8: the badge names the ALREADY-selected domain. The
    // philosopher reconcile must not be gated on the domain changing:
    // with ?philosopher=Ariston of Chios&domain=ethics active, clicking
    // an "ethics" badge (URL becomes /doxography?domain=ethics, no
    // philosopher) must still drop the philosopher filter and widen the
    // list to all ethics doxai.
    console.log(
      "Scenario: a same-domain badge click still drops the philosopher filter",
    );
    await page.goto(
      `${BASE_URL}/doxography?philosopher=${encodeURIComponent(
        "Ariston of Chios",
      )}&domain=ethics`,
      { waitUntil: "networkidle" },
    );
    guard.assertPageLoaded();
    const sameDomainSeeded = await countLineSettles(
      page,
      EXPECTED.aristonEthics,
    );
    check(
      `both filters active: ${EXPECTED.aristonEthics} doxai (API count) for Ariston of Chios + ethics`,
      sameDomainSeeded,
    );
    await page.waitForTimeout(300);

    check(
      `same-domain badge ("ethics") clicked from the doubly-filtered view`,
      await clickBadge("ethics"),
    );
    const sameDomainUrlOk = await page
      .waitForFunction(
        () => {
          const sp = new URLSearchParams(window.location.search);
          return (
            window.location.pathname === "/doxography" &&
            sp.get("domain") === "ethics" &&
            !sp.has("philosopher")
          );
        },
        undefined,
        { timeout: 10000 },
      )
      .then(
        () => true,
        () => false,
      );
    const sameDomainSearch = await page.evaluate(() => window.location.search);
    check(
      "URL keeps ?domain=ethics and drops ?philosopher=",
      sameDomainUrlOk,
      `search=${sameDomainSearch}`,
    );
    const sameDomainTrigReset = await page
      .waitForFunction(
        () =>
          (document.getElementById("phil")?.textContent ?? "").trim() ===
          "All philosophers",
        undefined,
        { timeout: 10000 },
      )
      .then(
        () => true,
        () => false,
      );
    check(
      "philosopher trigger resets to 'All philosophers' (same-domain click)",
      sameDomainTrigReset,
    );
    const sameDomainWidened = await page
      .waitForFunction(
        ([want, floor]) => {
          const badges = Array.from(document.querySelectorAll("a")).filter(
            (a) =>
              (a.getAttribute("href") ?? "").startsWith("/doxography?domain="),
          );
          return (
            badges.length === want &&
            badges.length > floor &&
            badges.every((a) => (a.textContent ?? "").trim() === "ethics")
          );
        },
        [EXPECTED.ethics, EXPECTED.aristonEthics] as const,
        { timeout: 15000 },
      )
      .then(
        () => true,
        () => false,
      );
    check(
      `list widens to ALL ${EXPECTED.ethics} ethics doxai (more than Ariston's ${EXPECTED.aristonEthics})`,
      sameDomainWidened,
    );
    check(
      "no 'No doxai match' dead end after the same-domain click",
      await page.evaluate(
        () => !document.body.innerText.includes("No doxai match"),
      ),
    );
    // Scenario: the forward direction for the last two controls. Scenario 7
    // proved a shared ?q=&book= link reopens the view (URL → state); this
    // proves typing into the debounced search box and picking a book from
    // the dropdown WRITE the URL (state → URL), so the resulting link is
    // shareable. A regression in the 250ms debounce or the URL-sync effect
    // would ship silently otherwise. Finally, clearing both must reset the
    // URL to bare /doxography.
    console.log(
      "Scenario: typing a keyword and picking a book update the shareable URL",
    );
    await page.goto(`${BASE_URL}/doxography`, { waitUntil: "networkidle" });
    guard.assertPageLoaded();
    await guard.guarded(
      page.waitForFunction(
        ([want, cardHeadingSel]) =>
          new RegExp(`(^|\\n)${want} doxai`).test(document.body.innerText) &&
          Array.from(document.querySelectorAll(cardHeadingSel)).some((h) =>
            (h.textContent ?? "").startsWith("D.L. "),
          ),
        [EXPECTED.all, CARD_HEADING_SELECTOR] as const,
        { timeout: 30000 },
      ),
    );
    await page.waitForTimeout(300);

    // Type into the search box with real keystrokes so the debounce runs.
    const searchBox = page.locator(
      'input[placeholder^="Search the doctrines"]',
    );
    await searchBox.click();
    await searchBox.pressSequentially("virtue", { delay: 40 });

    // After the 250ms debounce, the URL must gain ?q=virtue.
    const qWritten = await page
      .waitForFunction(
        () =>
          new URLSearchParams(window.location.search).get("q") === "virtue",
        undefined,
        { timeout: 10000 },
      )
      .then(
        () => true,
        () => false,
      );
    const qSearch = await page.evaluate(() => window.location.search);
    check(
      "typing 'virtue' writes ?q=virtue after the debounce",
      qWritten,
      `search=${qSearch}`,
    );

    // The list must refilter: q=virtue alone strictly narrows the full
    // list (the sanity guard pins virtue < all).
    const qFiltered = await countLineSettles(page, EXPECTED.virtue);
    check(
      `list refilters to '${EXPECTED.virtue} doxai' (API count) for the typed keyword`,
      qFiltered,
    );
    await page.waitForTimeout(300);
    const typed = await readCards();
    check(
      "the keyword-filtered list includes Ariston's D.L. 7.161 (virtue) card",
      typed.refs.includes("D.L. 7.161"),
      `refs=${typed.refs.join(",")}`,
    );

    // Pick a book from the dropdown: the URL must gain ?book=7 and the
    // list must narrow to the q+book intersection (all Book 7).
    await pickOption("book", "Book 7");
    const bookWritten = await page
      .waitForFunction(
        () => {
          const sp = new URLSearchParams(window.location.search);
          return sp.get("book") === "7" && sp.get("q") === "virtue";
        },
        undefined,
        { timeout: 10000 },
      )
      .then(
        () => true,
        () => false,
      );
    const bookSearch = await page.evaluate(() => window.location.search);
    check(
      "picking 'Book 7' writes ?book=7 (and keeps ?q=virtue)",
      bookWritten,
      `search=${bookSearch}`,
    );
    const bookFiltered = await countLineSettles(page, EXPECTED.virtueBook7);
    check(
      `list narrows to '${EXPECTED.virtueBook7} doxai' (API count) for virtue in Book 7`,
      bookFiltered,
    );
    await page.waitForTimeout(300);
    const booked = await readCards();
    check(
      "only Book 7 refs render after picking the book",
      booked.count > 0 && booked.refs.every((r) => r.startsWith("D.L. 7.")),
      `refs=${booked.refs.join(",")}`,
    );

    // Clear both controls: the URL must return to bare /doxography.
    await searchBox.fill("");
    await pickOption("book", "All");
    const cleared = await page
      .waitForFunction(
        () =>
          window.location.pathname === "/doxography" &&
          window.location.search === "",
        undefined,
        { timeout: 10000 },
      )
      .then(
        () => true,
        () => false,
      );
    const clearedSearch = await page.evaluate(
      () => window.location.pathname + window.location.search,
    );
    check(
      "clearing the box and resetting the book restores bare /doxography",
      cleared,
      `url=${clearedSearch}`,
    );
    const clearedFull = await countLineSettles(page, EXPECTED.all);
    check(
      `full '${EXPECTED.all} doxai' list (API count) returns after clearing both`,
      clearedFull,
    );

    // Scenario: a domain badge click clears a STALE ?q= and ?book= too.
    // The badge links to /doxography?domain=X with no other params; the
    // philosopher reset is covered above, but a stale keyword search or
    // book filter would otherwise be re-written into the URL by the sync
    // effect and silently intersect with the new domain (e.g. type
    // "virtue", pick Book 7, click a "cosmology" badge → empty list).
    console.log(
      "Scenario: a domain badge click clears a stale search term and book filter",
    );
    // Rebuild the q=virtue + book=7 view with real keystrokes.
    await searchBox.click();
    await searchBox.pressSequentially("virtue", { delay: 40 });
    await pickOption("book", "Book 7");
    const staleSeeded = await page
      .waitForFunction(
        (want) => {
          const sp = new URLSearchParams(window.location.search);
          return (
            sp.get("q") === "virtue" &&
            sp.get("book") === "7" &&
            new RegExp(`(^|\\n)${want} doxai`).test(document.body.innerText)
          );
        },
        EXPECTED.virtueBook7,
        { timeout: 15000 },
      )
      .then(
        () => true,
        () => false,
      );
    check(
      `stale filters active: ?q=virtue&book=7 shows ${EXPECTED.virtueBook7} doxai (API count)`,
      staleSeeded,
    );
    await page.waitForTimeout(300);

    // Click a domain badge from the filtered view. Pick the first badge's
    // domain; remember how many cards the filtered view showed for it so
    // we can prove the click widened the list past the q+book slice.
    const staleBadges = await readBadges();
    const staleDomain = staleBadges[0]?.domain;
    check(
      "a domain badge exists on the q+book-filtered cards",
      !!staleDomain,
      `badges=${staleBadges.map((b) => b.domain).join(",")}`,
    );
    if (staleDomain) {
      const staleSliceCount = staleBadges.filter(
        (b) => b.domain === staleDomain,
      ).length;
      check(
        `domain badge ("${staleDomain}") clicked from the q+book view`,
        await clickBadge(staleDomain),
      );

      // The URL must gain ?domain= and LOSE both ?q= and ?book=.
      const staleUrlOk = await page
        .waitForFunction(
          (d) => {
            const sp = new URLSearchParams(window.location.search);
            return (
              window.location.pathname === "/doxography" &&
              sp.get("domain") === d &&
              !sp.has("q") &&
              !sp.has("book")
            );
          },
          staleDomain,
          { timeout: 10000 },
        )
        .then(
          () => true,
          () => false,
        );
      const staleSearch = await page.evaluate(() => window.location.search);
      check(
        `URL carries only ?domain=${staleDomain} (no ?q=, no ?book=)`,
        staleUrlOk,
        `search=${staleSearch}`,
      );

      // The controls must visibly reset: empty search box, "All" books.
      const controlsReset = await page
        .waitForFunction(
          () =>
            (
              document.querySelector<HTMLInputElement>(
                'input[placeholder^="Search the doctrines"]',
              )?.value ?? "x"
            ).trim() === "" &&
            (document.getElementById("book")?.textContent ?? "")
              .trim()
              .startsWith("All"),
          undefined,
          { timeout: 10000 },
        )
        .then(
          () => true,
          () => false,
        );
      const controlsNow = await page.evaluate(() => ({
        q: document.querySelector<HTMLInputElement>(
          'input[placeholder^="Search the doctrines"]',
        )?.value,
        book: (document.getElementById("book")?.textContent ?? "").trim(),
      }));
      check(
        "search box empties and book trigger resets to 'All'",
        controlsReset,
        `q=${JSON.stringify(controlsNow.q)} book=${controlsNow.book}`,
      );

      // The list must settle on ALL doxai of the clicked domain: every
      // badge shows that domain and the list is STRICTLY WIDER than the
      // q+book slice (proving no stale intersection survived).
      const staleWidened = await page
        .waitForFunction(
          ([d, n]) => {
            const badges = Array.from(document.querySelectorAll("a")).filter(
              (a) =>
                (a.getAttribute("href") ?? "").startsWith(
                  "/doxography?domain=",
                ),
            );
            return (
              badges.length > Number(n) &&
              badges.every((a) => (a.textContent ?? "").trim() === String(d))
            );
          },
          [staleDomain, String(staleSliceCount)] as const,
          { timeout: 15000 },
        )
        .then(
          () => true,
          () => false,
        );
      const staleAfter = await readBadges();
      check(
        `list shows ALL "${staleDomain}" doxai (wider than the q+book slice of ${staleSliceCount})`,
        staleWidened,
        `count=${staleAfter.length} domains=${Array.from(new Set(staleAfter.map((b) => b.domain))).join(",")}`,
      );
      check(
        "no 'No doxai match' dead end after the badge click",
        await page.evaluate(
          () => !document.body.innerText.includes("No doxai match"),
        ),
      );
    }
  } finally {
    await browser.close();
  }

  if (failures > 0) {
    console.error(`\ne2e-doxography-links: ${failures} check(s) FAILED`);
    process.exit(1);
  }
  console.log("\ne2e-doxography-links: all checks passed");
}

main().catch((err) => {
  console.error("e2e-doxography-links: fatal error", err);
  process.exit(1);
});
