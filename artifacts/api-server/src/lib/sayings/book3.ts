/**
 * Curated sayings & apophthegms from Book 3 of Diogenes Laertius' Lives
 * (Plato), cited to Hicks section ids (book.section). See sayings.ts for the
 * model and curation rules.
 */
import type { Saying } from "../sayings";

export const BOOK3_SAYINGS: Saying[] = [
  // --------------------------------------------------------------------- Plato
  {
    id: "plato-tyrant-dotard",
    philosopher: "Plato",
    topic: "politics",
    gloss:
      "Told by Dionysius 'You talk like an old dotard,' he shot back: and you like a tyrant.",
    grc: "οἱ λόγοι σου, φησί, γεροντιῶσι, καὶ ὅς· σοῦ δέ γε τυραννιῶσιν.",
    en: "You talk like an old dotard. And you like a tyrant, rejoined Plato.",
    ref: "3.18",
    to: "Dionysius",
    certainty: "asserted",
  },
  {
    id: "plato-habit-no-trifle",
    philosopher: "Plato",
    topic: "education",
    gloss:
      "Rebuking a dice-player who protested he played for a trifle only: but the habit is not a trifle.",
    grc: "ἀλλὰ τό γʼ ἔθος, εἰπεῖν, οὐ μικρόν.",
    en: "But the habit, rejoined Plato, is not a trifle.",
    ref: "3.38",
    certainty: "reported",
    note: "D.L. introduces it as 'a story is told.'",
  },
  {
    id: "plato-name-memoirs",
    philosopher: "Plato",
    topic: "fame",
    gloss:
      "Asked whether there would be memoirs of him: first make a name, and memoirs will follow.",
    grc: "ἐρωτηθεὶς εἰ ἀπομνημονεύματα αὐτοῦ ἔσται ὥσπερ τῶν πρότερον ἀπεκρίνατο· ὀνόματος δεῖ τυχεῖν πρῶτον, εἶτα πολλὰ ἔσται.",
    en: "Being asked whether there would be any memoirs of him as of his predecessors, he replied, A man must first make a name, and he will have no lack of memoirs.",
    ref: "3.38",
    certainty: "asserted",
  },
  {
    id: "plato-passion-flogging",
    philosopher: "Plato",
    topic: "virtue",
    gloss:
      "To a slave: I would have flogged you, had I not been in a passion - never punish in anger.",
    grc: "μεμαστίγωσο ἄν, εἶπεν, εἰ μὴ ὠργιζόμην.",
    en: "I would have given you a flogging, had I not been in a passion.",
    ref: "3.39",
    certainty: "reported",
    note: "D.L.: 'it is alleged that he said' this to one of his slaves.",
  },
  {
    id: "plato-drunkards-mirror",
    philosopher: "Plato",
    topic: "education",
    gloss:
      "He advised drunkards to look at themselves in a mirror, to see how the habit disfigured them.",
    grc: "τοῖς μεθύουσι συνεβούλευε κατοπτρίζεσθαι· ἀποστήσεσθαι γὰρ τῆς τοιαύτης ἀσχημοσύνης.",
    en: "He advised those who got drunk to view themselves in a mirror; for they would then abandon the habit which so disfigured them.",
    ref: "3.39",
    certainty: "asserted",
  },
  {
    id: "plato-truth-pleasantest",
    philosopher: "Plato",
    topic: "speech",
    gloss:
      "The truth is the pleasantest of sounds - or, in another version, the pleasantest of all things is to speak it.",
    grc: "εἶναί τε ἥδιον τῶν ἀκουσμάτων τὴν ἀλήθειαν· οἱ δὲ τὸ λέγειν τἀληθῆ.",
    en: "He also said that the truth is the pleasantest of sounds. Another version of this saying is that the pleasantest of all things is to speak the truth.",
    ref: "3.40",
    grcRef: "3.39",
    certainty: "asserted",
  },
  {
    id: "plato-sleep-good-for-nothing",
    philosopher: "Plato",
    topic: "wisdom",
    gloss: "No one when asleep is good for anything - his verdict on over-sleeping, from the Laws.",
    grc: "κοιμώμενος οὐδεὶς οὐδενὸς ἄξιος·",
    en: "no one when asleep is good for anything",
    ref: "3.40",
    grcRef: "3.39",
    certainty: "asserted",
    note: "Quoted by D.L. from the Laws, capping Plato's disapproval of over-sleeping (3.39).",
  },
  {
    id: "plato-xenocrates-chastise-slave",
    philosopher: "Plato",
    topic: "virtue",
    gloss:
      "Asking Xenocrates to chastise his slave for him, since he was in a passion and so could not do it himself.",
    grc: "εἰσελθόντος ποτὲ Ξενοκράτους εἶπε μαστιγῶσαι τὸν παῖδα· αὐτὸν γὰρ μὴ δύνασθαι διὰ τὸ ὠργίσθαι.",
    en: "Plato asked him to chastise his slave, since he was unable to do it himself because he was in a passion.",
    ref: "3.38",
    certainty: "asserted",
    to: "Xenocrates",
  },
  {
    id: "plato-horse-pride",
    philosopher: "Plato",
    topic: "virtue",
    gloss:
      "Dismounting quickly from a horse: he was afraid he would be infected with horse-pride.",
    grc: "ἐφʼ ἵππου καθίσας εὐθέως κατέβη φήσας εὐλαβεῖσθαι μὴ ἱπποτυφίᾳ ληφθῇ.",
    en: "Being mounted on horseback, he quickly got down again, declaring that he was afraid he would be infected with horse-pride.",
    ref: "3.39",
    certainty: "asserted",
  },
  {
    id: "plato-drink-feasts-of-god",
    philosopher: "Plato",
    topic: "pleasure",
    gloss:
      "To drink to excess is nowhere becoming, save at the feasts of the god who gave the wine.",
    grc: "πίνειν δʼ εἰς μέθην οὐδαμοῦ πρέπον ἔλεγε πλὴν ἐν ταῖς ἑορταῖς τοῦ καὶ τὸν οἶνον δόντος θεοῦ.",
    en: "To drink to excess was nowhere becoming, he used to say, save at the feasts of the god who was the giver of wine.",
    ref: "3.39",
    certainty: "asserted",
  },
  {
    id: "plato-memorial-friends-books",
    philosopher: "Plato",
    topic: "fame",
    gloss:
      "His wish was to leave a memorial of himself behind, either in the hearts of his friends or in his books.",
    grc: "ἠξίου μνημόσυνον αὑτοῦ λείπεσθαι ἢ ἐν φίλοις ἢ ἐν βιβλίοις·",
    en: "His wish always was to leave a memorial of himself behind, either in the hearts of his friends or in his books.",
    ref: "3.40",
    certainty: "asserted",
  },
];
