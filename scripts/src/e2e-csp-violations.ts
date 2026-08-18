/// <reference lib="dom" />
// The in-page callbacks (page.evaluate / addInitScript payloads) run in the
// browser, so this Node-side script needs the DOM lib for their types.
//
// Real-browser check that the production CSP never silently blocks the app.
//
// The CSP hashes the inline theme-bootstrap script in the built index.html
// at server startup (inlineScriptHashes in api-server/src/lib/security.ts),
// so today's inline script keeps working. But an inline script added
// anywhere else — injected into a page by a component, or an inline event
// handler emitted by a future dependency — would be blocked in production
// while working fine in dev (the Vite dev server sends no CSP), and the
// failure would be invisible until someone checks the live browser console.
//
// This script boots the IONOS bundle locally (main server + Legomena server
// + the same routing proxy the other bundle e2e uses), loads key pages in
// headless Chromium WITH the real CSP header, and fails on any CSP
// violation reported via the securitypolicyviolation event or the console:
//   - /                 (home — exercises the hashed theme-bootstrap script)
//   - /section/1.1.22   (a passage page)
//   - /map              (OSM tiles must be allowed by img-src)
//   - /legomena/        (a /legomena/* page, served by the merged SPA)
//   - /legomena/graph   (deep link through the SPA fallback)
//
// Guards against vacuous greens:
//   - asserts the Content-Security-Policy header is actually present on
//     every document response (no header → nothing to violate → useless run)
//   - positive control: injects a fresh inline <script> into the home page
//     and asserts the securitypolicyviolation listener really fires, so a
//     broken listener hookup cannot pass the whole sweep
//
// Requirements: exports/laertius-ionos.zip must exist (run
// build-ionos-bundle first), and the playwright-core headless Chromium
// shell must be installed once:
//   PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright \
//     node scripts/node_modules/playwright-core/cli.js install chromium-headless-shell
//
// Run: pnpm --filter @workspace/scripts run e2e-csp-violations
import { spawn, execFileSync, type ChildProcess } from "node:child_process";
import { existsSync, mkdirSync, rmSync, symlinkSync } from "node:fs";
import { createServer } from "node:net";
import { createServer as createHttpServer, type Server } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { checkBundleFreshness } from "./ionos-bundle-contract";

// playwright-core resolves its browser registry at module import time from
// PLAYWRIGHT_BROWSERS_PATH; the shared bootstrap sets it BEFORE
// playwright-core is dynamically imported below.
import "./lib/playwright-browsers-path";

const { chromium } = await import("playwright-core");
type Page = Awaited<
  ReturnType<Awaited<ReturnType<typeof chromium.launch>>["newPage"]>
>;

const scriptsDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const repoRoot = path.dirname(scriptsDir);
const apiServerDir = path.join(repoRoot, "artifacts", "api-server");
const zipPath =
  process.argv[2] ?? path.join(repoRoot, "exports", "laertius-ionos.zip");

const HEALTH_TIMEOUT_MS = 120_000;

/** Pages the sweep must cover (path + a human label). */
const PAGES: { path: string; label: string }[] = [
  { path: "/", label: "home" },
  { path: "/section/1.1.22", label: "passage page" },
  { path: "/map", label: "Map page (OSM tiles)" },
  { path: "/legomena/", label: "Legomena Ask page" },
  { path: "/legomena/graph", label: "Legomena graph deep link" },
];

/** Serialized shape of one securitypolicyviolation event, as collected in-page. */
interface CspViolation {
  directive: string;
  blockedURI: string;
  sourceFile: string;
  line: number;
  sample: string;
}

let failures = 0;
function check(label: string, ok: boolean, detail?: string) {
  if (ok) {
    console.log(`  ok: ${label}`);
  } else {
    failures++;
    console.error(`  FAIL: ${label}${detail ? ` (${detail})` : ""}`);
  }
}

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

async function waitForHealth(
  base: string,
  child: ChildProcess,
  healthPath: string,
  name: string,
): Promise<void> {
  const deadline = Date.now() + HEALTH_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`${name} exited early with code ${child.exitCode}`);
    }
    try {
      const res = await fetch(`${base}${healthPath}`);
      if (res.status === 200) return;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(
    `${name} did not answer ${healthPath} within ${HEALTH_TIMEOUT_MS / 1000}s`,
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

async function main() {
  if (!existsSync(zipPath)) {
    throw new Error(
      `Bundle not found: ${zipPath} (run build-ionos-bundle first)`,
    );
  }

  // Fail fast on an outdated bundle: a stale zip's CSP/asset behavior says
  // nothing about the current code.
  {
    const { error, notes } = checkBundleFreshness(repoRoot, zipPath);
    for (const note of notes) console.log(note);
    if (error) {
      throw new Error(
        `Refusing to run the CSP e2e against an outdated bundle.\n${error}`,
      );
    }
  }

  const scratchDir = path.join(repoRoot, "exports", ".ionos-e2e-csp");
  rmSync(scratchDir, { recursive: true, force: true });
  mkdirSync(scratchDir, { recursive: true });

  let child: ChildProcess | undefined;
  let mainChild: ChildProcess | undefined;
  let proxy: Server | undefined;
  try {
    console.log(`Booting bundle for the CSP sweep: ${zipPath}`);
    execFileSync("unzip", ["-q", zipPath, "-d", scratchDir]);

    // Same symlinks the bundle smoke test uses: esbuild externals
    // (@huggingface/transformers, oxigraph) resolve from the scratch root's
    // node_modules, and the model cache avoids a ~130 MB re-download.
    symlinkSync(
      path.join(apiServerDir, "node_modules"),
      path.join(scratchDir, "node_modules"),
      "dir",
    );
    const modelsDir = path.join(apiServerDir, "data", "models");
    if (existsSync(modelsDir)) {
      symlinkSync(modelsDir, path.join(scratchDir, "data", "models"), "dir");
    }

    // Production routing: /legomena/api → Legomena server, everything else
    // (including /legomena/* pages) → main server. Reproduce it with the
    // same tiny proxy the Legomena bundle e2e uses, so every document
    // arrives with the REAL production CSP header.
    const legomenaDir = path.join(scratchDir, "legomena");
    const legomenaPort = await findFreePort();
    const legomenaBase = `http://127.0.0.1:${legomenaPort}`;
    child = spawn("node", ["server/index.mjs"], {
      cwd: legomenaDir,
      env: {
        ...process.env,
        NODE_ENV: "production",
        PORT: String(legomenaPort),
        ...(existsSync(modelsDir) ? { LEGOMENA_MODEL_CACHE: modelsDir } : {}),
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let serverOutput = "";
    child.stdout?.on("data", (c: Buffer) => (serverOutput += c.toString()));
    child.stderr?.on("data", (c: Buffer) => (serverOutput += c.toString()));

    const mainPort = await findFreePort();
    mainChild = spawn("node", ["server/index.mjs"], {
      cwd: scratchDir,
      env: {
        ...process.env,
        NODE_ENV: "production",
        PORT: String(mainPort),
        LAERTIUS_DATA_DIR: path.join(scratchDir, "data"),
        SERVE_STATIC_DIR: path.join(scratchDir, "public"),
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let mainOutput = "";
    mainChild.stdout?.on("data", (c: Buffer) => (mainOutput += c.toString()));
    mainChild.stderr?.on("data", (c: Buffer) => (mainOutput += c.toString()));

    const proxyPort = await findFreePort();
    const base = `http://127.0.0.1:${proxyPort}`;
    proxy = createHttpServer(async (req, res) => {
      const target = req.url?.startsWith("/legomena/api")
        ? legomenaBase
        : `http://127.0.0.1:${mainPort}`;
      try {
        const chunks: Buffer[] = [];
        for await (const chunk of req) chunks.push(chunk as Buffer);
        const upstream = await fetch(`${target}${req.url}`, {
          method: req.method,
          headers: Object.fromEntries(
            Object.entries(req.headers).filter(
              ([k, v]) => typeof v === "string" && k !== "host",
            ) as [string, string][],
          ),
          body: ["GET", "HEAD"].includes(req.method ?? "GET")
            ? undefined
            : Buffer.concat(chunks),
          redirect: "manual",
        });
        const headers: Record<string, string> = {};
        upstream.headers.forEach((v, k) => {
          if (!["content-encoding", "transfer-encoding"].includes(k)) {
            headers[k] = v;
          }
        });
        const body = Buffer.from(await upstream.arrayBuffer());
        res.writeHead(upstream.status, headers);
        res.end(body);
      } catch (err) {
        res.writeHead(502);
        res.end(String(err));
      }
    });
    await new Promise<void>((resolve) =>
      proxy!.listen(proxyPort, "127.0.0.1", resolve),
    );

    try {
      await waitForHealth(
        legomenaBase,
        child,
        "/legomena/api/healthz",
        "Legomena server",
      );
      await waitForHealth(
        `http://127.0.0.1:${mainPort}`,
        mainChild,
        "/api/healthz",
        "Main server",
      );
      console.log(`Servers up; proxy at ${base}\n`);
      await runBrowserChecks(base);
    } catch (err) {
      if (serverOutput.trim().length > 0) {
        console.error("\n--- legomena server output ---");
        console.error(serverOutput.slice(-4000));
        console.error("--- end legomena server output ---");
      }
      if (mainOutput.trim().length > 0) {
        console.error("\n--- main server output ---");
        console.error(mainOutput.slice(-4000));
        console.error("--- end main server output ---");
      }
      throw err;
    }
  } finally {
    if (proxy) await new Promise((r) => proxy!.close(r));
    if (child) await stopServer(child);
    if (mainChild) await stopServer(mainChild);
    rmSync(scratchDir, { recursive: true, force: true });
  }

  if (failures > 0) {
    throw new Error(`${failures} check(s) failed`);
  }
  console.log(
    "\nNo CSP violations on any checked page; the violation listener itself was proven live by the positive control.",
  );
}

async function runBrowserChecks(base: string): Promise<void> {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({
      viewport: { width: 1280, height: 720 },
    });

    // Collect every securitypolicyviolation event from the very first
    // script of every document. MUST be a string, not a function: under
    // tsx, function-form init scripts throw `__name is not defined`
    // in-page and silently never install the listener.
    await page.addInitScript(`
      window.__cspViolations = [];
      document.addEventListener("securitypolicyviolation", (e) => {
        window.__cspViolations.push({
          directive: e.violatedDirective || e.effectiveDirective || "",
          blockedURI: e.blockedURI || "",
          sourceFile: e.sourceFile || "",
          line: e.lineNumber || 0,
          sample: (e.sample || "").slice(0, 120),
        });
      });
    `);

    // Belt and braces: Chromium also reports CSP refusals on the console.
    const cspConsoleMessages: string[] = [];
    page.on("console", (msg) => {
      const text = msg.text();
      if (/content security policy|refused to (execute|load|apply|connect|frame)/i.test(text)) {
        cspConsoleMessages.push(text);
      }
    });
    const pageErrors: string[] = [];
    page.on("pageerror", (err) => pageErrors.push(String(err)));

    const readViolations = () =>
      page.evaluate(
        () =>
          (window as unknown as { __cspViolations: CspViolation[] })
            .__cspViolations,
      );

    for (const { path: pagePath, label } of PAGES) {
      console.log(`Page: ${pagePath} (${label})`);
      cspConsoleMessages.length = 0;
      const response = await page.goto(`${base}${pagePath}`, {
        waitUntil: "networkidle",
        timeout: 60_000,
      });
      check(
        "document responds 200",
        response !== null && response.status() === 200,
        `status=${response?.status()}`,
      );
      // Without the header the whole sweep is vacuous — nothing can violate
      // a policy that was never delivered.
      const cspHeader = response?.headers()["content-security-policy"] ?? "";
      check(
        "Content-Security-Policy header is present on the document",
        cspHeader.includes("script-src"),
        `header=${JSON.stringify(cspHeader.slice(0, 120))}`,
      );
      // Give late async work (tiles, lazy chunks, deferred fetches) a
      // moment to trip the policy before reading the collector.
      await page.waitForTimeout(1500);
      const violations = await readViolations();
      check(
        "no securitypolicyviolation events",
        violations.length === 0,
        violations
          .map(
            (v) =>
              `${v.directive}: ${v.blockedURI || v.sample || "(inline)"} @ ${v.sourceFile}:${v.line}`,
          )
          .join("; "),
      );
      check(
        "no CSP refusals on the console",
        cspConsoleMessages.length === 0,
        cspConsoleMessages.join("; "),
      );

      if (pagePath === "/map") {
        // The Map page's whole reason for being here: OSM tiles must be
        // allowed by img-src. A network-level tile failure (no internet in
        // the sandbox) is NOT a CSP failure — the violation checks above
        // already catch an img-src block — so tile traffic is only
        // reported, never asserted.
        const tileCount = await page.evaluate(
          () =>
            performance
              .getEntriesByType("resource")
              .filter((e) => e.name.includes("tile.openstreetmap.org")).length,
        );
        console.log(`  note: ${tileCount} OSM tile request(s) observed`);
      }
    }

    // Positive control: prove the listener plumbing actually works by
    // injecting a brand-new inline script (not covered by any hash) and
    // requiring a script-src violation to be reported. Without this, a
    // broken addInitScript or listener would green-light every page above.
    console.log("Positive control: unhashed inline script must be blocked");
    await page.goto(`${base}/`, { waitUntil: "networkidle", timeout: 60_000 });
    await page.evaluate(() => {
      (window as unknown as { __cspCanary?: boolean }).__cspCanary = false;
      const s = document.createElement("script");
      s.textContent =
        "(window).__cspCanary = true; // e2e-csp positive control";
      document.head.appendChild(s);
    });
    await page.waitForTimeout(500);
    const canaryRan = await page.evaluate(
      () => (window as unknown as { __cspCanary?: boolean }).__cspCanary,
    );
    const controlViolations = await readViolations();
    check(
      "injected inline script did NOT execute",
      canaryRan === false,
      "the CSP allowed an unhashed inline script to run",
    );
    check(
      "securitypolicyviolation event fired for the injected script",
      controlViolations.some((v) => v.directive.startsWith("script-src")),
      `violations=${JSON.stringify(controlViolations)}`,
    );

    check(
      "no page errors anywhere",
      pageErrors.length === 0,
      pageErrors.join("; "),
    );
  } finally {
    await browser.close();
  }
}

await main().catch((err) => {
  console.error(
    `\nCSP e2e FAILED: ${err instanceof Error ? err.message : String(err)}`,
  );
  process.exit(1);
});
