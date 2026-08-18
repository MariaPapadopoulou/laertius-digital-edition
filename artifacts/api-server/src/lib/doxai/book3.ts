/**
 * Curated doxography from Book 3 of Diogenes Laertius' Lives (Plato), cited
 * to Hicks section ids (book.section). See doxai.ts for the model and
 * curation rules. Source-internal: every `en` is a verbatim excerpt of its
 * cited section. Drawn from D.L.'s summary of "the doctrines he approved"
 * (3.67-80), the doxographical heart of the Platonic life.
 */
import type { Doxa } from "../doxai";

export const BOOK3_DOXAI: Doxa[] = [
  // -------------------------------------------------------------------- Plato
  {
    id: "plato-soul-immortal-transmigration",
    philosopher: "Plato",
    domain: "soul",
    gloss: "The soul is immortal and by transmigration puts on many bodies.",
    grc: "ἀθάνατον ἔλεγε τὴν ψυχὴν καὶ πολλὰ μεταμφιεννυμένην σώματα",
    en: "He held that the soul is immortal, that by transmigration it puts on many bodies",
    ref: "3.67",
    doctrine: "The soul is immortal and, by transmigration, puts on many bodies",
    certainty: "asserted",
  },
  {
    id: "plato-soul-self-moved-tripartite",
    philosopher: "Plato",
    domain: "soul",
    gloss:
      "The soul is self-moved and tripartite: reason in the head, spirit at the heart, appetite by the navel and liver.",
    grc: "αὐτοκίνητόν τε εἶναι καὶ τριμερῆ· τὸ μὲν γὰρ αὐτῆς λογιστικὸν μέρος περὶ τῇ κεφαλῇ καθιδρῦσθαι, τὸ δὲ θυμοειδὲς περὶ τῇ καρδίᾳ, τὸ δὲ ἐπιθυμητικὸν περὶ τὸν ὀμφαλὸν καὶ τὸ ἧπαρ συνίστασθαι.",
    en: "He held that it is self-moved and tripartite, the rational part of it having its seat in the head, the passionate part about the heart, while the appetitive is placed in the region of the navel and the liver",
    ref: "3.67",
    doctrine:
      "The soul is tripartite: rational in the head, passionate about the heart, appetitive about the navel and liver",
    certainty: "asserted",
  },
  {
    id: "plato-two-principles-god-matter",
    philosopher: "Plato",
    domain: "first-principles",
    gloss:
      "Two universal principles: God (mind and cause) and matter, which is formless, unlimited, and the source of composite things.",
    grc: "δύο δὲ τῶν πάντων ἀπέφηνεν ἀρχάς, θεὸν καὶ ὕλην, ὃν καὶ νοῦν προσαγορεύει καὶ αἴτιον. εἶναι δὲ τὴν ὕλην ἀσχημάτιστον καὶ ἄπειρον, ἐξ ἧς γίνεσθαι τὰ συγκρίματα.",
    en: "He set forth two universal principles, God and matter, and he calls God mind and cause; he held that matter is devoid of form and unlimited, and that composite things arise out of it",
    ref: "3.69",
    doctrine:
      "There are two universal principles, God and matter; God is mind and cause, matter is formless and unlimited",
    certainty: "asserted",
  },
  {
    id: "plato-matter-ordered-by-god",
    philosopher: "Plato",
    domain: "cosmology",
    gloss:
      "Matter was once in disorderly motion until God, preferring order, gathered it into one place.",
    grc: "ἀτάκτως δέ ποτε αὐτὴν κινουμένην ὑπὸ τοῦ θεοῦ φησιν εἰς ἕνα συναχθῆναι τόπον τάξιν ἀταξίας κρείττονα ἡγησαμένου.",
    en: "that it was once in disorderly motion but, inasmuch as God preferred order to disorder, was by him brought together in one place",
    ref: "3.69",
    certainty: "asserted",
  },
  {
    id: "plato-substance-four-elements",
    philosopher: "Plato",
    domain: "physics",
    gloss:
      "The underlying substance is converted into the four elements - fire, water, air, earth - from which the world is formed.",
    grc: "τραπέσθαι δὲ τὴν οὐσίαν ταύτην εἰς τὰ τέτταρα στοιχεῖα, πῦρ, ὕδωρ, ἀέρα, γῆν· ἐξ ὧν αὐτόν τε τὸν κόσμον καὶ τὰ ἐν αὐτῷ γεννᾶσθαι.",
    en: "This substance, he says, is converted into the four elements, fire, water, air, earth, of which the world itself and all that therein is are formed",
    ref: "3.70",
    certainty: "asserted",
  },
  {
    id: "plato-elements-geometric-solids",
    philosopher: "Plato",
    domain: "physics",
    gloss:
      "Each element has a geometric solid: fire a pyramid, air an octahedron, water an icosahedron, earth a cube.",
    grc: "πυρὸς μὲν γὰρ εἶναι στοιχεῖον πυραμίδα, ἀέρος τὸ ὀκτάεδρον, ὕδατος τὸ εἰκοσάεδρον, γῆς δὲ κύβον.",
    en: "the element of fire is a pyramid, of air an octahedron, of water an icosahedron, of earth a cube",
    ref: "3.70",
    certainty: "asserted",
  },
  {
    id: "plato-one-created-animate-universe",
    philosopher: "Plato",
    domain: "cosmology",
    gloss:
      "There is one created universe, made by God, and it is animate, since the animate is better than the inanimate.",
    grc: "Κόσμον τε εἶναι ἕνα γεννητόν, ἐπειδὴ καὶ αἰσθητός ἐστιν ὑπὸ θεοῦ κατεσκευασμένος· ἔμψυχόν τε εἶναι διὰ τὸ κρεῖττον εἶναι τοῦ ἀψύχου τὸ ἔμψυχον",
    en: "there is one created universe, seeing that it is perceptible to sense, which has been made by God. And it is animate because that which is animate is better than that which is inanimate",
    ref: "3.71",
    doctrine:
      "There is one created, animate universe, made by God, spherical and imperishable",
    certainty: "asserted",
  },
  {
    id: "plato-time-image-of-eternity",
    philosopher: "Plato",
    domain: "cosmology",
    gloss: "Time was created as a moving image of eternity.",
    grc: "Χρόνον τε γενέσθαι εἰκόνα τοῦ ἀϊδίου.",
    en: "Time was created as an image of eternity",
    ref: "3.73",
    certainty: "asserted",
  },
  {
    id: "plato-god-incorporeal",
    philosopher: "Plato",
    domain: "gods",
    gloss:
      "God, like the soul, is incorporeal - only thus exempt from change and decay.",
    grc: "δοκεῖ δʼ αὐτῷ τὸν θεὸν ὡς καὶ τὴν ψυχὴν ἀσώματον εἶναι· οὕτω γὰρ μάλιστα φθορᾶς καὶ πάθους ἀνεπίδεκτον ὑπάρχειν.",
    en: "He holds God, like the soul, to be incorporeal. For only thus is he exempt from change and decay",
    ref: "3.77",
    certainty: "asserted",
  },
  {
    id: "plato-ideas-causes-and-principles",
    philosopher: "Plato",
    domain: "first-principles",
    gloss:
      "The Ideas are causes and principles whereby the world of natural objects is what it is.",
    grc: "τὰς δὲ ἰδέας ὑφίσταται, καθὰ καὶ προείρηται, αἰτίας τινὰς καὶ ἀρχὰς τοῦ τοιαῦτʼ εἶναι τὰ φύσει συνεστῶτα, οἷάπερ ἐστὶν αὐτά.",
    en: "he assumes the Ideas to be causes and principles whereby the world of natural objects is what it is",
    ref: "3.77",
    doctrine:
      "The Ideas are causes and principles whereby the world of natural objects is what it is; things resemble the Ideas as copies of archetypes",
    certainty: "asserted",
  },
  {
    id: "plato-end-assimilation-to-god",
    philosopher: "Plato",
    domain: "ethics",
    gloss: "The end to aim at is assimilation to God.",
    grc: "τέλος μὲν εἶναι τὴν ἐξομοίωσιν τῷ θεῷ.",
    en: "He maintained that the end to aim at is assimilation to God",
    ref: "3.78",
    doctrine: "The end to aim at is assimilation to God",
    certainty: "asserted",
  },
  {
    id: "plato-virtue-sufficient-for-happiness",
    philosopher: "Plato",
    domain: "ethics",
    gloss:
      "Virtue suffices for happiness, but needs bodily and external advantages as instruments.",
    grc: "τὴν δʼ ἀρετὴν αὐτάρκη μὲν εἶναι πρὸς εὐδαιμονίαν. ὀργάνων δὲ προσδεῖσθαι τῶν περὶ σῶμα πλεονεκτημάτων, ἰσχύος, ὑγιείας, εὐαισθησίας, τῶν ὁμοίων· καὶ τῶν ἐκτός, οἷον πλούτου καὶ εὐγενείας καὶ δόξης.",
    en: "virtue is in itself sufficient for happiness, but that it needs in addition, as instruments for use, first, bodily advantages like health and strength, sound senses and the like, and, secondly, external advantages such as wealth, good birth and reputation",
    ref: "3.78",
    doctrine:
      "Virtue is in itself sufficient for happiness, though it needs bodily and external advantages as instruments",
    certainty: "asserted",
  },
  {
    id: "plato-wise-man-in-public-life",
    philosopher: "Plato",
    domain: "politics",
    gloss:
      "The wise man will take part in public affairs, marry, and not break the established laws.",
    grc: "πολιτεύσεσθαι αὖ καὶ γαμήσειν καὶ τοὺς κειμένους νόμους οὐ παραβήσεσθαι",
    en: "he will take part in public affairs, will marry, and will refrain from breaking the laws which have been made",
    ref: "3.78",
    certainty: "asserted",
  },
  {
    id: "plato-gods-watch-human-life",
    philosopher: "Plato",
    domain: "gods",
    gloss:
      "The gods take note of human life, and superhuman beings (daimones) exist.",
    grc: "οἴεται δὲ καὶ θεοὺς ἐφορᾶν τὰ ἀνθρώπινα καὶ δαίμονας εἶναι.",
    en: "He thinks that the gods take note of human life and that there are superhuman beings",
    ref: "3.79",
    certainty: "asserted",
  },
  {
    id: "plato-definition-of-the-good",
    philosopher: "Plato",
    domain: "ethics",
    gloss:
      "The good is defined as what is bound up with the praiseworthy, rational, useful, proper and becoming.",
    grc: "ἔννοιάν τε καλοῦ πρῶτος ἀπεφήνατο τὴν ἐχομένην τοῦ ἐπαινετοῦ καὶ λογικοῦ καὶ χρησίμου καὶ πρέποντος καὶ ἁρμόττοντος",
    en: "He was the first to define the notion of good as that which is bound up with whatever is praiseworthy and rational and useful and proper and becoming",
    ref: "3.79",
    certainty: "asserted",
  },
  {
    id: "plato-justice-law-of-god",
    philosopher: "Plato",
    domain: "ethics",
    gloss:
      "Righteousness is the law of God, incited so that wrongdoers not escape punishment even after death.",
    grc: "ἐν δὲ τοῖς διαλόγοις καὶ τὴν δικαιοσύνην θεοῦ νόμον ὑπελάμβανεν ὡς ἰσχυροτέραν προτρέψαι τὰ δίκαια πράττειν, ἵνα μὴ καὶ μετὰ θάνατον δίκας ὑπόσχοιεν ὡς κακοῦργοι.",
    en: "he conceived righteousness to be the law of God because it is stronger to incite men to do righteous acts, that malefactors may not be punished after death also",
    ref: "3.79",
    certainty: "asserted",
  },
];
