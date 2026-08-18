import type { WorkFacet } from "./types";

/**
 * Works of Plato and the Old Academy: Plato, Speusippus, Xenocrates, Crantor,
 * Heraclides Ponticus.
 *
 * Judgment calls:
 * - Plato's dialogues are classified by D.L.'s own subtitles (3.57-61),
 *   which he presents as statements of subject: "or On Rhetoric" → rhetoric
 *   (Gorgias, despite its modern reading as ethics), "or On the Iliad" →
 *   poetics (Ion), "The Funeral Oration" → rhetoric (Menexenus). Where D.L.
 *   also assigns a class we follow it: Critias is "ethical" (3.60) despite
 *   the Atlantis subtitle; Sophist and Parmenides are "logical" (3.58) →
 *   dialectic; Laws/Minos/Epinomis are political.
 * - "Republic" is a conflated node (Plato's + Diogenes of Sinope's Politeia,
 *   documented in the graph): both are politics, so the facet is safe.
 * - Heraclides' opaque polemic titles (Reply to Dionysius, Reply to Metron's
 *   Doctrines, "A second with the same title") and "Of Theorems" keep topic
 *   null; "Works by him survive of great beauty and excellence" is a
 *   catalogue remark, not a title - both facets null.
 * - Shared nodes curated here: "Of Happiness (one book)" and "Solutions (one
 *   book)" (Heraclides + Theophrastus), "Of Justice (three books)"
 *   (Heraclides + Strato).
 * - Survival: every dialogue in D.L.'s tetralogies plus the Epistles is
 *   transmitted in the Platonic corpus → extant (transmission, not
 *   authenticity: Epinomis, Minos, Theages, the two Alcibiades included).
 *   "Republic" is the conflated node (Diogenes of Sinope's Politeia is
 *   lost) → survival null. Crantor's On Grief survives in verbatim
 *   quotation (Plutarch's Consolation, Cicero) → excerpts. Speusippus,
 *   Xenocrates and Heraclides are otherwise lost.
 */
export const PLATO_ACADEMY_WORKS: Record<string, WorkFacet> = {
  // ---- Plato ----
  "Alcibiades, or On the Nature of Man": { form: "prose", topic: "ethics", survival: "extant" },
  "Apology of Socrates": { form: "prose", topic: "ethics", survival: "extant" },
  "Charmides, or On Temperance": { form: "prose", topic: "ethics", survival: "extant" },
  "Clitophon, or Introduction": { form: "prose", topic: "ethics", survival: "extant" },
  "Cratylus, or On Correctness of Names": { form: "prose", topic: "dialectic", survival: "extant" },
  "Critias, or Story of Atlantis": { form: "prose", topic: "ethics", survival: "extant" },
  "Crito, or On what is to be done": { form: "prose", topic: "ethics", survival: "extant" },
  "Epinomis, or Nocturnal Council": { form: "prose", topic: "politics", survival: "extant" },
  "Epistles (thirteen in number)": { form: "prose", topic: "letters", survival: "extant" },
  "Euthydemus, or The Eristic": { form: "prose", topic: "dialectic", survival: "extant" },
  "Euthyphro, or On Holiness": { form: "prose", topic: "ethics", survival: "extant" },
  "Gorgias, or On Rhetoric": { form: "prose", topic: "rhetoric", survival: "extant" },
  "Hipparchus, or The Lover of Gain": { form: "prose", topic: "ethics", survival: "extant" },
  "Hippias (major), or On Beauty": { form: "prose", topic: "ethics", survival: "extant" },
  "Hippias (minor), or On Falsehood": { form: "prose", topic: "ethics", survival: "extant" },
  "Ion, or On the Iliad": { form: "prose", topic: "poetics", survival: "extant" },
  "Laches, or On Courage": { form: "prose", topic: "ethics", survival: "extant" },
  "Laws, or On Legislation": { form: "prose", topic: "politics", survival: "extant" },
  "Lysis, or On Friendship": { form: "prose", topic: "ethics", survival: "extant" },
  "Menexenus, or The Funeral Oration": { form: "prose", topic: "rhetoric", survival: "extant" },
  "Meno, or On Virtue": { form: "prose", topic: "ethics", survival: "extant" },
  "Minos, or On Law": { form: "prose", topic: "politics", survival: "extant" },
  "Parmenides, or On Ideas": { form: "prose", topic: "dialectic", survival: "extant" },
  "Phaedo, or On the Soul": { form: "prose", topic: "ethics", survival: "extant" },
  "Phaedrus, or On Love": { form: "prose", topic: "ethics", survival: "extant" },
  "Philebus, or On Pleasure": { form: "prose", topic: "ethics", survival: "extant" },
  "Protagoras, or Sophists": { form: "prose", topic: "ethics", survival: "extant" },
  Republic: { form: "prose", topic: "politics", survival: null },
  "Second Alcibiades, or On Prayer": { form: "prose", topic: "ethics", survival: "extant" },
  "Sophist, or On Being": { form: "prose", topic: "dialectic", survival: "extant" },
  "Statesman, or On Monarchy": { form: "prose", topic: "politics", survival: "extant" },
  "The Banquet, or On the Good": { form: "prose", topic: "ethics", survival: "extant" },
  "The Rivals, or On Philosophy": { form: "prose", topic: "ethics", survival: "extant" },
  "Theaetetus, or On Knowledge": { form: "prose", topic: "dialectic", survival: "extant" },
  "Theages, or On Philosophy": { form: "prose", topic: "ethics", survival: "extant" },
  "Timaeus, or On Nature": { form: "prose", topic: "physics", survival: "extant" },

  // ---- Speusippus ----
  Definitions: { form: "prose", topic: "dialectic" },
  "Eulogy of Plato": { form: "prose", topic: "biography" },
  "On Justice": { form: "prose", topic: "ethics" },
  "On Legislation": { form: "prose", topic: "politics" },
  "On Pleasure (1 book)": { form: "prose", topic: "ethics" },
  "On Wealth (1 book)": { form: "prose", topic: "ethics" },
  "The Philosopher": { form: "prose", topic: "ethics" },

  // ---- Xenocrates ----
  "Elementary Principles of Monarchy (4 books, dedicated to Alexander)": { form: "prose", topic: "politics" },
  "On Ideas": { form: "prose", topic: "dialectic" },
  "On Nature (6 books)": { form: "prose", topic: "physics" },
  "On the Gods (2 books)": { form: "prose", topic: "physics" },
  "On the Good": { form: "prose", topic: "ethics" },
  "On the Soul (2 books)": { form: "prose", topic: "physics" },
  "On the Writings of Parmenides": { form: "prose", topic: "doxography" },
  "On Wisdom (6 books)": { form: "prose", topic: "ethics" },
  "Solution of Logical Problems (10 books)": { form: "prose", topic: "dialectic" },

  // ---- Crantor ----
  "On Grief": { form: "prose", topic: "ethics", survival: "excerpts" },

  // ---- Heraclides Ponticus ----
  "A Reply to Dionysius (one book)": { form: "prose", topic: null },
  "A Reply to Metron’s Doctrines (one book)": { form: "prose", topic: null },
  "A second with the same title": { form: "prose", topic: null },
  "Admonitions (one book)": { form: "prose", topic: "ethics" },
  "Against Democritus": { form: "prose", topic: "physics" },
  "Against Zeno’s Doctrines (one book)": { form: "prose", topic: "dialectic" },
  "Characters (one book)": { form: "prose", topic: "ethics" },
  "Concerning Prevision (one book)": { form: "prose", topic: "physics" },
  "Expositions in Reply to Democritus (one book)": { form: "prose", topic: "physics" },
  "Expositions of Heraclitus (four books)": { form: "prose", topic: "doxography" },
  "Logical Proposition (one book)": { form: "prose", topic: "dialectic" },
  "Of Conjecture (one book)": { form: "prose", topic: "dialectic" },
  "Of Courage (one book)": { form: "prose", topic: "ethics" },
  "Of Happiness (one book)": { form: "prose", topic: "ethics" },
  "Of Justice (three books)": { form: "prose", topic: "ethics" },
  "Of Nature": { form: "prose", topic: "physics" },
  "Of Piety (five books)": { form: "prose", topic: "ethics" },
  "Of Poetry and Poets (one book)": { form: "prose", topic: "poetics" },
  "Of Species (one book)": { form: "prose", topic: "dialectic" },
  "Of Temperance (one book)": { form: "prose", topic: "ethics" },
  "Of the Good (one book)": { form: "prose", topic: "ethics" },
  "Of Theorems (one book)": { form: "prose", topic: null },
  "Of Virtue in general (one book)": { form: "prose", topic: "ethics" },
  "On the Three Tragic Poets (one book)": { form: "prose", topic: "poetics" },
  "On Various Ways of Life (two books)": { form: "prose", topic: "ethics" },
  "Solutions (one book)": { form: "prose", topic: "dialectic" },
  "Solutions of Eristic Problems (two books)": { form: "prose", topic: "dialectic" },
  "Solutions of Homeric Problems (two books)": { form: "prose", topic: "poetics" },
  "The Causes of Diseases (one book)": { form: "prose", topic: "medicine" },
  "Works by him survive of great beauty and excellence": { form: null, topic: null },
};
