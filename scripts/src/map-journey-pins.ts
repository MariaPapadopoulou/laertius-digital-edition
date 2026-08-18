/**
 * Pinned snapshot of every Map life journey's drawn shape, checked by
 * validate-map-journeys against the itinerary builder (map.ts) plus the
 * frontend's drawing rules (map.tsx): consecutive same-place claims
 * collapse into one numbered stop, a stop is hedged when none of its
 * claims are asserted, rival same-kind birth/death legs are suppressed,
 * and a leg is dashed when either end is hedged.
 *
 * A deliberate claims edit (new stop, changed certainty, new journey)
 * requires updating these pins; the validator then names exactly which
 * philosopher and stop drifted. e2e-map-journey keeps its browser role
 * of confirming the frontend really renders Plato's pinned shape.
 */

/** [property, place, hedged] - one merged, numbered journey stop. */
export type PinnedStop = [string, string, boolean];

export interface PinnedJourney {
  stops: PinnedStop[];
  /** Legs rendered dashed, as "A->B" strings. */
  dashedLegs: string[];
  /** Rival-account legs deliberately not drawn, as "A->B" strings. */
  suppressedLegs: string[];
}

export const PINNED_JOURNEYS: Record<string, PinnedJourney> = {
  Plato: {
    stops: [
      ["birthPlace", "Athens", true],
      ["birthPlace", "Aegina", true],
      ["traveledTo", "Cyrene", false],
      ["traveledTo", "Italy", false],
      ["traveledTo", "Egypt", false],
      ["livedIn", "Academy", false],
      ["traveledTo", "Megara", false],
      ["traveledTo", "Sicily", false],
    ],
    dashedLegs: ["Aegina->Cyrene"],
    suppressedLegs: ["Athens->Aegina"],
  },
  Solon: {
    stops: [
      ["birthPlace", "Salamis", false],
      ["traveledTo", "Egypt", false],
      ["traveledTo", "Cyprus", false],
      ["livedIn", "Cilicia", false],
      ["deathPlace", "Cyprus", false],
    ],
    dashedLegs: [],
    suppressedLegs: [],
  },
  Epicurus: {
    stops: [
      ["birthPlace", "Athens", false],
      ["livedIn", "Samos", true],
      ["livedIn", "Colophon", false],
      ["deathPlace", "Athens", false],
    ],
    dashedLegs: ["Athens->Samos", "Samos->Colophon"],
    suppressedLegs: [],
  },
  Eudoxus: {
    stops: [
      ["birthPlace", "Cnidos", false],
      ["traveledTo", "Egypt", false],
      ["traveledTo", "Cyzicus", false],
    ],
    dashedLegs: [],
    suppressedLegs: [],
  },
  Pythagoras: {
    stops: [
      ["birthPlace", "Samos", true],
      ["traveledTo", "Egypt", false],
      ["livedIn", "Croton", false],
    ],
    dashedLegs: ["Samos->Egypt"],
    suppressedLegs: [],
  },
  Xenophon: {
    stops: [
      ["birthPlace", "Athens", false],
      ["livedIn", "Scillus", false],
      ["deathPlace", "Corinth", true],
    ],
    dashedLegs: ["Scillus->Corinth"],
    suppressedLegs: [],
  },
  "Zeno of Citium": {
    stops: [
      ["birthPlace", "Citium", false],
      ["livedIn", "Athens", false],
    ],
    dashedLegs: [],
    suppressedLegs: [],
  },
  Anacharsis: {
    stops: [
      ["birthPlace", "Scythia", false],
      ["traveledTo", "Athens", true],
    ],
    dashedLegs: ["Scythia->Athens"],
    suppressedLegs: [],
  },
  Anaxagoras: {
    stops: [
      ["birthPlace", "Clazomenae", false],
      ["deathPlace", "Lampsacus", false],
    ],
    dashedLegs: [],
    suppressedLegs: [],
  },
  Archelaus: {
    stops: [
      ["birthPlace", "Athens", true],
      ["birthPlace", "Miletus", true],
    ],
    dashedLegs: [],
    suppressedLegs: ["Athens->Miletus"],
  },
  Aristotle: {
    stops: [
      ["birthPlace", "Stagira", false],
      ["deathPlace", "Chalcis", false],
    ],
    dashedLegs: [],
    suppressedLegs: [],
  },
  Bion: {
    stops: [
      ["birthPlace", "Borysthenes", false],
      ["deathPlace", "Chalcis", false],
    ],
    dashedLegs: [],
    suppressedLegs: [],
  },
  Chilon: {
    stops: [
      ["birthPlace", "Lacedaemon", false],
      ["deathPlace", "Pisa", true],
    ],
    dashedLegs: ["Lacedaemon->Pisa"],
    suppressedLegs: [],
  },
  Chrysippus: {
    stops: [
      ["birthPlace", "Soli", true],
      ["birthPlace", "Tarsus", true],
    ],
    dashedLegs: [],
    suppressedLegs: ["Soli->Tarsus"],
  },
  Clitomachus: {
    stops: [
      ["birthPlace", "Carthage", false],
      ["traveledTo", "Athens", false],
    ],
    dashedLegs: [],
    suppressedLegs: [],
  },
  Crantor: {
    stops: [
      ["birthPlace", "Soli", false],
      ["traveledTo", "Athens", false],
    ],
    dashedLegs: [],
    suppressedLegs: [],
  },
  "Demetrius of Phalerum": {
    stops: [
      ["birthPlace", "Phalerum", false],
      ["traveledTo", "Alexandria", true],
    ],
    dashedLegs: ["Phalerum->Alexandria"],
    suppressedLegs: [],
  },
  "Diogenes of Sinope": {
    stops: [
      ["birthPlace", "Sinope", false],
      ["deathPlace", "Corinth", true],
    ],
    dashedLegs: ["Sinope->Corinth"],
    suppressedLegs: [],
  },
  Empedocles: {
    stops: [
      ["birthPlace", "Agrigentum (Acragas)", false],
      ["deathPlace", "Peloponnesus", true],
    ],
    dashedLegs: ["Agrigentum (Acragas)->Peloponnesus"],
    suppressedLegs: [],
  },
  Epimenides: {
    stops: [
      ["birthPlace", "Cnossos in Crete", false],
      ["traveledTo", "Athens", false],
    ],
    dashedLegs: [],
    suppressedLegs: [],
  },
  Euclides: {
    stops: [
      ["birthPlace", "Megara", false],
      ["birthPlace", "Gela", true],
    ],
    dashedLegs: [],
    suppressedLegs: ["Megara->Gela"],
  },
  Onesicritus: {
    stops: [
      ["birthPlace", "Aegina", true],
      ["birthPlace", "Astypalaea", true],
    ],
    dashedLegs: [],
    suppressedLegs: ["Aegina->Astypalaea"],
  },
  Protagoras: {
    stops: [
      ["birthPlace", "Abdera", true],
      ["birthPlace", "Teos", true],
    ],
    dashedLegs: [],
    suppressedLegs: ["Abdera->Teos"],
  },
  Sphaerus: {
    stops: [
      ["birthPlace", "Bosporus", false],
      ["traveledTo", "Alexandria", false],
    ],
    dashedLegs: [],
    suppressedLegs: [],
  },
  Timon: {
    stops: [
      ["birthPlace", "Phlius", false],
      ["livedIn", "Athens", false],
    ],
    dashedLegs: [],
    suppressedLegs: [],
  },
  Xenophanes: {
    stops: [
      ["birthPlace", "Colophon", false],
      ["livedIn", "Elea", true],
    ],
    dashedLegs: ["Colophon->Elea"],
    suppressedLegs: [],
  },
};

export const PINNED_JOURNEY_COUNT = 26;

// The human-reviewed coordinate pins formerly here (PINNED_STOP_COORDS,
// journey stop places only) moved to map-place-pins.ts as
// PINNED_PLACE_COORDS, which covers EVERY served map place, not only the
// journey stops, so a moved pin for a plain marker place is caught too.
