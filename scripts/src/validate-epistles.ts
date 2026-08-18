/**
 * Validates the curated epistle (letters) layer:
 *  - runs getEpistles() (which throws on duplicate ids, empty fields,
 *    unknown topics/authenticities and malformed refs);
 *  - resolves every epistle's ref DIRECTLY as a corpus section id (epistle
 *    refs are full book.chapter.section ids, so no first-match ambiguity);
 *  - asserts each epistle's English is a VERBATIM excerpt of that section's
 *    Hicks English — normalized for whitespace, quote style and dashes, then
 *    a substring check — and likewise the Greek against the grcRef|ref
 *    section under Greek normalization;
 *  - asserts the section owner is the sender or the addressee, unless the
 *    entry is flagged crossAttributed (letter quoted in a third party's
 *    Life, e.g. Archytas to Dionysius inside Plato's);
 *  - asserts the addressee is actually named in the cited passage (toRef
 *    when set — salutations often close the previous section);
 *  - pins the total count so letters cannot silently appear or vanish.
 *
 * Run from the workspace root (LAERTIUS_DATA_DIR is optional; it defaults to
 * the api-server data directory):
 *   pnpm --filter @workspace/scripts run validate-epistles
 */
import path from "node:path";

import { EPISTLE_PIN_COUNT } from "./layer-pins";

process.env["LAERTIUS_DATA_DIR"] ??= path.resolve(
  import.meta.dirname,
  "../../artifacts/api-server/data",
);

const { getEpistles } = await import(
  "../../artifacts/api-server/src/lib/epistles"
);
const { sectionById } = await import(
  "../../artifacts/api-server/src/lib/corpus"
);
const { normalizeGreek } = await import(
  "../../artifacts/api-server/src/lib/greek"
);

/** Every letter D.L. quotes verbatim is curated; a change in either
 * direction must be deliberate. Pinned in layer-pins.ts, shared with
 * smoke-ionos-bundle.ts. */
const EXPECTED_EPISTLES = EPISTLE_PIN_COUNT;

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

const epistles = getEpistles();
const errors: string[] = [];
let grcChecked = 0;
let toChecked = 0;

for (const e of epistles) {
  const section = sectionById.get(e.ref);
  if (!section) {
    errors.push(`${e.id}: ref ${e.ref} is not a corpus section id`);
    continue;
  }
  if (!section.textEn) {
    errors.push(`${e.id}: section ${e.ref} has no English text`);
    continue;
  }
  if (!normalize(section.textEn).includes(normalize(e.en))) {
    errors.push(
      `${e.id}: English not a verbatim excerpt of ${e.ref}\n` +
        `      en: ${e.en.slice(0, 90)}`,
    );
  }
  // Attribution: the letter must sit in the Life of its sender or its
  // addressee, unless explicitly flagged as quoted in a third party's Life.
  if (
    !e.crossAttributed &&
    section.philosopher !== e.sender &&
    section.philosopher !== e.to
  ) {
    errors.push(
      `${e.id}: neither sender "${e.sender}" nor addressee "${e.to}" owns ` +
        `${e.ref} (the Life of "${section.philosopher}") ` +
        `(set crossAttributed: true if intentional)`,
    );
  }
  // Greek, when curated, must likewise be a verbatim excerpt — of the
  // grcRef section when one is set (salutations often close the previous
  // section), otherwise of the ref section.
  if (e.grc) {
    grcChecked += 1;
    const grcRef = e.grcRef ?? e.ref;
    const grcSection = sectionById.get(grcRef);
    if (!grcSection) {
      errors.push(`${e.id}: grcRef ${grcRef} is not a corpus section id`);
    } else if (!normalizeGreek(grcSection.text).includes(normalizeGreek(e.grc))) {
      errors.push(
        `${e.id}: Greek not a verbatim excerpt of ${grcRef}\n` +
          `      grc: ${e.grc.slice(0, 60)}`,
      );
    }
  }
  // The addressee must actually be named in the cited passage — the toRef
  // section when one is set, otherwise the ref section. We check the first
  // capitalized token of the label ("King Demetrius" → "King", "the Wise
  // Men" → "Wise") with word boundaries; the full disambiguated label is
  // the curator's responsibility.
  const toRef = e.toRef ?? e.ref;
  const toSection = sectionById.get(toRef);
  if (!toSection) {
    errors.push(`${e.id}: toRef ${toRef} is not a corpus section id`);
  } else if (!toSection.textEn) {
    errors.push(`${e.id}: section ${toRef} has no English text`);
  } else {
    const token = e.to.split(/\s+/).find((w) => /^[A-Z]/.test(w));
    if (!token) {
      errors.push(`${e.id}: to "${e.to}" has no capitalized name token`);
    } else {
      toChecked += 1;
      if (
        !new RegExp(
          `\\b${token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`,
        ).test(toSection.textEn)
      ) {
        errors.push(
          `${e.id}: addressee "${e.to}" ("${token}") not named in ${toRef}`,
        );
      }
    }
  }
}

if (epistles.length !== EXPECTED_EPISTLES) {
  errors.push(
    `expected ${EXPECTED_EPISTLES} epistles, found ${epistles.length} — ` +
      `update EXPECTED_EPISTLES if the change is deliberate`,
  );
}

// Positive control: the Greek excerpt-vs-section check above is only
// meaningful if it actually ran against curated excerpts. If no epistle
// carries grc, the check is vacuous — fail loudly instead of passing
// (mirrors the grcChecked guard in validate-claims.ts).
if (grcChecked === 0) {
  errors.push(
    "GREEK EXCERPT CHECK VACUOUS: no epistle has a grc excerpt (positive control failed)",
  );
}

// Same positive control for the addressee name-presence check: curated
// epistles do name addressees today, so if no addressee name was ever
// actually tested against a cited passage (e.g. the `to` field was renamed
// in the loader), the check above passed vacuously — fail loudly instead
// (mirrors the toChecked guard in validate-sayings.ts).
if (toChecked === 0) {
  errors.push(
    "ADDRESSEE NAME CHECK VACUOUS: no epistle's addressee (to) was tested against a cited passage (positive control failed)",
  );
}

if (errors.length > 0) {
  console.error(`INVALID EPISTLES (${errors.length}):`);
  for (const e of errors) console.error("  " + e);
  process.exit(1);
}

const byBook = new Map<number, number>();
const byAuthenticity = new Map<string, number>();
let withGrc = 0;
let withDate = 0;
for (const e of epistles) {
  const book = Number(e.ref.split(".")[0]);
  byBook.set(book, (byBook.get(book) ?? 0) + 1);
  byAuthenticity.set(
    e.authenticity,
    (byAuthenticity.get(e.authenticity) ?? 0) + 1,
  );
  if (e.grc) withGrc += 1;
  if (e.dramaticDate) withDate += 1;
}

const books = [...byBook.entries()]
  .sort((a, b) => a[0] - b[0])
  .map(([b, n]) => `b${b}:${n}`)
  .join(" ");
const authenticities = [...byAuthenticity.entries()]
  .map(([a, n]) => `${a}:${n}`)
  .join(" ");

console.log(
  `OK: ${epistles.length} epistles, ${withGrc} with Greek, ` +
    `${withDate} with a dramatic date`,
);
console.log(`    books: ${books}`);
console.log(`    authenticity: ${authenticities}`);
