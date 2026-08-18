import { useSearch } from "wouter";
import { useGetEntity, getGetEntityQueryKey } from "@workspace/api-client-react/legomena";
import { LoadingScreen, ErrorScreen, CertaintyBadge, EntityLink, GreekText } from "@/components/legomena/shared";
import { Link } from "wouter";

export default function EntityDetail() {
  // useLocation() strips the query string in wouter; useSearch() is the
  // reactive way to read ?uri=... (returned without the leading "?").
  const search = useSearch();
  const searchParams = new URLSearchParams(search);
  const uri = searchParams.get("uri");

  // Hooks must run unconditionally: an early return before useGetEntity
  // changes the hook count when ?uri= vanishes mid-navigation and React
  // throws "Rendered fewer hooks than expected".
  const { data: entity, isLoading, error, refetch } = useGetEntity(
    { uri: uri ?? "" },
    // Key comes from the generated getter (`/legomena/api/entity` + params),
    // which already varies with `uri`. App.tsx's QueryCache error handler only
    // flips the store-health pill for keys starting with LEGOMENA_QUERY_PREFIX
    // — a hand-rolled key would let this GET's failures bypass the pill
    // (guarded by scripts/src/validate-legomena-query-keys.ts).
    { query: { enabled: !!uri, queryKey: getGetEntityQueryKey({ uri: uri ?? "" }) } },
  );

  if (!uri) {
    return <ErrorScreen message="No entity URI provided." />;
  }

  if (isLoading) return <LoadingScreen message={`Resolving entity...`} />;
  if (error || !entity) return <ErrorScreen message="Failed to load entity detail." retry={refetch} />;

  const kindLabel = entity.kinds.map(k => k.split(/[/#]/).pop()).join(", ");

  return (
    <div className="max-w-5xl mx-auto p-6 lg:p-12">
      <header className="mb-16 border-b border-border/60 pb-8">
        <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest mb-4">
          {kindLabel} · {entity.uri.split(/[/#]/).pop()}
        </div>
        <h1 className="text-4xl lg:text-5xl font-medium tracking-tight flex items-baseline gap-4 flex-wrap">
          {entity.label}
          {entity.grcName && <GreekText className="text-3xl text-muted-foreground">{entity.grcName}</GreekText>}
        </h1>

        {(entity.book || entity.chapter || entity.schoolLabel) && (
          <div className="mt-6 flex flex-wrap gap-4 text-sm font-mono">
            {entity.book && (
              <div className="flex items-center gap-1.5 px-2 py-1 bg-muted/30 border border-border/40">
                <span>Book {entity.book}</span>
                {entity.chapter && <span className="text-muted-foreground">· Ch {entity.chapter}</span>}
              </div>
            )}
            {entity.schoolLabel && entity.schoolUri && (
              <div className="flex items-center gap-1.5 px-2 py-1 bg-muted/30 border border-border/40">
                <span className="text-muted-foreground">School:</span>
                <EntityLink uri={entity.schoolUri} label={entity.schoolLabel} />
              </div>
            )}
            {entity.founderOf && (
              <div className="flex items-center gap-1.5 px-2 py-1 bg-muted/30 border border-border/40">
                <span className="text-muted-foreground">Founder of:</span>
                <EntityLink uri={entity.founderOf} />
              </div>
            )}
          </div>
        )}
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
        <div className="lg:col-span-2 space-y-16">
          {/* Assertions as Subject */}
          {entity.assertions.length > 0 && (
            <section className="animate-in fade-in duration-500">
              <h2 className="text-lg font-medium mb-6 flex items-center gap-2">
                Assertions about <span className="text-muted-foreground">{entity.label}</span>
              </h2>
              <div className="space-y-6">
                {entity.assertions.map(a => (
                  <AssertionCard key={a.uri} assertion={a} isSubject={true} />
                ))}
              </div>
            </section>
          )}

          {/* Mentions (Assertions as Object) */}
          {entity.mentions.length > 0 && (
            <section className="animate-in fade-in duration-700">
              <h2 className="text-lg font-medium mb-6 flex items-center gap-2">
                Mentions of <span className="text-muted-foreground">{entity.label}</span>
              </h2>
              <div className="space-y-6">
                {entity.mentions.map(a => (
                  <AssertionCard key={a.uri} assertion={a} isSubject={false} />
                ))}
              </div>
            </section>
          )}
        </div>

        <div className="space-y-12">
          {/* Metadata Sidebar */}
          {entity.properNames.length > 0 && (
            <section className="bg-card border border-border/40 p-5 animate-in fade-in duration-700">
              <h3 className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-4">Proper Names</h3>
              <ul className="space-y-2 text-sm">
                {entity.properNames.map(n => (
                  <li key={`${n.uri}|${n.form}`} className="flex justify-between items-baseline">
                    {n.lang === "grc" ? <GreekText>{n.form}</GreekText> : n.form}
                    <span className="text-[10px] font-mono text-muted-foreground">{n.lang}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {entity.sameAs.length > 0 && (
            <section className="bg-card border border-border/40 p-5 animate-in fade-in duration-700 delay-100">
              <h3 className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-4">External Authorities</h3>
              <ul className="space-y-2 text-sm font-mono break-all">
                {entity.sameAs.map(link => (
                  <li key={link.uri}>
                    <a href={link.uri} target="_blank" rel="noopener noreferrer" className="block hover:text-primary hover:underline decoration-primary/30 text-muted-foreground transition-colors">
                      {link.uri.replace(/^https?:\/\//, '')}
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {entity.annotatedSections.length > 0 && (
            <section className="bg-card border border-border/40 p-5 animate-in fade-in duration-700 delay-200">
              <h3 className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-4 flex items-center justify-between">
                <span>Annotated Occurrences</span>
                <span>{entity.annotatedSections.reduce((acc, s) => acc + s.count, 0)} Total</span>
              </h3>
              <div className="max-h-64 overflow-y-auto pr-2 space-y-2 text-sm font-mono">
                {entity.annotatedSections.map(s => (
                  <Link key={s.sectionId} href={`/legomena/reader/${s.sectionId}`} className="flex items-center justify-between group py-1 border-b border-border/20 last:border-0 hover:bg-muted/30 px-2 -mx-2 transition-colors">
                    <span className="group-hover:text-primary group-hover:underline decoration-primary/30 transition-colors">
                      {s.citation}
                    </span>
                    <span className="text-[10px] text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded-[2px]">
                      {s.count} span{s.count !== 1 ? 's' : ''}
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

function AssertionCard({ assertion, isSubject }: { assertion: any, isSubject: boolean }) {
  return (
    <div className="border border-border/50 bg-card rounded-[2px] p-5 group hover:border-primary/20 transition-colors">
      <div className="flex flex-wrap gap-2 justify-between items-start mb-4">
        <div className="flex gap-2 items-center">
          <CertaintyBadge certainty={assertion.certainty} />
          {assertion.accordingTo && assertion.accordingTo.length > 0 && (
            <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">
              acc. to {assertion.accordingTo.map((a: any) => a.label || a.uri).join(", ")}
            </span>
          )}
        </div>
        <Link 
          href={`/legomena/reader/${assertion.sectionId || ''}`}
          className="text-[11px] font-mono text-muted-foreground hover:text-foreground flex items-center gap-1.5 border border-transparent hover:border-border/60 px-2 py-0.5 rounded-[2px] transition-all"
        >
          {assertion.citation}
        </Link>
      </div>

      <div className="flex items-baseline gap-2.5 text-sm md:text-base leading-relaxed break-words">
        {!isSubject && (
          <EntityLink uri={assertion.subjectUri} label={assertion.subjectLabel} />
        )}
        <span className="font-mono text-xs text-muted-foreground uppercase tracking-widest px-1">
          {assertion.predicateLabel}
        </span>
        {isSubject && (
          assertion.objectUri ? (
            <EntityLink uri={assertion.objectUri} label={assertion.objectLabel} />
          ) : (
            <span className="italic">{assertion.objectValue} {assertion.objectLang && <span className="text-[10px] font-mono text-muted-foreground no-italic ml-1">@{assertion.objectLang}</span>}</span>
          )
        )}
      </div>

      {assertion.grc && (
        <div className="mt-4 pt-3 border-t border-border/20 text-muted-foreground">
          <GreekText>{assertion.grc}</GreekText>
        </div>
      )}
      
      {assertion.chain && assertion.chain.length > 0 && (
        <div className="mt-4 bg-muted/20 border border-border/40 p-3 rounded-[2px] flex items-center gap-2 overflow-x-auto">
          <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest shrink-0">Transmission:</span>
          <div className="flex items-center gap-2 text-xs">
            {assertion.chain.sort((a: any, b: any) => b.order - a.order).map((link: any, i: number, arr: any[]) => (
              <span key={link.authorityUri} className="flex items-center gap-2 whitespace-nowrap">
                <EntityLink uri={link.authorityUri} label={link.authorityLabel} />
                {i < arr.length - 1 && <span className="text-muted-foreground/40">→</span>}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}