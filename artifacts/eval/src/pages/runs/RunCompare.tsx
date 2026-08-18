/**
 * Run comparison: gold-qrels scores for 2+ registered runs side by side.
 * Answerable metrics (MRR, recall@k, nDCG@k, hit@k) get delta columns vs
 * the first (baseline) run. Abstention rows stay PER SUBTYPE
 * (out_of_corpus, false_premise, underspecified_homonym) — never merged
 * (validate-abstain-reporting conventions).
 */
import { useState } from "react";
import { Link, useSearch } from "wouter";
import { ArrowLeft } from "lucide-react";
import { useQueries } from "@tanstack/react-query";
import {
  getGetEvalRunGoldScoreQueryOptions,
  getGetEvalTopicSetQueryKey,
  useGetEvalTopicSet,
  useListEvalRuns,
  useListEvalSnapshots,
  useListEvalTopicSets,
  type EvalGoldPerTopic,
  type EvalRunGoldScore,
} from "@workspace/api-client-react";

import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

const ABSTAIN_LABELS: Record<string, string> = {
  out_of_corpus: "Out of corpus",
  false_premise: "False premise",
  underspecified_homonym: "Underspecified homonym",
};

type MetricDef = {
  key: "mrr" | "recallAtK" | "ndcgAtK" | "hitAtK";
  label: (k: number) => string;
  fmt: (x: number) => string;
};

function pct(x: number): string {
  return `${(x * 100).toFixed(1)}%`;
}

const METRICS: MetricDef[] = [
  { key: "mrr", label: () => "MRR", fmt: (x) => x.toFixed(3) },
  { key: "recallAtK", label: (k) => `Recall@${k}`, fmt: pct },
  { key: "ndcgAtK", label: (k) => `nDCG@${k}`, fmt: (x) => x.toFixed(3) },
  { key: "hitAtK", label: (k) => `Hit@${k}`, fmt: pct },
];

function DeltaBadge({ delta, fmt }: { delta: number; fmt: (x: number) => string }) {
  if (Math.abs(delta) < 1e-9) {
    return <span className="text-xs text-muted-foreground ml-2">±0</span>;
  }
  const positive = delta > 0;
  return (
    <span
      className={`text-xs ml-2 font-mono ${positive ? "text-green-700" : "text-destructive"}`}
      data-testid={`delta-${positive ? "up" : "down"}`}
    >
      {positive ? "+" : "−"}{fmt(Math.abs(delta))}
    </span>
  );
}

export default function RunCompare() {
  const search = useSearch();
  const ids = (new URLSearchParams(search).get("ids") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  // Per-topic diff filters. "all" disables the respective filter.
  const [typeFilter, setTypeFilter] = useState("all");
  const [subtypeFilter, setSubtypeFilter] = useState("all");

  const { data: runs } = useListEvalRuns();
  const { data: snapshots } = useListEvalSnapshots();
  const { data: topicSets } = useListEvalTopicSets();

  const results = useQueries({
    queries: ids.map((id) => getGetEvalRunGoldScoreQueryOptions(id)),
  });

  const isLoading = results.some((r) => r.isLoading);

  // Topic set of the first scored run — used to show question text in the
  // per-topic diff. Loaded lazily; the diff renders ids alone until it arrives.
  const diffTopicSetId =
    results.find((r) => r.data)?.data?.topicSetId ?? "";
  const { data: diffTopicSet } = useGetEvalTopicSet(diffTopicSetId, {
    query: {
      enabled: !!diffTopicSetId,
      queryKey: getGetEvalTopicSetQueryKey(diffTopicSetId),
    },
  });

  const header = (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <Link href="/runs" className="hover:text-primary transition-colors flex items-center gap-1">
        <ArrowLeft className="h-3.5 w-3.5" /> Runs
      </Link>
    </div>
  );

  if (ids.length < 2) {
    return (
      <div className="space-y-6">
        {header}
        <div className="border border-dashed p-12 text-center text-muted-foreground bg-white">
          <h3 className="font-medium text-foreground mb-1">Select at least two runs</h3>
          <p className="text-sm">
            Pick two or more runs on the Runs page and choose Compare to see their gold scores side by side.
          </p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return <div className="py-10 text-center text-muted-foreground">Loading gold scores...</div>;
  }

  type Column = {
    id: string;
    systemId: string;
    score: EvalRunGoldScore | null;
    error?: string;
  };

  const columns: Column[] = ids.map((id, i) => {
    const res = results[i];
    const run = runs?.find((r) => r.id === id);
    const errBody = (res?.error as { response?: { data?: { error?: string } } } | null)
      ?.response?.data?.error;
    return {
      id,
      systemId: res?.data?.systemId ?? run?.systemId ?? id,
      score: res?.data ?? null,
      error: res?.data ? undefined : (errBody ?? "Gold scoring unavailable for this run."),
    };
  });

  const baseline = columns.find((c) => c.score) ?? columns[0];
  const k = baseline.score?.k;

  // Union of abstain subtypes across all runs, preserving first-seen order —
  // each subtype keeps its own row, never merged.
  const subtypeOrder: string[] = [];
  for (const c of columns) {
    for (const s of c.score?.abstainBySubtype ?? []) {
      if (!subtypeOrder.includes(s.abstainType)) subtypeOrder.push(s.abstainType);
    }
  }

  // ---- Per-topic diff (pairwise: baseline vs the next scored run) ----------
  const colA = baseline.score ? baseline : null;
  const colB = columns.find((c) => c.score && c.id !== baseline.id) ?? null;

  type DiffRow = {
    topicId: string;
    question?: string;
    abstainType?: string;
    a: EvalGoldPerTopic | null;
    b: EvalGoldPerTopic | null;
  };

  const diffGroups: { aWins: DiffRow[]; bWins: DiffRow[]; bothMiss: DiffRow[] } = {
    aWins: [],
    bWins: [],
    bothMiss: [],
  };

  if (colA?.score && colB?.score) {
    const questionById = new Map<string, string>(
      (diffTopicSet?.topics ?? []).map((t: { topic_id: string; question: string }) => [
        t.topic_id,
        t.question,
      ]),
    );
    const byIdA = new Map(colA.score.perTopic.map((t) => [t.topic_id, t]));
    const byIdB = new Map(colB.score.perTopic.map((t) => [t.topic_id, t]));
    const topicIds = [...new Set([...byIdA.keys(), ...byIdB.keys()])];

    for (const topicId of topicIds) {
      const a = byIdA.get(topicId) ?? null;
      const b = byIdB.get(topicId) ?? null;
      const rankA = a?.firstRelevantRank ?? null;
      const rankB = b?.firstRelevantRank ?? null;
      const row: DiffRow = {
        topicId,
        question: questionById.get(topicId),
        abstainType: (a ?? b)?.must_abstain
          ? ((a ?? b)?.abstain_type ?? "abstain")
          : undefined,
        a,
        b,
      };
      if (rankA === null && rankB === null) {
        diffGroups.bothMiss.push(row);
      } else if (rankB === null || (rankA !== null && rankA < rankB)) {
        diffGroups.aWins.push(row);
      } else if (rankA === null || rankB < rankA) {
        diffGroups.bWins.push(row);
      }
      // equal ranks: not a diff — omitted
    }
    const byRank = (r: DiffRow) =>
      r.a?.firstRelevantRank ?? r.b?.firstRelevantRank ?? Number.MAX_SAFE_INTEGER;
    diffGroups.aWins.sort((x, y) => byRank(x) - byRank(y));
    diffGroups.bWins.sort((x, y) => byRank(x) - byRank(y));
    diffGroups.bothMiss.sort((x, y) => x.topicId.localeCompare(y.topicId));
  }

  // ---- Diff filters -------------------------------------------------------
  // Question-type prefix, derived from topic ids like "biography-001".
  const typePrefixOf = (topicId: string) => topicId.replace(/-\d+$/, "");
  const allDiffRows = [...diffGroups.aWins, ...diffGroups.bWins, ...diffGroups.bothMiss];
  const typePrefixes = [...new Set(allDiffRows.map((r) => typePrefixOf(r.topicId)))].sort();
  const subtypesInDiff = [
    ...new Set(allDiffRows.map((r) => r.abstainType).filter((s): s is string => !!s)),
  ];

  const matchesFilters = (row: DiffRow) =>
    (typeFilter === "all" || typePrefixOf(row.topicId) === typeFilter) &&
    (subtypeFilter === "all" ||
      (subtypeFilter === "answerable" ? !row.abstainType : row.abstainType === subtypeFilter));

  const filteredGroups = {
    aWins: diffGroups.aWins.filter(matchesFilters),
    bWins: diffGroups.bWins.filter(matchesFilters),
    bothMiss: diffGroups.bothMiss.filter(matchesFilters),
  };
  const filtersActive = typeFilter !== "all" || subtypeFilter !== "all";
  // Groups above this size start collapsed (expandable on demand).
  const COLLAPSE_THRESHOLD = 15;

  const mixedContext = columns.some(
    (c) =>
      c.score &&
      baseline.score &&
      (c.score.topicSetId !== baseline.score.topicSetId ||
        c.score.snapshotId !== baseline.score.snapshotId),
  );

  return (
    <div className="space-y-6">
      {header}

      <div>
        <h1 className="text-3xl font-serif mb-2 text-primary">Compare runs</h1>
        <p className="text-muted-foreground text-sm">
          Gold-qrels scores for {columns.length} runs side by side. Deltas are
          relative to the first run ({baseline.systemId}).
        </p>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        {baseline.score && (
          <>
            <Badge variant="outline">Gold set v{baseline.score.goldVersion}</Badge>
            <Badge variant="outline">k = {baseline.score.k}</Badge>
          </>
        )}
        {columns.map((c) => {
          const run = runs?.find((r) => r.id === c.id);
          const snapshotLabel =
            snapshots?.find((s) => s.id === (c.score?.snapshotId ?? run?.snapshotId))?.label
            ?? c.score?.snapshotId ?? run?.snapshotId ?? "—";
          const topicSetLabel =
            topicSets?.find((t) => t.id === (c.score?.topicSetId ?? run?.topicSetId))?.label
            ?? c.score?.topicSetId ?? run?.topicSetId ?? "—";
          return (
            <span key={c.id} className="text-xs text-muted-foreground">
              <Link href={`/runs/${c.id}`} className="font-mono underline underline-offset-2 hover:text-primary">
                {c.systemId}
              </Link>
              {" "}({snapshotLabel} · {topicSetLabel})
            </span>
          );
        })}
      </div>

      {mixedContext && (
        <p className="text-sm text-destructive">
          Warning: the selected runs were scored against different snapshots or
          topic sets — metric deltas are not directly comparable.
        </p>
      )}

      {columns.some((c) => !c.score) && (
        <div className="border border-dashed p-4 text-sm text-muted-foreground bg-white space-y-1">
          {columns.filter((c) => !c.score).map((c) => (
            <p key={c.id}>
              <span className="font-mono">{c.systemId}</span>: {c.error}
            </p>
          ))}
        </div>
      )}

      {baseline.score && (
        <>
          <section className="space-y-3">
            <h2 className="text-xl font-serif text-primary">Answerable topics</h2>
            <div className="bg-white border shadow-sm">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Metric</TableHead>
                    {columns.map((c) => (
                      <TableHead key={c.id} className="text-right font-mono">
                        {c.systemId}
                        {c.id === baseline.id && (
                          <span className="ml-1 text-xs text-muted-foreground font-sans">(baseline)</span>
                        )}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {METRICS.map((m) => (
                    <TableRow key={m.key}>
                      <TableCell className="font-medium">{m.label(k ?? 0)}</TableCell>
                      {columns.map((c) => {
                        if (!c.score) {
                          return <TableCell key={c.id} className="text-right text-muted-foreground">—</TableCell>;
                        }
                        const value = c.score.answerable[m.key];
                        const baseValue = baseline.score!.answerable[m.key];
                        return (
                          <TableCell key={c.id} className="text-right font-mono">
                            {m.fmt(value)}
                            {c.id !== baseline.id && (
                              <DeltaBadge delta={value - baseValue} fmt={m.fmt} />
                            )}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))}
                  <TableRow>
                    <TableCell className="font-medium">Scored / answerable topics</TableCell>
                    {columns.map((c) => (
                      <TableCell key={c.id} className="text-right font-mono text-xs">
                        {c.score
                          ? `${c.score.answerable.nScored} / ${c.score.answerable.nTopics}`
                          : "—"}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </section>

          {colA?.score && colB?.score && (
            <section className="space-y-3" data-testid="per-topic-diff">
              <h2 className="text-xl font-serif text-primary">Per-topic diff</h2>
              <p className="text-sm text-muted-foreground">
                Topics where <span className="font-mono">{colA.systemId}</span> (A) and{" "}
                <span className="font-mono">{colB.systemId}</span> (B) place their first
                relevant passage at different ranks
                {columns.filter((c) => c.score).length > 2
                  ? " — only the first two scored runs are diffed"
                  : ""}
                . Abstention topics keep their subtype label.{" "}
                <Link
                  href={`/topics/${colA.score.topicSetId}`}
                  className="underline underline-offset-2 hover:text-primary"
                >
                  View topic set
                </Link>
              </p>
              <div className="flex items-center gap-4 flex-wrap text-sm" data-testid="diff-filters">
                <label className="flex items-center gap-2">
                  <span className="text-muted-foreground">Question type</span>
                  <select
                    value={typeFilter}
                    onChange={(e) => setTypeFilter(e.target.value)}
                    className="border bg-white px-2 py-1 text-sm"
                    data-testid="diff-filter-type"
                  >
                    <option value="all">All types</option>
                    {typePrefixes.map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </label>
                <label className="flex items-center gap-2">
                  <span className="text-muted-foreground">Abstention subtype</span>
                  <select
                    value={subtypeFilter}
                    onChange={(e) => setSubtypeFilter(e.target.value)}
                    className="border bg-white px-2 py-1 text-sm"
                    data-testid="diff-filter-subtype"
                  >
                    <option value="all">All topics</option>
                    <option value="answerable">Answerable only (no abstention)</option>
                    {subtypesInDiff.map((s) => (
                      <option key={s} value={s}>{ABSTAIN_LABELS[s] ?? s}</option>
                    ))}
                  </select>
                </label>
                {filtersActive && (
                  <button
                    type="button"
                    onClick={() => { setTypeFilter("all"); setSubtypeFilter("all"); }}
                    className="underline underline-offset-2 text-muted-foreground hover:text-primary"
                    data-testid="diff-filter-clear"
                  >
                    Clear filters
                  </button>
                )}
              </div>
              {(
                [
                  { key: "aWins", title: `A wins (${colA.systemId})`, rows: filteredGroups.aWins, total: diffGroups.aWins.length },
                  { key: "bWins", title: `B wins (${colB.systemId})`, rows: filteredGroups.bWins, total: diffGroups.bWins.length },
                  { key: "bothMiss", title: "Both miss", rows: filteredGroups.bothMiss, total: diffGroups.bothMiss.length },
                ] as const
              ).map((group) => (
                <details
                  key={`${group.key}-${typeFilter}-${subtypeFilter}`}
                  className="bg-white border shadow-sm"
                  data-testid={`diff-${group.key}`}
                  open={group.rows.length > 0 && group.rows.length <= COLLAPSE_THRESHOLD}
                >
                  <summary className="px-4 py-2 border-b flex items-baseline gap-2 cursor-pointer select-none list-none [&::-webkit-details-marker]:hidden">
                    <h3 className="font-medium">{group.title}</h3>
                    <span className="text-xs text-muted-foreground font-mono">
                      {group.rows.length}
                      {filtersActive ? ` of ${group.total}` : ""} topics
                    </span>
                    {group.rows.length > COLLAPSE_THRESHOLD && (
                      <span className="text-xs text-muted-foreground ml-auto">
                        expand / collapse
                      </span>
                    )}
                  </summary>
                  {group.rows.length === 0 ? (
                    <p className="px-4 py-3 text-sm text-muted-foreground">
                      {group.total > 0 && filtersActive
                        ? "No topics match the current filters."
                        : "No topics."}
                    </p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Topic</TableHead>
                          <TableHead className="text-right font-mono">A rank</TableHead>
                          <TableHead className="text-right font-mono">B rank</TableHead>
                          <TableHead className="text-right font-mono">A in top k</TableHead>
                          <TableHead className="text-right font-mono">B in top k</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {group.rows.map((row) => (
                          <TableRow key={row.topicId}>
                            <TableCell>
                              <Link
                                href={`/topics/${colA.score!.topicSetId}#${encodeURIComponent(row.topicId)}`}
                                className="font-mono text-xs underline underline-offset-2 hover:text-primary"
                                data-testid={`diff-topic-link-${row.topicId}`}
                              >
                                {row.topicId}
                              </Link>
                              {row.question && (
                                <span className="block text-sm">{row.question}</span>
                              )}
                              {row.abstainType && (
                                <Badge variant="destructive" className="font-mono text-[10px] mt-1">
                                  {ABSTAIN_LABELS[row.abstainType] ?? row.abstainType}
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-right font-mono">
                              {row.a?.firstRelevantRank ?? "—"}
                            </TableCell>
                            <TableCell className="text-right font-mono">
                              {row.b?.firstRelevantRank ?? "—"}
                            </TableCell>
                            <TableCell className="text-right font-mono text-xs">
                              {row.a ? `${row.a.relevantInTopK} / ${row.a.nRelevant}` : "—"}
                            </TableCell>
                            <TableCell className="text-right font-mono text-xs">
                              {row.b ? `${row.b.relevantInTopK} / ${row.b.nRelevant}` : "—"}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </details>
              ))}
            </section>
          )}

          <section className="space-y-3">
            <h2 className="text-xl font-serif text-primary">Abstention topics, by subtype</h2>
            <p className="text-sm text-muted-foreground">
              Each abstention subtype is reported separately — subtypes are never merged.
            </p>
            <div className="bg-white border shadow-sm">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Subtype</TableHead>
                    {columns.map((c) => (
                      <TableHead key={c.id} className="text-right font-mono">
                        {c.systemId}
                        <span className="block text-xs text-muted-foreground font-sans">
                          evidence hit@{c.score?.k ?? k}
                        </span>
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {subtypeOrder.map((subtype) => (
                    <TableRow key={subtype}>
                      <TableCell>
                        <span className="font-medium">{ABSTAIN_LABELS[subtype] ?? subtype}</span>{" "}
                        <code className="text-xs text-muted-foreground">{subtype}</code>
                      </TableCell>
                      {columns.map((c) => {
                        const s = c.score?.abstainBySubtype.find((x) => x.abstainType === subtype);
                        if (!s) {
                          return <TableCell key={c.id} className="text-right text-muted-foreground">—</TableCell>;
                        }
                        return (
                          <TableCell key={c.id} className="text-right font-mono">
                            {s.nWithEvidence > 0
                              ? `${s.evidenceHitAtK} / ${s.nWithEvidence}`
                              : "—"}
                            <span className="block text-xs text-muted-foreground">
                              {s.nTopics} topics · {s.nWithEvidence} with evidence
                            </span>
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
