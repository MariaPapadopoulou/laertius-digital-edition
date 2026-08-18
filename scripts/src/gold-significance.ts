/**
 * Paired significance testing for the Gold v0.5 retrieval comparison.
 *
 * Reads the per-topic breakdowns persisted in the gold run reports
 * (artifacts/api-server/data/eval/gold/gold-eval-v0.5-*report.json) and, for
 * each system pair, runs on the SAME scored topics:
 *   - a paired two-sided sign-flip randomization test (20 000 resamples,
 *     deterministic seed) on the mean per-topic difference, and
 *   - a paired bootstrap 95% CI of the mean difference (10 000 resamples).
 *
 * Metrics: per-topic reciprocal rank (MRR), recall@10 and hit@10 — the three
 * that are exactly derivable from the persisted perTopic primitives
 * (firstRelevantRank, relevantInTopK, nRelevant). nDCG@10 needs the full
 * graded ranking and is deliberately NOT tested here; the aggregate nDCG in
 * the comparison table remains descriptive only.
 *
 * Positive control: for every run the per-topic means recomputed here must
 * reproduce the aggregate MRR/recall/hit stored in the report (tolerance
 * 1e-9), otherwise the topic filter has drifted from goldScoring and the
 * test would be comparing the wrong populations.
 *
 * Output: artifacts/api-server/data/eval/gold/gold-eval-v0.5-significance.md
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const GOLD_DIR = path.resolve(
  __dirname,
  "../../artifacts/api-server/data/eval/gold",
);

interface PerTopic {
  topic_id: string;
  must_abstain: boolean;
  nRelevant: number;
  firstRelevantRank: number | null;
  relevantInTopK: number;
  no_gold_passage_reason?: string;
}

interface Report {
  runId: string;
  systemId: string;
  k: number;
  answerable: {
    nScored: number;
    mrr: number;
    recallAtK: number;
    hitAtK: number;
  };
  perTopic: PerTopic[];
}

const RUNS: { label: string; file: string }[] = [
  { label: "sparse", file: "gold-eval-v0.5-sparse-report.json" },
  { label: "dense", file: "gold-eval-v0.5-dense-report.json" },
  { label: "hybrid", file: "gold-eval-v0.5-report.json" },
  { label: "hybrid-tuned", file: "gold-eval-v0.5-hybrid-tuned-report.json" },
];

const PAIRS: [string, string][] = [
  ["hybrid", "sparse"],
  ["hybrid", "dense"],
  ["hybrid-tuned", "sparse"],
  ["hybrid-tuned", "dense"],
  ["hybrid-tuned", "hybrid"],
];

const N_RANDOMIZATION = 20_000;
const N_BOOTSTRAP = 10_000;
const SEED = 20260808;

/** Deterministic PRNG (mulberry32) so the report is reproducible. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function scoredTopics(r: Report): Map<string, PerTopic> {
  const m = new Map<string, PerTopic>();
  for (const t of r.perTopic) {
    if (t.must_abstain) continue;
    if (t.no_gold_passage_reason) continue;
    if (t.nRelevant === 0) continue; // unresolvable gold — outside denominators
    m.set(t.topic_id, t);
  }
  return m;
}

type MetricFn = (t: PerTopic) => number;
const METRICS: { name: string; fn: MetricFn }[] = [
  {
    name: "MRR",
    fn: (t) => (t.firstRelevantRank !== null ? 1 / t.firstRelevantRank : 0),
  },
  { name: "recall@10", fn: (t) => t.relevantInTopK / t.nRelevant },
  { name: "hit@10", fn: (t) => (t.firstRelevantRank !== null ? 1 : 0) },
];

function mean(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

/** Paired two-sided sign-flip randomization test p-value. */
function randomizationP(diffs: number[], rand: () => number): number {
  const observed = Math.abs(mean(diffs));
  if (diffs.every((d) => d === 0)) return 1;
  let extreme = 0;
  for (let i = 0; i < N_RANDOMIZATION; i++) {
    let s = 0;
    for (const d of diffs) s += rand() < 0.5 ? d : -d;
    if (Math.abs(s / diffs.length) >= observed - 1e-12) extreme++;
  }
  // +1 correction: the observed labelling is itself one arrangement.
  return (extreme + 1) / (N_RANDOMIZATION + 1);
}

/** Paired bootstrap percentile 95% CI of the mean difference. */
function bootstrapCi(diffs: number[], rand: () => number): [number, number] {
  const n = diffs.length;
  const means: number[] = [];
  for (let i = 0; i < N_BOOTSTRAP; i++) {
    let s = 0;
    for (let j = 0; j < n; j++) s += diffs[Math.floor(rand() * n)]!;
    means.push(s / n);
  }
  means.sort((a, b) => a - b);
  return [
    means[Math.floor(0.025 * N_BOOTSTRAP)]!,
    means[Math.ceil(0.975 * N_BOOTSTRAP) - 1]!,
  ];
}

function fmt(x: number, digits = 4): string {
  return (x >= 0 ? "+" : "") + x.toFixed(digits);
}

function main(): void {
  const reports = new Map<string, Report>();
  for (const { label, file } of RUNS) {
    reports.set(
      label,
      JSON.parse(readFileSync(path.join(GOLD_DIR, file), "utf8")) as Report,
    );
  }

  // Positive control: recomputed per-topic means must reproduce the stored
  // aggregates, proving the topic filter matches goldScoring's denominators.
  for (const [label, r] of reports) {
    const topics = [...scoredTopics(r).values()];
    if (topics.length !== r.answerable.nScored) {
      throw new Error(
        `${label}: scored-topic filter selected ${topics.length} topics, report says nScored=${r.answerable.nScored}`,
      );
    }
    const checks: [string, number, number][] = [
      ["mrr", mean(topics.map(METRICS[0]!.fn)), r.answerable.mrr],
      ["recallAtK", mean(topics.map(METRICS[1]!.fn)), r.answerable.recallAtK],
      ["hitAtK", mean(topics.map(METRICS[2]!.fn)), r.answerable.hitAtK],
    ];
    for (const [name, got, want] of checks) {
      if (Math.abs(got - want) > 1e-9) {
        throw new Error(
          `${label}: recomputed ${name}=${got} != report ${want} — filter drift`,
        );
      }
    }
    console.log(
      `ok   positive control: ${label} per-topic means reproduce the report aggregates (n=${topics.length})`,
    );
  }

  const lines: string[] = [];
  lines.push("# Gold v0.5 — paired significance tests");
  lines.push("");
  lines.push(
    "Paired two-sided sign-flip randomization test (20 000 resamples) and paired",
    "bootstrap percentile 95% CI (10 000 resamples) on the per-topic differences",
    "of the answerable scored topics (n=150; the same topics for every system,",
    "so all comparisons are paired). Deterministic seed: " + String(SEED) + ".",
    "Generated by `scripts/src/gold-significance.ts` from the persisted",
    "per-topic breakdowns of the four run reports; the script first verifies",
    "that the recomputed per-topic means reproduce each report's aggregate",
    "MRR/recall@10/hit@10 exactly, so the tested populations cannot drift from",
    "the scorer's denominators.",
  );
  lines.push("");
  lines.push(
    "nDCG@10 is not tested: the persisted per-topic primitives do not retain",
    "the graded ranking, so the aggregate nDCG in the comparison table remains",
    "descriptive only.",
  );
  lines.push("");
  lines.push("| pair | metric | Δ mean | 95% CI | p (randomization) |");
  lines.push("| --- | --- | --- | --- | --- |");

  const rand = mulberry32(SEED);
  const summary: string[] = [];
  for (const [a, b] of PAIRS) {
    const ra = reports.get(a)!;
    const rb = reports.get(b)!;
    const ta = scoredTopics(ra);
    const tb = scoredTopics(rb);
    const ids = [...ta.keys()].filter((id) => tb.has(id)).sort();
    if (ids.length !== ta.size || ids.length !== tb.size) {
      throw new Error(
        `${a} vs ${b}: scored topic sets differ (${ta.size}/${tb.size}/${ids.length} common) — not a paired comparison`,
      );
    }
    for (const { name, fn } of METRICS) {
      const diffs = ids.map((id) => fn(ta.get(id)!) - fn(tb.get(id)!));
      const p = randomizationP(diffs, rand);
      const [lo, hi] = bootstrapCi(diffs, rand);
      const row = `| ${a} vs ${b} | ${name} | ${fmt(mean(diffs))} | [${fmt(lo)}, ${fmt(hi)}] | ${p.toFixed(4)} |`;
      lines.push(row);
      summary.push(row);
    }
  }

  lines.push("");
  lines.push(
    "Reading: p is the probability, under the null of no systematic",
    "difference, of a mean per-topic difference at least as large in absolute",
    "value (sign-flip randomization, +1 correction). A CI excluding 0 agrees",
    "with a small p. With 15 comparisons, a Bonferroni-adjusted threshold of",
    "0.05/15 ≈ 0.0033 is the conservative significance bar.",
  );
  lines.push("");

  const out = path.join(GOLD_DIR, "gold-eval-v0.5-significance.md");
  writeFileSync(out, lines.join("\n") + "\n");
  console.log(`Wrote ${out}`);
  for (const row of summary) console.log(row);
}

main();
export {};
