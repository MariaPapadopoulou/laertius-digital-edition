/**
 * Validates the curated anecdotes layer:
 *  - runs getAnecdotes() (which throws on duplicate ids, unknown
 *    philosophers, empty text, unknown topics and malformed refs);
 *  - resolves every anecdote's ref to a corpus section (the same
 *    first-match mapping the app uses) and asserts the section exists;
 *  - asserts each anecdote's English is a VERBATIM excerpt of that
 *    section's Hicks English — normalized for whitespace, quote style and
 *    dashes, then a substring check;
 *  - enforces the overlap policy with the sayings layer: an anecdote's
 *    excerpt may CONTAIN a curated saying's text, but must never be
 *    normalized-EQUAL to one (equality means the entry is a mislabeled
 *    saying and belongs in the other layer);
 *  - checks that every framesSaying id exists in the sayings layer.
 *
 * Run from the workspace root (LAERTIUS_DATA_DIR is optional; it defaults
 * to the api-server data directory):
 *   pnpm --filter @workspace/scripts run validate-anecdotes
 */
import path from "node:path";

process.env["LAERTIUS_DATA_DIR"] ??= path.resolve(
  import.meta.dirname,
  "../../artifacts/api-server/data",
);

const { getAnecdotes, ANECDOTE_TOPICS } = await import(
  "../../artifacts/api-server/src/lib/anecdotes"
);
const { getSayings } = await import(
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

const anecdotes = getAnecdotes();
const sayings = getSayings();
const errors: string[] = [];
let grcChecked = 0;
let enChecked = 0;

let involvesChecked = 0;
const PINNED_ANECDOTE_TOPICS = [
  "exile",
  "conversion",
  "asceticism",
  "training",
  "teaching",
  "defiance",
  "encounter",
  "wit",
  "eccentricity",
  "shamelessness",
  "capture",
  "death",
  "legacy",
  "piety",
];
{
  const pinned = new Set<string>(PINNED_ANECDOTE_TOPICS);
  const actual = new Set<string>(ANECDOTE_TOPICS);
  const removed = PINNED_ANECDOTE_TOPICS.filter((t) => !actual.has(t as never));
  const added = [...actual].filter((t) => !pinned.has(t));
  if (removed.length > 0 || added.length > 0) {
    const renameHint =
      removed.length > 0 && added.length > 0
        ? ` (looks like a rename: ${removed.join(", ")} -> ${added.join(", ")})`
        : "";
    errors.push(
      `anecdote topic set drifted from the pinned fourteen-topic union${renameHint}: ` +
        `${removed.length > 0 ? `old spelling(s) no longer present: [${removed.join(", ")}]; ` : ""}` +
        `${added.length > 0 ? `new spelling(s) not pinned: [${added.join(", ")}]; ` : ""}` +
        `renaming a topic breaks every shared /anecdotes?topic= link with ` +
        `the old spelling - if intentional, update PINNED_ANECDOTE_TOPICS in ` +
        `validate-anecdotes.ts and handle the old links consciously`,
    );
  }
  // The in-use topics must stay within the pinned union too (getAnecdotes()
  // already enforces membership in ANECDOTE_TOPICS, so this is a belt-and-
  // braces positive control that the pin actually covers real data).
  const inUse = new Set(anecdotes.map((a) => a.topic as string));
  const unpinnedInUse = [...inUse].filter((t) => !pinned.has(t));
  if (unpinnedInUse.length > 0) {
    errors.push(
      `anecdote topic(s) in use but not pinned: [${unpinnedInUse.join(", ")}]`,
    );
  }
  if (inUse.size === 0) {
    errors.push("no anecdote topics in use: the topic pin is vacuous");
  }
}

// Duplicate-content guard: two anecdotes must never share the same
// normalized Greek or English excerpt (dup ids are caught by
// getAnecdotes(), but a re-curated duplicate under a fresh id would slip
// through every other check and double-count in LOD and on /anecdotes).
for (const field of ["grc", "en"] as const) {
  const seen = new Map<string, string>();
  for (const a of anecdotes) {
    const value = a[field];
    if (!value) continue;
    const key = normalize(value);
    const prior = seen.get(key);
    if (prior) {
      errors.push(`${a.id}: duplicate ${field} excerpt (same as ${prior})`);
    } else {
      seen.set(key, a.id);
    }
  }
}

// Cross-layer overlap guard: an anecdote may CONTAIN a saying's text (it
// narrates the setting), but a normalized-EQUAL excerpt means the entry is
// a mislabeled saying — the overlap policy enforced mechanically.
const sayingEnByNorm = new Map<string, string>();
const sayingGrcByNorm = new Map<string, string>();
for (const s of sayings) {
  sayingEnByNorm.set(normalize(s.en), s.id);
  if (s.grc) sayingGrcByNorm.set(normalizeGreek(s.grc), s.id);
}
const sayingIds = new Set(sayings.map((s) => s.id));
for (const a of anecdotes) {
  const enHit = sayingEnByNorm.get(normalize(a.en));
  if (enHit) {
    errors.push(
      `${a.id}: English excerpt equals saying ${enHit} — a bare dictum ` +
        `belongs in the sayings layer, not here`,
    );
  }
  if (a.grc) {
    const grcHit = sayingGrcByNorm.get(normalizeGreek(a.grc));
    if (grcHit) {
      errors.push(
        `${a.id}: Greek excerpt equals saying ${grcHit} — a bare dictum ` +
          `belongs in the sayings layer, not here`,
      );
    }
  }
  if (a.framesSaying && !sayingIds.has(a.framesSaying)) {
    errors.push(
      `${a.id}: framesSaying "${a.framesSaying}" is not a curated saying id`,
    );
  }
}

for (const a of anecdotes) {
  const sectionId = sectionIdForRef(a.ref, a.philosopher);
  if (!sectionId) {
    errors.push(`${a.id}: ref ${a.ref} resolves to no corpus section`);
    continue;
  }
  const section = sectionById.get(sectionId);
  if (!section) {
    errors.push(`${a.id}: section ${sectionId} not in corpus`);
    continue;
  }
  if (!section.textEn) {
    errors.push(`${a.id}: section ${sectionId} has no English text`);
    continue;
  }
  enChecked += 1;
  if (!normalize(section.textEn).includes(normalize(a.en))) {
    errors.push(
      `${a.id}: English not a verbatim excerpt of ${a.ref} (${sectionId})\n` +
        `      en: ${a.en.slice(0, 90)}`,
    );
  }
  // Attribution: the anecdote's protagonist must own the chapter the
  // excerpt sits in, unless explicitly flagged as cross-attributed (D.L.
  // records the incident inside another philosopher's life).
  if (!a.crossAttributed && section.philosopher !== a.philosopher) {
    errors.push(
      `${a.id}: attributed to "${a.philosopher}" but ${a.ref} (${sectionId}) ` +
        `is in the life of "${section.philosopher}" ` +
        `(set crossAttributed: true if intentional)`,
    );
  }
  // Greek, when curated, must likewise be a verbatim excerpt — of the
  // grcRef section when one is set (Greek/English section-boundary
  // mismatch), otherwise of the ref section.
  if (a.grc) {
    grcChecked += 1;
    const grcRef = a.grcRef ?? a.ref;
    const grcSectionId = sectionIdForRef(grcRef, a.philosopher);
    const grcSection = grcSectionId ? sectionById.get(grcSectionId) : undefined;
    if (!grcSectionId || !grcSection) {
      errors.push(`${a.id}: grcRef ${grcRef} resolves to no corpus section`);
    } else if (
      !normalizeGreek(grcSection.text).includes(normalizeGreek(a.grc))
    ) {
      errors.push(
        `${a.id}: Greek not a verbatim excerpt of ${grcRef} (${grcSectionId})\n` +
          `      grc: ${a.grc.slice(0, 60)}`,
      );
    }
  }
  // Participant: when the curator names who the incident involves, that
  // name must actually appear in the cited passage — the involvesRef
  // section when one is set, otherwise the ref section. We check the first
  // capitalized token of the label with word boundaries; the full
  // disambiguated label is the curator's responsibility.
  if (a.involves) {
    const involvesRef = a.involvesRef ?? a.ref;
    const invSectionId = sectionIdForRef(involvesRef, a.philosopher);
    const invSection = invSectionId ? sectionById.get(invSectionId) : undefined;
    if (!invSectionId || !invSection) {
      errors.push(
        `${a.id}: involvesRef ${involvesRef} resolves to no corpus section`,
      );
    } else if (!invSection.textEn) {
      errors.push(`${a.id}: section ${invSectionId} has no English text`);
    } else {
      const token = a.involves.split(/\s+/).find((w) => /^[A-Z]/.test(w));
      if (!token) {
        errors.push(
          `${a.id}: involves "${a.involves}" has no capitalized name token`,
        );
      } else {
        involvesChecked += 1;
        if (
          !new RegExp(
            `\\b${token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`,
          ).test(invSection.textEn)
        ) {
          errors.push(
            `${a.id}: participant "${a.involves}" ("${token}") not named in ` +
              `${involvesRef} (${invSectionId})`,
          );
        }
      }
    }
  }
}

// Positive-control ratchet for the Greek excerpt-vs-section check above
// (mirrors the grcChecked guard in validate-claims.ts). The anecdotes
// layer now curates Greek excerpts, so the guard is armed permanently:
// curated Greek can never silently drop back to zero.
const ANECDOTES_HAVE_GRC = true;
if (ANECDOTES_HAVE_GRC && grcChecked === 0) {
  errors.push(
    "GREEK EXCERPT CHECK VACUOUS: no anecdote has a grc excerpt (positive control failed)",
  );
}
// Same positive control for the English verbatim check: every anecdote
// curates en, so if the loader ever returned an empty list or no en excerpt
// was actually compared against a corpus section, the check above passed
// vacuously — fail loudly instead.
if (enChecked === 0) {
  errors.push(
    "ENGLISH EXCERPT CHECK VACUOUS: no anecdote's en excerpt was compared against a corpus section (positive control failed)",
  );
}
// Same positive control for the participant name-presence check: curated
// anecdotes do name participants today, so if no participant name was ever
// actually tested against a cited passage (e.g. the `involves` field was
// renamed in the loader), the check above passed vacuously — fail loudly
// instead.
if (involvesChecked === 0) {
  errors.push(
    "PARTICIPANT NAME CHECK VACUOUS: no anecdote's participant (involves) was tested against a cited passage (positive control failed)",
  );
}
if (!ANECDOTES_HAVE_GRC && grcChecked > 0) {
  errors.push(
    `anecdotes now curate ${grcChecked} Greek excerpt(s): flip ` +
      "ANECDOTES_HAVE_GRC to true in validate-anecdotes.ts so the " +
      "vacuity guard arms and Greek coverage can't silently regress to zero",
  );
}

if (errors.length > 0) {
  console.error(`INVALID ANECDOTES (${errors.length}):`);
  for (const e of errors) console.error("  " + e);
  process.exit(1);
}

const byBook = new Map<number, number>();
const byPhilosopher = new Map<string, number>();
const byCertainty = new Map<string, number>();
let withGrc = 0;
let withSource = 0;
let withParticipant = 0;
let withFrames = 0;
for (const a of anecdotes) {
  const book = Number(a.ref.split(".")[0]);
  byBook.set(book, (byBook.get(book) ?? 0) + 1);
  byPhilosopher.set(
    a.philosopher,
    (byPhilosopher.get(a.philosopher) ?? 0) + 1,
  );
  byCertainty.set(a.certainty, (byCertainty.get(a.certainty) ?? 0) + 1);
  if (a.grc) withGrc += 1;
  if (a.accordingTo) withSource += 1;
  if (a.involves) withParticipant += 1;
  if (a.framesSaying) withFrames += 1;
}

const books = [...byBook.entries()]
  .sort((a, b) => a[0] - b[0])
  .map(([b, n]) => `b${b}:${n}`)
  .join(" ");
const certainties = [...byCertainty.entries()]
  .map(([c, n]) => `${c}:${n}`)
  .join(" ");

console.log(
  `OK: ${anecdotes.length} anecdotes across ${byPhilosopher.size} philosophers, ` +
    `${withGrc} with Greek, ${withSource} with a named source, ` +
    `${withParticipant} with a named participant, ${withFrames} framing a saying`,
);
console.log(`    books: ${books}`);
console.log(`    certainty: ${certainties}`);
