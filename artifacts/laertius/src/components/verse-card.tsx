import { Verse } from "@workspace/api-client-react";
import { grcSpans } from "@/lib/grc";
import { Link } from "wouter";
import { useTextLayoutPref } from "@/hooks/use-text-layout-pref";

export function VerseCard({
  verse,
  compact = false,
}: {
  verse: Verse;
  compact?: boolean;
}) {
  const [textLayout] = useTextLayoutPref();
  const stacked = compact || textLayout === "stacked";
  return (
    <div className="flex flex-col border border-border rounded-lg overflow-hidden bg-card shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-border bg-transparent">
        <div className="flex items-center gap-3">
          <h2 className="font-semibold text-foreground">
            D.L. {verse.sectionId}
          </h2>
          <span className="text-xs font-semibold tracking-wide uppercase text-foreground">
            {verse.philosopher}
          </span>
          {verse.author &&
            (verse.authorIsPhilosopher ? (
              <Link
                href={`/graph?p=${encodeURIComponent(verse.author)}`}
                className="text-xs font-medium text-accent-foreground tracking-wider uppercase hover:underline"
                title={`View ${verse.author} in the graph`}
              >
                by {verse.author}
              </Link>
            ) : (
              <Link
                href={`/verses?author=${encodeURIComponent(verse.author)}`}
                className="text-xs font-medium text-accent-foreground tracking-wider uppercase hover:underline"
                title={`See all verses by ${verse.author}`}
              >
                by {verse.author}
              </Link>
            ))}
          {verse.genre === "epigram" && (
            <span className="text-xs font-medium text-primary uppercase tracking-wider">
              Epigram
            </span>
          )}
          <span className="text-xs text-muted-foreground">
            {verse.school}
          </span>
        </div>
        <div className="flex items-center gap-3">
          {verse.source && (
            <span className="text-xs text-muted-foreground italic">
              {verse.source}
            </span>
          )}
          {verse.continued && (
            <span className="uppercase tracking-wider text-[10px] font-bold text-muted-foreground">
              continued
            </span>
          )}
          <Link
            href={`/section/${verse.sectionId}`}
            className="text-xs font-medium text-primary hover:underline whitespace-nowrap"
          >
            Read in context
          </Link>
        </div>
      </div>

      <div
        className={
          stacked
            ? "grid grid-cols-1 divide-y divide-border"
            : "grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-border"
        }
      >
        <div
          lang="grc"
          className={`${compact ? "p-4 text-base" : "p-5 text-lg"} font-serif leading-relaxed text-foreground bg-card`}
        >
          {verse.linesGrc.map((line, i) => (
            <p key={i} className="pl-6 -indent-6">
              {line}
            </p>
          ))}
        </div>
        <div
          className={`${compact ? "p-4 text-[0.95rem]" : "p-5 text-[1.05rem]"} font-serif leading-relaxed text-muted-foreground bg-transparent`}
        >
          {verse.linesEn && verse.linesEn.length > 0 ? (
            verse.linesEn.map((line, i) => (
              <p key={i} className="pl-6 -indent-6">
                {grcSpans(line)}
              </p>
            ))
          ) : (
            <span className="italic text-muted-foreground">
              No aligned English translation for this verse.
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
