/**
 * Mention-only persons: people Diogenes Laertius names in the text who
 * are neither corpus philosophers, claim persons, cited sources, saying
 * attributees, nor verse poets - currently the rival candidates for the
 * canon of the Seven Sages listed at 1.41-42 (Maeandrius', Dicaearchus'
 * and Hermippus' lists), the three reported fathers of Lasos, the
 * Pythagoreans of Archytas' letters - Lamiscus (3.22, 8.80) and
 * Photidas (3.22) - the archon Pythodotus, D.L.'s chronology
 * marker for Aristotle's move to Philip's court (5.10), Eurytus
 * of Tarentum (visited by Plato in Italy with Philolaus at 3.6, and
 * one of the teachers of the last Pythagoreans seen by Aristoxenus
 * at 8.46), the
 * didactic poet Aratus of Soli (welcomed by Menedemus 2.133,
 * emulated by Dionysius the Renegade 7.167, advised by Timon on
 * getting a sound text of Homer 9.113), Aeschylus the tragedian
 * (honoured after Astydamas 2.43, ranked first by Menedemus 2.133,
 * the second actor in the growth of tragedy 3.56), and the eminent
 * members of Epicurus' circle at Lampsacus - Polyaenus son of
 * Athenodorus (10.18, 10.19, 10.24), Leonteus (10.5, 10.25, 10.26)
 * and his wife Themista (10.5, 10.25, 10.26, 10.28) - who anchor the
 * cited Garden memberships of school-members.ts.
 *
 * Each entry mints a foaf:Person node in the LOD graph (lod.ts), which
 * feeds the gazetteer -> the occurrence tagger -> the entities index
 * automatically, exactly like place-mentions.ts does for places.
 *
 * Curation policy (same as entity-links.ts): every QID verified at
 * curation time against the Wikidata entity (label + description);
 * never guess a homonym. Runtime stays offline.
 *
 * Homonym notes baked into the picks:
 * - Acusilaus = Q423894, the logographer/mythographer of Argos - D.L.
 *   says "Acusilaus, son of Cabas or Scabras, of Argos" (1.41), the
 *   same man the Suda credits with genealogies;
 * - Lasos = Q1128200, Lasus of Hermione, the 6th-c. lyric poet  - 
 *   D.L. 1.42 names his birthplace Hermione outright;
 * - Aristodemus (the Spartan sage candidate, praised by Alcaeus,
 *   1.30-31 and 1.41-42) has NO trustworthy Wikidata item: Q666528
 *   "Aristodemus of Sparta" is the 5th-c. Thermopylae survivor, a
 *   different man. He also shares his name with three other bearers
 *   in the corpus (the Arcadian co-regent 1.94, the Eretrian informer
 *   2.142, the addressee of a Platonic letter 3.61), so his tags are
 *   scoped to his own four sections via `onlySections`;
 * - Leophantus son of Gorgiadas, Charmantides, Sisymbrinus and
 *   Chabrinus (the three rival fathers of Lasos, the last per
 *   Aristoxenus) have no Wikidata items at all;
 * - Aeschylus = Q40939, the Athenian tragedian, but the name has
 *   three bearers in the corpus: the tragedian (2.43, 2.133, 3.56),
 *   Menedemus' Eretrian political opponent ("one Aeschylus who
 *   belonged to the opposite party", 2.141), and the addressee of
 *   Theophrastus' "In reply to Aeschylus" (5.50, bearer uncertain)  - 
 *   so his tags are scoped to the tragedian's three sections via
 *   `onlySections`; 2.141 and 5.50 stay untagged;
 * - Agrippa = Q365115, the Sceptic of the Five Modes ("Agrippa and
 *   his school add to them five other modes", 9.88) - but at 9.106
 *   "Apellas in his Agrippa" (Ἀπελλᾶς ἐν τῷ Ἀγρίππᾳ) names Apellas'
 *   BOOK titled after him, not the man, so his tags are scoped to
 *   9.11.88 via `onlySections`; 9.11.106 stays untagged. He also
 *   exists as a minted lo:Source authority in the sources index  - 
 *   a source/person double node (same convention as the
 *   source/philosopher doubles Bion, Heraclitus, Menippus); the
 *   sources index never feeds the gazetteer, so this person node is
 *   what makes the 9.88 tags possible;
 * - Polyaenus = Q740432, the Epicurean of Lampsacus - but at 2.105
 *   Phaedo's dialogue Medius is "said by some to be the work of
 *   Aeschines, while others ascribe it to Polyaenus", an ascription
 *   whose bearer is uncertain, so his tags are scoped to the
 *   Epicurean's three sections via `onlySections`; 2.9.105 stays
 *   untagged in both languages;
 * - Themista = Q1229024; the catalogue title "Neocles, dedicated to
 *   Themista" (10.28) names her as the dedicatee of the work, so the
 *   tag there is deliberate (unlike the Agrippa case, where the
 *   homonymous title names the book, not the man).
 *
 * Frequently-mentioned figures batch (added July 2026, from the
 * proper-noun audit's top untagged candidates):
 * - Aristocreon = Q2572655, Chrysippus' nephew, whom Chrysippus
 *   educated (7.185) and to whom he addressed many works in the
 *   catalogue (7.196-202). All ten corpus occurrences are book 7 and
 *   name him; unambiguous, so unscoped. Distinct from the homonymous
 *   historian (Q104630305) and epigrammatist (Q104630376);
 * - Isocrates = Q221182, the Athenian orator. All thirteen English
 *   occurrences across books 2-6 name him (his school, his pupils,
 *   Plato's friendship and relative age, his Panegyric, Antisthenes'
 *   replies to him); unambiguous, so unscoped. The Greek adjective
 *   form "Isocratean" (2.15, 4.23) is adjective morphology and
 *   deliberately not a curated form (same policy as the ethnics);
 * - Dion = Dion of Syracuse, Q457885, Plato's friend and patron - but
 *   bare "Dion" has MANY other bearers in the corpus: the verse
 *   addressee in Pittacus' song (1.80, bearer unknown), the slave
 *   freed in Theophrastus' will (5.73), Timocrates' book titled Dion
 *   (7.2), Dion of Paeania in the Athenian decree for Zeno (7.12),
 *   the Stoic logicians' stock example man ("Dion is walking",
 *   7.65-79), and the addressee of Chrysippus' works (7.190, 7.192,
 *   plausibly but not certainly the Syracusan). So his tags are
 *   scoped via `onlySections` to the sections where the Syracusan is
 *   the bearer beyond doubt: Aeschines' stay in Syracuse until Dion's
 *   return (2.63), the Plato narrative (3.3-61 passim, incl. the
 *   Academy roster at 3.46 and the epistle division at 3.61),
 *   Speusippus' Epistles to Dion and Simonides' histories of his
 *   deeds (4.5), and Philolaus' books bought at Plato's request
 *   (8.84). All other occurrences deliberately stay untagged;
 * - Asclepiades of Phlius = Q2087377, the Eretrian-school philosopher
 *   inseparable from Menedemus (2.105, 2.126-138, 6.91). Scoped via
 *   `onlySections` because the Greek accusative at 8.61 is the
 *   patronymic "descendant of Asclepius" in Empedocles' epigram for
 *   the physician Pausanias (Hicks renders it so), not the Phliasian.
 *
 * Second frequently-mentioned batch (added July 2026, next round of
 * the proper-noun audit's top untagged candidates; every bearer
 * verified per section against the text, QIDs via the Wikidata API):
 * - Croesus = Q184462, the king of Lydia: Thales' alliance advice
 *   (1.25), the golden goblet and bowl stories (1.29-30), Solon at his
 *   court (1.50-51), the letters to and from the sages (1.67, 1.81,
 *   1.105), Pittacus' refusal of his money (1.75, 1.77), and the
 *   chronological anchors (1.38, 1.95). Every corpus occurrence is the
 *   king; unambiguous, so unscoped;
 * - Cyrus the Younger = Q297960, the Achaemenid prince of Xenophon's
 *   Anabasis: the friendship through Proxenus (2.49-50), the
 *   mercenaries handed to Agesilaus (2.51), the expedition dated by
 *   Xenaenetus' archonship (2.55), and the exile epigram (2.58).
 *   Scoped to those sections: bare Cyrus elsewhere is Cyrus the Great
 *   (Thales' Miletus story 1.25, the Cyropaedia discussion 3.34), an
 *   Antisthenes title (2.61, 6.16, 6.18, and the 2.57/3.34 Cyropaedia
 *   titles), or BOTH men inside one section (6.4.84, the expedition
 *   AND the Cyropaedia laudation). Cyrus the Great is deliberately NOT
 *   minted: his only clean person mentions (1.25, 3.34) would share
 *   the bare surface with this node and section scoping cannot split
 *   the mixed 6.84, so the two occurrences stay untagged rather than
 *   risk cross-tagging the two Cyruses;
 * - Philip II of Macedon = Q130650: the accession synchronism for
 *   Xenophon's death (2.56), honours to Plato at his death (3.40),
 *   Speusippus' Epistles to him (4.5, the famous Letter to Philip),
 *   the embassy Xenocrates refused to be bribed on (4.8-9), and the
 *   Aristotle narrative (envoy 5.2, Alexander's tutor 5.4, the court
 *   visit dated by Pythodotus 5.10, Letters to Philip 5.27); Diogenes
 *   seized after Chaeronea (6.43), and the Hipparchia comparison
 *   (6.88). Scoped because bare Philip elsewhere is other men: the
 *   historian of "Philip and Perseus against the Romans" is Philip V
 *   (5.61), Chrysippus' addressee (7.193) is unknown, and the
 *   Greek-only occurrences name Philip the Megarian (1.16, 2.113),
 *   Philip of Opus (3.37, 3.46), and a witness of Plato's will
 *   (3.41-42) - all outside the scope, all deliberately untagged;
 * - Alcibiades = Q187982, the Athenian statesman of Socrates' circle:
 *   the prize of valour resigned to him (2.23), the offered building
 *   site (2.24), his scorned beauty (2.31), the Xanthippe exchanges
 *   (2.36-37), the ransom of Phaedo (2.105), and Bion's censures
 *   (4.49). Scoped because the name elsewhere is dialogue titles -
 *   Antisthenes' and Aeschines' Alcibiades (2.61, 6.18), Euclides'
 *   (2.108), and the two Platonic Alcibiades dialogues, already work
 *   nodes (3.51, 3.59, 3.62);
 * - Hermias = Q948620, the tyrant of Atarneus, Aristotle's kinsman by
 *   marriage: the affection stories and Demetrius' biography (5.3),
 *   the paean/hymn and the impiety indictment (5.4-5, the hymn's poet
 *   attribution lives in verse-authors.ts), the three-year stay dated
 *   by Theophilus (5.9), Theocritus' mocking epigram (5.11), and
 *   Plato's sixth epistle to Hermias, Erastus and Coriscus (3.61).
 *   The scope includes 5.1.6 because the Greek accusative of the 5.5
 *   sentence falls there (Hicks/Perseus section drift). Excluded:
 *   Aristippus' catalogue title Hermias (2.84) and the freedman of
 *   Theophrastus' will (5.73), a different bearer kept a literal by
 *   the testament layer;
 * - Nicanor, Aristotle's ward, son of Proxenus of Atarneus: the will's
 *   central figure (betrothed to Pythias' daughter, guardian, statue
 *   and safe-return vow, 5.12-16). NO trustworthy Wikidata item: the
 *   candidate Q1971955 "Nicanor" is Parmenion's son (P22 verified),
 *   a different Macedonian officer, and Q1990046 carries no
 *   description - never guess a homonym, so he stays QID-less. Scoped
 *   to the will sections: "Seleucus Nicanor" (2.124) is the king's
 *   epithet (Nicator), Theophrastus' correspondent (5.50) is an
 *   uncertain bearer, and the Nicanor of Epicurus' will (10.20) is a
 *   different man. The testament layer's cast literals are untouched:
 *   beneficiaries stay literals by design.
 *
 * Hesiod and Pisistratus are deliberately NOT in this table: both
 * already exist as minted sources-index authorities, so a MentionPerson
 * would double the label. Their tags are curated in source-mentions.ts;
 * this batch extended Hesiod's English refs from the two original
 * mentions to all twelve verified poet sections, and Pisistratus
 * (Q242172, the tyrant of Athens) from the 1.53 letter to all
 * seventeen verified Book 1 sections in both languages - Pisistratus
 * of Ephesus (2.60), who denied Aeschines' dialogues, is a different
 * man and stays untagged, and the patronymic plural Pisistratidae
 * (1.49) is not a form of the name.
 *
 * Sceptic succession (added July 2026): the pupils of Pyrrho (9.68-69),
 * the pupils of Timon and the unbroken teacher chain down to Saturninus
 * (9.115-116), the later Academy handover (4.60), and the Sceptic
 * author Apellas (9.106). Their teacher links live in
 * succession-links.ts; their school memberships in school-members.ts.
 *
 * Stoic pupil network (Hippobotus' list, 7.38): five pupils of Zeno of
 * Citium named by Hippobotus - Philonides of Thebes, Callippus of
 * Corinth, Posidonius of Alexandria, Athenodorus of Soli, and Zeno of
 * Sidon (the Stoic). None has a trustworthy Wikidata item free of
 * homonym risk, so all stay QID-less (curation policy: never guess a
 * homonym). Tagging safety: bare "Posidonius" belongs to the existing
 * Posidonius source node (of Apamea), bare "Athenodorus" to the
 * existing Athenodorus source, bare "Zeno" to Zeno of Citium / Zeno of
 * Elea - all three are in MENTION_BARE_NAME_SUPPRESSED. Greek forms are
 * suppressed in GREEK_NAME_SKIPS for the same three. "Philonides of
 * Thebes" is very likely the Philonides Zeno sends to Antigonus at
 * 7.8-9 alongside Persaeus; his bare first word is clean. "Callippus
 * of Corinth" has no homonym risk at the bare level.
 * QIDs verified July 2026 via the Wikidata API (label, description,
 * movement P135, student/teacher P802/P1066 all cross-checked against
 * D.L.'s chain); Eurylochus, Sarpedon, Heraclides, Zeuxippus, Zeuxis,
 * Theiodas, Saturninus and Apellas have no trustworthy items and stay
 * QID-less. Homonym notes for this batch:
 * - Eurylochus the pupil of Pyrrho (9.68) shares his name with the
 *   Larissaean youth Socrates refused (2.25), a dining companion of
 *   Menedemus (2.127), and the addressee of an Epicurus letter
 *   (10.13, cited again at 10.28), so his tags are scoped to 9.11.68
 *   via `onlySections`;
 * - "Dioscurides of Cyprus", "Eubulus of Alexandria", "Ptolemy of
 *   Cyrene", "Heraclides the Sceptic", "Herodotus of Tarsus" and
 *   "Zeuxis Goniopus" are in MENTION_BARE_NAME_SUPPRESSED below:
 *   their bare first words belong to other bearers (the source
 *   Dioscurides at 1.63 etc., the source Eubulus at 6.30-31, the
 *   kings Ptolemy, the source Heraclides Lembus, the blocklisted
 *   Herodotus, the source Zeuxis at 9.106), and an auto-generated
 *   bare candidate would collide with them and silently kill their
 *   tags. The verified bare occurrences inside 9.114/9.116 are
 *   re-admitted as curated scoped entries in gazetteer.ts;
 * - "Heraclides the Sceptic" and "Zeuxis Goniopus" are curatorial
 *   labels (D.L. gives no ethnic for either; Hicks renders the second
 *   "Zeuxis of the angular foot", goniopous per Cruickshank). Whether
 *   the succession's Zeuxis (9.116) is the Zeuxis who was Aenesidemus'
 *   friend and wrote On Two-sided Arguments (9.106, a cited source
 *   node) is not decidable from the text, so the two stay separate
 *   nodes - never conflate uncertain homonyms;
 * - Euphranor of Seleucia is scoped to 9.12.115-116 via `onlySections`
 *   so his bare first word cannot tag the freedman Euphranor of
 *   Theophrastus' will (5.73); inside 9.116 the bare "Euphranor had
 *   as pupil" occurrence is his, and the scope admits it;
 * - Apellas the Sceptic author is cited at 9.106 for his Agrippa;
 *   the book title itself stays tagged to the person/agrippa book
 *   note above.
 *
 * Kings and tyrants batch (added July 2026, from the proper-noun
 * audit's top untagged candidates; every occurrence of each bare name
 * classified per section against BOTH the Hicks English and the
 * Perseus Greek, QIDs verified via the Wikidata API):
 * - Alexander the Great = Q8409. Scoped to the 29 sections where the
 *   bearer is the king beyond doubt (chronology anchors, the
 *   Aristotle and Anaxarchus narratives, the Diogenes exchanges, the
 *   letters at 10.1). Excluded, stay untagged: the work titles
 *   'Alexander or a plea for colonies' (5.22) and 'Concerning
 *   Alexander's sacrifice' (8.11), Chrysippus' addressee (7.192,
 *   7.196, bearer unknown), Alexander Aetolus the dramatist (4.59,
 *   9.113), and the Greek-only 1.32 where Ἀλέξανδρος is Paris of
 *   Troy. Bare-name citation formulas of the SOURCE Alexander
 *   (Polyhistor, 'in his Successions') are the other live bearer;
 *   they tag through their own curated scoped entries in
 *   gazetteer.ts, disjoint from this scope;
 * - Dionysius the Elder = Q332750, tyrant of Syracuse, son of
 *   Hermocrates: only 3.18, where D.L. names the filiation outright,
 *   is decidable to the father. 3.21 MIXES the two tyrants in one
 *   section (the Elder's letter-writing, then Plato's second voyage
 *   to the younger Dionysius) and section scoping cannot split a
 *   mixed section, so it stays untagged for both (same policy as the
 *   two Cyruses at 6.84);
 * - Dionysius the Younger = Q380453: the Aeschines stay in Syracuse
 *   until Dion's return and the expulsion (2.61, 2.63), Plato's third
 *   voyage to reconcile Dion and Dionysius (3.23), Dion's expedition
 *   (3.25), the tyrant's end in Corinth (3.34), the four Platonic
 *   epistles to him (3.61), Speusippus' Epistles to Dion, Dionysius
 *   and Philip (4.5), Xenocrates at his court - the golden crown at
 *   the Choes and the head-threat retort (4.8, 4.11) - and Archytas'
 *   letter that saved Plato (8.79). Deliberately untagged as
 *   undecidable between the two tyrants: the whole Aristippus court
 *   block (2.66-84), Plato's eighty talents (3.9), Aristippus'
 *   standing at court (3.36), the derisive letter about Plato's
 *   pupils (4.2), the Diogenes exchanges (6.26, 6.50, 6.58), the
 *   Philolaus purchase (8.85), and Epicurus' 'toadies of Dionysius'
 *   jibe (10.8). Other bearers excluded: the Renegade and the Stoic
 *   (existing nodes), Dionysius of Halicarnassus and the 8.47 source
 *   citation, Dionysius of Chalcedon (2.106), the dialectician
 *   (2.98), Plato's schoolmaster (3.4) and the slave of his will
 *   (3.42), the work titles at 5.81 and 5.88, and the book-forger of
 *   6.100;
 * - Ptolemy Soter = Q168261, king of Egypt, son of Lagus: Theodorus'
 *   embassy and disgrace (2.102), Diodorus Cronus at his court
 *   (2.111), Stilpo carried off at the capture of Megara (2.115),
 *   the invitation Theophrastus declined (5.37), and Demetrius of
 *   Phalerum's Egyptian exile, the regency advice and the death by
 *   asp under Philadelphus (5.78-79). Excluded, stay untagged: the
 *   Menedemus embassy (2.140) and the kings of 5.83, 7.24, 7.185 and
 *   7.186 (undecidable which Ptolemy), Philadelphus (5.58, 9.110)
 *   and Philopator (7.177, incl. the bare follow-ups in the same
 *   section), the work title at 5.81, Ptolemy of Cyrene (9.115-116,
 *   existing node), and the Greek-only Epicurean Ptolemies of
 *   Alexandria, the Black and the White (10.25).
 */

export interface MentionPerson {
  /** English surface form as it appears in Hicks' translation. */
  label: string;
  /** rdfs:comment for the LOD node. */
  comment: string;
  /** Verified Wikidata QID; absent when no trustworthy item exists. */
  qid?: string;
  /**
   * Curator-pinned section scope: the name may only tag inside these
   * section ids (both languages). Used when the same name belongs to
   * several bearers in the corpus (Aristodemus). Verified against the
   * corpus at curation time and pinned by validate-annotations.
   */
  onlySections?: string[];
}

export const MENTION_PERSONS: MentionPerson[] = [
  {
    label: "Acusilaus",
    comment:
      "Acusilaus of Argos, son of Cabas or Scabras, the logographer; added to the Seven Sages by some (1.41) and one of Hermippus' seventeen candidates (1.42).",
    qid: "Q423894",
  },
  {
    label: "Aeschylus",
    comment:
      "Aeschylus, the Athenian tragedian; the Athenians honoured Astydamas before him with a bronze statue (2.43), Menedemus gave him the first place among tragic poets (2.133), and he added the second actor in the growth of tragedy (3.56). Distinct from Menedemus' Eretrian opponent of the same name (2.141) and from the addressee of Theophrastus' 'In reply to Aeschylus' (5.50).",
    qid: "Q40939",
    onlySections: ["2.5.43", "2.17.133", "3.1.56"],
  },
  {
    label: "Agrippa",
    comment:
      "Agrippa, the Sceptic philosopher to whose school Diogenes Laertius credits the five later modes of suspension of judgement - disagreement, regress ad infinitum, relativity, hypothesis, and circular reasoning (9.88). Distinct from the homonymous book by Apellas, 'in his Agrippa' (9.106), which is titled after him.",
    qid: "Q365115",
    onlySections: ["9.11.88"],
  },
  {
    label: "Alcibiades",
    comment:
      "Alcibiades, the Athenian statesman of Socrates' circle: Socrates resigned the prize of valour to him (2.23), he offered Socrates a building site (2.24), his beauty was scorned (2.31), he judged Xanthippe intolerable (2.36-37), Socrates induced him or Crito to ransom Phaedo (2.105), and Bion censured Socrates over him and abused his youth (4.49). Tags are scoped: the name elsewhere is dialogue titles by Antisthenes, Aeschines, Euclides and Plato (2.61, 2.108, 3.51, 3.59, 3.62, 6.18).",
    qid: "Q187982",
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
  {
    label: "Alexander the Great",
    comment:
      "Alexander the Great, king of Macedon, pupil of Aristotle: the chronology anchors (1.prol.2, 10.1), Anaximenes' letters (2.3), the letter of Aristotle's Rhetoric dedication era and the tutorship (5.2-10), the Theophrastus and Demetrius links (5.37 era, 5.75), the Diogenes exchanges culminating in 'stand out of my light' (6.32-79 passim), the Anaxarchus and Pyrrho narratives (9.58-61, 9.80), and Onesicritus' voyage (6.84). Tags are scoped: bare 'Alexander' elsewhere is the source Alexander Polyhistor's citation formulas (its own curated scoped entries), Chrysippus' addressee (7.192, 7.196), Alexander Aetolus the dramatist (4.59, 9.113), work titles (5.22, 8.11), and the Greek-only Paris of Troy (1.32).",
    qid: "Q8409",
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
    label: "Apellas",
    comment:
      "Apellas, a Sceptic author; in his work titled Agrippa he holds, with Zeuxis and Antiochus of Laodicea, to phenomena alone as the Sceptic's criterion (9.106).",
  },
  {
    label: "Aratus",
    comment:
      "Aratus of Soli, the didactic poet of the Phaenomena; welcomed at Menedemus' symposia (2.133), admired and emulated by Dionysius the Renegade (7.167), and advised by Timon to use the oldest copies of Homer (9.113).",
    qid: "Q180671",
  },
  {
    label: "Aristocreon",
    comment:
      "Aristocreon, Chrysippus' sister's son, whom Chrysippus sent for and educated (7.185); addressee of many works in Chrysippus' catalogue, among them Of the Mentiens Argument, Of Dialectic, and Of the Good or Morally Beautiful and Pleasure (7.196-202).",
    qid: "Q2572655",
  },
  {
    label: "Aristodemus",
    comment:
      "Aristodemus of Sparta, adjudged wisest of the Greeks in the tripod story but retiring in favour of Chilon (1.30), praised by Alcaeus (1.31); among Dicaearchus' six further candidates for the Seven Sages (1.41) and Hermippus' seventeen (1.42).",
    onlySections: ["1.1.30", "1.1.31", "1.1.41", "1.1.42"],
  },
  {
    label: "Asclepiades of Phlius",
    comment:
      "Asclepiades of Phlius, the philosopher of the Eretrian school, inseparable friend of Menedemus of Eretria: he drew Menedemus away to Stilpo at Megara (2.126), shared his perils at Nicocreon's court (2.129-130), built houses with him (2.131), married the daughter while Menedemus married the mother (2.137), and died first at Eretria at a great age (2.138). His tags are scoped because the Greek accusative at 8.61 is the patronymic 'descendant of Asclepius' in Empedocles' epigram, not this man.",
    qid: "Q2087377",
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
  {
    label: "Athenodorus of Soli",
    comment:
      "Athenodorus of Soli, one of the five pupils of Zeno of Citium named by Hippobotus (7.38). Distinct from the existing Athenodorus source node (author of the Walks).",
  },
  {
    label: "Callippus of Corinth",
    comment:
      "Callippus of Corinth, one of the five pupils of Zeno of Citium named by Hippobotus (7.38).",
  },
  {
    label: "Chabrinus",
    comment:
      "Father of Lasos of Hermione according to Aristoxenus (1.42).",
  },
  {
    label: "Charmantides",
    comment: "Father of Lasos of Hermione by one account (1.42).",
  },
  {
    label: "Croesus",
    comment:
      "Croesus, the king of Lydia: Thales advised Miletus against his alliance (1.25), his golden goblet and bowl went the round of the sages (1.29-30), Solon visited his court and letters passed between them (1.50-51, 1.67), Pittacus refused his money (1.75, 1.77, 1.81), Anacharsis wrote to him (1.105), and his fall anchors the chronology of Thales and Solon (1.38, 1.95). Every corpus occurrence is the king, so the tags are unscoped.",
    qid: "Q184462",
  },
  {
    label: "Cyrus the Younger",
    comment:
      "Cyrus the Younger, the Achaemenid prince of the Anabasis: Proxenus introduced Xenophon to him (2.49-50), his mercenaries were handed over to Agesilaus after the failed expedition (2.51), the march up country is dated by Xenaenetus' archonship (2.55), and the exile epigram names him (2.58). Tags are scoped to those sections: bare Cyrus elsewhere is Cyrus the Great (1.25, 3.34, both deliberately untagged - see the module header), an Antisthenes title (2.61, 6.16, 6.18), the Cyropaedia (2.57, 3.34), or both men mixed inside 6.84.",
    qid: "Q297960",
    onlySections: ["2.6.49", "2.6.50", "2.6.51", "2.6.55", "2.6.58"],
  },
  {
    label: "Dion of Syracuse",
    comment:
      "Dion of Syracuse, Plato's friend, patron and pupil: he defrayed Plato's choregia at Athens (3.3), bought the Pythagorean books at his request (3.9, 8.84), interceded for him with Dionysius (3.19), joined the Academy roster (3.46), received Plato's epistles (3.61), and Plato wrote epigrams on him (3.29-30); Speusippus addressed Epistles to him (4.5). Tags are scoped to his unambiguous sections: bare Dion elsewhere is the verse addressee at 1.80, the freed slave of Theophrastus' will (5.73), Timocrates' book title (7.2), Dion of Paeania (7.12), the Stoic logic stock example (7.65-79), or the addressee of Chrysippus' works (7.190, 7.192).",
    qid: "Q457885",
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
  {
    label: "Dionysius the Elder",
    comment:
      "Dionysius the Elder, tyrant of Syracuse, son of Hermocrates; Plato's first Sicilian voyage was to his court, and the quarrel over tyranny ended with Plato handed to Pollis for sale (3.18-20). Tags are scoped to 3.18, the one section where D.L. names the filiation and the bearer is the father beyond doubt; 3.21 mixes both tyrants in one section and stays untagged, and every bare 'Dionysius' undecidable between the two tyrants (the Aristippus court block 2.66-84 and the rest) stays untagged by design.",
    qid: "Q332750",
    onlySections: ["3.1.18"],
  },
  {
    label: "Dionysius the Younger",
    comment:
      "Dionysius the Younger, tyrant of Syracuse, son of Dionysius the Elder: Aeschines lived with him until the expulsion (2.61-63), Plato's second and third voyages sought Dion's recall and their reconciliation (3.21-25), he ended as a private citizen in Corinth (3.34), four Platonic epistles address him (3.61), Speusippus wrote Epistles to him (4.5), Xenocrates attended his court (4.8, 4.11), and Archytas' letter saved Plato from him (8.79). Tags are scoped to the sections where the bearer is the son beyond doubt; the mixed 3.21 and all occurrences undecidable between the two tyrants stay untagged, as do the other bearers (the Renegade, the Stoic, Halicarnassus, Chalcedon, the dialectician, the schoolmaster, the slave, the work titles).",
    qid: "Q380453",
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
    label: "Dioscurides of Cyprus",
    comment:
      "Dioscurides of Cyprus, disciple of Timon of Phlius; one-eyed like his master (9.114), and first in the pupil list Hippobotus and Sotion give (9.115).",
    qid: "Q18607032",
  },
  {
    label: "Eubulus of Alexandria",
    comment:
      "Eubulus of Alexandria, Sceptic, pupil of Euphranor of Seleucia and teacher of Ptolemy of Cyrene (9.116).",
    qid: "Q992271",
  },
  {
    label: "Euphranor of Seleucia",
    comment:
      "Euphranor of Seleucia, Sceptic; a pupil of Timon according to Hippobotus and Sotion (9.115), and teacher of Eubulus of Alexandria (9.116). Distinct from Euphranor the freedman of Theophrastus' will (5.73).",
    qid: "Q11921190",
    onlySections: ["9.12.115", "9.12.116"],
  },
  {
    label: "Eurylochus",
    comment:
      "Eurylochus, a pupil of repute of Pyrrho who fell short of his professions: once so angry that he seized the spit with the meat on it and chased his cook into the market-place (9.68). Distinct from the Larissaean youth (2.25), Menedemus' dining companion (2.127), and the addressee of Epicurus' letter (10.13, 10.28).",
    onlySections: ["9.11.68"],
  },
  {
    label: "Eurytus",
    comment:
      "Eurytus of Tarentum, the Pythagorean; Plato travelled to Italy to see the Pythagorean philosophers Philolaus and Eurytus (3.6), and with Philolaus he was one of the teachers of the last Pythagoreans seen by Aristoxenus - Xenophilus, Phanton, Echecrates, Diocles and Polymnastus (8.46).",
    qid: "Q1378597",
  },
  {
    label: "Evander",
    comment:
      "Evander of Phocaea, Academic; Lacydes in his lifetime handed over the school to him and Telecles (4.60), and Evander was succeeded by Hegesinus of Pergamum.",
    qid: "Q2705204",
  },
  {
    label: "Heraclides the Sceptic",
    comment:
      "Heraclides, Sceptic, pupil of Ptolemy of Cyrene alongside Sarpedon, and teacher of Aenesidemus of Cnossus, the compiler of the Pyrrhonean Discourses (9.116). The label is curatorial: D.L. gives no ethnic, and the bare name belongs to several other bearers in the corpus.",
  },
  {
    label: "Hermias",
    comment:
      "Hermias, the tyrant of Atarneus, Aristotle's kinsman by marriage: the affection stories from Demetrius of Magnesia (5.3), the paean or hymn and the resulting impiety indictment (5.4-5), the three-year stay dated by Theophilus' archonship (5.9), Theocritus of Chios' mocking epigram (5.11), and Plato's sixth epistle addressed to him with Erastus and Coriscus (3.61). Scoped: Aristippus' catalogue title Hermias (2.84) and the freedman of Theophrastus' will (5.73) are different bearers; 5.1.6 is in the scope because the Greek accusative of the 5.5 sentence falls there.",
    qid: "Q948620",
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
  {
    label: "Herodotus of Tarsus",
    comment:
      "Herodotus of Tarsus, son of Arieus; pupil of the empiric physician Menodotus of Nicomedia and teacher of Sextus Empiricus (9.116).",
    qid: "Q18603905",
  },
  {
    label: "Isocrates",
    comment:
      "Isocrates, the Athenian orator and teacher of rhetoric: born in the archonship of Lysimachus, six years Plato's senior (3.3), and Plato's friend (3.8); his school produced rhetoricians (2.15, 2.64, 4.23, 5.61) and Speusippus first divulged what he called his secrets (4.2, Hicks 4.3); Antisthenes wrote against him and his Speech without Witnesses (6.15), and a Sicilian rhetorician answered his Panegyric (5.35). Hermippus says he too wrote an encomium on Gryllus (2.55).",
    qid: "Q221182",
  },
  {
    label: "Lamiscus",
    comment:
      "Lamiscus the Pythagorean, sent by Archytas with Photidas to Dionysius II to take Plato away under the agreed terms (letter at 3.22); Archytas' letter to Plato reports news of his recovery through him (8.80).",
    qid: "Q3826494",
  },
  {
    label: "Lasos",
    comment:
      "Lasos of Hermione, son of Charmantides or Sisymbrinus (or, per Aristoxenus, of Chabrinus), the lyric poet; one of Hermippus' seventeen candidates for the Seven Sages (1.42).",
    qid: "Q1128200",
  },
  {
    label: "Leonteus",
    comment:
      "Leonteus of Lampsacus, eminent disciple of Epicurus and husband of Themista (10.25); Epicurus' playful letter to Themista offers to wheel round to wherever she and Leonteus summon him (10.5), and one of the three other bearers of the name Epicurus was the son of Leonteus and Themista (10.26).",
    qid: "Q1225067",
  },
  {
    label: "Leophantus",
    comment:
      "Leophantus, son of Gorgiadas, of Lebedus or Ephesus; included among the Seven Sages by Maeandrius (1.41) and one of Hermippus' seventeen candidates (1.42).",
  },
  {
    label: "Philonides of Thebes",
    comment:
      "Philonides of Thebes, one of the five pupils of Zeno of Citium named by Hippobotus (7.38). Very likely the Philonides Zeno sent to Antigonus Gonatas alongside Persaeus in his declining letter (7.8-9).",
  },
  {
    label: "Nicanor",
    comment:
      "Nicanor, Aristotle's ward, the son of Proxenus of Atarneus: the central figure of Aristotle's will - betrothed to the testator's daughter, charged with the household until his return, honoured with statues and a safe-return vow (5.12-16). No Wikidata QID: the candidate items conflate him with Nicanor son of Parmenion (a different Macedonian officer), and a homonym is never guessed. Scoped to the will sections: Seleucus' epithet Nicanor (2.124), Theophrastus' correspondent (5.50, uncertain bearer) and the Nicanor of Epicurus' will (10.20) are different men.",
    onlySections: ["5.1.12", "5.1.13", "5.1.14", "5.1.15", "5.1.16"],
  },
  {
    label: "Nicolochus of Rhodes",
    comment:
      "Nicolochus of Rhodes, a pupil of Timon of Phlius according to Hippobotus and Sotion (9.115).",
    qid: "Q18607049",
  },
  {
    label: "Philip II of Macedon",
    comment:
      "Philip II of Macedon: his accession dates Xenophon's death (2.56), he honoured Plato at his death (3.40), Speusippus wrote him the famous letter (4.5), Xenocrates refused his bribes on the Athenian embassy (4.8-9), Aristotle went as envoy to him (5.2), tutored Alexander at his request (5.4), visited his court under Pythodotus' archonship (5.10) and addressed Letters to Philip (5.27); Diogenes was seized after Chaeronea and brought before him (6.43), and Hipparchia's suitors are compared to his conquests (6.88). Scoped: bare Philip elsewhere is Philip V of Macedon (5.61), Chrysippus' addressee (7.193), Philip the Megarian (1.16, 2.113 in the Greek), Philip of Opus (3.37, 3.46 in the Greek), or a witness of Plato's will (3.41-42).",
    qid: "Q130650",
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
  {
    label: "Photidas",
    comment:
      "Photidas the Pythagorean of Tarentum, sent by Archytas with Lamiscus to Dionysius II to take Plato away under the agreed terms (letter at 3.22).",
    qid: "Q138771346",
  },
  {
    label: "Polyaenus",
    comment:
      "Polyaenus, son of Athenodorus, a citizen of Lampsacus, eminent disciple of Epicurus, a just and kindly man as Philodemus and his pupils affirm (10.24); Epicurus' will endows the annual commemoration of him in Metageitnion (10.18) and provides for his son (10.19). Distinct from the uncertain Polyaenus to whom some ascribed Phaedo's dialogue Medius (2.105).",
    qid: "Q740432",
    onlySections: ["10.1.18", "10.1.19", "10.1.24"],
  },
  {
    label: "Posidonius of Alexandria",
    comment:
      "Posidonius of Alexandria, one of the five pupils of Zeno of Citium named by Hippobotus (7.38). Distinct from the Stoic philosopher Posidonius of Apamea, an existing source node in the corpus.",
  },
  {
    label: "Praÿlus of the Troad",
    comment:
      "Praÿlus of the Troad, a pupil of Timon of Phlius according to Hippobotus and Sotion; a man of such unflinching courage, as Phylarchus relates, that although unjustly accused he patiently suffered a traitor's death without deigning to speak one word to his fellow-citizens (9.115).",
    qid: "Q18607109",
  },
  {
    label: "Ptolemy of Cyrene",
    comment:
      "Ptolemy of Cyrene, Sceptic; according to Menodotus the school of Timon lapsed until Ptolemy re-established it (9.115). Pupil of Eubulus of Alexandria and teacher of Sarpedon and Heraclides (9.116). Bare 'Ptolemy' in the corpus otherwise names the kings, so only the full name tags outside the curated 9.116 entry.",
    qid: "Q18607169",
  },
  {
    label: "Ptolemy Soter",
    comment:
      "Ptolemy I Soter, king of Egypt, son of Lagus: Theodorus' embassy to Lysimachus and his disgrace (2.102), Diodorus Cronus' dialectic defeat at his court (2.111), Stilpo carried off at the capture of Megara (2.115), the invitation Theophrastus declined (5.37), and Demetrius of Phalerum's Egyptian exile and fatal regency advice (5.78-79). Tags are scoped: bare 'Ptolemy' elsewhere is a king undecidable among the dynasty (2.140, 5.83, 7.24, 7.185-186), Philadelphus (5.58, 9.110), Philopator (7.177), a work title (5.81), or Ptolemy of Cyrene the Sceptic (9.115-116).",
    qid: "Q168261",
    onlySections: [
      "2.8.102",
      "2.10.111",
      "2.11.115",
      "5.2.37",
      "5.5.78",
      "5.5.79",
    ],
  },
  {
    label: "Pythodotus",
    comment:
      "Pythodotus, eponymous archon of Athens 343/2 BCE; D.L. dates Aristotle's departure to Philip's court by his archonship, in the second year of the 109th Olympiad (5.10).",
    qid: "Q138786485",
  },
  {
    label: "Sarpedon",
    comment:
      "Sarpedon, Sceptic, pupil of Ptolemy of Cyrene alongside Heraclides (9.116).",
  },
  {
    label: "Saturninus",
    comment:
      "Saturninus called Cythenas, an empiricist, pupil of Sextus Empiricus and last name in the Sceptic succession Diogenes Laertius records (9.116).",
  },
  {
    label: "Sisymbrinus",
    comment: "Father of Lasos of Hermione by one account (1.42).",
  },
  {
    label: "Telecles",
    comment:
      "Telecles of Phocaea, Academic; Lacydes in his lifetime handed over the school to him and Evander (4.60).",
    qid: "Q2706119",
  },
  {
    label: "Theiodas of Laodicea",
    comment:
      "Theiodas of Laodicea, Sceptic, pupil of Antiochus of Laodicea on the Lycus alongside the empiric physician Menodotus of Nicomedia (9.116).",
  },
  {
    label: "Themista",
    comment:
      "Themista, wife of Leonteus of Lampsacus, an eminent member of Epicurus' circle to whom he wrote letters (10.25); part of one letter to her survives (10.5), and his catalogue includes the Neocles, dedicated to Themista (10.28).",
    qid: "Q1229024",
  },
  {
    label: "Zeno of Sidon",
    comment:
      "Zeno of Sidon, one of the five pupils of Zeno of Citium named by Hippobotus (7.38), a Stoic. Distinct from the later Epicurean Zeno of Sidon (Epicurus' pupil at 10.25), and from Zeno of Citium and Zeno of Elea. Bare 'Zeno' in the corpus names one of the philosopher KG nodes, so only the full compound form tags.",
  },
  {
    label: "Zeuxippus",
    comment:
      "Zeuxippus of Cnossus, Sceptic, fellow-citizen and pupil of Aenesidemus, and teacher of Zeuxis of the angular foot (9.116).",
  },
  {
    label: "Zeuxis Goniopus",
    comment:
      "Zeuxis 'of the angular foot' (goniopous, Cruickshank's reading at 9.116), Sceptic, pupil of Zeuxippus and teacher of Antiochus of Laodicea on the Lycus. Whether he is the Zeuxis who was Aenesidemus' friend and wrote On Two-sided Arguments (9.106) the text does not say, so the two stay separate nodes.",
  },
];

/**
 * Labels whose auto-generated bare first word (gazetteer.ts) is
 * SUPPRESSED: the bare name belongs to other bearers in the corpus
 * (existing source nodes, the kings Ptolemy, the blocklisted
 * Herodotus), and letting the candidate join their bucket would make
 * the surface ambiguous and silently kill the existing bearer's tags.
 * Verified bare occurrences inside the Sceptic succession sections are
 * re-admitted as curated scoped entries in gazetteer.ts.
 */
export const MENTION_BARE_NAME_SUPPRESSED: ReadonlySet<string> = new Set([
  "Dioscurides of Cyprus",
  "Eubulus of Alexandria",
  "Ptolemy of Cyrene",
  "Heraclides the Sceptic",
  "Herodotus of Tarsus",
  "Zeuxis Goniopus",
  // Hippobotus' 7.38 Stoic pupils: bare first words belong to existing nodes.
  // "Posidonius" -> existing Posidonius source (of Apamea).
  "Posidonius of Alexandria",
  // "Athenodorus" -> existing Athenodorus source (author of the Walks).
  "Athenodorus of Soli",
  // "Zeno" -> Zeno of Citium / Zeno of Elea (KG philosopher nodes).
  "Zeno of Sidon",
  // Kings and tyrants batch (July 2026): bare first words are
  // multi-bearer in the text (the source Alexander Polyhistor, the two
  // tyrants of Syracuse plus the Renegade and the Stoic, the Ptolemaic
  // kings and Ptolemy of Cyrene). The verified bare occurrences are
  // re-admitted as curated scoped entries in gazetteer.ts.
  "Alexander the Great",
  "Dionysius the Elder",
  "Dionysius the Younger",
  "Ptolemy Soter",
]);
