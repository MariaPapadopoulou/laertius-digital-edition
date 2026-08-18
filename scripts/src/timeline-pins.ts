/**
 * Single source of truth for the pinned Timeline snapshot. Both
 * validate-timeline.ts (exact per-philosopher pin) and
 * smoke-ionos-bundle.ts (count check inside the built bundle) consume
 * this module, so adding a philosopher to the timeline only ever means
 * updating one list.
 *
 * Row shape: [name, birthYear, deathYear, floruitYear, approxBirth,
 * approxDeath] in timeline order (negative = BCE).
 */
export type TimelinePinRow = [
  string,
  number | null,
  number | null,
  number | null,
  boolean,
  boolean,
];

export const TIMELINE_PINS: TimelinePinRow[] = [
  ["Periander", -665, -585, -628, true, false],
  ["Thales", -640, -548, null, false, false],
  ["Pittacus", -640, -570, -612, true, false],
  ["Solon", null, null, -596, false, false],
  ["Epimenides", null, null, -596, false, false],
  ["Anacharsis", null, null, -592, false, false],
  ["Chilon", null, null, -572, false, false],
  ["Anaximander", -611, -547, null, true, true],
  ["Anaximenes", null, -528, null, false, false],
  ["Pherecydes", null, null, -544, false, false],
  ["Pythagoras", null, null, -540, false, false],
  ["Xenophanes", null, null, -540, false, false],
  ["Heraclitus", null, null, -504, false, false],
  ["Parmenides", null, null, -504, false, false],
  ["Zeno of Elea", null, null, -464, false, false],
  ["Anaxagoras", -500, -428, null, false, false],
  ["Empedocles", null, null, -444, false, false],
  ["Melissus", null, null, -444, false, false],
  ["Protagoras", null, null, -444, false, false],
  ["Socrates", -469, -399, null, false, false],
  ["Democritus", -460, -351, null, false, true],
  ["Xenophon", null, -360, -401, false, false],
  ["Plato", -428, -348, null, false, false],
  ["Eudoxus", null, null, -368, false, false],
  ["Speusippus", null, null, -348, false, false],
  ["Aristotle", -384, -322, null, false, false],
  ["Anaxarchus", null, null, -340, false, false],
  ["Xenocrates", null, null, -339, false, false],
  ["Theophrastus", -373, -288, null, true, false],
  ["Diogenes of Sinope", null, null, -328, false, false],
  ["Crates of Thebes", null, null, -328, false, false],
  ["Polemo", null, null, -316, false, false],
  ["Epicurus", -341, -270, null, false, false],
  ["Arcesilaus", null, null, -300, false, false],
  ["Metrodorus", -330, -277, null, true, true],
  ["Strato", null, null, -288, false, false],
  ["Lyco", null, null, -272, false, false],
  ["Zeno of Citium", null, null, -260, false, false],
  ["Lacydes", null, null, -241, false, false],
  ["Chrysippus", -281, -208, null, true, false],
  ["Carneades", -214, -129, null, true, false],
];

export const TIMELINE_PIN_COUNT = TIMELINE_PINS.length;
