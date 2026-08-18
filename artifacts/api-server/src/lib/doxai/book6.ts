/**
 * Curated doxography from Book 6 of Diogenes Laertius' Lives (the Cynics),
 * cited to Hicks section ids (book.section). See doxai.ts for the model and
 * curation rules. Source-internal: every `en` is a verbatim excerpt of its
 * cited section. The Cynic maxims and chreiai belong to the sayings and
 * anecdotes layers; only what D.L. frames as held positions is curated here.
 */
import type { Doxa } from "../doxai";

export const BOOK6_DOXAI: Doxa[] = [
  // -------------------------------------------------------------- Antisthenes
  {
    id: "antisthenes-virtue-teachable",
    philosopher: "Antisthenes",
    domain: "ethics",
    gloss: "Virtue can be taught, and nobility belongs only to the virtuous.",
    en: "He would prove that virtue can be taught; that nobility belongs to none other than the virtuous",
    ref: "6.10",
    certainty: "asserted",
  },
  {
    id: "antisthenes-virtue-sufficient",
    philosopher: "Antisthenes",
    domain: "ethics",
    gloss: "Virtue is sufficient in itself for happiness, needing only Socratic strength.",
    grc: "αὐτάρκη δὲ τὴν ἀρετὴν πρὸς εὐδαιμονίαν, μηδενὸς προσδεομένην ὅτι μὴ Σωκρατικῆς ἰσχύος.",
    en: "he held virtue to be sufficient in itself to ensure happiness, since it needed nothing else except the strength of a Socrates",
    ref: "6.11",
    certainty: "asserted",
  },
  {
    id: "antisthenes-virtue-of-deeds",
    philosopher: "Antisthenes",
    domain: "ethics",
    gloss: "Virtue is a matter of deeds, needing neither many words nor learning.",
    grc: "τήν τʼ ἀρετὴν τῶν ἔργων εἶναι, μήτε λόγων πλείστων δεομένην μήτε μαθημάτων.",
    en: "virtue is an affair of deeds and does not need a store of words or learning",
    ref: "6.11",
    certainty: "asserted",
  },
  {
    id: "antisthenes-law-of-virtue",
    philosopher: "Antisthenes",
    domain: "politics",
    gloss: "The wise man acts in public by the law of virtue, not the established laws.",
    grc: "τὸν σοφὸν οὐ κατὰ τοὺς κειμένους νόμους πολιτεύσεσθαι, ἀλλὰ κατὰ τὸν τῆς ἀρετῆς.",
    en: "the wise man will be guided in his public acts not by the established laws but by the law of virtue",
    ref: "6.11",
    certainty: "asserted",
  },
  // -------------------------------------------------------- Diogenes of Sinope
  {
    id: "diogenes-sinope-twofold-training",
    philosopher: "Diogenes of Sinope",
    domain: "ethics",
    gloss: "Training (askesis) is twofold, mental and bodily, and each half is incomplete without the other.",
    en: "training was of two kinds, mental and bodily",
    ref: "6.70",
    certainty: "asserted",
  },
  {
    id: "diogenes-sinope-all-things-of-the-wise",
    philosopher: "Diogenes of Sinope",
    domain: "ethics",
    gloss: "All things are the property of the wise: all belongs to the gods, and the gods are friends of the wise.",
    grc: "Πάντα τῶν σοφῶν εἶναι λέγων",
    en: "He maintained that all things are the property of the wise",
    ref: "6.72",
    certainty: "asserted",
  },
  {
    id: "diogenes-sinope-cosmopolitan",
    philosopher: "Diogenes of Sinope",
    domain: "politics",
    gloss: "The only true commonwealth is the whole universe (cosmopolitanism).",
    grc: "μόνην τε ὀρθὴν πολιτείαν εἶναι τὴν ἐν κόσμῳ.",
    en: "The only true commonwealth was, he said, that which is as wide as the universe",
    ref: "6.72",
    certainty: "asserted",
  },
  {
    id: "diogenes-sinope-community-of-wives",
    philosopher: "Diogenes of Sinope",
    domain: "politics",
    gloss: "Wives should be held in common, marriage replaced by mutual consent; sons likewise in common.",
    grc: "κοινὰς εἶναι δεῖν τὰς γυναῖκας, γάμον μηδένα νομίζων, ἀλλὰ τὸν πείσαντα τῇ πεισθείσῃ συνεῖναι·",
    en: "He advocated community of wives, recognizing no other marriage than a union of the man who persuades with the woman who consents",
    ref: "6.72",
    certainty: "asserted",
  },
];
