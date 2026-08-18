/**
 * Assertion-grounded Ask. Hybrid retrieval (BM25 + dense embeddings, both
 * indexed from the store's own passage text literals) selects passages;
 * the stored stand-off annotations of those passages name the entities
 * involved; the answer lines are the assertions about those entities whose
 * citations resolve into the retrieved passages. Deterministic - every
 * line IS a dataset assertion, nothing is generated.
 */
import { Bm25Index } from "./bm25";
import { denseIndexReady, denseRank } from "./dense";
import { embedQuery, embedderReady } from "./embedder";
import { logger } from "./logger";
import {
  certaintyRank,
  type AssertionRec,
  type Model,
  type PassageRec,
} from "./model";

const RRF_K = 60;
const POOL = 50;
const MAX_LINES = 12;

let bm25: Bm25Index | null = null;
let docsById = new Map<string, number>();
let orderedPassages: PassageRec[] = [];

export function initRetrieval(model: Model): void {
  orderedPassages = model.passagesOrdered;
  docsById = new Map(orderedPassages.map((p, i) => [p.id, i]));
  bm25 = new Bm25Index(
    orderedPassages.map((p) =>
      p.englishText ? `${p.greekText} ${p.englishText}` : p.greekText,
    ),
  );
  logger.info(
    { sections: orderedPassages.length },
    "BM25 index built from store text literals",
  );
}

export interface RetrievedRec {
  passage: PassageRec;
  rank: number;
  score: number;
}

export interface AskLineRec {
  text: string;
  assertion: AssertionRec;
  passageRank?: number;
}

export interface AskResultRec {
  mode: "hybrid" | "sparse";
  notice?: string;
  retrieved: RetrievedRec[];
  lines: AskLineRec[];
  entities: { uri: string; label?: string }[];
}

function verbalize(a: AssertionRec): string {
  const obj = a.objectLabel ?? a.objectValue ?? "";
  return `${a.subjectLabel} ${a.predicateLabel} ${obj}`.trim();
}

export async function ask(
  model: Model,
  question: string,
  topK: number,
): Promise<AskResultRec> {
  if (!bm25) throw new Error("Retrieval indexes not initialised");

  let mode: "hybrid" | "sparse" = "hybrid";
  let notice: string | undefined;
  let denseHits: { id: string; score: number }[] = [];
  if (!denseIndexReady()) {
    mode = "sparse";
    notice = "Dense index unavailable; BM25-only retrieval.";
  } else {
    try {
      const vec = await embedQuery(question);
      denseHits = denseRank(vec, POOL);
    } catch (err) {
      logger.error({ err }, "Query embedding failed; sparse-only");
      mode = "sparse";
      notice = "Query embedder unavailable; BM25-only retrieval.";
    }
  }

  const { indices: sparseIdx } = bm25.rank(question, POOL);
  const fused = new Map<number, number>();
  sparseIdx.forEach((docIdx, rank) => {
    fused.set(docIdx, (fused.get(docIdx) ?? 0) + 1 / (RRF_K + rank + 1));
  });
  if (mode === "hybrid") {
    denseHits.forEach((hit, rank) => {
      const docIdx = docsById.get(hit.id);
      if (docIdx === undefined) return;
      fused.set(docIdx, (fused.get(docIdx) ?? 0) + 1 / (RRF_K + rank + 1));
    });
  }

  const retrieved: RetrievedRec[] = [...fused.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, topK)
    .map(([docIdx, score], i) => ({
      passage: orderedPassages[docIdx] as PassageRec,
      rank: i + 1,
      score,
    }));

  // Entities named by the retrieved passages' stored annotations, keyed to
  // the best (lowest) passage rank that mentions them.
  const entityBestRank = new Map<string, number>();
  for (const r of retrieved) {
    for (const ann of r.passage.annotations) {
      if (!entityBestRank.has(ann.entityUri)) {
        entityBestRank.set(ann.entityUri, r.rank);
      }
    }
  }

  const retrievedIds = new Map(retrieved.map((r) => [r.passage.id, r.rank]));
  const lines: AskLineRec[] = [];
  const seenAssertions = new Set<string>();
  const groundingEntities = new Map<string, number>();
  const candidates: { a: AssertionRec; entityRank: number }[] = [];
  for (const [entityUri, entityRank] of entityBestRank) {
    const touching = [
      ...(model.assertionsBySubject.get(entityUri) ?? []),
      ...(model.assertionsByObject.get(entityUri) ?? []),
    ];
    for (const a of touching) {
      if (!a.sectionId || !retrievedIds.has(a.sectionId)) continue;
      if (seenAssertions.has(a.uri)) continue;
      seenAssertions.add(a.uri);
      candidates.push({ a, entityRank });
    }
  }
  candidates.sort((x, y) => {
    const px = retrievedIds.get(x.a.sectionId as string) ?? 99;
    const py = retrievedIds.get(y.a.sectionId as string) ?? 99;
    return (
      px - py ||
      certaintyRank(x.a.certainty) - certaintyRank(y.a.certainty) ||
      x.entityRank - y.entityRank ||
      x.a.uri.localeCompare(y.a.uri)
    );
  });
  for (const { a } of candidates.slice(0, MAX_LINES)) {
    lines.push({
      text: verbalize(a),
      assertion: a,
      passageRank: retrievedIds.get(a.sectionId as string),
    });
    for (const uri of [a.subjectUri, a.objectUri]) {
      if (uri && entityBestRank.has(uri)) {
        groundingEntities.set(
          uri,
          Math.min(
            groundingEntities.get(uri) ?? 99,
            entityBestRank.get(uri) ?? 99,
          ),
        );
      }
    }
  }

  return {
    mode,
    notice,
    retrieved,
    lines,
    entities: [...groundingEntities.entries()]
      .sort((a, b) => a[1] - b[1])
      .map(([uri]) => ({ uri, label: model.labelOf(uri) })),
  };
}

export function denseAvailable(): boolean {
  return denseIndexReady() && embedderReady();
}
