/**
 * Validates the curated sayings / apophthegm layer:
 *  - runs getSayings() (which throws on duplicate ids, unknown philosophers,
 *    empty text, unknown topics and malformed refs);
 *  - resolves every saying's ref to a corpus section (the same first-match
 *    mapping the app uses) and asserts the section exists;
 *  - asserts each saying's English is a VERBATIM excerpt of that section's
 *    Hicks English — normalized for whitespace, quote style and dashes, then
 *    a substring check. This is what makes the layer scholar-grade: no saying
 *    can drift from the text it cites.
 *
 * Run from the workspace root (LAERTIUS_DATA_DIR is optional; it defaults to
 * the api-server data directory):
 *   pnpm --filter @workspace/scripts run validate-sayings
 */
import path from "node:path";

process.env["LAERTIUS_DATA_DIR"] ??= path.resolve(
  import.meta.dirname,
  "../../artifacts/api-server/data",
);

const { getSayings, SAYING_TOPICS } = await import(
  "../../artifacts/api-server/src/lib/sayings"
);
const { sectionById } = await import(
  "../../artifacts/api-server/src/lib/corpus"
);
const { sectionIdForRef } = await import(
  "../../artifacts/api-server/src/lib/claims-answer"
);
const { normalizeGreek } = await import(
  "../../artifacts/api-server/src/lib/greek"
);

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

const sayings = getSayings();
const errors: string[] = [];
let grcChecked = 0;
let enChecked = 0;
let toChecked = 0;

// Topic-spelling pin: the /sayings page's ?topic= filter silently falls
// back to the full list on an unrecognized value, so renaming a topic in
// the sayings layer would quietly invalidate every previously shared link
// with the old spelling. Pin the controlled topic union EXACTLY (strings
// and count) so a drift or rename fails loudly here and becomes a
// conscious decision (update this pin AND plan redirects/link hygiene)
// instead of silent link rot. Mirrors the doxai domain pin in
// validate-doxai.ts.
const PINNED_SAYING_TOPICS = [
  "wit",
  "wealth",
  "death",
  "virtue",
  "education",
  "speech",
  "friendship",
  "fortune",
  "self-sufficiency",
  "pleasure",
  "fame",
  "religion",
  "politics",
  "wisdom",
];
{
  const pinned = new Set<string>(PINNED_SAYING_TOPICS);
  const actual = new Set<string>(SAYING_TOPICS);
  const removed = PINNED_SAYING_TOPICS.filter((t) => !actual.has(t as never));
  const added = [...actual].filter((t) => !pinned.has(t));
  if (removed.length > 0 || added.length > 0) {
    const renameHint =
      removed.length > 0 && added.length > 0
        ? ` (looks like a rename: ${removed.join(", ")} -> ${added.join(", ")})`
        : "";
    errors.push(
      `saying topic set drifted from the pinned fourteen-topic union${renameHint}: ` +
        `${removed.length > 0 ? `old spelling(s) no longer present: [${removed.join(", ")}]; ` : ""}` +
        `${added.length > 0 ? `new spelling(s) not pinned: [${added.join(", ")}]; ` : ""}` +
        `renaming a topic breaks every shared /sayings?topic= link with ` +
        `the old spelling - if intentional, update PINNED_SAYING_TOPICS in ` +
        `validate-sayings.ts and handle the old links consciously`,
    );
  }
  // The in-use topics must stay within the pinned union too (getSayings()
  // already enforces membership in SAYING_TOPICS, so this is a belt-and-
  // braces positive control that the pin actually covers real data).
  const inUse = new Set(sayings.map((s) => s.topic as string));
  const unpinnedInUse = [...inUse].filter((t) => !pinned.has(t));
  if (unpinnedInUse.length > 0) {
    errors.push(
      `saying topic(s) in use but not pinned: [${unpinnedInUse.join(", ")}]`,
    );
  }
  if (inUse.size === 0) {
    errors.push("no saying topics in use: the topic pin is vacuous");
  }
}

// Duplicate-content guard: two sayings must never share the same normalized
// Greek or English excerpt (dup ids are caught by getSayings(), but a
// re-curated duplicate under a fresh id would slip through every other check
// and double-count in LOD and on /sayings).
for (const field of ["grc", "en"] as const) {
  const seen = new Map<string, string>();
  for (const s of sayings) {
    const value = s[field];
    if (!value) continue;
    const key = normalize(value);
    const prior = seen.get(key);
    if (prior) {
      errors.push(`${s.id}: duplicate ${field} excerpt (same as ${prior})`);
    } else {
      seen.set(key, s.id);
    }
  }
}

for (const s of sayings) {
  const sectionId = sectionIdForRef(s.ref, s.philosopher);
  if (!sectionId) {
    errors.push(`${s.id}: ref ${s.ref} resolves to no corpus section`);
    continue;
  }
  const section = sectionById.get(sectionId);
  if (!section) {
    errors.push(`${s.id}: section ${sectionId} not in corpus`);
    continue;
  }
  if (!section.textEn) {
    errors.push(`${s.id}: section ${sectionId} has no English text`);
    continue;
  }
  enChecked += 1;
  if (!normalize(section.textEn).includes(normalize(s.en))) {
    errors.push(
      `${s.id}: English not a verbatim excerpt of ${s.ref} (${sectionId})\n` +
        `      en: ${s.en.slice(0, 90)}`,
    );
  }
  // Attribution: the saying's speaker must own the chapter the excerpt sits
  // in, unless explicitly flagged as a cross-attributed quote (D.L. records
  // the saying inside another philosopher's life).
  if (!s.crossAttributed && section.philosopher !== s.philosopher) {
    errors.push(
      `${s.id}: attributed to "${s.philosopher}" but ${s.ref} (${sectionId}) ` +
        `is in the life of "${section.philosopher}" ` +
        `(set crossAttributed: true if intentional)`,
    );
  }
  // Greek, when curated, must likewise be a verbatim excerpt — of the
  // grcRef section when one is set (Greek/English section-boundary
  // mismatch, e.g. Plato 3.39/3.40), otherwise of the ref section.
  if (s.grc) {
    grcChecked += 1;
    const grcRef = s.grcRef ?? s.ref;
    const grcSectionId = sectionIdForRef(grcRef, s.philosopher);
    const grcSection = grcSectionId ? sectionById.get(grcSectionId) : undefined;
    if (!grcSectionId || !grcSection) {
      errors.push(`${s.id}: grcRef ${grcRef} resolves to no corpus section`);
    } else if (
      !normalizeGreek(grcSection.text).includes(normalizeGreek(s.grc))
    ) {
      errors.push(
        `${s.id}: Greek not a verbatim excerpt of ${grcRef} (${grcSectionId})\n` +
          `      grc: ${s.grc.slice(0, 60)}`,
      );
    }
  }
  // Addressee: when the curator names who the saying was spoken (or written)
  // to, the addressee must actually be named in the cited passage — the
  // toRef section when one is set (e.g. the Letter to Menoeceus salutation
  // at 10.121), otherwise the ref section. We check the first capitalized
  // token of the label ("Crates of Thebes" → "Crates", "the Athenians" →
  // "Athenians") with word boundaries; the full disambiguated label is the
  // curator's responsibility.
  if (s.to) {
    const toRef = s.toRef ?? s.ref;
    const toSectionId = sectionIdForRef(toRef, s.philosopher);
    const toSection = toSectionId ? sectionById.get(toSectionId) : undefined;
    if (!toSectionId || !toSection) {
      errors.push(`${s.id}: toRef ${toRef} resolves to no corpus section`);
    } else if (!toSection.textEn) {
      errors.push(`${s.id}: section ${toSectionId} has no English text`);
    } else {
      const token = s.to.split(/\s+/).find((w) => /^[A-Z]/.test(w));
      if (!token) {
        errors.push(`${s.id}: to "${s.to}" has no capitalized name token`);
      } else {
        toChecked += 1;
        if (
          !new RegExp(
            `\\b${token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`,
          ).test(toSection.textEn)
        ) {
          errors.push(
            `${s.id}: addressee "${s.to}" ("${token}") not named in ` +
              `${toRef} (${toSectionId})`,
          );
        }
      }
    }
  }
}

// Positive control: the Greek excerpt-vs-section check above is only
// meaningful if it actually ran against curated excerpts. If no saying
// carries grc, the check is vacuous — fail loudly instead of passing
// (mirrors the grcChecked guard in validate-claims.ts).
if (grcChecked === 0) {
  errors.push(
    "GREEK EXCERPT CHECK VACUOUS: no saying has a grc excerpt (positive control failed)",
  );
}

// Same positive control for the English verbatim check: if the loader ever
// returned an empty list or no en excerpt was actually compared against a
// corpus section, the check above passed vacuously — fail loudly instead.
if (enChecked === 0) {
  errors.push(
    "ENGLISH EXCERPT CHECK VACUOUS: no saying's en excerpt was compared against a corpus section (positive control failed)",
  );
}

// Same positive control for the addressee name-presence check: curated
// sayings do name addressees today, so if no addressee name was ever
// actually tested against a cited passage (e.g. the `to` field was renamed
// in the loader), the check above passed vacuously — fail loudly instead.
if (toChecked === 0) {
  errors.push(
    "ADDRESSEE NAME CHECK VACUOUS: no saying's addressee (to) was tested against a cited passage (positive control failed)",
  );
}

if (errors.length > 0) {
  console.error(`INVALID SAYINGS (${errors.length}):`);
  for (const e of errors) console.error("  " + e);
  process.exit(1);
}

const byBook = new Map<number, number>();
const byPhilosopher = new Map<string, number>();
const byCertainty = new Map<string, number>();
let withGrc = 0;
let withSource = 0;
let withAddressee = 0;
for (const s of sayings) {
  const book = Number(s.ref.split(".")[0]);
  byBook.set(book, (byBook.get(book) ?? 0) + 1);
  byPhilosopher.set(s.philosopher, (byPhilosopher.get(s.philosopher) ?? 0) + 1);
  byCertainty.set(s.certainty, (byCertainty.get(s.certainty) ?? 0) + 1);
  if (s.grc) withGrc += 1;
  if (s.accordingTo) withSource += 1;
  if (s.to) withAddressee += 1;
}

const books = [...byBook.entries()]
  .sort((a, b) => a[0] - b[0])
  .map(([b, n]) => `b${b}:${n}`)
  .join(" ");
const certainties = [...byCertainty.entries()]
  .map(([c, n]) => `${c}:${n}`)
  .join(" ");

console.log(
  `OK: ${sayings.length} sayings across ${byPhilosopher.size} philosophers, ` +
    `${withGrc} with Greek, ${withSource} with a named source, ` +
    `${withAddressee} with a named addressee`,
);
console.log(`    books: ${books}`);
console.log(`    certainty: ${certainties}`);
