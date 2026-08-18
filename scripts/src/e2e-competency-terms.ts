/// <reference lib="dom" />
// The in-page callbacks (page.evaluate / waitForFunction) run in the
// browser, so this Node-side script needs the DOM lib for their types.
//
// Real-browser check that the bilingual vocabulary panel (Zone C, the
// "Entities" card on /competency) really shows a Greek form next to each
// philosopher and sage name. The Greek comes from greekNameSpec in the
// API's competency route (routes/competency.ts); a regression in that
// lookup would silently render an English-only panel while every other
// check stays green. Two layers of defence:
//
// For each checked question (stoa-members and homonymy-proper-names):
// 1. API contract: fetch /api/competency/questions/:id and assert the
//    terms payload contains at least one philosopher/sage term and that
//    EVERY philosopher/sage term carries a non-empty grc containing real
//    Greek letters (not Latin text or an empty string). The same shape
//    is pinned for school terms: every school term except the
//    "Unaffiliated" bucket must carry a real Greek form (the curated
//    Greek school names in greek-names.ts), and no school label may be
//    swallowed by the doctrine bucket (school and doctrine en sets must
//    be disjoint).
// 2. Rendered DOM: load /competency?q=<id>, wait for the Entities card,
//    and for every philosopher/sage term assert its Greek form is
//    rendered in the card, and that the term's own chip row (the link
//    with the English name) is immediately followed by that Greek form.
//    School chips render as plain (non-link) pills; each school term's
//    pill must contain its Greek form right after the English name.
//    Every rendered Greek span must also be actually VISIBLE (computed
//    display/visibility/opacity showing plus a non-degenerate bounding
//    box near the page, following e2e-subgraph-legend.ts), so a CSS
//    regression hiding the grc spans cannot pass on DOM presence alone.
//    Positive control: the run counts visible Greek chips and fails if
//    it never saw one.
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

// Question ids to verify. stoa-members yields a compact all-philosopher
// roster; homonymy-proper-names mixes sages, philosophers, schools,
// works, and persons; born-in-athens ships the grc-carrying PLACE chip
// ("Athens" / Ἀθῆναι, projected as its ?birthplace column) so the place
// branch below is exercised by a real question. An English-only
// regression cannot hide behind any of these shapes.
const QUESTION_IDS = [
  "stoa-members",
  "homonymy-proper-names",
  "born-in-athens",
] as const;

// Greek letters (including the polytonic Extended block) that a real grc
// form must contain; rejects empty strings, whitespace, and Latin text.
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

interface Term {
  en: string;
  grc?: string;
  type: string;
  firstId?: string;
}

// Extra chip types the Entities card also renders bilingually. Terms of
// these types legitimately lacking grc (e.g. most catalogued work titles)
// are skipped, not failed; every grc-carrying one must render its Greek
// visibly, exactly like the philosopher/sage chips.
const EXTRA_TYPES = ["place", "work", "person"] as const;

async function main() {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({
      viewport: { width: 1280, height: 900 },
    });
    // Fail fast with the failing URL/status instead of an opaque selector
    // timeout when the site itself fails to boot.
    const guard = attachPageGuard(page);

    // Positive control: count Greek chip spans confirmed VISIBLE across
    // the run; if zero, every visibility check went vacuous and the run
    // must fail. Also counted per extra type so the place/work/person
    // coverage cannot go vacuous where the payload ships such terms.
    let visibleGreekChips = 0;
    const visibleByType: Record<string, number> = {};
    const shippedGrcByType: Record<string, number> = {};

    for (const qid of QUESTION_IDS) {
      console.log(`Question ${qid}: philosopher/sage terms must carry Greek`);

      // --- Layer 1: the API payload ---
      const res = await fetch(`${BASE_URL}/api/competency/questions/${qid}`);
      check(`${qid}: API responds 200`, res.ok, `${res.status}`);
      if (!res.ok) continue;
      const data = (await res.json()) as { terms: Term[] };

      const nameTerms = data.terms.filter(
        (t) => t.type === "philosopher" || t.type === "sage",
      );
      check(
        `${qid}: has philosopher/sage terms (${nameTerms.length})`,
        nameTerms.length > 0,
      );

      const missing = nameTerms.filter(
        (t) => !t.grc || !GREEK_RE.test(t.grc),
      );
      check(
        `${qid}: every philosopher/sage term has a real Greek form`,
        missing.length === 0,
        `missing grc for: ${missing.map((t) => t.en).join(", ")}`,
      );

      // --- School terms: same bilingual contract ---
      const schoolTerms = data.terms.filter((t) => t.type === "school");
      check(
        `${qid}: has school terms (${schoolTerms.length})`,
        schoolTerms.length > 0,
      );
      const schoolMissing = schoolTerms.filter(
        (t) => t.en !== "Unaffiliated" && (!t.grc || !GREEK_RE.test(t.grc)),
      );
      check(
        `${qid}: every school term (except Unaffiliated) has a real Greek form`,
        schoolMissing.length === 0,
        `missing grc for: ${schoolMissing.map((t) => t.en).join(", ")}`,
      );

      // The doctrine bucket must never swallow a school: no en may ship
      // under both types (a movement label misclassified as a doctrine
      // would appear here as a duplicate or a doctrine-only school name).
      const doctrineEns = new Set(
        data.terms.filter((t) => t.type === "doctrine").map((t) => t.en),
      );
      const swallowed = schoolTerms.filter((t) => doctrineEns.has(t.en));
      check(
        `${qid}: no school label doubles as a doctrine chip`,
        swallowed.length === 0,
        `school ens also typed doctrine: ${swallowed.map((t) => t.en).join(", ")}`,
      );

      // --- Place/work/person terms: every grc-carrying one must render
      // its Greek visibly too. Terms of these types lacking grc are
      // legitimate (uncurated work titles, formless person names) and
      // are skipped, not failed — but every grc the payload DOES ship
      // must contain real Greek letters, and homonymy-proper-names is
      // known to ship grc-carrying person AND work terms, so the check
      // cannot go vacuous.
      const extraGrcTerms = data.terms.filter(
        (t) =>
          (EXTRA_TYPES as readonly string[]).includes(t.type) && !!t.grc,
      );
      for (const t of extraGrcTerms) {
        shippedGrcByType[t.type] = (shippedGrcByType[t.type] ?? 0) + 1;
      }
      const extraBadGrc = extraGrcTerms.filter((t) => !GREEK_RE.test(t.grc!));
      check(
        `${qid}: every grc-carrying place/work/person term has real Greek letters (${extraGrcTerms.length} checked)`,
        extraBadGrc.length === 0,
        `bogus grc for: ${extraBadGrc.map((t) => t.en).join(", ")}`,
      );

      // Homonym rosters: the frontend groups person terms sharing a
      // Greek form under ONE group header showing that form, hiding the
      // per-chip Greek span. Compute the same grouping here so the DOM
      // check knows where each term's Greek must be visible.
      const personGrcCounts = new Map<string, number>();
      for (const t of data.terms) {
        if (t.type === "person" && t.grc) {
          personGrcCounts.set(t.grc, (personGrcCounts.get(t.grc) ?? 0) + 1);
        }
      }
      const extraChecked = extraGrcTerms.map((t) => ({
        en: t.en,
        grc: t.grc!,
        type: t.type,
        grouped:
          t.type === "person" && (personGrcCounts.get(t.grc!) ?? 0) > 1,
      }));

      // --- Layer 2: the rendered Entities card ---
      await page.goto(`${BASE_URL}/competency?q=${qid}`, {
        waitUntil: "networkidle",
      });
      guard.assertPageLoaded();
      // Wait for the Entities card heading to render (CSS-uppercased,
      // so match the body text case-insensitively) and for at least one
      // term chip to be in the DOM.
      await guard.guarded(
        page.waitForFunction(
          () => /entities/i.test(document.body.innerText),
          undefined,
          { timeout: 30000 },
        ),
      );
      await page.waitForTimeout(300);

      // For each expected term, find its chip (the Link rendered as an
      // <a> whose exact text is the English name, inside the Entities
      // card) and read the sibling Greek span next to it.
      const rendered = await page.evaluate((expected: {
        linkTerms: Term[];
        schoolTerms: Term[];
        extraTerms: Array<{
          en: string;
          grc: string;
          type: string;
          grouped: boolean;
        }>;
        cardHeadingSel: string;
      }) => {
        // NOTE: no named helper functions or arrow consts in this in-page
        // block; tsx/esbuild wraps them with a __name helper missing in the
        // browser context. Visibility of the grc span is computed inline
        // per branch (same criteria as e2e-subgraph-legend): computed
        // display/visibility/opacity showing, non-degenerate rect near the
        // page — a hidden/zero-opacity/clipped span fails.
        // Locate the Entities card: the container whose <h3> says
        // "Entities" (uppercased via CSS, text stays "Entities").
        const h3 = Array.from(document.querySelectorAll(expected.cardHeadingSel)).find(
          (h) => (h.textContent ?? "").trim().toLowerCase() === "entities",
        );
        const card = h3?.parentElement;
        if (!card) return { cardFound: false as const, results: [] };
        const results = expected.linkTerms.map((t) => {
          const anchor = Array.from(card.querySelectorAll("a")).find(
            (a) => (a.textContent ?? "").trim() === t.en,
          );
          if (!anchor)
            return {
              en: t.en,
              found: false,
              grcShown: null,
              grcVisible: false,
              why: "chip not found",
            };
          // The Greek form is the next sibling span in the chip row.
          const sibling = anchor.nextElementSibling;
          const grcShown =
            sibling && sibling.tagName === "SPAN"
              ? (sibling.textContent ?? "").trim()
              : null;
          let grcVisible = false;
          let why = "no grc sibling span";
          if (sibling && sibling.tagName === "SPAN") {
            const s = getComputedStyle(sibling);
            const r = sibling.getBoundingClientRect();
            grcVisible =
              s.display !== "none" &&
              s.visibility !== "hidden" &&
              parseFloat(s.opacity) > 0.05 &&
              r.width > 1 &&
              r.height > 1 &&
              r.bottom > 0 &&
              r.right > 0 &&
              r.top < window.innerHeight * 10 &&
              r.left < window.innerWidth;
            why = `display=${s.display} visibility=${s.visibility} opacity=${s.opacity} rect=${Math.round(r.width)}x${Math.round(r.height)}@${Math.round(r.left)},${Math.round(r.top)}`;
          }
          return { en: t.en, found: true, grcShown, grcVisible, why };
        });
        // School chips are plain (non-link) pills: an outer <span> whose
        // FIRST child <span> holds the English label, with the Greek form
        // in the next sibling <span> inside the same pill.
        const schoolResults = expected.schoolTerms.map((t) => {
          const inner = Array.from(card.querySelectorAll("span > span")).find(
            (s) =>
              (s.textContent ?? "").trim() === t.en &&
              s.parentElement?.tagName === "SPAN" &&
              s.parentElement.firstElementChild === s,
          );
          if (!inner)
            return {
              en: t.en,
              found: false,
              grcShown: null,
              grcVisible: false,
              why: "pill not found",
            };
          const sibling = inner.nextElementSibling;
          const grcShown =
            sibling && sibling.tagName === "SPAN"
              ? (sibling.textContent ?? "").trim()
              : null;
          let grcVisible = false;
          let why = "no grc sibling span";
          if (sibling && sibling.tagName === "SPAN") {
            const s = getComputedStyle(sibling);
            const r = sibling.getBoundingClientRect();
            grcVisible =
              s.display !== "none" &&
              s.visibility !== "hidden" &&
              parseFloat(s.opacity) > 0.05 &&
              r.width > 1 &&
              r.height > 1 &&
              r.bottom > 0 &&
              r.right > 0 &&
              r.top < window.innerHeight * 10 &&
              r.left < window.innerWidth;
            why = `display=${s.display} visibility=${s.visibility} opacity=${s.opacity} rect=${Math.round(r.width)}x${Math.round(r.height)}@${Math.round(r.left)},${Math.round(r.top)}`;
          }
          return { en: t.en, found: true, grcShown, grcVisible, why };
        });
        // Place/work/person chips render like philosopher chips (an <a>
        // whose exact text is the English label, followed by a sibling
        // Greek span) — EXCEPT grouped homonym persons, whose per-chip
        // Greek is hidden and whose Greek form shows once as the header
        // span of the surrounding bordered group container instead.
        const extraResults = expected.extraTerms.map((t) => {
          const anchor = Array.from(card.querySelectorAll("a")).find(
            (a) => (a.textContent ?? "").trim() === t.en,
          );
          if (!anchor)
            return {
              en: t.en,
              found: false,
              grcShown: null as string | null,
              grcVisible: false,
              why: "chip not found",
            };
          let target: Element | null = null;
          let grcShown: string | null = null;
          if (t.grouped) {
            // Walk up from the chip to the homonym group container and
            // read its header span (the shared Greek form shown once).
            let node: Element | null = anchor.parentElement;
            while (node && node !== card) {
              const first = node.querySelector("span");
              if (first && (first.textContent ?? "").trim() === t.grc) {
                target = first;
                break;
              }
              node = node.parentElement;
            }
            grcShown = target ? (target.textContent ?? "").trim() : null;
          } else {
            // The Greek span follows the anchor, but deliberately
            // unlinked person chips interpose an aria-hidden "?"
            // explainer span — walk the following siblings to the
            // first span carrying lang="grc" instead of assuming the
            // immediate neighbour.
            let sib: Element | null = anchor.nextElementSibling;
            while (
              sib &&
              !(sib.tagName === "SPAN" && sib.getAttribute("lang") === "grc")
            ) {
              sib = sib.nextElementSibling;
            }
            if (sib) {
              target = sib;
              grcShown = (sib.textContent ?? "").trim();
            }
          }
          let grcVisible = false;
          let why = t.grouped
            ? "no group header span with the Greek form"
            : "no grc sibling span";
          if (target) {
            const s = getComputedStyle(target);
            const r = target.getBoundingClientRect();
            grcVisible =
              s.display !== "none" &&
              s.visibility !== "hidden" &&
              parseFloat(s.opacity) > 0.05 &&
              r.width > 1 &&
              r.height > 1 &&
              r.bottom > 0 &&
              r.right > 0 &&
              r.top < window.innerHeight * 10 &&
              r.left < window.innerWidth;
            why = `display=${s.display} visibility=${s.visibility} opacity=${s.opacity} rect=${Math.round(r.width)}x${Math.round(r.height)}@${Math.round(r.left)},${Math.round(r.top)}`;
          }
          return { en: t.en, found: true, grcShown, grcVisible, why };
        });
        return { cardFound: true as const, results, schoolResults, extraResults };
      }, {
        linkTerms: nameTerms,
        schoolTerms,
        extraTerms: extraChecked,
        cardHeadingSel: CARD_HEADING_SELECTOR,
      });

      check(`${qid}: Entities card rendered`, rendered.cardFound);
      if (!rendered.cardFound) continue;

      for (const r of rendered.results) {
        const expectedGrc = nameTerms.find((t) => t.en === r.en)?.grc ?? "";
        check(
          `${qid}: "${r.en}" chip rendered with Greek "${expectedGrc}"`,
          r.found && r.grcShown === expectedGrc,
          r.found
            ? `rendered Greek "${r.grcShown ?? "(none)"}"`
            : "chip not found in the Entities card",
        );
        check(
          `${qid}: "${r.en}" chip's Greek span is visible`,
          r.grcVisible,
          r.why,
        );
        if (r.grcVisible && GREEK_RE.test(r.grcShown ?? "")) visibleGreekChips++;
      }

      for (const r of rendered.schoolResults) {
        const term = schoolTerms.find((t) => t.en === r.en);
        const expectedGrc = term?.grc ?? null;
        const ok = expectedGrc
          ? r.found && r.grcShown === expectedGrc
          : r.found && !r.grcShown;
        check(
          `${qid}: school pill "${r.en}" rendered with Greek "${expectedGrc ?? "(none)"}"`,
          ok,
          r.found
            ? `rendered Greek "${r.grcShown ?? "(none)"}"`
            : "school pill not found in the Entities card",
        );
        // The Unaffiliated bucket legitimately has no Greek span; only
        // Greek-carrying school pills must render it visibly.
        if (expectedGrc) {
          check(
            `${qid}: school pill "${r.en}"'s Greek span is visible`,
            r.grcVisible,
            r.why,
          );
          if (r.grcVisible && GREEK_RE.test(r.grcShown ?? ""))
            visibleGreekChips++;
        }
      }

      for (const r of rendered.extraResults ?? []) {
        const term = extraChecked.find((t) => t.en === r.en)!;
        const where = term.grouped ? "group header" : "chip";
        check(
          `${qid}: ${term.type} "${r.en}" renders Greek "${term.grc}" in its ${where}`,
          r.found && r.grcShown === term.grc,
          r.found
            ? `rendered Greek "${r.grcShown ?? "(none)"}"`
            : "chip not found in the Entities card",
        );
        check(
          `${qid}: ${term.type} "${r.en}"'s Greek (${where}) is visible`,
          r.grcVisible,
          r.why,
        );
        if (r.grcVisible && GREEK_RE.test(r.grcShown ?? "")) {
          visibleGreekChips++;
          visibleByType[term.type] = (visibleByType[term.type] ?? 0) + 1;
        }
      }
    }

    // --- Scenario: school-doctrines shows each school once, as a plain
    // non-link chip under the Schools group, never under Doctrines ---
    // The API dedupes school labels at the payload level (pinned by
    // validate-competency-terms), but a frontend grouping or dedupe
    // regression in the Zone C markup could re-duplicate a school chip
    // or render a school as a clickable doctrine chip while the API
    // stays green. This checks the rendered DOM itself.
    {
      const qid = "school-doctrines";
      console.log(
        `Question ${qid}: each school renders once, plain, under Schools`,
      );

      const res = await fetch(`${BASE_URL}/api/competency/questions/${qid}`);
      check(`${qid}: API responds 200`, res.ok, `${res.status}`);
      if (res.ok) {
        const data = (await res.json()) as { terms: Term[] };
        const schoolTerms = data.terms.filter((t) => t.type === "school");
        check(
          `${qid}: API payload has school terms (${schoolTerms.length})`,
          schoolTerms.length > 0,
        );
        // The four schools the task pins must be among them; the check
        // below then covers EVERY school term the payload ships.
        for (const name of ["Stoa", "Cynic", "Cyrenaic", "Epicurean (Garden)"]) {
          check(
            `${qid}: payload includes school "${name}" exactly once`,
            schoolTerms.filter((t) => t.en === name).length === 1,
          );
        }
        // Every school chip on this question must carry a curated Greek
        // form in the payload (school-doctrines has no Unaffiliated bucket)
        const noGrc = schoolTerms.filter(
          (t) => !t.grc || !GREEK_RE.test(t.grc),
        );
        check(
          `${qid}: every school term ships a real Greek form`,
          noGrc.length === 0,
          `missing grc for: ${noGrc.map((t) => t.en).join(", ")}`,
        );

        const page2 = await browser.newPage({
          viewport: { width: 1280, height: 900 },
        });
        // Second page needs its own load guard.
        const guard2 = attachPageGuard(page2);
        try {
          await page2.goto(`${BASE_URL}/competency?q=${qid}`, {
            waitUntil: "networkidle",
          });
          guard2.assertPageLoaded();
          await guard2.guarded(
            page2.waitForFunction(
              () => /entities/i.test(document.body.innerText),
              undefined,
              { timeout: 30000 },
            ),
          );
          await page2.waitForTimeout(300);

          const dom = await page2.evaluate(
            (args: {
              schools: Array<{ en: string; grc: string | null }>;
              cardHeadingSel: string;
            }) => {
              const schools = args.schools;
              const h3 = Array.from(document.querySelectorAll(args.cardHeadingSel)).find(
                (h) =>
                  (h.textContent ?? "").trim().toLowerCase() === "entities",
              );
              const card = h3?.parentElement;
              if (!card) return { cardFound: false as const, results: [] };

              // Each type group is a div whose <h4> carries the group
              // label ("Schools", "Doctrines", ...). Map heading -> the
              // group's chip container.
              const groups = new Map<string, Element>();
              for (const h4 of Array.from(card.querySelectorAll("h4"))) {
                const label = (h4.textContent ?? "").trim().toLowerCase();
                if (h4.parentElement) groups.set(label, h4.parentElement);
              }
              const doctrinesGroup = groups.get("doctrines") ?? null;
              const schoolsGroup = groups.get("schools") ?? null;

              // A "chip" is either a plain <span> pill or an <a> pill:
              // the elements whose class list contains rounded-full and
              // that are not nested inside another rounded-full pill.
              // Scanning the whole card (not just the two groups) means
              // a school label leaking into ANY group is caught.
              // NOTE: no named helper functions in this in-page block;
              // tsx/esbuild wraps them with a __name helper that does
              // not exist inside the browser context.
              const pillEntries = Array.from(card.querySelectorAll("a, span"))
                .filter((el) => {
                  if (
                    !(el.getAttribute("class") ?? "").includes("rounded-full")
                  )
                    return false;
                  const parentPill = el.parentElement?.closest(".rounded-full");
                  return !parentPill;
                })
                .map((el) => {
                  // The English label is the first inner span for plain
                  // chips, or the anchor's own text for link chips.
                  let text: string;
                  if (el.tagName === "A") {
                    text = (el.textContent ?? "").trim();
                  } else {
                    const inner = el.querySelector("span");
                    text = (inner?.textContent ?? el.textContent ?? "").trim();
                  }
                  return { el, text };
                });

              const results = schools.map(({ en: name, grc }) => {
                const matches = pillEntries
                  .filter((p) => p.text === name)
                  .map((p) => p.el);
                const m = matches[0] ?? null;
                // For a plain school pill, the Greek form is the second
                // inner <span>, right after the English-label span.
                let grcShown: string | null = null;
                if (m && m.tagName !== "A") {
                  const inner = m.querySelectorAll("span");
                  if (inner.length >= 2)
                    grcShown = (inner[1].textContent ?? "").trim();
                }
                return {
                  name,
                  expectedGrc: grc,
                  grcShown,
                  count: matches.length,
                  isLink: m ? m.tagName === "A" || !!m.closest("a") : null,
                  inSchools: m ? !!(schoolsGroup && schoolsGroup.contains(m)) : false,
                  inDoctrines: matches.some(
                    (p) => doctrinesGroup && doctrinesGroup.contains(p),
                  ),
                };
              });
              return {
                cardFound: true as const,
                hasSchoolsGroup: !!schoolsGroup,
                hasDoctrinesGroup: !!doctrinesGroup,
                results,
              };
            },
            {
              schools: schoolTerms.map((t) => ({ en: t.en, grc: t.grc ?? null })),
              cardHeadingSel: CARD_HEADING_SELECTOR,
            },
          );

          check(`${qid}: Entities card rendered`, dom.cardFound);
          if (dom.cardFound) {
            check(`${qid}: Schools group rendered`, !!dom.hasSchoolsGroup);
            for (const r of dom.results) {
              check(
                `${qid}: school "${r.name}" appears exactly once in the card`,
                r.count === 1,
                `found ${r.count}`,
              );
              check(
                `${qid}: school "${r.name}" is a plain non-link chip`,
                r.isLink === false,
                r.isLink === null ? "chip not found" : "rendered as a link",
              );
              check(
                `${qid}: school "${r.name}" sits under the Schools group`,
                r.inSchools,
              );
              check(
                `${qid}: school "${r.name}" does not appear under Doctrines`,
                !r.inDoctrines,
              );
              check(
                `${qid}: school "${r.name}" renders Greek "${r.expectedGrc ?? "(none)"}" in its chip`,
                r.expectedGrc
                  ? r.grcShown === r.expectedGrc
                  : !r.grcShown,
                `rendered Greek "${r.grcShown ?? "(none)"}"`,
              );
            }
          }
        } finally {
          await page2.close();
        }
      }
    }

    // Positive control: the run must have actually confirmed visible
    // Greek chips somewhere, else every visibility check was vacuous.
    check(
      `saw ${visibleGreekChips} visible Greek chip(s) across questions (must be > 0)`,
      visibleGreekChips > 0,
    );
    // Per-type positive controls: wherever the payloads shipped a
    // grc-carrying place/work/person term, the run must have confirmed
    // at least one VISIBLE Greek form of that type — otherwise every
    // per-type visibility check above went vacuous. person and work are
    // known-shipped by homonymy-proper-names, place by born-in-athens
    // ("Athens" / Ἀθῆναι) — all three types are hard-required below, so
    // none of the branches can silently go dormant again.
    for (const type of EXTRA_TYPES) {
      const shipped = shippedGrcByType[type] ?? 0;
      check(
        `positive control: saw ${visibleByType[type] ?? 0} visible Greek ${type} chip(s) (payload shipped ${shipped})`,
        shipped > 0 && (visibleByType[type] ?? 0) > 0,
      );
    }
    check(
      "positive control: checked questions ship grc-carrying person terms",
      (shippedGrcByType["person"] ?? 0) > 0,
    );
    check(
      "positive control: checked questions ship grc-carrying work terms",
      (shippedGrcByType["work"] ?? 0) > 0,
    );
    check(
      "positive control: checked questions ship grc-carrying place terms",
      (shippedGrcByType["place"] ?? 0) > 0,
    );
    // Negative control: the Greek-form test itself must be able to fire.
    check(
      "negative control: a Latin-only string is not a real Greek form",
      !GREEK_RE.test("Zeno"),
    );
  } finally {
    await browser.close();
  }

  if (failures > 0) {
    console.error(`\n${failures} check(s) failed`);
    process.exit(1);
  }
  console.log("\nAll competency bilingual-terms checks passed");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
