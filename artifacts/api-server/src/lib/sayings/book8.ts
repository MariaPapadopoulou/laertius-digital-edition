/**
 * Curated sayings & apophthegms from Book 8 of Diogenes Laertius' Lives
 * (Pythagoras and the Pythagoreans, Empedocles, ...), cited to Hicks section
 * ids (book.section). See sayings.ts for the model and curation rules.
 */
import type { Saying } from "../sayings";

export const BOOK8_SAYINGS: Saying[] = [
  // ---------------------------------------------------------------- Pythagoras
  {
    id: "pythagoras-life-great-games",
    philosopher: "Pythagoras",
    topic: "wisdom",
    gloss:
      "Asked by Leon of Phlius who he was, he said 'a philosopher' and compared life to the Great Games: some compete, some sell, the best look on.",
    grc: "καὶ τὸν βίον ἐοικέναι πανηγύρει· ὡς οὖν εἰς ταύτην οἱ μὲν ἀγωνιούμενοι, οἱ δὲ κατʼ ἐμπορίαν, οἱ δέ γε βέλτιστοι ἔρχονται θεαταί, οὕτως ἐν τῷ βίῳ οἱ μὲν ἀνδραποδώδεις, ἔφη, φύονται δόξης καὶ πλεονεξίας θηραταί, οἱ δὲ φιλόσοφοι τῆς ἀληθείας.",
    en: "when Leon the tyrant of Phlius asked him who he was, he said, A philosopher, and that he compared life to the Great Games, where some went to compete for the prize and others went with wares to sell, but the best as spectators; for similarly, in life, some grow up with servile natures, greedy for fame and gain, but the philosopher seeks for truth",
    ref: "8.8",
    to: "Leon of Phlius",
    certainty: "reported",
    accordingTo: "Sosicrates",
  },
  {
    id: "pythagoras-no-prayer-for-self",
    philosopher: "Pythagoras",
    topic: "religion",
    gloss:
      "He forbids praying for ourselves, because we do not know what will help us.",
    grc: "οὐκ ἐᾷ εὔχεσθαι ὑπὲρ ἑαυτῶν διὰ τὸ μὴ εἰδέναι τὸ συμφέρον.",
    en: "He forbids us to pray for ourselves, because we do not know what will help us.",
    ref: "8.9",
    certainty: "asserted",
    note: "From the treatises D.L. presents as Pythagoras' own (8.9).",
  },
  {
    id: "pythagoras-lose-strength",
    philosopher: "Pythagoras",
    topic: "pleasure",
    gloss:
      "Asked when a man should consort with a woman: when you want to lose what strength you have.",
    grc: "ἐρωτηθέντα πότε δεῖ πλησιάζειν εἰπεῖν· ὅταν βούλῃ γενέσθαι σωυτοῦ ἀσθενέστερος.",
    en: "Asked once when a man should consort with a woman, he replied, When you want to lose what strength you have.",
    ref: "8.9",
    certainty: "asserted",
  },
  {
    id: "pythagoras-friends-common",
    philosopher: "Pythagoras",
    topic: "friendship",
    gloss:
      "The first to say 'Friends have all things in common' and 'Friendship is equality' - and his disciples pooled their goods.",
    grc: "εἶπέ τε πρῶτος, ὥς φησι Τίμαιος, κοινὰ τὰ φίλων εἶναι καὶ φιλίαν ἰσότητα.",
    en: "he was the first to say, Friends have all things in common and Friendship is equality",
    ref: "8.10",
    certainty: "reported",
    accordingTo: "Timaeus",
  },
  {
    id: "pythagoras-daily-self-examination",
    philosopher: "Pythagoras",
    topic: "virtue",
    gloss:
      "His nightly self-examination: where did I trespass? What did I achieve? What duties did I leave unfulfilled?",
    grc: "πῆ παρέβην; τί δʼ ἔρεξα; τί μοι δέον οὐκ ἐτελέσθη;",
    en: "Always to say on entering their own doors: Where did I trespass? What did I achieve? And unfulfilled what duties did I leave?",
    ref: "8.22",
    certainty: "reported",
    note: "D.L.: 'He is said to have advised his disciples as follows.'",
  },
  {
    id: "pythagoras-enemies-into-friends",
    philosopher: "Pythagoras",
    topic: "friendship",
    gloss:
      "Behave to one another so as not to make friends into enemies, but to turn enemies into friends.",
    grc: "ἀλλήλοις θʼ ὁμιλεῖν, ὡς τοὺς μὲν φίλους ἐχθροὺς μὴ ποιῆσαι, τοὺς δʼ ἐχθροὺς φίλους ἐργάσασθαι.",
    en: "so to behave one to another as not to make friends into enemies, but to turn enemies into friends",
    ref: "8.23",
    certainty: "reported",
    note: "From the precepts D.L. reports he gave his disciples (8.22-23).",
  },
  // ---------------------------------------------------------------- Empedocles
  {
    id: "empedocles-agrigentines-luxury",
    philosopher: "Empedocles",
    topic: "pleasure",
    gloss:
      "The Agrigentines live delicately as if to die tomorrow, but build as if to live for ever.",
    grc: "Ἀκραγαντῖνοι τρυφῶσι μὲν ὡς αὔριον ἀποθανούμενοι, οἰκίας δὲ κατασκευάζονται ὡς πάντα τὸν χρόνον βιωσόμενοι.",
    en: "The Agrigentines live delicately as if tomorrow they would die, but they build their houses well as if they thought they would live for ever.",
    ref: "8.63",
    certainty: "reported",
    accordingTo: "Timaeus",
  },
  {
    id: "empedocles-immortal-god",
    philosopher: "Empedocles",
    topic: "fame",
    gloss:
      "His own boast, in his verses: 'All hail! I go about among you an immortal god, no more a mortal.'",
    grc: "χαίρετʼ· ἐγὼ δʼ ὑμῖν θεὸς ἄμβροτος, οὐκέτι θνητὸς πωλεῦμαι",
    en: "All hail! I go about among you an immortal god, no more a mortal",
    ref: "8.66",
    certainty: "asserted",
    note: "Quoted by D.L. from Empedocles' own poetry as evidence of his boastfulness.",
  },
];
// Note: Alcmaeon's "Most human affairs go in pairs" (Hicks 8.83) is omitted:
// the ref key 8.83 is ambiguous and first-matches Archytas' section (8.4.83),
// so the citation cannot resolve to Alcmaeon's chapter (8.5.83).
