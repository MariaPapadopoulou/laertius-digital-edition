import { useGetOtbObject, getGetOtbObjectQueryKey } from "@workspace/api-client-react";
import { TerminologyNav } from "@/components/terminology-nav";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link, useParams } from "wouter";
import { ArrowRight, ArrowLeft, AlignLeft, Tags } from "lucide-react";
import { usePageTitle } from "@/lib/use-page-title";

/**
 * Section id encoded at the tail of a cts literal
 * (".../urn:cts:...:<sectionId>/"), for linking back into the reader.
 */
function ctsSectionId(value: string): string | undefined {
  const m = /:([^:/]+)\/$/.exec(value);
  return m?.[1];
}

export default function TerminologyObjectDetail() {
  const { id } = useParams<{ id: string }>();

  // Pass id safely with options pattern
  const { data: obj, isLoading, isError } = useGetOtbObject(id || "", {
    query: {
      enabled: !!id,
      queryKey: getGetOtbObjectQueryKey(id || "")
    }
  });

  usePageTitle(obj ? obj.label : "Ontoterminology Object");

  if (isLoading) {
    return (
      <div>
        <TerminologyNav />
        <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in">
          <Skeleton className="h-12 w-3/4" />
          <div className="grid md:grid-cols-2 gap-8">
            <Skeleton className="h-64" />
            <Skeleton className="h-64" />
          </div>
        </div>
      </div>
    );
  }

  if (isError || !obj) {
    return (
      <div>
        <TerminologyNav />
        <div className="max-w-4xl mx-auto p-12 text-center border rounded-lg bg-card">
          <h2 className="text-xl font-semibold text-destructive">Object Not Found</h2>
          <p className="mt-2 text-muted-foreground">The object "{id}" could not be loaded.</p>
          <Button asChild className="mt-6" variant="outline">
            <Link href="/terminology/objects">Back to Objects</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <TerminologyNav />
      <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in pb-12">
        <header className="space-y-4">
          <div className="flex items-center gap-2 mb-2 font-sans">
            <Link href="/terminology/objects" className="text-sm text-muted-foreground hover:text-foreground">Objects</Link>
            <span className="text-muted-foreground">/</span>
            <span className="text-sm font-medium">{obj.id}</span>
          </div>

          <h1 className="text-4xl font-bold font-serif text-primary tracking-tight">{obj.label}</h1>

          <div className="flex flex-wrap items-center gap-3 font-sans">
            <Badge variant="default" className="text-sm px-3 py-1 font-normal bg-primary text-primary-foreground">
              {obj.concept}
            </Badge>
            <Badge variant="secondary" className="text-sm px-3 py-1 font-normal uppercase tracking-wider">
              {obj.category}
            </Badge>
          </div>

          {obj.note && (
            <div className="mt-6 p-4 bg-muted/30 border-l-4 border-primary/40 rounded-r text-foreground/80 font-serif leading-relaxed">
              {obj.note}
            </div>
          )}
        </header>

        <div className="grid md:grid-cols-2 gap-8 items-start">

          <div className="space-y-8">
            {/* Literals */}
            {obj.literals && obj.literals.length > 0 && (
              <Card className="shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2 font-sans">
                    <AlignLeft className="w-4 h-4 text-muted-foreground" />
                    Literal Attributes
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <dl className="space-y-4 font-sans text-sm">
                    {obj.literals.map((lit, i) => {
                      const sectionId =
                        lit.attr === "cts" ? ctsSectionId(lit.value) : undefined;
                      return (
                        <div key={i} className="flex flex-col gap-1 border-b last:border-0 pb-3 last:pb-0">
                          <dt className="font-medium text-muted-foreground flex items-center gap-2">
                            {lit.attr}
                            {lit.lang && (
                              <span className="text-[10px] uppercase font-mono tracking-wider border rounded px-1.5 py-0.5 text-muted-foreground">
                                {lit.lang}
                              </span>
                            )}
                          </dt>
                          <dd
                            className={`text-foreground break-words whitespace-pre-line ${lit.lang === 'grc' ? 'font-serif' : ''}`}
                            lang={lit.lang === 'grc' ? 'grc' : undefined}
                          >
                            {lit.value}
                          </dd>
                          {sectionId && (
                            <Link
                              href={`/section/${sectionId}`}
                              className="text-sm text-primary hover:underline"
                            >
                              Read this passage ({sectionId})
                            </Link>
                          )}
                        </div>
                      );
                    })}
                  </dl>
                </CardContent>
              </Card>
            )}

            {/* Proper Names */}
            {obj.names && obj.names.length > 0 && (
              <Card className="shadow-sm border-primary/10">
                <CardHeader className="pb-3 bg-primary/5">
                  <CardTitle className="text-lg flex items-center gap-2 font-sans">
                    <Tags className="w-4 h-4 text-primary" />
                    Proper Names
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                  <ul className="space-y-6">
                    {obj.names.map((name) => (
                      <li key={name.id} className="space-y-2">
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-lg font-medium ${name.lang === 'grc' ? 'font-serif' : 'font-sans'}`}
                            lang={name.lang === 'grc' ? 'grc' : undefined}
                          >
                            {name.name}
                          </span>
                          <Badge variant="outline" className="text-[10px] uppercase font-mono tracking-wider">
                            {name.lang}
                          </Badge>
                        </div>
                        {name.allonyms && name.allonyms.length > 0 && (
                          <div className="flex flex-wrap gap-2 pt-1">
                            {name.allonyms.map((allo, i) => (
                              <span key={i} className="text-xs px-2 py-1 bg-muted text-muted-foreground rounded" lang={name.lang === 'grc' ? 'grc' : undefined}>
                                {allo}
                              </span>
                            ))}
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}
          </div>

          <div className="space-y-8">
            {/* Outbound Relations */}
            <Card className="shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2 font-sans">
                  <ArrowRight className="w-4 h-4 text-muted-foreground" />
                  Outbound Relations
                </CardTitle>
              </CardHeader>
              <CardContent>
                {obj.relations && obj.relations.length > 0 ? (
                  <ul className="space-y-3 font-sans text-sm">
                    {obj.relations.map((rel, i) => (
                      <li key={i} className="flex flex-col gap-1 p-3 rounded-md bg-muted/20 border border-transparent hover:border-border transition-colors">
                        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{rel.rel}</span>
                        <Link href={`/terminology/objects/${rel.target}`} className="font-medium text-primary hover:underline flex items-center gap-1">
                          {rel.targetLabel}
                          <span className="text-xs font-normal text-muted-foreground ml-1">({rel.targetConcept})</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground italic">No outbound relations.</p>
                )}
              </CardContent>
            </Card>

            {/* Inbound Relations */}
            <Card className="shadow-sm">
              <CardHeader className="pb-3 flex flex-row items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2 font-sans">
                  <ArrowLeft className="w-4 h-4 text-muted-foreground" />
                  Inbound Relations
                </CardTitle>
                {obj.inboundTotal !== undefined && obj.inboundTotal > (obj.inbound?.length || 0) && (
                  <Badge variant="secondary" className="font-normal text-xs">
                    Showing {obj.inbound?.length} of {obj.inboundTotal}
                  </Badge>
                )}
              </CardHeader>
              <CardContent>
                {obj.inbound && obj.inbound.length > 0 ? (
                  <ul className="space-y-3 font-sans text-sm">
                    {obj.inbound.map((rel, i) => (
                      <li key={i} className="flex flex-col gap-1 p-3 rounded-md bg-muted/20 border border-transparent hover:border-border transition-colors">
                        <Link href={`/terminology/objects/${rel.source}`} className="font-medium text-primary hover:underline flex items-center gap-1">
                          {rel.sourceLabel}
                          <span className="text-xs font-normal text-muted-foreground ml-1">({rel.sourceConcept})</span>
                        </Link>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span className="font-semibold uppercase tracking-wider">{rel.rel}</span>
                          <ArrowRight className="w-3 h-3" />
                          <span>this object</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground italic">No inbound relations.</p>
                )}
              </CardContent>
            </Card>
          </div>

        </div>
      </div>
    </div>
  );
}
