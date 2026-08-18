import { useMemo, useState } from "react";
import { Link } from "wouter";
import { useListVerses } from "@workspace/api-client-react";
import { VerseCard } from "./verse-card";

const PREVIEW = 3;

export default function VersesPanel({ philosopher }: { philosopher: string }) {
  const { data, isLoading } = useListVerses({ philosopher });
  const [expanded, setExpanded] = useState(false);

  const verses = useMemo(
    () => (data ?? []).filter((v) => v.philosopher === philosopher),
    [data, philosopher],
  );

  if (isLoading || verses.length === 0) return null;

  const shown = expanded ? verses : verses.slice(0, PREVIEW);

  return (
    <div className="space-y-2 border-t border-border pt-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Verses &amp; epigrams
        </h3>
        <Link
          href={`/verses?philosopher=${encodeURIComponent(philosopher)}`}
          className="text-xs text-primary hover:underline"
        >
          Browse all
        </Link>
      </div>
      <div className="space-y-3">
        {shown.map((v) => (
          <VerseCard key={v.id} verse={v} compact />
        ))}
      </div>
      {verses.length > PREVIEW && (
        <button
          onClick={() => setExpanded((v) => !v)}
          className="text-xs text-primary hover:underline"
        >
          {expanded ? "Show fewer" : `Show all ${verses.length} verses`}
        </button>
      )}
    </div>
  );
}
