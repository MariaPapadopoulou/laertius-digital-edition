/**
 * Validate that push-ionos-bundle refuses to upload a stale/unverified zip
 * under SKIP_BUILD=1 (task: "Catch the upload script silently shipping a zip
 * the smoke test never saw").
 *
 * The script is spawned for real against a fixture repo root
 * (PUSH_IONOS_REPO_ROOT), with a stub `scp` on PATH that records whether an
 * upload was attempted. Cases:
 *
 *   1. SKIP_BUILD=1, no sources manifest             -> exit 1, no scp call
 *   2. SKIP_BUILD=1, manifest bound to a
 *      DIFFERENT zip (hash mismatch)                 -> exit 1, no scp call
 *   3. case 2 + FORCE_UPLOAD=1                       -> uploads, loud warning
 *   4. SKIP_BUILD=1, hash-bound but smoke "skipped"
 *      (SKIP_SMOKE build, full repo fixture)         -> exit 1, no scp call
 *   5. positive control: hash-bound AND smoke-passed
 *      fresh zip (full repo fixture)                 -> uploads, exit 0
 *   6. unit: zipManifestBindingError null on a bound
 *      + smoke-passed manifest, non-null on "skipped"
 *   7. static wiring: the SKIP_BUILD branch in push-ionos-bundle.ts calls
 *      verifyZipForUpload before any scp; FORCE_UPLOAD is the only override
 *
 * Run: pnpm --filter @workspace/scripts run validate-push-skip-build-guard
 * Exit codes: 0 = all checks pass, 1 = at least one failure.
 */
import { spawnSync } from "node:child_process";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  DATA_FILES,
  LEGOMENA_DATA_FILES,
  MANIFEST_SMOKE_KEY,
  MANIFEST_ZIP_KEY,
  buildInputFiles,
  hashFile,
  sourceDirs,
  writeSourcesManifest,
  zipManifestBindingError,
  type SmokeStatus,
} from "./ionos-bundle-contract";

const scriptsDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const repoRoot = path.dirname(scriptsDir);
const pushScript = path.join(scriptsDir, "src", "push-ionos-bundle.ts");

let failures = 0;
function check(name: string, ok: boolean, detail?: string) {
  if (ok) {
    console.log(`PASS: ${name}`);
  } else {
    failures += 1;
    console.error(`FAIL: ${name}${detail ? `\n  ${detail}` : ""}`);
  }
}

type Fixture = {
  root: string;
  zipPath: string;
  manifestPath: string;
  scpMarker: string;
  binDir: string;
};

/** Minimal fixture repo root: just the zip + a stub scp on PATH. */
function makeFixture(): Fixture {
  const root = mkdtempSync(path.join(tmpdir(), "push-guard-"));
  const exportsDir = path.join(root, "exports");
  mkdirSync(exportsDir, { recursive: true });
  const zipPath = path.join(exportsDir, "laertius-ionos.zip");
  writeFileSync(zipPath, "not-a-real-zip-but-hashable\n");
  const manifestPath = path.join(exportsDir, "laertius-ionos.sources.json");
  // Stub scp that records the attempted upload instead of touching the network.
  const binDir = path.join(root, "bin");
  mkdirSync(binDir);
  const scpMarker = path.join(root, "scp-was-called");
  const scpStub = path.join(binDir, "scp");
  writeFileSync(
    scpStub,
    `#!/usr/bin/env bash\necho "$@" > "${scpMarker}"\nexit 0\n`,
  );
  chmodSync(scpStub, 0o755);
  return { root, zipPath, manifestPath, scpMarker, binDir };
}

/**
 * Full fixture repo root that satisfies every stage of verifyZipForUpload
 * (data files, source dirs, build-input files, a template package.json whose
 * pin resolves in the fixture's node_modules), so the freshness check runs
 * for real instead of erroring on missing sources. The manifest is written
 * by the SAME writeSourcesManifest the build uses, with the given smoke
 * status — exactly what a SKIP_SMOKE=1 build ("skipped") or a smoke-tested
 * build ("passed") leaves on disk.
 */
function makeFullFixture(smoke: SmokeStatus): Fixture {
  const fx = makeFixture();
  const root = fx.root;
  // Bundled data files.
  for (const f of DATA_FILES) {
    const p = path.join(root, "artifacts", "api-server", "data", f);
    mkdirSync(path.dirname(p), { recursive: true });
    writeFileSync(p, `fixture ${f}\n`);
  }
  for (const f of LEGOMENA_DATA_FILES) {
    const p = path.join(root, "artifacts", "legomena-api", "data", f);
    mkdirSync(path.dirname(p), { recursive: true });
    writeFileSync(p, `fixture ${f}\n`);
  }
  // Watched source dirs (one file each so the walk has content).
  for (const dir of sourceDirs(root)) {
    mkdirSync(dir, { recursive: true });
    writeFileSync(path.join(dir, "fixture.txt"), "fixture source\n");
  }
  // Standalone build-input files.
  for (const p of buildInputFiles(root)) {
    mkdirSync(path.dirname(p), { recursive: true });
    writeFileSync(p, p.endsWith(".json") ? "{}\n" : "// fixture\n");
  }
  // Bundle template with a pin the drift check can resolve in the fixture.
  writeFileSync(
    path.join(root, "exports", "ionos-bundle", "package.json"),
    JSON.stringify({ dependencies: { "fixture-dep": "1.2.3" } }, null, 2),
  );
  const depManifest = path.join(
    root,
    "artifacts",
    "api-server",
    "node_modules",
    "fixture-dep",
    "package.json",
  );
  mkdirSync(path.dirname(depManifest), { recursive: true });
  writeFileSync(depManifest, JSON.stringify({ version: "1.2.3" }));
  // Zip last so its mtime is newest, then the real manifest writer.
  writeFileSync(fx.zipPath, "fixture zip built after all sources\n");
  writeSourcesManifest(root, smoke);
  return fx;
}

function runPush(
  fixture: Fixture,
  extraEnv: Record<string, string> = {},
): { exitCode: number; output: string } {
  const res = spawnSync("pnpm", ["exec", "tsx", pushScript], {
    cwd: path.join(repoRoot, "scripts"),
    env: {
      ...process.env,
      PATH: `${fixture.binDir}:${process.env["PATH"] ?? ""}`,
      PUSH_IONOS_REPO_ROOT: fixture.root,
      IONOS_SSH_TARGET: "test@invalid.example",
      SKIP_BUILD: "1",
      ...extraEnv,
    },
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  return {
    exitCode: res.status ?? -1,
    output: `${res.stdout ?? ""}${res.stderr ?? ""}`,
  };
}

function main() {
  // Case 1: no manifest at all -> refuse.
  {
    const fx = makeFixture();
    const res = runPush(fx);
    check("no-manifest refusal exits non-zero", res.exitCode !== 0, res.output);
    check(
      "no-manifest refusal explains the unverified zip",
      /UNVERIFIED ZIP/.test(res.output) && /REFUSING TO UPLOAD/.test(res.output),
      res.output.slice(0, 500),
    );
    check("no-manifest refusal never invokes scp", !existsSync(fx.scpMarker));
    rmSync(fx.root, { recursive: true, force: true });
  }

  // Case 2: manifest bound to a different zip -> refuse.
  {
    const fx = makeFixture();
    writeFileSync(
      fx.manifestPath,
      JSON.stringify(
        { [MANIFEST_ZIP_KEY]: "0".repeat(64), [MANIFEST_SMOKE_KEY]: "passed" },
        null,
        2,
      ),
    );
    const res = runPush(fx);
    check("hash-mismatch refusal exits non-zero", res.exitCode !== 0, res.output);
    check(
      "hash-mismatch refusal names the manifest mismatch",
      /written for a DIFFERENT zip/.test(res.output),
      res.output.slice(0, 500),
    );
    check("hash-mismatch refusal never invokes scp", !existsSync(fx.scpMarker));
    rmSync(fx.root, { recursive: true, force: true });
  }

  // Case 3: same mismatch but FORCE_UPLOAD=1 -> loud warning, upload proceeds.
  {
    const fx = makeFixture();
    writeFileSync(
      fx.manifestPath,
      JSON.stringify({ [MANIFEST_ZIP_KEY]: "0".repeat(64) }, null, 2),
    );
    const res = runPush(fx, { FORCE_UPLOAD: "1" });
    check("FORCE_UPLOAD override exits zero", res.exitCode === 0, res.output);
    check(
      "FORCE_UPLOAD override warns loudly",
      /WARNING: pre-upload verification FAILED/.test(res.output),
      res.output.slice(0, 500),
    );
    check(
      "FORCE_UPLOAD override actually uploads (stub scp called)",
      existsSync(fx.scpMarker),
    );
    rmSync(fx.root, { recursive: true, force: true });
  }

  // Case 4: hash-bound, fresh, but built with SKIP_SMOKE=1 (manifest smoke
  // status "skipped") -> refuse. This is the exact bypass the task exists to
  // close: SKIP_SMOKE=1 build-ionos-bundle + SKIP_BUILD=1 push-ionos-bundle.
  {
    const fx = makeFullFixture("skipped");
    const res = runPush(fx);
    check(
      "smoke-skipped zip refusal exits non-zero",
      res.exitCode !== 0,
      res.output,
    );
    check(
      "smoke-skipped refusal names SKIP_SMOKE",
      /SKIP_SMOKE=1/.test(res.output) && /smoke test never saw it/.test(res.output),
      res.output.slice(0, 800),
    );
    check("smoke-skipped refusal never invokes scp", !existsSync(fx.scpMarker));
    rmSync(fx.root, { recursive: true, force: true });
  }

  // Case 5 (end-to-end positive control): hash-bound, smoke-passed, fresh zip
  // -> verification passes and the upload proceeds. Proves cases 1/2/4 fail
  // for their stated reasons, not because the fixture can never pass.
  {
    const fx = makeFullFixture("passed");
    const res = runPush(fx);
    check(
      "smoke-passed fresh zip uploads (exit zero)",
      res.exitCode === 0,
      res.output.slice(0, 1200),
    );
    check(
      "smoke-passed zip passes verification explicitly",
      /bound to the sources manifest and fresh/.test(res.output),
      res.output.slice(0, 800),
    );
    check(
      "smoke-passed zip reaches the stub scp",
      existsSync(fx.scpMarker) &&
        readFileSync(fx.scpMarker, "utf8").includes("laertius-ionos.zip"),
    );
    rmSync(fx.root, { recursive: true, force: true });
  }

  // Case 6 (unit): zipManifestBindingError distinguishes passed vs skipped.
  {
    const fx = makeFixture();
    writeFileSync(
      fx.manifestPath,
      JSON.stringify(
        {
          [MANIFEST_ZIP_KEY]: hashFile(fx.zipPath),
          [MANIFEST_SMOKE_KEY]: "passed",
        },
        null,
        2,
      ),
    );
    check(
      "bound + smoke-passed manifest passes zipManifestBindingError",
      zipManifestBindingError(fx.root, fx.zipPath) === null,
      zipManifestBindingError(fx.root, fx.zipPath) ?? undefined,
    );
    writeFileSync(
      fx.manifestPath,
      JSON.stringify(
        {
          [MANIFEST_ZIP_KEY]: hashFile(fx.zipPath),
          [MANIFEST_SMOKE_KEY]: "skipped",
        },
        null,
        2,
      ),
    );
    const err = zipManifestBindingError(fx.root, fx.zipPath);
    check(
      "bound but smoke-skipped manifest fails zipManifestBindingError",
      err !== null && /SKIP_SMOKE/.test(err),
      err ?? "(null)",
    );
    rmSync(fx.root, { recursive: true, force: true });
  }

  // Case 7: static wiring — the guard must sit in push-ionos-bundle.ts's
  // SKIP_BUILD path, before the scp upload.
  {
    const src = readFileSync(pushScript, "utf8");
    const guardIdx = src.indexOf("verifyZipForUpload(");
    const scpIdx = src.indexOf('"scp"');
    check("push-ionos-bundle.ts calls verifyZipForUpload", guardIdx !== -1);
    check(
      "guard call precedes the scp upload in the source",
      guardIdx !== -1 && scpIdx !== -1 && guardIdx < scpIdx,
    );
    check(
      "refusal is overridable only via explicit FORCE_UPLOAD=1",
      /FORCE_UPLOAD/.test(src),
    );
  }

  console.log(
    failures === 0
      ? "\nAll push-ionos-bundle SKIP_BUILD guard checks passed."
      : `\n${failures} check(s) FAILED.`,
  );
  process.exit(failures === 0 ? 0 : 1);
}

main();
