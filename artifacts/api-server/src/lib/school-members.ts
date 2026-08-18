/**
 * Cited school memberships beyond the 82 chapter subjects: the eminent
 * disciples Diogenes Laertius himself names as members of a school.
 * The layer covers:
 * - the Stoa: Persaeus of Citium (source node, 7.36) and the five
 *   pupils Hippobotus names at 7.38 - Philonides of Thebes, Callippus
 *   of Corinth, Posidonius of Alexandria, Athenodorus of Soli, and
 *   Zeno of Sidon (all asserted, person nodes). The hedged
 *   Zeno-to-Chrysippus succession link (7.179) is in succession-links.ts
 *   rather than here because it links two philosopher KG nodes, not
 *   non-chapter-subject persons/sources.
 * - Epicurus' Garden - the roster D.L. gives at 10.22-26 (Metrodorus,
 *   Polyaenus, Hermarchus, Leonteus, Themista, Colotes, Idomeneus)
 *   plus Timocrates, the renegade brother of Metrodorus (10.6);
 * - the Sceptic school (Pyrrho's pupils 9.68-69, the succession from
 *   Timon down to Saturninus 9.114-116, the authorities of the
 *   criterion passage 9.106, and Theodosius of the Sceptic Chapters
 *   9.70);
 * - the later Academy scholarchs outside the chapter subjects
 *   (Telecles, Evander, Hegesinus, 4.60).
 * The teacher chains themselves live in succession-links.ts.
 *
 * This layer mints NOTHING: every label must already be an existing
 * person or source node (claim persons, mention persons from
 * person-mentions.ts, or ce.sources authorities); lod.ts throws on a
 * label with no node. Serialization mirrors the claims model:
 * - asserted entries get the direct triple
 *   <node> lo:memberOf <school/...> plus a reified rdf:Statement with
 *   the D.L. citation;
 * - hedged entries (asserted: false) exist ONLY as the reified
 *   rdf:Statement - no direct triple.
 *
 * Judgment calls:
 * - Timocrates is HEDGED. D.L. 10.6 plainly calls him Epicurus'
 *   disciple who then left the school and attacked it in his
 *   Merriment, but the bare "Timocrates" source node also carries the
 *   citation of the Dion at 7.2, almost certainly a different bearer;
 *   a direct triple on the conflated node would assert the Dion author
 *   into the Garden, contradicting the standing person-ontology
 *   judgment call that keeps the node's role []. The reification
 *   records the membership with its citation without typing the node.
 * - Epicurus himself is NOT here: as the Book 10 chapter subject he
 *   already carries lo:memberOf via the movement of his KG node.
 * - Hermarchus attaches to the person/hermarchus node (the
 *   source/person double's taggable half), Idomeneus of Lampsacus and
 *   Timocrates to their lo:Source nodes - both survive
 *   graphAsTurtle({ sourcesIndex: false }), so no gating is needed.
 * - The ontology domain of lo:memberOf is foaf:Person (widened from
 *   lo:ChapterSubject for this layer). lo:teacherOf/lo:studentOf were
 *   likewise widened to foaf:Person when succession-links.ts arrived
 *   (July 2026); before that they kept the narrow lo:ChapterSubject
 *   domain deliberately. The influence properties (lo:influenced)
 *   still keep the narrow domain: only KG edges use them.
 * - Sceptic roster judgment calls: Theodosius is HEDGED - D.L. cites
 *   his Sceptic Chapters arguing about the school's name (9.70), so
 *   his adherence is inferred from the work, and he himself denied
 *   the Pyrrhonean label. Nicolochus and Praylus are HEDGED - they
 *   hang on the disputed Hippobotus/Sotion pupil list (9.115), which
 *   Menodotus' no-successor report conflicts with (see claims
 *   timon-no-successor/timon-pupils-*); Dioscurides is asserted via
 *   D.L.'s own "his disciple" at 9.114, and Euphranor via D.L.'s own
 *   chain at 9.116. Nausiphanes is asserted on 9.69 ("All these were
 *   called Pyrrhoneans") even though the tradition counts him a
 *   Democritean - the note carries the tension. The cited source
 *   Zeuxis (9.106, Aenesidemus' friend) is deliberately NOT here:
 *   he may be the succession's Zeuxis Goniopus (9.116), and listing
 *   both would double-count one probable man; the succession node
 *   carries the membership.
 */

import type { MovementId } from "./kg";

export interface SchoolMember {
  /** rdfs:label of an EXISTING person or source node - never mints. */
  label: string;
  /** Which URI space the node lives in. */
  node: "person" | "source";
  /** School (movement id) the member belonged to. */
  school: MovementId;
  /** Hicks book.section reference grounding the membership. */
  ref: string;
  /** Direct lo:memberOf triple (true) or reification-only (false). */
  asserted: boolean;
  /** rdfs:comment carried by the reified statement. */
  note?: string;
}

export const SCHOOL_MEMBERS: SchoolMember[] = [
  // Stoa members (7.36, 7.38).
  {
    label: "Persaeus",
    node: "source",
    school: "stoa",
    ref: "7.36",
    asserted: true,
    note:
      "Persaeus of Citium, son of Demetrius, a member of Zeno's household and his most eminent pupil (7.36); later sent to Antigonus Gonatas alongside Philonides (7.8-9).",
  },
  {
    label: "Philonides of Thebes",
    node: "person",
    school: "stoa",
    ref: "7.38",
    asserted: true,
    note:
      "Philonides of Thebes, one of the five pupils Hippobotus names as belonging to Zeno's circle (7.38).",
  },
  {
    label: "Callippus of Corinth",
    node: "person",
    school: "stoa",
    ref: "7.38",
    asserted: true,
    note:
      "Callippus of Corinth, one of the five pupils Hippobotus names as belonging to Zeno's circle (7.38).",
  },
  {
    label: "Posidonius of Alexandria",
    node: "person",
    school: "stoa",
    ref: "7.38",
    asserted: true,
    note:
      "Posidonius of Alexandria, one of the five pupils Hippobotus names as belonging to Zeno's circle (7.38). Distinct from Posidonius of Apamea.",
  },
  {
    label: "Athenodorus of Soli",
    node: "person",
    school: "stoa",
    ref: "7.38",
    asserted: true,
    note:
      "Athenodorus of Soli, one of the five pupils Hippobotus names as belonging to Zeno's circle (7.38).",
  },
  {
    label: "Zeno of Sidon",
    node: "person",
    school: "stoa",
    ref: "7.38",
    asserted: true,
    note:
      "Zeno of Sidon the Stoic, one of the five pupils Hippobotus names as belonging to Zeno's circle (7.38). Distinct from the later Epicurean Zeno of Sidon.",
  },
  {
    label: "Metrodorus",
    node: "person",
    school: "epicurean",
    ref: "10.22",
    asserted: true,
    note:
      "Metrodorus of Lampsacus, son of Athenaeus (or of Timocrates) and of Sande; first of the eminent disciples, who from his first acquaintance with Epicurus never left him.",
  },
  {
    label: "Polyaenus",
    node: "person",
    school: "epicurean",
    ref: "10.24",
    asserted: true,
    note:
      "Polyaenus, son of Athenodorus, a citizen of Lampsacus, a just and kindly man, as Philodemus and his pupils affirm.",
  },
  {
    label: "Hermarchus",
    node: "person",
    school: "epicurean",
    ref: "10.24",
    asserted: true,
    note:
      "Hermarchus, son of Agemortus, of Mytilene; Epicurus' successor as head of the school (10.17).",
  },
  {
    label: "Leonteus",
    node: "person",
    school: "epicurean",
    ref: "10.25",
    asserted: true,
    note: "Leonteus of Lampsacus, husband of Themista.",
  },
  {
    label: "Themista",
    node: "person",
    school: "epicurean",
    ref: "10.25",
    asserted: true,
    note:
      "Themista, wife of Leonteus of Lampsacus, to whom Epicurus wrote letters (10.5).",
  },
  {
    label: "Colotes of Lampsacus",
    node: "person",
    school: "epicurean",
    ref: "10.25",
    asserted: true,
    note:
      "Colotes, with Idomeneus among the distinguished disciples, also a native of Lampsacus.",
  },
  {
    label: "Idomeneus of Lampsacus",
    node: "source",
    school: "epicurean",
    ref: "10.25",
    asserted: true,
    note:
      "Idomeneus of Lampsacus, recipient of Epicurus' dying letter (10.22); married Metrodorus' sister Batis (10.23).",
  },
  {
    label: "Timocrates",
    node: "source",
    school: "epicurean",
    ref: "10.6",
    asserted: false,
    note:
      "Timocrates, brother of Metrodorus, was Epicurus' disciple and then left the school, attacking it in his Merriment (10.6). Hedged: the bare Timocrates source node also carries the citation of the Dion at 7.2, almost certainly a different bearer, so the direct triple is withheld.",
  },
  {
    label: "Eurylochus",
    node: "person",
    school: "sceptic",
    ref: "9.68",
    asserted: true,
    note:
      "Eurylochus, one of Pyrrho's pupils of repute, who fell short of his professions (9.68); called Pyrrhonean after the name of the master (9.69-70).",
  },
  {
    label: "Philo of Athens",
    node: "source",
    school: "sceptic",
    ref: "9.69",
    asserted: true,
    note:
      "Philo of Athens, a friend of Pyrrho (9.67) and among his pupils; he had a habit of very often talking to himself, as Timon's lines record (9.69).",
  },
  {
    label: "Hecataeus of Abdera",
    node: "source",
    school: "sceptic",
    ref: "9.69",
    asserted: true,
    note: "Hecataeus of Abdera, among Pyrrho's pupils (9.69).",
  },
  {
    label: "Nausiphanes",
    node: "person",
    school: "sceptic",
    ref: "9.69",
    asserted: true,
    note:
      "Nausiphanes of Teos, among Pyrrho's pupils, said by some to have been a teacher of Epicurus (9.69); 'all these were called Pyrrhoneans after the name of their master'. The tradition otherwise counts him a Democritean; this membership records D.L.'s own roster.",
  },
  {
    label: "Theodosius",
    node: "source",
    school: "sceptic",
    ref: "9.70",
    asserted: false,
    note:
      "Theodosius, author of Sceptic Chapters, who denies that Scepticism should be called Pyrrhonism since we can never know what Pyrrho really intended (9.70). Hedged: his adherence is inferred from the work D.L. cites, and he himself rejected the Pyrrhonean label.",
  },
  {
    label: "Dioscurides of Cyprus",
    node: "person",
    school: "sceptic",
    ref: "9.114",
    asserted: true,
    note:
      "Dioscurides of Cyprus, Timon's disciple in D.L.'s own voice (9.114); also first in the pupil list of Hippobotus and Sotion (9.115).",
  },
  {
    label: "Nicolochus of Rhodes",
    node: "person",
    school: "sceptic",
    ref: "9.115",
    asserted: false,
    note:
      "Nicolochus of Rhodes, a pupil of Timon according to Hippobotus and Sotion (9.115). Hedged: the pupil list conflicts with Menodotus' report that Timon left no successor.",
  },
  {
    label: "Euphranor of Seleucia",
    node: "person",
    school: "sceptic",
    ref: "9.116",
    asserted: true,
    note:
      "Euphranor of Seleucia, a pupil of Timon according to Hippobotus and Sotion (9.115); asserted through D.L.'s own continuation of the succession, where Euphranor had as pupil Eubulus of Alexandria (9.116).",
  },
  {
    label: "Praÿlus of the Troad",
    node: "person",
    school: "sceptic",
    ref: "9.115",
    asserted: false,
    note:
      "Praÿlus of the Troad, a pupil of Timon according to Hippobotus and Sotion (9.115). Hedged: the pupil list conflicts with Menodotus' report that Timon left no successor.",
  },
  {
    label: "Eubulus of Alexandria",
    node: "person",
    school: "sceptic",
    ref: "9.116",
    asserted: true,
    note: "Eubulus of Alexandria, pupil of Euphranor, teacher of Ptolemy (9.116).",
  },
  {
    label: "Ptolemy of Cyrene",
    node: "person",
    school: "sceptic",
    ref: "9.115",
    asserted: true,
    note:
      "Ptolemy of Cyrene, who re-established the school after it had lapsed, according to Menodotus (9.115); pupil of Eubulus in the chain at 9.116.",
  },
  {
    label: "Sarpedon",
    node: "person",
    school: "sceptic",
    ref: "9.116",
    asserted: true,
    note: "Sarpedon, pupil of Ptolemy of Cyrene alongside Heraclides (9.116).",
  },
  {
    label: "Heraclides the Sceptic",
    node: "person",
    school: "sceptic",
    ref: "9.116",
    asserted: true,
    note:
      "Heraclides, pupil of Ptolemy of Cyrene and teacher of Aenesidemus (9.116).",
  },
  {
    label: "Aenesidemus",
    node: "source",
    school: "sceptic",
    ref: "9.116",
    asserted: true,
    note:
      "Aenesidemus of Cnossus, compiler of eight books of Pyrrhonean Discourses, pupil of Heraclides and instructor of his fellow-citizen Zeuxippus (9.116).",
  },
  {
    label: "Zeuxippus",
    node: "person",
    school: "sceptic",
    ref: "9.116",
    asserted: true,
    note:
      "Zeuxippus, Aenesidemus' fellow-citizen and pupil, teacher of Zeuxis of the angular foot (9.116).",
  },
  {
    label: "Zeuxis Goniopus",
    node: "person",
    school: "sceptic",
    ref: "9.116",
    asserted: true,
    note:
      "Zeuxis of the angular foot, pupil of Zeuxippus and teacher of Antiochus of Laodicea on the Lycus (9.116).",
  },
  {
    label: "Antiochus of Laodicea",
    node: "source",
    school: "sceptic",
    ref: "9.116",
    asserted: true,
    note:
      "Antiochus of Laodicea on the Lycus, pupil of Zeuxis, teacher of Menodotus of Nicomedia and Theiodas of Laodicea (9.116); he holds to phenomena alone as the Sceptic's criterion (9.106).",
  },
  {
    label: "Menodotus of Nicomedia",
    node: "source",
    school: "sceptic",
    ref: "9.116",
    asserted: true,
    note:
      "Menodotus of Nicomedia, an empiric physician, pupil of Antiochus of Laodicea and instructor of Herodotus of Tarsus (9.116).",
  },
  {
    label: "Theiodas of Laodicea",
    node: "person",
    school: "sceptic",
    ref: "9.116",
    asserted: true,
    note:
      "Theiodas of Laodicea, pupil of Antiochus of Laodicea alongside Menodotus (9.116).",
  },
  {
    label: "Herodotus of Tarsus",
    node: "person",
    school: "sceptic",
    ref: "9.116",
    asserted: true,
    note:
      "Herodotus of Tarsus, son of Arieus, pupil of Menodotus and teacher of Sextus Empiricus (9.116).",
  },
  {
    label: "Sextus Empiricus",
    node: "source",
    school: "sceptic",
    ref: "9.116",
    asserted: true,
    note:
      "Sextus Empiricus, pupil of Herodotus, who wrote ten books on Scepticism and other fine works, and taught Saturninus (9.116).",
  },
  {
    label: "Saturninus",
    node: "person",
    school: "sceptic",
    ref: "9.116",
    asserted: true,
    note:
      "Saturninus called Cythenas, another empiricist, pupil of Sextus Empiricus (9.116).",
  },
  {
    label: "Apellas",
    node: "person",
    school: "sceptic",
    ref: "9.106",
    asserted: true,
    note:
      "Apellas, who in his Agrippa holds, with Zeuxis and Antiochus of Laodicea, to phenomena alone as the Sceptic's criterion (9.106).",
  },
  {
    label: "Telecles",
    node: "person",
    school: "academy",
    ref: "4.60",
    asserted: true,
    note:
      "Telecles of Phocaea; Lacydes, doing what none of his predecessors had done, in his lifetime handed over the school to Telecles and Evander (4.60).",
  },
  {
    label: "Evander",
    node: "person",
    school: "academy",
    ref: "4.60",
    asserted: true,
    note:
      "Evander of Phocaea; Lacydes in his lifetime handed over the school to Telecles and Evander, and Evander was succeeded by Hegesinus of Pergamum (4.60).",
  },
  {
    label: "Hegesinus of Pergamum",
    node: "person",
    school: "academy",
    ref: "4.60",
    asserted: true,
    note:
      "Hegesinus of Pergamum, successor of Evander and predecessor of Carneades in the Academy (4.60).",
  },
];
