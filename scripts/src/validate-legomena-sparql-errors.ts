/**
 * validate-legomena-sparql-errors — keeps broken SPARQL queries on the
 * Legomena console answering as helpful 400s, never a generic 500.
 *
 * A user typing a bad query into the console must see what is wrong with
 * the query (the banner surfaces the { error } JSON verbatim), while
 * genuine server faults must still answer 500 "Internal error".
 *
 * The real Legomena API app is booted in-process on an ephemeral port
 * (store loaded from the committed Turtle dataset) and POST /sparql is
 * exercised end to end:
 *
 *   400 with a human-readable, non-generic message for
 *     - a SPARQL syntax error (engine parse error surfaced verbatim)
 *     - an evaluation-time engine rejection (unsupported SERVICE)
 *     - an update form (read-only endpoint)
 *     - an unrecognisable query form
 *     - an over-length query (> MAX_QUERY_LENGTH; message names the limit,
 *       not a raw Zod issue dump)
 *     - a missing / non-string query body
 *   200 for a valid SELECT (the endpoint still works)
 *   500 "Internal error" for a genuine server fault — positive control:
 *     the store's query() is patched to return garbage for a marker query,
 *     which breaks the route OUTSIDE the engine-error mapping, proving
 *     server faults are not being blanket-converted into 400s.
 *
 * Run: pnpm --filter @workspace/scripts run validate-legomena-sparql-errors
 */

const { createApp } = await import("../../artifacts/legomena-api/src/app");
const { initStore, getStore } = await import(
  "../../artifacts/legomena-api/src/store"
);
const { MAX_QUERY_LENGTH } = await import(
  "../../artifacts/legomena-api/src/sparql-exec"
);

const failures: string[] = [];

function check(name: string, ok: boolean, detail: string): void {
  if (!ok) failures.push(`${name}: ${detail}`);
  console.log(`${ok ? "ok  " : "FAIL"} ${name}${ok ? "" : ` — ${detail}`}`);
}

const ZOD_DUMP = /"code"\s*:/; // raw Zod issue-array JSON leaking into the message

async function main(): Promise<void> {
  delete process.env["SERVE_STATIC_DIR"];
  initStore();

  // Positive-control fault injection: a marker query makes store.query()
  // return a non-iterable, so the SELECT path blows up outside the
  // engine-error try/catch — a genuine server fault.
  const FAULT_MARKER = "#__validator_fault__";
  const store = getStore() as unknown as {
    query: (q: string, ...rest: unknown[]) => unknown;
  };
  const origQuery = store.query.bind(store);
  try {
    store.query = (q: string, ...rest: unknown[]) =>
      q.includes(FAULT_MARKER) ? 42 : origQuery(q, ...rest);
  } catch {
    failures.push("setup: could not patch store.query for fault injection");
  }

  const app = createApp();
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const addr = server.address();
  if (addr === null || typeof addr === "string") {
    throw new Error("Server did not report a bound port");
  }
  const base = `http://127.0.0.1:${addr.port}/legomena/api/sparql`;

  async function post(
    query: unknown,
  ): Promise<{ status: number; error: string; body: unknown }> {
    const body =
      query === undefined ? {} : ({ query } as Record<string, unknown>);
    const r = await fetch(base, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = (await r.json()) as { error?: unknown };
    return {
      status: r.status,
      error: typeof json.error === "string" ? json.error : "",
      body: json,
    };
  }

  function expect400(
    name: string,
    got: { status: number; error: string },
    messageTest: (msg: string) => boolean,
    want: string,
  ): void {
    check(
      name,
      got.status === 400 &&
        got.error.length > 0 &&
        got.error !== "Internal error" &&
        !ZOD_DUMP.test(got.error) &&
        messageTest(got.error),
      `expected 400 with ${want}; got ${got.status} ${JSON.stringify(got.error).slice(0, 200)}`,
    );
  }

  // 1. Syntax error → the engine's parse message, verbatim.
  expect400(
    "syntax error is a described 400",
    await post("SELECT ?s WHERE { broken"),
    (m) => /error at \d+:\d+/i.test(m),
    "the parser's position-bearing message",
  );

  // 2. Evaluation-time engine rejection (SERVICE is unsupported).
  expect400(
    "engine evaluation rejection is a described 400",
    await post("ASK { SERVICE <http://127.0.0.1:1/sparql> { ?s ?p ?o } }"),
    (m) => /service/i.test(m),
    "a message naming the unsupported SERVICE",
  );

  // 3. Update form → read-only refusal.
  expect400(
    "update form is a described 400",
    await post("INSERT DATA { <urn:a> <urn:b> <urn:c> }"),
    (m) => /read-only/i.test(m),
    "the read-only refusal",
  );

  // 4. Unrecognisable form.
  expect400(
    "unknown form is a described 400",
    await post("   "),
    (m) => /select, ask, construct or describe/i.test(m),
    "the form-sniffing hint",
  );

  // 5. Over-length query → friendly limit message, not a Zod dump.
  expect400(
    "over-length query names the limit",
    await post(`SELECT * WHERE { ?s ?p ?o } ${"#".repeat(MAX_QUERY_LENGTH)}`),
    (m) => /too long/i.test(m) && m.includes("20,000"),
    'a "too long" message naming the 20,000-character limit',
  );

  // 6. Missing query → friendly body-shape message.
  expect400(
    "missing query is a described 400",
    await post(undefined),
    (m) => /"query"/.test(m),
    'a message naming the required "query" field',
  );
  expect400(
    "non-string query is a described 400",
    await post(42),
    (m) => /"query"/.test(m),
    'a message naming the required "query" field',
  );

  // 7. A valid query still succeeds.
  {
    const got = await post("SELECT * WHERE { ?s ?p ?o } LIMIT 1");
    check(
      "valid SELECT still returns 200",
      got.status === 200 &&
        (got.body as { rowCount?: number }).rowCount === 1,
      `expected 200 with rowCount 1; got ${got.status} ${JSON.stringify(got.body).slice(0, 120)}`,
    );
  }

  // 8. Genuine server fault → 500 Internal error (fault-injection control).
  {
    const got = await post(
      `SELECT * WHERE { ?s ?p ?o } LIMIT 1 ${FAULT_MARKER}`,
    );
    check(
      "genuine server fault still answers 500",
      got.status === 500 && got.error === "Internal error",
      `expected 500 "Internal error"; got ${got.status} ${JSON.stringify(got.error).slice(0, 120)}`,
    );
  }

  server.close();
}

main().then(
  () => {
    if (failures.length > 0) {
      console.error(`\n${failures.length} failure(s):`);
      for (const f of failures) console.error(`  - ${f}`);
      process.exit(1);
    }
    console.log("\nvalidate-legomena-sparql-errors: all checks passed");
    process.exit(0);
  },
  (err) => {
    console.error("validate-legomena-sparql-errors crashed:", err);
    process.exit(1);
  },
);

export {};
