/**
 * Validates the Index homonym cross-notes (annotate.ts, linkHomonyms).
 * The "by <author>" link in each note derives its URI at runtime by
 * matching the claims-layer author label against the tagged philosopher
 * entries. A label drift (rename, homonym split) would silently drop the
 * link, and a future label collision could point it at the wrong person.
 * This validator pins:
 *
 * 1. The exact set of homonym cross-refs: [entry label, homonym label,
 *    shared title, author, authorEntityUri] (exact snapshot, order-free).
 * 2. That every authorEntityUri is the tagged entry of a PHILOSOPHER
 *    whose label equals the author string exactly (never a homonymous
 *    non-philosopher entry, never a different person).
 * 3. That no cross-ref carries an author without a link when a tagged
 *    philosopher of that name exists (a dropped link fails loudly).
 *
 * Run from the workspace root:
 *   pnpm --filter @workspace/scripts run validate-homonyms
 */
import path from "node:path";

process.env["LAERTIUS_DATA_DIR"] ??= path.resolve(
  import.meta.dirname,
  "../../artifacts/api-server/data",
);

const { getIndexEntries } = await import(
  "../../artifacts/api-server/src/lib/annotate"
);

const errors: string[] = [];

// ---------------------------------------------------------------------
// Pinned snapshot: [entry label, homonym label, shared title,
// author | null, authorEntityUri | null], as served by
// /api/annotations/entities.
// ---------------------------------------------------------------------
type Row = [string, string, string, string | null, string | null];

const PLATO = "https://humanisticadigitalia.eu/Laertius/philosopher/plato";
const PINNED: Row[] = [
  ["On Nature", "Timaeus, or On Nature", "On Nature", "Plato", PLATO],
  ["On Philosophy", "The Rivals, or On Philosophy", "On Philosophy", "Plato", PLATO],
  ["On Philosophy", "Theages, or On Philosophy", "On Philosophy", "Plato", PLATO],
  ["On Pleasure", "Philebus, or On Pleasure", "On Pleasure", "Plato", PLATO],
  ["On Love", "Phaedrus, or On Love", "On Love", "Plato", PLATO],
  ["On Law", "Minos, or On Law", "On Law", "Plato", PLATO],
  ["On Friendship", "Lysis, or On Friendship", "On Friendship", "Plato", PLATO],
  ["On Knowledge", "Theaetetus, or On Knowledge", "On Knowledge", "Plato", PLATO],
  ["On Virtue", "Meno, or On Virtue", "On Virtue", "Plato", PLATO],
  ["On Ideas", "Parmenides, or On Ideas", "On Ideas", "Plato", PLATO],
  ["On Legislation", "Laws, or On Legislation", "On Legislation", "Plato", PLATO],
  ["On the Good", "The Banquet, or On the Good", "On the Good", "Plato", PLATO],
  [
    "On the Nature of Man",
    "Alcibiades, or On the Nature of Man",
    "On the Nature of Man",
    "Plato",
    PLATO,
  ],
  [
    "Alcibiades, or On the Nature of Man",
    "On the Nature of Man",
    "On the Nature of Man",
    "Zeno of Citium",
    "https://humanisticadigitalia.eu/Laertius/philosopher/zeno-of-citium",
  ],
  [
    "Laws, or On Legislation",
    "On Legislation",
    "On Legislation",
    "Speusippus",
    "https://humanisticadigitalia.eu/Laertius/philosopher/speusippus",
  ],
  ["Lysis, or On Friendship", "On Friendship", "On Friendship", null, null],
  [
    "Meno, or On Virtue",
    "On Virtue",
    "On Virtue",
    "Aristippus",
    "https://humanisticadigitalia.eu/Laertius/philosopher/aristippus",
  ],
  ["Minos, or On Law", "On Law", "On Law", null, null],
  [
    "Parmenides, or On Ideas",
    "On Ideas",
    "On Ideas",
    "Xenocrates",
    "https://humanisticadigitalia.eu/Laertius/philosopher/xenocrates",
  ],
  ["Phaedrus, or On Love", "On Love", "On Love", null, null],
  [
    "Philebus, or On Pleasure",
    "On Pleasure",
    "On Pleasure",
    "Antisthenes",
    "https://humanisticadigitalia.eu/Laertius/philosopher/antisthenes",
  ],
  [
    "The Banquet, or On the Good",
    "On the Good",
    "On the Good",
    "Xenocrates",
    "https://humanisticadigitalia.eu/Laertius/philosopher/xenocrates",
  ],
  ["The Rivals, or On Philosophy", "On Philosophy", "On Philosophy", null, null],
  [
    "The Rivals, or On Philosophy",
    "Theages, or On Philosophy",
    "On Philosophy",
    "Plato",
    PLATO,
  ],
  [
    "Theaetetus, or On Knowledge",
    "On Knowledge",
    "On Knowledge",
    "Simon",
    "https://humanisticadigitalia.eu/Laertius/philosopher/simon",
  ],
  ["Theages, or On Philosophy", "On Philosophy", "On Philosophy", null, null],
  [
    "Theages, or On Philosophy",
    "The Rivals, or On Philosophy",
    "On Philosophy",
    "Plato",
    PLATO,
  ],
  ["Timaeus, or On Nature", "On Nature", "On Nature", null, null],
];

const entries = getIndexEntries();

// Philosopher label -> entity URI, the same lookup linkHomonyms uses.
const philosopherUri = new Map<string, string>();
for (const e of entries) {
  if (e.kind === "philosopher") philosopherUri.set(e.label, e.entityUri);
}

const key = (r: Row) => JSON.stringify(r);
const actual: Row[] = [];
for (const e of entries) {
  for (const h of e.homonyms ?? []) {
    actual.push([
      e.label,
      h.label,
      h.sharedTitle,
      h.author ?? null,
      h.authorEntityUri ?? null,
    ]);

    // 2. The link must point at the philosopher whose label IS the author.
    if (h.authorEntityUri) {
      if (!h.author) {
        errors.push(
          `${e.label} -> ${h.label}: authorEntityUri without author`,
        );
      } else if (philosopherUri.get(h.author) !== h.authorEntityUri) {
        errors.push(
          `${e.label} -> ${h.label}: authorEntityUri ${h.authorEntityUri} is not the tagged philosopher entry for "${h.author}"`,
        );
      }
    }
    // 3. A named author with a tagged philosopher entry must be linked.
    if (h.author && !h.authorEntityUri && philosopherUri.has(h.author)) {
      errors.push(
        `${e.label} -> ${h.label}: author "${h.author}" is a tagged philosopher but the link is missing`,
      );
    }
  }
}

// 1. Exact snapshot, order-free.
const pinnedSet = new Map(PINNED.map((r) => [key(r), r]));
const actualSet = new Map(actual.map((r) => [key(r), r]));
if (actual.length !== PINNED.length) {
  errors.push(
    `cross-ref count changed: expected ${PINNED.length}, got ${actual.length}`,
  );
}
for (const [k] of pinnedSet) {
  if (!actualSet.has(k)) errors.push(`missing pinned cross-ref: ${k}`);
}
for (const [k] of actualSet) {
  if (!pinnedSet.has(k)) errors.push(`unpinned new cross-ref: ${k}`);
}

if (errors.length) {
  console.error(`validate-homonyms: ${errors.length} error(s)`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}
console.log(
  `validate-homonyms OK: ${actual.length} homonym cross-refs pinned, ` +
    `${actual.filter((r) => r[4]).length} author links verified`,
);
