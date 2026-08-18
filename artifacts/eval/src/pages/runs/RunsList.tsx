import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { 
  useListEvalRuns, 
  useCreateEvalRun,
  useListEvalSnapshots,
  useListEvalTopicSets,
  getListEvalRunsQueryKey
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from "@/components/ui/table";
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger 
} from "@/components/ui/dialog";
import { 
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription
} from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatDate } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Link, useLocation } from "wouter";
import { Checkbox } from "@/components/ui/checkbox";

const formSchema = z.object({
  systemId: z.string().min(1, "System identifier is required").max(50),
  snapshotId: z.string().min(1, "Select a snapshot"),
  topicSetId: z.string().min(1, "Select a topic set"),
  lines: z.string().min(1, "JSONL content is required"),
});

export default function RunsList() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [, navigate] = useLocation();

  const toggleSelected = (id: string, checked: boolean) => {
    setSelected((prev) =>
      checked ? [...prev.filter((x) => x !== id), id] : prev.filter((x) => x !== id),
    );
  };
  
  const { data: runs, isLoading } = useListEvalRuns();
  const { data: snapshots } = useListEvalSnapshots();
  const { data: topicSets } = useListEvalTopicSets();
  
  const createRun = useCreateEvalRun();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      systemId: "",
      snapshotId: "",
      topicSetId: "",
      lines: "",
    },
  });

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result;
      if (typeof text === 'string') {
        form.setValue('lines', text);
      }
    };
    reader.readAsText(file);
  };

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    // Validate valid JSONL format
    try {
      const lines = values.lines.trim().split('\n');
      lines.forEach((line, i) => {
        if (!line.trim() || line.trim().startsWith('#')) return;
        const parsed = JSON.parse(line);
        if (!parsed.topic_id || !parsed.passage_id) {
          throw new Error(`Line ${i+1}: missing topic_id or passage_id`);
        }
      });
      
      createRun.mutate({ data: values }, {
        onSuccess: () => {
          toast.success("Run registered successfully");
          queryClient.invalidateQueries({ queryKey: getListEvalRunsQueryKey() });
          setOpen(false);
          form.reset();
        },
        onError: (err: any) => {
          toast.error("Failed: " + (err?.response?.data?.error || "Unknown error"));
        }
      });
    } catch (e: any) {
      toast.error("Invalid JSONL: " + e.message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-serif mb-2 text-primary">System Runs</h1>
          <p className="text-muted-foreground">
            Registered runs of various systems over the topic sets.
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            disabled={selected.length < 2}
            onClick={() => navigate(`/runs/compare?ids=${selected.join(",")}`)}
            data-testid="button-compare-runs"
          >
            Compare{selected.length > 0 ? ` (${selected.length})` : ""}
          </Button>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              New Run
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Register Run</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="systemId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>System (System ID)</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g. bm25_baseline" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="snapshotId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Snapshot (Corpus)</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select..." />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {snapshots?.map(s => (
                              <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="topicSetId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Topic Set</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select..." />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {topicSets?.map(s => (
                              <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                
                <FormField
                  control={form.control}
                  name="lines"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>TREC JSONL Results</FormLabel>
                      <Tabs defaultValue="paste" className="w-full">
                        <TabsList className="mb-2">
                          <TabsTrigger value="paste">Paste</TabsTrigger>
                          <TabsTrigger value="upload">File</TabsTrigger>
                        </TabsList>
                        <TabsContent value="paste" className="mt-0">
                          <FormControl>
                            <Textarea 
                              placeholder={`{"topic_id": "T01", "passage_id": "1.22", "rank": 1, "score": 15.4}\n{"topic_id": "T01", "passage_id": "3.14", "rank": 2, "score": 12.1}`}
                              className="font-mono text-xs h-[200px] resize-y" 
                              {...field} 
                            />
                          </FormControl>
                        </TabsContent>
                        <TabsContent value="upload" className="mt-0">
                          <div className="border border-dashed border-input bg-muted/20 rounded-sm p-8 text-center flex flex-col items-center justify-center">
                            <Input 
                              type="file" 
                              accept=".jsonl,.json,.txt"
                              onChange={handleFileUpload}
                              className="max-w-xs mx-auto mb-2"
                            />
                            <p className="text-xs text-muted-foreground mt-2">
                              Upload a .jsonl file with results
                            </p>
                          </div>
                        </TabsContent>
                      </Tabs>
                      <FormDescription>
                        Required fields: <code>topic_id</code>, <code>passage_id</code>. Optional: <code>rank</code>, <code>score</code>.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <div className="flex justify-end pt-4">
                  <Button type="submit" disabled={createRun.isPending}>
                    {createRun.isPending ? "Saving..." : "Register Run"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      {isLoading ? (
        <div className="py-10 text-center text-muted-foreground">Loading...</div>
      ) : !runs || runs.length === 0 ? (
        <div className="border border-dashed p-12 text-center text-muted-foreground bg-white">
          <h3 className="font-medium text-foreground mb-1">No Runs</h3>
          <p className="text-sm">No system runs have been registered.</p>
          <Button variant="outline" className="mt-4" onClick={() => setOpen(true)}>
            New Run
          </Button>
        </div>
      ) : (
        <div className="bg-white border shadow-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10"><span className="sr-only">Select for comparison</span></TableHead>
                <TableHead>System ID</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Snapshot</TableHead>
                <TableHead>Topic Set</TableHead>
                <TableHead className="text-right">Records</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {runs.map((run) => {
                const snapshotLabel = snapshots?.find(s => s.id === run.snapshotId)?.label || run.snapshotId;
                const topicSetLabel = topicSets?.find(t => t.id === run.topicSetId)?.label || run.topicSetId;
                return (
                <TableRow key={run.id}>
                  <TableCell>
                    <Checkbox
                      checked={selected.includes(run.id)}
                      onCheckedChange={(checked) => toggleSelected(run.id, checked === true)}
                      aria-label={`Select ${run.systemId} for comparison`}
                      data-testid={`checkbox-compare-${run.id}`}
                    />
                  </TableCell>
                  <TableCell className="font-mono font-medium">
                    <Link href={`/runs/${run.id}`} className="hover:text-primary underline underline-offset-2 transition-colors">
                      {run.systemId}
                    </Link>
                  </TableCell>
                  <TableCell>{formatDate(run.createdAt)}</TableCell>
                  <TableCell className="text-xs">{snapshotLabel}</TableCell>
                  <TableCell className="text-xs">{topicSetLabel}</TableCell>
                  <TableCell className="text-right font-mono text-xs">
                    {run.nLines.toLocaleString('en-GB')}
                  </TableCell>
                </TableRow>
              )})}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
