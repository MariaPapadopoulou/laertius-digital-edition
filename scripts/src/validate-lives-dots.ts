/**
 * Keeps the homepage "82 Lives" dot chart honest against the
 * curated corpus.
 *
 * The chart hardcodes a per-book dot count (one dot per Life) and the
 * highlighted-dot positions in artifacts/laertius/src/pages/home.tsx
 * (LIVES_DOTS). If the curated corpus ever changes its per-book Life
 * roster, the chart would silently disagree with the edition. This
 * validator:
 *
 * 1. Parses LIVES_DOTS and the "NN Lives" label out of
 *    home.tsx.
 * 2. Recomputes the truth from the api-server corpus (the same
 *    `philosophers` roster the API serves): one Life per book chapter,
 *    excluding the Book I prologue; highlights are the index/indices of
 *    the Life with the most text sections in each book (ties keep all
 *    maxima).
 * 3. Fails loudly on any mismatch (per-book count, highlight set,
 *    out-of-range highlight index, dot total vs label, label vs corpus
 *    total), printing the fresh table to paste into home.tsx.
 * 4. Sweeps the other laertius pages for a second hardcoded copy of the
 *    dot data (the Ask page once carried one); any reappearance must
 *    share home.tsx's validated constant, not fork it.
 * 5. Runs a positive control: a deliberately perturbed copy of the
 *    parsed data must be reported as a mismatch, proving the comparator
 *    is not vacuously green.
 */
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

const workspaceRoot = path.resolve(import.meta.dirname, "../..");
process.env["LAERTIUS_DATA_DIR"] = path.resolve(
  workspaceRoot,
  "artifacts/api-server/data",
);

const HOME_TSX = path.resolve(
  workspaceRoot,
  "artifacts/laertius/src/pages/home.tsx",
);
const PAGES_DIR = path.resolve(workspaceRoot, "artifacts/laertius/src/pages");

interface DotBook {
  num: string;
  count: number;
  highlight: number[];
}

const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];

function parseLivesDots(source: string): DotBook[] {
  const block = source.match(/const LIVES_DOTS = \[([\s\S]*?)\n\];/);
  if (!block) {
    throw new Error("home.tsx: could not find `const LIVES_DOTS = [...]`");
  }
  const entryRe =
    /\{\s*num:\s*"([IVX]+)"\s*,\s*count:\s*(\d+)\s*,\s*highlight:\s*\[([\d\s,]*)\]\s*\}/g;
  const books: DotBook[] = [];
  for (const m of block[1]!.matchAll(entryRe)) {
    books.push({
      num: m[1]!,
      count: Number(m[2]!),
      highlight: m[3]!
        .split(",")
        .map((s) => s.trim())
        .filter((s) => s.length > 0)
        .map(Number),
    });
  }
  if (books.length === 0) {
    throw new Error("home.tsx: LIVES_DOTS block matched but no entries parsed");
  }
  return books;
}

function parseLabelTotal(source: string): number {
  const m = source.match(/(\d+)\s+Lives\b/);
  if (!m) {
    throw new Error('home.tsx: could not find the "NN Lives" label');
  }
  return Number(m[1]!);
}

interface CorpusBook {
  num: string;
  count: number;
  highlight: number[];
  names: string[];
}

async function corpusTruth(): Promise<CorpusBook[]> {
  const { philosophers } = await import(
    "../../artifacts/api-server/src/lib/corpus"
  );
  const out: CorpusBook[] = [];
  for (let b = 1; b <= 10; b++) {
    const lives = philosophers.filter(
      (p) => p.book === b && p.chapter !== "prol",
    );
    if (lives.length === 0) {
      throw new Error(`corpus: book ${b} has zero Lives — corpus data broken?`);
    }
    const max = Math.max(...lives.map((p) => p.sectionCount));
    const highlight = lives
      .map((p, i) => ({ i, c: p.sectionCount }))
      .filter((x) => x.c === max)
      .map((x) => x.i);
    out.push({
      num: ROMAN[b - 1]!,
      count: lives.length,
      highlight,
      names: lives.map((p) => p.name),
    });
  }
  return out;
}

function compare(
  dots: DotBook[],
  labelTotal: number,
  truth: CorpusBook[],
): string[] {
  const errors: string[] = [];
  if (dots.length !== truth.length) {
    errors.push(
      `LIVES_DOTS has ${dots.length} books; corpus has ${truth.length}`,
    );
  }
  for (const t of truth) {
    const d = dots.find((x) => x.num === t.num);
    if (!d) {
      errors.push(`LIVES_DOTS is missing book ${t.num}`);
      continue;
    }
    if (d.count !== t.count) {
      errors.push(
        `book ${t.num}: chart shows ${d.count} dots, corpus has ${t.count} Lives`,
      );
    }
    for (const h of d.highlight) {
      if (h < 0 || h >= d.count) {
        errors.push(
          `book ${t.num}: highlight index ${h} is out of range (count ${d.count})`,
        );
      }
    }
    const want = [...t.highlight].sort((a, b) => a - b).join(",");
    const got = [...d.highlight].sort((a, b) => a - b).join(",");
    if (want !== got) {
      errors.push(
        `book ${t.num}: highlighted dots [${got}] != most-sectioned Life [${want}] (${t.highlight.map((i) => t.names[i]).join(", ")})`,
      );
    }
  }
  const dotSum = dots.reduce((s, d) => s + d.count, 0);
  const corpusTotal = truth.reduce((s, t) => s + t.count, 0);
  if (dotSum !== labelTotal) {
    errors.push(
      `label says "${labelTotal} Lives" but the chart draws ${dotSum} dots`,
    );
  }
  if (labelTotal !== corpusTotal) {
    errors.push(
      `label says "${labelTotal} Lives" but the corpus has ${corpusTotal} Lives`,
    );
  }
  return errors;
}

function sweepForForkedCopies(): string[] {
  const errors: string[] = [];
  const suspicious = [/LIVES_DOTS/, /\d+\s+Lives\b/, /DotGrid/];
  for (const file of readdirSync(PAGES_DIR)) {
    if (!/\.(tsx?|mts)$/.test(file) || file === "home.tsx") continue;
    const src = readFileSync(path.join(PAGES_DIR, file), "utf-8");
    for (const re of suspicious) {
      if (re.test(src)) {
        errors.push(
          `${file}: contains ${re.source} — a second dot-chart copy must import home.tsx's validated data, not fork it`,
        );
      }
    }
  }
  return errors;
}

async function main() {
  const source = readFileSync(HOME_TSX, "utf-8");
  const dots = parseLivesDots(source);
  const labelTotal = parseLabelTotal(source);
  const truth = await corpusTruth();

  // Positive control: a perturbed copy MUST be flagged.
  const perturbed = dots.map((d, i) =>
    i === 0 ? { ...d, count: d.count + 1 } : d,
  );
  const controlErrors = compare(perturbed, labelTotal, truth);
  if (controlErrors.length === 0) {
    console.error(
      "POSITIVE CONTROL FAILED: a deliberately wrong dot count was not detected — the comparator is vacuous.",
    );
    process.exit(1);
  }
  console.log(
    `positive control OK (${controlErrors.length} mismatch(es) flagged on perturbed data)`,
  );

  const errors = [...compare(dots, labelTotal, truth), ...sweepForForkedCopies()];
  if (errors.length > 0) {
    console.error("Lives dot chart is out of sync with the corpus:");
    for (const e of errors) console.error(`  - ${e}`);
    console.error("\nFresh table from the corpus (paste into LIVES_DOTS):");
    for (const t of truth) {
      console.error(
        `  { num: "${t.num}", count: ${t.count}, highlight: [${t.highlight.join(", ")}] },`,
      );
    }
    console.error(
      `\nCorpus total: ${truth.reduce((s, t) => s + t.count, 0)} Lives`,
    );
    process.exit(1);
  }
  console.log(
    `OK: ${dots.length} books, ${labelTotal} Lives — chart matches the corpus (counts, highlights, label).`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
