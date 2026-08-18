import { Link } from "wouter";
import type { TextAnnotation } from "@workspace/api-client-react";
import { Fragment, type ReactNode } from "react";
import { grcSpans } from "@/lib/grc";

/**
 * Category colors for the OTV tag kinds, shared by the highlighted
 * passage view, the tag legend, and the entity index page.
 */
export const KIND_STYLES: Record<
  string,
  { mark: string; chip: string; label: string }
> = {
  philosopher: {
    mark: "bg-blue-50 border-b-2 border-blue-300 hover:bg-blue-100 dark:bg-blue-950/40 dark:border-blue-700 dark:hover:bg-blue-950/70",
    chip: "bg-blue-50 text-blue-900 border border-blue-200 dark:bg-blue-950/40 dark:text-blue-200 dark:border-blue-800",
    label: "Philosopher",
  },
  school: {
    mark: "bg-purple-50 border-b-2 border-purple-300 hover:bg-purple-100 dark:bg-purple-950/40 dark:border-purple-700 dark:hover:bg-purple-950/70",
    chip: "bg-purple-50 text-purple-900 border border-purple-200 dark:bg-purple-950/40 dark:text-purple-200 dark:border-purple-800",
    label: "School",
  },
  place: {
    mark: "bg-green-50 border-b-2 border-green-300 hover:bg-green-100 dark:bg-green-950/40 dark:border-green-700 dark:hover:bg-green-950/70",
    chip: "bg-green-50 text-green-900 border border-green-200 dark:bg-green-950/40 dark:text-green-200 dark:border-green-800",
    label: "Place",
  },
  person: {
    mark: "bg-amber-50 border-b-2 border-amber-300 hover:bg-amber-100 dark:bg-amber-950/40 dark:border-amber-700 dark:hover:bg-amber-950/70",
    chip: "bg-amber-50 text-amber-900 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-200 dark:border-amber-800",
    label: "Person",
  },
  source: {
    mark: "bg-rose-50 border-b-2 border-rose-300 hover:bg-rose-100 dark:bg-rose-950/40 dark:border-rose-700 dark:hover:bg-rose-950/70",
    chip: "bg-rose-50 text-rose-900 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-200 dark:border-rose-800",
    label: "Cited source",
  },
  work: {
    mark: "bg-cyan-50 border-b-2 border-cyan-300 hover:bg-cyan-100 dark:bg-cyan-950/40 dark:border-cyan-700 dark:hover:bg-cyan-950/70",
    chip: "bg-cyan-50 text-cyan-900 border border-cyan-200 dark:bg-cyan-950/40 dark:text-cyan-200 dark:border-cyan-800",
    label: "Work",
  },
  term: {
    mark: "bg-indigo-50 border-b-2 border-indigo-300 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:border-indigo-700 dark:hover:bg-indigo-950/70",
    chip: "bg-indigo-50 text-indigo-900 border border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-200 dark:border-indigo-800",
    label: "Greek term",
  },
};

/** Matches a run of Greek letters (basic Greek + polytonic extended). */
const GREEK_WORD = /[\u0370-\u03ff\u1f00-\u1fff]+/g;

/**
 * Renders text with every Greek word linked to its Logeion dictionary
 * entry (logeion.uchicago.edu). Punctuation, elision marks and Latin
 * text are left untouched. Styling is deliberately quiet: words look
 * like plain text until hovered.
 */
export function LogeionText({ text }: { text: string }) {
  const parts: ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(GREEK_WORD)) {
    const i = m.index ?? 0;
    const word = m[0];
    if (i > last) parts.push(text.slice(last, i));
    parts.push(
      <a
        key={`${i}-${word}`}
        href={`https://logeion.uchicago.edu/${encodeURIComponent(word)}`}
        target="_blank"
        rel="noopener noreferrer"
        title={`Look up ${word} in Logeion`}
        className="hover:underline decoration-dotted underline-offset-2 hover:text-primary"
      >
        {word}
      </a>,
    );
    last = i + word.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return <>{parts}</>;
}

interface AnnotatedTextProps {
  text: string;
  annotations: TextAnnotation[];
  /**
   * When set, tags become in-page buttons calling this instead of
   * navigating to the Index (used by the section page's detail panel).
   */
  onEntityClick?: (entityUri: string) => void;
  /**
   * Link every Greek word in the untagged stretches to its Logeion
   * dictionary entry (used by the Greek column of passage cards).
   * Tagged spans keep their entity link and are not double-linked.
   */
  logeionLinks?: boolean;
}

/**
 * Renders a passage with its OTV tags as highlighted, clickable spans.
 * Annotations are non-overlapping by construction (the tagger resolves
 * overlaps), but out-of-order or stale offsets are skipped defensively.
 */
export function AnnotatedText({
  text,
  annotations,
  onEntityClick,
  logeionLinks,
}: AnnotatedTextProps) {
  const sorted = [...annotations].sort((a, b) => a.start - b.start);
  const parts: ReactNode[] = [];
  const pushPlain = (slice: string, key: number) => {
    if (logeionLinks) {
      parts.push(<LogeionText key={`plain-${key}`} text={slice} />);
    } else {
      // English/mixed text can still quote Greek words; tag those runs
      // so screen readers and font selection treat them as Ancient Greek.
      parts.push(<Fragment key={`plain-${key}`}>{grcSpans(slice)}</Fragment>);
    }
  };
  let pos = 0;
  for (const a of sorted) {
    if (a.start < pos || a.end > text.length) continue;
    if (text.slice(a.start, a.end) !== a.surface) continue;
    if (a.start > pos) pushPlain(text.slice(pos, a.start), pos);
    const style = KIND_STYLES[a.kind];
    const title = `${a.label} - ${style?.label ?? a.kind}${
      a.heuristic ? " (resolved from the section's subject)" : ""
    }`;
    const className = `${style?.mark ?? ""} rounded-t-sm px-0.5 transition-colors [box-decoration-break:clone]`;
    parts.push(
      onEntityClick ? (
        <button
          key={`${a.start}-${a.entityUri}`}
          type="button"
          onClick={() => onEntityClick(a.entityUri)}
          title={title}
          className={`${className} cursor-pointer text-left font-inherit`}
        >
          {a.surface}
        </button>
      ) : (
        <Link
          key={`${a.start}-${a.entityUri}`}
          href={`/entities?entity=${encodeURIComponent(a.entityUri)}`}
          title={title}
          className={className}
        >
          {a.surface}
        </Link>
      ),
    );
    pos = a.end;
  }
  if (pos < text.length) pushPlain(text.slice(pos), pos);
  return <>{parts}</>;
}
