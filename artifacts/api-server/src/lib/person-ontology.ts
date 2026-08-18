/**
 * Person ontology: a curated role layer over every person-like node in
 * the graph - the 82 corpus philosophers (lo:Philosopher), the 71
 * foaf:Person nodes (claim persons, rival saying attributees, verse
 * poets, mention-only persons) and the 208 lo:Source authorities.
 *
 * Design (mirrors the epistle authenticity layer, NOT the place
 * ontology): roles are INDIVIDUALS of a `lo:Role` class linked via
 * `lo:hasRole`, never rdf classes. The gazetteer derives entity kinds
 * from the six node classes (lo:Philosopher, foaf:Person, lo:Source, …)
 * and the annotation pins depend on that, so the class hierarchy
 * must not change; a role individual is invisible to kind detection.
 *
 * Curation policy (same discipline as the place/QID layers):
 *  - roles come from what Diogenes Laertius' text says about the person
 *    or from an uncontroversial standard identification (the workbook's
 *    curated enwiki/description where present);
 *  - a person may carry 1–3 roles, dominant first;
 *  - `[]` means "identifiable role unknown or deliberately unasserted"  - 
 *    obscure authorities known only from a single citation, ambiguous
 *    bare names conflating several bearers, collectives, non-persons,
 *    and trades outside the closed union. Every `[]` is a decision, not
 *    an omission: lod.ts throws on any node label missing from this
 *    table AND on any table entry matching no node, so the layer can
 *    never silently go stale.
 *
 * The closed role union (14). Deliberately small; trades D.L. mentions
 * but the union does not cover are left `[]` and noted inline:
 * painters (Melanthios, Theophanes), an architect (Archytas the
 * Architect), a calculator (Apollodorus the Arithmetician), a music
 * theorist (Damon). "priest" is gender-neutral and covers Themistoclea
 * the Delphic priestess and Manetho the Egyptian priest.
 *
 * Notable judgment calls, documented once here:
 *  - bare source "Heraclides" conflates Heraclides Lembus (10.1, the
 *    Epitome of Sotion; 8.44) with Heraclides Ponticus (8.67-68, On
 *    Diseases) → `[]`, exactly like the gazetteer's homonym skips;
 *  - bare source "Hipparchus" (9.43, Democritus' age): no secure
 *    identification → `[]`;
 *  - bare source "Timocrates" is only "possibly Epicurean" → `[]`,
 *    while the workbook's explicit "Timocrates (Epicurean)" (Metrodorus'
 *    renegade brother, 10.6) is asserted a philosopher;
 *  - saying attributee "Diogenes" (5.19): whichever Diogenes is meant,
 *    every candidate is a philosopher → philosopher;
 *  - "Euphanes of Olynthus" is read as Euphantus of Olynthus (2.110,
 *    Megarian, wrote histories and tragedies) - spelling variance in
 *    the workbook, not a homonym guess;
 *  - "Apollonius of Tyre" is D.L.'s Stoic biographer of Zeno (7.1-2,
 *    7.24), not Apollonius Molon the rhetorician the workbook's
 *    search-link suggests;
 *  - "Cleoboulinai" (a Cratinus comedy title), "Minyas" (an epic poem),
 *    "Croton" (unknown author of The Diver, 9.12), "Magians and
 *    Chaldaeans" (a collective) are not identifiable persons → `[]`;
 *  - "Antisthenes" the source is Antisthenes of Rhodes (Successions),
 *    distinct from the corpus philosopher node of the same label  - 
 *    labels join per node type, so the two never collide.
 */

export type PersonRole =
  | "philosopher"
  | "poet"
  | "comicPoet"
  | "tragicPoet"
  | "historian"
  | "biographer"
  | "chronographer"
  | "successionsWriter"
  | "doxographer"
  | "grammarian"
  | "rhetorician"
  | "physician"
  | "statesman"
  | "priest";

/** Ontology individual (lo:<name>) for each role. */
export const PERSON_ROLE_INDIVIDUAL: Record<PersonRole, string> = {
  philosopher: "PhilosopherRole",
  poet: "PoetRole",
  comicPoet: "ComicPoetRole",
  tragicPoet: "TragicPoetRole",
  historian: "HistorianRole",
  biographer: "BiographerRole",
  chronographer: "ChronographerRole",
  successionsWriter: "SuccessionsWriterRole",
  doxographer: "DoxographerRole",
  grammarian: "GrammarianRole",
  rhetorician: "RhetoricianRole",
  physician: "PhysicianRole",
  statesman: "StatesmanRole",
  priest: "PriestRole",
};

/** Human-readable label for each role individual. */
export const PERSON_ROLE_LABEL: Record<PersonRole, string> = {
  philosopher: "philosopher",
  poet: "poet",
  comicPoet: "comic poet",
  tragicPoet: "tragic poet",
  historian: "historian",
  biographer: "biographer",
  chronographer: "chronographer",
  successionsWriter: "writer of Successions",
  doxographer: "doxographer",
  grammarian: "grammarian",
  rhetorician: "rhetorician",
  physician: "physician",
  statesman: "statesman",
  priest: "priest or priestess",
};

/**
 * Secondary roles for corpus philosophers. Every lo:Philosopher node
 * automatically carries lo:PhilosopherRole; this table adds the other
 * hats D.L. himself gives them. Keys must be corpus philosopher names
 * (lod.ts throws otherwise) and must not repeat "philosopher".
 */
export const PHILOSOPHER_EXTRA_ROLES: Partial<Record<string, PersonRole[]>> = {
  Solon: ["statesman", "poet"],
  Chilon: ["statesman"],
  Pittacus: ["statesman"],
  Cleobulus: ["statesman"],
  Periander: ["statesman"],
  "Demetrius of Phalerum": ["statesman", "rhetorician"],
  Xenophon: ["historian"],
  Epicharmus: ["comicPoet"],
  Empedocles: ["poet"],
  Xenophanes: ["poet"],
  Timon: ["poet"],
  Epimenides: ["poet"],
};

/**
 * Roles for every non-philosopher person and source node, keyed by the
 * node label (labels shared between a foaf:Person and a lo:Source node
 * - Apollodorus, Demetrius of Troezen, Hermarchus - get one entry that
 * serves both, and the referent is the same man in each case).
 */
export const PERSON_ROLES: Record<string, PersonRole[]> = {
  // ---- Claim persons (entity-links persons cited in claims) ----
  Ameinias: ["philosopher"], // Pythagorean who turned Parmenides (9.21)
  Bryson: ["philosopher"], // teacher in Pyrrho's lineage (9.61)
  "Bryson the Achaean": ["philosopher"], // teacher of Crates (6.85)
  "Colotes of Lampsacus": ["philosopher"],
  "Cratylus the Heraclitean": ["philosopher"],
  Damon: [], // music theorist Socrates heard (2.19) - no music role in the union
  "Diogenes of Smyrna": ["philosopher"], // Democritean (9.58)
  Gorgias: ["rhetorician", "philosopher"],
  "Hegesinus of Pergamum": ["philosopher"], // Academic scholarch (4.60)
  "Heraclides of Heraclea": ["philosopher"], // Dionysius' first teacher (7.166)
  Hermarchus: ["philosopher"], // Epicurus' successor
  Hermodamas: [], // Pythagoras' first teacher, Creophylus' descendant (8.2) - no attested genre
  Homer: ["poet"],
  "Magians and Chaldaeans": [], // a collective, not a person
  Metrodorus: ["philosopher"], // Epicurus' disciple (10.22)
  Nausiphanes: ["philosopher"],
  Panthoides: ["philosopher"], // the logician (5.68)
  "Philistion the Sicilian": ["physician"], // Eudoxus' medical teacher (8.86)
  Themistoclea: ["priest"], // the Delphic priestess (8.8, 8.21)
  Theodorus: ["philosopher"], // Theodorus the Atheist (6.97-98)

  // ---- Rival saying attributees ----
  Diogenes: ["philosopher"], // 5.19: rival attribution; every candidate Diogenes is a philosopher
  "Diagoras of Melos": ["poet"], // 6.59: rival attribution; the lyric poet ("the Atheist")

  // ---- Sources named only for sayings (not already claim sources) ----
  Pamphila: ["historian"], // of Epidaurus; her Historical Commentaries (1.68, 2.24)
  Phanias: ["philosopher"], // Phanias of Eresus, Peripatetic (6.8)
  "Zoïlus of Perga": [], // known only from D.L.'s citation (6.37) - nothing else attested

  // ---- Verse authors (poets credited with quoted verses) ----
  Achaeus: ["tragicPoet"], // Achaeus of Eretria
  Alcaeus: ["poet"],
  Alexis: ["comicPoet"],
  Ameipsias: ["comicPoet"],
  Amphis: ["comicPoet"],
  Anaxandrides: ["comicPoet"],
  Antagoras: ["poet"], // Antagoras of Rhodes
  "Antipater of Sidon": ["poet"], // epigrammatist
  Apollodorus: ["chronographer"], // of Athens; his Chronicle was in verse (also a claim source)
  Archilochus: ["poet"],
  Aristophanes: ["comicPoet"],
  Aristophon: ["comicPoet"],
  "Athenaeus the epigrammatist": ["poet"],
  Callias: ["comicPoet"], // the comic poet (2.18)
  Callimachus: ["poet", "grammarian"], // epigrams and the Pinakes
  Cercidas: ["poet"], // meliambic poet of Megalopolis
  Cratinus: ["comicPoet"],
  "Cratinus the Younger": ["comicPoet"],
  "Demetrius of Troezen": ["grammarian"], // also a claim source; the grammatikos
  "Demetrius the epic poet": ["poet"],
  "Demodicus of Leros": ["poet"], // elegist (spelling of the verse layer)
  Diodotus: ["grammarian"], // the grammarian, on Heraclitus' book (9.12)
  "Diogenes Laertius": ["biographer", "poet"], // the author; his Pammetros epigrams
  Eupolis: ["comicPoet"],
  Euripides: ["tragicPoet"],
  Hipponax: ["poet"],
  "Ion of Chios": ["tragicPoet"],
  Linus: ["poet"], // the mythical singer
  Lycophron: ["tragicPoet"],
  Menander: ["comicPoet"],
  Mimnermus: ["poet"],
  Mnesimachus: ["comicPoet"],
  Phrynichus: ["tragicPoet"], // the early tragedian, per the verse layer's note
  Simonides: ["poet"], // of Ceos
  Sophocles: ["tragicPoet"],
  Sositheus: ["tragicPoet"], // of the Pleiad
  Theaetetus: ["poet"], // the Hellenistic epigrammatist
  "Theocritus of Chios": ["poet", "rhetorician"], // the epigram against Aristotle (5.11)
  "Theopompus the comic poet": ["comicPoet"],
  "Zenodotus the Stoic": ["philosopher", "poet"], // epigram on Zeno (7.30)

  // ---- Mention-only persons (person-mentions.ts) ----
  Acusilaus: ["historian"], // early genealogist (1.41)
  Aeschylus: ["tragicPoet"], // the Athenian tragedian (2.43, 2.133, 3.56)
  // Agrippa (mention-person, 9.88) shares the minted-source entry below.
  Apellas: ["philosopher"], // Sceptic author of the Agrippa (9.106)
  Aratus: ["poet"], // Aratus of Soli, the Phaenomena (2.133, 7.167, 9.113)
  Aristocreon: ["philosopher"], // Chrysippus' nephew, educated by him and addressee of his works (7.185, 7.196-202)
  Aristodemus: [], // rival Seven-Sages candidate, nothing further attested
  "Asclepiades of Phlius": ["philosopher"], // Eretrian school, Menedemus' inseparable friend (2.105, 2.126-138, 6.91)
  Alcibiades: ["statesman"], // the Athenian, of Socrates' circle (2.23-37, 2.105, 4.49)
  "Alexander the Great": ["statesman"], // king of Macedon, Aristotle's pupil (5.2-10, 6.32-79, 9.58-80)
  Chabrinus: [], // named only as Lasos' father candidate
  Charmantides: [], // named only as Lasos' father candidate
  Croesus: ["statesman"], // the king of Lydia (book 1 passim)
  "Cyrus the Younger": ["statesman"], // Achaemenid prince of the Anabasis (2.49-58)
  "Dion of Syracuse": ["statesman", "philosopher"], // Plato's friend, patron and pupil; aimed at power in Syracuse (3.3-61, 8.84)
  "Dionysius the Elder": ["statesman"], // tyrant of Syracuse, son of Hermocrates (3.18)
  "Dionysius the Younger": ["statesman"], // tyrant of Syracuse, Plato's host (2.61-63, 3.21-34, 4.5-11, 8.79)
  "Dioscurides of Cyprus": ["philosopher"], // Timon's disciple (9.114)
  "Eubulus of Alexandria": ["philosopher"], // Sceptic (9.116)
  "Euphranor of Seleucia": ["philosopher"], // Sceptic (9.115-116)
  Eurylochus: ["philosopher"], // Pyrrho's pupil of repute (9.68)
  Eurytus: ["philosopher"], // Pythagorean of Tarentum; visited by Plato with Philolaus (3.6), teacher of the last Pythagoreans (8.46)
  Evander: ["philosopher"], // Academic scholarch of Phocaea (4.60)
  "Heraclides the Sceptic": ["philosopher"], // teacher of Aenesidemus (9.116)
  Hermias: ["statesman"], // the tyrant of Atarneus, Aristotle's kinsman by marriage (3.61, 5.3-11)
  "Herodotus of Tarsus": ["philosopher"], // pupil of Menodotus, teacher of Sextus Empiricus (9.116)
  Isocrates: ["rhetorician"], // the Athenian orator, Plato's friend and senior (3.3, 3.8)
  Lamiscus: ["philosopher"], // the Pythagorean of Archytas' letters (3.22, 8.80)
  Lasos: ["poet"], // Lasus of Hermione
  Leonteus: ["philosopher"], // eminent Epicurean of Lampsacus, husband of Themista (10.25)
  Leophantus: [], // rival Seven-Sages candidate
  Nicanor: [], // Aristotle's ward, a soldier abroad at the will's date - the union has no military role (5.12-16)
  "Nicolochus of Rhodes": ["philosopher"], // pupil of Timon per Hippobotus and Sotion (9.115)
  "Philip II of Macedon": ["statesman"], // the king (2.56, 3.40, 4.5-9, 5.2-27, 6.43, 6.88)
  Photidas: ["philosopher"], // Pythagorean of Tarentum, Archytas' envoy (3.22)
  Polyaenus: ["philosopher"], // eminent Epicurean, son of Athenodorus of Lampsacus (10.24)
  "Praÿlus of the Troad": ["philosopher"], // pupil of Timon per Hippobotus and Sotion (9.115)
  "Ptolemy Soter": ["statesman"], // king of Egypt, son of Lagus (2.102-115, 5.37, 5.78-79)
  "Ptolemy of Cyrene": ["philosopher"], // re-established the Sceptic school (9.115-116)
  Pythodotus: ["statesman"], // eponymous archon of Athens 343/2, D.L.'s date marker (5.10)
  Sarpedon: ["philosopher"], // pupil of Ptolemy of Cyrene (9.116)
  Saturninus: ["philosopher", "physician"], // "another empiricist", pupil of Sextus Empiricus (9.116)
  Sisymbrinus: [], // named only as Lasos' father candidate
  Telecles: ["philosopher"], // Academic scholarch of Phocaea (4.60)
  "Theiodas of Laodicea": ["philosopher"], // pupil of Antiochus of Laodicea (9.116)
  Themista: ["philosopher"], // eminent Epicurean of Lampsacus, wife of Leonteus, addressee of Epicurus' letters (10.5, 10.25)
  Zeuxippus: ["philosopher"], // Aenesidemus' fellow-citizen and pupil (9.116)
  "Zeuxis Goniopus": ["philosopher"], // pupil of Zeuxippus, teacher of Antiochus (9.116)

  // ---- Claim sources (authorities behind accordingTo) ----
  "Achaïcus": ["philosopher"], // wrote an Ethics (6.99)
  Alcidamas: ["rhetorician"],
  Alexander: ["historian", "successionsWriter"], // Polyhistor, cited for his Successions
  Antigonus: ["biographer"], // of Carystus
  "Antigonus of Carystus": ["biographer"],
  Antisthenes: ["successionsWriter", "historian"], // of Rhodes (Successions) - not the Cynic
  Apollonides: ["grammarian"], // of Nicaea, commentary on Timon's Silloi (9.109)
  Ariston: ["philosopher"], // of Ceos or of Chios - a philosopher either way
  Aristotle: ["philosopher"],
  Aristoxenus: ["philosopher", "biographer"], // Peripatetic; Lives of the philosophers
  Athenodorus: ["philosopher"], // Stoic, his Walks (Peripatoi)
  Ctesiclides: ["chronographer"], // list of archons (2.56)
  Demetrius: ["biographer"], // of Magnesia, Men of the Same Name
  "Demetrius of Magnesia": ["biographer"],
  "Demetrius the Magnesian": ["biographer"],
  Diocles: ["doxographer"], // of Magnesia
  Duris: ["historian"], // of Samos
  "Epicurus (letter to Eurylochus)": ["philosopher"],
  Eratosthenes: ["grammarian", "poet"], // the philologos; wrote the Hermes
  Eumelus: ["historian"], // his Histories, book 5 (5.6)
  Favorinus: ["rhetorician", "historian"], // sophist; Memorabilia, Miscellaneous History
  Hecato: ["philosopher"], // of Rhodes, Stoic
  Heraclides: [], // conflates Lembus (10.1, 8.44) and Ponticus (8.67-68) - see header
  Hermippus: ["biographer"], // of Smyrna, the Callimachean
  Hermodorus: ["philosopher"], // the Platonist (1.8, 2.106)
  Herodotus: ["historian"],
  Hipparchus: [], // 9.43, no secure identification - see header
  Hippobotus: ["doxographer"], // On Philosophical Sects, Register of Philosophers
  Myronianus: ["historian"], // of Amastris, Historical Parallels
  Neanthes: ["historian"], // of Cyzicus
  Nicomachus: ["philosopher"], // son of Aristotle (8.88)
  Persaeus: ["philosopher"], // Zeno's pupil (source node; succession-links.ts)
  // Hippobotus' 7.38 list of Zeno's pupils (mention-persons, person-mentions.ts):
  "Philonides of Thebes": ["philosopher"],
  "Callippus of Corinth": ["philosopher"],
  "Posidonius of Alexandria": ["philosopher"],
  "Athenodorus of Soli": ["philosopher"],
  "Zeno of Sidon": ["philosopher"],
  "Philo of Athens": ["philosopher"], // Pyrrho's friend (9.67)
  Philochorus: ["historian"], // the Atthidographer
  Phlegon: ["historian"], // of Tralles, On Longevity
  Plutarch: ["biographer", "philosopher"], // the Lives (Alexander, Lysander)
  Satyrus: ["biographer"], // the Peripatetic, Lives
  Sosicrates: ["successionsWriter"],
  Sotion: ["successionsWriter"], // the Peripatetic; THE Successions
  Telauges: ["philosopher"], // Pythagoras' son (8.43)
  Theophrastus: ["philosopher"],
  Theopompus: ["historian"], // of Chios
  Thrasylus: ["philosopher"], // the Platonist, editor of Plato and Democritus
  Timaeus: ["historian"], // the Sicilian
  Timocrates: [], // "possibly Epicurean" only - see header
  Xenophanes: ["philosopher", "poet"], // the corpus philosopher cited as an authority

  // ---- Saying-only sources ----
  Dioscurides: [], // his Memorabilia (1.63); identity debated
  Heraclitus: ["philosopher"], // the corpus philosopher cited as an authority
  Bion: ["philosopher"],
  Menippus: ["philosopher"],
  "Dionysius the Stoic": ["philosopher"], // = Dionysius the Renegade (6.43)
  "Apollonius of Tyre": ["philosopher", "biographer"], // Stoic, tabular life of Zeno (7.1-2, 7.24)
  Posidonius: ["philosopher"],

  // ---- Minted sources (sources-index workbook authorities) ----
  Aenesidemus: ["philosopher"], // the Pyrrhonist (workbook's "of Cnossos" rows fold in here)
  // Agrippa: the Skeptic of the five modes - source/person double node
  // (minted workbook authority + mention-person for the 9.88 tags);
  // this one entry serves both.
  Agrippa: ["philosopher"],
  Alcimus: ["historian", "rhetorician"], // the Sicilian, Against Amyntas (3.9)
  Ambryon: [], // known only from his On Theocritus (5.11)
  "Amphicrates of Athens": ["rhetorician", "biographer"], // On Famous Men (2.101)
  Anaxilaides: [], // known only from On Philosophers (3.2)
  "Anaxilas (comic poet)": ["comicPoet"],
  Anaxilaus: [], // identity uncertain
  "Anaximenes of Lampsacus": ["rhetorician", "historian"],
  "Andron of Ephesus": ["historian"], // The Tripod (1.30)
  "Anticlides of Athens (or Anticleides)": ["historian"],
  Antileon: ["chronographer"], // his On Chronology (3.3)
  "Antiochus of Laodicea": ["philosopher"], // Skeptic (9.106)
  "Antipater of Tarsus": ["philosopher"],
  "Antipater of Tyre": ["philosopher"],
  "Antipater of Tyre or Tarsus": ["philosopher"], // compound label; a Stoic either way
  Antiphon: ["biographer"], // On Men of Outstanding Merit (8.3)
  Apelles: ["philosopher"], // Skeptic, his Agrippa (9.106)
  // no "Apollodorus of Athens" entry: the workbook rows citing the
  // chronographer under that name reconcile to the existing source
  // "Apollodorus" (the once-minted duplicate node came from a scrambled
  // row that SOURCE_ROW_CORRECTIONS rehomed to the Cyzicene)
  "Apollodorus of Cyzicus": ["philosopher"], // Democritean (9.38)
  "Apollodorus of Seleucia": ["philosopher"], // Stoic
  "Apollodorus the Arithmetician": [], // the calculator (8.12) - no such role in the union
  "Apollodorus the Epicurean": ["philosopher", "biographer"], // the Kepotyrannos (10.25); Life of Epicurus (10.2)
  "Apollonius Molon": ["rhetorician"],
  Apollophanes: ["philosopher"], // Stoic (7.140)
  Archedemus: ["philosopher"], // of Tarsus, Stoic
  "Archetimos of Syracuse": ["historian"], // the sages' meeting (1.40)
  "Archytas the Architect": [], // D.L. 8.82 distinguishes him - no architect role in the union
  "Aristagoras of Miletus": ["historian"],
  "Aristippus or Pseudo-Aristippus": [], // pseudepigraphic On Ancient Luxury
  "Aristippus the Cyrenaic": ["philosopher"],
  "Aristophanes the Grammarian": ["grammarian"],
  "Artemidorus the Dialectician": ["philosopher"], // Against Chrysippus (9.53)
  "Ascanius of Abdera": [], // known only as a source on Pyrrho (9.61)
  Arcesilaus: ["philosopher"], // of Pitane (Life at 4.28), last hop of the 5.41 transmission chain - source/philosopher double node
  "Athenodorus of Tarsus": ["philosopher"],
  "Boethus of Sidon": ["philosopher"], // the Stoic
  "Cassius the Skeptic": ["philosopher"],
  Chamaeleon: ["philosopher"], // Peripatetic
  Choerilus: ["poet"], // epic poet (1.24)
  "Clearchus of Soli": ["philosopher"], // Peripatetic
  Cleoboulinai: [], // a comedy of Cratinus (1.89), not a person - see header
  Cleomenes: ["philosopher"], // the Cynic, his Paidagogikos (6.75)
  Metrocles: ["philosopher"], // the Cynic (Life at 6.94), cited for the Chreiai - source/philosopher double node
  Clitarchus: ["historian"], // Alexander historian
  Crinis: ["philosopher"], // Stoic logician
  Croton: [], // unknown author of The Diver (9.12) - see header
  "Daimachus of Plataea": ["historian"],
  "Damon of Cyrene": [], // known only from On the Philosophers (1.40)
  "Demetrius of Byzantium": [], // uncertain among D.L.'s twenty Demetrii (2.20)
  "Demodocus of Leros": ["poet"], // the workbook's spelling of the elegist
  "Dicaearchus of Messene": ["philosopher", "historian"], // Peripatetic; Life of Greece
  Didymus: ["grammarian"], // Chalcenterus, Table Talk (5.76)
  Dieuchidas: ["historian"], // the Megarian
  Dinarchus: ["rhetorician"], // the orator
  Dinon: ["historian"], // the Persica
  Diodorus: [], // ambiguous bare name (4.2)
  "Diodorus of Ephesus": [], // known only from 8.70
  "Diogenes of Ptolemais": ["philosopher"], // Stoic (7.41)
  "Diogenes of Seleucia": ["philosopher"], // Diogenes of Babylon, Stoic
  "Diogenes of Tarsus": ["philosopher"], // Epicurean, Select Lectures (10.26)
  "Dionysius of Halicarnassus (?)": [], // attribution itself uncertain
  Dionysodorus: [], // identity uncertain (2.42)
  "Diotimus the Stoic": ["philosopher"],
  "Eleusis (author uncertain)": [], // On Achilles; author uncertain by the label itself
  Ephorus: ["historian"],
  Epictetus: ["philosopher"],
  Eubulides: ["philosopher"], // the Megarian
  Eubulus: [], // multiple bearers, per the workbook
  "Eudemus of Rhodes": ["philosopher"], // Peripatetic
  Eudromus: ["philosopher"], // Stoic, Elements of Ethics (7.39)
  "Euphantus of Olynthus": ["philosopher", "historian"], // Megarian (2.110) - see header
  Euphorion: ["poet"], // of Chalcis
  "Euthyphron (son of Heraclides Ponticus)": [], // only the parentage is attested
  "Evanthes of Miletus": [], // known only from the tripod story (1.29)
  "Glaucus of Rhegium": ["historian"], // on the ancient poets and musicians (8.52, 9.38)
  "Hecataeus of Abdera": ["historian", "philosopher"],
  "Heraclides of Tarsus": ["philosopher"], // Stoic, Antipater's pupil (7.121)
  "Herodotus the Epicurean": ["philosopher"], // on Epicurus' youth (10.4)
  Hesiod: ["poet"],
  "Hieronymus of Rhodes": ["philosopher"], // Peripatetic
  Hippias: ["philosopher", "rhetorician"], // the sophist of Elis (1.24)
  "Idomeneus of Lampsacus": ["philosopher", "historian"], // Epicurean; On the Socratics
  "Isidorus of Pergamum": ["rhetorician"], // the rhetorician (7.34)
  Istrus: ["historian"], // the Callimachean
  "Justus of Tiberias": ["historian"],
  "Maeandrius of Miletus": ["historian"], // the local historian (1.28)
  "Lobon of Argos": ["biographer"], // On Poets (1.34, 1.112)
  Lysanias: [], // multiple possible figures, per the workbook
  Lysias: ["rhetorician"], // the orator
  Lysis: ["philosopher"], // of Taras, Pythagorean
  Manetho: ["priest", "historian"], // Egyptian priest; the Epitome (1.10)
  Melanthius: [], // the painter, On Painting (2.64/4.18) - no painter role in the union
  Meleager: ["philosopher", "poet"], // of Gadara: Cynic and epigrammatist
  "Menodotus of Nicomedia": ["physician", "philosopher"], // Empiric physician, Skeptic
  "Metrodorus of Chios": ["philosopher"], // Democritean
  Minyas: [], // an epic poem (1.89), not a person - see header
  "Mnesistratus of Thasos": [], // known only from 3.47
  Nicolaus: [], // ambiguous, per the workbook
  Numenius: ["philosopher"], // of Apamea
  Olympiodorus: [], // multiple figures, per the workbook
  Onetor: [], // known only from his essay title (2.114)
  "Panaetius of Rhodes": ["philosopher"], // Stoic
  Pisistratus: ["statesman"], // the tyrant of Athens
  "Polemon of Ilium": ["historian"], // the periegete
  "Polycrates of Mende": [], // no secure identification for the epithet - never guess
  Polyeuctus: [], // uncertain figure (6.23)
  Posidippus: ["comicPoet"], // quoted on Zeno (7.27)
  Potamon: ["philosopher"], // of Alexandria, the Eclectic (1.21)
  Praxiphanes: ["philosopher", "grammarian"], // Peripatetic, early grammatikos
  Sabinus: ["rhetorician"], // his Materials for Declamation (3.47)
  "Seleucus (grammarian)": ["grammarian"],
  "Sextus Empiricus": ["philosopher", "physician"],
  "Silenus (of Kale Acte)": ["historian"],
  Sophilus: ["comicPoet"], // his Marriage
  "Sosibius of Laconia": ["historian"],
  Telecleides: ["comicPoet"], // his Phrygians
  "Theodorus (of Athens?)": [], // Against Epicurus; uncertain among D.L.'s twenty Theodori
  Theodosius: ["philosopher"], // his Skeptic Summaries (9.70)
  Theognis: ["poet"], // of Megara
  Theophanes: [], // On Painting; uncertain - no painter role in the union
  Timonides: ["historian"], // of Leucas, with Dion (4.5)
  "Timotheus of Athens": ["biographer"], // his On Lives (3.5, 4.4, 5.1, 7.1)
  "Timotheus of Miletus": ["poet"], // the citharode, his Niobe
  "Xanthus of Lydia": ["historian"], // the Lydiaca
  "Zeno of Tarsus": ["philosopher"], // Stoic
  Zeuxis: ["philosopher"], // Skeptic, Aenesidemus' pupil (9.116)
  "Zoilus of Perge": [], // known only from a single mention (6.37)
};
