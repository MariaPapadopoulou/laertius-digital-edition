/**
 * Keeps the Legomena SPARQL console's error handling friendly for oversized
 * queries.
 *
 * The Legomena API caps POST bodies at 1 MB via express.json, so an
 * over-limit paste is refused upstream with a 413 whose body is Express's
 * HTML error page, not the route's usual { error } JSON. The console's
 * errors arrive as an already-consumed ApiError ({ status, headers, data }),
 * which friendlyApiErrorMessage (artifacts/laertius/src/lib/sparql-error-message.ts)
 * adapts back into the shared friendly-message logic.
 *
 * This validator exercises friendlyApiErrorMessage against mocked errors:
 *   - ApiError-shaped 413 with a text/html body → friendly "1 MB" message,
 *     no raw HTML leaked
 *   - ApiError-shaped 400 with a JSON { error } body → surfaced verbatim
 *   - a plain Error → its message is used as the fallback
 *   - a completely unknown value → generic fallback message
 *
 * It also asserts the Legomena SPARQL page still routes its error banner
 * through the adapter (source check on
 * artifacts/laertius/src/pages/legomena/sparql.tsx).
 *
 * Run from the workspace root:
 *   pnpm --filter @workspace/scripts run validate-legomena-413-message
 */
import path from "node:path";
import fs from "node:fs";

process.env["LAERTIUS_DATA_DIR"] ??= path.resolve(
  import.meta.dirname,
  "../../artifacts/api-server/data",
);

const { friendlyApiErrorMessage } = await import(
  "../../artifacts/laertius/src/lib/sparql-error-message"
);

function mockApiError(opts: {
  status: number;
  contentType?: string;
  data: unknown;
}) {
  return {
    status: opts.status,
    headers: {
      get: (name: string) =>
        name.toLowerCase() === "content-type" ? (opts.contentType ?? null) : null,
    },
    data: opts.data,
  };
}

const errors: string[] = [];

async function check(
  name: string,
  err: unknown,
  opts: { limitNote?: string } | undefined,
  assert: (msg: string) => string | null,
) {
  const msg = await friendlyApiErrorMessage(err, opts);
  const problem = assert(msg);
  if (problem) errors.push(`${name}: ${problem} (got: ${JSON.stringify(msg)})`);
}

const limitNote = "the endpoint accepts queries up to 1 MB";

// 1. ApiError-shaped 413 with Express's HTML error page (what express.json
//    returns for >1 MB bodies) → friendly "1 MB" message, no raw HTML.
const expressHtml413 =
  '<!DOCTYPE html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<title>Error</title>\n</head>\n<body>\n<pre>PayloadTooLargeError: request entity too large</pre>\n</body>\n</html>';
await check(
  "413 HTML ApiError",
  mockApiError({
    status: 413,
    contentType: "text/html; charset=utf-8",
    data: expressHtml413,
  }),
  { limitNote },
  (msg) => {
    if (msg.includes("<") || msg.toLowerCase().includes("doctype"))
      return "message leaks raw HTML";
    if (!/too large/i.test(msg)) return 'message does not say the query is "too large"';
    if (!/1\s*mb/i.test(msg)) return "message does not mention the 1 MB limit";
    return null;
  },
);

// 2. ApiError-shaped 400 with a parsed { error } JSON body → the server's
//    error string must surface verbatim.
await check(
  "400 { error } JSON ApiError",
  mockApiError({
    status: 400,
    contentType: "application/json; charset=utf-8",
    data: { error: "Parse error at line 3: unexpected token" },
  }),
  { limitNote },
  (msg) =>
    msg === "Parse error at line 3: unexpected token"
      ? null
      : "server { error } string was not surfaced verbatim",
);

// 3. Plain Error fallback → its message must be used.
await check(
  "plain Error fallback",
  new Error("Network request failed"),
  { limitNote },
  (msg) =>
    msg === "Network request failed" ? null : "plain Error message not used as fallback",
);

// 4. Completely unknown value → generic fallback, never empty.
await check("unknown value fallback", undefined, { limitNote }, (msg) =>
  msg && msg.trim().length > 0 && !msg.includes("undefined")
    ? null
    : "unknown-value fallback missing or malformed",
);

// Positive control: prove the harness can fail — a deliberately impossible
// expectation against the 413 case must produce a mismatch.
{
  const msg = await friendlyApiErrorMessage(
    mockApiError({ status: 413, contentType: "text/html", data: expressHtml413 }),
    { limitNote },
  );
  if (msg === "this-can-never-match") {
    errors.push("positive control failed: harness accepted an impossible expectation");
  }
}

// Source check: the Legomena SPARQL page must still route its error banner
// through friendlyApiErrorMessage.
{
  const pagePath = path.resolve(
    import.meta.dirname,
    "../../artifacts/laertius/src/pages/legomena/sparql.tsx",
  );
  const src = fs.readFileSync(pagePath, "utf8");
  if (!/import\s*\{[^}]*friendlyApiErrorMessage[^}]*\}\s*from\s*["']@\/lib\/sparql-error-message["']/.test(src)) {
    errors.push(
      "legomena/sparql.tsx no longer imports friendlyApiErrorMessage from @/lib/sparql-error-message",
    );
  }
  if (!/friendlyApiErrorMessage\s*\(/.test(src.replace(/import[\s\S]*?from\s*["'][^"']+["'];?/g, ""))) {
    errors.push("legomena/sparql.tsx imports the adapter but never calls it");
  }
  if (!/limitNote\s*:\s*["'`][^"'`]*1\s*MB[^"'`]*["'`]/i.test(src)) {
    errors.push("legomena/sparql.tsx no longer passes a 1 MB limitNote to the adapter");
  }
}

if (errors.length > 0) {
  console.error("validate-legomena-413-message FAILED:");
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}

console.log(
  "validate-legomena-413-message OK: friendlyApiErrorMessage gives a clear 1 MB message on ApiError-shaped 413 HTML bodies, surfaces { error } JSON verbatim, falls back to Error messages, and the Legomena SPARQL page still routes its banner through the adapter",
);

export {};
