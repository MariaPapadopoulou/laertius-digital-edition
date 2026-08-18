/**
 * Curated, cited anecdotes of the philosophers - narrated biographical
 * incidents (chreiai with action, encounters, vignettes), as opposed to the
 * bare dicta of the sayings layer. Drawn from the text of Diogenes Laertius
 * itself (source-internal: no modern reference data). Each anecdote carries
 * a D.L. citation (book.section, Hicks numbering, as in kg.ts and
 * kg-claims.ts), the verbatim Hicks English (with Greek when curated), a
 * one-line editorial gloss, a controlled narrative topic, and a certainty
 * level reflecting D.L.'s own epistemic stance and the source he names when
 * he names one.
 *
 * Overlap policy with the sayings layer: an incident whose entire substance
 * is an already-curated saying is NOT re-curated here (the dictum layer
 * covers it); an anecdote is included when there is narrative action beyond
 * the quote. When the anecdote narrates the setting of a curated saying,
 * `framesSaying` links to it by id. The anecdote's excerpt may CONTAIN the
 * saying's text (cross-layer containment is expected); the validator rejects
 * only normalized EQUALITY, which would mean the entry is a mislabeled
 * saying.
 *
 * Hand-curated, NOT auto-detected. Every anecdote's English is a verbatim
 * excerpt of its cited section, verified against the corpus by
 * scripts/src/validate-anecdotes.ts (the `anecdotes` validation check).
 */
import { corpus } from "./corpus";
import { sectionIdForRef } from "./claims-answer";
import { Bm25Index } from "./bm25";
import { schoolGrcForCorpusLabel } from "./greek-names";
import type { Certainty } from "./kg-claims";
import { BOOK1_ANECDOTES } from "./anecdotes/book1";
import { BOOK2_ANECDOTES } from "./anecdotes/book2";
import { BOOK3_ANECDOTES } from "./anecdotes/book3";
import { BOOK4_ANECDOTES } from "./anecdotes/book4";
import { BOOK5_ANECDOTES } from "./anecdotes/book5";
import { BOOK6_ANECDOTES } from "./anecdotes/book6";
import { BOOK7_ANECDOTES } from "./anecdotes/book7";
import { BOOK8_ANECDOTES } from "./anecdotes/book8";
import { BOOK9_ANECDOTES } from "./anecdotes/book9";
import { BOOK10_ANECDOTES } from "./anecdotes/book10";

/**
 * Controlled narrative facets for anecdotes, used by the /anecdotes topic
 * filter. Deliberately distinct from SayingTopic (which is dictum-thematic):
 * these classify what HAPPENS in the incident. A TS string-literal union so
 * miscategorisation is a compile error; the frontend derives the actual
 * facet list from the data it fetches. Locked after the book-6 pilot.
 */
export type AnecdoteTopic =
  | "exile"
  | "conversion"
  | "asceticism"
  | "training"
  | "teaching"
  | "defiance"
  | "encounter"
  | "wit"
  | "eccentricity"
  | "shamelessness"
  | "capture"
  | "death"
  | "legacy"
  | "piety";

export const ANECDOTE_TOPICS: AnecdoteTopic[] = [
  "exile",
  "conversion",
  "asceticism",
  "training",
  "teaching",
  "defiance",
  "encounter",
  "wit",
  "eccentricity",
  "shamelessness",
  "capture",
  "death",
  "legacy",
  "piety",
];

export interface Anecdote {
  /** Stable id, prefixed per philosopher (e.g. "diogenes-sinope-tub-metroon"). */
  id: string;
  /** Philosopher name exactly as in the corpus. */
  philosopher: string;
  topic: AnecdoteTopic;
  /** One-line editorial summary of the incident (curator's words). */
  gloss: string;
  /** Greek text of the incident, when curated. */
  grc?: string;
  /** Section ref (book.section, Hicks numbering) where the Greek lives,
   * when it differs from `ref` - the Perseus Greek and Hicks English
   * section boundaries occasionally diverge. Curator-only, never
   * serialized; the validator checks `grc` against this section instead
   * of `ref`. */
  grcRef?: string;
  /** Verbatim Hicks English excerpt of the incident (source-internal). */
  en: string;
  /** D.L. citation (book.section, Hicks numbering). Required. */
  ref: string;
  /** A named counterpart in the incident (Alexander, Plato, …), exactly as
   * the cited passage names them. Only curated when D.L.'s text itself
   * names the participant; anonymous parties ("some one", "a youth") are
   * never guessed. In LOD this follows the addressee convention: object
   * link only when the name matches an existing node, else a literal  - 
   * never minting new person nodes. */
  involves?: string;
  /** Section ref where the participant is named, when it differs from
   * `ref`. Curator-only, never serialized. */
  involvesRef?: string;
  certainty: Certainty;
  /** The source D.L. names for the incident, when he names one. */
  accordingTo?: string;
  /** A rival figure D.L. reports the incident is also attributed to
   * (e.g. "others father this upon Aristippus"). */
  alsoAttributedTo?: string;
  /** Set when the incident is recorded in a *different* philosopher's
   * chapter than its protagonist. Opts the anecdote out of the validator's
   * section-owner attribution check; curator-only, never serialized. */
  crossAttributed?: boolean;
  /** Id of a curated saying (sayings layer) whose setting this anecdote
   * narrates. Validated against getSayings(); surfaced in LOD as
   * lo:framesSaying. */
  framesSaying?: string;
  note?: string;
}

const RAW_ANECDOTES: Anecdote[] = [
  ...BOOK1_ANECDOTES,
  ...BOOK2_ANECDOTES,
  ...BOOK3_ANECDOTES,
  ...BOOK4_ANECDOTES,
  ...BOOK5_ANECDOTES,
  ...BOOK6_ANECDOTES,
  ...BOOK7_ANECDOTES,
  ...BOOK8_ANECDOTES,
  ...BOOK9_ANECDOTES,
  ...BOOK10_ANECDOTES,
];

/** School per philosopher, first occurrence in reading order. */
const schoolByPhilosopher = new Map<string, string>();
for (const s of corpus) {
  if (!schoolByPhilosopher.has(s.philosopher)) {
    schoolByPhilosopher.set(s.philosopher, s.school);
  }
}

/**
 * Validate structural invariants and return the curated anecdotes. Throws
 * on duplicate ids, unknown philosophers, empty text, unknown topics, or
 * malformed refs. The verbatim-against-corpus check lives in the validation
 * script (which has the section text to compare against).
 */
let validated: Anecdote[] | null = null;
export function getAnecdotes(): Anecdote[] {
  if (validated) return validated;
  const seen = new Set<string>();
  const topics = new Set<string>(ANECDOTE_TOPICS);
  for (const a of RAW_ANECDOTES) {
    if (seen.has(a.id)) throw new Error(`Duplicate anecdote id: ${a.id}`);
    seen.add(a.id);
    if (!schoolByPhilosopher.has(a.philosopher)) {
      throw new Error(
        `Anecdote ${a.id}: unknown philosopher "${a.philosopher}"`,
      );
    }
    if (a.en.trim().length === 0) {
      throw new Error(`Anecdote ${a.id}: empty English text`);
    }
    if (!topics.has(a.topic)) {
      throw new Error(`Anecdote ${a.id}: unknown topic "${a.topic}"`);
    }
    if (!/^\d+\.[A-Za-z0-9]+$/.test(a.ref)) {
      throw new Error(`Anecdote ${a.id}: malformed ref "${a.ref}"`);
    }
    if (a.grcRef !== undefined) {
      if (!/^\d+\.[A-Za-z0-9]+$/.test(a.grcRef)) {
        throw new Error(`Anecdote ${a.id}: malformed grcRef "${a.grcRef}"`);
      }
      if (a.grcRef === a.ref) {
        throw new Error(
          `Anecdote ${a.id}: grcRef equals ref "${a.ref}" - omit grcRef`,
        );
      }
      if (!a.grc) {
        throw new Error(`Anecdote ${a.id}: grcRef without grc`);
      }
    }
    if (a.involvesRef !== undefined) {
      if (!/^\d+\.[A-Za-z0-9]+$/.test(a.involvesRef)) {
        throw new Error(
          `Anecdote ${a.id}: malformed involvesRef "${a.involvesRef}"`,
        );
      }
      if (a.involvesRef === a.ref) {
        throw new Error(
          `Anecdote ${a.id}: involvesRef equals ref "${a.ref}" - omit involvesRef`,
        );
      }
      if (!a.involves) {
        throw new Error(`Anecdote ${a.id}: involvesRef without involves`);
      }
    }
    if (a.involves !== undefined && a.involves.trim().length === 0) {
      throw new Error(`Anecdote ${a.id}: empty involves`);
    }
    if (a.framesSaying !== undefined && a.framesSaying.trim().length === 0) {
      throw new Error(`Anecdote ${a.id}: empty framesSaying`);
    }
  }
  validated = RAW_ANECDOTES;
  return validated;
}

export interface SerializedAnecdote {
  id: string;
  philosopher: string;
  school: string;
  /** Greek display form of `school` (greek-names.ts curated maps). */
  schoolGrc?: string;
  book: number;
  topic: string;
  gloss: string;
  grc: string | null;
  en: string;
  ref: string;
  sectionId: string | null;
  certainty: Certainty;
  involves?: string;
  accordingTo?: string;
  alsoAttributedTo?: string;
  framesSaying?: string;
  note?: string;
}

function serialize(a: Anecdote): SerializedAnecdote {
  return {
    id: a.id,
    philosopher: a.philosopher,
    school: schoolByPhilosopher.get(a.philosopher) ?? "",
    schoolGrc: schoolGrcForCorpusLabel(
      schoolByPhilosopher.get(a.philosopher) ?? "",
    ),
    book: Number(a.ref.split(".")[0]),
    topic: a.topic,
    gloss: a.gloss,
    grc: a.grc ?? null,
    en: a.en,
    ref: a.ref,
    sectionId: sectionIdForRef(a.ref, a.philosopher) ?? null,
    certainty: a.certainty,
    ...(a.involves ? { involves: a.involves } : {}),
    ...(a.accordingTo ? { accordingTo: a.accordingTo } : {}),
    ...(a.alsoAttributedTo ? { alsoAttributedTo: a.alsoAttributedTo } : {}),
    ...(a.framesSaying ? { framesSaying: a.framesSaying } : {}),
    ...(a.note ? { note: a.note } : {}),
  };
}

// BM25 over Greek + English + gloss, so queries in either language and by
// theme all hit the index (mirrors the sayings layer).
let bm25: Bm25Index | null = null;
function getBm25(): Bm25Index {
  bm25 ??= new Bm25Index(
    getAnecdotes().map((a) => [a.grc ?? "", a.en, a.gloss].join(" ")),
  );
  return bm25;
}

export interface AnecdoteQuery {
  q?: string | undefined;
  philosopher?: string | undefined;
  topic?: string | undefined;
  book?: number | undefined;
}

/**
 * Filter the anecdotes by philosopher (exact, case-insensitive), topic, and
 * book, and, when `q` is given, rank the survivors by BM25 relevance
 * (dropping zero-score misses). With no `q`, the filtered list is returned
 * in corpus (reading) order.
 */
export function listAnecdotes({
  q,
  philosopher,
  topic,
  book,
}: AnecdoteQuery): SerializedAnecdote[] {
  const all = getAnecdotes();
  let indices = all.map((_, i) => i);
  if (philosopher !== undefined && philosopher.trim().length > 0) {
    const needle = philosopher.trim().toLowerCase();
    indices = indices.filter(
      (i) => all[i]!.philosopher.toLowerCase() === needle,
    );
  }
  if (topic !== undefined && topic.trim().length > 0) {
    const needle = topic.trim().toLowerCase();
    indices = indices.filter((i) => all[i]!.topic.toLowerCase() === needle);
  }
  if (book !== undefined) {
    indices = indices.filter((i) => Number(all[i]!.ref.split(".")[0]) === book);
  }
  if (q !== undefined && q.trim().length > 0) {
    const scores = getBm25().scores(q);
    indices = indices
      .filter((i) => (scores[i] ?? 0) > 0)
      .sort((a, b) => (scores[b] ?? 0) - (scores[a] ?? 0));
  }
  return indices.map((i) => serialize(all[i]!));
}
