import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Link, useLocation } from "wouter";
import {
  useListEvalSnapshots,
  useCreateEvalSnapshot,
  getListEvalSnapshotsQueryKey
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
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage
} from "@/components/ui/form";
import { formatDate } from "@/lib/utils";

const formSchema = z.object({
  label: z.string().min(1, "Snapshot name is required").max(50),
  note: z.string().optional(),
});

export default function SnapshotsList() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: snapshots, isLoading } = useListEvalSnapshots();
  const createSnapshot = useCreateEvalSnapshot();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      label: "",
      note: "",
    },
  });

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    createSnapshot.mutate({ data: values }, {
      onSuccess: (newSnapshot) => {
        toast.success("Snapshot created");
        queryClient.invalidateQueries({ queryKey: getListEvalSnapshotsQueryKey() });
        setOpen(false);
        form.reset();
        setLocation(`/snapshots/${newSnapshot.id}`);
      },
      onError: () => {
        toast.error("Failed to create snapshot");
      }
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-serif mb-2 text-primary">Snapshots</h1>
          <p className="text-muted-foreground">
            Frozen versions of the corpus for reproducible search experiments.
          </p>
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              New Snapshot
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Snapshot</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
                <FormField
                  control={form.control}
                  name="label"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Name</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. V1 - Baseline" {...field} />
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
                        <Textarea
                          placeholder="Notes on corpus changes compared to previous snapshots..."
                          className="resize-none"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex justify-end pt-4">
                  <Button type="submit" disabled={createSnapshot.isPending}>
                    {createSnapshot.isPending ? "Creating..." : "Create Snapshot"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="py-10 text-center text-muted-foreground">Loading...</div>
      ) : !snapshots || snapshots.length === 0 ? (
        <div className="border border-dashed p-12 text-center text-muted-foreground bg-white">
          <h3 className="font-medium text-foreground mb-1">No Snapshots</h3>
          <p className="text-sm">The system has no frozen snapshots of the corpus.</p>
          <Button variant="outline" className="mt-4" onClick={() => setOpen(true)}>
            Create your first Snapshot
          </Button>
        </div>
      ) : (
        <div className="bg-white border shadow-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Passages</TableHead>
                <TableHead>Note</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {snapshots.map((snapshot) => (
                <TableRow
                  key={snapshot.id}
                  className="cursor-pointer"
                  onClick={() => setLocation(`/snapshots/${snapshot.id}`)}
                >
                  <TableCell className="font-medium">{snapshot.label}</TableCell>
                  <TableCell>{formatDate(snapshot.createdAt)}</TableCell>
                  <TableCell className="font-mono text-xs">{snapshot.nPassages.toLocaleString('en-GB')}</TableCell>
                  <TableCell className="text-muted-foreground truncate max-w-xs">{snapshot.note || "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
