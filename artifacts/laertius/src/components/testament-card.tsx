import { Testament } from "@workspace/api-client-react";
import { grcSpans } from "@/lib/grc";
import { Link } from "wouter";

function NameList({ label, names }: { label: string; names: string[] }) {
  if (names.length === 0) return null;
  return (
    <p className="text-sm text-muted-foreground">
      <span className="font-medium text-foreground">{label}:</span>{" "}
      {names.join(", ")}
    </p>
  );
}

export function TestamentCard({ testament }: { testament: Testament }) {
  return (
    <div className="flex flex-col border border-border rounded-lg overflow-hidden bg-card shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-border bg-transparent">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="font-semibold text-foreground">
            D.L. {testament.ref}
          </h2>
          <span className="text-xs font-semibold tracking-wide uppercase text-foreground">
            {testament.philosopher}
          </span>
          <span className="text-xs text-muted-foreground italic">
            Book {testament.book}
          </span>
        </div>
        {testament.sectionId && (
          <Link
            href={`/section/${testament.sectionId}`}
            className="text-xs font-medium text-primary hover:underline whitespace-nowrap"
          >
            Read in context
          </Link>
        )}
      </div>

      <div className="p-5 space-y-4">
        <blockquote className="border-l-2 border-border pl-4 space-y-2">
          <p lang="grc" className="font-serif text-lg leading-relaxed text-foreground">
            {testament.grc}
          </p>
          <p className="font-serif text-[1.05rem] leading-relaxed text-muted-foreground">
            &ldquo;{grcSpans(testament.en)}&rdquo;
          </p>
        </blockquote>

        <div className="space-y-1">
          <NameList label="Beneficiaries" names={testament.beneficiaries} />
          <NameList label="Executors" names={testament.executors} />
          <NameList label="Witnesses" names={testament.witnesses} />
        </div>

        <div className="space-y-1.5">
          <p className="text-sm font-medium text-foreground">Key provisions</p>
          <ul className="space-y-1">
            {testament.provisions.map((p, i) => (
              <li
                key={i}
                className="text-sm text-muted-foreground pl-4 relative before:content-['·'] before:absolute before:left-1 before:text-primary"
              >
                {p}
              </li>
            ))}
          </ul>
        </div>

        {testament.note && (
          <p className="text-xs text-muted-foreground italic pt-1">
            {grcSpans(testament.note)}
          </p>
        )}
      </div>
    </div>
  );
}
