import { useListOtbConcepts } from "@workspace/api-client-react";
import { TerminologyNav } from "@/components/terminology-nav";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import { ArrowRight, Layers, Network, Sparkles, Tags } from "lucide-react";
import { usePageTitle } from "@/lib/use-page-title";

export default function TerminologyConcepts() {
  usePageTitle("Ontoterminology Concepts");
  const { data: concepts, isLoading } = useListOtbConcepts();

  if (isLoading) {
    return (
      <div>
        <TerminologyNav />
        <div className="space-y-6 animate-in fade-in">
          <Skeleton className="h-10 w-[200px]" />
          <div className="grid gap-6">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-48 w-full" />)}
          </div>
        </div>
      </div>
    );
  }

  if (!concepts) return null;

  return (
    <div>
      <TerminologyNav />
      <div className="space-y-8 animate-in fade-in max-w-5xl mx-auto">
        <header className="space-y-2 border-b pb-6">
          <h1 className="text-3xl font-bold font-serif text-primary">Concept Inventory</h1>
          <p className="text-muted-foreground font-sans">
            Formal definitions of the {concepts.length} ontological concepts spanning doctrine, narrative, and text.
          </p>
          <div className="pt-4">
            <Button asChild variant="outline" className="font-sans shadow-sm">
              <a href="/api/otb/viewer.html" target="_blank" rel="noopener">
                <Network className="mr-2 h-4 w-4" />
                Ontology Viewer (HTML)
              </a>
            </Button>
          </div>
        </header>

        <div className="grid gap-8">
          {concepts.map((concept) => (
            <Card key={concept.id} id={concept.id} className="scroll-mt-24 shadow-sm hover:shadow transition-shadow">
              <CardHeader className="bg-muted/30 border-b">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <CardTitle className="text-2xl font-serif text-primary flex items-center gap-3">
                      {concept.id}
                      {concept.shortName && (
                        <span className="text-sm font-sans font-normal text-muted-foreground border px-2 py-0.5 rounded bg-background">
                          {concept.shortName}
                        </span>
                      )}
                    </CardTitle>
                    <div className="flex items-center gap-2 mt-2 font-sans">
                      <Badge variant="secondary" className="rounded-sm font-normal">
                        {concept.category}
                      </Badge>
                      {concept.isA && (
                        <div className="flex items-center text-sm text-muted-foreground">
                          <ArrowRight className="w-3 h-3 mx-1" />
                          <a href={`#${concept.isA}`} className="hover:text-primary hover:underline">
                            {concept.isA}
                          </a>
                        </div>
                      )}
                    </div>
                  </div>

                  <Link
                    href={`/terminology/objects?concept=${encodeURIComponent(concept.id)}`}
                    className="shrink-0 flex items-center gap-1.5 text-sm font-medium bg-primary/10 text-primary hover:bg-primary/20 px-3 py-1.5 rounded transition-colors"
                  >
                    <Layers className="w-4 h-4" />
                    {concept.objectCount.toLocaleString()} Objects
                  </Link>
                </div>
              </CardHeader>

              <CardContent className="p-6 space-y-6">
                {concept.definition && (
                  <div className="prose prose-sm md:prose-base prose-slate max-w-none font-serif leading-relaxed text-foreground/90 border-l-4 border-primary/20 pl-4 py-1 italic [overflow-wrap:anywhere]">
                    {concept.definition}
                  </div>
                )}

                <div className="grid md:grid-cols-2 gap-8 font-sans">
                  {/* Signatures */}
                  <div className="space-y-4">
                    <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                      <Layers className="w-4 h-4" /> Signatures
                    </h2>

                    {concept.attributes && concept.attributes.length > 0 && (
                      <div>
                        <div className="text-xs font-medium mb-2 text-foreground/70">Attributes</div>
                        <ul className="space-y-1">
                          {concept.attributes.map(attr => (
                            <li key={attr} className="text-sm px-2 py-1 bg-muted/50 rounded inline-block mr-2 mb-2">
                              {attr}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {concept.relations && concept.relations.length > 0 && (
                      <div>
                        <div className="text-xs font-medium mb-2 text-foreground/70">Relations</div>
                        <ul className="space-y-2">
                          {concept.relations.map(rel => (
                            <li key={rel.id} className="text-sm flex flex-col gap-1 p-2 border rounded bg-background">
                              <span className="font-medium text-primary">{rel.id}</span>
                              <span className="text-xs text-muted-foreground">
                                Ranges: {rel.ranges.join(", ")}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {(!concept.attributes?.length && !concept.relations?.length) && (
                      <div className="text-sm text-muted-foreground italic">No specific signatures defined.</div>
                    )}
                  </div>

                  {/* Terms */}
                  <div className="space-y-4">
                    <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                      <Tags className="w-4 h-4" /> Denoting Terms
                    </h2>
                    {concept.terms && concept.terms.length > 0 ? (
                      <ul className="space-y-2">
                        {concept.terms.map(term => (
                          <li key={term.id} className="text-sm flex items-baseline justify-between border-b pb-2 last:border-0">
                            <span
                              className={`font-medium ${term.lang === 'grc' ? 'font-serif' : 'font-sans'}`}
                              lang={term.lang === 'grc' ? 'grc' : undefined}
                            >
                              {term.name}
                            </span>
                            <Badge variant="outline" className="text-[10px] uppercase font-mono tracking-wider ml-4">
                              {term.lang}
                            </Badge>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <div className="text-sm text-muted-foreground italic">No curated terms.</div>
                    )}
                  </div>
                </div>

                {concept.examples && concept.examples.length > 0 && (
                  <div className="space-y-3 font-sans" data-testid={`examples-${concept.id}`}>
                    <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                      <Sparkles className="w-4 h-4" /> Examples
                    </h2>
                    <div className="flex flex-wrap gap-2">
                      {concept.examples.map(ex => (
                        <Link
                          key={ex.id}
                          href={`/terminology/objects/${ex.id}`}
                          className="text-sm px-3 py-1.5 border rounded bg-background hover:bg-primary/10 hover:text-primary transition-colors"
                        >
                          {ex.label}
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
