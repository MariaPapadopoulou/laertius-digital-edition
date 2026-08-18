/**
 * Run detail: gold-qrels scoring for a registered run — answerable
 * metrics (MRR, recall@k, nDCG@k, hit@k) plus the abstention breakdown
 * reported PER SUBTYPE (out_of_corpus, false_premise,
 * underspecified_homonym), never merged (validate-abstain-reporting).
 */
import { useParams, Link } from "wouter";
import { ArrowLeft } from "lucide-react";
import {
  useGetEvalRunGoldScore,
  useListEvalRuns,
  useListEvalSnapshots,
  useListEvalTopicSets,
} from "@workspace/api-client-react";

import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";
import { formatDate } from "@/lib/utils";

const ABSTAIN_LABELS: Record<string, string> = {
  out_of_corpus: "Out of corpus",
  false_premise: "False premise",
  underspecified_homonym: "Underspecified homonym",
};

function pct(x: number): string {
  return `${(x * 100).toFixed(1)}%`;
}

function MetricCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-normal text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-mono">{value}</div>
        {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
      </CardContent>
    </Card>
  );
}

export default function RunDetail() {
  const params = useParams<{ id: string }>();
  const runId = params.id ?? "";

  const { data: score, isLoading, error } = useGetEvalRunGoldScore(runId);
  const { data: runs } = useListEvalRuns();
  const { data: snapshots } = useListEvalSnapshots();
  const { data: topicSets } = useListEvalTopicSets();

  const run = runs?.find((r) => r.id === runId);

  if (isLoading) {
    return <div className="py-10 text-center text-muted-foreground">Loading gold scores...</div>;
  }

  const errBody = (error as { response?: { data?: { error?: string } } } | null)
    ?.response?.data?.error;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/runs" className="hover:text-primary transition-colors flex items-center gap-1">
          <ArrowLeft className="h-3.5 w-3.5" /> Runs
        </Link>
      </div>

      <div>
        <h1 className="text-3xl font-serif mb-2 text-primary">
          {score?.systemId ?? run?.systemId ?? runId}
        </h1>
        <p className="text-muted-foreground text-sm">
          {run && <>Registered {formatDate(run.createdAt)} · {run.nLines.toLocaleString("en-GB")} ranked lines · </>}
          Snapshot:{" "}
          {snapshots?.find((s) => s.id === (score?.snapshotId ?? run?.snapshotId))?.label
            ?? score?.snapshotId ?? run?.snapshotId ?? "—"}{" "}
          · Topic set:{" "}
          {topicSets?.find((t) => t.id === (score?.topicSetId ?? run?.topicSetId))?.label
            ?? score?.topicSetId ?? run?.topicSetId ?? "—"}
        </p>
      </div>

      {!score ? (
        <div className="border border-dashed p-12 text-center text-muted-foreground bg-white">
          <h3 className="font-medium text-foreground mb-1">Gold scoring unavailable</h3>
          <p className="text-sm">
            {errBody ?? "This run could not be scored against the committed gold qrels."}
          </p>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-2">
            <Badge variant="outline">Gold set v{score.goldVersion}</Badge>
            <Badge variant="outline">k = {score.k}</Badge>
            <span className="text-xs text-muted-foreground">
              {score.qrelsRows.toLocaleString("en-GB")} qrels rows ·{" "}
              {score.qrelsTopics.toLocaleString("en-GB")} topics in qrels
            </span>
          </div>

          <section className="space-y-3">
            <h2 className="text-xl font-serif text-primary">Answerable topics</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <MetricCard label="MRR" value={score.answerable.mrr.toFixed(3)} />
              <MetricCard label={`Recall@${score.k}`} value={pct(score.answerable.recallAtK)} />
              <MetricCard label={`nDCG@${score.k}`} value={score.answerable.ndcgAtK.toFixed(3)} />
              <MetricCard
                label={`Hit@${score.k}`}
                value={pct(score.answerable.hitAtK)}
                hint={`${score.answerable.nScored} scored of ${score.answerable.nTopics} answerable topics`}
              />
            </div>
            {score.answerable.nScored < score.answerable.nTopics && (
              <p className="text-xs text-muted-foreground">
                {score.answerable.nTopics - score.answerable.nScored} answerable topic(s) have no
                resolvable gold passages and are excluded from the metric denominators.
              </p>
            )}
          </section>

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
                    <TableHead className="text-right">Topics</TableHead>
                    <TableHead className="text-right">With gold evidence</TableHead>
                    <TableHead className="text-right">Evidence hit@{score.k}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {score.abstainBySubtype.map((s) => (
                    <TableRow key={s.abstainType}>
                      <TableCell>
                        <span className="font-medium">{ABSTAIN_LABELS[s.abstainType] ?? s.abstainType}</span>{" "}
                        <code className="text-xs text-muted-foreground">{s.abstainType}</code>
                      </TableCell>
                      <TableCell className="text-right font-mono">{s.nTopics}</TableCell>
                      <TableCell className="text-right font-mono">{s.nWithEvidence}</TableCell>
                      <TableCell className="text-right font-mono">
                        {s.nWithEvidence > 0 ? `${s.evidenceHitAtK} / ${s.nWithEvidence}` : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </section>

          <Accordion type="single" collapsible>
            <AccordionItem value="per-topic">
              <AccordionTrigger className="text-sm">
                Per-topic detail ({score.perTopic.length} topics)
              </AccordionTrigger>
              <AccordionContent>
                <div className="bg-white border shadow-sm">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Topic</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead className="text-right">Gold passages</TableHead>
                        <TableHead className="text-right">First relevant rank</TableHead>
                        <TableHead className="text-right">Relevant in top {score.k}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {score.perTopic.map((t) => (
                        <TableRow key={t.topic_id}>
                          <TableCell className="font-mono text-xs">{t.topic_id}</TableCell>
                          <TableCell className="text-xs">
                            {t.must_abstain ? (
                              <Badge variant="secondary">
                                {ABSTAIN_LABELS[t.abstain_type ?? ""] ?? t.abstain_type ?? "abstain"}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground">answerable</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs">{t.nRelevant}</TableCell>
                          <TableCell className="text-right font-mono text-xs">
                            {t.firstRelevantRank ?? "—"}
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs">{t.relevantInTopK}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>

          {score.qrelsErrors.length > 0 && (
            <Accordion type="single" collapsible>
              <AccordionItem value="qrels-errors">
                <AccordionTrigger className="text-sm text-destructive">
                  Qrels resolution warnings ({score.qrelsErrors.length})
                </AccordionTrigger>
                <AccordionContent>
                  <ul className="list-disc pl-5 text-xs text-muted-foreground space-y-1">
                    {score.qrelsErrors.map((e, i) => (
                      <li key={i}>{e}</li>
                    ))}
                  </ul>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          )}
        </>
      )}
    </div>
  );
}
