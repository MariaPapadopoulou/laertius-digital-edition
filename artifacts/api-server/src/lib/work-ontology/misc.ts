import type { WorkFacet } from "./types";

/**
 * Remaining works: nodes whose only author edges are hedged (reported or
 * disputed claims mint no direct lo:wrote triple, so the node is
 * "authorless" in the graph), plus the historiographers and Timon.
 *
 * Identities of the hedged nodes (from the claims layer, documented here so
 * the facets can be checked against the right author):
 * - "A physical treatise (chiefly on medicine)" - Alcmaeon (8.83). D.L.
 *   himself quotes the book's opening (fr. B1) → excerpts.
 * - Plato's spurious dialogues (3.62): Sisyphus, Alcyon, Demodocus and
 *   Eryxias survive in the Appendix Platonica (Alcyon also under Lucian) →
 *   extant; Chelidon, Midon, Nicias, Phaeacians and the dialogue Epimenides
 *   are titles only → lost, topic null (nothing but the title is known).
 *   The extant four keep the usual dialogue facets (Sisyphus and Demodocus
 *   on deliberation, Eryxias on wealth → ethics; Alcyon on divine power →
 *   physics).
 * - "Dialogues of Dogs" and "Octaëteris" - Eudoxus (8.89-90, reported).
 *   Fables → miscellany; the eight-year calendar cycle → astronomy.
 * - "Hymn to Apollo" and "Poem on the invasion of Xerxes" - Empedocles
 *   (8.57, reported; both destroyed early per the report) → lyric and epic.
 * - "Nautical Astronomy", "On the Equinox", "On the Solstice" - Thales
 *   (1.23). The Nautical Astronomy was a poem (also claimed for Phocus of
 *   Samos); the two treatises are prose.
 * - "On Deliberation", "On Doing Ill", "On Reason, or On Expediency"  - 
 *   the dialogues "some add" to Simon the shoemaker (2.123) → ethics.
 * - "Paean (composed in prison)" - Socrates (2.42); D.L. quotes its opening
 *   line → excerpts.
 * - "The Constitutions of Athens and Sparta" - reported for Xenophon
 *   (attribution denied by Demetrius Magnes). Both constitutions survive in
 *   Xenophon's corpus (the Athenian one is the pseudo-Xenophon "Old
 *   Oligarch") → extant; constitutions described → history.
 *
 * Timon: the Silli and the Indalmoi ("The Conceits") survive in extensive
 * verbatim quotation → excerpts; D.L. 9.105 quotes On the Senses' famous
 * honey sentence → excerpts. The "Funeral Banquet of Arcesilaus" is an
 * encomium of a person → biography, but its form (prose or verse) is
 * unattested → null. Apollodorus' Chronology was written in comic trimeters
 * (verse!) and is constantly quoted by D.L. → excerpts.
 */
export const MISC_WORKS: Record<string, WorkFacet> = {
  // ---- hedged/authorless nodes ----
  "A physical treatise (chiefly on medicine)": { form: "prose", topic: "medicine", survival: "excerpts" },
  "Acephali, or Sisyphus": { form: "prose", topic: "ethics", survival: "extant" },
  Alcyon: { form: "prose", topic: "physics", survival: "extant" },
  Chelidon: { form: "prose", topic: null },
  Demodocus: { form: "prose", topic: "ethics", survival: "extant" },
  "Dialogues of Dogs": { form: "prose", topic: "miscellany" },
  Epimenides: { form: "prose", topic: null },
  "Eryxias, or Erasistratus": { form: "prose", topic: "ethics", survival: "extant" },
  "Hymn to Apollo": { form: "verse", topic: "lyric" },
  "Midon, or Horse-breeder": { form: "prose", topic: null },
  "Nautical Astronomy": { form: "verse", topic: "astronomy" },
  Nicias: { form: "prose", topic: null },
  Octaëteris: { form: "prose", topic: "astronomy" },
  "On Deliberation": { form: "prose", topic: "ethics" },
  "On Doing Ill": { form: "prose", topic: "ethics" },
  "On Reason, or On Expediency": { form: "prose", topic: "ethics" },
  "On the Equinox": { form: "prose", topic: "astronomy" },
  "On the Solstice": { form: "prose", topic: "astronomy" },
  "Paean (composed in prison)": { form: "verse", topic: "lyric", survival: "excerpts" },
  "Poem on the invasion of Xerxes": { form: "verse", topic: "epic" },
  "The Constitutions of Athens and Sparta": { form: "prose", topic: "history", survival: "extant" },
  "The Phaeacians": { form: "prose", topic: null },

  // ---- Apollodorus of Athens ----
  Chronology: { form: "verse", topic: "chronology", survival: "excerpts" },

  // ---- Antileon ----
  // Περὶ χρόνων, cited at 3.3 for Plato's deme. Lost chronological
  // prose (FGrHist 247); only the D.L. citation survives.
  "On Dates": { form: "prose", topic: "chronology", survival: "lost" },

  // ---- Aristoxenus ----
  "On Pythagoras and his Associates": { form: "prose", topic: "biography", survival: "excerpts" },

  // ---- Alexander Polyhistor ----
  "Successions of Philosophers": { form: "prose", topic: "doxography", survival: "excerpts" },

  // ---- Antisthenes of Rhodes ----
  Successions: { form: "prose", topic: "doxography", survival: "excerpts" },

  // ---- Plutarch ----
  // Survival: extant in full in the Lives corpus.
  "Life of Lysander and Sulla": { form: "prose", topic: "biography", survival: "extant" },

  // ---- Demetrius of Magnesia ----
  Homonyms: { form: "prose", topic: "biography", survival: "excerpts" },

  // ---- Eumelus ----
  Histories: { form: "prose", topic: "history", survival: "excerpts" },

  // ---- Ariston of Ceos ----
  "On Heraclitus": { form: "prose", topic: "biography", survival: "excerpts" },

  // ---- Demetrius of Troezen ----
  "Against the Sophists": { form: "prose", topic: null, survival: "excerpts" },

  // ---- Hermippus ----
  "On the Sages": { form: "prose", topic: "biography" },

  // ---- Achaeus of Eretria (person-works.ts) ----
  // The satyr play Omphale: satyr drama is classed under tragedy (its
  // poets, metres and festival slot are tragic; TrGF prints it), and
  // D.L. himself quotes two of its lines at 2.133 → excerpts.
  Omphale: { form: "verse", topic: "tragedy", survival: "excerpts" },

  // ---- Timon of Phlius ----
  "Funeral Banquet of Arcesilaus": { form: null, topic: "biography" },
  "On the Senses": { form: "prose", topic: "dialectic", survival: "excerpts" },
  Pytho: { form: "prose", topic: "dialectic" },
  "Silli (lampoons, in three books)": { form: "verse", topic: "satire", survival: "excerpts" },
  "The Conceits": { form: "verse", topic: "lyric", survival: "excerpts" },
};
