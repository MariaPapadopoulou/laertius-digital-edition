/**
 * e2e-rate-limit-throttle — proves the strict rate limiters really
 * throttle at runtime, not just on paper.
 *
 * validate-endpoint-rate-limits pins WHICH routes must sit under a strict
 * limiter mount by reading source text, but a middleware ordering
 * regression (the strict mount registered AFTER the router, or a limiter
 * that never fires) would pass that static pin while the endpoint never
 * returns 429. This check exercises every strict bucket end to end:
 *
 * 1. Boots each API for real (`pnpm run dev` — the same build+start the
 *    workflows use) on an ephemeral port, with the rate-limit env vars
 *    explicitly UNSET so the shipped defaults are what gets tested.
 * 2. For EACH strict bucket on each app — SPARQL (GET /api/lod/sparql on
 *    the main API, POST /legomena/api/sparql on Legomena), Ask
 *    (POST /api/ask, POST /legomena/api/ask) and Search
 *    (POST /api/search) — fires 31 requests within one 60s window:
 *    - requests 1..30 must return the bucket's expected pre-throttle
 *      status. For SPARQL that is HTTP 200 (a real query). For the
 *      Ask/Search buckets the probe deliberately sends an INVALID body:
 *      the limiter middleware runs BEFORE the route handler, so a cheap,
 *      fast 400 still consumes a slot in the bucket without paying 30
 *      real embedding+retrieval runs. A response other than the expected
 *      status means the probe is wrong and the run proves nothing.
 *      Every response must also carry X-RateLimit-Limit: 30, pinning both
 *      the default and that the STRICT bucket (not the generous 1200/600
 *      general one) is the last limiter to touch the response;
 *    - request 31 must return 429 with a positive integer Retry-After
 *      header and a JSON error body — even though requests 1..30 were
 *      handler-level 400s: the limiter counts them regardless.
 * 3. Asserts a cheap route on the same app (GET /api/healthz, GET
 *    /legomena/api/sparql/examples) is still served AFTER the strict
 *    buckets are exhausted — the generous bucket must not have been
 *    starved by the strict ones.
 *
 * Run from the workspace root:
 *   pnpm --filter @workspace/scripts run e2e-rate-limit-throttle
 *
 * Dry run (proves the fail path): E2E_THROTTLE_DRY_RUN=skip-429 makes the
 * check pretend the 31st response was a 200; the run must then FAIL.
 */
import { spawn, type ChildProcess } from "node:child_process";
import { createServer } from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);

const STRICT_LIMIT = 30; // shipped default for RATE_LIMIT_RAG_MAX
const BOOT_TIMEOUT_MS = 240_000;
const DRY_RUN = process.env.E2E_THROTTLE_DRY_RUN === "skip-429";

let failures = 0;
function check(label: string, ok: boolean, detail?: string): void {
  if (ok) {
    console.log(`  ok: ${label}`);
  } else {
    failures += 1;
    console.error(`  FAIL: ${label}${detail ? ` (${detail})` : ""}`);
  }
}

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = createServer();
    srv.listen(0, "127.0.0.1", () => {
      const addr = srv.address();
      if (addr === null || typeof addr === "string") {
        reject(new Error("could not allocate a port"));
        return;
      }
      const port = addr.port;
      srv.close(() => resolve(port));
    });
    srv.on("error", reject);
  });
}

/** Cheap invalid-body POST: the limiter runs before the handler, so the
 *  fast 400 from body validation still consumes a bucket slot. */
function invalidBodyPost(url: string): Promise<Response> {
  return fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    // `query` is required by every Ask/Search body schema; omit it.
    body: JSON.stringify({ nonsense: true }),
  });
}

interface StrictBucket {
  label: string;
  /** Status requests 1..30 must return (200 for real probes, 400 for the
   *  deliberately-invalid-body probes on the heavy RAG endpoints). */
  expectStatus: number;
  request: (base: string) => Promise<Response>;
}

interface AppSpec {
  name: string;
  pkg: string;
  healthPath: string; // polled until 200
  buckets: StrictBucket[];
  cheapPath: string;
  cheapLabel: string;
}

const APPS: AppSpec[] = [
  {
    name: "api-server",
    pkg: "@workspace/api-server",
    healthPath: "/api/healthz",
    buckets: [
      {
        label: "GET /api/lod/sparql",
        expectStatus: 200,
        request: (base) =>
          fetch(
            `${base}/api/lod/sparql?query=${encodeURIComponent(
              "SELECT * WHERE { ?s ?p ?o } LIMIT 1",
            )}`,
            { headers: { Accept: "application/sparql-results+json" } },
          ),
      },
      {
        label: "POST /api/ask (invalid body)",
        expectStatus: 400,
        request: (base) => invalidBodyPost(`${base}/api/ask`),
      },
      {
        label: "POST /api/search (invalid body)",
        expectStatus: 400,
        request: (base) => invalidBodyPost(`${base}/api/search`),
      },
    ],
    cheapPath: "/api/healthz",
    cheapLabel: "GET /api/healthz",
  },
  {
    name: "legomena",
    pkg: "@workspace/legomena-api",
    healthPath: "/legomena/api/healthz",
    buckets: [
      {
        label: "POST /legomena/api/sparql",
        expectStatus: 200,
        request: (base) =>
          fetch(`${base}/legomena/api/sparql`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              query: "SELECT * WHERE { ?s ?p ?o } LIMIT 1",
            }),
          }),
      },
      {
        label: "POST /legomena/api/ask (invalid body)",
        expectStatus: 400,
        request: (base) => invalidBodyPost(`${base}/legomena/api/ask`),
      },
    ],
    cheapPath: "/legomena/api/sparql/examples",
    cheapLabel: "GET /legomena/api/sparql/examples",
  },
];

interface BootedApp {
  spec: AppSpec;
  port: number;
  child: ChildProcess;
}

function bootApp(spec: AppSpec, port: number): BootedApp {
  // The rate-limit env vars must be UNSET so the shipped defaults are
  // what this check certifies; an operator override in the workspace env
  // must not leak in and silently change what "30/min" means.
  const env: NodeJS.ProcessEnv = { ...process.env, PORT: String(port) };
  delete env.RATE_LIMIT_API_MAX;
  delete env.RATE_LIMIT_RAG_MAX;
  delete env.SERVE_STATIC_DIR;
  const child = spawn(
    "pnpm",
    ["--filter", spec.pkg, "run", "dev"],
    { cwd: ROOT, env, stdio: ["ignore", "pipe", "pipe"], detached: true },
  );
  child.stdout?.on("data", () => {});
  child.stderr?.on("data", (d: Buffer) => {
    // Surface boot-time crashes; silence routine request logs.
    const s = d.toString();
    if (/error|Error|EADDRINUSE/.test(s)) process.stderr.write(`[${spec.name}] ${s}`);
  });
  return { spec, port, child };
}

async function waitForHealth(app: BootedApp): Promise<void> {
  const url = `http://127.0.0.1:${app.port}${app.spec.healthPath}`;
  const deadline = Date.now() + BOOT_TIMEOUT_MS;
  for (;;) {
    if (app.child.exitCode !== null) {
      throw new Error(
        `${app.spec.name} exited with code ${app.child.exitCode} before serving ${url}`,
      );
    }
    try {
      const res = await fetch(url);
      if (res.status === 200) return;
    } catch {
      // not up yet
    }
    if (Date.now() > deadline) {
      throw new Error(`${app.spec.name} did not serve ${url} within ${BOOT_TIMEOUT_MS}ms`);
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
}

function stopApp(app: BootedApp): void {
  // pnpm spawns the real node server as a child; kill the whole group.
  const pid = app.child.pid;
  if (pid !== undefined) {
    try {
      process.kill(-pid, "SIGTERM");
    } catch {
      // already gone
    }
  }
}

async function exerciseBucket(base: string, bucket: StrictBucket): Promise<void> {
  console.log(`\n${bucket.label} must throttle at ${STRICT_LIMIT}/min`);

  const started = Date.now();
  let firstFailure: string | null = null;
  let limitHeaderOk = true;
  let limitHeaderSeen: string | null = null;
  for (let i = 1; i <= STRICT_LIMIT; i++) {
    const res = await bucket.request(base);
    if (res.status !== bucket.expectStatus && firstFailure === null) {
      firstFailure = `request ${i} returned ${res.status}: ${(await res.text()).slice(0, 200)}`;
    }
    const limit = res.headers.get("x-ratelimit-limit");
    limitHeaderSeen = limit;
    if (limit !== String(STRICT_LIMIT)) limitHeaderOk = false;
  }
  check(
    `requests 1..${STRICT_LIMIT} all answered with HTTP ${bucket.expectStatus}`,
    firstFailure === null,
    firstFailure ?? undefined,
  );
  check(
    `strict bucket answers with X-RateLimit-Limit: ${STRICT_LIMIT}`,
    limitHeaderOk,
    `last seen: ${limitHeaderSeen}`,
  );

  const res31 = await bucket.request(base);
  const elapsed = Date.now() - started;
  // All 31 requests must land inside one 60s window, or the 429 assertion
  // is meaningless (the bucket would have reset).
  check(
    `all ${STRICT_LIMIT + 1} requests fit in one 60s window`,
    elapsed < 55_000,
    `${elapsed}ms elapsed`,
  );
  const status31 = DRY_RUN ? 200 : res31.status;
  check(
    `request ${STRICT_LIMIT + 1} returns 429`,
    status31 === 429,
    `got ${status31}${DRY_RUN ? " (dry run)" : ""}`,
  );
  const retryAfter = res31.headers.get("retry-after");
  const retryNum = retryAfter === null ? NaN : Number(retryAfter);
  check(
    "429 carries a positive integer Retry-After",
    !DRY_RUN && Number.isInteger(retryNum) && retryNum > 0,
    `Retry-After: ${retryAfter}`,
  );
  if (!DRY_RUN && res31.status === 429) {
    let bodyErr = "";
    try {
      const body = (await res31.json()) as { error?: unknown };
      bodyErr = typeof body.error === "string" ? body.error : "";
    } catch {
      // handled below
    }
    check("429 body is JSON with an error message", bodyErr.length > 0);
  }
}

async function exerciseApp(app: BootedApp): Promise<void> {
  const base = `http://127.0.0.1:${app.port}`;
  const spec = app.spec;
  console.log(`\n=== ${spec.name}: ${spec.buckets.length} strict bucket(s) ===`);

  for (const bucket of spec.buckets) {
    await exerciseBucket(base, bucket);
  }

  const cheap = await fetch(`${base}${spec.cheapPath}`);
  check(
    `${spec.cheapLabel} still served after the strict buckets are exhausted`,
    cheap.status === 200,
    `got ${cheap.status}`,
  );
}

async function main(): Promise<void> {
  const ports = await Promise.all(APPS.map(() => freePort()));
  const apps = APPS.map((spec, i) => bootApp(spec, ports[i]));
  try {
    console.log(
      `Booting ${apps.map((a) => `${a.spec.name} on :${a.port}`).join(", ")} …`,
    );
    await Promise.all(apps.map((a) => waitForHealth(a)));
    for (const app of apps) {
      await exerciseApp(app);
    }
  } finally {
    for (const app of apps) stopApp(app);
  }
}

main().then(
  () => {
    if (failures > 0) {
      console.error(`\ne2e-rate-limit-throttle: ${failures} check(s) failed`);
      process.exit(1);
    }
    console.log("\ne2e-rate-limit-throttle: all checks passed");
  },
  (err) => {
    console.error(`e2e-rate-limit-throttle: ${err instanceof Error ? err.message : err}`);
    process.exit(1);
  },
);
