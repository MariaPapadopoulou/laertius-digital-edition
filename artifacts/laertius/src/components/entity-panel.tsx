import { useMemo } from "react";
import { Link } from "wouter";
import {
  useListAnnotatedEntities,
  useListEntitySections,
  useGetOtbObject,
  useListOtbConcepts,
  getListAnnotatedEntitiesQueryKey,
  getListEntitySectionsQueryKey,
  getGetOtbObjectQueryKey,
  getListOtbConceptsQueryKey,
} from "@workspace/api-client-react";
import { KIND_STYLES } from "@/components/annotated-text";
import ClaimsPanel from "@/components/claims-panel";
import { Loader2, X } from "lucide-react";

/** "PhilosophicalSchool" -> "Philosophical School" for display. */
function conceptLabel(id: string): string {
  return id.replace(/([a-z])([A-Z])/g, "$1 $2");
}

/**
 * The entity's record in the ontoterminology, shown at the point of
 * reading: the concept it instantiates (with its isA chain and the
 * concept's definition) and its designations in each language. This is
 * the semantic layer of the terminological model applied to the text,
 * not a link out of it.
 */
function TerminologyRecord({ objectId }: { objectId: string }) {
  const { data: obj } = useGetOtbObject(objectId, {
    query: { queryKey: getGetOtbObjectQueryKey(objectId) },
  });
  const { data: concepts } = useListOtbConcepts({
    query: { queryKey: getListOtbConceptsQueryKey() },
  });

  const chain = useMemo(() => {
    if (!obj) return [];
    const byId = new Map((concepts ?? []).map((c) => [c.id, c]));
    const path: string[] = [];
    let cur: string | undefined = obj.concept;
    while (cur && !path.includes(cur)) {
      path.push(cur);
      cur = byId.get(cur)?.isA;
    }
    return path;
  }, [obj, concepts]);

  if (!obj) return null;
  const definition = concepts?.find((c) => c.id === obj.concept)?.definition;
  const grcNames = obj.names.filter((n) => n.lang === "grc").map((n) => n.name);
  const enNames = obj.names.filter((n) => n.lang === "en").map((n) => n.name);

  return (
    <div className="px-4 py-2.5 border-b border-border bg-transparent space-y-1">
      <p className="text-xs">
        <span className="uppercase tracking-wide text-[10px] font-medium text-muted-foreground mr-2">
          Terminological record
        </span>
        <span className="font-medium text-foreground">
          {chain.map(conceptLabel).join(" › ")}
        </span>
      </p>
      {definition && (
        <p className="text-xs italic text-muted-foreground leading-snug">
          {definition}
        </p>
      )}
      {(grcNames.length > 0 || enNames.length > 0) && (
        <p className="text-xs text-foreground/80">
          {grcNames.length > 0 && (
            <>
              Greek designation{grcNames.length === 1 ? "" : "s"}:{" "}
              <span lang="grc" className="font-medium">
                {grcNames.join(", ")}
              </span>
            </>
          )}
          {grcNames.length > 0 && enNames.length > 0 && " · "}
          {enNames.length > 0 && (
            <>
              English designation{enNames.length === 1 ? "" : "s"}:{" "}
              <span className="font-medium">{enNames.join(", ")}</span>
            </>
          )}
        </p>
      )}
      {obj.note && (
        <p className="text-xs text-muted-foreground leading-snug">{obj.note}</p>
      )}
    </div>
  );
}

/** Semantic layer strip for a Greek term tag: the doctrine concepts the
 * term denotes in the ontoterminology (otv:denotedConcept). Doctrine
 * labels are full propositions, so they stack as a list. */
function TermConceptRecord({ concepts }: { concepts: string[] }) {
  return (
    <div className="px-4 py-2.5 border-b border-border bg-transparent space-y-1">
      <p className="text-xs">
        <span className="uppercase tracking-wide text-[10px] font-medium text-muted-foreground mr-2">
          Terminological record
        </span>
        <span className="text-foreground/80">
          Greek key term denoting the doctrine concept
          {concepts.length === 1 ? "" : "s"}:
        </span>
      </p>
      <ul className="space-y-0.5">
        {concepts.map((c) => (
          <li key={c} className="text-xs text-foreground/90 leading-snug pl-3 relative">
            <span className="absolute left-0 text-muted-foreground">-</span>
            {c}
          </li>
        ))}
      </ul>
    </div>
  );
}

interface EntityPanelProps {
  entityUri: string;
  /** The section being read - highlighted among the occurrences. */
  currentSectionId?: string;
  onClose: () => void;
}

/**
 * In-place detail card for a tagged entity: what it is, how often it
 * occurs, and every passage where it appears (grouped by life) -
 * shown on the section page without navigating away.
 */
export function EntityPanel({ entityUri, currentSectionId, onClose }: EntityPanelProps) {
  const { data: entities } = useListAnnotatedEntities({
    query: { queryKey: getListAnnotatedEntitiesQueryKey() },
  });
  const sectionParams = { entity: entityUri };
  const { data: detail, isLoading } = useListEntitySections(sectionParams, {
    query: { queryKey: getListEntitySectionsQueryKey(sectionParams) },
  });

  const entity = entities?.find((e) => e.entityUri === entityUri);

  const grouped = useMemo(() => {
    if (!detail) return [];
    const groups = new Map<string, { philosopher: string; sections: typeof detail.sections }>();
    for (const s of detail.sections) {
      const g = groups.get(s.philosopher);
      if (g) g.sections.push(s);
      else groups.set(s.philosopher, { philosopher: s.philosopher, sections: [s] });
    }
    return [...groups.values()];
  }, [detail]);

  const style = entity ? KIND_STYLES[entity.kind] : undefined;

  return (
    <div className="border-y border-border py-4 animate-in fade-in slide-in-from-top-2 duration-300">
      <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-border bg-transparent">
        <div className="flex flex-wrap items-center gap-2 min-w-0">
          <h3 className="font-serif font-bold text-lg truncate">
            {entity?.label ?? detail?.label ?? "…"}
          </h3>
          {entity && (
            <span className={`text-xs font-semibold uppercase tracking-wider font-medium ${style?.chip ?? ""}`}>
              {style?.label ?? entity.kind}
            </span>
          )}
          {entity && (
            <span className="text-xs text-muted-foreground">
              {entity.occurrences} occurrence{entity.occurrences === 1 ? "" : "s"} in{" "}
              {entity.sectionCount} passage{entity.sectionCount === 1 ? "" : "s"}
            </span>
          )}
          {entity?.philosophyPages && (
            <a
              href={`https://www.philosophypages.com/${entity.philosophyPages}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-primary hover:underline"
            >
              Philosophy Pages ↗
            </a>
          )}
          {entity?.pleiades && (
            <a
              href={`https://pleiades.stoa.org/places/${entity.pleiades}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-primary hover:underline"
            >
              Pleiades ↗
            </a>
          )}
          {entity?.otbObjectId && (
            <Link
              href={`/terminology/objects/${entity.otbObjectId}`}
              className="text-xs text-primary hover:underline"
            >
              Ontoterminology entry
            </Link>
          )}
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <Link
            href={`/entities?entity=${encodeURIComponent(entityUri)}`}
            className="text-xs font-medium text-primary hover:underline"
          >
            Open in Index
          </Link>
          <button
            type="button"
            onClick={onClose}
            title="Close"
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
      {entity?.otbObjectId && <TerminologyRecord objectId={entity.otbObjectId} />}
      {entity?.otbObjectId && entity.kind === "philosopher" && (
        <div className="px-4 py-3 border-b border-border">
          <ClaimsPanel
            key={entity.label}
            philosopher={entity.label}
            collapsible
          />
        </div>
      )}
      {!entity?.otbObjectId &&
        entity?.kind === "term" &&
        entity.denotedConcepts &&
        entity.denotedConcepts.length > 0 && (
          <TermConceptRecord concepts={entity.denotedConcepts} />
        )}
      <div className="p-4 max-h-72 overflow-y-auto">
        {isLoading || !detail ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-3">
            {grouped.map((g) => (
              <div key={g.philosopher}>
                <span className="text-sm font-medium">{g.philosopher}</span>
                <div className="mt-1 grid sm:grid-cols-2 gap-1">
                  {g.sections.map((s) => (
                    <Link
                      key={s.id}
                      href={`/section/${s.id}`}
                      className={`flex items-start justify-between gap-2 px-2 py-1 rounded-md border transition-colors ${
                        s.id === currentSectionId
                          ? "border-primary/50 bg-transparent"
                          : "border-border bg-transparent hover:border-primary/50"
                      }`}
                      title={`Section ${s.id}${s.occurrences > 1 ? ` - ${s.occurrences} occurrences` : ""}`}
                    >
                      <span className="min-w-0">
                        <span
                          className={`block text-xs font-mono ${
                            s.id === currentSectionId ? "text-primary" : "text-muted-foreground"
                          }`}
                        >
                          {s.id}
                        </span>
                        {s.snippet && (
                          <span className="block text-[11px] leading-snug text-muted-foreground/90 mt-0.5 line-clamp-1">
                            {s.snippetStart !== undefined && s.snippetEnd !== undefined ? (
                              <>
                                {s.snippet.slice(0, s.snippetStart)}
                                <mark className="bg-primary/15 text-foreground rounded-sm px-0.5">
                                  {s.snippet.slice(s.snippetStart, s.snippetEnd)}
                                </mark>
                                {s.snippet.slice(s.snippetEnd)}
                              </>
                            ) : (
                              s.snippet
                            )}
                          </span>
                        )}
                      </span>
                      {s.occurrences > 1 && (
                        <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground shrink-0">
                          ×{s.occurrences}
                        </span>
                      )}
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
