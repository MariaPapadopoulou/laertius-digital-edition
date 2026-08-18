/**
 * Cited teacher-pupil links beyond the KG's philosopher-to-philosopher
 * edges: the succession chains Diogenes Laertius records whose
 * endpoints are not (both) chapter subjects. Today the layer covers:
 * - the Stoa pupil network: Persaeus of Citium (7.36, source node);
 *   the five pupils Hippobotus names at 7.38 - Philonides of Thebes,
 *   Callippus of Corinth, Posidonius of Alexandria, Athenodorus of
 *   Soli, and Zeno of Sidon (all asserted, person nodes, accordingTo
 *   Hippobotus); and the hedged Diocles report that Chrysippus started
 *   under Zeno before Cleanthes (7.179, philosopher endpoint, asserted:
 *   false - reification only, no direct triple).
 * - the Sceptic school - Pyrrho's pupils (9.68-69), Timon's pupils
 *   (9.114-115), and the unbroken chain from Euphranor down to
 *   Saturninus (9.116);
 * - the later Academy handover from Lacydes to Telecles and Evander,
 *   Evander's successor Hegesinus, and Hegesinus' successor Carneades
 *   (4.60).
 *
 * This layer mints NOTHING: every endpoint must already be an existing
 * node - a corpus philosopher (kg.ts node), a person (claim persons or
 * person-mentions.ts), or a cited source authority; lod.ts throws on a
 * label with no node. Serialization mirrors school-members.ts:
 * - every link gets a reified rdf:Statement with the D.L. citation
 *   (dcterms:bibliographicCitation), the note, and lo:accordingTo
 *   for each named authority;
 * - asserted links also get the direct triple
 *   <teacher> lo:teacherOf <pupil>; hedged links (asserted: false)
 *   exist ONLY as the reification - no direct triple.
 *
 * Judgment calls:
 * - The Hippobotus/Sotion pupil list (9.115) is HEDGED: D.L. opposes
 *   it ("however") to Menodotus' report that Timon left no successor.
 *   The dispute itself is recorded in the claims layer
 *   (timon-no-successor vs timon-pupils-hippobotus/timon-pupils-sotion
 *   in claims/book9.ts). Dioscurides alone is ASSERTED: at 9.114 D.L.
 *   calls him "his disciple" in his own voice.
 * - The 9.116 chain is D.L.'s own voice throughout ("Euphranor had as
 *   pupil Eubulus ... Sextus taught Saturninus") - all asserted, even
 *   though it continues past the disputed 9.115 list; the hedging
 *   stays on the Timon-to-pupil links where the dispute lives.
 * - Pyrrho's pupils (9.68-69) are D.L.'s own voice - asserted. Timon
 *   is not here: Pyrrho teacherOf Timon is already a KG edge (9.109).
 * - The Academy links (4.60) are D.L.'s own voice - asserted.
 *   "Handed over the school" / "was succeeded by" is scholarch
 *   succession; lo:teacherOf follows the convention the KG already
 *   uses for the succession chains of the Lives. Hegesinus teacherOf
 *   Carneades is the inverse of the existing claim
 *   carneades-studied-hegesinus (studiedUnder, 4.62); both direct
 *   triples exist in LOD (lo:teacherOf and lo:studentOf are inverse
 *   predicates, no conflict), and the KG separately records Lacydes
 *   influenced Carneades (4.62).
 * - lo:teacherOf/lo:studentOf domain and range are widened to
 *   foaf:Person for this layer (they were lo:ChapterSubject before);
 *   source-node endpoints (Aenesidemus, Antiochus, Menodotus, Sextus
 *   Empiricus, Philo of Athens, Hecataeus of Abdera) are thereby
 *   RDFS-entailed into foaf:Person, the same acceptance already made
 *   for lo:memberOf in school-members.ts.
 */

export type SuccessionNodeKind = "philosopher" | "person" | "source";

export interface SuccessionEndpoint {
  /** rdfs:label of an EXISTING node - never mints. */
  label: string;
  /** Which URI space the node lives in. */
  node: SuccessionNodeKind;
}

export interface SuccessionLink {
  teacher: SuccessionEndpoint;
  pupil: SuccessionEndpoint;
  /** Hicks book.section reference grounding the link. */
  ref: string;
  /** Direct lo:teacherOf triple (true) or reification-only (false). */
  asserted: boolean;
  /** Authorities D.L. names for the link, when he names them. */
  accordingTo?: string[];
  /** rdfs:comment carried by the reified statement. */
  note?: string;
}

const phil = (label: string): SuccessionEndpoint => ({
  label,
  node: "philosopher",
});
const person = (label: string): SuccessionEndpoint => ({
  label,
  node: "person",
});
const source = (label: string): SuccessionEndpoint => ({
  label,
  node: "source",
});

export const SUCCESSION_LINKS: SuccessionLink[] = [
  // Stoa pupil network.
  // Persaeus (7.36): D.L. says Zeno "had many pupils, the most eminent being
  // Persaeus of Citium ... a member of his household". Source node endpoint.
  {
    teacher: phil("Zeno of Citium"),
    pupil: source("Persaeus"),
    ref: "7.36",
    asserted: true,
    note:
      "Persaeus of Citium, son of Demetrius, a member of Zeno's household and one of his most eminent pupils (7.36). Co-author with Zeno of the view that all sins are equal (7.120).",
  },
  // Five pupils of Zeno named by Hippobotus (7.38). D.L. gives the list in
  // his own voice ("he had also as pupils"); accordingTo Hippobotus is the
  // ultimate source of the Register the list derives from. All five are
  // asserted: unlike the disputed Timon pupil list (9.115), no counter-claim
  // exists in the text (the dispute at 7.179 is about Chrysippus' teacher,
  // not this roster). Person-node endpoints (person-mentions.ts).
  {
    teacher: phil("Zeno of Citium"),
    pupil: person("Philonides of Thebes"),
    ref: "7.38",
    asserted: true,
    accordingTo: ["Hippobotus"],
    note:
      "Philonides of Thebes, one of the five pupils Hippobotus names (7.38); very likely the Philonides Zeno sent to Antigonus alongside Persaeus (7.8-9).",
  },
  {
    teacher: phil("Zeno of Citium"),
    pupil: person("Callippus of Corinth"),
    ref: "7.38",
    asserted: true,
    accordingTo: ["Hippobotus"],
    note: "Callippus of Corinth, one of the five pupils Hippobotus names (7.38).",
  },
  {
    teacher: phil("Zeno of Citium"),
    pupil: person("Posidonius of Alexandria"),
    ref: "7.38",
    asserted: true,
    accordingTo: ["Hippobotus"],
    note:
      "Posidonius of Alexandria, one of the five pupils Hippobotus names (7.38). Distinct from Posidonius of Apamea.",
  },
  {
    teacher: phil("Zeno of Citium"),
    pupil: person("Athenodorus of Soli"),
    ref: "7.38",
    asserted: true,
    accordingTo: ["Hippobotus"],
    note:
      "Athenodorus of Soli, one of the five pupils Hippobotus names (7.38). Distinct from the Athenodorus who wrote the Walks.",
  },
  {
    teacher: phil("Zeno of Citium"),
    pupil: person("Zeno of Sidon"),
    ref: "7.38",
    asserted: true,
    accordingTo: ["Hippobotus"],
    note:
      "Zeno of Sidon the Stoic, one of the five pupils Hippobotus names (7.38). Distinct from the later Epicurean Zeno of Sidon.",
  },
  // Hedged: Diocles says Chrysippus started under Zeno of Citium before
  // Cleanthes (7.179). The mainstream account and the KG edge have Cleanthes
  // as his teacher. Reification-only (asserted: false); the claim layer
  // records the conflict as chrysippus-teacher-zeno (reported, accordingTo
  // Diocles, ref 7.179). Both endpoints are philosopher (chapter-subject) nodes;
  // this is the one exception in the succession layer where both endpoints
  // are KG philosophers: the hedge requires reification-only LOD handling
  // that the KG edge model does not provide.
  {
    teacher: phil("Zeno of Citium"),
    pupil: phil("Chrysippus"),
    ref: "7.179",
    asserted: false,
    accordingTo: ["Diocles"],
    note:
      "Diocles says Chrysippus was at first a pupil of Zeno of Citium (7.179), then of Cleanthes. Hedged: the prevailing account and the existing KG edge record Cleanthes as Chrysippus' teacher; both accounts are reported by D.L. without personal endorsement.",
  },
  // Pyrrho's pupils (9.68-69, D.L.'s own voice).
  {
    teacher: phil("Pyrrho"),
    pupil: person("Eurylochus"),
    ref: "9.68",
    asserted: true,
    note:
      "He had pupils of repute, in particular one Eurylochus, who fell short of his professions (9.68).",
  },
  {
    teacher: phil("Pyrrho"),
    pupil: source("Philo of Athens"),
    ref: "9.69",
    asserted: true,
    note:
      "Philo, who had a habit of very often talking to himself, among Pyrrho's pupils (9.69); named a friend of Pyrrho at 9.67.",
  },
  {
    teacher: phil("Pyrrho"),
    pupil: source("Hecataeus of Abdera"),
    ref: "9.69",
    asserted: true,
    note: "Pyrrho's pupils included Hecataeus of Abdera (9.69).",
  },
  {
    teacher: phil("Pyrrho"),
    pupil: person("Nausiphanes"),
    ref: "9.69",
    asserted: true,
    note:
      "Pyrrho's pupils included Nausiphanes of Teos, said by some to have been a teacher of Epicurus (9.69); the Epicurus question is recorded in the claims layer.",
  },
  // Timon's pupils (9.114-115).
  {
    teacher: phil("Timon"),
    pupil: person("Dioscurides of Cyprus"),
    ref: "9.114",
    asserted: true,
    note:
      "Like Timon, his disciple Dioscurides of Cyprus had only one eye (9.114, D.L.'s own voice); also first in the pupil list of Hippobotus and Sotion (9.115).",
  },
  {
    teacher: phil("Timon"),
    pupil: person("Nicolochus of Rhodes"),
    ref: "9.115",
    asserted: false,
    accordingTo: ["Hippobotus", "Sotion"],
    note:
      "Hippobotus and Sotion say that Timon had as pupils Nicolochus of Rhodes among others (9.115). Hedged: Menodotus reports that Timon left no successor.",
  },
  {
    teacher: phil("Timon"),
    pupil: person("Euphranor of Seleucia"),
    ref: "9.115",
    asserted: false,
    accordingTo: ["Hippobotus", "Sotion"],
    note:
      "Hippobotus and Sotion say that Timon had as pupils Euphranor of Seleucia among others (9.115). Hedged: Menodotus reports that Timon left no successor.",
  },
  {
    teacher: phil("Timon"),
    pupil: person("Praÿlus of the Troad"),
    ref: "9.115",
    asserted: false,
    accordingTo: ["Hippobotus", "Sotion"],
    note:
      "Hippobotus and Sotion say that Timon had as pupils Praÿlus of the Troad among others (9.115). Hedged: Menodotus reports that Timon left no successor.",
  },
  // The chain of 9.116 (D.L.'s own voice, all asserted).
  {
    teacher: person("Euphranor of Seleucia"),
    pupil: person("Eubulus of Alexandria"),
    ref: "9.116",
    asserted: true,
    note: "Euphranor had as pupil Eubulus of Alexandria (9.116).",
  },
  {
    teacher: person("Eubulus of Alexandria"),
    pupil: person("Ptolemy of Cyrene"),
    ref: "9.116",
    asserted: true,
    note: "Eubulus taught Ptolemy (9.116).",
  },
  {
    teacher: person("Ptolemy of Cyrene"),
    pupil: person("Sarpedon"),
    ref: "9.116",
    asserted: true,
    note: "Ptolemy taught Sarpedon and Heraclides (9.116).",
  },
  {
    teacher: person("Ptolemy of Cyrene"),
    pupil: person("Heraclides the Sceptic"),
    ref: "9.116",
    asserted: true,
    note: "Ptolemy taught Sarpedon and Heraclides (9.116).",
  },
  {
    teacher: person("Heraclides the Sceptic"),
    pupil: source("Aenesidemus"),
    ref: "9.116",
    asserted: true,
    note:
      "Heraclides taught Aenesidemus of Cnossus, the compiler of eight books of Pyrrhonean Discourses (9.116).",
  },
  {
    teacher: source("Aenesidemus"),
    pupil: person("Zeuxippus"),
    ref: "9.116",
    asserted: true,
    note:
      "Aenesidemus was the instructor of Zeuxippus, his fellow-citizen (9.116).",
  },
  {
    teacher: person("Zeuxippus"),
    pupil: person("Zeuxis Goniopus"),
    ref: "9.116",
    asserted: true,
    note: "Zeuxippus taught Zeuxis of the angular foot (9.116).",
  },
  {
    teacher: person("Zeuxis Goniopus"),
    pupil: source("Antiochus of Laodicea"),
    ref: "9.116",
    asserted: true,
    note: "Zeuxis taught Antiochus of Laodicea on the Lycus (9.116).",
  },
  {
    teacher: source("Antiochus of Laodicea"),
    pupil: source("Menodotus of Nicomedia"),
    ref: "9.116",
    asserted: true,
    note:
      "Antiochus had as pupils Menodotus of Nicomedia, an empiric physician, and Theiodas of Laodicea (9.116).",
  },
  {
    teacher: source("Antiochus of Laodicea"),
    pupil: person("Theiodas of Laodicea"),
    ref: "9.116",
    asserted: true,
    note:
      "Antiochus had as pupils Menodotus of Nicomedia, an empiric physician, and Theiodas of Laodicea (9.116).",
  },
  {
    teacher: source("Menodotus of Nicomedia"),
    pupil: person("Herodotus of Tarsus"),
    ref: "9.116",
    asserted: true,
    note:
      "Menodotus was the instructor of Herodotus of Tarsus, son of Arieus (9.116).",
  },
  {
    teacher: person("Herodotus of Tarsus"),
    pupil: source("Sextus Empiricus"),
    ref: "9.116",
    asserted: true,
    note:
      "Herodotus taught Sextus Empiricus, who wrote ten books on Scepticism and other fine works (9.116).",
  },
  {
    teacher: source("Sextus Empiricus"),
    pupil: person("Saturninus"),
    ref: "9.116",
    asserted: true,
    note:
      "Sextus taught Saturninus called Cythenas, another empiricist (9.116).",
  },
  // The later Academy (4.60, D.L.'s own voice).
  {
    teacher: phil("Lacydes"),
    pupil: person("Telecles"),
    ref: "4.60",
    asserted: true,
    note:
      "Lacydes did what none of his predecessors had ever done: in his lifetime he handed over the school to Telecles and Evander, both of Phocaea (4.60).",
  },
  {
    teacher: phil("Lacydes"),
    pupil: person("Evander"),
    ref: "4.60",
    asserted: true,
    note:
      "Lacydes did what none of his predecessors had ever done: in his lifetime he handed over the school to Telecles and Evander, both of Phocaea (4.60).",
  },
  {
    teacher: person("Evander"),
    pupil: person("Hegesinus of Pergamum"),
    ref: "4.60",
    asserted: true,
    note: "Evander was succeeded by Hegesinus of Pergamum (4.60).",
  },
  {
    teacher: person("Hegesinus of Pergamum"),
    pupil: phil("Carneades"),
    ref: "4.60",
    asserted: true,
    note:
      "Hegesinus was succeeded by Carneades (4.60); the inverse is recorded as the claim carneades-studied-hegesinus (4.62).",
  },
];
