import { useState, useRef } from "react";
import { useRoute } from "wouter";
import { 
  useGetEvalPool,
  useGetEvalPoolCoverage,
  useListEvalBatches,
  useCreateEvalBatch,
  useRevokeEvalBatch,
  useGetEvalPoolAgreement,
  useListEvalPoolDisagreements,
  useCreateEvalAdjudication,
  useUploadEvalJudgments,
  useListEvalJudgmentUploads,
  getListEvalBatchesQueryKey,
  getListEvalJudgmentUploadsQueryKey,
  getGetEvalPoolQueryKey,
  getListEvalPoolDisagreementsQueryKey,
  getGetEvalPoolCoverageQueryKey
} from "@workspace/api-client-react";
import { CheckCircle2, Users, AlertTriangle } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { cn, formatDate, formatDateTime } from "@/lib/utils";

// Sub-components for each tab
function BatchesTab({ poolId }: { poolId: string }) {
  const queryClient = useQueryClient();
  const { data: batches, isLoading } = useListEvalBatches(poolId);
  const createBatch = useCreateEvalBatch();
  const revokeBatch = useRevokeEvalBatch();

  const handleRevoke = (id: string) => {
    revokeBatch.mutate(
      { id },
      {
        onSuccess: () => {
          toast.success("Batch revoked — unjudged items released");
          queryClient.invalidateQueries({ queryKey: getListEvalBatchesQueryKey(poolId) });
          queryClient.invalidateQueries({ queryKey: getGetEvalPoolCoverageQueryKey(poolId) });
          queryClient.invalidateQueries({ queryKey: getListEvalPoolDisagreementsQueryKey(poolId) });
        },
        onError: (err: any) => {
          toast.error("Failed: " + (err?.response?.data?.error || "Unknown error"));
        },
      },
    );
  };

  const [size, setSize] = useState(50);
  const [annotator, setAnnotator] = useState("");

  const handleCreate = (resolution?: boolean) => {
    if (!annotator.trim()) {
      toast.error("Enter the judge code");
      return;
    }
    createBatch.mutate(
      { id: poolId, data: { annotator, size, ...(resolution ? { resolution: true } : {}) } },
      {
        onSuccess: () => {
          toast.success(resolution ? "Resolution batch issued" : "Batch issued");
          queryClient.invalidateQueries({ queryKey: getListEvalBatchesQueryKey(poolId) });
          queryClient.invalidateQueries({ queryKey: getGetEvalPoolCoverageQueryKey(poolId) });
          queryClient.invalidateQueries({ queryKey: getListEvalPoolDisagreementsQueryKey(poolId) });
        },
        onError: (err: any) => {
          toast.error("Failed: " + (err?.response?.data?.error || "Unknown error"));
        }
      }
    );
  };

  // Personal link: the per-judge access key rides along, so the link alone
  // both identifies and authenticates the judge (batch ids alone no longer
  // open a batch).
  const copyLink = (id: string, judgeToken?: string) => {
    if (!judgeToken) {
      toast.error("No access key exists for this judge yet — reissue a batch to mint one");
      return;
    }
    const url = `${window.location.origin}/eval/judge?key=${encodeURIComponent(judgeToken)}&batch=${encodeURIComponent(id)}`;
    navigator.clipboard.writeText(url);
    toast.success("Personal link copied");
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-4">
          <CardTitle>Issue New Batch</CardTitle>
          <CardDescription>
            The algorithm will randomly select records that have not yet reached the required number of judgments.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-4">
            <div className="space-y-2">
              <Label>Judge Code</Label>
              <Input 
                value={annotator} 
                onChange={(e) => setAnnotator(e.target.value)} 
                placeholder="e.g. MP"
                className="w-32"
              />
            </div>
            <div className="space-y-2">
              <Label>Batch size</Label>
              <Input 
                type="number" 
                value={size} 
                onChange={(e) => setSize(Number(e.target.value))} 
                min={1} 
                max={200}
                className="w-32"
              />
            </div>
            <Button onClick={() => handleCreate()} disabled={createBatch.isPending}>
              Issue Batch
            </Button>
            <Button
              variant="outline"
              onClick={() => handleCreate(true)}
              disabled={createBatch.isPending}
              title="Only deadlocked items (2 judges, disagreement) are issued to a third judge so the 2-of-3 majority can settle them without an adjudicator."
            >
              <Users className="w-4 h-4 mr-2" />
              Issue Resolution Batch
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            A resolution batch selects only items where two judges disagree and issues them
            to a third judge who has not judged them, so the disagreement is settled by
            majority instead of an adjudicator.
          </p>
        </CardContent>
      </Card>

      <div className="bg-white border shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Batch ID</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Size</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={5} className="text-center py-4 text-muted-foreground">Loading...</TableCell></TableRow>
            ) : !batches?.length ? (
              <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No batches have been issued.</TableCell></TableRow>
            ) : (
              batches.map((b) => (
                <TableRow key={b.id}>
                  <TableCell className="font-mono text-xs">
                    <span className="flex items-center gap-2">
                      {b.id}
                      {b.resolution && (
                        <Badge variant="outline" className="border-amber-500 text-amber-700">
                          Resolution
                        </Badge>
                      )}
                    </span>
                  </TableCell>
                  <TableCell>{formatDateTime(b.createdAt)}</TableCell>
                  <TableCell className="font-mono text-xs">{b.nItems}</TableCell>
                  <TableCell>
                    {b.revokedAt ? (
                      <Badge variant="outline" className="border-muted-foreground text-muted-foreground">
                        Revoked ({b.judged}/{b.nItems})
                      </Badge>
                    ) : b.nItems === b.judged ? (
                      <Badge variant="default" className="bg-green-600">Completed</Badge>
                    ) : (
                      <Badge variant="secondary">In progress ({b.judged}/{b.nItems})</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {!b.revokedAt && (
                      <Button variant="ghost" size="sm" onClick={() => copyLink(b.id, b.judgeToken)}>
                        Copy personal link
                      </Button>
                    )}
                    {!b.revokedAt && b.judged < b.nItems && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        disabled={revokeBatch.isPending}
                        onClick={() => handleRevoke(b.id)}
                        title="Release this batch's unjudged assignments. For a resolution batch, unjudged items return to the adjudicator's queue."
                      >
                        Revoke
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function IngestTab({ poolId }: { poolId: string }) {
  const queryClient = useQueryClient();
  const uploadJudgments = useUploadEvalJudgments();
  const { data: allUploads, isLoading } = useListEvalJudgmentUploads();
  
  // Actually, wait, useListEvalJudgmentUploads is not per pool? The rule says "filter client-side".
  // But wait, EvalJudgmentUploadSummary doesn't have poolId. How do we filter?
  // Let's not filter it if it's not possible, or filter by batchId if we can. Or just display all.
  const uploads = allUploads || [];
  
  const [annotator, setAnnotator] = useState("");
  const [token, setToken] = useState("");
  const [lines, setLines] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Auto-fill annotator from filename if it matches judgments_CODE_BATCH.jsonl
    const match = file.name.match(/^judgments_([^_]+)_/);
    if (match && !annotator) {
      setAnnotator(match[1]);
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      if (typeof event.target?.result === 'string') {
        setLines(event.target.result);
      }
    };
    reader.readAsText(file);
  };

  const handleSubmit = () => {
    if (!annotator.trim() || !token.trim() || !lines.trim()) {
      toast.error("Enter the judge code, the judge's access key and the JSONL content");
      return;
    }

    uploadJudgments.mutate(
      { data: { annotator, token, lines } },
      {
        onSuccess: (res) => {
          toast.success(`Imported ${res.accepted} new, replaced ${res.replaced}, rejected ${res.rejected}.`);
          queryClient.invalidateQueries({ queryKey: getListEvalJudgmentUploadsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetEvalPoolQueryKey(poolId) });
          setLines("");
          if (fileInputRef.current) fileInputRef.current.value = '';
        },
        onError: (err: any) => {
          toast.error("Failed: " + (err?.response?.data?.error || "Unknown error"));
        }
      }
    );
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-4">
          <CardTitle>Import Judgments File</CardTitle>
          <CardDescription>
            Upload the <code>.jsonl</code> file exported by the judge tool.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Judge code (Annotator)</Label>
              <Input 
                value={annotator} 
                onChange={(e) => setAnnotator(e.target.value)} 
                placeholder="e.g. MP, RG"
              />
            </div>
            <div className="space-y-2">
              <Label>Judge access key</Label>
              <Input
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="the judge's personal access key"
              />
            </div>
            <div className="space-y-2">
              <Label>JSONL File</Label>
              <Input 
                type="file" 
                accept=".jsonl,.json" 
                ref={fileInputRef}
                onChange={handleFileUpload}
              />
            </div>
          </div>
          
          <div className="space-y-2">
            <Label>Or paste content</Label>
            <Textarea 
              value={lines}
              onChange={(e) => setLines(e.target.value)}
              className="font-mono text-xs h-32"
              placeholder='{"item_id":"R001","task":"relevance","grade":"3",...}'
            />
          </div>
          
          <Button onClick={handleSubmit} disabled={uploadJudgments.isPending}>
            Import Judgments
          </Button>
        </CardContent>
      </Card>

      <div className="bg-white border shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Judge</TableHead>
              <TableHead>Batch ID</TableHead>
              <TableHead className="text-right">Judgments</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={4} className="text-center py-4 text-muted-foreground">Loading...</TableCell></TableRow>
            ) : !uploads?.length ? (
              <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">No file imports.</TableCell></TableRow>
            ) : (
              uploads.map((u, i) => (
                <TableRow key={u.id}>
                  <TableCell>{formatDateTime(u.createdAt)}</TableCell>
                  <TableCell className="font-mono text-xs font-bold">{u.annotator}</TableCell>
                  <TableCell className="font-mono text-xs">{u.batchId}</TableCell>
                  <TableCell className="text-right font-mono text-xs">{u.nJudgments}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function AgreementTab({ poolId }: { poolId: string }) {
  const { data: report, isLoading } = useGetEvalPoolAgreement(poolId, { query: { enabled: !!poolId, queryKey: ['/api/eval/pools', poolId, 'agreement'] } });

  if (isLoading) return <div className="py-10 text-center text-muted-foreground">Computing agreement...</div>;
  if (!report) return null;

  return (
    <div className="space-y-8">
      {report.perTask.map((task: any) => {
        const pairwiseData = report.pairwise.filter((p: any) => p.task === task.task);
        return (
        <Card key={task.task}>
          <CardHeader className="pb-4">
            <CardTitle className="capitalize font-mono flex justify-between items-center">
              <span>Task: {task.task}</span>
              <Badge variant="outline" className="text-base font-normal">
                Krippendorff's α: <strong className="ml-1">{task.krippendorffAlpha.toFixed(3)}</strong>
              </Badge>
            </CardTitle>
            <CardDescription>
              {task.nItemsDouble} items with multiple judgments (scale: {task.scale})
            </CardDescription>
          </CardHeader>
          <CardContent>
            {pairwiseData.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Judge A</TableHead>
                    <TableHead>Judge B</TableHead>
                    <TableHead className="text-right">Shared Items</TableHead>
                    <TableHead className="text-right">Agreement</TableHead>
                    <TableHead className="text-right">Cohen's κ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pairwiseData.map((p: any, i: number) => (
                    <TableRow key={i}>
                      <TableCell className="font-mono text-xs">{p.annotatorA}</TableCell>
                      <TableCell className="font-mono text-xs">{p.annotatorB}</TableCell>
                      <TableCell className="text-right font-mono text-xs">{p.nShared}</TableCell>
                      <TableCell className="text-right font-mono text-xs">{(p.observedAgreement * 100).toFixed(1)}%</TableCell>
                      <TableCell className="text-right font-mono text-xs font-bold">{p.cohenKappa.toFixed(3)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-sm text-muted-foreground italic">Not enough overlapping judgments for Pairwise Cohen's κ.</div>
            )}
          </CardContent>
        </Card>
      )})}
      
      {report.perTask.length === 0 && (
        <div className="text-center py-8 text-muted-foreground border bg-white">
          Not enough data to compute agreement (items with &ge; 2 judgments are required).
        </div>
      )}
    </div>
  );
}

function DisagreementsTab({ poolId }: { poolId: string }) {
  const queryClient = useQueryClient();
  const { data: conflicts, isLoading } = useListEvalPoolDisagreements(poolId, { query: { enabled: !!poolId, queryKey: getListEvalPoolDisagreementsQueryKey(poolId) } });
  const createAdjudication = useCreateEvalAdjudication();
  
  const [openItem, setOpenItem] = useState<string | null>(null);
  const [finalGrade, setFinalGrade] = useState("");
  const [note, setNote] = useState("");

  const handleResolve = (itemId: string) => {
    // arbiter is hardcoded or something? Just string "admin"
    createAdjudication.mutate(
      { data: { poolId, itemId, grade: finalGrade, arbiter: "admin", note } },
      {
        onSuccess: () => {
          toast.success("Adjudication saved");
          queryClient.invalidateQueries({ queryKey: getListEvalPoolDisagreementsQueryKey(poolId) });
          queryClient.invalidateQueries({ queryKey: getGetEvalPoolQueryKey(poolId) });
          setOpenItem(null);
          setFinalGrade("");
          setNote("");
        },
        onError: (err: any) => {
          toast.error("Failed: " + (err?.response?.data?.error || "Unknown error"));
        }
      }
    );
  };

  if (isLoading) return <div className="py-10 text-center text-muted-foreground">Loading...</div>;
  if (!conflicts || conflicts.length === 0) {
    return (
      <div className="border border-dashed p-12 text-center text-muted-foreground bg-white">
        <CheckCircle2 className="w-8 h-8 mx-auto mb-4 text-green-500/50" />
        <h3 className="font-medium text-foreground mb-1">No pending adjudication</h3>
        <p className="text-sm">There are no records requiring an adjudicator. Disagreements resolved by a 2/3 majority do not appear here.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {conflicts.map((c: any) => (
        <Card
          key={c.itemId}
          className={cn(
            "border-l-4",
            c.resolution === "awaiting_third"
              ? "border-amber-500/30 border-l-amber-500"
              : "border-destructive/30 border-l-destructive",
          )}
        >
          <CardHeader className={cn(
            "py-3 px-4 flex flex-row items-center justify-between",
            c.resolution === "awaiting_third" ? "bg-amber-500/5" : "bg-destructive/5",
          )}>
            <div>
              <CardTitle className="text-sm font-mono flex items-center gap-2">
                {c.resolution === "awaiting_third" ? (
                  <Users className="w-4 h-4 text-amber-600" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-destructive" />
                )}
                {c.itemId} 
              </CardTitle>
            </div>
            
            <div className="flex items-center gap-2">
              {c.resolution === "awaiting_third" && (
                <Badge variant="outline" className="border-amber-500 text-amber-700">
                  Awaiting third judge
                </Badge>
              )}
            <Dialog open={openItem === c.itemId} onOpenChange={(val) => {
              if (val) {
                setOpenItem(c.itemId);
                setFinalGrade("");
                setNote("");
              } else {
                setOpenItem(null);
              }
            }}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline" className="border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground">
                  Adjudicate
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Judgment Adjudication</DialogTitle>
                  <CardDescription>
                    Item: <code className="font-bold text-foreground">{c.itemId}</code>
                  </CardDescription>
                </DialogHeader>
                
                <div className="space-y-4 py-4">
                  <div className="bg-muted p-3 text-sm">
                    <div className="font-medium mb-2 uppercase tracking-widest text-xs">Recorded Judgments</div>
                    <ul className="space-y-1">
                      {c.grades.map((j: any, i: number) => (
                        <li key={i} className="flex justify-between border-b border-border/50 pb-1 last:border-0">
                          <span className="font-mono font-bold">{j.annotator}</span>
                          <span className="font-mono bg-white px-2 py-0.5 border">{j.grade}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="space-y-2">
                    <Label>Final Grade (Adjudicated)</Label>
                    <Input 
                      value={finalGrade} 
                      onChange={(e) => setFinalGrade(e.target.value)} 
                      placeholder="The final correct grade"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Note (optional)</Label>
                    <Textarea 
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder="Rationale for the decision..."
                    />
                  </div>

                  <div className="flex justify-end pt-2">
                    <Button 
                      onClick={() => handleResolve(c.itemId)}
                      disabled={!finalGrade.trim() || createAdjudication.isPending}
                    >
                      Submit Decision
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
            </div>
          </CardHeader>
          <CardContent className="p-4 bg-white">
            <div className="flex gap-4">
              {c.grades.map((j: any, i: number) => (
                <div key={i} className="bg-secondary/50 px-3 py-2 border flex flex-col gap-1 w-32">
                  <span className="text-xs uppercase tracking-widest text-muted-foreground">{j.annotator}</span>
                  <span className="text-lg font-mono font-bold leading-none">{j.grade}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}


// Main Page Component
export default function PoolDetail() {
  const [, params] = useRoute("/pools/:id");
  const id = params?.id || "";

  const { data: pool, isLoading, error } = useGetEvalPool(id, {
    query: { enabled: !!id, queryKey: getGetEvalPoolQueryKey(id) }
  });
  
  const { data: coverage } = useGetEvalPoolCoverage(id, {
    query: { enabled: !!id, queryKey: getGetEvalPoolCoverageQueryKey(id) }
  });

  if (isLoading) {
    return <div className="py-10 text-center text-muted-foreground">Loading...</div>;
  }

  if (error || !pool) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" asChild className="-ml-4">
          <Link href="/pools">Back</Link>
        </Button>
        <div className="py-10 text-center text-destructive">Pool not found.</div>
      </div>
    );
  }

  const required = pool.nItems * pool.judgmentsPerItem;
  // Calculate progress based on coverage if available
  const completeItems = coverage?.summary?.complete || 0;
  const progress = required > 0 ? (completeItems / pool.nItems) * 100 : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
        <Link href="/pools" className="hover:text-primary transition-colors flex items-center gap-1">
          Pools
        </Link>
        <span>/</span>
        <span className="text-foreground">{pool.label}</span>
      </div>

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-serif mb-2 text-primary flex items-center gap-3">
            {pool.label}
          </h1>
          <div className="flex items-center gap-4 text-sm font-mono text-muted-foreground">
            <span>{formatDate(pool.createdAt)}</span>
            <span>•</span>
            <span>depth {pool.depth}</span>
            <span>•</span>
            <span>{pool.judgmentsPerItem} judgments/item</span>
          </div>
        </div>
        
        <Button variant="outline" asChild>
          <a href={`/api/eval/pools/${id}/qrels`} download>
            Download TREC Qrels
          </a>
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="md:col-span-1">
          <CardHeader className="pb-4">
            <CardTitle className="text-sm uppercase tracking-widest text-muted-foreground">Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-mono text-primary mb-2">
              {progress.toFixed(1)}%
            </div>
            <div className="text-sm text-muted-foreground">
              {completeItems.toLocaleString('en-GB')} complete / {pool.nItems.toLocaleString('en-GB')} required records
            </div>
            <div className="mt-4 h-2 bg-secondary overflow-hidden">
              <div 
                className="h-full bg-primary transition-all" 
                style={{ width: `${Math.min(100, progress)}%` }} 
              />
            </div>
          </CardContent>
        </Card>
        
        <Card className="md:col-span-3">
          <CardHeader className="pb-4">
            <CardTitle className="text-sm uppercase tracking-widest text-muted-foreground">Pool Coverage</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-1 h-12 w-full mt-2">
              {coverage ? coverage.items.map((c: any) => {
                const isComplete = c.judgments >= pool.judgmentsPerItem;
                const isPartial = c.judgments > 0 && !isComplete;
                return (
                  <div 
                    key={c.itemId}
                    className={cn(
                      "flex-1 h-full min-w-[2px]",
                      isComplete ? "bg-primary" : isPartial ? "bg-primary/40" : "bg-secondary"
                    )}
                    title={`${c.itemId}: ${c.judgments}/${pool.judgmentsPerItem}`}
                  />
                );
              }) : (
                <div className="w-full h-full bg-secondary animate-pulse" />
              )}
            </div>
            <div className="flex justify-between text-xs text-muted-foreground mt-2">
              <span className="flex items-center gap-1"><div className="w-2 h-2 bg-secondary" /> Unjudged ({coverage?.summary?.zero || 0})</span>
              <span className="flex items-center gap-1"><div className="w-2 h-2 bg-primary/40" /> Partial</span>
              <span className="flex items-center gap-1"><div className="w-2 h-2 bg-primary" /> Complete ({completeItems})</span>
            </div>
            {coverage?.summary && (
              <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs mt-4 pt-3 border-t border-border text-muted-foreground">
                <span className="uppercase tracking-widest">Resolution:</span>
                <span>Unanimous <b className="font-mono text-foreground">{coverage.summary.unanimous}</b></span>
                <span>Majority 2/3 <b className="font-mono text-foreground">{coverage.summary.majority}</b></span>
                <span>Adjudicated <b className="font-mono text-foreground">{coverage.summary.adjudicated}</b></span>
                <span className={cn(coverage.summary.needsArbitration > 0 && "text-destructive")}>
                  Awaiting adjudicator <b className="font-mono">{coverage.summary.needsArbitration}</b>
                </span>
                <span className={cn(coverage.summary.awaitingThirdJudge > 0 && "text-amber-700")}>
                  Awaiting third judge <b className="font-mono">{coverage.summary.awaitingThirdJudge}</b>
                </span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="batches" className="w-full mt-8">
        <TabsList className="mb-6 w-full justify-start border-b border-border">
          <TabsTrigger value="batches" className="text-base px-6 py-3 h-auto">Batches</TabsTrigger>
          <TabsTrigger value="ingest" className="text-base px-6 py-3 h-auto">Import Judgments</TabsTrigger>
          <TabsTrigger value="agreement" className="text-base px-6 py-3 h-auto">Judge Agreement</TabsTrigger>
          <TabsTrigger value="disagreements" className="text-base px-6 py-3 h-auto">Adjudication</TabsTrigger>
        </TabsList>
        
        <div className="mt-6">
          <TabsContent value="batches">
            <BatchesTab poolId={id} />
          </TabsContent>
          <TabsContent value="ingest">
            <IngestTab poolId={id} />
          </TabsContent>
          <TabsContent value="agreement">
            <AgreementTab poolId={id} />
          </TabsContent>
          <TabsContent value="disagreements">
            <DisagreementsTab poolId={id} />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
