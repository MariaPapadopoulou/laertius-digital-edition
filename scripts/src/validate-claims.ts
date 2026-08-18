/**
 * Validates the curated claims layer: runs getClaims() (which throws on
 * unknown subjects, bad property/valueType shapes, unknown philosopher
 * values and dangling conflictsWith links) and checks that every claim
 * ref (book.section) exists in the corpus.
 *
 * Run from the workspace root (LAERTIUS_DATA_DIR is optional; it defaults
 * to the api-server data directory):
 *   pnpm --filter @workspace/scripts run validate-claims
 */
import path from "node:path";

process.env["LAERTIUS_DATA_DIR"] ??= path.resolve(
  import.meta.dirname,
  "../../artifacts/api-server/data",
);

const { getClaims, getClaimEntities } = await import(
  "../../artifacts/api-server/src/lib/kg-claims"
);
const { getOntologyExtras } = await import(
  "../../artifacts/api-server/src/lib/kg-ontology"
);
const { corpus, sectionById } = await import(
  "../../artifacts/api-server/src/lib/corpus"
);
const { sectionIdForRef } = await import(
  "../../artifacts/api-server/src/lib/claims-answer"
);
const { normalizeGreek } = await import(
  "../../artifacts/api-server/src/lib/greek"
);
const { workUri, sourceUri } = await import(
  "../../artifacts/api-server/src/lib/lod"
);
const { getIndexEntries } = await import(
  "../../artifacts/api-server/src/lib/annotate"
);

const refs = new Set(
  corpus.map((s) => {
    const parts = s.id.split(".");
    return `${parts[0]}.${parts[parts.length - 1]}`;
  }),
);

const claims = getClaims();
const badRefs: string[] = [];
const emptyValues: string[] = [];
const badGreek: string[] = [];
let grcChecked = 0;
for (const c of claims) {
  if (!refs.has(c.ref)) badRefs.push(`${c.id} -> ${c.ref}`);
  if (c.value.trim().length === 0) emptyValues.push(c.id);
  // Greek, when curated, must be a verbatim excerpt of the cited section's
  // Greek text (mirrors validate-sayings.ts). sectionIdForRef is the SAME
  // resolver claims-answer.ts uses to attach the panel's sectionId (the
  // /section/:id citation link target), so this check certifies the
  // "Source text" excerpt appears on the exact page the citation opens.
  if (c.grc) {
    grcChecked += 1;
    const sectionId = sectionIdForRef(c.ref, c.subject);
    const section = sectionId ? sectionById.get(sectionId) : undefined;
    if (!section) {
      badGreek.push(`${c.id}: ref ${c.ref} resolves to no corpus section`);
    } else if (!normalizeGreek(section.text).includes(normalizeGreek(c.grc))) {
      badGreek.push(
        `${c.id}: Greek not a verbatim excerpt of ${c.ref} (${sectionId})\n` +
          `      grc: ${c.grc.slice(0, 60)}`,
      );
    }
  }
}
if (badRefs.length > 0) {
  console.error(`INVALID REFS (${badRefs.length}):`);
  for (const b of badRefs) console.error("  " + b);
  process.exit(1);
}
if (emptyValues.length > 0) {
  console.error(`EMPTY VALUES (${emptyValues.length}):`);
  for (const id of emptyValues) console.error("  " + id);
  process.exit(1);
}
// Ambiguous-ref resolution pin: Hicks numbering restarts across chapter
// boundaries, so a bare book.section ref can belong to several chapters
// (e.g. 2.124 is Simon, Glaucon AND Simmias). sectionIdForRef must pick
// the section owned by the claim's subject, never the first match; a
// first-match regression once silently approved 16 misquoted Greek
// excerpts. Each pin below names a representative claim per ambiguous key.
const ambiguousPins: { claimId: string; expected: string }[] = [
  { claimId: "glaucon-birthplace-athens", expected: "2.14.124" },
  { claimId: "simmias-birthplace-thebes", expected: "2.15.124" },
  { claimId: "cebes-birthplace-thebes", expected: "2.16.125" },
  { claimId: "ariston-doctrine-indifference", expected: "7.2.160" },
  { claimId: "dionysius-doctrine-pleasure", expected: "7.4.166" },
  { claimId: "alcmaeon-birthplace-croton", expected: "8.5.83" },
  { claimId: "philolaus-birthplace-croton", expected: "8.7.84" },
];
const claimById = new Map(claims.map((c) => [c.id, c]));
const badAmbiguous: string[] = [];
for (const pin of ambiguousPins) {
  const c = claimById.get(pin.claimId);
  if (!c) {
    badAmbiguous.push(`${pin.claimId}: pinned claim no longer exists`);
    continue;
  }
  const actual = sectionIdForRef(c.ref, c.subject);
  if (actual !== pin.expected) {
    badAmbiguous.push(
      `${pin.claimId}: ref ${c.ref} (subject ${c.subject}) resolved to ` +
        `${actual ?? "no section"}, expected ${pin.expected}`,
    );
  }
}
if (badAmbiguous.length > 0) {
  console.error(
    `AMBIGUOUS REF RESOLUTION REGRESSION (${badAmbiguous.length}): ` +
      "sectionIdForRef must resolve to the subject-owned section, not first-match",
  );
  for (const b of badAmbiguous) console.error("  " + b);
  process.exit(1);
}

// Positive control: the excerpt-vs-linked-section check above is only
// meaningful if it actually ran against curated excerpts. If no claim
// carries grc, the check is vacuous — fail loudly instead of passing.
if (grcChecked === 0) {
  console.error(
    "GREEK EXCERPT CHECK VACUOUS: no claim has a grc excerpt (positive control failed)",
  );
  process.exit(1);
}
if (badGreek.length > 0) {
  console.error(`INVALID GREEK EXCERPTS (${badGreek.length}):`);
  for (const b of badGreek) console.error("  " + b);
  process.exit(1);
}

// Every claim's sourceWork must map (via workUri) to an entity in the
// annotated entities index: the claims panel links "asserted in" works to
// /entities?entity=<workUri(sourceWork)>, and that page resolves the URI
// against getIndexEntries(). A renamed source work or a dropped Greek
// title spec would otherwise land readers on an empty Index panel.
const indexOccurrences = new Map(
  getIndexEntries().map((e) => [e.entityUri, e.occurrences]),
);
const indexUris = new Set(indexOccurrences.keys());
const badSourceWorks: string[] = [];
let resolvedSourceWorks = 0;
for (const c of claims) {
  if (c.sourceWork === undefined) continue;
  const uri = workUri(c.sourceWork);
  if (!indexUris.has(uri)) {
    badSourceWorks.push(`${c.id}: "${c.sourceWork}" -> ${uri}`);
  } else if ((indexOccurrences.get(uri) ?? 0) < 1) {
    // Resolving alone is not enough: an entry with zero tagged
    // occurrences renders as an empty Index panel (same guard as the
    // chain-link check below).
    badSourceWorks.push(
      `${c.id}: "${c.sourceWork}" resolves in the index but has zero ` +
        `tagged occurrences; its Index link would open an empty entry (${uri})`,
    );
  } else {
    resolvedSourceWorks += 1;
  }
}
if (badSourceWorks.length > 0) {
  console.error(
    `SOURCE WORKS NOT IN ENTITIES INDEX (${badSourceWorks.length}):`,
  );
  for (const b of badSourceWorks) console.error("  " + b);
  process.exit(1);
}
if (resolvedSourceWorks === 0) {
  console.error(
    "SOURCE WORK CHECK VACUOUS: no claim resolved a sourceWork URI " +
      "against the entities index (positive control failed)",
  );
  process.exit(1);
}

// Transmission-chain Index links: routes/graph.ts attaches authorityUri /
// workUri to each chain link only when the URI resolves in the entities
// index (getIndexEntries()). A gazetteer or homonym-suppression change can
// silently flip a link: either a resolvable authority loses its Index
// entry (a reader link would 404) or a deliberately unlinked one (Ariston,
// homonym-suppressed; Arcesilaus, tagged as philosopher not source) gains
// a source entry and starts linking somewhere unreviewed. Pin, for every
// distinct chain authority and chain work across getClaims(), whether the
// recomputed URI (same sourceUri/workUri calls as routes/graph.ts) must
// resolve in the index. Any new chain authority/work must be added here.
const chainAuthorityPins = new Map<string, boolean>([
  ["Arcesilaus", false],
  ["Ariston", false],
  ["Hermippus", true],
  ["Satyrus", true],
  ["Sotion", true],
]);
const chainWorkPins = new Map<string, boolean>([["On Heraclitus", true]]);
const badChain: string[] = [];
const seenAuthorities = new Set<string>();
const seenWorks = new Set<string>();
let chainLinkCount = 0;
let resolvedChainUris = 0;
for (const c of claims) {
  for (const link of c.chain ?? []) {
    chainLinkCount += 1;
    seenAuthorities.add(link.authority);
    const aResolves = indexUris.has(sourceUri(link.authority));
    if (aResolves) resolvedChainUris += 1;
    const aPin = chainAuthorityPins.get(link.authority);
    if (aPin === undefined) {
      badChain.push(
        `${c.id}: chain authority "${link.authority}" is not pinned ` +
          `(resolves in index: ${aResolves}); add it to chainAuthorityPins`,
      );
    } else if (aResolves !== aPin) {
      badChain.push(
        `${c.id}: chain authority "${link.authority}" expected ` +
          `${aPin ? "an Index link" : "no Index link"} but ` +
          `${aResolves ? "its URI now resolves" : "its URI no longer resolves"} ` +
          `(${sourceUri(link.authority)})`,
      );
    } else if (aPin && (indexOccurrences.get(sourceUri(link.authority)) ?? 0) < 1) {
      badChain.push(
        `${c.id}: chain authority "${link.authority}" resolves in the ` +
          `index but has zero tagged occurrences; its Index link would ` +
          `open an empty entry (${sourceUri(link.authority)})`,
      );
    }
    if (link.work !== undefined) {
      seenWorks.add(link.work);
      const wResolves = indexUris.has(workUri(link.work));
      if (wResolves) resolvedChainUris += 1;
      const wPin = chainWorkPins.get(link.work);
      if (wPin === undefined) {
        badChain.push(
          `${c.id}: chain work "${link.work}" is not pinned ` +
            `(resolves in index: ${wResolves}); add it to chainWorkPins`,
        );
      } else if (wResolves !== wPin) {
        badChain.push(
          `${c.id}: chain work "${link.work}" expected ` +
            `${wPin ? "an Index link" : "no Index link"} but ` +
            `${wResolves ? "its URI now resolves" : "its URI no longer resolves"} ` +
            `(${workUri(link.work)})`,
        );
      } else if (wPin && (indexOccurrences.get(workUri(link.work)) ?? 0) < 1) {
        badChain.push(
          `${c.id}: chain work "${link.work}" resolves in the index but ` +
            `has zero tagged occurrences; its Index link would open an ` +
            `empty entry (${workUri(link.work)})`,
        );
      }
    }
  }
}
for (const a of chainAuthorityPins.keys()) {
  if (!seenAuthorities.has(a)) {
    badChain.push(
      `pinned chain authority "${a}" no longer appears in any claim chain`,
    );
  }
}
for (const w of chainWorkPins.keys()) {
  if (!seenWorks.has(w)) {
    badChain.push(
      `pinned chain work "${w}" no longer appears in any claim chain`,
    );
  }
}
if (badChain.length > 0) {
  console.error(`CHAIN INDEX LINK REGRESSION (${badChain.length}):`);
  for (const b of badChain) console.error("  " + b);
  process.exit(1);
}
if (chainLinkCount === 0 || resolvedChainUris === 0) {
  console.error(
    "CHAIN LINK CHECK VACUOUS: no chain links found or none resolved " +
      "against the entities index (positive control failed)",
  );
  process.exit(1);
}

// "According to" authority Index pins: claims-panel renders c.accordingTo
// next to each claim, and routes/graph.ts decides link-vs-plain-text by
// resolving the same sourceUri against getIndexEntries(). Only two
// authorities (Favorinus, Apollodorus) are hand-pinned in e2e-chain-links,
// so a gazetteer or homonym-suppression change could silently flip any
// other authority between linked and plain text. Pin, for every distinct
// accordingTo across getClaims(), whether sourceUri(authority) must
// resolve in the Index (with >=1 tagged occurrence). Any new accordingTo
// authority must be added here after reviewing its intended rendering.
const accordingToPins = new Map<string, boolean>([
  ["Achaïcus", true],
  ["Alcidamas", true],
  ["Alexander", true],
  ["Antigonus of Carystus", true],
  ["Antileon", true],
  ["Antigonus", false],
  ["Antisthenes", false],
  ["Apollodorus the Epicurean", true],
  ["Apollodorus", false],
  ["Apollonides", true],
  ["Aristotle", false],
  ["Aristoxenus", true],
  ["Athenodorus", true],
  ["Ctesiclides", true],
  ["Demetrius of Magnesia", true],
  ["Demetrius of Troezen", false],
  ["Demetrius the Magnesian", true],
  ["Demetrius", false],
  ["Diocles", true],
  ["Duris", true],
  ["Epicurus (letter to Eurylochus)", false],
  ["Eratosthenes", true],
  ["Eumelus", true],
  ["Favorinus", true],
  ["Hecato", true],
  ["Heraclides", false],
  ["Hermarchus", false],
  ["Hermippus", true],
  ["Hermodorus", true],
  ["Herodotus", false],
  ["Hipparchus", true],
  ["Hippobotus", true],
  ["Menodotus of Nicomedia", true],
  ["Myronianus", true],
  ["Neanthes", true],
  ["Nicomachus", true],
  ["Persaeus", true],
  ["Philo of Athens", true],
  ["Philochorus", true],
  ["Phlegon", true],
  ["Plutarch", true],
  ["Satyrus", true],
  ["Sosicrates", true],
  ["Sotion", true],
  ["Telauges", true],
  ["Theophrastus", false],
  ["Theopompus", false],
  ["Thrasylus", true],
  ["Timaeus", false],
  ["Timocrates", true],
  ["Xenophanes", false],
]);
const badAccordingTo: string[] = [];
const seenAccordingTo = new Map<string, string>(); // authority -> representative claim id
let resolvedAccordingTo = 0;
for (const c of claims) {
  if (c.accordingTo === undefined) continue;
  if (!seenAccordingTo.has(c.accordingTo)) {
    seenAccordingTo.set(c.accordingTo, c.id);
  }
}
for (const [authority, claimId] of seenAccordingTo) {
  const uri = sourceUri(authority);
  const resolves = indexUris.has(uri);
  if (resolves) resolvedAccordingTo += 1;
  const pin = accordingToPins.get(authority);
  if (pin === undefined) {
    badAccordingTo.push(
      `"${authority}" (e.g. ${claimId}) is not pinned ` +
        `(resolves in index: ${resolves}); add it to accordingToPins`,
    );
  } else if (resolves !== pin) {
    badAccordingTo.push(
      `"${authority}" (e.g. ${claimId}) expected ` +
        `${pin ? "an Index entry" : "no Index entry"} but ` +
        `${resolves ? "its URI now resolves" : "its URI no longer resolves"} ` +
        `(${uri})`,
    );
  } else if (pin && (indexOccurrences.get(uri) ?? 0) < 1) {
    badAccordingTo.push(
      `"${authority}" (e.g. ${claimId}) resolves in the index but has ` +
        `zero tagged occurrences; its Index entry would open empty (${uri})`,
    );
  }
}
for (const a of accordingToPins.keys()) {
  if (!seenAccordingTo.has(a)) {
    badAccordingTo.push(
      `pinned accordingTo authority "${a}" no longer appears in any claim`,
    );
  }
}
if (badAccordingTo.length > 0) {
  console.error(
    `ACCORDING-TO INDEX RESOLVABILITY REGRESSION (${badAccordingTo.length}):`,
  );
  for (const b of badAccordingTo) console.error("  " + b);
  process.exit(1);
}
if (seenAccordingTo.size === 0 || resolvedAccordingTo === 0) {
  console.error(
    "ACCORDING-TO CHECK VACUOUS: no accordingTo authorities found or none " +
      "resolved against the entities index (positive control failed)",
  );
  process.exit(1);
}

const bySubject = new Map<string, number>();
let withGrc = 0;
let withSourceWork = 0;
let withChain = 0;
for (const c of claims) {
  bySubject.set(c.subject, (bySubject.get(c.subject) ?? 0) + 1);
  if (c.grc) withGrc += 1;
  if (c.sourceWork !== undefined) withSourceWork += 1;
  if (c.chain !== undefined && c.chain.length > 0) withChain += 1;
}
const e = getClaimEntities();

// Ontology extras (kg-ontology.ts): getOntologyExtras() throws on unknown
// works/schools; here we also check every curated ref exists in the corpus.
const extras = getOntologyExtras();
const extraRefs: [string, string][] = [
  ...extras.altTitles.map(
    (a): [string, string] => [`altTitle "${a.altTitle}"`, a.ref],
  ),
  ...extras.schoolDoctrines.map(
    (sd): [string, string] => [`schoolDoctrine ${sd.school}`, sd.ref],
  ),
  ...extras.workTransmission.map(
    (tr): [string, string] => [`transmission "${tr.work}"`, tr.ref],
  ),
  ...extras.founderLinks
    .filter((f) => f.ref)
    .map((f): [string, string] => [`founder ${f.philosopher}`, f.ref!]),
  ...extras.chronology.flatMap((ch): [string, string][] =>
    ch.refs.map((ref) => [`chronology ${ch.philosopher}`, ref]),
  ),
];
const badExtraRefs = extraRefs.filter(([, ref]) => !refs.has(ref));
if (badExtraRefs.length > 0) {
  console.error(`INVALID EXTRA REFS (${badExtraRefs.length}):`);
  for (const [what, ref] of badExtraRefs) console.error(`  ${what} -> ${ref}`);
  process.exit(1);
}

console.log(
  `OK: ${claims.length} claims, ${bySubject.size} philosophers, ` +
    `${e.places.length} places, ${e.works.length} works, ${e.persons.length} persons, ` +
    `${e.sources.length} sources, ${e.doctrines.length} doctrines, ${e.terms.length} terms, ` +
    `${withGrc} with Greek excerpts, ${withSourceWork} with source work, ${withChain} with chain`,
);
console.log(
  `    extras: ${extras.altTitles.length} alt-titles, ${extras.schoolDoctrines.length} school doctrines, ` +
    `${extras.workTransmission.length} transmission flags, ${extras.founderLinks.length} founders, ` +
    `${extras.chronology.length} chronologies`,
);
