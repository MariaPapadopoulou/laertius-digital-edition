/**
 * Real-browser check that the CodeMirror SPARQL editor actually loads on
 * the bundled production site.
 *
 * The IONOS bundle smoke test (smoke-ionos-bundle.ts) only checks API
 * endpoints and static file serving; it never executes the frontend
 * JavaScript. The CodeMirror 6 editor in sparql-playground.tsx could fail
 * at runtime in the production build (a chunk-splitting or
 * extension-loading issue) while the smoke test stays green. This script
 * closes that gap:
 *
 * 1. Extracts exports/laertius-ionos.zip to a scratch dir and boots
 *    server/index.mjs exactly the way IONOS would (PORT,
 *    LAERTIUS_DATA_DIR, SERVE_STATIC_DIR), with the same node_modules and
 *    cached-model symlinks the smoke test uses.
 * 2. Runs the full e2e-sparql-playground suite against that server via
 *    E2E_BASE_URL, so the production build must pass exactly the checks
 *    the dev build passes: the editor mounts with the example query
 *    prefilled, renders tokenised highlighted spans, accepts typed input
 *    (the prefix autocomplete scenario types into the editor through the
 *    real keyboard), running a query renders the results table, a
 *    malformed query shows the inline error, and the shortcut/hint
 *    behaviour holds.
 * 3. As a belt-and-braces mount check independent of the shared suite,
 *    it also asserts directly that the production page carries a mounted
 *    .cm-editor element with a contenteditable .cm-content, and that no
 *    page error or failed chunk request occurred while loading
 *    /competency?q=stoa-members and opening the playground.
 *
 * Requirements: exports/laertius-ionos.zip must exist (run
 * build-ionos-bundle first), and the playwright-core headless Chromium
 * shell must be installed once:
 *   PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright \
 *     node scripts/node_modules/playwright-core/cli.js install chromium-headless-shell
 *
 * Run: pnpm --filter @workspace/scripts run e2e-ionos-sparql-editor
 *
 * Registered in the validation gate (2026-08-05 triage); it needs the zip
 * (kept fresh by check-bundle-freshness) and a real browser. Also run it
 * manually after touching sparql-playground.tsx, the frontend build config
 * (vite.config.ts chunking), or rebuilding the bundle.
 */
import { spawn, execFileSync, type ChildProcess } from "node:child_process";
import { existsSync, mkdirSync, rmSync, symlinkSync } from "node:fs";
import { createServer } from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

// playwright-core resolves its browser registry at module import time from
// PLAYWRIGHT_BROWSERS_PATH; set it BEFORE importing playwright-core.
import "./lib/playwright-browsers-path";

const { chromium } = await import("playwright-core");
const { attachPageGuard } = await import("./lib/e2e-page-guard");

const scriptsDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const repoRoot = path.dirname(scriptsDir);
const apiServerDir = path.join(repoRoot, "artifacts", "api-server");
const zipPath =
  process.argv[2] ?? path.join(repoRoot, "exports", "laertius-ionos.zip");

const HEALTH_TIMEOUT_MS = 120_000;

function findFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = createServer();
    srv.once("error", reject);
    srv.listen(0, "127.0.0.1", () => {
      const address = srv.address();
      if (address === null || typeof address === "string") {
        srv.close();
        reject(new Error("Could not determine a free port"));
        return;
      }
      const port = address.port;
      srv.close((err) => (err ? reject(err) : resolve(port)));
    });
  });
}

async function waitForHealth(base: string, child: ChildProcess): Promise<void> {
  const deadline = Date.now() + HEALTH_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`Server process exited early with code ${child.exitCode}`);
    }
    try {
      const res = await fetch(`${base}/api/healthz`);
      if (res.status === 200) return;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(
    `Bundled server did not answer /api/healthz within ${HEALTH_TIMEOUT_MS / 1000}s`,
  );
}

function stopServer(child: ChildProcess): Promise<void> {
  return new Promise((resolve) => {
    if (child.exitCode !== null) {
      resolve();
      return;
    }
    const killTimer = setTimeout(() => child.kill("SIGKILL"), 5000);
    child.once("exit", () => {
      clearTimeout(killTimer);
      resolve();
    });
    child.kill("SIGTERM");
  });
}

/**
 * Direct mount check against the production build, independent of the
 * shared playground suite: /about must load with zero page errors and
 * zero failed asset requests, and opening the first playground must
 * produce a mounted .cm-editor with a contenteditable .cm-content.
 */
async function checkEditorMounts(base: string): Promise<void> {
  console.log(
    "Direct check: CodeMirror mounts on the production /competency page",
  );
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    // Fail fast with the failing URL/status instead of an opaque selector
    // timeout when the bundled site itself fails to boot.
    const guard = attachPageGuard(page);
    const pageErrors: string[] = [];
    const failedRequests: string[] = [];
    page.on("pageerror", (err) => pageErrors.push(String(err)));
    page.on("requestfailed", (req) => {
      failedRequests.push(`${req.url()} (${req.failure()?.errorText ?? "?"})`);
    });
    page.on("response", (res) => {
      if (res.status() >= 400) {
        failedRequests.push(`${res.url()} (HTTP ${res.status()})`);
      }
    });

    await page.goto(`${base}/competency?q=stoa-members`, {
      waitUntil: "networkidle",
    });
    guard.assertPageLoaded();
    const toggle = page.locator('button:has-text("SPARQL query")').first();
    await guard.guarded(toggle.waitFor({ timeout: 15000 }));
    await toggle.click();

    const cmEditor = page.locator(
      '[data-testid="sparql-query-editor"] .cm-editor',
    );
    await guard.guarded(cmEditor.first().waitFor({ timeout: 10000 }));
    console.log("  ok: .cm-editor element is present after opening the playground");

    const editable = await page
      .locator('[data-testid="sparql-query-editor"] .cm-content')
      .first()
      .getAttribute("contenteditable");
    if (editable !== "true") {
      throw new Error(
        `.cm-content is not contenteditable (got ${JSON.stringify(editable)})`,
      );
    }
    console.log("  ok: .cm-content is contenteditable (editor accepts input)");

    // Type into the editor through the real keyboard and assert the
    // document changed: a mounted-but-dead view would swallow this.
    await page.locator('[data-testid="sparql-query-editor"] .cm-content').first().click();
    await page.keyboard.press("End");
    await page.keyboard.type(" #typed");
    const containsTyped = await page.evaluate(() => {
      const el = document.querySelector('[data-testid="sparql-query-editor"]');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return ((el as any)?.__cmView?.state?.doc?.toString() ?? "").includes(
        "#typed",
      );
    });
    if (!containsTyped) {
      throw new Error("Typed keyboard input did not reach the CodeMirror document");
    }
    console.log("  ok: typed keyboard input reaches the CodeMirror document");

    if (pageErrors.length > 0) {
      throw new Error(`Page errors on the production build:\n  ${pageErrors.join("\n  ")}`);
    }
    if (failedRequests.length > 0) {
      throw new Error(
        `Failed asset/API requests on the production build:\n  ${failedRequests.join("\n  ")}`,
      );
    }
    console.log("  ok: no page errors and no failed requests while loading the editor");
  } finally {
    await browser.close();
  }
}

/** Run the full shared playground suite against the bundled server. */
function runSharedSuite(base: string): void {
  console.log("\nRunning the full e2e-sparql-playground suite against the bundle");
  execFileSync(
    process.execPath,
    [
      path.join(scriptsDir, "node_modules", "tsx", "dist", "cli.mjs"),
      path.join(scriptsDir, "src", "e2e-sparql-playground.ts"),
    ],
    {
      stdio: "inherit",
      env: { ...process.env, E2E_BASE_URL: base },
    },
  );
}

async function main() {
  if (!existsSync(zipPath)) {
    throw new Error(
      `Bundle not found: ${zipPath} (run build-ionos-bundle first)`,
    );
  }

  const scratchDir = path.join(repoRoot, "exports", ".ionos-e2e-sparql");
  rmSync(scratchDir, { recursive: true, force: true });
  mkdirSync(scratchDir, { recursive: true });

  let child: ChildProcess | undefined;
  try {
    console.log(`Booting bundle: ${zipPath}`);
    execFileSync("unzip", ["-q", zipPath, "-d", scratchDir]);

    // Same symlinks the smoke test uses: @huggingface/transformers is an
    // esbuild external, and the cached model avoids a ~130 MB download.
    symlinkSync(
      path.join(apiServerDir, "node_modules"),
      path.join(scratchDir, "node_modules"),
      "dir",
    );
    const modelsDir = path.join(apiServerDir, "data", "models");
    if (existsSync(modelsDir)) {
      symlinkSync(modelsDir, path.join(scratchDir, "data", "models"), "dir");
    }

    const port = await findFreePort();
    const base = `http://127.0.0.1:${port}`;
    child = spawn("node", ["server/index.mjs"], {
      cwd: scratchDir,
      env: {
        ...process.env,
        NODE_ENV: "production",
        PORT: String(port),
        LAERTIUS_DATA_DIR: path.join(scratchDir, "data"),
        SERVE_STATIC_DIR: path.join(scratchDir, "public"),
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let serverOutput = "";
    child.stdout?.on("data", (c: Buffer) => (serverOutput += c.toString()));
    child.stderr?.on("data", (c: Buffer) => (serverOutput += c.toString()));

    try {
      await waitForHealth(base, child);
      console.log(`Bundled server is up at ${base}\n`);
      await checkEditorMounts(base);
      runSharedSuite(base);
    } catch (err) {
      if (serverOutput.trim().length > 0) {
        console.error("\n--- bundled server output ---");
        console.error(serverOutput.slice(-4000));
        console.error("--- end server output ---");
      }
      throw err;
    }

    console.log(
      "\nThe CodeMirror SPARQL editor loads and works on the bundled production site.",
    );
  } finally {
    if (child) await stopServer(child);
    rmSync(scratchDir, { recursive: true, force: true });
  }
}

await main().catch((err) => {
  console.error(
    `\nIONOS SPARQL editor e2e FAILED: ${err instanceof Error ? err.message : String(err)}`,
  );
  process.exit(1);
});
