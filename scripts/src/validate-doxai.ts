/**
 * Validates the curated doxography layer:
 *  - runs getDoxai() (which throws on duplicate ids, unknown philosophers,
 *    empty text, unknown domains and malformed refs);
 *  - resolves every doxa's ref to a corpus section (the same first-match
 *    mapping the app uses) and asserts the section exists;
 *  - asserts each doxa's English is a VERBATIM excerpt of that section's
 *    Hicks English — normalized for whitespace, quote style and dashes,
 *    then a substring check;
 *  - asserts each `doctrine` label names a doctrine node the graph ALREADY
 *    knows (a claim doctrine or a school doctrine) — the doxography layer
 *    mints nothing;
 *  - asserts no doxa's English normalized-EQUALS a curated saying's English
 *    (containment is fine; equality means the entry is a mislabeled saying);
 *  - pins doxaSectionIdFor's OWNER-AWARE resolution on the ambiguous
 *    book.section keys (Hicks numbering restarts across chapter boundaries,
 *    so e.g. 7.160 belongs to both Zeno's and Ariston's chapters): each
 *    representative doxa must resolve to its philosopher's own section, and
 *    every doxa ref/grcRef landing on an ambiguous key must be pinned, so a
 *    first-match regression (which once approved 16 misquoted Greek excerpts
 *    in the claims layer) fails loudly here too.
 *
 * Run from the workspace root (LAERTIUS_DATA_DIR is optional; it defaults to
 * the api-server data directory):
 *   pnpm --filter @workspace/scripts run validate-doxai
 */
import path from "node:path";

process.env["LAERTIUS_DATA_DIR"] ??= path.resolve(
  import.meta.dirname,
  "../../artifacts/api-server/data",
);

const { getDoxai, doxaSectionIdFor, DOXA_DOMAINS } = await import(
  "../../artifacts/api-server/src/lib/doxai"
);
const { getSayings } = await import(
  "../../artifacts/api-server/src/lib/sayings"
);
const { getAnecdotes } = await import(
  "../../artifacts/api-server/src/lib/anecdotes"
);
const { getEpistles } = await import(
  "../../artifacts/api-server/src/lib/epistles"
);
const { getSourcesIndex } = await import(
  "../../artifacts/api-server/src/lib/sources-index"
);
const { getClaimEntities } = await import(
  "../../artifacts/api-server/src/lib/kg-claims"
);
const { SCHOOL_DOCTRINES } = await import(
  "../../artifacts/api-server/src/lib/kg-ontology"
);
const { sectionById, corpus } = await import(
  "../../artifacts/api-server/src/lib/corpus"
);
const { normalizeGreek } = await import(
  "../../artifacts/api-server/src/lib/greek"
);

/** Fold quote glyphs, dashes and whitespace so a curated excerpt can be
 * matched against the source text regardless of typographic style. */
function normalize(s: string): string {
  return s
    .replace(/[\u2018\u2019\u201B\u2032`\u00B4]/g, "'")
    .replace(/[\u201C\u201D\u201E\u2033]/g, '"')
    .replace(/[\u2010\u2011\u2012\u2013\u2014\u2015]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

const doxai = getDoxai();
const errors: string[] = [];
let grcChecked = 0;
let enChecked = 0;

// Domain-spelling pin: the /doxography page's ?domain= filter silently
// falls back to the full list on an unrecognized value, so renaming a
// domain in the doxai layer would quietly invalidate every previously
// shared link with the old spelling. Pin the locked twelve-domain union
// EXACTLY (strings and count) so a drift or rename fails loudly here and
// becomes a conscious decision (update this pin AND plan redirects/link
// hygiene) instead of silent link rot.
const PINNED_DOXA_DOMAINS = [
  "first-principles",
  "cosmology",
  "physics",
  "soul",
  "gods",
  "epistemology",
  "logic",
  "ethics",
  "pleasure",
  "politics",
  "fate",
  "death",
];
{
  const pinned = new Set<string>(PINNED_DOXA_DOMAINS);
  const actual = new Set<string>(DOXA_DOMAINS);
  const removed = PINNED_DOXA_DOMAINS.filter((d) => !actual.has(d));
  const added = [...actual].filter((d) => !pinned.has(d));
  if (removed.length > 0 || added.length > 0) {
    const renameHint =
      removed.length > 0 && added.length > 0
        ? ` (looks like a rename: ${removed.join(", ")} -> ${added.join(", ")})`
        : "";
    errors.push(
      `domain set drifted from the pinned twelve-domain union${renameHint}: ` +
        `${removed.length > 0 ? `old spelling(s) no longer present: [${removed.join(", ")}]; ` : ""}` +
        `${added.length > 0 ? `new spelling(s) not pinned: [${added.join(", ")}]; ` : ""}` +
        `renaming a domain breaks every shared /doxography?domain= link with ` +
        `the old spelling - if intentional, update PINNED_DOXA_DOMAINS in ` +
        `validate-doxai.ts and handle the old links consciously`,
    );
  }
  // The in-use domains must stay within the pinned union too (getDoxai()
  // already enforces membership in DOXA_DOMAINS, so this is a belt-and-
  // braces positive control that the pin actually covers real data).
  const inUse = new Set(doxai.map((d) => d.domain as string));
  const unpinnedInUse = [...inUse].filter((d) => !pinned.has(d));
  if (unpinnedInUse.length > 0) {
    errors.push(
      `domain(s) in use but not pinned: [${unpinnedInUse.join(", ")}]`,
    );
  }
  if (inUse.size === 0) {
    errors.push("no doxa domains in use: the domain pin is vacuous");
  }
}

// The set of doctrine labels the graph already knows: claim doctrines plus
// the curated school doctrines. A doxa's `doctrine` must be one of these —
// the doxography layer never mints doctrine nodes.
const knownDoctrines = new Set<string>([
  ...getClaimEntities().doctrines.map((d) => d.label),
  ...SCHOOL_DOCTRINES.map((sd) => sd.doctrine),
]);

// Source-minting guard: a doxa's accordingTo must be an authority whose
// lo:Source node ALREADY exists (cited by a claim, saying or anecdote, or
// in the sources index; the epistle layer has no accordingTo slot - D.L.
// never names an authority for a letter he quotes). A new label would mint
// a source node, auto-feed the tagging layers, and shift the pinned
// annotations. If D.L. names a genuinely new authority, put it in `note`
// instead.
const knownAuthorities = new Set<string>([
  ...getClaimEntities().sources,
  ...getSayings().flatMap((s) => (s.accordingTo ? [s.accordingTo] : [])),
  ...getAnecdotes().flatMap((a) => (a.accordingTo ? [a.accordingTo] : [])),
  ...getSourcesIndex().groups.map((g) => g.label),
]);

// Cross-layer guard: a doxa may CONTAIN a curated saying's text, but a
// normalized-EQUAL excerpt means the entry is a mislabeled saying.
const sayingTexts = new Map<string, string>();
for (const s of getSayings()) {
  sayingTexts.set(normalize(s.en), s.id);
}

// Duplicate-content guard: two doxai must never share the same normalized
// Greek or English excerpt (dup ids are caught by getDoxai(), but a
// re-curated duplicate under a fresh id would slip through every other
// check and double-count in LOD and on /doxography).
for (const field of ["grc", "en"] as const) {
  const seen = new Map<string, string>();
  for (const d of doxai) {
    const value = d[field];
    if (!value) continue;
    const key = normalize(value);
    const prior = seen.get(key);
    if (prior) {
      errors.push(`${d.id}: duplicate ${field} excerpt (same as ${prior})`);
    } else {
      seen.set(key, d.id);
    }
  }
}

for (const d of doxai) {
  const sectionId = doxaSectionIdFor(d.ref, d.philosopher);
  if (!sectionId) {
    errors.push(`${d.id}: ref ${d.ref} resolves to no corpus section`);
    continue;
  }
  const section = sectionById.get(sectionId);
  if (!section) {
    errors.push(`${d.id}: section ${sectionId} not in corpus`);
    continue;
  }
  if (!section.textEn) {
    errors.push(`${d.id}: section ${sectionId} has no English text`);
    continue;
  }
  enChecked += 1;
  if (!normalize(section.textEn).includes(normalize(d.en))) {
    errors.push(
      `${d.id}: English not a verbatim excerpt of ${d.ref} (${sectionId})\n` +
        `      en: ${d.en.slice(0, 90)}`,
    );
  }
  const sayingId = sayingTexts.get(normalize(d.en));
  if (sayingId) {
    errors.push(
      `${d.id}: English excerpt equals saying "${sayingId}" — ` +
        `a doxa must not duplicate the sayings layer`,
    );
  }
  // Attribution: the tenet's holder must own the chapter the excerpt sits
  // in, unless explicitly flagged as cross-attributed (D.L. records the
  // tenet inside another philosopher's life, e.g. a school summary).
  if (!d.crossAttributed && section.philosopher !== d.philosopher) {
    errors.push(
      `${d.id}: attributed to "${d.philosopher}" but ${d.ref} (${sectionId}) ` +
        `is in the life of "${section.philosopher}" ` +
        `(set crossAttributed: true if intentional)`,
    );
  }
  // Greek, when curated, must likewise be a verbatim excerpt — of the
  // grcRef section when one is set (Greek/English section-boundary
  // mismatch), otherwise of the ref section.
  if (d.grc) {
    grcChecked += 1;
    const grcRef = d.grcRef ?? d.ref;
    const grcSectionId = doxaSectionIdFor(grcRef, d.philosopher);
    const grcSection = grcSectionId ? sectionById.get(grcSectionId) : undefined;
    if (!grcSectionId || !grcSection) {
      errors.push(`${d.id}: grcRef ${grcRef} resolves to no corpus section`);
    } else if (
      !normalizeGreek(grcSection.text).includes(normalizeGreek(d.grc))
    ) {
      errors.push(
        `${d.id}: Greek not a verbatim excerpt of ${grcRef} (${grcSectionId})\n` +
          `      grc: ${d.grc.slice(0, 60)}`,
      );
    }
  }
  if (d.accordingTo && !knownAuthorities.has(d.accordingTo)) {
    errors.push(
      `${d.id}: accordingTo "${d.accordingTo}" is not an existing authority ` +
        `— it would mint a new lo:Source node and shift the pinned tagging ` +
        `layers; record it in \`note\` instead`,
    );
  }
  // Doctrine link: only labels the graph already knows.
  if (d.doctrine && !knownDoctrines.has(d.doctrine)) {
    errors.push(
      `${d.id}: doctrine "${d.doctrine}" is not an existing doctrine node ` +
        `(claim doctrines + school doctrines); the doxography layer mints nothing`,
    );
  }
}

// Positive control: the Greek excerpt-vs-section check above is only
// meaningful if it actually ran against curated excerpts. If no doxa
// carries grc, the check is vacuous — fail loudly instead of passing
// (mirrors the grcChecked guard in validate-claims.ts).
if (grcChecked === 0) {
  errors.push(
    "GREEK EXCERPT CHECK VACUOUS: no doxa has a grc excerpt (positive control failed)",
  );
}

// Same positive control for the English verbatim check: if the loader ever
// returned an empty list or no en excerpt was actually compared against a
// corpus section, the check above passed vacuously — fail loudly instead.
if (enChecked === 0) {
  errors.push(
    "ENGLISH EXCERPT CHECK VACUOUS: no doxa's en excerpt was compared against a corpus section (positive control failed)",
  );
}

if (errors.length > 0) {
  console.error(`INVALID DOXAI (${errors.length}):`);
  for (const e of errors) console.error("  " + e);
  process.exit(1);
}

// Ambiguous-ref resolution pin: Hicks numbering restarts across chapter
// boundaries, so a bare book.section ref can belong to several chapters
// (e.g. 7.160 ends Zeno's doxography AND opens Ariston of Chios' life).
// doxaSectionIdFor must pick the section owned by the doxa's philosopher,
// never the first match; the sibling first-match regression in the claims
// layer once silently approved 16 misquoted Greek excerpts. Each pin below
// names a doxa on an ambiguous key and the section its philosopher owns,
// and EVERY doxa ref/grcRef landing on an ambiguous key must be pinned, so
// a new entry on such a key cannot slip in unpinned.
const ambiguousDoxaPins: {
  doxaId: string;
  field: "ref" | "grcRef";
  expected: string;
}[] = [
  {
    doxaId: "ariston-chios-telos-indifference",
    field: "ref",
    expected: "7.2.160",
  },
  {
    doxaId: "ariston-chios-ethics-alone-concerns-us",
    field: "ref",
    expected: "7.2.160",
  },
  {
    doxaId: "dionysius-renegade-telos-pleasure",
    field: "ref",
    expected: "7.4.166",
  },
];
// Recompute the ambiguous keys from the corpus itself (same key derivation
// as doxaSectionIdFor) so a corpus re-parse that creates a new clash is
// caught here, not just in validate-ambiguous-refs.
const refKeyCounts = new Map<string, number>();
for (const s of corpus) {
  const parts = s.id.split(".");
  const key = `${parts[0]}.${parts[parts.length - 1]}`;
  refKeyCounts.set(key, (refKeyCounts.get(key) ?? 0) + 1);
}
const isAmbiguousKey = (ref: string) => (refKeyCounts.get(ref) ?? 0) > 1;
const badAmbiguous: string[] = [];
const doxaById = new Map(doxai.map((d) => [d.id, d]));
const pinnedFields = new Set(
  ambiguousDoxaPins.map((p) => `${p.doxaId}\u0000${p.field}`),
);
for (const pin of ambiguousDoxaPins) {
  const d = doxaById.get(pin.doxaId);
  if (!d) {
    badAmbiguous.push(
      `${pin.doxaId}: pinned doxa no longer exists - if it was removed on ` +
        `purpose, delete its pin (and keep at least one pin per ambiguous ` +
        `key that still has doxai)`,
    );
    continue;
  }
  const ref = pin.field === "grcRef" ? d.grcRef : d.ref;
  if (!ref) {
    badAmbiguous.push(`${pin.doxaId}: pinned field ${pin.field} is not set`);
    continue;
  }
  if (!isAmbiguousKey(ref)) {
    badAmbiguous.push(
      `${pin.doxaId}: pinned ${pin.field} ${ref} is no longer ambiguous in ` +
        `the corpus - review the pin`,
    );
    continue;
  }
  const actual = doxaSectionIdFor(ref, d.philosopher);
  if (actual !== pin.expected) {
    badAmbiguous.push(
      `${pin.doxaId}: ${pin.field} ${ref} (philosopher ${d.philosopher}) ` +
        `resolved to ${actual ?? "no section"}, expected ${pin.expected}`,
    );
  }
}
// Coverage: no doxa may sit on an ambiguous key without a pin.
let ambiguousHits = 0;
for (const d of doxai) {
  const fields: ["ref" | "grcRef", string | undefined][] = [
    ["ref", d.ref],
    ["grcRef", d.grcRef],
  ];
  for (const [field, ref] of fields) {
    if (!ref || !isAmbiguousKey(ref)) continue;
    ambiguousHits += 1;
    if (!pinnedFields.has(`${d.id}\u0000${field}`)) {
      badAmbiguous.push(
        `${d.id}: ${field} ${ref} lands on an ambiguous key but has no ` +
          `resolution pin - add it to ambiguousDoxaPins with the section ` +
          `its philosopher owns`,
      );
    }
  }
}
// Positive control: if no doxa hits any ambiguous key the guard is
// vacuous - the pins (and this block) should then be removed consciously,
// not silently skipped.
if (ambiguousHits === 0) {
  badAmbiguous.push(
    "no doxa ref/grcRef lands on any ambiguous key: the ambiguous-ref pin " +
      "guard is vacuous - review ambiguousDoxaPins",
  );
}
if (badAmbiguous.length > 0) {
  console.error(
    `AMBIGUOUS REF RESOLUTION REGRESSION (${badAmbiguous.length}): ` +
      "doxaSectionIdFor must resolve to the philosopher-owned section, " +
      "not first-match",
  );
  for (const b of badAmbiguous) console.error("  " + b);
  process.exit(1);
}

const byBook = new Map<number, number>();
const byPhilosopher = new Map<string, number>();
const byCertainty = new Map<string, number>();
const byDomain = new Map<string, number>();
let withGrc = 0;
let withSource = 0;
let withDoctrine = 0;
for (const d of doxai) {
  const book = Number(d.ref.split(".")[0]);
  byBook.set(book, (byBook.get(book) ?? 0) + 1);
  byPhilosopher.set(d.philosopher, (byPhilosopher.get(d.philosopher) ?? 0) + 1);
  byCertainty.set(d.certainty, (byCertainty.get(d.certainty) ?? 0) + 1);
  byDomain.set(d.domain, (byDomain.get(d.domain) ?? 0) + 1);
  if (d.grc) withGrc += 1;
  if (d.accordingTo) withSource += 1;
  if (d.doctrine) withDoctrine += 1;
}

const books = [...byBook.entries()]
  .sort((a, b) => a[0] - b[0])
  .map(([b, n]) => `b${b}:${n}`)
  .join(" ");
const certainties = [...byCertainty.entries()]
  .map(([c, n]) => `${c}:${n}`)
  .join(" ");
const domains = [...byDomain.entries()]
  .sort((a, b) => b[1] - a[1])
  .map(([t, n]) => `${t}:${n}`)
  .join(" ");

console.log(
  `OK: ${doxai.length} doxai across ${byPhilosopher.size} philosophers, ` +
    `${withGrc} with Greek, ${withSource} with a named source, ` +
    `${withDoctrine} linked to a doctrine node`,
);
console.log(`    books: ${books}`);
console.log(`    domains: ${domains}`);
console.log(`    certainty: ${certainties}`);
