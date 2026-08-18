import { useRoute } from "wouter";
import { useEffect, useState } from "react";
import {
  useGetSection,
  useListSections,
  useGetSectionAnnotations,
  getGetSectionQueryKey,
  getListSectionsQueryKey,
  getGetSectionAnnotationsQueryKey,
} from "@workspace/api-client-react";
import { PassageCard } from "@/components/passage-card";
import ClaimsPanel from "@/components/claims-panel";
import { EntityPanel } from "@/components/entity-panel";
import { ExternalLinksRow } from "@/components/external-links";
import { KIND_STYLES } from "@/components/annotated-text";
import { Loader2 } from "lucide-react";
import { Link } from "wouter";
import { usePageTitle } from "@/lib/use-page-title";
import { TextLayoutToggle } from "@/components/passage-card";

export default function SectionPage() {
  const [, params] = useRoute("/section/:id");
  const id = params?.id;
  const apiBase = `${import.meta.env.BASE_URL}api`;
  const [showTags, setShowTags] = useState(true);
  const [entityUri, setEntityUri] = useState<string | null>(null);

  useEffect(() => {
    setEntityUri(null);
  }, [id]);

  const { data: section, isLoading, isError } = useGetSection(id || "", {
    query: { enabled: !!id, queryKey: getGetSectionQueryKey(id || "") }
  });

  const { data: sectionAnns } = useGetSectionAnnotations(id || "", {
    query: { enabled: !!id, queryKey: getGetSectionAnnotationsQueryKey(id || "") }
  });
  usePageTitle(
    section
      ? `${section.id}${section.philosopher ? ` ${section.philosopher}` : ""}`
      : id
        ? `Section ${id}`
        : "Section",
  );

  const annotations = sectionAnns?.annotations ?? [];
  const kindsPresent = [...new Set(annotations.map(a => a.kind))].filter(k => k in KIND_STYLES);

  const neighborParams = section ? { philosopher: section.philosopher } : {};
  const { data: sections } = useListSections(
    neighborParams,
    { query: { enabled: !!section, queryKey: getListSectionsQueryKey(neighborParams) } }
  );

  let prevId: string | null = null;
  let nextId: string | null = null;

  if (sections && section) {
    const idx = sections.findIndex(s => s.id === section.id);
    if (idx > 0) prevId = sections[idx - 1].id;
    if (idx < sections.length - 1) nextId = sections[idx + 1].id;
  }

  if (isLoading) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center space-y-4">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-muted-foreground font-serif">Loading passage...</p>
      </div>
    );
  }

  if (isError || !section) {
    return (
      <div className="max-w-2xl mx-auto text-center py-20">
        <h2 className="text-2xl font-serif font-bold mb-2">Section Not Found</h2>
        <p className="text-muted-foreground mb-6">The passage you are looking for does not exist or an error occurred.</p>
        <Link href="/browse" className="text-primary hover:underline font-medium">
          Back to Browse
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center justify-between pb-6 border-b border-border">
        <Link href="/browse" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
          Library Index
        </Link>
        
        <div className="flex items-center gap-4">
          {prevId ? (
            <Link href={`/section/${prevId}`} className="text-sm font-medium text-primary hover:underline">
              Previous
            </Link>
          ) : <span className="text-sm text-muted-foreground">Previous</span>}
          
          <span className="text-border">|</span>
          
          {nextId ? (
            <Link href={`/section/${nextId}`} className="text-sm font-medium text-primary hover:underline">
              Next
            </Link>
          ) : <span className="text-sm text-muted-foreground">Next</span>}
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex justify-between items-end">
          <div>
            <h1 className="text-4xl font-serif font-bold text-foreground">
              {section.philosopher}
            </h1>
            <p className="text-muted-foreground text-lg font-serif mt-1">
              Book {section.book}, Chapter {section.chapter}, Section {section.section}
            </p>
            <ExternalLinksRow links={section.externalLinks} philosopher={section.philosopher} className="mt-3" />
          </div>
          <div className="text-right hidden sm:block">
            <p className="text-xs uppercase tracking-wider font-bold text-muted-foreground mb-1">CTS URN</p>
            <code className="text-xs bg-muted px-2 py-1 rounded text-muted-foreground border border-border font-mono">
              {section.urn}
            </code>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-xs">
          {annotations.length > 0 && (
            <>
              <button
                type="button"
                onClick={() => setShowTags(v => !v)}
                className={`px-2.5 py-1 rounded-full border font-medium transition-colors ${
                  showTags
                    ? "border-primary/40 bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                {showTags ? "Hide tags" : "Show tags"} ({annotations.length})
              </button>
              {showTags &&
                kindsPresent.map(k => (
                  <span
                    key={k}
                    className={`px-2 py-0.5 rounded-full font-medium ${KIND_STYLES[k].chip}`}
                  >
                    {KIND_STYLES[k].label}
                  </span>
                ))}
            </>
          )}
          <TextLayoutToggle className="ml-auto" />
        </div>

        <div className="pt-6 space-y-6">
          <ClaimsPanel
            key={section.philosopher}
            philosopher={section.philosopher}
            collapsible
          />
          {entityUri && (
            <EntityPanel
              entityUri={entityUri}
              currentSectionId={section.id}
              onClose={() => setEntityUri(null)}
            />
          )}
          <PassageCard
            passage={section}
            highlight
            annotations={showTags ? annotations : undefined}
            onEntityClick={setEntityUri}
          />
        </div>
      </div>
      
      {/* Mobile URN display */}
      <div className="sm:hidden pt-4 border-t border-border">
        <p className="text-xs uppercase tracking-wider font-bold text-muted-foreground mb-1">CTS URN</p>
        <code className="text-xs bg-muted px-2 py-1 rounded text-muted-foreground border border-border font-mono break-all block">
          {section.urn}
        </code>
      </div>
    </div>
  );
}
