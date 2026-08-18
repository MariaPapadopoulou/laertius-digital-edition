import { usePageTitle } from "@/lib/use-page-title";
import { grcSpans } from "@/lib/grc";
import { AboutLink } from "@/components/about-link";
import React, { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Link } from "wouter";
import {
  askQuestion,
  useGetCorpusStats,
  Claim,
  ClaimAnswer,
} from "@workspace/api-client-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useScrollMemory } from "@/hooks/use-scroll-memory";
import { useResetOnSamePageNav } from "@/hooks/use-reset-on-same-page-nav";
import { PassageCard } from "@/components/passage-card";
import { VerseCard } from "@/components/verse-card";
import { SayingCard } from "@/components/saying-card";
import { SemanticSearchNotice } from "@/components/semantic-search-notice";
import {
  AlertCircle,
  ArrowRight,
  Loader2,
  Search,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const PROPERTY_LABEL: Record<string, string> = {
  parentage: "Family",
  birthPlace: "Born in",
  birthDate: "Born",
  education: "Education",
  studiedUnder: "Studied under",
  affiliatedWith: "School",
  livedIn: "Lived in",
  traveledTo: "Traveled to",
  oldAge: "Old age",
  deme: "Deme",
  deathDate: "Died",
  deathPlace: "Died in",
  mannerOfDeath: "Death",
  writings: "Writings",
  wrote: "Wrote",
  heldDoctrine: "Doctrine",
  praised: "Praised",
  criticized: "Criticized",
  succession: "Succession",
};

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

const SAMPLE_QUERIES = [
  "How did Socrates die?",
  "Zeno's doctrine on virtue",
  "Rival accounts of Plato's birth",
];

function ClaimFactLine({
  claim,
  philosopher,
  hasRivals,
}: {
  claim: Claim;
  philosopher: string;
  hasRivals: boolean;
}) {
  const badge = CERTAINTY_BADGE[claim.certainty];
  const label = PROPERTY_LABEL[claim.property] ?? claim.property;
  const subjectPrefix =
    claim.subject && claim.subject !== philosopher ? `${claim.subject} - ` : "";
  return (
    <li className="text-sm leading-snug">
      <span className="text-xs text-muted-foreground mr-1.5">
        {subjectPrefix}
        {label}:
      </span>
      <span className="text-foreground">{claim.value}</span>
      {claim.greek && (
        <span className="ml-1 font-serif italic text-muted-foreground">
          (<span lang="grc">{claim.greek}</span>)
        </span>
      )}{" "}
      {claim.sectionId ? (
        <Link
          href={`/section/${claim.sectionId}`}
          className="inline-block py-1 text-xs text-primary hover:underline whitespace-nowrap"
          title="Read this passage"
        >
          (D.L. {claim.ref})
        </Link>
      ) : (
        <span className="text-xs text-muted-foreground">(D.L. {claim.ref})</span>
      )}
      {badge && (
        <span
          className={`ml-1.5 inline-block align-middle px-1.5 py-px font-semibold uppercase tracking-wider text-[10px] leading-4 ${badge.className}`}
        >
          {badge.label}
        </span>
      )}
      {hasRivals && (
        <span className="ml-1.5 inline-block align-middle px-1.5 py-px font-semibold uppercase tracking-wider text-[10px] leading-4 text-foreground border-border">
          rival accounts
        </span>
      )}
      {claim.grc && (
        <span lang="grc" className="block font-serif text-sm text-foreground/80">
          {claim.grc}
        </span>
      )}
      {claim.accordingTo && (
        <span className="block text-xs text-muted-foreground">
          according to {claim.accordingTo}
        </span>
      )}
      {claim.note && (
        <span className="block text-xs text-muted-foreground italic">
          {claim.note}
        </span>
      )}
    </li>
  );
}

const CLAIMS_PREVIEW = 10;

function ClaimAnswerCard({ answer }: { answer: ClaimAnswer }) {
  const [expanded, setExpanded] = useState(false);
  const ids = new Set(answer.claims.map((c) => c.id));
  const shown = expanded ? answer.claims : answer.claims.slice(0, CLAIMS_PREVIEW);
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-foreground">
        {answer.philosopher}
        <span className="ml-2 text-xs font-normal uppercase tracking-wider text-muted-foreground">
          {answer.topic}
        </span>
      </h3>
      <ul className="space-y-1.5">
        {shown.map((c) => (
          <ClaimFactLine
            key={c.id}
            claim={c}
            philosopher={answer.philosopher}
            hasRivals={(c.conflictsWith ?? []).some((id) => ids.has(id))}
          />
        ))}
      </ul>
      {answer.claims.length > CLAIMS_PREVIEW && (
        <button
          onClick={() => setExpanded((v) => !v)}
          className="inline-block py-1 text-xs text-primary hover:underline"
        >
          {expanded ? "Show fewer" : `Show all ${answer.claims.length} entries`}
        </button>
      )}
    </div>
  );
}

/** Matches inline [D.L. <section-id>] citations in generated answers. */
const INLINE_CITATION_RE = /\[\s*D\.?L\.?\s+([0-9]+(?:\.[0-9a-zA-Z-]+)+)\s*\]/g;

/** Small pill linking a citation to its passage in the reader. */
function CitationChip({ sectionId, label }: { sectionId: string; label: string }) {
  return (
    <Link
      href={`/section/${sectionId}`}
      title="Read this passage"
      className="inline-flex items-center align-baseline mx-0.5 px-1.5 py-px border-b border-primary/30 bg-transparent text-primary font-mono text-[11px] leading-4 whitespace-nowrap hover:bg-primary/15 transition-colors no-underline"
      data-testid={`citation-chip-${sectionId}`}
    >
      {label}
    </Link>
  );
}

/** Renders a paragraph of generated prose, turning inline citations into chips. */
function CitedParagraph({ text }: { text: string }) {
  const parts: React.ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  const re = new RegExp(INLINE_CITATION_RE.source, "g");
  while ((m = re.exec(text)) !== null) {
    if (m.index > last)
      parts.push(
        <React.Fragment key={`t-${last}`}>
          {grcSpans(text.slice(last, m.index))}
        </React.Fragment>,
      );
    parts.push(<CitationChip key={`${m.index}`} sectionId={m[1]!} label={`D.L. ${m[1]!}`} />);
    last = m.index + m[0].length;
  }
  if (last < text.length)
    parts.push(
      <React.Fragment key={`t-${last}`}>
        {grcSpans(text.slice(last))}
      </React.Fragment>,
    );
  return <p>{parts}</p>;
}

function askScrollKey(q: string) {
  return `ask-scroll:${q}`;
}

const LAST_QUESTION_KEY = "ask:last-question";

function returningViaHistory(): boolean {
  return (
    window.history.state !== null &&
    typeof window.history.state === "object" &&
    (window.history.state as { scrollMemory?: unknown }).scrollMemory === true
  );
}

function lastQuestion(): string {
  try {
    return sessionStorage.getItem(LAST_QUESTION_KEY) ?? "";
  } catch {
    return "";
  }
}

export default function Home() {
  usePageTitle("Ask");
  const reduceMotion = useReducedMotion();
  const [submitted, setSubmitted] = useState<string | null>(() => {
    // A question handed over from the homepage's "Ask Laertius" box
    // arrives as ?q=; submit it immediately.
    const urlQ = new URLSearchParams(window.location.search).get("q")?.trim();
    if (urlQ) {
      try {
        sessionStorage.setItem(LAST_QUESTION_KEY, urlQ);
      } catch {
        // sessionStorage unavailable: back navigation simply starts blank
      }
      return urlQ;
    }
    if (!returningViaHistory()) return null;
    const q = lastQuestion();
    return q ? q : null;
  });

  // Consume the handoff param once: strip ?q from the URL so a refresh or
  // back navigation restores from session state instead of resurrecting a
  // stale question after the reader has asked something newer.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).has("q")) {
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, []);
  const [query, setQuery] = useState(submitted ?? "");
  const { data: stats } = useGetCorpusStats();
  const queryClient = useQueryClient();

  const askQuery = useQuery({
    queryKey: ["askQuestion", submitted],
    queryFn: () => askQuestion({ query: submitted!, topK: 5 }),
    enabled: submitted !== null,
    staleTime: Infinity,
  });

  const answerReady =
    !askQuery.isFetching && askQuery.isSuccess && askQuery.data !== undefined;
  useScrollMemory(askScrollKey(submitted ?? ""), answerReady);

  useResetOnSamePageNav(() => {
    setSubmitted(null);
    setQuery("");
  });

  const doAsk = (q: string) => {
    if (!q) return;
    queryClient.removeQueries({ queryKey: ["askQuestion", q] });
    try {
      sessionStorage.setItem(LAST_QUESTION_KEY, q);
    } catch {
      // sessionStorage unavailable: back navigation simply starts blank
    }
    setSubmitted(q);
  };

  const handleAsk = (e: React.FormEvent) => {
    e.preventDefault();
    doAsk(query.trim());
  };

  const isIndexing = stats && !stats.indexReady;
  const busy = askQuery.isFetching || Boolean(isIndexing);

  return (
    <div className="bg-background text-foreground">
      {/* Ask: question box first, immediately visible */}
      <section className="border-b border-border">
        <div className="max-w-4xl mx-auto px-4 md:px-8 pt-12 lg:pt-16 pb-12">
          <h1 className="type-display text-4xl lg:text-5xl text-foreground mb-3">
            Ask Laertius
          </h1>
          <p lang="grc" className="font-serif italic text-primary text-lg mb-6">
            Βίοι καὶ γνῶμαι τῶν ἐν φιλοσοφίᾳ εὐδοκιμησάντων
          </p>
          <AboutLink anchor="asking-searching" label="About asking and searching" />

          <form onSubmit={handleAsk} className="relative group">
            <div className="relative bg-background border border-border flex items-center shadow-sm overflow-hidden rounded-sm focus-within:border-primary transition-colors">
              <div className="pl-6 pr-4 text-muted-foreground">
                <Search className="w-5 h-5" />
              </div>
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="e.g., What does Epicurus say about friendship?"
                disabled={busy}
                className="w-full bg-transparent border-none text-lg lg:text-xl font-serif text-foreground placeholder-muted-foreground/70 focus:outline-none py-5 lg:py-6 disabled:opacity-60"
              />
              <button
                type="submit"
                disabled={!query.trim() || busy}
                className="bg-primary text-primary-foreground px-6 lg:px-8 self-stretch font-mono text-[10px] uppercase tracking-[0.2em] font-semibold hover:opacity-90 transition-opacity border-l border-border flex items-center gap-2 whitespace-nowrap disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {askQuery.isFetching ? "Asking..." : "Ask"}
                {!askQuery.isFetching && <ArrowRight className="w-4 h-4 hidden sm:block" />}
              </button>
            </div>
          </form>

          <SemanticSearchNotice />

          <p className="mt-3 text-xs text-muted-foreground font-serif leading-relaxed" data-testid="ai-disclosure">
            Ask Laertius is an AI-assisted retrieval system. It combines
            keyword search with local multilingual neural retrieval. When
            available, an AI model writes a short synthesized answer grounded
            strictly in the retrieved passages; every statement carries a
            citation back to the text, and quotations and curated records are
            always shown alongside.
          </p>

          <div className="mt-6 flex flex-wrap gap-x-4 gap-y-3 text-sm font-serif">
            <span className="text-muted-foreground font-mono text-[10px] uppercase tracking-[0.2em] flex items-center mr-2">
              Try:
            </span>
            {SAMPLE_QUERIES.map((s) => (
              <button
                key={s}
                type="button"
                disabled={busy}
                onClick={() => {
                  setQuery(s);
                  doAsk(s);
                }}
                className="text-primary hover:opacity-70 border-b border-primary/30 pb-1 transition-opacity italic disabled:opacity-60"
              >
                "{s}"
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Answer area */}
      <div className="max-w-4xl mx-auto px-4 md:px-8">
        {isIndexing && (
          <Alert className="mt-10 bg-amber-500/10 text-amber-900 border-amber-500/20 dark:text-amber-400">
            <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-500" />
            <AlertTitle className="font-semibold">Library is being indexed</AlertTitle>
            <AlertDescription>
              The dense embedding index is currently building ({stats?.embeddedSections}/{stats?.totalSections}).
              The Ask feature requires semantic search and will be available once indexing completes.
            </AlertDescription>
          </Alert>
        )}

        {askQuery.isFetching && (
          <div className="py-16 flex flex-col items-center justify-center space-y-6 text-muted-foreground animate-in fade-in duration-500">
            <Loader2 className="w-10 h-10 animate-spin text-primary/50" />
            <div className="text-center space-y-2">
              <p className="font-serif text-lg">Searching the Lives for relevant passages...</p>
              <p className="text-sm opacity-70">This usually takes a moment.</p>
            </div>
          </div>
        )}

        {askQuery.isError && (
          <Alert variant="destructive" className="mt-10">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>
              Failed to retrieve passages. The server might be overloaded or still warming up.
            </AlertDescription>
          </Alert>
        )}

        {askQuery.isSuccess && askQuery.data && (
          <div className="py-12 space-y-12 animate-in slide-in-from-bottom-8 fade-in duration-700">
            {askQuery.data.generated ? (
              <div className="bg-card border border-border rounded-sm shadow-sm overflow-hidden" data-testid="generated-answer">
                <div className="px-6 py-4 border-b border-border bg-muted/30 flex items-baseline justify-between gap-3 flex-wrap">
                  <h2 className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Answer</h2>
                  <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground/70">
                    AI-synthesized from the cited passages
                  </span>
                </div>
                <div className="p-6 md:p-8 prose prose-lg prose-slate dark:prose-invert max-w-none font-serif leading-relaxed">
                  {askQuery.data.generated.text
                    .split("\n")
                    .filter((p) => p.trim() !== "")
                    .map((paragraph, i) => (
                      <CitedParagraph key={i} text={paragraph} />
                    ))}
                </div>
                {askQuery.data.generated.citations.length > 0 && (
                  <div className="px-6 pb-5 flex flex-wrap items-center gap-1.5">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mr-1">
                      Cited:
                    </span>
                    {askQuery.data.generated.citations.map((c) => (
                      <CitationChip key={c.sectionId} sectionId={c.sectionId} label={c.label} />
                    ))}
                  </div>
                )}
              </div>
            ) : askQuery.data.statsAnswer ? (
              <div className="bg-card border border-border rounded-sm shadow-sm overflow-hidden" data-testid="stats-answer">
                <div className="px-6 py-4 border-b border-border bg-muted/30 flex items-baseline justify-between gap-3 flex-wrap">
                  <h2 className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Answer</h2>
                  <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground/70">
                    Computed from live dataset statistics
                  </span>
                </div>
                <div className="p-6 md:p-8 prose prose-lg prose-slate dark:prose-invert max-w-none font-serif leading-relaxed">
                  <p>{grcSpans(askQuery.data.answer)}</p>
                </div>
                <p className="px-6 pb-5 text-xs text-muted-foreground italic" data-testid="stats-answer-source">
                  Source: {askQuery.data.statsAnswer.source} — not a passage citation.
                </p>
              </div>
            ) : (
              <div className="bg-card border border-border rounded-sm shadow-sm overflow-hidden" data-testid="extractive-answer">
                <div className="px-6 py-4 border-b border-border bg-muted/30">
                  <h2 className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Key Findings</h2>
                </div>
                <div className="p-6 md:p-8 prose prose-lg prose-slate dark:prose-invert max-w-none font-serif leading-relaxed">
                  {askQuery.data.answer.split('\n').map((paragraph, i) => (
                    <p key={i}>{grcSpans(paragraph)}</p>
                  ))}
                </div>
                {askQuery.data.passages.length > 0 && (
                  <p
                    className="px-6 pb-5 text-xs text-muted-foreground italic"
                    data-testid="extractive-fallback-notice"
                  >
                    Synthesized answers are currently unavailable, so the most
                    relevant excerpts are shown instead.
                  </p>
                )}
              </div>
            )}

            {askQuery.data.claimAnswers && askQuery.data.claimAnswers.length > 0 && (
              <div className="bg-card border border-border rounded-sm shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-border bg-muted/30">
                  <h2 className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">From the text</h2>
                  <span className="text-xs text-muted-foreground">
                    cited facts recorded by Diogenes Laertius
                  </span>
                </div>
                <div className="p-6 space-y-6">
                  {askQuery.data.claimAnswers.map((answer) => (
                    <ClaimAnswerCard
                      key={`${answer.philosopher}-${answer.topic}`}
                      answer={answer}
                    />
                  ))}
                </div>
              </div>
            )}

            {askQuery.data.verseAnswers && askQuery.data.verseAnswers.length > 0 && (
              <div className="bg-card border border-border rounded-sm shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-border bg-muted/30">
                  <h2 className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Verses &amp; epigrams</h2>
                  <span className="text-xs text-muted-foreground">
                    from the verse layer of the Lives
                  </span>
                </div>
                <div className="p-6 space-y-6">
                  {askQuery.data.verseAnswers.map((verse) => (
                    <VerseCard key={verse.id} verse={verse} />
                  ))}
                </div>
              </div>
            )}

            {askQuery.data.sayingAnswers && askQuery.data.sayingAnswers.length > 0 && (
              <div className="bg-card border border-border rounded-sm shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-border bg-muted/30">
                  <h2 className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Sayings &amp; apophthegms</h2>
                  <span className="text-xs text-muted-foreground">
                    cited witticisms and maxims from the Lives
                  </span>
                </div>
                <div className="p-6 space-y-6">
                  {askQuery.data.sayingAnswers.map((saying) => (
                    <SayingCard key={saying.id} saying={saying} />
                  ))}
                </div>
              </div>
            )}

            {askQuery.data.graphContext && askQuery.data.graphContext.matched.length > 0 && (
              <div className="bg-card border border-border rounded-sm shadow-sm px-6 py-4 space-y-2">
                <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                  Knowledge graph context
                </div>
                <div className="flex flex-wrap items-center gap-1.5 text-xs">
                  <span className="text-muted-foreground mr-1">Recognized:</span>
                  {askQuery.data.graphContext.matched.map((name) => (
                    <span key={name} className="px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                      {name}
                    </span>
                  ))}
                  {askQuery.data.graphContext.related.length > 0 && (
                    <>
                      <span className="text-muted-foreground ml-2 mr-1">Related in the successions:</span>
                      {askQuery.data.graphContext.related.map((name) => (
                        <span key={name} className="font-medium text-foreground uppercase tracking-wider">
                          {name}
                        </span>
                      ))}
                    </>
                  )}
                  <Link href="/graph" className="ml-2 inline-block py-1 text-primary hover:underline">
                    View graph
                  </Link>
                </div>
              </div>
            )}

            <div className="space-y-6">
              <div className="px-2">
                <h2 className="text-xl font-semibold text-foreground tracking-tight">Supporting Passages</h2>
              </div>
              <div className="space-y-6">
                {askQuery.data.passages.map((passage, index) => (
                  <div
                    key={passage.id}
                    className="animate-in slide-in-from-bottom-4 fade-in fill-mode-both"
                    style={{ animationDelay: `${index * 150}ms`, animationDuration: '600ms' }}
                  >
                    <PassageCard passage={passage} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
