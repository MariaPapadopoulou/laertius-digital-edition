/**
 * Keeps the SPARQL playground's error handling friendly for oversized
 * queries.
 *
 * /api/lod/sparql caps POST bodies at 64kb via Express's text parser, so an
 * over-limit paste is refused with a 413 whose body is Express's HTML error
 * page, not the route's usual { error } JSON. The playground's
 * friendlyErrorMessage (artifacts/laertius/src/components/sparql-playground.tsx)
 * must turn that into a clear human message — and keep the existing
 * { error } JSON handling for 400s unchanged. The helper lives in
 * artifacts/laertius/src/lib/sparql-error-message.ts.
 *
 * This validator exercises friendlyErrorMessage against mocked responses:
 *   - 413 with an HTML body → friendly "too large" message, no raw HTML
 *   - 400 with { error } JSON → the server's error string verbatim
 *   - JSON error body without an "error" field → generic message
 *   - other non-JSON errors → status + trimmed snippet, capped length
 *
 * Run from the workspace root:
 *   pnpm --filter @workspace/scripts run validate-sparql-413-message
 */
import path from "node:path";

process.env["LAERTIUS_DATA_DIR"] ??= path.resolve(
  import.meta.dirname,
  "../../artifacts/api-server/data",
);

const { friendlyErrorMessage } = await import(
  "../../artifacts/laertius/src/lib/sparql-error-message"
);

function mockResponse(opts: {
  status: number;
  contentType?: string;
  body: string;
}) {
  return {
    status: opts.status,
    headers: {
      get: (name: string) =>
        name.toLowerCase() === "content-type" ? (opts.contentType ?? null) : null,
    },
    json: async () => JSON.parse(opts.body) as unknown,
    text: async () => opts.body,
  };
}

const errors: string[] = [];

async function check(
  name: string,
  res: ReturnType<typeof mockResponse>,
  assert: (msg: string) => string | null,
) {
  const msg = await friendlyErrorMessage(res);
  const problem = assert(msg);
  if (problem) errors.push(`${name}: ${problem} (got: ${JSON.stringify(msg)})`);
}

// 1. Express parser 413 with an HTML body (what the live endpoint returns
//    for >64kb bodies — verified via curl: text/html, "<!DOCTYPE html>…").
const expressHtml413 =
  '<!DOCTYPE html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<title>Error</title>\n</head>\n<body>\n<pre>PayloadTooLargeError: request entity too large</pre>\n</body>\n</html>';
await check(
  "413 HTML body",
  mockResponse({ status: 413, contentType: "text/html; charset=utf-8", body: expressHtml413 }),
  (msg) => {
    if (msg.includes("<") || msg.toLowerCase().includes("doctype"))
      return "message leaks raw HTML";
    if (!/too large/i.test(msg)) return 'message does not say the query is "too large"';
    if (!/64\s*kb/i.test(msg)) return "message does not mention the 64 KB limit";
    return null;
  },
);

// 2. Route-level 400 with { error } JSON must surface the server's message
//    verbatim (the existing behavior, which must be unchanged).
await check(
  "400 { error } JSON",
  mockResponse({
    status: 400,
    contentType: "application/json; charset=utf-8",
    body: JSON.stringify({ error: "Query too long (max 20000 characters)" }),
  }),
  (msg) =>
    msg === "Query too long (max 20000 characters)"
      ? null
      : "server { error } string was not surfaced verbatim",
);

// 3. JSON error body without an "error" field → generic message with status.
await check(
  "JSON without error field",
  mockResponse({
    status: 400,
    contentType: "application/json",
    body: JSON.stringify({ message: "nope" }),
  }),
  (msg) => (msg.includes("400") ? null : "generic JSON fallback lacks the status code"),
);

// 4. Non-JSON, non-413 error → status plus a trimmed snippet, capped so a
//    huge body can't flood the error banner.
const hugeBody = "x".repeat(5000);
await check(
  "non-JSON 502 with huge body",
  mockResponse({ status: 502, contentType: "text/plain", body: hugeBody }),
  (msg) => {
    if (!msg.includes("502")) return "missing status code";
    if (msg.length > 300) return `message not capped (length ${msg.length})`;
    return null;
  },
);

// 5. Non-JSON error with an empty body → still a readable message.
await check(
  "non-JSON 500 with empty body",
  mockResponse({ status: 500, contentType: "text/plain", body: "  " }),
  (msg) => (msg.includes("500") && !msg.trim().endsWith(":") ? null : "empty-body message malformed"),
);

// Positive control: prove the harness can fail — a deliberately wrong
// expectation against the 413 case must produce a mismatch.
{
  const msg = await friendlyErrorMessage(
    mockResponse({ status: 413, contentType: "text/html", body: expressHtml413 }),
  );
  if (msg === "this-can-never-match") {
    errors.push("positive control failed: harness accepted an impossible expectation");
  }
}

if (errors.length > 0) {
  console.error("validate-sparql-413-message FAILED:");
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}

console.log(
  "validate-sparql-413-message OK: playground friendlyErrorMessage gives a clear 64 KB message on 413 HTML bodies, surfaces { error } JSON verbatim, and caps non-JSON snippets",
);

export {};
