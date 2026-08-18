/// <reference lib="dom" />
// The in-page callbacks (page.evaluate / waitForFunction) run in the
// browser, so this Node-side script needs the DOM lib for their types.
//
// Real-browser check that the /competency sidebar row-count badges match
// what each question actually returns. The badges are computed once
// server-side (getCompetencyRowCounts in routes/competency.ts) by running
// each question's SPARQL query at first catalogue fetch; the results table
// runs the same query per-question. If either side drifts (a stale cache,
// a changed query, a graph rebuild), the badge would mislead readers about
// which questions are rich. This script drives headless Chromium against
// the running dev servers:
//
// For each checked question (at least homonymy-proper-names and
// stoa-members):
// 1. Load /competency, find the question's sidebar button and read its
//    badge number from the rendered DOM.
// 2. Click the question, wait for the Query Results panel, and count the
//    actual <tbody> rows of the results table.
// 3. Assert badge === table row count === the "N rows" counter text,
//    naming the question on failure.
// Also asserts the checked badges are > 0, so a vacuously green run
// (badge 0, empty table) cannot pass for these known-rich questions.
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

// Question ids to verify. The task pins homonymy and stoa-members; both
// are known-rich, so their badges must also be non-zero.
const QUESTION_IDS = ["homonymy-proper-names", "stoa-members"] as const;

let failures = 0;
function check(label: string, ok: boolean, detail?: string) {
  if (ok) {
    console.log(`  ok: ${label}`);
  } else {
    failures++;
    console.error(`  FAIL: ${label}${detail ? ` (${detail})` : ""}`);
  }
}

interface CatalogueQuestion {
  id: string;
  question: string;
  category: string;
  greekTerm?: string;
  rowCount: number;
}

async function main() {
  // The sidebar buttons carry no ids, only the question text, so map
  // id -> question text via the catalogue endpoint (the same one the page
  // uses, so the mapping cannot drift from what is rendered).
  const catRes = await fetch(`${BASE_URL}/api/competency/questions`);
  if (!catRes.ok) {
    throw new Error(
      `GET /api/competency/questions failed: ${catRes.status} ${catRes.statusText}`,
    );
  }
  const catalogue = (await catRes.json()) as {
    questions: CatalogueQuestion[];
  };
  const byId = new Map(catalogue.questions.map((q) => [q.id, q]));

  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({
      viewport: { width: 1280, height: 900 },
    });
    // Fail fast with the failing URL/status instead of an opaque selector
    // timeout when the site itself fails to boot.
    const guard = attachPageGuard(page);

    // ---- Full-sidebar sweep: one page load, every badge vs the catalogue.
    // A rendering or mapping bug on ANY question (not just the two rich
    // ones clicked below) must fail here, named by question id.
    console.log(
      `Sidebar sweep: all ${catalogue.questions.length} badges must match the catalogue`,
    );
    await page.goto(`${BASE_URL}/competency`, { waitUntil: "networkidle" });
    guard.assertPageLoaded();
    await guard.guarded(
      page.waitForFunction(
        () =>
          Array.from(document.querySelectorAll("button span[title]")).some(
            (s) => (s.getAttribute("title") ?? "").includes("result row"),
          ),
        undefined,
        { timeout: 30000 },
      ),
    );

    // Read every rendered badge: (button text, badge text, badge title).
    const readBadges = () =>
      page.evaluate(() => {
        const out: Array<{
          buttonText: string;
          badge: string;
          title: string;
        }> = [];
        for (const btn of Array.from(document.querySelectorAll("button"))) {
          const span = btn.querySelector("span[title]");
          const title = span?.getAttribute("title") ?? "";
          if (!title.includes("result row")) continue;
          out.push({
            buttonText: (btn.textContent ?? "").trim(),
            badge: (span?.textContent ?? "").trim(),
            title,
          });
        }
        return out;
      });
    const rendered = await readBadges();

    check(
      `sweep: rendered badge count (${rendered.length}) equals catalogue size (${catalogue.questions.length})`,
      rendered.length === catalogue.questions.length,
    );

    let zeroBadges = 0;
    for (const q of catalogue.questions) {
      // Match this question's button by its own wording. Guard against
      // one question's text being a prefix of another's by requiring a
      // unique match.
      const matches = rendered.filter((r) =>
        r.buttonText.startsWith(q.question),
      );
      check(
        `sweep ${q.id}: exactly one sidebar badge (found ${matches.length})`,
        matches.length === 1,
        `question text "${q.question}"`,
      );
      if (matches.length !== 1) continue;
      const r = matches[0];
      const n = Number(r.badge);
      check(
        `sweep ${q.id}: badge is a number`,
        Number.isInteger(n),
        `badge text "${r.badge}"`,
      );
      check(
        `sweep ${q.id}: badge (${n}) equals catalogue rowCount (${q.rowCount})`,
        n === q.rowCount,
      );
      check(
        `sweep ${q.id}: badge tooltip agrees`,
        r.title.startsWith(`${n} result row`),
        `title "${r.title}"`,
      );
      if (n === 0) {
        zeroBadges++;
        // A zero badge must reflect a genuinely empty catalogue count,
        // not a stale render of a rich question.
        check(
          `sweep ${q.id}: zero badge is genuine (catalogue rowCount ${q.rowCount})`,
          q.rowCount === 0,
        );
      }
    }
    console.log(
      `  sweep covered ${catalogue.questions.length} questions (${zeroBadges} with zero-row badges)`,
    );

    // ---- Filtered-sidebar sweep: type a term into the filter box, then
    // re-assert every still-visible badge against the catalogue and that
    // only matching questions remain. A rendering bug scoped to the
    // filtered view (badges mapped to the wrong surviving question after
    // the list shrinks) must fail here.
    // "works" survives as several questions (mapping bugs need >1 survivor
    // to surface); "homonym" narrows to a single question (extreme shrink).
    for (const FILTER_TERM of ["works", "homonym"]) {
      const f = FILTER_TERM.toLowerCase();
      // Mirror the page's own filter predicate (question, category, or
      // Greek term substring match, case-insensitive).
      const expectedFiltered = catalogue.questions.filter(
        (q) =>
          q.question.toLowerCase().includes(f) ||
          q.category.toLowerCase().includes(f) ||
          (q.greekTerm?.toLowerCase().includes(f) ?? false),
      );
      console.log(
        `Filter sweep: "${FILTER_TERM}" must leave ${expectedFiltered.length} questions with correct badges`,
      );
      // Positive control: the term must be a real subset, or the phase
      // proves nothing.
      check(
        `filter: term matches a non-empty strict subset (${expectedFiltered.length} of ${catalogue.questions.length})`,
        expectedFiltered.length > 0 &&
          expectedFiltered.length < catalogue.questions.length,
      );

      await page.fill('input[type="search"]', FILTER_TERM);
      await page.waitForFunction(
        (expected) =>
          Array.from(document.querySelectorAll("button span[title]")).filter(
            (s) => (s.getAttribute("title") ?? "").includes("result row"),
          ).length === expected,
        expectedFiltered.length,
        { timeout: 15000 },
      );
      const filteredRendered = await readBadges();
      check(
        `filter: visible badge count (${filteredRendered.length}) equals expected match count (${expectedFiltered.length})`,
        filteredRendered.length === expectedFiltered.length,
      );
      for (const q of expectedFiltered) {
        const matches = filteredRendered.filter((r) =>
          r.buttonText.startsWith(q.question),
        );
        check(
          `filter ${q.id}: exactly one visible badge (found ${matches.length})`,
          matches.length === 1,
          `question text "${q.question}"`,
        );
        if (matches.length !== 1) continue;
        const n = Number(matches[0].badge);
        check(
          `filter ${q.id}: badge (${n}) equals catalogue rowCount (${q.rowCount})`,
          Number.isInteger(n) && n === q.rowCount,
          `badge text "${matches[0].badge}"`,
        );
        check(
          `filter ${q.id}: badge tooltip agrees`,
          matches[0].title.startsWith(`${n} result row`),
          `title "${matches[0].title}"`,
        );
      }
      // Only matching questions may remain: every visible button must belong
      // to one of the expected questions.
      for (const r of filteredRendered) {
        const owner = expectedFiltered.find((q) =>
          r.buttonText.startsWith(q.question),
        );
        check(
          `filter: visible question is a genuine match`,
          !!owner,
          `button text "${r.buttonText.slice(0, 80)}"`,
        );
      }

      // ---- Filtered click-through: with the filter still active, click a
      // surviving question and assert the RIGHT question's results load.
      // If the click handler mapped to a stale index of the unfiltered
      // list, clicking the Nth survivor would open a different question:
      // the URL q= id, the results table row count vs that survivor's
      // catalogue rowCount, and the still-applied filter all pin this.
      // Prefer the second survivor (index bugs need position > 0 to
      // surface) with a non-zero rowCount so the table assertion is not
      // vacuous.
      {
        const clickTarget =
          expectedFiltered.length > 1
            ? (expectedFiltered.slice(1).find((q) => q.rowCount > 0) ??
              expectedFiltered.find((q) => q.rowCount > 0))
            : expectedFiltered.find((q) => q.rowCount > 0);
        check(
          `filter click "${FILTER_TERM}": a non-zero-rowCount survivor exists to click`,
          !!clickTarget,
        );
        if (clickTarget) {
          const survivorIndex = expectedFiltered.indexOf(clickTarget);
          console.log(
            `  filter click: selecting survivor #${survivorIndex + 1} (${clickTarget.id}, ${clickTarget.rowCount} rows) while "${FILTER_TERM}" is active`,
          );
          const clicked = await page.evaluate((questionText) => {
            const btn = Array.from(
              document.querySelectorAll("button"),
            ).find((b) =>
              (b.textContent ?? "").trim().startsWith(questionText),
            );
            if (!btn) return false;
            btn.click();
            return true;
          }, clickTarget.question);
          check(
            `filter click ${clickTarget.id}: survivor button clicked`,
            clicked,
          );

          // The URL must carry the clicked survivor's own id — the core
          // stale-index assertion. A previous iteration may have left a
          // stale q= behind, so wait for THIS id specifically (a timeout
          // falls through to the named check below with the actual value).
          await page
            .waitForFunction(
              (id) => new URLSearchParams(window.location.search).get("q") === id,
              clickTarget.id,
              { timeout: 30000 },
            )
            .catch(() => {});
          const urlQ = await page.evaluate(() =>
            new URLSearchParams(window.location.search).get("q"),
          );
          check(
            `filter click ${clickTarget.id}: URL carries q=${clickTarget.id}`,
            urlQ === clickTarget.id,
            `q=${urlQ}`,
          );

          // The filter itself must be in the shared URL too (?f=), so a
          // copied link restores BOTH the filter and the chosen question.
          const urlF = await page.evaluate(() =>
            new URLSearchParams(window.location.search).get("f"),
          );
          check(
            `filter click ${clickTarget.id}: URL carries f=${FILTER_TERM}`,
            urlF === FILTER_TERM,
            `f=${urlF}`,
          );

          // Results panel renders the clicked question's table: row count
          // and "N rows" counter must equal ITS catalogue rowCount (which
          // the sweep above already proved equals its badge).
          await page.waitForFunction(
            () => /query results/i.test(document.body.innerText),
            undefined,
            { timeout: 30000 },
          );
          // A previous selection's table may still be on screen; wait for
          // the row count to settle at THIS question's rowCount (timeout
          // falls through to the named check with the stale count).
          await page
            .waitForFunction(
              (expected) =>
                document.querySelectorAll("tbody tr").length === expected,
              clickTarget.rowCount,
              { timeout: 30000 },
            )
            .catch(() => {});
          await page.waitForTimeout(300);
          const table = await page.evaluate(() => {
            const rows = document.querySelectorAll("tbody tr").length;
            const m = document.body.innerText.match(/(\d+)\s+rows?\b/);
            return { rows, counter: m ? Number(m[1]) : null };
          });
          check(
            `filter click ${clickTarget.id}: table rows (${table.rows}) equal catalogue rowCount (${clickTarget.rowCount})`,
            table.rows === clickTarget.rowCount,
            `question "${clickTarget.question}"`,
          );
          check(
            `filter click ${clickTarget.id}: "N rows" counter equals rowCount`,
            table.counter === clickTarget.rowCount,
            `counter=${table.counter}`,
          );

          // The sidebar must keep the filter applied after selection: the
          // search box still holds the term and only survivors are listed.
          const inputValue = await page.evaluate(
            () =>
              document.querySelector<HTMLInputElement>(
                'input[type="search"]',
              )?.value ?? null,
          );
          check(
            `filter click ${clickTarget.id}: filter box still holds "${FILTER_TERM}"`,
            inputValue === FILTER_TERM,
            `value "${inputValue}"`,
          );
          const stillFiltered = await readBadges();
          check(
            `filter click ${clickTarget.id}: sidebar still shows only the ${expectedFiltered.length} survivors`,
            stillFiltered.length === expectedFiltered.length,
            `visible ${stillFiltered.length}`,
          );
        }
      }

      // Clearing the filter must restore the full list with badges intact.
      await page.fill('input[type="search"]', "");
      await page.waitForFunction(
        (expected) =>
          Array.from(document.querySelectorAll("button span[title]")).filter(
            (s) => (s.getAttribute("title") ?? "").includes("result row"),
          ).length === expected,
        catalogue.questions.length,
        { timeout: 15000 },
      );
      const restored = await readBadges();
      check(
        `filter cleared: full list restored (${restored.length} of ${catalogue.questions.length})`,
        restored.length === catalogue.questions.length,
      );
      for (const q of catalogue.questions) {
        const matches = restored.filter((r) =>
          r.buttonText.startsWith(q.question),
        );
        check(
          `filter cleared ${q.id}: badge still correct`,
          matches.length === 1 && Number(matches[0]?.badge) === q.rowCount,
          matches.length === 1
            ? `badge "${matches[0].badge}" vs rowCount ${q.rowCount}`
            : `found ${matches.length} matches`,
        );
      }
      console.log(
        `  filter sweep "${FILTER_TERM}" covered ${expectedFiltered.length} filtered + ${catalogue.questions.length} restored questions`,
      );
    }

    // ---- Cold-load restore: a shared filtered+selected link must restore
    // BOTH the sidebar filter and the chosen question on a fresh page load
    // (fresh tab, no in-page state to lean on). Uses the "works" survivors:
    // pick a non-zero-rowCount survivor and load /competency?q=<id>&f=works
    // directly.
    {
      const COLD_TERM = "works";
      const f = COLD_TERM.toLowerCase();
      const survivors = catalogue.questions.filter(
        (q) =>
          q.question.toLowerCase().includes(f) ||
          q.category.toLowerCase().includes(f) ||
          (q.greekTerm?.toLowerCase().includes(f) ?? false),
      );
      const target = survivors.find((q) => q.rowCount > 0);
      check(
        `cold load: a non-zero-rowCount "${COLD_TERM}" survivor exists`,
        !!target,
      );
      if (target) {
        console.log(
          `Cold load: /competency?q=${target.id}&f=${COLD_TERM} must restore filter AND question`,
        );
        await page.goto(
          `${BASE_URL}/competency?q=${encodeURIComponent(target.id)}&f=${encodeURIComponent(COLD_TERM)}`,
          { waitUntil: "networkidle" },
        );
        guard.assertPageLoaded();
        // Sidebar renders filtered: wait for exactly the survivors' badges.
        await page
          .waitForFunction(
            (expected) =>
              Array.from(
                document.querySelectorAll("button span[title]"),
              ).filter((s) =>
                (s.getAttribute("title") ?? "").includes("result row"),
              ).length === expected,
            survivors.length,
            { timeout: 30000 },
          )
          .catch(() => {});
        const coldInput = await page.evaluate(
          () =>
            document.querySelector<HTMLInputElement>('input[type="search"]')
              ?.value ?? null,
        );
        check(
          `cold load: filter box restored to "${COLD_TERM}"`,
          coldInput === COLD_TERM,
          `value "${coldInput}"`,
        );
        const coldBadges = await readBadges();
        check(
          `cold load: sidebar shows only the ${survivors.length} survivors`,
          coldBadges.length === survivors.length,
          `visible ${coldBadges.length}`,
        );
        // The chosen question's results must render too.
        await page.waitForFunction(
          () => /query results/i.test(document.body.innerText),
          undefined,
          { timeout: 30000 },
        );
        await page
          .waitForFunction(
            (expected) =>
              document.querySelectorAll("tbody tr").length === expected,
            target.rowCount,
            { timeout: 30000 },
          )
          .catch(() => {});
        const coldRows = await page.evaluate(
          () => document.querySelectorAll("tbody tr").length,
        );
        check(
          `cold load ${target.id}: results table rows (${coldRows}) equal catalogue rowCount (${target.rowCount})`,
          coldRows === target.rowCount,
        );
        // And the question's own heading is shown (the selection, not just
        // any table, was restored).
        const headingShown = await page.evaluate(
          (questionText) => document.body.innerText.includes(questionText),
          target.question,
        );
        check(
          `cold load ${target.id}: question heading rendered`,
          headingShown,
          `question "${target.question}"`,
        );
      }
    }

    // ---- Hidden-selection cold load: a shared link where ?f= hides ?q=
    // (question chosen, then a filter typed that excludes it). Decided
    // behavior (see competency.tsx): the results panel KEEPS the chosen
    // question, the sidebar stays filtered as shared, and an explicit
    // notice (data-testid="active-hidden-by-filter") surfaces the
    // mismatch with a "Clear filter" action.
    {
      const HIDE_TERM = "homonym";
      const f = HIDE_TERM.toLowerCase();
      const matchesTerm = (q: CatalogueQuestion) =>
        q.question.toLowerCase().includes(f) ||
        q.category.toLowerCase().includes(f) ||
        (q.greekTerm?.toLowerCase().includes(f) ?? false);
      const survivors = catalogue.questions.filter(matchesTerm);
      // Target: a non-zero-rowCount question the filter HIDES.
      const target = catalogue.questions.find(
        (q) => !matchesTerm(q) && q.rowCount > 0,
      );
      check(
        `hidden-selection: a non-zero-rowCount question hidden by "${HIDE_TERM}" exists`,
        !!target,
      );
      check(
        `hidden-selection: "${HIDE_TERM}" still leaves visible survivors (${survivors.length})`,
        survivors.length > 0,
      );
      if (target) {
        console.log(
          `Hidden-selection cold load: /competency?q=${target.id}&f=${HIDE_TERM} (filter hides the chosen question)`,
        );
        await page.goto(
          `${BASE_URL}/competency?q=${encodeURIComponent(target.id)}&f=${encodeURIComponent(HIDE_TERM)}`,
          { waitUntil: "networkidle" },
        );
        guard.assertPageLoaded();
        // Sidebar renders only the survivors — the target is NOT listed.
        await page
          .waitForFunction(
            (expected) =>
              Array.from(
                document.querySelectorAll("button span[title]"),
              ).filter((s) =>
                (s.getAttribute("title") ?? "").includes("result row"),
              ).length === expected,
            survivors.length,
            { timeout: 30000 },
          )
          .catch(() => {});
        const hiddenBadges = await readBadges();
        check(
          `hidden-selection: sidebar shows only the ${survivors.length} survivors`,
          hiddenBadges.length === survivors.length,
          `visible ${hiddenBadges.length}`,
        );
        const targetListed = hiddenBadges.some((r) =>
          r.buttonText.startsWith(target.question),
        );
        check(
          `hidden-selection: chosen question is NOT in the filtered sidebar`,
          !targetListed,
        );
        // Filter box restored from ?f=.
        const inputValue = await page.evaluate(
          () =>
            document.querySelector<HTMLInputElement>('input[type="search"]')
              ?.value ?? null,
        );
        check(
          `hidden-selection: filter box restored to "${HIDE_TERM}"`,
          inputValue === HIDE_TERM,
          `value "${inputValue}"`,
        );
        // The chosen question's results still render on the right.
        await page.waitForFunction(
          () => /query results/i.test(document.body.innerText),
          undefined,
          { timeout: 30000 },
        );
        await page
          .waitForFunction(
            (expected) =>
              document.querySelectorAll("tbody tr").length === expected,
            target.rowCount,
            { timeout: 30000 },
          )
          .catch(() => {});
        const hiddenRows = await page.evaluate(
          () => document.querySelectorAll("tbody tr").length,
        );
        check(
          `hidden-selection ${target.id}: results table rows (${hiddenRows}) equal catalogue rowCount (${target.rowCount})`,
          hiddenRows === target.rowCount,
        );
        const headingShown = await page.evaluate(
          (questionText) => document.body.innerText.includes(questionText),
          target.question,
        );
        check(
          `hidden-selection ${target.id}: question heading rendered despite being filtered out`,
          headingShown,
        );
        // The mismatch notice is shown, with its Clear filter action.
        const notice = await page.evaluate(() => {
          const el = document.querySelector(
            '[data-testid="active-hidden-by-filter"]',
          );
          return el ? (el.textContent ?? "") : null;
        });
        check(
          `hidden-selection: mismatch notice is shown`,
          notice !== null && /hidden by this filter/i.test(notice),
          `notice ${notice === null ? "missing" : `"${notice.slice(0, 80)}"`}`,
        );
        // Clicking "Clear filter" restores the full list, keeps the
        // selection, and removes the notice.
        const cleared = await page.evaluate(() => {
          const btn = Array.from(
            document.querySelectorAll(
              '[data-testid="active-hidden-by-filter"] button',
            ),
          ).find((b) => /clear filter/i.test(b.textContent ?? ""));
          if (!btn) return false;
          (btn as HTMLElement).click();
          return true;
        });
        check(`hidden-selection: Clear filter button clicked`, cleared);
        if (cleared) {
          await page
            .waitForFunction(
              (expected) =>
                Array.from(
                  document.querySelectorAll("button span[title]"),
                ).filter((s) =>
                  (s.getAttribute("title") ?? "").includes("result row"),
                ).length === expected,
              catalogue.questions.length,
              { timeout: 15000 },
            )
            .catch(() => {});
          const after = await page.evaluate(() => ({
            badges: Array.from(
              document.querySelectorAll("button span[title]"),
            ).filter((s) =>
              (s.getAttribute("title") ?? "").includes("result row"),
            ).length,
            notice: !!document.querySelector(
              '[data-testid="active-hidden-by-filter"]',
            ),
            q: new URLSearchParams(window.location.search).get("q"),
            f: new URLSearchParams(window.location.search).get("f"),
          }));
          check(
            `hidden-selection: clearing restores the full list (${after.badges} of ${catalogue.questions.length})`,
            after.badges === catalogue.questions.length,
          );
          check(`hidden-selection: notice removed after clearing`, !after.notice);
          check(
            `hidden-selection: selection kept (q=${target.id}) and f= dropped`,
            after.q === target.id && after.f === null,
            `q=${after.q} f=${after.f}`,
          );
        }
      }
    }

    // ---- Hidden-selection LIVE typing: the same notice must appear when a
    // reader selects a question first and then TYPES a hiding filter into
    // the box (no cold load). This path shares the code with the cold-load
    // case but can regress independently (state update ordering, the
    // replace-navigation on each keystroke). Deleting the typed text (not
    // the Clear button) must remove the notice again.
    {
      const HIDE_TERM = "homonym";
      const f = HIDE_TERM.toLowerCase();
      const matchesTerm = (q: CatalogueQuestion) =>
        q.question.toLowerCase().includes(f) ||
        q.category.toLowerCase().includes(f) ||
        (q.greekTerm?.toLowerCase().includes(f) ?? false);
      const survivors = catalogue.questions.filter(matchesTerm);
      const target = catalogue.questions.find(
        (q) => !matchesTerm(q) && q.rowCount > 0,
      );
      check(
        `live-hide: a non-zero-rowCount question hidden by "${HIDE_TERM}" exists`,
        !!target,
      );
      if (target) {
        console.log(
          `Live-typed hide: select ${target.id}, then type "${HIDE_TERM}" into the filter box`,
        );
        // Fresh unfiltered load, then select the target by clicking it.
        await page.goto(`${BASE_URL}/competency`, { waitUntil: "networkidle" });
        guard.assertPageLoaded();
        await guard.guarded(
          page.waitForFunction(
            () =>
              Array.from(
                document.querySelectorAll("button span[title]"),
              ).some((s) =>
                (s.getAttribute("title") ?? "").includes("result row"),
              ),
            undefined,
            { timeout: 30000 },
          ),
        );
        const clicked = await page.evaluate((questionText) => {
          const btn = Array.from(document.querySelectorAll("button")).find(
            (b) => (b.textContent ?? "").trim().startsWith(questionText),
          );
          if (!btn) return false;
          btn.click();
          return true;
        }, target.question);
        check(`live-hide: target question clicked`, clicked);
        // Its results render, and no notice is shown yet (positive control:
        // the notice's absence before typing proves the later appearance is
        // caused by the typed filter, not a leftover).
        await page.waitForFunction(
          () => /query results/i.test(document.body.innerText),
          undefined,
          { timeout: 30000 },
        );
        await page
          .waitForFunction(
            (expected) =>
              document.querySelectorAll("tbody tr").length === expected,
            target.rowCount,
            { timeout: 30000 },
          )
          .catch(() => {});
        const preRows = await page.evaluate(
          () => document.querySelectorAll("tbody tr").length,
        );
        check(
          `live-hide ${target.id}: results rendered before typing (${preRows} rows)`,
          preRows === target.rowCount,
        );
        const preNotice = await page.evaluate(() =>
          !!document.querySelector('[data-testid="active-hidden-by-filter"]'),
        );
        check(`live-hide: no notice before the filter is typed`, !preNotice);

        // Type the hiding term keystroke-by-keystroke, like a real reader
        // (page.fill sets the value in one shot; per-keystroke typing is
        // what exercises the replace-navigation on every change).
        await page.focus('input[type="search"]');
        await page.keyboard.type(HIDE_TERM, { delay: 40 });

        // Sidebar shrinks to the survivors, target no longer listed.
        await page
          .waitForFunction(
            (expected) =>
              Array.from(
                document.querySelectorAll("button span[title]"),
              ).filter((s) =>
                (s.getAttribute("title") ?? "").includes("result row"),
              ).length === expected,
            survivors.length,
            { timeout: 15000 },
          )
          .catch(() => {});
        const typedBadges = await readBadges();
        check(
          `live-hide: sidebar shrinks to the ${survivors.length} survivors`,
          typedBadges.length === survivors.length,
          `visible ${typedBadges.length}`,
        );
        check(
          `live-hide: chosen question is NOT in the filtered sidebar`,
          !typedBadges.some((r) => r.buttonText.startsWith(target.question)),
        );
        // The notice appears, and the results STAY on screen.
        await page
          .waitForFunction(
            () =>
              !!document.querySelector(
                '[data-testid="active-hidden-by-filter"]',
              ),
            undefined,
            { timeout: 15000 },
          )
          .catch(() => {});
        const typedNotice = await page.evaluate(() => {
          const el = document.querySelector(
            '[data-testid="active-hidden-by-filter"]',
          );
          return el ? (el.textContent ?? "") : null;
        });
        check(
          `live-hide: mismatch notice shown after typing`,
          typedNotice !== null && /hidden by this filter/i.test(typedNotice),
          `notice ${typedNotice === null ? "missing" : `"${typedNotice.slice(0, 80)}"`}`,
        );
        const typedState = await page.evaluate(() => ({
          rows: document.querySelectorAll("tbody tr").length,
          q: new URLSearchParams(window.location.search).get("q"),
          f: new URLSearchParams(window.location.search).get("f"),
        }));
        check(
          `live-hide ${target.id}: results table stays (${typedState.rows} rows)`,
          typedState.rows === target.rowCount,
        );
        check(
          `live-hide: URL carries q=${target.id} and f=${HIDE_TERM}`,
          typedState.q === target.id && typedState.f === HIDE_TERM,
          `q=${typedState.q} f=${typedState.f}`,
        );

        // Delete the typed text with backspaces (NOT the Clear button):
        // the notice must disappear, the full list must return, and the
        // selection must be kept.
        await page.focus('input[type="search"]');
        for (let i = 0; i < HIDE_TERM.length; i++) {
          await page.keyboard.press("Backspace");
        }
        await page
          .waitForFunction(
            (expected) =>
              Array.from(
                document.querySelectorAll("button span[title]"),
              ).filter((s) =>
                (s.getAttribute("title") ?? "").includes("result row"),
              ).length === expected,
            catalogue.questions.length,
            { timeout: 15000 },
          )
          .catch(() => {});
        const afterDelete = await page.evaluate(() => ({
          badges: Array.from(
            document.querySelectorAll("button span[title]"),
          ).filter((s) =>
            (s.getAttribute("title") ?? "").includes("result row"),
          ).length,
          notice: !!document.querySelector(
            '[data-testid="active-hidden-by-filter"]',
          ),
          rows: document.querySelectorAll("tbody tr").length,
          q: new URLSearchParams(window.location.search).get("q"),
          f: new URLSearchParams(window.location.search).get("f"),
          input:
            document.querySelector<HTMLInputElement>('input[type="search"]')
              ?.value ?? null,
        }));
        check(
          `live-hide: deleting text restores the full list (${afterDelete.badges} of ${catalogue.questions.length})`,
          afterDelete.badges === catalogue.questions.length,
        );
        check(
          `live-hide: notice removed after deleting the text`,
          !afterDelete.notice,
        );
        check(
          `live-hide: filter box empty after deletion`,
          afterDelete.input === "",
          `value "${afterDelete.input}"`,
        );
        check(
          `live-hide: selection kept (q=${target.id}, ${afterDelete.rows} rows) and f= dropped`,
          afterDelete.q === target.id &&
            afterDelete.f === null &&
            afterDelete.rows === target.rowCount,
          `q=${afterDelete.q} f=${afterDelete.f} rows=${afterDelete.rows}`,
        );
      }
    }

    // ---- Back/Forward after Clear filter: the third path to the notice.
    // The notice's explicit "Clear filter" PUSHES a history entry (unlike
    // keystrokes, which replace), and the filter box re-syncs from ?f= on
    // back/forward via an effect. If either regresses, pressing Back after
    // clearing would restore ?f= in the URL but leave the box empty or the
    // notice missing. Select a question, apply a hiding filter via a cold
    // load, click Clear filter, then drive history Back and Forward.
    {
      const HIDE_TERM = "homonym";
      const f = HIDE_TERM.toLowerCase();
      const matchesTerm = (q: CatalogueQuestion) =>
        q.question.toLowerCase().includes(f) ||
        q.category.toLowerCase().includes(f) ||
        (q.greekTerm?.toLowerCase().includes(f) ?? false);
      const survivors = catalogue.questions.filter(matchesTerm);
      const target = catalogue.questions.find(
        (q) => !matchesTerm(q) && q.rowCount > 0,
      );
      check(
        `back-after-clear: a non-zero-rowCount question hidden by "${HIDE_TERM}" exists`,
        !!target,
      );
      if (target) {
        console.log(
          `Back after Clear filter: load /competency?q=${target.id}&f=${HIDE_TERM}, clear, then Back/Forward`,
        );
        const hiddenUrl = `${BASE_URL}/competency?q=${encodeURIComponent(target.id)}&f=${encodeURIComponent(HIDE_TERM)}`;
        // Guard against same-URL goto replacing the history entry (Back
        // would then leave the app entirely): the page currently sits on a
        // different URL from prior phases, but assert it explicitly.
        const beforeUrl = page.url();
        check(
          `back-after-clear: navigation target differs from current URL`,
          beforeUrl !== hiddenUrl,
          `current "${beforeUrl}"`,
        );
        await page.goto(hiddenUrl, { waitUntil: "networkidle" });
        guard.assertPageLoaded();
        // Notice present before clearing (positive control for the Back
        // assertion below).
        await guard.guarded(
          page.waitForFunction(
            () =>
              !!document.querySelector(
                '[data-testid="active-hidden-by-filter"]',
              ),
            undefined,
            { timeout: 30000 },
          ),
        );

        // Click the notice's Clear filter button.
        const cleared = await page.evaluate(() => {
          const btn = Array.from(
            document.querySelectorAll(
              '[data-testid="active-hidden-by-filter"] button',
            ),
          ).find((b) => /clear filter/i.test(b.textContent ?? ""));
          if (!btn) return false;
          (btn as HTMLElement).click();
          return true;
        });
        check(`back-after-clear: Clear filter button clicked`, cleared);
        await page
          .waitForFunction(
            (expected) =>
              Array.from(
                document.querySelectorAll("button span[title]"),
              ).filter((s) =>
                (s.getAttribute("title") ?? "").includes("result row"),
              ).length === expected,
            catalogue.questions.length,
            { timeout: 15000 },
          )
          .catch(() => {});
        const afterClear = await page.evaluate(() => ({
          notice: !!document.querySelector(
            '[data-testid="active-hidden-by-filter"]',
          ),
          f: new URLSearchParams(window.location.search).get("f"),
        }));
        check(
          `back-after-clear: notice gone and f= dropped after clearing`,
          !afterClear.notice && afterClear.f === null,
          `notice=${afterClear.notice} f=${afterClear.f}`,
        );

        // ---- Back: the cleared state was PUSHED, so Back must return to
        // the filtered state and restore the box, the shrunken sidebar,
        // and the notice.
        await page.goBack({ waitUntil: "networkidle" });
        await page
          .waitForFunction(
            (expected) =>
              Array.from(
                document.querySelectorAll("button span[title]"),
              ).filter((s) =>
                (s.getAttribute("title") ?? "").includes("result row"),
              ).length === expected,
            survivors.length,
            { timeout: 15000 },
          )
          .catch(() => {});
        await page
          .waitForFunction(
            () =>
              !!document.querySelector(
                '[data-testid="active-hidden-by-filter"]',
              ),
            undefined,
            { timeout: 15000 },
          )
          .catch(() => {});
        const backState = await page.evaluate(() => ({
          q: new URLSearchParams(window.location.search).get("q"),
          f: new URLSearchParams(window.location.search).get("f"),
          input:
            document.querySelector<HTMLInputElement>('input[type="search"]')
              ?.value ?? null,
          badges: Array.from(
            document.querySelectorAll("button span[title]"),
          ).filter((s) =>
            (s.getAttribute("title") ?? "").includes("result row"),
          ).length,
          notice: (() => {
            const el = document.querySelector(
              '[data-testid="active-hidden-by-filter"]',
            );
            return el ? (el.textContent ?? "") : null;
          })(),
        }));
        check(
          `back-after-clear: Back restores URL q=${target.id} and f=${HIDE_TERM}`,
          backState.q === target.id && backState.f === HIDE_TERM,
          `q=${backState.q} f=${backState.f}`,
        );
        check(
          `back-after-clear: Back restores the filter box to "${HIDE_TERM}"`,
          backState.input === HIDE_TERM,
          `value "${backState.input}"`,
        );
        check(
          `back-after-clear: Back restores the filtered sidebar (${survivors.length} survivors)`,
          backState.badges === survivors.length,
          `visible ${backState.badges}`,
        );
        check(
          `back-after-clear: Back restores the hidden-question notice`,
          backState.notice !== null &&
            /hidden by this filter/i.test(backState.notice),
          `notice ${backState.notice === null ? "missing" : `"${backState.notice.slice(0, 80)}"`}`,
        );

        // ---- Forward: returns to the cleared state — notice gone, full
        // list back, box empty, f= dropped, selection kept.
        await page.goForward({ waitUntil: "networkidle" });
        await page
          .waitForFunction(
            (expected) =>
              Array.from(
                document.querySelectorAll("button span[title]"),
              ).filter((s) =>
                (s.getAttribute("title") ?? "").includes("result row"),
              ).length === expected,
            catalogue.questions.length,
            { timeout: 15000 },
          )
          .catch(() => {});
        const fwdState = await page.evaluate(() => ({
          q: new URLSearchParams(window.location.search).get("q"),
          f: new URLSearchParams(window.location.search).get("f"),
          input:
            document.querySelector<HTMLInputElement>('input[type="search"]')
              ?.value ?? null,
          badges: Array.from(
            document.querySelectorAll("button span[title]"),
          ).filter((s) =>
            (s.getAttribute("title") ?? "").includes("result row"),
          ).length,
          notice: !!document.querySelector(
            '[data-testid="active-hidden-by-filter"]',
          ),
        }));
        check(
          `back-after-clear: Forward removes the notice again`,
          !fwdState.notice,
        );
        check(
          `back-after-clear: Forward restores the full list (${fwdState.badges} of ${catalogue.questions.length}) with an empty box`,
          fwdState.badges === catalogue.questions.length &&
            fwdState.input === "",
          `visible ${fwdState.badges}, value "${fwdState.input}"`,
        );
        check(
          `back-after-clear: Forward keeps q=${target.id} and drops f=`,
          fwdState.q === target.id && fwdState.f === null,
          `q=${fwdState.q} f=${fwdState.f}`,
        );
      }
    }

    // ---- Back/Forward for the passage drill-down panel: opening a
    // subgraph node PUSHES ?focus=, and so does closing the panel (it
    // navigates to the same URL without focus). If the URL-sync
    // regressed, pressing Back after closing would restore ?focus= in
    // the URL without reopening the panel. Select a question with a
    // subgraph, click a node, close the panel, then Back (panel must
    // reopen for the same entity) and Forward (closed again).
    {
      const qid = "stoa-members";
      const q = byId.get(qid);
      check(`focus-back: question ${qid} present in the catalogue`, !!q);
      if (q) {
        console.log(
          `Focus panel Back/Forward: select ${qid}, open a node's panel, close, then Back/Forward`,
        );
        await page.goto(
          `${BASE_URL}/competency?q=${encodeURIComponent(qid)}`,
          { waitUntil: "networkidle" },
        );
        guard.assertPageLoaded();
        // Wait for the subgraph to render its clickable node groups.
        await guard.guarded(
          page.waitForFunction(
            () =>
              document.querySelectorAll(
                'svg[aria-label="Knowledge subgraph"] g[role="button"]',
              ).length > 0,
            undefined,
            { timeout: 30000 },
          ),
        );
        // Positive control: no panel and no ?focus= before the click, so
        // the panel's later presence is caused by the click.
        const preFocus = await page.evaluate((sel) => ({
          focus: new URLSearchParams(window.location.search).get("focus"),
          panel: !!Array.from(document.querySelectorAll(sel)).find((h) =>
            /^Passages naming /.test(h.textContent ?? ""),
          ),
        }), CARD_HEADING_SELECTOR);
        check(
          `focus-back: no panel and no ?focus= before the node click`,
          preFocus.focus === null && !preFocus.panel,
          `focus=${preFocus.focus} panel=${preFocus.panel}`,
        );

        // Click the first subgraph node and record its entity name from
        // its aria-label ("Show source passages for X").
        const clickedName = await page.evaluate(() => {
          const g = document.querySelector<SVGGElement>(
            'svg[aria-label="Knowledge subgraph"] g[role="button"]',
          );
          if (!g) return null;
          const label = g.getAttribute("aria-label") ?? "";
          const m = label.match(/^Show source passages for (.+)$/);
          g.dispatchEvent(
            new MouseEvent("click", { bubbles: true, cancelable: true }),
          );
          return m ? m[1] : null;
        });
        check(
          `focus-back: a subgraph node was clicked and named`,
          !!clickedName,
          `name=${clickedName}`,
        );
        if (clickedName) {
          // Panel opens for THAT entity, and the URL carries ?focus=.
          const panelHeadingFor = (name: string) =>
            page
              .waitForFunction(
                ([n, sel]) =>
                  Array.from(document.querySelectorAll(sel)).some(
                    (h) => (h.textContent ?? "").trim() === `Passages naming ${n}`,
                  ),
                [name, CARD_HEADING_SELECTOR] as const,
                { timeout: 30000 },
              )
              .catch(() => {});
          await panelHeadingFor(clickedName);
          const opened = await page.evaluate(([n, sel]) => ({
            panel: Array.from(document.querySelectorAll(sel)).some(
              (h) => (h.textContent ?? "").trim() === `Passages naming ${n}`,
            ),
            focus: new URLSearchParams(window.location.search).get("focus"),
            q: new URLSearchParams(window.location.search).get("q"),
          }), [clickedName, CARD_HEADING_SELECTOR] as const);
          check(
            `focus-back: panel opened for "${clickedName}"`,
            opened.panel,
          );
          check(
            `focus-back: URL carries focus=${clickedName} (and q=${qid})`,
            opened.focus === clickedName && opened.q === qid,
            `focus=${opened.focus} q=${opened.q}`,
          );

          // Close the panel via its own close button.
          const closed = await page.evaluate(() => {
            const btn = document.querySelector<HTMLButtonElement>(
              'button[aria-label="Close passage panel"]',
            );
            if (!btn) return false;
            btn.click();
            return true;
          });
          check(`focus-back: close button clicked`, closed);
          await page
            .waitForFunction(
              () =>
                new URLSearchParams(window.location.search).get("focus") ===
                null,
              undefined,
              { timeout: 15000 },
            )
            .catch(() => {});
          const afterClose = await page.evaluate(([n, sel]) => ({
            panel: Array.from(document.querySelectorAll(sel)).some(
              (h) => (h.textContent ?? "").trim() === `Passages naming ${n}`,
            ),
            focus: new URLSearchParams(window.location.search).get("focus"),
          }), [clickedName, CARD_HEADING_SELECTOR] as const);
          check(
            `focus-back: panel closed and ?focus= dropped`,
            !afterClose.panel && afterClose.focus === null,
            `panel=${afterClose.panel} focus=${afterClose.focus}`,
          );

          // ---- Back: the closed state was PUSHED, so Back must restore
          // ?focus= AND reopen the panel for the same entity.
          await page.goBack({ waitUntil: "networkidle" });
          await panelHeadingFor(clickedName);
          const backState = await page.evaluate(([n, sel]) => ({
            panel: Array.from(document.querySelectorAll(sel)).some(
              (h) => (h.textContent ?? "").trim() === `Passages naming ${n}`,
            ),
            focus: new URLSearchParams(window.location.search).get("focus"),
            q: new URLSearchParams(window.location.search).get("q"),
          }), [clickedName, CARD_HEADING_SELECTOR] as const);
          check(
            `focus-back: Back restores focus=${clickedName} in the URL`,
            backState.focus === clickedName && backState.q === qid,
            `focus=${backState.focus} q=${backState.q}`,
          );
          check(
            `focus-back: Back REOPENS the panel for "${clickedName}"`,
            backState.panel,
          );

          // ---- Forward: returns to the closed state — panel gone,
          // ?focus= dropped, selection kept.
          await page.goForward({ waitUntil: "networkidle" });
          await page
            .waitForFunction(
              () =>
                new URLSearchParams(window.location.search).get("focus") ===
                null,
              undefined,
              { timeout: 15000 },
            )
            .catch(() => {});
          const fwdState = await page.evaluate(([n, sel]) => ({
            panel: Array.from(document.querySelectorAll(sel)).some(
              (h) => (h.textContent ?? "").trim() === `Passages naming ${n}`,
            ),
            focus: new URLSearchParams(window.location.search).get("focus"),
            q: new URLSearchParams(window.location.search).get("q"),
          }), [clickedName, CARD_HEADING_SELECTOR] as const);
          check(
            `focus-back: Forward closes the panel again and drops ?focus=`,
            !fwdState.panel && fwdState.focus === null,
            `panel=${fwdState.panel} focus=${fwdState.focus}`,
          );
          check(
            `focus-back: Forward keeps q=${qid}`,
            fwdState.q === qid,
            `q=${fwdState.q}`,
          );
        }
      }
    }

    for (const qid of QUESTION_IDS) {
      const q = byId.get(qid);
      console.log(`Question ${qid}: badge must match the results table`);
      check(`${qid}: present in the catalogue`, !!q);
      if (!q) continue;

      // Fresh load per question so one selection cannot taint the next.
      await page.goto(`${BASE_URL}/competency`, { waitUntil: "networkidle" });
      guard.assertPageLoaded();
      // Wait for the sidebar to render (any button with a badge span whose
      // title carries the "result row" tooltip).
      await guard.guarded(
        page.waitForFunction(
          () =>
            Array.from(document.querySelectorAll("button span[title]")).some(
              (s) => (s.getAttribute("title") ?? "").includes("result row"),
            ),
          undefined,
          { timeout: 30000 },
        ),
      );

      // Read the rendered badge for this question by matching the button
      // whose text starts with the question's own wording.
      const badge = await page.evaluate((questionText) => {
        const btn = Array.from(document.querySelectorAll("button")).find((b) =>
          (b.textContent ?? "").trim().startsWith(questionText),
        );
        if (!btn) return null;
        const span = btn.querySelector("span[title]");
        const title = span?.getAttribute("title") ?? "";
        if (!title.includes("result row")) return null;
        return {
          text: (span?.textContent ?? "").trim(),
          title,
        };
      }, q.question);
      check(
        `${qid}: sidebar badge found`,
        badge !== null,
        `question text "${q.question}"`,
      );
      if (!badge) continue;

      const badgeCount = Number(badge.text);
      check(
        `${qid}: badge is a number`,
        Number.isInteger(badgeCount),
        `badge text "${badge.text}"`,
      );
      check(
        `${qid}: badge tooltip agrees with the badge number`,
        badge.title.startsWith(`${badgeCount} result row`),
        `title "${badge.title}"`,
      );
      check(
        `${qid}: badge is non-zero for a known-rich question`,
        badgeCount > 0,
      );
      check(
        `${qid}: badge matches the catalogue rowCount`,
        badgeCount === q.rowCount,
        `badge=${badgeCount} catalogue=${q.rowCount}`,
      );

      // Click the question and wait for its results to render.
      const clicked = await page.evaluate((questionText) => {
        const btn = Array.from(document.querySelectorAll("button")).find((b) =>
          (b.textContent ?? "").trim().startsWith(questionText),
        );
        if (!btn) return false;
        btn.click();
        return true;
      }, q.question);
      check(`${qid}: question button clicked`, clicked);

      // The Query Results panel renders the "N rows" counter and, when
      // rows exist, the results table. The heading is CSS-uppercased, so
      // match innerText case-insensitively.
      await page.waitForFunction(
        () => /query results/i.test(document.body.innerText),
        undefined,
        { timeout: 30000 },
      );
      // Wait for the table rows to actually be in the DOM (the panel
      // heading can render a frame before the tbody).
      await page.waitForFunction(
        () => document.querySelectorAll("tbody tr").length > 0,
        undefined,
        { timeout: 30000 },
      );
      await page.waitForTimeout(300);

      const table = await page.evaluate(() => {
        const rows = document.querySelectorAll("tbody tr").length;
        // The counter is the "N row(s)" text next to the Query Results
        // heading; grab it from the body text.
        const m = document.body.innerText.match(/(\d+)\s+rows?\b/);
        return { rows, counter: m ? Number(m[1]) : null };
      });
      check(
        `${qid}: results table row count (${table.rows}) equals the badge (${badgeCount})`,
        table.rows === badgeCount,
        `question "${q.question}"`,
      );
      check(
        `${qid}: "N rows" counter equals the badge`,
        table.counter === badgeCount,
        `counter=${table.counter} badge=${badgeCount}`,
      );

      // URL must now carry q= for this question, confirming we asserted
      // against the intended question's table, not a leftover selection.
      const urlQ = await page.evaluate(() =>
        new URLSearchParams(window.location.search).get("q"),
      );
      check(`${qid}: URL carries q=${qid}`, urlQ === qid, `q=${urlQ}`);
    }
  } finally {
    await browser.close();
  }

  if (failures > 0) {
    console.error(`\n${failures} check(s) failed`);
    process.exit(1);
  }
  console.log("\nAll competency badge checks passed");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
