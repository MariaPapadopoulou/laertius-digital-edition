import type { WorkFacet } from "./types";

/**
 * Works of the Stoa: Zeno of Citium (D.L. 7.4), Cleanthes (7.174-175),
 * Chrysippus (7.189-202, the surviving part of D.L.'s catalogue - heavily
 * logical), Sphaerus (7.178), Herillus (7.166), Dionysius the Renegade
 * (7.167), and the four titles D.L. reports for Ariston of Chios only to
 * dispute them (7.163: Panaetius and Sosicrates give all but the letters to
 * Ariston the Peripatetic - hence the nodes are authorless).
 *
 * Judgment calls:
 * - Stoic logic, epistemology and philosophy of language (judgements,
 *   syllogisms, predicates, expressions, solecisms, signs, presentation,
 *   the Mentiens and Nobody puzzles, common-sense polemics) are dialectic  - 
 *   the Stoics' own classification (see barrel header).
 * - Zeno's "Exposition of Doctrine" spans the whole system: topic null (a
 *   curated statement that no single branch can be responsibly assigned).
 *   "Recollections of Crates" is memoir → biography; "Pythagorean
 *   Questions" treats another school → doxography, like Cleanthes' two
 *   expository works on Heraclitus and on Zeno's physics.
 * - Sphaerus' "Of the Spartan Constitution" is a constitution described →
 *   history (same call as "The Constitutions of Athens and Sparta");
 *   "Of Lycurgus and Socrates" is biography.
 * - Ariston's "Dissertations on Philosophy" could sit in any branch: topic
 *   null. His "Exhortations" is protreptic → ethics.
 * - Survival: everything here is lost. Verbatim excerpts of Epicurus' "Of
 *   the End" survive (Athenaeus, D.L. 10.6) but Cleanthes' homonym does
 *   not, so the conflated node carries survival:null (divergent
 *   transmission). The Herculaneum "Logical Questions" papyrus is
 *   Chrysippan, but its identification with any single title in D.L.'s
 *   catalogue is uncertain - no excerpts marker rather than guess.
 * - Shared nodes curated here: "Of the End" (Cleanthes + Epicurus), "Of the
 *   Gods" (Cleanthes + Epicurus + Simon - theology → physics for all
 *   three). "Of Vision" (Zeno + Epicurus + Strato) is curated in
 *   cynics-epicureans.ts.
 */
export const STOA_WORKS: Record<string, WorkFacet> = {
  // ---- Zeno of Citium ----
  "A Handbook of Rhetoric": { form: "prose", topic: "rhetoric" },
  Ethics: { form: "prose", topic: "ethics" },
  "Exposition of Doctrine": { form: "prose", topic: null },
  "Homeric Problems (5 books)": { form: "prose", topic: "poetics" },
  "Of Duty": { form: "prose", topic: "ethics" },
  "Of Emotions": { form: "prose", topic: "ethics" },
  "Of Greek Education": { form: "prose", topic: "ethics" },
  "Of Impulse, or Human Nature": { form: "prose", topic: "ethics" },
  "Of Law": { form: "prose", topic: "politics" },
  "Of Life according to Nature": { form: "prose", topic: "ethics" },
  "Of Signs": { form: "prose", topic: "dialectic" },
  "Of the Reading of Poetry": { form: "prose", topic: "poetics" },
  "Of the Whole World": { form: "prose", topic: "physics" },
  "Of Varieties of Style": { form: "prose", topic: "rhetoric" },
  "On the Nature of Man": { form: "prose", topic: "physics" },
  "Pythagorean Questions": { form: "prose", topic: "doxography" },
  "Recollections of Crates": { form: "prose", topic: "biography" },
  "Refutations (2 books)": { form: "prose", topic: "dialectic" },
  "Republic (Politeia)": { form: "prose", topic: "politics" },
  Solutions: { form: "prose", topic: "dialectic" },
  Universals: { form: "prose", topic: "dialectic" },

  // ---- Cleanthes ----
  "Interpretations of Heraclitus (4 books)": { form: "prose", topic: "doxography" },
  "Of Duty (3 books)": { form: "prose", topic: "ethics" },
  "Of Impulse (2 books)": { form: "prose", topic: "ethics" },
  "Of the End": { form: "prose", topic: "ethics", survival: null },
  "Of the Gods": { form: "prose", topic: "physics" },
  "Of Time": { form: "prose", topic: "physics" },
  "Of Zeno's Natural Philosophy (2 books)": { form: "prose", topic: "doxography" },

  // ---- Chrysippus ----
  "Art of Dialectic, addressed to Aristagoras": { form: "prose", topic: "dialectic" },
  "Attack upon Common Sense, addressed to Metrodorus (6 books)": { form: "prose", topic: "dialectic" },
  "De Republica": { form: "prose", topic: "politics" },
  "Defence of Common Sense, addressed to Gorgippides (7 books)": { form: "prose", topic: "dialectic" },
  "Definitions of the Good or Virtuous, addressed to Metrodorus (2 books)": { form: "prose", topic: "ethics" },
  "Dialectical Definitions addressed to Metrodorus (6 books)": { form: "prose", topic: "dialectic" },
  "Handbook of Arguments and Moods, addressed to Dioscurides (5 books)": { form: "prose", topic: "dialectic" },
  "Logical Theses": { form: "prose", topic: "dialectic" },
  "Of a True Disjunctive Judgement, addressed to Gorgippides": { form: "prose", topic: "dialectic" },
  "Of a True Hypothetical Judgement, addressed to Gorgippides (4 books)": { form: "prose", topic: "dialectic" },
  "Of Judgements": { form: "prose", topic: "dialectic" },
  "Of Negative Judgements, addressed to Aristagoras (3 books)": { form: "prose", topic: "dialectic" },
  "Of Poems, addressed to Philomathes": { form: "prose", topic: "poetics" },
  "Of Predicates, addressed to Metrodorus (10 books)": { form: "prose", topic: "dialectic" },
  "Of Rhetoric, addressed to Dioscurides (4 books)": { form: "prose", topic: "rhetoric" },
  "Of Singular and Plural Expressions (6 books)": { form: "prose", topic: "dialectic" },
  "Of Syllogisms (3 books)": { form: "prose", topic: "dialectic" },
  "Of the Complex Judgement, addressed to Athenades (2 books)": { form: "prose", topic: "dialectic" },
  "Of the Good or Morally Beautiful and Pleasure, addressed to Aristocreon (10 books)": { form: "prose", topic: "ethics" },
  "Of the Mentiens Argument, addressed to Aristocreon (6 books)": { form: "prose", topic: "dialectic" },
  "Of the Nobody Puzzle, addressed to Menecrates (8 books)": { form: "prose", topic: "dialectic" },
  "On Ambiguous Forms of Speech, addressed to Apollas (4 books)": { form: "prose", topic: "dialectic" },
  "On Judgements of Possibility, addressed to Clitus (4 books)": { form: "prose", topic: "dialectic" },
  "On Solecisms": { form: "prose", topic: "dialectic" },
  "On the Primary Indemonstrable Syllogisms, addressed to Zeno": { form: "prose", topic: "dialectic" },
  "On the Terms used in Dialectic, addressed to Zeno": { form: "prose", topic: "dialectic" },
  "Outline of Ethical Theory, addressed to Theoporos": { form: "prose", topic: "ethics" },
  "Probable Hypothetical Judgements, addressed to Dioscurides (4 books)": { form: "prose", topic: "dialectic" },
  "The Philosopher's Inquiries": { form: "prose", topic: "dialectic" },

  // ---- Sphaerus ----
  "Handbook of Dialectic (2 books)": { form: "prose", topic: "dialectic" },
  "Of Lycurgus and Socrates (3 books)": { form: "prose", topic: "biography" },
  "Of the Cosmos (2 books)": { form: "prose", topic: "physics" },
  "Of the Spartan Constitution": { form: "prose", topic: "history" },

  // ---- Herillus ----
  "Of the Passions": { form: "prose", topic: "ethics" },
  "Of Training": { form: "prose", topic: "ethics" },
  "The Legislator": { form: "prose", topic: "politics" },

  // ---- Dionysius the Renegade ----
  "Of Apathy (2 books)": { form: "prose", topic: "ethics" },
  "Of Pleasure (4 books)": { form: "prose", topic: "ethics" },

  // ---- Ariston of Chios (attribution disputed, D.L. 7.163) ----
  "Dissertations on Philosophy (7 books)": { form: "prose", topic: null },
  "Exhortations (2 books)": { form: "prose", topic: "ethics" },
  "Letters to Cleanthes (4 books)": { form: "prose", topic: "letters" },
  "Of Zeno's Doctrines": { form: "prose", topic: "doxography" },
};
