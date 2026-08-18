import { Fragment, type ReactNode } from "react";

// Maximal runs of Greek script (Greek & Coptic + polytonic Extended
// Greek), allowing combining marks, the ano teleia / Greek question
// mark, and internal whitespace between Greek words.
const GREEK_RUN =
  /[\u0370-\u03e1\u03f0-\u03ff\u1f00-\u1fff](?:[\u0370-\u03e1\u03f0-\u03ff\u1f00-\u1fff\u0300-\u0345\u0387\u00b7;'\u2019\u02bc,\s-]*[\u0370-\u03e1\u03f0-\u03ff\u1f00-\u1fff])?/g;

/**
 * Wrap every Greek run inside a mixed-language string with
 * <span lang="grc"> so screen readers, hyphenation and font selection
 * treat it as Ancient Greek. Non-Greek text passes through untouched.
 */
export function grcSpans(text: string | undefined | null): ReactNode {
  if (!text) return text;
  const matches = Array.from(text.matchAll(GREEK_RUN));
  if (matches.length === 0) return text;
  const nodes: ReactNode[] = [];
  let last = 0;
  matches.forEach((m, i) => {
    const idx = m.index ?? 0;
    if (idx > last) nodes.push(text.slice(last, idx));
    nodes.push(
      <span lang="grc" key={i}>
        {m[0]}
      </span>,
    );
    last = idx + m[0].length;
  });
  if (last < text.length) nodes.push(text.slice(last));
  return <Fragment>{nodes}</Fragment>;
}
