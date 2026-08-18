import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Link, useLocation } from "wouter";
import { 
  useListEvalTopicSets, 
  useCreateEvalTopicSet,
  useListEvalSnapshots,
  getListEvalTopicSetsQueryKey
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

const formSchema = z.object({
  label: z.string().min(1, "Name is required").max(50),
  note: z.string().optional(),
  snapshotId: z.string().min(1, "Snapshot is required"),
  lines: z.string().min(1, "JSONL content is required"),
});

export default function TopicsList() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  
  const { data: topicSets, isLoading } = useListEvalTopicSets();
  const { data: snapshots } = useListEvalSnapshots();
  const createTopicSet = useCreateEvalTopicSet();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      label: "",
      note: "",
      snapshotId: "",
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
    // Validate that it's valid JSONL format before submitting
    try {
      const lines = values.lines.trim().split('\n');
      lines.forEach((line, i) => {
        if (!line.trim() || line.trim().startsWith('#')) return; // skip empty/comments
        const parsed = JSON.parse(line);
        if (!parsed.topic_id || !parsed.question) {
          throw new Error(`Line ${i+1}: missing topic_id or question`);
        }
      });
      
      createTopicSet.mutate({ data: values }, {
        onSuccess: (newSet) => {
          toast.success("Topic Set created");
          queryClient.invalidateQueries({ queryKey: getListEvalTopicSetsQueryKey() });
          setOpen(false);
          form.reset();
          setLocation(`/topics/${newSet.id}`);
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
          <h1 className="text-3xl font-serif mb-2 text-primary">Topic Sets</h1>
          <p className="text-muted-foreground">
            Topic sets (queries) for evaluating the system.
          </p>
        </div>
        
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              New Topic Set
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Upload Topic Set</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="label"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Name</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g. Q1-50 Main" {...field} />
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
                        <FormLabel>Snapshot</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select..." />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {snapshots?.map((s: any) => (
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
                    name="note"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Note (optional)</FormLabel>
                        <FormControl>
                          <Input placeholder="Description of the set..." {...field} />
                        </FormControl>
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
                      <FormLabel>JSONL Content</FormLabel>
                      <Tabs defaultValue="paste" className="w-full">
                        <TabsList className="mb-2">
                          <TabsTrigger value="paste">Paste</TabsTrigger>
                          <TabsTrigger value="upload">File</TabsTrigger>
                        </TabsList>
                        <TabsContent value="paste" className="mt-0">
                          <FormControl>
                            <Textarea 
                              placeholder={`{"topic_id": "T01", "question": "Πού γεννήθηκε ο Πλάτωνας;"}\n{"topic_id": "T02", "question": "Ποιος ήταν δάσκαλος του Αριστοτέλη;", "must_abstain": true, "abstain_type": "out_of_corpus"}`}
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
                              Upload a .jsonl file with valid topic records
                            </p>
                          </div>
                        </TabsContent>
                      </Tabs>
                      <FormDescription>
                        Required fields per line: <code>topic_id</code>, <code>question</code>. Optional: <code>question_lang</code>, <code>split</code>, <code>question_type</code>, <code>question_en</code>, <code>expected_answer</code>, <code>must_abstain</code> with <code>abstain_type</code> (out_of_corpus, false_premise, underspecified_homonym).
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <div className="flex justify-end pt-4">
                  <Button type="submit" disabled={createTopicSet.isPending}>
                    {createTopicSet.isPending ? "Saving..." : "Create Topic Set"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="py-10 text-center text-muted-foreground">Loading...</div>
      ) : !topicSets || topicSets.length === 0 ? (
        <div className="border border-dashed p-12 text-center text-muted-foreground bg-white">
          <h3 className="font-medium text-foreground mb-1">No Topic Sets</h3>
          <p className="text-sm">Upload question sets to begin evaluation.</p>
          <Button variant="outline" className="mt-4" onClick={() => setOpen(true)}>
            Upload Topic Set
          </Button>
        </div>
      ) : (
        <div className="bg-white border shadow-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Queries</TableHead>
                <TableHead>Abstentions</TableHead>
                <TableHead>Note</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {topicSets.map((ts) => (
                <TableRow 
                  key={ts.id} 
                  className="cursor-pointer"
                  onClick={() => setLocation(`/topics/${ts.id}`)}
                >
                  <TableCell className="font-medium">{ts.label}</TableCell>
                  <TableCell>{formatDate(ts.createdAt)}</TableCell>
                  <TableCell className="font-mono text-xs">{ts.nTopics}</TableCell>
                  <TableCell className="font-mono text-xs">
                    {ts.nAbstain
                      ? `${ts.nAbstain}${(ts.byAbstainType ?? []).length ? " (" + (ts.byAbstainType ?? []).map((a: any) => `${a.name}: ${a.count}`).join(", ") + ")" : ""}`
                      : "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground truncate max-w-xs">{ts.note || "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
