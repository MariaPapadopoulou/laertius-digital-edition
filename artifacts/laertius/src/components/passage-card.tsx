import { Section, Passage, TextAnnotation } from "@workspace/api-client-react";
import { Link } from "wouter";
import { AnnotatedText, LogeionText } from "@/components/annotated-text";
import { grcSpans } from "@/lib/grc";
import { useTextLayoutPref } from "@/hooks/use-text-layout-pref";

interface PassageCardProps {
  passage: Section | Passage;
  highlight?: boolean;
  /** OTV tags for this section; when set, both columns render highlights. */
  annotations?: TextAnnotation[];
  /** Forwarded to AnnotatedText: open tags in-page instead of the Index. */
  onEntityClick?: (entityUri: string) => void;
}

const SOURCE_TEXT_BASE_URL =
  "http://humanisticadigitalia.eu/GreekTexts/DiogenesLaertius/LivesOfEminentPhilosophers/";

function sourceTextHref(book: string | number, chapter: string | number, section: string | number) {
  return `${SOURCE_TEXT_BASE_URL}#sec-${book}-${chapter}-${section}`;
}

export function TextLayoutToggle({ className }: { className?: string }) {
  const [textLayout, setTextLayout] = useTextLayoutPref();
  const stacked = textLayout === "stacked";
  return (
    <div
      role="group"
      aria-label="Passage layout"
      data-testid="text-layout-toggle"
      className={`inline-flex items-center border-b border-border text-xs uppercase tracking-wider font-semibold ${className ?? ""}`}
    >
      <button
        type="button"
        aria-pressed={!stacked}
        onClick={() => setTextLayout("parallel")}
        className={`px-2.5 py-1 font-medium transition-colors ${
          !stacked
            ? "bg-primary/10 text-primary"
            : "text-muted-foreground hover:text-foreground"
        }`}
        data-testid="text-layout-parallel"
      >
        Parallel
      </button>
      <button
        type="button"
        aria-pressed={stacked}
        onClick={() => setTextLayout("stacked")}
        className={`px-2.5 py-1 font-medium transition-colors border-l border-border ${
          stacked
            ? "bg-primary/10 text-primary"
            : "text-muted-foreground hover:text-foreground"
        }`}
        data-testid="text-layout-stacked"
      >
        Stacked
      </button>
    </div>
  );
}

export function PassageCard({ passage, highlight, annotations, onEntityClick }: PassageCardProps) {
  const isPassage = "score" in passage;
  const grcAnns = annotations?.filter((a) => a.lang === "grc");
  const enAnns = annotations?.filter((a) => a.lang === "en");
  const [textLayout] = useTextLayoutPref();
  const stacked = textLayout === "stacked";

  return (
    <div className={`flex flex-col border rounded-lg overflow-hidden bg-card transition-all ${highlight ? 'border-primary ring-1 ring-primary/20 shadow-md' : 'border-border shadow-sm'}`}>
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-border bg-transparent">
        <div className="flex items-center gap-3">
          <h2 className="font-semibold text-foreground">
            D.L. {passage.book}.{passage.chapter}.{passage.section}
          </h2>
          <span className="text-xs font-semibold tracking-wide uppercase text-foreground">
            {passage.philosopher}
          </span>
          <span className="text-xs text-muted-foreground">
            {passage.school}
          </span>
        </div>
        
        <div className="flex items-center gap-3">
          {isPassage && (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-muted-foreground border-r border-border pr-2">
                Score: {passage.score.toFixed(3)}
              </span>
              <span className="uppercase tracking-wider text-[10px] font-bold text-muted-foreground">
                {passage.source}
              </span>
            </div>
          )}
          <Link 
            href={`/section/${passage.id}`}
            className="text-xs font-medium text-primary hover:underline"
          >
            Read in context
          </Link>
          <a
            href={sourceTextHref(passage.book, passage.chapter, passage.section)}
            target="_blank"
            rel="noreferrer"
            className="text-xs font-medium text-muted-foreground hover:text-primary hover:underline"
          >
            Source text &#8599;
          </a>
        </div>
      </div>
      
      <div
        className={
          stacked
            ? "grid grid-cols-1 divide-y divide-border"
            : "grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-border"
        }
      >
        <div lang="grc" className="p-5 font-serif text-lg leading-relaxed text-foreground bg-card">
          {grcAnns && grcAnns.length > 0 ? (
            <AnnotatedText
              text={passage.text}
              annotations={grcAnns}
              onEntityClick={onEntityClick}
              logeionLinks
            />
          ) : (
            <LogeionText text={passage.text} />
          )}
        </div>
        <div className="p-5 font-serif text-[1.05rem] leading-relaxed text-muted-foreground bg-transparent">
          {passage.textEn ? (
            enAnns && enAnns.length > 0 ? (
              <AnnotatedText text={passage.textEn} annotations={enAnns} onEntityClick={onEntityClick} />
            ) : (
              grcSpans(passage.textEn)
            )
          ) : (
            <span className="italic text-muted-foreground">No English translation available for this section.</span>
          )}
        </div>
      </div>
    </div>
  );
}
