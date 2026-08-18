/**
 * File-backed persistence for the evaluation infrastructure.
 *
 * Everything lives under data/eval/ as plain JSON / JSONL so the whole
 * evaluation state travels with the data directory (and eventually the
 * deploy bundle) without any database dependency:
 *
 *   data/eval/snapshots/<id>.json        snapshot metadata
 *   data/eval/snapshots/<id>.corpus.jsonl  frozen corpus (canonical lines)
 *   data/eval/topic-sets/<id>.json
 *   data/eval/runs/<id>.json             ranked lines kept inside the file
 *   data/eval/pools/<id>.json            pool items incl. contributing runs
 *   data/eval/batches/<id>.json          issued blind batches
 *   data/eval/judgments/<id>.json        one file per ingest (append-only)
 *   data/eval/adjudications/<id>.json
 *
 * Judgments are merged at read time: the latest upload wins for a given
 * (item_id, annotator) key, which gives natural re-upload semantics.
 */
import {
  readFileSync,
  writeFileSync,
  renameSync,
  existsSync,
  mkdirSync,
  readdirSync,
} from "node:fs";
import path from "node:path";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { corpus, dataDir, type CorpusSection } from "../corpus";

export const evalDir = path.resolve(dataDir, "eval");

function subdir(name: string): string {
  const p = path.resolve(evalDir, name);
  mkdirSync(p, { recursive: true });
  return p;
}

function newId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${randomBytes(3).toString("hex")}`;
}

function writeJson(dir: string, id: string, value: unknown): void {
  // Atomic write: tmp file + rename so concurrent readers never see a
  // half-written JSON document.
  const target = path.resolve(dir, `${id}.json`);
  const tmp = `${target}.tmp-${process.pid}-${randomBytes(3).toString("hex")}`;
  writeFileSync(tmp, JSON.stringify(value, null, 1));
  renameSync(tmp, target);
}

function readJson<T>(dir: string, id: string): T | null {
  const p = path.resolve(dir, `${id}.json`);
  if (!existsSync(p) || !/^[A-Za-z0-9._-]+$/.test(id)) return null;
  return JSON.parse(readFileSync(p, "utf-8")) as T;
}

function listJson<T>(dir: string): T[] {
  return readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((f) => JSON.parse(readFileSync(path.resolve(dir, f), "utf-8")) as T);
}

/* ------------------------------------------------------------------ */
/* Snapshots                                                           */
/* ------------------------------------------------------------------ */

export interface SnapshotMeta {
  id: string;
  label: string;
  note?: string;
  createdAt: string;
  sha256: string;
  nPassages: number;
  indexDefinition: string;
}

const INDEX_DEFINITION =
  "Hybrid retrieval: BM25 (unicode-folded Greek/English tokens) + dense cosine (multilingual MiniLM embeddings), reciprocal-rank fusion, knowledge-graph entity boosts; passage unit = Perseus section (CTS urn:cts:greekLit:tlg0004.tlg001).";

function canonicalPassageLine(s: CorpusSection): string {
  // Stable key order so the hash is a function of content, not object order.
  return JSON.stringify({
    id: s.id,
    urn: s.urn,
    book: s.book,
    chapter: s.chapter,
    section: s.section,
    philosopher: s.philosopher,
    school: s.school,
    text: s.text,
    textEn: s.textEn,
  });
}

export function createSnapshot(input: { label: string; note?: string }): SnapshotMeta {
  const dir = subdir("snapshots");
  const lines = corpus.map(canonicalPassageLine);
  const body = lines.join("\n") + "\n";
  const sha256 = createHash("sha256").update(body, "utf-8").digest("hex");
  const id = newId("snap");
  const meta: SnapshotMeta = {
    id,
    label: input.label,
    ...(input.note ? { note: input.note } : {}),
    createdAt: new Date().toISOString(),
    sha256,
    nPassages: corpus.length,
    indexDefinition: INDEX_DEFINITION,
  };
  writeFileSync(path.resolve(dir, `${id}.corpus.jsonl`), body);
  writeJson(dir, id, meta);
  return meta;
}

export function listSnapshots(): SnapshotMeta[] {
  return listJson<SnapshotMeta>(subdir("snapshots"));
}

export function getSnapshot(id: string): SnapshotMeta | null {
  return readJson<SnapshotMeta>(subdir("snapshots"), id);
}

export function getSnapshotCorpusRaw(id: string): string | null {
  const p = path.resolve(subdir("snapshots"), `${id}.corpus.jsonl`);
  if (!getSnapshot(id) || !existsSync(p)) return null;
  return readFileSync(p, "utf-8");
}

export interface SnapshotPassage {
  id: string;
  urn: string;
  book: number;
  text: string;
  textEn: string | null;
}

export function getSnapshotPassages(id: string): Map<string, SnapshotPassage> | null {
  const raw = getSnapshotCorpusRaw(id);
  if (raw === null) return null;
  const map = new Map<string, SnapshotPassage>();
  for (const line of raw.split("\n")) {
    if (!line.trim()) continue;
    const p = JSON.parse(line) as SnapshotPassage;
    map.set(p.id, p);
  }
  return map;
}

export function snapshotByBook(id: string): { book: number; passages: number }[] | null {
  const passages = getSnapshotPassages(id);
  if (!passages) return null;
  const byBook = new Map<number, number>();
  for (const p of passages.values()) byBook.set(p.book, (byBook.get(p.book) ?? 0) + 1);
  return [...byBook.entries()]
    .map(([book, n]) => ({ book, passages: n }))
    .sort((a, b) => a.book - b.book);
}

/* ------------------------------------------------------------------ */
/* Topic sets                                                          */
/* ------------------------------------------------------------------ */

export interface Topic {
  topic_id: string;
  question: string;
  question_lang?: string;
  split?: string;
  /** Gold-set metadata (optional pass-through from the curated workbook). */
  question_type?: string;
  question_en?: string;
  expected_answer?: string;
  /** True for hard negatives where the correct behaviour is to abstain. */
  must_abstain?: boolean;
  /**
   * Abstention subtype. The three types are NOT interchangeable and must
   * never be merged in reporting: "out_of_corpus" (answer needs evidence
   * outside the corpus), "false_premise" (the question presupposes
   * something the corpus contradicts), "underspecified_homonym" (the
   * question does not disambiguate between homonymous bearers).
   */
  abstain_type?: string;
}

export interface TopicSet {
  id: string;
  label: string;
  note?: string;
  snapshotId: string;
  createdAt: string;
  topics: Topic[];
}

/** The three abstention subtypes. NOT interchangeable; never merged in reporting. */
export const ABSTAIN_TYPES = new Set([
  "out_of_corpus",
  "false_premise",
  "underspecified_homonym",
]);

export function createTopicSet(input: {
  label: string;
  snapshotId: string;
  lines: string;
  note?: string;
}): TopicSet | { error: string } {
  if (!getSnapshot(input.snapshotId)) return { error: `Unknown snapshot: ${input.snapshotId}` };
  const topics: Topic[] = [];
  const seen = new Set<string>();
  const rows = input.lines.split("\n").filter((l) => l.trim());
  for (let i = 0; i < rows.length; i++) {
    let obj: Record<string, unknown>;
    try {
      obj = JSON.parse(rows[i]!) as Record<string, unknown>;
    } catch {
      return { error: `Line ${i + 1}: not valid JSON` };
    }
    const topicId = obj["topic_id"];
    const question = obj["question"];
    if (typeof topicId !== "string" || !topicId) return { error: `Line ${i + 1}: missing topic_id` };
    if (typeof question !== "string" || !question) return { error: `Line ${i + 1}: missing question` };
    if (seen.has(topicId)) return { error: `Line ${i + 1}: duplicate topic_id ${topicId}` };
    seen.add(topicId);
    topics.push({
      topic_id: topicId,
      question,
      ...(typeof obj["question_lang"] === "string" ? { question_lang: obj["question_lang"] } : {}),
      ...(typeof obj["split"] === "string" ? { split: obj["split"] } : {}),
      ...(typeof obj["question_type"] === "string" ? { question_type: obj["question_type"] } : {}),
      ...(typeof obj["question_en"] === "string" ? { question_en: obj["question_en"] } : {}),
      ...(typeof obj["expected_answer"] === "string"
        ? { expected_answer: obj["expected_answer"] }
        : {}),
    });
    // Abstention metadata is validated strictly: a malformed hard negative
    // must fail loudly, never lose its abstention designation silently.
    const rawAbstain = obj["must_abstain"];
    let mustAbstain: boolean;
    if (rawAbstain === undefined || rawAbstain === false || rawAbstain === "0") {
      mustAbstain = false;
    } else if (rawAbstain === true || rawAbstain === "1") {
      mustAbstain = true;
    } else {
      return {
        error: `Line ${i + 1}: must_abstain must be true/false or "1"/"0", got ${JSON.stringify(rawAbstain)}`,
      };
    }
    const rawType = obj["abstain_type"];
    if (mustAbstain) {
      if (typeof rawType !== "string" || !ABSTAIN_TYPES.has(rawType))
        return {
          error: `Line ${i + 1}: must_abstain topics require abstain_type ∈ {${[...ABSTAIN_TYPES].join(", ")}}, got ${JSON.stringify(rawType)}`,
        };
      const t = topics[topics.length - 1]!;
      t.must_abstain = true;
      t.abstain_type = rawType;
    } else if (rawType !== undefined) {
      return { error: `Line ${i + 1}: abstain_type given without must_abstain` };
    }
  }
  if (topics.length === 0) return { error: "Topic set is empty" };
  const id = newId("topics");
  const set: TopicSet = {
    id,
    label: input.label,
    ...(input.note ? { note: input.note } : {}),
    snapshotId: input.snapshotId,
    createdAt: new Date().toISOString(),
    topics,
  };
  writeJson(subdir("topic-sets"), id, set);
  return set;
}

export function listTopicSets(): TopicSet[] {
  return listJson<TopicSet>(subdir("topic-sets"));
}

export function getTopicSet(id: string): TopicSet | null {
  return readJson<TopicSet>(subdir("topic-sets"), id);
}

export function topicSetSummary(s: TopicSet) {
  const bySplit = new Map<string, number>();
  const byQuestionType = new Map<string, number>();
  const byAbstainType = new Map<string, number>();
  let nAbstain = 0;
  for (const t of s.topics) {
    const k = t.split ?? "(χωρίς split)";
    bySplit.set(k, (bySplit.get(k) ?? 0) + 1);
    const qt = t.question_type ?? "(χωρίς τύπο)";
    byQuestionType.set(qt, (byQuestionType.get(qt) ?? 0) + 1);
    if (t.must_abstain) {
      nAbstain++;
      const at = t.abstain_type ?? "(αδήλωτος)";
      byAbstainType.set(at, (byAbstainType.get(at) ?? 0) + 1);
    }
  }
  const counts = (m: Map<string, number>) =>
    [...m.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => a.name.localeCompare(b.name));
  return {
    nAbstain,
    byQuestionType: counts(byQuestionType),
    byAbstainType: counts(byAbstainType),
    id: s.id,
    label: s.label,
    ...(s.note ? { note: s.note } : {}),
    snapshotId: s.snapshotId,
    createdAt: s.createdAt,
    nTopics: s.topics.length,
    bySplit: [...bySplit.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => a.name.localeCompare(b.name)),
  };
}

/* ------------------------------------------------------------------ */
/* Runs                                                                */
/* ------------------------------------------------------------------ */

export interface RunLine {
  topic_id: string;
  passage_id: string;
  rank: number;
  score: number;
}

export interface EvalRunRecord {
  id: string;
  systemId: string;
  label?: string;
  note?: string;
  snapshotId: string;
  topicSetId: string;
  createdAt: string;
  lines: RunLine[];
}

export function createRun(input: {
  systemId: string;
  label?: string;
  note?: string;
  snapshotId: string;
  topicSetId: string;
  lines: string;
}): EvalRunRecord | { error: string } {
  const passages = getSnapshotPassages(input.snapshotId);
  if (!passages) return { error: `Unknown snapshot: ${input.snapshotId}` };
  const topicSet = getTopicSet(input.topicSetId);
  if (!topicSet) return { error: `Unknown topic set: ${input.topicSetId}` };
  if (topicSet.snapshotId !== input.snapshotId)
    return { error: "Topic set is bound to a different snapshot" };
  const topicIds = new Set(topicSet.topics.map((t) => t.topic_id));
  const parsed: RunLine[] = [];
  const seen = new Set<string>();
  const rows = input.lines.split("\n").filter((l) => l.trim());
  const errors: string[] = [];
  for (let i = 0; i < rows.length && errors.length < 20; i++) {
    let obj: Record<string, unknown>;
    try {
      obj = JSON.parse(rows[i]!) as Record<string, unknown>;
    } catch {
      errors.push(`Line ${i + 1}: not valid JSON`);
      continue;
    }
    const topicId = obj["topic_id"];
    const passageId = obj["passage_id"];
    const rank = obj["rank"];
    const score = obj["score"];
    if (typeof topicId !== "string" || !topicIds.has(topicId)) {
      errors.push(`Line ${i + 1}: unknown topic_id ${String(topicId)}`);
      continue;
    }
    if (typeof passageId !== "string" || !passages.has(passageId)) {
      errors.push(`Line ${i + 1}: passage_id ${String(passageId)} not in snapshot`);
      continue;
    }
    if (typeof rank !== "number" || rank < 1) {
      errors.push(`Line ${i + 1}: invalid rank`);
      continue;
    }
    const key = `${topicId}\u0000${passageId}`;
    if (seen.has(key)) {
      errors.push(`Line ${i + 1}: duplicate (topic_id, passage_id)`);
      continue;
    }
    seen.add(key);
    parsed.push({
      topic_id: topicId,
      passage_id: passageId,
      rank,
      score: typeof score === "number" ? score : 0,
    });
  }
  if (errors.length > 0) return { error: errors.join("; ") };
  if (parsed.length === 0) return { error: "Run is empty" };
  const id = newId("run");
  const run: EvalRunRecord = {
    id,
    systemId: input.systemId,
    ...(input.label ? { label: input.label } : {}),
    ...(input.note ? { note: input.note } : {}),
    snapshotId: input.snapshotId,
    topicSetId: input.topicSetId,
    createdAt: new Date().toISOString(),
    lines: parsed,
  };
  writeJson(subdir("runs"), id, run);
  return run;
}

export function listRuns(): EvalRunRecord[] {
  return listJson<EvalRunRecord>(subdir("runs"));
}

export function getRun(id: string): EvalRunRecord | null {
  return readJson<EvalRunRecord>(subdir("runs"), id);
}

export function runSummary(r: EvalRunRecord) {
  return {
    id: r.id,
    systemId: r.systemId,
    ...(r.label ? { label: r.label } : {}),
    ...(r.note ? { note: r.note } : {}),
    snapshotId: r.snapshotId,
    topicSetId: r.topicSetId,
    createdAt: r.createdAt,
    nLines: r.lines.length,
    nTopics: new Set(r.lines.map((l) => l.topic_id)).size,
    maxRank: r.lines.reduce((m, l) => Math.max(m, l.rank), 0),
  };
}

/* ------------------------------------------------------------------ */
/* Pools                                                               */
/* ------------------------------------------------------------------ */

export interface PoolItem {
  itemId: string;
  topicId: string;
  passageId: string;
  /** Run ids that contributed the item. Never exposed to judges. */
  fromRuns: string[];
}

export interface PoolRecord {
  id: string;
  label: string;
  note?: string;
  snapshotId: string;
  topicSetId: string;
  runIds: string[];
  depth: number;
  judgmentsPerItem: number;
  createdAt: string;
  items: PoolItem[];
}

/** Deterministic per-pool shuffle so judges never see run order. */
function shuffleKey(poolSeed: string, itemKey: string): string {
  return createHash("sha256").update(`${poolSeed}\u0000${itemKey}`).digest("hex");
}

export function createPool(input: {
  label: string;
  note?: string;
  runIds: string[];
  depth: number;
  judgmentsPerItem: number;
}): PoolRecord | { error: string } {
  const runs = input.runIds.map((id) => getRun(id));
  if (runs.some((r) => !r)) return { error: "Unknown run id" };
  const loaded = runs as EvalRunRecord[];
  const snapshotIds = new Set(loaded.map((r) => r.snapshotId));
  const topicSetIds = new Set(loaded.map((r) => r.topicSetId));
  if (snapshotIds.size !== 1 || topicSetIds.size !== 1)
    return { error: "All pooled runs must share one snapshot and one topic set" };
  if (input.depth < 1) return { error: "depth must be >= 1" };
  if (input.judgmentsPerItem < 1 || input.judgmentsPerItem > 3)
    return { error: "judgmentsPerItem must be 1-3" };
  const id = newId("pool");
  const byKey = new Map<string, PoolItem>();
  for (const run of loaded) {
    for (const line of run.lines) {
      if (line.rank > input.depth) continue;
      const key = `${line.topic_id}\u0000${line.passage_id}`;
      let item = byKey.get(key);
      if (!item) {
        item = {
          itemId: `${id}:${line.topic_id}:${line.passage_id}`,
          topicId: line.topic_id,
          passageId: line.passage_id,
          fromRuns: [],
        };
        byKey.set(key, item);
      }
      if (!item.fromRuns.includes(run.id)) item.fromRuns.push(run.id);
    }
  }
  const items = [...byKey.values()].sort((a, b) =>
    shuffleKey(id, a.itemId).localeCompare(shuffleKey(id, b.itemId)),
  );
  if (items.length === 0) return { error: "Pool is empty at this depth" };
  const pool: PoolRecord = {
    id,
    label: input.label,
    ...(input.note ? { note: input.note } : {}),
    snapshotId: loaded[0]!.snapshotId,
    topicSetId: loaded[0]!.topicSetId,
    runIds: loaded.map((r) => r.id),
    depth: input.depth,
    judgmentsPerItem: input.judgmentsPerItem,
    createdAt: new Date().toISOString(),
    items,
  };
  writeJson(subdir("pools"), id, pool);
  return pool;
}

export function listPools(): PoolRecord[] {
  return listJson<PoolRecord>(subdir("pools"));
}

export function getPool(id: string): PoolRecord | null {
  return readJson<PoolRecord>(subdir("pools"), id);
}

export function poolSummary(p: PoolRecord) {
  return {
    id: p.id,
    label: p.label,
    ...(p.note ? { note: p.note } : {}),
    snapshotId: p.snapshotId,
    topicSetId: p.topicSetId,
    runIds: p.runIds,
    depth: p.depth,
    judgmentsPerItem: p.judgmentsPerItem,
    createdAt: p.createdAt,
    nItems: p.items.length,
    nTopics: new Set(p.items.map((i) => i.topicId)).size,
  };
}

/* ------------------------------------------------------------------ */
/* Judge tokens                                                        */
/* ------------------------------------------------------------------ */

/**
 * Per-judge secrets. Each judge code (annotator) gets one random access
 * token, minted lazily the first time a batch is issued to that code and
 * stored server-side in data/eval/judge-tokens.json. The token is the
 * judge's personal credential: it is required to list their batches, to
 * fetch batch items and to submit judgments, so knowing someone else's
 * judge CODE is no longer enough to act in their name. The shared
 * EVAL_ACCESS_PASSWORD gate (eval-auth.ts) stays as an outer layer.
 *
 * Tokens are compared via SHA-256 + timingSafeEqual so lookups do not
 * leak token prefixes through timing.
 */
const JUDGE_TOKENS_FILE = "judge-tokens";

function readJudgeTokens(): Record<string, string> {
  return (
    readJson<Record<string, string>>(subdir("."), JUDGE_TOKENS_FILE) ?? {}
  );
}

/** Get (or mint on first use) the access token for a judge code. */
export function ensureJudgeToken(annotator: string): string {
  const tokens = readJudgeTokens();
  const existing = tokens[annotator];
  if (existing) return existing;
  const token = randomBytes(24).toString("base64url");
  tokens[annotator] = token;
  writeJson(subdir("."), JUDGE_TOKENS_FILE, tokens);
  return token;
}

/** The token already minted for a judge code, if any. */
export function judgeTokenFor(annotator: string): string | null {
  return readJudgeTokens()[annotator] ?? null;
}

function sha256(s: string): Buffer {
  return createHash("sha256").update(s, "utf8").digest();
}

/** Resolve a presented token to its judge code; null when unknown. */
export function annotatorForJudgeToken(token: string): string | null {
  if (!token) return null;
  const given = sha256(token);
  let match: string | null = null;
  for (const [annotator, stored] of Object.entries(readJudgeTokens())) {
    const expected = sha256(stored);
    // Constant-time per entry; keep scanning so timing does not reveal
    // which entry matched.
    if (timingSafeEqual(given, expected)) match = annotator;
  }
  return match;
}

/* ------------------------------------------------------------------ */
/* Judgments                                                           */
/* ------------------------------------------------------------------ */

export interface JudgmentRecord {
  item_id: string;
  task: string;
  annotator: string;
  batch_id?: string;
  grade: string;
  scores?: Record<string, string | number>;
  flag?: boolean;
  notes?: string;
  ms?: number;
  ts?: string;
  calibration?: boolean;
}

interface JudgmentUpload {
  id: string;
  annotator: string;
  batchId?: string;
  createdAt: string;
  /** Monotonic tiebreaker for same-millisecond uploads. */
  seq?: string;
  judgments: JudgmentRecord[];
}

const RELEVANCE_GRADES = new Set(["0", "1", "2", "3"]);
const CERTAINTY_GRADES = new Set(["asserted", "reported", "disputed", "conjectured"]);

function validGrade(task: string, grade: string): boolean {
  if (task === "relevance") return RELEVANCE_GRADES.has(grade);
  if (task === "certainty") return CERTAINTY_GRADES.has(grade);
  return grade.length > 0;
}

export function ingestJudgments(input: {
  annotator: string;
  batchId?: string;
  lines: string;
}): { upload: JudgmentUpload; accepted: number; replaced: number; rejected: number; errors: string[] } | { error: string } {
  const rows = input.lines.split("\n").filter((l) => l.trim());
  if (rows.length === 0) return { error: "No judgment lines" };
  const existing = mergedJudgments();
  const judgments: JudgmentRecord[] = [];
  const errors: string[] = [];
  let replaced = 0;
  // Batch cache: every judgment must reference a batch that was issued
  // to this annotator and contains the item, so third parties cannot
  // inject judgments for pool items they were never assigned.
  const batchCache = new Map<string, BatchRecord | null>();
  const resolveBatch = (batchId: string): BatchRecord | null => {
    if (!batchCache.has(batchId)) batchCache.set(batchId, getBatch(batchId));
    return batchCache.get(batchId) ?? null;
  };
  for (let i = 0; i < rows.length; i++) {
    let obj: Record<string, unknown>;
    try {
      obj = JSON.parse(rows[i]!) as Record<string, unknown>;
    } catch {
      errors.push(`Line ${i + 1}: not valid JSON`);
      continue;
    }
    const itemId = obj["item_id"];
    const task = obj["task"];
    const grade = obj["grade"];
    const annotator = obj["annotator"];
    if (typeof itemId !== "string" || !itemId) {
      errors.push(`Line ${i + 1}: missing item_id`);
      continue;
    }
    if (typeof annotator === "string" && annotator && annotator !== input.annotator) {
      errors.push(`Line ${i + 1}: annotator mismatch (${annotator} vs ${input.annotator})`);
      continue;
    }
    if (typeof task !== "string" || !task) {
      errors.push(`Line ${i + 1}: missing task`);
      continue;
    }
    const gradeStr = typeof grade === "number" ? String(grade) : grade;
    if (typeof gradeStr !== "string" || !validGrade(task, gradeStr)) {
      errors.push(`Line ${i + 1}: invalid grade for task ${task}`);
      continue;
    }
    const lineBatchId =
      typeof obj["batch_id"] === "string" && obj["batch_id"]
        ? obj["batch_id"]
        : input.batchId;
    if (!lineBatchId) {
      errors.push(`Line ${i + 1}: missing batch_id (judgments must cite their issued batch)`);
      continue;
    }
    const batch = resolveBatch(lineBatchId);
    if (!batch) {
      errors.push(`Line ${i + 1}: unknown batch ${lineBatchId}`);
      continue;
    }
    if (batch.annotator !== input.annotator) {
      errors.push(`Line ${i + 1}: batch ${lineBatchId} was issued to another annotator`);
      continue;
    }
    if (!batch.itemIds.includes(itemId)) {
      errors.push(`Line ${i + 1}: item ${itemId} is not part of batch ${lineBatchId}`);
      continue;
    }
    if (task !== "relevance") {
      errors.push(`Line ${i + 1}: pool batches carry relevance items only, got task ${task}`);
      continue;
    }
    if (existing.has(`${itemId}\u0000${input.annotator}`)) replaced++;
    judgments.push({
      item_id: itemId,
      task,
      annotator: input.annotator,
      batch_id: lineBatchId,
      grade: gradeStr,
      ...(obj["scores"] && typeof obj["scores"] === "object"
        ? { scores: obj["scores"] as Record<string, string | number> }
        : {}),
      ...(typeof obj["flag"] === "boolean" ? { flag: obj["flag"] } : {}),
      ...(typeof obj["notes"] === "string" ? { notes: obj["notes"] } : {}),
      ...(typeof obj["ms"] === "number" ? { ms: obj["ms"] } : {}),
      ...(typeof obj["ts"] === "string" ? { ts: obj["ts"] } : {}),
      ...(typeof obj["calibration"] === "boolean" ? { calibration: obj["calibration"] } : {}),
    });
  }
  if (judgments.length === 0)
    return { error: `No valid judgments. ${errors.slice(0, 5).join("; ")}` };
  const id = newId("jud");
  const upload: JudgmentUpload = {
    id,
    annotator: input.annotator,
    ...(input.batchId ? { batchId: input.batchId } : {}),
    createdAt: new Date().toISOString(),
    seq: process.hrtime.bigint().toString().padStart(24, "0"),
    judgments,
  };
  writeJson(subdir("judgments"), id, upload);
  return {
    upload,
    accepted: judgments.length,
    replaced,
    rejected: errors.length,
    errors: errors.slice(0, 50),
  };
}

export function listJudgmentUploads() {
  return listJson<JudgmentUpload>(subdir("judgments")).map((u) => ({
    id: u.id,
    annotator: u.annotator,
    ...(u.batchId ? { batchId: u.batchId } : {}),
    createdAt: u.createdAt,
    nJudgments: u.judgments.length,
  }));
}

/** Latest judgment per (item_id, annotator); later uploads win. */
export function mergedJudgments(): Map<string, JudgmentRecord> {
  const uploads = listJson<JudgmentUpload>(subdir("judgments")).sort(
    (a, b) =>
      a.createdAt.localeCompare(b.createdAt) ||
      (a.seq ?? "").localeCompare(b.seq ?? ""),
  );
  const merged = new Map<string, JudgmentRecord>();
  for (const u of uploads) {
    for (const j of u.judgments) merged.set(`${j.item_id}\u0000${j.annotator}`, j);
  }
  return merged;
}

export function judgmentsByItem(poolItemIds: Set<string>): Map<string, JudgmentRecord[]> {
  const byItem = new Map<string, JudgmentRecord[]>();
  for (const j of mergedJudgments().values()) {
    if (!poolItemIds.has(j.item_id)) continue;
    const list = byItem.get(j.item_id) ?? [];
    list.push(j);
    byItem.set(j.item_id, list);
  }
  return byItem;
}

/* ------------------------------------------------------------------ */
/* Batches                                                             */
/* ------------------------------------------------------------------ */

export interface BatchRecord {
  id: string;
  poolId: string;
  annotator: string;
  createdAt: string;
  itemIds: string[];
  /**
   * True for "resolution" batches: targeted re-issues of deadlocked items
   * (judgmentsPerItem = 2, both judges disagree) to a third judge. Items in
   * any resolution batch count with an effective target of 3 judgments so
   * the standard 2-of-3 majority rule in resolveItem can settle them.
   */
  resolution?: boolean;
  /**
   * Set when the batch was revoked (e.g. its judge never uploaded). A
   * revoked batch no longer holds its outstanding assignments: unjudged
   * items become issuable again, and unjudged items of a revoked
   * RESOLUTION batch drop back from "awaiting third judge" to the
   * arbiter's queue. Judgments already ingested against the batch keep
   * counting — revocation never discards data.
   */
  revokedAt?: string;
}

/**
 * Item ids of a pool currently escalated to an effective target of 3
 * judgments (see resolveItem): issued in a live resolution batch, or in a
 * revoked one whose third judgment actually arrived before (or after)
 * revocation. Unjudged items of revoked batches are NOT escalated, so they
 * fall back to the ordinary 2-judge deadlock ("awaiting adjudicator").
 */
export function resolutionItemIds(poolId: string): Set<string> {
  const out = new Set<string>();
  let merged: Map<string, JudgmentRecord> | null = null;
  for (const b of listBatches(poolId)) {
    if (!b.resolution) continue;
    if (!b.revokedAt) {
      for (const id of b.itemIds) out.add(id);
      continue;
    }
    // Revoked: only items whose third judgment was actually ingested by
    // this batch's judge stay escalated (the 2-of-3 majority already has
    // its data); the rest return to the arbiter.
    merged ??= mergedJudgments();
    for (const id of b.itemIds) {
      if (merged.has(`${id}\u0000${b.annotator}`)) out.add(id);
    }
  }
  return out;
}

/**
 * Revoke a batch: releases its outstanding (unjudged) assignments. For
 * resolution batches this returns unjudged deadlocked items to the
 * "awaiting adjudicator" state; for ordinary batches the items become
 * issuable to another judge again. Idempotence is refused explicitly so
 * callers notice double revocations.
 */
export function revokeBatch(id: string): BatchRecord | { error: string; status: number } {
  const batch = getBatch(id);
  if (!batch) return { error: "Batch not found", status: 404 };
  if (batch.revokedAt) return { error: "Batch already revoked", status: 409 };
  const updated: BatchRecord = { ...batch, revokedAt: new Date().toISOString() };
  writeJson(subdir("batches"), id, updated);
  return updated;
}
export function listBatches(poolId?: string): BatchRecord[] {
  const all = listJson<BatchRecord>(subdir("batches"));
  return poolId ? all.filter((b) => b.poolId === poolId) : all;
}

export function getBatch(id: string): BatchRecord | null {
  return readJson<BatchRecord>(subdir("batches"), id);
}

export function createBatch(input: {
  poolId: string;
  annotator: string;
  size?: number;
  /** Issue only deadlocked items (2 judges, disagreement) to a third judge. */
  resolution?: boolean;
}): BatchRecord | { error: string; status: number } {
  const pool = getPool(input.poolId);
  if (!pool) return { error: "Unknown pool", status: 404 };
  if (input.resolution) return createResolutionBatch(pool, input);
  const byItem = judgmentsByItem(new Set(pool.items.map((i) => i.itemId)));
  // Engaged annotators per item = those with an ingested judgment PLUS
  // those holding an outstanding batch assignment, so the same item is
  // never over-issued before uploads arrive.
  const engaged = new Map<string, Set<string>>();
  for (const [itemId, js] of byItem) {
    engaged.set(itemId, new Set(js.map((j) => j.annotator)));
  }
  for (const b of listBatches(pool.id)) {
    if (b.revokedAt) continue; // revoked batches release their assignments
    for (const itemId of b.itemIds) {
      let set = engaged.get(itemId);
      if (!set) {
        set = new Set();
        engaged.set(itemId, set);
      }
      set.add(b.annotator);
    }
  }
  const zero: PoolItem[] = [];
  const needsMore: PoolItem[] = [];
  for (const item of pool.items) {
    const who = engaged.get(item.itemId) ?? new Set<string>();
    if (who.has(input.annotator)) continue;
    if (who.size >= pool.judgmentsPerItem) continue;
    const js = byItem.get(item.itemId) ?? [];
    (js.length === 0 && who.size === 0 ? zero : needsMore).push(item);
  }
  // Second judgments first: finish double-judging items that already have
  // one engaged annotator before opening brand-new items, so overlap (and
  // therefore inter-annotator agreement) accumulates as fast as possible.
  const eligible = [...needsMore, ...zero];
  if (eligible.length === 0)
    return { error: "Nothing left for this annotator to judge in this pool", status: 400 };
  const size = input.size && input.size > 0 ? Math.min(input.size, eligible.length) : eligible.length;
  const chosen = eligible.slice(0, size);
  const id = newId("batch");
  const batch: BatchRecord = {
    id,
    poolId: pool.id,
    annotator: input.annotator,
    createdAt: new Date().toISOString(),
    itemIds: chosen.map((i) => i.itemId),
  };
  writeJson(subdir("batches"), id, batch);
  return batch;
}

/**
 * Resolution batch: only items in a true deadlock — the pool targets 2
 * judgments, both are in and they disagree, and no arbiter has ruled —
 * issued to a judge who has not seen them, so the 2-of-3 majority rule
 * can settle the disagreement without an arbiter.
 */
function createResolutionBatch(
  pool: PoolRecord,
  input: { annotator: string; size?: number },
): BatchRecord | { error: string; status: number } {
  if (pool.judgmentsPerItem !== 2)
    return {
      error: "Resolution batches only apply to pools with judgmentsPerItem = 2",
      status: 400,
    };
  const byItem = judgmentsByItem(new Set(pool.items.map((i) => i.itemId)));
  const adjudications = poolAdjudications(pool.id);
  // Judges already engaged per item: ingested judgments plus outstanding
  // batch assignments, so a deadlocked item is never issued to a fourth
  // judge or back to one of the original two.
  const engaged = new Map<string, Set<string>>();
  for (const [itemId, js] of byItem) {
    engaged.set(itemId, new Set(js.map((j) => j.annotator)));
  }
  for (const b of listBatches(pool.id)) {
    if (b.revokedAt) continue; // revoked batches release their assignments
    for (const itemId of b.itemIds) {
      let set = engaged.get(itemId);
      if (!set) {
        set = new Set();
        engaged.set(itemId, set);
      }
      set.add(b.annotator);
    }
  }
  const eligible: PoolItem[] = [];
  for (const item of pool.items) {
    const js = byItem.get(item.itemId) ?? [];
    if (js.length < 2) continue; // not all target judgments in yet
    if (new Set(js.map((j) => j.grade)).size < 2) continue; // no disagreement
    if (adjudications.has(item.itemId)) continue; // arbiter already ruled
    if (js.length >= 3) continue; // third judgment already in
    const who = engaged.get(item.itemId) ?? new Set<string>();
    if (who.has(input.annotator)) continue; // must be a fresh judge
    if (who.size >= 3) continue; // third slot already assigned
    eligible.push(item);
  }
  if (eligible.length === 0)
    return {
      error: "No deadlocked items available for this judge in this pool",
      status: 400,
    };
  const size =
    input.size && input.size > 0 ? Math.min(input.size, eligible.length) : eligible.length;
  const id = newId("batch");
  const batch: BatchRecord = {
    id,
    poolId: pool.id,
    annotator: input.annotator,
    createdAt: new Date().toISOString(),
    itemIds: eligible.slice(0, size).map((i) => i.itemId),
    resolution: true,
  };
  writeJson(subdir("batches"), id, batch);
  return batch;
}
/** Blind judge items for a batch: no system, rank, score or run info. */
export function batchJudgeItems(batch: BatchRecord) {
  const pool = getPool(batch.poolId);
  if (!pool) return null;
  const passages = getSnapshotPassages(pool.snapshotId);
  const topicSet = getTopicSet(pool.topicSetId);
  if (!passages || !topicSet) return null;
  const topicById = new Map(topicSet.topics.map((t) => [t.topic_id, t]));
  const itemById = new Map(pool.items.map((i) => [i.itemId, i]));
  const items = [];
  for (const itemId of batch.itemIds) {
    const item = itemById.get(itemId);
    if (!item) continue;
    const passage = passages.get(item.passageId);
    const topic = topicById.get(item.topicId);
    items.push({
      item_id: item.itemId,
      task: "relevance" as const,
      ...(topic ? { question: topic.question } : {}),
      ...(topic?.question_lang ? { question_lang: topic.question_lang } : {}),
      ...(topic?.question_en ? { question_en: topic.question_en } : {}),
      passage_id: item.passageId,
      ...(passage ? { cts_urn: passage.urn } : {}),
      text_grc: passage?.text ?? "",
      ...(passage?.textEn ? { text_en: passage.textEn } : {}),
      calibration: false,
      reference_grade: null,
    });
  }
  return items;
}

/**
 * Batch ids that already have at least one accepted judgment.
 *
 * Derived ONLY from the persisted judgment records' normalized batch_id
 * (ingestJudgments stamps every accepted record with the batch it cited).
 * The upload envelope's batchId is deliberately ignored: a single upload
 * may carry lines for several batches, so trusting the envelope would mark
 * batches submitted that never received an accepted judgment.
 */
export function submittedBatchIds(): Set<string> {
  const ids = new Set<string>();
  for (const u of listJson<JudgmentUpload>(subdir("judgments"))) {
    for (const j of u.judgments) {
      if (j.batch_id) ids.add(j.batch_id);
    }
  }
  return ids;
}

/**
 * All batches across every pool as summaries for the server-driven judge
 * assignment screen: pool label when available and whether a judgment
 * upload already exists for the batch.
 */
export function allBatchSummaries() {
  const submitted = submittedBatchIds();
  const poolLabels = new Map(listPools().map((p) => [p.id, p.label]));
  return listBatches()
    .map((b) => ({
      id: b.id,
      poolId: b.poolId,
      ...(poolLabels.has(b.poolId) ? { poolLabel: poolLabels.get(b.poolId)! } : {}),
      annotator: b.annotator,
      createdAt: b.createdAt,
      itemCount: b.itemIds.length,
      submitted: submitted.has(b.id),
      ...(b.revokedAt ? { revokedAt: b.revokedAt } : {}),
    }))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function batchSummary(b: BatchRecord) {
  const merged = mergedJudgments();
  let judged = 0;
  for (const itemId of b.itemIds) {
    if (merged.has(`${itemId}\u0000${b.annotator}`)) judged++;
  }
  return {
    id: b.id,
    poolId: b.poolId,
    annotator: b.annotator,
    createdAt: b.createdAt,
    nItems: b.itemIds.length,
    judged,
    ...(b.resolution ? { resolution: true } : {}),
    ...(b.revokedAt ? { revokedAt: b.revokedAt } : {}),
  };
}

/* ------------------------------------------------------------------ */
/* Coverage                                                            */
/* ------------------------------------------------------------------ */

export function poolCoverage(pool: PoolRecord) {
  const byItem = judgmentsByItem(new Set(pool.items.map((i) => i.itemId)));
  const adjudications = poolAdjudications(pool.id);
  const escalated = resolutionItemIds(pool.id);
  let zero = 0;
  let one = 0;
  let twoPlus = 0;
  let complete = 0;
  let unanimous = 0;
  let majority = 0;
  let adjudicated = 0;
  let arbitration = 0;
  let awaitingThirdJudge = 0;
  const items = pool.items.map((item) => {
    const js = byItem.get(item.itemId) ?? [];
    const effPool = effectivePoolFor(pool, item.itemId, escalated);
    if (js.length === 0) zero++;
    else if (js.length === 1) one++;
    else twoPlus++;
    if (js.length >= effPool.judgmentsPerItem) complete++;
    const res = resolveItem(effPool, js, adjudications.get(item.itemId));
    if (res?.method === "adjudicated") adjudicated++;
    else if (res?.method === "unanimous") unanimous++;
    else if (res?.method === "majority") majority++;
    else if (js.length >= effPool.judgmentsPerItem) arbitration++;
    else if (effPool.judgmentsPerItem > pool.judgmentsPerItem && js.length >= pool.judgmentsPerItem)
      awaitingThirdJudge++;
    return {
      itemId: item.itemId,
      topicId: item.topicId,
      passageId: item.passageId,
      judgments: js.length,
      annotators: js.map((j) => j.annotator).sort(),
    };
  });
  return {
    poolId: pool.id,
    summary: {
      zero,
      one,
      twoPlus,
      complete,
      unanimous,
      majority,
      adjudicated,
      needsArbitration: arbitration,
      awaitingThirdJudge,
    },
    items,
  };
}

/* ------------------------------------------------------------------ */
/* Agreement                                                           */
/* ------------------------------------------------------------------ */

/**
 * Krippendorff's alpha from units with >= 2 values.
 * distance(a, b) is a squared-difference metric for ordinal data or a
 * 0/1 metric for nominal data.
 */
function krippendorffAlpha(
  units: string[][],
  distance: (a: string, b: string) => number,
): number | null {
  const usable = units.filter((u) => u.length >= 2);
  if (usable.length === 0) return null;
  let observed = 0;
  let observedPairs = 0;
  const allValues: string[] = [];
  for (const unit of usable) {
    const m = unit.length;
    for (let i = 0; i < m; i++) {
      for (let j = 0; j < m; j++) {
        if (i === j) continue;
        observed += distance(unit[i]!, unit[j]!) / (m - 1);
        observedPairs += 1 / (m - 1);
      }
    }
    allValues.push(...unit);
  }
  const n = allValues.length;
  if (n < 2) return null;
  let expected = 0;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i === j) continue;
      expected += distance(allValues[i]!, allValues[j]!);
    }
  }
  const De = expected / (n * (n - 1));
  if (De === 0) return null;
  const Do = observed / observedPairs;
  return 1 - Do / De;
}

function ordinalDistance(a: string, b: string): number {
  const d = Number(a) - Number(b);
  return d * d;
}

function nominalDistance(a: string, b: string): number {
  return a === b ? 0 : 1;
}

function cohenKappa(
  pairs: [string, string][],
): { kappa: number | null; observed: number } {
  const n = pairs.length;
  if (n === 0) return { kappa: null, observed: 0 };
  let agree = 0;
  const marginalA = new Map<string, number>();
  const marginalB = new Map<string, number>();
  for (const [a, b] of pairs) {
    if (a === b) agree++;
    marginalA.set(a, (marginalA.get(a) ?? 0) + 1);
    marginalB.set(b, (marginalB.get(b) ?? 0) + 1);
  }
  const po = agree / n;
  let pe = 0;
  for (const [cat, ca] of marginalA) pe += (ca / n) * ((marginalB.get(cat) ?? 0) / n);
  if (pe === 1) return { kappa: null, observed: po };
  return { kappa: (po - pe) / (1 - pe), observed: po };
}

export function poolAgreement(pool: PoolRecord) {
  const byItem = judgmentsByItem(new Set(pool.items.map((i) => i.itemId)));
  const tasks = new Map<string, Map<string, JudgmentRecord[]>>();
  for (const [itemId, js] of byItem) {
    for (const j of js) {
      let taskMap = tasks.get(j.task);
      if (!taskMap) {
        taskMap = new Map();
        tasks.set(j.task, taskMap);
      }
      const list = taskMap.get(itemId) ?? [];
      list.push(j);
      taskMap.set(itemId, list);
    }
  }
  const perTask = [];
  const pairwise = [];
  for (const [task, itemMap] of [...tasks.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    const scale = task === "relevance" ? "ordinal" : "nominal";
    const distance = task === "relevance" ? ordinalDistance : nominalDistance;
    const units = [...itemMap.values()].map((js) => js.map((j) => j.grade));
    const nItemsDouble = units.filter((u) => u.length >= 2).length;
    perTask.push({
      task,
      scale,
      nItemsDouble,
      krippendorffAlpha: krippendorffAlpha(units, distance),
    });
    // pairwise Cohen kappa
    const annotators = [
      ...new Set([...itemMap.values()].flat().map((j) => j.annotator)),
    ].sort();
    for (let i = 0; i < annotators.length; i++) {
      for (let k = i + 1; k < annotators.length; k++) {
        const a = annotators[i]!;
        const b = annotators[k]!;
        const shared: [string, string][] = [];
        for (const js of itemMap.values()) {
          const ja = js.find((j) => j.annotator === a);
          const jb = js.find((j) => j.annotator === b);
          if (ja && jb) shared.push([ja.grade, jb.grade]);
        }
        if (shared.length === 0) continue;
        const { kappa, observed } = cohenKappa(shared);
        pairwise.push({
          annotatorA: a,
          annotatorB: b,
          task,
          nShared: shared.length,
          observedAgreement: observed,
          cohenKappa: kappa,
        });
      }
    }
  }
  return { poolId: pool.id, perTask, pairwise };
}

/* ------------------------------------------------------------------ */
/* Resolution                                                          */
/* ------------------------------------------------------------------ */

/**
 * How an item's final grade was decided.
 *
 * Resolution rules (in order of precedence):
 *  1. "adjudicated" — an arbiter's decision always wins.
 *  2. "unanimous"   — all target judgments are in and identical.
 *  3. "majority"    — pools with judgmentsPerItem >= 3 only: one grade is
 *     held by a STRICT majority of the pool's TARGET judgment count
 *     (2-of-3), so no pending or dissenting judgment can overturn it.
 *     Pools with judgmentsPerItem = 2 keep the old scheme: any split goes
 *     to the arbiter.
 *
 * Rule for other tasks (documented for when non-relevance batches are
 * issued server-side): certainty grades are categorical, so the same
 * strict-majority rule applies to the grade string; answer judgments are
 * multi-dimensional (supported / correct / citation), so majority is
 * applied PER DIMENSION and the item resolves only if every dimension
 * has a strict majority.
 */
export type ItemResolution = {
  method: "adjudicated" | "unanimous" | "majority";
  grade: string;
};

export function resolveItem(
  pool: PoolRecord,
  js: JudgmentRecord[],
  adj: AdjudicationRecord | undefined,
): ItemResolution | null {
  if (adj) return { method: "adjudicated", grade: adj.grade };
  if (js.length === 0) return null;
  const counts = new Map<string, number>();
  for (const j of js) counts.set(j.grade, (counts.get(j.grade) ?? 0) + 1);
  const [topGrade, topCount] = [...counts.entries()].sort(
    (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
  )[0]!;
  if (js.length >= pool.judgmentsPerItem && counts.size === 1)
    return { method: "unanimous", grade: topGrade };
  if (pool.judgmentsPerItem >= 3 && topCount * 2 > pool.judgmentsPerItem)
    return { method: "majority", grade: topGrade };
  return null;
}

/** True deadlock: every target judgment is in and still no resolution. */
export function needsArbitration(
  pool: PoolRecord,
  js: JudgmentRecord[],
  adj: AdjudicationRecord | undefined,
): boolean {
  return !resolveItem(pool, js, adj) && js.length >= pool.judgmentsPerItem;
}

/* ------------------------------------------------------------------ */
/* Adjudication and qrels                                              */
/* ------------------------------------------------------------------ */

export interface AdjudicationRecord {
  poolId: string;
  itemId: string;
  grade: string;
  arbiter: string;
  note?: string;
  createdAt: string;
}

function adjudicationFileId(poolId: string, itemId: string): string {
  return createHash("sha256").update(`${poolId}\u0000${itemId}`).digest("hex").slice(0, 24);
}

export function saveAdjudication(input: {
  poolId: string;
  itemId: string;
  grade: string;
  arbiter: string;
  note?: string;
}): AdjudicationRecord | { error: string; status: number } {
  const pool = getPool(input.poolId);
  if (!pool) return { error: "Unknown pool", status: 404 };
  if (!pool.items.some((i) => i.itemId === input.itemId))
    return { error: "Unknown item in this pool", status: 404 };
  const rec: AdjudicationRecord = {
    poolId: input.poolId,
    itemId: input.itemId,
    grade: input.grade,
    arbiter: input.arbiter,
    ...(input.note ? { note: input.note } : {}),
    createdAt: new Date().toISOString(),
  };
  writeJson(subdir("adjudications"), adjudicationFileId(input.poolId, input.itemId), rec);
  return rec;
}

export function poolAdjudications(poolId: string): Map<string, AdjudicationRecord> {
  const map = new Map<string, AdjudicationRecord>();
  for (const a of listJson<AdjudicationRecord>(subdir("adjudications"))) {
    if (a.poolId === poolId) map.set(a.itemId, a);
  }
  return map;
}

export function poolDisagreements(pool: PoolRecord) {
  const byItem = judgmentsByItem(new Set(pool.items.map((i) => i.itemId)));
  const topicSet = getTopicSet(pool.topicSetId);
  const topicById = new Map((topicSet?.topics ?? []).map((t) => [t.topic_id, t]));
  const adjudications = poolAdjudications(pool.id);
  const escalated = resolutionItemIds(pool.id);
  const out = [];
  for (const item of pool.items) {
    const js = (byItem.get(item.itemId) ?? []).sort((a, b) =>
      a.annotator.localeCompare(b.annotator),
    );
    if (js.length < 2) continue;
    const grades = new Set(js.map((j) => j.grade));
    if (grades.size < 2) continue;
    const adj = adjudications.get(item.itemId);
    // 2-of-3 pools: a guaranteed strict majority resolves the item without
    // an arbiter, so it is not a "disagreement" any more. Only adjudicated
    // items (audit trail), items escalated to a third judge whose judgment
    // is still outstanding, and true deadlocks reach this list.
    const effPool = effectivePoolFor(pool, item.itemId, escalated);
    const res = resolveItem(effPool, js, adj);
    if (res && res.method !== "adjudicated") continue;
    const awaitingThird = !adj && js.length < effPool.judgmentsPerItem;
    const topic = topicById.get(item.topicId);
    out.push({
      resolution: adj
        ? ("adjudicated" as const)
        : awaitingThird
          ? ("awaiting_third" as const)
          : ("deadlock" as const),
      itemId: item.itemId,
      topicId: item.topicId,
      passageId: item.passageId,
      task: js[0]!.task,
      ...(topic ? { question: topic.question } : {}),
      grades: js.map((j) => ({
        annotator: j.annotator,
        grade: j.grade,
        ...(j.notes ? { notes: j.notes } : {}),
        ...(j.flag !== undefined ? { flag: j.flag } : {}),
      })),
      adjudicated: !!adj,
      ...(adj ? { finalGrade: adj.grade } : {}),
    });
  }
  return out;
}

/**
 * TREC qrels: "topic_id 0 passage_id grade" for every resolved item.
 * Resolved = adjudicated, unanimous, or a guaranteed 2-of-3 majority
 * (see resolveItem for the precedence and the majority rule).
 */
export function poolQrels(pool: PoolRecord): string {
  const byItem = judgmentsByItem(new Set(pool.items.map((i) => i.itemId)));
  const adjudications = poolAdjudications(pool.id);
  const escalated = resolutionItemIds(pool.id);
  const lines: string[] = [];
  let unresolved = 0;
  for (const item of pool.items) {
    const js = byItem.get(item.itemId) ?? [];
    const res = resolveItem(
      effectivePoolFor(pool, item.itemId, escalated),
      js,
      adjudications.get(item.itemId),
    );
    if (res) {
      lines.push(`${item.topicId} 0 ${item.passageId} ${res.grade}`);
    } else {
      unresolved++;
    }
  }
  lines.push(`# unresolved_items=${unresolved} pool=${pool.id} depth=${pool.depth}`);
  return lines.join("\n") + "\n";
}

/* ------------------------------------------------------------------ */
/* Overview                                                            */
/* ------------------------------------------------------------------ */

export function evalOverview() {
  const merged = mergedJudgments();
  const annotators = new Set([...merged.values()].map((j) => j.annotator));
  return {
    snapshots: listSnapshots().length,
    topicSets: listTopicSets().length,
    runs: listRuns().length,
    pools: listPools().length,
    batches: listBatches().length,
    judgments: merged.size,
    annotators: annotators.size,
  };
}

/**
 * Pool view with the effective judgment target for one item: pools with
 * judgmentsPerItem = 2 count an item toward 3 judgments once it has been
 * escalated to a third judge via a resolution batch.
 */
export function effectivePoolFor(
  pool: PoolRecord,
  itemId: string,
  escalated: Set<string>,
): PoolRecord {
  if (pool.judgmentsPerItem === 2 && escalated.has(itemId)) {
    return { ...pool, judgmentsPerItem: 3 };
  }
  return pool;
}
