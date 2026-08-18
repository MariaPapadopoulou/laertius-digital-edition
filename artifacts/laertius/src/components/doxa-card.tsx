import { Doxa } from "@workspace/api-client-react";
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

export function DoxaCard({ doxa }: { doxa: Doxa }) {
  const badge = CERTAINTY_BADGE[doxa.certainty];
  return (
    <div className="flex flex-col border border-border rounded-lg overflow-hidden bg-card shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-border bg-transparent">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="font-semibold text-foreground">
            D.L. {doxa.ref}
          </h2>
          <span className="text-xs font-semibold tracking-wide uppercase text-foreground">
            {doxa.philosopher}
          </span>
          <span className="text-xs text-muted-foreground">
            {doxa.school}
          </span>
          <Link
            href={`/doxography?domain=${encodeURIComponent(doxa.domain)}`}
            className="text-xs font-medium text-primary uppercase tracking-wider hover:underline"
            title={`See all doxai in the domain of ${doxa.domain}`}
          >
            {doxa.domain}
          </Link>
        </div>
        <div className="flex items-center gap-3">
          {badge && (
            <span
              className={`px-1.5 py-px font-semibold uppercase tracking-wider text-[10px] leading-4 ${badge.className}`}
            >
              {badge.label}
            </span>
          )}
          <Link
            href={`/section/${doxa.sectionId}`}
            className="text-xs font-medium text-primary hover:underline whitespace-nowrap"
          >
            Read in context
          </Link>
        </div>
      </div>

      <div className="p-5 space-y-3">
        <blockquote className="border-l-2 border-border pl-4 space-y-2">
          {doxa.grc && (
            <p lang="grc" className="font-serif text-lg leading-relaxed text-foreground">
              {doxa.grc}
            </p>
          )}
          <p className="font-serif text-[1.05rem] leading-relaxed text-muted-foreground">
            &ldquo;{grcSpans(doxa.en)}&rdquo;
          </p>
        </blockquote>
        {(doxa.doctrine ||
          doxa.accordingTo ||
          doxa.alsoAttributedTo ||
          doxa.note) && (
          <div className="space-y-0.5 pt-1">
            {doxa.doctrine && (
              <p className="text-xs text-muted-foreground">
                doctrine: <span className="italic">{doxa.doctrine}</span>
              </p>
            )}
            {doxa.accordingTo && (
              <p className="text-xs text-muted-foreground">
                according to {doxa.accordingTo}
              </p>
            )}
            {doxa.alsoAttributedTo && (
              <p className="text-xs text-muted-foreground">
                also attributed to {doxa.alsoAttributedTo}
              </p>
            )}
            {doxa.note && (
              <p className="text-xs text-muted-foreground italic">{grcSpans(doxa.note)}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
