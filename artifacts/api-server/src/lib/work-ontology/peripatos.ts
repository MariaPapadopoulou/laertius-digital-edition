import type { WorkFacet } from "./types";

/**
 * Works of the later Peripatos: Strato of Lampsacus (D.L. 5.59-60) and
 * Demetrius of Phalerum (D.L. 5.80-81).
 *
 * Judgment calls:
 * - Strato "the physicist": natural-philosophical titles are physics; the
 *   logical apparatus (Prior/Posterior, Accident, Property, Definition,
 *   Degree, Topics) is dialectic; pathology (Diseases, Crises, Starvation
 *   and Dizziness) is medicine. "Of the Future" is foreknowledge/prevision →
 *   physics, matching Heraclides' "Concerning Prevision". "Examinations of
 *   Discoveries" is heurematography → history, matching Theophrastus' "Of
 *   Discoveries". "On Mining Machinery" is the one technical treatise.
 * - Demetrius: the eponymous person-titles (Aristides, Cleon, Socrates,
 *   Ptolemy, ...) are biographical/apologetic pieces → biography. His
 *   practical-political pamphlets (A Sworn Assembly, Of Peace, Of the
 *   Constitution, Rights) are politics with philosophical:false - the
 *   working statesman's output, not political philosophy - while "On Laws"
 *   stays theoretical politics like Theophrastus'. "Of the Beam in the Sky"
 *   is the meteor phenomenon (dokos) → astronomy. "On Customs" → ethics,
 *   matching Theophrastus' "Of Social Customs".
 * - Survival: everything here is lost. The surviving "Epistles of Diogenes"
 *   are later Cynic pseudepigrapha, so the conflated "Letters" node
 *   (Demetrius + Diogenes) stays lost.
 * - Shared nodes curated here: "Of the Gods (three books)" (Strato +
 *   Theophrastus), "An Exhortation to Philosophy" (Demetrius + Monimus),
 *   "Letters" (Demetrius + Diogenes of Sinope), "Ptolemy" (Demetrius +
 *   Stilpo).
 */
export const PERIPATOS_WORKS: Record<string, WorkFacet> = {
  // ---- Strato of Lampsacus ----
  "Examinations of Discoveries, in two books": { form: "prose", topic: "history" },
  "Introduction to Topics": { form: "prose", topic: "dialectic" },
  "Of Accident": { form: "prose", topic: "dialectic" },
  "Of Causes": { form: "prose", topic: "physics" },
  "Of Definition": { form: "prose", topic: "dialectic" },
  "Of Diseases": { form: "prose", topic: "medicine" },
  "Of Dreams": { form: "prose", topic: "physics" },
  "Of Enthusiasm or Ecstasy": { form: "prose", topic: "physics" },
  "Of Happiness": { form: "prose", topic: "ethics" },
  "Of Human Nature": { form: "prose", topic: "physics" },
  "Of Injustice": { form: "prose", topic: "ethics" },
  "Of Kingship (three books)": { form: "prose", topic: "politics" },
  "Of Mixture": { form: "prose", topic: "physics" },
  "Of Pleasure": { form: "prose", topic: "ethics" },
  "Of Sensation": { form: "prose", topic: "physics" },
  "Of Sleep": { form: "prose", topic: "physics" },
  "Of Starvation and Dizziness": { form: "prose", topic: "medicine" },
  "Of the Crises in Diseases": { form: "prose", topic: "medicine" },
  "Of the Future": { form: "prose", topic: "physics" },
  "Of the Genus of the Prior": { form: "prose", topic: "dialectic" },
  "Of the Gods (three books)": { form: "prose", topic: "physics" },
  "Of the logically Prior and Posterior": { form: "prose", topic: "dialectic" },
  "Of the Property or Essential Attribute": { form: "prose", topic: "dialectic" },
  "On Animals in Folk-lore or Fable": { form: "prose", topic: "physics" },
  "On Colours": { form: "prose", topic: "physics" },
  "On difference of Degree": { form: "prose", topic: "dialectic" },
  "On Faculties": { form: "prose", topic: "physics" },
  "On First Principles (three books)": { form: "prose", topic: "physics" },
  "On Growth and Nutrition": { form: "prose", topic: "physics" },
  "On Mining Machinery": { form: "prose", topic: "technical" },
  "On the Attributes Light and Heavy": { form: "prose", topic: "physics" },
  "On the Breeding of Animals": { form: "prose", topic: "physics" },
  "On the Heaven": { form: "prose", topic: "physics" },
  "On the Philosopher-King": { form: "prose", topic: "politics" },
  "On the Void": { form: "prose", topic: "physics" },
  "On the Wind": { form: "prose", topic: "physics" },
  "On Time": { form: "prose", topic: "physics" },
  "On Various Modes of Life": { form: "prose", topic: "ethics" },
  "Solutions of Difficulties": { form: "prose", topic: "dialectic" },

  // ---- Demetrius of Phalerum ----
  "A Sworn Assembly": { form: "prose", topic: "politics", philosophical: false },
  "Aesop’s Fables": { form: "prose", topic: "miscellany" },
  "An Exhortation to Philosophy": { form: "prose", topic: "ethics" },
  Anecdotes: { form: "prose", topic: "miscellany" },
  Aristides: { form: "prose", topic: "biography" },
  Aristomachus: { form: "prose", topic: "biography" },
  Artaxerxes: { form: "prose", topic: "biography" },
  Cleon: { form: "prose", topic: "biography" },
  "Concerning Chalcis": { form: "prose", topic: "history" },
  "Concerning Embassies": { form: "prose", topic: "history" },
  "Concerning Homer": { form: "prose", topic: "poetics" },
  "Concerning Love": { form: "prose", topic: "ethics" },
  Dionysius: { form: "prose", topic: "biography" },
  "Historical Introduction": { form: "prose", topic: "history" },
  Letters: { form: "prose", topic: "letters" },
  Maedon: { form: "prose", topic: "biography" },
  "Of Favour": { form: "prose", topic: "ethics" },
  "Of Fortune": { form: "prose", topic: "ethics" },
  "Of Magnanimity": { form: "prose", topic: "ethics" },
  "Of Marriage": { form: "prose", topic: "ethics" },
  "Of Old Age": { form: "prose", topic: "ethics" },
  "Of Opportunity": { form: "prose", topic: "ethics" },
  "Of Peace": { form: "prose", topic: "politics", philosophical: false },
  "Of the Beam in the Sky": { form: "prose", topic: "astronomy" },
  "Of the Constitution": { form: "prose", topic: "politics", philosophical: false },
  "Of the Ionians": { form: "prose", topic: "history" },
  "On Antiphanes": { form: "prose", topic: "poetics" },
  "On Customs": { form: "prose", topic: "ethics" },
  "On Laws": { form: "prose", topic: "politics" },
  Phaedondas: { form: "prose", topic: "biography" },
  Ptolemy: { form: "prose", topic: "biography" },
  Rights: { form: "prose", topic: "politics", philosophical: false },
  Socrates: { form: "prose", topic: "biography" },
};
