// Guards the standalone smoke test's stale-bundle gate: the invoked-directly
// block of smoke-ionos-bundle.ts must run checkBundleFreshness() (from the
// shared ionos-bundle-contract) BEFORE launching smokeIonosBundle, and must
// fail the process when the freshness check reports an error. A refactor of
// the CLI entry (moving argument parsing or the invokedDirectly check) that
// drops the gate would silently restore the old false-green behavior of
// certifying a stale exports/laertius-ionos.zip; this validator pins the
// wiring at the source level.
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const smokePath = path.join(here, "smoke-ionos-bundle.ts");
const source = readFileSync(smokePath, "utf8");

let failures = 0;
function check(label: string, ok: boolean) {
  if (ok) {
    console.log(`  ok: ${label}`);
  } else {
    failures++;
    console.error(`  FAIL: ${label}`);
  }
}

console.log("Import wiring:");
check(
  "smoke-ionos-bundle.ts imports checkBundleFreshness from ./ionos-bundle-contract",
  /import\s*\{[^}]*\bcheckBundleFreshness\b[^}]*\}\s*from\s*"\.\/ionos-bundle-contract"/s.test(
    source,
  ),
);

// Isolate the standalone entry: everything from the invokedDirectly guard to
// the end of the file. The guard is the last top-level statement, so a
// suffix slice is a faithful extraction of the CLI entry path.
console.log("Standalone entry gate:");
const guardMatch = /^if\s*\(\s*invokedDirectly\s*\)\s*\{/m.exec(source);
check(
  "the file still has an `if (invokedDirectly)` standalone entry block",
  guardMatch !== null,
);

if (guardMatch) {
  const entry = source.slice(guardMatch.index);

  const gateIdx = entry.search(/\bcheckBundleFreshness\s*\(/);
  const smokeIdx = entry.search(/\bsmokeIonosBundle\s*\(/);

  check(
    "the standalone entry calls checkBundleFreshness()",
    gateIdx !== -1,
  );
  check(
    "the standalone entry calls smokeIonosBundle()",
    smokeIdx !== -1,
  );
  check(
    "checkBundleFreshness() runs BEFORE smokeIonosBundle()",
    gateIdx !== -1 && smokeIdx !== -1 && gateIdx < smokeIdx,
  );

  // The gate is only a gate if a freshness error actually stops the run:
  // between the freshness call and the smoke launch there must be an error
  // branch that exits non-zero.
  const between =
    gateIdx !== -1 && smokeIdx !== -1 && gateIdx < smokeIdx
      ? entry.slice(gateIdx, smokeIdx)
      : "";
  check(
    "a freshness error is checked before the smoke test launches",
    /\.\s*error\b/.test(between),
  );
  check(
    "a freshness error exits the process non-zero before the smoke test",
    /process\.exit\s*\(\s*1\s*\)/.test(between),
  );

  // Both calls must target the SAME zip path, or the gate could certify a
  // different zip than the one being smoke-tested.
  const gateArg = /checkBundleFreshness\s*\(\s*repoRoot\s*,\s*(\w+)\s*\)/.exec(
    entry,
  );
  const smokeArg = /smokeIonosBundle\s*\(\s*(\w+)\s*\)/.exec(entry);
  check(
    "the gate and the smoke test run against the same zip path variable",
    gateArg !== null && smokeArg !== null && gateArg[1] === smokeArg[1],
  );
}

// Positive control: the regexes above must actually be able to fail. Run the
// same ordering extraction against a synthetic gate-less entry and require
// that it is detected as broken — guarding this validator against a rewrite
// that vacuously passes everything.
console.log("Positive control:");
{
  const broken = `if (invokedDirectly) {\n  smokeIonosBundle(defaultZipPath).catch(() => process.exit(1));\n}\n`;
  const g = broken.search(/\bcheckBundleFreshness\s*\(/);
  const s = broken.search(/\bsmokeIonosBundle\s*\(/);
  check(
    "a gate-less entry block would be flagged",
    !(g !== -1 && s !== -1 && g < s),
  );
}

if (failures > 0) {
  console.error(`\nvalidate-smoke-freshness-gate: ${failures} check(s) failed`);
  process.exit(1);
}
console.log("\nvalidate-smoke-freshness-gate: all checks passed");
