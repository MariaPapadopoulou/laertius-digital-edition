import { readFileSync, existsSync } from "node:fs";
import path from "node:path";

export interface CorpusSection {
  id: string;
  urn: string;
  book: number;
  chapter: string;
  section: string;
  philosopher: string;
  school: string;
  text: string;
  textEn: string | null;
}

const workspaceRoot = process.cwd().endsWith(
  path.join("artifacts", "api-server"),
)
  ? path.resolve(process.cwd(), "../..")
  : process.cwd();

export const dataDir =
  process.env["LAERTIUS_DATA_DIR"] ??
  path.resolve(workspaceRoot, "artifacts/api-server/data");

function loadJsonl<T>(filePath: string): T[] {
  return readFileSync(filePath, "utf-8")
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as T);
}

interface GreekRecord {
  id: string;
  urn: string;
  book: number;
  chapter: string;
  section: string;
  philosopher: string;
  school: string;
  text: string;
}

interface EnglishRecord {
  id: string;
  textEn: string;
}

function buildCorpus(): CorpusSection[] {
  const greek = loadJsonl<GreekRecord>(
    path.resolve(dataDir, "laertius_sections.jsonl"),
  );
  const englishPath = path.resolve(dataDir, "laertius_sections_en.jsonl");
  const english = new Map<string, string>();
  if (existsSync(englishPath)) {
    for (const rec of loadJsonl<EnglishRecord>(englishPath)) {
      english.set(rec.id, rec.textEn);
    }
  }
  return greek.map((g) => ({
    id: g.id,
    urn: g.urn,
    book: g.book,
    chapter: g.chapter,
    section: g.section,
    philosopher: g.philosopher,
    school: g.school,
    text: g.text,
    textEn: english.get(g.id) ?? null,
  }));
}

export const corpus: CorpusSection[] = buildCorpus();

export const sectionById: Map<string, CorpusSection> = new Map(
  corpus.map((s) => [s.id, s]),
);

export const indexById: Map<string, number> = new Map(
  corpus.map((s, i) => [s.id, i]),
);

export interface PhilosopherEntry {
  name: string;
  school: string;
  book: number;
  chapter: string;
  sectionCount: number;
  firstId: string;
}

function buildPhilosophers(): PhilosopherEntry[] {
  const seen = new Map<string, PhilosopherEntry>();
  for (const s of corpus) {
    const key = `${s.book}.${s.chapter}`;
    const existing = seen.get(key);
    if (existing) {
      existing.sectionCount += 1;
    } else {
      seen.set(key, {
        name: s.philosopher,
        school: s.school,
        book: s.book,
        chapter: s.chapter,
        sectionCount: 1,
        firstId: s.id,
      });
    }
  }
  return [...seen.values()];
}

export const philosophers: PhilosopherEntry[] = buildPhilosophers();

export const englishCoverage: number = corpus.filter(
  (s) => s.textEn !== null,
).length;

// Word tokens in the Greek text: whitespace-split, counting only tokens
// that contain at least one letter (skips bare punctuation and numerals).
export const totalGreekWords: number = corpus.reduce(
  (n, s) =>
    n +
    s.text
      .split(/\s+/)
      .filter((t) => /\p{L}/u.test(t)).length,
  0,
);
