/**
 * Executes the About page's example SPARQL queries against the in-process
 * oxigraph store (the same graph + ontology Turtle the /api/lod/sparql
 * endpoint loads) and fails if any example errors or returns zero bindings.
 *
 * The page and this validator share one query module
 * (artifacts/laertius/src/pages/sparql-examples.ts), so a graph or predicate
 * rename that would silently break a rendered example (the scholar copying it
 * would get zero rows) is caught here instead.
 *
 * Run from the workspace root:
 *   pnpm --filter @workspace/scripts run validate-sparql-examples
 */
import path from "node:path";
import { Store } from "oxigraph";

process.env["LAERTIUS_DATA_DIR"] ??= path.resolve(
  import.meta.dirname,
  "../../artifacts/api-server/data",
);

const { sparqlExamples } = await import(
  "../../artifacts/laertius/src/pages/sparql-examples"
);
const { graphAsTurtle, ontologyAsTurtle } = await import(
  "../../artifacts/api-server/src/lib/lod"
);
const { MAX_QUERY_LENGTH } = await import(
  "../../artifacts/api-server/src/routes/sparql"
);

if (sparqlExamples.length === 0) {
  console.error(
    "validate-sparql-examples FAILED: the shared sparql-examples module exports no queries (the About page examples went missing)",
  );
  process.exit(1);
}

if (!Number.isFinite(MAX_QUERY_LENGTH) || MAX_QUERY_LENGTH <= 0) {
  console.error(
    `validate-sparql-examples FAILED: MAX_QUERY_LENGTH imported from routes/sparql.ts is not a positive number (got ${String(MAX_QUERY_LENGTH)}); the length cap check would be vacuous`,
  );
  process.exit(1);
}

const store = new Store();
store.load(graphAsTurtle(), { format: "text/turtle" });
store.load(ontologyAsTurtle(), { format: "text/turtle" });

const errors: string[] = [];
const summaries: string[] = [];

for (const { title, query } of sparqlExamples) {
  if (query.length > MAX_QUERY_LENGTH) {
    errors.push(
      `"${title}" is ${query.length} characters, over the live endpoint's ${MAX_QUERY_LENGTH}-character cap (MAX_QUERY_LENGTH in routes/sparql.ts): the About page would offer an example the endpoint rejects with 400`,
    );
    continue;
  }
  if (!/^\s*(PREFIX|BASE|SELECT|CONSTRUCT|ASK)/i.test(query.trimStart())) {
    errors.push(
      `"${title}" does not look like a SELECT, CONSTRUCT, or ASK query`,
    );
    continue;
  }
  let result: unknown;
  try {
    result = store.query(query);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    errors.push(`"${title}" failed to execute: ${message}`);
    continue;
  }
  if (typeof result === "boolean") {
    // ASK query: oxigraph returns a plain boolean. A false answer means the
    // example asserts something the graph no longer supports.
    if (!result) {
      errors.push(
        `"${title}" (ASK) returned false: a scholar copying this example from the About page would get a negative answer`,
      );
      continue;
    }
    summaries.push(`"${title}": ASK true`);
    continue;
  }
  if (!Array.isArray(result)) {
    errors.push(
      `"${title}" returned an unexpected result type (${typeof result}); expected SELECT bindings, CONSTRUCT triples, or an ASK boolean`,
    );
    continue;
  }
  // Both SELECT (array of binding maps) and CONSTRUCT (array of quads) come
  // back as arrays; either way, an empty array means the example is broken.
  const isConstruct = result.length > 0 && !(result[0] instanceof Map);
  if (result.length === 0) {
    errors.push(
      `"${title}" returned zero rows/triples: a scholar copying this example from the About page would get an empty result`,
    );
    continue;
  }
  summaries.push(
    `"${title}": ${result.length} ${isConstruct ? "triples" : "rows"}`,
  );
}

if (errors.length > 0) {
  console.error(
    `validate-sparql-examples FAILED (${errors.length} problem${errors.length === 1 ? "" : "s"}): an About page SPARQL example is broken`,
  );
  for (const e of errors) console.error(`  ✗ ${e}`);
  process.exit(1);
}

console.log(
  `✓ all ${sparqlExamples.length} About page SPARQL examples executed with non-empty results (${summaries.join(", ")})`,
);
