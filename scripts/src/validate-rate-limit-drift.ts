/**
 * validate-rate-limit-drift — keeps the two servers' duplicated rate
 * limiters from silently drifting apart.
 *
 * The Legomena API server ships its own copy of the per-IP fixed-window
 * rate limiter (artifacts/legomena-api/src/security.ts: rateLimit,
 * rateLimitMaxFromEnv) that deliberately mirrors
 * artifacts/api-server/src/lib/security.ts, because the two esbuild
 * bundles cannot cross-import. validate-security-header-drift keeps the
 * security HEADERS in sync, but nothing compared the limiter behavior —
 * a change to the 429 body wording, the Retry-After / X-RateLimit header
 * semantics, or the env parsing rules in one copy would drift silently.
 *
 * This validator drives BOTH rateLimit implementations through the same
 * simulated request sequence (same fake clock, same client IPs) and
 * asserts the per-request transcripts are identical: status codes, JSON
 * bodies, every header set, and whether next() was called. The sequence
 * covers: counting down to the limit, the first and repeated 429s,
 * Retry-After rounding mid-window, per-IP bucket isolation, window
 * expiry/reset, and the max<=0 disabled passthrough. It also runs
 * rateLimitMaxFromEnv on both copies across the tricky inputs (unset,
 * empty, whitespace, zero, fractional, negative, non-numeric, Infinity,
 * exponent notation) and asserts identical results — including identical
 * throw-vs-return behavior and error wording.
 *
 * Positive controls: seeded drifted implementations (different 429 body,
 * missing Retry-After, different fractional parsing) are run through the
 * same comparator and must be flagged, so the check cannot pass vacuously.
 *
 * On failure it names the drifted behavior (step, field, both values).
 *
 * Run: pnpm --filter @workspace/scripts run validate-rate-limit-drift
 */
import path from "node:path";

process.env["LAERTIUS_DATA_DIR"] ??= path.resolve(
  import.meta.dirname,
  "../../artifacts/api-server/data",
);

const mainSecurity = await import(
  "../../artifacts/api-server/src/lib/security"
);
const legomenaSecurity = await import(
  "../../artifacts/legomena-api/src/security"
);

let failures = 0;
function fail(message: string): void {
  failures += 1;
  console.error(`FAIL: ${message}`);
}

// ---------------------------------------------------------------------------
// Fake clock: both implementations call Date.now(), so we patch it and drive
// the same timeline through each.
// ---------------------------------------------------------------------------
const realDateNow = Date.now;
let fakeNow = 1_000_000_000_000;
Date.now = () => fakeNow;

// ---------------------------------------------------------------------------
// Simulated Express plumbing.
// ---------------------------------------------------------------------------
type Middleware = (req: unknown, res: unknown, next: () => void) => void;

interface StepResult {
  /** What the middleware did for one request. */
  label: string;
  nextCalled: boolean;
  status: number | null;
  jsonBody: string | null;
  headers: Record<string, string>;
}

function makeReq(ip: string): unknown {
  return { ip, socket: { remoteAddress: ip } };
}

function runOnce(handler: Middleware, ip: string, label: string): StepResult {
  const result: StepResult = {
    label,
    nextCalled: false,
    status: null,
    jsonBody: null,
    headers: {},
  };
  const res = {
    setHeader(name: string, value: unknown) {
      result.headers[name.toLowerCase()] = String(value);
    },
    status(code: number) {
      result.status = code;
      return res;
    },
    json(body: unknown) {
      result.jsonBody = JSON.stringify(body);
      return res;
    },
  };
  handler(makeReq(ip), res, () => {
    result.nextCalled = true;
  });
  return result;
}

/**
 * One shared scenario driven through a freshly built limiter. Steps advance
 * the fake clock identically for both implementations.
 */
interface ScenarioStep {
  label: string;
  ip: string;
  /** Milliseconds to advance the fake clock BEFORE this request. */
  advanceMs: number;
}

const WINDOW_MS = 60_000;
const MAX = 3;

const SCENARIO: ScenarioStep[] = [
  { label: "A#1 first request", ip: "10.0.0.1", advanceMs: 0 },
  { label: "A#2", ip: "10.0.0.1", advanceMs: 1_000 },
  { label: "A#3 hits the limit", ip: "10.0.0.1", advanceMs: 1_000 },
  { label: "A#4 first 429", ip: "10.0.0.1", advanceMs: 1_000 },
  { label: "A#5 repeated 429 (Retry-After shrinks)", ip: "10.0.0.1", advanceMs: 10_500 },
  { label: "B#1 separate bucket while A is blocked", ip: "10.0.0.2", advanceMs: 0 },
  { label: "A#6 after window expiry (counter resets)", ip: "10.0.0.1", advanceMs: WINDOW_MS },
  { label: "A#7 second request of the new window", ip: "10.0.0.1", advanceMs: 500 },
];

function runScenario(
  rateLimitFactory: (o: { windowMs: number; max: number; name: string }) => Middleware,
): StepResult[] {
  fakeNow = 1_000_000_000_000; // identical timeline for both servers
  const limiter = rateLimitFactory({ windowMs: WINDOW_MS, max: MAX, name: "drift-check" });
  const transcript: StepResult[] = [];
  for (const step of SCENARIO) {
    fakeNow += step.advanceMs;
    transcript.push(runOnce(limiter, step.ip, step.label));
  }
  // Disabled-limiter passthrough: max = 0 must be a pure next() with no
  // headers on both servers.
  const disabled = rateLimitFactory({ windowMs: WINDOW_MS, max: 0, name: "disabled" });
  transcript.push(runOnce(disabled, "10.0.0.3", "disabled limiter (max=0) passthrough"));
  return transcript;
}

interface Drift {
  where: string;
  message: string;
}

function compareTranscripts(a: StepResult[], b: StepResult[]): Drift[] {
  const drifts: Drift[] = [];
  if (a.length !== b.length) {
    drifts.push({
      where: "transcript",
      message: `transcript lengths differ: api-server=${a.length} legomena-api=${b.length}`,
    });
    return drifts;
  }
  for (let i = 0; i < a.length; i++) {
    const x = a[i]!;
    const y = b[i]!;
    const where = `step ${i + 1} (${x.label})`;
    if (x.nextCalled !== y.nextCalled) {
      drifts.push({
        where,
        message: `${where}: next() drifted: api-server=${x.nextCalled} legomena-api=${y.nextCalled}`,
      });
    }
    if (x.status !== y.status) {
      drifts.push({
        where,
        message: `${where}: status code drifted: api-server=${x.status} legomena-api=${y.status}`,
      });
    }
    if (x.jsonBody !== y.jsonBody) {
      drifts.push({
        where,
        message: `${where}: 429 JSON body drifted: api-server=${x.jsonBody} legomena-api=${y.jsonBody}`,
      });
    }
    const headerNames = new Set([
      ...Object.keys(x.headers),
      ...Object.keys(y.headers),
    ]);
    for (const h of [...headerNames].sort()) {
      if (x.headers[h] !== y.headers[h]) {
        drifts.push({
          where,
          message: `${where}: header "${h}" drifted: api-server=${JSON.stringify(x.headers[h])} legomena-api=${JSON.stringify(y.headers[h])}`,
        });
      }
    }
  }
  return drifts;
}

// ---------------------------------------------------------------------------
// 1. Rate-limiter behavior comparison.
// ---------------------------------------------------------------------------
const mainTranscript = runScenario(mainSecurity.rateLimit as never);
const legoTranscript = runScenario(legomenaSecurity.rateLimit as never);

// Anti-vacuity: the scenario must actually exercise both the counting and
// the 429 path, or the whole comparison could pass on a no-op limiter.
for (const [server, transcript] of [
  ["api-server", mainTranscript],
  ["legomena-api", legoTranscript],
] as const) {
  const s429 = transcript.filter((s) => s.status === 429).length;
  const passed = transcript.filter((s) => s.nextCalled).length;
  if (s429 < 2) {
    fail(
      `anti-vacuity: ${server} transcript contains only ${s429} 429 responses (expected >=2) — the scenario no longer exercises the limit path`,
    );
  }
  if (passed < 5) {
    fail(
      `anti-vacuity: ${server} transcript contains only ${passed} passed-through requests (expected >=5)`,
    );
  }
  const withRetryAfter = transcript.filter((s) => s.headers["retry-after"]);
  if (withRetryAfter.length < 2) {
    fail(
      `anti-vacuity: ${server} transcript never set Retry-After twice — the 429 header path is not exercised`,
    );
  }
  const lastStep = transcript[transcript.length - 1]!;
  if (!lastStep.nextCalled || Object.keys(lastStep.headers).length !== 0) {
    fail(
      `${server}: the disabled (max=0) limiter must pass through with NO rate-limit headers; got nextCalled=${lastStep.nextCalled} headers=${JSON.stringify(lastStep.headers)}`,
    );
  }
}

for (const d of compareTranscripts(mainTranscript, legoTranscript)) {
  fail(`rate-limiter drifted: ${d.message}`);
}

// ---------------------------------------------------------------------------
// 2. rateLimitMaxFromEnv parsing comparison.
// ---------------------------------------------------------------------------
const ENV_VAR = "RATE_LIMIT_DRIFT_CHECK_VAR";
const ENV_CASES: Array<{ label: string; value: string | undefined }> = [
  { label: "unset", value: undefined },
  { label: "empty string", value: "" },
  { label: "whitespace only", value: "   " },
  { label: "plain integer", value: "10" },
  { label: "zero (disables)", value: "0" },
  { label: "fractional (floors)", value: "2.9" },
  { label: "negative", value: "-1" },
  { label: "non-numeric", value: "abc" },
  { label: "Infinity", value: "Infinity" },
  { label: "exponent notation", value: "1e2" },
  { label: "padded integer", value: " 5 " },
  { label: "hex", value: "0x10" },
];

type ParseOutcome =
  | { kind: "value"; value: number }
  | { kind: "throw"; message: string };

function parseWith(
  fn: (envVar: string, defaultMax: number) => number,
  value: string | undefined,
): ParseOutcome {
  if (value === undefined) delete process.env[ENV_VAR];
  else process.env[ENV_VAR] = value;
  try {
    return { kind: "value", value: fn(ENV_VAR, 42) };
  } catch (err) {
    return { kind: "throw", message: err instanceof Error ? err.message : String(err) };
  } finally {
    delete process.env[ENV_VAR];
  }
}

function compareEnvParsing(
  mainFn: (envVar: string, defaultMax: number) => number,
  legoFn: (envVar: string, defaultMax: number) => number,
): Drift[] {
  const drifts: Drift[] = [];
  for (const c of ENV_CASES) {
    const a = parseWith(mainFn, c.value);
    const b = parseWith(legoFn, c.value);
    if (JSON.stringify(a) !== JSON.stringify(b)) {
      drifts.push({
        where: c.label,
        message: `rateLimitMaxFromEnv(${JSON.stringify(c.value)}) [${c.label}] drifted: api-server=${JSON.stringify(a)} legomena-api=${JSON.stringify(b)}`,
      });
    }
  }
  return drifts;
}

for (const d of compareEnvParsing(
  mainSecurity.rateLimitMaxFromEnv,
  legomenaSecurity.rateLimitMaxFromEnv,
)) {
  fail(`env parsing drifted: ${d.message}`);
}

// Anti-vacuity: the case list must exercise both a returned value and a
// throwing input on the reference implementation.
{
  const outcomes = ENV_CASES.map((c) =>
    parseWith(mainSecurity.rateLimitMaxFromEnv, c.value),
  );
  if (!outcomes.some((o) => o.kind === "throw")) {
    fail(
      "anti-vacuity: no env-parsing case throws on the api-server implementation — the invalid-input path is not exercised",
    );
  }
  if (!outcomes.some((o) => o.kind === "value" && o.value === 42)) {
    fail(
      "anti-vacuity: no env-parsing case falls back to the default — the empty/unset path is not exercised",
    );
  }
}

// ---------------------------------------------------------------------------
// 3. Positive controls: seeded drifted copies must be flagged.
// ---------------------------------------------------------------------------
{
  // (a) A drifted 429 body + missing Retry-After.
  const driftedRateLimit = (options: {
    windowMs: number;
    max: number;
    name: string;
  }): Middleware => {
    const { windowMs, max } = options;
    if (max <= 0) return (_req, _res, next) => next();
    const windows = new Map<string, { count: number; resetAt: number }>();
    return (req, res, next) => {
      const now = Date.now();
      const r = req as { ip?: string };
      const key = r.ip ?? "unknown";
      let entry = windows.get(key);
      if (!entry || entry.resetAt <= now) {
        entry = { count: 0, resetAt: now + windowMs };
        windows.set(key, entry);
      }
      entry.count += 1;
      const typedRes = res as {
        setHeader: (n: string, v: string) => void;
        status: (c: number) => { json: (b: unknown) => void };
      };
      typedRes.setHeader("X-RateLimit-Limit", String(max));
      typedRes.setHeader(
        "X-RateLimit-Remaining",
        String(Math.max(0, max - entry.count)),
      );
      if (entry.count > max) {
        // DRIFT: no Retry-After header, different body wording.
        typedRes.status(429).json({ error: "Rate limited." });
        return;
      }
      next();
    };
  };
  const seededTranscript = runScenario(driftedRateLimit as never);
  const caught = compareTranscripts(mainTranscript, seededTranscript);
  if (!caught.some((d) => d.message.includes(`"retry-after"`))) {
    fail(
      "positive control failed: a seeded missing Retry-After header was NOT detected — the transcript comparator is broken",
    );
  }
  if (!caught.some((d) => d.message.includes("JSON body drifted"))) {
    fail(
      "positive control failed: a seeded 429 body-wording drift was NOT detected — the transcript comparator is broken",
    );
  }

  // (b) A drifted env parser: rounds instead of flooring, silently accepts
  // negatives.
  const driftedParse = (envVar: string, defaultMax: number): number => {
    const raw = process.env[envVar];
    if (raw === undefined || raw.trim() === "") return defaultMax;
    const n = Number(raw);
    if (!Number.isFinite(n)) return defaultMax; // DRIFT: no throw
    return Math.round(n); // DRIFT: round, not floor; negatives pass
  };
  const caughtEnv = compareEnvParsing(
    mainSecurity.rateLimitMaxFromEnv,
    driftedParse,
  );
  const flagged = new Set(caughtEnv.map((d) => d.where));
  for (const expected of ["fractional (floors)", "negative", "non-numeric"]) {
    if (!flagged.has(expected)) {
      fail(
        `positive control failed: seeded env-parsing drift on the "${expected}" case was NOT detected — the parsing comparator is broken`,
      );
    }
  }
}

Date.now = realDateNow;

if (failures > 0) {
  console.error(`validate-rate-limit-drift FAILED with ${failures} problem(s).`);
  process.exit(1);
}
console.log(
  "validate-rate-limit-drift OK: both servers' rate limiters produced identical transcripts (headers, statuses, 429 bodies, Retry-After, per-IP buckets, window reset, max=0 passthrough) and identical rateLimitMaxFromEnv parsing across all edge inputs.",
);
