import { useState } from "react";
import { useListOtbObjects, useGetOtbOverview } from "@workspace/api-client-react";
import { TerminologyNav } from "@/components/terminology-nav";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Link, useSearch, useLocation } from "wouter";
import { Search, ChevronLeft, ChevronRight, FilterX } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { usePageTitle } from "@/lib/use-page-title";
import { useResetOnSamePageNav } from "@/hooks/use-reset-on-same-page-nav";

export default function TerminologyObjects() {
  usePageTitle("Ontoterminology Objects");
  const [, setLocation] = useLocation();
  const searchString = useSearch();
  const searchParams = new URLSearchParams(searchString);

  const [q, setQ] = useState(searchParams.get("q") || "");
  const [concept, setConcept] = useState<string>(searchParams.get("concept") || "");
  const [category, setCategory] = useState<string>(searchParams.get("category") || "");
  const [page, setPage] = useState(1);

  const limit = 50;
  const offset = (page - 1) * limit;

  // Use the generated hook with the standard param object
  const { data: result, isLoading } = useListOtbObjects({
    q: q || undefined,
    concept: concept || undefined,
    category: category || undefined,
    limit,
    offset
  });

  const { data: overview } = useGetOtbOverview();

  // Categories list
  const categories = overview?.categoryCounts.map(c => c.id) || [];
  const conceptsList = overview?.conceptCounts.map(c => c.id) || [];

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    updateUrl();
  };

  const updateUrl = () => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (concept) params.set("concept", concept);
    if (category) params.set("category", category);
    const qs = params.toString();
    setLocation(qs ? `/terminology/objects?${qs}` : "/terminology/objects", { replace: true });
  };

  const handleClear = () => {
    setQ("");
    setConcept("");
    setCategory("");
    setPage(1);
    setLocation("/terminology/objects", { replace: true });
  };

  useResetOnSamePageNav(handleClear);

  const totalPages = result ? Math.ceil(result.total / limit) : 0;

  return (
    <div>
      <TerminologyNav />
      <div className="space-y-6 max-w-6xl mx-auto animate-in fade-in">
        <header className="border-b pb-6">
          <h1 className="text-3xl font-bold font-serif text-primary mb-2">Object Browser</h1>
          <p className="text-muted-foreground font-sans">
            Search and filter the complete inventory of catalogued objects.
          </p>
        </header>

        <form onSubmit={handleSearch} className="bg-card p-4 rounded-lg border shadow-sm flex flex-col md:flex-row gap-4 font-sans">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder="Search by keyword..."
              className="pl-9"
            />
          </div>

          <div className="w-full md:w-48">
            <Select value={category || "all"} onValueChange={v => { setCategory(v === "all" ? "" : v); setPage(1); }}>
              <SelectTrigger aria-label="Filter by category">
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map(c => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="w-full md:w-48">
            <Select value={concept || "all"} onValueChange={v => { setConcept(v === "all" ? "" : v); setPage(1); }}>
              <SelectTrigger aria-label="Sort objects">
                <SelectValue placeholder="All Concepts" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Concepts</SelectItem>
                {conceptsList.map(c => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button type="submit" variant="secondary">Filter</Button>
          {(q || concept || category) && (
            <Button type="button" variant="ghost" onClick={handleClear} size="icon" title="Clear filters">
              <FilterX className="h-4 w-4" />
            </Button>
          )}
        </form>

        <div className="bg-card border rounded-lg overflow-hidden shadow-sm">
          {isLoading ? (
            <div className="p-4 space-y-4">
              {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-16 w-full" />)}
            </div>
          ) : result && result.items.length > 0 ? (
            <div className="divide-y">
              {result.items.map(item => (
                <div key={item.id} className="p-4 hover:bg-muted/30 transition-colors font-sans group">
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <Link href={`/terminology/objects/${item.id}`} className="text-lg font-medium text-primary hover:underline truncate block">
                        {item.label}
                      </Link>
                      <div className="flex flex-wrap items-center gap-2 mt-1 text-xs">
                        <span className="bg-primary/10 text-primary px-2 py-0.5 rounded border border-primary/20">{item.concept}</span>
                        <span className="text-muted-foreground uppercase tracking-wider">{item.category}</span>
                      </div>
                      {item.note && (
                        <p className="text-sm text-muted-foreground mt-2 line-clamp-2 italic font-serif">
                          {item.note}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground shrink-0 border-l pl-4">
                      <div className="text-right">
                        <div className="font-semibold text-foreground">{item.nameCount}</div>
                        <div className="text-xs">Names</div>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold text-foreground">{item.relationCount}</div>
                        <div className="text-xs">Relations</div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-12 text-center text-muted-foreground font-sans">
              No objects found matching your filters.
            </div>
          )}
        </div>

        {result && result.total > limit && (
          <div className="flex items-center justify-between py-4 font-sans">
            <div className="text-sm text-muted-foreground">
              Showing <span className="font-medium text-foreground">{offset + 1}</span> to <span className="font-medium text-foreground">{Math.min(offset + limit, result.total)}</span> of <span className="font-medium text-foreground">{result.total}</span> objects
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                <ChevronLeft className="w-4 h-4 mr-1" /> Prev
              </Button>
              <div className="text-sm font-medium px-2">Page {page} of {totalPages}</div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
              >
                Next <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
