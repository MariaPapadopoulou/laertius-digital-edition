/**
 * tune-gold-fusion-v05 — sweep hybrid-fusion parameters against gold v0.5.
 *
 * The gold v0.5 sparse/dense/hybrid comparison showed dense-only retrieval
 * surfacing abstention evidence (false-premise contradicting passages,
 * homonym rosters) better than equal-weight RRF hybrid. This script:
 *   1. loads the existing "Gold v0.5" topic set (snapshot snap-msirqatw-*),
 *   2. computes the sparse + dense candidate pools once per topic
 *      (cached in a resumable JSONL — the expensive part is embedding),
 *   3. re-fuses the cached pools under a grid of FusionParams variants
 *      (rrfK, sparse weight, KG boost scale) — pure and instant,
 *   4. scores every variant with goldScoring against gold-qrels-v0.5.jsonl,
 *   5. writes gold-eval-v0.5-fusion-tuning.md ranking the variants.
 *
 * Run from the workspace root:
 *   pnpm --filter @workspace/scripts exec tsx src/tune-gold-fusion-v05.ts
 */
import path from "node:path";
import { appendFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";

process.env["LAERTIUS_DATA_DIR"] ??= path.resolve(
  import.meta.dirname,
  "../../artifacts/api-server/data",
);
const dataDir = process.env["LAERTIUS_DATA_DIR"]!;

const { loadDenseIndex, denseIndexReady } = await import(
  "../../artifacts/api-server/src/lib/dense"
);
const { corpus } = await import("../../artifacts/api-server/src/lib/corpus");
const rag = await import("../../artifacts/api-server/src/lib/rag");
const store = await import("../../artifacts/api-server/src/lib/eval/store");
const { parseGoldQrels, scoreRunAgainstGoldQrels } = await import(
  "../../artifacts/api-server/src/lib/eval/goldScoring"
);
type FusionParams = import("../../artifacts/api-server/src/lib/rag").FusionParams;
type EvalRunRecord = import("../../artifacts/api-server/src/lib/eval/store").EvalRunRecord;

const GOLD_DIR = path.join(dataDir, "eval", "gold");
const QRELS_FILE = path.join(GOLD_DIR, "gold-qrels-v0.5.jsonl");
const POOLS_CACHE = path.join(GOLD_DIR, ".fusion-pools-cache-v0.5.jsonl");
const REPORT_MD = path.join(GOLD_DIR, "gold-eval-v0.5-fusion-tuning.md");
const TOPIC_SET_LABEL = "Gold v0.5 (200 questions, 140/30/30)";
const TOP_K = 10;

const topicSet = store.listTopicSets().find((s) => s.label === TOPIC_SET_LABEL);
if (!topicSet) throw new Error(`topic set "${TOPIC_SET_LABEL}" not found — run run-gold-eval-v05 first`);
console.log(`topic set: ${topicSet.id} (snapshot ${topicSet.snapshotId}, ${topicSet.topics.length} topics)`);

/* Pools, cached per topic (embedding is the expensive part). */
loadDenseIndex();
if (!denseIndexReady()) throw new Error("dense index not ready");

interface CachedPools {
  topic_id: string;
  sparse: number[];
  dense: number[];
  matched: string[];
  related: string[];
  /** Corpus school labels named in the query (missing in older cache rows = recompute). */
  schools?: string[];
  /** Relation-asserting section ids for relational queries (missing in older cache rows = recompute). */
  relationSections?: string[];
}
const pools = new Map<string, CachedPools>();
if (existsSync(POOLS_CACHE)) {
  for (const line of readFileSync(POOLS_CACHE, "utf8").split("\n")) {
    if (!line.trim()) continue;
    const o = JSON.parse(line) as CachedPools;
    // Rows cached before the school-boost feature lack `schools`; drop them
    // so the pools are recomputed with production-equivalent fusion inputs.
    if (o.schools !== undefined && o.relationSections !== undefined) pools.set(o.topic_id, o);
  }
  console.log(`resume cache: ${pools.size} topics already pooled`);
}
let done = 0;
for (const t of topicSet.topics) {
  if (!pools.has(t.topic_id)) {
    const p = await rag.hybridPools(t.question);
    const row: CachedPools = {
      topic_id: t.topic_id,
      sparse: p.sparseIndices,
      dense: p.denseIndices,
      matched: p.graphContext.matched,
      related: p.graphContext.related,
      schools: p.schoolMatched ?? [],
      relationSections: p.graphContext.relationSections ?? [],
    };
    appendFileSync(POOLS_CACHE, JSON.stringify(row) + "\n");
    pools.set(t.topic_id, row);
  }
  done++;
  if (done % 50 === 0) console.log(`${done}/${topicSet.topics.length} topics pooled`);
}
console.log("pools ready");

/* Qrels. */
const qrels = parseGoldQrels(readFileSync(QRELS_FILE, "utf8"), topicSet.snapshotId);
if ("error" in qrels) throw new Error(`parseGoldQrels: ${qrels.error}`);

/* Variant grid. */
interface Variant {
  name: string;
  params: FusionParams;
}
const kg = (rrfK: number, scale: number): Pick<FusionParams, "kgMatchedBoost" | "kgRelatedBoost"> => ({
  kgMatchedBoost: (scale * 0.5) / rrfK,
  kgRelatedBoost: (scale * 0.15) / rrfK,
});
const variants: Variant[] = [
  { name: "baseline (sw=1, k=60, kg=1)", params: { rrfK: 60, denseWeight: 1, sparseWeight: 1, ...kg(60, 1) } },
];
for (const sparseWeight of [0, 0.2, 0.3, 0.4, 0.5, 0.7]) {
  for (const rrfK of [20, 60, 120]) {
    for (const kgScale of [0, 0.5, 1]) {
      variants.push({
        name: `sw=${sparseWeight}, k=${rrfK}, kg=${kgScale}`,
        params: { rrfK, denseWeight: 1, sparseWeight, ...kg(rrfK, kgScale) },
      });
    }
  }
}

/* Score each variant offline (no eval-store registration). */
interface Scored {
  name: string;
  params: FusionParams;
  mrr: number;
  recall: number;
  ndcg: number;
  hit: number;
  fpHit: number;
  homHit: number;
}
const scored: Scored[] = [];
for (const v of variants) {
  const lines = topicSet.topics.flatMap((t) => {
    const p = pools.get(t.topic_id)!;
    return rag
      .fuseHybrid(
        {
          sparseIndices: p.sparse,
          denseIndices: p.dense,
          graphContext: {
            matched: p.matched,
            related: p.related,
            relationSections: p.relationSections ?? [],
          },
          schoolMatched: p.schools ?? [],
        },
        v.params,
      )
      .slice(0, TOP_K)
      .map(({ docIdx, score }, i) => ({
        topic_id: t.topic_id,
        passage_id: corpus[docIdx]!.id,
        rank: i + 1,
        score,
      }));
  });
  const run: EvalRunRecord = {
    id: `tuning:${v.name}`,
    systemId: "laertius-hybrid-tuning",
    snapshotId: topicSet.snapshotId,
    topicSetId: topicSet.id,
    createdAt: new Date().toISOString(),
    lines,
  };
  const s = scoreRunAgainstGoldQrels({ run, topicSet, qrels, k: TOP_K });
  const bySub = new Map(s.abstainBySubtype.map((x) => [x.abstainType, x.evidenceHitAtK]));
  scored.push({
    name: v.name,
    params: v.params,
    mrr: s.answerable.mrr,
    recall: s.answerable.recallAtK,
    ndcg: s.answerable.ndcgAtK,
    hit: s.answerable.hitAtK,
    fpHit: Number(bySub.get("false_premise") ?? 0),
    homHit: Number(bySub.get("underspecified_homonym") ?? 0),
  });
}

/* Rank: satisfy the abstention-evidence floor first, then answerable quality. */
const baseline = scored[0]!;
const DENSE_FP = 5; // dense-only false_premise evidence hit@10 (comparison report)
const DENSE_HOM = 2; // dense-only underspecified_homonym evidence hit@10
const ok = (s: Scored) =>
  s.fpHit >= DENSE_FP &&
  s.homHit >= DENSE_HOM &&
  s.mrr >= baseline.mrr &&
  s.recall >= baseline.recall &&
  s.ndcg >= baseline.ndcg &&
  s.hit >= baseline.hit;
const sorted = [...scored].sort(
  (a, b) => Number(ok(b)) - Number(ok(a)) || b.ndcg - a.ndcg || b.mrr - a.mrr,
);

const pct = (x: number) => (100 * x).toFixed(1) + "%";
const row = (s: Scored) =>
  `| ${s.name} | ${s.mrr.toFixed(4)} | ${pct(s.recall)} | ${s.ndcg.toFixed(4)} | ${pct(s.hit)} | ${s.fpHit} | ${s.homHit} | ${ok(s) ? "yes" : ""} |`;
const md = [
  "# Gold v0.5 — hybrid fusion parameter sweep",
  "",
  `- Generated: ${new Date().toISOString()}`,
  `- Topic set: ${topicSet.id} (${TOPIC_SET_LABEL})`,
  `- Snapshot: ${topicSet.snapshotId}`,
  `- Qrels: gold-qrels-v0.5.jsonl (${qrels.nRows} rows)`,
  "- Variants: weighted RRF (denseWeight=1, sparse weight sw), RRF constant k,",
  "  KG boost scale kg (1 = original 0.5/k matched, 0.15/k related).",
  `- "meets bar": ≥ baseline hybrid on all answerable metrics AND ≥ dense-only`,
  `  on abstention evidence (false_premise ${DENSE_FP}, underspecified_homonym ${DENSE_HOM}).`,
  "",
  "| variant | MRR | recall@10 | nDCG@10 | hit@10 | fp ev. hit@10 | hom ev. hit@10 | meets bar |",
  "| --- | --- | --- | --- | --- | --- | --- | --- |",
  row(baseline),
  ...sorted.filter((s) => s !== baseline).map(row),
  "",
].join("\n");
writeFileSync(REPORT_MD, md);

console.log("");
console.log("top variants (baseline first):");
console.log(row(baseline));
for (const s of sorted.slice(0, 12)) if (s !== baseline) console.log(row(s));
console.log(`report written: ${REPORT_MD}`);

export {};
