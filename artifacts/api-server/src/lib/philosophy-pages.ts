/**
 * Curated links into Garth Kemerling's Philosophy Pages
 * (philosophypages.com) - the Philosophical Dictionary (dy/) and the
 * full philosopher profiles (ph/) - for corpus philosophers and tagged
 * Greek terms.
 *
 * Curation policy (same as kg-links.ts / entity-links.ts): every link
 * was verified at curation time against the live entry text - the
 * anchor exists and the entry's own description identifies the same
 * referent (dates, school, biography). Never guess a homonym:
 *   - "Euclid" (dy/e9.htm#eucl) is the geometer, NOT Euclid of Megara  - 
 *     our Euclides gets no link
 *   - the site's "Simon" entries are Saint-Simon and Simon Foucher,
 *     not Simon the Shoemaker
 *   - "Diogenes" (dy/d9.htm#diog) is the Cynic ("one of the original
 *     Cynics", 400-325 BCE) → Diogenes of Sinope only; of Apollonia
 *     and of Babylon get no link
 *   - "Antisthenes" (dy/a5.htm#antis) is the Socratic/Cynic founder  - 
 *     matches our corpus philosopher
 *   - "Timon of Philius" (sic, dy/t9.htm#timon) is Timon of Phlius
 *     the Pyrrhonist - matches our Timon
 * Checked and absent from the dictionary (no entry to link): Solon and
 * the other Sages, Cleanthes, Stilpo, Arcesilaus, Speusippus, Crantor,
 * Theophrastus, Strato, Epimenides, Pherecydes, Melissus, Philolaus,
 * Archytas, Alcmaeon, Hippasus, Epicharmus, Eudoxus, Anaxarchus, the
 * Cynics after Diogenes, and the minor Socratics/Stoics/Epicureans.
 *
 * Dictionary Greek-term entries occasionally misspell the headword
 * (απειρων for ἄπειρον, εντελεχια for ἐντελέχεια, φρνησις for
 * φρόνησις) and use the Stoic neuter plural αδιαφορα where our tagged
 * lemma is the abstract ἀδιαφορία - each entry's text was checked to
 * describe exactly our term's concept, so the links stand. ἡδονή,
 * λόγος, ἀρχή etc. appear only inside other entries, not as headwords
 * of their own, and are deliberately unlinked.
 *
 * Values are site-relative paths; build URLs with philosophyPagesUrl().
 */
export const PHILOSOPHY_PAGES: Record<string, string> = {
  // ---- full philosopher profiles (ph/) ----
  Plato: "ph/plat.htm",
  Socrates: "ph/socr.htm",
  Aristotle: "ph/aris.htm",
  Epicurus: "ph/epiu.htm",

  // ---- dictionary entries for philosophers (dy/) ----
  Thales: "dy/t.htm#thal",
  Anaximander: "dy/a4.htm#anxr",
  Anaximenes: "dy/a4.htm#anxs",
  Anaxagoras: "dy/a4.htm#anxg",
  Heraclitus: "dy/h2.htm#hera",
  Parmenides: "dy/p.htm#parm",
  "Zeno of Elea": "dy/x.htm#zeno",
  Empedocles: "dy/e5.htm#empe",
  Leucippus: "dy/l5.htm#leuc",
  Democritus: "dy/d2.htm#demo",
  Protagoras: "dy/p9.htm#prot",
  Pythagoras: "dy/p9.htm#pyth",
  Xenophanes: "dy/x.htm#xeph",
  Xenophon: "dy/x.htm#xenp",
  Antisthenes: "dy/a5.htm#antis",
  "Diogenes of Sinope": "dy/d9.htm#diog",
  Aristippus: "dy/a7.htm#arip",
  Xenocrates: "dy/x.htm#xecr",
  Carneades: "dy/c.htm#carne",
  "Zeno of Citium": "dy/x.htm#zenc",
  Chrysippus: "dy/c2.htm#chry",
  Pyrrho: "dy/p9.htm#pyrr",
  Timon: "dy/t9.htm#timon",

  // ---- dictionary entries for Greek terms (dy/) ----
  τέλος: "dy/t.htm#telos",
  ἐπιστήμη: "dy/e5.htm#eptm",
  φιλία: "dy/p5.htm#philia",
  πνεῦμα: "dy/p5.htm#pneuma",
  ἐποχή: "dy/e5.htm#epoc",
  νοῦς: "dy/n9.htm#nous",
  ἀταραξία: "dy/a9.htm#atar",
  ἄπειρον: "dy/a5.htm#apei",
  ἐντελέχεια: "dy/e5.htm#entel",
  φρόνησις: "dy/p5.htm#phro",
  ἀδιαφορία: "dy/a.htm#adia",
};

/** Full URL for a curated Philosophy Pages path. */
export function philosophyPagesUrl(path: string): string {
  return `https://www.philosophypages.com/${path}`;
}
