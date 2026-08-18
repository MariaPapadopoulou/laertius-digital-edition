/**
 * Occurrence-tagging gazetteer, derived from the LOD graph itself.
 *
 * The full-graph Turtle (lod.ts) already carries every named individual
 * with its OTV layer: otv:ProperName nodes group homonymous labels and
 * point at the individuals they denote, otv:Term nodes carry the curated
 * Greek lemmas with their denoted concepts. Building the gazetteer by
 * parsing that graph (n3) means the tagger can never drift from the
 * curated data: a surface form is taggable if and only if the graph
 * resolves it to exactly one individual.
 *
 * Ambiguity policy (scholarly caution - precision over recall):
 * - a ProperName denoting several individuals is resolved only when all
 *   of them share a Wikidata owl:sameAs QID (the same person appearing
 *   as e.g. philosopher and cited source: "Aristotle"); otherwise the
 *   surface is skipped ("Antisthenes" the Cynic vs. of Rhodes);
 * - bare first names ("Zeno") are generated from multi-word labels only
 *   when globally unambiguous across ALL entities; ambiguous ones that
 *   resolve exclusively to philosophers are kept aside for the
 *   section-owner heuristic (annotate.ts tags "Zeno" as Zeno of Citium
 *   only inside Zeno of Citium's own Life, flagged as heuristic);
 * - work titles mint ProperName nodes for the annotation double
 *   dimension, but are deliberately excluded from ProperName-driven
 *   surface generation; they are tagged from rdfs:label,
 *   case-sensitively, after hard filtering of catalogue noise, and
 *   lose every collision.
 *
 * Greek proper names: ProperName nodes are per-language (plain
 * xsd:string literals, language named by otv:language, per the OTV
 * core); a Greek node's nominative (and a work carrying lo:greekTitle)
 * gets its curated closed declension from greek-names.ts; the
 * normalized forms go through the same resolution policy (unique
 * target, shared-QID merge, curated override, otherwise the
 * philosopher-only forms feed the section-owner heuristic and the rest
 * land in the skip ledger).
 */
import { Parser as N3Parser } from "n3";
import { graphAsTurtle, LOD_BASE, ONT, OTV } from "./lod";
import {
  MENTION_PERSONS,
  MENTION_BARE_NAME_SUPPRESSED,
} from "./person-mentions";
import {
  SOURCE_MENTION_LABELS,
  sourceMentionGreekEntries,
  sourceMentionTagEntries,
} from "./source-mentions";
import { normalizeGreek } from "./greek";
import {
  greekNameSpec,
  greekWorkTitleSpec,
  enumerateGreekForms,
  APOLLODORUS_CHRONOGRAPHER_SECTIONS,
} from "./greek-names";

const RDF_TYPE = "http://www.w3.org/1999/02/22-rdf-syntax-ns#type";
const RDFS_LABEL = "http://www.w3.org/2000/01/rdf-schema#label";
const OWL_SAME_AS = "http://www.w3.org/2002/07/owl#sameAs";

export type EntityKind =
  | "philosopher"
  | "school"
  | "place"
  | "person"
  | "source"
  | "work";

export interface GazetteerEntry {
  /** Exact surface form matched in the English text (case-sensitive). */
  surface: string;
  entityUri: string;
  /** Canonical rdfs:label of the entity. */
  label: string;
  kind: EntityKind;
  /** otv:ProperName node the surface came from (absent for works). */
  nameUri?: string;
  /** Curator-pinned section scope for multi-bearer names (Aristodemus):
   *  the surface may only tag inside these sections (MentionPerson /
   *  GreekNameSpec.onlySections). */
  onlySections?: string[];
}

export interface TermEntry {
  /** Curated polytonic lemma (otv:termName). */
  lemma: string;
  termUri: string;
  /** Doctrine concepts the term denotes (otv:denotedConcept). */
  conceptUris: string[];
  /** normalizeGreek(lemma). */
  normalized: string;
  /** Normalized words; length > 1 means exact phrase matching. */
  words: string[];
  /** Inflection stem for single-word lemmas; null = exact form only. */
  stem: string | null;
}

export interface SkippedSurface {
  surface: string;
  reason: "ambiguous" | "text-ambiguous";
  targets: string[];
}

export interface GreekNameEntry {
  /** Normalized declined form (multi-word forms contain spaces). */
  form: string;
  /** Normalized words; length > 1 means exact phrase matching. */
  words: string[];
  entityUri: string;
  /** Canonical rdfs:label of the entity (English). */
  label: string;
  kind: EntityKind;
  /** Polytonic nominative the form belongs to (the literal carried by
   *  the Greek otv:ProperName node). */
  grc: string;
  /** otv:ProperName node the form came from (absent for works). */
  nameUri?: string;
  /** Curator-pinned section scope for homonymous work titles: the form
   *  may only tag inside these sections (GreekNameSpec.onlySections). */
  onlySections?: string[];
}

export interface Gazetteer {
  /** Resolved surfaces, unambiguous, sorted longest-first. */
  entries: GazetteerEntry[];
  /**
   * Bare first names shared by several philosophers (and nothing else),
   * usable via the section-owner heuristic: surface -> philosopher URIs.
   */
  ambiguousPhilosopherNames: Map<string, string[]>;
  /** Surfaces dropped as unresolvable, for the validator's ledger. */
  skipped: SkippedSurface[];
  /** Greek term lemmas for the Greek-side tagger. */
  terms: TermEntry[];
  /** Resolved Greek proper-name forms, unambiguous. */
  greekEntries: GreekNameEntry[];
  /**
   * Greek forms shared by several philosophers (Ζήνων, Διογένης, ...),
   * usable via the section-owner heuristic: form -> philosopher URIs.
   */
  ambiguousGreekPhilosopherForms: Map<string, string[]>;
  /** Greek forms dropped as unresolvable, for the validator's ledger. */
  greekSkipped: SkippedSurface[];
  labelByUri: Map<string, string>;
  kindByUri: Map<string, EntityKind>;
}

/**
 * Known homonym overrides, applied only when the named URI is among the
 * surface's candidates. "Academy" is both the place in Athens and the
 * school; in Hicks' prose the word denotes the institution. "Epicurus"
 * collides with the cited authority "Epicurus (letter to Eurylochus)",
 * which is the same Epicurus (entity-links.ts header), so the bare name
 * safely denotes the philosopher.
 *
 * Built lazily: lod.ts imports annotate.ts (for the per-passage oa: layer),
 * which imports this module, so touching LOD_BASE at module top level would
 * be a TDZ error whenever lod.ts happens to load first.
 */
function surfaceOverrides(): Record<string, string> {
  return {
    Academy: `${LOD_BASE}/school/academy`,
    Epicurus: `${LOD_BASE}/philosopher/epicurus`,
  };
}

/** Curated section scopes for multi-bearer mention-person names
 *  (MentionPerson.onlySections), keyed by canonical label. */
function mentionPersonScopes(): Map<string, string[]> {
  return new Map(
    MENTION_PERSONS.filter((p) => p.onlySections).map((p) => [
      p.label,
      p.onlySections!,
    ]),
  );
}

/**
 * Occurrence-level homonym demotion, keyed by resolved label: the bare
 * surface "Apollodorus" resolves to the chronographer (person node,
 * shared Q205704 with the source node), but the TEXT has five more
 * bearers. The resolved entry is scoped to the chronographer's verified
 * sections (list + rationale in greek-names.ts); the other bearers get
 * their own scoped entries - see the Apollodorus split blocks in
 * buildGazetteer and the source-mentions.ts opt-ins.
 *
 * Deliberately UNSPLIT after the 2026-07 occurrence audit:
 * - "Timon" / Τίμων: one occurrence per language at 9.112 names the
 *   misanthrope ("There was another Timon, the misanthrope"), not
 *   Timon of Phlius. The misanthrope has no node, and the same section
 *   also contains a CORRECT occurrence (Hieronymus' remark "as for
 *   instance Timon"), so section-level scoping would trade one mis-tag
 *   for one lost correct tag. D.L. himself flags the homonym in the
 *   sentence, and the tag sits inside Timon of Phlius' own Life  - 
 *   accepted risk, no occurrence-level machinery for a single case.
 */
function homonymLabelScopes(): Map<string, string[]> {
  return new Map([["Apollodorus", APOLLODORUS_CHRONOGRAPHER_SECTIONS]]);
}

/**
 * Claim-source labels under occurrence-level homonym curation: their
 * automatic surfaces (full label + bare first word) are suppressed like
 * the source-mention opt-ins - otherwise the bare "Apollodorus"
 * candidate generated from "Apollodorus the Epicurean" would join the
 * chronographer's bucket and break its shared-QID resolution. The
 * curated scoped entries in the Apollodorus split blocks are the ONLY
 * entries for these nodes.
 *
 * "Arcesilaus" is a different flavour of the same suppression: the claim
 * source minted for the 5.41 transmission chain (Favorinus <- Hermippus
 * <- a remark of Arcesilaus) is the SAME individual as the corpus
 * philosopher Arcesilaus (source/philosopher double node). Every textual
 * occurrence of the name already tags the philosopher node, so the
 * source node gets no surfaces at all - without this entry the shared
 * name would turn ambiguous and knock out all of the philosopher's tags
 * in both languages.
 */
const HOMONYM_CURATED_SOURCE_LABELS: ReadonlySet<string> = new Set([
  "Apollodorus the Epicurean",
  "Arcesilaus",
]);

/** Same idea for Greek, keyed by the polytonic nominative: Ἀκαδήμεια
 *  denotes the school (the label "Academy" is both school and place). */
function greekOverrides(): Record<string, string> {
  return {
    Ἀκαδήμεια: `${LOD_BASE}/school/academy`,
  };
}

/**
 * Surfaces that are unique in the knowledge graph but demonstrably
 * multi-referent in the TEXT - the closed-world gazetteer cannot see
 * the bearers D.L. mentions without giving them a node. Tagging these
 * would systematically mis-attribute:
 * - "Alexander": the source is Polyhistor, but bare "Alexander" in the
 *   Lives is usually Alexander the Great (esp. book 5); since July
 *   2026 both bearers tag through the curated scoped entries in the
 *   kings-and-tyrants block below (the king via the Alexander the
 *   Great mention node, the source via its verified citation
 *   sections); the blocklist still stops the auto candidates so the
 *   undecidable occurrences (Chrysippus' addressee, the dramatist)
 *   stay untagged;
 * - "Antigonus": the source is Antigonus of Carystus, but in the royal
 *   narratives (Zeno, Menedemus, Arcesilaus, Bion, Timon) bare
 *   "Antigonus" is King Antigonus Gonatas (Monophthalmus at 2.115 and
 *   5.78); the biographer's bare citation formulas are tagged by the
 *   curated scoped entries in the homonym split block below
 *   (ANTIGONUS_CARYSTUS_SECTIONS in greek-names.ts holds the
 *   occurrence-level classification);
 * - "Theodorus": D.L. himself counts twenty Theodoruses (2.103);
 * - "Metrodorus": of Lampsacus (the node) vs. of Chios (book 9);
 * - "Herodotus": the historian (cited) vs. the Epicurean addressee of
 *   the first letter in book 10;
 * - "Timaeus": the historian of Sicily (source node) vs. Plato's
 *   dialogue in the book 3 catalogue;
 * - "Thracian": generated as a bare first word from the place label
 *   "Thracian Chersonese", but in the text bare "Thracian" is always
 *   the ethnic adjective (Orpheus the Thracian, the Thracian Cotys);
 *   the peninsula is tagged by its full label.
 */
const SURFACE_BLOCKLIST = new Set([
  "Alexander",
  "Antigonus",
  "Theodorus",
  "Metrodorus",
  "Herodotus",
  "Timaeus",
  "Thracian",
]);

/**
 * Single-word work titles safe to tag: distinctive title-words that do
 * not double as personal names in the text. Eponymous titles (Ptolemy,
 * Cyrus, Heracles, Medea...) are excluded wholesale - in prose those
 * words name the person, not the book. Multi-word titles pass without
 * an allowlist. Shared titles (Republic, Symposium) tag the title node,
 * which the KG deliberately keys by title, not by author.
 */
const SINGLE_WORD_TITLE_ALLOWLIST = new Set([
  "Memorabilia",
  "Cyropaedia",
  "Anabasis",
  "Hellenica",
  "Oeconomicus",
  "Symposium",
  "Republic",
  "Ethics",
  "Definitions",
  "Purifications",
  // Apollodorus' Chronology (source-works.ts): all 22 English
  // occurrences are his work, verified at curation time.
  "Chronology",
  // Achaeus' satyr play Omphale (person-works.ts): eponymous, but the
  // queen herself never appears - the single English occurrence
  // (2.17.134, "from the Omphale, a satiric drama of Achaeus") IS the
  // play, verified at curation time.
  "Omphale",
]);

/** First words never usable as bare-name surfaces. */
const STOP_FIRST_WORDS = new Set([
  "The",
  "A",
  "An",
  "Of",
  "On",
  "To",
  "In",
  "Seven",
]);

/**
 * Catalogue-title filter: work labels are tagged only when they look
 * like a real title that could recur in prose, not a catalogue line.
 */
function isTaggableTitle(label: string): boolean {
  if (label.length < 4 || label.length > 40) return false;
  if (!/^[A-Z]/.test(label)) return false;
  if (!/\s/.test(label) && !SINGLE_WORD_TITLE_ALLOWLIST.has(label)) {
    return false;
  }
  if (/[()[\]]/.test(label)) return false;
  if (/same title/i.test(label)) return false;
  if (
    /^(One|Two|Three|Four|Five|Six|Seven|Eight|Nine|Ten|Eleven|Twelve|Thirteen|Fourteen|Fifteen|Sixteen|Seventeen|Eighteen|Nineteen|Twenty) books?/i.test(
      label,
    )
  ) {
    return false;
  }
  if (/\bbooks?\b/i.test(label)) return false;
  if (/\blines\)?$/i.test(label)) return false;
  return true;
}

/**
 * Greek nominal endings (normalized: lowercased, diacritics stripped,
 * final sigma folded), used both to derive a lemma's stem and to accept
 * an inflected token as a form of the lemma. Deliberately conservative.
 */
const GREEK_ENDINGS: string[] = [
  "",
  "α",
  "αι",
  "αισ",
  "αν",
  "ασ",
  "ε",
  "εα",
  "ει",
  "εια",
  "ειασ",
  "εισ",
  "εσ",
  "εσι",
  "εσιν",
  "εων",
  "εωσ",
  "η",
  "ην",
  "ησ",
  "ι",
  "ια",
  "ιν",
  "ισ",
  "ν",
  "ο",
  "οι",
  "οισ",
  "ον",
  "οσ",
  "ου",
  "ουσ",
  "σ",
  "σι",
  "σιν",
  "υ",
  "υσ",
  "ω",
  "ων",
];

const ENDINGS_BY_LENGTH = [...GREEK_ENDINGS].sort(
  (a, b) => b.length - a.length,
);

export const GREEK_ENDING_SET: Set<string> = new Set(GREEK_ENDINGS);

/** Longest ending whose removal leaves a stem of >= 4 chars, else null. */
function greekStem(normalizedLemma: string): string | null {
  for (const ending of ENDINGS_BY_LENGTH) {
    if (ending.length === 0) continue;
    if (
      normalizedLemma.endsWith(ending) &&
      normalizedLemma.length - ending.length >= 4
    ) {
      return normalizedLemma.slice(0, normalizedLemma.length - ending.length);
    }
  }
  return null;
}

/** Preference when several same-person URIs share a surface. */
const KIND_PREFERENCE: EntityKind[] = [
  "philosopher",
  "person",
  "source",
  "school",
  "place",
  "work",
];

let cached: Gazetteer | null = null;
/** Wikidata QID sets per entity URI, kept for the collision audit
 *  (auditSourcePhilosopherCollisions below). Populated with `cached`. */
let cachedQids: Map<string, Set<string>> | null = null;

/** Parse the full LOD graph and derive the gazetteer. Cached. */
export function getGazetteer(): Gazetteer {
  if (cached) return cached;

  // Curated-core view only: the workbook sources index (bibliographic
  // citations, full of bare homonyms) must not feed the tagging layer.
  const quads = new N3Parser().parse(graphAsTurtle({ sourcesIndex: false }));

  const typesBySubject = new Map<string, Set<string>>();
  const labelByUri = new Map<string, string>();
  const qidsByUri = new Map<string, Set<string>>();
  /** ProperName node -> its literal surfaces / denoted objects. */
  const properNameSurfaces = new Map<string, Set<string>>();
  const properNameObjects = new Map<string, Set<string>>();
  /** Greek ProperName node -> its literals (polytonic nominatives). */
  const properNameGreek = new Map<string, Set<string>>();
  /** Raw otv:properName literals per node, partitioned after the loop
   *  by the node's otv:language (quad order is not guaranteed). */
  const properNameLiterals = new Map<string, Set<string>>();
  /** ProperName node -> its otv:language values. */
  const languagesByNode = new Map<string, Set<string>>();
  /** Work URI -> lo:greekTitle literal. */
  const greekTitleByUri = new Map<string, string>();
  const termLemmaByUri = new Map<string, string>();
  const termConcepts = new Map<string, Set<string>>();

  for (const q of quads) {
    if (q.subject.termType !== "NamedNode") continue;
    const s = q.subject.value;
    const p = q.predicate.value;
    const o = q.object;
    if (p === RDF_TYPE && o.termType === "NamedNode") {
      let set = typesBySubject.get(s);
      if (!set) {
        set = new Set();
        typesBySubject.set(s, set);
      }
      set.add(o.value);
    } else if (p === RDFS_LABEL && o.termType === "Literal") {
      if (!labelByUri.has(s)) labelByUri.set(s, o.value);
    } else if (p === OWL_SAME_AS && o.termType === "NamedNode") {
      const m = o.value.match(/^http:\/\/www\.wikidata\.org\/entity\/(Q\d+)$/);
      if (m) {
        let set = qidsByUri.get(s);
        if (!set) {
          set = new Set();
          qidsByUri.set(s, set);
        }
        set.add(m[1]!);
      }
    } else if (p === `${OTV}properName` && o.termType === "Literal") {
      // Plain xsd:string literals (OTV core range); the node's language
      // is stated by otv:language, so collect raw and partition below.
      let set = properNameLiterals.get(s);
      if (!set) {
        set = new Set();
        properNameLiterals.set(s, set);
      }
      set.add(o.value);
    } else if (p === `${OTV}language` && o.termType === "Literal") {
      let set = languagesByNode.get(s);
      if (!set) {
        set = new Set();
        languagesByNode.set(s, set);
      }
      set.add(o.value);
    } else if (p === `${ONT}greekTitle` && o.termType === "Literal") {
      greekTitleByUri.set(s, o.value);
    } else if (p === `${OTV}denotedObject` && o.termType === "NamedNode") {
      let set = properNameObjects.get(s);
      if (!set) {
        set = new Set();
        properNameObjects.set(s, set);
      }
      set.add(o.value);
    } else if (p === `${OTV}termName` && o.termType === "Literal") {
      termLemmaByUri.set(s, o.value);
    } else if (p === `${OTV}denotedConcept` && o.termType === "NamedNode") {
      let set = termConcepts.get(s);
      if (!set) {
        set = new Set();
        termConcepts.set(s, set);
      }
      set.add(o.value);
    }
  }

  // Language routing (two-pass): the per-language ProperName split means
  // a node's literals are all one language, named by its otv:language.
  // "grc" nodes feed the Greek form table, all others are English
  // surfaces.
  for (const [s, literals] of properNameLiterals) {
    const target = languagesByNode.get(s)?.has("grc")
      ? properNameGreek
      : properNameSurfaces;
    target.set(s, literals);
  }

  const kindOf = (uri: string): EntityKind | null => {
    const types = typesBySubject.get(uri);
    if (!types) return null;
    if (types.has(`${ONT}Philosopher`)) return "philosopher";
    // Book 1 sages (lo:Sage) keep the same entity kind so URIs and
    // annotation pins are unaffected by the class-level distinction.
    if (types.has(`${ONT}Sage`)) return "philosopher";
    if (types.has(`${ONT}Source`)) return "source";
    if (types.has(`${ONT}School`)) return "school";
    if (types.has(`${ONT}Place`)) return "place";
    if (types.has(`${ONT}Work`)) return "work";
    if (types.has("http://xmlns.com/foaf/0.1/Person")) return "person";
    return null;
  };

  const kindByUri = new Map<string, EntityKind>();
  for (const uri of typesBySubject.keys()) {
    const k = kindOf(uri);
    if (k) kindByUri.set(uri, k);
  }

  // ---------------------------------------------- surface -> candidates
  /** surface -> { uris, nameUri? } */
  const candidates = new Map<
    string,
    { uris: Set<string>; nameUri?: string; bareOnly: boolean }
  >();

  const addCandidate = (
    surface: string,
    uri: string,
    nameUri: string | undefined,
    bare: boolean,
  ): void => {
    const trimmed = surface.trim();
    if (trimmed.length < 3) return;
    // Compound editorial labels never occur verbatim in the text.
    if (/[,/]| or /.test(trimmed)) return;
    let entry = candidates.get(trimmed);
    if (!entry) {
      entry = { uris: new Set(), bareOnly: bare };
      candidates.set(trimmed, entry);
    }
    entry.uris.add(uri);
    if (!bare) entry.bareOnly = false;
    if (nameUri && !entry.nameUri) entry.nameUri = nameUri;
  };

  // Opted-in minted sources-index authorities (source-mentions.ts) are
  // excluded from automatic surface generation: their surfaces are pushed
  // below as explicit section-scoped entries, so bare homonyms like
  // "Diodorus", "Croton" or "Eleusis" can never tag outside the sections
  // the curation verified. Object-level (not name-node-level) so a shared
  // name node ("Croton" the place + the authority) keeps its other bearers.
  const isSuppressedMintedSource = (uri: string): boolean =>
    kindByUri.get(uri) === "source" &&
    SOURCE_MENTION_LABELS.has(labelByUri.get(uri) ?? "");

  // Same suppression for claim sources under occurrence-level homonym
  // curation (HOMONYM_CURATED_SOURCE_LABELS above).
  const isSuppressedSource = (uri: string): boolean =>
    isSuppressedMintedSource(uri) ||
    (kindByUri.get(uri) === "source" &&
      HOMONYM_CURATED_SOURCE_LABELS.has(labelByUri.get(uri) ?? ""));

  // Work URI -> its otv:ProperName node (for annotation nameUri only).
  // Works are deliberately EXCLUDED from ProperName-driven surface
  // generation below: their titles would gain bare-first-word surfaces
  // and shift the pinned tag set. Work tagging stays label-driven
  // (isTaggableTitle + collision rules), exactly as before the work
  // title ProperName nodes were minted for the OTV double dimension.
  const nameNodeByWorkUri = new Map<string, string>();
  for (const [nameNode, objects] of properNameObjects) {
    // English title node only: Greek ProperName nodes also denote the
    // work, but the English work tags below must body the English node.
    if (!properNameSurfaces.has(nameNode)) continue;
    for (const uri of objects) {
      if (kindByUri.get(uri) === "work" && !nameNodeByWorkUri.has(uri)) {
        nameNodeByWorkUri.set(uri, nameNode);
      }
    }
  }

  for (const [nameNode, surfaces] of properNameSurfaces) {
    const objects = properNameObjects.get(nameNode);
    if (!objects) continue;
    for (const surface of surfaces) {
      for (const uri of objects) {
        if (!kindByUri.has(uri)) continue;
        if (kindByUri.get(uri) === "work") continue;
        if (isSuppressedSource(uri)) continue;
        addCandidate(surface, uri, nameNode, false);
      }
      // Bare first name from multi-word labels ("Zeno of Citium" -> "Zeno").
      const words = surface.split(/\s+/);
      const first = words[0]!;
      if (
        words.length > 1 &&
        /^[A-Z]/.test(first) &&
        first.length >= 3 &&
        !STOP_FIRST_WORDS.has(first) &&
        // Mention-person labels whose bare first name is claimed by a
        // stronger bearer (Herodotus the historian, Heraclides the
        // source, ...) never auto-generate it; the curated scoped
        // entries below tag their sections instead.
        !MENTION_BARE_NAME_SUPPRESSED.has(surface)
      ) {
        for (const uri of objects) {
          if (!kindByUri.has(uri)) continue;
          if (kindByUri.get(uri) === "work") continue;
          if (isSuppressedSource(uri)) continue;
          addCandidate(first, uri, nameNode, true);
        }
      }
    }
  }

  // Work titles: tag from rdfs:label only (see the exclusion above); the
  // name node rides along so annotations can body the linguistic unit.
  for (const [uri, kind] of kindByUri) {
    if (kind !== "work") continue;
    const label = labelByUri.get(uri);
    if (!label) continue;
    if (isTaggableTitle(label)) {
      addCandidate(label, uri, nameNodeByWorkUri.get(uri), false);
    }
  }

  // ------------------------------------------------ resolve ambiguity
  const entries: GazetteerEntry[] = [];
  const ambiguousPhilosopherNames = new Map<string, string[]>();
  const skipped: SkippedSurface[] = [];

  const preferUri = (uris: string[]): string => {
    const sorted = [...uris].sort(
      (a, b) =>
        KIND_PREFERENCE.indexOf(kindByUri.get(a)!) -
        KIND_PREFERENCE.indexOf(kindByUri.get(b)!),
    );
    return sorted[0]!;
  };

  for (const [surface, cand] of candidates) {
    let uris = [...cand.uris];
    if (SURFACE_BLOCKLIST.has(surface)) {
      skipped.push({
        surface,
        reason: "text-ambiguous",
        targets: uris.sort(),
      });
      continue;
    }
    // Work titles lose every collision: "Socrates" or "Pythagoras" as a
    // catalogue title must not shadow (or poison) the person's surface.
    if (uris.length > 1 && uris.some((u) => kindByUri.get(u) !== "work")) {
      uris = uris.filter((u) => kindByUri.get(u) !== "work");
    }
    let resolved: string | null = null;

    if (uris.length === 1) {
      resolved = uris[0]!;
    } else {
      // Same person under several URIs (philosopher + cited source)?
      const qidSets = uris.map((u) => qidsByUri.get(u));
      if (qidSets.every((s) => s && s.size > 0)) {
        const shared = [...qidSets[0]!].filter((q) =>
          qidSets.every((s) => s!.has(q)),
        );
        if (shared.length > 0) resolved = preferUri(uris);
      }
      // Curated homonym override.
      if (!resolved) {
        const override = surfaceOverrides()[surface];
        if (override && cand.uris.has(override)) resolved = override;
      }
    }

    if (resolved) {
      const kind = kindByUri.get(resolved)!;
      const label = labelByUri.get(resolved) ?? surface;
      // Multi-bearer names (Aristodemus): the curated scope restricts
      // the surface to the sections where it names our entity. Same for
      // the occurrence-level homonym demotions (Apollodorus).
      const scope =
        mentionPersonScopes().get(label) ?? homonymLabelScopes().get(label);
      // A work title colliding with any name loses (handled above only
      // when unresolvable; a resolved surface can still be a work).
      entries.push({
        surface,
        entityUri: resolved,
        label,
        kind,
        ...(cand.nameUri ? { nameUri: cand.nameUri } : {}),
        ...(scope ? { onlySections: scope } : {}),
      });
      continue;
    }

    // Unresolvable. Philosopher candidates stay usable via the
    // section-owner heuristic ("Diogenes" inside Diogenes' own Life),
    // even when non-philosophers share the surface - inside the Life,
    // the bare name names the Life's subject.
    const philUris = uris
      .filter((u) => kindByUri.get(u) === "philosopher")
      .sort();
    if (philUris.length > 0) {
      ambiguousPhilosopherNames.set(surface, philUris);
    }
    if (philUris.length !== uris.length) {
      skipped.push({ surface, reason: "ambiguous", targets: uris.sort() });
    }
  }

  // Curated verbatim work surfaces: catalogue titles that the
  // compound-label filter in addCandidate rightly rejects in general
  // (comma / " or " labels are usually editorial), but which are
  // verified to appear VERBATIM in the Hicks text of the cited
  // catalogue sections. Scoped so nothing else can pick them up.
  const VERBATIM_WORK_SURFACES: { label: string; onlySections: string[] }[] = [
    // Simon's dialogue catalogue (2.122-123)
    {
      label: "Of Virtue, that it cannot be taught",
      onlySections: ["2.13.122"],
    },
    { label: "On Reason, or On Expediency", onlySections: ["2.13.123"] },
  ];
  const workUriByLabel = new Map<string, string>();
  for (const [uri, kind] of kindByUri) {
    if (kind !== "work") continue;
    const label = labelByUri.get(uri);
    if (label) workUriByLabel.set(label, uri);
  }
  for (const vw of VERBATIM_WORK_SURFACES) {
    const uri = workUriByLabel.get(vw.label);
    if (!uri) {
      throw new Error(
        `gazetteer: VERBATIM_WORK_SURFACES label "${vw.label}" has no work node - the claim was renamed or removed, reconcile the curation`,
      );
    }
    entries.push({
      surface: vw.label,
      entityUri: uri,
      label: vw.label,
      kind: "work",
      onlySections: vw.onlySections,
    });
  }

  // Curated source-mention surfaces: the minted sources-index authorities
  // opted into tagging (source-mentions.ts), each restricted to the
  // sections the curation verified. These are the ONLY entries for those
  // nodes - automatic generation was suppressed above.
  const mintedSourceUriByLabel = new Map<string, string>();
  for (const [uri, label] of labelByUri) {
    if (isSuppressedMintedSource(uri)) mintedSourceUriByLabel.set(label, uri);
  }
  for (const sm of sourceMentionTagEntries()) {
    const uri = mintedSourceUriByLabel.get(sm.label);
    if (!uri) {
      throw new Error(
        `gazetteer: source-mentions label "${sm.label}" has no minted source node in the base graph - the sources index drifted, reconcile the curation`,
      );
    }
    let smNameUri: string | undefined;
    for (const [nameNode, surfaces] of properNameSurfaces) {
      if (surfaces.has(sm.surface) && properNameObjects.get(nameNode)?.has(uri)) {
        smNameUri = nameNode;
        break;
      }
    }
    entries.push({
      surface: sm.surface,
      entityUri: uri,
      label: sm.label,
      kind: "source",
      ...(smNameUri ? { nameUri: smNameUri } : {}),
      onlySections: sm.sections,
    });
  }

  // ------------------------------------------------- Apollodorus split
  // Occurrence-level homonym curation (July 2026): six bearers share the
  // name in the text; every (surface, section) pair below was verified
  // against the Hicks text.
  //  - The chronographer (person node, Q205704): the demoted bare entry
  //    above (homonymLabelScopes) plus his one full-name mention,
  //    "Apollodorus of Athens" at 2.2.
  //  - The Epicurean Kepotyrannos (claim source, Q2369009): named in
  //    full at 10.2 and 10.13; "Apollodorus of Athens" at 7.181 is HIM
  //    (the Collection of Doctrines author), as is bare "Apollodorus" at
  //    7.181 ("So much for Apollodorus"), 10.10 (the garden purchase)
  //    and 10.25 (the heads of the school).
  //  - The Stoic of Seleucia, the Democritean of Cyzicus and the
  //    Arithmetician: source-mentions.ts opt-ins, pushed above.
  //  - The patronymic at 2.16 and Socrates' companion at 2.35 stay
  //    untagged.
  // Scoped entries with the same surface coexist safely: annotate.ts
  // resolves per-surface buckets scoped-entry-first by section id.
  const uriByLabelKind = (label: string, kind: EntityKind): string => {
    const matches = [...kindByUri].filter(
      ([u, k]) => k === kind && labelByUri.get(u) === label,
    );
    if (matches.length !== 1) {
      throw new Error(
        `gazetteer: Apollodorus split expects exactly one ${kind} node labeled "${label}", found ${matches.length} - reconcile the curation`,
      );
    }
    return matches[0]![0];
  };
  const apollodorusPerson = uriByLabelKind("Apollodorus", "person");
  const apollodorusEpicurean = uriByLabelKind(
    "Apollodorus the Epicurean",
    "source",
  );
  const apollodorusCurated: {
    surface: string;
    entityUri: string;
    onlySections: string[];
  }[] = [
    {
      surface: "Apollodorus of Athens",
      entityUri: apollodorusPerson,
      onlySections: ["2.1.2"],
    },
    {
      surface: "Apollodorus of Athens",
      entityUri: apollodorusEpicurean,
      onlySections: ["7.7.181"],
    },
    {
      surface: "Apollodorus the Epicurean",
      entityUri: apollodorusEpicurean,
      onlySections: ["10.1.2", "10.1.13"],
    },
    {
      surface: "Apollodorus",
      entityUri: apollodorusEpicurean,
      onlySections: ["7.7.181", "10.1.10", "10.1.25"],
    },
  ];
  // --------------------------------------------------- Antigonus split
  // Occurrence-level homonym curation (July 2026): bare "Antigonus"
  // stays in SURFACE_BLOCKLIST (the royal narratives), but the
  // biographer of Carystus's bare CITATION formulas were verified
  // occurrence by occurrence (ANTIGONUS_CARYSTUS_SECTIONS in
  // greek-names.ts documents the full classification). The scoped
  // entry below tags exactly the English sections where every bare
  // occurrence is the biographer: the two sculptor homonym-list
  // mentions (2.15, 9.49), "According to Antigonus" (4.22), the
  // Chrysippus source list (7.188), and Timon's Life at 9.112 (both
  // occurrences citations). 9.110 mixes "King Antigonus" with a bare
  // citation in one section - the surface would match inside "King
  // Antigonus" too, so it stays untagged there (documented in
  // greek-names.ts). Full-name "Antigonus of Carystus" already tags
  // unscoped (unambiguous).
  const antigonusCarystus = uriByLabelKind("Antigonus of Carystus", "source");
  // ----------------------------------------- Sceptic succession names
  // The mention persons of the Sceptic succession (9.114-116) carry
  // bare first names claimed by stronger bearers elsewhere (Herodotus
  // the historian, Heraclides the source, the Zeuxis cited at 9.106,
  // Eubulides/Eubulus, the Ptolemies of the royal narratives), so
  // MENTION_BARE_NAME_SUPPRESSED blocks their auto surfaces and the
  // scoped entries below tag exactly the succession sections, where
  // every bare occurrence was verified against the Hicks text. Bare
  // "Zeuxis" at 9.116 deliberately moves from the 9.106 source to
  // Zeuxis Goniopus: the source node may be the same man (never
  // conflated, see person-mentions.ts), but the 9.116 occurrence is
  // the succession pupil beyond doubt.
  const scepticCurated = [
    {
      surface: "Dioscurides",
      entityUri: uriByLabelKind("Dioscurides of Cyprus", "person"),
      onlySections: ["9.12.114"],
    },
    {
      surface: "Heraclides",
      entityUri: uriByLabelKind("Heraclides the Sceptic", "person"),
      onlySections: ["9.12.116"],
    },
    {
      surface: "Zeuxis",
      entityUri: uriByLabelKind("Zeuxis Goniopus", "person"),
      onlySections: ["9.12.116"],
    },
    {
      surface: "Eubulus",
      entityUri: uriByLabelKind("Eubulus of Alexandria", "person"),
      onlySections: ["9.12.116"],
    },
    {
      surface: "Ptolemy",
      entityUri: uriByLabelKind("Ptolemy of Cyrene", "person"),
      onlySections: ["9.12.116"],
    },
  ];
  // --------------------------------------------------- Cratinus split
  // Occurrence-level homonym curation (July 2026): the bare surface
  // "Cratinus" (skipped as ambiguous — two verse-author person nodes
  // share it) was classified occurrence by occurrence against both
  // texts. Three bearers appear:
  //  - Cratinus, the Old Comedy poet (Q350517): 1.prol.12 (poets as
  //    sophists in his Archilochi), 1.2.62 (Solon's ashes in The
  //    Chirons), 1.6.89 (Cleobulina's homonymous play);
  //  - Cratinus the Younger, Middle Comedy (Q1120896): 3.1.28 (Plato
  //    in The False Changeling), 8.1.37 (Pythagoras in the
  //    Pythagorizing Woman and The Tarentines);
  //  - the young man sacrificed at Athens (1.10.110, "two young men,
  //    Cratinus and Ctesibius") is neither poet — no node, stays
  //    untagged in both languages.
  const cratinusCurated = [
    {
      surface: "Cratinus",
      entityUri: uriByLabelKind("Cratinus", "person"),
      onlySections: ["1.prol.12", "1.2.62", "1.6.89"],
    },
    {
      surface: "Cratinus",
      entityUri: uriByLabelKind("Cratinus the Younger", "person"),
      onlySections: ["3.1.28", "8.1.37"],
    },
  ];
  // ------------------------------------------------ kings and tyrants
  // Occurrence-level homonym curation (July 2026): the bare names of
  // the kings-and-tyrants mention batch (person-mentions.ts documents
  // the full per-section classification against both texts). Bare
  // "Alexander" stays in SURFACE_BLOCKLIST and the mention labels are
  // in MENTION_BARE_NAME_SUPPRESSED; the scoped entries below re-admit
  // exactly the verified sections. The two "Alexander" scopes (the
  // king vs. the source Polyhistor's citation formulas) and the two
  // "Dionysius" scopes (Elder vs. Younger) are pairwise disjoint;
  // "Ptolemy" -> Ptolemy Soter is disjoint from the Sceptic's 9.12.116
  // entry above. Mixed or undecidable sections stay untagged
  // (3.1.21 mixes the two tyrants; the Aristippus block 2.66-84 and
  // the unspecified Ptolemaic kings are undecidable).
  const kingsCurated = [
    {
      surface: "Alexander",
      entityUri: uriByLabelKind("Alexander the Great", "person"),
      onlySections: [
        "1.prol.2",
        "2.2.3",
        "2.4.17",
        "4.2.8",
        "4.2.14",
        "4.4.23",
        "5.1.2",
        "5.1.4",
        "5.1.5",
        "5.1.10",
        "5.1.27",
        "5.5.75",
        "6.2.32",
        "6.2.38",
        "6.2.44",
        "6.2.45",
        "6.2.60",
        "6.2.63",
        "6.2.68",
        "6.2.79",
        "6.4.84",
        "6.5.88",
        "6.5.93",
        "7.1.18",
        "7.3.165",
        "9.10.58",
        "9.10.60",
        "9.11.80",
        "10.1.1",
      ],
    },
    {
      surface: "Alexander",
      entityUri: uriByLabelKind("Alexander", "source"),
      onlySections: [
        "1.11.116",
        "2.5.19",
        "2.10.106",
        "3.1.4",
        "3.1.5",
        "4.9.62",
        "7.7.179",
        "8.1.24",
        "8.1.36",
        "9.11.61",
      ],
    },
    {
      surface: "Dionysius",
      entityUri: uriByLabelKind("Dionysius the Elder", "person"),
      onlySections: ["3.1.18"],
    },
    {
      surface: "Dionysius",
      entityUri: uriByLabelKind("Dionysius the Younger", "person"),
      onlySections: [
        "2.7.61",
        "2.7.63",
        "3.1.23",
        "3.1.25",
        "3.1.34",
        "3.1.61",
        "4.1.5",
        "4.2.8",
        "4.2.11",
        "8.4.79",
      ],
    },
    {
      surface: "Ptolemy",
      entityUri: uriByLabelKind("Ptolemy Soter", "person"),
      onlySections: [
        "2.8.102",
        "2.10.111",
        "2.11.115",
        "5.2.37",
        "5.5.78",
        "5.5.79",
      ],
    },
  ];
  // ------------------------------------------------------ Bryson split
  // Occurrence-level homonym curation (August 2026): bare "Bryson" is
  // skipped as ambiguous (Bryson son of Stilpo vs. Bryson the Achaean,
  // whose full label already tags unscoped at 6.85). The three bare
  // English occurrences were classified against the Hicks text: at
  // 9.61 "he studied under Stilpo's son Bryson" is the Pyrrho-lineage
  // teacher beyond doubt (the claims layer records the same
  // identification, claims/book9.ts pyrrho-teacher-bryson); the 1.16
  // authority list gives no ethnic or patronymic, so it stays
  // untagged; 6.85 is the full name "Bryson the Achaean".
  const brysonCurated = [
    {
      surface: "Bryson",
      entityUri: uriByLabelKind("Bryson", "person"),
      onlySections: ["9.11.61"],
    },
  ];
  // ------------------------------------ Heraclides of Heraclea (7.166)
  // The single bare "Heraclides" at 7.166 is Dionysius the Renegade's
  // fellow-townsman and first teacher — the claims layer identifies
  // him as "Heraclides of Heraclea" on Diocles' report (claims/
  // book7.ts dionysius-teacher-heraclides), and 7.166 names no other
  // Heraclides. Everywhere else the bare name stays ambiguous
  // (Ponticus, the cited source, the Sceptic of 9.116) and untagged.
  const heraclidesHeracleaCurated = [
    {
      surface: "Heraclides",
      entityUri: uriByLabelKind("Heraclides of Heraclea", "person"),
      onlySections: ["7.4.166"],
    },
  ];
  const homonymCurated = [
    ...apollodorusCurated,
    {
      surface: "Antigonus",
      entityUri: antigonusCarystus,
      onlySections: ["2.3.15", "4.4.22", "7.7.188", "9.7.49", "9.12.112"],
    },
    ...scepticCurated,
    ...cratinusCurated,
    ...kingsCurated,
    ...brysonCurated,
    ...heraclidesHeracleaCurated,
  ];
  for (const ac of homonymCurated) {
    let acNameUri: string | undefined;
    for (const [nameNode, surfaces] of properNameSurfaces) {
      if (
        surfaces.has(ac.surface) &&
        properNameObjects.get(nameNode)?.has(ac.entityUri)
      ) {
        acNameUri = nameNode;
        break;
      }
    }
    entries.push({
      surface: ac.surface,
      entityUri: ac.entityUri,
      label: labelByUri.get(ac.entityUri)!,
      kind: kindByUri.get(ac.entityUri)!,
      ...(acNameUri ? { nameUri: acNameUri } : {}),
      onlySections: ac.onlySections,
    });
  }

  // Work titles colliding with resolved non-work surfaces: drop the work
  // (a title like "Socrates" or "Pythagoras" must not shadow the person).
  // Collisions inside `candidates` are already merged; this guards the
  // case where the same string resolved to a non-work entity.
  entries.sort((a, b) => b.surface.length - a.surface.length);

  // ------------------------------------------- Greek proper-name forms
  // form -> candidate URI -> the nominative/name-node it came from.
  const greekCandidates = new Map<
    string,
    Map<string, { grc: string; nameUri?: string; onlySections?: string[] }>
  >();
  const addGreekCandidate = (
    form: string,
    uri: string,
    grc: string,
    nameUri?: string,
    onlySections?: string[],
  ): void => {
    let byUri = greekCandidates.get(form);
    if (!byUri) {
      byUri = new Map();
      greekCandidates.set(form, byUri);
    }
    if (!byUri.has(uri)) {
      byUri.set(uri, {
        grc,
        ...(nameUri ? { nameUri } : {}),
        ...(onlySections ? { onlySections } : {}),
      });
    }
  };

  // Greek ProperName node by literal: the per-language split keys Greek
  // nodes by the Greek string itself, so an English surface's curated
  // nominative resolves its Greek node directly. A missing entry means
  // the graph never minted that form; the candidate is skipped (same
  // graph-validation property as the old same-node literal check).
  const greekNodeByLiteral = new Map<string, string>();
  for (const [nameNode, grcLiterals] of properNameGreek) {
    for (const g of grcLiterals) {
      if (!greekNodeByLiteral.has(g)) greekNodeByLiteral.set(g, nameNode);
    }
  }

  for (const [nameNode, surfaces] of properNameSurfaces) {
    const objects = properNameObjects.get(nameNode);
    if (!objects) continue;
    for (const surface of surfaces) {
      const spec = greekNameSpec(surface);
      if (!spec) continue;
      const greekNode = greekNodeByLiteral.get(spec.grc);
      if (!greekNode) continue;
      for (const form of enumerateGreekForms(spec)) {
        for (const uri of objects) {
          if (!kindByUri.has(uri)) continue;
          // Works never take declined-name surfaces: their Greek forms
          // come from lo:greekTitle below (same exclusion as English).
          if (kindByUri.get(uri) === "work") continue;
          // The source-mentions layer curates English scopes only - no
          // Greek declensions. Without this guard the minted authority
          // ("Croton", "Eleusis") would collide with the place's curated
          // forms and knock them out as ambiguous. Homonym-curated claim
          // sources (Apollodorus the Epicurean) are suppressed the same
          // way; their scoped Greek forms are pushed below.
          if (isSuppressedSource(uri)) continue;
          addGreekCandidate(form, uri, spec.grc, greekNode, spec.onlySections);
        }
      }
    }
  }

  // Works: the Greek title is a datatype property on the work node; the
  // Greek-title tags body the Greek ProperName node of the title.
  for (const [uri, grcTitle] of greekTitleByUri) {
    if (kindByUri.get(uri) !== "work") continue;
    const label = labelByUri.get(uri);
    if (!label) continue;
    const spec = greekWorkTitleSpec(label);
    if (!spec || spec.grc !== grcTitle) continue;
    for (const form of enumerateGreekForms(spec)) {
      addGreekCandidate(
        form,
        uri,
        spec.grc,
        greekNodeByLiteral.get(grcTitle),
        spec.onlySections,
      );
    }
  }

  const greekEntries: GreekNameEntry[] = [];
  const ambiguousGreekPhilosopherForms = new Map<string, string[]>();
  const greekSkipped: SkippedSurface[] = [];

  for (const [form, byUri] of greekCandidates) {
    let uris = [...byUri.keys()];
    // Work titles lose every collision, exactly as on the English side.
    if (uris.length > 1 && uris.some((u) => kindByUri.get(u) !== "work")) {
      uris = uris.filter((u) => kindByUri.get(u) !== "work");
    }
    // Homonymous work titles (Περὶ τῶν σοφῶν: Hermippus' On the Sages
    // vs. Theophrastus' Of the Wise): when every colliding bearer is a
    // work AND every spec carries a curator-pinned onlySections scope
    // AND the scopes are pairwise disjoint, all bearers stay taggable  - 
    // annotate.ts picks by section id. Any overlap or missing scope
    // falls through to the ordinary collision handling (skipped).
    // Since July 2026 the branch covers ALL kinds, not only works:
    // the kings-and-tyrants batch made Ἀλέξανδρος a two-bearer form
    // whose bearers (Alexander the Great vs. the source Polyhistor)
    // are BOTH curator-scoped, with no unscoped remainder for the
    // scoped/unscoped branch below to act on. The disjointness proof
    // is identical for every kind.
    if (uris.length > 1) {
      const scopes = uris.map((u) => byUri.get(u)!.onlySections);
      const seen = new Set<string>();
      let disjoint = scopes.every((s) => s && s.length > 0);
      if (disjoint) {
        for (const s of scopes) {
          for (const id of s!) {
            if (seen.has(id)) disjoint = false;
            seen.add(id);
          }
        }
      }
      if (disjoint) {
        for (const uri of uris) {
          const info = byUri.get(uri)!;
          greekEntries.push({
            form,
            words: form.split(" "),
            entityUri: uri,
            label: labelByUri.get(uri) ?? info.grc,
            kind: kindByUri.get(uri)!,
            grc: info.grc,
            ...(info.nameUri ? { nameUri: info.nameUri } : {}),
            onlySections: info.onlySections!,
          });
        }
        continue;
      }
    }
    // Curator-scoped bearers coexisting with unscoped ones (Hippobotus'
    // 7.38 Stoic pupils: the scoped Posidonius of Alexandria vs. the
    // unscoped Posidonius source, the scoped Zeno of Sidon vs. the two
    // Zeno philosophers): when every scoped bearer's scope is pairwise
    // disjoint, emit the scoped entries - annotate.ts prefers them
    // inside their sections - and let the unscoped remainder resolve as
    // usual. Identical or overlapping scopes (the Apollodorus person +
    // source pair, which shares one spec) fall through untouched.
    if (uris.length > 1) {
      const scopedUris = uris.filter(
        (u) => (byUri.get(u)!.onlySections?.length ?? 0) > 0,
      );
      const unscopedUris = uris.filter(
        (u) => (byUri.get(u)!.onlySections?.length ?? 0) === 0,
      );
      if (scopedUris.length > 0 && unscopedUris.length > 0) {
        const seen = new Set<string>();
        let disjoint = true;
        for (const u of scopedUris) {
          for (const id of byUri.get(u)!.onlySections!) {
            if (seen.has(id)) disjoint = false;
            seen.add(id);
          }
        }
        if (disjoint) {
          for (const uri of scopedUris) {
            const info = byUri.get(uri)!;
            greekEntries.push({
              form,
              words: form.split(" "),
              entityUri: uri,
              label: labelByUri.get(uri) ?? info.grc,
              kind: kindByUri.get(uri)!,
              grc: info.grc,
              ...(info.nameUri ? { nameUri: info.nameUri } : {}),
              onlySections: info.onlySections!,
            });
          }
          uris = unscopedUris;
        }
      }
    }
    let resolved: string | null = null;

    if (uris.length === 1) {
      resolved = uris[0]!;
    } else {
      // Same person under several URIs (philosopher + cited source)?
      const qidSets = uris.map((u) => qidsByUri.get(u));
      if (qidSets.every((s) => s && s.size > 0)) {
        const shared = [...qidSets[0]!].filter((q) =>
          qidSets.every((s) => s!.has(q)),
        );
        if (shared.length > 0) resolved = preferUri(uris);
      }
      // Curated homonym override, keyed by the shared nominative.
      if (!resolved) {
        const grcs = new Set(uris.map((u) => byUri.get(u)!.grc));
        if (grcs.size === 1) {
          const override = greekOverrides()[[...grcs][0]!];
          if (override && byUri.has(override)) resolved = override;
        }
      }
    }

    if (resolved) {
      const info = byUri.get(resolved)!;
      greekEntries.push({
        form,
        words: form.split(" "),
        entityUri: resolved,
        label: labelByUri.get(resolved) ?? info.grc,
        kind: kindByUri.get(resolved)!,
        grc: info.grc,
        ...(info.nameUri ? { nameUri: info.nameUri } : {}),
        ...(info.onlySections ? { onlySections: info.onlySections } : {}),
      });
      continue;
    }

    // Unresolvable: philosopher-only bearers stay usable via the
    // section-owner heuristic (Ζήνων inside Zeno of Citium's Life).
    const philUris = uris
      .filter((u) => kindByUri.get(u) === "philosopher")
      .sort();
    if (philUris.length > 0) {
      ambiguousGreekPhilosopherForms.set(form, philUris);
    }
    if (philUris.length !== uris.length) {
      greekSkipped.push({ surface: form, reason: "ambiguous", targets: uris.sort() });
    }
  }

  // -------------------------------------- Apollodorus split (Greek side)
  // Same curation as the English block above; every section was verified
  // against the Greek text. The declensions come from the shared m2
  // paradigm; the chronographer keeps the spec's own scope
  // (greek-names.ts). 10.13 has BOTH the chronographer (Ἀπολλόδωρος ἐν
  // Χρονικοῖς) and the Epicurean (Ἀπολλόδωρος ὁ Ἐπικούρειος): the bare
  // form there stays with the chronographer, and the curated multi-word
  // form wins the Epicurean's occurrence in resolveOverlaps (same start,
  // longer match). 10.2 and 10.25 have δʼ between the name and the
  // epithet, so the bare scoped forms carry them.
  const apollodorusGreekCurated: {
    label: string;
    entityUri: string;
    forms: string[];
    grc: string;
    onlySections: string[];
  }[] = [];
  const apollodorusParadigm = enumerateGreekForms({
    grc: "Ἀπολλόδωρος",
    cls: "m2",
  });
  const mintedApollodorus = (label: string): string => {
    const uri = mintedSourceUriByLabel.get(label);
    if (!uri) {
      throw new Error(
        `gazetteer: Apollodorus split (Greek) label "${label}" has no minted source node - reconcile the curation`,
      );
    }
    return uri;
  };
  apollodorusGreekCurated.push(
    {
      label: "Apollodorus of Seleucia",
      entityUri: mintedApollodorus("Apollodorus of Seleucia"),
      forms: apollodorusParadigm,
      grc: "Ἀπολλόδωρος",
      onlySections: [
        "7.1.39",
        "7.1.41",
        "7.1.54",
        "7.1.64",
        "7.1.84",
        "7.1.102",
        "7.1.118",
        "7.1.121",
        "7.1.125",
        "7.1.129",
        "7.1.135",
        "7.1.140",
        "7.1.142",
        "7.1.143",
        "7.1.150",
        "7.1.157",
      ],
    },
    {
      label: "Apollodorus of Cyzicus",
      entityUri: mintedApollodorus("Apollodorus of Cyzicus"),
      forms: apollodorusParadigm,
      grc: "Ἀπολλόδωρος",
      onlySections: ["9.7.38"],
    },
    {
      label: "Apollodorus the Arithmetician",
      entityUri: mintedApollodorus("Apollodorus the Arithmetician"),
      forms: apollodorusParadigm,
      grc: "Ἀπολλόδωρος",
      onlySections: ["1.1.25", "8.1.12"],
    },
    {
      label: "Apollodorus the Epicurean",
      entityUri: apollodorusEpicurean,
      forms: apollodorusParadigm,
      grc: "Ἀπολλόδωρος",
      onlySections: ["7.7.181", "10.1.2", "10.1.10", "10.1.25"],
    },
    {
      label: "Apollodorus the Epicurean",
      entityUri: apollodorusEpicurean,
      forms: [normalizeGreek("Ἀπολλόδωρος ὁ Ἐπικούρειος")],
      grc: "Ἀπολλόδωρος ὁ Ἐπικούρειος",
      onlySections: ["10.1.13"],
    },
    // Antigonus split: 2.143 mixes three king occurrences with the
    // biographer's "Ἀντίγονος ὁ Καρύστιος" - the bare spec form is NOT
    // scoped to this section (it would tag the king too), so the
    // curated multi-word form alone picks out the biographer there.
    // The biographer-pure sections tag through the spec's own
    // onlySections (ANTIGONUS_CARYSTUS_SECTIONS, greek-names.ts).
    {
      label: "Antigonus of Carystus",
      entityUri: antigonusCarystus,
      forms: [normalizeGreek("Ἀντίγονος ὁ Καρύστιος")],
      grc: "Ἀντίγονος ὁ Καρύστιος",
      onlySections: ["2.17.143"],
    },
  );
  for (const ag of apollodorusGreekCurated) {
    for (const form of ag.forms) {
      greekEntries.push({
        form,
        words: form.split(" "),
        entityUri: ag.entityUri,
        label: ag.label,
        kind: "source",
        grc: ag.grc,
        onlySections: ag.onlySections,
      });
    }
  }

  // ------------------------- source-mentions Greek forms (grcRefs opt-in)
  // Mentions carrying grcRefs (source-mentions.ts) get their label's
  // curated Greek paradigm (greek-names.ts) as scoped entries, exactly
  // like the Apollodorus split above: auto surface generation for these
  // labels is suppressed in BOTH languages, so the grcRefs sections are
  // the only Greek tagging sites. Every section was verified to contain
  // a declined form of the name in the Greek text.
  for (const sg of sourceMentionGreekEntries()) {
    const uri = mintedSourceUriByLabel.get(sg.label);
    if (!uri) {
      throw new Error(
        `gazetteer: source-mentions grcRefs label "${sg.label}" has no minted source node - reconcile the curation`,
      );
    }
    const spec = greekNameSpec(sg.label);
    if (!spec) {
      throw new Error(
        `gazetteer: source-mentions grcRefs label "${sg.label}" has no GREEK_NAMES spec - add the paradigm to greek-names.ts`,
      );
    }
    for (const form of enumerateGreekForms(spec)) {
      greekEntries.push({
        form,
        words: form.split(" "),
        entityUri: uri,
        label: sg.label,
        kind: "source",
        grc: spec.grc,
        onlySections: sg.sections,
      });
    }
  }

  greekEntries.sort((a, b) => b.form.length - a.form.length);
  greekSkipped.sort((a, b) => a.surface.localeCompare(b.surface));

  // -------------------------------------------------------- Greek terms
  const terms: TermEntry[] = [];
  for (const [uri, lemma] of termLemmaByUri) {
    const normalized = normalizeGreek(lemma);
    const words = normalized.split(/\s+/).filter((w) => w.length > 0);
    const stem = words.length === 1 ? greekStem(normalized) : null;
    terms.push({
      lemma,
      termUri: uri,
      conceptUris: [...(termConcepts.get(uri) ?? [])].sort(),
      normalized,
      words,
      stem,
    });
  }
  terms.sort((a, b) => a.lemma.localeCompare(b.lemma, "el"));

  skipped.sort((a, b) => a.surface.localeCompare(b.surface));

  cached = {
    entries,
    ambiguousPhilosopherNames,
    skipped,
    terms,
    greekEntries,
    ambiguousGreekPhilosopherForms,
    greekSkipped,
    labelByUri,
    kindByUri,
  };
  cachedQids = qidsByUri;
  return cached;
}

// ------------------------------------------------------------------
// Philosopher / source name-collision audit
// ------------------------------------------------------------------

export interface SourcePhilosopherCollision {
  /** rdfs:label of the source node whose name collides. */
  sourceLabel: string;
  sourceUri: string;
  /** The colliding surfaces (full label and/or bare first word). */
  surfaces: string[];
  /** Labels of the corpus philosophers sharing those surfaces. */
  philosophers: string[];
  /**
   * How the collision is (or is not) handled:
   *  - "shared-qid": the source shares a Wikidata QID with every
   *    colliding philosopher (source/philosopher double node for the
   *    same individual); the shared-QID merge in getGazetteer resolves
   *    the surface to the philosopher, nothing is lost;
   *  - "curated": the source label is suppressed from automatic
   *    surface generation (HOMONYM_CURATED_SOURCE_LABELS or the
   *    source-mentions opt-ins), so the philosopher keeps the surface
   *    and the source gets only curated scoped entries (if any);
   *  - "uncurated": NOTHING handles the collision - the shared
   *    surface turns ambiguous and every one of the philosopher's
   *    tags on it silently vanishes in both languages (the Arcesilaus
   *    regression). Must be reviewed: either the label belongs in
   *    HOMONYM_CURATED_SOURCE_LABELS (same-individual double node or
   *    zero-surface source) or the ambiguity is a deliberate,
   *    validator-pinned decision (Metrocles).
   */
  resolution: "shared-qid" | "curated" | "uncurated";
}

/**
 * Audit every source node whose label (or auto-generated bare first
 * word) collides with a corpus philosopher's name surfaces. This is
 * the layer-level guard behind validate-annotations: a new claim /
 * saying / anecdote source that shares a philosopher's name must be
 * curated HERE, not discovered later as annotation-count drift.
 *
 * Mirrors the surface generation rules of getGazetteer (trim, minimum
 * length, compound-label filter, STOP_FIRST_WORDS, capitalized bare
 * first words from multi-word labels).
 */
export function auditSourcePhilosopherCollisions(): SourcePhilosopherCollision[] {
  const g = getGazetteer();
  const qids = cachedQids!;

  const surfacesOf = (label: string): string[] => {
    const trimmed = label.trim();
    // Compound editorial labels never generate surfaces (addCandidate).
    if (/[,/]| or /.test(trimmed)) return [];
    const out: string[] = [];
    if (trimmed.length >= 3) out.push(trimmed);
    const words = trimmed.split(/\s+/);
    const first = words[0]!;
    if (
      words.length > 1 &&
      /^[A-Z]/.test(first) &&
      first.length >= 3 &&
      !STOP_FIRST_WORDS.has(first)
    ) {
      out.push(first);
    }
    return out;
  };

  const philosophersBySurface = new Map<string, Set<string>>();
  for (const [uri, kind] of g.kindByUri) {
    if (kind !== "philosopher") continue;
    const label = g.labelByUri.get(uri);
    if (!label) continue;
    for (const s of surfacesOf(label)) {
      let set = philosophersBySurface.get(s);
      if (!set) {
        set = new Set();
        philosophersBySurface.set(s, set);
      }
      set.add(uri);
    }
  }

  const collisions: SourcePhilosopherCollision[] = [];
  for (const [uri, kind] of g.kindByUri) {
    if (kind !== "source") continue;
    const label = g.labelByUri.get(uri);
    if (!label) continue;
    const hitSurfaces = new Set<string>();
    const philUris = new Set<string>();
    for (const s of surfacesOf(label)) {
      const phils = philosophersBySurface.get(s);
      if (!phils) continue;
      hitSurfaces.add(s);
      for (const p of phils) philUris.add(p);
    }
    if (philUris.size === 0) continue;

    let resolution: SourcePhilosopherCollision["resolution"] = "uncurated";
    if (
      HOMONYM_CURATED_SOURCE_LABELS.has(label) ||
      SOURCE_MENTION_LABELS.has(label)
    ) {
      resolution = "curated";
    } else {
      const sourceQids = qids.get(uri);
      if (
        sourceQids &&
        sourceQids.size > 0 &&
        [...philUris].every((p) => {
          const pq = qids.get(p);
          return pq !== undefined && [...pq].some((q) => sourceQids.has(q));
        })
      ) {
        resolution = "shared-qid";
      }
    }

    collisions.push({
      sourceLabel: label,
      sourceUri: uri,
      surfaces: [...hitSurfaces].sort(),
      philosophers: [...philUris]
        .map((p) => g.labelByUri.get(p) ?? p)
        .sort(),
      resolution,
    });
  }
  collisions.sort((a, b) => a.sourceLabel.localeCompare(b.sourceLabel));
  return collisions;
}
