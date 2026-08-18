import type { Epistle } from "../epistles";

/**
 * Book 9: the exchange between King Darius and Heraclitus - the royal
 * invitation to Persia and the philosopher's scornful one-paragraph refusal.
 * Both are stock items of the pseudepigraphic Heraclitean letter tradition.
 */
export const BOOK9_EPISTLES: Epistle[] = [
  {
    id: "darius-to-heraclitus",
    sender: "King Darius",
    to: "Heraclitus",
    ref: "9.1.13",
    grc: "Καταβέβλησαι λόγον Περὶ φύσεως δυσνόητόν τε καὶ δυσεξήγητον.",
    en: "You are the author of a treatise On Nature which is hard to understand and hard to interpret.",
    gloss:
      "The Great King, defeated by the obscurity of Heraclitus' book, invites its author to court to explain it in person.",
    topic: "invitation",
    authenticity: "spurious",
  },
  {
    id: "heraclitus-to-darius",
    sender: "Heraclitus",
    to: "King Darius",
    ref: "9.1.14",
    grc: "Ὁκόσοι τυγχάνουσιν ὄντες ἐπιχθόνιοι τῆς μὲν ἀληθηίης καὶ δικαιοπραγμοσύνης ἀπέχονται, ἀπληστίῃ δὲ καὶ δοξοκοπίῃ προσέχουσι κακῆς ἕνεκα ἀνοίης.",
    en: "All men upon earth hold aloof from truth and justice, while, by reason of wicked folly, they devote themselves to avarice and thirst for popularity.",
    gloss:
      "Heraclitus refuses the King of Persia: content with little, he will not trade his freedom from envy and ostentation for a court.",
    topic: "philosophy",
    authenticity: "spurious",
  },
];
