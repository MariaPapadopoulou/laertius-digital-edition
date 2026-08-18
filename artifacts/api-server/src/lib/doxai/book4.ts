/**
 * Curated doxography from Book 4 of Diogenes Laertius' Lives (the Academy),
 * cited to Hicks section ids (book.section). See doxai.ts for the model and
 * curation rules. Source-internal: every `en` is a verbatim excerpt of its
 * cited section. Book 4 is overwhelmingly biographical; only Arcesilaus'
 * scepticism is stated as a tenet.
 */
import type { Doxa } from "../doxai";

export const BOOK4_DOXAI: Doxa[] = [
  {
    id: "arcesilaus-suspension-of-judgement",
    philosopher: "Arcesilaus",
    domain: "epistemology",
    gloss: "Suspension of judgement: the contradictions of opposing arguments bar assent.",
    grc: "πρῶτος ἐπισχὼν τὰς ἀποφάσεις διὰ τὰς ἐναντιότητας τῶν λόγων.",
    en: "he was the first to suspend his judgement owing to the contradictions of opposing arguments",
    ref: "4.28",
    certainty: "asserted",
  },
];
