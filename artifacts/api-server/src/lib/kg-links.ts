/**
 * External authority links per philosopher, fetched from Wikidata claims
 * (VIAF P214, Britannica P1417, English Wikipedia sitelink for DBpedia,
 * InPhO P863 cross-checked against the InPhO API - inphoproject.org).
 * Generated at curation time; runtime stays offline and key-less.
 *
 * Note: InPhO 3566 ("Menedemus") is assigned to Menedemus of Eretria, not
 * the Cynic - InPhO's own `wiki` field points to the Eretrian's Wikipedia
 * article, overriding a misplaced Wikidata P863 claim on the Cynic.
 */
export interface ExternalLinks {
  viaf?: string;
  britannica?: string;
  /** English Wikipedia title; DBpedia URI derives from it. */
  enwiki?: string;
  /** InPhO entity path (Indiana Philosophy Ontology), e.g. "thinker/3724". */
  inpho?: string;
}

export const EXTERNAL_LINKS: Record<string, ExternalLinks> = {
  Thales: { viaf: "290923996", britannica: "biography/Thales-of-Miletus", enwiki: "Thales of Miletus", inpho: "thinker/4003" },
  Solon: { viaf: "14908273", britannica: "biography/Solon", enwiki: "Solon" },
  Chilon: { viaf: "5317648", enwiki: "Chilon of Sparta" },
  Pittacus: { viaf: "22528281", britannica: "biography/Pittacus-of-Mytilene", enwiki: "Pittacus of Mytilene" },
  Bias: { viaf: "52080968", enwiki: "Bias of Priene" },
  Cleobulus: { viaf: "17613996", enwiki: "Cleobulus", inpho: "thinker/2824" },
  Periander: { viaf: "15160053", britannica: "biography/Periander", enwiki: "Periander" },
  Anacharsis: { viaf: "282823182", britannica: "biography/Anacharsis", enwiki: "Anacharsis", inpho: "thinker/2522" },
  Myson: { viaf: "47153076", enwiki: "Myson of Chenae" },
  Epimenides: { viaf: "78456017", britannica: "biography/Epimenides", enwiki: "Epimenides", inpho: "thinker/2971" },
  Pherecydes: { viaf: "476149294087380520553", britannica: "biography/Pherecydes-of-Syros", enwiki: "Pherecydes of Syros", inpho: "thinker/3709" },
  Anaximander: { viaf: "280059448", britannica: "biography/Anaximander", enwiki: "Anaximander", inpho: "thinker/2527" },
  Anaximenes: { viaf: "146054053", britannica: "biography/Anaximenes-of-Miletus", enwiki: "Anaximenes of Miletus", inpho: "thinker/2528" },
  Anaxagoras: { viaf: "24645587", britannica: "biography/Anaxagoras", enwiki: "Anaxagoras", inpho: "thinker/2524" },
  Archelaus: { viaf: "10647821", enwiki: "Archelaus (philosopher)" },
  Socrates: { viaf: "88039167", britannica: "biography/Socrates", enwiki: "Socrates", inpho: "thinker/3919" },
  Xenophon: { viaf: "89597697", britannica: "biography/Xenophon", enwiki: "Xenophon", inpho: "thinker/4150" },
  Aeschines: { viaf: "202275989", enwiki: "Aeschines of Sphettus" },
  Aristippus: { viaf: "43436762", britannica: "biography/Aristippus", enwiki: "Aristippus", inpho: "thinker/2551" },
  Phaedo: { viaf: "72189279", britannica: "biography/Phaedo-Greek-philosopher", enwiki: "Phaedo of Elis" },
  Euclides: { viaf: "25396460", britannica: "biography/Eucleides-of-Megara", enwiki: "Euclid of Megara", inpho: "thinker/2977" },
  Stilpo: { viaf: "74242506", britannica: "biography/Stilpon", enwiki: "Stilpo", inpho: "thinker/3956" },
  Crito: { viaf: "57001413", enwiki: "Crito of Alopece" },
  Simon: { viaf: "79158790505838850506", enwiki: "Simon the Shoemaker" },
  Simmias: { viaf: "24990841", enwiki: "Simmias of Thebes" },
  Cebes: { viaf: "84557568", enwiki: "Cebes", inpho: "thinker/2773" },
  "Menedemus of Eretria": { viaf: "50021337", britannica: "biography/Menedemus-of-Eretria", enwiki: "Menedemus", inpho: "thinker/3566" },
  Plato: { viaf: "108159964", britannica: "biography/Plato", enwiki: "Plato", inpho: "thinker/3724" },
  Speusippus: { viaf: "69016459", britannica: "biography/Speusippus", enwiki: "Speusippus", inpho: "thinker/3935" },
  Xenocrates: { viaf: "99954624", britannica: "biography/Xenocrates", enwiki: "Xenocrates", inpho: "thinker/4148" },
  Polemo: { viaf: "215871530", enwiki: "Polemon of Athens" },
  "Crates of Athens": { enwiki: "Crates of Athens" },
  Crantor: { viaf: "536149294229480521136", britannica: "biography/Crantor", enwiki: "Crantor", inpho: "thinker/2859" },
  Arcesilaus: { viaf: "15159471", britannica: "biography/Arcesilaus", enwiki: "Arcesilaus", inpho: "thinker/2545" },
  Bion: { viaf: "106932431", britannica: "biography/Bion-of-Borysthenes", enwiki: "Bion of Borysthenes" },
  Lacydes: { viaf: "1245174440374711360006", enwiki: "Lacydes of Cyrene" },
  Carneades: { viaf: "61151889", britannica: "biography/Carneades", enwiki: "Carneades", inpho: "thinker/2762" },
  Aristotle: { viaf: "7524651", britannica: "biography/Aristotle", enwiki: "Aristotle", inpho: "thinker/2553" },
  Theophrastus: { viaf: "265397758", britannica: "biography/Theophrastus", enwiki: "Theophrastus", inpho: "thinker/4006" },
  Strato: { viaf: "239298019", britannica: "biography/Straton-of-Lampsacus", enwiki: "Strato of Lampsacus", inpho: "thinker/3961" },
  Lyco: { viaf: "17614371", enwiki: "Lyco of Troas" },
  "Demetrius of Phalerum": { viaf: "22955539", britannica: "biography/Demetrius-of-Phaleron", enwiki: "Demetrius of Phalerum" },
  "Heraclides Ponticus": { viaf: "27866092", britannica: "biography/Heracleides-Ponticus", enwiki: "Heraclides Ponticus", inpho: "thinker/3190" },
  Antisthenes: { viaf: "79142539", britannica: "biography/Antisthenes", enwiki: "Antisthenes", inpho: "thinker/2538" },
  "Diogenes of Sinope": { viaf: "13557547", britannica: "biography/Diogenes-Greek-philosopher", enwiki: "Diogenes", inpho: "thinker/2924" },
  Monimus: { viaf: "47151107", enwiki: "Monimus" },
  Onesicritus: { viaf: "285085450", enwiki: "Onesicritus" },
  "Crates of Thebes": { viaf: "807154", britannica: "biography/Crates-of-Thebes", enwiki: "Crates of Thebes", inpho: "thinker/2860" },
  Metrocles: { viaf: "17614424", britannica: "biography/Metrocles", enwiki: "Metrocles", inpho: "thinker/3574" },
  Hipparchia: { viaf: "288151246553444132180", enwiki: "Hipparchia of Maroneia", inpho: "thinker/3218" },
  Menippus: { viaf: "106974905", britannica: "biography/Menippus", enwiki: "Menippus" },
  "Menedemus the Cynic": { viaf: "17614411", enwiki: "Menedemus the Cynic" },
  "Zeno of Citium": { viaf: "261896996", britannica: "biography/Zeno-of-Citium", enwiki: "Zeno of Citium", inpho: "thinker/4165" },
  "Ariston of Chios": { viaf: "4915249", britannica: "biography/Ariston-of-Chios", enwiki: "Aristo of Chios", inpho: "thinker/2552" },
  "Dionysius the Renegade": { viaf: "57001552", enwiki: "Dionysius the Renegade" },
  Cleanthes: { viaf: "31867941", britannica: "biography/Cleanthes", enwiki: "Cleanthes", inpho: "thinker/2822" },
  Sphaerus: { viaf: "17614623", enwiki: "Sphaerus" },
  Chrysippus: { viaf: "265285548", britannica: "biography/Chrysippus", enwiki: "Chrysippus", inpho: "thinker/2809" },
  Pythagoras: { viaf: "162237897", britannica: "biography/Pythagoras", enwiki: "Pythagoras", inpho: "thinker/3764" },
  Empedocles: { viaf: "297576907", britannica: "biography/Empedocles", enwiki: "Empedocles", inpho: "thinker/2966" },
  Epicharmus: { viaf: "50019442", britannica: "biography/Epicharmus-Greek-poet", enwiki: "Epicharmus of Cos", inpho: "thinker/2968" },
  Archytas: { viaf: "40191578", britannica: "biography/Archytas-of-Tarentum", enwiki: "Archytas", inpho: "thinker/2547" },
  Alcmaeon: { viaf: "78151776822718012637", britannica: "biography/Alcmaeon-Greek-philosopher-and-physiologist", enwiki: "Alcmaeon of Croton", inpho: "thinker/2499" },
  Hippasus: { viaf: "76706220", britannica: "biography/Hippasus-of-Metapontum", enwiki: "Hippasus", inpho: "thinker/3219" },
  Philolaus: { viaf: "285751474", britannica: "biography/Philolaus", enwiki: "Philolaus", inpho: "thinker/3715" },
  Eudoxus: { viaf: "10637157", britannica: "biography/Eudoxus-of-Cnidus", enwiki: "Eudoxus of Cnidus", inpho: "thinker/2978" },
  Heraclitus: { viaf: "101906635", britannica: "biography/Heraclitus", enwiki: "Heraclitus", inpho: "thinker/3191" },
  Xenophanes: { viaf: "100175475", britannica: "biography/Xenophanes", enwiki: "Xenophanes", inpho: "thinker/4149" },
  Parmenides: { viaf: "57151776745618011100", britannica: "biography/Parmenides-Greek-philosopher", enwiki: "Parmenides", inpho: "thinker/3682" },
  Melissus: { viaf: "305863212", britannica: "biography/Melissus-of-Samos", enwiki: "Melissus of Samos", inpho: "thinker/3561" },
  "Zeno of Elea": { viaf: "16003086", britannica: "biography/Zeno-of-Elea", enwiki: "Zeno of Elea", inpho: "thinker/4166" },
  Leucippus: { viaf: "71029333", britannica: "biography/Leucippus", enwiki: "Leucippus", inpho: "thinker/3447" },
  Democritus: { viaf: "49224361", britannica: "biography/Democritus", enwiki: "Democritus", inpho: "thinker/2900" },
  Protagoras: { viaf: "286687547", britannica: "biography/Protagoras-Greek-philosopher", enwiki: "Protagoras", inpho: "thinker/3755" },
  "Diogenes of Apollonia": { viaf: "177095580", britannica: "biography/Diogenes-of-Apollonia", enwiki: "Diogenes of Apollonia", inpho: "thinker/2922" },
  Anaxarchus: { viaf: "49613693", enwiki: "Anaxarchus", inpho: "thinker/2525" },
  Timon: { viaf: "45102510", britannica: "biography/Timon-of-Phlius", enwiki: "Timon of Phlius", inpho: "thinker/4019" },
  Epicurus: { viaf: "64141756", britannica: "biography/Epicurus", enwiki: "Epicurus", inpho: "thinker/2970" },
};
