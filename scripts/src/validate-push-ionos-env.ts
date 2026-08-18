/**
 * Validate push-ionos-bundle's env-var branch handling (task: "Catch the
 * upload script's env-var handling breaking without anyone noticing").
 *
 * push-ionos-bundle has several env-driven branches that were only ever
 * verified by hand: missing IONOS_SSH_TARGET, key-auth vs sshpass upload,
 * and IONOS_REMOTE_CMD unset / success / failure. A refactor could silently
 * stop propagating the remote-command failure exit code, or drop the
 * "zip WAS uploaded" diagnostic. This validator spawns the script for real
 * (SKIP_BUILD=1, fixture repo root with a manifest-bound dummy zip) with
 * fake `scp`, `ssh` and `sshpass` shell shims first on PATH — the network is
 * never touched — and asserts each branch's exit code and messages:
 *
 *   1. IONOS_SSH_TARGET unset                  -> exit 1, help text, no scp
 *   2. target set, no IONOS_REMOTE_CMD         -> exit 0, scp called,
 *      ssh NOT called, manual next-steps hint printed
 *   3. IONOS_REMOTE_CMD set, remote cmd OK     -> exit 0, ssh called with the
 *      command, "Remote deploy command succeeded"
 *   4. IONOS_REMOTE_CMD set, remote cmd FAILS  -> exit 1, "zip WAS uploaded"
 *      message (upload happened, deploy did not)
 *   5. IONOS_SSH_PASSWORD set                  -> sshpass shim used for both
 *      scp and ssh, bare scp/ssh shims never invoked
 *   6. no SKIP_BUILD (default path)            -> a fake `pnpm` shim on PATH
 *      records that build-ionos-bundle is invoked, and an order log proves
 *      the build ran BEFORE the scp shim uploaded anything
 *
 * Run: pnpm --filter @workspace/scripts run validate-push-ionos-env
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
  buildInputFiles,
  sourceDirs,
  writeSourcesManifest,
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
  binDir: string;
  scpMarker: string;
  sshMarker: string;
  sshpassMarker: string;
  pnpmMarker: string;
  orderLog: string;
};

/**
 * Fixture repo root that fully satisfies verifyZipForUpload (same recipe as
 * validate-push-skip-build-guard's full fixture: data files, source dirs,
 * build inputs, resolvable template dependency pin, zip written last, then
 * the real manifest writer with smoke "passed"), plus fake scp/ssh/sshpass
 * shims that record their argv instead of touching the network. This
 * validator owns the env-var branches only — the SKIP_BUILD staleness guard
 * is validate-push-skip-build-guard's job.
 */
function makeFixture(sshExit = 0): Fixture {
  const root = mkdtempSync(path.join(tmpdir(), "push-env-"));
  const exportsDir = path.join(root, "exports");
  mkdirSync(exportsDir, { recursive: true });
  const zipPath = path.join(exportsDir, "laertius-ionos.zip");
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
  for (const dir of sourceDirs(root)) {
    mkdirSync(dir, { recursive: true });
    writeFileSync(path.join(dir, "fixture.txt"), "fixture source\n");
  }
  for (const p of buildInputFiles(root)) {
    mkdirSync(path.dirname(p), { recursive: true });
    writeFileSync(p, p.endsWith(".json") ? "{}\n" : "// fixture\n");
  }
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
  writeFileSync(zipPath, "fixture zip built after all sources\n");
  writeSourcesManifest(root, "passed");
  const binDir = path.join(root, "bin");
  mkdirSync(binDir);
  const scpMarker = path.join(root, "scp-args");
  const sshMarker = path.join(root, "ssh-args");
  const sshpassMarker = path.join(root, "sshpass-args");
  const pnpmMarker = path.join(root, "pnpm-args");
  // Shared, append-only ordering log: every shim writes its name here so the
  // default-path check can assert the build step ran BEFORE the upload.
  const orderLog = path.join(root, "order-log");
  const stub = (name: string, marker: string, exit: number) => {
    const p = path.join(binDir, name);
    writeFileSync(
      p,
      `#!/usr/bin/env bash\necho "$@" >> "${marker}"\necho "${name}" >> "${orderLog}"\nexit ${exit}\n`,
    );
    chmodSync(p, 0o755);
  };
  stub("scp", scpMarker, 0);
  stub("ssh", sshMarker, sshExit);
  // Fake pnpm: push-ionos-bundle's default (no SKIP_BUILD) path shells out to
  // `pnpm --filter @workspace/scripts run build-ionos-bundle`; the shim
  // records the call instead of running the real (slow) build. It is safe to
  // have on PATH for every case because the SKIP_BUILD cases never call pnpm
  // (proven by the "never invokes pnpm" checks) — and the validator launches
  // the push script via the tsx binary directly, so the shim can never
  // intercept the launcher itself.
  stub("pnpm", pnpmMarker, 0);
  // sshpass shim: record, then delegate to the rest of the argv (skipping
  // the -e flag) so the scp/ssh shims still see their calls and the ssh exit
  // code still propagates.
  const sshpassPath = path.join(binDir, "sshpass");
  writeFileSync(
    sshpassPath,
    `#!/usr/bin/env bash\necho "$@" >> "${sshpassMarker}"\nshift\nexec "$@"\n`,
  );
  chmodSync(sshpassPath, 0o755);
  return { root, binDir, scpMarker, sshMarker, sshpassMarker, pnpmMarker, orderLog };
}

// Launch the push script through the tsx binary directly — NOT `pnpm exec
// tsx` — so the fake `pnpm` shim on the fixture PATH can never intercept the
// launcher itself; it only sees the build call the push script makes.
const tsxBin = path.join(scriptsDir, "node_modules", ".bin", "tsx");

function runPush(
  fixture: Fixture,
  env: Record<string, string | undefined>,
): { exitCode: number; output: string } {
  const merged: Record<string, string | undefined> = {
    ...process.env,
    PATH: `${fixture.binDir}:${process.env["PATH"] ?? ""}`,
    PUSH_IONOS_REPO_ROOT: fixture.root,
    SKIP_BUILD: "1",
    IONOS_SSH_TARGET: undefined,
    IONOS_SSH_PASSWORD: undefined,
    IONOS_REMOTE_CMD: undefined,
    ...env,
  };
  const res = spawnSync(tsxBin, [pushScript], {
    cwd: path.join(repoRoot, "scripts"),
    env: merged as NodeJS.ProcessEnv,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  return {
    exitCode: res.status ?? -1,
    output: `${res.stdout ?? ""}${res.stderr ?? ""}`,
  };
}

const TARGET = "test@invalid.example";

function main() {
  // Case 1: no IONOS_SSH_TARGET -> exit 1 with the help text, nothing runs.
  {
    const fx = makeFixture();
    const res = runPush(fx, {});
    check("missing target exits 1", res.exitCode === 1, res.output);
    check(
      "missing target prints the help text",
      /IONOS_SSH_TARGET is not set/.test(res.output),
      res.output.slice(0, 500),
    );
    check("missing target never invokes scp", !existsSync(fx.scpMarker));
    check("missing target never invokes ssh", !existsSync(fx.sshMarker));
    rmSync(fx.root, { recursive: true, force: true });
  }

  // Case 2: upload-only (no IONOS_REMOTE_CMD) -> exit 0, scp yes, ssh no,
  // manual next-steps hint printed.
  {
    const fx = makeFixture();
    const res = runPush(fx, { IONOS_SSH_TARGET: TARGET });
    check("upload-only exits 0", res.exitCode === 0, res.output.slice(0, 1200));
    check(
      "upload-only calls the scp shim with the zip and target",
      existsSync(fx.scpMarker) &&
        readFileSync(fx.scpMarker, "utf8").includes("laertius-ionos.zip") &&
        readFileSync(fx.scpMarker, "utf8").includes(TARGET),
      existsSync(fx.scpMarker) ? readFileSync(fx.scpMarker, "utf8") : "(scp never called)",
    );
    check("upload-only never invokes ssh", !existsSync(fx.sshMarker));
    check(
      "upload-only prints the manual next-steps hint",
      /Next: on the VPS/.test(res.output),
      res.output.slice(-600),
    );
    rmSync(fx.root, { recursive: true, force: true });
  }

  // Case 3: IONOS_REMOTE_CMD set, remote command succeeds -> exit 0, ssh
  // shim receives the command.
  {
    const fx = makeFixture(0);
    const cmd = "echo deploy-step-marker";
    const res = runPush(fx, { IONOS_SSH_TARGET: TARGET, IONOS_REMOTE_CMD: cmd });
    check("remote-cmd success exits 0", res.exitCode === 0, res.output.slice(0, 1200));
    check(
      "remote-cmd success runs ssh with the command",
      existsSync(fx.sshMarker) && readFileSync(fx.sshMarker, "utf8").includes(cmd),
      existsSync(fx.sshMarker) ? readFileSync(fx.sshMarker, "utf8") : "(ssh never called)",
    );
    check(
      "remote-cmd success reports the deploy",
      /Remote deploy command succeeded/.test(res.output),
      res.output.slice(-600),
    );
    rmSync(fx.root, { recursive: true, force: true });
  }

  // Case 4: IONOS_REMOTE_CMD set, remote command FAILS -> exit 1 with the
  // "zip WAS uploaded" diagnostic; the upload itself still happened.
  {
    const fx = makeFixture(7);
    const res = runPush(fx, {
      IONOS_SSH_TARGET: TARGET,
      IONOS_REMOTE_CMD: "false-on-the-vps",
    });
    check("remote-cmd failure exits 1", res.exitCode === 1, res.output.slice(0, 1200));
    check(
      "remote-cmd failure prints the 'zip WAS uploaded' message",
      /zip WAS uploaded/.test(res.output) &&
        /Remote deploy command failed/.test(res.output),
      res.output.slice(-800),
    );
    check(
      "remote-cmd failure still uploaded first (scp shim called)",
      existsSync(fx.scpMarker),
    );
    check(
      "remote-cmd failure never claims success",
      !/Remote deploy command succeeded/.test(res.output),
    );
    rmSync(fx.root, { recursive: true, force: true });
  }

  // Case 5: IONOS_SSH_PASSWORD set -> both steps go through sshpass -e; the
  // failure exit code must still propagate through the sshpass wrapper.
  {
    const fx = makeFixture(0);
    const cmd = "echo deploy-via-sshpass";
    const res = runPush(fx, {
      IONOS_SSH_TARGET: TARGET,
      IONOS_REMOTE_CMD: cmd,
      IONOS_SSH_PASSWORD: "fixture-password",
    });
    check("sshpass path exits 0 on success", res.exitCode === 0, res.output.slice(0, 1200));
    const sshpassCalls = existsSync(fx.sshpassMarker)
      ? readFileSync(fx.sshpassMarker, "utf8")
      : "";
    check(
      "sshpass shim wraps both scp and ssh",
      /scp/.test(sshpassCalls) && /ssh/.test(sshpassCalls) && sshpassCalls.includes(cmd),
      sshpassCalls || "(sshpass never called)",
    );
    rmSync(fx.root, { recursive: true, force: true });

    // …and a failing remote cmd under sshpass still exits 1 with the message.
    const fx2 = makeFixture(9);
    const res2 = runPush(fx2, {
      IONOS_SSH_TARGET: TARGET,
      IONOS_REMOTE_CMD: "failing-deploy",
      IONOS_SSH_PASSWORD: "fixture-password",
    });
    check(
      "sshpass remote-cmd failure exits 1 with the uploaded-but-not-deployed message",
      res2.exitCode === 1 && /zip WAS uploaded/.test(res2.output),
      res2.output.slice(-800),
    );
    rmSync(fx2.root, { recursive: true, force: true });
  }

  // Case 6: default path (no SKIP_BUILD) — the script must invoke
  // build-ionos-bundle (via the pnpm shim) BEFORE the scp upload. A refactor
  // that reorders or drops the rebuild would silently ship stale bundles.
  {
    const fx = makeFixture();
    const res = runPush(fx, { IONOS_SSH_TARGET: TARGET, SKIP_BUILD: undefined });
    check("default path exits 0", res.exitCode === 0, res.output.slice(0, 1200));
    const pnpmCalls = existsSync(fx.pnpmMarker)
      ? readFileSync(fx.pnpmMarker, "utf8")
      : "";
    check(
      "default path invokes build-ionos-bundle via pnpm",
      /build-ionos-bundle/.test(pnpmCalls),
      pnpmCalls || "(pnpm never called)",
    );
    check("default path still uploads (scp shim called)", existsSync(fx.scpMarker));
    const order = existsSync(fx.orderLog)
      ? readFileSync(fx.orderLog, "utf8").trim().split("\n")
      : [];
    check(
      "build step runs BEFORE the scp upload",
      order.indexOf("pnpm") !== -1 &&
        order.indexOf("scp") !== -1 &&
        order.indexOf("pnpm") < order.indexOf("scp"),
      `order log: ${JSON.stringify(order)}`,
    );
    check(
      "default path does not print the SKIP_BUILD notice",
      !/SKIP_BUILD=1 — uploading/.test(res.output),
      res.output.slice(0, 600),
    );
    rmSync(fx.root, { recursive: true, force: true });

    // Negative control: with SKIP_BUILD=1 the pnpm shim must NOT be called —
    // proves the shim isn't intercepting anything besides the build step and
    // that the ordering assertion above isn't vacuous.
    const fx2 = makeFixture();
    const res2 = runPush(fx2, { IONOS_SSH_TARGET: TARGET });
    check(
      "SKIP_BUILD=1 never invokes the pnpm shim",
      res2.exitCode === 0 && !existsSync(fx2.pnpmMarker),
      existsSync(fx2.pnpmMarker) ? readFileSync(fx2.pnpmMarker, "utf8") : res2.output.slice(0, 600),
    );
    rmSync(fx2.root, { recursive: true, force: true });
  }

  console.log(
    failures === 0
      ? "\nAll push-ionos-bundle env-branch checks passed."
      : `\n${failures} check(s) FAILED.`,
  );
  process.exit(failures === 0 ? 0 : 1);
}

main();
