/**
 * validate-wd-lexemes-dryrun — offline dry run of the wikidata-lexemes
 * validator's throttle/block failure modes.
 *
 * The validator (validate-wikidata-lexemes.ts) has a simulated failure mode
 * (WD_LEXEMES_SIMULATE=429|403|maxlag) proving it exits non-zero when
 * Wikidata blocks or throttles it, including the single etiquette retry.
 * Nothing ran those modes automatically, so a refactor could silently break
 * the fail-loud behavior. This harness runs each always-fail simulation
 * (no network needed — simulated responses are returned before any fetch)
 * and asserts exit code 1 plus the expected messages.
 *
 * Positive controls so THIS harness cannot pass vacuously:
 *   - the assertion helper is run against a command that succeeds and must
 *     flag it as an unexpected pass;
 *   - the validator source is pinned to still contain the simulation hook
 *     (WD_LEXEMES_SIMULATE) and the retry-once etiquette comment, so the
 *     simulate modes cannot silently turn into real network calls.
 *
 * Run: pnpm --filter @workspace/scripts run validate-wd-lexemes-dryrun
 */
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SCRIPTS_DIR = path.resolve(HERE, "..");
const VALIDATOR = path.join(HERE, "validate-wikidata-lexemes.ts");
const TSX = path.join(SCRIPTS_DIR, "node_modules/.bin/tsx");

let failures = 0;
function check(cond: boolean, msg: string): void {
  if (cond) {
    console.log(`  ok: ${msg}`);
  } else {
    failures += 1;
    console.error(`FAIL: ${msg}`);
  }
}

interface RunResult {
  status: number | null;
  output: string;
}

function runValidator(simulate: string): RunResult {
  const res = spawnSync(TSX, [VALIDATOR], {
    cwd: SCRIPTS_DIR,
    env: { ...process.env, WD_LEXEMES_SIMULATE: simulate },
    encoding: "utf8",
    timeout: 120_000,
  });
  return { status: res.status, output: `${res.stdout ?? ""}${res.stderr ?? ""}` };
}

/** Asserts a run failed (exit 1) and printed every expected message. */
function expectFailure(label: string, run: RunResult, expectedMessages: string[]): boolean {
  let ok = true;
  if (run.status !== 1) {
    ok = false;
    console.error(`FAIL: [${label}] expected exit code 1, got ${run.status}`);
  }
  for (const msg of expectedMessages) {
    if (!run.output.includes(msg)) {
      ok = false;
      console.error(`FAIL: [${label}] output missing expected message: ${JSON.stringify(msg)}`);
    }
  }
  if (!ok) {
    console.error(`--- [${label}] output start ---\n${run.output}\n--- [${label}] output end ---`);
  }
  return ok;
}

// ---------------------------------------------------------------------------
// Positive control 1: the simulation hook still exists in the validator
// source. If a refactor drops WD_LEXEMES_SIMULATE, the "simulated" runs below
// would hit the real network and this dry run would no longer prove anything.
const source = readFileSync(VALIDATOR, "utf8");
check(
  source.includes('process.env["WD_LEXEMES_SIMULATE"]'),
  "validator source still reads WD_LEXEMES_SIMULATE (simulation hook present)",
);
check(
  /retry ONCE with backoff/i.test(source),
  "validator source still documents the single-retry Wikidata etiquette",
);

// ---------------------------------------------------------------------------
// Positive control 2: the failure-assertion helper flags a run that succeeds.
// Run a trivially passing command through the same expectation shape; the
// helper MUST report it as a mismatch (silence errors while doing so).
{
  const passRun: RunResult = { status: 0, output: "all fine" };
  const origError = console.error;
  console.error = () => {};
  const flagged = !expectFailure("positive-control", passRun, ["this message does not appear"]);
  console.error = origError;
  check(flagged, "positive control: assertion helper flags an exit-0 run as unexpected");
}

// ---------------------------------------------------------------------------
// Simulated failure modes (offline: the simulated Response is returned before
// any real fetch, so these run with no network access).
console.log("running WD_LEXEMES_SIMULATE=429 (persistent throttle; includes 1s retry backoff)...");
check(
  expectFailure("429", runValidator("429"), [
    "WARN: wbgetentities HTTP 429 (throttled); retrying once",
    "wbgetentities HTTP 429",
    "still throttled after one retry",
    "FAIL: validate-wikidata-lexemes: could not query Wikidata",
    "validate-wikidata-lexemes: FAILED (Wikidata unreachable/blocked — no lexeme was verified)",
  ]),
  "simulate 429: exits 1 after exactly one retry with the throttle messages",
);

console.log("running WD_LEXEMES_SIMULATE=403 (hard block; no retry)...");
const run403 = runValidator("403");
check(
  expectFailure("403", run403, [
    "wbgetentities HTTP 403",
    "Wikidata is blocking this client",
    "validate-wikidata-lexemes: FAILED (Wikidata unreachable/blocked — no lexeme was verified)",
  ]),
  "simulate 403: exits 1 with the blocked-client message",
);
check(
  !run403.output.includes("retrying once"),
  "simulate 403: hard block is NOT retried (no etiquette retry message)",
);

console.log("running WD_LEXEMES_SIMULATE=maxlag (persistent lag; includes 5s retry backoff)...");
check(
  expectFailure("maxlag", runValidator("maxlag"), [
    "WARN: wbgetentities maxlag",
    "retrying once in 5s per Wikidata etiquette",
    "wbgetentities error: maxlag",
    "validate-wikidata-lexemes: FAILED (Wikidata unreachable/blocked — no lexeme was verified)",
  ]),
  "simulate maxlag: exits 1 after exactly one retry with the maxlag messages",
);

// ---------------------------------------------------------------------------
if (failures > 0) {
  console.error(`validate-wd-lexemes-dryrun: ${failures} check(s) failed`);
  process.exit(1);
}
console.log("validate-wd-lexemes-dryrun: OK (all three failure simulations fail loudly)");

export {};
