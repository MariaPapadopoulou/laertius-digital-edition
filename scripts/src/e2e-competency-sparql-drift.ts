/**
 * Live HTTP check that copying a competency question's SPARQL into the
 * playground really reproduces its table.
 *
 * The in-process validator (validate-competency-sparql-drift.ts) pushes
 * every question's displayed SPARQL through the endpoint's Node-side
 * acceptance path, but the real HTTP layer of /api/lod/sparql (Express
 * body parsing, the application/sparql-query content type, the 64kb
 * text-parser limit) is only exercised for two questions by the browser
 * e2e checks. This script closes the gap without a browser:
 *
 * 1. GET /api/competency/questions and fail if the catalogue is empty
 *    (positive control against a vacuously green run).
 * 2. For every question, GET /api/competency/questions/:id and take the
 *    served `sparql` text plus the served `rows` length — exactly what
 *    the page displays.
 * 3. POST the sparql text to /api/lod/sparql as application/sparql-query
 *    (the same request the playground's copy-into-editor flow produces)
 *    and fail naming the question if the response is not 200, is not
 *    SPARQL results JSON, or its bindings count differs from the served
 *    rows length.
 * 4. A second positive control: the run fails if every question served
 *    zero rows (an empty or wrongly-loaded graph would make the count
 *    comparison vacuous).
 * 5. The endpoint's OTHER accepted routes are exercised too: for two
 *    representative questions (the longest query, and one whose IRIs
 *    contain '#' — the URL-encoding / comment-stripping hazard), the
 *    same query is sent via GET ?query= and via an
 *    application/x-www-form-urlencoded POST, failing on non-200 or a
 *    bindings-count mismatch against the served rows. A body-parser or
 *    URL-encoding regression in those branches would otherwise ship
 *    while the sparql-query path stays green.
 * 6. Guard-rail checks: an update is sent via the sparql-update content
 *    type, a form 'update' field, and an update-form query on each
 *    accepted route, all asserting a 400 with the read-only message; and
 *    one over-MAX_QUERY_LENGTH query asserts the length rejection. A
 *    body-parsing regression that let updates through or dropped the
 *    length cap fails loudly here.
 *
 * Requirements: only the API server workflow must be running (the script
 * talks to the shared proxy, default http://localhost:80; override with
 * E2E_BASE_URL). No browser needed.
 *
 * Run from the workspace root:
 *   pnpm --filter @workspace/scripts run e2e-competency-sparql-drift
 */

export {};

const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:80";

interface SparqlResultsJson {
  head?: { vars?: string[] };
  results?: { bindings?: Array<Record<string, unknown>> };
}

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`);
  if (!res.ok) {
    throw new Error(`GET ${path} returned ${res.status}`);
  }
  return (await res.json()) as T;
}

const catalogue = await getJson<{ questions: Array<{ id: string }> }>(
  "/api/competency/questions",
);
const ids = catalogue.questions.map((q) => q.id);
if (ids.length === 0) {
  console.error(
    "e2e-competency-sparql-drift FAILED: /api/competency/questions served zero questions; every check would pass vacuously",
  );
  process.exit(1);
}

const errors: string[] = [];
const summaries: string[] = [];
let totalServedRows = 0;
// Questions whose sparql-query POST check passed, kept for the alternate
// route checks (GET ?query= and form-urlencoded POST).
const passed: Array<{ id: string; sparql: string; rowCount: number }> = [];

for (const id of ids) {
  let served: { sparql?: string; rows?: string[][] };
  try {
    served = await getJson(`/api/competency/questions/${id}`);
  } catch (err) {
    errors.push(
      `question "${id}": fetching the served answer failed: ${err instanceof Error ? err.message : String(err)}`,
    );
    continue;
  }
  const sparql = served.sparql;
  const rows = served.rows;
  if (typeof sparql !== "string" || !sparql.trim()) {
    errors.push(
      `question "${id}": the API served no sparql text; readers have nothing to copy into the playground`,
    );
    continue;
  }
  if (!Array.isArray(rows)) {
    errors.push(`question "${id}": the API served no rows array`);
    continue;
  }
  totalServedRows += rows.length;

  // The same POST the playground makes: raw query body, sparql-query type.
  let res: Response;
  let bodyText: string;
  try {
    res = await fetch(`${BASE_URL}/api/lod/sparql`, {
      method: "POST",
      headers: { "content-type": "application/sparql-query" },
      body: sparql,
    });
    bodyText = await res.text();
  } catch (err) {
    errors.push(
      `question "${id}": POST /api/lod/sparql failed at the HTTP layer: ${err instanceof Error ? err.message : String(err)}`,
    );
    continue;
  }
  if (res.status !== 200) {
    errors.push(
      `question "${id}": POST /api/lod/sparql returned ${res.status} (${bodyText.slice(0, 200)}); the playground would reject the page's own query`,
    );
    continue;
  }
  let parsed: SparqlResultsJson;
  try {
    parsed = JSON.parse(bodyText) as SparqlResultsJson;
  } catch {
    errors.push(
      `question "${id}": /api/lod/sparql returned non-JSON (${bodyText.slice(0, 120)}...); expected SPARQL results JSON for a SELECT query`,
    );
    continue;
  }
  const bindings = parsed.results?.bindings;
  if (!Array.isArray(bindings)) {
    errors.push(
      `question "${id}": /api/lod/sparql JSON has no results.bindings array; the playground could not render a table`,
    );
    continue;
  }
  if (bindings.length !== rows.length) {
    errors.push(
      `question "${id}": the live endpoint returned ${bindings.length} bindings but the page serves ${rows.length} rows; the copied query no longer reproduces the page's table`,
    );
    continue;
  }
  summaries.push(`${id}=${rows.length}`);
  passed.push({ id, sparql, rowCount: rows.length });
}

// --- Alternate route checks: GET ?query= and form-urlencoded POST ---
// Pick two representative questions: the longest query (stresses URL
// length / body-parser limits) and one whose IRIs contain '#' (the
// classic URL-encoding hazard: an unencoded '#' truncates a query
// string, and naive comment-stripping mangles hash-namespace IRIs).
async function checkAlternateRoute(
  route: "GET ?query=" | "form POST",
  q: { id: string; sparql: string; rowCount: number },
): Promise<void> {
  let res: Response;
  let bodyText: string;
  try {
    if (route === "GET ?query=") {
      res = await fetch(
        `${BASE_URL}/api/lod/sparql?query=${encodeURIComponent(q.sparql)}`,
      );
    } else {
      res = await fetch(`${BASE_URL}/api/lod/sparql`, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ query: q.sparql }).toString(),
      });
    }
    bodyText = await res.text();
  } catch (err) {
    errors.push(
      `question "${q.id}" via ${route}: request failed at the HTTP layer: ${err instanceof Error ? err.message : String(err)}`,
    );
    return;
  }
  if (res.status !== 200) {
    errors.push(
      `question "${q.id}" via ${route}: returned ${res.status} (${bodyText.slice(0, 200)}); this endpoint route no longer accepts the page's query`,
    );
    return;
  }
  let parsed: SparqlResultsJson;
  try {
    parsed = JSON.parse(bodyText) as SparqlResultsJson;
  } catch {
    errors.push(
      `question "${q.id}" via ${route}: returned non-JSON (${bodyText.slice(0, 120)}...); expected SPARQL results JSON`,
    );
    return;
  }
  const bindings = parsed.results?.bindings;
  if (!Array.isArray(bindings)) {
    errors.push(
      `question "${q.id}" via ${route}: JSON has no results.bindings array`,
    );
    return;
  }
  if (bindings.length !== q.rowCount) {
    errors.push(
      `question "${q.id}" via ${route}: returned ${bindings.length} bindings but the page serves ${q.rowCount} rows; this route mangles the query (encoding/body-parsing drift)`,
    );
    return;
  }
  summaries.push(`${q.id} [${route}]=${bindings.length}`);
}

if (passed.length > 0) {
  const longest = passed.reduce((a, b) =>
    b.sparql.length > a.sparql.length ? b : a,
  );
  const hashIri = passed.find(
    (q) => /<[^>]*#[^>]*>/.test(q.sparql) && q.id !== longest.id,
  ) ?? passed.find((q) => /<[^>]*#[^>]*>/.test(q.sparql));
  if (!hashIri) {
    errors.push(
      "no question's SPARQL contains a '#' inside an IRI; the hash-IRI encoding check ran vacuously — pick a representative manually if the queries changed shape",
    );
  }
  const representatives = new Map<string, { id: string; sparql: string; rowCount: number }>();
  representatives.set(longest.id, longest);
  if (hashIri) representatives.set(hashIri.id, hashIri);
  for (const rep of representatives.values()) {
    await checkAlternateRoute("GET ?query=", rep);
    await checkAlternateRoute("form POST", rep);
  }
} else {
  errors.push(
    "no question passed the sparql-query POST check, so the GET/form-urlencoded route checks could not run",
  );
}

// --- Guard-rail checks: the endpoint must keep REFUSING updates and ---
// --- oversized queries over live HTTP (read-only + length guards).  ---
const READ_ONLY_MSG = "read-only";

async function expectRejection(
  label: string,
  expected: string,
  req: () => Promise<Response>,
): Promise<void> {
  let res: Response;
  let bodyText: string;
  try {
    res = await req();
    bodyText = await res.text();
  } catch (err) {
    errors.push(
      `guard "${label}": request failed at the HTTP layer: ${err instanceof Error ? err.message : String(err)}`,
    );
    return;
  }
  if (res.status !== 400) {
    errors.push(
      `guard "${label}": expected a 400 rejection but got ${res.status} (${bodyText.slice(0, 200)}); the endpoint's guard stopped rejecting`,
    );
    return;
  }
  let parsed: { error?: unknown };
  try {
    parsed = JSON.parse(bodyText) as { error?: unknown };
  } catch {
    errors.push(
      `guard "${label}": 400 body is not JSON (${bodyText.slice(0, 120)}...); expected an { error } payload`,
    );
    return;
  }
  const msg = typeof parsed.error === "string" ? parsed.error : "";
  if (!msg.toLowerCase().includes(expected.toLowerCase())) {
    errors.push(
      `guard "${label}": 400 error message "${msg.slice(0, 160)}" does not mention "${expected}"; a different failure is masking the guard`,
    );
    return;
  }
  summaries.push(`guard[${label}]=400`);
}

const UPDATE_QUERY =
  'INSERT DATA { <urn:e2e:guard> <urn:e2e:p> "should never land" }';

// 1. application/sparql-update content type is refused outright.
await expectRejection(
  "application/sparql-update content type",
  READ_ONLY_MSG,
  () =>
    fetch(`${BASE_URL}/api/lod/sparql`, {
      method: "POST",
      headers: { "content-type": "application/sparql-update" },
      body: UPDATE_QUERY,
    }),
);

// 2. A form POST carrying an 'update' field is refused.
await expectRejection("form POST with an 'update' field", READ_ONLY_MSG, () =>
  fetch(`${BASE_URL}/api/lod/sparql`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ update: UPDATE_QUERY }).toString(),
  }),
);

// 3. An update-form query is refused on EVERY accepted route.
await expectRejection(
  "update query via sparql-query POST",
  READ_ONLY_MSG,
  () =>
    fetch(`${BASE_URL}/api/lod/sparql`, {
      method: "POST",
      headers: { "content-type": "application/sparql-query" },
      body: UPDATE_QUERY,
    }),
);
await expectRejection("update query via GET ?query=", READ_ONLY_MSG, () =>
  fetch(`${BASE_URL}/api/lod/sparql?query=${encodeURIComponent(UPDATE_QUERY)}`),
);
await expectRejection(
  "update query via form POST 'query' field",
  READ_ONLY_MSG,
  () =>
    fetch(`${BASE_URL}/api/lod/sparql`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ query: UPDATE_QUERY }).toString(),
    }),
);

// 4. An over-limit query (> MAX_QUERY_LENGTH = 20_000 chars, still under
// the 64kb body-parser cap so the length guard itself does the rejecting)
// is refused with the length message.
const OVERSIZED_QUERY = `SELECT ?s WHERE { ?s ?p ?o } # ${"x".repeat(21_000)}`;
await expectRejection("oversized query (length guard)", "too long", () =>
  fetch(`${BASE_URL}/api/lod/sparql`, {
    method: "POST",
    headers: { "content-type": "application/sparql-query" },
    body: OVERSIZED_QUERY,
  }),
);

// 5. A body OVER the 64kb text-parser cap must be refused cleanly by the
// parser itself (413, or another 4xx) — never a 200 (both guards slipped)
// and never a connection error swallowed silently.
{
  const OVER_PARSER_CAP_BODY = `SELECT ?s WHERE { ?s ?p ?o } # ${"x".repeat(70_000)}`;
  const label = "body over 64kb parser cap";
  try {
    const res = await fetch(`${BASE_URL}/api/lod/sparql`, {
      method: "POST",
      headers: { "content-type": "application/sparql-query" },
      body: OVER_PARSER_CAP_BODY,
    });
    const bodyText = await res.text();
    if (res.status !== 413) {
      // Anything else means the parser cap regressed: a 200 slipped past
      // both guards; a 400 means the parser limit was removed/raised and
      // only the app-level length guard caught it; 5xx is a crash.
      errors.push(
        `guard "${label}": expected 413 from the 64kb text-parser cap but got ${res.status} (${bodyText.slice(0, 200)}); the parser cap stopped applying to a ${OVER_PARSER_CAP_BODY.length}-char body`,
      );
    } else {
      summaries.push(`guard[${label}]=${res.status}`);
    }
  } catch (err) {
    errors.push(
      `guard "${label}": request failed at the HTTP layer instead of a clean 4xx: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

// Positive control: an empty graph would make the count comparison vacuous.
if (totalServedRows === 0) {
  errors.push(
    `all ${ids.length} questions served zero rows; the drift comparison ran vacuously (empty or wrongly-loaded graph?)`,
  );
}

if (errors.length > 0) {
  console.error(
    `e2e-competency-sparql-drift FAILED (${errors.length} problem${errors.length === 1 ? "" : "s"}): a question's copied SPARQL does not reproduce its table over live HTTP`,
  );
  for (const e of errors) console.error(`  ✗ ${e}`);
  process.exit(1);
}

console.log(
  `✓ all ${ids.length} competency questions' SPARQL reproduce their tables over live HTTP POST to /api/lod/sparql (${totalServedRows} total rows: ${summaries.join(", ")})`,
);
