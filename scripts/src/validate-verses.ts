/**
 * Validates the extracted verse / epigram layer (laertius_verses.jsonl):
 *  - pins the expected total and the known Greek/English mismatch set
 *    (sections where the two editions tag a different number of blockquotes,
 *    so the English side is intentionally left null);
 *  - asserts every verse's sectionId exists in the corpus, ids are well formed,
 *    Greek lines are always present, and no TEI markup leaked through;
 *  - validates the curated authorship map (verse-authors.ts): every key is a
 *    real verse id, corpus-name authors match the corpus exactly, non-corpus
 *    authors have a Wikidata QID in ENTITY_QIDS unless deliberately unmapped,
 *    and pins the attribution totals.
 *
 * Regenerate the data first with `parse-verses-tei`, then run:
 *   pnpm --filter @workspace/scripts run validate-verses
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import { VERSE_PIN_COUNT } from "./layer-pins";

process.env["LAERTIUS_DATA_DIR"] ??= path.resolve(
  import.meta.dirname,
  "../../artifacts/api-server/data",
);

const { sectionById, corpus } = await import(
  "../../artifacts/api-server/src/lib/corpus"
);
const { VERSE_AUTHORS } = await import(
  "../../artifacts/api-server/src/lib/verse-authors"
);
const { ENTITY_QIDS } = await import(
  "../../artifacts/api-server/src/lib/entity-links"
);
const { verseGenre, listVerses } = await import(
  "../../artifacts/api-server/src/lib/verses"
);

const versesPath = path.resolve(
  process.env["LAERTIUS_DATA_DIR"],
  "laertius_verses.jsonl",
);

interface VerseRecord {
  id: string;
  sectionId: string;
  book: number;
  philosopher: string;
  school: string;
  linesGrc: string[];
  linesEn: string[] | null;
  source: string | null;
  continued: boolean;
}

const EXPECTED_TOTAL = VERSE_PIN_COUNT;

// Sections whose Greek and English editions tag a different number of
// blockquotes; the English side is left null there rather than mis-aligned.
const EXPECTED_MISMATCHES = new Set([
  "1.1.33",
  "1.5.84",
  "2.10.107",
  "2.11.120",
  "4.3.19",
  "6.2.53",
  "6.5.87",
  "6.5.92",
  "7.1.15",
  "7.1.27",
  "7.1.67",
  "8.1.45",
  "9.11.69",
  "10.1.126",
]);

const MARKUP = /<[a-zA-Z/]|&lt;|&gt;|&amp;/;

const verses: VerseRecord[] = readFileSync(versesPath, "utf-8")
  .split("\n")
  .filter((l) => l.trim().length > 0)
  .map((l) => JSON.parse(l) as VerseRecord);

const errors: string[] = [];
let grcLinesChecked = 0;

if (verses.length !== EXPECTED_TOTAL) {
  errors.push(`expected ${EXPECTED_TOTAL} verses, found ${verses.length}`);
}

const seenIds = new Set<string>();
for (const v of verses) {
  if (seenIds.has(v.id)) errors.push(`duplicate id ${v.id}`);
  seenIds.add(v.id);
  if (!v.id.startsWith(`${v.sectionId}#`)) {
    errors.push(`malformed id ${v.id} for section ${v.sectionId}`);
  }
  if (!sectionById.has(v.sectionId)) {
    errors.push(`unknown section ${v.sectionId} (${v.id})`);
  }
  if (!Array.isArray(v.linesGrc) || v.linesGrc.length === 0) {
    errors.push(`empty Greek lines in ${v.id}`);
  } else {
    grcLinesChecked += v.linesGrc.length;
  }
  const texts = [...v.linesGrc, ...(v.linesEn ?? []), v.source ?? ""];
  for (const t of texts) {
    if (MARKUP.test(t)) errors.push(`leftover markup in ${v.id}: ${t.slice(0, 60)}`);
  }
}

const foundMismatches = new Set(
  verses.filter((v) => v.linesEn === null).map((v) => v.sectionId),
);
for (const id of foundMismatches) {
  if (!EXPECTED_MISMATCHES.has(id)) errors.push(`unexpected mismatch section ${id}`);
}
for (const id of EXPECTED_MISMATCHES) {
  if (!foundMismatches.has(id)) errors.push(`expected mismatch section ${id} not found`);
}

// ---- curated authorship map (verse-authors.ts) ----
const EXPECTED_ATTRIBUTED = 233;
const EXPECTED_AUTHORS = 62;
const EXPECTED_LAERTIUS_OWN = 55;

// Verse authors without a safe Wikidata item (documented in entity-links.ts).
const UNMAPPED_AUTHORS = new Set([
  "Linus",
  "Diodotus",
  "Demetrius the epic poet",
]);

const corpusPhilosophers = new Set(corpus.map((s) => s.philosopher));
const authorEntries = Object.entries(VERSE_AUTHORS);
for (const [id, author] of authorEntries) {
  if (!seenIds.has(id)) errors.push(`author entry for unknown verse ${id}`);
  if (!author.trim()) errors.push(`empty author for ${id}`);
}
const authorNames = new Set(Object.values(VERSE_AUTHORS));
for (const a of authorNames) {
  if (a === "Diogenes Laertius" || corpusPhilosophers.has(a)) continue;
  if (!ENTITY_QIDS[a] && !UNMAPPED_AUTHORS.has(a)) {
    errors.push(`non-corpus author "${a}" has no QID and is not documented as unmapped`);
  }
}
for (const a of UNMAPPED_AUTHORS) {
  if (!authorNames.has(a)) errors.push(`unmapped author "${a}" no longer used`);
  if (ENTITY_QIDS[a]) errors.push(`author "${a}" is both unmapped and in ENTITY_QIDS`);
}
const laertiusOwn = authorEntries.filter(
  ([, a]) => a === "Diogenes Laertius",
).length;
if (authorEntries.length !== EXPECTED_ATTRIBUTED) {
  errors.push(
    `expected ${EXPECTED_ATTRIBUTED} attributed verses, found ${authorEntries.length}`,
  );
}
if (authorNames.size !== EXPECTED_AUTHORS) {
  errors.push(`expected ${EXPECTED_AUTHORS} authors, found ${authorNames.size}`);
}
if (laertiusOwn !== EXPECTED_LAERTIUS_OWN) {
  errors.push(
    `expected ${EXPECTED_LAERTIUS_OWN} epigrams of Diogenes Laertius' own, found ${laertiusOwn}`,
  );
}

// ---- computed epigram genre (verseGenre in verses.ts: Anthology-sourced
// pieces plus D.L.'s own Pammetros epigrams) ----
const EXPECTED_EPIGRAMS = 101;
const epigramCount = verses.filter((v) => verseGenre(v) === "epigram").length;
if (epigramCount !== EXPECTED_EPIGRAMS) {
  errors.push(
    `expected ${EXPECTED_EPIGRAMS} epigrams, found ${epigramCount}`,
  );
}

// ---- listVerses filter pins (the /api/verses query params behind the
// Verses page's poet, genre, and book filters): each filter's result is
// compared row-by-row against an independently computed expected id set,
// so a filtering regression fails with the named drifting rows ----
function pinFilter(label: string, got: { id: string }[], expected: Set<string>) {
  const gotIds = new Set(got.map((v) => v.id));
  for (const id of expected) {
    if (!gotIds.has(id)) errors.push(`${label}: missing expected row ${id}`);
  }
  for (const id of gotIds) {
    if (!expected.has(id)) errors.push(`${label}: unexpected row ${id}`);
  }
  if (gotIds.size !== got.length) errors.push(`${label}: duplicate rows returned`);
}

// author=Diogenes Laertius must return exactly his Pammetros epigrams
// (the ids curated to him in verse-authors.ts).
const laertiusIds = new Set(
  authorEntries.filter(([, a]) => a === "Diogenes Laertius").map(([id]) => id),
);
pinFilter(
  "filter author=Diogenes Laertius",
  listVerses({ author: "Diogenes Laertius" }),
  laertiusIds,
);
// The author filter is case-insensitive on the Verses page.
pinFilter(
  "filter author=diogenes laertius (case-insensitive)",
  listVerses({ author: "diogenes laertius" }),
  laertiusIds,
);

// genre=epigram must match the deterministic rule exactly:
// Anth. Pal./Plan. sources plus D.L.'s own pieces.
const epigramIds = new Set(
  verses.filter((v) => verseGenre(v) === "epigram").map((v) => v.id),
);
pinFilter("filter genre=epigram", listVerses({ genre: "epigram" }), epigramIds);

// A book filter must return only (and all of) that book's verses.
for (const book of [1, 7]) {
  pinFilter(
    `filter book=${book}`,
    listVerses({ book }),
    new Set(verses.filter((v) => v.book === book).map((v) => v.id)),
  );
}

// philosopher= is a case-insensitive substring match on the chapter subject.
pinFilter(
  "filter philosopher=thales",
  listVerses({ philosopher: "thales" }),
  new Set(verses.filter((v) => v.philosopher === "Thales").map((v) => v.id)),
);

// Combined filters intersect: D.L.'s epigrams in book 1 only.
pinFilter(
  "filter book=1&author=Diogenes Laertius",
  listVerses({ book: 1, author: "Diogenes Laertius" }),
  new Set(
    verses
      .filter((v) => v.book === 1 && laertiusIds.has(v.id))
      .map((v) => v.id),
  ),
);

// A q= search must only return rows containing hits and rank them; pin that
// a known phrase from Thales' famous epigram surfaces its verse first.
const qHits = listVerses({ q: "starry skies" });
if (qHits.length === 0) {
  errors.push("filter q=starry skies: no results");
} else if (qHits[0]!.philosopher !== "Thales") {
  errors.push(
    `filter q=starry skies: expected a Thales verse first, got ${qHits[0]!.id} (${qHits[0]!.philosopher})`,
  );
}
// An unfiltered call must return the whole layer in corpus order.
const all = listVerses({});
if (all.length !== verses.length) {
  errors.push(
    `unfiltered listVerses returned ${all.length} rows, expected ${verses.length}`,
  );
}

// Positive control: the Greek-lines check above is only meaningful if it
// actually ran against extracted Greek text. If no verse contributed a
// single Greek line, the check is vacuous — fail loudly instead of passing
// (mirrors the grcChecked guard in validate-claims.ts).
if (grcLinesChecked === 0) {
  errors.push(
    "GREEK LINES CHECK VACUOUS: no verse has any Greek lines (positive control failed)",
  );
}

if (errors.length > 0) {
  console.error(`INVALID VERSES (${errors.length}):`);
  for (const e of errors) console.error("  " + e);
  process.exit(1);
}

const withEn = verses.filter((v) => v.linesEn !== null).length;
const withSrc = verses.filter((v) => v.source).length;
const continued = verses.filter((v) => v.continued).length;
console.log(
  `OK: ${verses.length} verses, ${withEn} with English, ${withSrc} with source, ` +
    `${continued} continued, ${foundMismatches.size} mismatch sections, ` +
    `${authorEntries.length} attributed to ${authorNames.size} authors ` +
    `(${laertiusOwn} Diogenes Laertius' own), ${epigramCount} epigrams`,
);
