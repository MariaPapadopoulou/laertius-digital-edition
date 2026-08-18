import type { Epistle } from "../epistles";

/**
 * Book 2: the two Ionic letters of Anaximenes to Pythagoras (Hellenistic
 * fictions, like the book-1 correspondence) and the opening of Menedemus of
 * Eretria's letter of self-defence to King Demetrius - of which D.L.
 * preserves only the first sentence.
 */
export const BOOK2_EPISTLES: Epistle[] = [
  {
    id: "anaximenes-to-pythagoras-1",
    sender: "Anaximenes",
    to: "Pythagoras",
    ref: "2.2.4",
    grc: "Θαλῆς Ἐξαμύου ἐπὶ γήρως οὐκ εὐπότμως οἴχεται·",
    en: "Thales, the son of Examyas, has met an unkind fate in his old age. He went out from the court of his house at night, as was his custom, with his maidservant to view the stars, and, forgetting where he was, as he gazed, he got to the edge of a steep slope and fell over.",
    gloss:
      "Anaximenes reports Thales' death - the star-gazer who fell down a slope while watching the sky - and vows that his school will keep the master's teaching alive.",
    topic: "death",
    authenticity: "spurious",
  },
  {
    id: "anaximenes-to-pythagoras-2",
    sender: "Anaximenes",
    to: "Pythagoras",
    ref: "2.2.5",
    grc: "Εὐβουλότατος ἦς ἡμέων, μεταναστὰς ἐκ Σάμου ἐς Κρότωνα, ἐνθάδε εἰρηνέεις.",
    en: "You were better advised than the rest of us when you left Samos for Croton, where you live in peace.",
    gloss:
      "Under tyrants at home and the looming Median war, Anaximenes envies Pythagoras his peaceful Croton: how can one study the heavens 'in dread of destruction or slavery'?",
    topic: "politics",
    authenticity: "spurious",
  },
  {
    id: "menedemus-to-demetrius",
    sender: "Menedemus of Eretria",
    to: "King Demetrius",
    ref: "2.17.141",
    grc: "Μενέδημος βασιλεῖ Δημητρίῳ χαίρειν. ἀκούω πρὸς σὲ ἀνατεθῆναι περὶ ἡμῶν.",
    en: "Menedemus to King Demetrius, greeting. I hear that a report has reached you concerning me.",
    gloss:
      "The opening of Menedemus' letter of self-defence against a political denunciation - D.L. preserves only this first sentence.",
    topic: "politics",
    authenticity: "disputed",
    note: "Only the opening sentence is quoted; D.L. adds the counter-report that a political rival, one Aeschylus, was behind the denunciation.",
  },
];
