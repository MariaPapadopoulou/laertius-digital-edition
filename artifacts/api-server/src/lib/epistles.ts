/**
 * The curated epistle layer: the letters Diogenes Laertius quotes verbatim
 * in the Lives - the (fictional) correspondence of the Seven Sages, the
 * royal exchanges (Antigonus/Zeno, Darius/Heraclitus), the Doric
 * Archytas/Plato letters, and Epicurus' genuine doctrinal epistles.
 *
 * Like the sayings layer, this is hand-curated TypeScript, deliberately not
 * auto-detected: only passages D.L. quotes as an actual letter text qualify
 * (introduced with a salutation or an explicit "he wrote thus"), never mere
 * reports that a letter existed. Each entry carries a verbatim Hicks English
 * excerpt (the letter opening or its most characteristic passage), the Greek
 * incipit or salutation, and an authenticity verdict reflecting modern
 * scholarship - since D.L. quotes Hellenistic epistolary fictions and
 * genuine Epicurus with the same straight face, the curator must say which
 * is which (spurious / disputed / authentic), with the reasoning in `note`.
 *
 * Deliberately excluded: Strato's letter to Arsinoë (5.60), of which D.L.
 * quotes only the incipit inside a hedged report ("they say a letter of his
 * to Arsinoë begins..."), not the letter itself.
 *
 * The verbatim-against-corpus checks live in scripts/src/validate-epistles.ts.
 */
import { corpus, sectionById } from "./corpus";
import { Bm25Index } from "./bm25";
import { BOOK1_EPISTLES } from "./epistles/book1";
import { BOOK2_EPISTLES } from "./epistles/book2";
import { BOOK3_EPISTLES } from "./epistles/book3";
import { BOOK4_EPISTLES } from "./epistles/book4";
import { BOOK7_EPISTLES } from "./epistles/book7";
import { BOOK8_EPISTLES } from "./epistles/book8";
import { BOOK9_EPISTLES } from "./epistles/book9";
import { BOOK10_EPISTLES } from "./epistles/book10";

/** Controlled thematic facets for the letters. */
export const EPISTLE_TOPICS = [
  "invitation",
  "politics",
  "philosophy",
  "writings",
  "death",
  "family",
] as const;
export type EpistleTopic = (typeof EPISTLE_TOPICS)[number];

/**
 * The curator's authenticity verdict, following modern scholarship:
 *  - "authentic":  generally accepted as genuinely by the named sender
 *                  (Epicurus' epistles);
 *  - "disputed":   genuinely contested or unverifiable;
 *  - "spurious":   generally rejected - Hellenistic epistolary fiction
 *                  (the entire Seven Sages correspondence, Anaximenes,
 *                  Darius/Heraclitus).
 * This is the CURATOR's axis, distinct from the claims layer's certainty
 * model, which tracks D.L.'s own epistemic stance.
 */
export const EPISTLE_AUTHENTICITIES = [
  "authentic",
  "disputed",
  "spurious",
] as const;
export type EpistleAuthenticity = (typeof EPISTLE_AUTHENTICITIES)[number];

export interface Epistle {
  /** Stable id: sender-to-addressee, suffixed when a pair repeats. */
  id: string;
  /** The letter's sender, exactly as the corpus names its philosophers
   * (when the sender has a Life of his own), else as the text names him. */
  sender: string;
  /** The addressee, same convention as `sender`. */
  to: string;
  /** D.L. citation (book.chapter.section) of the English excerpt. */
  ref: string;
  /** Verbatim Greek excerpt - the salutation or incipit. */
  grc?: string;
  /** Section holding the Greek, when it differs from `ref` (salutations
   * often close the previous section). */
  grcRef?: string;
  /** Section that names the addressee, when `ref` itself does not. */
  toRef?: string;
  /** Verbatim Hicks English excerpt - the opening or key passage. */
  en: string;
  /** One-line editorial summary (curator's words). */
  gloss: string;
  topic: EpistleTopic;
  authenticity: EpistleAuthenticity;
  /** The letter's own dramatic date, ONLY when the text supplies one. */
  dramaticDate?: string;
  /** Curator's note - hedges, transmission, exclusions. */
  note?: string;
  /** Set when the letter is quoted outside both correspondents' Lives
   * (e.g. Archytas to Dionysius, quoted in Plato's Life). */
  crossAttributed?: boolean;
}

const RAW_EPISTLES: Epistle[] = [
  ...BOOK1_EPISTLES,
  ...BOOK2_EPISTLES,
  ...BOOK3_EPISTLES,
  ...BOOK4_EPISTLES,
  ...BOOK7_EPISTLES,
  ...BOOK8_EPISTLES,
  ...BOOK9_EPISTLES,
  ...BOOK10_EPISTLES,
];

/** Philosopher names present in the corpus (for node-vs-literal decisions). */
const corpusPhilosophers = new Set<string>();
for (const s of corpus) corpusPhilosophers.add(s.philosopher);

/**
 * Validate structural invariants and return the curated epistles. Throws on
 * duplicate ids, empty fields, unknown topics/authenticities, or malformed
 * refs. The verbatim-against-corpus check lives in the validation script.
 */
let validated: Epistle[] | null = null;
export function getEpistles(): Epistle[] {
  if (validated) return validated;
  const seen = new Set<string>();
  const topics = new Set<string>(EPISTLE_TOPICS);
  const authenticities = new Set<string>(EPISTLE_AUTHENTICITIES);
  const refPattern = /^\d+\.[A-Za-z0-9]+\.\d+$/;
  for (const e of RAW_EPISTLES) {
    if (seen.has(e.id)) throw new Error(`Duplicate epistle id: ${e.id}`);
    seen.add(e.id);
    if (e.sender.trim().length === 0) {
      throw new Error(`Epistle ${e.id}: empty sender`);
    }
    if (e.to.trim().length === 0) {
      throw new Error(`Epistle ${e.id}: empty addressee`);
    }
    if (e.en.trim().length === 0) {
      throw new Error(`Epistle ${e.id}: empty English text`);
    }
    if (!topics.has(e.topic)) {
      throw new Error(`Epistle ${e.id}: unknown topic "${e.topic}"`);
    }
    if (!authenticities.has(e.authenticity)) {
      throw new Error(
        `Epistle ${e.id}: unknown authenticity "${e.authenticity}"`,
      );
    }
    if (!refPattern.test(e.ref)) {
      throw new Error(`Epistle ${e.id}: malformed ref "${e.ref}"`);
    }
    if (e.grcRef !== undefined) {
      if (!refPattern.test(e.grcRef)) {
        throw new Error(`Epistle ${e.id}: malformed grcRef "${e.grcRef}"`);
      }
      if (e.grcRef === e.ref) {
        throw new Error(
          `Epistle ${e.id}: grcRef equals ref "${e.ref}" - omit grcRef`,
        );
      }
      if (!e.grc) throw new Error(`Epistle ${e.id}: grcRef without grc`);
    }
    if (e.toRef !== undefined) {
      if (!refPattern.test(e.toRef)) {
        throw new Error(`Epistle ${e.id}: malformed toRef "${e.toRef}"`);
      }
      if (e.toRef === e.ref) {
        throw new Error(
          `Epistle ${e.id}: toRef equals ref "${e.ref}" - omit toRef`,
        );
      }
    }
  }
  validated = RAW_EPISTLES;
  return validated;
}

export interface SerializedEpistle {
  id: string;
  sender: string;
  to: string;
  book: number;
  topic: string;
  authenticity: string;
  gloss: string;
  grc: string | null;
  en: string;
  ref: string;
  sectionId: string | null;
  dramaticDate?: string;
  note?: string;
}

function serialize(e: Epistle): SerializedEpistle {
  return {
    id: e.id,
    sender: e.sender,
    to: e.to,
    book: Number(e.ref.split(".")[0]),
    topic: e.topic,
    authenticity: e.authenticity,
    gloss: e.gloss,
    grc: e.grc ?? null,
    en: e.en,
    ref: refForDisplay(e.ref),
    sectionId: sectionById.has(e.ref) ? e.ref : null,
    ...(e.dramaticDate ? { dramaticDate: e.dramaticDate } : {}),
    ...(e.note ? { note: e.note } : {}),
  };
}

/** Epistle refs are full section ids (book.chapter.section); the display /
 * citation form is Hicks' book.section. */
export function refForDisplay(ref: string): string {
  const [book, , section] = ref.split(".");
  return `${book}.${section}`;
}

// BM25 over Greek + English + gloss + correspondents, so queries in either
// language, by theme, and by name all hit the index (mirrors the sayings).
const bm25 = new Bm25Index(
  getEpistles().map((e) => [e.grc ?? "", e.en, e.gloss, e.sender, e.to].join(" ")),
);

export interface EpistleQuery {
  q?: string | undefined;
  sender?: string | undefined;
  topic?: string | undefined;
  book?: number | undefined;
  authenticity?: string | undefined;
}

/**
 * Filter the epistles by sender (exact, case-insensitive), topic, book, and
 * authenticity, and, when `q` is given, rank the survivors by BM25 relevance
 * (dropping zero-score misses). With no `q`, the filtered list is returned
 * in corpus (reading) order.
 */
export function listEpistles({
  q,
  sender,
  topic,
  book,
  authenticity,
}: EpistleQuery): SerializedEpistle[] {
  const all = getEpistles();
  let indices = all.map((_, i) => i);
  if (sender !== undefined && sender.trim().length > 0) {
    const needle = sender.trim().toLowerCase();
    indices = indices.filter((i) => all[i]!.sender.toLowerCase() === needle);
  }
  if (topic !== undefined && topic.trim().length > 0) {
    const needle = topic.trim().toLowerCase();
    indices = indices.filter((i) => all[i]!.topic.toLowerCase() === needle);
  }
  if (book !== undefined) {
    indices = indices.filter((i) => Number(all[i]!.ref.split(".")[0]) === book);
  }
  if (authenticity !== undefined && authenticity.trim().length > 0) {
    const needle = authenticity.trim().toLowerCase();
    indices = indices.filter(
      (i) => all[i]!.authenticity.toLowerCase() === needle,
    );
  }
  if (q !== undefined && q.trim().length > 0) {
    const scores = bm25.scores(q);
    indices = indices
      .filter((i) => (scores[i] ?? 0) > 0)
      .sort((a, b) => (scores[b] ?? 0) - (scores[a] ?? 0));
  }
  return indices.map((i) => serialize(all[i]!));
}
