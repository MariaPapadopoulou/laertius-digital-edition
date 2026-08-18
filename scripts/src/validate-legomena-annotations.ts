/**
 * Legomena annotation round-trip: the annotation layer STORED in the
 * committed dataset must reproduce, span for span, what the laertius
 * runtime tagger produces from the curated sources - and the passage text
 * literals must be byte-identical to the corpus. This is what licenses the
 * companion app to render highlights with no runtime tagger at all.
 *
 * Compares, per section: greek/english text literals, then the full
 * annotation tuple (start, end, lang, entity, exact quote, name body,
 * concept bodies). Prints positive counts; fails on any drift.
 *
 * Run from the workspace root:
 *   pnpm --filter @workspace/scripts run validate-legomena-annotations
 */
import path from "node:path";

process.env["LAERTIUS_DATA_DIR"] ??= path.resolve(
  import.meta.dirname,
  "../../artifacts/api-server/data",
);

let failed = false;
let failures = 0;
function fail(msg: string): void {
  failures += 1;
  if (failures <= 25) console.error(`  ✗ ${msg}`);
  failed = true;
}

async function main(): Promise<void> {
  const { initStore, getStore } = await import(
    "../../artifacts/legomena-api/src/store"
  );
  const { buildModel } = await import(
    "../../artifacts/legomena-api/src/model"
  );
  initStore();
  const model = buildModel(getStore());

  const { corpus } = await import(
    "../../artifacts/api-server/src/lib/corpus"
  );
  const { annotateSection } = await import(
    "../../artifacts/api-server/src/lib/annotate"
  );

  if (model.passagesOrdered.length !== corpus.length) {
    fail(
      `store has ${model.passagesOrdered.length} passages, corpus has ${corpus.length} sections`,
    );
  }

  const tuple = (a: {
    start: number;
    end: number;
    lang: string;
    entityUri: string;
    text: string;
    nameUri?: string;
    conceptUris?: string[];
  }): string =>
    [
      a.start,
      a.end,
      a.lang,
      a.entityUri,
      a.text,
      a.nameUri ?? "",
      [...(a.conceptUris ?? [])].sort().join("|"),
    ].join("\u0000");

  let sections = 0;
  let spans = 0;
  let english = 0;
  for (const section of corpus) {
    const p = model.passageById.get(section.id);
    if (!p) {
      fail(`section ${section.id} missing from the dataset store`);
      continue;
    }
    if (p.greekText !== section.text) {
      fail(`${section.id}: stored greekText differs from corpus text`);
    }
    const expectedEn = section.textEn ?? undefined;
    if (p.englishText !== expectedEn) {
      fail(`${section.id}: stored englishText differs from corpus textEn`);
    }
    if (p.englishText !== undefined) english += 1;
    const want = annotateSection(section)
      .map((a) =>
        tuple({
          start: a.start,
          end: a.end,
          lang: a.lang,
          entityUri: a.entityUri,
          text: a.surface,
          nameUri: a.nameUri,
          conceptUris: a.conceptUris,
        }),
      )
      .sort();
    const got = p.annotations
      .map((a) =>
        tuple({
          start: a.start,
          end: a.end,
          lang: a.lang,
          entityUri: a.entityUri,
          text: a.exact,
          nameUri: a.nameUri,
          conceptUris: a.conceptUris,
        }),
      )
      .sort();
    if (want.length !== got.length) {
      fail(
        `${section.id}: ${got.length} stored annotations, tagger produces ${want.length}`,
      );
    } else if (want.some((w, i) => w !== got[i])) {
      fail(`${section.id}: annotation tuples drifted`);
    } else {
      spans += want.length;
    }
    sections += 1;
  }

  // Positive controls: the round-trip must have compared real volume.
  if (sections < 1000) fail(`only ${sections} sections compared (< 1000)`);
  if (spans < 5000) fail(`only ${spans} annotation tuples matched (< 5000)`);
  if (english === 0) fail("no English text literals found in the dataset");

  if (failed) {
    console.error(
      `validate-legomena-annotations: FAILED (${failures} failures)`,
    );
    process.exit(1);
  }
  console.log(
    `✓ Annotation round-trip: ${sections} sections, ${spans} annotation tuples identical, ${english} English literals - dataset layer == runtime tagger`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
