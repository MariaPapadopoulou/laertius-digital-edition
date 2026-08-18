import { Info } from "lucide-react";
import { getHealthCheckQueryKey, useHealthCheck } from "@workspace/api-client-react";

/**
 * Subtle informational notice shown on the Ask and Search pages while the
 * api-server reports denseIndexReady: false — i.e. the dense embedding index
 * or the local embedding model is not (yet) available, so retrieval silently
 * degrades to keyword-only (sparse BM25). Hidden entirely once semantic
 * retrieval is fully warmed up, and also hidden while the health check itself
 * is unresolved or failing (other UI reports server outages; this notice is
 * only about the semantic-search degradation).
 */
export function SemanticSearchNotice() {
  const { data: health, isError } = useHealthCheck({
    query: {
      queryKey: getHealthCheckQueryKey(),
      // Poll while degraded so the notice clears on its own once the
      // embedding model warms up; once ready, keep a slow background poll so
      // a degradation that starts later is still noticed.
      refetchInterval: (query) =>
        query.state.status === "error" || !query.state.data?.denseIndexReady ? 20_000 : 120_000,
      refetchIntervalInBackground: false,
    },
  });

  // Check isError first: react-query keeps the last successful data after a
  // failed refetch, so stale `denseIndexReady: false` must not keep the
  // notice up when the whole server is unreachable (that is a different,
  // bigger problem surfaced elsewhere). Also stay hidden while loading —
  // no notice is better than a flash of a false alarm.
  const degraded = !isError && health !== undefined && !health.denseIndexReady;
  if (!degraded) return null;

  return (
    <p
      className="mt-3 flex items-start gap-2 text-xs text-muted-foreground font-serif leading-relaxed"
      role="status"
      data-testid="semantic-search-notice"
    >
      <Info className="w-3.5 h-3.5 mt-0.5 shrink-0 text-primary/70" aria-hidden="true" />
      <span>
        Semantic search is warming up or unavailable — results are currently
        keyword-only. Meaning-based matching will resume automatically once it
        is ready.
      </span>
    </p>
  );
}
