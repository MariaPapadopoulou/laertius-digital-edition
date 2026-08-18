/**
 * Evaluation infrastructure endpoints: frozen corpus snapshots, topic
 * sets, system runs, blind judgment pools, judge batches, judgment
 * ingest, inter-annotator agreement, adjudication and qrels export.
 *
 * Blinding invariant: everything served to the judge environment
 * (batches) is stripped of system identity, run ids, ranks and scores
 * inside lib/eval/store.ts (batchJudgeItems); this router never adds
 * provenance back.
 */
import { Router, type IRouter } from "express";
import {
  GetEvalOverviewResponse,
  CreateEvalSnapshotBody,
  CreateEvalSnapshotResponse,
  ListEvalSnapshotsResponse,
  GetEvalSnapshotResponse,
  CreateEvalTopicSetBody,
  CreateEvalTopicSetResponse,
  ListEvalTopicSetsResponse,
  GetEvalTopicSetResponse,
  CreateEvalRunBody,
  CreateEvalRunResponse,
  ListEvalRunsResponse,
  GetEvalRunGoldScoreResponse,
  CreateEvalPoolBody,
  CreateEvalPoolResponse,
  ListEvalPoolsResponse,
  GetEvalPoolResponse,
  GetEvalPoolCoverageResponse,
  ListEvalBatchesResponse,
  ListEvalJudgeBatchesResponse,
  CreateEvalBatchBody,
  CreateEvalBatchResponse,
  GetEvalBatchResponse,
  RevokeEvalBatchResponse,
  UploadEvalJudgmentsBody,
  UploadEvalJudgmentsResponse,
  ListEvalJudgmentUploadsResponse,
  GetEvalPoolAgreementResponse,
  ListEvalPoolDisagreementsResponse,
  CreateEvalAdjudicationBody,
  CreateEvalAdjudicationResponse,
} from "@workspace/api-zod";
import {
  evalOverview,
  createSnapshot,
  listSnapshots,
  getSnapshot,
  getSnapshotCorpusRaw,
  snapshotByBook,
  createTopicSet,
  listTopicSets,
  getTopicSet,
  topicSetSummary,
  createRun,
  listRuns,
  runSummary,
  createPool,
  listPools,
  getPool,
  poolSummary,
  poolCoverage,
  listBatches,
  allBatchSummaries,
  createBatch,
  getBatch,
  batchJudgeItems,
  batchSummary,
  revokeBatch,
  ingestJudgments,
  listJudgmentUploads,
  poolAgreement,
  poolDisagreements,
  saveAdjudication,
  poolQrels,
  ensureJudgeToken,
  annotatorForJudgeToken,
} from "../lib/eval/store";
import { getRun } from "../lib/eval/store";
import {
  loadCurrentGoldQrels,
  parseGoldQrels,
  scoreRunAgainstGoldQrels,
} from "../lib/eval/goldScoring";
import type { Request } from "express";
import { evalCoordinatorAuth } from "../lib/eval-auth";

const router: IRouter = Router();

/**
 * Coordinator gate: every eval endpoint EXCEPT the three judge-facing ones
 * requires the coordinator's own HTTP Basic password
 * (EVAL_COORDINATOR_PASSWORD; fail-closed when unset). The judge-facing
 * endpoints are exempt because they enforce the per-judge access token
 * themselves — a judge must never need (or be able to use) coordinator
 * credentials, and coordinator-only responses are what disclose judge
 * tokens. The exemption list matches on the SAME decoded req.path Express
 * routes on, so an exempted request can only ever reach the corresponding
 * token-enforcing handler.
 */
const JUDGE_FACING = [
  { method: "GET", pattern: /^\/eval\/judge\/batches$/ },
  { method: "GET", pattern: /^\/eval\/batches\/[^/]+$/ },
  { method: "POST", pattern: /^\/eval\/judgments$/ },
];
const coordinatorGate = evalCoordinatorAuth();
router.use((req, res, next) => {
  const exempt = JUDGE_FACING.some(
    (r) => r.method === req.method && r.pattern.test(req.path),
  );
  if (exempt) {
    next();
    return;
  }
  coordinatorGate(req, res, next);
});

/**
 * Per-judge credential for judge-facing endpoints. The token travels
 * ONLY as the `X-Judge-Token` header — API query parameters are not
 * accepted, so API URLs never carry the credential. It is minted per
 * judge code when a batch is first issued (see ensureJudgeToken) and
 * resolves back to exactly one judge code.
 */
function presentedJudgeToken(req: Request): string {
  const h = req.headers["x-judge-token"];
  return typeof h === "string" ? h : "";
}

router.get("/eval/overview", (req, res) => {
  try {
    res.json(GetEvalOverviewResponse.parse(evalOverview()));
  } catch (err) {
    req.log.error({ err }, "eval overview failed");
    res.status(500).json({ error: "Failed to build eval overview" });
  }
});

/* Snapshots */

router.get("/eval/snapshots", (req, res) => {
  try {
    res.json(ListEvalSnapshotsResponse.parse(listSnapshots()));
  } catch (err) {
    req.log.error({ err }, "list snapshots failed");
    res.status(500).json({ error: "Failed to list snapshots" });
  }
});

router.post("/eval/snapshots", (req, res) => {
  const parsed = CreateEvalSnapshotBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid body" });
    return;
  }
  try {
    res.status(201).json(CreateEvalSnapshotResponse.parse(createSnapshot(parsed.data)));
  } catch (err) {
    req.log.error({ err }, "create snapshot failed");
    res.status(500).json({ error: "Failed to create snapshot" });
  }
});

router.get("/eval/snapshots/:id", (req, res) => {
  const meta = getSnapshot(req.params.id);
  const byBook = meta ? snapshotByBook(meta.id) : null;
  if (!meta || !byBook) {
    res.status(404).json({ error: "Snapshot not found" });
    return;
  }
  res.json(GetEvalSnapshotResponse.parse({ ...meta, byBook }));
});

router.get("/eval/snapshots/:id/corpus.jsonl", (req, res) => {
  const raw = getSnapshotCorpusRaw(req.params.id);
  if (raw === null) {
    res.status(404).json({ error: "Snapshot not found" });
    return;
  }
  res
    .type("application/x-ndjson")
    .setHeader(
      "Content-Disposition",
      `attachment; filename="${req.params.id}-corpus.jsonl"`,
    )
    .send(raw);
});

/* Topic sets */

router.get("/eval/topic-sets", (req, res) => {
  try {
    res.json(ListEvalTopicSetsResponse.parse(listTopicSets().map(topicSetSummary)));
  } catch (err) {
    req.log.error({ err }, "list topic sets failed");
    res.status(500).json({ error: "Failed to list topic sets" });
  }
});

router.post("/eval/topic-sets", (req, res) => {
  const parsed = CreateEvalTopicSetBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid body" });
    return;
  }
  const result = createTopicSet(parsed.data);
  if ("error" in result) {
    res.status(400).json({ error: result.error });
    return;
  }
  res.status(201).json(CreateEvalTopicSetResponse.parse(topicSetSummary(result)));
});

router.get("/eval/topic-sets/:id", (req, res) => {
  const set = getTopicSet(req.params.id);
  if (!set) {
    res.status(404).json({ error: "Topic set not found" });
    return;
  }
  res.json(GetEvalTopicSetResponse.parse({ ...topicSetSummary(set), topics: set.topics }));
});

/* Runs */

router.get("/eval/runs", (req, res) => {
  try {
    res.json(ListEvalRunsResponse.parse(listRuns().map(runSummary)));
  } catch (err) {
    req.log.error({ err }, "list runs failed");
    res.status(500).json({ error: "Failed to list runs" });
  }
});

router.post("/eval/runs", (req, res) => {
  const parsed = CreateEvalRunBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid body" });
    return;
  }
  const result = createRun(parsed.data);
  if ("error" in result) {
    res.status(400).json({ error: result.error });
    return;
  }
  res.status(201).json(CreateEvalRunResponse.parse(runSummary(result)));
});

/**
 * Gold-qrels scoring for a run: MRR / recall@k / nDCG@k / hit@k over the
 * answerable topics, plus the abstention breakdown reported PER SUBTYPE
 * (out_of_corpus, false_premise, underspecified_homonym) — never merged
 * (see lib/eval/goldScoring.ts and validate-abstain-reporting).
 */
router.get("/eval/runs/:id/gold-score", (req, res) => {
  const run = getRun(req.params.id);
  if (!run) {
    res.status(404).json({ error: "Run not found" });
    return;
  }
  const topicSet = getTopicSet(run.topicSetId);
  if (!topicSet) {
    res.status(409).json({ error: `Run's topic set ${run.topicSetId} no longer exists` });
    return;
  }
  const gold = loadCurrentGoldQrels();
  if ("error" in gold) {
    res.status(409).json({ error: gold.error });
    return;
  }
  const qrels = parseGoldQrels(gold.lines, run.snapshotId);
  if ("error" in qrels) {
    res.status(409).json({ error: qrels.error });
    return;
  }
  const kRaw = Number(req.query["k"]);
  const k =
    Number.isInteger(kRaw) && kRaw >= 1 && kRaw <= 100 ? kRaw : 10;
  try {
    const score = scoreRunAgainstGoldQrels({ run, topicSet, qrels, k });
    res.json(
      GetEvalRunGoldScoreResponse.parse({
        ...score,
        goldVersion: gold.version,
        qrelsRows: qrels.nRows,
        qrelsTopics: qrels.topicIds.size,
        qrelsErrors: qrels.errors,
      }),
    );
  } catch (err) {
    req.log.error({ err }, "gold score failed");
    res.status(500).json({ error: "Failed to score run against gold qrels" });
  }
});

/* Pools */

router.get("/eval/pools", (req, res) => {
  try {
    res.json(ListEvalPoolsResponse.parse(listPools().map(poolSummary)));
  } catch (err) {
    req.log.error({ err }, "list pools failed");
    res.status(500).json({ error: "Failed to list pools" });
  }
});

router.post("/eval/pools", (req, res) => {
  const parsed = CreateEvalPoolBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid body" });
    return;
  }
  const result = createPool(parsed.data);
  if ("error" in result) {
    res.status(400).json({ error: result.error });
    return;
  }
  res.status(201).json(CreateEvalPoolResponse.parse(poolSummary(result)));
});

router.get("/eval/pools/:id", (req, res) => {
  const pool = getPool(req.params.id);
  if (!pool) {
    res.status(404).json({ error: "Pool not found" });
    return;
  }
  const depthPerTopic = new Map<string, number>();
  for (const item of pool.items) {
    depthPerTopic.set(item.topicId, (depthPerTopic.get(item.topicId) ?? 0) + 1);
  }
  const coverage = poolCoverage(pool);
  res.json(
    GetEvalPoolResponse.parse({
      ...poolSummary(pool),
      depthPerTopic: [...depthPerTopic.entries()]
        .map(([topicId, poolSize]) => ({ topicId, poolSize }))
        .sort((a, b) => a.topicId.localeCompare(b.topicId)),
      coverageSummary: coverage.summary,
    }),
  );
});

router.get("/eval/pools/:id/coverage", (req, res) => {
  const pool = getPool(req.params.id);
  if (!pool) {
    res.status(404).json({ error: "Pool not found" });
    return;
  }
  res.json(GetEvalPoolCoverageResponse.parse(poolCoverage(pool)));
});

/* Batches. There is deliberately no unauthenticated "list every batch"
   endpoint: judges list their own via the token-scoped /eval/judge/batches,
   and coordinators list per pool via /eval/pools/:id/batches. */

router.get("/eval/pools/:id/batches", (req, res) => {
  const pool = getPool(req.params.id);
  if (!pool) {
    res.status(404).json({ error: "Pool not found" });
    return;
  }
  // Coordinator view: include each judge's token so the coordinator can
  // copy the personal link. This endpoint sits behind the shared
  // EVAL_ACCESS_PASSWORD gate; judges use /eval/judge/batches instead.
  res.json(
    ListEvalBatchesResponse.parse(
      listBatches(pool.id).map((b) => ({
        ...batchSummary(b),
        // Mint on demand so batches issued before token support (or after a
        // token-store reset) still yield a copyable personal link.
        judgeToken: ensureJudgeToken(b.annotator),
      })),
    ),
  );
});

router.post("/eval/pools/:id/batches", (req, res) => {
  const parsed = CreateEvalBatchBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid body" });
    return;
  }
  const result = createBatch({ poolId: req.params.id, ...parsed.data });
  if ("error" in result) {
    res.status(result.status).json({ error: result.error });
    return;
  }
  const items = batchJudgeItems(result);
  if (!items) {
    res.status(500).json({ error: "Failed to assemble batch items" });
    return;
  }
  res.status(201).json(
    CreateEvalBatchResponse.parse({
      id: result.id,
      poolId: result.poolId,
      annotator: result.annotator,
      createdAt: result.createdAt,
      // Mint (or reuse) the judge's personal token so the coordinator can
      // hand out the personal link straight from the creation response.
      judgeToken: ensureJudgeToken(result.annotator),
      items,
    }),
  );
});

/* Judge-facing: list only the presenting judge's batches. */

router.get("/eval/judge/batches", (req, res) => {
  const annotator = annotatorForJudgeToken(presentedJudgeToken(req));
  if (!annotator) {
    res.status(401).json({ error: "Unknown or missing access key" });
    return;
  }
  try {
    const batches = allBatchSummaries().filter((b) => b.annotator === annotator);
    res.json(ListEvalJudgeBatchesResponse.parse({ annotator, batches }));
  } catch (err) {
    req.log.error({ err }, "list judge batches failed");
    res.status(500).json({ error: "Failed to list batches" });
  }
});

router.get("/eval/batches/:id", (req, res) => {
  // Per-judge credential: only the judge the batch was issued to may load
  // its items. A valid token for a DIFFERENT judge is a 403, so batch ids
  // alone are no longer enough to see (or work) someone else's batch.
  const annotator = annotatorForJudgeToken(presentedJudgeToken(req));
  if (!annotator) {
    res.status(401).json({ error: "Unknown or missing access key" });
    return;
  }
  const batch = getBatch(req.params.id);
  const items = batch ? batchJudgeItems(batch) : null;
  if (!batch || !items) {
    res.status(404).json({ error: "Batch not found" });
    return;
  }
  if (batch.annotator !== annotator) {
    res.status(403).json({ error: "This batch was issued to another judge" });
    return;
  }
  res.json(
    GetEvalBatchResponse.parse({
      id: batch.id,
      poolId: batch.poolId,
      annotator: batch.annotator,
      createdAt: batch.createdAt,
      items,
    }),
  );
});

router.post("/eval/batches/:id/revoke", (req, res) => {
  const result = revokeBatch(req.params.id);
  if ("error" in result) {
    res.status(result.status).json({ error: result.error });
    return;
  }
  res.json(RevokeEvalBatchResponse.parse(batchSummary(result)));
});

/* Judgments */

router.get("/eval/judgments", (req, res) => {
  try {
    res.json(ListEvalJudgmentUploadsResponse.parse(listJudgmentUploads()));
  } catch (err) {
    req.log.error({ err }, "list judgment uploads failed");
    res.status(500).json({ error: "Failed to list judgment uploads" });
  }
});

router.post("/eval/judgments", (req, res) => {
  const parsed = UploadEvalJudgmentsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid body" });
    return;
  }
  // The presented per-judge token must resolve to the SAME judge code as
  // the submitted annotator: nobody can submit judgments in another
  // expert's name, even knowing their judge code and batch id.
  const tokenAnnotator = annotatorForJudgeToken(parsed.data.token);
  if (!tokenAnnotator) {
    res.status(401).json({ error: "Unknown or missing access key" });
    return;
  }
  if (tokenAnnotator !== parsed.data.annotator) {
    res.status(403).json({
      error: `Access key belongs to judge ${tokenAnnotator}, not ${parsed.data.annotator}`,
    });
    return;
  }
  const { token: _token, ...ingestInput } = parsed.data;
  const result = ingestJudgments(ingestInput);
  if ("error" in result) {
    res.status(400).json({ error: result.error });
    return;
  }
  res.status(201).json(
    UploadEvalJudgmentsResponse.parse({
      accepted: result.accepted,
      replaced: result.replaced,
      rejected: result.rejected,
      errors: result.errors,
    }),
  );
});

/* Agreement, disagreements, adjudication, qrels */

router.get("/eval/pools/:id/agreement", (req, res) => {
  const pool = getPool(req.params.id);
  if (!pool) {
    res.status(404).json({ error: "Pool not found" });
    return;
  }
  res.json(GetEvalPoolAgreementResponse.parse(poolAgreement(pool)));
});

router.get("/eval/pools/:id/disagreements", (req, res) => {
  const pool = getPool(req.params.id);
  if (!pool) {
    res.status(404).json({ error: "Pool not found" });
    return;
  }
  res.json(ListEvalPoolDisagreementsResponse.parse(poolDisagreements(pool)));
});

router.post("/eval/adjudications", (req, res) => {
  const parsed = CreateEvalAdjudicationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid body" });
    return;
  }
  const result = saveAdjudication(parsed.data);
  if ("error" in result) {
    res.status(result.status).json({ error: result.error });
    return;
  }
  res.status(201).json(CreateEvalAdjudicationResponse.parse(result));
});

router.get("/eval/pools/:id/qrels", (req, res) => {
  const pool = getPool(req.params.id);
  if (!pool) {
    res.status(404).json({ error: "Pool not found" });
    return;
  }
  res
    .type("text/plain")
    .setHeader("Content-Disposition", `attachment; filename="${pool.id}.qrels"`)
    .send(poolQrels(pool));
});

export default router;
