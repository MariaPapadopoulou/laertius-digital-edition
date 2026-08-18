/**
 * Prove the IONOS bundle really works under the /Laertius SUBPATH.
 *
 * The live site deploys at https://humanisticadigitalia.eu/Laertius — a
 * subpath, not the root — with nginx stripping the prefix before the Node
 * apps see the request. The regular smoke test boots the bundle at the
 * root only, so subpath-specific breakage (asset URLs missing the prefix,
 * SPA deep links, the Legomena API prefix routing, LOD self-links minted
 * against the wrong base URI) would surface only on the live server —
 * which is not reachable from this workspace.
 *
 * This script therefore mimics the production layout locally, in-process:
 *   - extracts exports/laertius-ionos.zip (freshness-gated first)
 *   - boots the main server and the Legomena server the way the bundle
 *     README prescribes
 *   - fronts them with a local reverse proxy that reproduces the nginx
 *     config from the README exactly:
 *       location = /Laertius              → 301 /Laertius/
 *       location /Laertius/legomena/api/  → legomena server (prefix stripped)
 *       location /Laertius/               → main server (prefix stripped)
 *       location = /.well-known/void      → main server (unstripped)
 *   - probes THROUGH the proxy only, as a live visitor would:
 *       · GET /Laertius/                → HTML shell whose asset URLs carry
 *         the /Laertius prefix AND resolve through the proxy
 *       · GET /Laertius/graph (deep SPA route) → the same app shell
 *       · GET /Laertius/api/healthz     → 200
 *       · GET /Laertius/legomena/api/healthz → the Legomena health JSON
 *         (not the SPA catch-all) with storeReady=true
 *       · GET /Laertius/api/lod/void.ttl and a per-section JSON-LD export
 *         → self-links minted under the /Laertius base URI
 *       · GET /.well-known/void         → redirect to the /api/lod VoID doc
 *
 * Run:
 *   pnpm --filter @workspace/scripts run check-ionos-subpath
 */
import { spawn, type ChildProcess } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, symlinkSync } from "node:fs";
import http from "node:http";
import { tmpdir } from "node:os";
import { createServer } from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

import { checkBundleFreshness } from "./ionos-bundle-contract";

const scriptsDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const repoRoot = path.dirname(scriptsDir);
const apiServerDir = path.join(repoRoot, "artifacts", "api-server");
const zipPath = path.join(repoRoot, "exports", "laertius-ionos.zip");

const PREFIX = "/Laertius";
const LIVE_BASE_URI = "https://humanisticadigitalia.eu/Laertius";
const HEALTH_TIMEOUT_MS = 120_000;

let failures = 0;
function ok(msg: string): void {
  console.log(`  ✓ ${msg}`);
}
function fail(msg: string): void {
  failures += 1;
  console.error(`  ✗ ${msg}`);
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

async function waitFor(url: string, child: ChildProcess): Promise<void> {
  const deadline = Date.now() + HEALTH_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`Server process exited early with code ${child.exitCode}`);
    }
    try {
      const res = await fetch(url);
      if (res.status === 200) return;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`Server did not answer ${url} within ${HEALTH_TIMEOUT_MS / 1000}s`);
}

/**
 * A tiny reverse proxy reproducing the production nginx layout. Longest
 * (most specific) location first, exactly like nginx's prefix matching.
 */
function startProxy(
  port: number,
  mainPort: number,
  legomenaPort: number,
): http.Server {
  const server = http.createServer((req, res) => {
    const url = req.url ?? "/";
    let target: { port: number; path: string } | null = null;
    if (url === PREFIX) {
      res.writeHead(301, { location: `${PREFIX}/` });
      res.end();
      return;
    }
    if (url.startsWith(`${PREFIX}/legomena/api`)) {
      // nginx: location /Laertius/legomena/api/ { proxy_pass http://…:3001/legomena/api/; }
      target = { port: legomenaPort, path: url.slice(PREFIX.length) };
    } else if (url.startsWith(`${PREFIX}/`)) {
      // nginx: location /Laertius/ { proxy_pass http://…:3000/; } (prefix stripped)
      target = { port: mainPort, path: url.slice(PREFIX.length) || "/" };
    } else if (url === "/.well-known/void") {
      target = { port: mainPort, path: url };
    }
    if (!target) {
      res.writeHead(404, { "content-type": "text/plain" });
      res.end("outside the /Laertius subpath");
      return;
    }
    const upstream = http.request(
      {
        host: "127.0.0.1",
        port: target.port,
        path: target.path,
        method: req.method,
        headers: { ...req.headers, host: `127.0.0.1:${port}` },
      },
      (up) => {
        res.writeHead(up.statusCode ?? 502, up.headers);
        up.pipe(res);
      },
    );
    upstream.on("error", () => {
      res.writeHead(502);
      res.end();
    });
    req.pipe(upstream);
  });
  server.listen(port, "127.0.0.1");
  return server;
}

async function main(): Promise<void> {
  console.log("Subpath deployment check (mimics the production nginx layout)\n");

  console.log("Local bundle freshness (precondition):");
  const freshness = checkBundleFreshness(repoRoot, zipPath);
  if (freshness.error) {
    console.error(
      `  ✗ The LOCAL bundle is stale — rebuild it first:\n` +
        freshness.error
          .split("\n")
          .map((l) => `    ${l}`)
          .join("\n"),
    );
    process.exit(1);
  }
  ok("exports/laertius-ionos.zip is fresh against all content sources");

  const work = mkdtempSync(path.join(tmpdir(), "ionos-subpath-"));
  const appDir = path.join(work, "app");
  execFileSync("unzip", ["-q", zipPath, "-d", appDir]);
  // Same shortcuts as the smoke test: reuse the workspace's node_modules
  // (externalized native deps) and the downloaded embedding-model cache.
  symlinkSync(path.join(apiServerDir, "node_modules"), path.join(appDir, "node_modules"));
  const modelsLink = path.join(appDir, "data", "models");
  if (existsSync(path.join(apiServerDir, "data", "models"))) {
    rmSync(modelsLink, { recursive: true, force: true });
    symlinkSync(path.join(apiServerDir, "data", "models"), modelsLink);
  }

  const [mainPort, legomenaPort, proxyPort] = await Promise.all([
    findFreePort(),
    findFreePort(),
    findFreePort(),
  ]);

  const mainChild = spawn("node", ["--enable-source-maps", "server/index.mjs"], {
    cwd: appDir,
    env: {
      ...process.env,
      PORT: String(mainPort),
      LAERTIUS_DATA_DIR: path.join(appDir, "data"),
      SERVE_STATIC_DIR: path.join(appDir, "public"),
      // Deliberately NOT set: LOD_BASE_URI. The check must prove the
      // bundle's DEFAULT mints /Laertius self-links, as the README's run
      // command relies on that default.
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  const legomenaChild = spawn(
    "node",
    ["--enable-source-maps", "server/index.mjs"],
    {
      cwd: path.join(appDir, "legomena"),
      env: {
        ...process.env,
        PORT: String(legomenaPort),
        LEGOMENA_MODEL_CACHE: path.join(appDir, "data", "models"),
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  let mainLog = "";
  let legomenaLog = "";
  mainChild.stdout?.on("data", (d: Buffer) => (mainLog += d.toString()));
  mainChild.stderr?.on("data", (d: Buffer) => (mainLog += d.toString()));
  legomenaChild.stdout?.on("data", (d: Buffer) => (legomenaLog += d.toString()));
  legomenaChild.stderr?.on("data", (d: Buffer) => (legomenaLog += d.toString()));

  let proxy: http.Server | null = null;
  try {
    await waitFor(`http://127.0.0.1:${mainPort}/api/healthz`, mainChild);
    await waitFor(
      `http://127.0.0.1:${legomenaPort}/legomena/api/healthz`,
      legomenaChild,
    );
    proxy = startProxy(proxyPort, mainPort, legomenaPort);
    const origin = `http://127.0.0.1:${proxyPort}`;

    // 1. Bare /Laertius redirects to /Laertius/ (nginx `location = /Laertius`).
    console.log("\nSubpath entry:");
    const bare = await fetch(`${origin}${PREFIX}`, { redirect: "manual" });
    if (bare.status === 301 && bare.headers.get("location") === `${PREFIX}/`) {
      ok(`GET ${PREFIX} → 301 ${PREFIX}/`);
    } else {
      fail(
        `GET ${PREFIX} → ${bare.status} location=${String(bare.headers.get("location"))} (expected 301 ${PREFIX}/)`,
      );
    }

    // 2. Frontend shell under the prefix: asset URLs must carry /Laertius
    // and resolve through the proxy.
    console.log("\nFrontend under the prefix:");
    const home = await fetch(`${origin}${PREFIX}/`);
    const homeHtml = await home.text();
    if (home.status !== 200 || !/<div id="root">/.test(homeHtml)) {
      fail(`GET ${PREFIX}/ → ${home.status} (expected the 200 app shell)`);
    } else {
      ok(`GET ${PREFIX}/ → 200 app shell`);
      const assetRefs = [
        ...homeHtml.matchAll(/(?:src|href)="(\/[^"]+)"/g),
      ].map((m) => m[1] as string);
      const unprefixed = assetRefs.filter((r) => !r.startsWith(`${PREFIX}/`));
      if (assetRefs.length === 0) {
        fail(`GET ${PREFIX}/: the shell references no root-absolute URLs — nothing to verify`);
      } else if (unprefixed.length > 0) {
        fail(
          `GET ${PREFIX}/: shell URLs missing the ${PREFIX} prefix (would 404 on the live site): ${unprefixed.join(", ")}`,
        );
      } else {
        let resolved = 0;
        for (const ref of assetRefs) {
          const res = await fetch(`${origin}${ref}`);
          if (res.status === 200) resolved += 1;
          else fail(`shell URL ${ref} → ${res.status} through the proxy`);
        }
        if (resolved === assetRefs.length) {
          ok(
            `all ${assetRefs.length} root-absolute shell URL(s) carry ${PREFIX} and resolve through the proxy`,
          );
        }
      }
    }

    // 3. Deep SPA route: the server must fall back to the shell so a
    // visitor can land directly on an inner page.
    const deep = await fetch(`${origin}${PREFIX}/graph`);
    const deepHtml = await deep.text();
    if (deep.status === 200 && /<div id="root">/.test(deepHtml)) {
      ok(`GET ${PREFIX}/graph (deep SPA link) → 200 app shell`);
    } else {
      fail(`GET ${PREFIX}/graph → ${deep.status} (expected the 200 app shell)`);
    }

    // 4. APIs under the prefix.
    console.log("\nAPIs under the prefix:");
    const health = await fetch(`${origin}${PREFIX}/api/healthz`);
    if (health.status === 200) ok(`GET ${PREFIX}/api/healthz → 200`);
    else fail(`GET ${PREFIX}/api/healthz → ${health.status}`);

    const leg = await fetch(`${origin}${PREFIX}/legomena/api/healthz`);
    const legBody = await leg.text();
    let legParsed: { status?: unknown; storeReady?: unknown } | null = null;
    try {
      legParsed = JSON.parse(legBody) as { status?: unknown; storeReady?: unknown };
    } catch {
      legParsed = null;
    }
    if (leg.status !== 200 || !legParsed || legParsed.status !== "ok") {
      fail(
        `GET ${PREFIX}/legomena/api/healthz → ${leg.status}, body ${legBody
          .slice(0, 80)
          .replace(/\s+/g, " ")}… (expected the Legomena health JSON — is the ` +
          `legomena/api location routed before the ${PREFIX}/ catch-all?)`,
      );
    } else if (legParsed.storeReady !== true) {
      fail(`GET ${PREFIX}/legomena/api/healthz → storeReady=${String(legParsed.storeReady)}`);
    } else {
      ok(`GET ${PREFIX}/legomena/api/healthz → Legomena health JSON with storeReady=true`);
    }

    // A Legomena PAGE (not API) must fall through to the main site's SPA.
    const legPage = await fetch(`${origin}${PREFIX}/legomena/sparql`);
    const legPageHtml = await legPage.text();
    if (legPage.status === 200 && /<div id="root">/.test(legPageHtml)) {
      ok(`GET ${PREFIX}/legomena/sparql (SPA page) → 200 app shell from the MAIN site`);
    } else {
      fail(
        `GET ${PREFIX}/legomena/sparql → ${legPage.status} (expected the main site's app shell — only /legomena/api may route to the Legomena server)`,
      );
    }

    // 5. LOD self-links: the bundle's default base URI must mint /Laertius
    // URIs, and the VoID document must be discoverable.
    console.log("\nLOD under the prefix:");
    const voidDoc = await fetch(`${origin}${PREFIX}/api/lod/void.ttl`);
    const voidText = await voidDoc.text();
    if (voidDoc.status !== 200 || voidText.trim().length === 0) {
      fail(`GET ${PREFIX}/api/lod/void.ttl → ${voidDoc.status} / empty`);
    } else if (!voidText.includes(LIVE_BASE_URI)) {
      fail(
        `GET ${PREFIX}/api/lod/void.ttl → 200 but no self-link under ${LIVE_BASE_URI} — the bundle's LOD base URI does not match the subpath deployment`,
      );
    } else {
      ok(`void.ttl self-links use the ${LIVE_BASE_URI} base URI`);
    }
    const badBase = voidText.match(/https:\/\/humanistica\.digitalia\.eu\/(?!laertius)[a-z]/);
    if (badBase) {
      fail(`void.ttl mints URIs outside ${LIVE_BASE_URI}: …${String(badBase[0])}…`);
    }

    const section = await fetch(`${origin}${PREFIX}/api/lod/section/1.1.22.jsonld`);
    const sectionText = await section.text();
    if (section.status !== 200) {
      fail(`GET ${PREFIX}/api/lod/section/1.1.22.jsonld → ${section.status}`);
    } else if (!sectionText.includes(`${LIVE_BASE_URI}/`)) {
      fail(
        `section 1.1.22 JSON-LD carries no ${LIVE_BASE_URI}/ URIs — per-passage self-links would break on the live site`,
      );
    } else {
      ok(`section 1.1.22 JSON-LD self-links use the ${LIVE_BASE_URI} base URI`);
    }

    const wellKnown = await fetch(`${origin}/.well-known/void`, {
      redirect: "manual",
    });
    const wkLocation = wellKnown.headers.get("location") ?? "";
    if (
      wellKnown.status >= 300 &&
      wellKnown.status < 400 &&
      wkLocation.includes("/api/lod/void")
    ) {
      ok(`GET /.well-known/void → ${wellKnown.status} ${wkLocation}`);
    } else {
      fail(
        `GET /.well-known/void → ${wellKnown.status} location=${wkLocation} (expected a redirect to the VoID document)`,
      );
    }
  } finally {
    proxy?.close();
    mainChild.kill("SIGTERM");
    legomenaChild.kill("SIGTERM");
    await new Promise((r) => setTimeout(r, 500));
    if (mainChild.exitCode === null) mainChild.kill("SIGKILL");
    if (legomenaChild.exitCode === null) legomenaChild.kill("SIGKILL");
    rmSync(work, { recursive: true, force: true });
    if (failures > 0) {
      console.error("\n--- main server log (tail) ---");
      console.error(mainLog.split("\n").slice(-15).join("\n"));
      console.error("--- legomena server log (tail) ---");
      console.error(legomenaLog.split("\n").slice(-15).join("\n"));
    }
  }

  console.log("");
  if (failures > 0) {
    console.error(
      `SUBPATH CHECK FAILED: ${failures} problem(s) — the bundle would break under ${LIVE_BASE_URI}. See above.`,
    );
    process.exit(1);
  }
  console.log(
    `SUBPATH CHECK PASSED: the bundle works behind the production nginx layout at ${LIVE_BASE_URI}.`,
  );
}

main().catch((err) => {
  console.error(String(err instanceof Error ? (err.stack ?? err.message) : err));
  process.exit(1);
});
