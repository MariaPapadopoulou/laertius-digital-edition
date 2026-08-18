import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Link, useLocation } from "wouter";
import { 
  useListEvalPools, 
  useCreateEvalPool,
  useListEvalRuns,
  useListEvalTopicSets,
  getListEvalPoolsQueryKey
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
import { Checkbox } from "@/components/ui/checkbox";
import { formatDate } from "@/lib/utils";

const formSchema = z.object({
  label: z.string().min(1, "Name is required").max(50),
  note: z.string().optional(),
  runIds: z.array(z.string()).min(1, "Select at least one run"),
  depth: z.coerce.number().min(1).max(100),
  judgmentsPerItem: z.coerce.number().min(1).max(5),
});

export default function PoolsList() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  
  const { data: pools, isLoading } = useListEvalPools();
  const { data: runs } = useListEvalRuns();
  const { data: topicSets } = useListEvalTopicSets();
  
  const createPool = useCreateEvalPool();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      label: "",
      note: "",
      runIds: [],
      depth: 10,
      judgmentsPerItem: 2,
    },
  });

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    createPool.mutate({ data: values }, {
      onSuccess: (newPool) => {
        toast.success("Pool created");
        queryClient.invalidateQueries({ queryKey: getListEvalPoolsQueryKey() });
        setOpen(false);
        form.reset();
        setLocation(`/pools/${newPool.id}`);
      },
      onError: (err: any) => {
        toast.error("Failed: " + (err?.response?.data?.error || "Unknown error"));
      }
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-serif mb-2 text-primary">Evaluation Pools</h1>
          <p className="text-muted-foreground">
            Pools of records for judgment (Depth-K Pooling) from different runs.
          </p>
        </div>
        
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              New Pool
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create Pool</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 pt-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="label"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Name</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g. Q1-50 Pool (Depth 10)" {...field} />
                        </FormControl>
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
                          <Input placeholder="Purpose of the pool..." {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="depth"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Depth (Depth k)</FormLabel>
                        <FormControl>
                          <Input type="number" min="1" max="100" {...field} />
                        </FormControl>
                        <FormDescription>Top-K records per query from each run</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="judgmentsPerItem"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Number of Judges (Per record)</FormLabel>
                        <FormControl>
                          <Input type="number" min="1" max="5" {...field} />
                        </FormControl>
                        <FormDescription>How many judges are required for each query-passage pair</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="runIds"
                  render={() => (
                    <FormItem>
                      <div className="mb-4">
                        <FormLabel>Select Runs</FormLabel>
                        <FormDescription>
                          Select which system runs will participate in the pool
                        </FormDescription>
                      </div>
                      <div className="h-[200px] overflow-y-auto border border-input bg-white">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-12"></TableHead>
                              <TableHead>System</TableHead>
                              <TableHead>Topic Set</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {runs?.map((run: any) => {
                              const topicSetLabel = topicSets?.find(t => t.id === run.topicSetId)?.label || run.topicSetId;
                              return (
                              <FormField
                                key={run.id}
                                control={form.control}
                                name="runIds"
                                render={({ field }) => {
                                  return (
                                    <TableRow>
                                      <TableCell>
                                        <Checkbox
                                          checked={field.value?.includes(run.id)}
                                          onCheckedChange={(checked) => {
                                            return checked
                                              ? field.onChange([...field.value, run.id])
                                              : field.onChange(
                                                  field.value?.filter(
                                                    (value) => value !== run.id
                                                  )
                                                )
                                          }}
                                        />
                                      </TableCell>
                                      <TableCell className="font-mono text-xs">{run.systemId}</TableCell>
                                      <TableCell className="text-xs">{topicSetLabel}</TableCell>
                                    </TableRow>
                                  )
                                }}
                              />
                            )})}
                          </TableBody>
                        </Table>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex justify-end pt-4">
                  <Button type="submit" disabled={createPool.isPending}>
                    {createPool.isPending ? "Creating..." : "Create Pool"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="py-10 text-center text-muted-foreground">Loading...</div>
      ) : !pools || pools.length === 0 ? (
        <div className="border border-dashed p-12 text-center text-muted-foreground bg-white">
          <h3 className="font-medium text-foreground mb-1">No Pools</h3>
          <p className="text-sm">Create pools from runs to assign tasks to judges.</p>
          <Button variant="outline" className="mt-4" onClick={() => setOpen(true)}>
            Create Pool
          </Button>
        </div>
      ) : (
        <div className="bg-white border shadow-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Size</TableHead>
                <TableHead>Status (Judgments)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pools.map((pool) => {
                return (
                  <TableRow 
                    key={pool.id} 
                    className="cursor-pointer"
                    onClick={() => setLocation(`/pools/${pool.id}`)}
                  >
                    <TableCell className="font-medium">
                      <div>{pool.label}</div>
                      <div className="text-xs font-mono text-muted-foreground mt-0.5">
                        {pool.runIds.length} runs • depth {pool.depth}
                      </div>
                    </TableCell>
                    <TableCell>{formatDate(pool.createdAt)}</TableCell>
                    <TableCell className="font-mono text-xs">{pool.nItems.toLocaleString('en-GB')} records</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-xs min-w-[50px]">
                          —
                        </span>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
