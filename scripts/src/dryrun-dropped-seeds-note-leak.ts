/* Dry run proving the in-session switching layer of
 * e2e-dropped-seeds-note.ts is NOT vacuous.
 *
 * The switching layer asserts the "without a Life of their own" note
 * DISAPPEARS when the reader switches (SPA navigation, no reload) from the
 * exception question to two no-exception questions. That disappearance
 * assertion had never been shown to fire. This harness:
 *
 * 1. Temporarily mutates artifacts/laertius/src/pages/competency.tsx so the
 *    note renders from a leaky client-side cache (globalThis-cached
 *    droppedSeeds kept from the previous question) instead of the current
 *    query result — exactly the class of bug the switching layer exists to
 *    catch. The API sweep and the cold-load contrast page stay green under
 *    this bug (fresh pages have an empty cache), so ONLY the in-session
 *    switching checks can catch it.
 * 2. Runs e2e-dropped-seeds-note and REQUIRES it to fail, specifically on
 *    the `after switching to "<id>" the note is gone` checks.
 * 3. Reverts the mutation (always, even on crash) and re-runs the e2e,
 *    requiring a clean pass.
 *
 * Requirements: same as e2e-dropped-seeds-note (api-server + laertius web
 * workflows running, headless Chromium shell installed). The laertius app
 * runs under the Vite dev server, so the mutation is picked up on the next
 * page load without a rebuild.
 *
 * Run: pnpm --filter @workspace/scripts run dryrun-dropped-seeds-note-leak
 *
 * Cadence decision: this dry run is too heavy for every merge (both servers
 * + headless Chromium, runs the full e2e twice), so it stays manual /
 * on-demand — re-run it whenever competency.tsx's droppedSeeds handling or
 * the e2e's switching layer changes materially. Anchor/message drift
 * between manual runs is caught on every merge by the cheap static
 * validator validate-dropped-seeds-leak-anchors.ts, which pins the ANCHOR
 * line and every e2e-output string this harness greps for to their sources
 * of truth.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, "../..");
const TARGET = path.join(
  REPO_ROOT,
  "artifacts/laertius/src/pages/competency.tsx",
);

// The exact healthy line the leak replaces. If competency.tsx is refactored
// and this anchor disappears, the dry run fails loudly instead of silently
// mutating nothing (which would make THIS harness vacuous in turn).
const ANCHOR = "  const droppedSeeds = result?.droppedSeeds ?? [];";
const LEAK = [
  "  // DRYRUN LEAK (dryrun-dropped-seeds-note-leak.ts): render the note from",
  "  // a client-side cache that survives SPA question switches. Must never",
  "  // ship — the harness reverts this after proving the e2e check fires.",
  "  const droppedSeeds =",
  "    (result?.droppedSeeds?.length",
  "      ? // eslint-disable-next-line @typescript-eslint/no-explicit-any",
  "        (((globalThis as any).__dryrunLeakedDroppedSeeds = result.droppedSeeds))",
  "      : // eslint-disable-next-line @typescript-eslint/no-explicit-any",
  "        ((globalThis as any).__dryrunLeakedDroppedSeeds as typeof result.droppedSeeds)) ?? [];",
].join("\n");

let failures = 0;
function check(label: string, ok: boolean, detail?: string) {
  if (ok) console.log(`  ok: ${label}`);
  else {
    failures++;
    console.error(`  FAIL: ${label}${detail ? ` (${detail})` : ""}`);
  }
}

function runE2e(): { status: number; output: string } {
  const r = spawnSync(
    "pnpm",
    ["--filter", "@workspace/scripts", "run", "e2e-dropped-seeds-note"],
    { cwd: REPO_ROOT, encoding: "utf8", timeout: 10 * 60 * 1000 },
  );
  return { status: r.status ?? 1, output: `${r.stdout ?? ""}${r.stderr ?? ""}` };
}

async function main() {
  const original = readFileSync(TARGET, "utf8");
  check(
    "competency.tsx contains the healthy droppedSeeds anchor line",
    original.includes(ANCHOR),
    "anchor drifted — update ANCHOR in dryrun-dropped-seeds-note-leak.ts",
  );
  check(
    "competency.tsx is not already mutated",
    !original.includes("__dryrunLeakedDroppedSeeds"),
  );
  if (failures > 0) process.exit(1);

  console.log("\nPhase 1: inject leaky client-side droppedSeeds cache");
  writeFileSync(TARGET, original.replace(ANCHOR, LEAK));
  let leaky: { status: number; output: string };
  try {
    leaky = runE2e();
  } finally {
    // Always restore the pristine page, even if the e2e run throws.
    writeFileSync(TARGET, original);
    console.log("  (competency.tsx reverted to pristine content)");
  }

  check(
    "e2e run FAILS against the leaky page (non-zero exit)",
    leaky.status !== 0,
    `exit=${leaky.status}`,
  );
  const gone = /FAIL: after switching to "([^"]+)" the note is gone/g;
  const firedOn = [...leaky.output.matchAll(gone)].map((m) => m[1]);
  check(
    `the "note is gone" switching check fired (on: ${JSON.stringify(firedOn)})`,
    firedOn.length >= 1,
    "e2e failed for some other reason — inspect its output above",
  );
  // The leak is invisible to the cold-load layers: their checks must still
  // pass in the leaky run, proving the switching layer is the ONLY line of
  // defense against this bug class.
  check(
    "cold-load contrast page still passed under the leak",
    leaky.output.includes(
      'ok: no element on stoa-members contains "without a Life of their own"',
    ),
  );
  check(
    "API sweep still passed under the leak",
    /ok: sweep verified \d+ no-exception question\(s\) with empty droppedSeeds/.test(
      leaky.output,
    ),
  );
  if (firedOn.length === 0) {
    console.error("\n--- leaky-run output (tail) ---");
    console.error(leaky.output.split("\n").slice(-40).join("\n"));
  }

  console.log("\nPhase 2: pristine page must pass again after revert");
  const clean = runE2e();
  check("e2e run passes after revert (exit 0)", clean.status === 0, `exit=${clean.status}`);
  check(
    "clean run reports all checks passed",
    clean.output.includes("All dropped-seeds note visibility checks passed"),
  );

  if (failures > 0) {
    console.error(`\n${failures} dry-run check(s) FAILED`);
    process.exit(1);
  }
  console.log(
    "\nDry run passed: the in-session switching check catches a leaky client-side droppedSeeds fallback and is not vacuous",
  );
}

main().then(
  () => {},
  (err) => {
    console.error(err);
    process.exit(1);
  },
);
