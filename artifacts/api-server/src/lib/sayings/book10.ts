/**
 * Curated sayings & apophthegms from Book 10 of Diogenes Laertius' Lives
 * (Epicurus), cited to Hicks section ids (book.section). See sayings.ts for
 * the model and curation rules.
 */
import type { Saying } from "../sayings";

export const BOOK10_SAYINGS: Saying[] = [
  // ------------------------------------------------------------------ Epicurus
  {
    id: "epicurus-steer-clear-of-culture",
    philosopher: "Epicurus",
    topic: "education",
    gloss:
      "To Pythocles: hoist all sail and steer clear of all culture.",
    grc: "Παιδείαν δὲ πᾶσαν, μακάριε, φεῦγε τἀκάτιον ἀράμενος.",
    en: "Hoist all sail, my dear boy, and steer clear of all culture.",
    ref: "10.6",
    to: "Pythocles",
    certainty: "asserted",
    note: "Quoted by D.L. from Epicurus' letter to Pythocles.",
  },
  {
    id: "epicurus-pot-of-cheese",
    philosopher: "Epicurus",
    topic: "self-sufficiency",
    gloss:
      "His idea of luxury, from his letters: send me a little pot of cheese, that I may fare sumptuously when I like.",
    grc: "πέμψον μοι τυροῦ, φησί, κυθριδίου, ἵνʼ ὅταν βούλωμαι πολυτελεύσασθαι δύνωμαι.",
    en: "Send me a little pot of cheese, that, when I like, I may fare sumptuously.",
    ref: "10.11",
    certainty: "asserted",
    note: "From his correspondence; D.L. adds he was otherwise content with plain bread and water.",
  },
  {
    id: "epicurus-remember-doctrines",
    philosopher: "Epicurus",
    topic: "death",
    gloss:
      "His dying injunction: he bade his friends remember his doctrines, and breathed his last.",
    grc: "τοῖς τε φίλοις παραγγείλαντα τῶν δογμάτων μεμνῆσθαι, οὕτω τελευτῆσαι.",
    en: "having bidden his friends remember his doctrines, breathed his last.",
    ref: "10.16",
    certainty: "reported",
    note: "Reported in Hermippus' account of his death; D.L.'s own epigram renders it 'Farewell, my friends; the truths I taught hold fast.'",
  },
  {
    id: "epicurus-no-age-for-wisdom",
    philosopher: "Epicurus",
    topic: "wisdom",
    gloss:
      "No age is too early or too late for the health of the soul - from the letter to Menoeceus.",
    grc: "Μήτε νέος τις ὢν μελλέτω φιλοσοφεῖν, μήτε γέρων ὑπάρχων κοπιάτω φιλοσοφῶν· οὔτε γὰρ ἄωρος οὐδείς ἐστιν οὔτε πάρωρος πρὸς τὸ κατὰ ψυχὴν ὑγιαῖνον.",
    en: "Let no one be slow to seek wisdom when he is young nor weary in the search thereof when he is grown old. For no age is too early or too late for the health of the soul.",
    ref: "10.122",
    to: "Menoeceus",
    toRef: "10.121",
    certainty: "asserted",
  },
  {
    id: "epicurus-death-nothing-to-us",
    philosopher: "Epicurus",
    topic: "death",
    gloss:
      "Death is nothing to us: when we are, death is not come; when death is come, we are not.",
    grc: "τὸ φρικωδέστατον οὖν τῶν κακῶν ὁ θάνατος οὐθὲν πρὸς ἡμᾶς, ἐπειδή περ ὅταν μὲν ἡμεῖς ὦμεν, ὁ θάνατος οὐ πάρεστιν· ὅταν δʼ ὁ θάνατος παρῇ, τόθʼ ἡμεῖς οὐκ ἐσμέν.",
    en: "Death, therefore, the most awful of evils, is nothing to us, seeing that, when we are, death is not come, and, when death is come, we are not.",
    ref: "10.125",
    to: "Menoeceus",
    toRef: "10.121",
    certainty: "asserted",
  },
  {
    id: "epicurus-luxury-least-need",
    philosopher: "Epicurus",
    topic: "self-sufficiency",
    gloss:
      "They have the sweetest enjoyment of luxury who stand least in need of it.",
    grc: "ἥδιστα πολυτελείας ἀπολαύουσιν οἱ ἥκιστα ταύτης δεόμενοι, καὶ ὅτι τὸ μὲν φυσικὸν πᾶν εὐπόριστόν ἐστι, τὸ δὲ κενὸν δυσπόριστον.",
    en: "they have the sweetest enjoyment of luxury who stand least in need of it, and that whatever is natural is easily procured and only the vain and worthless hard to win",
    ref: "10.130",
    to: "Menoeceus",
    toRef: "10.121",
    certainty: "asserted",
  },
  {
    id: "epicurus-pleasure-absence-of-pain",
    philosopher: "Epicurus",
    topic: "pleasure",
    gloss:
      "By pleasure he means the absence of pain in the body and of trouble in the soul - not the pleasures of the prodigal.",
    grc: "ἀλλὰ τὸ μήτε ἀλγεῖν κατὰ σῶμα μήτε ταράττεσθαι κατὰ ψυχήν.",
    en: "By pleasure we mean the absence of pain in the body and of trouble in the soul.",
    ref: "10.131",
    to: "Menoeceus",
    toRef: "10.121",
    certainty: "asserted",
  },
  {
    id: "epicurus-god-among-men",
    philosopher: "Epicurus",
    topic: "virtue",
    gloss:
      "Closing the letter to Menoeceus: exercise thyself in these precepts day and night, and thou wilt live as a god among men.",
    grc: "καὶ οὐδέποτε οὔθʼ ὕπαρ οὔτʼ ὄναρ διαταραχθήσῃ, ζήσεις δὲ ὡς θεὸς ἐν ἀνθρώποις.",
    en: "then never, either in waking or in dream, wilt thou be disturbed, but wilt live as a god among men",
    ref: "10.135",
    to: "Menoeceus",
    toRef: "10.121",
    certainty: "asserted",
  },
  {
    id: "epicurus-no-divination",
    philosopher: "Epicurus",
    topic: "religion",
    gloss:
      "He rejects divination outright: no means of predicting the future really exists.",
    grc: "μαντικὴ οὖσα ἀνύπαρκτος, εἰ δὲ καὶ ὑπαρκτή, οὐδὲν πρὸς ἡμᾶς ἡγητέα γινόμενα.",
    en: "No means of predicting the future really exists, and if it did, we must regard what happens according to it as nothing to us.",
    ref: "10.135",
    certainty: "asserted",
  },
];
