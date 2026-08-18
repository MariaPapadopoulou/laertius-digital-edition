/**
 * prepare-expert-judging — executes the Laertius retrieval system over the
 * gold topic set and prepares the expert-judging queue in the eval store:
 *   1. a run (hybrid retrieval, top 10 per topic) for the snapshot-bound
 *      topic set,
 *   2. a pool (depth 5, 2 judgments per item),
 *   3. a first batch of 50 items for the expert annotator.
 *
 * Run from the workspace root:
 *   pnpm --filter @workspace/scripts exec tsx src/prepare-expert-judging.ts
 * Then restart the API Server workflow so it reloads the eval store.
 */
import path from "node:path";
import { readFileSync } from "node:fs";

process.env["LAERTIUS_DATA_DIR"] ??= path.resolve(
  import.meta.dirname,
  "../../artifacts/api-server/data",
);

const dataDir = process.env["LAERTIUS_DATA_DIR"]!;
const { loadDenseIndex, denseIndexReady } = await import(
  "../../artifacts/api-server/src/lib/dense"
);
const { retrieve } = await import("../../artifacts/api-server/src/lib/rag");
const { createRun, createPool, createBatch, listRuns, listPools } =
  await import("../../artifacts/api-server/src/lib/eval/store");

const ANNOTATOR = "maria";
const TOP_K = 10;
const DEPTH = 5;
const BATCH_SIZE = 50;

if (listRuns().length > 0 || listPools().length > 0) {
  console.log("Runs or pools already exist — refusing to duplicate. Inspect the eval app.");
  process.exit(1);
}

const topicSetFile = path.join(
  dataDir,
  "eval/topic-sets/topics-msfn6nxo-f66abd.json",
);
const topicSet = JSON.parse(readFileSync(topicSetFile, "utf8")) as {
  id: string;
  snapshotId: string;
  topics: { topic_id: string; question: string }[];
};

loadDenseIndex();
console.log(`dense index ready: ${denseIndexReady()}`);

const lines: string[] = [];
let done = 0;
for (const t of topicSet.topics) {
  const { hits, mode } = await retrieve(t.question, TOP_K, "hybrid");
  hits.forEach((h, i) => {
    lines.push(
      JSON.stringify({
        topic_id: t.topic_id,
        passage_id: h.id,
        rank: i + 1,
        score: h.score,
      }),
    );
  });
  done++;
  if (done % 25 === 0) console.log(`${done}/${topicSet.topics.length} topics retrieved (mode=${mode})`);
}

const run = createRun({
  systemId: "laertius-hybrid",
  label: "Laertius hybrid retrieval, top 10",
  note: "BM25 + dense RRF with knowledge-graph boost, executed over the gold topic set for expert judging.",
  snapshotId: topicSet.snapshotId,
  topicSetId: topicSet.id,
  lines: lines.join("\n"),
});
if ("error" in run) throw new Error(`createRun: ${run.error}`);
console.log(`run created: ${run.id} (${lines.length} lines)`);

const pool = createPool({
  label: "Expert judging pool (depth 5)",
  runIds: [run.id],
  depth: DEPTH,
  judgmentsPerItem: 2,
});
if ("error" in pool) throw new Error(`createPool: ${pool.error}`);
console.log(`pool created: ${pool.id} (${pool.items.length} items)`);

const batch = createBatch({ poolId: pool.id, annotator: ANNOTATOR, size: BATCH_SIZE });
if ("error" in batch) throw new Error(`createBatch: ${batch.error}`);
console.log(`batch created: ${batch.id} (${batch.itemIds.length} items for ${ANNOTATOR})`);
console.log("Expert judging is ready. Restart the API Server workflow.");

export {};
