/**
 * Cross-checks the two Greek fields the Index compares reader input
 * against: the per-entry curated Greek nominative (`grc`, from
 * greek-names.ts) and the shared homonym form (`grcHomonymForm`, derived
 * in lod.ts greekHomonymsForLabels). The Index filter and closest-names
 * fallback match against both; nothing else pins that, for an entry
 * carrying both, the two agree. A typo in either field would silently
 * split behaviour for the same reader input: the exact-match path would
 * accept one spelling while the homonym note advertised another, or a
 * shared form could surface a spelling no bearer's own curated name uses.
 *
 * For every index entry carrying both fields, this validator requires:
 *
 * 1. `grcHomonymForm` is byte-identical to one of the entry's OWN curated
 *    Greek forms (name spec grc, plus work-title spec grc where one
 *    exists) — the same family greekHomonymsForLabels derives the shared
 *    form from. In practice person-like entries carry exactly one curated
 *    form, so this pins grc === grcHomonymForm.
 * 2. No entry carries `grcHomonymForm` without `grc`: every homonym
 *    bearer surfaced in the Index must also expose its own curated Greek
 *    name (philosophers always do; person/source bearers are certified
 *    precisely so they may).
 * 3. A pinned positive count of entries checked, so the validator can
 *    never go vacuously green (an upstream rename emptying the bearer
 *    set would surface here, not silently pass).
 *
 * A deliberate change to the bearer set requires updating the pin here.
 *
 * Run from the workspace root:
 *   pnpm --filter @workspace/scripts run validate-greek-homonym-consistency
 */
import path from "node:path";

process.env["LAERTIUS_DATA_DIR"] ??= path.resolve(
  import.meta.dirname,
  "../../artifacts/api-server/data",
);

const { getIndexEntries } = await import(
  "../../artifacts/api-server/src/lib/annotate"
);
const { greekNameSpec, greekWorkTitleSpec } = await import(
  "../../artifacts/api-server/src/lib/greek-names"
);

/** The uncertified bearers of fully-withheld shared forms also carry
 *  grcHomonymForm (with grcHomonymUncertified: true) so the Index can
 *  explain why two cards show the same Greek name — but they get the
 *  SOFT namesake note, not owl:differentFrom. Pinned by label so an
 *  uncertified bearer can never silently drift into (or masquerade as)
 *  the certified subset below: 14 entries over 7 forms as of 2026-07,
 *  mirroring PINNED_UNCERTIFIED in validate-greek-homonyms.ts. */
const PINNED_UNCERTIFIED_BEARERS: ReadonlyMap<
  string,
  { kind: string; form: string }
> = new Map([
  ["Alexander", { kind: "source", form: "Ἀλέξανδρος" }],
  ["Alexander the Great", { kind: "person", form: "Ἀλέξανδρος" }],
  ["Aristophanes", { kind: "person", form: "Ἀριστοφάνης" }],
  ["Aristophanes the Grammarian", { kind: "source", form: "Ἀριστοφάνης" }],
  ["Bryson", { kind: "person", form: "Βρύσων" }],
  ["Bryson the Achaean", { kind: "person", form: "Βρύσων" }],
  ["Damon", { kind: "person", form: "Δάμων" }],
  ["Damon of Cyrene", { kind: "source", form: "Δάμων" }],
  ["Diodorus", { kind: "source", form: "Διόδωρος" }],
  ["Diodorus of Ephesus", { kind: "source", form: "Διόδωρος" }],
  ["Dioscurides", { kind: "source", form: "Διοσκουρίδης" }],
  ["Dioscurides of Cyprus", { kind: "person", form: "Διοσκουρίδης" }],
  ["Ptolemy Soter", { kind: "person", form: "Πτολεμαῖος" }],
  ["Ptolemy of Cyrene", { kind: "person", form: "Πτολεμαῖος" }],
  ["Zeuxis", { kind: "source", form: "Ζεῦξις" }],
  ["Zeuxis Goniopus", { kind: "person", form: "Ζεῦξις" }],
]);

/** The exact certified subset the Index shows homonym notes for, pinned
 *  BY LABEL (not just count). The Index attaches grcHomonymForm only to
 *  philosophers and the certified person/source bearers (linkGreekHomonyms
 *  in annotate.ts, gated by GREEK_HOMONYM_CERTIFIED_BEARERS in lod.ts),
 *  a subset of the 40-bearer superset validate-greek-homonyms.ts pins over
 *  all person-like labels: 20 entries as of 2026-07 (the two Cratinus
 *  comic poets were certified — distinct verified QIDs).
 *
 *  Every pair of entries sharing a form carries owl:differentFrom in the
 *  LOD graph, so an accidental widening of the certification gate would
 *  assert an OWL-false axiom between uncertified bearers, and a narrowing
 *  would silently drop a real note. Any deliberate addition or removal of
 *  a certified bearer therefore requires updating this pin. */
const PINNED_BEARERS: ReadonlyMap<string, { kind: string; form: string }> =
  new Map([
    ["Athenodorus", { kind: "source", form: "Ἀθηνόδωρος" }],
    ["Athenodorus of Soli", { kind: "person", form: "Ἀθηνόδωρος" }],
    ["Crates of Athens", { kind: "philosopher", form: "Κράτης" }],
    ["Cratinus", { kind: "person", form: "Κρατῖνος" }],
    ["Cratinus the Younger", { kind: "person", form: "Κρατῖνος" }],
    ["Crates of Thebes", { kind: "philosopher", form: "Κράτης" }],
    ["Demetrius of Magnesia", { kind: "source", form: "Δημήτριος" }],
    ["Demetrius of Phalerum", { kind: "philosopher", form: "Δημήτριος" }],
    ["Demetrius of Troezen", { kind: "person", form: "Δημήτριος" }],
    ["Demetrius the Magnesian", { kind: "source", form: "Δημήτριος" }],
    ["Diogenes of Apollonia", { kind: "philosopher", form: "Διογένης" }],
    ["Diogenes of Sinope", { kind: "philosopher", form: "Διογένης" }],
    ["Diogenes of Smyrna", { kind: "person", form: "Διογένης" }],
    ["Menedemus of Eretria", { kind: "philosopher", form: "Μενέδημος" }],
    ["Menedemus the Cynic", { kind: "philosopher", form: "Μενέδημος" }],
    ["Posidonius", { kind: "source", form: "Ποσειδώνιος" }],
    ["Posidonius of Alexandria", { kind: "person", form: "Ποσειδώνιος" }],
    ["Zeno of Citium", { kind: "philosopher", form: "Ζήνων" }],
    ["Zeno of Elea", { kind: "philosopher", form: "Ζήνων" }],
    ["Zeno of Sidon", { kind: "person", form: "Ζήνων" }],
  ]);

const errors: string[] = [];
const entries = getIndexEntries();

let both = 0;
const seen = new Map<string, { kind: string; form: string }>();
for (const e of entries) {
  if (e.grcHomonymForm !== undefined) {
    seen.set(e.label, { kind: e.kind, form: e.grcHomonymForm });
    const pin = e.grcHomonymUncertified
      ? PINNED_UNCERTIFIED_BEARERS.get(e.label)
      : PINNED_BEARERS.get(e.label);
    if (!pin) {
      errors.push(
        e.grcHomonymUncertified
          ? `${e.label} (${e.kind}): carries an UNCERTIFIED grcHomonymForm "${e.grcHomonymForm}" but is not in PINNED_UNCERTIFIED_BEARERS — a new fully-withheld form (or bearer) surfaced; if deliberate, add the entry to the pin here and in validate-greek-homonyms.ts`
          : `${e.label} (${e.kind}): carries grcHomonymForm "${e.grcHomonymForm}" but is NOT in the pinned certified subset — an accidental widening of the certification gate would assert owl:differentFrom between uncertified bearers; if deliberate, add the entry to PINNED_BEARERS`,
      );
    } else {
      if (
        !e.grcHomonymUncertified &&
        PINNED_UNCERTIFIED_BEARERS.has(e.label)
      ) {
        errors.push(
          `${e.label}: pinned as an uncertified bearer but the Index entry lacks grcHomonymUncertified — it would render the owl:differentFrom wording`,
        );
      }
      if (pin.kind !== e.kind) {
        errors.push(
          `${e.label}: pinned kind "${pin.kind}" but the Index entry is "${e.kind}"`,
        );
      }
      if (pin.form !== e.grcHomonymForm) {
        errors.push(
          `${e.label}: pinned shared form "${pin.form}" but the Index entry carries "${e.grcHomonymForm}"`,
        );
      }
    }
  }
  if (e.grcHomonymForm !== undefined && e.grc === undefined) {
    errors.push(
      `${e.label} (${e.kind}): carries grcHomonymForm "${e.grcHomonymForm}" but no grc — the homonym note advertises a Greek form the entry itself does not expose`,
    );
  }
  if (e.grc === undefined || e.grcHomonymForm === undefined) continue;
  both += 1;
  // The entry's own curated Greek family, as greek-names.ts records it —
  // NOT the value echoed on the entry, so a drift between the curated
  // source and the derived shared form cannot cancel out.
  const family = [
    greekNameSpec(e.label)?.grc,
    greekWorkTitleSpec(e.label)?.grc,
  ].filter((g): g is string => !!g);
  if (family.length === 0) {
    errors.push(
      `${e.label} (${e.kind}): carries grc "${e.grc}" but greek-names.ts has no curated spec for this label`,
    );
    continue;
  }
  if (!family.includes(e.grcHomonymForm)) {
    errors.push(
      `${e.label} (${e.kind}): grcHomonymForm "${e.grcHomonymForm}" is not among the entry's own curated Greek forms [${family.join(", ")}] — a typo in one of the two would split exact-match vs homonym-fallback behaviour`,
    );
  }
  if (e.grc !== e.grcHomonymForm) {
    errors.push(
      `${e.label} (${e.kind}): grc "${e.grc}" != grcHomonymForm "${e.grcHomonymForm}" — the Index would exact-match one spelling while the homonym note shows another`,
    );
  }
  if (!family.includes(e.grc)) {
    errors.push(
      `${e.label} (${e.kind}): grc "${e.grc}" is not among the curated forms [${family.join(", ")}] in greek-names.ts`,
    );
  }
}

for (const [label, pin] of PINNED_BEARERS) {
  if (!seen.has(label)) {
    errors.push(
      `pinned certified bearer "${label}" (${pin.kind}, ${pin.form}) carries no grcHomonymForm in the Index — a real homonym note was dropped; if deliberate, remove the entry from PINNED_BEARERS`,
    );
  }
}
for (const [label, pin] of PINNED_UNCERTIFIED_BEARERS) {
  if (!seen.has(label)) {
    errors.push(
      `pinned uncertified bearer "${label}" (${pin.kind}, ${pin.form}) carries no grcHomonymForm in the Index — a soft namesake note was dropped; if deliberate, remove the entry from PINNED_UNCERTIFIED_BEARERS`,
    );
  }
}

// ------------------------------------------------------- cross-links
// Every `sharesGreekNameWith` peer must carry an entityUri that resolves
// to a real tagged Index entry bearing the SAME shared form, and the
// peer lists must be symmetric (if A lists B, B lists A). A drifted URI
// (slug change, entity rename) would otherwise render a dead or wrong
// link — or silently degrade to a plain-text label — without failing.
const byLabel = new Map(entries.map((e) => [e.label, e]));
const byUri = new Map(entries.map((e) => [e.entityUri, e]));
let crossLinks = 0;
for (const e of entries) {
  if (!e.sharesGreekNameWith) continue;
  if (e.grcHomonymForm === undefined) {
    errors.push(
      `${e.label} (${e.kind}): carries sharesGreekNameWith without grcHomonymForm — the note has peers but no shared form`,
    );
  }
  if (e.sharesGreekNameWith.length === 0) {
    errors.push(
      `${e.label} (${e.kind}): sharesGreekNameWith is empty — a homonym note with no peers`,
    );
  }
  for (const peer of e.sharesGreekNameWith) {
    crossLinks += 1;
    if (!peer.entityUri) {
      errors.push(
        `${e.label} (${e.kind}): peer "${peer.label}" carries no entityUri — the 'shares name with' link silently degrades to plain text`,
      );
      continue;
    }
    const target = byUri.get(peer.entityUri);
    if (!target) {
      errors.push(
        `${e.label} (${e.kind}): peer "${peer.label}" points at ${peer.entityUri}, which matches NO tagged Index entry — the link would be dead`,
      );
      continue;
    }
    if (target.label !== peer.label) {
      errors.push(
        `${e.label} (${e.kind}): peer labelled "${peer.label}" points at the entry for "${target.label}" (${peer.entityUri}) — the link opens the wrong Index entry`,
      );
      continue;
    }
    const own = byLabel.get(peer.label);
    if (own && own.entityUri !== peer.entityUri) {
      errors.push(
        `${e.label} (${e.kind}): peer "${peer.label}" carries ${peer.entityUri} but the Index entry of that label is ${own.entityUri} — a drifted URI`,
      );
    }
    if (
      target.grcHomonymForm !== undefined &&
      e.grcHomonymForm !== undefined &&
      target.grcHomonymForm !== e.grcHomonymForm
    ) {
      errors.push(
        `${e.label} (${e.kind}): peer "${peer.label}" carries shared form "${target.grcHomonymForm}" but this entry carries "${e.grcHomonymForm}" — the two sides of the note disagree`,
      );
    }
    // Symmetry: if A lists B, B must list A (by label AND by URI).
    const back = target.sharesGreekNameWith?.find(
      (p) => p.label === e.label && p.entityUri === e.entityUri,
    );
    if (!back) {
      errors.push(
        `${e.label} (${e.kind}) lists "${peer.label}" but "${peer.label}" does not list "${e.label}" back (with the matching entityUri) — asymmetric homonym note`,
      );
    }
  }
}

// Positive control: every pinned certified bearer shares its form with
// at least one other certified bearer, so all 18 must carry a non-empty
// peer list; ditto the 16 uncertified. A vacuous sweep (no entry carrying
// sharesGreekNameWith at all) must fail loudly, not pass green.
for (const [label] of [...PINNED_BEARERS, ...PINNED_UNCERTIFIED_BEARERS]) {
  const e = byLabel.get(label);
  if (e && (!e.sharesGreekNameWith || e.sharesGreekNameWith.length === 0)) {
    errors.push(
      `pinned bearer "${label}" carries no sharesGreekNameWith peers — its homonym note lost the 'shares name with' links`,
    );
  }
}
if (crossLinks === 0) {
  errors.push(
    "positive control failed: no sharesGreekNameWith cross-links found at all — the sweep is vacuous",
  );
}

const expectedBoth = PINNED_BEARERS.size + PINNED_UNCERTIFIED_BEARERS.size;
if (both !== expectedBoth) {
  errors.push(
    `positive control failed: expected ${expectedBoth} entries carrying both grc and grcHomonymForm (${PINNED_BEARERS.size} certified + ${PINNED_UNCERTIFIED_BEARERS.size} uncertified), found ${both}`,
  );
}

if (errors.length) {
  console.error(`validate-greek-homonym-consistency: ${errors.length} error(s)`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}
console.log(
  `validate-greek-homonym-consistency OK: ${both} entries carry both grc and ` +
    `grcHomonymForm, every shared form matches the bearer's own curated Greek name, ` +
    `${crossLinks} sharesGreekNameWith cross-links resolve to real Index entries symmetrically`,
);
