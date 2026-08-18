/**
 * run-gold-eval-v05 — evaluate the retrieval system against the official
 * v0.5 gold set (200 questions, 140/30/30 splits) with gold-qrels-v0.5:
 *   1. freeze a corpus snapshot (reused if one for v0.5 already exists),
 *   2. create a topic set from gold-topics-v0.5.jsonl bound to it,
 *   3. execute hybrid retrieval (top 10) over all 200 topics — retrieval
 *      results are cached per topic in a resumable JSONL so an interrupted
 *      run picks up where it left off,
 *   4. register the run in the eval store,
 *   5. score it against gold-qrels-v0.5.jsonl (MRR / recall@10 / nDCG@10 /
 *      hit@10 over answerable topics, per-abstain-subtype reporting) and
 *      write gold-eval-v0.5-report.{json,md} next to the gold files.
 *
 * Run from the workspace root (mode defaults to hybrid):
 *   pnpm --filter @workspace/scripts exec tsx src/run-gold-eval-v05.ts [hybrid|sparse|dense]
 * Then restart the API Server workflow so it reloads the eval store.
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
const { retrieve } = await import("../../artifacts/api-server/src/lib/rag");
const store = await import("../../artifacts/api-server/src/lib/eval/store");
const { parseGoldQrels, scoreRunAgainstGoldQrels } = await import(
  "../../artifacts/api-server/src/lib/eval/goldScoring"
);

const MODE_ARG = process.argv[2] ?? "hybrid";
if (!["hybrid", "sparse", "dense", "hybrid-tuned"].includes(MODE_ARG)) {
  throw new Error(`unknown mode "${MODE_ARG}" (expected hybrid|sparse|dense|hybrid-tuned)`);
}
// "hybrid-tuned" runs the retrieve() hybrid path with the tuned
// DEFAULT_FUSION_PARAMS (see gold-eval-v0.5-fusion-tuning.md); the original
// equal-weight hybrid run predates the tuning and stays registered as-is.
const LABEL_MODE = MODE_ARG as "hybrid" | "sparse" | "dense" | "hybrid-tuned";
const MODE = (LABEL_MODE === "hybrid-tuned" ? "hybrid" : LABEL_MODE) as
  | "hybrid"
  | "sparse"
  | "dense";
const SYSTEM_ID = `laertius-${LABEL_MODE}`;
const MODE_NOTE: Record<typeof LABEL_MODE, string> = {
  hybrid: "BM25 + dense RRF with knowledge-graph boost",
  sparse: "BM25 sparse retrieval only",
  dense: "Dense (embedding) retrieval only",
  "hybrid-tuned":
    "Weighted RRF (denseWeight=1, sparseWeight=0.3, rrfK=20) with knowledge-graph boost, tuned on gold v0.5",
};

const GOLD_DIR = path.join(dataDir, "eval", "gold");
const TOPICS_FILE = path.join(GOLD_DIR, "gold-topics-v0.5.jsonl");
const QRELS_FILE = path.join(GOLD_DIR, "gold-qrels-v0.5.jsonl");
// The hybrid run predates mode-suffixed filenames; keep its paths stable.
const suffix = LABEL_MODE === "hybrid" ? "" : `-${LABEL_MODE}`;
const CACHE_FILE = path.join(GOLD_DIR, `.retrieval-cache-v0.5${suffix}.jsonl`);
const REPORT_JSON = path.join(GOLD_DIR, `gold-eval-v0.5${suffix}-report.json`);
const REPORT_MD = path.join(GOLD_DIR, `gold-eval-v0.5${suffix}-report.md`);

const TOPIC_SET_LABEL = "Gold v0.5 (200 questions, 140/30/30)";
const RUN_LABEL = `${SYSTEM_ID} top-10 vs gold v0.5`;
const TOP_K = 10;

/* 1 + 2. Snapshot + topic set (idempotent by label). */
let topicSet = store.listTopicSets().find((s) => s.label === TOPIC_SET_LABEL);
if (topicSet) {
  console.log(`topic set exists: ${topicSet.id} (snapshot ${topicSet.snapshotId})`);
} else {
  const snapshot = store.createSnapshot({
    label: "corpus frozen 2026-08-07 for gold v0.5",
    note: "Snapshot bound to the official gold-topics-v0.5 evaluation.",
  });
  console.log(`snapshot created: ${snapshot.id} (${snapshot.nPassages} passages)`);
  const created = store.createTopicSet({
    label: TOPIC_SET_LABEL,
    snapshotId: snapshot.id,
    lines: readFileSync(TOPICS_FILE, "utf8"),
    note: "Official gold set v0.5 from the curated workbook (ingest-gold-workbook); scored against gold-qrels-v0.5.jsonl.",
  });
  if ("error" in created) throw new Error(`createTopicSet: ${created.error}`);
  topicSet = created;
  console.log(`topic set created: ${topicSet.id} (${topicSet.topics.length} topics)`);
}
const summary = store.topicSetSummary(topicSet);
console.log(`topic set summary: ${JSON.stringify(summary)}`);

/* 3. Retrieval, resumable per topic. */
loadDenseIndex();
console.log(`dense index ready: ${denseIndexReady()}`);

interface CachedLine {
  topic_id: string;
  passage_id: string;
  rank: number;
  score: number;
  mode: string;
}
const cached = new Map<string, CachedLine[]>();
if (existsSync(CACHE_FILE)) {
  for (const line of readFileSync(CACHE_FILE, "utf8").split("\n")) {
    if (!line.trim()) continue;
    const o = JSON.parse(line) as CachedLine;
    const arr = cached.get(o.topic_id) ?? [];
    arr.push(o);
    cached.set(o.topic_id, arr);
  }
  console.log(`resume cache: ${cached.size} topics already retrieved`);
}

let done = 0;
const modes = new Set<string>();
for (const t of topicSet.topics) {
  if (!cached.has(t.topic_id)) {
    const { hits, mode } = await retrieve(t.question, TOP_K, MODE);
    if (mode !== MODE) {
      throw new Error(`requested mode "${MODE}" but retrieve fell back to "${mode}" — is the dense index loaded?`);
    }
    modes.add(mode);
    const rows: CachedLine[] = hits.map((h, i) => ({
      topic_id: t.topic_id,
      passage_id: h.id,
      rank: i + 1,
      score: h.score,
      mode,
    }));
    appendFileSync(CACHE_FILE, rows.map((r) => JSON.stringify(r)).join("\n") + "\n");
    cached.set(t.topic_id, rows);
  } else {
    for (const r of cached.get(t.topic_id)!) modes.add(r.mode);
  }
  done++;
  if (done % 25 === 0) console.log(`${done}/${topicSet.topics.length} topics retrieved`);
}
console.log(`retrieval complete; modes used: ${[...modes].join(", ")}`);

/* 4. Register the run (idempotent by label). */
let run = store
  .listRuns()
  .find((r) => r.label === RUN_LABEL && r.topicSetId === topicSet.id);
if (run) {
  console.log(`run exists: ${run.id}`);
} else {
  const lines = topicSet.topics.flatMap((t) =>
    (cached.get(t.topic_id) ?? []).map(({ topic_id, passage_id, rank, score }) =>
      JSON.stringify({ topic_id, passage_id, rank, score }),
    ),
  );
  const created = store.createRun({
    systemId: SYSTEM_ID,
    label: RUN_LABEL,
    note: `${MODE_NOTE[LABEL_MODE]}, top ${TOP_K}, executed over gold-topics-v0.5; modes: ${[...modes].join(", ")}.`,
    snapshotId: topicSet.snapshotId,
    topicSetId: topicSet.id,
    lines: lines.join("\n"),
  });
  if ("error" in created) throw new Error(`createRun: ${created.error}`);
  run = created;
  console.log(`run created: ${run.id} (${run.lines.length} result lines)`);
}

/* 5. Score against the committed gold qrels. */
const qrels = parseGoldQrels(readFileSync(QRELS_FILE, "utf8"), topicSet.snapshotId);
if ("error" in qrels) throw new Error(`parseGoldQrels: ${qrels.error}`);
if (qrels.errors.length > 0) {
  console.log(`qrels warnings (${qrels.errors.length}):`);
  for (const e of qrels.errors) console.log(`  - ${e}`);
}
console.log(`qrels parsed: ${qrels.nRows} rows, ${qrels.topicIds.size} topics, ${qrels.relevantByTopic.size} with relevant passages`);

const score = scoreRunAgainstGoldQrels({ run, topicSet, qrels, k: TOP_K });
writeFileSync(REPORT_JSON, JSON.stringify(score, null, 1) + "\n");

const a = score.answerable;
const pct = (x: number) => (100 * x).toFixed(1) + "%";
const md = [
  `# Gold v0.5 evaluation report (${SYSTEM_ID})`,
  "",
  `- Generated: ${new Date().toISOString()}`,
  `- Topic set: ${score.topicSetId} (${TOPIC_SET_LABEL})`,
  `- Snapshot: ${score.snapshotId}`,
  `- Run: ${score.runId} (system \`${score.systemId}\`, top ${score.k}, modes: ${[...modes].join(", ")})`,
  `- Qrels: gold-qrels-v0.5.jsonl (${qrels.nRows} rows)`,
  "",
  "## Answerable topics",
  "",
  "| metric | value |",
  "| --- | --- |",
  `| topics | ${a.nTopics} (scored: ${a.nScored}) |`,
  ...Object.entries(a.excludedByReason).map(
    ([reason, n]) => `| excluded (${reason}) | ${n} |`,
  ),
  `| MRR | ${a.mrr.toFixed(4)} |`,
  `| recall@${a.k} | ${pct(a.recallAtK)} |`,
  `| nDCG@${a.k} | ${a.ndcgAtK.toFixed(4)} |`,
  `| hit@${a.k} | ${pct(a.hitAtK)} |`,
  "",
  "Topics excluded with reason `dataset_aggregate` are answerable corpus-",
  "statistics / synthesis questions whose gold answers are computed from the",
  "dataset as a whole; no single CTS passage attests them, so they carry a",
  "documented `no_gold_passage_reason` in the qrels instead of gold passages",
  "and sit outside the passage-retrieval metric denominators.",
  "",
  "## Abstention topics — per subtype (never merged)",
  "",
  "| subtype | topics | with gold evidence | evidence hit@" + score.k + " |",
  "| --- | --- | --- | --- |",
  ...score.abstainBySubtype.map(
    (s) => `| ${s.abstainType} | ${s.nTopics} | ${s.nWithEvidence} | ${s.evidenceHitAtK} |`,
  ),
  "",
  "Retrieval-only runs cannot abstain; for abstention subtypes this reports",
  "whether the gold evidence passages (where they exist — false-premise",
  "contradicting passages, homonym-roster passages) were surfaced in the top " + score.k + ".",
  "",
].join("\n");
writeFileSync(REPORT_MD, md);

console.log("");
console.log(`answerable: n=${a.nTopics} scored=${a.nScored} MRR=${a.mrr.toFixed(4)} recall@${a.k}=${pct(a.recallAtK)} nDCG@${a.k}=${a.ndcgAtK.toFixed(4)} hit@${a.k}=${pct(a.hitAtK)}`);
for (const s of score.abstainBySubtype) {
  console.log(`abstain[${s.abstainType}]: topics=${s.nTopics} withEvidence=${s.nWithEvidence} evidenceHit@${score.k}=${s.evidenceHitAtK}`);
}
console.log(`report written: ${REPORT_MD}`);
console.log("Done. Restart the API Server workflow so it reloads the eval store.");

export {};
