/**
 * Single source of truth for the pinned curated-layer counts that are
 * checked in MORE THAN ONE place: each validate-* script pins its layer,
 * and smoke-ionos-bundle.ts re-checks the same counts inside the built
 * bundle. Both sides import from here, so growing a layer only ever means
 * updating one constant (the validator failure message will point here).
 *
 * Layers WITHOUT a constant here (claims, sayings, anecdotes, doxai,
 * epistle texts, map places, itineraries) are compiled-in TS: their
 * validators derive the count from the source module itself, and the
 * smoke test does the same via the api-server lib imports, so there is
 * no literal to drift in the first place.
 *
 * Timeline pins live in timeline-pins.ts (they pin per-philosopher rows,
 * not just a count).
 */

/** Verses parsed from the TEI block-quotes (validate-verses). */
export const VERSE_PIN_COUNT = 340;

/** Letters D.L. quotes verbatim (validate-epistles). */
export const EPISTLE_PIN_COUNT = 31;

/** Wills D.L. quotes verbatim (validate-testaments). */
export const TESTAMENT_PIN_COUNT = 6;

/** Occurrence-level deterministic tags across both languages
 * (validate-annotations). */
// 2026-07 second grcRefs pass: +80 Greek name tags (the 62 remaining
// source-mention labels curated into Greek tagging). 2026-07 second
// frequently-mentioned batch: +101 English / +86 Greek tags on top.
// 2026-07 source-work / transmission-chain claims: +8 source work titles
// added to GREEK_WORK_TITLES (Aristoxenus, Alexander, Antisthenes,
// Plutarch, Demetrius, Eumelus, Ariston, Demetrius of Troezen): +45
// total annotations (+26 English, +19 Greek name), +8 tagged entities.
// 2026-07 Hesiod Greek pass: +10 Greek name tags (grcRefs extended to
// all twelve verified poet sections, one declined form per section).
// 2026-07 kings and tyrants batch (Alexander the Great, the two
// Dionysii of Syracuse, Ptolemy Soter, plus the source Alexander
// Polyhistor's scoped citation formulas): +150 annotations (+80
// English, +70 Greek), +5 tagged entities.
// 2026-07 Sceptic Greek pass: +21 Greek name tags net for the 17
// Sceptic mention-persons (24 new-bearer tags minus 3 reassigned from
// the unscoped Dioscurides/Zeuxis sources; validate-annotations holds
// the per-name roster).
// 2026-07 coverage audit: +28 (14 English + 14 Greek) - four workbook
// citations re-pointed one section (Hieronymus 9.16, Dicaearchus 3.4,
// Eubulides 2.41, Archedemus 7.134, all with Greek forms present) and
// the verified Archedemus/Eubulides scope widenings; see
// validate-annotations.ts for the per-section breakdown.
// 2026-07 Cratinus split: +5 English — the ambiguous bare surface split
// occurrence-by-occurrence between the Old Comedy poet (1.prol.12,
// 1.2.62, 1.6.89) and Cratinus the Younger (3.1.28, 8.1.37); the 1.110
// young man stays untagged.
// 2026-08 competency chip pass: +2 English — Bryson son of Stilpo
// (9.61, Pyrrho's teacher, per the claims layer) and Heraclides of
// Heraclea (7.166, Dionysius the Renegade's first teacher, per
// Diocles), each via a section-scoped curated gazetteer entry.
// 2026-08 Antileon On Dates: +3 — the new scoped Greek work title
// (Περὶ χρόνων, 3.1.3) tags once, plus the English "On Dates" surface
// and the source node's own tagging via the claims layer.
export const ANNOTATION_PIN_COUNT = 9310;

/** Distinct tagged entities in the annotation index
 * (validate-annotations). */
export const TAGGED_ENTITY_PIN_COUNT = 787;

/** Index entries carrying an ALT_TITLES catalogue ref (altTitleRef /
 * altTitleSectionId, validate-annotations). */
export const ALT_TITLE_REF_PIN_COUNT = 36;

/** Index entries carrying homonym cross-links (24 double-titled Platonic
 * dialogues and their subtitles, incl. the "On Philosophy" triangle;
 * validate-annotations). */
export const HOMONYM_ENTRY_PIN_COUNT = 25;

/** lo:ChapterSubject nodes: the 82 subjects of the Lives (validate-lod). */
export const CHAPTER_SUBJECT_PIN_COUNT = 82;

/** lo:Sage nodes: Book 1's eleven sages (validate-lod). */
export const SAGE_PIN_COUNT = 11;

/** lo:Philosopher nodes: Books 2-10's 71 subjects + dual-classified
 * Thales (validate-lod; also the smoke test's SPARQL COUNT check). */
export const PHILOSOPHER_NODE_PIN_COUNT = 72;
