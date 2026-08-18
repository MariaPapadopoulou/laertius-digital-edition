/**
 * Curated sayings & apophthegms from Book 9 of Diogenes Laertius' Lives
 * (Heraclitus, the Eleatics, the Atomists, the Sceptics: Pyrrho, ...), cited
 * to Hicks section ids (book.section). See sayings.ts for the model and rules.
 */
import type { Saying } from "../sayings";

export const BOOK9_SAYINGS: Saying[] = [
  // ---------------------------------------------------------------- Heraclitus
  {
    id: "heraclitus-much-learning",
    philosopher: "Heraclitus",
    topic: "wisdom",
    gloss:
      "Much learning does not teach understanding - else it would have taught Hesiod and Pythagoras.",
    grc: "πολυμαθίη νόον οὐ διδάσκει· Ἡσίοδον γὰρ ἂν ἐδίδαξε καὶ Πυθαγόρην, αὖτίς τε Ξενοφάνεά τε καὶ Ἑκαταῖον.",
    en: "Much learning does not teach understanding; else would it have taught Hesiod and Pythagoras, or, again, Xenophanes and Hecataeus.",
    ref: "9.1",
    certainty: "asserted",
    note: "Quoted by D.L. from Heraclitus' own book.",
  },
  {
    id: "heraclitus-insolence-fire",
    philosopher: "Heraclitus",
    topic: "virtue",
    gloss:
      "There is more need to extinguish insolence than an outbreak of fire.",
    grc: "ὕβριν χρὴ σβεννύναι μᾶλλον ἢ πυρκαϊὴν",
    en: "There is more need to extinguish insolence than an outbreak of fire",
    ref: "9.2",
    certainty: "asserted",
  },
  {
    id: "heraclitus-fight-for-law",
    philosopher: "Heraclitus",
    topic: "politics",
    gloss: "The people must fight for the law as for city-walls.",
    grc: "μάχεσθαι χρὴ τὸν δῆμον ὑπὲρ τοῦ νόμου ὅκωσπερ τείχεος.",
    en: "The people must fight for the law as for citywalls.",
    ref: "9.2",
    certainty: "asserted",
  },
  {
    id: "heraclitus-knucklebones",
    philosopher: "Heraclitus",
    topic: "wit",
    gloss:
      "Caught playing knuckle-bones with boys in the temple: is it not better than taking part in your civil life?",
    grc: "τί, ὦ κάκιστοι, θαυμάζετε; εἶπεν· ἢ οὐ κρεῖττον τοῦτο ποιεῖν ἢ μεθʼ ὑμῶν πολιτεύεσθαι;",
    en: "Why, you rascals, he said, are you astonished? Is it not better to do this than to take part in your civil life?",
    ref: "9.3",
    to: "the Ephesians",
    certainty: "asserted",
  },
  {
    id: "heraclitus-silence-chatter",
    philosopher: "Heraclitus",
    topic: "speech",
    gloss: "Asked why he kept silence: why, to let you chatter.",
    grc: "ἐρωτηθέντα διὰ τί σιωπᾷ, φάναι ἵνʼ ὑμεῖς λαλῆτε.",
    en: "We are told that, when asked why he kept silence, he replied, Why, to let you chatter.",
    ref: "9.12",
    certainty: "reported",
  },
  {
    id: "heraclitus-knew-nothing",
    philosopher: "Heraclitus",
    topic: "wisdom",
    gloss:
      "As a youth he used to say he knew nothing - though grown up, he claimed to know everything.",
    grc: "νέος ὢν ἔφασκε μηδὲν εἰδέναι, τέλειος μέντοι γενόμενος πάντʼ ἐγνωκέναι.",
    en: "when a youth he used to say that he knew nothing, although when he was grown up he claimed that he knew everything.",
    ref: "9.5",
    certainty: "asserted",
  },
  {
    id: "heraclitus-inquired-of-himself",
    philosopher: "Heraclitus",
    topic: "self-sufficiency",
    gloss:
      "Nobody's pupil: he inquired of himself and learned everything from himself.",
    grc: "αὑτὸν ἔφη διζήσασθαι καὶ μαθεῖν πάντα παρʼ ἑαυτοῦ.",
    en: "he declared that he inquired of himself, and learned everything from himself.",
    ref: "9.5",
    certainty: "asserted",
  },
  // ---------------------------------------------------------------- Xenophanes
  {
    id: "xenophanes-tyrant-encounters",
    philosopher: "Xenophanes",
    topic: "politics",
    gloss:
      "Our encounters with tyrants should be as few, or else as pleasant, as possible.",
    grc: "τοῖς τυράννοις ἐντυγχάνειν ἢ ὡς ἥκιστα ἢ ὡς ἥδιστα.",
    en: "our encounters with tyrants should be as few, or else as pleasant, as possible",
    ref: "9.20",
    certainty: "asserted",
  },
  {
    id: "xenophanes-wise-recognize-wise",
    philosopher: "Xenophanes",
    topic: "wisdom",
    gloss:
      "When Empedocles said no wise man could be found: naturally, for it takes a wise man to recognize a wise man.",
    grc: "εἰκότως, ἔφη· σοφὸν γὰρ εἶναι δεῖ τὸν ἐπιγνωσόμενον τὸν σοφόν.",
    en: "Naturally, he replied, for it takes a wise man to recognize a wise man.",
    ref: "9.20",
    to: "Empedocles",
    certainty: "asserted",
  },
  {
    id: "xenophanes-mass-falls-short",
    philosopher: "Xenophanes",
    topic: "wisdom",
    gloss: "The mass of things falls short of thought.",
    grc: "Ἔφη δὲ καὶ τὰ πολλὰ ἥσσω νοῦ εἶναι.",
    en: "He also said that the mass of things falls short of thought",
    ref: "9.20",
    certainty: "asserted",
  },
  // -------------------------------------------------------------- Zeno of Elea
  {
    id: "zeno-elea-abuse-praise",
    philosopher: "Zeno of Elea",
    topic: "wit",
    gloss:
      "Blamed for losing his temper at abuse: if I pretend not to notice abuse, neither shall I notice praise.",
    grc: "ἐὰν μὴ λοιδορούμενος προσποιῶμαι, οὐδʼ ἐπαινούμενος αἰσθήσομαι.",
    en: "If when I am abused I pretend that I am not, then neither shall I be aware of it if I am praised.",
    ref: "9.29",
    certainty: "reported",
    note: "D.L.: 'We are told that once when he was reviled he lost his temper.'",
  },
  // ---------------------------------------------------------------- Democritus
  {
    id: "democritus-athens-unknown",
    philosopher: "Democritus",
    topic: "fame",
    gloss:
      "He despised fame: 'I came to Athens and no one knew me.'",
    grc: "ἦλθον γάρ, φησίν, εἰς Ἀθήνας καὶ οὔτις με ἔγνωκεν.",
    en: "I came to Athens and no one knew me.",
    ref: "9.36",
    certainty: "reported",
    accordingTo: "Demetrius",
  },
  {
    id: "democritus-speech-shadow",
    philosopher: "Democritus",
    topic: "speech",
    gloss: "Speech is the shadow of action.",
    grc: "λόγος ἔργου σκιή.",
    en: "Speech is the shadow of action.",
    ref: "9.37",
    certainty: "asserted",
  },
  // ---------------------------------------------------------------- Protagoras
  {
    id: "protagoras-man-measure",
    philosopher: "Protagoras",
    topic: "wisdom",
    gloss:
      "Man is the measure of all things - the opening of his book.",
    grc: "πάντων χρημάτων μέτρον ἄνθρωπος, τῶν μὲν ὄντων ὡς ἔστιν, τῶν δὲ οὐκ ὄντων ὡς οὐκ ἔστιν.",
    en: "Man is the measure of all things, of things that are that they are, and of things that are not that they are not.",
    ref: "9.51",
    certainty: "asserted",
  },
  {
    id: "protagoras-gods-unknowable",
    philosopher: "Protagoras",
    topic: "religion",
    gloss:
      "As to the gods, he had no means of knowing whether they exist or not - the obscurity of the question and the shortness of life stand in the way.",
    grc: "περὶ μὲν θεῶν οὐκ ἔχω εἰδέναι οὔθʼ ὡς εἰσίν, οὔθʼ ὡς οὐκ εἰσίν·",
    en: "As to the gods, I have no means of knowing either that they exist or that they do not exist. For many are the obstacles that impede knowledge, both the obscurity of the question and the shortness of human life.",
    ref: "9.51",
    certainty: "asserted",
  },
  // ---------------------------------------------------------------- Anaxarchus
  {
    id: "anaxarchus-satraps-head",
    philosopher: "Anaxarchus",
    topic: "wit",
    gloss:
      "Asked by Alexander how he liked the feast: magnificent - only a satrap's head is lacking. The jab at Nicocreon cost him his life.",
    grc: "ὦ βασιλεῦ, πάντα πολυτελῶς· ἔδει δὲ λοιπὸν κεφαλὴν σατράπου τινὸς παρατεθεῖσθαι·",
    en: "Everything, O king, is magnificent; there is only one thing lacking, that the head of some satrap should be served up at table.",
    ref: "9.58",
    to: "Alexander",
    certainty: "reported",
    note: "D.L.: 'he is said to have answered.'",
  },
  {
    id: "anaxarchus-pound-the-pouch",
    philosopher: "Anaxarchus",
    topic: "death",
    gloss:
      "Pounded to death in a mortar by Nicocreon: pound the pouch containing Anaxarchus; ye pound not Anaxarchus.",
    grc: "πτίσσε τὸν Ἀναξάρχου θύλακον, Ἀνάξαρχον δὲ οὐ πτίσσεις.",
    en: "Pound, pound the pouch containing Anaxarchus; ye pound not Anaxarchus.",
    ref: "9.59",
    certainty: "asserted",
  },
  {
    id: "anaxarchus-blood-not-ichor",
    philosopher: "Anaxarchus",
    topic: "religion",
    gloss:
      "Deflating Alexander's divine pretensions at the sight of his wound: see, blood - not the ichor of the blessed gods.",
    grc: "τουτὶ μὲν αἷμα καὶ οὐκ ἰχὼρ οἷός πέρ τε ῥέει μακάρεσσι θεοῖσι.",
    en: "See, there is blood and not Ichor which courses in the veins of the blessed gods.",
    ref: "9.60",
    to: "Alexander",
    certainty: "disputed",
    note: "D.L. adds: 'Plutarch reports this as spoken by Alexander to his friends.'",
  },
  // -------------------------------------------------------------------- Pyrrho
  {
    id: "pyrrho-training-to-be-good",
    philosopher: "Pyrrho",
    topic: "virtue",
    gloss:
      "Found talking to himself and asked why: he was training to be good.",
    grc: "ἐρωτηθεὶς τὴν αἰτίαν ἔφη μελετᾶν χρηστὸς εἶναι.",
    en: "On being discovered once talking to himself, he answered, when asked the reason, that he was training to be good.",
    ref: "9.64",
    certainty: "asserted",
  },
  {
    id: "pyrrho-strip-human-weakness",
    philosopher: "Pyrrho",
    topic: "wisdom",
    gloss:
      "Frightened by a dog and criticized for it: it is not easy entirely to strip oneself of human weakness - but strive against facts, by deeds or by word.",
    grc: "ὡς χαλεπὸν εἴη ὁλοσχερῶς ἐκδῦναι τὸν ἄνθρωπον· διαγωνίζεσθαι δʼ ὡς οἷόν τε πρῶτον μὲν τοῖς ἔργοις πρὸς τὰ πράγματα, εἰ δὲ μή, τῷ γε λόγῳ.",
    en: "it was not easy entirely to strip oneself of human weakness; but one should strive with all one's might against facts, by deeds if possible, and if not, in word",
    ref: "9.66",
    certainty: "asserted",
  },
  {
    id: "pyrrho-pig-in-storm",
    philosopher: "Pyrrho",
    topic: "self-sufficiency",
    gloss:
      "In a storm at sea he pointed to a little pig calmly eating: such is the unperturbed state the wise man should keep.",
    grc: "δείξας ἐν τῷ πλοίῳ χοιρίδιον ἐσθίον καὶ εἰπὼν ὡς χρὴ τὸν σοφὸν ἐν τοιαύτῃ καθεστάναι ἀταραξίᾳ.",
    en: "he kept calm and confident, pointing to a little pig in the ship that went on eating, and telling them that such was the unperturbed state in which the wise man should keep himself",
    ref: "9.68",
    certainty: "reported",
    accordingTo: "Posidonius",
  },
  // --------------------------------------------------------------------- Timon
  {
    id: "timon-homer-ancient-copies",
    philosopher: "Timon",
    topic: "education",
    gloss:
      "How to get a trustworthy text of Homer: get hold of the ancient copies, not the corrected copies of our day.",
    grc: "εἰ τοῖς ἀρχαίοις ἀντιγράφοις ἐντυγχάνοι καὶ μὴ τοῖς ἤδη διωρθωμένοις.",
    en: "You can, if you get hold of the ancient copies, and not the corrected copies of our day.",
    ref: "9.113",
    to: "Aratus",
    certainty: "reported",
    note: "D.L.: 'Aratus is said to have asked him.'",
  },
  {
    id: "timon-four-eyes",
    philosopher: "Timon",
    topic: "wit",
    gloss:
      "To a man who marvelled at everything: why not marvel that we three have but four eyes between us? (He and his disciple each had one.)",
    grc: "τί δʼ οὐ θαυμάζεις ὅτι τρεῖς ὄντες τέτταρας ἔχομεν ὀφθαλμούς;",
    en: "Why do you not marvel that we three have but four eyes between us?",
    ref: "9.114",
    certainty: "asserted",
  },
  {
    id: "timon-laugh-in-full-view",
    philosopher: "Timon",
    topic: "wit",
    gloss:
      "Asked by Arcesilaus why he had come from Thebes: why, to laugh when I have you all in full view!",
    grc: "ἔφη, ἵνʼ ὑμᾶς ἀναπεπταμένους ὁρῶν γελῶ.",
    en: "Why, to laugh when I have you all in full view !",
    ref: "9.115",
    to: "Arcesilaus",
    certainty: "asserted",
  },
];
