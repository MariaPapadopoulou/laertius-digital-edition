/**
 * Sweeps EVERY competency question's served person chips and, for each
 * chip that ships a deep link (firstId), proves the link resolves
 * through a person-kind Index entry to a passage that actually names
 * the person.
 *
 * Background: firstSectionIdForPersonTerm (routes/competency.ts) is
 * kind-aware — Index entries of non-person kinds (a city like Croton,
 * a work title like Telauges) are dropped before a person chip's link
 * is resolved. validate-competency-person-links pins the two labels
 * that motivated the change; THIS sweep generalizes the guarantee to
 * all served person chips on all questions, so a future Index curation
 * change (e.g. a new place entry sharing a person's label) cannot
 * silently redirect any chip to the wrong bearer's passage.
 *
 * For every person chip with a firstId, asserts:
 *  - the served firstId matches a fresh firstSectionIdForPersonTerm
 *    resolution (route and helper cannot drift apart);
 *  - the resolving Index entry (unique by label, or by label+grc among
 *    person-kind entries) has a person kind (philosopher/person/source);
 *  - that entry's first tagged section IS the served firstId;
 *  - the firstId resolves to a real corpus section whose English text
 *    names the label — the passage is about THAT bearer, not a
 *    same-named city or book.
 * Also asserts, for chips WITHOUT a firstId, that resolution is indeed
 * empty/ambiguous (the route didn't silently drop a resolvable link).
 *
 * Positive counts are printed so a vacuous pass is impossible: the
 * sweep fails outright if no person chip with a firstId is served at
 * all, or if the known multi-kind collision (Croton) disappears from
 * the exercised set.
 *
 * Run from the workspace root:
 *   pnpm --filter @workspace/scripts run validate-competency-person-chip-sweep
 */
import path from "node:path";

process.env["LAERTIUS_DATA_DIR"] ??= path.resolve(
  import.meta.dirname,
  "../../artifacts/api-server/data",
);

const { getCompetencyQuestions, findCompetencyQuestion } = await import(
  "../../artifacts/api-server/src/lib/competency"
);
const { buildCompetencyAnswer, firstSectionIdForPersonTerm } = await import(
  "../../artifacts/api-server/src/routes/competency"
);
const { getIndexEntries, sectionsForEntity } = await import(
  "../../artifacts/api-server/src/lib/annotate"
);
const { sectionById } = await import(
  "../../artifacts/api-server/src/lib/corpus"
);

// Mirrors PERSON_INDEX_KINDS in routes/competency.ts. Kept as a local
// copy on purpose: if the route ever widens its kind set (say, adds
// "place"), this sweep fails loudly instead of inheriting the change.
const PERSON_KINDS = new Set(["philosopher", "person", "source"]);

let failures = 0;
function fail(msg: string) {
  failures++;
  console.error(`  FAIL: ${msg}`);
}

const questions = getCompetencyQuestions();
console.log(`Competency questions: ${questions.length}`);
if (questions.length === 0) fail("no competency questions in catalogue");

// Chips documented as UNLINKABLE (August 2026 curation pass, task
// "person chips with no link"): every one comes from the homonymy
// question, whose SPARQL rows surface the LOD graph's homonym-bearer
// entities. Each label below matches zero person-kind Index entries,
// and no safe Index curation exists:
//  - "Antigonus", "Ariston", "Demetrius", "Diogenes", "Heraclides":
//    bare claim-layer/source authority nodes that denote no single
//    certifiable individual (see the GREEK_HOMONYM_CERTIFIED_BEARERS
//    commentary in api-server lib/lod.ts) — no corpus occurrence can
//    be attributed to THAT node without guessing among bearers, so no
//    Index entry can ever carry the bare label;
//  - "Diogenes Laertius": the author never names himself in the Lives
//    (his epigrams are flagged, not signed), so there is no occurrence
//    to tag and no Index entry to link;
//  - "Demetrius the epic poet": named only inside the twenty-Demetrii
//    homonym list (5.83-85), where the text calls him "the second …
//    an epic poet" without repeating the bare name next to him — no
//    attributable surface occurrence exists.
// The two curatable chips of the same question (Bryson at 9.61,
// Heraclides of Heraclea at 7.166) got scoped gazetteer entries in the
// same pass and now ship links. If a label below ever ships a link,
// this documentation is stale — update it; if a NEW unlinked label
// appears, curate or document it.
const KNOWN_UNLINKED = new Set([
  "Antigonus",
  "Ariston",
  "Demetrius",
  "Demetrius the epic poet",
  "Diogenes",
  "Diogenes Laertius",
  "Heraclides",
]);

let personChips = 0;
let linkedChips = 0;
let unlinkedChips = 0;
let multiKindCollisions = 0;
const seenCollisionLabels = new Set<string>();

for (const meta of questions) {
  const question = findCompetencyQuestion(meta.id);
  if (!question) {
    fail(`catalogue lists ${meta.id} but findCompetencyQuestion misses it`);
    continue;
  }
  const answer = buildCompetencyAnswer(question);
  const persons = answer.terms.filter(
    (t): t is typeof t & { firstId?: string } => t.type === "person",
  );
  personChips += persons.length;

  for (const chip of persons) {
    const label = chip.en;
    const tag = `${meta.id} / ${label}`;
    const entries = getIndexEntries().filter((e) => e.label === label);
    const personEntries = entries.filter((e) => PERSON_KINDS.has(e.kind));
    if (entries.some((e) => !PERSON_KINDS.has(e.kind)) && personEntries.length > 0) {
      multiKindCollisions++;
      seenCollisionLabels.add(label);
    }

    // Route/helper drift check applies to every chip, linked or not.
    const resolved = firstSectionIdForPersonTerm(label, chip.grc);
    if ((chip.firstId ?? undefined) !== resolved) {
      fail(
        `${tag}: served firstId ${chip.firstId ?? "(none)"} != fresh resolution ${resolved ?? "(none)"}`,
      );
    }

    if (!chip.firstId) {
      unlinkedChips++;
      if (!KNOWN_UNLINKED.has(label)) {
        fail(
          `${tag}: NEW unlinked person chip — curate an Index entry or document it in KNOWN_UNLINKED`,
        );
      }
      // No link must mean genuinely unresolvable: zero person-kind
      // entries, or several that grc cannot split.
      if (personEntries.length === 1) {
        const wouldBe = sectionsForEntity(personEntries[0]!.entityUri)?.[0];
        if (wouldBe) {
          fail(
            `${tag}: ships NO firstId but a unique person-kind entry resolves to ${wouldBe}`,
          );
        }
      }
      continue;
    }

    linkedChips++;
    if (KNOWN_UNLINKED.has(label)) {
      fail(
        `${tag}: ships a link but is documented as unlinkable — update KNOWN_UNLINKED`,
      );
    }

    // The resolving entry must be person-kind and unique among the
    // person-kind candidates (directly or via the chip's Greek form).
    let entry = personEntries.length === 1 ? personEntries[0] : undefined;
    if (!entry && personEntries.length > 1 && chip.grc) {
      const byGrc = personEntries.filter((e) => e.grc === chip.grc);
      if (byGrc.length === 1) entry = byGrc[0];
    }
    if (!entry) {
      fail(
        `${tag}: ships firstId ${chip.firstId} but no unique person-kind Index entry resolves it ` +
          `(entries: ${entries.map((e) => `${e.kind}:${e.grc ?? "-"}`).join(", ") || "none"})`,
      );
      continue;
    }
    if (!PERSON_KINDS.has(entry.kind)) {
      fail(`${tag}: resolving entry has non-person kind "${entry.kind}"`);
    }
    const first = sectionsForEntity(entry.entityUri)?.[0];
    if (first !== chip.firstId) {
      fail(
        `${tag}: served firstId ${chip.firstId} is not the person entry's first tagged section (${first ?? "none"})`,
      );
    }
    const sec = sectionById.get(chip.firstId);
    if (!sec) {
      fail(`${tag}: firstId ${chip.firstId} is not a real corpus section`);
      continue;
    }
    // The passage must name the person. Chip labels are often
    // qualified for disambiguation ("Idomeneus of Lampsacus",
    // "Ptolemy Soter", "Alexander the Great") while the passage uses
    // the bare name, so accept the full label or its base name (the
    // first word) — never an unrelated string. The base name is what
    // a same-named city or book title would also collide on, so this
    // still catches a redirect to a passage about a different bearer
    // of a DIFFERENT name, and the kind/first-section checks above
    // catch a same-named non-person entry.
    const baseName = label.split(/\s+/)[0]!;
    if (
      !sec.textEn ||
      !(sec.textEn.includes(label) || sec.textEn.includes(baseName))
    ) {
      fail(
        `${tag}: linked section ${chip.firstId} English text names neither "${label}" nor "${baseName}"`,
      );
    }
  }
}

console.log(
  `Person chips served: ${personChips} (linked: ${linkedChips}, unlinked: ${unlinkedChips})`,
);
console.log(
  `Multi-kind label collisions exercised: ${multiKindCollisions} ` +
    `(${[...seenCollisionLabels].sort().join(", ") || "none"})`,
);

// Positive controls: the sweep must actually exercise linked chips and
// the known cross-kind collision that motivated the kind-aware fix.
if (personChips === 0) fail("no person chips served at all (vacuous sweep)");
if (linkedChips === 0) fail("no person chip ships a firstId (vacuous sweep)");
if (!seenCollisionLabels.has("Croton")) {
  fail(
    "the known Croton place/person collision was not exercised — sweep lost its positive control",
  );
}

if (failures > 0) {
  console.error(
    `validate-competency-person-chip-sweep FAILED: ${failures} check(s)`,
  );
  process.exit(1);
}
console.log("validate-competency-person-chip-sweep passed");
