import type { WorkFacet } from "./types";

/**
 * Works of the Cynics (Diogenes of Sinope, D.L. 6.80; Monimus 6.83; Crates
 * of Thebes 6.98; Menippus 6.101) and of Epicurus (the "best" books listed
 * at D.L. 10.27-28).
 *
 * Judgment calls:
 * - Diogenes: the seven tragedies (Helen, Thyestes, Heracles, Achilles,
 *   Medea, Chrysippus, Oedipus) are verse tragedy; the named dialogues
 *   (Cephalion, Ichthyas, Jackdaw, Pordalus, ...) are Cynic moral dialogues
 *   → ethics, like the Socratics' named dialogues.
 * - Menippus is the eponym of satire: Necromancy and Wills are mixed
 *   prose-verse (the Menippean form); the parody "Epistles artificially
 *   composed as if by the gods" is satire in prose.
 * - Epicurus: canonic/epistemology (the Canon, Of Presentation, Against the
 *   Megarians) is dialectic; theology-free "Of Piety" is the virtue → ethics.
 *   "Chaeredemus" (eponym, content unknown) and "Problems" keep topic null.
 * - Survival: "On Nature (37 books)" survives in the Herculaneum papyri →
 *   excerpts; "Sovran Maxims (Kyriai Doxai)" is preserved entire inside
 *   D.L. 10.139-154 → extant. "Symposium" is a conflated node (Xenophon's
 *   extant dialogue + Epicurus' lost one): divergent subjects → topic null,
 *   divergent transmission → survival null. Crates' and Diogenes' Epistles
 *   stay lost - the surviving Cynic epistles are later pseudepigrapha.
 * - Shared nodes curated here: "On Love" (Diogenes + Simon), "Of Images"
 *   (Epicurus + Heraclides Ponticus), "Of Vision" (Epicurus + Strato + Zeno
 *   of Citium - all three treated vision as physics), "Symposium" (Epicurus
 *   + Xenophon). "Letters" (Diogenes + Demetrius) is curated in
 *   peripatos.ts.
 */
export const CYNICS_EPICUREANS_WORKS: Record<string, WorkFacet> = {
  // ---- Diogenes of Sinope ----
  Achilles: { form: "verse", topic: "tragedy" },
  Aristarchus: { form: "prose", topic: "ethics" },
  "Art of Ethics": { form: "prose", topic: "ethics" },
  Cephalion: { form: "prose", topic: "ethics" },
  Chrysippus: { form: "verse", topic: "tragedy" },
  Helen: { form: "verse", topic: "tragedy" },
  Heracles: { form: "verse", topic: "tragedy" },
  Hypsias: { form: "prose", topic: "ethics" },
  Ichthyas: { form: "prose", topic: "ethics" },
  Jackdaw: { form: "prose", topic: "ethics" },
  Medea: { form: "verse", topic: "tragedy" },
  Oedipus: { form: "verse", topic: "tragedy" },
  "On Death": { form: "prose", topic: "ethics" },
  "On Love": { form: "prose", topic: "ethics" },
  "On Wealth": { form: "prose", topic: "ethics" },
  Pordalus: { form: "prose", topic: "ethics" },
  "The Athenian Demos": { form: "prose", topic: "ethics" },
  Theodorus: { form: "prose", topic: "ethics" },
  Thyestes: { form: "verse", topic: "tragedy" },

  // ---- Monimus ----
  "On Impulses": { form: "prose", topic: "ethics" },

  // ---- Crates of Thebes ----
  Epistles: { form: "prose", topic: "letters" },
  Tragedies: { form: "verse", topic: "tragedy" },

  // ---- Menippus ----
  "Epistles artificially composed as if by the gods": { form: "prose", topic: "satire" },
  Necromancy: { form: "mixed", topic: "satire" },
  Wills: { form: "mixed", topic: "satire" },

  // ---- Epicurus ----
  "Against the Megarians": { form: "prose", topic: "dialectic" },
  Chaeredemus: { form: "prose", topic: null },
  "Epitome of Objections to the Physicists": { form: "prose", topic: "physics" },
  "Of Atoms and Void": { form: "prose", topic: "physics" },
  "Of Choice and Avoidance": { form: "prose", topic: "ethics" },
  "Of Fate": { form: "prose", topic: "physics" },
  "Of Human Life (4 books)": { form: "prose", topic: "ethics" },
  "Of Images": { form: "prose", topic: "physics" },
  "Of Just Dealing": { form: "prose", topic: "ethics" },
  "Of Justice and the other Virtues": { form: "prose", topic: "ethics" },
  "Of Kingship": { form: "prose", topic: "politics" },
  "Of Love": { form: "prose", topic: "ethics" },
  "Of Music": { form: "prose", topic: "music" },
  "Of Piety": { form: "prose", topic: "ethics" },
  "Of Presentation": { form: "prose", topic: "dialectic" },
  "Of the Standard, a work entitled Canon": { form: "prose", topic: "dialectic" },
  "Of Vision": { form: "prose", topic: "physics" },
  "On Nature (37 books)": { form: "prose", topic: "physics", survival: "excerpts" },
  Problems: { form: "prose", topic: null },
  "Sovran Maxims (Kyriai Doxai)": { form: "prose", topic: "ethics", survival: "extant" },
  Symposium: { form: "prose", topic: null, survival: null },
};
