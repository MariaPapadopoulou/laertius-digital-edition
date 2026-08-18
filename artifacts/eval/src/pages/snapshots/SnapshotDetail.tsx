import { useRoute } from "wouter";
import { useGetEvalSnapshot, getGetEvalSnapshotQueryKey } from "@workspace/api-client-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate } from "@/lib/utils";

export default function SnapshotDetail() {
  const [, params] = useRoute("/snapshots/:id");
  const id = params?.id || "";

  const { data: snapshot, isLoading, error } = useGetEvalSnapshot(id, {
    query: { enabled: !!id, queryKey: getGetEvalSnapshotQueryKey(id) }
  });

  if (isLoading) {
    return <div className="py-10 text-center text-muted-foreground">Loading...</div>;
  }

  if (error || !snapshot) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" className="-ml-4" onClick={() => window.history.back()}>
          Back
        </Button>
        <div className="py-10 text-center text-destructive">Snapshot not found.</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
        <Link href="/snapshots" className="hover:text-primary transition-colors flex items-center gap-1">
          Snapshots
        </Link>
        <span>/</span>
        <span className="text-foreground">{snapshot.label}</span>
      </div>

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-serif mb-2 text-primary flex items-center gap-3">
            {snapshot.label}
          </h1>
          <div className="flex items-center gap-4 text-sm font-mono text-muted-foreground">
            <span>{formatDate(snapshot.createdAt)}</span>
            <span>•</span>
            <span className="truncate max-w-md" title={snapshot.sha256}>
              hash: {snapshot.sha256.substring(0, 12)}...
            </span>
          </div>
        </div>
        
        <Button variant="outline" onClick={() => window.location.href = `/api/eval/snapshots/${id}/corpus.jsonl`}>
          Download corpus.jsonl
        </Button>
      </div>

      {snapshot.note && (
        <Card className="bg-paper border-none shadow-none text-muted-foreground">
          <CardContent className="p-4 py-3">
            {snapshot.note}
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="md:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="space-y-4">
              <div>
                <dt className="text-xs uppercase tracking-widest text-muted-foreground mb-1">Total Passages</dt>
                <dd className="text-2xl font-mono text-primary">{snapshot.nPassages.toLocaleString('en-GB')}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-widest text-muted-foreground mb-1">Freeze Date</dt>
                <dd className="font-medium">{formatDate(snapshot.createdAt)}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Distribution by Book
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-24">Book</TableHead>
                  <TableHead className="text-right">Passages</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {snapshot.byBook.map((b: any) => (
                  <TableRow key={b.book}>
                    <TableCell className="font-medium">Book {b.book}</TableCell>
                    <TableCell className="text-right font-mono">{b.passages.toLocaleString('en-GB')}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
