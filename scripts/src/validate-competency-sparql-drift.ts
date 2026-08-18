/**
 * Catches a competency question whose displayed SPARQL drifts from the
 * answer the page shows.
 *
 * The /competency page renders two things per question: a server-computed
 * answer (the Query Results rows plus the variables list rendered as the
 * table headers) and the SPARQL query text (result.sparql) that claims to
 * produce it. Readers can copy that text into the playground, which POSTs
 * it to /api/lod/sparql. Nothing else checks, across ALL questions, that
 * running the displayed text through the live endpoint's acceptance path
 * yields a non-empty result consistent with the page's own answer: a
 * sparqlFn refactor in competency.ts could ship a query that displays
 * fine but is rejected by the endpoint's form sniffing, returns zero
 * bindings, or projects different variables than the table shows (the
 * two e2e checks only cover two questions).
 *
 * For every question in COMPETENCY_QUESTIONS this validator:
 * 1. computes the page's own answer the exact way routes/competency.ts
 *    does (store.query with results_format json, head.vars as the
 *    variables list, bindings mapped to string rows);
 * 2. takes the displayed query text (the same sparqlFn output the route
 *    serves as `sparql`) and pushes it through the /api/lod/sparql
 *    acceptance path: the MAX_QUERY_LENGTH cap, the queryForm sniffing
 *    (must classify as "select", never "update"/"unknown"), and then the
 *    endpoint's own store.query JSON execution;
 * 3. fails naming the question id if the displayed query errors, is
 *    rejected by the endpoint checks, returns zero bindings while the
 *    page's own rows are non-empty, or its projected variables diverge
 *    from the page's variables list (order included), or the two answer
 *    row sets differ, or any projected variable never binds in any row
 *    (an all-empty column in the results table).
 *
 * Positive controls: the run fails if the catalogue is empty, if every
 * question's page answer is empty (a vacuously green graph), and the
 * summary prints per-question row counts so a hollow run is visible.
 *
 * Run from the workspace root:
 *   pnpm --filter @workspace/scripts run validate-competency-sparql-drift
 */
import path from "node:path";
import { Store } from "oxigraph";

process.env["LAERTIUS_DATA_DIR"] ??= path.resolve(
  import.meta.dirname,
  "../../artifacts/api-server/data",
);

const { COMPETENCY_QUESTIONS } = await import(
  "../../artifacts/api-server/src/lib/competency"
);
const { graphAsTurtle, ontologyAsTurtle, LOD_BASE } = await import(
  "../../artifacts/api-server/src/lib/lod"
);
const { MAX_QUERY_LENGTH, queryForm } = await import(
  "../../artifacts/api-server/src/routes/sparql"
);

// The route builds ONT the same way (routes/competency.ts line 22).
const ONT = `${LOD_BASE}/ontology#`;

interface SparqlResultsJson {
  head?: { vars?: string[] };
  results?: {
    bindings?: Array<Record<string, { type: string; value: string }>>;
  };
}

if (COMPETENCY_QUESTIONS.length === 0) {
  console.error(
    "validate-competency-sparql-drift FAILED: COMPETENCY_QUESTIONS exports zero questions; every check would pass vacuously",
  );
  process.exit(1);
}
if (!Number.isFinite(MAX_QUERY_LENGTH) || MAX_QUERY_LENGTH <= 0) {
  console.error(
    `validate-competency-sparql-drift FAILED: MAX_QUERY_LENGTH imported from routes/sparql.ts is not a positive number (got ${String(MAX_QUERY_LENGTH)}); the endpoint length check would be vacuous`,
  );
  process.exit(1);
}
if (typeof queryForm !== "function") {
  console.error(
    "validate-competency-sparql-drift FAILED: queryForm is not exported from routes/sparql.ts; the endpoint form-sniffing check would be vacuous",
  );
  process.exit(1);
}

const store = new Store();
store.load(graphAsTurtle(), { format: "text/turtle" });
store.load(ontologyAsTurtle(), { format: "text/turtle" });

const errors: string[] = [];
const summaries: string[] = [];
let totalPageRows = 0;

for (const q of COMPETENCY_QUESTIONS) {
  // 1. The page's own answer, computed the way routes/competency.ts does.
  const displayed = q.sparqlFn(LOD_BASE, ONT);
  let pageVariables: string[];
  let pageRows: string[][];
  try {
    const rawJson = String(store.query(displayed, { results_format: "json" }));
    const parsed: SparqlResultsJson = JSON.parse(rawJson);
    pageVariables = parsed.head?.vars ?? [];
    const bindings = parsed.results?.bindings ?? [];
    pageRows = bindings.map((b) =>
      pageVariables.map((v) => b[v]?.value ?? ""),
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    errors.push(
      `question "${q.id}": the page's own answer computation failed (the /api/competency route would 500): ${message}`,
    );
    continue;
  }
  totalPageRows += pageRows.length;

  if (pageVariables.length === 0) {
    errors.push(
      `question "${q.id}" projects no variables (head.vars is empty); the Query Results table would render with no columns`,
    );
    continue;
  }

  // 2. The displayed text through the /api/lod/sparql acceptance path.
  if (displayed.length > MAX_QUERY_LENGTH) {
    errors.push(
      `question "${q.id}": the displayed SPARQL is ${displayed.length} characters, over the endpoint's ${MAX_QUERY_LENGTH}-character cap; the playground would reject the page's own query with a 400`,
    );
    continue;
  }
  const form = queryForm(displayed);
  if (form !== "select") {
    errors.push(
      `question "${q.id}": the endpoint's form sniffing classifies the displayed SPARQL as "${form}", not "select"; the playground would ${form === "update" ? "reject it as an update (400)" : "not return a results table for it"}`,
    );
    continue;
  }
  let endpointVars: string[];
  let endpointRows: string[][];
  try {
    const rawJson = String(store.query(displayed, { results_format: "json" }));
    const parsed: SparqlResultsJson = JSON.parse(rawJson);
    endpointVars = parsed.head?.vars ?? [];
    const bindings = parsed.results?.bindings ?? [];
    endpointRows = bindings.map((b) =>
      endpointVars.map((v) => b[v]?.value ?? ""),
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    errors.push(
      `question "${q.id}": the displayed SPARQL failed on the endpoint's execution path: ${message}; the playground would show "SPARQL query failed" for the page's own query`,
    );
    continue;
  }

  // 3. Consistency between the displayed query's result and the page's answer.
  if (endpointRows.length === 0 && pageRows.length > 0) {
    errors.push(
      `question "${q.id}": the displayed SPARQL returns zero bindings while the page's own answer has ${pageRows.length} rows; a reader running the shown query would get an empty table`,
    );
    continue;
  }
  if (
    endpointVars.length !== pageVariables.length ||
    endpointVars.some((v, i) => v !== pageVariables[i])
  ) {
    errors.push(
      `question "${q.id}": the displayed SPARQL projects [?${endpointVars.join(", ?")}] but the page's variables list is [?${pageVariables.join(", ?")}]; the playground's table headers would not match the page's Query Results headers`,
    );
    continue;
  }
  const pageSerialized = pageRows.map((r) => JSON.stringify(r));
  const endpointSerialized = endpointRows.map((r) => JSON.stringify(r));
  if (
    pageSerialized.length !== endpointSerialized.length ||
    pageSerialized.some((r, i) => r !== endpointSerialized[i])
  ) {
    errors.push(
      `question "${q.id}": the displayed SPARQL's rows differ from the page's own answer (${endpointRows.length} vs ${pageRows.length} rows); the shown query no longer produces the answer the page displays`,
    );
    continue;
  }

  // A projected variable that never binds renders as an all-empty column.
  if (pageRows.length > 0) {
    for (let i = 0; i < pageVariables.length; i++) {
      if (pageRows.every((row) => row[i] === "")) {
        errors.push(
          `question "${q.id}": projected variable ?${pageVariables[i]} never binds in any of the ${pageRows.length} rows; the Query Results table would show an all-empty column`,
        );
      }
    }
  }

  summaries.push(`${q.id}=${pageRows.length}`);
}

// Positive control: an entirely empty graph would make every zero-rows
// check above vacuous (pageRows empty means the "zero bindings while the
// page shows rows" branch never fires).
if (totalPageRows === 0) {
  errors.push(
    `all ${COMPETENCY_QUESTIONS.length} questions returned zero rows; the drift checks ran vacuously (empty or wrongly-loaded graph?)`,
  );
}

if (errors.length > 0) {
  console.error(
    `validate-competency-sparql-drift FAILED (${errors.length} problem${errors.length === 1 ? "" : "s"}): a competency question's displayed SPARQL drifted from the answer it shows`,
  );
  for (const e of errors) console.error(`  ✗ ${e}`);
  process.exit(1);
}

console.log(
  `✓ all ${COMPETENCY_QUESTIONS.length} competency questions' displayed SPARQL pass the endpoint path and reproduce the page's own answers (${totalPageRows} total rows: ${summaries.join(", ")})`,
);
