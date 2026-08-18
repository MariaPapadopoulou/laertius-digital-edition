import { readFileSync } from "node:fs";
import path from "node:path";
import { dataDir } from "./corpus";
import { Bm25Index } from "./bm25";
import { VERSE_AUTHORS } from "./verse-authors";
import { schoolGrcForCorpusLabel } from "./greek-names";
import { getKnowledgeGraph } from "./kg";

export type VerseGenre = "epigram";

export interface Verse {
  id: string;
  sectionId: string;
  book: number;
  philosopher: string;
  school: string;
  /** Greek display form of `school` (greek-names.ts curated maps),
   *  attached at load time; presentation-only. */
  schoolGrc?: string;
  linesGrc: string[];
  linesEn: string[] | null;
  source: string | null;
  continued: boolean;
  /** Computed at load time by `verseGenre`; absent means "unclassified". */
  genre?: VerseGenre;
  /**
   * Curated poet attribution from verse-authors.ts, attached at load time;
   * absent means the text names no author (never guessed).
   */
  author?: string;
  /**
   * True when `author` names a corpus philosopher (a KG node), so clients
   * can link the attribution to the philosopher's graph page. Absent when
   * there is no author or the poet has no Life of his own.
   */
  authorIsPhilosopher?: boolean;
}

/**
 * Deterministic genre rule - no guessing, mirroring the curation policy:
 *  - a verse whose editorial source label cites the Greek Anthology
 *    ("Anth. Pal." / "Anth. Plan.") is an epigram by definition of the
 *    source (the Anthology is an epigram collection);
 *  - a verse curated to Diogenes Laertius himself in verse-authors.ts is
 *    one of his Pammetros epigrams (that map only records the pieces he
 *    flags as his own).
 * Everything else stays unclassified rather than conjectured: the layer
 * also holds oracles, elegies, satirical Silloi, tragic fragments, etc.
 */
export function verseGenre(v: {
  id: string;
  source: string | null;
}): VerseGenre | undefined {
  const s = v.source ?? "";
  if (s.startsWith("Anth. Pal.") || s.startsWith("Anth. Plan.")) {
    return "epigram";
  }
  if (VERSE_AUTHORS[v.id] === "Diogenes Laertius") return "epigram";
  return undefined;
}

function loadVerses(): Verse[] {
  const file = path.resolve(dataDir, "laertius_verses.jsonl");
  const kgNames = new Set(getKnowledgeGraph().nodes.map((n) => n.name));
  return readFileSync(file, "utf-8")
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map((line) => {
      const v = JSON.parse(line) as Verse;
      const genre = verseGenre(v);
      const author = VERSE_AUTHORS[v.id];
      const schoolGrc = schoolGrcForCorpusLabel(v.school);
      return {
        ...v,
        ...(schoolGrc ? { schoolGrc } : {}),
        ...(genre ? { genre } : {}),
        ...(author ? { author } : {}),
        ...(author && kgNames.has(author) ? { authorIsPhilosopher: true } : {}),
      };
    });
}

export const verses: Verse[] = loadVerses();

// BM25 over Greek + English lines concatenated, so queries in either language
// hit both channels (mirrors the corpus index).
const bm25 = new Bm25Index(
  verses.map((v) => [...v.linesGrc, ...(v.linesEn ?? [])].join(" ")),
);

export interface VerseQuery {
  q?: string | undefined;
  philosopher?: string | undefined;
  book?: number | undefined;
  genre?: VerseGenre | undefined;
  author?: string | undefined;
}

/**
 * Filter the verse layer by philosopher/book and, when `q` is given, rank the
 * survivors by BM25 relevance (dropping zero-score misses). With no `q`, the
 * filtered list is returned in corpus (reading) order.
 */
export function listVerses({
  q,
  philosopher,
  book,
  genre,
  author,
}: VerseQuery): Verse[] {
  let indices = verses.map((_, i) => i);
  if (book !== undefined) {
    indices = indices.filter((i) => verses[i]!.book === book);
  }
  if (genre !== undefined) {
    indices = indices.filter((i) => verses[i]!.genre === genre);
  }
  if (author !== undefined && author.trim().length > 0) {
    const wanted = author.trim().toLowerCase();
    indices = indices.filter(
      (i) => verses[i]!.author?.toLowerCase() === wanted,
    );
  }
  if (philosopher !== undefined && philosopher.trim().length > 0) {
    const needle = philosopher.toLowerCase();
    indices = indices.filter((i) =>
      verses[i]!.philosopher.toLowerCase().includes(needle),
    );
  }
  if (q !== undefined && q.trim().length > 0) {
    const scores = bm25.scores(q);
    indices = indices
      .filter((i) => (scores[i] ?? 0) > 0)
      .sort((a, b) => (scores[b] ?? 0) - (scores[a] ?? 0));
  }
  return indices.map((i) => verses[i]!);
}

/**
 * Verses attributed to any of the named philosophers, ranked by BM25 against
 * the query when one is supplied. Used to surface epigrams on the Ask page.
 */
export function versesForPhilosophers(
  names: string[],
  q: string,
  limit: number,
): Verse[] {
  if (names.length === 0) return [];
  const wanted = new Set(names.map((n) => n.toLowerCase()));
  let indices = verses
    .map((_, i) => i)
    .filter((i) => wanted.has(verses[i]!.philosopher.toLowerCase()));
  if (q.trim().length > 0) {
    const scores = bm25.scores(q);
    indices = indices.sort((a, b) => (scores[b] ?? 0) - (scores[a] ?? 0));
  }
  return indices.slice(0, limit).map((i) => verses[i]!);
}
