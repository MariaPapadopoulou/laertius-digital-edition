/**
 * Validates the curated Greek nominatives the Index payload carries for
 * NON-philosopher entries (annotate.ts buildIndex): person, place and
 * source entries get `grc` only when the nominative slug is unique
 * across differently-labelled bearers, or the entry is a certified
 * homonym bearer whose collision the grcHomonymForm notes disambiguate.
 * validate-philosopher-greek-names pins the philosopher side; nothing
 * pinned these, so a curation edit or a new colliding bearer could
 * silently strip Greek names from dozens of entries. This validator
 * asserts:
 *
 * 1. Pinned coverage: the counts of person / place / source index
 *    entries carrying `grc` are pinned, so a silent drop fails loudly.
 * 2. Suppression is real: every suppressed entry (a curated spec exists
 *    in greek-names.ts but the entry carries no `grc`) genuinely shares
 *    its nominative slug with at least one DIFFERENTLY-labelled bearer
 *    among the index entries that carry a spec, and is not a certified
 *    bearer (certified bearers always keep grc). The suppressed counts
 *    are pinned too, so a rule change surfaces.
 * 3. No over-suppression: every entry whose spec slug is unique across
 *    differently-labelled bearers carries `grc`, and every certified
 *    bearer with a spec carries `grc`.
 * 4. Positive controls: pinned counts and the suppressed set must be
 *    > 0, so the check can never go vacuously green if the payload
 *    fields or the suppression logic move.
 *
 * A deliberate change (a new curated name, a new certified bearer)
 * requires updating the pins.
 *
 * Run from the workspace root:
 *   pnpm --filter @workspace/scripts run validate-index-greek-names
 */
import path from "node:path";

process.env["LAERTIUS_DATA_DIR"] ??= path.resolve(
  import.meta.dirname,
  "../../artifacts/api-server/data",
);

const { getIndexEntries } = await import(
  "../../artifacts/api-server/src/lib/annotate"
);
const { greekNameSpec } = await import(
  "../../artifacts/api-server/src/lib/greek-names"
);
const { unicodeSlug } = await import(
  "../../artifacts/api-server/src/lib/kg-claims"
);
const { GREEK_HOMONYM_CERTIFIED_BEARERS } = await import(
  "../../artifacts/api-server/src/lib/lod"
);

/** Index entries carrying a curated Greek nominative, per kind.
 * 2026-07 fully-withheld rescue: forms with NO surfacing bearer at all
 * (no philosopher, no certified bearer) now grant grc to ALL bearers
 * instead of suppressing everyone, so a pasted form (e.g. Ζεῦξις)
 * never lands on an empty Index. That moved 7 person and 7 source
 * entries from suppressed to carrying grc. */
const PINNED_GRC_COUNTS: Record<string, number> = {
  // 2026-07 Cratinus split: +2 person entries (the two comic poets now
  // tag and carry their shared curated form Κρατῖνος).
  // 2026-08 competency chip pass: +1 person ("Bryson" — Βρύσων is a
  // fully-withheld form, so both Bryson bearers keep grc).
  person: 102,
  place: 160,
  source: 115,
};
/** Entries with a curated spec whose grc the collision rule suppresses
 * (only forms that still surface via a philosopher or certified bearer
 * suppress their other bearers). */
const PINNED_SUPPRESSED_COUNTS: Record<string, number> = {
  // 2026-08: +1 person — Heraclides of Heraclea's Ἡρακλείδης is
  // suppressed (Heraclides Ponticus surfaces the form; the Heraclea
  // bearer stays uncertified, see entity-links.ts).
  person: 4,
  place: 0,
  source: 3,
};

const KINDS = ["person", "place", "source"] as const;

const errors: string[] = [];
const entries = getIndexEntries();

// Distinct entry labels per nominative slug, over every kind that can
// carry a curated Greek name - the same superset buildIndex uses, so
// the collision assertion below mirrors the real suppression rule.
const labelsBySlug = new Map<string, Set<string>>();
for (const e of entries) {
  if (
    e.kind !== "philosopher" &&
    e.kind !== "person" &&
    e.kind !== "place" &&
    e.kind !== "source"
  )
    continue;
  const spec = greekNameSpec(e.label);
  if (!spec) continue;
  const slug = unicodeSlug(spec.grc);
  const set = labelsBySlug.get(slug) ?? new Set<string>();
  set.add(e.label);
  labelsBySlug.set(slug, set);
}

let totalWithGrc = 0;
let totalSuppressed = 0;

for (const kind of KINDS) {
  const ofKind = entries.filter((e) => e.kind === kind);
  const withGrc = ofKind.filter((e) => e.grc);
  totalWithGrc += withGrc.length;

  if (withGrc.length !== PINNED_GRC_COUNTS[kind]) {
    errors.push(
      `${kind} entries with grc drifted: expected ${PINNED_GRC_COUNTS[kind]}, got ${withGrc.length} (a curation edit or a new colliding bearer changed the Greek-name coverage; update the pin only if deliberate)`,
    );
  }

  const suppressed = ofKind.filter((e) => greekNameSpec(e.label) && !e.grc);
  totalSuppressed += suppressed.length;
  if (suppressed.length !== PINNED_SUPPRESSED_COUNTS[kind]) {
    errors.push(
      `suppressed ${kind} entries drifted: expected ${PINNED_SUPPRESSED_COUNTS[kind]}, got ${suppressed.length} (the collision-suppression outcome changed; update the pin only if deliberate)`,
    );
  }

  for (const e of suppressed) {
    const spec = greekNameSpec(e.label)!;
    const bearers = labelsBySlug.get(unicodeSlug(spec.grc));
    const others = [...(bearers ?? [])].filter((l) => l !== e.label);
    if (others.length === 0) {
      errors.push(
        `${kind} "${e.label}" lost its grc ${JSON.stringify(spec.grc)} without any differently-labelled bearer sharing the slug: the suppression rule fired wrongly (annotate.ts buildIndex)`,
      );
    }
    if (GREEK_HOMONYM_CERTIFIED_BEARERS.has(e.label)) {
      errors.push(
        `${kind} "${e.label}" is a certified homonym bearer but carries no grc: certified bearers must keep their Greek name (annotate.ts buildIndex)`,
      );
    }
  }

  // No over-suppression: unique slugs and certified bearers keep grc.
  for (const e of ofKind) {
    const spec = greekNameSpec(e.label);
    if (!spec || e.grc) continue;
    // already reported above via the suppressed loop when wrong; here we
    // only need the complementary direction:
    const bearers = labelsBySlug.get(unicodeSlug(spec.grc));
    if ((bearers?.size ?? 0) <= 1) {
      errors.push(
        `${kind} "${e.label}" has a unique nominative ${JSON.stringify(spec.grc)} yet carries no grc: the Index silently dropped a Greek name`,
      );
    }
  }
}

// ------------------------------------------------- positive controls
if (totalWithGrc === 0) {
  errors.push(
    "positive control failed: no person/place/source entry carried grc at all; the grc assembly in annotate.ts may have moved",
  );
}
if (totalSuppressed === 0) {
  errors.push(
    "positive control failed: no suppressed entry was seen; the collision-suppression rule in annotate.ts may have moved, making this check vacuous",
  );
}
if (GREEK_HOMONYM_CERTIFIED_BEARERS.size === 0) {
  errors.push(
    "positive control failed: GREEK_HOMONYM_CERTIFIED_BEARERS is empty; the certified-bearer escape hatch may have moved",
  );
}

if (errors.length > 0) {
  console.error(`validate-index-greek-names: ${errors.length} problem(s):`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}

console.log(
  `validate-index-greek-names: OK (${totalWithGrc} person/place/source entries with grc, ${totalSuppressed} collision-suppressed entries all share their slug with another bearer)`,
);
