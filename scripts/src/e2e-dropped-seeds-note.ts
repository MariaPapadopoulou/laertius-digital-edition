/// <reference lib="dom" />
/* Real-browser check: the "Also discussed, but without a Life of their own"
 * dropped-seeds note on /competency actually SHOWS UP for readers.
 *
 * validate-competency-index-links pins the source level (the route ships
 * droppedSeeds and competency.tsx renders the note), but a CSS/layout
 * regression, a rendering error boundary, or a client-side data-shape
 * mismatch could still hide the note while every source-level pin stays
 * green. This closes that gap for the homonymy question:
 *
 * 1. API contract: /api/competency/questions/homonymy-proper-names must
 *    ship a non-empty droppedSeeds list containing both pinned names
 *    (Zeno of Sidon, Diogenes Laertius) with real Greek-script grc forms.
 * 2. Rendered DOM: load /competency?q=homonymy-proper-names in headless
 *    Chromium and assert the note element is actually VISIBLE (computed
 *    display/visibility/opacity showing, non-degenerate bounding box on
 *    the page), contains the note text "without a Life of their own",
 *    and shows every dropped seed's English name AND its Greek form
 *    (each seed span and its grc span individually visible, not merely
 *    present in the DOM).
 * 3. Controls: a positive control fails the run if zero seeds were
 *    verified visible (vacuous pass), and a negative control proves the
 *    Greek-script test can fire.
 * 4. In-session switching: in the SAME browser session (SPA navigation via
 *    the sidebar, no reload — a reload would reset the very client state
 *    that could leak), switch from the exception question to two
 *    no-exception questions and assert the note DISAPPEARS each time, then
 *    switch back and assert it reappears. Catches a purely client-side bug
 *    in competency.tsx (e.g. a fallback rendering the note from stale or
 *    shared state) that the API sweep and cold-load contrast check miss.
 * 5. Inverse contrast check: a question ABSENT from KNOWN_DROPPED_SEEDS
 *    (stoa-members) must ship an empty droppedSeeds payload and render
 *    NO element containing the note phrase anywhere on the page — a
 *    data-shape bug or bad droppedSeeds fallback that mints a stray
 *    (possibly empty/wrong-names) note fails loudly.
 *
 * The in-session switching layer (4) is proven non-vacuous by
 * dryrun-dropped-seeds-note-leak.ts, which injects a leaky client-side
 * droppedSeeds cache into competency.tsx, requires the "note is gone"
 * checks here to FAIL, then reverts and requires a clean pass.
 *
 * Requirements: api-server and laertius web workflows running, and the
 * headless Chromium shell installed (same setup as e2e-subgraph-legend):
 *   PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright \
 *     node scripts/node_modules/playwright-core/cli.js install chromium-headless-shell
 */

// playwright-core resolves its browser registry at import time from
// PLAYWRIGHT_BROWSERS_PATH; pick the candidate that actually holds a
// chromium install BEFORE importing it.
import "./lib/playwright-browsers-path";
import { PAGE_HEADING_SELECTOR } from "./lib/card-headings";

const { chromium } = await import("playwright-core");
const { attachPageGuard } = await import("./lib/e2e-page-guard");

const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:80";

const QUESTION_ID = "homonymy-proper-names";
// Inverse contrast question: NOT in KNOWN_DROPPED_SEEDS, so it must ship an
// empty droppedSeeds payload and render NO dropped-seeds note at all.
const CONTRAST_QUESTION_ID = "stoa-members";
// The pinned exception list (KNOWN_DROPPED_SEEDS in
// artifacts/api-server/src/lib/competency.ts) — both names must appear.
const EXPECTED_NAMES = ["Zeno of Sidon", "Diogenes Laertius"] as const;
const NOTE_PHRASE = "without a Life of their own";

// Greek letters (including the polytonic Extended block) a real grc form
// must contain; rejects empty strings, whitespace, and Latin text.
const GREEK_RE = /[\u0370-\u03FF\u1F00-\u1FFF]/;

let failures = 0;
function check(label: string, ok: boolean, detail?: string) {
  if (ok) {
    console.log(`  ok: ${label}`);
  } else {
    failures++;
    console.error(`  FAIL: ${label}${detail ? ` (${detail})` : ""}`);
  }
}

interface DroppedSeed {
  en: string;
  grc?: string;
}

async function main() {
  console.log(`Question ${QUESTION_ID}: dropped-seeds note must be visible`);

  // --- Layer 1: the API payload the note consumes ---
  const res = await fetch(`${BASE_URL}/api/competency/questions/${QUESTION_ID}`);
  check("API responds 200", res.ok, `${res.status}`);
  if (!res.ok) process.exit(1);
  const data = (await res.json()) as { droppedSeeds?: DroppedSeed[] };
  const seeds = data.droppedSeeds ?? [];
  check(`droppedSeeds payload is non-empty (${seeds.length})`, seeds.length > 0);
  for (const name of EXPECTED_NAMES) {
    const seed = seeds.find((s) => s.en === name);
    check(`payload includes "${name}"`, !!seed);
    check(
      `payload "${name}" carries a real Greek grc form`,
      !!seed?.grc && GREEK_RE.test(seed.grc),
      `grc=${JSON.stringify(seed?.grc ?? null)}`,
    );
  }
  if (failures > 0) process.exit(1);

  // --- Layer 2: the rendered note in a real browser ---
  const browser = await chromium.launch({ headless: true });
  let seedsVerified = 0;
  try {
    const page = await browser.newPage({
      viewport: { width: 1280, height: 900 },
    });
    const guard = attachPageGuard(page);
    await page.goto(`${BASE_URL}/competency?q=${QUESTION_ID}`, {
      waitUntil: "networkidle",
    });
    guard.assertPageLoaded();
    // The note renders right below the subgraph card once the question
    // result loads.
    await guard.guarded(
      page.waitForSelector('svg[aria-label="Knowledge subgraph"]', {
        timeout: 30000,
      }),
    );
    await page.waitForTimeout(300);

    const result = await page.evaluate(
      (args: { phrase: string; seeds: DroppedSeed[] }) => {
        // NOTE: no named helper functions in this in-page block; tsx/esbuild
        // wraps them with a __name helper missing in the browser context.
        // Visibility test inlined per element (no helper functions in this
        // in-page block — tsx/esbuild would wrap them with a __name helper
        // that does not exist in the browser context).
        const note = Array.from(document.querySelectorAll("p")).find((p) =>
          (p.textContent ?? "").includes(args.phrase),
        );
        if (!note)
          return {
            noteFound: false as const,
            noteVisible: false,
            noteText: "",
            why: "no <p> containing the note phrase",
            seeds: [],
          };
        const noteText = (note.textContent ?? "").trim();
        const noteRect = note.getBoundingClientRect();
        const noteStyle = getComputedStyle(note);
        const noteVisible =
          noteStyle.display !== "none" &&
          noteStyle.visibility !== "hidden" &&
          parseFloat(noteStyle.opacity || "1") > 0.05 &&
          noteRect.width > 1 &&
          noteRect.height > 1 &&
          noteRect.bottom > 0 &&
          noteRect.right > 0 &&
          noteRect.top < window.innerHeight * 4 &&
          noteRect.left < window.innerWidth;
        const seedResults = args.seeds.map((seed) => {
          // Each dropped seed renders as a <span> child whose text starts
          // with the English name; the grc form sits in a nested span.
          const span = Array.from(note.querySelectorAll("span")).find((el) =>
            (el.textContent ?? "").includes(seed.en),
          );
          if (!span)
            return {
              en: seed.en,
              enVisible: false,
              grcShown: null as string | null,
              grcVisible: false,
              why: "seed span not found in the note",
            };
          const spanRect = span.getBoundingClientRect();
          const spanStyle = getComputedStyle(span);
          const enVisible =
            spanStyle.display !== "none" &&
            spanStyle.visibility !== "hidden" &&
            parseFloat(spanStyle.opacity || "1") > 0.05 &&
            spanRect.width > 1 &&
            spanRect.height > 1 &&
            spanRect.bottom > 0 &&
            spanRect.right > 0 &&
            spanRect.top < window.innerHeight * 4 &&
            spanRect.left < window.innerWidth;
          const grcEl = seed.grc
            ? Array.from(span.querySelectorAll("span")).find((el) =>
                (el.textContent ?? "").includes(seed.grc as string),
              ) ?? null
            : null;
          const grcShown = grcEl ? (grcEl.textContent ?? "").trim() : null;
          let grcVisible = false;
          if (grcEl) {
            const gr = grcEl.getBoundingClientRect();
            const gs = getComputedStyle(grcEl);
            grcVisible =
              gs.display !== "none" &&
              gs.visibility !== "hidden" &&
              parseFloat(gs.opacity || "1") > 0.05 &&
              gr.width > 1 &&
              gr.height > 1 &&
              gr.bottom > 0 &&
              gr.right > 0 &&
              gr.top < window.innerHeight * 4 &&
              gr.left < window.innerWidth;
          }
          return { en: seed.en, enVisible, grcShown, grcVisible, why: "" };
        });
        return {
          noteFound: true as const,
          noteVisible,
          noteText,
          why: `display=${noteStyle.display} visibility=${noteStyle.visibility} opacity=${noteStyle.opacity} rect=${Math.round(noteRect.width)}x${Math.round(noteRect.height)}@${Math.round(noteRect.left)},${Math.round(noteRect.top)}`,
          seeds: seedResults,
        };
      },
      { phrase: NOTE_PHRASE, seeds },
    );

    check("note element rendered", result.noteFound, result.why);
    if (!result.noteFound) process.exit(1);
    check("note is visible (not hidden/collapsed/clipped)", result.noteVisible, result.why);
    check(
      `note is non-empty and carries the phrase "${NOTE_PHRASE}"`,
      result.noteText.includes(NOTE_PHRASE) && result.noteText.length > NOTE_PHRASE.length,
      `text="${result.noteText.slice(0, 120)}"`,
    );

    for (const s of result.seeds) {
      const expected = seeds.find((x) => x.en === s.en);
      check(`note shows "${s.en}" visibly`, s.enVisible, s.why);
      check(
        `note shows the Greek form for "${s.en}" (${expected?.grc}) visibly`,
        !!s.grcShown &&
          GREEK_RE.test(s.grcShown) &&
          s.grcShown.includes(expected?.grc ?? "\u0000") &&
          s.grcVisible,
        `rendered ${JSON.stringify(s.grcShown)}`,
      );
      if (s.enVisible && s.grcVisible) seedsVerified++;
    }

    // --- Layer 3: in-session switching must clear the note ---
    // A purely client-side bug in competency.tsx (a fallback rendering the
    // note from stale/shared state when switching questions) could show a
    // stray note on another question page without failing the API sweep or
    // the cold-load contrast check below. Switch questions via the sidebar
    // (SPA navigation, NO reload — a reload resets the very state that
    // could leak) and assert the note disappears, then reappears when
    // switching back.
    console.log("\nIn-session switching: note must clear on other questions");
    const catRes = await fetch(`${BASE_URL}/api/competency/questions`);
    check(
      "catalogue responds 200 (for switching)",
      catRes.ok,
      `${catRes.status}`,
    );
    if (!catRes.ok) process.exit(1);
    const allQuestions = (
      (await catRes.json()) as {
        questions: { id: string; question: string }[];
      }
    ).questions;
    const byId = new Map(allQuestions.map((q) => [q.id, q]));
    const exceptionQ = byId.get(QUESTION_ID);
    const secondNoExceptionId = allQuestions.find(
      (q) => q.id !== QUESTION_ID && q.id !== CONTRAST_QUESTION_ID,
    )?.id;
    check(
      "found a second no-exception question to switch to",
      !!secondNoExceptionId,
      secondNoExceptionId,
    );
    const switchTargets = [CONTRAST_QUESTION_ID, secondNoExceptionId].filter(
      (x): x is string => !!x,
    );

    // Marker proving each navigation stays client-side: a full reload would
    // wipe it and make the "stale state cleared" checks vacuous.
    await page.evaluate(() => {
      (window as unknown as Record<string, unknown>).__e2eSpaMarker = "alive";
    });

    for (const targetId of switchTargets) {
      const target = byId.get(targetId);
      check(`catalogue lists "${targetId}"`, !!target);
      if (!target) continue;
      const btn = page
        .locator("button", { hasText: target.question })
        .first();
      await guard.guarded(btn.click({ timeout: 15000 }));
      // Wait until the results header shows the NEW question, so an absent
      // note means "cleared", not "old page still up".
      await guard.guarded(
        page.waitForFunction(
          ([q, sel]: readonly [string, string]) =>
            Array.from(document.querySelectorAll(sel)).some((h) =>
              (h.textContent ?? "").includes(q),
            ),
          [target.question, PAGE_HEADING_SELECTOR] as const,
          { timeout: 30000 },
        ),
      );
      await guard.guarded(
        page.waitForSelector('svg[aria-label="Knowledge subgraph"]', {
          timeout: 30000,
        }),
      );
      await page.waitForTimeout(400);
      const sw = await page.evaluate((phrase: string) => {
        // No helper functions in this in-page block (tsx __name pitfall).
        const offenders = Array.from(document.querySelectorAll("*"))
          .filter(
            (el) =>
              el.children.length === 0 &&
              (el.textContent ?? "").includes(phrase),
          )
          .map((el) => (el.textContent ?? "").trim().slice(0, 120));
        return {
          spaMarkerIntact:
            (window as unknown as Record<string, unknown>).__e2eSpaMarker ===
            "alive",
          bodyHasPhrase: (document.body?.textContent ?? "").includes(phrase),
          offenders,
        };
      }, NOTE_PHRASE);
      check(
        `switch to "${targetId}" stayed client-side (SPA marker intact)`,
        sw.spaMarkerIntact,
      );
      check(
        `after switching to "${targetId}" the note is gone`,
        !sw.bodyHasPhrase && sw.offenders.length === 0,
        `offenders=${JSON.stringify(sw.offenders)}`,
      );
    }

    // Positive control for the switching layer: switching BACK to the
    // exception question in the same session must re-render the note —
    // otherwise in-session rendering could be broken and the disappearance
    // checks above would pass vacuously.
    check("catalogue lists the exception question", !!exceptionQ);
    if (exceptionQ) {
      const backBtn = page
        .locator("button", { hasText: exceptionQ.question })
        .first();
      await guard.guarded(backBtn.click({ timeout: 15000 }));
      await guard.guarded(
        page.waitForFunction(
          (phrase: string) =>
            (document.body?.textContent ?? "").includes(phrase),
          NOTE_PHRASE,
          { timeout: 30000 },
        ),
      );
      const back = await page.evaluate((phrase: string) => {
        // No helper functions in this in-page block (tsx __name pitfall).
        const note = Array.from(document.querySelectorAll("p")).find((p) =>
          (p.textContent ?? "").includes(phrase),
        );
        return {
          spaMarkerIntact:
            (window as unknown as Record<string, unknown>).__e2eSpaMarker ===
            "alive",
          noteText: note ? (note.textContent ?? "").trim() : null,
        };
      }, NOTE_PHRASE);
      check(
        "switch back stayed client-side (SPA marker intact)",
        back.spaMarkerIntact,
      );
      check(
        "note reappears with both names after switching back",
        !!back.noteText &&
          EXPECTED_NAMES.every((n) => (back.noteText as string).includes(n)),
        `text=${JSON.stringify(back.noteText?.slice(0, 120) ?? null)}`,
      );
    }

    // --- Layer 4: inverse contrast — a no-exception question must NOT
    // render the note anywhere ---
    console.log(
      `\nContrast question ${CONTRAST_QUESTION_ID}: note must NOT appear`,
    );
    const cRes = await fetch(
      `${BASE_URL}/api/competency/questions/${CONTRAST_QUESTION_ID}`,
    );
    check("contrast API responds 200", cRes.ok, `${cRes.status}`);
    if (cRes.ok) {
      const cData = (await cRes.json()) as { droppedSeeds?: DroppedSeed[] };
      const cSeeds = cData.droppedSeeds ?? [];
      check(
        `contrast droppedSeeds payload is empty (got ${cSeeds.length})`,
        cSeeds.length === 0,
        JSON.stringify(cSeeds),
      );
    }

    // API-level sweep: EVERY catalogue question other than the pinned
    // exception must ship an empty droppedSeeds payload.
    const listRes = await fetch(`${BASE_URL}/api/competency/questions`);
    check("questions catalogue responds 200", listRes.ok, `${listRes.status}`);
    if (listRes.ok) {
      const catalogue = ((await listRes.json()) as {
        questions: { id: string }[];
      }).questions;
      check(
        `catalogue lists multiple questions (${catalogue.length})`,
        catalogue.length > 1,
      );
      let sweepChecked = 0;
      for (const q of catalogue) {
        if (q.id === QUESTION_ID) continue;
        const r = await fetch(
          `${BASE_URL}/api/competency/questions/${q.id}`,
        );
        const d = r.ok
          ? ((await r.json()) as { droppedSeeds?: DroppedSeed[] })
          : null;
        // The route omits the key entirely for questions without a pinned
        // exception; absent or [] both mean "no note".
        const n = d?.droppedSeeds?.length ?? 0;
        if (!r.ok || n !== 0) {
          check(
            `question "${q.id}" ships no droppedSeeds`,
            false,
            r.ok ? JSON.stringify(d?.droppedSeeds) : `HTTP ${r.status}`,
          );
        } else {
          sweepChecked++;
        }
      }
      check(
        `sweep verified ${sweepChecked} no-exception question(s) with empty droppedSeeds`,
        sweepChecked > 0,
      );
    }

    const cPage = await browser.newPage({
      viewport: { width: 1280, height: 900 },
    });
    const guard2 = attachPageGuard(cPage);
    await cPage.goto(`${BASE_URL}/competency?q=${CONTRAST_QUESTION_ID}`, {
      waitUntil: "networkidle",
    });
    guard2.assertPageLoaded();
    // Wait for the question result to fully render (same readiness signal
    // as the positive case) so an absent note means "not rendered", not
    // "not loaded yet".
    await guard2.guarded(
      cPage.waitForSelector('svg[aria-label="Knowledge subgraph"]', {
        timeout: 30000,
      }),
    );
    await cPage.waitForTimeout(300);
    const contrast = await cPage.evaluate((phrase: string) => {
      // No helper functions in this in-page block (tsx __name pitfall).
      const bodyText = document.body?.textContent ?? "";
      const offenders = Array.from(document.querySelectorAll("*"))
        .filter(
          (el) =>
            el.children.length === 0 &&
            (el.textContent ?? "").includes(phrase),
        )
        .map((el) => (el.textContent ?? "").trim().slice(0, 120));
      return {
        pageLoaded: bodyText.trim().length > 100,
        phraseInBody: bodyText.includes(phrase),
        offenders,
      };
    }, NOTE_PHRASE);
    await cPage.close();
    // Positive control for the contrast page itself: the page actually
    // rendered content, so an absent phrase is meaningful.
    check("contrast page rendered real content", contrast.pageLoaded);
    check(
      `no element on ${CONTRAST_QUESTION_ID} contains "${NOTE_PHRASE}"`,
      !contrast.phraseInBody && contrast.offenders.length === 0,
      `offenders=${JSON.stringify(contrast.offenders)}`,
    );
  } finally {
    await browser.close();
  }

  // Positive control: the run must have actually verified visible seeds,
  // otherwise the per-seed loop went vacuous.
  check(
    `verified ${seedsVerified} dropped seed(s) visible with Greek (must be ${EXPECTED_NAMES.length})`,
    seedsVerified >= EXPECTED_NAMES.length,
  );
  // Negative control: the Greek-script test itself must be able to fire.
  check(
    "negative control: a Latin-only string is not a real Greek form",
    !GREEK_RE.test("Zeno of Sidon"),
  );

  if (failures > 0) {
    console.error(`\n${failures} check(s) FAILED`);
    process.exit(1);
  }
  console.log("\nAll dropped-seeds note visibility checks passed");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
