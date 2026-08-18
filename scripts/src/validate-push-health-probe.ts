/**
 * validate-push-health-probe — proves the push-ionos-bundle post-deploy
 * health probe actually works, so a "successful" restart that leaves the
 * services crash-looping is caught by the deploy script instead of by users.
 *
 * Live checks (against a local stub HTTP server — the real IONOS host is
 * unreachable from this workspace):
 *   1. All endpoints healthy → pollLiveHealth resolves true.
 *   2. An endpoint that only recovers after a couple of polls → true
 *      (the probe really retries instead of failing on the first miss).
 *   3. An endpoint that stays broken (HTTP 500) → false before the deadline
 *      lies (fail path is real, not vacuous).
 *   4. An unreachable origin (closed port) → false (network failures are
 *      failures, not silent passes).
 *
 * Static wiring checks on push-ionos-bundle.ts:
 *   5. The probe runs in the IONOS_REMOTE_CMD success branch (a restart that
 *      never happened has nothing to verify).
 *   6. The skip escape hatch (IONOS_HEALTH_CHECK=0/skip) exists — required
 *      because this workspace cannot reach the live host.
 *   7. A failed probe exits non-zero (fails loudly).
 *   8. Positive control: the wiring checks flag a mutated source, so they
 *      cannot pass vacuously.
 *
 * Run: pnpm --filter @workspace/scripts run validate-push-health-probe
 */
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { pollLiveHealth } from "./push-ionos-bundle";

const here = path.dirname(fileURLToPath(import.meta.url));

let failures = 0;
function check(name: string, cond: boolean, detail?: string): void {
  if (cond) {
    console.log(`  ✓ ${name}`);
  } else {
    failures += 1;
    console.error(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

function startStub(
  handler: (url: string, hits: Map<string, number>) => number,
): Promise<{ origin: string; hits: Map<string, number>; close: () => void }> {
  const hits = new Map<string, number>();
  const server = createServer((req, res) => {
    const url = req.url ?? "/";
    hits.set(url, (hits.get(url) ?? 0) + 1);
    const status = handler(url, hits);
    res.writeHead(status, { "content-type": "application/json" });
    res.end(JSON.stringify({ status: status === 200 ? "ok" : "boom" }));
  });
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      const port = typeof addr === "object" && addr ? addr.port : 0;
      resolve({
        origin: `http://127.0.0.1:${port}`,
        hits,
        close: () => server.close(),
      });
    });
  });
}

async function main(): Promise<void> {
  console.log("push-ionos-bundle post-deploy health probe:\n");
  const PATHS = ["/api/healthz", "/legomena/api/healthz"];

  // 1. Healthy from the start.
  {
    const stub = await startStub(() => 200);
    const okAll = await pollLiveHealth(stub.origin, PATHS, 10_000);
    stub.close();
    check("all endpoints healthy → probe passes", okAll === true);
    check(
      "probe hit BOTH endpoints (not just the first)",
      PATHS.every((p) => (stub.hits.get(p) ?? 0) >= 1),
      `hits: ${JSON.stringify([...stub.hits])}`,
    );
  }

  // 2. One endpoint recovers on its 3rd poll → the probe must retry.
  {
    const stub = await startStub((url, hits) =>
      url === "/legomena/api/healthz" && (hits.get(url) ?? 0) < 3 ? 503 : 200,
    );
    const okRecover = await pollLiveHealth(stub.origin, PATHS, 30_000);
    stub.close();
    check(
      "endpoint that recovers after 2 failed polls → probe retries and passes",
      okRecover === true,
    );
    check(
      "recovering endpoint was polled ≥3 times",
      (stub.hits.get("/legomena/api/healthz") ?? 0) >= 3,
    );
    check(
      "already-healthy endpoint was NOT re-polled after passing",
      (stub.hits.get("/api/healthz") ?? 0) === 1,
      `hits: ${stub.hits.get("/api/healthz")}`,
    );
  }

  // 3. One endpoint stays broken → the probe must fail before the deadline lies.
  {
    const stub = await startStub((url) => (url === "/api/healthz" ? 500 : 200));
    const okBroken = await pollLiveHealth(stub.origin, PATHS, 4_000);
    stub.close();
    check("endpoint stuck at HTTP 500 → probe fails", okBroken === false);
  }

  // 3b. Non-200 2xx (e.g. 204) is NOT healthy — the contract is exactly 200.
  {
    const stub = await startStub((url) => (url === "/api/healthz" ? 204 : 200));
    const ok204 = await pollLiveHealth(stub.origin, PATHS, 3_000);
    stub.close();
    check("endpoint answering 204 (non-200 2xx) → probe fails", ok204 === false);
  }

  // 3c. Zero endpoints verifies nothing → must never report healthy.
  {
    const okEmpty = await pollLiveHealth("http://127.0.0.1:1", [], 1_000);
    check("empty endpoint list → probe fails (no silent no-op pass)", okEmpty === false);
  }

  // 4. Unreachable origin (nothing listening) → the probe must fail too.
  {
    const stub = await startStub(() => 200);
    stub.close(); // free the port, then probe the now-dead origin
    await new Promise((r) => setTimeout(r, 100));
    const okDead = await pollLiveHealth(stub.origin, PATHS, 3_000);
    check("unreachable host → probe fails (network error ≠ pass)", okDead === false);
  }

  // 5–7. Static wiring in push-ionos-bundle.ts.
  const src = readFileSync(path.join(here, "push-ionos-bundle.ts"), "utf8");
  const wiring = (source: string) => ({
    probeAfterDeploy: (() => {
      const deployOk = source.indexOf("Remote deploy command succeeded");
      const probeCall = source.indexOf("await pollLiveHealth(");
      return deployOk !== -1 && probeCall > deployOk;
    })(),
    skipFlag:
      source.includes('"IONOS_HEALTH_CHECK"') &&
      source.includes('=== "skip"') &&
      source.includes('=== "0"'),
    failLoudly: /if \(!healthy\) \{[\s\S]*?process\.exit\(1\);/.test(source),
    emptyPathsGuard: /paths\.length === 0\) \{[\s\S]*?process\.exit\(1\);/.test(source),
    deepAfterBasic: (() => {
      // The deep content probes must only run AFTER the basic poll passed
      // (the "came back healthy" success message), so an unreachable/broken
      // site fails on the fast basic probe with its focused diagnostics.
      const basicOk = source.indexOf("came back healthy");
      const deep = source.indexOf('healthSetting === "deep"');
      const chained = source.indexOf('"check-live-ionos"');
      return basicOk !== -1 && deep > basicOk && chained > deep;
    })(),
    deepPinsLiveUrl: /LIVE_BASE_URL"\] \?\?= liveUrl/.test(source),
    deepFailsLoudly: (() => {
      // A failed check-live-ionos child must fail the deploy, not be
      // swallowed: the catch around the deep run must exit non-zero.
      const m = /run\("pnpm", \[[^\]]*"check-live-ionos"\]\);\s*\} catch \{[\s\S]*?process\.exit\(1\);/.exec(
        source,
      );
      return m !== null;
    })(),
    unknownValueRejected: (() => {
      // A typo in IONOS_HEALTH_CHECK must abort, not silently downgrade.
      const m = /KNOWN_HEALTH_SETTINGS\.includes\(healthSetting\)\) \{[\s\S]*?process\.exit\(1\);/.exec(
        source,
      );
      return m !== null && source.includes('"deep"]');
    })(),
  });
  const w = wiring(src);
  check("probe is wired AFTER the remote deploy success message", w.probeAfterDeploy);
  check("IONOS_HEALTH_CHECK=0/skip escape hatch exists", w.skipFlag);
  check("a failed probe exits non-zero", w.failLoudly);
  check("empty IONOS_HEALTH_PATHS is refused (no silent no-op probe)", w.emptyPathsGuard);
  check(
    "IONOS_HEALTH_CHECK=deep chains check-live-ionos AFTER the basic poll passes",
    w.deepAfterBasic,
  );
  check("deep mode pins LIVE_BASE_URL to the deploy's live URL", w.deepPinsLiveUrl);
  check("a failed deep check-live-ionos run exits non-zero", w.deepFailsLoudly);
  check(
    "unrecognized IONOS_HEALTH_CHECK values are rejected (typo ≠ downgrade)",
    w.unknownValueRejected,
  );

  // 8. Positive control: the wiring checks must flag a mutated source.
  const mutated = wiring(
    src
      .replace("await pollLiveHealth(", "await neveCalled(")
      .replaceAll('"IONOS_HEALTH_CHECK"', '"GONE"')
      .replace(/if \(!healthy\) \{/g, "if (false) {")
      .replaceAll("paths.length === 0", "false")
      .replaceAll('"check-live-ionos"', '"nothing"')
      .replace('LIVE_BASE_URL"] ??= liveUrl', 'LIVE_BASE_URL"] ??= other')
      .replace("KNOWN_HEALTH_SETTINGS.includes(healthSetting)", "true"),
  );
  check(
    "positive control: wiring checks flag a mutated source",
    !mutated.probeAfterDeploy &&
      !mutated.skipFlag &&
      !mutated.failLoudly &&
      !mutated.emptyPathsGuard &&
      !mutated.deepAfterBasic &&
      !mutated.deepPinsLiveUrl &&
      !mutated.deepFailsLoudly &&
      !mutated.unknownValueRejected,
  );

  console.log(
    failures === 0
      ? "\nAll push health-probe checks passed."
      : `\n${failures} push health-probe check(s) FAILED.`,
  );
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
