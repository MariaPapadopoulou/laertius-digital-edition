import { Anecdote } from "@workspace/api-client-react";
import { grcSpans } from "@/lib/grc";
import { Link } from "wouter";

const CERTAINTY_BADGE: Record<
  string,
  { label: string; className: string } | undefined
> = {
  reported: {
    label: "some say",
    className: "text-foreground border-border",
  },
  disputed: {
    label: "disputed",
    className: "text-destructive border-border",
  },
  conjectured: {
    label: "conjectured",
    className: "text-muted-foreground border-border",
  },
};

export function AnecdoteCard({ anecdote }: { anecdote: Anecdote }) {
  const badge = CERTAINTY_BADGE[anecdote.certainty];
  return (
    <div className="flex flex-col border border-border rounded-lg overflow-hidden bg-card shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-border bg-transparent">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="font-semibold text-foreground">
            D.L. {anecdote.ref}
          </h2>
          <span className="text-xs font-semibold tracking-wide uppercase text-foreground">
            {anecdote.philosopher}
          </span>
          {anecdote.involves && (
            <Link
              href={`/anecdotes?involves=${encodeURIComponent(anecdote.involves)}`}
              className="text-xs text-muted-foreground italic hover:text-foreground hover:border-foreground/30 hover:underline"
              title={`See all anecdotes involving ${anecdote.involves}`}
            >
              with {anecdote.involves}
            </Link>
          )}
          <span className="text-xs text-muted-foreground">
            {anecdote.school}
          </span>
          <span className="text-xs font-medium text-primary uppercase tracking-wider">
            {anecdote.topic}
          </span>
        </div>
        <div className="flex items-center gap-3">
          {anecdote.framesSaying && (
            <span
              className="px-1.5 py-px font-semibold uppercase tracking-wider text-[10px] leading-4 text-muted-foreground"
              title="This incident narrates the setting of a curated saying"
            >
              frames a saying
            </span>
          )}
          {badge && (
            <span
              className={`px-1.5 py-px font-semibold uppercase tracking-wider text-[10px] leading-4 ${badge.className}`}
            >
              {badge.label}
            </span>
          )}
          <Link
            href={`/section/${anecdote.sectionId}`}
            className="text-xs font-medium text-primary hover:underline whitespace-nowrap"
          >
            Read in context
          </Link>
        </div>
      </div>

      <div className="p-5 space-y-3">
        <blockquote className="border-l-2 border-border pl-4 space-y-2">
          {anecdote.grc && (
            <p lang="grc" className="font-serif text-lg leading-relaxed text-foreground">
              {anecdote.grc}
            </p>
          )}
          <p className="font-serif text-[1.05rem] leading-relaxed text-muted-foreground">
            &ldquo;{grcSpans(anecdote.en)}&rdquo;
          </p>
        </blockquote>
        {(anecdote.accordingTo ||
          anecdote.alsoAttributedTo ||
          anecdote.note) && (
          <div className="space-y-0.5 pt-1">
            {anecdote.accordingTo && (
              <p className="text-xs text-muted-foreground">
                according to {anecdote.accordingTo}
              </p>
            )}
            {anecdote.alsoAttributedTo && (
              <p className="text-xs text-muted-foreground">
                also attributed to {anecdote.alsoAttributedTo}
              </p>
            )}
            {anecdote.note && (
              <p className="text-xs text-muted-foreground italic">
                {grcSpans(anecdote.note)}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
