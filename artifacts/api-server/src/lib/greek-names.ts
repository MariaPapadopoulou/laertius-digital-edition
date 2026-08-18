/**
 * Curated Greek proper-name forms for the occurrence tagger.
 *
 * Keyed by the entity's canonical English rdfs:label (the join key the
 * whole knowledge layer uses). Each entry gives the polytonic
 * nominative - emitted into the LOD graph as the plain otv:properName
 * literal of a per-language Greek otv:ProperName node, otv:language
 * "grc" (lo:greekTitle for works) - plus the machinery to recognize
 * its inflected forms in the Greek text: a declension class with a
 * CLOSED normalized ending list, or an explicit form list for
 * irregulars. The shared GREEK_ENDINGS whitelist used for doctrine
 * terms is deliberately NOT reused here: it lacks the consonant-stem
 * case endings personal names need (Πλάτωνος, Σωκράτους), and an open
 * ending list would over-match; every class below is a closed paradigm.
 *
 * Matching policy (annotate.ts):
 * - whole normalized tokens only, and the token's first character in
 *   the ORIGINAL text must be an uppercase letter - the same guard the
 *   English side gets from case-sensitive matching ("Bias" vs "bias";
 *   here Ἵππαρχος vs ἵππαρχος the cavalry commander);
 * - homonymous nominatives (Ζήνων, Διογένης, Δημήτριος) group exactly
 *   like English surfaces: resolved only via a shared Wikidata QID,
 *   else philosopher bearers stay usable through the section-owner
 *   heuristic and everything else is skipped;
 * - residual risk accepted and documented: a capitalized homograph at
 *   sentence start (Δῆλον "it is clear", Βίας at line start) can slip
 *   through, exactly as English "Bias" would at sentence start.
 *
 * Deferred by design (documented, not silently dropped):
 * - ethnics and demonyms (Ἀθηναῖος, Χῖος ὁ ἀνήρ, Μυτιληναῖος):
 *   adjective morphology, and Hicks' English already tags the person;
 * - Greek school labels (Στωικοί, Περιπατητικοί, Ἀκαδημαϊκοί): plural
 *   adjectives, not proper names - only Ἀκαδήμεια the institution and
 *   the gymnasium places (Λύκειον, Κυνόσαργες) are curated;
 * - epithet phrases (Ζήνων ὁ Κιτιεύς) as disambiguators: the article +
 *   ethnic inflects independently; a later iteration could resolve the
 *   two Zenos from the epithet instead of the section owner.
 *
 * Curation sources: the v10 workbook's Greek name columns, the
 * dl_sources.jsonl nameGrc column, and the corpus itself (every entry
 * was audited against the capitalized-token inventory of the Perseus
 * text; declension classes assigned per name, not guessed globally).
 */
import { normalizeGreek } from "./greek";

/** Closed normalized paradigms; stem = normalized nominative minus `nom`. */
const CLASSES = {
  /** o-declension masc/fem: Ἐπίκουρος, Μίλητος. */
  m2: { nom: "οσ", endings: ["οσ", "ου", "ω", "ον", "ε"] },
  /** o-declension neuter: Βυζάντιον, Λύκειον. */
  n2: { nom: "ον", endings: ["ον", "ου", "ω"] },
  /** o-declension plural place: Δελφοί, Σόλοι. */
  pl2: { nom: "οι", endings: ["οι", "ων", "οισ", "ουσ"] },
  /** neuter plural place: Μέγαρα, Ἄβδηρα. */
  pln: { nom: "α", endings: ["α", "ων", "οισ"] },
  /** a-declension plural place: Ἀθῆναι, Θῆβαι. */
  pl1: { nom: "αι", endings: ["αι", "ων", "αισ", "ασ"] },
  /** masc a-declension -ας: Πυθαγόρας, -ου. */
  m1a: { nom: "ασ", endings: ["ασ", "ου", "α", "αν"] },
  /** masc a-declension -ης: Εὐριπίδης, -ου. */
  m1h: { nom: "ησ", endings: ["ησ", "ου", "η", "ην"] },
  /** fem -α, -ας: Ἰταλία. */
  f1a: { nom: "α", endings: ["α", "ασ", "αν"] },
  /** fem -η, -ης: Κρήτη. */
  f1h: { nom: "η", endings: ["η", "ησ", "ην"] },
  /** fem -α with -ης genitive: Αἴγινα, Σμύρνα. */
  f1x: { nom: "α", endings: ["α", "ησ", "η", "αν"] },
  /** σ-stem -ης, -ους: Σωκράτης (with acc -η and voc -ες). */
  s3: { nom: "ησ", endings: ["ησ", "ουσ", "ει", "η", "ην", "εσ"] },
  /** τ-stem -ης, -ητος: Κράτης, Κέβης. */
  et3: { nom: "ησ", endings: ["ησ", "ητοσ", "ητι", "ητα"] },
  /** -κλῆς, -κλέους: Σοφοκλῆς, Ἐμπεδοκλῆς. */
  kl3: { nom: "ησ", endings: ["ησ", "εουσ", "ει", "εα", "ην", "εισ"] },
  /** ν-stem -ων, -ωνος: Πλάτων, Ζήνων. */
  n3o: { nom: "ων", endings: ["ων", "ωνοσ", "ωνι", "ωνα"] },
  /** ν-stem -ων, -ονος: Λακεδαίμων, Λυκόφρων. */
  n3on: { nom: "ων", endings: ["ων", "ονοσ", "ονι", "ονα"] },
  /** ντ-stem -ῶν, -ῶντος: Ξενοφῶν. */
  nt3: { nom: "ων", endings: ["ων", "ωντοσ", "ωντι", "ωντα"] },
  /** ντ-stem -ων, -οντος: Φλέγων. */
  ont3: { nom: "ων", endings: ["ων", "οντοσ", "οντι", "οντα"] },
  /** ρ-stem -ωρ, -ορος: Κράντωρ. */
  or3: { nom: "ωρ", endings: ["ωρ", "οροσ", "ορι", "ορα"] },
  /** ντ-stem -ας, -αντος: Βίας, Τάρας. */
  ant3: { nom: "ασ", endings: ["ασ", "αντοσ", "αντι", "αντα"] },
  /** κτ-stem -αξ, -ακτος: Ἱππῶναξ. */
  ax3: { nom: "αξ", endings: ["αξ", "ακτοσ", "ακτι", "ακτα"] },
  /** δ-stem -ις, -ιδος: Χαλκίς, Ἀνάχαρσις. */
  i3: { nom: "ισ", endings: ["ισ", "ιδοσ", "ιδι", "ιδα", "ιν"] },
  /** ν-stem -ίς, -ῖνος: Σαλαμίς, Ἐλευσίς. */
  in3: { nom: "ισ", endings: ["ισ", "ινοσ", "ινι", "ινα"] },
  /** ι-stem -ις, -εως: Ἀμφίπολις. */
  is3: { nom: "ισ", endings: ["ισ", "εωσ", "ει", "ιν"] },
  /** ευ-stem -εύς, -έως: Πειραιεύς. */
  eus3: { nom: "ευσ", endings: ["ευσ", "εωσ", "ει", "εα"] },
  /** σ-stem neuter -ος, -ους: Ἄργος. */
  sn3: { nom: "οσ", endings: ["οσ", "ουσ", "ει"] },
} as const;

export type GreekDeclension = keyof typeof CLASSES;

export interface GreekNameSpec {
  /** Polytonic nominative, the literal of the Greek ProperName node. */
  grc: string;
  /** Declension class; its normalized nominative ending must terminate
   *  normalizeGreek(grc). Omitted when `forms` carries the paradigm. */
  cls?: GreekDeclension;
  /** Explicit normalized forms for irregular names (replaces cls). */
  forms?: string[];
  /** Extra normalized forms on top of the class paradigm
   *  (locatives Ἀθήνησι, directives Ἀθήναζε, variant accusatives). */
  alsoForms?: string[];
  /**
   * Curator-pinned section scope: the forms may only tag inside these
   * section ids. The escape hatch for HOMONYMOUS work titles, where the
   * same Greek phrase names two different works (Περὶ τῶν σοφῶν is both
   * Hermippus' On the Sages at 1.1.42 and Theophrastus' Of the Wise in
   * his 5.2.48 catalogue) - the gazetteer keeps scoped colliding titles
   * apart only when their scopes are pairwise disjoint, and annotate.ts
   * refuses the form outside its scope. Every scoped section id was
   * verified against the corpus at curation time and is pinned by
   * validate-annotations.
   */
  onlySections?: string[];
}

/* ================================================================== *
 *  Persons, philosophers, sources - keyed by canonical rdfs:label.
 *  Homonyms (Ζήνων, Διογένης, Ἀρίστων, Δημήτριος, Ἡρακλείδης,
 *  Θεόπομπος, Βρύσων, Κρατῖνος, Μενέδημος, Κράτης, Διονύσιος) are all
 *  curated on purpose: the gazetteer groups them by shared nominative
 *  and the section-owner heuristic resolves them inside the Lives.
 * ================================================================== */

/**
 * The sections where "Apollodorus" (bare, in either language) names the
 * chronographer of Athens (person/apollodorus, Q205704) - the
 * occurrence-level homonym split of July 2026. Every id was verified
 * against BOTH the Hicks and the Greek text; the section ids coincide
 * in the two languages. The OTHER bearers of the name (the Stoic of
 * Seleucia, the Epicurean Kepotyrannos, the Arithmetician, the
 * Democritean of Cyzicus) carry their own scoped entries - see
 * gazetteer.ts (Apollodorus split) and source-mentions.ts. 2.16 (the
 * patronymic "son of Apollodorus") and 2.35 (Socrates' companion) stay
 * untagged. 10.13 appears here because its FIRST occurrence is the
 * chronographer (Ἀπολλόδωρος ἐν Χρονικοῖς); the Epicurean's second
 * occurrence there is won by longer curated surfaces in both languages.
 * Shared by this spec's onlySections (Greek) and the English demotion
 * in gazetteer.ts.
 */
export const APOLLODORUS_CHRONOGRAPHER_SECTIONS: string[] = [
  "1.1.37",
  "1.2.58",
  "1.2.60",
  "1.4.74",
  "2.1.2",
  "2.2.3",
  "2.3.7",
  "2.5.44",
  "3.1.2",
  "4.4.23",
  "4.6.28",
  "4.6.45",
  "4.9.65",
  "5.1.9",
  "5.3.58",
  "6.8.101",
  "7.7.184",
  "8.2.52",
  "8.2.58",
  "8.8.90",
  "9.2.18",
  "9.4.24",
  "9.5.25",
  "9.7.41",
  "9.8.50",
  "9.8.56",
  "9.11.61",
  "10.1.13",
  "10.1.14",
];

/**
 * The sections where bare "Antigonus" / Ἀντίγονος names the biographer
 * of Carystus (source/antigonus-of-carystus) - the occurrence-level
 * homonym split of July 2026. Every id was verified against BOTH the
 * Hicks and the Greek text: these are the citation formulas ("mentioned
 * by Antigonus", "according to Antigonus", "so we learn from
 * Antigonus") and the full-name mentions. Everywhere ELSE bare
 * Antigonus is a Macedonian king - Gonatas in the royal narratives of
 * Zeno (7.6–7.15, 7.36), Menedemus (2.127–2.143), Arcesilaus
 * (4.39/4.41), Bion (4.46/4.54), Cleanthes (7.169), Lyco (5.65),
 * Euphantus (2.110) and Timon (9.110); Monophthalmus at 2.115 (father
 * of Demetrius) and 5.78 (Demetrius of Phalerum's fear) - and the
 * kings have no node by design, so those occurrences stay untagged.
 * Mixed sections handled specially: 2.143 (three king occurrences +
 * "Ἀντίγονος ὁ Καρύστιος") gets a curated multi-word form in
 * gazetteer.ts; 9.110 (king dative + bare biographer citation, bare
 * forms in both languages) is undiscriminable by section scoping and
 * stays untagged in BOTH languages, documented here.
 * Shared by this spec's onlySections (Greek); the English side keeps
 * bare "Antigonus" in SURFACE_BLOCKLIST and tags via curated scoped
 * entries in gazetteer.ts instead.
 */
export const ANTIGONUS_CARYSTUS_SECTIONS: string[] = [
  "2.3.15",
  "2.17.136",
  "3.1.66",
  "4.3.17",
  "4.4.22",
  "5.4.67",
  "7.1.12",
  "7.7.188",
  "9.7.49",
  "9.11.62",
  "9.12.111",
  "9.12.112",
];

export const GREEK_NAMES: Record<string, GreekNameSpec> = {
  // ------------------------------------------------- philosophers (82)
  Aeschines: { grc: "Αἰσχίνης", cls: "m1h" },
  Alcmaeon: { grc: "Ἀλκμαίων", cls: "n3o" },
  Anacharsis: { grc: "Ἀνάχαρσις", cls: "i3" },
  Anaxagoras: { grc: "Ἀναξαγόρας", cls: "m1a" },
  Anaxarchus: { grc: "Ἀνάξαρχος", cls: "m2" },
  Anaximander: { grc: "Ἀναξίμανδρος", cls: "m2" },
  Anaximenes: { grc: "Ἀναξιμένης", cls: "s3" },
  Antisthenes: { grc: "Ἀντισθένης", cls: "s3" },
  Arcesilaus: { grc: "Ἀρκεσίλαος", cls: "m2" },
  Archelaus: { grc: "Ἀρχέλαος", cls: "m2" },
  Archytas: { grc: "Ἀρχύτας", cls: "m1a", alsoForms: ["αρχυτα"] },
  Aristippus: { grc: "Ἀρίστιππος", cls: "m2" },
  "Ariston of Chios": { grc: "Ἀρίστων", cls: "n3o" },
  Aristotle: { grc: "Ἀριστοτέλης", cls: "s3" },
  Bias: { grc: "Βίας", cls: "ant3" },
  Bion: { grc: "Βίων", cls: "n3o" },
  Carneades: { grc: "Καρνεάδης", cls: "m1h" },
  Cebes: { grc: "Κέβης", cls: "et3" },
  Chilon: { grc: "Χίλων", cls: "n3o", alsoForms: ["χειλων", "χειλωνοσ"] },
  Chrysippus: { grc: "Χρύσιππος", cls: "m2" },
  Cleanthes: { grc: "Κλεάνθης", cls: "s3" },
  Cleobulus: { grc: "Κλεόβουλος", cls: "m2" },
  Clitomachus: { grc: "Κλειτόμαχος", cls: "m2" },
  Crantor: { grc: "Κράντωρ", cls: "or3" },
  "Crates of Athens": { grc: "Κράτης", cls: "et3" },
  "Crates of Thebes": { grc: "Κράτης", cls: "et3" },
  Crito: { grc: "Κρίτων", cls: "n3o" },
  "Demetrius of Phalerum": { grc: "Δημήτριος", cls: "m2" },
  Democritus: { grc: "Δημόκριτος", cls: "m2" },
  "Diogenes of Apollonia": { grc: "Διογένης", cls: "s3" },
  "Diogenes of Sinope": { grc: "Διογένης", cls: "s3" },
  "Dionysius the Renegade": { grc: "Διονύσιος", cls: "m2" },
  Empedocles: { grc: "Ἐμπεδοκλῆς", cls: "kl3" },
  Epicharmus: { grc: "Ἐπίχαρμος", cls: "m2" },
  Epicurus: { grc: "Ἐπίκουρος", cls: "m2" },
  Epimenides: { grc: "Ἐπιμενίδης", cls: "m1h" },
  Euclides: { grc: "Εὐκλείδης", cls: "m1h" },
  Eudoxus: { grc: "Εὔδοξος", cls: "m2" },
  Glaucon: { grc: "Γλαύκων", cls: "n3o" },
  "Heraclides Ponticus": { grc: "Ἡρακλείδης", cls: "m1h" },
  Heraclitus: { grc: "Ἡράκλειτος", cls: "m2" },
  Herillus: { grc: "Ἥριλλος", cls: "m2" },
  Hipparchia: { grc: "Ἱππαρχία", cls: "f1a" },
  Hippasus: { grc: "Ἵππασος", cls: "m2" },
  Lacydes: { grc: "Λακύδης", cls: "m1h" },
  Leucippus: { grc: "Λεύκιππος", cls: "m2" },
  Lyco: { grc: "Λύκων", cls: "n3o" },
  Melissus: { grc: "Μέλισσος", cls: "m2" },
  "Menedemus of Eretria": { grc: "Μενέδημος", cls: "m2" },
  "Menedemus the Cynic": { grc: "Μενέδημος", cls: "m2" },
  Menippus: { grc: "Μένιππος", cls: "m2" },
  Metrocles: { grc: "Μητροκλῆς", cls: "kl3" },
  Monimus: { grc: "Μόνιμος", cls: "m2" },
  Myson: { grc: "Μύσων", cls: "n3o" },
  Onesicritus: { grc: "Ὀνησίκριτος", cls: "m2" },
  Parmenides: { grc: "Παρμενίδης", cls: "m1h" },
  Periander: { grc: "Περίανδρος", cls: "m2" },
  Phaedo: { grc: "Φαίδων", cls: "n3o" },
  // Pherecydes fluctuates between the a-declension (Φερεκύδην, -ου)
  // and the σ-stem (dat Φερεκύδει 1.43, gen Φερεκύδους 1.prol.15) in
  // D.L.; the quoted letter at 1.122 has the Ionic gen Φερεκύδεω, and
  // Andron's two-Pherecydeses report at 1.119 the acc pl Φερεκύδας.
  Pherecydes: {
    grc: "Φερεκύδης",
    cls: "m1h",
    alsoForms: ["φερεκυδει", "φερεκυδουσ", "φερεκυδεω", "φερεκυδασ"],
  },
  Philolaus: { grc: "Φιλόλαος", cls: "m2" },
  Pittacus: { grc: "Πιττακός", cls: "m2" },
  Plato: { grc: "Πλάτων", cls: "n3o" },
  Polemo: { grc: "Πολέμων", cls: "n3o" },
  Protagoras: { grc: "Πρωταγόρας", cls: "m1a" },
  Pyrrho: { grc: "Πύρρων", cls: "n3o" },
  Pythagoras: {
    grc: "Πυθαγόρας",
    cls: "m1a",
    // Ionic forms quoted in D.L.'s verse citations and early-source
    // passages: nom Πυθαγόρης, acc Πυθαγόρην, gen Πυθαγόρεω (Ionic
    // gen.), dat Πυθαγόρῃ (subscript iota → η after normalization).
    alsoForms: ["πυθαγορησ", "πυθαγορην", "πυθαγορεω", "πυθαγορη"],
  },
  Simmias: { grc: "Σιμμίας", cls: "m1a" },
  Simon: { grc: "Σίμων", cls: "n3o" },
  Socrates: { grc: "Σωκράτης", cls: "s3" },
  Solon: { grc: "Σόλων", cls: "n3o" },
  Speusippus: { grc: "Σπεύσιππος", cls: "m2" },
  Sphaerus: { grc: "Σφαῖρος", cls: "m2" },
  Stilpo: { grc: "Στίλπων", cls: "n3o" },
  Strato: { grc: "Στράτων", cls: "n3o" },
  Thales: {
    grc: "Θαλῆς",
    forms: [
      "θαλησ",
      "θαλου",
      "θαλη",
      "θαλην",
      "θαλητοσ",
      "θαλητι",
      "θαλητα",
    ],
  },
  Theophrastus: { grc: "Θεόφραστος", cls: "m2" },
  Timon: { grc: "Τίμων", cls: "n3o" },
  Xenocrates: { grc: "Ξενοκράτης", cls: "s3" },
  Xenophanes: { grc: "Ξενοφάνης", cls: "s3" },
  Xenophon: { grc: "Ξενοφῶν", cls: "nt3" },
  "Zeno of Citium": { grc: "Ζήνων", cls: "n3o" },
  "Zeno of Elea": { grc: "Ζήνων", cls: "n3o" },
  // Zeno of Sidon (the Stoic), one of Hippobotus' five pupils of Zeno
  // of Citium (7.38). Bare Ζήνων is shared by the two philosopher KG
  // nodes above and resolved by the section-owner heuristic; the
  // pupil's nominative is scoped to the roster section (the only
  // nominative Ζήνων there names him: "Ζήνων Σιδώνιος"), where the
  // scoped bearer outranks the heuristic. The genitives Ζήνωνος in the
  // same section keep tagging Zeno of Citium via the owner heuristic.
  "Zeno of Sidon": {
    grc: "Ζήνων",
    forms: ["ζηνων"],
    onlySections: ["7.1.38"],
  },

  // ------------------------------------------------------ persons (71)
  // Achaeus: the tragedian of Eretria (Menedemus ranked him second
  // after Aeschylus, 2.133; his satyric Omphale is quoted, 2.134)  - 
  // identified with the tragedian of TrGF vol. I; the play itself is
  // curated as a work node (person-works.ts + Omphale in
  // GREEK_WORK_TITLES below). ἐν τοῖς Σατύροις at 2.133 is Hicks'
  // genre reference ("second place as a writer of satiric dramas"),
  // not a title - deliberately untagged. Scoped to those sections
  // because the 6.85 genitive Ἀχαιοῦ is Bryson's ethnic epithet
  // ("Bryson the Achaean"), an exact homograph.
  Achaeus: {
    grc: "Ἀχαιός",
    cls: "m2",
    onlySections: ["2.17.133", "2.17.134"],
  },
  Acusilaus: { grc: "Ἀκουσίλαος", cls: "m2" },
  // Aeschylus: three bearers in the corpus (the tragedian 2.43/2.133/
  // 3.56, Menedemus' Eretrian opponent 2.141, the addressee of
  // Theophrastus' "In reply to Aeschylus" 5.50) - the node names the
  // tragedian, so the forms are scoped to his sections; the other two
  // occurrences stay untagged.
  Aeschylus: {
    grc: "Αἰσχύλος",
    cls: "m2",
    onlySections: ["2.5.43", "2.17.133", "3.1.56"],
  },
  // Agrippa: the Sceptic of the Five Modes (Οἱ δὲ περὶ Ἀγρίππαν,
  // 9.88) - scoped to that section because the 9.106 dative Ἀγρίππᾳ
  // ("Ἀπελλᾶς ἐν τῷ Ἀγρίππᾳ") is Apellas' homonymous BOOK title,
  // which normalizes to the same form; 9.11.106 stays untagged.
  Agrippa: {
    grc: "Ἀγρίππας",
    cls: "m1a",
    onlySections: ["9.11.88"],
  },
  Alcaeus: { grc: "Ἀλκαῖος", cls: "m2" },
  // Alcibiades: scoped to the statesman's sections, mirroring the
  // MentionPerson scope - elsewhere the name is dialogue titles
  // (Antisthenes 6.18, Euclides 2.108, Plato's two Alcibiades in the
  // book 3 catalogue) and the 3.51 plural Ἀλκιβιάδαι falls outside the
  // paradigm anyway.
  Alcibiades: {
    grc: "Ἀλκιβιάδης",
    cls: "m1h",
    onlySections: [
      "2.5.23",
      "2.5.24",
      "2.5.31",
      "2.5.36",
      "2.5.37",
      "2.9.105",
      "4.7.49",
    ],
  },
  // Alexander the Great: scoped to the verified king sections of the
  // kings-and-tyrants batch (person-mentions.ts holds the full
  // classification). Bare Ἀλέξανδρος elsewhere is the source
  // Polyhistor's citations (its own scoped spec below), Chrysippus'
  // addressee, the dramatist Alexander Aetolus, or Paris of Troy
  // (1.32); the ethnic Ἀλεξανδρεύς and the adjective Ἀλεξανδρίνῳ fall
  // outside the closed m2 paradigm.
  "Alexander the Great": {
    grc: "Ἀλέξανδρος",
    cls: "m2",
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
  Alexis: { grc: "Ἄλεξις", cls: "i3" },
  Ameinias: { grc: "Ἀμεινίας", cls: "m1a" },
  Ameipsias: { grc: "Ἀμειψίας", cls: "m1a" },
  Amphis: { grc: "Ἄμφις", cls: "i3" },
  Anaxandrides: { grc: "Ἀναξανδρίδης", cls: "m1h" },
  Antagoras: { grc: "Ἀνταγόρας", cls: "m1a" },
  // Apellas the Sceptic author (2026-07 Sceptic Greek pass): the one
  // corpus occurrence is the nominative at 9.106 (Ἀπελλᾶς ἐν τῷ
  // Ἀγρίππᾳ); the Doric -ᾶς paradigm fits no class, so only the
  // attested form is curated (same policy as Manetho). Distinct from
  // the source Apelles (Ἀπελλῆς), whose normalized forms never
  // collide.
  Apellas: { grc: "Ἀπελλᾶς", forms: ["απελλασ"] },
  // Apollodorus: six bearers in the text - see the section-list header
  // above. The spec's scope pins the shared declensions to the
  // chronographer's verified sections; the other bearers' Greek forms
  // are curated as scoped entries in gazetteer.ts (Apollodorus split).
  Apollodorus: {
    grc: "Ἀπολλόδωρος",
    cls: "m2",
    onlySections: APOLLODORUS_CHRONOGRAPHER_SECTIONS,
  },
  Aratus: { grc: "Ἄρατος", cls: "m2" },
  Archilochus: { grc: "Ἀρχίλοχος", cls: "m2" },
  // Aristodemus: four bearers in the corpus (the Spartan sage
  // candidate 1.30-31/1.41-42, the Arcadian co-regent 1.94, the
  // Eretrian informer 2.142, the Platonic letter addressee 3.61)  - 
  // the node names the Spartan, so the forms are scoped to his
  // sections; the other three occurrences stay untagged.
  Aristodemus: {
    grc: "Ἀριστόδημος",
    cls: "m2",
    onlySections: ["1.1.30", "1.1.31", "1.1.41", "1.1.42"],
  },
  // Aristocreon, Chrysippus' nephew (7.185) and catalogue addressee
  // (7.196-202): all ten Greek occurrences are the accusative
  // Ἀριστοκρέοντα; unambiguous, so unscoped.
  Aristocreon: { grc: "Ἀριστοκρέων", cls: "ont3" },
  Aristophanes: { grc: "Ἀριστοφάνης", cls: "s3" },
  Aristophon: { grc: "Ἀριστοφῶν", cls: "nt3" },
  // Athenodorus of Soli, one of Hippobotus' five Stoic pupils of Zeno
  // (7.38). Bare Ἀθηνόδωρος belongs to the existing Athenodorus source
  // node (of the Walks); the pupil's nominative is scoped to the roster
  // section, where the scoped bearer outranks the unscoped source
  // (gazetteer disjoint-scope split + annotate scoped-first lookup).
  // Asclepiades of Phlius, Menedemus' inseparable friend: scoped to
  // his sections because Ἀσκληπιάδην at 8.61 is the patronymic
  // "descendant of Asclepius" in Empedocles' epigram for the physician
  // Pausanias, not the Phliasian. Scope mirrors the MentionPerson entry.
  "Asclepiades of Phlius": {
    grc: "Ἀσκληπιάδης",
    cls: "m1h",
    onlySections: [
      "2.9.105",
      "2.17.126",
      "2.17.129",
      "2.17.130",
      "2.17.131",
      "2.17.132",
      "2.17.137",
      "2.17.138",
      "6.5.91",
    ],
  },
  "Athenodorus of Soli": {
    grc: "Ἀθηνόδωρος",
    forms: ["αθηνοδωροσ"],
    onlySections: ["7.1.38"],
  },
  Bryson: { grc: "Βρύσων", cls: "n3o" },
  "Bryson the Achaean": { grc: "Βρύσων", cls: "n3o" },
  Callias: { grc: "Καλλίας", cls: "m1a" },
  Callimachus: { grc: "Καλλίμαχος", cls: "m2" },
  // Callippus of Corinth, one of Hippobotus' five Stoic pupils of Zeno
  // (7.38). Bare Κάλλιππος also names Plato's pupil of Athens (3.46)
  // and the witness of Pallene in Theophrastus' will (5.57), neither of
  // whom has a node, so the pupil's nominative is scoped to the roster
  // section and the other two occurrences stay untagged.
  "Callippus of Corinth": {
    grc: "Κάλλιππος",
    forms: ["καλλιπποσ"],
    onlySections: ["7.1.38"],
  },
  Cercidas: { grc: "Κερκιδᾶς", forms: ["κερκιδασ", "κερκιδα"] },
  Chabrinus: { grc: "Χαβρῖνος", cls: "m2" },
  Charmantides: { grc: "Χαρμαντίδης", cls: "m1h" },
  "Colotes of Lampsacus": { grc: "Κωλώτης", cls: "m1h" },
  Cratinus: { grc: "Κρατῖνος", cls: "m2" },
  "Cratinus the Younger": { grc: "Κρατῖνος", cls: "m2" },
  "Cratylus the Heraclitean": { grc: "Κρατύλος", cls: "m2" },
  // Croesus: every corpus occurrence is the Lydian king, unscoped.
  Croesus: { grc: "Κροῖσος", cls: "m2" },
  // Cyrus the Younger: scoped to the Xenophon sections, mirroring the
  // MentionPerson scope - bare Κῦρος elsewhere is Cyrus the Great, an
  // Antisthenes title, or the Cyropaedia (Κύρου Παιδείαν, 2.57/3.34);
  // Κύριαι (the Sovran Maxims, 10.27) falls outside the closed
  // paradigm.
  "Cyrus the Younger": {
    grc: "Κῦρος",
    cls: "m2",
    onlySections: ["2.6.49", "2.6.50", "2.6.51", "2.6.55", "2.6.58"],
  },
  Damon: { grc: "Δάμων", cls: "n3o" },
  "Demetrius of Troezen": { grc: "Δημήτριος", cls: "m2" },
  "Demetrius the epic poet": { grc: "Δημήτριος", cls: "m2" },
  "Demodicus of Leros": { grc: "Δημόδικος", cls: "m2" },
  Diodotus: { grc: "Διόδοτος", cls: "m2" },
  // Dion of Syracuse: bare Δίων has many other bearers (the verse
  // addressee 1.80, Theophrastus' freed slave 5.73, the book title
  // 7.2, Dion of Paeania 7.12, the Stoic logic stock example 7.65-79,
  // Chrysippus' addressee 7.190/7.192), so the forms are scoped to the
  // Syracusan's unambiguous sections. Scope mirrors the MentionPerson
  // entry in person-mentions.ts.
  "Dion of Syracuse": {
    grc: "Δίων",
    cls: "n3o",
    onlySections: [
      "2.7.63",
      "3.1.3",
      "3.1.9",
      "3.1.19",
      "3.1.20",
      "3.1.21",
      "3.1.23",
      "3.1.25",
      "3.1.29",
      "3.1.30",
      "3.1.46",
      "3.1.61",
      "4.1.5",
      "8.7.84",
    ],
  },
  Diogenes: { grc: "Διογένης", cls: "s3" },
  "Diogenes Laertius": { grc: "Διογένης", cls: "s3" },
  "Diogenes of Smyrna": { grc: "Διογένης", cls: "s3" },
  // The two tyrants of Syracuse: scoped to the verified sections of
  // the kings-and-tyrants batch (person-mentions.ts holds the full
  // classification). Bare Διονύσιος elsewhere stays with the existing
  // unscoped bearers (the Renegade and the Stoic), whose collision
  // resolves exactly as before this batch; the mixed 3.21 and the
  // undecidable Aristippus block stay untagged. Διονυσοκόλακας (10.8)
  // and Διονυσόδωρος fall outside the closed m2 paradigm.
  "Dionysius the Elder": {
    grc: "Διονύσιος",
    cls: "m2",
    onlySections: ["3.1.18"],
  },
  // Dioscurides of Cyprus (2026-07 Sceptic Greek pass): scoped to the
  // two succession sections where the bare name is Timon's one-eyed
  // pupil (ὁ Διοσκουρίδης μαθητὴς αὐτοῦ 9.114, Διοσκουρίδης Κύπριος
  // 9.115); everywhere else (1.63, 5.57, the book 7 catalogue
  // addressee) bare Διοσκουρίδης stays with the unscoped Dioscurides
  // source spec below.
  "Dioscurides of Cyprus": {
    grc: "Διοσκουρίδης",
    cls: "m1h",
    onlySections: ["9.12.114", "9.12.115"],
  },
  "Dionysius the Younger": {
    grc: "Διονύσιος",
    cls: "m2",
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
  // Eubulus of Alexandria (2026-07 Sceptic Greek pass): scoped to the
  // succession section (Εὔβουλος Ἀλεξανδρεύς 9.116); bare Εὔβουλος at
  // 6.30 is the source Eubulus (no Greek spec), the 2.6/2.59/5.3/5.9/
  // 5.11 genitives are patronymics of other Eubuluses, and Εὐβουλίδης/
  // εὐβουλία fall outside the closed m2 paradigm.
  "Eubulus of Alexandria": {
    grc: "Εὔβουλος",
    cls: "m2",
    onlySections: ["9.12.116"],
  },
  // Euphranor of Seleucia (2026-07 Sceptic Greek pass): scoped to the
  // succession sections (Εὐφράνωρ Σελευκεύς 9.115, Εὐφράνορος 9.116);
  // the 5.73 accusative Εὐφράνορα is the freedman of Theophrastus'
  // will and stays untagged (mirrors the English mention scope).
  "Euphranor of Seleucia": {
    grc: "Εὐφράνωρ",
    cls: "or3",
    onlySections: ["9.12.115", "9.12.116"],
  },
  Eupolis: { grc: "Εὔπολις", cls: "i3" },
  Euripides: { grc: "Εὐριπίδης", cls: "m1h" },
  // Eurylochus, Pyrrho's pupil (2026-07 Sceptic Greek pass): scoped to
  // 9.68 (the spit-and-cook story, nominative); the other bearers -
  // the Larissaean youth (2.25), Menedemus' dining companion (2.127)
  // and the addressee of Epicurus' letter (10.13, 10.28) - stay
  // untagged (mirrors the English mention scope).
  Eurylochus: {
    grc: "Εὐρύλοχος",
    cls: "m2",
    onlySections: ["9.11.68"],
  },
  Eurytus: { grc: "Εὔρυτος", cls: "m2" },
  // Evander of Phocaea (2026-07 Sceptic Greek pass): both corpus
  // occurrences are the Academic in the 4.60 handover (Εὐάνδρῳ,
  // Εὐάνδρου); the lowercase common noun εὐανδρία (7.7) is excluded
  // by the capitalization rule. Unscoped.
  Evander: { grc: "Εὔανδρος", cls: "m2" },
  Gorgias: { grc: "Γοργίας", cls: "m1a" },
  "Hegesinus of Pergamum": {
    grc: "Ἡγησίνους",
    forms: ["ηγησινουσ", "ηγησινου"],
  },
  "Heraclides of Heraclea": { grc: "Ἡρακλείδης", cls: "m1h" },
  // Heraclides the Sceptic (2026-07 Sceptic Greek pass): scoped to the
  // succession section, where both the nominative (οὗ Σαρπηδὼν καὶ
  // Ἡρακλείδης) and the genitive (Ἡρακλείδου δʼ Αἰνεσίδημος) are this
  // man (9.116); everywhere else the shared Ἡρακλείδης forms keep
  // their existing bearers (Ponticus, of Heraclea, the Lembus source).
  "Heraclides the Sceptic": {
    grc: "Ἡρακλείδης",
    cls: "m1h",
    onlySections: ["9.12.116"],
  },
  Hermarchus: { grc: "Ἕρμαρχος", cls: "m2" },
  // Hermias of Atarneus: scoped mirroring the MentionPerson scope
  // (5.1.6 included for the Greek accusative of the 5.5 sentence,
  // Hicks/Perseus section drift); the 2.84 Aristippus catalogue title
  // and the 5.73 freedman of Theophrastus' will stay untagged.
  Hermias: {
    grc: "Ἑρμίας",
    cls: "m1a",
    onlySections: [
      "3.1.61",
      "5.1.3",
      "5.1.4",
      "5.1.5",
      "5.1.6",
      "5.1.9",
      "5.1.11",
    ],
  },
  Hermodamas: { grc: "Ἑρμοδάμας", cls: "ant3" },
  // Herodotus of Tarsus (2026-07 Sceptic Greek pass): scoped to the
  // succession section, where both the nominative (Ἡρόδοτος Ἀριέως
  // Ταρσεύς) and the genitive (Ἡροδότου δὲ διήκουσε Σέξτος) are this
  // man (9.116); bare Ἡρόδοτος everywhere else is the historian or
  // the Epicurean addressee and stays skipped (GREEK_NAME_SKIPS).
  "Herodotus of Tarsus": {
    grc: "Ἡρόδοτος",
    cls: "m2",
    onlySections: ["9.12.116"],
  },
  Hipponax: { grc: "Ἱππῶναξ", cls: "ax3" },
  Homer: { grc: "Ὅμηρος", cls: "m2" },
  "Ion of Chios": { grc: "Ἴων", forms: ["ιων", "ιωνοσ", "ιωνι", "ιωνα"] },
  // Isocrates the orator: every Greek noun occurrence names him. The
  // adjective Ἰσοκράτειος "Isocratean" (2.15, 4.23) is adjective
  // morphology, deferred like the ethnics.
  Isocrates: { grc: "Ἰσοκράτης", cls: "s3" },
  Lamiscus: { grc: "Λαμίσκος", cls: "m2" },
  Lasos: { grc: "Λᾶσος", cls: "m2" },
  Leonteus: { grc: "Λεοντεύς", cls: "eus3" },
  Leophantus: { grc: "Λεώφαντος", cls: "m2" },
  Linus: { grc: "Λίνος", cls: "m2" },
  Lycophron: { grc: "Λυκόφρων", cls: "n3on" },
  Menander: { grc: "Μένανδρος", cls: "m2" },
  Mimnermus: { grc: "Μίμνερμος", cls: "m2" },
  Mnesimachus: { grc: "Μνησίμαχος", cls: "m2" },
  Nausiphanes: { grc: "Ναυσιφάνης", cls: "s3" },
  // Nicanor, Aristotle's ward: scoped to the will sections mirroring
  // the MentionPerson scope; Seleucus' epithet (2.124), Theophrastus'
  // correspondent (5.50) and the Nicanor of Epicurus' will (10.20)
  // are different bearers and stay untagged.
  Nicanor: {
    grc: "Νικάνωρ",
    cls: "or3",
    onlySections: ["5.1.12", "5.1.13", "5.1.14", "5.1.15", "5.1.16"],
  },
  // Nicolochus of Rhodes (2026-07 Sceptic Greek pass): the one corpus
  // occurrence is the nominative in Timon's pupil list (Νικόλοχος
  // Ῥόδιος 9.115); unique corpus-wide, so unscoped.
  "Nicolochus of Rhodes": { grc: "Νικόλοχος", cls: "m2" },
  Panthoides: { grc: "Πανθοίδης", cls: "m1h" },
  // Philip II of Macedon: scoped mirroring the MentionPerson scope -
  // Φίλιππος elsewhere names Philip the Megarian (1.16, 2.113), Philip
  // of Opus (3.37, 3.46), a witness of Plato's will (3.41), Philip V
  // (5.61) and Chrysippus' addressee (7.193), all deliberately
  // untagged.
  "Philip II of Macedon": {
    grc: "Φίλιππος",
    cls: "m2",
    onlySections: [
      "2.6.56",
      "3.1.40",
      "4.1.5",
      "4.2.8",
      "4.2.9",
      "5.1.2",
      "5.1.4",
      "5.1.10",
      "5.1.27",
      "6.2.43",
      "6.5.88",
    ],
  },
  "Philistion the Sicilian": { grc: "Φιλιστίων", cls: "n3o" },
  Photidas: { grc: "Φωτίδας", cls: "m1a" },
  Phrynichus: { grc: "Φρύνιχος", cls: "m2" },
  Polyaenus: { grc: "Πολύαινος", cls: "m2" },
  // Praylus of the Troad (2026-07 Sceptic Greek pass): the one corpus
  // occurrence is Πραΰλους in Timon's pupil list (9.115, the form the
  // Perseus text prints for the nominative); no closed class fits, so
  // only the attested form is curated (same policy as Manetho).
  // Unique corpus-wide, so unscoped.
  "Praÿlus of the Troad": { grc: "Πραΰλους", forms: ["πραυλουσ"] },
  // Ptolemy of Cyrene (2026-07 Sceptic Greek pass): scoped to the two
  // succession sections (Πτολεμαῖος ὁ Κυρηναῖος 9.115, οὗ Πτολεμαῖος
  // 9.116); disjoint from Ptolemy Soter's scope below, so both scoped
  // bearers coexist and every other Πτολεμαῖος (the undecidable kings,
  // Philadelphus, Philopator) stays untagged.
  "Ptolemy of Cyrene": {
    grc: "Πτολεμαῖος",
    cls: "m2",
    onlySections: ["9.12.115", "9.12.116"],
  },
  // Ptolemy Soter: scoped to the verified king sections of the
  // kings-and-tyrants batch (person-mentions.ts holds the full
  // classification). Bare Πτολεμαῖος elsewhere is an undecidable
  // Ptolemaic king, Philadelphus, Philopator, or the Sceptic of
  // Cyrene; the ethnic Πτολεμαεύς (2.86, 7.41) falls outside the
  // closed m2 paradigm. 2.115 renders the epithet Ζωτήρ.
  "Ptolemy Soter": {
    grc: "Πτολεμαῖος",
    cls: "m2",
    onlySections: [
      "2.8.102",
      "2.10.111",
      "2.11.115",
      "5.2.37",
      "5.5.78",
      "5.5.79",
    ],
  },
  Pythodotus: { grc: "Πυθόδοτος", cls: "m2" },
  // Sarpedon the Sceptic (2026-07 Sceptic Greek pass): the one corpus
  // occurrence is the nominative at 9.116 (οὗ Σαρπηδὼν καὶ
  // Ἡρακλείδης); unique corpus-wide, so unscoped.
  Sarpedon: { grc: "Σαρπηδών", cls: "n3on" },
  // Saturninus called Cythenas (2026-07 Sceptic Greek pass): the one
  // corpus occurrence is the nominative at 9.116 (Σατορνῖνος ὁ
  // Κυθηνᾶς); unique corpus-wide, so unscoped.
  Saturninus: { grc: "Σατορνῖνος", cls: "m2" },
  Simonides: { grc: "Σιμωνίδης", cls: "m1h" },
  Sisymbrinus: { grc: "Σισύμβρινος", cls: "m2" },
  Sophocles: { grc: "Σοφοκλῆς", cls: "kl3" },
  Sositheus: { grc: "Σωσίθεος", cls: "m2" },
  // Telecles of Phocaea (2026-07 Sceptic Greek pass): the one corpus
  // occurrence is the dative in the 4.60 handover (Τηλεκλεῖ καὶ
  // Εὐάνδρῳ); the source Telecleides (Τηλεκλείδης) falls outside the
  // closed -κλῆς paradigm. Unscoped.
  Telecles: { grc: "Τηλεκλῆς", cls: "kl3" },
  Theaetetus: { grc: "Θεαίτητος", cls: "m2" },
  // Theiodas of Laodicea (2026-07 Sceptic Greek pass): the one corpus
  // occurrence is the nominative at 9.116 (Θειωδᾶς Λαοδικεύς); the
  // Doric -ᾶς paradigm fits no class, so only the attested form is
  // curated (same policy as Apellas). Unique corpus-wide, so unscoped.
  "Theiodas of Laodicea": { grc: "Θειωδᾶς", forms: ["θειωδασ"] },
  Themista: { grc: "Θεμίστα", cls: "f1a" },
  Themistoclea: { grc: "Θεμιστόκλεια", cls: "f1a" },
  "Theocritus of Chios": { grc: "Θεόκριτος", cls: "m2" },
  "Theopompus the comic poet": { grc: "Θεόπομπος", cls: "m2" },
  "Zenodotus the Stoic": { grc: "Ζηνόδοτος", cls: "m2" },
  // Zeuxippus of Cnossus (2026-07 Sceptic Greek pass): the one corpus
  // occurrence is the nominative at 9.116 (οὗ Ζεύξιππος ὁ πολίτης);
  // unique corpus-wide, so unscoped.
  Zeuxippus: { grc: "Ζεύξιππος", cls: "m2" },
  // Zeuxis Goniopus (2026-07 Sceptic Greek pass): scoped to the
  // succession section (οὗ Ζεῦξις ὁ Γωνιόπους 9.116), mirroring the
  // English scoped entry in gazetteer.ts - the 9.106 Ζεῦξις stays
  // with the unscoped Zeuxis source spec below (possibly the same
  // man, never conflated).
  "Zeuxis Goniopus": {
    grc: "Ζεῦξις",
    cls: "i3",
    onlySections: ["9.12.116"],
  },

  // ------------------------------------------------------ sources (73)
  // (Homonyms with philosophers/persons above share their nominative;
  //  blocklisted text-ambiguous names are in GREEK_NAME_SKIPS instead.)
  // Specs whose label is a SOURCE_MENTION_LABELS opt-in (Aenesidemus,
  // Archedemus, Boethus, Clearchus, Dicaearchus, Ephorus, Eubulides,
  // Euthyphron, Hecataeus, Hieronymus, Idomeneus, Lysias, Panaetius,
  // Pisistratus, Sosibius, Xanthus) never tag through the main Greek
  // loop (auto surfaces for those labels are suppressed in BOTH
  // languages); they feed the LOD Greek name nodes and the scoped
  // source-mentions Greek block in gazetteer.ts, whose sections come
  // from the mentions' grcRefs (each verified against the Greek text).
  "Achaïcus": { grc: "Ἀχαϊκός", cls: "m2" },
  Aenesidemus: { grc: "Αἰνεσίδημος", cls: "m2" },
  Alcidamas: { grc: "Ἀλκιδάμας", cls: "ant3" },
  // Alexander: the source Polyhistor, scoped to his verified bare
  // citation formulas ('in his Successions' and kin) - bare
  // Ἀλέξανδρος everywhere else is the king (scoped spec above) or an
  // undecidable bearer; see GREEK_NAME_SKIPS below for the history.
  Alexander: {
    grc: "Ἀλέξανδρος",
    cls: "m2",
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
  // Antigonus: scoped to the biographer's citation sections - bare
  // Ἀντίγονος everywhere else is a Macedonian king (no node); see
  // ANTIGONUS_CARYSTUS_SECTIONS above and GREEK_NAME_SKIPS below.
  "Antigonus of Carystus": {
    grc: "Ἀντίγονος",
    cls: "m2",
    onlySections: ANTIGONUS_CARYSTUS_SECTIONS,
  },
  Apollonides: { grc: "Ἀπολλωνίδης", cls: "m1h" },
  "Apollonius of Tyre": { grc: "Ἀπολλώνιος", cls: "m2" },
  Archedemus: { grc: "Ἀρχέδημος", cls: "m2" },
  Ariston: { grc: "Ἀρίστων", cls: "n3o" },
  Aristoxenus: { grc: "Ἀριστόξενος", cls: "m2" },
  Athenodorus: { grc: "Ἀθηνόδωρος", cls: "m2" },
  "Boethus of Sidon": { grc: "Βόηθος", cls: "m2" },
  "Clearchus of Soli": { grc: "Κλέαρχος", cls: "m2" },
  Ctesiclides: { grc: "Κτησικλείδης", cls: "m1h" },
  Demetrius: { grc: "Δημήτριος", cls: "m2" },
  "Demetrius of Magnesia": { grc: "Δημήτριος", cls: "m2" },
  "Demetrius the Magnesian": { grc: "Δημήτριος", cls: "m2" },
  "Dicaearchus of Messene": { grc: "Δικαίαρχος", cls: "m2" },
  Diocles: { grc: "Διοκλῆς", cls: "kl3" },
  "Dionysius the Stoic": { grc: "Διονύσιος", cls: "m2" },
  Dioscurides: { grc: "Διοσκουρίδης", cls: "m1h" },
  Duris: { grc: "Δοῦρις", cls: "i3" },
  Ephorus: { grc: "Ἔφορος", cls: "m2" },
  Eratosthenes: { grc: "Ἐρατοσθένης", cls: "s3" },
  Eubulides: { grc: "Εὐβουλίδης", cls: "m1h" },
  Eumelus: { grc: "Εὔμηλος", cls: "m2" },
  // Genitive Εὐθύφρονος (1.107 has the nominative only, and the scoped
  // section is the sole tagging site; books 3, 5, 8 have Plato's
  // dialogue character and stay untagged).
  "Euthyphron (son of Heraclides Ponticus)": { grc: "Εὐθύφρων", cls: "n3on" },
  Favorinus: { grc: "Φαβωρῖνος", cls: "m2" },
  "Hecataeus of Abdera": { grc: "Ἑκαταῖος", cls: "m2" },
  Hecato: { grc: "Ἑκάτων", cls: "n3o" },
  Heraclides: { grc: "Ἡρακλείδης", cls: "m1h" },
  Hermippus: { grc: "Ἕρμιππος", cls: "m2" },
  Hermodorus: { grc: "Ἑρμόδωρος", cls: "m2" },
  "Hieronymus of Rhodes": { grc: "Ἱερώνυμος", cls: "m2" },
  Hipparchus: { grc: "Ἵππαρχος", cls: "m2" },
  Hippobotus: { grc: "Ἱππόβοτος", cls: "m2" },
  "Idomeneus of Lampsacus": { grc: "Ἰδομενεύς", cls: "eus3" },
  Lysias: { grc: "Λυσίας", cls: "m1a" },
  Myronianus: { grc: "Μυρωνιανός", cls: "m2" },
  Neanthes: { grc: "Νεάνθης", cls: "s3" },
  Nicomachus: { grc: "Νικόμαχος", cls: "m2" },
  // Pamphila the historian (of Epidaurus) is a claims/sayings/anecdotes
  // authority, NOT a source-mentions opt-in: her surfaces auto-generate,
  // so the full paradigm tags unscoped. All 8 Greek occurrences (books
  // 1, 2, 3, 5) are her citation formulas, verified July 2026.
  Pamphila: { grc: "Παμφίλη", cls: "f1h" },
  "Panaetius of Rhodes": { grc: "Παναίτιος", cls: "m2" },
  Persaeus: { grc: "Περσαῖος", cls: "m2" },
  "Philo of Athens": { grc: "Φίλων", cls: "n3o" },
  Philochorus: { grc: "Φιλόχορος", cls: "m2" },
  // Philonides of Thebes, one of Hippobotus' five Stoic pupils of Zeno
  // (7.38); very likely the Philonides Zeno sent to Antigonus alongside
  // Persaeus (7.9, accusative), the same pair Bion mocks at 4.47. The
  // only bearer with a node, so the full paradigm tags unscoped.
  "Philonides of Thebes": { grc: "Φιλωνίδης", cls: "m1h" },
  Phlegon: { grc: "Φλέγων", cls: "ont3" },
  // The tyrant of Athens; extended July 2026 from the 1.53 letter to
  // all seventeen verified Book 1 sections (grcRefs in
  // source-mentions.ts). 1.93 has the dative without iota subscript
  // (Πεισιστράτω) - normalization folds it into the m2 paradigm; the
  // patronymic plural Πεισιστρατίδαι (1.49) falls outside it.
  Pisistratus: { grc: "Πεισίστρατος", cls: "m2" },
  Plutarch: { grc: "Πλούταρχος", cls: "m2" },
  Posidonius: { grc: "Ποσειδώνιος", cls: "m2" },
  // Posidonius of Alexandria, one of Hippobotus' five Stoic pupils of
  // Zeno (7.38). Bare Ποσειδώνιος belongs to the Posidonius source node
  // (of Apamea) everywhere else; the pupil's nominative is scoped to
  // the roster section, where the scoped bearer outranks the unscoped
  // source (gazetteer disjoint-scope split + annotate scoped-first).
  "Posidonius of Alexandria": {
    grc: "Ποσειδώνιος",
    forms: ["ποσειδωνιοσ"],
    onlySections: ["7.1.38"],
  },
  Satyrus: { grc: "Σάτυρος", cls: "m2" },
  "Sosibius of Laconia": { grc: "Σωσίβιος", cls: "m2" },
  Sosicrates: { grc: "Σωσικράτης", cls: "s3" },
  Sotion: { grc: "Σωτίων", cls: "n3o" },
  Telauges: { grc: "Τηλαύγης", cls: "s3" },
  Thrasylus: { grc: "Θράσυλος", cls: "m2" },
  Timocrates: { grc: "Τιμοκράτης", cls: "s3" },
  "Xanthus of Lydia": { grc: "Ξάνθος", cls: "m2" },

  // 2026-07 second grcRefs pass: the remaining English-only
  // source-mention labels, each nominative and declension verified in
  // the mention's cited Greek sections (grcRefs in source-mentions.ts
  // carry the verified section list; refs whose Greek text has no form
  // of the name are absent there). All tag ONLY through the scoped
  // source-mentions Greek block in gazetteer.ts. "Croton" adds no spec
  // here: the man at 9.12 (Κρότωνά, accusative) shares the place spec's
  // Κρότων n3o paradigm above, and the grcRefs scope keys the minted
  // source node to it. "Olympiodorus" stays formless (GREEK_NAME_SKIPS).
  Alcimus: { grc: "Ἄλκιμος", cls: "m2" },
  Ambryon: { grc: "Ἀμβρύων", cls: "n3o" },
  "Anaxilas (comic poet)": { grc: "Ἀναξίλας", cls: "m1a" },
  Anaxilaus: { grc: "Ἀναξίλαος", cls: "m2" },
  "Andron of Ephesus": { grc: "Ἄνδρων", cls: "n3o" },
  "Antiochus of Laodicea": { grc: "Ἀντίοχος", cls: "m2" },
  Antiphon: { grc: "Ἀντιφῶν", cls: "nt3" },
  "Aristagoras of Miletus": { grc: "Ἀρισταγόρας", cls: "m1a" },
  // The grammarian; bare Ἀριστοφάνης elsewhere (3.28-context 4.18,
  // 8.34) is the comic poet, whose spec above stays unscoped.
  "Aristophanes the Grammarian": { grc: "Ἀριστοφάνης", cls: "s3" },
  "Artemidorus the Dialectician": { grc: "Ἀρτεμίδωρος", cls: "m2" },
  "Ascanius of Abdera": { grc: "Ἀσκάνιος", cls: "m2" },
  "Cassius the Skeptic": { grc: "Κάσσιος", cls: "m2" },
  Crinis: { grc: "Κρῖνις", cls: "i3" },
  "Daimachus of Plataea": { grc: "Δαΐμαχος", cls: "m2" },
  // Scoped to 1.40; bare Δάμων elsewhere is the Athenian (Damon spec
  // above), kept apart by the disjoint-scope split.
  "Damon of Cyrene": { grc: "Δάμων", cls: "n3o" },
  Didymus: { grc: "Δίδυμος", cls: "m2" },
  Dieuchidas: { grc: "Διευχίδας", cls: "m1a" },
  Dinarchus: { grc: "Δείναρχος", cls: "m2" },
  Dinon: { grc: "Δείνων", cls: "n3o" },
  Diodorus: { grc: "Διόδωρος", cls: "m2" },
  "Diodorus of Ephesus": { grc: "Διόδωρος", cls: "m2" },
  Dionysodorus: { grc: "Διονυσόδωρος", cls: "m2" },
  "Diotimus the Stoic": { grc: "Διότιμος", cls: "m2" },
  // The author of On Achilles, cited once at 1.29 (nominative only;
  // spelled Ἔλευσις there). The PLACE Ἐλευσίς above shares the
  // normalized nominative ελευσισ; the scoped source entry wins at
  // 1.29 and the place keeps every other section.
  "Eleusis (author uncertain)": { grc: "Ἔλευσις", forms: ["ελευσισ"] },
  Epictetus: { grc: "Ἐπίκτητος", cls: "m2" },
  "Eudemus of Rhodes": { grc: "Εὔδημος", cls: "m2" },
  Eudromus: { grc: "Εὔδρομος", cls: "m2" },
  "Euphantus of Olynthus": { grc: "Εὔφαντος", cls: "m2" },
  Euphorion: { grc: "Εὐφορίων", cls: "n3o" },
  "Glaucus of Rhegium": { grc: "Γλαῦκος", cls: "m2" },
  // Scoped to 7.121 ("Ἡρακλείδης ὁ Ταρσεύς"); bare Ἡρακλείδης
  // elsewhere stays with the Heraclides bearers above.
  "Heraclides of Tarsus": { grc: "Ἡρακλείδης", cls: "m1h" },
  // Only the two workbook-cited sections (1.12 accusative, 7.25
  // genitive); the poet's many narrative mentions stay untagged.
  Hesiod: { grc: "Ἡσίοδος", cls: "m2" },
  Hippias: { grc: "Ἱππίας", cls: "m1a" },
  "Isidorus of Pergamum": { grc: "Ἰσίδωρος", cls: "m2" },
  Istrus: { grc: "Ἴστρος", cls: "m2" },
  Lysanias: { grc: "Λυσανίας", cls: "m1a" },
  Lysis: { grc: "Λῦσις", cls: "i3" },
  "Maeandrius of Miletus": { grc: "Μαιάνδριος", cls: "m2" },
  // Indeclinable-looking Egyptian name: only the nominative Μανέθως
  // is attested (1.10); no class fits its -ως paradigm.
  Manetho: { grc: "Μανέθως", forms: ["μανεθωσ"] },
  Melanthius: { grc: "Μελάνθιος", cls: "m2" },
  Meleager: { grc: "Μελέαγρος", cls: "m2" },
  // Scoped to 9.115; the Μηνόδοτος of 2.104 (list of Theodoruses) and
  // 9.116 (the teacher of Herodotus of Tarsus) are other bearers.
  "Menodotus of Nicomedia": { grc: "Μηνόδοτος", cls: "m2" },
  // Scoped to 9.58, resolving the Metrodorus skip for book 9: both
  // occurrences there (genitive with ethnic, accusative) are the
  // Chian; bare Μητρόδωρος elsewhere stays skipped (of Lampsacus).
  "Metrodorus of Chios": { grc: "Μητρόδωρος", cls: "m2" },
  Minyas: { grc: "Μινύης", cls: "m1h" },
  "Mnesistratus of Thasos": { grc: "Μνησίστρατος", cls: "m2" },
  Nicolaus: { grc: "Νικόλαος", cls: "m2" },
  Numenius: { grc: "Νουμήνιος", cls: "m2" },
  Onetor: { grc: "Ὀνήτωρ", cls: "or3" },
  Polyeuctus: { grc: "Πολύευκτος", cls: "m2" },
  Potamon: { grc: "Ποτάμων", cls: "n3o" },
  // Scoped to 3.8; the Πραξιφάνους of 10.13 (Epicurus' reported
  // teacher) is the same man but outside the workbook's citation.
  Praxiphanes: { grc: "Πραξιφάνης", cls: "s3" },
  Sabinus: { grc: "Σαβῖνος", cls: "m2" },
  "Seleucus (grammarian)": { grc: "Σέλευκος", cls: "m2" },
  "Sextus Empiricus": { grc: "Σέξτος", cls: "m2" },
  "Silenus (of Kale Acte)": { grc: "Σιληνός", cls: "m2" },
  Sophilus: { grc: "Σώφιλος", cls: "m2" },
  Theodosius: { grc: "Θεοδόσιος", cls: "m2" },
  Theophanes: { grc: "Θεοφάνης", cls: "s3" },
  Timonides: { grc: "Τιμωνίδης", cls: "m1h" },
  "Timotheus of Athens": { grc: "Τιμόθεος", cls: "m2" },
  // Bare Ζήνων in 7.41/7.84 sits beside Zeno of Citium's own tokens
  // (7.84 has "Κιτιεὺς Ζήνων" in the same breath), so ONLY the
  // ethnic-anchored multi-word phrases are curated: "Ζήνων ὁ Ταρσεύς"
  // (7.41 nominative) and "Ζήνωνα τὸν Ταρσέα" (7.84 accusative).
  "Zeno of Tarsus": {
    grc: "Ζήνων",
    forms: ["ζηνων ο ταρσευσ", "ζηνωνα τον ταρσεα"],
  },
  Zeuxis: { grc: "Ζεῦξις", cls: "i3" },

  // ----------------------------------------- schools & gymnasia places
  // Corpus spelling is Ἀκαδήμεια (28 occurrences), not Ἀκαδημία.
  Academy: { grc: "Ἀκαδήμεια", cls: "f1a" },
  Cynosarges: {
    grc: "Κυνόσαργες",
    forms: ["κυνοσαργεσ", "κυνοσαργουσ", "κυνοσαργει"],
  },
  Lyceum: { grc: "Λύκειον", cls: "n2" },

  // ------------------------------------------------------- places (174)
  Abdera: { grc: "Ἄβδηρα", cls: "pln" },
  Acharnae: { grc: "Ἀχαρναί", cls: "pl1" },
  Aegina: { grc: "Αἴγινα", cls: "f1x" },
  Aegospotami: {
    grc: "Αἰγὸς ποταμοί",
    forms: [
      "αιγοσ ποταμοι",
      "αιγοσ ποταμων",
      "αιγοσ ποταμοισ",
      "αιγοσ ποταμουσ",
    ],
  },
  Aenus: { grc: "Αἶνος", cls: "m2" },
  "Agrigentum (Acragas)": { grc: "Ἀκράγας", cls: "ant3" },
  Alexandria: { grc: "Ἀλεξάνδρεια", cls: "f1a" },
  Alopece: { grc: "Ἀλωπεκή", cls: "f1h", alsoForms: ["αλωπεκηθεν"] },
  Amastris: { grc: "Ἄμαστρις", cls: "i3" },
  Ambracia: { grc: "Ἀμβρακία", cls: "f1a" },
  Amphipolis: { grc: "Ἀμφίπολις", cls: "is3" },
  Anaphlystus: { grc: "Ἀνάφλυστος", cls: "m2" },
  Arcadia: { grc: "Ἀρκαδία", cls: "f1a" },
  Argos: { grc: "Ἄργος", cls: "sn3" },
  Aspendus: { grc: "Ἄσπενδος", cls: "m2" },
  Assos: { grc: "Ἄσσος", cls: "m2" },
  Astypalaea: { grc: "Ἀστυπάλαια", cls: "f1a" },
  Atarneus: { grc: "Ἀταρνεύς", cls: "eus3" },
  Athens: {
    grc: "Ἀθῆναι",
    cls: "pl1",
    alsoForms: ["αθηναζε", "αθηνησι", "αθηνησιν", "αθηνηθεν"],
  },
  Attica: { grc: "Ἀττική", cls: "f1h" },
  Babylon: { grc: "Βαβυλών", cls: "n3o" },
  Boeotia: { grc: "Βοιωτία", cls: "f1a" },
  Borysthenes: { grc: "Βορυσθένης", cls: "s3" },
  Bosporus: { grc: "Βόσπορος", cls: "m2" },
  Byzantium: { grc: "Βυζάντιον", cls: "n2" },
  Callatis: { grc: "Κάλλατις", cls: "i3" },
  Carthage: { grc: "Καρχηδών", cls: "n3on" },
  Catana: { grc: "Κατάνη", cls: "f1h" },
  Ceramicus: { grc: "Κεραμεικός", cls: "m2" },
  Chaeronea: { grc: "Χαιρώνεια", cls: "f1a" },
  Chalcedon: { grc: "Χαλκηδών", cls: "n3on" },
  Chalcis: { grc: "Χαλκίς", cls: "i3" },
  Chios: { grc: "Χίος", cls: "m2" },
  Cilicia: { grc: "Κιλικία", cls: "f1a" },
  Citium: { grc: "Κίτιον", cls: "n2" },
  Clazomenae: { grc: "Κλαζομεναί", cls: "pl1" },
  Cnidos: { grc: "Κνίδος", cls: "m2" },
  Colchis: { grc: "Κολχίς", cls: "i3" },
  Collytus: { grc: "Κολλυτός", cls: "m2" },
  Colonus: { grc: "Κολωνός", cls: "m2" },
  Colophon: { grc: "Κολοφών", cls: "n3o" },
  Corcyra: { grc: "Κέρκυρα", cls: "f1a" },
  Corinth: { grc: "Κόρινθος", cls: "m2" },
  Cos: { grc: "Κῶς", forms: ["κωσ", "κω"] },
  Crete: { grc: "Κρήτη", cls: "f1h" },
  Croton: { grc: "Κρότων", cls: "n3o" },
  Cyme: { grc: "Κύμη", cls: "f1h" },
  Cyprus: { grc: "Κύπρος", cls: "m2" },
  Cyrene: { grc: "Κυρήνη", cls: "f1h" },
  Cythera: { grc: "Κύθηρα", cls: "pln" },
  Cyzicus: { grc: "Κύζικος", cls: "m2" },
  Delos: { grc: "Δῆλος", forms: ["δηλω"] },
  Delphi: { grc: "Δελφοί", cls: "pl2" },
  Egypt: { grc: "Αἴγυπτος", cls: "m2" },
  Elea: { grc: "Ἐλέα", cls: "f1a" },
  Eleusis: { grc: "Ἐλευσίς", cls: "in3" },
  Elis: { grc: "Ἦλις", cls: "i3" },
  Ephesus: { grc: "Ἔφεσος", cls: "m2" },
  Epidaurus: { grc: "Ἐπίδαυρος", cls: "m2" },
  Eresus: { grc: "Ἔρεσος", cls: "m2" },
  Eretria: { grc: "Ἐρέτρια", cls: "f1a" },
  Etna: { grc: "Αἴτνη", cls: "f1h" },
  Euboea: { grc: "Εὔβοια", cls: "f1a" },
  Gargettus: { grc: "Γαργηττός", cls: "m2" },
  Gela: { grc: "Γέλα", cls: "f1a" },
  Halicarnassus: { grc: "Ἁλικαρνασσός", cls: "m2" },
  Hellespont: { grc: "Ἑλλήσποντος", cls: "m2" },
  Iasus: { grc: "Ἰασός", cls: "m2" },
  Ida: { grc: "Ἴδη", cls: "f1h" },
  India: { grc: "Ἰνδία", cls: "f1a" },
  Ionia: { grc: "Ἰωνία", cls: "f1a", alsoForms: ["ιωνιην"] },
  Isthmus: { grc: "Ἰσθμός", cls: "m2" },
  Italy: { grc: "Ἰταλία", cls: "f1a" },
  Lacedaemon: { grc: "Λακεδαίμων", cls: "n3on" },
  Laconia: { grc: "Λακωνική", cls: "f1h" },
  Lampsacus: { grc: "Λάμψακος", cls: "m2" },
  Larissa: { grc: "Λάρισσα", cls: "f1x" },
  Lemnos: { grc: "Λῆμνος", cls: "m2" },
  Leontini: { grc: "Λεοντῖνοι", cls: "pl2" },
  Lesbos: { grc: "Λέσβος", cls: "m2" },
  Libya: { grc: "Λιβύη", cls: "f1h" },
  Lindus: { grc: "Λίνδος", cls: "m2" },
  Lydia: { grc: "Λυδία", cls: "f1a" },
  Macedonia: { grc: "Μακεδονία", cls: "f1a" },
  Magnesia: { grc: "Μαγνησία", cls: "f1a" },
  Mantinea: { grc: "Μαντίνεια", cls: "f1a" },
  Marathon: { grc: "Μαραθών", cls: "n3o" },
  Maroneia: { grc: "Μαρώνεια", cls: "f1a" },
  Megalopolis: { grc: "Μεγαλόπολις", cls: "is3" },
  Megara: { grc: "Μέγαρα", cls: "pln", alsoForms: ["μεγαραδε", "μεγαροι"] },
  Memphis: { grc: "Μέμφις", cls: "i3" },
  Messenia: { grc: "Μεσσηνία", cls: "f1a", alsoForms: ["μεσσηνη"] },
  Metapontum: { grc: "Μεταπόντιον", cls: "n2" },
  Miletus: { grc: "Μίλητος", cls: "m2" },
  Mitylene: { grc: "Μυτιλήνη", cls: "f1h" },
  Munichia: { grc: "Μουνιχία", cls: "f1a" },
  Myrrhinus: {
    grc: "Μυρρινοῦς",
    forms: ["μυρρινουσ", "μυρρινουντοσ", "μυρρινουντι", "μυρρινουντα"],
  },
  Nemea: { grc: "Νεμέα", cls: "f1a" },
  Nicaea: { grc: "Νίκαια", cls: "f1a" },
  Nicomedia: { grc: "Νικομήδεια", cls: "f1a" },
  Nile: { grc: "Νεῖλος", cls: "m2" },
  Olympia: {
    grc: "Ὀλυμπία",
    forms: ["ολυμπια", "ολυμπιαν", "ολυμπιασι", "ολυμπιασιν"],
  },
  Olynthus: { grc: "Ὄλυνθος", cls: "m2" },
  Oropus: { grc: "Ὠρωπός", cls: "m2" },
  Paeania: { grc: "Παιανία", cls: "f1a" },
  Paros: { grc: "Πάρος", cls: "m2" },
  Peloponnesus: { grc: "Πελοπόννησος", cls: "m2" },
  Pergamum: { grc: "Πέργαμον", cls: "n2" },
  Perinthus: { grc: "Πέρινθος", cls: "m2" },
  Phalerum: { grc: "Φάληρον", cls: "n2", alsoForms: ["φαληροι"] },
  Pharsalus: { grc: "Φάρσαλος", cls: "m2" },
  Phlius: {
    grc: "Φλιοῦς",
    forms: ["φλιουσ", "φλιουντοσ", "φλιουντι", "φλιουντα"],
  },
  Phoenicia: { grc: "Φοινίκη", cls: "f1h" },
  Phrygia: { grc: "Φρυγία", cls: "f1a" },
  Piraeus: { grc: "Πειραιεύς", cls: "eus3", alsoForms: ["πειραια"] },
  Pisa: { grc: "Πῖσα", cls: "f1x" },
  Pitane: { grc: "Πιτάνη", cls: "f1h" },
  Pontus: { grc: "Πόντος", cls: "m2" },
  Potidaea: { grc: "Ποτίδαια", cls: "f1a" },
  Priene: { grc: "Πριήνη", cls: "f1h" },
  Proconnesus: { grc: "Προκόννησος", cls: "m2" },
  Propontis: { grc: "Προποντίς", cls: "i3" },
  Rhegium: { grc: "Ῥήγιον", cls: "n2" },
  Rhodes: { grc: "Ῥόδος", cls: "m2" },
  Salamis: { grc: "Σαλαμίς", cls: "in3" },
  Samos: { grc: "Σάμος", cls: "m2" },
  Samothrace: { grc: "Σαμοθρᾴκη", cls: "f1h" },
  Sardis: { grc: "Σάρδεις", forms: ["σαρδεισ", "σαρδεων", "σαρδεσι", "σαρδεσιν"] },
  Scepsis: { grc: "Σκῆψις", cls: "is3" },
  Scillus: {
    grc: "Σκιλλοῦς",
    forms: ["σκιλλουσ", "σκιλλουντοσ", "σκιλλουντι", "σκιλλουντα"],
  },
  Scythia: { grc: "Σκυθία", cls: "f1a" },
  Seleucia: { grc: "Σελεύκεια", cls: "f1a" },
  Selinus: {
    grc: "Σελινοῦς",
    forms: ["σελινουσ", "σελινουντοσ", "σελινουντι", "σελινουντα"],
  },
  Sicily: { grc: "Σικελία", cls: "f1a" },
  Sicyon: { grc: "Σικυών", cls: "n3o" },
  Sidon: { grc: "Σιδών", cls: "n3o" },
  Sinope: { grc: "Σινώπη", cls: "f1h" },
  Smyrna: { grc: "Σμύρνα", cls: "f1x" },
  // gen. pl. Σόλων dropped: homograph of Solon the sage.
  Soli: { grc: "Σόλοι", forms: ["σολοι", "σολοισ", "σολουσ"] },
  Stagira: { grc: "Στάγειρα", cls: "pln" },
  Stratonicea: { grc: "Στρατονίκεια", cls: "f1a" },
  Susa: { grc: "Σοῦσα", cls: "pln" },
  Syracuse: { grc: "Συρακοῦσαι", cls: "pl1" },
  Syria: { grc: "Συρία", cls: "f1a" },
  Syros: { grc: "Σύρος", cls: "m2" },
  Tanagra: { grc: "Τάναγρα", cls: "f1a" },
  Tarentum: { grc: "Τάρας", cls: "ant3" },
  Tarsus: { grc: "Ταρσός", cls: "m2" },
  Thasos: { grc: "Θάσος", cls: "m2" },
  Thebes: { grc: "Θῆβαι", cls: "pl1", alsoForms: ["θηβησι", "θηβησιν"] },
  "Thracian Chersonese": { grc: "Χερρόνησος", cls: "m2" },
  Thurii: { grc: "Θούριοι", cls: "pl2" },
  Tralles: { grc: "Τράλλεις", forms: ["τραλλεισ", "τραλλεων", "τραλλεσι"] },
  Troas: { grc: "Τρῳάς", forms: ["τρωασ", "τρωαδοσ", "τρωαδι", "τρωαδα"] },
  Troy: { grc: "Τροία", cls: "f1a" },
  Tyre: { grc: "Τύρος", cls: "m2" },
  Zacynthus: { grc: "Ζάκυνθος", cls: "m2" },
  Zancle: { grc: "Ζάγκλη", cls: "f1h" },
};

/* ================================================================== *
 *  Work titles. Works have no otv:ProperName nodes (deliberate TBox
 *  asymmetry), so these are emitted as lo:greekTitle literals on the
 *  work node and matched with the same capital-initial guard. Shared
 *  titles (Republic, Memorabilia) tag the title node, which the KG
 *  deliberately keys by title, not by author - a Πολιτεία line in
 *  Zeno's catalogue tags the same node as Plato's.
 * ================================================================== */
export const GREEK_WORK_TITLES: Record<string, GreekNameSpec> = {
  Republic: { grc: "Πολιτεία", forms: ["πολιτεια", "πολιτειασ", "πολιτειαν"] },
  Symposium: {
    grc: "Συμπόσιον",
    forms: ["συμποσιον", "συμποσιου", "συμποσιω"],
  },
  // Memorabilia: `forms` is deliberately EMPTY - the lo:greekTitle
  // literal is still emitted (the emitters read `grc`), but the tagger
  // gets no occurrence forms: 13 of the 18 corpus occurrences of
  // Ἀπομνημονεύματα are FAVORINUS' homonymous work (no node), only 2
  // are Xenophon's, so tagging would systematically mis-attribute.
  Memorabilia: { grc: "Ἀπομνημονεύματα", forms: [] },
  Purifications: { grc: "Καθαρμοί", forms: ["καθαρμοι", "καθαρμων"] },
  Anabasis: {
    grc: "Ἀνάβασις",
    forms: ["αναβασισ", "αναβασεωσ", "αναβασει", "αναβασιν"],
  },
  // Περὶ τῶν σοφῶν is a title HOMONYM: Hermippus' work (cited 1.42 for
  // the seventeen candidate Sages) and Theophrastus' Of the Wise (one
  // book) in his catalogue. Quoted titles are indeclinable phrases, so
  // one normalized form each; the onlySections scopes keep the two
  // works apart (disjoint by construction - see gazetteer.ts).
  "On Pythagoras and his Associates": {
    grc: "Περὶ Πυθαγόρου καὶ τῶν γνωρίμων αὐτοῦ",
    forms: ["περι πυθαγορου και των γνωριμων αυτου"],
    onlySections: ["1.11.118"],
  },
  // Alexander Polyhistor's Successions: scoped to sections where it is
  // explicitly cited to avoid collisions with Antisthenes' same-titled work.
  "Successions of Philosophers": {
    grc: "Διαδοχαί",
    forms: ["διαδοχαι", "διαδοχαισ", "διαδοχων"],
    // 8.1.24 carries the citation sentence (coverage audit July 2026).
    onlySections: ["1.11.116", "3.1.4", "8.1.24"],
  },
  // Antisthenes of Rhodes' Successions: scoped to 6.77 only.
  Successions: {
    grc: "Διαδοχαί",
    forms: ["διαδοχαι", "διαδοχαισ", "διαδοχων"],
    onlySections: ["6.2.77"],
  },
  // Plutarch's parallel Life of Lysander and Sulla: the title form in D.L.
  // is a dative phrase (Λυσάνδρου βίῳ καὶ Σύλλα), so phrase-matched.
  "Life of Lysander and Sulla": {
    grc: "Λύσανδρος καὶ Σύλλας",
    forms: ["λυσανδρου βιω και συλλα"],
    onlySections: ["4.1.4"],
  },
  Homonyms: {
    grc: "Ὁμώνυμοι",
    forms: ["ομωνυμοι", "ομωνυμοισ", "ομωνυμων"],
  },
  // Eumelus' Histories: Ἱστορίαι is a very generic title; scoped tightly.
  Histories: {
    grc: "Ἱστορίαι",
    forms: ["ιστοριων"],
    onlySections: ["5.1.6"],
  },
  "On Heraclitus": {
    grc: "Περὶ Ἡρακλείτου",
    forms: ["περι ηρακλειτου"],
    onlySections: ["9.1.5"],
  },
  "Against the Sophists": {
    grc: "Κατὰ σοφιστῶν",
    forms: ["κατα σοφιστων"],
    onlySections: ["8.2.74"],
  },
  "On the Sages": {
    grc: "Περὶ τῶν σοφῶν",
    forms: ["περι των σοφων"],
    onlySections: ["1.1.42"],
  },
  "Of the Wise (one book)": {
    grc: "Περὶ τῶν σοφῶν",
    forms: ["περι των σοφων"],
    onlySections: ["5.2.48"],
  },
  // Apollodorus' Chronology: all 22 corpus occurrences of Χρονικ- are
  // his (verified against every hit, Greek and English, at curation
  // time), so no section scope is needed. Title cited in dative
  // (ἐν [τοῖς] Χρονικοῖς, 19×) and genitive (ἐν τρίτῳ Χρονικῶν, 2×);
  // the nominative Χρονικά itself never occurs but stays in the form
  // list as the paradigm head.
  Chronology: {
    grc: "Χρονικά",
    forms: ["χρονικα", "χρονικων", "χρονικοισ"],
  },
  // Antileon's On Dates (Περὶ χρόνων), cited in the genitive at 3.3
  // (ἐν δευτέρῳ Περὶ χρόνων) for Plato's deme. Scoped to that one
  // section so the generic word χρόνων elsewhere never tags the work.
  "On Dates": {
    grc: "Περὶ χρόνων",
    forms: ["περι χρονων"],
    onlySections: ["3.1.3"],
  },
  // Ethics: "Ἠθικά" is a generic title - the node (minted by Zeno's
  // catalogue, 7.4) is shared across authors by the one-node-per-title
  // policy, like Simon's dialogue titles below. The scope covers only
  // the capitalized BARE-title occurrences: Aristotle's Ethics quoted
  // at 5.21 (τῶν Ἠθικῶν), Achaicus' Ethics at 6.99 (ἐν Ἠθικοῖς),
  // Zeno's own Ἠθικά at 7.4, and Apollodorus' ἐν τῇ Ἠθικῇ at 7.102,
  // 7.118, 7.121, 7.129 - all seven already carry the English tag.
  // Deliberately excluded: capitalized Ἠθικ- tokens inside MULTI-WORD
  // titles of different works (Ἠθικῶν σχολῶν + Ἠθικοὶ χαρακτῆρες
  // 5.47, Ἠθικαῖς σχολαῖς 7.28, Ἠθικῇ στοιχειώσει 7.39, Ἠθικοῦ
  // λόγου/τόπου 7.91 + 7.199-202, Ἠθικῶν ζητημάτων 7.120) and the
  // 5.23 catalogue Ἠθικῶν, which is the distinct "Five books of
  // Ethics" node. The dozens of lowercase ἠθικ- adjectives (the
  // division of philosophy) are excluded by the capitalization rule.
  Ethics: {
    grc: "Ἠθικά",
    forms: ["ηθικα", "ηθικων", "ηθικοισ", "ηθικη"],
    onlySections: [
      "5.1.21",
      "6.8.99",
      "7.1.4",
      "7.1.102",
      "7.1.118",
      "7.1.121",
      "7.1.129",
    ],
  },

  // ------------------------------------------------- Simon's dialogues
  // The thirty-three "leathern" dialogues catalogued at 2.122-123.
  // Quoted Περὶ-titles are indeclinable phrases: one normalized form
  // each, taken verbatim from the catalogue. Every entry is scoped to
  // the catalogue sections because the bare genitive phrases (Περὶ
  // θεῶν, Περὶ ἀρετῆς, …) recur in OTHER authors' catalogues, where
  // they name homonymous works with different English labels. Note:
  // several of these English labels are shared work nodes (Of the
  // Gods, Of Courage, On Law, …) merged across authors by the
  // one-node-per-title policy; the lo:greekTitle literal is correct
  // for all bearers. Περὶ ποιήσεως appears twice in the catalogue
  // (Hicks: "Of Poetry" and "On Poetry"); the form is attached to
  // "Of Poetry" only, so both occurrences tag as that node instead of
  // colliding in the same sections.
  "Of the Gods": {
    grc: "Περὶ θεῶν",
    forms: ["περι θεων"],
    onlySections: ["2.13.122"],
  },
  "Of the Good": {
    grc: "Περὶ τοῦ ἀγαθοῦ",
    forms: ["περι του αγαθου"],
    onlySections: ["2.13.122"],
  },
  "On the Beautiful": {
    grc: "Περὶ τοῦ καλοῦ",
    forms: ["περι του καλου"],
    onlySections: ["2.13.122", "2.13.123"],
  },
  // Also opens the Greek text of 2.123 (Greek/English section-boundary
  // mismatch), hence the two-section scope.
  "What is the Beautiful": {
    grc: "Τί τὸ καλόν",
    forms: ["τι το καλον"],
    onlySections: ["2.13.122", "2.13.123"],
  },
  "On the Just": {
    grc: "Περὶ δικαίου",
    forms: ["περι δικαιου"],
    onlySections: ["2.13.122"],
  },
  "Of Virtue, that it cannot be taught": {
    grc: "Περὶ ἀρετῆς ὅτι οὐ διδακτόν",
    forms: ["περι αρετησ οτι ου διδακτον"],
    onlySections: ["2.13.122"],
  },
  "Of Courage": {
    grc: "Περὶ ἀνδρείας",
    forms: ["περι ανδρειασ"],
    onlySections: ["2.13.122"],
  },
  "On Law": {
    grc: "Περὶ νόμου",
    forms: ["περι νομου"],
    onlySections: ["2.13.122"],
  },
  "On Guiding the People": {
    grc: "Περὶ δημαγωγίας",
    forms: ["περι δημαγωγιασ"],
    onlySections: ["2.13.122"],
  },
  "Of Honour": {
    grc: "Περὶ τιμῆς",
    forms: ["περι τιμησ"],
    onlySections: ["2.13.122"],
  },
  "Of Poetry": {
    grc: "Περὶ ποιήσεως",
    forms: ["περι ποιησεωσ"],
    onlySections: ["2.13.122"],
  },
  "On Good Eating": {
    grc: "Περὶ εὐπαθείας",
    forms: ["περι ευπαθειασ"],
    onlySections: ["2.13.122"],
  },
  "On Love": {
    grc: "Περὶ ἔρωτος",
    forms: ["περι ερωτοσ"],
    onlySections: ["2.13.122"],
  },
  "On Philosophy": {
    grc: "Περὶ φιλοσοφίας",
    forms: ["περι φιλοσοφιασ"],
    onlySections: ["2.13.122"],
  },
  "On Knowledge": {
    grc: "Περὶ ἐπιστήμης",
    forms: ["περι επιστημησ"],
    onlySections: ["2.13.122"],
  },
  "On Music": {
    grc: "Περὶ μουσικῆς",
    forms: ["περι μουσικησ"],
    onlySections: ["2.13.122"],
  },
  "On Teaching": {
    grc: "Περὶ διδασκαλίας",
    forms: ["περι διδασκαλιασ"],
    onlySections: ["2.13.123"],
  },
  "On the Art of Conversation": {
    grc: "Περὶ τοῦ διαλέγεσθαι",
    forms: ["περι του διαλεγεσθαι"],
    onlySections: ["2.13.123"],
  },
  "Of Judging": {
    grc: "Περὶ κρίσεως",
    forms: ["περι κρισεωσ"],
    onlySections: ["2.13.123"],
  },
  "Of Being": {
    grc: "Περὶ τοῦ ὄντος",
    forms: ["περι του οντοσ"],
    onlySections: ["2.13.123"],
  },
  "Of Number": {
    grc: "Περὶ ἀριθμοῦ",
    forms: ["περι αριθμου"],
    onlySections: ["2.13.123"],
  },
  "On Diligence": {
    grc: "Περὶ ἐπιμελείας",
    forms: ["περι επιμελειασ"],
    onlySections: ["2.13.123"],
  },
  "On Efficiency": {
    grc: "Περὶ τοῦ ἐργάζεσθαι",
    forms: ["περι του εργαζεσθαι"],
    onlySections: ["2.13.123"],
  },
  "On Greed": {
    grc: "Περὶ φιλοκερδοῦς",
    forms: ["περι φιλοκερδουσ"],
    onlySections: ["2.13.123"],
  },
  "On Pretentiousness": {
    grc: "Περὶ ἀλαζονείας",
    forms: ["περι αλαζονειασ"],
    onlySections: ["2.13.123"],
  },
  "On Deliberation": {
    grc: "Περὶ τοῦ βουλεύεσθαι",
    forms: ["περι του βουλευεσθαι"],
    onlySections: ["2.13.123"],
  },
  "On Reason, or On Expediency": {
    grc: "Περὶ λόγου ἢ περὶ ἐπιτηδειότητος",
    forms: ["περι λογου η περι επιτηδειοτητοσ"],
    onlySections: ["2.13.123"],
  },
  "On Doing Ill": {
    grc: "Περὶ κακουργίας",
    forms: ["περι κακουργιασ"],
    onlySections: ["2.13.123"],
  },
  // Omphale: Achaeus of Eretria's satyr play (person-works.ts). The
  // one corpus occurrence is the genitive at 2.134 (ἐκ τῆς σατυρικῆς
  // Ὀμφάλης); Hicks names the play at the same section. Unscoped: the
  // only other ομφαλ- token in the corpus (ὀμφάλιον, 8.45) is
  // lowercase and a different word, excluded by the capitalization
  // rule and by its distinct normalized form.
  Omphale: { grc: "Ὀμφάλη", forms: ["ομφαλησ"] },
};

/* ================================================================== *
 *  Documented curation skips: labels deliberately left without Greek
 *  forms. Pinned by validate-annotations so a future curation change
 *  is a conscious, re-reviewed decision.
 * ================================================================== */
export const GREEK_NAME_SKIPS: Record<string, string> = {
  // Text-ambiguous names, mirroring the English SURFACE_BLOCKLIST:
  Alexander:
    "Ἀλέξανδρος: the source is Polyhistor, but bare Ἀλέξανδρος in the text is usually Alexander the Great; since 2026-07 both bearers tag through scoped specs (the king via 'Alexander the Great', the source via the scoped 'Alexander' spec over his verified citation sections), and the undecidable occurrences (Chrysippus' addressee, the dramatist, Paris at 1.32) stay untagged",
  Antigonus:
    "Ἀντίγονος: bare Ἀντίγονος in the royal narratives (Zeno, Menedemus, Arcesilaus, Bion, Cleanthes, Timon) is King Antigonus Gonatas - or Monophthalmus at 2.115/5.78 - not the biographer; the claim-source node 'Antigonus' stays formless, and the biographer tags only through the section-scoped 'Antigonus of Carystus' spec (ANTIGONUS_CARYSTUS_SECTIONS) plus the curated multi-word form at 2.143",
  Theodorus:
    "Θεόδωρος: D.L. himself counts twenty Theodoruses (2.103)",
  Metrodorus:
    "Μητρόδωρος: of Lampsacus (the node) vs. of Chios (book 9); since 2026-07 the Chian tags at 9.58 via the scoped 'Metrodorus of Chios' spec, bare Μητρόδωρος everywhere else stays skipped",
  Olympiodorus:
    "the Perseus Greek at 6.23 reads Ἀθηνόδωρος ὁ Ἀθηναίων προστατήσας where Hicks prints Olympiodorus; no Greek form of the name occurs, so the mention stays English-only",
  Herodotus:
    "Ἡρόδοτος: the historian vs. the Epicurean addressee of the letter in book 10; since 2026-07 the Sceptic of Tarsus tags at 9.116 via the scoped 'Herodotus of Tarsus' spec, bare Ἡρόδοτος everywhere else stays skipped",
  Timaeus:
    "Τίμαιος: the historian of Sicily vs. Plato's dialogue in the book 3 catalogue",
  "Antipater of Sidon":
    "Ἀντίπατρος: book 7 constantly cites Antipater of Tarsus, who has no node; bare Ἀντίπατρος would systematically mis-attribute",
  "Athenaeus the epigrammatist":
    "Ἀθήναιος: 27 of 30 capitalized occurrences are the ethnic Ἀθηναῖος 'Athenian', an exact homograph after normalization",

  // Greek form does not occur, or occurs only as something else:
  Rome: "only the ethnic Ῥωμαῖοι occurs, never Ῥώμη; ethnics are deferred",
  Ceos: "only the ethnic Κεῖος occurs, never Κέως itself",
  Teos: "Τέως the town never occurs; τέως 'meanwhile' is a common adverb",
  Persia:
    "only Πέρσαι/Περσῶν (the people) occur; ethnics are deferred",
  Thria: "only the demotic Θριάσιος occurs, never Θρία itself",
  "Chen (a village in the district of Oeta or Laconia)":
    "Χηνία/Χῆναι: form uncertain and absent from the corpus",
  "Cnossos in Crete": "only the ethnic Κνώσσιος occurs",
  Xypete:
    "occurs only as the demotic Ξυπεταιών (2×), whose morphology is a collective, not the toponym; deferred with the other demonyms",

  // Compound editorial labels (never occur verbatim in any language):
  "Abdera, or, according to some, Miletus": "compound editorial label",
  "Elea, but some say Abdera and others Miletus": "compound editorial label",
  "Magians and Chaldaeans": "compound editorial label",
  "Epicurus (letter to Eurylochus)":
    "Ἐπίκουρος belongs to the philosopher node; the letter-source alias must not add a second bearer",

  // Greek school names are adjectives/common nouns, not proper names:
  Stoa: "στοά is the common noun for any colonnade; the school is ἡ Ποικίλη στοά",
  Peripatos: "περίπατος is the common noun 'walk'; school adjectives are deferred",
  "Epicurean (Garden)": "κῆπος is the common noun 'garden'",
  "Garden (Epicurus)": "κῆπος is the common noun 'garden'",

  // Capitalized-homograph hazards too dense to tag safely:
  Olympias:
    "unused key (kept for documentation symmetry); see Olympia's explicit forms",

  // Hippobotus' 7.38 Stoic pupils (Posidonius of Alexandria, Athenodorus
  // of Soli, Zeno of Sidon) are no longer skipped: their nominatives are
  // curated above with onlySections ["7.1.38"], where the scoped bearer
  // outranks the unscoped source node / owner heuristic. Their ENGLISH
  // bare surfaces stay in MENTION_BARE_NAME_SUPPRESSED (person-mentions.ts).
};

/* ================================================================== *
 *  School (movement) labels -> Greek display forms. Presentation-only:
 *  used by the competency route's bilingual terms panel, NEVER fed to
 *  the gazetteer or the LOD emitters (school chips are not tagged in
 *  the text and mint no ProperName nodes). Keyed by the exact MOVEMENTS
 *  labels in kg.ts. Forms follow Diogenes Laertius' own school names in
 *  the prologue survey (1.17-19), where he lists the sects with
 *  feminine adjectives (Akademaike, Kyrenaike, Eliake, Megarike,
 *  Kynike, Eretrike, Peripatetike, Stoike, Epikoureios); labels he does
 *  not cover carry the conventional adjective of the same shape.
 *  "Unaffiliated" is deliberately absent: it is a curatorial bucket,
 *  not a school, and must render English-only.
 * ================================================================== */
export const GREEK_SCHOOL_NAMES: Record<string, string> = {
  "Seven Sages": "οἱ ἑπτὰ σοφοί",
  "Ionian / Milesian": "Ἰωνική",
  Socratic: "Σωκρατική",
  Cyrenaic: "Κυρηναϊκή",
  Megarian: "Μεγαρική",
  "Elian–Eretrian": "Ἠλιακὴ καὶ Ἐρετρική",
  Academy: "Ἀκαδημαϊκή",
  Peripatos: "Περιπατητική",
  Cynic: "Κυνική",
  Stoa: "Στωϊκή",
  Pythagorean: "Πυθαγορική",
  Eleatic: "Ἐλεατική",
  Atomist: "Ἀτομική",
  Sophist: "Σοφιστική",
  Sceptic: "Σκεπτική",
  "Epicurean (Garden)": "Ἐπικούρειος",
};

/** Greek display form for a school (movement) label, if curated. */
export function greekSchoolGrc(label: string): string | undefined {
  return GREEK_SCHOOL_NAMES[label];
}

/* ================================================================== *
 *  Corpus tradition (book-heading) labels -> Greek display forms.
 *  The corpus sections carry per-book tradition labels ("Ionian &
 *  Socratic", "Eleatics, Atomists, Sceptics") that group SEVERAL
 *  prologue sects, so they cannot key into GREEK_SCHOOL_NAMES
 *  directly; the compounds below are spelled from the same 1.17-19
 *  vocabulary, keeping the English label's own separators. Single-
 *  sect headings reuse the curated form verbatim. Presentation-only,
 *  like GREEK_SCHOOL_NAMES: never fed to the gazetteer or the LOD
 *  emitters. Keyed by the exact `school` strings in
 *  laertius_sections.jsonl.
 * ================================================================== */
const CORPUS_TRADITION_GRC: Record<string, string> = {
  "Seven Sages / Ionian tradition": "οἱ ἑπτὰ σοφοί / Ἰωνική",
  "Ionian & Socratic": "Ἰωνικὴ καὶ Σωκρατική",
  "Academy (Plato)": "Ἀκαδημαϊκή",
  "Cynics": "Κυνική",
  "Italian / Pythagorean": "Ἰταλική / Πυθαγορική",
  "Eleatics, Atomists, Sceptics": "Ἐλεατική, Ἀτομική, Σκεπτική",
  "Garden (Epicurus)": "Ἐπικούρειος",
};

/**
 * Greek display form for a corpus `school` tradition label (browse
 * page, passage/saying/anecdote/doxa/verse cards). Falls back to the
 * curated school map so the headings that ARE single sects (Academy,
 * Peripatos, Stoa) stay in lockstep with it.
 */
export function schoolGrcForCorpusLabel(label: string): string | undefined {
  return GREEK_SCHOOL_NAMES[label] ?? CORPUS_TRADITION_GRC[label];
}

/**
 * English DISPLAY overrides for school labels. The underlying corpus /
 * claim / LOD label stays unchanged (published RDF identifiers are a
 * stability contract — see laertius-live-site.ts), but the UI-facing
 * API responses render the shorter form. Keyed by the canonical label.
 */
const SCHOOL_DISPLAY_LABELS: Record<string, string> = {
  // 2026-08-06 user request: drop the "(Epicurus)" qualifier in display.
  "Garden (Epicurus)": "Garden",
};

/** UI display form of a school label (falls back to the label itself). */
export function displaySchoolLabel(label: string): string {
  return SCHOOL_DISPLAY_LABELS[label] ?? label;
}

/** All curated labels -> spec (names + work titles), for the emitters. */
export function greekNameSpec(label: string): GreekNameSpec | undefined {
  return GREEK_NAMES[label];
}

export function greekWorkTitleSpec(label: string): GreekNameSpec | undefined {
  return GREEK_WORK_TITLES[label];
}

/**
 * Enumerate the full normalized form set of a spec: explicit `forms`,
 * or stem + closed class endings, plus any `alsoForms`. Multi-word
 * forms (Αἰγὸς ποταμοί) contain spaces and are phrase-matched.
 */
export function enumerateGreekForms(spec: GreekNameSpec): string[] {
  const out = new Set<string>();
  if (spec.forms) {
    for (const f of spec.forms) out.add(f);
  } else if (spec.cls) {
    const cls = CLASSES[spec.cls];
    const norm = normalizeGreek(spec.grc);
    if (!norm.endsWith(cls.nom)) {
      throw new Error(
        `greek-names: "${spec.grc}" does not end in -${cls.nom} (class ${spec.cls})`,
      );
    }
    const stem = norm.slice(0, norm.length - cls.nom.length);
    for (const e of cls.endings) out.add(stem + e);
  } else {
    throw new Error(`greek-names: "${spec.grc}" has neither cls nor forms`);
  }
  for (const f of spec.alsoForms ?? []) out.add(f);
  return [...out];
}
