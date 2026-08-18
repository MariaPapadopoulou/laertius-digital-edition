import { usePageTitle } from "@/lib/use-page-title";
import { AboutLink } from "@/components/about-link";
import { useScrollMemory } from "@/hooks/use-scroll-memory";
import { useResetOnSamePageNav } from "@/hooks/use-reset-on-same-page-nav";
import { useEffect, useMemo, useState } from "react";
import { searchCorpus, SearchInputMode } from "@workspace/api-client-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { PassageCard, TextLayoutToggle } from "@/components/passage-card";
import { Search, Loader2, Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { SemanticSearchNotice } from "@/components/semantic-search-notice";

const METHOD_DESCRIPTIONS: Record<SearchInputMode, string> = {
  hybrid: "Combines keywords and meaning. Recommended.",
  sparse: "Matches exact words and names.",
  dense: "Matches by meaning, not exact words.",
};

const METHOD_LABELS: Record<SearchInputMode, string> = {
  hybrid: "Hybrid (Recommended)",
  sparse: "Exact",
  dense: "Dense (Semantic)",
};

const VALID_MODES: SearchInputMode[] = ["hybrid", "sparse", "dense"];
const VALID_TOPK = ["5", "10", "20"];

function readSearchParams() {
  const params = new URLSearchParams(window.location.search);
  const q = (params.get("q") ?? "").trim();
  const rawMode = params.get("mode");
  const mode: SearchInputMode = VALID_MODES.includes(rawMode as SearchInputMode)
    ? (rawMode as SearchInputMode)
    : "hybrid";
  const rawK = params.get("k");
  const topK = rawK && VALID_TOPK.includes(rawK) ? rawK : "10";
  return { q, mode, topK };
}

type SubmittedSearch = { q: string; mode: SearchInputMode; topK: string };

function scrollKey(s: SubmittedSearch) {
  return `search-scroll:${s.q}|${s.mode}|${s.topK}`;
}

export default function SearchPage() {
  const initial = useMemo(() => readSearchParams(), []);
  const [query, setQuery] = useState(initial.q);
  const [submitted, setSubmitted] = useState<SubmittedSearch | null>(
    initial.q ? { q: initial.q, mode: initial.mode, topK: initial.topK } : null,
  );
  const [mode, setMode] = useState<SearchInputMode>(initial.mode);
  const [topK, setTopK] = useState(initial.topK);

  const submittedQuery = submitted?.q ?? null;
  usePageTitle(submittedQuery ? `"${submittedQuery}" - Search` : "Search");

  const queryClient = useQueryClient();

  const searchQuery = useQuery({
    queryKey: ["searchCorpus", submitted?.q, submitted?.mode, submitted?.topK],
    queryFn: () =>
      searchCorpus({
        query: submitted!.q,
        mode: submitted!.mode,
        topK: parseInt(submitted!.topK, 10),
      }),
    enabled: submitted !== null,
    staleTime: Infinity,
  });

  const resultsReady =
    !searchQuery.isFetching && searchQuery.isSuccess && searchQuery.data !== undefined;
  const { armRestore } = useScrollMemory(
    submitted ? scrollKey(submitted) : "search-scroll:none",
    submitted !== null && resultsReady,
    { initiallyPending: initial.q !== "" },
  );

  useEffect(() => {
    const onPopState = () => {
      const { q, mode: m, topK: k } = readSearchParams();
      setQuery(q);
      setMode(m);
      setTopK(k);
      setSubmitted(q ? { q, mode: m, topK: k } : null);
      if (q !== "") armRestore();
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [armRestore]);

  useResetOnSamePageNav(() => {
    setQuery("");
    setSubmitted(null);
    setMode("hybrid");
    setTopK("10");
  });

  const isStale =
    submittedQuery !== null &&
    query.trim() !== submittedQuery &&
    query.trim() !== "" &&
    !searchQuery.isFetching;

  const runExample = (q: string, m: SearchInputMode) => {
    const url = new URL(window.location.href);
    url.searchParams.set("q", q);
    if (m !== "hybrid") url.searchParams.set("mode", m);
    else url.searchParams.delete("mode");
    if (topK !== "10") url.searchParams.set("k", topK);
    else url.searchParams.delete("k");
    if (url.toString() !== window.location.href) {
      window.history.pushState(null, "", url);
    }
    setQuery(q);
    setMode(m);
    queryClient.removeQueries({ queryKey: ["searchCorpus", q, m, topK] });
    setSubmitted({ q, mode: m, topK });
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;

    const url = new URL(window.location.href);
    url.searchParams.set("q", q);
    if (mode !== "hybrid") url.searchParams.set("mode", mode);
    else url.searchParams.delete("mode");
    if (topK !== "10") url.searchParams.set("k", topK);
    else url.searchParams.delete("k");
    if (url.toString() !== window.location.href) {
      window.history.pushState(null, "", url);
    }

    queryClient.removeQueries({ queryKey: ["searchCorpus", q, mode, topK] });
    setSubmitted({ q, mode, topK });
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-serif font-bold text-foreground">
          Corpus Search
        </h1>
        <p className="text-muted-foreground">
          Query the Greek text and English translations directly.
        </p>
        <AboutLink anchor="asking-searching" label="About asking and searching" />
      </div>

      <div className="border-b border-border pb-8">
        <form onSubmit={handleSearch} className="space-y-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-3 h-5 w-5 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search keywords, concepts, or Greek terms..."
                aria-label="Search the corpus"
                className="pl-10 h-11 text-base bg-background"
              />
            </div>
            <Button 
              type="submit" 
              className={`h-11 px-8 transition-shadow ${isStale ? "ring-2 ring-amber-500/70 ring-offset-2 ring-offset-background animate-pulse" : ""}`}
              disabled={!query.trim() || searchQuery.isFetching}
            >
              {searchQuery.isFetching ? <Loader2 className="w-5 h-5 animate-spin" /> : "Search"}
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-6 pt-4 border-t border-border">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <Label htmlFor="mode" className="text-sm text-muted-foreground font-normal">Method</Label>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      aria-label="About search methods"
                      className="text-muted-foreground/70 hover:text-foreground focus-visible:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-full transition-colors"
                    >
                      <Info className="w-3.5 h-3.5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-xs space-y-2 py-2.5">
                    <p><span className="font-semibold">Hybrid</span> - {METHOD_DESCRIPTIONS.hybrid}</p>
                    <p><span className="font-semibold">Exact</span> - {METHOD_DESCRIPTIONS.sparse}</p>
                    <p><span className="font-semibold">Dense</span> - {METHOD_DESCRIPTIONS.dense}</p>
                  </TooltipContent>
                </Tooltip>
              </div>
              <Select value={mode} onValueChange={(v: SearchInputMode) => setMode(v)}>
                <SelectTrigger id="mode" className="w-[180px] h-9 bg-background">
                  <SelectValue placeholder="Select mode">
                    {METHOD_LABELS[mode]}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent className="max-w-[320px]">
                  {(["hybrid", "sparse", "dense"] as const).map((m) => (
                    <SelectItem key={m} value={m} textValue={METHOD_LABELS[m]}>
                      <div>
                        <div>{METHOD_LABELS[m]}</div>
                        <p className="mt-0.5 text-xs text-muted-foreground whitespace-normal leading-snug">
                          {METHOD_DESCRIPTIONS[m]}
                        </p>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-3">
              <Label htmlFor="topK" className="text-sm text-muted-foreground font-normal">Results</Label>
              <Select value={topK} onValueChange={setTopK}>
                <SelectTrigger id="topK" className="w-[90px] h-9 bg-background">
                  <SelectValue placeholder="Count" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="5">5</SelectItem>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="20">20</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-muted-foreground">Try:</span>
            {(
              [
                { q: "why Plato left Athens", m: "hybrid" as const },
                { q: "ἀταραξία", m: "sparse" as const },
                { q: "how to face death without fear", m: "dense" as const },
              ] as Array<{ q: string; m: SearchInputMode }>
            ).map(({ q, m }) => (
              <button
                key={m}
                type="button"
                onClick={() => runExample(q, m)}
                data-testid={`search-example-${m}`}
                className="inline-flex items-center gap-1.5 border border-border rounded-full px-3 py-1 bg-background hover:border-primary hover:text-primary transition-colors"
              >
                <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                  {m === "hybrid" ? "Hybrid" : m === "sparse" ? "Exact" : "Semantic"}
                </span>
                {m === "sparse" ? <span lang="grc">{q}</span> : <span>{q}</span>}
              </button>
            ))}
          </div>
        </form>

        <SemanticSearchNotice />
      </div>

      <div className="space-y-6">
        {searchQuery.isFetching && (
          <div className="py-12 flex justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        )}

        {!searchQuery.isFetching && searchQuery.isSuccess && searchQuery.data && (
          <div className="space-y-6 animate-in fade-in duration-500">
            <div className="text-sm text-muted-foreground flex justify-between items-center px-1" role="status" aria-live="polite">
              <span>
                Results for <span className="font-medium text-foreground">"{submittedQuery}"</span>{" "}
                ({searchQuery.data.hits.length} {searchQuery.data.hits.length === 1 ? "passage" : "passages"})
                {submittedQuery !== null && query.trim() !== submittedQuery && (
                  <span className="ml-2 italic text-amber-600 dark:text-amber-500">
                    Press Search to update results
                  </span>
                )}
              </span>
              <span className="flex items-center gap-3">
                <TextLayoutToggle />
                <span className="uppercase tracking-wider text-[10px] font-bold bg-secondary px-2 py-1 rounded-sm">
                  Mode: {searchQuery.data.mode}
                </span>
              </span>
            </div>
            
            {searchQuery.data.hits.length === 0 ? (
              <div className="text-center py-16 bg-card border border-border border-dashed rounded-xl text-muted-foreground">
                No passages found matching your query.
              </div>
            ) : (
              <div className="space-y-6">
                {searchQuery.data.hits.map((hit) => (
                  <PassageCard key={hit.id} passage={hit} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
