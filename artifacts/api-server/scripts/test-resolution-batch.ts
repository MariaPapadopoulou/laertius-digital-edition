/**
 * Functional test for task: resolution batches (third judge on 2-judge
 * disagreement). Seeds a temp data dir with a pool, judgments and batches,
 * then exercises createBatch({resolution}), poolCoverage, poolDisagreements
 * and poolQrels.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "eval-res-"));
process.env["LAERTIUS_DATA_DIR"] = tmp;
// corpus.ts loads the sections file eagerly at import time
const realData = path.resolve(import.meta.dirname, "../data");
fs.copyFileSync(
  path.join(realData, "laertius_sections.jsonl"),
  path.join(tmp, "laertius_sections.jsonl"),
);

const {
  createBatch, poolCoverage, poolDisagreements, poolQrels, getPool, ingestJudgments,
  revokeBatch, saveAdjudication,
} = await import("../src/lib/eval/store");

const evalDir = path.join(tmp, "eval");
for (const d of ["pools", "judgments", "batches", "adjudications", "snapshots", "topic-sets"])
  fs.mkdirSync(path.join(evalDir, d), { recursive: true });

const poolId = "pool_test";
const items = ["A", "B", "C"].map((k) => ({
  itemId: `${poolId}:t1:${k}`,
  topicId: "t1",
  passageId: k,
  fromRuns: ["r1"],
}));
fs.writeFileSync(
  path.join(evalDir, "pools", `${poolId}.json`),
  JSON.stringify({
    id: poolId, label: "test", snapshotId: "s", topicSetId: "ts",
    runIds: ["r1"], depth: 3, judgmentsPerItem: 2,
    createdAt: new Date().toISOString(), items,
  }),
);

// Original two batches covering all items for judges MP and RG
function seedBatch(id: string, annotator: string, itemIds: string[], resolution = false) {
  fs.writeFileSync(
    path.join(evalDir, "batches", `${id}.json`),
    JSON.stringify({ id, poolId, annotator, createdAt: new Date().toISOString(), itemIds, ...(resolution ? { resolution: true } : {}) }),
  );
}
const allIds = items.map((i) => i.itemId);
seedBatch("batch_mp", "MP", allIds);
seedBatch("batch_rg", "RG", allIds);

function seedJudgments(uploadId: string, annotator: string, batchId: string, grades: Record<string, string>) {
  fs.writeFileSync(
    path.join(evalDir, "judgments", `${uploadId}.json`),
    JSON.stringify({
      id: uploadId, annotator, batchId, createdAt: new Date().toISOString(),
      seq: uploadId.padStart(24, "0"),
      judgments: Object.entries(grades).map(([item_id, grade]) => ({
        item_id, task: "relevance", annotator, batch_id: batchId, grade,
      })),
    }),
  );
}
// A: agree (2,2). B: disagree (3 vs 0). C: disagree (1 vs 2).
seedJudgments("u1", "MP", "batch_mp", { [allIds[0]!]: "2", [allIds[1]!]: "3", [allIds[2]!]: "1" });
seedJudgments("u2", "RG", "batch_rg", { [allIds[0]!]: "2", [allIds[1]!]: "0", [allIds[2]!]: "2" });

let failures = 0;
function check(name: string, cond: boolean, extra?: unknown) {
  if (cond) console.log(`PASS ${name}`);
  else { failures++; console.error(`FAIL ${name}`, extra ?? ""); }
}

const pool = getPool(poolId)!;

// 1. Before escalation: two deadlocks, no awaiting_third
let dis = poolDisagreements(pool);
check("two deadlocks before escalation", dis.length === 2 && dis.every((d) => d.resolution === "deadlock"), dis);
let cov = poolCoverage(pool);
check("coverage: needsArbitration=2, awaitingThirdJudge=0",
  cov.summary.needsArbitration === 2 && cov.summary.awaitingThirdJudge === 0, cov.summary);

// 2. Resolution batch to an original judge is rejected
const rej = createBatch({ poolId, annotator: "MP", resolution: true });
check("resolution batch rejected for original judge", "error" in rej, rej);

// 3. Resolution batch to fresh judge picks exactly the two deadlocked items
const res = createBatch({ poolId, annotator: "ZK", resolution: true });
check("resolution batch issued", !("error" in res), res);
if (!("error" in res)) {
  check("resolution flag set", res.resolution === true);
  check("only deadlocked items", res.itemIds.sort().join() === [allIds[1], allIds[2]].sort().join(), res.itemIds);
}

// 4. Now items are awaiting third judge, not deadlocked
dis = poolDisagreements(pool);
check("both awaiting_third after issue", dis.length === 2 && dis.every((d) => d.resolution === "awaiting_third"), dis.map((d) => d.resolution));
cov = poolCoverage(pool);
check("coverage: needsArbitration=0, awaitingThirdJudge=2",
  cov.summary.needsArbitration === 0 && cov.summary.awaitingThirdJudge === 2, cov.summary);
check("coverage: complete drops to 1 (A only)", cov.summary.complete === 1, cov.summary);

// 5. A second resolution batch for another fresh judge finds nothing (slot taken)
const res2 = createBatch({ poolId, annotator: "XY", resolution: true });
check("no double escalation", "error" in res2, res2);

// 6. Third judge ingests via the real ingest path; majority resolves B, C
if (!("error" in res)) {
  const lines = [
    JSON.stringify({ item_id: allIds[1], task: "relevance", grade: "3", batch_id: res.id }),
    JSON.stringify({ item_id: allIds[2], task: "relevance", grade: "2", batch_id: res.id }),
  ].join("\n");
  const ing = ingestJudgments({ annotator: "ZK", batchId: res.id, lines });
  check("ingest accepted", !("error" in ing) && ing.accepted === 2, ing);
}
dis = poolDisagreements(pool);
check("disagreements empty after majority", dis.length === 0, dis);
cov = poolCoverage(pool);
check("coverage: majority=2, unanimous=1, arbitration=0, awaiting=0, complete=3",
  cov.summary.majority === 2 && cov.summary.unanimous === 1 &&
  cov.summary.needsArbitration === 0 && cov.summary.awaitingThirdJudge === 0 &&
  cov.summary.complete === 3, cov.summary);

// 7. qrels use the majority grades
const qrels = poolQrels(pool);
check("qrels B=3", qrels.includes("t1 0 B 3"), qrels);
check("qrels C=2", qrels.includes("t1 0 C 2"), qrels);
check("qrels A=2", qrels.includes("t1 0 A 2"), qrels);
check("qrels unresolved=0", qrels.includes("unresolved_items=0"), qrels);

// 8. Non-resolution pools (judgmentsPerItem=2) untouched: normal batch for ZK finds nothing new
const normal = createBatch({ poolId, annotator: "QQ" });
check("normal batch finds nothing (all engaged)", "error" in normal, normal);

/* ------------------------------------------------------------------ */
/* Revocation: a stalled resolution batch releases its unjudged items   */
/* ------------------------------------------------------------------ */

// Second pool with the same shape: A2 agree, B2/C2 deadlocked.
const pool2Id = "pool_revoke";
const items2 = ["A2", "B2", "C2"].map((k) => ({
  itemId: `${pool2Id}:t1:${k}`,
  topicId: "t1",
  passageId: k,
  fromRuns: ["r1"],
}));
fs.writeFileSync(
  path.join(evalDir, "pools", `${pool2Id}.json`),
  JSON.stringify({
    id: pool2Id, label: "revoke test", snapshotId: "s", topicSetId: "ts",
    runIds: ["r1"], depth: 3, judgmentsPerItem: 2,
    createdAt: new Date().toISOString(), items: items2,
  }),
);
const all2 = items2.map((i) => i.itemId);
function seedBatch2(id: string, annotator: string, itemIds: string[]) {
  fs.writeFileSync(
    path.join(evalDir, "batches", `${id}.json`),
    JSON.stringify({ id, poolId: pool2Id, annotator, createdAt: new Date().toISOString(), itemIds }),
  );
}
seedBatch2("batch2_mp", "MP", all2);
seedBatch2("batch2_rg", "RG", all2);
seedJudgments("u3", "MP", "batch2_mp", { [all2[0]!]: "2", [all2[1]!]: "3", [all2[2]!]: "1" });
seedJudgments("u4", "RG", "batch2_rg", { [all2[0]!]: "2", [all2[1]!]: "0", [all2[2]!]: "2" });

const pool2 = getPool(pool2Id)!;

// 9. Escalate to a third judge who then never uploads
const res3 = createBatch({ poolId: pool2Id, annotator: "ZK", resolution: true });
check("revoke scenario: resolution batch issued", !("error" in res3), res3);
let dis2 = poolDisagreements(pool2);
check("revoke scenario: both awaiting_third", dis2.length === 2 && dis2.every((d) => d.resolution === "awaiting_third"), dis2.map((d) => d.resolution));

// 10. Arbiter may rule WHILE the item is awaiting the third judge; the
// adjudication wins immediately (resolveItem precedence).
if (!("error" in res3)) {
  const adjEarly = saveAdjudication({ poolId: pool2Id, itemId: all2[1]!, grade: "3", arbiter: "admin", note: "ruled while awaiting third" });
  check("adjudication accepted while awaiting_third", !("error" in adjEarly), adjEarly);
  dis2 = poolDisagreements(pool2);
  const b2 = dis2.find((d) => d.itemId === all2[1]);
  check("adjudicated item resolves despite pending third judge", b2?.resolution === "adjudicated", b2);
}

// 11. Revoke the stalled batch: the still-unjudged item (C2) returns to
// the arbiter's queue as a plain deadlock.
if (!("error" in res3)) {
  const revoked = revokeBatch(res3.id);
  check("revoke succeeds", !("error" in revoked) && !!(revoked as { revokedAt?: string }).revokedAt, revoked);
  const twice = revokeBatch(res3.id);
  check("second revoke rejected with 409", "error" in twice && twice.status === 409, twice);
}
dis2 = poolDisagreements(pool2);
const c2 = dis2.find((d) => d.itemId === all2[2]);
check("unjudged item back to deadlock after revoke", c2?.resolution === "deadlock", c2);
let cov2 = poolCoverage(pool2);
check("coverage after revoke: needsArbitration=1, awaitingThirdJudge=0",
  cov2.summary.needsArbitration === 1 && cov2.summary.awaitingThirdJudge === 0, cov2.summary);

// 12. The freed item can be re-issued to another fresh judge (the revoked
// batch no longer blocks the third slot), and their judgment resolves it.
const res4 = createBatch({ poolId: pool2Id, annotator: "XY", resolution: true });
check("re-issue after revoke succeeds", !("error" in res4), res4);
if (!("error" in res4)) {
  check("re-issue picks only the freed item", res4.itemIds.join() === all2[2], res4.itemIds);
  const ing2 = ingestJudgments({
    annotator: "XY", batchId: res4.id,
    lines: JSON.stringify({ item_id: all2[2], task: "relevance", grade: "2", batch_id: res4.id }),
  });
  check("re-issued judge ingest accepted", !("error" in ing2) && ing2.accepted === 1, ing2);
}
dis2 = poolDisagreements(pool2);
check("only adjudicated audit row remains", dis2.length === 1 && dis2[0]!.resolution === "adjudicated", dis2.map((d) => d.resolution));
cov2 = poolCoverage(pool2);
check("final coverage: majority=1, adjudicated=1, unanimous=1, arbitration=0, awaiting=0",
  cov2.summary.majority === 1 && cov2.summary.adjudicated === 1 && cov2.summary.unanimous === 1 &&
  cov2.summary.needsArbitration === 0 && cov2.summary.awaitingThirdJudge === 0, cov2.summary);
const qrels2 = poolQrels(pool2);
check("qrels2 unresolved=0", qrels2.includes("unresolved_items=0"), qrels2);

fs.rmSync(tmp, { recursive: true, force: true });
console.log(failures === 0 ? "ALL PASS" : `${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);
