import { Epistle } from "@workspace/api-client-react";
import { grcSpans } from "@/lib/grc";
import { Link } from "wouter";

const AUTHENTICITY_BADGE: Record<
  string,
  { label: string; className: string } | undefined
> = {
  authentic: {
    label: "authentic",
    className: "text-foreground border-border",
  },
  disputed: {
    label: "authenticity disputed",
    className: "text-foreground border-border",
  },
  spurious: {
    label: "spurious",
    className: "text-destructive border-border",
  },
};

export function EpistleCard({ epistle }: { epistle: Epistle }) {
  const badge = AUTHENTICITY_BADGE[epistle.authenticity];
  return (
    <div className="flex flex-col border border-border rounded-lg overflow-hidden bg-card shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-border bg-transparent">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="font-semibold text-foreground">
            D.L. {epistle.ref}
          </h2>
          <Link
            href={`/letters?from=${encodeURIComponent(epistle.sender)}`}
            className="text-xs font-semibold tracking-wide uppercase text-foreground hover:opacity-80 transition-opacity"
            title={`Show all letters from ${epistle.sender}`}
          >
            {epistle.sender}
          </Link>
          <Link
            href={`/letters?to=${encodeURIComponent(epistle.to)}`}
            className="text-xs text-muted-foreground italic hover:opacity-80 transition-opacity"
            title={`Show all letters to ${epistle.to}`}
          >
            to {epistle.to}
          </Link>
          <Link
            href={`/letters?topic=${encodeURIComponent(epistle.topic)}`}
            className="text-xs font-medium text-primary uppercase tracking-wider hover:opacity-80 transition-opacity"
            title={`Show all ${epistle.topic} letters`}
          >
            {epistle.topic}
          </Link>
        </div>
        <div className="flex items-center gap-3">
          {badge && (
            <Link
              href={`/letters?verdict=${encodeURIComponent(epistle.authenticity)}`}
              className={`px-1.5 py-px font-semibold uppercase tracking-wider text-[10px] leading-4 hover:opacity-80 transition-opacity ${badge.className}`}
              title={`Show all ${epistle.authenticity} letters`}
            >
              {badge.label}
            </Link>
          )}
          {epistle.sectionId && (
            <Link
              href={`/section/${epistle.sectionId}`}
              className="text-xs font-medium text-primary hover:underline whitespace-nowrap"
            >
              Read in context
            </Link>
          )}
        </div>
      </div>

      <div className="p-5 space-y-3">
        <blockquote className="border-l-2 border-border pl-4 space-y-2">
          {epistle.grc && (
            <p lang="grc" className="font-serif text-lg leading-relaxed text-foreground">
              {epistle.grc}
            </p>
          )}
          <p className="font-serif text-[1.05rem] leading-relaxed text-muted-foreground">
            &ldquo;{grcSpans(epistle.en)}&rdquo;
          </p>
        </blockquote>
        {(epistle.dramaticDate || epistle.note) && (
          <div className="space-y-0.5 pt-1">
            {epistle.dramaticDate && (
              <p className="text-xs text-muted-foreground">
                dramatic date: {epistle.dramaticDate}
              </p>
            )}
            {epistle.note && (
              <p className="text-xs text-muted-foreground italic">
                {grcSpans(epistle.note)}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
