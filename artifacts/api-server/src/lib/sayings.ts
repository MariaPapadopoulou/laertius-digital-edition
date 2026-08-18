/**
 * Curated, cited sayings & apophthegms of the philosophers, drawn from the
 * text of Diogenes Laertius itself (source-internal: no modern reference
 * data). Each saying carries a D.L. citation (book.section, Hicks numbering,
 * as in kg.ts and kg-claims.ts), the verbatim Hicks English (with Greek when
 * curated), a one-line editorial gloss, a controlled thematic topic, and a
 * certainty level reflecting D.L.'s own epistemic stance and the source he
 * names when he names one.
 *
 * Hand-curated, NOT auto-detected. Every saying's English is a verbatim
 * excerpt of its cited section, verified against the corpus by
 * scripts/src/validate-sayings.ts (the `sayings` validation check).
 */
import { corpus } from "./corpus";
import { sectionIdForRef } from "./claims-answer";
import { Bm25Index } from "./bm25";
import { schoolGrcForCorpusLabel } from "./greek-names";
import type { Certainty } from "./kg-claims";
import { BOOK1_SAYINGS } from "./sayings/book1";
import { BOOK2_SAYINGS } from "./sayings/book2";
import { BOOK3_SAYINGS } from "./sayings/book3";
import { BOOK4_SAYINGS } from "./sayings/book4";
import { BOOK5_SAYINGS } from "./sayings/book5";
import { BOOK6_SAYINGS } from "./sayings/book6";
import { BOOK7_SAYINGS } from "./sayings/book7";
import { BOOK8_SAYINGS } from "./sayings/book8";
import { BOOK9_SAYINGS } from "./sayings/book9";
import { BOOK10_SAYINGS } from "./sayings/book10";

/**
 * Controlled thematic facets for sayings, used by the /sayings topic filter.
 * A TS string-literal union so miscategorisation is a compile error; the
 * frontend derives the actual facet list from the data it fetches.
 */
export type SayingTopic =
  | "wit"
  | "wealth"
  | "death"
  | "virtue"
  | "education"
  | "speech"
  | "friendship"
  | "fortune"
  | "self-sufficiency"
  | "pleasure"
  | "fame"
  | "religion"
  | "politics"
  | "wisdom";

export const SAYING_TOPICS: SayingTopic[] = [
  "wit",
  "wealth",
  "death",
  "virtue",
  "education",
  "speech",
  "friendship",
  "fortune",
  "self-sufficiency",
  "pleasure",
  "fame",
  "religion",
  "politics",
  "wisdom",
];

export interface Saying {
  /** Stable id, prefixed per philosopher (e.g. "diogenes-sinope-lamp"). */
  id: string;
  /** Philosopher name exactly as in the corpus. */
  philosopher: string;
  topic: SayingTopic;
  /** One-line editorial summary of the saying (curator's words). */
  gloss: string;
  /** Greek text of the saying, when curated. */
  grc?: string;
  /** Section ref (book.section, Hicks numbering) where the Greek lives,
   * when it differs from `ref` - the Perseus Greek and Hicks English
   * section boundaries occasionally diverge (e.g. Plato 3.39/3.40).
   * Curator-only, never serialized; the validator checks `grc` against
   * this section instead of `ref`. */
  grcRef?: string;
  /** Verbatim Hicks English excerpt of the saying (source-internal). */
  en: string;
  /** D.L. citation (book.section, Hicks numbering). Required. */
  ref: string;
  /** The named interlocutor the saying is spoken (or written) to, exactly as
   * the cited passage names them - a person ("Alexander"), or a named
   * collective ("the Athenians"). Only curated when D.L.'s text itself names
   * the addressee of the exchange; anonymous askers ("being asked...",
   * "to one who...") are never guessed. */
  to?: string;
  /** Section ref (book.section, Hicks numbering) where the addressee is
   * named, when it differs from `ref` - e.g. the Letter to Menoeceus opens
   * ("Epicurus to Menoeceus, greeting") at 10.121 but is excerpted from
   * 10.122–135. Curator-only, never serialized; the validator checks `to`
   * against this section instead of `ref`. */
  toRef?: string;
  certainty: Certainty;
  /** The source D.L. names for the saying, when he names one. */
  accordingTo?: string;
  /** A rival figure D.L. reports the saying is also attributed to
   * (e.g. "others father this upon Aristippus"). */
  alsoAttributedTo?: string;
  /** Set when the saying is recorded in a *different* philosopher's chapter
   * than its attributed speaker (D.L. quotes X inside Y's life). Opts the
   * saying out of the validator's speaker/section-owner attribution check;
   * curator-only, never serialized. */
  crossAttributed?: boolean;
  note?: string;
}

const RAW_SAYINGS: Saying[] = [
  ...BOOK1_SAYINGS,
  ...BOOK2_SAYINGS,
  ...BOOK3_SAYINGS,
  ...BOOK4_SAYINGS,
  ...BOOK5_SAYINGS,
  ...BOOK6_SAYINGS,
  ...BOOK7_SAYINGS,
  ...BOOK8_SAYINGS,
  ...BOOK9_SAYINGS,
  ...BOOK10_SAYINGS,
];

/** School per philosopher, first occurrence in reading order. */
const schoolByPhilosopher = new Map<string, string>();
for (const s of corpus) {
  if (!schoolByPhilosopher.has(s.philosopher)) {
    schoolByPhilosopher.set(s.philosopher, s.school);
  }
}

/**
 * Validate structural invariants and return the curated sayings. Throws on
 * duplicate ids, unknown philosophers, empty text, unknown topics, or
 * malformed refs. The verbatim-against-corpus check lives in the validation
 * script (which has the section text to compare against).
 */
let validated: Saying[] | null = null;
export function getSayings(): Saying[] {
  if (validated) return validated;
  const seen = new Set<string>();
  const topics = new Set<string>(SAYING_TOPICS);
  for (const s of RAW_SAYINGS) {
    if (seen.has(s.id)) throw new Error(`Duplicate saying id: ${s.id}`);
    seen.add(s.id);
    if (!schoolByPhilosopher.has(s.philosopher)) {
      throw new Error(`Saying ${s.id}: unknown philosopher "${s.philosopher}"`);
    }
    if (s.en.trim().length === 0) {
      throw new Error(`Saying ${s.id}: empty English text`);
    }
    if (!topics.has(s.topic)) {
      throw new Error(`Saying ${s.id}: unknown topic "${s.topic}"`);
    }
    if (!/^\d+\.[A-Za-z0-9]+$/.test(s.ref)) {
      throw new Error(`Saying ${s.id}: malformed ref "${s.ref}"`);
    }
    if (s.grcRef !== undefined) {
      if (!/^\d+\.[A-Za-z0-9]+$/.test(s.grcRef)) {
        throw new Error(`Saying ${s.id}: malformed grcRef "${s.grcRef}"`);
      }
      if (s.grcRef === s.ref) {
        throw new Error(
          `Saying ${s.id}: grcRef equals ref "${s.ref}" - omit grcRef`,
        );
      }
      if (!s.grc) {
        throw new Error(`Saying ${s.id}: grcRef without grc`);
      }
    }
    if (s.toRef !== undefined) {
      if (!/^\d+\.[A-Za-z0-9]+$/.test(s.toRef)) {
        throw new Error(`Saying ${s.id}: malformed toRef "${s.toRef}"`);
      }
      if (s.toRef === s.ref) {
        throw new Error(
          `Saying ${s.id}: toRef equals ref "${s.ref}" - omit toRef`,
        );
      }
      if (!s.to) {
        throw new Error(`Saying ${s.id}: toRef without to`);
      }
    }
    if (s.to !== undefined && s.to.trim().length === 0) {
      throw new Error(`Saying ${s.id}: empty to`);
    }
  }
  validated = RAW_SAYINGS;
  return validated;
}

export interface SerializedSaying {
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
  to?: string;
  accordingTo?: string;
  alsoAttributedTo?: string;
  note?: string;
}

function serialize(s: Saying): SerializedSaying {
  return {
    id: s.id,
    philosopher: s.philosopher,
    school: schoolByPhilosopher.get(s.philosopher) ?? "",
    schoolGrc: schoolGrcForCorpusLabel(
      schoolByPhilosopher.get(s.philosopher) ?? "",
    ),
    book: Number(s.ref.split(".")[0]),
    topic: s.topic,
    gloss: s.gloss,
    grc: s.grc ?? null,
    en: s.en,
    ref: s.ref,
    sectionId: sectionIdForRef(s.ref, s.philosopher) ?? null,
    certainty: s.certainty,
    ...(s.to ? { to: s.to } : {}),
    ...(s.accordingTo ? { accordingTo: s.accordingTo } : {}),
    ...(s.alsoAttributedTo ? { alsoAttributedTo: s.alsoAttributedTo } : {}),
    ...(s.note ? { note: s.note } : {}),
  };
}

// BM25 over Greek + English + gloss, so queries in either language and by
// theme all hit the index (mirrors the verse layer).
const bm25 = new Bm25Index(
  getSayings().map((s) => [s.grc ?? "", s.en, s.gloss].join(" ")),
);

export interface SayingQuery {
  q?: string | undefined;
  philosopher?: string | undefined;
  topic?: string | undefined;
  book?: number | undefined;
}

/**
 * Filter the sayings by philosopher (exact, case-insensitive), topic, and
 * book, and, when `q` is given, rank the survivors by BM25 relevance
 * (dropping zero-score misses). With no `q`, the filtered list is returned
 * in corpus (reading) order.
 */
export function listSayings({
  q,
  philosopher,
  topic,
  book,
}: SayingQuery): SerializedSaying[] {
  const all = getSayings();
  let indices = all.map((_, i) => i);
  if (philosopher !== undefined && philosopher.trim().length > 0) {
    const needle = philosopher.trim().toLowerCase();
    indices = indices.filter((i) => all[i]!.philosopher.toLowerCase() === needle);
  }
  if (topic !== undefined && topic.trim().length > 0) {
    const needle = topic.trim().toLowerCase();
    indices = indices.filter((i) => all[i]!.topic.toLowerCase() === needle);
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

/**
 * Sayings attributed to any of the named philosophers (exact match), ranked
 * by BM25 against the query when one is supplied. Used to surface
 * apophthegms on the Ask page.
 */
export function sayingsForPhilosophers(
  names: string[],
  q: string,
  limit: number,
): SerializedSaying[] {
  if (names.length === 0) return [];
  const all = getSayings();
  const wanted = new Set(names.map((n) => n.toLowerCase()));
  let indices = all
    .map((_, i) => i)
    .filter((i) => wanted.has(all[i]!.philosopher.toLowerCase()));
  if (q.trim().length > 0) {
    const scores = bm25.scores(q);
    indices = indices.sort((a, b) => (scores[b] ?? 0) - (scores[a] ?? 0));
  }
  return indices.slice(0, limit).map((i) => serialize(all[i]!));
}
