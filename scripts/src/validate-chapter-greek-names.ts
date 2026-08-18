/**
 * Validates that every chapter subject (the 82 Lives, kg.ts nodes) ships
 * with a curated Greek nominative on its philosopher index entry.
 *
 * The Index matches pasted Greek input against the `grc` field the
 * annotated-entities payload carries for philosopher entries (assembled
 * in annotate.ts buildIndex from greek-names.ts). Coverage is only as
 * good as the curation: nothing else pins that every chapter subject
 * has a Greek name in greek-names.ts, so a future entry or rename there
 * would silently make that philosopher unfindable by Greek input. This
 * validator asserts:
 *
 * 1. Every kg.ts chapter-subject node has a tagged philosopher index
 *    entry (label match), and that entry carries a non-empty `grc`
 *    containing real Greek letters.
 * 2. The chapter-subject count itself is pinned (82), so a corpus
 *    re-parse that drops or adds a Life fails loudly here too.
 * 3. Positive control: the number of chapter subjects whose entry
 *    carries a grc is pinned at 82 and must be > 0, so the check can
 *    never go vacuously green (e.g. if the grc field were renamed and
 *    every lookup started missing).
 *
 * A deliberate change (a new Life, a rename) requires updating the pin.
 *
 * Run from the workspace root:
 *   pnpm --filter @workspace/scripts run validate-chapter-greek-names
 */
import path from "node:path";

process.env["LAERTIUS_DATA_DIR"] ??= path.resolve(
  import.meta.dirname,
  "../../artifacts/api-server/data",
);

const { getIndexEntries } = await import(
  "../../artifacts/api-server/src/lib/annotate"
);
const { getKnowledgeGraph } = await import(
  "../../artifacts/api-server/src/lib/kg"
);

/** The 82 Lives: 11 Book 1 sages + 71 philosophers of Books 2-10. */
const PINNED_CHAPTER_SUBJECTS = 82;

const errors: string[] = [];

const subjects = getKnowledgeGraph().nodes;
if (subjects.length !== PINNED_CHAPTER_SUBJECTS) {
  errors.push(
    `chapter-subject count drifted: expected ${PINNED_CHAPTER_SUBJECTS}, got ${subjects.length} (update the pin if a Life was deliberately added or removed)`,
  );
}

const philosopherEntries = new Map(
  getIndexEntries()
    .filter((e) => e.kind === "philosopher")
    .map((e) => [e.label, e]),
);

const greekLetters = /\p{Script=Greek}/u;
let withGrc = 0;

for (const s of subjects) {
  const entry = philosopherEntries.get(s.name);
  if (!entry) {
    errors.push(
      `chapter subject "${s.name}" (Book ${s.book}) has no tagged philosopher index entry, so Greek lookup can never reach it`,
    );
    continue;
  }
  if (!entry.grc || !greekLetters.test(entry.grc)) {
    errors.push(
      `chapter subject "${s.name}" (Book ${s.book}) has an index entry without a curated Greek name (grc=${JSON.stringify(entry.grc ?? null)}): add it to greek-names.ts or Greek input silently misses this philosopher`,
    );
    continue;
  }
  withGrc += 1;
}

// Positive control: the check must have actually seen Greek names.
if (withGrc !== PINNED_CHAPTER_SUBJECTS) {
  errors.push(
    `chapter subjects carrying a curated Greek name: expected ${PINNED_CHAPTER_SUBJECTS}, got ${withGrc}`,
  );
}
if (withGrc === 0) {
  errors.push(
    "positive control failed: not a single chapter subject carried a grc; the check is vacuous (grc assembly in annotate.ts may have moved)",
  );
}

if (errors.length > 0) {
  console.error(`validate-chapter-greek-names: ${errors.length} problem(s):`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}

console.log(
  `validate-chapter-greek-names: OK (${subjects.length} chapter subjects, ${withGrc} with curated Greek names)`,
);
