import type { Epistle } from "../epistles";

/**
 * Book 10: the only letters in the Lives that scholarship accepts as
 * genuine - Epicurus' three doctrinal epistles, which D.L. quotes in full
 * (to Herodotus 10.35–83, to Pythocles 10.84–116, to Menoeceus 10.122–135),
 * plus the deathbed note to Idomeneus. Each entry's `ref` points at the
 * letter's opening; the salutations sit in the preceding sections.
 */
export const BOOK10_EPISTLES: Epistle[] = [
  {
    id: "epicurus-to-idomeneus",
    sender: "Epicurus",
    to: "Idomeneus",
    ref: "10.1.22",
    grc: "Τὴν μακαρίαν ἄγοντες καὶ ἅμα τελευταίαν ἡμέραν τοῦ βίου ἐγράφομεν ὑμῖν ταυτί.",
    en: "On this blissful day, which is also the last of my life, I write this to you. My continual sufferings from strangury and dysentery are so great that nothing could augment them; but over against them all I set gladness of mind at the remembrance of our past conversations.",
    gloss:
      "Epicurus' deathbed note: in extreme bodily pain yet 'blissful' in the memory of philosophical conversation, he entrusts Metrodorus' children to Idomeneus.",
    topic: "death",
    authenticity: "authentic",
    dramaticDate: "the last day of Epicurus' life (so the letter itself), 270 BC",
  },
  {
    id: "epicurus-to-herodotus",
    sender: "Epicurus",
    to: "Herodotus",
    ref: "10.1.35",
    grc: "Ἐπίκουρος Ἡροδότῳ χαίρειν.",
    grcRef: "10.1.34",
    en: "For those who are unable to study carefully all my physical writings or to go into the longer treatises at all, I have myself prepared an epitome of the whole system, Herodotus, to preserve in the memory enough of the principal doctrines",
    gloss:
      "The Letter to Herodotus: Epicurus' own epitome of his physics - atoms, void, and the mortal soul - quoted in full by D.L. at 10.35–83.",
    topic: "philosophy",
    authenticity: "authentic",
    note: "The addressee is Epicurus' pupil Herodotus, not the historian.",
  },
  {
    id: "epicurus-to-pythocles",
    sender: "Epicurus",
    to: "Pythocles",
    ref: "10.1.84",
    grc: "Ἐπίκουρος Πυθοκλεῖ χαίρειν.",
    grcRef: "10.1.83",
    toRef: "10.1.83",
    en: "In your letter to me, of which Cleon was the bearer, you continue to show me affection which I have merited by my devotion to you, and you try, not without success, to recall the considerations which make for a happy life.",
    gloss:
      "The Letter to Pythocles on celestial phenomena - eclipses, comets and weather admit multiple explanations, and dogmatism about them breeds superstition; quoted in full at 10.84–116.",
    topic: "philosophy",
    authenticity: "disputed",
    note: "Doubted since antiquity as a school compilation from Epicurus' On Nature rather than his own composition, though its doctrine is authentically Epicurean.",
  },
  {
    id: "epicurus-to-menoeceus",
    sender: "Epicurus",
    to: "Menoeceus",
    ref: "10.1.122",
    grc: "Ἐπίκουρος Μενοικεῖ χαίρειν.",
    grcRef: "10.1.121",
    toRef: "10.1.121",
    en: "Let no one be slow to seek wisdom when he is young nor weary in the search thereof when he is grown old. For no age is too early or too late for the health of the soul.",
    gloss:
      "The Letter to Menoeceus: Epicurus' ethical creed - the gods are no threat, death is nothing to us, and pleasure rightly understood is the beginning and end of the blessed life; quoted in full at 10.122–135.",
    topic: "philosophy",
    authenticity: "authentic",
  },
];
