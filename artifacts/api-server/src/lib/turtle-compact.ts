/**
 * Compacts N-Triples-flavoured Turtle (as emitted by oxigraph for
 * CONSTRUCT/DESCRIBE results) into prefixed Turtle using the site's
 * canonical namespace map. Full IRIs whose namespace matches a known
 * prefix and whose local part is a safe PN_LOCAL are rewritten to
 * `prefix:local`; everything else is left untouched. Only prefixes that
 * are actually used end up in the @prefix prologue.
 *
 * The prefix map mirrors the frontend's canonical copy in
 * `artifacts/laertius/src/lib/sparql-prefixes.ts` — keep them in sync.
 */
import { ONT, OTV } from "./lod";
import { ALIGNMENT_PREFIXES } from "./ontology-alignments";

export const TURTLE_PREFIXES: Record<string, string> = {
  lo: ONT,
  rdf: "http://www.w3.org/1999/02/22-rdf-syntax-ns#",
  rdfs: "http://www.w3.org/2000/01/rdf-schema#",
  owl: "http://www.w3.org/2002/07/owl#",
  xsd: "http://www.w3.org/2001/XMLSchema#",
  foaf: "http://xmlns.com/foaf/0.1/",
  dcterms: "http://purl.org/dc/terms/",
  void: "http://rdfs.org/ns/void#",
  otv: OTV,
  wd: "http://www.wikidata.org/entity/",
  ...ALIGNMENT_PREFIXES,
};

// Conservative subset of Turtle PN_LOCAL: no percent-escapes, no leading
// digit/dot, no trailing dot — anything fancier stays a full <IRI>.
const SAFE_LOCAL = /^[A-Za-z_][A-Za-z0-9_-]*$/;

// Longest namespaces first so e.g. rdf-syntax-ns# wins over any shorter
// namespace that happens to be its prefix string.
const NS_ENTRIES = Object.entries(TURTLE_PREFIXES).sort(
  (a, b) => b[1].length - a[1].length,
);

// One-pass tokenizer: string literals (with escapes) are matched first so
// a '<' inside a literal is never mistaken for an IRI; then <IRI> tokens.
const TOKENS = /"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|<[^>]*>/g;

export function compactTurtle(ttl: string): string {
  const used = new Set<string>();
  const body = ttl.replace(TOKENS, (tok) => {
    if (!tok.startsWith("<")) return tok; // literal — leave alone
    const iri = tok.slice(1, -1);
    for (const [prefix, ns] of NS_ENTRIES) {
      if (iri.startsWith(ns)) {
        const local = iri.slice(ns.length);
        if (SAFE_LOCAL.test(local)) {
          used.add(prefix);
          return `${prefix}:${local}`;
        }
        break; // matched the namespace but local part is unsafe
      }
    }
    return tok;
  });
  if (used.size === 0) return ttl;
  const prologue = [...used]
    .sort()
    .map((p) => `@prefix ${p}: <${TURTLE_PREFIXES[p]}> .`)
    .join("\n");
  return `${prologue}\n\n${body}`;
}
