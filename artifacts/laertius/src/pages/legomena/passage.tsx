import { useGetPassage } from "@workspace/api-client-react/legomena";
import { LoadingScreen, ErrorScreen, CertaintyBadge, EntityLink, GreekText } from "@/components/legomena/shared";
import { Link, useLocation } from "wouter";
import { useMemo } from "react";

export default function PassageDetail({ params }: { params: { sectionId: string } }) {
  const [, setLocation] = useLocation();
  const { data: passage, isLoading, error, refetch } = useGetPassage(params.sectionId);

  // Group annotations by language for the text renderers
  const grcAnnotations = useMemo(() => 
    passage?.annotations.filter(a => a.lang === "grc").sort((a, b) => a.start - b.start) || [],
  [passage]);
  
  const enAnnotations = useMemo(() => 
    passage?.annotations.filter(a => a.lang === "en").sort((a, b) => a.start - b.start) || [],
  [passage]);

  if (isLoading) return <LoadingScreen message="Retrieving text literals and annotations..." />;
  if (error || !passage) return <ErrorScreen message="Failed to load passage." retry={refetch} />;

  return (
    <div className="h-[calc(100vh-64px)] xl:h-screen flex flex-col xl:flex-row overflow-hidden">
      {/* Text Pane */}
      <div className="flex-1 flex flex-col min-w-0 border-r border-border/60 bg-card overflow-y-auto">
        <header className="sticky top-0 z-10 bg-card/95 backdrop-blur border-b border-border/60 p-4 lg:p-6 flex items-center justify-between">
          <div>
            <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest mb-1">
              {passage.urn}
            </div>
            <h1 className="text-2xl font-medium tracking-tight">
              {passage.citation}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              disabled={!passage.prevId}
              onClick={() => passage.prevId && setLocation(`/legomena/reader/${passage.prevId}`)}
              aria-label="Previous passage"
              className="px-3 py-1.5 border border-border/60 hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors font-mono text-sm"
            >
              ←
            </button>
            <button
              disabled={!passage.nextId}
              onClick={() => passage.nextId && setLocation(`/legomena/reader/${passage.nextId}`)}
              aria-label="Next passage"
              className="px-3 py-1.5 border border-border/60 hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors font-mono text-sm"
            >
              →
            </button>
          </div>
        </header>

        <div className="p-6 lg:p-12 max-w-3xl mx-auto w-full space-y-16 pb-24">
          <section className="animate-in fade-in duration-700">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xs font-mono uppercase tracking-widest text-muted-foreground border-b border-border/40 pb-2 w-full">
                Greek Text
              </h2>
            </div>
            <div className="text-lg lg:text-xl leading-relaxed lg:leading-loose text-foreground/90">
              <AnnotatedText text={passage.greekText} annotations={grcAnnotations} isGreek={true} />
            </div>
          </section>

          {passage.englishText && (
            <section className="animate-in fade-in duration-700 delay-150">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xs font-mono uppercase tracking-widest text-muted-foreground border-b border-border/40 pb-2 w-full">
                  English Translation
                </h2>
              </div>
              <div className="text-base lg:text-lg leading-relaxed lg:leading-loose text-foreground/80 font-serif">
                <AnnotatedText text={passage.englishText} annotations={enAnnotations} isGreek={false} />
              </div>
            </section>
          )}
        </div>
      </div>

      {/* Apparatus Pane (Assertions & Claims) */}
      <aside className="w-full xl:w-[400px] shrink-0 bg-background overflow-y-auto border-t xl:border-t-0 border-border/60 flex flex-col">
        <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border/60 p-4 lg:px-6">
          <h2 className="text-sm font-medium">
            Cited Assertions
          </h2>
        </div>
        
        <div className="p-4 lg:p-6 space-y-6">
          {passage.assertions.length === 0 ? (
            <div className="text-center py-12 text-sm font-mono text-muted-foreground border border-dashed border-border/60 rounded-[2px]">
              No assertions formally cited to this passage in the ontology.
            </div>
          ) : (
            passage.assertions.map(a => (
              <div key={a.uri} className="border border-border/50 bg-card rounded-[2px] p-4 text-sm group hover:border-primary/30 transition-colors animate-in fade-in slide-in-from-right-4">
                <div className="flex items-center justify-between mb-3 pb-3 border-b border-border/20">
                  <CertaintyBadge certainty={a.certainty} />
                  <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">
                    {a.kind}
                  </span>
                </div>
                
                <div className="flex flex-wrap items-baseline gap-2 mb-3">
                  <EntityLink uri={a.subjectUri} label={a.subjectLabel} />
                  <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest">
                    {a.predicateLabel}
                  </span>
                  {a.objectUri ? (
                    <EntityLink uri={a.objectUri} label={a.objectLabel} />
                  ) : (
                    <span className="italic">{a.objectValue}</span>
                  )}
                </div>

                {a.accordingTo && a.accordingTo.length > 0 && (
                  <div className="mt-3 text-xs text-muted-foreground bg-muted/30 p-2 rounded-[2px]">
                    acc. to {a.accordingTo.map((acc: any) => acc.label || acc.uri).join(", ")}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </aside>
    </div>
  );
}

// Interleaves text with stand-off annotations to create interactive spans.
// Assumes annotations do not overlap (or only uses the outermost if they do, simplified here).
function AnnotatedText({ text, annotations, isGreek }: { text: string, annotations: any[], isGreek: boolean }) {
  if (!annotations || annotations.length === 0) {
    return isGreek ? <GreekText>{text}</GreekText> : <>{text}</>;
  }

  const segments: React.ReactNode[] = [];
  let currentOffset = 0;

  annotations.forEach((ann, idx) => {
    // If the annotation starts before our current offset, it overlaps. We skip it in this simplified renderer.
    if (ann.start < currentOffset) return;

    // Add unannotated text before this annotation
    if (ann.start > currentOffset) {
      const chunk = text.substring(currentOffset, ann.start);
      segments.push(isGreek ? <GreekText key={`t-${idx}`}>{chunk}</GreekText> : <span key={`t-${idx}`}>{chunk}</span>);
    }

    // Add the annotated span
    const spanText = text.substring(ann.start, ann.end);
    segments.push(
      <span key={`a-${idx}`} className="relative inline-block group">
        <Link 
          href={`/legomena/entity?uri=${encodeURIComponent(ann.entityUri)}`}
          className="bg-primary/5 text-primary border-b border-primary/20 hover:bg-primary/10 hover:border-primary/40 transition-colors"
        >
          {isGreek ? <GreekText>{spanText}</GreekText> : spanText}
        </Link>
        {/* Tooltip for the annotation */}
        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max max-w-[200px] p-2 bg-foreground text-background text-[11px] font-mono uppercase tracking-widest rounded-[2px] opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 shadow-md">
          {ann.entityLabel || ann.entityUri.split(/[/#]/).pop()}
          <span className="block mt-1 text-[9px] text-background/60">{ann.entityKind}</span>
        </span>
      </span>
    );

    currentOffset = ann.end;
  });

  // Add remaining text
  if (currentOffset < text.length) {
    const chunk = text.substring(currentOffset);
    segments.push(isGreek ? <GreekText key={`t-end`}>{chunk}</GreekText> : <span key={`t-end`}>{chunk}</span>);
  }

  return <>{segments}</>;
}