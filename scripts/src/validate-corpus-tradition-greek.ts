/**
 * Validates that every distinct corpus tradition (`school`) label in
 * laertius_sections.jsonl resolves to a Greek display form through
 * schoolGrcForCorpusLabel (greek-names.ts).
 *
 * The browse page and the passage/saying/anecdote/doxa/verse cards show
 * bilingual tradition headings via schoolGrcForCorpusLabel, which keys
 * on the EXACT `school` strings in the sections file. Nothing else pins
 * that mapping: if a data refresh introduced or renamed a tradition
 * label, the Greek form would silently disappear (the UI falls back to
 * English-only with no error). This validator asserts:
 *
 * 1. Every distinct `school` value in laertius_sections.jsonl resolves
 *    to a non-empty form containing real Greek letters.
 * 2. The distinct-label count is pinned (10), so a corpus re-parse that
 *    adds or drops a tradition heading fails loudly here too.
 * 3. Positive control: the number of resolved labels is printed and
 *    must equal the pin and be > 0, so the check can never go
 *    vacuously green (e.g. if the sections file moved or the `school`
 *    field were renamed and the sweep matched nothing).
 *
 * A deliberate change (a new tradition heading, a rename) requires
 * updating CORPUS_TRADITION_GRC (or GREEK_SCHOOL_NAMES) and the pin.
 *
 * Run from the workspace root:
 *   pnpm --filter @workspace/scripts run validate-corpus-tradition-greek
 */
import { readFileSync } from "node:fs";
import path from "node:path";

process.env["LAERTIUS_DATA_DIR"] ??= path.resolve(
  import.meta.dirname,
  "../../artifacts/api-server/data",
);

const { schoolGrcForCorpusLabel } = await import(
  "../../artifacts/api-server/src/lib/greek-names"
);

/** The 10 book-heading tradition labels of the current corpus. */
const PINNED_TRADITION_LABELS = 10;

const sectionsPath = path.join(
  process.env["LAERTIUS_DATA_DIR"],
  "laertius_sections.jsonl",
);

const schools = new Map<string, number>();
for (const line of readFileSync(sectionsPath, "utf8").split("\n")) {
  if (!line.trim()) continue;
  const row = JSON.parse(line) as { school?: unknown };
  if (typeof row.school !== "string" || row.school.trim() === "") {
    throw new Error(
      `validate-corpus-tradition-greek: a section row is missing its school field: ${line.slice(0, 120)}`,
    );
  }
  schools.set(row.school, (schools.get(row.school) ?? 0) + 1);
}

const errors: string[] = [];
const greekLetters = /\p{Script=Greek}/u;
let resolved = 0;

for (const [label, count] of [...schools.entries()].sort()) {
  const grc = schoolGrcForCorpusLabel(label);
  if (!grc || !greekLetters.test(grc)) {
    errors.push(
      `tradition label ${JSON.stringify(label)} (${count} sections) does not resolve to a Greek form (got ${JSON.stringify(grc ?? null)}): add it to CORPUS_TRADITION_GRC in greek-names.ts or the browse page and corpus cards silently drop its Greek heading`,
    );
    continue;
  }
  resolved += 1;
}

if (schools.size !== PINNED_TRADITION_LABELS) {
  errors.push(
    `distinct tradition-label count drifted: expected ${PINNED_TRADITION_LABELS}, got ${schools.size} (update the pin AND the Greek map if the corpus headings deliberately changed)`,
  );
}

// Positive control: the sweep must have actually resolved Greek forms.
if (resolved === 0) {
  errors.push(
    "positive control failed: not a single tradition label resolved to a Greek form; the check is vacuous (schoolGrcForCorpusLabel or the sections file may have moved)",
  );
}
if (resolved !== PINNED_TRADITION_LABELS) {
  errors.push(
    `tradition labels resolving to Greek forms: expected ${PINNED_TRADITION_LABELS}, got ${resolved}`,
  );
}

if (errors.length > 0) {
  console.error(
    `validate-corpus-tradition-greek: ${errors.length} problem(s):`,
  );
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}

console.log(
  `validate-corpus-tradition-greek: OK (${schools.size} distinct tradition labels, ${resolved} resolved to Greek forms)`,
);
