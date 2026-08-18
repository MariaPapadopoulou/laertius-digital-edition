/**
 * Validates the curated Greek nominatives the annotated-entities payload
 * carries for philosopher index entries (annotate.ts buildIndex, from
 * greek-names.ts), and the homonym-form equality the Index dedupe
 * relies on.
 *
 * The Index shows one Greek line per entry: when an entry carries both a
 * curated `grc` and a shared `grcHomonymForm`, the frontend dedupes them
 * by equality, so a curation edit that makes them differ would silently
 * render two Greek lines. Nothing else pins the philosopher grc coverage
 * or that equality, so this validator asserts:
 *
 * 1. Pinned coverage: every philosopher index entry carries `grc`, and
 *    the count of philosophers with grc is pinned (82), so a curation
 *    edit that drops a name fails loudly.
 * 2. Well-formed Greek: every `grc` and `grcHomonymForm` in the payload
 *    (all kinds) contains real Greek letters, is NFC-stable (precomposed
 *    codepoints - hand-typed polytonic with spacing breathings like
 *    U+1FBF or combining marks would not round-trip search/matching),
 *    and contains no combining diacritics or stray spacing breathings.
 * 3. Dedupe equality: whenever an entry carries both `grc` and
 *    `grcHomonymForm`, they are equal; the count of philosopher entries
 *    carrying both is pinned (9), and no entry has a grcHomonymForm
 *    without a grc.
 * 4. Positive controls: the pinned counts must be > 0, so the check can
 *    never go vacuously green if the payload fields are renamed.
 *
 * A deliberate change (a new Life, a new certified homonym bearer)
 * requires updating the pins.
 *
 * Run from the workspace root:
 *   pnpm --filter @workspace/scripts run validate-philosopher-greek-names
 */
import path from "node:path";

process.env["LAERTIUS_DATA_DIR"] ??= path.resolve(
  import.meta.dirname,
  "../../artifacts/api-server/data",
);

const { getIndexEntries } = await import(
  "../../artifacts/api-server/src/lib/annotate"
);

/** The 82 Lives' philosopher entries, all curated in greek-names.ts. */
const PINNED_PHILOSOPHERS_WITH_GRC = 82;
/** Philosopher homonym bearers carrying both grc and grcHomonymForm. */
const PINNED_PHILOSOPHER_HOMONYM_BEARERS = 9;

const errors: string[] = [];
const entries = getIndexEntries();

// ------------------------------------------------ 1. pinned coverage
const philosophers = entries.filter((e) => e.kind === "philosopher");
const philosophersWithGrc = philosophers.filter((e) => e.grc);
for (const e of philosophers) {
  if (!e.grc) {
    errors.push(
      `philosopher "${e.label}" has no curated Greek nominative (grc missing): a curation edit in greek-names.ts dropped it, so Greek input silently misses this entry`,
    );
  }
}
if (philosophersWithGrc.length !== PINNED_PHILOSOPHERS_WITH_GRC) {
  errors.push(
    `philosophers with grc drifted: expected ${PINNED_PHILOSOPHERS_WITH_GRC}, got ${philosophersWithGrc.length} (update the pin if a Life was deliberately added or removed)`,
  );
}

// ------------------------------------------- 2. well-formed Greek forms
const greekLetters = /\p{Script=Greek}/u;
// Combining diacritics (would mean decomposed input) and the spacing
// breathings/accents block (U+1FBD-U+1FFE minus the precomposed letters):
// hand-typed polytonic must use precomposed U+1F00-block codepoints.
const forbidden = /[\u0300-\u036f\u1fbd\u1fbf\u1fc0\u1fc1\u1fcd-\u1fcf\u1fdd-\u1fdf\u1fed-\u1fef\u1ffd\u1ffe]/u;

function checkForm(label: string, field: string, value: string): void {
  if (!greekLetters.test(value)) {
    errors.push(
      `"${label}" ${field}=${JSON.stringify(value)} contains no Greek letters`,
    );
    return;
  }
  if (value !== value.normalize("NFC")) {
    errors.push(
      `"${label}" ${field}=${JSON.stringify(value)} is not NFC-stable: retype it with precomposed polytonic codepoints (U+1F00 block)`,
    );
  }
  if (forbidden.test(value)) {
    errors.push(
      `"${label}" ${field}=${JSON.stringify(value)} contains a combining mark or spacing breathing (e.g. U+1FBF): use precomposed polytonic codepoints instead`,
    );
  }
}

let formsChecked = 0;
for (const e of entries) {
  if (e.grc) {
    checkForm(e.label, "grc", e.grc);
    formsChecked += 1;
  }
  if (e.grcHomonymForm) {
    checkForm(e.label, "grcHomonymForm", e.grcHomonymForm);
    formsChecked += 1;
  }
}

// ------------------------------------------------- 3. dedupe equality
let philosopherBearers = 0;
for (const e of entries) {
  if (e.grcHomonymForm && !e.grc) {
    errors.push(
      `"${e.label}" (${e.kind}) carries grcHomonymForm ${JSON.stringify(e.grcHomonymForm)} but no grc: the Index would show a homonym note with no Greek name line`,
    );
  }
  if (e.grc && e.grcHomonymForm) {
    if (e.grc !== e.grcHomonymForm) {
      errors.push(
        `"${e.label}" (${e.kind}) grc ${JSON.stringify(e.grc)} !== grcHomonymForm ${JSON.stringify(e.grcHomonymForm)}: the Index dedupe breaks and shows two Greek lines`,
      );
    }
    if (e.kind === "philosopher") philosopherBearers += 1;
  }
}
if (philosopherBearers !== PINNED_PHILOSOPHER_HOMONYM_BEARERS) {
  errors.push(
    `philosopher homonym bearers (grc + grcHomonymForm) drifted: expected ${PINNED_PHILOSOPHER_HOMONYM_BEARERS}, got ${philosopherBearers} (update the pin if a homonym split was deliberately changed)`,
  );
}

// ------------------------------------------------- 4. positive controls
if (philosophersWithGrc.length === 0 || formsChecked === 0) {
  errors.push(
    "positive control failed: no Greek forms were seen at all; the check is vacuous (grc assembly in annotate.ts may have moved)",
  );
}
if (philosopherBearers === 0) {
  errors.push(
    "positive control failed: no philosopher carried both grc and grcHomonymForm; the homonym linking in annotate.ts may have moved",
  );
}

if (errors.length > 0) {
  console.error(
    `validate-philosopher-greek-names: ${errors.length} problem(s):`,
  );
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}

console.log(
  `validate-philosopher-greek-names: OK (${philosophersWithGrc.length} philosophers with grc, ${philosopherBearers} homonym bearers grc===grcHomonymForm, ${formsChecked} Greek forms checked)`,
);
