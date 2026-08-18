/**
 * Client-side detection of whether a query is CONSTRUCT/DESCRIBE (i.e. its
 * result is a graph serializable as Turtle). Mirrors the server's form
 * sniffing (queryForm in artifacts/api-server/src/routes/sparql.ts) in
 * spirit: skips the PREFIX/BASE prologue and comments, then looks at the
 * first keyword.
 *
 * Kept in a plain .ts module (not the playground .tsx) so the
 * validate-sparql-form-drift validator in @workspace/scripts can import it
 * alongside the server's queryForm and assert the two never disagree.
 * If you change the tokenizer or prologue handling here, mirror the change
 * in routes/sparql.ts (and vice versa) — the validator will fail otherwise.
 */
export function isGraphQuery(query: string): boolean {
  const tokens = (
    query.match(
      /<[^>]*>|#[^\n\r]*|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|[A-Za-z]+|\S/g,
    ) ?? ([] as string[]) // typed fallback: tsc otherwise infers never[] here (see routes/sparql.ts)
  ).filter((t) => !t.startsWith("#"));
  let i = 0;
  while (i < tokens.length) {
    const t = tokens[i].toLowerCase();
    if (t === "prefix" || t === "base") {
      i += 1;
      while (i < tokens.length && !tokens[i].startsWith("<")) i += 1;
      i += 1;
      continue;
    }
    return t === "construct" || t === "describe";
  }
  return false;
}
