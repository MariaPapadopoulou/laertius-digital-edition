/**
 * Functional test for the per-judge authorization boundary of the eval
 * workbench. Boots the real express app on an ephemeral port against a
 * seeded temp data dir and proves over HTTP that:
 *
 *  1. Judge batch listing (/api/eval/judge/batches) rejects missing/unknown
 *     access keys and only ever returns the presenting judge's batches.
 *  2. Batch fetch (/api/eval/batches/:id) rejects missing keys (401) and
 *     other judges' keys (403).
 *  3. Judgment submission (/api/eval/judgments) rejects a token/annotator
 *     mismatch (403), unknown tokens (401) and missing tokens (400) —
 *     nobody can submit under another expert's judge code.
 *  4. Coordinator/management endpoints (e.g. /api/eval/pools) refuse judge
 *     credentials outright and require the coordinator's own password, so a
 *     judge can never enumerate pools or harvest other judges' tokens.
 *
 * Prints "ALL PASS" and exits 0 on success; prints FAIL and exits 1
 * otherwise.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "eval-auth-"));
process.env["LAERTIUS_DATA_DIR"] = tmp;
process.env["EVAL_COORDINATOR_PASSWORD"] = "test-coordinator-pass";
// The outer shared gate stays UNSET here: the point of this suite is that
// the per-judge and coordinator layers hold even without it.
delete process.env["EVAL_ACCESS_PASSWORD"];

// The full app boots here (corpus, verses, LOD, … load eagerly at import
// time), so expose the ENTIRE real data dir via symlinks — except eval/,
// which gets a fresh seeded copy so this suite never touches real batches
// or tokens.
const realData = path.resolve(import.meta.dirname, "../data");
for (const entry of fs.readdirSync(realData)) {
  if (entry === "eval") continue;
  fs.symlinkSync(path.join(realData, entry), path.join(tmp, entry));
}

const evalDir = path.join(tmp, "eval");
for (const d of ["pools", "judgments", "batches", "adjudications", "snapshots", "topic-sets"])
  fs.mkdirSync(path.join(evalDir, d), { recursive: true });

// Minimal snapshot + topic set so batchJudgeItems can build judge views.
fs.writeFileSync(
  path.join(evalDir, "snapshots", "s.json"),
  JSON.stringify({ id: "s", label: "test snapshot", createdAt: new Date().toISOString() }),
);
fs.writeFileSync(
  path.join(evalDir, "snapshots", "s.corpus.jsonl"),
  ["A", "B", "C"]
    .map((k) => JSON.stringify({ id: k, urn: `urn:test:${k}`, text: `κείμενο ${k}` }))
    .join("\n"),
);
fs.writeFileSync(
  path.join(evalDir, "topic-sets", "ts.json"),
  JSON.stringify({
    id: "ts",
    label: "test topics",
    snapshotId: "s",
    createdAt: new Date().toISOString(),
    topics: [{ topic_id: "t1", question: "test question", split: "test" }],
  }),
);

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
function seedBatch(id: string, annotator: string, itemIds: string[]) {
  fs.writeFileSync(
    path.join(evalDir, "batches", `${id}.json`),
    JSON.stringify({ id, poolId, annotator, createdAt: new Date().toISOString(), itemIds }),
  );
}
const allIds = items.map((i) => i.itemId);
seedBatch("batch_mp", "MP", allIds);
seedBatch("batch_rg", "RG", allIds);

const store = await import("../src/lib/eval/store");
const mpToken = store.ensureJudgeToken("MP");
const rgToken = store.ensureJudgeToken("RG");

const { default: app } = await import("../src/app");
const server = app.listen(0);
await new Promise<void>((resolve) => server.once("listening", () => resolve()));
const addr = server.address();
if (addr === null || typeof addr === "string") throw new Error("no port");
const base = `http://127.0.0.1:${addr.port}`;

let failures = 0;
function check(name: string, cond: boolean, detail = ""): void {
  if (cond) console.log(`ok: ${name}`);
  else {
    failures++;
    console.error(`FAIL: ${name}${detail ? ` — ${detail}` : ""}`);
  }
}
const coordAuth = {
  Authorization: `Basic ${Buffer.from("c:test-coordinator-pass").toString("base64")}`,
};

// 1. judge batch listing
{
  const r = await fetch(`${base}/api/eval/judge/batches`);
  check("judge/batches without token → 401", r.status === 401, `got ${r.status}`);
  const r2 = await fetch(`${base}/api/eval/judge/batches`, { headers: { "X-Judge-Token": "bogus" } });
  check("judge/batches with unknown token → 401", r2.status === 401, `got ${r2.status}`);
  const r3 = await fetch(`${base}/api/eval/judge/batches`, { headers: { "X-Judge-Token": mpToken } });
  check("judge/batches with MP token → 200", r3.status === 200, `got ${r3.status}`);
  const body = (await r3.json()) as { annotator: string; batches: Array<Record<string, unknown>> };
  check("MP listing resolves annotator MP", body.annotator === "MP");
  check(
    "MP listing contains only MP batches",
    body.batches.length === 1 && body.batches[0]!["id"] === "batch_mp",
    JSON.stringify(body.batches.map((b) => b["id"])),
  );
  check(
    "MP listing leaks no judgeToken fields",
    body.batches.every((b) => !("judgeToken" in b)),
  );
}

// 2. batch fetch
{
  const r = await fetch(`${base}/api/eval/batches/batch_mp`);
  check("batch fetch without token → 401", r.status === 401, `got ${r.status}`);
  const r2 = await fetch(`${base}/api/eval/batches/batch_mp`, { headers: { "X-Judge-Token": rgToken } });
  check("batch fetch with ANOTHER judge's token → 403", r2.status === 403, `got ${r2.status}`);
  const r3 = await fetch(`${base}/api/eval/batches/batch_mp`, { headers: { "X-Judge-Token": mpToken } });
  check("batch fetch with owner's token → 200", r3.status === 200, `got ${r3.status}`);
}

// 3. judgment submission identity binding
{
  const line = JSON.stringify({
    item_id: `${poolId}:t1:A`, topic_id: "t1", passage_id: "A",
    task: "relevance", grade: 2, annotator: "MP",
  });
  const post = (bodyObj: unknown) =>
    fetch(`${base}/api/eval/judgments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(bodyObj),
    });
  const r = await post({ annotator: "MP", batchId: "batch_mp", lines: line });
  check("submit without token → 400", r.status === 400, `got ${r.status}`);
  const r2 = await post({ annotator: "MP", token: "bogus", batchId: "batch_mp", lines: line });
  check("submit with unknown token → 401", r2.status === 401, `got ${r2.status}`);
  const r3 = await post({ annotator: "MP", token: rgToken, batchId: "batch_mp", lines: line });
  check(
    "submit as MP with RG's token → 403 (cannot judge under another expert's code)",
    r3.status === 403,
    `got ${r3.status}`,
  );
  const r4 = await post({ annotator: "MP", token: mpToken, batchId: "batch_mp", lines: line });
  check("submit as MP with MP's token → 201", r4.status === 201, `got ${r4.status}`);
}

// 4. coordinator boundary
{
  const r = await fetch(`${base}/api/eval/pools`);
  check("coordinator endpoint without credentials → 401", r.status === 401, `got ${r.status}`);
  const r2 = await fetch(`${base}/api/eval/pools`, { headers: { "X-Judge-Token": mpToken } });
  check("coordinator endpoint with a JUDGE token → 401", r2.status === 401, `got ${r2.status}`);
  const r3 = await fetch(`${base}/api/eval/pools`, { headers: coordAuth });
  check("coordinator endpoint with coordinator password → 200", r3.status === 200, `got ${r3.status}`);
  const r4 = await fetch(`${base}/api/eval/pools/${poolId}/batches`, { headers: coordAuth });
  check("coordinator batch listing → 200", r4.status === 200, `got ${r4.status}`);
  const list = (await r4.json()) as Array<Record<string, unknown>>;
  check(
    "coordinator batch listing discloses judge tokens (for personal links)",
    list.every((b) => typeof b["judgeToken"] === "string" && (b["judgeToken"] as string).length > 0),
  );
}

server.close();
if (failures === 0) {
  console.log("ALL PASS");
  process.exit(0);
} else {
  console.error(`${failures} FAILURES`);
  process.exit(1);
}
