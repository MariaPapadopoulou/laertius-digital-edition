/**
 * OTB inventory: the concept system of the Diogenes Laertius ontoterminology,
 * modeled 1:1 on the curator's TEDI 4.1 reference export
 * (diogenes_laertius_22_07_26.rdf). Everything the reference declares is kept
 * with the same fragment ids, the same isA tree, the same relation and
 * attribute signatures. The few additions the full corpus needs beyond the
 * reference inventory are marked `extension: true` and surfaced to the UI so
 * the curator can review them in TEDI:
 *
 *   - concept  Saying (isA Document): 637 curated apophthegmata need a home;
 *     the reference models Anecdotes/Opinions/Verse but no Saying concept.
 *   - relation isAbout (Assertion -> Person): the reference leaves the
 *     assertion subject implicit in the text excerpt; with 1560 assertions a
 *     navigable subject link is indispensable.
 *   - relation wrote (Person -> Work | CitedSource): the reference has Work
 *     as a top concept but no authorship relation; source works and person
 *     works need it.
 *   - relation isRelatedTo gets OWL domain/range axioms (Document -> Person):
 *     the reference declares it as an otv:Relation but never axiomatizes or
 *     uses it; we use it to anchor each document to its philosopher.
 *   - attribute certainty (Assertion): keeps the corpus' four-valued
 *     certainty (asserted/reported/disputed/conjectured) next to the
 *     reference's three-valued confidence mapping.
 *
 * Fragment ids of topics never collide with relation ids (e.g. the
 * authorship topic is `authorship`, not `wrote`): objects, properties and
 * concepts share the one hash namespace of the export.
 */

export interface OtbConceptDef {
  id: string;
  /** Parent concept (otv:isA / skos:broader / rdfs:subClassOf). */
  isA?: string;
  /** Top category the concept's instances belong to. */
  category: string;
  /** otv:shortConceptName, when the reference or a term supplies one. */
  shortName?: string;
  /** skos:definition carried by the concept and its preferred en term. */
  definition?: string;
  /** skos:related concept ids (reference declares them on the SKOS layer). */
  related?: string[];
  /**
   * Hand-picked illustrative objects (fragment ids), emitted as
   * skos:example resources on the skos:Concept block. Every id must
   * resolve to a model object whose concept is this concept or one of
   * its descendants (validate-otb enforces the closure). The reference
   * export declares no examples; the addition is noted in extensions[].
   */
  examples?: string[];
  /** True when the concept is our addition beyond the reference inventory. */
  extension?: boolean;
}

export interface OtbRelationDef {
  id: string;
  /** Domain concept ids (owl:unionOf when more than one). */
  domain: string[];
  /** Range concept ids (owl:unionOf when more than one). */
  range: string[];
  /**
   * False for relations the reference lists as otv:Relation without OWL
   * axioms (hasFunction, hasPart); they are declared but carry no
   * domain/range block.
   */
  axiomatized: boolean;
  extension?: boolean;
  /**
   * Domain members that are OUR widening beyond the curator's reference
   * export (the relation itself is the reference's, so it is not flagged
   * `extension`). Machine-readable so downstream drawing/exemption
   * decisions justified by "that leg is our widening" can be
   * cross-checked instead of rotting silently. Every entry must also
   * appear in `domain`; if a future reference export adopts the widened
   * domain (or the widening is reverted), remove the entry here and
   * revisit the dependent decisions.
   */
  widenedDomain?: string[];
}

export interface OtbAttributeDef {
  id: string;
  /** Domain concept ids. */
  domain: string[];
  extension?: boolean;
}

export interface OtbTermDef {
  /** Fragment id, `<name>_<lang>` per the reference (`philosopher_en`). */
  id: string;
  name: string;
  lang: "en" | "grc";
  concept: string;
  status: "preferred" | "admitted";
  partOfSpeech: "noun" | "none";
  gender: "masculine" | "feminine" | "neuter" | "none";
  definition?: string;
  /**
   * External link to the LSJ entry for the term's lemma (via Logeion),
   * emitted as rdfs:seeAlso on the otv:Term and linked from the TEDI
   * dictionaries. Greek terms only.
   */
  lsj?: string;
  /**
   * Wikidata lexeme URI for the term's Ancient Greek lemma, emitted as
   * rdfs:seeAlso next to the LSJ link and linked from the TEDI
   * dictionaries. Greek terms only; every L-id is hand-verified against
   * Wikidata (exact grc lemma match on an Ancient Greek (Q35497) lexeme)
   * before inclusion — terms without a confident match stay LSJ-only
   * (εἱμαρμένη has no Ancient Greek lexeme on Wikidata as of 2026-08).
   */
  wikidata?: string;
}

/** Canonical topic objects (otv:Object instances of the Topic subtree). */
export interface OtbTopicDef {
  id: string;
  concept:
    | "Topic"
    | "TopicBirth"
    | "TopicDeath"
    | "TopicMannerOfDeath"
    | "TopicFirstPrinciple"
    | "TopicNature"
    | "TopicCosmos"
    | "TopicSoul"
    | "TopicGod"
    | "TopicKnowledge"
    | "TopicReason"
    | "TopicPleasure"
    | "TopicFate";
}

/** Categories exactly as the reference declares them (otv:Category). */
export const CATEGORIES: string[] = [
  "Work",
  "Assertion",
  "Topic",
  "Text",
  "Document",
  "PhilosophicalSchool",
  "Place",
  "GroupOfSages",
  "Person",
];

export const CONCEPTS: OtbConceptDef[] = [
  {
    id: "Person",
    category: "Person",
    shortName: "person",
    definition:
      "Named individual of the Lives: philosophers, their relatives, rulers, poets and every other person Diogenes Laertius mentions.",
    related: ["Place", "Work"],
    examples: ["diogenesLaertius", "alcibiades", "aeschylus"],
  },
  {
    id: "Philosopher",
    isA: "Person",
    category: "Person",
    shortName: "philosopher",
    definition:
      "Person who is a .lover of wisdom, i.e., one who speculates on truth and reality (LSJ https://logeion.uchicago.edu/%CF%86%CE%B9%CE%BB%CF%8C%CF%83%CE%BF%CF%86%CE%BF%CF%82)",
    related: ["PhilosophicalSchool", "GroupOfSages", "Philosopher"],
    examples: ["socrates", "plato", "epicurus", "zenoOfCitium"],
  },
  {
    id: "PhilosophicalSchool",
    category: "PhilosophicalSchool",
    shortName: "philosophical school",
    definition:
      "School or sect (hairesis) gathering philosophers around a founder and a shared doctrine, as Diogenes Laertius organizes the successions.",
    related: ["Philosopher"],
    examples: ["stoa", "academy", "cynic"],
  },
  {
    id: "GroupOfSages",
    category: "GroupOfSages",
    shortName: "group of sages",
    definition:
      "The canon of the Sages of early Greece (the Seven and the further candidates Diogenes Laertius reports in Book 1).",
    examples: ["groupOfSages"],
  },
  {
    id: "Place",
    category: "Place",
    shortName: "place",
    definition:
      "Named geographic location of the Lives: birthplaces, cities of residence, sites of death and travel.",
    related: ["Person"],
    examples: ["place-athens", "place-miletus", "place-alexandria"],
  },
  {
    id: "Work",
    category: "Work",
    shortName: "work",
    definition:
      "Written work named in the Lives and attributed to a person, whether extant or lost.",
    examples: [
      "work-plato-republic",
      "work-plato-phaedo-or-on-the-soul",
      "work-aristotle-poetics-one-book",
    ],
  },
  {
    id: "Document",
    category: "Document",
    shortName: "document",
    definition:
      "Self-contained textual unit embedded in or cited by the Lives: wills, letters, verses, sayings, anecdotes, doxographies and cited sources.",
    examples: [
      "testament-epicurus",
      "epistle-thales-to-solon",
      "saying-thales-know-thyself",
    ],
  },
  {
    id: "Testament",
    isA: "Document",
    category: "Document",
    shortName: "testament",
    definition:
      "Will of a philosopher quoted verbatim by Diogenes Laertius (six survive in the Lives).",
    examples: ["testament-plato", "testament-aristotle", "testament-epicurus"],
  },
  {
    id: "Epistle",
    isA: "Document",
    category: "Document",
    shortName: "epistle",
    definition:
      "Letter quoted or excerpted in the Lives, with named sender and addressee.",
    examples: [
      "epistle-epicurus-to-menoeceus",
      "epistle-epicurus-to-herodotus",
      "epistle-thales-to-solon",
    ],
  },
  {
    id: "Verse",
    isA: "Document",
    category: "Document",
    shortName: "verse",
    definition:
      "Verse passage quoted in the Lives, including Diogenes Laertius' own compositions.",
    examples: ["verse-1.prol.4-0", "verse-1.1.23-0"],
  },
  {
    id: "Epigram",
    isA: "Verse",
    category: "Document",
    shortName: "epigram",
    definition:
      "Short verse composition on a philosopher, typically an epitaph; most are Diogenes Laertius' own.",
    examples: ["verse-1.prol.3-0", "verse-1.1.39-1"],
  },
  {
    id: "Opinions",
    isA: "Document",
    category: "Document",
    shortName: "opinions",
    definition:
      "Doxographic tenet (doxa): a philosopher's opinion as the Lives reports it.",
    examples: [
      "opinion-thales-water-first-principle",
      "opinion-anaximander-unlimited-principle",
    ],
  },
  {
    id: "Anecdotes",
    isA: "Document",
    category: "Document",
    shortName: "anecdote",
    definition:
      "Anecdote (chreia): a pointed incident about a philosopher reported in the Lives.",
    examples: [
      "anecdote-thales-olive-presses",
      "anecdote-thales-stargazer-ditch",
      "anecdote-solon-feigns-madness",
    ],
  },
  {
    id: "Saying",
    isA: "Document",
    category: "Document",
    shortName: "saying",
    definition:
      "Apophthegm: a saying attributed to a philosopher and quoted in the Lives.",
    extension: true,
    examples: [
      "saying-diogenes-sinope-lamp",
      "saying-thales-know-thyself",
      "saying-thales-most-ancient-god",
    ],
  },
  {
    id: "CitedSource",
    isA: "Document",
    category: "Document",
    shortName: "cited source",
    definition:
      "Work Diogenes Laertius cites as an authority for a statement of the Lives.",
    examples: [
      "livesOfEminentPhilosophers",
      "src-ApollodorusChronology",
      "src-HermippusOnTheSages",
    ],
  },
  {
    id: "Text",
    category: "Text",
    shortName: "text",
    definition:
      "CTS-addressable passage of the Lives carrying the evidence for an assertion.",
    examples: ["txt-thales-lived-miletus", "txt-thales-birth-ol35"],
  },
  {
    id: "Assertion",
    category: "Assertion",
    shortName: "assertion",
    definition:
      "Scholarly assertion extracted from the Lives: who asserts what, where, with what confidence.",
    related: ["Document", "Text", "Assertion", "Topic", "Person"],
    examples: ["assert-thales-lived-miletus", "assert-thales-descent-phoenician"],
  },
  {
    id: "Topic",
    category: "Topic",
    shortName: "topic",
    definition: "Subject matter an assertion is about.",
    examples: ["doctrine", "authorship"],
  },
  {
    id: "TopicBirth",
    isA: "Topic",
    category: "Topic",
    shortName: "birth",
    definition:
      "Birth as a biographical subject: birthplace and birth date, usually dated by Olympiad or archonship.",
    related: ["TopicDeath"],
    examples: ["birthPlace", "birthDate"],
  },
  {
    id: "TopicDeath",
    isA: "Topic",
    category: "Topic",
    shortName: "death",
    definition:
      "Death as a biographical subject: place, date and age at death, often with rival reports.",
    related: ["TopicBirth", "TopicMannerOfDeath"],
    examples: ["deathPlace", "deathDate"],
  },
  {
    id: "TopicMannerOfDeath",
    isA: "Topic",
    category: "Topic",
    shortName: "manner of death",
    definition:
      "How a philosopher died, as the Lives reports or disputes it: illness, suicide, execution, accident or old age.",
    related: ["TopicDeath"],
    examples: ["suicide", "judicialExecution"],
  },
  {
    id: "TopicSoul",
    isA: "Topic",
    category: "Topic",
    shortName: "soul",
    definition:
      "The soul as a doctrinal subject: its nature, substance, parts and fate in the philosophers' teachings.",
    related: ["TopicReason", "TopicKnowledge"],
    extension: true,
  },
  {
    id: "TopicKnowledge",
    isA: "Topic",
    category: "Topic",
    shortName: "knowledge",
    definition:
      "Knowledge as a doctrinal subject: its possibility, criterion and kinds in the philosophers' teachings.",
    related: ["TopicReason"],
    extension: true,
  },
  {
    id: "TopicFirstPrinciple",
    isA: "Topic",
    category: "Topic",
    shortName: "first principle",
    definition:
      "The first principle (arche) as a doctrinal subject: what the philosophers posit as the origin and element of all things, from Thales' water onward.",
    related: ["TopicNature", "TopicCosmos"],
    extension: true,
  },
  {
    id: "TopicNature",
    isA: "Topic",
    category: "Topic",
    shortName: "nature",
    definition:
      "Nature (physis) as a doctrinal subject: the physical part of philosophy concerning the world and what is in it, as Diogenes Laertius divides the discipline.",
    related: ["TopicFirstPrinciple", "TopicCosmos"],
    extension: true,
  },
  {
    id: "TopicCosmos",
    isA: "Topic",
    category: "Topic",
    shortName: "cosmos",
    definition:
      "The cosmos as a doctrinal subject: its origin, order, uniqueness or plurality, and destruction in the philosophers' teachings.",
    related: ["TopicNature", "TopicGod"],
    extension: true,
  },
  {
    id: "TopicPleasure",
    isA: "Topic",
    category: "Topic",
    shortName: "pleasure",
    definition:
      "Pleasure (hedone) as a doctrinal subject: its status as end, good or indifferent, from Aristippus and Epicurus to their critics.",
    extension: true,
  },
  {
    id: "TopicGod",
    isA: "Topic",
    category: "Topic",
    shortName: "the divine",
    definition:
      "The divine as a doctrinal subject: the existence, nature and providence of gods in the philosophers' teachings.",
    related: ["TopicCosmos", "TopicFate"],
    extension: true,
  },
  {
    id: "TopicFate",
    isA: "Topic",
    category: "Topic",
    shortName: "fate",
    definition:
      "Fate (heimarmene) as a doctrinal subject: necessity, causation and providence, above all in the Stoic teaching.",
    related: ["TopicGod", "TopicReason"],
    extension: true,
  },
  {
    id: "TopicReason",
    isA: "Topic",
    category: "Topic",
    shortName: "reason",
    definition:
      "Reason (logos) as a doctrinal subject: the rational principle in nature and in the soul, and the logical part of philosophy.",
    related: ["TopicSoul", "TopicKnowledge"],
    extension: true,
  },
];

export const RELATIONS: OtbRelationDef[] = [
  { id: "assertedBy", domain: ["Assertion"], range: ["Person"], axiomatized: true },
  { id: "assertedIn", domain: ["Assertion"], range: ["Document"], axiomatized: true },
  { id: "foundedBy", domain: ["PhilosophicalSchool"], range: ["Philosopher"], axiomatized: true },
  { id: "hasBirthPlace", domain: ["Person"], range: ["Place"], axiomatized: true },
  {
    // The reference restricts hasContent to Assertion; the domain is
    // widened so every embedded textual genre item can carry its verbatim excerpt
    // as a Text object (noted in extensions[], not flagged extension:
    // the relation itself is the reference's).
    id: "hasContent",
    domain: ["Assertion", "Document"],
    range: ["Text", "Assertion"],
    axiomatized: true,
    widenedDomain: ["Document"],
  },
  { id: "hasFunction", domain: [], range: [], axiomatized: false },
  { id: "hasPart", domain: [], range: [], axiomatized: false },
  {
    // The reference restricts hasTopic to Assertion; the domain is
    // widened so doxai (Opinions documents) can point at their
    // doctrinal subject (noted in extensions[], not flagged extension:
    // the relation itself is the reference's).
    id: "hasTopic",
    domain: ["Assertion", "Document"],
    range: ["Topic"],
    axiomatized: true,
    widenedDomain: ["Document"],
  },
  { id: "isBirthPlaceOf", domain: ["Place"], range: ["Person"], axiomatized: true },
  { id: "isFounderOf", domain: ["Philosopher"], range: ["PhilosophicalSchool"], axiomatized: true },
  {
    id: "isMemberOf",
    domain: ["Philosopher"],
    range: ["PhilosophicalSchool", "GroupOfSages"],
    axiomatized: true,
  },
  { id: "isPupilOf", domain: ["Philosopher"], range: ["Philosopher"], axiomatized: true },
  {
    // Declared but unaxiomatized in the reference; we axiomatize it to
    // anchor each embedded textual genre item to its philosopher.
    id: "isRelatedTo",
    domain: ["Document"],
    range: ["Person"],
    axiomatized: true,
    extension: true,
  },
  { id: "isTeacherOf", domain: ["Philosopher"], range: ["Philosopher"], axiomatized: true },
  {
    id: "isAbout",
    domain: ["Assertion"],
    range: ["Person"],
    axiomatized: true,
    extension: true,
  },
  {
    id: "wrote",
    domain: ["Person"],
    range: ["Work", "CitedSource"],
    axiomatized: true,
    extension: true,
  },
];

export const ATTRIBUTES: OtbAttributeDef[] = [
  { id: "confidence", domain: ["Assertion"] },
  { id: "cts", domain: ["Text"] },
  { id: "hasBirthDate", domain: ["Person"] },
  { id: "hasDeathDate", domain: ["Person"] },
  { id: "text", domain: ["Text"] },
  { id: "certainty", domain: ["Assertion"], extension: true },
];

/**
 * Canonical topic objects. The first block reproduces the reference's own
 * individuals (including its six manners of death, with the reference's
 * `accidentalDearh` spelling corrected); the second block adds one topic per
 * remaining claim property of the corpus, named so no topic id collides with
 * a relation id.
 */
export const TOPICS: OtbTopicDef[] = [
  { id: "birthDate", concept: "TopicBirth" },
  { id: "birthPlace", concept: "TopicBirth" },
  { id: "deathDate", concept: "TopicDeath" },
  { id: "deathPlace", concept: "TopicDeath" },
  { id: "mannerOfDeath", concept: "TopicMannerOfDeath" },
  { id: "suicide", concept: "TopicMannerOfDeath" },
  { id: "illness", concept: "TopicMannerOfDeath" },
  { id: "naturalDeath", concept: "TopicMannerOfDeath" },
  { id: "judicialExecution", concept: "TopicMannerOfDeath" },
  { id: "accidentalDeath", concept: "TopicMannerOfDeath" },
  { id: "victimOfHomicide", concept: "TopicMannerOfDeath" },
  { id: "residence", concept: "Topic" },
  { id: "travel", concept: "Topic" },
  { id: "parentage", concept: "Topic" },
  { id: "authorship", concept: "Topic" },
  { id: "education", concept: "Topic" },
  { id: "affiliation", concept: "Topic" },
  { id: "praise", concept: "Topic" },
  { id: "criticism", concept: "Topic" },
  { id: "doctrine", concept: "Topic" },
  { id: "successionTopic", concept: "Topic" },
  { id: "oldAge", concept: "Topic" },
  // Canonical objects for the doctrinal topics, so doxai can point at
  // the specific subject (arche, physis, kosmos...) instead of the
  // generic doctrine topic.
  { id: "firstPrinciple", concept: "TopicFirstPrinciple" },
  { id: "cosmosTopic", concept: "TopicCosmos" },
  { id: "physisTopic", concept: "TopicNature" },
  { id: "soulTopic", concept: "TopicSoul" },
  { id: "theDivine", concept: "TopicGod" },
  { id: "knowledgeTopic", concept: "TopicKnowledge" },
  { id: "logosTopic", concept: "TopicReason" },
  { id: "pleasureTopic", concept: "TopicPleasure" },
  { id: "fateTopic", concept: "TopicFate" },
];

/**
 * Doxa domain -> canonical topic object id, where the fit is exact.
 * Domains without a matching doctrinal topic (ethics, politics, death)
 * keep the generic `doctrine` fallback.
 */
export const DOXA_DOMAIN_TOPIC: Record<string, string> = {
  "first-principles": "firstPrinciple",
  cosmology: "cosmosTopic",
  physics: "physisTopic",
  soul: "soulTopic",
  gods: "theDivine",
  epistemology: "knowledgeTopic",
  logic: "logosTopic",
  pleasure: "pleasureTopic",
  fate: "fateTopic",
};

/** Claim property -> canonical topic object id. */
export const PROPERTY_TOPIC: Record<string, string> = {
  birthPlace: "birthPlace",
  deathPlace: "deathPlace",
  livedIn: "residence",
  traveledTo: "travel",
  birthDate: "birthDate",
  deathDate: "deathDate",
  mannerOfDeath: "mannerOfDeath",
  parentage: "parentage",
  wrote: "authorship",
  writings: "authorship",
  studiedUnder: "education",
  education: "education",
  affiliatedWith: "affiliation",
  praised: "praise",
  criticized: "criticism",
  heldDoctrine: "doctrine",
  succession: "successionTopic",
  oldAge: "oldAge",
  deme: "birthPlace",
};

/**
 * Multilingual terminology. English preferred terms for every named concept;
 * classical Greek terms where the Lives itself supplies the standard word.
 * Greek strings use precomposed polytonic codepoints throughout.
 */
export const TERMS: OtbTermDef[] = [
  {
    id: "philosopher_en",
    name: "philosopher",
    lang: "en",
    concept: "Philosopher",
    status: "preferred",
    partOfSpeech: "none",
    gender: "none",
    definition:
      "Person who is a .lover of wisdom, i.e., one who speculates on truth and reality (LSJ https://logeion.uchicago.edu/%CF%86%CE%B9%CE%BB%CF%8C%CF%83%CE%BF%CF%86%CE%BF%CF%82)",
  },
  {
    id: "philosophos_grc",
    lsj: "https://logeion.uchicago.edu/%CF%86%CE%B9%CE%BB%CF%8C%CF%83%CE%BF%CF%86%CE%BF%CF%82",
    wikidata: "http://www.wikidata.org/entity/L1111081",
    name: "φιλόσοφος",
    lang: "grc",
    concept: "Philosopher",
    status: "preferred",
    partOfSpeech: "noun",
    gender: "masculine",
    definition:
      "Lover of wisdom; the word Pythagoras is said to have coined for himself (D.L. 1.12).",
  },
  {
    id: "philosophical_school_en",
    name: "philosophical school",
    lang: "en",
    concept: "PhilosophicalSchool",
    status: "preferred",
    partOfSpeech: "noun",
    gender: "none",
    definition:
      "School or sect gathering philosophers around a founder and a shared doctrine.",
  },
  {
    id: "hairesis_grc",
    lsj: "https://logeion.uchicago.edu/%CE%B1%E1%BC%B5%CF%81%CE%B5%CF%83%CE%B9%CF%82",
    wikidata: "http://www.wikidata.org/entity/L1104382",
    name: "αἵρεσις",
    lang: "grc",
    concept: "PhilosophicalSchool",
    status: "preferred",
    partOfSpeech: "noun",
    gender: "feminine",
    definition:
      "Choice, hence school of thought; the word Diogenes Laertius uses for the philosophical sects (D.L. 1.19-20).",
  },
  {
    id: "place_en",
    name: "place",
    lang: "en",
    concept: "Place",
    status: "preferred",
    partOfSpeech: "noun",
    gender: "none",
    definition: "Named geographic location of the Lives.",
  },
  {
    id: "topos_grc",
    lsj: "https://logeion.uchicago.edu/%CF%84%CF%8C%CF%80%CE%BF%CF%82",
    wikidata: "http://www.wikidata.org/entity/L1102031",
    name: "τόπος",
    lang: "grc",
    concept: "Place",
    status: "preferred",
    partOfSpeech: "noun",
    gender: "masculine",
    definition: "Place, region.",
  },
  {
    id: "work_en",
    name: "work",
    lang: "en",
    concept: "Work",
    status: "preferred",
    partOfSpeech: "noun",
    gender: "none",
    definition: "Written work named in the Lives and attributed to a person.",
  },
  {
    id: "document_en",
    name: "document",
    lang: "en",
    concept: "Document",
    status: "preferred",
    partOfSpeech: "noun",
    gender: "none",
    definition: "Self-contained textual unit embedded in or cited by the Lives.",
  },
  {
    id: "testament_en",
    name: "testament",
    lang: "en",
    concept: "Testament",
    status: "preferred",
    partOfSpeech: "noun",
    gender: "none",
    definition: "Will of a philosopher quoted verbatim by Diogenes Laertius.",
  },
  {
    id: "diatheke_grc",
    lsj: "https://logeion.uchicago.edu/%CE%B4%CE%B9%CE%B1%CE%B8%CE%AE%CE%BA%CE%B7",
    wikidata: "http://www.wikidata.org/entity/L1102374",
    name: "διαθήκη",
    lang: "grc",
    concept: "Testament",
    status: "preferred",
    partOfSpeech: "noun",
    gender: "feminine",
    definition: "Disposition of property, will; the heading of the quoted wills.",
  },
  {
    id: "epistle_en",
    name: "epistle",
    lang: "en",
    concept: "Epistle",
    status: "preferred",
    partOfSpeech: "noun",
    gender: "none",
    definition: "Letter quoted or excerpted in the Lives.",
  },
  {
    id: "epistole_grc",
    lsj: "https://logeion.uchicago.edu/%E1%BC%90%CF%80%CE%B9%CF%83%CF%84%CE%BF%CE%BB%CE%AE",
    wikidata: "http://www.wikidata.org/entity/L1102722",
    name: "ἐπιστολή",
    lang: "grc",
    concept: "Epistle",
    status: "preferred",
    partOfSpeech: "noun",
    gender: "feminine",
    definition: "Letter, epistle.",
  },
  {
    id: "verse_en",
    name: "verse",
    lang: "en",
    concept: "Verse",
    status: "preferred",
    partOfSpeech: "noun",
    gender: "none",
    definition: "Verse passage quoted in the Lives.",
  },
  {
    id: "epigram_en",
    name: "epigram",
    lang: "en",
    concept: "Epigram",
    status: "preferred",
    partOfSpeech: "noun",
    gender: "none",
    definition: "Short verse composition on a philosopher, typically an epitaph.",
  },
  {
    id: "epigramma_grc",
    lsj: "https://logeion.uchicago.edu/%E1%BC%90%CF%80%CE%AF%CE%B3%CF%81%CE%B1%CE%BC%CE%BC%CE%B1",
    wikidata: "http://www.wikidata.org/entity/L1104980",
    name: "ἐπίγραμμα",
    lang: "grc",
    concept: "Epigram",
    status: "preferred",
    partOfSpeech: "noun",
    gender: "neuter",
    definition: "Inscription, epigram.",
  },
  {
    id: "opinions_en",
    name: "opinions",
    lang: "en",
    concept: "Opinions",
    status: "preferred",
    partOfSpeech: "noun",
    gender: "none",
    definition: "Doxographic tenet as the Lives reports it.",
  },
  {
    id: "doxai_grc",
    lsj: "https://logeion.uchicago.edu/%CE%B4%CF%8C%CE%BE%CE%B1",
    wikidata: "http://www.wikidata.org/entity/L1102106",
    name: "δόξαι",
    lang: "grc",
    concept: "Opinions",
    status: "preferred",
    partOfSpeech: "noun",
    gender: "feminine",
    definition:
      "Opinions, tenets; the doxographic sense in the very title of the Lives and Opinions.",
  },
  {
    id: "anecdote_en",
    name: "anecdote",
    lang: "en",
    concept: "Anecdotes",
    status: "preferred",
    partOfSpeech: "noun",
    gender: "none",
    definition: "Pointed incident about a philosopher reported in the Lives.",
  },
  {
    id: "chreia_grc",
    lsj: "https://logeion.uchicago.edu/%CF%87%CF%81%CE%B5%CE%AF%CE%B1",
    wikidata: "http://www.wikidata.org/entity/L1103172",
    name: "χρεία",
    lang: "grc",
    concept: "Anecdotes",
    status: "preferred",
    partOfSpeech: "noun",
    gender: "feminine",
    definition:
      "Chreia: a concise, pointed anecdote about a named person, the rhetorical genre of the philosophic anecdote.",
  },
  {
    id: "saying_en",
    name: "saying",
    lang: "en",
    concept: "Saying",
    status: "preferred",
    partOfSpeech: "noun",
    gender: "none",
    definition: "Apophthegm attributed to a philosopher and quoted in the Lives.",
  },
  {
    id: "apophthegma_grc",
    lsj: "https://logeion.uchicago.edu/%E1%BC%80%CF%80%CF%8C%CF%86%CE%B8%CE%B5%CE%B3%CE%BC%CE%B1",
    wikidata: "http://www.wikidata.org/entity/L1102649",
    name: "ἀπόφθεγμα",
    lang: "grc",
    concept: "Saying",
    status: "preferred",
    partOfSpeech: "noun",
    gender: "neuter",
    definition: "Terse pointed saying, apophthegm (cf. D.L. 1.34).",
  },
  {
    id: "cited_source_en",
    name: "cited source",
    lang: "en",
    concept: "CitedSource",
    status: "preferred",
    partOfSpeech: "noun",
    gender: "none",
    definition: "Work Diogenes Laertius cites as an authority.",
  },
  {
    id: "text_en",
    name: "text",
    lang: "en",
    concept: "Text",
    status: "preferred",
    partOfSpeech: "noun",
    gender: "none",
    definition: "CTS-addressable passage of the Lives carrying assertion evidence.",
  },
  {
    id: "assertion_en",
    name: "assertion",
    lang: "en",
    concept: "Assertion",
    status: "preferred",
    partOfSpeech: "noun",
    gender: "none",
    definition:
      "Scholarly assertion extracted from the Lives: who asserts what, where, with what confidence.",
  },
  {
    id: "topic_en",
    name: "topic",
    lang: "en",
    concept: "Topic",
    status: "preferred",
    partOfSpeech: "noun",
    gender: "none",
    definition: "Subject matter an assertion is about.",
  },
  {
    id: "person_en",
    name: "person",
    lang: "en",
    concept: "Person",
    status: "preferred",
    partOfSpeech: "noun",
    gender: "none",
    definition: "Named individual of the Lives.",
  },
  {
    id: "group_of_sages_en",
    name: "group of sages",
    lang: "en",
    concept: "GroupOfSages",
    status: "preferred",
    partOfSpeech: "noun",
    gender: "none",
    definition: "The canon of the Sages of early Greece (Book 1).",
  },
  {
    id: "soul_en",
    name: "soul",
    lang: "en",
    concept: "TopicSoul",
    status: "preferred",
    partOfSpeech: "noun",
    gender: "none",
    definition:
      "The soul as a doctrinal subject in the Lives: its nature, substance, parts and fate.",
  },
  {
    id: "psyche_grc",
    lsj: "https://logeion.uchicago.edu/%CF%88%CF%85%CF%87%CE%AE",
    wikidata: "http://www.wikidata.org/entity/L1102048",
    name: "ψυχή",
    lang: "grc",
    concept: "TopicSoul",
    status: "preferred",
    partOfSpeech: "noun",
    gender: "feminine",
    definition:
      "Soul, the principle of life; a standing doctrinal subject of the Lives (e.g. D.L. 7.156-157 on the Stoic account).",
  },
  {
    id: "pneuma_grc",
    lsj: "https://logeion.uchicago.edu/%CF%80%CE%BD%CE%B5%E1%BF%A6%CE%BC%CE%B1",
    wikidata: "http://www.wikidata.org/entity/L1101882",
    name: "πνεῦμα",
    lang: "grc",
    concept: "TopicSoul",
    status: "admitted",
    partOfSpeech: "noun",
    gender: "neuter",
    definition:
      "Breath, spirit; the Stoics' word for the soul's substance, the soul being warm breath (D.L. 7.156-157).",
  },
  {
    id: "knowledge_en",
    name: "knowledge",
    lang: "en",
    concept: "TopicKnowledge",
    status: "preferred",
    partOfSpeech: "noun",
    gender: "none",
    definition:
      "Knowledge as a doctrinal subject in the Lives: its possibility, criterion and kinds.",
  },
  {
    id: "gnosis_grc",
    lsj: "https://logeion.uchicago.edu/%CE%B3%CE%BD%E1%BF%B6%CF%83%CE%B9%CF%82",
    wikidata: "http://www.wikidata.org/entity/L1101908",
    name: "γνῶσις",
    lang: "grc",
    concept: "TopicKnowledge",
    status: "preferred",
    partOfSpeech: "noun",
    gender: "feminine",
    definition:
      "Knowing, knowledge; a doctrinal subject throughout the Lives, from the Sceptics' denials to the Stoic criterion.",
  },
  {
    id: "episteme_grc",
    lsj: "https://logeion.uchicago.edu/%E1%BC%90%CF%80%CE%B9%CF%83%CF%84%CE%AE%CE%BC%CE%B7",
    wikidata: "http://www.wikidata.org/entity/L1103317",
    name: "ἐπιστήμη",
    lang: "grc",
    concept: "TopicKnowledge",
    status: "admitted",
    partOfSpeech: "noun",
    gender: "feminine",
    definition:
      "Scientific knowledge, secure understanding; the Stoics define it as unshakable apprehension by reason (D.L. 7.47).",
  },
  {
    id: "first_principle_en",
    name: "first principle",
    lang: "en",
    concept: "TopicFirstPrinciple",
    status: "preferred",
    partOfSpeech: "noun",
    gender: "none",
    definition:
      "The origin and element of all things as each philosopher posits it, from Thales' water onward.",
  },
  {
    id: "arche_grc",
    lsj: "https://logeion.uchicago.edu/%E1%BC%80%CF%81%CF%87%CE%AE",
    wikidata: "http://www.wikidata.org/entity/L1101898",
    name: "ἀρχή",
    lang: "grc",
    concept: "TopicFirstPrinciple",
    status: "preferred",
    partOfSpeech: "noun",
    gender: "feminine",
    definition:
      "Beginning, first principle; Thales declared water the principle of all things (D.L. 1.27).",
  },
  {
    id: "stoicheion_grc",
    lsj: "https://logeion.uchicago.edu/%CF%83%CF%84%CE%BF%CE%B9%CF%87%CE%B5%E1%BF%96%CE%BF%CE%BD",
    wikidata: "http://www.wikidata.org/entity/L1103001",
    name: "στοιχεῖον",
    lang: "grc",
    concept: "TopicFirstPrinciple",
    status: "admitted",
    partOfSpeech: "noun",
    gender: "neuter",
    definition:
      "Element; the four elements of the physical doxographies and the Stoic account of principles and elements (D.L. 7.134-137).",
  },
  {
    id: "nature_en",
    name: "nature",
    lang: "en",
    concept: "TopicNature",
    status: "preferred",
    partOfSpeech: "noun",
    gender: "none",
    definition:
      "The physical part of philosophy, concerning the world and what is in it (D.L. 1.18).",
  },
  {
    id: "physis_grc",
    lsj: "https://logeion.uchicago.edu/%CF%86%CF%8D%CF%83%CE%B9%CF%82",
    wikidata: "http://www.wikidata.org/entity/L1101913",
    name: "φύσις",
    lang: "grc",
    concept: "TopicNature",
    status: "preferred",
    partOfSpeech: "noun",
    gender: "feminine",
    definition:
      "Nature; the subject of the physical part of philosophy in Diogenes Laertius' division (D.L. 1.18).",
  },
  {
    id: "cosmos_en",
    name: "cosmos",
    lang: "en",
    concept: "TopicCosmos",
    status: "preferred",
    partOfSpeech: "noun",
    gender: "none",
    definition:
      "The ordered world: its origin, uniqueness or plurality, and destruction in the philosophers' teachings.",
  },
  {
    id: "kosmos_grc",
    lsj: "https://logeion.uchicago.edu/%CE%BA%CF%8C%CF%83%CE%BC%CE%BF%CF%82",
    wikidata: "http://www.wikidata.org/entity/L1101841",
    name: "κόσμος",
    lang: "grc",
    concept: "TopicCosmos",
    status: "preferred",
    partOfSpeech: "noun",
    gender: "masculine",
    definition:
      "Order, hence the ordered world; Pythagoras is credited with first calling the heaven kosmos (D.L. 8.48).",
  },
  {
    id: "pleasure_en",
    name: "pleasure",
    lang: "en",
    concept: "TopicPleasure",
    status: "preferred",
    partOfSpeech: "noun",
    gender: "none",
    definition:
      "Pleasure as end, good or indifferent, from Aristippus and Epicurus to their critics.",
  },
  {
    id: "hedone_grc",
    lsj: "https://logeion.uchicago.edu/%E1%BC%A1%CE%B4%CE%BF%CE%BD%CE%AE",
    wikidata: "http://www.wikidata.org/entity/L1101885",
    name: "ἡδονή",
    lang: "grc",
    concept: "TopicPleasure",
    status: "preferred",
    partOfSpeech: "noun",
    gender: "feminine",
    definition:
      "Pleasure; the end for Aristippus and, as absence of pain, for Epicurus (D.L. 2.87, 10.128-131).",
  },
  {
    id: "ataraxia_grc",
    lsj: "https://logeion.uchicago.edu/%E1%BC%80%CF%84%CE%B1%CF%81%CE%B1%CE%BE%CE%AF%CE%B1",
    wikidata: "http://www.wikidata.org/entity/L1103782",
    name: "ἀταραξία",
    lang: "grc",
    concept: "TopicPleasure",
    status: "admitted",
    partOfSpeech: "noun",
    gender: "feminine",
    definition:
      "Freedom from disturbance; the tranquillity Epicurus and the Sceptics set as the goal (D.L. 9.107, 10.136).",
  },
  {
    id: "the_divine_en",
    name: "the divine",
    lang: "en",
    concept: "TopicGod",
    status: "preferred",
    partOfSpeech: "noun",
    gender: "none",
    definition:
      "The existence, nature and providence of gods in the philosophers' teachings.",
  },
  {
    id: "theos_grc",
    lsj: "https://logeion.uchicago.edu/%CE%B8%CE%B5%CF%8C%CF%82",
    wikidata: "http://www.wikidata.org/entity/L1101950",
    name: "θεός",
    lang: "grc",
    concept: "TopicGod",
    status: "preferred",
    partOfSpeech: "noun",
    gender: "masculine",
    definition:
      "God; for Thales the most ancient of all things, for the Stoics an intelligent, fiery breath pervading the cosmos (D.L. 1.35, 7.147).",
  },
  {
    id: "fate_en",
    name: "fate",
    lang: "en",
    concept: "TopicFate",
    status: "preferred",
    partOfSpeech: "noun",
    gender: "none",
    definition:
      "Necessity, causation and providence, above all in the Stoic teaching.",
  },
  {
    id: "heimarmene_grc",
    lsj: "https://logeion.uchicago.edu/%CE%B5%E1%BC%B1%CE%BC%CE%B1%CF%81%CE%BC%CE%AD%CE%BD%CE%B7",
    name: "εἱμαρμένη",
    lang: "grc",
    concept: "TopicFate",
    status: "preferred",
    partOfSpeech: "noun",
    gender: "feminine",
    definition:
      "Fate; the connected chain of causes of existing things in the Stoic definition (D.L. 7.149).",
  },
  {
    id: "reason_en",
    name: "reason",
    lang: "en",
    concept: "TopicReason",
    status: "preferred",
    partOfSpeech: "noun",
    gender: "none",
    definition:
      "The rational principle in nature and in the soul, and the logical part of philosophy.",
  },
  {
    id: "logos_grc",
    lsj: "https://logeion.uchicago.edu/%CE%BB%CF%8C%CE%B3%CE%BF%CF%82",
    wikidata: "http://www.wikidata.org/entity/L1101900",
    name: "λόγος",
    lang: "grc",
    concept: "TopicReason",
    status: "preferred",
    partOfSpeech: "noun",
    gender: "masculine",
    definition:
      "Reason, account, argument; the seminal reason of the cosmos in Stoic physics (D.L. 7.135-136).",
  },
];

/** Category of a concept: its top ancestor in the isA tree. */
export function conceptCategory(conceptId: string): string {
  const byId = new Map(CONCEPTS.map((c) => [c.id, c]));
  let cur = byId.get(conceptId);
  if (!cur) throw new Error(`otb: unknown concept ${conceptId}`);
  return cur.category;
}
