/**
 * Pinned snapshot of the Graph page's satellite associates, shared
 * between validate-graph-associates (checks the source-level builder)
 * and smoke-ionos-bundle (checks the booted bundle's served /api/graph
 * associates against the SAME pins, so a stale bundle built before a
 * roster or succession edit fails the build). A deliberate roster or
 * succession change requires updating these pins in exactly one place.
 */

export const PINNED_COUNTS: Record<string, number> = {
  stoa: 6,
  epicurean: 8,
  sceptic: 23,
  academy: 3,
};
export const PINNED_TOTAL = 40;

export const PINNED_ANCHORS: Record<string, string> = {
  stoa: "Zeno of Citium",
  epicurean: "Epicurus",
  sceptic: "Pyrrho",
  academy: "Plato",
};

export const PINNED_HEDGED = [
  "Nicolochus of Rhodes",
  "Praÿlus of the Troad",
  "Theodosius",
  "Timocrates",
];

// [pupil, teacher, asserted]
export type Leg = [string, string, boolean];
export const PINNED_LEGS: Leg[] = [
  ["Persaeus", "Zeno of Citium", true],
  ["Philonides of Thebes", "Zeno of Citium", true],
  ["Callippus of Corinth", "Zeno of Citium", true],
  ["Posidonius of Alexandria", "Zeno of Citium", true],
  ["Athenodorus of Soli", "Zeno of Citium", true],
  ["Zeno of Sidon", "Zeno of Citium", true],
  ["Eurylochus", "Pyrrho", true],
  ["Philo of Athens", "Pyrrho", true],
  ["Hecataeus of Abdera", "Pyrrho", true],
  ["Nausiphanes", "Pyrrho", true],
  ["Dioscurides of Cyprus", "Timon", true],
  ["Nicolochus of Rhodes", "Timon", false],
  ["Euphranor of Seleucia", "Timon", false],
  ["Praÿlus of the Troad", "Timon", false],
  ["Eubulus of Alexandria", "Euphranor of Seleucia", true],
  ["Ptolemy of Cyrene", "Eubulus of Alexandria", true],
  ["Sarpedon", "Ptolemy of Cyrene", true],
  ["Heraclides the Sceptic", "Ptolemy of Cyrene", true],
  ["Aenesidemus", "Heraclides the Sceptic", true],
  ["Zeuxippus", "Aenesidemus", true],
  ["Zeuxis Goniopus", "Zeuxippus", true],
  ["Antiochus of Laodicea", "Zeuxis Goniopus", true],
  ["Menodotus of Nicomedia", "Antiochus of Laodicea", true],
  ["Theiodas of Laodicea", "Antiochus of Laodicea", true],
  ["Herodotus of Tarsus", "Menodotus of Nicomedia", true],
  ["Sextus Empiricus", "Herodotus of Tarsus", true],
  ["Saturninus", "Sextus Empiricus", true],
  ["Telecles", "Lacydes", true],
  ["Evander", "Lacydes", true],
  ["Hegesinus of Pergamum", "Evander", true],
];
