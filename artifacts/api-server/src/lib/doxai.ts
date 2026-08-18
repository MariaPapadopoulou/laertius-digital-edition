/**
 * Curated, cited doxography of the philosophers - the doctrines and opinions
 * D.L. himself reports (his "opinions of eminent philosophers"), as opposed
 * to the biographical facts of the claims layer and the bare dicta of the
 * sayings layer. Drawn from the text of Diogenes Laertius itself
 * (source-internal: no modern reference data). Each doxa carries a D.L.
 * citation (book.section, Hicks numbering, as in kg.ts and kg-claims.ts),
 * the verbatim Hicks English (with Greek when curated), a one-line editorial
 * gloss, a controlled doctrinal domain, and a certainty level reflecting
 * D.L.'s own epistemic stance and the source he names when he names one.
 *
 * Boundary with the claims layer: a `heldDoctrine` claim is an EDGE
 * (philosopher → doctrine label) feeding the knowledge graph; a doxa is the
 * verbatim doctrinal PASSAGE, classified by domain. The two may coexist for
 * the same teaching: when a doxa instantiates a doctrine the graph already
 * knows, the optional `doctrine` field names that label (validated against
 * the existing doctrine nodes - the doxography layer mints NOTHING, so the
 * gazetteer and pinned annotations stay stable).
 *
 * Boundary with the sayings layer: a doxa's excerpt may CONTAIN a curated
 * saying's text, but must never normalized-EQUAL one - that would mean the
 * entry is a mislabeled saying (validator-enforced, mirroring anecdotes).
 *
 * Hand-curated, NOT auto-detected. Every doxa's English is a verbatim
 * excerpt of its cited section, verified against the corpus by
 * scripts/src/validate-doxai.ts (the `doxai` validation check).
 */
import { corpus } from "./corpus";
import { Bm25Index } from "./bm25";
import { schoolGrcForCorpusLabel } from "./greek-names";
import type { Certainty } from "./kg-claims";
import { BOOK1_DOXAI } from "./doxai/book1";
import { BOOK2_DOXAI } from "./doxai/book2";
import { BOOK3_DOXAI } from "./doxai/book3";
import { BOOK4_DOXAI } from "./doxai/book4";
import { BOOK5_DOXAI } from "./doxai/book5";
import { BOOK6_DOXAI } from "./doxai/book6";
import { BOOK7_DOXAI } from "./doxai/book7";
import { BOOK8_DOXAI } from "./doxai/book8";
import { BOOK9_DOXAI } from "./doxai/book9";
import { BOOK10_DOXAI } from "./doxai/book10";

/**
 * Controlled doctrinal domains for the doxography, used by the /doxography
 * domain filter. Deliberately distinct from SayingTopic (dictum-thematic)
 * and AnecdoteTopic (narrative): these classify what field of philosophy a
 * tenet belongs to. A TS string-literal union so miscategorisation is a
 * compile error; the frontend derives the actual facet list from the data
 * it fetches. Locked at twelve domains.
 */
export type DoxaDomain =
  | "first-principles"
  | "cosmology"
  | "physics"
  | "soul"
  | "gods"
  | "epistemology"
  | "logic"
  | "ethics"
  | "pleasure"
  | "politics"
  | "fate"
  | "death";

export const DOXA_DOMAINS: DoxaDomain[] = [
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

export interface Doxa {
  /** Stable id, prefixed per philosopher (e.g. "thales-water-first-principle"). */
  id: string;
  /** Philosopher name exactly as in the corpus. */
  philosopher: string;
  domain: DoxaDomain;
  /** One-line editorial summary of the tenet (curator's words). */
  gloss: string;
  /** Greek text of the tenet, when curated. */
  grc?: string;
  /** Section ref (book.section, Hicks numbering) where the Greek lives,
   * when it differs from `ref` - the Perseus Greek and Hicks English
   * section boundaries occasionally diverge. Curator-only, never
   * serialized; the validator checks `grc` against this section instead
   * of `ref`. */
  grcRef?: string;
  /** Verbatim Hicks English excerpt of the tenet (source-internal). */
  en: string;
  /** D.L. citation (book.section, Hicks numbering). Required. */
  ref: string;
  /** Label of an existing doctrine node this tenet instantiates (a claim
   * doctrine or a school doctrine), EXACTLY as the graph spells it. Only
   * curated when the match is beyond doubt; the validator rejects labels
   * the graph does not already know - the doxography layer never mints
   * doctrine nodes. Surfaced in LOD as lo:expressesDoctrine. */
  doctrine?: string;
  certainty: Certainty;
  /** The source D.L. names for the tenet, when he names one. */
  accordingTo?: string;
  /** A rival figure D.L. reports the tenet is also attributed to. */
  alsoAttributedTo?: string;
  /** Set when the tenet is recorded in a *different* philosopher's chapter
   * than its holder (e.g. a school summary inside the founder's life
   * covering a successor). Opts the doxa out of the validator's
   * holder/section-owner attribution check; curator-only, never
   * serialized. */
  crossAttributed?: boolean;
  note?: string;
}

const RAW_DOXAI: Doxa[] = [
  ...BOOK1_DOXAI,
  ...BOOK2_DOXAI,
  ...BOOK3_DOXAI,
  ...BOOK4_DOXAI,
  ...BOOK5_DOXAI,
  ...BOOK6_DOXAI,
  ...BOOK7_DOXAI,
  ...BOOK8_DOXAI,
  ...BOOK9_DOXAI,
  ...BOOK10_DOXAI,
];

/** School per philosopher, first occurrence in reading order. */
const schoolByPhilosopher = new Map<string, string>();
for (const s of corpus) {
  if (!schoolByPhilosopher.has(s.philosopher)) {
    schoolByPhilosopher.set(s.philosopher, s.school);
  }
}

/** All corpus sections sharing a bare book.section ref, in reading order. */
let refCandidates: Map<string, { id: string; philosopher: string }[]> | null =
  null;

/**
 * Resolve a doxa's ref to a corpus section, OWNER-AWARE: a bare
 * book.section ref is occasionally ambiguous because Hicks numbering
 * restarts across chapter boundaries (e.g. 7.160 ends Zeno's doxography
 * AND opens Ariston of Chios' life; 7.166 spans Herillus and Dionysius).
 * The claims layer resolves the same way (sectionIdForRef in
 * claims-answer.ts takes the claim's subject), and for doxai too a wrong
 * section is fatal - the verbatim and attribution
 * checks are section-scoped - so when several sections share the ref, the
 * one owned by the doxa's philosopher wins, falling back to first-match.
 * The validator, the API serialization and the LOD emission all resolve
 * through this function so the three can never disagree.
 */
export function doxaSectionIdFor(
  ref: string,
  philosopher: string,
): string | undefined {
  if (!refCandidates) {
    refCandidates = new Map();
    for (const s of corpus) {
      const parts = s.id.split(".");
      const key = `${parts[0]}.${parts[parts.length - 1]}`;
      let list = refCandidates.get(key);
      if (!list) {
        list = [];
        refCandidates.set(key, list);
      }
      list.push({ id: s.id, philosopher: s.philosopher });
    }
  }
  const candidates = refCandidates.get(ref);
  if (!candidates || candidates.length === 0) return undefined;
  const owned = candidates.find((c) => c.philosopher === philosopher);
  return (owned ?? candidates[0]!).id;
}

/**
 * Validate structural invariants and return the curated doxai. Throws on
 * duplicate ids, unknown philosophers, empty text, unknown domains, or
 * malformed refs. The verbatim-against-corpus and doctrine-label checks
 * live in the validation script (which has the section text and the
 * doctrine node set to compare against).
 */
let validated: Doxa[] | null = null;
export function getDoxai(): Doxa[] {
  if (validated) return validated;
  const seen = new Set<string>();
  const domains = new Set<string>(DOXA_DOMAINS);
  for (const d of RAW_DOXAI) {
    if (seen.has(d.id)) throw new Error(`Doxa ${d.id}: duplicate id`);
    seen.add(d.id);
    if (!schoolByPhilosopher.has(d.philosopher)) {
      throw new Error(`Doxa ${d.id}: unknown philosopher "${d.philosopher}"`);
    }
    if (d.en.trim().length === 0) {
      throw new Error(`Doxa ${d.id}: empty English text`);
    }
    if (!domains.has(d.domain)) {
      throw new Error(`Doxa ${d.id}: unknown domain "${d.domain}"`);
    }
    if (!/^\d+\.[A-Za-z0-9]+$/.test(d.ref)) {
      throw new Error(`Doxa ${d.id}: malformed ref "${d.ref}"`);
    }
    if (d.grcRef !== undefined) {
      if (!/^\d+\.[A-Za-z0-9]+$/.test(d.grcRef)) {
        throw new Error(`Doxa ${d.id}: malformed grcRef "${d.grcRef}"`);
      }
      if (d.grcRef === d.ref) {
        throw new Error(`Doxa ${d.id}: grcRef equals ref "${d.ref}" - omit grcRef`);
      }
      if (!d.grc) {
        throw new Error(`Doxa ${d.id}: grcRef without grc`);
      }
    }
    if (d.doctrine !== undefined && d.doctrine.trim().length === 0) {
      throw new Error(`Doxa ${d.id}: empty doctrine label`);
    }
  }
  validated = RAW_DOXAI;
  return validated;
}

export interface SerializedDoxa {
  id: string;
  philosopher: string;
  school: string;
  /** Greek display form of `school` (greek-names.ts curated maps). */
  schoolGrc?: string;
  book: number;
  domain: string;
  gloss: string;
  grc: string | null;
  en: string;
  ref: string;
  sectionId: string | null;
  certainty: Certainty;
  doctrine?: string;
  accordingTo?: string;
  alsoAttributedTo?: string;
  note?: string;
}

function serialize(d: Doxa): SerializedDoxa {
  return {
    id: d.id,
    philosopher: d.philosopher,
    school: schoolByPhilosopher.get(d.philosopher) ?? "",
    schoolGrc: schoolGrcForCorpusLabel(
      schoolByPhilosopher.get(d.philosopher) ?? "",
    ),
    book: Number(d.ref.split(".")[0]),
    domain: d.domain,
    gloss: d.gloss,
    grc: d.grc ?? null,
    en: d.en,
    ref: d.ref,
    sectionId: doxaSectionIdFor(d.ref, d.philosopher) ?? null,
    certainty: d.certainty,
    ...(d.doctrine ? { doctrine: d.doctrine } : {}),
    ...(d.accordingTo ? { accordingTo: d.accordingTo } : {}),
    ...(d.alsoAttributedTo ? { alsoAttributedTo: d.alsoAttributedTo } : {}),
    ...(d.note ? { note: d.note } : {}),
  };
}

// BM25 over Greek + English + gloss, so queries in either language and by
// theme all hit the index (mirrors the saying layer).
const bm25 = new Bm25Index(
  getDoxai().map((d) => [d.grc ?? "", d.en, d.gloss].join(" ")),
);

export interface DoxaQuery {
  q?: string | undefined;
  philosopher?: string | undefined;
  domain?: string | undefined;
  book?: number | undefined;
}

/**
 * Filter the doxai by philosopher (exact, case-insensitive), domain, and
 * book, and, when `q` is given, rank the survivors by BM25 relevance
 * (dropping zero-score misses). With no `q`, the filtered list is returned
 * in corpus (reading) order.
 */
export function listDoxai({
  q,
  philosopher,
  domain,
  book,
}: DoxaQuery): SerializedDoxa[] {
  const all = getDoxai();
  let indices = all.map((_, i) => i);
  if (philosopher !== undefined && philosopher.trim().length > 0) {
    const needle = philosopher.trim().toLowerCase();
    indices = indices.filter((i) => all[i]!.philosopher.toLowerCase() === needle);
  }
  if (domain !== undefined && domain.trim().length > 0) {
    const needle = domain.trim().toLowerCase();
    indices = indices.filter((i) => all[i]!.domain.toLowerCase() === needle);
  }
  if (book !== undefined) {
    indices = indices.filter((i) => Number(all[i]!.ref.split(".")[0]) === book);
  }
  if (q !== undefined && q.trim().length > 0) {
    const scores = bm25.scores(q);
    indices = indices
      .filter((i) => (scores[i] ?? 0) > 0)
      .sort((a, b) => (scores[b] ?? 0) - (scores[a] ?? 0));
  }
  return indices.map((i) => serialize(all[i]!));
}
