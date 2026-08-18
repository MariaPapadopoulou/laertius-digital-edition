import { useEffect, useState } from "react";
import { useRoute } from "wouter";
import { useGetEvalTopicSet, getGetEvalTopicSetQueryKey } from "@workspace/api-client-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";

export default function TopicDetail() {
  const [, params] = useRoute("/topics/:id");
  const id = params?.id || "";

  const { data: ts, isLoading, error } = useGetEvalTopicSet(id, {
    query: { enabled: !!id, queryKey: getGetEvalTopicSetQueryKey(id) }
  });

  // Row-level anchors: /topics/:id#<topic_id> scrolls to and highlights the
  // matching topic row once the data has rendered. wouter routes on pathname
  // only, so the hash survives SPA navigation in window.location.hash.
  const [highlightId, setHighlightId] = useState<string | null>(null);
  useEffect(() => {
    if (!ts) return;
    const hash = decodeURIComponent(window.location.hash.replace(/^#/, ""));
    if (!hash) return;
    setHighlightId(hash);
    // rAF so the table rows exist before we try to scroll (SPA scroll-restore
    // convention: retry via rAF rather than trusting immediate layout).
    let attempts = 0;
    const tryScroll = () => {
      const el = document.getElementById(`topic-${hash}`);
      if (el) {
        el.scrollIntoView({ block: "center" });
      } else if (attempts++ < 10) {
        requestAnimationFrame(tryScroll);
      }
    };
    requestAnimationFrame(tryScroll);
  }, [ts]);

  if (isLoading) {
    return <div className="py-10 text-center text-muted-foreground">Loading...</div>;
  }

  if (error || !ts) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" className="-ml-4" onClick={() => window.history.back()}>
          Back
        </Button>
        <div className="py-10 text-center text-destructive">Topic set not found.</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
        <Link href="/topics" className="hover:text-primary transition-colors flex items-center gap-1">
          Topic Sets
        </Link>
        <span>/</span>
        <span className="text-foreground">{ts.label}</span>
      </div>

      <div>
        <h1 className="text-3xl font-serif mb-2 text-primary flex items-center gap-3">
          {ts.label}
        </h1>
        <div className="flex items-center gap-4 text-sm font-mono text-muted-foreground">
          <span>{formatDate(ts.createdAt)}</span>
          <span>•</span>
          <span>{ts.nTopics} topics</span>
          {ts.nAbstain ? (
            <>
              <span>•</span>
              <span>
                {ts.nAbstain} abstentions
                {(ts.byAbstainType ?? []).length
                  ? " (" + (ts.byAbstainType ?? []).map((a: any) => `${a.name}: ${a.count}`).join(", ") + ")"
                  : ""}
              </span>
            </>
          ) : null}
        </div>
      </div>

      {ts.note && (
        <Card className="bg-paper border-none shadow-none text-muted-foreground">
          <CardContent className="p-4 py-3">
            {ts.note}
          </CardContent>
        </Card>
      )}

      <div className="bg-white border shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-24">ID</TableHead>
              <TableHead>Query</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Abstain</TableHead>
              <TableHead>Split</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {ts.topics.map((topic: any) => (
              <TableRow
                key={topic.topic_id}
                id={`topic-${topic.topic_id}`}
                data-testid={`topic-row-${topic.topic_id}`}
                className={
                  highlightId === topic.topic_id
                    ? "bg-amber-50 ring-1 ring-inset ring-amber-300"
                    : undefined
                }
              >
                <TableCell className="font-mono text-xs text-muted-foreground font-medium">
                  {topic.topic_id}
                </TableCell>
                <TableCell className="font-medium text-base">
                  {topic.question}
                </TableCell>
                <TableCell>
                  {topic.question_type ? (
                    <Badge variant="outline" className="font-mono text-[10px]">
                      {topic.question_type}
                    </Badge>
                  ) : "—"}
                </TableCell>
                <TableCell>
                  {topic.must_abstain ? (
                    <Badge variant="destructive" className="font-mono text-[10px]">
                      {topic.abstain_type ?? "abstain"}
                    </Badge>
                  ) : "—"}
                </TableCell>
                <TableCell>
                  {topic.split ? (
                    <Badge variant="secondary" className="font-mono text-[10px]">
                      {topic.split}
                    </Badge>
                  ) : "—"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
