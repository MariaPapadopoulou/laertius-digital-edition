/**
 * Works authored by cited sources (not by the philosophers of the Lives).
 *
 * The claims layer only mints work nodes from philosopher `wrote` claims,
 * so a work that Diogenes Laertius cites *as a source* - Hermippus' On
 * the Sages, Apollodorus' Chronology - has no node of its own even when
 * the text names it constantly. This module curates those works and
 * lod.ts emits them as lo:Work nodes plus a lo:wrote triple from the
 * existing source node (source labels must already exist in the graph;
 * lod.ts throws on a dangling source so a typo cannot mint a duplicate).
 *
 * Curation policy:
 * - only works the text NAMES as a title (ἐν τοῖς Χρονικοῖς, ἐν τῷ Περὶ
 *   τῶν σοφῶν) - not every lost book an authority is known to have
 *   written;
 * - `refs` lists every corpus section where the title occurs, verified
 *   against both the Greek and English text at curation time;
 * - the Greek title itself lives in GREEK_WORK_TITLES (greek-names.ts),
 *   keyed by the English label below, exactly like philosopher works  - 
 *   that is what feeds both the lo:greekTitle literal and the tagger.
 *
 * Homonym warning recorded here for future curators: Περὶ τῶν σοφῶν is
 * ALSO the Greek title of Theophrastus' "Of the Wise (one book)"
 * (5.2.48, in his catalogue). Both title specs carry `onlySections`
 * scopes so each occurrence tags the right work; see greek-names.ts.
 */

export interface SourceWork {
  /** Canonical label of the existing lo:Source node (entity-links.ts). */
  source: string;
  /** English label of the work (Hicks), the knowledge-layer join key. */
  title: string;
  /** Corpus section ids where the title is named, Greek or English. */
  refs: string[];
  /** Emitted as rdfs:comment on the work node. */
  comment: string;
}

export const SOURCE_WORKS: SourceWork[] = [
  {
    source: "Antileon",
    title: "On Dates",
    refs: ["3.1.3"],
    comment:
      "Antileon's chronological work (Περὶ χρόνων), cited by Diogenes Laertius in its second book for Plato's deme, Collytus (3.3).",
  },
  {
    source: "Hermippus",
    title: "On the Sages",
    refs: ["1.1.42"],
    comment:
      "Hermippus' work on the Sages (Περὶ τῶν σοφῶν), cited by Diogenes Laertius for the seventeen candidates for the canon of Seven Sages (1.42).",
  },
  {
    source: "Aristoxenus",
    title: "On Pythagoras and his Associates",
    refs: ["1.11.118"],
    comment:
      "Aristoxenus' monograph on Pythagoras and his circle (Περὶ Πυθαγόρου καὶ τῶν γνωρίμων αὐτοῦ), cited for the natural death of Pherecydes (1.118).",
  },
  {
    source: "Alexander",
    title: "Successions of Philosophers",
    // Coverage audit July 2026: Alexander's citation sentence sits at
    // 8.24 in our section split (8.25 carries only the quoted monad
    // doctrine), so the English title occurs - and is taggable - at
    // 8.1.24 and never at 8.1.25.
    refs: ["1.11.116", "3.1.4", "8.1.24"],
    comment:
      "The Successions (Διαδοχαί) of Alexander Polyhistor, cited for Pherecydes' teacher (1.116), the story of Plato's name (3.4), and Pythagorean doctrine on the monad (8.24).",
  },
  {
    source: "Antisthenes",
    title: "Successions",
    refs: ["6.2.77"],
    comment:
      "The Successions (Διαδοχαί) of Antisthenes of Rhodes, cited for the death of Diogenes of Sinope by voluntary breath-holding (6.77).",
  },
  {
    source: "Plutarch",
    title: "Life of Lysander and Sulla",
    refs: ["4.1.4"],
    comment:
      "Plutarch's paired Life of Lysander and Sulla (Λύσανδρος καὶ Σύλλας), cited for the manner of Speusippus' death from lice (4.4).",
  },
  {
    source: "Demetrius",
    title: "Homonyms",
    refs: ["6.2.79", "9.5.27"],
    comment:
      "The Homonyms (Ὁμώνυμοι) of Demetrius of Magnesia, cited for the burial place of Diogenes of Sinope (6.79) and the manner of Zeno of Elea's death by nose-biting (9.27).",
  },
  {
    source: "Eumelus",
    title: "Histories",
    refs: ["5.1.6"],
    comment:
      "The Histories (Ἱστορίαι) of Eumelus, cited in the fifth book for the death of Aristotle by aconite and his age of seventy (5.6).",
  },
  {
    source: "Ariston",
    title: "On Heraclitus",
    refs: ["9.1.5"],
    comment:
      "Ariston of Ceos' monograph On Heraclitus (Περὶ Ἡρακλείτου), cited for the manner of Heraclitus' death from dropsy (9.5).",
  },
  {
    source: "Demetrius of Troezen",
    title: "Against the Sophists",
    refs: ["8.2.74"],
    comment:
      "Demetrius of Troezen's polemic Against the Sophists (Κατὰ σοφιστῶν), cited for the tradition that Empedocles died by hanging (8.74).",
  },
  {
    source: "Apollodorus",
    title: "Chronology",
    refs: [
      "1.1.37",
      "1.4.74",
      "2.1.2",
      "2.3.7",
      "2.5.44",
      "3.1.2",
      "4.4.23",
      "4.6.28",
      "4.6.45",
      "4.9.65",
      "5.1.9",
      "5.3.58",
      "7.7.184",
      "8.2.52",
      "8.2.58",
      "8.8.90",
      "9.5.25",
      "9.7.41",
      "9.11.61",
      "10.1.13",
      "10.1.14",
    ],
    comment:
      "The Chronology (Χρονικά) of Apollodorus of Athens, the verse chronicle Diogenes Laertius cites throughout for dates of birth, death, and floruit.",
  },
];
