/**
 * Linked open data serialization of the knowledge graph:
 * JSON-LD, Turtle and RDF/XML, plus an OWL ontology.
 * Base URI is configurable so the identifiers are dereferenceable on the
 * final host (humanisticadigitalia.eu).
 *
 * Two layers of data are serialized:
 * - the succession graph (kg.ts): philosophers, schools, teacher/influence
 *   relations, each reified with its D.L. citation;
 * - the claims layer (kg-claims.ts): cited, certainty-tagged claims
 *   (biography, works, doctrines, opinions) with named sources and
 *   conflictsWith links between alternative reports. Only claims D.L.
 *   asserts in his own voice are also emitted as direct triples; hedged
 *   ("reported") and disputed claims exist only as lo:Claim reifications,
 *   so consumers cannot mistake them for settled facts;
 * - the sayings layer (sayings.ts): curated apophthegms, each reified as a
 *   lo:Saying (speaker, Hicks English text, Greek when curated, topic,
 *   gloss, certainty, named source, D.L. citation + CTS URN). As with
 *   claims, only sayings D.L. asserts in his own voice also appear as
 *   direct lo:said triples on their speakers;
 * - the verse layer (verses.ts): the poems, epigrams, oracles and epitaphs
 *   quoted in the Lives, each a lo:Verse with the Greek (and aligned Hicks
 *   English when available), a link to the philosopher in whose Life it is
 *   quoted, the editorial source label when one is recorded (e.g.
 *   "Anth. Pal. vii. 615."), and an exact CTS URN from the verse's section.
 */
import { Parser as N3Parser, Writer as N3Writer, DataFactory, type Quad } from "n3";
// Deferred cycle (lod -> annotate -> gazetteer -> lod): safe because both
// sides only call each other inside functions, never at module top level.
import { annotateSection } from "./annotate";
import {
  getKnowledgeGraph,
  slugify,
  PHILOSOPHER_META,
  type KgEdge,
  type MovementId,
} from "./kg";
import {
  getClaims,
  getClaimEntities,
  unicodeSlug,
  type KgClaim,
  type ClaimProperty,
  type Certainty,
} from "./kg-claims";
import { getOntologyExtras } from "./kg-ontology";
import {
  ALIGNMENT_PREFIXES,
  alignmentsAsTurtle,
  CONCEPT_MAPPINGS,
} from "./ontology-alignments";
import { getSayings } from "./sayings";
import { getAnecdotes } from "./anecdotes";
import { getDoxai, doxaSectionIdFor } from "./doxai";
import {
  SOURCE_MENTION_LABELS,
  sourceMentionHicksNames,
} from "./source-mentions";
import {
  getEpistles,
  refForDisplay as epistleRefForDisplay,
  type EpistleAuthenticity,
} from "./epistles";
import { getTestaments, testamentRefForDisplay } from "./testaments";
import { verses, type Verse } from "./verses";
import { VERSE_AUTHORS } from "./verse-authors";
import { sectionIdForRef, sectionIdsForRef } from "./claims-answer";
import { corpus, sectionById } from "./corpus";
import { ENTITY_QIDS, PLACE_QIDS, WORK_ENWIKI, WORK_QIDS } from "./entity-links";
import { PHILOSOPHY_PAGES } from "./philosophy-pages";
import { PLACE_CLASS, PLACE_LOCATED_IN, PLACE_TYPES } from "./place-ontology";
import {
  PERSON_ROLES,
  PHILOSOPHER_EXTRA_ROLES,
  PERSON_ROLE_INDIVIDUAL,
  PERSON_ROLE_LABEL,
  type PersonRole,
} from "./person-ontology";
import {
  WORK_FACETS,
  TOPIC_PHILOSOPHICAL,
  WORK_FORM_INDIVIDUAL,
  WORK_FORM_LABEL,
  WORK_SURVIVAL_INDIVIDUAL,
  WORK_SURVIVAL_LABEL,
  WORK_TOPIC_INDIVIDUAL,
  WORK_TOPIC_LABEL,
  AUTHOR_PRODUCTION_CENTURY,
  WORK_CENTURY_OVERRIDES,
  WORK_DECADES,
  centuryOfYear,
  type WorkForm,
  type WorkSurvival,
  type WorkTopic,
} from "./work-ontology";
import { PLACE_PLEIADES, pleiadesUri } from "./place-pleiades";
import { greekNameSpec, greekWorkTitleSpec } from "./greek-names";
import { MENTION_PLACES } from "./place-mentions";
import { MENTION_PERSONS } from "./person-mentions";
import { SCHOOL_MEMBERS } from "./school-members";
import {
  SUCCESSION_LINKS,
  type SuccessionEndpoint,
} from "./succession-links";
import { SOURCE_WORKS } from "./source-works";
import { PERSON_WORKS } from "./person-works";
import {
  getSourcesIndex,
  type SourcePersonGroup,
  type SourceCitationRow,
} from "./sources-index";
import {
  chapterSubjectClasses,
  chapterSubjectConcepts,
  chapterLabel,
  assertDualSages,
} from "./chapter-subjects";

/**
 * DECISION: the site itself moved to https://laertius.humanisticadigitalia.eu,
 * but the linked-data identifiers deliberately stay on the original
 * path-based base — LOD URIs are stable identifiers, and renaming them
 * would orphan every export consumers already hold. The live host must
 * keep dereferencing (or redirecting) the legacy URIs; check-live-ionos
 * probes that, and the IONOS bundle smoke test pins this default against
 * scripts/src/laertius-live-site.ts LAERTIUS_LOD_BASE so silent drift in
 * either direction fails loudly.
 */
export const LOD_BASE =
  process.env["LOD_BASE_URI"] ?? "https://humanisticadigitalia.eu/Laertius";

export const ONT = `${LOD_BASE}/ontology#`;

function philosopherUri(name: string): string {
  return `${LOD_BASE}/philosopher/${slugify(name)}`;
}

/** One lo:Chapter node per Life of the corpus (book.chapter is unique). */
function chapterUri(book: number, chapter: string): string {
  return `${LOD_BASE}/chapter/${book}.${chapter}`;
}

/** Chapter numbers come from the corpus as strings; the LOD emits integers. */
function chapterNumberOf(n: { name: string; book: number; chapter: string }): number {
  const num = Number(n.chapter);
  if (!Number.isInteger(num)) {
    throw new Error(
      `lod: chapter "${n.chapter}" of ${n.name} (Book ${n.book}) is not an integer`,
    );
  }
  return num;
}

function schoolUri(movementId: string): string {
  return `${LOD_BASE}/school/${movementId}`;
}

/** School named as a claim value (raw label, distinct from movement ids). */
function claimSchoolUri(label: string): string {
  return `${LOD_BASE}/school/${unicodeSlug(label)}`;
}

export function placeUri(name: string): string {
  return `${LOD_BASE}/place/${unicodeSlug(name)}`;
}

/**
 * Claim-value places plus the curated mention-only places
 * (place-mentions.ts). Both mint identical lo:Place nodes - the
 * distinction (life-event place vs. merely mentioned) stays derivable
 * from the presence or absence of claim triples, never encoded in the
 * TBox. Mention places feed the gazetteer, the occurrence tagger, the
 * entities index and the map's "mentioned" layer automatically.
 */
function allPlaces(claimPlaces: string[]): string[] {
  return [...claimPlaces, ...MENTION_PLACES.map((m) => m.label)];
}

/**
 * The place's ontology subclass ("City", …) or null for the base
 * "place" type; throws on labels missing from the curated PLACE_TYPES
 * so the ontology can never silently go stale.
 */
function placeClassOf(label: string): string | null {
  const t = PLACE_TYPES[label];
  if (!t) {
    throw new Error(`place-ontology: no curated type for place "${label}"`);
  }
  return t === "place" ? null : PLACE_CLASS[t];
}

/**
 * Role individuals (lo:PhilosopherRole, …) for a person or source node;
 * throws on labels missing from the curated PERSON_ROLES table so the
 * person ontology can never silently go stale. An empty array is a
 * curated decision (unidentifiable or outside the closed role union).
 */
function personRoleNames(label: string): string[] {
  const roles = PERSON_ROLES[label];
  if (!roles) {
    throw new Error(`person-ontology: no curated role entry for "${label}"`);
  }
  return roles.map((r) => PERSON_ROLE_INDIVIDUAL[r]);
}

/** Role individuals for a corpus philosopher: PhilosopherRole + extras. */
function philosopherRoleNames(name: string): string[] {
  const extras = PHILOSOPHER_EXTRA_ROLES[name] ?? [];
  return (["philosopher", ...extras] as PersonRole[]).map(
    (r) => PERSON_ROLE_INDIVIDUAL[r],
  );
}

/**
 * Fail-fast in the other direction: every PERSON_ROLES key must match a
 * person/source node label, every PHILOSOPHER_EXTRA_ROLES key must be a
 * corpus philosopher, and extras must not repeat "philosopher".
 */
function validatePersonRoles(
  personAndSourceLabels: Set<string>,
  philosopherNames: Set<string>,
): void {
  for (const key of Object.keys(PERSON_ROLES)) {
    if (!personAndSourceLabels.has(key)) {
      throw new Error(
        `person-ontology: PERSON_ROLES entry "${key}" matches no person or source node`,
      );
    }
  }
  for (const [key, extras] of Object.entries(PHILOSOPHER_EXTRA_ROLES)) {
    if (!philosopherNames.has(key)) {
      throw new Error(
        `person-ontology: PHILOSOPHER_EXTRA_ROLES key "${key}" is not a corpus philosopher`,
      );
    }
    if (extras?.includes("philosopher")) {
      throw new Error(
        `person-ontology: PHILOSOPHER_EXTRA_ROLES for "${key}" must not repeat "philosopher"`,
      );
    }
  }
}

/**
 * Fail-fast both ways for the work ontology: every lo:Work label
 * (claim-derived + source-works) must carry curated facets, and every
 * curated key must match a work node - the label is the join key, so a
 * renamed work title breaks loudly instead of silently losing its facets.
 */
function validateWorkFacets(workLabels: Set<string>): void {
  for (const label of workLabels) {
    if (!(label in WORK_FACETS)) {
      throw new Error(
        `work-ontology: no curated facets for work "${label}" - add it to the matching chunk file`,
      );
    }
  }
  for (const key of Object.keys(WORK_FACETS)) {
    if (!workLabels.has(key)) {
      throw new Error(
        `work-ontology: stale entry "${key}" matches no work node - the title changed or the work was removed`,
      );
    }
  }
}

/**
 * All authors attributing a work, at ANY certainty: a hedged attribution
 * mints no direct lo:wrote triple, but it still identifies the candidate
 * authors that constrain the work's dating. Source-works count their
 * source as author; person-works count their person.
 */
function buildWorkAuthors(): Map<string, Set<string>> {
  const byWork = new Map<string, Set<string>>();
  const add = (work: string, author: string) => {
    let set = byWork.get(work);
    if (!set) {
      set = new Set();
      byWork.set(work, set);
    }
    set.add(author);
  };
  for (const c of getClaims()) {
    if (c.valueType === "work") add(c.value, c.subject);
  }
  for (const sw of SOURCE_WORKS) add(sw.title, sw.source);
  for (const pw of PERSON_WORKS) add(pw.title, pw.person);
  return byWork;
}

/**
 * The single production century of an author, if one is resolvable:
 * curated AUTHOR_PRODUCTION_CENTURY first, else the chronology bounds
 * when both fall in the same century (a lifespan inside one century
 * implies production in that century). Undefined = unresolvable.
 */
function authorProductionCentury(
  author: string,
  chronByName: Map<string, { earliestYear: number; latestYear: number }>,
): number | undefined {
  const curated = AUTHOR_PRODUCTION_CENTURY[author];
  if (curated !== undefined) return curated;
  const ch = chronByName.get(author);
  if (!ch) return undefined;
  const a = centuryOfYear(ch.earliestYear);
  const b = centuryOfYear(ch.latestYear);
  return a === b ? a : undefined;
}

interface ResolvedWorkFacets {
  form?: WorkForm;
  topic?: WorkTopic;
  philosophical?: boolean;
  /** Undefined = conflated node with divergent transmission (curated null). */
  survival?: WorkSurvival;
  century?: number;
  decade?: number;
}

/**
 * Resolve the emitted facet values for one work label: the curated
 * form/topic, the topic-derived (or overridden) philosophical flag, the
 * survival status (default lost; curated null suppresses the triple), and
 * the composition century - per-work override first, else derived from the
 * attributing authors when every one of them resolves to the SAME single
 * production century.
 */
function resolveWorkFacets(
  label: string,
  workAuthors: Map<string, Set<string>>,
  chronByName: Map<string, { earliestYear: number; latestYear: number }>,
): ResolvedWorkFacets {
  const facet = WORK_FACETS[label];
  if (!facet) {
    throw new Error(`work-ontology: no curated facets for work "${label}"`);
  }
  const out: ResolvedWorkFacets = {};
  if (facet.form !== null) out.form = facet.form;
  if (facet.topic !== null) out.topic = facet.topic;
  const philosophical =
    facet.philosophical ??
    (facet.topic !== null ? TOPIC_PHILOSOPHICAL[facet.topic] : undefined);
  if (philosophical !== undefined) out.philosophical = philosophical;
  if (facet.survival !== null) out.survival = facet.survival ?? "lost";
  const override = WORK_CENTURY_OVERRIDES[label];
  if (override !== undefined) {
    out.century = override;
  } else {
    const authors = workAuthors.get(label);
    if (authors && authors.size > 0) {
      const centuries = [...authors].map((a) =>
        authorProductionCentury(a, chronByName),
      );
      const first = centuries[0];
      if (
        first !== undefined &&
        centuries.every((c) => c !== undefined && c === first)
      ) {
        out.century = first;
      }
    }
  }
  const decade = WORK_DECADES[label];
  if (decade) out.decade = decade.decade;
  return out;
}

/** Apply the resolved facets to a JSON-LD work entity (parity with Turtle). */
function applyWorkFacetsJsonLd(
  entity: Record<string, unknown>,
  wf: ResolvedWorkFacets,
): void {
  if (wf.form) {
    entity["lo:hasForm"] = { "@id": `${ONT}${WORK_FORM_INDIVIDUAL[wf.form]}` };
  }
  if (wf.topic) {
    entity["lo:hasWorkTopic"] = {
      "@id": `${ONT}${WORK_TOPIC_INDIVIDUAL[wf.topic]}`,
    };
  }
  if (wf.philosophical !== undefined) {
    entity["lo:philosophical"] = wf.philosophical;
  }
  if (wf.survival) {
    entity["lo:survival"] = {
      "@id": `${ONT}${WORK_SURVIVAL_INDIVIDUAL[wf.survival]}`,
    };
  }
  if (wf.century !== undefined) entity["lo:compositionCentury"] = wf.century;
  if (wf.decade !== undefined) entity["lo:compositionDecade"] = wf.decade;
}

/** The resolved facets as Turtle predicate-object pairs (parity with JSON-LD). */
function workFacetTriples(wf: ResolvedWorkFacets): string[] {
  const triples: string[] = [];
  if (wf.form) triples.push(`lo:hasForm lo:${WORK_FORM_INDIVIDUAL[wf.form]}`);
  if (wf.topic) {
    triples.push(`lo:hasWorkTopic lo:${WORK_TOPIC_INDIVIDUAL[wf.topic]}`);
  }
  if (wf.philosophical !== undefined) {
    triples.push(`lo:philosophical ${wf.philosophical}`);
  }
  if (wf.survival) {
    triples.push(`lo:survival lo:${WORK_SURVIVAL_INDIVIDUAL[wf.survival]}`);
  }
  if (wf.century !== undefined) {
    triples.push(`lo:compositionCentury ${wf.century}`);
  }
  if (wf.decade !== undefined) {
    triples.push(`lo:compositionDecade ${wf.decade}`);
  }
  return triples;
}

/** Curated containing place; throws if the target is not a place node. */
function placeParentOf(label: string, all: Set<string>): string | undefined {
  const parent = PLACE_LOCATED_IN[label];
  if (parent === undefined) return undefined;
  if (!all.has(parent)) {
    throw new Error(
      `place-ontology: locatedIn target "${parent}" of "${label}" is not a place node`,
    );
  }
  return parent;
}

function placeQid(label: string): string | undefined {
  return PLACE_QIDS[label] ?? mentionQidByLabel().get(label);
}

let mentionQidCache: Map<string, string> | null = null;
function mentionQidByLabel(): Map<string, string> {
  if (!mentionQidCache) {
    mentionQidCache = new Map(
      MENTION_PLACES.filter((m) => m.qid).map((m) => [m.label, m.qid!]),
    );
  }
  return mentionQidCache;
}

export function workUri(title: string): string {
  return `${LOD_BASE}/work/${unicodeSlug(title)}`;
}

/**
 * Source-authored works (source-works.ts) join the graph only when the
 * curated source label really is an existing lo:Source node and the
 * title does not collide with a claims-layer work - a typo must fail
 * loudly, never mint a near-duplicate node.
 */
function validateSourceWorks(ceSources: string[], ceWorks: string[]): void {
  for (const sw of SOURCE_WORKS) {
    if (!ceSources.includes(sw.source)) {
      throw new Error(
        `source-works.ts: "${sw.source}" is not an existing source label - no lo:Source node to attach "${sw.title}" to`,
      );
    }
    if (ceWorks.includes(sw.title)) {
      throw new Error(
        `source-works.ts: "${sw.title}" already exists as a claims-layer work - merge the curation instead of double-minting`,
      );
    }
  }
}

/**
 * Person-authored works (person-works.ts) join the graph only when the
 * curated person label really is an existing person node (claim person,
 * saying/anecdote attributee, verse poet or mention person - NOT a
 * philosopher or source, which have their own work mechanisms) and the
 * title does not collide with a claims-layer or source-authored work  - 
 * a typo must fail loudly, never mint a near-duplicate node.
 */
function validatePersonWorks(
  personLabels: Set<string>,
  ceWorks: string[],
): void {
  const seen = new Set<string>();
  for (const pw of PERSON_WORKS) {
    if (!personLabels.has(pw.person)) {
      throw new Error(
        `person-works.ts: "${pw.person}" is not an existing person label - no person node to attach "${pw.title}" to`,
      );
    }
    if (
      ceWorks.includes(pw.title) ||
      SOURCE_WORKS.some((sw) => sw.title === pw.title) ||
      seen.has(pw.title)
    ) {
      throw new Error(
        `person-works.ts: "${pw.title}" already exists as a work - merge the curation instead of double-minting`,
      );
    }
    seen.add(pw.title);
  }
}

/** Titles of person-authored works for one person label (usually none). */
function personWorkTitlesFor(label: string): string[] {
  return PERSON_WORKS.filter((pw) => pw.person === label).map(
    (pw) => pw.title,
  );
}

/**
 * Mention persons must stay disjoint from every other person-minting
 * layer - a collision would double-mint the person/<slug> URI, and a
 * later claim about (say) a different Aristodemus would silently break
 * the curated section scope. Throw so the curation gets reconciled.
 */
function validateMentionPersons(existingLabels: Set<string>): void {
  for (const mp of MENTION_PERSONS) {
    if (existingLabels.has(mp.label)) {
      throw new Error(
        `person-mentions.ts: "${mp.label}" already exists as a graph node, claim person, source, saying attributee or verse poet - merge the curation instead of double-minting`,
      );
    }
  }
}

/**
 * School memberships attach only to EXISTING person and source nodes -
 * the layer may never mint. A dangling label would silently emit a
 * lo:memberOf triple whose subject has no node, so throw instead.
 */
function validateSchoolMembers(
  personLabels: Set<string>,
  sourceLabels: Set<string>,
  movementIds: Set<string>,
): void {
  const seen = new Set<string>();
  for (const m of SCHOOL_MEMBERS) {
    const key = `${m.node}/${m.label}/${m.school}`;
    if (seen.has(key)) {
      throw new Error(
        `school-members.ts: duplicate membership entry for ${m.node} "${m.label}" in school "${m.school}"`,
      );
    }
    seen.add(key);
    const pool = m.node === "person" ? personLabels : sourceLabels;
    if (!pool.has(m.label)) {
      throw new Error(
        `school-members.ts: "${m.label}" is not an existing ${m.node} node - membership may never mint; curate the person first (person-mentions.ts) or fix the label`,
      );
    }
    if (!movementIds.has(m.school)) {
      throw new Error(
        `school-members.ts: unknown school id "${m.school}" for "${m.label}"`,
      );
    }
  }
}

function successionEndpointUri(ep: SuccessionEndpoint): string {
  return ep.node === "philosopher"
    ? philosopherUri(ep.label)
    : ep.node === "person"
      ? personUri(ep.label)
      : sourceUri(ep.label);
}

/**
 * Succession links attach only to EXISTING nodes - the layer may never
 * mint. A dangling label would silently emit a lo:teacherOf triple
 * whose endpoint has no node, so throw instead. accordingTo authorities
 * must be existing source nodes for the same reason.
 */
function validateSuccessionLinks(
  philosopherLabels: Set<string>,
  personLabels: Set<string>,
  sourceLabels: Set<string>,
): void {
  const seen = new Set<string>();
  for (const l of SUCCESSION_LINKS) {
    const key = `${l.teacher.node}/${l.teacher.label}->${l.pupil.node}/${l.pupil.label}`;
    if (seen.has(key)) {
      throw new Error(
        `succession-links.ts: duplicate link ${key}`,
      );
    }
    seen.add(key);
    for (const ep of [l.teacher, l.pupil]) {
      const pool =
        ep.node === "philosopher"
          ? philosopherLabels
          : ep.node === "person"
            ? personLabels
            : sourceLabels;
      if (!pool.has(ep.label)) {
        throw new Error(
          `succession-links.ts: "${ep.label}" is not an existing ${ep.node} node - the layer may never mint; curate the person first (person-mentions.ts) or fix the label`,
        );
      }
    }
    for (const a of l.accordingTo ?? []) {
      if (!sourceLabels.has(a)) {
        throw new Error(
          `succession-links.ts: accordingTo authority "${a}" is not an existing source node`,
        );
      }
    }
  }
}

function personUri(name: string): string {
  return `${LOD_BASE}/person/${unicodeSlug(name)}`;
}

export function sourceUri(name: string): string {
  return `${LOD_BASE}/source/${unicodeSlug(name)}`;
}

function doctrineUri(label: string): string {
  return `${LOD_BASE}/doctrine/${unicodeSlug(label)}`;
}

function termUri(term: string): string {
  return `${LOD_BASE}/term/${unicodeSlug(term)}`;
}

/** Christophe Roche's OntoTerminology Vocabulary (OTV). */
export const OTV = "http://www.ontologia.fr/OTB/otv#";

/** OTV meta-concept individual: the concept a named individual instantiates. */
function conceptUri(kind: string): string {
  return `${LOD_BASE}/concept/${kind}`;
}

/** OTV proper-name node for a named individual (label-keyed; homonyms share it). */
function nameUri(label: string): string {
  return `${LOD_BASE}/name/${unicodeSlug(label)}`;
}

/** Curated Greek name forms for one label (name spec + work-title spec).
 *  These mint the per-language Greek otv:ProperName nodes: in the OTV core
 *  a ProperName is ONE designation in ONE language (otv:properName has
 *  range xsd:string, so no language-tagged literals), hence English and
 *  Greek forms live on separate nodes. */
function greekFormsForLabel(label: string): string[] {
  return [
    ...new Set(
      [greekNameSpec(label)?.grc, greekWorkTitleSpec(label)?.grc].filter(
        (g): g is string => !!g,
      ),
    ),
  ].sort();
}

/**
 * Label pairs that denote the SAME individual under two different node
 * URIs. Two curated labels can share a Greek form without being homonyms:
 * they are simply two English renderings of one man. These pairs must
 * never receive owl:differentFrom axioms (that would be OWL-false) nor a
 * "shares a Greek name with" note against each other in the Index.
 *
 * - "Demetrius of Magnesia" and "Demetrius the Magnesian" are both the
 *   biographer Demetrius Magnes (same QID in entity-links.ts); Hicks
 *   renders him both ways and both surface labels are tagged.
 * - "Dionysius the Stoic" is the cited authority at 6.43; per the
 *   person-ontology note he is Dionysius the Renegade, who has a Life
 *   of his own (7.166-167).
 */
const GREEK_HOMONYM_SAME_INDIVIDUAL: [string, string][] = [
  ["Demetrius of Magnesia", "Demetrius the Magnesian"],
  ["Dionysius the Renegade", "Dionysius the Stoic"],
];

function sameIndividual(a: string, b: string): boolean {
  return GREEK_HOMONYM_SAME_INDIVIDUAL.some(
    ([x, y]) => (x === a && y === b) || (x === b && y === a),
  );
}

/**
 * Person and source labels whose referent is a curator-certified single
 * individual, so a shared Greek name with another bearer may become an
 * owl:differentFrom axiom (and an index note). Philosopher labels are
 * always certified: chapter subjects are distinct by construction. Bare
 * authority names left off this list (Apollodorus, Demetrius, Heraclides,
 * Ariston, the claim-layer "Diogenes", ...) denote no single certifiable
 * individual, and an owl:differentFrom from them could be false; they
 * never enter the homonym computation. "Athenodorus" (the Stoic author of
 * the Walks, 3.3, 9.42) and "Posidonius" (the Stoic of Apamea) are bare
 * but certified: D.L. cites one man under each. The two comic poets
 * "Cratinus" (Old Comedy, Q350517) and "Cratinus the Younger" (Middle
 * Comedy, Q1120896) are certified: their shared bare surface was
 * classified per occurrence in the gazetteer split, each against its
 * own verified Wikidata identity.
 */
export const GREEK_HOMONYM_CERTIFIED_BEARERS: ReadonlySet<string> = new Set([
  "Athenodorus",
  "Athenodorus of Soli",
  "Cratinus",
  "Cratinus the Younger",
  "Demetrius of Magnesia",
  "Demetrius of Troezen",
  "Demetrius the Magnesian",
  "Diogenes of Smyrna",
  "Posidonius",
  "Posidonius of Alexandria",
  "Zeno of Sidon",
]);

/**
 * Greek-name homonym groups among a set of person-like labels
 * (philosophers, mention persons, sources): labels whose curated Greek
 * nominative slugs collide (the same pairs that receive owl:differentFrom
 * axioms in the LOD graph). Returns, per homonymous label, the shared
 * Greek form and the other bearers. Labels with no curated Greek form or
 * a unique form are absent from the map, and pairs naming the same
 * individual under two labels (GREEK_HOMONYM_SAME_INDIVIDUAL) never list
 * each other.
 */
export function greekHomonymsForLabels(
  labels: string[],
): Map<string, { grc: string; others: string[] }> {
  const bySlug = new Map<string, { grc: string; labels: string[] }>();
  for (const label of labels) {
    for (const form of greekFormsForLabel(label)) {
      const slug = unicodeSlug(form);
      const g = bySlug.get(slug) ?? { grc: form, labels: [] };
      if (!g.labels.includes(label)) g.labels.push(label);
      bySlug.set(slug, g);
    }
  }
  const out = new Map<string, { grc: string; others: string[] }>();
  for (const g of bySlug.values()) {
    if (g.labels.length < 2) continue;
    for (const label of g.labels) {
      const others = g.labels
        .filter((l) => l !== label && !sameIndividual(label, l))
        .sort();
      if (others.length === 0) continue;
      out.set(label, { grc: g.grc, others });
    }
  }
  return out;
}

/**
 * owl:differentFrom map over the person-like nodes actually emitted into
 * the graph (philosopher, person and source URIs). Two nodes whose curated
 * Greek forms collide are certified-distinct individuals, EXCEPT the
 * same-individual label pairs above. Returns uri -> sorted other-bearer
 * URIs; URIs with no counterpart are absent. Only ever feed this the
 * emitted node set, never sourcesIndex-only names (a differentFrom end
 * must be a real node, validate-lod checks the shape). Callers must
 * pre-filter person/source labels through GREEK_HOMONYM_CERTIFIED_BEARERS;
 * the same label under two URIs (a person node and a source node for one
 * man) never pairs with itself.
 */
function greekDifferentFromMap(
  entries: [string, string][],
): Map<string, string[]> {
  const bySlug = new Map<string, { label: string; uri: string }[]>();
  for (const [label, uri] of entries) {
    for (const form of greekFormsForLabel(label)) {
      const slug = unicodeSlug(form);
      const arr = bySlug.get(slug) ?? [];
      if (!arr.some((e) => e.uri === uri)) arr.push({ label, uri });
      bySlug.set(slug, arr);
    }
  }
  const out = new Map<string, string[]>();
  for (const bearers of bySlug.values()) {
    if (bearers.length < 2) continue;
    for (const b of bearers) {
      const others = bearers
        .filter(
          (o) =>
            o.uri !== b.uri &&
            o.label !== b.label &&
            !sameIndividual(b.label, o.label),
        )
        .map((o) => o.uri);
      if (others.length === 0) continue;
      const arr = out.get(b.uri) ?? [];
      for (const o of others) if (!arr.includes(o)) arr.push(o);
      out.set(b.uri, arr.sort());
    }
  }
  return out;
}

/** Every otv:ProperName URI denoting an entity through the given labels:
 *  the English node per label plus the Greek node of each curated form.
 *  Keeps otv:denotedByProperName and otv:denotedObject bidirectional for
 *  the per-language nodes. */
function properNameUrisForLabels(labels: string[]): string[] {
  const uris: string[] = [];
  for (const l of labels) {
    for (const u of [nameUri(l), ...greekFormsForLabel(l).map(nameUri)]) {
      if (!uris.includes(u)) uris.push(u);
    }
  }
  return uris;
}

/** JSON-LD object value for otv:denotedByProperName. */
function properNameRefsJson(labels: string[]): unknown {
  const refs = properNameUrisForLabels(labels).map((u) => ({ "@id": u }));
  return refs.length === 1 ? refs[0] : refs;
}

/** Turtle object list for otv:denotedByProperName. */
function properNameRefsTtl(labels: string[]): string {
  return properNameUrisForLabels(labels)
    .map((u) => `<${u}>`)
    .join(", ");
}

/**
 * The otv:Concept individuals our named individuals are otv:instanceOf.
 * Philosophers and sources are people, hence the otv:isA links.
 */
const OTV_CONCEPTS: { kind: string; name: string; isA?: string }[] = [
  { kind: "philosopher", name: "Philosopher", isA: "person" },
  { kind: "sage", name: "Sage", isA: "person" },
  { kind: "school", name: "School" },
  { kind: "place", name: "Place" },
  { kind: "work", name: "Work" },
  { kind: "person", name: "Person" },
  { kind: "source", name: "Source", isA: "person" },
];

/**
 * Entity-slug extracted from its URI: the last TWO path segments joined
 * by a hyphen (kind + name, e.g. "philosopher-antisthenes"). Using both
 * segments prevents entities of different kinds but the same name (e.g.
 * philosopherUri("Antisthenes") and sourceUri("Antisthenes")) from
 * collapsing into the same per-entity ProperName node.
 */
function entitySlugFromUri(uri: string): string {
  const parts = uri.split("/");
  const name = parts.at(-1) ?? "";
  const kind = parts.at(-2) ?? "";
  const nameSlug = unicodeSlug(name || uri);
  return kind ? `${unicodeSlug(kind)}-${nameSlug}` : nameSlug;
}

/** Priority for picking the canonical denotedObject URI (lower = higher priority). */
function kindPriorityFromUri(uri: string): number {
  if (uri.includes("/philosopher/")) return 0;
  if (uri.includes("/person/")) return 1;
  if (uri.includes("/source/")) return 2;
  if (uri.includes("/school/")) return 3;
  if (uri.includes("/place/")) return 4;
  if (uri.includes("/work/")) return 5;
  return 99;
}

/**
 * Greek form slugs (unicodeSlug of the nominative) that appear under more than
 * one distinct entity URI in the corpus. Populated lazily on first graph
 * serialization; subsequent calls are no-ops (corpus is static at runtime).
 */
let _collisionGrcSlugs: Set<string> | null = null;
let _collisionEnLabels: Set<string> | null = null;

/**
 * Build the Greek-form collision set from the full namePairs list.
 * A "collision slug" is a unicodeSlug(grcForm) shared by more than one
 * distinct entity URI: those forms need per-entity disambiguated name nodes.
 */
function computeCollisionGrcSlugs(namePairs: [string, string][]): void {
  if (_collisionGrcSlugs) return;
  const slugToUris = new Map<string, Set<string>>();
  for (const [label, uri] of namePairs) {
    for (const form of greekFormsForLabel(label)) {
      const slug = unicodeSlug(form);
      let s = slugToUris.get(slug);
      if (!s) {
        s = new Set<string>();
        slugToUris.set(slug, s);
      }
      s.add(uri);
    }
  }
  _collisionGrcSlugs = new Set(
    [...slugToUris.entries()]
      .filter(([, s]) => s.size > 1)
      .map(([slug]) => slug),
  );
}

/**
 * Per-entity Greek ProperName URI: collision forms get a disambiguating entity
 * slug appended (e.g. /name/ζηνων--zeno-of-citium); unique forms keep the
 * stable per-form URI (e.g. /name/σωκρατησ). Requires computeCollisionGrcSlugs().
 */
function perEntityGrcNameUri(form: string, entityUri: string): string {
  if (_collisionGrcSlugs === null) {
    throw new Error(
      "lod.ts init-order bug: perEntityGrcNameUri called before computeCollisionGrcSlugs(); " +
        "the collision-slug set must be seeded from the full namePairs superset before any " +
        "entity emits otv:denotedByProperName links",
    );
  }
  const slug = unicodeSlug(form);
  if (!_collisionGrcSlugs.has(slug)) return nameUri(form);
  return `${LOD_BASE}/name/${slug}--${entitySlugFromUri(entityUri)}`;
}

/**
 * Pre-populate the English collision label set. English labels shared by more
 * than one distinct entity URI (e.g. "Antisthenes" as both philosopher and
 * cited source) get per-entity ProperName nodes so every node denotes exactly
 * one individual. Requires computeCollisionGrcSlugs() to have run first.
 */
function computeCollisionEnLabels(namePairs: [string, string][]): void {
  if (_collisionEnLabels) return;
  const labelToUris = new Map<string, Set<string>>();
  for (const [label, uri] of namePairs) {
    let s = labelToUris.get(label);
    if (!s) {
      s = new Set<string>();
      labelToUris.set(label, s);
    }
    s.add(uri);
  }
  _collisionEnLabels = new Set(
    [...labelToUris.entries()]
      .filter(([, s]) => s.size > 1)
      .map(([label]) => label),
  );
}

/**
 * Per-entity English ProperName URI: collision labels get a disambiguating
 * entity slug appended (e.g. /name/antisthenes--antisthenes); unique labels
 * keep the stable per-label URI. Requires computeCollisionEnLabels().
 */
function perEntityEnNameUri(label: string, entityUri: string): string {
  if (_collisionEnLabels === null) {
    throw new Error(
      "lod.ts init-order bug: perEntityEnNameUri called before computeCollisionEnLabels(); " +
        "the English collision-label set must be seeded from the full namePairs superset " +
        "before any entity emits otv:denotedByProperName links",
    );
  }
  if (!_collisionEnLabels.has(label)) return nameUri(label);
  return `${LOD_BASE}/name/${unicodeSlug(label)}--${entitySlugFromUri(entityUri)}`;
}

/**
 * Test-only access to the collision-set init-order guard. Lets validate-lod
 * prove that perEntityGrcNameUri / perEntityEnNameUri THROW when the
 * collision sets are unseeded, instead of silently returning shared name
 * URIs, without exposing the module-private helpers for production use.
 * resetCollisionSets() is safe before any serialization: the compute
 * functions re-seed lazily on the next graph call.
 */
export const __collisionGuardTestHooks = {
  resetCollisionSets(): void {
    _collisionGrcSlugs = null;
    _collisionEnLabels = null;
  },
  collisionSetsSeeded(): boolean {
    return _collisionGrcSlugs !== null && _collisionEnLabels !== null;
  },
  callPerEntityGrcNameUri(form: string, entityUri: string): string {
    return perEntityGrcNameUri(form, entityUri);
  },
  callPerEntityEnNameUri(label: string, entityUri: string): string {
    return perEntityEnNameUri(label, entityUri);
  },
};

/**
 * All otv:ProperName URIs for a specific entity with its English label(s):
 * the English node per label + Greek node per curated form, using per-entity
 * URIs for collision forms. Requires computeCollisionGrcSlugs() and
 * computeCollisionEnLabels().
 */
function properNameUrisForEntityLabels(
  labels: string[],
  entityUri: string,
): string[] {
  const uris: string[] = [];
  for (const l of labels) {
    const en = perEntityEnNameUri(l, entityUri);
    if (!uris.includes(en)) uris.push(en);
    for (const form of greekFormsForLabel(l)) {
      const grc = perEntityGrcNameUri(form, entityUri);
      if (!uris.includes(grc)) uris.push(grc);
    }
  }
  return uris;
}

/** JSON-LD object value for otv:denotedByProperName (per entity). */
function properNameRefsJsonForEntity(
  labels: string[],
  entityUri: string,
): unknown {
  const refs = properNameUrisForEntityLabels(labels, entityUri).map((u) => ({
    "@id": u,
  }));
  return refs.length === 1 ? refs[0] : refs;
}

/** Turtle object list for otv:denotedByProperName (per entity). */
function properNameRefsTtlForEntity(
  labels: string[],
  entityUri: string,
): string {
  return properNameUrisForEntityLabels(labels, entityUri)
    .map((u) => `<${u}>`)
    .join(", ");
}

/**
 * Group [label, entityUri] pairs into per-entity English ProperName nodes.
 * Each node denotes exactly one individual via otv:denotedObject. Labels
 * shared by multiple entities (e.g. "Antisthenes" as philosopher and cited
 * source) get per-entity disambiguated URIs; unique labels keep the stable
 * per-label URI. Requires computeCollisionEnLabels().
 */
function groupProperNames(
  pairs: [string, string][],
): Map<string, { labels: Set<string>; entityUri: string }> {
  const map = new Map<string, { labels: Set<string>; entityUri: string }>();
  for (const [label, uri] of pairs) {
    const key = perEntityEnNameUri(label, uri);
    let entry = map.get(key);
    if (!entry) {
      entry = { labels: new Set(), entityUri: uri };
      map.set(key, entry);
    }
    entry.labels.add(label);
  }
  return map;
}

/**
 * Group [grcForm, entityUri] pairs so each (form, entityUri) pair gets its
 * own otv:ProperName node with exactly one otv:denotedObject. Forms shared
 * by multiple entities get per-entity disambiguated URIs; unique forms keep
 * the stable per-form URI. Requires computeCollisionGrcSlugs().
 */
function groupGreekProperNamesPerEntity(
  greekPairs: [string, string][],
): Map<string, { forms: Set<string>; entityUri: string }> {
  const map = new Map<string, { forms: Set<string>; entityUri: string }>();
  for (const [form, entityUri] of greekPairs) {
    const key = perEntityGrcNameUri(form, entityUri);
    let entry = map.get(key);
    if (!entry) {
      entry = { forms: new Set(), entityUri };
      map.set(key, entry);
    }
    entry.forms.add(form);
  }
  return map;
}

function claimUri(id: string): string {
  return `${LOD_BASE}/claim/${id}`;
}

function chainLinkUri(claimId: string, idx: number): string {
  return `${LOD_BASE}/claim/${claimId}/chain/${idx}`;
}

function wikidataEntityUri(qid: string): string {
  return `http://www.wikidata.org/entity/${qid}`;
}

function sayingUri(id: string): string {
  return `${LOD_BASE}/saying/${id}`;
}

function epistleUri(id: string): string {
  return `${LOD_BASE}/epistle/${id}`;
}

function anecdoteUri(id: string): string {
  return `${LOD_BASE}/anecdote/${id}`;
}

function doxaUri(id: string): string {
  return `${LOD_BASE}/doxa/${id}`;
}

function testamentUri(id: string): string {
  return `${LOD_BASE}/testament/${id}`;
}

/** Verse ids look like "1.prol.3#0"; '#' would start a URI fragment. */
function verseUri(id: string): string {
  return `${LOD_BASE}/verse/${id.replace("#", "-")}`;
}

/**
 * Hicks-style book.section citation for a verse. Corpus section ids are
 * book.chapter.section (e.g. "1.1.23"); D.L. sections are numbered
 * continuously through each book, so the citation is book.<last part>.
 */
function verseCitation(v: Verse): string {
  const parts = v.sectionId.split(".");
  return `Diog. Laert. ${v.book}.${parts[parts.length - 1]}`;
}

// -------------------------------------- Sources index (curated workbook)

/** One lo:SourceCitation node per workbook row, keyed by the row id. */
function citationUri(rowId: string): string {
  return `${LOD_BASE}/citation/${rowId.toLowerCase()}`;
}

/** The graph URI a reconciled sources-index group attaches to. */
function sourceGroupUri(gr: SourcePersonGroup): string {
  if (gr.kind === "philosopher") return philosopherUri(gr.label);
  if (gr.kind === "person") return personUri(gr.label);
  return sourceUri(gr.label);
}

/** True when the existing node already carries a curated Wikidata QID
 *  (curated identifications always win over workbook ones). */
function hasCuratedQid(gr: SourcePersonGroup): boolean {
  if (gr.kind === "philosopher") return !!PHILOSOPHER_META[gr.label]?.qid;
  return !!ENTITY_QIDS[gr.label];
}

/** The curator's trailing doubt marker is not a proper-name variant. */
function isDoubtMarked(label: string): boolean {
  return /\(\?\)\s*$/u.test(label);
}

/** Display label for a citation node. */
function citationLabel(
  r: SourceCitationRow,
  gr: SourcePersonGroup | undefined,
): string {
  const who = gr ? gr.label : (r.workEn ?? r.workFr ?? r.workGrc ?? r.id);
  return r.refRaw
    ? `${who}, cited at Diog. Laert. ${r.refRaw}`
    : `${who}, cited by Diogenes Laertius`;
}

/**
 * Curated disambiguation for the ambiguous Hicks refs on citation rows.
 * Citation rows carry no section owner (they cite a source author, not a
 * Life's subject), so an ambiguous book.section ref cannot be resolved
 * owner-aware; each pin below was verified against the candidate section
 * texts (the section that actually names the cited authority wins):
 * - DL-SRC-0008 Alcmaeon, VIII 83: his own Life (8.5.83), not Archytas'.
 * - DL-SRC-0172 Demetrius of Magnesia, VIII 84: cited ("in Homonyms") in
 *   Hippasus (8.6.84), not Philolaus.
 * - DL-SRC-0189 Diocles of Magnesia, VII 166: cited in Dionysius the
 *   Renegade (7.4.166), not Herillus.
 * - DL-SRC-0200 Diogenes Laertius (own verses), VIII 84: his epigram on
 *   Philolaus (8.7.84), not Hippasus.
 * - DL-SRC-0310 Favorinus, VIII 83: cited (Miscellaneous History) in
 *   Alcmaeon (8.5.83), not Archytas.
 * - DL-SRC-0439 Plato, VIII 83: cited ("in the Republic") in Archytas
 *   (8.4.83), not Alcmaeon.
 */
export const CITATION_REF_SECTION: Record<string, Record<string, string>> = {
  "DL-SRC-0008": { "8.83": "8.5.83" },
  "DL-SRC-0172": { "8.84": "8.6.84" },
  "DL-SRC-0189": { "7.166": "7.4.166" },
  "DL-SRC-0200": { "8.84": "8.7.84" },
  "DL-SRC-0310": { "8.83": "8.5.83" },
  "DL-SRC-0439": { "8.83": "8.4.83" },
};

/** Corpus section ids a citation row's refs resolve to: curated pins win
 *  for ambiguous refs; an uncurated ambiguous ref links ALL candidates
 *  rather than silently picking another philosopher's passage. */
function citationSectionIds(r: SourceCitationRow): string[] {
  const sids: string[] = [];
  for (const ref of r.refs) {
    const pinned = CITATION_REF_SECTION[r.id]?.[ref];
    for (const sid of pinned ? [pinned] : sectionIdsForRef(ref)) {
      if (!sids.includes(sid)) sids.push(sid);
    }
  }
  return sids;
}

/** CTS URNs for every workbook ref that resolves to a corpus section. */
function citationSectionUrns(r: SourceCitationRow): string[] {
  return citationSectionIds(r).map(
    (sid) => `urn:cts:greekLit:tlg0004.tlg001.perseus-grc2:${sid}`,
  );
}

/** Row id → reconciled group (anonymous rows have none). */
function citationGroupsByRow(
  groups: SourcePersonGroup[],
): Map<string, SourcePersonGroup> {
  const map = new Map<string, SourcePersonGroup>();
  for (const gr of groups) for (const r of gr.rows) map.set(r.id, gr);
  return map;
}

/** Workbook name variants that deserve their own otv:ProperName
 *  (doubt-marked variants like "Socrates (?)" are not names), plus the
 *  curated Hicks spellings from the source-mentions layer (Potamon ->
 *  "Potamo") so the tag surface is always a name of the node. */
function sourceGroupAltNames(gr: SourcePersonGroup): string[] {
  return [
    ...new Set([
      ...gr.altLabels.filter((alt) => !isDoubtMarked(alt)),
      ...sourceMentionHicksNames(gr.label),
    ]),
  ].filter((n) => n !== gr.label);
}

/** ProperName pairs the sources index adds: minted labels plus workbook
 *  name variants for existing nodes (doubt-marked variants excluded). */
function sourceIndexNamePairs(groups: SourcePersonGroup[]): [string, string][] {
  const pairs: [string, string][] = [];
  for (const gr of groups) {
    const uri = sourceGroupUri(gr);
    if (!gr.existing) pairs.push([gr.label, uri]);
    for (const alt of sourceGroupAltNames(gr)) pairs.push([alt, uri]);
  }
  return pairs;
}

/** The minted sources-index groups that the curated source-mentions layer
 *  opts into the base graph (and thereby into text tagging). */
function taggedMintedGroups(groups: SourcePersonGroup[]): SourcePersonGroup[] {
  return groups.filter(
    (gr) => !gr.existing && SOURCE_MENTION_LABELS.has(gr.label),
  );
}

/** Turtle for one minted sources-index authority node. Shared between the
 *  full sourcesIndex graph and the base graph's opted-in subset. */
function mintedSourceGroupTtl(gr: SourcePersonGroup): string {
  const uri = sourceGroupUri(gr);
  const triples = [`a lo:Source`, `rdfs:label "${ttlEscape(gr.label)}"@en`];
  if (gr.nameGrc) triples.push(`rdfs:label "${ttlEscape(gr.nameGrc)}"@grc`);
  if (gr.nameFr) triples.push(`rdfs:label "${ttlEscape(gr.nameFr)}"@fr`);
  triples.push(
    `rdfs:comment "An authority named by Diogenes Laertius."@en`,
    `otv:instanceOf <${conceptUri("source")}>`,
    `otv:denotedByProperName ${properNameRefsTtlForEntity([gr.label, ...sourceGroupAltNames(gr)], uri)}`,
  );
  const roleNames = personRoleNames(gr.label);
  if (roleNames.length > 0) {
    triples.push(`lo:hasRole ${roleNames.map((r) => `lo:${r}`).join(", ")}`);
  }
  if (gr.qid) triples.push(`owl:sameAs wd:${gr.qid}`);
  if (gr.certainty) {
    triples.push(`lo:identificationCertainty "${gr.certainty}"`);
  }
  return `<${uri}> ${triples.join(" ; ")} .`;
}

function dbpediaUri(enwikiTitle: string): string {
  return `http://dbpedia.org/resource/${enwikiTitle.replace(/ /g, "_")}`;
}

function viafUri(id: string): string {
  return `http://viaf.org/viaf/${id}`;
}

function britannicaUri(path: string): string {
  return `https://www.britannica.com/${path}`;
}

/** InPhO (Indiana Philosophy Ontology) entity URI, e.g. thinker/3724. */
function inphoUri(path: string): string {
  return `https://www.inphoproject.org/${path}`;
}

function wikipediaUri(enwikiTitle: string): string {
  return `https://en.wikipedia.org/wiki/${enwikiTitle.replace(/ /g, "_")}`;
}

/** Philosophy Pages (philosophypages.com) entry URI, e.g. ph/plat.htm. */
function philosophyPagesUri(path: string): string {
  return `https://www.philosophypages.com/${path}`;
}

const EDGE_PROPERTY: Record<KgEdge["type"], string> = {
  teacherOf: "teacherOf",
  influenced: "influenced",
  spouseOf: "spouseOf",
};

/** Ontology predicate each claim property reifies. */
const CLAIM_PREDICATE: Record<ClaimProperty, string> = {
  birthPlace: "bornIn",
  deathPlace: "diedIn",
  livedIn: "livedIn",
  traveledTo: "traveledTo",
  birthDate: "reportedBirthDate",
  deathDate: "reportedDeathDate",
  mannerOfDeath: "mannerOfDeath",
  parentage: "parentage",
  wrote: "wrote",
  writings: "writingsReport",
  studiedUnder: "studentOf",
  education: "educationReport",
  affiliatedWith: "memberOf",
  praised: "praised",
  criticized: "criticized",
  heldDoctrine: "heldDoctrine",
  succession: "successionReport",
  oldAge: "oldAgeReport",
  deme: "demeReport",
};

/** Claim properties whose ontology predicate is a datatype property. */
const DATATYPE_CLAIM_PROPS = new Set<ClaimProperty>([
  "birthDate",
  "deathDate",
  "mannerOfDeath",
  "parentage",
  "writings",
  "education",
  "succession",
  "oldAge",
  "deme",
]);

const CERTAINTY_INDIVIDUAL: Record<Certainty, string> = {
  asserted: "Asserted",
  reported: "Reported",
  disputed: "Disputed",
  conjectured: "Conjectured",
};

/** Authenticity individuals for the epistle layer. "DisputedAuthenticity"
 * avoids colliding with the certainty individual lo:Disputed - the two axes
 * are distinct (curator's verdict vs. D.L.'s epistemic stance). */
const AUTHENTICITY_INDIVIDUAL: Record<EpistleAuthenticity, string> = {
  authentic: "Authentic",
  disputed: "DisputedAuthenticity",
  spurious: "Spurious",
};

function passageUri(sectionId: string): string {
  return `${LOD_BASE}/passage/${sectionId}`;
}

/** Shared JSON-LD context for the full-graph and per-passage exports. */
const JSONLD_CONTEXT = {
  lo: ONT,
  rdf: "http://www.w3.org/1999/02/22-rdf-syntax-ns#",
  rdfs: "http://www.w3.org/2000/01/rdf-schema#",
  owl: "http://www.w3.org/2002/07/owl#",
  foaf: "http://xmlns.com/foaf/0.1/",
  dcterms: "http://purl.org/dc/terms/",
  "lo:memberOf": { "@type": "@id" },
  "lo:teacherOf": { "@type": "@id" },
  "lo:influenced": { "@type": "@id" },
  "lo:spouseOf": { "@type": "@id" },
  "lo:bornIn": { "@type": "@id" },
  "lo:diedIn": { "@type": "@id" },
  "lo:livedIn": { "@type": "@id" },
  "lo:traveledTo": { "@type": "@id" },
  "lo:wrote": { "@type": "@id" },
  "lo:studentOf": { "@type": "@id" },
  "lo:praised": { "@type": "@id" },
  "lo:criticized": { "@type": "@id" },
  "lo:heldDoctrine": { "@type": "@id" },
  "lo:foundedSchool": { "@type": "@id" },
  "lo:principalDoctrine": { "@type": "@id" },
  "lo:usesTerm": { "@type": "@id" },
  "lo:certainty": { "@type": "@id" },
  "lo:accordingTo": { "@type": "@id" },
  "lo:alsoAttributedTo": { "@type": "@id" },
  "lo:addressedTo": { "@type": "@id" },
  "lo:conflictsWith": { "@type": "@id" },
  "lo:assertedInWork": { "@type": "@id" },
  "lo:transmissionChain": { "@type": "@id" },
  "lo:chainAuthority": { "@type": "@id" },
  "lo:chainWork": { "@type": "@id" },
  "lo:quotedInLifeOf": { "@type": "@id" },
  "lo:composedBy": { "@type": "@id" },
  "lo:inLifeOf": { "@type": "@id" },
  "owl:sameAs": { "@type": "@id" },
  "rdfs:seeAlso": { "@type": "@id" },
  otv: "http://www.ontologia.fr/OTB/otv#",
  oa: "http://www.w3.org/ns/oa#",
  "otv:instanceOf": { "@type": "@id" },
  "otv:isA": { "@type": "@id" },
  "otv:denotedByTerm": { "@type": "@id" },
  "otv:denotedConcept": { "@type": "@id" },
  "otv:denotedByProperName": { "@type": "@id" },
  "otv:denotedObject": { "@type": "@id" },
} as const;

/** URI of a claim's value, or null when the value is a literal. */
function claimValueUri(c: KgClaim): string | null {
  switch (c.valueType) {
    case "place":
      return placeUri(c.value);
    case "work":
      return workUri(c.value);
    case "philosopher":
      return philosopherUri(c.value);
    case "person":
      return personUri(c.value);
    case "school":
      return claimSchoolUri(c.value);
    case "doctrine":
      return doctrineUri(c.value);
    case "literal":
      return null;
  }
}

/**
 * Whether the claim is also emitted as a direct triple on its subject.
 * Only claims asserted in D.L.'s own voice qualify, and only when the
 * value shape matches the predicate (datatype props take literals,
 * object props take URIs).
 */
function directTriple(
  c: KgClaim,
): { pred: string; uri: string | null } | null {
  if (c.certainty !== "asserted") return null;
  const pred = CLAIM_PREDICATE[c.property];
  if (DATATYPE_CLAIM_PROPS.has(c.property)) {
    return c.valueType === "literal" ? { pred, uri: null } : null;
  }
  const uri = claimValueUri(c);
  return uri ? { pred, uri } : null;
}

export function graphAsJsonLd(): object {
  const g = getKnowledgeGraph();
  const byName = new Map(g.nodes.map((n) => [n.name, n]));
  const claims = getClaims();
  const ce = getClaimEntities();
  const sayings = getSayings();
  const anecdotes = getAnecdotes();
  const doxai = getDoxai();
  const claimSourceLabels = new Set(ce.sources);
  const sayingOnlySources = [
    ...new Set(
      sayings
        .map((s) => s.accordingTo)
        .filter((a): a is string => !!a && !claimSourceLabels.has(a)),
    ),
  ];
  // Authorities named only for anecdotes (not already claim or saying
  // sources) mint lo:Source nodes of their own, following the same
  // convention - including the source/philosopher double-node convention
  // when the authority is himself a corpus philosopher (Metrocles).
  const sayingSourceSet = new Set(sayingOnlySources);
  const anecdoteOnlySources = [
    ...new Set(
      anecdotes
        .map((a) => a.accordingTo)
        .filter(
          (a): a is string =>
            !!a && !claimSourceLabels.has(a) && !sayingSourceSet.has(a),
        ),
    ),
  ];
  const extras = getOntologyExtras();
  const principalBySchool = new Map<string, string[]>();
  for (const sd of extras.schoolDoctrines) {
    const arr = principalBySchool.get(sd.school) ?? [];
    arr.push(sd.doctrine);
    principalBySchool.set(sd.school, arr);
  }
  const altByWork = new Map<string, string[]>();
  for (const a of extras.altTitles) {
    const arr = altByWork.get(a.work) ?? [];
    arr.push(a.altTitle);
    altByWork.set(a.work, arr);
  }
  const transByWork = new Map<string, (typeof extras.workTransmission)[number]>();
  for (const tr of extras.workTransmission) transByWork.set(tr.work, tr);
  const founderBySubject = new Map<string, MovementId>();
  for (const f of extras.founderLinks) founderBySubject.set(f.philosopher, f.school);
  const chronBySubject = new Map<string, (typeof extras.chronology)[number]>();
  for (const ch of extras.chronology) chronBySubject.set(ch.philosopher, ch);

  // Pre-populate the Greek collision slug set before building any entity node.
  // Entity nodes call properNameRefsJsonForEntity, which routes collision forms
  // to per-entity URIs only when _collisionGrcSlugs is already populated.
  // (attributedOnlyLabels and verseAuthorOnlyLabels are also computed below;
  //  this block computes them inline solely so namePairs can be built early.)
  let diffFromByUri: Map<string, string[]>;
  {
    const _attrLabels = [
      ...new Set(
        [
          ...sayings.map((s) => s.alsoAttributedTo),
          ...anecdotes.map((a) => a.alsoAttributedTo),
        ].filter(
          (a): a is string => !!a && !byName.has(a) && !ce.persons.includes(a),
        ),
      ),
    ];
    const _vaLabels = [...new Set(Object.values(VERSE_AUTHORS))]
      .filter(
        (a) =>
          !byName.has(a) &&
          !ce.persons.includes(a) &&
          !_attrLabels.includes(a),
      )
      .sort();
    const _initPairs: [string, string][] = [
      ...g.nodes.map((n): [string, string] => [n.name, philosopherUri(n.name)]),
      ...g.movements.map((m): [string, string] => [m.label, schoolUri(m.id)]),
      ...ce.schools.map((s): [string, string] => [s, claimSchoolUri(s)]),
      ...allPlaces(ce.places).map((p): [string, string] => [p, placeUri(p)]),
      ...[
        ...ce.persons,
        ..._attrLabels,
        ..._vaLabels,
        ...MENTION_PERSONS.map((mp) => mp.label),
      ].map((p): [string, string] => [p, personUri(p)]),
      ...[...ce.sources, ...sayingOnlySources, ...anecdoteOnlySources].map(
        (s): [string, string] => [s, sourceUri(s)],
      ),
      ...sourceIndexNamePairs(getSourcesIndex().groups),
      ...[
        ...ce.works,
        ...SOURCE_WORKS.map((sw) => sw.title),
        ...PERSON_WORKS.map((pw) => pw.title),
      ].map((t): [string, string] => [t, workUri(t)]),
    ];
    computeCollisionGrcSlugs(_initPairs);
    computeCollisionEnLabels(_initPairs);
    // owl:differentFrom over the person-like nodes this serializer emits
    // (philosophers always; person and source labels only when a curator
    // certified the bearer); sourcesIndex-only names deliberately excluded
    // (they are not graph nodes).
    diffFromByUri = greekDifferentFromMap([
      ...g.nodes.map((n): [string, string] => [n.name, philosopherUri(n.name)]),
      ...[
        ...ce.persons,
        ..._attrLabels,
        ..._vaLabels,
        ...MENTION_PERSONS.map((mp) => mp.label),
      ]
        .filter((p) => GREEK_HOMONYM_CERTIFIED_BEARERS.has(p))
        .map((p): [string, string] => [p, personUri(p)]),
      ...[...ce.sources, ...sayingOnlySources, ...anecdoteOnlySources]
        .filter((s) => GREEK_HOMONYM_CERTIFIED_BEARERS.has(s))
        .map((s): [string, string] => [s, sourceUri(s)]),
    ]);
  }

  const schools = g.movements.map((m) => {
    const entity: Record<string, unknown> = {
      "@id": schoolUri(m.id),
      "@type": "lo:School",
      "rdfs:label": m.label,
      "otv:instanceOf": { "@id": conceptUri("school") },
      "otv:denotedByProperName": properNameRefsJsonForEntity([m.label], schoolUri(m.id)),
    };
    const pds = principalBySchool.get(m.id);
    if (pds) {
      entity["lo:principalDoctrine"] = pds.map((d) => ({ "@id": doctrineUri(d) }));
    }
    return entity;
  });

  // Reified statements preserving the D.L. citation for each relation.
  const statements = g.edges
    .filter((e) => e.ref && byName.has(e.from) && byName.has(e.to))
    .map((e) => ({
      "@type": "rdf:Statement",
      "rdf:subject": { "@id": philosopherUri(e.from) },
      "rdf:predicate": { "@id": `${ONT}${EDGE_PROPERTY[e.type]}` },
      "rdf:object": { "@id": philosopherUri(e.to) },
      "dcterms:bibliographicCitation": `Diog. Laert. ${e.ref}`,
    }));

  // owl:differentFrom pairs live in diffFromByUri (computed above): all
  // person-like nodes sharing a Greek proper-name form are certified-distinct
  // individuals, except the curated same-individual label pairs.
  assertDualSages(g.nodes);
  const persons = g.nodes.map((n) => {
    const concepts = chapterSubjectConcepts(n.name, n.book).map((k) => ({
      "@id": conceptUri(k),
    }));
    const entity: Record<string, unknown> = {
      "@id": philosopherUri(n.name),
      "@type": [
        ...chapterSubjectClasses(n.name, n.book).map((c) => `lo:${c}`),
        "foaf:Person",
      ],
      "rdfs:label": n.name,
      "lo:memberOf": { "@id": schoolUri(n.movement) },
      "lo:describedInBook": n.book,
      "dcterms:source": `urn:cts:greekLit:tlg0004.tlg001.perseus-grc2:${n.book}.${n.chapter}`,
      "otv:instanceOf": concepts.length === 1 ? concepts[0] : concepts,
      "otv:denotedByProperName": properNameRefsJsonForEntity([n.name], philosopherUri(n.name)),
    };
    const roleIds = philosopherRoleNames(n.name).map((r) => ({
      "@id": `${ONT}${r}`,
    }));
    entity["lo:hasRole"] = roleIds.length === 1 ? roleIds[0] : roleIds;
    const sameAs: { "@id": string }[] = [];
    if (n.qid) sameAs.push({ "@id": `http://www.wikidata.org/entity/${n.qid}` });
    if (n.enwiki) sameAs.push({ "@id": dbpediaUri(n.enwiki) });
    if (n.viaf) sameAs.push({ "@id": viafUri(n.viaf) });
    if (n.inpho) sameAs.push({ "@id": inphoUri(n.inpho) });
    if (sameAs.length > 0) entity["owl:sameAs"] = sameAs;
    const seeAlso: { "@id": string }[] = [];
    if (n.enwiki) seeAlso.push({ "@id": wikipediaUri(n.enwiki) });
    if (n.britannica) seeAlso.push({ "@id": britannicaUri(n.britannica) });
    if (n.philosophyPages) seeAlso.push({ "@id": philosophyPagesUri(n.philosophyPages) });
    if (seeAlso.length > 0) entity["rdfs:seeAlso"] = seeAlso;
    if (n.founderOf) entity["lo:founderOfLabel"] = n.founderOf;
    const foundedSchool = founderBySubject.get(n.name);
    if (foundedSchool) entity["lo:foundedSchool"] = { "@id": schoolUri(foundedSchool) };
    const chron = chronBySubject.get(n.name);
    if (chron) {
      entity["lo:earliestYear"] = chron.earliestYear;
      entity["lo:latestYear"] = chron.latestYear;
      entity["lo:datePrecision"] = chron.approximate ? "approximate" : "attested";
    }
    for (const e of g.edges) {
      if (e.from !== n.name || !byName.has(e.to)) continue;
      const prop = `lo:${EDGE_PROPERTY[e.type]}`;
      const arr = (entity[prop] as unknown[] | undefined) ?? [];
      arr.push({ "@id": philosopherUri(e.to) });
      entity[prop] = arr;
    }
    // Direct triples for claims asserted in D.L.'s own voice.
    for (const c of claims) {
      if (c.subject !== n.name) continue;
      const d = directTriple(c);
      if (!d) continue;
      const prop = `lo:${d.pred}`;
      const existing = entity[prop];
      const arr =
        existing === undefined
          ? []
          : Array.isArray(existing)
            ? existing
            : [existing];
      arr.push(d.uri ? { "@id": d.uri } : c.value);
      entity[prop] = arr;
    }
    // Direct triples for sayings asserted in D.L.'s own voice.
    for (const s of sayings) {
      if (s.philosopher !== n.name || s.certainty !== "asserted") continue;
      const existing = entity["lo:said"];
      const arr =
        existing === undefined
          ? []
          : Array.isArray(existing)
            ? existing
            : [existing];
      arr.push({ "@value": s.en, "@language": "en" });
      entity["lo:said"] = arr;
    }
    const diffFromUris = diffFromByUri.get(philosopherUri(n.name));
    if (diffFromUris) {
      entity["owl:differentFrom"] =
        diffFromUris.length === 1
          ? { "@id": diffFromUris[0]! }
          : diffFromUris.map((u) => ({ "@id": u }));
    }
    return entity;
  });

  const claimSchools = ce.schools.map((s) => ({
    "@id": claimSchoolUri(s),
    "@type": "lo:School",
    "rdfs:label": s,
    "otv:instanceOf": { "@id": conceptUri("school") },
    "otv:denotedByProperName": properNameRefsJsonForEntity([s], claimSchoolUri(s)),
  }));

  const placeLabelSet = new Set(allPlaces(ce.places));
  const places = allPlaces(ce.places).map((p) => {
    const placeClass = placeClassOf(p);
    const entity: Record<string, unknown> = {
      "@id": placeUri(p),
      "@type": placeClass ? ["lo:Place", `lo:${placeClass}`] : "lo:Place",
      "rdfs:label": p,
      "otv:instanceOf": { "@id": conceptUri("place") },
      "otv:denotedByProperName": properNameRefsJsonForEntity([p], placeUri(p)),
    };
    const parent = placeParentOf(p, placeLabelSet);
    if (parent) entity["lo:locatedIn"] = { "@id": placeUri(parent) };
    const qid = placeQid(p);
    const pleiades = PLACE_PLEIADES[p];
    const sameAs: { "@id": string }[] = [];
    if (qid) sameAs.push({ "@id": wikidataEntityUri(qid) });
    if (pleiades) sameAs.push({ "@id": pleiadesUri(pleiades) });
    if (sameAs.length === 1) entity["owl:sameAs"] = sameAs[0];
    else if (sameAs.length > 1) entity["owl:sameAs"] = sameAs;
    return entity;
  });

  validateWorkFacets(
    new Set([
      ...ce.works,
      ...SOURCE_WORKS.map((sw) => sw.title),
      ...PERSON_WORKS.map((pw) => pw.title),
    ]),
  );
  const workAuthors = buildWorkAuthors();
  const chronByName = new Map(extras.chronology.map((c) => [c.philosopher, c]));
  // Works follow the full OTV double dimension: every title is the work's
  // otv:ProperName (linguistic unit), linked both ways to the work node
  // (conceptual unit). Eponymous titles share their name node with the
  // person - homonymy across kinds is real and modeled.
  const works = ce.works.map((w) => {
    const entity: Record<string, unknown> = {
      "@id": workUri(w),
      "@type": "lo:Work",
      "rdfs:label": w,
      "otv:instanceOf": { "@id": conceptUri("work") },
      "otv:denotedByProperName": properNameRefsJsonForEntity([w], workUri(w)),
    };
    const alts = altByWork.get(w);
    if (alts) entity["lo:alternateTitle"] = alts;
    const grcTitle = greekWorkTitleSpec(w)?.grc;
    if (grcTitle) {
      entity["lo:greekTitle"] = { "@value": grcTitle, "@language": "grc" };
    }
    const tr = transByWork.get(w);
    if (tr) {
      entity["lo:transmissionStatus"] = tr.status;
      if (tr.note) entity["rdfs:comment"] = tr.note;
    }
    const qid = WORK_QIDS[w];
    const enwiki = WORK_ENWIKI[w];
    const workSameAs: { "@id": string }[] = [];
    if (qid) workSameAs.push({ "@id": wikidataEntityUri(qid) });
    if (enwiki) workSameAs.push({ "@id": dbpediaUri(enwiki) });
    if (workSameAs.length > 0) entity["owl:sameAs"] = workSameAs;
    if (enwiki) entity["rdfs:seeAlso"] = { "@id": wikipediaUri(enwiki) };
    applyWorkFacetsJsonLd(entity, resolveWorkFacets(w, workAuthors, chronByName));
    return entity;
  });

  /** foaf:Person-only node: no lo: class, so type it a otv:Object explicitly. */
  const personEntity = (p: string, comment: string): Record<string, unknown> => {
    const entity: Record<string, unknown> = {
      "@id": personUri(p),
      "@type": ["foaf:Person", "otv:Object"],
      "rdfs:label": p,
      "rdfs:comment": comment,
      "otv:instanceOf": { "@id": conceptUri("person") },
      "otv:denotedByProperName": properNameRefsJsonForEntity([p], personUri(p)),
    };
    const roleIds = personRoleNames(p).map((r) => ({ "@id": `${ONT}${r}` }));
    if (roleIds.length > 0) {
      entity["lo:hasRole"] = roleIds.length === 1 ? roleIds[0] : roleIds;
    }
    const wroteIds = personWorkTitlesFor(p).map((t) => ({
      "@id": workUri(t),
    }));
    if (wroteIds.length > 0) {
      entity["lo:wrote"] = wroteIds.length === 1 ? wroteIds[0] : wroteIds;
    }
    const qid = ENTITY_QIDS[p];
    if (qid) entity["owl:sameAs"] = { "@id": wikidataEntityUri(qid) };
    const diff = diffFromByUri.get(personUri(p));
    if (diff) {
      entity["owl:differentFrom"] =
        diff.length === 1 ? { "@id": diff[0]! } : diff.map((u) => ({ "@id": u }));
    }
    return entity;
  };

  const externalPersons = ce.persons.map((p) =>
    personEntity(p, "Mentioned by Diogenes Laertius but without a Life of his own."),
  );

  // Rival attributees of sayings and anecdotes who are neither corpus
  // philosophers nor already among the claim persons still need a person
  // node of their own.
  const attributedOnlyLabels = [
    ...new Set(
      [
        ...sayings.map((s) => s.alsoAttributedTo),
        ...anecdotes.map((a) => a.alsoAttributedTo),
      ].filter(
        (a): a is string => !!a && !byName.has(a) && !ce.persons.includes(a),
      ),
    ),
  ];
  const attributedOnlyPersons = attributedOnlyLabels.map((p) =>
    personEntity(p, "Mentioned by Diogenes Laertius but without a Life of his own."),
  );

  // Poets credited with quoted verses (lo:composedBy) who are neither
  // corpus philosophers nor already among the person nodes above.
  const verseAuthorOnlyLabels = [...new Set(Object.values(VERSE_AUTHORS))]
    .filter(
      (a) =>
        !byName.has(a) &&
        !ce.persons.includes(a) &&
        !attributedOnlyLabels.includes(a),
    )
    .sort();
  const verseAuthorOnlyPersons = verseAuthorOnlyLabels.map((p) =>
    personEntity(
      p,
      p === "Diogenes Laertius"
        ? "The author of the Lives; the epigrams he marks as his own (many from his Pammetros) are linked here."
        : "A poet whose verses are quoted by Diogenes Laertius, without a Life of his own.",
    ),
  );

  // Mention-only persons (person-mentions.ts): rival Seven-Sages
  // candidates and Lasos' fathers. QIDs live in the module, not in
  // entity-links.ts, mirroring MENTION_PLACES.
  validateMentionPersons(
    new Set([
      ...g.nodes.map((n) => n.name),
      ...ce.persons,
      ...ce.sources,
      ...attributedOnlyLabels,
      ...verseAuthorOnlyLabels,
    ]),
  );
  validatePersonWorks(
    new Set([
      ...ce.persons,
      ...attributedOnlyLabels,
      ...verseAuthorOnlyLabels,
      ...MENTION_PERSONS.map((mp) => mp.label),
    ]),
    ce.works,
  );
  const mentionOnlyPersons = MENTION_PERSONS.map((mp) => {
    const entity: Record<string, unknown> = {
      "@id": personUri(mp.label),
      "@type": ["foaf:Person", "otv:Object"],
      "rdfs:label": mp.label,
      "rdfs:comment": mp.comment,
      "otv:instanceOf": { "@id": conceptUri("person") },
      "otv:denotedByProperName": properNameRefsJsonForEntity([mp.label], personUri(mp.label)),
    };
    const roleIds = personRoleNames(mp.label).map((r) => ({
      "@id": `${ONT}${r}`,
    }));
    if (roleIds.length > 0) {
      entity["lo:hasRole"] = roleIds.length === 1 ? roleIds[0] : roleIds;
    }
    const wroteIds = personWorkTitlesFor(mp.label).map((t) => ({
      "@id": workUri(t),
    }));
    if (wroteIds.length > 0) {
      entity["lo:wrote"] = wroteIds.length === 1 ? wroteIds[0] : wroteIds;
    }
    if (mp.qid) entity["owl:sameAs"] = { "@id": wikidataEntityUri(mp.qid) };
    const diff = diffFromByUri.get(personUri(mp.label));
    if (diff) {
      entity["owl:differentFrom"] =
        diff.length === 1 ? { "@id": diff[0]! } : diff.map((u) => ({ "@id": u }));
    }
    return entity;
  });

  validateSourceWorks(ce.sources, ce.works);
  const sourceWorkTitlesBySource = new Map<string, string[]>();
  for (const sw of SOURCE_WORKS) {
    const list = sourceWorkTitlesBySource.get(sw.source) ?? [];
    list.push(sw.title);
    sourceWorkTitlesBySource.set(sw.source, list);
  }

  const sources = ce.sources.map((s) => {
    const entity: Record<string, unknown> = {
      "@id": sourceUri(s),
      "@type": "lo:Source",
      "rdfs:label": s,
      "rdfs:comment": "An authority named by Diogenes Laertius.",
      "otv:instanceOf": { "@id": conceptUri("source") },
      "otv:denotedByProperName": properNameRefsJsonForEntity([s], sourceUri(s)),
    };
    const roleIds = personRoleNames(s).map((r) => ({ "@id": `${ONT}${r}` }));
    if (roleIds.length > 0) {
      entity["lo:hasRole"] = roleIds.length === 1 ? roleIds[0] : roleIds;
    }
    const wrote = sourceWorkTitlesBySource.get(s);
    if (wrote) {
      const ids = wrote.map((t) => ({ "@id": workUri(t) }));
      entity["lo:wrote"] = ids.length === 1 ? ids[0] : ids;
    }
    const qid = ENTITY_QIDS[s];
    if (qid) entity["owl:sameAs"] = { "@id": wikidataEntityUri(qid) };
    const diff = diffFromByUri.get(sourceUri(s));
    if (diff) {
      entity["owl:differentFrom"] =
        diff.length === 1 ? { "@id": diff[0]! } : diff.map((u) => ({ "@id": u }));
    }
    return entity;
  });

  // Works cited as sources (Hermippus' On the Sages, Apollodorus'
  // Chronology): same shape as claims-layer works, plus the curator's
  // comment. The lo:wrote triple lives on the source node above.
  const sourceWorkNodes = SOURCE_WORKS.map((sw) => {
    const entity: Record<string, unknown> = {
      "@id": workUri(sw.title),
      "@type": "lo:Work",
      "rdfs:label": sw.title,
      "rdfs:comment": sw.comment,
      "otv:instanceOf": { "@id": conceptUri("work") },
      "otv:denotedByProperName": properNameRefsJsonForEntity([sw.title], workUri(sw.title)),
    };
    const grcTitle = greekWorkTitleSpec(sw.title)?.grc;
    if (grcTitle) {
      entity["lo:greekTitle"] = { "@value": grcTitle, "@language": "grc" };
    }
    const qid = WORK_QIDS[sw.title];
    const enwiki = WORK_ENWIKI[sw.title];
    const swSameAs: { "@id": string }[] = [];
    if (qid) swSameAs.push({ "@id": wikidataEntityUri(qid) });
    if (enwiki) swSameAs.push({ "@id": dbpediaUri(enwiki) });
    if (swSameAs.length > 0) entity["owl:sameAs"] = swSameAs;
    if (enwiki) entity["rdfs:seeAlso"] = { "@id": wikipediaUri(enwiki) };
    applyWorkFacetsJsonLd(
      entity,
      resolveWorkFacets(sw.title, workAuthors, chronByName),
    );
    return entity;
  });

  // Works quoted from person-only authors (Achaeus' Omphale): same
  // shape as source-authored works, plus the curator's comment. The
  // lo:wrote triple lives on the person node above.
  const personWorkNodes = PERSON_WORKS.map((pw) => {
    const entity: Record<string, unknown> = {
      "@id": workUri(pw.title),
      "@type": "lo:Work",
      "rdfs:label": pw.title,
      "rdfs:comment": pw.comment,
      "otv:instanceOf": { "@id": conceptUri("work") },
      "otv:denotedByProperName": properNameRefsJsonForEntity([pw.title], workUri(pw.title)),
    };
    const grcTitle = greekWorkTitleSpec(pw.title)?.grc;
    if (grcTitle) {
      entity["lo:greekTitle"] = { "@value": grcTitle, "@language": "grc" };
    }
    const qid = WORK_QIDS[pw.title];
    const enwiki = WORK_ENWIKI[pw.title];
    const pwSameAs: { "@id": string }[] = [];
    if (qid) pwSameAs.push({ "@id": wikidataEntityUri(qid) });
    if (enwiki) pwSameAs.push({ "@id": dbpediaUri(enwiki) });
    if (pwSameAs.length > 0) entity["owl:sameAs"] = pwSameAs;
    if (enwiki) entity["rdfs:seeAlso"] = { "@id": wikipediaUri(enwiki) };
    applyWorkFacetsJsonLd(
      entity,
      resolveWorkFacets(pw.title, workAuthors, chronByName),
    );
    return entity;
  });

  // Doctrines are otv:Concepts (never otv:instanceOf - otv:Concept and
  // otv:Object are disjoint); their Greek key terms denote them.
  const doctrines = ce.doctrines.map((d) => {
    const entity: Record<string, unknown> = {
      "@id": doctrineUri(d.label),
      "@type": ["lo:Doctrine", "otv:Concept"],
      "rdfs:label": d.label,
      "otv:conceptName": d.label,
    };
    if (d.greek) {
      entity["lo:usesTerm"] = { "@id": termUri(d.greek) };
      entity["otv:denotedByTerm"] = { "@id": termUri(d.greek) };
    }
    return entity;
  });

  const doctrinesByTerm = new Map<string, string[]>();
  for (const d of ce.doctrines) {
    if (!d.greek) continue;
    const arr = doctrinesByTerm.get(d.greek) ?? [];
    arr.push(d.label);
    doctrinesByTerm.set(d.greek, arr);
  }

  // otv:termName is a plain literal (OTV ranges are xsd:string); the
  // language lives in otv:language, the @grc tag on rdfs:label/greekLemma.
  const terms = ce.terms.map((t) => {
    const entity: Record<string, unknown> = {
      "@id": termUri(t),
      "@type": ["lo:GreekTerm", "otv:Term"],
      "rdfs:label": t,
      "lo:greekLemma": { "@value": t, "@language": "grc" },
      "otv:termName": t,
      "otv:language": "grc",
    };
    const pp = PHILOSOPHY_PAGES[t];
    if (pp) entity["rdfs:seeAlso"] = { "@id": philosophyPagesUri(pp) };
    const denoted = doctrinesByTerm.get(t);
    if (denoted) {
      entity["otv:denotedConcept"] = denoted.map((dl) => ({
        "@id": doctrineUri(dl),
      }));
    }
    return entity;
  });

  // Cited, certainty-tagged claims (reifications of the predicates above).
  const claimNodes = claims.map((c) => {
    const uri = claimValueUri(c);
    const node: Record<string, unknown> = {
      "@id": claimUri(c.id),
      "@type": "lo:Claim",
      "rdf:subject": { "@id": philosopherUri(c.subject) },
      "rdf:predicate": { "@id": `${ONT}${CLAIM_PREDICATE[c.property]}` },
      "rdf:object": uri ? { "@id": uri } : c.value,
      "lo:certainty": { "@id": `${ONT}${CERTAINTY_INDIVIDUAL[c.certainty]}` },
      "dcterms:bibliographicCitation": `Diog. Laert. ${c.ref}`,
    };
    if (c.accordingTo) node["lo:accordingTo"] = { "@id": sourceUri(c.accordingTo) };
    if (c.sourceWork !== undefined) {
      node["lo:assertedInWork"] = { "@id": workUri(c.sourceWork) };
    }
    if (c.chain !== undefined && c.chain.length > 0) {
      node["lo:transmissionChain"] = c.chain.map((link, i) => {
        const item: Record<string, unknown> = {
          "@id": chainLinkUri(c.id, i),
          "@type": "lo:ChainLink",
          "lo:chainAuthority": { "@id": sourceUri(link.authority) },
        };
        if (link.work) item["lo:chainWork"] = { "@id": workUri(link.work) };
        return item;
      });
    }
    if (c.conflictsWith && c.conflictsWith.length > 0) {
      node["lo:conflictsWith"] = c.conflictsWith.map((id) => ({
        "@id": claimUri(id),
      }));
    }
    if (c.grc) node["lo:greekText"] = { "@value": c.grc, "@language": "grc" };
    if (c.note) node["rdfs:comment"] = c.note;
    return node;
  });

  // Sources named only for sayings (not already among the claim sources).
  const sayingSourceNodes = sayingOnlySources.map((s) => {
    const entity: Record<string, unknown> = {
      "@id": sourceUri(s),
      "@type": "lo:Source",
      "rdfs:label": s,
      "rdfs:comment": "An authority named by Diogenes Laertius.",
      "otv:instanceOf": { "@id": conceptUri("source") },
      "otv:denotedByProperName": properNameRefsJsonForEntity([s], sourceUri(s)),
    };
    const roleIds = personRoleNames(s).map((r) => ({ "@id": `${ONT}${r}` }));
    if (roleIds.length > 0) {
      entity["lo:hasRole"] = roleIds.length === 1 ? roleIds[0] : roleIds;
    }
    const qid = ENTITY_QIDS[s];
    if (qid) entity["owl:sameAs"] = { "@id": wikidataEntityUri(qid) };
    const diff = diffFromByUri.get(sourceUri(s));
    if (diff) {
      entity["owl:differentFrom"] =
        diff.length === 1 ? { "@id": diff[0]! } : diff.map((u) => ({ "@id": u }));
    }
    return entity;
  });

  // Sources named only for anecdotes (not already claim or saying sources).
  const anecdoteSourceNodes = anecdoteOnlySources.map((s) => {
    const entity: Record<string, unknown> = {
      "@id": sourceUri(s),
      "@type": "lo:Source",
      "rdfs:label": s,
      "rdfs:comment": "An authority named by Diogenes Laertius.",
      "otv:instanceOf": { "@id": conceptUri("source") },
      "otv:denotedByProperName": properNameRefsJsonForEntity([s], sourceUri(s)),
    };
    const roleIds = personRoleNames(s).map((r) => ({ "@id": `${ONT}${r}` }));
    if (roleIds.length > 0) {
      entity["lo:hasRole"] = roleIds.length === 1 ? roleIds[0] : roleIds;
    }
    const qid = ENTITY_QIDS[s];
    if (qid) entity["owl:sameAs"] = { "@id": wikidataEntityUri(qid) };
    const diff = diffFromByUri.get(sourceUri(s));
    if (diff) {
      entity["owl:differentFrom"] =
        diff.length === 1 ? { "@id": diff[0]! } : diff.map((u) => ({ "@id": u }));
    }
    return entity;
  });

  // Cited sayings & apophthegms (reifications of lo:said).
  const sayingNodes = sayings.map((s) => {
    const node: Record<string, unknown> = {
      "@id": sayingUri(s.id),
      "@type": "lo:Saying",
      "rdf:subject": { "@id": philosopherUri(s.philosopher) },
      "rdf:predicate": { "@id": `${ONT}said` },
      "rdf:object": { "@value": s.en, "@language": "en" },
      "lo:certainty": { "@id": `${ONT}${CERTAINTY_INDIVIDUAL[s.certainty]}` },
      "lo:gloss": s.gloss,
      "lo:sayingTopic": s.topic,
      "dcterms:bibliographicCitation": `Diog. Laert. ${s.ref}`,
    };
    const sectionId = sectionIdForRef(s.ref, s.philosopher);
    if (sectionId) {
      node["dcterms:source"] =
        `urn:cts:greekLit:tlg0004.tlg001.perseus-grc2:${sectionId}`;
    }
    if (s.grc) node["lo:greekText"] = { "@value": s.grc, "@language": "grc" };
    if (s.accordingTo) node["lo:accordingTo"] = { "@id": sourceUri(s.accordingTo) };
    if (s.alsoAttributedTo) {
      node["lo:alsoAttributedTo"] = {
        "@id": byName.has(s.alsoAttributedTo)
          ? philosopherUri(s.alsoAttributedTo)
          : personUri(s.alsoAttributedTo),
      };
    }
    // The named interlocutor: an object property when the label matches a
    // corpus philosopher (an existing node), otherwise a datatype literal  - 
    // we never mint new person nodes here, so the gazetteer (and with it the
    // pinned annotation layer) is unaffected.
    if (s.to) {
      if (byName.has(s.to)) {
        node["lo:addressedTo"] = { "@id": philosopherUri(s.to) };
      } else {
        node["lo:addresseeName"] = s.to;
      }
    }
    if (s.note) node["rdfs:comment"] = s.note;
    return node;
  });

  // The quoted poems, epigrams, oracles and epitaphs (verse layer).
  // Prologue verses carry no philosopher link (the Prologue has no node).
  const verseNodes = verses.map((v) => {
    const node: Record<string, unknown> = {
      "@id": verseUri(v.id),
      "@type": v.genre === "epigram" ? ["lo:Verse", "lo:Epigram"] : "lo:Verse",
      "lo:greekText": { "@value": v.linesGrc.join("\n"), "@language": "grc" },
      "dcterms:bibliographicCitation": verseCitation(v),
      "dcterms:source": `urn:cts:greekLit:tlg0004.tlg001.perseus-grc2:${v.sectionId}`,
    };
    if (byName.has(v.philosopher)) {
      node["lo:quotedInLifeOf"] = { "@id": philosopherUri(v.philosopher) };
    }
    const author = VERSE_AUTHORS[v.id];
    if (author) {
      node["lo:composedBy"] = {
        "@id": byName.has(author) ? philosopherUri(author) : personUri(author),
      };
    }
    if (v.linesEn) {
      node["lo:englishText"] = { "@value": v.linesEn.join("\n"), "@language": "en" };
    }
    if (v.source) node["lo:verseSource"] = v.source;
    if (v.continued) node["lo:continuesPrevious"] = true;
    return node;
  });

  // The letters D.L. quotes verbatim (epistle layer): document nodes, not
  // reifications - a letter is a quoted text with a sender and an addressee,
  // not a statement about the world. The curator's authenticity verdict
  // (authentic / disputed / spurious) is its own axis, distinct from the
  // claims' certainty model.
  const epistleNodes = getEpistles().map((e) => {
    const node: Record<string, unknown> = {
      "@id": epistleUri(e.id),
      "@type": "lo:Epistle",
      "rdfs:label": `${e.sender} to ${e.to}`,
      "lo:englishText": { "@value": e.en, "@language": "en" },
      "lo:gloss": e.gloss,
      "lo:epistleTopic": e.topic,
      "lo:authenticity": {
        "@id": `${ONT}${AUTHENTICITY_INDIVIDUAL[e.authenticity]}`,
      },
      "dcterms:bibliographicCitation": `Diog. Laert. ${epistleRefForDisplay(e.ref)}`,
      "dcterms:source": `urn:cts:greekLit:tlg0004.tlg001.perseus-grc2:${e.ref}`,
    };
    if (e.grc) node["lo:greekText"] = { "@value": e.grc, "@language": "grc" };
    // Sender and addressee: object links only to existing philosopher
    // nodes, literals otherwise (no new person nodes - keeps the gazetteer
    // and pinned annotations stable).
    if (byName.has(e.sender)) {
      node["lo:sentBy"] = { "@id": philosopherUri(e.sender) };
    } else {
      node["lo:senderName"] = e.sender;
    }
    if (byName.has(e.to)) {
      node["lo:addressedTo"] = { "@id": philosopherUri(e.to) };
    } else {
      node["lo:addresseeName"] = e.to;
    }
    if (e.dramaticDate) node["lo:dramaticDate"] = e.dramaticDate;
    if (e.note) node["rdfs:comment"] = e.note;
    return node;
  });

  // The narrated biographical incidents (anecdote layer): document nodes
  // like the epistles, NOT reifications - an anecdote is a story the text
  // tells about a philosopher, not a statement he made. Certainty tracks
  // D.L.'s stance toward the story; lo:framesSaying links an anecdote to
  // the curated saying whose narrative setting it gives. Participants are
  // object links only to existing philosopher nodes, literals otherwise  - 
  // the anecdote layer mints no new person nodes, so the gazetteer and
  // pinned annotations stay stable.
  const anecdoteNodes = anecdotes.map((a) => {
    const node: Record<string, unknown> = {
      "@id": anecdoteUri(a.id),
      "@type": "lo:Anecdote",
      "rdfs:label": a.gloss,
      "lo:about": { "@id": philosopherUri(a.philosopher) },
      "lo:englishText": { "@value": a.en, "@language": "en" },
      "lo:gloss": a.gloss,
      "lo:anecdoteTopic": a.topic,
      "lo:certainty": { "@id": `${ONT}${CERTAINTY_INDIVIDUAL[a.certainty]}` },
      "dcterms:bibliographicCitation": `Diog. Laert. ${a.ref}`,
    };
    const sectionId = sectionIdForRef(a.ref, a.philosopher);
    if (sectionId) {
      node["dcterms:source"] =
        `urn:cts:greekLit:tlg0004.tlg001.perseus-grc2:${sectionId}`;
    }
    if (a.grc) node["lo:greekText"] = { "@value": a.grc, "@language": "grc" };
    if (a.accordingTo) node["lo:accordingTo"] = { "@id": sourceUri(a.accordingTo) };
    if (a.alsoAttributedTo) {
      node["lo:alsoAttributedTo"] = {
        "@id": byName.has(a.alsoAttributedTo)
          ? philosopherUri(a.alsoAttributedTo)
          : personUri(a.alsoAttributedTo),
      };
    }
    if (a.involves) {
      if (byName.has(a.involves)) {
        node["lo:involves"] = { "@id": philosopherUri(a.involves) };
      } else {
        node["lo:participantName"] = a.involves;
      }
    }
    if (a.framesSaying) {
      node["lo:framesSaying"] = { "@id": sayingUri(a.framesSaying) };
    }
    if (a.note) node["rdfs:comment"] = a.note;
    return node;
  });

  // The doctrinal tenets D.L. reports (doxography layer): document nodes
  // like the anecdotes - a doxa is the verbatim doctrinal passage,
  // classified by a controlled domain, not a reified statement.
  // lo:heldBy links the corpus philosopher; when the tenet instantiates a
  // doctrine the graph already knows from the claims layer,
  // lo:expressesDoctrine links that existing node. The layer mints
  // NOTHING: authorities are validator-restricted to existing lo:Source
  // labels, and rival attributions stay literals unless the name is a
  // corpus philosopher - so the gazetteer and pinned annotations stay
  // stable.
  const doxaNodes = doxai.map((d) => {
    const node: Record<string, unknown> = {
      "@id": doxaUri(d.id),
      "@type": "lo:Doxa",
      "rdfs:label": d.gloss,
      "lo:heldBy": { "@id": philosopherUri(d.philosopher) },
      "lo:englishText": { "@value": d.en, "@language": "en" },
      "lo:gloss": d.gloss,
      "lo:doxaDomain": d.domain,
      "lo:certainty": { "@id": `${ONT}${CERTAINTY_INDIVIDUAL[d.certainty]}` },
      "dcterms:bibliographicCitation": `Diog. Laert. ${d.ref}`,
    };
    const sectionId = doxaSectionIdFor(d.ref, d.philosopher);
    if (sectionId) {
      node["dcterms:source"] =
        `urn:cts:greekLit:tlg0004.tlg001.perseus-grc2:${sectionId}`;
    }
    if (d.grc) node["lo:greekText"] = { "@value": d.grc, "@language": "grc" };
    if (d.doctrine) {
      node["lo:expressesDoctrine"] = { "@id": doctrineUri(d.doctrine) };
    }
    if (d.accordingTo) {
      node["lo:accordingTo"] = { "@id": sourceUri(d.accordingTo) };
    }
    if (d.alsoAttributedTo) {
      if (byName.has(d.alsoAttributedTo)) {
        node["lo:alsoAttributedTo"] = {
          "@id": philosopherUri(d.alsoAttributedTo),
        };
      } else {
        node["lo:rivalAttributionName"] = d.alsoAttributedTo;
      }
    }
    if (d.note) node["rdfs:comment"] = d.note;
    return node;
  });

  // The wills D.L. quotes verbatim (testament layer): document nodes like
  // the epistles and anecdotes. Beneficiaries, executors and witnesses are
  // ALWAYS literals - the wills teem with bare homonyms (never guess);
  // only lo:involves links nodes, restricted to corpus philosophers whose
  // identification is scholarly consensus (each the testator's successor).
  const testamentNodes = getTestaments().map((t) => {
    const node: Record<string, unknown> = {
      "@id": testamentUri(t.id),
      "@type": "lo:Testament",
      "rdfs:label": `Will of ${t.philosopher}`,
      "lo:testator": { "@id": philosopherUri(t.philosopher) },
      "lo:englishText": { "@value": t.en, "@language": "en" },
      "lo:greekText": { "@value": t.grc, "@language": "grc" },
      "lo:gloss": t.gloss,
      "lo:beneficiaryName": t.beneficiaries,
      "lo:provision": t.provisions,
      "dcterms:bibliographicCitation": `Diog. Laert. ${testamentRefForDisplay(t)}`,
      "dcterms:source": `urn:cts:greekLit:tlg0004.tlg001.perseus-grc2:${t.ref}`,
    };
    if (t.executors.length > 0) node["lo:executorName"] = t.executors;
    if (t.witnesses.length > 0) node["lo:witnessName"] = t.witnesses;
    if (t.involves.length > 0) {
      node["lo:involves"] = t.involves.map((name) => ({
        "@id": philosopherUri(name),
      }));
    }
    if (t.note) node["rdfs:comment"] = t.note;
    return node;
  });

  // Principal-doctrine entities for the schools (distinct from claim doctrines).
  const claimDoctrineLabels = new Set(ce.doctrines.map((d) => d.label));
  const schoolDoctrineNodes = extras.schoolDoctrines
    .filter((sd) => !claimDoctrineLabels.has(sd.doctrine))
    .map((sd) => ({
      "@id": doctrineUri(sd.doctrine),
      "@type": ["lo:Doctrine", "otv:Concept"],
      "rdfs:label": sd.doctrine,
      "otv:conceptName": sd.doctrine,
    }));

  // Ontoterminological layer (OTV): the concepts our individuals instantiate
  // and the proper names that denote them.
  const conceptNodes = OTV_CONCEPTS.map((c) => {
    const node: Record<string, unknown> = {
      "@id": conceptUri(c.kind),
      "@type": "otv:Concept",
      "rdfs:label": c.name,
      "otv:conceptName": c.name,
    };
    if (c.isA) node["otv:isA"] = { "@id": conceptUri(c.isA) };
    return node;
  });

  // Cited authorities from the curated sources index (the user's workbook):
  // new lo:Source nodes for authorities the graph did not already know,
  // name/link supplements for the ones it did, and one lo:SourceCitation
  // node per workbook row.
  const srcIndex = getSourcesIndex();
  const mintedSourceNodes: Record<string, unknown>[] = [];
  const sourceSupplementNodes: Record<string, unknown>[] = [];
  for (const gr of srcIndex.groups) {
    const uri = sourceGroupUri(gr);
    if (!gr.existing) {
      const labels: unknown[] = [gr.label];
      if (gr.nameGrc) labels.push({ "@value": gr.nameGrc, "@language": "grc" });
      if (gr.nameFr) labels.push({ "@value": gr.nameFr, "@language": "fr" });
      const entity: Record<string, unknown> = {
        "@id": uri,
        "@type": "lo:Source",
        "rdfs:label": labels.length === 1 ? labels[0] : labels,
        "rdfs:comment": "An authority named by Diogenes Laertius.",
        "otv:instanceOf": { "@id": conceptUri("source") },
        "otv:denotedByProperName": properNameRefsJsonForEntity(
          [gr.label, ...sourceGroupAltNames(gr)],
          uri,
        ),
      };
      const roleIds = personRoleNames(gr.label).map((r) => ({
        "@id": `${ONT}${r}`,
      }));
      if (roleIds.length > 0) {
        entity["lo:hasRole"] = roleIds.length === 1 ? roleIds[0] : roleIds;
      }
      if (gr.qid) entity["owl:sameAs"] = { "@id": wikidataEntityUri(gr.qid) };
      if (gr.certainty) entity["lo:identificationCertainty"] = gr.certainty;
      mintedSourceNodes.push(entity);
    } else {
      const supplement: Record<string, unknown> = { "@id": uri };
      const labels: unknown[] = [];
      if (gr.nameGrc) labels.push({ "@value": gr.nameGrc, "@language": "grc" });
      if (gr.nameFr) labels.push({ "@value": gr.nameFr, "@language": "fr" });
      if (labels.length > 0) {
        supplement["rdfs:label"] = labels.length === 1 ? labels[0] : labels;
      }
      if (gr.qid && !hasCuratedQid(gr)) {
        supplement["owl:sameAs"] = { "@id": wikidataEntityUri(gr.qid) };
      }
      if (gr.certainty && gr.kind === "source") {
        supplement["lo:identificationCertainty"] = gr.certainty;
      }
      const altNames = sourceGroupAltNames(gr);
      if (altNames.length > 0) {
        supplement["otv:denotedByProperName"] = properNameRefsJsonForEntity(
          altNames,
          uri,
        );
      }
      if (Object.keys(supplement).length > 1) {
        sourceSupplementNodes.push(supplement);
      }
    }
  }
  validatePersonRoles(
    new Set([
      ...ce.persons,
      ...attributedOnlyLabels,
      ...verseAuthorOnlyLabels,
      ...MENTION_PERSONS.map((mp) => mp.label),
      ...ce.sources,
      ...sayingOnlySources,
      ...anecdoteOnlySources,
      ...srcIndex.groups.filter((gr) => !gr.existing).map((gr) => gr.label),
    ]),
    new Set(g.nodes.map((n) => n.name)),
  );
  // Cited school memberships (school-members.ts): asserted members get
  // the direct lo:memberOf triple on their existing node; EVERY entry
  // gets a reified rdf:Statement with the D.L. citation; hedged entries
  // (Timocrates) exist ONLY as reifications, mirroring the claims model.
  // The source pool is the BASE graph's sources (claim, saying and
  // anecdote authorities plus the minted authorities the source-mentions
  // layer opts into tagging), so a membership can never point at a node
  // that exists only in the full sourcesIndex graph.
  validateSchoolMembers(
    new Set([
      ...ce.persons,
      ...attributedOnlyLabels,
      ...verseAuthorOnlyLabels,
      ...MENTION_PERSONS.map((mp) => mp.label),
    ]),
    new Set([
      ...ce.sources,
      ...sayingOnlySources,
      ...anecdoteOnlySources,
      ...taggedMintedGroups(srcIndex.groups)
        .filter((gr) => sourceGroupUri(gr) === sourceUri(gr.label))
        .map((gr) => gr.label),
    ]),
    new Set(g.movements.map((m) => m.id)),
  );
  const membershipTargets = new Map<string, Record<string, unknown>>();
  for (const e of [
    ...externalPersons,
    ...attributedOnlyPersons,
    ...verseAuthorOnlyPersons,
    ...mentionOnlyPersons,
    ...sources,
    ...sayingSourceNodes,
    ...anecdoteSourceNodes,
    ...mintedSourceNodes,
  ]) {
    membershipTargets.set(e["@id"] as string, e);
  }
  const membershipStatements: Record<string, unknown>[] = [];
  for (const m of SCHOOL_MEMBERS) {
    const uri = m.node === "person" ? personUri(m.label) : sourceUri(m.label);
    if (m.asserted) {
      const entity = membershipTargets.get(uri);
      if (!entity) {
        throw new Error(
          `school-members.ts: no emitted ${m.node} entity found for "${m.label}"`,
        );
      }
      // Append, never overwrite: a node curated into two schools must
      // keep both memberships, exactly as the Turtle side does with its
      // one-triple-per-entry lines (the serializations may never drift).
      const prev = entity["lo:memberOf"];
      const next = { "@id": schoolUri(m.school) };
      if (prev === undefined) entity["lo:memberOf"] = next;
      else if (Array.isArray(prev)) prev.push(next);
      else entity["lo:memberOf"] = [prev, next];
    }
    const st: Record<string, unknown> = {
      "@type": "rdf:Statement",
      "rdf:subject": { "@id": uri },
      "rdf:predicate": { "@id": `${ONT}memberOf` },
      "rdf:object": { "@id": schoolUri(m.school) },
      "dcterms:bibliographicCitation": `Diog. Laert. ${m.ref}`,
    };
    if (m.note) st["rdfs:comment"] = m.note;
    membershipStatements.push(st);
  }
  // Cited succession links (succession-links.ts): asserted links get
  // the direct lo:teacherOf triple on the teacher's existing node;
  // EVERY link gets a reified rdf:Statement with the D.L. citation and
  // the named authorities; hedged links (the Hippobotus/Sotion pupil
  // list of 9.115) exist ONLY as reifications, mirroring the
  // school-members model.
  validateSuccessionLinks(
    new Set(g.nodes.map((n) => n.name)),
    new Set([
      ...ce.persons,
      ...attributedOnlyLabels,
      ...verseAuthorOnlyLabels,
      ...MENTION_PERSONS.map((mp) => mp.label),
    ]),
    new Set([
      ...ce.sources,
      ...sayingOnlySources,
      ...anecdoteOnlySources,
      ...taggedMintedGroups(srcIndex.groups)
        .filter((gr) => sourceGroupUri(gr) === sourceUri(gr.label))
        .map((gr) => gr.label),
    ]),
  );
  const successionTargets = new Map<string, Record<string, unknown>>(
    membershipTargets,
  );
  for (const e of persons) {
    successionTargets.set(e["@id"] as string, e);
  }
  for (const l of SUCCESSION_LINKS) {
    const tUri = successionEndpointUri(l.teacher);
    const pUri = successionEndpointUri(l.pupil);
    if (l.asserted) {
      const entity = successionTargets.get(tUri);
      if (!entity) {
        throw new Error(
          `succession-links.ts: no emitted ${l.teacher.node} entity found for "${l.teacher.label}"`,
        );
      }
      // Append, never overwrite: KG edges may already have put
      // lo:teacherOf on a philosopher node (the serializations may
      // never drift from the Turtle's one-triple-per-link lines).
      const prev = entity["lo:teacherOf"];
      const next = { "@id": pUri };
      if (prev === undefined) entity["lo:teacherOf"] = next;
      else if (Array.isArray(prev)) prev.push(next);
      else entity["lo:teacherOf"] = [prev, next];
    }
    const st: Record<string, unknown> = {
      "@type": "rdf:Statement",
      "rdf:subject": { "@id": tUri },
      "rdf:predicate": { "@id": `${ONT}teacherOf` },
      "rdf:object": { "@id": pUri },
      "dcterms:bibliographicCitation": `Diog. Laert. ${l.ref}`,
    };
    if (l.accordingTo && l.accordingTo.length > 0) {
      const refs = l.accordingTo.map((a) => ({ "@id": sourceUri(a) }));
      st["lo:accordingTo"] = refs.length === 1 ? refs[0] : refs;
    }
    if (l.note) st["rdfs:comment"] = l.note;
    membershipStatements.push(st);
  }
  const rowGroups = citationGroupsByRow(srcIndex.groups);
  const citationNodes = srcIndex.rows.map((r) => {
    const gr = rowGroups.get(r.id);
    const node: Record<string, unknown> = {
      "@id": citationUri(r.id),
      "@type": "lo:SourceCitation",
      "rdfs:label": citationLabel(r, gr),
      "dcterms:identifier": r.id,
    };
    if (r.refRaw) {
      node["dcterms:bibliographicCitation"] = `Diog. Laert. ${r.refRaw}`;
    }
    if (gr) node["lo:citedAuthor"] = { "@id": sourceGroupUri(gr) };
    const titles: unknown[] = [];
    if (r.workGrc) titles.push({ "@value": r.workGrc, "@language": "grc" });
    if (r.workEn) titles.push({ "@value": r.workEn, "@language": "en" });
    if (r.workFr) titles.push({ "@value": r.workFr, "@language": "fr" });
    if (titles.length > 0) {
      node["lo:citedWorkTitle"] = titles.length === 1 ? titles[0] : titles;
    }
    const urns = citationSectionUrns(r);
    if (urns.length > 0) {
      node["dcterms:source"] = urns.length === 1 ? urns[0] : urns;
    }
    if (r.certainty) node["lo:identificationCertainty"] = r.certainty;
    return node;
  });

  const namePairs: [string, string][] = [
    ...g.nodes.map((n): [string, string] => [n.name, philosopherUri(n.name)]),
    ...g.movements.map((m): [string, string] => [m.label, schoolUri(m.id)]),
    ...ce.schools.map((s): [string, string] => [s, claimSchoolUri(s)]),
    ...allPlaces(ce.places).map((p): [string, string] => [p, placeUri(p)]),
    ...[
      ...ce.persons,
      ...attributedOnlyLabels,
      ...verseAuthorOnlyLabels,
      ...MENTION_PERSONS.map((mp) => mp.label),
    ].map((p): [string, string] => [p, personUri(p)]),
    ...[...ce.sources, ...sayingOnlySources, ...anecdoteOnlySources].map(
      (s): [string, string] => [s, sourceUri(s)],
    ),
    ...sourceIndexNamePairs(srcIndex.groups),
    ...[
      ...ce.works,
      ...SOURCE_WORKS.map((sw) => sw.title),
      ...PERSON_WORKS.map((pw) => pw.title),
    ].map((t): [string, string] => [t, workUri(t)]),
  ];
  const properNameNodes = [...groupProperNames(namePairs)].map(([uri, e]) => {
    const labels = [...e.labels].sort();
    return {
      "@id": uri,
      "@type": "otv:ProperName",
      "otv:properName": labels.length === 1 ? labels[0] : labels,
      "otv:language": "en",
      "otv:denotedObject": { "@id": e.entityUri },
    };
  });
  // Per-language split: each Greek form gets a per-entity otv:ProperName node.
  // Collision forms (nominatives shared by multiple entities) get disambiguated
  // URIs; unique forms keep the stable per-form URI. Plain xsd:string literals
  // only: the OTV core declares otv:properName range xsd:string, so
  // language-tagged literals would make the merged graph OWL-inconsistent.
  const greekPairs: [string, string][] = namePairs.flatMap(([label, uri]) =>
    greekFormsForLabel(label).map((g): [string, string] => [g, uri]),
  );
  const greekProperNameNodes = [
    ...groupGreekProperNamesPerEntity(greekPairs),
  ].map(([uri, e]) => {
    const forms = [...e.forms].sort();
    return {
      "@id": uri,
      "@type": "otv:ProperName",
      "otv:properName": forms.length === 1 ? forms[0] : forms,
      "otv:language": "grc",
      "otv:denotedObject": { "@id": e.entityUri },
    };
  });

  // Reified statements carrying the D.L. citation for the ontology extras.
  const extraStatements: Record<string, unknown>[] = [];
  for (const a of extras.altTitles) {
    extraStatements.push({
      "@type": "rdf:Statement",
      "rdf:subject": { "@id": workUri(a.work) },
      "rdf:predicate": { "@id": `${ONT}alternateTitle` },
      "rdf:object": a.altTitle,
      "dcterms:bibliographicCitation": `Diog. Laert. ${a.ref}`,
    });
  }
  for (const sd of extras.schoolDoctrines) {
    const st: Record<string, unknown> = {
      "@type": "rdf:Statement",
      "rdf:subject": { "@id": schoolUri(sd.school) },
      "rdf:predicate": { "@id": `${ONT}principalDoctrine` },
      "rdf:object": { "@id": doctrineUri(sd.doctrine) },
      "dcterms:bibliographicCitation": `Diog. Laert. ${sd.ref}`,
    };
    if (sd.note) st["rdfs:comment"] = sd.note;
    extraStatements.push(st);
  }
  for (const tr of extras.workTransmission) {
    const st: Record<string, unknown> = {
      "@type": "rdf:Statement",
      "rdf:subject": { "@id": workUri(tr.work) },
      "rdf:predicate": { "@id": `${ONT}transmissionStatus` },
      "rdf:object": tr.status,
      "dcterms:bibliographicCitation": `Diog. Laert. ${tr.ref}`,
    };
    if (tr.note) st["rdfs:comment"] = tr.note;
    extraStatements.push(st);
  }
  for (const f of extras.founderLinks) {
    if (!f.ref || !byName.has(f.philosopher)) continue;
    extraStatements.push({
      "@type": "rdf:Statement",
      "rdf:subject": { "@id": philosopherUri(f.philosopher) },
      "rdf:predicate": { "@id": `${ONT}foundedSchool` },
      "rdf:object": { "@id": schoolUri(f.school) },
      "dcterms:bibliographicCitation": `Diog. Laert. ${f.ref}`,
    });
  }
  for (const ch of extras.chronology) {
    if (!byName.has(ch.philosopher) || ch.refs.length === 0) continue;
    const citation = `Diog. Laert. ${ch.refs.join("; ")}`;
    for (const [pred, obj] of [
      ["earliestYear", ch.earliestYear],
      ["latestYear", ch.latestYear],
    ] as const) {
      extraStatements.push({
        "@type": "rdf:Statement",
        "rdf:subject": { "@id": philosopherUri(ch.philosopher) },
        "rdf:predicate": { "@id": `${ONT}${pred}` },
        "rdf:object": obj,
        "dcterms:bibliographicCitation": citation,
      });
    }
  }

  // One lo:Chapter document node per Life, linking the chapter of the
  // Lives to the person it is about.
  const chapterNodes = g.nodes.map((n) => ({
    "@id": chapterUri(n.book, n.chapter),
    "@type": "lo:Chapter",
    "rdfs:label": chapterLabel(n.name, n.book, n.chapter),
    "lo:inBook": n.book,
    "lo:chapterNumber": chapterNumberOf(n),
    "lo:hasMainSubject": { "@id": philosopherUri(n.name) },
    "dcterms:source": `urn:cts:greekLit:tlg0004.tlg001.perseus-grc2:${n.book}.${n.chapter}`,
  }));

  return {
    "@context": JSONLD_CONTEXT,
    "@graph": [
      ...schools,
      ...claimSchools,
      ...persons,
      ...chapterNodes,
      ...places,
      ...works,
      ...externalPersons,
      ...attributedOnlyPersons,
      ...verseAuthorOnlyPersons,
      ...mentionOnlyPersons,
      ...sources,
      ...sourceWorkNodes,
      ...personWorkNodes,
      ...doctrines,
      ...schoolDoctrineNodes,
      ...terms,
      ...conceptNodes,
      ...properNameNodes,
      ...greekProperNameNodes,
      ...statements,
      ...extraStatements,
      ...membershipStatements,
      ...claimNodes,
      ...sayingSourceNodes,
      ...anecdoteSourceNodes,
      ...sayingNodes,
      ...verseNodes,
      ...epistleNodes,
      ...anecdoteNodes,
      ...doxaNodes,
      ...testamentNodes,
      ...mintedSourceNodes,
      ...sourceSupplementNodes,
      ...citationNodes,
    ],
  };
}

function ttlEscape(s: string): string {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r");
}

/**
 * Serialize the full graph as Turtle.
 *
 * `sourcesIndex: false` omits the workbook sources-index layer (minted
 * source nodes, name/link supplements, lo:SourceCitation rows). The
 * gazetteer builds from that curated-core view so the bibliographic
 * index - full of bare homonyms like "Apollodorus" - never leaks into
 * the deterministic text-tagging layer. Every public serialization
 * (Turtle/JSON-LD/RDF-XML endpoints, sectionQuads) uses the default.
 */
export function graphAsTurtle(
  opts: { sourcesIndex?: boolean } = {},
): string {
  const sourcesIndex = opts.sourcesIndex !== false;
  const g = getKnowledgeGraph();
  const byName = new Map(g.nodes.map((n) => [n.name, n]));
  const claims = getClaims();
  const ce = getClaimEntities();
  const sayings = getSayings();
  const anecdotes = getAnecdotes();
  const doxai = getDoxai();
  const claimSourceLabels = new Set(ce.sources);
  const sayingOnlySources = [
    ...new Set(
      sayings
        .map((s) => s.accordingTo)
        .filter((a): a is string => !!a && !claimSourceLabels.has(a)),
    ),
  ];
  const sayingSourceSet = new Set(sayingOnlySources);
  const anecdoteOnlySources = [
    ...new Set(
      anecdotes
        .map((a) => a.accordingTo)
        .filter(
          (a): a is string =>
            !!a && !claimSourceLabels.has(a) && !sayingSourceSet.has(a),
        ),
    ),
  ];

  // Pre-populate the Greek collision slug set before building any entity node.
  let diffFromByUriTtl: Map<string, string[]>;
  {
    const _attrLabelsTtl = [
      ...new Set(
        [
          ...sayings.map((s) => s.alsoAttributedTo),
          ...anecdotes.map((a) => a.alsoAttributedTo),
        ].filter(
          (a): a is string => !!a && !byName.has(a) && !ce.persons.includes(a),
        ),
      ),
    ];
    const _vaLabelsTtl = [...new Set(Object.values(VERSE_AUTHORS))]
      .filter(
        (a) =>
          !byName.has(a) &&
          !ce.persons.includes(a) &&
          !_attrLabelsTtl.includes(a),
      )
      .sort();
    const _initPairsTtl: [string, string][] = [
      ...g.nodes.map((n): [string, string] => [n.name, philosopherUri(n.name)]),
      ...g.movements.map((m): [string, string] => [m.label, schoolUri(m.id)]),
      ...ce.schools.map((s): [string, string] => [s, claimSchoolUri(s)]),
      ...allPlaces(ce.places).map((p): [string, string] => [p, placeUri(p)]),
      ...[
        ...ce.persons,
        ..._attrLabelsTtl,
        ..._vaLabelsTtl,
        ...MENTION_PERSONS.map((mp) => mp.label),
      ].map((p): [string, string] => [p, personUri(p)]),
      ...[...ce.sources, ...sayingOnlySources, ...anecdoteOnlySources].map(
        (s): [string, string] => [s, sourceUri(s)],
      ),
      // Always use the full source index here so the collision sets are seeded
      // from the same superset regardless of which serializer runs first.
      // The sourcesIndex flag controls what goes INTO the graph (below), not
      // what counts as a collision for ProperName URI disambiguation.
      ...sourceIndexNamePairs(getSourcesIndex().groups),
      ...[
        ...ce.works,
        ...SOURCE_WORKS.map((sw) => sw.title),
        ...PERSON_WORKS.map((pw) => pw.title),
      ].map((t): [string, string] => [t, workUri(t)]),
    ];
    computeCollisionGrcSlugs(_initPairsTtl);
    computeCollisionEnLabels(_initPairsTtl);
    // owl:differentFrom over the person-like nodes this serializer emits
    // (philosophers always; person and source labels only when a curator
    // certified the bearer); sourcesIndex-only names deliberately excluded
    // (they are not graph nodes).
    diffFromByUriTtl = greekDifferentFromMap([
      ...g.nodes.map((n): [string, string] => [n.name, philosopherUri(n.name)]),
      ...[
        ...ce.persons,
        ..._attrLabelsTtl,
        ..._vaLabelsTtl,
        ...MENTION_PERSONS.map((mp) => mp.label),
      ]
        .filter((p) => GREEK_HOMONYM_CERTIFIED_BEARERS.has(p))
        .map((p): [string, string] => [p, personUri(p)]),
      ...[...ce.sources, ...sayingOnlySources, ...anecdoteOnlySources]
        .filter((s) => GREEK_HOMONYM_CERTIFIED_BEARERS.has(s))
        .map((s): [string, string] => [s, sourceUri(s)]),
    ]);
  }

  const lines: string[] = [
    `@prefix lo: <${ONT}> .`,
    "@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .",
    "@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .",
    "@prefix owl: <http://www.w3.org/2002/07/owl#> .",
    "@prefix foaf: <http://xmlns.com/foaf/0.1/> .",
    "@prefix dcterms: <http://purl.org/dc/terms/> .",
    "@prefix wd: <http://www.wikidata.org/entity/> .",
    `@prefix otv: <${OTV}> .`,
    "",
  ];
  const extras = getOntologyExtras();
  const principalBySchool = new Map<string, string[]>();
  for (const sd of extras.schoolDoctrines) {
    const arr = principalBySchool.get(sd.school) ?? [];
    arr.push(sd.doctrine);
    principalBySchool.set(sd.school, arr);
  }
  const altByWork = new Map<string, string[]>();
  for (const a of extras.altTitles) {
    const arr = altByWork.get(a.work) ?? [];
    arr.push(a.altTitle);
    altByWork.set(a.work, arr);
  }
  const transByWork = new Map<string, (typeof extras.workTransmission)[number]>();
  for (const tr of extras.workTransmission) transByWork.set(tr.work, tr);
  const founderBySubject = new Map<string, MovementId>();
  for (const f of extras.founderLinks) founderBySubject.set(f.philosopher, f.school);
  const chronBySubject = new Map<string, (typeof extras.chronology)[number]>();
  for (const ch of extras.chronology) chronBySubject.set(ch.philosopher, ch);

  for (const m of g.movements) {
    const triples = [
      `a lo:School`,
      `rdfs:label "${ttlEscape(m.label)}"@en`,
      `otv:instanceOf <${conceptUri("school")}>`,
      `otv:denotedByProperName ${properNameRefsTtlForEntity([m.label], schoolUri(m.id))}`,
    ];
    for (const d of principalBySchool.get(m.id) ?? []) {
      triples.push(`lo:principalDoctrine <${doctrineUri(d)}>`);
    }
    lines.push(`<${schoolUri(m.id)}> ${triples.join(" ; ")} .`);
  }
  lines.push("");
  // owl:differentFrom pairs live in diffFromByUriTtl (computed above): all
  // person-like nodes sharing a Greek proper-name form are certified-distinct
  // individuals, except the curated same-individual label pairs.
  assertDualSages(g.nodes);
  for (const n of g.nodes) {
    const philUri = philosopherUri(n.name);
    const triples: string[] = [
      `a ${chapterSubjectClasses(n.name, n.book)
        .map((c) => `lo:${c}`)
        .join(", ")}, foaf:Person`,
      `rdfs:label "${ttlEscape(n.name)}"@en`,
      `lo:memberOf <${schoolUri(n.movement)}>`,
      `lo:describedInBook ${n.book}`,
      `dcterms:source "urn:cts:greekLit:tlg0004.tlg001.perseus-grc2:${n.book}.${n.chapter}"`,
      `otv:instanceOf ${chapterSubjectConcepts(n.name, n.book)
        .map((k) => `<${conceptUri(k)}>`)
        .join(", ")}`,
      `otv:denotedByProperName ${properNameRefsTtlForEntity([n.name], philosopherUri(n.name))}`,
      `lo:hasRole ${philosopherRoleNames(n.name)
        .map((r) => `lo:${r}`)
        .join(", ")}`,
    ];
    const foundedSchool = founderBySubject.get(n.name);
    if (foundedSchool) triples.push(`lo:foundedSchool <${schoolUri(foundedSchool)}>`);
    const chron = chronBySubject.get(n.name);
    if (chron) {
      triples.push(`lo:earliestYear ${chron.earliestYear}`);
      triples.push(`lo:latestYear ${chron.latestYear}`);
      triples.push(
        `lo:datePrecision "${chron.approximate ? "approximate" : "attested"}"@en`,
      );
    }
    const sameAs: string[] = [];
    if (n.qid) sameAs.push(`wd:${n.qid}`);
    if (n.enwiki) sameAs.push(`<${dbpediaUri(n.enwiki)}>`);
    if (n.viaf) sameAs.push(`<${viafUri(n.viaf)}>`);
    if (n.inpho) sameAs.push(`<${inphoUri(n.inpho)}>`);
    if (sameAs.length > 0) triples.push(`owl:sameAs ${sameAs.join(", ")}`);
    const seeAlso: string[] = [];
    if (n.enwiki) seeAlso.push(`<${wikipediaUri(n.enwiki)}>`);
    if (n.britannica) seeAlso.push(`<${britannicaUri(n.britannica)}>`);
    if (n.philosophyPages) seeAlso.push(`<${philosophyPagesUri(n.philosophyPages)}>`);
    if (seeAlso.length > 0) triples.push(`rdfs:seeAlso ${seeAlso.join(", ")}`);
    for (const e of g.edges) {
      if (e.from !== n.name || !byName.has(e.to)) continue;
      triples.push(`lo:${EDGE_PROPERTY[e.type]} <${philosopherUri(e.to)}>`);
    }
    // Direct triples for claims asserted in D.L.'s own voice.
    for (const c of claims) {
      if (c.subject !== n.name) continue;
      const d = directTriple(c);
      if (!d) continue;
      triples.push(
        d.uri
          ? `lo:${d.pred} <${d.uri}>`
          : `lo:${d.pred} "${ttlEscape(c.value)}"@en`,
      );
    }
    // Direct triples for sayings asserted in D.L.'s own voice.
    for (const s of sayings) {
      if (s.philosopher !== n.name || s.certainty !== "asserted") continue;
      triples.push(`lo:said "${ttlEscape(s.en)}"@en`);
    }
    const diffFromUrisTtl = diffFromByUriTtl.get(philUri);
    if (diffFromUrisTtl) {
      triples.push(`owl:differentFrom ${diffFromUrisTtl.map((u) => `<${u}>`).join(", ")}`);
    }
    lines.push(`<${philUri}>\n    ${triples.join(" ;\n    ")} .`);
    lines.push("");
  }
  lines.push("# One lo:Chapter document node per Life, linking the chapter of");
  lines.push("# the Lives to the person it is about (lo:hasMainSubject).");
  for (const n of g.nodes) {
    const triples = [
      `a lo:Chapter`,
      `rdfs:label "${ttlEscape(chapterLabel(n.name, n.book, n.chapter))}"@en`,
      `lo:inBook ${n.book}`,
      `lo:chapterNumber ${chapterNumberOf(n)}`,
      `lo:hasMainSubject <${philosopherUri(n.name)}>`,
      `dcterms:source "urn:cts:greekLit:tlg0004.tlg001.perseus-grc2:${n.book}.${n.chapter}"`,
    ];
    lines.push(`<${chapterUri(n.book, n.chapter)}> ${triples.join(" ; ")} .`);
  }
  lines.push("");
  lines.push("# Schools, places, works, persons, sources, doctrines and Greek");
  lines.push("# terms derived from the cited claims below.");
  for (const s of ce.schools) {
    lines.push(
      `<${claimSchoolUri(s)}> a lo:School ; rdfs:label "${ttlEscape(s)}"@en ; ` +
        `otv:instanceOf <${conceptUri("school")}> ; ` +
        `otv:denotedByProperName ${properNameRefsTtlForEntity([s], claimSchoolUri(s))} .`,
    );
  }
  const placeLabelSet = new Set(allPlaces(ce.places));
  for (const p of allPlaces(ce.places)) {
    const placeClass = placeClassOf(p);
    const triples = [
      placeClass ? `a lo:Place, lo:${placeClass}` : `a lo:Place`,
      `rdfs:label "${ttlEscape(p)}"@en`,
      `otv:instanceOf <${conceptUri("place")}>`,
      `otv:denotedByProperName ${properNameRefsTtlForEntity([p], placeUri(p))}`,
    ];
    const parent = placeParentOf(p, placeLabelSet);
    if (parent) triples.push(`lo:locatedIn <${placeUri(parent)}>`);
    const qid = placeQid(p);
    const pleiades = PLACE_PLEIADES[p];
    const sameAs: string[] = [];
    if (qid) sameAs.push(`wd:${qid}`);
    if (pleiades) sameAs.push(`<${pleiadesUri(pleiades)}>`);
    if (sameAs.length > 0) triples.push(`owl:sameAs ${sameAs.join(", ")}`);
    lines.push(`<${placeUri(p)}> ${triples.join(" ; ")} .`);
  }
  validateWorkFacets(
    new Set([
      ...ce.works,
      ...SOURCE_WORKS.map((sw) => sw.title),
      ...PERSON_WORKS.map((pw) => pw.title),
    ]),
  );
  const workAuthors = buildWorkAuthors();
  const chronByName = new Map(extras.chronology.map((c) => [c.philosopher, c]));
  // Works follow the full OTV double dimension: every title is the work's
  // otv:ProperName (linguistic unit), linked both ways to the work node
  // (conceptual unit). Eponymous titles share their name node with the
  // person - homonymy across kinds is real and modeled.
  for (const w of ce.works) {
    const triples = [
      `a lo:Work`,
      `rdfs:label "${ttlEscape(w)}"@en`,
      `otv:instanceOf <${conceptUri("work")}>`,
      `otv:denotedByProperName ${properNameRefsTtlForEntity([w], workUri(w))}`,
    ];
    for (const alt of altByWork.get(w) ?? []) {
      triples.push(`lo:alternateTitle "${ttlEscape(alt)}"@en`);
    }
    const grcTitle = greekWorkTitleSpec(w)?.grc;
    if (grcTitle) triples.push(`lo:greekTitle "${ttlEscape(grcTitle)}"@grc`);
    const tr = transByWork.get(w);
    if (tr) {
      triples.push(`lo:transmissionStatus "${tr.status}"@en`);
      if (tr.note) triples.push(`rdfs:comment "${ttlEscape(tr.note)}"@en`);
    }
    const qid = WORK_QIDS[w];
    const enwiki = WORK_ENWIKI[w];
    const workSameAs: string[] = [];
    if (qid) workSameAs.push(`wd:${qid}`);
    if (enwiki) workSameAs.push(`<${dbpediaUri(enwiki)}>`);
    if (workSameAs.length > 0)
      triples.push(`owl:sameAs ${workSameAs.join(", ")}`);
    if (enwiki) triples.push(`rdfs:seeAlso <${wikipediaUri(enwiki)}>`);
    triples.push(...workFacetTriples(resolveWorkFacets(w, workAuthors, chronByName)));
    lines.push(`<${workUri(w)}> ${triples.join(" ; ")} .`);
  }
  // Rival attributees of sayings who are neither corpus philosophers nor
  // already among the claim persons still need a person node of their own.
  const attributedOnlyPersons = [
    ...new Set(
      sayings
        .map((s) => s.alsoAttributedTo)
        .filter(
          (a): a is string => !!a && !byName.has(a) && !ce.persons.includes(a),
        ),
    ),
  ];
  for (const p of [...ce.persons, ...attributedOnlyPersons]) {
    const triples = [
      `a foaf:Person, otv:Object`,
      `rdfs:label "${ttlEscape(p)}"@en`,
      `rdfs:comment "Mentioned by Diogenes Laertius but without a Life of his own."@en`,
      `otv:instanceOf <${conceptUri("person")}>`,
      `otv:denotedByProperName ${properNameRefsTtlForEntity([p], personUri(p))}`,
    ];
    const roleNames = personRoleNames(p);
    if (roleNames.length > 0) {
      triples.push(`lo:hasRole ${roleNames.map((r) => `lo:${r}`).join(", ")}`);
    }
    for (const t of personWorkTitlesFor(p)) {
      triples.push(`lo:wrote <${workUri(t)}>`);
    }
    const qid = ENTITY_QIDS[p];
    if (qid) triples.push(`owl:sameAs wd:${qid}`);
    const diff = diffFromByUriTtl.get(personUri(p));
    if (diff) {
      triples.push(`owl:differentFrom ${diff.map((u) => `<${u}>`).join(", ")}`);
    }
    lines.push(`<${personUri(p)}> ${triples.join(" ; ")} .`);
  }
  // Poets credited with quoted verses (lo:composedBy) who are neither
  // corpus philosophers nor already among the person nodes above.
  const verseAuthorOnlyPersons = [...new Set(Object.values(VERSE_AUTHORS))]
    .filter(
      (a) =>
        !byName.has(a) &&
        !ce.persons.includes(a) &&
        !attributedOnlyPersons.includes(a),
    )
    .sort();
  for (const p of verseAuthorOnlyPersons) {
    const comment =
      p === "Diogenes Laertius"
        ? "The author of the Lives; the epigrams he marks as his own (many from his Pammetros) are linked here."
        : "A poet whose verses are quoted by Diogenes Laertius, without a Life of his own.";
    const triples = [
      `a foaf:Person, otv:Object`,
      `rdfs:label "${ttlEscape(p)}"@en`,
      `rdfs:comment "${ttlEscape(comment)}"@en`,
      `otv:instanceOf <${conceptUri("person")}>`,
      `otv:denotedByProperName ${properNameRefsTtlForEntity([p], personUri(p))}`,
    ];
    const roleNames = personRoleNames(p);
    if (roleNames.length > 0) {
      triples.push(`lo:hasRole ${roleNames.map((r) => `lo:${r}`).join(", ")}`);
    }
    for (const t of personWorkTitlesFor(p)) {
      triples.push(`lo:wrote <${workUri(t)}>`);
    }
    const qid = ENTITY_QIDS[p];
    if (qid) triples.push(`owl:sameAs wd:${qid}`);
    const diff = diffFromByUriTtl.get(personUri(p));
    if (diff) {
      triples.push(`owl:differentFrom ${diff.map((u) => `<${u}>`).join(", ")}`);
    }
    lines.push(`<${personUri(p)}> ${triples.join(" ; ")} .`);
  }
  // Mention-only persons (person-mentions.ts): rival Seven-Sages
  // candidates and Lasos' fathers. QIDs live in the module, not in
  // entity-links.ts, mirroring MENTION_PLACES.
  validateMentionPersons(
    new Set([
      ...g.nodes.map((n) => n.name),
      ...ce.persons,
      ...ce.sources,
      ...attributedOnlyPersons,
      ...verseAuthorOnlyPersons,
    ]),
  );
  for (const mp of MENTION_PERSONS) {
    const triples = [
      `a foaf:Person, otv:Object`,
      `rdfs:label "${ttlEscape(mp.label)}"@en`,
      `rdfs:comment "${ttlEscape(mp.comment)}"@en`,
      `otv:instanceOf <${conceptUri("person")}>`,
      `otv:denotedByProperName ${properNameRefsTtlForEntity([mp.label], personUri(mp.label))}`,
    ];
    const roleNames = personRoleNames(mp.label);
    if (roleNames.length > 0) {
      triples.push(`lo:hasRole ${roleNames.map((r) => `lo:${r}`).join(", ")}`);
    }
    for (const t of personWorkTitlesFor(mp.label)) {
      triples.push(`lo:wrote <${workUri(t)}>`);
    }
    if (mp.qid) triples.push(`owl:sameAs wd:${mp.qid}`);
    const diff = diffFromByUriTtl.get(personUri(mp.label));
    if (diff) {
      triples.push(`owl:differentFrom ${diff.map((u) => `<${u}>`).join(", ")}`);
    }
    lines.push(`<${personUri(mp.label)}> ${triples.join(" ; ")} .`);
  }
  validatePersonWorks(
    new Set([
      ...ce.persons,
      ...attributedOnlyPersons,
      ...verseAuthorOnlyPersons,
      ...MENTION_PERSONS.map((mp) => mp.label),
    ]),
    ce.works,
  );
  validateSourceWorks(ce.sources, ce.works);
  const sourceWorkTitlesBySource = new Map<string, string[]>();
  for (const sw of SOURCE_WORKS) {
    const list = sourceWorkTitlesBySource.get(sw.source) ?? [];
    list.push(sw.title);
    sourceWorkTitlesBySource.set(sw.source, list);
  }
  for (const s of ce.sources) {
    const triples = [
      `a lo:Source`,
      `rdfs:label "${ttlEscape(s)}"@en`,
      `rdfs:comment "An authority named by Diogenes Laertius."@en`,
      `otv:instanceOf <${conceptUri("source")}>`,
      `otv:denotedByProperName ${properNameRefsTtlForEntity([s], sourceUri(s))}`,
    ];
    const roleNames = personRoleNames(s);
    if (roleNames.length > 0) {
      triples.push(`lo:hasRole ${roleNames.map((r) => `lo:${r}`).join(", ")}`);
    }
    for (const t of sourceWorkTitlesBySource.get(s) ?? []) {
      triples.push(`lo:wrote <${workUri(t)}>`);
    }
    const qid = ENTITY_QIDS[s];
    if (qid) triples.push(`owl:sameAs wd:${qid}`);
    const diff = diffFromByUriTtl.get(sourceUri(s));
    if (diff) {
      triples.push(`owl:differentFrom ${diff.map((u) => `<${u}>`).join(", ")}`);
    }
    lines.push(`<${sourceUri(s)}> ${triples.join(" ; ")} .`);
  }
  // Cited school memberships (school-members.ts): asserted members get
  // the direct lo:memberOf triple on their existing node; EVERY entry
  // gets a reified rdf:Statement with the D.L. citation; hedged entries
  // (Timocrates) exist ONLY as reifications, mirroring the claims model.
  // All member nodes are base-graph nodes (claim persons, mention
  // persons, ce.sources authorities), so no sourcesIndex gating.
  validateSchoolMembers(
    new Set([
      ...ce.persons,
      ...attributedOnlyPersons,
      ...verseAuthorOnlyPersons,
      ...MENTION_PERSONS.map((mp) => mp.label),
    ]),
    new Set([
      ...ce.sources,
      ...sayingOnlySources,
      ...anecdoteOnlySources,
      ...taggedMintedGroups(getSourcesIndex().groups)
        .filter((gr) => sourceGroupUri(gr) === sourceUri(gr.label))
        .map((gr) => gr.label),
    ]),
    new Set(g.movements.map((m) => m.id)),
  );
  for (const m of SCHOOL_MEMBERS) {
    const uri = m.node === "person" ? personUri(m.label) : sourceUri(m.label);
    if (m.asserted) {
      lines.push(`<${uri}> lo:memberOf <${schoolUri(m.school)}> .`);
    }
    lines.push(
      `[] a rdf:Statement ;\n    rdf:subject <${uri}> ;\n    rdf:predicate lo:memberOf ;\n    rdf:object <${schoolUri(m.school)}> ;\n    dcterms:bibliographicCitation "Diog. Laert. ${ttlEscape(m.ref)}"${
        m.note ? ` ;\n    rdfs:comment "${ttlEscape(m.note)}"@en` : ""
      } .`,
    );
  }
  // Cited succession links (succession-links.ts): asserted links get
  // the direct lo:teacherOf triple; EVERY link gets a reified
  // rdf:Statement with the D.L. citation and the named authorities;
  // hedged links (the Hippobotus/Sotion pupil list of 9.115) exist
  // ONLY as reifications, mirroring the school-members model.
  validateSuccessionLinks(
    new Set(g.nodes.map((n) => n.name)),
    new Set([
      ...ce.persons,
      ...attributedOnlyPersons,
      ...verseAuthorOnlyPersons,
      ...MENTION_PERSONS.map((mp) => mp.label),
    ]),
    new Set([
      ...ce.sources,
      ...sayingOnlySources,
      ...anecdoteOnlySources,
      ...taggedMintedGroups(getSourcesIndex().groups)
        .filter((gr) => sourceGroupUri(gr) === sourceUri(gr.label))
        .map((gr) => gr.label),
    ]),
  );
  for (const l of SUCCESSION_LINKS) {
    const tUri = successionEndpointUri(l.teacher);
    const pUri = successionEndpointUri(l.pupil);
    if (l.asserted) {
      lines.push(`<${tUri}> lo:teacherOf <${pUri}> .`);
    }
    const acc = (l.accordingTo ?? [])
      .map((a) => `<${sourceUri(a)}>`)
      .join(", ");
    lines.push(
      `[] a rdf:Statement ;\n    rdf:subject <${tUri}> ;\n    rdf:predicate lo:teacherOf ;\n    rdf:object <${pUri}> ;\n    dcterms:bibliographicCitation "Diog. Laert. ${ttlEscape(l.ref)}"${
        acc ? ` ;\n    lo:accordingTo ${acc}` : ""
      }${l.note ? ` ;\n    rdfs:comment "${ttlEscape(l.note)}"@en` : ""} .`,
    );
  }
  // Works cited as sources (Hermippus' On the Sages, Apollodorus'
  // Chronology): same shape as claims-layer works, plus the curator's
  // comment. The lo:wrote triple lives on the source node above.
  for (const sw of SOURCE_WORKS) {
    const triples = [
      `a lo:Work`,
      `rdfs:label "${ttlEscape(sw.title)}"@en`,
      `rdfs:comment "${ttlEscape(sw.comment)}"@en`,
      `otv:instanceOf <${conceptUri("work")}>`,
      `otv:denotedByProperName ${properNameRefsTtlForEntity([sw.title], workUri(sw.title))}`,
    ];
    const grcTitle = greekWorkTitleSpec(sw.title)?.grc;
    if (grcTitle) triples.push(`lo:greekTitle "${ttlEscape(grcTitle)}"@grc`);
    const qid = WORK_QIDS[sw.title];
    const enwiki = WORK_ENWIKI[sw.title];
    const swSameAs: string[] = [];
    if (qid) swSameAs.push(`wd:${qid}`);
    if (enwiki) swSameAs.push(`<${dbpediaUri(enwiki)}>`);
    if (swSameAs.length > 0)
      triples.push(`owl:sameAs ${swSameAs.join(", ")}`);
    if (enwiki) triples.push(`rdfs:seeAlso <${wikipediaUri(enwiki)}>`);
    triples.push(
      ...workFacetTriples(resolveWorkFacets(sw.title, workAuthors, chronByName)),
    );
    lines.push(`<${workUri(sw.title)}> ${triples.join(" ; ")} .`);
  }
  // Works quoted from person-only authors (Achaeus' Omphale): same
  // shape as source-authored works, plus the curator's comment. The
  // lo:wrote triple lives on the person node above.
  for (const pw of PERSON_WORKS) {
    const triples = [
      `a lo:Work`,
      `rdfs:label "${ttlEscape(pw.title)}"@en`,
      `rdfs:comment "${ttlEscape(pw.comment)}"@en`,
      `otv:instanceOf <${conceptUri("work")}>`,
      `otv:denotedByProperName ${properNameRefsTtlForEntity([pw.title], workUri(pw.title))}`,
    ];
    const grcTitle = greekWorkTitleSpec(pw.title)?.grc;
    if (grcTitle) triples.push(`lo:greekTitle "${ttlEscape(grcTitle)}"@grc`);
    const qid = WORK_QIDS[pw.title];
    const enwiki = WORK_ENWIKI[pw.title];
    const pwSameAs: string[] = [];
    if (qid) pwSameAs.push(`wd:${qid}`);
    if (enwiki) pwSameAs.push(`<${dbpediaUri(enwiki)}>`);
    if (pwSameAs.length > 0)
      triples.push(`owl:sameAs ${pwSameAs.join(", ")}`);
    if (enwiki) triples.push(`rdfs:seeAlso <${wikipediaUri(enwiki)}>`);
    triples.push(
      ...workFacetTriples(resolveWorkFacets(pw.title, workAuthors, chronByName)),
    );
    lines.push(`<${workUri(pw.title)}> ${triples.join(" ; ")} .`);
  }
  // Doctrines are otv:Concepts (never otv:instanceOf - otv:Concept and
  // otv:Object are disjoint); their Greek key terms denote them.
  for (const d of ce.doctrines) {
    const triples = [
      `a lo:Doctrine, otv:Concept`,
      `rdfs:label "${ttlEscape(d.label)}"@en`,
      `otv:conceptName "${ttlEscape(d.label)}"`,
    ];
    if (d.greek) {
      triples.push(`lo:usesTerm <${termUri(d.greek)}>`);
      triples.push(`otv:denotedByTerm <${termUri(d.greek)}>`);
    }
    lines.push(`<${doctrineUri(d.label)}> ${triples.join(" ; ")} .`);
  }
  const doctrinesByTerm = new Map<string, string[]>();
  for (const d of ce.doctrines) {
    if (!d.greek) continue;
    const arr = doctrinesByTerm.get(d.greek) ?? [];
    arr.push(d.label);
    doctrinesByTerm.set(d.greek, arr);
  }
  // otv:termName is a plain literal (OTV ranges are xsd:string); the
  // language lives in otv:language, the @grc tag on rdfs:label/greekLemma.
  for (const t of ce.terms) {
    const triples = [
      `a lo:GreekTerm, otv:Term`,
      `rdfs:label "${ttlEscape(t)}"@grc`,
      `lo:greekLemma "${ttlEscape(t)}"@grc`,
      `otv:termName "${ttlEscape(t)}"`,
      `otv:language "grc"`,
    ];
    const pp = PHILOSOPHY_PAGES[t];
    if (pp) triples.push(`rdfs:seeAlso <${philosophyPagesUri(pp)}>`);
    for (const dl of doctrinesByTerm.get(t) ?? []) {
      triples.push(`otv:denotedConcept <${doctrineUri(dl)}>`);
    }
    lines.push(`<${termUri(t)}> ${triples.join(" ; ")} .`);
  }
  // Principal-doctrine entities for the schools (distinct from the per-claim
  // doctrines above). RDF is a set, so a duplicate label is harmless.
  const claimDoctrineLabels = new Set(ce.doctrines.map((d) => d.label));
  for (const sd of extras.schoolDoctrines) {
    if (claimDoctrineLabels.has(sd.doctrine)) continue;
    lines.push(
      `<${doctrineUri(sd.doctrine)}> a lo:Doctrine, otv:Concept ; ` +
        `rdfs:label "${ttlEscape(sd.doctrine)}"@en ; ` +
        `otv:conceptName "${ttlEscape(sd.doctrine)}" .`,
    );
  }
  lines.push("");
  lines.push("# Ontoterminological layer (OTV): the concepts our individuals");
  lines.push("# instantiate and the proper names that denote them. Work titles");
  lines.push("# are otv:ProperName nodes too (the OTV double dimension needs a");
  lines.push("# linguistic unit for every name realized in the text).");
  for (const c of OTV_CONCEPTS) {
    const triples = [
      `a otv:Concept`,
      `rdfs:label "${c.name}"@en`,
      `otv:conceptName "${c.name}"`,
    ];
    if (c.isA) triples.push(`otv:isA <${conceptUri(c.isA)}>`);
    lines.push(`<${conceptUri(c.kind)}> ${triples.join(" ; ")} .`);
  }
  const namePairs: [string, string][] = [
    ...g.nodes.map((n): [string, string] => [n.name, philosopherUri(n.name)]),
    ...g.movements.map((m): [string, string] => [m.label, schoolUri(m.id)]),
    ...ce.schools.map((s): [string, string] => [s, claimSchoolUri(s)]),
    ...allPlaces(ce.places).map((p): [string, string] => [p, placeUri(p)]),
    ...[
      ...ce.persons,
      ...attributedOnlyPersons,
      ...verseAuthorOnlyPersons,
      ...MENTION_PERSONS.map((mp) => mp.label),
    ].map((p): [string, string] => [p, personUri(p)]),
    ...[...ce.sources, ...sayingOnlySources, ...anecdoteOnlySources].map(
      (s): [string, string] => [s, sourceUri(s)],
    ),
    ...(sourcesIndex
      ? sourceIndexNamePairs(getSourcesIndex().groups)
      : sourceIndexNamePairs(taggedMintedGroups(getSourcesIndex().groups))),
    ...[
      ...ce.works,
      ...SOURCE_WORKS.map((sw) => sw.title),
      ...PERSON_WORKS.map((pw) => pw.title),
    ].map((t): [string, string] => [t, workUri(t)]),
  ];
  for (const [uri, e] of groupProperNames(namePairs)) {
    const labels = [...e.labels].sort();
    const triples = [
      `a otv:ProperName`,
      ...labels.map((l) => `otv:properName "${ttlEscape(l)}"`),
      `otv:language "en"`,
      `otv:denotedObject <${e.entityUri}>`,
    ];
    lines.push(`<${uri}> ${triples.join(" ; ")} .`);
  }
  // Per-language split: each Greek form gets a per-entity otv:ProperName node.
  // Collision forms (nominatives shared by multiple entities) get disambiguated
  // URIs; unique forms keep the stable per-form URI. Plain xsd:string literals
  // only: the OTV core declares otv:properName range xsd:string, so
  // language-tagged literals would make the merged graph OWL-inconsistent.
  const greekPairs: [string, string][] = namePairs.flatMap(([label, uri]) =>
    greekFormsForLabel(label).map((g): [string, string] => [g, uri]),
  );
  for (const [uri, e] of groupGreekProperNamesPerEntity(greekPairs)) {
    const forms = [...e.forms].sort();
    const triples = [
      `a otv:ProperName`,
      ...forms.map((g) => `otv:properName "${ttlEscape(g)}"`),
      `otv:language "grc"`,
      `otv:denotedObject <${e.entityUri}>`,
    ];
    lines.push(`<${uri}> ${triples.join(" ; ")} .`);
  }
  lines.push("");
  lines.push(
    "# Reified statements carrying the D.L. citation for the ontology extras",
  );
  lines.push("# (alternate titles, school doctrines, transmission, foundership).");
  for (const a of extras.altTitles) {
    lines.push(
      `[] a rdf:Statement ;\n    rdf:subject <${workUri(a.work)}> ;\n    rdf:predicate lo:alternateTitle ;\n    rdf:object "${ttlEscape(a.altTitle)}"@en ;\n    dcterms:bibliographicCitation "Diog. Laert. ${ttlEscape(a.ref)}" .`,
    );
    lines.push("");
  }
  for (const sd of extras.schoolDoctrines) {
    const triples = [
      `a rdf:Statement`,
      `rdf:subject <${schoolUri(sd.school)}>`,
      `rdf:predicate lo:principalDoctrine`,
      `rdf:object <${doctrineUri(sd.doctrine)}>`,
      `dcterms:bibliographicCitation "Diog. Laert. ${ttlEscape(sd.ref)}"`,
    ];
    if (sd.note) triples.push(`rdfs:comment "${ttlEscape(sd.note)}"@en`);
    lines.push(`[] ${triples.join(" ;\n    ")} .`);
    lines.push("");
  }
  for (const tr of extras.workTransmission) {
    const triples = [
      `a rdf:Statement`,
      `rdf:subject <${workUri(tr.work)}>`,
      `rdf:predicate lo:transmissionStatus`,
      `rdf:object "${tr.status}"@en`,
      `dcterms:bibliographicCitation "Diog. Laert. ${ttlEscape(tr.ref)}"`,
    ];
    if (tr.note) triples.push(`rdfs:comment "${ttlEscape(tr.note)}"@en`);
    lines.push(`[] ${triples.join(" ;\n    ")} .`);
    lines.push("");
  }
  for (const f of extras.founderLinks) {
    if (!f.ref || !byName.has(f.philosopher)) continue;
    lines.push(
      `[] a rdf:Statement ;\n    rdf:subject <${philosopherUri(f.philosopher)}> ;\n    rdf:predicate lo:foundedSchool ;\n    rdf:object <${schoolUri(f.school)}> ;\n    dcterms:bibliographicCitation "Diog. Laert. ${ttlEscape(f.ref)}" .`,
    );
    lines.push("");
  }
  for (const ch of extras.chronology) {
    if (!byName.has(ch.philosopher) || ch.refs.length === 0) continue;
    const citation = ttlEscape(`Diog. Laert. ${ch.refs.join("; ")}`);
    for (const [pred, obj] of [
      ["earliestYear", ch.earliestYear],
      ["latestYear", ch.latestYear],
    ] as const) {
      lines.push(
        `[] a rdf:Statement ;\n    rdf:subject <${philosopherUri(ch.philosopher)}> ;\n    rdf:predicate lo:${pred} ;\n    rdf:object ${obj} ;\n    dcterms:bibliographicCitation "${citation}" .`,
      );
      lines.push("");
    }
  }
  lines.push("# Reified statements preserving the D.L. citation for each relation.");
  for (const e of g.edges) {
    if (!e.ref || !byName.has(e.from) || !byName.has(e.to)) continue;
    lines.push(
      `[] a rdf:Statement ;\n    rdf:subject <${philosopherUri(e.from)}> ;\n    rdf:predicate lo:${EDGE_PROPERTY[e.type]} ;\n    rdf:object <${philosopherUri(e.to)}> ;\n    dcterms:bibliographicCitation "Diog. Laert. ${ttlEscape(e.ref)}" .`,
    );
    lines.push("");
  }
  lines.push("# Cited, certainty-tagged claims. Hedged and disputed claims exist");
  lines.push("# only here, not as direct triples on their subjects.");
  for (const c of claims) {
    const uri = claimValueUri(c);
    const triples: string[] = [
      `a lo:Claim`,
      `rdf:subject <${philosopherUri(c.subject)}>`,
      `rdf:predicate lo:${CLAIM_PREDICATE[c.property]}`,
      uri
        ? `rdf:object <${uri}>`
        : `rdf:object "${ttlEscape(c.value)}"@en`,
      `lo:certainty lo:${CERTAINTY_INDIVIDUAL[c.certainty]}`,
      `dcterms:bibliographicCitation "Diog. Laert. ${ttlEscape(c.ref)}"`,
    ];
    if (c.accordingTo) triples.push(`lo:accordingTo <${sourceUri(c.accordingTo)}>`);
    if (c.sourceWork !== undefined) {
      triples.push(`lo:assertedInWork <${workUri(c.sourceWork)}>`);
    }
    if (c.chain !== undefined && c.chain.length > 0) {
      c.chain.forEach((_link, i) => {
        triples.push(`lo:transmissionChain <${chainLinkUri(c.id, i)}>`);
      });
    }
    if (c.conflictsWith && c.conflictsWith.length > 0) {
      triples.push(
        `lo:conflictsWith ${c.conflictsWith.map((id) => `<${claimUri(id)}>`).join(", ")}`,
      );
    }
    if (c.grc) triples.push(`lo:greekText "${ttlEscape(c.grc)}"@grc`);
    if (c.note) triples.push(`rdfs:comment "${ttlEscape(c.note)}"@en`);
    lines.push(`<${claimUri(c.id)}>\n    ${triples.join(" ;\n    ")} .`);
    lines.push("");
    if (c.chain !== undefined && c.chain.length > 0) {
      for (const [i, link] of c.chain.entries()) {
        const chainParts = [
          `a lo:ChainLink`,
          `lo:chainAuthority <${sourceUri(link.authority)}>`,
        ];
        if (link.work) chainParts.push(`lo:chainWork <${workUri(link.work)}>`);
        lines.push(`<${chainLinkUri(c.id, i)}>\n    ${chainParts.join(" ;\n    ")} .`);
        lines.push("");
      }
    }
  }
  lines.push("# Sources named only for sayings (not already among the claim sources).");
  for (const s of sayingOnlySources) {
    const triples = [
      `a lo:Source`,
      `rdfs:label "${ttlEscape(s)}"@en`,
      `rdfs:comment "An authority named by Diogenes Laertius."@en`,
      `otv:instanceOf <${conceptUri("source")}>`,
      `otv:denotedByProperName ${properNameRefsTtlForEntity([s], sourceUri(s))}`,
    ];
    const roleNames = personRoleNames(s);
    if (roleNames.length > 0) {
      triples.push(`lo:hasRole ${roleNames.map((r) => `lo:${r}`).join(", ")}`);
    }
    const qid = ENTITY_QIDS[s];
    if (qid) triples.push(`owl:sameAs wd:${qid}`);
    const diff = diffFromByUriTtl.get(sourceUri(s));
    if (diff) {
      triples.push(`owl:differentFrom ${diff.map((u) => `<${u}>`).join(", ")}`);
    }
    lines.push(`<${sourceUri(s)}> ${triples.join(" ; ")} .`);
  }
  lines.push("");
  lines.push("# Sources named only for anecdotes (not already claim or saying sources).");
  for (const s of anecdoteOnlySources) {
    const triples = [
      `a lo:Source`,
      `rdfs:label "${ttlEscape(s)}"@en`,
      `rdfs:comment "An authority named by Diogenes Laertius."@en`,
      `otv:instanceOf <${conceptUri("source")}>`,
      `otv:denotedByProperName ${properNameRefsTtlForEntity([s], sourceUri(s))}`,
    ];
    const roleNames = personRoleNames(s);
    if (roleNames.length > 0) {
      triples.push(`lo:hasRole ${roleNames.map((r) => `lo:${r}`).join(", ")}`);
    }
    const qid = ENTITY_QIDS[s];
    if (qid) triples.push(`owl:sameAs wd:${qid}`);
    const diff = diffFromByUriTtl.get(sourceUri(s));
    if (diff) {
      triples.push(`owl:differentFrom ${diff.map((u) => `<${u}>`).join(", ")}`);
    }
    lines.push(`<${sourceUri(s)}> ${triples.join(" ; ")} .`);
  }
  lines.push("");
  lines.push("# Cited sayings & apophthegms, reified as lo:Saying. Hedged and");
  lines.push("# disputed sayings exist only here, not as direct triples.");
  for (const s of sayings) {
    const triples: string[] = [
      `a lo:Saying`,
      `rdf:subject <${philosopherUri(s.philosopher)}>`,
      `rdf:predicate lo:said`,
      `rdf:object "${ttlEscape(s.en)}"@en`,
      `lo:certainty lo:${CERTAINTY_INDIVIDUAL[s.certainty]}`,
      `lo:gloss "${ttlEscape(s.gloss)}"@en`,
      `lo:sayingTopic "${ttlEscape(s.topic)}"`,
      `dcterms:bibliographicCitation "Diog. Laert. ${ttlEscape(s.ref)}"`,
    ];
    const sectionId = sectionIdForRef(s.ref, s.philosopher);
    if (sectionId) {
      triples.push(
        `dcterms:source "urn:cts:greekLit:tlg0004.tlg001.perseus-grc2:${sectionId}"`,
      );
    }
    if (s.grc) triples.push(`lo:greekText "${ttlEscape(s.grc)}"@grc`);
    if (s.accordingTo) triples.push(`lo:accordingTo <${sourceUri(s.accordingTo)}>`);
    if (s.alsoAttributedTo) {
      const uri = byName.has(s.alsoAttributedTo)
        ? philosopherUri(s.alsoAttributedTo)
        : personUri(s.alsoAttributedTo);
      triples.push(`lo:alsoAttributedTo <${uri}>`);
    }
    // Named interlocutor: object property only for existing philosopher
    // nodes, literal otherwise (no new person nodes - keeps the gazetteer
    // and pinned annotations stable).
    if (s.to) {
      if (byName.has(s.to)) {
        triples.push(`lo:addressedTo <${philosopherUri(s.to)}>`);
      } else {
        triples.push(`lo:addresseeName "${ttlEscape(s.to)}"@en`);
      }
    }
    if (s.note) triples.push(`rdfs:comment "${ttlEscape(s.note)}"@en`);
    lines.push(`<${sayingUri(s.id)}>\n    ${triples.join(" ;\n    ")} .`);
    lines.push("");
  }
  lines.push("# The quoted poems, epigrams, oracles and epitaphs (verse layer).");
  lines.push("# Prologue verses carry no philosopher link (the Prologue has no node).");
  for (const v of verses) {
    const triples: string[] = [
      v.genre === "epigram" ? `a lo:Verse, lo:Epigram` : `a lo:Verse`,
      `lo:greekText "${ttlEscape(v.linesGrc.join("\n"))}"@grc`,
    ];
    if (byName.has(v.philosopher)) {
      triples.push(`lo:quotedInLifeOf <${philosopherUri(v.philosopher)}>`);
    }
    const author = VERSE_AUTHORS[v.id];
    if (author) {
      const uri = byName.has(author)
        ? philosopherUri(author)
        : personUri(author);
      triples.push(`lo:composedBy <${uri}>`);
    }
    if (v.linesEn) {
      triples.push(`lo:englishText "${ttlEscape(v.linesEn.join("\n"))}"@en`);
    }
    if (v.source) triples.push(`lo:verseSource "${ttlEscape(v.source)}"`);
    if (v.continued) triples.push(`lo:continuesPrevious true`);
    triples.push(
      `dcterms:bibliographicCitation "${ttlEscape(verseCitation(v))}"`,
      `dcterms:source "urn:cts:greekLit:tlg0004.tlg001.perseus-grc2:${v.sectionId}"`,
    );
    lines.push(`<${verseUri(v.id)}>\n    ${triples.join(" ;\n    ")} .`);
    lines.push("");
  }
  lines.push("# The letters D.L. quotes verbatim (epistle layer): document");
  lines.push("# nodes with sender, addressee and the curator's authenticity");
  lines.push("# verdict - an axis distinct from the claims' certainty model.");
  for (const e of getEpistles()) {
    const triples: string[] = [
      `a lo:Epistle`,
      `rdfs:label "${ttlEscape(`${e.sender} to ${e.to}`)}"@en`,
      `lo:englishText "${ttlEscape(e.en)}"@en`,
      `lo:gloss "${ttlEscape(e.gloss)}"@en`,
      `lo:epistleTopic "${ttlEscape(e.topic)}"`,
      `lo:authenticity lo:${AUTHENTICITY_INDIVIDUAL[e.authenticity]}`,
    ];
    if (e.grc) triples.push(`lo:greekText "${ttlEscape(e.grc)}"@grc`);
    // Sender and addressee: object links only to existing philosopher
    // nodes, literals otherwise (no new person nodes - keeps the gazetteer
    // and pinned annotations stable).
    if (byName.has(e.sender)) {
      triples.push(`lo:sentBy <${philosopherUri(e.sender)}>`);
    } else {
      triples.push(`lo:senderName "${ttlEscape(e.sender)}"@en`);
    }
    if (byName.has(e.to)) {
      triples.push(`lo:addressedTo <${philosopherUri(e.to)}>`);
    } else {
      triples.push(`lo:addresseeName "${ttlEscape(e.to)}"@en`);
    }
    if (e.dramaticDate) {
      triples.push(`lo:dramaticDate "${ttlEscape(e.dramaticDate)}"@en`);
    }
    if (e.note) triples.push(`rdfs:comment "${ttlEscape(e.note)}"@en`);
    triples.push(
      `dcterms:bibliographicCitation "Diog. Laert. ${ttlEscape(epistleRefForDisplay(e.ref))}"`,
      `dcterms:source "urn:cts:greekLit:tlg0004.tlg001.perseus-grc2:${e.ref}"`,
    );
    lines.push(`<${epistleUri(e.id)}>\n    ${triples.join(" ;\n    ")} .`);
    lines.push("");
  }
  lines.push("# The narrated biographical incidents (anecdote layer): document");
  lines.push("# nodes like the epistles, not reifications - an anecdote is a");
  lines.push("# story the text tells about a philosopher, not a statement he");
  lines.push("# made. Participants are object links only to existing philosopher");
  lines.push("# nodes, literals otherwise (no new person nodes).");
  for (const a of anecdotes) {
    const triples: string[] = [
      `a lo:Anecdote`,
      `rdfs:label "${ttlEscape(a.gloss)}"@en`,
      `lo:about <${philosopherUri(a.philosopher)}>`,
      `lo:englishText "${ttlEscape(a.en)}"@en`,
      `lo:gloss "${ttlEscape(a.gloss)}"@en`,
      `lo:anecdoteTopic "${ttlEscape(a.topic)}"`,
      `lo:certainty lo:${CERTAINTY_INDIVIDUAL[a.certainty]}`,
    ];
    if (a.grc) triples.push(`lo:greekText "${ttlEscape(a.grc)}"@grc`);
    if (a.accordingTo) triples.push(`lo:accordingTo <${sourceUri(a.accordingTo)}>`);
    if (a.alsoAttributedTo) {
      const uri = byName.has(a.alsoAttributedTo)
        ? philosopherUri(a.alsoAttributedTo)
        : personUri(a.alsoAttributedTo);
      triples.push(`lo:alsoAttributedTo <${uri}>`);
    }
    if (a.involves) {
      if (byName.has(a.involves)) {
        triples.push(`lo:involves <${philosopherUri(a.involves)}>`);
      } else {
        triples.push(`lo:participantName "${ttlEscape(a.involves)}"@en`);
      }
    }
    if (a.framesSaying) {
      triples.push(`lo:framesSaying <${sayingUri(a.framesSaying)}>`);
    }
    if (a.note) triples.push(`rdfs:comment "${ttlEscape(a.note)}"@en`);
    triples.push(
      `dcterms:bibliographicCitation "Diog. Laert. ${ttlEscape(a.ref)}"`,
    );
    const sectionId = sectionIdForRef(a.ref, a.philosopher);
    if (sectionId) {
      triples.push(
        `dcterms:source "urn:cts:greekLit:tlg0004.tlg001.perseus-grc2:${sectionId}"`,
      );
    }
    lines.push(`<${anecdoteUri(a.id)}>\n    ${triples.join(" ;\n    ")} .`);
    lines.push("");
  }
  lines.push("# The doctrinal tenets D.L. reports (doxography layer): document");
  lines.push("# nodes like the anecdotes - a doxa is the verbatim doctrinal");
  lines.push("# passage, classified by a controlled domain, not a reified");
  lines.push("# statement. When the tenet instantiates a doctrine the graph");
  lines.push("# already knows, it links that existing node; the layer mints");
  lines.push("# nothing (rival attributions stay literals unless the name is a");
  lines.push("# corpus philosopher).");
  for (const d of doxai) {
    const triples: string[] = [
      `a lo:Doxa`,
      `rdfs:label "${ttlEscape(d.gloss)}"@en`,
      `lo:heldBy <${philosopherUri(d.philosopher)}>`,
      `lo:englishText "${ttlEscape(d.en)}"@en`,
      `lo:gloss "${ttlEscape(d.gloss)}"@en`,
      `lo:doxaDomain "${ttlEscape(d.domain)}"`,
      `lo:certainty lo:${CERTAINTY_INDIVIDUAL[d.certainty]}`,
    ];
    if (d.grc) triples.push(`lo:greekText "${ttlEscape(d.grc)}"@grc`);
    if (d.doctrine) {
      triples.push(`lo:expressesDoctrine <${doctrineUri(d.doctrine)}>`);
    }
    if (d.accordingTo) {
      triples.push(`lo:accordingTo <${sourceUri(d.accordingTo)}>`);
    }
    if (d.alsoAttributedTo) {
      if (byName.has(d.alsoAttributedTo)) {
        triples.push(
          `lo:alsoAttributedTo <${philosopherUri(d.alsoAttributedTo)}>`,
        );
      } else {
        triples.push(
          `lo:rivalAttributionName "${ttlEscape(d.alsoAttributedTo)}"@en`,
        );
      }
    }
    if (d.note) triples.push(`rdfs:comment "${ttlEscape(d.note)}"@en`);
    triples.push(
      `dcterms:bibliographicCitation "Diog. Laert. ${ttlEscape(d.ref)}"`,
    );
    const sectionId = doxaSectionIdFor(d.ref, d.philosopher);
    if (sectionId) {
      triples.push(
        `dcterms:source "urn:cts:greekLit:tlg0004.tlg001.perseus-grc2:${sectionId}"`,
      );
    }
    lines.push(`<${doxaUri(d.id)}>\n    ${triples.join(" ;\n    ")} .`);
    lines.push("");
  }
  lines.push("# The wills D.L. quotes verbatim (testament layer): document");
  lines.push("# nodes like the epistles and anecdotes. Beneficiaries, executors");
  lines.push("# and witnesses are always literals (the wills teem with bare");
  lines.push("# homonyms); only lo:involves links nodes, restricted to corpus");
  lines.push("# philosophers whose identification is scholarly consensus.");
  for (const t of getTestaments()) {
    const triples: string[] = [
      `a lo:Testament`,
      `rdfs:label "${ttlEscape(`Will of ${t.philosopher}`)}"@en`,
      `lo:testator <${philosopherUri(t.philosopher)}>`,
      `lo:englishText "${ttlEscape(t.en)}"@en`,
      `lo:greekText "${ttlEscape(t.grc)}"@grc`,
      `lo:gloss "${ttlEscape(t.gloss)}"@en`,
    ];
    for (const b of t.beneficiaries) {
      triples.push(`lo:beneficiaryName "${ttlEscape(b)}"@en`);
    }
    for (const x of t.executors) {
      triples.push(`lo:executorName "${ttlEscape(x)}"@en`);
    }
    for (const w of t.witnesses) {
      triples.push(`lo:witnessName "${ttlEscape(w)}"@en`);
    }
    for (const p of t.provisions) {
      triples.push(`lo:provision "${ttlEscape(p)}"@en`);
    }
    for (const name of t.involves) {
      triples.push(`lo:involves <${philosopherUri(name)}>`);
    }
    if (t.note) triples.push(`rdfs:comment "${ttlEscape(t.note)}"@en`);
    triples.push(
      `dcterms:bibliographicCitation "Diog. Laert. ${ttlEscape(testamentRefForDisplay(t))}"`,
      `dcterms:source "urn:cts:greekLit:tlg0004.tlg001.perseus-grc2:${t.ref}"`,
    );
    lines.push(`<${testamentUri(t.id)}>\n    ${triples.join(" ;\n    ")} .`);
    lines.push("");
  }
  if (!sourcesIndex) {
    // The base graph (gazetteer, per-section exports, annotations) omits
    // the bibliographic index, but the minted authorities that the curated
    // source-mentions layer opts into text tagging are first-class graph
    // citizens - like the saying-only sources - so their nodes (and their
    // ProperNames, above) are emitted here too.
    lines.push("# Minted sources-index authorities opted into text tagging");
    lines.push("# (source-mentions.ts). The full bibliographic index lives");
    lines.push("# only in the sourcesIndex graph.");
    for (const gr of taggedMintedGroups(getSourcesIndex().groups)) {
      lines.push(mintedSourceGroupTtl(gr));
    }
    return lines.join("\n");
  }
  lines.push("# Cited authorities from the curated sources index (workbook):");
  lines.push("# new source nodes for authorities the graph did not already");
  lines.push("# know, name/link supplements for the ones it did, and one");
  lines.push("# lo:SourceCitation node per workbook row.");
  const srcIndex = getSourcesIndex();
  for (const gr of srcIndex.groups) {
    const uri = sourceGroupUri(gr);
    if (!gr.existing) {
      lines.push(mintedSourceGroupTtl(gr));
    } else {
      const triples: string[] = [];
      if (gr.nameGrc) triples.push(`rdfs:label "${ttlEscape(gr.nameGrc)}"@grc`);
      if (gr.nameFr) triples.push(`rdfs:label "${ttlEscape(gr.nameFr)}"@fr`);
      if (gr.qid && !hasCuratedQid(gr)) triples.push(`owl:sameAs wd:${gr.qid}`);
      if (gr.certainty && gr.kind === "source") {
        triples.push(`lo:identificationCertainty "${gr.certainty}"`);
      }
      const altNames = sourceGroupAltNames(gr);
      if (altNames.length > 0) {
        triples.push(
          `otv:denotedByProperName ${properNameRefsTtlForEntity(altNames, uri)}`,
        );
      }
      if (triples.length > 0) lines.push(`<${uri}> ${triples.join(" ; ")} .`);
    }
  }
  validatePersonRoles(
    new Set([
      ...ce.persons,
      ...attributedOnlyPersons,
      ...verseAuthorOnlyPersons,
      ...MENTION_PERSONS.map((mp) => mp.label),
      ...ce.sources,
      ...sayingOnlySources,
      ...anecdoteOnlySources,
      ...srcIndex.groups.filter((gr) => !gr.existing).map((gr) => gr.label),
    ]),
    new Set(g.nodes.map((n) => n.name)),
  );
  lines.push("");
  lines.push("# One citation event per workbook row: the authority (and often");
  lines.push("# a work) cited at a D.L. reference. Anonymous rows carry no");
  lines.push("# lo:citedAuthor.");
  const rowGroups = citationGroupsByRow(srcIndex.groups);
  for (const r of srcIndex.rows) {
    const gr = rowGroups.get(r.id);
    const triples: string[] = [
      `a lo:SourceCitation`,
      `rdfs:label "${ttlEscape(citationLabel(r, gr))}"@en`,
      `dcterms:identifier "${ttlEscape(r.id)}"`,
    ];
    if (r.refRaw) {
      triples.push(
        `dcterms:bibliographicCitation "Diog. Laert. ${ttlEscape(r.refRaw)}"`,
      );
    }
    if (gr) triples.push(`lo:citedAuthor <${sourceGroupUri(gr)}>`);
    if (r.workGrc) triples.push(`lo:citedWorkTitle "${ttlEscape(r.workGrc)}"@grc`);
    if (r.workEn) triples.push(`lo:citedWorkTitle "${ttlEscape(r.workEn)}"@en`);
    if (r.workFr) triples.push(`lo:citedWorkTitle "${ttlEscape(r.workFr)}"@fr`);
    for (const urn of citationSectionUrns(r)) {
      triples.push(`dcterms:source "${urn}"`);
    }
    if (r.certainty) triples.push(`lo:identificationCertainty "${r.certainty}"`);
    lines.push(`<${citationUri(r.id)}>\n    ${triples.join(" ;\n    ")} .`);
    lines.push("");
  }
  return lines.join("\n");
}

// ------------------------------------------------------------- RDF/XML

const RDF_NS = "http://www.w3.org/1999/02/22-rdf-syntax-ns#";
const XSD_STRING = "http://www.w3.org/2001/XMLSchema#string";
const OA_NS = "http://www.w3.org/ns/oa#";

/** Namespaces every predicate and type URI in our data falls under. */
const RDFXML_NS: [string, string][] = [
  ["rdf", RDF_NS],
  ["rdfs", "http://www.w3.org/2000/01/rdf-schema#"],
  ["owl", "http://www.w3.org/2002/07/owl#"],
  ["foaf", "http://xmlns.com/foaf/0.1/"],
  ["dcterms", "http://purl.org/dc/terms/"],
  ["lo", ONT],
  ["otv", OTV],
  ["oa", OA_NS],
  ...Object.entries(ALIGNMENT_PREFIXES),
];

function xmlEscape(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function xmlAttr(s: string): string {
  return xmlEscape(s).replace(/"/g, "&quot;");
}

/** Split a predicate/type URI into a QName against the known namespaces. */
function qname(uri: string): string {
  for (const [prefix, ns] of RDFXML_NS) {
    if (uri.startsWith(ns)) return `${prefix}:${uri.slice(ns.length)}`;
  }
  throw new Error(`No RDF/XML prefix registered for predicate URI: ${uri}`);
}

/**
 * Serialize RDF quads (as parsed by n3 from our Turtle) to RDF/XML.
 * Emits a flat list of rdf:Description elements, grouped by subject in
 * document order. Because it consumes the same graph as graphAsTurtle /
 * ontologyAsTurtle, the RDF/XML is guaranteed identical to the Turtle.
 */
function quadsToRdfXml(quads: Quad[]): string {
  const bnodeIds = new Map<string, string>();
  const bid = (value: string): string => {
    let id = bnodeIds.get(value);
    if (!id) {
      id = `b${bnodeIds.size}`;
      bnodeIds.set(value, id);
    }
    return id;
  };

  // Dedupe identical triples (an RDF graph is a set; our Turtle can emit the
  // same triple twice when a movement school and a claim school share a URI).
  const seen = new Set<string>();
  const order: string[] = [];
  const bySubject = new Map<string, Quad[]>();
  for (const q of quads) {
    const o = q.object;
    const sig =
      `${q.subject.value}\u0001${q.predicate.value}\u0001${o.termType}` +
      `\u0001${o.value}\u0001${o.termType === "Literal" ? o.language : ""}` +
      `\u0001${o.termType === "Literal" ? o.datatype.value : ""}`;
    if (seen.has(sig)) continue;
    seen.add(sig);
    const key =
      q.subject.termType === "BlankNode"
        ? `_:${q.subject.value}`
        : q.subject.value;
    let arr = bySubject.get(key);
    if (!arr) {
      arr = [];
      bySubject.set(key, arr);
      order.push(key);
    }
    arr.push(q);
  }

  const objectXml = (predUri: string, obj: Quad["object"]): string => {
    const qn = qname(predUri);
    if (obj.termType === "NamedNode") {
      return `    <${qn} rdf:resource="${xmlAttr(obj.value)}"/>`;
    }
    if (obj.termType === "BlankNode") {
      return `    <${qn} rdf:nodeID="${bid(obj.value)}"/>`;
    }
    if (obj.termType !== "Literal") {
      throw new Error(`Unexpected RDF term type: ${obj.termType}`);
    }
    const text = xmlEscape(obj.value);
    if (obj.language) {
      return `    <${qn} xml:lang="${xmlAttr(obj.language)}">${text}</${qn}>`;
    }
    if (obj.datatype && obj.datatype.value !== XSD_STRING) {
      return `    <${qn} rdf:datatype="${xmlAttr(obj.datatype.value)}">${text}</${qn}>`;
    }
    return `    <${qn}>${text}</${qn}>`;
  };

  const nsDecls = RDFXML_NS.map(
    ([p, ns]) => `    xmlns:${p}="${xmlAttr(ns)}"`,
  ).join("\n");
  const out: string[] = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<rdf:RDF\n${nsDecls}>`,
  ];
  for (const key of order) {
    const subjectQuads = bySubject.get(key)!;
    const subj = subjectQuads[0]!.subject;
    out.push(
      subj.termType === "BlankNode"
        ? `  <rdf:Description rdf:nodeID="${bid(subj.value)}">`
        : `  <rdf:Description rdf:about="${xmlAttr(subj.value)}">`,
    );
    for (const q of subjectQuads) out.push(objectXml(q.predicate.value, q.object));
    out.push("  </rdf:Description>");
  }
  out.push("</rdf:RDF>");
  return out.join("\n");
}

export function graphAsRdfXml(): string {
  return quadsToRdfXml(new N3Parser().parse(graphAsTurtle()));
}

export function ontologyAsRdfXml(): string {
  return quadsToRdfXml(new N3Parser().parse(ontologyAsTurtle()));
}

// --------------------------------------------------- Per-passage exports

const DCTERMS_NS = "http://purl.org/dc/terms/";
const RDFS_NS = "http://www.w3.org/2000/01/rdf-schema#";
const XSD_INTEGER = "http://www.w3.org/2001/XMLSchema#integer";
const XSD_BOOLEAN = "http://www.w3.org/2001/XMLSchema#boolean";

/** Refs cited by a "Diog. Laert. ..." citation literal (may join several). */
function citationRefs(citation: string): string[] {
  return citation
    .replace(/^Diog\. Laert\. /, "")
    .split(";")
    .map((r) => r.trim())
    .filter((r) => r.length > 0);
}

/**
 * The quads of the per-passage subgraph for one corpus section, or null
 * when the section id is unknown. Derived by filtering the full-graph
 * Turtle (parsed with n3), so the per-passage exports can never drift
 * from the full-graph serializations:
 * - seeds: the claim, saying and verse nodes cited to this section, the
 *   blank reified statements whose citation resolves to it, and the node
 *   of the philosopher whose Life the section belongs to;
 * - plus every node a seed references directly (schools, places, works,
 *   sources, rival claims, ...), one level deep, so labels and external
 *   links travel with the passage;
 * - prefixed with a lo:Passage node carrying the Greek and Hicks English
 *   text of the section itself.
 */
export function sectionQuads(sectionId: string): Quad[] | null {
  const section = sectionById.get(sectionId);
  if (!section) return null;

  const all = new N3Parser().parse(graphAsTurtle());
  const order: string[] = [];
  const bySubject = new Map<string, Quad[]>();
  for (const q of all) {
    const key =
      q.subject.termType === "BlankNode"
        ? `_:${q.subject.value}`
        : q.subject.value;
    let arr = bySubject.get(key);
    if (!arr) {
      arr = [];
      bySubject.set(key, arr);
      order.push(key);
    }
    arr.push(q);
  }

  const seedUris = new Set<string>();
  const philUri = philosopherUri(section.philosopher);
  if (bySubject.has(philUri)) seedUris.add(philUri);
  for (const c of getClaims()) {
    if (sectionIdForRef(c.ref, c.subject) === sectionId) seedUris.add(claimUri(c.id));
  }
  for (const s of getSayings()) {
    if (sectionIdForRef(s.ref, s.philosopher) === sectionId) {
      seedUris.add(sayingUri(s.id));
    }
  }
  for (const a of getAnecdotes()) {
    if (sectionIdForRef(a.ref, a.philosopher) === sectionId) {
      seedUris.add(anecdoteUri(a.id));
    }
  }
  for (const d of getDoxai()) {
    if (doxaSectionIdFor(d.ref, d.philosopher) === sectionId) {
      seedUris.add(doxaUri(d.id));
    }
  }
  for (const v of verses) {
    if (v.sectionId === sectionId) seedUris.add(verseUri(v.id));
  }
  // Epistle refs are full section ids; a letter also seeds the sections
  // holding its Greek salutation (grcRef) and addressee naming (toRef).
  for (const e of getEpistles()) {
    if (
      e.ref === sectionId ||
      e.grcRef === sectionId ||
      e.toRef === sectionId
    ) {
      seedUris.add(epistleUri(e.id));
    }
  }
  // A will seeds every section of its span - the document runs across
  // several contiguous sections and belongs to each of them.
  for (const t of getTestaments()) {
    if (t.sections.includes(sectionId)) {
      seedUris.add(testamentUri(t.id));
    }
  }
  for (const r of getSourcesIndex().rows) {
    if (citationSectionIds(r).includes(sectionId)) {
      seedUris.add(citationUri(r.id));
    }
  }

  const citesSection = (quads: Quad[]): boolean =>
    quads.some(
      (q) =>
        q.predicate.value === `${DCTERMS_NS}bibliographicCitation` &&
        q.object.termType === "Literal" &&
        citationRefs(q.object.value).some((r) =>
          sectionIdsForRef(r).includes(sectionId),
        ),
    );

  const selected = new Set<string>();
  for (const key of order) {
    if (key.startsWith("_:")) {
      if (citesSection(bySubject.get(key)!)) selected.add(key);
    } else if (seedUris.has(key)) {
      selected.add(key);
    }
  }

  // One level of closure so referenced entities keep their labels and
  // external links; deliberately not recursive (a fixpoint would crawl
  // most of the succession network through teacherOf chains).
  const linked = new Set<string>();
  for (const key of selected) {
    for (const q of bySubject.get(key)!) {
      const o = q.object;
      if (
        o.termType === "NamedNode" &&
        bySubject.has(o.value) &&
        !selected.has(o.value)
      ) {
        linked.add(o.value);
      }
    }
  }

  const { namedNode, literal, quad } = DataFactory;
  const p = namedNode(passageUri(sectionId));
  const citation = `Diog. Laert. ${section.book}.${section.section}`;
  const passage: Quad[] = [
    quad(p, namedNode(`${RDF_NS}type`), namedNode(`${ONT}Passage`)),
    quad(
      p,
      namedNode(`${RDFS_NS}label`),
      literal(`${citation} (${section.philosopher})`, "en"),
    ),
    quad(p, namedNode(`${ONT}greekText`), literal(section.text, "grc")),
  ];
  if (section.textEn) {
    passage.push(
      quad(p, namedNode(`${ONT}englishText`), literal(section.textEn, "en")),
    );
  }
  if (bySubject.has(philUri)) {
    passage.push(quad(p, namedNode(`${ONT}inLifeOf`), namedNode(philUri)));
  }
  passage.push(
    quad(
      p,
      namedNode(`${DCTERMS_NS}bibliographicCitation`),
      literal(citation),
    ),
    quad(p, namedNode(`${DCTERMS_NS}source`), literal(section.urn)),
  );

  // W3C Web Annotation layer: one oa:Annotation per deterministic OTV tag
  // in this section (annotate.ts), each anchoring a knowledge-graph
  // individual or otv:Term to the passage text via a TextQuoteSelector and
  // a TextPositionSelector (offsets into lo:greekText / lo:englishText,
  // disambiguated by dcterms:language on the SpecificResource).
  const { blankNode } = DataFactory;
  const annQuads: Quad[] = [];
  for (const [i, a] of annotateSection(section).entries()) {
    const ann = namedNode(`${LOD_BASE}/annotation/${sectionId}/${i + 1}`);
    const body = namedNode(a.entityUri);
    // OTV double dimension: the exact quote realizes a linguistic unit
    // (otv:ProperName / otv:Term) which denotes the conceptual unit. Name
    // tags get a second body pointing at the ProperName node; term tags
    // body the otv:Term (linguistic) plus every doctrine otv:Concept the
    // term denotes (conceptual) - terms with no doctrine in the graph
    // keep the single linguistic body.
    if (a.nameUri) {
      annQuads.push(
        quad(ann, namedNode(`${OA_NS}hasBody`), namedNode(a.nameUri)),
      );
    }
    for (const c of a.conceptUris ?? []) {
      annQuads.push(quad(ann, namedNode(`${OA_NS}hasBody`), namedNode(c)));
    }
    // "oaann" prefix keeps these synthetic labels disjoint from any blank-node
    // labels produced by n3 when parsing the full graph Turtle.
    const target = blankNode(`oaann${i + 1}target`);
    const quoteSel = blankNode(`oaann${i + 1}quote`);
    const posSel = blankNode(`oaann${i + 1}pos`);
    annQuads.push(
      quad(ann, namedNode(`${RDF_NS}type`), namedNode(`${OA_NS}Annotation`)),
      quad(
        ann,
        namedNode(`${OA_NS}motivatedBy`),
        namedNode(`${OA_NS}identifying`),
      ),
      quad(ann, namedNode(`${OA_NS}hasBody`), body),
      quad(ann, namedNode(`${OA_NS}hasTarget`), target),
      quad(
        target,
        namedNode(`${RDF_NS}type`),
        namedNode(`${OA_NS}SpecificResource`),
      ),
      quad(target, namedNode(`${OA_NS}hasSource`), p),
      quad(target, namedNode(`${DCTERMS_NS}language`), literal(a.lang)),
      quad(target, namedNode(`${OA_NS}hasSelector`), quoteSel),
      quad(
        quoteSel,
        namedNode(`${RDF_NS}type`),
        namedNode(`${OA_NS}TextQuoteSelector`),
      ),
      quad(quoteSel, namedNode(`${OA_NS}exact`), literal(a.surface)),
      quad(target, namedNode(`${OA_NS}hasSelector`), posSel),
      quad(
        posSel,
        namedNode(`${RDF_NS}type`),
        namedNode(`${OA_NS}TextPositionSelector`),
      ),
      quad(
        posSel,
        namedNode(`${OA_NS}start`),
        literal(String(a.start), namedNode(XSD_INTEGER)),
      ),
      quad(
        posSel,
        namedNode(`${OA_NS}end`),
        literal(String(a.end), namedNode(XSD_INTEGER)),
      ),
    );
    // Pull the bodies' own quads (label, sameAs, properName, ...) into the
    // export so tagged entities and their linguistic units are
    // self-describing, same as one-hop closure nodes.
    for (const bodyUri of [a.entityUri, a.nameUri, ...(a.conceptUris ?? [])]) {
      if (
        bodyUri &&
        bySubject.has(bodyUri) &&
        !selected.has(bodyUri) &&
        !linked.has(bodyUri)
      ) {
        linked.add(bodyUri);
      }
    }
  }

  // Deduped subgraph in full-graph document order, passage node first.
  const out: Quad[] = [...passage];
  const seen = new Set<string>();
  for (const key of order) {
    if (!selected.has(key) && !linked.has(key)) continue;
    for (const q of bySubject.get(key)!) {
      const o = q.object;
      const sig =
        `${key}\u0001${q.predicate.value}\u0001${o.termType}\u0001${o.value}` +
        `\u0001${o.termType === "Literal" ? o.language : ""}` +
        `\u0001${o.termType === "Literal" ? o.datatype.value : ""}`;
      if (seen.has(sig)) continue;
      seen.add(sig);
      out.push(q);
    }
  }
  out.push(...annQuads);
  return out;
}

function literalToJsonLd(o: Quad["object"] & { termType: "Literal" }): unknown {
  if (o.language) return { "@value": o.value, "@language": o.language };
  const dt = o.datatype.value;
  if (dt === XSD_INTEGER) return Number(o.value);
  if (dt === XSD_BOOLEAN) return o.value === "true";
  if (dt === XSD_STRING) return o.value;
  return { "@value": o.value, "@type": dt };
}

/**
 * JSON-LD for the per-passage subgraph, built from the same quads as the
 * RDF/XML export (single source of truth) and compacted against the same
 * context as the full-graph JSON-LD.
 */
export function sectionAsJsonLd(sectionId: string): object | null {
  const quads = sectionQuads(sectionId);
  if (!quads) return null;
  return quadsToJsonLdDoc(quads);
}

/**
 * JSON-LD document ({@context, @graph}) for an arbitrary quad array, in
 * subject document order, compacted against the full-graph context. Shared
 * by the per-passage exports and the annotated full-graph export.
 */
function quadsToJsonLdDoc(quads: Quad[]): object {
  const bnodeIds = new Map<string, string>();
  const bid = (value: string): string => {
    let id = bnodeIds.get(value);
    if (!id) {
      id = `b${bnodeIds.size}`;
      bnodeIds.set(value, id);
    }
    return id;
  };

  const order: string[] = [];
  const bySubject = new Map<string, Quad[]>();
  for (const q of quads) {
    const key =
      q.subject.termType === "BlankNode"
        ? `_:${q.subject.value}`
        : q.subject.value;
    let arr = bySubject.get(key);
    if (!arr) {
      arr = [];
      bySubject.set(key, arr);
      order.push(key);
    }
    arr.push(q);
  }

  const nodes = order.map((key) => {
    const node: Record<string, unknown> = {
      "@id": key.startsWith("_:") ? `_:${bid(key.slice(2))}` : key,
    };
    const types: string[] = [];
    for (const q of bySubject.get(key)!) {
      if (q.predicate.value === `${RDF_NS}type`) {
        types.push(qname(q.object.value));
        continue;
      }
      const k = qname(q.predicate.value);
      const o = q.object;
      const v =
        o.termType === "NamedNode"
          ? { "@id": o.value }
          : o.termType === "BlankNode"
            ? { "@id": `_:${bid(o.value)}` }
            : literalToJsonLd(o as Quad["object"] & { termType: "Literal" });
      const existing = node[k];
      if (existing === undefined) node[k] = v;
      else if (Array.isArray(existing)) existing.push(v);
      else node[k] = [existing, v];
    }
    if (types.length > 0) {
      node["@type"] = types.length === 1 ? types[0] : types;
    }
    return node;
  });

  return { "@context": JSONLD_CONTEXT, "@graph": nodes };
}

/** RDF/XML for the per-passage subgraph (same quads as the JSON-LD). */
export function sectionAsRdfXml(sectionId: string): string | null {
  const quads = sectionQuads(sectionId);
  return quads ? quadsToRdfXml(quads) : null;
}

/**
 * The whole graph plus the complete stand-off annotation layer: the full
 * graph quads (parsed from graphAsTurtle, so this export can never drift
 * from the plain full-graph serializations) followed by, for every corpus
 * section with at least one deterministic tag, a lo:Passage node carrying
 * the Greek and Hicks English text and one oa:Annotation per tag - the
 * exact same node shapes as the per-passage exports (annotation URIs
 * /annotation/<sectionId>/<n> are shared between the two). Blank-node
 * labels are namespaced per section ("oag<n>x<i>...") so they can never
 * collide across sections or with parser-assigned labels. Cached after the
 * first build (~140k quads); all three serializations derive from the same
 * quad array.
 */
let annotatedQuadsCache: Quad[] | null = null;
/**
 * Emit one section's lo:Passage node (bilingual text literals, Life link,
 * citation, CTS URN) plus its stand-off oa:Annotation nodes into `out`.
 * Shared by annotatedGraphQuads (annotated sections only, blank-node prefix
 * "oag") and passageLayerQuads (every section, prefix "pl"); the emission
 * lives in one place so the two documents can never drift for the sections
 * they share. Blank-node labels are the only difference between them.
 */
function emitPassageQuads(
  out: Quad[],
  section: {
    id: string;
    book: number;
    section: string;
    philosopher: string;
    text: string;
    textEn: string | null;
    urn: string;
  },
  anns: ReturnType<typeof annotateSection>,
  sectionN: number,
  bnodePrefix: string,
  subjectUris: ReadonlySet<string>,
): void {
  const { namedNode, literal, quad, blankNode } = DataFactory;
  const p = namedNode(passageUri(section.id));
  const citation = `Diog. Laert. ${section.book}.${section.section}`;
  out.push(
    quad(p, namedNode(`${RDF_NS}type`), namedNode(`${ONT}Passage`)),
    quad(
      p,
      namedNode(`${RDFS_NS}label`),
      literal(`${citation} (${section.philosopher})`, "en"),
    ),
    quad(p, namedNode(`${ONT}greekText`), literal(section.text, "grc")),
  );
  if (section.textEn) {
    out.push(
      quad(p, namedNode(`${ONT}englishText`), literal(section.textEn, "en")),
    );
  }
  const philUri = philosopherUri(section.philosopher);
  if (subjectUris.has(philUri)) {
    out.push(quad(p, namedNode(`${ONT}inLifeOf`), namedNode(philUri)));
  }
  out.push(
    quad(
      p,
      namedNode(`${DCTERMS_NS}bibliographicCitation`),
      literal(citation),
    ),
    quad(p, namedNode(`${DCTERMS_NS}source`), literal(section.urn)),
  );
  for (const [i, a] of anns.entries()) {
    const ann = namedNode(`${LOD_BASE}/annotation/${section.id}/${i + 1}`);
    const target = blankNode(`${bnodePrefix}${sectionN}x${i + 1}target`);
    const quoteSel = blankNode(`${bnodePrefix}${sectionN}x${i + 1}quote`);
    const posSel = blankNode(`${bnodePrefix}${sectionN}x${i + 1}pos`);
    out.push(
      quad(ann, namedNode(`${RDF_NS}type`), namedNode(`${OA_NS}Annotation`)),
      quad(
        ann,
        namedNode(`${OA_NS}motivatedBy`),
        namedNode(`${OA_NS}identifying`),
      ),
      quad(ann, namedNode(`${OA_NS}hasBody`), namedNode(a.entityUri)),
      // OTV double dimension: name tags add the otv:ProperName node the
      // quote realizes; term tags add every doctrine otv:Concept the
      // otv:Term denotes (the Term itself is the primary body above).
      ...(a.nameUri
        ? [quad(ann, namedNode(`${OA_NS}hasBody`), namedNode(a.nameUri))]
        : []),
      ...(a.conceptUris ?? []).map((c) =>
        quad(ann, namedNode(`${OA_NS}hasBody`), namedNode(c)),
      ),
      quad(ann, namedNode(`${OA_NS}hasTarget`), target),
      quad(
        target,
        namedNode(`${RDF_NS}type`),
        namedNode(`${OA_NS}SpecificResource`),
      ),
      quad(target, namedNode(`${OA_NS}hasSource`), p),
      quad(target, namedNode(`${DCTERMS_NS}language`), literal(a.lang)),
      quad(target, namedNode(`${OA_NS}hasSelector`), quoteSel),
      quad(
        quoteSel,
        namedNode(`${RDF_NS}type`),
        namedNode(`${OA_NS}TextQuoteSelector`),
      ),
      quad(quoteSel, namedNode(`${OA_NS}exact`), literal(a.surface)),
      quad(target, namedNode(`${OA_NS}hasSelector`), posSel),
      quad(
        posSel,
        namedNode(`${RDF_NS}type`),
        namedNode(`${OA_NS}TextPositionSelector`),
      ),
      quad(
        posSel,
        namedNode(`${OA_NS}start`),
        literal(String(a.start), namedNode(XSD_INTEGER)),
      ),
      quad(
        posSel,
        namedNode(`${OA_NS}end`),
        literal(String(a.end), namedNode(XSD_INTEGER)),
      ),
    );
  }
}

export function annotatedGraphQuads(): Quad[] {
  if (annotatedQuadsCache) return annotatedQuadsCache;
  const all = new N3Parser().parse(graphAsTurtle());
  const subjectUris = new Set<string>();
  for (const q of all) {
    if (q.subject.termType === "NamedNode") subjectUris.add(q.subject.value);
  }
  const out: Quad[] = [...all];
  let sectionN = 0;
  for (const section of corpus) {
    const anns = annotateSection(section);
    if (anns.length === 0) continue;
    sectionN += 1;
    emitPassageQuads(out, section, anns, sectionN, "oag", subjectUris);
  }
  annotatedQuadsCache = out;
  return out;
}

let passageLayerQuadsCache: Quad[] | null = null;
/**
 * Passage + stand-off annotation quads for EVERY corpus section - including
 * the ones without a single annotation - and WITHOUT the base graph. This is
 * the annotation-layer dataset file of the ontology-first companion app
 * (Legomena): base graph, TBox and passage layer are committed as separate
 * Turtle documents and composed in one triple store, so this layer must not
 * duplicate base-graph triples. Passage URIs, annotation URIs and selector
 * shapes are exactly those of annotatedGraphQuads (shared emitter above);
 * only the blank-node labels differ, as the documents are separate.
 */
export function passageLayerQuads(): Quad[] {
  if (passageLayerQuadsCache) return passageLayerQuadsCache;
  const subjectUris = new Set<string>();
  for (const q of new N3Parser().parse(graphAsTurtle())) {
    if (q.subject.termType === "NamedNode") subjectUris.add(q.subject.value);
  }
  const out: Quad[] = [];
  let sectionN = 0;
  for (const section of corpus) {
    sectionN += 1;
    emitPassageQuads(
      out,
      section,
      annotateSection(section),
      sectionN,
      "pl",
      subjectUris,
    );
  }
  passageLayerQuadsCache = out;
  return out;
}

let passageLayerTtlCache: string | null = null;
/** Turtle for the passage layer (all sections + annotations, no base graph). */
export function passageLayerAsTurtle(): string {
  if (passageLayerTtlCache) return passageLayerTtlCache;
  const writer = new N3Writer({
    prefixes: {
      lo: ONT,
      rdf: RDF_NS,
      rdfs: RDFS_NS,
      owl: "http://www.w3.org/2002/07/owl#",
      foaf: "http://xmlns.com/foaf/0.1/",
      dcterms: DCTERMS_NS,
      wd: "http://www.wikidata.org/entity/",
      otv: OTV,
      oa: OA_NS,
      xsd: "http://www.w3.org/2001/XMLSchema#",
    },
  });
  writer.addQuads(passageLayerQuads());
  let out = "";
  writer.end((err, result) => {
    if (err) throw err;
    out = result;
  });
  passageLayerTtlCache = out;
  return out;
}

let annotatedTtlCache: string | null = null;
/** Turtle for the whole graph + all stand-off annotations (cached). */
export function annotatedGraphAsTurtle(): string {
  if (annotatedTtlCache) return annotatedTtlCache;
  const writer = new N3Writer({
    prefixes: {
      lo: ONT,
      rdf: RDF_NS,
      rdfs: RDFS_NS,
      owl: "http://www.w3.org/2002/07/owl#",
      foaf: "http://xmlns.com/foaf/0.1/",
      dcterms: DCTERMS_NS,
      wd: "http://www.wikidata.org/entity/",
      otv: OTV,
      oa: OA_NS,
      xsd: "http://www.w3.org/2001/XMLSchema#",
    },
  });
  writer.addQuads(annotatedGraphQuads());
  let out = "";
  writer.end((err, result) => {
    if (err) throw err;
    out = result;
  });
  annotatedTtlCache = out;
  return out;
}

let annotatedJsonLdCache: object | null = null;
/** JSON-LD for the whole graph + all stand-off annotations (same quads). */
export function annotatedGraphAsJsonLd(): object {
  if (!annotatedJsonLdCache) {
    annotatedJsonLdCache = quadsToJsonLdDoc(annotatedGraphQuads());
  }
  return annotatedJsonLdCache;
}

let annotatedRdfXmlCache: string | null = null;
/** RDF/XML for the whole graph + all stand-off annotations (same quads). */
export function annotatedGraphAsRdfXml(): string {
  if (!annotatedRdfXmlCache) {
    annotatedRdfXmlCache = quadsToRdfXml(annotatedGraphQuads());
  }
  return annotatedRdfXmlCache;
}

let ontologyJsonLdCache: object | null = null;
/** JSON-LD for the ontology (TBox), derived from the Turtle so the two
 * serializations can never drift - same policy as the RDF/XML export. */
export function ontologyAsJsonLd(): object {
  if (!ontologyJsonLdCache) {
    ontologyJsonLdCache = quadsToJsonLdDoc(new N3Parser().parse(ontologyAsTurtle()));
  }
  return ontologyJsonLdCache;
}

export function ontologyAsTurtle(): string {
  return `@prefix lo: <${ONT}> .
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix owl: <http://www.w3.org/2002/07/owl#> .
@prefix foaf: <http://xmlns.com/foaf/0.1/> .
@prefix dcterms: <http://purl.org/dc/terms/> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
@prefix otv: <${OTV}> .
${Object.entries(ALIGNMENT_PREFIXES)
  .map(([p, uri]) => `@prefix ${p}: <${uri}> .`)
  .join("\n")}

<${LOD_BASE}/ontology> a owl:Ontology ;
    rdfs:label "Laertius Ontology"@en ;
    rdfs:seeAlso <http://www.ontologia.fr/OTB/The_OntoTerminology_Vocabulary.htm> ;
    dcterms:references <http://www.ontologia.fr/OTB/otv.rdf> ;
    dcterms:description "An ontology for the philosophers, schools, successions (diadochai), works, doctrines and biographical claims described in Diogenes Laertius' Lives of Eminent Philosophers. Every fact is source-internal: cited to a passage of D.L. himself. Claims carry a certainty level reflecting D.L.'s own epistemic stance (asserted / reported / disputed / conjectured), the authority he names, and links between conflicting alternative reports. Only asserted claims are also emitted as direct triples; hedged and disputed claims exist only as lo:Claim reifications. Sayings (apophthegms) attributed to the philosophers are reified as lo:Saying under the same certainty model. The poems, epigrams, oracles and epitaphs quoted in the Lives are modeled as lo:Verse, each carrying its Greek text, the aligned Hicks English when available, and an exact citation of the section where it is quoted. The letters D.L. quotes verbatim are modeled as lo:Epistle document nodes with sender, addressee and a curated authenticity verdict (authentic / disputed / spurious) - a modern philological axis deliberately distinct from D.L.'s own certainty. The narrated biographical incidents are modeled as lo:Anecdote document nodes under the same certainty model, each carrying its verbatim Hicks English, a thematic topic, the named participant where the passage gives one, and a link to the curated saying whose narrative setting it gives. The six wills D.L. quotes verbatim (Plato, Aristotle, Theophrastus, Strato, Lyco, Epicurus) are modeled as lo:Testament document nodes, each carrying the testator, the verbatim opening in both languages, the curated cast as literals (beneficiaries, executors, witnesses - never guessed into node links), and curated key provisions. The doctrinal tenets D.L. reports - the doxography proper of the Lives - are modeled as lo:Doxa document nodes under the same certainty model, each carrying the verbatim Hicks English of the doctrinal passage (and Greek where curated), a controlled doctrinal domain, the holding philosopher, and, where the tenet instantiates a doctrine node the graph already knows, an lo:expressesDoctrine link to that node. The subjects of the Lives are classed by book: the eleven sages (sophoi) of Book 1 are lo:Sage, the subjects of Books 2-10 are lo:Philosopher, Thales alone carries both classes, and all share the superclass lo:ChapterSubject. Each chapter (each Life) is additionally reified as a lo:Chapter node linked to its main subject via lo:hasMainSubject."@en ;
    dcterms:source "urn:cts:greekLit:tlg0004.tlg001" .

# ---------------------------------------------------------------- Classes

lo:ChapterSubject a owl:Class ;
    rdfs:subClassOf foaf:Person ;
    rdfs:label "Chapter subject"@en ;
    rdfs:comment "A person to whom Diogenes Laertius devotes a chapter (a Life) of the Lives of Eminent Philosophers. Every chapter subject is a lo:Philosopher, a lo:Sage, or (Thales) both."@en .

lo:Philosopher a owl:Class ;
    rdfs:subClassOf lo:ChapterSubject ;
    rdfs:label "Philosopher"@en ;
    rdfs:comment "A philosopher with a Life in Diogenes Laertius: the subjects of Books 2-10, plus Thales, whom D.L. both counts among the Seven Sages and treats as the first philosopher of the Ionian succession (1.13; cf. Aristotle, Met. 983b20) and whose doctrines the text reports (1.24, 1.27)."@en .

lo:Sage a owl:Class ;
    rdfs:subClassOf lo:ChapterSubject ;
    rdfs:label "Sage"@en ;
    rdfs:comment "One of the sages (sophoi) whose Lives make up Book 1 - the tradition of the Seven Sages and its rivals. D.L. himself separates them from philosophy proper: closing Book 1 he writes 'these were the men called wise', and Book 2 opens the philosophical successions. Thales alone is also typed lo:Philosopher; the classification is curated, never inferred."@en .

lo:Chapter a owl:Class ;
    rdfs:label "Chapter"@en ;
    rdfs:comment "A chapter (a Life) of the Lives of Eminent Philosophers, linked to the person it is about via lo:hasMainSubject and carrying its book and chapter number."@en .

lo:School a owl:Class ;
    rdfs:label "School"@en ;
    rdfs:comment "A philosophical school or movement."@en .

lo:Place a owl:Class ;
    rdfs:label "Place"@en ;
    rdfs:comment "A city, island, region, deme or landmark named by Diogenes Laertius - as the place of a life event (birth, death, residence, travel) or merely mentioned in the text. Every place carries exactly one of the subclasses below except the compound labels where D.L. himself reports rival locations (e.g. 'Elea, but some say Abdera and others Miletus')."@en .

lo:City a owl:Class ;
    rdfs:subClassOf lo:Place ;
    rdfs:label "City"@en ;
    rdfs:comment "A polis, town or village."@en .

lo:Island a owl:Class ;
    rdfs:subClassOf lo:Place ;
    rdfs:label "Island"@en ;
    rdfs:comment "An island, kept as the dominant type even where the island doubles as a polis (Samos, Delos) or a large region (Sicily, Crete)."@en .

lo:Region a owl:Class ;
    rdfs:subClassOf lo:Place ;
    rdfs:label "Region"@en ;
    rdfs:comment "A region, district or country (Attica, Ionia, Egypt, Scythia)."@en .

lo:Deme a owl:Class ;
    rdfs:subClassOf lo:Place ;
    rdfs:label "Deme"@en ;
    rdfs:comment "An Attic deme, typed as such only where Diogenes Laertius' usage is demotic or residential (Alopece, Gargettus, Phalerum); deme-origin names he uses as towns or battle sites (Marathon, Eleusis, Piraeus) are typed lo:City."@en .

lo:Landmark a owl:Class ;
    rdfs:subClassOf lo:Place ;
    rdfs:label "Landmark"@en ;
    rdfs:comment "A named non-polis site: sanctuary (Delphi, Olympia, Nemea), gymnasium (Academy, Lyceum, Cynosarges) or urban district (Ceramicus, Munichia)."@en .

lo:NaturalFeature a owl:Class ;
    rdfs:subClassOf lo:Place ;
    rdfs:label "Natural feature"@en ;
    rdfs:comment "A river, mountain, strait or other natural feature (Nile, Etna, Ida, Hellespont, Bosporus - the Cimmerian strait)."@en .

lo:Work a owl:Class ;
    rdfs:label "Work"@en ;
    rdfs:comment "A work or treatise attributed to a philosopher in Diogenes Laertius. Attributions may be disputed; see the lo:Claim carrying the attribution."@en .

lo:Doctrine a owl:Class ;
    rdfs:label "Doctrine"@en ;
    rdfs:comment "A doctrine or teaching reported by Diogenes Laertius, e.g. the Stoic 'life in agreement with nature'."@en .

lo:GreekTerm a owl:Class ;
    rdfs:label "Greek term"@en ;
    rdfs:comment "A Greek technical term (e.g. telos) used in the text to express a doctrine. Terms shared across schools anchor comparisons of divergent definitions."@en .

lo:Source a owl:Class ;
    rdfs:label "Source"@en ;
    rdfs:comment "An authority Diogenes Laertius names for a claim (e.g. Apollodorus' Chronology, Sosicrates, Favorinus)."@en .

lo:SourceCitation a owl:Class ;
    rdfs:label "Source citation"@en ;
    rdfs:comment "One entry of the curated sources index: an authority (and often a work) cited by Diogenes Laertius at a given reference. Each citation keeps the workbook's stable identifier, the reference exactly as written, CTS URNs for every reference that resolves to a corpus passage, the cited work's title forms (Greek, English, French), and the curator's identification certainty when the row was graded."@en .

lo:Claim a owl:Class ;
    rdfs:subClassOf rdf:Statement ;
    rdfs:label "Claim"@en ;
    rdfs:comment "A single cited claim from the text: a reified statement carrying its D.L. citation, a certainty level, the authority D.L. names (if any), and links to conflicting alternative claims."@en .

lo:ChainLink a owl:Class ;
    rdfs:label "Chain link"@en ;
    rdfs:comment "One step in a claim's assertion transmission chain: the intermediary authority through whose work the claim was transmitted to Diogenes Laertius. A chain link records the intermediary's source node and, when D.L. names it, the specific work. Chain links have stable URIs (claim-id/chain/N) so they can be referenced unambiguously across serializations."@en .

lo:Saying a owl:Class ;
    rdfs:subClassOf rdf:Statement ;
    rdfs:label "Saying"@en ;
    rdfs:comment "A saying or apophthegm the text attributes to a philosopher: a reified lo:said statement carrying the Hicks English (and Greek when curated), a thematic topic, an editorial gloss, a certainty level, the authority D.L. names (if any), and its D.L. citation. As with claims, only sayings asserted in D.L.'s own voice also appear as direct lo:said triples."@en .

lo:Verse a owl:Class ;
    rdfs:label "Verse"@en ;
    rdfs:comment "A poem, epigram, oracle or epitaph quoted in the Lives (many are Diogenes Laertius' own, from his Pammetros): the Greek text, the aligned Hicks English when available, a link to the philosopher in whose Life it is quoted, and the editorial source label when one is recorded (e.g. 'Anth. Pal. vii. 615.')."@en .

lo:Epistle a owl:Class ;
    rdfs:label "Epistle"@en ;
    rdfs:comment "A letter Diogenes Laertius quotes verbatim in the Lives: the (fictional) correspondence of the Seven Sages, the royal exchanges, and Epicurus' doctrinal epistles. Each carries its sender and addressee, a Hicks English excerpt (opening or key passage), the Greek incipit or salutation, and the curator's authenticity verdict - an axis distinct from the claims' certainty model, since D.L. quotes Hellenistic epistolary fictions and genuine Epicurus with the same straight face. Only letters D.L. quotes as an actual text qualify, never mere reports that a letter existed."@en .

lo:Anecdote a owl:Class ;
    rdfs:label "Anecdote"@en ;
    rdfs:comment "A narrated biographical incident Diogenes Laertius tells about a philosopher: document nodes like the epistles, not reified statements - an anecdote is a story the text tells, not a proposition the philosopher asserted. Each carries the verbatim Hicks English (and Greek where curated), a thematic topic, a certainty level tracking D.L.'s stance toward the story, the authority he names (if any), and optionally the named participant and a link to the curated saying whose narrative setting it gives. Incidents whose entire substance is a saying stay in the sayings layer and are not re-curated here."@en .

lo:Doxa a owl:Class ;
    rdfs:label "Doxa"@en ;
    rdfs:comment "A doctrinal tenet Diogenes Laertius reports a philosopher held - the doxography proper of the Lives, as distinct from the biographical facts of the claims layer and the bare dicta of the sayings layer. Document nodes like the anecdotes, not reified statements: each carries the verbatim Hicks English of the doctrinal passage (and Greek where curated), a controlled doctrinal domain (first-principles, cosmology, physics, soul, gods, epistemology, logic, ethics, pleasure, politics, fate, death), an editorial gloss, a certainty level tracking D.L.'s stance, the authority he names (if any), and - where the tenet instantiates a doctrine node the graph already knows from the claims layer - an lo:expressesDoctrine link. The layer mints no new nodes: authorities are restricted to existing sources, and rival attributions stay literals unless the name matches a corpus philosopher."@en .

lo:Testament a owl:Class ;
    rdfs:label "Testament"@en ;
    rdfs:comment "A will Diogenes Laertius quotes verbatim in the Lives - he preserves exactly six: Plato's, and the great Peripatetic and Epicurean series (Aristotle, Theophrastus, Strato, Lyco, Epicurus), for all of which he is the sole surviving source. Document nodes like the epistles and anecdotes. Each carries the testator, the verbatim Hicks English opening with the Greek incipit, the curated cast (beneficiaries, executors, witnesses) as literals - the wills teem with bare homonyms, so names are never guessed into node links - and curated key provisions. Only lo:involves links graph nodes, restricted to corpus philosophers whose identification in the will is scholarly consensus; as it happens each such link is the testator's successor, so the wills trace the school successions."@en .

lo:Epigram a owl:Class ;
    rdfs:subClassOf lo:Verse ;
    rdfs:label "Epigram"@en ;
    rdfs:comment "A verse classifiable as an epigram: either its editorial source label cites the Greek Anthology (Anth. Pal. / Anth. Plan.), or it is one of Diogenes Laertius' own Pammetros epigrams as recorded in the curated authorship map. Other verses (oracles, elegies, Silloi, tragic fragments) remain plain lo:Verse rather than being conjecturally typed."@en .

lo:Passage a owl:Class ;
    rdfs:label "Passage"@en ;
    rdfs:comment "A single numbered section (passage) of the Lives: the Greek text with the aligned Hicks English, linked to the Life it belongs to. Passages anchor the per-passage linked-data exports; the claims, sayings and verses cited to a passage carry its CTS URN in dcterms:source."@en .

lo:CertaintyLevel a owl:Class ;
    rdfs:label "Certainty level"@en ;
    rdfs:comment "The epistemic stance of Diogenes Laertius toward a claim."@en .

lo:AuthenticityLevel a owl:Class ;
    rdfs:label "Authenticity level"@en ;
    rdfs:comment "The curator's verdict, following modern scholarship, on whether a quoted letter is genuinely by its named sender. Deliberately distinct from lo:CertaintyLevel: certainty tracks Diogenes Laertius' own epistemic stance, authenticity tracks the modern philological judgment he could not make."@en .

lo:Role a owl:Class ;
    rdfs:label "Person role"@en ;
    rdfs:comment "A curated occupational role of a person named in the Lives: what Diogenes Laertius' text (or an uncontroversial standard identification) says the person was. Roles are individuals linked via lo:hasRole, deliberately NOT rdfs subclasses of the person classes: the node classes (lo:Philosopher, lo:Source, foaf:Person) encode how the graph knows the person, roles encode what the person did, and one person may carry several. The union is closed and small; persons whose role is unknown, disputed between homonyms, or outside the union simply carry no lo:hasRole."@en .

lo:WorkForm a owl:Class ;
    rdfs:label "Work form"@en ;
    rdfs:comment "The literary form of a work named in the Lives: prose, verse, or mixed (Menippus' spoudogeloion, prosimetrum). A closed union of three individuals linked via lo:hasForm; works whose form is unknowable from the title and Diogenes Laertius' remarks carry no lo:hasForm at all - absence is a curated statement of ignorance, never a default."@en .

lo:WorkTopic a owl:Class ;
    rdfs:label "Work topic"@en ;
    rdfs:comment "The dominant subject matter of a work, from a closed union of twenty-four topics anchored in the ancient division of philosophy Diogenes Laertius himself reports (physics, ethics, dialectic) and extended with the genres the catalogues actually contain (letters, tragedy, history, mathematics, …). One topic per work - the dominant one; works with an opaque title carry no lo:hasWorkTopic."@en .

lo:SurvivalStatus a owl:Class ;
    rdfs:label "Survival status"@en ;
    rdfs:comment "The modern transmission verdict on a work: lost (only the title survives), surviving in excerpts or quoted fragments, or extant as an independently transmitted text. Deliberately distinct from lo:transmissionStatus, which records what Diogenes Laertius himself says about a work's authenticity or survival - the two axes can disagree (works he doubts are extant; works he cites as living texts are lost to us)."@en .

lo:ManuscriptVariant a owl:Class ;
    rdfs:label "Manuscript variant"@en ;
    rdfs:comment "A variant reading of a passage in the manuscript tradition. Modeled for completeness; no variant data is curated, as the corpus carries no apparatus criticus."@en .

lo:Witness a owl:Class ;
    rdfs:label "Witness"@en ;
    rdfs:comment "A manuscript or secondary citation attesting a reading or fragment. Modeled for completeness; no witness data is curated."@en .

# ------------------------------- OTV core (OntoTerminology Vocabulary)
# The graph reuses Christophe Roche's OntoTerminology Vocabulary
# (http://www.ontologia.fr/OTB/otv#) for its terminological dimension:
# doctrines are otv:Concept, Greek key terms are otv:Term, and named
# individuals are otv:Object, denoted by otv:ProperName nodes. There is
# deliberately no owl:imports (otv.rdf is http-only); instead the OTV core
# skeleton actually used by the graph is mirrored below, faithful to the
# source vocabulary (rdfs:isDefinedBy on every mirrored resource), so this
# ontology is self-contained. The full vocabulary defines further core
# classes (otv:Category, otv:Attribute, otv:Relation, otv:AxisOfAnalysis,
# otv:Difference) and differential-semantics properties that this graph
# does not use and therefore does not mirror.

otv:OTVCore a owl:Class ;
    rdfs:label "OTVCore"@en ;
    rdfs:comment "The super class of OTV Classes."@en ;
    rdfs:isDefinedBy <http://www.ontologia.fr/OTB/otv.rdf> .

otv:Concept a owl:Class ;
    rdfs:subClassOf otv:OTVCore ;
    rdfs:label "Concept"@en ;
    rdfs:comment "The class of OTV Concepts."@en ;
    owl:disjointWith otv:Object, otv:Term, otv:ProperName ;
    rdfs:isDefinedBy <http://www.ontologia.fr/OTB/otv.rdf> .

otv:Object a owl:Class ;
    rdfs:subClassOf otv:OTVCore ;
    rdfs:label "Object"@en ;
    rdfs:comment "The class of OTV Objects."@en ;
    owl:disjointWith otv:Term, otv:ProperName ;
    rdfs:isDefinedBy <http://www.ontologia.fr/OTB/otv.rdf> .

otv:Term a owl:Class ;
    rdfs:subClassOf otv:OTVCore ;
    rdfs:label "Term"@en ;
    rdfs:comment "The class of OTV Terms: 'a term is a verbal designation of a concept' (ISO 1087)."@en ;
    owl:disjointWith otv:ProperName ;
    rdfs:isDefinedBy <http://www.ontologia.fr/OTB/otv.rdf> .

otv:ProperName a owl:Class ;
    rdfs:subClassOf otv:OTVCore ;
    rdfs:label "ProperName"@en ;
    rdfs:comment "The class of OTV ProperNames, the names denoting objects."@en ;
    rdfs:isDefinedBy <http://www.ontologia.fr/OTB/otv.rdf> .

otv:instanceOf a owl:ObjectProperty ;
    rdfs:label "instanceOf"@en ;
    rdfs:comment "Instance relationship between an object and a concept."@en ;
    rdfs:domain otv:Object ;
    rdfs:range otv:Concept ;
    rdfs:isDefinedBy <http://www.ontologia.fr/OTB/otv.rdf> .

otv:isA a owl:ObjectProperty ;
    rdfs:label "isA"@en ;
    rdfs:comment "Generic relationship between 2 concepts."@en ;
    rdfs:domain otv:Concept ;
    rdfs:range otv:Concept ;
    rdfs:isDefinedBy <http://www.ontologia.fr/OTB/otv.rdf> .

otv:denotedByTerm a owl:ObjectProperty ;
    rdfs:label "denotedByTerm"@en ;
    rdfs:comment "Links a concept to a term which denotes it."@en ;
    rdfs:domain otv:Concept ;
    rdfs:range otv:Term ;
    rdfs:isDefinedBy <http://www.ontologia.fr/OTB/otv.rdf> .

otv:denotedConcept a owl:ObjectProperty ;
    rdfs:label "denotedConcept"@en ;
    rdfs:comment "The concept denoted by the term."@en ;
    rdfs:domain otv:Term ;
    rdfs:range otv:Concept ;
    rdfs:isDefinedBy <http://www.ontologia.fr/OTB/otv.rdf> .

otv:denotedByProperName a owl:ObjectProperty ;
    rdfs:label "denotedByProperName"@en ;
    rdfs:comment "Links an individual (object) to a proper name which denotes it."@en ;
    rdfs:domain otv:Object ;
    rdfs:range otv:ProperName ;
    rdfs:isDefinedBy <http://www.ontologia.fr/OTB/otv.rdf> .

otv:denotedObject a owl:ObjectProperty ;
    rdfs:label "denotedObject"@en ;
    rdfs:comment "The object denoted by the proper name."@en ;
    rdfs:domain otv:ProperName ;
    rdfs:range otv:Object ;
    rdfs:isDefinedBy <http://www.ontologia.fr/OTB/otv.rdf> .

otv:conceptName a owl:DatatypeProperty ;
    rdfs:label "conceptName"@en ;
    rdfs:comment "Name of the concept."@en ;
    rdfs:domain otv:Concept ;
    rdfs:range xsd:string ;
    rdfs:isDefinedBy <http://www.ontologia.fr/OTB/otv.rdf> .

otv:termName a owl:DatatypeProperty ;
    rdfs:label "termName"@en ;
    rdfs:comment "String representing the term."@en ;
    rdfs:domain otv:Term ;
    rdfs:range xsd:string ;
    rdfs:isDefinedBy <http://www.ontologia.fr/OTB/otv.rdf> .

otv:properName a owl:DatatypeProperty ;
    rdfs:label "properName"@en ;
    rdfs:comment "String representing the proper name."@en ;
    rdfs:domain otv:ProperName ;
    rdfs:range xsd:string ;
    rdfs:isDefinedBy <http://www.ontologia.fr/OTB/otv.rdf> .

otv:language a owl:DatatypeProperty ;
    rdfs:label "language"@en ;
    rdfs:comment "The language of the term or proper name. In the source vocabulary the domain is the union of otv:Term and otv:ProperName; no rdfs:domain is asserted here to avoid mirroring the union blank node."@en ;
    rdfs:range xsd:string ;
    rdfs:isDefinedBy <http://www.ontologia.fr/OTB/otv.rdf> .

# ------------------------------- OTV alignment: lo: classes into the core

lo:ChapterSubject rdfs:subClassOf otv:Object .
lo:Philosopher rdfs:subClassOf otv:Object .
lo:Sage rdfs:subClassOf otv:Object .
lo:Chapter rdfs:subClassOf otv:Object .
lo:School rdfs:subClassOf otv:Object .
lo:Place rdfs:subClassOf otv:Object .
lo:Source rdfs:subClassOf otv:Object .
lo:Work rdfs:subClassOf otv:Object ;
    rdfs:comment "OTV alignment note: work titles mint otv:ProperName nodes (one per language, plain xsd:string literals) for the annotation double dimension only; work tagging itself stays label-driven."@en .
lo:Doctrine rdfs:subClassOf otv:Concept .
lo:GreekTerm rdfs:subClassOf otv:Term .
lo:usesTerm rdfs:subPropertyOf otv:denotedByTerm .

# The closed controlled vocabularies of the ontology are likewise concepts
# in the ontoterminological reading: each partitions one axis of the domain
# (epistemic stance, philological verdict, occupation, literary form,
# subject matter, transmission fate). Their classes are aligned to
# otv:Concept and every individual below is also typed otv:Concept with an
# otv:conceptName - explicitly, since the SPARQL endpoint applies no OWL
# reasoning and subclass axioms alone would not materialize the typing.
lo:CertaintyLevel rdfs:subClassOf otv:Concept .
lo:AuthenticityLevel rdfs:subClassOf otv:Concept .
lo:Role rdfs:subClassOf otv:Concept .
lo:WorkForm rdfs:subClassOf otv:Concept .
lo:WorkTopic rdfs:subClassOf otv:Concept .
lo:SurvivalStatus rdfs:subClassOf otv:Concept .

# ---------------------------------------------- Certainty level individuals

lo:Asserted a lo:CertaintyLevel, otv:Concept ;
    rdfs:label "asserted"@en ;
    otv:conceptName "asserted" ;
    rdfs:comment "Stated by Diogenes Laertius in his own voice, without hedging."@en .

lo:Reported a lo:CertaintyLevel, otv:Concept ;
    rdfs:label "reported"@en ;
    otv:conceptName "reported" ;
    rdfs:comment "Hedged: 'some say', 'according to X', 'it is said'."@en .

lo:Disputed a lo:CertaintyLevel, otv:Concept ;
    rdfs:label "disputed"@en ;
    otv:conceptName "disputed" ;
    rdfs:comment "Diogenes Laertius records explicit disagreement about the claim."@en .

lo:Conjectured a lo:CertaintyLevel, otv:Concept ;
    rdfs:label "conjectured"@en ;
    otv:conceptName "conjectured" ;
    rdfs:comment "An inference, not directly stated in the text."@en .

# ---------------------------------------------- Authenticity level individuals

lo:Authentic a lo:AuthenticityLevel, otv:Concept ;
    rdfs:label "authentic"@en ;
    otv:conceptName "authentic" ;
    rdfs:comment "Generally accepted as genuinely by its named sender (Epicurus' epistles)."@en .

lo:DisputedAuthenticity a lo:AuthenticityLevel, otv:Concept ;
    rdfs:label "disputed"@en ;
    otv:conceptName "disputed" ;
    rdfs:comment "Genuinely contested or unverifiable. Named DisputedAuthenticity to avoid colliding with the certainty individual lo:Disputed - the two axes are distinct."@en .

lo:Spurious a lo:AuthenticityLevel, otv:Concept ;
    rdfs:label "spurious"@en ;
    otv:conceptName "spurious" ;
    rdfs:comment "Generally rejected: Hellenistic epistolary fiction (the entire Seven Sages correspondence, the Anaximenes and Darius/Heraclitus letters)."@en .

# --------------------------------------------------- Person role individuals

${(Object.keys(PERSON_ROLE_INDIVIDUAL) as PersonRole[])
  .map(
    (r) =>
      `lo:${PERSON_ROLE_INDIVIDUAL[r]} a lo:Role, otv:Concept ;\n    rdfs:label "${PERSON_ROLE_LABEL[r]}"@en ;\n    otv:conceptName "${ttlEscape(PERSON_ROLE_LABEL[r])}" .`,
  )
  .join("\n\n")}

# ----------------------------------------------------- Work form individuals

${(Object.keys(WORK_FORM_INDIVIDUAL) as WorkForm[])
  .map(
    (f) =>
      `lo:${WORK_FORM_INDIVIDUAL[f]} a lo:WorkForm, otv:Concept ;\n    rdfs:label "${WORK_FORM_LABEL[f]}"@en ;\n    otv:conceptName "${ttlEscape(WORK_FORM_LABEL[f])}" .`,
  )
  .join("\n\n")}

# ---------------------------------------------------- Work topic individuals

${(Object.keys(WORK_TOPIC_INDIVIDUAL) as WorkTopic[])
  .map(
    (t) =>
      `lo:${WORK_TOPIC_INDIVIDUAL[t]} a lo:WorkTopic, otv:Concept ;\n    rdfs:label "${WORK_TOPIC_LABEL[t]}"@en ;\n    otv:conceptName "${ttlEscape(WORK_TOPIC_LABEL[t])}" .`,
  )
  .join("\n\n")}

# ------------------------------------------------ Survival status individuals

${(Object.keys(WORK_SURVIVAL_INDIVIDUAL) as WorkSurvival[])
  .map(
    (s) =>
      `lo:${WORK_SURVIVAL_INDIVIDUAL[s]} a lo:SurvivalStatus, otv:Concept ;\n    rdfs:label "${WORK_SURVIVAL_LABEL[s]}"@en ;\n    otv:conceptName "${ttlEscape(WORK_SURVIVAL_LABEL[s])}" .`,
  )
  .join("\n\n")}

# ------------------------------------------------ Succession relations

lo:teacherOf a owl:ObjectProperty ;
    rdfs:label "teacher of"@en ;
    rdfs:comment "Direct teacher-pupil relation reported by Diogenes Laertius. The domain and range are foaf:Person, not lo:ChapterSubject: besides the chapter-subject successions of the knowledge graph, D.L. records succession chains whose members have no Life of their own (the Sceptic chain from Pyrrho's pupils down to Saturninus at 9.68-116, the later Academy scholarchs at 4.60), and those foaf:Person and lo:Source nodes carry cited teacher links too (succession-links.ts)."@en ;
    rdfs:domain foaf:Person ;
    rdfs:range foaf:Person .

lo:studentOf a owl:ObjectProperty ;
    rdfs:label "student of"@en ;
    owl:inverseOf lo:teacherOf .

lo:influenced a owl:ObjectProperty ;
    rdfs:label "influenced"@en ;
    rdfs:comment "Doctrinal transmission or succession without a directly attested teacher-pupil relation."@en ;
    rdfs:domain lo:ChapterSubject ;
    rdfs:range lo:ChapterSubject .

lo:influencedBy a owl:ObjectProperty ;
    rdfs:label "influenced by"@en ;
    owl:inverseOf lo:influenced .

lo:spouseOf a owl:ObjectProperty, owl:SymmetricProperty ;
    rdfs:label "spouse of"@en ;
    rdfs:domain lo:ChapterSubject ;
    rdfs:range lo:ChapterSubject .

lo:memberOf a owl:ObjectProperty ;
    rdfs:label "member of"@en ;
    rdfs:comment "School membership. The domain is foaf:Person, not lo:ChapterSubject: besides the chapter subjects, Diogenes Laertius names eminent disciples of a school who have no Life of their own (the Garden roster at 10.22-26, the Sceptic school of 9.68-116, the later Academy scholarchs of 4.60), and those foaf:Person and lo:Source nodes carry cited memberships too. lo:teacherOf and lo:studentOf are likewise widened to foaf:Person for the succession-links layer; the influence properties keep the narrow lo:ChapterSubject domain, since only knowledge-graph edges use them."@en ;
    rdfs:domain foaf:Person ;
    rdfs:range lo:School .

lo:hasMainSubject a owl:ObjectProperty ;
    rdfs:label "has main subject"@en ;
    rdfs:comment "The person whose Life this chapter of the Lives is."@en ;
    rdfs:domain lo:Chapter ;
    rdfs:range lo:ChapterSubject .

# ------------------------------------------------ Biographical relations

lo:bornIn a owl:ObjectProperty ;
    rdfs:label "born in"@en ;
    rdfs:domain lo:ChapterSubject ;
    rdfs:range lo:Place .

lo:diedIn a owl:ObjectProperty ;
    rdfs:label "died in"@en ;
    rdfs:domain lo:ChapterSubject ;
    rdfs:range lo:Place .

lo:livedIn a owl:ObjectProperty ;
    rdfs:label "lived in"@en ;
    rdfs:comment "Residence or citizenship reported by Diogenes Laertius."@en ;
    rdfs:domain lo:ChapterSubject ;
    rdfs:range lo:Place .

lo:traveledTo a owl:ObjectProperty ;
    rdfs:label "traveled to"@en ;
    rdfs:domain lo:ChapterSubject ;
    rdfs:range lo:Place .

lo:locatedIn a owl:ObjectProperty ;
    rdfs:label "located in"@en ;
    rdfs:comment "Curated containment between places (Athens in Attica, Miletus in Ionia), asserted one level only and only where textbook-unambiguous. Deliberately not declared owl:TransitiveProperty - the endpoint does no OWL reasoning; chain with the SPARQL property path lo:locatedIn+."@en ;
    rdfs:domain lo:Place ;
    rdfs:range lo:Place .

lo:wrote a owl:ObjectProperty ;
    rdfs:label "wrote"@en ;
    rdfs:comment "Attribution of a work, as reported by Diogenes Laertius. Disputed attributions are carried by lo:Claim reifications only."@en ;
    rdfs:domain lo:ChapterSubject ;
    rdfs:range lo:Work .

lo:heldDoctrine a owl:ObjectProperty ;
    rdfs:label "held doctrine"@en ;
    rdfs:domain lo:ChapterSubject ;
    rdfs:range lo:Doctrine .

lo:usesTerm a owl:ObjectProperty ;
    rdfs:label "uses term"@en ;
    rdfs:domain lo:Doctrine ;
    rdfs:range lo:GreekTerm .

lo:praised a owl:ObjectProperty ;
    rdfs:label "praised"@en ;
    rdfs:comment "One philosopher's recorded commendation of another."@en ;
    rdfs:domain lo:ChapterSubject ;
    rdfs:range foaf:Person .

lo:criticized a owl:ObjectProperty ;
    rdfs:label "criticized"@en ;
    rdfs:comment "One philosopher's recorded criticism or abuse of another."@en ;
    rdfs:domain lo:ChapterSubject ;
    rdfs:range foaf:Person .

# ------------------------------------------------ Claim (uncertainty) model

lo:certainty a owl:ObjectProperty ;
    rdfs:label "certainty"@en ;
    rdfs:comment "The epistemic stance of Diogenes Laertius toward this claim, saying, anecdote or doxa."@en ;
    rdfs:domain [ a owl:Class ; owl:unionOf ( lo:Claim lo:Saying lo:Anecdote lo:Doxa ) ] ;
    rdfs:range lo:CertaintyLevel .

lo:accordingTo a owl:ObjectProperty ;
    rdfs:label "according to"@en ;
    rdfs:comment "The authority Diogenes Laertius names for this claim, saying, letter, anecdote or doxa."@en ;
    rdfs:domain [ a owl:Class ; owl:unionOf ( lo:Claim lo:Saying lo:Epistle lo:Anecdote lo:Doxa ) ] ;
    rdfs:range lo:Source .

lo:conflictsWith a owl:ObjectProperty, owl:SymmetricProperty ;
    rdfs:label "conflicts with"@en ;
    rdfs:comment "Links alternative claims Diogenes Laertius records for the same question (conflicting dates, disputed attributions, rival teacher reports)."@en ;
    rdfs:domain lo:Claim ;
    rdfs:range lo:Claim .

lo:assertedInWork a owl:ObjectProperty ;
    rdfs:label "asserted in work"@en ;
    rdfs:comment "The specific work in which the named accordingTo authority made the assertion, when Diogenes Laertius names it. Requires lo:accordingTo to be set; the object must be a lo:Work node already present in the graph."@en ;
    rdfs:domain lo:Claim ;
    rdfs:range lo:Work .

lo:transmissionChain a owl:ObjectProperty ;
    rdfs:label "transmission chain"@en ;
    rdfs:comment "One step in the assertion's transmission chain: the intermediary source through whose work the claim passed before reaching Diogenes Laertius. The chain is ordered nearest-intermediary first (accordingTo cites chain[0]; chain[0] cites chain[1] ...)."@en ;
    rdfs:domain lo:Claim ;
    rdfs:range lo:ChainLink .

lo:chainAuthority a owl:ObjectProperty ;
    rdfs:label "chain authority"@en ;
    rdfs:comment "The lo:Source node of the intermediary authority in this transmission chain link."@en ;
    rdfs:domain lo:ChainLink ;
    rdfs:range lo:Source .

lo:chainWork a owl:ObjectProperty ;
    rdfs:label "chain work"@en ;
    rdfs:comment "The specific lo:Work through which the chain authority transmitted the assertion, when Diogenes Laertius names it."@en ;
    rdfs:domain lo:ChainLink ;
    rdfs:range lo:Work .

# ------------------------------------------------ Saying (apophthegm) model

lo:said a owl:DatatypeProperty ;
    rdfs:label "said"@en ;
    rdfs:comment "The Hicks English text of a saying the text attributes to the philosopher. Only sayings asserted in D.L.'s own voice appear as direct triples; hedged and disputed sayings exist only as lo:Saying reifications."@en ;
    rdfs:domain lo:ChapterSubject .

lo:greekText a owl:DatatypeProperty ;
    rdfs:label "Greek text"@en ;
    rdfs:comment "The Greek wording of a saying, claim, anecdote or doxa (when curated), the Greek text of a quoted verse, the Greek incipit or salutation of a quoted letter, the Greek incipit of a quoted will, or the full Greek text of a passage."@en ;
    rdfs:domain [ a owl:Class ; owl:unionOf ( lo:Claim lo:Saying lo:Verse lo:Epistle lo:Anecdote lo:Doxa lo:Testament lo:Passage ) ] .

lo:gloss a owl:DatatypeProperty ;
    rdfs:label "gloss"@en ;
    rdfs:comment "A one-line editorial summary of the saying, letter, anecdote, will or doxa (curator's words, not the text's)."@en ;
    rdfs:domain [ a owl:Class ; owl:unionOf ( lo:Saying lo:Epistle lo:Anecdote lo:Testament lo:Doxa ) ] .

lo:sayingTopic a owl:DatatypeProperty ;
    rdfs:label "saying topic"@en ;
    rdfs:comment "A controlled thematic facet for the saying (e.g. wit, wealth, death, virtue)."@en ;
    rdfs:domain lo:Saying .

lo:alsoAttributedTo a owl:ObjectProperty ;
    rdfs:label "also attributed to"@en ;
    rdfs:comment "A rival figure Diogenes Laertius reports the saying, anecdote or doxa is also fathered upon: a corpus philosopher when the name matches a Life, otherwise a person mentioned without a Life of his own (for doxai, names without a node of their own stay lo:rivalAttributionName literals - the doxography layer mints nothing)."@en ;
    rdfs:domain [ a owl:Class ; owl:unionOf ( lo:Saying lo:Anecdote lo:Doxa ) ] ;
    rdfs:range foaf:Person .

lo:addressedTo a owl:ObjectProperty ;
    rdfs:label "addressed to"@en ;
    rdfs:comment "The named interlocutor the saying is spoken - or the letter written - to, when the cited passage itself names them and the addressee is a philosopher with a Life of his own. Addressees without a node of their own are given as lo:addresseeName literals; anonymous askers are never guessed."@en ;
    rdfs:domain [ a owl:Class ; owl:unionOf ( lo:Saying lo:Epistle ) ] ;
    rdfs:range lo:ChapterSubject .

lo:addresseeName a owl:DatatypeProperty ;
    rdfs:label "addressee name"@en ;
    rdfs:comment "The name of the saying's or letter's addressee exactly as the cited passage gives it - a person ('Alexander') or a named collective ('the Athenians', 'the Wise Men') - used when the addressee has no node of his own in the graph."@en ;
    rdfs:domain [ a owl:Class ; owl:unionOf ( lo:Saying lo:Epistle ) ] .

# ------------------------------------------------ Epistle (quoted letter) model

lo:sentBy a owl:ObjectProperty ;
    rdfs:label "sent by"@en ;
    rdfs:comment "The letter's named sender, when the sender is a philosopher with a Life of his own. Senders without a node of their own (King Antigonus, King Darius, Pisistratus, Thrasybulus) are given as lo:senderName literals - no new person nodes are minted, so the gazetteer and pinned annotations stay stable. NOTE: for spurious letters this is the FICTIONAL sender; the authenticity verdict carries the philological judgment."@en ;
    rdfs:domain lo:Epistle ;
    rdfs:range lo:ChapterSubject .

lo:senderName a owl:DatatypeProperty ;
    rdfs:label "sender name"@en ;
    rdfs:comment "The name of the letter's sender exactly as the text gives it, used when the sender has no node of his own in the graph."@en ;
    rdfs:domain lo:Epistle .

lo:epistleTopic a owl:DatatypeProperty ;
    rdfs:label "epistle topic"@en ;
    rdfs:comment "Controlled thematic facet of the letter: invitation, politics, philosophy, writings, death, or family."@en ;
    rdfs:domain lo:Epistle .

lo:authenticity a owl:ObjectProperty ;
    rdfs:label "authenticity"@en ;
    rdfs:comment "The curator's verdict on the letter's authenticity, following modern scholarship."@en ;
    rdfs:domain lo:Epistle ;
    rdfs:range lo:AuthenticityLevel .

lo:hasRole a owl:ObjectProperty ;
    rdfs:label "has role"@en ;
    rdfs:comment "Curated occupational role(s) of a person named in the Lives, dominant role first in the curation order. Every corpus philosopher carries lo:PhilosopherRole; additional hats (Solon the statesman, Xenophon the historian) come from the text itself. Person and source nodes carry roles only where the text or a standard identification warrants one - absence of lo:hasRole is a curated statement of ignorance, not an oversight."@en ;
    rdfs:range lo:Role .

lo:dramaticDate a owl:DatatypeProperty ;
    rdfs:label "dramatic date"@en ;
    rdfs:comment "The letter's own dramatic date, recorded ONLY when the text supplies one (e.g. Epicurus' 'last day of my life', Zeno's 'I am now in my eightieth year'). For spurious letters this is the fiction's internal date, not a historical one."@en ;
    rdfs:domain lo:Epistle .

# ------------------------------------------- Anecdote (narrated incident) model

lo:about a owl:ObjectProperty ;
    rdfs:label "about"@en ;
    rdfs:comment "The philosopher the anecdote is told about - always a corpus philosopher with a Life of his own, since anecdotes are curated per Life."@en ;
    rdfs:domain lo:Anecdote ;
    rdfs:range lo:ChapterSubject .

lo:anecdoteTopic a owl:DatatypeProperty ;
    rdfs:label "anecdote topic"@en ;
    rdfs:comment "Controlled thematic facet of the incident: exile, conversion, asceticism, training, teaching, defiance, encounter, wit, eccentricity, shamelessness, capture, death, legacy, or piety."@en ;
    rdfs:domain lo:Anecdote .

lo:involves a owl:ObjectProperty ;
    rdfs:label "involves"@en ;
    rdfs:comment "The named counterpart in the incident (interlocutor, opponent, buyer, king), or a philosopher certainly identified in a quoted will, when the cited passage itself names them and the name matches a philosopher with a Life of his own. Participants without a node of their own are given as lo:participantName literals (anecdotes) or beneficiary/executor/witness name literals (testaments); anonymous figures are never guessed."@en ;
    rdfs:domain [ a owl:Class ; owl:unionOf ( lo:Anecdote lo:Testament ) ] ;
    rdfs:range lo:ChapterSubject .

lo:participantName a owl:DatatypeProperty ;
    rdfs:label "participant name"@en ;
    rdfs:comment "The name of the incident's counterpart exactly as the cited passage gives it - a person ('Alexander', 'Xeniades') or a named collective - used when the participant has no node of his own in the graph. The anecdote layer mints no new person nodes, so the gazetteer and pinned annotations stay stable."@en ;
    rdfs:domain lo:Anecdote .

lo:framesSaying a owl:ObjectProperty ;
    rdfs:label "frames saying"@en ;
    rdfs:comment "Links the anecdote to the curated saying whose narrative setting it gives: the incident supplies the scene, the saying the punch line. Incidents whose entire substance is the saying itself stay in the sayings layer and are not duplicated as anecdotes."@en ;
    rdfs:domain lo:Anecdote ;
    rdfs:range lo:Saying .

# --------------------------------------------- Doxa (doctrinal tenet) model

lo:heldBy a owl:ObjectProperty ;
    rdfs:label "held by"@en ;
    rdfs:comment "The philosopher the text reports holding this tenet - always a corpus philosopher with a Life of his own, since doxai are curated per Life. School doctrines D.L. expounds inside the founder's Life (the Cyrenaics under Aristippus) are curated under the founder, with a note recording the school framing."@en ;
    rdfs:domain lo:Doxa ;
    rdfs:range lo:ChapterSubject .

lo:doxaDomain a owl:DatatypeProperty ;
    rdfs:label "doxa domain"@en ;
    rdfs:comment "Controlled doctrinal domain of the tenet: first-principles, cosmology, physics, soul, gods, epistemology, logic, ethics, pleasure, politics, fate, or death."@en ;
    rdfs:domain lo:Doxa .

lo:expressesDoctrine a owl:ObjectProperty ;
    rdfs:label "expresses doctrine"@en ;
    rdfs:comment "Links the tenet to the doctrine node it instantiates, when the graph already knows that doctrine from the claims layer or the school doctrines - curated only where the match is beyond doubt. The doxography layer never mints doctrine nodes."@en ;
    rdfs:domain lo:Doxa ;
    rdfs:range lo:Doctrine .

lo:rivalAttributionName a owl:DatatypeProperty ;
    rdfs:label "rival attribution name"@en ;
    rdfs:comment "The rival figure Diogenes Laertius reports the tenet is also ascribed to, exactly as the passage names him, used when the name has no node of its own in the graph - the doxography layer mints no person nodes, so the gazetteer and pinned annotations stay stable."@en ;
    rdfs:domain lo:Doxa .

# ------------------------------------------------ Testament (quoted will) model

lo:testator a owl:ObjectProperty ;
    rdfs:label "testator"@en ;
    rdfs:comment "The philosopher whose will this is - always a corpus philosopher with a Life of his own, since D.L. quotes each will inside its testator's Life."@en ;
    rdfs:domain lo:Testament ;
    rdfs:range lo:ChapterSubject .

lo:beneficiaryName a owl:DatatypeProperty ;
    rdfs:label "beneficiary name"@en ;
    rdfs:comment "A principal legatee exactly as the will names them. Always a literal: the wills teem with dangerous bare homonyms (the slave Demetrius in Lyco's will vs. Demetrius of Phalerum; 'Epicurus son of Metrodorus' freed in Epicurus' own will), so beneficiaries are never guessed into node links."@en ;
    rdfs:domain lo:Testament .

lo:executorName a owl:DatatypeProperty ;
    rdfs:label "executor name"@en ;
    rdfs:comment "A named executor (epitropos/epimeletes) of the will, exactly as the text names them, as a literal. Absence means the will appoints none: Lyco charges friends with the funeral but names no executors; Epicurus' heirs hold the estate as trustees themselves."@en ;
    rdfs:domain lo:Testament .

lo:witnessName a owl:DatatypeProperty ;
    rdfs:label "witness name"@en ;
    rdfs:comment "A named witness to the will, exactly as the text names them, as a literal. Only Theophrastus' and Lyco's wills record witnesses."@en ;
    rdfs:domain lo:Testament .

lo:provision a owl:DatatypeProperty ;
    rdfs:label "provision"@en ;
    rdfs:comment "A curated key provision of the will (the curator's summary, not the text's words): bequests, manumissions, funeral instructions, the fate of the school and the library."@en ;
    rdfs:domain lo:Testament .

# ------------------------------------------------ Verse (quoted poetry) model

lo:quotedInLifeOf a owl:ObjectProperty ;
    rdfs:label "quoted in Life of"@en ;
    rdfs:comment "The philosopher in whose Life the verse is quoted (usually its subject). The poet, when the text names one, is given by lo:composedBy."@en ;
    rdfs:domain lo:Verse ;
    rdfs:range lo:ChapterSubject .

lo:inLifeOf a owl:ObjectProperty ;
    rdfs:label "in Life of"@en ;
    rdfs:comment "The philosopher whose Life contains this passage. Prologue passages carry no link (the Prologue has no philosopher node)."@en ;
    rdfs:domain lo:Passage ;
    rdfs:range lo:ChapterSubject .

lo:composedBy a owl:ObjectProperty ;
    rdfs:label "composed by"@en ;
    rdfs:comment "The poet the text credits with the verse: a corpus philosopher when the name matches a Life, otherwise a person without a Life of his own - including Diogenes Laertius himself for the epigrams he marks as his own (many from his Pammetros). Curated only where Diogenes Laertius or the Hicks text names the author; anonymous epitaphs, oracles and unnamed quotations carry no attribution."@en ;
    rdfs:domain lo:Verse ;
    rdfs:range foaf:Person .

lo:englishText a owl:DatatypeProperty ;
    rdfs:label "English text"@en ;
    rdfs:comment "The aligned Hicks English rendering of the verse or passage (when the alignment is available), the Hicks English excerpt of a quoted letter or will, or the verbatim Hicks English of an anecdote or doxa."@en ;
    rdfs:domain [ a owl:Class ; owl:unionOf ( lo:Verse lo:Epistle lo:Anecdote lo:Doxa lo:Testament lo:Passage ) ] .

lo:verseSource a owl:DatatypeProperty ;
    rdfs:label "verse source"@en ;
    rdfs:comment "The editorial source label attached to the verse in the Hicks edition (e.g. 'Anth. Pal. vii. 615.'), kept as text because it is the editor's cross-reference, not an authority named by Diogenes Laertius."@en ;
    rdfs:domain lo:Verse .

lo:continuesPrevious a owl:DatatypeProperty ;
    rdfs:label "continues previous"@en ;
    rdfs:comment "True when the quotation continues the immediately preceding verse block in the same section."@en ;
    rdfs:domain lo:Verse ;
    rdfs:range xsd:boolean .

# ------------------------------------------ Sources-index citation model

lo:citedAuthor a owl:ObjectProperty ;
    rdfs:label "cited author"@en ;
    rdfs:comment "The authority a source citation names: a corpus philosopher when the name matches a Life, otherwise a person or cited-source node. Anonymous and thematic index rows carry no author."@en ;
    rdfs:domain lo:SourceCitation ;
    rdfs:range [ a owl:Class ; owl:unionOf ( foaf:Person lo:Source ) ] .

lo:citedWorkTitle a owl:DatatypeProperty ;
    rdfs:label "cited work title"@en ;
    rdfs:comment "The title of the cited work as the sources index records it (Greek, English and/or French forms), kept as literals because most works Diogenes Laertius cites are lost and have no work node of their own."@en ;
    rdfs:domain lo:SourceCitation .

lo:identificationCertainty a owl:DatatypeProperty ;
    rdfs:label "identification certainty"@en ;
    rdfs:comment "The curator's confidence in identifying the cited authority: 'certain', 'probable' or 'uncertain'. Absent when the sources index left the row ungraded - absence is not a grade."@en ;
    rdfs:domain [ a owl:Class ; owl:unionOf ( lo:Source lo:SourceCitation ) ] .

# ------------------------------------------------ Manuscript transmission

lo:variantAt a owl:DatatypeProperty ;
    rdfs:label "variant at"@en ;
    rdfs:comment "The passage (book.section) where the manuscript tradition diverges."@en ;
    rdfs:domain lo:ManuscriptVariant .

lo:reading a owl:DatatypeProperty ;
    rdfs:label "reading"@en ;
    rdfs:comment "The text of one variant reading."@en ;
    rdfs:domain lo:ManuscriptVariant .

lo:attestedBy a owl:ObjectProperty ;
    rdfs:label "attested by"@en ;
    rdfs:domain lo:ManuscriptVariant ;
    rdfs:range lo:Witness .

# ------------------------------------------------ Datatype properties

lo:describedInBook a owl:DatatypeProperty ;
    rdfs:label "described in book"@en ;
    rdfs:comment "Book of Diogenes Laertius' Lives containing this chapter subject's Life."@en ;
    rdfs:domain lo:ChapterSubject .

lo:inBook a owl:DatatypeProperty ;
    rdfs:label "in book"@en ;
    rdfs:comment "Book of the Lives this chapter belongs to."@en ;
    rdfs:domain lo:Chapter ;
    rdfs:range xsd:integer .

lo:chapterNumber a owl:DatatypeProperty ;
    rdfs:label "chapter number"@en ;
    rdfs:comment "Position of this chapter within its book."@en ;
    rdfs:domain lo:Chapter ;
    rdfs:range xsd:integer .

lo:reportedBirthDate a owl:DatatypeProperty ;
    rdfs:label "reported birth date"@en ;
    rdfs:comment "A birth date as Diogenes Laertius reports it (usually by Olympiad), kept verbatim because reports conflict."@en ;
    rdfs:domain lo:ChapterSubject .

lo:reportedDeathDate a owl:DatatypeProperty ;
    rdfs:label "reported death date"@en ;
    rdfs:comment "A death date or age at death as Diogenes Laertius reports it, kept verbatim because reports conflict."@en ;
    rdfs:domain lo:ChapterSubject .

lo:mannerOfDeath a owl:DatatypeProperty ;
    rdfs:label "manner of death"@en ;
    rdfs:domain lo:ChapterSubject .

lo:parentage a owl:DatatypeProperty ;
    rdfs:label "parentage"@en ;
    rdfs:comment "Parentage or family descent as reported; kept verbatim because reports conflict."@en ;
    rdfs:domain lo:ChapterSubject .

lo:writingsReport a owl:DatatypeProperty ;
    rdfs:label "writings report"@en ;
    rdfs:comment "A verbatim report about a philosopher's literary output as a whole (e.g. 'left nothing in writing', 'about three hundred rolls'), kept as text because it names no specific work."@en ;
    rdfs:domain lo:ChapterSubject .

lo:successionReport a owl:DatatypeProperty ;
    rdfs:label "succession report"@en ;
    rdfs:comment "A verbatim report about a philosopher's succession as a whole (e.g. Menodotus' report that Timon left no successor, against the pupil list of Hippobotus and Sotion), kept as text because the individual teacher-pupil links live on lo:teacherOf via the succession-links layer."@en ;
    rdfs:domain lo:ChapterSubject .

lo:educationReport a owl:DatatypeProperty ;
    rdfs:label "education report"@en ;
    rdfs:comment "A verbatim report about a philosopher's education that names no specific teacher (e.g. 'self-taught')."@en ;
    rdfs:domain lo:ChapterSubject .

lo:oldAgeReport a owl:DatatypeProperty ;
    rdfs:label "old age report"@en ;
    rdfs:comment "A verbatim report about a philosopher's condition in old age (e.g. Theophrastus carried about in a litter, 5.41), kept as text; distinct from the death predicates because it reports how the philosopher lived, not how he died."@en ;
    rdfs:domain lo:ChapterSubject .

lo:demeReport a owl:DatatypeProperty ;
    rdfs:label "deme report"@en ;
    rdfs:comment "A report about the Attic deme a philosopher belonged to (e.g. Plato registered in Collytus, 3.3 per Antileon), kept as text: demes are civic subdivisions, not gazetteer places."@en ;
    rdfs:domain lo:ChapterSubject .

lo:alternateTitle a owl:DatatypeProperty ;
    rdfs:label "alternate title"@en ;
    rdfs:comment "A second title Diogenes Laertius records for a work (e.g. 'Gorgias, or On Rhetoric')."@en ;
    rdfs:domain lo:Work .

lo:greekTitle a owl:DatatypeProperty ;
    rdfs:label "Greek title"@en ;
    rdfs:comment "The original Greek title of a work, as attested in the corpus (e.g. Πολιτεία for the Republic). Curated only where the Greek title actually occurs in Diogenes Laertius' text."@en ;
    rdfs:domain lo:Work .

lo:transmissionStatus a owl:DatatypeProperty ;
    rdfs:label "transmission status"@en ;
    rdfs:comment "How the work has come down, as reflected in Diogenes Laertius' remarks: 'spurious' (acknowledged not genuine), 'disputed-authorship' (authorship contested), 'extant' (D.L. states it survives), or 'lost' (D.L. reports the work itself was destroyed, e.g. Empedocles' burnt poems at 8.57)."@en ;
    rdfs:domain lo:Work .

lo:hasForm a owl:ObjectProperty ;
    rdfs:label "has form"@en ;
    rdfs:comment "The curated literary form of the work (prose, verse, or mixed), judged from the title, Diogenes Laertius' remarks, and standard scholarship. Absence is a curated statement of ignorance."@en ;
    rdfs:domain lo:Work ;
    rdfs:range lo:WorkForm .

lo:hasWorkTopic a owl:ObjectProperty ;
    rdfs:label "has work topic"@en ;
    rdfs:comment "The curated dominant topic of the work, one per work from a closed union of twenty-four. Absence means the title is too opaque to classify."@en ;
    rdfs:domain lo:Work ;
    rdfs:range lo:WorkTopic .

lo:philosophical a owl:DatatypeProperty ;
    rdfs:label "philosophical"@en ;
    rdfs:comment "Whether the work is a work OF philosophy. Derived from the topic (physics, ethics, dialectic, … are philosophical; tragedy, history, epigram, … are not) with rare per-work curated overrides (Aristotle's Poetics is philosophical poetics; Empedocles' physical poem is philosophical verse). Absent when the topic itself is uncurated and no override exists."@en ;
    rdfs:domain lo:Work ;
    rdfs:range xsd:boolean .

lo:survival a owl:ObjectProperty ;
    rdfs:label "survival"@en ;
    rdfs:comment "The modern survival verdict on the work: lost, excerpts, or extant. The overwhelming default for works named by Diogenes Laertius is lost; excerpts requires verbatim quotation attributed to THIS work; extant records independent transmission of the text regardless of modern authenticity debates (extant = transmitted, not authentic). Conflated title nodes whose homonymous works diverge in transmission carry NO lo:survival - one node cannot honestly bear two verdicts."@en ;
    rdfs:domain lo:Work ;
    rdfs:range lo:SurvivalStatus .

lo:compositionCentury a owl:DatatypeProperty ;
    rdfs:label "composition century"@en ;
    rdfs:comment "The century in which the work was composed, as a signed integer: -4 is the fourth century BCE, 3 the third century CE. Derived from the attributing authors' production centuries when EVERY author attributed to the title (at any certainty) resolves to the same single century; per-work curated overrides handle the exceptions. Conflated homonym nodes with disagreeing or unresolvable authors carry no century."@en ;
    rdfs:domain lo:Work ;
    rdfs:range xsd:integer .

lo:compositionDecade a owl:DatatypeProperty ;
    rdfs:label "composition decade"@en ;
    rdfs:comment "The decade of composition as a signed starting year (-590 = the 590s BCE), curated only for the handful of works datable this finely (Solon's legislation). Always accompanied by the matching lo:compositionCentury."@en ;
    rdfs:domain lo:Work ;
    rdfs:range xsd:integer .

lo:foundedSchool a owl:ObjectProperty ;
    rdfs:label "founded school"@en ;
    rdfs:comment "The school or line the philosopher is credited with founding, as a link to the school entity."@en ;
    rdfs:domain lo:ChapterSubject ;
    rdfs:range lo:School .

lo:principalDoctrine a owl:ObjectProperty ;
    rdfs:label "principal doctrine"@en ;
    rdfs:comment "The end (telos) or central tenet a school professes, as summarized by Diogenes Laertius."@en ;
    rdfs:domain lo:School ;
    rdfs:range lo:Doctrine .

lo:earliestYear a owl:DatatypeProperty ;
    rdfs:label "earliest year"@en ;
    rdfs:comment "Earliest year derivable from the philosopher's dated claims, as an integer (negative = BCE), for chronological comparison."@en ;
    rdfs:domain lo:ChapterSubject ;
    rdfs:range xsd:integer .

lo:latestYear a owl:DatatypeProperty ;
    rdfs:label "latest year"@en ;
    rdfs:comment "Latest year derivable from the philosopher's dated claims, as an integer (negative = BCE), for chronological comparison."@en ;
    rdfs:domain lo:ChapterSubject ;
    rdfs:range xsd:integer .

lo:datePrecision a owl:DatatypeProperty ;
    rdfs:label "date precision"@en ;
    rdfs:comment "'approximate' when the dating is hedged (Olympiad / 'flourished about'), 'attested' when a specific year is given."@en ;
    rdfs:domain lo:ChapterSubject .

lo:greekLemma a owl:DatatypeProperty ;
    rdfs:label "Greek lemma"@en ;
    rdfs:domain lo:GreekTerm .

lo:founderOfLabel a owl:DatatypeProperty ;
    rdfs:label "founder of"@en ;
    rdfs:comment "The school or line the philosopher is credited with founding."@en ;
    rdfs:domain lo:ChapterSubject .

${alignmentsAsTurtle(`${LOD_BASE}/ontology`)}
`;
}

// --------------------------------------------------- VoID dataset description

const OWL_SAMEAS = "http://www.w3.org/2002/07/owl#sameAs";

/**
 * External linkset targets, in output order. Each owl:sameAs triple whose
 * object starts with `ns` counts toward that target's void:Linkset. The
 * homepage is the void:Dataset URI used for void:objectsTarget (the
 * conventional dataset-level identifier for each hub).
 */
export const VOID_LINK_TARGETS = [
  {
    id: "wikidata",
    label: "Wikidata",
    ns: "http://www.wikidata.org/entity/",
    dataset: "http://www.wikidata.org/entity/",
  },
  {
    id: "dbpedia",
    label: "DBpedia",
    ns: "http://dbpedia.org/resource/",
    dataset: "http://dbpedia.org/",
  },
  {
    id: "viaf",
    label: "VIAF",
    ns: "http://viaf.org/viaf/",
    dataset: "http://viaf.org/",
  },
  {
    id: "inpho",
    label: "InPhO (Indiana Philosophy Ontology)",
    ns: "https://www.inphoproject.org/",
    dataset: "https://www.inphoproject.org/",
  },
  {
    id: "pleiades",
    label: "Pleiades",
    ns: "https://pleiades.stoa.org/places/",
    dataset: "https://pleiades.stoa.org/",
  },
] as const;

/** Vocabularies the plain graph and ontology draw on (void:vocabulary). */
export const VOID_VOCABULARIES = (): string[] => [
  ONT,
  OTV,
  "http://www.w3.org/1999/02/22-rdf-syntax-ns#",
  "http://www.w3.org/2000/01/rdf-schema#",
  "http://www.w3.org/2002/07/owl#",
  "http://xmlns.com/foaf/0.1/",
  "http://purl.org/dc/terms/",
  "http://www.w3.org/2004/02/skos/core#",
  ...Object.values(ALIGNMENT_PREFIXES).filter(
    (ns) => ns !== "http://www.w3.org/2004/02/skos/core#",
  ),
];

export interface VoidStats {
  /** Deduped triple count of the plain graph. */
  triples: number;
  /** Deduped triple count of the annotated graph. */
  annotatedTriples: number;
  /** owl:sameAs links per external target id (VOID_LINK_TARGETS order). */
  linksets: Record<string, number>;
  /** skos:exactMatch/closeMatch ontology mappings to Wikidata. */
  skosMappings: number;
}

/** Deduped triple count with the same signature as the validators use. */
function voidDedupedCount(quads: Quad[]): number {
  const seen = new Set<string>();
  for (const q of quads) {
    const o = q.object;
    seen.add(
      `${q.subject.termType === "BlankNode" ? "_:" : ""}${q.subject.value}` +
        `\u0001${q.predicate.value}\u0001${o.termType}\u0001${o.value}` +
        `\u0001${o.termType === "Literal" ? o.language : ""}` +
        `\u0001${o.termType === "Literal" ? o.datatype.value : ""}`,
    );
  }
  return seen.size;
}

let voidStatsCache: VoidStats | null = null;

/**
 * Counts for the VoID description, computed from the same serializations
 * the endpoints publish (so the description can never drift from the data).
 */
export function voidStats(): VoidStats {
  if (voidStatsCache) return voidStatsCache;
  const quads = new N3Parser().parse(graphAsTurtle());
  const linksets: Record<string, number> = {};
  for (const t of VOID_LINK_TARGETS) linksets[t.id] = 0;
  const seen = new Set<string>();
  for (const q of quads) {
    if (q.predicate.value !== OWL_SAMEAS) continue;
    const sig = `${q.subject.value}\u0001${q.object.value}`;
    if (seen.has(sig)) continue;
    seen.add(sig);
    for (const t of VOID_LINK_TARGETS) {
      if (q.object.value.startsWith(t.ns)) {
        linksets[t.id] = (linksets[t.id] ?? 0) + 1;
        break;
      }
    }
  }
  voidStatsCache = {
    triples: voidDedupedCount(quads),
    annotatedTriples: voidDedupedCount(annotatedGraphQuads()),
    linksets,
    skosMappings: CONCEPT_MAPPINGS.length,
  };
  return voidStatsCache;
}

/** Site origin the API endpoints live under (LOD_BASE minus its path). */
let voidTtlCache: string | null = null;

/**
 * The VoID description of the dataset as Turtle: the plain graph as the
 * main void:Dataset (with the annotated graph as a superset dataset of
 * which it is a void:subset), data dumps in all three serializations, the
 * SPARQL endpoint, the vocabularies used, one void:Linkset per external
 * owl:sameAs hub, and the ontology's SKOS concept-mapping linkset to
 * Wikidata. All counts come from voidStats(), i.e. from the published
 * serializations themselves.
 */
export function voidAsTurtle(): string {
  if (voidTtlCache) return voidTtlCache;
  const s = voidStats();
  // All web-facing links are minted under LOD_BASE (which includes the
  // /laertius subpath on the live deployment) — NOT the bare origin, where
  // /api/lod/... would 404 behind the production reverse proxy.
  const api = `${LOD_BASE}/api/lod`;
  const D = `${LOD_BASE}/void`;
  const lines: string[] = [
    "@prefix void: <http://rdfs.org/ns/void#> .",
    "@prefix dcterms: <http://purl.org/dc/terms/> .",
    "@prefix foaf: <http://xmlns.com/foaf/0.1/> .",
    "@prefix owl: <http://www.w3.org/2002/07/owl#> .",
    "@prefix skos: <http://www.w3.org/2004/02/skos/core#> .",
    "@prefix formats: <http://www.w3.org/ns/formats/> .",
    "@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .",
    "",
    `<${D}> a void:DatasetDescription ;`,
    `    dcterms:title "VoID description of the Laertius linked open dataset"@en ;`,
    `    foaf:primaryTopic <${D}#dataset> .`,
    "",
    `<${D}#dataset> a void:Dataset ;`,
    `    dcterms:title "Laertius - Diogenes Laertius, Lives of Eminent Philosophers, as Linked Open Data"@en ;`,
    `    dcterms:description "The knowledge layer of Diogenes Laertius' Lives of Eminent Philosophers: philosophers, schools, successions, places, works, doctrines, cited biographical claims, verses, sayings, anecdotes, letters, testaments and doxai, every fact cited to a passage of the text and hedged statements modelled as attributed claims. Curated bridges align the ontology with CIDOC CRM, LAWD, FaBiO, schema.org and WGS84 Geo, and its closed vocabularies map to Wikidata via SKOS."@en ;`,
    `    dcterms:license <https://creativecommons.org/licenses/by-nc-sa/4.0/> ;`,
    `    dcterms:source "urn:cts:greekLit:tlg0004.tlg001" ;`,
    `    foaf:homepage <${LOD_BASE}/> ;`,
    `    void:uriSpace "${LOD_BASE}/" ;`,
    `    void:rootResource <${LOD_BASE}/ontology> ;`,
    // Harvesters that only read VoID learn the published SHACL shapes
    // exist (served at /api/lod/shapes.ttl; validate-shapes keeps the
    // graph passing them).
    `    dcterms:conformsTo <${api}/shapes.ttl> ;`,
    `    void:sparqlEndpoint <${api}/sparql> ;`,
    `    void:feature formats:Turtle, formats:JSON-LD, formats:RDF_XML ;`,
    `    void:dataDump <${api}/graph.ttl>, <${api}/graph.jsonld>, <${api}/graph.rdf> ;`,
    `    void:triples ${s.triples} ;`,
    VOID_VOCABULARIES()
      .map((v) => `    void:vocabulary <${v}> ;`)
      .join("\n"),
    `    void:subset ${VOID_LINK_TARGETS.map((t) => `<${D}#${t.id}-links>`).join(", ")}, <${D}#wikidata-concept-mappings> .`,
    "",
    `<${D}#annotated> a void:Dataset ;`,
    `    dcterms:title "Laertius annotated graph: the full dataset plus the bilingual passages and all stand-off name and term annotations (Web Annotation)"@en ;`,
    // The annotated dump also passes the published shapes (validate-shapes
    // runs pySHACL over annotatedGraphAsTurtle()), so advertise them here
    // too: harvesters learn BOTH dumps are validatable.
    `    dcterms:conformsTo <${api}/shapes.ttl> ;`,
    `    void:dataDump <${api}/graph-annotated.ttl>, <${api}/graph-annotated.jsonld>, <${api}/graph-annotated.rdf> ;`,
    `    void:vocabulary <http://www.w3.org/ns/oa#> ;`,
    `    void:triples ${s.annotatedTriples} ;`,
    `    void:subset <${D}#dataset> .`,
    "",
  ];
  for (const t of VOID_LINK_TARGETS) {
    lines.push(
      `<${D}#${t.id}-links> a void:Linkset ;`,
      `    dcterms:title "owl:sameAs links to ${t.label}"@en ;`,
      `    void:subjectsTarget <${D}#dataset> ;`,
      `    void:objectsTarget <${t.dataset}> ;`,
      `    void:linkPredicate owl:sameAs ;`,
      `    void:triples ${s.linksets[t.id]} .`,
      "",
    );
  }
  lines.push(
    `<${D}#wikidata-concept-mappings> a void:Linkset ;`,
    `    dcterms:title "SKOS concept mappings from the ontology's closed vocabularies and place-type classes to Wikidata"@en ;`,
    `    void:subjectsTarget <${D}#dataset> ;`,
    `    void:objectsTarget <http://www.wikidata.org/entity/> ;`,
    `    void:linkPredicate skos:exactMatch, skos:closeMatch ;`,
    `    void:triples ${s.skosMappings} .`,
    "",
  );
  voidTtlCache = lines.join("\n");
  return voidTtlCache;
}

let dcatTtlCache: string | null = null;

/**
 * DCAT 3 description of the downloadable datasets: the plain and annotated
 * knowledge graphs (each with one dcat:Distribution per serialization —
 * Turtle, JSON-LD, RDF/XML), the ontology, and the full project source
 * archive as a zip distribution. Complements the VoID description
 * (void.ttl carries the RDF-specific statistics; dcat.ttl is what data
 * portals and scholarly aggregators harvest).
 */
export function dcatAsTurtle(): string {
  if (dcatTtlCache) return dcatTtlCache;
  const s = voidStats();
  const api = `${LOD_BASE}/api/lod`;
  const C = `${LOD_BASE}/dcat`;
  const LICENSE = "https://creativecommons.org/licenses/by-nc-sa/4.0/";
  const CREATOR_LINES = [
    `    dcterms:creator [ a foaf:Person ; foaf:name "Maria Papadopoulou" ] ;`,
    `    dcterms:publisher [ a foaf:Organization ; foaf:name "Humanistica Digitalia" ; foaf:homepage <https://humanisticadigitalia.eu> ] ;`,
  ];
  const dist = (
    id: string,
    title: string,
    url: string,
    mediaType: string,
    format: string,
  ) => [
    `<${C}#${id}> a dcat:Distribution ;`,
    `    dcterms:title "${title}"@en ;`,
    `    dcat:downloadURL <${url}> ;`,
    `    dcat:accessURL <${url}> ;`,
    `    dcat:mediaType <https://www.iana.org/assignments/media-types/${mediaType}> ;`,
    `    dcterms:format <http://www.w3.org/ns/formats/${format}> ;`,
    `    dcterms:license <${LICENSE}> .`,
    "",
  ];
  const lines: string[] = [
    "@prefix dcat: <http://www.w3.org/ns/dcat#> .",
    "@prefix dcterms: <http://purl.org/dc/terms/> .",
    "@prefix foaf: <http://xmlns.com/foaf/0.1/> .",
    "@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .",
    "",
    `<${C}> a dcat:Catalog ;`,
    `    dcterms:title "Laertius data catalog"@en ;`,
    `    dcterms:description "Downloadable datasets of Laertius, the digital scholarly edition of Diogenes Laertius' Lives of Eminent Philosophers: the knowledge graph and its annotated superset in Turtle, JSON-LD and RDF/XML, the ontology, and the full project source archive."@en ;`,
    ...CREATOR_LINES,
    `    dcterms:license <${LICENSE}> ;`,
    `    foaf:homepage <${LOD_BASE}/> ;`,
    `    dcat:dataset <${C}#graph>, <${C}#graph-annotated>, <${C}#ontology>, <${C}#shapes>, <${C}#source> .`,
    "",
    `<${C}#graph> a dcat:Dataset ;`,
    `    dcterms:title "Laertius knowledge graph"@en ;`,
    `    dcterms:description "The knowledge layer of the Lives: philosophers, schools, successions, places, works, doctrines, cited biographical claims, verses, sayings, anecdotes, letters, testaments and doxai, every fact cited to a passage of the text (${s.triples} triples)."@en ;`,
    ...CREATOR_LINES,
    `    dcterms:license <${LICENSE}> ;`,
    `    dcterms:source "urn:cts:greekLit:tlg0004.tlg001" ;`,
    // The graph conforms to the published SHACL shapes, so portal
    // harvesters can discover them and validate the dumps themselves.
    `    dcterms:conformsTo <${api}/shapes.ttl> ;`,
    `    dcat:landingPage <${LOD_BASE}/graph> ;`,
    `    dcat:distribution <${C}#graph-ttl>, <${C}#graph-jsonld>, <${C}#graph-rdfxml> .`,
    "",
    ...dist("graph-ttl", "Knowledge graph (Turtle)", `${api}/graph.ttl`, "text/turtle", "Turtle"),
    ...dist("graph-jsonld", "Knowledge graph (JSON-LD)", `${api}/graph.jsonld`, "application/ld+json", "JSON-LD"),
    ...dist("graph-rdfxml", "Knowledge graph (RDF/XML)", `${api}/graph.rdf`, "application/rdf+xml", "RDF_XML"),
    `<${C}#graph-annotated> a dcat:Dataset ;`,
    `    dcterms:title "Laertius annotated graph"@en ;`,
    `    dcterms:description "The full knowledge graph plus the bilingual passages and all stand-off name and term annotations (Web Annotation; ${s.annotatedTriples} triples)."@en ;`,
    ...CREATOR_LINES,
    `    dcterms:license <${LICENSE}> ;`,
    // The annotated dump conforms too (validate-shapes proves it with
    // pySHACL), so portal harvesters can validate this dump as well.
    `    dcterms:conformsTo <${api}/shapes.ttl> ;`,
    `    dcat:landingPage <${LOD_BASE}/graph> ;`,
    `    dcat:distribution <${C}#graph-annotated-ttl>, <${C}#graph-annotated-jsonld>, <${C}#graph-annotated-rdfxml> .`,
    "",
    ...dist("graph-annotated-ttl", "Annotated graph (Turtle)", `${api}/graph-annotated.ttl`, "text/turtle", "Turtle"),
    ...dist("graph-annotated-jsonld", "Annotated graph (JSON-LD)", `${api}/graph-annotated.jsonld`, "application/ld+json", "JSON-LD"),
    ...dist("graph-annotated-rdfxml", "Annotated graph (RDF/XML)", `${api}/graph-annotated.rdf`, "application/rdf+xml", "RDF_XML"),
    `<${C}#ontology> a dcat:Dataset ;`,
    `    dcterms:title "Laertius ontology"@en ;`,
    `    dcterms:description "The ontology of the Laertius knowledge graph, with curated alignments to CIDOC CRM, LAWD, FaBiO, schema.org and WGS84 Geo, and SKOS mappings of its closed vocabularies to Wikidata."@en ;`,
    ...CREATOR_LINES,
    `    dcterms:license <${LICENSE}> ;`,
    `    dcat:landingPage <${LOD_BASE}/graph> ;`,
    `    dcat:distribution <${C}#ontology-ttl>, <${C}#ontology-jsonld>, <${C}#ontology-rdfxml> .`,
    "",
    ...dist("ontology-ttl", "Ontology (Turtle)", `${api}/ontology.ttl`, "text/turtle", "Turtle"),
    ...dist("ontology-jsonld", "Ontology (JSON-LD)", `${api}/ontology.jsonld`, "application/ld+json", "JSON-LD"),
    ...dist("ontology-rdfxml", "Ontology (RDF/XML)", `${api}/ontology.rdf`, "application/rdf+xml", "RDF_XML"),
    `<${C}#shapes> a dcat:Dataset ;`,
    `    dcterms:title "Laertius SHACL shapes"@en ;`,
    `    dcterms:description "The SHACL shapes the published knowledge graph conforms to, so consumers can validate the dumps themselves (e.g. pyshacl -s shapes.ttl graph.ttl)."@en ;`,
    ...CREATOR_LINES,
    `    dcterms:license <${LICENSE}> ;`,
    `    dcat:landingPage <${LOD_BASE}/graph> ;`,
    `    dcat:distribution <${C}#shapes-ttl> .`,
    "",
    ...dist("shapes-ttl", "SHACL shapes (Turtle)", `${api}/shapes.ttl`, "text/turtle", "Turtle"),
    `<${C}#source> a dcat:Dataset ;`,
    `    dcterms:title "Laertius full project source"@en ;`,
    `    dcterms:description "The complete source code of the edition (web app, API server and data pipelines) as a single zip archive - git-tracked source only."@en ;`,
    ...CREATOR_LINES,
    `    dcterms:license <${LICENSE}> ;`,
    `    dcat:landingPage <${LOD_BASE}/stats> ;`,
    `    dcat:distribution <${C}#source-zip> .`,
    "",
    `<${C}#source-zip> a dcat:Distribution ;`,
    `    dcterms:title "Full project source (zip)"@en ;`,
    `    dcat:downloadURL <${LOD_BASE}/api/exports/laertius-full-source.zip> ;`,
    `    dcat:accessURL <${LOD_BASE}/api/exports/laertius-full-source.zip> ;`,
    `    dcat:mediaType <https://www.iana.org/assignments/media-types/application/zip> ;`,
    `    dcterms:license <${LICENSE}> .`,
    "",
  ];
  dcatTtlCache = lines.join("\n");
  return dcatTtlCache;
}
