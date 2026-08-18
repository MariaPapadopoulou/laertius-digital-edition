/**
 * Pins the deep-link (firstId) behavior of the Croton and Telauges
 * person chips on /competency?q=homonymy-proper-names.
 *
 * These two labels are per-question person-sense hints
 * (CompetencyQuestion.personTermHints): their names collide with
 * earlier classifier tables (the city Croton in PLACE_TYPES, the
 * dialogue title Telauges in WORK_FACETS), so the hint forces the
 * person bucket. Person chips get their deep link from
 * firstSectionIdForPersonTerm (routes/competency.ts), which is
 * deliberately conservative: the label must resolve to exactly ONE
 * Index entry (directly, or via the curated Greek form when several
 * entries share the label); otherwise NO link ships rather than
 * guessing and sending readers to the wrong bearer's passage.
 *
 * Pinned decisions this validator enforces:
 *
 *  - Croton ships as a person chip WITH a firstId that opens the
 *    passage naming the PERSON (the claim-source, section 9.1.12),
 *    never the city. The Index holds two entries labelled "Croton"
 *    (the place and the person/source) sharing the same Greek form
 *    Κρότων, so neither the label nor the grc alone disambiguates —
 *    resolution is kind-aware: because the term is a person, the
 *    place-kind entry is dropped before disambiguating, leaving
 *    exactly one person-kind entry. If curation ever adds another
 *    person-kind "Croton" entry, resolution goes ambiguous again and
 *    this pin fails loudly for review.
 *
 *  - Telauges ships as a person chip WITH a firstId, and the linked
 *    section's English text actually names Telauges (the person, son
 *    of Pythagoras) — not merely the Aeschines dialogue title.
 *
 * The terms are built exactly as the route builds them
 * (buildCompetencyAnswer in routes/competency.ts), so what is asserted
 * here is what /api/competency/questions/homonymy-proper-names serves.
 * Positive counts are printed so a vacuous pass is impossible.
 *
 * Run from the workspace root:
 *   pnpm --filter @workspace/scripts run validate-competency-person-links
 */
import path from "node:path";

process.env["LAERTIUS_DATA_DIR"] ??= path.resolve(
  import.meta.dirname,
  "../../artifacts/api-server/data",
);

const { findCompetencyQuestion } = await import(
  "../../artifacts/api-server/src/lib/competency"
);
const { buildCompetencyAnswer, firstSectionIdForPersonTerm } = await import(
  "../../artifacts/api-server/src/routes/competency"
);
const { getIndexEntries } = await import(
  "../../artifacts/api-server/src/lib/annotate"
);
const { greekNameSpec } = await import(
  "../../artifacts/api-server/src/lib/greek-names"
);
const { sectionById } = await import(
  "../../artifacts/api-server/src/lib/corpus"
);

const QUESTION_ID = "homonymy-proper-names";

let failures = 0;
function check(label: string, ok: boolean) {
  if (ok) {
    console.log(`  ok: ${label}`);
  } else {
    failures++;
    console.error(`  FAIL: ${label}`);
  }
}

const question = findCompetencyQuestion(QUESTION_ID);
check(`competency catalogue still contains ${QUESTION_ID}`, !!question);
if (!question) {
  console.error("validate-competency-person-links FAILED");
  process.exit(1);
}

// Positive control: the hints under test are still curated on the question.
check(
  "question still hints Croton and Telauges as person senses",
  ["Croton", "Telauges"].every((l) => question.personTermHints?.includes(l)),
);

// Build the served answer exactly as the route does.
const answer = buildCompetencyAnswer(question);
const personTerms = answer.terms.filter(
  (t): t is typeof t & { firstId?: string } => t.type === "person",
);
console.log(
  `Served terms: ${answer.terms.length}; person terms: ${personTerms.length}`,
);
check("answer ships person terms (positive control)", personTerms.length > 0);

const croton = personTerms.find((t) => t.en === "Croton");
const telauges = personTerms.find((t) => t.en === "Telauges");
check("Croton ships as a person chip", !!croton);
check("Telauges ships as a person chip", !!telauges);

// ── Croton: pinned kind-aware person link ────────────────────────────────
// The Index still holds two entries labelled "Croton" sharing the same
// Greek form Κρότων (the place and the person/source) — the ambiguity
// that used to force a no-link decision. Kind-aware resolution drops
// the place entry because the term is a person, leaving exactly one
// person-kind entry, so the chip now links to the passage naming the
// PERSON. All parts are asserted: the underlying collision still
// exists, exactly one person-kind entry remains, and the served chip
// carries a firstId whose section names the person, not the city.
const crotonEntries = getIndexEntries().filter((e) => e.label === "Croton");
console.log(
  `Croton Index entries: ${crotonEntries.length} ` +
    `(${crotonEntries.map((e) => `${e.kind}:${e.grc ?? "-"}`).join(", ")})`,
);
const crotonGrc = greekNameSpec("Croton")?.grc;
check(
  "Croton label still collides across kinds (place + person/source share the label)",
  crotonEntries.length > 1 && crotonEntries.some((e) => e.kind === "place"),
);
const crotonPersonEntries = crotonEntries.filter((e) => e.kind !== "place");
check(
  "exactly one non-place (person-kind) Croton Index entry remains",
  crotonPersonEntries.length === 1,
);
check(
  "Croton chip ships WITH a firstId (kind-aware resolution)",
  croton !== undefined && typeof croton.firstId === "string",
);
if (croton?.firstId) {
  console.log(`Croton firstId: ${croton.firstId}`);
  check(
    "served Croton firstId matches direct resolution",
    croton.firstId === firstSectionIdForPersonTerm("Croton", crotonGrc),
  );
  const sec = sectionById.get(croton.firstId);
  check("Croton firstId resolves to a real corpus section", !!sec);
  check(
    "Croton firstId is the person/source entry's passage (9.1.12), never the city's",
    croton.firstId === "9.1.12",
  );
  check(
    "linked section's English text names Croton",
    !!sec?.textEn && sec.textEn.includes("Croton"),
  );
}

// ── Telauges: pinned link that names the person ─────────────────────────
check(
  "Telauges chip ships WITH a firstId",
  telauges !== undefined && typeof telauges.firstId === "string",
);
if (telauges?.firstId) {
  console.log(`Telauges firstId: ${telauges.firstId}`);
  const sec = sectionById.get(telauges.firstId);
  check("Telauges firstId resolves to a real corpus section", !!sec);
  check(
    "linked section's English text names Telauges (the person, not just the dialogue title)",
    !!sec?.textEn && sec.textEn.includes("Telauges"),
  );
}

if (failures > 0) {
  console.error(
    `validate-competency-person-links FAILED: ${failures} check(s)`,
  );
  process.exit(1);
}
console.log("validate-competency-person-links passed");
