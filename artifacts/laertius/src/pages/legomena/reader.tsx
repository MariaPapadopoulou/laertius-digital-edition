import { useState } from "react";
import { useListPassages } from "@workspace/api-client-react/legomena";
import { LoadingScreen, ErrorScreen } from "@/components/legomena/shared";
import { Link } from "wouter";

export default function Reader() {
  const [book, setBook] = useState<number | undefined>();
  const { data, isLoading, error, refetch } = useListPassages({ book });

  return (
    <div className="max-w-5xl mx-auto p-6 lg:p-12">
      <div className="mb-12 flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-3xl font-medium tracking-tight mb-2">
            Passage Index
          </h1>
          <p className="text-muted-foreground font-mono text-sm max-w-xl">
            The full ten books of Diogenes Laertius' Lives, indexed by annotated section.
          </p>
        </div>

        <div className="relative shrink-0 md:w-48">
          <select aria-label="Choose a book"
            value={book || ""}
            onChange={(e) => setBook(e.target.value ? Number(e.target.value) : undefined)}
            className="w-full pl-3 pr-8 py-2.5 bg-card border border-border/60 text-sm font-mono appearance-none focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary rounded-[2px]"
          >
            <option value="">All Books</option>
            {Array.from({ length: 10 }, (_, i) => i + 1).map(b => (
              <option key={b} value={b}>Book {b}</option>
            ))}
          </select>
        </div>
      </div>

      {isLoading ? (
        <div className="py-24 text-center font-mono text-sm text-muted-foreground">
          Loading…
        </div>
      ) : error || !data ? (
        <ErrorScreen message="Failed to load passage index." retry={refetch} />
      ) : (
        <div className="animate-in fade-in duration-500">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {data.sections.map((section) => (
              <Link key={section.id} href={`/legomena/reader/${section.id}`} className="block group">
                <div className="border border-border/50 bg-card p-5 h-full hover:border-primary/30 transition-colors flex flex-col">
                  <div className="flex justify-between items-start mb-6">
                    <span className="font-medium text-lg group-hover:underline decoration-primary/30">
                      {section.citation}
                    </span>
                    {section.hasEnglish && (
                      <span className="text-[10px] font-mono border border-border/40 px-1.5 py-0.5 rounded-[2px] text-muted-foreground">
                        EN
                      </span>
                    )}
                  </div>
                  
                  {section.lifeOf && (
                    <div className="text-sm text-muted-foreground mb-4 font-serif italic line-clamp-1">
                      Life of {section.lifeOf.split(/[/#]/).pop()?.replace(/_/g, ' ')}
                    </div>
                  )}

                  <div className="mt-auto pt-4 border-t border-border/30 flex items-center justify-between text-xs font-mono text-muted-foreground">
                    <span title="Annotations">{section.annotationCount} Ann.</span>
                    <span title="Assertions grounded here">{section.assertionCount} Ass.</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}