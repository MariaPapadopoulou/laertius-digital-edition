import type { Epistle } from "../epistles";

/**
 * Book 3: Archytas' letter to Dionysius II interceding for Plato's life  - 
 * quoted in Plato's own Life (hence crossAttributed). The Greek salutation
 * sits at the end of 3.21, the body in 3.22.
 */
export const BOOK3_EPISTLES: Epistle[] = [
  {
    id: "archytas-to-dionysius",
    sender: "Archytas",
    to: "Dionysius",
    ref: "3.1.22",
    grc: "Ἀρχύτας Διονυσίῳ ὑγιαίνειν.",
    grcRef: "3.1.21",
    toRef: "3.1.21",
    en: "We, being all of us the friends of Plato, have sent to you Lamiscus and Photidas in order to take the philosopher away by the terms of the agreement made with you.",
    gloss:
      "The Pythagorean statesman calls in Dionysius' pledge and extracts Plato from Syracuse alive - the letter D.L. credits with saving Plato's life.",
    topic: "politics",
    authenticity: "disputed",
    crossAttributed: true,
    note: "Quoted in Plato's Life, not Archytas' (see also 8.79). Its authenticity stands or falls with the related Platonic Seventh Letter tradition.",
  },
];
