/**
 * Validates the Greek-lookup collision guard (annotate.ts buildIndex).
 *
 * The Index matches pasted Greek names via the grc field on the
 * annotated-entities payload. For place, person and source entries, the
 * guard deliberately WITHHOLDS grc when the curated nominative's slug is
 * shared by two or more differently-labelled bearers and the entry is not
 * a certified homonym bearer, so a shared form never surfaces one bearer
 * while silently hiding another. When NO bearer of a shared form would
 * surface it at all (no philosopher and no certified bearer), the guard
 * instead grants grc to ALL bearers: hiding everyone would strand a
 * reader pasting the form (e.g. Ζεῦξις) on an empty Index, and showing
 * all bearers hides nobody. The flip side: if a future curation pass
 * adds a new bearer whose nominative collides with an existing one, the
 * existing entries silently LOSE their grc and Greek lookup for that name
 * goes dead with no failing check.
 *
 * This validator pins:
 *
 * 1. The exact withheld set as [label, kind, Greek form] triples: an
 *    entry that has a curated nominative (greekNameSpec) but no grc on
 *    its index summary. A new collision (a fresh withheld pair) or a
 *    certification change fails naming the label and form, so the
 *    curator decides whether to certify the bearer instead.
 * 2. That philosophers ALWAYS carry grc (their collisions get
 *    grcHomonymForm notes, never withholding).
 * 3. The per-kind grc counts (philosopher, place, person, source), so a
 *    dropped grc entry anywhere fails even outside the withheld set.
 * 4. Positive controls: unique-form entries carry grc, certified bearers
 *    carry grc despite their shared form, and every pinned withheld
 *    label really shares its form with another differently-labelled
 *    bearer (the withholding is never vacuous).
 *
 * A deliberate change (new curated Greek forms, a newly certified
 * bearer) requires updating the pins here.
 *
 * Run from the workspace root:
 *   pnpm --filter @workspace/scripts run validate-grc-withheld
 */
import path from "node:path";

process.env["LAERTIUS_DATA_DIR"] ??= path.resolve(
  import.meta.dirname,
  "../../artifacts/api-server/data",
);

const { getEntitySummaries } = await import(
  "../../artifacts/api-server/src/lib/annotate"
);
const { greekNameSpec } = await import(
  "../../artifacts/api-server/src/lib/greek-names"
);
const { GREEK_HOMONYM_CERTIFIED_BEARERS } = await import(
  "../../artifacts/api-server/src/lib/lod"
);
const { unicodeSlug } = await import(
  "../../artifacts/api-server/src/lib/kg-claims"
);

const errors: string[] = [];

// ---------------------------------------------------------------------
// Pinned withheld set: [label, kind, curated Greek form], sorted by
// label. These entries have a curated nominative but the collision
// guard withholds grc, so Greek lookup deliberately does not surface
// them; the grcHomonymForm notes on the certified bearers disambiguate.
// ---------------------------------------------------------------------
type Withheld = [string, string, string];

// 2026-07 fully-withheld rescue: forms with NO surfacing bearer at all
// (no philosopher, no certified bearer — Ἀλέξανδρος, Ἀριστοφάνης,
// Δάμων, Διόδωρος, Διοσκουρίδης, Πτολεμαῖος, Ζεῦξις) now surface ALL
// their bearers instead of stranding a pasted form on an empty Index,
// so only forms with a surfacing bearer remain withheld here.
const PINNED_WITHHELD: Withheld[] = [
  ["Dionysius the Elder", "person", "Διονύσιος"],
  ["Dionysius the Stoic", "source", "Διονύσιος"],
  ["Dionysius the Younger", "person", "Διονύσιος"],
  // 2026-08: Heraclides of Heraclea got a scoped Index entry (7.166,
  // competency chip pass); his identity vs. Ponticus is unsettled
  // (entity-links.ts), so he stays uncertified and the shared form is
  // withheld from his card like the other bare-Heraclides bearers.
  ["Heraclides of Heraclea", "person", "Ἡρακλείδης"],
  ["Heraclides of Tarsus", "source", "Ἡρακλείδης"],
  ["Heraclides the Sceptic", "person", "Ἡρακλείδης"],
  ["Zeno of Tarsus", "source", "Ζήνων"],
];

// Per-kind counts of index entries carrying grc. Philosophers must all
// carry it; the other kinds pin the guard's current pass-through.
const PINNED_GRC_COUNTS: Record<string, number> = {
  philosopher: 82,
  place: 160,
  // 101 since the occurrence-level Cratinus split surfaced "Cratinus"
  // and "Cratinus the Younger" as grc-carrying person entries.
  // 102 since the 2026-08 competency chip pass surfaced "Bryson"
  // (fully-withheld form Βρύσων — both bearers keep grc).
  person: 102,
  source: 115,
};

const GUARDED_KINDS = new Set(["person", "place", "source"]);

const entries = getEntitySummaries();

// ---------------------------------------------------------------------
// 1. Exact withheld snapshot.
// ---------------------------------------------------------------------
const actualWithheld: Withheld[] = entries
  .filter((e) => GUARDED_KINDS.has(e.kind) && !e.grc && greekNameSpec(e.label))
  .map((e): Withheld => [e.label, e.kind, greekNameSpec(e.label)!.grc])
  .sort((a, b) => a[0].localeCompare(b[0]));

const key = (w: Withheld) => JSON.stringify(w);
const pinnedSet = new Set(PINNED_WITHHELD.map(key));
const actualSet = new Set(actualWithheld.map(key));
for (const k of pinnedSet) {
  if (!actualSet.has(k)) {
    const [label, kind, form] = JSON.parse(k) as Withheld;
    errors.push(
      `pinned withheld entry now carries grc (newly certified or collision gone): ` +
        `"${label}" (${kind}, ${form}); update the pin if deliberate`,
    );
  }
}
for (const k of actualSet) {
  if (!pinnedSet.has(k)) {
    const [label, kind, form] = JSON.parse(k) as Withheld;
    errors.push(
      `NEW withheld entry: "${label}" (${kind}) lost its Greek lookup for ` +
        `"${form}"; a new bearer collides with it. Certify the bearers in ` +
        `GREEK_HOMONYM_CERTIFIED_BEARERS or update the pin`,
    );
  }
}

// ---------------------------------------------------------------------
// 2. Philosophers always carry grc.
// ---------------------------------------------------------------------
for (const e of entries) {
  if (e.kind === "philosopher" && greekNameSpec(e.label) && !e.grc) {
    errors.push(
      `philosopher "${e.label}" has a curated Greek form but no grc on its index entry`,
    );
  }
}

// ---------------------------------------------------------------------
// 3. Per-kind grc counts.
// ---------------------------------------------------------------------
for (const [kind, expected] of Object.entries(PINNED_GRC_COUNTS)) {
  const got = entries.filter((e) => e.kind === kind && e.grc).length;
  if (got !== expected) {
    errors.push(
      `${kind} entries carrying grc: expected ${expected}, got ${got}`,
    );
  }
}

// ---------------------------------------------------------------------
// 4. Positive controls.
// ---------------------------------------------------------------------
// 4a. A unique-form entry of each guarded kind carries grc.
const CONTROLS: [string, string][] = [
  ["Favorinus", "source"],
  ["Athens", "place"],
  ["Croesus", "person"],
];
for (const [label, kind] of CONTROLS) {
  const e = entries.find((x) => x.label === label && x.kind === kind);
  if (!e) errors.push(`positive control missing: "${label}" (${kind}) not in index`);
  else if (!e.grc)
    errors.push(`positive control failed: "${label}" (${kind}) carries no grc`);
}
// 4b. A certified bearer carries grc despite its shared form.
let certifiedWithGrc = 0;
for (const e of entries) {
  if (
    GUARDED_KINDS.has(e.kind) &&
    GREEK_HOMONYM_CERTIFIED_BEARERS.has(e.label) &&
    e.grc
  ) {
    certifiedWithGrc += 1;
  }
}
if (certifiedWithGrc === 0) {
  errors.push(
    "positive control failed: no certified homonym bearer carries grc (guard withholds everything?)",
  );
}
// 4c. Every pinned withheld label really shares its form's slug with
//     another differently-labelled bearer that has a curated form.
const labelsBySlug = new Map<string, Set<string>>();
for (const e of entries) {
  if (e.kind !== "philosopher" && !GUARDED_KINDS.has(e.kind)) continue;
  const spec = greekNameSpec(e.label);
  if (!spec) continue;
  const slug = unicodeSlug(spec.grc);
  const set = labelsBySlug.get(slug) ?? new Set<string>();
  set.add(e.label);
  labelsBySlug.set(slug, set);
}
for (const [label, , form] of actualWithheld) {
  const bearers = labelsBySlug.get(unicodeSlug(form));
  if (!bearers || bearers.size < 2) {
    errors.push(
      `"${label}" is withheld for "${form}" but no other bearer shares the form (vacuous withholding)`,
    );
  }
}
// 4d. No fully-withheld form: every withheld form must still surface at
//     least one bearer via grc (a philosopher or certified bearer), so
//     a pasted form never yields an empty Index.
const grcSlugsSurfaced = new Set(
  entries.filter((e) => e.grc).map((e) => unicodeSlug(e.grc!)),
);
for (const [label, , form] of actualWithheld) {
  if (!grcSlugsSurfaced.has(unicodeSlug(form))) {
    errors.push(
      `fully-withheld form: "${form}" (withheld from "${label}") surfaces NO bearer; ` +
        `the guard must grant grc to all bearers of such forms`,
    );
  }
}

if (errors.length) {
  console.error(`validate-grc-withheld: ${errors.length} error(s)`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}
console.log(
  `validate-grc-withheld OK: ${actualWithheld.length} withheld (label, form) pairs pinned; ` +
    `grc counts philosopher=${PINNED_GRC_COUNTS["philosopher"]}, place=${PINNED_GRC_COUNTS["place"]}, ` +
    `person=${PINNED_GRC_COUNTS["person"]}, source=${PINNED_GRC_COUNTS["source"]}; ` +
    `${certifiedWithGrc} certified bearers keep grc`,
);
