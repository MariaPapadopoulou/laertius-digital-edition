import { useState } from "react";
import { useAskOntology } from "@workspace/api-client-react/legomena";
import { CertaintyBadge, EntityLink, GreekText, LoadingScreen } from "@/components/legomena/shared";
import { Link } from "wouter";

export default function Ask() {
  const [query, setQuery] = useState("");
  
  const askMutation = useAskOntology();

  const handleAsk = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    askMutation.mutate({ data: { question: query, topK: 5 } });
  };

  return (
    <div className="max-w-5xl mx-auto p-6 lg:p-12">
      <div className="mb-16">
        <h1 className="text-4xl lg:text-5xl font-medium tracking-tight mb-4">
          Interrogate the Assertions
        </h1>
        <p className="text-muted-foreground max-w-2xl leading-relaxed">
          Ask questions against the RDF dataset of the assertions, i.e., the claims an agent makes about a subject, in a specific source, and with a defined degree of confidence.
        </p>
        <p className="text-muted-foreground max-w-2xl leading-relaxed mt-2 flex flex-wrap gap-x-6 gap-y-1">
          <Link href="/about#assertion-model" className="text-primary hover:underline">
            How assertions are modelled
          </Link>
          <Link href="/legomena/sparql" className="text-primary hover:underline">
            SPARQL console
          </Link>
        </p>
      </div>

      <form onSubmit={handleAsk} className="relative mb-12 group">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="e.g. Who did Zeno of Citium study under?"
          className="w-full pl-4 pr-4 py-4 lg:py-5 bg-card border border-border/60 rounded-sm font-serif text-lg lg:text-xl shadow-sm focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all placeholder:text-muted-foreground/50"
        />
        <div className="absolute inset-y-0 right-0 pr-2 flex items-center">
          <button
            type="submit"
            disabled={!query.trim() || askMutation.isPending}
            className="px-6 py-2 bg-primary text-primary-foreground font-mono text-sm uppercase tracking-wider disabled:opacity-50 transition-opacity hover:opacity-90 rounded-[2px]"
          >
            {askMutation.isPending ? "Asking…" : "Ask"}
          </button>
        </div>
      </form>

      {askMutation.isError && (
        <div className="p-4 border border-destructive/30 bg-destructive/5 text-destructive font-mono text-sm mb-12">
          Failed to interrogate the store. Ensure the backend has finished loading the dataset.
        </div>
      )}

      {askMutation.isSuccess && askMutation.data && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 mb-24">
          <div className="flex items-center gap-3 mb-8 pb-4 border-b border-border/40">
            <h2 className="text-xl font-medium">Derived Assertions</h2>
            {askMutation.data.notice && (
              <span className="text-xs font-mono text-certainty-disputed border border-certainty-disputed/20 px-2 py-0.5 rounded-[2px]">
                {askMutation.data.notice}
              </span>
            )}
            <div className="ml-auto text-xs font-mono text-muted-foreground uppercase tracking-widest flex gap-4">
              <span>Mode: {askMutation.data.mode}</span>
            </div>
          </div>

          <div className="space-y-8">
            {askMutation.data.lines.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground font-mono text-sm">
                No assertions retrieved for this query.
              </div>
            ) : (
              askMutation.data.lines.map((line, idx) => (
                <div key={idx} className="flex flex-col md:flex-row gap-6 items-start group">
                  <div className="flex-1 space-y-3">
                    <div className="flex flex-wrap gap-2 items-center">
                      <CertaintyBadge certainty={line.assertion.certainty} />
                      {line.assertion.accordingTo && line.assertion.accordingTo.length > 0 && (
                        <span className="text-xs font-mono text-muted-foreground">
                          acc. to {line.assertion.accordingTo.map(a => a.label || a.uri).join(", ")}
                        </span>
                      )}
                    </div>
                    
                    <div className="text-lg leading-relaxed">
                      {line.text}
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground pt-2">
                      <div className="flex items-center gap-1.5 bg-muted/30 px-2 py-1 rounded-[2px] font-mono text-[11px] border border-border/50">
                        <span className="text-foreground/40">{line.assertion.subjectLabel}</span>
                        <span>→</span>
                        <span className="text-foreground/80">{line.assertion.predicateLabel}</span>
                        <span>→</span>
                        <span className="text-foreground/40">{line.assertion.objectLabel || line.assertion.objectValue}</span>
                      </div>
                    </div>
                  </div>

                  <div className="w-full md:w-64 shrink-0 bg-card border border-border/40 p-4 rounded-[2px]">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest">
                        Citation
                      </span>
                      <Link 
                        href={`/legomena/reader/${line.assertion.sectionId || ''}`}
                        className="text-xs font-medium hover:underline decoration-primary/30"
                      >
                        {line.assertion.citation}
                      </Link>
                    </div>
                    {line.passageRank !== undefined && askMutation.data.passages[line.passageRank - 1] && (
                      <div className="text-xs text-muted-foreground line-clamp-4 font-serif italic mt-3 border-l-2 border-border/40 pl-3">
                        {askMutation.data.passages[line.passageRank - 1].snippet}
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          {askMutation.data.passages.length > 0 && (
            <div className="mt-16 pt-8 border-t border-border/40">
              <h3 className="text-sm font-mono text-muted-foreground uppercase tracking-widest mb-6">
                Grounding Passages Retrieved
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {askMutation.data.passages.map((p, idx) => (
                  <Link key={idx} href={`/legomena/reader/${p.sectionId}`} className="block group">
                    <div className="border border-border/40 bg-card p-4 h-full hover:border-primary/30 transition-colors">
                      <div className="flex justify-between items-start mb-3">
                        <span className="font-medium text-sm group-hover:underline decoration-primary/30">
                          {p.citation}
                        </span>
                        <span className="font-mono text-[10px] text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded-sm">
                          Rank {p.rank}
                        </span>
                      </div>
                      <div className="text-sm text-muted-foreground font-serif line-clamp-3">
                        {p.snippetLang === 'grc' ? (
                          <GreekText>{p.snippet}</GreekText>
                        ) : (
                          p.snippet
                        )}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

    </div>
  );
}