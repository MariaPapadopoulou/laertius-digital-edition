/**
 * Cited, certainty-tagged claims about the philosophers, curated from the
 * text of Diogenes Laertius itself (source-internal: no modern reference
 * data). Each claim carries a D.L. citation (book.section, Hicks numbering,
 * as in kg.ts), a certainty level reflecting D.L.'s own epistemic stance,
 * the source D.L. names when he names one, and links between conflicting
 * alternative reports. This is the data layer behind the uncertainty
 * modeling of the ontology (competency questions CQ13-CQ20).
 */
import { getKnowledgeGraph } from "./kg";
import { SOURCE_WORKS } from "./source-works";
import { BOOK1_CLAIMS } from "./claims/book1";
import { BOOK2_CLAIMS } from "./claims/book2";
import { BOOK3_CLAIMS } from "./claims/book3";
import { BOOK4_CLAIMS } from "./claims/book4";
import { BOOK5_CLAIMS } from "./claims/book5";
import { BOOK6_CLAIMS } from "./claims/book6";
import { BOOK7_CLAIMS } from "./claims/book7";
import { BOOK8_CLAIMS } from "./claims/book8";
import { BOOK9_CLAIMS } from "./claims/book9";
import { BOOK10_CLAIMS } from "./claims/book10";

/**
 * How D.L. presents the claim:
 * - asserted: stated in D.L.'s own voice without hedging.
 * - reported: hedged ("some say", "according to X", "it is said").
 * - disputed: D.L. records explicit disagreement about it.
 * - conjectured: an inference, not directly stated.
 */
export type Certainty = "asserted" | "reported" | "disputed" | "conjectured";

export type ClaimProperty =
  | "birthPlace"
  | "deathPlace"
  | "livedIn"
  | "traveledTo"
  | "birthDate"
  | "deathDate"
  | "mannerOfDeath"
  | "parentage"
  | "wrote"
  | "writings"
  | "studiedUnder"
  | "education"
  | "affiliatedWith"
  | "praised"
  | "criticized"
  | "heldDoctrine"
  | "succession"
  | "oldAge"
  | "deme";

export type ClaimValueType =
  | "place"
  | "work"
  | "philosopher"
  | "person"
  | "school"
  | "doctrine"
  | "literal";

/**
 * One link in an assertion transmission chain: the authority who
 * transmitted the claim, and optionally the specific work they used.
 * Listed nearest-intermediary first, so the chain reads in citation
 * order: accordingTo (nearest source) -> chain[0] -> chain[1] ...
 */
export interface ChainLink {
  /**
   * Canonical source label. Must be a known source: either some claim's
   * accordingTo or a SOURCE_WORKS author (getClaims throws otherwise, so a
   * typo cannot mint a phantom authority). Chain authorities are added to
   * the claim entities' source set, so their lo:Source nodes always exist.
   */
  authority: string;
  /** Title of the work, when D.L. names it. Must resolve in SOURCE_WORKS. */
  work?: string;
}

export interface KgClaim {
  /** Stable id, used for conflictsWith links and the claim URI. */
  id: string;
  /** Philosopher name exactly as in the corpus. */
  subject: string;
  property: ClaimProperty;
  /**
   * Entity name (place/work/philosopher/person/doctrine) or literal text.
   * Philosopher values must match corpus names; person is for people D.L.
   * mentions who have no Life of their own (e.g. Damon, Nausiphanes).
   */
  value: string;
  valueType: ClaimValueType;
  /** D.L. citation (book.section, Hicks numbering). Required: source-internal. */
  ref: string;
  certainty: Certainty;
  /** The source D.L. names for the claim, when he names one. */
  accordingTo?: string;
  /**
   * Title of the specific work the accordingTo source made the claim in,
   * when D.L. names it (e.g. "Chronology", "Successions"). Must be a title
   * in SOURCE_WORKS authored by accordingTo; requires accordingTo to be set.
   */
  sourceWork?: string;
  /**
   * Ordered transmission chain when D.L. records one, nearest intermediary
   * first. Example: accordingTo "Sosicrates" with chain [{authority: "Hermippus"}]
   * represents "Sosicrates quotes Hermippus as his authority".
   */
  chain?: ReadonlyArray<ChainLink>;
  /** Ids of alternative claims D.L. records for the same question. */
  conflictsWith?: string[];
  /** Polytonic Greek term attached to a doctrine value (CQ12/CQ16). */
  greek?: string;
  /**
   * Verbatim Greek excerpt from the cited section's text (validate-claims
   * checks it is a substring of the section's Greek, normalized).
   */
  grc?: string;
  note?: string;
}

/**
 * All curated claims, assembled from the per-book files in ./claims.
 * Claim ids are prefixed per philosopher (e.g. "thales-", "zeno-") so
 * ids stay unique across books.
 */
export const KG_CLAIMS: KgClaim[] = [
  ...BOOK1_CLAIMS,
  ...BOOK2_CLAIMS,
  ...BOOK3_CLAIMS,
  ...BOOK4_CLAIMS,
  ...BOOK5_CLAIMS,
  ...BOOK6_CLAIMS,
  ...BOOK7_CLAIMS,
  ...BOOK8_CLAIMS,
  ...BOOK9_CLAIMS,
  ...BOOK10_CLAIMS,
];

export interface DoctrineEntity {
  label: string;
  /** Polytonic Greek key term, when one anchors the doctrine. */
  greek?: string;
}

export interface ClaimEntities {
  places: string[];
  works: string[];
  persons: string[];
  /** School labels used as claim values (distinct from graph movements). */
  schools: string[];
  sources: string[];
  doctrines: DoctrineEntity[];
  /** Unique polytonic Greek terms across doctrines (CQ12/CQ16). */
  terms: string[];
}

/** Slug that keeps Greek (and any Unicode) letters. */
export function unicodeSlug(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Value types each claim property permits, so object-valued predicates can
 * never carry literals (and vice versa) in the RDF output.
 */
const ALLOWED_VALUE_TYPES: Record<ClaimProperty, readonly ClaimValueType[]> = {
  birthPlace: ["place"],
  deathPlace: ["place"],
  livedIn: ["place"],
  traveledTo: ["place"],
  birthDate: ["literal"],
  deathDate: ["literal"],
  mannerOfDeath: ["literal"],
  parentage: ["literal"],
  wrote: ["work"],
  writings: ["literal"],
  studiedUnder: ["philosopher", "person"],
  education: ["literal"],
  affiliatedWith: ["school"],
  praised: ["philosopher", "person"],
  criticized: ["philosopher", "person"],
  heldDoctrine: ["doctrine"],
  // What D.L. reports about a philosopher's succession - who carried
  // the school on. Literal-only (like writings vs wrote): the named
  // pupils get real teacher links in succession-links.ts; the claim
  // records the REPORT and its dispute (see timon-no-successor).
  succession: ["literal"],
  // A verbatim report about a philosopher's condition in old age (e.g.
  // Theophrastus carried about in a litter, 5.41).
  oldAge: ["literal"],
  // The Attic deme a philosopher belonged to (e.g. Plato of Collytus,
  // 3.3 per Antileon). Literal-only: demes are civic subdivisions, not
  // gazetteer places, and the claim records the registration report.
  deme: ["literal"],
};

let validated: KgClaim[] | null = null;

/**
 * Claims, validated at first use: subjects and philosopher-valued claims
 * must name philosophers present in the corpus, and conflictsWith links
 * must resolve. Throws on curation errors so they cannot ship silently.
 */
export function getClaims(): KgClaim[] {
  if (validated) return validated;
  const names = new Set(getKnowledgeGraph().nodes.map((n) => n.name));
  const ids = new Set(KG_CLAIMS.map((c) => c.id));
  if (ids.size !== KG_CLAIMS.length) {
    throw new Error("kg-claims: duplicate claim ids");
  }
  for (const c of KG_CLAIMS) {
    if (!names.has(c.subject)) {
      throw new Error(`kg-claims: unknown subject "${c.subject}" (${c.id})`);
    }
    if (!ALLOWED_VALUE_TYPES[c.property].includes(c.valueType)) {
      throw new Error(
        `kg-claims: property "${c.property}" does not permit valueType "${c.valueType}" (${c.id})`,
      );
    }
    if (c.valueType === "philosopher" && !names.has(c.value)) {
      throw new Error(
        `kg-claims: unknown philosopher value "${c.value}" (${c.id})`,
      );
    }
    for (const other of c.conflictsWith ?? []) {
      if (!ids.has(other)) {
        throw new Error(
          `kg-claims: dangling conflictsWith "${other}" (${c.id})`,
        );
      }
    }
    if (c.sourceWork !== undefined) {
      if (!c.accordingTo) {
        throw new Error(
          `kg-claims: sourceWork "${c.sourceWork}" requires accordingTo (${c.id})`,
        );
      }
      const works = SOURCE_WORKS.filter((sw) => sw.source === c.accordingTo);
      if (!works.some((sw) => sw.title === c.sourceWork)) {
        throw new Error(
          `kg-claims: sourceWork "${c.sourceWork}" not found for source "${c.accordingTo}" (${c.id})`,
        );
      }
    }
    if (c.chain !== undefined) {
      if (!c.accordingTo) {
        throw new Error(
          `kg-claims: chain requires accordingTo (${c.id})`,
        );
      }
      // A chain authority must be a source the layer already knows: either
      // some claim's accordingTo, a SOURCE_WORKS author, or a corpus
      // philosopher (the last hop of a chain can be a philosopher's own
      // remark, e.g. Arcesilaus of Pitane at 5.41; the LOD layer mints a
      // separate lo:Source node for him following the source/philosopher
      // double-node convention). This guards against typos while allowing
      // chains through transmitters (Satyrus, Sotion) whose works are not
      // curated in SOURCE_WORKS.
      const knownSources = new Set(SOURCE_WORKS.map((sw) => sw.source));
      for (const other of KG_CLAIMS) {
        if (other.accordingTo) knownSources.add(other.accordingTo);
      }
      for (const n of names) knownSources.add(n);
      for (const link of c.chain) {
        if (!knownSources.has(link.authority)) {
          throw new Error(
            `kg-claims: chain authority "${link.authority}" is not a known source (${c.id})`,
          );
        }
        if (link.work !== undefined) {
          const works = SOURCE_WORKS.filter((sw) => sw.source === link.authority);
          if (!works.some((sw) => sw.title === link.work)) {
            throw new Error(
              `kg-claims: chain work "${link.work}" not found for authority "${link.authority}" (${c.id})`,
            );
          }
        }
      }
    }
  }
  validated = KG_CLAIMS;
  return validated;
}

let entities: ClaimEntities | null = null;

/** Entities derived from the claims, so dangling references are impossible. */
export function getClaimEntities(): ClaimEntities {
  if (entities) return entities;
  const places = new Set<string>();
  const works = new Set<string>();
  const persons = new Set<string>();
  const schools = new Set<string>();
  const sources = new Set<string>();
  const doctrines = new Map<string, DoctrineEntity>();
  const terms = new Set<string>();
  for (const c of getClaims()) {
    if (c.valueType === "place") places.add(c.value);
    if (c.valueType === "work") works.add(c.value);
    if (c.valueType === "person") persons.add(c.value);
    if (c.valueType === "school") schools.add(c.value);
    if (c.valueType === "doctrine") {
      const d: DoctrineEntity = { label: c.value };
      if (c.greek) {
        d.greek = c.greek;
        terms.add(c.greek);
      }
      doctrines.set(c.value, d);
    }
    if (c.accordingTo) sources.add(c.accordingTo);
    // Chain authorities become source nodes too, so lo:chainAuthority can
    // never dangle even when the authority is not any claim's accordingTo.
    for (const link of c.chain ?? []) sources.add(link.authority);
  }
  entities = {
    places: [...places].sort(),
    works: [...works].sort(),
    persons: [...persons].sort(),
    schools: [...schools].sort(),
    sources: [...sources].sort(),
    doctrines: [...doctrines.values()],
    terms: [...terms].sort(),
  };
  return entities;
}
