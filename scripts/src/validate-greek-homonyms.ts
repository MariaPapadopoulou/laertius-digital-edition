/**
 * Validates the shared-Greek-name pairs (lod.ts, greekHomonymsForLabels).
 * The entity index shows a "shares the Greek name" note for the
 * person-like entries (philosophers, mention persons, source authorities)
 * whose curated Greek nominative slugs collide; the Graph side panel shows
 * the philosopher subset. The pair set is derived at runtime from the
 * curated Greek name forms (greek-names.ts), so a future edit there (a
 * typo collapsing two different names into one slug, or a drifted form
 * splitting a real pair) would silently change what readers see. This
 * validator pins:
 *
 * 1. The exact homonym snapshot as computed over the tagged philosopher,
 *    person and source entries: [label, shared Greek form, other bearers]
 *    (40 bearers over 16 shared forms), order-free. The curated
 *    same-individual label pairs (Demetrius of Magnesia / the Magnesian,
 *    Dionysius the Renegade / the Stoic) never list each other: they are
 *    two English renderings of one man, so an owl:differentFrom axiom or
 *    an index note between them would be false.
 * 2. The set of shared Greek forms and that pairing is symmetric: every
 *    "other" bearer lists the entry back under the same form.
 * 3. That every listed bearer resolves to a tagged philosopher, person or
 *    source entry, so the index note always carries its cross-link.
 * 4. The uncertified namesake notes (grcHomonymUncertified) that
 *    linkGreekHomonyms attaches to bearers of FULLY-WITHHELD shared
 *    forms (no philosopher or certified bearer in the group): the exact
 *    bearer set is pinned, every such bearer keeps grc (the withheld
 *    guard surfaces all bearers of these forms), certified/philosopher
 *    notes never carry the flag, and no uncertified note's form is also
 *    borne by a philosopher or certified bearer.
 *
 * A deliberate change to the pairs requires updating the pin here.
 *
 * Run from the workspace root:
 *   pnpm --filter @workspace/scripts run validate-greek-homonyms
 */
import path from "node:path";

process.env["LAERTIUS_DATA_DIR"] ??= path.resolve(
  import.meta.dirname,
  "../../artifacts/api-server/data",
);

const { getIndexEntries } = await import(
  "../../artifacts/api-server/src/lib/annotate"
);
const { greekHomonymsForLabels, GREEK_HOMONYM_CERTIFIED_BEARERS } =
  await import("../../artifacts/api-server/src/lib/lod");

const errors: string[] = [];

// ---------------------------------------------------------------------
// Pinned snapshot: [label, shared Greek form, other bearers (sorted)].
// ---------------------------------------------------------------------
type Row = [string, string, string[]];

const PINNED: Row[] = [
  // 2026-07 kings and tyrants batch: bare-source Alexander (Polyhistor)
  // now shares Ἀλέξανδρος with the Alexander the Great mention node,
  // and the two tyrants of Syracuse share Διονύσιος with the Renegade
  // and the Stoic (the Renegade/Stoic pair itself stays excluded as
  // the same individual).
  ["Alexander", "Ἀλέξανδρος", ["Alexander the Great"]],
  ["Alexander the Great", "Ἀλέξανδρος", ["Alexander"]],
  ["Aristophanes", "Ἀριστοφάνης", ["Aristophanes the Grammarian"]],
  ["Aristophanes the Grammarian", "Ἀριστοφάνης", ["Aristophanes"]],
  ["Athenodorus", "Ἀθηνόδωρος", ["Athenodorus of Soli"]],
  ["Athenodorus of Soli", "Ἀθηνόδωρος", ["Athenodorus"]],
  ["Crates of Athens", "Κράτης", ["Crates of Thebes"]],
  ["Crates of Thebes", "Κράτης", ["Crates of Athens"]],
  [
    "Demetrius of Magnesia",
    "Δημήτριος",
    ["Demetrius of Phalerum", "Demetrius of Troezen"],
  ],
  [
    "Demetrius of Phalerum",
    "Δημήτριος",
    ["Demetrius of Magnesia", "Demetrius of Troezen", "Demetrius the Magnesian"],
  ],
  [
    "Demetrius of Troezen",
    "Δημήτριος",
    ["Demetrius of Magnesia", "Demetrius of Phalerum", "Demetrius the Magnesian"],
  ],
  [
    "Demetrius the Magnesian",
    "Δημήτριος",
    ["Demetrius of Phalerum", "Demetrius of Troezen"],
  ],
  ["Damon", "Δάμων", ["Damon of Cyrene"]],
  ["Damon of Cyrene", "Δάμων", ["Damon"]],
  ["Diodorus", "Διόδωρος", ["Diodorus of Ephesus"]],
  ["Diodorus of Ephesus", "Διόδωρος", ["Diodorus"]],
  [
    "Diogenes of Apollonia",
    "Διογένης",
    ["Diogenes of Sinope", "Diogenes of Smyrna"],
  ],
  [
    "Diogenes of Sinope",
    "Διογένης",
    ["Diogenes of Apollonia", "Diogenes of Smyrna"],
  ],
  [
    "Diogenes of Smyrna",
    "Διογένης",
    ["Diogenes of Apollonia", "Diogenes of Sinope"],
  ],
  [
    "Dionysius the Elder",
    "Διονύσιος",
    ["Dionysius the Renegade", "Dionysius the Stoic", "Dionysius the Younger"],
  ],
  [
    "Dionysius the Renegade",
    "Διονύσιος",
    ["Dionysius the Elder", "Dionysius the Younger"],
  ],
  [
    "Dionysius the Stoic",
    "Διονύσιος",
    ["Dionysius the Elder", "Dionysius the Younger"],
  ],
  [
    "Dionysius the Younger",
    "Διονύσιος",
    ["Dionysius the Elder", "Dionysius the Renegade", "Dionysius the Stoic"],
  ],
  // 2026-07 Sceptic Greek pass: the new curated Greek forms for the
  // Sceptic mention persons add Heraclides the Sceptic to the
  // Ἡρακλείδης set and create three new shared forms: Διοσκουρίδης
  // (bare source Dioscurides / Dioscurides of Cyprus), Πτολεμαῖος
  // (Ptolemy Soter / Ptolemy of Cyrene) and Ζεῦξις (bare source
  // Zeuxis / Zeuxis Goniopus).
  ["Dioscurides", "Διοσκουρίδης", ["Dioscurides of Cyprus"]],
  ["Dioscurides of Cyprus", "Διοσκουρίδης", ["Dioscurides"]],
  // 2026-07 Cratinus split (gazetteer.ts): the two comic poets now carry
  // Index entries (their bare surface was classified per occurrence), so
  // their shared curated form Κρατῖνος surfaces as a homonym pair.
  ["Cratinus", "Κρατῖνος", ["Cratinus the Younger"]],
  ["Cratinus the Younger", "Κρατῖνος", ["Cratinus"]],
  // 2026-08 competency chip pass (gazetteer.ts split blocks): Bryson
  // son of Stilpo (9.61) and Heraclides of Heraclea (7.166) got scoped
  // Index entries so their competency person chips deep-link; both are
  // uncertified bearers of their shared forms.
  ["Bryson", "Βρύσων", ["Bryson the Achaean"]],
  ["Bryson the Achaean", "Βρύσων", ["Bryson"]],
  [
    "Heraclides of Heraclea",
    "Ἡρακλείδης",
    ["Heraclides Ponticus", "Heraclides of Tarsus", "Heraclides the Sceptic"],
  ],
  [
    "Heraclides of Tarsus",
    "Ἡρακλείδης",
    ["Heraclides Ponticus", "Heraclides of Heraclea", "Heraclides the Sceptic"],
  ],
  [
    "Heraclides Ponticus",
    "Ἡρακλείδης",
    ["Heraclides of Heraclea", "Heraclides of Tarsus", "Heraclides the Sceptic"],
  ],
  [
    "Heraclides the Sceptic",
    "Ἡρακλείδης",
    ["Heraclides Ponticus", "Heraclides of Heraclea", "Heraclides of Tarsus"],
  ],
  ["Ptolemy of Cyrene", "Πτολεμαῖος", ["Ptolemy Soter"]],
  ["Ptolemy Soter", "Πτολεμαῖος", ["Ptolemy of Cyrene"]],
  ["Zeuxis", "Ζεῦξις", ["Zeuxis Goniopus"]],
  ["Zeuxis Goniopus", "Ζεῦξις", ["Zeuxis"]],
  ["Menedemus of Eretria", "Μενέδημος", ["Menedemus the Cynic"]],
  ["Menedemus the Cynic", "Μενέδημος", ["Menedemus of Eretria"]],
  ["Posidonius", "Ποσειδώνιος", ["Posidonius of Alexandria"]],
  ["Posidonius of Alexandria", "Ποσειδώνιος", ["Posidonius"]],
  ["Zeno of Citium", "Ζήνων", ["Zeno of Elea", "Zeno of Sidon", "Zeno of Tarsus"]],
  ["Zeno of Elea", "Ζήνων", ["Zeno of Citium", "Zeno of Sidon", "Zeno of Tarsus"]],
  ["Zeno of Sidon", "Ζήνων", ["Zeno of Citium", "Zeno of Elea", "Zeno of Tarsus"]],
  ["Zeno of Tarsus", "Ζήνων", ["Zeno of Citium", "Zeno of Elea", "Zeno of Sidon"]],
];
const PINNED_FORMS = [
  "Βρύσων",
  "Ἀθηνόδωρος",
  "Ἀλέξανδρος",
  "Ἀριστοφάνης",
  "Διονύσιος",
  "Δάμων",
  "Δημήτριος",
  "Διογένης",
  "Διοσκουρίδης",
  "Διόδωρος",
  "Ζεῦξις",
  "Ζήνων",
  "Κρατῖνος",
  "Πτολεμαῖος",
  "Ἡρακλείδης",
  "Κράτης",
  "Μενέδημος",
  "Ποσειδώνιος",
];

const BEARER_KINDS = new Set(["philosopher", "person", "source"]);
const bearers = getIndexEntries().filter((e) => BEARER_KINDS.has(e.kind));
const bearerLabels = new Set(bearers.map((e) => e.label));
const homonyms = greekHomonymsForLabels(bearers.map((e) => e.label));

const actual: Row[] = [...homonyms.entries()]
  .map(([label, v]): Row => [label, v.grc, [...v.others].sort()])
  .sort((a, b) => a[0].localeCompare(b[0]));

// 1. Exact snapshot, order-free.
const key = (r: Row) => JSON.stringify(r);
const pinnedSet = new Set(PINNED.map(key));
const actualSet = new Set(actual.map(key));
if (actual.length !== PINNED.length) {
  errors.push(
    `homonym entry count changed: expected ${PINNED.length}, got ${actual.length}`,
  );
}
for (const k of pinnedSet) {
  if (!actualSet.has(k)) errors.push(`missing pinned homonym entry: ${k}`);
}
for (const k of actualSet) {
  if (!pinnedSet.has(k)) errors.push(`unpinned new homonym entry: ${k}`);
}

// 1b. The same-individual exclusion must hold: neither rendering of
//     Demetrius Magnes may list the other, and the Renegade/Stoic pair
//     must never surface against each other.
const SAME_INDIVIDUAL: [string, string][] = [
  ["Demetrius of Magnesia", "Demetrius the Magnesian"],
  ["Dionysius the Renegade", "Dionysius the Stoic"],
];
for (const [a, b] of SAME_INDIVIDUAL) {
  if (homonyms.get(a)?.others.includes(b)) {
    errors.push(`same-individual pair leaked: ${a} lists ${b}`);
  }
  if (homonyms.get(b)?.others.includes(a)) {
    errors.push(`same-individual pair leaked: ${b} lists ${a}`);
  }
}

// 2. Shared forms and symmetry.
const forms = [...new Set(actual.map((r) => r[1]))].sort();
if (JSON.stringify(forms) !== JSON.stringify([...PINNED_FORMS].sort())) {
  errors.push(
    `shared Greek forms changed: expected ${JSON.stringify(PINNED_FORMS)}, got ${JSON.stringify(forms)}`,
  );
}
for (const [label, grc, others] of actual) {
  for (const other of others) {
    const back = homonyms.get(other);
    if (!back) {
      errors.push(`${label}: bearer "${other}" has no homonym entry back`);
    } else if (back.grc !== grc) {
      errors.push(
        `${label} <-> ${other}: asymmetric shared form ("${grc}" vs "${back.grc}")`,
      );
    } else if (!back.others.includes(label)) {
      errors.push(`${other}: does not list "${label}" back as a bearer`);
    }
  }
}

// 3. Every bearer must be a tagged philosopher/person/source entry (the
//    index note's cross-link resolves through this label lookup).
for (const [label, , others] of actual) {
  if (!bearerLabels.has(label)) {
    errors.push(`homonym label "${label}" is not a tagged person-like entry`);
  }
  for (const other of others) {
    if (!bearerLabels.has(other)) {
      errors.push(
        `${label}: bearer "${other}" is not a tagged person-like entry`,
      );
    }
  }
}

// ---------------------------------------------------------------------
// 4. Uncertified namesake notes on fully-withheld shared forms.
// ---------------------------------------------------------------------
// Pinned [label, kind, shared form] triples for the bearers that must
// carry a SOFT namesake note (grcHomonymUncertified): the 7 fully-
// withheld forms surface all 14 of their bearers in the Index, so each
// card explains why two entries show the same Greek name even though no
// owl:differentFrom axiom certifies them distinct. (The Cratinus pair
// left this set 2026-07: both poets were certified — occurrence-level
// split against distinct verified QIDs — so they carry the hard
// owl:differentFrom note instead.)
type UncertRow = [string, string, string];
const PINNED_UNCERTIFIED: UncertRow[] = [
  ["Alexander", "source", "Ἀλέξανδρος"],
  ["Alexander the Great", "person", "Ἀλέξανδρος"],
  ["Bryson", "person", "Βρύσων"],
  ["Bryson the Achaean", "person", "Βρύσων"],
  ["Aristophanes", "person", "Ἀριστοφάνης"],
  ["Aristophanes the Grammarian", "source", "Ἀριστοφάνης"],
  ["Damon", "person", "Δάμων"],
  ["Damon of Cyrene", "source", "Δάμων"],
  ["Diodorus", "source", "Διόδωρος"],
  ["Diodorus of Ephesus", "source", "Διόδωρος"],
  ["Dioscurides", "source", "Διοσκουρίδης"],
  ["Dioscurides of Cyprus", "person", "Διοσκουρίδης"],
  ["Ptolemy Soter", "person", "Πτολεμαῖος"],
  ["Ptolemy of Cyrene", "person", "Πτολεμαῖος"],
  ["Zeuxis", "source", "Ζεῦξις"],
  ["Zeuxis Goniopus", "person", "Ζεῦξις"],
];

const uncertified = bearers.filter((e) => e.grcHomonymUncertified);
const actualUncert: UncertRow[] = uncertified
  .map((e): UncertRow => [e.label, e.kind, e.grcHomonymForm ?? ""])
  .sort((a, b) => a[0].localeCompare(b[0]) || a[1].localeCompare(b[1]));
const ukey = (r: UncertRow) => JSON.stringify(r);
const pinnedUncertSet = new Set(PINNED_UNCERTIFIED.map(ukey));
const actualUncertSet = new Set(actualUncert.map(ukey));
for (const k of pinnedUncertSet) {
  if (!actualUncertSet.has(k))
    errors.push(`missing pinned uncertified namesake note: ${k}`);
}
for (const k of actualUncertSet) {
  if (!pinnedUncertSet.has(k))
    errors.push(`unpinned NEW uncertified namesake note: ${k}`);
}
for (const e of uncertified) {
  // The withheld guard surfaces every bearer of a fully-withheld form,
  // so an uncertified note must sit next to a visible Greek name.
  if (!e.grc) {
    errors.push(
      `${e.label}: carries an uncertified namesake note but no grc — the note explains a form the card does not show`,
    );
  }
  if (!e.sharesGreekNameWith || e.sharesGreekNameWith.length === 0) {
    errors.push(`${e.label}: uncertified note lists no other bearer`);
  }
  for (const other of e.sharesGreekNameWith ?? []) {
    if (!other.entityUri) {
      errors.push(
        `${e.label}: uncertified namesake "${other.label}" carries no cross-link`,
      );
    }
  }
  // Fully withheld means fully withheld: the flagged form must not also
  // be borne by a philosopher or certified bearer (whose harder
  // owl:differentFrom note would contradict the soft wording).
  if (e.kind === "philosopher" || GREEK_HOMONYM_CERTIFIED_BEARERS.has(e.label)) {
    errors.push(
      `${e.label}: philosopher/certified bearer wrongly flagged grcHomonymUncertified`,
    );
  }
}
const uncertForms = new Set(actualUncert.map((r) => r[2]));
for (const e of bearers) {
  if (e.grcHomonymUncertified || !e.grcHomonymForm) continue;
  if (uncertForms.has(e.grcHomonymForm)) {
    errors.push(
      `form "${e.grcHomonymForm}" carries both certified ("${e.label}") and uncertified notes — a fully-withheld form has no certified bearer`,
    );
  }
}
// Positive control: the uncertified pin can never go vacuously green.
if (actualUncert.length === 0) {
  errors.push(
    "positive control failed: no uncertified namesake notes found at all",
  );
}

if (errors.length) {
  console.error(`validate-greek-homonyms: ${errors.length} error(s)`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}
console.log(
  `validate-greek-homonyms OK: ${actual.length} bearers over ` +
    `${forms.length} shared Greek forms pinned (philosopher, person and source entries); ` +
    `${actualUncert.length} uncertified namesake notes over ${uncertForms.size} fully-withheld forms`,
);
