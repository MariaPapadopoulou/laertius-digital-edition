import type { Epistle } from "../epistles";

/**
 * Book 8: the Doric exchange between Archytas and Plato over the memoirs of
 * Ocellus the Lucanian. Archytas' salutation stands at the end of 8.79 and
 * his body in 8.80; Plato's salutation at the end of 8.80 and his body in
 * 8.81. Both letters are widely regarded as products of the same
 * pseudo-Pythagorean workshop that fabricated the Ocellus treatises they
 * advertise - hence "disputed" rather than taking a side.
 */
export const BOOK8_EPISTLES: Epistle[] = [
  {
    id: "archytas-to-plato",
    sender: "Archytas",
    to: "Plato",
    ref: "8.4.80",
    grc: "Καλῶς ποιέεις ὅτι ἀποπέφευγας ἐκ τᾶς ἀρρωστίας·",
    en: "You have done well to get rid of your ailment, as we learn both from your own message and through Lamiscus that you have: we attended to the matter of the memoirs and went up to Lucania where we found the true progeny of Ocellus",
    gloss:
      "Archytas reports tracking down the writings of Ocellus in Lucania and sends four of the treatises on to Plato.",
    topic: "writings",
    authenticity: "disputed",
    note: "The letter authenticates the (pseudepigraphic) Ocellus treatises it accompanies - a classic mark of the pseudo-Pythagorean letter workshop.",
  },
  {
    id: "plato-to-archytas",
    sender: "Plato",
    to: "Archytas",
    ref: "8.4.81",
    grc: "Πλάτων Ἀρχύτᾳ εὖ πράττειν.",
    grcRef: "8.4.80",
    toRef: "8.4.80",
    en: "I was overjoyed to get the memoirs which you sent, and I am very greatly pleased with the writer of them; he seems to be a right worthy descendant of his distant forbears.",
    gloss:
      "Plato thanks Archytas for the memoirs of Ocellus and begs for the rest as soon as they are found.",
    topic: "writings",
    authenticity: "disputed",
    note: "Transmitted as Plato's Epistle XII, where it is flagged as of doubtful authenticity already in the manuscripts; see the note on Archytas' letter.",
  },
];
