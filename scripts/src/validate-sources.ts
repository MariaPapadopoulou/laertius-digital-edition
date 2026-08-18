/**
 * Validates the sources-index layer (data/dl_sources.jsonl + the
 * sources-index.ts reconciliation):
 *  - pins the workbook totals (rows, groups by kind, minted nodes, QIDs,
 *    anonymous rows, reference counts) so silent drift is caught;
 *  - asserts structural invariants: unique well-formed ids, well-formed
 *    parsed refs, QID/enwiki shape, every row lands in exactly one group
 *    or the anonymous list, altLabels never duplicate the canonical label;
 *  - pins the known set of refs that do not resolve to a corpus section
 *    (workbook references outside the Perseus text) — any new unresolved
 *    ref is an error;
 *  - validates the curated citation section pins (CITATION_REF_SECTION in
 *    lod.ts): each pin must reference a live row id + ref and a section id
 *    among the ref's corpus candidates, and every ambiguous ref on a
 *    citation row must carry a pin (new ambiguity = conscious curation);
 *  - cross-checks reconciliation: existing groups must point at labels the
 *    LOD graph really has (philosophers / claim entities / saying sources),
 *    minted groups must not collide with existing source labels (the
 *    loader throws on collision, exercised here).
 *
 * Regenerate the data first with `parse-sources-xlsx`, then run:
 *   pnpm --filter @workspace/scripts run validate-sources
 */
import path from "node:path";

process.env["LAERTIUS_DATA_DIR"] ??= path.resolve(
  import.meta.dirname,
  "../../artifacts/api-server/data",
);

const { getSourcesIndex } = await import(
  "../../artifacts/api-server/src/lib/sources-index"
);
const { sectionIdForRef, sectionIdsForRef } = await import(
  "../../artifacts/api-server/src/lib/claims-answer"
);
const { CITATION_REF_SECTION } = await import(
  "../../artifacts/api-server/src/lib/lod"
);
const { getKnowledgeGraph } = await import(
  "../../artifacts/api-server/src/lib/kg"
);
const { getClaimEntities } = await import(
  "../../artifacts/api-server/src/lib/kg-claims"
);
const { getSayings } = await import(
  "../../artifacts/api-server/src/lib/sayings"
);
const { getAnecdotes } = await import(
  "../../artifacts/api-server/src/lib/anecdotes"
);
const { VERSE_AUTHORS } = await import(
  "../../artifacts/api-server/src/lib/verse-authors"
);

// ---- pinned totals (update deliberately when the workbook changes) ----
const EXPECTED_ROWS = 529;
const EXPECTED_GROUPS = 252;
const EXPECTED_BY_KIND = { philosopher: 48, person: 38, source: 166 };
// 2026-07 sayings expansion: 3 workbook authorities (Cleomenes, Demetrius
// of Byzantium, Eubulus) are now minted by the sayings layer (accordingTo),
// so the index reconciles them as existing instead of minting them here.
// 2026-07 reconciliation pass (SOURCE_LABEL_CANON in sources-index.ts):
// 23 workbook groups aliased onto existing philosopher/person/source nodes
// ("Duris of Samos" -> Duris, "Epicurus of Samos" -> Epicurus, ...), and
// 8 minted groups renamed to Hicks' spelling (Alcimos -> Alcimus, ...).
// 2026-07 Apollodorus repair (SOURCE_ROW_CORRECTIONS in sources-index.ts):
// the workbook's scrambled rows 44-48 regrouped — the spurious minted
// "Apollodorus of Athens" disappeared into the existing chronographer
// group (groups 253 -> 252, minted 121 -> 120, graded 166 -> 165), and the
// arithmetician's unparsed "I 25 VIII 12" now yields 2 refs (1011 -> 1013).
// 2026-07 Sceptics: the timon-no-successor claim (claims/book9.ts) carries
// accordingTo "Menodotus of Nicomedia", so the claims layer now mints that
// authority and the workbook group reconciles as existing instead of
// minting it here (minted 120 -> 119). Same-node semantics: the label and
// URI are unchanged, the source-mentions opt-in still tags it.
// 2026-08 Plato: the plato-deme-collytus claim (claims/book3.ts) carries
// accordingTo "Antileon", so the claims layer now mints that authority and
// the workbook group reconciles as existing instead of minting it here
// (minted 119 -> 118). Same-node semantics as the Menodotus case above.
const EXPECTED_MINTED = 118;
const EXPECTED_WITH_QID = 111;
const EXPECTED_ANONYMOUS = 4;
const EXPECTED_NO_REF = 10; // index rows with no reference column at all
const EXPECTED_REFS = 1013;
const EXPECTED_UNGRADED_ROWS = 193;
const EXPECTED_GRADED_GROUPS = 165;

// Workbook references pointing outside the Perseus corpus (section numbers
// that do not exist in this edition). They stay as citations without CTS
// URNs; any ref not in this list must resolve.
const EXPECTED_UNRESOLVED = new Set([
  "DL-SRC-0014|9.129",
  "DL-SRC-0045|8.184",
  "DL-SRC-0333|8.184",
  "DL-SRC-0410|2.176",
  "DL-SRC-0410|5.98",
]);

const errors: string[] = [];

// getSourcesIndex() itself throws on duplicate ids, bad certainty values,
// nameless+workless rows, and minted-slug collisions with existing sources.
const si = getSourcesIndex();

// ---- row-level checks ----
if (si.rows.length !== EXPECTED_ROWS) {
  errors.push(`expected ${EXPECTED_ROWS} rows, found ${si.rows.length}`);
}
let refCount = 0;
const unresolved: string[] = [];
for (const r of si.rows) {
  if (!/^DL-SRC-\d{4}$/.test(r.id)) errors.push(`malformed id ${r.id}`);
  if (r.qid && !/^Q\d+$/.test(r.qid)) errors.push(`bad QID on ${r.id}: ${r.qid}`);
  if (r.enwiki && !r.qid) errors.push(`${r.id} has enwiki but no QID`);
  if (r.refs.length > 0 && !r.refRaw) {
    errors.push(`${r.id} has parsed refs but no refRaw`);
  }
  for (const ref of r.refs) {
    refCount++;
    if (!/^\d+\.\d+$/.test(ref)) errors.push(`malformed ref "${ref}" on ${r.id}`);
    if (!sectionIdForRef(ref)) unresolved.push(`${r.id}|${ref}`);
  }
}
if (refCount !== EXPECTED_REFS) {
  errors.push(`expected ${EXPECTED_REFS} parsed refs, found ${refCount}`);
}
for (const u of unresolved) {
  if (!EXPECTED_UNRESOLVED.has(u)) errors.push(`unexpected unresolved ref ${u}`);
}
for (const u of EXPECTED_UNRESOLVED) {
  if (!unresolved.includes(u)) errors.push(`pinned unresolved ref ${u} now resolves`);
}
const noRef = si.rows.filter((r) => r.refRaw === null);
if (noRef.length !== EXPECTED_NO_REF) {
  errors.push(`expected ${EXPECTED_NO_REF} rows without refRaw, found ${noRef.length}`);
}
for (const r of noRef) {
  if (r.refs.length > 0) errors.push(`${r.id} has refs despite null refRaw`);
}
const ungraded = si.rows.filter((r) => r.certainty === null).length;
if (ungraded !== EXPECTED_UNGRADED_ROWS) {
  errors.push(`expected ${EXPECTED_UNGRADED_ROWS} ungraded rows, found ${ungraded}`);
}

// ---- group-level checks ----
if (si.groups.length !== EXPECTED_GROUPS) {
  errors.push(`expected ${EXPECTED_GROUPS} groups, found ${si.groups.length}`);
}
for (const [kind, expected] of Object.entries(EXPECTED_BY_KIND)) {
  const n = si.groups.filter((g) => g.kind === kind).length;
  if (n !== expected) errors.push(`expected ${expected} ${kind} groups, found ${n}`);
}
const minted = si.groups.filter((g) => !g.existing);
if (minted.length !== EXPECTED_MINTED) {
  errors.push(`expected ${EXPECTED_MINTED} minted groups, found ${minted.length}`);
}
for (const g of minted) {
  if (g.kind !== "source") errors.push(`minted group "${g.label}" has kind ${g.kind}`);
}
const withQid = si.groups.filter((g) => g.qid).length;
if (withQid !== EXPECTED_WITH_QID) {
  errors.push(`expected ${EXPECTED_WITH_QID} groups with QID, found ${withQid}`);
}
const graded = si.groups.filter((g) => g.certainty).length;
if (graded !== EXPECTED_GRADED_GROUPS) {
  errors.push(`expected ${EXPECTED_GRADED_GROUPS} graded groups, found ${graded}`);
}
if (si.anonymousRows.length !== EXPECTED_ANONYMOUS) {
  errors.push(
    `expected ${EXPECTED_ANONYMOUS} anonymous rows, found ${si.anonymousRows.length}`,
  );
}

// Every row lands in exactly one group or the anonymous list.
const seen = new Map<string, number>();
for (const g of si.groups) {
  for (const r of g.rows) seen.set(r.id, (seen.get(r.id) ?? 0) + 1);
}
for (const r of si.anonymousRows) seen.set(r.id, (seen.get(r.id) ?? 0) + 1);
for (const r of si.rows) {
  const n = seen.get(r.id) ?? 0;
  if (n !== 1) errors.push(`row ${r.id} appears in ${n} groups/lists (expected 1)`);
}

// altLabels never duplicate the canonical label; doubt markers only at end.
for (const g of si.groups) {
  if (g.altLabels.includes(g.label)) {
    errors.push(`group "${g.label}" lists its own label as a variant`);
  }
}

// ---- reconciliation cross-check: existing groups must hit real labels ----
const philosopherNames = new Set(getKnowledgeGraph().nodes.map((n) => n.name));
const ce = getClaimEntities();
const sourceLabels = new Set<string>(ce.sources);
const personLabels = new Set<string>(ce.persons);
for (const s of getSayings()) {
  if (s.accordingTo) sourceLabels.add(s.accordingTo);
  if (s.alsoAttributedTo && !philosopherNames.has(s.alsoAttributedTo)) {
    personLabels.add(s.alsoAttributedTo);
  }
}
for (const a of getAnecdotes()) {
  if (a.accordingTo) sourceLabels.add(a.accordingTo);
}
for (const a of Object.values(VERSE_AUTHORS)) {
  if (!philosopherNames.has(a)) personLabels.add(a);
}
for (const g of si.groups) {
  if (!g.existing) continue;
  const ok =
    g.kind === "philosopher"
      ? philosopherNames.has(g.label)
      : g.kind === "source"
        ? sourceLabels.has(g.label)
        : personLabels.has(g.label);
  if (!ok) {
    errors.push(`existing ${g.kind} group "${g.label}" not found in graph labels`);
  }
}

// ---- curated citation section pins (CITATION_REF_SECTION in lod.ts) ----
// Each pin disambiguates an ambiguous Hicks ref on a citation row; if the
// workbook renumbers a row, drops the ref, or the corpus candidates shift,
// the pin would silently cite the wrong philosopher's passage.
const rowById = new Map(si.rows.map((r) => [r.id, r]));
let pinCount = 0;
for (const [rowId, pins] of Object.entries(CITATION_REF_SECTION)) {
  const row = rowById.get(rowId);
  if (!row) {
    errors.push(`citation pin row ${rowId} no longer exists in the workbook`);
    continue;
  }
  for (const [ref, sid] of Object.entries(pins)) {
    pinCount++;
    if (!row.refs.includes(ref)) {
      errors.push(`citation pin ${rowId} ${ref}: ref no longer on the row (refs: ${row.refs.join(", ") || "none"})`);
      continue;
    }
    const candidates = sectionIdsForRef(ref);
    if (!candidates.includes(sid)) {
      errors.push(
        `citation pin ${rowId} ${ref} -> ${sid}: pinned section not among corpus candidates (${candidates.join(", ") || "none"})`,
      );
    } else if (candidates.length < 2) {
      errors.push(
        `citation pin ${rowId} ${ref} -> ${sid}: ref is no longer ambiguous (${candidates.length} candidate); drop the stale pin`,
      );
    }
  }
}
// Every ambiguous ref on a citation row must carry a pin — an unpinned
// ambiguous ref falls back to linking ALL candidates, so the curation
// decision must be made consciously when a new one appears.
for (const r of si.rows) {
  for (const ref of r.refs) {
    if (sectionIdsForRef(ref).length < 2) continue;
    if (!CITATION_REF_SECTION[r.id]?.[ref]) {
      errors.push(
        `ambiguous citation ref ${r.id} ${ref} has no curated section pin ` +
          `(candidates: ${sectionIdsForRef(ref).join(", ")}); add it to CITATION_REF_SECTION in lod.ts`,
      );
    }
  }
}
if (pinCount === 0) {
  errors.push("citation pin check is vacuous: CITATION_REF_SECTION is empty");
}

if (errors.length > 0) {
  console.error(`INVALID SOURCES INDEX (${errors.length}):`);
  for (const e of errors) console.error("  " + e);
  process.exit(1);
}

console.log(
  `OK: ${si.rows.length} rows in ${si.groups.length} groups ` +
    `(${EXPECTED_BY_KIND.philosopher} philosopher / ${EXPECTED_BY_KIND.person} person / ` +
    `${EXPECTED_BY_KIND.source} source, ${minted.length} minted, ${withQid} with QID), ` +
    `${si.anonymousRows.length} anonymous rows, ${refCount} refs ` +
    `(${refCount - unresolved.length} resolve to corpus sections, ` +
    `${unresolved.length} pinned outside the Perseus text)`,
);
