/**
 * Curated doxography from Book 5 of Diogenes Laertius' Lives (the
 * Peripatetics), cited to Hicks section ids (book.section). See doxai.ts
 * for the model and curation rules. Source-internal: every `en` is a
 * verbatim excerpt of its cited section. Aristotle's tenets come from the
 * doctrine summary D.L. gives at 5.28–34; the successors' lives are
 * catalogues and wills with no doctrine notices.
 */
import type { Doxa } from "../doxai";

export const BOOK5_DOXAI: Doxa[] = [
  // ---------------------------------------------------------------- Aristotle
  {
    id: "aristotle-divisions-of-philosophy",
    philosopher: "Aristotle",
    domain: "logic",
    gloss: "Philosophy divides into the practical and the theoretical; logic is its instrument, not a part.",
    en: "There are two divisions of philosophy, the practical and the theoretical",
    ref: "5.28",
    certainty: "asserted",
  },
  {
    id: "aristotle-criterion-sensation-reason",
    philosopher: "Aristotle",
    domain: "epistemology",
    gloss: "The criterion of truth is sensation for presented objects, reason in the moral sphere.",
    en: "The test of truth which he put forward was sensation in the sphere of objects actually presented, but in the sphere of morals dealing with the state, the household and the laws, it was reason",
    ref: "5.29",
    certainty: "asserted",
  },
  {
    id: "aristotle-end-exercise-of-virtue",
    philosopher: "Aristotle",
    domain: "ethics",
    gloss: "The single ethical end is the exercise of virtue in a completed life.",
    grc: "Τέλος δὲ ἓν ἐξέθετο χρῆσιν ἀρετῆς ἐν βίῳ τελείῳ.",
    en: "The one ethical end he held to be the exercise of virtue in a completed life",
    ref: "5.30",
    certainty: "asserted",
  },
  {
    id: "aristotle-happiness-three-goods",
    philosopher: "Aristotle",
    domain: "ethics",
    gloss: "Happiness is compounded of three sorts of goods: of the soul, of the body, and external.",
    grc: "τὴν εὐδαιμονίαν συμπλήρωμα ἐκ τριῶν ἀγαθῶν εἶναι·",
    en: "happiness he maintained to be made up of goods of three sorts: goods of the soul, which indeed he designates as of the highest value; in the second place bodily goods, health and strength, beauty and the like; and thirdly external goods",
    ref: "5.30",
    certainty: "asserted",
  },
  {
    id: "aristotle-virtue-not-sufficient",
    philosopher: "Aristotle",
    domain: "ethics",
    gloss: "Virtue alone does not suffice for happiness; bodily and external goods are also needed.",
    grc: "τήν τε ἀρετὴν μὴ εἶναι αὐτάρκη πρὸς εὐδαιμονίαν·",
    en: "he regarded virtue as not of itself sufficient to ensure happiness; bodily goods and external goods were also necessary",
    ref: "5.30",
    certainty: "asserted",
  },
  {
    id: "aristotle-passions-in-moderation",
    philosopher: "Aristotle",
    domain: "ethics",
    gloss: "The wise man is not passionless but indulges the passions in moderation.",
    en: "the wise man was not exempt from all passions, but indulged them in moderation",
    ref: "5.31",
    certainty: "asserted",
  },
  {
    id: "aristotle-god-incorporeal",
    philosopher: "Aristotle",
    domain: "gods",
    gloss: "God is incorporeal and unmoved, his providence reaching the heavenly bodies.",
    grc: "τὸν δὲ θεὸν ἀσώματον ἀπέφαινε, καθὰ καὶ ὁ Πλάτων.",
    en: "he held that God was incorporeal; that his providence extended to the heavenly bodies, that he is unmoved",
    ref: "5.32",
    certainty: "asserted",
  },
  {
    id: "aristotle-fifth-element",
    philosopher: "Aristotle",
    domain: "physics",
    gloss: "Beyond the four elements there is a fifth, of which the celestial bodies are made; its motion is circular.",
    grc: "εἶναι δὲ παρὰ τὰ τέτταρα στοιχεῖα καὶ ἄλλο πέμπτον, ἐξ οὗ τὰ αἰθέρια συνεστάναι.",
    en: "Besides the four elements he held that there is a fifth, of which the celestial bodies are composed",
    ref: "5.32",
    certainty: "asserted",
  },
  {
    id: "aristotle-soul-first-entelechy",
    philosopher: "Aristotle",
    domain: "soul",
    gloss: "The soul is incorporeal, the first entelechy of a natural organic body potentially alive.",
    grc: "καὶ τὴν ψυχὴν δὲ ἀσώματον, ἐντελέχειαν οὖσαν τὴν πρώτην",
    en: "he maintained the soul to be incorporeal, defining it as the first entelechy",
    ref: "5.32",
    certainty: "asserted",
  },
];
