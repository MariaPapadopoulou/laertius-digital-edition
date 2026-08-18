/**
 * Curated Wikidata QIDs for the non-philosopher persons and cited
 * authorities (sources) that appear in the claims and sayings layers.
 * Keyed by the exact label used in the curated data.
 *
 * Curation policy (same as kg-links.ts): identifications were made at
 * curation time against the Wikidata API, and only kept when the D.L.
 * context makes the referent unambiguous. Bare homonyms with no safe
 * referent are deliberately absent - never guess:
 *   - "Ariston" (D.L. 9.5, on Heraclitus' death - of Ceos or of Chios?)
 *   - "Athenodorus" (Walks author; several Athenodori)
 *   - "Bryson" / "Bryson the Achaean" (no unambiguous Wikidata item)
 *   - "Dionysius the Stoic", "Dioscurides", "Eumelus", "Hipparchus",
 *     "Philo of Athens", "Timocrates" (identity uncertain or no item)
 *   - "Heraclides of Heraclea" (person; possibly Heraclides Ponticus,
 *     but D.L. 7.166 does not settle it)
 *   - "Magians and Chaldaeans" (a group, not a person)
 *   - "Epicurus, Letter to Eurylochus" (a work cited as authority)
 *
 * Sources whose label names a corpus philosopher reuse that
 * philosopher's PHILOSOPHER_META qid (Aristotle, Theophrastus,
 * Xenophanes, Heraclitus, Menippus, Bion) so owl:sameAs stays
 * consistent across the graph. "Antisthenes" as a *source* is the
 * historian of the Successions (Antisthenes of Rhodes), NOT the Cynic.
 *
 * NOTE: this flat map is shared by /person/ and /source/ nodes, so it
 * assumes any label used for both denotes the same individual (true
 * today: only "Hermarchus" overlaps). If a future person and source
 * ever share a bare label but mean different people, split the map.
 */
export const ENTITY_QIDS: Record<string, string> = {
  // ---- persons (claim values without a Life of their own) ----
  Homer: "Q6691", // the poet, criticized by Heraclitus and Xenophanes
  Hermarchus: "Q542808", // Epicurus' successor (also cited as a source)
  "Cratylus the Heraclitean": "Q125247", // Plato's Heraclitean teacher
  Hermodamas: "Q3134245", // teacher of Pythagoras (D.L. 8.2)
  "Diogenes of Smyrna": "Q3028701", // teacher of Anaxarchus (D.L. 9.58)
  Gorgias: "Q179785", // the sophist, teacher of Antisthenes (D.L. 6.1)
  Nausiphanes: "Q1189157", // Epicurus' Democritean teacher (D.L. 10.13)
  Damon: "Q2346819", // Damon of Athens, musicologist (D.L. 2.19)
  Ameinias: "Q3094544", // Pythagorean who converted Parmenides (D.L. 9.21)
  "Hegesinus of Pergamum": "Q764766", // Academic, teacher of Carneades (D.L. 4.60)
  Panthoides: "Q4354547", // the dialectician, teacher of Lyco (D.L. 5.68)
  Metrodorus: "Q780259", // of Lampsacus, the Epicurean (D.L. 10.22)
  Themistoclea: "Q44912", // Delphic priestess, teacher of Pythagoras (D.L. 8.8)
  "Philistion the Sicilian": "Q1077699", // physician, teacher of Eudoxus (D.L. 8.86)
  Theodorus: "Q381765", // the Atheist, sparring partner of Hipparchia (D.L. 6.97)
  "Colotes of Lampsacus": "Q1234536", // Epicurean, teacher of Menedemus (D.L. 6.102)

  // ---- sources (authorities D.L. cites) ----
  "Achaïcus": "Q28858429", // Achaicus the philosopher, Ethics (D.L. 6.99)
  Alcidamas: "Q444459", // rhetorician, pupil of Gorgias
  Alexander: "Q441138", // Alexander Polyhistor, Successions of Philosophers
  Antigonus: "Q554362", // bare citations = Antigonus of Carystus
  "Antigonus of Carystus": "Q554362",
  Antisthenes: "Q2405888", // of Rhodes, historian (Successions) - NOT the Cynic
  Apollodorus: "Q205704", // of Athens, the chronographer (Chronology; verified 10.13/10.14)
  "Apollodorus the Epicurean": "Q2369009", // the Kepotyrannos, head of the Garden, teacher of Zeno of Sidon (D.L. 10.2, 10.25)
  Apollonides: "Q3413715", // of Nicaea, commentator on Timon's Silloi (D.L. 9.109)
  "Apollonius of Tyre": "Q1799262", // Stoic biographer of Zeno (D.L. 7.1)
  Aristotle: "Q868", // = corpus philosopher
  Aristoxenus: "Q335156", // the Peripatetic musicologist
  Bion: "Q359231", // = corpus philosopher (Lectures, D.L. 2.77)
  Ctesiclides: "Q11916243", // Ctesicles the Hellenistic historian, archon list (D.L. 2.56)
  Demetrius: "Q3044491", // bare citations = Demetrius of Magnesia (Men of the Same Name)
  "Demetrius of Magnesia": "Q3044491",
  "Demetrius the Magnesian": "Q3044491",
  "Demetrius of Troezen": "Q3044489", // grammarian (D.L. 8.74)
  Diocles: "Q127228", // of Magnesia (Epidrome of Philosophers)
  Duris: "Q521203", // of Samos, historian
  Eratosthenes: "Q43182", // of Cyrene (Olympic victors, chronology)
  Favorinus: "Q554387", // of Arelate (Memorabilia, Miscellaneous History)
  Hecato: "Q924215", // of Rhodes, Stoic
  Heraclides: "Q2397427", // Lembus (Epitome of Sotion; "son of Serapion", 8.44, 10.1)
  Heraclitus: "Q41155", // = corpus philosopher (quoted on Pythagoras)
  Hermippus: "Q933860", // of Smyrna, the biographer
  Hermodorus: "Q11925495", // the Platonist (On Plato)
  Herodotus: "Q26825", // the historian
  Hippobotus: "Q2614752", // historian of philosophy (On Sects)
  Menippus: "Q452077", // = corpus philosopher
  Myronianus: "Q91345586", // of Amastris (Historical Parallels)
  Neanthes: "Q1616998", // of Cyzicus, historian
  Nicomachus: "Q2217419", // son of Aristotle (D.L. 8.88)
  Persaeus: "Q662932", // Stoic, pupil of Zeno
  Philochorus: "Q266299", // the Atthidographer
  Phlegon: "Q138531", // of Tralles (On Longevity)
  Plutarch: "Q41523",
  Satyrus: "Q1295215", // the Peripatetic biographer (Lives)
  Sosicrates: "Q1235326", // of Rhodes (Successions)
  Sotion: "Q2570422", // of Alexandria (Successions of the Philosophers)
  Telauges: "Q3982722", // son of Pythagoras
  Theophrastus: "Q160362", // = corpus philosopher
  Theopompus: "Q4318", // of Chios, historian
  Thrasylus: "Q725225", // Thrasyllus of Mendes, editor of Democritus (D.L. 9.41)
  Timaeus: "Q367298", // of Tauromenium, historian
  Xenophanes: "Q131671", // = corpus philosopher (quoted at 1.111, 8.36)

  // ---- verse authors (poets credited in the verse layer) ----
  // Same policy; referents resolved with the quoted passage in hand.
  // Deliberately unmapped verse authors (no safe Wikidata item):
  //   - "Linus" (D.L.'s Linus is son of Hermes and Urania; the Wikidata
  //     Linus items are other genealogies - no safe match)
  //   - "Diodotus" (the grammarian who read Heraclitus, D.L. 9.12 - no item)
  //   - "Demetrius the epic poet" (homonym list, D.L. 5.85 - no item)
  "Diogenes Laertius": "Q59138", // the author of the Lives himself
  Achaeus: "Q718070", // of Eretria, tragic poet (Omphale, D.L. 2.133)
  Alcaeus: "Q212872", // of Mytilene, the lyric poet (D.L. 1.31)
  Alexis: "Q4966577", // Middle Comedy poet, on Plato (D.L. 3.27-28)
  Ameipsias: "Q460766", // Old Comedy, on Socrates (D.L. 2.28)
  Amphis: "Q696632", // Middle Comedy, on Plato (D.L. 3.27-28)
  Anaxandrides: "Q488577", // Middle Comedy, Theseus (D.L. 3.26)
  Antagoras: "Q3558582", // of Rhodes, on Polemo and Crates (D.L. 4.21-27)
  "Antipater of Sidon": "Q114280", // epitaph on Zeno (D.L. 7.29)
  Archilochus: "Q201323", // of Paros (D.L. 9.71)
  Aristophanes: "Q43353", // the comic playwright (Clouds, on Socrates)
  Aristophon: "Q667361", // Middle Comedy, Pythagorist (D.L. 8.38)
  "Athenaeus the epigrammatist": "Q3627896", // epigrams at D.L. 6.14, 7.30, 10.12
  Callias: "Q2436238", // Old Comedy, Captives (D.L. 2.18)
  Callimachus: "Q192417", // of Cyrene (D.L. 1.23, 2.111, 9.17)
  Cercidas: "Q1279413", // of Megalopolis, meliambics on Diogenes (D.L. 6.76)
  Cratinus: "Q350517", // Old Comedy, Cheirons (D.L. 1.62)
  "Cratinus the Younger": "Q1120896", // Middle Comedy (D.L. 3.28, 8.37)
  "Demodicus of Leros": "Q3558606", // epigrammatist (D.L. 1.84)
  Eupolis: "Q459517", // Old Comedy (D.L. 3.7, 9.50)
  Euripides: "Q48305", // the tragedian
  Hipponax: "Q367377", // of Ephesus, on Myson (D.L. 1.107)
  "Ion of Chios": "Q162163", // poet-philosopher, on Pherecydes (D.L. 1.120)
  Lycophron: "Q432737", // the 4th-c. poet, satyr play Menedemus (D.L. 2.140)
  Menander: "Q118992", // New Comedy (D.L. 6.83, 6.93)
  Mimnermus: "Q316129", // elegist answered by Solon (D.L. 1.60)
  Mnesimachus: "Q6019853", // Middle Comedy, Alcmaeon (D.L. 2.18, 8.37)
  Phrynichus: "Q317061", // the early tragic poet, quoted of Polemo (D.L. 4.20)
  Simonides: "Q273003", // of Ceos (D.L. 1.90, 4.45 - traditional attribution)
  Sophocles: "Q7235", // the tragedian (D.L. 4.35)
  Sositheus: "Q331139", // tragic poet against Cleanthes (D.L. 7.173)
  Theaetetus: "Q12877828", // the Hellenistic epigrammatist (D.L. 4.25, 8.48)
  "Theocritus of Chios": "Q12902326", // epigram against Aristotle (D.L. 5.11)
  "Theopompus the comic poet": "Q3983959", // Hedychares (D.L. 3.26) - NOT the historian Q4318
  "Zenodotus the Stoic": "Q16989335", // epigram on Zeno (D.L. 7.30)
};

/**
 * Curated Wikidata QIDs for the places named in the claims layer
 * (birthplaces, residences, travels), keyed by the exact claim label.
 *
 * Same curation policy: identified against the Wikidata API at curation
 * time, resolved with the D.L. subject in hand (e.g. "Pisa" is Chilon's
 * Pisa in Elis, Q922329, not the Italian city; "Bosporus" is Sphaerus'
 * Bosporan Kingdom, Q321371, not the strait; "Borysthenes" is Bion's
 * Olbia Pontica, Q1143233, the standard identification). Where Wikidata
 * has a dedicated ancient-polis item (Hansen/Nielsen import) it is
 * preferred over the modern settlement (Chalcis, Croton, Eretria,
 * Megara, Mitylene, Samos, Sinope, Thebes - Boeotian Thebes verified by
 * coordinates). "Heraclea" and "Heraclea in the Pontus" both denote
 * Heraclea Pontica (Dionysius the Renegade / Heraclides).
 *
 * Deliberately unmapped (compound/uncertain labels - never guess):
 *   - "Abdera, or, according to some, Miletus"
 *   - "Elea, but some say Abdera and others Miletus"
 *   - "Chen (a village in the district of Oeta or Laconia)"
 */
export const PLACE_QIDS: Record<string, string> = {
  Abdera: "Q188615",
  Academy: "Q193093", // the Platonic Academy
  Aegina: "Q191082",
  "Agrigentum (Acragas)": "Q3607380", // ancient Akragas
  Alexandria: "Q87",
  Assos: "Q744631",
  Astypalaea: "Q216768", // the island (Onesicritus)
  Athens: "Q1524",
  Borysthenes: "Q1143233", // = Olbia Pontica (Bion "of Borysthenes")
  Bosporus: "Q321371", // Bosporan Kingdom (Sphaerus the Bosporan)
  Carthage: "Q6343",
  Chalcedon: "Q337381",
  Chalcis: "Q21235810", // ancient polis of Euboea
  Chios: "Q160483",
  Cilicia: "Q620864",
  Citium: "Q1743884",
  Clazomenae: "Q536598",
  Cnidos: "Q690575",
  "Cnossos in Crete": "Q173527",
  Colophon: "Q1142488",
  Corinth: "Q1363688", // Ancient Corinth
  Croton: "Q13526919", // ancient Kroton
  Cyprus: "Q644636", // the island
  Cyrene: "Q44112",
  Cyzicus: "Q615449", // promoted from place-mentions.ts: Eudoxus taught there (8.87)
  Egypt: "Q79",
  Elea: "Q272968", // Velia
  Elis: "Q6536845", // Ancient Elis
  Ephesus: "Q47611",
  Eresus: "Q1018197",
  Eretria: "Q16562724", // ancient city-state of Euboea
  Gela: "Q39971",
  Heraclea: "Q302511", // Heraclea Pontica
  "Heraclea in the Pontus": "Q302511",
  Italy: "Q38",
  Lacedaemon: "Q5690", // Sparta
  Lampsacus: "Q1229422",
  Lindus: "Q65122097",
  Maroneia: "Q12874068", // Ancient Maroneia (Thrace)
  Megara: "Q42307600", // ancient city-state
  Metapontum: "Q1058770",
  Miletus: "Q169460",
  Mitylene: "Q42295059", // ancient polis of Lesbos
  Peloponnesus: "Q78967",
  Phalerum: "Q534927", // the Athenian deme Phaleron
  Phlius: "Q1412043",
  Pisa: "Q922329", // Pisa in Elis (Chilon died there), not Italy
  Pitane: "Q752699",
  Priene: "Q142819",
  Salamis: "Q202422", // Salamis Island (Solon)
  Samos: "Q13580795", // ancient city-state
  Scillus: "Q733291",
  Scythia: "Q845909",
  Sicily: "Q1460",
  Sinope: "Q107557833", // ancient city-state (Diogenes)
  Soli: "Q656954", // Soli in Cilicia (Crantor, Chrysippus' school ties)
  Stagira: "Q846127",
  Syracuse: "Q4420718", // Ancient Syracuse
  Syros: "Q211230",
  Tarentum: "Q3981082", // Taras
  Tarsus: "Q134287",
  Teos: "Q17586",
  Thebes: "Q11225429", // Boeotian Thebes (coords verified)
  Troas: "Q2454671", // the Troad (Lyco)
};

/**
 * Curated Wikidata QIDs for work titles in the claims layer, keyed by
 * the exact claim title (Hicks' English rendering).
 *
 * Pipeline: only single-author titles were considered (shared titles
 * conflate distinct works under one node - e.g. "Republic" is both
 * Plato's and Diogenes'). Every candidate was verified by requiring
 * Wikidata P50 (author) == the philosopher's curated QID; famous works
 * missed by plain search were resolved through their exact enwiki
 * article and then P50-checked the same way. "Sovran Maxims" (Principal
 * Doctrines, Q107555736) is the one item accepted without P50 - the
 * item carries none, but the enwiki article is Epicurus' Kyriai Doxai
 * and no homonym exists.
 *
 * Deliberately rejected D.L. homonyms of extant works (the catalogue
 * entry is a different, lost work, or the book counts diverge - never
 * conflate):
 *   - Aristotle "The Sophist (one book)" ≠ Sophistical Refutations
 *   - Aristotle "Politics (two books)" ≠ the extant 8-book Politics
 *   - Aristotle "On Plants (two books)" ≠ Nicolaus' De Plantis
 *   - Aristotle "Eight books of Prior Analytics" ≠ the extant 2-book
 *     Prior Analytics; "Two books of the Art of Rhetoric" ≠ the extant
 *     3-book Rhetoric; "Of the Soul (one book)" ≠ the 3-book De Anima;
 *     "Of Problems (one book)" ≠ the 38-book Problems (book counts
 *     diverge). "Two books of Greater Posterior Analytics" IS accepted:
 *     2 = 2 books of the extant work
 *   - Theophrastus "Character Sketches" has no Wikidata item of its own
 *     (covered only in the author article); "Of Causes (one book)" ≠
 *     the multi-book De causis plantarum
 *   - Xenophon "The Constitutions of Athens and Sparta" bundles two
 *     distinct works in one title - unmappable as one node
 *   - Hermippus' "On the Sages" (source-work) has no Wikidata item;
 *     Wikidata lists no P50 works for Hermippus at all
 */
export const WORK_QIDS: Record<string, string> = {
  // ---- Xenophon ----
  "A Defence of Socrates": "Q619580",
  "Agesilaus": "Q3606509",
  "Anabasis": "Q73112",
  "Cyropaedia": "Q1145374",
  "Hellenica": "Q674638",
  "Hieron, or Of Tyranny": "Q1435976",
  "Memorabilia": "Q1373343",
  "Oeconomicus": "Q2555163",
  "On Horsemanship": "Q331100",
  "On Hunting": "Q3008827",
  "On Revenues": "Q3908524",
  "On the Duty of a Cavalry General": "Q3801664",
  // ---- Aeschines ----
  "Callias": "Q130243803",
  "Telauges": "Q130243809",
  // ---- Plato ----
  "Acephali, or Sisyphus": "Q2440575",
  "Alcibiades, or On the Nature of Man": "Q1153509",
  "Alcyon": "Q780818",
  "Apology of Socrates": "Q273668",
  "Charmides, or On Temperance": "Q781206",
  "Clitophon, or Introduction": "Q1653767",
  "Cratylus, or On Correctness of Names": "Q1347394",
  "Critias, or Story of Atlantis": "Q1335321",
  "Crito, or On what is to be done": "Q267634",
  "Demodocus": "Q2625856",
  "Epinomis, or Nocturnal Council": "Q2440551",
  "Epistles (thirteen in number)": "Q2170732",
  "Eryxias, or Erasistratus": "Q2440110",
  "Euthydemus, or The Eristic": "Q6499786",
  "Euthyphro, or On Holiness": "Q648889",
  "Gorgias, or On Rhetoric": "Q264241",
  "Hipparchus, or The Lover of Gain": "Q1619950",
  "Hippias (major), or On Beauty": "Q634846",
  "Hippias (minor), or On Falsehood": "Q614640",
  "Ion, or On the Iliad": "Q1426781",
  "Laches, or On Courage": "Q1243625",
  "Laws, or On Legislation": "Q752285",
  "Lysis, or On Friendship": "Q924977",
  "Menexenus, or The Funeral Oration": "Q1474843",
  "Meno, or On Virtue": "Q746253",
  "Minos, or On Law": "Q241668",
  "Parmenides, or On Ideas": "Q1130762",
  "Phaedo, or On the Soul": "Q244161",
  "Phaedrus, or On Love": "Q555862",
  "Philebus, or On Pleasure": "Q220972",
  "Protagoras, or Sophists": "Q520328",
  "Second Alcibiades, or On Prayer": "Q1788674",
  "Sophist, or On Being": "Q471715",
  "Statesman, or On Monarchy": "Q669911",
  "The Banquet, or On the Good": "Q486727",
  "The Rivals, or On Philosophy": "Q572073",
  "Theaetetus, or On Knowledge": "Q846241",
  "Theages, or On Philosophy": "Q2005313",
  "Timaeus, or On Nature": "Q371884",
  // ---- Speusippus ----
  "Definitions": "Q1749083",
  // ---- Aristotle ----
  "Categories (one book)": "Q1735826",
  "De Interpretatione (one book)": "Q648627",
  "Mechanics (one book)": "Q2337123",
  "On Animals (nine books)": "Q119295219",
  "On Poets (three books)": "Q119295701",
  "Poetics (one book)": "Q264714",
  "Symposium (one book)": "Q119295777", // fragmentary lost work, P50 = Aristotle
  // 2 books in the catalogue = the extant 2-book work (unlike Politics/Rhetoric,
  // where the book counts diverge and the identification is rejected below)
  "Two books of Greater Posterior Analytics": "Q485206",
  // ---- Theophrastus ----
  "Of the Senses (one book)": "Q63183551",
  "On Precious Stones (one book)": "Q1180695", // the extant De lapidibus (one book)
  "Seven books of Posterior Analytics": "Q138314562", // Theophrastus' own, P50-verified
  "Three books of Prior Analytics": "Q138314555", // Theophrastus' own, P50-verified
  // ---- Empedocles ----
  "Purifications": "Q11888967",
  // ---- Philolaus ----
  "On Nature (one book)": "Q11879850",
  // ---- Heraclitus ----
  "On Nature (a continuous treatise in three discourses: on the universe, on politics, on theology)": "Q4406485",
  // ---- Epicurus ----
  "On Nature (37 books)": "Q7091086",
  "Sovran Maxims (Kyriai Doxai)": "Q107555736",
  // ---- Zeno of Citium ----
  "Republic (Politeia)": "Q3625645",
  // ---- source-works (cited by D.L. as sources; see source-works.ts) ----
  "Chronology": "Q42187904", // Apollodorus' Χρονικά, P50 = Q205704
  // ---- person-works (quoted from person-only authors; see person-works.ts) ----
  "Omphale": "Q125983743", // Achaeus of Eretria's satyr play, P50 = Q718070
};

/**
 * English Wikipedia article titles for works in WORK_QIDS, keyed by the
 * same claim title. Fetched at curation time from each QID's enwiki
 * sitelink (curation-time only - runtime stays offline), so every entry
 * is anchored to its P50-verified Wikidata item, never guessed from the
 * title. Works absent here (12 of 73) simply have no enwiki article
 * (mostly lost works known only from D.L.'s catalogues). In LOD these
 * become owl:sameAs DBpedia URIs and rdfs:seeAlso Wikipedia links on
 * the lo:Work nodes, mirroring the philosopher-node treatment.
 */
export const WORK_ENWIKI: Record<string, string> = {
  // ---- Xenophon ----
  "A Defence of Socrates": "Apology (Xenophon)",
  "Agesilaus": "Agesilaus (Xenophon)",
  "Anabasis": "Anabasis (Xenophon)",
  "Cyropaedia": "Cyropaedia",
  "Hellenica": "Hellenica",
  "Hieron, or Of Tyranny": "Hiero (Xenophon)",
  "Memorabilia": "Memorabilia (Xenophon)",
  "Oeconomicus": "Oeconomicus",
  "On Horsemanship": "On Horsemanship",
  "On Hunting": "Cynegeticus",
  "On Revenues": "Ways and Means (Xenophon)",
  "On the Duty of a Cavalry General": "Hipparchicus",
  // ---- Plato ----
  "Acephali, or Sisyphus": "Sisyphus (dialogue)",
  "Alcibiades, or On the Nature of Man": "First Alcibiades",
  "Alcyon": "Halcyon (dialogue)",
  "Apology of Socrates": "Apology (Plato)",
  "Charmides, or On Temperance": "Charmides (dialogue)",
  "Clitophon, or Introduction": "Clitophon (dialogue)",
  "Cratylus, or On Correctness of Names": "Cratylus (dialogue)",
  "Critias, or Story of Atlantis": "Critias (dialogue)",
  "Crito, or On what is to be done": "Crito",
  "Demodocus": "Demodocus (dialogue)",
  "Epinomis, or Nocturnal Council": "Epinomis",
  "Epistles (thirteen in number)": "Epistles (Plato)",
  "Eryxias, or Erasistratus": "Eryxias (dialogue)",
  "Euthydemus, or The Eristic": "Euthydemus (dialogue)",
  "Euthyphro, or On Holiness": "Euthyphro",
  "Gorgias, or On Rhetoric": "Gorgias (dialogue)",
  "Hipparchus, or The Lover of Gain": "Hipparchus (dialogue)",
  "Hippias (major), or On Beauty": "Hippias Major",
  "Hippias (minor), or On Falsehood": "Hippias Minor",
  "Ion, or On the Iliad": "Ion (dialogue)",
  "Laches, or On Courage": "Laches (dialogue)",
  "Laws, or On Legislation": "Laws (dialogue)",
  "Lysis, or On Friendship": "Lysis (dialogue)",
  "Menexenus, or The Funeral Oration": "Menexenus (dialogue)",
  "Meno, or On Virtue": "Meno",
  "Minos, or On Law": "Minos (dialogue)",
  "Parmenides, or On Ideas": "Parmenides (dialogue)",
  "Phaedo, or On the Soul": "Phaedo",
  "Phaedrus, or On Love": "Phaedrus (dialogue)",
  "Philebus, or On Pleasure": "Philebus",
  "Protagoras, or Sophists": "Protagoras (dialogue)",
  "Second Alcibiades, or On Prayer": "Second Alcibiades",
  "Sophist, or On Being": "Sophist (dialogue)",
  "Statesman, or On Monarchy": "Statesman (dialogue)",
  "The Banquet, or On the Good": "Symposium (Plato)",
  "The Rivals, or On Philosophy": "Rival Lovers",
  "Theaetetus, or On Knowledge": "Theaetetus (dialogue)",
  "Theages, or On Philosophy": "Theages",
  "Timaeus, or On Nature": "Timaeus (dialogue)",
  // ---- Speusippus ----
  "Definitions": "Definitions (Plato)",
  // ---- Aristotle ----
  "Categories (one book)": "Categories (Aristotle)",
  "De Interpretatione (one book)": "On Interpretation",
  "Mechanics (one book)": "Mechanics (Aristotle)",
  "Poetics (one book)": "Poetics (Aristotle)",
  "Two books of Greater Posterior Analytics": "Posterior Analytics",
  // ---- Theophrastus ----
  "On Precious Stones (one book)": "De lapidibus",
  // ---- Epicurus ----
  "On Nature (37 books)": "On Nature (Epicurus)",
  "Sovran Maxims (Kyriai Doxai)": "Principal Doctrines",
  // ---- Zeno of Citium ----
  "Republic (Politeia)": "Republic (Zeno)",
};
