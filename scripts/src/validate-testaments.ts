/**
 * Validates the curated testament (wills) layer:
 *  - runs getTestaments() (which throws on duplicate ids, empty fields,
 *    non-contiguous section spans, and testators or `involves` names
 *    without a Life of their own);
 *  - resolves every section of every will DIRECTLY as a corpus section id
 *    and asserts the testator owns each one (a will never strays outside
 *    its testator's Life);
 *  - asserts the will's English is a VERBATIM excerpt of the opening
 *    section's Hicks English — normalized for whitespace, quote style and
 *    dashes, then a substring check — and likewise the Greek incipit
 *    against the same section under Greek normalization;
 *  - asserts every curated name (beneficiaries, executors, witnesses,
 *    involves) is actually written in one of the will's sections — first
 *    capitalized token with word boundaries, as in the epistle addressee
 *    check; the full disambiguated label is the curator's responsibility;
 *  - pins the total count so wills cannot silently appear or vanish (there
 *    are exactly six in the Lives: Plato, Aristotle, Theophrastus, Strato,
 *    Lyco, Epicurus).
 *
 * Run from the workspace root (LAERTIUS_DATA_DIR is optional; it defaults to
 * the api-server data directory):
 *   pnpm --filter @workspace/scripts run validate-testaments
 */
import path from "node:path";

import { TESTAMENT_PIN_COUNT } from "./layer-pins";

process.env["LAERTIUS_DATA_DIR"] ??= path.resolve(
  import.meta.dirname,
  "../../artifacts/api-server/data",
);

const { getTestaments } = await import(
  "../../artifacts/api-server/src/lib/testaments"
);
const { sectionById } = await import(
  "../../artifacts/api-server/src/lib/corpus"
);
const { normalizeGreek } = await import(
  "../../artifacts/api-server/src/lib/greek"
);

/** D.L. quotes exactly six wills; a change in either direction must be
 * deliberate. Pinned in layer-pins.ts, shared with smoke-ionos-bundle.ts. */
const EXPECTED_TESTAMENTS = TESTAMENT_PIN_COUNT;

/** Fold quote glyphs, dashes and whitespace so a curated excerpt can be
 * matched against the source text regardless of typographic style. */
function normalize(s: string): string {
  return s
    .replace(/[\u2018\u2019\u201B\u2032`\u00B4]/g, "'")
    .replace(/[\u201C\u201D\u201E\u2033]/g, '"')
    .replace(/[\u2010\u2011\u2012\u2013\u2014\u2015]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

const testaments = getTestaments();
const errors: string[] = [];
let grcChecked = 0;
let enChecked = 0;
let namesChecked = 0;

for (const t of testaments) {
  // Every section of the span must exist and belong to the testator's Life.
  const englishAcrossSpan: string[] = [];
  for (const secId of t.sections) {
    const sec = sectionById.get(secId);
    if (!sec) {
      errors.push(`${t.id}: section ${secId} is not a corpus section id`);
      continue;
    }
    if (sec.philosopher !== t.philosopher) {
      errors.push(
        `${t.id}: section ${secId} belongs to the Life of ` +
          `"${sec.philosopher}", not "${t.philosopher}"`,
      );
    }
    if (sec.textEn) englishAcrossSpan.push(sec.textEn);
  }

  const opening = sectionById.get(t.ref);
  if (!opening) {
    errors.push(`${t.id}: ref ${t.ref} is not a corpus section id`);
    continue;
  }
  if (!opening.textEn) {
    errors.push(`${t.id}: section ${t.ref} has no English text`);
  } else {
    enChecked += 1;
    if (!normalize(opening.textEn).includes(normalize(t.en))) {
      errors.push(
        `${t.id}: English not a verbatim excerpt of ${t.ref}\n` +
          `      en: ${t.en.slice(0, 90)}`,
      );
    }
  }
  grcChecked += 1;
  if (!normalizeGreek(opening.text).includes(normalizeGreek(t.grc))) {
    errors.push(
      `${t.id}: Greek not a verbatim excerpt of ${t.ref}\n` +
        `      grc: ${t.grc.slice(0, 60)}`,
    );
  }

  // Every curated name must be written in the will itself. As in the
  // epistle addressee check, we test the first capitalized token of the
  // label ("Lyco the nephew" → "Lyco", "Callinus of Hermione" →
  // "Callinus") with word boundaries across the will's full English span.
  const span = englishAcrossSpan.join(" ");
  const named = (label: string, kind: string) => {
    const token = label.split(/\s+/).find((w) => /^[A-Z]/.test(w));
    if (!token) {
      errors.push(`${t.id}: ${kind} "${label}" has no capitalized name token`);
      return;
    }
    namesChecked += 1;
    if (
      !new RegExp(
        `\\b${token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`,
      ).test(span)
    ) {
      errors.push(
        `${t.id}: ${kind} "${label}" ("${token}") not named in the will's sections`,
      );
    }
  };
  for (const b of t.beneficiaries) named(b, "beneficiary");
  for (const x of t.executors) named(x, "executor");
  for (const w of t.witnesses) named(w, "witness");
  for (const i of t.involves) named(i, "involves");
}

if (testaments.length !== EXPECTED_TESTAMENTS) {
  errors.push(
    `expected ${EXPECTED_TESTAMENTS} testaments, found ${testaments.length} — ` +
      `update EXPECTED_TESTAMENTS if the change is deliberate`,
  );
}

// Positive control: the Greek excerpt-vs-section check above is only
// meaningful if it actually ran against curated excerpts. If no testament
// carries grc, the check is vacuous — fail loudly instead of passing
// (mirrors the grcChecked guard in validate-claims.ts).
if (grcChecked === 0) {
  errors.push(
    "GREEK EXCERPT CHECK VACUOUS: no testament has a grc excerpt (positive control failed)",
  );
}

// Same positive control for the English verbatim check: if the loader ever
// returned an empty list or no en excerpt was actually compared against a
// corpus section, the check above passed vacuously — fail loudly instead.
if (enChecked === 0) {
  errors.push(
    "ENGLISH EXCERPT CHECK VACUOUS: no testament's en excerpt was compared against a corpus section (positive control failed)",
  );
}

// Same positive control for the name-presence checks: every will curates
// beneficiaries/executors/witnesses/involves, so if no name was ever
// actually tested against the will's sections (e.g. a field rename in the
// loader emptied them all), the named() checks above passed vacuously —
// fail loudly instead.
if (namesChecked === 0) {
  errors.push(
    "NAME PRESENCE CHECK VACUOUS: no beneficiary/executor/witness/involves name was tested against a will's sections (positive control failed)",
  );
}

if (errors.length > 0) {
  console.error(`INVALID TESTAMENTS (${errors.length}):`);
  for (const e of errors) console.error("  " + e);
  process.exit(1);
}

let sectionCount = 0;
let beneficiaries = 0;
let executors = 0;
let witnesses = 0;
let involves = 0;
for (const t of testaments) {
  sectionCount += t.sections.length;
  beneficiaries += t.beneficiaries.length;
  executors += t.executors.length;
  witnesses += t.witnesses.length;
  involves += t.involves.length;
}

console.log(
  `OK: ${testaments.length} testaments spanning ${sectionCount} sections`,
);
console.log(
  `    ${beneficiaries} beneficiaries, ${executors} executors, ` +
    `${witnesses} witnesses, ${involves} philosopher links`,
);
