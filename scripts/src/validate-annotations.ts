/**
 * Validates the deterministic OTV occurrence-tagging layer
 * (gazetteer.ts + annotate.ts):
 *
 *  - structural: every annotation's surface is EXACTLY
 *    text.slice(start, end); no overlapping annotations per section and
 *    language; every entityUri resolves to a node of the LOD graph (a
 *    typed individual or an otv:Term);
 *  - policy: blocklisted text-ambiguous surfaces ("Alexander",
 *    "Antigonus", ...) are never tagged; the skipped-surface ledger is
 *    pinned so a curation change that silently gains or loses a
 *    homonym resolution fails loudly;
 *  - behavioral (synthetic sections): "Bias" the sage never matches the
 *    common noun "bias" (case-sensitive matching); the longest surface
 *    wins ("Zeno of Citium", not an inner "Citium"); Greek terms match
 *    inflected forms via stem + whitelisted endings, with offsets into
 *    the original polytonic text; Greek proper names match curated
 *    inflected forms (Πλάτωνος) only when the original token is
 *    capitalized (πολιτείας the noun never tags Πολιτείας the work),
 *    and ambiguous Greek forms (Ζήνωνος) only inside the owner's Life;
 *  - totals pinned: gazetteer sizes and corpus-wide annotation counts
 *    must match the reviewed state — any drift is a deliberate,
 *    re-reviewed change.
 *
 * Run from the workspace root:
 *   pnpm --filter @workspace/scripts run validate-annotations
 */
import path from "node:path";

import {
  ALT_TITLE_REF_PIN_COUNT,
  ANNOTATION_PIN_COUNT,
  HOMONYM_ENTRY_PIN_COUNT,
  TAGGED_ENTITY_PIN_COUNT,
} from "./layer-pins";

process.env["LAERTIUS_DATA_DIR"] ??= path.resolve(
  import.meta.dirname,
  "../../artifacts/api-server/data",
);

const { getGazetteer, auditSourcePhilosopherCollisions } = await import(
  "../../artifacts/api-server/src/lib/gazetteer"
);
const { annotateSection, getEntitySummaries, getIndexEntries } = await import(
  "../../artifacts/api-server/src/lib/annotate"
);
const { corpus } = await import("../../artifacts/api-server/src/lib/corpus");
const { GREEK_NAME_SKIPS } = await import(
  "../../artifacts/api-server/src/lib/greek-names"
);

import type { CorpusSection } from "../../artifacts/api-server/src/lib/corpus";

// ------------------------------------------------------- pinned state
const EXPECTED = {
  // 2026-07: +107 mention-only places (place-mentions.ts) — every
  // curated place resolves to a surface and every surface tags at
  // least one occurrence (audited: no zero-tag places, no new
  // ambiguous skips beyond the deliberate "Thracian" blocklisting).
  // 2026-07: +Propontis (mention place, 2 English tags: Eudoxus 8.87,
  // Timon 9.110); Cyzicus promoted from mention to claim place (same
  // gazetteer entry and pins, so no annotation deltas from the move).
  // 2026-07: works layer + person-mentions + title-tagging expansion:
  // +22 work entries, +7 mention-only persons, +1 place (Hermione).
  // Greek side: +34 person forms, +33 work-title forms (30 of them
  // multi-word titles). Greek term tags drop by 2: two occurrences are
  // now claimed by longer work-title matches (longest-match-first).
  // 2026-07 sayings expansion (156 -> 639): the curated sayings now cite
  // authorities (accordingTo) and a rival attributee that mint new graph
  // nodes, which auto-feed the gazetteer. +7 source surfaces (Pamphila,
  // Phanias, Zoïlus of Perga + bare "Zoïlus", Cleomenes, Eubulus,
  // Demetrius of Byzantium), +2 person
  // surfaces ("Diagoras of Melos" + bare "Diagoras"). Saying sources whose
  // label is an existing philosopher (Bion, Heraclitus, Menippus) follow
  // the established source/philosopher double-node convention; their
  // surfaces still tag the philosopher node (pinned below).
  // 2026-07: mention-place "Melos" removed (-1 entry, -1 place): its only
  // English occurrence sits inside the new "Diagoras of Melos" person
  // surface (longest-match wins) and Greek has only the ethnic Μηλίου —
  // the place node would carry zero tags (skip documented in
  // place-mentions.ts).
  // 2026-07 anecdotes layer: Metrocles (Life at 6.94) is now also cited
  // as an authority (his Chreiai, anecdote layer), minting a source node
  // under the established source/philosopher double-node convention.
  // "Metrocles" therefore becomes an ambiguous bare name (like Bion,
  // Heraclitus, Menippus): -1 philosopher gazetteer entry (merged into
  // the ambiguous set), his mentions outside his own Life no longer tag
  // (-8 total: -4 English, -4 Greek), while the section-owner heuristic
  // now claims the mentions inside his Life (+2 English, +1 Greek
  // heuristic tags). Six Greek declined forms move from philosopher
  // entries to the ambiguous/skipped sets.
  // 2026-07 anecdotes book 2: Justus of Tiberias (The Wreath, 2.41) is
  // newly cited as an anecdote authority, minting a source node that
  // auto-feeds the gazetteer: +2 source surfaces ("Justus of Tiberias" +
  // bare "Justus"), +1 tagged entity, +1 English tag (his single corpus
  // occurrence, 2.5.41). All other book-2 anecdote authorities are already
  // claim/saying sources.
  // 2026-07 Lamiscus + Photidas + Pythodotus: mention-only persons
  // (person-mentions.ts): +3 gazetteer person entries.
  // 2026-07 Aratus: mention-only person (Q180671), the didactic poet
  // of Soli (Menedemus' guest 2.133, Dionysius the Renegade's model
  // 7.167, Timon's Homer questioner 9.113): +1 gazetteer person entry.
  // 2026-07 Aeschylus: mention-only person (Q40939), the Athenian
  // tragedian, section-scoped (2.43, 2.133, 3.56) away from Menedemus'
  // Eretrian opponent (2.141) and Theophrastus' addressee (5.50):
  // +1 gazetteer person entry.
  // 2026-07 Omphale: Achaeus' satyr play (person-works.ts, the first
  // person-authored work node; single-word title allowlisted — the
  // eponymous queen never appears in the text): +1 gazetteer work
  // entry.
  // 2026-07 Agrippa: mention-only person (Q365115), the Sceptic of
  // the Five Modes, section-scoped (9.11.88) away from Apellas'
  // homonymous book title at 9.11.106: +1 gazetteer person entry.
  // 2026-07 source-mentions layer: 93 explicit section-scoped surfaces
  // for the opted-in minted sources-index authorities (source-mentions.ts)
  // — auto surface generation for these labels is suppressed in BOTH
  // languages (no Greek declensions curated for this layer), so bare
  // homonyms like "Diodorus", "Croton", "Eleusis" tag only inside the
  // curated sections. +93 source entries.
  // 2026-07 Apollodorus split (gazetteer.ts Apollodorus split blocks,
  // source-mentions.ts opt-ins, greek-names.ts scope): the bare surface
  // is demoted to the chronographer's 29 verified sections; the five
  // other bearers get scoped entries. +8 English entries (4 curated:
  // "Apollodorus of Athens" ×2 bearers, "Apollodorus the Epicurean",
  // scoped bare for the Epicurean; 4 opt-in: Seleucia bare, Cyzicus
  // full, Arithmetician ×2 Hicks spellings), +1 person entry
  // ("Apollodorus of Athens" -> chronographer), +7 source entries.
  // 2026-07 Antigonus split: +1 source entry — the scoped bare
  // "Antigonus" for the biographer of Carystus's citation formulas
  // (2.15, 4.22, 7.188, 9.49, 9.112); bare "Antigonus" stays in the
  // SURFACE_BLOCKLIST for the royal narratives. Full classification in
  // ANTIGONUS_CARYSTUS_SECTIONS (greek-names.ts).
  // 2026-07 Eurytus: mention-only person (Q1378597), the Pythagorean
  // of Tarentum visited by Plato with Philolaus (3.6) and teacher of
  // the last Pythagoreans seen by Aristoxenus (8.46): +1 gazetteer
  // person entry.
  // 2026-07 Garden members: +3 gazetteer person entries (Leonteus of
  // Lampsacus, Polyaenus of Lampsacus, Themista), curated with the
  // school-members layer; Polyaenus is section-scoped (10.1.18/19/24)
  // against the 2.105 Medius homonym.
  // 2026-07 Sceptics (person-mentions.ts, succession-links.ts): +26
  // person entries - 17 full-name surfaces for the new mention-persons,
  // 4 unsuppressed bare first words (Euphranor scoped, Nicolochus,
  // Praylus, Theiodas), and 5 scoped bare-homonym entries in
  // gazetteer.ts (Dioscurides->9.12.114; Heraclides/Zeuxis/Eubulus/
  // Ptolemy->9.12.116). The other bare names are in
  // MENTION_BARE_NAME_SUPPRESSED. +1 source entry: Hecataeus of
  // Abdera opted into source-mentions ("Hecataeus of Abdera" at 9.69,
  // a curated extra section) so the Sceptic roster can reference his
  // node.
  // 2026-07 Stoa pupil network: +5 person entries (Philonides of Thebes,
  // Callippus of Corinth, Posidonius of Alexandria, Athenodorus of Soli,
  // Zeno of Sidon) from person-mentions.ts; 3 of the 5 are in
  // MENTION_BARE_NAME_SUPPRESSED so their bare-name surfaces don't collide;
  // +2 additional entries from Persaeus (source node whose philosopher role
  // now feeds the Stoa satellite) and from the Chrysippus reification
  // materialising an extra gazetteer path. Total gazetteer growth: +7.
  // 2026-07 frequently-mentioned figures: +4 person entries (Aristocreon,
  // Isocrates, Dion of Syracuse, Asclepiades of Phlius) from
  // person-mentions.ts, +2 auto bare-name surfaces ("Dion",
  // "Asclepiades") for the two multi-word labels, both scoped via
  // MentionPerson.onlySections. Total gazetteer growth: +6, all person.
  // 2026-07 second frequently-mentioned batch: +6 person entries
  // (Alcibiades, Croesus, Cyrus the Younger, Hermias, Nicanor,
  // Philip II of Macedon) from person-mentions.ts, +2 auto bare-name
  // surfaces ("Cyrus", "Philip") for the two multi-word labels, both
  // scoped via MentionPerson.onlySections. Hesiod and Pisistratus are
  // existing source nodes; their extensions ride the source-mentions
  // scoped blocks and add no gazetteer entries. Growth: +8, all person.
  // 2026-07 source-work / transmission-chain claims: +5 new work
  // gazetteer entries (the 8 new GREEK_WORK_TITLES produce 5 distinct
  // new gazetteer work entries that are not already in the index; 3 of
  // the 8 titles were already known under slightly different spellings
  // or are multi-language duplicates scoped via onlySections).
  // 2026-07 kings and tyrants batch (Alexander the Great, Dionysius
  // the Elder and the Younger, Ptolemy Soter): +4 full-label surfaces
  // (bare first words suppressed) and +5 curated scoped homonym
  // entries (two Alexander scopes - the king and the source
  // Polyhistor - two Dionysius scopes, one Ptolemy scope). Growth:
  // +9 entries, +8 person, +1 source.
  // 2026-07 Cratinus split: +2 curated scoped person entries (the two
  // comic poets' shared bare surface, gazetteer.ts Cratinus split); the
  // unscoped candidate stays in the skipped-surface ledger.
  // 2026-08 competency chip pass: +2 curated scoped person entries —
  // Bryson son of Stilpo (9.61) and Heraclides of Heraclea (7.166);
  // both bare surfaces stay in the skipped-surface ledger everywhere
  // else (see the gazetteer.ts split blocks).
  entries: 818,
  entriesByKind: {
    philosopher: 80,
    person: 146,
    source: 153,
    school: 26,
    place: 173,
    work: 240,
  } as Record<string, number>,
  terms: 47,
  termsWithStem: 35,
  termsMultiWord: 8,
  ambiguousPhilosopherNames: [
    "Antisthenes",
    "Ariston",
    "Crates",
    "Demetrius",
    "Diogenes",
    "Dionysius",
    "Heraclides",
    "Menedemus",
    "Metrocles",
    "Zeno",
  ],
  skippedSurfaces: [
    "Alexander",
    "Antigonus",
    "Antisthenes",
    "Ariston",
    "Bryson",
    "Cratinus",
    "Demetrius",
    "Diogenes",
    "Dionysius",
    "Heraclides",
    "Herodotus",
    "Metrocles",
    "Metrodorus",
    "Theodorus",
    "Theopompus",
    "Thracian",
    "Timaeus",
  ],
  // 2026-07: Greek proper-name tagging (greek-names.ts): curated closed
  // declensions for persons/places/schools/work-titles, capital-initial
  // guard, section-owner heuristic mirrored from the English side.
  // English count is UNCHANGED (4519) — the Greek layer is additive.
  // Memorabilia deliberately tags nothing in Greek (13/18 corpus
  // occurrences are Favorinus' homonymous work). +1 tagged entity:
  // one entity is reachable through Greek forms only.
  // 2026-07 sayings expansion: +30 English tags from the new source /
  // person surfaces above (Eubulus 9, Pamphila 8, Phanias 7, Cleomenes 4,
  // Zoïlus of Perga 2, Diagoras of Melos 1; net of one occurrence
  // reclaimed from a shorter pre-existing match); Greek side unchanged.
  // 2026-07 εὐδαιμονία term: attached to the five virtue/happiness
  // doctrine claims (Plato 3.78, Aristotle ×2 5.30, Antisthenes 6.11,
  // Zeno 7.127). +8 Greek term tags via the conservative stem matcher
  // (3× εὐδαίμονα, 2× εὐδαιμονία, 1× εὐδαιμονίᾳ, 1× εὐδαίμονος,
  // 1× εὐδαιμονῶ); the frequent -ίαν/-ίας obliques stay untagged, as
  // for the other -ία lemmas (endings whitelist is deliberately
  // conservative). English side unchanged.
  // 2026-07 Lamiscus: mention-only person (person-mentions.ts, Q3826494),
  // the Pythagorean of Archytas' letters. +2 English (3.1.22, 8.4.80)
  // and +2 Greek tags (Λαμίσκον, same sections; m2 declension), +1
  // tagged entity.
  // 2026-07 Photidas: mention-only person (Q138771346), the other
  // Pythagorean envoy of Archytas' letter at 3.22. +1 English and
  // +1 Greek tag (Φωτίδαν, 3.1.22; m1a declension), +1 tagged entity.
  // 2026-07 Pythodotus: mention-only person (Q138786485), the archon
  // D.L. uses as chronology marker for Aristotle's move to Philip
  // (5.10). +1 English and +1 Greek tag (Πυθοδότου, 5.1.10; m2
  // declension), +1 tagged entity.
  // 2026-07 Pherecydes irregular forms (alsoForms): the name mixes
  // a-declension and σ-stem in D.L. — +4 Greek tags (Φερεκύδει 1.1.43,
  // Φερεκύδους 1.prol.15, Ionic Φερεκύδεω 1.11.122, acc pl Φερεκύδας
  // in Andron's two-Pherecydeses report 1.11.119). English side was
  // already fully tagged; no new entity.
  // 2026-07 Achaeus unskipped with an onlySections scope (2.17.133,
  // 2.17.134 — the tragedian; 6.85 Ἀχαιοῦ is Bryson's ethnic and stays
  // untagged): +2 Greek tags (Ἀχαιῷ 2.133, Ἀχαιοῦ 2.134). English side
  // was already tagged; no new entity.
  // 2026-07 Aratus: +3 English and +3 Greek tags (Ἄρατον at 2.133,
  // 7.167, 9.113 — the same poet in all three passages, no homonym),
  // +1 tagged entity.
  // 2026-07 Aeschylus: +3 English and +3 Greek tags (Αἰσχύλον 2.43,
  // Αἰσχύλῳ 2.133, Αἰσχύλος 3.56 — the tragedian, section-scoped;
  // the 2.141 opponent and 5.50 addressee stay untagged), +1 tagged
  // entity.
  // 2026-07 Ethics (Greek title Ἠθικά): +7 Greek tags, section-scoped
  // to the bare-title occurrences already tagged in English (Ἠθικῶν
  // 5.21, Ἠθικοῖς 6.99, Ἠθικά 7.4, Ἠθικῇ 7.102/7.118/7.121/7.129);
  // capitalized Ἠθικ- inside multi-word titles of other works and the
  // 5.23 "Five books of Ethics" stay untagged. No new entity.
  // 2026-07 Omphale (person-works.ts): +1 English tag ("from the
  // Omphale, a satiric drama of Achaeus", 2.17.134) and +1 Greek tag
  // (genitive Ὀμφάλης, same section); the lowercase ὀμφάλιον at 8.45
  // is a different word, excluded by capitalization. +1 tagged entity.
  // 2026-07 Agrippa (person-mentions.ts): +1 English and +1 Greek tag
  // (accusative Ἀγρίππαν, 9.11.88 — the Five Modes passage); the
  // 9.11.106 "Apellas in his Agrippa" / ἐν τῷ Ἀγρίππᾳ is his
  // homonymous book, kept untagged by the section scope. +1 tagged
  // entity.
  // 2026-07 source-mentions layer: +123 English tags for the minted
  // workbook authorities; +79 tagged entities. -2 English heuristic:
  // in two curated sections the scoped source entry now outranks the
  // section-owner heuristic (the "source, not the Life's subject" cases
  // the layer exists for). Greek counts untouched — the layer curates
  // no Greek declensions.
  // 2026-07 Apollodorus split: every occurrence of the name in BOTH
  // languages now resolves to its verified bearer (chronographer,
  // Epicurean Kepotyrannos, Stoic of Seleucia, Democritean of Cyzicus,
  // Arithmetician). -2 English and -2 Greek: the patronymic at 2.4.16
  // ("son of Apollodorus") and Socrates' companion at 2.5.35 are
  // deliberately untagged. -5 more English from longer curated surfaces
  // consuming shorter neighbours in resolveOverlaps: "Athens" (place)
  // inside "Apollodorus of Athens" at 2.1.2 and 7.7.181, "Cyzicus"
  // (place) inside "Apollodorus of Cyzicus" at 9.7.38, "Epicurean"
  // (school) inside "Apollodorus the Epicurean" at 10.1.2 and 10.1.13 —
  // the specific tag replaces the generic one at the same offsets.
  // +4 tagged entities (the four newly taggable bearers).
  // 2026-07 Antigonus split: bare Ἀντίγονος had tagged ALL 50 Greek
  // occurrences as the biographer of Carystus — including the royal
  // narratives where the text means King Antigonus Gonatas (Zeno
  // 7.6–7.15/7.36, Menedemus 2.127–2.143, Arcesilaus 4.39/4.41, Bion
  // 4.46/4.54, Cleanthes 7.169, Timon 9.110) or Monophthalmus
  // (2.115, 5.78). -35 Greek: only the 15 verified biographer
  // occurrences keep tags (14 via the spec's onlySections + the
  // curated multi-word "Ἀντίγονος ὁ Καρύστιος" at 2.143). +6 English:
  // the biographer's bare citation formulas, previously lost to the
  // SURFACE_BLOCKLIST, now tag via the scoped curated entry (2.15,
  // 4.22, 7.188, 9.49, 9.112 ×2). 9.110 (bare king + bare biographer
  // in one section) stays untagged in both languages — section
  // scoping cannot discriminate it.
  // 2026-07 Hesiod prologue scope: +1 English (surface "Hesiod" at
  // 1.prol.12, Cratinus naming Homer and Hesiod sophists).
  // Pinned in layer-pins.ts, shared with smoke-ionos-bundle.ts.
  totalAnnotations: ANNOTATION_PIN_COUNT,
  // 2026-07 Eurytus: +2 English (3.1.6, 8.1.46) and +2 Greek tags
  // (Εὔρυτον 3.1.6, Εὐρύτου 8.1.46; m2 declension), +1 tagged entity.
  // 2026-07 Garden members: +12 English and +13 Greek tags across the
  // three new persons (Leonteus, Polyaenus scoped to 10.1.18/19/24,
  // Themista), +3 tagged entities.
  // 2026-07 Sceptics: +13 English tags net, +18 tagged entities (the
  // 17 mention-persons + Hecataeus of Abdera). Hecataeus' Greek came
  // with the batch via grcRefs ["9.69"]; the mention-persons' Greek
  // was a deferred pass, done 2026-07 (see the Sceptic Greek pass
  // note below).
  // 2026-07 Sceptic Greek pass: +21 Greek name tags net for the 17
  // mention-persons (24 tags: Apellas 9.106, Dioscurides of Cyprus
  // 9.114+9.115, Eubulus of Alexandria 9.116, Euphranor of Seleucia
  // 9.115+9.116, Eurylochus 9.68, Evander 4.60 x2, Telecles 4.60,
  // Heraclides the Sceptic 9.116 x2, Herodotus of Tarsus 9.116 x2,
  // Nicolochus, Praylus 9.115, Ptolemy of Cyrene 9.115+9.116,
  // Sarpedon, Saturninus, Theiodas, Zeuxippus 9.116, Zeuxis Goniopus
  // 9.116; minus 3 reassigned from the unscoped source bearers:
  // Dioscurides 9.114/9.115 and Zeuxis 9.116 now tag the Sceptics,
  // mirroring the English scoped entries). Every token verified
  // against the Greek text; the 5.73 Εὐφράνορα freedman, the 6.30
  // source Εὔβουλος and the non-Pyrrhonian Εὐρύλοχοι stay untagged.
  // Net is smaller than the entity count because several full-name
  // surfaces subsume previously bare-tagged spans at 9.115-116
  // (longest-match) and the scoped bare entries claim spans inside
  // their sections only; every unscoped new surface was checked
  // unique in the corpus before pinning.
  // 2026-07 Stoa pupil network: +1 English annotation (Philonides of Thebes
  // tagged at 7.38); -1 English heuristic (that span was previously credited
  // to the section-owner heuristic, now consumed by the explicit entry).
  // 2026-07 Stoa pupil Greek forms: +4 Greek name tags — Philonides of
  // Thebes ×3 (Φιλωνίδης 7.38 and 4.47, Φιλωνίδην 7.9) and Callippus of
  // Corinth ×1 (Κάλλιππος 7.38, scoped). The three scoped nominatives at
  // 7.38 are count-neutral swaps: Ποσειδώνιος moves from the Posidonius
  // source (of Apamea) to Posidonius of Alexandria, Ἀθηνόδωρος from the
  // Athenodorus source (of the Walks) to Athenodorus of Soli, and Ζήνων
  // from the owner-heuristic Zeno of Citium to Zeno of Sidon (hence
  // heuristicGrc -1; the Ζήνωνος genitives keep the heuristic).
  // 2026-07 frequently-mentioned figures: +56 English / +57 Greek tags
  // (Aristocreon 10/10, Isocrates 13/10, Dion of Syracuse 19/19,
  // Asclepiades of Phlius 17/18 - the Greek surplus at 6.5.91 is the
  // doubled vocative in Menedemus' jest, and 4.1.2 grc vs 4.1.3 en is
  // Hicks section-boundary drift).
  // 2026-07 source-mentions Greek forms: +67 Greek name tags across
  // the 17 labels (details at the greekNameEntries pin below).
  // 2026-07 second grcRefs pass: +80 Greek name tags across the 62
  // remaining source-mention labels (every declension verified in the
  // cited Greek sections). Includes the retagged Κρότωνά at 9.12 and
  // Ἔλευσις at 1.29 (source now outranks the place in-scope) and the
  // two multi-word Zeno of Tarsus phrases at 7.41/7.84 that leave the
  // owner heuristic (heuristicGrc -2).
  // 2026-07 second frequently-mentioned batch: +101 English / +86
  // Greek tags. Per name (en/grc): Alcibiades 8/7, Croesus 14/13,
  // Cyrus the Younger 9/10, Hermias 10/8, Nicanor 11/11, Philip II of
  // Macedon 15/15; Pisistratus extended from the 1.53 letter to all
  // seventeen Book 1 sections (+24/+22, source-mentions refs+grcRefs);
  // Hesiod extended to all twelve poet sections (+10 English; his
  // Greek stayed at the 1.12/7.25 grcRefs from the second grcRefs
  // pass at the time). Every occurrence
  // verified per section in both languages; homonym bearers (Philip
  // the Megarian/of Opus, Cyrus the Great, the other Nicanors,
  // Pisistratus of Ephesus, dialogue-title Alcibiades) stay untagged
  // via the scopes.
  // 2026-07 kings and tyrants batch: +80 English tags (the verified
  // bare-name occurrences of the four new mention persons and the
  // source Polyhistor's citation formulas, every one classified per
  // section against both texts; mixed and undecidable sections stay
  // untagged).
  // 2026-07 coverage audit: four workbook citations sat one section off
  // in our split (Hieronymus 9.6->9.16, Dicaearchus 3.5->3.4, Eubulides
  // 2.42->2.41, Archedemus 7.135->7.134 - each with its Greek form
  // present after all), and two source-mention scopes widened after
  // per-occurrence context checks (Archedemus 7.55/7.88/7.136 Stoic
  // citations; Eubulides 2.108-111 own biography and the 7.187 Horned
  // One): +14 English tags. The Successions pointer fix (8.1.25 ->
  // 8.1.24) moves the ref to the section that carries the citation
  // sentence; the full English title does not occur there, so it adds
  // no tag.
  // 2026-07 Cratinus split: +5 English tags (see the layer-pins note).
  // 2026-08 competency chip pass: +2 English tags (Bryson 9.11.61,
  // Heraclides of Heraclea 7.4.166; see the layer-pins note).
  // 2026-08 Antileon On Dates: +2 English (the 3.1.3 title and the
  // Antileon name surface entering the tagged pool via the claim).
  english: 5060,
  greekTerms: 735,
  // 2026-07 Hesiod Greek pass: +10 Greek name tags, grcRefs extended
  // to all twelve poet sections (one declined form per section,
  // verified token-by-token: 1.38/8.48/9.1 acc, 2.46/10.2 dat,
  // 5.87/5.92/8.21/9.18 gen citation formulas that still name the
  // poet, 9.22 nom Ἡσίοδός τε; m2 paradigm).
  // 2026-07 kings and tyrants batch: +70 Greek name tags via the four
  // scoped m2 specs plus the scoped source-Alexander spec.
  // 2026-07 Sceptic Greek pass: +21 Greek name tags net (see the
  // totalAnnotations note above for the per-name roster).
  // 2026-07 coverage audit: +14 Greek name tags mirroring the English
  // fixes above - the four "no Greek form" workbook notes were artifacts
  // of the same one-section shift (nominatives at 9.16, 3.4, 7.134,
  // 2.41), plus the widened Archedemus (7.55 double-accent nom., 7.88,
  // 7.136) and Eubulides scopes (nom. 2.108 x2 incl. the comic quote,
  // 2.109; gen. 2.109-111, 7.187), every token verified.
  greekNames: 3515,
  // Heuristic pins are split per language so compensating drift
  // (English losing what Greek gains) cannot pass silently.
  heuristicEn: 225,
  heuristicGrc: 140,
  // Pinned in layer-pins.ts, shared with smoke-ionos-bundle.ts.
  taggedEntities: TAGGED_ENTITY_PIN_COUNT,
  // Index cross-links (annotate.ts): entries carrying an ALT_TITLES
  // catalogue ref (all must resolve to a section), and entries carrying
  // homonym cross-links (24 double-titled Platonic dialogues and their
  // subtitles, incl. the "On Philosophy" triangle checked below).
  // Pinned in layer-pins.ts, shared with smoke-ionos-bundle.ts.
  altTitleRefs: ALT_TITLE_REF_PIN_COUNT,
  homonymEntries: HOMONYM_ENTRY_PIN_COUNT,
  // 2026-07 Melos removal: -5 declined forms (m2 class), all place.
  // 2026-07 Lamiscus: +5 declined forms (m2 class), person.
  // 2026-07 Photidas: +4 declined forms (m1a class), person.
  // 2026-07 Pythodotus: +5 declined forms (m2 class), person.
  // 2026-07 Pherecydes: +4 alsoForms (σ-stem/Ionic/plural), philosopher.
  // 2026-07 Achaeus: +5 declined forms (m2 class, section-scoped), person.
  // 2026-07 Aratus: +5 declined forms (m2 class), person.
  // 2026-07 Aeschylus: +5 declined forms (m2 class, section-scoped), person.
  // 2026-07 Ethics: +4 title forms (ηθικα/ηθικων/ηθικοισ/ηθικη,
  // section-scoped), work.
  // 2026-07 Omphale: +1 title form (ομφαλησ, unscoped — unique
  // capitalized occurrence), work.
  // 2026-07 Agrippa: +4 declined forms (m1a class, section-scoped),
  // person.
  // 2026-07 Apollodorus split: +21 Greek source forms — the shared m2
  // paradigm (5 forms) scoped to each of the four non-chronographer
  // bearers' sections, plus the multi-word "Ἀπολλόδωρος ὁ Ἐπικούρειος"
  // at 10.1.13 (wins over the chronographer's bare form there via
  // longest-match). The chronographer's own spec keeps its
  // onlySections scope in greek-names.ts.
  // 2026-07 Antigonus split: +1 multi-word source form ("Ἀντίγονος ὁ
  // Καρύστιος", scoped to 2.143); the spec's own 5 bare forms are now
  // scoped by ANTIGONUS_CARYSTUS_SECTIONS (count unchanged).
  // 2026-07 Eurytus: +5 declined forms (m2 class), person.
  // 2026-07 Garden members: +12 declined forms (Λεοντεύς eus3,
  // Πολύαινος m2 section-scoped, Θεμίστα f1a), all person.
  // 2026-07 Stoa pupil Greek forms: +8 declined forms, all person —
  // Philonides of Thebes m1h (4 forms, unscoped: the only bearer with
  // a node) plus the four scoped nominatives at 7.1.38 (Κάλλιππος,
  // Ποσειδώνιος, Ἀθηνόδωρος, Ζήνων), each coexisting with its unscoped
  // bearer via the gazetteer disjoint-scope split.
  // 2026-07 Pythagoras Ionic forms: +4 alsoForms (πυθαγορησ/πυθαγορην/
  // πυθαγορεω/πυθαγορη) covering nom/acc/gen/dat Ionic quoted in verse
  // citations and early-source passages (books 1, 8, 9), philosopher.
  // 2026-07 frequently-mentioned figures: +18 person forms (Aristocreon
  // ont3 = 4, Isocrates s3 = 4, Dion of Syracuse n3o = 5 and
  // Asclepiades of Phlius m1h = 5, both scoped via
  // GreekNameSpec.onlySections mirroring the MentionPerson scopes).
  // 2026-07 source-mentions Greek forms (grcRefs opt-in): +79 source
  // entries. 16 mentions opted in via grcRefs in source-mentions.ts,
  // each paradigm scoped to its verified refs via the gazetteer
  // grcRefs block, plus Pamphila (claims/sayings authority, unscoped
  // via the normal spec path). +67 Greek name tags, all verified
  // occurrence-by-occurrence against the Greek text; refs where Hicks
  // supplies the name without a Greek form (Hieronymus 9.6,
  // Dicaearchus 3.5, Eubulides 2.42, Archedemus 7.135) carry no
  // grcRefs. Scoping: Pisistratus only the 1.53 letter, Hecataeus of
  // Abdera only 9.69, Euthyphron only 1.107 (elsewhere Plato's
  // dialogue character).
  // 2026-07 second grcRefs pass: +290 source entries (the 61 newly
  // specced labels' paradigms plus Croton via the shared place spec,
  // each scoped to its verified grcRefs sections) and +2 multi-word
  // entries (the two ethnic-anchored Zeno of Tarsus phrases). The only
  // mention left without grcRefs is Olympiodorus (see greekNameSkips).
  // 2026-07 second frequently-mentioned batch: +27 person forms
  // (Alcibiades m1h, Croesus m2 unscoped, Cyrus the Younger m2,
  // Hermias m1a, Nicanor or3, Philip II of Macedon m2 - all but
  // Croesus scoped via GreekNameSpec.onlySections mirroring the
  // MentionPerson scopes). Pisistratus' existing m2 spec is unchanged;
  // his wider Greek coverage comes from the extended grcRefs.
  // 2026-07 source-work / transmission-chain claims: +14 Greek name
  // entries for the 8 new GREEK_WORK_TITLES (multi-word grc titles add
  // one entry per token that resolves to the work node, resulting in
  // more entries than titles); +4 multi-word work-title entries.
  // 2026-07 kings and tyrants batch: +25 Greek name entries (5 m2
  // forms each for Alexander the Great, the two Dionysii and Ptolemy
  // Soter = +20 person, 5 forms for the source Alexander = +5
  // source). The Ἀλέξανδρος forms are the first all-scoped non-work
  // collision: both bearers are curator-scoped and disjoint, handled
  // by the generalized disjoint-scopes branch in gazetteer.ts.
  // 2026-07 Sceptic Greek pass: +70 person forms across the 17 new
  // specs in greek-names.ts (13 closed-class paradigms, scoped where
  // a homonym exists: Dioscurides of Cyprus, Eubulus of Alexandria,
  // Euphranor of Seleucia, Eurylochus, Heraclides the Sceptic,
  // Herodotus of Tarsus, Ptolemy of Cyrene, Zeuxis Goniopus; plus the
  // explicit-forms Apellas, Praylus and Theiodas, whose Doric or
  // irregular nominatives fit no class). The Πτολεμαῖος forms join
  // Ἀλέξανδρος as an all-scoped disjoint collision (Soter vs. the
  // Cyrenean).
  greekNameEntries: 2020,
  greekNameEntriesMultiWord: 43,
  greekNameEntriesByKind: {
    philosopher: 325,
    // 2026-07 Sceptic Greek pass: 360 -> 430 (+70, see above).
    person: 430,
    source: 564,
    school: 3,
    place: 633,
    work: 65,
  } as Record<string, number>,
  // Normalized ambiguous forms routed through the section-owner
  // heuristic (49) and forms skipped as unresolvable homonyms (45).
  ambiguousGreekForms: 49,
  greekSkippedForms: 45,
  // Documented Greek curation skips (labels deliberately left without
  // Greek tagging forms) — pinned so a curation change is deliberate.
  greekNameSkips: [
    "Abdera, or, according to some, Miletus",
    "Alexander",
    "Antigonus",
    "Antipater of Sidon",
    "Athenaeus the epigrammatist",
    // The Hippobotus 7.38 pupils (Athenodorus of Soli, Posidonius of
    // Alexandria, Zeno of Sidon) left the ledger in 2026-07: their
    // nominatives are curated with onlySections ["7.1.38"] in
    // greek-names.ts and coexist with the unscoped bearers.
    "Ceos",
    "Chen (a village in the district of Oeta or Laconia)",
    "Cnossos in Crete",
    "Elea, but some say Abdera and others Miletus",
    "Epicurean (Garden)",
    "Epicurus (letter to Eurylochus)",
    "Garden (Epicurus)",
    "Herodotus",
    "Magians and Chaldaeans",
    "Metrodorus",
    "Olympias",
    // 2026-07: the Perseus Greek at 6.23 reads Ἀθηνόδωρος where Hicks
    // prints Olympiodorus, so the mention stays English-only.
    "Olympiodorus",
    "Peripatos",
    "Persia",
    "Rome",
    "Stoa",
    "Teos",
    "Theodorus",
    "Thria",
    "Timaeus",
    "Xypete",
  ],
};

const errors: string[] = [];
const g = getGazetteer();

// -------------------------------------------------- gazetteer shape
if (g.entries.length !== EXPECTED.entries) {
  errors.push(
    `gazetteer entries: ${g.entries.length}, expected ${EXPECTED.entries}`,
  );
}
const byKind: Record<string, number> = {};
for (const e of g.entries) byKind[e.kind] = (byKind[e.kind] ?? 0) + 1;
for (const [kind, n] of Object.entries(EXPECTED.entriesByKind)) {
  if ((byKind[kind] ?? 0) !== n) {
    errors.push(`gazetteer ${kind} entries: ${byKind[kind] ?? 0}, expected ${n}`);
  }
}
if (g.terms.length !== EXPECTED.terms) {
  errors.push(`terms: ${g.terms.length}, expected ${EXPECTED.terms}`);
}
const withStem = g.terms.filter((t) => t.stem !== null).length;
if (withStem !== EXPECTED.termsWithStem) {
  errors.push(`terms with stem: ${withStem}, expected ${EXPECTED.termsWithStem}`);
}
const multiWord = g.terms.filter((t) => t.words.length > 1).length;
if (multiWord !== EXPECTED.termsMultiWord) {
  errors.push(
    `multi-word terms: ${multiWord}, expected ${EXPECTED.termsMultiWord}`,
  );
}

const ambiguous = [...g.ambiguousPhilosopherNames.keys()].sort();
if (ambiguous.join(",") !== EXPECTED.ambiguousPhilosopherNames.join(",")) {
  errors.push(
    `ambiguous philosopher names drifted:\n      got ${ambiguous.join(", ")}\n` +
      `      expected ${EXPECTED.ambiguousPhilosopherNames.join(", ")}`,
  );
}
const skipped = g.skipped.map((s) => s.surface).sort();
if (skipped.join(",") !== EXPECTED.skippedSurfaces.join(",")) {
  errors.push(
    `skipped-surface ledger drifted:\n      got ${skipped.join(", ")}\n` +
      `      expected ${EXPECTED.skippedSurfaces.join(", ")}`,
  );
}

// Blocklisted surfaces must never appear as UNSCOPED taggable entries.
// Section-scoped curated entries are the one allowed exception: the
// occurrence-level homonym splits (Antigonus) deliberately re-admit a
// blocklisted surface in individually verified sections — the skip
// ledger still documents why the surface can never tag in general.
const unscopedEntrySurfaces = new Set(
  g.entries.filter((e) => !e.onlySections).map((e) => e.surface),
);
for (const s of g.skipped) {
  if (unscopedEntrySurfaces.has(s.surface)) {
    errors.push(
      `skipped surface "${s.surface}" also present as an unscoped entry`,
    );
  }
}

// ------------------------------------------------ Greek gazetteer shape
if (g.greekEntries.length !== EXPECTED.greekNameEntries) {
  errors.push(
    `Greek name entries: ${g.greekEntries.length}, expected ${EXPECTED.greekNameEntries}`,
  );
}
const greekMulti = g.greekEntries.filter((e) => e.words.length > 1).length;
if (greekMulti !== EXPECTED.greekNameEntriesMultiWord) {
  errors.push(
    `multi-word Greek name entries: ${greekMulti}, expected ${EXPECTED.greekNameEntriesMultiWord}`,
  );
}
const greekByKind: Record<string, number> = {};
for (const e of g.greekEntries) {
  greekByKind[e.kind] = (greekByKind[e.kind] ?? 0) + 1;
}
for (const [kind, n] of Object.entries(EXPECTED.greekNameEntriesByKind)) {
  if ((greekByKind[kind] ?? 0) !== n) {
    errors.push(
      `Greek ${kind} name entries: ${greekByKind[kind] ?? 0}, expected ${n}`,
    );
  }
}
if (g.ambiguousGreekPhilosopherForms.size !== EXPECTED.ambiguousGreekForms) {
  errors.push(
    `ambiguous Greek forms: ${g.ambiguousGreekPhilosopherForms.size}, ` +
      `expected ${EXPECTED.ambiguousGreekForms}`,
  );
}
if (g.greekSkipped.length !== EXPECTED.greekSkippedForms) {
  errors.push(
    `skipped Greek forms: ${g.greekSkipped.length}, expected ${EXPECTED.greekSkippedForms}`,
  );
}
const greekSkipKeys = Object.keys(GREEK_NAME_SKIPS).sort();
if (greekSkipKeys.join("|") !== EXPECTED.greekNameSkips.join("|")) {
  errors.push(
    `Greek curation-skip ledger drifted:\n      got ${greekSkipKeys.join(", ")}\n` +
      `      expected ${EXPECTED.greekNameSkips.join(", ")}`,
  );
}
// A Greek form must never be simultaneously taggable and skipped.
// 2026-07: section-scoped entries are exempt - the skip records that the
// BARE form is unresolvable across its bearers, while a curated scoped
// entry (grcRefs, disjoint-scope split) resolves specific verified
// sections only (e.g. Heraclides of Tarsus at 7.121 vs. the skipped
// bare Ἡρακλείδης). An UNSCOPED entry sharing a skipped form is still
// a hard error.
const greekUnscopedEntryForms = new Set(
  g.greekEntries
    .filter((e) => !e.onlySections || e.onlySections.length === 0)
    .map((e) => e.form),
);
for (const s of g.greekSkipped) {
  if (greekUnscopedEntryForms.has(s.surface)) {
    errors.push(
      `skipped Greek form "${s.surface}" also present as an unscoped entry`,
    );
  }
}

// ---------------------- philosopher / source name-collision curation
// Layer-level guard for the Arcesilaus regression: a source node (claim
// / saying / anecdote authority) whose label - or auto-generated bare
// first word - collides with a corpus philosopher's name surfaces
// would turn the shared surface ambiguous and silently drop ALL of the
// philosopher's tags in both languages, unless the collision is
// handled. auditSourcePhilosopherCollisions (gazetteer.ts) classifies
// every such collision:
//  - "shared-qid": same individual under two URIs, the QID merge
//    resolves the surface to the philosopher (Aristotle, Bion, ...);
//  - "curated": the source label is suppressed from auto surface
//    generation via HOMONYM_CURATED_SOURCE_LABELS or the
//    source-mentions opt-ins (Arcesilaus, Zeno of Tarsus, ...);
//  - "uncurated": nothing handles it. Every uncurated collision below
//    is an individually REVIEWED decision; a new one fails with a
//    targeted message instead of surfacing as count drift.
{
  const REVIEWED = new Map<string, string>([
    // Reviewed uncurated collisions. Rationale per label:
    //  - full-label doubles routed through the ambiguous set + the
    //    section-owner heuristic, pinned in skippedSurfaces above:
    //    Antisthenes, Ariston, Demetrius, Heraclides, Metrocles (the
    //    reviewed source/philosopher double node without a shared QID).
    ["Antisthenes", "uncurated"],
    ["Ariston", "uncurated"],
    ["Demetrius", "uncurated"],
    ["Heraclides", "uncurated"],
    ["Metrocles", "uncurated"],
    //  - bare-first-word collisions already covered by the same
    //    ambiguous "Demetrius" / "Dionysius" buckets (the bare word was
    //    ambiguous among philosophers before these sources existed):
    ["Demetrius of Byzantium", "uncurated"],
    ["Demetrius of Magnesia", "uncurated"],
    ["Demetrius of Troezen", "uncurated"],
    ["Demetrius the Magnesian", "uncurated"],
    ["Dionysius the Stoic", "uncurated"],
    //  - resolved by the curated surfaceOverrides map in gazetteer.ts
    //    ("Epicurus" safely denotes the philosopher, same person):
    ["Epicurus (letter to Eurylochus)", "uncurated"],
    // Handled collisions, pinned so a curation or QID edit that flips
    // a resolution is a deliberate, re-reviewed change:
    ["Arcesilaus", "curated"],
    ["Heraclides of Tarsus", "curated"],
    ["Zeno of Tarsus", "curated"],
    ["Aristotle", "shared-qid"],
    ["Bion", "shared-qid"],
    ["Heraclitus", "shared-qid"],
    ["Menippus", "shared-qid"],
    ["Theophrastus", "shared-qid"],
    ["Xenophanes", "shared-qid"],
  ]);

  const collisions = auditSourcePhilosopherCollisions();
  // Positive control: the audit must actually see the known doubles -
  // an empty roster means the audit went vacuous, not that all is well.
  if (collisions.length === 0) {
    errors.push(
      "source/philosopher collision audit returned NOTHING - the audit is " +
        "broken (Arcesilaus, Metrocles and the other doubles must appear)",
    );
  }
  const seen = new Set<string>();
  for (const c of collisions) {
    seen.add(c.sourceLabel);
    const reviewed = REVIEWED.get(c.sourceLabel);
    if (reviewed === undefined) {
      if (c.resolution === "uncurated") {
        errors.push(
          `UNCURATED source/philosopher name collision: source "${c.sourceLabel}" ` +
            `shares surface(s) [${c.surfaces.join(", ")}] with philosopher(s) ` +
            `[${c.philosophers.join(", ")}] - this silently drops the ` +
            `philosopher's tags in both languages. Add the label to ` +
            `HOMONYM_CURATED_SOURCE_LABELS (gazetteer.ts) if it is a ` +
            `same-individual double node or needs curated scoped entries, ` +
            `or pin it here as a reviewed decision.`,
        );
      } else {
        errors.push(
          `new source/philosopher name collision "${c.sourceLabel}" ` +
            `(${c.resolution}) is not in the reviewed roster - verify the ` +
            `resolution and pin it in validate-annotations.ts`,
        );
      }
    } else if (reviewed !== c.resolution) {
      errors.push(
        `source/philosopher collision "${c.sourceLabel}" resolution drifted: ` +
          `${c.resolution}, reviewed as ${reviewed} - re-review the curation`,
      );
    }
  }
  for (const label of REVIEWED.keys()) {
    if (!seen.has(label)) {
      errors.push(
        `reviewed source/philosopher collision "${label}" no longer appears ` +
          `in the audit - the node was renamed or removed, prune the pin`,
      );
    }
  }
}

// ----------------------------------------- corpus-wide structural pass
const graphUris = new Set<string>(g.kindByUri.keys());
for (const t of g.terms) graphUris.add(t.termUri);

let total = 0;
let english = 0;
let greekTerms = 0;
let greekNames = 0;
let heuristicEn = 0;
let heuristicGrc = 0;
for (const s of corpus) {
  const anns = annotateSection(s);
  let lastEnd = { grc: -1, en: -1 };
  for (const a of anns) {
    total += 1;
    if (a.lang === "en") english += 1;
    else if (a.kind === "term") greekTerms += 1;
    else greekNames += 1;
    if (a.heuristic) {
      if (a.lang === "en") heuristicEn += 1;
      else heuristicGrc += 1;
    }
    const text = a.lang === "en" ? s.textEn : s.text;
    if (!text || text.slice(a.start, a.end) !== a.surface) {
      errors.push(
        `${s.id} [${a.lang}] ${a.start}-${a.end}: slice mismatch for "${a.surface}"`,
      );
    }
    if (a.start < lastEnd[a.lang]) {
      errors.push(`${s.id} [${a.lang}] ${a.start}: overlapping annotations`);
    }
    lastEnd[a.lang] = a.end;
    if (!graphUris.has(a.entityUri)) {
      errors.push(`${s.id}: entityUri not in LOD graph: ${a.entityUri}`);
    }
  }
}

if (total !== EXPECTED.totalAnnotations) {
  errors.push(
    `total annotations: ${total}, expected ${EXPECTED.totalAnnotations}`,
  );
}
if (english !== EXPECTED.english) {
  errors.push(`English annotations: ${english}, expected ${EXPECTED.english}`);
}
if (greekTerms !== EXPECTED.greekTerms) {
  errors.push(
    `Greek term annotations: ${greekTerms}, expected ${EXPECTED.greekTerms}`,
  );
}
if (greekNames !== EXPECTED.greekNames) {
  errors.push(
    `Greek name annotations: ${greekNames}, expected ${EXPECTED.greekNames}`,
  );
}
if (heuristicEn !== EXPECTED.heuristicEn) {
  errors.push(
    `English heuristic annotations: ${heuristicEn}, expected ${EXPECTED.heuristicEn}`,
  );
}
if (heuristicGrc !== EXPECTED.heuristicGrc) {
  errors.push(
    `Greek heuristic annotations: ${heuristicGrc}, expected ${EXPECTED.heuristicGrc}`,
  );
}
const summaries = getEntitySummaries();
if (summaries.length !== EXPECTED.taggedEntities) {
  errors.push(
    `tagged entities: ${summaries.length}, expected ${EXPECTED.taggedEntities}`,
  );
}

// ------------------------- catalogue refs & homonym cross-links pinned
// The reader-facing Index augments the tag-derived summaries with the
// double-titled dialogues (ALT_TITLES) and computes homonym cross-links
// at runtime (annotate.ts linkHomonyms). Pin the derived state so an
// ALT_TITLES or gazetteer edit that shifts the collision set fails
// loudly instead of silently dropping or misdirecting cross-links.
{
  const index = getIndexEntries();

  const withAltRef = index.filter((e) => e.altTitleRef);
  if (withAltRef.length !== EXPECTED.altTitleRefs) {
    errors.push(
      `catalogue refs: ${withAltRef.length} entries with altTitleRef, ` +
        `expected ${EXPECTED.altTitleRefs}`,
    );
  }
  const unresolved = withAltRef.filter((e) => !e.altTitleSectionId);
  if (unresolved.length > 0) {
    errors.push(
      `catalogue refs: ${unresolved.length} altTitleRef(s) resolve to no ` +
        `section: ${unresolved.map((e) => `${e.label} (${e.altTitleRef})`).join(", ")}`,
    );
  }

  const withHomonyms = index.filter((e) => (e.homonyms?.length ?? 0) > 0);
  if (withHomonyms.length !== EXPECTED.homonymEntries) {
    errors.push(
      `homonym cross-links: ${withHomonyms.length} entries carry homonyms, ` +
        `expected ${EXPECTED.homonymEntries}`,
    );
  }
  for (const e of withHomonyms) {
    for (const h of e.homonyms!) {
      if (!index.some((o) => o.entityUri === h.entityUri)) {
        errors.push(
          `homonym cross-links: "${e.label}" points at missing entry ` +
            `${h.entityUri}`,
        );
      }
      if (h.entityUri === e.entityUri) {
        errors.push(`homonym cross-links: "${e.label}" links to itself`);
      }
    }
  }

  // The "On Philosophy" triangle: the two dialogues subtitled
  // "On Philosophy" and the separately tagged work must all
  // cross-link each other (2 links apiece), sharing that title.
  const TRIANGLE = [
    "On Philosophy",
    "The Rivals, or On Philosophy",
    "Theages, or On Philosophy",
  ];
  for (const label of TRIANGLE) {
    const e = index.find((x) => x.label === label);
    if (!e) {
      errors.push(`On Philosophy triangle: entry "${label}" missing`);
      continue;
    }
    const links = (e.homonyms ?? []).filter(
      (h) => h.sharedTitle === "On Philosophy",
    );
    const targets = links.map((h) => h.label).sort();
    const expected = TRIANGLE.filter((l) => l !== label).sort();
    if (targets.join("|") !== expected.join("|")) {
      errors.push(
        `On Philosophy triangle: "${label}" links [${targets.join(", ")}], ` +
          `expected [${expected.join(", ")}]`,
      );
    }
  }
}

// ------------------------------------------------- behavioral checks
function synthetic(
  id: string,
  philosopher: string,
  text: string,
  textEn: string | null,
): CorpusSection {
  return {
    id,
    urn: `urn:synthetic:${id}`,
    book: 0,
    chapter: "synthetic",
    section: id,
    philosopher,
    school: "",
    text,
    textEn,
  };
}

// "Bias" the sage must not match the common noun "bias".
{
  const anns = annotateSection(
    synthetic("syn.bias", "Thales", "", "He showed no bias against Bias."),
  ).filter((a) => a.lang === "en");
  const surfaces = anns.map((a) => a.surface);
  if (surfaces.join("|") !== "Bias") {
    errors.push(
      `case-sensitivity check: expected exactly ["Bias"], got [${surfaces.join(", ")}]`,
    );
  }
}

// Longest surface wins: "Zeno of Citium" absorbs the inner "Citium".
{
  const anns = annotateSection(
    synthetic(
      "syn.longest",
      "Aristotle",
      "",
      "Zeno of Citium came to Athens.",
    ),
  ).filter((a) => a.lang === "en");
  const surfaces = anns.map((a) => a.surface);
  if (surfaces.join("|") !== "Zeno of Citium|Athens") {
    errors.push(
      `longest-match check: expected ["Zeno of Citium", "Athens"], got [${surfaces.join(", ")}]`,
    );
  }
  if (anns[0] && !anns[0].entityUri.endsWith("/philosopher/zeno-of-citium")) {
    errors.push(`longest-match check: wrong entity ${anns[0].entityUri}`);
  }
}

// Greek inflection: genitive of a curated lemma matches via the stem,
// with offsets into the original polytonic text.
{
  const text = "περὶ τῆς ἡδονῆς ἔλεγεν.";
  const anns = annotateSection(
    synthetic("syn.greek", "Epicurus", text, null),
  ).filter((a) => a.lang === "grc");
  const hit = anns.find((a) => a.label === "ἡδονή");
  if (!hit) {
    errors.push(`Greek inflection check: ἡδονῆς not matched to ἡδονή`);
  } else if (text.slice(hit.start, hit.end) !== "ἡδονῆς") {
    errors.push(
      `Greek inflection check: offsets wrong, got "${text.slice(hit.start, hit.end)}"`,
    );
  }
}

// Greek proper names: genitive form tags with offsets into the
// original polytonic text.
{
  const text = "ὁ δὲ Πλάτωνος ἀκουστὴς ἦν.";
  const anns = annotateSection(
    synthetic("syn.grcname", "Aristotle", text, null),
  ).filter((a) => a.lang === "grc" && a.kind !== "term");
  const hit = anns.find((a) => a.label === "Plato");
  if (!hit) {
    errors.push(`Greek name check: Πλάτωνος not matched to Plato`);
  } else if (text.slice(hit.start, hit.end) !== "Πλάτωνος") {
    errors.push(
      `Greek name check: offsets wrong, got "${text.slice(hit.start, hit.end)}"`,
    );
  }
}

// Capital-initial guard: πολιτείας the common noun must not tag the
// Republic; capitalized Πολιτείαν must.
{
  const lower = annotateSection(
    synthetic(
      "syn.grclower",
      "Aristotle",
      "περὶ τῆς πολιτείας ἔλεγεν.",
      null,
    ),
  ).filter((a) => a.lang === "grc" && a.kind === "work");
  if (lower.length !== 0) {
    errors.push(
      `capital-guard check: lowercase πολιτείας wrongly tagged as a work`,
    );
  }
  const upper = annotateSection(
    synthetic("syn.grcupper", "Aristotle", "ἔγραψε τὴν Πολιτείαν.", null),
  ).filter((a) => a.lang === "grc" && a.kind === "work");
  if (
    upper.length !== 1 ||
    !upper[0]!.entityUri.endsWith("/work/republic") ||
    upper[0]!.surface !== "Πολιτείαν"
  ) {
    errors.push(
      `capital-guard check: capitalized Πολιτείαν not tagged as the Republic`,
    );
  }
}

// Greek section-owner heuristic: bare Ζήνωνος only in the owner's Life.
{
  const inLife = annotateSection(
    synthetic("syn.grcowner", "Zeno of Citium", "ὁ Ζήνωνος λόγος.", null),
  ).filter((a) => a.lang === "grc" && a.kind !== "term");
  if (
    inLife.length !== 1 ||
    inLife[0]!.heuristic !== "section-owner" ||
    !inLife[0]!.entityUri.endsWith("/philosopher/zeno-of-citium")
  ) {
    errors.push(
      `Greek owner-heuristic check: Ζήνωνος not tagged in Zeno's Life`,
    );
  }
  const outside = annotateSection(
    synthetic("syn.grcnotowner", "Aristotle", "ὁ Ζήνωνος λόγος.", null),
  ).filter((a) => a.lang === "grc" && a.kind !== "term");
  if (outside.length !== 0) {
    errors.push(
      `Greek owner-heuristic check: Ζήνωνος wrongly tagged outside the Life`,
    );
  }
}

// Section-owner heuristic is flagged and scoped to the owner's Life.
{
  const inLife = annotateSection(
    synthetic("syn.owner", "Zeno of Citium", "", "Zeno said this."),
  ).filter((a) => a.lang === "en");
  if (
    inLife.length !== 1 ||
    inLife[0]!.heuristic !== "section-owner" ||
    !inLife[0]!.entityUri.endsWith("/philosopher/zeno-of-citium")
  ) {
    errors.push(`owner-heuristic check: bare "Zeno" not tagged in his Life`);
  }
  const outside = annotateSection(
    synthetic("syn.notowner", "Aristotle", "", "Zeno said this."),
  ).filter((a) => a.lang === "en");
  if (outside.length !== 0) {
    errors.push(
      `owner-heuristic check: bare "Zeno" wrongly tagged outside his Life`,
    );
  }
}

// --------------------------------------------------------------- report
if (errors.length > 0) {
  console.error(`INVALID ANNOTATIONS (${errors.length}):`);
  for (const e of errors) console.error("  " + e);
  process.exit(1);
}

console.log(
  `OK: ${total} annotations (${english} en, ${greekNames} grc names, ` +
    `${greekTerms} grc terms, ${heuristicEn}+${heuristicGrc} via ` +
    `section-owner heuristic) across ${summaries.length} entities`,
);
console.log(
  `    gazetteer: ${g.entries.length} surfaces ` +
    `(${Object.entries(byKind)
      .map(([k, n]) => `${k}:${n}`)
      .join(" ")}), ${g.terms.length} Greek terms`,
);
console.log(
  `    skipped as ambiguous: ${skipped.length}; ` +
    `owner-heuristic names: ${ambiguous.join(", ")}`,
);
