/**
 * Curated doxography from Book 1 of Diogenes Laertius' Lives (the Seven
 * Sages), cited to Hicks section ids (book.section). See doxai.ts for the
 * model and curation rules. Source-internal: every `en` is a verbatim
 * excerpt of its cited section.
 */
import type { Doxa } from "../doxai";

export const BOOK1_DOXAI: Doxa[] = [
  // -------------------------------------------------------------------- Thales
  {
    id: "thales-water-first-principle",
    philosopher: "Thales",
    domain: "first-principles",
    gloss: "Water is the universal primary substance.",
    grc: "Ἀρχὴν δὲ τῶν πάντων ὕδωρ ὑπεστήσατο,",
    en: "His doctrine was that water is the universal primary substance",
    ref: "1.27",
    certainty: "asserted",
  },
  {
    id: "thales-world-animate",
    philosopher: "Thales",
    domain: "cosmology",
    gloss: "The world is animate and full of divinities.",
    grc: "τὸν κόσμον ἔμψυχον καὶ δαιμόνων πλήρη.",
    en: "the world is animate and full of divinities",
    ref: "1.27",
    certainty: "asserted",
  },
  {
    id: "thales-soul-in-inanimate",
    philosopher: "Thales",
    domain: "soul",
    gloss:
      "Even inanimate things share in soul, argued from the magnet and amber.",
    grc: "τοῖς ἀψύχοις μεταδιδόναι ψυχῆς, τεκμαιρόμενον ἐκ τῆς λίθου τῆς μαγνήτιδος καὶ τοῦ ἠλέκτρου.",
    en: "arguing from the magnet and from amber, he attributed a soul or life even to inanimate objects",
    ref: "1.24",
    certainty: "reported",
    accordingTo: "Aristotle",
    note: "D.L.: 'Aristotle and Hippias affirm' it; Hippias is the second authority.",
  },
  {
    id: "thales-soul-immortal",
    philosopher: "Thales",
    domain: "soul",
    gloss: "The soul is immortal - he was said to be the first to maintain it.",
    grc: "ἀθανάτους τὰς ψυχάς",
    en: "he was the first to maintain the immortality of the soul",
    ref: "1.24",
    certainty: "reported",
    accordingTo: "Choerilus",
    note: "D.L.: 'some, including Choerilus the poet, declare.'",
  },
];
