import { useMemo } from "react";
import { Link } from "wouter";
import {
  useListAnnotatedEntities,
  getListAnnotatedEntitiesQueryKey,
} from "@workspace/api-client-react";

// When a collection page filters by one or more people's names (for example a
// philosopher plus an addressee), this banner links each name to its entry in
// the Index of Names & Terms - but only if the name is actually a tagged
// entity (work/term kinds excluded). Names resolving to the same entity are
// deduplicated so a combined filter never shows two banners for one entry.
export function EntityIndexBanner({
  names,
}: {
  names: (string | null)[];
}) {
  const { data: taggedEntities } = useListAnnotatedEntities({
    query: { queryKey: getListAnnotatedEntitiesQueryKey() },
  });

  const entities = useMemo(() => {
    if (!taggedEntities) return [];
    const seen = new Set<string>();
    const found = [];
    for (const name of names) {
      if (!name) continue;
      const entity = taggedEntities.find(
        (e) =>
          e.kind !== "work" &&
          e.kind !== "term" &&
          e.label.toLowerCase() === name.toLowerCase(),
      );
      if (entity && !seen.has(entity.entityUri)) {
        seen.add(entity.entityUri);
        found.push(entity);
      }
    }
    return found;
  }, [names, taggedEntities]);

  if (entities.length === 0) return null;

  return (
    <>
      {entities.map((entity) => (
        <div
          key={entity.entityUri}
          className="bg-card border border-border px-6 py-4 rounded-xl shadow-sm flex flex-wrap items-center gap-3"
        >
          <span className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{entity.label}</span>{" "}
            is a tagged name in the text
            {entity.occurrences
              ? ` (${entity.occurrences} occurrence${entity.occurrences === 1 ? "" : "s"})`
              : ""}
            .
          </span>
          <Link
            href={`/entities?entity=${encodeURIComponent(entity.entityUri)}`}
            className="text-sm text-primary hover:underline font-medium"
          >
            View in the Index of Names &amp; Terms
          </Link>
        </div>
      ))}
    </>
  );
}
