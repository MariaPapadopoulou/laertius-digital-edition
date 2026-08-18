/**
 * validate-judge-auth — keeps the eval workbench's per-judge authorization
 * boundary honest. The functional suite
 * artifacts/api-server/scripts/test-judge-auth.ts boots the REAL express app
 * on an ephemeral port against a seeded temp data dir and proves over HTTP
 * that:
 *
 *   - judge batch listing / batch fetch / judgment submission reject
 *     missing (401) and other judges' (403) access keys, so nobody can see
 *     another expert's blind batches or submit under their judge code;
 *   - coordinator (management) endpoints reject judge credentials outright
 *     and require the coordinator's own password, so judges cannot
 *     enumerate pools or harvest anyone's bearer token.
 *
 * This validator:
 *  1. Pass path: runs the real suite and requires exit 0 + "ALL PASS".
 *  2. Fail path (positive control): re-runs a mutated copy of the suite in
 *     which every cross-judge 403 expectation is flipped to expect 200. A
 *     server that ever ANSWERED 200 there would be the impersonation bug,
 *     so the mutated suite must exit non-zero with FAILs — proving the
 *     assertions execute against live responses and are not vacuous.
 *
 * A drift guard fails loudly if the 403 expectations this control mutates
 * ever disappear from the suite.
 *
 * Run: pnpm --filter @workspace/scripts run validate-judge-auth
 */
import { readFileSync, writeFileSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..", "..");
const apiServerDir = path.resolve(repoRoot, "artifacts", "api-server");
const testScript = path.join(apiServerDir, "scripts", "test-judge-auth.ts");

// The cross-judge rejection expectations the positive control flips.
const CROSS_JUDGE_403 = "status === 403";

let failures = 0;
function fail(msg: string): void {
  failures++;
  console.error(`FAIL: ${msg}`);
}
function ok(msg: string): void {
  console.log(`ok: ${msg}`);
}

function runSuite(scriptPath: string): { status: number | null; out: string } {
  const res = spawnSync("pnpm", ["exec", "tsx", scriptPath], {
    cwd: path.dirname(scriptPath),
    encoding: "utf-8",
    timeout: 300_000,
  });
  return { status: res.status, out: `${res.stdout ?? ""}${res.stderr ?? ""}` };
}

// --- 1. Pass path: the real suite must pass ------------------------------
const real = runSuite(testScript);
if (real.status === 0 && real.out.includes("ALL PASS")) {
  ok("real judge-auth suite passes (exit 0, ALL PASS)");
} else {
  fail(`real judge-auth suite failed (exit ${real.status}):\n${real.out.slice(-4000)}`);
}

// --- 2. Fail path: flipped 403 expectations must make the suite fail -----
const tag = `mutated-${process.pid}`;
const mutTestPath = path.join(apiServerDir, "scripts", `test-judge-auth-${tag}.ts`);
try {
  const testSrc = readFileSync(testScript, "utf-8");
  const occurrences = testSrc.split(CROSS_JUDGE_403).length - 1;
  if (occurrences < 2) {
    fail(
      "drift guard: expected at least two cross-judge 403 expectations in " +
        "test-judge-auth.ts — update CROSS_JUDGE_403 in validate-judge-auth.ts",
    );
  } else {
    // A server vulnerable to impersonation would answer 200 where the real
    // suite demands 403; the mutated suite EXPECTS those 200s, so against
    // the correct server it must fail.
    writeFileSync(
      mutTestPath,
      testSrc.split(CROSS_JUDGE_403).join("status === 200 /* mutated */"),
    );
    const mutated = runSuite(mutTestPath);
    if (mutated.status !== 0 && /FAIL/.test(mutated.out)) {
      ok("positive control: flipped 403 expectations make the suite exit non-zero with FAILs");
    } else {
      fail(
        `positive control NOT caught: mutated suite exited ${mutated.status} — ` +
          `the assertions would miss an impersonation regression\n${mutated.out.slice(-2000)}`,
      );
    }
  }
} finally {
  rmSync(mutTestPath, { force: true });
}

if (failures > 0) {
  console.error(`\nvalidate-judge-auth: ${failures} check(s) failed`);
  process.exit(1);
}
console.log("validate-judge-auth: all checks passed");
