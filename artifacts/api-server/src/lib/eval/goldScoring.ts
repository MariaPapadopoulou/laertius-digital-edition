/**
 * goldScoring — score eval-store runs against a committed gold qrels file
 * (data/eval/gold/gold-qrels-v*.jsonl).
 *
 * Gold qrels rows look like:
 *   { topic_id, gold_passage?, full_cts_urn?, relevance, must_abstain, expected_action }
 *
 * Passage resolution: the authoritative pointer is `full_cts_urn` — its final
 * segment (e.g. "1.7.99") is the snapshot passage id. Ranges such as
 * "2.8.103-2.8.104" expand to every snapshot passage in the same book.chapter
 * whose section number lies within the range. `gold_passage` ("1.99") is a
 * human-readable book.section shorthand and is NOT a snapshot id.
 *
 * Reporting contract: abstention results are ALWAYS reported per subtype
 * (out_of_corpus, false_premise, underspecified_homonym) and never merged.
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import type { EvalRunRecord, TopicSet } from "./store";
import { ABSTAIN_TYPES, evalDir, getSnapshotPassages } from "./store";

export interface GoldQrelsParse {
  /** topic_id -> passage_id -> relevance grade (>0 only). */
  relevantByTopic: Map<string, Map<string, number>>;
  /** topic ids present in the qrels file (including relevance-0 rows). */
  topicIds: Set<string>;
  /**
   * topic_id -> documented reason why the topic has no gold passage by
   * design (e.g. "dataset_aggregate" for corpus-statistics questions whose
   * answers are computed from the dataset, not attested in any single CTS
   * passage). Such topics are reported separately instead of counting
   * against the passage-answerable denominator.
   */
  noGoldPassageReasonByTopic: Map<string, string>;
  nRows: number;
  errors: string[];
}

function expandUrnRef(ref: string, snapshotIds: Set<string>): string[] | null {
  if (!ref.includes("-")) return snapshotIds.has(ref) ? [ref] : null;
  const [startRaw, endRaw] = ref.split("-", 2);
  if (!startRaw || !endRaw) return null;
  const start = startRaw.split(".");
  const end = endRaw.split(".");
  if (start.length !== 3 || end.length !== 3) return null;
  const [book, chapter] = [start[0]!, start[1]!];
  if (end[0] !== book || end[1] !== chapter) return null;
  const lo = Number(start[2]);
  const hi = Number(end[2]);
  if (!Number.isFinite(lo) || !Number.isFinite(hi) || hi < lo) return null;
  const out: string[] = [];
  for (let s = lo; s <= hi; s++) {
    const id = `${book}.${chapter}.${s}`;
    if (snapshotIds.has(id)) out.push(id);
  }
  return out.length > 0 ? out : null;
}

export function parseGoldQrels(lines: string, snapshotId: string): GoldQrelsParse | { error: string } {
  const passages = getSnapshotPassages(snapshotId);
  if (!passages) return { error: `unknown snapshot ${snapshotId}` };
  const snapshotIds = new Set(passages.keys());
  const relevantByTopic = new Map<string, Map<string, number>>();
  const topicIds = new Set<string>();
  const noGoldPassageReasonByTopic = new Map<string, string>();
  const errors: string[] = [];
  let nRows = 0;
  for (const [i, raw] of lines.split("\n").entries()) {
    if (!raw.trim()) continue;
    nRows++;
    let obj: Record<string, unknown>;
    try {
      obj = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      errors.push(`line ${i + 1}: invalid JSON`);
      continue;
    }
    const topicId = typeof obj["topic_id"] === "string" ? obj["topic_id"] : "";
    if (!topicId) {
      errors.push(`line ${i + 1}: missing topic_id`);
      continue;
    }
    topicIds.add(topicId);
    const relevance = typeof obj["relevance"] === "number" ? obj["relevance"] : 0;
    const reason =
      typeof obj["no_gold_passage_reason"] === "string" ? obj["no_gold_passage_reason"] : "";
    if (reason) {
      if (relevance > 0) {
        errors.push(`line ${i + 1} (${topicId}): no_gold_passage_reason on a relevance>0 row`);
      } else {
        noGoldPassageReasonByTopic.set(topicId, reason);
      }
    }
    if (relevance <= 0) continue;
    const urn = typeof obj["full_cts_urn"] === "string" ? obj["full_cts_urn"] : "";
    if (!urn) {
      errors.push(`line ${i + 1} (${topicId}): relevance>0 but no full_cts_urn`);
      continue;
    }
    const ref = urn.split(":").pop() ?? "";
    const ids = expandUrnRef(ref, snapshotIds);
    if (!ids) {
      errors.push(`line ${i + 1} (${topicId}): cannot resolve "${ref}" against snapshot`);
      continue;
    }
    const m = relevantByTopic.get(topicId) ?? new Map<string, number>();
    for (const id of ids) m.set(id, Math.max(m.get(id) ?? 0, relevance));
    relevantByTopic.set(topicId, m);
  }
  return { relevantByTopic, topicIds, noGoldPassageReasonByTopic, nRows, errors };
}

export interface AnswerableMetrics {
  nTopics: number;
  /** Topics that have at least one resolvable relevant passage. */
  nScored: number;
  /**
   * Answerable topics excluded from the metric denominators because the
   * qrels document a no_gold_passage_reason (reason -> count). These are
   * NOT included in nTopics/nScored.
   */
  excludedByReason: Record<string, number>;
  mrr: number;
  recallAtK: number;
  ndcgAtK: number;
  hitAtK: number;
  k: number;
}

export interface AbstainSubtypeReport {
  abstainType: string;
  nTopics: number;
  /** Subtype topics that carry gold evidence passages in the qrels. */
  nWithEvidence: number;
  /** Of those, how many runs surfaced at least one evidence passage in top k. */
  evidenceHitAtK: number;
}

export interface GoldRunScore {
  runId: string;
  systemId: string;
  topicSetId: string;
  snapshotId: string;
  k: number;
  answerable: AnswerableMetrics;
  /** Per-subtype abstention reporting — one entry per subtype, never merged. */
  abstainBySubtype: AbstainSubtypeReport[];
  perTopic: {
    topic_id: string;
    must_abstain: boolean;
    abstain_type?: string;
    nRelevant: number;
    firstRelevantRank: number | null;
    relevantInTopK: number;
    no_gold_passage_reason?: string;
  }[];
}

function dcg(gains: number[]): number {
  return gains.reduce((acc, g, i) => acc + g / Math.log2(i + 2), 0);
}

export function scoreRunAgainstGoldQrels(input: {
  run: EvalRunRecord;
  topicSet: TopicSet;
  qrels: GoldQrelsParse;
  k?: number;
}): GoldRunScore {
  const { run, topicSet, qrels } = input;
  const k = input.k ?? 10;
  const rankedByTopic = new Map<string, string[]>();
  for (const r of run.lines) {
    const arr = rankedByTopic.get(r.topic_id) ?? [];
    arr[r.rank - 1] = r.passage_id;
    rankedByTopic.set(r.topic_id, arr);
  }

  const perTopic: GoldRunScore["perTopic"] = [];
  let mrrSum = 0;
  let recallSum = 0;
  let ndcgSum = 0;
  let hits = 0;
  let nScored = 0;
  let nAnswerable = 0;
  const excludedByReason: Record<string, number> = {};
  const subtype = new Map<string, AbstainSubtypeReport>();
  for (const t of [...ABSTAIN_TYPES]) {
    subtype.set(t, { abstainType: t, nTopics: 0, nWithEvidence: 0, evidenceHitAtK: 0 });
  }

  for (const topic of topicSet.topics) {
    const rel = qrels.relevantByTopic.get(topic.topic_id) ?? new Map<string, number>();
    const ranked = (rankedByTopic.get(topic.topic_id) ?? []).slice(0, k);
    const firstIdx = ranked.findIndex((p) => p && rel.has(p));
    const relevantInTopK = ranked.filter((p) => p && rel.has(p)).length;
    const reason = qrels.noGoldPassageReasonByTopic.get(topic.topic_id);
    perTopic.push({
      topic_id: topic.topic_id,
      must_abstain: topic.must_abstain === true,
      ...(topic.abstain_type ? { abstain_type: topic.abstain_type } : {}),
      nRelevant: rel.size,
      firstRelevantRank: firstIdx >= 0 ? firstIdx + 1 : null,
      relevantInTopK,
      ...(reason && rel.size === 0 ? { no_gold_passage_reason: reason } : {}),
    });

    if (topic.must_abstain) {
      const rep = subtype.get(topic.abstain_type ?? "");
      if (rep) {
        rep.nTopics++;
        if (rel.size > 0) {
          rep.nWithEvidence++;
          if (firstIdx >= 0) rep.evidenceHitAtK++;
        }
      }
      continue;
    }

    if (rel.size === 0 && reason) {
      // No gold passage by documented design (e.g. dataset-aggregate
      // questions) — reported via excludedByReason, outside the
      // passage-answerable denominator.
      excludedByReason[reason] = (excludedByReason[reason] ?? 0) + 1;
      continue;
    }
    nAnswerable++;
    if (rel.size === 0) continue; // unresolvable gold — excluded from metric denominators
    nScored++;
    if (firstIdx >= 0) {
      mrrSum += 1 / (firstIdx + 1);
      hits++;
    }
    recallSum += relevantInTopK / rel.size;
    const gains = ranked.map((p) => (p ? (rel.get(p) ?? 0) : 0));
    const ideal = [...rel.values()].sort((a, b) => b - a).slice(0, k);
    const idcg = dcg(ideal);
    ndcgSum += idcg > 0 ? dcg(gains) / idcg : 0;
  }

  return {
    runId: run.id,
    systemId: run.systemId,
    topicSetId: topicSet.id,
    snapshotId: run.snapshotId,
    k,
    answerable: {
      nTopics: nAnswerable,
      nScored,
      excludedByReason,
      mrr: nScored > 0 ? mrrSum / nScored : 0,
      recallAtK: nScored > 0 ? recallSum / nScored : 0,
      ndcgAtK: nScored > 0 ? ndcgSum / nScored : 0,
      hitAtK: nScored > 0 ? hits / nScored : 0,
      k,
    },
    abstainBySubtype: [...subtype.values()],
    perTopic,
  };
}

/**
 * Load the committed current gold qrels file:
 * data/eval/gold/gold-qrels-v<CURRENT_VERSION>.jsonl, where CURRENT_VERSION
 * is read from data/eval/gold/CURRENT_VERSION.
 */
export function loadCurrentGoldQrels():
  | { version: string; lines: string }
  | { error: string } {
  const goldDir = path.resolve(evalDir, "gold");
  const versionFile = path.resolve(goldDir, "CURRENT_VERSION");
  if (!existsSync(versionFile))
    return { error: "No gold set is available (missing CURRENT_VERSION)" };
  const version = readFileSync(versionFile, "utf-8").trim();
  if (!/^[0-9]+(\.[0-9]+)*$/.test(version))
    return { error: `Invalid gold CURRENT_VERSION: ${JSON.stringify(version)}` };
  const qrelsFile = path.resolve(goldDir, `gold-qrels-v${version}.jsonl`);
  if (!existsSync(qrelsFile))
    return { error: `Gold qrels file for v${version} not found` };
  return { version, lines: readFileSync(qrelsFile, "utf-8") };
}
