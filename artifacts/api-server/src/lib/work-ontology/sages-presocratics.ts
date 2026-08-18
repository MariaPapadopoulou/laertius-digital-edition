import type { WorkFacet } from "./types";

/**
 * Works of the Seven Sages, the Presocratics, Protagoras, Democritus and the
 * pseudo-Pythagorean / pseudo-Epicharmean tracts.
 *
 * Judgment calls:
 * - The sages' poems are Lobon-derived attributions of doubtful authenticity;
 *   they get form/topic facets but no dating (see AUTHOR_PRODUCTION_CENTURY).
 * - Epimenides' 4000 "lines" on sacrifices/Minos are D.L.'s PROSE works
 *   (1.112 counts prose in lines too); his two epics are verse.
 * - "On Nature" is a conflated node (Empedocles' hexameter poem + the prose
 *   tract D.L. reports under Pythagoras' name, 8.6): topic physics is common
 *   ground, but the form is left null - verse for one, prose for the other.
 * - Shared nodes curated here: "On the Gods" (Protagoras + Speusippus),
 *   "Geography" (Democritus + Eudoxus), "Of Reason" (Democritus + Heraclides
 *   Ponticus), "On Poetry" (Democritus + Simon).
 * - Survival: excerpts where D.L. himself quotes the work (Chilon's elegies
 *   1.71, Pittacus' 1.78, Cleobulus' songs 1.89-91, Solon's Salamis 1.47,
 *   Pherecydes' opening 1.119, Philolaus' opening 8.85) or where the
 *   standard fragment corpora preserve verbatim text under the title
 *   (Solon's laws and constitutional elegies, Heraclitus, Empedocles'
 *   Purifications). Bias' Ionia poem stays lost - the song D.L. quotes
 *   (1.85) is gnomic and not attributable to it. Democritus stays entirely
 *   lost: the surviving fragments cannot be assigned to specific catalogue
 *   titles. Conflated nodes with divergent transmission carry survival
 *   null: "On Nature" (Empedocles' poem survives in extensive quotation,
 *   the pseudo-Pythagorean prose tract does not), "On the Gods"
 *   (Protagoras' opening survives verbatim, 9.51; Speusippus' homonym is
 *   lost).
 */
export const SAGES_PRESOCRATICS_WORKS: Record<string, WorkFacet> = {
  // ---- Seven Sages & Anacharsis ----
  "Poem on the institutions of the Greeks and the Scythians (800 lines)": { form: "verse", topic: "lyric" },
  "Poem on Ionia and how it may best be made prosperous (2000 lines)": { form: "verse", topic: "lyric" },
  "Elegiac poem (some 200 lines)": { form: "verse", topic: "lyric", survival: "excerpts" },
  "Songs and riddles (some 3000 lines)": { form: "verse", topic: "lyric", survival: "excerpts" },
  "Didactic poem (2000 lines)": { form: "verse", topic: "lyric" },
  "Elegiac poems (some 600 lines)": { form: "verse", topic: "lyric", survival: "excerpts" },
  "On Laws (prose work for the citizens)": { form: "prose", topic: "politics", philosophical: false },
  "Laws (the laws which bear his name)": { form: "prose", topic: "politics", philosophical: false, survival: "excerpts" },
  "On Salamis (elegiac poem)": { form: "verse", topic: "lyric", survival: "excerpts" },
  "On the Athenian Constitution (elegiac poem)": { form: "verse", topic: "lyric", survival: "excerpts" },

  // ---- Pherecydes, Epimenides ----
  "A work on nature and the gods (beginning 'Zeus and Time and Earth were from all eternity')": { form: "prose", topic: "physics", survival: "excerpts" },
  "On Sacrifices and the Cretan Constitution; On Minos and Rhadamanthus (about 4000 lines)": { form: "prose", topic: "miscellany" },
  "On the Birth of the Curetes and Corybantes, and a Theogony (5000 lines)": { form: "verse", topic: "epic" },
  "On the building of the Argo and Jason's voyage to Colchis (6500 lines)": { form: "verse", topic: "epic" },

  // ---- Heraclitus, Philolaus, Empedocles, Xenophanes ----
  "On Nature (a continuous treatise in three discourses: on the universe, on politics, on theology)": { form: "prose", topic: "physics", survival: "excerpts" },
  "On Nature (one book)": { form: "prose", topic: "physics", survival: "excerpts" },
  "On Nature": { form: null, topic: "physics", survival: null },
  Purifications: { form: "verse", topic: "ethics", survival: "excerpts" },
  "Discourse on Medicine (600 lines)": { form: "verse", topic: "medicine" },
  "The Founding of Colophon": { form: "verse", topic: "epic" },
  "The Settlement of a Colony at Elea in Italy": { form: "verse", topic: "epic" },

  // ---- pseudo-Pythagoras, pseudo-Epicharmus ----
  "On Statesmanship": { form: "prose", topic: "politics" },
  "Memoirs containing physical, ethical and medical doctrines": { form: "verse", topic: "miscellany" },

  // ---- Protagoras ----
  "Of Forensic Speech for a Fee": { form: "prose", topic: "rhetoric" },
  "Of the State": { form: "prose", topic: "politics" },
  "Of Virtues": { form: "prose", topic: "ethics" },
  "On the Dwellers in Hades": { form: "prose", topic: "ethics" },
  "On the Gods": { form: "prose", topic: "physics", survival: null },
  "The Art of Controversy": { form: "prose", topic: "dialectic" },

  // ---- Democritus ----
  "Amaltheas's Horn (the Horn of Plenty)": { form: "prose", topic: "miscellany" },
  "Concerning Homer, or On Correct Epic Diction, and On Glosses": { form: "prose", topic: "grammar" },
  Confirmations: { form: "prose", topic: "dialectic" },
  "Description of the World": { form: "prose", topic: "physics" },
  Geography: { form: "prose", topic: "geography" },
  Numbers: { form: "prose", topic: "mathematics" },
  "Of Agriculture, or Concerning Land Measurements": { form: "prose", topic: "technical" },
  "Of Changes of Shape": { form: "prose", topic: "physics" },
  "Of Colours": { form: "prose", topic: "physics" },
  "Of Diet, or Diaetetics": { form: "prose", topic: "medicine" },
  "Of Flavours": { form: "prose", topic: "physics" },
  "Of Manly Excellence, or Of Virtue": { form: "prose", topic: "ethics" },
  "Of Nature (one book)": { form: "prose", topic: "physics" },
  "Of Painting": { form: "prose", topic: "technical" },
  "Of Reason": { form: "prose", topic: "physics" },
  "Of the Different Shapes (of Atoms)": { form: "prose", topic: "physics" },
  "Of the Disposition of the Wise Man": { form: "prose", topic: "ethics" },
  "Of the Nature of Man, or Of Flesh": { form: "prose", topic: "medicine" },
  "Of the Senses": { form: "prose", topic: "physics" },
  "Of those in Hades": { form: "prose", topic: "ethics" },
  "Of Tranquillity": { form: "prose", topic: "ethics" },
  "On Geometry": { form: "prose", topic: "mathematics" },
  "On Images, or On Foreknowledge of the Future": { form: "prose", topic: "physics" },
  "On Irrational Lines and Solids (two books)": { form: "prose", topic: "mathematics" },
  "On Logic, or Criterion of Thought (three books)": { form: "prose", topic: "dialectic" },
  "On Poetry": { form: "prose", topic: "poetics" },
  "On Rhythms and Harmony": { form: "prose", topic: "music" },
  "On the Planets": { form: "prose", topic: "astronomy" },
  Pythagoras: { form: "prose", topic: "biography" },
  "The Great Diacosmos": { form: "prose", topic: "physics" },
  "The Great Year, or Astronomy, Calendar": { form: "prose", topic: "astronomy" },
  "The Lesser Diacosmos": { form: "prose", topic: "physics" },
  "Treatise on Tactics, and On Fighting in Armour": { form: "prose", topic: "technical" },
  Tritogeneia: { form: "prose", topic: "ethics" },
};
