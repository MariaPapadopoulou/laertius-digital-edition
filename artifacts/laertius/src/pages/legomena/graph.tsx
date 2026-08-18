import { useGetDerivedGraph } from "@workspace/api-client-react/legomena";
import { LoadingScreen, ErrorScreen, CertaintyBadge, EntityLink } from "@/components/legomena/shared";
import { GraphView } from "@/components/legomena/graph-view";
import { useState } from "react";
import { Link } from "wouter";

export default function Graph() {
  const { data, isLoading, error, refetch } = useGetDerivedGraph();
  const [showQueries, setShowQueries] = useState(false);

  if (isLoading) return <LoadingScreen message="Deriving assertions graph..." />;
  if (error || !data) return <ErrorScreen message="Failed to load graph derivation." retry={refetch} />;

  // Group edges by type
  const edgesByType = data.edges.reduce((acc, edge) => {
    if (!acc[edge.type]) acc[edge.type] = [];
    acc[edge.type].push(edge);
    return acc;
  }, {} as Record<string, typeof data.edges>);

  return (
    <div className="max-w-6xl mx-auto p-6 lg:p-12">
      <div className="mb-12 flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-3xl font-medium tracking-tight mb-2">
            Assertion Graph
          </h1>
          <p className="text-muted-foreground font-mono text-sm">
            {data.nodes.length} nodes · {data.edges.length} derived edges
          </p>
        </div>
        <button
          onClick={() => setShowQueries(!showQueries)}
          className="px-3 py-1.5 text-xs font-mono uppercase tracking-widest border border-border/60 hover:bg-muted/50 transition-colors"
        >
          {showQueries ? "Hide Derivation SPARQL" : "View Derivation SPARQL"}
        </button>
      </div>

      {showQueries && (
        <div className="mb-16 grid grid-cols-1 lg:grid-cols-2 gap-6 animate-in fade-in slide-in-from-top-4 duration-500">
          <div className="space-y-3">
            <h3 className="text-sm font-mono uppercase tracking-widest text-muted-foreground">Node Derivation</h3>
            <div className="bg-card border border-border/40 p-4 overflow-x-auto text-[11px] font-mono text-foreground/80 leading-relaxed whitespace-pre">
              {data.derivation.nodeQuery}
            </div>
          </div>
          <div className="space-y-3">
            <h3 className="text-sm font-mono uppercase tracking-widest text-muted-foreground">Edge Derivation</h3>
            <div className="bg-card border border-border/40 p-4 overflow-x-auto text-[11px] font-mono text-foreground/80 leading-relaxed whitespace-pre">
              {data.derivation.edgeQuery}
            </div>
          </div>
          <div className="lg:col-span-2 text-sm text-muted-foreground italic font-serif">
            "{data.derivation.description}"
          </div>
        </div>
      )}

      <div className="mb-16 animate-in fade-in duration-700">
        <GraphView nodes={data.nodes} edges={data.edges} />
        <p className="mt-3 text-xs text-muted-foreground font-mono">
          Click a node to open its entity page; click an edge for its citation.
        </p>
      </div>

      <h2 className="text-xl font-medium mb-8 pb-2 border-b border-border/40">
        Edge Registry
      </h2>
      <div className="space-y-16">
        {Object.entries(edgesByType).map(([type, edges]) => (
          <section key={type} className="animate-in fade-in duration-700">
            <h2 className="text-xl font-medium mb-6 capitalize pb-2 border-b border-border/40">
              {type.replace(/([A-Z])/g, ' $1').trim()}
            </h2>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead>
                  <tr className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest border-b border-border/20">
                    <th className="py-3 px-4 font-normal">Subject</th>
                    <th className="py-3 px-4 font-normal">Object</th>
                    <th className="py-3 px-4 font-normal">Certainty</th>
                    <th className="py-3 px-4 font-normal">Citation</th>
                    <th className="py-3 px-4 font-normal">Attribution</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/20">
                  {edges.map((edge, idx) => (
                    <tr key={`${edge.fromUri}-${edge.toUri}-${idx}`} className="group hover:bg-muted/20 transition-colors">
                      <td className="py-3 px-4">
                        <EntityLink uri={edge.fromUri} label={edge.from} />
                      </td>
                      <td className="py-3 px-4">
                        <EntityLink uri={edge.toUri} label={edge.to} />
                      </td>
                      <td className="py-3 px-4">
                        <CertaintyBadge certainty={edge.certainty} />
                      </td>
                      <td className="py-3 px-4 font-mono text-xs text-muted-foreground group-hover:text-foreground transition-colors">
                        {edge.sectionId ? (
                          <Link href={`/legomena/reader/${edge.sectionId}`} className="hover:underline decoration-primary/30">
                            {edge.citation}
                          </Link>
                        ) : (
                          edge.citation
                        )}
                      </td>
                      <td className="py-3 px-4 text-xs text-muted-foreground truncate max-w-[200px]" title={edge.attribution}>
                        {edge.attribution}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}