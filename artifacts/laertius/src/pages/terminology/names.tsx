import { useState } from "react";
import { useListOtbNames } from "@workspace/api-client-react";
import { TerminologyNav } from "@/components/terminology-nav";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Link, useSearch, useLocation } from "wouter";
import { Search, ChevronLeft, ChevronRight, FilterX, BookOpen } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { usePageTitle } from "@/lib/use-page-title";
import { useResetOnSamePageNav } from "@/hooks/use-reset-on-same-page-nav";

export default function TerminologyNames() {
  usePageTitle("Ontoterminology Proper Names");
  const [, setLocation] = useLocation();
  const searchString = useSearch();
  const searchParams = new URLSearchParams(searchString);

  const [q, setQ] = useState(searchParams.get("q") || "");
  const [lang, setLang] = useState<string>(searchParams.get("lang") || "");
  const [page, setPage] = useState(1);

  const limit = 100;
  const offset = (page - 1) * limit;

  // Use the generated hook with the standard param object
  const { data: result, isLoading } = useListOtbNames({
    q: q || undefined,
    lang: (lang as "en" | "grc") || undefined,
    limit,
    offset
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    updateUrl();
  };

  const updateUrl = () => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (lang) params.set("lang", lang);
    const qs = params.toString();
    setLocation(qs ? `/terminology/names?${qs}` : "/terminology/names", { replace: true });
  };

  const handleClear = () => {
    setQ("");
    setLang("");
    setPage(1);
    setLocation("/terminology/names", { replace: true });
  };

  useResetOnSamePageNav(handleClear);

  const totalPages = result ? Math.ceil(result.total / limit) : 0;

  return (
    <div>
      <TerminologyNav />
      <div className="space-y-6 max-w-5xl mx-auto animate-in fade-in">
        <header className="border-b pb-6">
          <h1 className="text-3xl font-bold font-serif text-primary mb-2">Proper Names</h1>
          <p className="text-muted-foreground font-sans">
            Browse the bilingual inventory of formal proper names denoting catalogued objects.
          </p>
          <div className="pt-4 flex flex-wrap gap-3">
            <Button asChild variant="outline" className="font-sans shadow-sm">
              <a href="/api/otb/proper-names.en.html" target="_blank" rel="noopener">
                <BookOpen className="mr-2 h-4 w-4" />
                Proper Name Dictionary (English)
              </a>
            </Button>
            <Button asChild variant="outline" className="font-sans shadow-sm">
              <a href="/api/otb/proper-names.grc.html" target="_blank" rel="noopener">
                <BookOpen className="mr-2 h-4 w-4" />
                Proper Name Dictionary (Greek)
              </a>
            </Button>
          </div>
        </header>

        <form onSubmit={handleSearch} className="bg-card p-4 rounded-lg border shadow-sm flex flex-col md:flex-row gap-4 font-sans">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder="Search proper names..."
              className="pl-9"
            />
          </div>

          <div className="w-full md:w-48">
            <Select value={lang || "all"} onValueChange={v => { setLang(v === "all" ? "" : v); setPage(1); }}>
              <SelectTrigger aria-label="Filter names">
                <SelectValue placeholder="Language" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Languages</SelectItem>
                <SelectItem value="en">English (en)</SelectItem>
                <SelectItem value="grc">Greek (grc)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button type="submit" variant="secondary">Filter</Button>
          {(q || lang) && (
            <Button type="button" variant="ghost" onClick={handleClear} size="icon" title="Clear filters">
              <FilterX className="h-4 w-4" />
            </Button>
          )}
        </form>

        <div className="bg-card border rounded-lg shadow-sm">
          {isLoading ? (
            <div className="p-4 space-y-4">
              {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : result && result.items.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm font-sans whitespace-nowrap">
                <thead className="bg-muted/50 border-b border-border text-muted-foreground">
                  <tr>
                    <th className="px-6 py-3 font-semibold">Proper Name</th>
                    <th className="px-6 py-3 font-semibold">Language</th>
                    <th className="px-6 py-3 font-semibold">Allonyms</th>
                    <th className="px-6 py-3 font-semibold text-right">Denotes Object</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {result.items.map(item => (
                    <tr key={item.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-6 py-3 font-medium">
                        <span
                          className={item.lang === 'grc' ? 'font-serif text-base' : 'text-foreground'}
                          lang={item.lang === 'grc' ? 'grc' : undefined}
                        >
                          {item.name}
                        </span>
                      </td>
                      <td className="px-6 py-3">
                        <Badge variant="outline" className="font-mono text-[10px] uppercase">
                          {item.lang}
                        </Badge>
                      </td>
                      <td className="px-6 py-3 text-muted-foreground w-1/3">
                        {item.allonyms && item.allonyms.length > 0 ? (
                          <div className="flex gap-1 overflow-hidden" title={item.allonyms.join(", ")}>
                            <span className="truncate max-w-[200px]" lang={item.lang === 'grc' ? 'grc' : undefined}>
                              {item.allonyms.join("; ")}
                            </span>
                          </div>
                        ) : (
                          <span>None</span>
                        )}
                      </td>
                      <td className="px-6 py-3 text-right">
                        <Link href={`/terminology/objects/${item.object}`} className="text-primary hover:underline font-medium">
                          {item.objectLabel}
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-12 text-center text-muted-foreground font-sans">
              No proper names found matching your filters.
            </div>
          )}
        </div>

        {result && result.total > limit && (
          <div className="flex items-center justify-between py-4 font-sans">
            <div className="text-sm text-muted-foreground">
              Showing <span className="font-medium text-foreground">{offset + 1}</span> to <span className="font-medium text-foreground">{Math.min(offset + limit, result.total)}</span> of <span className="font-medium text-foreground">{result.total}</span> names
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
