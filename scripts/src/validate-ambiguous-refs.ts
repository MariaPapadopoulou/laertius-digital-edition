/**
 * Pins the corpus's ambiguous bare-ref keys and guards every curated
 * layer against silently landing on one.
 *
 * Hicks numbering restarts across chapter boundaries, so a bare
 * book.section ref is occasionally shared by two or three chapters
 * (e.g. 2.124 belongs to Simon, Glaucon AND Simmias). sectionIdForRef /
 * doxaSectionIdFor resolve owner-aware but fall back to first-match when
 * the subject owns no candidate; that fallback must never be taken
 * silently. Two checks:
 *
 * 1. The full set of ambiguous keys (and their candidate section ids)
 *    is pinned. A corpus re-parse that adds or removes an ambiguous key
 *    fails here so the new key can be reviewed against every layer.
 * 2. Every curated entry (claims, sayings, anecdotes, doxai) whose ref,
 *    grcRef or toRef hits an ambiguous key must have a subject
 *    that owns one of the candidate sections, so resolution is
 *    deterministic and never first-match. crossAttributed entries are
 *    NOT exempt: their subject owns no candidate by design, which is
 *    exactly the silent-fallback case, so an ambiguous ref there must
 *    be flagged and re-curated to an unambiguous ref.
 * 3. The remaining ref-bearing layers are scanned too:
 *    - bare-ref layers with a natural owner (founder links, chronology,
 *      work transmission - whose owner is the subject of the claim the
 *      entry derives from) get the same subject-ownership check;
 *    - bare-ref layers with NO natural owner (school members,
 *      succession links, alt titles, school doctrines) have no subject
 *      to disambiguate with, so any ref of theirs on an ambiguous key
 *      must be explicitly reviewed and pinned in REVIEWED_SUBJECTLESS
 *      with the section id the curator resolved it to;
 *    - full-section-id layers (verses, testaments) resolve
 *      deterministically by
 *      construction, but a full id whose bare key is ambiguous must
 *      still name a real candidate section, and where the layer has an
 *      owner (verses) the candidate's philosopher must match it, so a
 *      re-parse cannot silently re-home the entry;
 *    - epistles carry full section ids but NO owning subject (the
 *      sender may have no Life of his own), so their hits on ambiguous
 *      keys get the reviewed Life-pin treatment (REVIEWED_SCOPE_LIVES)
 *      instead, like the curated tag scopes below;
 *    - curated tag scopes (built gazetteer onlySections - covering the
 *      curated scoped entries in gazetteer.ts and anything that flows
 *      into it - plus person-mentions.ts onlySections scopes,
 *      source-mentions.ts bare refs and place-mentions.ts)
 *      get the same treatment: full ids must stay live candidates,
 *      subjectless bare refs on ambiguous keys must be reviewed, and
 *      per-layer scanned-id counts guard against vacuity.
 *
 * Positive control: the run fails if no curated entry hits any
 * ambiguous key at all (the scan would be vacuously green).
 *
 * Run from the workspace root:
 *   pnpm --filter @workspace/scripts run validate-ambiguous-refs
 */
import path from "node:path";

process.env["LAERTIUS_DATA_DIR"] ??= path.resolve(
  import.meta.dirname,
  "../../artifacts/api-server/data",
);

const { corpus } = await import("../../artifacts/api-server/src/lib/corpus");
const { getClaims } = await import(
  "../../artifacts/api-server/src/lib/kg-claims"
);
const { getSayings } = await import(
  "../../artifacts/api-server/src/lib/sayings"
);
const { getAnecdotes } = await import(
  "../../artifacts/api-server/src/lib/anecdotes"
);
const { getDoxai } = await import("../../artifacts/api-server/src/lib/doxai");
const { verses } = await import("../../artifacts/api-server/src/lib/verses");
const { getEpistles } = await import(
  "../../artifacts/api-server/src/lib/epistles"
);
const { getTestaments } = await import(
  "../../artifacts/api-server/src/lib/testaments"
);
const { SCHOOL_MEMBERS } = await import(
  "../../artifacts/api-server/src/lib/school-members"
);
const { SUCCESSION_LINKS } = await import(
  "../../artifacts/api-server/src/lib/succession-links"
);
const { MENTION_PERSONS } = await import(
  "../../artifacts/api-server/src/lib/person-mentions"
);
const { getOntologyExtras } = await import(
  "../../artifacts/api-server/src/lib/kg-ontology"
);
const { SOURCE_MENTIONS } = await import(
  "../../artifacts/api-server/src/lib/source-mentions"
);
const { MENTION_PLACES } = await import(
  "../../artifacts/api-server/src/lib/place-mentions"
);
const { getGazetteer } = await import(
  "../../artifacts/api-server/src/lib/gazetteer"
);

// ---------------------------------------------------------------------------
// 1. Pin the ambiguity set derived from the corpus.
// ---------------------------------------------------------------------------
// key -> candidate section ids in reading order, exactly as
// sectionIdForRef builds them. Any drift (new ambiguous key, dropped
// key, changed candidates) means the corpus numbering changed and every
// curated layer's refs must be re-reviewed against the new set.
const PINNED: Record<string, string[]> = {
  "2.124": ["2.13.124", "2.14.124", "2.15.124"], // Simon, Glaucon, Simmias
  "2.125": ["2.16.125", "2.17.125"], // Cebes, Menedemus of Eretria
  "7.160": ["7.1.160", "7.2.160"], // Zeno of Citium, Ariston of Chios
  "7.166": ["7.3.166", "7.4.166"], // Herillus, Dionysius the Renegade
  "8.83": ["8.4.83", "8.5.83"], // Archytas, Alcmaeon
  "8.84": ["8.6.84", "8.7.84"], // Hippasus, Philolaus
};

const candidatesByKey = new Map<string, { id: string; philosopher: string }[]>();
for (const s of corpus) {
  const parts = s.id.split(".");
  const key = `${parts[0]}.${parts[parts.length - 1]}`;
  let list = candidatesByKey.get(key);
  if (!list) {
    list = [];
    candidatesByKey.set(key, list);
  }
  list.push({ id: s.id, philosopher: s.philosopher });
}

const actualAmbiguous = new Map(
  [...candidatesByKey.entries()].filter(([, v]) => v.length > 1),
);

const setDrift: string[] = [];
for (const [key, ids] of Object.entries(PINNED)) {
  const actual = actualAmbiguous.get(key);
  if (!actual) {
    setDrift.push(`${key}: pinned as ambiguous but corpus no longer has it`);
    continue;
  }
  const actualIds = actual.map((c) => c.id);
  if (actualIds.join("|") !== ids.join("|")) {
    setDrift.push(
      `${key}: candidates changed, pinned [${ids.join(", ")}] vs ` +
        `corpus [${actualIds.join(", ")}]`,
    );
  }
}
for (const [key, cands] of actualAmbiguous) {
  if (!(key in PINNED)) {
    setDrift.push(
      `${key}: NEW ambiguous key not in the pin ` +
        `(${cands.map((c) => `${c.id} ${c.philosopher}`).join(", ")}); ` +
        "review every curated ref hitting it, then extend the pin",
    );
  }
}
if (setDrift.length > 0) {
  console.error(`AMBIGUOUS KEY SET DRIFT (${setDrift.length}):`);
  for (const d of setDrift) console.error("  " + d);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// 2. Every curated entry on an ambiguous key must own a candidate.
// ---------------------------------------------------------------------------
interface Hit {
  layer: string;
  id: string;
  subject: string;
  refField: string;
  ref: string;
  crossAttributed: boolean;
}

const hits: Hit[] = [];
function scan(
  layer: string,
  entries: {
    id: string;
    subject: string;
    refs: [string, string | undefined][];
    crossAttributed?: boolean;
  }[],
) {
  for (const e of entries) {
    for (const [refField, ref] of e.refs) {
      if (!ref || !actualAmbiguous.has(ref)) continue;
      hits.push({
        layer,
        id: e.id,
        subject: e.subject,
        refField,
        ref,
        crossAttributed: e.crossAttributed ?? false,
      });
    }
  }
}

scan(
  "claim",
  getClaims().map((c) => ({
    id: c.id,
    subject: c.subject,
    refs: [["ref", c.ref]],
  })),
);
scan(
  "saying",
  getSayings().map((s) => ({
    id: s.id,
    subject: s.philosopher,
    refs: [
      ["ref", s.ref],
      ["grcRef", s.grcRef],
      ["toRef", s.toRef],
    ],
    crossAttributed: s.crossAttributed,
  })),
);
scan(
  "anecdote",
  getAnecdotes().map((a) => ({
    id: a.id,
    subject: a.philosopher,
    refs: [
      ["ref", a.ref],
      ["grcRef", a.grcRef],
    ],
    crossAttributed: a.crossAttributed,
  })),
);
scan(
  "doxa",
  getDoxai().map((d) => ({
    id: d.id,
    subject: d.philosopher,
    refs: [
      ["ref", d.ref],
      ["grcRef", d.grcRef],
    ],
    crossAttributed: d.crossAttributed,
  })),
);

// Bare-ref layers with a natural owner. Founder links and chronology
// name their philosopher directly; work-transmission entries derive
// from claims, so the owning subject is recovered by matching the
// (work, ref) pair back onto the claims layer.
const extras = getOntologyExtras();
scan(
  "founderLink",
  extras.founderLinks
    .filter((f) => f.ref !== undefined)
    .map((f) => ({
      id: `${f.philosopher}->${f.school}`,
      subject: f.philosopher,
      refs: [["ref", f.ref]],
    })),
);
scan(
  "chronology",
  extras.chronology.map((c) => ({
    id: c.philosopher,
    subject: c.philosopher,
    refs: c.refs.map((r, i) => [`refs[${i}]`, r] as [string, string]),
  })),
);
const claimSubjectByWorkRef = new Map<string, string>();
for (const c of getClaims()) {
  claimSubjectByWorkRef.set(`${c.value}\u0001${c.ref}`, c.subject);
}
scan(
  "workTransmission",
  extras.workTransmission.map((w) => ({
    id: `${w.work} (${w.status})`,
    subject:
      claimSubjectByWorkRef.get(`${w.work}\u0001${w.ref}`) ??
      "<no source claim found>",
    refs: [["ref", w.ref]],
  })),
);

// ---------------------------------------------------------------------------
// 3a. Bare-ref layers with NO natural owner: any ref on an ambiguous
// key must be explicitly reviewed and pinned here with the section id
// the curator resolved it to (and that id must be a live candidate).
// ---------------------------------------------------------------------------
// key: `${layer} ${id} ${ref}` -> reviewed candidate section id.
const REVIEWED_SUBJECTLESS: Record<string, string> = {
  // (none today - school members, succession links, alt titles and
  // school doctrines currently cite no ambiguous key)
};

const subjectlessCounts = new Map<string, number>();
const subjectlessProblems: string[] = [];
function scanSubjectless(
  layer: string,
  entries: { id: string; refs: [string, string | undefined][] }[],
) {
  subjectlessCounts.set(layer, 0);
  for (const e of entries) {
    for (const [refField, ref] of e.refs) {
      if (!ref || !actualAmbiguous.has(ref)) continue;
      subjectlessCounts.set(layer, subjectlessCounts.get(layer)! + 1);
      const cands = actualAmbiguous.get(ref)!;
      const reviewed = REVIEWED_SUBJECTLESS[`${layer} ${e.id} ${ref}`];
      if (reviewed === undefined) {
        subjectlessProblems.push(
          `${layer} ${e.id} (${refField} ${ref}): subjectless ref on an ` +
            `ambiguous key, candidates [${cands.map((c) => `${c.id} ${c.philosopher}`).join(", ")}]; ` +
            "review which section is meant and pin it in REVIEWED_SUBJECTLESS",
        );
      } else if (!cands.some((c) => c.id === reviewed)) {
        subjectlessProblems.push(
          `${layer} ${e.id} (${refField} ${ref}): pinned resolution ` +
            `"${reviewed}" is not among the live candidates ` +
            `[${cands.map((c) => c.id).join(", ")}]`,
        );
      }
    }
  }
}

scanSubjectless(
  "schoolMember",
  SCHOOL_MEMBERS.map((m) => ({
    id: `${m.label}@${m.school}`,
    refs: [["ref", m.ref]],
  })),
);
scanSubjectless(
  "successionLink",
  SUCCESSION_LINKS.map((l) => ({
    id: `${l.teacher.label}->${l.pupil.label}`,
    refs: [["ref", l.ref]],
  })),
);
scanSubjectless(
  "altTitle",
  extras.altTitles.map((a) => ({ id: a.work, refs: [["ref", a.ref]] })),
);
scanSubjectless(
  "schoolDoctrine",
  extras.schoolDoctrines.map((d) => ({ id: d.school, refs: [["ref", d.ref]] })),
);

// ---------------------------------------------------------------------------
// 3b. Full-section-id layers: deterministic by construction, but the
// pinned id must stay a live candidate (and keep its owner, where the
// layer has one) across corpus re-parses.
// ---------------------------------------------------------------------------
const fullIdCounts = new Map<string, number>();
const fullIdProblems: string[] = [];
function scanFullIds(
  layer: string,
  entries: {
    id: string;
    subject?: string;
    refs: [string, string | undefined][];
  }[],
) {
  fullIdCounts.set(layer, 0);
  for (const e of entries) {
    for (const [refField, sectionId] of e.refs) {
      if (!sectionId) continue;
      const parts = sectionId.split(".");
      if (parts.length < 3) continue; // not a full section id
      const key = `${parts[0]}.${parts[parts.length - 1]}`;
      if (!actualAmbiguous.has(key)) continue;
      fullIdCounts.set(layer, fullIdCounts.get(layer)! + 1);
      const cands = actualAmbiguous.get(key)!;
      const cand = cands.find((c) => c.id === sectionId);
      if (!cand) {
        fullIdProblems.push(
          `${layer} ${e.id} (${refField} ${sectionId}): full id on ambiguous ` +
            `key ${key} but not among the live candidates ` +
            `[${cands.map((c) => c.id).join(", ")}] - the corpus re-parse moved it`,
        );
      } else if (e.subject !== undefined && cand.philosopher !== e.subject) {
        fullIdProblems.push(
          `${layer} ${e.id} (${refField} ${sectionId}): candidate now belongs ` +
            `to ${cand.philosopher}, entry subject is ${e.subject} - the entry ` +
            "was silently re-homed",
        );
      }
    }
  }
}

scanFullIds(
  "verse",
  verses.map((v) => ({
    id: v.id,
    subject: v.philosopher,
    refs: [["sectionId", v.sectionId]],
  })),
);
scanFullIds(
  "testament",
  getTestaments().map((t) => ({
    id: t.id,
    subject: t.philosopher,
    refs: t.sections.map(
      (s, i) => [`sections[${i}]`, s] as [string, string],
    ),
  })),
);

// ---------------------------------------------------------------------------
// 3c. Curated tag scopes: place-mentions, source-mentions and the
// curated scoped entries in gazetteer.ts. These layers pin section
// scopes that a corpus re-parse could re-home on an ambiguous key.
//
// - gazetteer.ts curated scopes (verbatim work surfaces, mention-person
//   scopes, homonym-split scopes, Greek onlySections) all surface on the
//   built gazetteer as entries[].onlySections / greekEntries[].onlySections,
//   so the built output is scanned - it covers every curated scope
//   source, including any scope a place-mentions entry ever gains
//   (place-mentions.ts itself pins labels/coords only, no section ids;
//   its tagging scope, if any, would flow through the gazetteer).
// - source-mentions.ts pins bare book.section refs with NO owning
//   subject; a bare ref on an ambiguous key expands to EVERY candidate
//   section (sourceMentionTagEntries takes all matches), so the surface
//   would silently tag inside the wrong Life too. Such a ref must be
//   reviewed and pinned in REVIEWED_SUBJECTLESS like the other
//   subjectless layers.
// Positive controls: the raw number of section-scope ids scanned per
// layer is counted and must be non-zero, so the scan can never be
// vacuously green even while (as today) no scope hits an ambiguous key.
// ---------------------------------------------------------------------------
// Gazetteer scopes carry no owning subject, so a full id that stays a
// live candidate could still be the WRONG Life (e.g. 2.14.124 pinned
// when the surface belongs in 2.13.124). Every scoped-entry hit on an
// ambiguous key must therefore be reviewed and pinned here with the
// philosopher whose Life the scoped section belongs to; the scan fails
// if the candidate's Life no longer matches (re-parse re-homed it) or
// if a new scope hit appears unpinned.
// key: `${layer} ${entryId} ${sectionId}` -> expected philosopher.
const REVIEWED_SCOPE_LIVES: Record<string, string> = {
  // Dion of Syracuse buying the Pythagorean books at 8.84 - the
  // passage sits in Philolaus's Life (8.7), not Hippasus's (8.6).
  'gazetteerScope person Dion of Syracuse "Dion of Syracuse" 8.7.84':
    "Philolaus",
  'gazetteerScope person Dion of Syracuse "Dion" 8.7.84': "Philolaus",
  'gazetteerGreekScope person Dion of Syracuse "διωνοσ" 8.7.84': "Philolaus",
  'gazetteerGreekScope person Dion of Syracuse "διωνι" 8.7.84': "Philolaus",
  'gazetteerGreekScope person Dion of Syracuse "διωνα" 8.7.84': "Philolaus",
  'gazetteerGreekScope person Dion of Syracuse "διων" 8.7.84': "Philolaus",
  // The same Dion passage as pinned via person-mentions.ts onlySections:
  // 8.84 sits in Philolaus's Life (8.7), not Hippasus's (8.6).
  "personMention Dion of Syracuse 8.7.84": "Philolaus",
  // The bare "Heraclides" at 7.166 is Dionysius the Renegade's
  // fellow-townsman and first teacher (gazetteer.ts curated scope,
  // claims/book7.ts dionysius-teacher-heraclides) - the passage sits in
  // Dionysius the Renegade's Life (7.4), not Herillus's (7.3).
  'gazetteerScope person Heraclides of Heraclea "Heraclides" 7.4.166':
    "Dionysius the Renegade",
};

const gaz = getGazetteer();
let gazScopedIds = 0;
let gazPinnedHits = 0;
function scanGazScopes(
  layer: string,
  entries: { id: string; refs: [string, string][] }[],
) {
  fullIdCounts.set(layer, 0);
  for (const e of entries) {
    for (const [refField, sectionId] of e.refs) {
      const parts = sectionId.split(".");
      if (parts.length < 3) continue; // not a full section id
      const key = `${parts[0]}.${parts[parts.length - 1]}`;
      if (!actualAmbiguous.has(key)) continue;
      fullIdCounts.set(layer, fullIdCounts.get(layer)! + 1);
      const cands = actualAmbiguous.get(key)!;
      const cand = cands.find((c) => c.id === sectionId);
      if (!cand) {
        fullIdProblems.push(
          `${layer} ${e.id} (${refField} ${sectionId}): full id on ambiguous ` +
            `key ${key} but not among the live candidates ` +
            `[${cands.map((c) => c.id).join(", ")}] - the corpus re-parse moved it`,
        );
        continue;
      }
      const expected = REVIEWED_SCOPE_LIVES[`${layer} ${e.id} ${sectionId}`];
      if (expected === undefined) {
        fullIdProblems.push(
          `${layer} ${e.id} (${refField} ${sectionId}): scoped section on ` +
            `ambiguous key ${key} has no reviewed Life pin; candidates ` +
            `[${cands.map((c) => `${c.id} ${c.philosopher}`).join(", ")}] - ` +
            "review which Life the surface belongs to and pin it in " +
            "REVIEWED_SCOPE_LIVES",
        );
      } else if (cand.philosopher !== expected) {
        fullIdProblems.push(
          `${layer} ${e.id} (${refField} ${sectionId}): section now belongs ` +
            `to ${cand.philosopher}'s Life, but the reviewed pin expects ` +
            `${expected} - the scope was silently re-homed onto the wrong Life`,
        );
      } else {
        gazPinnedHits += 1;
      }
    }
  }
}
scanGazScopes(
  "gazetteerScope",
  gaz.entries
    .filter((e) => e.onlySections)
    .map((e) => {
      gazScopedIds += e.onlySections!.length;
      return {
        id: `${e.kind} ${e.label} "${e.surface}"`,
        refs: e.onlySections!.map(
          (s, i) => [`onlySections[${i}]`, s] as [string, string],
        ),
      };
    }),
);
scanGazScopes(
  "gazetteerGreekScope",
  gaz.greekEntries
    .filter((e) => e.onlySections)
    .map((e) => {
      gazScopedIds += e.onlySections!.length;
      return {
        id: `${e.kind} ${e.label} "${e.form}"`,
        refs: e.onlySections!.map(
          (s, i) => [`onlySections[${i}]`, s] as [string, string],
        ),
      };
    }),
);
// person-mentions.ts onlySections scopes carry no owning subject either
// (Task 692): a scoped section that stays a live candidate could still
// sit in the WRONG Life, so every hit on an ambiguous key gets the same
// reviewed Life-pin treatment as the gazetteer scopes.
let mentionScopedIds = 0;
scanGazScopes(
  "personMention",
  MENTION_PERSONS.filter((p) => p.onlySections).map((p) => {
    mentionScopedIds += p.onlySections!.length;
    return {
      id: p.label,
      refs: p.onlySections!.map(
        (s, i) => [`onlySections[${i}]`, s] as [string, string],
      ),
    };
  }),
);
// Epistles (Task 747) carry full section ids but NO owning subject
// either - the sender often has no Life of his own, and the letter can
// sit in another philosopher's Life (e.g. royal correspondence quoted
// inside the addressee's Life). A full id that stays a live candidate
// could therefore still be re-homed into the WRONG Life by a corpus
// re-parse, so every epistle hit on an ambiguous key gets the same
// reviewed Life-pin treatment (key: `epistle ${id} ${sectionId}` in
// REVIEWED_SCOPE_LIVES).
let epistleRefIds = 0;
scanGazScopes(
  "epistle",
  getEpistles().map((e) => {
    const refs = (
      [
        ["ref", e.ref],
        ["grcRef", e.grcRef],
        ["toRef", e.toRef],
      ] as [string, string | undefined][]
    ).filter((r): r is [string, string] => r[1] !== undefined);
    epistleRefIds += refs.length;
    return { id: e.id, refs };
  }),
);
if (epistleRefIds === 0) {
  console.error(
    "EPISTLE SCOPE SCAN VACUOUS: the epistle layer exposes no section " +
      "refs at all (positive control failed - the epistles were not seen)",
  );
  process.exit(1);
}
if (mentionScopedIds === 0) {
  console.error(
    "PERSON-MENTION SCOPE SCAN VACUOUS: MENTION_PERSONS exposes no " +
      "onlySections scopes at all (positive control failed - the scoped " +
      "person-mention entries were not seen)",
  );
  process.exit(1);
}

// Positive control for the pin table itself: every reviewed pin must
// have matched a live scoped hit, and (while pins exist) at least one
// hit must have been checked against a pin - otherwise renamed
// surfaces/labels would silently orphan the pins and the Life check
// would stop firing.
const pinCount = Object.keys(REVIEWED_SCOPE_LIVES).length;
if (pinCount > 0 && gazPinnedHits === 0 && fullIdProblems.length === 0) {
  console.error(
    "GAZETTEER SCOPE LIFE-PIN SCAN VACUOUS: REVIEWED_SCOPE_LIVES has " +
      `${pinCount} pins but no scoped hit matched any of them ` +
      "(positive control failed - the pins are orphaned)",
  );
  process.exit(1);
}
if (gazPinnedHits !== pinCount) {
  const seen = new Set<string>();
  for (const [tag, list] of [
    ["gazetteerScope", gaz.entries],
    ["gazetteerGreekScope", gaz.greekEntries],
  ] as const) {
    for (const e of list) {
      const id =
        tag === "gazetteerScope"
          ? `${e.kind} ${e.label} "${(e as { surface?: string }).surface}"`
          : `${e.kind} ${e.label} "${(e as { form?: string }).form}"`;
      for (const s of e.onlySections ?? []) seen.add(`${tag} ${id} ${s}`);
    }
  }
  for (const p of MENTION_PERSONS) {
    for (const s of p.onlySections ?? [])
      seen.add(`personMention ${p.label} ${s}`);
  }
  for (const e of getEpistles()) {
    for (const s of [e.ref, e.grcRef, e.toRef]) {
      if (s !== undefined) seen.add(`epistle ${e.id} ${s}`);
    }
  }
  const orphans = Object.keys(REVIEWED_SCOPE_LIVES).filter(
    (k) => !seen.has(k),
  );
  if (orphans.length > 0) {
    console.error(
      `GAZETTEER SCOPE LIFE-PIN ORPHANS (${orphans.length}): pins that no ` +
        "longer match any scoped entry (surface renamed or scope dropped); " +
        "update or remove them:",
    );
    for (const o of orphans) console.error("  " + o);
    process.exit(1);
  }
}
if (gazScopedIds === 0) {
  console.error(
    "GAZETTEER SCOPE SCAN VACUOUS: the built gazetteer exposes no curated " +
      "section scopes at all (positive control failed - the curated scoped " +
      "entries were not seen)",
  );
  process.exit(1);
}

let sourceMentionRefIds = 0;
scanSubjectless(
  "sourceMentionRef",
  SOURCE_MENTIONS.flatMap((m) => [
    ...m.surfaces.map((sf) => {
      sourceMentionRefIds += sf.refs.length;
      return {
        id: `${m.label} "${sf.surface}"`,
        refs: sf.refs.map(
          (r, i) => [`refs[${i}]`, r] as [string, string],
        ),
      };
    }),
    ...(m.grcRefs
      ? [
          {
            id: `${m.label} (Greek)`,
            refs: m.grcRefs.map((r, i) => {
              sourceMentionRefIds += 1;
              return [`grcRefs[${i}]`, r] as [string, string];
            }),
          },
        ]
      : []),
  ]),
);
if (sourceMentionRefIds === 0) {
  console.error(
    "SOURCE-MENTION SCOPE SCAN VACUOUS: no curated source-mention refs " +
      "were seen (positive control failed)",
  );
  process.exit(1);
}

// place-mentions.ts sanity: the layer must stay section-scope-free (its
// entries tag corpus-wide by label). If a scope field ever appears there
// it must flow through the gazetteer scan above; this guard fails loudly
// if an entry starts carrying section ids directly.
let placeScopeLeaks = 0;
for (const p of MENTION_PLACES as unknown as Record<string, unknown>[]) {
  for (const [k, v] of Object.entries(p)) {
    const vals = Array.isArray(v) ? v : [v];
    for (const val of vals) {
      if (typeof val === "string" && /^\d+\.[^.]+\.\d+$/.test(val)) {
        placeScopeLeaks += 1;
        fullIdProblems.push(
          `placeMention ${String(p["label"])}: field "${k}" carries a ` +
            `section id "${val}" that the ambiguity scan does not cover; ` +
            "route the scope through the gazetteer or extend this validator",
        );
      }
    }
  }
}
if (MENTION_PLACES.length === 0) {
  console.error(
    "PLACE-MENTION SCAN VACUOUS: MENTION_PLACES is empty (positive control " +
      "failed)",
  );
  process.exit(1);
}

if (subjectlessProblems.length > 0 || fullIdProblems.length > 0) {
  const all = [...subjectlessProblems, ...fullIdProblems];
  console.error(`AMBIGUOUS REFS IN EXTENDED LAYERS (${all.length}):`);
  for (const p of all) console.error("  " + p);
  process.exit(1);
}

const unowned: string[] = [];
for (const h of hits) {
  const cands = actualAmbiguous.get(h.ref)!;
  const owns = cands.some((c) => c.philosopher === h.subject);
  if (!owns) {
    unowned.push(
      `${h.layer} ${h.id} (${h.refField} ${h.ref}, subject ${h.subject}` +
        `${h.crossAttributed ? ", crossAttributed" : ""}): subject owns no ` +
        `candidate among [${cands.map((c) => `${c.id} ${c.philosopher}`).join(", ")}], ` +
        "resolution would silently fall back to first-match; " +
        "re-curate to an unambiguous ref or fix the subject",
    );
  }
}
if (unowned.length > 0) {
  console.error(`AMBIGUOUS REFS WITHOUT SUBJECT OWNERSHIP (${unowned.length}):`);
  for (const u of unowned) console.error("  " + u);
  process.exit(1);
}

if (hits.length === 0) {
  console.error(
    "AMBIGUOUS REF SCAN VACUOUS: no curated entry hits any ambiguous key " +
      "(positive control failed - the scan matched nothing)",
  );
  process.exit(1);
}

const byLayer = new Map<string, number>();
for (const h of hits) byLayer.set(h.layer, (byLayer.get(h.layer) ?? 0) + 1);
const extendedTotal =
  [...subjectlessCounts.values()].reduce((a, b) => a + b, 0) +
  [...fullIdCounts.values()].reduce((a, b) => a + b, 0) +
  (byLayer.get("founderLink") ?? 0) +
  (byLayer.get("chronology") ?? 0) +
  (byLayer.get("workTransmission") ?? 0);
if (extendedTotal === 0) {
  console.error(
    "EXTENDED LAYER SCAN VACUOUS: no entry in the extended layers hits any " +
      "ambiguous key (positive control failed - the scan matched nothing)",
  );
  process.exit(1);
}
console.log(
  `OK: ${actualAmbiguous.size} ambiguous keys pinned, ${hits.length} curated ` +
    `refs on ambiguous keys all subject-owned (` +
    [...byLayer.entries()].map(([l, n]) => `${n} ${l}`).join(", ") +
    `); ${extendedTotal} hits across the extended layers (` +
    [...subjectlessCounts.entries(), ...fullIdCounts.entries()]
      .map(([l, n]) => `${n} ${l}`)
      .join(", ") +
    `); tag-scope positive controls: ${gazScopedIds} gazetteer scoped ` +
    `section ids + ${mentionScopedIds} person-mention scoped section ids ` +
    `(${gazPinnedHits}/${pinCount} reviewed Life pins matched), ` +
    `${sourceMentionRefIds} source-mention refs, ` +
    `${MENTION_PLACES.length} place-mention entries scanned ` +
    `(${placeScopeLeaks} direct section-id leaks)`,
);
