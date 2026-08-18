import type { Epistle } from "../epistles";

/**
 * Book 7: the exchange between King Antigonus Gonatas and Zeno of Citium  - 
 * the royal invitation to Macedon (7.7) and Zeno's declining answer, pleading
 * old age and sending Persaeus and Philonides instead (7.8–9).
 */
export const BOOK7_EPISTLES: Epistle[] = [
  {
    id: "antigonus-to-zeno",
    sender: "King Antigonus",
    to: "Zeno of Citium",
    ref: "7.1.7",
    grc: "Ἐγὼ τύχῃ μὲν καὶ δόξῃ νομίζω προτερεῖν τοῦ σοῦ βίου, λόγου δὲ καὶ παιδείας καθυστερεῖν καὶ τῆς τελείας εὐδαιμονίας ἣν σὺ κέκτησαι.",
    en: "While in fortune and fame I deem myself your superior, in reason and education I own myself inferior, as well as in the perfect happiness which you have attained.",
    gloss:
      "The king of Macedon summons Zeno to court: whoever educates the ruler of Macedon educates all his subjects toward virtue.",
    topic: "invitation",
    authenticity: "disputed",
    note: "The exchange is preserved only here; ancient collections of royal-philosophic correspondence are notoriously embellished, though Antigonus' patronage of Zeno itself is well attested.",
  },
  {
    id: "zeno-to-antigonus",
    sender: "Zeno of Citium",
    to: "King Antigonus",
    ref: "7.1.8",
    grc: "Ἀποδέχομαί σου τὴν φιλομάθειαν καθόσον τῆς ἀληθινῆς καὶ εἰς ὄνησιν τεινούσης, ἀλλʼ οὐχὶ τῆς δημώδους καὶ εἰς διαστροφὴν ἠθῶν ἀντέχῃ παιδείας.",
    en: "I welcome your love of learning in so far as you cleave to that true education which tends to advantage and not to that popular counterfeit of it which serves only to corrupt morals.",
    gloss:
      "Zeno praises the king's genuine love of learning but begs off the journey - he is eighty and frail - and sends his pupils Persaeus and Philonides in his place.",
    topic: "philosophy",
    authenticity: "disputed",
    dramaticDate:
      "Zeno's eightieth year (so the letter's continuation at 7.9: 'I am now in my eightieth year')",
    note: "The exchange is preserved only here; see the note on Antigonus' letter.",
  },
];
