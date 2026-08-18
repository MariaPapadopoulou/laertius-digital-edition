import { useState, useEffect } from "react";
import { useListEntities } from "@workspace/api-client-react/legomena";
import { LoadingScreen, ErrorScreen, EntityLink, GreekText } from "@/components/legomena/shared";
import { useLocation } from "wouter";

const KINDS = ["philosopher", "sage", "school", "place", "work", "person", "source", "doctrine"];

function useDebounce(value: string, delay: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const handler = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debounced;
}

export default function Entities() {
  const [, setLocation] = useLocation();
  const [q, setQ] = useState("");
  const debouncedQ = useDebounce(q, 300);
  const [kind, setKind] = useState<string | undefined>();

  const { data, isLoading, error, refetch } = useListEntities({ q: debouncedQ, kind });

  return (
    <div className="max-w-5xl mx-auto p-6 lg:p-12">
      <div className="mb-10 flex flex-col lg:flex-row lg:items-end justify-between gap-6">
        <div>
          <h1 className="text-3xl font-medium tracking-tight mb-2">
            Index of Entities
          </h1>
          <p className="text-muted-foreground font-mono text-sm max-w-xl">
            Browse the assertion ontology. Every listed entity is the subject or object of a recovered assertion.
          </p>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-4 mb-8">
        <div className="relative flex-1">
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search entities by label or Greek name..."
            className="w-full pl-3 pr-4 py-2.5 bg-card border border-border/60 text-sm focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all placeholder:text-muted-foreground/50 rounded-[2px]"
          />
        </div>
        
        <div className="relative shrink-0 md:w-48">
          <select aria-label="Filter entities by kind"
            value={kind || ""}
            onChange={(e) => setKind(e.target.value || undefined)}
            className="w-full pl-3 pr-8 py-2.5 bg-card border border-border/60 text-sm appearance-none focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary rounded-[2px]"
          >
            <option value="">All Kinds</option>
            {KINDS.map(k => (
              <option key={k} value={k}>{k.charAt(0).toUpperCase() + k.slice(1)}</option>
            ))}
          </select>
        </div>
      </div>

      {isLoading ? (
        <div className="py-24 text-center font-mono text-sm text-muted-foreground">
          Loading…
        </div>
      ) : error || !data ? (
        <ErrorScreen message="Failed to load entities." retry={refetch} />
      ) : (
        <div className="animate-in fade-in duration-500">
          <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-4 pb-2 border-b border-border/40 flex justify-between">
            <span>{data.total} Results</span>
            <span>Assertions / Annotations</span>
          </div>

          <ul className="divide-y divide-border/20">
            {data.entities.map((entity) => (
              <li key={entity.uri} className="py-3 flex flex-col md:flex-row md:items-center justify-between gap-2 group hover:bg-muted/30 -mx-4 px-4 transition-colors">
                <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-4 flex-1 min-w-0">
                  <div className="font-medium truncate flex items-center gap-3">
                    <span 
                      className="cursor-pointer hover:underline decoration-primary/40 underline-offset-4 truncate"
                      onClick={() => setLocation(`/legomena/entity?uri=${encodeURIComponent(entity.uri)}`)}
                    >
                      {entity.label}
                    </span>
                    {entity.grcName && (
                      <GreekText className="text-muted-foreground text-sm">
                        {entity.grcName}
                      </GreekText>
                    )}
                  </div>
                  <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest px-1.5 py-0.5 border border-border/40 rounded-sm inline-block w-fit">
                    {entity.kind}
                  </span>
                </div>
                
                <div className="flex items-center gap-6 font-mono text-xs text-muted-foreground md:min-w-[120px] md:justify-end shrink-0">
                  <div className="flex gap-4">
                    <span title="Assertions touching this entity">{entity.claimCount}</span>
                    <span className="opacity-30">/</span>
                    <span title="Stored annotations">{entity.annotationCount}</span>
                  </div>
                </div>
              </li>
            ))}
            
            {data.entities.length === 0 && (
              <li className="py-12 text-center text-sm font-mono text-muted-foreground">
                No entities found matching criteria.
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}