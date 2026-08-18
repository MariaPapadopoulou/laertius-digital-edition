// Turns a failed /api/lod/sparql response into a readable message for the
// playground's error banner.
//
// Lives in a plain .ts module (like sparql-query-form.ts) so the
// validate-sparql-413-message validator can import it without pulling in
// React/CodeMirror; the playground component re-exports it.
//
// The endpoint's route code always answers errors with { error } JSON, but
// the 64kb body-size cap is enforced upstream by Express's text parser,
// which responds 413 with an HTML body. Surface JSON errors verbatim and
// convert non-JSON bodies (especially that 413) into a friendly message
// instead of dumping raw HTML.
export async function friendlyErrorMessage(
  res: {
    status: number;
    headers: { get(name: string): string | null };
    json(): Promise<unknown>;
    text(): Promise<string>;
  },
  opts?: { limitNote?: string },
): Promise<string> {
  const contentType = res.headers.get("content-type") ?? "";
  if (contentType.includes("json")) {
    try {
      const data = (await res.json()) as { error?: string };
      if (typeof data.error === "string" && data.error) return data.error;
    } catch {
      // fall through to the generic message below
    }
    return `Request failed (${res.status})`;
  }
  if (res.status === 413) {
    const limitNote = opts?.limitNote ?? "the endpoint accepts queries up to 64 KB";
    return `This query is too large to send - ${limitNote}. Try trimming the query down.`;
  }
  const body = (await res.text().catch(() => "")).trim();
  const snippet = body.length > 200 ? `${body.slice(0, 200)}…` : body;
  return snippet
    ? `Request failed (${res.status}): ${snippet}`
    : `Request failed (${res.status})`;
}

// Adapter for mutation-based fetches (the Legomena SPARQL console), whose
// errors arrive as an already-consumed ApiError ({ status, headers, data })
// rather than a live Response. Re-wraps the parsed body so the same
// friendly-message logic applies — notably the Legomena API's 1 MB
// express.json cap, whose 413 carries Express's HTML error page.
export async function friendlyApiErrorMessage(
  err: unknown,
  opts?: { limitNote?: string },
): Promise<string> {
  if (
    err &&
    typeof err === "object" &&
    "status" in err &&
    "headers" in err &&
    "data" in err
  ) {
    const e = err as {
      status: number;
      headers: { get(name: string): string | null };
      data: unknown;
    };
    return friendlyErrorMessage(
      {
        status: e.status,
        headers: e.headers,
        json: async () => e.data,
        text: async () => (typeof e.data === "string" ? e.data : ""),
      },
      opts,
    );
  }
  if (err instanceof Error && err.message) return err.message;
  return "Failed to execute query.";
}
