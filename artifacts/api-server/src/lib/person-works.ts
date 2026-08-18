/**
 * Works authored by person-only nodes (neither philosophers nor cited
 * sources): poets and other figures whose works the text names.
 *
 * The claims layer mints work nodes from philosopher `wrote` claims and
 * source-works.ts covers works of the cited authorities, but a work the
 * text quotes from a mere person - Achaeus' satyr play Omphale - had no
 * node of its own. This module curates those works and lod.ts emits
 * them as lo:Work nodes plus a lo:wrote triple from the existing person
 * node (person labels must already exist among the person-node layers;
 * lod.ts throws on a dangling person or a title collision so a typo
 * cannot mint a duplicate).
 *
 * Curation policy (mirrors source-works.ts):
 * - only works the text NAMES as a title - a genre reference like ἐν
 *   τοῖς Σατύροις ("second place as a writer of satiric dramas", 2.133,
 *   Hicks' reading) is deliberately NOT a work;
 * - `refs` lists every corpus section where the title occurs, verified
 *   against both the Greek and English text at curation time;
 * - the Greek title lives in GREEK_WORK_TITLES (greek-names.ts), keyed
 *   by the English label below, exactly like philosopher and source
 *   works - that is what feeds both lo:greekTitle and the tagger.
 */

export interface PersonWork {
  /** Canonical label of the existing person node. */
  person: string;
  /** English label of the work (Hicks), the knowledge-layer join key. */
  title: string;
  /** Corpus section ids where the title is named, Greek or English. */
  refs: string[];
  /** Emitted as rdfs:comment on the work node. */
  comment: string;
}

export const PERSON_WORKS: PersonWork[] = [
  {
    person: "Achaeus",
    title: "Omphale",
    refs: ["2.17.134"],
    comment:
      "The satyr play Omphale by Achaeus of Eretria, the tragedian of Tragicorum Graecorum Fragmenta vol. I: Diogenes Laertius reports that Menedemus quoted two of its lines against his political opponents (2.133) and names the play at 2.134 (ἐκ τῆς σατυρικῆς Ὀμφάλης).",
  },
];
