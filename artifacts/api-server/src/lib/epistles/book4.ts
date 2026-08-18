import type { Epistle } from "../epistles";

/**
 * Book 4: Arcesilaus' covering letter to Thaumasias, sent with the third
 * copy of his will. Salutation at the end of 4.43, body in 4.44.
 */
export const BOOK4_EPISTLES: Epistle[] = [
  {
    id: "arcesilaus-to-thaumasias",
    sender: "Arcesilaus",
    to: "Thaumasias",
    ref: "4.6.44",
    grc: "Ἀρκεσίλαος Θαυμασίᾳ χαίρειν.",
    grcRef: "4.6.43",
    toRef: "4.6.43",
    en: "I have given Diogenes my will to be conveyed to you. For, owing to my frequent illnesses and the weak state of my body, I decided to make a will, in order that, if anything untoward should happen, you, who have been so devotedly attached to me, should not suffer by my decease.",
    gloss:
      "Ailing, Arcesilaus entrusts a kinsman with the third copy of his will - 'you are the most deserving of my friends in these parts'.",
    topic: "death",
    authenticity: "disputed",
    note: "Quoted alongside the will itself; likely drawn from the same documentary collection as the Academic and Peripatetic wills, but its transmission cannot be verified.",
  },
];
