/**
 * Curated authorship for the verse layer: verse id -> the poet the text
 * credits with the lines. Only verses where Diogenes Laertius (or the
 * Hicks translation he is read through) *names* the author are mapped;
 * anonymous epitaphs, oracles and unnamed quotations carry no entry  - 
 * never guess. "Diogenes Laertius" marks the epigrams he flags as his
 * own ("my own epitaph", "verses of mine", many from his Pammetros).
 *
 * Labels follow the conventions of the claims/sayings layers:
 *  - a label matching a corpus philosopher (checked against the KG at
 *    serialization time) links to that philosopher's node
 *    (e.g. Timon's Silloi lines, Solon's elegies, Plato's epigrams);
 *  - any other label becomes a foaf:Person node of its own, with a
 *    Wikidata QID in ENTITY_QIDS when the referent is unambiguous.
 *
 * Disambiguation notes (against the Hicks text at curation time):
 *  - "Theopompus the comic poet" (3.26) is deliberately NOT the bare
 *    "Theopompus" already in ENTITY_QIDS (the historian of Chios);
 *  - "Phrynichus" (4.20) is the early tragic poet, not the comedian;
 *  - "Theaetetus" (4.25, 8.48) is the Hellenistic epigrammatist;
 *  - "Simonides" (1.90 on Cleobulus' Midas epitaph; 4.45 the Anth.
 *    Plan. epigram) is Simonides of Ceos by traditional attribution;
 *  - "Apollodorus" (8.52) is the chronographer, as elsewhere;
 *  - 8.7 (verses "by Lysis") is skipped: the text attributes disputed
 *    Pythagorean verses ambiguously, no safe single author.
 */
export const VERSE_AUTHORS: Record<string, string> = {
  // ---- Diogenes Laertius' own epigrams (Pammetros etc.) ----
  "1.1.39#1": "Diogenes Laertius",
  "1.2.63#0": "Diogenes Laertius",
  "1.3.73#0": "Diogenes Laertius",
  "1.5.85#1": "Diogenes Laertius",
  "1.7.97#1": "Diogenes Laertius",
  "1.8.103#0": "Diogenes Laertius",
  "1.11.120#2": "Diogenes Laertius",
  "1.11.121#0": "Diogenes Laertius",
  "2.3.15#1": "Diogenes Laertius",
  "2.5.46#0": "Diogenes Laertius",
  "2.6.58#0": "Diogenes Laertius",
  "2.6.58#1": "Diogenes Laertius",
  "2.10.110#0": "Diogenes Laertius",
  "2.10.112#0": "Diogenes Laertius",
  "2.17.144#0": "Diogenes Laertius",
  "3.1.45#0": "Diogenes Laertius",
  "3.1.45#1": "Diogenes Laertius",
  "4.1.3#0": "Diogenes Laertius",
  "4.2.15#0": "Diogenes Laertius",
  "4.3.20#2": "Diogenes Laertius",
  "4.5.27#1": "Diogenes Laertius",
  "4.6.45#0": "Diogenes Laertius",
  "4.7.55#0": "Diogenes Laertius",
  "4.7.56#0": "Diogenes Laertius",
  "4.7.57#0": "Diogenes Laertius",
  "4.8.61#0": "Diogenes Laertius",
  "4.9.65#0": "Diogenes Laertius",
  "4.9.66#0": "Diogenes Laertius",
  "5.1.8#1": "Diogenes Laertius",
  "5.2.40#0": "Diogenes Laertius",
  "5.3.60#0": "Diogenes Laertius",
  "5.4.68#0": "Diogenes Laertius",
  "5.5.79#0": "Diogenes Laertius",
  "5.6.90#0": "Diogenes Laertius",
  "6.1.19#0": "Diogenes Laertius",
  "6.2.79#0": "Diogenes Laertius",
  "6.8.100#0": "Diogenes Laertius",
  "7.1.31#0": "Diogenes Laertius",
  "7.2.164#0": "Diogenes Laertius",
  "7.5.176#0": "Diogenes Laertius",
  "7.7.184#0": "Diogenes Laertius",
  "8.1.44#0": "Diogenes Laertius",
  "8.1.44#1": "Diogenes Laertius",
  "8.1.45#0": "Diogenes Laertius",
  "8.1.45#1": "Diogenes Laertius",
  "8.2.75#0": "Diogenes Laertius",
  "8.2.75#1": "Diogenes Laertius",
  "8.7.84#0": "Diogenes Laertius",
  "8.8.91#0": "Diogenes Laertius",
  "9.1.4#0": "Diogenes Laertius",
  "9.5.28#0": "Diogenes Laertius",
  "9.7.43#0": "Diogenes Laertius",
  "9.8.56#0": "Diogenes Laertius",
  "9.10.59#0": "Diogenes Laertius",
  "10.1.16#0": "Diogenes Laertius",

  // ---- Timon of Phlius (Silloi and other lines) ----
  "1.1.34#0": "Timon",
  "2.3.6#0": "Timon",
  "2.5.19#0": "Timon",
  "2.6.55#0": "Timon",
  "2.8.66#0": "Timon",
  "2.17.126#1": "Timon",
  "3.1.7#1": "Timon",
  "3.1.26#2": "Timon",
  "4.6.33#1": "Timon",
  "4.6.33#2": "Timon",
  "4.6.34#0": "Timon",
  "4.6.42#0": "Timon",
  "4.10.67#0": "Timon",
  "5.1.11#1": "Timon",
  "7.1.16#0": "Timon",
  "7.2.161#0": "Timon",
  "7.5.170#0": "Timon",
  "8.1.36#0": "Timon",
  "8.2.67#0": "Timon",
  "9.1.6#0": "Timon",
  "9.2.18#0": "Timon",
  "9.3.23#0": "Timon",
  "9.5.25#0": "Timon",
  "9.7.40#0": "Timon",
  "9.8.52#0": "Timon",
  "9.11.65#0": "Timon",
  "9.11.65#1": "Timon",
  "9.11.105#0": "Timon",
  "9.12.112#0": "Timon",
  "10.1.3#0": "Timon",

  // ---- Solon (elegies and political verses) ----
  "1.2.47#0": "Solon",
  "1.2.47#1": "Solon",
  "1.2.48#1": "Solon",
  "1.2.49#0": "Solon",
  "1.2.50#0": "Solon",
  "1.2.52#0": "Solon",
  "1.2.61#0": "Solon",
  "1.2.61#1": "Solon",

  // ---- Plato (epigrams quoted in his Life) ----
  "3.1.29#0": "Plato",
  "3.1.29#1": "Plato",
  "3.1.30#0": "Plato",
  "3.1.31#0": "Plato",
  "3.1.31#1": "Plato",
  "3.1.32#0": "Plato",
  "3.1.32#1": "Plato",
  "3.1.32#2": "Plato",
  "3.1.33#0": "Plato",
  "3.1.33#1": "Plato",
  "3.1.33#2": "Plato",

  // ---- Epicharmus (quoted in Plato's Life) ----
  "3.1.10#0": "Epicharmus",
  "3.1.11#0": "Epicharmus",
  "3.1.14#0": "Epicharmus",
  "3.1.16#0": "Epicharmus",
  "3.1.16#1": "Epicharmus",
  "3.1.17#0": "Epicharmus",

  // ---- Empedocles (his own hexameters) ----
  "8.1.43#0": "Empedocles",
  "8.2.54#0": "Empedocles",
  "8.2.54#1": "Empedocles",
  "8.2.61#0": "Empedocles",
  "8.2.61#1": "Empedocles",
  "8.2.62#0": "Empedocles",
  "8.2.65#0": "Empedocles",
  "8.2.65#1": "Empedocles",
  "8.2.66#0": "Empedocles",
  "8.2.76#0": "Empedocles",
  "8.2.76#1": "Empedocles",
  "8.2.77#0": "Empedocles",
  "9.11.73#1": "Empedocles",
  "9.11.73#2": "Empedocles",

  // ---- Crates of Thebes (parodies, Pera lines) ----
  "2.11.118#0": "Crates of Thebes",
  "2.17.126#0": "Crates of Thebes",
  "6.5.85#0": "Crates of Thebes",
  "6.5.86#0": "Crates of Thebes",
  "6.5.86#1": "Crates of Thebes",
  "6.5.86#2": "Crates of Thebes",
  "6.5.86#3": "Crates of Thebes",
  "6.7.98#1": "Crates of Thebes",

  // ---- Xenophanes (his own elegiacs and silloi) ----
  "8.1.36#1": "Xenophanes",
  "8.1.36#2": "Xenophanes",
  "9.2.19#0": "Xenophanes",
  "9.11.72#0": "Xenophanes",

  // ---- Euripides ----
  "1.2.56#0": "Euripides",
  "2.5.33#0": "Euripides",
  "4.5.26#0": "Euripides",
  "4.6.29#0": "Euripides",
  "4.6.29#1": "Euripides",
  "7.1.22#0": "Euripides",
  "9.11.71#1": "Euripides",
  "9.11.73#0": "Euripides",

  // ---- Homer ----
  "1.2.48#0": "Homer",
  "9.11.67#0": "Homer",
  "9.11.67#1": "Homer",
  "9.11.73#3": "Homer",
  "9.11.73#4": "Homer",
  "9.11.73#5": "Homer",

  // ---- Aristophanes ----
  "2.5.18#2": "Aristophanes",
  "2.5.27#0": "Aristophanes",
  "2.5.28#1": "Aristophanes",
  "8.1.34#0": "Aristophanes",

  // ---- Callimachus ----
  "1.1.23#0": "Callimachus",
  "2.10.111#0": "Callimachus",
  "9.1.17#0": "Callimachus",

  // ---- Aristotle (elegy on Eudemus, hymn to Hermias, epigram) ----
  "5.1.6#0": "Aristotle",
  "5.1.7#0": "Aristotle",
  "5.1.8#0": "Aristotle",

  // ---- Arcesilaus (his own epigrams) ----
  "4.6.30#0": "Arcesilaus",
  "4.6.31#0": "Arcesilaus",

  // ---- Alexis (Middle Comedy, on Plato) ----
  "3.1.27#0": "Alexis",
  "3.1.27#1": "Alexis",
  "3.1.28#2": "Alexis",
  "3.1.28#3": "Alexis",

  // ---- Amphis (Middle Comedy, on Plato) ----
  "3.1.27#2": "Amphis",
  "3.1.28#0": "Amphis",

  // ---- Antagoras of Rhodes ----
  "4.4.21#0": "Antagoras",
  "4.5.26#1": "Antagoras",
  "4.5.27#0": "Antagoras",

  // ---- Simonides of Ceos ----
  "1.6.90#1": "Simonides",
  "4.6.45#1": "Simonides",

  // ---- Cercidas of Megalopolis (meliambics on Diogenes) ----
  "6.2.76#0": "Cercidas",
  "6.2.77#0": "Cercidas",

  // ---- Menander ----
  "6.3.83#0": "Menander",
  "6.5.93#0": "Menander",

  // ---- Athenaeus the epigrammatist ----
  "6.1.14#0": "Athenaeus the epigrammatist",
  "7.1.30#1": "Athenaeus the epigrammatist",
  "10.1.12#0": "Athenaeus the epigrammatist",

  // ---- Theaetetus (the Hellenistic epigrammatist) ----
  "4.5.25#1": "Theaetetus",
  "8.1.48#0": "Theaetetus",

  // ---- Aristophon (Middle Comedy, on the Pythagoreans) ----
  "8.1.38#0": "Aristophon",
  "8.1.38#1": "Aristophon",

  // ---- Apollodorus the chronographer ----
  "8.2.52#0": "Apollodorus",
  "8.2.52#1": "Apollodorus",

  // ---- Mnesimachus (Middle Comedy) ----
  "2.5.18#0": "Mnesimachus",
  "8.1.37#1": "Mnesimachus",

  // ---- Eupolis (Old Comedy) ----
  "3.1.7#0": "Eupolis",
  "9.8.50#0": "Eupolis",

  // ---- Parmenides (his own hexameters) ----
  "9.3.22#0": "Parmenides",
  "9.3.22#1": "Parmenides",

  // ---- Socrates (verses ascribed to him) ----
  "2.5.42#0": "Socrates",
  "2.5.42#1": "Socrates",

  // ---- Carneades (lines quoted as his) ----
  "4.9.62#0": "Carneades",
  "4.9.64#0": "Carneades",

  // ---- Cratinus the Younger (Middle Comedy) ----
  "3.1.28#1": "Cratinus the Younger",
  "8.1.37#0": "Cratinus the Younger",

  // ---- Thales (verses ascribed to him) ----
  "1.1.35#0": "Thales",
  "1.1.35#1": "Thales",

  // ---- Cleobulus (Midas epitaph and song) ----
  "1.6.89#0": "Cleobulus",
  "1.6.90#0": "Cleobulus",
  "1.6.91#0": "Cleobulus",

  // ---- single attributions ----
  "1.prol.4#0": "Linus", // mythical singer, son of Hermes and Urania
  "1.1.31#0": "Alcaeus", // the Lesbian lyric poet, on Aristodemus
  "1.2.60#0": "Mimnermus", // elegy answered by Solon
  "1.2.62#1": "Cratinus", // Old Comedy, Cheirons
  "1.4.78#0": "Pittacus", // his own lines
  "1.5.84#0": "Demodicus of Leros", // epigrammatist
  "1.5.85#2": "Bias", // his apophthegm in verse
  "1.9.107#0": "Hipponax", // on Myson
  "1.11.120#1": "Ion of Chios", // on Pherecydes
  "2.5.18#1": "Callias", // Old Comedy, Captives
  "2.5.28#0": "Ameipsias", // Old Comedy, on Socrates
  "2.17.133#0": "Achaeus", // tragic poet, Omphale (quoted by Menedemus)
  "2.17.140#0": "Lycophron", // satyr play Menedemus
  "3.1.26#0": "Theopompus the comic poet", // Hedychares - NOT the historian
  "3.1.26#1": "Anaxandrides", // Middle Comedy, Theseus
  "4.3.20#1": "Phrynichus", // the early tragic poet, quoted of Polemo
  "4.6.35#3": "Sophocles", // lines quoted by Arcesilaus
  "4.6.33#0": "Ariston of Chios", // parody on Arcesilaus
  "4.7.52#0": "Bion", // verse ascribed to Bion himself
  "5.1.11#0": "Theocritus of Chios", // epigram against Aristotle
  "5.5.85#0": "Demetrius the epic poet", // homonym list, D.L. 5.85
  "5.6.93#0": "Dionysius the Renegade", // Parthenopaeus forgery, D.L. 5.93
  "6.2.44#0": "Diogenes of Sinope", // his own alteration of the verse
  "7.1.25#0": "Zeno of Citium", // line quoted as Zeno's own
  "7.1.29#0": "Antipater of Sidon", // epitaph on Zeno
  "7.1.30#0": "Zenodotus the Stoic", // epigram on Zeno
  "7.5.173#0": "Sositheus", // tragic poet, verse against Cleanthes
  "9.1.12#0": "Diodotus", // the grammarian, on Heraclitus' book
  "9.11.71#0": "Archilochus", // quoted for Pyrrhonist leanings
  "8.2.74#0": "Demetrius of Troezen", // grammarian, on Empedocles
};
