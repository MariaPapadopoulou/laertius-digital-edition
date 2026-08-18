import { tokenize } from "./greek";

const K1 = 1.5;
const B = 0.75;

export class Bm25Index {
  private docCount: number;
  private avgDocLen: number;
  private docLens: number[];
  private termFreqs: Map<string, Map<number, number>>;
  private idf: Map<string, number>;

  constructor(documents: string[]) {
    this.docCount = documents.length;
    this.docLens = new Array<number>(documents.length);
    this.termFreqs = new Map();

    documents.forEach((doc, docIdx) => {
      const tokens = tokenize(doc);
      this.docLens[docIdx] = tokens.length;
      const localCounts = new Map<string, number>();
      for (const token of tokens) {
        localCounts.set(token, (localCounts.get(token) ?? 0) + 1);
      }
      for (const [term, count] of localCounts) {
        let postings = this.termFreqs.get(term);
        if (!postings) {
          postings = new Map();
          this.termFreqs.set(term, postings);
        }
        postings.set(docIdx, count);
      }
    });

    this.avgDocLen =
      this.docLens.reduce((a, b) => a + b, 0) / Math.max(1, this.docCount);

    this.idf = new Map();
    for (const [term, postings] of this.termFreqs) {
      const df = postings.size;
      this.idf.set(
        term,
        Math.log((this.docCount - df + 0.5) / (df + 0.5) + 1),
      );
    }
  }

  scores(query: string): Float64Array {
    const result = new Float64Array(this.docCount);
    for (const term of tokenize(query)) {
      const postings = this.termFreqs.get(term);
      if (!postings) continue;
      const idf = this.idf.get(term) ?? 0;
      for (const [docIdx, tf] of postings) {
        const docLen = this.docLens[docIdx] ?? 0;
        const denom = tf + K1 * (1 - B + (B * docLen) / this.avgDocLen);
        result[docIdx] = (result[docIdx] ?? 0) + (idf * (tf * (K1 + 1))) / denom;
      }
    }
    return result;
  }

  rank(query: string, pool: number): { indices: number[]; scores: Float64Array } {
    const scores = this.scores(query);
    const indices = Array.from({ length: this.docCount }, (_, i) => i)
      .filter((i) => (scores[i] ?? 0) > 0)
      .sort((a, b) => (scores[b] ?? 0) - (scores[a] ?? 0))
      .slice(0, pool);
    return { indices, scores };
  }
}
