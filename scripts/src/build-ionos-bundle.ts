/**
 * Build the self-contained IONOS deployment bundle: exports/laertius-ionos.zip
 *
 * One command, always current:
 *   pnpm --filter @workspace/scripts run build-ionos-bundle
 *
 * Steps:
 *   1. Build the frontend (Vite, NODE_ENV=production, BASE_PATH=/); the
 *      Terminology pages are part of the single laertius app
 *   2. Build the api-server (esbuild bundle)
 *   3. Assemble a staging directory:
 *        server/  — dist/*.mjs (no source maps)
 *        public/  — the built laertius frontend
 *        data/    — the four corpus/data files (no models, no TEI XMLs)
 *        package.json + README.md — from exports/ionos-bundle/
 *   4. Zip it to exports/laertius-ionos.zip
 *   5. Smoke-test the zip (extract, boot, check /api/healthz, /, /api/search,
 *      the LOD graph/ontology exports in Turtle and RDF/XML, a per-passage
 *      JSON-LD + RDF/XML export, and /api/annotations/entities);
 *      the zip is deleted and the build fails if the bundle doesn't pass.
 *   6. Run the CSP browser sweep (e2e-csp-violations) against the fresh zip
 *      when a headless Chromium is installed; a CSP violation deletes the
 *      zip and fails the build. When no browser is available (or SKIP_CSP=1)
 *      the sweep is skipped with a LOUD banner telling you to run
 *      e2e-csp-violations before deploying — never a silent skip.
 */
import { execFileSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  rmSync,
  statSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  bundleLockfileDrift,
  DATA_FILES,
  EVAL_SEED_DIRS,
  LEGOMENA_DATA_FILES,
  writeSourcesManifest,
  sourcesManifestPath,
} from "./ionos-bundle-contract";
import { smokeIonosBundle } from "./smoke-ionos-bundle";
import { findHeadlessChromiumDir } from "./headless-chromium";

const scriptsDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const repoRoot = path.dirname(scriptsDir);

const laertiusDir = path.join(repoRoot, "artifacts", "laertius");
const evalDir = path.join(repoRoot, "artifacts", "eval");
const apiServerDir = path.join(repoRoot, "artifacts", "api-server");
const dataDir = path.join(apiServerDir, "data");
const legomenaApiDir = path.join(repoRoot, "artifacts", "legomena-api");
const legomenaDataDir = path.join(legomenaApiDir, "data");
const templateDir = path.join(repoRoot, "exports", "ionos-bundle");
const exportsDir = path.join(repoRoot, "exports");
const zipPath = path.join(exportsDir, "laertius-ionos.zip");

function run(cmd: string, args: string[], opts: { cwd: string; env?: NodeJS.ProcessEnv }) {
  console.log(`\n$ ${cmd} ${args.join(" ")}`);
  execFileSync(cmd, args, {
    cwd: opts.cwd,
    env: { ...process.env, ...opts.env },
    stdio: "inherit",
  });
}

function main() {
  // Preflight: templates and data files must exist before we spend time building.
  for (const f of ["README.md", "package.json", "package-lock.json"]) {
    const p = path.join(templateDir, f);
    if (!existsSync(p)) throw new Error(`Missing bundle template file: ${p}`);
  }
  // The shipped lockfile must exist and stay in sync with the shipped
  // package.json, or the README's documented `npm ci` fails on the server.
  const lockDrift = bundleLockfileDrift(repoRoot);
  if (lockDrift.length > 0) {
    throw new Error(
      `exports/ionos-bundle/package-lock.json is missing or drifts from package.json:\n  - ${lockDrift.join("\n  - ")}\n\nRegenerate it: cd exports/ionos-bundle && npm install --package-lock-only --ignore-scripts`,
    );
  }
  for (const f of DATA_FILES) {
    const p = path.join(dataDir, f);
    if (!existsSync(p)) throw new Error(`Missing data file: ${p}`);
  }
  for (const f of LEGOMENA_DATA_FILES) {
    const p = path.join(legomenaDataDir, f);
    if (!existsSync(p)) throw new Error(`Missing legomena data file: ${p}`);
  }

  // 1+2. Build the frontend (IONOS root path) and the api-server bundle.
  // SKIP_APP_BUILDS=1 reuses existing dist/ outputs — the full build can
  // outlive a shell session, so the app builds can be run separately first
  // (same chunk-resumable pattern as build-embeddings).
  if (process.env.SKIP_APP_BUILDS === "1") {
    console.log("\nSKIP_APP_BUILDS=1 — reusing existing dist/ outputs");
  } else {
    run("pnpm", ["--filter", "@workspace/laertius", "run", "build"], {
      cwd: repoRoot,
      env: { NODE_ENV: "production", BASE_PATH: "/" },
    });
    // Evaluation workbench SPA, served at /eval/ in the bundle. Its Vite
    // config requires PORT even for a build (any numeric value works — it
    // never binds a port during a build).
    run("pnpm", ["--filter", "@workspace/eval", "run", "build"], {
      cwd: repoRoot,
      env: { NODE_ENV: "production", BASE_PATH: "/eval/", PORT: "5000" },
    });
    run("pnpm", ["--filter", "@workspace/api-server", "run", "build"], {
      cwd: repoRoot,
    });
    // Legomena API server (its frontend is merged into the laertius app
    // under /legomena/* routes; only the API service remains standalone).
    run("pnpm", ["--filter", "@workspace/legomena-api", "run", "build"], {
      cwd: repoRoot,
    });
  }

  const frontendOut = path.join(laertiusDir, "dist", "public");
  const evalOut = path.join(evalDir, "dist", "public");
  const serverOut = path.join(apiServerDir, "dist");
  if (!existsSync(path.join(frontendOut, "index.html"))) {
    throw new Error(`Frontend build output missing: ${frontendOut}/index.html`);
  }
  if (!existsSync(path.join(evalOut, "index.html"))) {
    throw new Error(`Eval build output missing: ${evalOut}/index.html`);
  }
  if (!existsSync(path.join(serverOut, "index.mjs"))) {
    throw new Error(`Server build output missing: ${serverOut}/index.mjs`);
  }
  const legomenaServerOut = path.join(legomenaApiDir, "dist");
  if (!existsSync(path.join(legomenaServerOut, "index.mjs"))) {
    throw new Error(
      `Legomena server build output missing: ${legomenaServerOut}/index.mjs`,
    );
  }

  // 3. Assemble the staging directory.
  const stagingDir = path.join(exportsDir, ".ionos-staging");
  rmSync(stagingDir, { recursive: true, force: true });
  mkdirSync(path.join(stagingDir, "server"), { recursive: true });
  mkdirSync(path.join(stagingDir, "data"), { recursive: true });

  for (const f of readdirSync(serverOut)) {
    if (f.endsWith(".mjs")) {
      cpSync(path.join(serverOut, f), path.join(stagingDir, "server", f));
    }
  }
  cpSync(frontendOut, path.join(stagingDir, "public"), { recursive: true });
  // Evaluation workbench SPA lives under public/eval/ (built with
  // BASE_PATH=/eval/); the api-server serves it there behind Basic auth.
  cpSync(evalOut, path.join(stagingDir, "public", "eval"), { recursive: true });
  if (!existsSync(path.join(stagingDir, "public", "eval", "index.html"))) {
    throw new Error(
      `Eval frontend missing from staging: ${path.join(stagingDir, "public", "eval", "index.html")}`,
    );
  }
  for (const f of DATA_FILES) {
    cpSync(path.join(dataDir, f), path.join(stagingDir, "data", f));
  }
  // Evaluation-workbench seed data (pool, batches, snapshots, topic sets,
  // runs, gold): a clean install needs these under LAERTIUS_DATA_DIR/eval/
  // or /eval serves an empty workbench. Live state (eval/judgments/,
  // eval/adjudications/, eval/judge-tokens.json) is deliberately NOT
  // copied — the zip must never be able to overwrite it on a redeploy.
  for (const d of EVAL_SEED_DIRS) {
    const src = path.join(dataDir, "eval", d);
    if (!existsSync(src)) throw new Error(`Missing eval seed dir: ${src}`);
    cpSync(src, path.join(stagingDir, "data", "eval", d), {
      recursive: true,
      // Skip dot-prefixed local caches (e.g. gold/.retrieval-cache-*.jsonl):
      // build inputs, not release payload.
      filter: (s) => !path.basename(s).startsWith("."),
    });
  }
  // Contract assertions: every seed dir made it into staging, and none of
  // the LIVE judging-state paths did (a redeploy must never overwrite them).
  for (const d of EVAL_SEED_DIRS) {
    if (!existsSync(path.join(stagingDir, "data", "eval", d))) {
      throw new Error(`Eval seed dir missing from staging: data/eval/${d}`);
    }
  }
  for (const live of ["judgments", "adjudications", "judge-tokens.json"]) {
    if (existsSync(path.join(stagingDir, "data", "eval", live))) {
      throw new Error(
        `LIVE eval state leaked into the bundle staging: data/eval/${live} — the zip must never ship it`,
      );
    }
  }
  cpSync(path.join(templateDir, "package.json"), path.join(stagingDir, "package.json"));
  // Lockfile ships alongside package.json so the documented `npm ci`
  // installs exactly the pinned dependency tree on the server.
  cpSync(
    path.join(templateDir, "package-lock.json"),
    path.join(stagingDir, "package-lock.json"),
  );
  cpSync(path.join(templateDir, "README.md"), path.join(stagingDir, "README.md"));

  // Legomena API service: its own server + Turtle dataset under legomena/.
  // The Legomena FRONTEND is part of the merged laertius app in public/
  // (/legomena/* routes); only /legomena/api is proxied to this server.
  // Node resolves the esbuild externals (@huggingface/transformers,
  // oxigraph) by walking up to the root node_modules, so one npm install at
  // the bundle root covers both servers. No model cache is shipped (same
  // policy as data/): both services use the same embedding model, so
  // LEGOMENA_MODEL_CACHE points at the main site's data/models.
  mkdirSync(path.join(stagingDir, "legomena", "server"), { recursive: true });
  mkdirSync(path.join(stagingDir, "legomena", "data"), { recursive: true });
  for (const f of readdirSync(legomenaServerOut)) {
    if (f.endsWith(".mjs")) {
      cpSync(
        path.join(legomenaServerOut, f),
        path.join(stagingDir, "legomena", "server", f),
      );
    }
  }
  for (const f of LEGOMENA_DATA_FILES) {
    cpSync(
      path.join(legomenaDataDir, f),
      path.join(stagingDir, "legomena", "data", f),
    );
  }

  // 4. Zip it (contents at the archive root, matching the previous bundle).
  rmSync(zipPath, { force: true });
  run(
    "zip",
    [
      "-r",
      "-q",
      zipPath,
      "server",
      "public",
      "data",
      "legomena",
      "package.json",
      "package-lock.json",
      "README.md",
    ],
    {
      cwd: stagingDir,
    },
  );
  rmSync(stagingDir, { recursive: true, force: true });

  const sizeMb = (statSync(zipPath).size / (1024 * 1024)).toFixed(1);
  console.log(`\nBundle written: ${zipPath} (${sizeMb} MB)`);
}

async function buildAndVerify() {
  main();

  // 5. Smoke-test the freshly built zip. If it fails, remove the zip so a
  // broken bundle is never left in exports/ waiting to be deployed.
  // SKIP_SMOKE=1 skips this step so zip creation and smoke test can run in
  // separate shell invocations when the combined build exceeds the shell timeout.
  // Always run the smoke test before deploying: pnpm --filter @workspace/scripts run smoke-ionos-bundle
  if (process.env.SKIP_SMOKE === "1") {
    console.log("\nSKIP_SMOKE=1 — skipping smoke test. Run smoke-ionos-bundle before deploying.");
    // Record the smoke status as "skipped": the upload guard
    // (push-ionos-bundle SKIP_BUILD=1) refuses to ship a zip whose manifest
    // is not marked "passed"; a standalone smoke-ionos-bundle run upgrades it.
    writeSourcesManifest(repoRoot, "skipped");
    console.log(`Sources manifest written: ${sourcesManifestPath(repoRoot)}`);
    cspSkipBanner(
      "SKIP_SMOKE=1 skips the browser sweep too (nothing is verified yet).",
      "Run smoke-ionos-bundle, then the CSP sweep, before deploying.",
    );
    return;
  }
  try {
    await smokeIonosBundle(zipPath);
  } catch (err) {
    rmSync(zipPath, { force: true });
    rmSync(sourcesManifestPath(repoRoot), { force: true });
    console.error(
      `\nSmoke test FAILED — deleted ${zipPath}: ${err instanceof Error ? err.message : String(err)}`,
    );
    process.exit(1);
  }
  // Record the content hashes of every watched source so the freshness
  // check can tell a real edit from an mtime-only touch (checkpoint
  // commits rewrite files without changing their content). The "passed"
  // smoke status certifies the zip for SKIP_BUILD uploads.
  writeSourcesManifest(repoRoot, "passed");
  console.log(`Sources manifest written: ${sourcesManifestPath(repoRoot)}`);

  // 6. CSP browser sweep against the freshly built zip. A broken CSP must
  // never ship in a green build: on failure the zip and manifest are
  // deleted, same as a smoke failure. Skipping (no headless Chromium, or
  // SKIP_CSP=1 for chunked shell runs) is always LOUD, never silent.
  runCspSweep();
}

function cspSkipBanner(reason: string, remedy: string) {
  const lines = [
    "!".repeat(72),
    "!!  CSP BROWSER SWEEP NOT RUN — the bundle is UNVERIFIED against CSP  !!",
    `!!  Reason: ${reason}`,
    `!!  ${remedy}`,
    "!!  Before deploying, run:",
    "!!    pnpm --filter @workspace/scripts run e2e-csp-violations",
    "!".repeat(72),
  ];
  console.warn(`\n${lines.join("\n")}\n`);
}

function runCspSweep() {
  if (process.env.SKIP_CSP === "1") {
    cspSkipBanner(
      "SKIP_CSP=1 was set.",
      "Unset SKIP_CSP or run the sweep separately.",
    );
    return;
  }
  const chromiumDir = findHeadlessChromiumDir();
  if (!chromiumDir) {
    cspSkipBanner(
      "no headless Chromium install found.",
      "Install once: PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright node scripts/node_modules/playwright-core/cli.js install chromium-headless-shell",
    );
    return;
  }
  console.log(`\nCSP browser sweep (headless Chromium at ${chromiumDir})…`);
  try {
    run(
      "pnpm",
      ["--filter", "@workspace/scripts", "run", "e2e-csp-violations", zipPath],
      { cwd: repoRoot },
    );
  } catch (err) {
    rmSync(zipPath, { force: true });
    rmSync(sourcesManifestPath(repoRoot), { force: true });
    console.error(
      `\nCSP sweep FAILED — deleted ${zipPath}: ${err instanceof Error ? err.message : String(err)}`,
    );
    process.exit(1);
  }
}

void buildAndVerify();
