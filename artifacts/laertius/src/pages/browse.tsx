import { usePageTitle } from "@/lib/use-page-title";
import { AboutLink } from "@/components/about-link";
import { useEffect, useRef, useState } from "react";
import { useSearch } from "wouter";
import { useResetOnSamePageNav } from "@/hooks/use-reset-on-same-page-nav";
import { useListPhilosophers, useListSections, getListSectionsQueryKey, Philosopher } from "@workspace/api-client-react";
import { PassageCard, TextLayoutToggle } from "@/components/passage-card";
import ClaimsPanel from "@/components/claims-panel";
import { ExternalLinksRow } from "@/components/external-links";

export default function BrowsePage() {
  usePageTitle("Browse");
  const { data: philosophers, isLoading: isLoadingPhil } = useListPhilosophers();
  const [selectedPhil, setSelectedPhil] = useState<Philosopher | null>(null);
  const search = useSearch();
  const bookHeadingRefs = useRef(new Map<string, HTMLHeadingElement>());
  const adoptedBookRef = useRef(false);

  // Deep link: /browse?book=N scrolls the sidebar to that book's group once
  // the philosopher index has loaded.
  useEffect(() => {
    if (adoptedBookRef.current || !philosophers) return;
    const params = new URLSearchParams(search);
    const book = params.get("book");
    if (book === null) return;
    const heading = bookHeadingRefs.current.get(book);
    if (heading) {
      adoptedBookRef.current = true;
      heading.scrollIntoView({ block: "start" });
    } else {
      // Unknown or unresolvable book: strip the stale param from the URL
      // without navigating, per the URL-adoption canonicalization rule.
      adoptedBookRef.current = true;
      params.delete("book");
      const qs = params.toString();
      window.history.replaceState(
        window.history.state,
        "",
        window.location.pathname + (qs ? `?${qs}` : "") + window.location.hash
      );
    }
  }, [philosophers, search]);

  useResetOnSamePageNav(() => {
    setSelectedPhil(null);
  });

  const sectionsParams = selectedPhil ? { philosopher: selectedPhil.name } : {};
  const { data: sections, isLoading: isLoadingSections } = useListSections(
    sectionsParams,
    { query: { enabled: !!selectedPhil, queryKey: getListSectionsQueryKey(sectionsParams) } }
  );

  const books = philosophers?.reduce((acc, phil) => {
    if (!acc[phil.book]) acc[phil.book] = [];
    acc[phil.book].push(phil);
    return acc;
  }, {} as Record<number, Philosopher[]>);

  return (
    <div className="max-w-6xl mx-auto">
      <div className="space-y-2 mb-8">
        <h1 className="text-3xl font-serif font-bold text-foreground">
          Browse the Corpus
        </h1>
        <p className="text-muted-foreground">
          Navigate through the 10 books of the <span className="italic">Lives of Eminent Philosophers</span>.
        </p>
        <AboutLink anchor="the-text" label="About the text" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Sidebar Index */}
        <div className="lg:col-span-4 space-y-6 sticky top-24 max-h-[calc(100vh-8rem)] overflow-y-auto pr-2 pb-4 custom-scrollbar">
          {isLoadingPhil ? (
            <div className="space-y-4 animate-pulse">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="h-24 bg-muted rounded-lg"></div>
              ))}
            </div>
          ) : books ? (
            Object.entries(books).map(([bookNum, phils]) => (
              <div key={bookNum} className="space-y-3">
                <h2
                  ref={(el) => {
                    if (el) bookHeadingRefs.current.set(bookNum, el);
                    else bookHeadingRefs.current.delete(bookNum);
                  }}
                  className="font-serif font-bold text-lg border-b border-border pb-1 scroll-mt-24"
                >
                  Book {bookNum}
                </h2>
                <div className="space-y-1">
                  {phils.map((phil) => (
                    <button
                      key={phil.name}
                      onClick={() => setSelectedPhil(phil)}
                      className={`w-full text-left px-3 py-2 rounded-md transition-colors ${
                        selectedPhil?.name === phil.name 
                          ? "bg-primary text-primary-foreground shadow-sm" 
                          : "hover:bg-muted text-foreground"
                      }`}
                    >
                      <div className="flex flex-col truncate">
                        <span className="font-medium truncate">{phil.name}</span>
                        <span className={`text-[10px] uppercase tracking-wider ${
                          selectedPhil?.name === phil.name ? "text-primary-foreground/80" : "text-muted-foreground"
                        }`}>
                          {phil.school}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ))
          ) : null}
        </div>

        {/* Content Area */}
        <div className="lg:col-span-8">
          {!selectedPhil ? (
            <div className="h-[50vh] flex flex-col items-center justify-center text-center p-8 bg-card border border-border border-dashed rounded-xl">
              <h2 className="text-xl font-serif font-medium text-foreground mb-2">Select a Philosopher</h2>
              <p className="text-muted-foreground max-w-sm">
                Choose a philosopher from the index to read their chapters side-by-side in Greek and English.
              </p>
            </div>
          ) : (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="bg-card border border-border p-6 rounded-xl flex items-start justify-between shadow-sm">
                <div>
                  <h2 className="text-3xl font-serif font-bold text-foreground mb-1">{selectedPhil.name}</h2>
                  <p className="text-muted-foreground font-medium flex items-center gap-2">
                    <span className="font-medium text-foreground uppercase tracking-wider text-xs uppercase tracking-wider">
                      {selectedPhil.school}
                    </span>
                    <span>•</span>
                    <span>Book {selectedPhil.book}, Chapter {selectedPhil.chapter}</span>
                  </p>
                  <ExternalLinksRow links={selectedPhil.externalLinks} philosopher={selectedPhil.name} className="mt-3" />
                </div>
                <span className="text-xs text-muted-foreground whitespace-nowrap mt-1">
                  {selectedPhil.sectionCount} sections
                </span>
              </div>

              <ClaimsPanel
                key={selectedPhil.name}
                philosopher={selectedPhil.name}
                collapsible
                defaultOpen
              />

              {isLoadingSections ? (
                <div className="space-y-6">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="h-64 bg-muted rounded-xl animate-pulse"></div>
                  ))}
                </div>
              ) : sections ? (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <h3 className="font-serif font-bold text-lg text-foreground">
                      Passages
                    </h3>
                    <TextLayoutToggle />
                  </div>
                  {sections.map(section => (
                    <PassageCard key={section.id} passage={section} />
                  ))}
                </div>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
