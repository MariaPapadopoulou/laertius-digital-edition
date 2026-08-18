import type { WorkFacet } from "./types";

/**
 * Works of the Socratics: Antisthenes, Aeschines, Aristippus, Xenophon,
 * Simon, Crito, Glaucon, Simmias, Cebes, Phaedo, Euclides, Stilpo.
 *
 * Judgment calls:
 * - Named Socratic dialogues (Aspasia, Callias, Zopyrus, Stilpo's dialogues,
 *   ...) classify as ethics - Socratic literature's home ground.
 * - Antisthenes' Homeric titles (Athena, Cyclops, Calchas, Proteus, ...) are
 *   allegorical criticism: poetics. His Ajax/Odysseus display speeches and
 *   the pieces on Lysias/Isocrates are rhetoric.
 * - Xenophon: Anabasis/Hellenica are history, Agesilaus/Cyropaedia biography
 *   (encomium and didactic royal biography), Memorabilia and the Apology
 *   ethics (Socratic literature), the practical manuals technical, On
 *   Revenues politics with philosophical:false (a policy pamphlet).
 * - The Tablet is curated as D.L. attributes it (Cebes the Socratic); its
 *   likely later origin is why Cebes carries no production century.
 * - Shared nodes curated here: "Alcibiades" (Aeschines + Antisthenes +
 *   Euclides), "Aspasia" (Aeschines + Antisthenes), "Of Belief" (Antisthenes
 *   + Demetrius of Phalerum), "Of Courage" (Antisthenes + Simon + Strato),
 *   "Of the Good" (Antisthenes + Simon), "On Music" (Antisthenes + Simmias +
 *   Simon), "On Education" (Aristippus + pseudo-Pythagoras), "On Friendship"
 *   (Simmias + Speusippus), "On Philosophy" (Simmias + Simon + Speusippus +
 *   Xenocrates), "On Law" (Crito + Simon).
 * - Survival: Xenophon's twelve works survive entire → extant; The Tablet
 *   survives (whatever its real date) → extant. "Alcibiades" is conflated:
 *   Aeschines' dialogue survives in long verbatim excerpts (via Aelius
 *   Aristides), Antisthenes' and Euclides' homonyms are lost → survival
 *   null. Aeschines' other dialogues survive only in testimonia and
 *   paraphrase → lost.
 */
export const SOCRATICS_WORKS: Record<string, WorkFacet> = {
  // ---- Antisthenes ----
  "A Defence of Orestes, or Concerning Forensic Writers": { form: "prose", topic: "rhetoric" },
  "A Problem concerning Nature (two books)": { form: "prose", topic: "physics" },
  "A Treatise on Expression, or Styles of Speaking": { form: "prose", topic: "rhetoric" },
  "Ajax, or The Speech of Ajax": { form: "prose", topic: "rhetoric" },
  Alcibiades: { form: "prose", topic: "ethics", survival: null },
  "Archelaus, or Of Kingship": { form: "prose", topic: "politics" },
  Aspasia: { form: "prose", topic: "ethics" },
  "Athena, or Of Telemachus": { form: "prose", topic: "poetics" },
  "Concerning Theognis, making a fourth and a fifth book": { form: "prose", topic: "poetics" },
  "Cyclops, or Of Odysseus": { form: "prose", topic: "poetics" },
  Cyrus: { form: "prose", topic: "ethics" },
  "Cyrus, or Of Sovereignty": { form: "prose", topic: "politics" },
  "Cyrus, or The Beloved": { form: "prose", topic: "ethics" },
  "Cyrus, or The Scouts": { form: "prose", topic: "ethics" },
  "Heracles, or Midas": { form: "prose", topic: "ethics" },
  "Heracles, or Of Wisdom or Strength": { form: "prose", topic: "ethics" },
  "Isography (similar writing), or Lysias and Isocrates": { form: "prose", topic: "rhetoric" },
  "Menexenus, or On Ruling": { form: "prose", topic: "politics" },
  "Odysseus, or Concerning Odysseus": { form: "prose", topic: "rhetoric" },
  "Of Belief": { form: "prose", topic: "dialectic" },
  "Of Courage": { form: "prose", topic: "ethics" },
  "Of Dying": { form: "prose", topic: "ethics" },
  "Of Freedom and Slavery": { form: "prose", topic: "ethics" },
  "Of Helen and Penelope": { form: "prose", topic: "poetics" },
  "Of Law, or Of a Commonwealth": { form: "prose", topic: "politics" },
  "Of Law, or Of Goodness and Justice": { form: "prose", topic: "ethics" },
  "Of Life and Death": { form: "prose", topic: "ethics" },
  "Of Nature, in two books": { form: "prose", topic: "physics" },
  "Of Opinion and Knowledge, in four books": { form: "prose", topic: "dialectic" },
  "Of Proteus": { form: "prose", topic: "poetics" },
  "Of Questioning and Answering": { form: "prose", topic: "dialectic" },
  "Of the Good": { form: "prose", topic: "ethics" },
  "Of the Guardian, or On Obedience": { form: "prose", topic: "ethics" },
  "Of the Minstrel’s Staff": { form: "prose", topic: "poetics" },
  "Of the Odyssey": { form: "prose", topic: "poetics" },
  "Of Those in the Underworld": { form: "prose", topic: "ethics" },
  "On Calchas": { form: "prose", topic: "poetics" },
  "On Commentators": { form: "prose", topic: "poetics" },
  "On Education, or On Names, in five books": { form: "prose", topic: "dialectic" },
  "On Homer": { form: "prose", topic: "poetics" },
  "On Music": { form: "prose", topic: "music" },
  "On Pleasure": { form: "prose", topic: "ethics" },
  "On Talk": { form: "prose", topic: "dialectic" },
  "On the Scout": { form: "prose", topic: null },
  "On Wickedness and Impiety": { form: "prose", topic: "ethics" },
  "Opinions, or The Controversialist": { form: "prose", topic: "dialectic" },
  "Problems about Learning": { form: "prose", topic: "dialectic" },
  "Satho, or Of Contradiction, in three books": { form: "prose", topic: "dialectic" },
  "The Greater Heracles, or Of Strength": { form: "prose", topic: "ethics" },
  Truth: { form: "prose", topic: "dialectic" },

  // ---- Aeschines ----
  Axiochus: { form: "prose", topic: "ethics" },
  Callias: { form: "prose", topic: "ethics" },
  Miltiades: { form: "prose", topic: "ethics" },
  Rhinon: { form: "prose", topic: "ethics" },
  Telauges: { form: "prose", topic: "ethics" },

  // ---- Aristippus ----
  "A History of Libya (in three books, sent to Dionysius)": { form: "prose", topic: "history" },
  Artabazus: { form: "prose", topic: "ethics" },
  "Introduction to Philosophy": { form: "prose", topic: "ethics" },
  "On Education": { form: "prose", topic: "ethics" },
  "On Fortune": { form: "prose", topic: "ethics" },
  "On Virtue": { form: "prose", topic: "ethics" },
  "To Laïs": { form: "prose", topic: "letters" },
  "To Laïs, On the Mirror": { form: "prose", topic: "letters" },
  "To the Exiles": { form: "prose", topic: "letters" },
  "To the Shipwrecked": { form: "prose", topic: "letters" },

  // ---- Xenophon ----
  "A Defence of Socrates": { form: "prose", topic: "ethics", survival: "extant" },
  Agesilaus: { form: "prose", topic: "biography", survival: "extant" },
  Anabasis: { form: "prose", topic: "history", survival: "extant" },
  Cyropaedia: { form: "prose", topic: "biography", survival: "extant" },
  Hellenica: { form: "prose", topic: "history", survival: "extant" },
  "Hieron, or Of Tyranny": { form: "prose", topic: "politics", survival: "extant" },
  Memorabilia: { form: "prose", topic: "ethics", survival: "extant" },
  Oeconomicus: { form: "prose", topic: "ethics", survival: "extant" },
  "On Horsemanship": { form: "prose", topic: "technical", survival: "extant" },
  "On Hunting": { form: "prose", topic: "technical", survival: "extant" },
  "On Revenues": { form: "prose", topic: "politics", philosophical: false, survival: "extant" },
  "On the Duty of a Cavalry General": { form: "prose", topic: "technical", survival: "extant" },

  // ---- Simon the shoemaker ----
  "Of Being": { form: "prose", topic: "dialectic" },
  "Of Honour": { form: "prose", topic: "ethics" },
  "Of Judging": { form: "prose", topic: "dialectic" },
  "Of Number": { form: "prose", topic: "mathematics" },
  "Of Poetry": { form: "prose", topic: "poetics" },
  "Of Virtue, that it cannot be taught": { form: "prose", topic: "ethics" },
  "On Diligence": { form: "prose", topic: "ethics" },
  "On Efficiency": { form: "prose", topic: "ethics" },
  "On Good Eating": { form: "prose", topic: "ethics" },
  "On Greed": { form: "prose", topic: "ethics" },
  "On Guiding the People": { form: "prose", topic: "politics" },
  "On Knowledge": { form: "prose", topic: "dialectic" },
  "On Pretentiousness": { form: "prose", topic: "ethics" },
  "On Teaching": { form: "prose", topic: "ethics" },
  "On the Art of Conversation": { form: "prose", topic: "dialectic" },
  "On the Beautiful": { form: "prose", topic: "ethics" },
  "On the Just": { form: "prose", topic: "ethics" },
  "What is the Beautiful": { form: "prose", topic: "ethics" },

  // ---- Crito ----
  "Concerning superfluity": { form: "prose", topic: "ethics" },
  "Of Beauty": { form: "prose", topic: "ethics" },
  "Of Wisdom": { form: "prose", topic: "ethics" },
  "On Law": { form: "prose", topic: "politics" },
  "That men are not made good by instruction": { form: "prose", topic: "ethics" },
  "What is expedient, or The Statesman": { form: "prose", topic: "politics" },
  "What is Knowledge": { form: "prose", topic: "dialectic" },

  // ---- Glaucon ----
  Amyntichus: { form: "prose", topic: "ethics" },
  Cephalus: { form: "prose", topic: "ethics" },
  Euripides: { form: "prose", topic: "ethics" },
  Euthias: { form: "prose", topic: "ethics" },
  Menexenus: { form: "prose", topic: "ethics" },
  Phidylus: { form: "prose", topic: "ethics" },

  // ---- Simmias ----
  "Of the Soul": { form: "prose", topic: "ethics" },
  "Of Truth": { form: "prose", topic: "dialectic" },
  "On Friendship": { form: "prose", topic: "ethics" },
  "On Philosophy": { form: "prose", topic: "ethics" },
  "On Wisdom": { form: "prose", topic: "ethics" },

  // ---- Cebes ----
  Phrynichus: { form: "prose", topic: "ethics" },
  "The Seventh Day": { form: "prose", topic: "ethics" },
  "The Tablet": { form: "prose", topic: "ethics", survival: "extant" },

  // ---- Phaedo ----
  Simon: { form: "prose", topic: "ethics" },
  Zopyrus: { form: "prose", topic: "ethics" },

  // ---- Euclides ----
  "A Discourse on Love": { form: "prose", topic: "ethics" },
  Aeschines: { form: "prose", topic: "ethics" },
  Crito: { form: "prose", topic: "ethics" },
  Lamprias: { form: "prose", topic: "ethics" },
  Phoenix: { form: "prose", topic: "ethics" },

  // ---- Stilpo ----
  Anaximenes: { form: "prose", topic: "ethics" },
  "Aristippus, or Callias": { form: "prose", topic: "ethics" },
  Aristotle: { form: "prose", topic: "ethics" },
  Chaerecrates: { form: "prose", topic: "ethics" },
  Epigenes: { form: "prose", topic: "ethics" },
  Metrocles: { form: "prose", topic: "ethics" },
  Moschus: { form: "prose", topic: "ethics" },
  "To his Daughter": { form: "prose", topic: "letters" },
};
