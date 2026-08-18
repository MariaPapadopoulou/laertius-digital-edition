/**
 * issue-crossover-batches — one-off: issue a second-judgment batch to each
 * annotator so the two existing 50-item batches become 100 double-judged
 * items. Relies on the store's needsMore-first eligibility ordering.
 *
 * Run: pnpm --filter @workspace/scripts exec tsx src/issue-crossover-batches.ts
 */
import path from "node:path";

process.env["LAERTIUS_DATA_DIR"] ??= path.resolve(
  import.meta.dirname,
  "../../artifacts/api-server/data",
);

const { createBatch, listBatches, listPools } = await import(
  "../../artifacts/api-server/src/lib/eval/store"
);

const pool = listPools()[0];
if (!pool) throw new Error("no pool found");
console.log(`pool ${pool.id} judgmentsPerItem=${pool.judgmentsPerItem}`);

const before = listBatches(pool.id).filter((b: any) => !b.revokedAt);
const byAnnotator = new Map<string, Set<string>>();
for (const b of before) {
  const set = byAnnotator.get(b.annotator) ?? new Set<string>();
  for (const id of b.itemIds) set.add(id);
  byAnnotator.set(b.annotator, set);
}
const annotators = [...byAnnotator.keys()];
if (annotators.length !== 2) throw new Error(`expected 2 annotators, got ${annotators.join(",")}`);
const [a1, a2] = annotators as [string, string];

for (const [me, other] of [
  [a1, a2],
  [a2, a1],
] as const) {
  const batch = createBatch({ poolId: pool.id, annotator: me, size: 50 });
  if ("error" in batch) throw new Error(`createBatch(${me}): ${batch.error}`);
  const otherItems = byAnnotator.get(other)!;
  const overlap = batch.itemIds.filter((id: string) => otherItems.has(id)).length;
  console.log(`batch ${batch.id} → ${me}: ${batch.itemIds.length} items, ${overlap} overlap with ${other}'s originals`);
  if (overlap !== batch.itemIds.length)
    throw new Error(`expected full overlap, got ${overlap}/${batch.itemIds.length}`);
}
console.log("Crossover batches issued. Restart the API Server workflow so it reloads the eval store.");

export {};
