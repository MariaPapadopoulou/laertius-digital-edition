import { Link } from "wouter";
import { useListSayings, Saying } from "@workspace/api-client-react";

const CERTAINTY_BADGE: Record<
  string,
  { label: string; className: string } | undefined
> = {
  reported: {
    label: "some say",
    className: "bg-amber-100 text-amber-800 border-amber-200",
  },
  disputed: {
    label: "disputed",
    className: "bg-red-100 text-red-800 border-red-200",
  },
  conjectured: {
    label: "conjectured",
    className: "bg-slate-100 text-slate-700 border-slate-200",
  },
};

function SayingLine({ saying }: { saying: Saying }) {
  const badge = CERTAINTY_BADGE[saying.certainty];
  return (
    <li className="text-sm leading-snug">
      <span className="text-[11px] uppercase tracking-wider text-muted-foreground mr-1.5">
        {saying.topic}
      </span>
      <span className="text-foreground">&ldquo;{saying.en}&rdquo;</span>
      {saying.to && (
        <span className="text-xs text-muted-foreground"> - to {saying.to}</span>
      )}{" "}
      {saying.sectionId ? (
        <Link
          href={`/section/${saying.sectionId}`}
          className="text-xs text-primary hover:underline whitespace-nowrap"
          title="Read this passage"
        >
          (D.L. {saying.ref})
        </Link>
      ) : (
        <span className="text-xs text-muted-foreground">(D.L. {saying.ref})</span>
      )}
      {badge && (
        <span
          className={`ml-1.5 inline-block align-middle px-1.5 py-px font-semibold uppercase tracking-wider text-[10px] leading-4 ${badge.className}`}
        >
          {badge.label}
        </span>
      )}
      {saying.alsoAttributedTo && (
        <span className="block text-xs text-muted-foreground">
          also attributed to {saying.alsoAttributedTo}
        </span>
      )}
    </li>
  );
}

export default function SayingsPanel({ philosopher }: { philosopher: string }) {
  const { data: sayings, isLoading } = useListSayings({ philosopher });

  if (isLoading || !sayings || sayings.length === 0) return null;

  return (
    <div className="space-y-2 border-t border-border pt-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Sayings &amp; apophthegms
        </h3>
        <Link
          href={`/sayings?philosopher=${encodeURIComponent(philosopher)}`}
          className="text-xs text-primary hover:underline"
        >
          Browse all
        </Link>
      </div>
      <ul className="space-y-1.5">
        {sayings.map((s) => (
          <SayingLine key={s.id} saying={s} />
        ))}
      </ul>
    </div>
  );
}
