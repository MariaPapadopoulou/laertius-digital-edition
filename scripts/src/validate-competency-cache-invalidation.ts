/**
 * Proves a rebuilt knowledge-graph store really refreshes the sidebar
 * badge counts.
 *
 * The /competency sidebar badge counts come from getCompetencyRowCounts()
 * in routes/competency.ts, cached and keyed to the oxigraph Store
 * *instance* returned by getStore() in routes/sparql.ts. Today the store
 * is built exactly once per process, so the invalidation branch (new
 * Store instance -> discard stale counts, recompute) never executes in
 * production and is only "proven" by reading the code. This validator
 * exercises it in-process:
 *
 * 1. Baseline: compute the counts against the real graph; a repeat call
 *    must return the SAME Map object (cache hit) with at least one
 *    non-zero count (positive control against a vacuous pass).
 * 2. Rebuild: swap in a SECOND Store instance holding a deliberately
 *    different (tiny) graph via the __setStoreForTests hook. The next
 *    call must recompute — a different Map whose counts match the tiny
 *    graph, not the stale baseline map.
 * 3. Reset: with the store unchanged, resetRowCountCache() must drop the
 *    cached map so the next call recomputes (new Map object, same
 *    values).
 *
 * A future refactor that drops the instance key (serving the stale map
 * after a rebuild) or breaks resetRowCountCache() fails here.
 *
 * Run from the workspace root:
 *   pnpm --filter @workspace/scripts run validate-competency-cache-invalidation
 */
import path from "node:path";
import { Store } from "oxigraph";

process.env["LAERTIUS_DATA_DIR"] ??= path.resolve(
  import.meta.dirname,
  "../../artifacts/api-server/data",
);

const { getStore, __setStoreForTests } = await import(
  "../../artifacts/api-server/src/routes/sparql"
);
const { getCompetencyRowCounts, resetRowCountCache } = await import(
  "../../artifacts/api-server/src/routes/competency"
);
const { COMPETENCY_QUESTIONS } = await import(
  "../../artifacts/api-server/src/lib/competency"
);

const errors: string[] = [];

if (COMPETENCY_QUESTIONS.length === 0) {
  console.error(
    "validate-competency-cache-invalidation FAILED: COMPETENCY_QUESTIONS exports zero questions; every check would be vacuous",
  );
  process.exit(1);
}

// Start from a clean slate in case module init warmed anything.
resetRowCountCache();

// --- 1. Baseline: real graph, cache hit on repeat call -----------------
const realStore = getStore();
const baseline = getCompetencyRowCounts();

if (baseline.size !== COMPETENCY_QUESTIONS.length) {
  errors.push(
    `baseline counts cover ${baseline.size} questions but the catalogue has ${COMPETENCY_QUESTIONS.length}`,
  );
}
const nonZero = [...baseline.values()].filter((n) => n > 0).length;
if (nonZero === 0) {
  errors.push(
    "positive control failed: every baseline count is 0 against the real graph — the recompute checks below would be vacuous",
  );
}

const repeat = getCompetencyRowCounts();
if (repeat !== baseline) {
  errors.push(
    "cache miss on an unchanged store: a second getCompetencyRowCounts() call returned a different Map object; the catalogue endpoint would re-run every SPARQL query on each hit",
  );
}

// --- 2. Rebuild: a NEW Store instance must trigger a recompute ---------
// A tiny graph deliberately different from the real one: no competency
// question can match anything in it, so every recomputed count must be 0
// (and the baseline has at least one non-zero count, proving the maps
// genuinely differ rather than coinciding).
const tinyStore = new Store();
tinyStore.load(
  `<http://example.org/only-triple> <http://example.org/p> "rebuilt graph" .`,
  { format: "text/turtle" },
);
__setStoreForTests(tinyStore);

const afterRebuild = getCompetencyRowCounts();
if (afterRebuild === baseline) {
  errors.push(
    "STALE COUNTS SERVED AFTER REBUILD: getCompetencyRowCounts() returned the same Map object computed against the old store even though getStore() now returns a new Store instance; the sidebar badges would disagree with the results tables",
  );
} else {
  for (const q of COMPETENCY_QUESTIONS) {
    const n = afterRebuild.get(q.id);
    if (n === undefined) {
      errors.push(
        `after rebuild, question "${q.id}" is missing from the recomputed counts`,
      );
    } else if (n !== 0) {
      errors.push(
        `after rebuild against the tiny graph, question "${q.id}" counts ${n} rows (expected 0); the recompute did not actually run against the new store`,
      );
    }
  }
  // The stale map must still hold the old values (the recompute must not
  // have mutated the map a concurrent request could be holding).
  const staleNonZero = [...baseline.values()].filter((n) => n > 0).length;
  if (staleNonZero !== nonZero) {
    errors.push(
      "the recompute mutated the previously returned counts Map in place; callers holding the old map would see it change under them",
    );
  }
}

// --- 3. resetRowCountCache: reset then recompute on the SAME store -----
const beforeReset = getCompetencyRowCounts();
resetRowCountCache();
const afterReset = getCompetencyRowCounts();
if (afterReset === beforeReset) {
  errors.push(
    "resetRowCountCache() did not drop the cache: the next getCompetencyRowCounts() call returned the same Map object instead of recomputing",
  );
} else {
  for (const [id, n] of beforeReset) {
    if (afterReset.get(id) !== n) {
      errors.push(
        `after resetRowCountCache() with an unchanged store, question "${id}" recomputed to ${afterReset.get(id)} but was ${n} before; the recompute is not deterministic against the same graph`,
      );
    }
  }
}

// --- Restore the real store so nothing downstream sees the tiny graph --
__setStoreForTests(realStore);
resetRowCountCache();

if (errors.length > 0) {
  console.error(
    `validate-competency-cache-invalidation FAILED (${errors.length} problem${errors.length === 1 ? "" : "s"}):`,
  );
  for (const e of errors) console.error(`  ✗ ${e}`);
  process.exit(1);
}

console.log(
  `✓ competency badge-count cache invalidates correctly: cache hit on unchanged store, recompute on new Store instance (${nonZero} non-zero baseline counts -> all 0 on the rebuilt tiny graph), and resetRowCountCache() forces a recompute`,
);
