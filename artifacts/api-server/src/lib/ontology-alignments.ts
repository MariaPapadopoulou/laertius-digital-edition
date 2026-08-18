/**
 * Curated external-ontology alignment layer for the lo: ontology.
 *
 * The ontology models persons (roles), places (type union), works (facets),
 * schools, and Roche's OTV ontoterminology layer, but at the class level it
 * was an island: the only external anchors were lo:ChapterSubject under
 * foaf:Person and the rdf:Statement reifications. This module ties the
 * published TBox to established knowledge ontologies while strictly
 * respecting ontoterminology theory:
 *
 *   - Alignments attach ONLY to the conceptual dimension: owl:Class
 *     declarations and the closed-vocabulary individuals typed otv:Concept.
 *   - The linguistic dimension (otv:Term, otv:ProperName, and every
 *     /name/ and /term/ node) stays purely local and is never mapped.
 *     validate-lod hard-fails if any linguistic node ever acquires one.
 *
 * Curation policy (mirrors the instance-level "never guess a homonym" rule):
 *   - rdfs:subClassOf / rdfs:subPropertyOf bridges only where lo: semantics
 *     are strictly narrower than the external term; no bridge where the fit
 *     is loose.
 *   - skos:exactMatch only where conceptual identity is certain,
 *     skos:closeMatch where near but not identical, nothing where a match
 *     would be a guess; honest omissions are recorded in UNMAPPED_CONCEPTS
 *     with the reason.
 *   - Every external URI was verified at curation time (July 2026) against
 *     its ontology documentation or the live Wikidata API (label and
 *     description checked, never guessed from the Q-number). Runtime stays
 *     fully offline: the layer is compiled-in text.
 *   - No owl:imports (consistent with the mirrored-OTV-skeleton policy);
 *     only prefixes and the specific referenced terms appear.
 *
 * External vocabularies used:
 *   - CIDOC CRM (crm:) - museum/cultural-heritage reference model;
 *     class names verified against CRM v7.1 (E21_Person, E53_Place,
 *     E74_Group, P89_falls_within).
 *   - LAWD (lawd:) - Linking Ancient World Data; terms verified against
 *     the published lawd.rdf (Person, Place, Group, ConceptualWork).
 *   - FaBiO (fabio:) - FRBR-aligned bibliographic ontology; fabio:Work is
 *     itself a subclass of frbr:Work, so the FRBR anchor comes for free.
 *   - schema.org (schema:) - broad interoperability layer.
 *   - WGS84 Geo (geo:) - geo:SpatialThing for places.
 *   - SKOS (skos:) - concept-mapping properties for the closed
 *     vocabularies.
 */

/** Prefix block for the alignment layer, appended to the ontology Turtle. */
export const ALIGNMENT_PREFIXES: Record<string, string> = {
  crm: "http://www.cidoc-crm.org/cidoc-crm/",
  lawd: "http://lawd.info/ontology/",
  fabio: "http://purl.org/spar/fabio/",
  schema: "http://schema.org/",
  geo: "http://www.w3.org/2003/01/geo/wgs84_pos#",
  skos: "http://www.w3.org/2004/02/skos/core#",
};

/** One class-level rdfs:subClassOf bridge to an external ontology. */
export interface ClassBridge {
  /** Prefixed lo: class name, e.g. "lo:Place". */
  readonly cls: string;
  /** Prefixed external superclass, e.g. "crm:E53_Place". */
  readonly ext: string;
  /** One-line justification, kept in the module as curation record. */
  readonly note: string;
}

/**
 * Class bridges. Persons, places, works and schools only (the document
 * classes Claim/Saying/Verse/Epistle/Anecdote/Doxa/Testament/Passage are
 * deliberately out of scope). Bridges attach at lo:ChapterSubject, the
 * person superclass, exactly as the existing foaf:Person bridge does;
 * lo:Philosopher and lo:Sage inherit by subsumption, so no new rdf:type
 * arrives on any instance.
 */
export const CLASS_BRIDGES: readonly ClassBridge[] = [
  {
    cls: "lo:ChapterSubject",
    ext: "crm:E21_Person",
    note: "every chapter subject is a real historical person",
  },
  {
    cls: "lo:ChapterSubject",
    ext: "lawd:Person",
    note: "LAWD person, the ancient-world LOD convention",
  },
  {
    cls: "lo:ChapterSubject",
    ext: "schema:Person",
    note: "schema.org person for broad interoperability",
  },
  {
    cls: "lo:Place",
    ext: "crm:E53_Place",
    note: "cities, islands, regions, demes, landmarks are CRM places",
  },
  {
    cls: "lo:Place",
    ext: "lawd:Place",
    note: "LAWD place, the Pleiades-compatible convention",
  },
  {
    cls: "lo:Place",
    ext: "schema:Place",
    note: "schema.org place for broad interoperability",
  },
  {
    cls: "lo:Place",
    ext: "geo:SpatialThing",
    note: "places carry curated WGS84 coordinates in the map layer",
  },
  {
    cls: "lo:Work",
    ext: "fabio:Work",
    note: "works are FRBR works (fabio:Work is subclass of frbr:Work); most are lost, which FRBR works (title-level abstractions) model correctly",
  },
  {
    cls: "lo:Work",
    ext: "lawd:ConceptualWork",
    note: "LAWD conceptual work: the abstract work as cited, independent of any surviving text carrier",
  },
  {
    cls: "lo:Work",
    ext: "schema:CreativeWork",
    note: "schema.org creative work for broad interoperability",
  },
  {
    cls: "lo:School",
    ext: "crm:E74_Group",
    note: "a school is a group of persons acting collectively",
  },
  {
    cls: "lo:School",
    ext: "lawd:Group",
    note: "LAWD group of agents",
  },
  {
    cls: "lo:School",
    ext: "schema:Organization",
    note: "schema.org organization for broad interoperability",
  },
];

/** One property-level rdfs:subPropertyOf bridge. */
export interface PropertyBridge {
  readonly prop: string;
  readonly ext: string;
  readonly note: string;
}

/**
 * Property bridges, only where lo: semantics are strictly narrower than
 * the external property. Deliberately NOT bridged: lo:teacherOf and
 * lo:influenced (no external property matches the diadochai semantics
 * without loosening them), lo:livedIn and lo:traveledTo (schema:homeLocation
 * implies a primary home, which a reported residence is not), and
 * lo:hasRole (schema:hasOccupation ranges over schema:Occupation
 * structures, not plain role individuals).
 */
export const PROPERTY_BRIDGES: readonly PropertyBridge[] = [
  {
    prop: "lo:wrote",
    ext: "foaf:made",
    note: "authorship is a special case of making; foaf:made domain foaf:Agent fits via lo:ChapterSubject under foaf:Person",
  },
  {
    prop: "lo:locatedIn",
    ext: "crm:P89_falls_within",
    note: "one-level curated place containment is exactly CRM falls-within between E53 places",
  },
  {
    prop: "lo:bornIn",
    ext: "schema:birthPlace",
    note: "direct person-to-place birth relation, same shape as schema.org",
  },
  {
    prop: "lo:diedIn",
    ext: "schema:deathPlace",
    note: "direct person-to-place death relation, same shape as schema.org",
  },
  {
    prop: "lo:memberOf",
    ext: "schema:memberOf",
    note: "school membership is organization membership",
  },
];

export type SkosRelation = "exactMatch" | "closeMatch";

/** One SKOS mapping from a conceptual-side subject to a Wikidata entity. */
export interface ConceptMapping {
  /** Prefixed subject: a vocab individual (lo:PhilosopherRole) or one of the six place-type classes (lo:City). */
  readonly subject: string;
  readonly rel: SkosRelation;
  /** Wikidata Q-number, verified against the live API at curation time. */
  readonly qid: string;
  /** The English label of the Wikidata entity at verification time. */
  readonly wikidataLabel: string;
}

/**
 * SKOS mappings for the closed-vocabulary otv:Concept individuals and the
 * six place-type classes. Every QID was verified against the Wikidata API
 * (label and description read, not guessed). exactMatch only where the
 * concepts coincide; closeMatch where the lo: concept is a curated,
 * corpus-scoped reading of a broader (or slightly different) Wikidata
 * concept.
 */
export const CONCEPT_MAPPINGS: readonly ConceptMapping[] = [
  // ---- Person roles (14 individuals, 11 mapped)
  { subject: "lo:PhilosopherRole", rel: "exactMatch", qid: "Q4964182", wikidataLabel: "philosopher" },
  { subject: "lo:PoetRole", rel: "exactMatch", qid: "Q49757", wikidataLabel: "poet" },
  { subject: "lo:HistorianRole", rel: "exactMatch", qid: "Q201788", wikidataLabel: "historian" },
  { subject: "lo:BiographerRole", rel: "exactMatch", qid: "Q864380", wikidataLabel: "biographer" },
  // Chronographers compile dated tables (Apollodorus); a chronicler writes
  // narrative year-entries - near but not identical.
  { subject: "lo:ChronographerRole", rel: "closeMatch", qid: "Q3330547", wikidataLabel: "chronicler" },
  { subject: "lo:DoxographerRole", rel: "exactMatch", qid: "Q16889429", wikidataLabel: "doxographer" },
  // Q451286 is precisely the Greco-Roman grammarian profession.
  { subject: "lo:GrammarianRole", rel: "exactMatch", qid: "Q451286", wikidataLabel: "grammarian" },
  { subject: "lo:RhetoricianRole", rel: "exactMatch", qid: "Q361809", wikidataLabel: "rhetorician" },
  { subject: "lo:PhysicianRole", rel: "exactMatch", qid: "Q39631", wikidataLabel: "physician" },
  { subject: "lo:StatesmanRole", rel: "exactMatch", qid: "Q372436", wikidataLabel: "statesperson" },
  { subject: "lo:PriestRole", rel: "exactMatch", qid: "Q42603", wikidataLabel: "priest" },

  // ---- Work forms (3 individuals, all mapped)
  { subject: "lo:ProseForm", rel: "exactMatch", qid: "Q676", wikidataLabel: "prose" },
  // lo:VerseForm is the metrical form; Q482 is poetry as an art - near, not identical.
  { subject: "lo:VerseForm", rel: "closeMatch", qid: "Q482", wikidataLabel: "poetry" },
  { subject: "lo:MixedForm", rel: "exactMatch", qid: "Q1790870", wikidataLabel: "prosimetrum" },

  // ---- Survival statuses (3 individuals, 2 mapped)
  // lo: statuses are verdicts ON a work; the Wikidata items are classes OF
  // works - the intension differs, so closeMatch, not exact.
  { subject: "lo:LostStatus", rel: "closeMatch", qid: "Q1585442", wikidataLabel: "lost literary work" },
  { subject: "lo:ExcerptsStatus", rel: "closeMatch", qid: "Q1440453", wikidataLabel: "literary fragment" },

  // ---- Work topics (24 individuals, 23 mapped)
  // The topic label reads "physics (natural philosophy, incl. psychology,
  // zoology, botany, theology)": that is exactly the ancient discipline.
  { subject: "lo:PhysicsTopic", rel: "exactMatch", qid: "Q269323", wikidataLabel: "natural philosophy" },
  // Includes Socratic dialogues and practical philosophy - broader than Q9465.
  { subject: "lo:EthicsTopic", rel: "closeMatch", qid: "Q9465", wikidataLabel: "ethics" },
  // Covers logic, epistemology, metaphysics too - broader than Q9453.
  { subject: "lo:DialecticTopic", rel: "closeMatch", qid: "Q9453", wikidataLabel: "dialectic" },
  // Includes legislation, not only political philosophy.
  { subject: "lo:PoliticsTopic", rel: "closeMatch", qid: "Q179805", wikidataLabel: "political philosophy" },
  { subject: "lo:RhetoricTopic", rel: "exactMatch", qid: "Q81009", wikidataLabel: "rhetoric" },
  // "grammar (philology: glosses, diction, metres, proverbs)" - the ancient
  // philological sense, near Q40634 philology.
  { subject: "lo:GrammarTopic", rel: "closeMatch", qid: "Q40634", wikidataLabel: "philology" },
  // Ancient poetics/Homeric problems is literary criticism avant la lettre.
  { subject: "lo:PoeticsTopic", rel: "closeMatch", qid: "Q58854", wikidataLabel: "literary criticism" },
  { subject: "lo:MathematicsTopic", rel: "exactMatch", qid: "Q395", wikidataLabel: "mathematics" },
  { subject: "lo:AstronomyTopic", rel: "exactMatch", qid: "Q333", wikidataLabel: "astronomy" },
  { subject: "lo:GeographyTopic", rel: "exactMatch", qid: "Q1071", wikidataLabel: "geography" },
  { subject: "lo:MedicineTopic", rel: "exactMatch", qid: "Q11190", wikidataLabel: "medicine" },
  { subject: "lo:MusicTopic", rel: "exactMatch", qid: "Q638", wikidataLabel: "music" },
  { subject: "lo:HistoryTopic", rel: "exactMatch", qid: "Q309", wikidataLabel: "history" },
  { subject: "lo:BiographyTopic", rel: "exactMatch", qid: "Q36279", wikidataLabel: "biography" },
  { subject: "lo:ChronologyTopic", rel: "exactMatch", qid: "Q130788", wikidataLabel: "chronology" },
  { subject: "lo:DoxographyTopic", rel: "exactMatch", qid: "Q1253496", wikidataLabel: "doxography" },
  // Topic of works IN the epic genre; Q37484 is the epic poem itself.
  { subject: "lo:EpicTopic", rel: "closeMatch", qid: "Q37484", wikidataLabel: "epic poem" },
  { subject: "lo:LyricTopic", rel: "exactMatch", qid: "Q182357", wikidataLabel: "lyric poetry" },
  { subject: "lo:TragedyTopic", rel: "exactMatch", qid: "Q80930", wikidataLabel: "tragedy" },
  { subject: "lo:ComedyTopic", rel: "exactMatch", qid: "Q40831", wikidataLabel: "comedy" },
  { subject: "lo:SatireTopic", rel: "exactMatch", qid: "Q128758", wikidataLabel: "satire" },
  // Collections OF letters vs. the art of letter-writing - near.
  { subject: "lo:LettersTopic", rel: "closeMatch", qid: "Q97225782", wikidataLabel: "epistolography" },
  // Ancient symmikta/hypomnemata vs. the modern publishing term - near.
  { subject: "lo:MiscellanyTopic", rel: "closeMatch", qid: "Q1295240", wikidataLabel: "miscellany" },

  // ---- Place-type classes (6, all mapped). These are owl:Classes, not
  // otv:Concept individuals; the SKOS mappings still attach to the
  // conceptual side (the class), never to any linguistic node.
  // lo:City covers polis, town and village - Q486972 human settlement is
  // the honest hypernym-level match; Q515 (city, "large settlement") is not.
  { subject: "lo:City", rel: "closeMatch", qid: "Q486972", wikidataLabel: "human settlement" },
  { subject: "lo:Island", rel: "exactMatch", qid: "Q23442", wikidataLabel: "island" },
  // lo:Region spans districts and countries; Q82794 is the generic region.
  { subject: "lo:Region", rel: "closeMatch", qid: "Q82794", wikidataLabel: "region" },
  { subject: "lo:Deme", rel: "exactMatch", qid: "Q672490", wikidataLabel: "deme" },
  // lo:Landmark: sanctuaries, gymnasia, urban districts - recognizable named
  // sites, near Q2319498 (architectural landmark) but not only architectural.
  { subject: "lo:Landmark", rel: "closeMatch", qid: "Q2319498", wikidataLabel: "architectural landmark" },
  { subject: "lo:NaturalFeature", rel: "closeMatch", qid: "Q618123", wikidataLabel: "geographical feature" },
];

/** Honest omissions: concepts left unmapped, with the reason on record. */
export const UNMAPPED_CONCEPTS: readonly {
  readonly subject: string;
  readonly reason: string;
}[] = [
  {
    subject: "lo:ComicPoetRole",
    reason:
      "Wikidata has no item for the ancient comic poet as an occupation; mapping to poet or playwright would lose exactly the distinction the role encodes",
  },
  {
    subject: "lo:TragicPoetRole",
    reason:
      "Wikidata has no item for the ancient tragic poet as an occupation; same policy as the comic poet",
  },
  {
    subject: "lo:SuccessionsWriterRole",
    reason:
      "the diadochai author is a genre-specific role of Hellenistic historiography of philosophy with no Wikidata occupation item",
  },
  {
    subject: "lo:ExtantStatus",
    reason:
      "Wikidata models lost and fragmentary works as classes but has no concept for the unmarked extant case",
  },
  {
    subject: "lo:TechnicalTopic",
    reason:
      "a heterogeneous handbook bucket (tactics, agriculture, cookery, mechanics); any single Wikidata topic would misdescribe most of its works",
  },
  {
    subject: "lo:Asserted",
    reason:
      "the certainty levels encode Diogenes Laertius' own epistemic stances; Wikidata's epistemology items describe modern concepts, not this editorial axis",
  },
  {
    subject: "lo:Reported",
    reason: "same policy as lo:Asserted",
  },
  {
    subject: "lo:Disputed",
    reason: "same policy as lo:Asserted",
  },
  {
    subject: "lo:Conjectured",
    reason: "same policy as lo:Asserted",
  },
  {
    subject: "lo:Authentic",
    reason:
      "the authenticity verdicts are curator judgments on individual letters; Wikidata has no matching concept triple (literary forgery describes works, not verdicts)",
  },
  {
    subject: "lo:DisputedAuthenticity",
    reason: "same policy as lo:Authentic",
  },
  {
    subject: "lo:Spurious",
    reason: "same policy as lo:Authentic",
  },
];

/**
 * The six vocabulary classes declared rdfs:subClassOf skos:Concept so the
 * SKOS mappings on their individuals are well-formed SKOS (every mapped
 * individual is then a skos:Concept by subsumption).
 */
export const VOCAB_CLASSES_UNDER_SKOS: readonly string[] = [
  "lo:CertaintyLevel",
  "lo:AuthenticityLevel",
  "lo:Role",
  "lo:WorkForm",
  "lo:WorkTopic",
  "lo:SurvivalStatus",
];

const WD = "http://www.wikidata.org/entity/";

/**
 * The alignment layer as a Turtle fragment (no prefix declarations; the
 * caller's prologue must declare crm, lawd, fabio, schema, geo, skos, lo,
 * rdfs and foaf). RDF/XML and JSON-LD are derived from the Turtle upstream,
 * so all serializations carry identical alignments.
 */
export function alignmentsAsTurtle(ontologyUri: string): string {
  const lines: string[] = [];
  lines.push(
    "# ------------------------- External ontology alignments (conceptual side only)",
    "# Ontoterminology contract: external alignments attach ONLY to the",
    "# conceptual dimension - owl:Class declarations and the closed-vocabulary",
    "# individuals typed otv:Concept. The linguistic dimension (otv:Term,",
    "# otv:ProperName and every /name/ and /term/ node) is deliberately local",
    "# and carries no external mapping of any kind. skos:exactMatch is used",
    "# only where conceptual identity is certain, skos:closeMatch where near;",
    "# concepts without an honest match stay unmapped (same policy as the",
    "# instance-level rule: never guess a homonym). No owl:imports: only the",
    "# specific referenced terms appear, and every external URI was verified",
    "# at curation time so the runtime stays fully offline.",
    "",
    `<${ontologyUri}> rdfs:comment "External alignment contract: class-level rdfs:subClassOf bridges (CIDOC CRM, LAWD, FaBiO, schema.org, WGS84 Geo), property-level rdfs:subPropertyOf bridges, and skos:exactMatch/closeMatch mappings to Wikidata attach only to the conceptual dimension of the ontoterminology - classes and otv:Concept individuals. The linguistic dimension (otv:Term and otv:ProperName nodes) is deliberately local and carries no external mapping. Mappings are curated, verified at curation time, and never guessed; concepts without an honest external match remain unmapped."@en .`,
    "",
    "# Class bridges. Person bridges attach at lo:ChapterSubject (as the",
    "# existing foaf:Person bridge does); lo:Philosopher and lo:Sage inherit",
    "# by subsumption, so no instance gains a new rdf:type.",
  );
  for (const b of CLASS_BRIDGES) {
    lines.push(`${b.cls} rdfs:subClassOf ${b.ext} . # ${b.note}`);
  }
  lines.push(
    "",
    "# Property bridges, only where lo: semantics are strictly narrower.",
    "# Deliberately not bridged: lo:teacherOf, lo:influenced (no external",
    "# property matches the diadochai without loosening), lo:livedIn,",
    "# lo:traveledTo (schema:homeLocation implies a primary home) and",
    "# lo:hasRole (schema:hasOccupation ranges over structured occupations).",
  );
  for (const b of PROPERTY_BRIDGES) {
    lines.push(`${b.prop} rdfs:subPropertyOf ${b.ext} . # ${b.note}`);
  }
  lines.push(
    "",
    "# The six closed vocabularies under skos:Concept, so the mappings on",
    "# their individuals are well-formed SKOS.",
  );
  for (const cls of VOCAB_CLASSES_UNDER_SKOS) {
    lines.push(`${cls} rdfs:subClassOf skos:Concept .`);
  }
  lines.push(
    "",
    "# Wikidata concept mappings (verified labels in the trailing comments).",
    "# The six place-type mappings attach to the place classes themselves -",
    "# still the conceptual side of the ontoterminology.",
  );
  for (const m of CONCEPT_MAPPINGS) {
    lines.push(
      `${m.subject} skos:${m.rel} <${WD}${m.qid}> . # ${m.wikidataLabel}`,
    );
  }
  lines.push(
    "",
    "# Honest omissions - concepts left unmapped, with the reason on record:",
  );
  for (const u of UNMAPPED_CONCEPTS) {
    lines.push(`#   ${u.subject}: ${u.reason}`);
  }
  return lines.join("\n");
}
