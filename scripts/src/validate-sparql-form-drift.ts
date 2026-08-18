/**
 * Keeps the client and server agreeing on which SPARQL queries count as
 * CONSTRUCT/DESCRIBE (graph-shaped, downloadable as .ttl).
 *
 * The browser sniffs the query form with isGraphQuery
 * (artifacts/laertius/src/lib/sparql-query-form.ts, used by the playground's
 * "Download .ttl" button) using a tokenizer copied in spirit from the
 * server's queryForm (artifacts/api-server/src/routes/sparql.ts). If the two
 * ever drift — new prologue handling, comment edge cases, '#' inside IRIs —
 * the button could appear for a SELECT query or vanish for a valid
 * CONSTRUCT. This validator runs both detectors over the shipped About-page
 * examples, the compiled competency-question queries (which also render in
 * the playground), and a battery of tricky synthetic queries, failing on any
 * classification mismatch.
 *
 * Run from the workspace root:
 *   pnpm --filter @workspace/scripts run validate-sparql-form-drift
 */
import path from "node:path";

process.env["LAERTIUS_DATA_DIR"] ??= path.resolve(
  import.meta.dirname,
  "../../artifacts/api-server/data",
);

const { isGraphQuery } = await import(
  "../../artifacts/laertius/src/lib/sparql-query-form"
);
const { queryForm } = await import(
  "../../artifacts/api-server/src/routes/sparql"
);
const { sparqlExamples } = await import(
  "../../artifacts/laertius/src/pages/sparql-examples"
);
const { COMPETENCY_QUESTIONS } = await import(
  "../../artifacts/api-server/src/lib/competency"
);
const { LOD_BASE } = await import("../../artifacts/api-server/src/lib/lod");

if (sparqlExamples.length === 0) {
  console.error(
    "validate-sparql-form-drift FAILED: the shared sparql-examples module exports no queries; the example sweep would be vacuous",
  );
  process.exit(1);
}

if (COMPETENCY_QUESTIONS.length === 0) {
  console.error(
    "validate-sparql-form-drift FAILED: COMPETENCY_QUESTIONS exports no questions; the competency playground sweep would be vacuous",
  );
  process.exit(1);
}

// The competency route compiles each question's query with the runtime base
// and ontology namespace (see artifacts/api-server/src/routes/competency.ts);
// mirror that so we sweep the exact queries the competency-page playgrounds
// render.
const ONT = `${LOD_BASE}/ontology#`;
const competencyQueries: { name: string; query: string }[] =
  COMPETENCY_QUESTIONS.map((q: { id: string; sparqlFn: (base: string, ont: string) => string }) => ({
    name: `competency: ${q.id}`,
    query: q.sparqlFn(LOD_BASE, ONT),
  }));

// Synthetic edge cases exercising the tokenizer paths where the two
// implementations could plausibly drift: comments, '#' inside IRIs and
// string literals, prologue skipping, casing, and leading whitespace.
const syntheticCases: { name: string; query: string }[] = [
  {
    name: "plain SELECT",
    query: "SELECT ?s WHERE { ?s ?p ?o } LIMIT 1",
  },
  {
    name: "plain CONSTRUCT",
    query: "CONSTRUCT { ?s ?p ?o } WHERE { ?s ?p ?o } LIMIT 1",
  },
  {
    name: "plain DESCRIBE",
    query: "DESCRIBE <https://example.org/thing>",
  },
  {
    name: "plain ASK",
    query: "ASK { ?s ?p ?o }",
  },
  {
    name: "CONSTRUCT after hash-namespace PREFIX (a '#' inside an IRI)",
    query: `PREFIX lo: <https://humanisticadigitalia.eu/Laertius/ontology#>
CONSTRUCT { ?s a lo:Philosopher } WHERE { ?s a lo:Philosopher }`,
  },
  {
    name: "SELECT after hash-namespace PREFIX",
    query: `PREFIX lo: <https://humanisticadigitalia.eu/Laertius/ontology#>
SELECT ?s WHERE { ?s a lo:Philosopher }`,
  },
  {
    name: "comment containing the word CONSTRUCT before a SELECT",
    query: `# This CONSTRUCT mention is only a comment
SELECT ?s WHERE { ?s ?p ?o }`,
  },
  {
    name: "comment containing the word SELECT before a CONSTRUCT",
    query: `# select something? no: build a graph
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#> # trailing comment with construct
CONSTRUCT { ?s rdfs:label ?l } WHERE { ?s rdfs:label ?l }`,
  },
  {
    name: "BASE then PREFIX then DESCRIBE",
    query: `BASE <https://example.org/base#>
PREFIX ex: <https://example.org/ns#>
DESCRIBE ex:thing`,
  },
  {
    name: "lowercase construct with leading whitespace",
    query: "\n\t  construct { ?s ?p ?o } where { ?s ?p ?o }",
  },
  {
    name: "mixed-case DeScRiBe after comments and blank lines",
    query: `
# first comment
# second comment with a # inside

DeScRiBe <https://example.org/x#frag>`,
  },
  {
    name: "string literal containing '#' and 'CONSTRUCT' inside a SELECT",
    query: `SELECT ?s WHERE { ?s ?p "not a comment # CONSTRUCT here" }`,
  },
  {
    name: "empty query",
    query: "",
  },
  {
    name: "comments only",
    query: "# nothing but commentary\n# construct\n",
  },
  {
    name: "prologue only (PREFIX with no query body)",
    query: "PREFIX ex: <https://example.org/#>",
  },
  {
    name: "update form (INSERT DATA) is not a graph query",
    query: "INSERT DATA { <https://example.org/s> <https://example.org/p> 1 }",
  },
];

const cases: { name: string; query: string }[] = [
  ...sparqlExamples.map((e) => ({ name: `example: ${e.title}`, query: e.query })),
  ...competencyQueries,
  ...syntheticCases,
];

const errors: string[] = [];
let graphCount = 0;
let nonGraphCount = 0;

for (const { name, query } of cases) {
  const client = isGraphQuery(query);
  const form = queryForm(query);
  const server = form === "construct" || form === "describe";
  if (client !== server) {
    errors.push(
      `${name}: client isGraphQuery=${client} but server queryForm="${form}" (graph=${server}) — the .ttl download button and the endpoint's Turtle response would disagree`,
    );
    continue;
  }
  if (client) graphCount += 1;
  else nonGraphCount += 1;
}

// Positive controls: a sweep where every case lands on one side proves
// nothing about agreement on the other side.
if (graphCount === 0) {
  errors.push(
    "positive control failed: no case classified as CONSTRUCT/DESCRIBE — the graph-query side of the comparison was never exercised",
  );
}
if (nonGraphCount === 0) {
  errors.push(
    "positive control failed: no case classified as non-graph — the SELECT/ASK side of the comparison was never exercised",
  );
}
if (!sparqlExamples.some((e) => isGraphQuery(e.query))) {
  errors.push(
    "positive control failed: none of the shipped About-page examples is a CONSTRUCT/DESCRIBE query — the example sweep no longer covers the .ttl download path (did the CONSTRUCT example get removed?)",
  );
}

if (errors.length > 0) {
  console.error("validate-sparql-form-drift FAILED:");
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}

console.log(
  `validate-sparql-form-drift OK: client isGraphQuery and server queryForm agree on all ${cases.length} queries (${sparqlExamples.length} shipped examples + ${competencyQueries.length} competency questions + ${syntheticCases.length} synthetic edge cases; ${graphCount} graph, ${nonGraphCount} non-graph)`,
);
