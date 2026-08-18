/**
 * Local rehearsal of the live security checks (live-security-checks.ts).
 *
 * The live IONOS host is unreachable from this workspace, so this harness
 * proves the check itself works: it extracts the deployment bundle, boots
 * BOTH Node processes exactly like IONOS would (the main server and the
 * Legomena companion), puts a tiny routing reverse proxy in front of them
 * (/legomena/api → Legomena, everything else → main, mirroring the nginx
 * locations), and runs runLiveSecurityChecks through the proxy — twice:
 *
 *   1. CORRECT proxy (appends the real client address to X-Forwarded-For,
 *      like nginx's $proxy_add_x_forwarded_for): every probe must PASS.
 *   2. MISCONFIGURED proxy (passes the client-supplied X-Forwarded-For
 *      through untouched): the spoof-resistance probe must FAIL on BOTH
 *      surfaces and EVERY strict endpoint (/api/ask, /api/search,
 *      /api/lod/sparql, /legomena/api/ask AND /legomena/api/sparql) — the
 *      positive control
 *      proving the check can actually catch the misconfiguration on each
 *      nginx location and endpoint independently.
 *
 * Run: pnpm --filter @workspace/scripts exec tsx src/rehearse-live-security.ts
 */
import { execFileSync, spawn, type ChildProcess } from "node:child_process";
import { existsSync, mkdirSync, rmSync, symlinkSync } from "node:fs";
import http from "node:http";
import { createServer } from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { runLiveSecurityChecks } from "./live-security-checks";

const scriptsDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const repoRoot = path.dirname(scriptsDir);
const apiServerDir = path.join(repoRoot, "artifacts", "api-server");
const zipPath = path.join(repoRoot, "exports", "laertius-ionos.zip");

function findFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = createServer();
    srv.once("error", reject);
    srv.listen(0, "127.0.0.1", () => {
      const address = srv.address();
      if (address === null || typeof address === "string") {
        srv.close();
        reject(new Error("no port"));
        return;
      }
      const port = address.port;
      srv.close((err) => (err ? reject(err) : resolve(port)));
    });
  });
}

/** Minimal routing reverse proxy: /legomena/api → the Legomena upstream,
 * everything else → the main upstream (like the IONOS nginx locations).
 * appendXff mimics nginx's $proxy_add_x_forwarded_for; passThrough mimics
 * the misconfiguration. */
function startProxy(
  mainPort: number,
  legomenaPort: number,
  listenPort: number,
  mode: "append" | "passthrough",
): http.Server {
  const server = http.createServer((req, res) => {
    const clientIp = req.socket.remoteAddress ?? "unknown";
    const headers = { ...req.headers };
    if (mode === "append") {
      const prior = headers["x-forwarded-for"];
      headers["x-forwarded-for"] = prior ? `${String(prior)}, ${clientIp}` : clientIp;
    }
    const upstreamPort = req.url?.startsWith("/legomena/api")
      ? legomenaPort
      : mainPort;
    const upstream = http.request(
      {
        host: "127.0.0.1",
        port: upstreamPort,
        method: req.method,
        path: req.url,
        headers,
      },
      (ures) => {
        res.writeHead(ures.statusCode ?? 502, ures.headers);
        ures.pipe(res);
      },
    );
    upstream.on("error", () => {
      res.writeHead(502);
      res.end("proxy error");
    });
    req.pipe(upstream);
  });
  server.listen(listenPort, "127.0.0.1");
  return server;
}

async function waitForHealth(
  url: string,
  child: ChildProcess,
  what: string,
): Promise<void> {
  const deadline = Date.now() + 120_000;
  for (;;) {
    if (child.exitCode !== null) throw new Error(`${what} exited early`);
    try {
      const r = await fetch(url);
      if (r.status === 200) return;
    } catch {
      /* not up yet */
    }
    if (Date.now() > deadline) throw new Error(`${what} never became healthy`);
    await new Promise((r) => setTimeout(r, 1000));
  }
}

async function main(): Promise<void> {
  if (!existsSync(zipPath)) {
    throw new Error(`Bundle zip missing: ${zipPath} — build it first`);
  }
  const scratch = "/tmp/rehearse-live-security";
  rmSync(scratch, { recursive: true, force: true });
  mkdirSync(scratch, { recursive: true });
  execFileSync("unzip", ["-q", zipPath, "-d", scratch]);
  // Reuse the workspace's node_modules and model cache (same trick as the
  // bundle smoke test) so nothing downloads. The Legomena server resolves
  // its esbuild externals by walking up from legomena/server/ to the same
  // scratch-root node_modules.
  symlinkSync(path.join(apiServerDir, "node_modules"), path.join(scratch, "node_modules"));
  const modelsDir = path.join(apiServerDir, "data", "models");
  rmSync(path.join(scratch, "data", "models"), { recursive: true, force: true });
  symlinkSync(modelsDir, path.join(scratch, "data", "models"));

  const serverPort = await findFreePort();
  const child: ChildProcess = spawn(
    "node",
    ["--enable-source-maps", "server/index.mjs"],
    {
      cwd: scratch,
      env: {
        ...process.env,
        PORT: String(serverPort),
        LAERTIUS_DATA_DIR: path.join(scratch, "data"),
        SERVE_STATIC_DIR: path.join(scratch, "public"),
        // Small Ask window so each rehearsal pass stays fast; the live
        // default (30) is exercised by the bundle smoke test.
        RATE_LIMIT_RAG_MAX: "8",
      },
      stdio: ["ignore", "inherit", "inherit"],
    },
  );
  // The Legomena companion, exactly like IONOS runs it (its own process,
  // its own port, same bundle dir layout).
  const legomenaPort = await findFreePort();
  const legomenaChild: ChildProcess = spawn(
    "node",
    ["--enable-source-maps", "server/index.mjs"],
    {
      cwd: path.join(scratch, "legomena"),
      env: {
        ...process.env,
        PORT: String(legomenaPort),
        ...(existsSync(modelsDir) ? { LEGOMENA_MODEL_CACHE: modelsDir } : {}),
        // Same small window as the main server so the burst probes stay
        // fast on both surfaces.
        RATE_LIMIT_RAG_MAX: "8",
      },
      stdio: ["ignore", "inherit", "inherit"],
    },
  );
  const cleanup = () => {
    for (const c of [child, legomenaChild]) {
      try {
        c.kill("SIGKILL");
      } catch {
        /* already gone */
      }
    }
  };
  process.on("exit", cleanup);

  await Promise.all([
    waitForHealth(
      `http://127.0.0.1:${serverPort}/api/healthz`,
      child,
      "main server",
    ),
    waitForHealth(
      `http://127.0.0.1:${legomenaPort}/legomena/api/healthz`,
      legomenaChild,
      "Legomena server",
    ),
  ]);

  let overallFailures = 0;

  // Pass 1: correct proxy — everything must pass on both surfaces.
  {
    const proxyPort = await findFreePort();
    const proxy = startProxy(serverPort, legomenaPort, proxyPort, "append");
    console.log("\n=== Pass 1: correctly configured proxy (appends XFF) ===");
    let failures = 0;
    await runLiveSecurityChecks(`http://127.0.0.1:${proxyPort}`, {
      ok: (m) => console.log(`  ✓ ${m}`),
      fail: (m) => {
        failures += 1;
        console.error(`  ✗ ${m}`);
      },
      log: (m) => console.log(m),
    });
    proxy.close();
    if (failures > 0) {
      overallFailures += failures;
      console.error(`Pass 1 FAILED: ${failures} probe(s) failed behind a CORRECT proxy`);
    } else {
      console.log("Pass 1 OK: all probes pass on both surfaces behind a correct proxy");
    }
  }

  // The Ask windows from pass 1 belong to buckets keyed on 127.0.0.1 via
  // appended XFF; pass 2 (passthrough, no XFF appended for plain requests)
  // keys on the raw socket address, which trust proxy=1 resolves the same
  // way — so wait out the window to keep the passes independent.
  console.log("\n(waiting 61s for the rate-limit windows to reset…)");
  await new Promise((r) => setTimeout(r, 61_000));

  // Pass 2: misconfigured proxy — the spoof probe must FAIL on BOTH
  // surfaces (positive control that the check detects the passthrough
  // misconfiguration on each nginx location independently).
  {
    const proxyPort = await findFreePort();
    const proxy = startProxy(serverPort, legomenaPort, proxyPort, "passthrough");
    console.log("\n=== Pass 2: MISCONFIGURED proxy (passes client XFF through) ===");
    const failed: string[] = [];
    await runLiveSecurityChecks(`http://127.0.0.1:${proxyPort}`, {
      ok: (m) => console.log(`  ✓ ${m}`),
      fail: (m) => {
        failed.push(m);
        console.error(`  ✗ (expected on this pass?) ${m}`);
      },
      log: (m) => console.log(m),
    });
    proxy.close();
    for (const strictPath of [
      "/api/ask",
      "/api/search",
      "/api/lod/sparql",
      "/legomena/api/ask",
      "/legomena/api/sparql",
    ]) {
      const spoofCaught = failed.some(
        (m) => m.includes("forged X-Forwarded-For") && m.includes(`POST ${strictPath} `),
      );
      if (spoofCaught) {
        console.log(
          `Pass 2 OK (${strictPath}): the spoof-resistance probe correctly ` +
            `FAILS behind a passthrough proxy — the check can catch the ` +
            `real misconfiguration on this location`,
        );
      } else {
        overallFailures += 1;
        console.error(
          `Pass 2 FAILED (${strictPath}): the spoof-resistance probe did ` +
            `NOT flag the passthrough proxy — the check is vacuous for ` +
            `this location`,
        );
      }
    }
  }

  cleanup();
  if (overallFailures > 0) {
    console.error(`\nREHEARSAL FAILED (${overallFailures} problem(s))`);
    process.exit(1);
  }
  console.log("\nREHEARSAL PASSED");
}

main().catch((err) => {
  console.error(String(err instanceof Error ? (err.stack ?? err.message) : err));
  process.exit(1);
});
