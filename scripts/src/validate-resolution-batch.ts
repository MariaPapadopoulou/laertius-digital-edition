/**
 * validate-resolution-batch — keeps the third-judge escalation flow of the
 * eval store honest as the store evolves. The functional test
 * artifacts/api-server/scripts/test-resolution-batch.ts covers deadlock
 * selection, the effective 3-judgment target, awaiting_third states,
 * majority resolution and qrels output (18 assertions), but on its own it is
 * just a manual script. This validator:
 *
 *  1. Pass path: runs the real test script and requires exit 0 + "ALL PASS".
 *  2. Fail path (positive control): re-runs the same suite against a
 *     deliberately broken build of the store whose resolution-batch selection
 *     rule no longer excludes the original judges (the "must be a fresh
 *     judge" line is removed). The suite must exit non-zero and print FAIL,
 *     proving the assertions are not vacuous.
 *
 * The mutation is applied to temp copies placed next to the originals (so
 * relative imports keep resolving); a drift guard fails loudly if the
 * selection-rule line this control mutates ever disappears from store.ts.
 *
 * Run: pnpm --filter @workspace/scripts run validate-resolution-batch
 */
import { readFileSync, writeFileSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..", "..");
const apiServerDir = path.resolve(repoRoot, "artifacts", "api-server");
const testScript = path.join(apiServerDir, "scripts", "test-resolution-batch.ts");
const storePath = path.join(apiServerDir, "src", "lib", "eval", "store.ts");

// The selection rule the positive control breaks. If this line changes in
// store.ts, update it here too — the guard below fails loudly on drift.
const SELECTION_RULE = "if (who.has(input.annotator)) continue; // must be a fresh judge";

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
  ok("real resolution-batch suite passes (exit 0, ALL PASS)");
} else {
  fail(`real resolution-batch suite failed (exit ${real.status}):\n${real.out}`);
}

// --- 2. Fail path: mutated selection rule must make the suite fail -------
const tag = `mutated-${process.pid}`;
const mutStorePath = path.join(apiServerDir, "src", "lib", "eval", `store-${tag}.ts`);
const mutTestPath = path.join(apiServerDir, "scripts", `test-resolution-batch-${tag}.ts`);
try {
  const storeSrc = readFileSync(storePath, "utf-8");
  if (!storeSrc.includes(SELECTION_RULE)) {
    fail(
      "drift guard: the fresh-judge selection rule line was not found in store.ts — " +
        "update SELECTION_RULE in validate-resolution-batch.ts to match the current code",
    );
  } else {
    // Break the rule: original judges become eligible for resolution batches.
    writeFileSync(
      mutStorePath,
      storeSrc.replace(SELECTION_RULE, "/* mutated: fresh-judge rule removed */"),
    );
    const testSrc = readFileSync(testScript, "utf-8");
    const importSpec = '"../src/lib/eval/store"';
    if (!testSrc.includes(importSpec)) {
      fail("drift guard: test script no longer imports ../src/lib/eval/store — update the control");
    } else {
      writeFileSync(
        mutTestPath,
        testSrc.replace(importSpec, `"../src/lib/eval/store-${tag}.ts"`),
      );
      const mutated = runSuite(mutTestPath);
      if (mutated.status !== 0 && /FAIL/.test(mutated.out)) {
        ok("positive control: mutated selection rule makes the suite exit non-zero with FAILs");
      } else {
        fail(
          `positive control NOT caught: mutated store exited ${mutated.status} — ` +
            `the suite would miss a broken selection rule\n${mutated.out}`,
        );
      }
    }
  }
} finally {
  rmSync(mutStorePath, { force: true });
  rmSync(mutTestPath, { force: true });
}

if (failures > 0) {
  console.error(`\nvalidate-resolution-batch: ${failures} check(s) failed`);
  process.exit(1);
}
console.log("validate-resolution-batch: all checks passed");
