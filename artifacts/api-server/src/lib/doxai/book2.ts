/**
 * Curated doxography from Book 2 of Diogenes Laertius' Lives (the Ionians
 * and the Socratics), cited to Hicks section ids (book.section). See
 * doxai.ts for the model and curation rules. Source-internal: every `en`
 * is a verbatim excerpt of its cited section.
 *
 * The Cyrenaic entries (2.86–91) are the school doctrine D.L. expounds in
 * Aristippus' life ("Those then who adhered to the teaching of Aristippus
 * and were known as Cyrenaics held the following opinions"); they are
 * curated under Aristippus, the school's head, with a note.
 */
import type { Doxa } from "../doxai";

export const BOOK2_DOXAI: Doxa[] = [
  // -------------------------------------------------------------- Anaximander
  {
    id: "anaximander-unlimited-principle",
    philosopher: "Anaximander",
    domain: "first-principles",
    gloss: "The principle and element is the unlimited (apeiron), not any named stuff.",
    grc: "ἔφασκεν ἀρχὴν καὶ στοιχεῖον τὸ ἄπειρον, οὐ διορίζων ἀέρα ἢ ὕδωρ ἢ ἄλλο τι.",
    en: "He laid down as his principle and element that which is unlimited without defining it as air or water or anything else",
    ref: "2.1",
    certainty: "asserted",
  },
  {
    id: "anaximander-earth-central",
    philosopher: "Anaximander",
    domain: "cosmology",
    gloss: "The spherical earth lies at the centre of the world.",
    grc: "μέσην τε τὴν γῆν κεῖσθαι, κέντρου τάξιν ἐπέχουσαν οὖσαν σφαιροειδῆ·",
    en: "the earth, which is of spherical shape, lies in the midst, occupying the place of a centre",
    ref: "2.1",
    certainty: "asserted",
  },
  {
    id: "anaximander-moon-borrowed-light",
    philosopher: "Anaximander",
    domain: "cosmology",
    gloss: "The moon shines with light borrowed from the sun.",
    grc: "τήν τε σελήνην ψευδοφαῆ, καὶ ἀπὸ ἡλίου φωτίζεσθαι,",
    en: "the moon, shining with borrowed light, derives its illumination from the sun",
    ref: "2.1",
    certainty: "asserted",
  },
  // --------------------------------------------------------------- Anaximenes
  {
    id: "anaximenes-air-principle",
    philosopher: "Anaximenes",
    domain: "first-principles",
    gloss: "The first principle is air, or the unlimited.",
    grc: "ἀρχὴν ἀέρα εἶπε καὶ τὸ ἄπειρον.",
    en: "He took for his first principle air or that which is unlimited",
    ref: "2.3",
    certainty: "asserted",
  },
  // --------------------------------------------------------------- Anaxagoras
  {
    id: "anaxagoras-mind-over-matter",
    philosopher: "Anaxagoras",
    domain: "first-principles",
    gloss: "Mind (nous) stands above matter and set all things in order.",
    en: "was the first who set mind above matter",
    ref: "2.6",
    certainty: "asserted",
  },
  {
    id: "anaxagoras-homoeomeries",
    philosopher: "Anaxagoras",
    domain: "first-principles",
    gloss: "The principles of things are the homoeomeries - homogeneous particles.",
    grc: "ἀρχὰς δὲ τὰς ὁμοιομερείας·",
    en: "He took as his principles the homoeomeries or homogeneous molecules",
    ref: "2.8",
    certainty: "asserted",
  },
  {
    id: "anaxagoras-sun-molten-metal",
    philosopher: "Anaxagoras",
    domain: "cosmology",
    gloss: "The sun is a mass of red-hot metal, larger than the Peloponnesus.",
    grc: "τὸν ἥλιον μύδρον εἶναι διάπυρον καὶ μείζω τῆς Πελοποννήσου·",
    en: "He declared the sun to be a mass of red-hot metal and to be larger than the Peloponnesus",
    ref: "2.8",
    certainty: "asserted",
    alsoAttributedTo: "Tantalus",
    note: "D.L.: 'though others ascribe this view to Tantalus.'",
  },
  {
    id: "anaxagoras-animals-from-moisture",
    philosopher: "Anaxagoras",
    domain: "physics",
    gloss: "Animals first arose from moisture, heat and earthy matter, then bred from one another.",
    en: "Animals were produced from moisture, heat, and an earthy substance",
    ref: "2.9",
    certainty: "asserted",
  },
  // ----------------------------------------------------------------- Archelaus
  {
    id: "archelaus-heat-cold-causes",
    philosopher: "Archelaus",
    domain: "physics",
    gloss: "Becoming has two causes, heat and cold; living things arose from slime.",
    en: "there were two causes of growth or becoming, heat and cold; that living things were produced from slime",
    ref: "2.16",
    certainty: "asserted",
  },
  {
    id: "archelaus-justice-by-convention",
    philosopher: "Archelaus",
    domain: "ethics",
    gloss: "Justice and baseness exist by convention, not by nature.",
    en: "what is just and what is base depends not upon nature but upon convention",
    ref: "2.16",
    certainty: "asserted",
  },
  // ------------------------------------------------ Aristippus (the Cyrenaics)
  {
    id: "aristippus-two-states",
    philosopher: "Aristippus",
    domain: "pleasure",
    gloss: "There are two states, pleasure and pain: a smooth and a rough motion.",
    grc: "δύο πάθη ὑφίσταντο, πόνον καὶ ἡδονήν, τὴν μὲν λείαν κίνησιν, τὴν ἡδονήν, τὸν δὲ πόνον τραχεῖαν κίνησιν.",
    en: "there are two states, pleasure and pain, the former a smooth, the latter a rough motion",
    ref: "2.86",
    certainty: "asserted",
    note: "Doctrine of the Cyrenaic school, expounded by D.L. in Aristippus' life.",
  },
  {
    id: "aristippus-particular-pleasure-end",
    philosopher: "Aristippus",
    domain: "pleasure",
    gloss: "Particular pleasure is the end, desirable for its own sake; happiness only for the sake of its pleasures.",
    grc: "Εἶναί τε τὴν μερικὴν ἡδονὴν διʼ αὑτὴν αἱρετήν· τὴν δʼ εὐδαιμονίαν οὐ διʼ αὑτήν, ἀλλὰ διὰ τὰς κατὰ μέρος ἡδονάς.",
    en: "Particular pleasure is desirable for its own sake, whereas happiness is desirable not for its own sake but for the sake of particular pleasures",
    ref: "2.88",
    certainty: "asserted",
    note: "Doctrine of the Cyrenaic school, expounded by D.L. in Aristippus' life.",
  },
  {
    id: "aristippus-bodily-pleasures-better",
    philosopher: "Aristippus",
    domain: "pleasure",
    gloss: "Bodily pleasures outrank mental pleasures, and bodily pains are worse than mental pains.",
    en: "bodily pleasures are far better than mental pleasures, and bodily pains far worse than mental pains",
    ref: "2.90",
    certainty: "asserted",
    note: "Doctrine of the Cyrenaic school, expounded by D.L. in Aristippus' life.",
  },
  {
    id: "aristippus-prudence-instrumental",
    philosopher: "Aristippus",
    domain: "ethics",
    gloss: "Prudence is a good, but only for its consequences, not in itself.",
    en: "prudence is a good, though desirable not in itself but on account of its consequences",
    ref: "2.91",
    certainty: "asserted",
    note: "Doctrine of the Cyrenaic school, expounded by D.L. in Aristippus' life.",
  },
  // ------------------------------------------------------------------ Euclides
  {
    id: "euclides-good-is-one",
    philosopher: "Euclides",
    domain: "ethics",
    gloss: "The supreme good is one, called by many names - wisdom, God, Mind; its contradictory does not exist.",
    grc: "οὗτος ἓν τὸ ἀγαθὸν ἀπεφαίνετο πολλοῖς ὀνόμασι καλούμενον·",
    en: "He held the supreme good to be really one, though called by many names, sometimes wisdom, sometimes God, and again Mind",
    ref: "2.106",
    certainty: "asserted",
  },
];
